import type { ParserRuleContext } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import type { Expr, Projection, QueryExpr, SelectExpr } from "../src/ir/ir.js";
import { childExprs } from "../src/ir/walk.js";
import { inferType } from "../src/infer/infer.js";
import { inferNullability } from "../src/infer/nullability.js";
import { originsOf } from "../src/lineage/lineage.js";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { referencesAt } from "../src/references/references.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";

// ---------------------------------------------------------------------------
// Expr.kind "parameter" / "variable": a caller-bound placeholder (?, :name, $1,
// BigQuery @name) and a session/local variable reference (@x, @@sysvar). Wired up so far by
// postgres/redshift (:name, $1) and duckdb (?, $1, $name) — see tests/postgres.test.ts,
// tests/redshift.ir.test.ts, tests/duckdb.test.ts; other dialects are later per-dialect tasks.
// This file pins the SHARED consumers (infer, nullability, qualify, lineage, symbols,
// references, walk) against the DECIDED SHAPE independent of any one dialect's wire-up.
//
// Trees are hand-built here, borrowing real (distinct-span) ParserRuleContext nodes from a
// throwaway parse: every shared consumer only ever dereferences a cst's `start`/`stop` tokens for
// spans, never anything dialect-shaped, so a borrowed cst is a faithful stand-in.
// ---------------------------------------------------------------------------

/** `n` distinct, real ParserRuleContext nodes (increasing source spans), borrowed from a
 *  throwaway parse, one per projection/select/query slot a synthetic tree needs. */
function harvestCsts(n: number): ParserRuleContext[] {
	const sql = `SELECT ${Array.from({ length: n }, (_, i) => `c${i}`).join(", ")} FROM t`;
	const ast = lower(parseDatabricks(sql).tree);
	const body = ast.body as SelectExpr;
	return body.projections.map((p) => p.expr.cst);
}

interface Spec {
	name?: string;
	make: (cst: ParserRuleContext) => Expr;
}

/** A synthetic single-SELECT QueryExpr, one projection per spec, resolved to a real ScopeTree
 *  (dialect "databricks" is arbitrary; the shared layers under test are dialect-agnostic here). */
function build(specs: Spec[]): { scopes: ReturnType<typeof resolveScopes>; exprs: Expr[] } {
	const csts = harvestCsts(specs.length + 2);
	const exprs = specs.map((s, i) => s.make(csts[i]));
	const projections: Projection[] = specs.map((s, i) => ({
		name: s.name,
		isStar: false,
		expr: exprs[i],
		cst: csts[i],
	}));
	const body: SelectExpr = {
		kind: "select",
		projections,
		from: [],
		columns: [],
		aggregated: false,
		cst: csts[specs.length],
	};
	const query: QueryExpr = { kind: "query", ctes: [], body, cst: csts[specs.length + 1] };
	return { scopes: resolveScopes(query, "databricks"), exprs };
}

const bareParam = (cst: ParserRuleContext): Expr => ({ kind: "parameter", text: "?", cst });
const namedParam =
	(name: string) =>
	(cst: ParserRuleContext): Expr => ({ kind: "parameter", text: `:${name}`, name, cst });
const ordinalParam =
	(n: number) =>
	(cst: ParserRuleContext): Expr => ({ kind: "parameter", text: `$${n}`, ordinal: n, cst });
const localVar =
	(name: string) =>
	(cst: ParserRuleContext): Expr => ({ kind: "variable", text: `@${name}`, name, cst });
const systemVar =
	(name: string) =>
	(cst: ParserRuleContext): Expr => ({ kind: "variable", text: `@@${name}`, name, system: true, cst });

describe("parameter/variable IR: walk (leaves)", () => {
	it("childExprs returns no children for either kind", () => {
		const [cst] = harvestCsts(1);
		expect(childExprs(bareParam(cst))).toEqual([]);
		expect(childExprs(localVar("x")(cst))).toEqual([]);
	});
});

describe("parameter/variable IR: type inference", () => {
	it("both kinds infer unknown, always, in this slice", () => {
		const { scopes, exprs } = build([
			{ make: bareParam },
			{ make: namedParam("who") },
			{ make: ordinalParam(3) },
			{ make: localVar("x") },
			{ make: systemVar("rowcount") },
		]);
		for (const e of exprs) expect(inferType(e, scopes.root, new Schema({})).kind).toBe("unknown");
	});
});

describe("parameter/variable IR: nullability", () => {
	it("both kinds infer unknown nullability", () => {
		const { scopes, exprs } = build([{ make: bareParam }, { make: namedParam("x") }, { make: localVar("x") }]);
		for (const e of exprs) expect(inferNullability(e, scopes.root, new Schema({}))).toBe("unknown");
	});
});

describe("parameter/variable IR: lineage", () => {
	it("has no base-table origins (matches the literal convention: empty, not fabricated)", () => {
		const { scopes, exprs } = build([{ make: bareParam }, { make: localVar("x") }]);
		for (const e of exprs) expect(originsOf(e, scopes.root, new Schema({}))).toEqual([]);
	});
});

describe("parameter/variable IR: qualify", () => {
	it("fires no diagnostic on a synthetic tree containing them", () => {
		const { scopes } = build([{ make: bareParam }, { make: namedParam("x") }, { make: localVar("y") }]);
		expect(qualify(scopes, new Schema({})).diagnostics).toEqual([]);
	});

	it("as a call argument, is an unknown-typed operand: the existing unknown handling silences it", () => {
		// Mirrors tests/qualify.calls.test.ts's `abs(unknown_col)` case: databricks' curated `abs`
		// takes exactly 1 arg; an unknown-typed argument silences the operand-type check.
		const { scopes } = build([
			{
				make: (cst): Expr => ({
					kind: "function",
					name: "abs",
					args: [namedParam("y")(cst)],
					aggregate: false,
					distinct: false,
					cst,
				}),
			},
		]);
		const kinds = qualify(scopes, new Schema({})).diagnostics.map((d) => d.kind);
		expect(kinds).not.toContain("wrong-arity");
		expect(kinds).not.toContain("wrong-argument-type");
		expect(kinds).not.toContain("unknown-column");
	});
});

describe("parameter/variable IR: symbols", () => {
	it("deriveSymbols emits one Sym per occurrence: kind, modifier reference, name, span from the cst", () => {
		const { scopes, exprs } = build([{ make: bareParam }, { make: namedParam("who") }, { make: localVar("x") }]);
		const paramSyms = deriveSymbols(scopes).filter((s) => s.kind === "parameter" || s.kind === "variable");
		expect(paramSyms).toHaveLength(3);

		expect(paramSyms[0]).toMatchObject({ kind: "parameter", modifiers: ["reference"], name: "?" });
		expect(paramSyms[1]).toMatchObject({ kind: "parameter", modifiers: ["reference"], name: "who" });
		expect(paramSyms[2]).toMatchObject({ kind: "variable", modifiers: ["reference"], name: "x" });

		// No definition link in this slice (the tsql DECLARE task adds one).
		expect(paramSyms[0].definition).toBeUndefined();

		// Span comes from the node's own cst.
		const cst = exprs[0].cst;
		expect(paramSyms[0].span.start).toBe(cst.start!.start);
		expect(paramSyms[0].span.end).toBe(cst.stop!.stop + 1);
	});
});

describe("parameter/variable IR: references", () => {
	it("groups two same-named occurrences and separates a differently-named one", () => {
		const { scopes, exprs } = build([
			{ make: namedParam("x") },
			{ make: namedParam("x") },
			{ make: namedParam("y") },
		]);
		const offset = exprs[0].cst.start!.start;
		const occ = referencesAt(scopes, offset);
		expect(occ).not.toBeNull();
		expect(occ!.kind).toBe("parameter");
		expect(occ!.symbol).toBe("x");
		expect(occ!.occurrences).toHaveLength(2);
		expect(occ!.occurrences.every((o) => o.role === "reference")).toBe(true);
	});

	it("keeps parameter and variable groups separate even when the name string collides", () => {
		const { scopes, exprs } = build([{ make: namedParam("x") }, { make: localVar("x") }]);
		const paramOffset = exprs[0].cst.start!.start;
		const occ = referencesAt(scopes, paramOffset);
		expect(occ).not.toBeNull();
		expect(occ!.kind).toBe("parameter");
		expect(occ!.occurrences).toHaveLength(1); // the variable :x/@x share a name but not a kind
	});
});
