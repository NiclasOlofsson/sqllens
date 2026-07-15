// Redshift identifier folding. The FoldRule plus its bound engine, colocated here because BOTH the
// upstream lower() and the downstream DialectBehavior need it (the fold rule is the one dialect concern
// used at two stages). Redshift folds both unquoted and quoted identifiers to lowercase; double-quote
// is the delimiter, doubled to escape.
import { displayWith, foldWith, type FoldRule, type IdentKind } from "../ident/fold.js";
import type { QualifiedNameConfig } from "../ir/qualified-name.js";

const DOUBLE_QUOTE: readonly [string, string] = ['"', '"'];

// docs.aws.amazon.com/redshift/latest/dg/r_names.html — verified live: "ASCII letters in
// standard and delimited identifiers are case-insensitive and are folded to lowercase in the
// database" — explicitly covers BOTH unquoted and quoted by default (the
// enable_case_sensitive_identifier parameter can flip quoted identifiers case-sensitive; this
// module encodes the default), and explicitly scopes the fold to ASCII letters; hence
// ascii-lower, keeping a non-ASCII pair like `Ä`/`ä` distinct (#22). Doubled-quote escape: "To
// use a double quotation mark in a string, you must precede it with another double quotation
// mark character."
export const REDSHIFT_FOLD_RULE: FoldRule = {
	delimiters: [DOUBLE_QUOTE],
	unquoted: "ascii-lower",
	quoted: "ascii-lower",
};

/** database.schema.table (docs.aws.amazon.com/redshift — cross-database queries address
 *  three-part names). Normalized vocabulary: catalog = database. */
export const REDSHIFT_NAME_CONFIG: QualifiedNameConfig = {
	roles: ["catalog", "schema"],
	rule: REDSHIFT_FOLD_RULE,
};

/** Fold an identifier to its Redshift identity key. */
export function fold(raw: string, kind: IdentKind = "other"): string {
	return foldWith(REDSHIFT_FOLD_RULE, raw, kind);
}

/** Presentation twin: strip delimiters, no case change. */
export function displayName(raw: string): string {
	return displayWith(REDSHIFT_FOLD_RULE, raw);
}

export function foldTableName(parts: string[]): string[] {
	return parts.map((p) => fold(p, "table"));
}

export function matchesSourceKey(key: string, rawPart: string): boolean {
	return key === fold(rawPart) || key === fold(rawPart, "table");
}
