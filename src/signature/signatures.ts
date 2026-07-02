// ---------------------------------------------------------------------------
// Curated per-dialect function-signature tables.
//
// The inference registry (src/infer/dialect.ts: FnRule = (args) => Type) knows a
// function's RETURN type but carries NO parameter metadata. Signature help needs
// parameter NAMES and types, so this is new, separate data: a hand-authored set
// of the high-frequency scalar / date / string / conversion / aggregate functions
// a data engineer actually calls, with the exact parameter names + order pulled
// from each dialect's official docs (cited per entry). It is intentionally bounded
// (~20–40 per dialect, not the whole registry); the long tail degrades to a
// name-only hint in signatureAt() (the uncurated fallback Niclas approved).
//
// The arg ORDER differs per dialect — DATEADD is (datepart, number, date) in
// T-SQL, (part, value, date) in Snowflake, (datepart, interval, date) in Redshift
// — so each dialect's table is authored from its own docs, never copied across.
//
// Core module: pure data + types, no antlr, no LSP deps.
// ---------------------------------------------------------------------------

import type { Dialect } from "../api.js";
import { TSQL_HARVESTED } from "./generated/tsql.js";

/** One formal parameter of a curated signature. `type` is the dialect's documented type name. */
export interface ParamSig {
	name: string;
	type?: string;
}

/** A curated function signature. `variadic` means the LAST param repeats (e.g. concat/coalesce). */
export interface FnSignature {
	name: string;
	params: ParamSig[];
	variadic?: boolean;
}

const p = (name: string, type?: string): ParamSig => (type === undefined ? { name } : { name, type });

// ---------------------------------------------------------------------------
// Databricks (Spark SQL) — docs.databricks.com / spark.apache.org built-in
// functions reference. Each entry cites the function's reference page name.
// ---------------------------------------------------------------------------
const DATABRICKS: Record<string, FnSignature> = {
	// date/time — Spark "Date and timestamp functions"
	date_add: { name: "date_add", params: [p("start_date", "date"), p("num_days", "int")] }, // date_add function
	date_sub: { name: "date_sub", params: [p("start_date", "date"), p("num_days", "int")] }, // date_sub function
	datediff: { name: "datediff", params: [p("endDate", "date"), p("startDate", "date")] }, // datediff function
	date_trunc: { name: "date_trunc", params: [p("fmt", "string"), p("ts", "timestamp")] }, // date_trunc function
	trunc: { name: "trunc", params: [p("date", "date"), p("fmt", "string")] }, // trunc function
	to_date: { name: "to_date", params: [p("expr", "string"), p("fmt", "string")] }, // to_date function
	to_timestamp: { name: "to_timestamp", params: [p("expr", "string"), p("fmt", "string")] }, // to_timestamp function
	date_format: { name: "date_format", params: [p("expr", "date"), p("fmt", "string")] }, // date_format function
	add_months: { name: "add_months", params: [p("startDate", "date"), p("numMonths", "int")] }, // add_months function
	// string — Spark "String functions"
	concat: { name: "concat", params: [p("expr", "string")], variadic: true }, // concat function (variadic)
	concat_ws: { name: "concat_ws", params: [p("sep", "string"), p("expr", "string")], variadic: true }, // concat_ws function
	substring: { name: "substring", params: [p("str", "string"), p("pos", "int"), p("len", "int")] }, // substring function
	substr: { name: "substr", params: [p("str", "string"), p("pos", "int"), p("len", "int")] }, // substr function
	split: { name: "split", params: [p("str", "string"), p("regex", "string"), p("limit", "int")] }, // split function
	split_part: { name: "split_part", params: [p("str", "string"), p("delimiter", "string"), p("partNum", "int")] }, // split_part function
	replace: { name: "replace", params: [p("str", "string"), p("search", "string"), p("replace", "string")] }, // replace function
	trim: { name: "trim", params: [p("str", "string")] }, // trim function
	lpad: { name: "lpad", params: [p("str", "string"), p("len", "int"), p("pad", "string")] }, // lpad function
	rpad: { name: "rpad", params: [p("str", "string"), p("len", "int"), p("pad", "string")] }, // rpad function
	regexp_replace: {
		name: "regexp_replace",
		params: [p("str", "string"), p("regexp", "string"), p("rep", "string")],
	}, // regexp_replace function
	regexp_extract: {
		name: "regexp_extract",
		params: [p("str", "string"), p("regexp", "string"), p("idx", "int")],
	}, // regexp_extract function
	// conditional / null — Spark "Conditional functions"
	coalesce: { name: "coalesce", params: [p("expr")], variadic: true }, // coalesce function (variadic)
	nvl: { name: "nvl", params: [p("expr1"), p("expr2")] }, // nvl function
	nullif: { name: "nullif", params: [p("expr1"), p("expr2")] }, // nullif function
	if: { name: "if", params: [p("cond", "boolean"), p("ifTrue"), p("ifFalse")] }, // if function
	// numeric — Spark "Mathematical functions"
	round: { name: "round", params: [p("expr", "numeric"), p("targetScale", "int")] }, // round function
	abs: { name: "abs", params: [p("expr", "numeric")] }, // abs function
	ceil: { name: "ceil", params: [p("expr", "numeric")] }, // ceil function
	floor: { name: "floor", params: [p("expr", "numeric")] }, // floor function
	power: { name: "power", params: [p("expr1", "double"), p("expr2", "double")] }, // power function
	mod: { name: "mod", params: [p("dividend", "numeric"), p("divisor", "numeric")] }, // mod function
	cast: { name: "cast", params: [p("expr"), p("type")] }, // cast function
	// aggregate — Spark "Aggregate functions"
	count: { name: "count", params: [p("expr")] }, // count aggregate
	sum: { name: "sum", params: [p("expr", "numeric")] }, // sum aggregate
	avg: { name: "avg", params: [p("expr", "numeric")] }, // avg aggregate
	min: { name: "min", params: [p("expr")] }, // min aggregate
	max: { name: "max", params: [p("expr")] }, // max aggregate
};

// ---------------------------------------------------------------------------
// T-SQL (SQL Server) — learn.microsoft.com Transact-SQL function reference.
// Cites the docs page per entry. Note DATEADD = (datepart, number, date).
// ---------------------------------------------------------------------------
const TSQL: Record<string, FnSignature> = {
	// date/time — "Date and Time Data Types and Functions"
	dateadd: { name: "DATEADD", params: [p("datepart"), p("number", "int"), p("date", "date")] }, // DATEADD (Transact-SQL)
	datediff: { name: "DATEDIFF", params: [p("datepart"), p("startdate", "date"), p("enddate", "date")] }, // DATEDIFF (Transact-SQL)
	datepart: { name: "DATEPART", params: [p("datepart"), p("date", "date")] }, // DATEPART (Transact-SQL)
	datename: { name: "DATENAME", params: [p("datepart"), p("date", "date")] }, // DATENAME (Transact-SQL)
	datefromparts: { name: "DATEFROMPARTS", params: [p("year", "int"), p("month", "int"), p("day", "int")] }, // DATEFROMPARTS (Transact-SQL)
	eomonth: { name: "EOMONTH", params: [p("start_date", "date"), p("month_to_add", "int")] }, // EOMONTH (Transact-SQL)
	// conversion — "CAST and CONVERT"
	convert: { name: "CONVERT", params: [p("data_type"), p("expression"), p("style", "int")] }, // CONVERT (Transact-SQL)
	cast: { name: "CAST", params: [p("expression"), p("data_type")] }, // CAST (Transact-SQL)
	try_convert: { name: "TRY_CONVERT", params: [p("data_type"), p("expression"), p("style", "int")] }, // TRY_CONVERT (Transact-SQL)
	// string — "String Functions"
	substring: { name: "SUBSTRING", params: [p("expression"), p("start", "int"), p("length", "int")] }, // SUBSTRING (Transact-SQL)
	charindex: {
		name: "CHARINDEX",
		params: [p("expressionToFind"), p("expressionToSearch"), p("start_location", "int")],
	}, // CHARINDEX (Transact-SQL)
	replace: { name: "REPLACE", params: [p("string_expression"), p("string_pattern"), p("string_replacement")] }, // REPLACE (Transact-SQL)
	left: { name: "LEFT", params: [p("character_expression"), p("integer_expression", "int")] }, // LEFT (Transact-SQL)
	right: { name: "RIGHT", params: [p("character_expression"), p("integer_expression", "int")] }, // RIGHT (Transact-SQL)
	concat: { name: "CONCAT", params: [p("string_value")], variadic: true }, // CONCAT (Transact-SQL) (variadic)
	concat_ws: { name: "CONCAT_WS", params: [p("separator"), p("argument")], variadic: true }, // CONCAT_WS (Transact-SQL)
	stuff: {
		name: "STUFF",
		params: [p("character_expression"), p("start", "int"), p("length", "int"), p("replaceWith_expression")],
	}, // STUFF (Transact-SQL)
	trim: { name: "TRIM", params: [p("string")] }, // TRIM (Transact-SQL)
	ltrim: { name: "LTRIM", params: [p("character_expression")] }, // LTRIM (Transact-SQL)
	rtrim: { name: "RTRIM", params: [p("character_expression")] }, // RTRIM (Transact-SQL)
	format: { name: "FORMAT", params: [p("value"), p("format"), p("culture")] }, // FORMAT (Transact-SQL)
	// conditional / null — "Logical Functions" / "NULLIF"
	isnull: { name: "ISNULL", params: [p("check_expression"), p("replacement_value")] }, // ISNULL (Transact-SQL)
	coalesce: { name: "COALESCE", params: [p("expression")], variadic: true }, // COALESCE (Transact-SQL) (variadic)
	nullif: { name: "NULLIF", params: [p("expression1"), p("expression2")] }, // NULLIF (Transact-SQL)
	iif: { name: "IIF", params: [p("boolean_expression", "boolean"), p("true_value"), p("false_value")] }, // IIF (Transact-SQL)
	// numeric — "Mathematical Functions"
	round: { name: "ROUND", params: [p("numeric_expression", "numeric"), p("length", "int"), p("function", "int")] }, // ROUND (Transact-SQL)
	abs: { name: "ABS", params: [p("numeric_expression", "numeric")] }, // ABS (Transact-SQL)
	ceiling: { name: "CEILING", params: [p("numeric_expression", "numeric")] }, // CEILING (Transact-SQL)
	floor: { name: "FLOOR", params: [p("numeric_expression", "numeric")] }, // FLOOR (Transact-SQL)
	power: { name: "POWER", params: [p("float_expression", "float"), p("y")] }, // POWER (Transact-SQL)
	// aggregate — "Aggregate Functions"
	count: { name: "COUNT", params: [p("expression")] }, // COUNT (Transact-SQL)
	sum: { name: "SUM", params: [p("expression", "numeric")] }, // SUM (Transact-SQL)
	avg: { name: "AVG", params: [p("expression", "numeric")] }, // AVG (Transact-SQL)
	min: { name: "MIN", params: [p("expression")] }, // MIN (Transact-SQL)
	max: { name: "MAX", params: [p("expression")] }, // MAX (Transact-SQL)
	string_agg: { name: "STRING_AGG", params: [p("expression"), p("separator")] }, // STRING_AGG (Transact-SQL)
};

// ---------------------------------------------------------------------------
// Snowflake — docs.snowflake.com SQL function reference. Cites the page per
// entry. DATEADD = (date_or_time_part, value, date_or_time_expr).
// ---------------------------------------------------------------------------
const SNOWFLAKE: Record<string, FnSignature> = {
	// date/time
	dateadd: { name: "DATEADD", params: [p("date_or_time_part"), p("value", "integer"), p("date_or_time_expr")] }, // DATEADD
	datediff: { name: "DATEDIFF", params: [p("date_or_time_part"), p("date_or_time_expr1"), p("date_or_time_expr2")] }, // DATEDIFF
	date_part: { name: "DATE_PART", params: [p("date_or_time_part"), p("date_or_time_expr")] }, // DATE_PART
	date_trunc: { name: "DATE_TRUNC", params: [p("date_or_time_part"), p("date_or_time_expr")] }, // DATE_TRUNC
	to_date: { name: "TO_DATE", params: [p("expr"), p("format", "string")] }, // TO_DATE , DATE
	to_timestamp: { name: "TO_TIMESTAMP", params: [p("expr"), p("format", "string")] }, // TO_TIMESTAMP
	timestampadd: {
		name: "TIMESTAMPADD",
		params: [p("date_or_time_part"), p("value", "integer"), p("date_or_time_expr")],
	}, // TIMESTAMPADD
	last_day: { name: "LAST_DAY", params: [p("date_or_time_expr"), p("date_part")] }, // LAST_DAY
	// string
	concat: { name: "CONCAT", params: [p("expr", "string")], variadic: true }, // CONCAT (variadic)
	concat_ws: { name: "CONCAT_WS", params: [p("separator", "string"), p("expr", "string")], variadic: true }, // CONCAT_WS
	substr: { name: "SUBSTR", params: [p("base_expr", "string"), p("start_pos", "integer"), p("length", "integer")] }, // SUBSTR , SUBSTRING
	substring: {
		name: "SUBSTRING",
		params: [p("base_expr", "string"), p("start_pos", "integer"), p("length", "integer")],
	}, // SUBSTRING
	split_part: {
		name: "SPLIT_PART",
		params: [p("string", "string"), p("delimiter", "string"), p("part_number", "integer")],
	}, // SPLIT_PART
	replace: { name: "REPLACE", params: [p("subject", "string"), p("pattern", "string"), p("replacement", "string")] }, // REPLACE
	trim: { name: "TRIM", params: [p("expr", "string"), p("characters", "string")] }, // TRIM
	lpad: { name: "LPAD", params: [p("base", "string"), p("length", "integer"), p("pad", "string")] }, // LPAD
	rpad: { name: "RPAD", params: [p("base", "string"), p("length", "integer"), p("pad", "string")] }, // RPAD
	regexp_replace: {
		name: "REGEXP_REPLACE",
		params: [p("subject", "string"), p("pattern", "string"), p("replacement", "string")],
	}, // REGEXP_REPLACE
	// conditional / null
	coalesce: { name: "COALESCE", params: [p("expr")], variadic: true }, // COALESCE (variadic)
	nvl: { name: "NVL", params: [p("expr1"), p("expr2")] }, // NVL
	ifnull: { name: "IFNULL", params: [p("expr1"), p("expr2")] }, // IFNULL
	nullif: { name: "NULLIF", params: [p("expr1"), p("expr2")] }, // NULLIF
	iff: { name: "IFF", params: [p("condition", "boolean"), p("expr1"), p("expr2")] }, // IFF
	decode: { name: "DECODE", params: [p("expr"), p("search"), p("result")], variadic: true }, // DECODE (variadic search/result)
	// numeric
	round: { name: "ROUND", params: [p("input_expr", "numeric"), p("scale_expr", "integer")] }, // ROUND
	abs: { name: "ABS", params: [p("expr", "numeric")] }, // ABS
	ceil: { name: "CEIL", params: [p("input_expr", "numeric"), p("scale_expr", "integer")] }, // CEIL
	floor: { name: "FLOOR", params: [p("input_expr", "numeric"), p("scale_expr", "integer")] }, // FLOOR
	power: { name: "POWER", params: [p("base", "numeric"), p("exponent", "numeric")] }, // POWER
	mod: { name: "MOD", params: [p("expr1", "numeric"), p("expr2", "numeric")] }, // MOD
	// aggregate
	count: { name: "COUNT", params: [p("expr")] }, // COUNT
	sum: { name: "SUM", params: [p("expr", "numeric")] }, // SUM
	avg: { name: "AVG", params: [p("expr", "numeric")] }, // AVG
	min: { name: "MIN", params: [p("expr")] }, // MIN
	max: { name: "MAX", params: [p("expr")] }, // MAX
	listagg: { name: "LISTAGG", params: [p("expr", "string"), p("delimiter", "string")] }, // LISTAGG
};

// ---------------------------------------------------------------------------
// BigQuery (GoogleSQL) — cloud.google.com/bigquery/docs function reference.
// Cites the page per entry. DATE_ADD = (date, INTERVAL int part) — modelled
// here as (date_expression, interval) since the INTERVAL literal is one arg slot.
// ---------------------------------------------------------------------------
const BIGQUERY: Record<string, FnSignature> = {
	// date/time
	date_add: { name: "DATE_ADD", params: [p("date_expression", "DATE"), p("interval", "INTERVAL")] }, // DATE_ADD
	date_sub: { name: "DATE_SUB", params: [p("date_expression", "DATE"), p("interval", "INTERVAL")] }, // DATE_SUB
	date_diff: { name: "DATE_DIFF", params: [p("end_date", "DATE"), p("start_date", "DATE"), p("granularity")] }, // DATE_DIFF
	date_trunc: { name: "DATE_TRUNC", params: [p("date_expression", "DATE"), p("granularity")] }, // DATE_TRUNC
	timestamp_diff: {
		name: "TIMESTAMP_DIFF",
		params: [p("end_timestamp", "TIMESTAMP"), p("start_timestamp", "TIMESTAMP"), p("granularity")],
	}, // TIMESTAMP_DIFF
	parse_date: { name: "PARSE_DATE", params: [p("format_string", "STRING"), p("date_string", "STRING")] }, // PARSE_DATE
	format_date: { name: "FORMAT_DATE", params: [p("format_string", "STRING"), p("date_expr", "DATE")] }, // FORMAT_DATE
	// string
	concat: { name: "CONCAT", params: [p("value", "STRING")], variadic: true }, // CONCAT (variadic)
	substr: { name: "SUBSTR", params: [p("value", "STRING"), p("position", "INT64"), p("length", "INT64")] }, // SUBSTR
	substring: { name: "SUBSTRING", params: [p("value", "STRING"), p("position", "INT64"), p("length", "INT64")] }, // SUBSTRING
	split: { name: "SPLIT", params: [p("value", "STRING"), p("delimiter", "STRING")] }, // SPLIT
	replace: {
		name: "REPLACE",
		params: [p("original_value", "STRING"), p("from_pattern", "STRING"), p("to_value", "STRING")],
	}, // REPLACE
	trim: { name: "TRIM", params: [p("value", "STRING"), p("chars_to_trim", "STRING")] }, // TRIM
	lpad: {
		name: "LPAD",
		params: [p("original_value", "STRING"), p("return_length", "INT64"), p("pattern", "STRING")],
	}, // LPAD
	rpad: {
		name: "RPAD",
		params: [p("original_value", "STRING"), p("return_length", "INT64"), p("pattern", "STRING")],
	}, // RPAD
	regexp_replace: {
		name: "REGEXP_REPLACE",
		params: [p("value", "STRING"), p("regexp", "STRING"), p("replacement", "STRING")],
	}, // REGEXP_REPLACE
	regexp_extract: { name: "REGEXP_EXTRACT", params: [p("value", "STRING"), p("regexp", "STRING")] }, // REGEXP_EXTRACT
	// conditional / null
	coalesce: { name: "COALESCE", params: [p("expr")], variadic: true }, // COALESCE (variadic)
	ifnull: { name: "IFNULL", params: [p("expr"), p("null_result")] }, // IFNULL
	nullif: { name: "NULLIF", params: [p("expr"), p("expr_to_match")] }, // NULLIF
	if: { name: "IF", params: [p("expr", "BOOL"), p("true_result"), p("else_result")] }, // IF
	safe_cast: { name: "SAFE_CAST", params: [p("expression"), p("typename")] }, // SAFE_CAST
	cast: { name: "CAST", params: [p("expression"), p("typename")] }, // CAST
	// numeric
	round: { name: "ROUND", params: [p("X", "FLOAT64"), p("N", "INT64")] }, // ROUND
	abs: { name: "ABS", params: [p("X", "numeric")] }, // ABS
	ceil: { name: "CEIL", params: [p("X", "FLOAT64")] }, // CEIL
	floor: { name: "FLOOR", params: [p("X", "FLOAT64")] }, // FLOOR
	power: { name: "POWER", params: [p("X", "FLOAT64"), p("Y", "FLOAT64")] }, // POWER
	mod: { name: "MOD", params: [p("X", "INT64"), p("Y", "INT64")] }, // MOD
	// aggregate
	count: { name: "COUNT", params: [p("expression")] }, // COUNT
	sum: { name: "SUM", params: [p("expression", "numeric")] }, // SUM
	avg: { name: "AVG", params: [p("expression", "numeric")] }, // AVG
	min: { name: "MIN", params: [p("expression")] }, // MIN
	max: { name: "MAX", params: [p("expression")] }, // MAX
	array_agg: { name: "ARRAY_AGG", params: [p("expression")] }, // ARRAY_AGG
	string_agg: { name: "STRING_AGG", params: [p("expression", "STRING"), p("delimiter", "STRING")] }, // STRING_AGG
};

// ---------------------------------------------------------------------------
// Redshift — docs.aws.amazon.com/redshift SQL functions reference. Cites the
// page per entry. DATEADD = (datepart, interval, date).
// ---------------------------------------------------------------------------
const REDSHIFT: Record<string, FnSignature> = {
	// date/time
	dateadd: { name: "DATEADD", params: [p("datepart"), p("interval", "integer"), p("date", "date")] }, // DATEADD function
	datediff: { name: "DATEDIFF", params: [p("datepart"), p("startdate", "date"), p("enddate", "date")] }, // DATEDIFF function
	date_part: { name: "DATE_PART", params: [p("datepart"), p("timestamp", "timestamp")] }, // DATE_PART function
	date_trunc: { name: "DATE_TRUNC", params: [p("datepart"), p("timestamp", "timestamp")] }, // DATE_TRUNC function
	to_date: { name: "TO_DATE", params: [p("string", "string"), p("format", "string")] }, // TO_DATE function
	to_timestamp: { name: "TO_TIMESTAMP", params: [p("timestamp", "string"), p("format", "string")] }, // TO_TIMESTAMP function
	// string
	concat: { name: "CONCAT", params: [p("string1", "string"), p("string2", "string")] }, // CONCAT function (binary)
	substring: {
		name: "SUBSTRING",
		params: [p("string", "string"), p("start_position", "integer"), p("number_characters", "integer")],
	}, // SUBSTRING function
	split_part: { name: "SPLIT_PART", params: [p("string", "string"), p("delimiter", "string"), p("part", "integer")] }, // SPLIT_PART function
	replace: { name: "REPLACE", params: [p("string", "string"), p("old_chars", "string"), p("new_chars", "string")] }, // REPLACE function
	trim: { name: "TRIM", params: [p("string", "string")] }, // TRIM function
	lpad: { name: "LPAD", params: [p("string", "string"), p("length", "integer"), p("pad", "string")] }, // LPAD function
	rpad: { name: "RPAD", params: [p("string", "string"), p("length", "integer"), p("pad", "string")] }, // RPAD function
	regexp_replace: {
		name: "REGEXP_REPLACE",
		params: [p("source_string", "string"), p("pattern", "string"), p("replace_string", "string")],
	}, // REGEXP_REPLACE function
	// conditional / null
	coalesce: { name: "COALESCE", params: [p("expression")], variadic: true }, // COALESCE / NVL (variadic)
	nvl: { name: "NVL", params: [p("expression")], variadic: true }, // NVL function (variadic)
	nvl2: { name: "NVL2", params: [p("expression"), p("not_null_return_value"), p("null_return_value")] }, // NVL2 function
	nullif: { name: "NULLIF", params: [p("expression1"), p("expression2")] }, // NULLIF function
	decode: { name: "DECODE", params: [p("expression"), p("search"), p("result")], variadic: true }, // DECODE expression (variadic)
	// numeric
	round: { name: "ROUND", params: [p("number", "numeric"), p("integer", "integer")] }, // ROUND function
	abs: { name: "ABS", params: [p("number", "numeric")] }, // ABS function
	ceiling: { name: "CEILING", params: [p("number", "numeric")] }, // CEILING / CEIL function
	floor: { name: "FLOOR", params: [p("number", "numeric")] }, // FLOOR function
	power: { name: "POWER", params: [p("base", "numeric"), p("exponent", "numeric")] }, // POWER function
	mod: { name: "MOD", params: [p("number1", "numeric"), p("number2", "numeric")] }, // MOD function
	// aggregate
	count: { name: "COUNT", params: [p("expression")] }, // COUNT function
	sum: { name: "SUM", params: [p("expression", "numeric")] }, // SUM function
	avg: { name: "AVG", params: [p("expression", "numeric")] }, // AVG function
	min: { name: "MIN", params: [p("expression")] }, // MIN function
	max: { name: "MAX", params: [p("expression")] }, // MAX function
	listagg: { name: "LISTAGG", params: [p("aggregate_expression", "string"), p("delimiter", "string")] }, // LISTAGG function
};

// ---------------------------------------------------------------------------
// PostgreSQL — postgresql.org/docs/18 function reference; cites the doc page/table per entry.
// ---------------------------------------------------------------------------
const POSTGRES: Record<string, FnSignature> = {
	// date/time — functions-datetime.html (Table 9.33)
	age: { name: "age", params: [p("timestamp", "timestamp"), p("timestamp2", "timestamp")] }, // age(timestamp, timestamp)
	date_trunc: { name: "date_trunc", params: [p("field", "text"), p("source", "timestamp")] }, // date_trunc(field, source)
	date_part: { name: "date_part", params: [p("field", "text"), p("source", "timestamp")] }, // date_part(field, source)
	date_bin: {
		name: "date_bin",
		params: [p("stride", "interval"), p("source", "timestamp"), p("origin", "timestamp")],
	}, // date_bin(stride, source, origin)
	make_date: { name: "make_date", params: [p("year", "int"), p("month", "int"), p("day", "int")] }, // make_date(year, month, day)
	make_interval: {
		name: "make_interval",
		params: [p("years", "int"), p("months", "int"), p("weeks", "int"), p("days", "int")],
	}, // make_interval(years, months, …)
	to_date: { name: "to_date", params: [p("text", "text"), p("format", "text")] }, // to_date(text, format)
	to_timestamp: { name: "to_timestamp", params: [p("text", "text"), p("format", "text")] }, // to_timestamp(text, format)
	to_char: { name: "to_char", params: [p("value"), p("format", "text")] }, // to_char(value, format)
	to_number: { name: "to_number", params: [p("text", "text"), p("format", "text")] }, // to_number(text, format)
	// string — functions-string.html (Table 9.10)
	concat: { name: "concat", params: [p("val")], variadic: true }, // concat(val1, val2, …)
	concat_ws: { name: "concat_ws", params: [p("sep", "text"), p("val")], variadic: true }, // concat_ws(sep, val…)
	substring: { name: "substring", params: [p("string", "text"), p("start", "int"), p("count", "int")] }, // substring(string, start, count)
	substr: { name: "substr", params: [p("string", "text"), p("start", "int"), p("count", "int")] }, // substr(string, start, count)
	split_part: { name: "split_part", params: [p("string", "text"), p("delimiter", "text"), p("n", "int")] }, // split_part(string, delimiter, n)
	replace: { name: "replace", params: [p("string", "text"), p("from", "text"), p("to", "text")] }, // replace(string, from, to)
	regexp_replace: {
		name: "regexp_replace",
		params: [p("string", "text"), p("pattern", "text"), p("replacement", "text"), p("flags", "text")],
	}, // regexp_replace(string, pattern, replacement [, flags])
	regexp_match: { name: "regexp_match", params: [p("string", "text"), p("pattern", "text"), p("flags", "text")] }, // regexp_match(string, pattern [, flags])
	lpad: { name: "lpad", params: [p("string", "text"), p("length", "int"), p("fill", "text")] }, // lpad(string, length, fill)
	rpad: { name: "rpad", params: [p("string", "text"), p("length", "int"), p("fill", "text")] }, // rpad(string, length, fill)
	position: { name: "position", params: [p("substring", "text"), p("string", "text")] }, // position(substring in string)
	strpos: { name: "strpos", params: [p("string", "text"), p("substring", "text")] }, // strpos(string, substring)
	left: { name: "left", params: [p("string", "text"), p("n", "int")] }, // left(string, n)
	right: { name: "right", params: [p("string", "text"), p("n", "int")] }, // right(string, n)
	format: { name: "format", params: [p("formatstr", "text"), p("formatarg")], variadic: true }, // format(formatstr, formatarg…)
	string_to_array: {
		name: "string_to_array",
		params: [p("string", "text"), p("delimiter", "text"), p("null_string", "text")],
	}, // string_to_array(string, delimiter [, null_string])
	// numeric — functions-math.html (Table 9.5)
	round: { name: "round", params: [p("v", "numeric"), p("s", "int")] }, // round(v numeric, s int)
	trunc: { name: "trunc", params: [p("v", "numeric"), p("s", "int")] }, // trunc(v numeric, s int)
	abs: { name: "abs", params: [p("x", "numeric")] }, // abs(x)
	ceil: { name: "ceil", params: [p("x", "numeric")] }, // ceil(x)
	floor: { name: "floor", params: [p("x", "numeric")] }, // floor(x)
	power: { name: "power", params: [p("a", "numeric"), p("b", "numeric")] }, // power(a, b)
	mod: { name: "mod", params: [p("y", "numeric"), p("x", "numeric")] }, // mod(y, x)
	div: { name: "div", params: [p("y", "numeric"), p("x", "numeric")] }, // div(y, x)
	width_bucket: {
		name: "width_bucket",
		params: [p("operand", "numeric"), p("low", "numeric"), p("high", "numeric"), p("count", "int")],
	}, // width_bucket(operand, low, high, count)
	// conditional — functions-conditional.html
	coalesce: { name: "coalesce", params: [p("value")], variadic: true }, // COALESCE(value…)
	nullif: { name: "nullif", params: [p("value1"), p("value2")] }, // NULLIF(value1, value2)
	greatest: { name: "greatest", params: [p("value")], variadic: true }, // GREATEST(value…)
	least: { name: "least", params: [p("value")], variadic: true }, // LEAST(value…)
	// aggregates — functions-aggregate.html (Table 9.62)
	count: { name: "count", params: [p("expression")] }, // count(expression)
	sum: { name: "sum", params: [p("expression", "numeric")] }, // sum(expression)
	avg: { name: "avg", params: [p("expression", "numeric")] }, // avg(expression)
	min: { name: "min", params: [p("expression")] }, // min(expression)
	max: { name: "max", params: [p("expression")] }, // max(expression)
	string_agg: { name: "string_agg", params: [p("value", "text"), p("delimiter", "text")] }, // string_agg(value, delimiter)
	array_agg: { name: "array_agg", params: [p("expression")] }, // array_agg(expression)
	// JSON — functions-json.html
	jsonb_set: {
		name: "jsonb_set",
		params: [p("target", "jsonb"), p("path", "text[]"), p("new_value", "jsonb"), p("create_if_missing", "boolean")],
	}, // jsonb_set(target, path, new_value [, create_if_missing])
	jsonb_extract_path: {
		name: "jsonb_extract_path",
		params: [p("from_json", "jsonb"), p("path_elems", "text")],
		variadic: true,
	}, // jsonb_extract_path(from_json, VARIADIC path_elems)
	json_build_object: { name: "json_build_object", params: [p("arg")], variadic: true }, // json_build_object(VARIADIC args)
};

// ---------------------------------------------------------------------------
// DuckDB — duckdb.org/docs/current/sql/functions reference; cites the page per entry.
// ---------------------------------------------------------------------------
const DUCKDB: Record<string, FnSignature> = {
	// date/time — functions/date.md, timestamp.md
	date_part: { name: "date_part", params: [p("part", "text"), p("date", "date")] }, // date_part(part, date)
	date_diff: { name: "date_diff", params: [p("part", "text"), p("startdate", "date"), p("enddate", "date")] }, // date_diff(part, startdate, enddate)
	date_add: { name: "date_add", params: [p("date", "date"), p("interval", "interval")] }, // date_add(date, interval)
	date_sub: { name: "date_sub", params: [p("part", "text"), p("startdate", "date"), p("enddate", "date")] }, // date_sub(part, startdate, enddate)
	date_trunc: { name: "date_trunc", params: [p("part", "text"), p("date", "date")] }, // date_trunc(part, date)
	strftime: { name: "strftime", params: [p("date", "date"), p("format", "text")] }, // strftime(date, format)
	strptime: { name: "strptime", params: [p("text", "text"), p("format", "text")] }, // strptime(text, format)
	make_date: { name: "make_date", params: [p("year", "bigint"), p("month", "bigint"), p("day", "bigint")] }, // make_date(year, month, day)
	time_bucket: {
		name: "time_bucket",
		params: [p("bucket_width", "interval"), p("timestamp", "timestamp"), p("offset", "interval")],
	}, // time_bucket(bucket_width, timestamp[, offset])
	// text — functions/text.md
	concat: { name: "concat", params: [p("value")], variadic: true }, // concat(value, ...)
	concat_ws: { name: "concat_ws", params: [p("separator", "text"), p("value")], variadic: true }, // concat_ws(separator, value, ...)
	substring: { name: "substring", params: [p("string", "text"), p("start", "int"), p("length", "int")] }, // substring(string, start, length)
	split_part: { name: "split_part", params: [p("string", "text"), p("separator", "text"), p("index", "int")] }, // split_part(string, separator, index)
	replace: { name: "replace", params: [p("string", "text"), p("source", "text"), p("target", "text")] }, // replace(string, source, target)
	regexp_replace: {
		name: "regexp_replace",
		params: [p("string", "text"), p("pattern", "text"), p("replacement", "text"), p("options", "text")],
	}, // regexp_replace(string, pattern, replacement[, options])
	regexp_extract: { name: "regexp_extract", params: [p("string", "text"), p("pattern", "text"), p("group", "int")] }, // regexp_extract(string, pattern[, group])
	regexp_matches: {
		name: "regexp_matches",
		params: [p("string", "text"), p("pattern", "text"), p("options", "text")],
	}, // regexp_matches(string, pattern[, options])
	lpad: { name: "lpad", params: [p("string", "text"), p("count", "int"), p("character", "text")] }, // lpad(string, count, character)
	rpad: { name: "rpad", params: [p("string", "text"), p("count", "int"), p("character", "text")] }, // rpad(string, count, character)
	left: { name: "left", params: [p("string", "text"), p("count", "int")] }, // left(string, count)
	right: { name: "right", params: [p("string", "text"), p("count", "int")] }, // right(string, count)
	contains: { name: "contains", params: [p("string", "text"), p("search_string", "text")] }, // contains(string, search_string)
	starts_with: { name: "starts_with", params: [p("string", "text"), p("search_string", "text")] }, // starts_with(string, search_string)
	printf: { name: "printf", params: [p("format", "text"), p("parameter")], variadic: true }, // printf(format, parameters...)
	format: { name: "format", params: [p("format", "text"), p("parameter")], variadic: true }, // format(format, parameters...)
	// numeric — functions/numeric.md
	round: { name: "round", params: [p("v", "numeric"), p("s", "int")] }, // round(v, s)
	trunc: { name: "trunc", params: [p("x", "numeric")] }, // trunc(x)
	abs: { name: "abs", params: [p("x", "numeric")] }, // abs(x)
	ceil: { name: "ceil", params: [p("x", "numeric")] }, // ceil(x)
	floor: { name: "floor", params: [p("x", "numeric")] }, // floor(x)
	power: { name: "power", params: [p("x", "numeric"), p("y", "numeric")] }, // power(x, y)
	// list — functions/list.md
	list_transform: { name: "list_transform", params: [p("list", "list"), p("lambda")] }, // list_transform(list, lambda)
	list_filter: { name: "list_filter", params: [p("list", "list"), p("lambda")] }, // list_filter(list, lambda)
	list_reduce: { name: "list_reduce", params: [p("list", "list"), p("lambda"), p("initial_value")] }, // list_reduce(list, lambda[, initial_value])
	list_extract: { name: "list_extract", params: [p("list", "list"), p("index", "int")] }, // list_extract(list, index)
	list_contains: { name: "list_contains", params: [p("list", "list"), p("element")] }, // list_contains(list, element)
	array_to_string: { name: "array_to_string", params: [p("list", "list"), p("delimiter", "text")] }, // array_to_string(list, delimiter)
	unnest: { name: "unnest", params: [p("list", "list")] }, // unnest(list)
	// conditional — functions/utility.md
	coalesce: { name: "coalesce", params: [p("expr")], variadic: true }, // coalesce(expr, ...)
	nullif: { name: "nullif", params: [p("a"), p("b")] }, // nullif(a, b)
	ifnull: { name: "ifnull", params: [p("expr"), p("other")] }, // ifnull(expr, other)
	if: { name: "if", params: [p("condition", "boolean"), p("a"), p("b")] }, // if(condition, a, b)
	// aggregates — functions/aggregates.md
	count: { name: "count", params: [p("arg")] }, // count(arg)
	sum: { name: "sum", params: [p("arg", "numeric")] }, // sum(arg)
	avg: { name: "avg", params: [p("arg", "numeric")] }, // avg(arg)
	min: { name: "min", params: [p("arg"), p("n", "int")] }, // min(arg[, n])
	max: { name: "max", params: [p("arg"), p("n", "int")] }, // max(arg[, n])
	arg_max: { name: "arg_max", params: [p("arg"), p("val"), p("n", "int")] }, // arg_max(arg, val[, n])
	arg_min: { name: "arg_min", params: [p("arg"), p("val"), p("n", "int")] }, // arg_min(arg, val[, n])
	string_agg: { name: "string_agg", params: [p("arg", "text"), p("sep", "text")] }, // string_agg(arg, sep)
	quantile_cont: { name: "quantile_cont", params: [p("x", "numeric"), p("pos", "double")] }, // quantile_cont(x, pos)
};

// ---------------------------------------------------------------------------
// Trino — trino.io/docs/current/functions reference; cites the page per entry.
// ---------------------------------------------------------------------------
const TRINO: Record<string, FnSignature> = {
	// date/time — functions/datetime.html
	date_trunc: { name: "date_trunc", params: [p("unit", "varchar"), p("x", "timestamp")] }, // date_trunc(unit, x)
	date_add: { name: "date_add", params: [p("unit", "varchar"), p("value", "bigint"), p("timestamp", "timestamp")] }, // date_add(unit, value, timestamp)
	date_diff: {
		name: "date_diff",
		params: [p("unit", "varchar"), p("timestamp1", "timestamp"), p("timestamp2", "timestamp")],
	}, // date_diff(unit, timestamp1, timestamp2)
	date_format: { name: "date_format", params: [p("timestamp", "timestamp"), p("format", "varchar")] }, // date_format(timestamp, format)
	date_parse: { name: "date_parse", params: [p("string", "varchar"), p("format", "varchar")] }, // date_parse(string, format)
	from_unixtime: { name: "from_unixtime", params: [p("unixtime", "double"), p("zone", "varchar")] }, // from_unixtime(unixtime[, zone])
	at_timezone: { name: "at_timezone", params: [p("timestamp", "timestamp"), p("zone", "varchar")] }, // at_timezone(timestamp, zone)
	// string — functions/string.html
	substr: { name: "substr", params: [p("string", "varchar"), p("start", "bigint"), p("length", "bigint")] }, // substr(string, start[, length])
	split: { name: "split", params: [p("string", "varchar"), p("delimiter", "varchar"), p("limit", "bigint")] }, // split(string, delimiter[, limit])
	split_part: {
		name: "split_part",
		params: [p("string", "varchar"), p("delimiter", "varchar"), p("index", "bigint")],
	}, // split_part(string, delimiter, index)
	strpos: { name: "strpos", params: [p("string", "varchar"), p("substring", "varchar"), p("instance", "bigint")] }, // strpos(string, substring[, instance])
	replace: { name: "replace", params: [p("string", "varchar"), p("search", "varchar"), p("replace", "varchar")] }, // replace(string, search[, replace])
	lpad: { name: "lpad", params: [p("string", "varchar"), p("size", "bigint"), p("padstring", "varchar")] }, // lpad(string, size, padstring)
	rpad: { name: "rpad", params: [p("string", "varchar"), p("size", "bigint"), p("padstring", "varchar")] }, // rpad(string, size, padstring)
	concat_ws: { name: "concat_ws", params: [p("separator", "varchar"), p("strings", "varchar...")] }, // concat_ws(separator, ...)
	format: { name: "format", params: [p("format", "varchar"), p("args", "any...")] }, // format(format, args...)
	// regexp — functions/regexp.html
	regexp_like: { name: "regexp_like", params: [p("string", "varchar"), p("pattern", "varchar")] }, // regexp_like(string, pattern)
	regexp_extract: {
		name: "regexp_extract",
		params: [p("string", "varchar"), p("pattern", "varchar"), p("group", "bigint")],
	}, // regexp_extract(string, pattern[, group])
	regexp_replace: {
		name: "regexp_replace",
		params: [p("string", "varchar"), p("pattern", "varchar"), p("replacement", "varchar")],
	}, // regexp_replace(string, pattern[, replacement])
	// json — functions/json.html
	json_extract: { name: "json_extract", params: [p("json", "json"), p("json_path", "varchar")] }, // json_extract(json, json_path)
	json_extract_scalar: { name: "json_extract_scalar", params: [p("json", "json"), p("json_path", "varchar")] }, // json_extract_scalar(json, json_path)
	json_parse: { name: "json_parse", params: [p("string", "varchar")] }, // json_parse(string)
	// array — functions/array.html
	element_at: { name: "element_at", params: [p("collection", "array|map"), p("key", "any")] }, // element_at(x, key)
	array_join: {
		name: "array_join",
		params: [p("x", "array"), p("delimiter", "varchar"), p("null_replacement", "varchar")],
	}, // array_join(x, delimiter[, null_replacement])
	sequence: { name: "sequence", params: [p("start", "bigint"), p("stop", "bigint"), p("step", "bigint")] }, // sequence(start, stop[, step])
	transform: { name: "transform", params: [p("array", "array"), p("function", "lambda")] }, // transform(array, function) — functions/lambda.html
	reduce: {
		name: "reduce",
		params: [
			p("array", "array"),
			p("initialState", "any"),
			p("inputFunction", "lambda"),
			p("outputFunction", "lambda"),
		],
	}, // reduce(array, s0, in, out)
	// aggregate — functions/aggregate.html
	count: { name: "count", params: [p("x", "any")] }, // count(x)
	sum: { name: "sum", params: [p("x", "numeric")] }, // sum(x)
	avg: { name: "avg", params: [p("x", "numeric")] }, // avg(x)
	min: { name: "min", params: [p("x", "any"), p("n", "bigint")] }, // min(x[, n])
	max: { name: "max", params: [p("x", "any"), p("n", "bigint")] }, // max(x[, n])
	max_by: { name: "max_by", params: [p("x", "any"), p("y", "any"), p("n", "bigint")] }, // max_by(x, y[, n])
	min_by: { name: "min_by", params: [p("x", "any"), p("y", "any"), p("n", "bigint")] }, // min_by(x, y[, n])
	approx_percentile: { name: "approx_percentile", params: [p("x", "numeric"), p("percentile", "double")] }, // approx_percentile(x, percentile)
	approx_distinct: { name: "approx_distinct", params: [p("x", "any"), p("e", "double")] }, // approx_distinct(x[, e])
	listagg: { name: "listagg", params: [p("expression", "varchar"), p("separator", "varchar")] }, // listagg(expr[, sep]) WITHIN GROUP
	// conditional — functions/conditional.html
	coalesce: { name: "coalesce", params: [p("values", "any...")] }, // coalesce(value1, value2, ...)
	nullif: { name: "nullif", params: [p("value1", "any"), p("value2", "any")] }, // nullif(value1, value2)
	if: { name: "if", params: [p("condition", "boolean"), p("true_value", "any"), p("false_value", "any")] }, // if(cond, t[, f])
};

/** Curated parameter signatures, per dialect, keyed by LOWERCASED function name. */
export const FUNCTION_SIGNATURES: Record<Dialect, Record<string, FnSignature>> = {
	databricks: DATABRICKS,
	tsql: TSQL,
	snowflake: SNOWFLAKE,
	bigquery: BIGQUERY,
	redshift: REDSHIFT,
	postgres: POSTGRES,
	duckdb: DUCKDB,
	trino: TRINO,
};

// ---------------------------------------------------------------------------
// Harvested signatures — the LONG-TAIL layer under the curated table. Mined from each dialect's
// reference-doc syntax blocks by tools/harvest-signatures.mjs into src/signature/generated/<dialect>.ts
// (committed, rebuildable, never hand-edited). Only dialects with an offline syntax-block source in
// the corpus repo have a generated table today (T-SQL); the rest map to an empty table and fall
// through to the name-only hint. See the harvester's header for why.
// ---------------------------------------------------------------------------

/** Harvested parameter signatures, per dialect, keyed by LOWERCASED function name. */
export const HARVESTED_SIGNATURES: Record<Dialect, Record<string, FnSignature>> = {
	databricks: {},
	tsql: TSQL_HARVESTED,
	snowflake: {},
	bigquery: {},
	redshift: {},
	postgres: {},
	duckdb: {},
	trino: {},
};

/**
 * The signature for a lowercased function name, honoring lookup order: curated (hand-verified) wins,
 * then harvested (doc-derived long tail), else undefined → the caller degrades to a name-only hint.
 */
export function lookupSignature(dialect: Dialect, lowerName: string): FnSignature | undefined {
	return FUNCTION_SIGNATURES[dialect][lowerName] ?? HARVESTED_SIGNATURES[dialect][lowerName];
}

/** Whether either signature layer knows this lowercased name (membership check for functionName()). */
export function hasSignature(dialect: Dialect, lowerName: string): boolean {
	return lowerName in FUNCTION_SIGNATURES[dialect] || lowerName in HARVESTED_SIGNATURES[dialect];
}
