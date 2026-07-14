// Signature-help engine tests: signatureAt() is a pure token scan over a
// SqlDocument's neutral token stream. It finds the enclosing call at a caret,
// names the function, counts the active parameter, and renders a label from the
// merged per-dialect SIGNATURES table (degrading to name-only for an unknown name).
// It must never throw on broken / mid-edit input.
import { describe, it, expect } from "vitest";
import { SqlDocument, signatureAt, SIGNATURES } from "../../src/index.js";

// Caret at the end of the given text — the common mid-typing position.
const end = (s: string): number => s.length;

describe("signatureAt — curated functions", () => {
	it("Databricks date_add: caret in the 2nd arg → activeParameter 1, label names date_add", () => {
		const text = "SELECT date_add(x, ";
		const doc = SqlDocument.create(text, "databricks");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		expect(info!.label).toContain("date_add");
		// 3 params: start_date, num_days, and the optional 3rd of the (unit, value, expr) overload.
		expect(info!.parameters.length).toBe(3);
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
		expect(info!.label.toLowerCase()).toContain("dateadd");
		expect(info!.parameters.length).toBe(3);
		expect(info!.activeParameter).toBe(2);
	});

	it("Snowflake DATEADD(part, value, date): doc-cited arg order differs from T-SQL but still 3 params", () => {
		const text = "SELECT DATEADD(month, 2, ";
		const doc = SqlDocument.create(text, "snowflake");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		expect(info!.parameters.length).toBe(3);
		expect(info!.activeParameter).toBe(2);
	});

	it("variadic concat: extra args past the fixed list keep highlighting the variadic param", () => {
		const text = "SELECT concat('a', 'b', 'c', ";
		const doc = SqlDocument.create(text, "databricks");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		// concat is curated as variadic (one repeating param). The 4th comma-slot (index 3) must
		// clamp to the last param index, not run off the end.
		expect(info!.activeParameter).toBe(info!.parameters.length - 1);
	});
});

describe("signatureAt — uncurated fallback", () => {
	it("an unknown identifier function degrades to name + active-arg, empty parameters", () => {
		const text = "SELECT myfunc(a, ";
		const doc = SqlDocument.create(text, "databricks");
		const info = signatureAt(doc, end(text));
		expect(info).toEqual({ label: "myfunc", parameters: [], activeParameter: 1 });
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
		expect(info!.label).toContain("round");
		expect(info!.activeParameter).toBe(1);
	});

	it("inside the inner abs(...) call, the enclosing function is abs", () => {
		const text = "SELECT round(abs(";
		const doc = SqlDocument.create(text, "databricks");
		const info = signatureAt(doc, end(text));
		expect(info).not.toBeNull();
		expect(info!.label).toContain("abs");
		expect(info!.activeParameter).toBe(0);
	});
});

describe("SIGNATURES table", () => {
	it("has a bounded curated-origin set per dialect (roughly 20-45 each)", () => {
		for (const d of ["databricks", "tsql", "snowflake", "bigquery", "redshift"] as const) {
			const n = Object.values(SIGNATURES[d]).filter((s) => s.origin === "curated").length;
			expect(n).toBeGreaterThanOrEqual(20);
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
});
