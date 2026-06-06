import type {
  CteDef,
  QueryBody,
  QueryExpr,
  SelectExpr,
  SubquerySource,
  TableSource,
} from "../databricks/ir.js";

// ---------------------------------------------------------------------------
// Scope — the symbol table over the IR. One Scope per query block; it records
// the visible sources (tables / CTEs / subqueries), the CTEs in scope, and the
// columns the block outputs. Schema-free: everything here is derivable from the
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
  /** CTEs defined for this query block, keyed by normalized name. */
  ctes: Map<string, CteRef>;
  /** Output column names, or "unknown" when a star/anonymous projection needs a schema. */
  outputs: string[] | "unknown";
  /** For a set-op body, the left/right branch scopes (also in `children`). */
  branches?: { left: Scope; right: Scope };
  parent?: Scope;
  children: Scope[];
}

export interface CteRef {
  def: CteDef;
  scope: Scope;
}

export type ResolvedSource =
  | { kind: "table"; name: string[]; source: TableSource }
  | { kind: "cte"; ref: CteRef; source: TableSource }
  | { kind: "subquery"; scope: Scope; source: SubquerySource };

export function resolveScopes(query: QueryExpr): ScopeTree {
  return { root: buildQueryScope(query) };
}

function newScope(body: QueryBody, parent?: Scope): Scope {
  return { body, sources: new Map(), ctes: new Map(), outputs: "unknown", parent, children: [] };
}

/** Build the scope for a full query (which may declare its own CTEs). */
function buildQueryScope(query: QueryExpr, parent?: Scope): Scope {
  const scope = newScope(query.body, parent);
  // CTEs are visible to the body and to later CTEs; build them in order.
  for (const cte of query.ctes) {
    const cteScope = buildQueryScope(cte.body, scope);
    // Declared column aliases (WITH c (x, y) AS …) rename what the CTE exposes.
    if (cte.columnAliases) cteScope.outputs = cte.columnAliases;
    scope.ctes.set(normalizeName(cte.name), { def: cte, scope: cteScope });
    scope.children.push(cteScope);
  }
  fillScope(scope);
  return scope;
}

/** Build the scope for a bare body — a set-op branch, which has no CTEs of its own. */
function buildBodyScope(body: QueryBody, parent: Scope): Scope {
  const scope = newScope(body, parent);
  fillScope(scope);
  return scope;
}

/** Populate sources / branches and compute outputs for a scope whose `body` is set. */
function fillScope(scope: Scope): void {
  const body = scope.body;

  if (body.kind === "setop") {
    const left = buildBodyScope(body.left, scope);
    const right = buildBodyScope(body.right, scope);
    scope.children.push(left, right);
    scope.branches = { left, right };
    scope.outputs = left.outputs; // set-op output names come from the left branch
    return;
  }

  for (const source of body.from) {
    const key = sourceKey(source);
    if (source.kind === "subquery") {
      const child = buildQueryScope(source.query, scope);
      scope.children.push(child);
      scope.sources.set(key, { kind: "subquery", scope: child, source });
    } else {
      // A single-part name that matches a visible CTE is a CTE reference, not a table.
      const cteRef = source.name.length === 1 ? lookupCte(scope, source.name[0]) : undefined;
      scope.sources.set(
        key,
        cteRef
          ? { kind: "cte", ref: cteRef, source }
          : { kind: "table", name: source.name, source },
      );
    }
  }

  scope.outputs = outputsOf(body);
}

function outputsOf(body: SelectExpr): string[] | "unknown" {
  if (body.projections.length === 0) return "unknown";
  const names: string[] = [];
  for (const p of body.projections) {
    if (p.isStar || p.name === undefined) return "unknown"; // needs a schema to enumerate
    names.push(p.name);
  }
  return names;
}

function lookupCte(scope: Scope | undefined, name: string): CteRef | undefined {
  const key = normalizeName(name);
  for (let s = scope; s; s = s.parent) {
    const hit = s.ctes.get(key);
    if (hit) return hit;
  }
  return undefined;
}

/** A source is referenced by its alias, or (for a table) its last name part. */
function sourceKey(source: TableSource | SubquerySource): string {
  if (source.alias) return source.alias;
  if (source.kind === "table") return source.name[source.name.length - 1] ?? "";
  return "";
}

/** Databricks identifiers are case-insensitive; strip surrounding backticks too. */
function normalizeName(name: string): string {
  const unquoted = name.startsWith("`") && name.endsWith("`") ? name.slice(1, -1) : name;
  return unquoted.toLowerCase();
}
