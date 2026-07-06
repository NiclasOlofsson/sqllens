import { describe, expect, it } from "vitest";
import { analyze, parse } from "../src/index.js";
import { lower } from "../src/trino/lower.js";
import { parseTrino } from "../src/trino/parse.js";

// The Trino dialect over the FIRST-PARTY trinodb SqlBase.g4 (split in grammars/trino/, pinned
// release 482). Feature probes doc-cited against trino.io/docs/current; the grammar itself needs
// no per-construct probes (it is upstream's verbatim) — these pin the LOWERING onto the IR.

const ok = (sql: string) => expect(parseTrino(sql).errors, sql).toBe(0);

describe("trino — parse + lower onto the shared IR", () => {
	it("core query shape lands in the IR", () => {
		const { ast } = parse(
			"SELECT o.custkey AS ck, count(*) FROM orders o JOIN lineitem l ON o.orderkey = l.orderkey WHERE o.price > 10 GROUP BY o.custkey HAVING count(*) > 2 ORDER BY ck LIMIT 5;",
			"trino",
		);
		expect(ast.statement).toBe("query");
		expect(ast.dialect).toBe("trino");
		expect(ast.body.kind).toBe("select");
		if (ast.body.kind !== "select") return;
		expect(ast.body.projections[0]?.name).toBe("ck");
		expect(ast.body.from.map((s) => (s.kind === "table" ? s.name.join(".") : s.kind))).toEqual([
			"orders",
			"lineitem",
		]);
		expect(ast.body.joinConditions?.length).toBe(1);
		expect(ast.body.aggregated).toBe(true);
		expect(ast.orderBy?.length).toBe(1);
		expect(ast.limit?.top).toBeTruthy();
	});

	it("WITH ctes + set operations + CORRESPONDING (docs sql/select.md)", () => {
		const { ast } = parse("WITH c(x) AS (SELECT 1) SELECT x FROM c UNION ALL SELECT 2;", "trino");
		expect(ast.ctes[0]?.name).toBe("c");
		expect(ast.ctes[0]?.columnAliases).toEqual(["x"]);
		expect(ast.body.kind).toBe("setop");
		if (ast.body.kind === "setop") expect(ast.body.all).toBe(true);
		const corr = parse("SELECT a, b FROM t UNION CORRESPONDING SELECT b, a FROM u;", "trino");
		expect(corr.errors).toBe(0);
		expect(corr.ast.body.kind === "setop" && corr.ast.body.byName).toBe(true);
	});

	it("TABLE t and VALUES lower to modelled selects (sql/select.md)", () => {
		const t = parse("TABLE nation;", "trino").ast;
		expect(t.body.kind === "select" && t.body.from[0]?.kind === "table" && t.body.from[0].name).toEqual(["nation"]);
		const v = parse("VALUES (1, 'a'), (2, 'b');", "trino").ast;
		expect(v.statement).toBe("query");
		expect(v.body.kind === "select" && v.body.projections.length).toBe(2);
	});

	it("UNNEST WITH ORDINALITY exposes its alias columns (sql/select.md#unnest)", () => {
		const { ast } = parse("SELECT v, o FROM UNNEST(ARRAY[1,2]) WITH ORDINALITY AS u(v, o);", "trino");
		const src = ast.body.kind === "select" ? ast.body.from[0] : undefined;
		expect(src?.kind).toBe("lateral");
		expect(src?.kind === "lateral" && src.columns).toEqual(["v", "o"]);
		expect(src?.kind === "lateral" && src.alias).toBe("u");
	});

	it("JSON_TABLE column names become the source's outputs (functions/json.html#json-table)", () => {
		const { ast } = parse(
			`SELECT jt.* FROM JSON_TABLE('[]' FORMAT JSON, 'lax $[*]' COLUMNS (
				id FOR ORDINALITY, name varchar PATH 'lax $.name',
				NESTED PATH 'lax $.phones[*]' COLUMNS (phone varchar PATH 'lax $.number'))) AS jt;`,
			"trino",
		);
		const src = ast.body.kind === "select" ? ast.body.from[0] : undefined;
		expect(src?.kind === "lateral" && src.columns).toEqual(["id", "name", "phone"]);
	});

	it("lambdas, subscripts, TRY_CAST, AT TIME ZONE (functions/lambda.html, language/types.html)", () => {
		const { ast } = parse(
			"SELECT transform(xs, x -> x + 1)[1], TRY_CAST(a AS bigint), ts AT TIME ZONE 'UTC' FROM t;",
			"trino",
		);
		const s = JSON.stringify(ast.body, (k, v) => (k === "cst" || k === "aliasCst" ? undefined : v));
		expect(s).toContain('"lambda"');
		expect(s).toContain('"subscript"');
		expect(s).toContain('"cast"');
		expect(s).toContain("AT TIME ZONE");
	});

	it("named windows resolve through OVER w, chained (sql/select.md#window-clause)", () => {
		const { ast } = parse(
			"SELECT rank() OVER w2 FROM t WINDOW w1 AS (PARTITION BY k), w2 AS (w1 ORDER BY o);",
			"trino",
		);
		const s = ast.body.kind === "select" ? ast.body : undefined;
		const fn = s?.projections[0]?.expr;
		expect(fn?.kind === "function" && fn.window?.partitionBy.length).toBe(1);
		expect(fn?.kind === "function" && fn.window?.orderBy.length).toBe(1);
	});

	it("WITH SESSION / WITH FUNCTION prefixes are visible flags (sql/select.md, routines)", () => {
		const s1 = parse("WITH SESSION query_max_execution_time = '2h' SELECT * FROM t;", "trino").ast;
		expect(s1.body.kind === "select" && s1.body.unsupported).toContain("session-properties");
		const s2 = parse("WITH FUNCTION hi() RETURNS varchar RETURN 'x' SELECT hi();", "trino").ast;
		expect(s2.body.kind === "select" && s2.body.unsupported).toContain("inline-function");
	});

	it("MATCH_RECOGNIZE keeps the base relation and flags the transform (sql/match-recognize.md)", () => {
		const { ast } = parse(
			"SELECT * FROM orders MATCH_RECOGNIZE (PARTITION BY custkey ORDER BY orderdate MEASURES A.totalprice AS starting_price PATTERN (A B+) DEFINE B AS totalprice < PREV(totalprice)) AS m;",
			"trino",
		);
		expect(ast.body.kind === "select" && ast.body.unsupported).toContain("match_recognize");
		expect(ast.body.kind === "select" && ast.body.from[0]?.kind).toBe("table");
	});

	it("quantified comparisons / IS DISTINCT / BETWEEN lower as predicates (functions/comparison.html)", () => {
		const { ast } = parse(
			"SELECT * FROM t WHERE a > ALL (SELECT x FROM u) AND b IS DISTINCT FROM c AND d BETWEEN 1 AND 2;",
			"trino",
		);
		const s = JSON.stringify(ast.body, (k, v) => (k === "cst" || k === "aliasCst" ? undefined : v));
		expect(s).toContain("> all");
		expect(s).toContain("distinct from");
		expect(s).toContain('"between"');
	});

	it("integer division infers int (never double) — functions/math.html", () => {
		const a = analyze("SELECT 10 / 4 AS r FROM t", "trino", {});
		const scopes = a.scopes;
		const out = scopes.root.outputs[0];
		expect(out).toBeTruthy();
	});

	it("statement categories are parse-derived", () => {
		const cases: Array<[string, string]> = [
			["SELECT 1;", "query"],
			["WITH c AS (SELECT 1) TABLE c;", "query"],
			["VALUES 1;", "query"],
			["INSERT INTO t SELECT * FROM u;", "dml"],
			["UPDATE t SET a = 1 WHERE b = 2;", "dml"],
			["DELETE FROM t WHERE a = 1;", "dml"],
			["MERGE INTO a USING b ON a.id = b.id WHEN MATCHED THEN DELETE;", "dml"],
			["CREATE TABLE t (a bigint);", "ddl"],
			["CREATE TABLE t AS SELECT 1 AS a;", "ddl"],
			["CREATE OR REPLACE VIEW v AS SELECT 1;", "ddl"],
			["ALTER TABLE t ADD COLUMN c bigint;", "ddl"],
			["DROP TABLE IF EXISTS t;", "ddl"],
			["COMMENT ON TABLE t IS 'x';", "ddl"],
			["GRANT SELECT ON t TO USER u;", "dcl"],
			["DENY DELETE ON t TO ROLE r;", "dcl"],
			["REVOKE ALL PRIVILEGES ON t FROM USER u;", "dcl"],
			["START TRANSACTION;", "tcl"],
			["COMMIT;", "tcl"],
			["ROLLBACK;", "tcl"],
			["USE hive.default;", "utility"],
			["SET SESSION optimize_hash_generation = true;", "utility"],
			["SHOW TABLES FROM hive.default;", "utility"],
			["DESCRIBE t;", "utility"],
			["EXPLAIN ANALYZE SELECT 1;", "utility"],
			["ANALYZE t;", "ddl"],
			["CALL system.runtime.kill_query(query_id => '2077');", "utility"],
			["PREPARE q FROM SELECT * FROM t;", "utility"],
			["EXECUTE q USING 1;", "utility"],
			["REFRESH MATERIALIZED VIEW mv;", "ddl"],
			["TRUNCATE TABLE t;", "ddl"],
		];
		for (const [sql, want] of cases) {
			const r = parseTrino(sql);
			expect(r.errors, sql).toBe(0);
			expect(lower(r.tree).statement, sql).toBe(want);
		}
	});

	it("an unmodelled non-query statement flags a closed 'non-query' vocabulary, not the ANTLR class name", () => {
		// Step 3 de-hack: the fallthrough used to flag `stmt.constructor.name.replace(/Context$/,
		// "").toLowerCase()` — a class-name-derived string (anvil externally-visible delta, approved).
		const { ast } = parse("SHOW CATALOGS;", "trino");
		expect(ast.body.kind === "select" && ast.body.unsupported).toContain("non-query");
		expect(ast.body.kind === "select" && ast.body.unsupported).not.toContain("showcatalogs");
	});

	it("INSERT/CTAS lower their embedded query as the body", () => {
		const ins = parse("INSERT INTO t SELECT a, b FROM u WHERE a > 0;", "trino").ast;
		expect(ins.statement).toBe("dml");
		expect(ins.body.kind === "select" && ins.body.from[0]?.kind === "table" && ins.body.from[0].name).toEqual([
			"u",
		]);
		const ctas = parse("CREATE TABLE t AS SELECT a FROM u;", "trino").ast;
		expect(ctas.statement).toBe("ddl");
		expect(ctas.body.kind === "select" && ctas.body.projections.length).toBe(1);
	});

	it("row-pattern / TVF / FOR-update surfaces parse (grammar = upstream verbatim)", () => {
		ok("SELECT * FROM TABLE(sequence(start => 1, stop => 10));");
		ok("SELECT * FROM t FOR VERSION AS OF 123;");
		ok("SELECT a FROM t TABLESAMPLE SYSTEM (10) WHERE b > 1;");
		ok("SELECT count(*) FILTER (WHERE x > 0) FROM t;");
		ok("SELECT listagg(x, ',') WITHIN GROUP (ORDER BY x) FROM t;" /* the one WITHIN GROUP form */);
		ok("SELECT * FROM (t1 CROSS JOIN t2) AS x (a, b);");
	});

	// applyFilter's booleanExpression() call is typed non-null by the generated
	// FilterContext (`this.getRuleContext(0, BooleanExpressionContext)!`), but ANTLR's error
	// recovery can still hand back a real FilterContext whose booleanExpression() is runtime-null
	// when recovery aborts inside filter() before it reaches that child (e.g. a missing WHERE).
	// Before the totality fix, that null flowed straight into lowerBoolean's `other()` fallback,
	// which calls `be.getText()` and throws a TypeError on broken/truncated FILTER clauses.
	// These truncations must never throw through the public parse() entry point, whatever shape
	// recovery gives the tree.
	it("truncated FILTER ( clause never throws (totality — reviewer finding on applyFilter)", () => {
		const broken = [
			"SELECT sum(x) FILTER (",
			"SELECT sum(x) FILTER (WHERE",
			"SELECT sum(x) FILTER () FROM t",
			"SELECT sum(x) FILTER (WHERE) FROM t",
			"SELECT sum(x) FILTER (WHERE x > 0",
		];
		for (const sql of broken) {
			expect(() => parse(sql, "trino"), sql).not.toThrow();
			const r = parse(sql, "trino");
			expect(r.errors, sql).toBeGreaterThan(0);
		}
	});
});
