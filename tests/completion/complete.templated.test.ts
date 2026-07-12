import { describe, expect, it } from "vitest";
import { completeAt, SqlDocument } from "../../src/api.js";
import { minijinja } from "../../src/minijinja/index.js";
import { Schema } from "../../src/qualify/schema.js";

// A templated SqlDocument's raw text still holds jinja `{{ }}` tags. completeAt runs its OWN
// error-tolerant re-parse to drive the ATN candidate walk; feeding it the RAW text made the dialect
// lexer die on the braces from char 0, so the walk found nothing and completion returned 0 candidates
// on any dbt model that opens with a `{{ config(...) }}` block (anvil bug report, 2026-07-12). The fix:
// the re-parse lexes the document's length-preserving `placeholder` (the same blanked SQL its own parse
// ran on), so the caret offset stays exact and the walk sees real SQL.
describe("completeAt on a templated document (jinja-blindness regression)", () => {
	// The exact shape anvil reported: a databricks dbt model opening with a config block, caret at an
	// empty value slot inside a CASE.
	const MODEL = "{{ config(materialized='table') }}\nselect\n  case when x = 1 then  end as c\nfrom t";
	const caret = MODEL.indexOf("then ") + "then ".length;

	it("offers keyword + function candidates at a value slot despite the leading jinja block", () => {
		const doc = SqlDocument.create(MODEL, "databricks", { templating: minijinja() });
		const items = completeAt(doc, caret);
		expect(items.filter((c) => c.kind === "function").length).toBeGreaterThan(0);
		expect(items.filter((c) => c.kind === "keyword").length).toBeGreaterThan(0);
	});

	it("matches the same-offset candidates of the blanked placeholder document", () => {
		const doc = SqlDocument.create(MODEL, "databricks", { templating: minijinja() });
		const placeholderDoc = SqlDocument.create(doc.templated!.placeholder, "databricks");
		// Placeholder is length-preserving, so the caret offset is identical in both.
		expect(doc.templated!.placeholder.length).toBe(MODEL.length);
		const templated = completeAt(doc, caret).map((c) => `${c.kind}\0${c.label}`).sort();
		const plain = completeAt(placeholderDoc, caret).map((c) => `${c.kind}\0${c.label}`).sort();
		expect(templated).toEqual(plain);
	});

	it("surfaces a schema table's columns at a value slot in a templated document", () => {
		const schema = new Schema({ sales: { amount: "decimal", id: "int" } });
		const sql = "{{ config(materialized='table') }}\nselect  from sales";
		const doc = SqlDocument.create(sql, "databricks", { templating: minijinja() });
		const offset = sql.indexOf("select ") + "select ".length;
		const cols = completeAt(doc, offset, schema).filter((c) => c.kind === "column").map((c) => c.label);
		expect(cols).toContain("amount");
		expect(cols).toContain("id");
	});
});
