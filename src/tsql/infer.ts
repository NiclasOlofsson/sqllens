import { commonType } from "../infer/coerce.js";
import {
	B,
	BIG,
	BIN,
	D,
	DATE,
	I,
	S,
	TS,
	common,
	dateArg,
	fixed,
	firstArg,
	group,
	type FnRule,
} from "../infer/functions.js";
import { parseType, scalar, TSQL_ALIASES, UNKNOWN, type Type } from "../infer/types.js";
import type { Expr } from "../ir/ir.js";
import { fold } from "./fold.js";

/** T-SQL SUM/AVG return type (per the MS reference): tinyint/smallint promote to int; int/bigint/
 *  decimal/float keep their (canonical) type. Unlike Spark, SUM(int) is int, not bigint. */
const tsqlNumericAgg: FnRule = (args) => {
	const t = args[0];
	if (t?.kind !== "scalar") return UNKNOWN;
	return t.name === "tinyint" || t.name === "smallint" ? I : t;
};

// Function return-type registry for T-SQL (Transact-SQL), from Microsoft's built-in function
// reference (verified against MS Learn). Same discipline as the Spark registry: a missing rule
// yields `unknown`, never a wrong type. Where T-SQL and Spark share a name but differ in meaning,
// the T-SQL rule wins here (e.g. `count` is int, not bigint; `sum(int)` is int, not bigint;
// `isnull(check, repl)` returns check's type, not a boolean predicate). CAST/CONVERT/TRY_CAST/PARSE
// lower to cast nodes, not functions, so they aren't here.
export const TSQL_FUNCTION_RETURNS: Record<string, FnRule> = {
	// string → string
	...group(fixed(S), [
		"left",
		"right",
		"substring",
		"upper",
		"lower",
		"ltrim",
		"rtrim",
		"trim",
		"replace",
		"replicate",
		"reverse",
		"stuff",
		"concat",
		"concat_ws",
		"format",
		"str",
		"quotename",
		"space",
		"soundex",
		"translate",
		"string_escape",
		"nchar",
		"char",
		"parsename",
		"string_agg",
		"json_value",
		"json_query",
		"json_modify",
	]),
	// string → int
	...group(fixed(I), ["len", "datalength", "charindex", "patindex", "ascii", "unicode", "difference"]),
	// date/time → datetime (canonical timestamp)
	...group(fixed(TS), [
		"getdate",
		"getutcdate",
		"sysdatetime",
		"sysutcdatetime",
		"sysdatetimeoffset",
		"current_timestamp",
		"eomonth",
		"switchoffset",
		"todatetimeoffset",
		"datetimefromparts",
		"datetime2fromparts",
		"smalldatetimefromparts",
	]),
	datefromparts: fixed(DATE),
	timefromparts: fixed(scalar("time")),
	// date → int / bigint / string
	...group(fixed(I), ["datediff", "datepart", "year", "month", "day"]),
	datediff_big: fixed(BIG),
	datename: fixed(S),
	// DATEADD keeps the date argument's type (datetime by default)
	dateadd: dateArg,
	// predicates that return int 0/1
	...group(fixed(I), [
		"isdate",
		"isnumeric",
		"isjson",
		"checksum",
		"binary_checksum",
		"object_id",
		"grouping",
		"grouping_id",
	]),
	// numeric → same type as input (MS: ABS, CEILING, FLOOR, ROUND, SIGN, POWER, DEGREES, RADIANS)
	...group(firstArg, ["abs", "ceiling", "floor", "round", "sign", "power", "degrees", "radians"]),
	// numeric → float (MS: EXP, LOG, LOG10, SQUARE, SQRT and the trig fns cast to float → canonical double)
	...group(fixed(D), [
		"sqrt",
		"square",
		"exp",
		"log",
		"log10",
		"sin",
		"cos",
		"tan",
		"atn2",
		"acos",
		"asin",
		"atan",
		"cot",
		"pi",
		"rand",
	]),
	// aggregates — COUNT is int (COUNT_BIG bigint); SUM/AVG promote small ints to int; MIN/MAX keep type
	count: fixed(I),
	count_big: fixed(BIG),
	sum: tsqlNumericAgg,
	avg: tsqlNumericAgg,
	...group(firstArg, ["min", "max"]),
	...group(fixed(D), ["stdev", "stdevp", "var", "varp"]),
	// window/ranking — ROW_NUMBER/RANK/DENSE_RANK/NTILE → bigint; PERCENT_RANK/CUME_DIST → float;
	// the value-returning analytics keep their argument's type
	...group(fixed(BIG), ["row_number", "rank", "dense_rank", "ntile"]),
	...group(fixed(D), ["percent_rank", "cume_dist"]),
	...group(firstArg, ["lag", "lead", "first_value", "last_value"]),
	// null / choice — ISNULL/NULLIF return the first argument's type; COALESCE/IIF/CHOOSE a common type
	isnull: firstArg,
	nullif: firstArg,
	...group(common, ["coalesce"]),
	iif: (args) => commonType(args.slice(-2)),
	choose: (args) => commonType(args.slice(1)),
	// logical / choice (SQL Server 2022+)
	...group(common, ["greatest", "least"]),
	// window/analytic value functions keep the argument's type; PERCENTILE_CONT → float
	...group(firstArg, ["first_value", "last_value"]),
	percentile_cont: fixed(D),
	// JSON builders → string; JSON_PATH_EXISTS → int (bit)
	...group(fixed(S), ["json_object", "json_array"]),
	json_path_exists: fixed(I),
	// date/time helpers — DATETRUNC/DATE_BUCKET keep the date argument's type
	...group(dateArg, ["datetrunc", "date_bucket"]),
	datetimeoffsetfromparts: fixed(TS),
	...group(fixed(S), ["current_timezone", "current_timezone_id"]),
	// string-returning system / user / metadata-name functions
	...group(fixed(S), [
		"formatmessage",
		"system_user",
		"session_user",
		"current_user",
		"user_name",
		"suser_name",
		"suser_sname",
		"host_name",
		"host_id",
		"app_name",
		"original_login",
		"error_message",
		"error_procedure",
		"db_name",
		"object_name",
		"object_schema_name",
		"schema_name",
		"col_name",
	]),
	// int-returning error / metadata-id / property functions
	...group(fixed(I), [
		"error_number",
		"error_severity",
		"error_state",
		"error_line",
		"db_id",
		"schema_id",
		"col_length",
		"columnproperty",
		"objectproperty",
		"objectpropertyex",
		"type_id",
		"xact_state",
		"checksum_agg",
	]),
	approx_count_distinct: fixed(BIG),
	rowcount_big: fixed(BIG),
	current_transaction_id: fixed(BIG),
	// binary-returning compression / context functions
	...group(fixed(BIN), ["compress", "decompress", "context_info"]),
	// system / metadata
	newid: fixed(S),
	newsequentialid: fixed(S),
	hashbytes: fixed(BIN),
	...group(fixed(scalar("decimal")), ["scope_identity", "ident_current"]),

	// ------------------------------------------------------------------
	// Entries below: return types fetched from MS Learn 2026-06-10
	// (per-function "Return types" sections, ver17 — the regex / fuzzy /
	// vector / JSON-agg families are SQL Server 2025+). Functions whose
	// documented type depends on an argument value or is a bare
	// sql_variant stay absent → unknown.
	// ------------------------------------------------------------------

	// bit manipulation (SQL Server 2022): shifts/set keep the input's type
	bit_count: fixed(BIG),
	get_bit: fixed(B),
	...group(firstArg, ["left_shift", "right_shift", "set_bit"]),

	// aggregates / analytic
	any_value: firstArg,
	approx_percentile_cont: fixed(D), // float(53)

	// regex (2025; REGEXP_LIKE is documented as boolean-valued)
	regexp_like: fixed(B),
	regexp_count: fixed(I),
	regexp_instr: fixed(I), // doc states "Integer."
	...group(fixed(S), ["regexp_replace", "regexp_substr"]),

	// fuzzy string match (2025)
	...group(fixed(I), ["edit_distance", "edit_distance_similarity", "jaro_winkler_similarity"]),
	jaro_winkler_distance: fixed(D), // float

	// JSON (2025): aggregates are nvarchar(max); JSON_CONTAINS is int (0/1/NULL), not bit
	...group(fixed(S), ["json_arrayagg", "json_objectagg"]),
	json_contains: fixed(I),

	// encoding (2025)
	base64_encode: fixed(S),
	base64_decode: fixed(BIN),

	// vectors (2025)
	...group(fixed(D), ["vector_distance", "vector_norm"]),
	vector_normalize: fixed(scalar("vector")),

	// metadata / system. object_definition is nvarchar(max); original_db_name and
	// trigger_nestlevel state no type on their pages — a name and a count, typed as such.
	...group(fixed(S), ["type_name", "object_definition", "original_db_name"]),
	...group(fixed(I), [
		"has_dbaccess",
		"is_rolemember",
		"is_srvrolemember",
		"suser_id",
		"user_id",
		"database_principal_id",
		"textvalid",
		"trigger_nestlevel",
	]),
	...group(fixed(scalar("decimal")), ["ident_incr", "ident_seed"]),
	cursor_status: fixed(scalar("smallint")),
	...group(fixed(BIN), [
		"suser_sid",
		"textptr",
		"columns_updated",
		"encryptbypassphrase",
		"decryptbypassphrase",
		"encryptbykey",
		"decryptbykey",
		"crypt_gen_random",
	]),
	eventdata: fixed(scalar("xml")),
};

/** T-SQL pre-registry inference hook — the XML data type methods, which `lowerUdtElem` lowers to
 *  `function` nodes with the receiver as arg 0. `value(xpath, 'sqltype')` is typed by its literal
 *  sqltype argument (never-wrong: no XML shredding — the declared sqltype is the value's runtime
 *  type; a non-literal sqltype falls through to unknown); `exist()` → boolean (bit); `query()` → xml.
 *  https://learn.microsoft.com/en-us/sql/t-sql/xml/xml-data-type-methods */
export function tsqlSpecial(fn: Extract<Expr, { kind: "function" }>): Type | undefined {
	if (fn.qualifier !== undefined) return undefined;
	switch (fn.name.toLowerCase()) {
		case "value": {
			// args = [receiver, xpath, sqltype]; the second method argument (arg 2) is the declared type.
			const sqltype = fn.args[2];
			return sqltype?.kind === "literal" ? parseType(unquoteLiteral(sqltype.text), TSQL_ALIASES) : undefined;
		}
		case "exist":
			return scalar("boolean"); // .exist() returns bit
		case "query":
			return scalar("xml"); // .query() returns xml
		default:
			return undefined;
	}
}

/** Strip a surrounding SQL string-literal quote (`'varchar(100)'` → `varchar(100)`). */
function unquoteLiteral(text: string): string {
	const t = text.trim();
	return t.length >= 2 && t.startsWith("'") && t.endsWith("'") ? t.slice(1, -1) : t;
}

/** T-SQL literal forms: `'str'` / `N'unicode'` → string, `0x…` → binary, `1` → int, `1.5` → decimal
 *  (numeric), `1e3` → float. */
export function tsqlLiteral(text: string): Type {
	const t = text.trim();
	if (/^n?['"]/i.test(t)) return scalar("string");
	if (/^0x/i.test(t)) return scalar("binary");
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^[+-]?\d+$/.test(t)) return scalar("int");
	if (/^[+-]?(\d+\.?\d*|\.\d+)e[+-]?\d+$/i.test(t)) return scalar("float");
	if (/^[+-]?(\d+\.\d*|\.\d+)$/.test(t)) return scalar("decimal");
	return UNKNOWN;
}

export function tsqlParseType(text: string): Type {
	return parseType(text, TSQL_ALIASES, fold);
}
