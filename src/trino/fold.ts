// Trino identifier folding. The FoldRule plus its bound engine, colocated here because BOTH the
// upstream lower() and the downstream DialectBehavior need it (the fold rule is the one dialect concern
// used at two stages).
// trino.io/docs/current/language/reserved.html — verified live: "Identifiers with other
// characters must be delimited with double quotes (\"). ... Escape a \" with another preceding
// double quote in a delimited identifier." and, blanket, "Identifiers are not treated as case
// sensitive" — no quoted/unquoted distinction is drawn, and no backtick delimiter is documented
// (adjusted from the originally proposed "backtick tolerated" — dropped, unconfirmed by the
// live page). The fold DIRECTION (lower here) is this module's choice, not vendor-documented —
// the live docs only commit to uniform case-insensitivity across quoted/unquoted, which lower-
// folding both forms reproduces; chosen for consistency with the other case-insensitive-quoted
// dialects (redshift/duckdb) and this module's undefined-dialect default. NOTE: Trino's own
// engine source is internally inconsistent with this blanket docs claim — trino-parser's
// Identifier.getCanonicalValue() canonicalizes unquoted to UPPER and preserves quoted verbatim
// (ANSI-style, would make quoted case-sensitive), while trino-main's Field field-matching does
// a blanket case-insensitive compare regardless of quoting. Encoding the documented behavior
// per this module's citation policy; flagged as a discrepancy, not resolved against a live
// engine.
import { displayWith, foldWith, type FoldRule, type IdentKind } from "../ident/fold.js";
import type { QualifiedNameConfig } from "../ir/qualified-name.js";

const DOUBLE_QUOTE: readonly [string, string] = ['"', '"'];

export const TRINO_FOLD_RULE: FoldRule = {
	delimiters: [DOUBLE_QUOTE],
	unquoted: "lower",
	quoted: "lower",
};

/** catalog.schema.table (trino.io/docs/current/overview/concepts — catalog/schema/table). */
export const TRINO_NAME_CONFIG: QualifiedNameConfig = {
	roles: ["catalog", "schema"],
	rule: TRINO_FOLD_RULE,
};

/** Fold an identifier to its Trino identity key. */
export function fold(raw: string, kind: IdentKind = "other"): string {
	return foldWith(TRINO_FOLD_RULE, raw, kind);
}

/** Presentation twin: strip delimiters, no case change. */
export function displayName(raw: string): string {
	return displayWith(TRINO_FOLD_RULE, raw);
}

export function foldTableName(parts: string[]): string[] {
	return parts.map((p) => fold(p, "table"));
}

export function matchesSourceKey(key: string, rawPart: string): boolean {
	return key === fold(rawPart) || key === fold(rawPart, "table");
}
