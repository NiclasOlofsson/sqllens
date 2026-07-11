import { describe, expect, test } from "vitest";
import { parse } from "../src/index.js";
import type { Dialect, SelectExpr, TableSource } from "../src/index.js";

// SQLite's grammar caps a table reference at two parts (`(schema_name '.')? table_name`) — there is
// no catalog level — so its multipart case is `a.b`, not the three-part `a.b.c` of the other dialects.
// MySQL's grammar is the same shape: `fullId: uid (DOT_ID | '.' uid)?` (grammars/mysql/MySqlParser.g4)
// caps a table reference at `schema.table`, no catalog level either.
//
// MySQL genuine-shape gap: an UNSPACED dot (`a.b`, the way everyone actually writes it) lexes as ONE
// fused `DOT_ID` token (`.b` — MySqlLexer.g4's `DOT_ID: '.' ID_LITERAL`), not a separate `.` + identifier.
// `dottedParts` (src/mysql/lower.ts) documents this: a DOT_ID-sourced part has no clean per-part span
// excluding the dot, so it pushes `undefined` — and `partSpansOf`'s all-or-nothing rule then drops the
// WHOLE array, not just that one part. `namePartSpans` is `undefined` for `a.b`, not a 2-element array.
// This is a real, currently-standing limitation of the upstream grammar fork, not a lower.ts bug.
const DIALECTS: { dialect: Dialect; multipart: { sql: string; parts: string[] }; noPartSpans?: boolean }[] = [
	{ dialect: "databricks", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "tsql", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "snowflake", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "bigquery", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "redshift", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "postgres", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "duckdb", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "trino", multipart: { sql: "select 1 from a.b.c", parts: ["a", "b", "c"] } },
	{ dialect: "sqlite", multipart: { sql: "select 1 from a.b", parts: ["a", "b"] } },
	{ dialect: "mysql", multipart: { sql: "select 1 from a.b", parts: ["a", "b"] }, noPartSpans: true },
];

describe("TableSource.namePartSpans", () => {
	for (const { dialect, multipart, noPartSpans } of DIALECTS) {
		test(`${dialect}: multipart table name gets one span per part`, () => {
			const r = parse(multipart.sql, dialect);
			expect(r.errors).toBe(0);
			const body = r.ast.body as SelectExpr;
			const src = body.from[0] as TableSource;
			expect(src.name).toEqual(multipart.parts);
			if (noPartSpans) {
				// See the MySQL genuine-shape comment above — the fused DOT_ID token drops all spans.
				expect(src.namePartSpans).toBeUndefined();
				return;
			}
			expect(src.namePartSpans).toBeDefined();
			expect(src.namePartSpans).toHaveLength(multipart.parts.length);
			for (const span of src.namePartSpans!) expect(span.start).toBeLessThan(span.end);
		});

		test(`${dialect}: single-part table name gets one span`, () => {
			const r = parse("select 1 from t", dialect);
			expect(r.errors).toBe(0);
			const body = r.ast.body as SelectExpr;
			const src = body.from[0] as TableSource;
			expect(src.name).toEqual(["t"]);
			expect(src.namePartSpans).toBeDefined();
			expect(src.namePartSpans).toHaveLength(1);
		});
	}
});
