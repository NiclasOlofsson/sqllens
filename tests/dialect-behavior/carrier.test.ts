import { describe, expect, it } from "vitest";
import { parse } from "../../src/api.js";
import { behaviorOf } from "../../src/dialect-behavior/carrier.js";
import { resolveBehavior } from "../../src/dialect-behavior/registry.js";
import { resolveScopes } from "../../src/scope/scope.js";

describe("behaviorOf carrier", () => {
	it("returns the scope's own dialect behavior, resolved from its tag", () => {
		const ast = parse("select a from (select a from t) x", "snowflake").ast;
		const scopes = resolveScopes(ast); // no dialect arg — reads the IR's stamped tag
		expect(behaviorOf(scopes.root)).toBe(resolveBehavior("snowflake"));
		// snowflake folds unquoted identifiers to upper — proves it is the snowflake behavior, not the default
		expect(behaviorOf(scopes.root).fold("Col")).toBe("COL");
	});

	it("is a cheap cached handle — same object each call", () => {
		const ast = parse("select 1", "postgres").ast;
		const scopes = resolveScopes(ast);
		expect(behaviorOf(scopes.root)).toBe(behaviorOf(scopes.root));
	});
});
