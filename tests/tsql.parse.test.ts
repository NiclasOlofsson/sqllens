import { describe, expect, it } from "vitest";
import { parseTSql } from "../src/tsql/parse.js";

// The public T-SQL entry must consume the WHOLE input. The grammar rule
// (select_statement_standalone) has no EOF anchor, so without an explicit check a
// valid-SELECT *prefix* would "parse with 0 errors" and silently drop the tail —
// e.g. an unsupported trailing clause would vanish instead of erroring.

describe("parseTSql input anchoring", () => {
	it("accepts a complete SELECT", () => {
		expect(parseTSql("SELECT a FROM t").errors).toBe(0);
	});

	it("accepts trailing semicolons and whitespace", () => {
		expect(parseTSql("SELECT a FROM t;").errors).toBe(0);
		expect(parseTSql("SELECT a FROM t ; \n").errors).toBe(0);
	});

	it("rejects trailing garbage after a valid SELECT instead of dropping it", () => {
		expect(parseTSql("SELECT a FROM t )))").errors).toBeGreaterThan(0);
	});

	it("rejects a second statement after the SELECT", () => {
		expect(parseTSql("SELECT a FROM t; SELECT b FROM u").errors).toBeGreaterThan(0);
	});
});
