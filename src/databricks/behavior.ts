// The databricks DialectBehavior: everything the semantic layer needs for databricks, assembled from
// this folder's own pieces. The registry wires it; nothing here reaches a central per-dialect table.
import type { DialectBehavior } from "../dialect-behavior/behavior.js";
import { acceptsFor } from "../dialect-behavior/coerce-rules.js";
import { likePatternToRegExp } from "../scope/like-pattern.js";
import { SIGNATURES } from "../signature/signatures.js";
import { displayName, fold, foldTableName, matchesSourceKey, DATABRICKS_NAME_CONFIG } from "./fold.js";
import { databricksLiteral, databricksParseType, databricksSpecial, DATABRICKS_FUNCTION_RETURNS } from "./infer.js";

export const databricksBehavior: DialectBehavior = {
	fold,
	displayName,
	foldTableName,
	matchesSourceKey,
	nameConfig: DATABRICKS_NAME_CONFIG,
	likeMatch: (pattern, value) => likePatternToRegExp(pattern).test(value),
	literal: databricksLiteral,
	parseType: databricksParseType,
	functions: DATABRICKS_FUNCTION_RETURNS,
	division: "float",
	dateSubtraction: "interval",
	special: databricksSpecial,
	signatures: SIGNATURES.databricks,
	// Databricks implicit coercion: STRING containing a number coerces to numeric (STR_TO_NUM=true), no bool<->num (BOOL_NUM=false).
	accepts: (argType, paramText) => acceptsFor(databricksParseType, true, false, argType, paramText),
};
