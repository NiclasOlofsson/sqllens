import { describe, expect, it } from "vitest";
import { completeAt, type Completion, type Dialect, SqlDocument } from "../../src/api.js";
import { Schema } from "../../src/qualify/schema.js";

// 2026-07-12 ruling (.claude/PLAN.md, current-state log): "Completion returns prefix-pruned
// candidates, not raw per-slot sets" — completeAt already holds the token stream, the CST, and the
// dialect's fold rules, so it prunes by the typed prefix itself instead of dumping the whole
// per-slot set for the consumer to filter. This file is the acceptance suite for that build.

const schema = new Schema({ sales: { amount: "decimal", id: "int" }, staff: { name: "string" } });

const labels = (items: Completion[], kind: Completion["kind"]): string[] =>
	items.filter((c) => c.kind === kind).map((c) => c.label);

describe("completeAt prunes candidates by the typed prefix", () => {
	it("keyword slot: a partial keyword prunes to the matching keyword", () => {
		const sql = "SELECT amount FR";
		const items = completeAt(SqlDocument.create(sql, "databricks"), sql.length, schema);
		expect(labels(items, "keyword")).toEqual(["FROM"]);
	});

	it("column slot: a partial column name prunes out a non-matching column", () => {
		const sql = "SELECT amount FROM sales WHERE amo";
		const items = completeAt(SqlDocument.create(sql, "databricks"), sql.length, schema);
		expect(labels(items, "column")).toEqual(["amount"]); // "id" doesn't match "amo"
	});

	it("table slot: a partial table name prunes out a non-matching table", () => {
		const sql = "SELECT amount FROM sa";
		const items = completeAt(SqlDocument.create(sql, "databricks"), sql.length, schema);
		expect(labels(items, "table")).toEqual(["sales"]); // "staff" doesn't match "sa"
	});

	it("function slot: a partial function name prunes to matching functions only", () => {
		const sql = "SELECT ifn FROM sales";
		const offset = "SELECT ifn".length;
		const items = completeAt(SqlDocument.create(sql, "databricks"), offset, schema);
		expect(labels(items, "function")).toContain("ifnull");
		// pruned: a column that doesn't match the "ifn" prefix is no longer offered alongside it.
		expect(labels(items, "column")).not.toContain("amount");
	});

	it("an empty-prefix caret (a token boundary) returns the unpruned set, no replaceRange", () => {
		const sql = "SELECT  FROM sales"; // caret in the empty projection — nothing typed there yet
		const offset = "SELECT ".length;
		const items = completeAt(SqlDocument.create(sql, "databricks"), offset, schema);
		expect(items.replaceRange).toBeUndefined();
		// both schema columns present, unpruned — proves this caret genuinely took the no-prefix path.
		expect(labels(items, "column")).toEqual(expect.arrayContaining(["amount", "id"]));
	});

	it("caret mid-identifier: the prefix is only the text up to the caret, and the replace range never extends past it", () => {
		const sql = "SELECT ifnull FROM sales"; // caret lands inside "ifnull", not at its end
		const offset = "SELECT ifn".length;
		const items = completeAt(SqlDocument.create(sql, "databricks"), offset, schema);
		expect(items.replaceRange).toEqual({ start: "SELECT ".length, end: offset });
		expect(labels(items, "function")).toContain("ifnull"); // "ifn" is a prefix of "ifnull"
	});

	describe.each<Dialect>(["databricks", "postgres"])("folding-aware keyword match (%s)", (dialect) => {
		it("a lowercase-typed prefix matches the grammar's upper-case keyword literal", () => {
			const sql = "sel";
			const items = completeAt(SqlDocument.create(sql, dialect), sql.length);
			expect(labels(items, "keyword")).toContain("SELECT");
		});
	});

	// PostgreSQL: unquoted identifiers fold ascii-lower (case-insensitive), quoted identifiers
	// preserve case exactly (postgresql.org/docs/18/sql-syntax-lexical.html, src/postgres/fold.ts) —
	// real fold-rule awareness, not a blanket case-insensitive compare.
	describe("quoted-identifier prefix folding (postgres)", () => {
		it("a closed quoted prefix matches a same-case candidate, and the range covers the opening quote", () => {
			const sql = 'SELECT "amount" FROM sales';
			const offset = 'SELECT "amo'.length;
			const items = completeAt(SqlDocument.create(sql, "postgres"), offset, schema);
			expect(labels(items, "column")).toEqual(["amount"]);
			expect(items.replaceRange).toEqual({ start: "SELECT ".length, end: offset });
			expect(sql.slice(items.replaceRange!.start, items.replaceRange!.end)).toBe('"amo');
		});

		it("a closed quoted prefix does NOT match a different-case candidate — quoting is case-sensitive", () => {
			const sql = 'SELECT "AMOUNT" FROM sales'; // typed prefix case ("AMO") mismatches "amount"
			const offset = 'SELECT "AMO'.length;
			const items = completeAt(SqlDocument.create(sql, "postgres"), offset, schema);
			expect(labels(items, "column")).toEqual([]);
		});

		it("the same prefix unquoted matches case-insensitively", () => {
			const sql = "SELECT AMOUNT FROM sales";
			const offset = "SELECT AMO".length;
			const items = completeAt(SqlDocument.create(sql, "postgres"), offset, schema);
			expect(labels(items, "column")).toEqual(["amount"]);
		});
	});

	describe("backtick-identifier prefix (databricks)", () => {
		it("a closed backtick prefix prunes, and the replace range covers the opening backtick", () => {
			const sql = "SELECT `amount` FROM sales";
			const offset = "SELECT `amo".length;
			const items = completeAt(SqlDocument.create(sql, "databricks"), offset, schema);
			expect(labels(items, "column")).toEqual(["amount"]);
			expect(items.replaceRange).toEqual({ start: "SELECT ".length, end: offset });
			expect(sql.slice(items.replaceRange!.start, items.replaceRange!.end)).toBe("`amo");
		});
	});

	// MySQL folds unquoted AND backtick-quoted identifiers case-insensitively alike (dev.mysql.com,
	// src/mysql/fold.ts), and its lexer error-recovers a still-open backtick as a lone skipped
	// character ahead of a clean identifier token — the one dialect where an UNTERMINATED backtick
	// (the literal `` `my_t `` shape from the ruling, mid-typing before the closing tick) still
	// reaches a real candidate set end to end (most other dialects' ATN candidate walk can't get
	// past that stray recovered token — a pre-existing walk limitation, not addressed here).
	it("an unterminated backtick prefix prunes end to end on a dialect whose lexer recovers cleanly (mysql)", () => {
		const sql = "SELECT `amo FROM sales";
		const offset = "SELECT `amo".length;
		const items = completeAt(SqlDocument.create(sql, "mysql"), offset, schema);
		expect(labels(items, "column")).toEqual(["amount"]);
		expect(sql.slice(items.replaceRange!.start, items.replaceRange!.end)).toBe("`amo");
	});
});
