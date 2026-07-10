import { describe, it, expect } from "vitest";
import { parse } from "../src/index.js";
import type { TemplateEngine } from "../src/index.js";
import { minijinja } from "../src/minijinja/index.js";

/** The engine contract: any TemplateEngine must pass this suite. */
export function engineContract(makeEngine: () => TemplateEngine): void {
	const engine = makeEngine();
	const TEMPLATED = "select a, {{ var('x') }} from {{ ref('orders') }} where a > 1";
	const PLAIN = "select a from orders where a > 1";
	const BROKEN: string[] = [];
	for (let i = 1; i < TEMPLATED.length; i += 7) BROKEN.push(TEMPLATED.slice(0, i));

	describe(`engine contract: ${engine.name}`, () => {
		it("tokens tile the source byte-for-byte", () => {
			const r = engine.parse(TEMPLATED, "databricks");
			const rebuilt = r.tokens.map((t) => t.text).join("");
			expect(rebuilt).toBe(TEMPLATED);
		});
		it("every token span is in original coordinates", () => {
			const r = engine.parse(TEMPLATED, "databricks");
			for (const t of r.tokens) expect(TEMPLATED.slice(t.start, t.stop + 1)).toBe(t.text);
		});
		it("total on broken input — never throws, degrades honestly", () => {
			for (const text of BROKEN) expect(() => engine.parse(text, "databricks")).not.toThrow();
		});
		it("tag-free text degenerates to the plain parse plus empty facets", () => {
			const r = engine.parse(PLAIN, "databricks");
			const p = parse(PLAIN, "databricks");
			expect(r.tags).toEqual([]);
			expect(r.placeholder).toBe(PLAIN);
			expect(r.sql.errors).toBe(p.errors);
			expect(r.tokens.map((t) => [t.start, t.stop, t.text])).toEqual(
				p.tokens.map((t) => [t.start, t.stop, t.text]),
			);
		});
		it("no fill text leaks into diagnostics", () => {
			const r = engine.parse("select {{ broken_macro( }} from t", "databricks");
			// The identifier fill's padding run is a literal repeat of PLACEHOLDER_CHAR ("j",
			// segment.ts) — the same threshold the F5 diagnostics-scrub regression tests use
			// (tests/minijinja.f5-findings.test.ts, tests/corpus/minijinja.consumer-contract.test.ts).
			for (const d of r.diagnostics) expect(d.message).not.toMatch(/j{4,}/);
		});
		it("accessors are total on every path", () => {
			const r = engine.parse(PLAIN, "databricks");
			expect(r.tagOf({})).toBeUndefined();
			const t = engine.parse(TEMPLATED, "databricks");
			for (const tag of t.tags) expect(Array.isArray(t.diagnosticsOf(tag))).toBe(true);
		});
	});
}

engineContract(minijinja);
