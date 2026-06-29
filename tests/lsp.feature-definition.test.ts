import { describe, it, expect } from "vitest";
import { SqlDocument } from "../src/document/document.js";
import { computeDefinition } from "../src/lsp/features/definition.js";

const doc = (sql: string) => SqlDocument.create(sql, "databricks");

describe("computeDefinition", () => {
  it("jumps from a CTE reference in FROM to the CTE declaration", () => {
    const sql = "WITH recent AS (SELECT id FROM sales) SELECT id FROM recent";
    const refIdx = sql.lastIndexOf("recent"); // the FROM reference
    const loc = computeDefinition(doc(sql), lineCol(sql, refIdx), "file:///q.sql");
    expect(loc).not.toBeNull();
    // definition is the earlier declaration, before the reference
    const defStart = loc!.range.start;
    expect(defStart.line).toBe(0);
    expect(defStart.character).toBeLessThan(refIdx);
  });

  it("returns null for a bare catalog table with no in-query definition", () => {
    const sql = "SELECT id FROM sales";
    const loc = computeDefinition(doc(sql), lineCol(sql, sql.indexOf("sales")), "file:///q.sql");
    expect(loc).toBeNull();
  });
});

function lineCol(text: string, offset: number) {
  const before = text.slice(0, offset);
  const line = before.split("\n").length - 1;
  const character = offset - (before.lastIndexOf("\n") + 1);
  return { line, character };
}
