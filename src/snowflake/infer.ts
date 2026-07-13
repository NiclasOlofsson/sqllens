import { commonType, widenSum } from "../infer/coerce.js";
import type { Expr } from "../ir/ir.js";
import type { FnRule } from "../infer/functions.js";
import { parseType, scalar, UNKNOWN, type Type } from "../infer/types.js";
import { fold } from "./fold.js";

// Snowflake inference knowledge — function return types, literal forms, and scalar-type
// aliases — from the SQL function reference (docs.snowflake.com/en/sql-reference/functions).
// Same contract as the other dialects: a rule is absent (→ unknown) only when the documented
// return type is argument-value-dependent (DECODE, GET on heterogeneous data, …). We never
// guess: a missing rule yields `unknown`, never a wrong type.

const S = scalar("string");
const I = scalar("int");
const BIG = scalar("bigint");
const DEC = scalar("decimal");
const D = scalar("double");
const B = scalar("boolean");
const DATE = scalar("date");
const TIME = scalar("time");
const TS = scalar("timestamp");
const BIN = scalar("binary");
const VARIANT = scalar("variant");
const OBJECT = scalar("object");
const GEOGRAPHY = scalar("geography");
const GEOMETRY = scalar("geometry");

const fixed =
	(t: Type): FnRule =>
	() =>
		t;
const firstArg: FnRule = (args) => args[0] ?? UNKNOWN; // "same type as input"
const lastArg: FnRule = (args) => args[args.length - 1] ?? UNKNOWN;
const common: FnRule = (args) => commonType(args);
const restCommon: FnRule = (args) => commonType(args.slice(1)); // iff(cond,a,b) / nvl2(x,a,b)
const arrayOfFirst: FnRule = (args) => ({ kind: "array", element: args[0] ?? UNKNOWN });
/** avg/median: double for approximate input, decimal (NUMBER) for fixed-point. */
const avgRule: FnRule = (args) =>
	args[0]?.kind === "scalar" && (args[0].name === "double" || args[0].name === "float") ? D : DEC;
/** dateadd(part, n, <date|time|timestamp>) → the date/time argument's type. */
const dateArg: FnRule = (args) => {
	const last = args[args.length - 1];
	return last?.kind === "scalar" && ["date", "time", "timestamp"].includes(last.name) ? last : TS;
};

function group(rule: FnRule, names: string[]): Record<string, FnRule> {
	return Object.fromEntries(names.map((n) => [n, rule]));
}

export const SNOWFLAKE_FUNCTION_RETURNS: Record<string, FnRule> = {
	// --- string & binary ------------------------------------------------------
	...group(fixed(S), [
		"chr",
		"char",
		"collation",
		"concat_ws",
		"dayname",
		"get_ddl",
		"hex_encode",
		"initcap",
		"insert",
		"json_extract_path_text",
		"last_query_id",
		"listagg",
		"lower",
		"lpad",
		"ltrim",
		"md5",
		"md5_hex",
		"monthname",
		"randstr",
		"regexp_replace",
		"regexp_substr",
		"repeat",
		"replace",
		"reverse",
		"rpad",
		"rtrim",
		"sha1",
		"sha1_hex",
		"sha2",
		"sha2_hex",
		"soundex",
		"soundex_p123",
		"space",
		"split_part",
		"strtok",
		"to_char",
		"to_varchar",
		"to_json",
		"translate",
		"trim",
		"typeof",
		"upper",
		"uuid_string",
		"base64_encode",
		"base64_decode_string",
		"try_base64_decode_string",
		"hex_decode_string",
		"try_hex_decode_string",
		"check_json",
		"check_xml",
		"dayname",
		"normalize",
	]),
	concat: (args) => (args[0]?.kind === "array" ? args[0] : (args[0] ?? S)), // strings, binary, or arrays
	substr: fixed(S),
	substring: fixed(S),
	left: fixed(S),
	right: fixed(S),
	...group(fixed(BIN), [
		"md5_binary",
		"sha1_binary",
		"sha2_binary",
		"base64_decode_binary",
		"try_base64_decode_binary",
		"hex_decode_binary",
		"try_hex_decode_binary",
		"to_binary",
		"try_to_binary",
		"compress",
		"decompress_binary",
	]),
	decompress_string: fixed(S),

	// --- numbers from strings/positions ---------------------------------------
	...group(fixed(I), [
		"ascii",
		"bit_length",
		"char_length",
		"character_length",
		"charindex",
		"editdistance",
		"len",
		"length",
		"octet_length",
		"position",
		"regexp_count",
		"regexp_instr",
		"unicode",
		"width_bucket",
		"jarowinkler_similarity",
	]),
	...group(fixed(BIG), [
		"hash",
		"md5_number_lower64",
		"md5_number_upper64",
		"seq1",
		"seq2",
		"seq4",
		"seq8",
		"random",
	]),

	// --- numeric ----------------------------------------------------------------
	...group(firstArg, [
		"abs",
		"ceil",
		"floor",
		"round",
		"trunc",
		"truncate",
		"sign",
		"bitnot",
		"bitand",
		"bitor",
		"bitxor",
	]),
	mod: common,
	...group(fixed(D), [
		"acos",
		"acosh",
		"asin",
		"asinh",
		"atan",
		"atan2",
		"atanh",
		"cbrt",
		"cos",
		"cosh",
		"cot",
		"degrees",
		"exp",
		"ln",
		"log",
		"pi",
		"pow",
		"power",
		"radians",
		"sin",
		"sinh",
		"sqrt",
		"square",
		"tan",
		"tanh",
		"months_between",
	]),
	factorial: fixed(BIG),
	bitshiftleft: firstArg,
	bitshiftright: firstArg,
	div0: common,
	div0null: common,

	// --- boolean -----------------------------------------------------------------
	...group(fixed(B), [
		"booland",
		"boolnot",
		"boolor",
		"boolxor",
		"contains",
		"endswith",
		"equal_null",
		"ilike",
		"like",
		"regexp_like",
		"rlike",
		"search",
		"startswith",
		"is_array",
		"is_binary",
		"is_boolean",
		"is_char",
		"is_varchar",
		"is_date",
		"is_date_value",
		"is_decimal",
		"is_double",
		"is_real",
		"is_integer",
		"is_null_value",
		"is_object",
		"is_time",
		"is_timestamp_ltz",
		"is_timestamp_ntz",
		"is_timestamp_tz",
		"arrays_overlap",
		"array_contains",
	]),

	// --- conditional --------------------------------------------------------------
	iff: restCommon,
	ifnull: common,
	nvl: common,
	nvl2: restCommon,
	coalesce: common,
	nullif: firstArg,
	nullifzero: firstArg,
	zeroifnull: firstArg,
	greatest: common,
	least: common,
	greatest_ignore_nulls: common,
	least_ignore_nulls: common,

	// --- date & time -----------------------------------------------------------------
	...group(fixed(TS), [
		"current_timestamp",
		"localtimestamp",
		"systimestamp",
		"getdate",
		"sysdate",
		"convert_timezone",
		"to_timestamp",
		"to_timestamp_ltz",
		"to_timestamp_ntz",
		"to_timestamp_tz",
		"try_to_timestamp",
		"try_to_timestamp_ltz",
		"try_to_timestamp_ntz",
		"try_to_timestamp_tz",
		"timestamp_from_parts",
		"timestamp_ltz_from_parts",
		"timestamp_ntz_from_parts",
		"timestamp_tz_from_parts",
	]),
	...group(fixed(DATE), [
		"current_date",
		"to_date",
		"try_to_date",
		"date_from_parts",
		"last_day",
		"next_day",
		"previous_day",
	]),
	...group(fixed(TIME), ["current_time", "localtime", "to_time", "try_to_time", "time_from_parts"]),
	...group(fixed(I), [
		"datediff",
		"timediff",
		"timestampdiff",
		"year",
		"yearofweek",
		"yearofweekiso",
		"quarter",
		"month",
		"week",
		"weekofyear",
		"weekiso",
		"day",
		"dayofmonth",
		"dayofweek",
		"dayofweekiso",
		"dayofyear",
		"hour",
		"minute",
		"second",
		"date_part",
		"extract",
	]),
	dateadd: dateArg,
	timeadd: dateArg,
	timestampadd: dateArg,
	date_trunc: lastArg,
	add_months: firstArg,
	epoch_second: fixed(BIG),
	epoch_millisecond: fixed(BIG),
	epoch_microsecond: fixed(BIG),
	epoch_nanosecond: fixed(BIG),

	// --- conversion ----------------------------------------------------------------------
	...group(fixed(DEC), [
		"to_number",
		"to_numeric",
		"to_decimal",
		"try_to_number",
		"try_to_numeric",
		"try_to_decimal",
	]),
	to_double: fixed(D),
	try_to_double: fixed(D),
	to_boolean: fixed(B),
	try_to_boolean: fixed(B),
	cast: lastArg, // typed by the cast node itself; present for the function-call spelling
	to_variant: fixed(VARIANT),
	to_object: fixed(OBJECT),
	to_array: arrayOfFirst,
	to_geography: fixed(GEOGRAPHY),
	try_to_geography: fixed(GEOGRAPHY),
	to_geometry: fixed(GEOMETRY),
	try_to_geometry: fixed(GEOMETRY),

	// --- semi-structured --------------------------------------------------------------------
	...group(fixed(VARIANT), [
		"parse_json",
		"try_parse_json",
		"parse_xml",
		"get",
		"get_ignore_case",
		"get_path",
		"xmlget",
		"array_max",
		"array_min",
		"object_pick",
	]),
	...group(fixed(OBJECT), [
		"object_construct",
		"object_construct_keep_null",
		"object_insert",
		"object_delete",
		"object_agg",
	]),
	object_keys: fixed({ kind: "array", element: S }),
	strtok_to_array: fixed({ kind: "array", element: S }),
	split: fixed({ kind: "array", element: S }),
	...group(
		(args) => (args[0]?.kind === "array" ? args[0] : { kind: "array", element: UNKNOWN }),
		[
			"array_append",
			"array_cat",
			"array_compact",
			"array_distinct",
			"array_flatten",
			"array_prepend",
			"array_remove",
			"array_remove_at",
			"array_slice",
			"array_sort",
			"array_reverse",
			"array_insert",
			"array_except",
			"array_intersection",
		],
	),
	array_construct: fixed({ kind: "array", element: UNKNOWN }),
	array_construct_compact: fixed({ kind: "array", element: UNKNOWN }),
	array_generate_range: fixed({ kind: "array", element: I }),
	array_position: fixed(I),
	array_size: fixed(I),
	array_to_string: fixed(S),
	arrays_to_object: fixed(OBJECT),
	arrays_zip: fixed({ kind: "array", element: OBJECT }),
	as_array: fixed({ kind: "array", element: UNKNOWN }),
	as_binary: fixed(BIN),
	as_boolean: fixed(B),
	as_char: fixed(S),
	as_varchar: fixed(S),
	as_date: fixed(DATE),
	as_decimal: fixed(DEC),
	as_number: fixed(DEC),
	as_double: fixed(D),
	as_real: fixed(D),
	as_integer: fixed(I),
	as_object: fixed(OBJECT),
	as_time: fixed(TIME),
	as_timestamp_ltz: fixed(TS),
	as_timestamp_ntz: fixed(TS),
	as_timestamp_tz: fixed(TS),

	// --- aggregates --------------------------------------------------------------------------
	sum: (args) => widenSum(args[0] ?? UNKNOWN),
	count: fixed(BIG),
	count_if: fixed(BIG),
	avg: avgRule,
	median: avgRule,
	min: firstArg,
	max: firstArg,
	min_by: restCommon,
	max_by: restCommon,
	mode: firstArg,
	any_value: firstArg,
	array_agg: arrayOfFirst,
	arrayagg: arrayOfFirst,
	...group(fixed(D), [
		"stddev",
		"stddev_pop",
		"stddev_samp",
		"variance",
		"variance_pop",
		"variance_samp",
		"var_pop",
		"var_samp",
		"corr",
		"covar_pop",
		"covar_samp",
		"kurtosis",
		"skew",
		"approx_percentile",
		"percentile_cont",
		"regr_avgx",
		"regr_avgy",
		"regr_intercept",
		"regr_r2",
		"regr_slope",
		"regr_sxx",
		"regr_sxy",
		"regr_syy",
	]),
	percentile_disc: lastArg, // returns an actual value of the measured column
	regr_count: fixed(BIG),
	approx_count_distinct: fixed(BIG),
	hll: fixed(BIG),
	grouping: fixed(I),
	grouping_id: fixed(I),
	bitand_agg: firstArg,
	bitor_agg: firstArg,
	bitxor_agg: firstArg,
	booland_agg: fixed(B),
	boolor_agg: fixed(B),
	boolxor_agg: fixed(B),

	// --- window -----------------------------------------------------------------------------------
	row_number: fixed(I),
	rank: fixed(I),
	dense_rank: fixed(I),
	ntile: fixed(I),
	percent_rank: fixed(D),
	cume_dist: fixed(D),
	lead: firstArg,
	lag: firstArg,
	first_value: firstArg,
	last_value: firstArg,
	nth_value: firstArg,
	ratio_to_report: fixed(D),
	conditional_change_event: fixed(BIG),
	conditional_true_event: fixed(BIG),

	// --- context ------------------------------------------------------------------------------------
	...group(fixed(S), [
		"current_account",
		"current_account_name",
		"current_client",
		"current_database",
		"current_ip_address",
		"current_organization_name",
		"current_region",
		"current_role",
		"current_schema",
		"current_session",
		"current_statement",
		"current_user",
		"current_version",
		"current_warehouse",
		"invoker_role",
		"invoker_share",
	]),
	current_transaction: fixed(S),

	// --- geospatial (the documented-fixed-return subset) ----------------------------------------------
	...group(fixed(D), [
		"st_area",
		"st_azimuth",
		"st_distance",
		"st_hausdorffdistance",
		"st_length",
		"st_perimeter",
		"st_x",
		"st_xmax",
		"st_xmin",
		"st_y",
		"st_ymax",
		"st_ymin",
		"haversine",
	]),
	...group(fixed(B), [
		"st_contains",
		"st_coveredby",
		"st_covers",
		"st_disjoint",
		"st_dwithin",
		"st_intersects",
		"st_isvalid",
		"st_within",
	]),
	...group(fixed(I), ["st_dimension", "st_npoints", "st_numpoints", "st_srid", "st_geohash"]),
	...group(fixed(S), ["st_aswkt", "st_asewkt", "st_astext"]),
	st_aswkb: fixed(BIN),
	st_asewkb: fixed(BIN),
	st_asgeojson: fixed(OBJECT),
	...group(fixed(GEOGRAPHY), ["st_makepoint", "st_point", "st_makeline", "st_collect", "st_union", "st_simplify"]),
};

/** Snowflake literal forms: '…' / $$…$$ → string; integers are NUMBER(38,0) (int
 *  canonically); non-integers are NUMBER (decimal); 1e3 is approximate (double). */
export function snowflakeLiteral(text: string): Type {
	const t = text.trim();
	if (/^['$]/.test(t) && /^(\$\$|')/.test(t)) return S;
	if (/^(true|false)$/i.test(t)) return B;
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^date\s*'/i.test(t)) return DATE;
	if (/^time\s*'/i.test(t)) return TIME;
	if (/^timestamp(_ltz|_ntz|_tz)?\s*'/i.test(t)) return TS;
	if (/^interval\b/i.test(t)) return scalar("interval");
	if (/^[+-]?\d+$/.test(t)) return I;
	if (/^[+-]?(\d+\.?\d*|\.\d+)e[+-]?\d+$/i.test(t)) return D;
	if (/^[+-]?(\d+\.\d*|\.\d+)$/.test(t)) return DEC;
	return UNKNOWN;
}

/** Snowflake scalar type names → the shared canonical names. All Snowflake integer
 *  types are NUMBER(38,0) synonyms; FLOAT/FLOAT4/FLOAT8/REAL are all double-precision.
 *  docs.snowflake.com/en/sql-reference/intro-summary-data-types */
export const SNOWFLAKE_ALIASES: Record<string, string> = {
	number: "decimal",
	numeric: "decimal",
	dec: "decimal",
	integer: "int",
	byteint: "int",
	float: "double",
	float4: "double",
	float8: "double",
	real: "double",
	"double precision": "double",
	varchar: "string",
	char: "string",
	character: "string",
	nchar: "string",
	nvarchar: "string",
	nvarchar2: "string",
	"char varying": "string",
	"nchar varying": "string",
	text: "string",
	varbinary: "binary",
	datetime: "timestamp",
	timestamp_ltz: "timestamp",
	timestamp_ntz: "timestamp",
	timestamp_tz: "timestamp",
	bool: "boolean",
};

export function snowflakeParseType(text: string): Type {
	return parseType(text, SNOWFLAKE_ALIASES, fold);
}

/** Pre-registry hook for calls a plain FnRule can't key. `<seq>.NEXTVAL` carries the sequence as a
 *  (variable) qualifier, so no registry key can enumerate it; NEXTVAL always returns NUMBER(38,0)
 *  regardless of the sequence, so match by name here. docs.snowflake.com/en/sql-reference/functions/nextval */
export function snowflakeSpecial(fn: Extract<Expr, { kind: "function" }>): Type | undefined {
	if (fn.name.toLowerCase() === "nextval") return DEC; // NUMBER → decimal
	return undefined;
}
