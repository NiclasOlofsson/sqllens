// Identifier-fill uniqueness (Niclas's design review via anvil, 2026-07-06): two distinct
// same-length tags used to fill byte-identically (`jjjj…` twice), so everything name-keyed
// downstream collided — duplicate projection names, alias resolution, the extension's
// variant merge deduping two macro columns into one. Each identifier fill now encodes a
// per-tag ordinal: `"j" + base35(ordinal) + "j"-padding` — the ordinal alphabet EXCLUDES
// `j` (base36's 19 is `j`, which would rebuild an all-j fill and collide; and a case-based
// alphabet dies under identifier folding). Length and newline offsets stay exact.

import { describe, expect, test } from "vitest";
import { parseTemplated } from "../src/minijinja/index.js";

/** The fill slice for the k-th `{{ … }}` tag of `text`, cut from the placeholder. */
function fillSlices(text: string, placeholder: string): string[] {
	const out: string[] = [];
	const re = /\{\{[\s\S]*?\}\}/g;
	for (let m = re.exec(text); m; m = re.exec(text)) {
		out.push(placeholder.slice(m.index, m.index + m[0].length));
	}
	return out;
}

describe("identifier-fill uniqueness", () => {
	test("two same-length tags fill to DISTINCT identifiers (the anvil repro)", () => {
		const text = "select {{ macro_one() }}, {{ macro_two() }} from t";
		const r = parseTemplated(text, "databricks");
		expect(r.sql.errors).toBe(0);
		const [a, b] = fillSlices(text, r.placeholder);
		expect(a).not.toBe(b);
		// …and the downstream name keys are distinct too:
		const names = (r.sql.ast.body as { projections: { name?: string }[] }).projections.map((p) => p.name);
		expect(names).toHaveLength(2);
		expect(names[0]).not.toBe(names[1]);
	});

	test("fills are identifier-safe, ordinal-encoded, document-ordered, pairwise distinct", () => {
		const text = "select {{ a() }}, {{ b() }}, {{ c() }} from t";
		const r = parseTemplated(text, "databricks");
		expect(r.sql.errors).toBe(0);
		const slices = fillSlices(text, r.placeholder).map((s) => s.trimEnd());
		expect(new Set(slices).size).toBe(3);
		for (const s of slices) {
			// leading letter, base35 ordinal (no `j`), all-j padding — a valid bare identifier
			expect(s).toMatch(/^j[0-9a-ik-z]{1,2}j*$/);
		}
	});

	test("long fills still match the /j{4,}/ leak-detector contract (anvil tripwire compat)", () => {
		const text = "select {{ some_longer_macro_call('x') }} from t";
		const r = parseTemplated(text, "databricks");
		const [s] = fillSlices(text, r.placeholder);
		expect(s!.trimEnd()).toMatch(/j{4,}/);
	});

	test("length and newline offsets stay exact with ordinal fills (multi-line unshaped tag)", () => {
		const text = "select {{\n my_helper('x')\n}} as c from t";
		const r = parseTemplated(text, "databricks");
		expect(r.placeholder.length).toBe(text.length);
		for (let i = 0; i < text.length; i++) {
			if (text[i] === "\n") expect(r.placeholder[i], `newline @${i}`).toBe("\n");
		}
	});

	test("whitespace and shaped fills carry no ordinal (unchanged)", () => {
		const text = "{{ config(materialized='view') }}\nselect 1";
		const r = parseTemplated(text, "databricks");
		const [s] = fillSlices(text, r.placeholder);
		expect(s!.trim()).toBe(""); // no-output builtin stays pure whitespace
	});
});
