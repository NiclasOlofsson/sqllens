import { describe, expect, it } from "vitest";
import { segment, NO_OUTPUT_BUILTINS, type Segment } from "../src/minijinja/segment.js";
import { DbtTemplateProvider } from "../src/index.js";

// The segmenter picks placeholder fills from the provider's shape knowledge. These tests exercise the
// dbt-aware fills (config -> whitespace, ref -> a relation body), so the provider is a dbt one; the
// neutral DefaultTemplateProvider knows none of that (pinned in minijinja.dbt-provider.test.ts).
const DP = new DbtTemplateProvider();

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
	const r = segment(text, DP);
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
		const { segments } = segment(text, DP);
		expect(segments.map((s) => (s.kind === "tag" ? s.tagKind : "sql"))).toEqual(["sql", "expr", "sql"]);
		const tag = segments[1];
		expect(tag).toMatchObject({ kind: "tag", tagKind: "expr", text: "{{ ref('x') }}" });
	});

	it("treats a `}}` inside the tag's string as literal, not a close", () => {
		const text = `WHERE n = '{{ var("a}}b") }}'`;
		const { segments } = segment(text, DP);
		const tags = segments.filter((s) => s.kind === "tag");
		expect(tags).toHaveLength(1);
		expect(tags[0]).toMatchObject({ tagKind: "expr", text: `{{ var("a}}b") }}` });
	});

	it("segments a single-quoted `}}` inside the tag string as literal too", () => {
		const text = "{{ ref('a}}b') }}";
		const { segments } = segment(text, DP);
		expect(segments).toHaveLength(1);
		expect(segments[0]).toMatchObject({ kind: "tag", tagKind: "expr", text });
	});

	it("emits {% raw %} / {% endraw %} as tags and the middle as ONE literal sql", () => {
		const text = "{% raw %}{{ x }}{% endraw %}";
		const { segments } = segment(text, DP);
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
		const { segments } = segment(text, DP);
		expect(segments.map((s) => (s.kind === "tag" ? s.tagKind : "sql"))).toEqual(["stmt", "sql"]);
		expect(segments[1]).toMatchObject({ kind: "sql", start: 9, end: text.length });
	});

	it("segments a {# comment #}", () => {
		const text = "{# c #}";
		const { segments } = segment(text, DP);
		expect(segments).toHaveLength(1);
		expect(segments[0]).toMatchObject({ kind: "tag", tagKind: "comment", text });
	});

	it("recognizes the four whitespace-control dash variants", () => {
		for (const [text, tagKind] of [
			["{{- ref('x') -}}", "expr"],
			["{%- set x = 1 -%}", "stmt"],
			["{#- c -#}", "comment"],
		] as const) {
			const { segments } = segment(text, DP);
			expect(segments).toHaveLength(1);
			expect(segments[0]).toMatchObject({ kind: "tag", tagKind, text });
		}
	});

	it("is total on an unterminated tag — one tag to EOF, never throws", () => {
		const text = "SELECT {{ ref(";
		const { segments } = segment(text, DP);
		expect(segments.map((s) => (s.kind === "tag" ? s.tagKind : "sql"))).toEqual(["sql", "expr"]);
		expect(segments[1]).toMatchObject({ kind: "tag", start: 7, end: text.length });
	});

	// ---------------------------------------------------------------------------------------------
	// Broken-input tolerance deliberately IMPROVED by the ANTLR-lexer unification (docs/minijinja-
	// front-end.md / the segment-golden gate's header comment excludes these two classes on purpose).
	// Neither case was previously pinned by a test — these are NEW expectations, not changed ones.
	// ---------------------------------------------------------------------------------------------

	it("closes at the first real `}}` when a tag's string is unterminated (was: ran to EOF)", () => {
		// Old hand-rolled scanner treated the whole rest of the document as one unterminated string
		// inside the tag, so the tag ran to EOF. The ANTLR lexer's STRING rule can't match the
		// unterminated `'x)`, so it degrades to individual char tokens (MINIJINJA_ANY) and the first
		// real `}}` closes the tag — a strictly smaller, more useful blast radius on broken input.
		const text = "select {{ ref('x) }} from t";
		const { segments } = segment(text, DP);
		expect(segments.map((s) => (s.kind === "tag" ? s.tagKind : "sql"))).toEqual(["sql", "expr", "sql"]);
		const tag = segments[1];
		expect(tag).toMatchObject({ kind: "tag", tagKind: "expr", text: "{{ ref('x) }}" });
		const tail = segments[2];
		expect(text.slice(tail.start, tail.end)).toBe(" from t");
	});

	it("a raw block closes at the FIRST `{% endraw %}` even where it sits inside what looks like a string (oracle-true to minijinja)", () => {
		// minijinja raw blocks are literal — https://docs.rs/minijinja/latest/minijinja/syntax/index.html
		// ("the contents ... are not interpreted as Jinja code") and end at the first `{% endraw %}`,
		// full stop; there is no string-nesting exception. The old hand-rolled scanner used the STMT-tag
		// string-skipping rule even INSIDE a raw block, so a `{% endraw %}` written inside a quoted
		// string was skipped as literal and the block ran past it. The ANTLR RawBody mode has no notion
		// of SQL/jinja strings at all — it is honest to the oracle and stops at the first literal match.
		const text = "{% raw %}{% if '{% endraw %}' %} tail";
		const { segments } = segment(text, DP);
		expect(segments.map((s) => (s.kind === "tag" ? s.tagKind : "sql"))).toEqual(["stmt", "sql", "stmt", "sql"]);
		expect(segments[0]).toMatchObject({ text: "{% raw %}" });
		const body = segments[1];
		expect(text.slice(body.start, body.end)).toBe("{% if '");
		const endraw = segments[2];
		expect(endraw).toMatchObject({ tagKind: "stmt", text: "{% endraw %}" });
		const tail = segments[3];
		expect(text.slice(tail.start, tail.end)).toBe("' %} tail");
	});

	it("a MISMATCHED closer ends the tag (`{{ a %}` closes at the `%}`) instead of swallowing the document", () => {
		// Expr and stmt tags share the lexer's interior mode, where EITHER close token pops back to
		// DEFAULT — after `%}` pops, the "right" `}}` can never be lexed as a close, so waiting for it
		// would run the tag to EOF and swallow everything after. Ending at the first closer of either
		// kind keeps the breakage localized to the one broken tag (segment.ts CLOSES_FOR_OPEN).
		const text = "select {{ a %} b }} from t";
		const { segments } = segment(text, DP);
		expect(segments.map((s) => (s.kind === "tag" ? s.tagKind : "sql"))).toEqual(["sql", "expr", "sql"]);
		expect(segments[1]).toMatchObject({ kind: "tag", tagKind: "expr", text: "{{ a %}" });
		const tail = segments[2];
		expect(text.slice(tail.start, tail.end)).toBe(" b }} from t");
	});

	// The raw-block delimiters are EXACT full-tag lexer rules (RAW_TAG / ENDRAW_TAG), so near-miss
	// forms fail the rule and degrade sanely — no keyword-detection lexer state to fool (minijinja:
	// raw/endraw take no arguments; a malformed delimiter is not a delimiter).

	it("`{% raw x %}` does NOT open a raw block — it reads as an ordinary stmt tag", () => {
		const text = "{% raw x %} {{ ref('m') }} {% endraw %}";
		const { segments } = segment(text, DP);
		// The {{ ref }} inside is a REAL tag (no raw block opened); the trailing endraw, with no raw
		// block to close, lexes via the ordinary STMT_OPEN path and stays a stmt tag.
		const kinds = segments.filter((s) => s.kind === "tag").map((s) => (s.kind === "tag" ? s.tagKind : ""));
		expect(kinds).toEqual(["stmt", "expr", "stmt"]);
	});

	it("`{% endraw x %}` and an unterminated `{% endraw` inside raw stay literal — only an exact endraw closes", () => {
		const text = "{% raw %} {% endraw x %} still literal";
		const { segments } = segment(text, DP);
		const tags = segments.filter((s) => s.kind === "tag");
		expect(tags).toHaveLength(1); // just the {% raw %} opener; everything after is literal to EOF
		expect(tags[0]).toMatchObject({ tagKind: "stmt", text: "{% raw %}" });
		const body = segments.at(-1);
		expect(body?.kind).toBe("sql");
	});
});

describe("jinja segmenter — placeholder fill (no-output-aware default)", () => {
	it("fills an ordinary expr tag with the `j` identifier token (value slot)", () => {
		const text = "select {{ x }} from t";
		const { placeholder } = segment(text, DP);
		// Ordinal-headed fill since the uniqueness change (2026-07-06).
		expect(placeholder).toBe("select j0jjjjj from t");
	});

	it("a lone ref at document start fills SELECT 1 (the default provider knows ref is a relation)", () => {
		const text = "{{ref('x')}}";
		const { placeholder } = segment(text, DP);
		expect(placeholder).toBe("SELECT 1    ");
	});

	it("fills a config() expr tag with SPACES, not `j` (no-output builtin)", () => {
		// The critical case: an identifier at statement position is a syntax
		// error; config-topped models are the majority. Placeholder must parse.
		const text = "{{ config(materialized='table') }}\nSELECT 1";
		const r = segment(text, DP);
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
			const { placeholder } = segment(text, DP);
			expect(placeholder).toBe(" ".repeat(text.length));
		}
	});

	it("treats a dotted no-output namespace (exceptions.foo) as no-output", () => {
		const text = "{{ exceptions.raise_compiler_error('x') }}";
		const { placeholder } = segment(text, DP);
		expect(placeholder).toBe(" ".repeat(text.length));
	});

	it("fills var()/ref() (value-producing) with `j` in value/relation slots", () => {
		const varCase = segment("select {{ var('c') }} from t", DP);
		// Ordinal-headed fills since the uniqueness change (2026-07-06).
		expect(varCase.placeholder).toBe("select j0jjjjjjjjjjjj from t");
		const refCase = segment("select * from {{ ref('x') }}", DP);
		expect(refCase.placeholder).toBe("select * from j0jjjjjjjjjjjj");
	});

	it("a shapeless CALL alone at a statement slot blanks (a lone identifier is never a statement)", () => {
		const { placeholder } = segment("{{ var('c') }}", DP);
		expect(placeholder).toBe(" ".repeat("{{ var('c') }}".length));
	});

	it("fills stmt and comment tags with spaces", () => {
		const stmt = segment("{% set x = 1 %}", DP);
		expect(stmt.placeholder).toBe(" ".repeat("{% set x = 1 %}".length));
		const comment = segment("{# c #}", DP);
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
			const { placeholder } = segment(text, DP);
			expect(placeholder.length).toBe(text.length);
		}
	});

	it("keeps newline offsets identical over every case", () => {
		for (const text of cases) {
			const { placeholder } = segment(text, DP);
			expect(newlineOffsets(placeholder)).toEqual(newlineOffsets(text));
		}
	});

	it("tiles the source (contiguous, covers [0,len)) over every case", () => {
		for (const text of cases) assertLengthAndNewlines(text);
	});

	it("preserves newlines inside a multi-line expr tag at their original offsets", () => {
		const text = "{{\n ref('x')\n}}";
		const { placeholder } = segment(text, DP);
		expect(newlineOffsets(placeholder)).toEqual([2, 12]);
		// RE-PINNED for the multi-line fit window (F5 finding 4, 2026-07-06): the default
		// provider derives shape "relation" for ref, and the fragment now places in the tag's
		// first newline-free window that FITS it (line 2 — `{{` on line 1 is too short), the
		// rest whitespace. Before the fix the fragment was rejected outright on any multi-line
		// tag (fit-before-first-`\n` guard) and the identifier fill landed first-line-only
		// (`jj\n         \n  `). `\n`s stay at their offsets, length is unchanged.
		expect(placeholder).toBe("  \nSELECT 1 \n  ");
	});

	it("keeps the first-line-only identifier fill when the tag has no shape answer", () => {
		// An UNSHAPED call (no provider answer) on a multi-line tag: the positional identifier
		// fill still lands on the tag's FIRST line only; continuation lines fill with spaces so
		// the SQL lexer sees ONE identifier, not one `j`-run per line.
		const text = "select {{\n my_helper('x')\n}} as c from t";
		const { placeholder } = segment(text, DP);
		expect(newlineOffsets(placeholder)).toEqual(newlineOffsets(text));
		expect(placeholder.slice(7, 9)).toBe("j0"); // ordinal head (fill uniqueness, 2026-07-06)
	});

	it("preserves newlines inside a multi-line no-output tag as spaces", () => {
		const text = "{{-\n config(x=1)\n-}}";
		const { placeholder } = segment(text, DP);
		expect(newlineOffsets(placeholder)).toEqual([3, 16]);
		expect(placeholder).toBe(text.replace(/[^\n]/g, " "));
	});
});
