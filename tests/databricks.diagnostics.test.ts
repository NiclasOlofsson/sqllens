// tests/databricks.diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { parseDatabricks } from "../src/databricks/parse.js";

describe("parseDatabricks diagnostics", () => {
	it("returns zero diagnostics for valid SQL", () => {
		const r = parseDatabricks("SELECT a FROM t");
		expect(r.errors).toBe(0);
		expect(r.diagnostics).toEqual([]);
	});

	it("returns a positioned diagnostic for broken SQL (1-based line, 0-based column)", () => {
		// Note: the Spark/Databricks grammar accepts "SELECT FROM" (the spec's example),
		// so it yields zero diagnostics. Use an input the grammar actually rejects.
		const r = parseDatabricks("SELECT a b c FROM");
		expect(r.errors).toBeGreaterThan(0);
		expect(r.diagnostics.length).toBe(r.errors);
		const d = r.diagnostics[0];
		expect(d.line).toBe(1);
		expect(typeof d.column).toBe("number");
		expect(d.message.length).toBeGreaterThan(0);
		expect(d.length).toBeGreaterThanOrEqual(1);
	});
});
