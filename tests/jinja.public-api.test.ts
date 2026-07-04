import { describe, expect, it } from "vitest";
// Import ONLY through the public barrel (src/index.ts) — NOT the internal
// src/jinja path — to prove the inc1 surface is exported: parseTemplated,
// tokenizeTemplated, and the TemplatedParseResult / TagNode types.
import { parseTemplated, tokenizeTemplated, type TemplatedParseResult, type TagNode } from "../src/index.js";

describe("jinja public surface (barrel export)", () => {
	it("parseTemplated / tokenizeTemplated are reachable through src/index.ts", () => {
		const text = "select {{ ref('stg_orders') }} from t";
		const result: TemplatedParseResult = parseTemplated(text, "databricks");

		expect(result.tokens.length).toBeGreaterThan(0);
		expect(result.sql.ast.kind).toBe("query");
		expect(result.tokens.some((t) => t.channel === 2 && t.role === "jinja")).toBe(true);

		// tokenizeTemplated yields the same token stream.
		const tokens = tokenizeTemplated(text, "databricks");
		expect(tokens).toEqual(result.tokens);

		// The TagNode type flows through the barrel and a ref node is produced.
		const ref = result.tags.find((n: TagNode): n is Extract<TagNode, { kind: "ref" }> => n.kind === "ref");
		expect(ref?.model).toBe("stg_orders");
	});

	it("is total through the barrel on broken input", () => {
		expect(() => parseTemplated("select {{ ref(", "databricks")).not.toThrow();
	});
});
