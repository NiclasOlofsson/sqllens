import { describe, expect, it } from "vitest";
import { lower } from "../src/snowflake/lower.js";
import { parseSnowflake } from "../src/snowflake/parse.js";
import { resolveScopes } from "../src/scope/scope.js";

// Doc-coverage gate: one probe per construct of the official Snowflake SQL reference
// (docs.snowflake.com SQL reference, surveyed 2026-07-02). Each probe pins the CURRENT level of support, so
// closing a gap or regressing one flips a visible flag:
//
//   "query"    — parses, lowers to a modelled query (or a statement's inner query,
//                e.g. CTAS / INSERT … SELECT), and scopes without throwing
//   "nonquery" — parses; lower flags it unsupported (DML / DDL / session & utility
//                commands the semantic layer does not model as a query)
//   "noparse"  — the grammar rejects it: a documented construct the fork doesn't cover
//
// "nonquery"/"noparse" entries are documented Snowflake SQL — each a known, recorded
// boundary, not an oversight. Flip the flag in the same change that closes one.
// Base URL for the per-probe page citations: https://docs.snowflake.com/en/

type Expected = "query" | "nonquery" | "noparse";
type Probe = [name: string, sql: string, expected: Expected];

const PROBES: Record<string, Probe[]> = {
	"query clauses": [
		["basic", "SELECT a, b FROM t", "query"], // sql-reference/constructs/select
		["where", "SELECT a FROM t WHERE a > 1 AND b IS NOT NULL", "query"], // sql-reference/constructs/where
		["group-by", "SELECT a, count(*) FROM t GROUP BY a", "query"], // sql-reference/constructs/group-by
		["group-by-all", "SELECT a, count(*) FROM t GROUP BY ALL", "query"], // sql-reference/constructs/group-by
		["group-by-cube", "SELECT a, b, count(*) FROM t GROUP BY CUBE(a, b)", "query"], // sql-reference/constructs/group-by-cube
		["group-by-rollup", "SELECT a, b, count(*) FROM t GROUP BY ROLLUP(a, b)", "query"], // sql-reference/constructs/group-by-rollup
		["grouping-sets", "SELECT a, count(*) FROM t GROUP BY GROUPING SETS ((a), ())", "query"], // sql-reference/constructs/group-by-grouping-sets
		["having", "SELECT a, count(*) FROM t GROUP BY a HAVING count(*) > 1", "query"], // sql-reference/constructs/having
		["qualify", "SELECT a, row_number() OVER (PARTITION BY b ORDER BY a) AS rn FROM t QUALIFY rn = 1", "query"], // sql-reference/constructs/qualify
		["order-by", "SELECT a FROM t ORDER BY a DESC NULLS LAST", "query"], // sql-reference/constructs/order-by
		["limit-fetch", "SELECT a FROM t ORDER BY a LIMIT 10 OFFSET 5", "query"], // sql-reference/constructs/limit
		["top", "SELECT TOP 5 a FROM t ORDER BY a", "query"], // sql-reference/constructs/top_n
		["distinct", "SELECT DISTINCT a FROM t", "query"], // sql-reference/constructs/select
		["cte", "WITH c AS (SELECT 1 AS a) SELECT * FROM c", "query"], // sql-reference/constructs/with
		["cte-cols", "WITH c (x, y) AS (SELECT 1, 2) SELECT x FROM c", "query"], // sql-reference/constructs/with
		[
			"recursive-cte",
			"WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r WHERE n < 3) SELECT * FROM r",
			"query",
		], // sql-reference/constructs/with
		["star-exclude", "SELECT * EXCLUDE (a, b) FROM t", "query"], // sql-reference/sql/select
		["star-rename", "SELECT * RENAME (a AS x) FROM t", "query"], // sql-reference/sql/select
		["star-replace", "SELECT * REPLACE (a + 1 AS a) FROM t", "query"], // sql-reference/sql/select
		["ilike-star", "SELECT * ILIKE 'a%' FROM t", "query"], // sql-reference/sql/select
		["qualified-star", "SELECT t.* FROM t", "query"], // sql-reference/sql/select
	],
	"set operators": [
		["union-all", "SELECT a FROM t UNION ALL SELECT a FROM u", "query"], // sql-reference/operators-query
		["union-by-name", "SELECT a FROM t UNION ALL BY NAME SELECT a FROM u", "query"], // sql-reference/operators-query
		["intersect", "SELECT a FROM t INTERSECT SELECT a FROM u", "query"], // sql-reference/operators-query
		["except", "SELECT a FROM t EXCEPT SELECT a FROM u", "query"], // sql-reference/operators-query
		["minus", "SELECT a FROM t MINUS SELECT a FROM u", "query"], // sql-reference/operators-query
	],
	"from / joins": [
		["join-on", "SELECT * FROM t JOIN u ON t.id = u.id", "query"], // sql-reference/constructs/join
		["join-using", "SELECT * FROM t JOIN u USING (id)", "query"], // sql-reference/constructs/join
		["join-natural", "SELECT * FROM t NATURAL JOIN u", "query"], // sql-reference/constructs/join
		["join-lateral", "SELECT * FROM t, LATERAL (SELECT t.a AS x) s", "query"], // sql-reference/constructs/join-lateral
		["flatten", "SELECT value FROM t, LATERAL FLATTEN(input => t.arr)", "query"], // sql-reference/functions/flatten
		["table-flatten", "SELECT * FROM TABLE(FLATTEN(input => parse_json('[1,2]')))", "query"], // sql-reference/functions/flatten
		["values-inline", "SELECT * FROM (VALUES (1, 'a'), (2, 'b')) AS v(x, y)", "query"], // sql-reference/constructs/values
		["sample-rows", "SELECT * FROM t SAMPLE (10 ROWS)", "query"], // sql-reference/constructs/sample
		["tablesample-pct", "SELECT * FROM t TABLESAMPLE BERNOULLI (10)", "query"], // sql-reference/constructs/sample
		["pivot", "SELECT * FROM t PIVOT (sum(v) FOR k IN ('a', 'b')) AS p", "query"], // sql-reference/constructs/pivot
		["unpivot", "SELECT * FROM t UNPIVOT (v FOR k IN (c1, c2)) AS u", "query"], // sql-reference/constructs/unpivot
		[
			"match-recognize",
			"SELECT * FROM t MATCH_RECOGNIZE (PARTITION BY a ORDER BY b MEASURES count(*) AS c PATTERN (x+) DEFINE x AS x.v > 0)",
			"query",
		], // sql-reference/constructs/match_recognize
		["connect-by", "SELECT id, LEVEL FROM t START WITH mgr IS NULL CONNECT BY PRIOR id = mgr", "query"], // sql-reference/constructs/connect-by
		["at-before-time-travel", "SELECT * FROM t AT (OFFSET => -60)", "query"], // sql-reference/constructs/at-before
		["stage-query", "SELECT $1, $2 FROM @my_stage", "query"], // sql-reference/sql/select
	],
	expressions: [
		["case", "SELECT CASE WHEN a > 1 THEN 'x' ELSE 'y' END FROM t", "query"], // sql-reference/functions/case
		["cast", "SELECT CAST(a AS NUMBER(10, 2)) FROM t", "query"], // sql-reference/functions/cast
		["double-colon-cast", "SELECT a::VARCHAR FROM t", "query"], // sql-reference/data-type-conversion
		["try-cast", "SELECT TRY_CAST(a AS INT) FROM t", "query"], // sql-reference/functions/try_cast
		["iff", "SELECT IFF(a > 1, 'x', 'y') FROM t", "query"], // sql-reference/functions/iff
		["variant-path", "SELECT v:a.b::STRING FROM t", "query"], // sql-reference/data-types-semistructured
		["array-subscript", "SELECT arr[0] FROM t", "query"], // sql-reference/data-types-semistructured
		["object-construct", "SELECT OBJECT_CONSTRUCT('a', 1, 'b', 2)", "query"], // sql-reference/functions/object_construct
		["array-construct", "SELECT ARRAY_CONSTRUCT(1, 2, 3)", "query"], // sql-reference/functions/array_construct
		["dollar-string", "SELECT $$abc$$ AS x", "query"], // sql-reference/data-types-text
		["interval", "SELECT '2024-01-01'::date + INTERVAL '1 day'", "query"], // sql-reference/data-types-datetime
		["within-group", "SELECT LISTAGG(a, ',') WITHIN GROUP (ORDER BY a) FROM t", "query"], // sql-reference/functions/listagg
		["ignore-nulls", "SELECT LAG(a) IGNORE NULLS OVER (ORDER BY b) FROM t", "query"], // sql-reference/functions/lag
		["nextval", "SELECT seq.NEXTVAL", "query"], // sql-reference/functions/seq
		["identifier-fn", "SELECT * FROM IDENTIFIER('t')", "query"], // sql-reference/identifier-literal
		["window-frame", "SELECT sum(a) OVER (ORDER BY b ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t", "query"], // sql-reference/functions-analytic
		["exists-subquery", "SELECT a FROM t WHERE EXISTS (SELECT 1 FROM u WHERE u.id = t.id)", "query"], // sql-reference/operators-subquery
		["scalar-subquery", "SELECT (SELECT max(a) FROM u) AS m FROM t", "query"], // sql-reference/operators-subquery
	],
	DML: [
		["insert-values", "INSERT INTO t VALUES (1, 'a')", "nonquery"], // sql-reference/sql/insert
		["insert-select", "INSERT INTO t SELECT * FROM u", "query"], // sql-reference/sql/insert
		["insert-overwrite", "INSERT OVERWRITE INTO t SELECT * FROM u", "query"], // sql-reference/sql/insert
		["insert-multi", "INSERT ALL INTO t1 VALUES (a) INTO t2 VALUES (b) SELECT a, b FROM s", "noparse"], // sql-reference/sql/insert-multi-table
		["update", "UPDATE t SET a = 1 WHERE b = 2", "nonquery"], // sql-reference/sql/update
		["update-from", "UPDATE t SET a = u.a FROM u WHERE t.id = u.id", "nonquery"], // sql-reference/sql/update
		["delete", "DELETE FROM t WHERE a = 1", "nonquery"], // sql-reference/sql/delete
		["delete-using", "DELETE FROM t USING u WHERE t.id = u.id", "nonquery"], // sql-reference/sql/delete
		[
			"merge",
			"MERGE INTO t USING u ON t.id = u.id WHEN MATCHED THEN UPDATE SET t.a = u.a WHEN NOT MATCHED THEN INSERT (a) VALUES (u.a)",
			"nonquery",
		], // sql-reference/sql/merge
		["truncate", "TRUNCATE TABLE t", "nonquery"], // sql-reference/sql/truncate-table
		["copy-into-table", "COPY INTO t FROM @stage FILE_FORMAT = (TYPE = CSV)", "nonquery"], // sql-reference/sql/copy-into-table
		["copy-into-location", "COPY INTO @stage FROM t FILE_FORMAT = (TYPE = PARQUET)", "nonquery"], // sql-reference/sql/copy-into-location
	],
	DDL: [
		["create-table", "CREATE TABLE t (a INT, b VARCHAR)", "nonquery"], // sql-reference/sql/create-table
		["ctas", "CREATE TABLE t AS SELECT 1 AS a", "query"], // sql-reference/sql/create-table
		["create-transient", "CREATE TRANSIENT TABLE t (a INT)", "nonquery"], // sql-reference/sql/create-table
		[
			"create-iceberg",
			"CREATE ICEBERG TABLE t (a INT) CATALOG = 'x' EXTERNAL_VOLUME = 'v' BASE_LOCATION = 'b'",
			"nonquery",
		], // sql-reference/sql/create-iceberg-table
		["create-view", "CREATE OR REPLACE VIEW v AS SELECT 1 AS a", "query"], // sql-reference/sql/create-view
		["create-secure-view", "CREATE SECURE VIEW v AS SELECT a FROM t", "query"], // sql-reference/sql/create-view
		["create-mv", "CREATE MATERIALIZED VIEW mv AS SELECT a FROM t", "query"], // sql-reference/sql/create-materialized-view
		["create-stream", "CREATE STREAM s ON TABLE t", "nonquery"], // sql-reference/sql/create-stream
		["create-task", "CREATE TASK tk WAREHOUSE = wh SCHEDULE = '1 minute' AS SELECT 1", "query"], // sql-reference/sql/create-task
		["create-stage", "CREATE STAGE st URL = 's3://b/p'", "nonquery"], // sql-reference/sql/create-stage
		["create-file-format", "CREATE FILE FORMAT ff TYPE = CSV", "nonquery"], // sql-reference/sql/create-file-format
		["create-sequence", "CREATE SEQUENCE seq START = 1 INCREMENT = 1", "nonquery"], // sql-reference/sql/create-sequence
		["create-warehouse", "CREATE WAREHOUSE wh WAREHOUSE_SIZE = 'XSMALL'", "noparse"], // sql-reference/sql/create-warehouse
		["create-function-sql", "CREATE FUNCTION f(x INT) RETURNS INT AS 'x + 1'", "nonquery"], // sql-reference/sql/create-function
		[
			"create-function-js",
			"CREATE FUNCTION f(x FLOAT) RETURNS FLOAT LANGUAGE JAVASCRIPT AS 'return X'",
			"nonquery",
		], // sql-reference/sql/create-function
		["create-procedure", "CREATE PROCEDURE p() RETURNS STRING LANGUAGE SQL AS 'BEGIN RETURN 1; END'", "nonquery"], // sql-reference/sql/create-procedure
		["alter-table-add", "ALTER TABLE t ADD COLUMN c INT", "nonquery"], // sql-reference/sql/alter-table
		["drop-table", "DROP TABLE IF EXISTS t", "nonquery"], // sql-reference/sql/drop-table
		["create-schema", "CREATE SCHEMA sch", "nonquery"], // sql-reference/sql/create-schema
	],
	commands: [
		["show-tables", "SHOW TABLES IN SCHEMA sch", "nonquery"], // sql-reference/sql/show-tables
		["describe-table", "DESCRIBE TABLE t", "nonquery"], // sql-reference/sql/desc-table
		["use-database", "USE DATABASE db", "nonquery"], // sql-reference/sql/use-database
		["use-warehouse", "USE WAREHOUSE wh", "nonquery"], // sql-reference/sql/use-warehouse
		["alter-session", "ALTER SESSION SET TIMEZONE = 'UTC'", "nonquery"], // sql-reference/sql/alter-session
		["grant", "GRANT SELECT ON TABLE t TO ROLE r", "noparse"], // sql-reference/sql/grant-privilege
		["set-var", "SET v = 5", "nonquery"], // sql-reference/sql/set
		["call", "CALL p(1, 2)", "nonquery"], // sql-reference/sql/call
	],
	scripting: [
		["begin-end", "BEGIN RETURN 1; END", "nonquery"], // developer-guide/snowflake-scripting/blocks
		["let", "EXECUTE IMMEDIATE $$ BEGIN LET x INT := 1; RETURN x; END $$", "nonquery"], // developer-guide/snowflake-scripting/variables
	],
};

function outcome(sql: string): Expected {
	const parsed = parseSnowflake(sql);
	if (parsed.errors > 0) return "noparse";
	const ir = lower(parsed.tree);
	if (ir.body.kind === "select" && ir.body.unsupported?.length) return "nonquery";
	resolveScopes(ir, "snowflake");
	return "query";
}

for (const [category, probes] of Object.entries(PROBES)) {
	describe(`Snowflake doc coverage: ${category}`, () => {
		for (const [name, sql, expected] of probes) {
			it(`${name} → ${expected}`, () => {
				expect(outcome(sql), sql).toBe(expected);
			});
		}
	});
}
