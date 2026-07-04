import { describe, expect, it } from "vitest";
import { lower } from "../src/trino/lower.js";
import { parseTrino } from "../src/trino/parse.js";
import { resolveScopes } from "../src/scope/scope.js";

// Doc-coverage gate: one probe per construct of the official Trino SQL reference
// (trino.io/docs/current, surveyed 2026-07-04). Each probe pins the CURRENT level of support, so
// closing a gap or regressing one flips a visible flag:
//
//   "query"    — parses, lowers to a modelled query (or a statement's inner query,
//                e.g. CTAS / INSERT … SELECT / CREATE VIEW), and scopes without throwing
//   "nonquery" — parses; lower flags it unsupported (DML / DDL / session, admin & utility
//                commands the semantic layer does not model as a query)
//   "noparse"  — the grammar rejects it: a documented construct the fork doesn't cover
//
// Trino's grammar IS the first-party trinodb SqlBase.g4 (release 482) mechanically split, so parity
// is by construction — the documented SQL surface parses in full and there is no "noparse" row today.
// A future Trino release that adds syntax we haven't re-split would surface here as a noparse pin.
// "nonquery" entries are documented Trino SQL — each a known, recorded boundary of the query model,
// not an oversight. Flip the flag in the same change that closes one.
// Base URL for the per-probe page citations: https://trino.io/docs/current/

type Expected = "query" | "nonquery" | "noparse";
type Probe = [name: string, sql: string, expected: Expected];

const PROBES: Record<string, Probe[]> = {
	"query clauses": [
		["basic", "SELECT a, b FROM t", "query"], // sql/select
		["where", "SELECT a FROM t WHERE a > 1 AND b IS NOT NULL", "query"], // sql/select
		["distinct", "SELECT DISTINCT a FROM t", "query"], // sql/select
		["group-by", "SELECT a, count(*) FROM t GROUP BY a", "query"], // sql/select#group-by-clause
		["group-by-distinct", "SELECT a FROM t GROUP BY DISTINCT a, b", "query"], // sql/select#group-by-clause
		["group-by-rollup", "SELECT a, b, count(*) FROM t GROUP BY ROLLUP (a, b)", "query"], // sql/select#group-by-clause
		["grouping-sets", "SELECT a, count(*) FROM t GROUP BY GROUPING SETS ((a), ())", "query"], // sql/select#group-by-clause
		["having", "SELECT a, count(*) FROM t GROUP BY a HAVING count(*) > 1", "query"], // sql/select#having-clause
		["order-by", "SELECT a FROM t ORDER BY a DESC NULLS LAST", "query"], // sql/select#order-by-clause
		["limit", "SELECT a FROM t ORDER BY a LIMIT 10", "query"], // sql/select#limit-clause
		["offset", "SELECT a FROM t OFFSET 5 ROWS", "query"], // sql/select#offset-clause
		["fetch-first", "SELECT a FROM t OFFSET 5 ROWS FETCH FIRST 10 ROWS ONLY", "query"], // sql/select#fetch-first-clause
		["cte", "WITH c AS (SELECT 1 AS a) SELECT * FROM c", "query"], // sql/select#with-clause
		["cte-cols", "WITH c (x, y) AS (SELECT 1, 2) SELECT x FROM c", "query"], // sql/select#with-clause
		[
			"recursive-cte",
			"WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r WHERE n < 3) SELECT * FROM r",
			"query",
		], // sql/select#recursive-queries
		["qualified-star", "SELECT t.* FROM t", "query"], // sql/select#select-clause
	],
	"set operators": [
		["union", "SELECT a FROM t UNION SELECT a FROM u", "query"], // sql/select#union-clause
		["union-all", "SELECT a FROM t UNION ALL SELECT a FROM u", "query"], // sql/select#union-clause
		["intersect", "SELECT a FROM t INTERSECT SELECT a FROM u", "query"], // sql/select#intersect-clause
		["except", "SELECT a FROM t EXCEPT SELECT a FROM u", "query"], // sql/select#except-clause
		["union-corresponding", "SELECT a FROM t UNION CORRESPONDING SELECT a, b FROM u", "query"], // sql/select#union-clause
	],
	"from / joins": [
		["join-on", "SELECT * FROM t JOIN u ON t.id = u.id", "query"], // sql/select#explicit-join
		["join-using", "SELECT * FROM t JOIN u USING (id)", "query"], // sql/select#explicit-join
		["natural-join", "SELECT * FROM t NATURAL JOIN u", "query"], // sql/select#explicit-join
		["cross-join", "SELECT * FROM t CROSS JOIN u", "query"], // sql/select#cross-join
		["left-outer-join", "SELECT * FROM t LEFT OUTER JOIN u ON t.id = u.id", "query"], // sql/select#explicit-join
		["lateral", "SELECT * FROM t, LATERAL (SELECT t.a AS x)", "query"], // sql/select#lateral-clause
		["unnest", "SELECT x FROM t, UNNEST(t.arr) AS a(x)", "query"], // sql/select#unnest
		["unnest-ordinality", "SELECT x, o FROM t, UNNEST(t.arr) WITH ORDINALITY AS a(x, o)", "query"], // sql/select#unnest
		["values", "SELECT * FROM (VALUES (1, 'a'), (2, 'b')) AS v(x, y)", "query"], // sql/values
		["table-stmt", "TABLE t", "query"], // sql/select#table
		["subquery-from", "SELECT * FROM (SELECT a FROM t) s", "query"], // sql/select#from-clause
		["tablesample", "SELECT * FROM t TABLESAMPLE BERNOULLI (10)", "query"], // sql/select#tablesample
		["json-table", "SELECT * FROM t, JSON_TABLE(t.j, 'lax $' COLUMNS (v INTEGER PATH 'lax $.v'))", "query"], // functions/json#json_table
		["table-function", "SELECT * FROM TABLE(my_func(input => 1))", "query"], // functions/table
		["time-travel-version", "SELECT * FROM t FOR VERSION AS OF 3", "query"], // sql/select#from-clause
		[
			"match-recognize",
			"SELECT * FROM t MATCH_RECOGNIZE (MEASURES count(*) AS c PATTERN (x+) DEFINE x AS x.v > 0)",
			"nonquery",
		], // sql/match-recognize (flagged; base relation visible)
	],
	expressions: [
		["case-searched", "SELECT CASE WHEN a > 1 THEN 'x' ELSE 'y' END FROM t", "query"], // functions/conditional#case
		["cast", "SELECT CAST(a AS varchar) FROM t", "query"], // functions/conversion#cast
		["try-cast", "SELECT TRY_CAST(a AS integer) FROM t", "query"], // functions/conversion#try_cast
		["typed-literal", "SELECT BIGINT '123'", "query"], // language/types
		["row", "SELECT ROW(1, 2, 'a') FROM t", "query"], // language/types#row
		["array", "SELECT ARRAY[1, 2, 3] FROM t", "query"], // language/types#array
		["array-subscript", "SELECT arr[1] FROM t", "query"], // functions/array#subscript
		["map-subscript", "SELECT m['k'] FROM t", "query"], // functions/map#subscript
		["lambda", "SELECT filter(arr, x -> x > 0) FROM t", "query"], // functions/lambda
		["at-time-zone", "SELECT ts AT TIME ZONE 'UTC' FROM t", "query"], // functions/datetime#at-time-zone
		["extract", "SELECT EXTRACT(YEAR FROM ts) FROM t", "query"], // functions/datetime#extract
		["interval", "SELECT INTERVAL '1' DAY FROM t", "query"], // language/types#interval
		["trim", "SELECT trim(LEADING ' ' FROM a) FROM t", "query"], // functions/string#trim
		["substring-from", "SELECT substring(a FROM 1 FOR 2) FROM t", "query"], // functions/string#substring
		["listagg", "SELECT listagg(a, ',') WITHIN GROUP (ORDER BY a) FROM t", "query"], // functions/aggregate#listagg
		["quantified-comparison", "SELECT a FROM t WHERE a > ALL (SELECT b FROM u)", "query"], // functions/comparison#quantified
		["exists", "SELECT a FROM t WHERE EXISTS (SELECT 1 FROM u WHERE u.id = t.id)", "query"], // functions/comparison#exists
		["scalar-subquery", "SELECT (SELECT max(a) FROM u) AS m FROM t", "query"], // sql/select#subqueries
		["in-subquery", "SELECT a FROM t WHERE a IN (SELECT b FROM u)", "query"], // functions/comparison#in
		["json-exists", "SELECT JSON_EXISTS(j, 'lax $.a') FROM t", "query"], // functions/json#json_exists
		["json-value", "SELECT JSON_VALUE(j, 'lax $.a' RETURNING integer) FROM t", "query"], // functions/json#json_value
		["json-query", "SELECT JSON_QUERY(j, 'lax $.a') FROM t", "query"], // functions/json#json_query
		["json-object", "SELECT JSON_OBJECT('k' : 1) FROM t", "query"], // functions/json#json_object
	],
	window: [
		["window-over", "SELECT row_number() OVER (PARTITION BY a ORDER BY b) FROM t", "query"], // functions/window
		["named-window", "SELECT sum(a) OVER w FROM t WINDOW w AS (ORDER BY b)", "query"], // sql/select#window-clause
		["window-frame", "SELECT sum(a) OVER (ORDER BY b ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t", "query"], // functions/window
		["ignore-nulls", "SELECT lag(a) IGNORE NULLS OVER (ORDER BY b) FROM t", "query"], // functions/window#lag
	],
	"trino query prefixes": [
		["with-session", "WITH SESSION foo.bar = 'x' SELECT a FROM t", "nonquery"], // sql/select (WITH SESSION flagged)
		["with-function", "WITH FUNCTION f(x integer) RETURNS integer RETURN x + 1 SELECT f(1)", "nonquery"], // sql/select (WITH FUNCTION flagged)
	],
	DML: [
		["insert-values", "INSERT INTO t VALUES (1, 'a')", "query"], // sql/insert (inner VALUES modelled)
		["insert-select", "INSERT INTO t SELECT * FROM u", "query"], // sql/insert (embedded query is the body)
		["update", "UPDATE t SET a = 1 WHERE b = 2", "nonquery"], // sql/update
		["delete", "DELETE FROM t WHERE a = 1", "nonquery"], // sql/delete
		[
			"merge",
			"MERGE INTO t USING u ON t.id = u.id WHEN MATCHED THEN UPDATE SET a = u.a WHEN NOT MATCHED THEN INSERT (a) VALUES (u.a)",
			"nonquery",
		], // sql/merge
		["truncate", "TRUNCATE TABLE t", "nonquery"], // sql/truncate
		["analyze", "ANALYZE t", "nonquery"], // sql/analyze
	],
	DDL: [
		["create-table", "CREATE TABLE t (a integer, b varchar)", "nonquery"], // sql/create-table
		["ctas", "CREATE TABLE t AS SELECT 1 AS a", "query"], // sql/create-table-as (embedded query is the body)
		["create-table-like", "CREATE TABLE t (LIKE u)", "nonquery"], // sql/create-table
		["create-view", "CREATE VIEW v AS SELECT 1 AS a", "query"], // sql/create-view (embedded query is the body)
		["create-materialized-view", "CREATE MATERIALIZED VIEW mv AS SELECT a FROM t", "query"], // sql/create-materialized-view
		["create-schema", "CREATE SCHEMA s", "nonquery"], // sql/create-schema
		["create-function", "CREATE FUNCTION f(x integer) RETURNS integer RETURN x + 1", "nonquery"], // sql/create-function
		["alter-table-add", "ALTER TABLE t ADD COLUMN c integer", "nonquery"], // sql/alter-table
		["drop-table", "DROP TABLE IF EXISTS t", "nonquery"], // sql/drop-table
		["comment", "COMMENT ON TABLE t IS 'x'", "nonquery"], // sql/comment
	],
	commands: [
		["show-tables", "SHOW TABLES FROM s", "nonquery"], // sql/show-tables
		["show-create-table", "SHOW CREATE TABLE t", "nonquery"], // sql/show-create-table
		["describe", "DESCRIBE t", "nonquery"], // sql/describe
		["use", "USE catalog.schema", "nonquery"], // sql/use
		["set-session", "SET SESSION foo = 'bar'", "nonquery"], // sql/set-session
		["set-time-zone", "SET TIME ZONE 'UTC'", "nonquery"], // sql/set-time-zone
		["explain", "EXPLAIN SELECT a FROM t", "nonquery"], // sql/explain
		["explain-analyze", "EXPLAIN ANALYZE SELECT a FROM t", "nonquery"], // sql/explain-analyze
		["prepare", "PREPARE p FROM SELECT a FROM t", "nonquery"], // sql/prepare
		["execute", "EXECUTE p USING 1, 'a'", "nonquery"], // sql/execute
		["deallocate", "DEALLOCATE PREPARE p", "nonquery"], // sql/deallocate-prepare
		["call", "CALL system.runtime.kill_query('q')", "nonquery"], // sql/call
		["grant", "GRANT SELECT ON t TO u", "nonquery"], // sql/grant
		["revoke", "REVOKE SELECT ON t FROM u", "nonquery"], // sql/revoke
		["start-transaction", "START TRANSACTION", "nonquery"], // sql/start-transaction
		["commit", "COMMIT", "nonquery"], // sql/commit
	],
};

function outcome(sql: string): Expected {
	const parsed = parseTrino(sql);
	if (parsed.errors > 0) return "noparse";
	const ir = lower(parsed.tree);
	if (ir.body.kind === "select" && ir.body.unsupported?.length) return "nonquery";
	resolveScopes(ir, "trino");
	return "query";
}

for (const [category, probes] of Object.entries(PROBES)) {
	describe(`Trino doc coverage: ${category}`, () => {
		for (const [name, sql, expected] of probes) {
			it(`${name} → ${expected}`, () => {
				expect(outcome(sql), sql).toBe(expected);
			});
		}
	});
}
