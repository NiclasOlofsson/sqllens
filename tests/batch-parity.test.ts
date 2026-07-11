import type { ParserRuleContext } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { statementCategories as catsDatabricks } from "../src/databricks/lower.js";
import { statementCategories as catsTSql } from "../src/tsql/lower.js";
import { statementCategories as catsSnowflake } from "../src/snowflake/lower.js";
import { statementCategories as catsBigQuery } from "../src/bigquery/lower.js";
import { statementCategories as catsRedshift } from "../src/redshift/lower.js";
import { statementCategories as catsPostgres } from "../src/postgres/lower.js";
import { statementCategories as catsDuckdb } from "../src/duckdb/lower.js";
import { statementCategories as catsTrino } from "../src/trino/lower.js";
import { statementCategories as catsSqlite } from "../src/sqlite/lower.js";
import { statementCategories as catsMysql } from "../src/mysql/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { parseTSql } from "../src/tsql/parse.js";
import { parseSnowflake } from "../src/snowflake/parse.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { parseRedshift } from "../src/redshift/parse.js";
import { parsePostgres } from "../src/postgres/parse.js";
import { parseDuckdb } from "../src/duckdb/parse.js";
import { parseTrino } from "../src/trino/parse.js";
import { parseSqlite } from "../src/sqlite/parse.js";
import { parseMysql } from "../src/mysql/parse.js";

// P4 (Anvil phase-0, item 4 — .superpowers/sdd/anvil-phase0-brief.md):
// "batch (multi-statement) parse parity — verify first." Databricks got a batch-level entry rule
// (`multiStatement`) 2026-06-28 (issue #1); this pins that the other dialects' entry rules are
// ALSO batch-level (a `;`-separated list of statements, not a single-statement rule), so
// `SELECT 1; SELECT 2;` parses with 0 errors and `statementCategories` reports two `query` entries,
// in source order, for every dialect.
//
// Scope, honestly stated: this is a PARSE-LEVEL parity pin only — it proves the entry rule accepts a
// multi-statement batch and that per-statement categorization sees two statements. It does NOT prove
// per-statement IR/spans (a `QueryExpr` per statement, sliceable independently) — that lands with the
// editor-gold wave's statement-cell work. `lower()` today still lowers the tree's single dominant body
// (see each dialect's lower() for its multi-statement handling — e.g. databricks flags a >1-element
// batch as a "compound" statement rather than producing N separate QueryExprs).
//
// T-SQL's grammar allows unterminated statements (`sql_clauses: dml_clause SEMI? | …`), so both a
// fully-terminated batch and a batch with no trailing semicolon are exercised there.

type Cats = (tree: ParserRuleContext) => string[];
interface Case {
	name: string;
	sql: string;
	parse: (sql: string) => { tree: ParserRuleContext; errors: number };
	cats: Cats;
}

const CASES: Case[] = [
	{ name: "databricks", sql: "SELECT 1; SELECT 2;", parse: parseDatabricks, cats: catsDatabricks },
	{ name: "tsql (terminated)", sql: "SELECT 1; SELECT 2;", parse: parseTSql, cats: catsTSql },
	{ name: "tsql (unterminated)", sql: "SELECT 1 SELECT 2", parse: parseTSql, cats: catsTSql },
	{ name: "snowflake", sql: "SELECT 1; SELECT 2;", parse: parseSnowflake, cats: catsSnowflake },
	{ name: "bigquery", sql: "SELECT 1; SELECT 2;", parse: parseBigQuery, cats: catsBigQuery },
	{ name: "redshift", sql: "SELECT 1; SELECT 2;", parse: parseRedshift, cats: catsRedshift },
	{ name: "postgres", sql: "SELECT 1; SELECT 2;", parse: parsePostgres, cats: catsPostgres },
	{ name: "duckdb", sql: "SELECT 1; SELECT 2;", parse: parseDuckdb, cats: catsDuckdb },
	{ name: "trino", sql: "SELECT 1; SELECT 2;", parse: parseTrino, cats: catsTrino },
	{ name: "sqlite", sql: "SELECT 1; SELECT 2;", parse: parseSqlite, cats: catsSqlite },
	{ name: "mysql", sql: "SELECT 1; SELECT 2;", parse: parseMysql, cats: catsMysql },
];

describe("batch parity — SELECT 1; SELECT 2; parses as two query statements", () => {
	for (const c of CASES) {
		it(c.name, () => {
			const { tree, errors } = c.parse(c.sql);
			expect(errors, `${c.name}: 0 parse errors`).toBe(0);
			expect(c.cats(tree), `${c.name}: two query-category statements`).toEqual(["query", "query"]);
		});
	}
});
