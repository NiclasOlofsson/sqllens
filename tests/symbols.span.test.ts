import { describe, it, expect } from "vitest";
import { toScopes, deriveSymbols, referencesAt } from "../src/index.js";

const SQL = "SELECT amount FROM sales";

describe("Span carries offsets", () => {
	it("Sym spans slice the source text", () => {
		const scopes = toScopes(SQL, { dialect: "duckdb" });
		const syms = deriveSymbols(scopes);
		const amount = syms.find((s) => s.kind === "column" && s.name === "amount")!;
		expect(SQL.slice(amount.span.start, amount.span.end)).toBe("amount");
	});
	it("Occurrence spans slice the source text", () => {
		const scopes = toScopes(SQL, { dialect: "duckdb" });
		const occ = referencesAt(scopes, SQL.indexOf("amount"));
		expect(occ).not.toBeNull();
		for (const o of occ!.occurrences) expect(SQL.slice(o.span.start, o.span.end)).toBe("amount");
	});

	// Star anchor (vocabulary-contract's adversarial case, tests/vocabulary-contract.test.ts): a star
	// Sym's span must slice to exactly `*`, never a trailing modifier clause — `REPLACE (a * 2 AS a)`'s
	// own expression carries a LATER `*` (multiplication) in the same star subtree, the adversarial
	// shape that catches an unanchored `spanOf(projection.cst)` fallback. Regression pin: this Sym used
	// to span the whole "* replace (a * 2 as a)" clause before routing through the shared starSpanOf
	// (src/ir/part-span.ts) that document.ts's unionOutputColumns already used.
	it("a star Sym's span slices to exactly `*`, not a trailing modifier clause", () => {
		const sql = "select * replace (a * 2 as a) from t";
		const scopes = toScopes(sql, { dialect: "duckdb" });
		const syms = deriveSymbols(scopes);
		const star = syms.find((s) => s.kind === "column" && s.modifiers.length === 1 && s.modifiers[0] === "star")!;
		expect(sql.slice(star.span.start, star.span.end)).toBe("*");
	});
});
