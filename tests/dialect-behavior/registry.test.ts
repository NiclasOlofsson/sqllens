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

	it("fold delegates identically to foldIdentifier for every dialect", () => {
		for (const d of DIALECTS) {
			const b = resolveBehavior(d);
			for (const raw of ["Col", '"Col"', "`Col`", "[Col]", "t.Col"]) {
				expect(b.fold(raw)).toBe(foldIdentifier(raw, d));
				expect(b.fold(raw, "table")).toBe(foldIdentifier(raw, d, "table"));
			}
		}
	});

	it("type-inference facets delegate identically to inferDialect", () => {
		for (const d of DIALECTS) {
			const b = resolveBehavior(d);
			const id = inferDialect(d);
			expect(b.division).toBe(id.division);
			expect(b.literal("123")).toEqual(id.literal("123"));
			expect(b.parseType("array<int>")).toEqual(id.parseType("array<int>"));
			expect(b.functions).toBe(id.functions); // same registry object
		}
	});

	it("likeMatch honours SQL `%`/`_` wildcards", () => {
		const b = resolveBehavior("databricks");
		expect(b.likeMatch("%order%", "sales_order_id")).toBe(true);
		expect(b.likeMatch("a_c", "abc")).toBe(true);
		expect(b.likeMatch("a_c", "abbc")).toBe(false);
	});

	it("preserves the unknown-dialect fallback (fold->default, infer->databricks)", () => {
		const b = resolveBehavior("no-such-dialect");
		expect(b.fold('"Col"')).toBe(foldIdentifier('"Col"', "no-such-dialect"));
		expect(b.division).toBe(inferDialect("no-such-dialect").division);
	});
});
