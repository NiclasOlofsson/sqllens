import type { ParseTree, ParserRuleContext } from "antlr4ng";
import type { Expr, PipeStage, Projection } from "../ir/ir.js";
import { endPosition } from "../ir/span.js";
import { inferType } from "../infer/infer.js";
import type { Type } from "../infer/types.js";
import type { Scope, ScopeTree } from "../scope/scope.js";
import type { FnSignature } from "../signature/signatures.js";
import { behaviorOf } from "../dialect-behavior/carrier.js";
import type { Diagnostic } from "./qualify.js";
import type { SchemaProvider } from "./schema-provider.js";

// ---------------------------------------------------------------------------
// Call-signature diagnostics: arity + operand types, over the modelled function
// calls in the IR. Never-wrong: a diagnostic fires ONLY when the checker is
// certain the call is wrong. Two rules, in order of strictness:
//
//  - ARITY (both origins): the name is in the dialect's merged signature table
//    (src/<dialect>/signatures.generated.ts, curated overrides folded over the
//    harvested long tail) AND the call's arg count is matched by NO overload's
//    [min, max] window, so it fires wrong-arity. A variadic signature accepts any
//    count (the last param repeats), so it never flags. min = the count of
//    non-optional params; max = the param count. This is the deliberate flip
//    from the old curated-only design: the harvested tables now carry a
//    trustworthy optional/variadic encoding (tools/harvest-signatures.mjs's
//    NEVER-WRONG CONTRACT), so their arity is trusted too.
//
//  - OPERAND TYPE (origin "curated" only): every argument type is inferable
//    (not unknown) AND some argument position is rejected under `accepts()` (no
//    implicit widening path to the declared param type), so it fires
//    wrong-argument-type. Any `unknown` argument type anywhere makes the whole
//    call silent. Harvested entries still don't carry reliable enough types for
//    this rejection, so a harvested-origin signature never drives a
//    wrong-argument-type diagnostic.
//
// A qualified/dotted call (`ns.fn(...)`, sequence `.NEXTVAL`) does NOT match a
// bare-name signature: the table is bare-name only, so it stays silent.
// A named-argument call (`fn(x => v)`) can't be mapped to a positional arg list
// confidently, so it too stays silent.
//
// The checker walks the scope tree; for each scope it inspects THAT scope's own
// expressions (not nested subquery/EXISTS bodies: those are checked when their
// child scope is visited), so an argument's type is inferred in the scope where
// the call actually lives.
// ---------------------------------------------------------------------------

export function checkCalls(tree: ScopeTree, schema: SchemaProvider, diagnostics: Diagnostic[]): void {
	const visit = (scope: Scope): void => {
		for (const expr of ownExprs(scope)) walkCalls(expr, scope, schema, diagnostics);
		for (const child of scope.children) visit(child);
	};
	visit(tree.root);
}

/** The expressions OWNED by this scope — its body's own clause expressions (a nested subquery's live
 *  in its own child scope). A pipe-stage scope contributes its stage's expressions. */
function ownExprs(scope: Scope): Expr[] {
	if (scope.pipeStage) return stageExprs(scope.pipeStage);
	const body = scope.body;
	if (body.kind !== "select") return []; // setop columns are ColumnRefs; pipe exprs live in stage scopes
	const out: Expr[] = [];
	for (const proj of body.projections) out.push(proj.expr);
	if (body.where) out.push(body.where);
	if (body.having) out.push(body.having);
	if (body.qualify) out.push(body.qualify);
	for (const g of body.groupBy ?? []) out.push(g);
	for (const j of body.joinConditions ?? []) out.push(j);
	return out;
}

/** The modelled expressions of one pipe stage (mirrors the stages scope/qualify already flow). */
function stageExprs(stage: PipeStage): Expr[] {
	const projs = (ps: Projection[]): Expr[] => ps.map((p) => p.expr);
	switch (stage.op) {
		case "where":
			return [stage.predicate];
		case "select":
		case "extend":
		case "window":
			return projs(stage.projections);
		case "aggregate":
			return [...projs(stage.aggregates), ...stage.groupBy];
		case "orderBy":
			return stage.keys;
		case "set":
			return stage.assignments.map((a) => a.expr);
		case "call":
			return stage.args;
		case "assert":
			return [stage.condition, ...stage.payload];
		default:
			return [];
	}
}

/** Descend an expression, checking every modelled function call. Stops at subquery/EXISTS boundaries —
 *  their inner calls are checked in their own child scope, where their argument types resolve. */
function walkCalls(expr: Expr, scope: Scope, schema: SchemaProvider, diagnostics: Diagnostic[]): void {
	switch (expr.kind) {
		case "function":
			checkOneCall(expr, scope, schema, diagnostics);
			for (const a of expr.args) walkCalls(a, scope, schema, diagnostics);
			for (const e of expr.window?.partitionBy ?? []) walkCalls(e, scope, schema, diagnostics);
			for (const e of expr.window?.orderBy ?? []) walkCalls(e, scope, schema, diagnostics);
			return;
		case "binary":
			walkCalls(expr.left, scope, schema, diagnostics);
			walkCalls(expr.right, scope, schema, diagnostics);
			return;
		case "unary":
			walkCalls(expr.operand, scope, schema, diagnostics);
			return;
		case "cast":
			walkCalls(expr.expr, scope, schema, diagnostics);
			return;
		case "case":
			for (const w of expr.whens) {
				walkCalls(w.when, scope, schema, diagnostics);
				walkCalls(w.then, scope, schema, diagnostics);
			}
			if (expr.elseExpr) walkCalls(expr.elseExpr, scope, schema, diagnostics);
			return;
		case "predicate":
			walkCalls(expr.operand, scope, schema, diagnostics);
			for (const a of expr.args) walkCalls(a, scope, schema, diagnostics);
			return;
		case "lambda":
			walkCalls(expr.body, scope, schema, diagnostics);
			return;
		case "subscript":
			walkCalls(expr.base, scope, schema, diagnostics);
			walkCalls(expr.index, scope, schema, diagnostics);
			return;
		case "with":
			for (const b of expr.bindings) walkCalls(b.value, scope, schema, diagnostics);
			walkCalls(expr.result, scope, schema, diagnostics);
			return;
		case "star":
			for (const r of expr.replace ?? []) walkCalls(r.expr, scope, schema, diagnostics);
			return;
		// column / literal / subquery / exists / other → leaf, or its own scope: nothing to walk here.
	}
}

function checkOneCall(
	fn: Extract<Expr, { kind: "function" }>,
	scope: Scope,
	schema: SchemaProvider,
	diagnostics: Diagnostic[],
): void {
	// A named-argument invocation (fn(x => v)) can't be mapped to a positional arg list confidently.
	if (fn.argNames?.some((n) => n !== undefined)) return;
	// A qualified/dotted call must not borrow a bare-name signature (the table is bare-name only).
	if (fn.qualifier !== undefined) return;
	// Aggregate / window / DISTINCT forms carry modifiers the IR folds into (or out of) the arg list
	// unevenly: count(*) becomes 0 args, sum(x) FILTER/OVER/WITHIN GROUP, a dropped DISTINCT keyword,
	// so the positional arg count isn't a reliable signal. Per the never-wrong contract, stay SILENT.
	if (fn.aggregate || fn.window || fn.distinct) return;

	const b = behaviorOf(scope);
	const name = fn.name.toLowerCase();
	const sig = b.signatures[name];
	if (!sig) return; // unknown name — silent

	const args = fn.args;

	// Trust the IR arg list ONLY when it faithfully mirrors what was written. Some special call forms
	// lower to an arg list that doesn't match the source positionally: a keyword arg the lowering drops
	// (T-SQL/BigQuery DATEADD/DATE_DIFF's datepart), a boolean condition split into comparands (T-SQL
	// IIF), or the SQL-standard `f(x FROM y FOR z)` / nested-call over-capture (Postgres-family TRIM/
	// SUBSTRING). Comparing the IR arg count to the top-level comma count in the written call catches all
	// of these generically: a mismatch means the positional shape isn't reliable, so stay SILENT.
	const written = writtenArgCount(fn.cst);
	if (written !== null && written !== args.length) return;

	// --- arity: fires when the signature doesn't accept the count (both origins, the deliberate flip) ---
	if (!arityAccepts(sig, args.length)) {
		diagnostics.push(callDiag("wrong-arity", fn.cst, arityMessage([sig], args.length)));
		return; // one diagnostic per call — don't also type-check a call of the wrong shape
	}

	// --- operand type (origin "curated" only: harvested param types are never trusted for rejection) ---
	if (sig.origin !== "curated") return;
	const types = args.map((a) => inferType(a, scope, schema));
	if (types.some((t) => t.kind === "unknown")) return; // any unknown → silent
	for (let i = 0; i < types.length; i++) {
		const param = sig.variadic ? sig.params[Math.min(i, sig.params.length - 1)] : sig.params[i];
		if (param && !b.accepts(types[i], param.type)) {
			diagnostics.push(callDiag("wrong-argument-type", fn.cst, argMessage(sig, i, param.type ?? "?", types[i])));
			return; // one diagnostic per call
		}
	}
}

/** Whether a signature accepts `n` positional args. A variadic signature accepts any count (its last
 *  param repeats); a fixed one accepts [non-optional count, param count]. */
function arityAccepts(sig: FnSignature, n: number): boolean {
	if (sig.variadic) return true;
	const min = sig.params.filter((p) => !p.optional).length;
	return n >= min && n <= sig.params.length;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

function arityMessage(overloads: FnSignature[], got: number): string {
	const lo = Math.min(...overloads.map((s) => s.params.filter((p) => !p.optional).length));
	const hi = Math.max(...overloads.map((s) => (s.variadic ? Infinity : s.params.length)));
	const want = lo === hi ? `${lo}` : hi === Infinity ? `${lo}+` : `${lo}–${hi}`;
	return `${overloads[0].name} expects ${want} argument${hi === 1 ? "" : "s"}, got ${got}`;
}

function argMessage(sig: FnSignature, i: number, paramType: string, got: Type): string {
	const gotName = got.kind === "scalar" ? got.name : got.kind;
	return `${sig.name} argument ${i + 1} expects ${paramType}, got ${gotName}`;
}

/** The number of top-level positional arguments as WRITTEN in the call's source — the count of commas
 *  at the call's own paren depth, plus one, or 0 for empty parens. Returns null when the call's parens
 *  can't be located in the CST (then the caller trusts the IR count unconditionally). Nested parens,
 *  and commas inside them, are ignored; string/number literals are single tokens so their contents
 *  never register as `(`/`,`/`)`. */
function writtenArgCount(cst: ParserRuleContext): number | null {
	const toks: string[] = [];
	collectTerminals(cst, toks);
	const open = toks.indexOf("(");
	if (open === -1) return null;
	let depth = 0;
	let commas = 0;
	let hasContent = false;
	let closed = false;
	for (let i = open; i < toks.length; i++) {
		const t = toks[i];
		if (t === "(") {
			depth++;
			continue;
		}
		if (t === ")") {
			depth--;
			if (depth === 0) {
				closed = true;
				break;
			}
			continue;
		}
		if (depth === 1) {
			hasContent = true;
			if (t === ",") commas++;
		}
	}
	if (!closed) return null; // unbalanced within the CST — don't trust a partial count
	return hasContent ? commas + 1 : 0;
}

function collectTerminals(node: ParseTree, out: string[]): void {
	const n = node.getChildCount();
	if (n === 0) {
		out.push(node.getText());
		return;
	}
	for (let i = 0; i < n; i++) collectTerminals(node.getChild(i)!, out);
}

function callDiag(kind: Diagnostic["kind"], cst: ParserRuleContext, message: string): Diagnostic {
	const s = cst.start;
	const e = cst.stop ?? cst.start;
	const end = endPosition(e?.line ?? s?.line ?? 0, e?.column ?? 0, e?.text ?? "");
	return Object.freeze({
		kind,
		message,
		line: s?.line ?? 0,
		column: s?.column ?? 0,
		endLine: end.endLine,
		endColumn: end.endColumn,
	});
}
