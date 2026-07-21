import type {
	ColumnRef,
	CteDef,
	Expr,
	GraphTableSource,
	LateralViewSource,
	LimitInfo,
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
	VariableDecl,
} from "../ir/ir.js";
import type { StatementCategory } from "../ir/statement.js";
import { behaviorOf } from "../dialect-behavior/carrier.js";
import { synthesizedQualifiedName } from "../ir/qualified-name.js";
import { resolveBehavior } from "../dialect-behavior/registry.js";
import { likePatternToRegExp } from "./like-pattern.js";

// ---------------------------------------------------------------------------
// Scope — the symbol table over the IR. One Scope per query block; it records
// the visible sources (tables / CTEs / subqueries), the CTEs in scope, and the
// columns the block outputs. Schema-free: everything here is derivable from the
// query structure alone. (Schema-dependent resolution lives in qualify.)
// ---------------------------------------------------------------------------

export interface ScopeTree {
	/** Discriminant tag — lets api.ts's `isScopeTree` identify a ScopeTree structurally
	 *  instead of shape-sniffing `root`/`statement`. */
	kind: "scopes";
	root: Scope;
	/** The statement category the dialect's lower() reported (query / dml / ddl / dcl / tcl /
	 *  utility / compound / other). "other" when the lowered query carried none. */
	statement: StatementCategory;
}

export interface Scope {
	/** The query body this scope describes (a SELECT, or a set operation). */
	body: QueryBody;
	/** Visible relations, keyed by alias (or the table's last name part). NOTE: two sources whose
	 *  keys collide (joined FQN tables sharing a last part) occupy ONE slot here — resolution that
	 *  must see every source reads `sourceList` (#38). */
	sources: Map<string, ResolvedSource>;
	/** Every visible relation in registration order, with its binding key — the collision-proof
	 *  twin of `sources`. Qualifier matching and ambiguity detection walk THIS (#38). */
	sourceList: { key: string; source: ResolvedSource }[];
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
	/** This QueryExpr's own variable declarations (T-SQL DECLARE, or a routine's signature
	 *  parameters), copied from `QueryExpr.declarations` by `buildQueryScope` onto the scope it
	 *  builds: the top scope for a top-level DECLARE, or (for a routine) the container's own scope
	 *  AND each inner statement's own scope, independently (a DECLARE nested in a routine body
	 *  carries its OWN declarations here, distinct from the container's parameters). Absent means
	 *  none. A `variable` reference resolves against the WHOLE tree (pooled) via `rootDeclarations`
	 *  below, not just this one level. */
	declarations?: readonly VariableDecl[];
	/** This QueryExpr's own ORDER BY sort expressions, copied from `QueryExpr.orderBy` by
	 *  `buildQueryScope` the same way `declarations` above is (additive), so a consumer that needs
	 *  "this scope's own trailing ORDER BY" (src/scope/clauses.ts's `clausesOf`) reads it straight off
	 *  the Scope instead of re-matching a QueryExpr by body identity. Absent means none. A set-op
	 *  branch / pipe stage scope (built via `buildBodyScope`, no owning QueryExpr) never carries this. */
	orderBy?: Expr[];
	/** This QueryExpr's own row-limiting clause (LIMIT / TOP / OFFSET-FETCH), copied from
	 *  `QueryExpr.limit` the same way `orderBy` above is. Absent means none. */
	limit?: LimitInfo;
}

export interface CteRef {
	def: CteDef;
	scope: Scope;
}

export type ResolvedSource =
	/** `name` is the relation's FOLDED IDENTITY key parts (source.relation.key) — the catalog
	 *  lookup currency. Display text lives on source.relation (parts/fqn); never show `name`. */
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
	const root = buildQueryScope(query, undefined, d);
	return { kind: "scopes", root, statement: query.statement ?? "other" };
}

/** The declarations visible to `scope`: walk up to the tree's ROOT, then collect every
 *  `.declarations` in the WHOLE tree rooted there (the root's own, plus every descendant scope's:
 *  a routine's inner statement scopes hang as children of their container's own scope, see
 *  buildQueryScope's `statements` wiring, so this reaches a routine's signature parameters AND
 *  every inner statement's own DECLARE, from anywhere in the body). Declarations are pooled, not
 *  shadowed by nesting/position: a body DECLARE reusing a parameter's (or a sibling statement's)
 *  name becomes a 2-CANDIDATE AMBIGUITY, exactly like two DECLAREs of the same name in one
 *  statement, never silently shadowed (never-wrong's cue to abstain, not this helper's; see the
 *  single-unambiguous-match rule at each call site in infer.ts/symbols.ts). Cross-cell linking (a
 *  DECLARE in an earlier TOP-LEVEL document statement) is still the document layer's job
 *  (src/document/document.ts), not this scope-local walk. */
export function rootDeclarations(scope: Scope): readonly VariableDecl[] | undefined {
	let root = scope;
	while (root.parent) root = root.parent;
	const out: VariableDecl[] = [];
	const visit = (s: Scope): void => {
		if (s.declarations?.length) out.push(...s.declarations);
		for (const c of s.children) visit(c);
	};
	visit(root);
	return out.length ? out : undefined;
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
 * Source-map keys are folded (see sourceKey); a raw part matches via either the alias/other fold
 * or the table fold (these differ only for BigQuery's case-preserving table identifiers).
 */
export function splitColumnRef(parts: string[], isSource: (key: string) => boolean, dialect?: string): SplitRef {
	const b = resolveBehavior(dialect);
	const keyOf = (part: string): string | undefined => {
		const k = b.fold(part);
		if (isSource(k)) return k;
		const kt = b.fold(part, "table");
		return kt !== k && isSource(kt) ? kt : undefined;
	};
	// `schema.table.col[.field…]` — the 2-token qualifier is keyed by the table (its last part).
	if (parts.length >= 3) {
		const key = keyOf(parts[1]);
		if (key !== undefined) return { qualifier: key, column: parts[2], fields: parts.slice(3) };
	}
	// `alias.col[.field…]` — single-token qualifier.
	if (parts.length >= 2) {
		const key = keyOf(parts[0]);
		if (key !== undefined) return { qualifier: key, column: parts[1], fields: parts.slice(2) };
	}
	// Unqualified: the first part is the column; anything after it is struct/field navigation.
	return { column: parts[0] ?? "", fields: parts.slice(1) };
}

/** Split a reference against the sources visible from `scope` (including enclosing scopes). */
export function splitColumnRefInScope(scope: Scope, parts: string[]): SplitRef {
	return splitColumnRef(parts, (key) => hasVisibleSource(scope, key), scope.dialect);
}

/**
 * The sources of ONE scope matching a column reference's QUALIFIER (issue #38) — with the leading
 * parts VALIDATED, at any depth the dialect's namespace admits:
 *  - a single-part qualifier matches an alias or a source's binding key (today's semantics);
 *  - a multi-part qualifier matches only an UNALIASED table source whose `relation.key` ends with
 *    the folded qualifier parts, ALL of them (an alias supersedes the table name for
 *    qualification, so aliased sources never match multi-part). `wrong.orders.amount` therefore
 *    binds nowhere, where the last-part heuristic used to bind it to any `orders`.
 * Returns every match: 1 = bound, >1 = a genuinely ambiguous qualifier, 0 = try shorter/elsewhere.
 */
export function sourcesMatchingQualifier(scope: Scope, qualParts: string[]): ResolvedSource[] {
	const b = behaviorOf(scope);
	const matchesKeyPart = (raw: string, keyPart: string): boolean =>
		b.fold(raw) === keyPart || b.fold(raw, "table") === keyPart;
	const out: ResolvedSource[] = [];
	for (const { key, source } of scope.sourceList) {
		if (qualParts.length === 1) {
			if (key !== "" && matchesKeyPart(qualParts[0]!, key)) out.push(source);
			continue;
		}
		if (source.kind !== "table" || source.source.alias) continue;
		const k = source.source.relation.key;
		if (qualParts.length > k.length) continue;
		const off = k.length - qualParts.length;
		if (qualParts.every((p, i) => matchesKeyPart(p, k[off + i]!))) out.push(source);
	}
	return out;
}

/** True if `key` names a source in this scope or any enclosing one (for correlation). */
function hasVisibleSource(scope: Scope, key: string): boolean {
	for (let s: Scope | undefined = scope; s; s = s.parent) if (s.sources.has(key)) return true;
	return false;
}

/** Clauses where a bare name may reference a SELECT-list alias rather than a source column. Used by
 *  the unified binder (src/sema/resolve.ts) for the projection-alias fallback. */
export function aliasVisibleClause(clause: ColumnRef["clause"] | undefined): boolean {
	return clause === "groupBy" || clause === "having" || clause === "qualify" || clause === "orderBy";
}

export function matchesProjectionAlias(scope: Scope, name: string): boolean {
	const b = behaviorOf(scope);
	const n = b.fold(name);
	return aliasNames(scope).some((a) => b.fold(a) === n);
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

function newScope(body: QueryBody, parent?: Scope, dialect?: string): Scope {
	const d = dialect ?? parent?.dialect;
	if (!d) throw new Error("newScope: no dialect — pass one explicitly or via parent");
	return {
		body,
		sources: new Map(),
		sourceList: [],
		ctes: new Map(),
		outputs: "unknown",
		parent,
		children: [],
		dialect: d,
	};
}

/** Build the scope for a full query (which may declare its own CTEs, its own DECLARE'd/parameter
 *  declarations, and, for a routine/compound container, its own inner statements). */
function buildQueryScope(query: QueryExpr, parent?: Scope, dialect?: string): Scope {
	const scope = newScope(query.body, parent, dialect);
	if (query.declarations?.length) scope.declarations = query.declarations;
	if (query.orderBy?.length) scope.orderBy = query.orderBy;
	if (query.limit) scope.limit = query.limit;
	// CTEs are visible to the body and to later CTEs; build them in order.
	for (const cte of query.ctes) {
		const cteScope = buildQueryScope(cte.body, scope);
		// Declared column aliases (WITH c (x, y) AS …) rename what the CTE exposes.
		if (cte.columnAliases) cteScope.outputs = cte.columnAliases;
		scope.ctes.set(behaviorOf(scope).fold(cte.name), { def: cte, scope: cteScope });
		scope.children.push(cteScope);
	}
	// A routine body / scripting compound's inner statements: each its own full scope tree, hung
	// under THIS scope (so a body reference reaches the container's declarations by walking parent
	// chains; see rootDeclarations). Not visible via `sources`/`ctes`, just a plain child, walked
	// like an expression subquery by every generic scope-tree consumer (symbols/node-at/references).
	for (const stmt of query.statements ?? []) {
		scope.children.push(buildQueryScope(stmt, scope, scope.dialect));
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
		scope.outputs = body.byName ? mergeByName(left.outputs, right.outputs, scope.dialect) : left.outputs;
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
		const pivotKey = behaviorOf(scope).fold(pivotAlias);
		const pivotSource: ResolvedSource = {
			kind: "pivot",
			alias: pivotAlias,
			base,
			pivot: body.pivot?.alias ? body.pivot : undefined,
			unpivot: body.unpivot?.alias ? body.unpivot : undefined,
		};
		scope.sources.set(pivotKey, pivotSource);
		scope.sourceList.push({ key: pivotKey, source: pivotSource });
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
	const columns = columnsOfStage(stage);
	return { kind: "select", projections, from: [], columns, aggregated: stage.op === "aggregate", cst: stage.cst };
}

function projectionsOfStage(stage: PipeStage): Projection[] {
	if (stage.op === "select" || stage.op === "extend" || stage.op === "window") return stage.projections;
	if (stage.op === "aggregate") return stage.aggregates;
	return [];
}

/** The stage's own column references (for qualify to check) — only the ops whose `PipeStage`
 *  variant carries a `columns` field. */
function columnsOfStage(stage: PipeStage): ColumnRef[] {
	switch (stage.op) {
		case "where":
		case "select":
		case "extend":
		case "set":
		case "aggregate":
		case "orderBy":
		case "join":
		case "window":
		case "call":
		case "assert":
		case "if":
		case "matchRecognize":
			return stage.columns;
		default:
			return [];
	}
}

function buildStageScope(pipeScope: Scope, stage: PipeStage, incoming: Scope): Scope {
	const ss = newScope(stageBody(stage), pipeScope, pipeScope.dialect);
	ss.pipeStage = stage;
	ss.pipeIncoming = incoming;
	// The relation entering this stage, exposed unqualified (key "").
	const incomingRelation: ResolvedSource = { kind: "relation", scope: incoming };
	ss.sources.set("", incomingRelation);
	ss.sourceList.push({ key: "", source: incomingRelation });

	if (stage.op === "join") registerSource(ss, stage.source);
	if (stage.op === "with") {
		for (const cte of stage.ctes) {
			const cteScope = buildQueryScope(cte.body, ss);
			if (cte.columnAliases) cteScope.outputs = cte.columnAliases;
			ss.ctes.set(behaviorOf(ss).fold(cte.name), { def: cte, scope: cteScope });
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
	const resolved = resolveSource(scope, source);
	// A name that resolved to a CTE keys with the "other" fold — CTE names are column-class
	// identifiers everywhere (only real table identifiers get BigQuery's case-preserving fold).
	const key = sourceKey(source, scope.dialect, resolved.kind === "cte");
	scope.sources.set(key, resolved);
	scope.sourceList.push({ key, source: resolved });
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
		// A CTE reference is single-part; relation.fqn is then its RAW delimiter-intact text (the
		// lookup folds it, and quoting semantics must survive into the fold).
		const parts = source.relation.parts;
		const cteRef = parts.length === 1 ? lookupCte(scope, source.relation.fqn) : undefined;
		return cteRef ? { kind: "cte", ref: cteRef, source } : { kind: "table", name: source.relation.key, source };
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
			// A synthesized single-part name: a graph element variable has no namespace.
			relation: synthesizedQualifiedName([el.variable], behaviorOf(scope).nameConfig),
			alias: el.variable,
			synthesized: true,
			cst: el.variableCst ?? el.cst,
		};
		const elKey = behaviorOf(scope).fold(el.variable);
		const elSource: ResolvedSource = { kind: "table", name: ts.relation.key, source: ts };
		scope.sources.set(elKey, elSource);
		scope.sourceList.push({ key: elKey, source: elSource });
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
			return incoming.filter(
				(c) => !stage.drop.some((d) => behaviorOf(scope).fold(d) === behaviorOf(scope).fold(c)),
			);
		case "rename":
			if (incoming === "unknown") return "unknown";
			return applyRenameList(incoming, stage.renames, scope.dialect);
		case "select":
			return projectionOutputsFree(stage.projections, incoming, scope.dialect);
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
function projectionOutputsFree(
	projections: Projection[],
	incoming: string[] | "unknown",
	dialect: string,
): string[] | "unknown" {
	if (projections.length === 0) return "unknown";
	const names: string[] = [];
	for (const p of projections) {
		if (p.isStar) {
			if (incoming === "unknown") return "unknown";
			const star = p.expr.kind === "star" ? p.expr : undefined;
			if (star?.qualifier) return "unknown";
			names.push(...(star ? applyStarModifiers(incoming, star, dialect) : incoming));
		} else if (p.name !== undefined) {
			names.push(p.name);
		} else {
			return "unknown";
		}
	}
	return names;
}

/** Pipe AGGREGATE output: the grouping-key columns plus the aggregate columns, in that order. "The
 *  output columns from the AGGREGATE operator include all grouping columns first, followed by all
 *  aggregate columns" (GoogleSQL pipe syntax reference, AGGREGATE operator section; every worked
 *  example there orders the GROUP BY key(s) before the aggregate aliases, e.g. `item | num_items |
 *  total_sales`). */
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
	return [...keys, ...aggs];
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

function applyRenameList(cols: string[], renames: { from: string; to: string }[], dialect?: string): string[] {
	const b = resolveBehavior(dialect);
	const map = new Map(renames.map((r) => [b.fold(r.from), r.to]));
	return cols.map((c) => map.get(b.fold(c)) ?? c);
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
		if (src.kind !== "lateral") return sourceOutputs(src, scope.dialect);
	}
	return "unknown";
}

// Pure column transforms — applied to a known base column list. Shared by the schema-free scope outputs
// AND the schema-fed qualify / resolve passes, so the pivot reshape is consistent everywhere (not just
// in scope.outputs). PIVOT consumes the FOR + aggregate columns and adds the IN-list value columns;
// UNPIVOT consumes the IN-list columns and adds the name + value columns; both keep the passthrough rest.
export function applyPivotCols(base: string[], p: PivotInfo, dialect?: string): string[] | "unknown" {
	// Data-dependent pivot (no static IN-list): output columns are not enumerable — never guess.
	if (p.dynamic) return "unknown";
	const fold = (n: string) => resolveBehavior(dialect).fold(n);
	const consumed = new Set([...p.forColumns, ...p.aggColumns].map(fold));
	return [...base.filter((c) => !consumed.has(fold(c))), ...p.values];
}

export function applyUnpivotCols(base: string[], u: UnpivotInfo, dialect?: string): string[] {
	const fold = (n: string) => resolveBehavior(dialect).fold(n);
	const removed = new Set(u.removed.map(fold));
	return [...base.filter((c) => !removed.has(fold(c))), u.nameColumn, u.valueColumn];
}

function unpivotOutputs(scope: Scope, u: UnpivotInfo): string[] | "unknown" {
	const base = baseRelationColumns(scope);
	return base === "unknown" ? "unknown" : applyUnpivotCols(base, u, scope.dialect);
}

function pivotOutputs(scope: Scope, p: PivotInfo): string[] | "unknown" {
	const base = baseRelationColumns(scope);
	return base === "unknown" ? "unknown" : applyPivotCols(base, p, scope.dialect);
}

/** `UNION BY NAME` output: left columns in order, then right-only columns appended. */
export function mergeByName(
	left: string[] | "unknown",
	right: string[] | "unknown",
	dialect?: string,
): string[] | "unknown" {
	if (left === "unknown" || right === "unknown") return "unknown";
	const b = resolveBehavior(dialect);
	const seen = new Set(left.map((c) => b.fold(c)));
	return [...left, ...right.filter((c) => !seen.has(b.fold(c)))];
}

/** Apply a star node's modifiers to an expansion: EXCLUDE/EXCEPT removes, ILIKE filters by
 *  pattern, RENAME renames (REPLACE keeps name and position — no expansion change). */
export function applyStarModifiers(
	cols: string[],
	star: { exclude?: string[]; ilike?: string; rename?: { from: string; to: string }[] },
	dialect?: string,
): string[] {
	const fold = (n: string) => resolveBehavior(dialect).fold(n);
	let out = cols;
	if (star.exclude) {
		const removed = new Set(star.exclude.map(fold));
		out = out.filter((c) => !removed.has(fold(c)));
	}
	if (star.ilike !== undefined) {
		const b = resolveBehavior(dialect);
		const pat = star.ilike;
		out = out.filter((c) => b.likeMatch(pat, fold(c)));
	}
	if (star.rename) {
		const renames = new Map(star.rename.map((r) => [fold(r.from), r.to]));
		out = out.map((c) => renames.get(fold(c)) ?? c);
	}
	return out;
}

// likePatternToRegExp moved to ./like-pattern.js (leaf module, breaks the scope->carrier->registry
// cycle); re-exported here so existing importers keep resolving it from scope.ts.
export { likePatternToRegExp };

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
	if (!scope) return undefined;
	const key = behaviorOf(scope).fold(name);
	for (let s: Scope | undefined = scope; s; s = s.parent) {
		const hit = s.ctes.get(key);
		if (hit) return hit;
	}
	return undefined;
}

/** A source is referenced by its alias, or (for a table) its last name part — FOLDED with the
 *  dialect's identifier rules (so Databricks `U.col` binds to a source aliased `u`, Snowflake
 *  `o.col` binds to `"O"` but not `"o"`). Aliases fold as "other"; a table's own name part folds
 *  as kind "table" (BigQuery preserves table case). */
function sourceKey(source: Source, dialect: string, isCte = false): string {
	const b = resolveBehavior(dialect);
	if (source.kind === "lateral") return b.fold(source.alias ?? "");
	if (source.kind === "graphtable") {
		return source.alias
			? b.fold(source.alias)
			: b.fold(source.graph[source.graph.length - 1] ?? "graph_table", "table");
	}
	if (source.alias) return b.fold(source.alias);
	if (source.kind === "table") {
		// The binding key is the folded OWN name. For real table identifiers relation.key's last
		// part already IS that fold; a CTE reference re-folds with the column-class ("other") fold
		// (the one place the two folds differ is BigQuery's case-preserving table identifiers).
		// A CTE reference is single-part (the lookup guard), so relation.fqn IS its raw
		// delimiter-intact text — fold that, not the stripped display name, or a quoted reference's
		// quoting semantics would be lost.
		return isCte
			? b.fold(source.relation.fqn, "other")
			: (source.relation.key[source.relation.key.length - 1] ?? "");
	}
	return "";
}

/** The columns a resolved source exposes, or "unknown" when it needs a schema (a bare table).
 *  Exported for the unified binder's schema-free path (src/sema/resolve.ts). */
export function sourceOutputs(src: ResolvedSource, dialect: string): string[] | "unknown" {
	if (src.kind === "table") return src.source.columnAliases ?? "unknown";
	if (src.kind === "cte") return src.ref.scope.outputs;
	if (src.kind === "lateral") return src.source.columns;
	if (src.kind === "relation") return src.scope.outputs; // a prior pipe stage's relation
	if (src.kind === "graphtable") return src.scope.outputs;
	if (src.kind === "pivot") return pivotSourceOutputs(src, (s) => sourceOutputs(s, dialect), dialect);
	return src.scope.outputs; // subquery
}

/** The reshaped columns of an aliased PIVOT/UNPIVOT source: its base columns (via `cols`) with the
 *  pivot/unpivot transform applied. "unknown" if any base relation's columns need a schema we lack.
 *  Shared by the schema-free scope path and the schema-fed qualify / resolve / lineage passes (each
 *  passes its own column resolver), so an aliased pivot exposes the same reshaped set everywhere. */
export function pivotSourceOutputs(
	src: Extract<ResolvedSource, { kind: "pivot" }>,
	cols: (s: ResolvedSource) => string[] | "unknown",
	dialect: string | undefined,
): string[] | "unknown" {
	const parts = src.base.map(cols);
	if (parts.some((p) => p === "unknown")) return "unknown";
	const base = (parts as string[][]).flat();
	if (src.pivot) return applyPivotCols(base, src.pivot, dialect);
	if (src.unpivot) return applyUnpivotCols(base, src.unpivot, dialect);
	return "unknown";
}
