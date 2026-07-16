import { describe, expect, it } from "vitest";
import { completeAt, SqlDocument } from "../../src/api.js";
import { minijinja } from "../../src/minijinja/index.js";
import { Schema } from "../../src/qualify/schema.js";
import { relKey, TestRelationProvider } from "../helpers/providers.js";

// A templated SqlDocument's raw text still holds jinja `{{ }}` tags. completeAt used to run its OWN
// re-parse over that raw text to drive the ATN candidate walk, so the dialect lexer died on the braces
// from char 0 and the walk found nothing: 0 candidates on any dbt model that opens with a
// `{{ config(...) }}` block (anvil bug report, 2026-07-12). The fix: the walk now consumes the
// document's OWN already-lexed token stream (cell.tokens) instead of re-parsing. For a templated
// document those are the SQL-over-placeholder tokens (jinja tags are channel-2 tokens the walk skips),
// so completion sees real SQL at document-true offsets with no re-parse and no jinja to trip over.
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
		const templated = completeAt(doc, caret)
			.map((c) => `${c.kind}\0${c.label}`)
			.sort();
		const plain = completeAt(placeholderDoc, caret)
			.map((c) => `${c.kind}\0${c.label}`)
			.sort();
		expect(templated).toEqual(plain);
	});

	it("surfaces a schema table's columns at a value slot in a templated document", () => {
		const schema = new Schema({ sales: { amount: "decimal", id: "int" } });
		const sql = "{{ config(materialized='table') }}\nselect  from sales";
		const doc = SqlDocument.create(sql, "databricks", { templating: minijinja() });
		const offset = sql.indexOf("select ") + "select ".length;
		const cols = completeAt(doc, offset, schema)
			.filter((c) => c.kind === "column")
			.map((c) => c.label);
		expect(cols).toContain("amount");
		expect(cols).toContain("id");
	});

	// A dangling qualifier dot (`c.` with nothing typed after) breaks the SELECT-list parse, so completeAt
	// takes the token-stream fallback. That fallback resolved a plain physical table's columns (columnsFor)
	// but NOT a templated source's — so `{{ ref('customers') }} c` answered nothing at `c.|`, and every dbt
	// FROM is a templated ref/source (anvil dangling-dot report). The member-twin now resolves the templated
	// source through the provider (relationOf), the same seam the non-dangling FROM-relation path uses.
	it("resolves a templated source's columns at a dangling qualifier dot", () => {
		const provider = new TestRelationProvider();
		provider.cache.set(relKey("ref", ["customers"]), {
			nameParts: ["customers"],
			columns: [
				{ name: "cust_id", type: "int" },
				{ name: "email", type: "string" },
			],
		});
		const sql = "select c. from {{ ref('customers') }} c";
		const doc = SqlDocument.create(sql, "databricks", { templating: minijinja() });
		const offset = "select c.".length;
		const cols = completeAt(doc, offset, provider)
			.filter((c) => c.kind === "column")
			.map((c) => c.label);
		expect(cols).toContain("cust_id");
		expect(cols).toContain("email");
	});
});
