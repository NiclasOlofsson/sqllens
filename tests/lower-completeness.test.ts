import { describe, expect, it } from "vitest";
import { grammarCoverage, type CoverageConfig } from "./helpers/grammar-coverage.js";
import { DatabricksParser } from "../src/generated/databricks/DatabricksParser.js";
import { DatabricksLexer } from "../src/generated/databricks/DatabricksLexer.js";
import { lower as lowerDatabricks } from "../src/databricks/lower.js";
import { TSqlParser } from "../src/generated/tsql/TSqlParser.js";
import { TSqlLexer } from "../src/generated/tsql/TSqlLexer.js";
import { lower as lowerTSql } from "../src/tsql/lower.js";
import { SnowflakeParser } from "../src/generated/snowflake/SnowflakeParser.js";
import { SnowflakeLexer } from "../src/generated/snowflake/SnowflakeLexer.js";
import { lower as lowerSnowflake } from "../src/snowflake/lower.js";
import { GoogleSQLParser } from "../src/generated/bigquery/GoogleSQLParser.js";
import { GoogleSQLLexer } from "../src/generated/bigquery/GoogleSQLLexer.js";
import { lower as lowerBigQuery } from "../src/bigquery/lower.js";
import { RedshiftParser } from "../src/generated/redshift/RedshiftParser.js";
import { RedshiftLexer } from "../src/generated/redshift/RedshiftLexer.js";
import { lower as lowerRedshift } from "../src/redshift/lower.js";
import { parseRedshift } from "../src/redshift/parse.js";
import { PostgresParser } from "../src/generated/postgres/PostgresParser.js";
import { PostgresLexer } from "../src/generated/postgres/PostgresLexer.js";
import { lower as lowerPostgres } from "../src/postgres/lower.js";
import { DuckdbParser } from "../src/generated/duckdb/DuckdbParser.js";
import { DuckdbLexer } from "../src/generated/duckdb/DuckdbLexer.js";
import { lower as lowerDuckdb } from "../src/duckdb/lower.js";
import { TrinoParser } from "../src/generated/trino/TrinoParser.js";
import { TrinoLexer } from "../src/generated/trino/TrinoLexer.js";
import { lower as lowerTrino } from "../src/trino/lower.js";
import { SqliteParser } from "../src/generated/sqlite/SqliteParser.js";
import { SqliteLexer } from "../src/generated/sqlite/SqliteLexer.js";
import { lower as lowerSqlite } from "../src/sqlite/lower.js";
import { MysqlParser } from "../src/generated/mysql/MysqlParser.js";
import { MysqlLexer } from "../src/generated/mysql/MysqlLexer.js";
import { lower as lowerMysql } from "../src/mysql/lower.js";

// What this asserts — and DELIBERATELY does NOT:
//
// The engine (tests/helpers/grammar-coverage.ts) fuzzes each dialect: it walks the grammar from the
// query entry rule and mechanically generates statements (recursive holes from a generic pool, DDL/graph
// excluded). The one real SIGNAL about lower() we assert is:
//   lower() NEVER THROWS on grammar-legal input — it is contractually total. A genuine robustness guard.
//
// We do NOT assert `covered` or `flagged`; both are logged as NOISE only. `covered` counts what the RANDOM
// GENERATOR reached — a function of grammar shape + seed, computed before lower() even runs, so a lower()
// regression cannot move it (it made a poor coverage floor and was dropped). `flagged` is mostly malformed
// combinations the grammar accepts, not gaps. Real lower() coverage is pinned by the curated clean-repro
// tests below and the per-dialect corpus gates.

const DBX_POOL = {
	namedExpression: ["a", "a AS x", "count(a)"],
	expression: ["a > 0", "a", "1"],
	booleanExpression: ["a > 0", "a IS NOT NULL"],
	valueExpression: ["a", "a + 1", "1"],
	primaryExpression: ["a", "count(a)", "1"],
	multipartIdentifier: ["t1", "t2", "a"],
	errorCapturingIdentifier: ["a", "x"],
	identifier: ["a", "x"],
	functionName: ["count"],
};
const TSQL_POOL = {
	expression: ["a", "a + 1", "1", "count(a)"],
	search_condition: ["a > 0", "a = 1"],
	predicate: ["a > 0"],
	table_name: ["t1", "t2"],
	full_column_name: ["a", "b"],
	id_: ["x"],
};
const SF_POOL = {
	expr: ["a", "a + 1", "1", "count(a)"],
	predicate: ["a > 0"],
	search_condition: ["a > 0", "a = 1"],
	column_name: ["a", "b"],
	object_name: ["t1", "t2"],
	full_column_name: ["a"],
	id_: ["x"],
};
const BQ_POOL = {
	expression: ["a", "a + 1", "1"],
	select_list_item: ["a", "a AS x"],
	path_expression: ["t1", "a"],
	identifier: ["x"],
};
const RS_POOL = {
	a_expr: ["a", "a + 1", "1", "sum(a)"],
	b_expr: ["a", "1"],
	c_expr: ["a", "1"],
	columnref: ["a", "b"],
	colid: ["b", "c"],
	collabel: ["p1"],
	qualified_name: ["t1", "t2"],
};
// postgres + duckdb are the bytebase pg-derived pair — same rule names as redshift.
const PG_POOL = RS_POOL;
const TRINO_POOL = {
	expression: ["a", "a + 1", "1"],
	booleanExpression: ["a > 0", "a"],
	valueExpression: ["a", "a + 1", "1"],
	primaryExpression: ["a", "count(a)", "1"],
	identifier: ["x"],
	qualifiedName: ["t1", "t2"],
};
const SQLITE_POOL = {
	expr: ["a", "a + 1", "1", "count(a)"],
	column_name: ["a", "b"],
	table_name: ["t1", "t2"],
	any_name: ["x"],
};
const MYSQL_POOL = {
	expression: ["a", "a > 0", "1"],
	predicate: ["a", "a + 1", "1"],
	expressionAtom: ["a", "count(a)", "1"],
	fullColumnName: ["a", "b"],
	tableName: ["t1", "t2"],
	uid: ["x"],
};

interface DialectCfg {
	label: string;
	cfg: CoverageConfig;
}
const DIALECTS: DialectCfg[] = [
	{
		label: "Databricks",
		cfg: {
			Parser: DatabricksParser as never,
			Lexer: DatabricksLexer as never,
			parseEntry: "compoundOrSingleStatement",
			lower: lowerDatabricks as never,
			entryRule: "RULE_query",
			pool: DBX_POOL,
		},
	},
	{
		label: "T-SQL",
		cfg: {
			Parser: TSqlParser as never,
			Lexer: TSqlLexer as never,
			parseEntry: "tsql_file",
			lower: lowerTSql as never,
			entryRule: "RULE_select_statement_standalone",
			pool: TSQL_POOL,
		},
	},
	{
		label: "Snowflake",
		cfg: {
			Parser: SnowflakeParser as never,
			Lexer: SnowflakeLexer as never,
			parseEntry: "snowflake_file",
			lower: lowerSnowflake as never,
			entryRule: "RULE_query_statement",
			pool: SF_POOL,
		},
	},
	{
		label: "BigQuery",
		cfg: {
			Parser: GoogleSQLParser as never,
			Lexer: GoogleSQLLexer as never,
			parseEntry: "root",
			lower: lowerBigQuery as never,
			entryRule: "RULE_query",
			pool: BQ_POOL,
		},
	},
	{
		label: "Redshift",
		cfg: {
			Parser: RedshiftParser as never,
			Lexer: RedshiftLexer as never,
			parseEntry: "root",
			lower: lowerRedshift as never,
			entryRule: "RULE_select_no_parens",
			pool: RS_POOL,
		},
	},
	{
		label: "Postgres",
		cfg: {
			Parser: PostgresParser as never,
			Lexer: PostgresLexer as never,
			parseEntry: "root",
			lower: lowerPostgres as never,
			entryRule: "RULE_select_no_parens",
			pool: PG_POOL,
		},
	},
	{
		label: "DuckDB",
		cfg: {
			Parser: DuckdbParser as never,
			Lexer: DuckdbLexer as never,
			parseEntry: "root",
			lower: lowerDuckdb as never,
			entryRule: "RULE_select_no_parens",
			pool: PG_POOL,
		},
	},
	{
		label: "Trino",
		cfg: {
			Parser: TrinoParser as never,
			Lexer: TrinoLexer as never,
			parseEntry: "root",
			lower: lowerTrino as never,
			entryRule: "RULE_query",
			pool: TRINO_POOL,
		},
	},
	{
		label: "SQLite",
		cfg: {
			Parser: SqliteParser as never,
			Lexer: SqliteLexer as never,
			parseEntry: "parse",
			lower: lowerSqlite as never,
			entryRule: "RULE_select_stmt",
			pool: SQLITE_POOL,
		},
	},
	{
		label: "MySQL",
		cfg: {
			Parser: MysqlParser as never,
			Lexer: MysqlLexer as never,
			parseEntry: "root",
			lower: lowerMysql as never,
			entryRule: "RULE_selectStatement",
			pool: MYSQL_POOL,
		},
	},
];

describe("lower() robustness + coverage over generated queries", { sequential: true }, () => {
	for (const d of DIALECTS) {
		it(`${d.label}: lower never throws on generated queries`, { timeout: 60_000 }, () => {
			const r = grammarCoverage(d.cfg);
			// eslint-disable-next-line no-console
			console.log(
				`${d.label}: covered ${r.covered}/${r.denom}, throws ${r.throws}, flagged ${r.flagged}/${r.parsed} (covered/flagged = NOISE, not asserted)`,
			);
			expect(r.throws, `lower() THREW on generated ${d.label} queries — it must be total`).toBe(0);
			// Not a floor: guards that the fuzzer actually produced parseable statements, so throws===0
			// above is a real result and not vacuously true on a mis-wired entryRule.
			expect(
				r.parsed,
				`${d.label} fuzzer parsed nothing — entryRule/parseEntry likely mis-wired`,
			).toBeGreaterThan(0);
		});
	}
});

// Curated clean repros: specific constructs must lower to real IR, never flagged. A regression guard that
// closed gaps STAY closed — intent-bearing, unlike the generator's covered count.
describe("lower() models specific constructs (curated clean repros)", () => {
	const rsFlags = (sql: string): string[] => {
		const { tree, errors } = parseRedshift(sql);
		if (errors !== 0) throw new Error("repro did not parse");
		return (lowerRedshift(tree).body as { unsupported?: string[] }).unsupported ?? [];
	};
	it("Redshift PIVOT / UNPIVOT / CONNECT BY are modelled onto the shared IR (not flagged)", () => {
		// These lower to PivotInfo/UnpivotInfo and conserved CONNECT BY predicate columns — the same shapes
		// the sibling dialects produce. Asserts they are modelled, never flagged unsupported.
		expect(rsFlags("SELECT * FROM t1 PIVOT (sum(a) FOR b IN (1, 2))"), "redshift pivot should model").not.toContain(
			"pivot",
		);
		expect(
			rsFlags("SELECT * FROM t1 UNPIVOT (val FOR col IN (a, b))"),
			"redshift unpivot should model",
		).not.toContain("unpivot");
		expect(
			rsFlags("SELECT a FROM t1 START WITH a = 1 CONNECT BY PRIOR a = b"),
			"redshift connect-by should model",
		).not.toContain("connect-by");
	});
});
