import { describe, it, expect } from "vitest";
import { parseRedshift } from "../src/redshift/parse.js";
import { lower } from "../src/redshift/lower.js";
import { resolveScopes } from "../src/scope/scope.js";
import { inferType } from "../src/infer/infer.js";
import { Schema } from "../src/qualify/schema.js";
import {
	redshiftParseType,
	REDSHIFT_ALIASES,
	redshiftLiteral,
	REDSHIFT_FUNCTION_RETURNS,
} from "../src/redshift/infer.js";
import { scalar, UNKNOWN } from "../src/infer/types.js";

describe("redshift inference", () => {
	it("maps Postgres scalar names to canonical types", () => {
		expect(redshiftParseType("int4")).toEqual({ kind: "scalar", name: "int" });
		expect(redshiftParseType("int8")).toEqual({ kind: "scalar", name: "bigint" });
		expect(redshiftParseType("float8")).toEqual({ kind: "scalar", name: "double" });
		expect(redshiftParseType("numeric(10,2)")).toEqual({ kind: "scalar", name: "decimal" });
		expect(redshiftParseType("character varying")).toEqual({ kind: "scalar", name: "string" });
		expect(REDSHIFT_ALIASES.int2).toBe("smallint");
	});

	it("integer/integer divides to int (Redshift truncates)", () => {
		const sql = "SELECT a / b AS r FROM t";
		const scopes = resolveScopes(lower(parseRedshift(sql).tree), "redshift");
		const schema = new Schema({ t: { a: "int4", b: "int4" } });
		// locate the division expr in the root select's projection
		const body = scopes.root.body as any;
		const div = body.projections[0].expr;
		expect(inferType(div, scopes.root, schema)).toEqual({ kind: "scalar", name: "int" });
	});

	it("a known base-table column infers its schema type", () => {
		const sql = "SELECT amount FROM sales";
		const scopes = resolveScopes(lower(parseRedshift(sql).tree), "redshift");
		const schema = new Schema({ sales: { amount: "numeric(10,2)" } });
		const col = (scopes.root.body as any).projections[0].expr;
		expect(inferType(col, scopes.root, schema)).toEqual({ kind: "scalar", name: "decimal" });
	});
});

describe("redshift literal typing", () => {
	it("types a decimal-point literal as decimal, not double (AWS r_numeric_literals671)", () => {
		expect(redshiftLiteral("1.5")).toEqual(scalar("decimal"));
	});
	it("types an exponent literal as double (float8)", () => {
		expect(redshiftLiteral("1.5e3")).toEqual(scalar("double"));
	});
	it("types a bare integer as int", () => {
		expect(redshiftLiteral("42")).toEqual(scalar("int"));
	});
	it("does NOT treat double-quoted text as a string (identifiers in Redshift)", () => {
		expect(redshiftLiteral('"col"')).toEqual(UNKNOWN);
	});
	it("types typed literals", () => {
		expect(redshiftLiteral("date '2026-01-01'")).toEqual(scalar("date"));
		expect(redshiftLiteral("timestamp '2026-01-01 00:00:00'")).toEqual(scalar("timestamp"));
		expect(redshiftLiteral("interval '1 day'")).toEqual(scalar("interval"));
	});
	it("NULL is unknown, never guessed", () => {
		expect(redshiftLiteral("NULL")).toEqual(UNKNOWN);
	});
});

describe("redshift function registry", () => {
	const rule = (name: string, args: ReturnType<typeof scalar>[] = []) => REDSHIFT_FUNCTION_RETURNS[name]?.(args);

	it("covers the documented AWS surface at real breadth", () => {
		expect(Object.keys(REDSHIFT_FUNCTION_RETURNS).length).toBeGreaterThanOrEqual(200);
	});
	it("date/time: datediff is BIGINT, date_part is DOUBLE, dateadd is TIMESTAMP for date input", () => {
		expect(rule("datediff")).toEqual(scalar("bigint"));
		expect(rule("date_part")).toEqual(scalar("double"));
		expect(rule("dateadd", [scalar("string"), scalar("int"), scalar("date")])).toEqual(scalar("timestamp"));
	});
	it("aggregates: sum widens int->bigint; avg of int is bigint, of decimal is decimal, of double is double", () => {
		// AWS r_AVG: BIGINT for any integer argument, DOUBLE for float, same-as-input otherwise.
		expect(rule("sum", [scalar("int")])).toEqual(scalar("bigint"));
		expect(rule("avg", [scalar("int")])).toEqual(scalar("bigint"));
		expect(rule("avg", [scalar("decimal")])).toEqual(scalar("decimal"));
		expect(rule("avg", [scalar("double")])).toEqual(scalar("double"));
	});
	it("SUPER family: json_parse -> super, json_extract_path_text -> string, is_array -> boolean", () => {
		expect(rule("json_parse")).toEqual(scalar("super"));
		expect(rule("json_extract_path_text")).toEqual(scalar("string"));
		expect(rule("is_array")).toEqual(scalar("boolean"));
	});
	it("windows: row_number -> bigint, ratio_to_report -> double, lag follows its input", () => {
		expect(rule("row_number")).toEqual(scalar("bigint"));
		expect(rule("ratio_to_report")).toEqual(scalar("double"));
		expect(rule("lag", [scalar("date")])).toEqual(scalar("date"));
	});
	it("spatial: st_distance -> double, st_intersects -> boolean, st_astext -> string", () => {
		expect(rule("st_distance")).toEqual(scalar("double"));
		expect(rule("st_intersects")).toEqual(scalar("boolean"));
		expect(rule("st_astext")).toEqual(scalar("string"));
	});
	it("conditional: decode types from its result args, not the search args", () => {
		// decode(expr, s1, r1, s2, r2, default): results at 2, 4 and the trailing default.
		expect(
			rule("decode", [
				scalar("int"),
				scalar("int"),
				scalar("string"),
				scalar("int"),
				scalar("string"),
				scalar("string"),
			]),
		).toEqual(scalar("string"));
	});
	it("absent-by-contract: arg-value-dependent functions stay unregistered", () => {
		expect(REDSHIFT_FUNCTION_RETURNS["extract"]).toBeUndefined();
		expect(REDSHIFT_FUNCTION_RETURNS["percentile_cont"]).toBeUndefined();
	});
});
