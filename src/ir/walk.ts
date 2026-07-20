import type { Expr, PipeStage, Projection, QueryBody, QueryExpr, SelectExpr, Source } from "./ir.js";

// ---------------------------------------------------------------------------
// Shared IR walk helpers — expr/query-tree traversal with no scope/document
// knowledge, so src/document/node-at.ts (offset → smallest covering Expr) and
// any other IR-only consumer single-source the same walk instead of carrying
// byte-for-byte duplicates.
// ---------------------------------------------------------------------------

/** Every QueryExpr reachable in the IR (the AST, its nested query blocks, and, for a routine/
 *  compound container, each inner statement of `statements`, recursively). */
export function allQueryExprs(root: QueryExpr): QueryExpr[] {
	const out: QueryExpr[] = [];
	const visitQuery = (qe: QueryExpr): void => {
		out.push(qe);
		for (const cte of qe.ctes) visitQuery(cte.body);
		for (const stmt of qe.statements ?? []) visitQuery(stmt);
		visitBody(qe.body);
	};
	const visitSource = (source: Source): void => {
		if (source.kind === "subquery") visitQuery(source.query);
	};
	// One pipe stage's directly-carried QueryExprs + nested sub-pipelines (if/fork/tee/log).
	const visitStage = (stage: PipeStage): void => {
		if (stage.op === "setop") for (const q of stage.operands) visitQuery(q);
		if (stage.op === "recursiveUnion") visitQuery(stage.operand);
		if (stage.op === "with") for (const cte of stage.ctes) visitQuery(cte.body);
		if (stage.op === "join") visitSource(stage.source);
		if (stage.op === "if") for (const arm of stage.arms) for (const s of arm.pipeline) visitStage(s);
		if (stage.op === "fork" || stage.op === "tee")
			for (const branch of stage.branches) for (const s of branch) visitStage(s);
		if (stage.op === "log" && stage.pipeline) for (const s of stage.pipeline) visitStage(s);
	};
	const visitBody = (body: QueryBody): void => {
		if (body.kind === "select") {
			for (const s of body.from) visitSource(s);
			for (const sub of body.subqueries ?? []) visitQuery(sub);
		} else if (body.kind === "setop") {
			visitBody(body.left);
			visitBody(body.right);
		} else {
			// pipe
			visitBody(body.input);
			for (const stage of body.stages) visitStage(stage);
		}
	};
	visitQuery(root);
	return out;
}

/** A QueryExpr's own DECLARE initializer expressions (T-SQL `DECLARE @x int = 1, @y int = @x + 1`).
 *  `declarations` lives on QueryExpr itself, not on any QueryBody/Scope.body — the same "not reachable
 *  from the body walk" shape as `orderBy`/`limit`, so callers attribute these to the owning scope the
 *  same way (see node-at.ts / scope/walk.ts). Populated only on the top-level statement's QueryExpr;
 *  absent everywhere else. NOT part of childExprs — these are not sub-expressions of any Expr. */
export function declarationExprs(query: QueryExpr): Expr[] {
	return query.declarations?.flatMap((d) => (d.init ? [d.init] : [])) ?? [];
}

/** Sub-expressions reachable WITHOUT crossing a scope boundary (no subquery/exists descent). */
export function childExprs(expr: Expr): Expr[] {
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
			return [
				expr.base,
				...(expr.index ? [expr.index] : []),
				...(expr.end ? [expr.end] : []),
				...(expr.step ? [expr.step] : []),
			];
		case "star":
			return expr.replace?.map((r) => r.expr) ?? [];
		default:
			// column / literal / parameter / variable / subquery / exists / other: leaves for node-at purposes
			return [];
	}
}

export function selectExprs(body: SelectExpr): Expr[] {
	const out: Expr[] = [];
	for (const p of body.projections) out.push(p.expr);
	if (body.where) out.push(body.where);
	for (const j of body.joinConditions ?? []) out.push(j);
	for (const g of body.groupBy ?? []) out.push(g);
	if (body.having) out.push(body.having);
	if (body.qualify) out.push(body.qualify);
	return out;
}

export function stageExprs(stage: PipeStage): Expr[] {
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

/** Depth-first walk over an Expr and every sub-expression reachable via childExprs, root first. */
export function* walkExprs(root: Expr): Generator<Expr> {
	yield root;
	for (const child of childExprs(root)) yield* walkExprs(child);
}
