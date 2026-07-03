import { describe, expect, it } from "vitest";
import { lower as lowerBq } from "../src/bigquery/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { lower as lowerDbx } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { lower as lowerTsql } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";
import { lower as lowerRs } from "../src/redshift/lower.js";
import { parseRedshift } from "../src/redshift/parse.js";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";

// End-to-end PIVOT/UNPIVOT: the QUALIFIED (schema-fed) output columns must reflect the reshape — not
// just the extracted PivotInfo, and not just the schema-free scope outputs. This gate is the one that
// was missing: previously pivot was wired into scope (schema-free) but NOT into qualify/resolve, so a
// `SELECT * FROM t PIVOT(…)` resolved to the un-pivoted base columns. The reshape is dialect-neutral, so
// it must hold for both the BigQuery and Databricks (Spark) lowerers onto the shared IR.

const BQ = new Schema({ "proj.ds.t": { product: "STRING", quarter: "STRING", sales: "INT64" } });
const DBX = new Schema({ t: { product: "STRING", quarter: "STRING", sales: "INT" } });
const RS = new Schema({ t: { product: "varchar", quarter: "varchar", sales: "int4" } });

function rsCols(sql: string): string[] | "unknown" {
	const r = parseRedshift(sql);
	expect(r.errors, sql).toBe(0);
	const tree = resolveScopes(lowerRs(r.tree), "redshift");
	return qualify(tree, RS).columnsOf(tree.root);
}

function bqCols(sql: string): string[] | "unknown" {
	const r = parseBigQuery(sql);
	expect(r.errors, sql).toBe(0);
	const tree = resolveScopes(lowerBq(r.tree), "bigquery");
	return qualify(tree, BQ).columnsOf(tree.root);
}

function dbxCols(sql: string): string[] | "unknown" {
	const r = parseDatabricks(sql);
	expect(r.errors, sql).toBe(0);
	const tree = resolveScopes(lowerDbx(r.tree));
	return qualify(tree, DBX).columnsOf(tree.root);
}

describe("PIVOT / UNPIVOT — qualified output reflects the reshape (dialect-neutral)", () => {
	it("BigQuery PIVOT: consumes FOR + aggregate columns, adds the IN-list values", () => {
		expect(bqCols("SELECT * FROM `proj.ds.t` PIVOT(SUM(sales) FOR quarter IN ('Q1' AS q1, 'Q2' AS q2))")).toEqual([
			"product",
			"q1",
			"q2",
		]);
	});

	it("BigQuery UNPIVOT: consumes the IN-list columns, adds name + value", () => {
		expect(bqCols("SELECT * FROM `proj.ds.t` UNPIVOT(val FOR q IN (sales))")).toEqual([
			"product",
			"quarter",
			"q",
			"val",
		]);
	});

	it("Databricks PIVOT lowers to the same IR and reshapes identically", () => {
		expect(dbxCols("SELECT * FROM t PIVOT(SUM(sales) FOR quarter IN ('Q1' AS q1, 'Q2' AS q2))")).toEqual([
			"product",
			"q1",
			"q2",
		]);
	});

	// docs.aws.amazon.com/redshift/latest/dg/r_FROM_clause-pivot-unpivot-examples.html — the Redshift
	// lowerer feeds the same PivotInfo/UnpivotInfo IR, so the schema-fed reshape holds unchanged.
	it("Redshift PIVOT: consumes FOR + aggregate columns, adds the IN-list values", () => {
		expect(rsCols("SELECT * FROM t PIVOT (SUM(sales) FOR quarter IN ('Q1' AS q1, 'Q2' AS q2))")).toEqual([
			"product",
			"q1",
			"q2",
		]);
	});

	it("Redshift UNPIVOT: consumes the IN-list columns, adds name + value", () => {
		expect(rsCols("SELECT * FROM t UNPIVOT (val FOR q IN (sales))")).toEqual(["product", "quarter", "q", "val"]);
	});
});

// The ALIASED form `PIVOT(…) AS p` consumes the base relation and exposes a single named relation `p`
// whose columns are the reshaped set — computed schema-fed. So `SELECT *`, an unqualified value column,
// and a `p.col` reference all resolve against the pivoted columns (no false unknown-column), and the base
// table is no longer independently visible.
describe("aliased PIVOT … AS p — the named pivoted relation resolves schema-fed", () => {
	const T = new Schema({ t: { product: "STRING", quarter: "STRING", sales: "INT" } });
	function tsql(sql: string) {
		const r = parseTSql(sql);
		expect(r.errors, sql).toBe(0);
		const tree = resolveScopes(lowerTsql(r.tree), "tsql");
		return qualify(tree, T);
	}
	const P = "FROM t PIVOT (SUM(sales) FOR quarter IN ([Q1], [Q2])) AS p";

	it("SELECT * exposes the pivoted columns (base consumed)", () => {
		// The IN-list names are stored RAW (Task 2 keep-raw); [Q1] ≡ Q1 under the T-SQL fold —
		// resolution is proven by the no-false-diagnostics case below.
		const tree = resolveScopes(lowerTsql(parseTSql(`SELECT * ${P}`).tree), "tsql");
		expect(qualify(tree, T).columnsOf(tree.root)).toEqual(["product", "[Q1]", "[Q2]"]);
	});

	it("a qualified p.col and an unqualified value column both resolve (no false diagnostics)", () => {
		expect(tsql(`SELECT p.Q1 ${P}`).diagnostics).toEqual([]);
		expect(tsql(`SELECT Q1 ${P}`).diagnostics).toEqual([]);
	});

	it("BigQuery aliased PIVOT resolves identically", () => {
		expect(
			bqCols("SELECT * FROM `proj.ds.t` PIVOT(SUM(sales) FOR quarter IN ('Q1' AS q1, 'Q2' AS q2)) AS p"),
		).toEqual(["product", "q1", "q2"]);
	});
});
