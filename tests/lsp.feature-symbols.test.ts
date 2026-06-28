import { describe, it, expect } from "vitest";
import { computeDocumentSymbols } from "../src/lsp/features/symbols.js";

describe("computeDocumentSymbols", () => {
  it("lists a CTE declaration as a document symbol", () => {
    const sql = "WITH recent AS (SELECT id FROM sales) SELECT id FROM recent";
    const syms = computeDocumentSymbols(sql, "databricks");
    expect(syms.some((s) => s.name === "recent")).toBe(true);
  });

  it("returns an array (possibly empty) and never throws on valid SQL", () => {
    expect(Array.isArray(computeDocumentSymbols("SELECT 1", "databricks"))).toBe(true);
  });
});
