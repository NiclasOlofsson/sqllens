// The redshift DialectBehavior: everything the semantic layer needs for redshift, assembled from
// this folder's own pieces. The registry wires it; nothing here reaches a central per-dialect table.
import type { DialectBehavior } from "../dialect-behavior/behavior.js";
import { acceptsFor } from "../dialect-behavior/coerce-rules.js";
import { likePatternToRegExp } from "../scope/like-pattern.js";
import { SIGNATURES } from "../signature/signatures.js";
import { displayName, fold, foldTableName, matchesSourceKey, REDSHIFT_NAME_CONFIG } from "./fold.js";
import { redshiftLiteral, redshiftParseType, REDSHIFT_FUNCTION_RETURNS } from "./infer.js";

export const redshiftBehavior: DialectBehavior = {
	fold,
	displayName,
	foldTableName,
	matchesSourceKey,
	nameConfig: REDSHIFT_NAME_CONFIG,
	likeMatch: (pattern, value) => likePatternToRegExp(pattern).test(value),
	literal: redshiftLiteral,
	parseType: redshiftParseType,
	functions: REDSHIFT_FUNCTION_RETURNS,
	division: "integer",
	signatures: SIGNATURES.redshift,
	// Redshift implicit coercion: VARCHAR containing a number coerces to numeric (STR_TO_NUM=true), no bool<->num (BOOL_NUM=false).
	accepts: (argType, paramText) => acceptsFor(redshiftParseType, true, false, argType, paramText),
};
