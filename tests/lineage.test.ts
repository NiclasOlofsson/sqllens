import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { lineage } from "../src/lineage/lineage.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";

function origins(sql: string, output: string, schema = new Schema({})): string[] {
	const tree = resolveScopes(lower(parseDatabricks(sql).tree));
	const col = lineage(tree, schema).find((c) => c.output === output);
	return (col?.origins ?? []).map((o) => `${o.table.join(".")}.${o.column}`).sort();
}

describe("lineage", () => {
	it("traces a base-table column to itself", () => {
		expect(origins("SELECT a FROM t", "a")).toEqual(["t.a"]);
	});

	it("traces a computed column to every contributing column", () => {
		expect(origins("SELECT a + b AS c FROM t", "c")).toEqual(["t.a", "t.b"]);
	});

	it("traces a function's output to all its arguments", () => {
		expect(origins("SELECT coalesce(a, b) AS c FROM t", "c")).toEqual(["t.a", "t.b"]);
	});

	it("gives a literal no origins", () => {
		expect(origins("SELECT 1 AS c FROM t", "c")).toEqual([]);
	});

	it("traces a column through a CTE to the base table", () => {
		expect(origins("WITH c AS (SELECT a FROM t) SELECT a FROM c", "a")).toEqual(["t.a"]);
	});

	it("traces a renamed column through an aliased CTE", () => {
		expect(origins("WITH c (x) AS (SELECT a FROM t) SELECT x FROM c", "x")).toEqual(["t.a"]);
	});

	it("expands a star and traces each output (needs schema)", () => {
		expect(origins("SELECT * FROM t", "a", new Schema({ t: { a: "int", b: "int" } }))).toEqual(["t.a"]);
	});

	it("traces a star through a star CTE (SELECT * FROM (SELECT * FROM t))", () => {
		expect(origins("WITH c AS (SELECT * FROM t) SELECT * FROM c", "a", new Schema({ t: { a: "int" } }))).toEqual([
			"t.a",
		]);
	});

	it("unions origins across a set operation", () => {
		expect(origins("SELECT a FROM t UNION SELECT b FROM u", "a")).toEqual(["t.a", "u.b"]);
	});

	it("traces a scalar subquery's value column", () => {
		expect(origins("SELECT (SELECT max(x) FROM u) AS m FROM t", "m")).toEqual(["u.x"]);
	});

	it("traces through two CTE hops", () => {
		expect(origins("WITH a AS (SELECT c1 FROM t), b AS (SELECT c1 AS c2 FROM a) SELECT c2 FROM b", "c2")).toEqual([
			"t.c1",
		]);
	});
});

// The corpus-scale lineage gate moved to tests/corpus/databricks.oatly.test.ts (one pass over the
// Oatly corpus, shared with the other Databricks pipeline gates). The unit cases stay here.
