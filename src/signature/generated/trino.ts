// GENERATED — do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// Source: trinodb/trino release 482  vendor/trino-docs/functions/*.md (MyST `:::{function}` directives)
// Harvested 2026-07-14. 363 signatures. Curated FUNCTION_SIGNATURES override these.
import type { FnSignature } from "../signatures.js";

/** Harvested (doc-syntax-derived) parameter signatures for trino, keyed by lowercased name. */
export const TRINO_HARVESTED: Record<string, FnSignature> = {
	abs: { name: "abs", params: [{ name: "x" }] }, // math.md
	acos: { name: "acos", params: [{ name: "x" }] }, // math.md
	ai_analyze_sentiment: { name: "ai_analyze_sentiment", params: [{ name: "text" }] }, // ai.md
	ai_classify: { name: "ai_classify", params: [{ name: "text" }, { name: "labels" }] }, // ai.md
	ai_extract: { name: "ai_extract", params: [{ name: "text" }, { name: "labels" }] }, // ai.md
	ai_fix_grammar: { name: "ai_fix_grammar", params: [{ name: "text" }] }, // ai.md
	ai_gen: { name: "ai_gen", params: [{ name: "prompt" }] }, // ai.md
	ai_mask: { name: "ai_mask", params: [{ name: "text" }, { name: "labels" }] }, // ai.md
	ai_translate: { name: "ai_translate", params: [{ name: "text" }, { name: "language" }] }, // ai.md
	any_value: { name: "any_value", params: [{ name: "x" }] }, // aggregate.md
	approx_distinct: { name: "approx_distinct", params: [{ name: "x" }, { name: "e", optional: true }] }, // aggregate.md
	approx_most_frequent: {
		name: "approx_most_frequent",
		params: [{ name: "buckets" }, { name: "value" }, { name: "capacity" }],
	}, // aggregate.md
	approx_set: { name: "approx_set", params: [{ name: "x" }] }, // aggregate.md
	arbitrary: { name: "arbitrary", params: [{ name: "x" }] }, // aggregate.md
	array_agg: { name: "array_agg", params: [{ name: "x" }] }, // aggregate.md
	array_distinct: { name: "array_distinct", params: [{ name: "x" }] }, // array.md
	array_except: { name: "array_except", params: [{ name: "x" }, { name: "y" }] }, // array.md
	array_histogram: { name: "array_histogram", params: [{ name: "x" }] }, // array.md
	array_intersect: { name: "array_intersect", params: [{ name: "x" }, { name: "y" }] }, // array.md
	array_join: {
		name: "array_join",
		params: [{ name: "x" }, { name: "delimiter" }, { name: "null_replacement", optional: true }],
	}, // array.md
	array_max: { name: "array_max", params: [{ name: "x" }] }, // array.md
	array_min: { name: "array_min", params: [{ name: "x" }] }, // array.md
	array_position: { name: "array_position", params: [{ name: "x" }, { name: "element" }] }, // array.md
	array_remove: { name: "array_remove", params: [{ name: "x" }, { name: "element" }] }, // array.md
	array_sort: { name: "array_sort", params: [{ name: "x" }] }, // array.md
	array_union: { name: "array_union", params: [{ name: "x" }, { name: "y" }] }, // array.md
	arrays_overlap: { name: "arrays_overlap", params: [{ name: "x" }, { name: "y" }] }, // array.md
	asin: { name: "asin", params: [{ name: "x" }] }, // math.md
	at_timezone: { name: "at_timezone", params: [{ name: "x" }, { name: "zone" }] }, // datetime.md
	atan: { name: "atan", params: [{ name: "x" }] }, // math.md
	atan2: { name: "atan2", params: [{ name: "y" }, { name: "x" }] }, // math.md
	bar: {
		name: "bar",
		params: [
			{ name: "x" },
			{ name: "width" },
			{ name: "low_color", optional: true },
			{ name: "high_color", optional: true },
		],
	}, // color.md
	beta_cdf: { name: "beta_cdf", params: [{ name: "a" }, { name: "b" }, { name: "v" }] }, // math.md
	bing_tile_at: {
		name: "bing_tile_at",
		params: [{ name: "latitude" }, { name: "longitude" }, { name: "zoom_level" }],
	}, // geospatial.md
	bing_tile_coordinates: { name: "bing_tile_coordinates", params: [{ name: "tile" }] }, // geospatial.md
	bing_tile_polygon: { name: "bing_tile_polygon", params: [{ name: "tile" }] }, // geospatial.md
	bing_tile_quadkey: { name: "bing_tile_quadkey", params: [{ name: "tile" }] }, // geospatial.md
	bing_tile_zoom_level: { name: "bing_tile_zoom_level", params: [{ name: "tile" }] }, // geospatial.md
	bing_tiles_around: {
		name: "bing_tiles_around",
		params: [
			{ name: "latitude" },
			{ name: "longitude" },
			{ name: "zoom_level" },
			{ name: "radius_in_km", optional: true },
		],
	}, // geospatial.md
	bit_count: { name: "bit_count", params: [{ name: "x" }, { name: "bits" }] }, // bitwise.md
	bitwise_and: { name: "bitwise_and", params: [{ name: "x" }, { name: "y" }] }, // bitwise.md
	bitwise_and_agg: { name: "bitwise_and_agg", params: [{ name: "x" }] }, // aggregate.md
	bitwise_left_shift: { name: "bitwise_left_shift", params: [{ name: "value" }, { name: "shift" }] }, // bitwise.md
	bitwise_not: { name: "bitwise_not", params: [{ name: "x" }] }, // bitwise.md
	bitwise_or: { name: "bitwise_or", params: [{ name: "x" }, { name: "y" }] }, // bitwise.md
	bitwise_or_agg: { name: "bitwise_or_agg", params: [{ name: "x" }] }, // aggregate.md
	bitwise_right_shift: { name: "bitwise_right_shift", params: [{ name: "value" }, { name: "shift" }] }, // bitwise.md
	bitwise_right_shift_arithmetic: {
		name: "bitwise_right_shift_arithmetic",
		params: [{ name: "value" }, { name: "shift" }],
	}, // bitwise.md
	bitwise_xor: { name: "bitwise_xor", params: [{ name: "x" }, { name: "y" }] }, // bitwise.md
	bitwise_xor_agg: { name: "bitwise_xor_agg", params: [{ name: "x" }] }, // aggregate.md
	bool_and: { name: "bool_and", params: [{ name: "boolean" }] }, // aggregate.md
	bool_or: { name: "bool_or", params: [{ name: "boolean" }] }, // aggregate.md
	cbrt: { name: "cbrt", params: [{ name: "x" }] }, // math.md
	ceil: { name: "ceil", params: [{ name: "x" }] }, // math.md
	ceiling: { name: "ceiling", params: [{ name: "x" }] }, // math.md
	char2hexint: { name: "char2hexint", params: [{ name: "string" }] }, // teradata.md
	checksum: { name: "checksum", params: [{ name: "x" }] }, // aggregate.md
	chr: { name: "chr", params: [{ name: "n" }] }, // string.md
	classify: { name: "classify", params: [{ name: "features" }, { name: "model" }] }, // ml.md
	coalesce: { name: "coalesce", params: [{ name: "value1" }, { name: "value2" }], variadic: true }, // conditional.md
	codepoint: { name: "codepoint", params: [{ name: "string" }] }, // string.md
	contains_sequence: { name: "contains_sequence", params: [{ name: "x" }, { name: "seq" }] }, // array.md
	convex_hull_agg: { name: "convex_hull_agg", params: [{ name: "Geometry" }] }, // geospatial.md
	corr: { name: "corr", params: [{ name: "y" }, { name: "x" }] }, // aggregate.md
	cos: { name: "cos", params: [{ name: "x" }] }, // math.md
	cosh: { name: "cosh", params: [{ name: "x" }] }, // math.md
	cosine_distance: { name: "cosine_distance", params: [{ name: "x" }, { name: "y" }] }, // math.md
	cosine_similarity: { name: "cosine_similarity", params: [{ name: "x" }, { name: "y" }] }, // math.md
	count: { name: "count", params: [{ name: "x" }] }, // aggregate.md
	count_if: { name: "count_if", params: [{ name: "x" }] }, // aggregate.md
	covar_pop: { name: "covar_pop", params: [{ name: "y" }, { name: "x" }] }, // aggregate.md
	covar_samp: { name: "covar_samp", params: [{ name: "y" }, { name: "x" }] }, // aggregate.md
	crc32: { name: "crc32", params: [{ name: "binary" }] }, // binary.md
	cume_dist: { name: "cume_dist", params: [] }, // window.md
	current_timezone: { name: "current_timezone", params: [] }, // datetime.md
	date: { name: "date", params: [{ name: "x" }] }, // datetime.md
	date_add: { name: "date_add", params: [{ name: "unit" }, { name: "value" }, { name: "timestamp" }] }, // datetime.md
	date_diff: { name: "date_diff", params: [{ name: "unit" }, { name: "timestamp1" }, { name: "timestamp2" }] }, // datetime.md
	date_format: { name: "date_format", params: [{ name: "timestamp" }, { name: "format" }] }, // datetime.md
	date_trunc: { name: "date_trunc", params: [{ name: "unit" }, { name: "x" }] }, // datetime.md
	day: { name: "day", params: [{ name: "x" }] }, // datetime.md
	day_of_month: { name: "day_of_month", params: [{ name: "x" }] }, // datetime.md
	day_of_week: { name: "day_of_week", params: [{ name: "x" }] }, // datetime.md
	day_of_year: { name: "day_of_year", params: [{ name: "x" }] }, // datetime.md
	degrees: { name: "degrees", params: [{ name: "x" }] }, // math.md
	dense_rank: { name: "dense_rank", params: [] }, // window.md
	dow: { name: "dow", params: [{ name: "x" }] }, // datetime.md
	doy: { name: "doy", params: [{ name: "x" }] }, // datetime.md
	e: { name: "e", params: [] }, // math.md
	empty_approx_set: { name: "empty_approx_set", params: [] }, // hyperloglog.md
	ends_with: { name: "ends_with", params: [{ name: "string" }, { name: "substring" }] }, // string.md
	every: { name: "every", params: [{ name: "boolean" }] }, // aggregate.md
	exp: { name: "exp", params: [{ name: "x" }] }, // math.md
	features: { name: "features", params: [{ name: "double" }], variadic: true }, // ml.md
	first_value: { name: "first_value", params: [{ name: "x" }] }, // window.md
	flatten: { name: "flatten", params: [{ name: "x" }] }, // array.md
	floor: { name: "floor", params: [{ name: "x" }] }, // math.md
	format: { name: "format", params: [{ name: "format" }, { name: "args" }], variadic: true }, // conversion.md
	format_datetime: { name: "format_datetime", params: [{ name: "timestamp" }, { name: "format" }] }, // datetime.md
	format_number: { name: "format_number", params: [{ name: "number" }] }, // conversion.md
	from_base: { name: "from_base", params: [{ name: "string" }, { name: "radix" }] }, // math.md
	from_base32: { name: "from_base32", params: [{ name: "string" }] }, // binary.md
	from_base64: { name: "from_base64", params: [{ name: "string" }] }, // binary.md
	from_base64url: { name: "from_base64url", params: [{ name: "string" }] }, // binary.md
	from_big_endian_32: { name: "from_big_endian_32", params: [{ name: "binary" }] }, // binary.md
	from_big_endian_64: { name: "from_big_endian_64", params: [{ name: "binary" }] }, // binary.md
	from_encoded_polyline: { name: "from_encoded_polyline", params: [{ name: "varchar" }] }, // geospatial.md
	from_geojson_geometry: { name: "from_geojson_geometry", params: [{ name: "varchar" }] }, // geospatial.md
	from_hex: { name: "from_hex", params: [{ name: "string" }] }, // binary.md
	from_ieee754_32: { name: "from_ieee754_32", params: [{ name: "binary" }] }, // binary.md
	from_ieee754_64: { name: "from_ieee754_64", params: [{ name: "binary" }] }, // binary.md
	from_iso8601_date: { name: "from_iso8601_date", params: [{ name: "string" }] }, // datetime.md
	from_iso8601_timestamp: { name: "from_iso8601_timestamp", params: [{ name: "string" }] }, // datetime.md
	from_iso8601_timestamp_nanos: { name: "from_iso8601_timestamp_nanos", params: [{ name: "string" }] }, // datetime.md
	from_unixtime_nanos: { name: "from_unixtime_nanos", params: [{ name: "unixtime" }] }, // datetime.md
	from_utf8: { name: "from_utf8", params: [{ name: "binary" }, { name: "replace", optional: true }] }, // string.md
	geometric_mean: { name: "geometric_mean", params: [{ name: "x" }] }, // aggregate.md
	geometry_from_hadoop_shape: { name: "geometry_from_hadoop_shape", params: [{ name: "varbinary" }] }, // geospatial.md
	geometry_invalid_reason: { name: "geometry_invalid_reason", params: [{ name: "Geometry" }] }, // geospatial.md
	geometry_nearest_points: {
		name: "geometry_nearest_points",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
	}, // geospatial.md
	geometry_to_bing_tiles: { name: "geometry_to_bing_tiles", params: [{ name: "geometry" }, { name: "zoom_level" }] }, // geospatial.md
	geometry_union_agg: { name: "geometry_union_agg", params: [{ name: "Geometry" }] }, // geospatial.md
	great_circle_distance: {
		name: "great_circle_distance",
		params: [{ name: "latitude1" }, { name: "longitude1" }, { name: "latitude2" }, { name: "longitude2" }],
	}, // geospatial.md
	hamming_distance: { name: "hamming_distance", params: [{ name: "string1" }, { name: "string2" }] }, // string.md
	hash_counts: { name: "hash_counts", params: [{ name: "x" }] }, // setdigest.md
	histogram: { name: "histogram", params: [{ name: "x" }] }, // aggregate.md
	hmac_md5: { name: "hmac_md5", params: [{ name: "binary" }, { name: "key" }] }, // binary.md
	hmac_sha1: { name: "hmac_sha1", params: [{ name: "binary" }, { name: "key" }] }, // binary.md
	hmac_sha256: { name: "hmac_sha256", params: [{ name: "binary" }, { name: "key" }] }, // binary.md
	hmac_sha512: { name: "hmac_sha512", params: [{ name: "binary" }, { name: "key" }] }, // binary.md
	hour: { name: "hour", params: [{ name: "x" }] }, // datetime.md
	human_readable_seconds: { name: "human_readable_seconds", params: [{ name: "double" }] }, // datetime.md
	if: {
		name: "if",
		params: [{ name: "condition" }, { name: "true_value" }, { name: "false_value", optional: true }],
	}, // conditional.md
	index: { name: "index", params: [{ name: "string" }, { name: "substring" }] }, // teradata.md
	infinity: { name: "infinity", params: [] }, // math.md
	intersection_cardinality: { name: "intersection_cardinality", params: [{ name: "x" }, { name: "y" }] }, // setdigest.md
	inverse_beta_cdf: { name: "inverse_beta_cdf", params: [{ name: "a" }, { name: "b" }, { name: "p" }] }, // math.md
	inverse_normal_cdf: { name: "inverse_normal_cdf", params: [{ name: "mean" }, { name: "sd" }, { name: "p" }] }, // math.md
	is_finite: { name: "is_finite", params: [{ name: "x" }] }, // math.md
	is_infinite: { name: "is_infinite", params: [{ name: "x" }] }, // math.md
	is_json_scalar: { name: "is_json_scalar", params: [{ name: "json" }] }, // json.md
	is_nan: { name: "is_nan", params: [{ name: "x" }] }, // math.md
	jaccard_index: { name: "jaccard_index", params: [{ name: "x" }, { name: "y" }] }, // setdigest.md
	json_array_contains: { name: "json_array_contains", params: [{ name: "json" }, { name: "value" }] }, // json.md
	json_array_get: { name: "json_array_get", params: [{ name: "json_array" }, { name: "index" }] }, // json.md
	json_array_length: { name: "json_array_length", params: [{ name: "json" }] }, // json.md
	json_extract: { name: "json_extract", params: [{ name: "json" }, { name: "json_path" }] }, // json.md
	json_extract_scalar: { name: "json_extract_scalar", params: [{ name: "json" }, { name: "json_path" }] }, // json.md
	json_format: { name: "json_format", params: [{ name: "json" }] }, // json.md
	json_parse: { name: "json_parse", params: [{ name: "string" }] }, // json.md
	json_size: { name: "json_size", params: [{ name: "json" }, { name: "json_path" }] }, // json.md
	kurtosis: { name: "kurtosis", params: [{ name: "x" }] }, // aggregate.md
	lag: {
		name: "lag",
		params: [{ name: "x" }, { name: "offset", optional: true }, { name: "default_value", optional: true }],
	}, // window.md
	last_day_of_month: { name: "last_day_of_month", params: [{ name: "x" }] }, // datetime.md
	last_value: { name: "last_value", params: [{ name: "x" }] }, // window.md
	lead: {
		name: "lead",
		params: [{ name: "x" }, { name: "offset", optional: true }, { name: "default_value", optional: true }],
	}, // window.md
	learn_classifier: { name: "learn_classifier", params: [{ name: "label" }, { name: "features" }] }, // ml.md
	learn_libsvm_classifier: {
		name: "learn_libsvm_classifier",
		params: [{ name: "label" }, { name: "features" }, { name: "params" }],
	}, // ml.md
	learn_libsvm_regressor: {
		name: "learn_libsvm_regressor",
		params: [{ name: "target" }, { name: "features" }, { name: "params" }],
	}, // ml.md
	learn_regressor: { name: "learn_regressor", params: [{ name: "target" }, { name: "features" }] }, // ml.md
	levenshtein_distance: { name: "levenshtein_distance", params: [{ name: "string1" }, { name: "string2" }] }, // string.md
	line_interpolate_point: { name: "line_interpolate_point", params: [{ name: "LineString" }, { name: "double" }] }, // geospatial.md
	line_interpolate_points: {
		name: "line_interpolate_points",
		params: [{ name: "LineString" }, { name: "double" }, { name: "repeated" }],
	}, // geospatial.md
	line_locate_point: { name: "line_locate_point", params: [{ name: "LineString" }, { name: "Point" }] }, // geospatial.md
	listagg: { name: "listagg", params: [{ name: "x" }, { name: "separator" }] }, // aggregate.md
	ln: { name: "ln", params: [{ name: "x" }] }, // math.md
	log: { name: "log", params: [{ name: "b" }, { name: "x" }] }, // math.md
	log10: { name: "log10", params: [{ name: "x" }] }, // math.md
	log2: { name: "log2", params: [{ name: "x" }] }, // math.md
	lower: { name: "lower", params: [{ name: "string" }] }, // string.md
	ltrim: { name: "ltrim", params: [{ name: "string" }] }, // string.md
	luhn_check: { name: "luhn_check", params: [{ name: "string" }] }, // string.md
	make_set_digest: { name: "make_set_digest", params: [{ name: "x" }] }, // setdigest.md
	map: { name: "map", params: [] }, // map.md
	map_agg: { name: "map_agg", params: [{ name: "key" }, { name: "value" }] }, // aggregate.md
	max: { name: "max", params: [{ name: "x" }, { name: "n", optional: true }] }, // aggregate.md
	max_by: { name: "max_by", params: [{ name: "x" }, { name: "y" }, { name: "n", optional: true }] }, // aggregate.md
	md5: { name: "md5", params: [{ name: "binary" }] }, // binary.md
	merge_set_digest: { name: "merge_set_digest", params: [{ name: "setdigest" }] }, // setdigest.md
	millisecond: { name: "millisecond", params: [{ name: "x" }] }, // datetime.md
	min: { name: "min", params: [{ name: "x" }, { name: "n", optional: true }] }, // aggregate.md
	min_by: { name: "min_by", params: [{ name: "x" }, { name: "y" }, { name: "n", optional: true }] }, // aggregate.md
	minute: { name: "minute", params: [{ name: "x" }] }, // datetime.md
	mod: { name: "mod", params: [{ name: "n" }, { name: "m" }] }, // math.md
	month: { name: "month", params: [{ name: "x" }] }, // datetime.md
	multimap_agg: { name: "multimap_agg", params: [{ name: "key" }, { name: "value" }] }, // aggregate.md
	murmur3: { name: "murmur3", params: [{ name: "binary" }] }, // binary.md
	nan: { name: "nan", params: [] }, // math.md
	normal_cdf: { name: "normal_cdf", params: [{ name: "mean" }, { name: "sd" }, { name: "v" }] }, // math.md
	normalize: { name: "normalize", params: [{ name: "string" }, { name: "form", optional: true }] }, // string.md
	now: { name: "now", params: [] }, // datetime.md
	nth_value: { name: "nth_value", params: [{ name: "x" }, { name: "offset" }] }, // window.md
	ntile: { name: "ntile", params: [{ name: "n" }] }, // window.md
	nullif: { name: "nullif", params: [{ name: "value1" }, { name: "value2" }] }, // conditional.md
	numeric_histogram: {
		name: "numeric_histogram",
		params: [{ name: "buckets" }, { name: "value" }, { name: "weight", optional: true }],
	}, // aggregate.md
	parse_data_size: { name: "parse_data_size", params: [{ name: "string" }] }, // conversion.md
	parse_datetime: { name: "parse_datetime", params: [{ name: "string" }, { name: "format" }] }, // datetime.md
	parse_duration: { name: "parse_duration", params: [{ name: "string" }] }, // datetime.md
	percent_rank: { name: "percent_rank", params: [] }, // window.md
	pi: { name: "pi", params: [] }, // math.md
	pow: { name: "pow", params: [{ name: "x" }, { name: "p" }] }, // math.md
	power: { name: "power", params: [{ name: "x" }, { name: "p" }] }, // math.md
	qdigest_agg: {
		name: "qdigest_agg",
		params: [{ name: "x" }, { name: "w", optional: true }, { name: "accuracy", optional: true }],
	}, // aggregate.md
	quarter: { name: "quarter", params: [{ name: "x" }] }, // datetime.md
	radians: { name: "radians", params: [{ name: "x" }] }, // math.md
	rand: { name: "rand", params: [] }, // math.md
	rank: { name: "rank", params: [] }, // window.md
	regexp_count: { name: "regexp_count", params: [{ name: "string" }, { name: "pattern" }] }, // regexp.md
	regexp_extract: {
		name: "regexp_extract",
		params: [{ name: "string" }, { name: "pattern" }, { name: "group", optional: true }],
	}, // regexp.md
	regexp_extract_all: {
		name: "regexp_extract_all",
		params: [{ name: "string" }, { name: "pattern" }, { name: "group", optional: true }],
	}, // regexp.md
	regexp_like: { name: "regexp_like", params: [{ name: "string" }, { name: "pattern" }] }, // regexp.md
	regexp_position: {
		name: "regexp_position",
		params: [
			{ name: "string" },
			{ name: "pattern" },
			{ name: "start", optional: true },
			{ name: "occurrence", optional: true },
		],
	}, // regexp.md
	regexp_split: { name: "regexp_split", params: [{ name: "string" }, { name: "pattern" }] }, // regexp.md
	regr_intercept: { name: "regr_intercept", params: [{ name: "y" }, { name: "x" }] }, // aggregate.md
	regr_slope: { name: "regr_slope", params: [{ name: "y" }, { name: "x" }] }, // aggregate.md
	regress: { name: "regress", params: [{ name: "features" }, { name: "model" }] }, // ml.md
	repeat: { name: "repeat", params: [{ name: "element" }, { name: "count" }] }, // array.md
	replace: { name: "replace", params: [{ name: "string" }, { name: "search" }, { name: "replace", optional: true }] }, // string.md
	rgb: { name: "rgb", params: [{ name: "red" }, { name: "green" }, { name: "blue" }] }, // color.md
	round: { name: "round", params: [{ name: "x" }, { name: "d", optional: true }] }, // math.md
	row_number: { name: "row_number", params: [] }, // window.md
	rtrim: { name: "rtrim", params: [{ name: "string" }] }, // string.md
	second: { name: "second", params: [{ name: "x" }] }, // datetime.md
	sequence: { name: "sequence", params: [{ name: "start" }, { name: "stop" }, { name: "step", optional: true }] }, // array.md
	sha1: { name: "sha1", params: [{ name: "binary" }] }, // binary.md
	sha256: { name: "sha256", params: [{ name: "binary" }] }, // binary.md
	sha512: { name: "sha512", params: [{ name: "binary" }] }, // binary.md
	shuffle: { name: "shuffle", params: [{ name: "x" }] }, // array.md
	sign: { name: "sign", params: [{ name: "x" }] }, // math.md
	simplify_geometry: { name: "simplify_geometry", params: [{ name: "Geometry" }, { name: "double" }] }, // geospatial.md
	sin: { name: "sin", params: [{ name: "x" }] }, // math.md
	sinh: { name: "sinh", params: [{ name: "x" }] }, // math.md
	skewness: { name: "skewness", params: [{ name: "x" }] }, // aggregate.md
	slice: { name: "slice", params: [{ name: "x" }, { name: "start" }, { name: "length" }] }, // array.md
	soundex: { name: "soundex", params: [{ name: "char" }] }, // string.md
	split: { name: "split", params: [{ name: "string" }, { name: "delimiter" }, { name: "limit", optional: true }] }, // string.md
	split_part: { name: "split_part", params: [{ name: "string" }, { name: "delimiter" }, { name: "index" }] }, // string.md
	split_to_map: {
		name: "split_to_map",
		params: [{ name: "string" }, { name: "entryDelimiter" }, { name: "keyValueDelimiter" }],
	}, // string.md
	split_to_multimap: {
		name: "split_to_multimap",
		params: [{ name: "string" }, { name: "entryDelimiter" }, { name: "keyValueDelimiter" }],
	}, // string.md
	spooky_hash_v2_32: { name: "spooky_hash_v2_32", params: [{ name: "binary" }] }, // binary.md
	spooky_hash_v2_64: { name: "spooky_hash_v2_64", params: [{ name: "binary" }] }, // binary.md
	sqrt: { name: "sqrt", params: [{ name: "x" }] }, // math.md
	st_asbinary: { name: "ST_AsBinary", params: [{ name: "Geometry" }] }, // geospatial.md
	st_astext: { name: "ST_AsText", params: [{ name: "Geometry" }] }, // geospatial.md
	st_boundary: { name: "ST_Boundary", params: [{ name: "Geometry" }] }, // geospatial.md
	st_buffer: { name: "ST_Buffer", params: [{ name: "Geometry" }, { name: "distance" }] }, // geospatial.md
	st_centroid: { name: "ST_Centroid", params: [{ name: "Geometry" }] }, // geospatial.md
	st_contains: {
		name: "ST_Contains",
		params: [
			{ name: "geometryA", type: "Geometry" },
			{ name: "geometryB", type: "Geometry" },
		],
	}, // geospatial.md
	st_convexhull: { name: "ST_ConvexHull", params: [{ name: "Geometry" }] }, // geospatial.md
	st_coorddim: { name: "ST_CoordDim", params: [{ name: "Geometry" }] }, // geospatial.md
	st_crosses: {
		name: "ST_Crosses",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
	}, // geospatial.md
	st_difference: {
		name: "ST_Difference",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
	}, // geospatial.md
	st_dimension: { name: "ST_Dimension", params: [{ name: "Geometry" }] }, // geospatial.md
	st_disjoint: {
		name: "ST_Disjoint",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
	}, // geospatial.md
	st_endpoint: { name: "ST_EndPoint", params: [{ name: "Geometry" }] }, // geospatial.md
	st_envelope: { name: "ST_Envelope", params: [{ name: "Geometry" }] }, // geospatial.md
	st_envelopeaspts: { name: "ST_EnvelopeAsPts", params: [{ name: "Geometry" }] }, // geospatial.md
	st_equals: {
		name: "ST_Equals",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
	}, // geospatial.md
	st_exteriorring: { name: "ST_ExteriorRing", params: [{ name: "Geometry" }] }, // geospatial.md
	st_geometries: { name: "ST_Geometries", params: [{ name: "Geometry" }] }, // geospatial.md
	st_geometryfromtext: { name: "ST_GeometryFromText", params: [{ name: "varchar" }] }, // geospatial.md
	st_geometryn: { name: "ST_GeometryN", params: [{ name: "Geometry" }, { name: "index" }] }, // geospatial.md
	st_geometrytype: { name: "ST_GeometryType", params: [{ name: "Geometry" }] }, // geospatial.md
	st_geomfrombinary: { name: "ST_GeomFromBinary", params: [{ name: "varbinary" }] }, // geospatial.md
	st_geomfromkml: { name: "ST_GeomFromKML", params: [{ name: "varchar" }] }, // geospatial.md
	st_interiorringn: { name: "ST_InteriorRingN", params: [{ name: "Geometry" }, { name: "index" }] }, // geospatial.md
	st_interiorrings: { name: "ST_InteriorRings", params: [{ name: "Geometry" }] }, // geospatial.md
	st_intersection: {
		name: "ST_Intersection",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
	}, // geospatial.md
	st_intersects: {
		name: "ST_Intersects",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
	}, // geospatial.md
	st_isclosed: { name: "ST_IsClosed", params: [{ name: "Geometry" }] }, // geospatial.md
	st_isempty: { name: "ST_IsEmpty", params: [{ name: "Geometry" }] }, // geospatial.md
	st_isring: { name: "ST_IsRing", params: [{ name: "Geometry" }] }, // geospatial.md
	st_issimple: { name: "ST_IsSimple", params: [{ name: "Geometry" }] }, // geospatial.md
	st_isvalid: { name: "ST_IsValid", params: [{ name: "Geometry" }] }, // geospatial.md
	st_linefromtext: { name: "ST_LineFromText", params: [{ name: "varchar" }] }, // geospatial.md
	st_numgeometries: { name: "ST_NumGeometries", params: [{ name: "Geometry" }] }, // geospatial.md
	st_numinteriorring: { name: "ST_NumInteriorRing", params: [{ name: "Geometry" }] }, // geospatial.md
	st_numpoints: { name: "ST_NumPoints", params: [{ name: "Geometry" }] }, // geospatial.md
	st_overlaps: {
		name: "ST_Overlaps",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
	}, // geospatial.md
	st_point: {
		name: "ST_Point",
		params: [
			{ name: "lon", type: "double" },
			{ name: "lat", type: "double" },
		],
	}, // geospatial.md
	st_pointn: { name: "ST_PointN", params: [{ name: "LineString" }, { name: "index" }] }, // geospatial.md
	st_points: { name: "ST_Points", params: [{ name: "Geometry" }] }, // geospatial.md
	st_polygon: { name: "ST_Polygon", params: [{ name: "varchar" }] }, // geospatial.md
	st_relate: {
		name: "ST_Relate",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
	}, // geospatial.md
	st_startpoint: { name: "ST_StartPoint", params: [{ name: "Geometry" }] }, // geospatial.md
	st_symdifference: {
		name: "ST_SymDifference",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
	}, // geospatial.md
	st_touches: {
		name: "ST_Touches",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
	}, // geospatial.md
	st_union: {
		name: "ST_Union",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
	}, // geospatial.md
	st_within: {
		name: "ST_Within",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
	}, // geospatial.md
	st_x: { name: "ST_X", params: [{ name: "Point" }] }, // geospatial.md
	st_xmax: { name: "ST_XMax", params: [{ name: "Geometry" }] }, // geospatial.md
	st_xmin: { name: "ST_XMin", params: [{ name: "Geometry" }] }, // geospatial.md
	st_y: { name: "ST_Y", params: [{ name: "Point" }] }, // geospatial.md
	st_ymax: { name: "ST_YMax", params: [{ name: "Geometry" }] }, // geospatial.md
	st_ymin: { name: "ST_YMin", params: [{ name: "Geometry" }] }, // geospatial.md
	starts_with: { name: "starts_with", params: [{ name: "string" }, { name: "substring" }] }, // string.md
	stddev: { name: "stddev", params: [{ name: "x" }] }, // aggregate.md
	stddev_pop: { name: "stddev_pop", params: [{ name: "x" }] }, // aggregate.md
	stddev_samp: { name: "stddev_samp", params: [{ name: "x" }] }, // aggregate.md
	strpos: {
		name: "strpos",
		params: [{ name: "string" }, { name: "substring" }, { name: "instance", optional: true }],
	}, // string.md
	substring: {
		name: "substring",
		params: [{ name: "string" }, { name: "start" }, { name: "length", optional: true }],
	}, // string.md
	sum: { name: "sum", params: [{ name: "x" }] }, // aggregate.md
	t_cdf: { name: "t_cdf", params: [{ name: "x" }, { name: "df" }] }, // math.md
	t_pdf: { name: "t_pdf", params: [{ name: "x" }, { name: "df" }] }, // math.md
	tan: { name: "tan", params: [{ name: "x" }] }, // math.md
	tanh: { name: "tanh", params: [{ name: "x" }] }, // math.md
	tdigest_agg: { name: "tdigest_agg", params: [{ name: "x" }, { name: "w", optional: true }] }, // aggregate.md
	theta_sketch_cardinality: {
		name: "theta_sketch_cardinality",
		params: [{ name: "sketch" }, { name: "seed", optional: true }],
	}, // datasketches.md
	timezone_hour: { name: "timezone_hour", params: [{ name: "timestamp" }] }, // datetime.md
	timezone_minute: { name: "timezone_minute", params: [{ name: "timestamp" }] }, // datetime.md
	to_base: { name: "to_base", params: [{ name: "x" }, { name: "radix" }] }, // math.md
	to_base32: { name: "to_base32", params: [{ name: "binary" }] }, // binary.md
	to_base64: { name: "to_base64", params: [{ name: "binary" }] }, // binary.md
	to_base64url: { name: "to_base64url", params: [{ name: "binary" }] }, // binary.md
	to_big_endian_32: { name: "to_big_endian_32", params: [{ name: "integer" }] }, // binary.md
	to_big_endian_64: { name: "to_big_endian_64", params: [{ name: "bigint" }] }, // binary.md
	to_char: { name: "to_char", params: [{ name: "timestamp" }, { name: "format" }] }, // teradata.md
	to_date: { name: "to_date", params: [{ name: "string" }, { name: "format" }] }, // teradata.md
	to_encoded_polyline: { name: "to_encoded_polyline", params: [{ name: "Geometry" }] }, // geospatial.md
	to_geojson_geometry: { name: "to_geojson_geometry", params: [{ name: "SphericalGeography" }] }, // geospatial.md
	to_geometry: { name: "to_geometry", params: [{ name: "SphericalGeography" }] }, // geospatial.md
	to_hex: { name: "to_hex", params: [{ name: "binary" }] }, // binary.md
	to_ieee754_32: { name: "to_ieee754_32", params: [{ name: "real" }] }, // binary.md
	to_ieee754_64: { name: "to_ieee754_64", params: [{ name: "double" }] }, // binary.md
	to_iso8601: { name: "to_iso8601", params: [{ name: "x" }] }, // datetime.md
	to_milliseconds: { name: "to_milliseconds", params: [{ name: "interval" }] }, // datetime.md
	to_spherical_geography: { name: "to_spherical_geography", params: [{ name: "Geometry" }] }, // geospatial.md
	to_timestamp: { name: "to_timestamp", params: [{ name: "string" }, { name: "format" }] }, // teradata.md
	to_unixtime: { name: "to_unixtime", params: [{ name: "timestamp" }] }, // datetime.md
	to_utf8: { name: "to_utf8", params: [{ name: "string" }] }, // string.md
	trim: { name: "trim", params: [{ name: "string" }] }, // string.md
	trim_array: { name: "trim_array", params: [{ name: "x" }, { name: "n" }] }, // array.md
	truncate: { name: "truncate", params: [{ name: "x" }, { name: "d", optional: true }] }, // math.md
	try: { name: "try", params: [{ name: "expression" }] }, // conditional.md
	typeof: { name: "typeof", params: [{ name: "expr" }] }, // conversion.md
	upper: { name: "upper", params: [{ name: "string" }] }, // string.md
	url_decode: { name: "url_decode", params: [{ name: "value" }] }, // url.md
	url_encode: { name: "url_encode", params: [{ name: "value" }] }, // url.md
	url_extract_fragment: { name: "url_extract_fragment", params: [{ name: "url" }] }, // url.md
	url_extract_host: { name: "url_extract_host", params: [{ name: "url" }] }, // url.md
	url_extract_parameter: { name: "url_extract_parameter", params: [{ name: "url" }, { name: "name" }] }, // url.md
	url_extract_path: { name: "url_extract_path", params: [{ name: "url" }] }, // url.md
	url_extract_port: { name: "url_extract_port", params: [{ name: "url" }] }, // url.md
	url_extract_protocol: { name: "url_extract_protocol", params: [{ name: "url" }] }, // url.md
	url_extract_query: { name: "url_extract_query", params: [{ name: "url" }] }, // url.md
	uuid: { name: "uuid", params: [] }, // uuid.md
	value_at_quantile: { name: "value_at_quantile", params: [{ name: "tdigest" }, { name: "quantile" }] }, // tdigest.md
	values_at_quantiles: { name: "values_at_quantiles", params: [{ name: "tdigest" }, { name: "quantiles" }] }, // tdigest.md
	var_pop: { name: "var_pop", params: [{ name: "x" }] }, // aggregate.md
	var_samp: { name: "var_samp", params: [{ name: "x" }] }, // aggregate.md
	variance: { name: "variance", params: [{ name: "x" }] }, // aggregate.md
	variant_is_null: { name: "variant_is_null", params: [{ name: "variant" }] }, // variant.md
	version: { name: "version", params: [] }, // system.md
	week: { name: "week", params: [{ name: "x" }] }, // datetime.md
	week_of_year: { name: "week_of_year", params: [{ name: "x" }] }, // datetime.md
	wilson_interval_lower: {
		name: "wilson_interval_lower",
		params: [{ name: "successes" }, { name: "trials" }, { name: "z" }],
	}, // math.md
	wilson_interval_upper: {
		name: "wilson_interval_upper",
		params: [{ name: "successes" }, { name: "trials" }, { name: "z" }],
	}, // math.md
	word_stem: { name: "word_stem", params: [{ name: "word" }, { name: "lang", optional: true }] }, // string.md
	xxhash64: { name: "xxhash64", params: [{ name: "binary" }] }, // binary.md
	year: { name: "year", params: [{ name: "x" }] }, // datetime.md
	year_of_week: { name: "year_of_week", params: [{ name: "x" }] }, // datetime.md
	yow: { name: "yow", params: [{ name: "x" }] }, // datetime.md
	zip: { name: "zip", params: [{ name: "array1" }, { name: "array2" }], variadic: true }, // array.md
};
