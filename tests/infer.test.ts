import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/ir.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { inferType } from "../src/infer/infer.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";

function typeOf(sql: string, schema: Schema) {
  const tree = resolveScopes(lower(parseDatabricks(sql).tree));
  const body = tree.root.body;
  if (body.kind !== "select") throw new Error("expected select");
  return inferType(body.projections[0].expr, tree.root, schema);
}

describe("inferType", () => {
  it("types an integer literal", () => {
    expect(typeOf("SELECT 42 FROM t", new Schema({}))).toEqual({ kind: "scalar", name: "int" });
  });

  it("types a string literal", () => {
    expect(typeOf("SELECT 'x' FROM t", new Schema({}))).toEqual({ kind: "scalar", name: "string" });
  });

  it("types a cast as its target type", () => {
    expect(typeOf("SELECT cast(a AS double) FROM t", new Schema({}))).toEqual({
      kind: "scalar",
      name: "double",
    });
  });

  it("types a base-table column from the schema", () => {
    expect(typeOf("SELECT a FROM t", new Schema({ t: { a: "bigint" } }))).toEqual({
      kind: "scalar",
      name: "bigint",
    });
  });

  it("types a column threaded through a CTE (recursive origin-walk)", () => {
    expect(
      typeOf("WITH c AS (SELECT a FROM t) SELECT a FROM c", new Schema({ t: { a: "bigint" } })),
    ).toEqual({ kind: "scalar", name: "bigint" });
  });

  it("types struct field access via the column's struct type", () => {
    expect(
      typeOf("SELECT t.addr.city FROM t", new Schema({ t: { addr: "struct<city:string>" } })),
    ).toEqual({ kind: "scalar", name: "string" });
  });

  it("types a predicate as boolean", () => {
    expect(typeOf("SELECT a IS NULL FROM t", new Schema({}))).toEqual({
      kind: "scalar",
      name: "boolean",
    });
  });

  it("does not terminate-loop on a recursive CTE (returns a type, unknown is fine)", () => {
    const t = typeOf(
      "WITH RECURSIVE c(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM c) SELECT n FROM c",
      new Schema({}),
    );
    expect(t.kind).toBeDefined();
  });

  it("returns unknown for an expression with no rule yet (a + b)", () => {
    expect(typeOf("SELECT a + b FROM t", new Schema({ t: { a: "int", b: "int" } }))).toEqual({
      kind: "unknown",
    });
  });
});
