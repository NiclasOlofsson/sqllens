import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./helpers/corpus.js";
import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import type { Expr, QueryBody, QueryExpr } from "../src/ir/ir.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { allPipeStages, stageExprs, stageSubIr } from "./helpers/pipe-walk.js";

// IR completeness gate: every expression in every real Oatly model must lower to a TYPED
// Expr node — nothing may fall through to `other`. `other` stays in the IR as a safety net
// for constructs the corpus doesn't exercise (so nothing is ever dropped), but a real model
// hitting it means the IR has a known, named hole to close. This test fails with the exact
// CST type(s) that leaked, so the gap is never silent. Skips when the corpus is absent.
const CORPUS = corpusPath("databricks/oatly");

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
			walkExpr(e.index, tally, samples);
			break;
		// column, literal, star, subquery, exists → leaf or own-scope; nothing more to walk here
	}
}

function walkIr(q: QueryExpr, tally: Map<string, number>, samples: Map<string, string>): void {
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
	for (const j of body.joinConditions ?? []) walkExpr(j, tally, samples);
	for (const g of body.groupBy ?? []) walkExpr(g, tally, samples);
	if (body.having) walkExpr(body.having, tally, samples);
	if (body.qualify) walkExpr(body.qualify, tally, samples);
	for (const sub of body.subqueries ?? []) walkIr(sub, tally, samples);
	for (const s of body.from) if (s.kind === "subquery") walkIr(s.query, tally, samples);
}

describe.skipIf(!existsSync(CORPUS))("IR completeness over the Oatly corpus", () => {
	it("lowers every expression to a typed node — nothing falls through to `other`", () => {
		const files = readdirSync(CORPUS, { recursive: true }).filter(
			(f): f is string => typeof f === "string" && f.endsWith(".sql"),
		);
		const tally = new Map<string, number>();
		const samples = new Map<string, string>();
		for (const rel of files) {
			const ir = lower(parseDatabricks(readFileSync(join(CORPUS, rel), "utf8")).tree);
			walkIr(ir, tally, samples);
		}
		const total = [...tally.values()].reduce((s, n) => s + n, 0);
		if (total > 0) {
			const lines = [...tally.entries()]
				.sort((a, b) => b[1] - a[1])
				.map(([name, n]) => `  ${n}  ${name}   e.g. ${samples.get(name)}`);
			throw new Error(`IR left ${total} expression(s) as \`other\` — model these:\n${lines.join("\n")}`);
		}
		expect(total).toBe(0);
	}, 120000);
});
