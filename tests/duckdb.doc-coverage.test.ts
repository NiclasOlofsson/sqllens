import { describe, expect, it } from "vitest";
import { lower } from "../src/duckdb/lower.js";
import { parseDuckdb } from "../src/duckdb/parse.js";
import { resolveScopes } from "../src/scope/scope.js";

// Doc-coverage gate: one probe per construct of the official DuckDB SQL reference
// (duckdb.org/docs/current, surveyed 2026-07-02). Each probe pins the CURRENT level of support, so
// closing a gap or regressing one flips a visible flag:
//
//   "query"    — parses, lowers to a modelled query (or a statement's inner query,
//                e.g. CTAS / INSERT … SELECT), and scopes without throwing
//   "nonquery" — parses; lower flags it unsupported (DML / DDL / session & utility
//                commands the semantic layer does not model as a query)
//   "noparse"  — the grammar rejects it: a documented construct the fork doesn't cover
//
// "nonquery"/"noparse" entries are documented DuckDB SQL — each a known, recorded
// boundary, not an oversight. Flip the flag in the same change that closes one.
// Base URL for the per-probe page citations: https://duckdb.org/docs/current/

type Expected = "query" | "nonquery" | "noparse";
type Probe = [name: string, sql: string, expected: Expected];

const PROBES: Record<string, Probe[]> = {
	"query clauses": [
		["basic", "SELECT a, b FROM t", "query"], // sql/statements/select
		["from-first", "FROM t SELECT a, b", "query"], // sql/query_syntax/from
		["from-only", "FROM t", "query"], // sql/query_syntax/from
		["where", "SELECT a FROM t WHERE a > 1 AND b IS NOT NULL", "query"], // sql/query_syntax/where
		["group-by", "SELECT a, count(*) FROM t GROUP BY a", "query"], // sql/query_syntax/groupby
		["group-by-all", "SELECT a, count(*) FROM t GROUP BY ALL", "query"], // sql/query_syntax/groupby
		["group-by-cube", "SELECT a, b, count(*) FROM t GROUP BY CUBE (a, b)", "query"], // sql/query_syntax/grouping_sets
		["grouping-sets", "SELECT a, count(*) FROM t GROUP BY GROUPING SETS ((a), ())", "query"], // sql/query_syntax/grouping_sets
		["having", "SELECT a, count(*) FROM t GROUP BY a HAVING count(*) > 1", "query"], // sql/query_syntax/having
		["qualify", "SELECT a, row_number() OVER (ORDER BY a) AS rn FROM t QUALIFY rn = 1", "query"], // sql/query_syntax/qualify
		["order-by", "SELECT a FROM t ORDER BY a DESC NULLS LAST", "query"], // sql/query_syntax/orderby
		["order-by-all", "SELECT a, b FROM t ORDER BY ALL", "query"], // sql/query_syntax/orderby
		["limit-pct", "SELECT a FROM t LIMIT 10%", "query"], // sql/query_syntax/limit
		["distinct", "SELECT DISTINCT a FROM t", "query"], // sql/statements/select
		["distinct-on", "SELECT DISTINCT ON (a) a, b FROM t", "query"], // sql/statements/select
		["star-exclude", "SELECT * EXCLUDE (a) FROM t", "query"], // sql/expressions/star
		["star-replace", "SELECT * REPLACE (a + 1 AS a) FROM t", "query"], // sql/expressions/star
		["star-rename", "SELECT * RENAME (a AS x) FROM t", "query"], // sql/expressions/star
		["columns-regex", "SELECT COLUMNS('a.*') FROM t", "query"], // sql/expressions/star
		["columns-lambda", "SELECT COLUMNS(c -> c LIKE 'a%') FROM t", "query"], // sql/expressions/star
		["prefix-alias", "SELECT x: 42, y: a FROM t", "query"], // sql/query_syntax/select
		["cte", "WITH c AS (SELECT 1 AS a) SELECT * FROM c", "query"], // sql/query_syntax/with
		[
			"recursive-cte",
			"WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r WHERE n < 3) SELECT * FROM r",
			"query",
		], // sql/query_syntax/with
	],
	"set operators": [
		["union-all", "SELECT a FROM t UNION ALL SELECT a FROM u", "query"], // sql/query_syntax/setops
		["union-by-name", "SELECT a FROM t UNION ALL BY NAME SELECT a FROM u", "query"], // sql/query_syntax/setops
		["intersect", "SELECT a FROM t INTERSECT SELECT a FROM u", "query"], // sql/query_syntax/setops
		["except", "SELECT a FROM t EXCEPT SELECT a FROM u", "query"], // sql/query_syntax/setops
	],
	"from / joins": [
		["join-on", "SELECT * FROM t JOIN u ON t.id = u.id", "query"], // sql/query_syntax/from
		["join-using", "SELECT * FROM t JOIN u USING (id)", "query"], // sql/query_syntax/from
		["asof-join", "SELECT * FROM t ASOF JOIN u ON t.ts >= u.ts", "query"], // sql/query_syntax/from
		["positional-join", "SELECT * FROM t POSITIONAL JOIN u", "query"], // sql/query_syntax/from
		["semi-join", "SELECT * FROM t SEMI JOIN u ON t.id = u.id", "query"], // sql/query_syntax/from
		["anti-join", "SELECT * FROM t ANTI JOIN u ON t.id = u.id", "query"], // sql/query_syntax/from
		["lateral", "SELECT * FROM t, LATERAL (SELECT t.a AS x) s", "query"], // sql/query_syntax/from
		["values-inline", "SELECT * FROM (VALUES (1, 'a'), (2, 'b')) AS v(x, y)", "query"], // sql/query_syntax/values
		["string-relation", "SELECT * FROM 'file.parquet'", "query"], // sql/query_syntax/from
		["using-sample", "SELECT * FROM t USING SAMPLE 10%", "query"], // sql/samples
		["tablesample", "SELECT * FROM t TABLESAMPLE 10%", "query"], // sql/samples
		["pivot", "PIVOT t ON k USING sum(v)", "query"], // sql/statements/pivot (modelled: dynamic PivotInfo)
		["unpivot", "UNPIVOT t ON c1, c2 INTO NAME k VALUE v", "query"], // sql/statements/unpivot (modelled: UnpivotInfo)
	],
	expressions: [
		["case", "SELECT CASE WHEN a > 1 THEN 'x' ELSE 'y' END FROM t", "query"], // sql/expressions/case
		["cast", "SELECT CAST(a AS DECIMAL(10, 2)) FROM t", "query"], // sql/expressions/cast
		["double-colon-cast", "SELECT a::VARCHAR FROM t", "query"], // sql/expressions/cast
		["list-literal", "SELECT [1, 2, 3] AS l", "query"], // sql/data_types/list
		["struct-literal", "SELECT {'a': 1, 'b': 2} AS s", "query"], // sql/data_types/struct
		["map-literal", "SELECT MAP {'a': 1, 'b': 2} AS m", "query"], // sql/data_types/map
		["list-comprehension", "SELECT [x * 2 FOR x IN [1, 2, 3]] AS l", "query"], // sql/functions/list
		["list-slice", "SELECT l[1:3] FROM t", "query"], // sql/functions/list
		["list-slice-step", "SELECT l[1:4:2] FROM t", "query"], // sql/functions/list
		["list-slice-empty-step", "SELECT ([1, 2, 3, 4])[::2] AS s", "query"], // sql/functions/list (#13)
		["lambda", "SELECT list_transform([1, 2], lambda x: x + 1)", "query"], // sql/functions/lambda
		["method-chain", "SELECT s.trim().upper() FROM t", "query"], // sql/functions/overview
		["method-on-literal", "SELECT 'abc'.upper()", "query"], // sql/functions/overview (#13)
		["struct-dot", "SELECT s.a FROM t", "query"], // sql/data_types/struct
		["interval-unit", "SELECT INTERVAL 1 YEAR + now()", "query"], // sql/data_types/interval
		["within-group", "SELECT quantile_cont(a, 0.5) FROM t", "query"], // sql/functions/aggregates
		["filter-clause", "SELECT count(*) FILTER (WHERE a > 0) FROM t", "query"], // sql/query_syntax/filter
		["window-frame", "SELECT sum(a) OVER (ORDER BY b ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t", "query"], // sql/functions/window_functions
		["exists-subquery", "SELECT a FROM t WHERE EXISTS (SELECT 1 FROM u WHERE u.id = t.id)", "query"], // sql/expressions/subqueries
		["underscore-numeric", "SELECT 1_000_000 AS n", "query"], // sql/data_types/numeric
		["positional-param", "SELECT $1 AS x", "query"], // sql/query_syntax/prepared_statements
	],
	DML: [
		["insert-values", "INSERT INTO t VALUES (1, 'a')", "nonquery"], // sql/statements/insert
		["insert-select", "INSERT INTO t SELECT * FROM u", "nonquery"], // sql/statements/insert
		["insert-or-replace", "INSERT OR REPLACE INTO t VALUES (1, 'a')", "nonquery"], // sql/statements/insert
		["insert-by-name", "INSERT INTO t BY NAME SELECT 1 AS a", "nonquery"], // sql/statements/insert
		["insert-on-conflict", "INSERT INTO t VALUES (1) ON CONFLICT DO NOTHING", "nonquery"], // sql/statements/insert
		["update", "UPDATE t SET a = 1 WHERE b = 2", "nonquery"], // sql/statements/update
		["delete", "DELETE FROM t WHERE a = 1", "nonquery"], // sql/statements/delete
		["merge", "MERGE INTO t USING u ON t.id = u.id WHEN MATCHED THEN UPDATE SET a = u.a", "nonquery"], // sql/statements/merge_into
		["copy-to", "COPY t TO 'f.parquet' (FORMAT parquet)", "nonquery"], // sql/statements/copy
	],
	DDL: [
		["create-table", "CREATE TABLE t (a INT, b VARCHAR)", "nonquery"], // sql/statements/create_table
		["ctas", "CREATE TABLE t AS SELECT 1 AS a", "nonquery"], // sql/statements/create_table
		["create-or-replace", "CREATE OR REPLACE TABLE t (a INT)", "nonquery"], // sql/statements/create_table
		["create-view", "CREATE OR REPLACE VIEW v AS SELECT 1 AS a", "nonquery"], // sql/statements/create_view
		["create-macro", "CREATE MACRO addone(x) AS x + 1", "nonquery"], // sql/statements/create_macro
		["create-table-macro", "CREATE MACRO tm() AS TABLE SELECT 1 AS a", "nonquery"], // sql/statements/create_macro
		["create-type", "CREATE TYPE mood AS ENUM ('a', 'b')", "nonquery"], // sql/statements/create_type
		["create-secret", "CREATE SECRET s (TYPE s3, KEY_ID 'k', SECRET 'x')", "nonquery"], // sql/statements/create_secret
		["create-sequence", "CREATE SEQUENCE seq START 1", "nonquery"], // sql/statements/create_sequence
		["alter-table-add", "ALTER TABLE t ADD COLUMN c INT", "nonquery"], // sql/statements/alter_table
		["drop-table", "DROP TABLE IF EXISTS t", "nonquery"], // sql/statements/drop
	],
	session: [
		["attach", "ATTACH 'db.duckdb' AS db", "nonquery"], // sql/statements/attach
		["detach", "DETACH db", "nonquery"], // sql/statements/attach
		["use", "USE db.sch", "nonquery"], // sql/statements/use
		["install", "INSTALL httpfs", "nonquery"], // sql/statements/install
		["pragma", "PRAGMA database_list", "nonquery"], // sql/statements/pragma
		["set-variable", "SET memory_limit = '1GB'", "nonquery"], // sql/statements/set
		["describe", "DESCRIBE t", "nonquery"], // sql/statements/describe
		["summarize", "SUMMARIZE t", "nonquery"], // sql/statements/summarize
		["export-database", "EXPORT DATABASE 'target_dir'", "nonquery"], // sql/statements/export
		["call", "CALL pragma_version()", "nonquery"], // sql/statements/call
	],
};

function outcome(sql: string): Expected {
	const parsed = parseDuckdb(sql);
	if (parsed.errors > 0) return "noparse";
	const ir = lower(parsed.tree);
	if (ir.body.kind === "select" && ir.body.unsupported?.length) return "nonquery";
	resolveScopes(ir, "duckdb");
	return "query";
}

for (const [category, probes] of Object.entries(PROBES)) {
	describe(`DuckDB doc coverage: ${category}`, () => {
		for (const [name, sql, expected] of probes) {
			it(`${name} → ${expected}`, () => {
				expect(outcome(sql), sql).toBe(expected);
			});
		}
	});
}
