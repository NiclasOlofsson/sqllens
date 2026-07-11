import type { ParserRuleContext } from "antlr4ng";
import { describe, expect, it } from "vitest";
import type { ColumnRef, PartSpan, SelectExpr } from "../src/ir/ir.js";
import { lower as lowerDatabricks } from "../src/databricks/lower.js";
import { lower as lowerTSql } from "../src/tsql/lower.js";
import { lower as lowerSnowflake } from "../src/snowflake/lower.js";
import { lower as lowerBigQuery } from "../src/bigquery/lower.js";
import { lower as lowerRedshift } from "../src/redshift/lower.js";
import { lower as lowerPostgres } from "../src/postgres/lower.js";
import { lower as lowerDuckdb } from "../src/duckdb/lower.js";
import { lower as lowerTrino } from "../src/trino/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { parseTSql } from "../src/tsql/parse.js";
import { parseSnowflake } from "../src/snowflake/parse.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { parseRedshift } from "../src/redshift/parse.js";
import { parsePostgres } from "../src/postgres/parse.js";
import { parseDuckdb } from "../src/duckdb/parse.js";
import { parseTrino } from "../src/trino/parse.js";
import { lower as lowerSqlite } from "../src/sqlite/lower.js";
import { parseSqlite } from "../src/sqlite/parse.js";
import { lower as lowerMysql } from "../src/mysql/lower.js";
import { parseMysql } from "../src/mysql/parse.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";

// P2 (Anvil): per-part spans on column references. For `o.order_id` the extension hit-tests the cursor
// on `o` (alias/relation actions) differently from `order_id` (column actions), so `ColumnRef`/`column`
// Expr carries `partSpans?` PARALLEL to `parts` — each covers that part's own token(s) INCLUDING the
// quoting delimiters but EXCLUDING the dots. It is all-or-nothing: present only when every part was read
// from a real token. Per dialect: `a.b.c` → 3 exact spans; a quoted qualifier (delimiters included); a
// bare column → 1 span; a synthesized-part ref → partSpans undefined. Plus the column `Sym` carries it.

type LowerFn = (tree: ParserRuleContext) => { body: unknown };
interface Dialect {
	name: string;
	parse: (sql: string) => { tree: ParserRuleContext };
	lower: LowerFn;
	/** The dialect's quoted-identifier form: source for `<quoted>.c` plus the exact delimited token the
	 *  first part's span must cover (delimiters included). */
	quoted: { sql: string; rawQualifier: string };
}

const DIALECTS: Dialect[] = [
	{
		name: "databricks",
		parse: parseDatabricks,
		lower: lowerDatabricks as LowerFn,
		quoted: { sql: "SELECT `a b`.c FROM t", rawQualifier: "`a b`" },
	},
	{
		name: "tsql",
		parse: parseTSql,
		lower: lowerTSql as LowerFn,
		quoted: { sql: "SELECT [a b].c FROM t", rawQualifier: "[a b]" },
	},
	{
		name: "snowflake",
		parse: parseSnowflake,
		lower: lowerSnowflake as LowerFn,
		quoted: { sql: 'SELECT "a b".c FROM t', rawQualifier: '"a b"' },
	},
	{
		name: "bigquery",
		parse: parseBigQuery,
		lower: lowerBigQuery as LowerFn,
		quoted: { sql: "SELECT `a b`.c FROM t", rawQualifier: "`a b`" },
	},
	{
		name: "redshift",
		parse: parseRedshift,
		lower: lowerRedshift as LowerFn,
		quoted: { sql: 'SELECT "a b".c FROM t', rawQualifier: '"a b"' },
	},
	{
		name: "postgres",
		parse: parsePostgres,
		lower: lowerPostgres as LowerFn,
		quoted: { sql: 'SELECT "a b".c FROM t', rawQualifier: '"a b"' },
	},
	{
		name: "duckdb",
		parse: parseDuckdb,
		lower: lowerDuckdb as LowerFn,
		quoted: { sql: 'SELECT "a b".c FROM t', rawQualifier: '"a b"' },
	},
	{
		name: "trino",
		parse: parseTrino,
		lower: lowerTrino as LowerFn,
		quoted: { sql: 'SELECT "a b".c FROM t', rawQualifier: '"a b"' },
	},
	{
		name: "sqlite",
		parse: parseSqlite,
		lower: lowerSqlite as LowerFn,
		quoted: { sql: 'SELECT "a b".c FROM t', rawQualifier: '"a b"' },
	},
	{
		name: "mysql",
		parse: parseMysql,
		lower: lowerMysql as LowerFn,
		quoted: { sql: "SELECT `a b`.c FROM t", rawQualifier: "`a b`" },
	},
];

function columns(d: Dialect, sql: string): ColumnRef[] {
	const body = d.lower(d.parse(sql).tree).body as SelectExpr;
	if (body.kind !== "select") throw new Error(`${d.name}: expected a select body, got ${body.kind}`);
	return body.columns;
}

/** The projected column ref (skip refs from other clauses / the FROM). */
function projected(d: Dialect, sql: string): ColumnRef {
	const proj = columns(d, sql).filter((c) => c.clause === "projection" && !c.parts.join(".").includes("*"));
	expect(proj.length, `${d.name}: exactly one projected column ref for ${sql}`).toBe(1);
	return proj[0];
}

/** Assert a span is well-formed against the SyntaxDiagnostic convention (line 1-based, column 0-based,
 *  start/end absolute char offsets, end exclusive) and covers exactly `expected` in the source. */
function expectSpan(sql: string, span: PartSpan, expected: string): void {
	expect(sql.slice(span.start, span.end)).toBe(expected);
	expect(span.end).toBe(span.start + expected.length);
	// single-line SQL here → 1-based line 1, and 0-based column equals the absolute offset.
	expect(span.line).toBe(1);
	expect(span.column).toBe(span.start);
}

describe("per-part spans on column references (P2)", () => {
	for (const d of DIALECTS) {
		describe(d.name, () => {
			it("a.b.c → three spans matching the source offsets exactly", () => {
				const sql = "SELECT a.b.c FROM t";
				const ref = projected(d, sql);
				expect(ref.parts).toEqual(["a", "b", "c"]);
				expect(ref.partSpans, "partSpans present").toBeDefined();
				expect(ref.partSpans!.length).toBe(3);
				expectSpan(sql, ref.partSpans![0], "a");
				expectSpan(sql, ref.partSpans![1], "b");
				expectSpan(sql, ref.partSpans![2], "c");
			});

			it("a quoted qualifier's span covers its delimiters, the dot excluded", () => {
				const { sql, rawQualifier } = d.quoted;
				const ref = projected(d, sql);
				expect(ref.parts.length).toBe(2);
				expect(ref.partSpans, "partSpans present").toBeDefined();
				expect(ref.partSpans!.length).toBe(2);
				// The qualifier span covers the whole delimited token (quotes/brackets/backticks included).
				expectSpan(sql, ref.partSpans![0], rawQualifier);
				// The second part is the bare `c` — no delimiter, no dot.
				expectSpan(sql, ref.partSpans![1], "c");
			});

			it("a bare column → one span over its own token", () => {
				const sql = "SELECT x FROM t";
				const ref = projected(d, sql);
				expect(ref.parts).toEqual(["x"]);
				expect(ref.partSpans!.length).toBe(1);
				expectSpan(sql, ref.partSpans![0], "x");
			});
		});
	}

	// all-or-nothing: a ref with any synthesized part carries NO partSpans (never a misaligned array). The
	// intermediate column of a subscript chain (`r.a[1]` → the `r.a` ref) is such a case — the final expr is
	// a subscript, so its inner column path is not wrapped with per-part spans.
	it("omits partSpans entirely when a part is synthesized (all-or-nothing)", () => {
		const d = DIALECTS.find((x) => x.name === "postgres")!;
		const sql = "SELECT r.a[1] FROM t";
		const ref = columns(d, sql).find((c) => c.parts.join(".") === "r.a");
		expect(ref, "the r.a column ref exists").toBeDefined();
		expect(ref!.partSpans).toBeUndefined();
	});

	// The column-reference Sym carries partSpans through so a consumer can hit-test parts on the symbol.
	it("column reference Sym carries partSpans", () => {
		const d = DIALECTS.find((x) => x.name === "databricks")!;
		const sql = "SELECT o.order_id FROM orders o";
		const ir = d.lower(d.parse(sql).tree) as never;
		const scopes = resolveScopes(ir, "databricks");
		const syms = deriveSymbols(scopes);
		const sym = syms.find(
			(s) => s.kind === "column" && s.name === "o.order_id" && s.modifiers.includes("reference"),
		);
		expect(sym, "the o.order_id reference symbol exists").toBeDefined();
		expect(sym!.partSpans, "the Sym carries partSpans").toBeDefined();
		expect(sym!.partSpans!.length).toBe(2);
	});

	// The DOT_ID fix, pinned by exact offsets. mysql lexes the unspaced `a.b` style as fused DOT_ID
	// tokens (`.b`, `.c` -- `DOT_ID: '.' ID_LITERAL`), not a `.` + identifier. dotIdPartSpanOf computes
	// each part's span one char past the leading dot, so the offsets are interchangeable with a
	// node-derived span. Hand-computed so an off-by-one on the dot cannot pass.
	describe("mysql fused DOT_ID part offsets", () => {
		const my = DIALECTS.find((x) => x.name === "mysql")!;

		it("SELECT a.b FROM t -> `a` at [7,8), `b` (from DOT_ID `.b`) at [9,10), line/column exact", () => {
			const sql = "SELECT a.b FROM t";
			const ref = projected(my, sql);
			expect(ref.parts).toEqual(["a", "b"]);
			expect(ref.partSpans!.length).toBe(2);
			expect(ref.partSpans![0]).toEqual({ start: 7, end: 8, line: 1, column: 7, endLine: 1, endColumn: 8 });
			// `b` comes from the fused DOT_ID `.b`: span starts one past the dot, ends at the token end.
			expect(ref.partSpans![1]).toEqual({ start: 9, end: 10, line: 1, column: 9, endLine: 1, endColumn: 10 });
		});

		it("SELECT a.b.c FROM t -> both dotted parts computed past their own dots", () => {
			const sql = "SELECT a.b.c FROM t";
			const ref = projected(my, sql);
			expect(ref.partSpans!.map((sp) => [sp.start, sp.end])).toEqual([
				[7, 8],
				[9, 10],
				[11, 12],
			]);
			// each DOT_ID identifier sits one column past its dot, never on it
			expect(ref.partSpans![1].column).toBe(9);
			expect(ref.partSpans![2].column).toBe(11);
		});
	});
});
