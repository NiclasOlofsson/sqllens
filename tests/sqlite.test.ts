import { describe, expect, it } from "vitest";
import { parseSqlite } from "../src/sqlite/parse.js";

const errorsOf = (sql: string) => parseSqlite(sql).errors;

describe("Sqlite parse", () => {
	it("parses a basic SELECT with zero syntax errors", () => {
		expect(errorsOf("SELECT a, b FROM t WHERE a > 1")).toBe(0);
	});
});
