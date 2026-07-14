// tests/parse-diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { makeErrorCollector } from "../src/parse-diagnostics.js";

describe("makeErrorCollector", () => {
	it("captures message, 1-based line, 0-based column, offset and length from a parser error", () => {
		const c = makeErrorCollector();
		const offending = { start: 7, stop: 11, text: "WHERE", line: 1, column: 7 };
		// antlr signature: syntaxError(recognizer, offendingSymbol, line, charPositionInLine, msg, e)
		(c.listener as any).syntaxError(null, offending, 1, 7, "mismatched input 'WHERE'", null);
		expect(c.diagnostics).toEqual([
			{ message: "mismatched input 'WHERE'", line: 1, column: 7, offset: 7, length: 5 },
		]);
	});

	it("handles a lexer error (null offending symbol) with length 1 and no offset", () => {
		const c = makeErrorCollector();
		(c.listener as any).syntaxError(null, null, 2, 3, "token recognition error", null);
		expect(c.diagnostics).toEqual([
			{ message: "token recognition error", line: 2, column: 3, offset: undefined, length: 1 },
		]);
	});

	it("reset() clears diagnostics (used to discount the SLL attempt before the LL retry)", () => {
		const c = makeErrorCollector();
		(c.listener as any).syntaxError(null, null, 1, 0, "x", null);
		c.reset();
		expect(c.diagnostics).toEqual([]);
	});

	// issue #31: a large expected-token set must not reach the editor tooltip verbatim.
	describe("expected-set capping", () => {
		function messageFor(raw: string): string {
			const c = makeErrorCollector();
			(c.listener as any).syntaxError(null, null, 1, 0, raw, null);
			return c.diagnostics[0]!.message;
		}

		it("caps a large expecting-set to the first 5 candidates plus a remainder count", () => {
			const tokens = Array.from({ length: 300 }, (_, i) => `'TOK${i}'`);
			const msg = messageFor(`mismatched input ';' expecting {${tokens.join(", ")}}`);
			expect(msg).toBe("mismatched input ';' expecting {'TOK0', 'TOK1', 'TOK2', 'TOK3', 'TOK4', … 295 more}");
		});

		it("leaves a small expecting-set untouched", () => {
			const raw = "mismatched input 'x' expecting {';', ',', SELECT}";
			expect(messageFor(raw)).toBe(raw);
		});

		it("leaves a braceless single-token expecting untouched", () => {
			const raw = "missing ';' at 'select'";
			expect(messageFor(raw)).toBe(raw);
		});

		it("counts a quoted comma token as one candidate, not two", () => {
			const tokens = ["','", "';'", "'('", "')'", "'.'", "'A'", "'B'"];
			const msg = messageFor(`extraneous input 'x' expecting {${tokens.join(", ")}}`);
			expect(msg).toBe("extraneous input 'x' expecting {',', ';', '(', ')', '.', … 2 more}");
		});
	});
});
