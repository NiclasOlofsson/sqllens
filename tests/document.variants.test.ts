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
});
