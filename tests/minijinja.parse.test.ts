import { describe, expect, it } from "vitest";
import { parseTemplated, tokenizeTemplated } from "../src/minijinja/parse.js";
import type { Dialect } from "../src/api.js";
import type { Token } from "../src/token/token.js";

// ---------------------------------------------------------------------------
// Task 3 — the unified SQL+jinja token stream (docs/minijinja-front-end.md §R1).
// Proves: the jinja tokens land on channel 2 / role "minijinja" in document coords,
// the placeholder's filler tokens inside a tag are dropped, the merged stream
// tiles the source, the SQL parse over the placeholder is valid, and the whole
// thing is total on broken input — across THREE dialects (dialect-agnostic).
// ---------------------------------------------------------------------------

/** The merged stream must tile the source: contiguous, no gaps, no overlaps. */
function assertTiles(tokens: Token[], text: string): void {
	// Sorted by start already; verify each token abuts the previous one and the
	// whole [0, len) is covered.
	expect(tokens.length).toBeGreaterThan(0);
	expect(tokens[0].start).toBe(0);
	for (let i = 1; i < tokens.length; i++) {
		expect(tokens[i].start).toBe(tokens[i - 1].stop + 1);
	}
	expect(tokens[tokens.length - 1].stop).toBe(text.length - 1);
}

const REF_CASE = "SELECT {{ ref('x') }} FROM t";
const DIALECTS: Dialect[] = ["databricks", "snowflake", "postgres"];

describe("parseTemplated — unified token stream", () => {
	for (const dialect of DIALECTS) {
		describe(dialect, () => {
			it("merges SQL (channel 0) + jinja (channel 2) into one tiling stream", () => {
				const { tokens, sql } = parseTemplated(REF_CASE, dialect);

				// The SQL side parses cleanly over the placeholder — a valid select.
				expect(sql.errors).toBe(0);
				expect(sql.ast.kind).toBe("query");

				// SELECT keyword is an SQL token on channel 0.
				const select = tokens.find((t) => t.text.toUpperCase() === "SELECT");
				expect(select).toBeDefined();
				expect(select?.channel).toBe(0);
				expect(select?.role).toBe("keyword");

				// The jinja tokens are on channel 2 with role "minijinja", in document
				// coordinates — {{ ref ( 'x' ) }} all present.
				const jinja = tokens.filter((t) => t.channel === 2);
				expect(jinja.every((t) => t.role === "minijinja")).toBe(true);
				const jinjaTexts = jinja.map((t) => t.text);
				expect(jinjaTexts).toContain("{{");
				expect(jinjaTexts).toContain("ref");
				expect(jinjaTexts).toContain("(");
				expect(jinjaTexts).toContain("'x'");
				expect(jinjaTexts).toContain(")");
				expect(jinjaTexts).toContain("}}");

				// The `ref` jinja token sits at its real document offset (10..12 in
				// "SELECT {{ ref(...").
				const ref = jinja.find((t) => t.text === "ref");
				expect(ref?.start).toBe(REF_CASE.indexOf("ref"));

				// The placeholder's `jjj...` filler tokens INSIDE the tag are gone.
				expect(tokens.some((t) => /^j+$/.test(t.text))).toBe(false);
				// FROM / t are SQL tokens after the tag.
				expect(tokens.some((t) => t.text.toUpperCase() === "FROM" && t.channel === 0)).toBe(true);

				assertTiles(tokens, REF_CASE);
			});

			it("tokenizeTemplated returns the same tiling stream", () => {
				const tokens = tokenizeTemplated(REF_CASE, dialect);
				assertTiles(tokens, REF_CASE);
				expect(tokens.some((t) => t.channel === 2 && t.role === "minijinja")).toBe(true);
			});
		});
	}

	it("is dialect-agnostic — every dialect yields the same jinja token texts", () => {
		const perDialect = DIALECTS.map((d) =>
			tokenizeTemplated(REF_CASE, d)
				.filter((t) => t.channel === 2)
				.map((t) => `${t.name}:${t.text}:${t.start}-${t.stop}`),
		);
		// The jinja channel is produced by the SAME island lexer regardless of the
		// SQL dialect, so the jinja token slice is byte-identical across dialects.
		for (let i = 1; i < perDialect.length; i++) {
			expect(perDialect[i]).toEqual(perDialect[0]);
		}
	});

	it("handles a no-output config tag — placeholder is whitespace, SQL parses SELECT 1", () => {
		const text = "{{ config(materialized='table') }}\nSELECT 1";
		const { tokens, sql } = parseTemplated(text, "databricks");

		// config is a NO_OUTPUT builtin → whitespace placeholder → the SQL is a
		// clean `SELECT 1` (the config tag contributes no SQL text).
		expect(sql.errors).toBe(0);
		expect(sql.ast.kind).toBe("query");

		// The config jinja tokens are present on channel 2.
		const jinja = tokens.filter((t) => t.channel === 2);
		expect(jinja.map((t) => t.text)).toContain("config");
		expect(jinja.every((t) => t.role === "minijinja")).toBe(true);

		// SELECT 1 survives as SQL tokens on channel 0.
		expect(tokens.some((t) => t.text.toUpperCase() === "SELECT" && t.channel === 0)).toBe(true);
		expect(tokens.some((t) => t.text === "1" && t.channel === 0)).toBe(true);

		assertTiles(tokens, text);
	});

	it("carries a correct multi-line span for a tag spanning newlines", () => {
		const text = "SELECT {{ ref(\n  'x') }} FROM t";
		const { tokens } = parseTemplated(text, "databricks");
		const close = tokens.find((t) => t.text === "}}");
		expect(close).toBeDefined();
		// The close `}}` is on the SECOND line (line 2, 1-based) — the tag anchor
		// composes with the token's own line, so multi-line spans are correct.
		expect(close?.line).toBe(2);
		assertTiles(tokens, text);
	});

	it('raw-block delimiter tags are ONE channel-2 token each with role "minijinja" (RAW_TAG / ENDRAW_TAG carry the whole tag — no keyword-detection lexer state)', () => {
		const text = "{% raw %}body{% endraw %} tail";
		const { tokens } = parseTemplated(text, "databricks");

		const rawTag = tokens.filter((t) => t.start >= 0 && t.stop < "{% raw %}".length && t.channel === 2);
		expect(rawTag).toHaveLength(1);
		expect(rawTag[0]).toMatchObject({ text: "{% raw %}", role: "minijinja", start: 0 });

		const endrawStart = text.indexOf("{% endraw %}");
		const endrawEnd = endrawStart + "{% endraw %}".length;
		const endrawTag = tokens.filter((t) => t.start >= endrawStart && t.start < endrawEnd);
		expect(endrawTag).toHaveLength(1);
		expect(endrawTag[0]).toMatchObject({ text: "{% endraw %}", role: "minijinja", start: endrawStart });
		expect(endrawTag[0].stop).toBe(endrawEnd - 1);
	});

	describe("totality (R5) — never throws on broken input", () => {
		for (const dialect of DIALECTS) {
			it(`${dialect}: a half-typed {{ ref( returns`, () => {
				expect(() => parseTemplated("SELECT {{ ref(", dialect)).not.toThrow();
				const { tokens } = parseTemplated("SELECT {{ ref(", dialect);
				expect(tokens.length).toBeGreaterThan(0);
			});
		}

		it("empty input returns", () => {
			expect(() => parseTemplated("", "databricks")).not.toThrow();
			expect(tokenizeTemplated("", "databricks")).toEqual([]);
		});
	});
});

// ---------------------------------------------------------------------------
// `TemplatedParseResult.placeholder` — the placeholder-filled SQL text the SQL
// parser actually saw (anvil work order 2026-07-05: re-founds their legacy
// engine's jinja pre-processing on our fill; also "what did the parser see"
// debugging). Contract: identical length, newlines at identical offsets, text
// outside tags byte-identical, no jinja delimiter survives.
// ---------------------------------------------------------------------------
describe("TemplatedParseResult.placeholder — the SQL parser's actual input", () => {
	it("length-/newline-preserving, byte-identical outside tags, no jinja delimiters", () => {
		const text =
			"select a,\n  {{ ref('stg_orders') }}.b\nfrom {{ source('raw', 'orders') }}\n{% if x %}where a > 1{% endif %}";
		const result = parseTemplated(text, "databricks");
		const p = result.placeholder;

		expect(p.length).toBe(text.length);
		for (let i = 0; i < text.length; i++) {
			if (text[i] === "\n") expect(p[i]).toBe("\n");
		}
		expect(p).not.toContain("{{");
		expect(p).not.toContain("{%");

		// Everything outside the tag segments is byte-identical: check a few anchors.
		expect(p.startsWith("select a,")).toBe(true);
		expect(p).toContain("where a > 1");
		expect(p.indexOf("from ")).toBe(text.indexOf("from "));
	});

	it("plain SQL (no jinja): placeholder IS the input", () => {
		const text = "select 1 from t";
		expect(parseTemplated(text, "databricks").placeholder).toBe(text);
	});
});

// ---------------------------------------------------------------------------
// Diagnostic hygiene (2026-07-05) — a syntax diagnostic whose offending token is
// a placeholder fill quotes the ORIGINAL tag text and spans the whole tag.
// ---------------------------------------------------------------------------
describe("placeholder-scrubbed diagnostics", () => {
	it("message quotes the tag text, never the jjj fill; span widens to the tag", () => {
		// A bare non-call tag at BOF keeps the identifier fill (the blank default is
		// calls-only), so the parse errors ON the fill — the scrub must rewrite it.
		const text = "{{ my_var }}\nselect 1 from t";
		const r = parseTemplated(text, "databricks");
		expect(r.sql.errors).toBeGreaterThan(0);
		const d = r.diagnostics.find((x) => x.offset === 0);
		expect(d).toBeDefined();
		expect(d!.message).toContain("{{ my_var }}");
		expect(d!.message).not.toMatch(/j{3,}/);
		expect(d!.length).toBe("{{ my_var }}".length);
	});

	it("diagnostics outside tags pass through untouched", () => {
		const text = "select 1 from {{ ref('t') }} where where";
		const r = parseTemplated(text, "databricks");
		const outside = r.diagnostics.filter((d) => (d.offset ?? 0) > text.indexOf("}}"));
		for (const d of outside) expect(d.message).not.toContain("{{");
	});
});

describe("degraded marker", () => {
	it("absent on every normal parse — plain SQL, templated, and broken jinja", () => {
		for (const text of ["select 1", "select * from {{ ref('x') }}", "select {{ ref(", "{%", ""]) {
			expect(parseTemplated(text, "databricks").degraded).toBeUndefined();
		}
	});
});
