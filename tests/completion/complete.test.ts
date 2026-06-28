import { describe, expect, it } from "vitest";
import { complete, type Completion, type Dialect, SqlDocument } from "../../src/api.js";
import { Schema } from "../../src/qualify/schema.js";

// A small catalog the lsp acceptance test also uses: `sales(amount decimal, id int)`.
const schema = new Schema({ sales: { amount: "decimal", id: "int" } });

const labels = (items: Completion[], kind: Completion["kind"]): string[] =>
	items.filter((c) => c.kind === kind).map((c) => c.label);

// The core column-completion case is dialect-neutral once each dialect's config is wired: at a
// value/column position (the empty projection of `SELECT  FROM sales`), the FROM relation's schema
// columns must be offered. Every dialect parses this same string, so one parametrized case proves
// the per-dialect parser-factory + config entries discovered by probing each grammar.
describe.each<Dialect>(["databricks", "tsql", "snowflake", "bigquery", "redshift"])(
	"complete — column position, %s",
	(dialect) => {
		it("offers the FROM relation's columns at an empty-projection caret", () => {
			const sql = "SELECT  FROM sales";
			const offset = "SELECT ".length; // the caret in the gap after SELECT
			const items = complete(SqlDocument.create(sql, dialect), offset, schema);
			const cols = labels(items, "column");
			expect(cols).toContain("amount");
			expect(cols).toContain("id");
		});

		it("never throws and returns an array on broken input", () => {
			const sql = "SELECT amount FORM "; // FORM typo — broken parse
			const items = complete(SqlDocument.create(sql, dialect), sql.length, schema);
			expect(Array.isArray(items)).toBe(true);
		});
	},
);

describe("complete — databricks, scope + schema aware", () => {
	it("offers the FROM relation's columns in a SELECT expression position", () => {
		const sql = "SELECT  FROM sales";
		const offset = "SELECT ".length; // the caret in the gap after SELECT
		const items = complete(SqlDocument.create(sql, "databricks"), offset, schema);
		const cols = labels(items, "column");
		expect(cols).toContain("amount");
		expect(cols).toContain("id");
		// the type rides along as `detail` when a schema is present
		const amount = items.find((c) => c.kind === "column" && c.label === "amount");
		expect(amount?.detail).toMatch(/decimal/i);
	});

	it("offers schema table names in a FROM relation position", () => {
		const sql = "SELECT amount FROM ";
		const items = complete(SqlDocument.create(sql, "databricks"), sql.length, schema);
		expect(labels(items, "table")).toContain("sales");
	});

	it("offers the FROM keyword after a complete projection", () => {
		const sql = "SELECT amount ";
		const items = complete(SqlDocument.create(sql, "databricks"), sql.length, schema);
		// case follows the grammar literal (Spark grammar literals are upper-case)
		expect(labels(items, "keyword").map((l) => l.toUpperCase())).toContain("FROM");
	});

	it("does not throw on broken input and still returns keyword candidates", () => {
		const sql = "SELECT amount FORM "; // FORM is a typo — broken parse
		const doc = SqlDocument.create(sql, "databricks");
		const items = complete(doc, sql.length, schema);
		expect(items.length).toBeGreaterThan(0);
	});

	it("offers function names in an expression position", () => {
		const sql = "SELECT  FROM sales";
		const offset = "SELECT ".length;
		const items = complete(SqlDocument.create(sql, "databricks"), offset, schema);
		// `coalesce` is a known Spark function in the inference registry.
		expect(labels(items, "function")).toContain("coalesce");
	});

	it("never throws without a schema (no table list, still keywords)", () => {
		const sql = "SELECT amount FROM ";
		const items = complete(SqlDocument.create(sql, "databricks"), sql.length);
		expect(Array.isArray(items)).toBe(true);
		expect(labels(items, "table")).toEqual([]); // no schema → no tables
	});
});
