import { describe, expect, it } from "vitest";
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

// The registry is now pure wiring over the ten colocated behaviors (src/<dialect>/behavior.ts). These
// tests prove every dialect resolves to ITS OWN behavior — not a shared default — by checking a
// per-dialect fingerprint (fold direction + division mode) that differs across dialects.
describe("dialect-behavior registry", () => {
	it("has a behavior for every dialect union member, with the full shape", () => {
		for (const d of DIALECTS) {
			const b = resolveBehavior(d);
			expect(b).toBe(BEHAVIORS[d]);
			expect(typeof b.fold).toBe("function");
			expect(typeof b.displayName).toBe("function");
			expect(typeof b.parseType).toBe("function");
			expect(typeof b.literal).toBe("function");
			expect(b.functions).toBeTypeOf("object");
			expect(["float", "integer", "decimal"]).toContain(b.division);
		}
	});

	// Fold DIRECTION is dialect-specific — a resolved behavior must apply its own rule, proving the
	// registry reached the right folder module.
	it("resolves each dialect to its own fold rule", () => {
		expect(resolveBehavior("snowflake").fold("col")).toBe("COL"); // unquoted -> upper
		expect(resolveBehavior("databricks").fold("Col")).toBe("col"); // unquoted -> lower
		expect(resolveBehavior("postgres").fold('"Col"')).toBe("Col"); // quoted -> preserve
		expect(resolveBehavior("bigquery").fold("MyTable", "table")).toBe("MyTable"); // table -> preserve
		expect(resolveBehavior("bigquery").fold("MyCol", "other")).toBe("mycol"); // column -> lower
	});

	// Division mode is a second dialect fingerprint — one field per dialect, all distinct enough to
	// catch a mis-wire.
	it("resolves each dialect to its own division mode", () => {
		const expected: Record<Dialect, "float" | "integer" | "decimal"> = {
			databricks: "float",
			tsql: "integer",
			snowflake: "decimal",
			bigquery: "float",
			redshift: "integer",
			postgres: "integer",
			duckdb: "float",
			trino: "integer",
			sqlite: "integer",
			mysql: "decimal",
		};
		for (const d of DIALECTS) expect(resolveBehavior(d).division).toBe(expected[d]);
	});

	it("likeMatch honours SQL `%`/`_` wildcards", () => {
		const b = resolveBehavior("databricks");
		expect(b.likeMatch("%order%", "sales_order_id")).toBe(true);
		expect(b.likeMatch("a_c", "abc")).toBe(true);
		expect(b.likeMatch("a_c", "abbc")).toBe(false);
	});

	it("throws on an unregistered dialect — sqllens applies no default fallback", () => {
		expect(() => resolveBehavior("no-such-dialect")).toThrow(/no behavior for dialect/);
		expect(() => resolveBehavior(undefined)).toThrow(/no behavior for dialect/);
	});

	it("throws on an inherited Object.prototype key (never reads it off the registry)", () => {
		expect(() => resolveBehavior("constructor")).toThrow(/no behavior for dialect/);
		expect(() => resolveBehavior("toString")).toThrow(/no behavior for dialect/);
	});
});
