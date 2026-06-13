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

// Seeded from the GoogleSQL function reference. Each return type is documented and fixed (or a
// documented "same as input" → firstArg / "supertype of args" → common); value-dependent returns
// (e.g. JSON_VALUE on heterogeneous data is string, but JSON_QUERY returns json) are pinned only
// where the doc states one type.
export const BIGQUERY_FUNCTION_RETURNS: Record<string, FnRule> = {
	// --- string functions (return STRING / INT64 / BOOL / BYTES) ---
	concat: fixed(S),
	lower: fixed(S),
	upper: fixed(S),
	trim: fixed(S),
	ltrim: fixed(S),
	rtrim: fixed(S),
	substr: fixed(S),
	substring: fixed(S),
	left: fixed(S),
	right: fixed(S),
	replace: fixed(S),
	lpad: fixed(S),
	rpad: fixed(S),
	repeat: fixed(S),
	reverse: firstArg, // STRING|BYTES → same type
	normalize: fixed(S),
	normalize_and_casefold: fixed(S),
	regexp_replace: fixed(S),
	regexp_extract: fixed(S),
	regexp_substr: fixed(S),
	soundex: fixed(S),
	translate: fixed(S),
	initcap: fixed(S),
	format: fixed(S),
	to_hex: fixed(S),
	to_base64: fixed(S),
	to_base32: fixed(S),
	to_code_points: arrayOf(I), // ARRAY<INT64>
	chr: fixed(S),
	code_points_to_string: fixed(S),
	code_points_to_bytes: fixed(BIN),
	from_base64: fixed(BIN),
	from_base32: fixed(BIN),
	from_hex: fixed(BIN),
	length: fixed(I),
	char_length: fixed(I),
	character_length: fixed(I),
	byte_length: fixed(I),
	octet_length: fixed(I),
	strpos: fixed(I),
	instr: fixed(I),
	ascii: fixed(I),
	unicode: fixed(I),
	starts_with: fixed(B),
	ends_with: fixed(B),
	regexp_contains: fixed(B),
	regexp_instr: fixed(I),
	split: arrayOf(S),
	regexp_extract_all: arrayOf(S),

	// --- math functions (FLOAT64 unless noted) ---
	abs: firstArg,
	sign: firstArg,
	round: firstArg,
	trunc: firstArg,
	ceil: firstArg,
	ceiling: firstArg,
	floor: firstArg,
	mod: firstArg,
	div: fixed(I),
	safe_divide: fixed(D),
	sqrt: fixed(D),
	pow: fixed(D),
	power: fixed(D),
	exp: fixed(D),
	ln: fixed(D),
	log: fixed(D),
	log10: fixed(D),
	greatest: common,
	least: common,
	rand: fixed(D),
	sin: fixed(D),
	cos: fixed(D),
	tan: fixed(D),
	asin: fixed(D),
	acos: fixed(D),
	atan: fixed(D),
	atan2: fixed(D),
	is_inf: fixed(B),
	is_nan: fixed(B),

	// --- date / time / timestamp ---
	current_date: fixed(DATE),
	current_time: fixed(TIME),
	current_datetime: fixed(TS),
	current_timestamp: fixed(TS),
	date: fixed(DATE),
	datetime: fixed(TS),
	time: fixed(TIME),
	timestamp: fixed(TS),
	date_add: fixed(DATE),
	date_sub: fixed(DATE),
	date_trunc: fixed(DATE),
	date_from_unix_date: fixed(DATE),
	last_day: fixed(DATE),
	datetime_add: fixed(TS),
	datetime_sub: fixed(TS),
	datetime_trunc: fixed(TS),
	timestamp_add: fixed(TS),
	timestamp_sub: fixed(TS),
	timestamp_trunc: fixed(TS),
	timestamp_seconds: fixed(TS),
	timestamp_millis: fixed(TS),
	timestamp_micros: fixed(TS),
	time_add: fixed(TIME),
	time_sub: fixed(TIME),
	time_trunc: fixed(TIME),
	date_diff: fixed(I),
	datetime_diff: fixed(I),
	timestamp_diff: fixed(I),
	time_diff: fixed(I),
	extract: fixed(I),
	unix_date: fixed(I),
	unix_seconds: fixed(I),
	unix_millis: fixed(I),
	unix_micros: fixed(I),
	format_date: fixed(S),
	format_datetime: fixed(S),
	format_time: fixed(S),
	format_timestamp: fixed(S),
	parse_date: fixed(DATE),
	parse_datetime: fixed(TS),
	parse_time: fixed(TIME),
	parse_timestamp: fixed(TS),

	// --- conditional / null ---
	coalesce: common,
	ifnull: common,
	nullif: firstArg,
	if: (args) => commonType(args.slice(1)),

	// --- aggregate ---
	count: fixed(I),
	countif: fixed(I),
	sum: firstArg,
	avg: fixed(D),
	min: firstArg,
	max: firstArg,
	any_value: firstArg,
	string_agg: fixed(S),
	array_agg: arrayOfFirst,
	logical_and: fixed(B),
	logical_or: fixed(B),
	bit_and: fixed(I),
	bit_or: fixed(I),
	bit_xor: fixed(I),
	approx_count_distinct: fixed(I),
	corr: fixed(D),
	covar_pop: fixed(D),
	covar_samp: fixed(D),
	stddev: fixed(D),
	stddev_pop: fixed(D),
	stddev_samp: fixed(D),
	var_pop: fixed(D),
	var_samp: fixed(D),
	variance: fixed(D),

	// --- window-only ---
	row_number: fixed(I),
	rank: fixed(I),
	dense_rank: fixed(I),
	ntile: fixed(I),
	percent_rank: fixed(D),
	cume_dist: fixed(D),
	lag: firstArg,
	lead: firstArg,
	first_value: firstArg,
	last_value: firstArg,
	nth_value: firstArg,

	// --- array ---
	array_length: fixed(I),
	array_to_string: fixed(S),
	generate_array: arrayOf(I),
	array_reverse: firstArg,
	array_concat: firstArg,
	offset: firstArg,
	ordinal: firstArg,

	// --- json ---
	to_json_string: fixed(S),
	json_value: fixed(S),
	json_query: fixed(JSON_),
	json_extract: fixed(JSON_),
	json_extract_scalar: fixed(S),
	parse_json: fixed(JSON_),
	to_json: fixed(JSON_),
	bool: fixed(B),
	int64: fixed(I),
	float64: fixed(D),

	// --- conversion / misc ---
	generate_uuid: fixed(S),
	to_json_string_pretty: fixed(S),
	farm_fingerprint: fixed(I),
	md5: fixed(BIN),
	sha1: fixed(BIN),
	sha256: fixed(BIN),
	sha512: fixed(BIN),
	session_user: fixed(S),
};
