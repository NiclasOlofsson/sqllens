import { describe, expect, it } from "vitest";
import { lower } from "../src/bigquery/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { inferType } from "../src/infer/infer.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";

// A function whose name collides with a Spark higher-order function (aggregate/reduce/transform/…)
// but is called with fewer args than that HOF form takes must NOT crash the inference engine by
// indexing a missing arg. Regression: BigQuery multi-level aggregation `AGGREGATE(x ORDER BY key)`
// lowers to a single-arg `aggregate(...)` call; higherOrder() read args[1] → inferType(undefined)
// → "Cannot read properties of undefined (reading 'kind')". The engine must be total.
describe("inferType arity safety on HOF-named calls", () => {
	it("does not throw on a single-arg call named like a higher-order function", () => {
		const sql = "SELECT AGGREGATE(measure_sum_quantity ORDER BY key) FROM MeasureTable_SingleKey";
		const tree = resolveScopes(lower(parseBigQuery(sql).tree), "bigquery");
		const body = tree.root.body;
		if (body.kind !== "select") throw new Error("expected select");
		expect(() => inferType(body.projections[0].expr, tree.root, new Schema({}))).not.toThrow();
	});
});
