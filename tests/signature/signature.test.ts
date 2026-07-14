// Signature-help engine tests: signatureAt() is a pure token scan over a
// SqlDocument's neutral token stream. It finds the enclosing call at a caret,
// names the function, counts the active parameter, and renders every overload
// from the merged per-dialect SIGNATURES table (degrading to a one-entry
// name-only hint for an unknown name), picking which overload is active.
// It must never throw on broken / mid-edit input.
import { describe, it, expect } from "vitest";
import { SqlDocument, signatureAt, SIGNATURES, type SignatureHelpInfo } from "../../src/index.js";

// Caret at the end of the given text — the common mid-typing position.
const end = (s: string): number => s.length;

/** The active overload's own rendering (label + parameters), the shape most tests care about. */
const active = (info: SignatureHelpInfo) => info.signatures[info.activeSignature];

describe("signatureAt — curated functions", () => {
	it("Databricks date_add: caret in the 2nd arg → activeParameter 1, label names date_add", () => {
		// date_add's own curated override was deleted 2026-07-14 (the widened harvester now recovers
		// both real forms - the unit-based 3-arg page and the 2-arg startDate/numDays alias page - as
		// two harvested overloads on its own). Both overloads have room at index 1, so the FIRST one
		// (harvested doc order, the longer 3-param unit/value/expr form) is picked active.
		const text = "SELECT date_add(x, ";
		const doc = SqlDocument.create(text, "databricks");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		expect(info!.signatures.length).toBe(2);
		expect(active(info!).label).toContain("date_add");
		expect(active(info!).parameters.length).toBe(3);
		expect(info!.activeParameter).toBe(1);
	});

	it("Databricks date_add: caret in the 1st arg → activeParameter 0", () => {
		const text = "SELECT date_add(";
		const doc = SqlDocument.create(text, "databricks");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		expect(info!.activeParameter).toBe(0);
	});

	it("T-SQL DATEADD(datepart, number, date): caret in the 3rd arg → activeParameter 2, three params", () => {
		const text = "SELECT DATEADD(day, 1, ";
		const doc = SqlDocument.create(text, "tsql");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		expect(active(info!).label.toLowerCase()).toContain("dateadd");
		expect(active(info!).parameters.length).toBe(3);
		expect(info!.activeParameter).toBe(2);
	});

	it("Snowflake DATEADD(part, value, date): doc-cited arg order differs from T-SQL but still 3 params", () => {
		const text = "SELECT DATEADD(month, 2, ";
		const doc = SqlDocument.create(text, "snowflake");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		expect(active(info!).parameters.length).toBe(3);
		expect(info!.activeParameter).toBe(2);
	});

	it("variadic concat: extra args past the fixed list keep highlighting the variadic param", () => {
		const text = "SELECT concat('a', 'b', 'c', ";
		const doc = SqlDocument.create(text, "databricks");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		// concat is curated as variadic (one repeating param). The 4th comma-slot (index 3) must
		// clamp to the last param index, not run off the end.
		expect(info!.activeParameter).toBe(active(info!).parameters.length - 1);
	});
});

describe("signatureAt: overload picker", () => {
	it("postgres length(...): a 2+-overload name renders one entry per overload", () => {
		const text = "SELECT length(x, ";
		const doc = SqlDocument.create(text, "postgres");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		// postgres length has 6 documented overloads (text/bytea/bit/geometric_type/tsvector, plus a
		// 2-arg bytes+encoding form), see tests/signature/harvested.test.ts.
		expect(info!.signatures.length).toBeGreaterThanOrEqual(2);
		// Caret is in arg index 1 (2nd arg): the active overload must be one that can actually hold a
		// 2nd param, a sane pick, not an arbitrary one.
		const chosen = active(info!);
		expect(chosen.parameters.length).toBeGreaterThan(1);
	});

	it("trino length(...): exactly 2 overloads (binary, string), single-param each", () => {
		const text = "SELECT length(";
		const doc = SqlDocument.create(text, "trino");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		expect(info!.signatures.length).toBe(2);
		for (const s of info!.signatures) expect(s.parameters.length).toBe(1);
		// Caret is in arg 0: both fixed 1-param overloads have room at index 0, so the FIRST one
		// (harvested doc order) is picked active.
		expect(info!.activeSignature).toBe(0);
		expect(info!.activeParameter).toBe(0);
	});

	it("duckdb length(...): exactly 3 overloads (bitstring, list, string)", () => {
		const text = "SELECT length(";
		const doc = SqlDocument.create(text, "duckdb");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		expect(info!.signatures.length).toBe(3);
	});
});

describe("signatureAt — uncurated fallback", () => {
	it("an unknown identifier function degrades to a one-entry name-only hint", () => {
		const text = "SELECT myfunc(a, ";
		const doc = SqlDocument.create(text, "databricks");
		const info = signatureAt(doc, end(text));
		expect(info).toEqual({
			signatures: [{ label: "myfunc", parameters: [] }],
			activeSignature: 0,
			activeParameter: 1,
		});
	});
});

describe("signatureAt — not-in-a-call and broken input", () => {
	it("caret outside any call returns null", () => {
		const text = "SELECT a ";
		const doc = SqlDocument.create(text, "databricks");
		expect(signatureAt(doc, end(text))).toBeNull();
	});

	it("a parenthesized subquery is not a call → null (token before ( is not a function name)", () => {
		const text = "SELECT * FROM (";
		const doc = SqlDocument.create(text, "databricks");
		expect(signatureAt(doc, end(text))).toBeNull();
	});

	it("never throws on broken nested parens", () => {
		const text = "SELECT date_add(((";
		const doc = SqlDocument.create(text, "databricks");
		expect(() => signatureAt(doc, end(text))).not.toThrow();
	});
});

describe("signatureAt — nested calls (top-level comma counting)", () => {
	it("round(abs(x), … encloses round; the abs(...) parens do not miscount the comma", () => {
		const text = "SELECT round(abs(x), ";
		const doc = SqlDocument.create(text, "databricks");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		expect(active(info!).label).toContain("round");
		expect(info!.activeParameter).toBe(1);
	});

	it("inside the inner abs(...) call, the enclosing function is abs", () => {
		const text = "SELECT round(abs(";
		const doc = SqlDocument.create(text, "databricks");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		expect(active(info!).label).toContain("abs");
		expect(info!.activeParameter).toBe(0);
	});
});

describe("SIGNATURES table", () => {
	it("has a bounded curated-origin set per dialect (roughly 5-45 each)", () => {
		// Lower bound dropped 20 -> 5 on 2026-07-14: the override-pruning pass (widened harvester +
		// re-prune) deleted every override whose contribution was redundant with, subsumed by, or
		// type-only over the harvest, down to tsql=7 / databricks=15 / snowflake=16 / bigquery=13.
		// Redshift joined the harvested dialects later the same day (its own syntax tier + extractor)
		// and its curated set fell 31 -> 13 under the same rules (11 survivors of the prune plus the
		// rtrim/st_collect safety-valve entries the corpus gate forced). A hand entry now survives
		// only when it earns it; the ceiling still guards against the set growing back.
		for (const d of ["databricks", "tsql", "snowflake", "bigquery", "redshift"] as const) {
			const n = Object.values(SIGNATURES[d]).filter((overloads) => overloads[0]?.origin === "curated").length;
			expect(n).toBeGreaterThanOrEqual(5);
			expect(n).toBeLessThanOrEqual(45);
		}
	});

	it("is keyed by lowercased function name", () => {
		for (const d of ["databricks", "tsql", "snowflake", "bigquery", "redshift"] as const) {
			for (const key of Object.keys(SIGNATURES[d])) {
				expect(key).toBe(key.toLowerCase());
			}
		}
	});

	it("every name maps to a non-empty overload set", () => {
		for (const d of [
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
		] as const) {
			for (const overloads of Object.values(SIGNATURES[d])) {
				expect(overloads.length).toBeGreaterThan(0);
			}
		}
	});
});
