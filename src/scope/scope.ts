import type { QueryBody, QueryExpr, Source, SubquerySource, TableSource } from "../databricks/ir.js";

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
  /** The query body this scope describes (a SELECT, or a set operation). */
  body: QueryBody;
  /** Visible relations, keyed by alias (or the table's last name part). */
  sources: Map<string, ResolvedSource>;
  parent?: Scope;
  children: Scope[];
}

export type ResolvedSource =
  | { kind: "table"; name: string[]; source: TableSource }
  | { kind: "subquery"; scope: Scope; source: SubquerySource };

export function resolveScopes(query: QueryExpr): ScopeTree {
  return { root: buildScope(query.body) };
}

function buildScope(body: QueryBody, parent?: Scope): Scope {
  const scope: Scope = { body, sources: new Map(), parent, children: [] };

  // A set operation has no direct sources; each branch is its own sub-scope.
  if (body.kind === "setop") {
    scope.children.push(buildScope(body.left, scope), buildScope(body.right, scope));
    return scope;
  }

  for (const source of body.from) {
    const key = sourceKey(source);
    if (source.kind === "table") {
      scope.sources.set(key, { kind: "table", name: source.name, source });
    } else {
      const child = buildScope(source.query.body, scope);
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
