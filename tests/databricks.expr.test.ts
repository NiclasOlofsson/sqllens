import { describe, expect, it } from "vitest";
import { lower, type Expr, type SelectExpr } from "../src/databricks/ir.js";
import { parseDatabricks } from "../src/databricks/parse.js";

function selectOf(sql: string): SelectExpr {
  const body = lower(parseDatabricks(sql).tree).body;
  if (body.kind !== "select") throw new Error("expected select");
  return body;
}
function exprOf(sql: string): Expr {
  const e = selectOf(sql).projections[0].expr;
  if (!e) throw new Error("no projection expr");
  return e;
}

describe("lowerExpression", () => {
  it("lowers a column reference", () => {
    expect(exprOf("SELECT t.a FROM t")).toMatchObject({ kind: "column", parts: ["t", "a"] });
  });

  it("lowers a literal", () => {
    expect(exprOf("SELECT 42 FROM t")).toMatchObject({ kind: "literal" });
  });

  it("lowers arithmetic into a binary expr", () => {
    expect(exprOf("SELECT a + b FROM t")).toMatchObject({
      kind: "binary",
      op: "+",
      left: { kind: "column", parts: ["a"] },
      right: { kind: "column", parts: ["b"] },
    });
  });

  it("lowers a comparison into a binary expr", () => {
    expect(exprOf("SELECT a = b FROM t")).toMatchObject({ kind: "binary", op: "=" });
  });

  it("lowers a function call with its arguments", () => {
    const e = exprOf("SELECT coalesce(a, 0) FROM t");
    expect(e).toMatchObject({ kind: "function", name: "coalesce" });
    if (e.kind !== "function") throw new Error("fn");
    expect(e.args).toHaveLength(2);
    expect(e.args[0]).toMatchObject({ kind: "column", parts: ["a"] });
  });

  it("marks an aggregate function", () => {
    expect(exprOf("SELECT sum(x) FROM t")).toMatchObject({ kind: "function", name: "sum", aggregate: true });
  });

  it("captures a window function's OVER partition/order", () => {
    const e = exprOf("SELECT row_number() OVER (PARTITION BY y ORDER BY z) FROM t");
    expect(e).toMatchObject({ kind: "function", name: "row_number" });
    if (e.kind !== "function") throw new Error("fn");
    expect(e.window?.partitionBy).toHaveLength(1);
    expect(e.window?.orderBy).toHaveLength(1);
  });

  it("lowers CASE", () => {
    const e = exprOf("SELECT CASE WHEN a = 1 THEN 'x' ELSE 'y' END FROM t");
    expect(e.kind).toBe("case");
  });

  it("lowers a CAST", () => {
    expect(exprOf("SELECT cast(a AS string) FROM t")).toMatchObject({ kind: "cast" });
  });

  it("represents an unmodelled expression explicitly as 'other', never dropped", () => {
    // a:b semi-structured access isn't modelled — but it must still be an Expr node.
    const e = exprOf("SELECT a IS NOT NULL FROM t");
    expect(e.kind).toBe("other");
  });
});

describe("aggregation clauses", () => {
  it("captures GROUP BY / HAVING as exprs and marks the select aggregated", () => {
    const sel = selectOf("SELECT a, sum(x) FROM t GROUP BY a HAVING sum(x) > 1");
    expect(sel.groupBy).toHaveLength(1);
    expect(sel.having).toBeDefined();
    expect(sel.aggregated).toBe(true);
  });

  it("marks a select with an aggregate but no GROUP BY as aggregated", () => {
    expect(selectOf("SELECT count(*) FROM t").aggregated).toBe(true);
  });

  it("a plain select is not aggregated", () => {
    expect(selectOf("SELECT a FROM t").aggregated).toBe(false);
  });

  it("lowers WHERE into an expr", () => {
    const sel = selectOf("SELECT a FROM t WHERE a > 1");
    expect(sel.where).toMatchObject({ kind: "binary", op: ">" });
  });
});
