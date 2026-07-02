import { describe, expect, it } from "vitest";
import { lower } from "../src/redshift/lower.js";
import { parseRedshift } from "../src/redshift/parse.js";
import { resolveScopes } from "../src/scope/scope.js";

// Doc-coverage gate: one probe per construct of the official Redshift SQL reference
// (the AWS Redshift SQL reference at docs.aws.amazon.com/redshift, surveyed 2026-07-02). Each probe pins the CURRENT level of support, so
// closing a gap or regressing one flips a visible flag:
//
//   "query"    — parses, lowers to a modelled query (or a statement's inner query,
//                e.g. CTAS / INSERT … SELECT), and scopes without throwing
//   "nonquery" — parses; lower flags it unsupported (DML / DDL / session & utility
//                commands the semantic layer does not model as a query)
//   "noparse"  — the grammar rejects it: a documented construct the fork doesn't cover
//
// "nonquery"/"noparse" entries are documented Redshift SQL — each a known, recorded
// boundary, not an oversight. Flip the flag in the same change that closes one.
// Base URL for the per-probe page citations: https://docs.aws.amazon.com/redshift/latest/dg/

type Expected = "query" | "nonquery" | "noparse";
type Probe = [name: string, sql: string, expected: Expected];

const PROBES: Record<string, Probe[]> = {
	"query clauses": [
		["basic", "SELECT a, b FROM t", "query"], // r_SELECT_synopsis
		["where", "SELECT a FROM t WHERE a > 1 AND b IS NOT NULL", "query"], // r_WHERE_clause
		["group-by", "SELECT a, count(*) FROM t GROUP BY a", "query"], // r_GROUP_BY_clause
		["group-by-rollup", "SELECT a, b, count(*) FROM t GROUP BY ROLLUP(a, b)", "query"], // r_GROUP_BY_clause
		["group-by-cube", "SELECT a, b, count(*) FROM t GROUP BY CUBE(a, b)", "query"], // r_GROUP_BY_clause
		["grouping-sets", "SELECT a, count(*) FROM t GROUP BY GROUPING SETS ((a), ())", "query"], // r_GROUP_BY_clause
		["having", "SELECT a, count(*) FROM t GROUP BY a HAVING count(*) > 1", "query"], // r_HAVING_clause
		["qualify", "SELECT a, row_number() OVER (ORDER BY a) AS rn FROM t QUALIFY rn = 1", "query"], // r_QUALIFY_clause
		["order-by", "SELECT a FROM t ORDER BY a DESC NULLS LAST", "query"], // r_ORDER_BY_clause
		["limit-offset", "SELECT a FROM t ORDER BY a LIMIT 10 OFFSET 5", "query"], // c_simplified-syntax-limit
		["top", "SELECT TOP 5 a FROM t ORDER BY a", "query"], // r_SELECT_list
		["distinct", "SELECT DISTINCT a FROM t", "query"], // r_SELECT_list
		["cte", "WITH c AS (SELECT 1 AS a) SELECT * FROM c", "query"], // r_WITH_clause
		["cte-cols", "WITH c (x, y) AS (SELECT 1, 2) SELECT x FROM c", "query"], // r_WITH_clause
		[
			"recursive-cte",
			"WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r WHERE n < 3) SELECT * FROM r",
			"query",
		], // r_WITH_clause
		["qualified-star", "SELECT t.* FROM t", "query"], // r_SELECT_list
	],
	"set operators": [
		["union-all", "SELECT a FROM t UNION ALL SELECT a FROM u", "query"], // r_UNION
		["intersect", "SELECT a FROM t INTERSECT SELECT a FROM u", "query"], // r_UNION
		["except", "SELECT a FROM t EXCEPT SELECT a FROM u", "query"], // r_UNION
		["minus", "SELECT a FROM t MINUS SELECT a FROM u", "nonquery"], // r_UNION
	],
	"from / joins": [
		["join-on", "SELECT * FROM t JOIN u ON t.id = u.id", "query"], // r_FROM_clause30
		["join-using", "SELECT * FROM t JOIN u USING (id)", "query"], // r_FROM_clause30
		["join-natural", "SELECT * FROM t NATURAL JOIN u", "query"], // r_FROM_clause30
		["cross-join", "SELECT * FROM t CROSS JOIN u", "query"], // r_FROM_clause30
		["outer-join-plus", "SELECT * FROM t, u WHERE t.id = u.id (+)", "query"], // r_WHERE_oracle_outer
		["subquery-source", "SELECT * FROM (SELECT a FROM t) s", "query"], // r_FROM_clause30
		["values-inline", "SELECT * FROM (VALUES (1, 'a'), (2, 'b')) AS v(x, y)", "query"], // r_FROM_clause30
		["pivot", "SELECT * FROM t PIVOT (sum(v) FOR k IN ('a', 'b'))", "query"], // r_FROM_clause-pivot-unpivot-examples
		["unpivot", "SELECT * FROM t UNPIVOT (v FOR k IN (c1, c2))", "query"], // r_FROM_clause-pivot-unpivot-examples
		["connect-by", "SELECT id, LEVEL FROM t START WITH mgr IS NULL CONNECT BY PRIOR id = mgr", "query"], // r_hierarchical-queries
		["unnest-super", "SELECT x FROM t, t.arr AS x", "query"], // query-super
		["unnest-with-offset", "SELECT x, o FROM t, UNNEST(t.arr) WITH OFFSET AS o", "query"], // query-super
		["catalog-path", "SELECT * FROM db@ns.public.t", "query"], // r_FROM_clause30
	],
	expressions: [
		["case", "SELECT CASE WHEN a > 1 THEN 'x' ELSE 'y' END FROM t", "query"], // r_CASE_function
		["cast", "SELECT CAST(a AS DECIMAL(10, 2)) FROM t", "query"], // r_CAST_function
		["double-colon-cast", "SELECT a::VARCHAR FROM t", "query"], // r_CAST_function
		["decode", "SELECT DECODE(a, 1, 'x', 'y') FROM t", "query"], // r_DECODE_expression
		["nvl", "SELECT NVL(a, 0) FROM t", "query"], // r_NVL_function
		["super-navigation", "SELECT v.a.b FROM t", "query"], // query-super
		["super-subscript", "SELECT v[0] FROM t", "query"], // query-super
		["approximate-count", "SELECT APPROXIMATE COUNT(DISTINCT a) FROM t", "query"], // r_COUNT
		["approximate-percentile", "SELECT APPROXIMATE PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY a) FROM t", "query"], // r_PERCENTILE_DISC
		["listagg", "SELECT LISTAGG(a, ',') WITHIN GROUP (ORDER BY a) FROM t", "query"], // r_LISTAGG
		["ignore-nulls", "SELECT LAG(a) IGNORE NULLS OVER (ORDER BY b) FROM t", "query"], // r_WF_LAG
		["window-frame", "SELECT sum(a) OVER (ORDER BY b ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t", "query"], // r_Window_function_synopsis
		["exists-subquery", "SELECT a FROM t WHERE EXISTS (SELECT 1 FROM u WHERE u.id = t.id)", "query"], // r_EXISTS_predicate
		["scalar-subquery", "SELECT (SELECT max(a) FROM u) AS m FROM t", "query"], // r_scalar_subqueries
		["in-list", "SELECT a FROM t WHERE a IN (1, 2, 3)", "query"], // r_in_condition
	],
	DML: [
		["insert-values", "INSERT INTO t VALUES (1, 'a')", "nonquery"], // r_INSERT_30
		["insert-select", "INSERT INTO t SELECT * FROM u", "nonquery"], // r_INSERT_30
		["update", "UPDATE t SET a = 1 WHERE b = 2", "nonquery"], // r_UPDATE
		["update-from", "UPDATE t SET a = u.a FROM u WHERE t.id = u.id", "nonquery"], // r_UPDATE
		["delete", "DELETE FROM t WHERE a = 1", "nonquery"], // r_DELETE
		["delete-using", "DELETE FROM t USING u WHERE t.id = u.id", "nonquery"], // r_DELETE
		[
			"merge",
			"MERGE INTO t USING u ON t.id = u.id WHEN MATCHED THEN UPDATE SET a = u.a WHEN NOT MATCHED THEN INSERT VALUES (u.a)",
			"nonquery",
		], // r_MERGE
		["truncate", "TRUNCATE t", "nonquery"], // r_TRUNCATE
		["copy", "COPY t FROM 's3://b/p' IAM_ROLE 'arn' CSV", "nonquery"], // r_COPY
		["unload", "UNLOAD ('SELECT * FROM t') TO 's3://b/p' IAM_ROLE 'arn'", "nonquery"], // r_UNLOAD
	],
	DDL: [
		["create-table", "CREATE TABLE t (a INT, b VARCHAR(10))", "nonquery"], // r_CREATE_TABLE_NEW
		["create-table-distkey", "CREATE TABLE t (a INT, b INT) DISTSTYLE KEY DISTKEY (a) SORTKEY (b)", "nonquery"], // r_CREATE_TABLE_NEW
		["ctas", "CREATE TABLE t AS SELECT 1 AS a", "nonquery"], // r_CTAS
		["create-temp-table", "CREATE TEMP TABLE t (a INT)", "nonquery"], // r_CREATE_TABLE_NEW
		[
			"create-external-table",
			"CREATE EXTERNAL TABLE spectrum.t (a INT) STORED AS PARQUET LOCATION 's3://b/p'",
			"nonquery",
		], // r_CREATE_EXTERNAL_TABLE
		["create-view", "CREATE OR REPLACE VIEW v AS SELECT 1 AS a", "nonquery"], // r_CREATE_VIEW
		["create-view-nsb", "CREATE VIEW v AS SELECT a FROM t WITH NO SCHEMA BINDING", "nonquery"], // r_CREATE_VIEW
		["create-mv", "CREATE MATERIALIZED VIEW mv AS SELECT a FROM t", "nonquery"], // materialized-view-create-sql-command
		[
			"create-function",
			"CREATE FUNCTION f(INT) RETURNS INT STABLE AS $$ select $1 + 1 $$ LANGUAGE sql",
			"nonquery",
		], // r_CREATE_FUNCTION
		["create-procedure", "CREATE PROCEDURE p() AS $$ BEGIN END; $$ LANGUAGE plpgsql", "nonquery"], // r_CREATE_PROCEDURE
		["alter-table-add", "ALTER TABLE t ADD COLUMN c INT", "nonquery"], // r_ALTER_TABLE
		["drop-table", "DROP TABLE IF EXISTS t", "nonquery"], // r_DROP_TABLE
		["create-schema", "CREATE SCHEMA sch", "nonquery"], // r_CREATE_SCHEMA
		["create-database", "CREATE DATABASE db", "nonquery"], // r_CREATE_DATABASE
	],
	commands: [
		["show-tables", "SHOW TABLES FROM SCHEMA db.sch", "nonquery"], // r_SHOW_TABLES
		["grant", "GRANT SELECT ON t TO u", "nonquery"], // r_GRANT
		["revoke", "REVOKE SELECT ON t FROM u", "nonquery"], // r_REVOKE
		["set", "SET search_path TO sch", "nonquery"], // r_SET
		["analyze", "ANALYZE t", "nonquery"], // r_ANALYZE
		["vacuum", "VACUUM FULL t", "nonquery"], // r_VACUUM_command
		["begin", "BEGIN", "nonquery"], // r_BEGIN
		["call", "CALL p(1)", "nonquery"], // r_CALL
		["explain", "EXPLAIN SELECT 1", "nonquery"], // r_EXPLAIN
	],
};

function outcome(sql: string): Expected {
	const parsed = parseRedshift(sql);
	if (parsed.errors > 0) return "noparse";
	const ir = lower(parsed.tree);
	if (ir.body.kind === "select" && ir.body.unsupported?.length) return "nonquery";
	resolveScopes(ir, "redshift");
	return "query";
}

for (const [category, probes] of Object.entries(PROBES)) {
	describe(`Redshift doc coverage: ${category}`, () => {
		for (const [name, sql, expected] of probes) {
			it(`${name} → ${expected}`, () => {
				expect(outcome(sql), sql).toBe(expected);
			});
		}
	});
}
