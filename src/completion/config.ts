import { Token } from "antlr4ng";
import type { Dialect } from "../api.js";
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

export const COMPLETION_CONFIG: Record<Dialect, CompletionConfig> = {
	databricks: { preferredRules: DATABRICKS_PREFERRED, ignoredTokens: DATABRICKS_IGNORED },
	// Task 12 fills these; empty sets keep the type complete and the walk a no-op-ish default.
	tsql: { preferredRules: new Set(), ignoredTokens: new Set([Token.EOF]) },
	snowflake: { preferredRules: new Set(), ignoredTokens: new Set([Token.EOF]) },
	bigquery: { preferredRules: new Set(), ignoredTokens: new Set([Token.EOF]) },
	redshift: { preferredRules: new Set(), ignoredTokens: new Set([Token.EOF]) },
};
