import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/ir.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";

function run(sql: string, schema: Schema) {
  const tree = resolveScopes(lower(parseDatabricks(sql).tree));
  return { tree, result: qualify(tree, schema) };
}

describe("qualify", () => {
  it("expands SELECT * using the schema", () => {
    const schema = new Schema({ t: { a: "int", b: "string" } });
    const { tree, result } = run("SELECT * FROM t", schema);
    expect(result.columnsOf(tree.root)).toEqual(["a", "b"]);
  });

  it("resolves a 3-part table name from a nested schema", () => {
    const schema = new Schema({ cat: { sch: { t: { x: "int", y: "int" } } } });
    const { tree, result } = run("SELECT * FROM cat.sch.t", schema);
    expect(result.columnsOf(tree.root)).toEqual(["x", "y"]);
  });

  it("reports an unknown table when a star cannot be expanded", () => {
    const schema = new Schema({ t: { a: "int" } });
    const { result } = run("SELECT * FROM missing", schema);
    expect(result.diagnostics.map((d) => d.kind)).toContain("unknown-table");
  });

  it("expands a star over a CTE using the CTE's own columns (no schema needed)", () => {
    const schema = new Schema({ t: { a: "int", b: "int" } });
    const { tree, result } = run("WITH c AS (SELECT a, b FROM t) SELECT * FROM c", schema);
    expect(result.columnsOf(tree.root)).toEqual(["a", "b"]);
  });

  it("expands a star over a table using its inline column aliases (no schema needed)", () => {
    const { tree, result } = run("SELECT * FROM t AS u (c1, c2)", new Schema({}));
    expect(result.columnsOf(tree.root)).toEqual(["c1", "c2"]);
  });

  it("resolves a bare column against the schema with no diagnostic", () => {
    const { result } = run("SELECT a FROM t", new Schema({ t: { a: "int", b: "int" } }));
    expect(result.diagnostics).toEqual([]);
  });

  it("flags a column not present in its table's schema", () => {
    const { result } = run("SELECT nope FROM t", new Schema({ t: { a: "int" } }));
    expect(result.diagnostics.map((d) => d.kind)).toContain("unknown-column");
  });

  it("flags a qualified column not present in its source", () => {
    const { result } = run("SELECT t.nope FROM t", new Schema({ t: { a: "int" } }));
    expect(result.diagnostics.map((d) => d.kind)).toContain("unknown-column");
  });

  it("flags an ambiguous bare column present in two joined tables", () => {
    const { result } = run(
      "SELECT id FROM t JOIN u ON t.x = u.y",
      new Schema({ t: { id: "int", x: "int" }, u: { id: "int", y: "int" } }),
    );
    expect(result.diagnostics.map((d) => d.kind)).toContain("ambiguous-column");
  });

  it("emits no column diagnostics without a schema (columns unknown)", () => {
    const { result } = run("SELECT whatever FROM t", new Schema({}));
    expect(result.diagnostics.filter((d) => d.kind !== "unknown-table")).toEqual([]);
  });
});
