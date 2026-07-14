import { describe, expect, it } from "vitest";
import { jinjaSlotAt } from "../../src/api.js";
import { parseTemplated } from "../../src/minijinja/index.js";

// jinjaSlotAt: the NEUTRAL "which call + arg slot is the caret in" for jinja completion (anvil REQ2).
// It returns { callee, argIndex, prefix, incomplete } and no dbt meaning; the consumer maps callee +
// argIndex to a role (ref arg0 = a model) and supplies candidates.
function slotAt(text: string, caret: number) {
	const { tags } = parseTemplated(text, "databricks");
	return jinjaSlotAt(tags, text, caret);
}

describe("jinjaSlotAt", () => {
	it("caret in a mid-typing ref's model arg → { callee: ref, argIndex: 0, prefix }", () => {
		const text = "select * from {{ ref('cu";
		const slot = slotAt(text, text.length);
		expect(slot).toEqual({ callee: "ref", argIndex: 0, prefix: "cu", incomplete: true });
	});

	it("caret right after the open paren → argIndex 0, empty prefix", () => {
		const text = "{{ ref(";
		const slot = slotAt(text, text.length);
		expect(slot).toMatchObject({ callee: "ref", argIndex: 0, prefix: "", incomplete: true });
	});

	it("caret in source's SECOND arg → argIndex 1", () => {
		const text = "{{ source('raw', 'ord";
		const slot = slotAt(text, text.length);
		expect(slot).toMatchObject({ callee: "source", argIndex: 1, prefix: "ord" });
	});

	it("caret right after a comma (gap) → the next arg being typed", () => {
		const text = "{{ source('raw', ";
		const slot = slotAt(text, text.length);
		expect(slot).toMatchObject({ callee: "source", argIndex: 1, prefix: "" });
	});

	it("caret still in the callee name → argIndex -1 with the typed callee prefix", () => {
		// A complete call so the tag parses; caret placed inside `ref`.
		const text = "{{ ref('x') }}";
		const caret = "{{ re".length; // inside "ref"
		const slot = slotAt(text, caret);
		expect(slot).toMatchObject({ callee: "ref", argIndex: -1, prefix: "re" });
	});

	it("a complete call's arg still reports the slot (not flagged incomplete)", () => {
		const text = "{{ ref('customers') }}";
		const caret = "{{ ref('cust".length; // inside 'customers'
		const slot = slotAt(text, caret);
		expect(slot).toMatchObject({ callee: "ref", argIndex: 0, prefix: "cust", incomplete: false });
	});

	it("a package-qualified call carries the package", () => {
		const text = "{{ dbt_utils.star('a', ";
		const slot = slotAt(text, text.length);
		expect(slot).toMatchObject({ callee: "star", packageName: "dbt_utils", argIndex: 1 });
	});

	it("caret outside any jinja call (in plain SQL) → undefined", () => {
		const text = "select a from {{ ref('x') }}";
		expect(slotAt(text, "select ".length)).toBeUndefined();
	});

	it("caret in a control tag with no call → undefined (not a call slot)", () => {
		const text = "{% if x %}";
		expect(slotAt(text, 5)).toBeUndefined();
	});

	it("a bare leading identifier being typed ({{ re) is a callee-name slot", () => {
		const text = "select * from {{ re";
		expect(slotAt(text, text.length)).toEqual({ callee: "re", argIndex: -1, prefix: "re", incomplete: true });
	});

	it("a complete bare variable ({{ region }}) still offers the callee slot on its identifier", () => {
		const text = "select {{ region }} from t";
		expect(slotAt(text, "select {{ regi".length)).toMatchObject({ callee: "regi", argIndex: -1, prefix: "regi" });
	});

	it("a call embedded in a control tag ({% if is_incremental(| %}) is found", () => {
		const text = "select * from t\n{% if is_incremental(";
		expect(slotAt(text, text.length)).toMatchObject({ callee: "is_incremental", argIndex: 0 });
	});

	it("a nested call reports the INNERMOST ({{ outer(inner('cu → inner)", () => {
		const text = "select {{ outer(inner('cu";
		expect(slotAt(text, text.length)).toMatchObject({ callee: "inner", argIndex: 0, prefix: "cu" });
	});

	it("a bare composed expression ({{ a ~ b) is not a callee slot", () => {
		const text = "select {{ a ~ b";
		expect(slotAt(text, text.length)).toBeUndefined();
	});
});
