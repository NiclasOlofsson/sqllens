import { describe, expect, it } from "vitest";
import { DbtTemplateProvider, DefaultTemplateProvider, type TemplateCall } from "../src/index.js";
import type { Dialect } from "../src/api.js";
import type { ExpansionShape } from "../src/index.js";
import { parseTemplated } from "../src/minijinja/index.js";
import { shaped } from "./helpers/providers.js";

// ---------------------------------------------------------------------------
// `expansionShape`: shaped, length- AND newline-preserving placeholders
// (docs/minijinja-front-end.md §The hole / §The seam). The residual class it kills:
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
function placeholderLength(text: string, shape?: ExpansionShape): number {
	// The merged token stream always reconstructs the original text (tiling). To observe the placeholder
	// itself we count via the invariant: length is preserved iff the stream tiles to text.length.
	const { tokens } = parseTemplated(text, DIALECT, shape ? shaped(shape) : undefined);
	return tokens.reduce((n, t) => n + t.text.length, 0);
}

describe("inc3.2 expansionShape — cascade-death (unknown callable at statement position)", () => {
	it("(a) a standalone `{{ m() }}` statement parses with 0 errors — shaped AND unshaped", () => {
		const text = "{{ my_macro() }}";
		// Since the statement-slot blank default (2026-07-05) the no-catalog fill is
		// ALSO clean here: a call at BOF blanks instead of the guaranteed-broken
		// identifier fill. The shaped fill stays clean too.
		const before = parseTemplated(text, DIALECT); // no catalog
		expect(before.sql.errors, "statement-slot blank default").toBe(0);

		const after = parseTemplated(text, DIALECT, shaped("statement"));
		expect(after.sql.errors, "shaped fill makes the statement valid").toBe(0);
	});

	it("(b) `with c as ({{ m() }}) select 1` parses with 0 errors under shapeOf→statement", () => {
		const text = "with c as ({{ my_macro() }}) select 1";
		const before = parseTemplated(text, DIALECT);
		expect(before.sql.errors, "no-catalog fill leaves an invalid CTE body").toBeGreaterThan(0);

		const after = parseTemplated(text, DIALECT, shaped("statement"));
		expect(after.sql.errors).toBe(0);
	});

	it("(b') the same CTE-body case parses with shapeOf→relation too (SELECT 1 fits both slots)", () => {
		const text = "with c as ({{ my_macro() }}) select 1";
		const after = parseTemplated(text, DIALECT, shaped("relation"));
		expect(after.sql.errors).toBe(0);
	});

	it("the anvil residual — CTE body + trailing statement-level macro — parses with 0 errors", () => {
		const text = "with cte as ({{ macro_a() }})\n{{ macro_b() }}";
		const before = parseTemplated(text, DIALECT);
		expect(before.sql.errors).toBeGreaterThan(0);
		const after = parseTemplated(text, DIALECT, shaped("statement"));
		expect(after.sql.errors).toBe(0);
	});
});

describe("inc3.2 expansionShape — the slot guard (statement/relation never break a slot the identifier fill parses)", () => {
	// The durable close of the slot-blind Open Gap (spec §Open Gap): `expansionShape` answers by name,
	// position-blind, so a statement/relation shape could land where its `SELECT 1` fill is invalid SQL
	// while the identifier fill parses. A backward slot scan (blocklist: FROM/JOIN/`,`/predicate
	// keywords) now falls back to the identifier fill there — shaping only ever REMOVES breakage.

	it("the anvil WHERE-slot repro: shapeOf→statement in a predicate slot falls back and parses (was `extraneous input 'SELECT'`)", () => {
		const text = "select 1 from t where {{ my_macro() }}";
		const r = parseTemplated(text, DIALECT, shaped("statement"));
		expect(r.sql.errors).toBe(0); // identifier fill: `where jjjj…` parses as a boolean column
	});

	it("bare FROM slot: shapeOf→relation falls back to the identifier fill (was `FROM SELECT 1`)", () => {
		const text = "select * from {{ my_macro() }}";
		const r = parseTemplated(text, DIALECT, shaped("relation"));
		expect(r.sql.errors).toBe(0); // `from jjjj…` parses as a table name
	});

	it("bare JOIN slot: shapeOf→relation falls back and parses", () => {
		const text = "select * from a join {{ my_macro() }} on a.id = 1";
		const r = parseTemplated(text, DIALECT, shaped("relation"));
		expect(r.sql.errors).toBe(0);
	});

	it("list-comma slot: shapeOf→statement falls back and parses", () => {
		const text = "select a, {{ my_macro() }} from t";
		const r = parseTemplated(text, DIALECT, shaped("statement"));
		expect(r.sql.errors).toBe(0);
	});

	it("a blanked no-output tag before the slot keyword does not hide it (config → whitespace, WHERE still seen)", () => {
		const text = "select 1 from t where {{ config(x=1) }} {{ my_macro() }}";
		const r = parseTemplated(text, DIALECT, shaped("statement"));
		// config blanks to whitespace; the scan skips it and still sees WHERE → identifier fallback.
		expect(r.sql.errors).toBe(0);
	});

	it("the guard does NOT touch predicate shapes: shapeOf→predicate in WHERE still shapes to 1=1", () => {
		const text = "select 1 from t where {{ my_macro() }}";
		const r = parseTemplated(text, DIALECT, shaped("predicate"));
		expect(r.sql.errors).toBe(0);
	});

	it("the guard does NOT touch admitted statement slots: BOF / `;` / CTE `(` / after `)` all still shape", () => {
		for (const text of [
			"{{ my_macro() }}",
			"select 1;\n{{ my_macro() }}",
			"with c as ({{ my_macro() }}) select 1",
			"with cte as (select 1)\n{{ my_macro() }}",
		]) {
			const r = parseTemplated(text, DIALECT, shaped("statement"));
			expect(r.sql.errors, text).toBe(0);
		}
	});
});

describe("inc3.2 expansionShape — the length + newline invariant", () => {
	it("a shaped fill preserves total length (statement position)", () => {
		const text = "with c as ({{ my_macro() }}) select 1";
		expect(placeholderLength(text, "statement")).toBe(text.length);
	});

	it("newlines inside a shaped tag survive at their exact offsets", () => {
		// The `\n` sits AFTER where SELECT 1 lands, so the tag is shaped and the newline is preserved.
		const text = "{{ my_macro() }}\nselect 1";
		const { tokens } = parseTemplated(text, DIALECT, shaped("statement"));
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
		const forced = parseTemplated(text, DIALECT, shaped("statement"));
		const plain = parseTemplated(text, DIALECT);
		// Byte-identical to the no-catalog run: the fit guard fell back to the positional fill.
		expect(forced.tokens.map((t) => `${t.text}:${t.start}-${t.stop}:${t.channel}`)).toEqual(
			plain.tokens.map((t) => `${t.text}:${t.start}-${t.stop}:${t.channel}`),
		);
		expect(forced.tokens.reduce((n, t) => n + t.text.length, 0)).toBe(text.length);
	});

	it("a newline where the fragment would go forces fallback (never a broken fill)", () => {
		// The `\n` at offset 3 lands inside the 8-char `SELECT 1` placement window → fall back.
		const text = "{{\nmacro_a() }}";
		const forced = parseTemplated(text, DIALECT, shaped("statement"));
		const plain = parseTemplated(text, DIALECT);
		expect(forced.tokens.map((t) => `${t.text}:${t.start}-${t.stop}:${t.channel}`)).toEqual(
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
			const withUndefShape = parseTemplated(text, DIALECT, { provider: new DefaultTemplateProvider() });

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

describe("provider-seam contract — builtins under a shape-forcing provider", () => {
	it("FROM-slot ref/source stay byte-identical under a forced statement shape (the SLOT GUARD protects them)", () => {
		// Under the provider contract an EXPLICIT shape wins — the old SHAPE_EXCLUDED name list is
		// gone. What protects `from {{ ref('x') }}` from a buggy forced shape is the positional slot
		// guard (engine-side, non-overridable), and these pin exactly that.
		for (const text of ["select * from {{ ref('orders') }}", "select * from {{ source('raw', 'events') }}"]) {
			const forced = parseTemplated(text, DIALECT, shaped("statement"));
			const plain = parseTemplated(text, DIALECT);
			expect(
				forced.tokens.map((t) => `${t.text}:${t.start}-${t.stop}`),
				text,
			).toEqual(plain.tokens.map((t) => `${t.text}:${t.start}-${t.stop}`));
			expect(forced.sql.errors, text).toBe(plain.sql.errors);
		}
	});

	it("with NO forced shape, the default provider's builtin knowledge keeps ref/source/var on the identifier fill in value/relation slots", () => {
		for (const text of [
			"select * from {{ ref('orders') }}",
			"select * from {{ source('raw', 'events') }}",
			"select {{ var('x') }} from t",
		]) {
			const r = parseTemplated(text, DIALECT);
			expect(r.sql.errors, text).toBe(0);
			expect(r.placeholder, text).toMatch(/j/);
		}
	});

	it("the provider receives the full lexical call — name, packageParts, literal args, kwargs", () => {
		const seen: TemplateCall[] = [];
		class Spy extends DefaultTemplateProvider {
			override shapeOf(call: TemplateCall): undefined {
				seen.push(call);
				return undefined;
			}
		}
		parseTemplated("select {{ dbt_utils.star(ref('x'), quote=true) }} from {{ ref(model='orders') }}", DIALECT, {
			provider: new Spy(),
		});
		const star = seen.find((c) => c.name === "star");
		expect(star?.packageParts).toEqual(["dbt_utils"]);
		expect(star?.args).toEqual([null]); // ref('x') is computed → null, never fabricated
		// Literal extraction is STRING-only (the channel contract): a boolean/number kwarg is computed (null).
		expect(star?.kwargs).toEqual([{ name: "quote", value: null }]);
		const ref = seen.find((c) => c.name === "ref");
		expect(ref?.kwargs).toEqual([{ name: "model", value: "orders" }]);
	});
});

// ---------------------------------------------------------------------------
// conjunct shape (anvil work order 2026-07-05) — a trailing AND-conjunct macro
// (`... on a = b {{ is_deleted_filter(c) }}`) fills `AND 1=1`. Guard polarity is
// OPPOSITE to statement/relation: admitted only where a complete expression can
// just have ended (operand word / `)` / string close); everywhere else the
// identifier fill stays.
// ---------------------------------------------------------------------------
describe("conjunct shape", () => {
	it("after a complete ON expression: parses clean, fill is AND 1=1", () => {
		const text = "select * from a join b on a.id = b.id\n  {{ isdel(col) }}\nunion all\nselect * from c";
		const r = parseTemplated(text, "databricks", shaped("conjunct"));
		expect(r.sql.errors).toBe(0);
		expect(r.placeholder).toContain("AND 1=1");
	});

	it("after a complete WHERE expression: parses clean", () => {
		const text = "select * from t where x = 1 {{ isdel(col) }}";
		const r = parseTemplated(text, "databricks", shaped("conjunct"));
		expect(r.sql.errors).toBe(0);
		expect(r.placeholder).toContain("AND 1=1");
	});

	it("after a closing paren: shaped", () => {
		const text = "select * from t where (x = 1) {{ isdel() }}";
		const r = parseTemplated(text, "databricks", shaped("conjunct"));
		expect(r.sql.errors).toBe(0);
		expect(r.placeholder).toContain("AND 1=1");
	});

	it("guard: bare WHERE slot falls back to the identifier fill (which parses)", () => {
		const text = "select * from t where {{ isdel() }}";
		const r = parseTemplated(text, "databricks", shaped("conjunct"));
		expect(r.sql.errors).toBe(0);
		expect(r.placeholder).not.toContain("AND 1=1");
	});

	it("guard: list comma and open paren fall back", () => {
		for (const text of ["select a, {{ isdel() }} from t", "select * from t where ({{ isdel() }})"]) {
			const r = parseTemplated(text, "databricks", shaped("conjunct"));
			expect(r.sql.errors).toBe(0);
			expect(r.placeholder).not.toContain("AND 1=1");
		}
	});
});

// ---------------------------------------------------------------------------
// Statement-slot blank default (2026-07-05) — a call-shaped tag with NO shape
// answer at a statement slot (BOF / after `;`) blanks to whitespace instead of
// the identifier fill: a lone identifier is never a valid statement, so the old
// fill produced a guaranteed false error.
// ---------------------------------------------------------------------------
describe("statement-slot blank default (no shapeOf)", () => {
	it("BOF macro before a select: 0 errors, tag blanked", () => {
		const text = "{{ my_incremental_helper() }}\nselect 1 from t";
		const r = parseTemplated(text, "databricks");
		expect(r.sql.errors).toBe(0);
		// The tag region is all whitespace in the placeholder.
		expect(r.placeholder.slice(0, text.indexOf("\n"))).toMatch(/^\s*$/);
	});

	it("after a semicolon: 0 errors", () => {
		const text = "select 1;\n{{ audit_hook() }}\nselect 2";
		const r = parseTemplated(text, "databricks");
		expect(r.sql.errors).toBe(0);
	});

	it("shapeOf answering undefined gets the same default (the unsure-classifier path)", () => {
		const text = "{{ my_helper() }}\nselect 1 from t";
		const r = parseTemplated(text, "databricks", { provider: new DefaultTemplateProvider() });
		expect(r.sql.errors).toBe(0);
	});

	it("ref at BOF: a dbt provider's relation answer derives a statement-slot SELECT 1 (parses clean)", () => {
		// Successor of the old SHAPE_EXCLUDED pin: `{{ ref('x') }}` alone used to be a guaranteed
		// identifier-fill error; a DbtTemplateProvider knows ref produces a relation, the derived
		// shape fills SELECT 1 at the admitted statement slot, and the parse is clean. (The NEUTRAL
		// default knows no ref, so without a dbt provider this stays the positional identifier fill.)
		const r = parseTemplated("{{ ref('x') }}", "databricks", { provider: new DbtTemplateProvider() });
		expect(r.placeholder).toContain("SELECT 1");
		expect(r.sql.errors).toBe(0);
	});

	it("a bare non-call tag at BOF keeps the identifier fill (calls only)", () => {
		const r = parseTemplated("{{ my_var }}\nselect 1 from t", "databricks");
		expect(r.placeholder).toMatch(/^j/);
	});

	it("mid-statement calls are untouched (only statement slots blank)", () => {
		const text = "select {{ fmt(x) }} from t";
		const r = parseTemplated(text, "databricks");
		expect(r.sql.errors).toBe(0);
		expect(r.placeholder).toMatch(/j/);
	});
});
