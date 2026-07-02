import { commonType } from "./coerce.js";
import type { FnRule } from "./functions.js";
import { parseType, scalar, UNKNOWN, type Type } from "./types.js";

// BigQuery / GoogleSQL inference knowledge — function return types, literal forms, and scalar-type
// aliases — from the GoogleSQL function reference
// (cloud.google.com/bigquery/docs/reference/standard-sql/functions-and-operators). Same contract as
// the other dialects: a rule is absent (→ unknown) only when the documented return type is
// argument-value-dependent or unstated. A missing rule yields `unknown`, never a wrong type, so
// partial coverage is safe; the registry expands from the reference over time.

// GoogleSQL scalar type aliases → the shared canonical types.
const BQ_ALIASES: Record<string, string> = {
	int64: "int",
	float64: "double",
	numeric: "decimal",
	bignumeric: "decimal",
	bool: "boolean",
	bytes: "binary",
	string: "string",
	date: "date",
	datetime: "timestamp",
	timestamp: "timestamp",
	time: "time",
	json: "json",
	geography: "geography",
};

export function bigqueryParseType(text: string): Type {
	return parseType(text, BQ_ALIASES);
}

export function bigqueryLiteral(text: string): Type {
	const t = text.trim();
	// DATE '…' / TIMESTAMP '…' / DATETIME '…' / TIME '…' typed-literal prefixes.
	if (/^date\s+['"]/i.test(t)) return scalar("date");
	if (/^timestamp\s+['"]/i.test(t)) return scalar("timestamp");
	if (/^datetime\s+['"]/i.test(t)) return scalar("timestamp");
	if (/^time\s+['"]/i.test(t)) return scalar("time");
	if (/^numeric\s+['"]/i.test(t) || /^bignumeric\s+['"]/i.test(t)) return scalar("decimal");
	if (/^json\s+['"]/i.test(t)) return scalar("json");
	// String / bytes literals: optional r (raw) / b (bytes) prefixes, ' " or triple-quoted.
	if (/^[rb]{0,2}('|")/i.test(t)) return scalar(/^[rb]*b/i.test(t) ? "binary" : "string");
	if (/^(true|false)$/i.test(t)) return scalar("boolean");
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^[+-]?\d+$/.test(t)) return scalar("int");
	if (/^[+-]?(\d+\.\d*|\.\d+|\d+)(e[+-]?\d+)?$/i.test(t) && /[.e]/i.test(t)) return scalar("double");
	return UNKNOWN;
}

const S = scalar("string");
const I = scalar("int");
const D = scalar("double");
const B = scalar("boolean");
const BIN = scalar("binary");
const DATE = scalar("date");
const TIME = scalar("time");
const TS = scalar("timestamp");
const JSON_ = scalar("json");

const DEC = scalar("decimal");
const INTERVAL = scalar("interval");
const GEO = scalar("geography");

const fixed =
	(t: Type): FnRule =>
	() =>
		t;
const arrayOf =
	(el: Type): FnRule =>
	() => ({ kind: "array", element: el });
const firstArg: FnRule = (args) => args[0] ?? UNKNOWN; // "same type as input"
const common: FnRule = (args) => commonType(args);
const arrayOfFirst: FnRule = (args) => ({ kind: "array", element: args[0] ?? UNKNOWN });
// "same type as the array's element" (ARRAY_FIRST/LAST/MIN/MAX) — unwrap args[0] when it is an array.
const elementOfFirst: FnRule = (args) => {
	const a = args[0];
	return a?.kind === "array" ? a.element : UNKNOWN;
};

function group(rule: FnRule, names: string[]): Record<string, FnRule> {
	return Object.fromEntries(names.map((n) => [n, rule]));
}

// Built out family-by-family from the GoogleSQL function reference
// (cloud.google.com/bigquery/docs/reference/standard-sql/<family>_functions). Each return type is
// documented and fixed (or a documented "same as input" → firstArg / "supertype of args" → common /
// "same as array element" → elementOfFirst). Value-dependent returns are absent by contract: EXTRACT
// (return depends on the datepart), APPROX_TOP_COUNT/SUM (ARRAY<STRUCT> whose element follows the
// input), PERCENTILE_CONT/DISC (WITHIN GROUP), ARRAY_SUM/ARRAY_AVG (numeric widening), the RANGE
// constructor and RANGE_START/END (no canonical RANGE type here) — a missing rule yields `unknown`.
//
// Dotted-name families (net.*, hll_count.*, kll_quantiles.*, aead.*, keys.*, deterministic_*) key by
// the LAST path segment only: lowerFunctionCall names a call `pathParts(path).slice(-1)[0]`, so
// `net.ip_from_string(x)` looks up `ip_from_string`, `hll_count.merge(s)` looks up `merge`,
// `kll_quantiles.extract_point_int64(s)` looks up `extract_point_int64`, and `aead.encrypt(...)`
// looks up `encrypt` (verified against the parser, 2026-07-02). The segments are unique across the
// dotted families except merge_partial (hll_count + kll_quantiles both → BYTES — consistent) and
// `extract` (hll_count.extract → INT64, same as EXTRACT(part FROM ...) here → INT64 — consistent).
export const BIGQUERY_FUNCTION_RETURNS: Record<string, FnRule> = {
	// === String functions ===
	// → STRING
	...group(fixed(S), [
		"concat",
		"lower",
		"upper",
		"trim",
		"ltrim",
		"rtrim",
		"substr",
		"substring",
		"left",
		"right",
		"replace",
		"lpad",
		"rpad",
		"repeat",
		"normalize",
		"normalize_and_casefold",
		"regexp_replace",
		"regexp_extract",
		"regexp_substr",
		"soundex",
		"translate",
		"initcap",
		"format",
		"collate",
		"to_hex",
		"to_base64",
		"to_base32",
		"chr",
		"code_points_to_string",
		"safe_convert_bytes_to_string",
	]),
	reverse: firstArg, // STRING|BYTES → same type
	// → INT64 (positions / lengths / distances)
	...group(fixed(I), [
		"length",
		"char_length",
		"character_length",
		"byte_length",
		"octet_length",
		"strpos",
		"instr",
		"ascii",
		"unicode",
		"regexp_instr",
		"edit_distance",
	]),
	// → BOOL
	...group(fixed(B), ["starts_with", "ends_with", "regexp_contains", "contains_substr"]),
	// → BYTES
	...group(fixed(BIN), ["code_points_to_bytes", "from_base64", "from_base32", "from_hex"]),
	to_code_points: arrayOf(I), // ARRAY<INT64>
	split: arrayOf(S), // ARRAY<STRING>
	regexp_extract_all: arrayOf(S),

	// === Mathematical functions (FLOAT64 unless noted) ===
	...group(fixed(D), [
		"safe_divide",
		"ieee_divide",
		"sqrt",
		"cbrt",
		"pow",
		"power",
		"exp",
		"ln",
		"log",
		"log10",
		"rand",
		"sin",
		"cos",
		"tan",
		"sinh",
		"cosh",
		"tanh",
		"asin",
		"acos",
		"atan",
		"asinh",
		"acosh",
		"atanh",
		"atan2",
		"cot",
		"coth",
		"csc",
		"csch",
		"sec",
		"sech",
		"cosine_distance",
		"euclidean_distance",
	]),
	// "same numeric type as input" — ABS/SIGN/ROUND/TRUNC/CEIL/FLOOR/MOD/SAFE_NEGATE keep the input type.
	...group(firstArg, ["abs", "sign", "round", "trunc", "ceil", "ceiling", "floor", "mod", "safe_negate"]),
	// "supertype of the arguments" — GREATEST/LEAST and the SAFE_ arithmetic widen to the common type.
	...group(common, ["greatest", "least", "safe_add", "safe_subtract", "safe_multiply"]),
	div: fixed(I),
	range_bucket: fixed(I),
	is_inf: fixed(B),
	is_nan: fixed(B),

	// === Conversion functions (CAST/SAFE_CAST are handled structurally) ===
	parse_numeric: fixed(DEC),
	parse_bignumeric: fixed(DEC),

	// === Bit functions ===
	bit_count: fixed(I),

	// === Date functions ===
	...group(fixed(DATE), [
		"current_date",
		"date",
		"date_add",
		"date_sub",
		"date_trunc",
		"date_from_unix_date",
		"last_day",
		"parse_date",
	]),
	// === Datetime functions (DATETIME → the shared `timestamp` canonical) ===
	...group(fixed(TS), [
		"current_datetime",
		"datetime",
		"datetime_add",
		"datetime_sub",
		"datetime_trunc",
		"parse_datetime",
	]),
	// === Time functions ===
	...group(fixed(TIME), ["current_time", "time", "time_add", "time_sub", "time_trunc", "parse_time"]),
	// === Timestamp functions ===
	...group(fixed(TS), [
		"current_timestamp",
		"timestamp",
		"timestamp_add",
		"timestamp_sub",
		"timestamp_trunc",
		"timestamp_seconds",
		"timestamp_millis",
		"timestamp_micros",
		"parse_timestamp",
	]),
	// Diffs and UNIX_* epoch extractors → INT64 (verified: date/datetime/time/timestamp _DIFF, UNIX_*).
	...group(fixed(I), [
		"date_diff",
		"datetime_diff",
		"time_diff",
		"timestamp_diff",
		"unix_date",
		"unix_seconds",
		"unix_millis",
		"unix_micros",
	]),
	// FORMAT_* → STRING; STRING(timestamp, tz) / STRING(json) → STRING.
	...group(fixed(S), ["format_date", "format_datetime", "format_time", "format_timestamp", "string"]),
	// EXTRACT(part FROM ...) → INT64 for the common dateparts (DATE/TIME/DATETIME dateparts are
	// value-dependent but rare); this key also serves hll_count.extract → INT64.
	extract: fixed(I),

	// === Interval functions ===
	...group(fixed(INTERVAL), ["make_interval", "justify_days", "justify_hours", "justify_interval"]),

	// === Conditional expressions ===
	coalesce: common,
	ifnull: common,
	nullif: firstArg,
	if: (args) => commonType(args.slice(1)),

	// === Aggregate functions ===
	...group(fixed(I), ["count", "countif", "bit_and", "bit_or", "bit_xor", "grouping"]),
	...group(firstArg, ["sum", "min", "max", "any_value", "min_by", "max_by"]),
	avg: fixed(D), // FLOAT64 for the common numeric inputs (NUMERIC/INTERVAL inputs are value-dependent)
	string_agg: fixed(S),
	array_agg: arrayOfFirst,
	array_concat_agg: firstArg, // ARRAY<T>, same as the input array type
	...group(fixed(B), ["logical_and", "logical_or"]),
	// Statistical aggregates → FLOAT64.
	...group(fixed(D), [
		"corr",
		"covar_pop",
		"covar_samp",
		"stddev",
		"stddev_pop",
		"stddev_samp",
		"var_pop",
		"var_samp",
		"variance",
	]),

	// === Approximate aggregate functions ===
	approx_count_distinct: fixed(I),
	approx_quantiles: arrayOfFirst, // ARRAY<T>, T = the input element type
	// approx_top_count / approx_top_sum are absent: ARRAY<STRUCT<value <T>, count/sum INT64>> — the
	// element type follows the input, which the argument list does not expose.

	// --- HLL_COUNT.* (HyperLogLog++; keyed by last segment) ---
	...group(fixed(BIN), ["init", "merge_partial"]), // HLL_COUNT.INIT / .MERGE_PARTIAL → BYTES sketch
	merge: fixed(I), // HLL_COUNT.MERGE → INT64 cardinality

	// --- KLL_QUANTILES.* (keyed by last segment; INIT/MERGE_PARTIAL → sketch BYTES). No UINT64
	// variant exists (only INT64/FLOAT64) — cloud.google.com/bigquery/docs/reference/standard-sql/kll_functions.
	...group(fixed(BIN), ["init_int64", "init_float64"]),
	// MERGE/EXTRACT return the quantile boundaries as an ARRAY of the sketch's value type.
	...group(arrayOf(I), ["merge_int64", "extract_int64"]),
	...group(arrayOf(D), ["merge_float64", "extract_float64"]),
	// EXTRACT_POINT_* / MERGE_POINT_* return a single quantile boundary (scalar).
	extract_point_int64: fixed(I),
	extract_point_float64: fixed(D),
	merge_point_int64: fixed(I),
	merge_point_float64: fixed(D),

	// === Navigation + numbering (window) functions ===
	...group(fixed(I), ["row_number", "rank", "dense_rank", "ntile"]),
	...group(fixed(D), ["percent_rank", "cume_dist"]),
	// LAG/LEAD/FIRST_VALUE/LAST_VALUE/NTH_VALUE return the type of their value expression.
	...group(firstArg, ["lag", "lead", "first_value", "last_value", "nth_value"]),

	// === Array functions ===
	array_length: fixed(I),
	array_to_string: fixed(S),
	generate_array: arrayOf(I),
	generate_date_array: arrayOf(DATE),
	generate_timestamp_array: arrayOf(TS),
	...group(firstArg, ["array_reverse", "array_concat", "array_slice"]), // ARRAY<T> → same ARRAY<T>
	...group(elementOfFirst, ["array_first", "array_last"]), // element of the input array
	offset: firstArg,
	ordinal: firstArg,

	// === JSON functions ===
	// → JSON
	...group(fixed(JSON_), [
		"json_query",
		"json_extract",
		"parse_json",
		"to_json",
		"json_object",
		"json_array",
		"json_set",
		"json_remove",
		"json_strip_nulls",
		"json_array_append",
		"json_array_insert",
	]),
	// → STRING (scalar extractors + TO_JSON_STRING + JSON_TYPE + the LAX/typed STRING accessor)
	...group(fixed(S), ["to_json_string", "json_value", "json_extract_scalar", "json_type", "lax_string"]),
	// → typed scalar accessors (STRING() covered under STRING above via `string`)
	bool: fixed(B),
	int64: fixed(I),
	float64: fixed(D),
	lax_bool: fixed(B),
	lax_int64: fixed(I),
	lax_float64: fixed(D),
	// → ARRAY
	...group(arrayOf(JSON_), ["json_query_array", "json_extract_array"]),
	...group(arrayOf(S), ["json_value_array", "json_extract_string_array", "json_keys"]),

	// === Geography functions (OGC-style; from geography_functions) ===
	// → GEOGRAPHY (constructors / transforms)
	...group(fixed(GEO), [
		"st_boundary",
		"st_buffer",
		"st_bufferwithtolerance",
		"st_centroid",
		"st_centroid_agg",
		"st_closestpoint",
		"st_convexhull",
		"st_difference",
		"st_endpoint",
		"st_exteriorring",
		"st_geogfrom",
		"st_geogfromgeojson",
		"st_geogfromtext",
		"st_geogfromwkb",
		"st_geogpoint",
		"st_geogpointfromgeohash",
		"st_intersection",
		"st_lineinterpolatepoint",
		"st_linesubstring",
		"st_makeline",
		"st_makepolygon",
		"st_makepolygonoriented",
		"st_pointn",
		"st_simplify",
		"st_snaptogrid",
		"st_startpoint",
		"st_union",
		"st_union_agg",
	]),
	// → FLOAT64 (measures)
	...group(fixed(D), [
		"st_angle",
		"st_area",
		"st_azimuth",
		"st_distance",
		"st_hausdorffdistance",
		"st_length",
		"st_linelocatepoint",
		"st_maxdistance",
		"st_perimeter",
		"st_x",
		"st_y",
	]),
	// → BOOL (predicates)
	...group(fixed(B), [
		"st_contains",
		"st_coveredby",
		"st_covers",
		"st_disjoint",
		"st_dwithin",
		"st_equals",
		"st_hausdorffdwithin",
		"st_intersects",
		"st_intersectsbox",
		"st_isclosed",
		"st_iscollection",
		"st_isempty",
		"st_isring",
		"st_touches",
		"st_within",
	]),
	// → INT64 (counts; ST_CLUSTERDBSCAN is a window fn returning the cluster number, S2_CELLIDFROMPOINT
	// returns the S2 cell id)
	...group(fixed(I), [
		"st_dimension",
		"st_npoints",
		"st_numgeometries",
		"st_numpoints",
		"st_clusterdbscan",
		"s2_cellidfrompoint",
	]),
	// → STRING / BYTES (serializers)
	...group(fixed(S), ["st_asgeojson", "st_astext", "st_geohash", "st_geometrytype"]),
	st_asbinary: fixed(BIN),
	...group(arrayOf(GEO), ["st_dump", "st_interiorrings"]), // ARRAY<GEOGRAPHY>
	s2_coveringcellids: arrayOf(I), // ARRAY<INT64> of covering S2 cell ids
	// ST_BOUNDINGBOX / ST_EXTENT / ST_REGIONSTATS are absent: they return a STRUCT whose fields are
	// value-dependent.

	// === Hash functions ===
	farm_fingerprint: fixed(I),
	...group(fixed(BIN), ["md5", "sha1", "sha256", "sha512"]),

	// === Net functions (net.*; keyed by last segment) ===
	// IP_NET_MASK and IPV4_FROM_INT64 return BYTES, not STRING —
	// cloud.google.com/bigquery/docs/reference/standard-sql/net_functions.
	...group(fixed(S), ["host", "ip_to_string", "public_suffix", "reg_domain"]),
	...group(fixed(BIN), ["ip_from_string", "safe_ip_from_string", "ip_trunc", "ip_net_mask", "ipv4_from_int64"]),
	ipv4_to_int64: fixed(I),

	// === AEAD encryption functions (aead.* / keys.* / deterministic_*; keyed by last segment) ===
	...group(fixed(BIN), [
		"new_keyset",
		"new_wrapped_keyset",
		"add_key_from_raw_bytes",
		"keyset_chain",
		"keyset_from_json",
		"rewrap_keyset",
		"rotate_keyset",
		"rotate_wrapped_keyset",
		"encrypt",
		"decrypt_bytes",
		"deterministic_encrypt",
		"deterministic_decrypt_bytes",
	]),
	keyset_length: fixed(I),
	...group(fixed(S), ["decrypt_string", "deterministic_decrypt_string"]),
	// keys.keyset_to_json is absent: docs disagree on STRING vs JSON — omitted rather than risk a wrong type.

	// === Range functions ===
	...group(fixed(B), ["range_contains", "range_overlaps"]),
	// range / range_start / range_end are absent: no canonical RANGE type here, and start/end follow it.

	// === Search functions ===
	search: fixed(B), // SEARCH(data, query) → BOOL (VECTOR_SEARCH is table-valued; AI.SEARCH is AI, out of scope)

	// === Security functions ===
	session_user: fixed(S),

	// === Utility ===
	generate_uuid: fixed(S),
};
