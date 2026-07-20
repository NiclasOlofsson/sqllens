import { describe, expect, it } from "vitest";
import type { PipeExpr } from "../src/ir/ir.js";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";

// Spark 4.0 pipe syntax (`|>`) lowers to the SAME faithful PipeExpr IR as BigQuery — the semantic layer
// flows columns through the stages unchanged. Only the per-dialect lower() differs (Spark's queryTerm
// left-recurses; BigQuery's pipe operators are a flat suffix list).

const T = new Schema({ t: { id: "INT", name: "STRING" } });

function pipe(sql: string): { tree: ReturnType<typeof resolveScopes>; body: PipeExpr } {
	const r = parseDatabricks(sql);
	expect(r.errors, sql).toBe(0);
	const q = lower(r.tree);
	expect(q.body.kind, sql).toBe("pipe");
	return { tree: resolveScopes(q), body: q.body as PipeExpr };
}

function outputs(sql: string): string[] | "unknown" {
	const { tree } = pipe(sql);
	return qualify(tree, T).columnsOf(tree.root);
}

describe("Databricks pipe queries (Spark 4.0 |>) — same faithful IR", () => {
	it("unwinds the left-recursive pipe into a base input + ordered stages", () => {
		const { body } = pipe("SELECT * FROM t |> WHERE id > 0 |> SELECT id, name");
		expect(body.input.kind).toBe("select");
		expect(body.stages.map((s) => s.op)).toEqual(["where", "select"]);
		for (const s of body.stages) expect(s.cst, s.op).toBeDefined();
	});

	it("flows columns through the stages (WHERE keeps, SELECT replaces, EXTEND adds, DROP removes)", () => {
		expect(outputs("SELECT * FROM t |> WHERE id > 0")).toEqual(["id", "name"]);
		expect(outputs("SELECT * FROM t |> SELECT id")).toEqual(["id"]);
		expect(outputs("SELECT * FROM t |> EXTEND id + 1 AS id2")).toEqual(["id", "name", "id2"]);
		expect(outputs("SELECT * FROM t |> DROP name")).toEqual(["id"]);
	});

	it("resolves a column reference against the relation entering a stage", () => {
		const ok = pipe("SELECT * FROM t |> WHERE id > 0 |> SELECT name");
		expect(qualify(ok.tree, T).diagnostics).toEqual([]);
		const bad = pipe("SELECT * FROM t |> WHERE nope > 0");
		expect(qualify(bad.tree, T).diagnostics.some((d) => d.kind === "unknown-column")).toBe(true);
	});

	it("AGGREGATE outputs the grouping keys then the aggregates (Spark pipe syntax reference: 'the evaluated grouping expressions followed by the evaluated aggregate functions')", () => {
		expect(outputs("SELECT * FROM t |> AGGREGATE COUNT(*) AS n GROUP BY name")).toEqual(["name", "n"]);
	});
});
