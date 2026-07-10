import { describe, expect, test } from "vitest";
import { parse } from "../src/index.js";
import type { Dialect, SelectExpr, TableSource } from "../src/index.js";

// SQLite's grammar caps a table reference at two parts (`(schema_name '.')? table_name`) — there is
// no catalog level — so its multipart case is `a.b`, not the three-part `a.b.c` of the other dialects.
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
];

describe("TableSource.namePartSpans", () => {
	for (const { dialect, multipart } of DIALECTS) {
		test(`${dialect}: multipart table name gets one span per part`, () => {
			const r = parse(multipart.sql, dialect);
			expect(r.errors).toBe(0);
			const body = r.ast.body as SelectExpr;
			const src = body.from[0] as TableSource;
			expect(src.name).toEqual(multipart.parts);
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
