import { parseType, scalar, UNKNOWN, type Type } from "../infer/types.js";
import type { FnRule } from "../infer/functions.js";
import { commonType, widenSum } from "../infer/coerce.js";
import { fold } from "./fold.js";

// ---------------------------------------------------------------------------
// Redshift (Postgres-derived) inference knowledge. Scalar-name aliases map the
// Postgres/Redshift type vocabulary onto the shared canonical names; division
// truncates integers (verified: AWS r_numeric_computations201). The function
// registry is a doc-cited starter — a missing entry safely yields `unknown`
// (the inference contract), and it grows over time like the other dialects'.
// ---------------------------------------------------------------------------

export const REDSHIFT_ALIASES: Record<string, string> = {
	int2: "smallint",
	int4: "int",
	integer: "int",
	int8: "bigint",
	numeric: "decimal",
	dec: "decimal",
	float4: "float",
	real: "float",
	float8: "double",
	float: "double", // bare FLOAT is double precision in Redshift
	"double precision": "double",
	bool: "boolean",
	char: "string",
	character: "string",
	bpchar: "string",
	nchar: "string",
	varchar: "string",
	"character varying": "string",
	nvarchar: "string",
	text: "string",
	timestamptz: "timestamp",
	"timestamp without time zone": "timestamp",
	"timestamp with time zone": "timestamp",
	timetz: "time",
	varbyte: "binary",
	varbinary: "binary",
};

export function redshiftParseType(text: string): Type {
	return parseType(text, REDSHIFT_ALIASES, fold);
}

const BOOLEAN = scalar("boolean");

/** Redshift literal forms. Numeric rules per the AWS SQL reference "Numeric literals"
 *  (r_numeric_literals671): no decimal point or exponent → integer; a decimal point → DECIMAL;
 *  an exponent → FLOAT8. Double quotes delimit identifiers (Postgres), NOT strings. */
export function redshiftLiteral(text: string): Type {
	const t = text.trim();
	if (/^'/.test(t)) return scalar("string");
	if (/^(true|false)$/i.test(t)) return BOOLEAN;
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^date\s*'/i.test(t)) return scalar("date");
	if (/^time\s*'/i.test(t)) return scalar("time");
	if (/^timestamp\s*'/i.test(t)) return scalar("timestamp");
	if (/^interval\b/i.test(t)) return scalar("interval");
	if (/^[+-]?\d+$/.test(t)) return scalar("int");
	if (/^[+-]?(\d+\.?\d*|\.\d+)e[+-]?\d+$/i.test(t)) return scalar("double");
	if (/^[+-]?(\d+\.\d*|\.\d+)$/.test(t)) return scalar("decimal");
	return UNKNOWN;
}

const S = scalar("string");
const I = scalar("int");
const BIG = scalar("bigint");
const D = scalar("double");
const DEC = scalar("decimal");
const B = scalar("boolean");
const DATE = scalar("date");
const TS = scalar("timestamp");
const BIN = scalar("binary");
const SUPER = scalar("super");
const GEOM = scalar("geometry");
const GEOG = scalar("geography");

const fixed =
	(t: Type): FnRule =>
	() =>
		t;
const firstArg: FnRule = (args) => args[0] ?? UNKNOWN;
const common: FnRule = (args) => commonType(args);
const restCommon: FnRule = (args) => commonType(args.slice(1)); // nvl2(x, a, b) → common(a, b)

function group(rule: FnRule, names: string[]): Record<string, FnRule> {
	return Object.fromEntries(names.map((n) => [n, rule]));
}

/** DECODE(expr, search, result [, search, result]… [, default]) → the common type of the
 *  RESULT arguments (and the trailing default when present), never the search arguments. */
const decodeRule: FnRule = (args) => {
	const results: Type[] = [];
	for (let i = 2; i < args.length; i += 2) results.push(args[i]);
	if (args.length >= 4 && args.length % 2 === 0) results.push(args[args.length - 1]);
	return commonType(results);
};
/** DATEADD → TIMESTAMP for date/timestamp input; TIME/TIMETZ input keeps its type
 *  (AWS r_DATEADD_function: "TIMESTAMP or TIME or TIMETZ depending on the input data type"). */
const dateaddRule: FnRule = (args) => {
	const last = args[args.length - 1];
	if (last?.kind === "scalar" && (last.name === "time" || last.name === "timetz")) return last;
	return TS;
};
/** TRUNC(timestamp) → date (r_TRUNC_date); TRUNC(numeric[, scale]) keeps its input type. */
const truncRule: FnRule = (args) => {
	const a = args[0];
	if (a?.kind === "scalar" && (a.name === "timestamp" || a.name === "date")) return DATE;
	return a ?? UNKNOWN;
};
/** AVG → BIGINT for integer input, DOUBLE for float input, same-as-input otherwise
 *  (r_AVG: "BIGINT for any integer type argument; DOUBLE PRECISION for a floating point
 *  argument; Returns the same data type as expression for any other argument type"). */
const avgRule: FnRule = (args) => {
	const a = args[0];
	if (a?.kind !== "scalar") return DEC;
	if (a.name === "smallint" || a.name === "int" || a.name === "bigint") return BIG;
	if (a.name === "double" || a.name === "float") return D;
	return a; // decimal / super keep their type
};
/** MEDIAN → follows the input type: INT/DECIMAL → DECIMAL, FLOAT/DOUBLE → DOUBLE,
 *  DATE → DATE, TIMESTAMP → TIMESTAMP (r_MEDIAN "Data types" table). */
const medianRule: FnRule = (args) => {
	const a = args[0];
	if (a?.kind !== "scalar") return UNKNOWN;
	if (a.name === "double" || a.name === "float") return D;
	if (a.name === "date" || a.name === "timestamp") return a;
	return DEC; // smallint/int/bigint/numeric/decimal → decimal
};

/** Function return-type registry for Amazon Redshift, from the AWS SQL reference (the language
 *  spec — the docs corpus is only a validation gate). Absent entries are functions whose
 *  documented return type is argument-value-dependent (EXTRACT, PERCENTILE_CONT/DISC) — those
 *  stay `unknown` by contract rather than risking a wrong type. */
export const REDSHIFT_FUNCTION_RETURNS: Record<string, FnRule> = {
	// --- String functions → varchar ---
	...group(fixed(S), [
		"btrim",
		"chr",
		"initcap",
		"left",
		"lower",
		"lpad",
		"ltrim",
		"quote_ident",
		"quote_literal",
		"regexp_replace",
		"regexp_substr",
		"repeat",
		"replace",
		"replicate",
		"reverse",
		"right",
		"rpad",
		"rtrim",
		"soundex",
		"split_part",
		"substr",
		"substring",
		"translate",
		"trim",
		"upper",
		"collate",
	]),
	// CONCAT keeps its argument type (char or binary) — r_CONCAT: "the same type as the input
	// arguments"; so it is `common`, not a fixed VARCHAR.
	concat: common,
	// --- String functions → integer positions/lengths ---
	...group(fixed(I), [
		"ascii",
		"bpcharcmp",
		"charindex",
		"difference",
		"len",
		"length",
		"char_length",
		"character_length",
		"octet_length",
		"octetindex",
		"position",
		"regexp_count",
		"regexp_instr",
		"strpos",
		"textlen",
	]),
	strtol: fixed(BIG),
	crc32: fixed(BIG),
	// --- Math functions ---
	...group(fixed(D), [
		"acos",
		"asin",
		"atan",
		"atan2",
		"cbrt",
		"cos",
		"cot",
		"degrees",
		"dexp",
		"dlog1",
		"dlog10",
		"exp",
		"ln",
		"log",
		"pi",
		"power",
		"pow",
		"radians",
		"random",
		"sin",
		"sqrt",
		"tan",
	]),
	// SIGN keeps its input numeric type (r_SIGN: "the same numeric data type as the input").
	...group(firstArg, ["abs", "ceil", "ceiling", "floor", "round", "sign"]),
	mod: common,
	trunc: truncRule,
	// --- Date/time functions ---
	...group(fixed(TS), ["add_months", "convert_timezone", "getdate", "sysdate", "timezone", "to_timestamp"]),
	...group(fixed(DATE), ["current_date", "last_day", "next_day", "to_date"]),
	...group(fixed(I), [
		"date_cmp",
		"date_cmp_timestamp",
		"date_cmp_timestamptz",
		"date_part_year",
		"interval_cmp",
		"timestamp_cmp",
		"timestamp_cmp_date",
		"timestamp_cmp_timestamptz",
		"timestamptz_cmp",
		"timestamptz_cmp_date",
		"timestamptz_cmp_timestamp",
	]),
	datediff: fixed(BIG),
	date_part: fixed(D),
	pgdate_part: fixed(D),
	date_trunc: fixed(TS),
	dateadd: dateaddRule,
	months_between: fixed(D),
	timeofday: fixed(S),
	// EXTRACT is absent by contract: its return type depends on the datepart argument's value.
	// --- Aggregate functions ---
	sum: (args) => widenSum(args[0] ?? UNKNOWN),
	avg: avgRule,
	count: fixed(BIG),
	max: firstArg,
	min: firstArg,
	median: medianRule,
	any_value: firstArg,
	listagg: fixed(S),
	...group(fixed(D), ["stddev", "stddev_samp", "stddev_pop", "variance", "var_samp", "var_pop"]),
	...group(fixed(B), ["bool_and", "bool_or"]),
	...group(firstArg, ["bit_and", "bit_or"]),
	// PERCENTILE_CONT/DISC are absent by contract: the type follows the WITHIN GROUP ORDER BY
	// expression, which is not in the call's argument list.
	// --- Window functions ---
	...group(fixed(BIG), ["row_number", "rank", "dense_rank", "ntile"]),
	...group(fixed(D), ["percent_rank", "cume_dist", "ratio_to_report"]),
	...group(firstArg, ["lag", "lead", "first_value", "last_value", "nth_value"]),
	// --- Conditional expressions ---
	coalesce: common,
	nvl: common,
	nvl2: restCommon,
	greatest: common,
	least: common,
	nullif: firstArg,
	decode: decodeRule,
	// --- Data-type formatting ---
	to_char: fixed(S),
	to_number: fixed(DEC),
	text_to_int_alt: fixed(I),
	text_to_numeric_alt: fixed(DEC),
	// --- Hash functions ---
	md5: fixed(S),
	sha: fixed(S),
	sha1: fixed(S),
	sha2: fixed(S),
	func_sha1: fixed(S),
	fnv_hash: fixed(BIG),
	checksum: fixed(I),
	murmur3_32_hash: fixed(I),
	// --- JSON / SUPER functions ---
	json_parse: fixed(SUPER),
	can_json_parse: fixed(B),
	json_serialize: fixed(S),
	json_serialize_to_varbyte: fixed(BIN),
	is_valid_json: fixed(B),
	is_valid_json_array: fixed(B),
	json_array_length: fixed(I),
	json_extract_array_element_text: fixed(S),
	json_extract_path_text: fixed(S),
	json_typeof: fixed(S),
	...group(fixed(B), [
		"is_array",
		"is_bigint",
		"is_boolean",
		"is_char",
		"is_decimal",
		"is_float",
		"is_integer",
		"is_object",
		"is_scalar",
		"is_smallint",
		"is_varchar",
	]),
	decimal_precision: fixed(I),
	decimal_scale: fixed(I),
	size: fixed(I),
	array: fixed(SUPER),
	array_concat: fixed(SUPER),
	array_flatten: fixed(SUPER),
	split_to_array: fixed(SUPER),
	subarray: fixed(SUPER),
	get_array_length: fixed(I),
	// --- VARBYTE functions ---
	from_hex: fixed(BIN),
	to_hex: fixed(S),
	from_varbyte: fixed(S),
	to_varbyte: fixed(BIN),
	getbit: fixed(I),
	// --- System information functions ---
	...group(fixed(S), [
		"current_database",
		"current_namespace",
		"current_schema",
		"current_user",
		"session_user",
		"user",
		"version",
	]),
	// CURRENT_AWS_ACCOUNT returns an INTEGER, not a string (r_CURRENT_AWS_ACCOUNT).
	current_aws_account: fixed(I),
	current_user_id: fixed(I),
	pg_backend_pid: fixed(I),
	slice_num: fixed(I),
	...group(fixed(BIG), ["pg_last_copy_count", "pg_last_copy_id", "pg_last_query_id", "pg_last_unload_count"]),
	...group(fixed(B), [
		"has_database_privilege",
		"has_schema_privilege",
		"has_table_privilege",
		"has_assumerole_privilege",
	]),
	// --- Spatial functions (OGC signatures; AWS "Spatial functions") ---
	...group(fixed(D), [
		"st_area",
		"st_angle",
		"st_distance",
		"st_distancesphere",
		"st_length",
		"st_perimeter",
		"st_x",
		"st_xmax",
		"st_xmin",
		"st_y",
		"st_ymax",
		"st_ymin",
		"st_z",
		"st_m",
		"st_zmax",
		"st_zmin",
	]),
	...group(fixed(B), [
		"st_contains",
		"st_containsproperly",
		"st_coveredby",
		"st_covers",
		"st_crosses",
		"st_disjoint",
		"st_dwithin",
		"st_equals",
		"st_intersects",
		"st_isclosed",
		"st_iscollection",
		"st_isempty",
		"st_isring",
		"st_issimple",
		"st_isvalid",
		"st_overlaps",
		"st_touches",
		"st_within",
	]),
	...group(fixed(I), [
		"st_dimension",
		"st_npoints",
		"st_nrings",
		"st_numgeometries",
		"st_numinteriorrings",
		"st_numpoints",
		"st_srid",
	]),
	st_geometrytype: fixed(S),
	geometrytype: fixed(S),
	...group(fixed(S), ["st_astext", "st_asewkt", "st_asgeojson"]),
	...group(fixed(BIN), ["st_asbinary", "st_asewkb"]),
	...group(fixed(GEOM), [
		"st_addpoint",
		"st_boundary",
		"st_buffer",
		"st_centroid",
		"st_collect",
		"st_convexhull",
		"st_difference",
		"st_endpoint",
		"st_envelope",
		"st_exteriorring",
		"st_force2d",
		"st_force3d",
		"st_force3dm",
		"st_force3dz",
		"st_force4d",
		"st_geohash",
		"st_geometryn",
		"st_geomfromewkb",
		"st_geomfromtext",
		"st_geomfromwkb",
		"st_interiorringn",
		"st_intersection",
		"st_makeline",
		"st_makepoint",
		"st_makepolygon",
		"st_multi",
		"st_point",
		"st_pointn",
		"st_polygon",
		"st_removepoint",
		"st_reverse",
		"st_segmentize",
		"st_setsrid",
		"st_simplify",
		"st_startpoint",
		"st_symdifference",
		"st_transform",
		"st_union",
	]),
	st_geogfromtext: fixed(GEOG),
	st_geogfromwkb: fixed(GEOG),
};
