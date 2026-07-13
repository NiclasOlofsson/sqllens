import { describe, expect, it } from "vitest";
import { foldIdentifier } from "../../src/ident/fold.js";
import { inferDialect } from "../../src/infer/dialect.js";
import { BEHAVIORS, resolveBehavior } from "../../src/dialect-behavior/registry.js";
import type { Dialect } from "../../src/dialect.js";

const DIALECTS: Dialect[] = [
	"databricks",
	"tsql",
	"snowflake",
	"bigquery",
	"redshift",
	"postgres",
	"duckdb",
	"trino",
	"sqlite",
	"mysql",
];

describe("dialect-behavior registry", () => {
	it("has a behavior for every dialect union member", () => {
		for (const d of DIALECTS) expect(BEHAVIORS[d]).toBeDefined();
	});

	// Dialects still assembled centrally by makeBehavior — the parity oracles below. As a dialect is
	// colocated into src/<dialect>/ it drops off this list (its central-table entries are gone) and
	// gets its own direct assertion instead.
	const CENTRAL = DIALECTS.filter((d) => d !== "snowflake");

	it("fold delegates identically to foldIdentifier for centrally-assembled dialects", () => {
		for (const d of CENTRAL) {
			const b = resolveBehavior(d);
			for (const raw of ["Col", '"Col"', "`Col`", "[Col]", "t.Col"]) {
				expect(b.fold(raw)).toBe(foldIdentifier(raw, d));
				expect(b.fold(raw, "table")).toBe(foldIdentifier(raw, d, "table"));
			}
		}
	});

	it("type-inference facets delegate identically to inferDialect for centrally-assembled dialects", () => {
		for (const d of CENTRAL) {
			const b = resolveBehavior(d);
			const id = inferDialect(d);
			expect(b.division).toBe(id.division);
			expect(b.literal("123")).toEqual(id.literal("123"));
			expect(b.parseType("array<int>")).toEqual(id.parseType("array<int>"));
			expect(b.functions).toBe(id.functions); // same registry object
		}
	});

	it("snowflake resolves from its colocated module (src/snowflake/)", () => {
		const b = resolveBehavior("snowflake");
		expect(b.fold("col")).toBe("COL"); // snowflake unquoted -> upper
		expect(b.fold('"Col"')).toBe("Col"); // quoted -> preserve
		expect(b.division).toBe("decimal");
		// parseType folds struct field names with snowflake's own (upper) fold
		expect(b.parseType("struct<a:int>")).toEqual({
			kind: "struct",
			fields: [{ name: "A", type: { kind: "scalar", name: "int" } }],
		});
	});

	it("likeMatch honours SQL `%`/`_` wildcards", () => {
		const b = resolveBehavior("databricks");
		expect(b.likeMatch("%order%", "sales_order_id")).toBe(true);
		expect(b.likeMatch("a_c", "abc")).toBe(true);
		expect(b.likeMatch("a_c", "abbc")).toBe(false);
	});

	it("throws on an unregistered dialect — sqllens applies no default fallback", () => {
		expect(() => resolveBehavior("no-such-dialect")).toThrow(/no behavior for dialect/);
	});
});
