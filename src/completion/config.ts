import { Token } from "antlr4ng";
import type { Dialect } from "../api.js";
import { DatabricksLexer } from "../generated/databricks/DatabricksLexer.js";
import { DatabricksParser } from "../generated/databricks/DatabricksParser.js";
import { TSqlLexer } from "../generated/tsql/TSqlLexer.js";
import { TSqlParser } from "../generated/tsql/TSqlParser.js";
import { SnowflakeLexer } from "../generated/snowflake/SnowflakeLexer.js";
import { SnowflakeParser } from "../generated/snowflake/SnowflakeParser.js";
import { GoogleSQLLexer } from "../generated/bigquery/GoogleSQLLexer.js";
import { GoogleSQLParser } from "../generated/bigquery/GoogleSQLParser.js";
import { RedshiftLexer } from "../generated/redshift/RedshiftLexer.js";
import { RedshiftParser } from "../generated/redshift/RedshiftParser.js";
import { PostgresLexer } from "../generated/postgres/PostgresLexer.js";
import { PostgresParser } from "../generated/postgres/PostgresParser.js";
import { DuckdbLexer } from "../generated/duckdb/DuckdbLexer.js";
import { DuckdbParser } from "../generated/duckdb/DuckdbParser.js";

/**
 * Per-dialect tuning for the ATN candidate walk (`collectCandidates`).
 *
 * - `preferredRules`: parser rule indices that denote a *name* slot (identifier / column /
 *   table reference). When the walk reaches the caret about to enter one of these rules it
 *   records the rule (instead of descending to enumerate every keyword/identifier token the
 *   name could start with) — the editor then resolves that slot with schema-aware names.
 * - `ignoredTokens`: token types never worth offering as a literal candidate (EOF, etc.).
 */
export interface CompletionConfig {
	preferredRules: Set<number>;
	ignoredTokens: Set<number>;
	/** Subset of `preferredRules` reached at a TABLE / relation-name position (post-FROM). When the
	 *  walk's recorded rules intersect this set, complete() offers schema table names. */
	tableRules: Set<number>;
	/** Subset of `preferredRules` reached at a COLUMN / value-expression position (SELECT/WHERE/…).
	 *  When the walk's rules intersect this set, complete() offers scope columns + function names. */
	columnRules: Set<number>;
	/** Lexer token types that introduce a relation in a FROM/JOIN clause. Used by the broken-input
	 *  FROM-relation fallback: when a mid-edit statement mis-parses (e.g. an empty projection makes
	 *  the grammar read `SELECT  FROM t` as `SELECT FROM AS t`, so the scope has no source), complete()
	 *  scans the token stream for `<relationKeyword> <name>` and surfaces those tables' schema columns. */
	relationKeywordTokens: Set<number>;
	/** Lexer token types that can be a relation NAME after a relation keyword (plain / quoted ident). */
	nameTokens: Set<number>;
}

// Databricks (Spark grammar) name-reference rules — each cited by its grammar rule:
//   identifierReference  → the table/view/name reference used in `relationPrimary` (post-FROM),
//                          `DatabricksParser.g4:755` (`IDENTIFIER(expr)` | multipartIdentifier).
//   multipartIdentifier  → dotted name `a.b.c`, `DatabricksParser.g4:1216`; the column/qualified
//                          name slot reached in expressions and projections.
//   errorCapturingIdentifier → the single name part, `DatabricksParser.g4:1726`; the leaf name
//                          slot (alias names, single identifiers).
//   identifier           → the column/name slot *inside expressions*: `primaryExpression`'s
//                          `#columnReference: identifier` (`DatabricksParser.g4:1358`) and
//                          `#dereference` go through `identifier`, NOT identifierReference (which
//                          is the FROM/DDL relation reference) — so a column ref typed in SELECT /
//                          WHERE / projection positions is found here. Without it the walk has no
//                          preferred rule to record in expression position and dumps raw tokens.
const DATABRICKS_PREFERRED = new Set<number>([
	DatabricksParser.RULE_identifierReference,
	DatabricksParser.RULE_multipartIdentifier,
	DatabricksParser.RULE_errorCapturingIdentifier,
	DatabricksParser.RULE_identifier,
]);

// EOF is never a typeable candidate. Keep this set small and justified.
const DATABRICKS_IGNORED = new Set<number>([Token.EOF]);

// Table-vs-column split (probed against the live walk, as Task 10's tests did):
//   post-FROM (`FROM ‹›`)        → rules {82 identifierReference, 249 errorCapturingIdentifier, 251 identifier}
//   expression (`SELECT ‹›`, `WHERE ‹›`) → rules {251 identifier}
// So a relation-name slot is signalled by identifierReference / errorCapturingIdentifier (the
// FROM/relation reference rules), and a value/column slot by `identifier`. multipartIdentifier (163)
// did NOT surface in expression positions in the probe, so it is left out of columnRules.
const DATABRICKS_TABLE_RULES = new Set<number>([
	DatabricksParser.RULE_identifierReference,
	DatabricksParser.RULE_errorCapturingIdentifier,
]);
const DATABRICKS_COLUMN_RULES = new Set<number>([DatabricksParser.RULE_identifier]);

// FROM/JOIN introduce a relation; a relation name is a (back-quoted) identifier. Drive the
// broken-input FROM-relation fallback (see CompletionConfig.relationKeywordTokens).
const DATABRICKS_RELATION_KEYWORDS = new Set<number>([DatabricksLexer.FROM, DatabricksLexer.JOIN]);
const DATABRICKS_NAME_TOKENS = new Set<number>([DatabricksLexer.IDENTIFIER, DatabricksLexer.BACKQUOTED_IDENTIFIER]);

// ── T-SQL (grammars-v4 fork) ────────────────────────────────────────────────
// Probed against the live walk (Task 10's method). Rule split, by generated rule name:
//   post-FROM (`FROM ‹›`)              → table_source_item (the relation-name slot)
//   expression (`SELECT ‹›`, `WHERE ‹›`) → expression (the value/column slot)
// table_name DID surface in SELECT position (the SELECT…INTO target), so tableRules uses
// table_source_item — which fires ONLY post-FROM — not table_name.
const TSQL_TABLE_RULES = new Set<number>([TSqlParser.RULE_table_source_item]);
const TSQL_COLUMN_RULES = new Set<number>([TSqlParser.RULE_expression]);
const TSQL_PREFERRED = new Set<number>([...TSQL_TABLE_RULES, ...TSQL_COLUMN_RULES]);
// FROM/JOIN introduce a relation; a relation name is a plain/quoted/bracketed identifier.
const TSQL_RELATION_KEYWORDS = new Set<number>([TSqlLexer.FROM, TSqlLexer.JOIN]);
const TSQL_NAME_TOKENS = new Set<number>([TSqlLexer.ID, TSqlLexer.DOUBLE_QUOTE_ID, TSqlLexer.SQUARE_BRACKET_ID]);

// ── Snowflake (grammars-v4 fork) ────────────────────────────────────────────
//   post-FROM  → object_ref (the relation reference)
//   SELECT/WHERE → expr (the value/column slot; column_elem also surfaces in SELECT only — expr
//                  covers both positions, so columnRules uses expr).
const SNOWFLAKE_TABLE_RULES = new Set<number>([SnowflakeParser.RULE_object_ref]);
const SNOWFLAKE_COLUMN_RULES = new Set<number>([SnowflakeParser.RULE_expr]);
const SNOWFLAKE_PREFERRED = new Set<number>([...SNOWFLAKE_TABLE_RULES, ...SNOWFLAKE_COLUMN_RULES]);
const SNOWFLAKE_RELATION_KEYWORDS = new Set<number>([SnowflakeLexer.FROM, SnowflakeLexer.JOIN]);
const SNOWFLAKE_NAME_TOKENS = new Set<number>([SnowflakeLexer.ID, SnowflakeLexer.DOUBLE_QUOTE_ID]);

// ── BigQuery / GoogleSQL (Bytebase fork) ────────────────────────────────────
//   post-FROM   → table_path_expression (the relation path slot)
//   SELECT/WHERE → identifier (the leaf name slot; fires at BOTH select-list and where positions).
// The lexer keyword tokens are SYMBOL-suffixed in this grammar: FROM_SYMBOL / JOIN_SYMBOL.
const BIGQUERY_TABLE_RULES = new Set<number>([GoogleSQLParser.RULE_table_path_expression]);
const BIGQUERY_COLUMN_RULES = new Set<number>([GoogleSQLParser.RULE_identifier]);
const BIGQUERY_PREFERRED = new Set<number>([...BIGQUERY_TABLE_RULES, ...BIGQUERY_COLUMN_RULES]);
const BIGQUERY_RELATION_KEYWORDS = new Set<number>([GoogleSQLLexer.FROM_SYMBOL, GoogleSQLLexer.JOIN_SYMBOL]);
const BIGQUERY_NAME_TOKENS = new Set<number>([GoogleSQLLexer.IDENTIFIER]);

// ── Redshift (Bytebase/Postgres-derived fork) ───────────────────────────────
//   post-FROM   → relation_expr (the relation slot; the leaf `identifier` also surfaces post-FROM
//                  but never in column position, so tableRules uses relation_expr).
//   SELECT/WHERE → a_expr (the Postgres value-expression slot).
const REDSHIFT_TABLE_RULES = new Set<number>([RedshiftParser.RULE_relation_expr]);
const REDSHIFT_COLUMN_RULES = new Set<number>([RedshiftParser.RULE_a_expr]);
const REDSHIFT_PREFERRED = new Set<number>([...REDSHIFT_TABLE_RULES, ...REDSHIFT_COLUMN_RULES]);
const REDSHIFT_RELATION_KEYWORDS = new Set<number>([RedshiftLexer.FROM, RedshiftLexer.JOIN]);
const REDSHIFT_NAME_TOKENS = new Set<number>([RedshiftLexer.Identifier, RedshiftLexer.QuotedIdentifier]);

// ── Postgres / DuckDB (TVL-lineage forks like Redshift) ─────────────────────
// The same rule split as Redshift applies (same grammar shapes): post-FROM → relation_expr,
// SELECT/WHERE → a_expr; relation names are plain/quoted identifiers after FROM/JOIN.
const POSTGRES_TABLE_RULES = new Set<number>([PostgresParser.RULE_relation_expr]);
const POSTGRES_COLUMN_RULES = new Set<number>([PostgresParser.RULE_a_expr]);
const POSTGRES_PREFERRED = new Set<number>([...POSTGRES_TABLE_RULES, ...POSTGRES_COLUMN_RULES]);
const POSTGRES_RELATION_KEYWORDS = new Set<number>([PostgresLexer.FROM, PostgresLexer.JOIN]);
const POSTGRES_NAME_TOKENS = new Set<number>([PostgresLexer.Identifier, PostgresLexer.QuotedIdentifier]);

const DUCKDB_TABLE_RULES = new Set<number>([DuckdbParser.RULE_relation_expr]);
const DUCKDB_COLUMN_RULES = new Set<number>([DuckdbParser.RULE_a_expr]);
const DUCKDB_PREFERRED = new Set<number>([...DUCKDB_TABLE_RULES, ...DUCKDB_COLUMN_RULES]);
const DUCKDB_RELATION_KEYWORDS = new Set<number>([DuckdbLexer.FROM, DuckdbLexer.JOIN]);
const DUCKDB_NAME_TOKENS = new Set<number>([DuckdbLexer.Identifier, DuckdbLexer.QuotedIdentifier]);

export const COMPLETION_CONFIG: Record<Dialect, CompletionConfig> = {
	databricks: {
		preferredRules: DATABRICKS_PREFERRED,
		ignoredTokens: DATABRICKS_IGNORED,
		tableRules: DATABRICKS_TABLE_RULES,
		columnRules: DATABRICKS_COLUMN_RULES,
		relationKeywordTokens: DATABRICKS_RELATION_KEYWORDS,
		nameTokens: DATABRICKS_NAME_TOKENS,
	},
	tsql: {
		preferredRules: TSQL_PREFERRED,
		ignoredTokens: new Set([Token.EOF]),
		tableRules: TSQL_TABLE_RULES,
		columnRules: TSQL_COLUMN_RULES,
		relationKeywordTokens: TSQL_RELATION_KEYWORDS,
		nameTokens: TSQL_NAME_TOKENS,
	},
	snowflake: {
		preferredRules: SNOWFLAKE_PREFERRED,
		ignoredTokens: new Set([Token.EOF]),
		tableRules: SNOWFLAKE_TABLE_RULES,
		columnRules: SNOWFLAKE_COLUMN_RULES,
		relationKeywordTokens: SNOWFLAKE_RELATION_KEYWORDS,
		nameTokens: SNOWFLAKE_NAME_TOKENS,
	},
	bigquery: {
		preferredRules: BIGQUERY_PREFERRED,
		ignoredTokens: new Set([Token.EOF]),
		tableRules: BIGQUERY_TABLE_RULES,
		columnRules: BIGQUERY_COLUMN_RULES,
		relationKeywordTokens: BIGQUERY_RELATION_KEYWORDS,
		nameTokens: BIGQUERY_NAME_TOKENS,
	},
	redshift: {
		preferredRules: REDSHIFT_PREFERRED,
		ignoredTokens: new Set([Token.EOF]),
		tableRules: REDSHIFT_TABLE_RULES,
		columnRules: REDSHIFT_COLUMN_RULES,
		relationKeywordTokens: REDSHIFT_RELATION_KEYWORDS,
		nameTokens: REDSHIFT_NAME_TOKENS,
	},
	postgres: {
		preferredRules: POSTGRES_PREFERRED,
		ignoredTokens: new Set([Token.EOF]),
		tableRules: POSTGRES_TABLE_RULES,
		columnRules: POSTGRES_COLUMN_RULES,
		relationKeywordTokens: POSTGRES_RELATION_KEYWORDS,
		nameTokens: POSTGRES_NAME_TOKENS,
	},
	duckdb: {
		preferredRules: DUCKDB_PREFERRED,
		ignoredTokens: new Set([Token.EOF]),
		tableRules: DUCKDB_TABLE_RULES,
		columnRules: DUCKDB_COLUMN_RULES,
		relationKeywordTokens: DUCKDB_RELATION_KEYWORDS,
		nameTokens: DUCKDB_NAME_TOKENS,
	},
};
