// T-SQL identifier folding. The FoldRule plus its bound engine, colocated here because BOTH the
// upstream lower() and the downstream DialectBehavior need it (the fold rule is the one dialect concern
// used at two stages).
// learn.microsoft.com/en-us/sql/relational-databases/databases/database-identifiers +
// .../sql/t-sql/statements/collations — verified live: case folding is NOT a hardcoded T-SQL
// rule, it's a function of the identifier's COLLATION: "you can create two tables with names
// that differ only in case in a database that has case-sensitive collation, but you can't...
// in a database that has case-insensitive collation." Most SQL Server / Fabric SQL database
// defaults are case-insensitive (e.g. SQL_Latin1_General_CP1_CI_AS), but this is not universal
// — Fabric Warehouse defaults to the case-SENSITIVE Latin1_General_100_BIN2_UTF8. This module
// encodes the common default-collation (CI) behavior; a caller with a known case-sensitive
// collation is a documented boundary this module does not cross. Delimiting with `[ ]` or
// `" "` does not itself change case behavior — quoting only unlocks reserved words/specials.
import { displayWith, foldWith, type FoldRule, type IdentKind } from "../ident/fold.js";
import type { QualifiedNameConfig } from "../ir/qualified-name.js";

const DOUBLE_QUOTE: readonly [string, string] = ['"', '"'];

export const TSQL_FOLD_RULE: FoldRule = {
	delimiters: [["[", "]"], DOUBLE_QUOTE],
	unquoted: "lower",
	quoted: "lower",
};

/** Four-part names: linked_server.database.schema.object, with elidable middle parts
 *  (`db..t` = default schema) — learn.microsoft.com "Transact-SQL syntax conventions",
 *  multipart names. Normalized vocabulary: server = linked server, catalog = database. */
export const TSQL_NAME_CONFIG: QualifiedNameConfig = {
	roles: ["server", "catalog", "schema"],
	rule: TSQL_FOLD_RULE,
};

/** Fold an identifier to its T-SQL identity key. */
export function fold(raw: string, kind: IdentKind = "other"): string {
	return foldWith(TSQL_FOLD_RULE, raw, kind);
}

/** Presentation twin: strip delimiters, no case change. */
export function displayName(raw: string): string {
	return displayWith(TSQL_FOLD_RULE, raw);
}

export function foldTableName(parts: string[]): string[] {
	return parts.map((p) => fold(p, "table"));
}

export function matchesSourceKey(key: string, rawPart: string): boolean {
	return key === fold(rawPart) || key === fold(rawPart, "table");
}
