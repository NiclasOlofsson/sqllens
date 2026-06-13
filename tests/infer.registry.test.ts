import { describe, expect, it } from "vitest";
import { lower as lowerDbx } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { inferType } from "../src/infer/infer.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { lower as lowerTsql } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";
import type { Type } from "../src/infer/types.js";

// Registry entries added from the official function references (return types fetched and
// verified against docs.databricks.com / learn.microsoft.com, 2026-06-10). One probe per
// rule shape plus samples per family; a missing entry yields `unknown`, so each of these
// failed before the entries existed.

function dbxType(sql: string, schema: Schema): Type {
	const tree = resolveScopes(lowerDbx(parseDatabricks(sql).tree), "databricks");
	const body = tree.root.body;
	if (body.kind !== "select") throw new Error("expected select");
	return inferType(body.projections[0].expr, tree.root, schema);
}

function tsqlType(sql: string, schema: Schema): Type {
	const tree = resolveScopes(lowerTsql(parseTSql(sql).tree), "tsql");
	const body = tree.root.body;
	if (body.kind !== "select") throw new Error("expected select");
	return inferType(body.projections[0].expr, tree.root, schema);
}

const scalar = (name: string): Type => ({ kind: "scalar", name });

const D = new Schema({
	t: {
		a: "int",
		big: "bigint",
		s: "string",
		v: "variant",
		g: "geometry",
		bin: "binary",
		m: "map<string,int>",
		arr: "array<string>",
		aa: "array<array<int>>",
	},
});

describe("Databricks registry: specialty families (docs-verified)", () => {
	it("h3: fixed and same-as-input rules", () => {
		expect(dbxType("SELECT h3_longlatash3(1.0, 2.0, 7) AS r FROM t", D)).toEqual(scalar("bigint"));
		expect(dbxType("SELECT h3_kring(big, 1) AS r FROM t", D)).toEqual({ kind: "array", element: scalar("bigint") });
		expect(dbxType("SELECT h3_ispentagon(big) AS r FROM t", D)).toEqual(scalar("boolean"));
	});

	it("st: constructors, measures, predicates, accessors", () => {
		expect(dbxType("SELECT st_geomfromtext('POINT(0 0)') AS r FROM t", D)).toEqual(scalar("geometry"));
		expect(dbxType("SELECT st_area(g) AS r FROM t", D)).toEqual(scalar("double"));
		expect(dbxType("SELECT st_contains(g, g) AS r FROM t", D)).toEqual(scalar("boolean"));
		expect(dbxType("SELECT st_astext(g) AS r FROM t", D)).toEqual(scalar("string"));
		expect(dbxType("SELECT st_npoints(g) AS r FROM t", D)).toEqual(scalar("int"));
	});

	it("ai: string generators and float similarity", () => {
		expect(dbxType("SELECT ai_summarize(s) AS r FROM t", D)).toEqual(scalar("string"));
		expect(dbxType("SELECT ai_similarity(s, s) AS r FROM t", D)).toEqual(scalar("float"));
	});

	it("ip: fixed and same-as-input rules", () => {
		expect(dbxType("SELECT ip_version('1.2.3.4') AS r FROM t", D)).toEqual(scalar("int"));
		expect(dbxType("SELECT ip_host(s, 24) AS r FROM t", D)).toEqual(scalar("string"));
	});

	it("variant: parse_json, variant_get arity rule", () => {
		expect(dbxType("SELECT parse_json(s) AS r FROM t", D)).toEqual(scalar("variant"));
		expect(dbxType("SELECT variant_get(v, '$.a') AS r FROM t", D)).toEqual(scalar("variant"));
		expect(dbxType("SELECT variant_get(v, '$.a', 'int') AS r FROM t", D)).toEqual({ kind: "unknown" });
		expect(dbxType("SELECT is_variant_null(v) AS r FROM t", D)).toEqual(scalar("boolean"));
	});

	it("map constructors and accessors", () => {
		expect(dbxType("SELECT map_from_arrays(arr, arr) AS r FROM t", D)).toEqual({
			kind: "map",
			key: scalar("string"),
			value: scalar("string"),
		});
		expect(dbxType("SELECT map_entries(m) AS r FROM t", D)).toEqual({
			kind: "array",
			element: {
				kind: "struct",
				fields: [
					{ name: "key", type: scalar("string") },
					{ name: "value", type: scalar("int") },
				],
			},
		});
		expect(dbxType("SELECT map_filter(m, (k, x) -> x > 1) AS r FROM t", D)).toEqual({
			kind: "map",
			key: scalar("string"),
			value: scalar("int"),
		});
	});

	it("time family", () => {
		expect(dbxType("SELECT to_time(s) AS r FROM t", D)).toEqual(scalar("time"));
		expect(dbxType("SELECT time_to_seconds(to_time(s)) AS r FROM t", D)).toEqual(scalar("decimal"));
		expect(dbxType("SELECT time_diff('HOUR', to_time(s), to_time(s)) AS r FROM t", D)).toEqual(scalar("bigint"));
	});

	it("try_* arithmetic mirrors the base operators", () => {
		expect(dbxType("SELECT try_divide(a, a) AS r FROM t", D)).toEqual(scalar("double"));
		expect(dbxType("SELECT try_add(a, big) AS r FROM t", D)).toEqual(scalar("bigint"));
		expect(dbxType("SELECT try_to_number(s, '999') AS r FROM t", D)).toEqual(scalar("decimal"));
	});

	it("regr family", () => {
		expect(dbxType("SELECT regr_slope(a, a) AS r FROM t", D)).toEqual(scalar("double"));
		expect(dbxType("SELECT regr_count(a, a) AS r FROM t", D)).toEqual(scalar("bigint"));
	});

	it("strings, bits, misc", () => {
		expect(dbxType("SELECT left(s, 2) AS r FROM t", D)).toEqual(scalar("string"));
		expect(dbxType("SELECT len(s) AS r FROM t", D)).toEqual(scalar("int"));
		expect(dbxType("SELECT charindex('a', s) AS r FROM t", D)).toEqual(scalar("int"));
		expect(dbxType("SELECT getdate() AS r FROM t", D)).toEqual(scalar("timestamp"));
		expect(dbxType("SELECT typeof(a) AS r FROM t", D)).toEqual(scalar("string"));
		expect(dbxType("SELECT luhn_check(s) AS r FROM t", D)).toEqual(scalar("boolean"));
		expect(dbxType("SELECT json_object_keys(s) AS r FROM t", D)).toEqual({
			kind: "array",
			element: scalar("string"),
		});
		expect(dbxType("SELECT getbit(big, 0) AS r FROM t", D)).toEqual(scalar("int"));
		expect(dbxType("SELECT array_join(arr, ',') AS r FROM t", D)).toEqual(scalar("string"));
		expect(dbxType("SELECT flatten(aa) AS r FROM t", D)).toEqual({ kind: "array", element: scalar("int") });
		expect(dbxType("SELECT uniform(0, 10) AS r FROM t", D)).toEqual(scalar("int"));
	});

	it("bitmap + sketch-adjacent aggregates", () => {
		expect(dbxType("SELECT bitmap_count(bin) AS r FROM t", D)).toEqual(scalar("bigint"));
		expect(dbxType("SELECT bitmap_construct_agg(bitmap_bit_position(a)) AS r FROM t", D)).toEqual(scalar("binary"));
	});
});

const T = new Schema({ t: { a: "bigint", s: "varchar", j: "nvarchar" } });

describe("T-SQL registry: 2022/2025 additions and system functions (docs-verified)", () => {
	it("bit manipulation (2022)", () => {
		expect(tsqlType("SELECT BIT_COUNT(a) AS r FROM t", T)).toEqual(scalar("bigint"));
		expect(tsqlType("SELECT GET_BIT(a, 1) AS r FROM t", T)).toEqual(scalar("boolean"));
		expect(tsqlType("SELECT LEFT_SHIFT(a, 1) AS r FROM t", T)).toEqual(scalar("bigint"));
	});

	it("any_value returns its argument's type", () => {
		expect(tsqlType("SELECT ANY_VALUE(s) AS r FROM t", T)).toEqual(scalar("string"));
	});

	it("regex family (2025)", () => {
		expect(tsqlType("SELECT REGEXP_COUNT(s, 'x') AS r FROM t", T)).toEqual(scalar("int"));
		expect(tsqlType("SELECT REGEXP_LIKE(s, 'x') AS r FROM t", T)).toEqual(scalar("boolean"));
		expect(tsqlType("SELECT REGEXP_SUBSTR(s, 'x') AS r FROM t", T)).toEqual(scalar("string"));
	});

	it("fuzzy match (2025)", () => {
		expect(tsqlType("SELECT EDIT_DISTANCE(s, s) AS r FROM t", T)).toEqual(scalar("int"));
		expect(tsqlType("SELECT JARO_WINKLER_DISTANCE(s, s) AS r FROM t", T)).toEqual(scalar("double"));
		expect(tsqlType("SELECT JARO_WINKLER_SIMILARITY(s, s) AS r FROM t", T)).toEqual(scalar("int"));
	});

	it("json additions", () => {
		expect(tsqlType("SELECT JSON_CONTAINS(j, N'1', '$.a') AS r FROM t", T)).toEqual(scalar("int"));
		expect(tsqlType("SELECT JSON_ARRAYAGG(s) AS r FROM t", T)).toEqual(scalar("string"));
	});

	it("encoding and vectors (2025)", () => {
		expect(tsqlType("SELECT BASE64_DECODE(s) AS r FROM t", T)).toEqual(scalar("binary"));
		expect(tsqlType("SELECT BASE64_ENCODE(CAST(s AS varbinary)) AS r FROM t", T)).toEqual(scalar("string"));
		expect(tsqlType("SELECT VECTOR_DISTANCE('cosine', s, s) AS r FROM t", T)).toEqual(scalar("double"));
	});

	it("system / metadata functions", () => {
		expect(tsqlType("SELECT EVENTDATA() AS r FROM t", T)).toEqual(scalar("xml"));
		expect(tsqlType("SELECT SUSER_SID() AS r FROM t", T)).toEqual(scalar("binary"));
		expect(tsqlType("SELECT CURSOR_STATUS('global', s) AS r FROM t", T)).toEqual(scalar("smallint"));
		expect(tsqlType("SELECT DATABASE_PRINCIPAL_ID() AS r FROM t", T)).toEqual(scalar("int"));
		expect(tsqlType("SELECT OBJECT_DEFINITION(1) AS r FROM t", T)).toEqual(scalar("string"));
		expect(tsqlType("SELECT IDENT_INCR(s) AS r FROM t", T)).toEqual(scalar("decimal"));
		expect(tsqlType("SELECT ENCRYPTBYPASSPHRASE(s, s) AS r FROM t", T)).toEqual(scalar("binary"));
		expect(tsqlType("SELECT TEXTVALID(s, a) AS r FROM t", T)).toEqual(scalar("int"));
	});
});
