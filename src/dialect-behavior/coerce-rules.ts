// Per-dialect implicit argument-coercion acceptance for call-arg diagnostics. Moved out of
// src/qualify/check-calls.ts so the semantic layer stops importing inferDialect / the Dialect union;
// the DialectBehavior.accepts facet delegates here. Never-wrong: return true (accept) unless we are
// CONFIDENT the two are incompatible FOR THIS DIALECT. Implicit conversion is dialect law, not shared
// SQL law (the same str->num mismatch is a hard error in BigQuery and valid in Spark), so a reject is a
// per-dialect capability, not a global set. `string` is a universal sink (any scalar renders as text),
// so widening TO string is always accepted; only two directional mismatches are ever rejected, each
// gated on the dialect NOT bridging it implicitly.
import type { Type } from "../infer/types.js";

type Family = "num" | "str" | "bool" | "temporal" | "binary" | "other";

const NUMERIC = new Set(["tinyint", "smallint", "int", "bigint", "float", "double", "decimal"]);
const TEMPORAL = new Set(["date", "timestamp", "time", "interval"]);

function familyOf(name: string): Family {
	if (NUMERIC.has(name)) return "num";
	if (name === "string") return "str";
	if (name === "boolean") return "bool";
	if (TEMPORAL.has(name)) return "temporal";
	if (name === "binary") return "binary";
	return "other";
}

// Dialects that implicitly bridge STRING to numeric in a function argument, so a str->num mismatch must
// NOT be flagged. Doc-cited per dialect:
//  - databricks: implicit crosscasting casts STRING to the expected numeric type
//    (docs.databricks.com/sql/language-manual/sql-ref-datatype-rules);
//  - tsql: char/varchar to int/decimal is an implicit conversion in the CAST/CONVERT chart
//    (learn.microsoft.com/sql/t-sql/functions/cast-and-convert-transact-sql);
//  - snowflake: VARCHAR containing a number coerces to NUMBER
//    (docs.snowflake.com/en/sql-reference/data-type-conversion);
//  - redshift: PG-8.0 lineage keeps pre-8.3 implicit text to numeric casts
//    (docs.aws.amazon.com/redshift/latest/dg/c_Supported_data_types.html);
//  - postgres / duckdb: a quoted constant is initially UNKNOWN and coerces to whatever the call needs
//    (postgresql.org/docs/18 sql-syntax-lexical 4.1.2.1), but our inference types every quoted literal
//    as `string`, so rejecting would false-fire on valid SQL;
//  - sqlite: TEXT/NUMERIC type affinity coerces a TEXT value against a numeric argument
//    (sqlite.org/datatype3.html "Type Affinity");
//  - mysql: numeric context converts a string operand to a number automatically
//    (dev.mysql.com/doc/refman/8.4/en/type-conversion.html).
// NOT in the set (rejection stays live, corpus-proven): bigquery, trino.
export const IMPLICIT_STR_TO_NUM: ReadonlySet<string> = new Set([
	"databricks",
	"tsql",
	"snowflake",
	"redshift",
	"postgres",
	"duckdb",
	"sqlite",
	"mysql",
]);

// Dialects that implicitly bridge boolean to/from numeric. tsql: `bit` (aliased to boolean) converts
// to/from int per the CAST/CONVERT chart. mysql: BOOL/BOOLEAN is a documented TINYINT(1) synonym
// (dev.mysql.com/doc/refman/8.4/en/numeric-type-syntax.html) and a comparison result is 1/0/NULL,
// assignable anywhere an integer is expected. Everywhere else bool<->num rejection is corpus-proven safe;
// sqlite is left out (TRUE/FALSE are literal aliases for 1/0 and SQLITE_ALIASES has no bool key, so this
// checker never sees a boolean-typed sqlite argument from a declared column).
export const IMPLICIT_BOOL_NUM: ReadonlySet<string> = new Set(["tsql", "mysql"]);

/** Whether `argType` is acceptable for a declared param whose type text is `paramText`. `parseType`
 *  parses that text with the dialect's rules; `strToNum`/`boolNum` are the dialect's implicit-coercion
 *  flags (IMPLICIT_STR_TO_NUM / IMPLICIT_BOOL_NUM membership). Pure engine, takes no dialect. */
export function acceptsFor(
	parseType: (text: string) => Type,
	strToNum: boolean,
	boolNum: boolean,
	argType: Type,
	paramText: string | undefined,
): boolean {
	if (!paramText) return true; // untyped param -> no information, accept
	const param = parseType(paramText);
	if (param.kind !== "scalar" || argType.kind !== "scalar") return true; // complex/unknown -> accept
	const fa = familyOf(argType.name);
	const fp = familyOf(param.name);
	if (fa === fp) return true; // same family -> accept
	if (fa === "str" && fp === "num") return strToNum;
	if ((fa === "bool" && fp === "num") || (fa === "num" && fp === "bool")) return boolNum;
	return true; // every other cross-family pair accepts
}
