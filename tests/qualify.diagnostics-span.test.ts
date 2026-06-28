import { describe, it, expect } from "vitest";
import { analyze } from "../src/api.js";
import { Schema } from "../src/qualify/schema.js";

describe("semantic diagnostics carry a full span", () => {
	it("an unknown column's diagnostic spans the whole identifier, not one char", () => {
		const schema = new Schema({ sales: { amount: "decimal" } });
		const sql = "SELECT unknown_col FROM sales";
		const d = analyze(sql, "databricks", { schema }).diagnostics.find((x) => x.kind === "unknown-column");
		expect(d, "unknown-column diagnostic").toBeDefined();
		expect(d!.line).toBe(1);
		expect(d!.column).toBe(sql.indexOf("unknown_col")); // 0-based start
		// full span: end is past the last char of "unknown_col"
		expect(d!.endLine).toBe(1);
		expect(d!.endColumn).toBe(sql.indexOf("unknown_col") + "unknown_col".length);
	});

	it("an unknown table's diagnostic spans the table name", () => {
		// `*` forces star-expansion against the (absent) table, which is what surfaces unknown-table.
		const sql = "SELECT * FROM no_such_table";
		const d = analyze(sql, "databricks", { schema: new Schema({}) }).diagnostics.find(
			(x) => x.kind === "unknown-table",
		);
		expect(d).toBeDefined();
		expect(d!.endColumn).toBeGreaterThan(d!.column); // a real width, not a point
		// full span over the whole table name
		expect(d!.column).toBe(sql.indexOf("no_such_table")); // 0-based start
		expect(d!.endColumn).toBe(sql.indexOf("no_such_table") + "no_such_table".length);
	});
});
