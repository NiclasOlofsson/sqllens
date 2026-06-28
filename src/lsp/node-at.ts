import type { ParserRuleContext } from "antlr4ng";
import type { Expr, PipeStage, Projection, QueryBody, QueryExpr, SelectExpr } from "../ir/ir.js";
import type { Scope, ScopeTree } from "../scope/scope.js";

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

	// QueryExpr.orderBy / limit exprs live on QueryExpr, not in any Scope.body (a QueryBody),
	// so the scope-body walk above can't reach them. When the AST is supplied, attribute each
	// QueryExpr's orderBy + limit exprs to its owning scope (matched by body object identity) and
	// run them through the same smallest-covering machinery. Additive — the walk above is unchanged.
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
		}
	}
	return best;
}

/** Every QueryExpr reachable in the IR (the AST and its nested query blocks). */
function allQueryExprs(root: QueryExpr): QueryExpr[] {
	const out: QueryExpr[] = [];
	const visitQuery = (qe: QueryExpr): void => {
		out.push(qe);
		for (const cte of qe.ctes) visitQuery(cte.body);
		visitBody(qe.body);
	};
	const visitBody = (body: QueryBody): void => {
		if (body.kind === "select") {
			for (const s of body.from) if (s.kind === "subquery") visitQuery(s.query);
			for (const sub of body.subqueries ?? []) visitQuery(sub);
		} else if (body.kind === "setop") {
			visitBody(body.left);
			visitBody(body.right);
		} else {
			// pipe
			visitBody(body.input);
			for (const stage of body.stages) {
				if (stage.op === "setop") for (const q of stage.operands) visitQuery(q);
				if (stage.op === "recursiveUnion") visitQuery(stage.operand);
				if (stage.op === "with") for (const cte of stage.ctes) visitQuery(cte.body);
			}
		}
	};
	visitQuery(root);
	return out;
}

/** Sub-expressions reachable WITHOUT crossing a scope boundary (no subquery/exists descent). */
function childExprs(expr: Expr): Expr[] {
	switch (expr.kind) {
		case "binary":
			return [expr.left, expr.right];
		case "unary":
			return [expr.operand];
		case "function":
			return [...expr.args, ...(expr.window ? [...expr.window.partitionBy, ...expr.window.orderBy] : [])];
		case "case":
			return [...expr.whens.flatMap((w) => [w.when, w.then]), ...(expr.elseExpr ? [expr.elseExpr] : [])];
		case "cast":
			return [expr.expr];
		case "predicate":
			return [expr.operand, ...expr.args];
		case "lambda":
			return [expr.body];
		case "subscript":
			return [expr.base, expr.index];
		case "star":
			return expr.replace?.map((r) => r.expr) ?? [];
		default:
			// column / literal / subquery / exists / other — leaves for node-at purposes
			return [];
	}
}

/** The Exprs that belong directly to a scope's body (not its child scopes). */
function scopeExprs(scope: Scope): Expr[] {
	const body = scope.body;
	if (body.kind === "select") return selectExprs(body);
	if (body.kind === "pipe") return scope.pipeStage ? stageExprs(scope.pipeStage) : [];
	return []; // setop: exprs live in its branch scopes (children)
}

function selectExprs(body: SelectExpr): Expr[] {
	const out: Expr[] = [];
	for (const p of body.projections) out.push(p.expr);
	if (body.where) out.push(body.where);
	for (const j of body.joinConditions ?? []) out.push(j);
	for (const g of body.groupBy ?? []) out.push(g);
	if (body.having) out.push(body.having);
	if (body.qualify) out.push(body.qualify);
	return out;
}

function stageExprs(stage: PipeStage): Expr[] {
	const out: Expr[] = [];
	const projOf = (ps: Projection[]): void => {
		for (const p of ps) out.push(p.expr);
	};
	if (stage.op === "where") out.push(stage.predicate);
	if (stage.op === "select" || stage.op === "extend" || stage.op === "window") projOf(stage.projections);
	if (stage.op === "aggregate") {
		projOf(stage.aggregates);
		for (const g of stage.groupBy) out.push(g);
	}
	if (stage.op === "orderBy") for (const k of stage.keys) out.push(k);
	if (stage.op === "set") for (const a of stage.assignments) out.push(a.expr);
	return out;
}
