// PostgreSQL identifier folding. The FoldRule plus its bound engine, colocated here because BOTH the
// upstream lower() and the downstream DialectBehavior need it (the fold rule is the one dialect concern
// used at two stages).
//
// postgresql.org/docs/18/sql-syntax-lexical.html §4.1.1 — verified live: "unquoted names are
// always folded to lower case"; "Quoting an identifier also makes it case-sensitive" — example
// "the identifiers FOO, foo, and "foo" are considered the same by PostgreSQL, but "Foo" and
// "FOO" are different." Doubled-quote escape: "To include a double quote, write two double
// quotes."
import { displayWith, foldWith, type FoldRule, type IdentKind } from "../ident/fold.js";

const DOUBLE_QUOTE: readonly [string, string] = ['"', '"'];

export const POSTGRES_FOLD_RULE: FoldRule = {
	delimiters: [DOUBLE_QUOTE],
	unquoted: "lower",
	quoted: "preserve",
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
