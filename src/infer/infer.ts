import { behaviorOf } from "../dialect-behavior/carrier.js";
import { resolveBehavior } from "../dialect-behavior/registry.js";
import type { Expr, Projection, QueryExpr } from "../ir/ir.js";
import type { SchemaProvider } from "../qualify/schema-provider.js";
import { asProvider, tableSourceColumns } from "../qualify/relation-columns.js";
import { resolveScopes, type ResolvedSource, type Scope } from "../scope/scope.js";
import { resolveColumnSource } from "../sema/resolve.js";
import { coerce, commonType } from "./coerce.js";
import type { DialectBehavior } from "../dialect-behavior/behavior.js";
import { parseType, scalar, UNKNOWN, type Type } from "./types.js";

// ---------------------------------------------------------------------------
// Type inference — a bottom-up walk over the IR expression trees assigning a
// `Type` to each expression, after scope/qualify (name resolution). A column's
// type comes from the schema (base tables) or by recursing into the projection
// that produces it (CTE/subquery columns). Operators coerce; functions use the
// return-type registry; higher-order functions bind their lambda parameters and
// type the body. Anything genuinely undeterminable (no schema, no rule) is
// `unknown` — never guessed.
// ---------------------------------------------------------------------------

interface Ctx {
	/** Scopes on the current derived-column path — guards recursive CTEs. */
	seen: Set<Scope>;
	/** Lambda parameter types currently in scope (for higher-order functions). */
	env: Map<string, Type>;
}

const BOOLEAN = scalar("boolean");
const INT = scalar("int");

const freshCtx = (): Ctx => ({ seen: new Set(), env: new Map() });

export function inferType(expr: Expr, scope: Scope, schema: SchemaProvider, ctx: Ctx = freshCtx()): Type {
	const d = behaviorOf(scope);
	switch (expr.kind) {
		case "literal":
			return d.literal(expr.text);
		case "cast":
			return d.parseType(expr.typeText);
		case "predicate":
		case "exists":
			return BOOLEAN;
		case "column":
			return columnType(expr, scope, schema, ctx);
		case "binary":
			return binaryType(
				expr.op,
				inferType(expr.left, scope, schema, ctx),
				inferType(expr.right, scope, schema, ctx),
				d.division,
			);
		case "unary":
			return unaryType(expr.op, inferType(expr.operand, scope, schema, ctx));
		case "function":
			return functionType(expr, scope, schema, ctx);
		case "case": {
			const branches = expr.whens.map((w) => inferType(w.then, scope, schema, ctx));
			if (expr.elseExpr) branches.push(inferType(expr.elseExpr, scope, schema, ctx));
			return commonType(branches);
		}
		case "subscript": {
			const base = inferType(expr.base, scope, schema, ctx);
			if (base.kind === "array") return base.element;
			if (base.kind === "map") return base.value;
			// Semi-structured access stays semi-structured: variant:path / variant[i] → variant,
			// and OBJECT values are VARIANT (Snowflake).
			if (base.kind === "scalar" && (base.name === "variant" || base.name === "object")) {
				return scalar("variant");
			}
			return UNKNOWN;
		}
		case "subquery":
			return subqueryType(expr.query, schema, ctx, scope.dialect);
		case "with":
			// ZetaSQL WITH-expr evaluates to its result. Bindings are not substituted, so a binding
			// reference inside `result` types as a plain column ref (the documented lowering boundary).
			return inferType(expr.result, scope, schema, ctx);
		default:
			// star / lambda (typed only inside its higher-order function) / other.
			return UNKNOWN;
	}
}

// --- columns ---------------------------------------------------------------

/** Neutral provider value types → the engine's scalar Type (the channel-agreed vocabulary). */
const VALUE_TYPES = {
	string: scalar("string"),
	integer: scalar("int"),
	float: scalar("double"),
	boolean: scalar("boolean"),
} as const;

function columnType(col: Extract<Expr, { kind: "column" }>, scope: Scope, schema: SchemaProvider, ctx: Ctx): Type {
	// A template tag's placeholder fill: its type comes from the TemplateProvider's value
	// answer ({{ var('x') }}, a scalar macro), never from column resolution — the placeholder
	// name means nothing to the schema. No answer → unknown (never guessed).
	if (col.template) {
		const call = col.template.call;
		const v = call ? asProvider(schema)?.expansion(call)?.value : undefined;
		return v ? VALUE_TYPES[v.type] : UNKNOWN;
	}
	if (col.parts.length === 1) {
		const param = ctx.env.get(behaviorOf(scope).fold(col.parts[0])); // a lambda parameter shadows columns
		if (param) return param;
	}
	const found = resolveColumnSource(scope, col.parts, schema);
	if (!found) return UNKNOWN;
	const base = sourceColumnType(found.source, found.column, schema, ctx, behaviorOf(scope), scope.dialect);
	return found.fields.length ? fieldType(base, found.fields, scope.dialect) : base;
}

function sourceColumnType(
	src: ResolvedSource,
	column: string,
	schema: SchemaProvider,
	ctx: Ctx,
	d: DialectBehavior,
	dialect: string,
): Type {
	if (src.kind === "table") {
		// Declared columns carrying a type (T-SQL OPENJSON/OPENXML `WITH (col type …)`) type directly.
		const declared = src.source.declaredColumns?.find((c) => eq(c.name, column, dialect));
		if (declared) return declared.type ? d.parseType(declared.type) : UNKNOWN;
		if (src.source.columnAliases) return UNKNOWN; // inline aliases carry no type
		// Template-aware: a {{ ref }}/{{ source }} source resolves its typed columns through TemplateProvider.expansion().
		const t = tableSourceColumns(src.name, src.source.template, schema, dialect)?.find((c) =>
			eq(c.name, column, dialect),
		)?.type;
		return t ? d.parseType(t) : UNKNOWN;
	}
	if (src.kind === "cte") return derivedColumnType(src.ref.scope, column, src.ref.def.columnAliases, schema, ctx);
	if (src.kind === "subquery") return derivedColumnType(src.scope, column, src.source.columnAliases, schema, ctx);
	return UNKNOWN; // lateral
}

/** Type a derived relation's output column by recursing into the projection that produces it. */
function derivedColumnType(
	child: Scope,
	column: string,
	aliases: string[] | undefined,
	schema: SchemaProvider,
	ctx: Ctx,
): Type {
	if (ctx.seen.has(child) || child.body.kind !== "select") return UNKNOWN;
	const projs = child.body.projections;
	let p: Projection | undefined;
	if (aliases) {
		const i = aliases.findIndex((a) => eq(a, column, child.dialect));
		p = i >= 0 ? projs[i] : undefined;
	} else {
		p = projs.find((pp) => pp.name !== undefined && eq(pp.name, column, child.dialect));
	}
	if (!p) return starPassthroughType(child, column, schema, ctx);
	ctx.seen.add(child);
	const t = inferType(p.expr, child, schema, { seen: ctx.seen, env: new Map() }); // fresh env across scopes
	ctx.seen.delete(child);
	return t;
}

/** A column with no named projection may pass through a `*` projection (possibly modified):
 *  resolve it inside the producing scope, honouring EXCLUDE/ILIKE (removed → unknown),
 *  RENAME (the output name maps back to the source column) and REPLACE (the column's type
 *  is the replacing expression's). */
function starPassthroughType(child: Scope, column: string, schema: SchemaProvider, ctx: Ctx): Type {
	for (const p of child.body.kind === "select" ? child.body.projections : []) {
		if (!p.isStar || p.expr.kind !== "star") continue;
		const star = p.expr;
		const d = child.dialect;
		// Map the requested output name back to the underlying column (RENAME a AS b → b comes from a).
		const renamedTo = star.rename?.find((r) => eq(r.to, column, d));
		const under = renamedTo ? renamedTo.from : column;
		if (!renamedTo && star.rename?.some((r) => eq(r.from, column, d))) continue; // renamed away
		if (star.exclude?.some((e) => eq(e, under, d))) continue;
		if (star.ilike !== undefined && !resolveBehavior(d).likeMatch(star.ilike, resolveBehavior(d).fold(under))) continue;

		ctx.seen.add(child);
		const replaced = star.replace?.find((r) => eq(r.column, under, d));
		const parts = star.qualifier ? [star.qualifier[star.qualifier.length - 1], under] : [under];
		const t = replaced
			? inferType(replaced.expr, child, schema, { seen: ctx.seen, env: new Map() })
			: inferType({ kind: "column", parts, cst: star.cst }, child, schema, { seen: ctx.seen, env: new Map() });
		ctx.seen.delete(child);
		if (t.kind !== "unknown") return t;
	}
	return UNKNOWN;
}

function fieldType(type: Type, fields: string[], dialect: string): Type {
	let t = type;
	for (const f of fields) {
		if (t.kind !== "struct") return UNKNOWN;
		// Struct-field names on a Type are stored FOLDED — fold only the reference side.
		const hit = t.fields.find((ff) => ff.name === resolveBehavior(dialect).fold(f));
		if (!hit) return UNKNOWN;
		t = hit.type;
	}
	return t;
}

// --- functions, higher-order functions, constructors -----------------------

function functionType(fn: Extract<Expr, { kind: "function" }>, scope: Scope, schema: SchemaProvider, ctx: Ctx): Type {
	const name = fn.name.toLowerCase();
	const args = fn.args;
	const d = behaviorOf(scope);
	// Higher-order and constructor forms are BARE-name Spark/GoogleSQL builtins; a qualified/dotted
	// call (e.g. a `dataset.transform(...)` UDF) must not borrow them.
	if (fn.qualifier === undefined) {
		const hof = higherOrder(name, args, scope, schema, ctx);
		if (hof !== undefined) return hof;
		const ctor = constructor(name, args, scope, schema, ctx);
		if (ctor !== undefined) return ctor;
	}
	// A dialect pre-registry hook for calls no FnRule can type (e.g. BigQuery EXTRACT — the datepart
	// keyword, not an argument type, decides the return type).
	const special = d.special?.(fn);
	if (special !== undefined) return special;
	// Lookup order: registry[qualifier.name] (a dotted family) → registry[name] (bare) → unknown.
	const rule = (fn.qualifier ? d.functions[`${fn.qualifier}.${name}`] : undefined) ?? d.functions[name];
	return rule ? rule(args.map((a) => inferType(a, scope, schema, ctx))) : UNKNOWN;
}

// The arg index that MUST hold a lambda for a name to be the Spark higher-order form. A same-named
// call without a lambda there is a name collision (e.g. BigQuery multi-level `AGGREGATE(x ORDER BY
// key)`, not Spark `aggregate(array, init, merge)`) — bail so it falls through to the registry
// instead of indexing a missing arg. This keeps the engine total on cross-dialect input.
// Exported so `src/dialect-symbols.ts` can fold these genuine Spark builtin names into databricks's
// `functions` set — they're real functions (spark.apache.org/docs/latest/api/sql/#aggregate etc.)
// that never get a FnRule registry entry because they're typed via this special higher-order path
// instead, so they'd otherwise be invisible to a registry-keys-only membership check.
export const HOF_LAMBDA_ARG: Record<string, number> = {
	transform: 1,
	zip_with: 2,
	aggregate: 2,
	reduce: 2,
	transform_keys: 1,
	transform_values: 1,
};

/** Higher-order functions: bind the lambda parameters to the right element/value types, type the
 *  lambda body, and build the result. Returns undefined when `name` isn't a higher-order function. */
function higherOrder(name: string, args: Expr[], scope: Scope, schema: SchemaProvider, ctx: Ctx): Type | undefined {
	const lambdaArg = HOF_LAMBDA_ARG[name];
	if (lambdaArg !== undefined && args[lambdaArg]?.kind !== "lambda") return undefined;
	switch (name) {
		case "transform": {
			const elem = arrayElem(inferType(args[0], scope, schema, ctx));
			const body = lambdaResult(args[1], [elem, INT], scope, schema, ctx);
			return body !== undefined ? { kind: "array", element: body } : UNKNOWN;
		}
		case "zip_with": {
			const a = arrayElem(inferType(args[0], scope, schema, ctx));
			const b = arrayElem(inferType(args[1], scope, schema, ctx));
			const body = lambdaResult(args[2], [a, b], scope, schema, ctx);
			return body !== undefined ? { kind: "array", element: body } : UNKNOWN;
		}
		case "aggregate":
		case "reduce": {
			const elem = arrayElem(inferType(args[0], scope, schema, ctx));
			const init = inferType(args[1], scope, schema, ctx);
			const merged = lambdaResult(args[2], [init, elem], scope, schema, ctx) ?? init;
			if (args[3]?.kind === "lambda") return lambdaResult(args[3], [merged], scope, schema, ctx) ?? merged;
			return merged;
		}
		case "transform_keys": {
			const m = inferType(args[0], scope, schema, ctx);
			if (m.kind !== "map") return UNKNOWN;
			const k = lambdaResult(args[1], [m.key, m.value], scope, schema, ctx);
			return k !== undefined ? { kind: "map", key: k, value: m.value } : UNKNOWN;
		}
		case "transform_values": {
			const m = inferType(args[0], scope, schema, ctx);
			if (m.kind !== "map") return UNKNOWN;
			const v = lambdaResult(args[1], [m.key, m.value], scope, schema, ctx);
			return v !== undefined ? { kind: "map", key: m.key, value: v } : UNKNOWN;
		}
		default:
			return undefined;
	}
}

function lambdaResult(
	lambda: Expr | undefined,
	paramTypes: Type[],
	scope: Scope,
	schema: SchemaProvider,
	ctx: Ctx,
): Type | undefined {
	if (lambda?.kind !== "lambda") return undefined;
	const env = new Map(ctx.env);
	lambda.params.forEach((p, i) => env.set(behaviorOf(scope).fold(p), paramTypes[i] ?? UNKNOWN));
	return inferType(lambda.body, scope, schema, { seen: ctx.seen, env });
}

function arrayElem(t: Type): Type {
	return t.kind === "array" ? t.element : UNKNOWN;
}

/** map(), struct()/named_struct(), from_json() — types built from the arguments. */
function constructor(name: string, args: Expr[], scope: Scope, schema: SchemaProvider, ctx: Ctx): Type | undefined {
	if (name === "map") {
		const keys: Type[] = [];
		const values: Type[] = [];
		args.forEach((a, i) => (i % 2 === 0 ? keys : values).push(inferType(a, scope, schema, ctx)));
		return { kind: "map", key: commonType(keys), value: commonType(values) };
	}
	if (name === "named_struct") {
		const fields: { name: string; type: Type }[] = [];
		for (let i = 0; i + 1 < args.length; i += 2) {
			const key = args[i];
			const fname = key.kind === "literal" ? stringValue(key.text) : `col${i / 2 + 1}`;
			fields.push({
				name: behaviorOf(scope).fold(fname),
				type: inferType(args[i + 1], scope, schema, ctx),
			});
		}
		return { kind: "struct", fields };
	}
	if (name === "struct") {
		return {
			kind: "struct",
			fields: args.map((a, i) => ({
				name: a.kind === "column" ? behaviorOf(scope).fold(a.parts[a.parts.length - 1]) : `col${i + 1}`,
				type: inferType(a, scope, schema, ctx),
			})),
		};
	}
	if (name === "from_json") {
		const s = args[1];
		return s?.kind === "literal"
			? parseType(stringValue(s.text), undefined, (n) => behaviorOf(scope).fold(n))
			: UNKNOWN;
	}
	return undefined;
}

// --- subqueries ------------------------------------------------------------

function subqueryType(query: QueryExpr, schema: SchemaProvider, ctx: Ctx, dialect: string): Type {
	const root = resolveScopes(query, dialect).root;
	if (root.body.kind !== "select" || root.body.projections.length === 0) return UNKNOWN;
	return inferType(root.body.projections[0].expr, root, schema, { seen: ctx.seen, env: ctx.env });
}

// --- operators & literals --------------------------------------------------

const COMPARISON = new Set(["=", "==", "!=", "<>", "<", "<=", ">", ">=", "<=>"]);
const ARITHMETIC = new Set(["+", "-", "*", "/", "%", "div"]);

function binaryType(op: string, l: Type, r: Type, division: "float" | "integer" | "decimal"): Type {
	const o = op.toLowerCase().trim();
	if (COMPARISON.has(o) || o === "and" || o === "or") return BOOLEAN;
	if (o === "||") return scalar("string");
	if (o === "/" && division === "float") {
		// Spark/Databricks `/` is float division: decimal/decimal stays decimal, otherwise → double.
		if (l.kind === "unknown" || r.kind === "unknown") return UNKNOWN;
		const decimal = l.kind === "scalar" && l.name === "decimal" && r.kind === "scalar" && r.name === "decimal";
		return decimal ? scalar("decimal") : scalar("double");
	}
	if (o === "/" && division === "decimal") {
		// Snowflake `/` is decimal division: a scaled NUMBER (10/3 → 3.333333) unless a
		// float is involved, in which case the result is approximate.
		if (l.kind === "unknown" || r.kind === "unknown") return UNKNOWN;
		const isFloat = (t: Type) => t.kind === "scalar" && (t.name === "double" || t.name === "float");
		return isFloat(l) || isFloat(r) ? scalar("double") : scalar("decimal");
	}
	if (ARITHMETIC.has(o)) {
		if (isDate(l) && isInterval(r)) return l; // date/timestamp ± interval keeps the date type
		if (isDate(r) && isInterval(l)) return r;
		return coerce(l, r); // typed division (T-SQL int/int → int) and the other arithmetic ops
	}
	return UNKNOWN;
}

function unaryType(op: string, operand: Type): Type {
	const o = op.toLowerCase().trim();
	return o === "not" || o === "!" ? BOOLEAN : operand;
}

function isDate(t: Type): boolean {
	return t.kind === "scalar" && (t.name === "date" || t.name === "timestamp");
}

function isInterval(t: Type): boolean {
	return t.kind === "scalar" && t.name === "interval";
}

function stringValue(text: string): string {
	const t = text.trim();
	const quoted = (t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'));
	return quoted ? t.slice(1, -1) : t;
}

function eq(a: string, b: string, dialect?: string): boolean {
	return resolveBehavior(dialect).fold(a) === resolveBehavior(dialect).fold(b);
}
