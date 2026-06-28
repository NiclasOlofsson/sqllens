// tests/lsp.dialect-config.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDialectConfig } from "../src/lsp/dialect-config.js";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "sqllens-cfg-"));
  writeFileSync(
    join(dir, ".sqllens.json"),
    JSON.stringify({
      dialects: [
        { files: "snowflake/**/*.sql", dialect: "snowflake" },
        { files: "**/*.tsql.sql", dialect: "tsql" },
        { files: "**/*.sql", dialect: "databricks" },
      ],
      default: "databricks",
      schema: "schema.json",
    }),
  );
  writeFileSync(join(dir, "schema.json"), JSON.stringify({ sales: { amount: "decimal", id: "int" } }));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("loadDialectConfig", () => {
  it("first matching glob wins (ordered rules)", () => {
    const c = loadDialectConfig(dir);
    expect(c.dialectFor("snowflake/a.sql")).toBe("snowflake");
    expect(c.dialectFor("models/x.tsql.sql")).toBe("tsql");
    expect(c.dialectFor("models/x.sql")).toBe("databricks");
  });

  it("falls back to default when no rule matches", () => {
    const c = loadDialectConfig(dir);
    expect(c.dialectFor("notes.txt")).toBe("databricks");
  });

  it("loads the schema so a known table resolves", () => {
    const c = loadDialectConfig(dir);
    expect(c.schema).toBeDefined();
    expect(c.schema!.columnsFor(["sales"])?.map((col) => col.name)).toEqual(["amount", "id"]);
  });

  it("missing config: default databricks + a warning, never throws", () => {
    const empty = mkdtempSync(join(tmpdir(), "sqllens-empty-"));
    const c = loadDialectConfig(empty);
    expect(c.dialectFor("x.sql")).toBe("databricks");
    expect(c.warnings.length).toBeGreaterThan(0);
    rmSync(empty, { recursive: true, force: true });
  });
});
