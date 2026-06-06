import type {
  ColumnRef,
  CteDef,
  LateralViewSource,
  PivotInfo,
  QueryBody,
  QueryExpr,
  SelectExpr,
  Source,
  SubquerySource,
  TableSource,
  UnpivotInfo,
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
  | { kind: "subquery"; scope: Scope; source: SubquerySource }
  | { kind: "lateral"; source: LateralViewSource };

export function resolveScopes(query: QueryExpr): ScopeTree {
  return { root: buildQueryScope(query) };
}

export type ColumnResolution =
  | { kind: "bound"; source: ResolvedSource }
  | { kind: "ambiguous"; candidates: ResolvedSource[] }
  | { kind: "unresolved" } // qualifier names no visible source
  | { kind: "needs-schema" }; // can't tell without a source's column list

/**
 * Bind a column reference to the source it comes from, schema-free.
 * - Qualified (`t.c`): the source whose key matches the qualifier, else unresolved.
 * - Unqualified (`c`): the single source whose known columns include it; ambiguous if
 *   several do; needs-schema if a source's columns aren't known without a catalog.
 */
export function resolveColumn(scope: Scope, ref: ColumnRef): ColumnResolution {
  // Walk this scope then enclosing scopes — a correlated reference binds to an outer source.
  for (let s: Scope | undefined = scope; s; s = s.parent) {
    const r = resolveColumnInScope(s, ref);
    if (r.kind !== "unresolved") return r;
  }
  return { kind: "unresolved" };
}

function resolveColumnInScope(scope: Scope, ref: ColumnRef): ColumnResolution {
  if (ref.parts.length >= 2) {
    const qualifier = normalizeName(ref.parts[ref.parts.length - 2]);
    const source = scope.sources.get(qualifier);
    return source ? { kind: "bound", source } : { kind: "unresolved" };
  }

  const name = normalizeName(ref.parts[0] ?? "");
  const sources = [...scope.sources.values()];
  const matches = sources.filter((s) => {
    const cols = sourceOutputs(s);
    return cols !== "unknown" && cols.some((c) => normalizeName(c) === name);
  });
  if (matches.length === 1) return { kind: "bound", source: matches[0] };
  if (matches.length > 1) return { kind: "ambiguous", candidates: matches };
  // No known source has it — but a source with unknown columns might (here or in a parent).
  return sources.some((s) => sourceOutputs(s) === "unknown")
    ? { kind: "needs-schema" }
    : { kind: "unresolved" };
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
    } else if (source.kind === "lateral") {
      scope.sources.set(key, { kind: "lateral", source });
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

  // Scalar / IN / EXISTS subqueries in expressions become child scopes (parent set for correlation).
  for (const sub of body.subqueries ?? []) {
    scope.children.push(buildQueryScope(sub, scope));
  }

  scope.outputs = computeOutputs(scope, body);
}

/** A select's output columns, accounting for a PIVOT/UNPIVOT transforming the FROM relation. */
function computeOutputs(scope: Scope, body: SelectExpr): string[] | "unknown" {
  if (body.unpivot) return unpivotOutputs(scope, body.unpivot);
  if (body.pivot) return pivotOutputs(scope, body.pivot);
  return outputsOf(body);
}

/** The columns of the relation being pivoted/unpivoted — the first non-lateral source. */
function baseRelationColumns(scope: Scope): string[] | "unknown" {
  for (const src of scope.sources.values()) {
    if (src.kind !== "lateral") return sourceOutputs(src);
  }
  return "unknown";
}

function unpivotOutputs(scope: Scope, u: UnpivotInfo): string[] | "unknown" {
  const base = baseRelationColumns(scope);
  if (base === "unknown") return "unknown"; // pass-through needs the input's columns
  const removed = new Set(u.removed.map(normalizeName));
  const passthrough = base.filter((c) => !removed.has(normalizeName(c)));
  return [...passthrough, u.nameColumn, u.valueColumn];
}

function pivotOutputs(scope: Scope, p: PivotInfo): string[] | "unknown" {
  const base = baseRelationColumns(scope);
  if (base === "unknown") return "unknown";
  const consumed = new Set([...p.forColumns, ...p.aggColumns].map(normalizeName));
  const passthrough = base.filter((c) => !consumed.has(normalizeName(c)));
  return [...passthrough, ...p.values];
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

/** A source is referenced by its alias, or (for a table) its last name part — normalized,
 *  since Databricks identifiers are case-insensitive (so `U.col` binds to a source aliased `u`). */
function sourceKey(source: Source): string {
  if (source.kind === "lateral") return normalizeName(source.alias ?? "");
  const raw = source.alias ?? (source.kind === "table" ? source.name[source.name.length - 1] : "");
  return normalizeName(raw ?? "");
}

/** The columns a resolved source exposes, or "unknown" when it needs a schema (a bare table). */
function sourceOutputs(src: ResolvedSource): string[] | "unknown" {
  if (src.kind === "table") return src.source.columnAliases ?? "unknown";
  if (src.kind === "cte") return src.ref.scope.outputs;
  if (src.kind === "lateral") return src.source.columns;
  return src.scope.outputs; // subquery
}

/** Databricks identifiers are case-insensitive; strip surrounding backticks too. */
function normalizeName(name: string): string {
  const unquoted = name.startsWith("`") && name.endsWith("`") ? name.slice(1, -1) : name;
  return unquoted.toLowerCase();
}
