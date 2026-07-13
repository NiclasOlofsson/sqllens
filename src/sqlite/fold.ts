// SQLite identifier folding. The FoldRule plus its bound engine, colocated here because BOTH the
// upstream lower() and the downstream DialectBehavior need it (the fold rule is the one dialect concern
// used at two stages).
//
// sqlite.org/lang_keywords.html — verified live: SQLite recognizes three identifier-quoting
// delimiters, each documented only as "is an identifier" (double-quote, square-bracket, and
// grave-accent/backtick forms) with no case-sensitivity distinction drawn between them or
// against the unquoted form. SQLite's own grammar (IDENTIFIER token) treats `"x"`, `` `x` ``,
// `[x]` and bare `x` as the same lexical category, and SQLite's C-level identifier compare
// (sqlite3StrICmp) is ASCII case-insensitive regardless of how the name was spelled — the
// documented quirk this module's brief calls out: unlike Postgres/Snowflake, quoting an
// identifier does NOT make it case-sensitive in SQLite. So both unquoted AND quoted fold to
// lower here (same shape as redshift/duckdb/trino). SQLite's own documented fold is
// ASCII-only (it does not case-fold non-ASCII), but this module's shared applyCase uses JS
// toLowerCase() — a Unicode-wide fold — so a rare non-ASCII identifier pair (Ä vs ä) that
// SQLite would keep distinct conflates here: a known shared-engine limitation, consistent
// across every dialect in this table. Bracket delimiters have no escape mechanism (the
// lexer's `[`...`]` body is `~']'*` — no doubling), so a doubled `]]` inside `[...]` is not
// unescaped, same as this module's tsql bracket handling.
import { displayWith, foldWith, type FoldRule, type IdentKind } from "../ident/fold.js";

const DOUBLE_QUOTE: readonly [string, string] = ['"', '"'];
const BACKTICK: readonly [string, string] = ["`", "`"];

export const SQLITE_FOLD_RULE: FoldRule = {
	delimiters: [DOUBLE_QUOTE, BACKTICK, ["[", "]"]],
	unquoted: "lower",
	quoted: "lower",
};

/** Fold an identifier to its SQLite identity key. */
export function fold(raw: string, kind: IdentKind = "other"): string {
	return foldWith(SQLITE_FOLD_RULE, raw, kind);
}

/** Presentation twin: strip delimiters, no case change. */
export function displayName(raw: string): string {
	return displayWith(SQLITE_FOLD_RULE, raw);
}

export function foldTableName(parts: string[]): string[] {
	return parts.map((p) => fold(p, "table"));
}

export function matchesSourceKey(key: string, rawPart: string): boolean {
	return key === fold(rawPart) || key === fold(rawPart, "table");
}
