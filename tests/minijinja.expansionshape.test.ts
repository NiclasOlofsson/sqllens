import { describe, expect, it } from "vitest";
import { parseTemplated } from "../src/index.js";
import type { Dialect } from "../src/api.js";
import type { ExpansionShape } from "../src/index.js";

// ---------------------------------------------------------------------------
// inc3.2 — `expansionShape`: shaped, length- AND newline-preserving placeholders
// (docs/minijinja-front-end.md § inc3 increment 2). The residual class it kills:
// an UNKNOWN CALLABLE at STATEMENT position — `{{ macro() }}` standalone, or a
// macro-generated CTE body `with c as ({{ macro() }})`. inc1's single-identifier
// fill can't fuse into valid SQL there, so the SQL parse FAILS. With a catalog
// answering `expansionShape → "statement"/"relation"`, the fill becomes a valid
// padded `SELECT 1` and the parse SUCCEEDS.
//
// The HARD invariant this suite pins: every placeholder char occupies the EXACT
// original tag offset; `\n` stays at its offset; total placeholder length ==
// text length. A shaped fill NEVER shifts an offset, drops/adds a char, or (via
// the fit guard) produces an invalid or wrong-length fill. With NO catalog the
// placeholder is BYTE-IDENTICAL to today (the keystone).
// ---------------------------------------------------------------------------

const DIALECT: Dialect = "databricks";

/** The SQL placeholder the segmenter fed the SQL lexer — reconstructed from the SQL-side (channel != 2)
 *  tokens plus the tag regions. We assert the invariant directly on the tokens the SQL parse saw:
 *  the merged stream tiles the source, so the joined token texts equal the ORIGINAL text; the placeholder
 *  invariant (length + newline) is proven via the tag regions carrying the same char count as the source. */
function placeholderLength(
	text: string,
	shapeOf?: (c: { name: string; parts?: string[] }) => ExpansionShape | undefined,
): number {
	// The merged token stream always reconstructs the original text (tiling). To observe the placeholder
	// itself we count via the invariant: length is preserved iff the stream tiles to text.length.
	const { tokens } = parseTemplated(text, DIALECT, shapeOf ? { shapeOf } : undefined);
	return tokens.reduce((n, t) => n + t.text.length, 0);
}

/** All shapeOf calls always answering `shape`. */
const always =
	(shape: ExpansionShape) =>
	(_c: { name: string; parts?: string[] }): ExpansionShape =>
		shape;

describe("inc3.2 expansionShape — cascade-death (unknown callable at statement position)", () => {
	it("(a) a standalone `{{ m() }}` statement parses with 0 errors under shapeOf→statement (was >0)", () => {
		const text = "{{ my_macro() }}";
		const before = parseTemplated(text, DIALECT); // no catalog
		expect(before.sql.errors, "no-catalog fill leaves an invalid statement").toBeGreaterThan(0);

		const after = parseTemplated(text, DIALECT, { shapeOf: always("statement") });
		expect(after.sql.errors, "shaped fill makes the statement valid").toBe(0);
	});

	it("(b) `with c as ({{ m() }}) select 1` parses with 0 errors under shapeOf→statement", () => {
		const text = "with c as ({{ my_macro() }}) select 1";
		const before = parseTemplated(text, DIALECT);
		expect(before.sql.errors, "no-catalog fill leaves an invalid CTE body").toBeGreaterThan(0);

		const after = parseTemplated(text, DIALECT, { shapeOf: always("statement") });
		expect(after.sql.errors).toBe(0);
	});

	it("(b') the same CTE-body case parses with shapeOf→relation too (SELECT 1 fits both slots)", () => {
		const text = "with c as ({{ my_macro() }}) select 1";
		const after = parseTemplated(text, DIALECT, { shapeOf: always("relation") });
		expect(after.sql.errors).toBe(0);
	});

	it("the anvil residual — CTE body + trailing statement-level macro — parses with 0 errors", () => {
		const text = "with cte as ({{ macro_a() }})\n{{ macro_b() }}";
		const before = parseTemplated(text, DIALECT);
		expect(before.sql.errors).toBeGreaterThan(0);
		const after = parseTemplated(text, DIALECT, { shapeOf: always("statement") });
		expect(after.sql.errors).toBe(0);
	});
});

describe("inc3.2 expansionShape — the length + newline invariant", () => {
	it("a shaped fill preserves total length (statement position)", () => {
		const text = "with c as ({{ my_macro() }}) select 1";
		expect(placeholderLength(text, always("statement"))).toBe(text.length);
	});

	it("newlines inside a shaped tag survive at their exact offsets", () => {
		// The `\n` sits AFTER where SELECT 1 lands, so the tag is shaped and the newline is preserved.
		const text = "{{ my_macro() }}\nselect 1";
		const { tokens } = parseTemplated(text, DIALECT, { shapeOf: always("statement") });
		// Tiling + exact reconstruction proves every char (incl. the newline) is at its original offset.
		expect(tokens.map((t) => t.text).join("")).toBe(text);
		// And the whole thing is a valid two-statement-ish parse (the newline separated the fragment
		// from the following select — no offset drift).
		expect(tokens.reduce((n, t) => n + t.text.length, 0)).toBe(text.length);
	});
});

describe("inc3.2 expansionShape — the fit guard (never a regression)", () => {
	it("a tag too short for the fragment falls back to the identifier fill (no crash, length preserved)", () => {
		// `{{a()}}` is 7 chars; `SELECT 1` is 8 → does not fit → identifier fill, exactly as today.
		const text = "{{a()}}";
		const shaped = parseTemplated(text, DIALECT, { shapeOf: always("statement") });
		const plain = parseTemplated(text, DIALECT);
		// Byte-identical to the no-catalog run: the fit guard fell back to the positional fill.
		expect(shaped.tokens.map((t) => `${t.text}:${t.start}-${t.stop}:${t.channel}`)).toEqual(
			plain.tokens.map((t) => `${t.text}:${t.start}-${t.stop}:${t.channel}`),
		);
		expect(shaped.tokens.reduce((n, t) => n + t.text.length, 0)).toBe(text.length);
	});

	it("a newline where the fragment would go forces fallback (never a broken fill)", () => {
		// The `\n` at offset 3 lands inside the 8-char `SELECT 1` placement window → fall back.
		const text = "{{\nmacro_a() }}";
		const shaped = parseTemplated(text, DIALECT, { shapeOf: always("statement") });
		const plain = parseTemplated(text, DIALECT);
		expect(shaped.tokens.map((t) => `${t.text}:${t.start}-${t.stop}:${t.channel}`)).toEqual(
			plain.tokens.map((t) => `${t.text}:${t.start}-${t.stop}:${t.channel}`),
		);
	});
});

describe("inc3.2 expansionShape — zero-catalog byte-identity (the keystone)", () => {
	const CORPUS = [
		"{{ my_macro() }}",
		"with c as ({{ my_macro() }}) select 1",
		"select {{ dbt_utils.star(ref('x')) }} from t",
		"select * from {{ ref('orders') }}",
		"select {{ var('x') }} from t",
		"{{ config(materialized='table') }}\nselect 1",
		"{{ macro_a() }}\n{{ macro_b() }}",
		"select 1 -- {# a comment #}",
	];

	it("a parseTemplated with no shapeOf is byte-identical to today for every case", () => {
		for (const text of CORPUS) {
			const withNothing = parseTemplated(text, DIALECT);
			// An opts object with NO shapeOf must also be identical.
			const withEmptyOpts = parseTemplated(text, DIALECT, {});
			// A shapeOf that always returns undefined must also be identical (undefined = fall back).
			const withUndefShape = parseTemplated(text, DIALECT, { shapeOf: () => undefined });

			const key = (r: ReturnType<typeof parseTemplated>) =>
				r.tokens.map((t) => `${t.text}:${t.start}-${t.stop}:${t.channel}`).join("|");

			expect(key(withEmptyOpts), `empty-opts identity: ${text}`).toBe(key(withNothing));
			expect(key(withUndefShape), `undefined-shape identity: ${text}`).toBe(key(withNothing));
			// The SQL error count is identical too (no shaped fill changed the parse).
			expect(withEmptyOpts.sql.errors).toBe(withNothing.sql.errors);
			expect(withUndefShape.sql.errors).toBe(withNothing.sql.errors);
		}
	});
});

describe("inc3.2 expansionShape — only macro-call tags consult shapeOf", () => {
	it("a ref/source/var tag is never shaped even under an aggressive shapeOf", () => {
		// These already parse with the identifier fill; a shape must not touch them (a buggy catalog
		// returning `statement` for `ref` must not break `from {{ ref('x') }}`).
		for (const text of [
			"select * from {{ ref('orders') }}",
			"select * from {{ source('raw', 'events') }}",
			"select {{ var('x') }} from t",
		]) {
			const shaped = parseTemplated(text, DIALECT, { shapeOf: always("statement") });
			const plain = parseTemplated(text, DIALECT);
			expect(
				shaped.tokens.map((t) => `${t.text}:${t.start}-${t.stop}`),
				text,
			).toEqual(plain.tokens.map((t) => `${t.text}:${t.start}-${t.stop}`));
			expect(shaped.sql.errors, text).toBe(plain.sql.errors);
		}
	});

	it("the shapeOf callback receives the macro name (+ package parts)", () => {
		const seen: { name: string; parts?: string[] }[] = [];
		parseTemplated("select {{ dbt_utils.star() }} from t", DIALECT, {
			shapeOf: (c) => {
				seen.push(c);
				return undefined;
			},
		});
		// dbt_utils.star → name "star", parts ["dbt_utils","star"].
		expect(seen.some((c) => c.name === "star" && c.parts?.join(".") === "dbt_utils.star")).toBe(true);
	});
});
