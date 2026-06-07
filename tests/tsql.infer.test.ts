import { describe, expect, it } from "vitest";
import { inferType } from "../src/infer/infer.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { lower } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";

// Type inference must use T-SQL's function/literal/type semantics, not Spark's, when the query was
// lowered from T-SQL. These cases were WRONG before per-dialect knowledge (ISNULL -> boolean via
// Spark's isnull predicate, COUNT -> bigint, LEN -> unknown). The dialect flows as a tag on the
// scope (resolveScopes(query, "tsql")); inferType selects the T-SQL knowledge table from it.

function tsqlType(sql: string, schema: Schema) {
	const tree = resolveScopes(lower(parseTSql(sql).tree), "tsql");
	const body = tree.root.body;
	if (body.kind !== "select") throw new Error("expected select");
	return inferType(body.projections[0].expr, tree.root, schema);
}

const T = new Schema({ t: { a: "bigint", s: "varchar" } });

describe("T-SQL type inference (dialect-specific knowledge)", () => {
	it("ISNULL(check, repl) returns the type of check (not boolean like Spark's isnull)", () => {
		expect(tsqlType("SELECT ISNULL(a, 0) AS r FROM t", T)).toEqual({ kind: "scalar", name: "bigint" });
	});

	it("COUNT(*) is int in T-SQL (not bigint like Spark)", () => {
		expect(tsqlType("SELECT COUNT(*) AS n FROM t", T)).toEqual({ kind: "scalar", name: "int" });
	});

	it("LEN returns int", () => {
		expect(tsqlType("SELECT LEN(s) AS n FROM t", T)).toEqual({ kind: "scalar", name: "int" });
	});

	it("GETDATE() is a timestamp", () => {
		expect(tsqlType("SELECT GETDATE() AS d FROM t", T)).toEqual({ kind: "scalar", name: "timestamp" });
	});

	it("CHARINDEX returns int", () => {
		expect(tsqlType("SELECT CHARINDEX('x', s) AS i FROM t", T)).toEqual({ kind: "scalar", name: "int" });
	});

	it("string functions return string", () => {
		expect(tsqlType("SELECT UPPER(s) AS u FROM t", T)).toEqual({ kind: "scalar", name: "string" });
		expect(tsqlType("SELECT LEFT(s, 3) AS l FROM t", T)).toEqual({ kind: "scalar", name: "string" });
	});

	it("CAST to a T-SQL type normalises to the shared canonical type (bit -> boolean)", () => {
		expect(tsqlType("SELECT CAST(a AS bit) AS b FROM t", T)).toEqual({ kind: "scalar", name: "boolean" });
		expect(tsqlType("SELECT CAST(s AS nvarchar(50)) AS v FROM t", T)).toEqual({ kind: "scalar", name: "string" });
	});

	it("an N'…' unicode literal is a string", () => {
		expect(tsqlType("SELECT N'hello' AS r FROM t", T)).toEqual({ kind: "scalar", name: "string" });
	});

	it("does not guess an unknown function (no rule -> unknown, never wrong)", () => {
		expect(tsqlType("SELECT SOME_UNKNOWN_FN(a) AS x FROM t", T)).toEqual({ kind: "unknown" });
	});

	it("a base-table column still types from the schema (engine still travels)", () => {
		expect(tsqlType("SELECT a AS r FROM t", T)).toEqual({ kind: "scalar", name: "bigint" });
	});
});

describe("T-SQL function registry (return types verified against MS docs)", () => {
	const N = new Schema({ t: { i: "int", b: "bigint", f: "float", n: "decimal", s: "varchar" } });
	const ty = (sql: string) => tsqlType(sql, N);

	it("SUM/AVG keep int as int (not bigint like Spark); bigint stays bigint", () => {
		expect(ty("SELECT SUM(i) AS r FROM t")).toEqual({ kind: "scalar", name: "int" });
		expect(ty("SELECT AVG(i) AS r FROM t")).toEqual({ kind: "scalar", name: "int" });
		expect(ty("SELECT SUM(b) AS r FROM t")).toEqual({ kind: "scalar", name: "bigint" });
	});

	it("MIN/MAX/ROUND/CEILING preserve the argument type", () => {
		expect(ty("SELECT MAX(f) AS r FROM t")).toEqual({ kind: "scalar", name: "double" });
		expect(ty("SELECT ROUND(i, 0) AS r FROM t")).toEqual({ kind: "scalar", name: "int" });
		expect(ty("SELECT CEILING(n) AS r FROM t")).toEqual({ kind: "scalar", name: "decimal" });
	});

	it("DEGREES is same-type-as-input; SQUARE/SQRT are float (per MS reference)", () => {
		expect(ty("SELECT DEGREES(f) AS r FROM t")).toEqual({ kind: "scalar", name: "double" });
		expect(ty("SELECT SQUARE(i) AS r FROM t")).toEqual({ kind: "scalar", name: "double" });
		expect(ty("SELECT SQRT(i) AS r FROM t")).toEqual({ kind: "scalar", name: "double" });
	});

	it("JSON_VALUE → string; ISJSON → int; NEWID → string", () => {
		expect(ty("SELECT JSON_VALUE(s, '$.a') AS r FROM t")).toEqual({ kind: "scalar", name: "string" });
		expect(ty("SELECT ISJSON(s) AS r FROM t")).toEqual({ kind: "scalar", name: "int" });
		expect(ty("SELECT NEWID() AS r FROM t")).toEqual({ kind: "scalar", name: "string" });
	});

	it("ROW_NUMBER → bigint; LAG keeps the value type", () => {
		expect(ty("SELECT ROW_NUMBER() OVER (ORDER BY i) AS r FROM t")).toEqual({ kind: "scalar", name: "bigint" });
		expect(ty("SELECT LAG(f) OVER (ORDER BY i) AS r FROM t")).toEqual({ kind: "scalar", name: "double" });
	});

	it("`/` is typed division in T-SQL (int / int → int, unlike Spark's double)", () => {
		expect(ty("SELECT i / i AS r FROM t")).toEqual({ kind: "scalar", name: "int" });
	});
});
