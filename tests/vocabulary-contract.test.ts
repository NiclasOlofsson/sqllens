import { describe, it, expect } from "vitest";
import { SqlDocument, Schema } from "../src/index.js";
import type { Dialect, SchemaProvider } from "../src/index.js";

// ---------------------------------------------------------------------------
// The vocabulary contract — the engineContract treatment (tests/
// template.engine-contract.test.ts) applied to the union views' column-entry
// vocabulary, extracted on its third recurrence so the fixtures live ONCE:
//
//   - NAMES are fold-normalized, quote-preserving — `foldIdentifier(raw,
//     dialect)` (src/ident/fold.ts), the same identity vocabulary the rest of
//     the resolved surface (scope/qualify/references) speaks. One mixed-case +
//     quoted fixture per distinct fold-RULES shape: lower/lower (duckdb),
//     upper/preserve (snowflake), lower/preserve (postgres) — quote semantics
//     per docs/identifier-delimiter-contract.md.
//   - STAR-EXPANDED columns anchor their span ON the `*` character (the Sym
//     star-expansion wave rule, sqllens 9c87f55) — never the qualifier, never
//     a modifier clause, never synthesized text (src/ir/part-span.ts's
//     starSpanOf).
//
// Any surface that emits `{name, span}` column entries must pass this suite;
// it is invoked at the bottom for `unionOutputColumns` and for `unionCtes`
// (extracting through a wrapping CTE). These bind the vocabulary the way the
// variant-acceptance suite's A1-A8 bind the union logic.
// ---------------------------------------------------------------------------

/** What the contract needs of a column entry: the public name plus offset-addressable span ends
 *  (structurally satisfied by both views' full `Span`s). Spans must index the FIXTURE text as
 *  given — an extractor that embeds the fixture (the wrapping-CTE one below) shifts them back. */
interface NameSpan {
	name: string;
	span: { start: number; end: number };
}

/** The vocabulary contract: any `{name, span}` column-entry surface must pass this suite. */
export function vocabularyContract(
	extract: (sql: string, dialect: Dialect, schema?: SchemaProvider) => readonly NameSpan[],
	label: string,
): void {
	describe(`vocabulary contract: ${label}`, () => {
		describe("fold vocabulary — names are fold-normalized, quote-preserving", () => {
			const SQL = 'select Upper_Col, "Mixed" from t';

			it("lower/lower (duckdb): unquoted mixed-case folds lower, and a quoted name folds lower too", () => {
				expect(extract(SQL, "duckdb").map((c) => c.name)).toEqual(["upper_col", "mixed"]);
			});

			it("upper/preserve (snowflake): unquoted mixed-case folds upper, a quoted name PRESERVES its case", () => {
				expect(extract(SQL, "snowflake").map((c) => c.name)).toEqual(["UPPER_COL", "Mixed"]);
			});

			it("lower/preserve (postgres): unquoted mixed-case folds lower, a quoted name PRESERVES its case", () => {
				expect(extract(SQL, "postgres").map((c) => c.name)).toEqual(["upper_col", "Mixed"]);
			});
		});

		describe("star anchor — star-expanded columns' spans slice to exactly `*`", () => {
			const schema = new Schema({ t: { a: "int", b: "int" } });
			const expectAllOnStar = (sql: string, names: string[]) => {
				const cols = extract(sql, "duckdb", schema);
				expect(cols.map((c) => c.name)).toEqual(names);
				for (const c of cols) expect(sql.slice(c.span.start, c.span.end)).toBe("*");
			};

			it("an unqualified `*` expansion", () => {
				expectAllOnStar("select * from t", ["a", "b"]);
			});

			it("a qualified `t.*` expansion — the `*` character, not the qualifier", () => {
				expectAllOnStar("select t.* from t", ["a", "b"]);
			});

			it("`* REPLACE (a * 2 AS a)` — the projection's own star, not the modifier's `*` operator", () => {
				// REPLACE keeps names and positions (duckdb star.md) AND its expression carries a later
				// `*` (multiplication) in the same star subtree — the adversarial case for the
				// first-star-terminal rule starSpanOf encodes.
				expectAllOnStar("select * replace (a * 2 as a) from t", ["a", "b"]);
			});

			it("a CTE-chain wildcard — a star over a CTE source (anvil's failing shape b)", () => {
				// Schema-free on purpose: the expansion resolves through the CTE's own outputs, not the
				// catalog — the OTHER expansion path from the three schema-fed cases above.
				const sql = "with c as (select a, b from t) select * from c";
				const cols = extract(sql, "duckdb");
				expect(cols.map((c) => c.name)).toEqual(["a", "b"]);
				for (const c of cols) expect(sql.slice(c.span.start, c.span.end)).toBe("*");
			});
		});
	});
}

// ---------------------------------------------------------------------------
// Contract invocations — every `{name, span}` union surface, through its own door.
// ---------------------------------------------------------------------------

vocabularyContract(
	(sql, dialect, schema) => SqlDocument.create(sql, dialect).unionOutputColumns(schema),
	"unionOutputColumns",
);

/** The fixture becomes ONE CTE's body; the entries come from `unionCtes()[0].columns`. The wrapping
 *  prefix is single-line, so shifting `start`/`end` back by its length re-addresses every span into
 *  the fixture's own coordinates (the contract's NameSpan requirement). */
const CTE_PREFIX = "with wrapper_cte as (";
vocabularyContract((sql, dialect, schema) => {
	const doc = SqlDocument.create(`${CTE_PREFIX}${sql}) select 1`, dialect);
	return (doc.unionCtes(schema)[0]?.columns ?? []).map((c) => ({
		name: c.name,
		span: { start: c.span.start - CTE_PREFIX.length, end: c.span.end - CTE_PREFIX.length },
	}));
}, "unionCtes (via a wrapping CTE)");

// ---------------------------------------------------------------------------
// UnionCte.name — the CTE's OWN name speaks the same fold vocabulary as its
// columns (one object, one vocabulary). Not part of vocabularyContract():
// that suite is generic over `{name, span}` column entries; this property is
// specific to the UnionCte record. The unquoted mixed-case name binds the fold
// DIRECTION (displayName would leave `Cte_One` as-written); the quoted one
// binds quote-PRESERVATION (an over-eager lowercase-everything would break it).
// ---------------------------------------------------------------------------

describe("vocabulary contract: UnionCte.name", () => {
	const SQL = 'with Cte_One as (select a from t), "MixedCte" as (select a from t) select 1';

	it("snowflake (upper/preserve): unquoted CTE name folds upper, quoted preserves case", () => {
		expect(
			SqlDocument.create(SQL, "snowflake")
				.unionCtes()
				.map((c) => c.name),
		).toEqual(["CTE_ONE", "MixedCte"]);
	});

	it("postgres (lower/preserve): unquoted CTE name folds lower, quoted preserves case", () => {
		expect(
			SqlDocument.create(SQL, "postgres")
				.unionCtes()
				.map((c) => c.name),
		).toEqual(["cte_one", "MixedCte"]);
	});
});
