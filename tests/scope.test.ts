import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/ir.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { resolveScopes } from "../src/scope/scope.js";

function scopeOf(sql: string) {
  return resolveScopes(lower(parseDatabricks(sql).tree));
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
});
