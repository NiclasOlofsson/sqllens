import { parseType, scalar, UNKNOWN, type Type } from "../infer/types.js";
import type { FnRule } from "../infer/functions.js";
import { commonType } from "../infer/coerce.js";
import { fold } from "./fold.js";

// ---------------------------------------------------------------------------
// PostgreSQL inference knowledge. Scalar-name aliases map the Postgres type
// vocabulary onto the shared canonical names; integer division truncates
// (functions-math.html: "division (for integral types, division truncates the
// result toward zero)"). Function returns doc-cited against the PostgreSQL 18
// function reference (https://www.postgresql.org/docs/18/functions.html,
// chapter 9, per-family pages cited below). A missing entry safely yields
// `unknown` (the inference contract) — never guess a return type.
// ---------------------------------------------------------------------------

export const POSTGRES_ALIASES: Record<string, string> = {
	int2: "smallint",
	int4: "int",
	integer: "int",
	int8: "bigint",
	serial: "int",
	smallserial: "smallint",
	bigserial: "bigint",
	numeric: "decimal",
	dec: "decimal",
	float4: "float",
	real: "float",
	float8: "double",
	float: "double", // bare FLOAT is double precision (datatype-numeric)
	"double precision": "double",
	bool: "boolean",
	char: "string",
	character: "string",
	bpchar: "string",
	name: "string",
	varchar: "string",
	"character varying": "string",
	text: "string",
	citext: "string",
	timestamptz: "timestamp",
	"timestamp without time zone": "timestamp",
	"timestamp with time zone": "timestamp",
	timetz: "time",
	"time without time zone": "time",
	"time with time zone": "time",
	bytea: "binary",
	varbit: "bit",
	"bit varying": "bit",
};

export function postgresParseType(text: string): Type {
	return parseType(text, POSTGRES_ALIASES, fold);
}

const S = scalar("string");
const I = scalar("int");
const SMALL = scalar("smallint");
const BIG = scalar("bigint");
const D = scalar("double");
const F = scalar("float");
const DEC = scalar("decimal");
const B = scalar("boolean");
const DATE = scalar("date");
const TIME = scalar("time");
const TS = scalar("timestamp");
const IV = scalar("interval");
const BIN = scalar("binary");
const JSON_T = scalar("json");
const JSONB = scalar("jsonb");
const UUID = scalar("uuid");
const XML = scalar("xml");
const INET = scalar("inet");
const CIDR = scalar("cidr");
const TSV = scalar("tsvector");
const TSQ = scalar("tsquery");
const SARR = { kind: "array", element: S } as const satisfies Type;

/** PostgreSQL literal forms — syntax-lexical §4.1.2: a numeric constant with neither decimal point
 *  nor exponent is integer (bigint/numeric when it overflows — size ignored here); one WITH a
 *  decimal point and/or an exponent is presumed `numeric` (NOT float8 — unlike Redshift). String
 *  constants ('…', E'…', $$…$$) are "initially unknown-type"; we type them string for practical
 *  editor value, like the other dialects. B'…'/X'…' are bit strings. */
export function postgresLiteral(text: string): Type {
	const t = text.trim();
	if (/^[eE]?'/.test(t) || /^\$[a-zA-Z_0-9]*\$/.test(t) || /^[uU]&'/.test(t)) return S;
	if (/^[bBxX]'/.test(t)) return scalar("bit");
	if (/^(true|false)$/i.test(t)) return B;
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^date\s*'/i.test(t)) return DATE;
	if (/^time\s*'/i.test(t)) return TIME;
	if (/^timestamp/i.test(t) && /'/.test(t)) return TS;
	if (/^interval\b/i.test(t)) return IV;
	if (/^[+-]?\d+$/.test(t)) return I;
	if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return DEC;
	if (/^0[xX][0-9a-fA-F_]+$/.test(t) || /^0[oO][0-7_]+$/.test(t) || /^0[bB][01_]+$/.test(t)) return I;
	return UNKNOWN;
}

const fixed =
	(t: Type): FnRule =>
	() =>
		t;
const firstArg: FnRule = (args) => args[0] ?? UNKNOWN;
const secondArg: FnRule = (args) => args[1] ?? UNKNOWN;
const common: FnRule = (args) => commonType(args);

function group(rule: FnRule, names: string[]): Record<string, FnRule> {
	return Object.fromEntries(names.map((n) => [n, rule]));
}

/** sum() — Table 9.62: bigint for smallint/int inputs, numeric for bigint, otherwise the input
 *  type (numeric/double/interval/money keep their type). */
const sumRule: FnRule = (args) => {
	const a = args[0];
	if (a?.kind !== "scalar") return UNKNOWN;
	if (a.name === "smallint" || a.name === "int") return BIG;
	if (a.name === "bigint") return DEC;
	return a;
};
/** avg() — Table 9.62: numeric for any integer/numeric input, double for float, interval for
 *  interval. */
const avgRule: FnRule = (args) => {
	const a = args[0];
	if (a?.kind !== "scalar") return DEC;
	if (a.name === "double" || a.name === "float") return D;
	if (a.name === "interval") return IV;
	return DEC;
};
/** The stddev- and var- statistical aggregates — Table 9.63: double for float inputs, numeric
 *  otherwise. */
const statRule: FnRule = (args) => {
	const a = args[0];
	if (a?.kind === "scalar" && (a.name === "double" || a.name === "float")) return D;
	return DEC;
};
/** array_agg(x) → array of the input type (Table 9.62). */
const arrayAggRule: FnRule = (args) => ({ kind: "array", element: args[0] ?? UNKNOWN });
/** to_json family: json_agg → json, jsonb_agg → jsonb handled as fixed entries. */

/** bytea/bit-preserving forms of the string functions — pg_proc.dat (REL_18_STABLE): btrim/
 *  ltrim/rtrim(bytea,bytea)→bytea, reverse(bytea)→bytea, substr/substring(bytea,int4[,int4])→
 *  bytea, substring/overlay(bit,bit,int4[,int4])→bit, overlay(bytea,bytea,int4[,int4])→bytea.
 *  The subject is always args[0] (substr/substring/overlay) or the bytea overload's first arg
 *  (btrim/ltrim/rtrim are (bytea,bytea)); every other overload (text) returns string. */
const binOrBitPreserving: FnRule = (args) => {
	const a = args[0];
	if (a?.kind === "scalar" && (a.name === "binary" || a.name === "bit")) return a;
	return S;
};

/** ts_headline() returns the DOCUMENT argument's type — pg_proc.dat: ([regconfig,] document,
 *  tsquery [, options text]) → document's type: text, json, or jsonb overloads all present
 *  (regconfig,jsonb,tsquery[,text])→jsonb, (regconfig,json,tsquery[,text])→json, plain
 *  text overloads → text. The document is whichever of args[0]/args[1] is json/jsonb (the
 *  regconfig arg, when present, is args[0] and never carries the document type). */
const tsHeadlineRule: FnRule = (args) => {
	for (const a of args.slice(0, 2)) {
		if (a?.kind === "scalar" && (a.name === "json" || a.name === "jsonb")) return a;
	}
	return S;
};

/** random() — pg_proc.dat: random()→float8, and the PG17+ bounded overloads return the bound
 *  argument's type verbatim: random(int4,int4)→int4, random(int8,int8)→int8,
 *  random(numeric,numeric)→numeric. */
const randomRule: FnRule = (args) => (args.length === 0 ? D : (args[0] ?? UNKNOWN));

/** percentile_cont() — pg_proc.dat (prokind 'a', ordered-set aggregate): the catalog signature
 *  is (fraction, ordered-set-arg) and the return follows the ORDERED-SET argument (args[1]),
 *  not the fraction: percentile_cont(float8,float8)→float8, percentile_cont(float8,interval)→
 *  interval, percentile_cont(_float8,float8)→_float8, percentile_cont(_float8,interval)→
 *  _interval (an array of fractions broadcasts to an array of the ordered-set type). The
 *  SQL-level WITHIN GROUP form has no ordered-set arg in the call args at all — abstain. */
const percentileContRule: FnRule = (args) => {
	const a0 = args[0];
	if (a0?.kind === "array") return { kind: "array", element: args[1] ?? UNKNOWN };
	return args.length >= 2 ? (args[1] ?? UNKNOWN) : UNKNOWN;
};

/** length() — pg_proc.dat: the geometric overloads length(lseg)→float8 and length(path)→
 *  float8 diverge from every other overload (text/bpchar/bytea[,name]/bit/tsvector → int4). */
const lengthRule: FnRule = (args) => {
	const a = args[0];
	if (a?.kind === "scalar" && (a.name === "lseg" || a.name === "path")) return D;
	return I;
};

/** log10() — pg_proc.dat: log10(float8)→float8, log10(numeric)→numeric (unlike log(x), which
 *  pg_proc only has as the alias base-10 numeric form covered by the firstArg group). */
const log10Rule: FnRule = (args) => {
	const a = args[0];
	if (a?.kind === "scalar" && a.name === "decimal") return DEC;
	return D;
};

/** age() — pg_proc.dat: age(xid)→int4 (transaction-id distance) is a different function in
 *  substance from the datetime overloads age(timestamp[tz][,timestamp[tz]])→interval. */
const ageRule: FnRule = (args) => {
	const a = args[0];
	if (a?.kind === "scalar" && a.name === "xid") return I;
	return IV;
};

export const POSTGRES_FUNCTION_RETURNS: Record<string, FnRule> = {
	// --- mathematical — functions-math.html (Table 9.5-9.8) --------------------
	...group(firstArg, [
		"abs",
		"ceil",
		"ceiling",
		"floor",
		"round",
		"trunc",
		"sign",
		"exp",
		"ln",
		"log",
		"sqrt",
		"mod",
		"gcd",
		"lcm",
		"trim_scale",
	]),
	...group(fixed(D), [
		"cbrt",
		"degrees",
		"radians",
		"pi",
		"random_normal",
		"atan2",
		"atan2d",
		"erf",
		"erfc",
	]),
	random: randomRule, // PG17+ bounded overloads return the bound's own type — pg_proc.dat
	...group(fixed(D), [
		"sin",
		"cos",
		"tan",
		"cot",
		"asin",
		"acos",
		"atan",
		"sind",
		"cosd",
		"tand",
		"cotd",
		"asind",
		"acosd",
		"atand",
		"sinh",
		"cosh",
		"tanh",
		"asinh",
		"acosh",
		"atanh",
		"gamma",
		"lgamma",
	]),
	log10: log10Rule, // log10(numeric) → numeric, log10(float8) → float8 — pg_proc.dat
	div: fixed(DEC), // div(y numeric, x numeric) → numeric
	factorial: fixed(DEC),
	power: (args) => commonType(args), // numeric^numeric → numeric, dp^dp → dp
	scale: fixed(I),
	width_bucket: fixed(I),
	setseed: fixed(UNKNOWN),
	min_scale: fixed(I), // min_scale(numeric) → int4 — pg_proc.dat

	// --- strings — functions-string.html (Table 9.10) --------------------------
	...group(fixed(S), [
		"chr",
		"concat",
		"concat_ws",
		"format",
		"initcap",
		"left",
		"lower",
		"lpad",
		"md5",
		"normalize",
		"quote_ident",
		"quote_literal",
		"quote_nullable",
		"repeat",
		"replace",
		"right",
		"rpad",
		"split_part",
		"to_ascii",
		"to_bin",
		"to_char",
		"to_hex",
		"to_oct",
		"translate",
		"trim",
		"unistr",
		"upper",
		"casefold",
		"regexp_replace",
		"regexp_substr",
	]),
	// bytea/bit-preserving: btrim/ltrim/rtrim/reverse/substr/substring/overlay keep their
	// binary or bit subject instead of coercing to string — see binOrBitPreserving above.
	...group(binOrBitPreserving, ["btrim", "ltrim", "rtrim", "reverse", "substr", "substring", "overlay"]),
	...group(fixed(I), [
		"ascii",
		"bit_length",
		"char_length",
		"character_length",
		"octet_length",
		"position",
		"strpos",
		"regexp_count",
		"regexp_instr",
	]),
	length: lengthRule, // length(lseg)/length(path) → float8; everything else → int4 — pg_proc.dat
	regexp_like: fixed(B),
	starts_with: fixed(B),
	...group(fixed(SARR), [
		"parse_ident",
		"regexp_match",
		"regexp_matches",
		"regexp_split_to_array",
		"string_to_array",
	]),
	regexp_split_to_table: fixed(S),
	string_to_table: fixed(S),

	// --- binary strings — functions-binarystring.html (Table 9.12-9.13) --------
	decode: fixed(BIN),
	encode: fixed(S),
	get_bit: fixed(I),
	get_byte: fixed(I),
	set_bit: firstArg,
	set_byte: firstArg,
	...group(fixed(BIN), ["sha224", "sha256", "sha384", "sha512"]),
	convert: fixed(BIN),
	convert_from: fixed(S),
	convert_to: fixed(BIN),

	// --- date/time — functions-datetime.html (Table 9.33) ----------------------
	age: ageRule, // age(xid) → int4 vs. age(timestamp[tz]...) → interval — pg_proc.dat
	...group(fixed(TS), [
		"clock_timestamp",
		"now",
		"statement_timestamp",
		"transaction_timestamp",
		"date_add",
		"date_subtract",
		"date_bin",
		"to_timestamp",
		"make_timestamp",
		"make_timestamptz",
	]),
	current_date: fixed(DATE),
	current_time: fixed(TIME),
	current_timestamp: fixed(TS),
	localtime: fixed(TIME),
	localtimestamp: fixed(TS),
	date_part: fixed(D), // Table 9.33: date_part → double precision
	extract: fixed(DEC), // PG14+: extract → numeric
	date_trunc: (args) => args[1] ?? TS, // returns its input's type (timestamp/timestamptz/interval)
	isfinite: fixed(B),
	...group(fixed(IV), ["justify_days", "justify_hours", "justify_interval", "make_interval"]),
	make_date: fixed(DATE),
	make_time: fixed(TIME),
	timeofday: fixed(S),
	to_date: fixed(DATE),
	to_number: fixed(DEC),

	// --- aggregates — functions-aggregate.html (Tables 9.62-9.65) --------------
	count: fixed(BIG),
	sum: sumRule,
	avg: avgRule,
	min: firstArg,
	max: firstArg,
	any_value: firstArg,
	array_agg: arrayAggRule,
	string_agg: firstArg, // text in → text, bytea in → bytea
	...group(fixed(B), ["bool_and", "bool_or", "every"]),
	...group(firstArg, ["bit_and", "bit_or", "bit_xor", "range_agg", "range_intersect_agg"]),
	json_agg: fixed(JSON_T),
	json_agg_strict: fixed(JSON_T),
	jsonb_agg: fixed(JSONB),
	jsonb_agg_strict: fixed(JSONB),
	json_object_agg: fixed(JSON_T),
	json_object_agg_strict: fixed(JSON_T),
	json_object_agg_unique: fixed(JSON_T),
	json_object_agg_unique_strict: fixed(JSON_T),
	jsonb_object_agg: fixed(JSONB),
	jsonb_object_agg_strict: fixed(JSONB),
	jsonb_object_agg_unique: fixed(JSONB),
	jsonb_object_agg_unique_strict: fixed(JSONB),
	xmlagg: fixed(XML),
	...group(fixed(D), [
		"corr",
		"covar_pop",
		"covar_samp",
		"regr_avgx",
		"regr_avgy",
		"regr_intercept",
		"regr_r2",
		"regr_slope",
		"regr_sxx",
		"regr_sxy",
		"regr_syy",
	]),
	regr_count: fixed(BIG),
	...group(statRule, ["stddev", "stddev_pop", "stddev_samp", "variance", "var_pop", "var_samp"]),
	mode: fixed(UNKNOWN), // ordered-set: type of the WITHIN GROUP sort expr (not visible here)
	percentile_cont: percentileContRule, // follows the ordered-set arg (args[1]), not the fraction — pg_proc.dat
	percentile_disc: fixed(UNKNOWN), // type of the sort expression

	// --- window — functions-window.html (Table 9.66) ---------------------------
	row_number: fixed(BIG),
	rank: fixed(BIG),
	dense_rank: fixed(BIG),
	percent_rank: fixed(D),
	cume_dist: fixed(D),
	ntile: fixed(I),
	lag: firstArg,
	lead: firstArg,
	first_value: firstArg,
	last_value: firstArg,
	nth_value: firstArg,

	// --- JSON — functions-json.html (Tables 9.47-9.51) -------------------------
	to_json: fixed(JSON_T),
	to_jsonb: fixed(JSONB),
	array_to_json: fixed(JSON_T),
	row_to_json: fixed(JSON_T),
	json_build_array: fixed(JSON_T),
	jsonb_build_array: fixed(JSONB),
	json_build_object: fixed(JSON_T),
	jsonb_build_object: fixed(JSONB),
	json_object: fixed(JSON_T),
	jsonb_object: fixed(JSONB),
	json_array_length: fixed(I),
	jsonb_array_length: fixed(I),
	json_extract_path: fixed(JSON_T),
	jsonb_extract_path: fixed(JSONB),
	json_extract_path_text: fixed(S),
	jsonb_extract_path_text: fixed(S),
	json_object_keys: fixed(S),
	jsonb_object_keys: fixed(S),
	json_typeof: fixed(S),
	jsonb_typeof: fixed(S),
	json_strip_nulls: fixed(JSON_T),
	jsonb_strip_nulls: fixed(JSONB),
	...group(fixed(JSONB), [
		"jsonb_set",
		"jsonb_set_lax",
		"jsonb_insert",
		"jsonb_path_query_array",
		"jsonb_path_query_first",
		"jsonb_concat",
	]),
	jsonb_path_exists: fixed(B),
	jsonb_path_match: fixed(B),
	jsonb_pretty: fixed(S),
	json_scalar: fixed(JSON_T),
	json_serialize: fixed(S),
	json_query: fixed(JSONB), // SQL/JSON: default RETURNING jsonb
	json_value: fixed(S), // SQL/JSON: default RETURNING text
	json_exists: fixed(B),

	// --- arrays — functions-array.html (Table 9.55) ----------------------------
	...group(firstArg, [
		"array_append",
		"array_cat",
		"array_remove",
		"array_replace",
		"array_reverse",
		"array_sample",
		"array_shuffle",
		"array_sort",
		"trim_array",
		"array_fill",
	]),
	array_prepend: secondArg, // array_prepend(elem, array) → the array's type
	array_dims: fixed(S),
	...group(fixed(I), ["array_length", "array_lower", "array_ndims", "array_position", "array_upper", "cardinality"]),
	array_positions: fixed({ kind: "array", element: I }),
	array_to_string: fixed(S),
	generate_subscripts: fixed(I),
	generate_series: firstArg,

	// --- ranges — functions-range.html (Table 9.57) ----------------------------
	...group(fixed(B), ["isempty", "lower_inc", "upper_inc", "lower_inf", "upper_inf", "range_intersect_agg_check"]),
	range_merge: firstArg,

	// --- UUID — functions-uuid / datatype-uuid ----------------------------------
	gen_random_uuid: fixed(UUID),
	uuidv4: fixed(UUID),
	uuidv7: fixed(UUID),
	uuid_extract_timestamp: fixed(TS),
	uuid_extract_version: fixed(SMALL),

	// --- network — functions-net.html (Table 9.40) -----------------------------
	host: fixed(S),
	hostmask: fixed(INET),
	masklen: fixed(I),
	netmask: fixed(INET),
	network: fixed(CIDR),
	set_masklen: firstArg,
	abbrev: fixed(S),
	broadcast: fixed(INET),
	family: fixed(I),
	inet_merge: fixed(CIDR),
	inet_same_family: fixed(B),
	macaddr8_set7bit: fixed(scalar("macaddr8")),

	// --- text search — functions-textsearch.html (Table 9.43) ------------------
	to_tsvector: fixed(TSV),
	...group(fixed(TSQ), ["to_tsquery", "plainto_tsquery", "phraseto_tsquery", "websearch_to_tsquery", "ts_rewrite"]),
	ts_headline: tsHeadlineRule, // returns the document arg's type (text/json/jsonb) — pg_proc.dat
	ts_rank: fixed(F),
	ts_rank_cd: fixed(F),
	tsvector_to_array: fixed(SARR),
	numnode: fixed(I),
	querytree: fixed(S),
	strip: fixed(TSV),
	setweight: fixed(TSV),
	ts_lexize: fixed(SARR),
	ts_delete: fixed(TSV),
	ts_filter: fixed(TSV),
	length_tsvector: fixed(I),

	// --- XML — functions-xml.html ----------------------------------------------
	...group(fixed(XML), ["xmlcomment", "xmlconcat", "xmlelement", "xmlforest", "xmlpi", "xmlroot", "xmlparse"]),
	xmlserialize: fixed(S),
	xpath: fixed({ kind: "array", element: XML }),
	xpath_exists: fixed(B),
	xmlexists: fixed(B),

	// --- sequences — functions-sequence.html (Table 9.52) ----------------------
	nextval: fixed(BIG),
	currval: fixed(BIG),
	lastval: fixed(BIG),
	setval: fixed(BIG),

	// --- conditional — functions-conditional.html ------------------------------
	coalesce: common,
	nullif: firstArg,
	greatest: common,
	least: common,
	num_nonnulls: fixed(I),
	num_nulls: fixed(I),

	// --- system information — functions-info.html (Table 9.71+) ----------------
	...group(fixed(S), [
		"current_user",
		"session_user",
		"user",
		"current_role",
		"current_schema",
		"current_database",
		"current_catalog",
		"version",
		"pg_size_pretty",
		"pg_client_encoding",
		"current_setting",
		"format_type",
		"col_description",
		"obj_description",
		"shobj_description",
		"pg_get_userbyid",
		"pg_get_viewdef",
		"pg_get_indexdef",
		"pg_get_constraintdef",
		"pg_get_functiondef",
		"pg_get_expr",
	]),
	pg_backend_pid: fixed(I),
	pg_column_size: fixed(I),
	...group(fixed(BIG), [
		"pg_total_relation_size",
		"pg_relation_size",
		"pg_table_size",
		"pg_indexes_size",
		"pg_database_size",
		"pg_tablespace_size",
		"txid_current",
	]),
	pg_typeof: fixed(scalar("regtype")), // returns regtype, not text — pg_proc.dat
	...group(fixed(B), [
		"has_table_privilege",
		"has_column_privilege",
		"has_database_privilege",
		"has_function_privilege",
		"has_schema_privilege",
		"has_sequence_privilege",
		"has_any_column_privilege",
		"pg_has_role",
		"pg_is_in_recovery",
		"pg_is_other_temp_schema",
	]),
	pg_current_schemas: fixed(SARR),
	pg_postmaster_start_time: fixed(TS),
	pg_conf_load_time: fixed(TS),

	// --- comparison / row — functions-comparison.html ---------------------------
	// (operators handled structurally; row_to_json above; no additional names here)

	// --- geometric — functions-geometry.html (Table 9.36-9.38) ------------------
	...group(fixed(D), ["area", "diameter", "height", "radius", "slope", "width"]),
	...group(fixed(B), ["isclosed", "isopen"]),
	npoints: fixed(I),
	...group(fixed(scalar("point")), ["center", "point"]),
	...group(fixed(scalar("path")), ["pclose", "popen", "path"]),
	box: fixed(scalar("box")),
	bound_box: fixed(scalar("box")),
	circle: fixed(scalar("circle")),
	line: fixed(scalar("line")),
	lseg: fixed(scalar("lseg")),
	polygon: fixed(scalar("polygon")),
};
