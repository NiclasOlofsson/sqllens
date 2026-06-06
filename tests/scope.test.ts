import { describe, expect, it } from "vitest";
import { lower, type SelectExpr } from "../src/databricks/ir.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { resolveColumn, resolveScopes } from "../src/scope/scope.js";

function scopeOf(sql: string) {
  return resolveScopes(lower(parseDatabricks(sql).tree));
}

function colOf(sql: string, partsJoined: string) {
  const ir = lower(parseDatabricks(sql).tree);
  const sel = ir.body as SelectExpr;
  const ref = sel.columns.find((c) => c.parts.join(".") === partsJoined);
  if (!ref) throw new Error(`no column ${partsJoined}`);
  return { ref, root: resolveScopes(ir).root };
}

describe("resolveScopes", () => {
  it("registers a FROM table as a source keyed by its name", () => {
    const { root } = scopeOf("SELECT a FROM t");
    const src = root.sources.get("t");
    expect(src?.kind).toBe("table");
    if (src?.kind !== "table") throw new Error("expected a table source");
    expect(src.name).toEqual(["t"]);
  });

  it("keys a source by its alias when present", () => {
    const { root } = scopeOf("SELECT a FROM cat.sch.t AS x");
    expect(root.sources.has("x")).toBe(true);
    expect(root.sources.has("t")).toBe(false);
  });

  it("resolves a FROM reference to a CTE as a cte source, not a physical table", () => {
    const { root } = scopeOf("WITH c AS (SELECT a, b FROM t) SELECT a FROM c");
    expect(root.sources.get("c")?.kind).toBe("cte");
    expect(root.ctes.has("c")).toBe(true);
  });

  it("computes output columns from the projection list", () => {
    const { root } = scopeOf("SELECT a, b FROM t");
    expect(root.outputs).toEqual(["a", "b"]);
  });

  it("marks outputs unknown when a projection is a star (needs schema)", () => {
    const { root } = scopeOf("SELECT * FROM t");
    expect(root.outputs).toBe("unknown");
  });

  it("exposes a CTE's own output columns through its scope", () => {
    const { root } = scopeOf("WITH c AS (SELECT a, b FROM t) SELECT a FROM c");
    expect(root.ctes.get("c")?.scope.outputs).toEqual(["a", "b"]);
  });

  it("uses a CTE's declared column aliases as its outputs, overriding inner names", () => {
    const { root } = scopeOf("WITH c (x, y) AS (SELECT a, b FROM t) SELECT a FROM c");
    expect(root.ctes.get("c")?.scope.outputs).toEqual(["x", "y"]);
  });
});

describe("resolveColumn", () => {
  it("binds a qualified column to its source, case-insensitively", () => {
    const { ref, root } = colOf("SELECT T.a FROM tbl AS t", "T.a");
    expect(resolveColumn(root, ref).kind).toBe("bound");
  });

  it("does not bind a qualified column whose qualifier matches no source", () => {
    const { ref, root } = colOf("SELECT nope.a FROM tbl AS t", "nope.a");
    expect(resolveColumn(root, ref).kind).toBe("unresolved");
  });

  it("binds an unqualified column to the only source that exposes it (a CTE)", () => {
    const { ref, root } = colOf("WITH c AS (SELECT a, b FROM t) SELECT a FROM c", "a");
    expect(resolveColumn(root, ref).kind).toBe("bound");
  });

  it("needs a schema for an unqualified column over a physical table", () => {
    const { ref, root } = colOf("SELECT a FROM t", "a");
    expect(resolveColumn(root, ref).kind).toBe("needs-schema");
  });

  it("flags an ambiguous unqualified column across two CTEs that both expose it", () => {
    const { ref, root } = colOf(
      "WITH c1 AS (SELECT a FROM t), c2 AS (SELECT a FROM u) SELECT a FROM c1 JOIN c2",
      "a",
    );
    expect(resolveColumn(root, ref).kind).toBe("ambiguous");
  });
});
