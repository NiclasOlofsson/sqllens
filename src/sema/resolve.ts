import type { Schema } from "../qualify/schema.js";
import { splitColumnRefInScope, type ResolvedSource, type Scope } from "../scope/scope.js";

// Schema-aware column resolution, shared by the post-qualify analyses (type inference and
// lineage). Unlike scope's schema-free `resolveColumn`, this binds a bare column over a physical
// table by consulting the schema for the source's columns. The derived-column recursion (what to
// compute when a column comes from a CTE/subquery) is left to each caller — inference recurses to
// a type, lineage to a set of origins.

export interface ResolvedColumn {
  source: ResolvedSource;
  column: string;
  /** Struct/map field navigation after the column (`a.b.c` bound to column `a` → ["b","c"]). */
  fields: string[];
}

/** Bind a (possibly qualified) column reference to its source. Walks enclosing scopes (correlation). */
export function resolveColumnSource(scope: Scope, parts: string[], schema: Schema): ResolvedColumn | undefined {
  const split = splitColumnRefInScope(scope, parts);
  if (split.qualifier !== undefined) {
    for (let s: Scope | undefined = scope; s; s = s.parent) {
      const src = s.sources.get(split.qualifier);
      if (src) return { source: src, column: split.column, fields: split.fields };
    }
    return undefined;
  }
  const name = normalizeName(split.column);
  // Resolve LOCALLY first, then correlate to enclosing scopes — so a column binds to a local
  // source (even one with unknown columns) before it can match an enclosing one by name.
  for (let s: Scope | undefined = scope; s; s = s.parent) {
    const sources = [...s.sources.values()];
    for (const src of sources) {
      const cols = columnNamesOf(src, schema);
      if (cols?.some((c) => normalizeName(c) === name)) {
        return { source: src, column: split.column, fields: split.fields };
      }
    }
    // Schema-free fallback: a single source here with unknown columns owns the column (valid SQL
    // assumed). If this scope has sources but can't resolve it, fall through to correlate outward.
    const unknown = sources.filter((src) => columnNamesOf(src, schema) === undefined);
    if (unknown.length === 1) return { source: unknown[0], column: split.column, fields: split.fields };
  }
  return undefined;
}

/** The output column names a source exposes — schema for a table, the (schema-expanded) output
 *  names for a derived relation (column aliases rename them), the AS columns for a lateral view. */
export function columnNamesOf(
  src: ResolvedSource,
  schema: Schema,
  visited: Set<Scope> = new Set(),
): string[] | undefined {
  if (src.kind === "table") return src.source.columnAliases ?? schema.columnsFor(src.name)?.map((c) => c.name);
  if (src.kind === "cte") return src.ref.def.columnAliases ?? outputNames(src.ref.scope, schema, visited);
  if (src.kind === "subquery") return src.source.columnAliases ?? outputNames(src.scope, schema, visited);
  return src.source.columns; // lateral
}

/** A scope's output column names, expanding `*`/`t.*` against the schema (so a `SELECT *` CTE
 *  reports the underlying columns). Returns undefined when a star can't be enumerated or a
 *  projection is anonymous. Cycle-guarded for recursive CTEs. */
export function outputNames(scope: Scope, schema: Schema, visited: Set<Scope> = new Set()): string[] | undefined {
  if (visited.has(scope)) return undefined;
  visited.add(scope);
  const body = scope.body;
  if (body.kind === "setop") {
    return scope.branches ? outputNames(scope.branches.left, schema, visited) : undefined;
  }
  const out: string[] = [];
  for (const p of body.projections) {
    if (p.isStar) {
      const qualifier = p.expr.kind === "star" ? p.expr.qualifier : undefined;
      const want = qualifier ? normalizeName(qualifier[qualifier.length - 1] ?? "") : undefined;
      for (const [key, src] of scope.sources) {
        if (want !== undefined && key !== want) continue;
        const cols = columnNamesOf(src, schema, visited);
        if (!cols) return undefined;
        out.push(...cols);
      }
    } else if (p.name !== undefined) {
      out.push(p.name);
    } else {
      return undefined; // anonymous expression — not nameable
    }
  }
  return out;
}

/** Databricks identifiers are case-insensitive; strip surrounding backticks too. */
export function normalizeName(s: string): string {
  return (s.startsWith("`") && s.endsWith("`") ? s.slice(1, -1) : s).toLowerCase();
}
