import { describe, expect, it } from "vitest";
import { lower } from "../src/mysql/lower.js";
import { parseMysql } from "../src/mysql/parse.js";
import { analyze } from "../src/api.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";
import { referencesAt } from "../src/references/references.js";

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
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t"] } });
		expect(body.where).toMatchObject({ kind: "binary", op: ">" });
		expect(body.columns.some((c) => c.clause === "where" && c.parts.join(".") === "a")).toBe(true);
	});

	it("captures column and table aliases, with and without AS", () => {
		const { body } = selectBody("SELECT t.a AS x, t.b y FROM db.tbl t");
		expect(body.projections[0].name).toBe("x");
		expect(body.projections[0].expr).toMatchObject({ kind: "column", parts: ["t", "a"] });
		expect(body.projections[0].aliasCst).toBeDefined();
		expect(body.projections[1].name).toBe("y");
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["db", "tbl"] }, alias: "t" });
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
		expect(bt.from[0]).toMatchObject({ kind: "table", relation: { parts: ["tbl"] } });
		const dq = selectBody('SELECT "col" FROM "tbl"').body;
		expect(dq.projections[0].expr).toMatchObject({ kind: "column", parts: ['"col"'] });
		expect(dq.from[0]).toMatchObject({ kind: "table", relation: { parts: ['"tbl"'] } });
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
		const left = selectBody("SELECT * FROM a LEFT OUTER JOIN b ON a.id = b.id").body;
		expect(left.joins?.[0]).toMatchObject({ kind: "left" });
		const using = selectBody("SELECT * FROM a INNER JOIN b USING (id)").body;
		expect(using.joins?.[0]).toMatchObject({ kind: "inner", using: ["id"] });
	});

	// Regression: LEFT / RIGHT are RESERVED words (dev.mysql.com/doc/refman/8.4/en/keywords.html), so
	// they were pulled out of the keyword-as-identifier path (scalarFunctionName → simpleId). Before the
	// fix, bare `LEFT JOIN` mis-parsed `LEFT` as table `a`'s alias and degraded the join to inner.
	it("captures a bare LEFT JOIN as a left join with no alias swallowed", () => {
		const { body } = selectBody("SELECT a FROM t1 LEFT JOIN t2 ON t1.id = t2.id");
		expect(body.joins?.[0]).toMatchObject({ kind: "left" });
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t1"] } });
		expect(body.from[0].alias).toBeUndefined(); // `LEFT` is NOT consumed as t1's alias
	});

	it("captures a bare RIGHT JOIN as a right join with no alias swallowed", () => {
		const { body } = selectBody("SELECT a FROM t1 RIGHT JOIN t2 ON t1.id = t2.id");
		expect(body.joins?.[0]).toMatchObject({ kind: "right" });
		expect(body.from[0].alias).toBeUndefined();
	});

	it("still parses LEFT()/RIGHT() as reserved-word string functions in call position", () => {
		const l = selectBody("SELECT LEFT(name, 3) AS p FROM t").body;
		expect(l.projections[0].expr).toMatchObject({ kind: "function", name: "left" });
		const r = selectBody("SELECT RIGHT(name, 3) AS s FROM t").body;
		expect(r.projections[0].expr).toMatchObject({ kind: "function", name: "right" });
	});

	it("still admits a backtick-quoted `LEFT` as a table alias", () => {
		const { body } = selectBody("SELECT a FROM t1 `LEFT`");
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t1"] }, alias: "`LEFT`" });
	});

	// Reserved-word identifier audit (dev.mysql.com/doc/refman/8.4/en/keywords.html): the
	// LEFT/RIGHT class, checked systematically. Several RESERVED words are dual-role — a function name
	// AND a statement keyword — and reach the keyword-as-identifier path (scalarFunctionName / IF,
	// INSERT, REPLACE, REPEAT). The audit probed each: none mis-parses a VALID query the way bare LEFT
	// JOIN did (LEFT/RIGHT were the only such case, already fixed). These pin the two positions that must
	// keep working per the manual — the function CALL and, for the INSERT/REPLACE dual-role pair, the
	// statement — so a future edit that pulls one from its call position (as the LEFT/RIGHT fix had to be
	// surgical about) is caught. CONVERT is a specificFunction (CAST-family), never admission-reachable.
	it("keeps dual-role reserved words IF/CONVERT/REPLACE/INSERT/REPEAT parsing as functions in call position", () => {
		expect(selectBody("SELECT IF(a > 0, 1, 2) AS r FROM t").body.projections[0].expr).toMatchObject({
			kind: "function",
			name: "if",
		});
		// CONVERT(expr, type) and CONVERT(expr USING charset) — cast-functions.html — lower to a cast.
		expect(selectBody("SELECT CONVERT(x, CHAR) AS c FROM t").body.projections[0].expr).toMatchObject({
			kind: "cast",
		});
		expect(selectBody("SELECT CONVERT(x USING utf8mb4) AS c FROM t").body.projections[0].expr).toMatchObject({
			kind: "cast",
		});
		expect(selectBody("SELECT REPLACE(s, 'a', 'b') AS r FROM t").body.projections[0].expr).toMatchObject({
			kind: "function",
			name: "replace",
		});
		expect(selectBody("SELECT INSERT(s, 1, 2, 'x') AS r FROM t").body.projections[0].expr).toMatchObject({
			kind: "function",
			name: "insert",
		});
		expect(selectBody("SELECT REPEAT('x', 3) AS r FROM t").body.projections[0].expr).toMatchObject({
			kind: "function",
			name: "repeat",
		});
	});

	it("keeps the INSERT/REPLACE statement forms parsing as DML (the other half of the dual role)", () => {
		// REPLACE INTO / INSERT INTO (replace.html, insert.html) — the same words that are string
		// functions above are also statement verbs; both roles must survive.
		expect(ir("REPLACE INTO t (a) VALUES (1)").q.statement).toBe("dml");
		expect(ir("INSERT INTO t (a) VALUES (1)").q.statement).toBe("dml");
	});

	it("keeps reserved window-function names (RANK / ROW_NUMBER) parsing as calls, not swallowed identifiers", () => {
		// RANK / ROW_NUMBER / DENSE_RANK … are RESERVED (window-function-descriptions.html) and reach
		// functionNameBase; their OVER() call form must not degrade to a bare-identifier read.
		expect(selectBody("SELECT RANK() OVER (ORDER BY a) AS r FROM t").body.projections[0].expr).toMatchObject({
			kind: "function",
			name: "rank",
		});
		expect(selectBody("SELECT ROW_NUMBER() OVER (ORDER BY a) AS rn FROM t").body.projections[0].expr).toMatchObject(
			{
				kind: "function",
				name: "row_number",
			},
		);
	});

	it("captures RIGHT OUTER, CROSS and NATURAL join kinds", () => {
		const right = selectBody("SELECT * FROM a RIGHT OUTER JOIN b ON a.id = b.id").body;
		expect(right.joins?.[0]).toMatchObject({ kind: "right" });
		const cross = selectBody("SELECT * FROM a CROSS JOIN b").body;
		expect(cross.joins?.[0]).toMatchObject({ kind: "cross" });
		const nat = selectBody("SELECT * FROM a NATURAL JOIN b").body;
		expect(nat.joins?.[0]).toMatchObject({ kind: "natural", natural: true });
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

	it("collects the trailing into-tail UNION arm (bare core after loose UNION/ALL tokens)", () => {
		// unionSelect's optional last arm — `UNION (ALL|DISTINCT)? querySpecification` with an INTO —
		// parses as loose UNION/ALL tokens + a bare direct core; it must fold as a third branch,
		// not vanish (B-R3 review finding).
		const q = ir("SELECT 1 FROM t1 UNION SELECT 2 FROM t2 UNION ALL SELECT 3 FROM t3 INTO @a").q;
		if (q.body.kind !== "setop") throw new Error(`expected setop, got ${q.body.kind}`);
		expect(q.body.all).toBe(true); // the trailing arm's loose ALL
		expect(q.body.right.kind).toBe("select");
		if (q.body.left.kind !== "setop") throw new Error("expected nested setop (3 branches)");
		expect(q.body.left.all).toBe(false);
		expect(q.body.left.left.kind).toBe("select");
		expect(q.body.left.right.kind).toBe("select");
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

	it("collects an ORDER BY subquery into SelectExpr.subqueries (walk rooted at the query spec)", () => {
		const { body } = selectBody("SELECT a FROM t ORDER BY (SELECT max(x) FROM u)");
		expect(body.subqueries).toHaveLength(1);
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
		for (const sql of [
			"SELECT",
			"SELECT FROM WHERE",
			"SELECT a FROM",
			"WITH x AS (",
			")(;;",
			"",
			"SELECT a FROM t JOIN",
		]) {
			expect(() => lower(parseMysql(sql).tree)).not.toThrow();
		}
	});
});

// The 8.0.19+ query-expression forms the fork restructure added (docs-corpus wave 2):
// INTERSECT / EXCEPT set operators, TABLE and VALUES ROW(...) as query primaries and operands,
// parenthesized query expressions, and the subqueryBody operand positions. These pin the IR the
// semantic layer consumes — a lowering change that mis-shapes them breaks scope/lineage downstream.
describe("Mysql 8.0.19+ query expressions", () => {
	it("lowers INTERSECT and EXCEPT to setop bodies with the right op", () => {
		const ix = ir("SELECT a FROM t1 INTERSECT SELECT a FROM t2").q;
		if (ix.body.kind !== "setop") throw new Error(`expected setop, got ${ix.body.kind}`);
		expect(ix.body.op).toBe("intersect");
		expect(ix.body.all).toBe(false);
		const ex = ir("TABLE c EXCEPT ALL TABLE a").q;
		if (ex.body.kind !== "setop") throw new Error(`expected setop, got ${ex.body.kind}`);
		expect(ex.body.op).toBe("except");
		expect(ex.body.all).toBe(true);
	});

	it("gives INTERSECT higher precedence than UNION/EXCEPT (set-operations.html)", () => {
		// a UNION b INTERSECT c ≡ a UNION (b INTERSECT c) — the INTERSECT run folds first.
		const q = ir("SELECT a FROM t1 UNION SELECT b FROM t2 INTERSECT SELECT c FROM t3").q;
		if (q.body.kind !== "setop") throw new Error("setop");
		expect(q.body.op).toBe("union");
		expect(q.body.left.kind).toBe("select");
		if (q.body.right.kind !== "setop") throw new Error("expected the INTERSECT to bind right");
		expect(q.body.right.op).toBe("intersect");
	});

	it("folds a parenthesized chain as a unit (parens override precedence)", () => {
		// (a EXCEPT b) INTERSECT c — the parens force the EXCEPT to fold first.
		const q = ir("(SELECT a FROM t1 EXCEPT SELECT b FROM t2) INTERSECT (SELECT c FROM t3)").q;
		if (q.body.kind !== "setop") throw new Error("setop");
		expect(q.body.op).toBe("intersect");
		if (q.body.left.kind !== "setop") throw new Error("expected the parenthesized EXCEPT as the left unit");
		expect(q.body.left.op).toBe("except");
	});

	it("lowers TABLE as a query primary and set-operation operand (table.html)", () => {
		const { q, body } = selectBody("TABLE t1");
		expect(body.projections[0].isStar).toBe(true);
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t1"] } });
		expect(q.statement).toBe("query");
		const un = ir("TABLE t1 UNION TABLE t2 ORDER BY x LIMIT 10").q;
		if (un.body.kind !== "setop") throw new Error("setop");
		expect(un.body.left).toMatchObject({ kind: "select", from: [{ kind: "table", relation: { parts: ["t1"] } }] });
		expect(un.body.right).toMatchObject({ kind: "select", from: [{ kind: "table", relation: { parts: ["t2"] } }] });
		expect(un.orderBy).toHaveLength(1); // the trailing ORDER BY belongs to the RESULT, not the operand
		expect(un.limit?.top).toMatchObject({ text: "10" });
	});

	it("lowers VALUES ROW(...) with hoisted ORDER BY/LIMIT (values.html)", () => {
		const { q, body } = selectBody("VALUES ROW(1,-2,3), ROW(5,7,9) ORDER BY column_1 LIMIT 2");
		expect(body.projections.map((p) => p.name)).toEqual(["column_0", "column_1", "column_2"]);
		expect(body.projections[0].expr).toMatchObject({ kind: "literal", text: "1" });
		expect(q.orderBy).toHaveLength(1);
		expect(q.limit?.top).toMatchObject({ text: "2" });
	});

	it("takes VALUES ROW(...) as a set-operation operand", () => {
		const q = ir("VALUES ROW(4,-2), ROW(5,9) UNION VALUES ROW(1,2), ROW(3,4)").q;
		if (q.body.kind !== "setop") throw new Error("setop");
		expect(q.body.left).toMatchObject({ kind: "select" });
		expect(q.body.right).toMatchObject({ kind: "select" });
	});

	it("takes TABLE and VALUES in subquery operand positions (EXISTS / IN / quantified / scalar)", () => {
		const exists = selectBody("SELECT column1 FROM t1 WHERE EXISTS (TABLE t2)").body;
		expect(exists.where).toMatchObject({ kind: "exists" });
		expect(exists.subqueries).toHaveLength(1);
		const inq = selectBody("SELECT s1 FROM t1 WHERE s1 IN (TABLE t2)").body;
		expect(inq.where).toMatchObject({ kind: "predicate", op: "in" });
		// A quantified comparison at statement-FINAL position parses as ONE query with NO trailing
		// semicolon — sqlStatements now requires a SEMI between statements, so the parenthesized subquery
		// can only continue this statement, not open a second one (the prior mis-split is gone; grammar
		// citation at the predicate rule / sqlStatements). Held without the `;` on purpose.
		const any = selectBody("SELECT * FROM tt WHERE b > ANY (VALUES ROW(2), ROW(4))").body;
		expect(any.where).toMatchObject({ kind: "binary", op: ">" });
		const anyRight = (any.where as { right?: { kind?: string } }).right;
		expect(anyRight).toMatchObject({ kind: "subquery" });
		const scalar = selectBody("SELECT (TABLE t2) FROM t1").body;
		expect(scalar.projections[0].expr).toMatchObject({ kind: "subquery" });
		expect(scalar.subqueries).toHaveLength(1);
	});

	it("captures derived-table column aliases: (SELECT ...) AS dt (a, b) (derived-tables.html)", () => {
		const { body } = selectBody("SELECT * FROM (SELECT 1, 2) AS dt (a, b)");
		expect(body.from[0]).toMatchObject({ kind: "subquery", alias: "dt", columnAliases: ["a", "b"] });
	});

	it("attaches a derived table's own WITH clause to the subquery (with.html)", () => {
		const { body } = selectBody("SELECT * FROM (WITH cte2 AS (SELECT 2) SELECT * FROM cte2) AS dt");
		if (body.from[0].kind !== "subquery") throw new Error("expected subquery source");
		expect(body.from[0].query.ctes).toHaveLength(1);
		expect(body.from[0].query.ctes[0].name).toBe("cte2");
	});

	it("lowers MATCH ... AGAINST as a `match` call carrying every matched column (fulltext-search.html)", () => {
		const { body } = selectBody("SELECT id FROM articles WHERE MATCH (title, body) AGAINST ('db' IN BOOLEAN MODE)");
		expect(body.where).toMatchObject({ kind: "function", name: "match" });
		const cols = body.columns.filter((c) => c.clause === "where").map((c) => c.parts.join("."));
		expect(cols).toContain("title");
		expect(cols).toContain("body");
	});

	it("hoists ORDER BY/LIMIT of a parenthesized query expression: (SELECT ... UNION ...) LIMIT n", () => {
		const q = ir("(SELECT 1 AS r UNION SELECT 2) LIMIT 1 OFFSET 1").q;
		if (q.body.kind !== "setop") throw new Error("expected the inner chain folded as a setop");
		expect(q.limit?.top).toMatchObject({ text: "1" });
		expect(q.limit?.offset).toMatchObject({ text: "1" });
	});
});

// `?` is MySQL's one documented prepared-statement placeholder
// (dev.mysql.com/doc/refman/8.4/en/sql-prepared-statements.html: PREPARE ... FROM 'SELECT ...
// WHERE id = ?'), also substituted by every connector at bind time. The grammar had NO token for
// it at all — `SELECT ? FROM t` errored, and worse, `VALUES (?)` reported ZERO errors while error
// recovery silently swallowed the token, yielding an empty projection list (a lossless
// violation). `@x` / `@@version` are documented user/system variables
// (dev.mysql.com/doc/refman/8.4/en/user-variables.html, .../using-system-variables.html) that
// parsed fine but lowered as anonymous literals. This block pins the PLACEHOLDER token + the
// `parameter`/`variable` IR lowering (src/ir/ir.ts).
describe("Mysql parameter and variable references", () => {
	it("lowers a bare `?` placeholder to a parameter node in SELECT position", () => {
		const { body } = selectBody("SELECT ? FROM t");
		expect(body.projections[0].expr).toMatchObject({ kind: "parameter", text: "?" });
		expect((body.projections[0].expr as { name?: string }).name).toBeUndefined();
	});

	it("lowers `?` to a parameter node in WHERE position", () => {
		const { body } = selectBody("SELECT a FROM t WHERE a = ?");
		expect(body.where).toMatchObject({ kind: "binary", op: "=" });
		expect((body.where as { right?: unknown }).right).toMatchObject({ kind: "parameter", text: "?" });
	});

	// Regression pin for the audit's latent recovery bug: before the PLACEHOLDER token existed,
	// `VALUES (?)` reported 0 syntax errors yet silently dropped the `?`, yielding an EMPTY
	// projection list. It must now parse clean AND keep the placeholder as a real projection.
	it("conserves the `?` in a VALUES row — the audit's silent-swallow regression", () => {
		const { errors } = parseMysql("VALUES (?)");
		expect(errors).toBe(0);
		const { body } = selectBody("VALUES (?)");
		expect(body.projections).toHaveLength(1); // NOT empty — the audit-era bug dropped it
		expect(body.projections[0].expr).toMatchObject({ kind: "parameter", text: "?" });
	});

	// `functionArgs`/`functionArg` (the generic scalar-function call shape most functions use) admit
	// `constant` directly, bypassing expressionAtom — a separate lowering fast path (lowerArg) that
	// had its own un-fixed `constant` -> literal mapping. Pins that `?` gets the same parameter
	// treatment inside a function call, not just in SELECT/WHERE/VALUES position.
	it("lowers `?` to a parameter node as a scalar-function-call argument", () => {
		const { body } = selectBody("SELECT UPPER(?) FROM t");
		expect(body.projections[0].expr).toMatchObject({ kind: "function", name: "upper" });
		const args = (body.projections[0].expr as { args?: unknown[] }).args;
		expect(args?.[0]).toMatchObject({ kind: "parameter", text: "?" });
	});

	it("lowers `@x` (LOCAL_ID) to a user variable node, sigil stripped, not a system variable", () => {
		const { body } = selectBody("SELECT @x FROM t WHERE @x > 1");
		expect(body.projections[0].expr).toMatchObject({ kind: "variable", text: "@x", name: "x" });
		expect((body.projections[0].expr as { system?: boolean }).system).toBeUndefined();
	});

	it("lowers `@@version` (GLOBAL_ID) to a system variable node", () => {
		const { body } = selectBody("SELECT @@version FROM t");
		expect(body.projections[0].expr).toMatchObject({
			kind: "variable",
			text: "@@version",
			name: "version",
			system: true,
		});
	});

	it("keeps the GLOBAL./SESSION. scope qualifier as part of the variable's name (using-system-variables.html)", () => {
		const g = selectBody("SELECT @@GLOBAL.sql_mode FROM t").body;
		expect(g.projections[0].expr).toMatchObject({
			kind: "variable",
			text: "@@GLOBAL.sql_mode",
			name: "GLOBAL.sql_mode",
			system: true,
		});
		const s = selectBody("SELECT @@SESSION.sql_mode FROM t").body;
		expect(s.projections[0].expr).toMatchObject({
			kind: "variable",
			text: "@@SESSION.sql_mode",
			name: "SESSION.sql_mode",
			system: true,
		});
	});

	it("fires no unknown-column diagnostic on a schema-attached analyze for any of these forms", () => {
		const schema = new Schema({ t: { a: "int" } });
		const { diagnostics } = analyze("SELECT ?, @x, @@version, a FROM t WHERE a = ? AND @x > 0", "mysql", {
			schema,
		});
		expect(diagnostics).toEqual([]);
	});

	it("deriveSymbols emits parameter/variable kinds, one Sym per occurrence", () => {
		const scopes = resolveScopes(lower(parseMysql("SELECT ?, @x, @@version FROM t WHERE a = ?").tree), "mysql");
		const syms = deriveSymbols(scopes).filter((s) => s.kind === "parameter" || s.kind === "variable");
		expect(syms.map((s) => [s.kind, s.name])).toEqual([
			["parameter", "?"],
			["variable", "x"],
			["variable", "version"],
			["parameter", "?"],
		]);
		expect(syms.every((s) => s.modifiers.includes("reference"))).toBe(true);
	});

	it("referencesAt groups two `@x` occurrences and keys separately from an unrelated name", () => {
		const sql = "SELECT @x FROM t WHERE @x > 1";
		const scopes = resolveScopes(lower(parseMysql(sql).tree), "mysql");
		const occ = referencesAt(scopes, sql.indexOf("@x"));
		expect(occ).not.toBeNull();
		expect(occ!.kind).toBe("variable");
		expect(occ!.symbol).toBe("x");
		expect(occ!.occurrences).toHaveLength(2);
		expect(occ!.occurrences.every((o) => o.role === "reference")).toBe(true);
	});
});
