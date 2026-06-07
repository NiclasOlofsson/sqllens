import { FUNCTION_RETURNS, TSQL_FUNCTION_RETURNS, type FnRule } from "./functions.js";
import { databricksLiteral, tsqlLiteral } from "./literals.js";
import { parseType, TSQL_ALIASES, type Type } from "./types.js";

// Per-dialect inference knowledge. The inference *engine* (src/infer/infer.ts) is dialect-agnostic;
// this is the *knowledge* it varies by dialect — function return types, literal forms, and how a
// dialect's scalar type names map onto the shared canonical types. inferType selects the table from
// the scope's `dialect` tag (set by resolveScopes). A missing function rule yields `unknown`, never
// a wrong type. Adding a dialect = one entry here, no engine change.

export interface InferDialect {
	functions: Record<string, FnRule>;
	literal(text: string): Type;
	parseType(text: string): Type;
}

const databricks: InferDialect = {
	functions: FUNCTION_RETURNS,
	literal: databricksLiteral,
	parseType: (t) => parseType(t),
};

const tsql: InferDialect = {
	functions: TSQL_FUNCTION_RETURNS,
	literal: tsqlLiteral,
	parseType: (t) => parseType(t, TSQL_ALIASES),
};

const DIALECTS: Record<string, InferDialect> = { databricks, tsql };

/** Resolve a dialect tag to its inference knowledge; defaults to Databricks. */
export function inferDialect(name: string | undefined): InferDialect {
	return DIALECTS[name ?? "databricks"] ?? databricks;
}
