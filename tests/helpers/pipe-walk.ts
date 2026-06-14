import type { Expr, PipeExpr, PipeStage, QueryExpr } from "../../src/ir/ir.js";

// Shared helpers for the IR-corpus walkers (ir-completeness, conservation, scope.corpus) to traverse a
// pipe body faithfully: every stage's expressions, the full queries it nests (set-op operands, recursive
// term, WITH bodies, a JOIN subquery), and its sub-pipelines (IF arms, FORK/TEE branches, LOG view).

/** Every top-level expression a stage contributes. */
export function stageExprs(stage: PipeStage): Expr[] {
	switch (stage.op) {
		case "where":
			return [stage.predicate];
		case "select":
		case "extend":
		case "window":
			return stage.projections.map((p) => p.expr);
		case "aggregate":
			return [...stage.aggregates.map((p) => p.expr), ...stage.groupBy];
		case "set":
			return stage.assignments.map((a) => a.expr);
		case "orderBy":
			return stage.keys;
		case "limit":
			return [stage.limit.top, stage.limit.offset, stage.limit.fetch].filter((e): e is Expr => e !== undefined);
		case "join":
			return stage.joinConditions ?? [];
		case "call":
			return stage.args;
		case "assert":
			return [stage.condition, ...stage.payload];
		case "matchRecognize":
			return [...stage.partitionBy, ...stage.measures.map((p) => p.expr), ...stage.defines];
		case "if":
			return stage.arms.flatMap((a) => (a.condition ? [a.condition] : []));
		default:
			return [];
	}
}

/** Full queries a stage nests (set-op operands, recursive term, WITH bodies, a JOIN subquery). */
export function stageSubIr(stage: PipeStage): QueryExpr[] {
	switch (stage.op) {
		case "setop":
			return stage.operands;
		case "recursiveUnion":
			return [stage.operand];
		case "with":
			return stage.ctes.map((c) => c.body);
		case "join":
			return stage.source.kind === "subquery" ? [stage.source.query] : [];
		default:
			return [];
	}
}

/** Sub-pipelines a stage nests (IF arms, FORK/TEE branches, LOG view). */
export function stageSubpipelines(stage: PipeStage): PipeStage[][] {
	switch (stage.op) {
		case "if":
			return stage.arms.map((a) => a.pipeline);
		case "fork":
		case "tee":
			return stage.branches;
		case "log":
			return stage.pipeline ? [stage.pipeline] : [];
		default:
			return [];
	}
}

/** All stages of a pipe body, flattened to include nested sub-pipeline stages (depth-first). */
export function allPipeStages(body: PipeExpr): PipeStage[] {
	const out: PipeStage[] = [];
	const visit = (stages: PipeStage[]): void => {
		for (const s of stages) {
			out.push(s);
			for (const sub of stageSubpipelines(s)) visit(sub);
		}
	};
	visit(body.stages);
	return out;
}
