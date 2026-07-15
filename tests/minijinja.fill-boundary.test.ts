// Fill fusion boundary (anvil torture-corpus, 2026-07-06): a tag glued to a preceding SQL
// keyword fused with the identifier fill into ONE token — `from{{ ref('x') }}` became
// `fromj0jjj…`, zero errors, NO FROM clause at all (silent misparse, worse than an error).
// The fill now breaks fusion with a leading space when the glued preceding word is a SQL
// clause/operator keyword. `prefix_{{ var('x') }}` gluing is a LEGITIMATE dbt pattern
// (an underscore word is never a keyword) and keeps fusing. The same boundary applies to
// shaped fills: `t{{ m() }}` with a conjunct answer used to fuse to `tAND 1=1`.

import { describe, expect, test } from "vitest";
import { parseTemplated } from "./helpers/templated.js";
import { NamedShapeProvider } from "./helpers/providers.js";

describe("fill fusion boundary", () => {
	test("from{{ ref }} yields a real FROM + relation (the anvil repro)", () => {
		const r = parseTemplated("select order_id\nfrom{{ ref('stg_orders') }}\n", "databricks");
		expect(r.sql.errors).toBe(0);
		const body = r.sql.ast.body as { from: { relation?: { parts: string[] }; template?: object }[] };
		expect(body.from).toHaveLength(1);
		// R3 still binds the real dbt-logical name onto the template-tagged source:
		expect(body.from[0]!.relation?.parts).toEqual(["stg_orders"]);
		expect(body.from[0]!.template).toBeDefined();
	});

	test("join{{ ref }} breaks fusion the same way", () => {
		const r = parseTemplated("select a\nfrom t\njoin{{ ref('u') }} x on t.id = x.id\n", "databricks");
		expect(r.sql.errors).toBe(0);
		const body = r.sql.ast.body as { from: { relation?: { parts: string[] } }[] };
		expect(body.from.map((s) => s.relation?.parts.join("."))).toContain("u");
	});

	test("prefix_{{ var }} keeps fusing — the legitimate glued-identifier pattern", () => {
		const r = parseTemplated("select prefix_{{ var('x') }} from t", "databricks");
		expect(r.sql.errors).toBe(0);
		const body = r.sql.ast.body as { projections: { name?: string }[] };
		expect(body.projections).toHaveLength(1);
		// One fused identifier: the projection's name starts with the literal prefix.
		expect(body.projections[0]!.name?.startsWith("prefix_")).toBe(true);
	});

	test("a shaped fill glued to an operand word breaks fusion too (cAND 1=1 class)", () => {
		// The conjunct slot admits after the operand `c`; unshifted, the fragment fused into
		// `cAND 1=1`. (A conjunct after a bare FROM relation is invalid SQL with or without
		// fusion — dbt breaks there too — so the probe sits in a real WHERE tail.)
		const r = parseTemplated("select a from t where c{{ is_deleted() }}", "databricks", {
			provider: new NamedShapeProvider({ is_deleted: "conjunct" }),
		});
		expect(r.sql.errors).toBe(0);
		expect(r.placeholder).toContain("c AND 1=1");
	});

	test("length and newlines preserved through the boundary space", () => {
		const text = "select order_id\nfrom{{ ref('stg_orders') }}\n";
		const r = parseTemplated(text, "databricks");
		expect(r.placeholder.length).toBe(text.length);
		for (let i = 0; i < text.length; i++) {
			if (text[i] === "\n") expect(r.placeholder[i], `newline @${i}`).toBe("\n");
		}
	});
});
