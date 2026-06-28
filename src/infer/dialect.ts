import { BIGQUERY_FUNCTION_RETURNS, bigqueryLiteral, bigqueryParseType } from "./bigquery.js";
import { FUNCTION_RETURNS, TSQL_FUNCTION_RETURNS, type FnRule } from "./functions.js";
import { SNOWFLAKE_FUNCTION_RETURNS, snowflakeLiteral, snowflakeParseType } from "./snowflake.js";
import { databricksLiteral, tsqlLiteral } from "./literals.js";
import { REDSHIFT_FUNCTION_RETURNS, redshiftParseType } from "./redshift.js";
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
	/** What `/` returns:
	 *  - "float"   — double for any numerics except decimal/decimal (Spark: int/int → double);
	 *  - "integer" — ordinary coercion (T-SQL: int/int → int, "typed division");
	 *  - "decimal" — a scaled NUMBER unless a float is involved (Snowflake: 10/3 → 3.333333). */
	division: "float" | "integer" | "decimal";
}

const databricks: InferDialect = {
	functions: FUNCTION_RETURNS,
	literal: databricksLiteral,
	parseType: (t) => parseType(t),
	division: "float",
};

const tsql: InferDialect = {
	functions: TSQL_FUNCTION_RETURNS,
	literal: tsqlLiteral,
	parseType: (t) => parseType(t, TSQL_ALIASES),
	division: "integer",
};

const snowflake: InferDialect = {
	functions: SNOWFLAKE_FUNCTION_RETURNS,
	literal: snowflakeLiteral,
	parseType: snowflakeParseType,
	division: "decimal",
};

const bigquery: InferDialect = {
	functions: BIGQUERY_FUNCTION_RETURNS,
	literal: bigqueryLiteral,
	parseType: bigqueryParseType,
	division: "float", // BigQuery: INT64 / INT64 → FLOAT64
};

const redshift: InferDialect = {
	functions: REDSHIFT_FUNCTION_RETURNS,
	literal: databricksLiteral,
	parseType: redshiftParseType,
	division: "integer", // Redshift: INT4 / INT4 → INT4 (truncates) — AWS r_numeric_computations201
};

const DIALECTS: Record<string, InferDialect> = { databricks, tsql, snowflake, bigquery, redshift };

/** Resolve a dialect tag to its inference knowledge; defaults to Databricks. */
export function inferDialect(name: string | undefined): InferDialect {
	return DIALECTS[name ?? "databricks"] ?? databricks;
}
