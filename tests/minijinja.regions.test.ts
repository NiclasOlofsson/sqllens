import { describe, expect, it } from "vitest";
import { parseTemplated } from "../src/minijinja/parse.js";
import { templateRegions, templateSymbols } from "../src/minijinja/regions.js";
import type { PartSpan } from "../src/ir/part-span.js";

// ---------------------------------------------------------------------------
// Task 3 — R4: control-flow regions + set/macro template symbols
// (docs/minijinja-front-end.md §R4). Every span is offset-asserted by SLICING the
// source text (the inc1 convention). nameSpan / tagSpan are token-exact so their
// 1-based line / 0-based column are also checked; bodySpan / region span carry a
// best-effort line/column anchor (regions.ts has no text), so those assert the
// slice only — the offsets are the load-bearing contract.
// ---------------------------------------------------------------------------

/** 1-based line, 0-based column of an absolute offset — an independent oracle. */
function posOf(text: string, offset: number): { line: number; column: number } {
	let line = 1;
	let column = 0;
	for (let i = 0; i < offset; i++) {
		if (text[i] === "\n") {
			line += 1;
			column = 0;
		} else {
			column += 1;
		}
	}
	return { line, column };
}

/** slice-only span assertion (offsets are the contract). */
function expectSlice(text: string, span: PartSpan, expected: string): void {
	expect(text.slice(span.start, span.end)).toBe(expected);
}

/** token-exact span: slice + line/column oracle. */
function expectSpan(text: string, span: PartSpan, expected: string): void {
	expectSlice(text, span, expected);
	const p = posOf(text, span.start);
	expect(span.line).toBe(p.line);
	expect(span.column).toBe(p.column);
}

const regionsOf = (text: string) => parseTemplated(text, "databricks").regions;
const symbolsOf = (text: string) => parseTemplated(text, "databricks").symbols;

describe("templateRegions — control-flow region tree", () => {
	it("if/else → one region, two arms, bodySpans slice exactly", () => {
		const text = "{% if a %}SELECT 1{% else %}SELECT 2{% endif %}";
		const regions = regionsOf(text);
		expect(regions.length).toBe(1);
		const r = regions[0];
		expect(r.kind).toBe("if");
		expect(r.arms.length).toBe(2);
		expect(r.arms[0].keyword).toBe("if");
		expect(r.arms[1].keyword).toBe("else");
		expectSpan(text, r.arms[0].tagSpan, "{% if a %}");
		expectSpan(text, r.arms[1].tagSpan, "{% else %}");
		expectSlice(text, r.arms[0].bodySpan, "SELECT 1");
		expectSlice(text, r.arms[1].bodySpan, "SELECT 2");
		expectSlice(text, r.span, text);
	});

	it("if/elif/else → three arms", () => {
		const text = "{% if a %}1{% elif b %}2{% else %}3{% endif %}";
		const regions = regionsOf(text);
		expect(regions.length).toBe(1);
		const r = regions[0];
		expect(r.arms.map((a) => a.keyword)).toEqual(["if", "elif", "else"]);
		expectSlice(text, r.arms[0].bodySpan, "1");
		expectSlice(text, r.arms[1].bodySpan, "2");
		expectSlice(text, r.arms[2].bodySpan, "3");
	});

	it("nesting — an if inside a for arm lands in children", () => {
		const text = "{% for r in rows %}SELECT {% if x %}a{% endif %} FROM t{% endfor %}";
		const regions = regionsOf(text);
		expect(regions.length).toBe(1);
		const outer = regions[0];
		expect(outer.kind).toBe("for");
		expect(outer.arms.length).toBe(1);
		expect(outer.arms[0].children.length).toBe(1);
		const inner = outer.arms[0].children[0];
		expect(inner.kind).toBe("if");
		expectSpan(text, inner.arms[0].tagSpan, "{% if x %}");
		expectSlice(text, inner.arms[0].bodySpan, "a");
		expectSlice(text, outer.span, text);
	});

	it("for/macro carry exactly one arm", () => {
		const text = "{% macro build(a, b) %}SELECT 1{% endmacro %}";
		const regions = regionsOf(text);
		expect(regions.length).toBe(1);
		expect(regions[0].kind).toBe("macro");
		expect(regions[0].arms.length).toBe(1);
		expectSlice(text, regions[0].span, text);
	});

	it("totality — unclosed if never throws, yields one best-effort region", () => {
		const text = "{% if x %}SELECT 1";
		expect(() => regionsOf(text)).not.toThrow();
		const regions = regionsOf(text);
		expect(regions.length).toBe(1);
		expect(regions[0].kind).toBe("if");
		expect(regions[0].arms.length).toBe(1);
	});

	it("totality — a stray endif never throws (skipped)", () => {
		const text = "SELECT 1 {% endif %}";
		expect(() => regionsOf(text)).not.toThrow();
		expect(regionsOf(text).length).toBe(0);
	});

	it("totality — an orphan elif never throws (own single-arm region)", () => {
		const text = "{% elif b %}X{% endif %}";
		expect(() => templateRegions(parseTemplated(text, "databricks").tags)).not.toThrow();
		const regions = regionsOf(text);
		expect(regions.length).toBe(1);
		expect(regions[0].kind).toBe("if");
		expect(regions[0].arms.length).toBe(1);
		expect(regions[0].arms[0].keyword).toBe("elif");
	});

	it("bodySpan line/column agree with its start offset on a multi-line body", () => {
		// The if-tag opens on line 1; the body starts after a newline — a case the
		// opening-tag anchor would report wrong without LineIndex.
		const text = "{% if a %}\n    SELECT 1{% endif %}";
		const r = regionsOf(text)[0];
		const body = r.arms[0].bodySpan;
		// Offsets are the contract: the body slices to exactly what follows the tag.
		expectSlice(text, body, "\n    SELECT 1");
		// line/column must match the ACTUAL document position of body.start (oracle).
		const p = posOf(text, body.start);
		expect(body.line).toBe(p.line);
		expect(body.column).toBe(p.column);
		expect(body.line).toBe(1); // body.start is the '\n' terminating line 1
		expect(body.column).toBe(10);
	});

	it("bodySpan on a later line resolves that line + column (deep multi-line)", () => {
		const text = "{% if a %}first\n\n  second{% else %}third{% endif %}";
		const r = regionsOf(text)[0];
		// arm[1] (else) body starts after the else tag, which sits on line 3.
		const elseBody = r.arms[1].bodySpan;
		expectSlice(text, elseBody, "third");
		const p = posOf(text, elseBody.start);
		expect(elseBody.line).toBe(p.line);
		expect(elseBody.column).toBe(p.column);
		expect(elseBody.line).toBe(3);
	});

	it("for…else — total, for stays ONE arm, else body reachable as a nested region", () => {
		const text = "{% for r in rows %}A{% else %}B{% endfor %}";
		expect(() => regionsOf(text)).not.toThrow();
		const regions = regionsOf(text);
		expect(regions.length).toBe(1);
		const forRegion = regions[0];
		expect(forRegion.kind).toBe("for");
		expect(forRegion.arms.length).toBe(1); // for stays exactly one arm
		// the else is modeled as an orphan single-arm if region nested in the for arm.
		const nested = forRegion.arms[0].children;
		expect(nested.length).toBe(1);
		expect(nested[0].kind).toBe("if");
		expect(nested[0].arms[0].keyword).toBe("else");
		expectSpan(text, nested[0].arms[0].tagSpan, "{% else %}");
		expectSlice(text, nested[0].arms[0].bodySpan, "B");
		expectSlice(text, forRegion.span, text);
	});

	it("totality — empty tags yields no regions/symbols", () => {
		expect(templateRegions([])).toEqual([]);
		expect(templateSymbols([])).toEqual([]);
	});
});

describe("templateSymbols — set / macro go-to-def symbols", () => {
	it("{% set x = 1 %} → set symbol with nameSpan on x", () => {
		const text = "{% set my_var = 1 %}";
		const symbols = symbolsOf(text);
		expect(symbols.length).toBe(1);
		const s = symbols[0];
		expect(s.kind).toBe("set");
		expect(s.name).toBe("my_var");
		expectSpan(text, s.nameSpan, "my_var");
		expectSlice(text, s.span, text);
	});

	it("{% macro build() %}…{% endmacro %} → macro symbol spanning the block", () => {
		const text = "{% macro build(a, b) %}SELECT 1{% endmacro %}";
		const symbols = symbolsOf(text);
		expect(symbols.length).toBe(1);
		const s = symbols[0];
		expect(s.kind).toBe("macro");
		expect(s.name).toBe("build");
		expectSpan(text, s.nameSpan, "build");
		expectSlice(text, s.span, text);
	});

	it("macro with no endmacro still yields a symbol (best-effort span)", () => {
		const text = "{% macro build(a) %}SELECT 1";
		const symbols = symbolsOf(text);
		expect(symbols.length).toBe(1);
		expect(symbols[0].name).toBe("build");
		expectSpan(text, symbols[0].nameSpan, "build");
	});
});

describe("control TagNode enrichment — keyword / name / nameSpan", () => {
	it("if / else / endif carry their keyword, no name", () => {
		const text = "{% if a %}1{% else %}2{% endif %}";
		const tags = parseTemplated(text, "databricks").tags.filter((t) => t.kind === "control");
		expect(tags.map((t) => (t.kind === "control" ? t.keyword : undefined))).toEqual(["if", "else", "endif"]);
		for (const t of tags) if (t.kind === "control") expect(t.name).toBeUndefined();
	});

	it("for loop variable is captured as name", () => {
		const text = "{% for row in rows %}x{% endfor %}";
		const tags = parseTemplated(text, "databricks").tags;
		const forTag = tags.find((t) => t.kind === "control" && t.keyword === "for");
		expect(forTag?.kind).toBe("control");
		if (forTag?.kind !== "control") return;
		expect(forTag.name).toBe("row");
		expect(forTag.nameSpan && text.slice(forTag.nameSpan.start, forTag.nameSpan.end)).toBe("row");
	});

	it("set target is captured as name", () => {
		const text = "{% set total = 5 %}";
		const setTag = parseTemplated(text, "databricks").tags.find((t) => t.kind === "control");
		expect(setTag?.kind).toBe("control");
		if (setTag?.kind !== "control") return;
		expect(setTag.keyword).toBe("set");
		expect(setTag.name).toBe("total");
		expect(setTag.nameSpan && text.slice(setTag.nameSpan.start, setTag.nameSpan.end)).toBe("total");
	});
});
