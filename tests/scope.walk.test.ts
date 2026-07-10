import { describe, it, expect } from "vitest";
import { parse, toScopes, walk, scopeOf } from "../src/index.js";

const SQL = "WITH c AS (SELECT x FROM t) SELECT x FROM c WHERE x > 1";

describe("scope walk + scopeOf", () => {
	it("walk yields CTE exprs with the CTE scope, outer exprs with the root", () => {
		const { ast } = parse(SQL, "duckdb");
		const scopes = toScopes(ast);
		const pairs = [...walk(scopes, ast)];
		const scopesSeen = new Set(pairs.map((p) => p.scope));
		expect(scopesSeen.size).toBeGreaterThan(1); // root + cte at minimum
		for (const { node, scope } of pairs) expect(scopeOf(scopes, node, ast)).toBe(scope);
	});
	it("scopeOf is undefined for a foreign node", () => {
		const { ast } = parse(SQL, "duckdb");
		const other = parse("SELECT 1", "duckdb").ast;
		const scopes = toScopes(ast);
		const body = other.body;
		if (body.kind !== "select") throw new Error("expected select");
		expect(scopeOf(scopes, body.projections[0].expr)).toBeUndefined();
	});
});
