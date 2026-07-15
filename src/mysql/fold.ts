// MySQL identifier folding. The FoldRule plus its bound engine, colocated here because BOTH the
// upstream lower() and the downstream DialectBehavior need it (the fold rule is the one dialect concern
// used at two stages).
//
// dev.mysql.com/doc/refman/8.4/en/identifier-case-sensitivity.html — verified live. This module's
// fold rule is per-DIALECT, not per-identifier-KIND (only BigQuery's `tableCase` override draws
// that distinction), so one rule must cover both halves of a genuinely split MySQL reality:
// "Partition, subpartition, column, index, stored routine, event, and resource group names are
// not case-sensitive on any platform, nor are column aliases" — unconditional, so this module
// folds unquoted AND backtick-quoted identifiers to lower for equality (column/alias/CTE/field
// names, the identifier kinds this module actually threads through scope/qualify/infer today).
// KNOWN LIMITATION (documented here, not silently dropped): table/database names are genuinely
// platform/`lower_case_table_names`-dependent — "case sensitivity of the underlying operating
// system plays a part": case-SENSITIVE by default on Unix (lower_case_table_names=0), case-
// INSENSITIVE by default on Windows (=1) and macOS (=2), and the variable "can only be
// configured when initializing the server" (not discoverable from SQL text alone). A static
// analyzer with no server/OS context cannot resolve this per-installation choice; this module
// applies the same lower-fold to table identifiers too (foldTableName's kind:"table" path, since
// no `tableCase` override is set here) — correct for the Windows/macOS default and for Unix
// installs whose tables happen to be written in a single consistent case (the common case), WRONG
// only when a Unix-collation database genuinely holds two tables differing only in case (e.g.
// `Orders` and `orders` as distinct tables) — a real but narrow misresolution, called out here
// rather than left for a caller to discover by surprise. Identifier quote char is the backtick by
// default (ANSI_QUOTES mode, which repurposes `"` as the identifier quote and `` ` `` stops being
// special, is a session/server SQL-mode setting not visible in the SQL text either — out of
// scope for the same reason as lower_case_table_names). Doubled-quote escape: "To include a quote
// character within an identifier, quote the identifier and double the quote character" (example:
// `` `a``b` `` → `` a`b ``).
import { displayWith, foldWith, type FoldRule, type IdentKind } from "../ident/fold.js";
import type { QualifiedNameConfig } from "../ir/qualified-name.js";

const BACKTICK: readonly [string, string] = ["`", "`"];

export const MYSQL_FOLD_RULE: FoldRule = {
	delimiters: [BACKTICK],
	unquoted: "lower",
	quoted: "lower",
};

/** schema.table, two levels — MySQL's database IS its schema
 *  (dev.mysql.com/doc/refman/8.4/en/identifier-qualifiers.html). */
export const MYSQL_NAME_CONFIG: QualifiedNameConfig = {
	roles: ["schema"],
	rule: MYSQL_FOLD_RULE,
};

/** Fold an identifier to its MySQL identity key. */
export function fold(raw: string, kind: IdentKind = "other"): string {
	return foldWith(MYSQL_FOLD_RULE, raw, kind);
}

/** Presentation twin: strip delimiters, no case change. */
export function displayName(raw: string): string {
	return displayWith(MYSQL_FOLD_RULE, raw);
}

export function foldTableName(parts: string[]): string[] {
	return parts.map((p) => fold(p, "table"));
}

export function matchesSourceKey(key: string, rawPart: string): boolean {
	return key === fold(rawPart) || key === fold(rawPart, "table");
}
