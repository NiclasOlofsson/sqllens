// The sqlite DialectBehavior: everything the semantic layer needs for sqlite, assembled from
// this folder's own pieces. The registry wires it; nothing here reaches a central per-dialect table.
// (Call signatures still read the shared FUNCTION_SIGNATURES.sqlite transitionally, until that table
// is assembled from the dialect modules in a follow-up pass.)
import type { DialectBehavior } from "../dialect-behavior/behavior.js";
import { acceptsFor } from "../dialect-behavior/coerce-rules.js";
import { likePatternToRegExp } from "../scope/like-pattern.js";
import { FUNCTION_SIGNATURES } from "../signature/signatures.js";
import { displayName, fold, foldTableName, matchesSourceKey } from "./fold.js";
import { sqliteLiteral, sqliteParseType, SQLITE_FUNCTION_RETURNS } from "./infer.js";

export const sqliteBehavior: DialectBehavior = {
	fold,
	displayName,
	foldTableName,
	matchesSourceKey,
	likeMatch: (pattern, value) => likePatternToRegExp(pattern).test(value),
	literal: sqliteLiteral,
	parseType: sqliteParseType,
	functions: SQLITE_FUNCTION_RETURNS,
	division: "integer",
	curatedSignatures: FUNCTION_SIGNATURES.sqlite,
	harvestedSignatures: {},
	arityUsesHarvested: false,
	// SQLite implicit coercion: TEXT containing a number coerces to numeric (STR_TO_NUM=true), no bool<->num (BOOL_NUM=false).
	accepts: (argType, paramText) => acceptsFor(sqliteParseType, true, false, argType, paramText),
};
