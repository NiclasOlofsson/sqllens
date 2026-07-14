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
	it("harvests at least 183 T-SQL function signatures from the docs syntax blocks", () => {
		// Pinned at the achieved yield (measured 2026-07-14, after the trailing-whitespace fence fix
		// recovered 32 pages). A grammar/docs refresh may only raise this — a drop means the harvester
		// regressed and must be investigated, not lowered.
		expect(Object.keys(HARVESTED_SIGNATURES.tsql).length).toBeGreaterThanOrEqual(183);
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
	it("harvests at least 456 PostgreSQL function signatures from the func.sgml doc", () => {
		// Pinned at the achieved yield (measured 2026-07-14). A docs refresh may only raise this — a
		// drop means the harvester regressed and must be investigated, not lowered.
		expect(Object.keys(HARVESTED_SIGNATURES.postgres).length).toBeGreaterThanOrEqual(456);
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

describe("harvested signatures — doc-verified spot checks", () => {
	it("DATEADD(datepart, number, date) — 3 params, not variadic", () => {
		const sig = HARVESTED_SIGNATURES.tsql.dateadd;
		expect(sig.params.map((p) => p.name)).toEqual(["datepart", "number", "date"]);
		expect(sig.variadic ?? false).toBe(false);
	});

	it("SUBSTRING(expression, start, length) — 3 params", () => {
		expect(HARVESTED_SIGNATURES.tsql.substring.params.map((p) => p.name)).toEqual([
			"expression",
			"start",
			"length",
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
