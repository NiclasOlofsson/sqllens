import { describe, it, expect } from "vitest";
import { SqlDocument } from "../src/index.js";
import { minijinja } from "../src/minijinja/index.js";

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
