import { describe, expect, it } from "vitest";
import { parseMinijinjaTag } from "../src/minijinja/parse-tag.js";
import type { ParserRuleContext } from "antlr4ng";

// ---------------------------------------------------------------------------
// Task 1 — the standalone jinja island grammar. These drive one jinja tag's
// text (delimiters included) through the generated jinja lexer+parser. The
// oracle is minijinja (the Rust engine dbt Fusion uses). Whole-document
// scanning is Task 2's segmenter; this is per-tag only.
// ---------------------------------------------------------------------------

/** Depth-first walk collecting every node whose context class name matches. */
function findAll(tree: ParserRuleContext, ctxName: string): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	const visit = (node: unknown): void => {
		const ctx = node as ParserRuleContext | null;
		if (!ctx || typeof ctx !== "object") return;
		if (ctx.constructor?.name === ctxName) out.push(ctx);
		const n = (ctx as { getChildCount?: () => number }).getChildCount?.();
		if (typeof n === "number") {
			for (let i = 0; i < n; i++) visit((ctx as { getChild: (i: number) => unknown }).getChild(i));
		}
	};
	visit(tree);
	return out;
}

function callCount(tree: ParserRuleContext): number {
	return findAll(tree, "CallExprContext").length;
}

describe("jinja island grammar — expression tags", () => {
	it("recognizes ref('x') as a call with one string arg", () => {
		const { tree, errors } = parseMinijinjaTag("{{ ref('x') }}");
		expect(errors).toBe(0);
		expect(callCount(tree)).toBe(1);
		expect(tree.getText()).toContain("ref('x')");
	});

	it("recognizes source('a', 'b') as a call with two args", () => {
		const { tree, errors } = parseMinijinjaTag("{{ source('a', 'b') }}");
		expect(errors).toBe(0);
		expect(callCount(tree)).toBe(1);
		const args = findAll(tree, "PosargContext");
		expect(args.length).toBe(2);
	});

	it("recognizes pkg.macro(1, nested(2), k=3) — dotted name, nested call, kwarg", () => {
		const { tree, errors } = parseMinijinjaTag("{{ pkg.macro(1, nested(2), k=3) }}");
		expect(errors).toBe(0);
		// outer pkg.macro(...) + inner nested(...)
		expect(callCount(tree)).toBe(2);
		expect(findAll(tree, "KwargContext").length).toBe(1);
		expect(findAll(tree, "MemberExprContext").length).toBeGreaterThanOrEqual(1);
	});

	it('recognizes var("n") with a double-quoted string arg', () => {
		const { tree, errors } = parseMinijinjaTag('{{ var("n") }}');
		expect(errors).toBe(0);
		expect(callCount(tree)).toBe(1);
	});

	it("parses dotted access a.b.c (no call)", () => {
		const { tree, errors } = parseMinijinjaTag("{{ a.b.c }}");
		expect(errors).toBe(0);
		expect(callCount(tree)).toBe(0);
		expect(findAll(tree, "MemberExprContext").length).toBe(2);
	});

	it("tolerates a filter x | upper (opaque, still 0 errors)", () => {
		const { tree, errors } = parseMinijinjaTag("{{ x | upper }}");
		expect(errors).toBe(0);
		expect(findAll(tree, "FilterContext").length).toBe(1);
	});

	it("tolerates a test x is defined (opaque, still 0 errors)", () => {
		const { errors } = parseMinijinjaTag("{{ x is defined }}");
		expect(errors).toBe(0);
	});

	it("parses an empty expression tag {{ }}", () => {
		const { errors } = parseMinijinjaTag("{{ }}");
		expect(errors).toBe(0);
	});

	it("parses subscript and slice a[b] / a[1:2:3]", () => {
		expect(parseMinijinjaTag("{{ a[b] }}").errors).toBe(0);
		expect(parseMinijinjaTag("{{ a[1:2:3] }}").errors).toBe(0);
	});
});

describe("jinja island grammar — statement tags", () => {
	it("parses {% if cond %} and exposes a KeywordContext lead", () => {
		const { tree, errors } = parseMinijinjaTag("{% if cond %}");
		expect(errors).toBe(0);
		expect(findAll(tree, "Stmt_tagContext").length).toBe(1);
		expect(findAll(tree, "KeywordContext").length).toBe(1);
	});

	it("parses {% for x in items %} and exposes a KeywordContext lead", () => {
		const { tree, errors } = parseMinijinjaTag("{% for x in items %}");
		expect(errors).toBe(0);
		expect(findAll(tree, "KeywordContext").length).toBe(1);
	});

	it("parses {% set y = 1 %} and exposes a KeywordContext lead", () => {
		const { tree, errors } = parseMinijinjaTag("{% set y = 1 %}");
		expect(errors).toBe(0);
		expect(findAll(tree, "KeywordContext").length).toBe(1);
	});

	it("parses {% endif %}", () => {
		expect(parseMinijinjaTag("{% endif %}").errors).toBe(0);
	});

	it("recognizes a call inside a statement tag {% set x = ref('y') %}", () => {
		const { tree, errors } = parseMinijinjaTag("{% set x = ref('y') %}");
		expect(errors).toBe(0);
		expect(callCount(tree)).toBe(1);
	});

	it('parses from/import with as: {% from "m" import a as b %}', () => {
		expect(parseMinijinjaTag('{% from "m" import a as b %}').errors).toBe(0);
	});

	// dbt-custom statement tags in non-model files (snapshots, docs blocks, custom
	// materializations, generic tests) lead with an unknown, non-jinja keyword.
	// They must parse with 0 errors — a false-error here rejects real dbt.
	it("tolerates dbt-custom statement leads with 0 errors", () => {
		expect(parseMinijinjaTag("{% snapshot my_snapshot %}").errors).toBe(0);
		expect(parseMinijinjaTag("{% docs my_docs %}").errors).toBe(0);
		expect(parseMinijinjaTag("{% materialization my_mat, default %}").errors).toBe(0);
		expect(parseMinijinjaTag("{% test my_test(model, column_name) %}").errors).toBe(0);
	});

	it("an unknown lead does NOT get a KeywordContext (opaque id lead)", () => {
		const { tree, errors } = parseMinijinjaTag("{% snapshot my_snapshot %}");
		expect(errors).toBe(0);
		expect(findAll(tree, "KeywordContext").length).toBe(0);
	});
});

describe("jinja island grammar — comment tags", () => {
	it("parses {# a comment #}", () => {
		const { tree, errors } = parseMinijinjaTag("{# a comment #}");
		expect(errors).toBe(0);
		expect(findAll(tree, "Comment_tagContext").length).toBe(1);
	});
});

describe("jinja island grammar — whitespace control", () => {
	it("parses {{- x -}}", () => {
		expect(parseMinijinjaTag("{{- x -}}").errors).toBe(0);
	});

	it("parses {%- if a -%}", () => {
		expect(parseMinijinjaTag("{%- if a -%}").errors).toBe(0);
	});

	it("parses a comment with dashes {#- c -#}", () => {
		expect(parseMinijinjaTag("{#- c -#}").errors).toBe(0);
	});
});

describe("jinja island grammar — totality (R5)", () => {
	it("a half-typed {{ ref( yields a tree + >0 errors, never throws", () => {
		let result: ReturnType<typeof parseMinijinjaTag> | undefined;
		expect(() => {
			result = parseMinijinjaTag("{{ ref(");
		}).not.toThrow();
		expect(result?.tree).toBeDefined();
		expect(result!.errors).toBeGreaterThan(0);
	});

	it("garbage input never throws", () => {
		expect(() => parseMinijinjaTag("}}}%#{{")).not.toThrow();
		expect(() => parseMinijinjaTag("")).not.toThrow();
		expect(() => parseMinijinjaTag("{{ @#$%^ }}")).not.toThrow();
	});
});
