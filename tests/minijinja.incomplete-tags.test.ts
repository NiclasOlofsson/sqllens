import { describe, expect, it } from "vitest";
import { parseTemplated } from "../src/minijinja/parse.js";
import type { TagNode } from "../src/minijinja/tag-ast.js";

// REQ1 (anvil 2026-07-13): an UNCLOSED / mid-typing tag (`{{ ref('cu`) still parses to a neutral call
// node so completion can place the caret's arg slot. The parser can't build a complete call node
// without the close paren, so it is recovered from the raw tokens and flagged `incomplete: true`; its
// args are best-effort (a partial string arg has value null, never fabricated).

function firstCall(text: string): Extract<TagNode, { kind: "call" }> {
	const { tags } = parseTemplated(text, "databricks");
	const n = tags[0];
	if (n?.kind !== "call") throw new Error(`expected a call node, got ${n?.kind}`);
	return n;
}

describe("incomplete / mid-typing tag extraction (REQ1)", () => {
	it("{{ ref('cu recovers a ref call, flagged incomplete, partial arg value null", () => {
		const text = "{{ ref('cu";
		const n = firstCall(text);
		expect(n.name).toBe("ref");
		expect(n.incomplete).toBe(true);
		expect(n.args).toHaveLength(1);
		expect(n.args[0].value).toBeNull(); // unterminated string, never fabricated
		// the arg span covers the partial `'cu`, so completion can slice the typed prefix.
		expect(text.slice(n.args[0].span.start, n.args[0].span.end)).toBe("'cu");
	});

	it("{{ ref( is an opened call with no args yet", () => {
		const n = firstCall("{{ ref(");
		expect(n.name).toBe("ref");
		expect(n.incomplete).toBe(true);
		expect(n.args).toHaveLength(0);
	});

	it("{{ source('raw', 'ord: first arg complete, second partial", () => {
		const n = firstCall("{{ source('raw', 'ord");
		expect(n.name).toBe("source");
		expect(n.incomplete).toBe(true);
		expect(n.args.map((a) => a.value)).toEqual(["raw", null]);
	});

	it("a package-qualified partial call keeps its package", () => {
		const n = firstCall("{{ dbt_utils.star('a', ");
		expect(n.name).toBe("star");
		expect(n.packageName).toBe("dbt_utils");
		expect(n.incomplete).toBe(true);
	});

	it("a COMPLETE call is not flagged incomplete", () => {
		const n = firstCall("{{ ref('customers') }}");
		expect(n.name).toBe("ref");
		expect(n.incomplete).toBeUndefined();
		expect(n.args[0].value).toBe("customers");
	});

	it("a bare partial name (no paren) stays 'other'; completion handles that slot, not the tag AST", () => {
		const { tags } = parseTemplated("{{ my_mac", "databricks");
		expect(tags[0].kind).toBe("other");
	});

	it("an incomplete call in a FROM slot is NOT resolved to a real source (mid-typing)", () => {
		const { sql } = parseTemplated("select * from {{ ref('cu", "databricks");
		const body = sql.ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		// The source (if any) carries no template marker at all: an incomplete call is filtered out of
		// the relation tags, so it never names or marks a source (the placeholder name stays, unmarked).
		const src = body.from[0];
		if (src?.kind === "table") {
			expect(src.template).toBeUndefined();
		}
	});

	it("stays total: never throws on a truncated tag", () => {
		expect(() => parseTemplated("select * from {{ ref('cu", "databricks")).not.toThrow();
		expect(() => parseTemplated("{{ source(", "databricks")).not.toThrow();
	});
});
