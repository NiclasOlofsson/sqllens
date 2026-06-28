import { describe, it, expect } from "vitest";
import { Schema } from "../src/qualify/schema.js";
import { computeHover } from "../src/lsp/features/hover.js";

describe("computeHover", () => {
	it("shows the inferred type of a column with a schema", () => {
		const sql = "SELECT amount FROM sales";
		const schema = new Schema({ sales: { amount: "decimal" } });
		const h = computeHover(sql, "databricks", { line: 0, character: sql.indexOf("amount") }, schema);
		expect(h).not.toBeNull();
		const value =
			typeof h!.contents === "object" && "value" in h!.contents ? (h!.contents as any).value : String(h!.contents);
		expect(value).toMatch(/decimal/);
	});

	it("returns null when there is no expression under the cursor", () => {
		const sql = "SELECT amount FROM sales";
		expect(computeHover(sql, "databricks", { line: 0, character: sql.indexOf("FROM") })).toBeNull();
	});
});
