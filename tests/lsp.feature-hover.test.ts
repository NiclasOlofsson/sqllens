import { describe, it, expect } from "vitest";
import { Schema } from "../src/qualify/schema.js";
import { SqlDocument } from "../src/document/document.js";
import { computeHover } from "../src/lsp/features/hover.js";

const doc = (sql: string) => SqlDocument.create(sql, "databricks");

describe("computeHover", () => {
	it("shows the inferred type of a column with a schema", () => {
		const sql = "SELECT amount FROM sales";
		const schema = new Schema({ sales: { amount: "decimal" } });
		const h = computeHover(doc(sql), { line: 0, character: sql.indexOf("amount") }, schema);
		expect(h).not.toBeNull();
		const value =
			typeof h!.contents === "object" && "value" in h!.contents
				? (h!.contents as any).value
				: String(h!.contents);
		expect(value).toMatch(/decimal/);
	});

	it("returns null when there is no expression under the cursor", () => {
		const sql = "SELECT amount FROM sales";
		expect(computeHover(doc(sql), { line: 0, character: sql.indexOf("FROM") })).toBeNull();
	});

	it("falls back to symbol kind + name when no type is inferable (no schema)", () => {
		const sql = "WITH c AS (SELECT 1 AS x) SELECT x FROM c";
		const doc = SqlDocument.create(sql, "databricks");
		const h = computeHover(doc, { line: 0, character: sql.indexOf("FROM c") + 5 });
		expect(h).not.toBeNull();
		expect((h!.contents as { value: string }).value).toContain("(cte) c");
	});
});
