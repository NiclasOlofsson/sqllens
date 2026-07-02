import type { Expr } from "../ir/ir.js";
import { commonType, widenSum } from "./coerce.js";
import { parseType, scalar, TSQL_ALIASES, UNKNOWN, type Type } from "./types.js";

// Function return-type registry for Databricks/Spark SQL, from the built-in function
// reference (the language spec — NOT the corpus; the corpus is only a validation gate). A
// rule is `(argTypes) => Type`. A function is absent (→ unknown) only when its return type is
// genuinely arg/lambda/schema-dependent in a way we don't model yet (transform, from_json,
// named_struct, …). We never guess: a missing rule yields `unknown`, never a wrong type.
//
// Why a rule is a *function* and not a fixed type string — and what each dialect calls a
// return-type-follows-input ("templated"/"polymorphic"/generic) function: docs/type-polymorphism.md.

export type FnRule = (args: Type[]) => Type;

const S = scalar("string");
const I = scalar("int");
const BIG = scalar("bigint");
const D = scalar("double");
const B = scalar("boolean");
const DATE = scalar("date");
const TS = scalar("timestamp");
const BIN = scalar("binary");
const INTERVAL = scalar("interval");

const fixed =
	(t: Type): FnRule =>
	() =>
		t;
const firstArg: FnRule = (args) => args[0] ?? UNKNOWN; // "same type as input"
const common: FnRule = (args) => commonType(args);
const restCommon: FnRule = (args) => commonType(args.slice(1)); // if(cond,a,b) / nvl2(x,a,b)
const arrayOfFirst: FnRule = (args) => ({ kind: "array", element: args[0] ?? UNKNOWN });
const arrayOfCommon: FnRule = (args) => ({ kind: "array", element: commonType(args) });
const elementOf: FnRule = (args) => {
	const a = args[0];
	if (a?.kind === "array") return a.element;
	if (a?.kind === "map") return a.value;
	return UNKNOWN;
};
const mapKeys: FnRule = (args) => (args[0]?.kind === "map" ? { kind: "array", element: args[0].key } : UNKNOWN);
const mapValues: FnRule = (args) => (args[0]?.kind === "map" ? { kind: "array", element: args[0].value } : UNKNOWN);
const concatRule: FnRule = (args) => (args[0]?.kind === "array" ? args[0] : S); // string|array overload
/** date_add(unit, n, ts) / dateadd / timestampadd → the date/timestamp argument's type. */
const dateArg: FnRule = (args) => {
	const last = args[args.length - 1];
	return last?.kind === "scalar" && (last.name === "date" || last.name === "timestamp") ? last : TS;
};

function group(rule: FnRule, names: string[]): Record<string, FnRule> {
	return Object.fromEntries(names.map((n) => [n, rule]));
}

export const FUNCTION_RETURNS: Record<string, FnRule> = {
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
		"string_agg",
		"listagg",
		"to_json",
		"get_json_object",
		"string",
	]),
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
		"sign",
		"signum",
		"bit_get",
		"getbit",
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
		"array_position",
		"hash",
		"json_array_length",
		"datediff",
		"date_diff",
		"date_part",
		"datepart",
		"int",
		"integer",
		"tinyint",
		"smallint",
	]),
	...group(fixed(BIG), [
		"count",
		"count_if",
		"approx_count_distinct",
		"div",
		"bit_count",
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
	...group(fixed(D), [
		"avg",
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
	...group(fixed(INTERVAL), ["make_interval", "make_ym_interval", "make_dt_interval"]),
	float: fixed(scalar("float")),
	decimal: fixed(scalar("decimal")),

	// same type as input (numeric ops, ordering aggregates, array → array transforms)
	...group(firstArg, [
		"abs",
		"negative",
		"positive",
		"ceil",
		"ceiling",
		"floor",
		"round",
		"bround",
		"trunc",
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
		"percentile_disc",
		"nullif",
		"nullifzero",
		"zeroifnull",
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

	...group(arrayOfFirst, ["collect_list", "collect_set", "array_agg", "sequence", "range"]),
	array: arrayOfCommon,
	...group(fixed({ kind: "array", element: S }), ["split", "regexp_extract_all"]),
	...group(elementOf, ["array_max", "array_min", "element_at", "explode", "explode_outer", "get"]),
	map_keys: mapKeys,
	map_values: mapValues,
	concat: concatRule,

	...group(dateArg, ["date_add", "dateadd", "date_sub", "timestampadd", "add_months"]),

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
	getbit: fixed(I),

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
	...group(common, ["try_add", "try_subtract", "try_multiply", "try_mod"]),
	try_divide: (args) => (args[0]?.kind === "scalar" && args[0].name === "interval" ? args[0] : D),
	try_sum: (args) => widenSum(args[0] ?? UNKNOWN),
	try_avg: fixed(D),
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
	uniform: (args) => commonType(args.slice(0, 2)),
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
