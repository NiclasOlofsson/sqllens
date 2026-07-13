import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { segment } from "../src/minijinja/segment.js";
import { DbtTemplateProvider } from "../src/index.js";
import { NamedShapeProvider } from "./helpers/providers.js";

// ---------------------------------------------------------------------------
// Segmenter golden gate — locks segment()'s EXACT output (segment list +
// placeholder, byte-for-byte) over the 20 dbt fixtures plus a synthetic
// battery, so the hand-scan → ANTLR-lexer unification (and any later segmenter
// change) is provably behavior-preserving where behavior must not move: the
// placeholder is what every SQL parse sees and what anvil consumes.
//
// Regenerate (only when a behavior change is INTENDED and reviewed):
//   GOLDEN=1 npx vitest run tests/minijinja.segment-golden.test.ts
//
// Deliberately absent: broken-input cases whose tolerance the unification is
// allowed to improve (an unterminated STRING inside a tag; a string inside a
// stmt tag inside a {% raw %} block containing `{% endraw %}`) — those classes
// get their own expectations in the segmenter unit tests, not a byte lock.
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, "fixtures", "minijinja");
const goldenPath = join(here, "golden", "minijinja-segment.golden.json");

/** A dbt-aware provider — the unshaped golden cases pin the dbt fills (config -> whitespace,
 *  ref/source -> a relation body). The neutral default knows none of it (pinned separately). */
const DP = new DbtTemplateProvider();

/** Stub provider for the shaped-fill cases: shapes by macro name, like a host classifier.
 *  `ref` is force-shaped "statement" (the old buggy-catalog case): the explicit shape now WINS
 *  by the provider contract, and the SLOT GUARD is what protects `from {{ ref('x') }}` — the
 *  golden pins that the FROM-slot bytes stay identical under it. */
const stubProvider = new NamedShapeProvider({
	stmt_macro: "statement",
	pred_macro: "predicate",
	cols_macro: "column-list",
	ref: "statement",
});

interface GoldenCase {
	name: string;
	text: string;
	shaped?: boolean; // run with stubProvider
}

const synthetic: GoldenCase[] = [
	{ name: "syn:multiline-expr-macro", text: "select {{ my_macro(\n  'a',\n  'b'\n) }} as x from t" },
	{ name: "syn:raw-block-with-tags", text: "select 1 {% raw %} {{ ref('x') }} literal {% endraw %} from t" },
	{ name: "syn:raw-block-stmt-inside", text: "{% raw %} {% if x %} literal {% endraw %} tail" },
	{ name: "syn:raw-unterminated", text: "a {% raw %} everything after is literal {{ x }}" },
	{ name: "syn:endraw-ws-control", text: "{%- raw -%}body{%- endraw -%}" },
	{ name: "syn:ws-control", text: "{{- x -}} and {%- if c -%}y{%- endif -%}" },
	{ name: "syn:close-in-dquote-string", text: "WHERE n = '{{ var(\"a}}b\") }}'" },
	{ name: "syn:close-in-squote-string", text: "{{ ref('a}}b') }}" },
	{ name: "syn:stmt-close-in-string", text: "{% set x = 'a%}b' %} select 1" },
	{ name: "syn:escaped-quote-in-string", text: "{{ ref('a\\'b}}c') }} from t" },
	{ name: "syn:comment-with-hash", text: "select 1 {# a # comment #} from t" },
	{ name: "syn:comment-unterminated", text: "select 1 {# never closed" },
	{ name: "syn:config-multiline", text: "{{ config(\n  materialized='table'\n) }}\nselect 1" },
	{ name: "syn:unterminated-tag-no-string", text: "select {{ my_macro" },
	{ name: "syn:dotted-call", text: "select {{ dbt_utils.star(ref('x')) }} from {{ ref('x') }}" },
	{ name: "syn:lone-brace-eof", text: "select 1 {" },
	{ name: "syn:brace-non-opener", text: "select '{ %' as a, 2 { 3" },
	{ name: "syn:empty", text: "" },
	{ name: "syn:only-tag", text: "{{ ref('x') }}" },
	{ name: "syn:only-text", text: "select 1 from t" },
	{ name: "syn:adjacent-tags", text: "{{ a }}{% if b %}{# c #}" },
	{ name: "syn:shaped-statement", text: "{{ stmt_macro('x') }}", shaped: true },
	{ name: "syn:shaped-predicate", text: "select 1 from t where {{ pred_macro() }}", shaped: true },
	{ name: "syn:shaped-column-list", text: "select {{ cols_macro() }} from t", shaped: true },
	{ name: "syn:shaped-excluded-ref", text: "select 1 from {{ ref('x') }}", shaped: true },
	{ name: "syn:shaped-no-fit-multiline", text: "with a as ({{ stmt_macro(\n'x') }}) select * from a", shaped: true },
	{ name: "syn:shaped-bare-non-call", text: "select {{ stmt_macro }} from t", shaped: true },
];

function cases(): GoldenCase[] {
	const fixtures = readdirSync(fixtureDir)
		.filter((f) => f.endsWith(".sql"))
		.sort()
		.map((f) => ({
			name: `fixture:${f}`,
			text: readFileSync(join(fixtureDir, f), "utf8"),
		}));
	return [...fixtures, ...synthetic];
}

function computeGolden(): Record<string, { segments: unknown[]; placeholder: string }> {
	const out: Record<string, { segments: unknown[]; placeholder: string }> = {};
	for (const c of cases()) {
		const r = segment(c.text, c.shaped ? stubProvider : DP);
		out[c.name] = { segments: r.segments as unknown[], placeholder: r.placeholder };
	}
	return out;
}

describe("minijinja segmenter — golden gate", () => {
	if (process.env.GOLDEN === "1") {
		it("regenerates the golden file", () => {
			writeFileSync(goldenPath, JSON.stringify(computeGolden(), null, "\t") + "\n");
			expect(true).toBe(true);
		});
		return;
	}

	const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as ReturnType<typeof computeGolden>;
	const actual = computeGolden();

	it("covers exactly the golden case set", () => {
		expect(Object.keys(actual).sort()).toEqual(Object.keys(golden).sort());
	});

	for (const name of Object.keys(golden)) {
		it(`byte-identical: ${name}`, () => {
			expect(actual[name].placeholder).toBe(golden[name].placeholder);
			expect(actual[name].segments).toEqual(golden[name].segments);
		});
	}
});
