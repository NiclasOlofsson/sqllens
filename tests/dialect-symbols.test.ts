import { describe, expect, it } from "vitest";
import { dialectSymbols, dialectVocabulary, reservedKeywords } from "../src/dialect-symbols.js";
import type { Dialect } from "../src/api.js";
import { resolveBehavior } from "../src/dialect-behavior/registry.js";

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
		const registryNames = Object.keys(resolveBehavior(dialect).functions);
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

// dialectVocabulary — the token catalog anvil's token-mapper reads instead of hand tables
// (channel ask 2026-07-19). Names are the dialect's lexer RULE names, verbatim: deliberately
// NOT a cross-dialect standard (postgres calls `::` TYPECAST, databricks DOUBLE_COLON).

describe.each(DIALECTS)("dialectVocabulary(%s)", (dialect) => {
	it("derives non-empty keyword and operator catalogs from the generated lexer", () => {
		const v = dialectVocabulary(dialect);
		expect(v.keywords.size).toBeGreaterThan(100);
		expect(v.operators.size).toBeGreaterThan(5);
		// The NAME is the dialect's own lexer rule name — bigquery says SELECT_SYMBOL,
		// sqlite SELECT_, most others SELECT. Dialect-true, not standardized.
		expect(v.keywords.get("SELECT")?.symbol).toMatch(/^SELECT/);
	});

	it("keyword keys are canonical UPPERCASE; operator keys never match the bare-word shape", () => {
		const v = dialectVocabulary(dialect);
		for (const k of v.keywords.keys()) expect(k).toBe(k.toUpperCase());
		for (const o of v.operators.keys()) expect(/^[A-Z_][A-Z_0-9]*$/i.test(o)).toBe(false);
	});

	it("caches: repeat calls return the identical Map instances", () => {
		expect(dialectVocabulary(dialect).keywords).toBe(dialectVocabulary(dialect).keywords);
	});
});

describe("dialectVocabulary is dialect-TRUE, not a shared table", () => {
	it("pins per-dialect names and per-dialect absences (probe-verified 2026-07-19)", () => {
		expect(dialectVocabulary("databricks").operators.get("::")).toBe("DOUBLE_COLON");
		expect(dialectVocabulary("databricks").operators.get("<=>")).toBe("NSEQ");
		expect(dialectVocabulary("postgres").operators.get("::")).toBe("TYPECAST");
		// Pattern-lexed or absent forms are honestly absent, never invented.
		expect(dialectVocabulary("postgres").operators.get("<=>")).toBeUndefined();
	});
});

// reservedKeywords / KeywordEntry.reserved — the anvil "reserved/soft split" ask (2026-07-22).
// Probe-derived by tools/gen-reserved.ts: `reserved` is true iff the dialect's OWN generated
// parser admits the keyword as neither a bare column reference nor a bare table name (the
// AS-labeled alias slot is excluded — see that tool's header and dialect-symbols.ts's
// `KeywordReservation` doc comment for why). Consumer semantics: membership in `reservedKeywords`
// is the reserved-word lint check; every other keyword keeps ordinary identifier treatment.

describe.each(DIALECTS)("reservedKeywords(%s)", (dialect) => {
	it("is a subset of the dialect's keyword vocabulary, canonical UPPERCASE", () => {
		const reserved = reservedKeywords(dialect);
		const { keywords } = dialectVocabulary(dialect);
		// databricks is a verified, real exception (see the sanity-anchors describe below): this
		// fork's default `SQL_standard_keyword_behavior = false` routes every keyword through the
		// huge `nonReserved` production, so it genuinely has zero reserved keywords.
		if (dialect === "databricks") expect(reserved.size).toBe(0);
		else expect(reserved.size).toBeGreaterThan(0);
		for (const kw of reserved) {
			expect(kw).toBe(kw.toUpperCase());
			expect(keywords.has(kw)).toBe(true);
		}
	});

	it("agrees with the per-keyword KeywordEntry.reserved flag", () => {
		const reserved = reservedKeywords(dialect);
		for (const [kw, entry] of dialectVocabulary(dialect).keywords) {
			expect(reserved.has(kw)).toBe(entry.reserved);
			// reserved is defined as "admitted in neither column nor table position".
			expect(entry.reserved).toBe(!(entry.column || entry.table));
		}
	});

	it("totality: every vocabulary keyword was classified (dialectVocabulary would throw otherwise)", () => {
		expect(dialectVocabulary(dialect).keywords.size).toBe(dialectSymbols(dialect).keywords.size);
	});

	it("caches: repeat calls return the identical Set instance", () => {
		expect(reservedKeywords(dialect)).toBe(reservedKeywords(dialect));
	});
});

describe("reservedKeywords sanity anchors (probe-verified 2026-07-22)", () => {
	it("SELECT is reserved in every dialect except Databricks", () => {
		for (const dialect of DIALECTS) {
			if (dialect === "databricks") continue;
			expect(reservedKeywords(dialect).has("SELECT")).toBe(true);
		}
	});

	it("Databricks is a verified, real exception: SELECT (and FROM) are soft", () => {
		// Not a probe artifact: this fork's grammar defaults `SQL_standard_keyword_behavior = false`
		// (grammars/databricks/DatabricksParser.g4), Spark SQL's documented Hive-compatible default,
		// which routes `identifier` through the huge `nonReserved` production — verified directly by
		// parsing `SELECT a FROM and` and reading back a real table named AND in the lowered IR, not
		// merely a zero-error count. Databricks scores literally zero reserved keywords.
		expect(reservedKeywords("databricks").has("SELECT")).toBe(false);
		expect(reservedKeywords("databricks").has("FROM")).toBe(false);
		expect(reservedKeywords("databricks").size).toBe(0);
	});

	it("postgres FROM is reserved", () => {
		expect(reservedKeywords("postgres").has("FROM")).toBe(true);
	});

	it("snowflake PIVOT/UNPIVOT are soft (the post-source-slot split — SnowflakeParser.g4)", () => {
		expect(reservedKeywords("snowflake").has("PIVOT")).toBe(false);
		expect(reservedKeywords("snowflake").has("UNPIVOT")).toBe(false);
	});

	it("tsql VECTOR is soft — it isn't even a keyword TOKEN (a plain identifier by construction, so it can never appear in reservedKeywords)", () => {
		// TSqlParser.g4's data_type rule reads VECTOR(n, ...) through the generic `id_` identifier
		// rule; only VECTOR_SEARCH is a distinct lexer token. Absence from the vocabulary entirely
		// is the honest strongest form of "soft" — there is no reserved-word question to ask.
		expect(dialectVocabulary("tsql").keywords.has("VECTOR")).toBe(false);
		expect(reservedKeywords("tsql").has("VECTOR")).toBe(false);
	});
});
