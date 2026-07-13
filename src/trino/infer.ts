import { parseType, scalar, UNKNOWN, type Type } from "../infer/types.js";
import type { FnRule } from "../infer/functions.js";
import { commonType } from "../infer/coerce.js";
import { fold } from "./fold.js";

// ---------------------------------------------------------------------------
// Trino inference knowledge. Scalar-name aliases map Trino's type vocabulary onto the shared
// canonical names (trino.io/docs/current/language/types.html); `/` on integers is INTEGER
// division (truncates — functions/math.html), so division: "integer". Function returns doc-cited
// against the Trino 482 function reference (trino.io/docs/current/functions/<page>.html, noted
// per family below). A missing entry safely yields `unknown` — never guess.
// ---------------------------------------------------------------------------

export const TRINO_ALIASES: Record<string, string> = {
	integer: "int",
	real: "float",
	"double precision": "double",
	dec: "decimal",
	numeric: "decimal",
	varchar: "string",
	char: "string",
	varbinary: "binary",
	json: "json",
	uuid: "uuid",
	"timestamp with time zone": "timestamp",
	"timestamp without time zone": "timestamp",
	"time with time zone": "time",
	"time without time zone": "time",
	ipaddress: "string",
	hyperloglog: "binary",
	p4hyperloglog: "binary",
	qdigest: "binary",
	tdigest: "binary",
};

export function trinoParseType(text: string): Type {
	return parseType(text, TRINO_ALIASES, fold);
}

const S = scalar("string");
const I = scalar("int");
const BIG = scalar("bigint");
const D = scalar("double");
const DEC = scalar("decimal");
const B = scalar("boolean");
const DATE = scalar("date");
const TIME = scalar("time");
const TS = scalar("timestamp");
const IV = scalar("interval");
const BIN = scalar("binary");
const JSON_T = scalar("json");
const UUID = scalar("uuid");
const SARR = { kind: "array", element: S } as const satisfies Type;
const BIGARR = { kind: "array", element: BIG } as const satisfies Type;

/** Trino literal forms — language/types.html: integers are INTEGER/BIGINT by range (int here),
 *  a decimal point makes DECIMAL, E-notation makes DOUBLE, strings are VARCHAR, X'…' VARBINARY. */
export function trinoLiteral(text: string): Type {
	const t = text.trim();
	if (/^[uU]&'/.test(t) || /^'/.test(t)) return S;
	if (/^[xX]'/.test(t)) return BIN;
	if (/^(true|false)$/i.test(t)) return B;
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^date\s*'/i.test(t)) return DATE;
	if (/^time\s*'/i.test(t)) return TIME;
	if (/^timestamp\s*'/i.test(t)) return TS;
	if (/^interval\b/i.test(t)) return IV;
	if (/^json\s*'/i.test(t)) return JSON_T;
	if (/^uuid\s*'/i.test(t)) return UUID;
	if (/^decimal\s*'/i.test(t)) return DEC;
	if (/^double\s*(precision)?\s*'/i.test(t)) return D;
	if (/^[+-]?\d[\d_]*$/.test(t)) return I;
	if (/^[+-]?(\d[\d_]*\.?[\d_]*|\.[\d_]+)e[+-]?\d+$/i.test(t)) return D;
	if (/^[+-]?(\d[\d_]*\.[\d_]*|\.[\d_]+)$/.test(t)) return DEC;
	if (/^0[xX][0-9a-fA-F_]+$/.test(t) || /^0[oO][0-7_]+$/.test(t) || /^0[bB][01_]+$/.test(t)) return I;
	return UNKNOWN;
}

const fixed =
	(t: Type): FnRule =>
	() =>
		t;
const firstArg: FnRule = (args) => args[0] ?? UNKNOWN;
const common: FnRule = (args) => commonType(args);
const elementOfFirst: FnRule = (args) => (args[0]?.kind === "array" ? args[0].element : UNKNOWN);
const arrayOfFirst: FnRule = (args) => ({ kind: "array", element: args[0] ?? UNKNOWN });

function group(rule: FnRule, names: string[]): Record<string, FnRule> {
	return Object.fromEntries(names.map((n) => [n, rule]));
}

/** sum() — functions/aggregate.html: returns the input type family (BIGINT for integers,
 *  DOUBLE for double, DECIMAL for decimal). */
const sumRule: FnRule = (args) => {
	const a = args[0];
	if (a?.kind !== "scalar") return UNKNOWN;
	if (["tinyint", "smallint", "int", "bigint"].includes(a.name)) return BIG;
	if (a.name === "decimal") return DEC;
	if (a.name === "interval") return IV;
	return D;
};

export const TRINO_FUNCTION_RETURNS: Record<string, FnRule> = {
	// --- math — functions/math.html ---------------------------------------------
	abs: firstArg,
	ceil: firstArg,
	ceiling: firstArg,
	floor: firstArg,
	round: firstArg,
	truncate: firstArg,
	sign: firstArg,
	mod: firstArg,
	...group(fixed(D), [
		"cbrt",
		"degrees",
		"radians",
		"e",
		"pi",
		"exp",
		"ln",
		"log",
		"log2",
		"log10",
		"sqrt",
		"power",
		"pow",
		"random",
		"rand",
		"atan2",
		"sin",
		"cos",
		"tan",
		"asin",
		"acos",
		"atan",
		"sinh",
		"cosh",
		"tanh",
		"nan",
		"infinity",
		"inverse_normal_cdf",
		"normal_cdf",
		"inverse_beta_cdf",
		"beta_cdf",
		"wilson_interval_lower",
		"wilson_interval_upper",
		"cosine_similarity",
		"cosine_distance",
	]),
	width_bucket: fixed(BIG),
	is_nan: fixed(B),
	is_finite: fixed(B),
	is_infinite: fixed(B),
	from_base: fixed(BIG),
	to_base: fixed(S),
	// --- string — functions/string.html ------------------------------------------
	...group(fixed(S), [
		"chr",
		"concat_ws",
		"lower",
		"upper",
		"lpad",
		"rpad",
		"ltrim",
		"rtrim",
		"trim",
		"replace",
		"reverse",
		"substr",
		"substring",
		"translate",
		"normalize",
		"from_utf8",
		"word_stem",
		"lower_utf8",
		"upper_utf8",
		"soundex",
	]),
	concat: firstArg, // varchar/array/varbinary — keeps the argument family (functions/string.html)
	...group(fixed(BIG), [
		"length",
		"levenshtein_distance",
		"strpos",
		"position",
		"codepoint",
		"hamming_distance",
		"index",
	]),
	split: fixed(SARR),
	split_part: fixed(S),
	split_to_map: fixed({ kind: "map", key: S, value: S }),
	split_to_multimap: fixed({ kind: "map", key: S, value: SARR }),
	...group(fixed(B), ["starts_with", "ends_with", "contains"]), // contains is array too — boolean either way
	luhn_check: fixed(B),
	to_utf8: fixed(BIN),
	// --- regexp — functions/regexp.html -------------------------------------------
	regexp_count: fixed(BIG),
	regexp_extract: fixed(S),
	regexp_extract_all: fixed(SARR),
	regexp_like: fixed(B),
	regexp_position: fixed(BIG),
	regexp_replace: fixed(S),
	regexp_split: fixed(SARR),
	// --- binary — functions/binary.html -------------------------------------------
	...group(fixed(BIN), [
		"md5",
		"sha1",
		"sha256",
		"sha512",
		"xxhash64",
		"spooky_hash_v2_32",
		"spooky_hash_v2_64",
		"murmur3",
		"from_hex",
		"from_base64",
		"from_base64url",
		"from_base32",
		"hmac_md5",
		"hmac_sha1",
		"hmac_sha256",
		"hmac_sha512",
		"reverse_bytes",
	]),
	to_hex: fixed(S),
	to_base64: fixed(S),
	to_base64url: fixed(S),
	to_base32: fixed(S),
	crc32: fixed(BIG),
	to_big_endian_64: fixed(BIN),
	from_big_endian_64: fixed(BIG),
	to_big_endian_32: fixed(BIN),
	from_big_endian_32: fixed(I),
	to_ieee754_32: fixed(BIN),
	from_ieee754_32: fixed(scalar("float")),
	to_ieee754_64: fixed(BIN),
	from_ieee754_64: fixed(D),
	// --- bitwise — functions/bitwise.html ------------------------------------------
	...group(fixed(BIG), [
		"bit_count",
		"bitwise_and",
		"bitwise_not",
		"bitwise_or",
		"bitwise_xor",
		"bitwise_left_shift",
		"bitwise_right_shift",
		"bitwise_right_shift_arithmetic",
	]),
	// --- date/time — functions/datetime.html ---------------------------------------
	current_date: fixed(DATE),
	current_time: fixed(TIME),
	current_timestamp: fixed(TS),
	localtime: fixed(TIME),
	localtimestamp: fixed(TS),
	now: fixed(TS),
	date: fixed(DATE),
	last_day_of_month: fixed(DATE),
	from_iso8601_timestamp: fixed(TS),
	from_iso8601_timestamp_nanos: fixed(TS),
	from_iso8601_date: fixed(DATE),
	from_unixtime: fixed(TS),
	from_unixtime_nanos: fixed(TS),
	to_unixtime: fixed(D),
	to_milliseconds: fixed(BIG),
	to_iso8601: fixed(S),
	date_format: fixed(S),
	date_parse: fixed(TS),
	format_datetime: fixed(S),
	parse_datetime: fixed(TS),
	parse_duration: fixed(IV),
	human_readable_seconds: fixed(S),
	date_trunc: firstArg2Time, // returns the unit-truncated second argument's type
	date_add: lastArgTime,
	date_diff: fixed(BIG),
	timezone_hour: fixed(BIG),
	timezone_minute: fixed(BIG),
	timezone: fixed(S),
	at_timezone: fixed(TS),
	with_timezone: fixed(TS),
	...group(fixed(BIG), [
		"day",
		"day_of_month",
		"day_of_week",
		"day_of_year",
		"dow",
		"doy",
		"hour",
		"millisecond",
		"minute",
		"month",
		"quarter",
		"second",
		"week",
		"week_of_year",
		"year",
		"year_of_week",
		"yow",
		"extract",
	]),
	// --- aggregate — functions/aggregate.html ---------------------------------------
	count: fixed(BIG),
	count_if: fixed(BIG),
	approx_distinct: fixed(BIG),
	sum: sumRule,
	avg: (args) =>
		args[0]?.kind === "scalar" && args[0].name === "interval"
			? IV
			: args[0]?.kind === "scalar" && args[0].name === "decimal"
				? DEC
				: D,
	min: firstArg,
	max: firstArg,
	min_by: firstArg,
	max_by: firstArg,
	any_value: firstArg,
	arbitrary: firstArg,
	array_agg: arrayOfFirst,
	bool_and: fixed(B),
	bool_or: fixed(B),
	every: fixed(B),
	checksum: fixed(BIN),
	geometric_mean: fixed(D),
	listagg: fixed(S),
	string_agg: fixed(S),
	bitwise_and_agg: firstArg,
	bitwise_or_agg: firstArg,
	bitwise_xor_agg: firstArg,
	histogram: (args) => ({ kind: "map", key: args[0] ?? UNKNOWN, value: BIG }),
	map_agg: (args) => ({ kind: "map", key: args[0] ?? UNKNOWN, value: args[1] ?? UNKNOWN }),
	multimap_agg: (args) => ({
		kind: "map",
		key: args[0] ?? UNKNOWN,
		value: { kind: "array", element: args[1] ?? UNKNOWN },
	}),
	...group(fixed(D), [
		"corr",
		"covar_pop",
		"covar_samp",
		"kurtosis",
		"regr_intercept",
		"regr_slope",
		"skewness",
		"stddev",
		"stddev_pop",
		"stddev_samp",
		"var_pop",
		"var_samp",
		"variance",
	]),
	approx_percentile: firstArg,
	// --- window — functions/window.html ----------------------------------------------
	...group(fixed(BIG), ["row_number", "rank", "dense_rank", "ntile"]),
	percent_rank: fixed(D),
	cume_dist: fixed(D),
	first_value: firstArg,
	last_value: firstArg,
	nth_value: firstArg,
	lead: firstArg,
	lag: firstArg,
	// --- array — functions/array.html --------------------------------------------------
	array_distinct: firstArg,
	array_except: firstArg,
	array_intersect: firstArg,
	array_union: firstArg,
	array_remove: firstArg,
	array_sort: firstArg,
	array_reverse: firstArg,
	arrays_overlap: fixed(B),
	array_join: fixed(S),
	array_max: elementOfFirst,
	array_min: elementOfFirst,
	array_position: fixed(BIG),
	array_first: elementOfFirst,
	array_last: elementOfFirst,
	array_first_index: fixed(BIG),
	array_last_index: fixed(BIG),
	element_at: (args) =>
		args[0]?.kind === "array" ? args[0].element : args[0]?.kind === "map" ? args[0].value : UNKNOWN,
	cardinality: fixed(BIG),
	flatten: elementOfFirst,
	repeat: arrayOfFirst,
	sequence: (args) => ({ kind: "array", element: args[0] ?? BIG }),
	shuffle: firstArg,
	slice: firstArg,
	trim_array: firstArg,
	combinations: (args) => ({ kind: "array", element: args[0] ?? UNKNOWN }),
	ngrams: (args) => ({ kind: "array", element: args[0] ?? UNKNOWN }),
	zip: fixed(UNKNOWN), // array(row(…)) — shape depends on arity; row types stay unknown
	array_histogram: (args) => ({
		kind: "map",
		key: args[0]?.kind === "array" ? args[0].element : UNKNOWN,
		value: BIG,
	}),
	// higher-order (functions/lambda.html): typed by the engine's lambda machinery in infer.ts
	// (transform/filter/reduce/zip_with/…); entries here only for the non-lambda-dependent ones.
	filter: firstArg,
	array_sort_desc: firstArg,
	// --- map — functions/map.html -------------------------------------------------------
	map_keys: (args) => ({ kind: "array", element: args[0]?.kind === "map" ? args[0].key : UNKNOWN }),
	map_values: (args) => ({ kind: "array", element: args[0]?.kind === "map" ? args[0].value : UNKNOWN }),
	map_concat: firstArg,
	map_filter: firstArg,
	map_from_entries: fixed(UNKNOWN), // depends on row-typed entries
	multimap_from_entries: fixed(UNKNOWN),
	map_entries: fixed(UNKNOWN),
	transform_keys: fixed(UNKNOWN),
	transform_values: fixed(UNKNOWN),
	// --- json — functions/json.html -----------------------------------------------------
	json_array_contains: fixed(B),
	json_array_get: fixed(JSON_T),
	json_array_length: fixed(BIG),
	json_extract: fixed(JSON_T),
	json_extract_scalar: fixed(S),
	json_format: fixed(S),
	json_parse: fixed(JSON_T),
	json_size: fixed(BIG),
	is_json_scalar: fixed(B),
	json_query: fixed(S), // default RETURNING varchar (functions/json.html#json-query)
	json_exists: fixed(B),
	// json_value's default return is varchar; RETURNING overrides ride the cast node.
	json_value: fixed(S),
	json_object: fixed(S),
	json_array: fixed(S),
	// --- URL — functions/url.html --------------------------------------------------------
	...group(fixed(S), [
		"url_extract_fragment",
		"url_extract_host",
		"url_extract_path",
		"url_extract_protocol",
		"url_extract_query",
		"url_encode",
		"url_decode",
		"url_extract_parameter",
	]),
	url_extract_port: fixed(BIG),
	// --- UUID / IP — functions/uuid.html, functions/ipaddress.html ------------------------
	uuid: fixed(UUID),
	ip_prefix: fixed(S),
	is_private_ip: fixed(B),
	// --- conditional — functions/conditional.html ------------------------------------------
	coalesce: common,
	nullif: firstArg,
	if: (args) => commonType(args.slice(1)),
	try: firstArg,
	// --- comparison — functions/comparison.html --------------------------------------------
	greatest: common,
	least: common,
	// --- conversion — functions/conversion.html --------------------------------------------
	format: fixed(S),
	format_number: fixed(S),
	parse_data_size: fixed(DEC),
	typeof: fixed(S),
	// --- color/misc — functions/color.html, functions/session.html --------------------------
	bar: fixed(S),
	color: fixed(S),
	render: fixed(S),
	rgb: fixed(BIG),
	current_user: fixed(S),
	current_catalog: fixed(S),
	current_schema: fixed(S),
	current_path: fixed(S),
	version: fixed(S),
	current_groups: fixed(SARR),
	// --- hll / quantile digests — functions/hyperloglog.html, functions/qdigest.html --------
	approx_set: fixed(BIN),
	empty_approx_set: fixed(BIN),
	merge_hll: fixed(BIN),
	value_at_quantile: fixed(UNKNOWN), // parametric on the digest's type
	values_at_quantiles: fixed(UNKNOWN),
	qdigest_agg: fixed(BIN),
	tdigest_agg: fixed(BIN),
	// --- table meta functions --------------------------------------------------------------
	unique: fixed(B),
	// --- ML/AI (functions/ai.html): value-dependent providers — stay unknown by contract.
};

/** date_trunc(unit, x) — returns x's type. */
function firstArg2Time(args: Type[]): Type {
	return args[1] ?? UNKNOWN;
}
/** date_add(unit, n, x) — returns x's type. */
function lastArgTime(args: Type[]): Type {
	return args[args.length - 1] ?? UNKNOWN;
}
