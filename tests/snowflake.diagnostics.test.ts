import { describe, it, expect } from "vitest";
import { parseSnowflake } from "../src/snowflake/parse.js";

describe("parseSnowflake diagnostics", () => {
	it("returns zero diagnostics for valid SQL", () => {
		const r = parseSnowflake("SELECT a FROM t");
		expect(r.errors).toBe(0);
		expect(r.diagnostics).toEqual([]);
	});

	it("returns a positioned diagnostic for broken SQL", () => {
		const r = parseSnowflake("SELECT FROM");
		expect(r.errors).toBeGreaterThan(0);
		expect(r.diagnostics.length).toBe(r.errors);
		expect(r.diagnostics[0].line).toBe(1);
		expect(r.diagnostics[0].length).toBeGreaterThanOrEqual(1);
	});

	// Regression: a lexer error early in the statement must survive the SLL→LL fallback. The
	// CommonTokenStream lexes lazily and the LL retry reseeks the same buffered tokens (no re-lex), so
	// without an eager-lex snapshot the lexer diagnostic captured during SLL is wiped by reset() and
	// never re-emitted. The trailing `AND ()` forces the LL fallback. (Self-referential length===errors
	// checks cannot catch this — the lexer diag is silently dropped from both.)
	it("keeps the lexer error after the SLL→LL fallback", () => {
		const r = parseSnowflake("SELECT € FROM t WHERE x IN (SELECT y FROM z) AND ()");
		expect(r.diagnostics.some((d) => /token recognition|€/i.test(d.message))).toBe(true);
		expect(r.diagnostics.length).toBe(r.errors);
	});
});
