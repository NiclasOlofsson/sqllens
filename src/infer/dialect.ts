import type { Expr } from "../ir/ir.js";
import { BIGQUERY_FUNCTION_RETURNS, bigqueryLiteral, bigqueryParseType, bigquerySpecial } from "./bigquery.js";
import { FUNCTION_RETURNS, TSQL_FUNCTION_RETURNS, tsqlSpecial, type FnRule } from "./functions.js";
import { SNOWFLAKE_FUNCTION_RETURNS, snowflakeLiteral, snowflakeParseType, snowflakeSpecial } from "./snowflake.js";
import { databricksLiteral, tsqlLiteral } from "./literals.js";
import { REDSHIFT_FUNCTION_RETURNS, redshiftLiteral, redshiftParseType } from "./redshift.js";
import { POSTGRES_FUNCTION_RETURNS, postgresLiteral, postgresParseType } from "./postgres.js";
import { DUCKDB_FUNCTION_RETURNS, duckdbLiteral, duckdbParseType } from "./duckdb.js";
import { TRINO_FUNCTION_RETURNS, trinoLiteral, trinoParseType } from "./trino.js";
import { SQLITE_FUNCTION_RETURNS, sqliteLiteral, sqliteParseType } from "./sqlite.js";
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
	/** Optional pre-registry hook for calls whose return type a plain FnRule can't express because it
	 *  depends on a non-argument-TYPE detail — e.g. BigQuery EXTRACT's datepart keyword. Given the
	 *  function IR node, returns a Type to short-circuit the registry, or undefined to fall through. */
	special?(fn: Extract<Expr, { kind: "function" }>): Type | undefined;
}

const databricks: InferDialect = {
	functions: FUNCTION_RETURNS,
	literal: databricksLiteral,
	parseType: (t) => parseType(t, undefined, "databricks"),
	division: "float",
};

const tsql: InferDialect = {
	functions: TSQL_FUNCTION_RETURNS,
	literal: tsqlLiteral,
	parseType: (t) => parseType(t, TSQL_ALIASES, "tsql"),
	division: "integer",
	special: tsqlSpecial, // XML data type methods: value()/exist()/query() typed by method + sqltype
};

const snowflake: InferDialect = {
	functions: SNOWFLAKE_FUNCTION_RETURNS,
	literal: snowflakeLiteral,
	parseType: snowflakeParseType,
	division: "decimal",
	special: snowflakeSpecial, // <seq>.NEXTVAL → NUMBER (the sequence rides as a variable qualifier)
};

const bigquery: InferDialect = {
	functions: BIGQUERY_FUNCTION_RETURNS,
	literal: bigqueryLiteral,
	parseType: bigqueryParseType,
	division: "float", // BigQuery: INT64 / INT64 → FLOAT64
	special: bigquerySpecial, // EXTRACT(part FROM …) typed by its datepart keyword
};

const redshift: InferDialect = {
	functions: REDSHIFT_FUNCTION_RETURNS,
	literal: redshiftLiteral,
	parseType: redshiftParseType,
	division: "integer", // Redshift: INT4 / INT4 → INT4 (truncates) — AWS r_numeric_computations201
};

const postgres: InferDialect = {
	functions: POSTGRES_FUNCTION_RETURNS,
	literal: postgresLiteral,
	parseType: postgresParseType,
	division: "integer", // PostgreSQL: integer / integer truncates toward zero — functions-math.html
};

const duckdb: InferDialect = {
	functions: DUCKDB_FUNCTION_RETURNS,
	literal: duckdbLiteral,
	parseType: duckdbParseType,
	division: "float", // DuckDB: `/` is DOUBLE division even for integers (`//` divides) — functions/numeric.md
};

const trino: InferDialect = {
	functions: TRINO_FUNCTION_RETURNS,
	literal: trinoLiteral,
	parseType: trinoParseType,
	division: "integer", // Trino: integer / integer truncates - functions/math.html
};

const sqlite: InferDialect = {
	functions: SQLITE_FUNCTION_RETURNS,
	literal: sqliteLiteral,
	parseType: sqliteParseType,
	// SQLite: "Integer divide yields an integer result, truncated toward zero" (lang_expr.html) —
	// 5/2 → 2, same typed-division shape as tsql/postgres/redshift/trino (NOT databricks, whose
	// `/` widens to float even for two integers).
	division: "integer",
};

const DIALECTS: Record<string, InferDialect> = {
	databricks,
	tsql,
	snowflake,
	bigquery,
	redshift,
	postgres,
	duckdb,
	trino,
	sqlite,
};

/** Resolve a dialect tag to its inference knowledge; defaults to Databricks. */
export function inferDialect(name: string | undefined): InferDialect {
	return DIALECTS[name ?? "databricks"] ?? databricks;
}
