import { describe, it, expect } from "vitest";
import { SqlSession } from "../src/session.js";
import { computeDocumentSymbols } from "../src/lsp/features/symbols.js";
import { Schema } from "../src/qualify/schema.js";

const session = (sql: string) => SqlSession.create(sql, "databricks");

describe("computeDocumentSymbols", () => {
	it("lists a CTE declaration as a document symbol", () => {
		const sql = "WITH recent AS (SELECT id FROM sales) SELECT id FROM recent";
		const syms = computeDocumentSymbols(session(sql));
		expect(syms.some((s) => s.name === "recent")).toBe(true);
	});

	it("returns an array (possibly empty) and never throws on valid SQL", () => {
		expect(Array.isArray(computeDocumentSymbols(session("SELECT 1")))).toBe(true);
	});

	it("carries inferred types in the outline detail when given a schema", () => {
		// A bare `SELECT amount` is a reference, not an output declaration (see
		// symbols.test.ts "emits a bare projected column as a single reference") — the
		// outline only carries declared/output columns, so alias it to exercise that path.
		const schema = new Schema({ sales: { amount: "decimal" } });
		const withAlias = SqlSession.create("SELECT amount AS amount_out FROM sales", "databricks", { schema });
		const syms = computeDocumentSymbols(withAlias);
		const amount = syms.find((s) => s.name === "amount_out");
		expect(amount?.detail).toContain("decimal");
	});
});
