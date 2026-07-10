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
});
