import { describe, expect, it } from "vitest";
import type { ParserRuleContext } from "antlr4ng";
import {
	parseDatabricks,
	parseTSql,
	parseSnowflake,
	parseBigQuery,
	parseRedshift,
	parsePostgres,
	parseDuckdb,
	parseTrino,
	parseSqlite,
	parseMysql,
	lowerDatabricks,
	lowerTSql,
	lowerSnowflake,
	lowerBigQuery,
	lowerRedshift,
	lowerPostgres,
	lowerDuckdb,
	lowerTrino,
	lowerSqlite,
	lowerMysql,
} from "../src/index.js";

// Issue #21 (generalized) — a multi-statement batch (`a; b; c`) must NOT lower statement 1's IR
// with the CST span stretched to EOF. The flagged compound body's span must be BOUNDED to the first
// top-level statement, not the whole-file batch container (which reaches EOF). #21 fixed this for
// databricks; it was wrongly assumed generalized. This proves ALL dialects, so it cannot
// regress to "fixed for one" again.

const BATCH = `SELECT 1 AS a;\nSELECT 2 AS b;\nSELECT 3 AS c;`;

/** 0-based inclusive last char offset of a CST node's span. */
function spanEnd(cst: ParserRuleContext): number {
	return (cst.stop ?? cst.start)!.stop;
}

type Case = {
	dialect: string;
	parse: (sql: string) => { tree: ParserRuleContext; errors: number };
	lower: (tree: ParserRuleContext) => {
		statement?: string;
		cst: ParserRuleContext;
		body: { unsupported?: string[] };
	};
};

const CASES: Case[] = [
	{ dialect: "databricks", parse: parseDatabricks, lower: lowerDatabricks as Case["lower"] },
	{ dialect: "tsql", parse: parseTSql, lower: lowerTSql as Case["lower"] },
	{ dialect: "snowflake", parse: parseSnowflake, lower: lowerSnowflake as Case["lower"] },
	{ dialect: "bigquery", parse: parseBigQuery, lower: lowerBigQuery as Case["lower"] },
	{ dialect: "redshift", parse: parseRedshift, lower: lowerRedshift as Case["lower"] },
	{ dialect: "postgres", parse: parsePostgres, lower: lowerPostgres as Case["lower"] },
	{ dialect: "duckdb", parse: parseDuckdb, lower: lowerDuckdb as Case["lower"] },
	{ dialect: "trino", parse: parseTrino, lower: lowerTrino as Case["lower"] },
	{ dialect: "sqlite", parse: parseSqlite, lower: lowerSqlite as Case["lower"] },
	{ dialect: "mysql", parse: parseMysql, lower: lowerMysql as Case["lower"] },
];

describe("multi-statement batch span is bounded to statement 1 (all dialects, #21)", () => {
	const firstSemi = BATCH.indexOf(";"); // end of `SELECT 1 AS a`
	const fileEnd = BATCH.length - 1; // last char offset (EOF)

	for (const c of CASES) {
		it(`${c.dialect}: parses the 3-statement batch cleanly`, () => {
			expect(c.parse(BATCH).errors).toBe(0);
		});

		it(`${c.dialect}: lowers the batch as a compound, not a plain modelled query`, () => {
			const q = c.lower(c.parse(BATCH).tree);
			expect(q.statement).toBe("compound");
		});

		it(`${c.dialect}: does NOT stretch statement-1's span to EOF`, () => {
			const q = c.lower(c.parse(BATCH).tree);
			const end = spanEnd(q.cst);
			// The top IR node must be bounded to statement 1 — its span must not reach EOF.
			expect(end).toBeLessThan(fileEnd);
			expect(end).toBeLessThanOrEqual(firstSemi);
		});
	}
});
