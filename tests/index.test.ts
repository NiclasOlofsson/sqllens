import { describe, expect, it } from "vitest";
import { Schema, lowerDatabricks, parseDatabricks, qualify, resolveScopes } from "../src/index.js";

describe("public API", () => {
	it("runs the full parse -> lower -> scope -> qualify pipeline from the entry point", () => {
		const tree = resolveScopes(lowerDatabricks(parseDatabricks("SELECT * FROM t").tree));
		const result = qualify(tree, new Schema({ t: { a: "int", b: "int" } }));
		expect(result.columnsOf(tree.root)).toEqual(["a", "b"]);
		expect(result.diagnostics).toEqual([]);
	});
});
