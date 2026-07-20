import { describe, expect, it } from "vitest";
import { parseDatabricks as parse } from "../../src/databricks/parse.js";
import { lower } from "../../src/databricks/lower.js";
import { resolveScopes } from "../../src/scope/scope.js";
import { Schema } from "../../src/qualify/schema.js";
import { referencesAt, type Occurrences } from "../../src/references/references.js";
import type { Span } from "../../src/symbols/symbols.js";
import { LineIndex } from "../../src/document/line-index.js";
import { toScopes } from "../../src/index.js";
import type { Dialect } from "../../src/index.js";

// Build a ScopeTree + IR for a Databricks query (the dialect doesn't matter — the engine runs on
// the shared IR). Returns the tree, ast, and a LineIndex so the test can map spans back to text.
function build(sql: string) {
	const { tree } = parse(sql);
	const ast = lower(tree);
	const scopes = resolveScopes(ast, "databricks");
	return { scopes, ast, lines: new LineIndex(sql), sql };
}

/** The exact source text a Span covers (Span: 1-based line, 0-based column; end exclusive). */
function slice(sql: string, lines: LineIndex, span: Span): string {
	const from = lines.offsetAt(span.line - 1, span.column);
	const to = lines.offsetAt(span.endLine - 1, span.endColumn);
	return sql.slice(from, to);
}

const SCHEMA = new Schema({ t: { a: "int" } });

describe("referencesAt — core occurrence engine", () => {
	const SQL = "WITH r AS (SELECT a FROM t) SELECT a FROM r";
	//            0         1         2         3         4
	//            0123456789012345678901234567890123456789012

	it("on the final SELECT's column `a`: occurrences cover the uses + a declaration", () => {
		const { scopes, ast, lines } = build(SQL);
		const off = SQL.lastIndexOf("a"); // the `a` in the final `SELECT a`
		expect(SQL[off]).toBe("a");

		const result = referencesAt(scopes, off, SCHEMA, ast);
		expect(result).not.toBeNull();
		const r = result as Occurrences;
		expect(r.symbol).toBe("a");
		expect(r.kind).toBe("column");

		// Every occurrence's span must slice back to the column text `a`.
		for (const occ of r.occurrences) {
			expect(slice(SQL, lines, occ.span)).toBe("a");
		}
		// The final-SELECT `a` reference is among them.
		const offsets = r.occurrences.map((o) => lines.offsetAt(o.span.line - 1, o.span.column));
		expect(offsets).toContain(off);
		// The CTE-internal `a` (shares identity through the CTE output) is included too.
		const innerA = SQL.indexOf("a", SQL.indexOf("SELECT") + 6); // the `a` in (SELECT a FROM t)
		expect(offsets).toContain(innerA);
		// A declaration is reported.
		expect(r.declaration).toBeDefined();
		expect(r.occurrences.some((o) => o.role === "declaration")).toBe(true);
	});

	it("on the `r` in `FROM r`: reports the CTE declaration + the use", () => {
		const { scopes, ast, lines } = build(SQL);
		const off = SQL.lastIndexOf("r"); // the `r` in `FROM r`
		expect(SQL[off]).toBe("r");

		const result = referencesAt(scopes, off, SCHEMA, ast);
		expect(result).not.toBeNull();
		const r = result as Occurrences;
		expect(r.symbol).toBe("r");
		expect(r.kind).toBe("cte");
		expect(r.declaration).toBeDefined();
		// The declaration span is the CTE definition (covers the `r AS (…)` text, starts at the name `r`).
		expect(slice(SQL, lines, r.declaration!)).toContain("r");
		// The use in FROM is a reference occurrence.
		const refOffsets = r.occurrences
			.filter((o) => o.role === "reference")
			.map((o) => lines.offsetAt(o.span.line - 1, o.span.column));
		expect(refOffsets).toContain(off);
		// And there is a declaration occurrence.
		expect(r.occurrences.some((o) => o.role === "declaration")).toBe(true);
	});

	it("works schema-free for in-query columns (no Schema given)", () => {
		const { scopes, ast } = build(SQL);
		const off = SQL.lastIndexOf("a");
		const result = referencesAt(scopes, off, undefined, ast);
		expect(result).not.toBeNull();
		expect((result as Occurrences).symbol).toBe("a");
		// At least the final-SELECT reference is found without a schema.
		expect((result as Occurrences).occurrences.length).toBeGreaterThan(0);
	});

	it("base-table column identity unifies uses across the CTE boundary with a schema", () => {
		// `a` flows t.a -> r.a -> output a. With the schema, the base-table origin (t.a) is the key,
		// so a click on the output `a` finds every occurrence including the CTE-internal `a`.
		const { scopes, ast } = build(SQL);
		const off = SQL.lastIndexOf("a");
		const withSchema = referencesAt(scopes, off, SCHEMA, ast) as Occurrences;
		const withoutSchema = referencesAt(scopes, off, undefined, ast) as Occurrences;
		// Schema-fed cross-identity should find at least as many occurrences as schema-free.
		expect(withSchema.occurrences.length).toBeGreaterThanOrEqual(withoutSchema.occurrences.length);
	});

	it("returns null when the cursor is not on a resolvable symbol", () => {
		const { scopes, ast } = build(SQL);
		const off = SQL.indexOf("WITH"); // on a keyword, not a symbol
		expect(referencesAt(scopes, off, SCHEMA, ast)).toBeNull();
	});

	it("never throws on broken input and returns null off-symbol", () => {
		const broken = "SELECT (((";
		const { tree } = parse(broken);
		const ast = lower(tree);
		const scopes = resolveScopes(ast, "databricks");
		expect(() => referencesAt(scopes, 0, undefined, ast)).not.toThrow();
		expect(() => referencesAt(scopes, broken.length, undefined, ast)).not.toThrow();
		// On a position with no resolvable symbol, null (not a throw).
		expect(referencesAt(scopes, broken.length - 1, undefined, ast)).toBeNull();
	});

	it("a qualified column reference resolves to the same identity as its bare use", () => {
		const sql = "SELECT t.a, a FROM t";
		const schema = new Schema({ t: { a: "int" } });
		const { tree } = parse(sql);
		const ast = lower(tree);
		const scopes = resolveScopes(ast, "databricks");
		const lines = new LineIndex(sql);
		const off = sql.indexOf("a", sql.indexOf("t.") + 2); // the `a` in `t.a`
		const result = referencesAt(scopes, off, schema, ast) as Occurrences;
		expect(result).not.toBeNull();
		expect(result.symbol).toBe("a");
		// Both `t.a` and the bare `a` should be occurrences (same base-table column t.a).
		const refTexts = result.occurrences.map((o) => slice(sql, lines, o.span));
		expect(refTexts.some((s) => s.includes("a"))).toBe(true);
		expect(result.occurrences.length).toBeGreaterThanOrEqual(2);
	});
});

// ---------------------------------------------------------------------------
// Vocabulary contract — Occurrences.symbol is a DISPLAY name (unquote-only, no case change),
// never the dialect-folded identity key: it feeds hover/go-to-definition/rename text, and a
// consumer must see what was written, not a case-folded catalog key (the same #38 ruling
// symbols.ts's relationSymbol documents — "shows a table's as-written spelling, not the folded
// identity key" — applied to the sibling references surface, which carried no such pin before).
// Matching internally still runs through the ONE fold engine underneath (proven correct
// elsewhere per-dialect: tests/ident.fold.test.ts, lineage.hops.test.ts's case-preserving hop);
// this only pins what the identity RENDERS as, across the three fold-family shapes
// tests/vocabulary-contract.test.ts uses for the union views.
// ---------------------------------------------------------------------------
describe("referencesAt — vocabulary: Occurrences.symbol is display text, not the fold key", () => {
	const dialects: { dialect: Dialect; label: string }[] = [
		{ dialect: "duckdb", label: "lower/lower" },
		{ dialect: "snowflake", label: "upper/preserve" },
		{ dialect: "postgres", label: "lower/preserve" },
	];

	for (const { dialect, label } of dialects) {
		it(`${dialect} (${label}): an unquoted mixed-case column renders as WRITTEN`, () => {
			const sql = "select Upper_Col from t";
			const scopes = toScopes(sql, { dialect });
			const occ = referencesAt(scopes, sql.indexOf("Upper_Col") + 1);
			expect(occ?.symbol).toBe("Upper_Col");
		});

		it(`${dialect} (${label}): a quoted CTE name renders with delimiters stripped, case preserved`, () => {
			const sql = 'with "Mixed_Cte" as (select a from t) select a from "Mixed_Cte"';
			const scopes = toScopes(sql, { dialect });
			const occ = referencesAt(scopes, sql.lastIndexOf("Mixed_Cte") + 1);
			expect(occ?.symbol).toBe("Mixed_Cte"); // quotes stripped, mixed case kept verbatim
			expect(occ?.kind).toBe("cte");
		});
	}
});
