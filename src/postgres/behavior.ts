// The postgres DialectBehavior: everything the semantic layer needs for postgres, assembled from
// this folder's own pieces. The registry wires it; nothing here reaches a central per-dialect table.
// (Call signatures still read the shared FUNCTION_SIGNATURES.postgres transitionally, until that table
// is assembled from the dialect modules in a follow-up pass.)
import type { DialectBehavior } from "../dialect-behavior/behavior.js";
import { acceptsFor } from "../dialect-behavior/coerce-rules.js";
import { likePatternToRegExp } from "../scope/like-pattern.js";
import { FUNCTION_SIGNATURES } from "../signature/signatures.js";
import { displayName, fold, foldTableName, matchesSourceKey } from "./fold.js";
import { postgresLiteral, postgresParseType, POSTGRES_FUNCTION_RETURNS } from "./infer.js";

// PostgreSQL implicit coercion: str->num=true, bool<->num=false.
export const postgresBehavior: DialectBehavior = {
	fold,
	displayName,
	foldTableName,
	matchesSourceKey,
	likeMatch: (pattern, value) => likePatternToRegExp(pattern).test(value),
	literal: postgresLiteral,
	parseType: postgresParseType,
	functions: POSTGRES_FUNCTION_RETURNS,
	division: "integer",
	curatedSignatures: FUNCTION_SIGNATURES.postgres,
	harvestedSignatures: {},
	arityUsesHarvested: false,
	accepts: (argType, paramText) => acceptsFor(postgresParseType, true, false, argType, paramText),
};
