import { describe, expect, it } from "vitest";
import { lower as lowerDbx } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { inferType } from "../src/infer/infer.js";
import { BIGQUERY_FUNCTION_RETURNS } from "../src/bigquery/infer.js";
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
		// TINYINT, not the int this test used to pin: Spark's own analyzer types getbit
		// tinyint (v4.2.0 sql-tests goldens, bitwise.sql.out) — the old expectation was our
		// misreading, caught by the external gate.
		expect(dbxType("SELECT getbit(big, 0) AS r FROM t", D)).toEqual(scalar("tinyint"));
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

// --- BigQuery / GoogleSQL registry --------------------------------------------------------------
// Rule-level probes over BIGQUERY_FUNCTION_RETURNS (the registry keys feed inference — hover types,
// inlay hints — not completion, which is an ATN/token-driven walk with no registry dependency).
// Built out family-by-family from the GoogleSQL reference, every family's alphabetical index verified
// live (2026-07-02). A missing rule yields `unknown`, so each of these failed before the entry existed.
//
// BREADTH FLOOR NOTE: the parity-wave brief set a ≥400 breadth target. The genuinely-determinable
// GoogleSQL scalar/aggregate/window surface, under the project's ABSOLUTE never-wrong contract
// (a wrong return type is a defect; value-dependent returns are omitted), is 353 entries across all
// 30 documented function families. (2026-07-02 B/C/D closing wave, Task 1: dotted families are now
// keyed by their full qualified path — `hll_count.*`, `kll_quantiles.*`, `net.*`, `aead.*`, `keys.*`
// — instead of the last path segment, which +2'd the count vs. the prior 351: `hll_count.extract`
// regained its documented INT64 now that it no longer collides with bare EXTRACT, and the formerly
// shared `merge_partial` key split into `hll_count.merge_partial` + `kll_quantiles.merge_partial`.
// The prior corrections still hold: 4 phantom KLL_QUANTILES *_uint64 keys were dropped — no UINT64
// variant exists, only INT64/FLOAT64 — and the 2 real MERGE_POINT_INT64/MERGE_POINT_FLOAT64 keys
// were added.) The remaining functions are value-dependent (bare EXTRACT is now a typed special form,
// see below; PERCENTILE_CONT/DISC, APPROX_TOP_COUNT/SUM, ARRAY_SUM/ARRAY_AVG, ST_BOUNDINGBOX/EXTENT/
// REGIONSTATS, KEYS.KEYSET_TO_JSON, JSON_FLATTEN), table-valued (VECTOR_SEARCH, GAP_FILL,
// EXTERNAL_QUERY), or AI/ML (excluded by the project scope). 400 typed entries cannot be reached
// without inventing return types, so the floor is pinned at the achieved, defensible count.
const BQ_FLOOR = 353;
const bqRule = (n: string, args: Type[] = []) => BIGQUERY_FUNCTION_RETURNS[n]?.(args);
const arr = (el: Type): Type => ({ kind: "array", element: el });

describe("BigQuery registry: breadth + family spot checks (docs-verified)", () => {
	it("covers the documented GoogleSQL surface at real breadth", () => {
		expect(Object.keys(BIGQUERY_FUNCTION_RETURNS).length).toBeGreaterThanOrEqual(BQ_FLOOR);
	});

	// Dotted-name families (net.*, hll_count.*, kll_quantiles.*, aead.*, keys.*) key by their FULL
	// qualified path — lowerFunctionCall sets `qualifier` from the segments before the last, and
	// functionType looks up `qualifier.name` first — so these probe the qualified key the parser looks
	// up, and the bare last segment must NOT resolve (a bare `merge(...)` is not HLL_COUNT.MERGE).
	it("dotted-name families key by their full qualified path", () => {
		expect(bqRule("net.ip_from_string")).toEqual(scalar("binary")); // net.ip_from_string → BYTES
		expect(bqRule("net.ip_to_string")).toEqual(scalar("string")); // net.ip_to_string → STRING
		expect(bqRule("net.ipv4_to_int64")).toEqual(scalar("int")); // net.ipv4_to_int64 → INT64
		expect(bqRule("hll_count.merge")).toEqual(scalar("int")); // hll_count.merge → INT64 cardinality
		expect(bqRule("hll_count.init")).toEqual(scalar("binary")); // hll_count.init → BYTES sketch
		expect(bqRule("hll_count.extract")).toEqual(scalar("int")); // hll_count.extract → INT64 (regained; no longer collides with bare EXTRACT)
		expect(bqRule("hll_count.merge_partial")).toEqual(scalar("binary")); // → BYTES
		expect(bqRule("kll_quantiles.merge_partial")).toEqual(scalar("binary")); // → BYTES (formerly shared with hll_count)
		expect(bqRule("kll_quantiles.extract_point_float64")).toEqual(scalar("double")); // kll_quantiles.extract_point_float64
		expect(bqRule("kll_quantiles.merge_float64")).toEqual(arr(scalar("double"))); // → ARRAY<FLOAT64>
		expect(bqRule("aead.encrypt")).toEqual(scalar("binary")); // aead.encrypt → BYTES
		expect(bqRule("aead.decrypt_string")).toEqual(scalar("string")); // aead.decrypt_string → STRING
		// Bare last segments no longer resolve — a bare call must NOT borrow a dotted family's rule.
		expect(bqRule("merge")).toBeUndefined();
		expect(bqRule("init")).toBeUndefined();
		expect(bqRule("encrypt")).toBeUndefined();
		expect(bqRule("ip_from_string")).toBeUndefined();
	});

	// Regression lock for the parity-wave Task 4 fix round: both were briefly wrong (a phantom KLL
	// UINT64 review pass and an earlier net-family typing pass mis-typed them) before landing on the
	// doc-verified types below. A re-reversal must fail this test.
	it("holds the Task 4 fix round: ip_net_mask and merge_point_float64 stay correctly typed", () => {
		expect(bqRule("net.ip_net_mask")).toEqual(scalar("binary")); // net.ip_net_mask → BYTES
		expect(bqRule("kll_quantiles.merge_point_float64")).toEqual(scalar("double")); // kll_quantiles.merge_point_float64 → FLOAT64
	});

	it("geography returns GEOGRAPHY / FLOAT64 / BOOL / INT64 / STRING correctly", () => {
		expect(bqRule("st_geogfromtext")).toEqual(scalar("geography"));
		expect(bqRule("st_distance")).toEqual(scalar("double"));
		expect(bqRule("st_contains")).toEqual(scalar("boolean"));
		expect(bqRule("st_npoints")).toEqual(scalar("int"));
		expect(bqRule("st_astext")).toEqual(scalar("string"));
		expect(bqRule("st_dump")).toEqual(arr(scalar("geography")));
	});

	it("date/timestamp diffs return INT64; constructors keep their type", () => {
		expect(bqRule("timestamp_diff")).toEqual(scalar("int"));
		expect(bqRule("date_diff")).toEqual(scalar("int"));
		expect(bqRule("unix_micros")).toEqual(scalar("int"));
		expect(bqRule("parse_timestamp")).toEqual(scalar("timestamp"));
		expect(bqRule("make_interval")).toEqual(scalar("interval"));
	});

	it("JSON split: json_query→JSON, json_value→STRING, arrays wrap their element", () => {
		expect(bqRule("json_query")).toEqual(scalar("json"));
		expect(bqRule("json_value")).toEqual(scalar("string"));
		expect(bqRule("to_json")).toEqual(scalar("json")); // TO_JSON → JSON (TO_JSON_STRING → STRING)
		expect(bqRule("to_json_string")).toEqual(scalar("string"));
		expect(bqRule("json_query_array")).toEqual(arr(scalar("json")));
		expect(bqRule("json_value_array")).toEqual(arr(scalar("string")));
	});

	it("aggregate / approximate / navigation follow input where documented", () => {
		expect(bqRule("approx_count_distinct")).toEqual(scalar("int"));
		expect(bqRule("count")).toEqual(scalar("int"));
		expect(bqRule("logical_and")).toEqual(scalar("boolean"));
		expect(bqRule("lag", [scalar("date")])).toEqual(scalar("date")); // navigation follows input
		expect(bqRule("array_agg", [scalar("string")])).toEqual(arr(scalar("string")));
		expect(bqRule("array_first", [arr(scalar("int"))])).toEqual(scalar("int")); // element of the array
	});

	it("math: FLOAT64 transcendentals, same-as-input rounding, INT64 div", () => {
		expect(bqRule("sqrt")).toEqual(scalar("double"));
		expect(bqRule("cosine_distance")).toEqual(scalar("double"));
		expect(bqRule("div", [scalar("int"), scalar("int")])).toEqual(scalar("int")); // INT64 → INT64 (arg-type computed)
		expect(bqRule("safe_divide")).toEqual(scalar("double"));
		expect(bqRule("abs", [scalar("bigint")])).toEqual(scalar("bigint")); // same numeric type as input
	});

	it("string / hash / bit families", () => {
		expect(bqRule("contains_substr")).toEqual(scalar("boolean"));
		expect(bqRule("edit_distance")).toEqual(scalar("int"));
		expect(bqRule("to_code_points")).toEqual(arr(scalar("int")));
		expect(bqRule("sha256")).toEqual(scalar("binary"));
		expect(bqRule("farm_fingerprint")).toEqual(scalar("int"));
		expect(bqRule("bit_count")).toEqual(scalar("int"));
	});

	// Absent-by-contract: value-dependent returns must yield `unknown`, never a guessed type.
	it("value-dependent functions stay unknown (never a wrong type)", () => {
		expect(bqRule("approx_top_count")).toBeUndefined();
		expect(bqRule("percentile_cont")).toBeUndefined();
		expect(bqRule("st_boundingbox")).toBeUndefined();
		expect(bqRule("array_sum")).toBeUndefined();
		// Bare EXTRACT(part FROM …) has NO registry key — its return type depends on the datepart
		// keyword, which no FnRule can see, so it is a typed special form (functionType's EXTRACT
		// hook), not a registry entry. The bare `extract` key stays absent; the dotted
		// `hll_count.extract` is a separate qualified key (asserted above).
		expect(BIGQUERY_FUNCTION_RETURNS["extract"]).toBeUndefined();
	});
});
