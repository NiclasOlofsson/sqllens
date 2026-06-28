import { describe, it, expect } from "vitest";
import { analyze } from "../src/api.js";
import { Schema } from "../src/qualify/schema.js";
import { endPosition } from "../src/ir/span.js";

describe("endPosition multi-line stop-token math", () => {
	it("single-line token: endLine stays, endColumn = column + length", () => {
		expect(endPosition(1, 7, "amount")).toEqual({ endLine: 1, endColumn: 13 });
	});
	it("multi-line token: endLine += newline count, endColumn = chars after last newline", () => {
		// `'x\ny\nz'` at line 1, col 7: 2 newlines, "z'" trails the last newline.
		expect(endPosition(1, 7, "'x\ny\nz'")).toEqual({ endLine: 3, endColumn: 2 });
	});
});

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
