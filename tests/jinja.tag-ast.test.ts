import { describe, expect, it } from "vitest";
import type { Dialect } from "../src/api.js";
import { parseTemplated } from "../src/jinja/parse.js";
import type { TagNode } from "../src/jinja/tag-ast.js";
import type { PartSpan } from "../src/ir/part-span.js";

// ---------------------------------------------------------------------------
// Task 4 — R2 tag-AST span contract (docs/jinja-front-end.md §R2). Every span is
// offset-asserted against the SOURCE TEXT: the slice a span points at must be
// exactly the token it claims, and its 1-based line / 0-based column must match a
// fresh scan of the text (the sqllens convention). This is the HARD contract the
// extension positions hover / rename / signature-help on.
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

/** A span must slice to `expected`, and its line/column must match the oracle. */
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

describe("tagNodesOf — R2 span contract", () => {
	it("ref: model content span excludes quotes; callSpan + tagSpan exact", () => {
		const text = "{{ ref('my_model') }}";
		const node = firstTag(text);
		expect(node.kind).toBe("ref");
		if (node.kind !== "ref") return;
		expect(node.model).toBe("my_model");
		expectSpan(text, node.modelSpan, "my_model"); // NO quotes
		expectSpan(text, node.callSpan, "ref('my_model')");
		expectSpan(text, node.tagSpan, "{{ ref('my_model') }}");
	});

	it("ref: spans shift by the tag's document offset inside surrounding SQL", () => {
		const text = "SELECT * FROM {{ ref('orders') }} WHERE 1=1";
		const node = firstTag(text);
		expect(node.kind).toBe("ref");
		if (node.kind !== "ref") return;
		expect(node.model).toBe("orders");
		expectSpan(text, node.modelSpan, "orders");
		expectSpan(text, node.tagSpan, "{{ ref('orders') }}");
	});

	it("source: both content spans exclude quotes", () => {
		const text = "{{ source('sch', 'tbl') }}";
		const node = firstTag(text);
		expect(node.kind).toBe("source");
		if (node.kind !== "source") return;
		expect(node.sourceName).toBe("sch");
		expect(node.tableName).toBe("tbl");
		expectSpan(text, node.sourceNameSpan, "sch");
		expectSpan(text, node.tableNameSpan, "tbl");
		expectSpan(text, node.tagSpan, "{{ source('sch', 'tbl') }}");
	});

	it("macro: name + package spans, per-argument spans source-ordered, argsSpan paren-to-paren", () => {
		const text = "{{ my_pkg.build(a, nested(b), k=c) }}";
		const node = firstTag(text);
		expect(node.kind).toBe("macro");
		if (node.kind !== "macro") return;
		expect(node.name).toBe("build");
		expect(node.packageName).toBe("my_pkg");
		expectSpan(text, node.nameSpan, "build");
		expect(node.packageSpan).toBeDefined();
		expectSpan(text, node.packageSpan!, "my_pkg");

		// PER-ARGUMENT spans, source order, top-level-comma split (nested parens
		// respected — `nested(b)` is ONE arg, not split at its inner content).
		expect(node.args).toHaveLength(3);
		expectSpan(text, node.args[0].span, "a");
		expectSpan(text, node.args[1].span, "nested(b)");
		expectSpan(text, node.args[2].span, "k=c");

		expect(node.argsSpan).toBeDefined();
		expectSpan(text, node.argsSpan!, "(a, nested(b), k=c)");
		expectSpan(text, node.tagSpan, text);
	});

	it("macro: a bare unknown call is a macro with no package", () => {
		const text = "{{ dbt_utils_star() }}";
		const node = firstTag(text);
		expect(node.kind).toBe("macro");
		if (node.kind !== "macro") return;
		expect(node.name).toBe("dbt_utils_star");
		expect(node.packageName).toBeUndefined();
		expect(node.args).toHaveLength(0);
		expectSpan(text, node.nameSpan, "dbt_utils_star");
	});

	it("multi-line ref: correct multi-line spans (the parity UPGRADE)", () => {
		const text = "{{ ref(\n  'x'\n) }}";
		const node = firstTag(text);
		expect(node.kind).toBe("ref");
		if (node.kind !== "ref") return;
		expect(node.model).toBe("x");
		// 'x' sits on line 2 — the tag anchor composes with the token's own line.
		expectSpan(text, node.modelSpan, "x");
		expect(node.modelSpan.line).toBe(2);
		// tagSpan spans all three lines.
		expectSpan(text, node.tagSpan, text);
		expect(node.tagSpan.line).toBe(1);
	});

	it("var / env_var / config classify by leading name", () => {
		expect(firstTag("{{ var('v') }}").kind).toBe("var");
		expect(firstTag("{{ env_var('E') }}").kind).toBe("env_var");
		expect(firstTag("{{ config(materialized='table') }}").kind).toBe("config");
	});

	it("no-output builtins (docs/print/log/return/exceptions) classify as other", () => {
		expect(firstTag("{{ print('x') }}").kind).toBe("other");
		expect(firstTag("{{ exceptions.raise_compiler_error('boom') }}").kind).toBe("other");
	});

	it("a control statement tag classifies as control", () => {
		const text = "{% if x %}";
		const node = firstTag(text);
		expect(node.kind).toBe("control");
		expectSpan(text, node.tagSpan, "{% if x %}");
	});

	it("a comment tag classifies as other", () => {
		const text = "{# a note #}";
		const node = firstTag(text);
		expect(node.kind).toBe("other");
		expectSpan(text, node.tagSpan, "{# a note #}");
	});

	it("fusion honesty: the ref node is correct even when the SQL side fuses", () => {
		// `x{{ref('a')}}y` — the identifier placeholder fuses with the adjacent
		// `x`/`y` on the SQL channel (the known fragment case), but the tag-AST is
		// INDEPENDENT of the SQL parse: its spans still point at the real tag.
		const text = "x{{ref('a')}}y";
		const node = firstTag(text);
		expect(node.kind).toBe("ref");
		if (node.kind !== "ref") return;
		expect(node.model).toBe("a");
		expectSpan(text, node.modelSpan, "a");
		expectSpan(text, node.tagSpan, "{{ref('a')}}");
		expectSpan(text, node.callSpan, "ref('a')");
	});

	describe("totality + never-wrong", () => {
		it("a malformed `{{ ref( }}` degrades to a best-effort node + a diagnostic, never a throw", () => {
			const text = "SELECT {{ ref( }}";
			expect(() => parseTemplated(text, "databricks")).not.toThrow();
			const { tags, diagnostics } = parseTemplated(text, "databricks");
			// A broken ref must NOT emit a ref node with a fabricated modelSpan — it
			// degrades to a best-effort node (never-wrong). The unrecognizable call
			// yields an `other` node here; either way it is never a ref.
			expect(tags).toHaveLength(1);
			expect(tags[0].kind).not.toBe("ref");
			// Its tagSpan is still exact, and the jinja parse error surfaces as a
			// positioned diagnostic.
			expectSpan(text, tags[0].tagSpan, "{{ ref( }}");
			expect(diagnostics.length).toBeGreaterThan(0);
		});

		it("multiple tags in one document each yield a node", () => {
			const text = "SELECT * FROM {{ ref('a') }} JOIN {{ source('s', 't') }} USING (id)";
			const { tags } = parseTemplated(text, "databricks");
			expect(tags.map((t) => t.kind)).toEqual(["ref", "source"]);
		});
	});
});
