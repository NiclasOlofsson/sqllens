import { describe, expect, it } from "vitest";
import { lower } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";
import { resolveScopes } from "../src/scope/scope.js";

// Doc-coverage gate: one probe per construct of the official T-SQL reference
// (learn.microsoft.com/sql/t-sql, surveyed 2026-06-10). Each probe pins the CURRENT
// level of support, so closing a gap or regressing one flips a visible flag:
//
//   "select"  — parses and lowers to the "query" category: our SELECT pipeline handles it
//               (parseTSql + lower + resolveScopes, zero errors)
//   "script"  — parses but lowers to a non-query category (DML/DDL/admin); the statement is
//               recognised but not modelled (the semantic layer is queries-only by design)
//   "noparse" — the grammar rejects it (known upstream grammars-v4 gaps)
//
// Flip a flag in the same change that closes the gap it documents.

type Expected = "select" | "script" | "noparse";
type Probe = [name: string, sql: string, expected: Expected];

const PROBES: Record<string, Probe[]> = {
	queries: [
		["basic", "SELECT a, b FROM t", "select"],
		["top-percent-ties", "SELECT TOP (5) PERCENT WITH TIES a FROM t ORDER BY a", "select"],
		["offset-fetch", "SELECT a FROM t ORDER BY a OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY", "select"],
		["grouping-sets", "SELECT a, b FROM t GROUP BY GROUPING SETS ((a), (b), ())", "select"],
		["rollup", "SELECT a, b, count(*) FROM t GROUP BY ROLLUP (a, b)", "select"],
		["cube", "SELECT a, b, count(*) FROM t GROUP BY CUBE (a, b)", "select"],
		[
			"window-frame",
			"SELECT sum(a) OVER (PARTITION BY b ORDER BY c ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM t",
			"select",
		],
		["window-clause-2022", "SELECT row_number() OVER w FROM t WINDOW w AS (PARTITION BY a ORDER BY b)", "select"],
		["is-distinct-2022", "SELECT a FROM t WHERE a IS DISTINCT FROM b", "select"],
		["cte", "WITH c AS (SELECT 1 AS a) SELECT * FROM c", "select"],
		[
			"cte-recursive",
			"WITH r (n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r WHERE n < 3) SELECT * FROM r",
			"select",
		],
		["cross-apply", "SELECT * FROM t CROSS APPLY (SELECT TOP 1 * FROM u WHERE u.id = t.id) x", "select"],
		["outer-apply", "SELECT * FROM t OUTER APPLY dbo.fn(t.id) x", "select"],
		[
			"pivot",
			"SELECT * FROM (SELECT cat, yr, amt FROM s) p PIVOT (sum(amt) FOR yr IN ([2002], [2003])) AS pvt",
			"select",
		],
		["unpivot", "SELECT * FROM p UNPIVOT (v FOR k IN (c1, c2)) AS u", "select"],
		["for-xml-path", "SELECT a FROM t FOR XML PATH('row'), ROOT('rows')", "select"],
		["for-xml-auto", "SELECT a FROM t FOR XML AUTO, ELEMENTS", "select"],
		["for-json-path", "SELECT a FROM t FOR JSON PATH, INCLUDE_NULL_VALUES", "select"],
		["option-hints", "SELECT a FROM t OPTION (RECOMPILE, MAXDOP 4)", "select"],
		["table-hints", "SELECT a FROM t WITH (NOLOCK, INDEX(ix1))", "select"],
		["join-hint", "SELECT * FROM t INNER HASH JOIN u ON t.id = u.id", "select"],
		["temporal-as-of", "SELECT * FROM t FOR SYSTEM_TIME AS OF '2024-01-01'", "select"],
		["temporal-between", "SELECT * FROM t FOR SYSTEM_TIME BETWEEN '2024-01-01' AND '2024-02-01'", "select"],
		["tablesample", "SELECT * FROM t TABLESAMPLE (10 PERCENT)", "select"],
		["openjson-with", "SELECT * FROM OPENJSON(@j) WITH (a INT '$.a', b NVARCHAR(50) '$.b')", "select"],
		["openjson-bare", "SELECT * FROM OPENJSON(@j)", "select"],
		["openrowset-bulk", "SELECT * FROM OPENROWSET(BULK 'f.csv', SINGLE_CLOB) AS x", "select"],
		["openquery", "SELECT * FROM OPENQUERY(srv, 'SELECT 1 AS a')", "select"],
		["contains", "SELECT a FROM t WHERE CONTAINS(a, 'word')", "select"],
		["freetext", "SELECT a FROM t WHERE FREETEXT(a, 'phrase')", "select"],
		["containstable", "SELECT * FROM CONTAINSTABLE(t, a, 'word') AS k", "select"],
		["collate", "SELECT a FROM t ORDER BY a COLLATE Latin1_General_CI_AS", "select"],
		["at-time-zone", "SELECT GETDATE() AT TIME ZONE 'UTC'", "select"],
		[
			"union-except-intersect",
			"SELECT a FROM t UNION SELECT a FROM u EXCEPT SELECT a FROM v INTERSECT SELECT a FROM w",
			"select",
		],
		["some-any-all", "SELECT a FROM t WHERE a > ALL (SELECT a FROM u)", "select"],
		["assignment-select", "SELECT @v = a FROM t", "script"],
		["four-part-name", "SELECT * FROM srv.db.sch.t", "select"],
		["temp-table-ref", "SELECT * FROM #tmp", "select"],
		["table-var-ref", "SELECT * FROM @tv", "select"],
		["select-into", "SELECT a INTO #t FROM u", "script"],
		["values-constructor", "SELECT * FROM (VALUES (1), (2)) AS v(a)", "select"],
		["iif", "SELECT IIF(a > 1, 'x', 'y') FROM t", "select"],
		["convert-style", "SELECT CONVERT(VARCHAR(10), GETDATE(), 112)", "select"],
		["try-convert", "SELECT TRY_CONVERT(INT, a) FROM t", "select"],
		["nstring-money-binary", "SELECT N'x', $1.50, 0x1F", "select"],
		["string-agg-within", "SELECT STRING_AGG(a, ',') WITHIN GROUP (ORDER BY a) FROM t", "select"],
		["next-value-for", "SELECT NEXT VALUE FOR dbo.seq", "select"],
		["dollar-identity", "SELECT $IDENTITY FROM t", "select"],
		// ODBC {fn …} escape sequences: functions/odbc-scalar-functions-transact-sql
		["odbc-escape", "SELECT {fn CONCAT('a', 'b')}", "select"],
	],
	DML: [
		["insert-values", "INSERT INTO t (a, b) VALUES (1, 'x'), (2, 'y')", "script"],
		["insert-select", "INSERT INTO t SELECT a, b FROM u", "script"],
		["insert-exec", "INSERT INTO t EXEC dbo.p @x = 1", "script"],
		["insert-default", "INSERT INTO t DEFAULT VALUES", "script"],
		["insert-output", "INSERT INTO t (a) OUTPUT inserted.id VALUES (1)", "script"],
		["update-from-join", "UPDATE x SET x.a = u.a FROM t x JOIN u ON x.id = u.id", "script"],
		["update-compound-op", "UPDATE t SET a += 1 WHERE b = 2", "script"],
		["update-write", "UPDATE t SET doc.WRITE(@d, NULL, 0) WHERE id = 1", "script"],
		["delete-join", "DELETE x FROM t x JOIN u ON x.id = u.id", "script"],
		["delete-top", "DELETE TOP (10) FROM t WHERE a = 1", "script"],
		["delete-current-of", "DELETE FROM t WHERE CURRENT OF c", "script"],
		[
			"merge-full",
			"MERGE INTO t WITH (HOLDLOCK) AS tgt USING u AS src ON tgt.id = src.id WHEN MATCHED AND src.x = 1 THEN UPDATE SET tgt.a = src.a WHEN NOT MATCHED BY TARGET THEN INSERT (a) VALUES (src.a) WHEN NOT MATCHED BY SOURCE THEN DELETE OUTPUT $action, inserted.id;",
			"script",
		],
		["truncate", "TRUNCATE TABLE t", "script"],
		[
			"bulk-insert",
			"BULK INSERT t FROM 'c:\\\\f.csv' WITH (FIELDTERMINATOR = ',', ROWTERMINATOR = '\\n')",
			"noparse",
		],
	],
	procedural: [
		["declare-set", "DECLARE @x INT = 1; SET @x += 2;", "script"],
		["declare-table-var", "DECLARE @t TABLE (a INT PRIMARY KEY, b NVARCHAR(10))", "script"],
		["if-else", "IF @x > 1 BEGIN SELECT 1; END ELSE BEGIN SELECT 2; END", "script"],
		["while", "WHILE @x < 10 BEGIN SET @x += 1; IF @x = 5 BREAK; ELSE CONTINUE; END", "script"],
		["try-catch", "BEGIN TRY SELECT 1/0; END TRY BEGIN CATCH SELECT ERROR_MESSAGE(); END CATCH", "script"],
		["throw", "THROW 50001, 'msg', 1;", "script"],
		["raiserror", "RAISERROR ('m %d', 16, 1, 5) WITH NOWAIT", "script"],
		["return", "RETURN 0", "script"],
		["goto", "lbl: SELECT 1; GOTO lbl;", "script"],
		["waitfor", "WAITFOR DELAY '00:00:01'", "script"],
		[
			"cursor-lifecycle",
			"DECLARE c CURSOR FAST_FORWARD FOR SELECT a FROM t; OPEN c; FETCH NEXT FROM c INTO @x; CLOSE c; DEALLOCATE c;",
			"script",
		],
		[
			"transactions",
			"BEGIN TRANSACTION tx; SAVE TRANSACTION sp1; ROLLBACK TRANSACTION sp1; COMMIT TRANSACTION tx;",
			"script",
		],
		["xact-abort", "SET XACT_ABORT ON", "script"],
		["exec-proc", "EXEC dbo.p @a = 1, @b = @v OUTPUT", "script"],
		["sp-executesql", "EXEC sp_executesql N'SELECT @x', N'@x INT', @x = 1", "script"],
		["exec-string", "EXEC ('SELECT 1')", "script"],
		["execute-as", "EXECUTE AS USER = 'u'; REVERT;", "script"],
		["print", "PRINT 'hello'", "script"],
		["use-db", "USE mydb", "script"],
		["go-batches", "SELECT 1\nGO\nSELECT 2\nGO", "script"],
		["set-nocount", "SET NOCOUNT ON", "script"],
		["set-isolation", "SET TRANSACTION ISOLATION LEVEL READ COMMITTED", "script"],
		["dbcc", "DBCC CHECKDB", "script"],
	],
	DDL: [
		[
			"create-table-full",
			"CREATE TABLE dbo.t (id INT IDENTITY(1,1) NOT NULL CONSTRAINT pk PRIMARY KEY CLUSTERED, a NVARCHAR(50) NOT NULL CONSTRAINT df DEFAULT N'', b AS (a + N'x') PERSISTED, r INT CONSTRAINT fk REFERENCES dbo.u (id), CONSTRAINT ck CHECK (id > 0)) ON [PRIMARY]",
			"script",
		],
		[
			// PERIOD FOR SYSTEM_TIME + GENERATED ALWAYS AS ROW START/END — upstream gap
			"temporal-table",
			"CREATE TABLE dbo.t (id INT PRIMARY KEY, vf DATETIME2 GENERATED ALWAYS AS ROW START, vt DATETIME2 GENERATED ALWAYS AS ROW END, PERIOD FOR SYSTEM_TIME (vf, vt)) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.t_hist))",
			"noparse",
		],
		[
			"memory-optimized",
			"CREATE TABLE dbo.t (id INT PRIMARY KEY NONCLUSTERED) WITH (MEMORY_OPTIMIZED = ON, DURABILITY = SCHEMA_AND_DATA)",
			"script",
		],
		["masked-column", "CREATE TABLE t (a VARCHAR(100) MASKED WITH (FUNCTION = 'default()'))", "script"],
		[
			"alter-table",
			"ALTER TABLE t ADD c INT NULL; ALTER TABLE t DROP COLUMN a; ALTER TABLE t ALTER COLUMN b NVARCHAR(100) NOT NULL;",
			"script",
		],
		["alter-switch", "ALTER TABLE t SWITCH PARTITION 1 TO arch PARTITION 1", "script"],
		[
			"create-index",
			"CREATE NONCLUSTERED INDEX ix ON t (a DESC, b) INCLUDE (c) WHERE a IS NOT NULL WITH (ONLINE = ON)",
			"script",
		],
		["columnstore-index", "CREATE CLUSTERED COLUMNSTORE INDEX cci ON t", "script"],
		["create-view-schemabinding", "CREATE VIEW dbo.v WITH SCHEMABINDING AS SELECT a FROM dbo.t", "script"],
		[
			"create-proc",
			"CREATE PROCEDURE dbo.p @a INT = 1, @b NVARCHAR(10) OUTPUT WITH RECOMPILE AS BEGIN SET NOCOUNT ON; SELECT @b = a FROM t WHERE id = @a; END",
			"script",
		],
		["create-func-scalar", "CREATE FUNCTION dbo.f (@x INT) RETURNS INT AS BEGIN RETURN @x + 1; END", "script"],
		[
			"create-func-inline-tvf",
			"CREATE FUNCTION dbo.f (@x INT) RETURNS TABLE AS RETURN (SELECT a FROM t WHERE id = @x)",
			"script",
		],
		[
			"create-func-mstvf",
			"CREATE FUNCTION dbo.f (@x INT) RETURNS @r TABLE (a INT) AS BEGIN INSERT INTO @r SELECT a FROM t; RETURN; END",
			"script",
		],
		["create-trigger", "CREATE TRIGGER trg ON dbo.t AFTER INSERT, UPDATE AS BEGIN SELECT 1; END", "script"],
		["create-type-table", "CREATE TYPE dbo.tt AS TABLE (a INT PRIMARY KEY)", "script"],
		["create-sequence", "CREATE SEQUENCE dbo.seq START WITH 1 INCREMENT BY 1 CACHE 100", "script"],
		["create-synonym", "CREATE SYNONYM dbo.s FOR db.dbo.t", "script"],
		["create-schema", "CREATE SCHEMA sch AUTHORIZATION dbo", "script"],
		[
			"partition-fn-scheme",
			"CREATE PARTITION FUNCTION pf (INT) AS RANGE RIGHT FOR VALUES (1, 100); CREATE PARTITION SCHEME ps AS PARTITION pf ALL TO ([PRIMARY]);",
			"script",
		],
		[
			"create-database",
			"CREATE DATABASE db ON (NAME = d1, FILENAME = 'c:\\\\d1.mdf') LOG ON (NAME = l1, FILENAME = 'c:\\\\l1.ldf')",
			"script",
		],
		["ledger-table-2022", "CREATE TABLE t (id INT) WITH (LEDGER = ON)", "script"],
	],
	security: [
		[
			"create-login-user-role",
			"CREATE LOGIN l WITH PASSWORD = 'P@ss'; CREATE USER u FOR LOGIN l; CREATE ROLE r;",
			"script",
		],
		// multi-permission lists, OBJECT:: scopes, DENY and REVOKE — upstream gaps
		["grant-object", "GRANT SELECT, UPDATE ON OBJECT::dbo.t TO u WITH GRANT OPTION", "noparse"],
		["deny-revoke", "DENY DELETE ON dbo.t TO u; REVOKE SELECT ON dbo.t FROM u;", "noparse"],
	],
};

// Classify a probe by the single full-range parser + the statement category it lowers to:
//   parses + category "query"  → "select" (and the SELECT pipeline runs over it)
//   parses + any other category → "script" (a statement the grammar accepts but we don't model)
//   doesn't parse              → "noparse"
function outcome(sql: string): Expected {
	const r = parseTSql(sql);
	if (r.errors > 0) return "noparse";
	const ir = lower(r.tree);
	if (ir.statement === "query") {
		resolveScopes(ir, "tsql");
		return "select";
	}
	return "script";
}

for (const [category, probes] of Object.entries(PROBES)) {
	describe(`T-SQL doc coverage: ${category}`, () => {
		for (const [name, sql, expected] of probes) {
			it(`${name} → ${expected}`, () => {
				expect(outcome(sql), sql).toBe(expected);
			});
		}
	});
}
