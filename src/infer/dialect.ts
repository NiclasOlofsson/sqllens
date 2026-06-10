import { SNOWFLAKE_FUNCTION_RETURNS, snowflakeLiteral, snowflakeParseType } from "../snowflake/infer.js";
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
	/** `/` returns a float for any numeric operands (Spark: int/int → double). When false the
	 *  operator is typed by ordinary coercion (T-SQL: int/int → int, "typed division"). */
	floatDivision: boolean;
}

const databricks: InferDialect = {
	functions: FUNCTION_RETURNS,
	literal: databricksLiteral,
	parseType: (t) => parseType(t),
	floatDivision: true,
};

const tsql: InferDialect = {
	functions: TSQL_FUNCTION_RETURNS,
	literal: tsqlLiteral,
	parseType: (t) => parseType(t, TSQL_ALIASES),
	floatDivision: false,
};

const snowflake: InferDialect = {
	functions: SNOWFLAKE_FUNCTION_RETURNS,
	literal: snowflakeLiteral,
	parseType: snowflakeParseType,
	// Snowflake int/int is decimal division (10/3 → 3.333333, a scaled NUMBER) — neither
	// Spark's double nor T-SQL's integer division. `true` gives the closer approximation
	// (non-integer result); the exact NUMBER-scale semantics need a richer division hook
	// (docs/snowflake-backlog.md).
	floatDivision: true,
};

const DIALECTS: Record<string, InferDialect> = { databricks, tsql, snowflake };

/** Resolve a dialect tag to its inference knowledge; defaults to Databricks. */
export function inferDialect(name: string | undefined): InferDialect {
	return DIALECTS[name ?? "databricks"] ?? databricks;
}
