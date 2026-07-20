import type { ParserRuleContext } from "antlr4ng";
import type { Expr, QueryBody, QueryExpr } from "../ir/ir.js";
import { allQueryExprs, childExprs, declarationExprs } from "../ir/walk.js";
import type { Scope, ScopeTree } from "../scope/scope.js";
import { scopeExprs } from "../scope/walk.js";

// ---------------------------------------------------------------------------
// node-at: the one genuinely new capability the LSP needs. Given a 0-based char
// offset, find the smallest IR Expr whose CST char-range covers it, paired with
// the Scope that owns it. Backs hover (offset → expr → inferType). Walks the
// scope tree so the returned Scope is the exact query block the expr lives in
// (needed because inferType resolves columns relative to a scope). Subquery /
// EXISTS exprs are NOT descended here — they open child scopes the walk visits.
// ---------------------------------------------------------------------------

export interface NodeHit {
	expr: Expr;
	scope: Scope;
}

/** 0-based inclusive char range of a CST node, or undefined if it has no tokens. */
function cstRange(cst: ParserRuleContext): { from: number; to: number } | undefined {
	const start = cst.start;
	const stop = cst.stop ?? cst.start;
	if (!start || !stop) return undefined;
	return { from: start.start, to: stop.stop };
}

function covers(cst: ParserRuleContext, offset: number): boolean {
	const r = cstRange(cst);
	return r !== undefined && r.from <= offset && offset <= r.to;
}

function span(cst: ParserRuleContext): number {
	const r = cstRange(cst);
	return r ? r.to - r.from : Number.MAX_SAFE_INTEGER;
}

export function nodeAt(tree: ScopeTree, offset: number, ast?: QueryExpr): NodeHit | undefined {
	let best: NodeHit | undefined;
	const consider = (expr: Expr, scope: Scope): void => {
		if (!covers(expr.cst, offset)) return;
		if (!best || span(expr.cst) < span(best.expr.cst)) best = { expr, scope };
	};
	const walkExpr = (expr: Expr, scope: Scope): void => {
		consider(expr, scope);
		for (const child of childExprs(expr)) walkExpr(child, scope);
	};
	const walkScope = (scope: Scope): void => {
		for (const expr of scopeExprs(scope)) walkExpr(expr, scope);
		for (const child of scope.children) walkScope(child);
	};
	walkScope(tree.root);

	// QueryExpr.orderBy / limit / declarations' init exprs live on QueryExpr, not in any Scope.body (a
	// QueryBody), so the scope-body walk above can't reach them. When the AST is supplied, attribute
	// each QueryExpr's orderBy + limit + declaration-initializer exprs to its owning scope (matched by
	// body object identity) and run them through the same smallest-covering machinery. Additive — the
	// walk above is unchanged.
	if (ast) {
		const bodyToScope = new Map<QueryBody, Scope>();
		const indexScopes = (scope: Scope): void => {
			bodyToScope.set(scope.body, scope);
			for (const child of scope.children) indexScopes(child);
		};
		indexScopes(tree.root);
		for (const qe of allQueryExprs(ast)) {
			const scope = bodyToScope.get(qe.body) ?? tree.root;
			for (const e of qe.orderBy ?? []) walkExpr(e, scope);
			const lim = qe.limit;
			if (lim) for (const e of [lim.top, lim.offset, lim.fetch]) if (e) walkExpr(e, scope);
			for (const e of declarationExprs(qe)) walkExpr(e, scope);
		}
	}
	return best;
}
