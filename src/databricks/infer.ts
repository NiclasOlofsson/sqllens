import { commonType, fullInterval, widenSum } from "../infer/coerce.js";
import {
	B,
	BIG,
	BIN,
	D,
	DATE,
	I,
	INTERVAL,
	S,
	TS,
	arrayOfCommon,
	arrayOfFirst,
	common,
	concatRule,
	elementOf,
	fixed,
	firstArg,
	group,
	mapKeys,
	mapValues,
	restCommon,
	type FnRule,
} from "../infer/functions.js";
import { intervalTypeOf, isIntervalName, parseType, scalar, UNKNOWN, type Type } from "../infer/types.js";
import type { Expr } from "../ir/ir.js";
import { fold } from "./fold.js";

const TINY = scalar("tinyint");
const SMALL = scalar("smallint");
const DEC = scalar("decimal");

/** CEIL/CEILING/FLOOR — sql-ref-functions ceil/floor: with a targetScale (2-arg form) the
 *  result is DECIMAL; a DECIMAL input stays DECIMAL (p-s+1, 0); any other numeric input
 *  returns BIGINT. Pinned externally by the v4.2.0 sql-tests goldens (ceil-floor-with-scale-param). */
const ceilFloor: FnRule = (args) => {
	if (args.length >= 2) return DEC;
	const a = args[0];
	if (!a || a.kind === "unknown") return UNKNOWN;
	return a.kind === "scalar" && a.name === "decimal" ? DEC : BIG;
};

/** positive()/negative() — the argument must be numeric or interval; a STRING argument is
 *  implicitly crosscast to DOUBLE, so the result follows the cast, not the string. */
const numericUnary: FnRule = (args) => {
	const a = args[0];
	if (!a) return UNKNOWN;
	if (a.kind === "scalar" && a.name === "string") return D;
	return a;
};

/** try_add/try_subtract mirror the `+`/`-` operators: interval ± interval keeps the family,
 *  widening to the UNION of the two operands' unit ranges (commonType). date/timestamp ± interval
 *  produces a DATE/TIMESTAMP whose flavor depends on the interval family — out of the interval-
 *  typing scope here and value/schema-shaped, so it stays unknown rather than a guess. Otherwise
 *  the common type. (spark IntervalAdd/Subtract; sql-ref-datatypes interval.) */
const isIntervalT = (a: Type | undefined) => a?.kind === "scalar" && isIntervalName(a.name);
const isDatelike = (a: Type | undefined) => a?.kind === "scalar" && (a.name === "date" || a.name === "timestamp");
const tryAddSub: FnRule = (args) => {
	if (args.some(isIntervalT)) {
		if (args.some(isDatelike)) return UNKNOWN;
		return commonType(args);
	}
	return commonType(args);
};
/** try_multiply mirrors `*`: interval × numeric returns the family's DEFAULT full range (Spark
 *  MultiplyYM/DTInterval always yield year-to-month / day-to-second). Otherwise the common type. */
const tryMul: FnRule = (args) => {
	const iv = args.find(isIntervalT);
	return iv ? fullInterval(iv) : commonType(args);
};

/** date_add/dateadd — TWO documented forms sharing the names: date_add(startDate, numDays)
 *  returns DATE; dateadd(unit, value, expr) (3-arg) returns TIMESTAMP. Arity decides. */
const dateAddRule: FnRule = (args) => (args.length >= 3 ? TS : DATE);

/** date_part/datepart return types key on the FIELD argument's VALUE and the SOURCE
 *  argument's TYPE, which the FnRule table (types only) cannot see — reached via the
 *  behavior `special` hook. Over a date/timestamp source (extract doc): second family →
 *  DECIMAL(8,6), the other documented fields → INT. Over an INTERVAL source the widths
 *  differ: month family → TINYINT and second family → DECIMAL (both pinned by the v4.2.0
 *  sql-tests goldens, extract.sql.out); other interval fields stay unknown until cited.
 *  A NULL field types DOUBLE (Spark's analyzer, same goldens). A non-literal field, or a
 *  source whose type we cannot resolve, is not statically known → unknown, never a guess. */
const SECOND_FIELDS = new Set(["second", "s", "sec", "seconds", "secs"]);
const MONTH_FIELDS = new Set(["month", "mon", "mons", "months"]);
const INT_FIELDS = new Set([
	"year",
	"y",
	"years",
	"yr",
	"yrs",
	"yearofweek",
	"quarter",
	"qtr",
	"month",
	"mon",
	"mons",
	"months",
	"week",
	"w",
	"weeks",
	"day",
	"d",
	"days",
	"dayofweek",
	"dow",
	"dayofweek_iso",
	"dow_iso",
	"doy",
	"hour",
	"h",
	"hours",
	"hr",
	"hrs",
	"minute",
	"m",
	"min",
	"mins",
	"minutes",
]);
export function databricksSpecial(
	fn: Extract<Expr, { kind: "function" }>,
	typeOf: (e: Expr) => Type,
): Type | undefined {
	const name = fold(fn.name);
	if (name !== "date_part" && name !== "datepart") return undefined;
	const f = fn.args[0];
	if (f?.kind !== "literal") return UNKNOWN;
	const raw = f.text.trim();
	if (/^null$/i.test(raw)) return D;
	const field = raw.replace(/^['"]|['"]$/g, "").toLowerCase();
	const src = fn.args[1] ? typeOf(fn.args[1]) : UNKNOWN;
	if (src.kind === "scalar" && isIntervalName(src.name)) {
		if (SECOND_FIELDS.has(field)) return DEC;
		if (MONTH_FIELDS.has(field)) return TINY;
		return UNKNOWN;
	}
	if (src.kind === "scalar" && (src.name === "date" || src.name === "timestamp" || src.name === "time")) {
		if (SECOND_FIELDS.has(field)) return DEC;
		if (INT_FIELDS.has(field)) return I;
	}
	return UNKNOWN;
}

// Function return-type registry for Databricks/Spark SQL, from the built-in function
// reference (the language spec — NOT the corpus; the corpus is only a validation gate). A
// rule is `(argTypes) => Type`. A function is absent (→ unknown) only when its return type is
// genuinely arg/lambda/schema-dependent in a way we don't model yet (transform, from_json,
// named_struct, …). We never guess: a missing rule yields `unknown`, never a wrong type.
//
// Why a rule is a *function* and not a fixed type string — and what each dialect calls a
// return-type-follows-input ("templated"/"polymorphic"/generic) function: docs/type-polymorphism.md.
export const DATABRICKS_FUNCTION_RETURNS: Record<string, FnRule> = {
	...group(fixed(S), [
		"concat_ws",
		"upper",
		"lower",
		"lcase",
		"ucase",
		"trim",
		"ltrim",
		"rtrim",
		"btrim",
		"lpad",
		"rpad",
		"substr",
		"substring",
		"substring_index",
		"replace",
		"translate",
		"repeat",
		"split_part",
		"chr",
		"char",
		"initcap",
		"overlay",
		"format_string",
		"format_number",
		"printf",
		"soundex",
		"space",
		"hex",
		"base64",
		"to_char",
		"to_varchar",
		"quote",
		"regexp_extract",
		"regexp_replace",
		"regexp_substr",
		"url_encode",
		"url_decode",
		"bin",
		"conv",
		"md5",
		"sha",
		"sha1",
		"sha2",
		"date_format",
		"dayname",
		"monthname",
		"to_json",
		"get_json_object",
		"string",
	]),
	// string_agg/listagg (sql-ref-functions listagg: "the datatype of the return is the same as the
	// datatype of expr if expr is BINARY type, otherwise STRING" — v4.2.0 goldens: listagg(CAST(col
	// AS BINARY)) -> binary, not string).
	...group(
		(args: Type[]) => (args[0]?.kind === "scalar" && args[0].name === "binary" ? BIN : S),
		["string_agg", "listagg"],
	),
	...group(fixed(I), [
		"ascii",
		"instr",
		"locate",
		"position",
		"find_in_set",
		"levenshtein",
		"length",
		"char_length",
		"character_length",
		"octet_length",
		"bit_length",
		"regexp_count",
		"regexp_instr",
		"day",
		"dayofmonth",
		"dayofweek",
		"dayofyear",
		"month",
		"year",
		"hour",
		"minute",
		"second",
		"quarter",
		"weekday",
		"weekofyear",
		"unix_date",
		"size",
		"array_size",
		"cardinality",
		"hash",
		"json_array_length",
		"int",
		"integer",
	]),
	// sign/signum return DOUBLE whatever the input (sql-ref sign). datediff/date_diff have two
	// forms: datediff(endDate, startDate) → INT, the unit form datediff(unit, start, end) →
	// BIGINT (timestampdiff likewise). Arity decides.
	...group(fixed(D), ["sign", "signum"]),
	...group((args) => (args.length >= 3 ? BIG : I), ["datediff", "date_diff"]),
	timestampdiff: fixed(BIG),
	// sql-ref: bit_get/getbit return TINYINT; the type-named cast functions return their type;
	// bit_count returns INT; array_position returns BIGINT (the 1-based position as a long).
	// date_part/datepart moved to the `special` hook (field-VALUE-dependent, see databricksSpecial).
	...group(fixed(TINY), ["bit_get", "getbit", "tinyint"]),
	smallint: fixed(SMALL),
	bit_count: fixed(I),
	array_position: fixed(BIG),
	...group(fixed(BIG), [
		"count",
		"count_if",
		"approx_count_distinct",
		"div",
		"bit_and",
		"bit_or",
		"bit_xor",
		"shiftrightunsigned",
		"width_bucket",
		"unix_timestamp",
		"unix_millis",
		"unix_micros",
		"unix_seconds",
		"crc32",
		"xxhash64",
		"bigint",
		"long",
	]),
	// avg — sql-ref: DECIMAL input stays DECIMAL, an interval WIDENS to its family's full range
	// (year-to-month / day-to-second — same fullInterval() promotion Multiply/DivideInterval already
	// use; v4.2.0 goldens: avg(interval month) -> interval year to month, avg(interval day/second) ->
	// interval day to second), else DOUBLE (v4.2.0 goldens: AVG over a decimal window column is
	// decimal, not double).
	...group(
		(args: Type[]) => {
			const a0 = args[0];
			if (a0?.kind !== "scalar") return D;
			if (a0.name === "decimal") return a0;
			if (isIntervalName(a0.name)) return fullInterval(a0);
			return D;
		},
		["avg", "try_avg", "mean"],
	),
	...group(fixed(D), [
		"sqrt",
		"cbrt",
		"exp",
		"expm1",
		"log",
		"ln",
		"log10",
		"log2",
		"log1p",
		"sin",
		"cos",
		"tan",
		"asin",
		"acos",
		"atan",
		"sinh",
		"cosh",
		"tanh",
		"asinh",
		"acosh",
		"atanh",
		"atan2",
		"degrees",
		"radians",
		"cot",
		"csc",
		"sec",
		"hypot",
		"pow",
		"power",
		"rand",
		"random",
		"randn",
		"pi",
		"e",
		"rint",
		"nanvl",
		"stddev",
		"std",
		"stddev_pop",
		"stddev_samp",
		"variance",
		"var_samp",
		"var_pop",
		"corr",
		"covar_pop",
		"covar_samp",
		"kurtosis",
		"skewness",
		"percentile",
		"percentile_cont",
		"approx_percentile",
		"median",
		"months_between",
		"double",
	]),
	...group(fixed(B), [
		"startswith",
		"endswith",
		"contains",
		"isnan",
		"isnull",
		"isnotnull",
		"array_contains",
		"arrays_overlap",
		"map_contains_key",
		"exists",
		"forall",
		"any",
		"bool_or",
		"bool_and",
		"every",
		"like",
		"rlike",
		"ilike",
		"boolean",
	]),
	...group(fixed(DATE), [
		"current_date",
		"curdate",
		"to_date",
		"date",
		"date_from_unix_date",
		"make_date",
		"next_day",
		"last_day",
		// trunc(expr, unit) is DATE-truncation only (sql-ref-functions/trunc: "Returns date with the
		// time portion of the day truncated..."; Databricks has no separate numeric-trunc overload,
		// unlike Oracle/Postgres) — always DATE regardless of expr's own type (v4.2.0 goldens:
		// trunc('2018-01-01', a) -> date, not the string argument's own type).
		"trunc",
	]),
	...group(fixed(TS), [
		"current_timestamp",
		"now",
		"to_timestamp",
		"to_timestamp_ltz",
		"to_timestamp_ntz",
		"make_timestamp",
		"make_timestamp_ltz",
		"make_timestamp_ntz",
		"timestamp_millis",
		"timestamp_micros",
		"timestamp_seconds",
		"from_utc_timestamp",
		"to_utc_timestamp",
		"convert_timezone",
		"localtimestamp",
		"date_trunc",
		"timestamp",
	]),
	...group(fixed(BIN), ["unhex", "unbase64", "encode", "to_binary", "binary"]),
	// make_interval(...) is the legacy CalendarIntervalType — Spark renders it bare `interval`.
	// make_ym_interval/make_dt_interval build a QUALIFIED ANSI interval of the family's full range
	// (sql-ref-functions: year-to-month / day-to-second). Pinned by the v4.2.0 goldens (interval.sql).
	make_interval: fixed(INTERVAL),
	make_ym_interval: fixed(scalar("interval year to month")),
	make_dt_interval: fixed(scalar("interval day to second")),
	float: fixed(scalar("float")),
	decimal: fixed(scalar("decimal")),

	// same type as input (numeric ops, ordering aggregates, array → array transforms)
	...group(firstArg, [
		"round",
		"bround",
		"mod",
		"pmod",
		"shiftleft",
		"shiftright",
		"min",
		"max",
		"first",
		"first_value",
		"last",
		"last_value",
		"nth_value",
		"max_by",
		"min_by",
		"any_value",
		"mode",
		// percentile_disc deliberately ABSENT: its result follows the WITHIN GROUP (ORDER BY)
		// operand, which is not in the arg list the rule sees — unknown, never the fraction's type.
		"nullif",
		"nullifzero",
		"reverse",
		"array_distinct",
		"array_union",
		"array_intersect",
		"array_except",
		"array_remove",
		"array_compact",
		"array_sort",
		"sort_array",
		"shuffle",
		"slice",
		"array_append",
		"array_prepend",
		"array_insert",
		"array_repeat",
		"filter",
	]),
	...group(common, ["coalesce", "ifnull", "nvl", "greatest", "least"]),
	...group(restCommon, ["if", "iff", "nvl2"]),
	sum: (args) => widenSum(args[0] ?? UNKNOWN),
	...group(ceilFloor, ["ceil", "ceiling", "floor"]),
	...group(numericUnary, ["positive", "negative", "abs"]),
	// zeroifnull(expr) = coalesce(expr, 0): the 0 is an INT literal, so the result is the
	// common type of the input and INT (a TINYINT input widens to INT — v4.2.0 goldens).
	zeroifnull: (args) => commonType([args[0] ?? UNKNOWN, I]),

	...group(arrayOfFirst, ["collect_list", "collect_set", "array_agg", "sequence", "range"]),
	array: arrayOfCommon,
	...group(fixed({ kind: "array", element: S }), ["split", "regexp_extract_all"]),
	...group(elementOf, ["array_max", "array_min", "element_at", "explode", "explode_outer", "get"]),
	map_keys: mapKeys,
	map_values: mapValues,
	concat: concatRule,

	// sql-ref: date_add(startDate, numDays)/date_sub/add_months return DATE whatever the
	// start's type; the unit-form dateadd(unit, value, expr)/timestampadd return TIMESTAMP.
	date_add: dateAddRule,
	dateadd: dateAddRule,
	date_sub: fixed(DATE),
	timestampadd: fixed(TS),
	add_months: fixed(DATE),

	// window/ranking — Spark's ranking functions return int (T-SQL's return bigint); the
	// value-returning analytics keep their argument's type.
	...group(fixed(I), ["row_number", "rank", "dense_rank", "ntile"]),
	...group(fixed(D), ["percent_rank", "cume_dist"]),
	...group(firstArg, ["lag", "lead"]),
	// string-returning system / session functions
	...group(fixed(S), [
		"current_user",
		"current_database",
		"current_schema",
		"current_catalog",
		"collation",
		"randstr",
		"uuid",
	]),
	factorial: fixed(BIG),
	bitmap_count: fixed(BIG),

	// ------------------------------------------------------------------
	// Entries below: return types fetched from the official Databricks
	// reference 2026-06-10 (the H3 / ST geospatial / AI / IP family pages
	// and per-function "Returns" sections). A function whose documented
	// return type depends on an argument VALUE (ai_query, from_avro,
	// extract, …) or whose page states no type stays absent → unknown.
	// ------------------------------------------------------------------

	// T-SQL-compat aliases Databricks documents
	...group(fixed(S), ["left", "right", "mask"]),
	len: fixed(I),
	charindex: fixed(I), // synonym of position/locate — "An INTEGER"
	getdate: fixed(TS), // synonym of current_timestamp

	// VARIANT family
	...group(fixed(scalar("variant")), ["parse_json", "try_parse_json", "to_variant_object"]),
	...group(fixed(S), ["schema_of_variant", "schema_of_variant_agg"]),
	is_variant_null: fixed(B),
	// variant_get(v, path) → VARIANT; the 3-arg form's type is named by a literal we
	// don't evaluate, so unknown.
	...group((args) => (args.length >= 3 ? UNKNOWN : scalar("variant")), ["variant_get", "try_variant_get"]),

	// schema/conversion helpers
	...group(fixed(S), ["schema_of_csv", "schema_of_json", "schema_of_json_agg", "schema_of_xml", "to_csv", "to_xml"]),
	json_object_keys: fixed({ kind: "array", element: S }),
	...group(fixed(scalar("decimal")), ["to_number", "try_to_number"]),
	...group(fixed(TS), ["parse_timestamp", "try_parse_timestamp"]),
	to_unix_timestamp: fixed(BIG),
	...group(fixed(BIN), [
		"aes_encrypt",
		"aes_decrypt",
		"try_aes_decrypt",
		"zstd_compress",
		"zstd_decompress",
		"try_zstd_decompress",
		"to_avro",
		"try_to_binary",
	]),

	// TIME type family (sql-ref-datatypes TIME)
	...group(fixed(scalar("time")), [
		"to_time",
		"try_to_time",
		"make_time",
		"current_time",
		"time_trunc",
		"time_from_micros",
		"time_from_millis",
		"time_from_seconds",
	]),
	...group(fixed(BIG), ["time_diff", "timediff", "time_to_micros", "time_to_millis"]),
	time_to_seconds: fixed(scalar("decimal")),

	// try_* arithmetic mirrors the base operators (NULL on error)
	...group(tryAddSub, ["try_add", "try_subtract"]),
	try_multiply: tryMul,
	try_mod: common,
	// try_divide mirrors `/`: interval ÷ numeric returns the family's DEFAULT full range (Spark
	// DivideInterval); a DECIMAL operand keeps the result DECIMAL unless a float/double operand is
	// involved; else DOUBLE (v4.2.0 goldens).
	try_divide: (args) => {
		if (isIntervalT(args[0])) return fullInterval(args[0] as Type);
		const approx = (a: Type | undefined) => a?.kind === "scalar" && (a.name === "double" || a.name === "float");
		const dec = (a: Type | undefined) => a?.kind === "scalar" && a.name === "decimal";
		if (!approx(args[0]) && !approx(args[1]) && (dec(args[0]) || dec(args[1]))) return DEC;
		return D;
	},
	try_sum: (args) => widenSum(args[0] ?? UNKNOWN),
	try_element_at: elementOf,

	// regression aggregates (regr_avgx/avgy: DECIMAL input stays decimal, else DOUBLE)
	regr_count: fixed(BIG),
	regr_avgx: (args) => (args[1]?.kind === "scalar" && args[1].name === "decimal" ? scalar("decimal") : D),
	regr_avgy: (args) => (args[0]?.kind === "scalar" && args[0].name === "decimal" ? scalar("decimal") : D),
	...group(fixed(D), ["regr_slope", "regr_intercept", "regr_r2", "regr_sxx", "regr_sxy", "regr_syy"]),

	// maps
	map_entries: (args) =>
		args[0]?.kind === "map"
			? {
					kind: "array",
					element: {
						kind: "struct",
						fields: [
							{ name: "key", type: args[0].key },
							{ name: "value", type: args[0].value },
						],
					},
				}
			: UNKNOWN,
	map_from_arrays: (args) => ({
		kind: "map",
		key: args[0]?.kind === "array" ? args[0].element : UNKNOWN,
		value: args[1]?.kind === "array" ? args[1].element : UNKNOWN,
	}),
	map_from_entries: (args) => {
		const e = args[0]?.kind === "array" ? args[0].element : UNKNOWN;
		return e.kind === "struct" && e.fields.length >= 2
			? { kind: "map", key: e.fields[0].type, value: e.fields[1].type }
			: UNKNOWN;
	},
	map_concat: common,
	map_filter: firstArg,
	str_to_map: fixed({ kind: "map", key: S, value: S }),

	// misc scalars
	...group(fixed(S), [
		"typeof",
		"parse_url",
		"make_valid_utf8",
		"validate_utf8",
		"try_validate_utf8",
		"version",
		"current_metastore",
		"current_timezone",
		"java_method",
		"reflect",
		"try_reflect",
		"array_join",
	]),
	...group(fixed(B), ["luhn_check", "equal_null", "is_valid_utf8", "is_account_group_member", "is_member", "some"]),
	flatten: (args) => (args[0]?.kind === "array" && args[0].element.kind === "array" ? args[0].element : UNKNOWN),
	// uniform(min, max [, seed]) → the common type of min and max; a NULL bound makes the
	// result value-dependent (Spark types it DOUBLE) → unknown rather than a guessed int.
	uniform: (args) =>
		args[0]?.kind === "unknown" || args[1]?.kind === "unknown" ? UNKNOWN : commonType(args.slice(0, 2)),
	// decode(expr, search1, result1, …[, default]) → least common type of the results
	decode: (args) => {
		if (args.length === 2) return S; // decode(binary, charset) overload
		const results: Type[] = [];
		for (let i = 2; i < args.length; i += 2) results.push(args[i]);
		if (args.length > 3 && (args.length - 1) % 2 === 1) results.push(args[args.length - 1]);
		return commonType(results);
	},
	elt: restCommon,
	percentile_approx: (args) =>
		args[1]?.kind === "array" ? { kind: "array", element: args[0] ?? UNKNOWN } : (args[0] ?? UNKNOWN),
	histogram_numeric: (args) => ({
		kind: "array",
		element: {
			kind: "struct",
			fields: [
				{ name: "x", type: args[0] ?? UNKNOWN },
				{ name: "y", type: D },
			],
		},
	}),
	...group(
		fixed({
			kind: "struct",
			fields: [
				{ name: "start", type: TS },
				{ name: "end", type: TS },
			],
		}),
		["window", "session_window"],
	),
	window_time: fixed(TS),
	http_request: fixed({
		kind: "struct",
		fields: [
			{ name: "status_code", type: I },
			{ name: "text", type: S },
		],
	}),
	...group(fixed(BIG), ["monotonically_increasing_id", "input_file_block_length", "input_file_block_start"]),
	input_file_name: fixed(S),

	// bitmaps
	...group(fixed(BIG), ["bitmap_bucket_number", "bitmap_bit_position"]),
	...group(fixed(BIN), ["bitmap_construct_agg", "bitmap_or_agg", "bitmap_and_agg"]),

	// H3 geospatial (sql-ref-h3-geospatial-functions)
	...group(fixed(BIG), ["h3_longlatash3", "h3_pointash3", "h3_stringtoh3"]),
	...group(fixed(S), [
		"h3_longlatash3string",
		"h3_pointash3string",
		"h3_h3tostring",
		"h3_boundaryasgeojson",
		"h3_boundaryaswkt",
		"h3_centerasgeojson",
		"h3_centeraswkt",
	]),
	...group(fixed(BIN), ["h3_boundaryaswkb", "h3_centeraswkb"]),
	...group(fixed(B), ["h3_ischildof", "h3_ispentagon", "h3_isvalid"]),
	...group(fixed({ kind: "array", element: BIG }), [
		"h3_coverash3",
		"h3_polyfillash3",
		"h3_try_coverash3",
		"h3_try_polyfillash3",
	]),
	...group(fixed({ kind: "array", element: S }), [
		"h3_coverash3string",
		"h3_polyfillash3string",
		"h3_try_coverash3string",
		"h3_try_polyfillash3string",
	]),
	// cell-id in → same cell-id type out (the family's BIGINT/STRING pairing)
	...group(firstArg, ["h3_validate", "h3_try_validate", "h3_compact", "h3_uncompact"]),
	...group(arrayOfFirst, ["h3_kring", "h3_hexring", "h3_tochildren"]),
	h3_kringdistances: (args) => ({
		kind: "array",
		element: {
			kind: "struct",
			fields: [
				{ name: "cellid", type: args[0] ?? UNKNOWN },
				{ name: "distance", type: I },
			],
		},
	}),

	// ST geospatial (sql-ref-st-geospatial-functions)
	...group(fixed(scalar("geography")), [
		"st_geogfromewkt",
		"st_geogfromgeojson",
		"st_geogfromtext",
		"st_geogfromwkb",
		"st_geogfromwkt",
		"to_geography",
		"try_to_geography",
	]),
	...group(fixed(scalar("geometry")), [
		"st_geomfromewkb",
		"st_geomfromewkt",
		"st_geomfromgeohash",
		"st_geomfromgeojson",
		"st_geomfromtext",
		"st_geomfromwkb",
		"st_geomfromwkt",
		"st_pointfromgeohash",
		"to_geometry",
		"try_to_geometry",
		"st_makeenvelope",
		"st_makeline",
		"st_makepoint",
		"st_makepolygon",
		"st_point",
		"st_envelope",
		"st_envelope_agg",
		"st_geometryn",
		"st_setsrid",
		"st_transform",
		"st_rotate",
		"st_scale",
		"st_translate",
		"st_flipcoordinates",
		"st_boundary",
		"st_buffer",
		"st_centroid",
		"st_closestpoint",
		"st_concavehull",
		"st_convexhull",
		"st_pointonsurface",
		"st_simplify",
		"st_difference",
		"st_intersection",
		"st_union",
		"st_union_agg",
	]),
	...group(fixed(BIN), ["st_asbinary", "st_asewkb", "st_aswkb"]),
	...group(fixed(S), ["st_asgeojson", "st_asewkt", "st_astext", "st_aswkt", "st_geohash", "st_geometrytype"]),
	...group(fixed(B), [
		"st_isempty",
		"st_isvalid",
		"st_dwithin",
		"st_contains",
		"st_covers",
		"st_disjoint",
		"st_equals",
		"st_intersects",
		"st_touches",
		"st_within",
	]),
	...group(fixed(I), ["st_npoints", "st_numpoints", "st_srid"]),
	st_area: fixed(D),
	st_collect: firstArg,
	st_dump: arrayOfFirst,
	// point/linestring accessors keep the input's GEOGRAPHY/GEOMETRY type
	...group(firstArg, [
		"st_endpoint",
		"st_startpoint",
		"st_pointn",
		"st_exteriorring",
		"st_interiorringn",
		"st_addpoint",
		"st_force2d",
		"st_multi",
		"st_removepoint",
		"st_reverse",
		"st_setpoint",
	]),

	// AI functions (ai-functions page); ai_classify/ai_extract/ai_query/ai_forecast are
	// argument-value-dependent → absent
	...group(fixed(S), [
		"ai_analyze_sentiment",
		"ai_fix_grammar",
		"ai_gen",
		"ai_generate_text",
		"ai_mask",
		"ai_summarize",
		"ai_translate",
	]),
	ai_similarity: fixed(scalar("float")),
	...group(fixed(scalar("variant")), ["ai_parse_document", "ai_prep_search"]),

	// IP functions (sql-ref-ip-functions)
	...group(fixed(BIN), ["ip_as_binary", "try_ip_as_binary"]),
	...group(fixed(S), ["ip_as_string", "try_ip_as_string"]),
	ip_cidr_contains: fixed(B),
	...group(fixed(I), ["ip_prefix_length", "ip_version"]),
	...group(firstArg, [
		"ip_cidr",
		"ip_host",
		"ip_network",
		"ip_network_first",
		"ip_network_last",
		"try_ip_cidr",
		"try_ip_host",
	]),
};

const BOOLEAN = scalar("boolean");

// Interval-literal unit words → [family, field]. family 0 = year-month (year<month), 1 = day-time
// (day<hour<minute<second). WEEK folds into DAY; MILLI/MICRO/NANOSECOND into SECOND (Databricks
// INTERVAL literal syntax; spark.apache.org/docs/latest/sql-ref-datatypes.html). Longest
// alternatives first so a whole word (microsecond) wins over its suffix (second).
const IV_UNIT_RE = /nanoseconds?|microseconds?|milliseconds?|seconds?|minutes?|hours?|days?|weeks?|months?|years?/gi;
const IV_UNIT_FIELD: Record<string, [number, number]> = {
	year: [0, 0],
	month: [0, 1],
	week: [1, 0],
	day: [1, 0],
	hour: [1, 1],
	minute: [1, 2],
	second: [1, 3],
	millisecond: [1, 3],
	microsecond: [1, 3],
	nanosecond: [1, 3],
};
const IV_FIELD_NAMES: readonly (readonly string[])[] = [
	["year", "month"],
	["day", "hour", "minute", "second"],
];

/** A Spark/Databricks INTERVAL literal → its qualified ANSI type, derived from the unit words the
 *  literal carries. Covers all three spellings — ANSI qualifier (`interval '2-1' year to month`),
 *  multi-unit (`interval 2 day 3 hour`), and string-form (`interval '1 day'`, units inside the
 *  quotes) — because in every one the unit words are letters and the numeric values carry none.
 *  from = the lowest-order field present, to = the highest. Mixed families or no unit word → bare
 *  `interval` (the honest coarse fallback, never a guess). */
function intervalLiteralType(text: string): Type {
	let family: number | undefined;
	let lo = Number.POSITIVE_INFINITY;
	let hi = Number.NEGATIVE_INFINITY;
	for (const m of text.matchAll(IV_UNIT_RE)) {
		const spec = IV_UNIT_FIELD[m[0].toLowerCase().replace(/s$/, "")];
		if (!spec) continue;
		const [fam, field] = spec;
		if (family === undefined) family = fam;
		else if (family !== fam) return scalar("interval"); // mixed families (invalid) → bare
		lo = Math.min(lo, field);
		hi = Math.max(hi, field);
	}
	return family === undefined ? scalar("interval") : intervalTypeOf(IV_FIELD_NAMES[family], lo, hi);
}

/** Databricks/Spark literal forms. */
export function databricksLiteral(text: string): Type {
	const t = text.trim();
	if (/^['"]/.test(t)) return scalar("string");
	if (/^(true|false)$/i.test(t)) return BOOLEAN;
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^date\s*'/i.test(t)) return scalar("date");
	if (/^timestamp(_ntz|_ltz)?\s*'/i.test(t)) return scalar("timestamp");
	// The CST's getText() concatenates tokens without whitespace, so the unquoted multi-token
	// form arrives as `interval2year` — no word boundary after the keyword. Derive the qualified
	// ANSI interval type (interval year to month / interval day to second / …) from the unit words.
	if (/^interval/i.test(t)) return intervalLiteralType(t);
	// Integral literals size by magnitude: INT when it fits, else BIGINT, else DECIMAL(38,0)
	// (sql-ref-literals; `9223372036854775808` is DECIMAL — v4.2.0 goldens, literals.sql.out).
	if (/^[+-]?\d+$/.test(t)) {
		const v = BigInt(t);
		if (v >= -2147483648n && v <= 2147483647n) return scalar("int");
		if (v >= -9223372036854775808n && v <= 9223372036854775807n) return BIG;
		return DEC;
	}
	// Numeric literal forms + suffixes (sql-ref-literals): L → BIGINT, S → SMALLINT,
	// Y → TINYINT, BD → DECIMAL, F → FLOAT, D → DOUBLE, an exponent → DOUBLE, and a bare
	// decimal point → DECIMAL (2.5 is DECIMAL(2,1), NOT double — v4.2.0 goldens agree).
	if (/^[+-]?\d+l$/i.test(t)) return BIG;
	if (/^[+-]?\d+s$/i.test(t)) return SMALL;
	if (/^[+-]?\d+y$/i.test(t)) return TINY;
	if (/^[+-]?(\d+\.?\d*|\.\d+)bd$/i.test(t)) return DEC;
	if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?f$/i.test(t)) return scalar("float");
	if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?d$/i.test(t)) return D;
	if (/^[+-]?(\d+\.?\d*|\.\d+)e[+-]?\d+$/i.test(t)) return D;
	if (/^[+-]?(\d+\.\d*|\.\d+)$/.test(t)) return DEC;
	return UNKNOWN;
}

export function databricksParseType(text: string): Type {
	return parseType(text, undefined, fold);
}
