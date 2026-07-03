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

// What this asserts — and DELIBERATELY does NOT:
//
// The engine (tests/helpers/grammar-coverage.ts) fuzzes each dialect: it walks the grammar from the
// query entry rule and mechanically generates statements (recursive holes from a generic pool, DDL/graph
// excluded). We assert only the two things that are real SIGNAL about lower():
//   1. lower() NEVER THROWS on grammar-legal input (it's contractually total) — a genuine robustness guard.
//   2. lower() COVERS at least a floor of the query construct rules — catches a refactor that makes it
//      silently stop handling constructs. A FLOOR (>=), not an exact count, so generator wiggle can't trip it.
//
// We do NOT pin the raw `flagged` count or the never-reached set. Those are generator artifacts/NOISE —
// most flags are malformed combinations the grammar accepts, not gaps (verified for Databricks). Real
// gaps are asserted separately below, as CURATED CLEAN REPROS — the only honest gap signal.

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

interface DialectCfg {
	label: string;
	cfg: CoverageConfig;
	coverFloor: number;
}
const DIALECTS: DialectCfg[] = [
	{
		label: "Databricks",
		coverFloor: 115,
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
		coverFloor: 99,
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
		// 59 after the SLL-surgery wave (2026-07-03): deleting subset alternatives (round_expr, the
		// builtin-arity call forms, predicate's expr-duplicated forms, order_item's id_/num) shrank
		// the fuzzer's reachable-rule graph. lower() did not regress — the docs corpus gate proves
		// 0 throws and the `other` ratchet held at 0 over all 2,976 query files.
		coverFloor: 59,
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
		// 289 after the task-6 grammar edits: restructuring aggregate_group_by_modifier from a direct
		// `expression` list to `grouping_item` shifted the fuzzer's reachable-rule graph by one construct.
		// lower() itself did not regress — the analyzer corpus gate proves 0 throws and `other` held at 234.
		coverFloor: 289,
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
		// 151 after the task-6 SLL-surgery select-list left-factor: merging simple_select_pramary's three
		// overlapping branches removed the redundant `distinct_clause target_list` subset alternative, so
		// the fuzzer's reachable-rule graph lost one node. lower() did NOT regress — throws stays 0 and the
		// docs corpus gate proves full coverage + 0 `other` over the real query bucket; the deleted branch's
		// language is covered identically by the merged alternative (lower reads target_list via firstShallow).
		coverFloor: 151,
		cfg: {
			Parser: RedshiftParser as never,
			Lexer: RedshiftLexer as never,
			parseEntry: "root",
			lower: lowerRedshift as never,
			entryRule: "RULE_select_no_parens",
			pool: RS_POOL,
		},
	},
];

describe("lower() robustness + coverage over generated queries", { sequential: true }, () => {
	for (const d of DIALECTS) {
		it(`${d.label}: lower never throws; covers >= floor`, { timeout: 60_000 }, () => {
			const r = grammarCoverage(d.cfg);
			// eslint-disable-next-line no-console
			console.log(
				`${d.label}: covered ${r.covered}/${r.denom}, throws ${r.throws}, flagged ${r.flagged}/${r.parsed} (flagged = NOISE, not pinned)`,
			);
			expect(r.throws, `lower() THREW on generated ${d.label} queries — it must be total`).toBe(0);
			expect(r.covered, `${d.label} query-construct coverage regressed below floor`).toBeGreaterThanOrEqual(
				d.coverFloor,
			);
		});
	}
});

// Curated REAL gaps — clean repros, the only honest gap signal (not generator garbage).
describe("known lower() gaps (curated clean repros)", () => {
	const rsFlags = (sql: string): string[] => {
		const { tree, errors } = parseRedshift(sql);
		if (errors !== 0) throw new Error("repro did not parse");
		return (lowerRedshift(tree).body as { unsupported?: string[] }).unsupported ?? [];
	};
	it("Redshift PIVOT / UNPIVOT / CONNECT BY are modelled onto the shared IR (no longer flagged)", () => {
		// Flipped from asserts-flagged to asserts-modelled (Task 5): these lower to PivotInfo/UnpivotInfo
		// and conserved CONNECT BY predicate columns, the same shapes the sibling dialects produce.
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
