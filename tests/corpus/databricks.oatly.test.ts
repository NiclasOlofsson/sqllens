import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "../helpers/corpus.js";
import { ParserRuleContext, type ParseTree } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { lower } from "../../src/databricks/lower.js";
import { parseDatabricks, type ParseResult } from "../../src/databricks/parse.js";
import { DatabricksParser as P } from "../../src/generated/databricks/DatabricksParser.js";
import type { Expr, QueryBody, QueryExpr } from "../../src/ir/ir.js";
import { lineage } from "../../src/lineage/lineage.js";
import { lineageAt, lineageOf } from "../../src/lineage/hops.js";
import { Schema } from "../../src/qualify/schema.js";
import { resolveScopes, type Scope, type ScopeTree } from "../../src/scope/scope.js";
import { resolveColumnRef } from "../../src/sema/resolve.js";
import { deriveSymbols } from "../../src/symbols/symbols.js";
import { probeBody } from "../helpers/body-probe.js";
import { sweepCallDiagnostics } from "../helpers/call-check.js";
import { walkIr as walkIrOther } from "../helpers/ir-walk.js";
import { allPipeStages, stageExprs, stageSubIr } from "../helpers/pipe-walk.js";

// ONE pass over the 1558 real (proprietary, gitignored) Oatly compiled-dbt models — the single
// highest-level pass for the Databricks pipeline. It replaces the corpus loops of SIX suites, each
// of which used to re-parse the whole corpus:
//   - databricks.local-coverage  → 0 syntax errors + the degenerate-tree guard
//   - ir-completeness            → walkIr, 0 `other` expressions
//   - conservation               → CST↔IR clause conservation (IR drops no clause the CST has)
//   - scope.corpus               → resolveScopes + resolveColumn stats/assertions (no throw)
//   - lineage (corpus part)      → lineage runs over every model, > 0 outputs
//   - symbols (corpus part)      → deriveSymbols over every model, each symbol has a frame + span
//
// The corpus is parsed ONCE per file (via parseDatabricks — the shipped `multiStatement` entry, which
// also closes the Task-5 review note that local-coverage tested a different entry). Every `it` below
// reads the same lazily-built module cache, so adding a concern costs no extra parse. Skips when the
// local corpus is absent.
const CORPUS = corpusPath("databricks/oatly");

interface Parsed {
	result: ParseResult;
	ir: QueryExpr;
	scopes: ScopeTree;
}

function corpusFiles(): string[] {
	return readdirSync(CORPUS, { recursive: true }).filter(
		(f): f is string => typeof f === "string" && f.endsWith(".sql"),
	);
}

// Parse → lower → resolveScopes ONCE per file, memoized. The first `it` to touch a file pays for it;
// every later concern reuses the cached result — so the whole corpus is parsed exactly once per run.
const cache = new Map<string, Parsed>();
function analyze(rel: string): Parsed {
	let hit = cache.get(rel);
	if (!hit) {
		const result = parseDatabricks(readFileSync(join(CORPUS, rel), "utf8"));
		const ir = lower(result.tree);
		const scopes = resolveScopes(ir);
		hit = { result, ir, scopes };
		cache.set(rel, hit);
	}
	return hit;
}

// ---- degenerate-tree guard (from local-coverage) ---------------------------------------------
// Spark's non-reserved keywords make zero-errors necessary but not sufficient: a "clean" parse can
// recognize nothing. The old guard required a real querySpecification anywhere in the tree; kept
// verbatim, now over the `multiStatement` root (querySpecification sits below it just the same).
function nodesOfRule(node: ParseTree, ruleIndex: number, acc: ParserRuleContext[] = []): ParserRuleContext[] {
	if (node instanceof ParserRuleContext && node.ruleIndex === ruleIndex) acc.push(node);
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child) nodesOfRule(child, ruleIndex, acc);
	}
	return acc;
}

function clusterKey(msg: string): string {
	return msg
		.replace(/^\d+:\d+ /, "")
		.replace(/'[^']*'/g, "'X'")
		.replace(/\{[^}]*\}/g, "{...}");
}

// ---- conservation (CST↔IR clause counts) -----------------------------------------------------
type Counts = Record<string, number>;
function* descendants(node: ParseTree): Generator<ParserRuleContext> {
	for (let i = 0; i < node.getChildCount(); i++) {
		const c = node.getChild(i);
		if (c instanceof ParserRuleContext) {
			yield c;
			yield* descendants(c);
		}
	}
}
function countRule(tree: ParseTree, ruleIndex: number): number {
	let n = 0;
	for (const d of descendants(tree)) if (d.ruleIndex === ruleIndex) n++;
	return n;
}
function countOrderBy(tree: ParseTree): number {
	let n = 0;
	for (const d of descendants(tree)) {
		if (d.ruleIndex !== P.RULE_queryOrganization) continue;
		for (let i = 0; i < d.getChildCount(); i++) {
			const c = d.getChild(i);
			if (c && !(c instanceof ParserRuleContext) && (c as { symbol?: { type: number } }).symbol?.type === P.ORDER)
				n++;
		}
	}
	return n;
}
function cstCounts(tree: ParseTree): Counts {
	return {
		where: countRule(tree, P.RULE_whereClause),
		groupBy: countRule(tree, P.RULE_aggregationClause),
		having: countRule(tree, P.RULE_havingClause),
		qualify: countRule(tree, P.RULE_qualifyClause),
		pivot: countRule(tree, P.RULE_pivotClause),
		unpivot: countRule(tree, P.RULE_unpivotClause),
		orderBy: countOrderBy(tree),
	};
}
function irClauseCounts(q: QueryExpr, acc: Counts): void {
	if (q.orderBy) acc.orderBy++;
	walkClauseBody(q.body, acc);
	for (const cte of q.ctes) irClauseCounts(cte.body, acc);
}
function walkClauseBody(b: QueryBody, acc: Counts): void {
	if (b.kind === "setop") {
		walkClauseBody(b.left, acc);
		walkClauseBody(b.right, acc);
		return;
	}
	if (b.kind === "pipe") {
		walkClauseBody(b.input, acc);
		for (const stage of allPipeStages(b)) for (const q of stageSubIr(stage)) irClauseCounts(q, acc);
		return;
	}
	if (b.where) acc.where++;
	if (b.groupBy) acc.groupBy++;
	if (b.having) acc.having++;
	if (b.qualify) acc.qualify++;
	if (b.pivot) acc.pivot++;
	if (b.unpivot) acc.unpivot++;
	for (const s of b.from) if (s.kind === "subquery") irClauseCounts(s.query, acc);
	for (const sub of b.subqueries ?? []) irClauseCounts(sub, acc);
	void (null as unknown as Expr);
}
const zeroCounts = (): Counts => ({ where: 0, groupBy: 0, having: 0, qualify: 0, pivot: 0, unpivot: 0, orderBy: 0 });

// ---- scope.corpus fidelity stats -------------------------------------------------------------
interface Stats {
	queries: number;
	ctes: number;
	projections: number;
	projectionsNamed: number;
	sources: number;
	tables: number;
	subqueries: number;
	exprNodes: number;
	exprOther: number;
	windowFns: number;
	aggregateFns: number;
}
function walkExpr(e: Expr, acc: Stats): void {
	acc.exprNodes++;
	switch (e.kind) {
		case "other":
			acc.exprOther++;
			break;
		case "function":
			if (e.window) acc.windowFns++;
			if (e.aggregate) acc.aggregateFns++;
			e.args.forEach((a) => walkExpr(a, acc));
			e.window?.partitionBy.forEach((a) => walkExpr(a, acc));
			e.window?.orderBy.forEach((a) => walkExpr(a, acc));
			break;
		case "binary":
			walkExpr(e.left, acc);
			walkExpr(e.right, acc);
			break;
		case "unary":
			walkExpr(e.operand, acc);
			break;
		case "cast":
			walkExpr(e.expr, acc);
			break;
		case "case":
			e.whens.forEach((w) => {
				walkExpr(w.when, acc);
				walkExpr(w.then, acc);
			});
			if (e.elseExpr) walkExpr(e.elseExpr, acc);
			break;
		case "predicate":
			walkExpr(e.operand, acc);
			e.args.forEach((a) => walkExpr(a, acc));
			break;
		case "lambda":
			walkExpr(e.body, acc);
			break;
		case "subscript":
			walkExpr(e.base, acc);
			if (e.index) walkExpr(e.index, acc);
			if (e.end) walkExpr(e.end, acc);
			if (e.step) walkExpr(e.step, acc);
			break;
	}
}
interface ScopeStats {
	scopes: number;
	outputsKnown: number;
	srcTable: number;
	srcCte: number;
	srcSubquery: number;
	unkTableStar: number;
	unkDerivedStar: number;
	unkExprOnly: number;
	colTotal: number;
	colBound: number;
	colAlias: number;
	colAmbiguous: number;
	colNeedsSchema: number;
	colUnresolved: number;
	unsupported: number;
}
function walkScopes(scope: Scope, acc: ScopeStats): void {
	acc.scopes++;
	if (scope.outputs !== "unknown") acc.outputsKnown++;
	else if (scope.body.kind === "select") {
		const hasStar = scope.body.projections.some((p) => p.isStar);
		if (!hasStar) {
			acc.unkExprOnly++;
		} else {
			const srcKinds = [...scope.sources.values()];
			const allPhysical = srcKinds.length > 0 && srcKinds.every((s) => s.kind === "table");
			if (allPhysical) acc.unkTableStar++;
			else acc.unkDerivedStar++;
		}
	}
	for (const src of scope.sources.values()) {
		if (src.kind === "table") acc.srcTable++;
		else if (src.kind === "cte") acc.srcCte++;
		else acc.srcSubquery++;
	}
	if (scope.body.kind === "select" && scope.body.unsupported) acc.unsupported++;
	for (const ref of scope.body.kind === "pipe" ? [] : scope.body.columns) {
		acc.colTotal++;
		const r = resolveColumnRef(scope, ref);
		if (r.kind === "bound") acc.colBound++;
		else if (r.kind === "alias") acc.colAlias++;
		else if (r.kind === "ambiguous") acc.colAmbiguous++;
		else if (r.kind === "needs-schema") acc.colNeedsSchema++;
		else acc.colUnresolved++;
	}
	for (const child of scope.children) walkScopes(child, acc);
}
function walkStats(q: QueryExpr, acc: Stats): void {
	acc.queries++;
	acc.ctes += q.ctes.length;
	for (const cte of q.ctes) walkStats(cte.body, acc);
	walkStatsBody(q.body, acc);
}
function walkStatsBody(body: QueryBody, acc: Stats): void {
	if (body.kind === "setop") {
		walkStatsBody(body.left, acc);
		walkStatsBody(body.right, acc);
		return;
	}
	if (body.kind === "pipe") {
		walkStatsBody(body.input, acc);
		for (const stage of allPipeStages(body)) {
			for (const e of stageExprs(stage)) walkExpr(e, acc);
			for (const q of stageSubIr(stage)) walkStats(q, acc);
		}
		return;
	}
	acc.projections += body.projections.length;
	acc.projectionsNamed += body.projections.filter((p) => p.name !== undefined).length;
	for (const p of body.projections) walkExpr(p.expr, acc);
	if (body.where) walkExpr(body.where, acc);
	for (const g of body.groupBy ?? []) walkExpr(g, acc);
	if (body.having) walkExpr(body.having, acc);
	for (const s of body.from) {
		acc.sources++;
		if (s.kind === "table") acc.tables++;
		else if (s.kind === "subquery") {
			acc.subqueries++;
			walkStats(s.query, acc);
		}
	}
}

describe.skipIf(!existsSync(CORPUS))("Databricks Oatly corpus — one pass, all pipeline gates", () => {
	// ---- 1. parse coverage + degenerate-tree guard (was databricks.local-coverage) ----------
	it("every compiled dbt model parses with 0 syntax errors and yields a real query tree", () => {
		const files = corpusFiles();
		let pass = 0;
		let withQuery = 0;
		const failures: { file: string; first?: string }[] = [];
		const degenerate: string[] = [];
		const clusters = new Map<string, number>();

		for (const rel of files) {
			const { result } = analyze(rel);
			const errors = result.errors;
			const first = result.diagnostics[0]
				? `${result.diagnostics[0].line}:${result.diagnostics[0].column} ${result.diagnostics[0].message}`
				: undefined;
			const hasQuery = nodesOfRule(result.tree, P.RULE_querySpecification).length > 0;
			if (hasQuery) withQuery++;
			if (errors === 0) {
				pass++;
				if (!hasQuery) degenerate.push(rel);
			} else {
				failures.push({ file: rel, first });
				if (first) clusters.set(clusterKey(first), (clusters.get(clusterKey(first)) ?? 0) + 1);
			}
		}

		const top = [...clusters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
		const pct = ((pass / files.length) * 100).toFixed(1);
		console.log(
			[
				``,
				`Databricks REAL corpus (compiled dbt models): ${files.length} files`,
				`  PASS (0 syntax errors): ${pass} (${pct}%)`,
				`  Recognized as queries:  ${withQuery}/${files.length}`,
				`  FAIL: ${failures.length}`,
				``,
				`Top failure clusters (normalized first error):`,
				...top.map(([k, n]) => `  ${String(n).padStart(4)}  ${k}`),
				``,
				`Sample failing files:`,
				...failures.slice(0, 10).map((f) => `  - ${f.file}  | ${f.first}`),
			].join("\n"),
		);

		expect(files.length).toBeGreaterThan(0);
		// THE Databricks baseline. Two-part gate, both required because Spark over-accepts:
		//   1. every compiled Oatly model parses with zero syntax errors, and
		//   2. every clean parse yields a real query tree (no degenerate "parsed but recognized
		//      nothing" results).
		expect(failures).toEqual([]);
		expect(degenerate).toEqual([]);
	}, 180000);

	// ---- 2. IR completeness — 0 `other` (was ir-completeness) --------------------------------
	it("lowers every expression to a typed node — nothing falls through to `other`", () => {
		const files = corpusFiles();
		const tally = new Map<string, number>();
		const samples = new Map<string, string>();
		for (const rel of files) walkIrOther(analyze(rel).ir, tally, samples);
		const total = [...tally.values()].reduce((s, n) => s + n, 0);
		if (total > 0) {
			const lines = [...tally.entries()]
				.sort((a, b) => b[1] - a[1])
				.map(([name, n]) => `  ${n}  ${name}   e.g. ${samples.get(name)}`);
			throw new Error(`IR left ${total} expression(s) as \`other\` — model these:\n${lines.join("\n")}`);
		}
		expect(total).toBe(0);
	}, 120000);

	// ---- 3. CST↔IR conservation (was conservation, corpus part) ------------------------------
	it("the IR drops no clause the CST contains, across all models", () => {
		const files = corpusFiles();
		const cstTotal = zeroCounts();
		const irTotal = zeroCounts();
		const offenders: Record<string, string> = {};
		for (const rel of files) {
			const { result, ir } = analyze(rel);
			const cst = cstCounts(result.tree);
			const ir2 = zeroCounts();
			irClauseCounts(ir, ir2);
			for (const k of Object.keys(cst)) {
				cstTotal[k] += cst[k];
				irTotal[k] += ir2[k];
				if (cst[k] > ir2[k] && !offenders[k]) offenders[k] = `${rel} (CST ${cst[k]} > IR ${ir2[k]})`;
			}
		}
		console.log(
			[
				"",
				"CST vs IR clause counts over the corpus:",
				...Object.keys(cstTotal).map((k) => `  ${k.padEnd(8)} CST ${cstTotal[k]}  IR ${irTotal[k]}`),
				...(Object.keys(offenders).length
					? ["dropped (first offender):", ...Object.entries(offenders).map(([k, v]) => `  ${k}: ${v}`)]
					: []),
			].join("\n"),
		);
		// The IR must not DROP a clause the CST has. (IR >= CST is fine; IR < CST is a dropped construct.)
		for (const k of Object.keys(cstTotal)) {
			expect(
				irTotal[k],
				`IR dropped some ${k} (CST ${cstTotal[k]} > IR ${irTotal[k]}) e.g. ${offenders[k]}`,
			).toBeGreaterThanOrEqual(cstTotal[k]);
		}
	}, 180000);

	// ---- 4. semantic layer — lower + resolveScopes total + fidelity stats (was scope.corpus) -
	it("lower + resolveScopes run over every model without throwing", () => {
		const files = corpusFiles();
		let scoped = 0;
		let setOpFiles = 0;
		const callHits: string[] = []; // Task 12: call-signature diagnostics must be zero over valid SQL
		const stats: Stats = {
			queries: 0,
			ctes: 0,
			projections: 0,
			projectionsNamed: 0,
			sources: 0,
			tables: 0,
			subqueries: 0,
			exprNodes: 0,
			exprOther: 0,
			windowFns: 0,
			aggregateFns: 0,
		};
		const scopeStats: ScopeStats = {
			scopes: 0,
			outputsKnown: 0,
			srcTable: 0,
			srcCte: 0,
			srcSubquery: 0,
			unkTableStar: 0,
			unkDerivedStar: 0,
			unkExprOnly: 0,
			colTotal: 0,
			colBound: 0,
			colAlias: 0,
			colAmbiguous: 0,
			colNeedsSchema: 0,
			colUnresolved: 0,
			unsupported: 0,
		};
		for (const rel of files) {
			const sql = readFileSync(join(CORPUS, rel), "utf8");
			if (/\b(union|except|intersect|minus)\b/i.test(sql)) setOpFiles++;
			// analyze() already lowered + resolved this file (once). A cached hit means both succeeded;
			// the memoized builder throws to the test on any real failure, so reaching here == scoped.
			const { ir, scopes } = analyze(rel);
			scoped++;
			walkStats(ir, stats);
			walkScopes(scopes.root, scopeStats);
			sweepCallDiagnostics(scopes, rel, callHits);
		}
		const pct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) : "0.0");
		console.log(
			[
				``,
				`Semantic layer over ${files.length} compiled models:`,
				`  scope ok: ${scoped}    failures: ${files.length - scoped}`,
				`  files with a set-op keyword: ${setOpFiles}  (now lowered as SetOpExpr, both branches kept)`,
				``,
				`IR fidelity (across ${stats.queries} query blocks):`,
				`  CTEs:        ${stats.ctes}`,
				`  sources:     ${stats.sources}  (tables ${stats.tables}, subqueries ${stats.subqueries})`,
				`  projections: ${stats.projections}  named ${stats.projectionsNamed} (${pct(stats.projectionsNamed, stats.projections)}%)`,
				`  expr nodes:  ${stats.exprNodes}  modelled ${pct(stats.exprNodes - stats.exprOther, stats.exprNodes)}% (other ${stats.exprOther}); window fns ${stats.windowFns}, aggregate fns ${stats.aggregateFns}`,
				``,
				`Scope resolution (${scopeStats.scopes} scopes):`,
				`  outputs known: ${scopeStats.outputsKnown} (${pct(scopeStats.outputsKnown, scopeStats.scopes)}%)`,
				`  outputs unknown by cause: table-star ${scopeStats.unkTableStar} (needs catalog), ` +
					`derived-star ${scopeStats.unkDerivedStar} (schema-free), expr-only ${scopeStats.unkExprOnly}`,
				`  sources: table ${scopeStats.srcTable}, cte ${scopeStats.srcCte}, subquery ${scopeStats.srcSubquery}`,
				`  scopes with unmodelled constructs (pivot/unpivot/lateral): ${scopeStats.unsupported}`,
				``,
				`Column binding (${scopeStats.colTotal} refs, schema-free):`,
				`  bound ${scopeStats.colBound} (${pct(scopeStats.colBound, scopeStats.colTotal)}%), ` +
					`alias ${scopeStats.colAlias}, ambiguous ${scopeStats.colAmbiguous}, ` +
					`needs-schema ${scopeStats.colNeedsSchema}, unresolved ${scopeStats.colUnresolved}`,
			].join("\n"),
		);
		expect(files.length).toBeGreaterThan(0);
		// Gate: lower + resolveScopes must never throw on a real model.
		expect(scoped).toBe(files.length);
		// Task 12 honesty gate: the call-signature checker must be silent over valid production SQL.
		expect(
			callHits,
			`call-signature checker fired on valid SQL (fix the signature table / checker, never exclude):\n${callHits.slice(0, 20).join("\n")}`,
		).toEqual([]);
	}, 180000);

	// ---- 5. lineage over the corpus (was lineage, corpus part) -------------------------------
	it("lineage runs over every model without throwing", () => {
		const files = corpusFiles();
		let outputs = 0;
		for (const rel of files) outputs += lineage(analyze(rel).scopes, new Schema({})).length;
		expect(outputs).toBeGreaterThan(0);
	}, 120000);

	// ---- 6. deriveSymbols over the corpus (was symbols, corpus part) -------------------------
	it("derives symbols for every model without throwing; each has a frame and a span", () => {
		const files = corpusFiles();
		let total = 0;
		for (const rel of files) {
			const syms = deriveSymbols(analyze(rel).scopes);
			for (const s of syms) {
				if (!s.frame || s.span.line < 0) throw new Error(`bad symbol in ${rel}: ${JSON.stringify(s)}`);
			}
			total += syms.length;
		}
		expect(total).toBeGreaterThan(0);
		console.log(`\nderiveSymbols: ${total} symbols across ${files.length} models`);
	}, 120000);

	// ---- 7. per-hop lineage totality (Task 6) -----------------------------------------------
	// For every model, sample lineageAt at up to 3 offsets — the first projection's expr start + mid,
	// and a WHERE-clause column ref when present — and lineageOf on that projection (UNWRAPPED, so a
	// real internal throw surfaces; lineageAt itself is total). No extra parse: reuses cached scopes.
	it("per-hop lineage (lineageAt/lineageOf) runs over every model without throwing", () => {
		const files = corpusFiles();
		let probed = 0;
		for (const rel of files) {
			const { scopes } = analyze(rel);
			const probe = firstSelectProbe(scopes.root);
			if (!probe) continue;
			const { scope, projection, offsets } = probe;
			// Unwrapped: exercises the real walk; a throw here fails the model, not silently swallowed.
			lineageOf(projection, scope);
			for (const off of offsets) lineageAt(scopes, off); // total (undefined off-symbol is fine)
			probed++;
		}
		expect(probed).toBeGreaterThan(0);
		console.log(`\nper-hop lineage: probed ${probed}/${files.length} models`);
	}, 120000);

	// ---- 8. body-non-emptiness conservation probe -------------------------------------------
	// The totality gate (4, above) and the `other`-ratchet (2) prove no-throw and no-undermodelled
	// expression, but neither asserts a lowered SelectExpr actually carries a body. See
	// tests/helpers/body-probe.ts and .claude/PLAN.md "Corpus gates can't see an empty lowered body".
	it("no SelectExpr body is empty and unflagged (body-non-emptiness probe)", () => {
		const files = corpusFiles();
		const bodyEmpty: string[] = [];
		for (const rel of files) probeBody(analyze(rel).ir, rel, bodyEmpty);
		expect(
			bodyEmpty,
			`empty, unflagged SelectExpr bodies found:\n${bodyEmpty.slice(0, 20).join("\n")}`,
		).toEqual([]);
	}, 120000);
});

/** The first select scope carrying a projection, with sampled offsets (projection expr start + mid,
 *  and its first WHERE column ref when present) — the totality-rider probe. */
function firstSelectProbe(
	root: Scope,
): { scope: Scope; projection: import("../../src/ir/ir.js").Projection; offsets: number[] } | undefined {
	const visit = (scope: Scope): ReturnType<typeof firstSelectProbe> => {
		const body = scope.body;
		if (body.kind === "select" && body.projections.length > 0) {
			const p = body.projections[0];
			const offsets: number[] = [];
			const s = p.expr.cst?.start?.start;
			const e = p.expr.cst?.stop?.stop;
			if (typeof s === "number") offsets.push(s);
			if (typeof s === "number" && typeof e === "number") offsets.push(Math.floor((s + e) / 2));
			const wref = body.where && body.columns.find((c) => c.clause === "where");
			const w = wref?.cst?.start?.start;
			if (typeof w === "number") offsets.push(w);
			if (offsets.length > 0) return { scope, projection: p, offsets };
		}
		for (const child of scope.children) {
			const hit = visit(child);
			if (hit) return hit;
		}
		return undefined;
	};
	return visit(root);
}
