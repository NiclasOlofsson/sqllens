import { ParserRuleContext, type ParseTree } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import type { Expr, QueryBody, QueryExpr } from "../src/ir/ir.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { DatabricksParser as P } from "../src/generated/databricks/DatabricksParser.js";
import { allPipeStages, stageSubIr } from "./helpers/pipe-walk.js";

// CST<->IR conservation: the parse tree can't omit anything, so for each construct the CST
// contains, the IR must represent it. Catches sins of OMISSION (dropped structure) that a
// no-throw corpus can't see. (Correctness of what we DO extract is a separate concern.)
// Dialect-agnostic in shape — only the rule indices are Databricks-specific.

type Counts = Record<string, number>;

function* descendants(node: ParseTree): Generator<ParserRuleContext> {
	for (let i = 0; i < node.getChildCount(); i++) {
		const c = node.getChild(i);
		if (c instanceof ParserRuleContext) {
			yield c;
			yield* descendants(c);
		}
	}
}
function countRule(tree: ParseTree, ruleIndex: number): number {
	let n = 0;
	for (const d of descendants(tree)) if (d.ruleIndex === ruleIndex) n++;
	return n;
}
function countOrderBy(tree: ParseTree): number {
	let n = 0;
	for (const d of descendants(tree)) {
		if (d.ruleIndex !== P.RULE_queryOrganization) continue;
		for (let i = 0; i < d.getChildCount(); i++) {
			const c = d.getChild(i);
			if (c && !(c instanceof ParserRuleContext) && (c as { symbol?: { type: number } }).symbol?.type === P.ORDER)
				n++;
		}
	}
	return n;
}

function cstCounts(tree: ParseTree): Counts {
	return {
		where: countRule(tree, P.RULE_whereClause),
		groupBy: countRule(tree, P.RULE_aggregationClause),
		having: countRule(tree, P.RULE_havingClause),
		qualify: countRule(tree, P.RULE_qualifyClause),
		pivot: countRule(tree, P.RULE_pivotClause),
		unpivot: countRule(tree, P.RULE_unpivotClause),
		orderBy: countOrderBy(tree),
	};
}

function irCounts(q: QueryExpr, acc: Counts): void {
	if (q.orderBy) acc.orderBy++;
	walkBody(q.body, acc);
	for (const cte of q.ctes) irCounts(cte.body, acc);
}
function walkBody(b: QueryBody, acc: Counts): void {
	if (b.kind === "setop") {
		walkBody(b.left, acc);
		walkBody(b.right, acc);
		return;
	}
	if (b.kind === "pipe") {
		walkBody(b.input, acc);
		for (const stage of allPipeStages(b)) for (const q of stageSubIr(stage)) irCounts(q, acc);
		return;
	}
	if (b.where) acc.where++;
	if (b.groupBy) acc.groupBy++;
	if (b.having) acc.having++;
	if (b.qualify) acc.qualify++;
	if (b.pivot) acc.pivot++;
	if (b.unpivot) acc.unpivot++;
	for (const s of b.from) if (s.kind === "subquery") irCounts(s.query, acc);
	for (const sub of b.subqueries ?? []) irCounts(sub, acc);
	// expression subqueries can themselves contain ORDER BY etc. — already walked via irCounts.
	void (null as unknown as Expr);
}

describe("CST <-> IR clause conservation", () => {
	const cases = [
		"SELECT a FROM t WHERE w > 1",
		"SELECT a, sum(x) FROM t GROUP BY a HAVING sum(x) > 0",
		"SELECT a, row_number() OVER (ORDER BY a) AS rn FROM t QUALIFY rn = 1",
		"SELECT * FROM t PIVOT (max(v) FOR s IN ('a' AS a))",
		"SELECT * FROM t UNPIVOT (v FOR n IN (c1, c2))",
		"SELECT a FROM t ORDER BY a",
		"SELECT a FROM (SELECT b FROM u WHERE b > 0 ORDER BY b) s ORDER BY a",
		"WITH c AS (SELECT a FROM t WHERE a > 1) SELECT * FROM c ORDER BY a",
	];

	it("the IR represents every clause the CST contains", () => {
		const total: Counts = { where: 0, groupBy: 0, having: 0, qualify: 0, pivot: 0, unpivot: 0, orderBy: 0 };
		const cstTotal: Counts = { where: 0, groupBy: 0, having: 0, qualify: 0, pivot: 0, unpivot: 0, orderBy: 0 };
		const mismatches: string[] = [];

		for (const sql of cases) {
			const tree = parseDatabricks(sql).tree;
			const cst = cstCounts(tree);
			const ir: Counts = { where: 0, groupBy: 0, having: 0, qualify: 0, pivot: 0, unpivot: 0, orderBy: 0 };
			irCounts(lower(tree), ir);
			for (const k of Object.keys(cst)) {
				cstTotal[k] += cst[k];
				total[k] += ir[k];
				if (cst[k] !== ir[k]) mismatches.push(`${k}: CST ${cst[k]} != IR ${ir[k]}  in  ${sql}`);
			}
		}

		expect(mismatches, mismatches.join("\n")).toEqual([]);
		expect(total).toEqual(cstTotal);
	});
});

// The corpus-scale CST↔IR conservation gate moved to tests/corpus/databricks.oatly.test.ts (one pass
// over the Oatly corpus, shared with the other Databricks pipeline gates). The unit cases stay here.
