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

	// Empty-bound slices with a step — the `::` in `[::2]` / `[1::2]` / `[::-1]` maximal-munches to
	// one TYPECAST token, so these previously bailed while the colon-separated `[:4:2]` / `[1:4:2]`
	// parsed. Both bounds are optional in `list[begin:end:step]` (functions/list.md#slicing). #13.
	it("empty-bound stepped slices [::2] [1::2] [:4:2] [::-1] parse (functions/list.md#slicing)", () => {
		ok("SELECT ([1, 2, 3, 4])[::2];");
		ok("SELECT ([1, 2, 3, 4])[1::2];");
		ok("SELECT ([1, 2, 3, 4])[:4:2];");
		ok("SELECT ([1, 2, 3, 4])[::-1];");
		// No-regression control: the colon-separated stepped slice is unchanged.
		ok("SELECT ([1, 2, 3, 4])[1:4:2];");
	});

	it("empty-bound slice lowers to a subscript with no fabricated bound (#13)", () => {
		const strip = (o: unknown) =>
			JSON.parse(
				JSON.stringify(o, (k, v) => (k === "cst" || k === "aliasCst" || k === "partSpans" ? undefined : v)),
			);
		const { ast } = parse("SELECT ([1, 2, 3, 4])[::2];", "duckdb");
		const expr = ast.body.kind === "select" ? ast.body.projections[0]?.expr : undefined;
		const e = strip(expr);
		expect(e.kind).toBe("subscript");
		// The absent begin/end are NOT fabricated into a 0/-1 — the whole slice is the opaque index
		// (same shape as the existing `[2:4:2]` lowering; no new bound literals invented).
		expect(e.index).toEqual({ kind: "literal", text: "[::2]" });
	});

	it("string-literal method receiver 'abc'.upper() lowers to upper('abc') (#13)", () => {
		const strip = (o: unknown) =>
			JSON.parse(
				JSON.stringify(o, (k, v) => (k === "cst" || k === "aliasCst" || k === "partSpans" ? undefined : v)),
			);
		ok("SELECT 'abc'.upper();");
		const { ast } = parse("SELECT 'abc'.upper();", "duckdb");
		const expr = ast.body.kind === "select" ? ast.body.projections[0]?.expr : undefined;
		expect(strip(expr)).toEqual({
			kind: "function",
			name: "upper",
			args: [{ kind: "literal", text: "'abc'" }],
			aggregate: false,
			distinct: false,
		});
		// No-regression control: the parenthesized receiver still lowers to a method call.
		const { ast: paren } = parse("SELECT ('hello').upper();", "duckdb");
		const pe = paren.body.kind === "select" ? paren.body.projections[0]?.expr : undefined;
		expect(strip(pe).name).toBe("upper");
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

	// A bare (AS-less) SEMI/ANTI/ASOF/POSITIONAL before JOIN is the JOIN keyword, never the left
	// table's alias. DuckDB categorizes these four as type_func_name keywords (libpg_query
	// type_name_keywords.list), excluded from ColId and thus never a bare alias — so `FROM a SEMI
	// JOIN b` is a SEMI join, not `a AS semi INNER JOIN b`. (duckdb/duckdb
	// third_party/libpg_query grammar/statements/{select.y joined_table, common.y ColId}.)
	it("bare SEMI/ANTI/ASOF/POSITIONAL before JOIN read as the join, no alias on the left table", () => {
		const join0 = (sql: string) => {
			const { ast } = parse(sql, "duckdb");
			return ast.body.kind === "select" ? ast.body.joins?.[0] : undefined;
		};
		const from0 = (sql: string) => {
			const { ast } = parse(sql, "duckdb");
			return ast.body.kind === "select" ? ast.body.from[0] : undefined;
		};
		expect(join0("SELECT * FROM a SEMI JOIN b ON a.x = b.x")?.kind).toBe("semi");
		expect(join0("SELECT * FROM a ANTI JOIN b ON a.x = b.x")?.kind).toBe("anti");
		expect(join0("SELECT * FROM a ASOF JOIN b ON a.x >= b.x")?.kind).toBe("asof");
		expect(join0("SELECT * FROM a POSITIONAL JOIN b")?.kind).toBe("positional");
		// the left table keeps NO alias — the keyword is no longer swallowed as one
		expect(from0("SELECT * FROM a SEMI JOIN b ON a.x = b.x")?.alias).toBeUndefined();
		expect(from0("SELECT * FROM a ANTI JOIN b ON a.x = b.x")?.alias).toBeUndefined();
		expect(from0("SELECT * FROM a ASOF JOIN b ON a.x >= b.x")?.alias).toBeUndefined();
		// same for function-table and subquery left sources (bare alias via alias_clause/colid)
		expect(join0("SELECT * FROM range(3) SEMI JOIN b ON range = b.x")?.kind).toBe("semi");
		expect(from0("SELECT * FROM range(3) SEMI JOIN b ON range = b.x")?.alias).toBeUndefined();
		expect(join0("SELECT * FROM (SELECT 1) ANTI JOIN b ON true")?.kind).toBe("anti");
		// a func-table WITH an alias + column list is unaffected (alias binds, not swallowed)
		expect(from0("SELECT * FROM generate_series(1, 3) tbl(i)")?.alias).toBe("tbl");
	});

	it("positive controls: explicit AS keeps the keyword as an alias; column and plain-alias use unaffected", () => {
		const from0 = (sql: string) => {
			const { ast } = parse(sql, "duckdb");
			return ast.body.kind === "select" ? ast.body.from[0] : undefined;
		};
		// explicit AS is unambiguous — the keyword IS the alias there (kept legal by the fork's
		// permissive superset; the full unreserved set stays reachable via AS)
		expect(from0("SELECT * FROM t AS semi")?.alias).toBe("semi");
		expect(from0("SELECT * FROM t AS anti")?.alias).toBe("anti");
		// keyword in column position is unaffected (still an unreserved_keyword)
		ok("SELECT semi FROM t");
		// a plain non-keyword bare alias still binds
		expect(from0("SELECT * FROM t semi2")?.alias).toBe("semi2");
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

	it("UNION BY NAME sets byName on the setop IR node; plain UNION does not", () => {
		const byName = lower(parseDuckdb("SELECT a, b FROM t UNION ALL BY NAME SELECT b, a FROM u;").tree);
		expect(byName.body.kind === "setop" && byName.body.byName).toBe(true);

		const plain = lower(parseDuckdb("SELECT a, b FROM t UNION ALL SELECT b, a FROM u;").tree);
		expect(plain.body.kind === "setop" && plain.body.byName).toBeUndefined();
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

// SLL→LL fallback surgery — each probe pins a construct that now predicts under SLL (no LL
// fallback) after a grammar edit, plus the IR/rejection invariants that guard the edit.
describe("duckdb SLL-surgery — no LL fallback on the cured shapes", () => {
	const noFallback = (sql: string) => expect(parseDuckdb(sql).sllFallback, sql).toBe(false);
	const projExpr = (sql: string) => {
		const { ast } = parse(sql, "duckdb");
		return (ast.body as { projections?: Array<{ expr: unknown }> }).projections?.[0]?.expr as {
			kind: string;
			name?: string;
			args?: Array<{ kind: string; parts?: string[] }>;
		};
	};

	it("c_expr — plain function calls f(args) predict under SLL (plain/dotted func_expr split)", () => {
		// Cured STRUCTURALLY, not by ordering: the old func_expr is split into plain_func_expr (undotted
		// name + required parens — disjoint from columnref on a full match by construction, so it sits
		// above it) and dotted_func_expr (below columnref, preserving the method-chain resolution). The
		// earlier func_expr-above-columnref reorder was REVERTED (Task-5 review: it flipped the reading
		// of ALIASED dotted calls — see the method-chain guard below).
		for (const sql of [
			"SELECT f(1)",
			"SELECT f(1, 2)",
			"SELECT concat('value is ', b)",
			"SELECT getenv('HOME') AS home",
			"SELECT a, f(1), g(x, y)",
			"SELECT mod(x, 2) = 0 FROM t",
			"SELECT count(*) FILTER (WHERE x > 1) FROM t",
			"SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY x) FROM t",
			"SELECT LEFT(x, 1), RIGHT(x, 1) FROM t",
		]) {
			ok(sql);
			noFallback(sql);
		}
		expect(projExpr("SELECT f(1)")).toMatchObject({ kind: "function", name: "f" });
		// The name comes from the application's own direct name child, never a nested one — a typed
		// literal argument must not hijack the call name (strftime, not date).
		expect(projExpr("SELECT strftime(DATE '1992-03-02', '%d/%m/%Y')")).toMatchObject({
			kind: "function",
			name: "strftime",
		});
	});

	it("c_expr — the method-chain reading wins in EVERY follow context (MANDATORY guard)", () => {
		// DuckDB's `.attr(args)` method indirection means a dotted call `x.f(a)` is a GENUINE ambiguity:
		// it full-matches both columnref (method chain) and func_expr (qualified call, func_name matching
		// `x.f` non-greedily). The project convention is the method chain — `x.f(a)` → f(x, a), receiver
		// first. A c_expr reorder that puts func_expr above columnref flips the reading for ALIASED
		// dotted calls (`sch.f(a) AS score` lowered to f(a), the receiver silently dropped) while leaving
		// unaliased follows intact — exactly how Task 5's first attempt broke (review REJECT, reverted).
		// These probes pin the reading across every follow context and must stay green forever,
		// regardless of any future c_expr reordering.
		const recv = (parts: string[]) => ({ kind: "column", parts });

		// AS alias — the follow context the broken reorder flipped.
		expect(projExpr("SELECT sch.f(a) AS score")).toMatchObject({
			kind: "function",
			name: "f",
			args: [recv(["sch"]), recv(["a"])],
		});
		// Bare-word alias.
		expect(projExpr("SELECT sch.f(a) score")).toMatchObject({
			kind: "function",
			name: "f",
			args: [recv(["sch"]), recv(["a"])],
		});
		// Chained method call with alias — the inner chain must survive: g(f(x, a), b).
		expect(projExpr("SELECT x.f(a).g(b) AS r")).toMatchObject({
			kind: "function",
			name: "g",
			args: [{ kind: "function", name: "f", args: [recv(["x"]), recv(["a"])] }, recv(["b"])],
		});
		// Zero-arg chain with alias.
		expect(projExpr("SELECT col.lower() AS l")).toMatchObject({
			kind: "function",
			name: "lower",
			args: [recv(["col"])],
		});
		// Comma follow.
		expect(projExpr("SELECT sch.f(a), b")).toMatchObject({
			kind: "function",
			name: "f",
			args: [recv(["sch"]), recv(["a"])],
		});
		// FROM follow.
		expect(projExpr("SELECT sch.f(a) FROM t")).toMatchObject({
			kind: "function",
			name: "f",
			args: [recv(["sch"]), recv(["a"])],
		});
		// EOF follow.
		expect(projExpr("SELECT sch.f(a)")).toMatchObject({
			kind: "function",
			name: "f",
			args: [recv(["sch"]), recv(["a"])],
		});
		expect(projExpr("SELECT col.lower()")).toMatchObject({
			kind: "function",
			name: "lower",
			args: [recv(["col"])],
		});
		// A plain dotted path stays a column, not a call.
		expect(projExpr("SELECT x.y.z")).toMatchObject({ kind: "column", parts: ["x", "y", "z"] });
	});

	it("c_expr — typed literals predict under SLL (ported postgres aexprconst reorder)", () => {
		// aexprconst ordered above func_expr/columnref: `DATE '…'` / `f(1) '5'` used to bail on the
		// trailing string constant. The identifier-led aexprconst forms REQUIRE that trailing sconst, so
		// they stay disjoint from a bare call / column.
		for (const sql of [
			"SELECT DATE '1992-09-20'",
			"SELECT TIMESTAMP '2001-02-16 20:38:40'",
			"SELECT INTERVAL '1 month 1 day'",
			"SELECT decimal '3.14'",
			"SELECT a FROM t WHERE d > DATE '2000-01-01'",
		]) {
			ok(sql);
			noFallback(sql);
		}
		// The trailing-sconst requirement is real: a bare call with a stray string still rejects.
		expect(parseDuckdb("SELECT count(*) '5'").errors).toBeGreaterThan(0);
		expect(parseDuckdb("SELECT f() '5'").errors).toBeGreaterThan(0);
		// A plain call and a plain column still lower unchanged (aexprconst dropped out for them).
		expect(projExpr("SELECT f(1)")).toMatchObject({ kind: "function", name: "f" });
	});
});
