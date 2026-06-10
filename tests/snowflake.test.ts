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

	// WITHIN GROUP belongs to any ordered-set aggregate (PERCENTILE_CONT/DISC, MODE, …),
	// not only LISTAGG/ARRAY_AGG: docs.snowflake.com/en/sql-reference/functions/percentile_cont
	it("parses WITHIN GROUP on percentile_cont", () => {
		expect(errorsOf("SELECT (PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY x))/1000 AS p FROM t")).toBe(0);
	});

	it("parses a CTE list whose later CTE uses WITHIN GROUP (LL prediction poisoning)", () => {
		expect(
			errorsOf(`
				WITH a AS (SELECT 1 AS x), b AS (SELECT x FROM a),
				c AS (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x) AS m FROM b)
				SELECT * FROM c`),
		).toBe(0);
	});

	// Multi-row inserts: docs.snowflake.com/en/sql-reference/sql/insert — upstream
	// values_builder capped the row list at two.
	it("parses INSERT with three or more VALUES rows", () => {
		expect(errorsOf("INSERT INTO t (a, b) VALUES (1, 'x'), (2, 'y'), (3, 'z'), (4, 'w')")).toBe(0);
	});

	// Structured types as cast targets: docs.snowflake.com/en/sql-reference/data-types-structured
	it("parses casts to structured OBJECT/ARRAY/MAP types", () => {
		expect(errorsOf("SELECT OBJECT_CONSTRUCT('a', 1)::OBJECT(a VARCHAR, d DATE) FROM t")).toBe(0);
		expect(errorsOf("SELECT col::ARRAY(NUMBER) FROM t")).toBe(0);
		expect(errorsOf("SELECT col::MAP(VARCHAR, NUMBER(10,2)) FROM t")).toBe(0);
	});

	// Keywords usable as identifiers (Snowflake reserves very little:
	// docs.snowflake.com/en/sql-reference/reserved-keywords)
	it("allows BODY, SEARCH, ONE as identifiers", () => {
		expect(errorsOf("SELECT body FROM emails")).toBe(0);
		expect(errorsOf("SELECT SEARCH(body, 'hello') FROM emails")).toBe(0);
		expect(errorsOf("SELECT 1 AS one")).toBe(0);
	});

	// ALTER SESSION SET accepts any documented parameter, space-separated:
	// docs.snowflake.com/en/sql-reference/parameters (the grammar had a closed catalogue)
	it("parses ALTER SESSION SET with arbitrary documented parameters", () => {
		expect(errorsOf("ALTER SESSION SET GEOMETRY_OUTPUT_FORMAT = 'WKT'")).toBe(0);
		expect(errorsOf("ALTER SESSION SET TIMEZONE = 'UTC' QUERY_TAG = 'etl'")).toBe(0);
	});

	// Instance method invocation on class objects:
	// docs.snowflake.com/en/sql-reference/classes — <instance>!<method>(<args>)
	it("parses bang method calls", () => {
		expect(errorsOf("SELECT model_binary!PREDICT(INPUT_DATA => {*}) AS p FROM d")).toBe(0);
		expect(errorsOf("SELECT my_classifier!CLASSIFY(text_col) FROM t")).toBe(0);
	});

	// Iceberg tables: docs.snowflake.com/en/sql-reference/sql/create-iceberg-table
	it("parses CREATE and ALTER ICEBERG TABLE", () => {
		expect(
			errorsOf(
				"CREATE ICEBERG TABLE it (id NUMBER, d DATE) CATALOG = 'SNOWFLAKE' EXTERNAL_VOLUME = 'vol' BASE_LOCATION = 'loc'",
			),
		).toBe(0);
		expect(errorsOf("ALTER ICEBERG TABLE it ADD COLUMN c VARCHAR")).toBe(0);
		expect(errorsOf("CREATE OR REPLACE ICEBERG TABLE it AS SELECT * FROM src")).toBe(0);
	});

	it("parses CALL with a bang method", () => {
		expect(errorsOf("CALL SNOWFLAKE.LOCAL.ANOMALY_INSIGHTS!GET_DATA('2024-01-01', '2024-03-31')")).toBe(0);
	});

	// IDENTIFIER(...) works anywhere an object name does:
	// docs.snowflake.com/en/sql-reference/identifier-literal
	it("parses IDENTIFIER('…') as an object name", () => {
		expect(errorsOf("CREATE OR REPLACE DATABASE IDENTIFIER('my_db')")).toBe(0);
		expect(errorsOf("SELECT * FROM IDENTIFIER('my_table')")).toBe(0);
	});

	// Stage file paths contain dots: docs.snowflake.com/en/sql-reference/sql/copy-into-table
	it("parses COPY INTO from a stage path with dots", () => {
		expect(errorsOf("COPY INTO t FROM @mystage/unload/mydata.csv.gz")).toBe(0);
	});

	// Querying staged files: docs.snowflake.com/en/user-guide/querying-stage
	it("parses SELECT from a stage", () => {
		expect(errorsOf("SELECT $1, $2 FROM @my_stage")).toBe(0);
		expect(errorsOf("SELECT t.$1 FROM @my_stage/data.csv (FILE_FORMAT => 'csv', PATTERN => '.*') t")).toBe(0);
	});

	it("parses CALL with named arguments", () => {
		expect(errorsOf("CALL get_spending_history(budget_name => 'b1', start_ts => '2024-01-01')")).toBe(0);
	});

	// FILE is a first-class data type: docs.snowflake.com/en/sql-reference/data-types-unstructured
	it("parses FILE as a column data type", () => {
		expect(errorsOf("CREATE TABLE file_table (f FILE)")).toBe(0);
	});

	// Database roles: docs.snowflake.com/en/sql-reference/sql/grant-database-role
	it("parses GRANT DATABASE ROLE", () => {
		expect(errorsOf("GRANT DATABASE ROLE r1 TO ROLE r2")).toBe(0);
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
