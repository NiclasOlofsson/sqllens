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
	it("at least 167 T-SQL entries carry origin harvested", () => {
		expect(harvestedCount("tsql")).toBeGreaterThanOrEqual(167);
	});
});

describe("harvested signatures — DuckDB yield floor (ratchet)", () => {
	it("at least 359 DuckDB entries carry origin harvested", () => {
		// 327 -> 359 on 2026-07-14: the overload-aware model turns former whole-name conflicts (length,
		// bit_count, hex, md5, generate_series, make_timestamp, ...) into real 2+-overload data.
		expect(harvestedCount("duckdb")).toBeGreaterThanOrEqual(359);
	});
});

describe("harvested signatures — PostgreSQL yield floor (ratchet)", () => {
	it("at least 547 PostgreSQL entries carry origin harvested", () => {
		// 477 -> 547 on 2026-07-14: type-based overloads (lower(text) vs lower(anyrange), length's six
		// type forms, round/trunc/log's numeric vs double precision forms, ...) now emit as overload
		// sets instead of being dropped as conflicts.
		expect(harvestedCount("postgres")).toBeGreaterThanOrEqual(547);
	});
});

describe("harvested signatures: Databricks yield floor (ratchet)", () => {
	it("at least 603 Databricks entries carry origin harvested", () => {
		// 599 -> 603 on 2026-07-14: ai_extract, element_at, format_number and try_element_at's own
		// multi-shape doc pages now emit as overload sets.
		expect(harvestedCount("databricks")).toBeGreaterThanOrEqual(603);
	});
});

describe("harvested signatures: Snowflake yield floor (ratchet)", () => {
	it("at least 501 Snowflake entries carry origin harvested", () => {
		expect(harvestedCount("snowflake")).toBeGreaterThanOrEqual(501);
	});
});

describe("harvested signatures: Trino yield floor (ratchet)", () => {
	it("at least 347 Trino entries carry origin harvested", () => {
		// 334 -> 347 on 2026-07-14: type-based overloads (length(binary) vs length(string), avg/merge/
		// cardinality's typed forms, ...) now emit as overload sets instead of being dropped.
		expect(harvestedCount("trino")).toBeGreaterThanOrEqual(347);
	});
});

describe("harvested signatures: BigQuery yield floor (ratchet)", () => {
	it("at least 291 BigQuery entries carry origin harvested", () => {
		// 293 -> 291 on 2026-07-14, same day: json_extract and json_query gained curated overrides
		// (the corpus proves json_path is really optional, which the doc's own syntax fence doesn't
		// show), flipping those two names' origin from harvested to curated: a legitimate drop, not a
		// regression, per this file's own header note.
		expect(harvestedCount("bigquery")).toBeGreaterThanOrEqual(291);
	});
});

describe("harvested signatures: doc-verified spot checks (single-overload names)", () => {
	it("DATEADD(datepart, number, date) — 3 params, not variadic (curated: typed override shadows the harvest here)", () => {
		const overloads = SIGNATURES.tsql.dateadd;
		expect(overloads.length).toBe(1);
		expect(overloads[0].params.map((p) => p.name)).toEqual(["datepart", "number", "date"]);
		expect(overloads[0].variadic ?? false).toBe(false);
	});

	it("SUBSTRING(expression, start, length) — length optional, curated origin (agrees with the harvest's per-product OR-merge, plus types)", () => {
		const overloads = SIGNATURES.tsql.substring;
		expect(overloads.length).toBe(1);
		expect(overloads[0].origin).toBe("curated");
		expect(overloads[0].params).toEqual([
			{ name: "expression" },
			{ name: "start", type: "int" },
			{ name: "length", type: "int", optional: true },
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

	it("CONCAT(argument1, argument2, ...) — requires 2 args minimum (report-cited fix: the old harvested-only shape allowed 1 arg)", () => {
		// learn.microsoft.com/.../concat-transact-sql: "CONCAT ( argument1 , argument2 [ , argumentN ] ) ...
		// requires at least two arguments". The pre-refactor harvested-only shape had a single required
		// param, which under-counted the minimum arity; the curated override fixes it.
		const sig = SIGNATURES.tsql.concat[0];
		expect(sig.origin).toBe("curated");
		expect(sig.variadic).toBe(true);
		expect(sig.params).toEqual([{ name: "argument1" }, { name: "argument2" }]);
	});

	it("LTRIM(character_expression, characters?): curated origin, shape identical to the harvest's own prefix-merge", () => {
		// functions/ltrim-transact-sql.md documents two blocks of different LENGTH (pre-2022 1-arg,
		// 2022+ 2-arg); the harvest's prefix-merge widening and the curated override agree on this exact
		// shape (a redundancy-report candidate), so the override wins but changes nothing observable.
		const sig = SIGNATURES.tsql.ltrim[0];
		expect(sig.params).toEqual([{ name: "character_expression" }, { name: "characters", optional: true }]);
	});

	it("duckdb substring(string, start, length) — length optional, curated origin (report-cited fix: adds types)", () => {
		const sig = SIGNATURES.duckdb.substring[0];
		expect(sig.origin).toBe("curated");
		expect(sig.params).toEqual([
			{ name: "string", type: "text" },
			{ name: "start", type: "int" },
			{ name: "length", type: "int", optional: true },
		]);
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
		// through the nesting (not a single non-greedy regex pass) unwraps every level. The curated
		// override agrees with this shape exactly (a redundancy-report candidate).
		const sig = SIGNATURES.postgres.make_interval[0];
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

	it("postgres coalesce(value, ...): variadic, curated origin, shape identical to what the harvest found in a <synopsis> block", () => {
		// func.sgml documents COALESCE only as `<synopsis><function>COALESCE</function>(<replaceable>value</replaceable>
		// <optional>, ...</optional>)</synopsis>`, not inside a <para role="func_signature">.
		const sig = SIGNATURES.postgres.coalesce[0];
		expect(sig.params).toEqual([{ name: "value" }]);
		expect(sig.variadic).toBe(true);
	});

	it("databricks date_add: curated origin, 3 params (start_date, num_days, expr optional) — shadows the harvest's 2-arg startDate/numDays form", () => {
		// databricks/docs/syntax/functions/date_add/1.txt harvests a 2-arg startDate/numDays form; the
		// curated override documents the fuller (start_date, num_days, unit-based expr) shape from the
		// function reference page and wins.
		const sig = SIGNATURES.databricks.date_add[0];
		expect(sig.origin).toBe("curated");
		expect(sig.params).toEqual([
			{ name: "start_date", type: "date" },
			{ name: "num_days", type: "int" },
			{ name: "expr", optional: true },
		]);
	});

	it("snowflake ROUND(input_expr, scale_expr?, rounding_mode?): curated origin, types added over the harvest's quoted-placeholder shape", () => {
		// functions/round/1.txt: `ROUND( <input_expr> [ , <scale_expr> [ , '<rounding_mode>' ] ] )`. The
		// harvest's quoted-placeholder widening finds the same optionality; the curated override adds
		// documented types on top.
		const sig = SIGNATURES.snowflake.round[0];
		expect(sig.origin).toBe("curated");
		expect(sig.params).toEqual([
			{ name: "input_expr", type: "numeric" },
			{ name: "scale_expr", type: "integer", optional: true },
			{ name: "rounding_mode", type: "string", optional: true },
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

	it("trino date_add(unit, value, timestamp): curated origin, types added over the harvest's untyped 3-param shape", () => {
		const sig = SIGNATURES.trino.date_add[0];
		expect(sig.origin).toBe("curated");
		expect(sig.params).toEqual([
			{ name: "unit", type: "varchar" },
			{ name: "value", type: "bigint" },
			{ name: "timestamp", type: "timestamp" },
		]);
	});

	it("trino date_parse(string, format): curated origin, types added over the lone :::{js:function} fence spelling", () => {
		// datetime.md:437 is `:::{js:function} date_parse(string, format) -> timestamp(3)`, the only
		// js:function-fenced directive in the corpus, and its return arrow is a literal U+2192 rather
		// than the usual ASCII "->". The curated override adds documented types over that harvest.
		const sig = SIGNATURES.trino.date_parse[0];
		expect(sig.origin).toBe("curated");
		expect(sig.params).toEqual([
			{ name: "string", type: "varchar" },
			{ name: "format", type: "varchar" },
		]);
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

	it("bigquery ROUND(X [, N [, rounding_mode]]): curated origin, X and N typed over the harvest's untyped bracket chain", () => {
		const sig = SIGNATURES.bigquery.round[0];
		expect(sig.origin).toBe("curated");
		expect(sig.params).toEqual([
			{ name: "X", type: "FLOAT64" },
			{ name: "N", type: "INT64", optional: true },
			{ name: "rounding_mode", optional: true },
		]);
	});

	it("bigquery PARSE_DATE(format_string, date_string): curated origin, types added over the harvest's untyped 2-param shape", () => {
		const sig = SIGNATURES.bigquery.parse_date[0];
		expect(sig.origin).toBe("curated");
		expect(sig.params).toEqual([
			{ name: "format_string", type: "STRING" },
			{ name: "date_string", type: "STRING" },
		]);
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

	it("snowflake ai_count_tokens(...): un-suppressed as 4 generic arity-form overloads", () => {
		const overloads = SIGNATURES.snowflake.ai_count_tokens;
		expect(overloads.length).toBe(4);
		expect(overloads.every((o) => o.origin === "curated")).toBe(true);
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
	it("tsql dateadd has origin curated and a typed param — the override that wins over the harvest", () => {
		const resolved = lookupSignature("tsql", "dateadd");
		expect(resolved).toBe(SIGNATURES.tsql.dateadd);
		expect(resolved!.length).toBe(1);
		expect(resolved![0].origin).toBe("curated");
		expect(resolved![0].params[1]).toMatchObject({ name: "number", type: "int" });
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
