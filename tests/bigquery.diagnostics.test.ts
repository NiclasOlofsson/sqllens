// tests/bigquery.diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { parseBigQuery } from "../src/bigquery/parse.js";

describe("parseBigQuery diagnostics", () => {
  it("returns zero diagnostics for valid SQL", () => {
    const r = parseBigQuery("SELECT a FROM t");
    expect(r.errors).toBe(0);
    expect(r.diagnostics).toEqual([]);
  });

  it("returns a positioned diagnostic for broken SQL", () => {
    const r = parseBigQuery("SELECT FROM");
    expect(r.errors).toBeGreaterThan(0);
    expect(r.diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(r.diagnostics[0].line).toBe(1);
    expect(r.diagnostics[0].length).toBeGreaterThanOrEqual(1);
  });

  it("errors count is >= positioned diagnostics (extras: escape/post-parse have no span)", () => {
    const r = parseBigQuery("SELECT FROM");
    expect(r.errors).toBeGreaterThanOrEqual(r.diagnostics.length);
  });
});
