import { commonType, widenSum } from "../infer/coerce.js";
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
	dateArg,
	elementOf,
	fixed,
	firstArg,
	group,
	mapKeys,
	mapValues,
	restCommon,
	type FnRule,
} from "../infer/functions.js";
import { parseType, scalar, UNKNOWN, type Type } from "../infer/types.js";
import { fold } from "./fold.js";

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

const BOOLEAN = scalar("boolean");

/** Databricks/Spark literal forms. */
export function databricksLiteral(text: string): Type {
	const t = text.trim();
	if (/^['"]/.test(t)) return scalar("string");
	if (/^(true|false)$/i.test(t)) return BOOLEAN;
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^date\s*'/i.test(t)) return scalar("date");
	if (/^timestamp\s*'/i.test(t)) return scalar("timestamp");
	if (/^interval\b/i.test(t)) return scalar("interval");
	if (/^[+-]?\d+$/.test(t)) return scalar("int");
	if (/^[+-]?(\d+\.\d*|\.\d+|\d+)([eed][+-]?\d+)?$/i.test(t) && /[.eed]/i.test(t)) return scalar("double");
	return UNKNOWN;
}

export function databricksParseType(text: string): Type {
	return parseType(text, undefined, fold);
}
