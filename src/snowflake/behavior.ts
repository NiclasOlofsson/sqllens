// The snowflake DialectBehavior: everything the semantic layer needs for snowflake, assembled from
// this folder's own pieces. The registry wires it; nothing here reaches a central per-dialect table.
import type { DialectBehavior } from "../dialect-behavior/behavior.js";
import { acceptsFor } from "../dialect-behavior/coerce-rules.js";
import { likePatternToRegExp } from "../scope/like-pattern.js";
import { SIGNATURES } from "../signature/signatures.js";
import { displayName, fold, foldTableName, matchesSourceKey, SNOWFLAKE_NAME_CONFIG } from "./fold.js";
import { snowflakeLiteral, snowflakeParseType, SNOWFLAKE_FUNCTION_RETURNS, snowflakeSpecial } from "./infer.js";

// Snowflake implicit coercion: VARCHAR containing a number coerces to NUMBER (str->num), no bool<->num.
const STR_TO_NUM = true;
const BOOL_NUM = false;

export const snowflakeBehavior: DialectBehavior = {
	fold,
	displayName,
	foldTableName,
	matchesSourceKey,
	nameConfig: SNOWFLAKE_NAME_CONFIG,
	likeMatch: (pattern, value) => likePatternToRegExp(pattern).test(value),
	literal: snowflakeLiteral,
	parseType: snowflakeParseType,
	functions: SNOWFLAKE_FUNCTION_RETURNS,
	division: "decimal", // Snowflake: 10/3 -> 3.333333, a scaled NUMBER unless a float is involved
	special: snowflakeSpecial,
	signatures: SIGNATURES.snowflake,
	accepts: (argType, paramText) => acceptsFor(snowflakeParseType, STR_TO_NUM, BOOL_NUM, argType, paramText),
};
