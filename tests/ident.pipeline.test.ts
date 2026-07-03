import { describe, expect, it } from "vitest";
import { analyze, complete, SqlDocument } from "../src/api.js";
import { Schema } from "../src/qualify/schema.js";
import { formatType } from "../src/infer/types.js";
import { inferType } from "../src/infer/infer.js";

// End-to-end pipeline proof that quotedness survives lowering and every name comparison
// runs through the ONE dialect-true fold (src/ident/fold.ts) — the Task 2 acceptance cases.
//
// Fold directions are doc-cited in src/ident/fold.ts:
//  - Snowflake: unquoted → UPPER, quoted → preserve (docs.snowflake.com identifiers-syntax)
//  - Postgres:  unquoted → lower, quoted → preserve (postgresql.org/docs/18 §4.1.1)
//  - Redshift/DuckDB/Trino: quoted and unquoted both fold lower (case-insensitive even quoted)
//
// NOTE (coordinator ruling 2026-07-03): the Postgres case runs over DERIVED columns (a subquery's
// projections), not schema mapping keys — the Schema mapping format carries no quotedness signal
// (a JS object key can't say "I was quoted"), and Task 3 owns the schema-key fold. Query-side
// quote-awareness is what Task 2 proves.

describe("snowflake — unquoted folds UPPER, quoted preserves (schema-fed)", () => {
	const schema = new Schema({ ORDERS: { ID: "number" } });

	it("SELECT id FROM orders resolves clean (unquoted folds UPPER on both sides)", () => {
		const a = analyze("SELECT id FROM orders", "snowflake", { schema });
		expect(a.diagnostics).toEqual([]);
	});

	it('SELECT "id" FROM orders is an unknown column (quoted lowercase ≠ ID)', () => {
		const a = analyze('SELECT "id" FROM orders', "snowflake", { schema });
		expect(a.diagnostics.some((d) => d.kind === "unknown-column")).toBe(true);
	});

	it('SELECT "ID" FROM orders resolves (quoted preserves, matches ID exactly)', () => {
		const a = analyze('SELECT "ID" FROM orders', "snowflake", { schema });
		expect(a.diagnostics).toEqual([]);
	});
});

describe("postgres — quoted mixed-case and unquoted are two different derived columns", () => {
	const sql = `SELECT s."MyCol", s.mycol FROM (SELECT 1 AS "MyCol", 'x' AS mycol) s`;

	it("both references resolve clean (no diagnostics)", () => {
		const a = analyze(sql, "postgres");
		expect(a.diagnostics).toEqual([]);
	});

	it("the two references bind to two DIFFERENT columns (types don't conflate)", () => {
		const a = analyze(sql, "postgres");
		const body = a.ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		// s."MyCol" → the int literal 1; s.mycol → the string literal 'x'.
		expect(formatType(inferType(body.projections[0].expr, a.scopes.root, new Schema({})))).toBe("int");
		expect(formatType(inferType(body.projections[1].expr, a.scopes.root, new Schema({})))).toBe("string");
	});

	it('quoted "MYCOL" matches neither derived column (quoted is case-exact)', () => {
		const a = analyze(`SELECT s."MYCOL" FROM (SELECT 1 AS "MyCol", 'x' AS mycol) s`, "postgres");
		expect(a.diagnostics.some((d) => d.kind === "unknown-column")).toBe(true);
	});

	it('unquoted MyCol folds lower and matches the unquoted mycol column, not "MyCol"', () => {
		const a = analyze(`SELECT s.MyCol FROM (SELECT 1 AS "MyCol", 'x' AS mycol) s`, "postgres");
		expect(a.diagnostics).toEqual([]);
		const body = a.ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		expect(formatType(inferType(body.projections[0].expr, a.scopes.root, new Schema({})))).toBe("string");
	});
});

describe("databricks — backtick-quoted names round-trip (backticks are not case-quoting)", () => {
	it("a backtick-quoted projection alias echoing the column is NOT a separate declaration", () => {
		// `id` and ID fold to the same identity (backtick-strip + lower), so the projection is an
		// echo — deriveSymbols must not double-emit an output declaration for it.
		const a = analyze("SELECT `id` AS ID FROM t", "databricks");
		const decls = a.symbols.filter((s) => s.kind === "column" && s.modifiers.includes("declaration"));
		expect(decls).toEqual([]);
	});

	it("completion dedups a backtick-quoted column against its unquoted twin", () => {
		// The subquery exposes `Amount` (quoted) and amount (unquoted) — the same identity in
		// Databricks (backticks are not case-quoting), so completion must offer it once, with an
		// unquoted label. The caret sits at a valid WHERE position (the one value slot that parses
		// cleanly mid-edit — same construction as tests/completion/complete.test.ts).
		const sql = "SELECT amount FROM (SELECT 1 AS `Amount`, 2 AS amount) s WHERE ";
		const items = complete(SqlDocument.create(sql, "databricks"), sql.length);
		const amounts = items.filter(
			(c) => c.kind === "column" && c.label.toLowerCase().replace(/`/g, "") === "amount",
		);
		expect(amounts.length).toBe(1);
		expect(amounts[0].label).not.toContain("`"); // rendered via displayName — no delimiters
	});
});

describe.each(["redshift", "duckdb", "trino"] as const)('%s — quoted "FOO" ≡ unquoted foo', (dialect) => {
	const schema = new Schema({ t: { foo: "int" } });

	it('SELECT "FOO" FROM t resolves against the unquoted foo column', () => {
		const a = analyze('SELECT "FOO" FROM t', dialect, { schema });
		expect(a.diagnostics).toEqual([]);
	});

	it("SELECT foo FROM t still resolves (control)", () => {
		const a = analyze("SELECT foo FROM t", dialect, { schema });
		expect(a.diagnostics).toEqual([]);
	});
});
