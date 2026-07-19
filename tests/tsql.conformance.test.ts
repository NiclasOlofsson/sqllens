import { describe, expect, it } from "vitest";
import { parseTSql } from "../src/tsql/parse.js";

// Grammar conformance against the MS T-SQL reference, driven by the docs-corpus query bucket
// (the 86 failures triaged 2026-06-13). Every case is the documented syntax, RTFM'd — each
// `it` cites the reference page it was verified against. Genuinely-broken doc examples are NOT
// here; they live in tests/tsql-corpus-known-bad.ts with the verified defect.

function errorsOf(sql: string): number {
	return parseTSql(sql).errors;
}

describe("T-SQL docs-corpus conformance: functions", () => {
	// learn.microsoft.com/sql/t-sql/functions/json-array-transact-sql + json-object-transact-sql
	it("parses JSON_ARRAY / JSON_OBJECT with RETURNING json", () => {
		expect(errorsOf("SELECT JSON_ARRAY(1 RETURNING JSON)")).toBe(0);
		expect(errorsOf('SELECT JSON_OBJECT("a":1 RETURNING json)')).toBe(0);
		expect(errorsOf("SELECT JSON_OBJECT('a':1 NULL ON NULL)")).toBe(0); // regression guard
	});

	// learn.microsoft.com/sql/t-sql/functions/json-arrayagg-transact-sql + json-objectagg-transact-sql
	it("parses JSON_ARRAYAGG / JSON_OBJECTAGG", () => {
		expect(errorsOf("SELECT JSON_ARRAYAGG(c1 ORDER BY c1) FROM t")).toBe(0);
		expect(errorsOf("SELECT JSON_ARRAYAGG(1 RETURNING JSON)")).toBe(0);
		expect(errorsOf("SELECT JSON_OBJECTAGG('key':NULL)")).toBe(0);
		expect(errorsOf("SELECT JSON_OBJECTAGG(c1:c2) FROM t")).toBe(0);
		expect(
			errorsOf(
				"SELECT TOP(5) c.object_id, JSON_ARRAYAGG(c.name ORDER BY c.column_id) FROM sys.columns AS c GROUP BY c.object_id",
			),
		).toBe(0);
	});

	// learn.microsoft.com/sql/t-sql/functions/json-value-transact-sql (2025 RETURNING) +
	// json-query-transact-sql (2025 WITH ARRAY WRAPPER)
	it("parses JSON_VALUE RETURNING and JSON_QUERY WITH ARRAY WRAPPER", () => {
		expect(errorsOf("SELECT * FROM t WHERE JSON_VALUE(Info, '$.Customer.ID' RETURNING INT) = 16167")).toBe(0);
		expect(errorsOf("SELECT JSON_QUERY(@j, '$.credit_cards[*].type' WITH ARRAY WRAPPER)")).toBe(0);
	});

	// learn.microsoft.com/sql/t-sql/functions/regexp-like-transact-sql — boolean predicate (2025)
	it("parses REGEXP_LIKE as a WHERE predicate", () => {
		expect(errorsOf("SELECT * FROM Employees WHERE REGEXP_LIKE (FIRST_NAME, '^A.*Y$')")).toBe(0);
		expect(errorsOf("SELECT * FROM Employees WHERE REGEXP_LIKE (FIRST_NAME, '^A.*Y$', 'i')")).toBe(0);
	});

	// learn.microsoft.com/sql/t-sql/functions/current-date-transact-sql — niladic (2025)
	it("parses CURRENT_DATE", () => {
		expect(errorsOf("SELECT CURRENT_TIMESTAMP, CURRENT_DATE")).toBe(0);
	});

	// learn.microsoft.com/sql/t-sql/functions/trim-transact-sql — 2022+ LEADING|TRAILING|BOTH
	it("parses TRIM(LEADING/TRAILING/BOTH characters FROM s)", () => {
		expect(errorsOf("SELECT TRIM(LEADING '.,! ' FROM '  test  ')")).toBe(0);
		expect(errorsOf("SELECT TRIM(TRAILING '.' FROM 'test...')")).toBe(0);
		expect(errorsOf("SELECT TRIM(BOTH '1' FROM '111test111')")).toBe(0);
		expect(errorsOf("SELECT TRIM('.,! ' FROM s) FROM t")).toBe(0); // regression guard
	});

	// learn.microsoft.com/sql/t-sql/functions/product-aggregate-transact-sql — PRODUCT is a real
	// aggregate (Fabric / SQL Server 2025) with an analytic OVER form; it parses as a generic
	// function, so the generic call rule takes over_clause (CLR user-defined aggregates do too).
	it("parses PRODUCT(expr) OVER (PARTITION BY ...)", () => {
		expect(errorsOf("SELECT PRODUCT(1 + r) OVER (PARTITION BY fi) FROM t")).toBe(0);
		expect(errorsOf("SELECT PRODUCT(DISTINCT r) FROM t")).toBe(0);
	});
});

describe("T-SQL docs-corpus conformance: table sources", () => {
	// learn.microsoft.com/sql/t-sql/functions/vector-search-transact-sql (preview)
	it("parses VECTOR_SEARCH and TOP ... WITH APPROXIMATE", () => {
		expect(
			errorsOf(
				"SELECT TOP (10) s.id, r.distance FROM VECTOR_SEARCH(TABLE = dbo.sessions AS s, COLUMN = embedding, SIMILAR_TO = @qv, METRIC = 'cosine', TOP_N = 10) AS r ORDER BY r.distance",
			),
		).toBe(0);
		expect(
			errorsOf(
				"SELECT TOP (10) WITH APPROXIMATE t.id, r.distance FROM VECTOR_SEARCH(TABLE = dbo.a AS t, COLUMN = v, SIMILAR_TO = @qv, METRIC = 'cosine') AS r ORDER BY r.distance",
			),
		).toBe(0);
	});

	// learn.microsoft.com/sql/t-sql/functions/ai-generate-chunks-transact-sql
	// + ai-generate-embeddings-transact-sql (CHUNK_TYPE value is the bare keyword FIXED)
	it("parses AI_GENERATE_CHUNKS / AI_GENERATE_EMBEDDINGS", () => {
		expect(
			errorsOf(
				"SELECT c.chunk FROM docs_table AS t CROSS APPLY AI_GENERATE_CHUNKS (SOURCE = text_column, CHUNK_TYPE = FIXED, CHUNK_SIZE = 100) AS c",
			),
		).toBe(0);
		expect(
			errorsOf("SELECT id, AI_GENERATE_EMBEDDINGS(large_text USE MODEL MyAzureOpenAIModel) FROM myTable"),
		).toBe(0);
	});

	// learn.microsoft.com/sql/t-sql/queries/predict-transact-sql
	it("parses PREDICT(MODEL = ..., DATA = ... AS d) WITH (schema)", () => {
		expect(
			errorsOf(
				"SELECT d.*, p.Score FROM PREDICT(MODEL = @model, DATA = dbo.mytable AS d) WITH (Score FLOAT) AS p",
			),
		).toBe(0);
		expect(
			errorsOf(
				"SELECT d.*, p.Score FROM PREDICT(MODEL = (SELECT m FROM models), DATA = dbo.t AS d, RUNTIME = ONNX) WITH (Score FLOAT) AS p",
			),
		).toBe(0);
	});

	// learn.microsoft.com/sql/t-sql/functions/openrowset-transact-sql — provider form: the third
	// argument is a (up to 3-part) object or a query string; the datasource;uid;pwd triple is
	// semicolon-separated.
	it("parses the OPENROWSET provider form", () => {
		expect(
			errorsOf(
				"SELECT d.* FROM OPENROWSET('MSOLEDBSQL', 'Server=Seattle1;Trusted_Connection=yes;', Department) AS d",
			),
		).toBe(0);
		expect(
			errorsOf(
				"SELECT a.* FROM OPENROWSET('MSOLEDBSQL', 'Server=Seattle1;Trusted_Connection=yes;', AdventureWorks2022.HumanResources.Department) AS a",
			),
		).toBe(0);
		expect(
			errorsOf("SELECT * FROM OPENROWSET('Microsoft.Jet.OLEDB.4.0', 'C:\\db.mdb';'admin';'', Customers) AS c"),
		).toBe(0);
	});

	// learn.microsoft.com/sql/t-sql/functions/openrowset-bulk-transact-sql + the Synapse
	// serverless options (HEADER_ROW bare TRUE/FALSE, FORMAT, FIRSTROW) and the WITH schema with
	// json-path / ordinal column mappings; filename()/filepath() are methods on the row alias.
	it("parses OPENROWSET BULK with options, WITH schema, and alias methods", () => {
		expect(errorsOf("SELECT TOP 10 * FROM OPENROWSET(BULK 'https://x.blob.core.windows.net/p/*.parquet')")).toBe(0);
		expect(
			errorsOf(
				"SELECT * FROM OPENROWSET(BULK 'p.csv', DATA_SOURCE = 'ds', FORMAT = 'CSV', PARSER_VERSION = '2.0', HEADER_ROW = TRUE) AS r",
			),
		).toBe(0);
		expect(
			errorsOf(
				"SELECT r.filename() AS f, COUNT_BIG(*) AS rows FROM OPENROWSET(BULK 'csv/*.csv', DATA_SOURCE = 'ds', FORMAT = 'CSV', FIRSTROW = 2) WITH (C1 varchar(200)) AS r WHERE r.filename() IN ('a.csv') GROUP BY r.filename()",
			),
		).toBe(0);
		expect(
			errorsOf(
				"SELECT * FROM OPENROWSET(BULK 'latest/*.parquet', FORMAT = 'PARQUET') WITH (country varchar(50), [date] DATE '$.updated', cases INT 3, deaths INT '$.statistics.deaths') AS rows",
			),
		).toBe(0);
	});

	// learn.microsoft.com/sql/t-sql/functions/opendatasource-transact-sql — the first part of a
	// four-part name; intermediate parts may be omitted.
	it("parses OPENDATASOURCE(...).schema.object with omitted parts", () => {
		expect(
			errorsOf(
				"SELECT * FROM OPENDATASOURCE('MSOLEDBSQL', 'Server=Seattle1;Database=AdventureWorks2022;').HumanResources.Department ORDER BY GroupName",
			),
		).toBe(0);
	});
});

describe("T-SQL docs-corpus conformance: hints and clauses", () => {
	// learn.microsoft.com/sql/t-sql/queries/option-clause-transact-sql (LABEL: Synapse/PDW/Fabric)
	// + hints-transact-sql-query (FOR TIMESTAMP AS OF: Fabric warehouse time travel)
	it("parses OPTION (LABEL = ...), mixed hints, and FOR TIMESTAMP AS OF", () => {
		expect(errorsOf("SELECT * FROM FactResellerSales OPTION (LABEL = 'q17')")).toBe(0);
		expect(
			errorsOf(
				"SELECT COUNT(*) FROM a INNER JOIN b ON (a.k = b.k) OPTION (Label = 'CustJoin', HASH JOIN, MERGE JOIN)",
			),
		).toBe(0);
		expect(
			errorsOf(
				"SELECT OrderDateKey FROM f GROUP BY OrderDateKey OPTION (FOR TIMESTAMP AS OF '2024-03-13T19:39:35.28')",
			),
		).toBe(0);
	});

	// learn.microsoft.com/sql/t-sql/queries/option-clause-transact-sql ({FORCE|DISABLE}
	// EXTERNALPUSHDOWN) + hints-transact-sql-query (Fabric FORCE [SINGLE NODE|DISTRIBUTED] PLAN)
	it("parses EXTERNALPUSHDOWN and FORCE PLAN hints", () => {
		expect(errorsOf("SELECT ID FROM ext WHERE ID < 10 OPTION (FORCE EXTERNALPUSHDOWN)")).toBe(0);
		expect(errorsOf("SELECT ID FROM ext WHERE ID < 10 OPTION (DISABLE EXTERNALPUSHDOWN)")).toBe(0);
		expect(errorsOf("SELECT a FROM f OPTION (FORCE SINGLE NODE PLAN)")).toBe(0);
		expect(errorsOf("SELECT a FROM f OPTION (FORCE DISTRIBUTED PLAN)")).toBe(0);
	});

	// learn.microsoft.com/sql/t-sql/queries/hints-transact-sql-join — REDUCE | REPLICATE |
	// REDISTRIBUTE [(columns count)] (Synapse/PDW; the count argument is Fabric DW).
	it("parses REDUCE / REPLICATE / REDISTRIBUTE (n) join hints", () => {
		expect(errorsOf("SELECT * FROM DA INNER REDISTRIBUTE (4) JOIN DB ON DA.a1 = DB.b1")).toBe(0);
		expect(errorsOf("SELECT * FROM DA INNER REDUCE JOIN DB ON DA.a1 = DB.b1")).toBe(0);
		expect(errorsOf("SELECT * FROM DA INNER REPLICATE JOIN DB ON DA.a1 = DB.b1")).toBe(0);
	});

	// learn.microsoft.com/sql/t-sql/queries/select-group-by-transact-sql — () grand total,
	// ROLLUP/CUBE items, legacy WITH ROLLUP / WITH CUBE, () inside GROUPING SETS.
	it("parses GROUP BY () / ROLLUP(...) / legacy WITH ROLLUP", () => {
		expect(errorsOf("SELECT 3 FROM T GROUP BY ()")).toBe(0);
		expect(errorsOf("SELECT a, SUM(x) FROM t GROUP BY ROLLUP (a, b)")).toBe(0);
		expect(errorsOf("SELECT a, SUM(x) FROM t GROUP BY CUBE (a, b)")).toBe(0);
		expect(errorsOf("SELECT q, SUM(s), GROUPING(q) FROM t GROUP BY q WITH ROLLUP")).toBe(0);
		expect(errorsOf("SELECT q, SUM(s) FROM t GROUP BY q WITH CUBE")).toBe(0);
		expect(errorsOf("SELECT id, SUM(amount) FROM T GROUP BY GROUPING SETS((id), (type), (id, type), ())")).toBe(0);
	});

	// NOT here: ALTER DATABASE ... MODIFY (EDITION ...), ALTER WORKLOAD GROUP, DBCC FREEPROCCACHE
	// args. Those corpus files (statements_alter-database*/5, alter-workload-group/1,
	// dbcc-freeproccache/2) are mixed scripts whose payload is platform DDL/admin (cleared Out
	// of scope) that merely LEAD with a setup SELECT. The corpus path-bucketing reorg moved them
	// out of the query bucket (tools/organize-corpus.test.ts + tests/helpers/statement-bucket.ts);
	// they are not grammared in.
});

describe("T-SQL docs-corpus conformance: graph and lexical", () => {
	// learn.microsoft.com/sql/t-sql/queries/match-sql-graph
	it("parses MATCH graph patterns", () => {
		expect(
			errorsOf(
				"SELECT Person3.name FROM Person Person1, friend, Person Person2, friend friend2, Person Person3 WHERE MATCH(Person1-(friend)->Person2-(friend2)->Person3) AND Person1.name = 'Alice'",
			),
		).toBe(0);
		expect(errorsOf("SELECT a.name FROM Person a, friend, Person b WHERE MATCH(b<-(friend)-a)")).toBe(0);
	});

	it("parses SHORTEST_PATH with FOR PATH sources and GRAPH PATH aggregation", () => {
		expect(
			errorsOf(
				"SELECT Person1.name, STRING_AGG(Person2.name, '->') WITHIN GROUP (GRAPH PATH) AS Friends FROM Person AS Person1, friendOf FOR PATH AS fo, Person FOR PATH AS Person2 WHERE MATCH(SHORTEST_PATH(Person1(-(fo)->Person2){1,3})) AND Person1.name = 'Jacob'",
			),
		).toBe(0);
		expect(
			errorsOf(
				"SELECT 1 FROM Person AS p1, friendOf FOR PATH AS fo, Person FOR PATH AS p2 WHERE MATCH(SHORTEST_PATH(p1(-(fo)->p2)+))",
			),
		).toBe(0);
	});

	// learn.microsoft.com/sql/t-sql/functions/graph-id-from-node-id-transact-sql etc. —
	// $node_id/$edge_id/$from_id/$to_id pseudo-columns, bare and alias-qualified.
	it("parses graph pseudo-columns", () => {
		expect(errorsOf("SELECT GRAPH_ID_FROM_NODE_ID($node_id) FROM Person")).toBe(0);
		expect(errorsOf("SELECT GRAPH_ID_FROM_EDGE_ID($edge_id) FROM friendOf")).toBe(0);
		expect(errorsOf("SELECT P.$node_id FROM Person AS P")).toBe(0);
		expect(errorsOf("SELECT $from_id, $to_id FROM likes")).toBe(0);
	});

	// learn.microsoft.com/sql/t-sql/language-elements/sql-server-utilities-statements-backslash —
	// engine-side line continuation inside string and binary constants (applies to SQL Server,
	// Azure SQL DB/MI, Fabric SQL DB — NOT just sqlcmd, despite the page slug).
	it("parses backslash line continuation in binary and string constants", () => {
		expect(errorsOf("SELECT 0xabc\\\ndef AS [ColumnResult]")).toBe(0);
		expect(errorsOf("SELECT 'abc\\\ndef' AS [ColumnResult]")).toBe(0);
	});
});
