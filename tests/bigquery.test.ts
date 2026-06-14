import { describe, expect, it } from "vitest";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { GoogleSQLLexer } from "../src/generated/bigquery/GoogleSQLLexer.js";

// DOT_IDENTIFIER (lexical#identifiers): any keyword is valid as a path component after a `.`
// (foo.all, hll_count.merge, t.array, @@FROM). `dot_identifier` governs path_expression /
// system-variable paths; its reserved set is hand-enumerated, which would silently drift as
// keyword tokens are added — so derive every keyword spelling from the lexer vocabulary and assert
// each is accepted as a post-dot path component. A new keyword missing from the set fails here.
describe("BigQuery dot-identifier covers every keyword (complete by construction)", () => {
	const keywords = (GoogleSQLLexer.literalNames as (string | null)[])
		.filter((l): l is string => !!l && /^'[A-Za-z][A-Za-z_]*'$/.test(l))
		.map((l) => l.slice(1, -1));

	it("has a non-trivial keyword set", () => {
		expect(keywords.length).toBeGreaterThan(200);
	});

	it("every keyword parses as a path component after a dot", () => {
		// `dataset.<kw>` exercises path_expression's post-dot dot_identifier; @@ paths reuse the same rule.
		const broken = keywords.filter((kw) => parseBigQuery(`SELECT * FROM dataset.${kw}`).errors !== 0);
		expect(broken, `keywords not accepted as a path component:\n${broken.join(", ")}`).toEqual([]);
	});

	it("a reserved keyword is valid as a system-variable path component (incl. the head)", () => {
		expect(parseBigQuery("SELECT @@FROM").errors).toBe(0);
		expect(parseBigQuery("SELECT @@v.ORDER.with").errors).toBe(0);
	});
});

describe("parseBigQuery", () => {
	it("parses a basic SELECT with zero errors", () => {
		expect(parseBigQuery("SELECT a, b FROM t").errors).toBe(0);
	});

	it("parses BigQuery-isms: backticks, EXCEPT, UNNEST", () => {
		expect(parseBigQuery("SELECT * EXCEPT (a) FROM `proj.ds.t`").errors).toBe(0);
		expect(parseBigQuery("SELECT x FROM UNNEST([1,2,3]) AS x").errors).toBe(0);
	});

	it("reports errors on garbage", () => {
		expect(parseBigQuery("SELECT FROM").errors).toBeGreaterThan(0);
	});

	// docs.cloud.google.com/bigquery/docs/table-functions — TVF calls in FROM
	// (upstream port bug: tvf_prefix_no_args lost its opening paren, so every TVF call failed).
	it("TVF calls in FROM: zero-arg, scalar, subquery, TABLE and named args", () => {
		expect(parseBigQuery("SELECT 1 FROM tvf_no_args()").errors).toBe(0);
		expect(parseBigQuery("SELECT * FROM ds.fn(1, 'a')").errors).toBe(0);
		expect(parseBigQuery("SELECT * FROM fn((SELECT 1), 2)").errors).toBe(0);
		expect(parseBigQuery("SELECT * FROM fn(TABLE t, 'x')").errors).toBe(0);
		expect(parseBigQuery("SELECT * FROM fn(arg => (SELECT 1))").errors).toBe(0);
	});

	// …/query-syntax#tablesample_operator — suffix (REPEATABLE/WITH WEIGHT) is optional.
	it("TABLESAMPLE without a suffix", () => {
		expect(parseBigQuery("SELECT * FROM t TABLESAMPLE SYSTEM (10 PERCENT)").errors).toBe(0);
		expect(parseBigQuery("SELECT * FROM t TABLESAMPLE RESERVOIR (1 ROWS)").errors).toBe(0);
	});

	// …/timestamp_functions — CAST(.. AS .. FORMAT .. AT TIME ZONE ..) / EXTRACT(.. AT TIME ZONE ..)
	// (upstream port bug: AT_SYMBOL is '@'; the AT keyword was never lexed).
	it("AT TIME ZONE in CAST FORMAT and EXTRACT", () => {
		expect(parseBigQuery("SELECT CAST(s AS TIMESTAMP FORMAT 'YYYY' AT TIME ZONE 'UTC') FROM t").errors).toBe(0);
		expect(parseBigQuery("SELECT EXTRACT(DAY FROM ts AT TIME ZONE 'UTC') FROM t").errors).toBe(0);
	});

	// …/query-syntax#set_operators — BY NAME [ON (cols)] | [STRICT] CORRESPONDING [BY (cols)]
	it("set operations with BY NAME and CORRESPONDING BY", () => {
		expect(parseBigQuery("SELECT 1 AS a UNION ALL BY NAME SELECT 2 AS a").errors).toBe(0);
		expect(parseBigQuery("SELECT 1 AS a UNION ALL BY NAME ON (a) SELECT 2 AS a").errors).toBe(0);
		expect(parseBigQuery("SELECT 1 UNION ALL CORRESPONDING BY (a, b) SELECT 2").errors).toBe(0);
		expect(parseBigQuery("SELECT 1 UNION ALL STRICT CORRESPONDING SELECT 2").errors).toBe(0);
	});

	// …/query-syntax#dp_clause — SELECT WITH DIFFERENTIAL_PRIVACY OPTIONS(...)
	it("SELECT WITH DIFFERENTIAL_PRIVACY", () => {
		expect(
			parseBigQuery("SELECT WITH DIFFERENTIAL_PRIVACY OPTIONS(epsilon=1.0, delta=1e-5) COUNT(*) FROM t").errors,
		).toBe(0);
	});

	// ZetaSQL aggregate modifiers the corpus exercises: WHERE / GROUP BY / HAVING inside an
	// aggregate call (multi-level aggregation), and the anonymization CLAMPED BETWEEN modifier
	// (upstream port bug: clamped_between_modifier lost its BETWEEN).
	it("aggregate-call modifiers: WHERE, GROUP BY, HAVING, CLAMPED BETWEEN", () => {
		expect(parseBigQuery("SELECT SUM(x WHERE y > 0) FROM t").errors).toBe(0);
		expect(parseBigQuery("SELECT SUM(AVG(x) GROUP BY y) FROM t").errors).toBe(0);
		expect(parseBigQuery("SELECT STRING_AGG(s GROUP BY s HAVING COUNT(*) > 1) FROM t").errors).toBe(0);
		expect(parseBigQuery("SELECT anon_count(* CLAMPED BETWEEN 0 AND 100) FROM t").errors).toBe(0);
	});

	// …/query-syntax#qualify_clause — QUALIFY no longer requires WHERE/GROUP BY/HAVING.
	it("bare QUALIFY", () => {
		expect(parseBigQuery("SELECT * FROM t QUALIFY ROW_NUMBER() OVER (ORDER BY x) = 1").errors).toBe(0);
	});

	// Top-level procedural scripting (ZetaSQL ParseScript) — DECLARE/SET/LOOP/IF/BEGIN…EXCEPTION/etc.
	it("top-level scripting statements", () => {
		expect(parseBigQuery("DECLARE x STRING").errors).toBe(0);
		expect(parseBigQuery("LOOP SELECT 5; END LOOP").errors).toBe(0);
		expect(parseBigQuery("WHILE x < 10 DO SELECT 1; END WHILE").errors).toBe(0);
		expect(parseBigQuery("BEGIN EXCEPTION WHEN ERROR THEN RAISE; END").errors).toBe(0);
		expect(parseBigQuery("IF x THEN SELECT 1; ELSEIF y THEN SELECT 2; ELSE SELECT 3; END IF").errors).toBe(0);
		expect(parseBigQuery("DECLARE n INT64 DEFAULT 0; WHILE n < 3 DO SET n = n + 1; END WHILE").errors).toBe(0);
	});

	// …/operators#comparison_operators — quantified comparison `op {ANY|SOME|ALL} (list|subquery)`.
	it("quantified comparisons", () => {
		expect(parseBigQuery("SELECT 1 = ANY (1, 2, 3)").errors).toBe(0);
		expect(parseBigQuery("SELECT x < ALL (SELECT y FROM t)").errors).toBe(0);
		expect(parseBigQuery("SELECT x > SOME UNNEST(arr)").errors).toBe(0);
	});

	// lexical DOT_IDENTIFIER — a reserved keyword is a valid field name after a dot.
	it("reserved-keyword field access lowers to a column ref", () => {
		expect(parseBigQuery("SELECT t.array, t.from, t.select FROM u").errors).toBe(0);
		const b = q("SELECT t.array FROM u");
		expect(b.columns.map((c) => c.parts.join("."))).toContain("t.array");
	});

	// ZetaSQL rejects these aggregate-modifier shapes (multi_level_aggregation_errors,
	// aggregate_filtering_errors): the GROUP BY modifier takes plain expression keys only, and
	// bare boolean HAVING is not allowed without GROUP BY.
	it("rejects malformed aggregate modifiers", () => {
		expect(parseBigQuery("SELECT SUM(int64 HAVING bool IS NOT NULL) FROM t").errors).toBeGreaterThan(0);
		expect(parseBigQuery("SELECT SUM(ANY_VALUE(x) GROUP AND ORDER BY y) FROM t").errors).toBeGreaterThan(0);
		expect(parseBigQuery("SELECT SUM(ANY_VALUE(x) GROUP BY y ASC) FROM t").errors).toBeGreaterThan(0);
		expect(parseBigQuery("SELECT SUM(ANY_VALUE(x) GROUP BY y AS a) FROM t").errors).toBeGreaterThan(0);
	});

	// Valid multi-level-aggregation forms must still parse (GROUP BY keys, optional boolean HAVING).
	it("multi-level aggregation GROUP BY/HAVING", () => {
		expect(parseBigQuery("SELECT SUM(ANY_VALUE(x) GROUP BY a, b) FROM t").errors).toBe(0);
		expect(parseBigQuery("SELECT SUM(ANY_VALUE(x) GROUP BY a HAVING MAX(x) > 0) FROM t").errors).toBe(0);
		expect(parseBigQuery("SELECT afn(key HAVING MAX value) OVER () FROM t").errors).toBe(0);
		expect(parseBigQuery("SELECT COUNT(* GROUP BY a) FROM t").errors).toBe(0);
	});
});

// docs.cloud.google.com/bigquery/docs/reference/standard-sql/pipe-syntax — pipe query syntax,
// GA in BigQuery. The base query may be a bare FROM clause; pipe operators chain with `|>`.
describe("BigQuery pipe syntax", () => {
	const ok = (sql: string) => expect(parseBigQuery(sql).errors, sql).toBe(0);

	it("bare FROM query (no SELECT)", () => {
		ok("FROM t");
		ok("FROM a JOIN b USING (k)");
	});

	it("row-producing operators: WHERE/SELECT/EXTEND/SET/DROP/RENAME/DISTINCT/ORDER BY/LIMIT", () => {
		ok("FROM t |> WHERE key > 10");
		ok("SELECT 1 x, 2 y |> SELECT *, x + y AS z |> SELECT x, z");
		ok("SELECT 1 x |> EXTEND 2 y |> EXTEND y*2 z |> EXTEND y+z yz, x+1 x1");
		ok("FROM t |> SET key = 'abc'");
		ok("FROM t |> DROP key");
		ok("FROM t |> RENAME key AS k |> RENAME k AS k2");
		ok("SELECT 1 |> DISTINCT");
		ok("SELECT 1 x, 2 y |> ORDER BY x, y DESC, x*2 |> ORDER @{hint=1} BY x");
		ok("SELECT 1 |> LIMIT 10 |> LIMIT 5 OFFSET 2");
	});

	it("AGGREGATE with and without GROUP BY, grouping items", () => {
		ok("SELECT 1 x, 2 y |> AGGREGATE GROUP BY x, y");
		ok("SELECT 1 x, 2 y |> AGGREGATE SUM(y), SUM(x) GROUP BY x");
		ok("FROM t |> AGGREGATE COUNT(*) GROUP BY GROUPING SETS(a, b)");
		ok("FROM t |> AGGREGATE count(*), sum(y) GROUP BY ()");
		ok("SELECT 1 x |> AGGREGATE x GROUP BY x");
	});

	it("WINDOW / CALL / AS / TABLESAMPLE / PIVOT / UNPIVOT", () => {
		ok("SELECT 1 x |> WINDOW sum(x) OVER (), count(*) OVER () AS c");
		ok("SELECT 1 x |> CALL tvf() |> CALL fn(x)");
		ok("SELECT 1 x, 2 y |> AS t |> SELECT t.x, t.y, *, t.*");
		ok("FROM t |> TABLESAMPLE BERNOULLI (10 PERCENT)");
		ok("FROM t |> PIVOT(COUNT(v) FOR k IN (0 AS zero, 1 AS one))");
		ok("FROM t |> UNPIVOT(a FOR b IN (k))");
	});

	it("JOIN operators with types and ON/USING", () => {
		ok("FROM t |> JOIN u USING (key)");
		ok("FROM t |> CROSS JOIN u kv2");
		ok("FROM t |> FULL JOIN u t2 USING (c)");
		ok("FROM t |> JOIN UNNEST(t.arr) d2 ON d1 = d2");
	});

	it("pipe set operations (UNION/INTERSECT/EXCEPT with modifiers and operands)", () => {
		ok("SELECT 1 |> UNION ALL (SELECT 2)");
		ok("FROM t |> INNER INTERSECT DISTINCT BY NAME (SELECT 1 AS a)");
		ok("FROM t |> LEFT EXCEPT ALL BY NAME (SELECT 1 AS a)");
	});

	it("inspection/assertion operators: STATIC_DESCRIBE/DESCRIBE/LOG/ASSERT", () => {
		ok("FROM t |> STATIC_DESCRIBE |> WHERE value IS NULL");
		ok("SELECT 123 |> DESCRIBE");
		ok("FROM t |> LOG");
		ok("SELECT * FROM t |> ASSERT true |> ASSERT key > 0, 'bad key', key");
	});

	it("control-flow / subpipeline operators: IF/TEE/FORK/RECURSIVE UNION", () => {
		ok("FROM t |> IF true THEN ()");
		ok("FROM t |> TEE ()");
		ok("FROM t |> FORK ()");
		ok("FROM t |> RECURSIVE UNION ALL (|> EXTEND 1)");
	});

	it("DML/DDL pipe operators: CREATE TABLE / INSERT / EXPORT DATA", () => {
		ok("FROM t |> CREATE TABLE t2");
		ok("SELECT 123 input_name |> CREATE TABLE t1 (output_name STRING)");
		ok("SELECT 'abc' value, 5 key |> INSERT INTO KeyValue");
		ok("FROM t |> EXPORT DATA");
	});

	it("pipes nest in subqueries and parenthesized set-op operands", () => {
		ok("SELECT * FROM (FROM t |> WHERE x > 0)");
		ok("(FROM a) UNION ALL (FROM b) |> WHERE str IS NULL |> SELECT *");
	});

	it("pipe AGGREGATE GROUP BY allows ordered keys and a trailing comma", () => {
		ok("FROM t |> AGGREGATE count(*) GROUP BY key, value ASC, value DESC,");
		ok("FROM t |> AGGREGATE sum(x) GROUP BY key DESC NULLS LAST");
	});

	it("standalone subpipeline statement (implicit input table)", () => {
		ok("|> WHERE true");
		ok("|> WHERE x > 0 |> SELECT a, b");
	});

	it("pipe CALL with INPUT TABLE argument", () => {
		ok("SELECT * FROM tvf(TABLE KeyValue, INPUT TABLE)");
		ok("SELECT 1 x |> CALL tvf(INPUT TABLE, 2)");
	});
});

// GoogleSQL graph queries (GQL): GRAPH_TABLE(...) in FROM, the GRAPH statement, patterns,
// CALL, search prefixes/quantifiers, graph subqueries, CREATE PROPERTY GRAPH.
describe("BigQuery graph / GQL", () => {
	const ok = (sql: string) => expect(parseBigQuery(sql).errors, sql).toBe(0);

	it("GRAPH_TABLE in FROM: MATCH + COLUMNS, and the GQL operation-block form", () => {
		ok("SELECT gt.* FROM graph_table(aml MATCH (n) COLUMNS(n.name, 1 AS num)) gt");
		ok("SELECT gt.* FROM graph_table(aml MATCH (n) RETURN n.name, 1 AS num) gt");
		ok("SELECT * FROM graph_table(g MATCH (a IS Person)-[e]->(b) COLUMNS(a.name))");
	});

	it("standalone GRAPH statement with linear ops and NEXT", () => {
		ok("GRAPH aml MATCH (n) RETURN n.name");
		ok("GRAPH aml MATCH (n) LET x = 1 FILTER x > 0 RETURN count(*)");
		ok("GRAPH aml MATCH (n) RETURN n.id AS id NEXT MATCH (m) RETURN m.id");
	});

	it("CALL operator: inline subquery, named TVF, PER and YIELD", () => {
		ok("GRAPH g LET x = 1 CALL () { RETURN 1 AS one } RETURN count(*)");
		ok("GRAPH g MATCH (n) CALL tvf_graph() RETURN 1");
		ok("GRAPH g MATCH (n) CALL PER (n) tvf(n.id) YIELD a, b AS c RETURN a");
	});

	it("path search prefixes, modes, quantifiers", () => {
		ok("GRAPH g MATCH ANY SHORTEST (a)-[e]->(b) RETURN 1");
		ok("GRAPH g MATCH ALL CHEAPEST (a)-[e COST e.w]->(b) RETURN 1");
		ok("GRAPH g MATCH SHORTEST 3 (a)-[e]->(b) RETURN 1");
		ok("GRAPH g MATCH TRAIL (a)-[e]->{1,3}(b) RETURN 1");
		ok("GRAPH g MATCH p = ACYCLIC (a)-[e]->+(b) RETURN 1");
		ok("GRAPH g MATCH ((a)-[e]->(b)){2,} RETURN 1");
	});

	it("graph predicates and subqueries", () => {
		ok("GRAPH g MATCH (a)-[e]->(b) FILTER a IS SOURCE OF e RETURN 1");
		ok("GRAPH g MATCH (n) FILTER n IS LABELED Person RETURN 1");
		ok("SELECT VALUE { GRAPH g MATCH (n) RETURN n.id }");
		ok("SELECT EXISTS { MATCH (n) }");
		ok("SELECT ARRAY { GRAPH g MATCH (n) RETURN n.id }");
	});

	it("label expressions in patterns", () => {
		ok("GRAPH g MATCH (n:Person|Company) RETURN 1");
		ok("GRAPH g MATCH (n IS Person & !Internal) RETURN 1");
		ok("GRAPH g MATCH (n {age: 30, name: 'x'}) RETURN 1");
	});

	it("CREATE PROPERTY GRAPH", () => {
		ok("CREATE PROPERTY GRAPH g NODE TABLES (Person KEY (id))");
		ok(
			"CREATE PROPERTY GRAPH g NODE TABLES (Person) EDGE TABLES (Knows SOURCE KEY (a) REFERENCES Person DESTINATION KEY (b) REFERENCES Person)",
		);
		ok("CREATE PROPERTY GRAPH g NODE TABLES (Person LABEL P PROPERTIES ALL COLUMNS)");
	});
});

// LATERAL joins (correlated subquery / TVF on the join RHS) — query-syntax LATERAL.
describe("BigQuery LATERAL join", () => {
	const ok = (sql: string) => expect(parseBigQuery(sql).errors, sql).toBe(0);
	it("LATERAL subquery and TVF, classic and pipe", () => {
		ok("SELECT * FROM a JOIN LATERAL (SELECT * FROM b WHERE b.k < a.k) AS t2");
		ok("SELECT * FROM a LEFT JOIN LATERAL tvf(a.k, TABLE b) AS t2");
		ok("SELECT * FROM a JOIN LATERAL (SELECT 1) AS t TABLESAMPLE BERNOULLI (10 PERCENT)");
		ok("FROM a |> JOIN LATERAL (SELECT * FROM b) AS t2");
	});
});

import { lower } from "../src/bigquery/lower.js";

function kind(sql: string) {
	const r = parseBigQuery(sql);
	expect(r.errors, sql).toBe(0);
	return lower(r.tree).statement;
}

describe("BigQuery statement category (from the parse)", () => {
	it("query / dml / ddl / utility / compound", () => {
		expect(kind("SELECT a FROM t")).toBe("query");
		expect(kind("WITH c AS (SELECT 1 AS x) SELECT x FROM c")).toBe("query");
		expect(kind("INSERT INTO t (a) VALUES (1)")).toBe("dml");
		expect(kind("CREATE TABLE t (a INT64)")).toBe("ddl");
		expect(kind("DROP TABLE t")).toBe("ddl");
		expect(kind("SELECT 1; SELECT 2")).toBe("compound");
	});
});

function q(sql: string) {
	const r = parseBigQuery(sql);
	expect(r.errors, sql).toBe(0);
	const ir = lower(r.tree);
	expect(ir.body.kind, sql).toBe("select");
	return ir.body as Extract<typeof ir.body, { kind: "select" }>;
}

function query(sql: string) {
	const r = parseBigQuery(sql);
	expect(r.errors, sql).toBe(0);
	return lower(r.tree);
}

describe("BigQuery lowering", () => {
	it("projections and a table source", () => {
		const b = q("SELECT a, b AS c FROM t");
		expect(b.projections.map((p) => p.name)).toEqual(["a", "c"]);
		expect(b.from).toHaveLength(1);
		expect(b.from[0]).toMatchObject({ kind: "table", name: ["t"] });
	});

	it("dotted/backtick table names → multi-part name", () => {
		const b = q("SELECT x FROM `proj.ds.t`");
		expect(b.from[0]).toMatchObject({ kind: "table" });
		expect((b.from[0] as { name: string[] }).name).toEqual(["proj", "ds", "t"]);
	});

	it("WHERE / GROUP BY / HAVING / QUALIFY", () => {
		const b = q(
			"SELECT a, COUNT(*) AS n FROM t WHERE a > 0 GROUP BY a HAVING COUNT(*) > 1 QUALIFY ROW_NUMBER() OVER (PARTITION BY a) = 1",
		);
		expect(b.where).toBeDefined();
		expect(b.groupBy?.length).toBe(1);
		expect(b.having).toBeDefined();
		expect(b.qualify).toBeDefined();
		expect(b.aggregated).toBe(true);
	});

	it("GROUP BY ALL", () => {
		const b = q("SELECT a, COUNT(*) FROM t GROUP BY ALL");
		expect(b.aggregated).toBe(true);
	});

	it("JOIN chain with ON", () => {
		const b = q("SELECT a FROM t JOIN u ON t.id = u.id");
		expect(b.from).toHaveLength(2);
		expect(b.joinConditions?.length).toBe(1);
	});

	it("comma (cross) join", () => {
		const b = q("SELECT a FROM t, u");
		expect(b.from).toHaveLength(2);
	});

	it("UNNEST → lateral source", () => {
		const b = q("SELECT e FROM t, UNNEST(t.events) AS e");
		const lateral = b.from.find((s) => s.kind === "lateral");
		expect(lateral).toMatchObject({ kind: "lateral", alias: "e" });
	});

	it("SELECT * EXCEPT (a)", () => {
		const b = q("SELECT * EXCEPT (a, b) FROM t");
		const star = b.projections[0].expr;
		expect(star).toMatchObject({ kind: "star" });
		expect((star as { exclude?: string[] }).exclude).toEqual(["a", "b"]);
	});

	it("SELECT * REPLACE (x+1 AS y)", () => {
		const b = q("SELECT * REPLACE (x + 1 AS y) FROM t");
		const star = b.projections[0].expr as { kind: string; replace?: { column: string }[] };
		expect(star.kind).toBe("star");
		expect(star.replace?.[0].column).toBe("y");
	});

	it("CTEs incl. RECURSIVE", () => {
		const ir = query("WITH a AS (SELECT 1 AS x), b AS (SELECT x FROM a) SELECT x FROM b");
		expect(ir.ctes.map((c) => c.name)).toEqual(["a", "b"]);
		const rec = query("WITH RECURSIVE r AS (SELECT 1 AS n) SELECT n FROM r");
		expect(rec.ctes.map((c) => c.name)).toEqual(["r"]);
	});

	it("set operations", () => {
		const ir = query("SELECT a FROM t UNION ALL SELECT a FROM u");
		expect(ir.body.kind).toBe("setop");
		const setop = ir.body as Extract<typeof ir.body, { kind: "setop" }>;
		expect(setop.op).toBe("union");
		expect(setop.all).toBe(true);
		const inter = query("SELECT a FROM t INTERSECT DISTINCT SELECT a FROM u");
		expect((inter.body as { op: string }).op).toBe("intersect");
		const exc = query("SELECT a FROM t EXCEPT DISTINCT SELECT a FROM u");
		expect((exc.body as { op: string }).op).toBe("except");
	});

	it("subquery in FROM", () => {
		const b = q("SELECT s.a FROM (SELECT a FROM t) AS s");
		expect(b.from[0]).toMatchObject({ kind: "subquery", alias: "s" });
	});

	it("scalar subquery in an expression", () => {
		const b = q("SELECT (SELECT MAX(x) FROM u) AS m FROM t");
		expect(b.subqueries?.length).toBe(1);
	});

	it("expression grammar: binary/unary/CASE/CAST/function/IN/BETWEEN/LIKE", () => {
		expect(q("SELECT a + b * c FROM t").projections[0].expr.kind).toBe("binary");
		expect(q("SELECT -a FROM t").projections[0].expr.kind).toBe("unary");
		expect(q("SELECT CASE WHEN a > 0 THEN 1 ELSE 0 END FROM t").projections[0].expr.kind).toBe("case");
		expect(q("SELECT CAST(a AS INT64) FROM t").projections[0].expr.kind).toBe("cast");
		expect(q("SELECT COALESCE(a, b) FROM t").projections[0].expr.kind).toBe("function");
		expect(q("SELECT a IN (1, 2, 3) FROM t").projections[0].expr).toMatchObject({ kind: "predicate", op: "in" });
		expect(q("SELECT a BETWEEN 1 AND 2 FROM t").projections[0].expr).toMatchObject({
			kind: "predicate",
			op: "between",
		});
		expect(q("SELECT a LIKE '%x%' FROM t").projections[0].expr).toMatchObject({ kind: "predicate", op: "like" });
		expect(q("SELECT a IS NULL FROM t").projections[0].expr).toMatchObject({ kind: "predicate", op: "null" });
	});

	it("subscript, STRUCT, ARRAY, EXISTS", () => {
		expect(q("SELECT arr[OFFSET(0)] FROM t").projections[0].expr.kind).toBe("subscript");
		expect(q("SELECT STRUCT(1 AS a, 2 AS b) FROM t").projections[0].expr).toMatchObject({ kind: "function" });
		expect(q("SELECT [1, 2, 3] AS a FROM t").projections[0].expr).toMatchObject({ kind: "function" });
		expect(q("SELECT EXISTS(SELECT 1 FROM u) FROM t").projections[0].expr.kind).toBe("exists");
	});

	it("FROM-query and TABLE-query lower to a select over their sources", () => {
		const fq = q("FROM t");
		expect(fq.from[0]).toMatchObject({ kind: "table", name: ["t"] });
		const fqj = q("FROM a JOIN b USING (k)");
		expect(fqj.from.map((s) => (s as { name?: string[] }).name?.[0])).toEqual(["a", "b"]);
		const tq = q("TABLE ds.t");
		expect(tq.from[0]).toMatchObject({ kind: "table", name: ["ds", "t"] });
	});

	it("a piped query still lowers its base query (pipe transforms unmodelled)", () => {
		const r = query("FROM t |> WHERE x > 0 |> SELECT a");
		expect(r.statement).toBe("query");
		expect(r.body.kind).toBe("select");
		expect((r.body as { from: { name?: string[] }[] }).from[0]?.name).toEqual(["t"]);
	});

	it("never throws and records columns for resolution", () => {
		const b = q("SELECT t.a, f(t.b) + 1 AS e FROM t WHERE t.c IS NOT NULL");
		const cols = b.columns.map((c) => c.parts.join("."));
		expect(cols).toContain("t.a");
		expect(cols).toContain("t.b");
		expect(cols).toContain("t.c");
	});
});
