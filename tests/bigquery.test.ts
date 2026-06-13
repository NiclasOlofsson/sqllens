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
