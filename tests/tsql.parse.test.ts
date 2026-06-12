import { describe, expect, it } from "vitest";
import { lower } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";

// parseTSql parses via the grammar's full-file rule (tsql_file = batch* EOF) — one entry, the same
// shape as parseDatabricks/parseSnowflake. It is EOF-anchored, so trailing garbage is an error
// rather than silently dropped; a second statement is a valid batch (a compound), as in Snowflake.

describe("parseTSql input anchoring", () => {
	it("accepts a complete SELECT", () => {
		expect(parseTSql("SELECT a FROM t").errors).toBe(0);
	});

	it("accepts trailing semicolons and whitespace", () => {
		expect(parseTSql("SELECT a FROM t;").errors).toBe(0);
		expect(parseTSql("SELECT a FROM t ; \n").errors).toBe(0);
	});

	it("rejects trailing garbage instead of dropping it", () => {
		expect(parseTSql("SELECT a FROM t )))").errors).toBeGreaterThan(0);
	});

	it("accepts a second statement as a batch (a compound), not an error", () => {
		const r = parseTSql("SELECT a FROM t; SELECT b FROM u");
		expect(r.errors).toBe(0);
		expect(lower(r.tree).statement).toBe("compound");
	});
});
