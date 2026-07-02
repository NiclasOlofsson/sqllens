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

// Never-wrong engine follow-ups (parity-wave B/C/D closing wave, Task 1). Each probes a lowered call
// through the full pipeline — not just the registry object — so the qualifier threading and the
// EXTRACT special form are exercised end to end.
describe("BigQuery never-wrong follow-ups: qualified keys, EXTRACT, computed avg/div/generate_array", () => {
	const int = { kind: "scalar", name: "int" } as const;
	const dbl = { kind: "scalar", name: "double" } as const;
	const dec = { kind: "scalar", name: "decimal" } as const;
	const N = new Schema({
		"proj.ds.n": { i: "INT64", f: "FLOAT64", num: "NUMERIC", bnum: "BIGNUMERIC", ts: "TIMESTAMP", sk: "BYTES" },
	});

	// 1a — a qualified dotted call keys by its full path, so HLL_COUNT.EXTRACT regains its documented
	// INT64 without colliding with bare EXTRACT.
	it("HLL_COUNT.EXTRACT resolves to INT64 via its qualified key", () => {
		expect(typeOf("SELECT HLL_COUNT.EXTRACT(sk) AS x FROM `proj.ds.n`", N)).toEqual(int);
	});

	// 1b — EXTRACT is typed by its datepart keyword.
	it("EXTRACT types by its datepart keyword", () => {
		expect(typeOf("SELECT EXTRACT(YEAR FROM ts) AS x FROM `proj.ds.n`", N)).toEqual(int);
		expect(typeOf("SELECT EXTRACT(WEEK(MONDAY) FROM ts) AS x FROM `proj.ds.n`", N)).toEqual(int);
		expect(typeOf("SELECT EXTRACT(DATE FROM ts) AS x FROM `proj.ds.n`", N)).toEqual({
			kind: "scalar",
			name: "date",
		});
		expect(typeOf("SELECT EXTRACT(TIME FROM ts) AS x FROM `proj.ds.n`", N)).toEqual({
			kind: "scalar",
			name: "time",
		});
		expect(typeOf("SELECT EXTRACT(DATETIME FROM ts) AS x FROM `proj.ds.n`", N)).toEqual({
			kind: "scalar",
			name: "timestamp",
		});
		expect(typeOf("SELECT EXTRACT(bogus FROM ts) AS x FROM `proj.ds.n`", N)).toEqual({ kind: "unknown" });
	});

	// 1c — avg / div / generate_array are argument-TYPE-computed (not value-dependent).
	it("AVG follows the argument's numeric type", () => {
		expect(typeOf("SELECT AVG(i) AS x FROM `proj.ds.n`", N)).toEqual(dbl); // INT64 → FLOAT64
		expect(typeOf("SELECT AVG(f) AS x FROM `proj.ds.n`", N)).toEqual(dbl); // FLOAT64 → FLOAT64
		expect(typeOf("SELECT AVG(num) AS x FROM `proj.ds.n`", N)).toEqual(dec); // NUMERIC → NUMERIC
		expect(typeOf("SELECT AVG(bnum) AS x FROM `proj.ds.n`", N)).toEqual(dec); // BIGNUMERIC → BIGNUMERIC
	});
	it("DIV follows integer / numeric argument types", () => {
		expect(typeOf("SELECT DIV(i, i) AS x FROM `proj.ds.n`", N)).toEqual(int); // INT64 → INT64
		expect(typeOf("SELECT DIV(num, num) AS x FROM `proj.ds.n`", N)).toEqual(dec); // NUMERIC → NUMERIC
	});
	it("GENERATE_ARRAY element type follows the arguments", () => {
		expect(typeOf("SELECT GENERATE_ARRAY(1, 10) AS x")).toEqual({ kind: "array", element: int });
		expect(typeOf("SELECT GENERATE_ARRAY(1.0, 5.0, 0.5) AS x")).toEqual({ kind: "array", element: dbl });
	});
});

// Task 7 (B/C/D closing wave): the constructor / WITH / REPLACE_FIELDS forms flow through the semantic
// layer. A braced struct constructor types as a STRUCT with its field names+types (named_struct shape);
// proto constructors (NEW / REPLACE_FIELDS) stay `unknown` (the proto type is unknowable — never-wrong);
// a WITH expression types as its result (bindings are not substituted — the documented boundary).
describe("BigQuery constructor / WITH forms flow through inference", () => {
	const int = { kind: "scalar", name: "int" } as const;
	const S = new Schema({ "proj.ds.s": { id: "INT64", name: "STRING" } });

	it("a braced struct constructor types as a STRUCT with its field names and value types", () => {
		expect(typeOf("SELECT {a: 1, b: id} AS r FROM `proj.ds.s`", S)).toEqual({
			kind: "struct",
			fields: [
				{ name: "a", type: int },
				{ name: "b", type: int },
			],
		});
	});

	it("proto constructors stay unknown (never-wrong): NEW T{…} and REPLACE_FIELDS", () => {
		expect(typeOf("SELECT NEW googlesql_test.KitchenSinkPB {int64_key_1: id} AS r FROM `proj.ds.s`", S)).toEqual({
			kind: "unknown",
		});
		expect(typeOf("SELECT REPLACE_FIELDS(id, 1 AS f) AS r FROM `proj.ds.s`", S)).toEqual({ kind: "unknown" });
	});

	it("a WITH expression types as its result and resolves scopes without throwing", () => {
		// bindings aren't substituted, so `x` in the result resolves as a plain column ref (unknown here) —
		// the accepted boundary; the point is the pipeline runs and the form types as the result expression.
		expect(typeOf("SELECT WITH(x AS id + 1, id * 2) AS r FROM `proj.ds.s`", S)).toEqual(int);
		const tree = scopes("SELECT WITH(x AS id + 1, x) AS r FROM `proj.ds.s`");
		expect(deriveSymbols(tree, S).length).toBeGreaterThan(0);
	});
});
