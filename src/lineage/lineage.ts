import { behaviorOf } from "../dialect-behavior/carrier.js";
import { resolveBehavior } from "../dialect-behavior/registry.js";
import type { Expr, Projection, QueryExpr } from "../ir/ir.js";
import type { SchemaProvider } from "../qualify/schema-provider.js";
import { resolveScopes, type ResolvedSource, type Scope, type ScopeTree } from "../scope/scope.js";
import { columnNamesOf, findProducerProjection, resolveColumnSource } from "../sema/resolve.js";

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
	/** The projection that produced this output, when one exists (reference into the frozen IR).
	 *  Absent for schema-expanded star outputs with no projection node. */
	projection?: Projection;
}

/** Lineage of a query's output columns: each output → the base-table columns it derives from. */
export function lineage(tree: ScopeTree, schema: SchemaProvider): ColumnLineage[] {
	return bodyLineage(tree.root, schema, new Set());
}

/** The base-table origins of a single expression (e.g. a projection or a column reference). */
export function originsOf(expr: Expr, scope: Scope, schema: SchemaProvider): Origin[] {
	return dedup(exprOrigins(expr, scope, schema, new Set()), scope.dialect);
}

function bodyLineage(scope: Scope, schema: SchemaProvider, seen: Set<Scope>): ColumnLineage[] {
	if (scope.pipeStage) return pipeStageLineage(scope, schema, seen);
	const body = scope.body;
	if (body.kind === "pipe") {
		const last = scope.pipe?.stages.at(-1) ?? scope.pipe?.input;
		return last ? bodyLineage(last, schema, seen) : [];
	}
	if (body.kind === "setop") {
		// A union: output column i derives from BOTH branches' column i.
		const left = scope.branches ? bodyLineage(scope.branches.left, schema, seen) : [];
		const right = scope.branches ? bodyLineage(scope.branches.right, schema, seen) : [];
		return left.map((l, i) => ({
			output: l.output,
			origins: dedup([...l.origins, ...(right[i]?.origins ?? [])], scope.dialect),
		}));
	}
	return projectionLineage(scope, body.projections, schema, seen);
}

/** Lineage of a projection list (a star expands to each source column traced to its origins). */
function projectionLineage(
	scope: Scope,
	projections: import("../ir/ir.js").Projection[],
	schema: SchemaProvider,
	seen: Set<Scope>,
): ColumnLineage[] {
	const out: ColumnLineage[] = [];
	for (const p of projections) {
		if (p.isStar) {
			const qualifier = p.expr.kind === "star" ? p.expr.qualifier : undefined;
			out.push(...starLineage(scope, qualifier, schema, seen));
		} else if (p.name !== undefined) {
			out.push({
				output: p.name,
				origins: dedup(exprOrigins(p.expr, scope, schema, seen), scope.dialect),
				projection: p,
			});
		}
		// anonymous projection → no nameable output, skip
	}
	return out;
}

/** Lineage of a pipe stage's output columns, flowing the incoming relation through the stage. */
function pipeStageLineage(scope: Scope, schema: SchemaProvider, seen: Set<Scope>): ColumnLineage[] {
	const stage = scope.pipeStage!;
	// The incoming relation, each column traced to its origins (the "relation" source under key "").
	const passthrough = (): ColumnLineage[] => starLineage(scope, undefined, schema, seen);
	switch (stage.op) {
		case "select":
			return projectionLineage(scope, stage.projections, schema, seen);
		case "extend":
		case "window":
			return [...passthrough(), ...projectionLineage(scope, stage.projections, schema, seen)];
		case "aggregate": {
			const aggs = projectionLineage(scope, stage.aggregates, schema, seen);
			const keys: ColumnLineage[] = [];
			for (const g of stage.groupBy) {
				if (g.kind === "column")
					keys.push({
						output: g.parts[g.parts.length - 1],
						origins: dedup(exprOrigins(g, scope, schema, seen), scope.dialect),
					});
			}
			return [...aggs, ...keys];
		}
		case "drop": {
			const fold = (n: string) => behaviorOf(scope).fold(n);
			const dropped = new Set(stage.drop.map(fold));
			return passthrough().filter((l) => !dropped.has(fold(l.output)));
		}
		case "rename": {
			const fold = (n: string) => behaviorOf(scope).fold(n);
			const map = new Map(stage.renames.map((r) => [fold(r.from), r.to]));
			return passthrough().map((l) => ({
				output: map.get(fold(l.output)) ?? l.output,
				origins: l.origins,
			}));
		}
		case "set": {
			const fold = (n: string) => behaviorOf(scope).fold(n);
			const set = new Map(stage.assignments.map((a) => [fold(a.column), a.expr]));
			return passthrough().map((l) => {
				const e = set.get(fold(l.output));
				return e ? { output: l.output, origins: dedup(exprOrigins(e, scope, schema, seen), scope.dialect) } : l;
			});
		}
		case "join":
		case "where":
		case "orderBy":
		case "limit":
		case "distinct":
		case "tablesample":
		case "assert":
		case "log":
		case "staticDescribe":
		case "with":
		case "setop":
		case "recursiveUnion":
			return passthrough();
		default:
			return []; // call / pivot / unpivot / matchRecognize / describe / branching / sinks
	}
}

/** Expand `*` / `t.*`: each source column becomes an output, traced to its origins. */
function starLineage(
	scope: Scope,
	qualifier: string[] | undefined,
	schema: SchemaProvider,
	seen: Set<Scope>,
): ColumnLineage[] {
	const want = qualifier ? (qualifier[qualifier.length - 1] ?? "") : undefined;
	const out: ColumnLineage[] = [];
	for (const [key, src] of scope.sources) {
		if (want !== undefined && !behaviorOf(scope).matchesSourceKey(key, want)) continue;
		for (const col of columnNamesOf(src, schema, undefined, scope.dialect) ?? []) {
			out.push({ output: col, origins: dedup(columnOrigins(src, col, schema, seen), scope.dialect) });
		}
	}
	return out;
}

/** The base-table columns an expression derives from — the union over every contributing column. */
function exprOrigins(expr: Expr, scope: Scope, schema: SchemaProvider, seen: Set<Scope>): Origin[] {
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
			return [
				...exprOrigins(expr.base, scope, schema, seen),
				...(expr.index ? exprOrigins(expr.index, scope, schema, seen) : []),
				...(expr.end ? exprOrigins(expr.end, scope, schema, seen) : []),
				...(expr.step ? exprOrigins(expr.step, scope, schema, seen) : []),
			];
		case "lambda":
			return exprOrigins(expr.body, scope, schema, seen); // param refs resolve to nothing
		case "subquery":
		case "exists":
			return subqueryOrigins(expr.query, schema, seen, scope.dialect);
		default:
			return []; // literal / star / parameter / variable / other: no base-table origin
	}
}

function columnRefOrigins(parts: string[], scope: Scope, schema: SchemaProvider, seen: Set<Scope>): Origin[] {
	const found = resolveColumnSource(scope, parts, schema);
	return found ? columnOrigins(found.source, found.column, schema, seen) : [];
}

/** The origins of `column` exposed by a source — a base table is a leaf; a derived relation
 *  recurses into the projection (or source) that produces the column. Exported so the per-hop
 *  lineage walk (src/lineage/hops.ts) can defer pipe/lateral/graphtable/pivot sources — the ones
 *  it has no hop model for — to this exact shared origin walk, so the two walks can't drift. */
export function columnOrigins(src: ResolvedSource, column: string, schema: SchemaProvider, seen: Set<Scope>): Origin[] {
	// Origins are DISPLAY-facing: the as-written parts (relation.parts), never the folded key.
	if (src.kind === "table") return [{ table: src.source.relation.parts, column }];
	if (src.kind === "cte") return derivedOrigins(src.ref.scope, column, src.ref.def.columnAliases, schema, seen);
	if (src.kind === "subquery") return derivedOrigins(src.scope, column, src.source.columnAliases, schema, seen);
	if (src.kind === "relation") return derivedOrigins(src.scope, column, undefined, schema, seen); // prior pipe stage
	if (src.kind === "graphtable") return derivedOrigins(src.scope, column, undefined, schema, seen);
	return []; // lateral — no base-table origin
}

function derivedOrigins(
	child: Scope,
	column: string,
	aliases: string[] | undefined,
	schema: SchemaProvider,
	seen: Set<Scope>,
): Origin[] {
	if (seen.has(child)) return []; // recursive CTE — stop
	seen.add(child); // guard the whole subtree (incl. a set-op body that re-references this relation)
	try {
		const d = child.dialect;
		// A set-op / pipe / pipe-stage relation has no plain projection list — trace via its lineage.
		if (child.pipeStage || child.body.kind === "setop" || child.body.kind === "pipe") {
			const lin = bodyLineage(child, schema, seen);
			const i = aliases
				? aliases.findIndex((a) => eq(a, column, d))
				: lin.findIndex((l) => eq(l.output, column, d));
			return i >= 0 ? (lin[i]?.origins ?? []) : [];
		}
		if (child.body.kind !== "select") return [];
		const producer = findProducerProjection(child.body.projections, column, aliases, d)?.expr;
		// A named projection produces it directly; otherwise it flows through a `*`/source — resolve it
		// as a column reference inside the child scope.
		return producer ? exprOrigins(producer, child, schema, seen) : columnRefOrigins([column], child, schema, seen);
	} finally {
		seen.delete(child);
	}
}

function subqueryOrigins(query: QueryExpr, schema: SchemaProvider, seen: Set<Scope>, dialect: string): Origin[] {
	// A scalar/EXISTS subquery contributes its output column's origins. Its scope is built fresh;
	// correlated refs in the body bind to nothing here, which is fine — we trace the value column.
	const root = resolveScopes(query, dialect).root;
	if (root.body.kind !== "select" || root.body.projections.length === 0) return [];
	return exprOrigins(root.body.projections[0].expr, root, schema, seen);
}

function dedup(origins: Origin[], dialect?: string): Origin[] {
	const b = resolveBehavior(dialect);
	const byKey = new Map<string, Origin>();
	for (const o of origins) {
		byKey.set(`${b.foldTableName(o.table).join(".")}.${b.fold(o.column)}`, o);
	}
	return [...byKey.values()];
}

function eq(a: string, b: string, dialect?: string): boolean {
	const bh = resolveBehavior(dialect);
	return bh.fold(a) === bh.fold(b);
}
