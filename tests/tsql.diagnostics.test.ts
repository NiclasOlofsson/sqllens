import { describe, it, expect } from "vitest";
import { parseTSql } from "../src/tsql/parse.js";

describe("parseTSql diagnostics", () => {
	it("returns zero diagnostics for valid SQL", () => {
		const r = parseTSql("SELECT a FROM t");
		expect(r.errors).toBe(0);
		expect(r.diagnostics).toEqual([]);
	});

	it("returns a positioned diagnostic for broken SQL", () => {
		const r = parseTSql("SELECT FROM");
		expect(r.errors).toBeGreaterThan(0);
		expect(r.diagnostics.length).toBe(r.errors);
		expect(r.diagnostics[0].line).toBe(1);
		expect(r.diagnostics[0].length).toBeGreaterThanOrEqual(1);
	});
});
