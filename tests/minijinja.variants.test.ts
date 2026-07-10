import { describe, expect, it } from "vitest";
import { parseTemplated } from "../src/minijinja/parse.js";
import { templateVariants } from "../src/minijinja/variants.js";
import type { Dialect } from "../src/api.js";

// ---------------------------------------------------------------------------
// Task 4 — variant expansion (docs/minijinja-front-end.md §Variant realization).
//
// templateVariants(text, dialect) enumerates the {% if %}/{% elif %}/{% else %}
// branch variants of a dbt template as coherent, lazily-parsed alternatives —
// ARM-COVERAGE, not cross-product: variant 0 = every region's arm 0 active; then
// ONE variant per (region, armIndex>0), that variant activating exactly that one
// non-default arm while every other region takes arm 0. LINEAR in total arm count
// (1 + Σ over regions of (arms−1)), never combinatorial. Each variant is realized
// by whitespace-blanking (newline-preserving, coordinates intact) the body ranges
// of every INACTIVE arm over the ORIGINAL text, then parseTemplated on the blank.
// ---------------------------------------------------------------------------

const DIALECT: Dialect = "databricks";

/** Every column-ref `parts` reachable from an IR node — a deep walk that skips the
 *  antlr `cst`/`aliasCst` back-refs (foreign, cyclic). Used to prove which arm's
 *  predicate is live in a variant's parse. */
function columnParts(node: unknown): string[] {
	const out: string[] = [];
	const walk = (n: unknown): void => {
		if (!n || typeof n !== "object") return;
		const rec = n as Record<string, unknown>;
		if (rec.kind === "column" && Array.isArray(rec.parts)) out.push(...(rec.parts as string[]));
		for (const k of Object.keys(rec)) {
			if (k === "cst" || k === "aliasCst") continue;
			walk(rec[k]);
		}
	};
	walk(node);
	return out;
}

describe("templateVariants — arm-coverage enumeration (Task 4)", () => {
	it("if/else on a base SELECT → exactly 2 coherent variants (each arm live once)", () => {
		const text = "SELECT *\nFROM my_table\n{% if a %}WHERE x > 1{% else %}WHERE y > 1{% endif %}";
		const variants = templateVariants(text, DIALECT);
		expect(variants.length).toBe(2);

		// Variant 0 = all-defaults (the `if` arm). Coherent (zero SQL syntax errors),
		// its WHERE references `x`, and the else arm's `y` is blanked away.
		const v0 = variants[0];
		expect(v0.active).toBeUndefined();
		const r0 = v0.parse();
		expect(r0.sql.errors).toBe(0);
		const cols0 = columnParts(r0.sql.ast);
		expect(cols0).toContain("x");
		expect(cols0).not.toContain("y");

		// Variant 1 = the one non-default arm (the else). Coherent; its WHERE references `y`.
		const v1 = variants[1];
		expect(v1.active).toBeDefined();
		expect(v1.active?.armIndex).toBe(1);
		const r1 = v1.parse();
		expect(r1.sql.errors).toBe(0);
		const cols1 = columnParts(r1.sql.ast);
		expect(cols1).toContain("y");
		expect(cols1).not.toContain("x");
	});

	it("token spans in a variant's parse are ORIGINAL-document coordinates", () => {
		const text = "SELECT *\nFROM my_table\n{% if a %}WHERE x > 1{% else %}WHERE y > 1{% endif %}";
		const v0 = templateVariants(text, DIALECT)[0];
		const tok = v0.parse().tokens.find((t) => t.text === "my_table");
		expect(tok).toBeDefined();
		if (!tok) return;
		// Blanking is newline-preserving + in-place, so the token still slices to the
		// ORIGINAL source position (the live region is untouched).
		expect(text.slice(tok.start, tok.stop + 1)).toBe("my_table");
	});

	it("a document with NO regions → exactly 1 variant equalling parseTemplated(text)", () => {
		const text = "SELECT a, b FROM {{ ref('users') }} WHERE a > 1";
		const variants = templateVariants(text, DIALECT);
		expect(variants.length).toBe(1);
		expect(variants[0].active).toBeUndefined();
		// No arms to blank → the blanked text IS the original, so token counts match.
		expect(variants[0].parse().tokens.length).toBe(parseTemplated(text, DIALECT).tokens.length);
	});

	it("nested if-in-if → LINEAR count 1 + Σ(arms−1), not the cross-product", () => {
		const text = [
			"SELECT * FROM t",
			"{% if a %}",
			"  {% if b %} WHERE p {% else %} WHERE q {% endif %}",
			"{% else %}",
			"  WHERE r",
			"{% endif %}",
		].join("\n");
		const variants = templateVariants(text, DIALECT);
		// Two regions, 2 arms each: 1 + (2−1) + (2−1) = 3. Cross-product would be 4.
		expect(variants.length).toBe(3);
		// Every variant is coherent (never throws, always a usable parse).
		for (const v of variants) expect(() => v.parse()).not.toThrow();
	});

	it("nested-in-NON-DEFAULT arm: every arm (incl. the deep else) is live in EXACTLY one variant", () => {
		// The gap case: the inner if/else sits inside the OUTER else. Without ancestor-path
		// activation, `colq` would be live in NO variant and the (inner, else) variant would
		// degenerate to a duplicate of variant 0 (colx-only).
		const text =
			"SELECT * FROM t {% if a %}WHERE colx > 1{% else %}{% if c %}WHERE colp > 1{% else %}WHERE colq > 1{% endif %}{% endif %}";
		const variants = templateVariants(text, DIALECT);
		// Two regions, 2 arms each → 1 + (2−1) + (2−1) = 3.
		expect(variants.length).toBe(3);

		const liveCount = (col: string): number =>
			variants.filter((v) => {
				const r = v.parse();
				return r.sql.errors === 0 && columnParts(r.sql.ast).includes(col);
			}).length;

		// Each arm's predicate is live in EXACTLY one variant (the coverage guarantee).
		expect(liveCount("colx")).toBe(1);
		expect(liveCount("colp")).toBe(1);
		expect(liveCount("colq")).toBe(1);
	});

	it("no degenerate duplicates: every variant realizes distinct blanked text", () => {
		const text =
			"SELECT * FROM t {% if a %}WHERE colx > 1{% else %}{% if c %}WHERE colp > 1{% else %}WHERE colq > 1{% endif %}{% endif %}";
		const variants = templateVariants(text, DIALECT);
		// The token stream tiles its (blanked) input, so the joined token texts reconstruct
		// each variant's realized source — distinct realizations ⇒ distinct joins.
		const realized = variants.map((v) =>
			v
				.parse()
				.tokens.map((t) => t.text)
				.join(""),
		);
		expect(new Set(realized).size).toBe(variants.length);
	});

	it("unbalanced input → total: ≥1 variant, no throw", () => {
		const text = "SELECT * FROM t {% if a %}WHERE x > 1";
		expect(() => templateVariants(text, DIALECT)).not.toThrow();
		const variants = templateVariants(text, DIALECT);
		expect(variants.length).toBeGreaterThanOrEqual(1);
		for (const v of variants) expect(() => v.parse()).not.toThrow();
	});

	it("parse() is lazy + memoized (same reference on the second call)", () => {
		const text = "SELECT *\nFROM t\n{% if a %}WHERE x > 1{% else %}WHERE y > 1{% endif %}";
		const v = templateVariants(text, DIALECT)[0];
		const first = v.parse();
		const second = v.parse();
		expect(second).toBe(first);
	});
});

// ---------------------------------------------------------------------------
// `TemplateVariant.text()` — the realized (arm-blanked) source, exposed (anvil
// work order 2026-07-05: one text-in seam feeding both engines during their
// cutover). Contract: text() is exactly what parse() parses; length-/newline-
// preserving over the original; lazy + memoized separately from parse().
// ---------------------------------------------------------------------------
describe("TemplateVariant.text() — realized variant source", () => {
	const text = "SELECT *\nFROM my_table\n{% if a %}WHERE x > 1{% else %}WHERE y > 1{% endif %}";

	it("each variant's text() carries its live arm and blanks the other, length/newlines preserved", () => {
		const variants = templateVariants(text, DIALECT);
		expect(variants.length).toBe(2);

		const t0 = variants[0].text();
		expect(t0.length).toBe(text.length);
		expect(t0).toContain("WHERE x > 1");
		expect(t0).not.toContain("WHERE y > 1");

		const t1 = variants[1].text();
		expect(t1.length).toBe(text.length);
		expect(t1).toContain("WHERE y > 1");
		expect(t1).not.toContain("WHERE x > 1");

		for (const t of [t0, t1]) {
			for (let i = 0; i < text.length; i++) {
				if (text[i] === "\n") expect(t[i]).toBe("\n");
			}
		}
	});

	it("text() is exactly what parse() parses (one seam)", () => {
		const v = templateVariants(text, DIALECT)[1];
		const realized = v.text();
		const parsed = v.parse();
		// The parse's placeholder is the SQL-fill of the realized text — same length,
		// and every non-tag byte identical (this variant has only control tags, which
		// the placeholder pass whitespace-fills; the live WHERE arm must survive).
		expect(parsed.placeholder.length).toBe(realized.length);
		expect(parsed.placeholder).toContain("WHERE y > 1");
		// Direct equivalence: re-parsing text() reproduces the variant's parse.
		expect(parseTemplated(realized, DIALECT).sql.errors).toBe(parsed.sql.errors);
	});

	it("text() memoizes (same string value on repeat calls) and no-region input works", () => {
		const plain = templateVariants("select 1 from t", DIALECT);
		expect(plain.length).toBe(1);
		expect(plain[0].text()).toBe("select 1 from t");
		expect(plain[0].text()).toBe(plain[0].text());
	});
});

// ---------------------------------------------------------------------------
// Stage-5 Task 1 — the synthetic empty-else arm (acceptance brief case A8b).
//
// An `{% if %}` region whose LAST arm is `if`/`elif` (no `else`) has no branch
// for "condition false" — so its body was live in EVERY realization and
// "optional absent" was never a coverage point. This adds ONE synthetic variant
// per else-less if-region, blanking that region's whole body. Count law becomes
// `1 + Σ(arms−1) + #(else-less if-regions)` — still linear.
// ---------------------------------------------------------------------------
describe("templateVariants — synthetic empty-else arm (Stage-5 Task 1, A8b/A8c)", () => {
	it("if-without-else enumerates a synthetic empty arm (A8b)", () => {
		const SQL =
			"with data as (\n    SELECT always_present{% if condition %}, optional_col{% endif %} FROM raw_table\n)\nSELECT * FROM data";
		const vs = templateVariants(SQL, "duckdb");
		expect(vs.length).toBe(2);
		const texts = vs.map((v) => v.text());
		expect(texts.filter((t) => t.includes("optional_col")).length).toBe(1); // live in exactly one
		const blanked = texts.find((t) => !t.includes("optional_col"))!;
		expect(blanked.length).toBe(SQL.length); // length-preserving
		expect(blanked.includes("always_present")).toBe(true); // shared text stays live
		expect(vs.every((v) => (!v.parse().sql ? true : v.parse().sql.errors === 0))).toBe(true); // both realizations parse
	});
	it("nested conditionals stay linear and leaf-complete (A8c)", () => {
		const SQL =
			"with data as (\n    SELECT\n        {% if outer %}{% if inner %}col_a{% else %}col_b{% endif %}{% else %}col_c{% endif %},\n        base_col\n    FROM raw_table\n)\nSELECT * FROM data";
		const vs = templateVariants(SQL, "duckdb");
		const texts = vs.map((v) => v.text());
		for (const col of ["col_a", "col_b", "col_c"])
			expect(
				texts.some((t) => t.includes(col)),
				col,
			).toBe(true);
		expect(vs.length).toBeLessThanOrEqual(5); // linear (1 + Σ(arms−1) + else-less ifs), never the product
	});
	it("nested ELSE-LESS inner region: the synthetic variant blanks the inner body inside the pinned containing arm", () => {
		// The inner if is else-less and sits inside the OUTER region's arm 0 — its
		// synthetic variant must blank the inner body while ancestor-path activation
		// pins the outer region to the CONTAINING arm (arm 0), never the else.
		const SQL =
			"with data as (\n    SELECT base_col{% if outer %}, extra_col{% if inner %}, col_a{% endif %}{% else %}, col_c{% endif %} FROM raw_table\n)\nSELECT * FROM data";
		const vs = templateVariants(SQL, "duckdb");
		// Law: 1 + Σ(arms−1) + #(else-less ifs) = 1 + (2−1) + (1−1) + 1 = 3.
		expect(vs.length).toBe(3);
		const synthetic = vs.find((v) => v.active?.syntheticEmpty === true)!;
		expect(synthetic).toBeDefined();
		// armIndex stays REQUIRED (anvil contract is additive): 0 is a type-stable
		// placeholder — the discriminator is syntheticEmpty, never the index.
		expect(synthetic.active?.armIndex).toBe(0);
		const t = synthetic.text();
		expect(t).not.toContain("col_a"); // the else-less inner body is wholly absent
		expect(t).not.toContain("col_c"); // the outer region is pinned to the containing arm, not the else
		expect(t).toContain("extra_col"); // the containing arm's surrounding text stays live
		expect(t.length).toBe(SQL.length); // length-preserving
		// The existing coverage guarantee is untouched: each leaf live in exactly one variant.
		const texts = vs.map((v) => v.text());
		expect(texts.filter((x) => x.includes("col_a")).length).toBe(1);
		expect(texts.filter((x) => x.includes("col_c")).length).toBe(1);
	});
});
