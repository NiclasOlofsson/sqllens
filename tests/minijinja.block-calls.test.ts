import { describe, expect, it } from "vitest";
import type { Dialect } from "../src/api.js";
import { parseTemplated } from "../src/minijinja/parse.js";
import type { MacroCall, TagNode } from "../src/minijinja/tag-ast.js";
import type { PartSpan } from "../src/ir/part-span.js";

// ---------------------------------------------------------------------------
// C1 — macro CALLS embedded in `{% %}` control tags surfaced as `calls:
// MacroCall[]` (minijinja consumer roadmap). Today only `{{ }}` EXPRESSION tags
// produce macro nodes with nameSpan/args; a `{% set x = m(1) %}` / `{% if m() %}`
// / `{% call m() %}` / `{% do run_query(m()) %}` classifies as `control` with the
// declared name but the embedded calls were NOT surfaced. C1 adds them — the
// extension needs them for signature-help / hover.
//
// Spans are asserted by slicing the source (the inc1 convention): a span must
// slice to exactly the token it claims, and its 1-based line / 0-based column
// must match an independent scan.
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

function firstTag(text: string, dialect: Dialect = "databricks"): TagNode {
	const { tags } = parseTemplated(text, dialect);
	expect(tags.length).toBeGreaterThan(0);
	return tags[0];
}

/** Narrow the first tag to a control node (and fail loudly otherwise). */
function controlTag(text: string, dialect: Dialect = "databricks"): Extract<TagNode, { kind: "control" }> {
	const node = firstTag(text, dialect);
	expect(node.kind).toBe("control");
	if (node.kind !== "control") throw new Error("not a control node");
	return node;
}

describe("C1 — macro calls in {% %} control tags (calls: MacroCall[])", () => {
	it("{% set x = my_macro(1) %} → control, declared name x, calls=[my_macro(1)]", () => {
		const text = "{% set x = my_macro(1) %}";
		const node = controlTag(text);
		expect(node.keyword).toBe("set");
		expect(node.name).toBe("x"); // declared set-target unchanged
		expectSpan(text, node.nameSpan!, "x");

		expect(node.calls).toHaveLength(1);
		const call = node.calls[0];
		expect(call.name).toBe("my_macro");
		expect(call.packageName).toBeUndefined();
		expectSpan(text, call.nameSpan, "my_macro");
		expect(call.args).toHaveLength(1);
		expectSpan(text, call.args[0].span, "1");
		expectSpan(text, call.argsSpan!, "(1)");
	});

	it("{% if pkg.check(a, b) %} → calls=[check] with packageName pkg, 2 args", () => {
		const text = "{% if pkg.check(a, b) %}";
		const node = controlTag(text);
		expect(node.keyword).toBe("if");
		expect(node.calls).toHaveLength(1);
		const call = node.calls[0];
		expect(call.name).toBe("check");
		expect(call.packageName).toBe("pkg");
		expectSpan(text, call.nameSpan, "check");
		expectSpan(text, call.packageSpan!, "pkg");
		expect(call.args).toHaveLength(2);
		expectSpan(text, call.args[0].span, "a");
		expectSpan(text, call.args[1].span, "b");
	});

	it("{% elif check() %} → calls=[check]", () => {
		const text = "{% elif check() %}";
		const node = controlTag(text);
		expect(node.keyword).toBe("elif");
		expect(node.calls.map((c) => c.name)).toEqual(["check"]);
	});

	it("{% do outer(inner()) %} → calls has BOTH outer and inner (source order), each correct", () => {
		const text = "{% do outer(inner()) %}";
		const node = controlTag(text);
		expect(node.keyword).toBe("do");
		expect(node.calls.map((c) => c.name)).toEqual(["outer", "inner"]);

		const [outer, inner] = node.calls;
		expectSpan(text, outer.nameSpan, "outer");
		expectSpan(text, outer.argsSpan!, "(inner())");
		expect(outer.args).toHaveLength(1);
		expectSpan(text, outer.args[0].span, "inner()");

		expectSpan(text, inner.nameSpan, "inner");
		expect(inner.args).toHaveLength(0);
		expectSpan(text, inner.argsSpan!, "()");
	});

	it("{% do run_query(m()) %} → calls=[run_query, m] (the dbt do-block form)", () => {
		const text = "{% do run_query(m()) %}";
		const node = controlTag(text);
		expect(node.calls.map((c) => c.name)).toEqual(["run_query", "m"]);
	});

	it("{% set x = a() + b() %} → TWO calls, source order [a, b]", () => {
		const text = "{% set x = a() + b() %}";
		const node = controlTag(text);
		expect(node.name).toBe("x");
		expect(node.calls.map((c) => c.name)).toEqual(["a", "b"]);
	});

	it("{% for x in gen() %} → collection-position call, calls=[gen], loop var x unchanged", () => {
		const text = "{% for x in gen() %}";
		const node = controlTag(text);
		expect(node.keyword).toBe("for");
		expect(node.name).toBe("x"); // loop variable unchanged
		expect(node.calls.map((c) => c.name)).toEqual(["gen"]);
		expectSpan(text, node.calls[0].nameSpan, "gen");
	});

	it("{% call m() %} → calls=[m]", () => {
		const text = "{% call m() %}";
		const node = controlTag(text);
		expect(node.keyword).toBe("call");
		expect(node.calls.map((c) => c.name)).toEqual(["m"]);
	});

	it("{% call(x) dbt_utils.some_macro() %} → calls includes the macro", () => {
		const text = "{% call(x) dbt_utils.some_macro() %}";
		const node = controlTag(text);
		expect(node.calls.some((c) => c.name === "some_macro" && c.packageName === "dbt_utils")).toBe(true);
	});

	it("{% if x > 1 %} (no call) → calls: []", () => {
		const node = controlTag("{% if x > 1 %}");
		expect(node.keyword).toBe("if");
		expect(node.calls).toEqual([]);
	});

	it("{% endif %} (no call) → calls: []", () => {
		const node = controlTag("{% endif %}");
		expect(node.keyword).toBe("endif");
		expect(node.calls).toEqual([]);
	});

	it("never-wrong: a computed callee is skipped, not fabricated", () => {
		// The literal-string arg buried in a nested call must never become a
		// call name/span, and a dynamic callee produces no MacroCall.
		const text = "{% set x = my_macro(var('y')) %}";
		const node = controlTag(text);
		// outer my_macro is a real identifier → surfaced; var is a real identifier
		// too (var('y')) → surfaced; but NEITHER fabricates 'y' as a name.
		expect(node.calls.map((c) => c.name)).toEqual(["my_macro", "var"]);
		expect(node.calls.every((c) => c.name !== "y")).toBe(true);
	});

	it("call node carries callSpan over the whole source(…) call (every call has it)", () => {
		const text = "{{ source('sch','tbl') }}";
		const node = firstTag(text);
		expect(node.kind).toBe("call");
		if (node.kind !== "call") return;
		expect(node.name).toBe("source");
		// callSpan covers the source(…) call.
		expectSpan(text, node.callSpan, "source('sch','tbl')");
		// the arg values' spans stay quote-excluded.
		expectSpan(text, node.args[0].valueSpan!, "sch");
		expectSpan(text, node.args[1].valueSpan!, "tbl");
	});

	it("MacroCall shape is reusable + assignable from an expression call node", () => {
		// The `{{ }}` call node's call fields ARE a MacroCall (minus kind/tagSpan/callSpan) —
		// prove the type is what the extension consumes uniformly.
		const macro = firstTag("{{ pkg.build(a) }}");
		expect(macro.kind).toBe("call");
		if (macro.kind !== "call") return;
		const asCall: MacroCall = {
			name: macro.name,
			nameSpan: macro.nameSpan,
			packageName: macro.packageName,
			packageSpan: macro.packageSpan,
			argsSpan: macro.argsSpan,
			args: macro.args,
		};
		expect(asCall.name).toBe("build");
	});
});
