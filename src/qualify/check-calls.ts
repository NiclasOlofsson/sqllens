import type { ParseTree, ParserRuleContext } from "antlr4ng";
import type { Expr, PipeStage, Projection } from "../ir/ir.js";
import { endPosition } from "../ir/span.js";
import { inferType } from "../infer/infer.js";
import { inferDialect } from "../infer/dialect.js";
import type { Type } from "../infer/types.js";
import type { Scope, ScopeTree } from "../scope/scope.js";
import { FUNCTION_SIGNATURES, HARVESTED_SIGNATURES, type FnSignature } from "../signature/signatures.js";
import type { Dialect } from "../dialect.js";
import type { Diagnostic } from "./qualify.js";
import type { SchemaProvider } from "./schema-provider.js";

// ---------------------------------------------------------------------------
// Call-signature diagnostics — arity + operand types, over the modelled function
// calls in the IR. Never-wrong: a diagnostic fires ONLY when the checker is
// certain the call is wrong. Two rules, in order of strictness:
//
//  - ARITY (curated only): the name is in the CURATED signature table AND the
//    call's arg count is matched by NO overload's [min, max] window → wrong-arity.
//    A variadic signature accepts any count (the last param repeats), so it never
//    flags. min = the count of non-optional params; max = the param count.
//
//  - OPERAND TYPE (curated only): every argument type is inferable (≠ unknown)
//    AND some argument position is rejected under `accepts()` (no implicit
//    widening path to the declared param type) → wrong-argument-type. Any
//    `unknown` argument type anywhere makes the whole call silent.
//
// HARVESTED signatures are NOT trusted for either rejection: their param lists
// (tools/harvest-signatures.mjs, T-SQL 151 entries) carry no optional/variadic
// encoding and no reliable types, so an arity/type check over them would fire on
// valid SQL (see ARITY_USES_HARVESTED below). They still drive signatureAt() hints.
//
// A qualified/dotted call (`ns.fn(...)`, sequence `.NEXTVAL`) does NOT match a
// bare-name curated entry — the tables are bare-name only, so it stays silent.
// A named-argument call (`fn(x => v)`) can't be mapped to a positional arg list
// confidently, so it too stays silent.
//
// The checker walks the scope tree; for each scope it inspects THAT scope's own
// expressions (not nested subquery/EXISTS bodies — those are checked when their
// child scope is visited), so an argument's type is inferred in the scope where
// the call actually lives.
// ---------------------------------------------------------------------------

/** Risk-flag (c) escape hatch. Harvested arity data (T-SQL's 151-entry generated table is the only
 *  one today) does not encode which params are optional, nor mark variadic reliably, so an arity
 *  check over it fires on valid SQL. Kept curated-only, VISIBLY, for every dialect. Flip a dialect
 *  on only once its harvested table earns it (optional/variadic encoding proven against the corpus). */
const ARITY_USES_HARVESTED: Record<Dialect, boolean> = {
	databricks: false,
	tsql: false,
	snowflake: false,
	bigquery: false,
	redshift: false,
	postgres: false,
	duckdb: false,
	trino: false,
	sqlite: false,
	mysql: false,
};

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
	// A qualified/dotted call must not borrow a bare-name signature (the tables are bare-name only).
	if (fn.qualifier !== undefined) return;
	// Aggregate / window / DISTINCT forms carry modifiers the IR folds into (or out of) the arg list
	// unevenly — count(*)→0 args, sum(x) FILTER/OVER/WITHIN GROUP, a dropped DISTINCT keyword — so the
	// positional arg count isn't a reliable signal. Per the never-wrong contract, stay SILENT on them.
	if (fn.aggregate || fn.window || fn.distinct) return;

	const dialect = scope.dialect as Dialect;
	const name = fn.name.toLowerCase();
	const curated = FUNCTION_SIGNATURES[dialect]?.[name];

	// Arity overloads: the curated signature always; the harvested one ONLY for a dialect whose
	// harvested arity data is trusted (none today — see ARITY_USES_HARVESTED). The rule fires when NO
	// overload accepts the arg count.
	const overloads: FnSignature[] = [];
	if (curated) overloads.push(curated);
	if (ARITY_USES_HARVESTED[dialect]) {
		const harvested = HARVESTED_SIGNATURES[dialect]?.[name];
		if (harvested && harvested !== curated) overloads.push(harvested);
	}
	if (overloads.length === 0) return; // uncurated (and no trusted harvested) — silent

	const args = fn.args;

	// Trust the IR arg list ONLY when it faithfully mirrors what was written. Some special call forms
	// lower to an arg list that doesn't match the source positionally: a keyword arg the lowering drops
	// (T-SQL/BigQuery DATEADD/DATE_DIFF's datepart), a boolean condition split into comparands (T-SQL
	// IIF), or the SQL-standard `f(x FROM y FOR z)` / nested-call over-capture (Postgres-family TRIM/
	// SUBSTRING). Comparing the IR arg count to the top-level comma count in the written call catches all
	// of these generically — a mismatch means the positional shape isn't reliable, so stay SILENT.
	const written = writtenArgCount(fn.cst);
	if (written !== null && written !== args.length) return;

	// --- arity: fire only when NO overload accepts the count ---
	if (overloads.every((s) => !arityAccepts(s, args.length))) {
		diagnostics.push(callDiag("wrong-arity", fn.cst, arityMessage(overloads, args.length)));
		return; // one diagnostic per call — don't also type-check a call of the wrong shape
	}

	// --- operand type (CURATED only — harvested param types are never trusted for rejection) ---
	if (!curated) return;
	const types = args.map((a) => inferType(a, scope, schema));
	if (types.some((t) => t.kind === "unknown")) return; // any unknown → silent
	for (let i = 0; i < types.length; i++) {
		const param = curated.variadic ? curated.params[Math.min(i, curated.params.length - 1)] : curated.params[i];
		if (param && !accepts(types[i], param.type, dialect)) {
			diagnostics.push(
				callDiag("wrong-argument-type", fn.cst, argMessage(curated, i, param.type ?? "?", types[i])),
			);
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
// Coercion — conservative acceptance of an argument type for a declared param type. Never-wrong:
// return true (accept) unless we are CONFIDENT the two are incompatible FOR THIS DIALECT. Implicit
// conversion rules are dialect law, not shared SQL law — the same str→num mismatch is a hard type
// error in BigQuery and perfectly valid Spark — so the reject decision is per-dialect capability,
// not a global set. `string` is a universal sink (any scalar renders as text), so a widening TO
// string is always accepted; only two directional mismatches are ever rejected, each gated on the
// dialect NOT bridging it implicitly.
// ---------------------------------------------------------------------------

type Family = "num" | "str" | "bool" | "temporal" | "binary" | "other";

const NUMERIC = new Set(["tinyint", "smallint", "int", "bigint", "float", "double", "decimal"]);
const TEMPORAL = new Set(["date", "timestamp", "time", "interval"]);

function familyOf(name: string): Family {
	if (NUMERIC.has(name)) return "num";
	if (name === "string") return "str";
	if (name === "boolean") return "bool";
	if (TEMPORAL.has(name)) return "temporal";
	if (name === "binary") return "binary";
	return "other";
}

/** Dialects that implicitly bridge STRING→numeric in a function argument, so a str→num mismatch must
 *  NOT be flagged. Doc-cited per dialect:
 *  - databricks: implicit crosscasting casts STRING to the expected numeric type
 *    (docs.databricks.com/sql/language-manual/sql-ref-datatype-rules — the docs corpus itself carries
 *    `substring('hello', '1', 2)` and `date_add(date'2011-11-30', '5')` as documented-valid examples);
 *  - tsql: char/varchar→int/decimal is an implicit conversion in the CAST/CONVERT conversion chart
 *    (learn.microsoft.com/sql/t-sql/functions/cast-and-convert-transact-sql) — `ABS('1')` is valid;
 *  - snowflake: VARCHAR containing a number coerces to NUMBER
 *    (docs.snowflake.com/en/sql-reference/data-type-conversion — implicit casting/coercion);
 *  - redshift: PG-8.0 lineage keeps pre-8.3 implicit text→numeric casts
 *    (docs.aws.amazon.com/redshift/latest/dg/c_Supported_data_types.html — type compatibility:
 *    CHAR/VARCHAR→numeric implicit);
 *  - postgres / duckdb: a quoted constant is initially of UNKNOWN type (postgresql.org/docs/18
 *    sql-syntax-lexical §4.1.2.1) and coerces to whatever the call needs — `abs('1')` is valid — but
 *    our inference types every quoted literal as `string`, so a str-typed arg may really be an
 *    untyped literal; rejecting would false-fire on valid SQL.
 *  NOT in the set (rejection stays live, corpus-proven): bigquery — no STRING→numeric coercion in the
 *  conversion rules (`ABS('1')` is "No matching signature"; 14.7k analyzer positives sweep clean);
 *  trino — implicit coercion is numeric/character widening only (`abs('1')` is "Unexpected
 *  parameters"; 635 docs-corpus positives sweep clean). */
const IMPLICIT_STR_TO_NUM: ReadonlySet<Dialect> = new Set([
	"databricks",
	"tsql",
	"snowflake",
	"redshift",
	"postgres",
	"duckdb",
	// sqlite: dynamic/flexible typing with TEXT<->NUMERIC type affinity — a TEXT value coerces
	// against a numeric column/argument automatically (sqlite.org/datatype3.html "Type Affinity");
	// there is no strict typing to reject a str-shaped argument against.
	"sqlite",
	// mysql: implicit string<->number coercion in arithmetic/comparison — "if one of the operands
	// is a string, ... it is not treated as a number" is the ONLY exception (comparing two hex
	// strings); numeric context otherwise converts a string operand to a number automatically
	// (dev.mysql.com/doc/refman/8.4/en/type-conversion.html "Type Conversion in Expression
	// Evaluation").
	"mysql",
]);

/** Dialects that implicitly bridge boolean↔numeric: T-SQL only, whose `bit` (aliased to boolean by
 *  TSQL_ALIASES) converts to/from int implicitly per the same CAST/CONVERT chart. Everywhere else
 *  bool→num / num→bool rejection is safe (Spark: "cannot resolve 'abs(true)' due to data type
 *  mismatch"; Snowflake: "Invalid argument types for function 'ABS': (BOOLEAN)"; PG/DuckDB/BigQuery/
 *  Trino likewise reject) — and corpus-proven across all eight sweeps. sqlite is left out: it has no
 *  dedicated boolean storage class at all (TRUE/FALSE are literal aliases for the integers 1/0 —
 *  sqlite.org/lang_expr.html#literal_values_constants_), so this checker never sees a `boolean`-typed
 *  argument for it; membership here is moot unless the corpus proves otherwise. mysql is left out for
 *  the same reason: BOOL/BOOLEAN is a documented TINYINT(1) synonym, not a distinct storage class
 *  (dev.mysql.com/doc/refman/8.4/en/numeric-type-syntax.html), and TRUE/FALSE are synonyms for 1/0
 *  (src/infer/mysql.ts's mysqlLiteral types them `int`) — so this checker never sees a `boolean`-typed
 *  mysql argument either, unless a later MYSQL_ALIASES entry (B-R5.2) changes that; membership here is
 *  moot until then / unless the corpus proves otherwise. */
const IMPLICIT_BOOL_NUM: ReadonlySet<Dialect> = new Set(["tsql"]);

function accepts(argType: Type, paramText: string | undefined, dialect: Dialect): boolean {
	if (!paramText) return true; // untyped param → no information, accept
	const param = inferDialect(dialect).parseType(paramText);
	if (param.kind !== "scalar" || argType.kind !== "scalar") return true; // complex/unknown → accept
	const fa = familyOf(argType.name);
	const fp = familyOf(param.name);
	if (fa === fp) return true; // same family → accept
	if (fa === "str" && fp === "num") return IMPLICIT_STR_TO_NUM.has(dialect);
	if ((fa === "bool" && fp === "num") || (fa === "num" && fp === "bool")) return IMPLICIT_BOOL_NUM.has(dialect);
	return true; // every other cross-family pair (incl. → str, temporal, binary, other) — accept
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
