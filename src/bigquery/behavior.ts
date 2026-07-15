// The bigquery DialectBehavior: everything the semantic layer needs for bigquery, assembled from
// this folder's own pieces. The registry wires it; nothing here reaches a central per-dialect table.
import type { DialectBehavior } from "../dialect-behavior/behavior.js";
import { acceptsFor } from "../dialect-behavior/coerce-rules.js";
import { likePatternToRegExp } from "../scope/like-pattern.js";
import { SIGNATURES } from "../signature/signatures.js";
import { displayName, fold, foldTableName, matchesSourceKey, BIGQUERY_NAME_CONFIG } from "./fold.js";
import { bigqueryLiteral, bigqueryParseType, bigquerySpecial, BIGQUERY_FUNCTION_RETURNS } from "./infer.js";

export const bigqueryBehavior: DialectBehavior = {
	fold,
	displayName,
	foldTableName,
	matchesSourceKey,
	nameConfig: BIGQUERY_NAME_CONFIG,
	likeMatch: (pattern, value) => likePatternToRegExp(pattern).test(value),
	literal: bigqueryLiteral,
	parseType: bigqueryParseType,
	functions: BIGQUERY_FUNCTION_RETURNS,
	division: "float",
	special: bigquerySpecial,
	signatures: SIGNATURES.bigquery,
	// BigQuery implicit coercion: no STRING->NUMBER coercion, no BOOL<->NUMBER coercion (STR_TO_NUM=false, BOOL_NUM=false).
	accepts: (argType, paramText) => acceptsFor(bigqueryParseType, false, false, argType, paramText),
};
