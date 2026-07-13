// The duckdb DialectBehavior: everything the semantic layer needs for duckdb, assembled from
// this folder's own pieces. The registry wires it; nothing here reaches a central per-dialect table.
// (Call signatures still read the shared FUNCTION_SIGNATURES.duckdb transitionally, until that table
// is assembled from the dialect modules in a follow-up pass.)
import type { DialectBehavior } from "../dialect-behavior/behavior.js";
import { acceptsFor } from "../dialect-behavior/coerce-rules.js";
import { likePatternToRegExp } from "../scope/like-pattern.js";
import { FUNCTION_SIGNATURES } from "../signature/signatures.js";
import { displayName, fold, foldTableName, matchesSourceKey } from "./fold.js";
import { duckdbLiteral, duckdbParseType, DUCKDB_FUNCTION_RETURNS } from "./infer.js";

// DuckDB implicit coercion: a quoted constant is initially UNKNOWN and coerces to whatever the call
// needs (str->num), no bool<->num.
// STR_TO_NUM=true, BOOL_NUM=false
export const duckdbBehavior: DialectBehavior = {
	fold,
	displayName,
	foldTableName,
	matchesSourceKey,
	likeMatch: (pattern, value) => likePatternToRegExp(pattern).test(value),
	literal: duckdbLiteral,
	parseType: duckdbParseType,
	functions: DUCKDB_FUNCTION_RETURNS,
	division: "float",
	curatedSignatures: FUNCTION_SIGNATURES.duckdb,
	harvestedSignatures: {},
	arityUsesHarvested: false,
	accepts: (argType, paramText) => acceptsFor(duckdbParseType, true, false, argType, paramText),
};
