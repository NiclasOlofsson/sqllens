import { describe, expect, it } from "vitest";
import { parse } from "../../src/index.js";

// lower() is total: it must NEVER throw, and must always yield a frozen QueryExpr (kind "query"),
// even on empty / broken / mid-keystroke input. Editor features run on incomplete text, so a
// broken parse degrades to a flagged body — it does not blow up. This battery locks that contract
// across every dialect.

const BROKEN = [
	"",
	"(((",
	"SELEC",
	"SELECT a,, FROM",
	"FROM WHERE )(",
	"SELECT FROM t WHERE",
	"WITH x AS ( SELECT",
	")",
	";;",
	"SELECT * FORM x",
];

const DIALECTS = [
	"databricks",
	"tsql",
	"snowflake",
	"bigquery",
	"redshift",
	"postgres",
	"duckdb",
	"trino",
	"sqlite",
	"mysql",
] as const;

describe("lower() totality on broken input", () => {
	for (const dialect of DIALECTS) {
		for (const input of BROKEN) {
			it(`${dialect}: ${JSON.stringify(input)} lowers without throwing`, () => {
				let r: ReturnType<typeof parse>;
				expect(() => {
					r = parse(input, dialect);
				}).not.toThrow();
				expect(Object.isFrozen(r!.ast)).toBe(true);
				expect(r!.ast.kind).toBe("query");
			});
		}
	}

	// The specific regressions Task 4 closes — both threw before lower() was made total.
	it("databricks: '(((' no longer throws and yields a query", () => {
		const r = parse("(((", "databricks");
		expect(r.ast.kind).toBe("query");
	});

	it("databricks: broken CTE 'WITH x AS ( SELECT' no longer throws and yields a query", () => {
		const r = parse("WITH x AS ( SELECT", "databricks");
		expect(r.ast.kind).toBe("query");
	});
});
