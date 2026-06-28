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

	it("every BigQuery syntax error is positioned: errors === diagnostics.length", () => {
		for (const sql of ["SELECT a b c FROM", "SELECT '\\q'", "SELECT a b c FROM t"]) {
			const r = parseBigQuery(sql);
			expect(r.errors, sql).toBe(r.diagnostics.length); // no count-only errors anymore
		}
	});

	it("an invalid string escape yields a positioned diagnostic on the literal", () => {
		const sql = "SELECT '\\q' AS x";
		const r = parseBigQuery(sql);
		expect(r.diagnostics.length).toBeGreaterThanOrEqual(1);
		const d = r.diagnostics.find((x) => /escape/i.test(x.message));
		expect(d, "an escape diagnostic").toBeDefined();
		expect(d!.line).toBe(1);
		// points at the literal, not column 0 / end-of-input
		expect(d!.column).toBeGreaterThanOrEqual(sql.indexOf("'"));
		expect(d!.length).toBeGreaterThanOrEqual(1);
	});

	it("keeps the lexer diagnostic across the SLL->LL fallback", () => {
		// U+0001 is a lexer-level token-recognition error, and this shape also bails SLL and forces
		// the LL retry. The lexer runs once eagerly (dotPathTokenSource); the LL retry reseeks the
		// buffered token source and never re-lexes, so the lexer diagnostic must survive the
		// collector.reset() done before the retry. Guards the snapshot/re-push refinement: without it
		// the lexer diagnostic is dropped from both `diagnostics` and the `errors` total on the LL path.
		const r = parseBigQuery(`SELECT a, ${String.fromCharCode(1)} b FROM`);
		expect(r.errors).toBeGreaterThanOrEqual(1);
		expect(r.diagnostics.some((d) => /token recognition/i.test(d.message))).toBe(true);
		expect(r.diagnostics[0].line).toBe(1);
		expect(r.errors).toBeGreaterThanOrEqual(r.diagnostics.length);
	});
});
