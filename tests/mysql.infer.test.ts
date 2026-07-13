import { describe, it, expect } from "vitest";
import { parseMysql } from "../src/mysql/parse.js";
import { lower } from "../src/mysql/lower.js";
import { resolveScopes } from "../src/scope/scope.js";
import { inferType } from "../src/infer/infer.js";
import { Schema } from "../src/qualify/schema.js";
import { mysqlLiteral, mysqlParseType, MYSQL_FUNCTION_RETURNS } from "../src/mysql/infer.js";
import { scalar, UNKNOWN } from "../src/infer/types.js";

// Seeded at B-R4 with the infer STUB's unit assertions (src/infer/mysql.ts was not yet wired into
// src/infer/dialect.ts). B-R5 wires it live, populates the FUNCTION_RETURNS registry and
// MYSQL_ALIASES from the MySQL 8.4 manual, and adds the division-mode wiring gate mirroring
// tests/sqlite.infer.test.ts's. The literal-typing block still pins MySQL's exact-vs-approximate
// numeric split (dev.mysql.com/doc/refman/8.4/en/precision-math-numbers.html): a fractional literal
// without an exponent is DECIMAL, NOT double — the B-R4 review caught the stub shipping sqlite's
// `double` here (correct for sqlite's five storage classes, wrong for MySQL).

describe("mysql division wiring", () => {
	it("integer / integer is exact-value DECIMAL division (arithmetic-functions.html), proving the mysql InferDialect is live", () => {
		const sql = "SELECT a / b AS r FROM t";
		const scopes = resolveScopes(lower(parseMysql(sql).tree), "mysql");
		const schema = new Schema({ t: { a: "int", b: "int" } });
		const body = scopes.root.body as any;
		const div = body.projections[0].expr;
		// If this fell through to the Databricks default ("float"), int/int division would widen to
		// double instead of staying decimal — this assertion only holds when mysql's own "decimal"
		// division mode is actually selected via inferDialect("mysql").
		expect(inferType(div, scopes.root, schema)).toEqual({ kind: "scalar", name: "decimal" });
	});
	it('a float operand widens the division result to double (arithmetic-functions.html: "the precision of the result is the precision of the operand with the maximum precision")', () => {
		const sql = "SELECT a / b AS r FROM t";
		const scopes = resolveScopes(lower(parseMysql(sql).tree), "mysql");
		const schema = new Schema({ t: { a: "double", b: "int" } });
		const body = scopes.root.body as any;
		const div = body.projections[0].expr;
		expect(inferType(div, scopes.root, schema)).toEqual({ kind: "scalar", name: "double" });
	});
});

describe("mysql literal typing", () => {
	it("types a bare integer as int (exact-value integer literal)", () => {
		expect(mysqlLiteral("42")).toEqual(scalar("int"));
	});
	it("types a fractional literal WITHOUT an exponent as decimal (exact-value: 3.5 is DECIMAL, not double)", () => {
		expect(mysqlLiteral("3.5")).toEqual(scalar("decimal"));
		expect(mysqlLiteral(".2")).toEqual(scalar("decimal"));
		expect(mysqlLiteral("-6.78")).toEqual(scalar("decimal"));
	});
	it("types scientific notation as double (approximate-value literal)", () => {
		expect(mysqlLiteral("1.2E3")).toEqual(scalar("double"));
		expect(mysqlLiteral("1e-5")).toEqual(scalar("double"));
	});
	it("types TRUE/FALSE as int (documented TINYINT(1) synonyms, not a boolean type)", () => {
		expect(mysqlLiteral("TRUE")).toEqual(scalar("int"));
		expect(mysqlLiteral("FALSE")).toEqual(scalar("int"));
	});
	it("types hexadecimal literals as binary (the documented context-free default: a binary string)", () => {
		expect(mysqlLiteral("X'4D'")).toEqual(scalar("binary"));
		expect(mysqlLiteral("0x4D")).toEqual(scalar("binary"));
	});
	it("NULL and bit-value literals are unknown, never guessed", () => {
		expect(mysqlLiteral("NULL")).toEqual(UNKNOWN);
		expect(mysqlLiteral("b'101'")).toEqual(UNKNOWN);
	});
});

describe("mysql scalar type aliases (MYSQL_ALIASES)", () => {
	it("INTEGER normalizes to int (documented synonym)", () => {
		expect(mysqlParseType("INTEGER")).toEqual(scalar("int"));
	});
	it("DEC/FIXED/NUMERIC normalize to decimal (documented DECIMAL synonyms)", () => {
		expect(mysqlParseType("DEC(10,2)")).toEqual(scalar("decimal"));
		expect(mysqlParseType("FIXED")).toEqual(scalar("decimal"));
		expect(mysqlParseType("NUMERIC")).toEqual(scalar("decimal"));
	});
	it("BOOL/BOOLEAN normalize to tinyint, NOT this module's shared boolean scalar (BOOL is a documented TINYINT(1) synonym, not a distinct storage class)", () => {
		expect(mysqlParseType("BOOL")).toEqual(scalar("tinyint"));
		expect(mysqlParseType("BOOLEAN")).toEqual(scalar("tinyint"));
	});
	it("REAL normalizes to double (REAL_AS_FLOAT off by default — the server-default REAL meaning)", () => {
		expect(mysqlParseType("REAL")).toEqual(scalar("double"));
	});
	it("DATETIME normalizes to timestamp (same shape every other dialect's alias table uses)", () => {
		expect(mysqlParseType("DATETIME")).toEqual(scalar("timestamp"));
	});
	it("SIGNED/UNSIGNED (CAST's restricted target keywords) normalize to bigint", () => {
		expect(mysqlParseType("SIGNED")).toEqual(scalar("bigint"));
		expect(mysqlParseType("UNSIGNED")).toEqual(scalar("bigint"));
		// getText() concatenates the optional INTEGER/INT suffix with no space (every dialect's
		// lower.ts does this uniformly) — the alias table carries the concatenated forms too.
		expect(mysqlParseType("SIGNEDINTEGER")).toEqual(scalar("bigint"));
		expect(mysqlParseType("UNSIGNEDINT")).toEqual(scalar("bigint"));
	});
	it("bare FLOAT/DOUBLE/DECIMAL/JSON/YEAR need no alias entry — already this module's canonical names", () => {
		expect(mysqlParseType("FLOAT")).toEqual(scalar("float"));
		expect(mysqlParseType("DOUBLE")).toEqual(scalar("double"));
		expect(mysqlParseType("DECIMAL(10,2)")).toEqual(scalar("decimal"));
		expect(mysqlParseType("JSON")).toEqual(scalar("json"));
		expect(mysqlParseType("YEAR")).toEqual(scalar("year"));
	});
});

describe("mysql function registry", () => {
	const rule = (name: string, args: ReturnType<typeof scalar>[] = []) => MYSQL_FUNCTION_RETURNS[name]?.(args);

	it("count is bigint, unconditional on the argument (aggregate-functions.html)", () => {
		expect(rule("count")).toEqual(scalar("bigint"));
	});
	it("concat is string (string-functions.html)", () => {
		expect(MYSQL_FUNCTION_RETURNS["concat"]?.([scalar("int")])).toEqual(scalar("string"));
	});
	it("char_length/character_length/length are int (string-functions.html)", () => {
		expect(rule("char_length")).toEqual(scalar("int"));
		expect(rule("character_length")).toEqual(scalar("int"));
		expect(rule("length")).toEqual(scalar("int"));
	});
	it("lower/lcase/upper/ucase/hex are string (string-functions.html)", () => {
		expect(rule("lower")).toEqual(scalar("string"));
		expect(rule("lcase")).toEqual(scalar("string"));
		expect(rule("upper")).toEqual(scalar("string"));
		expect(rule("ucase")).toEqual(scalar("string"));
		expect(rule("hex")).toEqual(scalar("string"));
	});
	it("now/current_timestamp/sysdate are timestamp — MySQL's own DATETIME type, NOT sqlite's context-free string (date-and-time-functions.html)", () => {
		expect(rule("now")).toEqual(scalar("timestamp"));
		expect(rule("current_timestamp")).toEqual(scalar("timestamp"));
		expect(rule("sysdate")).toEqual(scalar("timestamp"));
	});
	it("curdate/current_date are date (date-and-time-functions.html)", () => {
		expect(rule("curdate")).toEqual(scalar("date"));
		expect(rule("current_date")).toEqual(scalar("date"));
	});
	it("database/schema/user/current_user/version are string (information-functions.html)", () => {
		expect(rule("database")).toEqual(scalar("string"));
		expect(rule("schema")).toEqual(scalar("string"));
		expect(rule("user")).toEqual(scalar("string"));
		expect(rule("current_user")).toEqual(scalar("string"));
		expect(rule("version")).toEqual(scalar("string"));
	});
	it("last_insert_id/found_rows are bigint (information-functions.html)", () => {
		expect(rule("last_insert_id")).toEqual(scalar("bigint"));
		expect(rule("found_rows")).toEqual(scalar("bigint"));
	});
	it("json_type is string (json-attribute-functions.html)", () => {
		expect(rule("json_type")).toEqual(scalar("string"));
	});
	it("absent-by-contract: argument-dependent functions stay unregistered, never a guessed type", () => {
		expect(MYSQL_FUNCTION_RETURNS["round"]).toBeUndefined();
		expect(MYSQL_FUNCTION_RETURNS["truncate"]).toBeUndefined();
		expect(MYSQL_FUNCTION_RETURNS["abs"]).toBeUndefined();
		expect(MYSQL_FUNCTION_RETURNS["sum"]).toBeUndefined();
		expect(MYSQL_FUNCTION_RETURNS["min"]).toBeUndefined();
		expect(MYSQL_FUNCTION_RETURNS["max"]).toBeUndefined();
		expect(MYSQL_FUNCTION_RETURNS["greatest"]).toBeUndefined();
		expect(MYSQL_FUNCTION_RETURNS["least"]).toBeUndefined();
		expect(MYSQL_FUNCTION_RETURNS["ifnull"]).toBeUndefined();
		expect(MYSQL_FUNCTION_RETURNS["coalesce"]).toBeUndefined();
	});
});
