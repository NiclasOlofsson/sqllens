// PostgreSQL identifier folding. The FoldRule plus its bound engine, colocated here because BOTH the
// upstream lower() and the downstream DialectBehavior need it (the fold rule is the one dialect concern
// used at two stages).
//
// postgresql.org/docs/18/sql-syntax-lexical.html §4.1.1 — verified live: "unquoted names are
// always folded to lower case"; "Quoting an identifier also makes it case-sensitive" — example
// "the identifiers FOO, foo, and "foo" are considered the same by PostgreSQL, but "Foo" and
// "FOO" are different." The manual is silent on the fold's character scope; the engine source
// is the authority there (#22): the default downcase path folds ASCII only (pg_downcase_ident →
// strlower_c → pg_ascii_tolower; pre-refactor downcase_identifier locale-folded high-bit bytes
// only in single-byte server encodings), so in a UTF-8 database, the universal default, `Ä` and
// `ä` are distinct unquoted identifiers. Hence ascii-lower for unquoted. A non-C locale provider
// or single-byte encoding could fold more, but that is server state invisible to the SQL text
// (same documented boundary as mysql's lower_case_table_names). Doubled-quote escape: "To include
// a double quote, write two double quotes."
import { displayWith, foldWith, type FoldRule, type IdentKind } from "../ident/fold.js";
import type { QualifiedNameConfig } from "../ir/qualified-name.js";

const DOUBLE_QUOTE: readonly [string, string] = ['"', '"'];

export const POSTGRES_FOLD_RULE: FoldRule = {
	delimiters: [DOUBLE_QUOTE],
	unquoted: "ascii-lower",
	quoted: "preserve",
};

/** database.schema.table (postgresql.org/docs/18/sql-syntax-lexical + ddl-schemas — cross-
 *  database references are rejected at runtime but the three-part form parses). Normalized
 *  vocabulary: catalog = database. */
export const POSTGRES_NAME_CONFIG: QualifiedNameConfig = {
	roles: ["catalog", "schema"],
	rule: POSTGRES_FOLD_RULE,
};

/** Fold an identifier to its PostgreSQL identity key. */
export function fold(raw: string, kind: IdentKind = "other"): string {
	return foldWith(POSTGRES_FOLD_RULE, raw, kind);
}

/** Presentation twin: strip delimiters, no case change. */
export function displayName(raw: string): string {
	return displayWith(POSTGRES_FOLD_RULE, raw);
}

export function foldTableName(parts: string[]): string[] {
	return parts.map((p) => fold(p, "table"));
}

export function matchesSourceKey(key: string, rawPart: string): boolean {
	return key === fold(rawPart) || key === fold(rawPart, "table");
}
