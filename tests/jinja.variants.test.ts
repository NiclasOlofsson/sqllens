import { describe, expect, it } from "vitest";
import { parseTemplated } from "../src/jinja/parse.js";
import { templateVariants } from "../src/jinja/variants.js";
import type { Dialect } from "../src/api.js";

// ---------------------------------------------------------------------------
// Task 4 — variant expansion (docs/jinja-front-end.md §Variant realization).
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
