// Harvested-signature layer tests — the doc-derived long tail behind the curated table.
//
// tools/harvest-signatures.mjs mines the T-SQL reference markdown (```syntaxsql``` blocks) into the
// committed, generated table src/signature/generated/tsql.ts (surfaced as HARVESTED_SIGNATURES.tsql).
// Lookup order is curated → harvested → name-only fallback, so these assert: the achieved yield is
// pinned as a ratchet, the harvested entries match their docs, a curated entry overrides a harvested
// one of the same name, an unknown name still falls through to the name-only hint, and a
// harvested-only function actually renders through signatureAt().
import { describe, it, expect } from "vitest";
import {
	SqlDocument,
	signatureAt,
	FUNCTION_SIGNATURES,
	HARVESTED_SIGNATURES,
	lookupSignature,
} from "../../src/index.js";

const end = (s: string): number => s.length;

describe("harvested signatures — T-SQL yield floor (ratchet)", () => {
	it("harvests at least 199 T-SQL function signatures from the docs syntax blocks", () => {
		// Pinned at the achieved yield (measured 2026-07-14, after: the ltrim/rtrim prefix-merge, the
		// leading ALL|DISTINCT strip, and widening the scan root to also cover language-elements).
		// A grammar/docs refresh may only raise this. A drop means the harvester regressed and must be
		// investigated, not lowered.
		expect(Object.keys(HARVESTED_SIGNATURES.tsql).length).toBeGreaterThanOrEqual(199);
	});
});

describe("harvested signatures — DuckDB yield floor (ratchet)", () => {
	it("harvests at least 366 DuckDB function signatures from the duckdb-web docs headings", () => {
		// Pinned at the achieved yield (measured 2026-07-14). A docs refresh may only raise this — a
		// drop means the harvester regressed and must be investigated, not lowered.
		expect(Object.keys(HARVESTED_SIGNATURES.duckdb).length).toBeGreaterThanOrEqual(366);
	});
});

describe("harvested signatures — PostgreSQL yield floor (ratchet)", () => {
	it("harvests at least 508 PostgreSQL function signatures from the func.sgml doc", () => {
		// Pinned at the achieved yield (measured 2026-07-14, after: accepting <replaceable> as a type
		// stand-in, the recursive optional-chain peel, and also scanning <synopsis> blocks). A docs
		// refresh may only raise this. A drop means the harvester regressed and must be investigated,
		// not lowered.
		expect(Object.keys(HARVESTED_SIGNATURES.postgres).length).toBeGreaterThanOrEqual(508);
	});
});

describe("harvested signatures: Databricks yield floor (ratchet)", () => {
	it("harvests at least 639 Databricks function signatures from the scraped syntax tier", () => {
		// Pinned at the achieved yield (measured 2026-07-14). A docs refresh may only raise this: a
		// drop means the harvester regressed and must be investigated, not lowered.
		expect(Object.keys(HARVESTED_SIGNATURES.databricks).length).toBeGreaterThanOrEqual(639);
	});
});

describe("harvested signatures: Snowflake yield floor (ratchet)", () => {
	it("harvests at least 516 Snowflake function signatures from the scraped syntax tier", () => {
		// Pinned at the achieved yield (measured 2026-07-14). A docs refresh may only raise this: a
		// drop means the harvester regressed and must be investigated, not lowered.
		expect(Object.keys(HARVESTED_SIGNATURES.snowflake).length).toBeGreaterThanOrEqual(516);
	});
});

describe("harvested signatures: Trino yield floor (ratchet)", () => {
	it("harvests at least 364 Trino function signatures from the MyST function directives", () => {
		// Pinned at the achieved yield (measured 2026-07-14, trino tag 482, after also matching the
		// `:::{js:function}` fence spelling). A docs refresh may only raise this: a drop means the
		// harvester regressed and must be investigated, not lowered.
		expect(Object.keys(HARVESTED_SIGNATURES.trino).length).toBeGreaterThanOrEqual(364);
	});
});

describe("harvested signatures: BigQuery yield floor (ratchet)", () => {
	it("harvests at least 295 BigQuery function signatures from the GoogleSQL reference markdown", () => {
		// Pinned at the achieved yield (measured 2026-07-14). A docs refresh may only raise this: a
		// drop means the harvester regressed and must be investigated, not lowered.
		expect(Object.keys(HARVESTED_SIGNATURES.bigquery).length).toBeGreaterThanOrEqual(295);
	});
});

describe("harvested signatures — doc-verified spot checks", () => {
	it("DATEADD(datepart, number, date) — 3 params, not variadic", () => {
		const sig = HARVESTED_SIGNATURES.tsql.dateadd;
		expect(sig.params.map((p) => p.name)).toEqual(["datepart", "number", "date"]);
		expect(sig.variadic ?? false).toBe(false);
	});

	it("SUBSTRING(expression, start, length) — length optional via the per-product OR-merge", () => {
		// The docs page carries two per-product blocks: length required (SQL Server) and bracketed
		// (Fabric). Same name sequence, so they OR-merge to length-optional instead of conflicting.
		expect(HARVESTED_SIGNATURES.tsql.substring.params).toEqual([
			{ name: "expression" },
			{ name: "start" },
			{ name: "length", optional: true },
		]);
	});

	it("IIF(boolean_expression, true_value, false_value) — 3 params", () => {
		expect(HARVESTED_SIGNATURES.tsql.iif.params.map((p) => p.name)).toEqual([
			"boolean_expression",
			"true_value",
			"false_value",
		]);
	});

	it("GETDATE() — zero-parameter function", () => {
		expect(HARVESTED_SIGNATURES.tsql.getdate.params).toEqual([]);
	});

	it("CONCAT(argument1, argument2, argumentN, …) — variadic", () => {
		const sig = HARVESTED_SIGNATURES.tsql.concat;
		expect(sig.variadic).toBe(true);
		expect(sig.params.at(-1)!.name).toBe("argumentN");
	});

	it("LTRIM(character_expression, characters?): the prefix-merge across pre-2022/2022+ page variants", () => {
		// functions/ltrim-transact-sql.md documents two blocks of different LENGTH (pre-2022 1-arg,
		// 2022+ 2-arg): the prefix-merge widening merges them to the longest with the tail optional.
		const sig = HARVESTED_SIGNATURES.tsql.ltrim;
		expect(sig.params).toEqual([{ name: "character_expression" }, { name: "characters", optional: true }]);
	});

	it("duckdb substring(string, start, length) — length trails as optional", () => {
		// sql/functions/text.md: `substring(string, start, length?)`.
		const sig = HARVESTED_SIGNATURES.duckdb.substring;
		expect(sig.params).toEqual([{ name: "string" }, { name: "start" }, { name: "length", optional: true }]);
	});

	it("postgres char_length(text) — the bare <type> stands in for the name, no type field", () => {
		// func.sgml documents char_length with a bare <type>text</type> and no <parameter>, so the
		// emitted param is named "text" and carries no separate type (never "text: text").
		const sig = HARVESTED_SIGNATURES.postgres.char_length;
		expect(sig.params).toEqual([{ name: "text" }]);
	});

	it("postgres make_interval: all 7 params optional, via the recursive nested-<optional> peel", () => {
		// func.sgml wraps even the FIRST param (years) in the outer <optional> of a 7-deep chain
		// (years [, months [, weeks [, days [, hours [, mins [, secs ]]]]]]); only a recursive descent
		// through the nesting (not a single non-greedy regex pass) unwraps every level.
		const sig = HARVESTED_SIGNATURES.postgres.make_interval;
		expect(sig.params).toEqual([
			{ name: "years", type: "int", optional: true },
			{ name: "months", type: "int", optional: true },
			{ name: "weeks", type: "int", optional: true },
			{ name: "days", type: "int", optional: true },
			{ name: "hours", type: "int", optional: true },
			{ name: "mins", type: "int", optional: true },
			{ name: "secs", type: "double precision", optional: true },
		]);
	});

	it("postgres coalesce(value, ...): variadic, from a <synopsis> block the func_signature scan never sees", () => {
		// func.sgml documents COALESCE only as `<synopsis><function>COALESCE</function>(<replaceable>value</replaceable>
		// <optional>, ...</optional>)</synopsis>`, not inside a <para role="func_signature">.
		const sig = HARVESTED_SIGNATURES.postgres.coalesce;
		expect(sig.params).toEqual([{ name: "value" }]);
		expect(sig.variadic).toBe(true);
	});

	it("databricks date_add(startDate, numDays): 2 params, exact names", () => {
		// databricks/docs/syntax/functions/date_add/1.txt: `date_add(startDate, numDays)`.
		const sig = HARVESTED_SIGNATURES.databricks.date_add;
		expect(sig.params).toEqual([{ name: "startDate" }, { name: "numDays" }]);
	});

	it("snowflake ROUND(input_expr, scale_expr?, rounding_mode?): the quoted-placeholder widening", () => {
		// functions/round/1.txt: `ROUND( <input_expr> [ , <scale_expr> [ , '<rounding_mode>' ] ] )`. The
		// single-quoted rounding_mode placeholder only parses with the quoted-placeholder widening.
		const sig = HARVESTED_SIGNATURES.snowflake.round;
		expect(sig.params).toEqual([
			{ name: "input_expr" },
			{ name: "scale_expr", optional: true },
			{ name: "rounding_mode", optional: true },
		]);
	});

	it("snowflake len: the LENGTH/LEN alias-segment mechanism keeps LEN's own name", () => {
		// functions/length/1.txt holds two blank-line-separated segments, "LENGTH( <expression> )" and
		// "LEN( <expression> )"; each is an independent candidate, so the "len" key's emitted `name`
		// is LEN's own doc line, not LENGTH's.
		const sig = HARVESTED_SIGNATURES.snowflake.len;
		expect(sig.name).toBe("LEN");
		expect(sig.params).toEqual([{ name: "expression" }]);
	});

	it("trino date_add(unit, value, timestamp): 3 params, exact names", () => {
		// datetime.md: `:::{function} date_add(unit, value, timestamp) -> [same as input]`.
		const sig = HARVESTED_SIGNATURES.trino.date_add;
		expect(sig.params).toEqual([{ name: "unit" }, { name: "value" }, { name: "timestamp" }]);
	});

	it("trino date_parse(string, format): the lone :::{js:function} fence spelling", () => {
		// datetime.md:437 is `:::{js:function} date_parse(string, format) → timestamp(3)`, the only
		// js:function-fenced directive in the corpus, and its return arrow is a literal "→" (U+2192)
		// rather than the usual ASCII "->".
		const sig = HARVESTED_SIGNATURES.trino.date_parse;
		expect(sig.params).toEqual([{ name: "string" }, { name: "format" }]);
	});

	it("trino ST_Point(lon: double, lat: double): typed colon-pair params, mixed-case display name", () => {
		// geospatial.md: `:::{function} ST_Point(lon: double, lat: double) -> Point`. The colon pair
		// keeps the documented type, and the doc's mixed casing is the display name (key lowercased).
		const sig = HARVESTED_SIGNATURES.trino.st_point;
		expect(sig.name).toBe("ST_Point");
		expect(sig.params).toEqual([
			{ name: "lon", type: "double" },
			{ name: "lat", type: "double" },
		]);
	});

	it("bigquery ROUND(X [, N [, rounding_mode]]): X required, N and rounding_mode optional", () => {
		// mathematical_functions.md's nested bracket chain.
		const sig = HARVESTED_SIGNATURES.bigquery.round;
		expect(sig.params).toEqual([
			{ name: "X" },
			{ name: "N", optional: true },
			{ name: "rounding_mode", optional: true },
		]);
	});

	it("bigquery PARSE_DATE(format_string, date_string): 2 params, exact names", () => {
		// date_functions.md: `PARSE_DATE(format_string, date_string)`.
		const sig = HARVESTED_SIGNATURES.bigquery.parse_date;
		expect(sig.params).toEqual([{ name: "format_string" }, { name: "date_string" }]);
	});
});

describe("harvested signatures: typed-overload conflicts stay unmerged", () => {
	it("trino length is undefined: length(binary) vs length(string) tie at arity 1 with different types", () => {
		// binary.md and string.md each document their own length(); the merge rule compares types
		// (and here even the bare-type display names differ), so nothing is emitted, never a guess.
		expect(HARVESTED_SIGNATURES.trino.length).toBeUndefined();
	});
});

describe("harvested signatures: operator blocklist", () => {
	it("databricks IN is dropped: its function-call-shaped `in ( elem, expr1 [, ...] )` doc page parses cleanly but IN is a predicate keyword, not a function", () => {
		expect(HARVESTED_SIGNATURES.databricks.in).toBeUndefined();
	});
});

describe("harvested signatures — lookup precedence", () => {
	it("curated wins over harvested for a name present in both", () => {
		// DATEADD is curated (with a typed `number: int` param) AND harvested (names only). lookup must
		// return the curated object — the one that carries types.
		const resolved = lookupSignature("tsql", "dateadd");
		expect(resolved).toBe(FUNCTION_SIGNATURES.tsql.dateadd);
		expect(resolved!.params[1]).toMatchObject({ name: "number", type: "int" });
		// Sanity: the harvested twin exists and is the untyped one, so this is a real override.
		expect(HARVESTED_SIGNATURES.tsql.dateadd.params[1].type).toBeUndefined();
	});

	it("harvested is used when there is no curated entry for the name", () => {
		expect(FUNCTION_SIGNATURES.tsql.translate).toBeUndefined(); // not curated
		expect(lookupSignature("tsql", "translate")).toBe(HARVESTED_SIGNATURES.tsql.translate);
	});

	it("duckdb lookupSignature reaches a harvested-only entry (list_min, not curated)", () => {
		expect(FUNCTION_SIGNATURES.duckdb.list_min).toBeUndefined(); // not curated
		expect(lookupSignature("duckdb", "list_min")).toBe(HARVESTED_SIGNATURES.duckdb.list_min);
		expect(lookupSignature("duckdb", "list_min")).toEqual({ name: "list_min", params: [{ name: "list" }] });
	});
});

describe("harvested signatures — fallback unchanged for unknown names", () => {
	it("an unknown name resolves to no signature (name-only fallback territory)", () => {
		expect(lookupSignature("tsql", "no_such_function_xyz")).toBeUndefined();
	});

	it("signatureAt still gives a name-only hint for an unknown call", () => {
		const text = "SELECT no_such_function_xyz(a, ";
		const doc = SqlDocument.create(text, "tsql");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		expect(info!.label).toBe("no_such_function_xyz");
		expect(info!.parameters).toEqual([]);
		expect(info!.activeParameter).toBe(1);
	});
});

describe("harvested signatures — reach signatureAt for harvested-only functions", () => {
	it("TRANSLATE(inputString, characters, translations): harvested layer renders full params", () => {
		const text = "SELECT TRANSLATE(a, b, ";
		const doc = SqlDocument.create(text, "tsql");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		expect(info!.label.toLowerCase()).toContain("translate");
		expect(info!.parameters.length).toBe(3); // proves the harvested table, not the name-only fallback
		expect(info!.activeParameter).toBe(2);
	});
});
