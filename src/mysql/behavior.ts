// The mysql DialectBehavior: everything the semantic layer needs for mysql, assembled from
// this folder's own pieces. The registry wires it; nothing here reaches a central per-dialect table.
import { mysqlLiteral, mysqlParseType, MYSQL_FUNCTION_RETURNS } from "./infer.js";
import { displayName, fold, foldTableName, matchesSourceKey, MYSQL_NAME_CONFIG } from "./fold.js";
import { likePatternToRegExp } from "../scope/like-pattern.js";
import { SIGNATURES } from "../signature/signatures.js";
import { acceptsFor } from "../dialect-behavior/coerce-rules.js";
import type { DialectBehavior } from "../dialect-behavior/behavior.js";

export const mysqlBehavior: DialectBehavior = {
	fold,
	displayName,
	foldTableName,
	matchesSourceKey,
	nameConfig: MYSQL_NAME_CONFIG,
	likeMatch: (pattern, value) => likePatternToRegExp(pattern).test(value),
	literal: mysqlLiteral,
	parseType: mysqlParseType,
	functions: MYSQL_FUNCTION_RETURNS,
	division: "decimal",
	signatures: SIGNATURES.mysql,
	// STR_TO_NUM=true, BOOL_NUM=true: mysql implicitly coerces both string->number and bool<->number.
	accepts: (argType, paramText) => acceptsFor(mysqlParseType, true, true, argType, paramText),
};
