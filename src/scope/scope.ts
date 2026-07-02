import type {
	ColumnRef,
	CteDef,
	GraphTableSource,
	LateralViewSource,
	PipeExpr,
	PipeStage,
	PivotInfo,
	Projection,
	QueryBody,
	QueryExpr,
	SelectExpr,
	Source,
	SubquerySource,
	TableSource,
	UnpivotInfo,
} from "../ir/ir.js";
import type { StatementCategory } from "../ir/statement.js";

// ---------------------------------------------------------------------------
// Scope — the symbol table over the IR. One Scope per query block; it records
// the visible sources (tables / CTEs / subqueries), the CTEs in scope, and the
// columns the block outputs. Schema-free: everything here is derivable from the
// query structure alone. (Schema-dependent resolution lives in qualify.)
// ---------------------------------------------------------------------------

export interface ScopeTree {
	root: Scope;
	/** The statement category the dialect's lower() reported (query / dml / ddl / dcl / tcl /
	 *  utility / compound / other). "other" when the lowered query carried none. */
	statement: StatementCategory;
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
	/** For a pipe body (body.kind === "pipe"): the input relation's scope and the ordered per-stage
	 *  scopes (all also in `children`). The pipe's output is the last stage's output (input's if empty). */
	pipe?: { input: Scope; stages: Scope[] };
	/** When this scope IS a pipe stage: the stage it resolves and the scope of the relation entering it
	 *  (the previous stage, or the pipe input for the first). Its `sources` hold that incoming relation
	 *  (unqualified) plus any source the stage adds (a JOIN); its outputs are the stage transform applied
	 *  to the incoming columns. */
	pipeStage?: PipeStage;
	pipeIncoming?: Scope;
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
	| { kind: "lateral"; source: LateralViewSource }
	/** The relation entering a pipe stage — the previous stage's (or the pipe input's) output, exposed
	 *  unqualified. Carries no name of its own; its columns are that scope's outputs. */
	| { kind: "relation"; scope: Scope }
	/** A GRAPH_TABLE(…) relation — its own scope binds the graph element variables; its output columns
	 *  are the COLUMNS / RETURN list. Behaves like a derived (subquery) relation to the enclosing query. */
	| { kind: "graphtable"; scope: Scope; source: GraphTableSource }
	/** An aliased `PIVOT(…) AS p` / `UNPIVOT(…) AS p` relation — the base relation(s) are consumed; this
	 *  source exposes the reshaped column set (base passthrough + produced columns) under `p`. Columns are
	 *  computed from `base` and applied via applyPivotCols/applyUnpivotCols (schema-fed in qualify). */
	| { kind: "pivot"; alias: string; base: ResolvedSource[]; pivot?: PivotInfo; unpivot?: UnpivotInfo };

export function resolveScopes(query: QueryExpr, dialect?: string): ScopeTree {
	const d = dialect ?? query.dialect;
	if (!d) throw new Error("resolveScopes: no dialect — pass one, or use an IR produced by a dialect's lower()");
	return { root: buildQueryScope(query, undefined, d), statement: query.statement ?? "other" };
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
	if (scope.body.kind === "pipe") return scope.pipe ? aliasNames(scope.pipe.stages.at(-1) ?? scope.pipe.input) : [];
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
	const d = dialect ?? parent?.dialect;
	if (!d) throw new Error("newScope: no dialect — pass one explicitly or via parent");
	return {
		body,
		sources: new Map(),
		ctes: new Map(),
		outputs: "unknown",
		parent,
		children: [],
		dialect: d,
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

	if (body.kind === "pipe") {
		fillPipeScope(scope, body);
		return;
	}

	// An ALIASED PIVOT/UNPIVOT (`FROM t PIVOT(…) AS p`) consumes the base relation and exposes a single
	// named relation `p` whose columns are the reshape applied to the base — computed schema-fed later, so
	// `p.col` / a value column / `SELECT *` resolve against the pivoted set, not the base. Build the base
	// sources (their child scopes survive) but keep them inside the pivot source rather than visible.
	const pivotAlias = body.pivot?.alias ?? body.unpivot?.alias;
	if (pivotAlias) {
		const base = body.from.map((source) => resolveSource(scope, source));
		scope.sources.set(normalizeName(pivotAlias), {
			kind: "pivot",
			alias: pivotAlias,
			base,
			pivot: body.pivot?.alias ? body.pivot : undefined,
			unpivot: body.unpivot?.alias ? body.unpivot : undefined,
		});
	} else {
		for (const source of body.from) registerSource(scope, source);
	}

	// Scalar / IN / EXISTS subqueries in expressions become child scopes (parent set for correlation).
	for (const sub of body.subqueries ?? []) {
		scope.children.push(buildQueryScope(sub, scope));
	}

	scope.outputs = computeOutputs(scope, body);
}

// --- pipe scopes -----------------------------------------------------------------
// A pipe body flows the relation through ordered stages. Each stage becomes a child scope whose visible
// source is the relation ENTERING it (the previous stage, or the pipe input) — exposed unqualified as a
// "relation" source — plus any source the stage itself adds (a JOIN). The stage's column references
// resolve against that, so a ref in `|> WHERE x` or `|> SELECT a` binds to the relation visible at that
// point, with its real span. The pipe's output is the last stage's output.

function fillPipeScope(scope: Scope, body: PipeExpr): void {
	const input = buildBodyScope(body.input, scope);
	scope.children.push(input);
	const stages: Scope[] = [];
	let incoming = input;
	for (const stage of body.stages) {
		const ss = buildStageScope(scope, stage, incoming);
		scope.children.push(ss);
		stages.push(ss);
		incoming = ss;
	}
	scope.pipe = { input, stages };
	scope.outputs = stages.length ? stages[stages.length - 1].outputs : input.outputs;
}

/** The synthetic body carried by a stage scope — it holds the stage's own column references (for the
 *  qualify pass to check) and, for projection stages, the projections (for `*` expansion). `from` is
 *  empty: the stage's relations live on the scope's `sources`, not in a FROM clause. */
function stageBody(stage: PipeStage): SelectExpr {
	const projections = projectionsOfStage(stage);
	const columns = "columns" in stage ? stage.columns : [];
	return { kind: "select", projections, from: [], columns, aggregated: stage.op === "aggregate", cst: stage.cst };
}

function projectionsOfStage(stage: PipeStage): Projection[] {
	if (stage.op === "select" || stage.op === "extend" || stage.op === "window") return stage.projections;
	if (stage.op === "aggregate") return stage.aggregates;
	return [];
}

function buildStageScope(pipeScope: Scope, stage: PipeStage, incoming: Scope): Scope {
	const ss = newScope(stageBody(stage), pipeScope, pipeScope.dialect);
	ss.pipeStage = stage;
	ss.pipeIncoming = incoming;
	// The relation entering this stage, exposed unqualified (key "").
	ss.sources.set("", { kind: "relation", scope: incoming });

	if (stage.op === "join") registerSource(ss, stage.source);
	if (stage.op === "with") {
		for (const cte of stage.ctes) {
			const cteScope = buildQueryScope(cte.body, ss);
			if (cte.columnAliases) cteScope.outputs = cte.columnAliases;
			ss.ctes.set(normalizeName(cte.name), { def: cte, scope: cteScope });
			ss.children.push(cteScope);
		}
	}
	if (stage.op === "setop") for (const q of stage.operands) ss.children.push(buildQueryScope(q, ss));
	if (stage.op === "recursiveUnion") ss.children.push(buildQueryScope(stage.operand, ss));
	if (stage.op === "if") for (const arm of stage.arms) buildSubpipeline(ss, arm.pipeline, incoming);
	if (stage.op === "fork" || stage.op === "tee") for (const br of stage.branches) buildSubpipeline(ss, br, incoming);
	if (stage.op === "log" && stage.pipeline) buildSubpipeline(ss, stage.pipeline, incoming);

	ss.outputs = stageOutputsFree(stage, incoming.outputs, ss);
	return ss;
}

/** Register a FROM/JOIN source on a scope (table / CTE-ref / subquery / lateral / graph-table). */
function registerSource(scope: Scope, source: Source): void {
	scope.sources.set(sourceKey(source), resolveSource(scope, source));
}

/** Resolve a Source to a ResolvedSource (building child scopes for subqueries / graph tables) WITHOUT
 *  registering it visibly — used for both registerSource and the consumed base of an aliased pivot. */
function resolveSource(scope: Scope, source: Source): ResolvedSource {
	if (source.kind === "subquery") {
		const child = buildQueryScope(source.query, scope);
		scope.children.push(child);
		return { kind: "subquery", scope: child, source };
	} else if (source.kind === "lateral") {
		return { kind: "lateral", source };
	} else if (source.kind === "graphtable") {
		const child = buildGraphScope(scope, source);
		scope.children.push(child);
		return { kind: "graphtable", scope: child, source };
	} else {
		const cteRef = source.name.length === 1 ? lookupCte(scope, source.name[0]) : undefined;
		return cteRef ? { kind: "cte", ref: cteRef, source } : { kind: "table", name: source.name, source };
	}
}

/** A GRAPH_TABLE relation's own scope: the graph element variables are its sources (their columns need a
 *  graph schema, so unknown), and its output columns are the COLUMNS / RETURN projection list. The graph
 *  WHERE / output expressions resolve against the element variables. */
function buildGraphScope(parent: Scope, src: GraphTableSource): Scope {
	const refs = [...src.columnRefs];
	const body: SelectExpr = {
		kind: "select",
		projections: src.columns,
		from: [],
		columns: refs,
		where: src.where,
		aggregated: false,
		cst: src.cst,
	};
	const scope = newScope(body, parent, parent.dialect);
	for (const el of src.elements) {
		if (!el.variable) continue;
		const ts: TableSource = {
			kind: "table",
			name: [el.variable],
			alias: el.variable,
			cst: el.variableCst ?? el.cst,
		};
		scope.sources.set(normalizeName(el.variable), { kind: "table", name: [el.variable], source: ts });
	}
	scope.outputs = outputsOf(body);
	return scope;
}

/** A sub-pipeline (IF/FORK/TEE/LOG branch): stages applied to `incoming`, built as child scopes. */
function buildSubpipeline(parent: Scope, stages: PipeStage[], incoming: Scope): void {
	let cur = incoming;
	for (const stage of stages) {
		const ss = buildStageScope(parent, stage, cur);
		parent.children.push(ss);
		cur = ss;
	}
}

/** Schema-free output columns of a stage given the incoming columns. Conservative: anything needing a
 *  catalog (a JOINed table's columns, a TVF's output, a PIVOT/reshape) is "unknown" here and refined by
 *  qualify. Pass-through stages keep the incoming columns; column-set transforms apply their change. */
function stageOutputsFree(stage: PipeStage, incoming: string[] | "unknown", scope: Scope): string[] | "unknown" {
	switch (stage.op) {
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
		case "drop":
			if (incoming === "unknown") return "unknown";
			return incoming.filter((c) => !stage.drop.some((d) => normalizeName(d) === normalizeName(c)));
		case "rename":
			if (incoming === "unknown") return "unknown";
			return applyRenameList(incoming, stage.renames);
		case "select":
			return projectionOutputsFree(stage.projections, incoming);
		case "aggregate":
			return aggregateOutputsFree(stage, incoming);
		case "extend":
		case "window": {
			if (incoming === "unknown") return "unknown";
			const added = simpleProjNames(stage.projections);
			return added === "unknown" ? "unknown" : [...incoming, ...added];
		}
		default:
			// join / call / pivot / unpivot / matchRecognize / describe / if / fork / tee / export /
			// create / insert / other — output needs a catalog or is terminal/branching: unknown here.
			return "unknown";
	}
}

/** Project a star-or-named list against the incoming columns (schema-free: incoming is the only source,
 *  so a qualified `t.*` or an anonymous expression yields "unknown"). */
function projectionOutputsFree(projections: Projection[], incoming: string[] | "unknown"): string[] | "unknown" {
	if (projections.length === 0) return "unknown";
	const names: string[] = [];
	for (const p of projections) {
		if (p.isStar) {
			if (incoming === "unknown") return "unknown";
			const star = p.expr.kind === "star" ? p.expr : undefined;
			if (star?.qualifier) return "unknown";
			names.push(...(star ? applyStarModifiers(incoming, star) : incoming));
		} else if (p.name !== undefined) {
			names.push(p.name);
		} else {
			return "unknown";
		}
	}
	return names;
}

/** Pipe AGGREGATE output: the aggregate columns plus the grouping-key columns (GoogleSQL order). */
function aggregateOutputsFree(
	stage: Extract<PipeStage, { op: "aggregate" }>,
	incoming: string[] | "unknown",
): string[] | "unknown" {
	const aggs = simpleProjNames(stage.aggregates);
	if (aggs === "unknown") return "unknown";
	const keys: string[] = [];
	for (const g of stage.groupBy) {
		if (g.kind === "column") keys.push(g.parts[g.parts.length - 1]);
		else return "unknown"; // a non-column grouping key has no determinable name
	}
	return [...aggs, ...keys];
}

/** Names of a non-star projection list, or "unknown" if any item is a star/anonymous. */
function simpleProjNames(projections: Projection[]): string[] | "unknown" {
	const names: string[] = [];
	for (const p of projections) {
		if (p.isStar || p.name === undefined) return "unknown";
		names.push(p.name);
	}
	return names;
}

function applyRenameList(cols: string[], renames: { from: string; to: string }[]): string[] {
	const map = new Map(renames.map((r) => [normalizeName(r.from), r.to]));
	return cols.map((c) => map.get(normalizeName(c)) ?? c);
}

/** A select's output columns, accounting for a PIVOT/UNPIVOT transforming the FROM relation. */
function computeOutputs(scope: Scope, body: SelectExpr): string[] | "unknown" {
	// T-SQL exposes the pivoted/unpivoted relation under an alias (registered as a source below);
	// the SELECT's own output is then its projections. Spark's pivot transforms the SELECT directly.
	if (body.unpivot && !body.unpivot.alias) return unpivotOutputs(scope, body.unpivot);
	if (body.pivot && !body.pivot.alias) return pivotOutputs(scope, body.pivot);
	return outputsOf(body);
}

/** The columns of the relation being pivoted/unpivoted — the first non-lateral source. */
function baseRelationColumns(scope: Scope): string[] | "unknown" {
	for (const src of scope.sources.values()) {
		if (src.kind !== "lateral") return sourceOutputs(src);
	}
	return "unknown";
}

// Pure column transforms — applied to a known base column list. Shared by the schema-free scope outputs
// AND the schema-fed qualify / resolve passes, so the pivot reshape is consistent everywhere (not just
// in scope.outputs). PIVOT consumes the FOR + aggregate columns and adds the IN-list value columns;
// UNPIVOT consumes the IN-list columns and adds the name + value columns; both keep the passthrough rest.
export function applyPivotCols(base: string[], p: PivotInfo): string[] {
	const consumed = new Set([...p.forColumns, ...p.aggColumns].map(normalizeName));
	return [...base.filter((c) => !consumed.has(normalizeName(c))), ...p.values];
}

export function applyUnpivotCols(base: string[], u: UnpivotInfo): string[] {
	const removed = new Set(u.removed.map(normalizeName));
	return [...base.filter((c) => !removed.has(normalizeName(c))), u.nameColumn, u.valueColumn];
}

function unpivotOutputs(scope: Scope, u: UnpivotInfo): string[] | "unknown" {
	const base = baseRelationColumns(scope);
	return base === "unknown" ? "unknown" : applyUnpivotCols(base, u);
}

function pivotOutputs(scope: Scope, p: PivotInfo): string[] | "unknown" {
	const base = baseRelationColumns(scope);
	return base === "unknown" ? "unknown" : applyPivotCols(base, p);
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
	if (source.kind === "graphtable")
		return normalizeName(source.alias ?? source.graph[source.graph.length - 1] ?? "graph_table");
	const raw = source.alias ?? (source.kind === "table" ? source.name[source.name.length - 1] : "");
	return normalizeName(raw ?? "");
}

/** The columns a resolved source exposes, or "unknown" when it needs a schema (a bare table). */
function sourceOutputs(src: ResolvedSource): string[] | "unknown" {
	if (src.kind === "table") return src.source.columnAliases ?? "unknown";
	if (src.kind === "cte") return src.ref.scope.outputs;
	if (src.kind === "lateral") return src.source.columns;
	if (src.kind === "relation") return src.scope.outputs; // a prior pipe stage's relation
	if (src.kind === "graphtable") return src.scope.outputs;
	if (src.kind === "pivot") return pivotSourceOutputs(src, (s) => sourceOutputs(s));
	return src.scope.outputs; // subquery
}

/** The reshaped columns of an aliased PIVOT/UNPIVOT source: its base columns (via `cols`) with the
 *  pivot/unpivot transform applied. "unknown" if any base relation's columns need a schema we lack.
 *  Shared by the schema-free scope path and the schema-fed qualify / resolve / lineage passes (each
 *  passes its own column resolver), so an aliased pivot exposes the same reshaped set everywhere. */
export function pivotSourceOutputs(
	src: Extract<ResolvedSource, { kind: "pivot" }>,
	cols: (s: ResolvedSource) => string[] | "unknown",
): string[] | "unknown" {
	const parts = src.base.map(cols);
	if (parts.some((p) => p === "unknown")) return "unknown";
	const base = (parts as string[][]).flat();
	if (src.pivot) return applyPivotCols(base, src.pivot);
	if (src.unpivot) return applyUnpivotCols(base, src.unpivot);
	return "unknown";
}

/** Databricks identifiers are case-insensitive; strip surrounding backticks too. */
function normalizeName(name: string): string {
	const unquoted = name.startsWith("`") && name.endsWith("`") ? name.slice(1, -1) : name;
	return unquoted.toLowerCase();
}
