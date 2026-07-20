import type { Expr, QueryBody, QueryExpr } from "../../src/ir/ir.js";
import { allPipeStages, stageExprs, stageSubIr } from "./pipe-walk.js";

function walkExpr(e: Expr, tally: Map<string, number>, samples: Map<string, string>): void {
	if (e.kind === "other") {
		const name = e.cst.constructor.name;
		tally.set(name, (tally.get(name) ?? 0) + 1);
		if (!samples.has(name)) samples.set(name, e.text.slice(0, 70));
		return;
	}
	switch (e.kind) {
		case "function":
			e.args.forEach((a) => walkExpr(a, tally, samples));
			e.window?.partitionBy.forEach((a) => walkExpr(a, tally, samples));
			e.window?.orderBy.forEach((a) => walkExpr(a, tally, samples));
			break;
		case "binary":
			walkExpr(e.left, tally, samples);
			walkExpr(e.right, tally, samples);
			break;
		case "unary":
			walkExpr(e.operand, tally, samples);
			break;
		case "cast":
			walkExpr(e.expr, tally, samples);
			break;
		case "case":
			e.whens.forEach((w) => {
				walkExpr(w.when, tally, samples);
				walkExpr(w.then, tally, samples);
			});
			if (e.elseExpr) walkExpr(e.elseExpr, tally, samples);
			break;
		case "predicate":
			walkExpr(e.operand, tally, samples);
			e.args.forEach((a) => walkExpr(a, tally, samples));
			break;
		case "lambda":
			walkExpr(e.body, tally, samples);
			break;
		case "subscript":
			walkExpr(e.base, tally, samples);
			if (e.index) walkExpr(e.index, tally, samples);
			if (e.end) walkExpr(e.end, tally, samples);
			if (e.step) walkExpr(e.step, tally, samples);
			break;
		case "with":
			// Retained bindings + result are all visible to the walker (conservation: no dropped field expr).
			e.bindings.forEach((b) => walkExpr(b.value, tally, samples));
			walkExpr(e.result, tally, samples);
			break;
		// column, literal, star, subquery, exists → leaf or own-scope; nothing more to walk here
	}
}

export function walkIr(q: QueryExpr, tally: Map<string, number>, samples: Map<string, string>): void {
	for (const cte of q.ctes) walkIr(cte.body, tally, samples);
	walkBody(q.body, tally, samples);
	if (q.orderBy) q.orderBy.forEach((e) => walkExpr(e, tally, samples));
}

function walkBody(body: QueryBody, tally: Map<string, number>, samples: Map<string, string>): void {
	if (body.kind === "setop") {
		walkBody(body.left, tally, samples);
		walkBody(body.right, tally, samples);
		return;
	}
	if (body.kind === "pipe") {
		walkBody(body.input, tally, samples);
		for (const stage of allPipeStages(body)) {
			for (const e of stageExprs(stage)) walkExpr(e, tally, samples);
			for (const q of stageSubIr(stage)) walkIr(q, tally, samples);
		}
		return;
	}
	for (const p of body.projections) walkExpr(p.expr, tally, samples);
	if (body.where) walkExpr(body.where, tally, samples);
	// JOIN ON predicates are walked via `joinConditions`. `body.joins` (the additive Join[] view) carries
	// NO unique expr — each `join.on` is reference-EQUAL to a `joinConditions` entry and each
	// `join.source` to a `from` entry, both already walked here. Re-walking `body.joins` would
	// double-count `other` nodes and inflate the ratchet, so it is deliberately not traversed.
	for (const j of body.joinConditions ?? []) walkExpr(j, tally, samples);
	for (const g of body.groupBy ?? []) walkExpr(g, tally, samples);
	if (body.having) walkExpr(body.having, tally, samples);
	if (body.qualify) walkExpr(body.qualify, tally, samples);
	for (const sub of body.subqueries ?? []) walkIr(sub, tally, samples);
	for (const s of body.from) if (s.kind === "subquery") walkIr(s.query, tally, samples);
}
