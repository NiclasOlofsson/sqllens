import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";

// ---------------------------------------------------------------------------
// Call-signature diagnostics (Task 12) — arity (curated) + operand types
// (curated). Never-wrong: a diagnostic fires only when the checker is certain.
// ---------------------------------------------------------------------------

function diags(sql: string, schema: Schema = new Schema({})) {
	const tree = resolveScopes(lower(parseDatabricks(sql).tree));
	return qualify(tree, schema).diagnostics;
}

function kinds(sql: string, schema?: Schema): string[] {
	return diags(sql, schema).map((d) => d.kind);
}

describe("call-signature diagnostics — arity", () => {
	it("flags nullif(a): curated nullif takes exactly 2 args", () => {
		expect(kinds("SELECT nullif(a) FROM t")).toContain("wrong-arity");
	});

	it("does NOT flag a variadic concat, whatever the arg count", () => {
		expect(kinds("SELECT concat('a')")).not.toContain("wrong-arity");
		expect(kinds("SELECT concat('a', 'b', 'c', 'd')")).not.toContain("wrong-arity");
	});

	it("is silent on an unknown (uncurated) function", () => {
		const k = kinds("SELECT my_udf(a, b, c) FROM t");
		expect(k).not.toContain("wrong-arity");
		expect(k).not.toContain("wrong-argument-type");
	});

	it("flags abs('x','y'): curated abs takes exactly 1 arg (over-supply)", () => {
		expect(kinds("SELECT abs('x', 'y')")).toContain("wrong-arity");
	});

	it("does NOT type-flag abs(unknown_col): the arg type is unknown → silent", () => {
		// One arg → arity ok; column type unknown without a schema → operand-type silent.
		const k = kinds("SELECT abs(unknown_col) FROM t");
		expect(k).not.toContain("wrong-arity");
		expect(k).not.toContain("wrong-argument-type");
	});
});

describe("call-signature diagnostics — operand type", () => {
	it("flags abs('x'): a provably-string arg where the only overload takes numeric", () => {
		expect(kinds("SELECT abs('x')")).toContain("wrong-argument-type");
	});

	it("does NOT flag abs(1): a numeric literal into a numeric param", () => {
		expect(kinds("SELECT abs(1)")).not.toContain("wrong-argument-type");
	});

	it("accepts a numeric arg into a string param (implicit widening to string)", () => {
		// concat's params are string; a numeric literal renders as a string — valid, must not flag.
		expect(kinds("SELECT concat(1, 'x')")).not.toContain("wrong-argument-type");
	});
});
