import { describe, expect, it } from "vitest";
import type { Dialect } from "../src/api.js";
import { parseTemplated } from "../src/minijinja/parse.js";
import type { TagArg, TagNode } from "../src/minijinja/tag-ast.js";
import type { PartSpan } from "../src/ir/part-span.js";

// ---------------------------------------------------------------------------
// Task 4 — R2 tag-AST span contract (docs/minijinja-front-end.md §R2). Every span is
// offset-asserted against the SOURCE TEXT: the slice a span points at must be
// exactly the token it claims, and its 1-based line / 0-based column must match a
// fresh scan of the text (the sqllens convention). This is the HARD contract the
// extension positions hover / rename / signature-help on.
//
// The tag AST is NEUTRAL: every expression-call tag is a `kind: "call"` node
// (ref/source/config/var/env_var are just callees, distinguished by `name`), with no
// dbt interpretation. A string arg carries `{value, span (whole arg, quoted),
// valueSpan (quote-excluded)}`; a consumer that knows arg roles (dbt: ref's model is
// the last arg) reads value + valueSpan there — the successor of the old
// `ref.model`/`modelSpan`.
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

/** Narrow to a call node with a given callee `name`, or fail. */
function callTag(text: string, name: string, dialect: Dialect = "databricks"): Extract<TagNode, { kind: "call" }> {
	const node = firstTag(text, dialect);
	expect(node.kind).toBe("call");
	if (node.kind !== "call") throw new Error("not a call");
	expect(node.name).toBe(name);
	return node;
}

/** The last positional-or-any arg — where dbt's `ref` model / a call's trailing value sits. */
function lastArg(node: Extract<TagNode, { kind: "call" }>): TagArg {
	return node.args[node.args.length - 1];
}

describe("tagNodesOf — R2 span contract (neutral call node)", () => {
	it("ref: the model arg value is quote-stripped, its valueSpan excludes quotes; callSpan + tagSpan exact", () => {
		const text = "{{ ref('my_model') }}";
		const node = callTag(text, "ref");
		expect(lastArg(node).value).toBe("my_model");
		expectSpan(text, lastArg(node).valueSpan!, "my_model"); // NO quotes
		expectSpan(text, node.callSpan, "ref('my_model')");
		expectSpan(text, node.tagSpan, "{{ ref('my_model') }}");
	});

	it("ref: spans shift by the tag's document offset inside surrounding SQL", () => {
		const text = "SELECT * FROM {{ ref('orders') }} WHERE 1=1";
		const node = callTag(text, "ref");
		expect(lastArg(node).value).toBe("orders");
		expectSpan(text, lastArg(node).valueSpan!, "orders");
		expectSpan(text, node.tagSpan, "{{ ref('orders') }}");
	});

	it("ref: a double-quoted model arg's valueSpan also excludes quotes", () => {
		const text = '{{ ref("my_model") }}';
		const node = callTag(text, "ref");
		expect(lastArg(node).value).toBe("my_model");
		expectSpan(text, lastArg(node).valueSpan!, "my_model"); // NO double quotes
	});

	it("ref: a COMPUTED arg has value null (never-wrong) and its span covers the whole expression", () => {
		// `ref(var('x'))` — the target is dynamic; the string buried in the nested call
		// must NOT become a literal value. It stays a call named `ref` with a null-value arg.
		const text = "{{ ref(var('x')) }}";
		const node = callTag(text, "ref");
		expect(node.args).toHaveLength(1);
		expect(node.args[0].value).toBeNull();
		expect(node.args[0].valueSpan).toBeUndefined();
		expectSpan(text, node.args[0].span, "var('x')");
	});

	it("source: a computed first arg has value null (never-wrong)", () => {
		const text = "{{ source(var('s'), 'tbl') }}";
		const node = callTag(text, "source");
		expect(node.args[0].value).toBeNull();
		expect(node.args[1].value).toBe("tbl");
	});

	it("source: both string args' valueSpans exclude quotes", () => {
		const text = "{{ source('sch', 'tbl') }}";
		const node = callTag(text, "source");
		expect(node.args[0].value).toBe("sch");
		expect(node.args[1].value).toBe("tbl");
		expectSpan(text, node.args[0].valueSpan!, "sch");
		expectSpan(text, node.args[1].valueSpan!, "tbl");
		expectSpan(text, node.tagSpan, "{{ source('sch', 'tbl') }}");
	});

	it("call: name + package spans, per-argument spans source-ordered, argsSpan paren-to-paren", () => {
		const text = "{{ my_pkg.build(a, nested(b), k=c) }}";
		const node = callTag(text, "build");
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

	it("call: a bare unknown call has no package", () => {
		const text = "{{ dbt_utils_star() }}";
		const node = callTag(text, "dbt_utils_star");
		expect(node.packageName).toBeUndefined();
		expect(node.args).toHaveLength(0);
		expectSpan(text, node.nameSpan, "dbt_utils_star");
	});

	it("multi-line ref: correct multi-line spans (the parity UPGRADE)", () => {
		const text = "{{ ref(\n  'x'\n) }}";
		const node = callTag(text, "ref");
		expect(lastArg(node).value).toBe("x");
		// 'x' sits on line 2 — the tag anchor composes with the token's own line.
		expectSpan(text, lastArg(node).valueSpan!, "x");
		expect(lastArg(node).valueSpan!.line).toBe(2);
		// tagSpan spans all three lines.
		expectSpan(text, node.tagSpan, text);
		expect(node.tagSpan.line).toBe(1);
	});

	it("multi-line ref at a NON-ZERO column: base.column does not leak to later lines", () => {
		// The tag starts on line 2 at column 2; the model 'later' is on line 3. The
		// anchor column must apply ONLY to the tag's first line — a later-line span
		// carries its own absolute column, not base.column + col.
		const text = "SELECT x,\n  {{ ref(\n  'later'\n) }}";
		const node = callTag(text, "ref");
		expect(lastArg(node).value).toBe("later");
		expectSpan(text, lastArg(node).valueSpan!, "later");
		expect(lastArg(node).valueSpan!.line).toBe(3);
		expect(lastArg(node).valueSpan!.column).toBe(3); // "  'later'" → l at col 3
		// the tag itself anchors on line 2 at column 2.
		expect(node.tagSpan.line).toBe(2);
		expect(node.tagSpan.column).toBe(2);
	});

	it("var / env_var / config are plain calls distinguished by name (no dbt classification here)", () => {
		expect(callTag("{{ var('v') }}", "var").kind).toBe("call");
		expect(callTag("{{ env_var('E') }}", "env_var").kind).toBe("call");
		expect(callTag("{{ config(materialized='table') }}", "config").kind).toBe("call");
	});

	it("no-output builtins are also plain calls (config/docs/print/…) — the meaning is the provider's", () => {
		expect(callTag("{{ print('x') }}", "print").kind).toBe("call");
		const exc = callTag("{{ exceptions.raise_compiler_error('boom') }}", "raise_compiler_error");
		expect(exc.packageName).toBe("exceptions");
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

	it("fusion honesty: the call node is correct even when the SQL side fuses", () => {
		// `x{{ref('a')}}y` — the identifier placeholder fuses with the adjacent
		// `x`/`y` on the SQL channel (the known fragment case), but the tag-AST is
		// INDEPENDENT of the SQL parse: its spans still point at the real tag.
		const text = "x{{ref('a')}}y";
		const node = callTag(text, "ref");
		expect(lastArg(node).value).toBe("a");
		expectSpan(text, lastArg(node).valueSpan!, "a");
		expectSpan(text, node.tagSpan, "{{ref('a')}}");
		expectSpan(text, node.callSpan, "ref('a')");
	});

	describe("totality + never-wrong", () => {
		it("a malformed `{{ ref( }}` degrades to a best-effort node + a diagnostic, never a throw", () => {
			const text = "SELECT {{ ref( }}";
			expect(() => parseTemplated(text, "databricks")).not.toThrow();
			const { tags, diagnostics } = parseTemplated(text, "databricks");
			// A broken ref must NOT fabricate a literal model — any arg it recovers has a
			// null value (never-wrong). Its tagSpan is still exact and the jinja parse
			// error surfaces as a positioned diagnostic.
			expect(tags).toHaveLength(1);
			const t = tags[0];
			if (t.kind === "call") expect(t.args.every((a) => a.value === null)).toBe(true);
			expectSpan(text, t.tagSpan, "{{ ref( }}");
			expect(diagnostics.length).toBeGreaterThan(0);
		});

		it("multiple tags in one document each yield a node, named by callee", () => {
			const text = "SELECT * FROM {{ ref('a') }} JOIN {{ source('s', 't') }} USING (id)";
			const { tags } = parseTemplated(text, "databricks");
			expect(tags.map((t) => t.kind)).toEqual(["call", "call"]);
			expect(tags.map((t) => (t.kind === "call" ? t.name : t.kind))).toEqual(["ref", "source"]);
		});

		it("a {% raw %}…{% endraw %} block's closer yields the same control node the pre-doc-native re-lex produced", () => {
			// The `{% endraw %}` closer arrives via the lexer's RawBody-mode exit
			// (ENDRAW_OPEN — a single token carrying `{% endraw` fused, not the ordinary
			// STMT_OPEN+keyword shape a fresh lex of the same text would produce). The
			// tag-AST node must still come out identical: kind "control", keyword
			// "endraw", no declared name, no calls.
			const text = "{% raw %}body{% endraw %} tail";
			const { tags } = parseTemplated(text, "databricks");
			expect(tags.map((t) => t.kind)).toEqual(["control", "control"]);
			const [rawTag, endrawTag] = tags;
			expect(rawTag).toMatchObject({ kind: "control", keyword: "raw" });
			expect(endrawTag).toMatchObject({ kind: "control", keyword: "endraw", calls: [] });
			if (endrawTag.kind !== "control") return;
			expect(endrawTag.name).toBeUndefined();
			expectSpan(text, endrawTag.tagSpan, "{% endraw %}");
		});
	});
});

// ---------------------------------------------------------------------------
// endLine/endColumn on PartSpan (anvil work order 2026-07-05) — every tag-AST
// span carries its end position; a multi-line tag advances tagSpan.endLine.
// ---------------------------------------------------------------------------
describe("PartSpan endLine/endColumn", () => {
	function refTag(text: string): Extract<TagNode, { kind: "call" }> {
		const r = parseTemplated(text, "databricks");
		const ref = r.tags.find((t): t is Extract<TagNode, { kind: "call" }> => t.kind === "call" && t.name === "ref");
		if (!ref) throw new Error("no ref call");
		return ref;
	}

	it("single-line ref: tagSpan/model valueSpan end on the same line, one past the last char", () => {
		const text = "select * from {{ ref('orders') }}";
		const ref = refTag(text);
		const model = lastArg(ref).valueSpan!;
		expect(ref.tagSpan.endLine).toBe(1);
		expect(ref.tagSpan.endColumn).toBe(text.length);
		expect(model.endLine).toBe(1);
		expect(model.endColumn).toBe(model.column + "orders".length);
	});

	it("multi-line ref: tagSpan.endLine advances to the closing }} line", () => {
		const text = "select * from {{ ref(\n  'orders'\n) }}";
		const ref = refTag(text);
		expect(ref.tagSpan.line).toBe(1);
		expect(ref.tagSpan.endLine).toBe(3);
		expect(ref.tagSpan.endColumn).toBe(") }}".length);
	});

	it("region body spans carry end positions (exact via the text)", () => {
		const text = "{% if a %}\nselect 1\n{% endif %}";
		const r = parseTemplated(text, "databricks");
		expect(r.regions.length).toBe(1);
		const arm = r.regions[0].arms[0];
		expect(arm.bodySpan.line).toBe(1); // body starts right after `{% if a %}`
		expect(arm.bodySpan.endLine).toBe(3); // and ends where `{% endif %}` begins
		expect(arm.bodySpan.endColumn).toBe(0);
		expect(r.regions[0].span.endLine).toBe(3);
		expect(r.regions[0].span.endColumn).toBe("{% endif %}".length);
	});
});
