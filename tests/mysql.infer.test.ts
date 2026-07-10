import { describe, it, expect } from "vitest";
import { mysqlLiteral, MYSQL_FUNCTION_RETURNS } from "../src/infer/mysql.js";
import { scalar, UNKNOWN } from "../src/infer/types.js";

// Seeded at B-R4 with the infer STUB's unit assertions (src/infer/mysql.ts is not yet wired into
// src/infer/dialect.ts — that wiring, and this file's division-mode gate mirroring
// tests/sqlite.infer.test.ts's, is B-R5's job). The literal-typing block pins MySQL's
// exact-vs-approximate numeric split (dev.mysql.com/doc/refman/8.4/en/precision-math-numbers.html):
// a fractional literal without an exponent is DECIMAL, NOT double — the B-R4 review caught the
// stub shipping sqlite's `double` here (correct for sqlite's five storage classes, wrong for MySQL).

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

describe("mysql function registry (stub — the two certain entries only)", () => {
	it("count is bigint, unconditional on the argument", () => {
		expect(MYSQL_FUNCTION_RETURNS["count"]?.([])).toEqual(scalar("bigint"));
	});
	it("concat is string", () => {
		expect(MYSQL_FUNCTION_RETURNS["concat"]?.([scalar("int")])).toEqual(scalar("string"));
	});
});
