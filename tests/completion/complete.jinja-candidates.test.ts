import { describe, expect, it } from "vitest";
import {
	completeAt,
	DbtTemplateProvider,
	SqlDocument,
	type TemplateCall,
	type TemplateCandidate,
} from "../../src/index.js";
import { minijinja } from "../../src/minijinja/index.js";

// REQ2b: completeAt fires inside a jinja tag. The NEUTRAL half (which call + arg slot the caret is in)
// is jinjaSlotAt; the HOST half (what candidates that slot has) is TemplateProvider.templateCandidates.
// completeAt joins them: a caret inside {{ ref('| }} returns the host's model list as "template"
// completions, and never SQL keywords. The library default provider knows no vocabulary and offers
// none, so a bare document stays quiet inside a tag.

/** A host catalog: ref arg 0 → models, source arg 0/1 → source/table names, callee slot → macro names.
 *  source arg 1 is ARG-DEPENDENT (#37): the tables OF the source named in arg 0. */
class Catalog extends DbtTemplateProvider {
	override templateCandidates(call: TemplateCall, argIndex: number): TemplateCandidate[] {
		if (call.name === "ref" && argIndex === 0)
			return [{ label: "orders" }, { label: "customers", detail: "staging" }];
		if (call.name === "source" && argIndex === 0) return [{ label: "raw" }, { label: "stripe" }];
		if (call.name === "source" && argIndex === 1) {
			if (call.args[0] === "raw") return [{ label: "events" }];
			if (call.args[0] === "stripe") return [{ label: "payments" }];
			return [{ label: "events" }, { label: "payments" }]; // group unknown → union
		}
		// The callee-name slot: every callee the host knows (builtins + macros), filtered by the prefix.
		if (argIndex === -1) return [{ label: "ref" }, { label: "source" }, { label: "star" }, { label: "date_spine" }];
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

	it("source's second arg returns the tables OF the group named in arg 0 (#37)", () => {
		const text = "select * from {{ source('raw', '";
		const labels = completeAt(doc(text, new Catalog()), text.length, new Catalog()).map((c) => c.label);
		expect(labels).toEqual(["events"]); // raw's tables only — NOT stripe's payments
	});

	it("source's second arg for the OTHER group answers that group's tables (#37)", () => {
		const text = "select * from {{ source('stripe', '";
		const labels = completeAt(doc(text, new Catalog()), text.length, new Catalog()).map((c) => c.label);
		expect(labels).toEqual(["payments"]);
	});

	it("the callee-name slot (caret in a call's name) returns the host's callee names", () => {
		const text = "{{ date_spine(";
		const caret = "{{ date_s".length; // inside the callee identifier, before the paren
		const labels = completeAt(doc(text, new Catalog()), caret, new Catalog())
			.map((c) => c.label)
			.sort();
		expect(labels).toEqual(["date_spine", "ref", "source", "star"]);
	});

	it("a bare identifier being typed with no paren yet ({{ re) offers the callee names", () => {
		const text = "select * from {{ re";
		const items = completeAt(doc(text, new Catalog()), text.length, new Catalog());
		expect(items.every((c) => c.kind === "template")).toBe(true);
		expect(items.map((c) => c.label)).toContain("ref"); // the editor filters this list by the "re" prefix
	});

	it("a call embedded in a control tag ({% set m = ref('cu) flows to the host's models", () => {
		const text = "select * from t\n{% set m = ref('cu";
		const labels = completeAt(doc(text, new Catalog()), text.length, new Catalog()).map((c) => c.label);
		expect(labels).toContain("customers");
		expect(labels).toContain("orders");
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

	it("column completion on a ref relation resolves even mid-edit SELECT list (broken parse)", () => {
		// The incomplete SELECT drops the FROM from the parse, but the broken-input fallback maps the ref
		// placeholder back to `orders` through the provider and offers its columns (the vanilla schema path).
		class Rel extends DbtTemplateProvider {
			override columnsFor(parts: string[]) {
				return parts.join(".") === "orders" ? [{ name: "id" }, { name: "total" }] : undefined;
			}
		}
		const text = "select  from {{ ref('orders') }} o";
		const cols = completeAt(doc(text, new Rel()), "select ".length, new Rel())
			.filter((c) => c.kind === "column")
			.map((c) => c.label);
		expect(cols).toEqual(["id", "total"]);
	});
});
