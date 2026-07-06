import { describe, expect, test } from "vitest";
import { parse, resolveScopes, qualify, Schema, OPEN_PROVIDER } from "../src/index.js";
import type { SelectExpr } from "../src/index.js";

const schema = new Schema({
	orders: { id: { type: "bigint", nullable: false }, amount: { type: "double", nullable: true } },
	customers: { id: { type: "bigint", nullable: false }, name: { type: "string", nullable: true } },
});

describe("Qualification.expandStarOf", () => {
	test("bare * expands every visible source's columns with sourceKey", () => {
		const ast = parse("select * from orders o", "databricks").ast;
		const scopes = resolveScopes(ast, "databricks");
		const q = qualify(scopes, schema);
		const body = ast.body as SelectExpr;
		const star = body.projections[0]!;
		const pairs = q.expandStarOf(scopes.root, star);
		expect(pairs).toEqual([
			{ name: "id", sourceKey: "o" },
			{ name: "amount", sourceKey: "o" },
		]);
	});

	test("qualified t.* expands only the named source", () => {
		const ast = parse("select o.*, c.* from orders o, customers c", "databricks").ast;
		const scopes = resolveScopes(ast, "databricks");
		const q = qualify(scopes, schema);
		const body = ast.body as SelectExpr;
		const oStar = body.projections[0]!;
		const pairs = q.expandStarOf(scopes.root, oStar);
		expect(pairs).toEqual([
			{ name: "id", sourceKey: "o" },
			{ name: "amount", sourceKey: "o" },
		]);
	});

	test("EXCLUDE drops the excluded column but keeps sourceKey on survivors", () => {
		const ast = parse("select * exclude (amount) from orders o", "snowflake").ast;
		const scopes = resolveScopes(ast, "snowflake");
		const q = qualify(scopes, schema);
		const body = ast.body as SelectExpr;
		const star = body.projections[0]!;
		const pairs = q.expandStarOf(scopes.root, star);
		// Snowflake folds unquoted identifiers to uppercase (src/ident/fold.ts) — the alias `o`'s
		// sourceKey is "O", matching how `scope.sources` itself keys this source.
		expect(pairs).toEqual([{ name: "id", sourceKey: "O" }]);
	});

	test("returns undefined for a non-star projection", () => {
		const ast = parse("select id from orders o", "databricks").ast;
		const scopes = resolveScopes(ast, "databricks");
		const q = qualify(scopes, schema);
		const body = ast.body as SelectExpr;
		expect(q.expandStarOf(scopes.root, body.projections[0]!)).toBeUndefined();
	});

	test("returns undefined when the source's columns are unknown (no schema)", () => {
		const ast = parse("select * from orders o", "databricks").ast;
		const scopes = resolveScopes(ast, "databricks");
		const q = qualify(scopes, OPEN_PROVIDER); // open-world default provider — columnsFor always unknown
		const body = ast.body as SelectExpr;
		expect(q.expandStarOf(scopes.root, body.projections[0]!)).toBeUndefined();
	});
});
