import { describe, expect, it } from "vitest";
import { lower } from "../src/postgres/lower.js";
import { parsePostgres } from "../src/postgres/parse.js";
import { resolveScopes } from "../src/scope/scope.js";

// Doc-coverage gate: one probe per construct of the official PostgreSQL SQL reference
// (postgresql.org/docs/18, surveyed 2026-07-02). Each probe pins the CURRENT level of support, so
// closing a gap or regressing one flips a visible flag:
//
//   "query"    — parses, lowers to a modelled query (or a statement's inner query,
//                e.g. CTAS / INSERT … SELECT), and scopes without throwing
//   "nonquery" — parses; lower flags it unsupported (DML / DDL / session & utility
//                commands the semantic layer does not model as a query)
//   "noparse"  — the grammar rejects it: a documented construct the fork doesn't cover
//
// "nonquery"/"noparse" entries are documented PostgreSQL SQL — each a known, recorded
// boundary, not an oversight. Flip the flag in the same change that closes one.
// Base URL for the per-probe page citations: https://www.postgresql.org/docs/18/

type Expected = "query" | "nonquery" | "noparse";
type Probe = [name: string, sql: string, expected: Expected];

const PROBES: Record<string, Probe[]> = {
	"query clauses": [
		["basic", "SELECT a, b FROM t", "query"], // sql-select
		["where", "SELECT a FROM t WHERE a > 1 AND b IS NOT NULL", "query"], // sql-select
		["group-by", "SELECT a, count(*) FROM t GROUP BY a", "query"], // sql-select
		["group-by-rollup", "SELECT a, b, count(*) FROM t GROUP BY ROLLUP (a, b)", "query"], // queries-table-expressions
		["group-by-cube", "SELECT a, b, count(*) FROM t GROUP BY CUBE (a, b)", "query"], // queries-table-expressions
		["grouping-sets", "SELECT a, count(*) FROM t GROUP BY GROUPING SETS ((a), ())", "query"], // queries-table-expressions
		["having", "SELECT a, count(*) FROM t GROUP BY a HAVING count(*) > 1", "query"], // sql-select
		["distinct", "SELECT DISTINCT a FROM t", "query"], // sql-select
		["distinct-on", "SELECT DISTINCT ON (a) a, b FROM t ORDER BY a, b", "query"], // sql-select
		["order-by", "SELECT a FROM t ORDER BY a DESC NULLS LAST", "query"], // sql-select
		["limit-offset", "SELECT a FROM t ORDER BY a LIMIT 10 OFFSET 5", "query"], // sql-select
		["fetch-first", "SELECT a FROM t ORDER BY a FETCH FIRST 5 ROWS ONLY", "query"], // sql-select
		["fetch-ties", "SELECT a FROM t ORDER BY a FETCH FIRST 5 ROWS WITH TIES", "query"], // sql-select
		["for-update", "SELECT a FROM t FOR UPDATE SKIP LOCKED", "query"], // sql-select
		["window-clause", "SELECT sum(a) OVER w FROM t WINDOW w AS (PARTITION BY b ORDER BY a)", "query"], // sql-select
		["cte", "WITH c AS (SELECT 1 AS a) SELECT * FROM c", "query"], // queries-with
		["cte-materialized", "WITH c AS MATERIALIZED (SELECT 1 AS a) SELECT * FROM c", "query"], // queries-with
		[
			"recursive-cte",
			"WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r WHERE n < 3) SELECT * FROM r",
			"query",
		], // queries-with
		[
			"recursive-search",
			"WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r WHERE n < 3) SEARCH DEPTH FIRST BY n SET ord SELECT * FROM r ORDER BY ord",
			"query",
		], // queries-with
		[
			"recursive-cycle",
			"WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r WHERE n < 3) CYCLE n SET is_cycle USING path SELECT * FROM r",
			"query",
		], // queries-with
	],
	"set operators": [
		["union-all", "SELECT a FROM t UNION ALL SELECT a FROM u", "query"], // sql-select
		["intersect", "SELECT a FROM t INTERSECT SELECT a FROM u", "query"], // sql-select
		["except", "SELECT a FROM t EXCEPT SELECT a FROM u", "query"], // sql-select
	],
	"from / joins": [
		["join-on", "SELECT * FROM t JOIN u ON t.id = u.id", "query"], // queries-table-expressions
		["join-using", "SELECT * FROM t JOIN u USING (id)", "query"], // queries-table-expressions
		["join-natural", "SELECT * FROM t NATURAL JOIN u", "query"], // queries-table-expressions
		["cross-join", "SELECT * FROM t CROSS JOIN u", "query"], // queries-table-expressions
		["lateral", "SELECT * FROM t, LATERAL (SELECT t.a AS x) s", "query"], // queries-table-expressions
		["tablesample", "SELECT * FROM t TABLESAMPLE BERNOULLI (10)", "query"], // sql-select
		["values-inline", "SELECT * FROM (VALUES (1, 'a'), (2, 'b')) AS v(x, y)", "query"], // queries-values
		["srf-generate-series", "SELECT * FROM generate_series(1, 10) AS g", "query"], // functions-srf
		["rows-from", "SELECT * FROM ROWS FROM (generate_series(1, 3), generate_series(4, 6)) AS x(a, b)", "query"], // queries-table-expressions
		["with-ordinality", "SELECT * FROM unnest(ARRAY[1, 2]) WITH ORDINALITY AS u(v, o)", "query"], // queries-table-expressions
		["json-table", "SELECT * FROM JSON_TABLE('[]', '$[*]' COLUMNS (a INT PATH '$.a')) AS jt", "query"], // functions-json
	],
	expressions: [
		["case", "SELECT CASE WHEN a > 1 THEN 'x' ELSE 'y' END FROM t", "query"], // functions-conditional
		["cast", "SELECT CAST(a AS NUMERIC(10, 2)) FROM t", "query"], // sql-expressions
		["double-colon-cast", "SELECT a::text FROM t", "query"], // sql-expressions
		["array-literal", "SELECT ARRAY[1, 2, 3]", "query"], // arrays
		["array-subscript", "SELECT (ARRAY[1, 2, 3])[1]", "query"], // arrays
		["row-expr", "SELECT ROW(1, 2) AS r", "query"], // sql-expressions
		["is-json", "SELECT a FROM t WHERE a IS JSON OBJECT", "query"], // functions-json
		["json-query", "SELECT JSON_QUERY(a, '$.b') FROM t", "query"], // functions-json
		["json-exists", "SELECT a FROM t WHERE JSON_EXISTS(a, '$.b')", "query"], // functions-json
		["jsonb-arrow", "SELECT a -> 'k' ->> 'x' FROM t", "query"], // functions-json
		["collate", 'SELECT a FROM t ORDER BY a COLLATE "C"', "query"], // collation
		["interval", "SELECT INTERVAL '1 day' + now()", "query"], // datatype-datetime
		["dollar-string", "SELECT $tag$abc$tag$ AS x", "query"], // sql-syntax-lexical
		["within-group", "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY a) FROM t", "query"], // functions-aggregate
		["filter-clause", "SELECT count(*) FILTER (WHERE a > 0) FROM t", "query"], // sql-expressions
		["window-frame", "SELECT sum(a) OVER (ORDER BY b ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t", "query"], // sql-expressions
		["exists-subquery", "SELECT a FROM t WHERE EXISTS (SELECT 1 FROM u WHERE u.id = t.id)", "query"], // functions-subquery
		["any-array", "SELECT a FROM t WHERE a = ANY (ARRAY[1, 2, 3])", "query"], // functions-comparisons
	],
	DML: [
		["insert-values", "INSERT INTO t VALUES (1, 'a')", "nonquery"], // sql-insert
		["insert-select", "INSERT INTO t SELECT * FROM u", "nonquery"], // sql-insert
		["insert-on-conflict", "INSERT INTO t VALUES (1) ON CONFLICT (id) DO UPDATE SET a = excluded.a", "nonquery"], // sql-insert
		["insert-returning", "INSERT INTO t VALUES (1) RETURNING id", "nonquery"], // sql-insert
		["update", "UPDATE t SET a = 1 WHERE b = 2", "nonquery"], // sql-update
		["update-from", "UPDATE t SET a = u.a FROM u WHERE t.id = u.id", "nonquery"], // sql-update
		["delete", "DELETE FROM t WHERE a = 1", "nonquery"], // sql-delete
		["delete-using", "DELETE FROM t USING u WHERE t.id = u.id", "nonquery"], // sql-delete
		[
			"merge",
			"MERGE INTO t USING u ON t.id = u.id WHEN MATCHED THEN UPDATE SET a = u.a WHEN NOT MATCHED THEN INSERT (a) VALUES (u.a)",
			"nonquery",
		], // sql-merge
		["truncate", "TRUNCATE TABLE t RESTART IDENTITY", "nonquery"], // sql-truncate
		["copy-from", "COPY t FROM '/tmp/f.csv' WITH (FORMAT csv)", "nonquery"], // sql-copy
	],
	DDL: [
		["create-table", "CREATE TABLE t (a INT PRIMARY KEY, b TEXT)", "nonquery"], // sql-createtable
		["ctas", "CREATE TABLE t AS SELECT 1 AS a", "nonquery"], // sql-createtableas
		["create-temp-table", "CREATE TEMP TABLE t (a INT)", "nonquery"], // sql-createtable
		["create-partitioned", "CREATE TABLE t (a INT) PARTITION BY RANGE (a)", "nonquery"], // sql-createtable
		["create-view", "CREATE OR REPLACE VIEW v AS SELECT 1 AS a", "nonquery"], // sql-createview
		["create-mv", "CREATE MATERIALIZED VIEW mv AS SELECT a FROM t", "nonquery"], // sql-creatematerializedview
		["create-index", "CREATE INDEX ix ON t (a)", "nonquery"], // sql-createindex
		["create-function", "CREATE FUNCTION f(x INT) RETURNS INT LANGUAGE sql AS 'SELECT x + 1'", "nonquery"], // sql-createfunction
		["create-procedure", "CREATE PROCEDURE p() LANGUAGE sql AS 'SELECT 1'", "nonquery"], // sql-createprocedure
		["create-sequence", "CREATE SEQUENCE seq START 1 INCREMENT 1", "nonquery"], // sql-createsequence
		["create-type-enum", "CREATE TYPE mood AS ENUM ('a', 'b')", "nonquery"], // sql-createtype
		["create-domain", "CREATE DOMAIN posint AS INT CHECK (VALUE > 0)", "nonquery"], // sql-createdomain
		["create-trigger", "CREATE TRIGGER trg BEFORE INSERT ON t FOR EACH ROW EXECUTE FUNCTION f()", "nonquery"], // sql-createtrigger
		["alter-table-add", "ALTER TABLE t ADD COLUMN c INT", "nonquery"], // sql-altertable
		["drop-table", "DROP TABLE IF EXISTS t", "nonquery"], // sql-droptable
		["create-schema", "CREATE SCHEMA sch", "nonquery"], // sql-createschema
	],
	commands: [
		["grant", "GRANT SELECT ON t TO u", "nonquery"], // sql-grant
		["revoke", "REVOKE SELECT ON t FROM u", "nonquery"], // sql-revoke
		["set", "SET search_path TO sch", "nonquery"], // sql-set
		["show", "SHOW search_path", "nonquery"], // sql-show
		["explain", "EXPLAIN ANALYZE SELECT 1", "nonquery"], // sql-explain
		["analyze", "ANALYZE t", "nonquery"], // sql-analyze
		["vacuum", "VACUUM FULL t", "nonquery"], // sql-vacuum
		["begin", "BEGIN", "nonquery"], // sql-begin
		["call", "CALL p(1)", "nonquery"], // sql-call
		["do", "DO $$ BEGIN NULL; END $$", "nonquery"], // sql-do
		["comment-on", "COMMENT ON TABLE t IS 'x'", "nonquery"], // sql-comment
	],
};

function outcome(sql: string): Expected {
	const parsed = parsePostgres(sql);
	if (parsed.errors > 0) return "noparse";
	const ir = lower(parsed.tree);
	if (ir.body.kind === "select" && ir.body.unsupported?.length) return "nonquery";
	resolveScopes(ir, "postgres");
	return "query";
}

for (const [category, probes] of Object.entries(PROBES)) {
	describe(`PostgreSQL doc coverage: ${category}`, () => {
		for (const [name, sql, expected] of probes) {
			it(`${name} → ${expected}`, () => {
				expect(outcome(sql), sql).toBe(expected);
			});
		}
	});
}
