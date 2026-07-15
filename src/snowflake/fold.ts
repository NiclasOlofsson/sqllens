// Snowflake identifier folding. The FoldRule plus its bound engine, colocated here because BOTH the
// upstream lower() and the downstream DialectBehavior need it (the fold rule is the one dialect concern
// used at two stages). Snowflake unquoted identifiers fold to UPPER; quoted identifiers preserve case
// (docs.snowflake.com/en/sql-reference/identifiers-syntax); double-quote is the delimiter, doubled to escape.
import { displayWith, foldWith, type FoldRule, type IdentKind } from "../ident/fold.js";
import type { QualifiedNameConfig } from "../ir/qualified-name.js";

const DOUBLE_QUOTE: readonly [string, string] = ['"', '"'];

export const SNOWFLAKE_FOLD_RULE: FoldRule = {
	delimiters: [DOUBLE_QUOTE],
	unquoted: "upper",
	quoted: "preserve",
};

/** database.schema.object (docs.snowflake.com "Object identifiers" — object name resolution).
 *  Normalized vocabulary: catalog = database. */
export const SNOWFLAKE_NAME_CONFIG: QualifiedNameConfig = {
	roles: ["catalog", "schema"],
	rule: SNOWFLAKE_FOLD_RULE,
};

/** Fold an identifier to its Snowflake identity key. */
export function fold(raw: string, kind: IdentKind = "other"): string {
	return foldWith(SNOWFLAKE_FOLD_RULE, raw, kind);
}

/** Presentation twin: strip delimiters, no case change. */
export function displayName(raw: string): string {
	return displayWith(SNOWFLAKE_FOLD_RULE, raw);
}

export function foldTableName(parts: string[]): string[] {
	return parts.map((p) => fold(p, "table"));
}

export function matchesSourceKey(key: string, rawPart: string): boolean {
	return key === fold(rawPart) || key === fold(rawPart, "table");
}
