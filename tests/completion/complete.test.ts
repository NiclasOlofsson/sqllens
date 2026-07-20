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

	// anvil (2026-07-15): a caret at the END of a partial identifier means the user is TYPING that
	// identifier (antlr4-c3's own caret convention); it must complete the identifier's own slot,
	// not read the slot as filled and describe what comes after. Before the fix these offered only
	// follow-on keywords, and the consumer had to pre-detect context to pass word-start offsets.
	describe("caret at the end of a partial identifier completes that identifier's slot", () => {
		it("projection slot: SELECT ifn| offers functions matching the typed prefix", () => {
			const sql = "SELECT ifn FROM sales";
			const offset = "SELECT ifn".length; // caret at the end of `ifn`
			const items = complete(SqlDocument.create(sql, "databricks"), offset, schema);
			expect(labels(items, "function")).toContain("ifnull");
			// pruned by the typed prefix (2026-07-12 ruling): "amount" doesn't start with "ifn".
			expect(labels(items, "column")).not.toContain("amount");
		});

		it("WHERE value slot: caret at the end of a partial name offers only functions matching it", () => {
			const sql = "SELECT amount FROM sales WHERE coal";
			const items = complete(SqlDocument.create(sql, "databricks"), sql.length, schema);
			expect(labels(items, "function")).toContain("coalesce");
			// pruned: "amount" doesn't start with "coal".
			expect(labels(items, "column")).not.toContain("amount");
		});

		it("a caret in the gap BETWEEN tokens keeps the old next-token rule", () => {
			const sql = "SELECT amount FROM sales";
			const offset = "SELECT amount ".length; // between `amount` and FROM
			const items = complete(SqlDocument.create(sql, "databricks"), offset, schema);
			expect(labels(items, "keyword").map((l) => l.toLowerCase())).toContain("from");
		});
	});

	// issue #38 stage 6 — the two consumer-reported relation-slot gaps (anvil items 1+3, both
	// pinned by LSP sentinels): in-scope CTE names as candidates, and namespace SEGMENT
	// candidates after a qualifier dot (never full paths — LSP clients replace the caret token).
	describe("relation-slot candidates: CTEs and namespace segments", () => {
		const nested = new Schema({
			analytics: { sales: { orders: { id: "int" } }, marketing: { leads: { id: "int" } } },
		});

		it("offers in-scope CTE names at a relation slot, ahead of catalog tables", () => {
			const sql = "with recent as (select 1 id) select * from ";
			const items = complete(SqlDocument.create(sql, "databricks"), sql.length, schema);
			const kinds = items.map((c) => `${c.kind}:${c.label}`);
			expect(kinds).toContain("cte:recent");
			expect(kinds).toContain("table:sales");
			expect(kinds.indexOf("cte:recent")).toBeLessThan(kinds.indexOf("table:sales")); // shadow rank
		});

		it("after a qualifier dot, offers the NEXT SEGMENT only (namespaces)", () => {
			const sql = "select * from analytics.";
			const items = complete(SqlDocument.create(sql, "databricks"), sql.length, nested);
			const labels = items.map((c) => `${c.kind}:${c.label}`);
			expect(labels).toContain("namespace:sales");
			expect(labels).toContain("namespace:marketing");
			expect(items.every((c) => !c.label.includes("."))).toBe(true); // segments, never full paths
			expect(labels.some((l) => l.startsWith("cte:"))).toBe(false); // no CTEs after a dot
		});

		it("after a deeper qualifier, offers that namespace's tables", () => {
			const sql = "select * from analytics.sales.";
			const items = complete(SqlDocument.create(sql, "databricks"), sql.length, nested);
			expect(items.map((c) => `${c.kind}:${c.label}`)).toContain("table:orders");
			expect(items.map((c) => c.label)).not.toContain("leads"); // other namespace's table
		});

		it("a partial segment after the dot is pruned to the typed prefix (2026-07-12 ruling)", () => {
			const sql = "select * from analytics.sa";
			const items = complete(SqlDocument.create(sql, "databricks"), sql.length, nested);
			expect(items.map((c) => `${c.kind}:${c.label}`)).toContain("namespace:sales");
			expect(items.map((c) => c.label)).not.toContain("marketing"); // doesn't start with "sa"
		});

		it("a column qualifier dot restricts columns to THAT source (anvil item 2)", () => {
			const two = new Schema({
				orders: { order_id: "int", amount: "decimal" },
				customers: { cust_id: "int", email: "string" },
			});
			const sql = "select o. from orders o join customers c on c.cust_id = o.order_id";
			const offset = "select o.".length;
			const items = complete(SqlDocument.create(sql, "databricks"), offset, two);
			const cols = items.filter((c) => c.kind === "column").map((c) => c.label);
			expect(cols).toContain("order_id");
			expect(cols).toContain("amount");
			expect(cols).not.toContain("email"); // the other source's columns stay out
			expect(cols).not.toContain("cust_id");
		});
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
