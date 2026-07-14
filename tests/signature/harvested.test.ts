// Harvested-signature layer tests: the doc-derived long tail behind the merged per-dialect
// SIGNATURES table.
//
// tools/harvest-signatures.mjs mines each dialect's reference docs into a committed, generated table
// (src/<dialect>/signatures.generated.ts) and folds a curated override layer (tools/signature-
// overrides/<dialect>.mjs) over it: an override wins by key (replacing the WHOLE overload set), and
// every overload carries `origin: "curated" | "harvested"` recording which layer produced it (uniform
// within one name's set). SIGNATURES[dialect] is already the merged table; there is no separate
// curated/harvested lookup step left at runtime. A name maps to an ORDERED overload SET
// (readonly FnSignature[]), not a single shape.
//
// These tests assert: the harvested-origin yield per dialect is pinned as a ratchet (a floor, never
// silently lowered), harvested entries match their docs, an override wins over a harvested entry of
// the same name (origin flips to "curated"), an unknown name still falls through to the name-only
// hint, a harvested-only function actually renders through signatureAt(), and a name whose documented
// forms don't collapse to one shape survives as a real multi-overload set instead of being dropped.
import { describe, it, expect } from "vitest";
import { SqlDocument, signatureAt, SIGNATURES, lookupSignature } from "../../src/index.js";

const end = (s: string): number => s.length;

function harvestedCount(dialect: keyof typeof SIGNATURES): number {
	// origin is uniform across one name's whole overload set (an override always replaces the entire
	// set), so the first overload's origin speaks for the set.
	return Object.values(SIGNATURES[dialect]).filter((overloads) => overloads[0]?.origin === "harvested").length;
}

// Floors are pinned on the MERGED table's origin: "harvested" count, not the harvester's raw
// pre-merge yield: a curated override that shadows an already-harvested name flips that entry's
// origin to "curated", which legitimately lowers the harvested-origin count below the harvester's
// raw yield. Re-measured 2026-07-14 against the overload-aware model (tools/harvest-signatures.mjs's
// old conflict-drop became clusterOverloads): every dialect's former whole-name conflicts now emit as
// real overload sets, so most floors rose; a future drop below these floors means the harvester
// regressed and must be investigated, not lowered.

describe("harvested signatures — T-SQL yield floor (ratchet)", () => {
	it("at least 198 T-SQL entries carry origin harvested", () => {
		// 167 -> 176 on 2026-07-14: the override-pruning pass deleted 8 redundant overrides (replace,
		// ltrim, rtrim, isnull, coalesce, min, max, string_agg - each byte-identical to the harvest
		// alone) plus 1 richer-harvest-hidden override (format), flipping their origin back to harvested.
		// 176 -> 198 later the same day: the per-line call-candidate widening (every syntaxsql line in a
		// block is now its own candidate, not just the block's first) recovered SET_BIT's 3-arg form,
		// then the second override-pruning pass deleted 22 more overrides (dateadd, datediff, datepart,
		// datename, datefromparts, eomonth, substring, charindex, left, right, stuff, iif, round, abs,
		// ceiling, floor, power, sum, avg, set_bit - typed-duplicates - plus concat, concat_ws - richer
		// harvest, the docs' own argumentN slot matches the hand-fixed minimum arity), flipping their
		// origin back to harvested.
		expect(harvestedCount("tsql")).toBeGreaterThanOrEqual(198);
	});
});

describe("harvested signatures — DuckDB yield floor (ratchet)", () => {
	it("at least 405 DuckDB entries carry origin harvested", () => {
		// 327 -> 359 on 2026-07-14: the overload-aware model turns former whole-name conflicts (length,
		// bit_count, hex, md5, generate_series, make_timestamp, ...) into real 2+-overload data.
		// 359 -> 373 later the same day: the override-pruning pass deleted 5 redundant overrides
		// (concat, coalesce, nullif, ifnull, count) plus 9 richer-harvest-hidden overrides (date_part,
		// date_diff, date_sub, date_trunc, strftime, regexp_replace, regexp_extract, regexp_matches,
		// contains), flipping their origin back to harvested.
		// 373 -> 405 later the same day: the typed-duplicate re-prune (no DuckDB extractor change this
		// round) deleted 32 more overrides - 31 typed-duplicates (date_add, strptime, make_date,
		// substring, split_part, replace, lpad, rpad, left, right, starts_with, printf, format, round,
		// trunc, abs, ceil, floor, power, list_extract, list_contains, array_to_string, unnest, sum, avg,
		// min, max, arg_max, arg_min, string_agg, quantile_cont) plus time_bucket (richer harvest: 7 real
		// per-type overloads now subsume the hand shape) - flipping their origin back to harvested.
		expect(harvestedCount("duckdb")).toBeGreaterThanOrEqual(405);
	});
});

describe("harvested signatures — PostgreSQL yield floor (ratchet)", () => {
	it("at least 585 PostgreSQL entries carry origin harvested", () => {
		// 477 -> 547 on 2026-07-14: type-based overloads (lower(text) vs lower(anyrange), length's six
		// type forms, round/trunc/log's numeric vs double precision forms, ...) now emit as overload
		// sets instead of being dropped as conflicts.
		// 547 -> 573 later the same day: the override-pruning pass deleted 13 redundant overrides
		// (make_date, make_interval, replace, regexp_match, strpos, string_to_array, div, coalesce,
		// nullif, greatest, least, string_agg, jsonb_set) plus 13 richer-harvest-hidden overrides (age,
		// date_trunc, date_part, to_timestamp, to_char, round, trunc, ceil, floor, power, width_bucket,
		// sum, avg), flipping their origin back to harvested.
		// 573 -> 585 later the same day: the typed-duplicate re-prune (no PostgreSQL extractor change
		// this round) deleted 12 more overrides - 8 typed-duplicates (split_part, lpad, rpad, left,
		// right, format, mod, jsonb_extract_path) plus 4 richer-harvest-hidden overrides (substr - the
		// harvest adds a real bytea overload; regexp_replace - the harvest adds a start/N/flags
		// overload; concat/concat_ws - the harvest reaches the same pg_proc-cited minimum arity on its
		// own) - flipping their origin back to harvested.
		expect(harvestedCount("postgres")).toBeGreaterThanOrEqual(585);
	});
});

describe("harvested signatures: Databricks yield floor (ratchet)", () => {
	it("at least 652 Databricks entries carry origin harvested", () => {
		// 599 -> 603 on 2026-07-14: ai_extract, element_at, format_number and try_element_at's own
		// multi-shape doc pages now emit as overload sets.
		// 603 -> 608 later the same day: the override-pruning pass deleted 5 redundant overrides (nvl,
		// nullif, count, min, max - each byte-identical to the harvest alone), flipping their origin
		// back to harvested.
		// 608 -> 653 later the same day: the per-block same-name-repeat widening (a call line's own
		// trailing content, or a further same-name call line, no longer sinks candidates already found
		// earlier in the block) recovered many previously all-or-nothing-discarded candidates (trim's
		// bare 1-arg form, several aggregate FILTER-clause pages, ...), then the typed-duplicate re-prune
		// deleted 22 more overrides - 18 typed-duplicates (date_trunc, trunc, to_date, to_timestamp,
		// date_format, add_months, split, replace, regexp_replace, regexp_extract, round, abs, ceil,
		// floor, power, mod, sum, avg) plus 4 richer-harvest-hidden overrides (date_add, dateadd,
		// datediff - the harvest now independently recovers both the unit-based and alias forms as
		// separate overloads; concat - the harvest reaches the same minimum-arity reading on its own) -
		// flipping their origin back to harvested.
		// 653 -> 652 later the same day: abs was RESTORED as a curated override (tests/qualify.calls.
		// test.ts's "Databricks still flags a boolean arg into a numeric param" proved the operand-type
		// checker only trusts a curated-origin signature, so the typed-duplicate deletion silently
		// disabled that diagnostic).
		expect(harvestedCount("databricks")).toBeGreaterThanOrEqual(652);
	});
});

describe("harvested signatures: Snowflake yield floor (ratchet)", () => {
	it("at least 526 Snowflake entries carry origin harvested", () => {
		// 501 -> 510 on 2026-07-14: the override-pruning pass deleted 9 redundant overrides (datediff,
		// date_trunc, coalesce, nvl, ifnull, nullif, count, min, max - each byte-identical to the
		// harvest alone), flipping their origin back to harvested.
		// 510 -> 526 later the same day: the per-segment same-name-repeat widening (every call-shaped
		// line in a blank-line-separated segment is now its own candidate, not just the segment's
		// first) recovered to_char's/to_varchar's four per-type overloads and ai_count_tokens's four
		// generic-arity overloads, then the typed-duplicate re-prune deleted 15 more overrides - 9
		// typed-duplicates (dateadd, replace, trim, regexp_replace, iff, round, ceil, floor, mod) plus 6
		// richer-harvest-hidden overrides (to_date, concat, concat_ws, to_char, to_varchar,
		// ai_count_tokens) - flipping their origin back to harvested.
		expect(harvestedCount("snowflake")).toBeGreaterThanOrEqual(526);
	});
});

describe("harvested signatures: Trino yield floor (ratchet)", () => {
	it("at least 381 Trino entries carry origin harvested", () => {
		// 334 -> 347 on 2026-07-14: type-based overloads (length(binary) vs length(string), avg/merge/
		// cardinality's typed forms, ...) now emit as overload sets instead of being dropped.
		// 347 -> 354 later the same day: the override-pruning pass deleted 7 richer-harvest-hidden
		// overrides (from_unixtime, substr, lpad, rpad, avg, approx_percentile, regexp_replace),
		// flipping their origin back to harvested.
		// 354 -> 381 later the same day: the typed-duplicate re-prune (no Trino extractor change this
		// round) deleted 27 more overrides, all typed-duplicates (date_trunc, date_add, date_diff,
		// date_format, date_parse, split, split_part, strpos, replace, format, regexp_like,
		// regexp_extract, json_extract, json_extract_scalar, json_parse, array_join, sequence, count,
		// sum, min, max, max_by, min_by, approx_distinct, coalesce, nullif, if), flipping their origin
		// back to harvested.
		expect(harvestedCount("trino")).toBeGreaterThanOrEqual(381);
	});
});

describe("harvested signatures: BigQuery yield floor (ratchet)", () => {
	it("at least 328 BigQuery entries carry origin harvested", () => {
		// 293 -> 291 on 2026-07-14, same day: json_extract and json_query gained curated overrides
		// (the corpus proves json_path is really optional, which the doc's own syntax fence doesn't
		// show), flipping those two names' origin from harvested to curated: a legitimate drop, not a
		// regression, per this file's own header note.
		// 291 -> 295 later the same day: the override-pruning pass deleted 3 redundant overrides
		// (coalesce, ifnull, nullif) plus 1 richer-harvest-hidden override (date_trunc), flipping their
		// origin back to harvested.
		// 295 -> 329 later the same day: the same-fence same-name-repeat fix (a candidate line's own
		// trailing content, or a further same-name call line, no longer discards EVERY candidate
		// already found in the fence - the same all-or-nothing bug fixed in the Databricks extractor)
		// recovered many previously all-or-nothing-discarded candidates, then the typed-duplicate
		// re-prune deleted 19 more overrides (date_diff, timestamp_diff, parse_date, format_date,
		// substr, substring, split, replace, lpad, rpad, regexp_replace, regexp_extract, if, round, abs,
		// ceil, floor, power, mod), flipping their origin back to harvested.
		// 329 -> 328 later the same day: abs was RESTORED as a curated override (tests/qualify.calls.
		// test.ts's "BigQuery flags ABS('x')" proved the operand-type checker only trusts a
		// curated-origin signature, so the typed-duplicate deletion silently disabled that diagnostic).
		expect(harvestedCount("bigquery")).toBeGreaterThanOrEqual(328);
	});
});

describe("harvested signatures: Redshift yield floor (ratchet)", () => {
	it("at least 294 Redshift entries carry origin harvested", () => {
		// First pinned 2026-07-14, the day Redshift joined the harvested dialects (its own syntax tier
		// at redshift/docs/syntax, captured by tools/scrape-redshift-syntax.mjs, mined by the new
		// Redshift extractor): 298 raw harvested names, 4 of them shadowed by surviving curated
		// overrides - concat, split_part (hand-authored param names differ from the harvest) plus
		// rtrim, st_collect (safety-valve entries the corpus gate forced the same day: the doc's own
		// Syntax lines under-document them, and the doc corpus's 1-arg calls proved it).
		expect(harvestedCount("redshift")).toBeGreaterThanOrEqual(294);
	});
});

describe("harvested signatures: MySQL yield floor (ratchet)", () => {
	it("at least 241 MySQL entries carry origin harvested", () => {
		// First pinned 2026-07-14, the day MySQL joined the harvested dialects (its own syntax tier at
		// mysql/docs/syntax, captured by tools/capture-mysql-syntax.mjs, one documented call form per
		// line): 242 raw harvested names (including INTERVAL(N,N1,N2,...), the real comparison
		// function the operator blocklist exempts for this dialect), 1 shadowed by a surviving curated
		// override (strcmp - hand-authored param names differ from the harvest).
		expect(harvestedCount("mysql")).toBeGreaterThanOrEqual(241);
	});
});

describe("harvested signatures: SQLite yield floor (ratchet)", () => {
	it("at least 112 SQLite entries carry origin harvested", () => {
		// First pinned 2026-07-14, the day SQLite joined the harvested dialects (its own syntax tier
		// at sqlite/docs/syntax, captured by tools/capture-sqlite-syntax.mjs, one call phrase per
		// file): 116 raw harvested names, 4 shadowed by surviving curated overrides (glob, like,
		// printf, iif - hand-authored param names beat the doc's X/Y/Z placeholders).
		expect(harvestedCount("sqlite")).toBeGreaterThanOrEqual(112);
	});
});

describe("harvested signatures: doc-verified spot checks (single-overload names)", () => {
	it("DATEADD(datepart, number, date) — 3 params, not variadic, origin harvested (its own typed override was a typed-duplicate, deleted 2026-07-14)", () => {
		const overloads = SIGNATURES.tsql.dateadd;
		expect(overloads.length).toBe(1);
		expect(overloads[0].origin).toBe("harvested");
		expect(overloads[0].params.map((p) => p.name)).toEqual(["datepart", "number", "date"]);
		expect(overloads[0].variadic ?? false).toBe(false);
	});

	it("SUBSTRING(expression, start, length) — length optional, origin harvested (its own typed override was a typed-duplicate, deleted 2026-07-14)", () => {
		const overloads = SIGNATURES.tsql.substring;
		expect(overloads.length).toBe(1);
		expect(overloads[0].origin).toBe("harvested");
		expect(overloads[0].params).toEqual([
			{ name: "expression" },
			{ name: "start" },
			{ name: "length", optional: true },
		]);
	});

	it("IIF(boolean_expression, true_value, false_value) — 3 params", () => {
		expect(SIGNATURES.tsql.iif[0].params.map((p) => p.name)).toEqual([
			"boolean_expression",
			"true_value",
			"false_value",
		]);
	});

	it("GETDATE() — zero-parameter function, origin harvested", () => {
		expect(SIGNATURES.tsql.getdate[0].params).toEqual([]);
		expect(SIGNATURES.tsql.getdate[0].origin).toBe("harvested");
	});

	it("CONCAT(argument1, argument2, argumentN?): requires 2 args minimum, origin harvested (its own curated fix is now what the harvest reaches on its own)", () => {
		// learn.microsoft.com/.../concat-transact-sql: "CONCAT ( argument1 , argument2 [ , argumentN ] ) ...
		// requires at least two arguments". The curated override used to exist because the pre-widening
		// harvested-only shape had a single required param, under-counting the minimum arity; deleted
		// 2026-07-14 once the harvest itself reached the same 2-arg floor (argument1/argument2 required,
		// argumentN optional, still variadic).
		const sig = SIGNATURES.tsql.concat[0];
		expect(sig.origin).toBe("harvested");
		expect(sig.variadic).toBe(true);
		expect(sig.params).toEqual([
			{ name: "argument1" },
			{ name: "argument2" },
			{ name: "argumentN", optional: true },
		]);
	});

	it("LTRIM(character_expression, characters?): harvested origin, via the harvest's own prefix-merge", () => {
		// functions/ltrim-transact-sql.md documents two blocks of different LENGTH (pre-2022 1-arg,
		// 2022+ 2-arg); the harvest's prefix-merge widening produces this exact shape on its own. The
		// override that used to duplicate it was deleted 2026-07-14 (redundancy-report candidate,
		// override-pruning pass), so this is now purely harvested.
		const sig = SIGNATURES.tsql.ltrim[0];
		expect(sig.origin).toBe("harvested");
		expect(sig.params).toEqual([{ name: "character_expression" }, { name: "characters", optional: true }]);
	});

	it("duckdb substring(string, start, length) — length optional, origin harvested (its own typed override was a typed-duplicate, deleted 2026-07-14)", () => {
		const sig = SIGNATURES.duckdb.substring[0];
		expect(sig.origin).toBe("harvested");
		expect(sig.params).toEqual([{ name: "string" }, { name: "start" }, { name: "length", optional: true }]);
	});

	it("postgres char_length(text) — the bare <type> stands in for the name, no type field", () => {
		// func.sgml documents char_length with a bare <type>text</type> and no <parameter>, so the
		// emitted param is named "text" and carries no separate type (never "text: text").
		const overloads = SIGNATURES.postgres.char_length;
		expect(overloads.length).toBe(1);
		expect(overloads[0].params).toEqual([{ name: "text" }]);
		expect(overloads[0].origin).toBe("harvested");
	});

	it("postgres make_interval: all 7 params optional, via the recursive nested-<optional> peel", () => {
		// func.sgml wraps even the FIRST param (years) in the outer <optional> of a 7-deep chain
		// (years [, months [, weeks [, days [, hours [, mins [, secs ]]]]]]); only a recursive descent
		// through the nesting (not a single non-greedy regex pass) unwraps every level. The override that
		// used to duplicate this shape was deleted 2026-07-14 (redundancy-report candidate,
		// override-pruning pass), so this is now purely harvested.
		const sig = SIGNATURES.postgres.make_interval[0];
		expect(sig.origin).toBe("harvested");
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

	it("postgres coalesce(value, ...): variadic, harvested origin, found in a <synopsis> block", () => {
		// func.sgml documents COALESCE only as `<synopsis><function>COALESCE</function>(<replaceable>value</replaceable>
		// <optional>, ...</optional>)</synopsis>`, not inside a <para role="func_signature">. The override
		// that used to duplicate this shape was deleted 2026-07-14 (redundancy-report candidate,
		// override-pruning pass), so this is now purely harvested.
		const sig = SIGNATURES.postgres.coalesce[0];
		expect(sig.origin).toBe("harvested");
		expect(sig.params).toEqual([{ name: "value" }]);
		expect(sig.variadic).toBe(true);
	});

	it("databricks date_add: 2 overloads, origin harvested (its own curated override was deleted 2026-07-14 - the per-block same-name-repeat widening now recovers BOTH the unit-based 3-arg page and the 2-arg startDate/numDays alias page on its own)", () => {
		const overloads = SIGNATURES.databricks.date_add;
		expect(overloads.length).toBe(2);
		expect(overloads.every((o) => o.origin === "harvested")).toBe(true);
		expect(overloads[0].params).toEqual([{ name: "unit" }, { name: "value" }, { name: "expr" }]);
		expect(overloads[1].params).toEqual([{ name: "startDate" }, { name: "numDays" }]);
	});

	it("snowflake ROUND(input_expr, scale_expr?, rounding_mode?): origin harvested (its own typed override was a typed-duplicate, deleted 2026-07-14)", () => {
		// functions/round/1.txt: `ROUND( <input_expr> [ , <scale_expr> [ , '<rounding_mode>' ] ] )`. The
		// harvest's quoted-placeholder widening finds this exact shape on its own; the curated override
		// only ever added types on top, so it was pruned once that became the sole contribution.
		const sig = SIGNATURES.snowflake.round[0];
		expect(sig.origin).toBe("harvested");
		expect(sig.params).toEqual([
			{ name: "input_expr" },
			{ name: "scale_expr", optional: true },
			{ name: "rounding_mode", optional: true },
		]);
	});

	it("snowflake len: the LENGTH/LEN alias-segment mechanism keeps LEN's own name, origin harvested", () => {
		// functions/length/1.txt holds two blank-line-separated segments, "LENGTH( <expression> )" and
		// "LEN( <expression> )"; each is an independent candidate, so the "len" key's emitted `name`
		// is LEN's own doc line, not LENGTH's.
		const overloads = SIGNATURES.snowflake.len;
		expect(overloads.length).toBe(1);
		expect(overloads[0].name).toBe("LEN");
		expect(overloads[0].params).toEqual([{ name: "expression" }]);
		expect(overloads[0].origin).toBe("harvested");
	});

	it("trino date_add(unit, value, timestamp): origin harvested (its own typed override was a typed-duplicate, deleted 2026-07-14)", () => {
		const sig = SIGNATURES.trino.date_add[0];
		expect(sig.origin).toBe("harvested");
		expect(sig.params).toEqual([{ name: "unit" }, { name: "value" }, { name: "timestamp" }]);
	});

	it("trino date_parse(string, format): origin harvested via the lone :::{js:function} fence spelling (its own typed override was a typed-duplicate, deleted 2026-07-14)", () => {
		// datetime.md:437 is `:::{js:function} date_parse(string, format) -> timestamp(3)`, the only
		// js:function-fenced directive in the corpus, and its return arrow is a literal U+2192 rather
		// than the usual ASCII "->".
		const sig = SIGNATURES.trino.date_parse[0];
		expect(sig.origin).toBe("harvested");
		expect(sig.params).toEqual([{ name: "string" }, { name: "format" }]);
	});

	it("trino ST_Point(lon: double, lat: double): typed colon-pair params, mixed-case display name, origin harvested", () => {
		// geospatial.md: `:::{function} ST_Point(lon: double, lat: double) -> Point`. The colon pair
		// keeps the documented type, and the doc's mixed casing is the display name (key lowercased).
		const overloads = SIGNATURES.trino.st_point;
		expect(overloads.length).toBe(1);
		expect(overloads[0].name).toBe("ST_Point");
		expect(overloads[0].origin).toBe("harvested");
		expect(overloads[0].params).toEqual([
			{ name: "lon", type: "double" },
			{ name: "lat", type: "double" },
		]);
	});

	it("bigquery ROUND(X [, N [, rounding_mode]]): origin harvested via the untyped bracket chain (its own typed override was a typed-duplicate, deleted 2026-07-14)", () => {
		const sig = SIGNATURES.bigquery.round[0];
		expect(sig.origin).toBe("harvested");
		expect(sig.params).toEqual([
			{ name: "X" },
			{ name: "N", optional: true },
			{ name: "rounding_mode", optional: true },
		]);
	});

	it("bigquery PARSE_DATE(format_string, date_string): origin harvested (its own typed override was a typed-duplicate, deleted 2026-07-14)", () => {
		const sig = SIGNATURES.bigquery.parse_date[0];
		expect(sig.origin).toBe("harvested");
		expect(sig.params).toEqual([{ name: "format_string" }, { name: "date_string" }]);
	});
});

describe("harvested signatures: overload sets (formerly whole-name conflicts, now real data)", () => {
	it("postgres lower(...): 3 overloads by argument TYPE (text, anyrange, anymultirange), none merged", () => {
		// func.sgml documents lower(text), lower(anyrange) and lower(anymultirange) as three separate,
		// same-arity forms: PostgreSQL overloads by argument type, not just count. Nothing merges (no
		// prefix relation between same-length, different-type shapes), so all three survive.
		const overloads = SIGNATURES.postgres.lower;
		expect(overloads.length).toBe(3);
		expect(overloads.every((o) => o.origin === "harvested")).toBe(true);
		expect(overloads.map((o) => o.params[0].name).sort()).toEqual(["anymultirange", "anyrange", "text"]);
	});

	it("postgres length(...): 6 overloads (5 single-type forms plus a 2-arg bytes+encoding form)", () => {
		const overloads = SIGNATURES.postgres.length;
		expect(overloads.length).toBe(6);
		const arities = overloads.map((o) => o.params.length).sort();
		expect(arities).toEqual([1, 1, 1, 1, 1, 2]);
	});

	it("trino length(...): 2 overloads, length(binary) vs length(string), tied at arity 1 with different types", () => {
		// binary.md and string.md each document their own length(); the merge rule compares types (and
		// here even the bare-type display names differ), so this used to be dropped as a conflict:
		// now both survive as separate overloads instead.
		const overloads = SIGNATURES.trino.length;
		expect(overloads.length).toBe(2);
		expect(overloads.map((o) => o.params[0].name).sort()).toEqual(["binary", "string"]);
	});

	it("duckdb length(...): 3 overloads (bitstring, list, string), documented on three separate pages", () => {
		const overloads = SIGNATURES.duckdb.length;
		expect(overloads.length).toBe(3);
		expect(overloads.map((o) => o.params[0].name).sort()).toEqual(["bitstring", "list", "string"]);
	});

	it("databricks decode(...): un-suppressed as 2 non-overlapping overloads (2-arg charset form, 3+-arg variadic conditional form)", () => {
		// Previously suppress:true (two non-mergeable builtins share the name). Their arities never
		// collide (exactly 2 vs 3 or more), so both now coexist as curated overloads.
		const overloads = SIGNATURES.databricks.decode;
		expect(overloads.length).toBe(2);
		expect(overloads.every((o) => o.origin === "curated")).toBe(true);
		expect(overloads.some((o) => !o.variadic && o.params.length === 2)).toBe(true);
		expect(overloads.some((o) => o.variadic && o.params.length === 3)).toBe(true);
	});

	it("snowflake ai_count_tokens(...): 4 generic arity-form overloads, origin harvested (its own curated override was deleted 2026-07-14 - the per-segment same-name-repeat widening now recovers all four generic forms on its own, just in a different order)", () => {
		const overloads = SIGNATURES.snowflake.ai_count_tokens;
		expect(overloads.length).toBe(4);
		expect(overloads.every((o) => o.origin === "harvested")).toBe(true);
	});

	it("snowflake object_pick(...): un-suppressed as 2 overloads (variadic keys form, single-array form)", () => {
		const overloads = SIGNATURES.snowflake.object_pick;
		expect(overloads.length).toBe(2);
		expect(overloads.some((o) => o.variadic)).toBe(true);
		expect(overloads.some((o) => !o.variadic && o.params.length === 2)).toBe(true);
	});

	it("snowflake timestamp_from_parts(...): un-suppressed as 2 overloads (6-8 arg parts form, 2-arg date+time form)", () => {
		const overloads = SIGNATURES.snowflake.timestamp_from_parts;
		expect(overloads.length).toBe(2);
		// params.length counts the 2 trailing optionals too (8 total: 6 required + nanosecond + time_zone).
		expect(overloads.map((o) => o.params.length).sort((a, b) => a - b)).toEqual([2, 8]);
	});

	it("sqlite log(...): 2 overloads (log(B,X) / log(X)), origin harvested - the leading-optional case the old hand table refused to encode", () => {
		// lang_mathfunc documents log(B,X) and log(X), which disagree on argument ORDER, not just a
		// trailing-optional count; the pre-overload hand table deliberately left log uncurated rather
		// than assert a wrong arity for one form. The overload-set model represents exactly this.
		const overloads = SIGNATURES.sqlite.log;
		expect(overloads.length).toBe(2);
		expect(overloads.every((o) => o.origin === "harvested")).toBe(true);
		expect(overloads.map((o) => o.params.map((p) => p.name).join(",")).sort()).toEqual(["B,X", "X"]);
	});

	it("mysql hex(...): 2 overloads (HEX(str) / HEX(N)), origin harvested - the doc's polymorphic pair, formerly one hand-merged N_or_str param", () => {
		const overloads = SIGNATURES.mysql.hex;
		expect(overloads.length).toBe(2);
		expect(overloads.every((o) => o.origin === "harvested")).toBe(true);
		expect(overloads.map((o) => o.params[0].name).sort()).toEqual(["N", "str"]);
	});

	it("mysql substring: the four documented forms emit as ONE merged overload (str, pos, len?)", () => {
		// string-functions/43.txt carries all four doc forms: SUBSTRING(str,pos), SUBSTRING(str FROM
		// pos), SUBSTRING(str,pos,len), SUBSTRING(str FROM pos FOR len). The two FROM forms skip as
		// clause syntax (never guessed); the two comma forms prefix-merge into one shape with len
		// optional - arity 2-3, exactly the range the four forms span at the call-argument level.
		const overloads = SIGNATURES.mysql.substring;
		expect(overloads.length).toBe(1);
		expect(overloads[0].origin).toBe("harvested");
		expect(overloads[0].params).toEqual([{ name: "str" }, { name: "pos" }, { name: "len", optional: true }]);
	});

	it("redshift listagg(...): 2 overloads (aggregate + window pages), delimiter optional in both - the hand shape wrongly required it", () => {
		// r_LISTAGG and r_WF_LISTAGG each document LISTAGG( [DISTINCT] expression [, 'delimiter' ] );
		// the leading-modifier strip plus the WITHIN GROUP tail strip recover both, and the deleted
		// hand entry's required-delimiter shape (an arity bug: LISTAGG(x) is valid) is gone with it.
		const overloads = SIGNATURES.redshift.listagg;
		expect(overloads.length).toBe(2);
		expect(overloads.every((o) => o.origin === "harvested")).toBe(true);
		for (const o of overloads) {
			expect(o.params.length).toBe(2);
			expect(o.params[1]).toMatchObject({ name: "delimiter", optional: true });
		}
	});

	it("mysql interval(...): the operator-blocklist exemption keeps INTERVAL(N,N1,N2,...), a real documented comparison function", () => {
		// comparison-operators.html #function_interval: INTERVAL(N,N1,N2,N3,...) returns the index of
		// N in the sorted list. The shared blocklist would drop the name (it is the DATE_ADD keyword
		// everywhere else); the MySQL extractor exempts it because this call shape is a genuine,
		// cleanly-parseable builtin.
		const overloads = SIGNATURES.mysql.interval;
		expect(overloads.length).toBe(1);
		expect(overloads[0].origin).toBe("harvested");
		expect(overloads[0].variadic).toBe(true);
	});
});

describe("harvested signatures: names that stay suppressed (a lowering artifact, not documented call shapes)", () => {
	it("duckdb map is still suppressed: 0/2/4/6-arg brace-literal lowerings never fit one flat overload set", () => {
		expect(SIGNATURES.duckdb.map).toBeUndefined();
	});

	it("trino map is still suppressed: its 2-arg array(K)/array(V) form never parses out of the docs", () => {
		expect(SIGNATURES.trino.map).toBeUndefined();
	});

	it("bigquery array is still suppressed: a real 1-arg function shares the name with the array-constructor literal", () => {
		expect(SIGNATURES.bigquery.array).toBeUndefined();
	});
});

describe("harvested signatures: operator blocklist", () => {
	it("databricks IN is dropped: its function-call-shaped `in ( elem, expr1 [, ...] )` doc page parses cleanly but IN is a predicate keyword, not a function", () => {
		expect(SIGNATURES.databricks.in).toBeUndefined();
	});
});

describe("harvested signatures — origin assertions (curated override vs harvested long tail)", () => {
	it("tsql choose has origin curated and a typed param — the override that wins over the harvest (dateadd used to be this example; its own override was a typed-duplicate, deleted 2026-07-14)", () => {
		const resolved = lookupSignature("tsql", "choose");
		expect(resolved).toBe(SIGNATURES.tsql.choose);
		expect(resolved!.length).toBe(1);
		expect(resolved![0].origin).toBe("curated");
		expect(resolved![0].params[0]).toMatchObject({ name: "index", type: "int" });
	});

	it("tsql translate has origin harvested — no curated override exists for it", () => {
		const resolved = lookupSignature("tsql", "translate");
		expect(resolved).toBeDefined();
		expect(resolved![0].origin).toBe("harvested");
	});

	it("duckdb list_min has origin harvested, not curated", () => {
		expect(lookupSignature("duckdb", "list_min")).toBe(SIGNATURES.duckdb.list_min);
		expect(lookupSignature("duckdb", "list_min")).toEqual([
			{
				name: "list_min",
				params: [{ name: "list" }],
				origin: "harvested",
			},
		]);
	});
});

describe("harvested signatures — fallback unchanged for unknown names", () => {
	it("an unknown name resolves to no signature (name-only fallback territory)", () => {
		expect(lookupSignature("tsql", "no_such_function_xyz")).toBeUndefined();
	});

	it("signatureAt still gives a one-entry name-only hint for an unknown call", () => {
		const text = "SELECT no_such_function_xyz(a, ";
		const doc = SqlDocument.create(text, "tsql");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		expect(info!.signatures).toEqual([{ label: "no_such_function_xyz", parameters: [] }]);
		expect(info!.activeParameter).toBe(1);
	});
});

describe("harvested signatures — reach signatureAt for harvested-only functions", () => {
	it("TRANSLATE(inputString, characters, translations): harvested layer renders full params", () => {
		const text = "SELECT TRANSLATE(a, b, ";
		const doc = SqlDocument.create(text, "tsql");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		const active = info!.signatures[info!.activeSignature];
		expect(active.label.toLowerCase()).toContain("translate");
		expect(active.parameters.length).toBe(3); // proves the harvested table, not the name-only fallback
		expect(info!.activeParameter).toBe(2);
	});
});
