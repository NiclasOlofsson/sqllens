import { describe, expect, it } from "vitest";
import type { PipeExpr } from "../src/ir/ir.js";
import { lower } from "../src/bigquery/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { qualify } from "../src/qualify/qualify.js";
import { lineage } from "../src/lineage/lineage.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";

// Pipe queries are modelled FAITHFULLY — a PipeExpr keeping the base relation plus an ordered list of
// first-class PipeStage nodes (each with its `|> OPERATOR …` span), NOT desugared into nested
// subqueries. These tests prove the structure is faithful AND that the semantic layer flows the relation
// through the stages (output columns, column resolution, lineage) — i.e. a consumer gets real value.

const T = new Schema({ "proj.ds.t": { id: "INT64", name: "STRING", events: "ARRAY<STRING>" } });

function pipeOf(sql: string): { tree: ReturnType<typeof resolveScopes>; body: PipeExpr } {
	const r = parseBigQuery(sql);
	expect(r.errors, sql).toBe(0);
	const q = lower(r.tree);
	expect(q.body.kind, sql).toBe("pipe");
	return { tree: resolveScopes(q, "bigquery"), body: q.body as PipeExpr };
}

function outputs(sql: string): string[] | "unknown" {
	const { tree } = pipeOf(sql);
	return qualify(tree, T).columnsOf(tree.root);
}

describe("BigQuery pipe queries — faithful model + column flow", () => {
	it("lowers a pipe chain to a PipeExpr with ordered, span-carrying stages (not desugared)", () => {
		const { body } = pipeOf("FROM `proj.ds.t` |> WHERE id > 0 |> SELECT id, name");
		expect(body.input.kind).toBe("select"); // the base FROM relation, kept as the input
		expect(body.stages.map((s) => s.op)).toEqual(["where", "select"]);
		for (const s of body.stages) expect(s.cst, s.op).toBeDefined(); // each stage keeps its real span
	});

	it("WHERE / ORDER BY / LIMIT keep the incoming column set", () => {
		expect(outputs("FROM `proj.ds.t` |> WHERE id > 0")).toEqual(["id", "name", "events"]);
		expect(outputs("FROM `proj.ds.t` |> ORDER BY id |> LIMIT 5")).toEqual(["id", "name", "events"]);
	});

	it("SELECT replaces, EXTEND adds, DROP removes, RENAME renames", () => {
		expect(outputs("FROM `proj.ds.t` |> SELECT id, name")).toEqual(["id", "name"]);
		expect(outputs("FROM `proj.ds.t` |> EXTEND id + 1 AS id2")).toEqual(["id", "name", "events", "id2"]);
		expect(outputs("FROM `proj.ds.t` |> DROP events")).toEqual(["id", "name"]);
		expect(outputs("FROM `proj.ds.t` |> RENAME name AS nm")).toEqual(["id", "nm", "events"]);
	});

	it("AGGREGATE outputs the grouping keys then the aggregates (GoogleSQL pipe syntax reference: 'output columns... include all grouping columns first, followed by all aggregate columns')", () => {
		expect(outputs("FROM `proj.ds.t` |> AGGREGATE COUNT(*) AS n GROUP BY name")).toEqual(["name", "n"]);
	});

	it("resolves column references against the relation entering each stage", () => {
		const ok = pipeOf("FROM `proj.ds.t` |> WHERE id > 0 |> SELECT name");
		expect(qualify(ok.tree, T).diagnostics).toEqual([]);
		const bad = pipeOf("FROM `proj.ds.t` |> WHERE nope > 0");
		expect(
			qualify(bad.tree, T).diagnostics.some((d) => d.kind === "unknown-column" && d.message.includes("nope")),
		).toBe(true);
	});

	it("a stage SELECT after EXTEND sees the extended column", () => {
		const tree = pipeOf("FROM `proj.ds.t` |> EXTEND id + 1 AS id2 |> SELECT id2").tree;
		expect(qualify(tree, T).diagnostics).toEqual([]);
		expect(qualify(tree, T).columnsOf(tree.root)).toEqual(["id2"]);
	});

	it("traces lineage through the pipeline to the base table", () => {
		const tree = pipeOf("FROM `proj.ds.t` |> EXTEND id AS out_id |> SELECT out_id").tree;
		const out = lineage(tree, T).find((c) => c.output === "out_id");
		expect(out?.origins.map((o) => `${o.table.join(".")}.${o.column}`)).toContain("proj.ds.t.id");
	});
});

// The corpus-scale pipe-stage drift guard (every GoogleSQL pipe operator modelled — no `other` stage
// over the ZetaSQL corpus) moved to tests/corpus/bigquery.analyzer.test.ts, where it rides the same
// single lower() as the other BigQuery positive-corpus gates. The unit cases stay here.
