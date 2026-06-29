import { describe, it, expect } from "vitest";
import { SqlDocument } from "../src/document/document.js";
import { computeDocumentSymbols } from "../src/lsp/features/symbols.js";

const doc = (sql: string) => SqlDocument.create(sql, "databricks");

describe("computeDocumentSymbols", () => {
  it("lists a CTE declaration as a document symbol", () => {
    const sql = "WITH recent AS (SELECT id FROM sales) SELECT id FROM recent";
    const syms = computeDocumentSymbols(doc(sql));
    expect(syms.some((s) => s.name === "recent")).toBe(true);
  });

  it("returns an array (possibly empty) and never throws on valid SQL", () => {
    expect(Array.isArray(computeDocumentSymbols(doc("SELECT 1")))).toBe(true);
  });
});
