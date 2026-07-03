import { describe, expect, it } from "vitest";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { lower } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";

// T-SQL PIVOT/UNPIVOT produce a named relation referenced by an alias (`… AS pvt`); the lower()
// models the operation and scope exposes the result under that alias, so `pvt.col` resolves to the
// passthrough + produced columns.

function tree(sql: string) {
	return resolveScopes(lower(parseTSql(sql).tree), "tsql");
}

describe("T-SQL PIVOT / UNPIVOT", () => {
	const pivotSql =
		"SELECT pvt.cat, pvt.[2002], pvt.[2003] FROM (SELECT cat, yr, amt FROM sales) AS s " +
		"PIVOT (SUM(amt) FOR yr IN ([2002], [2003])) AS pvt";

	it("models PIVOT (values, FOR column, agg column, alias)", () => {
		// The IN-list names are stored RAW (Task 2 keep-raw — [2002] ≡ 2002 under the T-SQL fold);
		// the resolution proof is the no-false-diagnostics assertion in the next case.
		const body = tree(pivotSql).root.body;
		if (body.kind !== "select") throw new Error("select");
		expect(body.pivot).toMatchObject({
			values: ["[2002]", "[2003]"],
			forColumns: ["yr"],
			aggColumns: ["amt"],
			alias: "pvt",
		});
	});

	it("exposes the pivoted relation under its alias (pvt.col resolves; output = passthrough + values)", () => {
		const t = tree(pivotSql);
		const q = qualify(t, new Schema({}));
		expect(q.diagnostics.filter((d) => d.kind === "unknown-column")).toEqual([]);
		expect(q.columnsOf(t.root)).toEqual(["cat", "[2002]", "[2003]"]);
	});

	it("models UNPIVOT (value column, name column, removed inputs, alias) and resolves u.col", () => {
		const t = tree(
			"SELECT u.product, u.metric, u.val FROM (SELECT product, q1, q2 FROM t) AS s " +
				"UNPIVOT (val FOR metric IN (q1, q2)) AS u",
		);
		const body = t.root.body;
		if (body.kind !== "select") throw new Error("select");
		expect(body.unpivot).toMatchObject({
			valueColumn: "val",
			nameColumn: "metric",
			removed: ["q1", "q2"],
			alias: "u",
		});
		const q = qualify(t, new Schema({}));
		expect(q.diagnostics.filter((d) => d.kind === "unknown-column")).toEqual([]);
		expect(q.columnsOf(t.root)).toEqual(["product", "metric", "val"]);
	});
});
