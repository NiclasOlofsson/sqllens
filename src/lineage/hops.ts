import { debugRethrow } from "../debug.js";
import { behaviorOf } from "../dialect-behavior/carrier.js";
import { resolveBehavior } from "../dialect-behavior/registry.js";
import type { Expr, Projection } from "../ir/ir.js";
import { OPEN_PROVIDER } from "../qualify/template-provider.js";
import type { SchemaProvider } from "../qualify/schema-provider.js";
import { nodeAt } from "../document/node-at.js";
import { findProducerProjection, resolveColumnSource } from "../sema/resolve.js";
import type { ResolvedSource, Scope, ScopeTree } from "../scope/scope.js";
import { columnOrigins, originsOf, type Origin } from "./lineage.js";

// ---------------------------------------------------------------------------
// Per-hop lineage — a traversal-order SPINE of references into the frozen IR /
// scope tree. NOT a parallel node graph:
// every hop points at the pre-existing, span-carrying Projection / Expr / Scope the
// walk visits, so navigation is span-jumping and nothing is kept in sync. It rides
// the SAME shared binder as the flat origin walk (resolveColumnSource +
// findProducerProjection + columnOrigins in lineage.ts), so the two cannot drift.
//
// Locked decisions (from the spec):
//   - Hops are references, never copies. It is a DAG: a producer reached by two paths
//     is ONE shared hop object (memoized per lineageOf call), `downstream` fans out.
//   - Two modes, one walk: `schema` optional. Schema-free resolution is within-query
//     (what resolveScopes already binds); a schema disambiguates unqualified columns
//     over a multi-table FROM, expands `*`, and confirms base-table columns.
//   - `unresolved` is a value, not a guess (never-wrong applied to lineage).
//   - Set-ops are the fork point: there is NO hop at the set-op node itself. The ref
//     into a union-sourced relation fans to one hop PER LEG, each carrying that leg's
//     own projection/expr in that leg's scope. Column matching is positional for plain
//     UNION/EXCEPT/INTERSECT, by-name for the BY NAME / CORRESPONDING variants.
//     INTERSECT/EXCEPT attribute BOTH legs. A recursive leg stops at the cycle guard
//     with an `"unresolved"` terminal, never an infinite spine.
//   - Base tables are TERMINALS (an Origin[]), never hops — a base table has no
//     projection to fill {scope, projection, expr}, so representing one as a hop would
//     fabricate a node the spec forbids.
//
// GRAPH-FACTORABLE SEAM (WAVE-START commitment): the walk emits (node, edge) pairs as
// `Contribution`s from `followColumn`, which the spine builder (`buildHop` /
// `followExprRefs`) consumes into `downstream` + `terminal`. A later public `columnGraph`
// reuses THIS emitter — see the `followColumn` attachment-point comment below. No public
// graph API this wave; the emitter boundary is the only seam.
// ---------------------------------------------------------------------------

export interface LineageHop {
	/** The frame (CTE / subquery / leg / main) this hop lives in — a pre-existing Scope object. */
	scope: Scope;
	/** The projection that produced the column here — its `cst` + Task-5 `aliasCst` spans. Absent
	 *  only when the hop anchors a raw column ref that has no producing projection (a WHERE/ON ref
	 *  landing directly on a base table or a set-op fork); the spec forbids fabricating one. */
	projection?: Projection;
	/** The producing expression — its `cst` span (the panel slices the source text itself). */
	expr: Expr;
	/** The hops feeding this one, toward the base tables; `[]` at a terminal. Deduped by object
	 *  identity — a producer reached twice is the SAME object appearing once (DAG). */
	downstream: LineageHop[];
	/** Base-table leaves this hop's expression reads DIRECTLY, or an honest dead end. Set to the
	 *  Origin[] when the expression's refs land on base tables; `"unresolved"` when nothing could be
	 *  bound (ambiguity, no schema, lateral/TVF, or a cycle-guarded recursive leg). A hop may carry
	 *  BOTH `downstream` (derived refs) and a `terminal` Origin[] (base-table refs) — an honest
	 *  mixed expression. Absent when every ref flows through `downstream`. */
	terminal?: Origin[] | "unresolved";
	/** ITEM 12/13 (flow view): the ordered scopes the walk COLLAPSED (pure-rename passthroughs) or
	 *  DESCENDED (star / bare-source resolution) through while following this hop's refs to its
	 *  `downstream`/`terminal` — consumer-side first, identity-deduped (by scope) in first-traversal
	 *  order, ABSENT when nothing was collapsed. Each step is TAGGED with WHY it was traversed
	 *  (ITEM 13): `"rename"` = an explicitly-written passthrough (fully trustworthy), `"expand"` =
	 *  a `SELECT *` / bare-source descent (schema-inferred — trust equals schema trust). Metadata
	 *  only: no fabricated hops; a terminal's trail is its carrying hop's `via`. Deferred flat-walk
	 *  paths (lateral/pivot/pipe) record no trail — absent means "not recorded on this edge". */
	via?: readonly ViaStep[];
}

/** One step of a hop's `via` trail (ITEM 13). `kind` distinguishes a written rename-collapse from a
 *  schema-inferred star/bare-source descent — the panel's DIRECT-vs-INDIRECT trust distinction. */
export interface ViaStep {
	scope: Scope;
	kind: "rename" | "expand";
}

// A (node, edge) pair the emitter yields for one resolved reference — the graph-factorable unit.
type Contribution = ({ kind: "hop"; hop: LineageHop } | { kind: "origin"; origin: Origin } | { kind: "unresolved" }) & {
	/** The collapse/descent trail this contribution travelled (ITEM 12/13) — absent when direct. */
	via?: ViaStep[];
};

/** Per-invocation state: `memo` gives the DAG (shared hops); `seen` is the recursive-CTE cycle
 *  guard (scopes currently being expanded). Fresh per lineageOf/lineageAt call. */
interface Walk {
	schema: SchemaProvider;
	memo: Map<Projection, LineageHop>;
	seen: Set<Scope>;
	/** Folded names of the CTEs currently being expanded. A recursive CTE's self-reference resolves
	 *  in the scope tree as a plain TABLE (scope.ts registers a CTE only AFTER building its own body),
	 *  so the `seen` scope guard never fires on it — this catches the cycle by name instead. */
	activeCtes: Set<string>;
}

function newWalk(schema: SchemaProvider | undefined): Walk {
	return { schema: schema ?? OPEN_PROVIDER, memo: new Map(), seen: new Set(), activeCtes: new Set() };
}

// ---------------------------------------------------------------------------
// Public entries.
// ---------------------------------------------------------------------------

/** Cursor-anchored: the hop map for the column reference (or projection/alias) under `offset`,
 *  ANYWHERE in the tree. Returns undefined off a resolvable column/projection (a keyword, an
 *  operator, whitespace). Total: never throws. V1 domain — column refs, projections, aliases. */
export function lineageAt(scopes: ScopeTree, offset: number, schema?: SchemaProvider): LineageHop | undefined {
	try {
		const hit = nodeAt(scopes, offset);
		if (hit && hit.expr.kind === "column") {
			const proj = enclosingProjection(hit.scope, hit.expr);
			return headFromColumnRef(hit.scope, hit.expr, proj, newWalk(schema));
		}
		// Cursor on a projection's ALIAS identifier (no Expr covers the alias token) → that projection.
		const alias = projectionAtAlias(scopes.root, offset);
		if (alias) return lineageOf(alias.projection, alias.scope, schema);
		return undefined;
	} catch (e) {
		debugRethrow(e);
		return undefined; // total
	}
}

/** Programmatic: the hop map for any column-ref Expr or Projection node, evaluated in `scope`. */
export function lineageOf(node: Expr | Projection, scope: Scope, schema?: SchemaProvider): LineageHop {
	const walk = newWalk(schema);
	if (isProjection(node)) {
		// A bare passthrough projection follows into its producer (the head IS that producer);
		// a computed projection is its own hop.
		if (node.expr.kind === "column") return headFromColumnRef(scope, node.expr, node, walk);
		return buildHop(scope, node, walk);
	}
	if (node.kind === "column") return headFromColumnRef(scope, node, enclosingProjection(scope, node), walk);
	// Any other expression node handed in programmatically — a hop anchored on it, refs followed.
	return anchorHop(scope, undefined, node, followExprRefs(scope, node, walk));
}

function isProjection(node: Expr | Projection): node is Projection {
	return "isStar" in node && "expr" in node;
}

// ---------------------------------------------------------------------------
// The head: follow the entry column ref to its producer, collapsing pure passthroughs.
// ---------------------------------------------------------------------------

/** Follow a column ref to the spine head. When it flows through passthroughs to a SINGLE producer
 *  hop, that producer IS the head (the outer passthrough collapses — the canonical `SELECT z FROM b`
 *  yields b's `y*2` hop). When it forks (set-op), lands on a base table, or is unresolved, the head
 *  anchors at the enclosing projection / raw ref, fanning `downstream` / carrying `terminal`. */
function headFromColumnRef(scope: Scope, colExpr: Expr, enclosing: Projection | undefined, walk: Walk): LineageHop {
	const contribs = followColumn(scope, columnParts(colExpr), walk);
	const { hops, origins, unresolved, via } = partition(contribs, scope.dialect);
	// Collapse: a single producer with no base-table leaf and no dead end IS the head. A trail
	// crossed on the way (a rename fronting a computed producer) rides that hop — consumer-side,
	// merged in first-traversal order (the head IS the consumer boundary here).
	if (hops.length === 1 && origins.length === 0 && !unresolved) {
		if (via.length) mergeVia(hops[0], via);
		return hops[0];
	}
	return anchorHop(scope, enclosing, colExpr, {
		downstream: hops,
		terminal: terminalOf(origins, unresolved, hops.length),
		via,
	});
}

/** Assemble a hop anchored on a raw expr (not collapsed into a producer). */
function anchorHop(
	scope: Scope,
	projection: Projection | undefined,
	expr: Expr,
	feed: { downstream: LineageHop[]; terminal?: Origin[] | "unresolved"; via?: ViaStep[] },
): LineageHop {
	const hop: LineageHop = { scope, expr, downstream: feed.downstream };
	if (projection) hop.projection = projection;
	if (feed.terminal !== undefined) hop.terminal = feed.terminal;
	if (feed.via?.length) hop.via = feed.via;
	return hop;
}

// ---------------------------------------------------------------------------
// buildHop — a producer projection becomes a hop; its expr's refs become downstream.
// ---------------------------------------------------------------------------

function buildHop(scope: Scope, projection: Projection, walk: Walk): LineageHop {
	const cached = walk.memo.get(projection);
	if (cached) return cached; // DAG: the same producer is one shared object
	const hop: LineageHop = { scope, projection, expr: projection.expr, downstream: [] };
	walk.memo.set(projection, hop); // publish before recursing (diamonds converge on it)
	const feed = followExprRefs(scope, projection.expr, walk);
	hop.downstream = feed.downstream;
	if (feed.terminal !== undefined) hop.terminal = feed.terminal;
	if (feed.via?.length) hop.via = feed.via;
	return hop;
}

/** Walk an expression's directly-owned leaves: each column ref is followed to its producer(s);
 *  each scalar/EXISTS subquery contributes its output column's base-table origins (the shared flat
 *  walk, so hops and origins agree on subquery provenance). Returns the hop's downstream + terminal. */
function followExprRefs(
	scope: Scope,
	expr: Expr,
	walk: Walk,
): { downstream: LineageHop[]; terminal?: Origin[] | "unresolved"; via?: ViaStep[] } {
	const leaves = exprLeaves(expr);
	const contribs: Contribution[] = [];
	for (const col of leaves.columns) contribs.push(...followColumn(scope, col, walk));
	for (const sub of leaves.subqueries)
		for (const o of originsOfSubquery(sub, scope, walk.schema)) contribs.push({ kind: "origin", origin: o });
	const { hops, origins, unresolved, via } = partition(contribs, scope.dialect);
	return { downstream: hops, terminal: terminalOf(origins, unresolved, hops.length), via };
}

// ---------------------------------------------------------------------------
// followColumn — the graph-factorable EMITTER. Resolves one column reference and yields the
// (node, edge) Contributions for it. THIS is the seam a future public `columnGraph` reuses: it
// alone knows how a ref maps to producer hops / base-table origins / a set-op fork / unresolved.
// The spine builder above consumes the Contributions; a graph builder would consume the same
// stream into nodes+edges. Passthrough producers collapse (a pure rename is no transformation);
// set-op legs never collapse (each leg's own projection is the point of the fork).
// ---------------------------------------------------------------------------

function followColumn(scope: Scope, parts: string[], walk: Walk, trail: ViaStep[] = []): Contribution[] {
	const via = trail.length ? [...trail] : undefined;
	const binding = resolveColumnSource(scope, parts, walk.schema);
	if (!binding) return [{ kind: "unresolved", via }];
	const { source, column } = binding;
	if (source.kind === "table") {
		// A recursive CTE's self-reference is a plain table here (see Walk.activeCtes) — cycle-guard
		// it. activeCtes keys are the DEFAULT ("other") fold of the declared raw name, so fold the
		// self-reference's raw text the same way (single-part ⇒ relation.fqn IS the raw text).
		if (source.name.length === 1 && walk.activeCtes.has(behaviorOf(scope).fold(source.source.relation.fqn))) {
			return [{ kind: "unresolved", via }];
		}
		// Origins are DISPLAY-facing: the as-written parts, never the folded key.
		return [{ kind: "origin", origin: { table: source.source.relation.parts, column }, via }];
	}

	const child = childScopeOf(source);
	if (!child) {
		// lateral / pivot — no hop model here; defer to the shared flat origin walk (never-wrong).
		// The flat walk records no trail of its own; the trail crossed SO FAR still rides (ITEM 12).
		return originsToContribs(columnOrigins(source, column, walk.schema, new Set()), via);
	}
	if (walk.seen.has(child)) return [{ kind: "unresolved", via }]; // recursive-CTE cycle guard

	const cteName = source.kind === "cte" ? behaviorOf(scope).fold(source.ref.def.name) : undefined;
	walk.seen.add(child);
	if (cteName) walk.activeCtes.add(cteName);
	try {
		if (child.body.kind === "setop") return forkLegs(child, column, aliasesOf(source), scope.dialect, walk, trail);
		if (child.body.kind === "pipe" || child.pipeStage) {
			// A pipe-bodied relation has no plain projection list — defer to the shared origin walk.
			return originsToContribs(columnOrigins(source, column, walk.schema, new Set()), via);
		}
		// A plain select relation: find the projection producing `column`.
		const producer = findProducerProjection(child.body.projections, column, aliasesOf(source), child.dialect);
		if (producer && !producer.isStar) {
			// Collapse: a pure rename is no transformation — the traversed scope joins the trail as a
			// trustworthy "rename" step (ITEM 12/13).
			if (producer.expr.kind === "column")
				return followColumn(child, columnParts(producer.expr), walk, [
					...trail,
					{ scope: child, kind: "rename" },
				]);
			return [{ kind: "hop", hop: buildHop(child, producer, walk), via }];
		}
		// A `*` / bare source: a schema-inferred descent — the scope joins the trail as an "expand"
		// step (ITEM 13: trust equals schema trust, rendered distinctly from a written rename).
		return followColumn(child, [column], walk, [...trail, { scope: child, kind: "expand" }]);
	} finally {
		walk.seen.delete(child);
		if (cteName) walk.activeCtes.delete(cteName);
	}
}

/** Fan a union-sourced column to one hop per leg (spec: no hop at the set-op node). Legs are matched
 *  positionally, or by name for BY NAME / CORRESPONDING; nested set-ops fold left. A leg keeps its
 *  own hop even when its producer is a bare passthrough (that IS the point of the fork). */
function forkLegs(
	setopScope: Scope,
	column: string,
	aliases: string[] | undefined,
	dialect: string,
	walk: Walk,
	trail: ViaStep[] = [],
): Contribution[] {
	const legs = setopLegScopes(setopScope);
	const byName = setopScope.body.kind === "setop" ? !!setopScope.body.byName : false;
	const idx = columnIndex(setopScope, column, aliases, dialect);
	const via = trail.length ? [...trail] : undefined;
	const out: Contribution[] = [];
	for (const leg of legs) {
		const producer = legProducer(leg, column, idx, byName, dialect);
		if (producer && !producer.isStar) out.push({ kind: "hop", hop: buildHop(leg, producer, walk), via });
		else out.push(...followColumn(leg, [column], walk, trail)); // star / missing leg → resolve fresh
	}
	return out;
}

/** The position of `column` in a set-op's output: via declared CTE aliases if given, else the set-op's
 *  own output names (the left branch's, positionally). -1 when not determinable (falls back to name). */
function columnIndex(setopScope: Scope, column: string, aliases: string[] | undefined, dialect: string): number {
	const bh = resolveBehavior(dialect);
	const want = bh.fold(column);
	if (aliases) return aliases.findIndex((a) => bh.fold(a) === want);
	const outs = setopScope.outputs;
	return outs !== "unknown" ? outs.findIndex((o) => bh.fold(o) === want) : -1;
}

/** The projection producing `column` in one set-op leg — by name for BY NAME, else by position with a
 *  name fallback (positional legs can differ in column name: `SELECT a AS x … UNION SELECT b …`). */
function legProducer(
	leg: Scope,
	column: string,
	idx: number,
	byName: boolean,
	dialect: string,
): Projection | undefined {
	if (leg.body.kind !== "select") return undefined;
	const projs = leg.body.projections;
	const bh = resolveBehavior(dialect);
	const wantName = bh.fold(column);
	const byNameHit = (): Projection | undefined =>
		projs.find((p) => !p.isStar && p.name !== undefined && bh.fold(p.name) === wantName);
	if (byName) return byNameHit();
	if (idx >= 0 && idx < projs.length && !projs[idx].isStar) return projs[idx];
	return byNameHit();
}

// ---------------------------------------------------------------------------
// helpers.
// ---------------------------------------------------------------------------

function partition(
	contribs: Contribution[],
	dialect: string,
): { hops: LineageHop[]; origins: Origin[]; unresolved: boolean; via: ViaStep[] } {
	const hops: LineageHop[] = [];
	const origins: Origin[] = [];
	const via: ViaStep[] = [];
	let unresolved = false;
	for (const c of contribs) {
		if (c.kind === "hop") {
			if (!hops.includes(c.hop)) hops.push(c.hop); // dedup by identity (DAG)
		} else if (c.kind === "origin") origins.push(c.origin);
		else unresolved = true;
		if (c.via) for (const st of c.via) pushVia(via, st); // first-traversal order, dedup by scope
	}
	return { hops, origins: dedupOrigins(origins, dialect), unresolved, via };
}

/** Append a via step, deduping by SCOPE identity (a scope traversed twice keeps its first-seen kind
 *  — a rename and a later star through the same scope cannot both happen, so first-seen is stable). */
function pushVia(into: ViaStep[], step: ViaStep): void {
	if (!into.some((s) => s.scope === step.scope)) into.push(step);
}

/** Merge a trail into an existing hop (the head-collapse consumer boundary) — ordered union. */
function mergeVia(hop: LineageHop, steps: ViaStep[]): void {
	const merged: ViaStep[] = [...(hop.via ?? [])];
	for (const st of steps) pushVia(merged, st);
	hop.via = merged;
}

/** The `terminal` field: base-table origins win when present; else a dead end is "unresolved" ONLY
 *  when there is no downstream to carry the flow (an unresolved ref within a mixed expression is not
 *  claimed — never-wrong: we neither invent an origin nor mask that a downstream path exists). */
function terminalOf(
	origins: Origin[],
	unresolved: boolean,
	downstreamCount: number,
): Origin[] | "unresolved" | undefined {
	if (origins.length > 0) return origins;
	if (unresolved && downstreamCount === 0) return "unresolved";
	return undefined;
}

function originsToContribs(origins: Origin[], via?: ViaStep[]): Contribution[] {
	return origins.length
		? origins.map((origin) => ({ kind: "origin", origin, via }) as Contribution)
		: [{ kind: "unresolved", via }];
}

function columnParts(expr: Expr): string[] {
	return expr.kind === "column" ? expr.parts : [];
}

function childScopeOf(src: ResolvedSource): Scope | undefined {
	if (src.kind === "cte") return src.ref.scope;
	if (src.kind === "subquery") return src.scope;
	if (src.kind === "relation") return src.scope;
	if (src.kind === "graphtable") return src.scope;
	return undefined; // table / lateral / pivot
}

function aliasesOf(src: ResolvedSource): string[] | undefined {
	if (src.kind === "cte") return src.ref.def.columnAliases;
	if (src.kind === "subquery") return src.source.columnAliases;
	return undefined;
}

/** Flatten a set-op scope into its leaf branch scopes (nested `a UNION b UNION c` folds left). */
function setopLegScopes(scope: Scope): Scope[] {
	if (scope.body.kind === "setop" && scope.branches) {
		return [...setopLegScopes(scope.branches.left), ...setopLegScopes(scope.branches.right)];
	}
	return [scope];
}

/** The projection whose expression subtree contains `target` (by object identity), in a select or
 *  pipe-stage scope — the enclosing projection of a projected column ref. undefined for a ref that
 *  lives in WHERE / JOIN ON / GROUP BY (no producing projection at this level). */
function enclosingProjection(scope: Scope, target: Expr): Projection | undefined {
	const projs = projectionsOf(scope);
	for (const p of projs) if (exprContains(p.expr, target)) return p;
	return undefined;
}

function projectionsOf(scope: Scope): Projection[] {
	const body = scope.body;
	if (body.kind === "select") return body.projections;
	if (scope.pipeStage) {
		const s = scope.pipeStage;
		if (s.op === "select" || s.op === "extend" || s.op === "window") return s.projections;
		if (s.op === "aggregate") return s.aggregates;
	}
	return [];
}

function exprContains(expr: Expr, target: Expr): boolean {
	if (expr === target) return true;
	for (const c of childExprs(expr)) if (exprContains(c, target)) return true;
	return false;
}

/** A projection whose ALIAS identifier span covers `offset` (a cursor on the alias, which no Expr
 *  covers), paired with its scope. Scans select + pipe-stage scopes across the tree. */
function projectionAtAlias(root: Scope, offset: number): { scope: Scope; projection: Projection } | undefined {
	let best: { scope: Scope; projection: Projection } | undefined;
	let bestLen = Number.MAX_SAFE_INTEGER;
	const visit = (scope: Scope): void => {
		for (const p of projectionsOf(scope)) {
			const c = p.aliasCst;
			const from = c?.start?.start;
			const to = c?.stop?.stop;
			if (from === undefined || to === undefined || offset < from || offset > to) continue;
			if (to - from < bestLen) {
				bestLen = to - from;
				best = { scope, projection: p };
			}
		}
		for (const child of scope.children) visit(child);
	};
	visit(root);
	return best;
}

/** Origins of a scalar / EXISTS subquery's value column — the shared flat walk (originsOf already
 *  descends subquery/exists), so the hop walk and the origin walk agree on subquery provenance. */
function originsOfSubquery(sub: Expr, scope: Scope, schema: SchemaProvider): Origin[] {
	return originsOf(sub, scope, schema);
}

// ── expression leaf collection ──────────────────────────────────────────────

/** Direct column refs + scalar/EXISTS subqueries of an expression (NOT descending into a subquery's
 *  own body — that opens a child scope the origin walk handles). Mirrors lineage.ts exprOrigins so
 *  both walks see the same leaves. */
function exprLeaves(expr: Expr): { columns: string[][]; subqueries: Expr[] } {
	const columns: string[][] = [];
	const subqueries: Expr[] = [];
	const visit = (e: Expr): void => {
		switch (e.kind) {
			case "column":
				columns.push(e.parts);
				break;
			case "subquery":
			case "exists":
				subqueries.push(e);
				break;
			default:
				for (const c of childExprs(e)) visit(c);
		}
	};
	visit(expr);
	return { columns, subqueries };
}

/** Sub-expressions reachable WITHOUT crossing a scope boundary (no subquery/exists descent) —
 *  the same traversal node-at uses, kept local to avoid a cross-module dependency on it. */
function childExprs(expr: Expr): Expr[] {
	switch (expr.kind) {
		case "binary":
			return [expr.left, expr.right];
		case "unary":
			return [expr.operand];
		case "cast":
			return [expr.expr];
		case "function":
			return [...expr.args, ...(expr.window ? [...expr.window.partitionBy, ...expr.window.orderBy] : [])];
		case "case":
			return [...expr.whens.flatMap((w) => [w.when, w.then]), ...(expr.elseExpr ? [expr.elseExpr] : [])];
		case "predicate":
			return [expr.operand, ...expr.args];
		case "lambda":
			return [expr.body];
		case "subscript":
			return [
				expr.base,
				...(expr.index ? [expr.index] : []),
				...(expr.end ? [expr.end] : []),
				...(expr.step ? [expr.step] : []),
			];
		case "with":
			return [...expr.bindings.map((b) => b.value), expr.result];
		case "star":
			return expr.replace?.map((r) => r.expr) ?? [];
		default:
			return []; // column / literal / parameter / variable / subquery / exists / other: leaves here
	}
}

function dedupOrigins(origins: Origin[], dialect: string): Origin[] {
	const b = resolveBehavior(dialect);
	const by = new Map<string, Origin>();
	for (const o of origins) by.set(`${b.foldTableName(o.table).join(".")}.${b.fold(o.column)}`, o);
	return [...by.values()];
}
