// The sqlite DialectBehavior: everything the semantic layer needs for sqlite, assembled from
// this folder's own pieces. The registry wires it; nothing here reaches a central per-dialect table.
import type { DialectBehavior } from "../dialect-behavior/behavior.js";
import { acceptsFor } from "../dialect-behavior/coerce-rules.js";
import { likePatternToRegExp } from "../scope/like-pattern.js";
import { SIGNATURES } from "../signature/signatures.js";
import { displayName, fold, foldTableName, matchesSourceKey, SQLITE_NAME_CONFIG } from "./fold.js";
import { sqliteLiteral, sqliteParseType, SQLITE_FUNCTION_RETURNS } from "./infer.js";

export const sqliteBehavior: DialectBehavior = {
	fold,
	displayName,
	foldTableName,
	matchesSourceKey,
	nameConfig: SQLITE_NAME_CONFIG,
	likeMatch: (pattern, value) => likePatternToRegExp(pattern).test(value),
	literal: sqliteLiteral,
	parseType: sqliteParseType,
	functions: SQLITE_FUNCTION_RETURNS,
	division: "integer",
	signatures: SIGNATURES.sqlite,
	// SQLite implicit coercion: TEXT containing a number coerces to numeric (STR_TO_NUM=true), no bool<->num (BOOL_NUM=false).
	accepts: (argType, paramText) => acceptsFor(sqliteParseType, true, false, argType, paramText),
};
