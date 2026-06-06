import { describe, expect, it } from "vitest";
import { parseDatabricks } from "../src/databricks/parse.js";
import { lower, type QueryBody, type SelectExpr } from "../src/databricks/ir.js";

function asSelect(body: QueryBody): SelectExpr {
  if (body.kind !== "select") throw new Error("expected a select body");
  return body;
}

describe("lower: CST -> IR", () => {
  it("lowers a simple SELECT to a SelectExpr with projections and a table source", () => {
    const { tree, errors } = parseDatabricks("SELECT a FROM t");
    expect(errors).toBe(0);

    const ir = lower(tree);
    expect(ir.body.kind).toBe("select");
    if (ir.body.kind !== "select") throw new Error("expected a select body");

    expect(ir.body.projections.map((p) => p.name)).toEqual(["a"]);
    expect(ir.body.from).toHaveLength(1);
    expect(ir.body.from[0]).toMatchObject({ kind: "table", name: ["t"] });
  });

  it("lowers a WITH clause into CteDefs with a name and a query body", () => {
    const { tree, errors } = parseDatabricks("WITH c AS (SELECT 1 AS x) SELECT a FROM c");
    expect(errors).toBe(0);

    const ir = lower(tree);
    expect(ir.ctes).toHaveLength(1);
    expect(ir.ctes[0].name).toBe("c");
    expect(ir.ctes[0].body.kind).toBe("query");
    expect(ir.ctes[0].body.body.kind).toBe("select");

    // The main query still resolves its own FROM independently of the CTE body.
    expect(asSelect(ir.body).from).toMatchObject([{ kind: "table", name: ["c"] }]);
  });

  it("captures a table alias", () => {
    const ir = lower(parseDatabricks("SELECT x FROM t AS a").tree);
    expect(asSelect(ir.body).from).toMatchObject([{ kind: "table", name: ["t"], alias: "a" }]);
  });

  it("captures both relations of a JOIN as separate sources", () => {
    const ir = lower(parseDatabricks("SELECT x FROM a JOIN b ON a.id = b.id").tree);
    expect(asSelect(ir.body).from).toMatchObject([
      { kind: "table", name: ["a"] },
      { kind: "table", name: ["b"] },
    ]);
  });

  it("treats a derived table as a subquery source without leaking its inner tables", () => {
    const ir = lower(parseDatabricks("SELECT x FROM (SELECT a FROM t) sub").tree);
    const select = asSelect(ir.body);
    expect(select.from).toHaveLength(1);
    const src = select.from[0];
    expect(src.kind).toBe("subquery");
    if (src.kind !== "subquery") throw new Error("expected a subquery source");
    expect(src.alias).toBe("sub");
    expect(src.query.body.kind).toBe("select");
    if (src.query.body.kind !== "select") throw new Error("expected select");
    expect(src.query.body.from).toMatchObject([{ kind: "table", name: ["t"] }]);
  });

  it("names an implicit projection alias (no AS)", () => {
    const sel = asSelect(lower(parseDatabricks("SELECT a x FROM t").tree).body);
    expect(sel.projections[0].name).toBe("x");
  });

  it("captures an implicit table alias (no AS)", () => {
    const sel = asSelect(lower(parseDatabricks("SELECT a FROM t u").tree).body);
    expect(sel.from[0]).toMatchObject({ kind: "table", alias: "u" });
  });

  it("captures CTE column aliases", () => {
    const ir = lower(parseDatabricks("WITH c (x, y) AS (SELECT a, b FROM t) SELECT a FROM c").tree);
    expect(ir.ctes[0].columnAliases).toEqual(["x", "y"]);
  });

  it("captures table column aliases", () => {
    const sel = asSelect(lower(parseDatabricks("SELECT a FROM t AS u (c1, c2)").tree).body);
    expect(sel.from[0]).toMatchObject({ kind: "table", alias: "u", columnAliases: ["c1", "c2"] });
  });

  it("names a qualified column by its last part (structurally, not by regex)", () => {
    const sel = asSelect(lower(parseDatabricks("SELECT t.col, a.b.c FROM t").tree).body);
    expect(sel.projections.map((p) => p.name)).toEqual(["col", "c"]);
  });

  it("gives a compound expression no inferred name", () => {
    const sel = asSelect(lower(parseDatabricks("SELECT a + b FROM t").tree).body);
    expect(sel.projections[0].name).toBeUndefined();
    expect(sel.projections[0].isStar).toBe(false);
  });

  it("flags a qualified star (t.*) as a star", () => {
    const sel = asSelect(lower(parseDatabricks("SELECT t.* FROM t").tree).body);
    expect(sel.projections[0].isStar).toBe(true);
  });

  it("uses the query's own FROM, not a scalar subquery's in the SELECT list", () => {
    const sel = asSelect(
      lower(parseDatabricks("SELECT (SELECT x FROM inner_t) AS s, a FROM main_t").tree).body,
    );
    expect(sel.from).toMatchObject([{ kind: "table", name: ["main_t"] }]);
  });

  it("does not count a scalar subquery's inner projection as a top-level projection", () => {
    const sel = asSelect(
      lower(parseDatabricks("SELECT (SELECT x FROM inner_t) AS s, a FROM main_t").tree).body,
    );
    expect(sel.projections.map((p) => p.name)).toEqual(["s", "a"]);
  });

  it("does not treat a subquery in a JOIN/WHERE condition as a FROM source", () => {
    const sel = asSelect(
      lower(parseDatabricks("SELECT a FROM t JOIN u ON t.id IN (SELECT id FROM other)").tree).body,
    );
    expect(sel.from).toMatchObject([
      { kind: "table", name: ["t"] },
      { kind: "table", name: ["u"] },
    ]);
  });

  it("collects column references at the select level (projections + WHERE)", () => {
    const sel = asSelect(lower(parseDatabricks("SELECT a, t.b FROM t WHERE c > 1").tree).body);
    expect(sel.columns.map((c) => c.parts.join("."))).toEqual(
      expect.arrayContaining(["a", "t.b", "c"]),
    );
  });

  it("does not collect column references from inside a subquery", () => {
    const sel = asSelect(lower(parseDatabricks("SELECT x FROM (SELECT inner_col FROM t) s").tree).body);
    expect(sel.columns.map((c) => c.parts.join("."))).not.toContain("inner_col");
  });

  it("flags an unsupported PIVOT rather than silently mis-modelling it", () => {
    const sel = asSelect(
      lower(parseDatabricks("SELECT * FROM t PIVOT (sum(x) FOR y IN ('a', 'b'))").tree).body,
    );
    expect(sel.unsupported).toContain("pivot");
  });

  it("has no unsupported flag for a plain select", () => {
    const sel = asSelect(lower(parseDatabricks("SELECT a FROM t").tree).body);
    expect(sel.unsupported).toBeUndefined();
  });

  it("lowers a set operation into a SetOpExpr with both branches", () => {
    const ir = lower(parseDatabricks("SELECT a FROM t UNION ALL SELECT b FROM u").tree);
    expect(ir.body.kind).toBe("setop");
    if (ir.body.kind !== "setop") throw new Error("expected a setop body");

    expect(ir.body.op).toBe("union");
    expect(ir.body.all).toBe(true);
    expect(ir.body.left.kind).toBe("select");
    expect(ir.body.right.kind).toBe("select");
    if (ir.body.left.kind !== "select" || ir.body.right.kind !== "select") throw new Error("selects");
    expect(ir.body.left.from).toMatchObject([{ kind: "table", name: ["t"] }]);
    expect(ir.body.right.from).toMatchObject([{ kind: "table", name: ["u"] }]);
  });
});
