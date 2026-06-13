import { describe, expect, it } from "vitest";
import { inferType } from "../src/infer/infer.js";
import { lineage } from "../src/lineage/lineage.js";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";
import { lower } from "../src/bigquery/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";

// The shared IR means the semantic layer (scope, qualify, infer, lineage, symbols) runs on
// BigQuery-lowered queries UNCHANGED. These tests prove a BigQuery query flows through every
// stage, and that inference uses BigQuery's knowledge (literals, function registry, division).

function scopes(sql: string) {
	const r = parseBigQuery(sql);
	expect(r.errors, sql).toBe(0);
	return resolveScopes(lower(r.tree), "bigquery");
}

const T = new Schema({ "proj.ds.t": { id: "INT64", name: "STRING", events: "ARRAY<STRING>" } });

function typeOf(sql: string, schema = new Schema({})) {
	const tree = scopes(sql);
	const body = tree.root.body;
	if (body.kind !== "select") throw new Error("expected select");
	return inferType(body.projections[0].expr, tree.root, schema);
}

describe("BigQuery pipeline (semantic layer runs unchanged)", () => {
	it("resolves scopes for a join with UNNEST and reports the statement kind", () => {
		const tree = scopes("SELECT t.id, e FROM `proj.ds.t` AS t, UNNEST(t.events) AS e WHERE t.id > 0");
		expect(tree.statement).toBe("query");
		expect([...tree.root.sources.keys()]).toEqual(expect.arrayContaining(["t", "e"]));
	});

	it("qualifies and expands * against a schema; flags unknown columns", () => {
		const tree = scopes("SELECT * FROM `proj.ds.t` WHERE nope > 0");
		const result = qualify(tree, T);
		expect(result.columnsOf(tree.root)).toEqual(["id", "name", "events"]);
		expect(result.diagnostics.some((d) => d.kind === "unknown-column" && d.message.includes("nope"))).toBe(true);
	});

	it("SELECT * EXCEPT removes the excepted column from the expansion", () => {
		const tree = scopes("SELECT * EXCEPT (events) FROM `proj.ds.t`");
		expect(qualify(tree, T).columnsOf(tree.root)).toEqual(["id", "name"]);
	});

	it("traces lineage through a CTE to the base table", () => {
		const tree = scopes("WITH c AS (SELECT id FROM `proj.ds.t`) SELECT id AS out_id FROM c");
		const out = lineage(tree, T).find((c) => c.output === "out_id");
		expect(out?.origins.map((o) => `${o.table.join(".")}.${o.column}`)).toContain("proj.ds.t.id");
	});

	it("derives symbols over the scope tree", () => {
		expect(deriveSymbols(scopes("SELECT id, name FROM `proj.ds.t`"), T).length).toBeGreaterThan(0);
	});

	it("uses BigQuery inference knowledge: float division, INT64 literal, function returns", () => {
		expect(typeOf("SELECT 10 / 4 AS x")).toEqual({ kind: "scalar", name: "double" }); // INT64/INT64 → FLOAT64
		expect(typeOf("SELECT 7 AS x")).toEqual({ kind: "scalar", name: "int" });
		expect(typeOf("SELECT CONCAT('a', 'b') AS x")).toEqual({ kind: "scalar", name: "string" });
		expect(typeOf("SELECT ARRAY_LENGTH(events) AS x FROM `proj.ds.t`", T)).toEqual({ kind: "scalar", name: "int" });
		expect(typeOf("SELECT CAST(id AS FLOAT64) AS x FROM `proj.ds.t`", T)).toEqual({
			kind: "scalar",
			name: "double",
		});
	});
});
