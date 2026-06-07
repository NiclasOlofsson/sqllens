import type { Expr, QueryExpr } from "../ir/ir.js";
import type { Schema } from "../qualify/schema.js";
import { resolveScopes, type ResolvedSource, type Scope, type ScopeTree } from "../scope/scope.js";
import { columnNamesOf, normalizeName, resolveColumnSource } from "../sema/resolve.js";

// ---------------------------------------------------------------------------
// Column-level lineage — for each output column of a query, the base-table
// columns it derives from. It rides the same post-qualify origin-walk as type
// inference (resolve a column back through CTEs/subqueries/unions to its source),
// but carries a SET of origin columns instead of a type, and needs no function /
// coercion catalogs: an expression's output derives from the union of every
// column that feeds it (so even higher-order functions need no special handling —
// the output traces to all the function's arguments). Needs a schema to expand
// `*` and to bind bare columns to a physical table.
// ---------------------------------------------------------------------------

export interface Origin {
  /** The base table this column ultimately comes from (multipart name parts). */
  table: string[];
  /** The column in that base table. */
  column: string;
}

export interface ColumnLineage {
  /** The output column name. */
  output: string;
  /** The base-table columns it derives from, deduped. Empty for a pure literal/constant. */
  origins: Origin[];
}

/** Lineage of a query's output columns: each output → the base-table columns it derives from. */
export function lineage(tree: ScopeTree, schema: Schema): ColumnLineage[] {
  return bodyLineage(tree.root, schema, new Set());
}

/** The base-table origins of a single expression (e.g. a projection or a column reference). */
export function originsOf(expr: Expr, scope: Scope, schema: Schema): Origin[] {
  return dedup(exprOrigins(expr, scope, schema, new Set()));
}

function bodyLineage(scope: Scope, schema: Schema, seen: Set<Scope>): ColumnLineage[] {
  const body = scope.body;
  if (body.kind === "setop") {
    // A union: output column i derives from BOTH branches' column i.
    const left = scope.branches ? bodyLineage(scope.branches.left, schema, seen) : [];
    const right = scope.branches ? bodyLineage(scope.branches.right, schema, seen) : [];
    return left.map((l, i) => ({
      output: l.output,
      origins: dedup([...l.origins, ...(right[i]?.origins ?? [])]),
    }));
  }
  const out: ColumnLineage[] = [];
  for (const p of body.projections) {
    if (p.isStar) {
      const qualifier = p.expr.kind === "star" ? p.expr.qualifier : undefined;
      out.push(...starLineage(scope, qualifier, schema, seen));
    } else if (p.name !== undefined) {
      out.push({ output: p.name, origins: dedup(exprOrigins(p.expr, scope, schema, seen)) });
    }
    // anonymous projection → no nameable output, skip
  }
  return out;
}

/** Expand `*` / `t.*`: each source column becomes an output, traced to its origins. */
function starLineage(
  scope: Scope,
  qualifier: string[] | undefined,
  schema: Schema,
  seen: Set<Scope>,
): ColumnLineage[] {
  const want = qualifier ? normalizeName(qualifier[qualifier.length - 1] ?? "") : undefined;
  const out: ColumnLineage[] = [];
  for (const [key, src] of scope.sources) {
    if (want !== undefined && key !== want) continue;
    for (const col of columnNamesOf(src, schema) ?? []) {
      out.push({ output: col, origins: dedup(columnOrigins(src, col, schema, seen)) });
    }
  }
  return out;
}

/** The base-table columns an expression derives from — the union over every contributing column. */
function exprOrigins(expr: Expr, scope: Scope, schema: Schema, seen: Set<Scope>): Origin[] {
  switch (expr.kind) {
    case "column":
      return columnRefOrigins(expr.parts, scope, schema, seen);
    case "binary":
      return [...exprOrigins(expr.left, scope, schema, seen), ...exprOrigins(expr.right, scope, schema, seen)];
    case "unary":
      return exprOrigins(expr.operand, scope, schema, seen);
    case "cast":
      return exprOrigins(expr.expr, scope, schema, seen);
    case "function":
      return [
        ...expr.args.flatMap((a) => exprOrigins(a, scope, schema, seen)),
        ...(expr.window?.partitionBy ?? []).flatMap((a) => exprOrigins(a, scope, schema, seen)),
        ...(expr.window?.orderBy ?? []).flatMap((a) => exprOrigins(a, scope, schema, seen)),
      ];
    case "case":
      return [
        ...expr.whens.flatMap((w) => [
          ...exprOrigins(w.when, scope, schema, seen),
          ...exprOrigins(w.then, scope, schema, seen),
        ]),
        ...(expr.elseExpr ? exprOrigins(expr.elseExpr, scope, schema, seen) : []),
      ];
    case "predicate":
      return [
        ...exprOrigins(expr.operand, scope, schema, seen),
        ...expr.args.flatMap((a) => exprOrigins(a, scope, schema, seen)),
      ];
    case "subscript":
      return [...exprOrigins(expr.base, scope, schema, seen), ...exprOrigins(expr.index, scope, schema, seen)];
    case "lambda":
      return exprOrigins(expr.body, scope, schema, seen); // param refs resolve to nothing
    case "subquery":
    case "exists":
      return subqueryOrigins(expr.query, schema, seen);
    default:
      return []; // literal / star / other
  }
}

function columnRefOrigins(parts: string[], scope: Scope, schema: Schema, seen: Set<Scope>): Origin[] {
  const found = resolveColumnSource(scope, parts, schema);
  return found ? columnOrigins(found.source, found.column, schema, seen) : [];
}

/** The origins of `column` exposed by a source — a base table is a leaf; a derived relation
 *  recurses into the projection (or source) that produces the column. */
function columnOrigins(src: ResolvedSource, column: string, schema: Schema, seen: Set<Scope>): Origin[] {
  if (src.kind === "table") return [{ table: src.name, column }];
  if (src.kind === "cte") return derivedOrigins(src.ref.scope, column, src.ref.def.columnAliases, schema, seen);
  if (src.kind === "subquery") return derivedOrigins(src.scope, column, src.source.columnAliases, schema, seen);
  return []; // lateral — no base-table origin
}

function derivedOrigins(
  child: Scope,
  column: string,
  aliases: string[] | undefined,
  schema: Schema,
  seen: Set<Scope>,
): Origin[] {
  if (seen.has(child)) return []; // recursive CTE — stop
  seen.add(child); // guard the whole subtree (incl. a set-op body that re-references this relation)
  try {
    if (child.body.kind === "setop") {
      const lin = bodyLineage(child, schema, seen);
      const i = aliases ? aliases.findIndex((a) => eq(a, column)) : lin.findIndex((l) => eq(l.output, column));
      return i >= 0 ? (lin[i]?.origins ?? []) : [];
    }
    if (child.body.kind !== "select") return [];
    const projs = child.body.projections;
    let producer: Expr | undefined;
    if (aliases) {
      const i = aliases.findIndex((a) => eq(a, column));
      producer = i >= 0 ? projs[i]?.expr : undefined;
    } else {
      producer = projs.find((p) => !p.isStar && p.name !== undefined && eq(p.name, column))?.expr;
    }
    // A named projection produces it directly; otherwise it flows through a `*`/source — resolve it
    // as a column reference inside the child scope.
    return producer
      ? exprOrigins(producer, child, schema, seen)
      : columnRefOrigins([column], child, schema, seen);
  } finally {
    seen.delete(child);
  }
}

function subqueryOrigins(query: QueryExpr, schema: Schema, seen: Set<Scope>): Origin[] {
  // A scalar/EXISTS subquery contributes its output column's origins. Its scope is built fresh;
  // correlated refs in the body bind to nothing here, which is fine — we trace the value column.
  const root = resolveScopes(query).root;
  if (root.body.kind !== "select" || root.body.projections.length === 0) return [];
  return exprOrigins(root.body.projections[0].expr, root, schema, seen);
}

function dedup(origins: Origin[]): Origin[] {
  const byKey = new Map<string, Origin>();
  for (const o of origins) byKey.set(`${o.table.map(normalizeName).join(".")}.${normalizeName(o.column)}`, o);
  return [...byKey.values()];
}

function eq(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}
