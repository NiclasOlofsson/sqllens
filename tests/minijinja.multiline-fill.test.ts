import { describe, expect, it } from "vitest";
import { parseTemplated } from "../src/minijinja/parse.js";
import { segment } from "../src/minijinja/segment.js";
import type { Dialect } from "../src/api.js";
import type { ExpansionShape } from "../src/qualify/template-catalog.js";

// ---------------------------------------------------------------------------
// Regression: a MULTI-LINE `{{ }}` expr tag must fill to ONE first-line
// identifier, not one `j`-run per line. The preserved `\n`s used to split the
// identifier fill into several adjacent identifiers (`select jjjj jjjjjj … as x`
// → mismatched input), breaking the SQL parse. Anvil cascade-deletion blocker.
// ---------------------------------------------------------------------------

const DIALECTS: Dialect[] = ["databricks", "tsql", "snowflake", "bigquery", "redshift", "postgres", "duckdb", "trino"];

// The anvil minimal repro: a macro call spread across multiple lines.
const MULTILINE = 'select {{\n  elo_calc(\n   "a",\n   "b",\n  )\n}} as x from t';
const SINGLELINE = 'select {{ elo_calc("a","b") }} as x from t';

/** 0-based offsets of every `\n`. */
function newlineOffsets(s: string): number[] {
	const out: number[] = [];
	for (let i = 0; i < s.length; i++) if (s[i] === "\n") out.push(i);
	return out;
}

describe("minijinja multi-line {{ }} fill — parse across all 8 dialects", () => {
	for (const dialect of DIALECTS) {
		it(`multi-line macro-call tag parses with 0 errors (${dialect})`, () => {
			const r = parseTemplated(MULTILINE, dialect);
			expect(r.sql.errors).toBe(0);
		});

		it(`single-line tag still parses with 0 errors (${dialect})`, () => {
			const r = parseTemplated(SINGLELINE, dialect);
			expect(r.sql.errors).toBe(0);
		});
	}
});

describe("minijinja multi-line fill — placeholder invariants", () => {
	it("length identical + every newline at its original offset", () => {
		const { placeholder } = segment(MULTILINE);
		expect(placeholder.length).toBe(MULTILINE.length);
		expect(newlineOffsets(placeholder)).toEqual(newlineOffsets(MULTILINE));
	});

	it("the first-line run is a SINGLE identifier (no interior newline in the j-run)", () => {
		const { placeholder } = segment(MULTILINE);
		// The tag opens after "select " at offset 7. Its first line is "{{" → "jj",
		// then the rest of the first line (up to the first `\n`) is the j-run.
		const firstNl = placeholder.indexOf("\n");
		const firstLineTail = placeholder.slice(7, firstNl); // the tag's first line, from `{{`
		expect(firstLineTail).toMatch(/^j+$/); // all identifier chars, one contiguous run
		// Every continuation-line position that WAS tag interior is now whitespace: no `j` after the first newline.
		const afterFirstNl = placeholder.slice(firstNl);
		expect(afterFirstNl).not.toMatch(/j/);
	});

	it("single-line tag placeholder is byte-identical to the all-`j` fill (regression guard)", () => {
		// A single-line macro tag has no interior newline, so first-line-only == full fill.
		const text = "select {{ m() }} as x from t";
		const { placeholder } = segment(text);
		// Reconstruct the expected: the whole tag range is `j`, non-tag SQL untouched.
		const expected = "select jjjjjjjjj as x from t";
		expect(placeholder).toBe(expected);
	});
});

describe("minijinja multi-line fill — whitespace + shaped paths unaffected", () => {
	it("a multi-line `{% %}` stmt tag stays all-whitespace", () => {
		const text = "select 1\n{% set x =\n  42 %}\nfrom t";
		const { placeholder, segments } = segment(text);
		const tag = segments.find((s) => s.kind === "tag");
		expect(tag).toBeDefined();
		if (tag) {
			const fill = placeholder.slice(tag.start, tag.end);
			// Only spaces and preserved newlines — never a `j`.
			expect(fill).toMatch(/^[ \n]+$/);
		}
	});

	it("a multi-line tag with shapeOf→statement falls back to the first-line identifier fill and parses", () => {
		// `SELECT 1` cannot fit before the tag's first `\n` (`{{\n…`), so the fit guard rejects the
		// shaped fragment and the code falls back to the identifier fill — now first-line-only.
		const shapeOf = (): ExpansionShape => "statement";
		const text = "select {{\n  my_macro()\n}} as x from t";
		const r = parseTemplated(text, "duckdb", { shapeOf });
		expect(r.sql.errors).toBe(0);
	});
});
