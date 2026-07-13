// The databricks DialectBehavior: everything the semantic layer needs for databricks, assembled from
// this folder's own pieces. The registry wires it; nothing here reaches a central per-dialect table.
// (Call signatures still read the shared FUNCTION_SIGNATURES.databricks transitionally, until that table
// is assembled from the dialect modules in a follow-up pass.)
import type { DialectBehavior } from "../dialect-behavior/behavior.js";
import { acceptsFor } from "../dialect-behavior/coerce-rules.js";
import { likePatternToRegExp } from "../scope/like-pattern.js";
import { FUNCTION_SIGNATURES } from "../signature/signatures.js";
import { displayName, fold, foldTableName, matchesSourceKey } from "./fold.js";
import { databricksLiteral, databricksParseType, DATABRICKS_FUNCTION_RETURNS } from "./infer.js";

export const databricksBehavior: DialectBehavior = {
	fold,
	displayName,
	foldTableName,
	matchesSourceKey,
	likeMatch: (pattern, value) => likePatternToRegExp(pattern).test(value),
	literal: databricksLiteral,
	parseType: databricksParseType,
	functions: DATABRICKS_FUNCTION_RETURNS,
	division: "float",
	curatedSignatures: FUNCTION_SIGNATURES.databricks,
	harvestedSignatures: {},
	arityUsesHarvested: false,
	// Databricks implicit coercion: STRING containing a number coerces to numeric (STR_TO_NUM=true), no bool<->num (BOOL_NUM=false).
	accepts: (argType, paramText) => acceptsFor(databricksParseType, true, false, argType, paramText),
};
