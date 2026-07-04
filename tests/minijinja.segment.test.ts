import { describe, expect, it } from "vitest";
import { segment, NO_OUTPUT_BUILTINS, type Segment } from "../src/minijinja/segment.js";

// ---------------------------------------------------------------------------
// Task 2 — the document-level segmenter + placeholder substitution
// (docs/minijinja-front-end.md §mechanism steps 1-2). These drive raw jinja-SQL
// text through the outer-language scan and assert both the segment list (tiling,
// tag boundaries respecting jinja's own nesting) and the length/newline-
// preserving placeholder — the load-bearing invariant.
// ---------------------------------------------------------------------------

/** The 0-based offsets of every `\n` in a string, in order. */
function newlineOffsets(s: string): number[] {
	const out: number[] = [];
	for (let i = 0; i < s.length; i++) if (s[i] === "\n") out.push(i);
	return out;
}

/** Slice of the placeholder covering a tag segment. */
function fillOf(placeholder: string, seg: Segment): string {
	return placeholder.slice(seg.start, seg.end);
}

/** The load-bearing property: length identical + newline offsets identical. */
function assertLengthAndNewlines(text: string): SegmentResultForAssert {
	const r = segment(text);
	expect(r.placeholder.length).toBe(text.length);
	expect(newlineOffsets(r.placeholder)).toEqual(newlineOffsets(text));
	// Tiling: contiguous, cover [0, len), no gaps/overlaps.
	let cursor = 0;
	for (const seg of r.segments) {
		expect(seg.start).toBe(cursor);
		expect(seg.end).toBeGreaterThan(seg.start);
		cursor = seg.end;
	}
	expect(cursor).toBe(text.length);
	return r;
}
type SegmentResultForAssert = ReturnType<typeof segment>;

describe("jinja segmenter — segment list", () => {
	it("splits SELECT {{ ref('x') }} FROM t into [sql, expr-tag, sql]", () => {
		const text = "SELECT {{ ref('x') }} FROM t";
		const { segments } = segment(text);
		expect(segments.map((s) => (s.kind === "tag" ? s.tagKind : "sql"))).toEqual(["sql", "expr", "sql"]);
		const tag = segments[1];
		expect(tag).toMatchObject({ kind: "tag", tagKind: "expr", text: "{{ ref('x') }}" });
	});

	it("treats a `}}` inside the tag's string as literal, not a close", () => {
		const text = `WHERE n = '{{ var("a}}b") }}'`;
		const { segments } = segment(text);
		const tags = segments.filter((s) => s.kind === "tag");
		expect(tags).toHaveLength(1);
		expect(tags[0]).toMatchObject({ tagKind: "expr", text: `{{ var("a}}b") }}` });
	});

	it("segments a single-quoted `}}` inside the tag string as literal too", () => {
		const text = "{{ ref('a}}b') }}";
		const { segments } = segment(text);
		expect(segments).toHaveLength(1);
		expect(segments[0]).toMatchObject({ kind: "tag", tagKind: "expr", text });
	});

	it("emits {% raw %} / {% endraw %} as tags and the middle as ONE literal sql", () => {
		const text = "{% raw %}{{ x }}{% endraw %}";
		const { segments } = segment(text);
		expect(segments.map((s) => (s.kind === "tag" ? s.tagKind : "sql"))).toEqual(["stmt", "sql", "stmt"]);
		expect(segments[0]).toMatchObject({ text: "{% raw %}" });
		expect(segments[1]).toMatchObject({ kind: "sql" });
		// The `{{ x }}` between is literal — NOT segmented as a tag.
		const middle = segments[1];
		expect(text.slice(middle.start, middle.end)).toBe("{{ x }}");
		expect(segments[2]).toMatchObject({ text: "{% endraw %}" });
	});

	it("raw with no endraw runs to EOF (total)", () => {
		const text = "{% raw %}{{ x }} and more";
		const { segments } = segment(text);
		expect(segments.map((s) => (s.kind === "tag" ? s.tagKind : "sql"))).toEqual(["stmt", "sql"]);
		expect(segments[1]).toMatchObject({ kind: "sql", start: 9, end: text.length });
	});

	it("segments a {# comment #}", () => {
		const text = "{# c #}";
		const { segments } = segment(text);
		expect(segments).toHaveLength(1);
		expect(segments[0]).toMatchObject({ kind: "tag", tagKind: "comment", text });
	});

	it("recognizes the four whitespace-control dash variants", () => {
		for (const [text, tagKind] of [
			["{{- ref('x') -}}", "expr"],
			["{%- set x = 1 -%}", "stmt"],
			["{#- c -#}", "comment"],
		] as const) {
			const { segments } = segment(text);
			expect(segments).toHaveLength(1);
			expect(segments[0]).toMatchObject({ kind: "tag", tagKind, text });
		}
	});

	it("is total on an unterminated tag — one tag to EOF, never throws", () => {
		const text = "SELECT {{ ref(";
		const { segments } = segment(text);
		expect(segments.map((s) => (s.kind === "tag" ? s.tagKind : "sql"))).toEqual(["sql", "expr"]);
		expect(segments[1]).toMatchObject({ kind: "tag", start: 7, end: text.length });
	});
});

describe("jinja segmenter — placeholder fill (no-output-aware default)", () => {
	it("fills an ordinary expr tag with the `j` identifier token", () => {
		const text = "{{ref('x')}}";
		const { placeholder } = segment(text);
		expect(placeholder).toBe("jjjjjjjjjjjj");
	});

	it("fills a config() expr tag with SPACES, not `j` (no-output builtin)", () => {
		// The critical case: an identifier at statement position is a syntax
		// error; config-topped models are the majority. Placeholder must parse.
		const text = "{{ config(materialized='table') }}\nSELECT 1";
		const r = segment(text);
		const configTag = r.segments.find((s) => s.kind === "tag")!;
		const fill = fillOf(r.placeholder, configTag);
		expect(fill).toBe(" ".repeat(configTag.end - configTag.start));
		expect(fill).not.toContain("j");
		// The whole placeholder is valid `<spaces>\nSELECT 1`.
		expect(r.placeholder).toBe(" ".repeat(34) + "\nSELECT 1");
	});

	it("fills every NO_OUTPUT_BUILTINS-topped expr tag with spaces", () => {
		for (const name of NO_OUTPUT_BUILTINS) {
			const text = `{{ ${name}('a') }}`;
			const { placeholder } = segment(text);
			expect(placeholder).toBe(" ".repeat(text.length));
		}
	});

	it("treats a dotted no-output namespace (exceptions.foo) as no-output", () => {
		const text = "{{ exceptions.raise_compiler_error('x') }}";
		const { placeholder } = segment(text);
		expect(placeholder).toBe(" ".repeat(text.length));
	});

	it("fills var()/ref() (value-producing) with `j`, not spaces", () => {
		const text = "{{ var('c') }}";
		const { placeholder } = segment(text);
		expect(placeholder).toBe("j".repeat(text.length));
	});

	it("fills stmt and comment tags with spaces", () => {
		const stmt = segment("{% set x = 1 %}");
		expect(stmt.placeholder).toBe(" ".repeat("{% set x = 1 %}".length));
		const comment = segment("{# c #}");
		expect(comment.placeholder).toBe(" ".repeat("{# c #}".length));
	});
});

describe("jinja segmenter — length + newline preservation (property)", () => {
	const cases = [
		"SELECT {{ ref('x') }} FROM t",
		"{{ config(materialized='table') }}\nSELECT 1",
		`WHERE n = '{{ var("a}}b") }}'`,
		"{% raw %}{{ x }}{% endraw %}",
		"{% raw %}{{ x }} and more",
		"{# c #}",
		"SELECT {{ ref(",
		"{{\n ref('x')\n}}",
		"{{-\n config(x=1)\n-}}\nSELECT 1",
		"line1\n{% set y = 2 %}\nline3\n{{ var('z') }}\n",
		"plain sql, no tags at all\nSELECT 2",
		"",
		"{{ dbt_utils.star(from=ref('t')) }}",
		"a{{x}}b{%y%}c{#z#}d",
	];

	it("keeps placeholder length === source length over every case", () => {
		for (const text of cases) {
			const { placeholder } = segment(text);
			expect(placeholder.length).toBe(text.length);
		}
	});

	it("keeps newline offsets identical over every case", () => {
		for (const text of cases) {
			const { placeholder } = segment(text);
			expect(newlineOffsets(placeholder)).toEqual(newlineOffsets(text));
		}
	});

	it("tiles the source (contiguous, covers [0,len)) over every case", () => {
		for (const text of cases) assertLengthAndNewlines(text);
	});

	it("preserves newlines inside a multi-line expr tag at their original offsets", () => {
		const text = "{{\n ref('x')\n}}";
		const { placeholder } = segment(text);
		expect(newlineOffsets(placeholder)).toEqual([2, 12]);
		// Non-newline chars of a value tag become `j`; newlines stay.
		expect(placeholder).toBe(text.replace(/[^\n]/g, "j"));
	});

	it("preserves newlines inside a multi-line no-output tag as spaces", () => {
		const text = "{{-\n config(x=1)\n-}}";
		const { placeholder } = segment(text);
		expect(newlineOffsets(placeholder)).toEqual([3, 16]);
		expect(placeholder).toBe(text.replace(/[^\n]/g, " "));
	});
});
