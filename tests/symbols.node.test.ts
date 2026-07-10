import { describe, it, expect } from "vitest";
import { parse, toScopes, deriveSymbols, symbolAt } from "../src/index.js";

const SQL = "SELECT amount AS amt FROM sales s";

describe("Sym.node + symbolAt", () => {
	it("a column Sym references its ColumnRef node", () => {
		const { ast } = parse(SQL, "duckdb");
		const scopes = toScopes(ast);
		const syms = deriveSymbols(scopes);
		const col = syms.find((s) => s.kind === "column" && s.name === "amount")!;
		const body = ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		expect(col.node).toBe(body.projections[0].expr); // object identity, not a copy
	});
	it("symbolAt finds the narrowest covering Sym", () => {
		const scopes = toScopes(SQL, { dialect: "duckdb" });
		const syms = deriveSymbols(scopes);
		const hit = symbolAt(syms, SQL.indexOf("amount"));
		expect(hit?.name).toBe("amount");
		expect(symbolAt(syms, 0)).toBeUndefined(); // "SELECT" keyword — no Sym there
	});
});
