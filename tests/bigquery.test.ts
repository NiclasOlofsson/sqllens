import { describe, expect, it } from "vitest";
import { parseBigQuery } from "../src/bigquery/parse.js";

describe("parseBigQuery", () => {
	it("parses a basic SELECT with zero errors", () => {
		expect(parseBigQuery("SELECT a, b FROM t").errors).toBe(0);
	});

	it("parses BigQuery-isms: backticks, EXCEPT, UNNEST", () => {
		expect(parseBigQuery("SELECT * EXCEPT (a) FROM `proj.ds.t`").errors).toBe(0);
		expect(parseBigQuery("SELECT x FROM UNNEST([1,2,3]) AS x").errors).toBe(0);
	});

	it("reports errors on garbage", () => {
		expect(parseBigQuery("SELECT FROM").errors).toBeGreaterThan(0);
	});
});

import { lower } from "../src/bigquery/lower.js";

function kind(sql: string) {
	const r = parseBigQuery(sql);
	expect(r.errors, sql).toBe(0);
	return lower(r.tree).statement;
}

describe("BigQuery statement category (from the parse)", () => {
	it("query / dml / ddl / utility / compound", () => {
		expect(kind("SELECT a FROM t")).toBe("query");
		expect(kind("WITH c AS (SELECT 1 AS x) SELECT x FROM c")).toBe("query");
		expect(kind("INSERT INTO t (a) VALUES (1)")).toBe("dml");
		expect(kind("CREATE TABLE t (a INT64)")).toBe("ddl");
		expect(kind("DROP TABLE t")).toBe("ddl");
		expect(kind("SELECT 1; SELECT 2")).toBe("compound");
	});
});
