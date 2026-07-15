import { behaviorOf } from "../dialect-behavior/carrier.js";
import { resolveBehavior } from "../dialect-behavior/registry.js";
import type { ColumnRef, Projection } from "../ir/ir.js";
import type { SchemaProvider } from "../qualify/schema-provider.js";
import { tableSourceColumns } from "../qualify/relation-columns.js";
import {
	aliasVisibleClause,
	applyPivotCols,
	applyStarModifiers,
	applyUnpivotCols,
	matchesProjectionAlias,
	mergeByName,
	pivotSourceOutputs,
	sourceOutputs,
	splitColumnRefInScope,
	sourcesMatchingQualifier,
	type ColumnResolution,
	type ResolvedSource,
	type Scope,
} from "../scope/scope.js";

// The ONE column→source binder. It merges the former pair — scope's schema-free `resolveColumn` and
// this module's schema-aware `resolveColumnSource` — into a single schema-OPTIONAL walk returning
// scope's `ColumnResolution` union. It lives in this HIGH layer (sema imports scope, never the
// reverse) so it can be schema-aware without a circular import. The derived-column recursion (what to
// compute when a column comes from a CTE/subquery) is still left to each caller — inference recurses
// to a type, lineage to a set of origins.

export interface ResolvedColumn {
	source: ResolvedSource;
	column: string;
	/** Struct/map field navigation after the column (`a.b.c` bound to column `a` → ["b","c"]). */
	fields: string[];
}

/**
 * Bind a (possibly qualified) column reference to its source, schema-OPTIONAL.
 * - Qualified (`t.c`, `t.c.field`): the source whose key matches the qualifier, at the nearest
 *   enclosing scope defining it; the part after it is the column, any further parts field navigation.
 * - Unqualified (`c`, `c.field`): the visible source whose columns include the column, walking
 *   enclosing scopes local-first (correlation). >1 source exposing it → `ambiguous`.
 *   With `schema`, a source's columns come from the catalog (`columnNamesOf` — so a bare column binds
 *   through a schema-fed `SELECT *`), and a lone source whose columns are still unknown owns it;
 *   without `schema`, columns come from the schema-free `sourceOutputs` and an unknown source yields
 *   `needs-schema`. GROUP BY / HAVING / ORDER BY / QUALIFY may fall back to a SELECT-list alias
 *   (source columns win over an alias). Never fabricates a binding.
 */
export function resolveColumnRef(scope: Scope, ref: ColumnRef, schema?: SchemaProvider): ColumnResolution {
	return resolveParts(scope, ref.parts, ref.clause, schema);
}

function resolveParts(
	scope: Scope,
	parts: string[],
	clause: ColumnRef["clause"] | undefined,
	schema: SchemaProvider | undefined,
): ColumnResolution {
	// Qualified (issue #38): longest-qualifier-first within each scope, nearest scope first, with
	// the leading parts VALIDATED against the source relation's key (sourcesMatchingQualifier). A
	// four-part `catalog.schema.table.column` consumes a three-part qualifier; `wrong.orders.col`
	// matches nothing and falls through to the unqualified reading (then diagnosed, never bound).
	if (parts.length > 1) {
		const maxQualifier = Math.min(parts.length - 1, behaviorOf(scope).nameConfig.roles.length + 1);
		for (let s: Scope | undefined = scope; s; s = s.parent) {
			for (let qlen = maxQualifier; qlen >= 1; qlen--) {
				const matches = sourcesMatchingQualifier(s, parts.slice(0, qlen));
				if (matches.length === 1) {
					return { kind: "bound", source: matches[0]!, column: parts[qlen]!, fields: parts.slice(qlen + 1) };
				}
				if (matches.length > 1) return { kind: "ambiguous", candidates: matches };
			}
		}
	}

	// Unqualified (or no qualifier matched): the first part is the column, the rest field navigation.
	const split = { column: parts[0] ?? "", fields: parts.slice(1) };

	// Resolve the column name against sources, walking enclosing scopes (correlation).
	for (let s: Scope | undefined = scope; s; s = s.parent) {
		const r = resolveByName(s, split.column, split.fields, schema);
		if (r.kind === "bound" || r.kind === "ambiguous") return r;
		// GROUP BY / HAVING / ORDER BY of this scope may reference a SELECT alias. Source columns
		// take precedence (checked above); fall back to a matching projection alias here.
		if (
			s === scope &&
			parts.length === 1 &&
			aliasVisibleClause(clause) &&
			matchesProjectionAlias(s, split.column)
		) {
			return { kind: "alias", name: split.column };
		}
		if (r.kind === "needs-schema") return r;
		// r is unresolved — try the enclosing scope (correlation).
	}
	return { kind: "unresolved" };
}

/**
 * Resolve an unqualified column name against a single scope's sources. Schema-parameterized:
 * with a schema, a source's columns come from the catalog (`columnNamesOf`); without one, from the
 * schema-free `sourceOutputs`. >1 match → ambiguous. On 0 matches: with a schema a lone source whose
 * columns are unknown owns the column (valid SQL assumed) else `unresolved` so the walk correlates
 * outward; without a schema an unknown source yields `needs-schema`.
 */
function resolveByName(
	scope: Scope,
	column: string,
	fields: string[],
	schema: SchemaProvider | undefined,
): ColumnResolution {
	const name = behaviorOf(scope).fold(column);
	// sourceList, not the map: colliding keys (joined FQN tables sharing a last part) hide a
	// source from the map, and ambiguity detection must see every source (#38).
	const sources = scope.sourceList.map((e) => e.source);
	const colsOf = (src: ResolvedSource): string[] | "unknown" =>
		schema
			? (columnNamesOf(src, schema, undefined, scope.dialect) ?? "unknown")
			: sourceOutputs(src, scope.dialect);
	const matches = sources.filter((s) => {
		const cols = colsOf(s);
		return cols !== "unknown" && cols.some((c) => behaviorOf(scope).fold(c) === name);
	});
	if (matches.length === 1) return { kind: "bound", source: matches[0], column, fields };
	if (matches.length > 1) return { kind: "ambiguous", candidates: matches };
	// No known source has it. A source with unknown columns might.
	const unknown = sources.filter((s) => colsOf(s) === "unknown");
	if (schema) {
		// A lone source with unknown columns owns it; otherwise not found here — correlate outward.
		if (unknown.length === 1) return { kind: "bound", source: unknown[0], column, fields };
		return { kind: "unresolved" };
	}
	return unknown.length > 0 ? { kind: "needs-schema" } : { kind: "unresolved" };
}

/** Bind a (possibly qualified) column reference to its source — the `bound` case of the unified binder,
 *  normalized to the (source, column, fields) shape. Schema-aware. Ambiguous / alias / unresolved /
 *  needs-schema all yield `undefined` (never a fabricated binding — ambiguous no longer first-matches).
 *  Thin adapter over `resolveColumnRef`; kept for infer / lineage / nullability / references / qualify's
 *  `bindingOf`, which take `parts` and only ever want the concrete binding. */
export function resolveColumnSource(scope: Scope, parts: string[], schema: SchemaProvider): ResolvedColumn | undefined {
	const r = resolveParts(scope, parts, undefined, schema);
	return r.kind === "bound" ? { source: r.source, column: r.column, fields: r.fields } : undefined;
}

/**
 * The projection producing `column` in a derived relation's projection list — the ONE shared
 * "which projection is this column?" step used by BOTH lineage walks (the flat `derivedOrigins`
 * origin walk and the per-hop `hops.ts` spine), so they can never drift on producer selection.
 * With declared column aliases (`WITH c (x, y) AS …`), the alias position picks the projection
 * (even a `*`, matching the origin walk's `projs[i]` read); otherwise a non-star projection whose
 * name folds equal. Returns undefined when no projection produces the column (a bare `*`/source).
 */
export function findProducerProjection(
	projections: Projection[],
	column: string,
	aliases: string[] | undefined,
	dialect: string,
): Projection | undefined {
	const b = resolveBehavior(dialect);
	const want = b.fold(column);
	if (aliases) {
		const i = aliases.findIndex((a) => b.fold(a) === want);
		return i >= 0 ? projections[i] : undefined;
	}
	return projections.find((p) => !p.isStar && p.name !== undefined && b.fold(p.name) === want);
}

/** The output column names a source exposes — schema for a table, the (schema-expanded) output
 *  names for a derived relation (column aliases rename them), the AS columns for a lateral view.
 *  `dialect` folds a table's name parts for the catalog lookup (quoted names reach the schema in
 *  raw form); when absent, the default fold (backtick-strip + lower) reproduces legacy behavior. */
export function columnNamesOf(
	src: ResolvedSource,
	schema: SchemaProvider,
	visited: Set<Scope> = new Set(),
	dialect?: string,
): string[] | undefined {
	if (src.kind === "table") {
		// Template-aware (inc3.2): catalog columns first, then the logical-name lookup.
		return (
			src.source.columnAliases ??
			tableSourceColumns(src.name, src.source.template, schema, dialect)?.map((c) => c.name)
		);
	}
	if (src.kind === "cte") return src.ref.def.columnAliases ?? outputNames(src.ref.scope, schema, visited);
	if (src.kind === "subquery") return src.source.columnAliases ?? outputNames(src.scope, schema, visited);
	if (src.kind === "relation") return outputNames(src.scope, schema, visited); // a prior pipe stage
	if (src.kind === "graphtable") return outputNames(src.scope, schema, visited);
	if (src.kind === "pivot") {
		const r = pivotSourceOutputs(src, (s) => columnNamesOf(s, schema, visited, dialect) ?? "unknown", dialect);
		return r === "unknown" ? undefined : r;
	}
	return src.source.columns; // lateral
}

/** A scope's output column names, expanding `*`/`t.*` against the schema (so a `SELECT *` CTE
 *  reports the underlying columns). Returns undefined when a star can't be enumerated or a
 *  projection is anonymous. Cycle-guarded for recursive CTEs.
 *
 *  `visited` tracks the scopes on the CURRENT resolution PATH (a stack), NOT every scope ever
 *  seen: a scope is added on entry and REMOVED on exit. This still guards a genuine cycle (a
 *  recursive CTE whose scope is on the active path returns undefined), but it must NOT reject a
 *  legitimate re-visit off the path — the same CTE reached by two sibling sources in one `SELECT *`
 *  (a staging CTE reused across a join). Marking `visited` permanently (never deleting) turned that
 *  into a false cycle: the second sibling saw the scope "visited" and returned undefined, poisoning
 *  the whole star expansion to undefined and unbinding bare columns downstream. */
export function outputNames(
	scope: Scope,
	schema: SchemaProvider,
	visited: Set<Scope> = new Set(),
): string[] | undefined {
	if (visited.has(scope)) return undefined;
	visited.add(scope);
	try {
		return computeOutputNames(scope, schema, visited);
	} finally {
		visited.delete(scope);
	}
}

function computeOutputNames(scope: Scope, schema: SchemaProvider, visited: Set<Scope>): string[] | undefined {
	if (scope.pipeStage) return pipeStageNames(scope, schema, visited);
	const body = scope.body;
	if (body.kind === "pipe") {
		const last = scope.pipe?.stages.at(-1) ?? scope.pipe?.input;
		return last ? outputNames(last, schema, visited) : undefined;
	}
	if (body.kind === "setop") {
		if (!scope.branches) return undefined;
		const left = outputNames(scope.branches.left, schema, visited);
		if (!body.byName) return left;
		const merged = mergeByName(
			left ?? "unknown",
			outputNames(scope.branches.right, schema, visited) ?? "unknown",
			scope.dialect,
		);
		return merged === "unknown" ? undefined : merged;
	}
	// A PIVOT/UNPIVOT with no result alias reshapes the FROM relation — expand the sources, transform.
	if (body.pivot && !body.pivot.alias) {
		const base = sourceColumnsAll(scope, schema, visited);
		if (!base) return undefined;
		const out = applyPivotCols(base, body.pivot, scope.dialect);
		return out === "unknown" ? undefined : out; // dynamic pivot → unknown, resolved as undefined here
	}
	if (body.unpivot && !body.unpivot.alias) {
		const base = sourceColumnsAll(scope, schema, visited);
		return base ? applyUnpivotCols(base, body.unpivot, scope.dialect) : undefined;
	}
	return projectionNames(scope, body.projections, schema, visited);
}

/** All source columns of a scope (the base relation) — used to apply a PIVOT/UNPIVOT transform. */
function sourceColumnsAll(scope: Scope, schema: SchemaProvider, visited: Set<Scope>): string[] | undefined {
	const out: string[] = [];
	for (const src of scope.sources.values()) {
		const cols = columnNamesOf(src, schema, visited, scope.dialect);
		if (!cols) return undefined;
		out.push(...cols);
	}
	return out;
}

/** Output names of a projection list against a scope's sources (`*`/`t.*` expanded, modifiers applied). */
function projectionNames(
	scope: Scope,
	projections: import("../ir/ir.js").Projection[],
	schema: SchemaProvider,
	visited: Set<Scope>,
): string[] | undefined {
	const out: string[] = [];
	for (const p of projections) {
		if (p.isStar) {
			const star = p.expr.kind === "star" ? p.expr : undefined;
			const want = star?.qualifier ? (star.qualifier[star.qualifier.length - 1] ?? "") : undefined;
			const expanded: string[] = [];
			for (const [key, src] of scope.sources) {
				if (want !== undefined && !behaviorOf(scope).matchesSourceKey(key, want)) continue;
				const cols = columnNamesOf(src, schema, visited, scope.dialect);
				if (!cols) return undefined;
				expanded.push(...cols);
			}
			out.push(...(star ? applyStarModifiers(expanded, star, scope.dialect) : expanded));
		} else if (p.name !== undefined) {
			out.push(p.name);
		} else {
			return undefined; // anonymous expression — not nameable
		}
	}
	return out;
}

/** Output column names of a pipe stage, given the schema-expanded incoming columns. */
function pipeStageNames(scope: Scope, schema: SchemaProvider, visited: Set<Scope>): string[] | undefined {
	const stage = scope.pipeStage!;
	const incoming = scope.pipeIncoming ? outputNames(scope.pipeIncoming, schema, visited) : undefined;
	switch (stage.op) {
		case "select":
			return projectionNames(scope, stage.projections, schema, visited);
		case "extend":
		case "window": {
			if (!incoming) return undefined;
			const added = projectionNames(scope, stage.projections, schema, visited);
			return added ? [...incoming, ...added] : undefined;
		}
		case "aggregate": {
			const aggs = projectionNames(scope, stage.aggregates, schema, visited);
			if (!aggs) return undefined;
			const keys: string[] = [];
			for (const g of stage.groupBy) {
				if (g.kind === "column") keys.push(g.parts[g.parts.length - 1]);
				else return undefined;
			}
			return [...aggs, ...keys];
		}
		case "drop": {
			const fold = (n: string) => behaviorOf(scope).fold(n);
			return incoming ? incoming.filter((c) => !stage.drop.some((d) => fold(d) === fold(c))) : undefined;
		}
		case "rename": {
			if (!incoming) return undefined;
			const fold = (n: string) => behaviorOf(scope).fold(n);
			const m = new Map(stage.renames.map((r) => [fold(r.from), r.to]));
			return incoming.map((c) => m.get(fold(c)) ?? c);
		}
		case "join": {
			if (!incoming) return undefined;
			const joinSrc = [...scope.sources.entries()].find(([k]) => k !== "")?.[1];
			const jc = joinSrc ? columnNamesOf(joinSrc, schema, visited, scope.dialect) : undefined;
			return jc ? [...incoming, ...jc] : undefined;
		}
		case "where":
		case "orderBy":
		case "limit":
		case "distinct":
		case "tablesample":
		case "assert":
		case "log":
		case "staticDescribe":
		case "with":
		case "set":
		case "setop":
		case "recursiveUnion":
			return incoming;
		default:
			return undefined; // call / pivot / unpivot / matchRecognize / describe / branching / sinks
	}
}
