import { describe, expect, it } from "vitest";
import { nodeAt } from "../src/document/node-at.js";
import { referencesAt } from "../src/references/references.js";
import { lower } from "../src/snowflake/lower.js";
import { parseSnowflake } from "../src/snowflake/parse.js";
import { resolveScopes, rootDeclarations } from "../src/scope/scope.js";
import { probeBody } from "./helpers/body-probe.js";

// Snowflake is the third dialect: grammar forked from grammars-v4 sql/snowflake, cleaned
// against the official reference docs. Only parse() and lower() are Snowflake-specific —
// the semantic layer runs unchanged on the shared IR (proven for T-SQL already; the same
// pipeline tests are added here as lower() is built).

function errorsOf(sql: string): number {
	return parseSnowflake(sql).errors;
}

function ir(sql: string) {
	const { tree, errors } = parseSnowflake(sql);
	return { q: lower(tree), errors };
}

function selectBody(sql: string) {
	const { q, errors } = ir(sql);
	expect(errors).toBe(0);
	if (q.body.kind !== "select") throw new Error(`expected select body, got ${q.body.kind}`);
	return { q, body: q.body };
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

	// Platform-object DDL parses generically (opaque to statement end) — Snowflake adds
	// these object kinds faster than they're worth modelling individually.
	it("parses platform-object statements generically", () => {
		expect(errorsOf("ALTER LISTING my_listing SET COMMENT = 'x'")).toBe(0);
		expect(errorsOf("ALTER APPLICATION PACKAGE pkg SET DISTRIBUTION = EXTERNAL")).toBe(0);
		expect(errorsOf("ALTER CORTEX SEARCH SERVICE svc SET TARGET_LAG = '1 hour'")).toBe(0);
		expect(errorsOf("ALTER ORGANIZATION ACCOUNT SET COMMENT = 'x'")).toBe(0);
		expect(errorsOf("CREATE POSTGRES INSTANCE pg COMPUTE_FAMILY = 'CPU_X64_XS'")).toBe(0);
		expect(errorsOf("CREATE OR REPLACE NETWORK RULE r MODE = INGRESS TYPE = IPV4 VALUE_LIST = ('1.2.3.4')")).toBe(
			0,
		);
		expect(errorsOf("ALTER NETWORK RULE r SET COMMENT = 'x'")).toBe(0);
	});

	it("parses COPY INTO with a PATTERN option (regression: MATCH_RECOGNIZE repurposed `pattern`)", () => {
		expect(errorsOf("COPY INTO t FROM @s PATTERN = '.*[.]csv' FILE_FORMAT = (TYPE = 'CSV')")).toBe(0);
	});

	it("parses SHOW/DESC for platform objects generically", () => {
		expect(errorsOf("SHOW POSTGRES INSTANCES")).toBe(0);
		expect(errorsOf("SHOW ICEBERG TABLES IN SCHEMA s")).toBe(0);
		expect(errorsOf("ALTER BACKUP POLICY bp SET SCHEDULE = '8 HOURS'")).toBe(0);
		expect(errorsOf("CREATE CATALOG INTEGRATION ci CATALOG_SOURCE = GLUE ENABLED = TRUE")).toBe(0);
	});

	it("parses more generic platform objects (SNAPSHOT, NOTEBOOK, TYPE)", () => {
		expect(errorsOf("CREATE SNAPSHOT POLICY sp SCHEDULE = '1 DAY'")).toBe(0);
		expect(errorsOf("ALTER SNAPSHOT s SET COMMENT = 'x'")).toBe(0);
		expect(errorsOf("CREATE NOTEBOOK nb FROM '@stage' MAIN_FILE = 'nb.ipynb'")).toBe(0);
		expect(errorsOf("CREATE TYPE my_type AS OBJECT (a NUMBER)")).toBe(0);
	});

	it("parses CTAS with a names-only column list", () => {
		expect(errorsOf("CREATE OR REPLACE TABLE t (c1) AS SELECT 1 FROM s")).toBe(0);
	});

	it("parses a bang method call inside TABLE(...)", () => {
		expect(errorsOf("SELECT * FROM TABLE(db.s.my_job!SPCS_GET_LOGS())")).toBe(0);
	});

	// INSERT is also a string function: docs.snowflake.com/en/sql-reference/functions/insert
	it("parses INSERT(...) as a function call", () => {
		expect(errorsOf("SELECT INSERT('abcdef', 3, 2, 'zzz')")).toBe(0);
	});

	// docs.snowflake.com/en/sql-reference/sql/alter-table — search optimization targets take a column list
	it("parses ADD SEARCH OPTIMIZATION ON EQUALITY(c1, c2), including on dynamic tables", () => {
		expect(errorsOf("ALTER TABLE t ADD SEARCH OPTIMIZATION ON EQUALITY(c1, c2)")).toBe(0);
		expect(errorsOf("ALTER DYNAMIC TABLE dt ADD SEARCH OPTIMIZATION ON EQUALITY(c1, c2)")).toBe(0);
	});

	// docs.snowflake.com/en/sql-reference/sql/copy-files
	it("parses COPY FILES between stages", () => {
		expect(errorsOf("COPY FILES INTO @target_stage FROM @source_stage FILES = ('a.csv', 'b.csv')")).toBe(0);
		expect(errorsOf("COPY FILES INTO @t FROM @s PATTERN = '.*[.]csv'")).toBe(0);
	});

	it("parses ALTER SESSION SET with bare-identifier values and comma separators", () => {
		expect(errorsOf("ALTER SESSION SET TIMEZONE = UTC")).toBe(0);
		expect(errorsOf("ALTER SESSION SET WEEK_OF_YEAR_POLICY=0, WEEK_START=0")).toBe(0);
	});

	it("parses IDENTIFIER('…') as a schema name in CREATE SCHEMA", () => {
		expect(errorsOf("CREATE OR REPLACE SCHEMA IDENTIFIER('my_schema')")).toBe(0);
	});

	// Standalone Snowflake Scripting blocks (not just CREATE TASK bodies):
	// docs.snowflake.com/en/developer-guide/snowflake-scripting/blocks
	it("parses standalone scripting blocks", () => {
		expect(errorsOf("BEGIN CREATE TABLE t (c INT); RETURN 'done'; END")).toBe(0);
		expect(errorsOf("DECLARE i INTEGER; BEGIN i := 1; RETURN i; END")).toBe(0);
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

	// --- query-language gaps found by the docs corpus (2026-06-12) ---

	// docs.snowflake.com/en/sql-reference/functions/like — ALL alongside the existing ANY
	it("parses LIKE ALL / LIKE ANY (…)", () => {
		expect(errorsOf("SELECT * FROM t WHERE name LIKE ALL ('%Jo%oe%', 'J%e')")).toBe(0);
		expect(errorsOf("SELECT * FROM t WHERE name ILIKE ALL ('%a%')")).toBe(0);
		expect(errorsOf("SELECT * FROM t WHERE name LIKE ANY ('%a%', 'b%')")).toBe(0); // regression guard
	});

	// docs.snowflake.com/en/sql-reference/constructs/order-by — ORDER BY ALL
	it("parses ORDER BY ALL", () => {
		expect(errorsOf("SELECT * FROM my_sort_example ORDER BY ALL")).toBe(0);
		expect(errorsOf("SELECT * FROM t ORDER BY ALL DESC NULLS LAST")).toBe(0);
	});

	// docs.snowflake.com/en/sql-reference/data-types-datetime — INTERVAL '…' UNIT [TO UNIT]
	it("parses interval arithmetic with a unit", () => {
		expect(errorsOf("SELECT TO_DATE('2024-01-01') + INTERVAL '1-1' YEAR TO MONTH AS d")).toBe(0);
		expect(errorsOf("SELECT ts + INTERVAL '7' DAY FROM t")).toBe(0);
	});

	// Cast to a user-defined type: docs.snowflake.com/en/sql-reference/sql/create-type
	it("parses ::<user-defined type> casts", () => {
		expect(errorsOf("SELECT 10::age")).toBe(0);
		expect(errorsOf("SELECT IFF(TRUE, '90210', '90211')::us_zipcode FROM t")).toBe(0);
		expect(errorsOf("SELECT x::NUMBER(10,2) FROM t")).toBe(0); // regression guard
	});

	// Named arguments mixed with positional in a scalar call:
	// docs.snowflake.com/en/sql-reference/functions/search
	it("parses mixed positional + named (=>) function arguments", () => {
		expect(errorsOf("SELECT SEARCH(line, 'Rosencrantz', SEARCH_MODE => 'AND') FROM lines")).toBe(0);
		expect(errorsOf("SELECT my_func(a => 1, b => 2) FROM t")).toBe(0); // regression guard (all named)
		expect(errorsOf("SELECT my_func(1, 2) FROM t")).toBe(0); // regression guard (all positional)
	});

	// Table functions in FROM: docs.snowflake.com/en/sql-reference/functions/directory
	it("parses table functions in FROM (DIRECTORY, …)", () => {
		expect(errorsOf("SELECT FILE_URL FROM DIRECTORY(@mystage) WHERE SIZE > 100000")).toBe(0);
	});

	// Object-construct star shorthand: docs.snowflake.com/en/sql-reference/functions/object_construct
	// Only EXCLUDE and ILIKE are documented for {* …} (unlike SELECT *, which also takes RENAME/REPLACE).
	it("parses {* EXCLUDE …} / {* ILIKE …} object construction", () => {
		expect(errorsOf("SELECT {* EXCLUDE col1} FROM my_table")).toBe(0);
		expect(errorsOf("SELECT {* ILIKE 'col1%'} FROM my_table")).toBe(0);
		expect(errorsOf("SELECT {*} FROM t")).toBe(0);
	});

	// Keywords usable as identifiers — Snowflake reserves very little:
	// docs.snowflake.com/en/sql-reference/reserved-keywords
	it("allows keyword tokens as column/alias/table names", () => {
		expect(errorsOf("SELECT REGEXP_SUBSTR_ALL('a1a2', 'a.') AS matches")).toBe(0);
		expect(errorsOf("SELECT pipe_name FROM snowflake.account_usage.pipes")).toBe(0);
		expect(errorsOf("SELECT * FROM information_schema.packages")).toBe(0);
		expect(errorsOf("SELECT * FROM information_schema.columns")).toBe(0);
		expect(errorsOf("SELECT col AS database FROM t")).toBe(0);
	});

	// EXTRACT — both the FROM and the comma form, part quoted or unquoted:
	// docs.snowflake.com/en/sql-reference/functions/extract
	it("parses EXTRACT(part FROM expr) and EXTRACT(part, expr)", () => {
		expect(errorsOf("SELECT EXTRACT(year FROM ts) FROM t")).toBe(0);
		expect(errorsOf("SELECT EXTRACT('month', ts) FROM t")).toBe(0);
		expect(errorsOf("SELECT EXTRACT(epoch_second FROM TO_TIMESTAMP('2024-04-10')) AS s")).toBe(0);
	});

	// Pattern-matching functions in call form: docs.snowflake.com/en/sql-reference/functions/rlike
	it("parses RLIKE / REGEXP-family as functions", () => {
		expect(errorsOf("SELECT RLIKE('800-456-7891', '[2-9]\\\\d{2}') AS m")).toBe(0);
		expect(errorsOf("SELECT REGEXP_SUBSTR_ALL('a1a2a3', 'a[0-9]') AS matches")).toBe(0);
	});

	// Qualified system functions: docs.snowflake.com/en/sql-reference/functions/system
	it("parses 3-part-qualified system function calls", () => {
		expect(errorsOf("SELECT SNOWFLAKE.NOTIFICATION.TEXT_HTML('a', 'b')")).toBe(0);
	});

	// --- query-language gaps, wave 2 (docs corpus, 2026-06-12) ---

	// More keyword tokens used as identifiers (Snowflake reserves very little):
	// docs.snowflake.com/en/sql-reference/reserved-keywords
	it("allows more keyword tokens as identifiers", () => {
		expect(errorsOf("SELECT x, y FROM simple ORDER BY x, y")).toBe(0);
		expect(errorsOf("SELECT v, base64_encode(v) AS base64 FROM t")).toBe(0);
		expect(errorsOf("SELECT * FROM snowflake.account_usage.credentials")).toBe(0);
		expect(errorsOf("SELECT col AS schema, c AS location, k AS keys FROM t")).toBe(0);
		expect(errorsOf("SELECT enforced, functions, shares, accounts, copy FROM t")).toBe(0);
	});

	// Binary/hex literals X'…' — not defined on the binary-input-output syntax page, but used
	// throughout the official examples: docs.snowflake.com/en/sql-reference/binary-examples
	it("parses X'…' / x'…' binary literals", () => {
		expect(errorsOf("SELECT X'A1B2'")).toBe(0);
		expect(errorsOf("SELECT CHARINDEX(X'EF', c1) FROM t")).toBe(0);
		expect(errorsOf("SELECT x'00' || TRY_TO_BINARY(c1, 'hex') FROM t")).toBe(0);
	});

	// POSITION(<expr> IN <expr>): docs.snowflake.com/en/sql-reference/functions/position
	it("parses POSITION(x IN y)", () => {
		expect(errorsOf("SELECT POSITION(n IN h) FROM t")).toBe(0);
		expect(errorsOf("SELECT POSITION('@' IN email) FROM t")).toBe(0);
		expect(errorsOf("SELECT POSITION('a', 'abc') FROM t")).toBe(0); // comma form still works
	});

	// REGEXP operator (synonym of RLIKE): docs.snowflake.com/en/sql-reference/functions/regexp
	it("parses the REGEXP operator", () => {
		expect(errorsOf("SELECT v FROM t WHERE v REGEXP 'San.*'")).toBe(0);
		expect(errorsOf("SELECT v, v REGEXP '[0-9]+' AS m FROM t")).toBe(0);
	});

	// SELECT … FOR UPDATE: docs.snowflake.com/en/sql-reference/sql/select
	it("parses FOR UPDATE", () => {
		expect(errorsOf("SELECT * FROM t WHERE id < 20 FOR UPDATE")).toBe(0);
	});

	// LIMIT/OFFSET accept NULL (and the row count need not be a bare integer):
	// docs.snowflake.com/en/sql-reference/constructs/limit
	it("parses LIMIT NULL / OFFSET NULL", () => {
		expect(errorsOf("SELECT * FROM t ORDER BY i LIMIT NULL OFFSET NULL")).toBe(0);
		expect(errorsOf("SELECT * FROM t LIMIT 10")).toBe(0); // regression guard
	});

	// NULLS FIRST/LAST in a window ORDER BY: docs.snowflake.com/en/sql-reference/functions-analytic
	it("parses NULLS FIRST/LAST inside a window ORDER BY with a frame", () => {
		expect(
			errorsOf("SELECT SUM(c2) OVER (ORDER BY c1 NULLS LAST RANGE BETWEEN 1 PRECEDING AND 1 FOLLOWING) FROM t"),
		).toBe(0);
	});

	// Fractional sampling probability: docs.snowflake.com/en/sql-reference/constructs/sample
	it("parses TABLESAMPLE with a fractional probability", () => {
		expect(errorsOf("SELECT * FROM t TABLESAMPLE BERNOULLI (20.3)")).toBe(0);
		expect(errorsOf("SELECT * FROM t SAMPLE (10)")).toBe(0); // regression guard
	});

	// --- query-language gaps, wave 3 (docs corpus, 2026-06-12) ---

	// Oracle-style (+) outer-join operator: docs.snowflake.com/en/sql-reference/constructs/join
	it("parses the (+) outer-join operator", () => {
		expect(errorsOf("SELECT t1.c1, t2.c2 FROM t1, t2 WHERE t1.c1 = t2.c2 (+)")).toBe(0);
		expect(errorsOf("SELECT * FROM t1, t2 WHERE t1.c1 (+) = t2.c2")).toBe(0);
	});

	// A stage reference as a function argument: docs.snowflake.com/en/sql-reference/functions/build_scoped_file_url
	it("parses @stage as a function argument", () => {
		expect(errorsOf("SELECT BUILD_SCOPED_FILE_URL(@images_stage, 'a/b.jpg', TRUE)")).toBe(0);
		expect(errorsOf("SELECT GET_PRESIGNED_URL(@my_stage, 'file.csv')")).toBe(0);
	});

	// TABLE('<name>') table literal: docs.snowflake.com/en/sql-reference/literals-table
	it("parses TABLE('<name>') table literals", () => {
		expect(errorsOf("SELECT * FROM TABLE('mytable')")).toBe(0);
		expect(errorsOf("SELECT * FROM TABLE($$mytable$$)")).toBe(0);
		expect(errorsOf("SELECT * FROM TABLE(VALIDATE(t1, JOB_ID => '_last'))")).toBe(0);
	});

	// Object construction {…}: star + qualified star + mixed key/value:
	// docs.snowflake.com/en/sql-reference/functions/object_construct
	it("parses {…} object construction with stars and key/value pairs", () => {
		expect(errorsOf("SELECT {t1.*, t2.*} FROM t1, t2")).toBe(0);
		expect(errorsOf("SELECT {*, 'k': 'v'} FROM t")).toBe(0);
		expect(errorsOf("SELECT {my_table.*} FROM my_table")).toBe(0);
	});

	// ** spread operator over an array: docs.snowflake.com/en/sql-reference/operators-expansion
	it("parses the ** spread operator", () => {
		expect(errorsOf("SELECT COALESCE(** [NULL, 'v'])")).toBe(0);
		expect(errorsOf("SELECT * FROM t WHERE col1 IN (** [3, 4])")).toBe(0);
		expect(errorsOf("SELECT GREATEST(** [1, 2, 5])")).toBe(0);
	});

	// * / (*) "all columns" as a function argument (SEARCH, MINHASH):
	// docs.snowflake.com/en/sql-reference/functions/search
	it("parses * / (*) as an all-columns function argument", () => {
		expect(errorsOf("SELECT SEARCH(*, 'king') FROM t")).toBe(0);
		expect(errorsOf("SELECT SEARCH((*), 'king') FROM lines")).toBe(0);
		expect(errorsOf("SELECT MINHASH(5, *) FROM t")).toBe(0);
		expect(errorsOf("SELECT SEARCH(* EXCLUDE c, 'x') FROM t")).toBe(0);
		expect(errorsOf("SELECT SEARCH(* ILIKE 'c%', 'x') FROM t")).toBe(0);
	});

	// RESAMPLE time-series construct: docs.snowflake.com/en/sql-reference/constructs/resample
	it("parses RESAMPLE", () => {
		expect(
			errorsOf("SELECT * FROM weather RESAMPLE (USING ts INCREMENT BY INTERVAL '1 hour' PARTITION BY city)"),
		).toBe(0);
		expect(errorsOf("SELECT bucket FROM t RESAMPLE (USING ts INCREMENT BY 5)")).toBe(0);
	});

	// INTERVAL <unit>(p) [TO <unit>(p)] as a cast target type:
	// docs.snowflake.com/en/sql-reference/data-types-datetime
	it("parses casts to an INTERVAL type with precision", () => {
		expect(errorsOf("SELECT (a - b)::INTERVAL DAY(2) TO SECOND(2) FROM t")).toBe(0);
	});

	// --- query-language gaps, wave 4 (docs corpus, 2026-06-12) ---

	// More keyword-as-identifier (incl. bang-method names): docs.snowflake.com/en/sql-reference/reserved-keywords
	it("allows LIST / DESCRIBE / MATCH_CONDITION as identifiers", () => {
		expect(errorsOf("SELECT internal_ids!LIST()")).toBe(0);
		expect(errorsOf("SELECT model!DESCRIBE()")).toBe(0);
		expect(errorsOf("SELECT * FROM t1 AS asof")).toBe(0);
		expect(errorsOf("SELECT * FROM t2 match_condition")).toBe(0);
	});

	// A general table function after LATERAL: docs.snowflake.com/en/sql-reference/functions/strtok_split_to_table
	it("parses LATERAL <table function>(…)", () => {
		expect(errorsOf("SELECT * FROM t, LATERAL STRTOK_SPLIT_TO_TABLE(t.v, ' ')")).toBe(0);
	});

	// GROUPING SETS with nested parens, empty (), and mixed with plain keys:
	// docs.snowflake.com/en/sql-reference/constructs/group-by-grouping-sets
	it("parses GROUPING SETS variants", () => {
		expect(errorsOf("SELECT a FROM t GROUP BY a, GROUPING SETS (b, ())")).toBe(0);
		expect(errorsOf("SELECT a FROM t GROUP BY GROUPING SETS ((x), (y), ())")).toBe(0);
		expect(errorsOf("SELECT grouping(x), grouping(x, y) FROM t GROUP BY CUBE (x, y)")).toBe(0);
	});

	// LIMIT accepts a string/'' (unlimited) as well: docs.snowflake.com/en/sql-reference/constructs/limit
	it("parses LIMIT '' / OFFSET ''", () => {
		expect(errorsOf("SELECT * FROM t ORDER BY i LIMIT '' OFFSET ''")).toBe(0);
	});

	// Structured-type cast field operations: docs.snowflake.com/en/sql-reference/data-types-structured
	it("parses CAST(… AS OBJECT(…) RENAME/ADD FIELDS)", () => {
		expect(
			errorsOf(
				"SELECT CAST({'city': 'X'}::OBJECT(city VARCHAR) AS OBJECT(city_name VARCHAR) RENAME FIELDS) AS o",
			),
		).toBe(0);
		expect(errorsOf("SELECT CAST(o AS OBJECT(a VARCHAR, b VARCHAR) ADD FIELDS) FROM t")).toBe(0);
	});

	// PIVOT with an aggregate alias and ANY ORDER BY: docs.snowflake.com/en/sql-reference/constructs/pivot
	it("parses PIVOT with an aggregate alias and ANY ORDER BY", () => {
		expect(errorsOf("SELECT * FROM s PIVOT(SUM(amount) AS total FOR quarter IN (ANY ORDER BY quarter))")).toBe(0);
	});

	// --- query-language gaps, wave 5 (docs corpus, 2026-06-12) ---

	// SAMPLE / RESAMPLE on a parenthesized subquery source, with SEED:
	// docs.snowflake.com/en/sql-reference/constructs/sample
	it("parses SAMPLE/RESAMPLE on a subquery source", () => {
		expect(errorsOf("SELECT * FROM (SELECT * FROM t) SAMPLE (1) SEED (99)")).toBe(0);
		expect(errorsOf("SELECT * FROM (SELECT * FROM t) RESAMPLE (USING ts INCREMENT BY 5)")).toBe(0);
	});

	// CAST(<expr> AS <user-defined type>): docs.snowflake.com/en/sql-reference/sql/create-type
	it("parses CAST(expr AS <udt>)", () => {
		expect(errorsOf("SELECT CAST(CASE WHEN TRUE THEN 'a' ELSE 'b' END AS uk_postcode) FROM t")).toBe(0);
		expect(errorsOf("SELECT CAST(x AS VARCHAR) FROM t")).toBe(0); // regression guard
	});

	// SEMANTIC_VIEW(...) table function: docs.snowflake.com/en/sql-reference/constructs/semantic_view
	it("parses SEMANTIC_VIEW(… METRICS … DIMENSIONS …) in either order", () => {
		expect(
			errorsOf(
				"SELECT * FROM SEMANTIC_VIEW(tpch_analysis METRICS customer.order_count DIMENSIONS customer.name)",
			),
		).toBe(0);
		expect(errorsOf("SELECT * FROM SEMANTIC_VIEW(a DIMENSIONS customer.name METRICS customer.order_count)")).toBe(
			0,
		);
	});

	// --- query-language gaps, wave 6 (docs corpus, 2026-06-12) ---

	// MATCH_RECOGNIZE MEASURES nav functions with RUNNING/FINAL prefixes:
	// docs.snowflake.com/en/sql-reference/constructs/match_recognize
	it("parses MATCH_RECOGNIZE MEASURES with FIRST/LAST and RUNNING/FINAL", () => {
		expect(
			errorsOf(`SELECT * FROM t MATCH_RECOGNIZE (
				ORDER BY ts
				MEASURES MATCH_NUMBER() AS mn, CLASSIFIER() AS cl,
				         FINAL FIRST(price) AS fp, RUNNING LAST(price) AS lp
				ALL ROWS PER MATCH
				PATTERN (a b+)
				DEFINE b AS price > 10)`),
		).toBe(0);
	});

	// ARRAY/MAP element types may carry NOT NULL: docs.snowflake.com/en/sql-reference/data-types-structured
	it("parses ARRAY(<type> NOT NULL) / MAP element NOT NULL", () => {
		expect(errorsOf("SELECT [1, 2]::ARRAY(NUMBER NOT NULL) FROM t")).toBe(0);
		expect(errorsOf("SELECT m::MAP(VARCHAR, NUMBER NOT NULL) FROM t")).toBe(0);
	});

	// SEARCH over a parenthesized column set with EXCLUDE:
	// docs.snowflake.com/en/sql-reference/functions/search
	it("parses SEARCH((cols.* EXCLUDE c), …)", () => {
		expect(errorsOf("SELECT * FROM lines WHERE SEARCH((lines.* EXCLUDE character), 'king')")).toBe(0);
	});

	// Bind-variable placeholders ? and :name: docs.snowflake.com/en/developer-guide/sql-api/submitting-requests
	it("parses ? and :name bind variables in TABLE(…)", () => {
		expect(errorsOf("SELECT * FROM TABLE(?)")).toBe(0);
		expect(errorsOf("SELECT * FROM TABLE(:binding)")).toBe(0);
	});

	// More keyword-as-id: BUCKET_START as a column/alias
	it("allows BUCKET_START as an identifier", () => {
		expect(errorsOf("SELECT bucket_start FROM t")).toBe(0);
	});

	// --- query-language gaps, wave 7 (docs corpus, 2026-06-12) ---

	// PIVOT IN-list values can be aliased: docs.snowflake.com/en/sql-reference/constructs/pivot
	it("parses PIVOT with aliased IN-list values", () => {
		expect(errorsOf("SELECT * FROM s PIVOT(SUM(amount) FOR quarter IN ('2023_Q1' AS q1, '2023_Q2' AS q2))")).toBe(
			0,
		);
	});

	// A TYPE-valued argument (AI_COMPLETE response_format => TYPE OBJECT(...)):
	// docs.snowflake.com/en/sql-reference/functions/ai_complete
	it("parses a TYPE <data_type> argument value", () => {
		expect(
			errorsOf("SELECT AI_COMPLETE(model => 'm', prompt => 'p', response_format => TYPE OBJECT(a NUMBER))"),
		).toBe(0);
	});

	// USE DATABASE/SCHEMA IDENTIFIER(...): docs.snowflake.com/en/sql-reference/sql/use-database
	it("parses USE DATABASE/SCHEMA with IDENTIFIER(…)", () => {
		expect(errorsOf("USE DATABASE IDENTIFIER($db)")).toBe(0);
		expect(errorsOf("USE SCHEMA IDENTIFIER('my_schema')")).toBe(0);
	});

	// $session_variable as a TABLE() argument: docs.snowflake.com/en/sql-reference/literals-table
	it("parses TABLE($session_variable)", () => {
		expect(errorsOf("SELECT * FROM TABLE($my_table_name)")).toBe(0);
	});

	// Wave 8 — the exotic-but-valid constructs surfaced by the scraped docs corpus, each RTFM'd.

	// A parenthesized join as a join operand: docs.snowflake.com/en/sql-reference/constructs/join
	it("parses a parenthesized join operand with a qualified-star list", () => {
		expect(
			errorsOf(
				"SELECT t1.*, t2.*, t3.* FROM t1 LEFT OUTER JOIN (t2 RIGHT OUTER JOIN t3 ON (t3.c = t2.c)) ON (t1.c = t2.c)",
			),
		).toBe(0);
	});

	// MATCH_RECOGNIZE on a subquery source, ALL ROWS PER MATCH with empty/unmatched options,
	// and a window frame inside DEFINE: docs.snowflake.com/en/sql-reference/constructs/match_recognize
	it("parses MATCH_RECOGNIZE on a subquery with ALL ROWS PER MATCH variants", () => {
		expect(
			errorsOf(
				"SELECT * FROM (SELECT * FROM h) match_recognize(ORDER BY d MEASURES match_number() as mn ALL ROWS PER MATCH PATTERN(a b+) DEFINE b AS price > 10)",
			),
		).toBe(0);
		expect(
			errorsOf(
				"SELECT * FROM h match_recognize(ORDER BY d MEASURES classifier() as cl ALL ROWS PER MATCH OMIT EMPTY MATCHES PATTERN(a*) DEFINE a AS price > avg(price) over (rows between unbounded preceding and unbounded following))",
			),
		).toBe(0);
		expect(
			errorsOf(
				"SELECT * FROM h match_recognize(ORDER BY d MEASURES classifier() as cl ALL ROWS PER MATCH WITH UNMATCHED ROWS PATTERN(a+) DEFINE a AS TRUE)",
			),
		).toBe(0);
	});

	// Chained PIVOTs on a subquery: docs.snowflake.com/en/sql-reference/constructs/pivot
	it("parses chained PIVOT operators", () => {
		expect(
			errorsOf(
				"SELECT * FROM (SELECT amount, q FROM s) PIVOT(SUM(amount) FOR q IN ('a','b')) PIVOT(MAX(d) FOR q2 IN ('a','b'))",
			),
		).toBe(0);
	});

	// A named arg whose value is TABLE(...): docs.snowflake.com/en/sql-reference/classes-anomaly_detection
	it("parses a !method() table function with a TABLE(...)-valued named argument", () => {
		expect(
			errorsOf("SELECT ts FROM TABLE(det!DETECT_ANOMALIES(INPUT_DATA => TABLE('my_view'), TARGET => 'y'))"),
		).toBe(0);
	});

	// USE SECONDARY ROLES with an explicit role list: docs.snowflake.com/en/sql-reference/sql/use-secondary-roles
	it("parses USE SECONDARY ROLES <role>", () => {
		expect(errorsOf("USE SECONDARY ROLES ACCOUNTADMIN")).toBe(0);
	});

	// RESAMPLE with BUCKET_START/IS_GENERATED metadata columns, IS_GENERATED used as a column:
	// docs.snowflake.com/en/sql-reference/constructs/resample
	it("parses RESAMPLE metadata columns and IS_GENERATED as a column", () => {
		expect(
			errorsOf(
				"SELECT bucket_start FROM t RESAMPLE(USING o INCREMENT BY INTERVAL '1 day' METADATA_COLUMNS IS_GENERATED(), BUCKET_START()) WHERE IS_GENERATED = 'False'",
			),
		).toBe(0);
	});

	// LIMIT as a named argument name: docs.snowflake.com/en/sql-reference/info-schema
	it("parses LIMIT => n as a named argument", () => {
		expect(errorsOf("SELECT * FROM TABLE(INFORMATION_SCHEMA.F(APPLICATION_NAME => 'a', LIMIT => 100))")).toBe(0);
	});

	// A correlated LATERAL (SELECT …) with no FROM, aliased FIELDS/MAP keyword identifiers:
	// docs.snowflake.com/en/sql-reference/constructs/join-lateral
	it("parses a correlated LATERAL subquery with FIELDS/MAP as identifiers", () => {
		expect(
			errorsOf(
				"WITH d AS (SELECT PARSE_JSON('[]') x) SELECT fields.* FROM d, LATERAL FLATTEN(x) AS f, LATERAL (SELECT f.value:c AS c, ROW_NUMBER() OVER(ORDER BY f.value:c) rn) fields",
			),
		).toBe(0);
		expect(errorsOf("SELECT MAP_INSERT({'k1':100}::MAP(VARCHAR,VARCHAR), 'k1', 'v', TRUE) AS map")).toBe(0);
	});

	// --- reference-manual conformance review (2026-06-13) ---

	// The keyword tokens introduced for RESAMPLE / SEMANTIC_VIEW / MATCH_RECOGNIZE must stay
	// usable as ordinary identifiers (Snowflake reserves very little; `final` is the standard
	// dbt CTE name): docs.snowflake.com/en/sql-reference/reserved-keywords
	it("keeps RUNNING/FINAL/RESAMPLE/SEMANTIC_VIEW/METADATA_COLUMNS usable as identifiers", () => {
		expect(errorsOf("WITH final AS (SELECT 1 AS x) SELECT * FROM final")).toBe(0);
		expect(errorsOf("SELECT running, resample, semantic_view, metadata_columns FROM t")).toBe(0);
		expect(errorsOf("SELECT a AS final FROM t")).toBe(0);
	});

	// The comma form takes an optional start position; the IN form does not:
	// docs.snowflake.com/en/sql-reference/functions/position
	it("parses POSITION(x, y, start)", () => {
		expect(errorsOf("SELECT POSITION('an', 'banana', 3) FROM t")).toBe(0);
	});

	// FACTS clause and [AS] aliases on METRICS/DIMENSIONS items:
	// docs.snowflake.com/en/sql-reference/constructs/semantic_view
	it("parses SEMANTIC_VIEW FACTS and item aliases", () => {
		expect(errorsOf("SELECT * FROM SEMANTIC_VIEW(sv FACTS orders.amount, orders.qty)")).toBe(0);
		expect(
			errorsOf(
				"SELECT * FROM SEMANTIC_VIEW(sv METRICS m.rev AS revenue DIMENSIONS d.name AS n WHERE d.region = 'EU')",
			),
		).toBe(0);
	});

	// The FROM-clause construct is the single token SEMANTIC_VIEW(…); the two-word form exists
	// only in DDL (CREATE SEMANTIC VIEW). The one doc example using two words in FROM
	// (sql/create-semantic-view/5.sql, in the known-bad list) is a doc typo:
	// docs.snowflake.com/en/sql-reference/constructs/semantic_view
	it("rejects the undocumented two-word SEMANTIC VIEW(…) source", () => {
		expect(errorsOf("SELECT * FROM SEMANTIC VIEW(sv METRICS (t.m))")).toBeGreaterThan(0);
	});

	// RUNNING/FINAL prefix individual nav/window functions INSIDE a measure expression
	// (expr ::= [{RUNNING|FINAL}] windowFunction), not the measure as a whole:
	// docs.snowflake.com/en/sql-reference/constructs/match_recognize
	it("parses RUNNING/FINAL per function inside a measure expression", () => {
		expect(
			errorsOf(`SELECT * FROM t MATCH_RECOGNIZE (
				ORDER BY ts
				MEASURES FINAL LAST(price) - FINAL FIRST(price) AS range_p, RUNNING COUNT(*) AS cnt
				PATTERN (a+)
				DEFINE a AS price > 10)`),
		).toBe(0);
	});

	// USE SECONDARY ROLES is { ALL | NONE | <role> [, <role> …] } — DEFAULT is not documented:
	// docs.snowflake.com/en/sql-reference/sql/use-secondary-roles
	it("parses USE SECONDARY ROLES role lists and rejects DEFAULT", () => {
		expect(errorsOf("USE SECONDARY ROLES r1, r2")).toBe(0);
		expect(errorsOf("USE SECONDARY ROLES DEFAULT")).toBeGreaterThan(0);
	});

	// ** spread is documented only as a function argument or inside an IN list, not as a
	// general expression: docs.snowflake.com/en/sql-reference/operators-expansion
	it("rejects ** spread outside argument/IN positions", () => {
		expect(errorsOf("SELECT 1 + ** [2, 3]")).toBeGreaterThan(0);
	});
});

describe("Snowflake lower -> IR", () => {
	it("lowers a basic SELECT to a select body with projections and a table source", () => {
		const { body } = selectBody("SELECT a, b FROM t");
		expect(body.projections.map((p) => p.name)).toEqual(["a", "b"]);
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t"] } });
	});

	it("captures column and table aliases, with and without AS", () => {
		const { body } = selectBody("SELECT t.a AS x, t.b y FROM db.sch.tbl t");
		expect(body.projections[0].name).toBe("x");
		expect(body.projections[0].expr).toMatchObject({ kind: "column", parts: ["t", "a"] });
		expect(body.projections[1].name).toBe("y");
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["db", "sch", "tbl"] }, alias: "t" });
	});

	it("models WHERE and tags its column refs with the where clause", () => {
		const { body } = selectBody("SELECT a FROM t WHERE b > 1");
		expect(body.where).toMatchObject({ kind: "binary", op: ">" });
		expect(body.columns.some((c) => c.clause === "where" && c.parts.join(".") === "b")).toBe(true);
	});

	it("lowers CTEs with declared column aliases", () => {
		const { q } = selectBody("WITH c (x, y) AS (SELECT a, b FROM t) SELECT x FROM c");
		expect(q.ctes).toHaveLength(1);
		expect(q.ctes[0].name).toBe("c");
		expect(q.ctes[0].columnAliases).toEqual(["x", "y"]);
		expect(q.ctes[0].body.body.kind).toBe("select");
	});

	it("lowers set operators including MINUS as except", () => {
		const { q } = ir("SELECT a FROM t1 UNION ALL SELECT a FROM t2 MINUS SELECT a FROM t3");
		if (q.body.kind !== "setop") throw new Error("setop");
		expect(q.body.op).toBe("except");
		if (q.body.left.kind !== "setop") throw new Error("nested setop");
		expect(q.body.left.op).toBe("union");
		expect(q.body.left.all).toBe(true);
	});

	it("keeps EXCEPT as a set operator, not a bare FROM alias", () => {
		// Seam guard: EXCEPT is non-reserved, so the bare FROM-alias slot could grab the EXCEPT of
		// `... FROM t EXCEPT SELECT ...` as `t AS except` and fold the second select in as a bare,
		// operator-less branch (which lowers to op=union). EXCEPT is held out of non_reserved_words
		// so the set-op reading wins. (Parser-gaps wave: the identifier-holes fix over-included EXCEPT.)
		const { q } = ir("SELECT * FROM t EXCEPT SELECT * FROM u");
		if (q.body.kind !== "setop") throw new Error(`expected setop, got ${q.body.kind}`);
		expect(q.body.op).toBe("except");
		if (q.body.left.kind !== "select") throw new Error("left branch not a select");
		expect(q.body.left.from[0].alias).toBeUndefined();
		expect(q.body.right.kind).toBe("select");
	});

	it("records UNION BY NAME (name-matched column alignment)", () => {
		const { q } = ir("SELECT a, b FROM t1 UNION ALL BY NAME SELECT b, a FROM t2");
		if (q.body.kind !== "setop") throw new Error("setop");
		expect(q.body.byName).toBe(true);
		expect(q.body.all).toBe(true);
		const plain = ir("SELECT a FROM t1 UNION SELECT a FROM t2").q;
		if (plain.body.kind !== "setop") throw new Error("setop");
		expect(plain.body.byName ?? false).toBe(false);
	});

	it("captures JOIN ON conditions and their column refs", () => {
		const { body } = selectBody("SELECT * FROM a JOIN b ON a.id = b.id");
		expect(body.joinConditions).toHaveLength(1);
		expect(body.columns.some((c) => c.clause === "join" && c.parts.join(".") === "a.id")).toBe(true);
	});

	it("captures the ASOF JOIN match condition as a join condition", () => {
		const { body } = selectBody(
			"SELECT * FROM trades t ASOF JOIN quotes q MATCH_CONDITION (t.ts >= q.ts) ON t.sym = q.sym",
		);
		expect(body.joinConditions).toHaveLength(2);
	});

	it("models GROUP BY and HAVING and sets aggregated", () => {
		const { body } = selectBody("SELECT g, SUM(x) FROM t GROUP BY g HAVING SUM(x) > 0");
		expect(body.groupBy).toHaveLength(1);
		expect(body.having).toMatchObject({ kind: "binary", op: ">" });
		expect(body.aggregated).toBe(true);
	});

	it("sets aggregated for GROUP BY ALL and bare aggregates", () => {
		expect(selectBody("SELECT g, COUNT(*) FROM t GROUP BY ALL").body.aggregated).toBe(true);
		expect(selectBody("SELECT MAX(x) FROM t").body.aggregated).toBe(true);
	});

	it("models ORDER BY and LIMIT/OFFSET", () => {
		const { q } = selectBody("SELECT a FROM t ORDER BY a DESC LIMIT 10 OFFSET 5");
		expect(q.orderBy).toHaveLength(1);
		expect(q.limit?.top).toMatchObject({ kind: "literal", text: "10" });
		expect(q.limit?.offset).toMatchObject({ kind: "literal", text: "5" });
	});

	it("models TOP n as the limit", () => {
		const { q } = selectBody("SELECT TOP 3 a FROM t");
		expect(q.limit?.top).toMatchObject({ kind: "literal", text: "3" });
	});

	// SLL-surgery wave (2026-07-03): select_list_top's top_clause was made REQUIRED so
	// select_statement's two alternatives stop being ambiguous on every TOP-less SELECT.
	// These pin the accepted language across that change and that the fast SLL path no longer bails.
	// docs.snowflake.com/en/sql-reference/constructs/top_n and /constructs/limit
	it("keeps TOP / LIMIT / TOP+LIMIT acceptance exact after the select_list_top fix", () => {
		// TOP-less SELECT: still parses, and no longer forces an SLL→LL fallback.
		const plain = parseSnowflake("SELECT x FROM t");
		expect(plain.errors).toBe(0);
		expect(plain.sllFallback).toBe(false);
		// SELECT with LIMIT: parses.
		expect(errorsOf("SELECT x FROM t LIMIT 1")).toBe(0);
		// SELECT TOP n: parses.
		expect(errorsOf("SELECT TOP 1 x FROM t")).toBe(0);
		// TOP and LIMIT together remain rejected (alt 2 has no limit_clause).
		expect(errorsOf("SELECT TOP 1 x FROM t LIMIT 1")).toBeGreaterThan(0);
	});

	// SLL-surgery wave (2026-07-03): expression_elem's `predicate` alternative was narrowed to
	// predicate_only (EXISTS / quantified comparison / BETWEEN — the forms expr does NOT already
	// carry as its own alternatives), removing an ambiguity on nearly every select item. The IR
	// for every form must be what it was: the overlapping predicate forms (IN/LIKE/IS/…) already
	// parsed via expr under first-alternative-wins.
	// docs.snowflake.com/en/sql-reference/operators-subquery, /en/sql-reference/functions/between
	it("keeps every predicate select-item lowering across the expression_elem fix", () => {
		// EXISTS as a select item → exists IR.
		const ex = selectBody("SELECT EXISTS (SELECT 1 FROM u) AS has_rows FROM t").body;
		expect(ex.projections[0].expr).toMatchObject({ kind: "exists" });
		// Quantified comparison → binary with a subquery right operand.
		const qc = selectBody("SELECT x > ALL (SELECT y FROM u) FROM t").body;
		expect(qc.projections[0].expr).toMatchObject({ kind: "binary", op: ">", right: { kind: "subquery" } });
		// BETWEEN → between predicate IR.
		const bw = selectBody("SELECT a BETWEEN 1 AND 2 FROM t").body;
		expect(bw.projections[0].expr).toMatchObject({ kind: "predicate", op: "between", negated: false });
		const nb = selectBody("SELECT a NOT BETWEEN 1 AND 2 FROM t").body;
		expect(nb.projections[0].expr).toMatchObject({ kind: "predicate", op: "between", negated: true });
		// The expr-subsumed forms keep their IR (they always parsed via expr).
		const inp = selectBody("SELECT a IN (1, 2) FROM t").body;
		expect(inp.projections[0].expr).toMatchObject({ kind: "predicate", op: "in" });
		const lk = selectBody("SELECT a LIKE 'x%' FROM t").body;
		expect(lk.projections[0].expr).toMatchObject({ kind: "predicate", op: "like" });
		const isn = selectBody("SELECT a IS NOT NULL FROM t").body;
		expect(isn.projections[0].expr).toMatchObject({ kind: "predicate", op: "null", negated: true });
		// Function-call and EXISTS select items no longer force the SLL→LL fallback (computed
		// items like `a + b` stay dirty until the select_list_elem fix — the next iteration).
		const fn = parseSnowflake("SELECT SUM(x) FROM t GROUP BY a");
		expect(fn.errors).toBe(0);
		expect(fn.sllFallback).toBe(false);
		const exq = parseSnowflake("SELECT EXISTS (SELECT 1 FROM u) FROM t");
		expect(exq.errors).toBe(0);
		expect(exq.sllFallback).toBe(false);
		// Adjacent invalid form stays rejected: BETWEEN missing its AND arm.
		expect(errorsOf("SELECT a BETWEEN 1 FROM t")).toBeGreaterThan(0);
	});

	// SLL-surgery wave (2026-07-03): select_list_elem's `column_elem` alternative overlapped
	// expression_elem on every dotted-name chain (expr's primitive_expression). It was replaced
	// by column_elem_adjacent, keeping only the forms expr cannot express: the dot-less adjacent
	// qualifier (`CONNECT_BY_ROOT title`) and the `$n` positional reference. The IR must be
	// identical for every form. docs.snowflake.com/en/sql-reference/sql/select
	it("keeps column projections identical across the select_list_elem fix", () => {
		const bare = selectBody("SELECT a, t.b AS c FROM t").body;
		expect(bare.projections[0]).toMatchObject({ name: "a", expr: { kind: "column", parts: ["a"] } });
		expect(bare.projections[1]).toMatchObject({ name: "c", expr: { kind: "column", parts: ["t", "b"] } });
		// IDENTIFIER('t').c was reachable via column_elem's object_name — still parses (via expr).
		expect(errorsOf("SELECT IDENTIFIER('t').c FROM t")).toBe(0);
		// $n positional refs (lexed as ID2 identifiers) keep their exact IR.
		const pos = selectBody("SELECT $1, $2 AS x FROM @my_stage").body;
		expect(pos.projections[0]).toMatchObject({ name: "$1", expr: { kind: "column", parts: ["$1"] } });
		expect(pos.projections[1]).toMatchObject({ name: "x", expr: { kind: "column", parts: ["$2"] } });
		// The adjacent-qualifier forms keep parsing with their exact old IR (qualifier + column
		// merged into one column ref — this is how the grammar supports CONNECT_BY_ROOT):
		const adj = selectBody("SELECT CONNECT_BY_ROOT title AS root_title, a b, q b.c FROM t").body;
		expect(adj.projections[0]).toMatchObject({
			name: "root_title",
			expr: { kind: "column", parts: ["CONNECT_BY_ROOT", "title"] },
		});
		expect(adj.projections[1]).toMatchObject({ name: "b", expr: { kind: "column", parts: ["a", "b"] } });
		expect(adj.projections[2]).toMatchObject({ name: "c", expr: { kind: "column", parts: ["q", "b", "c"] } });
		expect(errorsOf("SELECT IDENTIFIER('q') col FROM t")).toBe(0);
		// Ordinary select items — bare, dotted, computed — no longer force the SLL→LL fallback.
		const r = parseSnowflake("SELECT a, t.b, a + b AS c FROM t");
		expect(r.errors).toBe(0);
		expect(r.sllFallback).toBe(false);
		// Adjacent invalid forms stay rejected: four adjacent names / a detached $ position.
		expect(errorsOf("SELECT a b c d FROM t")).toBeGreaterThan(0);
		expect(errorsOf("SELECT t.$ 1 FROM t")).toBeGreaterThan(0);
	});

	// SLL-surgery wave (2026-07-03): primitive_expression dropped its NULL_ alternative (literal
	// already carries NULL_) and swapped full_column_name for degenerate_column_ref — exactly the
	// empty-segment forms (docs.snowflake.com/en/sql-reference/name-resolution), the one part of
	// full_column_name a plain id-chain cannot express. IR unchanged for every form.
	it("keeps NULL literals and empty-segment column refs across the primitive_expression fix", () => {
		const nul = selectBody("SELECT NULL AS n FROM t").body;
		expect(nul.projections[0]).toMatchObject({ name: "n", expr: { kind: "literal", text: "NULL" } });
		// Plain chains keep their column IR (and stay on the SLL path end-to-end).
		const chain = parseSnowflake("SELECT db1.sch.tbl.col FROM db1.sch.tbl");
		expect(chain.errors).toBe(0);
		expect(chain.sllFallback).toBe(false);
		const ir = selectBody("SELECT db1.sch.tbl.col FROM db1.sch.tbl").body;
		expect(ir.projections[0].expr).toMatchObject({ kind: "column", parts: ["db1", "sch", "tbl", "col"] });
		// Empty-segment refs (omitted db/schema/table) still parse, with the same collapsed parts.
		for (const [sql, parts] of [
			["SELECT a..c FROM t", ["a", "c"]],
			["SELECT ..c FROM t", ["c"]],
			["SELECT a.b..c FROM t", ["a", "b", "c"]],
			["SELECT a...c FROM t", ["a", "c"]],
		] as const) {
			const b = selectBody(sql).body;
			expect(b.projections[0].expr, sql).toMatchObject({ kind: "column", parts: [...parts] });
		}
	});

	// SLL-surgery wave (2026-07-03): function_call dropped round_expr and the four builtin-arity
	// alternatives (all id_-member names — their strings parse via the aggregate/general-call
	// alternatives), and aggregate_function now requires aggregate-only surface (DISTINCT /
	// WITHIN GROUP / the LISTAGG keyword) so plain f(args) calls belong to object_name(...)
	// alone. lower() gained the func_arg_list read, which also fixes the old arg-drop on
	// dotted-name and named-argument calls. docs.snowflake.com/en/sql-reference/functions-all
	it("keeps every call form lowering across the function_call fix", () => {
		const proj = (sql: string) => selectBody(sql).body.projections[0].expr;
		// Builtin-token calls keep name + args (they now ride the aggregate/general alternatives).
		expect(proj("SELECT IFNULL(a, b) FROM t")).toMatchObject({
			kind: "function",
			name: "ifnull",
			args: [{ parts: ["a"] }, { parts: ["b"] }],
		});
		expect(proj("SELECT DATEADD(day, 5, d) FROM t")).toMatchObject({
			kind: "function",
			name: "dateadd",
			args: [{ parts: ["day"] }, {}, { parts: ["d"] }],
		});
		// ROUND — positional, mode-carrying, and named-argument forms all still parse.
		expect(proj("SELECT ROUND(a, 2) FROM t")).toMatchObject({ kind: "function", name: "round" });
		expect(errorsOf("SELECT ROUND(a, 2, 'HALF_TO_EVEN') FROM t")).toBe(0);
		expect(errorsOf("SELECT ROUND(EXPR => a, SCALE => 2) FROM t")).toBe(0);
		// Aggregates: star, DISTINCT, WITHIN GROUP, LISTAGG/ARRAY_AGG.
		expect(proj("SELECT COUNT(*) FROM t")).toMatchObject({
			kind: "function",
			name: "count",
			aggregate: true,
			distinct: false,
			args: [],
		});
		expect(proj("SELECT COUNT(DISTINCT x) FROM t")).toMatchObject({
			kind: "function",
			name: "count",
			aggregate: true,
			distinct: true,
			args: [{ parts: ["x"] }],
		});
		expect(proj("SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x) FROM t")).toMatchObject({
			kind: "function",
			name: "percentile_cont",
			aggregate: true,
		});
		expect(proj("SELECT LISTAGG(DISTINCT x, ',') WITHIN GROUP (ORDER BY x) FROM t")).toMatchObject({
			kind: "function",
			name: "listagg",
			aggregate: true,
			distinct: true,
		});
		expect(proj("SELECT ARRAY_AGG(x) FROM t")).toMatchObject({
			kind: "function",
			name: "array_agg",
			aggregate: true,
		});
		expect(proj("SELECT ARRAY_AGG(DISTINCT x) FROM t")).toMatchObject({
			kind: "function",
			name: "array_agg",
			aggregate: true,
			distinct: true,
		});
		// The general alternative's args are no longer dropped (dotted + named-arg calls).
		expect(proj("SELECT sch.f(a, b) FROM t")).toMatchObject({
			kind: "function",
			name: "f",
			args: [{ parts: ["a"] }, { parts: ["b"] }],
		});
		expect(proj("SELECT f(name => x) FROM t")).toMatchObject({
			kind: "function",
			name: "f",
			args: [{ parts: ["x"] }],
		});
		// Window functions keep their windows on both routes.
		expect(proj("SELECT RANK() OVER (ORDER BY x) FROM t")).toMatchObject({ kind: "function", name: "rank" });
		expect(proj("SELECT DENSE_RANK() OVER (ORDER BY x) FROM t")).toMatchObject({
			kind: "function",
			name: "dense_rank",
		});
		expect(proj("SELECT NTILE(4) OVER (ORDER BY x) FROM t")).toMatchObject({ kind: "function", name: "ntile" });
		expect(proj("SELECT LEAD(x) IGNORE NULLS OVER (ORDER BY x) FROM t")).toMatchObject({
			kind: "function",
			name: "lead",
		});
		expect(proj("SELECT LAST_VALUE(x) OVER (ORDER BY x) FROM t")).toMatchObject({
			kind: "function",
			name: "last_value",
		});
		// A simple aggregate-carrying SELECT no longer forces the SLL→LL fallback.
		const r = parseSnowflake("SELECT COUNT(*), SUM(x), IFNULL(a, b) FROM t");
		expect(r.errors).toBe(0);
		expect(r.sllFallback).toBe(false);
		// Adjacent invalid forms stay rejected: DISTINCT with no expr; WITHIN GROUP on a star call.
		expect(errorsOf("SELECT SUM(DISTINCT) FROM t")).toBeGreaterThan(0);
		expect(errorsOf("SELECT COUNT(*) WITHIN GROUP (ORDER BY x) FROM t")).toBeGreaterThan(0);
	});

	// SLL-surgery wave (2026-07-03): predicate dropped its IN / [I]LIKE [ANY|ALL] / RLIKE /
	// REGEXP / IS-null alternatives (each verbatim an expr alternative — subsets of the bare-expr
	// branch that made SLL mispredict WHERE tails), and order_item dropped its id_/num subsets of
	// expr (SLL's id_ pick broke every dotted/computed ORDER BY key). IR pinned per form; the
	// IS-null fix also repairs a latent drop (the old predicate path lowered `b IS NOT NULL` to a
	// bare column, losing the null test — the expr path models it).
	it("keeps WHERE predicates and ORDER BY keys across the predicate/order_item fix", () => {
		const where = (sql: string) => selectBody(sql).body.where;
		expect(where("SELECT a FROM t WHERE state IN ('x','y')")).toMatchObject({ kind: "predicate", op: "in" });
		expect(where("SELECT a FROM t WHERE n LIKE 'x%' ESCAPE '!'")).toMatchObject({ kind: "predicate", op: "like" });
		expect(where("SELECT a FROM t WHERE n NOT RLIKE 'p'")).toMatchObject({
			kind: "predicate",
			op: "rlike",
			negated: true,
		});
		expect(where("SELECT a FROM t WHERE n LIKE ANY ('a%', 'b%')")).toMatchObject({ kind: "predicate", op: "like" });
		expect(where("SELECT a FROM t WHERE b IS NOT NULL")).toMatchObject({
			kind: "predicate",
			op: "null",
			negated: true,
		});
		expect(where("SELECT a FROM t WHERE d BETWEEN '2023-01-01' AND '2023-02-01'")).toMatchObject({
			kind: "predicate",
			op: "between",
		});
		expect(where("SELECT a FROM t WHERE x > ALL (SELECT y FROM u)")).toMatchObject({ kind: "binary", op: ">" });
		// The bail shapes from the corpus census now stay on the SLL path.
		for (const sql of [
			"SELECT a FROM t WHERE state IN ('FAILED','ABORTED') ORDER BY started",
			"SELECT a FROM t WHERE deleted IS NULL;",
			"SELECT a FROM t GROUP BY 1 ORDER BY l.user_name",
			"SELECT a FROM t ORDER BY oc['PROVINCE']",
			"SELECT a FROM t ORDER BY total / GREATEST(x, 1)",
		]) {
			const r = parseSnowflake(sql);
			expect(r.errors, sql).toBe(0);
			expect(r.sllFallback, sql).toBe(false);
		}
		// ORDER BY key IR shapes are unchanged (bare, positional, dotted).
		const ob = (sql: string) => ir(sql).q.orderBy;
		expect(ob("SELECT a FROM t ORDER BY b")).toMatchObject([{ kind: "column", parts: ["b"] }]);
		expect(ob("SELECT a FROM t ORDER BY 3")).toMatchObject([{ kind: "literal", text: "3" }]);
		expect(ob("SELECT a FROM t ORDER BY t.b DESC")).toMatchObject([{ kind: "column", parts: ["t", "b"] }]);
		// Adjacent invalid forms stay rejected.
		expect(errorsOf("SELECT a FROM t WHERE x IN")).toBeGreaterThan(0);
		expect(errorsOf("SELECT a FROM t ORDER BY")).toBeGreaterThan(0);
	});

	it("models QUALIFY as a predicate with clause-tagged column refs", () => {
		const { body } = selectBody("SELECT a, ROW_NUMBER() OVER (ORDER BY a) rn FROM t QUALIFY rn = 1");
		expect(body.qualify).toMatchObject({ kind: "binary", op: "=" });
		expect(body.columns.some((c) => c.clause === "qualify" && c.parts.join(".") === "rn")).toBe(true);
		expect(body.unsupported ?? []).not.toContain("qualify");
	});

	it("lowers stars and qualified stars", () => {
		const plain = selectBody("SELECT * FROM t").body;
		expect(plain.projections[0]).toMatchObject({ isStar: true, expr: { kind: "star" } });
		const qualified = selectBody("SELECT t.* FROM t").body;
		expect(qualified.projections[0].expr).toMatchObject({ kind: "star", qualifier: ["t"] });
	});

	it("models the star modifiers EXCLUDE / ILIKE / RENAME / REPLACE", () => {
		const ex = selectBody("SELECT * EXCLUDE (a, b) FROM t").body.projections[0].expr;
		expect(ex).toMatchObject({ kind: "star", exclude: ["a", "b"] });

		const il = selectBody("SELECT * ILIKE '%amount%' FROM t").body.projections[0].expr;
		expect(il).toMatchObject({ kind: "star", ilike: "%amount%" });

		const rn = selectBody("SELECT * RENAME (a AS x, b AS y) FROM t").body.projections[0].expr;
		expect(rn).toMatchObject({
			kind: "star",
			rename: [
				{ from: "a", to: "x" },
				{ from: "b", to: "y" },
			],
		});

		const rp = selectBody("SELECT * REPLACE (amount / 100 AS amount) FROM t").body.projections[0].expr;
		if (rp.kind !== "star") throw new Error("star");
		expect(rp.replace?.[0].column).toBe("amount");
		expect(rp.replace?.[0].expr).toMatchObject({ kind: "binary", op: "/" });

		const combined = selectBody("SELECT t.* EXCLUDE (a) RENAME (c AS d) FROM t").body;
		expect(combined.projections[0].expr).toMatchObject({
			kind: "star",
			exclude: ["a"],
			rename: [{ from: "c", to: "d" }],
		});
		expect(combined.unsupported ?? []).not.toContain("star-modifier");
	});

	it("collects scalar/IN/EXISTS subqueries into subqueries and predicate args", () => {
		const { body } = selectBody(
			"SELECT (SELECT MAX(x) FROM m) mx FROM t WHERE a IN (SELECT id FROM ids) AND EXISTS (SELECT 1 FROM e)",
		);
		expect(body.subqueries?.length).toBeGreaterThanOrEqual(3);
	});

	it("lowers FROM subqueries with alias", () => {
		const { body } = selectBody("SELECT * FROM (SELECT a FROM t) s");
		expect(body.from[0]).toMatchObject({ kind: "subquery", alias: "s" });
	});

	it("lowers variant paths and subscripts onto subscript, :: onto cast", () => {
		const { body } = selectBody("SELECT payload:a.b::STRING, arr[0] FROM t");
		const cast = body.projections[0].expr;
		expect(cast.kind).toBe("cast");
		if (cast.kind !== "cast") return;
		expect(cast.expr.kind).toBe("subscript");
		if (cast.expr.kind !== "subscript") return;
		expect(cast.expr.base).toMatchObject({ kind: "column", parts: ["payload"] });
		expect(body.projections[1].expr).toMatchObject({ kind: "subscript", index: { kind: "literal", text: "0" } });
		expect(body.columns.some((c) => c.parts.join(".") === "payload")).toBe(true);
	});

	it("lowers searched and simple CASE (simple desugars to equality)", () => {
		const searched = selectBody("SELECT CASE WHEN a > 1 THEN 'x' ELSE 'y' END FROM t").body;
		expect(searched.projections[0].expr.kind).toBe("case");
		const simple = selectBody("SELECT CASE a WHEN 1 THEN 'x' END FROM t").body;
		const expr = simple.projections[0].expr;
		if (expr.kind !== "case") throw new Error("case");
		expect(expr.whens[0].when).toMatchObject({ kind: "binary", op: "=" });
	});

	it("lowers IFF to a case", () => {
		const { body } = selectBody("SELECT IFF(a > 0, 'p', 'n') FROM t");
		expect(body.projections[0].expr.kind).toBe("case");
	});

	it("lowers lambdas as higher-order function arguments", () => {
		const { body } = selectBody("SELECT FILTER(arr, x -> x > 10) FROM t");
		const fn = body.projections[0].expr;
		if (fn.kind !== "function") throw new Error("function");
		expect(fn.args.some((a) => a.kind === "lambda" && a.params.includes("x"))).toBe(true);
	});

	it("lowers LATERAL FLATTEN to a lateral source exposing the six FLATTEN columns", () => {
		const { body } = selectBody("SELECT f.value FROM t, LATERAL FLATTEN(input => t.payload) f");
		const lateral = body.from.find((s) => s.kind === "lateral");
		expect(lateral).toBeDefined();
		if (lateral?.kind !== "lateral") return;
		expect(lateral.alias).toBe("f");
		expect(lateral.columns).toEqual(["SEQ", "KEY", "PATH", "INDEX", "VALUE", "THIS"]);
	});

	// <seq>.NEXTVAL — a sequence's next value, a NUMBER-returning pseudo-function:
	// docs.snowflake.com/en/sql-reference/functions/nextval
	it("lowers <seq>.NEXTVAL to a nextval function carrying the sequence as qualifier", () => {
		const { body } = selectBody("SELECT seq_01.nextval");
		const fn = body.projections[0].expr;
		expect(fn).toMatchObject({ kind: "function", name: "nextval", qualifier: "seq_01", args: [] });
	});

	it("keeps a dotted (db.schema) sequence path in the NEXTVAL qualifier", () => {
		const { body } = selectBody("SELECT my_db.my_schema.seq_5.nextval x");
		const fn = body.projections[0].expr;
		expect(fn).toMatchObject({ kind: "function", name: "nextval", qualifier: "my_db.my_schema.seq_5" });
	});

	// CONNECT BY hierarchical query: docs.snowflake.com/en/sql-reference/constructs/connect-by
	it("un-flags CONNECT BY and keeps the START WITH / CONNECT BY predicates as column refs", () => {
		const { body } = selectBody(
			"SELECT employee_ID, manager_ID, title FROM employees START WITH title = 'President' CONNECT BY manager_ID = PRIOR employee_id",
		);
		expect(body.unsupported).toBeUndefined();
		// START WITH `title` and CONNECT BY `manager_id` / `employee_id` are conserved via columnsOf.
		const whereCols = body.columns.filter((c) => c.clause === "where").map((c) => c.parts.join(".").toLowerCase());
		expect(whereCols).toEqual(expect.arrayContaining(["title", "manager_id", "employee_id"]));
	});

	it("conserves both sides of a PRIOR equality from the CONNECT BY predicate", () => {
		// `parent = PRIOR id` — columnsOf recurses through the `prior(id)` function, so both `parent`
		// and `id` are conserved (a dropped PRIOR arg would lose `id`); no unsupported flag.
		const { body } = selectBody("SELECT id FROM t START WITH parent IS NULL CONNECT BY parent = PRIOR id");
		expect(body.unsupported).toBeUndefined();
		const whereCols = body.columns.filter((c) => c.clause === "where").map((c) => c.parts.join(".").toLowerCase());
		expect(whereCols).toEqual(expect.arrayContaining(["parent", "id"]));
	});

	it("lowers PIVOT to PivotInfo", () => {
		const { body } = selectBody("SELECT * FROM monthly_sales PIVOT (SUM(amount) FOR month IN ('JAN', 'FEB')) p");
		expect(body.pivot).toBeDefined();
		expect(body.pivot?.values).toEqual(["JAN", "FEB"]);
		expect(body.pivot?.forColumns).toEqual(["month"]);
		expect(body.pivot?.aggColumns).toEqual(["amount"]);
	});

	it("lowers UNPIVOT to UnpivotInfo", () => {
		const { body } = selectBody("SELECT * FROM p UNPIVOT (sales FOR month IN (jan, feb, mar))");
		expect(body.unpivot).toMatchObject({ valueColumn: "sales", nameColumn: "month" });
		expect(body.unpivot?.removed).toEqual(["jan", "feb", "mar"]);
	});

	it("lowers an inline VALUES source to a modelled subquery select", () => {
		const { body } = selectBody("SELECT * FROM (VALUES (1, 'a'), (2, 'b')) v (id, name)");
		const src = body.from[0];
		expect(src).toMatchObject({ kind: "subquery", alias: "v", columnAliases: ["id", "name"] });
		if (src.kind !== "subquery") return;
		expect(src.query.body.kind).toBe("select");
		if (src.query.body.kind !== "select") return;
		expect(src.query.body.projections).toHaveLength(2);
	});

	it("lowers $n positional references as columns", () => {
		const { body } = selectBody("SELECT $1, $2 FROM @my_stage");
		expect(body.projections[0].expr).toMatchObject({ kind: "column", parts: ["$1"] });
	});

	it("captures window functions with partition and order keys", () => {
		const { body } = selectBody("SELECT ROW_NUMBER() OVER (PARTITION BY g ORDER BY ts DESC) rn FROM t");
		const fn = body.projections[0].expr;
		if (fn.kind !== "function") throw new Error("function");
		expect(fn.window?.partitionBy).toHaveLength(1);
		expect(fn.window?.orderBy).toHaveLength(1);
		expect(body.columns.some((c) => c.parts.join(".") === "g")).toBe(true);
	});

	it("flags non-query statements instead of throwing", () => {
		const { q } = ir("DELETE FROM t WHERE a = 1");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.unsupported).toContain("non-query");
	});

	// A standalone Snowflake Scripting block (docs.snowflake.com/en/developer-guide/snowflake-scripting/
	// blocks) is a statement *sequence*, not a query. lower() used to search for the first inner
	// query_statement without regard for the scripting-block boundary, so it silently claimed the
	// block's FIRST inner SELECT as if it were the file's whole query (real projections/scopes) and
	// dropped every statement after it with no signal. Mirrors databricks' BEGIN...END handling.
	it("flags a two-statement scripting block instead of claiming its first SELECT", () => {
		const { q, errors } = ir("BEGIN SELECT a1 FROM t1; SELECT a2 FROM t2; END");
		expect(errors).toBe(0);
		expect(q.statement).toBe("compound");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.unsupported).toContain("compound");
		// No silent partial modelling: the flagged stub carries none of t1's real projections/columns.
		expect(q.body.projections).toEqual([]);
		expect(q.body.from).toEqual([]);
		expect(q.body.columns).toEqual([]);
	});

	it("flags a DECLARE + single-SELECT scripting block the same way", () => {
		const { q, errors } = ir("DECLARE x INT; BEGIN SELECT a FROM t; END");
		expect(errors).toBe(0);
		expect(q.statement).toBe("compound");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.unsupported).toContain("compound");
		expect(q.body.projections).toEqual([]);
	});

	it("still lowers a plain single SELECT fully (scripting-block fix leaves it untouched)", () => {
		const { body } = selectBody("SELECT a FROM t");
		expect(body.unsupported ?? []).toEqual([]);
		expect(body.projections).toHaveLength(1);
		expect(body.from).toHaveLength(1);
	});

	// --- reference-manual conformance review (2026-06-13) ---

	it("lowers the REGEXP operator like RLIKE, not to an opaque node", () => {
		const { body } = selectBody("SELECT * FROM t WHERE a REGEXP 'x.*'");
		expect(body.where).toMatchObject({ kind: "predicate", op: "rlike" });
		expect(body.columns.some((c) => c.clause === "where" && c.parts.join(".") === "a")).toBe(true);
	});

	it("lowers GROUP BY ROLLUP/CUBE/GROUPING SETS to the leaf keys only", () => {
		const { body } = selectBody("SELECT a, b, SUM(x) AS s FROM t GROUP BY ROLLUP (a, b)");
		expect(body.groupBy?.map((e) => e.kind)).toEqual(["column", "column"]);
		const mixed = selectBody("SELECT a, b, c FROM t GROUP BY ROLLUP (a, b), c").body;
		expect(mixed.groupBy?.map((e) => e.kind)).toEqual(["column", "column", "column"]);
	});

	it("lowers CAST to a user-defined type with the UDT name as typeText", () => {
		const { body } = selectBody("SELECT CAST(v AS my_db.my_udt) AS c FROM t");
		expect(body.projections[0].expr).toMatchObject({ kind: "cast", typeText: "my_db.my_udt" });
	});
});

// LEFT/RIGHT are reserved keywords that "cannot be used as table name or alias in a FROM clause"
// (docs.snowflake.com/en/sql-reference/reserved-keywords). Before the fix, a bare (AS-less) LEFT/RIGHT
// immediately before JOIN was greedily consumed as the left source's alias — `object_ref`'s `as_alias?`
// slot reaches `id_ → binary_builtin_function → LEFT|RIGHT` — silently degrading the join to plain INNER.
describe("Snowflake bare LEFT/RIGHT before JOIN are join keywords, not aliases", () => {
	function firstJoin(sql: string) {
		const { body } = selectBody(sql);
		expect(body.joins?.length ?? 0).toBeGreaterThan(0);
		return { body, join0: body.joins![0], from0: body.from![0] };
	}

	it("bare LEFT JOIN on a base table is a LEFT join, no spurious alias", () => {
		const { join0, from0 } = firstJoin("SELECT * FROM t LEFT JOIN u ON t.a = u.a");
		expect(join0.kind).toBe("left");
		expect(from0.alias).toBeUndefined();
	});

	it("bare RIGHT JOIN on a base table is a RIGHT join, no spurious alias", () => {
		const { join0, from0 } = firstJoin("SELECT * FROM t RIGHT JOIN u ON t.a = u.a");
		expect(join0.kind).toBe("right");
		expect(from0.alias).toBeUndefined();
	});

	it("bare LEFT JOIN with USING is a LEFT join", () => {
		const { join0, from0 } = firstJoin("SELECT * FROM t LEFT JOIN u USING (a)");
		expect(join0.kind).toBe("left");
		expect(from0.alias).toBeUndefined();
	});

	it("LEFT JOIN after a parenthesized source is a LEFT join", () => {
		const { join0, from0 } = firstJoin("SELECT * FROM (t) LEFT JOIN u ON t.a = u.a");
		expect(join0.kind).toBe("left");
		expect(from0.alias).toBeUndefined();
	});

	it("LEFT JOIN after an unaliased subquery is a LEFT join", () => {
		const { join0 } = firstJoin("SELECT * FROM (SELECT 1 x) LEFT JOIN u ON u.x = 1");
		expect(join0.kind).toBe("left");
	});

	it("LEFT JOIN after a parenthesized join operand is a LEFT join", () => {
		const { join0, from0 } = firstJoin("SELECT * FROM (a JOIN b ON a.x = b.x) LEFT JOIN c ON a.y = c.y");
		expect(join0.kind).toBe("left");
		expect(from0.alias).toBeUndefined();
	});

	it("LEFT JOIN after a TABLE(fn) source is a LEFT join", () => {
		const { join0, from0 } = firstJoin("SELECT * FROM TABLE(myfn(1)) LEFT JOIN u ON u.a = 1");
		expect(join0.kind).toBe("left");
		expect(from0.alias).toBeUndefined();
	});

	it("the leading LEFT in a LEFT..RIGHT chain is a LEFT join, not an alias", () => {
		const { body, from0 } = firstJoin("SELECT * FROM a LEFT JOIN b ON a.x = b.x RIGHT JOIN c ON a.y = c.y");
		expect(body.joins?.map((j) => j.kind)).toEqual(["left", "right"]);
		expect(from0.alias).toBeUndefined();
	});

	// --- controls: the fix must NOT narrow these ---

	it("CONTROL: explicit AS left still binds LEFT as an alias (fork superset)", () => {
		const { body } = selectBody("SELECT * FROM t AS left");
		expect(body.from[0].alias).toBe("left");
		expect(body.joins?.length ?? 0).toBe(0);
	});

	it("CONTROL: explicit AS right still binds RIGHT as an alias", () => {
		const { body } = selectBody("SELECT * FROM t AS right");
		expect(body.from[0].alias).toBe("right");
	});

	it("CONTROL: a bare non-keyword alias is still an alias", () => {
		const { body } = selectBody("SELECT * FROM t u JOIN v ON u.a = v.a");
		expect(body.from[0].alias).toBe("u");
		expect(body.joins?.[0].kind).toBe("inner");
	});

	it("CONTROL: LEFT(x,1) / RIGHT(x,1) function calls are untouched", () => {
		expect(errorsOf("SELECT LEFT(x, 1), RIGHT(x, 1) FROM t")).toBe(0);
		const { body } = selectBody("SELECT LEFT(x, 1) AS l FROM t");
		expect(body.projections[0].name).toBe("l");
		expect(body.from[0].alias).toBeUndefined();
	});
});

// The fork lexes SHOW-object plural words + statement/option keyword tokens (SHOW REGIONS,
// COPY options, session parameters, DDL option words, …) as dedicated tokens that were absent
// from id_, so any table/column named after one was rejected — `SELECT a FROM regions` failed.
// Snowflake reserves very few words (docs.snowflake.com/en/sql-reference/reserved-keywords); every
// non-reserved one is a legal identifier, so these were an acceptance bug. Enumerated by
// temp_auto/audit-id-holes.mjs (538 tokens recovered).
describe("Snowflake keyword-token identifier holes (SHOW-object / option words as names)", () => {
	// A doc-cited spread across the recovered categories: SHOW-object plural (regions), COPY/format
	// options (auto_compress, avro, csv, json, encoding, compression), object words (volume, iceberg,
	// listing, application), option/param words (format, header, access, masking, handler),
	// clause-adjacent non-reserved words (before, changes, limit, fetch, within), and the scripting
	// keyword `do` (ON n PERCENT DO — non-reserved, so `SELECT do FROM t` must parse).
	const RECOVERED = [
		"regions",
		"auto_compress",
		"avro",
		"csv",
		"json",
		"do",
		"volume",
		"iceberg",
		"format",
		"header",
		"access",
		"application",
		"listing",
		"encoding",
		"compression",
		"masking",
		"handler",
		"before",
		"changes",
		"limit",
		"fetch",
		"within",
	];

	it.each(RECOVERED)("`%s` is usable as a table name in FROM", (word) => {
		const { body } = selectBody(`SELECT a FROM ${word}`);
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: [word] } });
	});

	it.each(RECOVERED)("`%s` is usable as a projected column name", (word) => {
		expect(errorsOf(`SELECT ${word} FROM t`)).toBe(0);
	});

	// --- reject-controls ---

	// Five non-reserved tokens stay OUT of id_ because reaching them re-reads existing SQL:
	// asc/desc = sort direction (ORDER BY x DESC); nextval = object_name DOT NEXTVAL; listagg = its
	// WITHIN GROUP aggregate; default = the USE SECONDARY ROLES / column DEFAULT sentinel. Not a
	// bare table name. (PIVOT/UNPIVOT moved OUT of this list — the post-source-slot split landed, so
	// they ARE usable as identifiers now; see the dedicated describe block below.)
	it.each(["asc", "desc", "nextval", "listagg", "default"])(
		"dedicated-role word `%s` is NOT usable as a bare table name",
		(word) => {
			expect(errorsOf(`SELECT a FROM ${word}`)).toBeGreaterThan(0);
		},
	);

	// Engine-reserved words (docs.snowflake.com/en/sql-reference/reserved-keywords) stay rejected.
	it.each(["select", "from", "where", "table", "sample"])(
		"engine-reserved word `%s` is NOT usable as a bare table name",
		(word) => {
			expect(errorsOf(`SELECT a FROM ${word}`)).toBeGreaterThan(0);
		},
	);
});

// PIVOT/UNPIVOT are NOT reserved (docs.snowflake.com/en/sql-reference/reserved-keywords), so they are
// legal identifiers — table, column, and (AS-prefixed) alias names. They were previously held out of id_
// entirely: a trailing PIVOT after a FROM source is the `pivot_unpivot` clause, so putting PIVOT into the
// bare (AS-less) FROM-alias slot made that slot compete with the pivot clause (raising the SLL fallback
// ratchet on the two-PIVOTs-after-a-subquery case). The post-source-slot split cures it: id_ reaches the
// two words via `pivot_unpivot_word`, but the bare-alias slot (`bare_from_alias`) does NOT — exactly the
// LEFT/RIGHT bare-alias exclusion pattern. So they parse as ordinary identifiers everywhere except the
// bare post-source alias position, where a trailing PIVOT/UNPIVOT stays reserved for the pivot clause.
describe("Snowflake PIVOT/UNPIVOT as ordinary identifiers (not reserved)", () => {
	it("parses `pivot` as a projected bare column", () => {
		const { body } = selectBody("SELECT pivot FROM t");
		expect(body.projections[0]).toMatchObject({ name: "pivot", expr: { kind: "column", parts: ["pivot"] } });
	});

	it("parses `unpivot` as a projected bare column", () => {
		const { body } = selectBody("SELECT unpivot FROM t");
		expect(body.projections[0]).toMatchObject({ name: "unpivot", expr: { kind: "column", parts: ["unpivot"] } });
	});

	it("parses `t.pivot` as a dotted column reference", () => {
		const { body } = selectBody("SELECT t.pivot FROM t");
		expect(body.projections[0].expr).toMatchObject({ kind: "column", parts: ["t", "pivot"] });
	});

	it("parses `unpivot` as a bare table name in FROM", () => {
		const { body } = selectBody("SELECT a FROM unpivot");
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["unpivot"] } });
	});

	it("parses `pivot` as a bare table name in FROM", () => {
		const { body } = selectBody("SELECT a FROM pivot");
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["pivot"] } });
	});

	it("allows PIVOT/UNPIVOT after an explicit AS as a FROM alias", () => {
		const { body } = selectBody("SELECT * FROM t AS pivot");
		expect(body.from[0].alias).toBe("pivot");
		expect(body.joins?.length ?? 0).toBe(0);
	});

	// --- guard direction: the post-source pivot clause reading must be preserved ---

	it("GUARD: a real post-source PIVOT clause still lowers to PivotInfo, not an alias", () => {
		const { body } = selectBody("SELECT * FROM monthly_sales PIVOT (SUM(amount) FOR month IN ('JAN', 'FEB'))");
		expect(body.pivot).toBeDefined();
		expect(body.pivot?.values).toEqual(["JAN", "FEB"]);
		expect(body.pivot?.forColumns).toEqual(["month"]);
		expect(body.from[0].alias).toBeUndefined();
	});

	it("GUARD: a real post-source UNPIVOT clause still lowers to UnpivotInfo", () => {
		const { body } = selectBody("SELECT * FROM p UNPIVOT (sales FOR month IN (jan, feb, mar))");
		expect(body.unpivot).toMatchObject({ valueColumn: "sales", nameColumn: "month" });
		expect(body.from[0].alias).toBeUndefined();
	});

	it("GUARD: chained PIVOTs after a subquery still read as two pivot clauses (sentinel constructs/pivot/19)", () => {
		expect(
			errorsOf(
				"SELECT * FROM (SELECT amount, q FROM s) PIVOT(SUM(amount) FOR q IN ('a','b')) PIVOT(MAX(d) FOR q2 IN ('a','b'))",
			),
		).toBe(0);
	});

	// A BARE trailing PIVOT/UNPIVOT with no parenthesized clause stays NOPARSE. The `pivot_unpivot` rule
	// REQUIRES `PIVOT (` / `UNPIVOT (`, so a bare `t pivot` cannot be a pivot clause; and the bare
	// FROM-alias slot deliberately excludes PIVOT/UNPIVOT (the post-source-slot split), so it is not an
	// alias either. This mirrors the bare LEFT/RIGHT exclusion: use `AS pivot` to alias with the word.
	// Rejecting here is the language-exactness choice — it preserves the pivot-clause reading of every
	// existing corpus file and only ADDS the identifier readings elsewhere.
	it.each(["pivot", "unpivot"])("bare trailing `%s` (no parens) after a source is NOT a FROM alias", (word) => {
		expect(errorsOf(`SELECT * FROM t ${word}`)).toBeGreaterThan(0);
	});
});

// IDENTIFIER(...) takes a `?` bind variable (JDBC/ODBC/Python client style) alongside a string or a
// $session_variable: docs.snowflake.com/en/sql-reference/identifier-literal. Wired into the three
// grammar sites that already had the (string | id_) form: object_name, schema_name, use_schema.
describe("Snowflake IDENTIFIER(?) bind-variable argument", () => {
	it("parses IDENTIFIER(?) as a FROM source", () => {
		expect(errorsOf("SELECT * FROM IDENTIFIER(?) AS t1")).toBe(0);
	});

	it("parses IDENTIFIER(?) in USE SCHEMA", () => {
		expect(errorsOf("USE SCHEMA IDENTIFIER(?)")).toBe(0);
	});

	it("parses IDENTIFIER(?) as a CREATE TABLE target", () => {
		expect(errorsOf("CREATE OR REPLACE TABLE IDENTIFIER(?) (c1 NUMBER)")).toBe(0);
	});

	it("parses IDENTIFIER(?) as a DROP TABLE target", () => {
		expect(errorsOf("DROP TABLE IDENTIFIER(?)")).toBe(0);
	});

	it("parses IDENTIFIER(?) as an INSERT INTO target", () => {
		// The IDENTIFIER(?) target itself is fixed; a `?` bind variable used as a VALUES literal is a
		// separate, broader gap (`?` as a general expr) — not part of this fix, so this probe uses a
		// plain literal in VALUES to isolate the target-position fix.
		expect(errorsOf("INSERT INTO IDENTIFIER(?) (c1) VALUES (1)")).toBe(0);
	});

	// GUARD: the existing string/$session_variable forms still work unchanged.
	it("GUARD: IDENTIFIER('...') string form still parses", () => {
		expect(errorsOf("SELECT * FROM IDENTIFIER('mydb.myschema.mytable')")).toBe(0);
	});

	it("GUARD: IDENTIFIER($var) session-variable form still parses", () => {
		expect(errorsOf("SELECT * FROM IDENTIFIER($mytable_name)")).toBe(0);
	});
});

// RESULTSET is a Snowflake Scripting variable type (DECLARE res RESULTSET;), not a general SQL data
// type — CAST etc. don't take it: docs.snowflake.com/en/developer-guide/snowflake-scripting/variables.
// Wired into task_scripting_declaration only (shared by the standalone scripting_block and CREATE
// TASK's scripting body), not into the general data_type rule.
describe("Snowflake Scripting RESULTSET variable declaration", () => {
	it("parses a DECLARE ... RESULTSET ... BEGIN ... END block", () => {
		expect(
			errorsOf(
				`DECLARE
  name STRING;
  temperature FLOAT;
  res RESULTSET;
BEGIN
  name := 'Snowman';
  temperature := -20.14;
  res := (SELECT 1 AS a);
  RETURN LAST_QUERY_ID();
END;`,
			),
		).toBe(0);
	});

	it("parses RESULTSET as the sole declared variable", () => {
		expect(
			errorsOf(
				`DECLARE
  res RESULTSET;
BEGIN
  res := (SELECT 1 AS a);
  RETURN res;
END;`,
			),
		).toBe(0);
	});

	// RESULTSET is not a reserved keyword (docs.snowflake.com/en/sql-reference/reserved-keywords), so
	// adding the lexer token must not create an identifier hole.
	it("GUARD: `resultset` is still usable as a bare column name", () => {
		const { body } = selectBody("SELECT resultset FROM t");
		expect(body.projections[0]).toMatchObject({ name: "resultset", expr: { kind: "column", parts: ["resultset"] } });
	});

	it("GUARD: `resultset` is still usable as a bare table name", () => {
		const { body } = selectBody("SELECT a FROM resultset");
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["resultset"] } });
	});

	// GUARD: RESULTSET stays out of the general data_type rule (scripting-only, per the docs) — a
	// table column can't be declared RESULTSET. (CAST(x AS RESULTSET) does parse: cast_expr's
	// AS-type slot already falls back to `object_name` for user-defined type names, the same escape
	// hatch every other non-reserved identifier has — not a data_type-specific hole.)
	it("GUARD: a table column cannot be declared RESULTSET (not a general data type)", () => {
		expect(errorsOf("CREATE TABLE t (c1 RESULTSET)")).toBeGreaterThan(0);
	});
});

// Snowflake Scripting LET (docs.snowflake.com/en/developer-guide/snowflake-scripting/variables):
// "LET <variable_name> <type> { DEFAULT | := } <expression>;" (or, type inferred, without <type>).
// Declares AND assigns a variable inline in a scripting block, without a separate DECLARE section.
// Wired into task_scripting_statement only (shared by the standalone scripting_block and CREATE
// TASK's scripting body, same seam as RESULTSET above); docs.snowflake.com/en/sql-reference/sql/
// create-task's own example uses this exact shape (LET OUTPUT_DIR STRING := SYSTEM$GET_TASK_GRAPH_CONFIG(...)::string;).
describe("Snowflake Scripting LET statement", () => {
	it("parses LET with an explicit type and := (create-task's own doc example shape)", () => {
		expect(
			errorsOf(
				`BEGIN
  LET output_dir STRING := SYSTEM$GET_TASK_GRAPH_CONFIG('output_dir')::STRING;
  RETURN output_dir;
END;`,
			),
		).toBe(0);
	});

	it("parses LET with an explicit type and DEFAULT", () => {
		expect(errorsOf("BEGIN LET revenue NUMBER(38, 2) DEFAULT 110.0; RETURN revenue; END;")).toBe(0);
	});

	it("parses LET with the type inferred from the assigned expression", () => {
		expect(errorsOf("BEGIN LET value := (SELECT 1); RETURN value; END;")).toBe(0);
	});

	// The corpus shape this fix unblocks: CREATE TASK ... AS BEGIN ... LET ... END (functions/
	// system_get_task_graph_config/2.sql).
	it("parses CREATE TASK ... AS BEGIN ... LET ... END (sql-reference/sql/create-task)", () => {
		expect(
			errorsOf(
				`CREATE OR REPLACE TASK my_child_task
  AFTER my_task_root
  AS
    BEGIN
      LET value := (SELECT SYSTEM$GET_TASK_GRAPH_CONFIG('dir'));
      CREATE TABLE IF NOT EXISTS my_table(name VARCHAR, value VARCHAR);
      INSERT INTO my_table VALUES('my_task_root dir', :value);
    END;`,
			),
		).toBe(0);
	});

	// LET is not a reserved keyword (docs.snowflake.com/en/sql-reference/reserved-keywords), so
	// adding the lexer token must not create an identifier hole.
	it("GUARD: `let` is still usable as a bare column name", () => {
		const { body } = selectBody("SELECT let FROM t");
		expect(body.projections[0]).toMatchObject({ name: "let", expr: { kind: "column", parts: ["let"] } });
	});
});

// ---------------------------------------------------------------------------
// Snowflake Scripting statements[] (the routine-frame slice's Snowflake counterpart, see ir.ts's
// `statements` field doc and src/tsql/lower.ts's applyRoutineFrame/lowerInnerStatement, plus this
// dialect's own applyScriptingFrame/lowerCommand/lowerInnerScriptingStatement). The scripting-block
// CONTAINER keeps the honesty fix above unchanged (flagged "compound" stub, empty projections/from):
// these tests add the layer ON TOP — real inner bodies, a DECLARE section's/LET's declarations, and
// the shared scope/reference machinery reaching into a scripting block for the first time.
// ---------------------------------------------------------------------------
describe("Snowflake Scripting statements[] (body)", () => {
	it("a two-SELECT scripting block's statements[] carry real bodies", () => {
		const sql = "BEGIN SELECT a1 FROM t1; SELECT a2 FROM t2; END;";
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		expect(q.statement).toBe("compound");
		expect(q.statements).toHaveLength(2);
		expect(q.statements?.[0]?.statement).toBe("query");
		if (q.statements?.[0]?.body.kind === "select") {
			expect(q.statements[0].body.projections).toHaveLength(1);
			expect(q.statements[0].body.from).toHaveLength(1);
			expect(q.statements[0].body.unsupported ?? []).toEqual([]);
		} else {
			throw new Error("select");
		}
		expect(q.statements?.[1]?.statement).toBe("query");
	});

	it("scripting-only inner statements (LET, assignment, CALL, RETURN) stay honestly flagged, no query body", () => {
		const sql = "BEGIN LET v := 1; v := v + 1; CALL my_proc(); RETURN v; END;";
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		expect(q.statements).toHaveLength(4);
		for (const stmt of q.statements ?? []) {
			expect(stmt.body.kind).toBe("select");
			if (stmt.body.kind === "select") expect(stmt.body.unsupported).toContain("non-query");
		}
		expect(q.statements?.[1]?.statement).toBe("other"); // v := v + 1 (bare assignment)
		expect(q.statements?.[2]?.statement).toBe("utility"); // CALL
		expect(q.statements?.[3]?.statement).toBe("other"); // RETURN
	});

	it("a nested BEGIN...END inside a scripting block layers its own statements[] recursively", () => {
		const sql = "BEGIN BEGIN SELECT a FROM t; END; RETURN 1; END;";
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		expect(q.statements).toHaveLength(2);
		const nested = q.statements?.[0];
		expect(nested?.statement).toBe("compound");
		if (nested?.body.kind === "select") expect(nested.body.unsupported).toContain("compound");
		expect(nested?.statements).toHaveLength(1);
		expect(nested?.statements?.[0]?.statement).toBe("query");
		if (nested?.statements?.[0]?.body.kind === "select") expect(nested.statements[0].body.from).toHaveLength(1);
	});

	describe("body-non-emptiness probe stays clean over a scripting block's inner statements", () => {
		it("a scripting block with a real inner SELECT raises no probe hits on that statement", () => {
			const { q } = ir("BEGIN SELECT a FROM t; END;");
			const hits: string[] = [];
			probeBody(q, "scripting.sql", hits);
			expect(hits).toEqual([]);
		});
	});
});

describe("Snowflake Scripting statements[] (DECLARE section + LET declarations)", () => {
	it("a DECLARE section's variables become the container's declarations: name, typeText, RESULTSET", () => {
		const sql = `
DECLARE
  name STRING;
  temperature FLOAT;
  res RESULTSET;
BEGIN
  res := (SELECT 1 AS a);
  RETURN res;
END;`;
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		expect(q.statement).toBe("compound");
		expect(q.declarations).toHaveLength(3);
		expect(q.declarations?.[0]).toMatchObject({ name: "name", typeText: "STRING" });
		expect(q.declarations?.[1]).toMatchObject({ name: "temperature", typeText: "FLOAT" });
		expect(q.declarations?.[2]).toMatchObject({ name: "res", typeText: "RESULTSET" });
		expect(q.declarations?.[2]?.init).toBeUndefined(); // no initializer in this grammar
	});

	it("nameSpan covers exactly the declared variable's own token", () => {
		const sql = "DECLARE\n  counter INTEGER;\nBEGIN\n  RETURN counter;\nEND;";
		const { q } = ir(sql);
		const span = q.declarations?.[0]?.nameSpan;
		expect(span).toBeDefined();
		expect(sql.slice(span!.start, span!.end)).toBe("counter");
	});

	it("LET declares AND assigns: its own inner statement carries the declaration with a real init expr", () => {
		const sql = "BEGIN LET v := 1 + 2; RETURN v; END;";
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		expect(q.statements).toHaveLength(2);
		const letStmt = q.statements?.[0];
		expect(letStmt?.statement).toBe("other");
		expect(letStmt?.declarations).toHaveLength(1);
		expect(letStmt?.declarations?.[0]).toMatchObject({ name: "v" });
		expect(letStmt?.declarations?.[0]?.init).toMatchObject({ kind: "binary" });
	});

	it("LET with an explicit type and DEFAULT: typeText + a literal init", () => {
		const sql = "BEGIN LET revenue NUMBER(38, 2) DEFAULT 110.0; RETURN revenue; END;";
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		const decl = q.statements?.[0]?.declarations?.[0];
		expect(decl).toMatchObject({ name: "revenue" });
		expect(decl?.typeText).toBeTruthy();
		expect(decl?.init).toMatchObject({ kind: "literal" });
	});

	// Declarations pool tree-wide (rootDeclarations), the SAME machinery infer.ts/symbols.ts already
	// use for a tsql body DECLARE or a routine parameter — proven reachable from inside a scripting
	// block for the first time. Snowflake itself has no Expr construct that resolves to `kind:
	// "variable"` yet (a scripting variable used inside embedded SQL is `:name`, a bind_variable,
	// which lowers to `kind: "parameter"` — a caller-bound placeholder, "never linked" by design,
	// see src/symbols/symbols.ts; a bare-identifier scripting expression lowers as an ordinary
	// `column`). So this proves the DECLARATION side of the wiring (visible tree-wide from any inner
	// scope), not an end-to-end reference link — there is no Snowflake syntax yet that would trigger
	// one; see the accompanying report for that open question.
	it("a DECLARE section variable's declaration is visible tree-wide from an inner SELECT's own scope", () => {
		const sql = "DECLARE\n  v INTEGER;\nBEGIN\n  SELECT a FROM t;\nEND;";
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		const tree = resolveScopes(q, "snowflake");
		const innerScope = tree.root.children.find((c) => c.body.kind === "select" && c.body.from.length > 0);
		expect(innerScope).toBeDefined();
		const decls = rootDeclarations(innerScope!);
		expect(decls?.some((d) => d.name === "v" && d.typeText === "INTEGER")).toBe(true);
	});

	it("a LET-declared variable's declaration is likewise visible tree-wide from a later inner statement's own scope", () => {
		const sql = "BEGIN LET v := 1; SELECT a FROM t; END;";
		const { q, errors } = ir(sql);
		expect(errors).toBe(0);
		const tree = resolveScopes(q, "snowflake");
		const selectScope = tree.root.children.find((c) => c.body.kind === "select" && c.body.from.length > 0);
		expect(selectScope).toBeDefined();
		const decls = rootDeclarations(selectScope!);
		expect(decls?.some((d) => d.name === "v")).toBe(true);
	});
});

describe("nodeAt / referencesAt reach inner-statement expressions in a scripting block", () => {
	it("nodeAt finds a column reference inside statements[1]'s body, offset-based", () => {
		const sql = "BEGIN SELECT a1 FROM t1; SELECT a2 FROM t2; END;";
		const { q } = ir(sql);
		const tree = resolveScopes(q, "snowflake");
		const off = sql.lastIndexOf("a2");
		const hit = nodeAt(tree, off, q);
		expect(hit).toBeDefined();
		expect(hit!.expr.kind).toBe("column");
	});

	it("referencesAt groups repeated column references within one inner statement", () => {
		const sql = "BEGIN SELECT a FROM t1 WHERE a > 0; SELECT b FROM t2; END;";
		const { q } = ir(sql);
		const tree = resolveScopes(q, "snowflake");
		const off = sql.indexOf("a > 0");
		const occ = referencesAt(tree, off, undefined, q);
		expect(occ).not.toBeNull();
		expect(occ!.occurrences.length).toBeGreaterThanOrEqual(2);
	});
});
