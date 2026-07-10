import { describe, expect, it } from "vitest";
import { lower } from "../src/mysql/lower.js";
import { parseMysql } from "../src/mysql/parse.js";

// MySQL is a new dialect: grammar forked from grammars-v4 sql/mysql/Positive-Technologies
// (Kochurkin's split MySqlLexer/MySqlParser pair). Only parse() and lower() are
// MySQL-specific — the semantic layer runs unchanged on the shared IR. These tests are
// the R3 lowering gate.

const errorsOf = (sql: string) => parseMysql(sql).errors;

function ir(sql: string) {
	const { tree, errors } = parseMysql(sql);
	return { q: lower(tree), errors };
}

function selectBody(sql: string) {
	const { q, errors } = ir(sql);
	expect(errors).toBe(0);
	if (q.body.kind !== "select") throw new Error(`expected select body, got ${q.body.kind}`);
	return { q, body: q.body };
}

describe("Mysql parse", () => {
	it("parses a basic SELECT with zero syntax errors", () => {
		expect(errorsOf("SELECT a, b FROM t WHERE a > 1")).toBe(0);
	});
});

describe("Mysql lower -> IR", () => {
	it("lowers a basic SELECT to a select body with projections, a source and WHERE", () => {
		const { body } = selectBody("SELECT a, b FROM t WHERE a > 1");
		expect(body.projections.map((p) => p.name)).toEqual(["a", "b"]);
		expect(body.from[0]).toMatchObject({ kind: "table", name: ["t"] });
		expect(body.where).toMatchObject({ kind: "binary", op: ">" });
		expect(body.columns.some((c) => c.clause === "where" && c.parts.join(".") === "a")).toBe(true);
	});

	it("captures column and table aliases, with and without AS", () => {
		const { body } = selectBody("SELECT t.a AS x, t.b y FROM db.tbl t");
		expect(body.projections[0].name).toBe("x");
		expect(body.projections[0].expr).toMatchObject({ kind: "column", parts: ["t", "a"] });
		expect(body.projections[0].aliasCst).toBeDefined();
		expect(body.projections[1].name).toBe("y");
		expect(body.from[0]).toMatchObject({ kind: "table", name: ["db", "tbl"], alias: "t" });
	});

	it("models a qualified `t.*` projection", () => {
		const { body } = selectBody("SELECT t.* FROM t");
		expect(body.projections[0].isStar).toBe(true);
		expect(body.projections[0].expr).toMatchObject({ kind: "star", qualifier: ["t"] });
	});

	it("models a bare `*` projection", () => {
		const { body } = selectBody("SELECT * FROM t");
		expect(body.projections[0].isStar).toBe(true);
		expect(body.projections[0].expr).toMatchObject({ kind: "star" });
		expect((body.projections[0].expr as { qualifier?: string[] }).qualifier).toBeUndefined();
	});

	it("keeps backtick/double-quote delimiters on identifier fields (raw, delimiters intact)", () => {
		const bt = selectBody("SELECT `col` FROM `tbl`").body;
		expect(bt.projections[0].expr).toMatchObject({ kind: "column", parts: ["`col`"] });
		expect(bt.from[0]).toMatchObject({ kind: "table", name: ["`tbl`"] });
		const dq = selectBody('SELECT "col" FROM "tbl"').body;
		expect(dq.projections[0].expr).toMatchObject({ kind: "column", parts: ['"col"'] });
		expect(dq.from[0]).toMatchObject({ kind: "table", name: ['"tbl"'] });
	});

	it("reconstructs a CTE query from the grammar's split WITH/SELECT statements", () => {
		// MySQL-PT parses `WITH ... SELECT ...` as two adjacent statements (withStatement then
		// selectStatement); lower() merges them back into one CTE query. See report for the grammar note.
		const { q } = selectBody("WITH c (x, y) AS (SELECT a, b FROM t) SELECT x FROM c");
		expect(q.statement).toBe("query");
		expect(q.ctes).toHaveLength(1);
		expect(q.ctes[0].name).toBe("c");
		expect(q.ctes[0].columnAliases).toEqual(["x", "y"]);
		expect(q.ctes[0].body.body.kind).toBe("select");
		expect(q.body.kind).toBe("select");
	});

	it("lowers a FROM subquery with an alias", () => {
		const { body } = selectBody("SELECT s.a FROM (SELECT a FROM t) s");
		expect(body.from[0]).toMatchObject({ kind: "subquery", alias: "s" });
		if (body.from[0].kind !== "subquery") throw new Error("subquery");
		expect(body.from[0].query.body.kind).toBe("select");
	});

	it("captures JOIN ON conditions, sources and their column refs", () => {
		const { body } = selectBody("SELECT * FROM a INNER JOIN b ON a.id = b.id");
		expect(body.from).toHaveLength(2);
		expect(body.joins).toHaveLength(1);
		expect(body.joins?.[0]).toMatchObject({ kind: "inner" });
		expect(body.joinConditions).toHaveLength(1);
		expect(body.joins?.[0].on).toBe(body.joinConditions?.[0]); // reference identity
		expect(body.columns.some((c) => c.clause === "join" && c.parts.join(".") === "a.id")).toBe(true);
	});

	it("captures a LEFT OUTER JOIN kind and a USING (col) constraint", () => {
		// bare `LEFT JOIN` mis-parses `LEFT` as an alias in this grammar (documented wart); `LEFT
		// OUTER JOIN` disambiguates to a real outer join.
		const left = selectBody("SELECT * FROM a LEFT OUTER JOIN b ON a.id = b.id").body;
		expect(left.joins?.[0]).toMatchObject({ kind: "left" });
		const using = selectBody("SELECT * FROM a INNER JOIN b USING (id)").body;
		expect(using.joins?.[0]).toMatchObject({ kind: "inner", using: ["id"] });
	});

	it("models a comma cross-join as two plain FROM entries (no joins)", () => {
		const { body } = selectBody("SELECT * FROM a, b WHERE a.id = b.id");
		expect(body.from).toHaveLength(2);
		expect(body.joins).toBeUndefined();
	});

	it("models GROUP BY and HAVING and sets aggregated", () => {
		const { body } = selectBody("SELECT g, SUM(x) FROM t GROUP BY g HAVING SUM(x) > 0");
		expect(body.groupBy).toHaveLength(1);
		expect(body.having).toMatchObject({ kind: "binary", op: ">" });
		expect(body.aggregated).toBe(true);
	});

	it("sets aggregated for a bare aggregate with no GROUP BY", () => {
		expect(selectBody("SELECT MAX(x) FROM t").body.aggregated).toBe(true);
		expect(selectBody("SELECT COUNT(*) FROM t").body.aggregated).toBe(true);
		expect(selectBody("SELECT x FROM t").body.aggregated).toBe(false);
	});

	it("models ORDER BY and LIMIT n OFFSET m", () => {
		const { q } = selectBody("SELECT a FROM t ORDER BY a DESC LIMIT 10 OFFSET 5");
		expect(q.orderBy).toHaveLength(1);
		expect(q.limit?.top).toMatchObject({ kind: "literal", text: "10" });
		expect(q.limit?.offset).toMatchObject({ kind: "literal", text: "5" });
	});

	it("reads the MySQL comma LIMIT form as `offset, count`", () => {
		const { q } = selectBody("SELECT a FROM t LIMIT 5, 10");
		expect(q.limit?.offset).toMatchObject({ kind: "literal", text: "5" });
		expect(q.limit?.top).toMatchObject({ kind: "literal", text: "10" });
	});

	it("lowers a UNION ALL compound to a setop body", () => {
		const { q } = ir("SELECT a FROM t1 UNION ALL SELECT a FROM t2");
		if (q.body.kind !== "setop") throw new Error(`expected setop, got ${q.body.kind}`);
		expect(q.body.op).toBe("union");
		expect(q.body.all).toBe(true);
		expect(q.body.left.kind).toBe("select");
		expect(q.body.right.kind).toBe("select");
	});

	it("left-folds a 3-way UNION chain", () => {
		const q = ir("SELECT a FROM t1 UNION SELECT a FROM t2 UNION SELECT a FROM t3").q;
		if (q.body.kind !== "setop") throw new Error("setop");
		expect(q.body.op).toBe("union");
		expect(q.body.all).toBe(false);
		if (q.body.left.kind !== "setop") throw new Error("nested setop");
		expect(q.body.left.op).toBe("union");
	});

	it("lowers a VALUES statement to literal-named projections", () => {
		const { body } = selectBody("VALUES (1, 2), (3, 4)");
		expect(body.projections.map((p) => p.name)).toEqual(["column_0", "column_1"]);
		expect(body.projections[0].expr).toMatchObject({ kind: "literal", text: "1" });
	});

	it("models IN, LIKE and BETWEEN predicates", () => {
		const inp = selectBody("SELECT a FROM t WHERE a IN (1, 2, 3)").body;
		expect(inp.where).toMatchObject({ kind: "predicate", op: "in", negated: false });
		const lk = selectBody("SELECT a FROM t WHERE a LIKE 'x%'").body;
		expect(lk.where).toMatchObject({ kind: "predicate", op: "like" });
		const bw = selectBody("SELECT a FROM t WHERE a NOT BETWEEN 1 AND 2").body;
		expect(bw.where).toMatchObject({ kind: "predicate", op: "between", negated: true });
	});

	it("models a scalar function call and a CASE expression", () => {
		const fn = selectBody("SELECT upper(name) AS u FROM t").body;
		expect(fn.projections[0].expr).toMatchObject({ kind: "function", name: "upper" });
		const cs = selectBody("SELECT CASE WHEN a > 0 THEN 1 ELSE 0 END AS c FROM t").body;
		expect(cs.projections[0].expr).toMatchObject({ kind: "case" });
	});

	it("wires scalar / IN / EXISTS subqueries into SelectExpr.subqueries", () => {
		const scalar = selectBody("SELECT (SELECT max(x) FROM u) AS m FROM t").body;
		expect(scalar.subqueries).toHaveLength(1);
		const inq = selectBody("SELECT a FROM t WHERE a IN (SELECT x FROM u)").body;
		expect(inq.subqueries).toHaveLength(1);
		const exists = selectBody("SELECT a FROM t WHERE EXISTS(SELECT 1 FROM u)").body;
		expect(exists.subqueries).toHaveLength(1);
	});

	it("does NOT count a FROM subquery as an expression subquery", () => {
		const { body } = selectBody("SELECT s.a FROM (SELECT a FROM t) s WHERE s.a IN (SELECT x FROM u)");
		expect(body.from[0].kind).toBe("subquery");
		expect(body.subqueries).toHaveLength(1); // only the WHERE IN subquery, not the FROM one
	});

	it("lowers a non-SELECT statement to an unsupported non-query with a sensible category", () => {
		const { q } = ir("CREATE TABLE t (a INT, b TEXT)");
		expect(q.statement).toBe("ddl");
		if (q.body.kind !== "select") throw new Error("expected flagged select body");
		expect(q.body.unsupported).toContain("non-query");
	});

	it("categorizes DML, DDL, TCL, DCL and utility statement families", () => {
		expect(ir("INSERT INTO t (a) VALUES (1)").q.statement).toBe("dml");
		expect(ir("UPDATE t SET a = 1 WHERE b = 2").q.statement).toBe("dml");
		expect(ir("DELETE FROM t WHERE a = 1").q.statement).toBe("dml");
		expect(ir("REPLACE INTO t (a) VALUES (1)").q.statement).toBe("dml");
		expect(ir("DROP TABLE t").q.statement).toBe("ddl");
		expect(ir("START TRANSACTION").q.statement).toBe("tcl");
		expect(ir("COMMIT").q.statement).toBe("tcl");
		expect(ir("SET @x = 1").q.statement).toBe("utility");
		expect(ir("SHOW TABLES").q.statement).toBe("utility");
		expect(ir("GRANT SELECT ON t TO u").q.statement).toBe("dcl");
	});

	it("flags a multi-statement batch as a compound non-query", () => {
		const { q } = ir("SELECT 1; SELECT 2");
		expect(q.statement).toBe("compound");
		if (q.body.kind !== "select") throw new Error("expected flagged select body");
		expect(q.body.unsupported).toContain("multi-statement");
	});

	// lower() is TOTAL — never throws, even on the broken/partial input the editor feeds it.
	it("never throws on deliberately broken input", () => {
		for (const sql of ["SELECT", "SELECT FROM WHERE", "SELECT a FROM", "WITH x AS (", ")(;;", "", "SELECT a FROM t JOIN"]) {
			expect(() => lower(parseMysql(sql).tree)).not.toThrow();
		}
	});
});
