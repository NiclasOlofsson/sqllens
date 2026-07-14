import { describe, expect, it } from "vitest";
import { completeAt, DbtTemplateProvider, SqlDocument, type TemplateCandidate } from "../../src/index.js";
import { minijinja } from "../../src/minijinja/index.js";

// REQ2b: completeAt fires inside a jinja tag. The NEUTRAL half (which call + arg slot the caret is in)
// is jinjaSlotAt; the HOST half (what candidates that slot has) is TemplateProvider.templateCandidates.
// completeAt joins them: a caret inside {{ ref('| }} returns the host's model list as "template"
// completions, and never SQL keywords. The library default provider knows no vocabulary and offers
// none, so a bare document stays quiet inside a tag.

/** A host catalog: ref arg 0 → models, source arg 0/1 → source/table names, callee slot → macro names. */
class Catalog extends DbtTemplateProvider {
	override templateCandidates(callee: string, argIndex: number): TemplateCandidate[] {
		if (callee === "ref" && argIndex === 0) return [{ label: "orders" }, { label: "customers", detail: "staging" }];
		if (callee === "source" && argIndex === 0) return [{ label: "raw" }];
		if (callee === "source" && argIndex === 1) return [{ label: "events" }];
		if (argIndex === -1) return [{ label: "star" }, { label: "date_spine" }]; // macro names at the callee slot
		return [];
	}
}

const doc = (text: string, provider?: DbtTemplateProvider) =>
	SqlDocument.create(text, "databricks", { templating: minijinja(), ...(provider ? { provider } : {}) });

describe("completeAt inside a jinja tag (REQ2b)", () => {
	it("a mid-typing ref's model arg returns the host's models as template completions", () => {
		const text = "select * from {{ ref('";
		const items = completeAt(doc(text, new Catalog()), text.length, new Catalog());
		expect(items.every((c) => c.kind === "template")).toBe(true); // no SQL keywords inside the tag
		expect(items.map((c) => c.label).sort()).toEqual(["customers", "orders"]);
		expect(items.find((c) => c.label === "customers")?.detail).toBe("staging");
	});

	it("a complete ref's arg still reports the models (the editor filters by the typed prefix)", () => {
		const text = "select * from {{ ref('cust') }}";
		const caret = text.indexOf("cust") + "cust".length;
		const labels = completeAt(doc(text, new Catalog()), caret, new Catalog()).map((c) => c.label);
		expect(labels).toContain("customers");
		expect(labels).toContain("orders");
	});

	it("source's second arg returns the table candidates for that slot", () => {
		const text = "select * from {{ source('raw', '";
		const labels = completeAt(doc(text, new Catalog()), text.length, new Catalog()).map((c) => c.label);
		expect(labels).toEqual(["events"]);
	});

	it("the callee-name slot returns the host's macro names", () => {
		// The caret is in the callee identifier of a call (slot detection needs the open paren; a bare
		// `{{ dat` with no paren is not yet a call tag, an open REQ2a limitation, so it stays SQL).
		const text = "{{ date_spine(";
		const caret = "{{ date_s".length; // inside the callee identifier, before the paren
		const labels = completeAt(doc(text, new Catalog()), caret, new Catalog()).map((c) => c.label);
		expect(labels).toEqual(["star", "date_spine"]);
	});

	it("the neutral default provider offers nothing inside a tag (no vocabulary), and no SQL leaks", () => {
		const text = "select * from {{ ref('";
		// No provider passed to completeAt: the caret is in a tag, so no SQL keywords, and no candidates.
		expect(completeAt(doc(text), text.length)).toEqual([]);
	});

	it("a caret in ordinary SQL (outside any tag) still gets SQL completion, never template items", () => {
		const text = "{{ config(materialized='table') }}\nselect  from orders";
		const caret = text.indexOf("select ") + "select ".length;
		const items = completeAt(doc(text, new Catalog()), caret, new Catalog());
		expect(items.some((c) => c.kind === "template")).toBe(false);
		expect(items.some((c) => c.kind === "keyword" || c.kind === "function")).toBe(true);
	});

	// The caret is inside a jinja construct that is NOT a call slot. The tag was blanked to a
	// placeholder in a SQL position, so without suppression the SQL walk leaks keywords/functions there.
	it("a caret inside a control tag ({% if | %}) leaks no SQL", () => {
		const text = "select * from t\n{% if  %}\nwhere x = 1{% endif %}";
		const caret = text.indexOf("{% if ") + "{% if ".length;
		expect(completeAt(doc(text, new Catalog()), caret, new Catalog())).toEqual([]);
	});

	it("a caret inside a bare expression tag ({{ a ~ | }}) leaks no SQL", () => {
		const text = "select {{ a ~  }} from t";
		const caret = text.indexOf("~ ") + 2;
		expect(completeAt(doc(text, new Catalog()), caret, new Catalog())).toEqual([]);
	});
});
