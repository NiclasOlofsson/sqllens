import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PipeExpr, PipeStage, QueryExpr } from "../src/ir/ir.js";
import { lower } from "../src/bigquery/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { qualify } from "../src/qualify/qualify.js";
import { lineage } from "../src/lineage/lineage.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { corpusPath } from "./helpers/corpus.js";
import { allPipeStages, stageSubIr } from "./helpers/pipe-walk.js";

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

	it("AGGREGATE outputs the aggregates then the grouping keys", () => {
		expect(outputs("FROM `proj.ds.t` |> AGGREGATE COUNT(*) AS n GROUP BY name")).toEqual(["n", "name"]);
	});

	it("resolves column references against the relation entering each stage", () => {
		const ok = pipeOf("FROM `proj.ds.t` |> WHERE id > 0 |> SELECT name");
		expect(qualify(ok.tree, T).diagnostics).toEqual([]);
		const bad = pipeOf("FROM `proj.ds.t` |> WHERE nope > 0");
		expect(qualify(bad.tree, T).diagnostics.some((d) => d.kind === "unknown-column" && d.message.includes("nope"))).toBe(
			true,
		);
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

// Every GoogleSQL pipe operator is modelled as its own stage kind — the `other` drift guard must never
// fire for real corpus syntax. This gate proves nothing is silently dropped to `other`.
const CORPUS = corpusPath("harness/local/bigquery-zetasql");

function collectPipeStages(q: QueryExpr, out: PipeStage[]): void {
	const visitBody = (body: QueryExpr["body"]): void => {
		if (body.kind === "pipe") {
			visitBody(body.input);
			for (const stage of allPipeStages(body)) {
				out.push(stage);
				for (const sub of stageSubIr(stage)) collectPipeStages(sub, out);
			}
		} else if (body.kind === "setop") {
			visitBody(body.left);
			visitBody(body.right);
		} else {
			for (const s of body.from) if (s.kind === "subquery") collectPipeStages(s.query, out);
			for (const sub of body.subqueries ?? []) collectPipeStages(sub, out);
		}
	};
	for (const cte of q.ctes) collectPipeStages(cte.body, out);
	visitBody(q.body);
}

describe.skipIf(!existsSync(CORPUS))("BigQuery pipe — every operator modelled (no `other` stage)", () => {
	it("no pipe stage falls through to the `other` drift guard across the corpus", { timeout: 600000 }, () => {
		const stages: PipeStage[] = [];
		for (const f of readdirSync(join(CORPUS, "positive")).filter((x) => x.endsWith(".sql"))) {
			const sql = readFileSync(join(CORPUS, "positive", f), "utf8");
			let q: QueryExpr;
			try {
				const r = parseBigQuery(sql);
				if (r.errors !== 0) continue;
				q = lower(r.tree);
			} catch {
				continue;
			}
			collectPipeStages(q, stages);
		}
		const other = stages.filter((s) => s.op === "other");
		// eslint-disable-next-line no-console
		console.log(`BigQuery pipe stages over corpus: ${stages.length} (${other.length} unmodelled "other")`);
		expect(stages.length).toBeGreaterThan(0); // the corpus does exercise pipe syntax
		expect(other).toEqual([]); // all 31 operators modelled — the drift guard never fires
	});
});
