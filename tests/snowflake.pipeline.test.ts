import { describe, expect, it } from "vitest";
import { inferType } from "../src/infer/infer.js";
import { lineage } from "../src/lineage/lineage.js";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";
import { lower } from "../src/snowflake/lower.js";
import { parseSnowflake } from "../src/snowflake/parse.js";

// The point of the shared IR: the semantic layer (scope, qualify, infer, lineage, symbols)
// runs on Snowflake-lowered queries unchanged. These tests prove a Snowflake query flows
// through every semantic stage, and that inference uses Snowflake's knowledge (literals,
// function registry, type aliases) rather than another dialect's.

function scopes(sql: string) {
	return resolveScopes(lower(parseSnowflake(sql).tree), "snowflake");
}

function typeOf(sql: string, schema = new Schema({})) {
	const tree = scopes(sql);
	const body = tree.root.body;
	if (body.kind !== "select") throw new Error("expected select");
	return inferType(body.projections[0].expr, tree.root, schema);
}

const T = new Schema({ t: { a: "number", s: "varchar", ts: "timestamp_ntz", v: "variant" } });

describe("Snowflake scope resolution", () => {
	it("resolves CTEs and table aliases", () => {
		const tree = scopes("WITH c AS (SELECT a FROM t) SELECT c.a FROM c");
		expect(tree.root.body.kind).toBe("select");
		// the CTE is visible as a source in the root scope
		const names = [...tree.root.sources.keys()];
		expect(names).toContain("c");
	});

	it("exposes FLATTEN's lateral columns to the scope", () => {
		const tree = scopes("SELECT f.value FROM t, LATERAL FLATTEN(input => t.v) f");
		expect([...tree.root.sources.keys()]).toContain("f");
	});
});

describe("Snowflake qualify (star expansion + diagnostics)", () => {
	it("expands * against a schema and reports unknown columns", () => {
		const tree = scopes("SELECT * FROM t WHERE nope > 1");
		const result = qualify(tree, T);
		expect(result.diagnostics.some((d) => d.kind === "unknown-column" && d.message.includes("nope"))).toBe(true);
	});
});

describe("Snowflake lineage", () => {
	it("traces an output column through a CTE to its base table", () => {
		const tree = scopes("WITH c AS (SELECT a FROM t) SELECT a AS out_a FROM c");
		const cols = lineage(tree, T);
		const out = cols.find((c) => c.output === "out_a");
		expect(out?.origins.map((o) => `${o.table.join(".")}.${o.column}`)).toContain("t.a");
	});
});

describe("Snowflake symbols", () => {
	it("derives symbols over the scope tree", () => {
		const syms = deriveSymbols(scopes("SELECT a, s FROM t"), T);
		expect(syms.length).toBeGreaterThan(0);
	});
});

describe("Snowflake type inference (dialect-specific knowledge)", () => {
	it("types a decimal literal as decimal (NUMBER), not double", () => {
		expect(typeOf("SELECT 1.5 AS x")).toEqual({ kind: "scalar", name: "decimal" });
	});

	it("IFF returns the common type of its branches", () => {
		expect(typeOf("SELECT IFF(a > 0, 'p', 'n') AS x FROM t", T)).toEqual({ kind: "scalar", name: "string" });
	});

	it("ZEROIFNULL keeps its argument's type", () => {
		expect(typeOf("SELECT ZEROIFNULL(a) AS x FROM t", T)).toEqual({ kind: "scalar", name: "decimal" });
	});

	it("LISTAGG returns string", () => {
		expect(typeOf("SELECT LISTAGG(s, ',') AS x FROM t GROUP BY a", T)).toEqual({ kind: "scalar", name: "string" });
	});

	it("CURRENT_WAREHOUSE returns string", () => {
		expect(typeOf("SELECT CURRENT_WAREHOUSE() AS x")).toEqual({ kind: "scalar", name: "string" });
	});

	it("DATEADD returns its date argument's type", () => {
		expect(typeOf("SELECT DATEADD(day, 7, ts) AS x FROM t", T)).toEqual({ kind: "scalar", name: "timestamp" });
	});

	it("casts via :: use Snowflake type aliases (NUMBER → decimal, TIMESTAMP_NTZ → timestamp)", () => {
		expect(typeOf("SELECT s::NUMBER(10,2) AS x FROM t", T)).toEqual({ kind: "scalar", name: "decimal" });
		expect(typeOf("SELECT s::TIMESTAMP_NTZ AS x FROM t", T)).toEqual({ kind: "scalar", name: "timestamp" });
	});

	it("PARSE_JSON returns variant", () => {
		expect(typeOf("SELECT PARSE_JSON(s) AS x FROM t", T)).toEqual({ kind: "scalar", name: "variant" });
	});

	it("TO_NUMBER returns decimal; TO_DOUBLE returns double", () => {
		expect(typeOf("SELECT TO_NUMBER(s) AS x FROM t", T)).toEqual({ kind: "scalar", name: "decimal" });
		expect(typeOf("SELECT TO_DOUBLE(s) AS x FROM t", T)).toEqual({ kind: "scalar", name: "double" });
	});

	it("int/int division is non-integer (Snowflake decimal division)", () => {
		const got = typeOf("SELECT 10/3 AS x");
		expect(got).not.toEqual({ kind: "scalar", name: "int" });
	});
});
