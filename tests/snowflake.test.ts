import { describe, expect, it } from "vitest";
import { parseSnowflake } from "../src/snowflake/parse.js";

// Snowflake is the third dialect: grammar forked from grammars-v4 sql/snowflake, cleaned
// against the official reference docs. Only parse() and lower() are Snowflake-specific —
// the semantic layer runs unchanged on the shared IR (proven for T-SQL already; the same
// pipeline tests are added here as lower() is built).

function errorsOf(sql: string): number {
	return parseSnowflake(sql).errors;
}

describe("Snowflake parse", () => {
	it("parses a basic SELECT with zero syntax errors", () => {
		expect(errorsOf("SELECT a, b FROM t WHERE a > 1")).toBe(0);
	});

	// Window frames: docs.snowflake.com/en/sql-reference/functions-analytic
	// (window frame syntax) — upstream grammar had the frame rules commented out.
	it("parses a cumulative ROWS frame", () => {
		expect(
			errorsOf(
				"SELECT SUM(x) OVER (PARTITION BY g ORDER BY ts ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM t",
			),
		).toBe(0);
	});

	it("parses a sliding ROWS frame with numeric bounds", () => {
		expect(errorsOf("SELECT AVG(x) OVER (ORDER BY ts ROWS BETWEEN 3 PRECEDING AND 1 FOLLOWING) FROM t")).toBe(0);
	});

	it("parses a RANGE frame with an interval offset", () => {
		expect(
			errorsOf(
				"SELECT COUNT(*) OVER (ORDER BY ts RANGE BETWEEN INTERVAL '1 day' PRECEDING AND CURRENT ROW) FROM t",
			),
		).toBe(0);
	});

	it("parses a shorthand frame (no BETWEEN)", () => {
		expect(errorsOf("SELECT SUM(x) OVER (ORDER BY ts ROWS UNBOUNDED PRECEDING) FROM t")).toBe(0);
	});

	// SELECT * modifiers: docs.snowflake.com/en/sql-reference/sql/select — upstream
	// grammar only wired EXCLUDE; ILIKE / REPLACE / RENAME are equally official.
	it("parses SELECT * ILIKE", () => {
		expect(errorsOf("SELECT * ILIKE '%amount%' FROM orders")).toBe(0);
	});

	it("parses SELECT * REPLACE", () => {
		expect(errorsOf("SELECT * REPLACE (amount / 100 AS amount, UPPER(name) AS name) FROM orders")).toBe(0);
	});

	it("parses SELECT * RENAME, parenthesized and bare", () => {
		expect(errorsOf("SELECT * RENAME (id AS order_id, ts AS order_ts) FROM orders")).toBe(0);
		expect(errorsOf("SELECT * RENAME id AS order_id FROM orders")).toBe(0);
	});

	it("parses combined star modifiers (EXCLUDE + RENAME)", () => {
		expect(errorsOf("SELECT t.* EXCLUDE (a, b) RENAME (c AS d) FROM t")).toBe(0);
	});

	// $$-quoted strings are ordinary string literals:
	// docs.snowflake.com/en/sql-reference/data-types-text#dollar-quoted-string-constants
	it("parses a dollar-quoted string as an expression", () => {
		expect(errorsOf("SELECT $$some 'raw' text$$ AS s")).toBe(0);
		expect(errorsOf("SELECT a FROM t WHERE b = $$x$$")).toBe(0);
	});

	// MATCH_RECOGNIZE with real pattern variables (upstream's `symbol` rule was a
	// DUMMY-token stub): docs.snowflake.com/en/sql-reference/constructs/match_recognize
	it("parses MATCH_RECOGNIZE with pattern variables", () => {
		expect(
			errorsOf(`
				SELECT * FROM stock MATCH_RECOGNIZE (
					PARTITION BY symbol ORDER BY ts
					MEASURES MATCH_NUMBER() AS mn
					ONE ROW PER MATCH
					AFTER MATCH SKIP PAST LAST ROW
					PATTERN (up+ down{1,3} (flat | dip)?)
					DEFINE up AS price > 10, down AS price < 10, flat AS price = 10, dip AS price < 5
				)`),
		).toBe(0);
	});
});
