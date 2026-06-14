import type { ParserRuleContext } from "antlr4ng";
import type { Expr, Projection } from "../ir/ir.js";
import { inferType } from "../infer/infer.js";
import type { Type } from "../infer/types.js";
import { originsOf, type Origin } from "../lineage/lineage.js";
import { Schema } from "../qualify/schema.js";
import {
	resolveColumn,
	type ColumnResolution,
	type ResolvedSource,
	type Scope,
	type ScopeTree,
} from "../scope/scope.js";

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
// `view`/parameters would need a catalog / param modelling we don't have, so they aren't kinds.
export type SymbolKind =
	// relations
	| "table"
	| "cte"
	| "subquery"
	| "lateral"
	// within a relation / expression
	| "column"
	| "alias"
	| "function";

export type SymbolModifier = "declaration" | "reference" | "output" | "aggregate" | "window" | "correlated" | "star";

export interface Span {
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
}

/** The main query's frame label (no enclosing CTE / subquery). */
export const MAIN_FRAME = "_main_";

/** Derive the symbol graph. A `schema` lets column/function symbols carry inferred types;
 *  without one (the default), names + spans + frames + definitions are still produced. */
export function deriveSymbols(tree: ScopeTree, schema: Schema = new Schema({})): Sym[] {
	const out: Sym[] = [];
	walk(tree.root, MAIN_FRAME, out, schema);
	return out;
}

function walk(scope: Scope, frame: string, out: Sym[], schema: Schema): void {
	const walked = new Set<Scope>();

	// CTE declarations, and each CTE body as its own frame.
	for (const [name, cteRef] of scope.ctes) {
		out.push({ kind: "cte", modifiers: ["declaration"], name, span: spanOf(cteRef.def.cst), frame });
		walk(cteRef.scope, name, out, schema);
		walked.add(cteRef.scope);
	}
	// Set-op branches share this scope's frame.
	if (scope.branches) {
		walk(scope.branches.left, frame, out, schema);
		walk(scope.branches.right, frame, out, schema);
		walked.add(scope.branches.left);
		walked.add(scope.branches.right);
	}
	// A pipe's input + stages share this scope's frame — they are this query's stages, not subqueries.
	if (scope.body.kind === "pipe" && scope.pipe) {
		walk(scope.pipe.input, frame, out, schema);
		walked.add(scope.pipe.input);
		for (const st of scope.pipe.stages) {
			walk(st, frame, out, schema);
			walked.add(st);
		}
	}
	// Source references in this frame, plus any alias declaration; a subquery opens its own frame. The
	// implicit "relation" source of a pipe stage (the incoming relation) has no name — skip it.
	for (const src of scope.sources.values()) {
		if (src.kind === "relation") continue;
		out.push(relationSymbol(src, frame));
		const alias = aliasSymbol(src, frame);
		if (alias) out.push(alias);
		if (src.kind === "subquery") {
			walk(src.scope, src.source.alias ?? "_subquery_", out, schema);
			walked.add(src.scope);
		} else if (src.kind === "graphtable") {
			walk(src.scope, src.source.alias ?? src.source.graph.join("."), out, schema);
			walked.add(src.scope);
		}
	}
	// Expression subqueries (scalar / IN / EXISTS) — the remaining children, each its own frame.
	for (const child of scope.children) {
		if (!walked.has(child)) walk(child, "_sub_", out, schema);
	}

	emitColumns(scope, frame, out, schema);
	emitFunctions(scope, frame, out, schema);
}

/** Function symbols (with aggregate/window modifiers) from this frame's expression trees. */
function emitFunctions(scope: Scope, frame: string, out: Sym[], schema: Schema): void {
	const body = scope.body;
	if (body.kind !== "select") return;
	const visit = (e: Expr): void => {
		switch (e.kind) {
			case "function":
				out.push({
					kind: "function",
					modifiers: fnModifiers(e),
					name: e.name,
					span: spanOf(e.cst),
					frame,
					type: typeOrUndefined(inferType(e, scope, schema)),
				});
				e.args.forEach(visit);
				e.window?.partitionBy.forEach(visit);
				e.window?.orderBy.forEach(visit);
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
				visit(e.index);
				break;
			// column/literal/star → not functions; subquery/exists → their own frames
		}
	};
	for (const p of body.projections) visit(p.expr);
	if (body.where) visit(body.where);
	for (const j of body.joinConditions ?? []) visit(j);
	for (const g of body.groupBy ?? []) visit(g);
	if (body.having) visit(body.having);
	if (body.qualify) visit(body.qualify);
}

function fnModifiers(e: Extract<Expr, { kind: "function" }>): SymbolModifier[] {
	const m: SymbolModifier[] = [];
	if (e.aggregate) m.push("aggregate");
	if (e.window) m.push("window");
	return m;
}

/** Column references in this frame, plus output declarations for aliased/computed projections. */
function emitColumns(scope: Scope, frame: string, out: Sym[], schema: Schema): void {
	const body = scope.body;
	if (body.kind === "select") {
		for (const p of body.projections) {
			if (p.isStar) {
				const q = p.expr.kind === "star" ? p.expr.qualifier : undefined;
				out.push({
					kind: "column",
					modifiers: ["star"],
					name: q ? `${q.join(".")}.*` : "*",
					span: spanOf(p.cst),
					frame,
				});
				continue;
			}
			// A bare column projection (`a`) is just a reference — the output name echoes the column,
			// so don't double-emit a declaration. An explicit alias or a computed expr does declare.
			if (p.name === undefined) continue;
			const last = p.expr.kind === "column" ? p.expr.parts[p.expr.parts.length - 1] : undefined;
			const echo = last !== undefined && last.toLowerCase() === p.name.toLowerCase();
			if (!echo) {
				out.push({
					kind: "column",
					modifiers: ["declaration", "output"],
					name: p.name,
					span: spanOf(p.cst),
					frame,
					type: typeOrUndefined(inferType(p.expr, scope, schema)),
					origins: originsOrUndefined(originsOf(p.expr, scope, schema)),
				});
			}
		}
	}
	if (body.kind === "pipe") return; // a pipe scope's refs live in its per-stage child scopes
	for (const ref of body.columns) {
		const res = resolveColumn(scope, ref);
		const modifiers: SymbolModifier[] = ["reference"];
		// A reference that binds to a source outside this scope is correlated.
		if (res.kind === "bound" && !isLocalSource(scope, res.source)) modifiers.push("correlated");
		const colExpr = { kind: "column" as const, parts: ref.parts, cst: ref.cst };
		out.push({
			kind: "column",
			modifiers,
			name: ref.parts.join("."),
			span: spanOf(ref.cst),
			frame,
			definition: columnDefinition(res),
			type: typeOrUndefined(inferType(colExpr, scope, schema)),
			origins: originsOrUndefined(originsOf(colExpr, scope, schema)),
		});
	}
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
function aliasSymbol(src: ResolvedSource, frame: string): Sym | undefined {
	if (src.kind === "relation") return undefined; // the implicit pipe-stage relation has no alias
	if (src.kind === "graphtable") {
		return src.source.alias
			? { kind: "alias", modifiers: ["declaration"], name: src.source.alias, span: spanOf(src.source.aliasCst ?? src.source.cst), frame }
			: undefined;
	}
	const s = src.source;
	if (!s.alias) return undefined;
	return { kind: "alias", modifiers: ["declaration"], name: s.alias, span: spanOf(s.aliasCst ?? s.cst), frame };
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
	const c = column.toLowerCase();
	let p: Projection | undefined;
	if (aliases) {
		const i = aliases.findIndex((a) => a.toLowerCase() === c);
		p = i >= 0 ? projs[i] : undefined;
	} else {
		p = projs.find((pp) => pp.name !== undefined && pp.name.toLowerCase() === c);
	}
	return p ? spanOf(p.cst) : undefined;
}

function relationSymbol(src: ResolvedSource, frame: string): Sym {
	const ref = ["reference"] as SymbolModifier[];
	// The implicit pipe-stage relation is skipped by the caller; handled here only for exhaustiveness.
	if (src.kind === "relation") {
		return { kind: "subquery", modifiers: ref, name: "", span: spanOf(src.scope.body.cst), frame };
	}
	if (src.kind === "graphtable") {
		return { kind: "table", modifiers: ref, name: src.source.graph.join("."), span: spanOf(src.source.cst), frame };
	}
	if (src.kind === "table") {
		return { kind: "table", modifiers: ref, name: src.name.join("."), span: spanOf(src.source.cst), frame };
	}
	if (src.kind === "cte") {
		return {
			kind: "cte",
			modifiers: ref,
			name: src.ref.def.name,
			span: spanOf(src.source.cst),
			frame,
			definition: spanOf(src.ref.def.cst),
		};
	}
	if (src.kind === "lateral") {
		return { kind: "lateral", modifiers: ref, name: src.source.alias ?? "", span: spanOf(src.source.cst), frame };
	}
	return {
		kind: "subquery",
		modifiers: ref,
		name: src.source.alias ?? "_subquery_",
		span: spanOf(src.source.cst),
		frame,
	};
}

function spanOf(cst: ParserRuleContext): Span {
	const s = cst.start;
	const e = cst.stop;
	return {
		line: s?.line ?? 0,
		column: s?.column ?? 0,
		endLine: e?.line ?? 0,
		endColumn: (e?.column ?? 0) + (e?.text?.length ?? 0),
	};
}
