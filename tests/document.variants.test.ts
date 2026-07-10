import { describe, it, expect } from "vitest";
import { SqlDocument, Schema } from "../src/index.js";
import { minijinja } from "../src/minijinja/index.js";
import { TestRelationProvider, relKey } from "./helpers/providers.js";

const A3 = "SELECT {% if v %}col_a{% else %}col_b{% endif %}, c FROM anchor_table";

describe("doc.variants — per-arm sub-documents", () => {
	it("plain and region-free templated docs answer []", () => {
		expect(SqlDocument.create("select 1", "duckdb").variants).toEqual([]);
		expect(
			SqlDocument.create("select * from {{ ref('t') }}", "duckdb", { templating: minijinja() }).variants,
		).toEqual([]);
	});
	it("each arm is a full document; coordinates are document-true (A3 anchor)", () => {
		const doc = SqlDocument.create(A3, "duckdb", { templating: minijinja() });
		expect(doc.variants.length).toBe(2);
		for (const v of doc.variants) {
			expect(v.text().length).toBe(A3.length);
			const d = v.doc();
			expect(d.errors).toBe(0);
			const anchor = d.tokens.find((t) => t.text === "anchor_table")!;
			expect([anchor.start, anchor.stop + 1]).toEqual([57, 69]); // brief A3: byte-exact
		}
	});
	it("arm docs share the cache family across withText (unchanged arm = object-identical ast)", () => {
		const doc = SqlDocument.create(A3, "duckdb", { templating: minijinja() });
		const armAst = doc.variants[1].doc().statements[0].ast;
		const next = doc.withText(A3, 2);
		expect(next.variants[1].doc().statements[0].ast).toBe(armAst);
	});
	it("variantAt routes offsets to the arm where the byte is live", () => {
		const doc = SqlDocument.create(A3, "duckdb", { templating: minijinja() });
		const inColA = A3.indexOf("col_a");
		const inColB = A3.indexOf("col_b");
		const inAnchor = A3.indexOf("anchor_table");
		expect(doc.variantAt(inColA)!.text()).toContain("col_a");
		expect(doc.variantAt(inColB)!.text()).toContain("col_b");
		expect(doc.variantAt(inAnchor)).toBe(doc.variants[0]); // outside every region → variant 0
		expect(doc.variantAt(-1)).toBe(doc.variants[0]); // honest default, never a throw
		expect(SqlDocument.create("select 1", "duckdb").variantAt(0)).toBeUndefined();
	});
	it("variantAt never routes an arm-0 (default) offset to a sibling synthetic-empty variant", () => {
		// Inner if is else-less and nested inside the outer region's arm 0. An offset in the
		// inner arm-0 body must route to variant 0 (where the default arm is live) — NOT to the
		// inner region's synthetic "region absent" variant, which blanks that very byte.
		const NESTED =
			"with data as (\n    SELECT base_col{% if outer %}, extra_col{% if inner %}, col_a{% endif %}{% else %}, col_c{% endif %} FROM raw_table\n)\nSELECT * FROM data";
		const doc = SqlDocument.create(NESTED, "duckdb", { templating: minijinja() });
		const inColA = NESTED.indexOf("col_a");
		expect(doc.variantAt(inColA)).toBe(doc.variants[0]);
		expect(doc.variants[0].text()).toContain("col_a");
	});
});

describe("union views — unionSymbols / unionDiagnostics / unionCtes / unionOutputColumns", () => {
	it("unionSymbols carries arm-local symbols, deduped (A4)", () => {
		const doc = SqlDocument.create(A3, "duckdb", { templating: minijinja() });
		const syms = doc.unionSymbols();
		const names = syms.map((s) => s.name);
		expect(names).toContain("col_a");
		expect(names).toContain("col_b");
		expect(names.filter((n) => n === "c").length).toBe(1);
		expect(names.filter((n) => n === "anchor_table").length).toBe(1);
		const anchor = syms.find((s) => s.name === "anchor_table")!;
		expect([anchor.span.start, anchor.span.end]).toEqual([57, 69]); // A3 anchor holds in the union
	});

	it("zero-width star-Sym expansion survives the union key (A5)", async () => {
		// Brief adjustment point, resolved: the plan's own filter (`.includes("star")` alone) also
		// matches the ALWAYS-emitted opaque `*` Sym (symbols.ts emitColumns pushes it unconditionally,
		// modifiers ["star"] with no "reference") — every existing precedent for isolating the
		// EXPANDED star columns (tests/symbols.test.ts) filters on BOTH "star" and "reference"; used
		// here too so the assertion actually targets the 3 expanded columns, not 4.
		const provider = new TestRelationProvider();
		const doc = SqlDocument.create("select * from {{ ref('t') }}", "duckdb", {
			templating: minijinja(),
			provider,
		});
		// Warm the provider exactly as tests/document.templated.test.ts's invalidation test does:
		// a cold `ref('t')` records a miss during the parse above, then prime() drains it.
		provider.pending.set(relKey("ref", ["t"]), { nameParts: ["t"] });
		provider.tableColumns.set("t", [{ name: "a" }, { name: "b" }, { name: "c" }]);
		expect(await provider.prime()).toBe(true);
		const cols = doc
			.unionSymbols(provider)
			.filter((s) => s.modifiers.includes("star") && s.modifiers.includes("reference"));
		expect(cols.map((s) => s.name).sort()).toEqual(["a", "b", "c"]); // span-only key would collapse to one
	});

	it("diagnostics dedup by position+identity, not message (A6)", () => {
		const SQL = "{% if v %}select x.nope1 from t x{% else %}select  x.nope1 from t x{% endif %}";
		const doc = SqlDocument.create(SQL, "duckdb", { templating: minijinja() });
		const schema = new Schema({ t: { a: "int" } });
		const diags = doc
			.unionDiagnostics(schema)
			.filter((d) => String((d as { message?: string }).message ?? "").includes("nope1"));
		expect(diags.length).toBe(2); // same message, different offsets — the wart-fix regression pin
	});

	it("a no-variant doc's union views deep-equal the plain single-doc answers", () => {
		const plain = SqlDocument.create("select a, b from t", "duckdb");
		expect(plain.unionSymbols()).toEqual(plain.analyze().symbols);
		expect(plain.unionDiagnostics()).toEqual([...plain.diagnostics, ...plain.analyze().diagnostics]);

		const noRegion = SqlDocument.create("select * from {{ ref('t') }}", "duckdb", { templating: minijinja() });
		expect(noRegion.unionSymbols()).toEqual(noRegion.analyze().symbols);
	});

	it("unionCtes unions one CTE's columns across arms by name (A8a smoke)", () => {
		const SQL =
			"with data as (\n" +
			"    SELECT\n" +
			"        {% if is_incremental() %}incremental_col{% else %}full_col{% endif %},\n" +
			"        shared_col\n" +
			"    FROM raw_table\n" +
			")\n" +
			"SELECT * FROM data";
		const doc = SqlDocument.create(SQL, "duckdb", { templating: minijinja() });
		const ctes = doc.unionCtes();
		expect(ctes.length).toBe(1);
		const data = ctes[0];
		expect(data.name).toBe("data");
		const names = data.columns.map((c) => c.name);
		expect(names.filter((n) => n === "incremental_col").length).toBe(1);
		expect(names.filter((n) => n === "full_col").length).toBe(1);
		expect(names.filter((n) => n === "shared_col").length).toBe(1);
	});

	it("unionCtes/unionOutputColumns fall through to the single-arm answer with no variants", () => {
		const doc = SqlDocument.create("with data as (select a, b from t) select * from data", "duckdb");
		const ctes = doc.unionCtes();
		expect(ctes.length).toBe(1);
		expect(ctes[0].columns.map((c) => c.name)).toEqual(["a", "b"]);
		expect(doc.unionOutputColumns().map((c) => c.name)).toEqual(["a", "b"]);
	});
});
