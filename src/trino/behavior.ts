// The trino DialectBehavior: everything the semantic layer needs for trino, assembled from
// this folder's own pieces. The registry wires it; nothing here reaches a central per-dialect table.
// (Call signatures still read the shared FUNCTION_SIGNATURES.trino transitionally, until that table
// is assembled from the dialect modules in a follow-up pass.)
import type { DialectBehavior } from "../dialect-behavior/behavior.js";
import { acceptsFor } from "../dialect-behavior/coerce-rules.js";
import { likePatternToRegExp } from "../scope/like-pattern.js";
import { FUNCTION_SIGNATURES } from "../signature/signatures.js";
import { displayName, fold, foldTableName, matchesSourceKey } from "./fold.js";
import { trinoLiteral, trinoParseType, TRINO_FUNCTION_RETURNS } from "./infer.js";

// Trino implicit coercion: no VARCHAR<->numeric, no bool<->numeric — trino does NOT implicitly coerce.
const STR_TO_NUM = false;
const BOOL_NUM = false;

export const trinoBehavior: DialectBehavior = {
	fold,
	displayName,
	foldTableName,
	matchesSourceKey,
	likeMatch: (pattern, value) => likePatternToRegExp(pattern).test(value),
	literal: trinoLiteral,
	parseType: trinoParseType,
	functions: TRINO_FUNCTION_RETURNS,
	division: "integer",
	curatedSignatures: FUNCTION_SIGNATURES.trino,
	harvestedSignatures: {},
	arityUsesHarvested: false,
	accepts: (argType, paramText) => acceptsFor(trinoParseType, STR_TO_NUM, BOOL_NUM, argType, paramText),
};
