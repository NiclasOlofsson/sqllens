import type { ParserRuleContext } from "antlr4ng";
import { behaviorOf } from "../dialect-behavior/carrier.js";
import { resolveBehavior } from "../dialect-behavior/registry.js";
import type { Expr, PartSpan, Projection, QueryBody, VariableDecl } from "../ir/ir.js";
import { starSpanOf } from "../ir/part-span.js";
import { endPosition } from "../ir/span.js";
import { inferType } from "../infer/infer.js";
import type { Type } from "../infer/types.js";
import { originsOf, type Origin } from "../lineage/lineage.js";
import { OPEN_PROVIDER } from "../qualify/template-provider.js";
import type { SchemaProvider } from "../qualify/schema-provider.js";
import {
	rootDeclarations,
	type ColumnResolution,
	type CteRef,
	type ResolvedSource,
	type Scope,
	type ScopeTree,
} from "../scope/scope.js";
import { resolveColumnRef } from "../sema/resolve.js";

// ---------------------------------------------------------------------------
// Symbols — a SQL-native symbol model derived from the scope tree (and, later,
// the IR's expression trees). Each symbol is a (kind × modifiers) classification
// of a named thing, with a source span and the frame (CTE / main query) it lives
// in. The model is dialect-agnostic: it is defined over relational concepts, so
// each dialect's lowering feeds the same symbols. Consumers: editor (project to
// LSP DocumentSymbol / SemanticTokens) and the SQL debugger (frames + spans).
//
// This first slice covers RELATION symbols (table / view / CTE / subquery /
// lateral, as declarations and references). Column symbols (with provenance) and
// the expression-level symbols build on top of this.
// ---------------------------------------------------------------------------

// The symbol model is the graph of NAMED relational entities. Token-level concerns
// (literals, keyword highlighting) belong to a separate SemanticTokens projection, not here;
// `view` would need a catalog we don't have, so it isn't a kind.
export type SymbolKind =
	// relations
	| "table"
	| "cte"
	| "subquery"
	| "lateral"
	// within a relation / expression
	| "column"
	| "alias"
	| "function"
	// a caller-bound placeholder (`?`, `:name`, `$1`, BigQuery `@name`) and a session/local
	// variable reference (`@x`, `@@sysvar`); see ir.ts's `parameter`/`variable` Expr kinds.
	| "parameter"
	| "variable";

export type SymbolModifier = "declaration" | "reference" | "output" | "aggregate" | "window" | "correlated" | "star";

/** Resolves a star projection to its expanded `{name, sourceKey}` pairs (star modifiers already
 *  applied), or `undefined` when unresolvable — the same shape as `Qualification.expandStarOf`.
 *  `deriveSymbols` takes this as a plain function rather than a `Qualification` so it stays free
 *  of a dependency on `qualify.ts` (it shares only the low-level `resolveColumnRef` primitive). */
export type StarExpansion = (scope: Scope, projection: Projection) => { name: string; sourceKey: string }[] | undefined;

export interface Span {
	/** Absolute 0-based char offset, inclusive start. */
	start: number;
	/** Absolute 0-based char offset, EXCLUSIVE end — text.slice(start, end) is the spanned text. */
	end: number;
	line: number;
	column: number;
	endLine: number;
	endColumn: number;
}

export interface Sym {
	kind: SymbolKind;
	modifiers: SymbolModifier[];
	/** The name as it identifies the thing (a table's name, a CTE's name, an alias). */
	name: string;
	span: Span;
	/** The frame the symbol lives in: a CTE's name, a subquery alias, or "_main_". */
	frame: string;
	/** For a relation-kind Sym (table/cte/subquery/lateral), its alias declaration — the SAME value
	 *  the separate alias-kind Sym below carries, attached here directly so a consumer doesn't need
	 *  array-adjacency (an implementation detail, not a contract) to find "this table's alias".
	 *  Absent when the source has no explicit alias. */
	alias?: { name: string; span: Span };
	/** For a reference, the span of the in-query declaration it resolves to (a CTE, or the
	 *  projection in a CTE/subquery that produces a column). Absent for a catalog table/column
	 *  whose declaration is not in the query — go-to-definition there needs the catalog. */
	definition?: Span;
	/** For a column or function symbol, its inferred type — when determinable (needs the schema
	 *  for base-table columns). `unknown`/absent when there is no schema or no rule. */
	type?: Type;
	/** For a column symbol, the base-table columns it derives from (lineage). Absent when it
	 *  traces to nothing resolvable (a pure literal, or an unresolved column). */
	origins?: Origin[];
	/** For a column REFERENCE symbol, the per-part source spans PARALLEL to a dotted `name`
	 *  (`o.order_id` → one span for `o`, one for `order_id`) — lets a consumer hit-test the cursor
	 *  on the qualifier vs the column. Copied from the `ColumnRef.partSpans`; absent (all-or-nothing)
	 *  when any part was synthesized. See src/ir/part-span.ts. */
	partSpans?: PartSpan[];
	/** For a column REFERENCE symbol resolved to a visible source, the relation-kind Sym it's bound
	 *  to (table/cte/subquery/lateral) — mirrors `Qualification.bindingOf`'s resolution, object-
	 *  identical to the Sym already emitted for that source (no separate id scheme needed). Absent
	 *  when unresolved, ambiguous, or the reference doesn't bind to any source. */
	source?: Sym;
	/** The IR node this Sym describes, when one exists: the ColumnRef for a column
	 *  reference, the Projection for an output declaration, the TableSource for a
	 *  relation. Absent for synthesized Syms (schema-expanded star columns). */
	node?: object;
}

/** The main query's frame label (no enclosing CTE / subquery). */
export const MAIN_FRAME = "_main_";

/** The frame-naming rules for a construct that opens its own frame, SHARED between `walk` (which
 *  emits Syms alongside) and `frameLabels` (below), so a CTE / subquery / graph-table can never be
 *  named two different things by the two passes. */
function cteFrameLabel(scope: Scope, cteRef: CteRef): string {
	return behaviorOf(scope).displayName(cteRef.def.name);
}
function subqueryFrameLabel(scope: Scope, src: Extract<ResolvedSource, { kind: "subquery" }>): string {
	return src.source.alias ? behaviorOf(scope).displayName(src.source.alias) : "_subquery_";
}
function graphtableFrameLabel(src: Extract<ResolvedSource, { kind: "graphtable" }>): string {
	return src.source.alias ?? src.source.graph.join(".");
}

/** Map every Scope reachable from `tree.root` to the SAME frame label `deriveSymbols`' own `walk`
 *  assigns it: `MAIN_FRAME` for the root, a CTE's display name, a subquery's alias / `_subquery_`, a
 *  graph table's alias / dotted path, `_sub_` for every other nested scope (expression subqueries, a
 *  routine's inner statements). Shares the per-construct NAMING helpers above with `walk`, so the two
 *  can't independently invent different names for the same construct; the surrounding which-scopes-
 *  recurse shape (ctes / branches / pipe / sources / children) mirrors `walk`'s own traversal (a new
 *  scope-opening construct added to `walk` needs the same addition here). `src/scope/frame.ts`'s
 *  `frameAt` builds on this map, so it and `deriveSymbols`/`unionSymbols` agree on a scope's frame BY
 *  CONSTRUCTION (same naming helpers), not by coincidence. */
export function frameLabels(tree: ScopeTree): Map<Scope, string> {
	const out = new Map<Scope, string>();
	labelScope(tree.root, MAIN_FRAME, out);
	return out;
}

function labelScope(scope: Scope, frame: string, out: Map<Scope, string>): void {
	out.set(scope, frame);
	const walked = new Set<Scope>();
	for (const [, cteRef] of scope.ctes) {
		labelScope(cteRef.scope, cteFrameLabel(scope, cteRef), out);
		walked.add(cteRef.scope);
	}
	if (scope.branches) {
		labelScope(scope.branches.left, frame, out);
		labelScope(scope.branches.right, frame, out);
		walked.add(scope.branches.left);
		walked.add(scope.branches.right);
	}
	if (scope.body.kind === "pipe" && scope.pipe) {
		labelScope(scope.pipe.input, frame, out);
		walked.add(scope.pipe.input);
		for (const st of scope.pipe.stages) {
			labelScope(st, frame, out);
			walked.add(st);
		}
	}
	for (const src of scope.sources.values()) {
		if (src.kind === "subquery") {
			labelScope(src.scope, subqueryFrameLabel(scope, src), out);
			walked.add(src.scope);
		} else if (src.kind === "graphtable") {
			labelScope(src.scope, graphtableFrameLabel(src), out);
			walked.add(src.scope);
		}
	}
	for (const child of scope.children) {
		if (!walked.has(child)) labelScope(child, "_sub_", out);
	}
}

/** Derive the symbol graph. A `schema` lets column/function symbols carry inferred types;
 *  without one (the default), names + spans + frames + definitions are still produced.
 *  `expandStarOf` (typically `Qualification.expandStarOf`) additionally expands a resolvable
 *  `SELECT *`/`t.*` into one extra column Sym per source column, alongside the opaque star Sym
 *  it already emits — absent (the default), stars stay opaque as before. */
export function deriveSymbols(
	tree: ScopeTree,
	schema: SchemaProvider = OPEN_PROVIDER,
	expandStarOf?: StarExpansion,
): Sym[] {
	const out: Sym[] = [];
	const sourceSyms = new Map<ResolvedSource, Sym>();
	walk(tree.root, MAIN_FRAME, out, schema, sourceSyms, expandStarOf);
	return out;
}

/** The narrowest Sym whose span contains `offset` (`span.start <= offset && offset < span.end` —
 *  a zero-width span, e.g. a schema-expanded star column, can never match; that is its designed
 *  contract, not a bug). Candidates are filtered by `pred` first (default: everything). Ties keep
 *  whichever candidate was found first. The shared position→symbol lookup behind hover's symbol
 *  fallback and go-to-definition. */
export function symbolAt(
	syms: readonly Sym[],
	offset: number,
	pred: (s: Sym) => boolean = () => true,
): Sym | undefined {
	let best: Sym | undefined;
	for (const s of syms) {
		if (!pred(s)) continue;
		if (!(s.span.start <= offset && offset < s.span.end)) continue;
		if (!best || s.span.end - s.span.start < best.span.end - best.span.start) best = s;
	}
	return best;
}

function walk(
	scope: Scope,
	frame: string,
	out: Sym[],
	schema: SchemaProvider,
	sourceSyms: Map<ResolvedSource, Sym>,
	expandStarOf: StarExpansion | undefined,
): void {
	const walked = new Set<Scope>();

	// CTE declarations, and each CTE body as its own frame. The map key is the FOLDED identity;
	// the symbol (and frame label) shows the display form of the declared name.
	for (const [, cteRef] of scope.ctes) {
		const name = cteFrameLabel(scope, cteRef);
		out.push({
			kind: "cte",
			modifiers: ["declaration"],
			name,
			span: spanOf(cteRef.def.nameCst ?? cteRef.def.cst),
			frame,
			node: cteRef.def,
		});
		walk(cteRef.scope, name, out, schema, sourceSyms, expandStarOf);
		walked.add(cteRef.scope);
	}
	// Set-op branches share this scope's frame.
	if (scope.branches) {
		walk(scope.branches.left, frame, out, schema, sourceSyms, expandStarOf);
		walk(scope.branches.right, frame, out, schema, sourceSyms, expandStarOf);
		walked.add(scope.branches.left);
		walked.add(scope.branches.right);
	}
	// A pipe's input + stages share this scope's frame — they are this query's stages, not subqueries.
	if (scope.body.kind === "pipe" && scope.pipe) {
		walk(scope.pipe.input, frame, out, schema, sourceSyms, expandStarOf);
		walked.add(scope.pipe.input);
		for (const st of scope.pipe.stages) {
			walk(st, frame, out, schema, sourceSyms, expandStarOf);
			walked.add(st);
		}
	}
	// Source references in this frame, plus any alias declaration; a subquery opens its own frame. The
	// implicit "relation" source of a pipe stage (the incoming relation) has no name — skip it.
	for (const src of scope.sources.values()) {
		if (src.kind === "relation") continue;
		const relSym = relationSymbol(src, frame, scope.dialect);
		sourceSyms.set(src, relSym); // record before recursing — a correlated ref inside sees it
		const alias = aliasSymbol(src, frame, scope.dialect);
		if (alias) relSym.alias = { name: alias.name, span: alias.span };
		out.push(relSym);
		if (alias) out.push(alias);
		if (src.kind === "subquery") {
			walk(src.scope, subqueryFrameLabel(scope, src), out, schema, sourceSyms, expandStarOf);
			walked.add(src.scope);
		} else if (src.kind === "graphtable") {
			walk(src.scope, graphtableFrameLabel(src), out, schema, sourceSyms, expandStarOf);
			walked.add(src.scope);
		}
	}
	// Expression subqueries (scalar / IN / EXISTS) — the remaining children, each its own frame.
	for (const child of scope.children) {
		if (!walked.has(child)) walk(child, "_sub_", out, schema, sourceSyms, expandStarOf);
	}

	emitColumns(scope, frame, out, schema, sourceSyms, expandStarOf);
	emitFunctions(scope, frame, out, schema);
	// THIS scope's own declarations, set by buildQueryScope from its QueryExpr's `declarations` (see
	// Scope.declarations): a top-level DECLARE's own scope, a routine's container scope (its
	// signature parameters), and each of a routine body's inner statement scopes (its own DECLARE,
	// if any), independently. Each declaration gets its own Sym, and its initializer expression (if
	// any) is walked through the SAME visitor emitFunctions uses: a DECLARE's flagged-empty body has
	// no projections/where/etc. of its own, so an initializer's function/parameter/variable
	// references (e.g. `@x` inside `@y`'s `= @x + 1`) would otherwise never be reached.
	if (scope.declarations) {
		for (const decl of scope.declarations) {
			out.push(declarationSym(decl, frame, scope.dialect));
			if (decl.init) visitExprSyms(decl.init, scope, frame, out, schema);
		}
	}
}

/** A declaration Sym for one `VariableDecl` (T-SQL DECLARE). Its type comes from parsing
 *  `typeText` through the dialect's own type parser (the same path a CAST's `typeText` uses):
 *  absent when there's no type text or it doesn't parse to anything determinate, never guessed. */
function declarationSym(decl: VariableDecl, frame: string, dialect: string): Sym {
	return {
		kind: "variable",
		modifiers: ["declaration"],
		name: decl.name,
		span: decl.nameSpan,
		frame,
		type: decl.typeText ? typeOrUndefined(resolveBehavior(dialect).parseType(decl.typeText)) : undefined,
		node: decl,
	};
}

/** Function symbols (with aggregate/window modifiers), and parameter/variable occurrence symbols,
 *  from this frame's expression trees. */
function emitFunctions(scope: Scope, frame: string, out: Sym[], schema: SchemaProvider): void {
	const body = scope.body;
	if (body.kind !== "select") return;
	for (const p of body.projections) visitExprSyms(p.expr, scope, frame, out, schema);
	if (body.where) visitExprSyms(body.where, scope, frame, out, schema);
	for (const j of body.joinConditions ?? []) visitExprSyms(j, scope, frame, out, schema);
	for (const g of body.groupBy ?? []) visitExprSyms(g, scope, frame, out, schema);
	if (body.having) visitExprSyms(body.having, scope, frame, out, schema);
	if (body.qualify) visitExprSyms(body.qualify, scope, frame, out, schema);
}

/** The shared function/parameter/variable expr walk behind `emitFunctions` and the DECLARE
 *  initializer walk above: the two places an expression tree can hold these occurrences. */
function visitExprSyms(e: Expr, scope: Scope, frame: string, out: Sym[], schema: SchemaProvider): void {
	switch (e.kind) {
		case "function":
			out.push({
				kind: "function",
				modifiers: fnModifiers(e),
				name: e.name,
				span: spanOf(e.cst),
				frame,
				type: typeOrUndefined(inferType(e, scope, schema)),
				node: e,
			});
			e.args.forEach((a) => visitExprSyms(a, scope, frame, out, schema));
			e.window?.partitionBy.forEach((a) => visitExprSyms(a, scope, frame, out, schema));
			e.window?.orderBy.forEach((a) => visitExprSyms(a, scope, frame, out, schema));
			break;
		case "parameter":
			// A caller-bound placeholder has no declaration site in the query itself: never linked.
			out.push({
				kind: "parameter",
				modifiers: ["reference"],
				name: e.name ?? e.text,
				span: spanOf(e.cst),
				frame,
				node: e,
			});
			break;
		case "variable": {
			// A session/local variable reference gains `definition`/`type` when EXACTLY ONE
			// candidate DECLARE/parameter of that name is visible (rootDeclarations pools every
			// declaration in the WHOLE tree rooted at this scope's absolute root, e.g. `@x` inside
			// a later declaration's own initializer, or a routine parameter reached from inside its
			// body). 0 or >1 candidates stay unlinked (never-wrong), including a body DECLARE that
			// reuses an outer name, which is now 2 candidates, not a shadow. Cross-STATEMENT
			// linking (an earlier TOP-LEVEL document cell) is the document layer's job (document.ts).
			const decls = rootDeclarations(scope)?.filter((d) => d.name === e.name);
			const decl = decls?.length === 1 ? decls[0] : undefined;
			out.push({
				kind: "variable",
				modifiers: ["reference"],
				name: e.name ?? e.text,
				span: spanOf(e.cst),
				frame,
				definition: decl?.nameSpan,
				type: decl?.typeText
					? typeOrUndefined(resolveBehavior(scope.dialect).parseType(decl.typeText))
					: undefined,
				node: e,
			});
			break;
		}
		case "binary":
			visitExprSyms(e.left, scope, frame, out, schema);
			visitExprSyms(e.right, scope, frame, out, schema);
			break;
		case "unary":
			visitExprSyms(e.operand, scope, frame, out, schema);
			break;
		case "cast":
			visitExprSyms(e.expr, scope, frame, out, schema);
			break;
		case "case":
			e.whens.forEach((w) => {
				visitExprSyms(w.when, scope, frame, out, schema);
				visitExprSyms(w.then, scope, frame, out, schema);
			});
			if (e.elseExpr) visitExprSyms(e.elseExpr, scope, frame, out, schema);
			break;
		case "predicate":
			visitExprSyms(e.operand, scope, frame, out, schema);
			e.args.forEach((a) => visitExprSyms(a, scope, frame, out, schema));
			break;
		case "lambda":
			visitExprSyms(e.body, scope, frame, out, schema);
			break;
		case "subscript":
			visitExprSyms(e.base, scope, frame, out, schema);
			if (e.index) visitExprSyms(e.index, scope, frame, out, schema);
			if (e.end) visitExprSyms(e.end, scope, frame, out, schema);
			if (e.step) visitExprSyms(e.step, scope, frame, out, schema);
			break;
		// column/literal/star → not functions; subquery/exists → their own frames
	}
}

function fnModifiers(e: Extract<Expr, { kind: "function" }>): SymbolModifier[] {
	const m: SymbolModifier[] = [];
	if (e.aggregate) m.push("aggregate");
	if (e.window) m.push("window");
	return m;
}

/** Column references in this frame, plus output declarations for aliased/computed projections. */
function emitColumns(
	scope: Scope,
	frame: string,
	out: Sym[],
	schema: SchemaProvider,
	sourceSyms: Map<ResolvedSource, Sym>,
	expandStarOf: StarExpansion | undefined,
): void {
	const body = scope.body;
	if (body.kind === "select") {
		for (const p of body.projections) {
			if (p.isStar) {
				const q = p.expr.kind === "star" ? p.expr.qualifier : undefined;
				// The star's OWN span — the `*` character itself, never the qualifier or a modifier
				// clause (Sym star-expansion wave rule, sqllens 9c87f55; same starSpanOf document.ts's
				// scopeOutputColumns uses) — falling back to the whole projection's span only in the
				// should-never-happen case a star projection's CST carries no literal `*` token.
				const starSpan = (p.expr.kind === "star" ? starSpanOf(p.expr.cst) : undefined) ?? spanOf(p.cst);
				out.push({
					kind: "column",
					modifiers: ["star"],
					name: q ? `${q.join(".")}.*` : "*",
					span: starSpan,
					frame,
					node: p.expr,
				});
				const pairs = expandStarOf?.(scope, p);
				if (pairs) {
					// No separate source token exists per implied column, so every expanded Sym shares
					// a ZERO-WIDTH span at the star's own start — deliberate (anvil-negotiated): it must
					// never be a cursor hit-test target, only usable for name/source enumeration.
					const point: Span = {
						start: starSpan.start,
						end: starSpan.start,
						line: starSpan.line,
						column: starSpan.column,
						endLine: starSpan.line,
						endColumn: starSpan.column,
					};
					for (const pair of pairs) {
						const resolvedSource = scope.sources.get(pair.sourceKey);
						out.push({
							kind: "column",
							modifiers: ["reference", "star"],
							name: pair.name,
							span: point,
							frame,
							source: resolvedSource ? sourceSyms.get(resolvedSource) : undefined,
						});
					}
				}
				continue;
			}
			// A bare column projection (`a`) is just a reference — the output name echoes the column,
			// so don't double-emit a declaration. An explicit alias or a computed expr does declare.
			if (p.name === undefined) continue;
			const last = p.expr.kind === "column" ? p.expr.parts[p.expr.parts.length - 1] : undefined;
			const echo = last !== undefined && behaviorOf(scope).fold(last) === behaviorOf(scope).fold(p.name);
			if (!echo) {
				out.push({
					kind: "column",
					modifiers: ["declaration", "output"],
					name: behaviorOf(scope).displayName(p.name),
					span: spanOf(p.aliasCst ?? p.cst),
					frame,
					type: typeOrUndefined(inferType(p.expr, scope, schema)),
					origins: originsOrUndefined(originsOf(p.expr, scope, schema)),
					node: p,
				});
			}
		}
	}
	if (body.kind === "pipe") return; // a pipe scope's refs live in its per-stage child scopes
	// `body.columns` is a flat list of ColumnRef COPIES built during lowering (one per dialect's
	// `columnsOf`, keyed by clause) — not the original Expr nodes. This map recovers the original
	// column Expr (object-identical) by its cst, so a REFERENCE Sym can carry the real node it
	// describes; a ref with no match (an ORDER BY key — the IR keeps no Expr tree for those — or one
	// recovered from an unmodelled `other` node) honestly gets no node.
	const columnNodes = columnExprsByCst(body);
	for (const ref of body.columns) {
		const res = resolveColumnRef(scope, ref, schema);
		const modifiers: SymbolModifier[] = ["reference"];
		// A reference that binds to a source outside this scope is correlated.
		if (res.kind === "bound" && !isLocalSource(scope, res.source)) modifiers.push("correlated");
		const colExpr = { kind: "column" as const, parts: ref.parts, cst: ref.cst };
		out.push({
			kind: "column",
			modifiers,
			name: ref.parts.map((p) => behaviorOf(scope).displayName(p)).join("."),
			span: spanOf(ref.cst),
			frame,
			definition: columnDefinition(res),
			type: typeOrUndefined(inferType(colExpr, scope, schema)),
			origins: originsOrUndefined(originsOf(colExpr, scope, schema)),
			partSpans: ref.partSpans,
			source: res.kind === "bound" ? sourceSyms.get(res.source) : undefined,
			node: columnNodes.get(ref.cst),
		});
	}
}

/** Column Expr nodes reachable from a SELECT body's own clauses (projections, WHERE, JOIN ON,
 *  GROUP BY, HAVING, QUALIFY), keyed by cst identity. Mirrors each dialect's lower.ts `columnsOf`
 *  traversal so `emitColumns` can map a `body.columns` ColumnRef back to the original Expr node.
 *  Empty for a non-select body (a set-op's own `columns` carry no retained Expr tree to recover). */
function columnExprsByCst(body: QueryBody): Map<ParserRuleContext, Extract<Expr, { kind: "column" }>> {
	const map = new Map<ParserRuleContext, Extract<Expr, { kind: "column" }>>();
	if (body.kind !== "select") return map;
	const visit = (e: Expr): void => {
		switch (e.kind) {
			case "column":
				map.set(e.cst, e);
				break;
			case "binary":
				visit(e.left);
				visit(e.right);
				break;
			case "unary":
				visit(e.operand);
				break;
			case "cast":
				visit(e.expr);
				break;
			case "function":
				e.args.forEach(visit);
				e.window?.partitionBy.forEach(visit);
				e.window?.orderBy.forEach(visit);
				break;
			case "case":
				e.whens.forEach((w) => {
					visit(w.when);
					visit(w.then);
				});
				if (e.elseExpr) visit(e.elseExpr);
				break;
			case "predicate":
				visit(e.operand);
				e.args.forEach(visit);
				break;
			case "lambda":
				visit(e.body);
				break;
			case "subscript":
				visit(e.base);
				if (e.index) visit(e.index);
				if (e.end) visit(e.end);
				if (e.step) visit(e.step);
				break;
			// literal/star/subquery/exists/with/parameter/variable/other → no further column refs modelled here
		}
	};
	for (const p of body.projections) visit(p.expr);
	if (body.where) visit(body.where);
	for (const j of body.joinConditions ?? []) visit(j);
	for (const g of body.groupBy ?? []) visit(g);
	if (body.having) visit(body.having);
	if (body.qualify) visit(body.qualify);
	return map;
}

function typeOrUndefined(t: Type): Type | undefined {
	return t.kind === "unknown" ? undefined : t;
}

function originsOrUndefined(origins: Origin[]): Origin[] | undefined {
	return origins.length === 0 ? undefined : origins;
}

function isLocalSource(scope: Scope, source: ResolvedSource): boolean {
	for (const s of scope.sources.values()) if (s === source) return true;
	return false;
}

/** An alias declaration symbol for a source written `… AS x`, or undefined when unaliased. */
function aliasSymbol(src: ResolvedSource, frame: string, dialect?: string): Sym | undefined {
	if (src.kind === "relation") return undefined; // the implicit pipe-stage relation has no alias
	if (src.kind === "pivot") return undefined; // PivotInfo carries no alias span; the relation symbol names it
	if (src.kind === "graphtable") {
		return src.source.alias
			? {
					kind: "alias",
					modifiers: ["declaration"],
					name: resolveBehavior(dialect).displayName(src.source.alias),
					span: spanOf(src.source.aliasCst ?? src.source.cst),
					frame,
				}
			: undefined;
	}
	const s = src.source;
	if (!s.alias) return undefined;
	return {
		kind: "alias",
		modifiers: ["declaration"],
		name: resolveBehavior(dialect).displayName(s.alias),
		span: spanOf(s.aliasCst ?? s.cst),
		frame,
	};
}

/** The in-query declaration span a bound column resolves to: the projection in the CTE /
 *  subquery that produces it. A catalog table column has none (resolved via the schema). */
function columnDefinition(res: ColumnResolution): Span | undefined {
	if (res.kind !== "bound") return undefined;
	const src = res.source;
	if (src.kind === "cte") return projectionSpan(src.ref.scope, res.column, src.ref.def.columnAliases);
	if (src.kind === "subquery") return projectionSpan(src.scope, res.column, src.source.columnAliases);
	if (src.kind === "relation") return projectionSpan(src.scope, res.column, undefined); // prior pipe stage
	if (src.kind === "graphtable") return projectionSpan(src.scope, res.column, undefined);
	return undefined;
}

function projectionSpan(scope: Scope, column: string, aliases: string[] | undefined): Span | undefined {
	if (scope.body.kind !== "select") return undefined;
	const projs = scope.body.projections;
	const b = behaviorOf(scope);
	const c = b.fold(column);
	let p: Projection | undefined;
	if (aliases) {
		const i = aliases.findIndex((a) => b.fold(a) === c);
		p = i >= 0 ? projs[i] : undefined;
	} else {
		p = projs.find((pp) => pp.name !== undefined && b.fold(pp.name) === c);
	}
	return p ? spanOf(p.aliasCst ?? p.cst) : undefined;
}

function relationSymbol(src: ResolvedSource, frame: string, dialect?: string): Sym {
	const ref = ["reference"] as SymbolModifier[];
	const show = (n: string) => resolveBehavior(dialect).displayName(n);
	// The implicit pipe-stage relation is skipped by the caller; handled here only for exhaustiveness.
	if (src.kind === "relation") {
		return { kind: "subquery", modifiers: ref, name: "", span: spanOf(src.scope.body.cst), frame };
	}
	if (src.kind === "graphtable") {
		return {
			kind: "table",
			modifiers: ref,
			name: src.source.graph.map(show).join("."),
			span: spanOf(src.source.cst),
			frame,
			node: src.source,
		};
	}
	if (src.kind === "table") {
		return {
			kind: "table",
			modifiers: ref,
			// DISPLAY spelling, from relation.parts — NOT src.name, which is the folded identity key
			// (#38). displaying the key uppercases the name on a case-folding dialect; matches the CTE
			// branch's display convention and scope.d.ts's "never show name" contract.
			name: src.source.relation.parts.map(show).join("."),
			span: spanOf(src.source.cst),
			frame,
			node: src.source,
		};
	}
	if (src.kind === "cte") {
		return {
			kind: "cte",
			modifiers: ref,
			name: show(src.ref.def.name),
			span: spanOf(src.source.cst),
			frame,
			definition: spanOf(src.ref.def.nameCst ?? src.ref.def.cst),
			node: src.source,
		};
	}
	if (src.kind === "lateral") {
		return {
			kind: "lateral",
			modifiers: ref,
			name: src.source.alias ? show(src.source.alias) : "",
			span: spanOf(src.source.cst),
			frame,
			node: src.source,
		};
	}
	if (src.kind === "pivot") {
		const cst = src.base[0] ? resolvedSourceCst(src.base[0]) : undefined;
		return { kind: "subquery", modifiers: ref, name: show(src.alias), span: cst ? spanOf(cst) : ZERO_SPAN, frame };
	}
	return {
		kind: "subquery",
		modifiers: ref,
		name: src.source.alias ? show(src.source.alias) : "_subquery_",
		span: spanOf(src.source.cst),
		frame,
		node: src.source,
	};
}

const ZERO_SPAN: Span = { start: 0, end: 0, line: 0, column: 0, endLine: 0, endColumn: 0 };

/** A representative CST node for a resolved source (for span fallbacks). */
function resolvedSourceCst(src: ResolvedSource): ParserRuleContext | undefined {
	switch (src.kind) {
		case "table":
		case "cte":
		case "subquery":
		case "lateral":
		case "graphtable":
			return src.source.cst;
		case "relation":
			return src.scope.body.cst;
		case "pivot":
			return src.base[0] ? resolvedSourceCst(src.base[0]) : undefined;
	}
}

function spanOf(cst: ParserRuleContext): Span {
	const s = cst.start;
	const e = cst.stop;
	const end = endPosition(e?.line ?? 0, e?.column ?? 0, e?.text ?? "");
	return {
		start: s?.start ?? 0,
		end: e ? e.stop + 1 : 0,
		line: s?.line ?? 0,
		column: s?.column ?? 0,
		endLine: end.endLine,
		endColumn: end.endColumn,
	};
}
