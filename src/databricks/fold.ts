// Databricks identifier folding. The FoldRule plus its bound engine, colocated here because BOTH the
// upstream lower() and the downstream DialectBehavior need it (the fold rule is the one dialect concern
// used at two stages).
// docs.databricks.com/en/sql/language-manual/sql-ref-identifiers.html — verified live:
// "Identifiers are case-insensitive when referenced." Backtick escaping is doubling, not
// case-quoting: "Use ` to escape ` itself" (example: `` `a``b` `` → `` a`b ``).
import { displayWith, foldWith, type FoldRule, type IdentKind } from "../ident/fold.js";
import type { QualifiedNameConfig } from "../ir/qualified-name.js";

const BACKTICK: readonly [string, string] = ["`", "`"];

export const DATABRICKS_FOLD_RULE: FoldRule = {
	delimiters: [BACKTICK],
	unquoted: "lower",
	quoted: "lower",
};

/** Unity Catalog's three-level namespace: catalog.schema.object
 *  (docs.databricks.com/en/data-governance/unity-catalog — "three-level namespace"). */
export const DATABRICKS_NAME_CONFIG: QualifiedNameConfig = {
	roles: ["catalog", "schema"],
	rule: DATABRICKS_FOLD_RULE,
};

/** Fold an identifier to its Databricks identity key. */
export function fold(raw: string, kind: IdentKind = "other"): string {
	return foldWith(DATABRICKS_FOLD_RULE, raw, kind);
}

/** Presentation twin: strip delimiters, no case change. */
export function displayName(raw: string): string {
	return displayWith(DATABRICKS_FOLD_RULE, raw);
}

export function foldTableName(parts: string[]): string[] {
	return parts.map((p) => fold(p, "table"));
}

export function matchesSourceKey(key: string, rawPart: string): boolean {
	return key === fold(rawPart) || key === fold(rawPart, "table");
}
