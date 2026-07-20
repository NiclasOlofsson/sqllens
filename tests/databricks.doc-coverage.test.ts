import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { resolveScopes } from "../src/scope/scope.js";

// Doc-coverage gate: one probe per construct of the official Databricks SQL reference
// (docs.databricks.com/sql/language-manual, surveyed 2026-06-10). Each probe pins the
// CURRENT level of support, so closing a gap or regressing one flips a visible flag:
//
//   "query"    — parses, lowers to a modelled query (or the statement's inner query,
//                e.g. INSERT/CTAS), and scopes without throwing
//   "nonquery" — parses; lower flags it unsupported (no query scope) instead of modelling
//   "noparse"  — the grammar rejects it: Databricks-platform statements the Spark fork
//                never had. Object DDL (UC CREATE/ALTER/DROP, MASK/ROW FILTER, Python UDF
//                bodies) is OUT by decision ("we don't do regular DDL" — Nicke 2026-06-10);
//                the operational statements (COPY INTO, Delta maintenance, GRANT) are open
//                gaps, likely future scope ("might become in scope … we do it occasionally")
//
// "nonquery"/"noparse" entries are documented Databricks SQL: each is a known, recorded
// boundary, not an oversight. Flip the flag in the same change that closes one.

type Expected = "query" | "nonquery" | "noparse";
type Probe = [name: string, sql: string, expected: Expected];

const PROBES: Record<string, Probe[]> = {
	"SELECT clauses": [
		["basic", "SELECT a, b FROM t", "query"],
		["where", "SELECT a FROM t WHERE a > 1 AND b IS NOT NULL", "query"],
		["group-by", "SELECT a, count(*) FROM t GROUP BY a", "query"],
		["group-by-all", "SELECT a, count(*) FROM t GROUP BY ALL", "query"],
		["group-by-cube", "SELECT a, b, count(*) FROM t GROUP BY CUBE(a, b)", "query"],
		["grouping-sets", "SELECT a, b, count(*) FROM t GROUP BY GROUPING SETS ((a), (b), ())", "query"],
		["having", "SELECT a, count(*) FROM t GROUP BY a HAVING count(*) > 1", "query"],
		["order-by", "SELECT a FROM t ORDER BY a DESC NULLS LAST, b ASC", "query"],
		["order-by-all", "SELECT a, b FROM t ORDER BY ALL", "query"],
		["limit", "SELECT a FROM t LIMIT 10", "query"],
		["limit-offset", "SELECT a FROM t LIMIT 10 OFFSET 5", "query"],
		["distinct", "SELECT DISTINCT a FROM t", "query"],
		["qualify", "SELECT a, row_number() OVER (PARTITION BY b ORDER BY a) AS rn FROM t QUALIFY rn = 1", "query"],
		["star-except", "SELECT * EXCEPT (a, b) FROM t", "query"],
		["qualified-star", "SELECT t.* FROM t", "query"],
		["cte", "WITH c AS (SELECT 1 AS a) SELECT * FROM c", "query"],
		["cte-cols", "WITH c (x, y) AS (SELECT 1, 2) SELECT x FROM c", "query"],
		[
			"recursive-cte",
			"WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r WHERE n < 3) SELECT * FROM r",
			"query",
		],
		["values-from", "SELECT * FROM VALUES (1, 'a'), (2, 'b') AS v(x, y)", "query"],
		["values-top", "VALUES (1), (2)", "query"],
		["union-all", "SELECT a FROM t UNION ALL SELECT a FROM u", "query"],
		["intersect-all", "SELECT a FROM t INTERSECT ALL SELECT a FROM u", "query"],
		["except-all", "SELECT a FROM t EXCEPT ALL SELECT a FROM u", "query"],
		["join-using", "SELECT * FROM t JOIN u USING (id)", "query"],
		["join-full-outer", "SELECT * FROM t FULL OUTER JOIN u ON t.id = u.id", "query"],
		["join-semi", "SELECT * FROM t LEFT SEMI JOIN u ON t.id = u.id", "query"],
		["join-anti", "SELECT * FROM t LEFT ANTI JOIN u ON t.id = u.id", "query"],
		["join-natural", "SELECT * FROM t NATURAL JOIN u", "query"],
		["join-cross", "SELECT * FROM t CROSS JOIN u", "query"],
		["lateral-subquery", "SELECT * FROM t, LATERAL (SELECT t.a AS x) s", "query"],
		["lateral-view", "SELECT c FROM t LATERAL VIEW explode(arr) x AS c", "query"],
		["lateral-view-outer", "SELECT c FROM t LATERAL VIEW OUTER explode(arr) x AS c", "query"],
		["tablesample", "SELECT * FROM t TABLESAMPLE (10 PERCENT)", "query"],
		["tvf-range", "SELECT * FROM range(10)", "query"],
		["pivot", "SELECT * FROM t PIVOT (sum(v) FOR k IN ('a' AS a, 'b' AS b))", "query"],
		["unpivot", "SELECT * FROM t UNPIVOT (v FOR k IN (c1, c2))", "query"],
		["unpivot-nulls", "SELECT * FROM t UNPIVOT INCLUDE NULLS (v FOR k IN (c1, c2))", "query"],
		["time-travel-version", "SELECT * FROM t VERSION AS OF 1", "query"],
		["time-travel-ts", "SELECT * FROM t TIMESTAMP AS OF '2024-01-01'", "query"],
		["time-travel-at", "SELECT * FROM t@v1", "query"],
		["window-named", "SELECT sum(a) OVER w FROM t WINDOW w AS (PARTITION BY b ORDER BY a)", "query"],
		["window-frame", "SELECT sum(a) OVER (ORDER BY b ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t", "query"],
		[
			"window-range",
			"SELECT sum(a) OVER (ORDER BY b RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM t",
			"query",
		],
		["distribute-sort", "SELECT a FROM t DISTRIBUTE BY a SORT BY a", "query"],
		["cluster-by", "SELECT a FROM t CLUSTER BY a", "query"],
		["hint", "SELECT /*+ BROADCAST(u) */ * FROM t JOIN u ON t.id = u.id", "query"],
		["param-named", "SELECT :p AS x", "query"],
		["param-positional", "SELECT ? AS x", "query"],
		["identifier-clause", "SELECT * FROM IDENTIFIER('main.sch.t')", "query"],
		["exists", "SELECT a FROM t WHERE EXISTS (SELECT 1 FROM u WHERE u.id = t.id)", "query"],
		["in-subquery", "SELECT a FROM t WHERE a IN (SELECT a FROM u)", "query"],
		["scalar-subquery", "SELECT (SELECT max(a) FROM u) AS m FROM t", "query"],
	],
	expressions: [
		["case", "SELECT CASE WHEN a > 1 THEN 'x' ELSE 'y' END FROM t", "query"],
		["cast", "SELECT CAST(a AS DECIMAL(10, 2)) FROM t", "query"],
		["try-cast", "SELECT try_cast(a AS INT) FROM t", "query"],
		["double-colon-cast", "SELECT a::INT FROM t", "query"],
		["interval", "SELECT INTERVAL '1' DAY + INTERVAL '2' HOUR", "query"],
		["array-literal", "SELECT array(1, 2, 3)[0]", "query"],
		["map-literal", "SELECT map('k', 1)['k']", "query"],
		["struct-literal", "SELECT named_struct('a', 1).a", "query"],
		["lambda", "SELECT transform(arr, x -> x + 1) FROM t", "query"],
		["lambda-two", "SELECT zip_with(a, b, (x, y) -> x + y) FROM t", "query"],
		["variant-colon", "SELECT v:a.b FROM t", "query"],
		["variant-colon-cast", "SELECT v:a.b::STRING FROM t", "query"],
		["is-distinct", "SELECT a IS DISTINCT FROM b FROM t", "query"],
		["null-safe-eq", "SELECT a <=> b FROM t", "query"],
		["rlike", "SELECT a RLIKE 'x.*' FROM t", "query"],
		["like-all", "SELECT * FROM t WHERE a LIKE ALL ('a%', '%b')", "query"],
		["like-escape", "SELECT * FROM t WHERE a LIKE 'a!%' ESCAPE '!'", "query"],
		["exists-hof", "SELECT exists(arr, x -> x > 0) FROM t", "query"],
		["current-date", "SELECT current_date, current_timestamp", "query"],
		["string-concat-pipe", "SELECT a || b FROM t", "query"],
		["backtick-ident", "SELECT `select` FROM `my-table`", "query"],
	],
	DML: [
		// INSERT lowers its inner source query (SELECT or VALUES); UPDATE/DELETE/MERGE parse
		// and are flagged — their assignments/predicates aren't modelled yet.
		["insert-select", "INSERT INTO t SELECT * FROM u", "query"],
		["insert-values", "INSERT INTO t VALUES (1, 'a')", "query"],
		["insert-overwrite", "INSERT OVERWRITE TABLE t SELECT * FROM u", "query"],
		["insert-partition", "INSERT INTO t PARTITION (p = 1) SELECT a FROM u", "query"],
		["insert-replace-where", "INSERT INTO t REPLACE WHERE p = 1 SELECT * FROM u", "query"],
		["insert-by-name", "INSERT INTO t BY NAME SELECT a, b FROM u", "query"],
		["update", "UPDATE t SET a = 1, b = b + 1 WHERE c = 2", "nonquery"],
		["delete", "DELETE FROM t WHERE a = 1", "nonquery"],
		[
			"merge",
			"MERGE INTO t USING u ON t.id = u.id WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT * WHEN NOT MATCHED BY SOURCE THEN DELETE",
			"nonquery",
		],
		["copy-into", "COPY INTO t FROM '/mnt/data' FILEFORMAT = PARQUET", "noparse"],
	],
	DDL: [
		[
			"create-table",
			"CREATE TABLE t (a INT NOT NULL COMMENT 'x', b STRING) USING DELTA PARTITIONED BY (b) TBLPROPERTIES ('k' = 'v')",
			"nonquery",
		],
		["ctas", "CREATE TABLE t AS SELECT 1 AS a", "query"],
		["create-table-like", "CREATE TABLE t LIKE u", "nonquery"],
		["liquid-cluster", "CREATE TABLE t (a INT) CLUSTER BY (a)", "nonquery"],
		["cluster-by-auto", "CREATE TABLE t (a INT) CLUSTER BY AUTO", "noparse"],
		["generated-col", "CREATE TABLE t (a INT, b INT GENERATED ALWAYS AS (a + 1))", "nonquery"],
		["identity-col", "CREATE TABLE t (id BIGINT GENERATED ALWAYS AS IDENTITY, a INT)", "nonquery"],
		["default-col", "CREATE TABLE t (a INT DEFAULT 1)", "nonquery"],
		["pk-constraint", "CREATE TABLE t (id INT, CONSTRAINT pk PRIMARY KEY (id))", "nonquery"],
		["fk-constraint", "CREATE TABLE t (r INT, CONSTRAINT fk FOREIGN KEY (r) REFERENCES u (id))", "nonquery"],
		["column-mask", "CREATE TABLE t (a STRING MASK mask_fn)", "noparse"],
		["row-filter", "CREATE TABLE t (a INT) WITH ROW FILTER f ON (a)", "noparse"],
		["create-view", "CREATE OR REPLACE VIEW v AS SELECT 1 AS a", "query"],
		["create-temp-view", "CREATE OR REPLACE TEMPORARY VIEW v AS SELECT 1 AS a", "query"],
		["create-mv", "CREATE MATERIALIZED VIEW mv AS SELECT a FROM t", "query"],
		["create-streaming-table", "CREATE STREAMING TABLE st AS SELECT * FROM STREAM read_files('/p')", "query"],
		["create-function-sql", "CREATE FUNCTION f(x INT) RETURNS INT RETURN x + 1", "nonquery"],
		["create-function-table", "CREATE FUNCTION f(x INT) RETURNS TABLE (a INT) RETURN SELECT x AS a", "query"],
		[
			"create-function-python",
			"CREATE FUNCTION f(x INT) RETURNS INT LANGUAGE PYTHON AS $$\nreturn x\n$$",
			"noparse",
		],
		["create-schema", "CREATE SCHEMA IF NOT EXISTS sch COMMENT 'x'", "nonquery"],
		["create-catalog", "CREATE CATALOG IF NOT EXISTS cat", "noparse"],
		["create-volume", "CREATE VOLUME cat.sch.vol", "noparse"],
		["create-ext-location", "CREATE EXTERNAL LOCATION loc URL 's3://b/p' WITH (STORAGE CREDENTIAL c)", "noparse"],
		["create-share", "CREATE SHARE s COMMENT 'x'", "noparse"],
		["create-connection", "CREATE CONNECTION c TYPE mysql OPTIONS (host 'h')", "noparse"],
		["alter-add-col", "ALTER TABLE t ADD COLUMN c INT AFTER a", "nonquery"],
		["alter-rename-col", "ALTER TABLE t RENAME COLUMN a TO b", "nonquery"],
		["alter-drop-col", "ALTER TABLE t DROP COLUMN a", "nonquery"],
		["alter-tblprops", "ALTER TABLE t SET TBLPROPERTIES ('k' = 'v')", "nonquery"],
		["alter-check", "ALTER TABLE t ADD CONSTRAINT c CHECK (a > 0)", "nonquery"],
		["comment-on", "COMMENT ON TABLE t IS 'x'", "nonquery"],
		["drop-table", "DROP TABLE IF EXISTS t", "nonquery"],
	],
	"Delta utilities": [
		["optimize-zorder", "OPTIMIZE t WHERE p = 1 ZORDER BY (a, b)", "noparse"],
		["vacuum", "VACUUM t RETAIN 168 HOURS", "noparse"],
		["restore", "RESTORE TABLE t TO VERSION AS OF 1", "noparse"],
		// parses only by coincidence: DESCRIBE <table HISTORY> <column t> — wrong binding, no model
		["describe-history", "DESCRIBE HISTORY t", "nonquery"],
		["shallow-clone", "CREATE TABLE t2 SHALLOW CLONE t1", "noparse"],
		["reorg", "REORG TABLE t APPLY (PURGE)", "noparse"],
		["fsck", "FSCK REPAIR TABLE t", "noparse"],
		["analyze", "ANALYZE TABLE t COMPUTE STATISTICS FOR ALL COLUMNS", "nonquery"],
	],
	auxiliary: [
		["explain", "EXPLAIN EXTENDED SELECT 1", "query"],
		["show-tables", "SHOW TABLES IN sch", "nonquery"],
		["show-create", "SHOW CREATE TABLE t", "nonquery"],
		["describe-extended", "DESCRIBE TABLE EXTENDED t", "nonquery"],
		["cache-table", "CACHE TABLE t", "nonquery"],
		["set-conf", "SET spark.sql.shuffle.partitions = 10", "nonquery"],
		["use-catalog", "USE CATALOG main", "nonquery"], // GAP 2: catalogIdentifierReference wired to USE CATALOG
		["use-schema", "USE sch", "nonquery"],
		["declare-variable", "DECLARE VARIABLE v INT DEFAULT 1", "nonquery"],
		["set-var", "SET VAR v = 5", "nonquery"],
		["execute-immediate", "EXECUTE IMMEDIATE 'SELECT 1'", "nonquery"],
		["refresh-table", "REFRESH TABLE t", "nonquery"],
	],
	"SQL scripting": [
		// A compound is a statement sequence, not a query — parsed, flagged as one body.
		["begin-end", "BEGIN DECLARE x INT DEFAULT 0; SET x = x + 1; END", "nonquery"],
		["if-then", "BEGIN IF 1 = 1 THEN SELECT 1; END IF; END", "nonquery"],
	],
	security: [
		// GRANT "parses" only via Spark's unsupportedHiveNativeCommands catch-all (.*?)
		["grant", "GRANT SELECT ON TABLE t TO `alice@example.com`", "nonquery"],
		["show-grants", "SHOW GRANTS ON TABLE t", "noparse"],
	],
};

function outcome(sql: string): Expected {
	const parsed = parseDatabricks(sql);
	if (parsed.errors > 0) return "noparse";
	const ir = lower(parsed.tree);
	if (ir.body.kind === "select" && ir.body.unsupported?.length) return "nonquery";
	resolveScopes(ir, "databricks");
	return "query";
}

for (const [category, probes] of Object.entries(PROBES)) {
	describe(`Databricks doc coverage: ${category}`, () => {
		for (const [name, sql, expected] of probes) {
			it(`${name} → ${expected}`, () => {
				expect(outcome(sql), sql).toBe(expected);
			});
		}
	});
}
