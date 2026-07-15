// DuckDB identifier folding. The FoldRule plus its bound engine, colocated here because BOTH the
// upstream lower() and the downstream DialectBehavior need it (the fold rule is the one dialect concern
// used at two stages).
// duckdb.org/docs/current/sql/dialect/keywords_and_identifiers.html — verified live: "Identifiers
// in DuckDB are always case-insensitive, similarly to PostgreSQL. However, unlike PostgreSQL...
// DuckDB also treats quoted identifiers as case-insensitive" — quoting only preserves the
// identifier for DISPLAY, not identity. The insensitivity is ASCII-scoped, same page (#22):
// "Case-insensitivity is implemented using an ASCII-based comparison: col_A and col_a are equal
// but col_á is not equal to them"; hence ascii-lower for both forms. Doubled-quote escape:
// "Double quotes can be escaped by repeating the quote character."
import { displayWith, foldWith, type FoldRule, type IdentKind } from "../ident/fold.js";
import type { QualifiedNameConfig } from "../ir/qualified-name.js";

const DOUBLE_QUOTE: readonly [string, string] = ['"', '"'];

export const DUCKDB_FOLD_RULE: FoldRule = {
	delimiters: [DOUBLE_QUOTE],
	unquoted: "ascii-lower",
	quoted: "ascii-lower",
};

/** catalog.schema.table — an attached database is a catalog
 *  (duckdb.org/docs/current/sql/statements/attach). */
export const DUCKDB_NAME_CONFIG: QualifiedNameConfig = {
	roles: ["catalog", "schema"],
	rule: DUCKDB_FOLD_RULE,
};

/** Fold an identifier to its DuckDB identity key. */
export function fold(raw: string, kind: IdentKind = "other"): string {
	return foldWith(DUCKDB_FOLD_RULE, raw, kind);
}

/** Presentation twin: strip delimiters, no case change. */
export function displayName(raw: string): string {
	return displayWith(DUCKDB_FOLD_RULE, raw);
}

export function foldTableName(parts: string[]): string[] {
	return parts.map((p) => fold(p, "table"));
}

export function matchesSourceKey(key: string, rawPart: string): boolean {
	return key === fold(rawPart) || key === fold(rawPart, "table");
}
