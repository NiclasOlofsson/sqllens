import { describe, expect, it } from "vitest";
import { dialectSymbols } from "../src/dialect-symbols.js";
import type { Dialect } from "../src/api.js";
import { inferDialect } from "../src/infer/dialect.js";

// dbt Anvil lint-rule membership checks (.superpowers/sdd/anvil-phase0-brief.md item 3):
// "is this identifier a known function / reserved keyword / type name for this dialect?"

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

describe("dialectSymbols — brief smoke examples", () => {
	it("databricks functions has AGGREGATE and EXPLODE", () => {
		const { functions } = dialectSymbols("databricks");
		expect(functions.has("AGGREGATE")).toBe(true);
		expect(functions.has("EXPLODE")).toBe(true);
	});

	it("tsql types has NVARCHAR", () => {
		const { types } = dialectSymbols("tsql");
		expect(types.has("NVARCHAR")).toBe(true);
	});

	it("snowflake keywords has QUALIFY", () => {
		const { keywords } = dialectSymbols("snowflake");
		expect(keywords.has("QUALIFY")).toBe(true);
	});
});

describe.each(DIALECTS)("dialectSymbols(%s)", (dialect) => {
	it("all three sets are nonempty (sqlite: types empty by design)", () => {
		const { functions, keywords, types } = dialectSymbols(dialect);
		expect(functions.size).toBeGreaterThan(0);
		expect(keywords.size).toBeGreaterThan(0);
		if (dialect === "sqlite") {
			// SQLITE_ALIASES is deliberately empty (src/infer/sqlite.ts header): SQLite declared
			// types resolve through the column-affinity SUBSTRING algorithm (datatype3.html §3.1),
			// not a fixed alias table — and the types set is built FROM that table. Pinned at zero
			// so building the affinity feature (or enriching typesFor) fails here and upgrades this.
			expect(types.size).toBe(0);
		} else {
			expect(types.size).toBeGreaterThan(0);
		}
	});

	it("every member of every set is canonical UPPERCASE", () => {
		const { functions, keywords, types } = dialectSymbols(dialect);
		for (const set of [functions, keywords, types]) {
			for (const name of set) {
				expect(name).toBe(name.toUpperCase());
			}
		}
	});

	it("functions is a superset of the dialect's own inference-registry entries", () => {
		const { functions } = dialectSymbols(dialect);
		const registryNames = Object.keys(inferDialect(dialect).functions);
		expect(registryNames.length).toBeGreaterThan(0);
		// Sample a couple rather than every entry (registries run into the hundreds).
		for (const name of registryNames.slice(0, 2)) {
			expect(functions.has(name.toUpperCase())).toBe(true);
		}
	});

	it("caches: repeat calls return the identical Set instances", () => {
		const first = dialectSymbols(dialect);
		const second = dialectSymbols(dialect);
		expect(second.functions).toBe(first.functions);
		expect(second.keywords).toBe(first.keywords);
		expect(second.types).toBe(first.types);
	});
});
