import type { Expr, QueryBody, QueryExpr } from "../ir/ir.js";
import { allQueryExprs, declarationExprs, selectExprs, stageExprs, walkExprs } from "../ir/walk.js";
import type { Scope, ScopeTree } from "./scope.js";

// ---------------------------------------------------------------------------
// walk / scopeOf — the node→scope join. Every consumer that needs "which Scope
// owns this Expr" (hover, completion, lineage, references) has been re-deriving
// this by hand; this is the one place that does it. Composes the IR-layer walk
// helpers (src/ir/walk.ts) with the scope tree's structure.
// ---------------------------------------------------------------------------

/** The Exprs that belong directly to a scope's body (not its child scopes). */
export function scopeExprs(scope: Scope): Expr[] {
	const body = scope.body;
	if (body.kind === "select") return selectExprs(body);
	if (body.kind === "pipe") return scope.pipeStage ? stageExprs(scope.pipeStage) : [];
	return []; // setop: exprs live in its branch scopes (children)
}

/** Every (expr, owning scope) pair in structure order. `ast` additionally attributes
 *  QueryExpr.orderBy/limit exprs (they live on QueryExpr, not in any Scope.body). */
export function* walk(scopes: ScopeTree, ast?: QueryExpr): Generator<{ node: Expr; scope: Scope }> {
	function* walkScope(scope: Scope): Generator<{ node: Expr; scope: Scope }> {
		for (const expr of scopeExprs(scope)) {
			for (const node of walkExprs(expr)) yield { node, scope };
		}
		for (const child of scope.children) yield* walkScope(child);
	}
	yield* walkScope(scopes.root);

	// QueryExpr.orderBy / limit / declarations' init exprs live on QueryExpr, not in any Scope.body (a
	// QueryBody), so the scope-body walk above can't reach them. When the AST is supplied, attribute
	// each QueryExpr's orderBy + limit + declaration-initializer exprs to its owning scope (matched by
	// body object identity) and run them through the same depth-first expansion. Additive — the walk
	// above is unchanged.
	if (ast) {
		const bodyToScope = new Map<QueryBody, Scope>();
		const indexScopes = (scope: Scope): void => {
			bodyToScope.set(scope.body, scope);
			for (const child of scope.children) indexScopes(child);
		};
		indexScopes(scopes.root);
		for (const qe of allQueryExprs(ast)) {
			const scope = bodyToScope.get(qe.body) ?? scopes.root;
			for (const e of qe.orderBy ?? []) {
				for (const node of walkExprs(e)) yield { node, scope };
			}
			const lim = qe.limit;
			if (lim) {
				for (const e of [lim.top, lim.offset, lim.fetch]) {
					if (e) for (const node of walkExprs(e)) yield { node, scope };
				}
			}
			for (const e of declarationExprs(qe)) {
				for (const node of walkExprs(e)) yield { node, scope };
			}
		}
	}
}

const INDEX = new WeakMap<ScopeTree, WeakMap<Expr, Scope>>();

/** The scope owning `node`, or undefined if the node is not reachable from these scopes.
 *  Lazy: first call walks once and memoizes per ScopeTree (WeakMap — annotation-side).
 *  Pass `ast` on the FIRST call to cover ORDER BY/LIMIT nodes — the index is built once
 *  and never rebuilt, so a later call's `ast` is ignored once an index exists. */
export function scopeOf(scopes: ScopeTree, node: Expr, ast?: QueryExpr): Scope | undefined {
	let index = INDEX.get(scopes);
	if (!index) {
		index = new WeakMap();
		for (const { node: n, scope } of walk(scopes, ast)) if (!index.has(n)) index.set(n, scope);
		INDEX.set(scopes, index);
	}
	return index.get(node);
}
