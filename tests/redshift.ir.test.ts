import { describe, expect, it } from "vitest";
import type { Expr, QueryExpr, SelectExpr, SetOpExpr } from "../src/ir/ir.js";
import { lower } from "../src/redshift/lower.js";
import { parseRedshift } from "../src/redshift/parse.js";

// IR lowering for Redshift (CST -> the shared dialect-neutral IR). Tests encode the SEMANTIC
// shape each query should lower to, so a regression in lower() — or a wrong CST assumption —
// fails here. The semantic layer (scope/qualify/infer/lineage) runs on this IR unchanged.

function ir(sql: string): QueryExpr {
	const { tree, errors } = parseRedshift(sql);
	expect(errors, `parse errors for: ${sql}`).toBe(0);
	return lower(tree);
}

function selectBody(sql: string): SelectExpr {
	const q = ir(sql);
	if (q.body.kind !== "select") throw new Error(`expected select body, got ${q.body.kind}`);
	return q.body;
}

describe("Redshift lower — SELECT skeleton", () => {
	it("projections and a table source", () => {
		const b = selectBody("SELECT a, b FROM t");
		expect(b.projections.map((p) => p.name)).toEqual(["a", "b"]);
		expect(b.from).toHaveLength(1);
		expect(b.from[0]).toMatchObject({ kind: "table", name: ["t"] });
	});

	it("table alias and qualified name", () => {
		const b = selectBody("SELECT x.a FROM schema.tbl x");
		expect(b.from[0]).toMatchObject({ kind: "table", name: ["schema", "tbl"], alias: "x" });
		expect(b.projections[0].expr).toMatchObject({ kind: "column", parts: ["x", "a"] });
	});

	it("SELECT * is a star projection", () => {
		const b = selectBody("SELECT * FROM t");
		expect(b.projections[0]).toMatchObject({ isStar: true });
		expect(b.projections[0].expr.kind).toBe("star");
	});

	it("qualified star t.*", () => {
		const b = selectBody("SELECT t.* FROM t");
		expect(b.projections[0].expr).toMatchObject({ kind: "star", qualifier: ["t"] });
	});

	it("alias via AS", () => {
		const b = selectBody("SELECT a + 1 AS total FROM t");
		expect(b.projections[0].name).toBe("total");
		expect(b.projections[0].expr).toMatchObject({ kind: "binary", op: "+" });
	});
});

describe("Redshift lower — expressions", () => {
	it("WHERE binary comparison", () => {
		const b = selectBody("SELECT a FROM t WHERE a > 10");
		expect(b.where).toMatchObject({ kind: "binary", op: ">" });
	});

	it("AND / OR nest by precedence", () => {
		const b = selectBody("SELECT a FROM t WHERE a = 1 OR b = 2 AND c = 3");
		// OR is the top operator; the right side is the AND.
		expect(b.where).toMatchObject({ kind: "binary", op: "or" });
		const or = b.where as Extract<Expr, { kind: "binary" }>;
		expect(or.right).toMatchObject({ kind: "binary", op: "and" });
	});

	it("function call, aggregate flagged", () => {
		const b = selectBody("SELECT sum(x), upper(name) FROM t");
		const sum = b.projections[0].expr as Extract<Expr, { kind: "function" }>;
		expect(sum).toMatchObject({ kind: "function", name: "sum", aggregate: true });
		expect(b.projections[1].expr).toMatchObject({ kind: "function", name: "upper", aggregate: false });
		expect(b.aggregated).toBe(true);
	});

	it(":: typecast", () => {
		const b = selectBody("SELECT a::int FROM t");
		expect(b.projections[0].expr).toMatchObject({ kind: "cast", typeText: "int" });
	});

	it("CAST(... AS ...)", () => {
		const b = selectBody("SELECT CAST(a AS varchar) FROM t");
		expect(b.projections[0].expr).toMatchObject({ kind: "cast" });
	});

	it("CASE expression", () => {
		const b = selectBody("SELECT CASE WHEN a > 0 THEN 'p' ELSE 'n' END FROM t");
		const c = b.projections[0].expr as Extract<Expr, { kind: "case" }>;
		expect(c.kind).toBe("case");
		expect(c.whens).toHaveLength(1);
		expect(c.elseExpr).toBeDefined();
	});

	it("window function OVER", () => {
		const b = selectBody("SELECT row_number() OVER (PARTITION BY dept ORDER BY salary) FROM emp");
		const f = b.projections[0].expr as Extract<Expr, { kind: "function" }>;
		expect(f.kind).toBe("function");
		expect(f.window).toBeDefined();
		expect(f.window?.partitionBy).toHaveLength(1);
	});

	it("IN predicate", () => {
		const b = selectBody("SELECT a FROM t WHERE a IN (1, 2, 3)");
		expect(b.where).toMatchObject({ kind: "predicate", op: "in", negated: false });
	});

	it("BETWEEN predicate", () => {
		const b = selectBody("SELECT a FROM t WHERE a BETWEEN 1 AND 10");
		expect(b.where).toMatchObject({ kind: "predicate", op: "between" });
	});

	it("IS NULL predicate", () => {
		const b = selectBody("SELECT a FROM t WHERE a IS NOT NULL");
		expect(b.where).toMatchObject({ kind: "predicate", op: "null", negated: true });
	});

	it("LIKE predicate", () => {
		const b = selectBody("SELECT a FROM t WHERE a LIKE 'x%'");
		expect(b.where).toMatchObject({ kind: "predicate", op: "like" });
	});

	it("scalar subquery in projection collected", () => {
		const b = selectBody("SELECT (SELECT max(x) FROM u) AS m FROM t");
		expect(b.subqueries?.length).toBe(1);
	});
});

describe("Redshift lower — clauses", () => {
	it("GROUP BY and HAVING", () => {
		const b = selectBody("SELECT dept, count(*) FROM emp GROUP BY dept HAVING count(*) > 5");
		expect(b.groupBy).toHaveLength(1);
		expect(b.groupBy?.[0]).toMatchObject({ kind: "column", parts: ["dept"] });
		expect(b.having).toBeDefined();
		expect(b.aggregated).toBe(true);
	});

	it("ORDER BY and LIMIT hoist to query level", () => {
		const q = ir("SELECT a FROM t ORDER BY a DESC LIMIT 5");
		expect(q.orderBy).toHaveLength(1);
		expect(q.limit?.top).toMatchObject({ kind: "literal", text: "5" });
	});

	it("QUALIFY", () => {
		const b = selectBody("SELECT a, row_number() OVER (ORDER BY a) rn FROM t QUALIFY rn = 1");
		expect(b.qualify).toBeDefined();
	});

	it("join ON condition captured", () => {
		const b = selectBody("SELECT a FROM t JOIN u ON t.id = u.id");
		expect(b.from).toHaveLength(2);
		expect(b.joinConditions).toHaveLength(1);
		expect(b.joinConditions?.[0]).toMatchObject({ kind: "binary", op: "=" });
	});

	it("comma-join (two sources, no condition)", () => {
		const b = selectBody("SELECT a FROM t, u");
		expect(b.from).toHaveLength(2);
	});

	it("subquery source", () => {
		const b = selectBody("SELECT s.a FROM (SELECT a FROM t) s");
		expect(b.from[0]).toMatchObject({ kind: "subquery", alias: "s" });
		const sub = b.from[0] as Extract<typeof b.from[0], { kind: "subquery" }>;
		expect(sub.query.body.kind).toBe("select");
	});
});

describe("Redshift lower — CTE, set ops, VALUES", () => {
	it("WITH cte", () => {
		const q = ir("WITH c AS (SELECT a FROM t) SELECT a FROM c");
		expect(q.ctes).toHaveLength(1);
		expect(q.ctes[0].name).toBe("c");
		expect(q.ctes[0].body.body.kind).toBe("select");
	});

	it("UNION ALL set op", () => {
		const q = ir("SELECT a FROM t UNION ALL SELECT a FROM u");
		expect(q.body.kind).toBe("setop");
		const s = q.body as SetOpExpr;
		expect(s.op).toBe("union");
		expect(s.all).toBe(true);
	});

	it("EXCEPT / INTERSECT", () => {
		expect((ir("SELECT a FROM t EXCEPT SELECT a FROM u").body as SetOpExpr).op).toBe("except");
		expect((ir("SELECT a FROM t INTERSECT SELECT a FROM u").body as SetOpExpr).op).toBe("intersect");
	});

	it("VALUES lowers to a modelled select", () => {
		const b = selectBody("VALUES (1, 'a'), (2, 'b')");
		expect(b.projections).toHaveLength(2);
		expect(b.projections[0].expr.kind).toBe("literal");
	});
});

describe("Redshift lower — visible gaps", () => {
	it("PIVOT is flagged unsupported, not silently dropped", () => {
		const b = selectBody("SELECT * FROM sales PIVOT (sum(qty) FOR region IN ('A', 'B'))");
		expect(b.unsupported).toContain("pivot");
	});

	it("UNPIVOT is flagged unsupported", () => {
		const b = selectBody("SELECT * FROM (SELECT a, b FROM t) UNPIVOT (v FOR n IN (a, b))");
		expect(b.unsupported).toContain("unpivot");
	});

	it("CONNECT BY is flagged unsupported", () => {
		const b = selectBody("SELECT id FROM t CONNECT BY PRIOR id = pid START WITH id = 1");
		expect(b.unsupported).toContain("connect-by");
	});
});

describe("Redshift lower — non-query", () => {
	it("a non-SELECT statement lowers to a flagged non-query body, never throws", () => {
		const q = ir("CREATE TABLE t (a int)");
		expect(q.body.kind).toBe("select");
		expect((q.body as SelectExpr).unsupported).toBeDefined();
		expect(q.statement).toBe("ddl");
	});
});
