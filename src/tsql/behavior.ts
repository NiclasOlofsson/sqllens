// The tsql DialectBehavior: everything the semantic layer needs for tsql, assembled from
// this folder's own pieces. The registry wires it; nothing here reaches a central per-dialect table.
import type { DialectBehavior } from "../dialect-behavior/behavior.js";
import { acceptsFor } from "../dialect-behavior/coerce-rules.js";
import { likePatternToRegExp } from "../scope/like-pattern.js";
import { SIGNATURES } from "../signature/signatures.js";
import { displayName, fold, foldTableName, matchesSourceKey, TSQL_NAME_CONFIG } from "./fold.js";
import { tsqlLiteral, tsqlParseType, tsqlSpecial, TSQL_FUNCTION_RETURNS } from "./infer.js";

export const tsqlBehavior: DialectBehavior = {
	fold,
	displayName,
	foldTableName,
	matchesSourceKey,
	nameConfig: TSQL_NAME_CONFIG,
	likeMatch: (pattern, value) => likePatternToRegExp(pattern).test(value),
	literal: tsqlLiteral,
	parseType: tsqlParseType,
	functions: TSQL_FUNCTION_RETURNS,
	division: "integer",
	special: tsqlSpecial,
	signatures: SIGNATURES.tsql,
	// T-SQL implicit coercion: VARCHAR containing a number coerces to numeric (STR_TO_NUM=true), bool<->num coerces too (BOOL_NUM=true).
	accepts: (argType, paramText) => acceptsFor(tsqlParseType, true, true, argType, paramText),
};
