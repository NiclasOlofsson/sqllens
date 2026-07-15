import { describe, expect, test } from "vitest";
import { parse } from "../src/index.js";
import type { Dialect, SelectExpr, TableSource } from "../src/index.js";

// SQLite's grammar caps a table reference at two parts (`(schema_name '.')? table_name`) — there is
// no catalog level — so its multipart case is `a.b`, not the three-part `a.b.c` of the other dialects.
// MySQL's grammar is the same shape: `fullId: uid (DOT_ID | '.' uid)?` (grammars/mysql/MysqlParser.g4)
// caps a table reference at `schema.table`, no catalog level either.
//
// MySQL's UNSPACED `a.b` (the way everyone actually writes it) lexes the dotted part as ONE fused
// `DOT_ID` token (`.b` -- MysqlLexer.g4's `DOT_ID: '.' ID_LITERAL`), not a separate `.` + identifier.
// `dottedParts` (src/mysql/lower.ts) computes that part's span past the leading dot via dotIdPartSpanOf,
// so `namePartSpans` for `a.b` is a real 2-element array with per-part addressability -- same as the
// spaced style and every other dialect. ID_LITERAL admits only a plain identifier, so no quoting
// delimiter hides in the fused token (a backtick-quoted part takes the `'.' uid` path instead).
const DIALECTS: { dialect: Dialect; multipart: { sql: string; parts: string[] } }[] = [
	{ dialect: "databricks", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "tsql", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "snowflake", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "bigquery", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "redshift", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "postgres", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "duckdb", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "trino", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "sqlite", multipart: { sql: "select 1 from a.b", parts: ["a", "b"] } },
	{ dialect: "mysql", multipart: { sql: "select 1 from a.b", parts: ["a", "b"] } },
];

describe("TableSource.namePartSpans", () => {
	for (const { dialect, multipart } of DIALECTS) {
		test(`${dialect}: multipart table name gets one span per part`, () => {
			const r = parse(multipart.sql, dialect);
			expect(r.errors).toBe(0);
			const body = r.ast.body as SelectExpr;
			const src = body.from[0] as TableSource;
			expect(src.relation.parts).toEqual(multipart.parts);
			expect(src.namePartSpans).toBeDefined();
			expect(src.namePartSpans).toHaveLength(multipart.parts.length);
			for (const span of src.namePartSpans!) expect(span.start).toBeLessThan(span.end);
		});

		test(`${dialect}: single-part table name gets one span`, () => {
			const r = parse("select 1 from t", dialect);
			expect(r.errors).toBe(0);
			const body = r.ast.body as SelectExpr;
			const src = body.from[0] as TableSource;
			expect(src.relation.parts).toEqual(["t"]);
			expect(src.namePartSpans).toBeDefined();
			expect(src.namePartSpans).toHaveLength(1);
		});
	}

	test("mysql: unspaced a.b table name gets fused-DOT_ID spans at exact offsets", () => {
		const r = parse("select 1 from a.b", "mysql");
		expect(r.errors).toBe(0);
		const src = (r.ast.body as SelectExpr).from[0] as TableSource;
		expect(src.relation.parts).toEqual(["a", "b"]);
		// `a` is a uid; `b` comes from the fused DOT_ID `.b` (its span starts one past the dot).
		expect(src.namePartSpans!.map((sp) => [sp.start, sp.end])).toEqual([
			[14, 15],
			[16, 17],
		]);
		expect(src.namePartSpans![1]).toMatchObject({ start: 16, end: 17, line: 1, column: 16 });
	});
});
