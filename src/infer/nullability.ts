import { resolveBehavior } from "../dialect-behavior/registry.js";
import type { Expr, Projection, Source } from "../ir/ir.js";
import type { SchemaProvider } from "../qualify/schema-provider.js";
import { tableSourceColumns } from "../qualify/relation-columns.js";
import { type ResolvedSource, type Scope } from "../scope/scope.js";
import { resolveColumnSource } from "../sema/resolve.js";

// ---------------------------------------------------------------------------
// Nullability inference — a bottom-up walk over the IR expression trees that runs
// PARALLEL to type inference (src/infer/infer.ts): it mirrors that engine's
// architecture (column/derived-column recursion, cycle guard) but computes a
// three-valued Nullability instead of a Type. It NEVER touches the Type ADT, the
// FnRule registry, or coercion — a separate, tiny function table lives here.
//
// NEVER-WRONG is the binding contract: a definite verdict ("notnull"/"nullable")
// is returned ONLY when provable from expression shape + schema + join shape;
// anything with doubt is "unknown". A wrong nullability verdict is a defect.
//
// Explicit boundary — NO FLOW NARROWING: `WHERE x IS NOT NULL` does NOT upgrade a
// downstream `x` to notnull. That is dataflow analysis, a separable subsystem;
// this stage ships expression-shape + schema + join-shape nullability, which is
// complete for that scope. Flow narrowing is a tracked open gap.
// ---------------------------------------------------------------------------

export type Nullability = "notnull" | "nullable" | "unknown";

interface Ctx {
	/** Scopes on the current derived-column path — guards recursive CTEs (mirrors infer.ts). */
	seen: Set<Scope>;
}

const freshCtx = (): Ctx => ({ seen: new Set() });

export function inferNullability(expr: Expr, scope: Scope, schema: SchemaProvider, ctx: Ctx = freshCtx()): Nullability {
	switch (expr.kind) {
		case "literal":
			return isNullLiteral(expr.text) ? "nullable" : "notnull";
		case "column":
			return columnNullability(expr, scope, schema, ctx);
		case "cast":
			// A cast never introduces or removes NULLs — the operand decides (TRY_CAST could add
			// NULLs on failure, so it degrades to nullable/unknown rather than claiming notnull).
			return expr.try
				? weakenToNullable(inferNullability(expr.expr, scope, schema, ctx))
				: inferNullability(expr.expr, scope, schema, ctx);
		case "unary":
			// Unary arithmetic (`-x`) and `NOT` propagate NULL: the result is null iff the operand is.
			return inferNullability(expr.operand, scope, schema, ctx);
		case "binary":
			return binaryNullability(
				expr.op,
				inferNullability(expr.left, scope, schema, ctx),
				inferNullability(expr.right, scope, schema, ctx),
			);
		case "case":
			return caseNullability(expr, scope, schema, ctx);
		case "function":
			return functionNullability(expr, scope, schema, ctx);
		default:
			// predicate / exists / subquery / subscript / star / lambda / with / parameter / variable /
			// other: no provable verdict without more machinery (three-valued predicates, scalar-
			// subquery cardinality, nested-field nullability, a DECLARE-typed variable). NEVER-WRONG default.
			return "unknown";
	}
}

// --- literals --------------------------------------------------------------

function isNullLiteral(text: string): boolean {
	return text.trim().toLowerCase() === "null";
}

// --- columns ---------------------------------------------------------------

function columnNullability(
	col: Extract<Expr, { kind: "column" }>,
	scope: Scope,
	schema: SchemaProvider,
	ctx: Ctx,
): Nullability {
	// A template tag's placeholder fill — the provider's value answer carries no nullability
	// signal, and the placeholder name must never resolve as a real column. NEVER-WRONG default.
	if (col.template) return "unknown";
	const found = resolveColumnSource(scope, col.parts, schema);
	if (!found) return "unknown";
	// Struct/map field navigation (`a.b.c`): the schema states a column's nullability, not a nested
	// field's — so any field access is unknown.
	if (found.fields.length) return "unknown";
	return sourceColumnNullability(found.source, found.column, scope, schema, ctx);
}

function sourceColumnNullability(
	src: ResolvedSource,
	column: string,
	scope: Scope,
	schema: SchemaProvider,
	ctx: Ctx,
): Nullability {
	// A source on the null-extended side of an outer join yields NULLs for its rows regardless of the
	// underlying column — so the whole column is nullable, whatever its base verdict would be.
	const source = irSourceOf(src);
	if (source && nullExtendedColumn(scope, source)) return "nullable";

	if (src.kind === "table") return tableColumnNullability(src, column, scope.dialect, schema);
	if (src.kind === "cte")
		return derivedColumnNullability(src.ref.scope, column, src.ref.def.columnAliases, schema, ctx);
	if (src.kind === "subquery")
		return derivedColumnNullability(src.scope, column, src.source.columnAliases, schema, ctx);
	return "unknown"; // lateral / relation (pipe) / graphtable / pivot — no schema nullability
}

/** Schema-declared nullability of a physical table column (Task-9 leaf `{ nullable }`). */
function tableColumnNullability(
	src: Extract<ResolvedSource, { kind: "table" }>,
	column: string,
	dialect: string,
	schema: SchemaProvider,
): Nullability {
	// Declared / inline-aliased columns (T-SQL OPENJSON WITH (col type …), `t (c1, c2)`) carry no
	// nullability signal.
	if (src.source.declaredColumns?.some((c) => eq(c.name, column, dialect))) return "unknown";
	if (src.source.columnAliases) return "unknown";
	// Template-aware (inc3.2): catalog columns carry `nullable` too.
	const col = tableSourceColumns(src.name, src.source.template, schema, dialect)?.find((c) =>
		eq(c.name, column, dialect),
	);
	if (!col) return "unknown"; // no schema / unknown table / unknown column
	if (col.nullable === false) return "notnull";
	if (col.nullable === true) return "nullable";
	return "unknown"; // `nullable` absent = unknown — never guessed
}

/** Nullability of a derived relation's output column: recurse into the producing projection, exactly
 *  like infer.ts's derivedColumnType. Cycle-guarded for recursive CTEs. */
function derivedColumnNullability(
	child: Scope,
	column: string,
	aliases: string[] | undefined,
	schema: SchemaProvider,
	ctx: Ctx,
): Nullability {
	if (ctx.seen.has(child) || child.body.kind !== "select") return "unknown";
	const projs = child.body.projections;
	let p: Projection | undefined;
	if (aliases) {
		const i = aliases.findIndex((a) => eq(a, column, child.dialect));
		p = i >= 0 ? projs[i] : undefined;
	} else {
		p = projs.find((pp) => pp.name !== undefined && eq(pp.name, column, child.dialect));
	}
	if (!p) return starPassthroughNullability(child, column, schema, ctx);
	ctx.seen.add(child);
	const n = inferNullability(p.expr, child, schema, ctx);
	ctx.seen.delete(child);
	return n;
}

/** A column with no named projection may pass through a `*` projection (mirrors infer.ts's
 *  starPassthroughType): resolve it inside the producing scope, honouring EXCLUDE/ILIKE (removed →
 *  unknown), RENAME (output name → source column) and REPLACE (the replacing expression's verdict). */
function starPassthroughNullability(child: Scope, column: string, schema: SchemaProvider, ctx: Ctx): Nullability {
	for (const p of child.body.kind === "select" ? child.body.projections : []) {
		if (!p.isStar || p.expr.kind !== "star") continue;
		const star = p.expr;
		const d = child.dialect;
		const renamedTo = star.rename?.find((r) => eq(r.to, column, d));
		const under = renamedTo ? renamedTo.from : column;
		if (!renamedTo && star.rename?.some((r) => eq(r.from, column, d))) continue; // renamed away
		if (star.exclude?.some((e) => eq(e, under, d))) continue;
		if (star.ilike !== undefined && !resolveBehavior(d).likeMatch(star.ilike, resolveBehavior(d).fold(under)))
			continue;

		ctx.seen.add(child);
		const replaced = star.replace?.find((r) => eq(r.column, under, d));
		const parts = star.qualifier ? [star.qualifier[star.qualifier.length - 1], under] : [under];
		const n = replaced
			? inferNullability(replaced.expr, child, schema, ctx)
			: inferNullability({ kind: "column", parts, cst: star.cst }, child, schema, ctx);
		ctx.seen.delete(child);
		if (n !== "unknown") return n;
	}
	return "unknown";
}

/** The IR Source object a ResolvedSource wraps (reference-identical to a `SelectExpr.from` entry) —
 *  used to test outer-join null extension via the Join list. undefined for pipe/pivot sources. */
function irSourceOf(src: ResolvedSource): Source | undefined {
	switch (src.kind) {
		case "table":
		case "cte":
		case "subquery":
		case "lateral":
		case "graphtable":
			return src.source;
		default:
			return undefined; // relation (pipe stage) / pivot — not a plain FROM entry
	}
}

// --- outer-join null extension ---------------------------------------------
// A source is null-extended when the join shape can produce NULL rows for it: LEFT extends the RIGHT
// (joined) source, RIGHT extends the LEFT sources, FULL extends BOTH. Read off the first-class `joins`
// array (each `join.source` is reference-identical to a `from` entry — the additive
// Join-node model). Comma-FROM sources (never in `joins`) are never null-extended.

/** Find the scope that owns `source` (walking outward for correlation) and test null extension there. */
function nullExtendedColumn(scope: Scope, source: Source): boolean {
	for (let s: Scope | undefined = scope; s; s = s.parent) {
		if (s.body.kind === "select" && s.body.from.includes(source)) return nullExtended(s, source);
	}
	return false;
}

function nullExtended(scope: Scope, source: Source): boolean {
	const body = scope.body;
	if (body.kind !== "select" || !body.joins) return false;
	const from = body.from;
	const srcIdx = from.indexOf(source);
	if (srcIdx < 0) return false;
	for (const j of body.joins) {
		if (source === j.source && (j.kind === "left" || j.kind === "full")) return true; // right side of LEFT/FULL
		if (j.kind === "right" || j.kind === "full") {
			const jIdx = from.indexOf(j.source);
			if (jIdx >= 0 && srcIdx < jIdx) return true; // a left source of a RIGHT/FULL join
		}
	}
	return false;
}

// --- operators -------------------------------------------------------------

// Standard comparison operators propagate NULL (NULL = 5 → NULL). Spark's null-safe `<=>` is
// NOT in this set — it never returns NULL (spark.apache.org/docs/latest/api/sql/#_2), so it gets
// its own always-notnull rule below rather than the operand fold.
const COMPARISON = new Set(["=", "==", "!=", "<>", "<", "<=", ">", ">="]);
const ARITHMETIC = new Set(["+", "-", "*", "/", "%", "div"]);

function binaryNullability(op: string, l: Nullability, r: Nullability): Nullability {
	const o = op.toLowerCase().trim();
	// Arithmetic and comparison propagate NULL by the simple operand fold.
	if (ARITHMETIC.has(o) || COMPARISON.has(o)) return fold([l, r]);
	// The null-safe equality operator returns TRUE/FALSE for every input, NULLs included — never NULL.
	if (o === "<=>") return "notnull";
	// Boolean AND/OR are three-valued: two non-NULL booleans give a non-NULL result, but a nullable
	// operand does NOT make the result nullable (NULL AND FALSE → FALSE, NULL OR TRUE → TRUE) — so
	// only the all-notnull case is provable; anything else is unknown.
	if (o === "and" || o === "or") return l === "notnull" && r === "notnull" ? "notnull" : "unknown";
	// Concat and everything else → unknown (never-wrong).
	return "unknown";
}

/** notnull if ALL operands notnull, nullable if ANY is nullable, else unknown (SQL null propagation). */
function fold(ns: Nullability[]): Nullability {
	if (ns.some((n) => n === "nullable")) return "nullable";
	if (ns.length > 0 && ns.every((n) => n === "notnull")) return "notnull";
	return "unknown";
}

/** A verdict weakened by a possibly-NULL-introducing operation (TRY_CAST): a provable notnull becomes
 *  nullable; nullable stays nullable; unknown stays unknown. */
function weakenToNullable(n: Nullability): Nullability {
	return n === "notnull" ? "nullable" : n;
}

// --- CASE ------------------------------------------------------------------

function caseNullability(
	expr: Extract<Expr, { kind: "case" }>,
	scope: Scope,
	schema: SchemaProvider,
	ctx: Ctx,
): Nullability {
	// No ELSE: a row matching no WHEN yields NULL → the whole expression is nullable.
	if (!expr.elseExpr) return "nullable";
	const branches = expr.whens.map((w) => inferNullability(w.then, scope, schema, ctx));
	branches.push(inferNullability(expr.elseExpr, scope, schema, ctx));
	return fold(branches);
}

// --- functions -------------------------------------------------------------
// A small, doc-cited table SEPARATE from the FnRule type registry: name → (arg nullabilities) →
// result nullability. Absent name → unknown, UNLESS the call is a (non-COUNT) aggregate, which is
// nullable over empty / all-NULL groups. Only BARE-name calls consult the table (a dotted UDF such as
// `pkg.fn(...)` must not borrow a builtin's rule).

/** COALESCE / IFNULL / NVL / 2-arg ISNULL — returns the first non-NULL argument, or NULL if all are
 *  NULL. So: notnull if ANY arg is provably notnull; nullable only if EVERY arg is nullable; else
 *  unknown (an unknown arg might secretly be notnull, so we can't claim nullable). */
function coalesceLike(args: Nullability[]): Nullability {
	if (args.some((a) => a === "notnull")) return "notnull";
	if (args.length > 0 && args.every((a) => a === "nullable")) return "nullable";
	return "unknown";
}

const NULLABLE = (): Nullability => "nullable";
const NOTNULL = (): Nullability => "notnull";

// Doc citations:
//   coalesce/ifnull/nvl → returns first non-NULL / NULL if all NULL (Spark, Snowflake NVL).
//   isnull is DIALECT-POLYMORPHIC, arity-gated: the 1-arg form (Spark/Databricks isnull(expr),
//     spark.apache.org/docs/latest/api/sql/#isnull; also Postgres-family boolean tests) is a
//     predicate returning true/false — NEVER NULL → notnull. The 2-arg form is T-SQL's
//     replacement function ISNULL(check, replacement) (learn.microsoft.com/sql/t-sql/functions/
//     isnull-transact-sql), coalesce-like. T-SQL's ISNULL requires exactly 2 args and the
//     predicate dialects have no 2-arg isnull, so arity separates the readings exactly.
//   NULLIF(a,b) → a or NULL when a=b, so always nullable.
//   count / count_if → an aggregate count is never NULL (0 for empty groups).
//   sum/avg/min/max & other aggregates → NULL over an empty or all-NULL group.
//   current_date / current_timestamp / now → the session clock is always a value, never NULL.
const FN: Record<string, (args: Nullability[]) => Nullability> = {
	coalesce: coalesceLike,
	ifnull: coalesceLike,
	nvl: coalesceLike,
	isnull: (args) => (args.length === 1 ? "notnull" : coalesceLike(args)),
	nullif: NULLABLE,
	count: NOTNULL,
	count_if: NOTNULL,
	countif: NOTNULL, // BigQuery spelling
	sum: NULLABLE,
	avg: NULLABLE,
	min: NULLABLE,
	max: NULLABLE,
	current_date: NOTNULL,
	current_timestamp: NOTNULL,
	now: NOTNULL,
};

function functionNullability(
	fn: Extract<Expr, { kind: "function" }>,
	scope: Scope,
	schema: SchemaProvider,
	ctx: Ctx,
): Nullability {
	// A dotted / qualified call is a user function — no builtin knowledge.
	if (fn.qualifier !== undefined) return "unknown";
	const rule = FN[fn.name.toLowerCase()];
	if (rule) return rule(fn.args.map((a) => inferNullability(a, scope, schema, ctx)));
	// "other aggregates → nullable": any aggregate not named above (sum/min/… covered) returns NULL on
	// empty / all-NULL groups. COUNT/COUNT_IF are handled by the table before this.
	if (fn.aggregate) return "nullable";
	return "unknown"; // an unregistered scalar function — never guessed
}

// --- helpers ---------------------------------------------------------------

function eq(a: string, b: string, dialect?: string): boolean {
	return resolveBehavior(dialect).fold(a) === resolveBehavior(dialect).fold(b);
}
