import { describe, expect, it } from "vitest";
import { OPEN_PROVIDER, resolveScopes } from "../src/index.js";
import { parseTemplated } from "./helpers/templated.js";
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
		expect(src.relation.parts).toEqual(["orders"]);
		expect(src.alias).toBe("o");
		expect(src.template).toMatchObject({ kind: "call", call: { name: "ref" } });
		expect(src.template.opaque).toBeUndefined();
	});

	it("source() substitutes two-part name", () => {
		const r = parseTemplated("SELECT * FROM {{ source('raw', 'events') }}", "databricks");
		const src = firstSource(r.sql.ast);
		expect(src.relation.parts).toEqual(["raw", "events"]);
		expect(src.template).toMatchObject({ kind: "call", call: { name: "source" } });
		expect(src.template.opaque).toBeUndefined();
	});

	it("macro call in FROM takes the raw tag text as its name and carries its provider key", () => {
		const r = parseTemplated("SELECT * FROM {{ my_macro() }} m", "databricks");
		const src = firstSource(r.sql.ast);
		// Since the provider cutover the marker is CONSULTABLE (call attached) instead of
		// permanently opaque; with no provider answer it behaves exactly like the old opaque
		// marker (exemption, no diagnostics).
		expect(src.template).toMatchObject({ kind: "call", call: { name: "my_macro", args: [] } });
		expect(src.template.opaque).toBeUndefined();
		expect(src.relation.parts).toEqual(["{{ my_macro() }}"]); // the user's text, NOT a fabricated name (#35)
	});

	it("multi-line ref correlates by containment", () => {
		const r = parseTemplated("SELECT * FROM {{ ref(\n  'orders'\n) }}", "databricks");
		expect(firstSource(r.sql.ast).relation.parts).toEqual(["orders"]);
	});

	it("multi-line ref (no user alias) drops the placeholder-fill alias and binds under the real name", () => {
		const r = parseTemplated("SELECT * FROM {{ ref(\n  'orders'\n) }}", "databricks");
		const src = firstSource(r.sql.ast);
		expect(src.relation.parts).toEqual(["orders"]);
		expect(src.alias).toBeUndefined(); // NOT the fabricated `jjj…` second-line fill
		// The load-bearing assertion: scope binds under `orders`, not the garbage alias.
		const scopes = resolveScopes(r.sql.ast);
		const keys = [...scopes.root.sources.keys()];
		expect(keys).toContain("orders");
		expect(keys.some((k) => /^j[0-9a-ik-z]{0,2}j*$/.test(k))).toBe(false); // ordinal-aware fill pattern
	});

	it("single-line ref with a real user alias preserves it (fix must not drop real aliases)", () => {
		const r = parseTemplated("SELECT * FROM {{ ref('x') }} o", "databricks");
		const src = firstSource(r.sql.ast);
		expect(src.relation.parts).toEqual(["x"]);
		expect(src.alias).toBe("o");
	});

	it("two templated sources with real aliases preserve both (no cross-drop)", () => {
		const r = parseTemplated("SELECT * FROM {{ ref('a') }} x, {{ ref('b') }} y", "databricks");
		const from = (r.sql.ast as any).body.from;
		const byName = (n: string) => from.find((s: any) => s.relation.parts.join(".") === n);
		expect(byName("a").alias).toBe("x");
		expect(byName("b").alias).toBe("y");
	});

	it("ref inside a CTE body and a JOIN both substitute", () => {
		const sql = "WITH c AS (SELECT * FROM {{ ref('a') }}) SELECT * FROM c JOIN {{ ref('b') }} b ON c.x = b.x";
		const r = parseTemplated(sql, "databricks");
		const ast: any = r.sql.ast;
		expect(firstSource(ast.ctes[0].body).relation.parts).toEqual(["a"]);
		// The joined source rides `from` (from + joinConditions stay populated; joins is additive).
		const joined = ast.body.from.find(
			(s: any) => s.template?.call?.name === "ref" && s.relation.parts.join(".") === "b",
		);
		expect(joined).toBeDefined();
		// If joins are modelled, join.source is reference-identical to the from entry.
		if (ast.body.joins) {
			const jsrc = ast.body.joins.map((j: any) => j.source).find((s: any) => s.relation?.parts.join(".") === "b");
			expect(jsrc).toBe(joined);
		}
	});

	it("plain SQL (no tags) returns the identical ast reference", () => {
		const r = parseTemplated("SELECT 1", "databricks");
		expect(r.sql.ast).toBeDefined();
		// applyTemplateTags(ast, []) is a no-op that returns the same reference (structural sharing).
		expect(applyTemplateTags(r.sql.ast, [], "SELECT 1", OPEN_PROVIDER).ast).toBe(r.sql.ast);
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

	// Regression net for the ColumnRef.kind tag swap: markTemplateExprs used to identify a scope
	// ColumnRef record by shape-sniffing (`kind === undefined && parts + clause`); it now checks
	// `kind === "columnref"`. A scalar-slot placeholder fill (an identifier-shaped column reference)
	// lowers to BOTH a column Expr (in the projection) AND a parallel ColumnRef record (in
	// `body.columns`, same `cst`) — both must still get `.template` attached.
	it("a scalar-slot placeholder fill marks BOTH the column Expr and its parallel ColumnRef record", () => {
		const r = parseTemplated("select {{ m() }} as x from t", "databricks");
		const body = r.sql.ast.body as any;
		const projExpr = body.projections[0].expr;
		expect(projExpr.kind).toBe("column");
		expect(projExpr.template).toMatchObject({ call: { name: "m", args: [] } });
		const colRef = body.columns.find((c: any) => c.cst === projExpr.cst);
		expect(colRef).toBeDefined();
		expect(colRef.template).toMatchObject({ call: { name: "m", args: [] } });
	});

	// Regression net (final-review finding, Task 3 of the anvil post-wave batch): markTemplateExprs's
	// raw-CST-backref skip check used to be an enumerated key list (cst/aliasCst/nameCst) rather than a
	// naming-convention match. GraphElement.variableCst (a fourth such field, pre-dating this fix) was
	// never in that list — walking into it overflowed the stack, silently caught by the caller's own
	// try/catch, reverting the WHOLE substitution to a no-op for any templated query that also contains
	// a named GRAPH_TABLE element variable. The fix is now a suffix match (`k.endsWith("Cst")`), so this
	// (and any future *Cst field) can never reintroduce the same silent failure.
	it("a ref substitutes even alongside a GRAPH_TABLE element variable (variableCst) in the same query", () => {
		const sql =
			"SELECT * FROM {{ ref('a') }}, GRAPH_TABLE(fg MATCH (x:Person)-[e:Knows]->(y:Person) COLUMNS(x.name AS src, y.name AS dst))";
		expect(() => parseTemplated(sql, "bigquery")).not.toThrow();
		const r = parseTemplated(sql, "bigquery");
		const from = (r.sql.ast as any).body.from;
		const ref = from.find((s: any) => s.template?.call?.name === "ref");
		expect(ref).toBeDefined();
		expect(ref.relation.parts).toEqual(["a"]);
	});
});

// ---------------------------------------------------------------------------
// Bare-variable / expression tags in a FROM slot (2026-07-05, gap wave) —
// literal `{% set %}` indirection resolves to the real model; everything else
// gets the opaque "expr" marker so the `jjj…` placeholder never poses as a
// real table to qualify/hover/scope consumers.
// ---------------------------------------------------------------------------
describe("bare-variable FROM sources — set indirection + the expr marker", () => {
	it("{% set t = ref('x') %} … from {{ t }} binds the real model, indirect", () => {
		const r = parseTemplated("{% set t = ref('stg_orders') %}\nselect * from {{ t }}", "databricks");
		const src = firstSource(r.sql.ast);
		expect(src.relation.parts).toEqual(["stg_orders"]);
		expect(src.template).toMatchObject({ kind: "call", indirect: true, call: { name: "ref" } });
		expect(src.template.opaque).toBeUndefined();
	});

	it("{% set s = source('raw','orders') %} resolves the two-part name", () => {
		const r = parseTemplated("{% set s = source('raw', 'orders') %}\nselect * from {{ s }}", "databricks");
		const src = firstSource(r.sql.ast);
		expect(src.relation.parts).toEqual(["raw", "orders"]);
		expect(src.template).toMatchObject({ kind: "call", indirect: true, call: { name: "source" } });
	});

	it("unresolvable bare {{ t }} gets the opaque expr marker (no placeholder table)", () => {
		const r = parseTemplated("select * from {{ t }}", "databricks");
		const src = firstSource(r.sql.ast);
		expect(src.template).toMatchObject({ kind: "expr", opaque: true });
	});

	it("a composed expression tag {{ a ~ b }} gets the opaque expr marker", () => {
		const r = parseTemplated("select * from {{ a ~ b }}", "databricks");
		expect(firstSource(r.sql.ast).template).toMatchObject({ kind: "expr", opaque: true });
	});

	it("{{ var('t') }} in FROM is a generic call marker (opaque until a provider resolves it)", () => {
		// var is just a callee now — the neutral core doesn't know it's a scalar. It carries its call
		// so a provider COULD resolve it; without one it behaves opaquely (no diagnostics), like before.
		const r = parseTemplated("select * from {{ var('t') }}", "databricks");
		expect(firstSource(r.sql.ast).template).toMatchObject({ kind: "call", call: { name: "var" } });
	});

	it("guard: two sets of the same name do not resolve (ambiguous)", () => {
		const text = "{% set t = ref('a') %}\n{% set t = ref('b') %}\nselect * from {{ t }}";
		const src = firstSource(parseTemplated(text, "databricks").sql.ast);
		expect(src.template).toMatchObject({ kind: "expr", opaque: true });
	});

	it("guard: computed RHS ref(var('x')) does not resolve", () => {
		const text = "{% set t = ref(var('x')) %}\nselect * from {{ t }}";
		const src = firstSource(parseTemplated(text, "databricks").sql.ast);
		expect(src.template).toMatchObject({ kind: "expr", opaque: true });
	});

	it("guard: a composed RHS ref('a') ~ '_x' does not resolve", () => {
		const text = "{% set t = ref('a') ~ '_x' %}\nselect * from {{ t }}";
		const src = firstSource(parseTemplated(text, "databricks").sql.ast);
		expect(src.template).toMatchObject({ kind: "expr", opaque: true });
	});

	it("guard: a for-loop target shadows the set name", () => {
		const text = "{% set t = ref('a') %}\n{% for t in tables %}x{% endfor %}\nselect * from {{ t }}";
		const src = firstSource(parseTemplated(text, "databricks").sql.ast);
		expect(src.template).toMatchObject({ kind: "expr", opaque: true });
	});

	it("guard: an inline {% macro %} disables resolution (param shadowing unknowable)", () => {
		const text = "{% macro m(t) %}{{ t }}{% endmacro %}\n{% set t = ref('a') %}\nselect * from {{ t }}";
		const src = firstSource(parseTemplated(text, "databricks").sql.ast);
		expect(src.template).toMatchObject({ kind: "expr", opaque: true });
	});

	it("scope binds the resolved model name (the pipeline consumes the rewrite)", () => {
		const r = parseTemplated("{% set t = ref('stg_orders') %}\nselect * from {{ t }}", "databricks");
		const scopes = resolveScopes(r.sql.ast, "databricks");
		// cst back-refs are cyclic — stringify with a replacer that drops them.
		const names = JSON.stringify(scopes, (k, v) => (k === "cst" || k === "aliasCst" ? undefined : v));
		expect(names).toContain("stg_orders");
		expect(names).not.toMatch(/jjj/);
	});
});

// issue #35 (reported by anvil): the placeholder fill is scaffolding sqllens invented so the
// grammar parses — it must NEVER escape as a relation name. An unresolved templated source takes
// the RAW TAG TEXT as its name (the bytes the user wrote), on every unresolved branch.
describe("unresolved template sources never leak the placeholder fill (#35)", () => {
	it("providerless ref in FROM: name is the raw tag text, not the fill", () => {
		const r = parseTemplated("select x as location_id from {{ ref('silver__loc') }}", "databricks", {
			provider: OPEN_PROVIDER,
		});
		const src = firstSource(r.sql.ast);
		expect(src.relation.parts).toEqual(["{{ ref('silver__loc') }}"]);
		expect(src.template).toMatchObject({ kind: "call", call: { name: "ref" } });
	});

	it("providerless source() in FROM: raw tag text, not the fill", () => {
		const r = parseTemplated("select * from {{ source('raw', 'events') }}", "databricks", {
			provider: OPEN_PROVIDER,
		});
		expect(firstSource(r.sql.ast).relation.parts).toEqual(["{{ source('raw', 'events') }}"]);
	});

	it("providerless set-indirection: raw tag text of the USE site, not the fill", () => {
		const r = parseTemplated("{% set t = ref('stg_orders') %}\nselect * from {{ t }}", "databricks", {
			provider: OPEN_PROVIDER,
		});
		expect(firstSource(r.sql.ast).relation.parts).toEqual(["{{ t }}"]);
	});

	it("opaque expression tag in FROM: raw tag text, not the fill", () => {
		const r = parseTemplated("select * from {{ a ~ b }}", "databricks", { provider: OPEN_PROVIDER });
		const src = firstSource(r.sql.ast);
		expect(src.template).toMatchObject({ kind: "expr", opaque: true });
		expect(src.relation.parts).toEqual(["{{ a ~ b }}"]);
	});

	it("the fill never reaches scope through an unresolved source", () => {
		const r = parseTemplated("select x from {{ ref('silver__loc') }}", "databricks", {
			provider: OPEN_PROVIDER,
		});
		const scopes = resolveScopes(r.sql.ast, "databricks");
		const names = JSON.stringify(scopes, (k, v) => (k === "cst" || k === "aliasCst" ? undefined : v));
		expect(names).not.toMatch(/jjj/);
		expect(names).toContain("silver__loc");
	});
});
