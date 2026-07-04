import { describe, expect, it } from "vitest";
import { parseTemplated, resolveScopes } from "../src/index.js";
import { applyTemplateTags } from "../src/minijinja/apply-tags.js";

/** Navigate QueryExpr → select body → from[0] (the IR's real field is `from`, not `sources`). */
function firstSource(ast: any): any {
	return ast.body.from[0];
}

describe("R3 apply-tags", () => {
	it("ref in FROM substitutes the model name and attaches template", () => {
		const r = parseTemplated("SELECT o.id FROM {{ ref('orders') }} o", "databricks");
		const src = firstSource(r.sql.ast);
		expect(src.kind).toBe("table");
		expect(src.name).toEqual(["orders"]);
		expect(src.alias).toBe("o");
		expect(src.template).toMatchObject({ kind: "ref" });
		expect(src.template.opaque).toBeUndefined();
	});

	it("source() substitutes two-part name", () => {
		const r = parseTemplated("SELECT * FROM {{ source('raw', 'events') }}", "databricks");
		const src = firstSource(r.sql.ast);
		expect(src.name).toEqual(["raw", "events"]);
		expect(src.template).toMatchObject({ kind: "source" });
		expect(src.template.opaque).toBeUndefined();
	});

	it("macro call in FROM stays placeholder-named but opaque", () => {
		const r = parseTemplated("SELECT * FROM {{ my_macro() }} m", "databricks");
		const src = firstSource(r.sql.ast);
		expect(src.template).toMatchObject({ kind: "macro", opaque: true });
		expect(src.name).not.toEqual(["my_macro"]); // the placeholder, NOT a fabricated name
	});

	it("multi-line ref correlates by containment", () => {
		const r = parseTemplated("SELECT * FROM {{ ref(\n  'orders'\n) }}", "databricks");
		expect(firstSource(r.sql.ast).name).toEqual(["orders"]);
	});

	it("multi-line ref (no user alias) drops the placeholder-fill alias and binds under the real name", () => {
		const r = parseTemplated("SELECT * FROM {{ ref(\n  'orders'\n) }}", "databricks");
		const src = firstSource(r.sql.ast);
		expect(src.name).toEqual(["orders"]);
		expect(src.alias).toBeUndefined(); // NOT the fabricated `jjj…` second-line fill
		// The load-bearing assertion: scope binds under `orders`, not the garbage alias.
		const scopes = resolveScopes(r.sql.ast);
		const keys = [...scopes.root.sources.keys()];
		expect(keys).toContain("orders");
		expect(keys.some((k) => /^j+$/.test(k))).toBe(false);
	});

	it("single-line ref with a real user alias preserves it (fix must not drop real aliases)", () => {
		const r = parseTemplated("SELECT * FROM {{ ref('x') }} o", "databricks");
		const src = firstSource(r.sql.ast);
		expect(src.name).toEqual(["x"]);
		expect(src.alias).toBe("o");
	});

	it("two templated sources with real aliases preserve both (no cross-drop)", () => {
		const r = parseTemplated("SELECT * FROM {{ ref('a') }} x, {{ ref('b') }} y", "databricks");
		const from = (r.sql.ast as any).body.from;
		const byName = (n: string) => from.find((s: any) => s.name.join(".") === n);
		expect(byName("a").alias).toBe("x");
		expect(byName("b").alias).toBe("y");
	});

	it("ref inside a CTE body and a JOIN both substitute", () => {
		const sql = "WITH c AS (SELECT * FROM {{ ref('a') }}) SELECT * FROM c JOIN {{ ref('b') }} b ON c.x = b.x";
		const r = parseTemplated(sql, "databricks");
		const ast: any = r.sql.ast;
		expect(firstSource(ast.ctes[0].body).name).toEqual(["a"]);
		// The joined source rides `from` (from + joinConditions stay populated; joins is additive).
		const joined = ast.body.from.find((s: any) => s.template?.kind === "ref" && s.name.join(".") === "b");
		expect(joined).toBeDefined();
		// If joins are modelled, join.source is reference-identical to the from entry.
		if (ast.body.joins) {
			const jsrc = ast.body.joins.map((j: any) => j.source).find((s: any) => s.name?.join(".") === "b");
			expect(jsrc).toBe(joined);
		}
	});

	it("plain SQL (no tags) returns the identical ast reference", () => {
		const r = parseTemplated("SELECT 1", "databricks");
		expect(r.sql.ast).toBeDefined();
		// applyTemplateTags(ast, []) is a no-op that returns the same reference (structural sharing).
		expect(applyTemplateTags(r.sql.ast, [])).toBe(r.sql.ast);
	});

	it("result is frozen", () => {
		const r = parseTemplated("SELECT * FROM {{ ref('orders') }}", "databricks");
		expect(Object.isFrozen(firstSource(r.sql.ast))).toBe(true);
	});

	it("total on broken templated input", () => {
		expect(() => parseTemplated("SELECT {{ ref( FROM {{", "databricks")).not.toThrow();
	});

	it("scope binds the real model name, not the placeholder", () => {
		const r = parseTemplated("SELECT o.order_id FROM {{ ref('raw_orders') }} o", "databricks");
		const scopes = resolveScopes(r.sql.ast);
		const names = [...scopes.root.sources.values()]
			.filter((rs): rs is Extract<typeof rs, { kind: "table" }> => rs.kind === "table")
			.map((rs) => rs.name.join("."));
		expect(names).toContain("raw_orders");
	});
});
