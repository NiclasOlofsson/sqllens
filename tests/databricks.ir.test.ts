import { describe, expect, it } from "vitest";
import { parseDatabricks } from "../src/databricks/parse.js";
import { lower } from "../src/databricks/ir.js";

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
    expect(ir.body.from).toMatchObject([{ kind: "table", name: ["c"] }]);
  });
});
