// tests/api.diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { parse } from "../src/api.js";

describe("parse() positioned diagnostics", () => {
	it("carries an empty diagnostics array for valid SQL", () => {
		const r = parse("SELECT a FROM t", "databricks");
		expect(r.errors).toBe(0);
		expect(r.diagnostics).toEqual([]);
	});

	it("carries positioned diagnostics for broken SQL on every dialect", () => {
		// Databricks accepts the barer "SELECT FROM" (0 errors — proven in Task A2), so the loop
		// uses a form all five dialects reject: trailing junk after the projection.
		for (const d of ["databricks", "tsql", "snowflake", "bigquery", "redshift"] as const) {
			const r = parse("SELECT a b c FROM", d);
			expect(r.errors, d).toBeGreaterThan(0);
			expect(r.diagnostics.length, d).toBeGreaterThanOrEqual(1);
			expect(r.diagnostics[0].line, d).toBe(1);
		}
	});
});
