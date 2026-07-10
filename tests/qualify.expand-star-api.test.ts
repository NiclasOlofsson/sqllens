import { describe, expect, test } from "vitest";
import { parse, resolveScopes, qualify, Schema, OPEN_PROVIDER } from "../src/index.js";
import type { Diagnostic, SelectExpr } from "../src/index.js";

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

	test("calling expandStarOf again for the same projection does not duplicate its diagnostics", () => {
		// `qualify()`'s own construction already expands every star once internally (to compute
		// `columnsOf`) — an unknown table there already pushed an unknown-table diagnostic before
		// this test calls anything. A caller invoking expandStarOf for the SAME projection must reuse
		// that expansion, not re-run it and push the same diagnostic again.
		const ast = parse("select * from unknown_table", "databricks").ast;
		const scopes = resolveScopes(ast, "databricks");
		const q = qualify(scopes, schema); // `schema` only knows orders/customers — unknown_table misses (closed world)
		const body = ast.body as SelectExpr;
		const star = body.projections[0]!;
		const before = q.diagnostics.filter((d) => d.kind === "unknown-table").length;
		expect(before).toBe(1);
		q.expandStarOf(scopes.root, star);
		q.expandStarOf(scopes.root, star);
		expect(q.diagnostics.filter((d) => d.kind === "unknown-table").length).toBe(before);
	});

	test("expandStarOf answers undefined for a projection qualify()'s own walk never visited — never computes live", () => {
		// Every real star projection IS visited internally (qualify() must expand it to compute
		// columnsOf), so a synthetic projection outside that walk has no cache entry. expandStarOf is
		// a pure cache read (no live fallback), so this must answer undefined without diagnosing —
		// and without throwing, even though `diagnostics` is frozen by the time any caller reaches it.
		const ast = parse("select * from unknown_table", "databricks").ast;
		const scopes = resolveScopes(ast, "databricks");
		const q = qualify(scopes, schema);
		const body = ast.body as SelectExpr;
		const real = body.projections[0]!;
		const synthetic: SelectExpr["projections"][number] = {
			isStar: true,
			expr: { kind: "star", qualifier: undefined, cst: real.cst },
			cst: real.cst,
		};
		const before = q.diagnostics.length;
		expect(q.expandStarOf(scopes.root, synthetic)).toBeUndefined();
		expect(q.expandStarOf(scopes.root, synthetic)).toBeUndefined();
		expect(q.diagnostics.length).toBe(before);
	});

	test("diagnostics is frozen once qualify() returns — a push throws instead of silently corrupting it", () => {
		const ast = parse("select * from unknown_table", "databricks").ast;
		const scopes = resolveScopes(ast, "databricks");
		const q = qualify(scopes, schema);
		expect(Object.isFrozen(q.diagnostics)).toBe(true);
		expect(() =>
			(q.diagnostics as Diagnostic[]).push({
				kind: "unknown-table",
				message: "x",
				line: 1,
				column: 0,
				endLine: 1,
				endColumn: 1,
			}),
		).toThrow(TypeError);
		expect(Object.isFrozen(q.diagnostics[0])).toBe(true);
	});
});
