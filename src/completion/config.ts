import { Token } from "antlr4ng";
import type { Dialect } from "../dialect.js";
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
import { TrinoLexer } from "../generated/trino/TrinoLexer.js";
import { TrinoParser } from "../generated/trino/TrinoParser.js";
import { SqliteLexer } from "../generated/sqlite/SqliteLexer.js";
import { SqliteParser } from "../generated/sqlite/SqliteParser.js";
import { MysqlLexer } from "../generated/mysql/MysqlLexer.js";
import { MysqlParser } from "../generated/mysql/MysqlParser.js";

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
// UNCLOSED_ESCAPED_IDENTIFIER is the dedicated recovery token GoogleSQL's lexer emits for a
// backtick-quoted identifier with no closing backtick yet (`` `a `` mid-typing) — completion's
// caret-in-a-partial-identifier detection needs it alongside the ordinary closed-form token.
const BIGQUERY_NAME_TOKENS = new Set<number>([GoogleSQLLexer.IDENTIFIER, GoogleSQLLexer.UNCLOSED_ESCAPED_IDENTIFIER]);

// ── Redshift (Bytebase/Postgres-derived fork) ───────────────────────────────
//   post-FROM   → relation_expr (the relation slot; the leaf `identifier` also surfaces post-FROM
//                  but never in column position, so tableRules uses relation_expr).
//   SELECT/WHERE → a_expr (the Postgres value-expression slot).
const REDSHIFT_TABLE_RULES = new Set<number>([RedshiftParser.RULE_relation_expr]);
const REDSHIFT_COLUMN_RULES = new Set<number>([RedshiftParser.RULE_a_expr]);
const REDSHIFT_PREFERRED = new Set<number>([...REDSHIFT_TABLE_RULES, ...REDSHIFT_COLUMN_RULES]);
const REDSHIFT_RELATION_KEYWORDS = new Set<number>([RedshiftLexer.FROM, RedshiftLexer.JOIN]);
// UnterminatedQuotedIdentifier is the dedicated recovery token this Postgres-lineage lexer emits
// for a `"a` with no closing quote yet (mid-typing) — needed alongside the ordinary closed form.
const REDSHIFT_NAME_TOKENS = new Set<number>([
	RedshiftLexer.Identifier,
	RedshiftLexer.QuotedIdentifier,
	RedshiftLexer.UnterminatedQuotedIdentifier,
]);

// ── Postgres / DuckDB (TVL-lineage forks like Redshift) ─────────────────────
// The same rule split as Redshift applies (same grammar shapes): post-FROM → relation_expr,
// SELECT/WHERE → a_expr; relation names are plain/quoted identifiers after FROM/JOIN.
const POSTGRES_TABLE_RULES = new Set<number>([PostgresParser.RULE_relation_expr]);
const POSTGRES_COLUMN_RULES = new Set<number>([PostgresParser.RULE_a_expr]);
const POSTGRES_PREFERRED = new Set<number>([...POSTGRES_TABLE_RULES, ...POSTGRES_COLUMN_RULES]);
const POSTGRES_RELATION_KEYWORDS = new Set<number>([PostgresLexer.FROM, PostgresLexer.JOIN]);
// UnterminatedQuotedIdentifier is the dedicated recovery token this lexer emits for a `"a` with no
// closing quote yet (mid-typing) — needed alongside the ordinary closed form.
const POSTGRES_NAME_TOKENS = new Set<number>([
	PostgresLexer.Identifier,
	PostgresLexer.QuotedIdentifier,
	PostgresLexer.UnterminatedQuotedIdentifier,
]);

const DUCKDB_TABLE_RULES = new Set<number>([DuckdbParser.RULE_relation_expr]);
const DUCKDB_COLUMN_RULES = new Set<number>([DuckdbParser.RULE_a_expr]);
const DUCKDB_PREFERRED = new Set<number>([...DUCKDB_TABLE_RULES, ...DUCKDB_COLUMN_RULES]);
const DUCKDB_RELATION_KEYWORDS = new Set<number>([DuckdbLexer.FROM, DuckdbLexer.JOIN]);
// UnterminatedQuotedIdentifier is the dedicated recovery token this Postgres-lineage lexer emits
// for a `"a` with no closing quote yet (mid-typing) — needed alongside the ordinary closed form.
const DUCKDB_NAME_TOKENS = new Set<number>([
	DuckdbLexer.Identifier,
	DuckdbLexer.QuotedIdentifier,
	DuckdbLexer.UnterminatedQuotedIdentifier,
]);

// -- Trino (first-party SqlBase.g4 split) ------------------------------------
// Post-FROM relation names live under relationPrimary/qualifiedName; column slots are
// primaryExpression. Identifiers: plain / "quoted" / backquoted / digit-led.
const TRINO_TABLE_RULES = new Set<number>([TrinoParser.RULE_relationPrimary, TrinoParser.RULE_qualifiedName]);
const TRINO_COLUMN_RULES = new Set<number>([TrinoParser.RULE_primaryExpression]);
const TRINO_PREFERRED = new Set<number>([...TRINO_TABLE_RULES, ...TRINO_COLUMN_RULES]);
const TRINO_RELATION_KEYWORDS = new Set<number>([TrinoLexer.FROM, TrinoLexer.JOIN]);
const TRINO_NAME_TOKENS = new Set<number>([
	TrinoLexer.IDENTIFIER,
	TrinoLexer.QUOTED_IDENTIFIER,
	TrinoLexer.BACKQUOTED_IDENTIFIER,
	TrinoLexer.DIGIT_IDENTIFIER,
]);

// ── SQLite (grammars-v4 fork) ───────────────────────────────────────────────
//   post-FROM   → table_name (the relation-name leaf; the enclosing `table_or_subquery` is a
//                 wider alternation that also recurses into `select_stmt` for a parenthesized
//                 subquery/join, so marking IT preferred would swallow completion inside a nested
//                 FROM (SELECT …) — table_name alone still fires at "FROM ‹›" with nothing typed,
//                 since the ATN walk explores entering it before any token is consumed. table_name
//                 is also the slot reused by INSERT INTO/UPDATE/ALTER/DROP/CREATE TABLE's table-name
//                 position, which is a bonus, not a target).
//   SELECT/WHERE → expr (the value/column slot; expr_base's `column_name_excluding_string` and the
//                 qualified `table_name DOT column_name` form both nest under it, matching the
//                 Snowflake `expr` precedent — a single outer entry rule for the whole
//                 precedence-chain expression grammar).
// table_name ALSO appears inside expr_base's qualified-column-ref and `x IN table_name` forms; since
// expr is the outer frame there, those inner positions report columnRules only, not tableRules — a
// known, accepted imprecision (same shape as the other dialects' rule choices here).
const SQLITE_TABLE_RULES = new Set<number>([SqliteParser.RULE_table_name]);
const SQLITE_COLUMN_RULES = new Set<number>([SqliteParser.RULE_expr]);
const SQLITE_PREFERRED = new Set<number>([...SQLITE_TABLE_RULES, ...SQLITE_COLUMN_RULES]);
const SQLITE_RELATION_KEYWORDS = new Set<number>([SqliteLexer.FROM_, SqliteLexer.JOIN_]);
// SQLite's lexer folds plain/"double"/`backtick`/[bracket]-quoted names into ONE IDENTIFIER token
// (SqliteLexer.g4's IDENTIFIER rule matches all four forms), so there is no separate quoted-ident
// token type to add, unlike T-SQL/Trino/Postgres.
const SQLITE_NAME_TOKENS = new Set<number>([SqliteLexer.IDENTIFIER]);

// ── MySQL (grammars-v4 mysql/Positive-Technologies fork) ───────────────────
//   post-FROM   → tableName (the relation-name leaf; the enclosing `tableSourceItem` is a wider
//                 4-way alternation whose `subqueryTableItem` arm recurses into `selectStatement`
//                 for a parenthesized subquery, so marking IT preferred would swallow completion
//                 inside a nested "FROM (SELECT ... FROM ‹›)" — same table_or_subquery-vs-table_name
//                 trap as the SQLite entry above. tableName wraps fullId -> uid, so it still fires at
//                 "FROM ‹›" with nothing typed. tableName is also reused by INSERT INTO/UPDATE/DELETE/
//                 DDL's table-name slot, a bonus, not a target).
//   SELECT/WHERE → expression (the outer frame of the expression -> predicate -> expressionAtom
//                 precedence chain; fullColumnName nests under it, matching the Snowflake/SQLite
//                 `expr`-as-single-outer-rule precedent).
// tableName ALSO appears inside fullColumnName-adjacent and IN-list positions reached from inside
// `expression`; since expression is the outer frame there, those inner positions report columnRules
// only, not tableRules — the same accepted imprecision as the other dialects' choices here.
const MYSQL_TABLE_RULES = new Set<number>([MysqlParser.RULE_tableName]);
const MYSQL_COLUMN_RULES = new Set<number>([MysqlParser.RULE_expression]);
const MYSQL_PREFERRED = new Set<number>([...MYSQL_TABLE_RULES, ...MYSQL_COLUMN_RULES]);
const MYSQL_RELATION_KEYWORDS = new Set<number>([MysqlLexer.FROM, MysqlLexer.JOIN]);
// MySQL's `uid` rule (the identifier slot fullId/tableName bottom out on) accepts simpleId (built on
// the plain ID token) or STRING_LITERAL — this fork's DOUBLE_QUOTE_ID/REVERSE_QUOTE_ID alternatives
// are commented out of `uid`, so backtick/double-quoted names lex to, and reach `uid` through,
// STRING_LITERAL (docs/identifier-delimiter-contract.md's MySQL note says the same).
const MYSQL_NAME_TOKENS = new Set<number>([MysqlLexer.ID, MysqlLexer.STRING_LITERAL]);

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
	trino: {
		preferredRules: TRINO_PREFERRED,
		ignoredTokens: new Set([Token.EOF]),
		tableRules: TRINO_TABLE_RULES,
		columnRules: TRINO_COLUMN_RULES,
		relationKeywordTokens: TRINO_RELATION_KEYWORDS,
		nameTokens: TRINO_NAME_TOKENS,
	},
	sqlite: {
		preferredRules: SQLITE_PREFERRED,
		ignoredTokens: new Set([Token.EOF]),
		tableRules: SQLITE_TABLE_RULES,
		columnRules: SQLITE_COLUMN_RULES,
		relationKeywordTokens: SQLITE_RELATION_KEYWORDS,
		nameTokens: SQLITE_NAME_TOKENS,
	},
	mysql: {
		preferredRules: MYSQL_PREFERRED,
		ignoredTokens: new Set([Token.EOF]),
		tableRules: MYSQL_TABLE_RULES,
		columnRules: MYSQL_COLUMN_RULES,
		relationKeywordTokens: MYSQL_RELATION_KEYWORDS,
		nameTokens: MYSQL_NAME_TOKENS,
	},
};
