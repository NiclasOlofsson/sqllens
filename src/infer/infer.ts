import type { Expr, Projection } from "../databricks/ir.js";
import type { Schema } from "../qualify/schema.js";
import { splitColumnRefInScope, type ResolvedSource, type Scope } from "../scope/scope.js";
import { coerce, commonType } from "./coerce.js";
import { FUNCTION_RETURNS } from "./functions.js";
import { parseType, scalar, UNKNOWN, type Type } from "./types.js";

// ---------------------------------------------------------------------------
// Type inference — a bottom-up walk over the IR expression trees assigning a
// `Type` to each expression, after scope/qualify (name resolution). A column's
// type is its source column's type: from the schema for a base table, or by
// recursing into the projection that produces it for a CTE/subquery (the same
// origin-walk lineage uses). Anything without a rule yet is `unknown` — never
// guessed. Operators + the function return-type registry are the next layers.
// ---------------------------------------------------------------------------

export function inferType(expr: Expr, scope: Scope, schema: Schema, seen: Set<Scope> = new Set()): Type {
  switch (expr.kind) {
    case "literal":
      return literalType(expr.text);
    case "cast":
      return parseType(expr.typeText);
    case "predicate":
      return scalar("boolean");
    case "column":
      return columnType(expr, scope, schema, seen);
    case "binary":
      return binaryType(
        expr.op,
        inferType(expr.left, scope, schema, seen),
        inferType(expr.right, scope, schema, seen),
      );
    case "unary":
      return unaryType(expr.op, inferType(expr.operand, scope, schema, seen));
    case "function": {
      const rule = FUNCTION_RETURNS[expr.name.toLowerCase()];
      return rule ? rule(expr.args.map((a) => inferType(a, scope, schema, seen))) : UNKNOWN;
    }
    case "case": {
      const branches = expr.whens.map((w) => inferType(w.then, scope, schema, seen));
      if (expr.elseExpr) branches.push(inferType(expr.elseExpr, scope, schema, seen));
      return commonType(branches);
    }
    case "subscript": {
      const base = inferType(expr.base, scope, schema, seen);
      if (base.kind === "array") return base.element;
      if (base.kind === "map") return base.value;
      return UNKNOWN;
    }
    default:
      // subquery/exists/star/lambda/other — not yet typed.
      return UNKNOWN;
  }
}

const COMPARISON = new Set(["=", "==", "!=", "<>", "<", "<=", ">", ">=", "<=>"]);
const ARITHMETIC = new Set(["+", "-", "*", "/", "%", "div"]);

function binaryType(op: string, l: Type, r: Type): Type {
  const o = op.toLowerCase().trim();
  if (COMPARISON.has(o) || o === "and" || o === "or") return scalar("boolean");
  if (o === "||") return scalar("string");
  if (ARITHMETIC.has(o)) {
    if (isDate(l) && isInterval(r)) return l; // date/timestamp ± interval keeps the date type
    if (isDate(r) && isInterval(l)) return r;
    return coerce(l, r);
  }
  return UNKNOWN;
}

function unaryType(op: string, operand: Type): Type {
  const o = op.toLowerCase().trim();
  return o === "not" || o === "!" ? scalar("boolean") : operand;
}

function isDate(t: Type): boolean {
  return t.kind === "scalar" && (t.name === "date" || t.name === "timestamp");
}

function isInterval(t: Type): boolean {
  return t.kind === "scalar" && t.name === "interval";
}

function columnType(
  col: Extract<Expr, { kind: "column" }>,
  scope: Scope,
  schema: Schema,
  seen: Set<Scope>,
): Type {
  const found = resolveColumnSource(scope, col.parts, schema);
  if (!found) return UNKNOWN;
  const base = sourceColumnType(found.source, found.column, schema, seen);
  return found.fields.length ? fieldType(base, found.fields) : base;
}

/** Bind a column ref to its source, schema-aware (so a bare column over a physical table binds,
 *  which scope's schema-free resolveColumn cannot). Qualified → the source keyed by the qualifier;
 *  unqualified → the source whose columns (schema for a table, outputs for a derived relation)
 *  include the name. Walks enclosing scopes for correlation. */
function resolveColumnSource(
  scope: Scope,
  parts: string[],
  schema: Schema,
): { source: ResolvedSource; column: string; fields: string[] } | undefined {
  const split = splitColumnRefInScope(scope, parts);
  if (split.qualifier !== undefined) {
    for (let s: Scope | undefined = scope; s; s = s.parent) {
      const src = s.sources.get(split.qualifier);
      if (src) return { source: src, column: split.column, fields: split.fields };
    }
    return undefined;
  }
  const name = norm(split.column);
  for (let s: Scope | undefined = scope; s; s = s.parent) {
    for (const src of s.sources.values()) {
      const cols = columnNamesOf(src, schema);
      if (cols?.some((c) => norm(c) === name)) {
        return { source: src, column: split.column, fields: split.fields };
      }
    }
  }
  return undefined;
}

function columnNamesOf(src: ResolvedSource, schema: Schema): string[] | undefined {
  if (src.kind === "table") return src.source.columnAliases ?? schema.columnsFor(src.name)?.map((c) => c.name);
  if (src.kind === "cte") return src.ref.def.columnAliases ?? outputsOf(src.ref.scope);
  if (src.kind === "subquery") return src.source.columnAliases ?? outputsOf(src.scope);
  return src.source.columns; // lateral
}

function outputsOf(scope: Scope): string[] | undefined {
  return scope.outputs === "unknown" ? undefined : scope.outputs;
}

function sourceColumnType(src: ResolvedSource, column: string, schema: Schema, seen: Set<Scope>): Type {
  if (src.kind === "table") {
    if (src.source.columnAliases) return UNKNOWN; // inline aliases carry no type
    const t = schema.columnsFor(src.name)?.find((c) => eq(c.name, column))?.type;
    return t ? parseType(t) : UNKNOWN;
  }
  if (src.kind === "cte") return derivedColumnType(src.ref.scope, column, src.ref.def.columnAliases, schema, seen);
  if (src.kind === "subquery") return derivedColumnType(src.scope, column, src.source.columnAliases, schema, seen);
  return UNKNOWN; // lateral
}

/** Type a derived relation's output column by recursing into the projection that produces it. */
function derivedColumnType(
  child: Scope,
  column: string,
  aliases: string[] | undefined,
  schema: Schema,
  seen: Set<Scope>,
): Type {
  if (seen.has(child) || child.body.kind !== "select") return UNKNOWN; // cycle (recursive CTE) or set-op
  const projs = child.body.projections;
  let p: Projection | undefined;
  if (aliases) {
    const i = aliases.findIndex((a) => eq(a, column));
    p = i >= 0 ? projs[i] : undefined;
  } else {
    p = projs.find((pp) => pp.name !== undefined && eq(pp.name, column));
  }
  if (!p) return UNKNOWN;
  seen.add(child);
  const t = inferType(p.expr, child, schema, seen);
  seen.delete(child);
  return t;
}

/** Walk a struct field path over the type, returning the leaf field's type. */
function fieldType(type: Type, fields: string[]): Type {
  let t = type;
  for (const f of fields) {
    if (t.kind !== "struct") return UNKNOWN;
    const hit = t.fields.find((ff) => eq(ff.name, f));
    if (!hit) return UNKNOWN;
    t = hit.type;
  }
  return t;
}

function literalType(text: string): Type {
  const t = text.trim();
  if (/^['"]/.test(t)) return scalar("string");
  if (/^(true|false)$/i.test(t)) return scalar("boolean");
  if (/^null$/i.test(t)) return UNKNOWN; // null literal — type is context-dependent
  if (/^date\s*'/i.test(t)) return scalar("date");
  if (/^timestamp\s*'/i.test(t)) return scalar("timestamp");
  if (/^interval\b/i.test(t)) return scalar("interval");
  if (/^[+-]?\d+$/.test(t)) return scalar("int");
  if (/^[+-]?(\d+\.\d*|\.\d+|\d+)([eed][+-]?\d+)?$/i.test(t) && /[.eed]/i.test(t)) return scalar("double");
  return UNKNOWN;
}

function eq(a: string, b: string): boolean {
  return norm(a) === norm(b);
}

function norm(s: string): string {
  return (s.startsWith("`") && s.endsWith("`") ? s.slice(1, -1) : s).toLowerCase();
}
