import { describe, it, expect } from "vitest";
import { parse, analyze } from "../src/api.js";
import { Schema } from "../src/qualify/schema.js";

describe("redshift through the uniform surface", () => {
	it("parse() accepts the redshift dialect and lowers to the IR", () => {
		const r = parse("SELECT amount FROM sales", "redshift");
		expect(r.ast.kind).toBe("query");
		expect(r.errors).toBe(0);
	});

	it("analyze() resolves a redshift query and flags an unknown column with a schema", () => {
		const schema = new Schema({ sales: { amount: "numeric(10,2)" } });
		const a = analyze("SELECT nope FROM sales", "redshift", { schema });
		expect(a.diagnostics.some((d) => /nope|unknown/i.test(d.message))).toBe(true);
	});
});
