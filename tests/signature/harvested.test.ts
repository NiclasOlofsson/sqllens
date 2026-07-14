// Harvested-signature layer tests: the doc-derived long tail behind the merged per-dialect
// SIGNATURES table.
//
// tools/harvest-signatures.mjs mines each dialect's reference docs into a committed, generated table
// (src/<dialect>/signatures.generated.ts) and folds a curated override layer (tools/signature-
// overrides/<dialect>.mjs) over it: an override wins by key, and every entry carries `origin:
// "curated" | "harvested"` recording which layer produced it. SIGNATURES[dialect] is already the
// merged, single list; there is no separate curated/harvested lookup step left at runtime.
//
// These tests assert: the harvested-origin yield per dialect is pinned as a ratchet (a floor, never
// silently lowered), harvested entries match their docs, an override wins over a harvested entry of
// the same name (origin flips to "curated"), an unknown name still falls through to the name-only
// hint, and a harvested-only function actually renders through signatureAt().
import { describe, it, expect } from "vitest";
import { SqlDocument, signatureAt, SIGNATURES, lookupSignature, type FnSignature } from "../../src/index.js";

const end = (s: string): number => s.length;

function harvestedCount(dialect: keyof typeof SIGNATURES): number {
	return Object.values(SIGNATURES[dialect]).filter((s: FnSignature) => s.origin === "harvested").length;
}

// Floors are pinned on the MERGED table's origin: "harvested" count, not the harvester's raw
// pre-merge yield: a curated override that shadows an already-harvested name flips that entry's
// origin to "curated", which legitimately lowers the harvested-origin count below the harvester's
// raw yield. Re-measured 2026-07-14 against this refactor's ten override files; a future drop below
// these floors means the harvester regressed and must be investigated, not lowered.

describe("harvested signatures — T-SQL yield floor (ratchet)", () => {
	it("at least 167 T-SQL entries carry origin harvested", () => {
		expect(harvestedCount("tsql")).toBeGreaterThanOrEqual(167);
	});
});

describe("harvested signatures — DuckDB yield floor (ratchet)", () => {
	it("at least 327 DuckDB entries carry origin harvested", () => {
		expect(harvestedCount("duckdb")).toBeGreaterThanOrEqual(327);
	});
});

describe("harvested signatures — PostgreSQL yield floor (ratchet)", () => {
	it("at least 477 PostgreSQL entries carry origin harvested", () => {
		expect(harvestedCount("postgres")).toBeGreaterThanOrEqual(477);
	});
});

describe("harvested signatures: Databricks yield floor (ratchet)", () => {
	it("at least 599 Databricks entries carry origin harvested", () => {
		// 604 -> 599 on 2026-07-14: the corpus-gate false-positive round moved dateadd,
		// ai_parse_document, array_sort and from_avro to curated overrides and suppressed decode
		// (dual-nature name). Total coverage went up, not down.
		expect(harvestedCount("databricks")).toBeGreaterThanOrEqual(599);
	});
});

describe("harvested signatures: Snowflake yield floor (ratchet)", () => {
	it("at least 478 Snowflake entries carry origin harvested", () => {
		expect(harvestedCount("snowflake")).toBeGreaterThanOrEqual(478);
	});
});

describe("harvested signatures: Trino yield floor (ratchet)", () => {
	it("at least 334 Trino entries carry origin harvested", () => {
		expect(harvestedCount("trino")).toBeGreaterThanOrEqual(334);
	});
});

describe("harvested signatures: BigQuery yield floor (ratchet)", () => {
	it("at least 270 BigQuery entries carry origin harvested", () => {
		expect(harvestedCount("bigquery")).toBeGreaterThanOrEqual(270);
	});
});

describe("harvested signatures — doc-verified spot checks", () => {
	it("DATEADD(datepart, number, date) — 3 params, not variadic (curated: typed override shadows the harvest here)", () => {
		const sig = SIGNATURES.tsql.dateadd;
		expect(sig.params.map((p) => p.name)).toEqual(["datepart", "number", "date"]);
		expect(sig.variadic ?? false).toBe(false);
	});

	it("SUBSTRING(expression, start, length) — length optional, curated origin (agrees with the harvest's per-product OR-merge, plus types)", () => {
		expect(SIGNATURES.tsql.substring.origin).toBe("curated");
		expect(SIGNATURES.tsql.substring.params).toEqual([
			{ name: "expression" },
			{ name: "start", type: "int" },
			{ name: "length", type: "int", optional: true },
		]);
	});

	it("IIF(boolean_expression, true_value, false_value) — 3 params", () => {
		expect(SIGNATURES.tsql.iif.params.map((p) => p.name)).toEqual([
			"boolean_expression",
			"true_value",
			"false_value",
		]);
	});

	it("GETDATE() — zero-parameter function, origin harvested", () => {
		expect(SIGNATURES.tsql.getdate.params).toEqual([]);
		expect(SIGNATURES.tsql.getdate.origin).toBe("harvested");
	});

	it("CONCAT(argument1, argument2, ...) — requires 2 args minimum (report-cited fix: the old harvested-only shape allowed 1 arg)", () => {
		// learn.microsoft.com/.../concat-transact-sql: "CONCAT ( argument1 , argument2 [ , argumentN ] ... )
		// ... requires at least two arguments". The pre-refactor harvested-only shape had a single
		// required param, which under-counted the minimum arity; the curated override fixes it.
		const sig = SIGNATURES.tsql.concat;
		expect(sig.origin).toBe("curated");
		expect(sig.variadic).toBe(true);
		expect(sig.params).toEqual([{ name: "argument1" }, { name: "argument2" }]);
	});

	it("LTRIM(character_expression, characters?): curated origin, shape identical to the harvest's own prefix-merge", () => {
		// functions/ltrim-transact-sql.md documents two blocks of different LENGTH (pre-2022 1-arg,
		// 2022+ 2-arg); the harvest's prefix-merge widening and the curated override agree on this exact
		// shape (a redundancy-report candidate), so the override wins but changes nothing observable.
		const sig = SIGNATURES.tsql.ltrim;
		expect(sig.params).toEqual([{ name: "character_expression" }, { name: "characters", optional: true }]);
	});

	it("duckdb substring(string, start, length) — length optional, curated origin (report-cited fix: adds types)", () => {
		const sig = SIGNATURES.duckdb.substring;
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
		const sig = SIGNATURES.postgres.char_length;
		expect(sig.params).toEqual([{ name: "text" }]);
		expect(sig.origin).toBe("harvested");
	});

	it("postgres make_interval: all 7 params optional, via the recursive nested-<optional> peel", () => {
		// func.sgml wraps even the FIRST param (years) in the outer <optional> of a 7-deep chain
		// (years [, months [, weeks [, days [, hours [, mins [, secs ]]]]]]); only a recursive descent
		// through the nesting (not a single non-greedy regex pass) unwraps every level. The curated
		// override agrees with this shape exactly (a redundancy-report candidate).
		const sig = SIGNATURES.postgres.make_interval;
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
		const sig = SIGNATURES.postgres.coalesce;
		expect(sig.params).toEqual([{ name: "value" }]);
		expect(sig.variadic).toBe(true);
	});

	it("databricks date_add: curated origin, 3 params (start_date, num_days, expr optional) — shadows the harvest's 2-arg startDate/numDays form", () => {
		// databricks/docs/syntax/functions/date_add/1.txt harvests a 2-arg startDate/numDays form; the
		// curated override documents the fuller (start_date, num_days, unit-based expr) shape from the
		// function reference page and wins.
		const sig = SIGNATURES.databricks.date_add;
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
		const sig = SIGNATURES.snowflake.round;
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
		const sig = SIGNATURES.snowflake.len;
		expect(sig.name).toBe("LEN");
		expect(sig.params).toEqual([{ name: "expression" }]);
		expect(sig.origin).toBe("harvested");
	});

	it("trino date_add(unit, value, timestamp): curated origin, types added over the harvest's untyped 3-param shape", () => {
		const sig = SIGNATURES.trino.date_add;
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
		const sig = SIGNATURES.trino.date_parse;
		expect(sig.origin).toBe("curated");
		expect(sig.params).toEqual([
			{ name: "string", type: "varchar" },
			{ name: "format", type: "varchar" },
		]);
	});

	it("trino ST_Point(lon: double, lat: double): typed colon-pair params, mixed-case display name, origin harvested", () => {
		// geospatial.md: `:::{function} ST_Point(lon: double, lat: double) -> Point`. The colon pair
		// keeps the documented type, and the doc's mixed casing is the display name (key lowercased).
		const sig = SIGNATURES.trino.st_point;
		expect(sig.name).toBe("ST_Point");
		expect(sig.origin).toBe("harvested");
		expect(sig.params).toEqual([
			{ name: "lon", type: "double" },
			{ name: "lat", type: "double" },
		]);
	});

	it("bigquery ROUND(X [, N [, rounding_mode]]): curated origin, X and N typed over the harvest's untyped bracket chain", () => {
		const sig = SIGNATURES.bigquery.round;
		expect(sig.origin).toBe("curated");
		expect(sig.params).toEqual([
			{ name: "X", type: "FLOAT64" },
			{ name: "N", type: "INT64", optional: true },
			{ name: "rounding_mode", optional: true },
		]);
	});

	it("bigquery PARSE_DATE(format_string, date_string): curated origin, types added over the harvest's untyped 2-param shape", () => {
		const sig = SIGNATURES.bigquery.parse_date;
		expect(sig.origin).toBe("curated");
		expect(sig.params).toEqual([
			{ name: "format_string", type: "STRING" },
			{ name: "date_string", type: "STRING" },
		]);
	});
});

describe("harvested signatures: typed-overload conflicts stay unmerged", () => {
	it("trino length is undefined: length(binary) vs length(string) tie at arity 1 with different types", () => {
		// binary.md and string.md each document their own length(); the merge rule compares types
		// (and here even the bare-type display names differ), so nothing is emitted, never a guess.
		expect(SIGNATURES.trino.length).toBeUndefined();
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
		expect(resolved!.origin).toBe("curated");
		expect(resolved!.params[1]).toMatchObject({ name: "number", type: "int" });
	});

	it("tsql translate has origin harvested — no curated override exists for it", () => {
		const resolved = lookupSignature("tsql", "translate");
		expect(resolved).toBeDefined();
		expect(resolved!.origin).toBe("harvested");
	});

	it("duckdb list_min has origin harvested, not curated", () => {
		expect(lookupSignature("duckdb", "list_min")).toBe(SIGNATURES.duckdb.list_min);
		expect(lookupSignature("duckdb", "list_min")).toEqual({
			name: "list_min",
			params: [{ name: "list" }],
			origin: "harvested",
		});
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
