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
} from "../ir/ir.js";

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
	/** The dialect this query was lowered from ("databricks" | "tsql"). Drives dialect-specific
	 *  type inference (function/literal/type knowledge); the rest of the layer ignores it. */
	dialect: string;
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

export function resolveScopes(query: QueryExpr, dialect: string = "databricks"): ScopeTree {
	return { root: buildQueryScope(query, undefined, dialect) };
}

export type ColumnResolution =
	| { kind: "bound"; source: ResolvedSource; column: string; fields: string[] }
	| { kind: "alias"; name: string } // resolves to a SELECT-list alias (in GROUP BY/HAVING/ORDER BY)
	| { kind: "ambiguous"; candidates: ResolvedSource[] }
	| { kind: "unresolved" } // names neither a visible source nor a known column
	| { kind: "needs-schema" }; // can't tell without a source's column list

/** A column reference split into its table qualifier, the column, and struct/field navigation. */
export interface SplitRef {
	/** The matched source key, when a leading part names a visible source (else unqualified). */
	qualifier?: string;
	/** The column name. */
	column: string;
	/** Struct/map field navigation after the column: `a.b.c` bound to column `a` → ["b","c"]. */
	fields: string[];
}

/**
 * Split a (possibly dotted) reference into qualifier / column / field path. A leading part is a
 * table qualifier only if it names a visible source — otherwise the first part is the column and
 * the rest is field access (`a.b.c` where `a` is a column → fields b, c). This mirrors Spark's
 * resolution order (try table-qualified first, then nested field access on a column), so struct
 * access is no longer mistaken for `table.column`. `isSource` reports whether a key is visible.
 */
export function splitColumnRef(parts: string[], isSource: (key: string) => boolean): SplitRef {
	// `schema.table.col[.field…]` — the 2-token qualifier is keyed by the table (its last part).
	if (parts.length >= 3 && isSource(normalizeName(parts[1]))) {
		return { qualifier: normalizeName(parts[1]), column: parts[2], fields: parts.slice(3) };
	}
	// `alias.col[.field…]` — single-token qualifier.
	if (parts.length >= 2 && isSource(normalizeName(parts[0]))) {
		return { qualifier: normalizeName(parts[0]), column: parts[1], fields: parts.slice(2) };
	}
	// Unqualified: the first part is the column; anything after it is struct/field navigation.
	return { column: parts[0] ?? "", fields: parts.slice(1) };
}

/** Split a reference against the sources visible from `scope` (including enclosing scopes). */
export function splitColumnRefInScope(scope: Scope, parts: string[]): SplitRef {
	return splitColumnRef(parts, (key) => hasVisibleSource(scope, key));
}

/** True if `key` names a source in this scope or any enclosing one (for correlation). */
function hasVisibleSource(scope: Scope, key: string): boolean {
	for (let s: Scope | undefined = scope; s; s = s.parent) if (s.sources.has(key)) return true;
	return false;
}

/**
 * Bind a column reference to the source it comes from, schema-free.
 * - Qualified (`t.c`, `t.c.field`): the source whose key matches the qualifier; the part after
 *   it is the column and any further parts are struct/field navigation.
 * - Unqualified (`c`, `c.field`): the single source whose known columns include the column;
 *   ambiguous if several do; needs-schema if a source's columns aren't known without a catalog.
 */
export function resolveColumn(scope: Scope, ref: ColumnRef): ColumnResolution {
	const split = splitColumnRefInScope(scope, ref.parts);

	// Qualified: bind to the nearest enclosing scope that defines the qualifier source.
	if (split.qualifier !== undefined) {
		for (let s: Scope | undefined = scope; s; s = s.parent) {
			const source = s.sources.get(split.qualifier);
			if (source) return { kind: "bound", source, column: split.column, fields: split.fields };
		}
		return { kind: "unresolved" }; // qualifier was visible a moment ago — defensive only
	}

	// Unqualified: resolve the column name against sources, walking enclosing scopes (correlation).
	for (let s: Scope | undefined = scope; s; s = s.parent) {
		const r = resolveByColumnName(s, split.column, split.fields);
		if (r.kind === "bound" || r.kind === "ambiguous") return r;
		// GROUP BY / HAVING / ORDER BY of this scope may reference a SELECT alias. Source columns
		// take precedence (checked above); fall back to a matching projection alias here.
		if (
			s === scope &&
			ref.parts.length === 1 &&
			aliasVisibleClause(ref.clause) &&
			matchesProjectionAlias(s, split.column)
		) {
			return { kind: "alias", name: split.column };
		}
		if (r.kind === "needs-schema") return r;
		// r is unresolved — try the enclosing scope (correlation).
	}
	return { kind: "unresolved" };
}

/** Clauses where a bare name may reference a SELECT-list alias rather than a source column. */
function aliasVisibleClause(clause: ColumnRef["clause"]): boolean {
	return clause === "groupBy" || clause === "having" || clause === "qualify" || clause === "orderBy";
}

function matchesProjectionAlias(scope: Scope, name: string): boolean {
	const n = normalizeName(name);
	return aliasNames(scope).some((a) => normalizeName(a) === n);
}

/** The output alias names of a scope — a select's projection names, or (for a set op) the
 *  left branch's, since a union's output columns come from its first branch. */
function aliasNames(scope: Scope): string[] {
	if (scope.body.kind === "select") {
		return scope.body.projections.flatMap((p) => (p.name !== undefined ? [p.name] : []));
	}
	return scope.branches ? aliasNames(scope.branches.left) : [];
}

/** Resolve an unqualified column name against a single scope's sources (no qualifier given). */
function resolveByColumnName(scope: Scope, column: string, fields: string[]): ColumnResolution {
	const name = normalizeName(column);
	const sources = [...scope.sources.values()];
	const matches = sources.filter((s) => {
		const cols = sourceOutputs(s);
		return cols !== "unknown" && cols.some((c) => normalizeName(c) === name);
	});
	if (matches.length === 1) return { kind: "bound", source: matches[0], column, fields };
	if (matches.length > 1) return { kind: "ambiguous", candidates: matches };
	// No known source has it — but a source with unknown columns might (here or in a parent).
	return sources.some((s) => sourceOutputs(s) === "unknown") ? { kind: "needs-schema" } : { kind: "unresolved" };
}

function newScope(body: QueryBody, parent?: Scope, dialect?: string): Scope {
	return {
		body,
		sources: new Map(),
		ctes: new Map(),
		outputs: "unknown",
		parent,
		children: [],
		dialect: dialect ?? parent?.dialect ?? "databricks",
	};
}

/** Build the scope for a full query (which may declare its own CTEs). */
function buildQueryScope(query: QueryExpr, parent?: Scope, dialect?: string): Scope {
	const scope = newScope(query.body, parent, dialect);
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
		// Positional set ops take the left branch's names; BY NAME aligns by name —
		// the output is the left branch's columns plus the right's not present on the left.
		scope.outputs = body.byName ? mergeByName(left.outputs, right.outputs) : left.outputs;
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
				cteRef ? { kind: "cte", ref: cteRef, source } : { kind: "table", name: source.name, source },
			);
		}
	}

	// Scalar / IN / EXISTS subqueries in expressions become child scopes (parent set for correlation).
	for (const sub of body.subqueries ?? []) {
		scope.children.push(buildQueryScope(sub, scope));
	}

	scope.outputs = computeOutputs(scope, body);
	registerPivotAliasSource(scope, body);
}

/** A select's output columns, accounting for a PIVOT/UNPIVOT transforming the FROM relation. */
function computeOutputs(scope: Scope, body: SelectExpr): string[] | "unknown" {
	// T-SQL exposes the pivoted/unpivoted relation under an alias (registered as a source below);
	// the SELECT's own output is then its projections. Spark's pivot transforms the SELECT directly.
	if (body.unpivot && !body.unpivot.alias) return unpivotOutputs(scope, body.unpivot);
	if (body.pivot && !body.pivot.alias) return pivotOutputs(scope, body.pivot);
	return outputsOf(body);
}

/** T-SQL: a `… PIVOT/UNPIVOT (…) AS x` is a named relation. Expose it under `x` as a synthetic
 *  source whose columns are the passthrough + produced columns, so later `x.col` refs resolve. */
function registerPivotAliasSource(scope: Scope, body: SelectExpr): void {
	const alias = body.pivot?.alias ?? body.unpivot?.alias;
	if (!alias) return;
	const cols = body.unpivot ? unpivotOutputs(scope, body.unpivot) : pivotOutputs(scope, body.pivot!);
	if (cols === "unknown") return;
	const source: TableSource = { kind: "table", name: [alias], alias, columnAliases: cols, cst: body.cst };
	scope.sources.set(normalizeName(alias), { kind: "table", name: [alias], source });
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

/** `UNION BY NAME` output: left columns in order, then right-only columns appended. */
export function mergeByName(left: string[] | "unknown", right: string[] | "unknown"): string[] | "unknown" {
	if (left === "unknown" || right === "unknown") return "unknown";
	const seen = new Set(left.map(normalizeName));
	return [...left, ...right.filter((c) => !seen.has(normalizeName(c)))];
}

/** Apply a star node's modifiers to an expansion: EXCLUDE/EXCEPT removes, ILIKE filters by
 *  pattern, RENAME renames (REPLACE keeps name and position — no expansion change). */
export function applyStarModifiers(
	cols: string[],
	star: { exclude?: string[]; ilike?: string; rename?: { from: string; to: string }[] },
): string[] {
	let out = cols;
	if (star.exclude) {
		const removed = new Set(star.exclude.map(normalizeName));
		out = out.filter((c) => !removed.has(normalizeName(c)));
	}
	if (star.ilike !== undefined) {
		const rx = likePatternToRegExp(star.ilike);
		out = out.filter((c) => rx.test(normalizeName(c)));
	}
	if (star.rename) {
		const renames = new Map(star.rename.map((r) => [normalizeName(r.from), r.to]));
		out = out.map((c) => renames.get(normalizeName(c)) ?? c);
	}
	return out;
}

/** SQL LIKE pattern → an anchored case-insensitive RegExp (`%` → `.*`, `_` → `.`). */
export function likePatternToRegExp(pattern: string): RegExp {
	const escaped = pattern
		.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
		.replace(/%/g, ".*")
		.replace(/_/g, ".");
	return new RegExp(`^${escaped}$`, "i");
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
