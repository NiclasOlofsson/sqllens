import { describe, expect, test } from "vitest";
import { parse } from "../src/index.js";
import type { QueryExpr, SelectExpr, TableSource } from "../src/index.js";

const DIALECTS = ["databricks", "tsql", "snowflake", "bigquery", "redshift", "postgres", "duckdb", "trino"] as const;

describe("TableSource.namePartSpans", () => {
	for (const dialect of DIALECTS) {
		test(`${dialect}: multipart table name gets one span per part`, () => {
			const r = parse("select 1 from a.b.c", dialect);
			expect(r.errors).toBe(0);
			const body = r.ast.body as SelectExpr;
			const src = body.from[0] as TableSource;
			expect(src.name).toEqual(["a", "b", "c"]);
			expect(src.namePartSpans).toBeDefined();
			expect(src.namePartSpans).toHaveLength(3);
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
