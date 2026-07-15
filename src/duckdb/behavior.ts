// The duckdb DialectBehavior: everything the semantic layer needs for duckdb, assembled from
// this folder's own pieces. The registry wires it; nothing here reaches a central per-dialect table.
import type { DialectBehavior } from "../dialect-behavior/behavior.js";
import { acceptsFor } from "../dialect-behavior/coerce-rules.js";
import { likePatternToRegExp } from "../scope/like-pattern.js";
import { SIGNATURES } from "../signature/signatures.js";
import { displayName, fold, foldTableName, matchesSourceKey, DUCKDB_NAME_CONFIG } from "./fold.js";
import { duckdbLiteral, duckdbParseType, DUCKDB_FUNCTION_RETURNS } from "./infer.js";

// DuckDB implicit coercion: a quoted constant is initially UNKNOWN and coerces to whatever the call
// needs (str->num), no bool<->num.
// STR_TO_NUM=true, BOOL_NUM=false
export const duckdbBehavior: DialectBehavior = {
	fold,
	displayName,
	foldTableName,
	matchesSourceKey,
	nameConfig: DUCKDB_NAME_CONFIG,
	likeMatch: (pattern, value) => likePatternToRegExp(pattern).test(value),
	literal: duckdbLiteral,
	parseType: duckdbParseType,
	functions: DUCKDB_FUNCTION_RETURNS,
	division: "float",
	signatures: SIGNATURES.duckdb,
	accepts: (argType, paramText) => acceptsFor(duckdbParseType, true, false, argType, paramText),
};
