// BigQuery identifier folding. The FoldRule plus its bound engine, colocated here because BOTH the
// upstream lower() and the downstream DialectBehavior need it (the fold rule is the one dialect concern
// used at two stages).
//
// cloud.google.com/bigquery/docs/reference/standard-sql/lexical — verified live (via search,
// the JS-rendered page would not return body text to WebFetch): "table names are case-sensitive,
// but column names are not" — so table identifiers preserve case and everything else (column,
// field, alias, CTE) folds to lower, REGARDLESS of backtick-quoting either way (backticks are
// required for reserved words/specials, not a case-quoting mechanism — same "not case-quoting"
// shape as Databricks, but the preserved/folded split is per identifier KIND here, not
// per-quoting). Escape mechanism corrected from the originally assumed doubling: "Quoted
// identifiers have the same escape sequences as string literals" (backslash-escaped, e.g.
// `` `a\`b` `` → `` a`b ``) — NOT doubling like every other backtick/quote dialect here. This
// module unescapes the identifier-relevant case (`` \` ``) plus the general `\X`→`X` pattern; it
// does not implement BigQuery's full string-literal escape grammar (\n, \xHH, \uXXXX, octal, …),
// out of scope for an identifier fold — those escapes are exotic in identifier text.
import { displayWith, foldWith, type FoldRule, type IdentKind } from "../ident/fold.js";
import type { QualifiedNameConfig } from "../ir/qualified-name.js";

const BACKTICK: readonly [string, string] = ["`", "`"];

export const BIGQUERY_FOLD_RULE: FoldRule = {
	delimiters: [BACKTICK],
	unquoted: "lower",
	quoted: "lower",
	tableCase: "preserve",
	escapeStyle: "backslash",
};

/** project.dataset.table (cloud.google.com/bigquery/docs — "Qualifying table names").
 *  Normalized vocabulary: catalog = project, schema = dataset. Relation-path parts keep case in
 *  the identity key (this rule's tableCase: "preserve" — dataset and table names are
 *  case-sensitive). */
export const BIGQUERY_NAME_CONFIG: QualifiedNameConfig = {
	roles: ["catalog", "schema"],
	rule: BIGQUERY_FOLD_RULE,
};

/** Fold an identifier to its BigQuery identity key. */
export function fold(raw: string, kind: IdentKind = "other"): string {
	return foldWith(BIGQUERY_FOLD_RULE, raw, kind);
}

/** Presentation twin: strip delimiters, no case change. */
export function displayName(raw: string): string {
	return displayWith(BIGQUERY_FOLD_RULE, raw);
}

export function foldTableName(parts: string[]): string[] {
	return parts.map((p) => fold(p, "table"));
}

export function matchesSourceKey(key: string, rawPart: string): boolean {
	return key === fold(rawPart) || key === fold(rawPart, "table");
}
