import type { ParserRuleContext } from "antlr4ng";
import { debugRethrow } from "../debug.js";
import type { QueryBody, QueryExpr } from "../ir/ir.js";
import { allQueryExprs } from "../ir/walk.js";
import { frameLabels, MAIN_FRAME } from "../symbols/symbols.js";
import type { Scope, ScopeTree } from "./scope.js";

// ---------------------------------------------------------------------------
// frameAt: the debugger-shaped "which frame (CTE) owns this offset" primitive.
// Mirrors nodeAt/referencesAt/lineageAt's own layering: a total, schema-free free
// function over a ScopeTree, cell-aware via SqlDocument.frameAt, pure delegation
// via SqlSession.frameAt.
//
// The frame LABEL is the exact one `deriveSymbols`/`unionSymbols` assign a Sym
// (MAIN_FRAME, a CTE's display name, a subquery's alias / "_subquery_", a graph
// table's alias, or "_sub_"): both read the SAME `frameLabels` map (symbols.ts),
// so the two agree BY CONSTRUCTION, never by coincidence.
// ---------------------------------------------------------------------------

export interface Frame {
	/** The owning Scope object itself: the identity anchor when two same-named CTEs shadow (the
	 *  label alone is not unique; this is). */
	scope: Scope;
	/** The frame label `Sym.frame` uses for symbols declared/referenced inside `scope`. */
	frame: string;
}

/** The narrowest (deepest) scope whose construct covers `offset`, plus its frame label. `ast`
 *  (optional, mirrors `nodeAt`'s own param) widens a scope's own cover to its owning QueryExpr's FULL
 *  span (CTE list, trailing ORDER BY / LIMIT), so an offset in those trailing clauses still resolves
 *  to the right query level rather than falling through uncovered; without it, only `scope.body.cst`
 *  (the queryTerm/select span, narrower) is tested. Total: undefined off-document / off-construct,
 *  never throws. */
export function frameAt(scopes: ScopeTree, offset: number, ast?: QueryExpr): Frame | undefined {
	try {
		return compute(scopes, offset, ast);
	} catch (e) {
		debugRethrow(e);
		return undefined;
	}
}

function compute(scopes: ScopeTree, offset: number, ast?: QueryExpr): Frame | undefined {
	const labels = frameLabels(scopes);
	const bodyToQuery = ast ? indexQueryExprs(ast) : undefined;
	let best: { scope: Scope; width: number } | undefined;
	const visit = (scope: Scope): void => {
		const cst = bodyToQuery?.get(scope.body)?.cst ?? scope.body.cst;
		const r = cstRange(cst);
		if (r && r.from <= offset && offset <= r.to) {
			const width = r.to - r.from;
			if (!best || width < best.width) best = { scope, width };
		}
		for (const child of scope.children) visit(child);
	};
	visit(scopes.root);
	if (!best) return undefined;
	return { scope: best.scope, frame: labels.get(best.scope) ?? MAIN_FRAME };
}

function indexQueryExprs(ast: QueryExpr): Map<QueryBody, QueryExpr> {
	const map = new Map<QueryBody, QueryExpr>();
	for (const qe of allQueryExprs(ast)) map.set(qe.body, qe);
	return map;
}

function cstRange(cst: ParserRuleContext): { from: number; to: number } | undefined {
	const start = cst.start;
	const stop = cst.stop ?? cst.start;
	if (!start || !stop) return undefined;
	return { from: start.start, to: stop.stop };
}
