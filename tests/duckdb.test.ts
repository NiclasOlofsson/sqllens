import { describe, expect, it } from "vitest";
import { parse } from "../src/index.js";
import { lower } from "../src/duckdb/lower.js";
import { parseDuckdb } from "../src/duckdb/parse.js";

// The DuckDB surface built onto the Postgres-derived fork, each addition doc-cited at its
// grammar rule (duckdb.org/docs/current) and asserted here — parse AND, where the IR models it,
// the lowered shape.

const ok = (sql: string) => expect(parseDuckdb(sql).errors, sql).toBe(0);

describe("duckdb grammar — fork additions (doc-cited)", () => {
	it("FROM-first queries synthesize a star projection (from.md#from-first-syntax)", () => {
		ok("FROM tbl;");
		ok("FROM tbl SELECT a, b WHERE a > 1;");
		const { ast } = parse("FROM tbl;", "duckdb");
		expect(ast.statement).toBe("query");
		expect(ast.body.kind === "select" && ast.body.projections[0]?.isStar).toBe(true);
		expect(ast.body.kind === "select" && ast.body.from[0]?.kind).toBe("table");
	});

	it("prefix aliases in SELECT and FROM (select.md#prefix-aliases)", () => {
		const { ast } = parse("SELECT total: count(*) FROM t: my_table;", "duckdb");
		expect(ast.body.kind === "select" && ast.body.projections[0]?.name).toBe("total");
		expect(ast.body.kind === "select" && ast.body.from[0]?.alias).toBe("t");
	});

	it("star EXCLUDE rides the star; REPLACE/RENAME/LIKE parse (expressions/star.md)", () => {
		const { ast } = parse("SELECT * EXCLUDE (a, b) FROM t;", "duckdb");
		expect(
			ast.body.kind === "select" &&
				ast.body.projections[0]?.expr.kind === "star" &&
				ast.body.projections[0].expr.exclude,
		).toEqual(["a", "b"]);
		ok("SELECT * REPLACE (a / 100 AS a) FROM t;");
		ok("SELECT * RENAME (a AS b) FROM t;");
		ok("SELECT * LIKE 'col%' FROM t;");
		ok("SELECT * NOT SIMILAR TO 'col.' FROM t;");
		ok("SELECT s.* EXCLUDE ('y') FROM (SELECT {'x': 1, 'y': 2} AS s);");
	});

	it("COLUMNS() incl. unpacking (expressions/star.md#columns-expression)", () => {
		ok("SELECT COLUMNS('valid.*') FROM t;");
		ok("SELECT min(COLUMNS(*)) FROM t;");
		ok("SELECT COLUMNS(c -> c LIKE '%num%') FROM t;");
		ok("SELECT coalesce(*COLUMNS(*)) AS result FROM t;");
		ok("SELECT COLUMNS('(\\w{3}).*') AS '\\1' FROM numbers;");
	});

	it("QUALIFY filters window results (query_syntax/qualify.md)", () => {
		const { ast } = parse("SELECT * FROM t QUALIFY row_number() OVER (ORDER BY x) = 1;", "duckdb");
		expect(ast.body.kind === "select" && ast.body.qualify !== undefined).toBe(true);
	});

	it("GROUP BY ALL / ORDER BY ALL (groupby.md, orderby.md)", () => {
		const { ast } = parse("SELECT city, count(*) FROM t GROUP BY ALL;", "duckdb");
		expect(ast.body.kind === "select" && ast.body.aggregated).toBe(true);
		ok("SELECT * FROM t ORDER BY ALL DESC;");
	});

	it("list/struct/map literals, comprehensions, slicing (data_types/list.md, struct.md, map.md)", () => {
		ok("SELECT [1, 2, 3,] AS l, {'a': 1, 'b': 2} AS s, MAP {1: 'one'} AS m;");
		ok("SELECT [x * 2 FOR x IN [1, 2, 3] IF x > 1];");
		ok("SELECT ([1, 2, 3, 4, 5])[2:4:2], l[-1] FROM t;");
		ok("SELECT ([1, 2, 3, 4, 5])[:-:2];");
	});

	it("lambda keyword form lowers to an IR lambda (functions/lambda.md)", () => {
		const { ast } = parse("SELECT list_transform([1, 2], lambda x: x + 1);", "duckdb");
		const s = JSON.stringify(ast.body, (k, v) => (k === "cst" || k === "aliasCst" ? undefined : v));
		expect(s).toContain('"lambda"');
	});

	it("method chaining x.f(y) becomes f(x, y) (functions/overview.md#function-chaining)", () => {
		const { ast } = parse("SELECT ('hello').upper();", "duckdb");
		const s = JSON.stringify(ast.body, (k, v) => (k === "cst" || k === "aliasCst" ? undefined : v));
		expect(s).toContain('"upper"');
	});

	it("FROM 'file.parquet' is a table source named by the file (data/overview.md)", () => {
		const { ast } = parse("SELECT * FROM 'data/my.parquet';", "duckdb");
		expect(ast.body.kind === "select" && ast.body.from[0]?.kind === "table" && ast.body.from[0].name).toEqual([
			"data/my.parquet",
		]);
	});

	it("ASOF / POSITIONAL / SEMI / ANTI joins (query_syntax/from.md)", () => {
		ok("SELECT * FROM a ASOF JOIN b ON a.t >= b.t;");
		ok("SELECT * FROM a ASOF LEFT JOIN b ON a.k = b.k AND a.t >= b.t;");
		ok("SELECT * FROM a POSITIONAL JOIN b;");
		ok("SELECT * FROM a SEMI JOIN b ON a.k = b.k;");
		ok("SELECT * FROM a ANTI JOIN b ON a.k = b.k;");
	});

	it("sampling and LIMIT n% (samples.md, limit.md)", () => {
		ok("SELECT * FROM t USING SAMPLE 10%;");
		ok("SELECT * FROM t USING SAMPLE 10 PERCENT (bernoulli);");
		ok("SELECT * FROM t USING SAMPLE reservoir(50 ROWS) REPEATABLE (100);");
		ok("SELECT * FROM t TABLESAMPLE 10%;");
		ok("SELECT * FROM t LIMIT 10%;");
	});

	it("UNION BY NAME (setops.md#union-all-by-name)", () => {
		ok("SELECT a, b FROM x UNION ALL BY NAME SELECT b, a FROM y;");
	});

	it("PIVOT/UNPIVOT statements are queries with a visible flag (pivot.md, unpivot.md)", () => {
		const { ast } = parse("PIVOT cities ON year USING sum(population) GROUP BY country;", "duckdb");
		expect(ast.statement).toBe("query");
		expect(ast.body.kind === "select" && ast.body.unsupported).toEqual(["pivot"]);
		ok("UNPIVOT monthly_sales ON jan, feb INTO NAME month VALUE sales;");
		ok("WITH p AS (PIVOT cities ON year USING sum(population) GROUP BY country) SELECT * FROM p;");
		ok("SELECT * FROM cities PIVOT (sum(population) FOR year IN (2000, 2010) GROUP BY country);");
		ok(`SELECT * FROM cities PIVOT (sum(population) AS total, count(population) AS count
			FOR year IN (2000, 2010) country IN ('NL', 'US'));`);
	});

	it("recursive CTE USING KEY (with.md#using-key)", () => {
		ok(`WITH RECURSIVE tbl(a, b) USING KEY (a) AS (
			SELECT a, b FROM t UNION ALL SELECT a + 1, b FROM tbl WHERE a < 3) SELECT * FROM tbl;`);
	});

	it("INTERVAL expr units and underscore numerics (interval.md, literal_types.md)", () => {
		ok("SELECT INTERVAL 1 YEAR, INTERVAL (random() * 10) MONTH, INTERVAL 3 DAYS;");
		ok("SELECT 1_000_000, 95_000.5;");
	});

	it("GLOB and same-line string concatenation (pattern_matching.md, literal_types.md)", () => {
		ok("SELECT 'Best.txt' GLOB '*.txt';");
		ok("SELECT 'Hello' ' ' 'World' AS greeting;");
	});

	it("prepared-statement parameters ? and $name (prepared_statements.md)", () => {
		ok("SELECT min(grade) FROM grades WHERE course = ?;");
		ok("SELECT * FROM t WHERE a = $1 AND b = $my_param;");
	});

	it("DuckDB statements classify parse-derived", () => {
		const cases: Array<[string, string]> = [
			["ATTACH 'file.db' AS db1;", "utility"],
			["USE db1;", "utility"],
			["INSTALL httpfs;", "utility"],
			["FORCE INSTALL spatial FROM core_nightly;", "utility"],
			["PRAGMA memory_limit='1GB';", "utility"],
			["SUMMARIZE tbl;", "utility"],
			["DESCRIBE SELECT 1;", "utility"],
			["SET VARIABLE x = MAP {'k': 10};", "utility"],
			["RESET VARIABLE x;", "utility"],
			["EXPORT DATABASE 'dir' (FORMAT parquet);", "utility"],
			["UPDATE EXTENSIONS;", "utility"],
			["CREATE MACRO add(a, b) AS a + b;", "ddl"],
			["CREATE OR REPLACE TEMP MACRO t8(x) AS TABLE FROM tbl WHERE c = x;", "ddl"],
			["CREATE SECRET (TYPE s3, KEY_ID 'k', SECRET 's');", "ddl"],
			["CREATE OR REPLACE TABLE t AS FROM u LIMIT 0;", "ddl"],
			["CREATE TYPE mood AS ENUM ('happy', 'sad');", "ddl"],
			["INSERT OR IGNORE INTO tbl (i) VALUES (1);", "dml"],
			["INSERT INTO tbl BY POSITION (b, a) VALUES (5, 42);", "dml"],
			["MERGE INTO p USING (SELECT 1 AS id) AS u USING (id) WHEN MATCHED THEN UPDATE;", "dml"],
			["COPY tbl TO 't.parquet' (ENCRYPTION_CONFIG {footer_key: 'k'});", "dml"],
			["UNPIVOT t ON a, b INTO NAME k VALUE v;", "query"],
		];
		for (const [sql, want] of cases) {
			const r = parseDuckdb(sql);
			expect(r.errors, sql).toBe(0);
			expect(lower(r.tree).statement, sql).toBe(want);
		}
	});
});
