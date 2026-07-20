import { describe, expect, it } from "vitest";
import { analyze, parse } from "../src/index.js";
import { lower } from "../src/trino/lower.js";
import { parseTrino } from "../src/trino/parse.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";
import type { SelectExpr } from "../src/ir/ir.js";

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
		expect(ast.body.from.map((s) => (s.kind === "table" ? s.relation.parts.join(".") : s.kind))).toEqual([
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
		expect(t.body.kind === "select" && t.body.from[0]?.kind === "table" && t.body.from[0].relation.parts).toEqual([
			"nation",
		]);
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
		expect(
			ins.body.kind === "select" && ins.body.from[0]?.kind === "table" && ins.body.from[0].relation.parts,
		).toEqual(["u"]);
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

	// lowerQuery/lowerQueryNoWith's `query`/`queryNoWith`/`queryTerm` accessors are typed non-null
	// by the generated grammar (`this.getRuleContext(0, …)!`), but ANTLR's error recovery can abort
	// before reaching those children on truncated input — a `CREATE VIEW v AS`/`CREATE MATERIALIZED
	// VIEW v AS` with nothing following (root.query() null), or a `WITH` clause with no trailing main
	// query, e.g. `WITH r AS` / `WITH r AS (` / `WITH a AS (SELECT 1), b AS (` (query.queryNoWith()
	// or qnw.queryTerm() null). Removing lower()'s blanket try/catch (the api-hack-eradication wave)
	// surfaced these as real thrown TypeErrors through the public analyze()/parse() entry points —
	// exactly the mid-keystroke shape the living-document/editor mandate exists to survive. Confirmed
	// independently by QC review and reproduced directly; this pins the fix.
	it("truncated CREATE VIEW / WITH-with-no-main-query never throws (totality — QC finding on lowerQuery/lowerQueryNoWith)", () => {
		const broken = [
			// The originally reported repro strings.
			"WITH r AS (SELECT",
			"CREATE VIEW v AS",
			"CREATE MATERIALIZED VIEW v AS",
			"WITH a AS (SELECT 1), b AS (",
			// Closer truncation cuts of the same shape (found while sweeping — crashed pre-fix too).
			"WITH r AS",
			"WITH r AS (",
			"CREATE OR REPLACE VIEW v AS",
			"CREATE TABLE t AS",
			"INSERT INTO t SELECT",
			"WITH r AS (WITH x AS (SELECT",
		];
		for (const sql of broken) {
			expect(() => analyze(sql, "trino"), sql).not.toThrow();
			expect(() => parse(sql, "trino"), sql).not.toThrow();
		}
	});

	// Broader sweep: systematically truncate a wide range of query/statement shapes at plausible
	// mid-keystroke cut points. None of these are given repro cases — this is the "keep going and
	// find more" pass the task called for. All must survive through analyze()'s full pipeline.
	it("broad truncation sweep across query shapes never throws (totality)", () => {
		const broken = [
			"SELECT",
			"SELECT *",
			"SELECT * FROM",
			"SELECT * FROM t WHERE",
			"SELECT * FROM (SELECT",
			"SELECT * FROM t WHERE EXISTS (SELECT",
			"SELECT * FROM t WHERE x IN (SELECT",
			"SELECT * FROM t WHERE x = (SELECT",
			"SELECT * FROM t WHERE UNIQUE (SELECT",
			"SELECT * FROM LATERAL (SELECT",
			"WITH",
			"WITH r(a, b) AS (SELECT",
			"INSERT INTO t (a, b) SELECT",
			"CREATE TABLE t AS SELECT",
			"CREATE TABLE t AS WITH r AS (SELECT",
			"CREATE VIEW v AS SELECT",
			"CREATE VIEW v AS WITH r AS (SELECT",
			"CREATE MATERIALIZED VIEW v AS WITH r AS (SELECT",
			"SELECT 1 UNION",
			"SELECT 1 UNION SELECT",
			"(SELECT 1) UNION (SELECT",
			"SELECT 1 EXCEPT",
			"SELECT 1 INTERSECT",
			"SELECT * FROM t ORDER BY",
			"SELECT * FROM t LIMIT",
			"SELECT * FROM t OFFSET",
			"SELECT * FROM t FETCH FIRST",
			"SELECT * FROM t GROUP BY",
			"SELECT * FROM t HAVING",
			"SELECT * FROM t1 JOIN",
			"SELECT * FROM t1 JOIN t2 ON",
			"EXPLAIN SELECT",
			"EXPLAIN ANALYZE SELECT",
			"TABLE",
			"VALUES",
			"VALUES (",
			"WITH FUNCTION f() RETURNS int RETURN 1 SELECT",
			"SELECT * FROM UNNEST(",
			"",
		];
		for (const sql of broken) {
			expect(() => analyze(sql, "trino"), sql).not.toThrow();
		}
	});
});

// `?` is Trino's only bind-parameter form (trino.io/docs/current/sql/execute.html) — the CST's
// ParameterContext used to collapse to a hardcoded literal; this pins the `parameter` IR lowering
// (src/ir/ir.ts). Trino has no documented `variable` (session/local) form of its own.
function selectBody(sql: string): SelectExpr {
	const { tree, errors } = parseTrino(sql);
	expect(errors, sql).toBe(0);
	const ir = lower(tree);
	if (ir.body.kind !== "select") throw new Error(`expected a select body, got ${ir.body.kind}`);
	return ir.body;
}

describe("trino parameter references", () => {
	it("lowers `?` to a parameter node in SELECT and WHERE position, no name/ordinal", () => {
		const body = selectBody("SELECT ? FROM t WHERE a = ?");
		expect(body.projections[0].expr).toMatchObject({ kind: "parameter", text: "?" });
		expect((body.projections[0].expr as { name?: string }).name).toBeUndefined();
		expect((body.where as { right?: unknown }).right).toMatchObject({ kind: "parameter", text: "?" });
	});

	it("fires no unknown-column diagnostic on a schema-attached analyze", () => {
		const schema = new Schema({ t: { a: "bigint" } });
		const { diagnostics } = analyze("SELECT ?, a FROM t WHERE a = ?", "trino", { schema });
		expect(diagnostics).toEqual([]);
	});

	it("as a call argument, is an unknown-typed operand: no false call diagnostic", () => {
		const schema = new Schema({ t: { a: "bigint" } });
		const { diagnostics } = analyze("SELECT abs(?) FROM t", "trino", { schema });
		const kinds = diagnostics.map((d) => d.kind);
		expect(kinds).not.toContain("wrong-arity");
		expect(kinds).not.toContain("wrong-argument-type");
	});

	it("deriveSymbols emits a parameter kind, one Sym per occurrence", () => {
		const { tree } = parseTrino("SELECT ?, ? FROM t");
		const scopes = resolveScopes(lower(tree), "trino");
		const syms = deriveSymbols(scopes).filter((s) => s.kind === "parameter");
		expect(syms.map((s) => [s.kind, s.name])).toEqual([
			["parameter", "?"],
			["parameter", "?"],
		]);
		expect(syms.every((s) => s.modifiers.includes("reference"))).toBe(true);
	});
});
