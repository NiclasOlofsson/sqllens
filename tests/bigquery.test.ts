import { describe, expect, it } from "vitest";
import { parseBigQuery } from "../src/bigquery/parse.js";

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

	it("never throws and records columns for resolution", () => {
		const b = q("SELECT t.a, f(t.b) + 1 AS e FROM t WHERE t.c IS NOT NULL");
		const cols = b.columns.map((c) => c.parts.join("."));
		expect(cols).toContain("t.a");
		expect(cols).toContain("t.b");
		expect(cols).toContain("t.c");
	});
});
