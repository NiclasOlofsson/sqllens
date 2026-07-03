import { foldIdentifier, matchesSourceKey } from "../ident/fold.js";
import type { Projection } from "../ir/ir.js";
import type { SchemaSource } from "../qualify/schema-source.js";
import {
	applyPivotCols,
	applyStarModifiers,
	applyUnpivotCols,
	mergeByName,
	pivotSourceOutputs,
	splitColumnRefInScope,
	type ResolvedSource,
	type Scope,
} from "../scope/scope.js";

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
export function resolveColumnSource(scope: Scope, parts: string[], schema: SchemaSource): ResolvedColumn | undefined {
	const split = splitColumnRefInScope(scope, parts);
	if (split.qualifier !== undefined) {
		for (let s: Scope | undefined = scope; s; s = s.parent) {
			const src = s.sources.get(split.qualifier);
			if (src) return { source: src, column: split.column, fields: split.fields };
		}
		return undefined;
	}
	const name = foldIdentifier(split.column, scope.dialect);
	// Resolve LOCALLY first, then correlate to enclosing scopes — so a column binds to a local
	// source (even one with unknown columns) before it can match an enclosing one by name.
	for (let s: Scope | undefined = scope; s; s = s.parent) {
		const sources = [...s.sources.values()];
		for (const src of sources) {
			const cols = columnNamesOf(src, schema, undefined, s.dialect);
			if (cols?.some((c) => foldIdentifier(c, s.dialect) === name)) {
				return { source: src, column: split.column, fields: split.fields };
			}
		}
		// Schema-free fallback: a single source here with unknown columns owns the column (valid SQL
		// assumed). If this scope has sources but can't resolve it, fall through to correlate outward.
		const unknown = sources.filter((src) => columnNamesOf(src, schema, undefined, s.dialect) === undefined);
		if (unknown.length === 1) return { source: unknown[0], column: split.column, fields: split.fields };
	}
	return undefined;
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
	const want = foldIdentifier(column, dialect);
	if (aliases) {
		const i = aliases.findIndex((a) => foldIdentifier(a, dialect) === want);
		return i >= 0 ? projections[i] : undefined;
	}
	return projections.find((p) => !p.isStar && p.name !== undefined && foldIdentifier(p.name, dialect) === want);
}

/** The output column names a source exposes — schema for a table, the (schema-expanded) output
 *  names for a derived relation (column aliases rename them), the AS columns for a lateral view.
 *  `dialect` folds a table's name parts for the catalog lookup (quoted names reach the schema in
 *  raw form); when absent, the default fold (backtick-strip + lower) reproduces legacy behavior. */
export function columnNamesOf(
	src: ResolvedSource,
	schema: SchemaSource,
	visited: Set<Scope> = new Set(),
	dialect?: string,
): string[] | undefined {
	if (src.kind === "table") {
		return src.source.columnAliases ?? schema.columnsFor(src.name, dialect)?.map((c) => c.name);
	}
	if (src.kind === "cte") return src.ref.def.columnAliases ?? outputNames(src.ref.scope, schema, visited);
	if (src.kind === "subquery") return src.source.columnAliases ?? outputNames(src.scope, schema, visited);
	if (src.kind === "relation") return outputNames(src.scope, schema, visited); // a prior pipe stage
	if (src.kind === "graphtable") return outputNames(src.scope, schema, visited);
	if (src.kind === "pivot") {
		const r = pivotSourceOutputs(src, (s) => columnNamesOf(s, schema, visited, dialect) ?? "unknown");
		return r === "unknown" ? undefined : r;
	}
	return src.source.columns; // lateral
}

/** A scope's output column names, expanding `*`/`t.*` against the schema (so a `SELECT *` CTE
 *  reports the underlying columns). Returns undefined when a star can't be enumerated or a
 *  projection is anonymous. Cycle-guarded for recursive CTEs. */
export function outputNames(scope: Scope, schema: SchemaSource, visited: Set<Scope> = new Set()): string[] | undefined {
	if (visited.has(scope)) return undefined;
	visited.add(scope);
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
		return base ? applyPivotCols(base, body.pivot, scope.dialect) : undefined;
	}
	if (body.unpivot && !body.unpivot.alias) {
		const base = sourceColumnsAll(scope, schema, visited);
		return base ? applyUnpivotCols(base, body.unpivot, scope.dialect) : undefined;
	}
	return projectionNames(scope, body.projections, schema, visited);
}

/** All source columns of a scope (the base relation) — used to apply a PIVOT/UNPIVOT transform. */
function sourceColumnsAll(scope: Scope, schema: SchemaSource, visited: Set<Scope>): string[] | undefined {
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
	schema: SchemaSource,
	visited: Set<Scope>,
): string[] | undefined {
	const out: string[] = [];
	for (const p of projections) {
		if (p.isStar) {
			const star = p.expr.kind === "star" ? p.expr : undefined;
			const want = star?.qualifier ? (star.qualifier[star.qualifier.length - 1] ?? "") : undefined;
			const expanded: string[] = [];
			for (const [key, src] of scope.sources) {
				if (want !== undefined && !matchesSourceKey(key, want, scope.dialect)) continue;
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
function pipeStageNames(scope: Scope, schema: SchemaSource, visited: Set<Scope>): string[] | undefined {
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
			const fold = (n: string) => foldIdentifier(n, scope.dialect);
			return incoming ? incoming.filter((c) => !stage.drop.some((d) => fold(d) === fold(c))) : undefined;
		}
		case "rename": {
			if (!incoming) return undefined;
			const fold = (n: string) => foldIdentifier(n, scope.dialect);
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
