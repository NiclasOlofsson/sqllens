import { describe, expect, it } from "vitest";
import { parse } from "../src/index.js";
import { lower } from "../src/postgres/lower.js";
import { parsePostgres } from "../src/postgres/parse.js";

// The PostgreSQL grammar additions made in this fork, each doc-cited at its grammar rule and
// asserted here so a regen/regression is caught: WITH RECURSIVE SEARCH/CYCLE (§7.8.2), the
// SQL/JSON surface (IS JSON §9.16.1, JSON_TABLE §9.16.2), the PG15-18 MERGE, newline string
// continuation (§4.1.2.1), and the two upstream fixes (JSON_QUERY wrapper optionality, bare
// KEEP/OMIT QUOTES).

const ok = (sql: string) => expect(parsePostgres(sql).errors, sql).toBe(0);
const bad = (sql: string) => expect(parsePostgres(sql).errors, sql).toBeGreaterThan(0);

describe("postgres grammar — fork additions (doc-cited)", () => {
	it("WITH RECURSIVE … SEARCH/CYCLE (§7.8.2.1/7.8.2.2)", () => {
		ok(`WITH RECURSIVE t(id, link) AS (SELECT 1, 2 UNION ALL SELECT id, link FROM t)
			SEARCH DEPTH FIRST BY id SET ordercol SELECT * FROM t ORDER BY ordercol;`);
		ok(`WITH RECURSIVE t(id) AS (SELECT 1 UNION ALL SELECT id FROM t)
			SEARCH BREADTH FIRST BY id SET ordercol SELECT * FROM t;`);
		ok(`WITH RECURSIVE g(id) AS (SELECT 1 UNION ALL SELECT id FROM g)
			CYCLE id SET is_cycle USING path SELECT * FROM g;`);
		ok(`WITH RECURSIVE g(id) AS (SELECT 1 UNION ALL SELECT id FROM g)
			CYCLE id SET is_cycle TO true DEFAULT false USING path SELECT * FROM g;`);
	});

	it("the SEARCH/CYCLE SET columns join the CTE's declared columns", () => {
		const { ast } = parse(
			"WITH RECURSIVE t(id) AS (SELECT 1 UNION ALL SELECT id FROM t) SEARCH DEPTH FIRST BY id SET ordercol SELECT * FROM t ORDER BY ordercol;",
			"postgres",
		);
		expect(ast.ctes[0]?.columnAliases).toEqual(["id", "ordercol"]);
	});

	it("IS JSON predicate family (§9.16.1)", () => {
		ok("SELECT js IS JSON, js IS NOT JSON, js IS JSON SCALAR, js IS JSON OBJECT FROM t;");
		ok("SELECT js IS JSON ARRAY WITH UNIQUE KEYS, js IS JSON ARRAY WITHOUT UNIQUE KEYS FROM t;");
		ok("SELECT js IS JSON VALUE FROM t;");
	});

	it("JSON_TABLE incl. PASSING / wrapper / quotes / NESTED / EXISTS columns (§9.16.2)", () => {
		ok(`SELECT jt.* FROM my_films,
			JSON_TABLE (js, '$.favorites[*]' COLUMNS (
				id FOR ORDINALITY, kind text PATH '$.kind',
				title text PATH '$.films[*].title' WITH WRAPPER)) AS jt;`);
		ok(`SELECT jt.* FROM my_films,
			JSON_TABLE (js, '$.f[*] ? (@.d == $filter)' PASSING 'X' AS filter COLUMNS (
				title text FORMAT JSON PATH '$.title' OMIT QUOTES,
				NESTED PATH '$.films[*]' COLUMNS (director text PATH '$.d' KEEP QUOTES))) AS jt;`);
		ok(`SELECT * FROM JSON_TABLE('{}'::json, '$.a[*]' COLUMNS (
			has_dir boolean EXISTS PATH '$.director',
			NESTED '$.movies[*]' COLUMNS (movie_id FOR ORDINALITY))) AS jt;`);
	});

	it("JSON_TABLE COLUMNS names become the source's output columns", () => {
		const { ast } = parse(
			"SELECT jt.* FROM films, JSON_TABLE(js, '$.a[*]' COLUMNS (id FOR ORDINALITY, kind text PATH '$.kind', NESTED PATH '$.f[*]' COLUMNS (title text PATH '$.t'))) AS jt;",
			"postgres",
		);
		const jt = ast.body.kind === "select" ? ast.body.from.find((s) => s.alias === "jt") : undefined;
		expect(jt?.kind).toBe("table");
		expect(jt && "columnAliases" in jt ? jt.columnAliases : undefined).toEqual(["id", "kind", "title"]);
	});

	it("JSON_QUERY wrapper and ON SCALAR STRING are optional (upstream fixes)", () => {
		ok(`SELECT JSON_QUERY('{"a":1}'::jsonb, '$.a');`);
		ok("SELECT JSON_QUERY(js, '$.a' OMIT QUOTES) FROM t;");
	});

	it("PG 15-18 MERGE: DO NOTHING, BY SOURCE/TARGET, OVERRIDING, DEFAULT VALUES, RETURNING", () => {
		ok("MERGE INTO a USING b ON a.id = b.id WHEN MATCHED THEN DO NOTHING;");
		ok(`MERGE INTO w USING d ON w.id = d.id
			WHEN NOT MATCHED BY SOURCE THEN DELETE
			WHEN MATCHED AND w.x > 0 THEN UPDATE SET x = d.x
			WHEN NOT MATCHED BY TARGET THEN INSERT (id, x) VALUES (d.id, d.x)
			RETURNING merge_action(), w.*;`);
		ok("MERGE INTO t USING s ON t.k = s.k WHEN NOT MATCHED THEN INSERT DEFAULT VALUES;");
	});

	it("newline string continuation concatenates; same-line adjacency stays an error (§4.1.2.1)", () => {
		ok("SELECT 'foo'\n'bar';");
		bad("SELECT 'foo' 'bar';");
	});

	it("statement categories are parse-derived", () => {
		const cases: Array<[string, string]> = [
			["SELECT 1;", "query"],
			["WITH c AS (SELECT 1) SELECT * FROM c;", "query"],
			["VALUES (1), (2);", "query"],
			["TABLE t;", "query"],
			["INSERT INTO t VALUES (1);", "dml"],
			["MERGE INTO a USING b ON a.id = b.id WHEN MATCHED THEN DO NOTHING;", "dml"],
			["COPY t FROM 'f.csv';", "dml"],
			["GRANT SELECT ON t TO r;", "dcl"],
			["BEGIN;", "tcl"],
			["EXPLAIN SELECT 1;", "utility"],
			["VACUUM t;", "utility"],
			["TRUNCATE t;", "ddl"],
			["CREATE INDEX i ON t (a);", "ddl"],
			["COMMENT ON TABLE t IS 'x';", "ddl"],
			["LISTEN chan;", "utility"],
		];
		for (const [sql, want] of cases) {
			const r = parsePostgres(sql);
			expect(r.errors, sql).toBe(0);
			expect(lower(r.tree).statement, sql).toBe(want);
		}
	});

	it("DISTINCT ON keys are captured as column refs", () => {
		const { ast } = parse("SELECT DISTINCT ON (loc) loc, t FROM reports ORDER BY loc, t DESC;", "postgres");
		expect(
			ast.body.kind === "select" &&
				ast.body.columns.some((c) => c.parts.join(".") === "loc" && c.clause === "projection"),
		).toBe(true);
	});

	it("dollar quoting and :: casts (regression guard)", () => {
		ok("SELECT $tag$body 'x' $$$tag$, 1::int, '1'::numeric(10,2);");
	});
});

// SLL-surgery wave (.superpowers/sdd/task-4-report.md), iteration 1: `target_el`'s
// `columnref # target_columnref` alternative was a strict subset of `a_expr target_alias?` (a_expr →
// c_expr → columnref, `t.*` included via indirection `.STAR`). Deleting it removed a select-list
// ambiguity AND fixed a latent lower bug: `buildProjection` never read the `columnref` shape, so a
// bare column and `t.*` fell through to a phantom (unqualified) star projection. a_expr now covers the
// whole select item and lower classifies the parsed shape.
describe("postgres target_el — bare columns lower as columns, not phantom stars", () => {
	it("a plain column projects as a column", () => {
		const body = lower(parsePostgres("SELECT foo FROM t").tree).body;
		expect(body.kind === "select" && body.projections[0]?.isStar).toBe(false);
		expect(body.kind === "select" && body.projections[0]?.expr.kind).toBe("column");
	});

	it("a dotted column keeps all parts", () => {
		const body = lower(parsePostgres("SELECT a, b.c FROM t").tree).body;
		expect(body.kind === "select" && body.projections.map((p) => p.expr.kind)).toEqual(["column", "column"]);
		expect(
			body.kind === "select" && body.projections[1]?.expr.kind === "column" && body.projections[1]?.expr.parts,
		).toEqual(["b", "c"]);
	});

	it("a qualified star keeps its qualifier", () => {
		const body = lower(parsePostgres("SELECT t.* FROM t").tree).body;
		expect(body.kind === "select" && body.projections[0]?.isStar).toBe(true);
		expect(
			body.kind === "select" &&
				body.projections[0]?.expr.kind === "star" &&
				body.projections[0]?.expr.qualifier?.join("."),
		).toBe("t");
	});
});

// SLL-surgery wave (.superpowers/sdd/task-4-report.md), iteration 2: c_expr's `columnref` and
// `func_expr` alternatives both begin with an identifier, and a bare column is a viable *prefix* of a
// function call. Because a `(` can follow an expression in some other caller's follow-set, SLL's
// stackless merge kept `columnref` (the lower alternative) alive on every `f(args)`, reported a
// context-sensitivity, mispredicted the column reading and bailed on the arg. They are disjoint on a
// FULL match (columnref never carries `(`, func_expr always does), so ordering func_expr above
// columnref/aexprconst makes it the minimum alternative in that conflict — SLL resolves the call
// locally; bare `f` still falls to columnref. Dominant Postgres-family disease; duckdb/redshift share it.
describe("postgres c_expr — function applications resolve under SLL (no LL fallback)", () => {
	const noFallback = (sql: string) => {
		const r = parsePostgres(sql);
		expect(r.errors, sql).toBe(0);
		expect(r.sllFallback, `${sql} — expected SLL to resolve without LL fallback`).toBe(false);
	};

	it("calls of every shape resolve without falling back to LL", () => {
		for (const sql of [
			"SELECT f(a)",
			"SELECT f(1)",
			"SELECT f(a, b) FROM t",
			"SELECT max(x) FROM t",
			"SELECT f(a.b) FROM t",
			"SELECT coalesce(a, b) FROM t",
			"SELECT sum(x) OVER (PARTITION BY y) FROM t",
			"SELECT f(x => 1)",
			"SELECT count(*) FROM t",
		]) {
			noFallback(sql);
		}
	});

	it("a call still lowers as a function, a bare id still as a column", () => {
		const call = lower(parsePostgres("SELECT f(a, b) FROM t").tree).body;
		expect(call.kind === "select" && call.projections[0]?.expr.kind).toBe("function");
		const col = lower(parsePostgres("SELECT foo FROM t").tree).body;
		expect(col.kind === "select" && col.projections[0]?.expr.kind).toBe("column");
	});

	// Iteration 3: aexprconst ordered above func_expr/columnref. A generic typed literal (`DATE '…'`,
	// `f(a) '5'`) requires a trailing sconst that a bare column / plain call lacks, so making it the
	// minimum alternative resolves the conflict under SLL without re-breaking bare `f` or `f(a)`.
	it("generic typed literals resolve under SLL and lower as literals", () => {
		for (const sql of [
			"SELECT DATE '2008-01-01'",
			"SELECT f(a) '5'",
			"SELECT int4 '5'",
			"SELECT f(a ORDER BY b) '5'",
		])
			noFallback(sql);
		const lit = lower(parsePostgres("SELECT f(a) '5'").tree).body;
		expect(lit.kind === "select" && lit.projections[0]?.expr.kind).toBe("literal");
	});

	it("the reorder does not widen: generic typed literals parse, non-arg-list typed forms reject", () => {
		ok("SELECT f(a) '5'"); // aexprconst `func_name '(' args ')' sconst` — still valid
		ok("SELECT DATE '2008-01-01'");
		bad("SELECT count(*) '5'"); // STAR arg — never a typed literal
		bad("SELECT f() '5'"); // empty arg — never a typed literal
		bad("SELECT f(a, VARIADIC b) '5'"); // VARIADIC arg — never a typed literal
	});
});
