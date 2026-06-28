import { Token } from "antlr4ng";
import type { Dialect } from "../api.js";
import { DatabricksLexer } from "../generated/databricks/DatabricksLexer.js";
import { DatabricksParser } from "../generated/databricks/DatabricksParser.js";

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

export const COMPLETION_CONFIG: Record<Dialect, CompletionConfig> = {
	databricks: {
		preferredRules: DATABRICKS_PREFERRED,
		ignoredTokens: DATABRICKS_IGNORED,
		tableRules: DATABRICKS_TABLE_RULES,
		columnRules: DATABRICKS_COLUMN_RULES,
		relationKeywordTokens: DATABRICKS_RELATION_KEYWORDS,
		nameTokens: DATABRICKS_NAME_TOKENS,
	},
	// Task 12 fills these; empty sets keep the type complete and the walk a no-op-ish default.
	tsql: emptyConfig(),
	snowflake: emptyConfig(),
	bigquery: emptyConfig(),
	redshift: emptyConfig(),
};

function emptyConfig(): CompletionConfig {
	return {
		preferredRules: new Set(),
		ignoredTokens: new Set([Token.EOF]),
		tableRules: new Set(),
		columnRules: new Set(),
		relationKeywordTokens: new Set(),
		nameTokens: new Set(),
	};
}
