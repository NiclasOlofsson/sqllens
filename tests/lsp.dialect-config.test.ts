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

  it("malformed JSON: never throws, defaults databricks + a JSON warning", () => {
    const bad = mkdtempSync(join(tmpdir(), "sqllens-badjson-"));
    writeFileSync(join(bad, ".sqllens.json"), "{ this is not json");
    const c = loadDialectConfig(bad); // a throw here fails the test
    expect(c.dialectFor("x.sql")).toBe("databricks");
    expect(c.warnings.some((w) => /valid JSON/i.test(w))).toBe(true);
    rmSync(bad, { recursive: true, force: true });
  });

  it("bad schema file: never throws, schema undefined + a schema warning", () => {
    const badSchema = mkdtempSync(join(tmpdir(), "sqllens-badschema-"));
    writeFileSync(
      join(badSchema, ".sqllens.json"),
      JSON.stringify({ dialects: [{ files: "**/*.sql", dialect: "databricks" }], schema: "nope.json" }),
    );
    const c = loadDialectConfig(badSchema);
    expect(c.schema).toBeUndefined();
    expect(c.warnings.some((w) => /nope\.json/.test(w))).toBe(true);
    rmSync(badSchema, { recursive: true, force: true });
  });

  it("unknown dialect in a rule: never throws, rule skipped, warning mentions it", () => {
    const unk = mkdtempSync(join(tmpdir(), "sqllens-unkdialect-"));
    writeFileSync(
      join(unk, ".sqllens.json"),
      JSON.stringify({ dialects: [{ files: "**/*.sql", dialect: "oracle" }] }),
    );
    const c = loadDialectConfig(unk);
    expect(c.dialectFor("x.sql")).toBe("databricks"); // bad rule skipped → default
    expect(c.warnings.some((w) => /oracle/.test(w))).toBe(true);
    rmSync(unk, { recursive: true, force: true });
  });

  it("unknown default: never throws, falls back to databricks + a warning", () => {
    const unkDef = mkdtempSync(join(tmpdir(), "sqllens-unkdefault-"));
    writeFileSync(join(unkDef, ".sqllens.json"), JSON.stringify({ default: "oracle" }));
    const c = loadDialectConfig(unkDef);
    expect(c.dialectFor("x.sql")).toBe("databricks");
    expect(c.warnings.some((w) => /oracle/.test(w))).toBe(true);
    rmSync(unkDef, { recursive: true, force: true });
  });
});
