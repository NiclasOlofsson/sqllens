import type { QueryExpr, Source, SubquerySource, TableSource } from "../databricks/ir.js";

// ---------------------------------------------------------------------------
// Scope — the symbol table over the IR. One Scope per query block; it records
// which sources (tables / CTEs / subqueries) are visible and, later, binds
// column references to them. Schema-free: everything here is derivable from the
// query structure alone. (Schema-dependent resolution lives in qualify.)
// ---------------------------------------------------------------------------

export interface ScopeTree {
  root: Scope;
}

export interface Scope {
  query: QueryExpr;
  /** Visible relations, keyed by alias (or the table's last name part). */
  sources: Map<string, ResolvedSource>;
  parent?: Scope;
  children: Scope[];
}

export type ResolvedSource =
  | { kind: "table"; name: string[]; source: TableSource }
  | { kind: "subquery"; scope: Scope; source: SubquerySource };

export function resolveScopes(query: QueryExpr): ScopeTree {
  return { root: buildScope(query) };
}

function buildScope(query: QueryExpr, parent?: Scope): Scope {
  const scope: Scope = { query, sources: new Map(), parent, children: [] };

  for (const source of query.body.from) {
    const key = sourceKey(source);
    if (source.kind === "table") {
      scope.sources.set(key, { kind: "table", name: source.name, source });
    } else {
      const child = buildScope(source.query, scope);
      scope.children.push(child);
      scope.sources.set(key, { kind: "subquery", scope: child, source });
    }
  }

  return scope;
}

/** A source is referenced by its alias, or (for a table) its last name part. */
function sourceKey(source: Source): string {
  if (source.alias) return source.alias;
  if (source.kind === "table") return source.name[source.name.length - 1] ?? "";
  return "";
}
