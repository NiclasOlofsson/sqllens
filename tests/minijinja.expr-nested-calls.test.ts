import { describe, expect, it } from "vitest";
import type { Dialect } from "../src/api.js";
import { parseTemplated } from "../src/minijinja/parse.js";
import type { TagNode } from "../src/minijinja/tag-ast.js";
import type { PartSpan } from "../src/ir/part-span.js";

// ---------------------------------------------------------------------------
// C1 field-gap closer — nested calls on `{{ }}` EXPRESSION macro nodes surfaced
// as `calls: MacroCall[]`, symmetric to the `control.calls` C1 added for `{% %}`
// tags. Before this, `{{ outer(inner()) }}` exposed only the top-level `outer`,
// dropping `inner` — a real hover / signature-help regression. `calls` now
// carries EVERY call (nested included), source order, `calls[0]` == the node's
// own top-level call; the node's existing top-level fields are UNCHANGED.
//
// Spans asserted by slicing the source (inc1 convention): a span slices to
// exactly the token it claims, its 1-based line / 0-based column match an
// independent scan.
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

function expectSpan(text: string, span: PartSpan, expected: string): void {
	expect(text.slice(span.start, span.end)).toBe(expected);
	const p = posOf(text, span.start);
	expect(span.line).toBe(p.line);
	expect(span.column).toBe(p.column);
}

function macroTag(text: string, dialect: Dialect = "databricks"): Extract<TagNode, { kind: "call" }> {
	const { tags } = parseTemplated(text, dialect);
	expect(tags.length).toBeGreaterThan(0);
	const node = tags[0];
	expect(node.kind).toBe("call");
	if (node.kind !== "call") throw new Error("not a call node");
	return node;
}

describe("C1 field gap — nested calls on {{ }} expression macro nodes (calls: MacroCall[])", () => {
	it("{{ outer(inner()) }} → calls=[outer, inner], both spans correct, source order", () => {
		const text = "{{ outer(inner()) }}";
		const node = macroTag(text);

		// Top-level fields unchanged: the node still describes `outer`.
		expect(node.name).toBe("outer");
		expectSpan(text, node.nameSpan, "outer");

		expect(node.calls.map((c) => c.name)).toEqual(["outer", "inner"]);
		const [outer, inner] = node.calls;

		// calls[0] IS the top-level call — same identifier as the node's own name.
		expect(outer.name).toBe(node.name);
		expectSpan(text, outer.nameSpan, "outer");
		expectSpan(text, outer.argsSpan!, "(inner())");
		expect(outer.args).toHaveLength(1);
		expectSpan(text, outer.args[0].span, "inner()");

		expectSpan(text, inner.nameSpan, "inner");
		expect(inner.args).toHaveLength(0);
		expectSpan(text, inner.argsSpan!, "()");
	});

	it("{{ pkg.build(a(), nested(b())) }} → calls=[build, a, nested, b], packageName on build", () => {
		const text = "{{ pkg.build(a(), nested(b())) }}";
		const node = macroTag(text);

		expect(node.name).toBe("build");
		expect(node.packageName).toBe("pkg");

		expect(node.calls.map((c) => c.name)).toEqual(["build", "a", "nested", "b"]);

		const [build, a, nested, b] = node.calls;
		expect(build.packageName).toBe("pkg");
		expectSpan(text, build.nameSpan, "build");
		expectSpan(text, build.packageSpan!, "pkg");
		expectSpan(text, a.nameSpan, "a");
		expectSpan(text, nested.nameSpan, "nested");
		expectSpan(text, b.nameSpan, "b");
		// nested's own arg is the b() call.
		expect(nested.args).toHaveLength(1);
		expectSpan(text, nested.args[0].span, "b()");
	});

	it("{{ my_macro() }} (no nesting) → calls=[my_macro] (just the top-level)", () => {
		const text = "{{ my_macro() }}";
		const node = macroTag(text);
		expect(node.name).toBe("my_macro");
		expect(node.calls.map((c) => c.name)).toEqual(["my_macro"]);
		expectSpan(text, node.calls[0].nameSpan, "my_macro");
	});

	it("calls[0] top-level fields mirror the node's own name/args (additive, unchanged)", () => {
		const text = "{{ pkg.build(a) }}";
		const node = macroTag(text);
		// Node's existing fields.
		expect(node.name).toBe("build");
		expect(node.packageName).toBe("pkg");
		expect(node.args).toHaveLength(1);
		expectSpan(text, node.args[0].span, "a");
		// calls[0] carries the identical top-level shape.
		const top = node.calls[0];
		expect(top.name).toBe(node.name);
		expect(top.packageName).toBe(node.packageName);
		expect(top.args).toHaveLength(1);
		expectSpan(text, top.args[0].span, "a");
	});

	it("ref-fallback (computed target) macro node also carries nested calls", () => {
		// A computed ref target degrades to a macro node; its nested calls surface.
		const text = "{{ ref(var('y')) }}";
		const node = macroTag(text);
		expect(node.name).toBe("ref");
		expect(node.calls.map((c) => c.name)).toEqual(["ref", "var"]);
		// never-wrong: the buried literal 'y' is NOT fabricated as a call name.
		expect(node.calls.every((c) => c.name !== "y")).toBe(true);
	});
});
