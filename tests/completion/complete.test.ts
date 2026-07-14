import { describe, expect, it } from "vitest";
import { complete, type Completion, type Dialect, SqlDocument } from "../../src/api.js";
import { Schema } from "../../src/qualify/schema.js";

// A small catalog the completion fixtures use: `sales(amount decimal, id int)`.
const schema = new Schema({ sales: { amount: "decimal", id: "int" } });

const labels = (items: Completion[], kind: Completion["kind"]): string[] =>
	items.filter((c) => c.kind === kind).map((c) => c.label);

// The core column-completion case is dialect-neutral once each dialect's config is wired: at a
// value/column position (the empty projection of `SELECT  FROM sales`), the FROM relation's schema
// columns must be offered. Every dialect parses this same string, so one parametrized case proves
// the per-dialect parser-factory + config entries discovered by probing each grammar.
describe.each<Dialect>([
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
])("complete — column position, %s", (dialect) => {
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

	// Real ATN + scope column path (NOT the broken-input FROM/JOIN token-stream fallback).
	//
	// The empty-projection case above (`SELECT  FROM sales`) mis-parses — the grammar reads
	// `SELECT FROM AS sales` — so the scope has no `sales` source and the columns there come
	// ONLY from the token-stream fallback (`fromRelationColumns`). This case uses a VALID
	// mid-edit query: `SELECT amount FROM sales WHERE ‹caret›`. It parses cleanly (the WHERE
	// predicate is merely unfinished), so FROM binds `sales` in the scope and the caret sits at
	// a value/column slot reached through `columnRules` → scope. So a regression in the real
	// scope-resolution path is caught here, where the empty-projection case (fallback-served)
	// would not catch it.
	//
	// Discriminator that the columns are NOT just the fallback masking a scope regression: at a
	// pure column slot only a columnRule fires, never a tableRule, so `complete` must NOT offer
	// the relation `sales` as a `table` item. The FROM/JOIN fallback only ever adds `column`
	// items — it cannot produce a `table` item — so "columns present AND no `sales` table" pins
	// the caret to the column path. (A WHERE position rather than a second projection slot is
	// used because it is the one value/column position that resolves uniformly across all five
	// dialects — Databricks and BigQuery read a bare identifier in a projection slot as a
	// relation/table reference, not a column slot.)
	it("resolves the FROM relation's columns through the scope at a valid value position", () => {
		const sql = "SELECT amount FROM sales WHERE ";
		const items = complete(SqlDocument.create(sql, dialect), sql.length, schema);
		const cols = labels(items, "column");
		expect(cols).toContain("amount");
		expect(cols).toContain("id");
		// the caret is a column slot, not a relation slot — `sales` must not be a table candidate.
		expect(labels(items, "table")).not.toContain("sales");
	});
});

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

	// The ATN walk enters `multiStatement` (a `;`-separated batch), not the single-statement
	// `compoundOrSingleStatement` — so completion in the second statement of a batch must still
	// reach the FROM-relation columns, not just the keyword fallback.
	it("survives a batch prefix: completes columns in the second statement of a `;`-separated batch", () => {
		const sql = "SELECT 1; SELECT  FROM sales";
		const offset = "SELECT 1; SELECT ".length;
		const items = complete(SqlDocument.create(sql, "databricks"), offset, schema);
		const cols = labels(items, "column");
		expect(cols).toContain("amount");
		expect(cols).toContain("id");
	});
});
