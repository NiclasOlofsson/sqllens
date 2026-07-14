// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// Harvested source: trinodb/trino release 482  vendor/trino-docs/functions/*.md (MyST `:::{function}` directives)
// Overrides source: tools/signature-overrides/trino.mjs
// Built 2026-07-14. 374 signatures (40 curated, 334 harvested).
import type { FnSignature } from "../signature/signatures.js";

/** The merged function-signature table for trino: curated overrides folded over the harvested
 *  doc-derived long tail (overrides win by key), keyed by lowercased name. `origin` says which
 *  layer produced each entry. */
export const TRINO_SIGNATURES: Record<string, FnSignature> = {
	abs: { name: "abs", params: [{ name: "x" }], origin: "harvested" }, // math.md
	acos: { name: "acos", params: [{ name: "x" }], origin: "harvested" }, // math.md
	ai_analyze_sentiment: { name: "ai_analyze_sentiment", params: [{ name: "text" }], origin: "harvested" }, // ai.md
	ai_classify: { name: "ai_classify", params: [{ name: "text" }, { name: "labels" }], origin: "harvested" }, // ai.md
	ai_extract: { name: "ai_extract", params: [{ name: "text" }, { name: "labels" }], origin: "harvested" }, // ai.md
	ai_fix_grammar: { name: "ai_fix_grammar", params: [{ name: "text" }], origin: "harvested" }, // ai.md
	ai_gen: { name: "ai_gen", params: [{ name: "prompt" }], origin: "harvested" }, // ai.md
	ai_mask: { name: "ai_mask", params: [{ name: "text" }, { name: "labels" }], origin: "harvested" }, // ai.md
	ai_translate: { name: "ai_translate", params: [{ name: "text" }, { name: "language" }], origin: "harvested" }, // ai.md
	any_value: { name: "any_value", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	approx_distinct: {
		name: "approx_distinct",
		params: [
			{ name: "x", type: "any" },
			{ name: "e", type: "double", optional: true },
		],
		origin: "curated",
	}, // curated: approx_distinct(x[, e])
	approx_most_frequent: {
		name: "approx_most_frequent",
		params: [{ name: "buckets" }, { name: "value" }, { name: "capacity" }],
		origin: "harvested",
	}, // aggregate.md
	approx_percentile: {
		name: "approx_percentile",
		params: [
			{ name: "x", type: "numeric" },
			{ name: "percentile", type: "double" },
		],
		origin: "curated",
	}, // curated: approx_percentile(x, percentile)
	approx_set: { name: "approx_set", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	arbitrary: { name: "arbitrary", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	array_agg: { name: "array_agg", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	array_distinct: { name: "array_distinct", params: [{ name: "x" }], origin: "harvested" }, // array.md
	array_except: { name: "array_except", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }, // array.md
	array_histogram: { name: "array_histogram", params: [{ name: "x" }], origin: "harvested" }, // array.md
	array_intersect: { name: "array_intersect", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }, // array.md
	array_join: {
		name: "array_join",
		params: [
			{ name: "x", type: "array" },
			{ name: "delimiter", type: "varchar" },
			{ name: "null_replacement", type: "varchar", optional: true },
		],
		origin: "curated",
	}, // curated: array_join(x, delimiter[, null_replacement])
	array_max: { name: "array_max", params: [{ name: "x" }], origin: "harvested" }, // array.md
	array_min: { name: "array_min", params: [{ name: "x" }], origin: "harvested" }, // array.md
	array_position: { name: "array_position", params: [{ name: "x" }, { name: "element" }], origin: "harvested" }, // array.md
	array_remove: { name: "array_remove", params: [{ name: "x" }, { name: "element" }], origin: "harvested" }, // array.md
	array_sort: { name: "array_sort", params: [{ name: "x" }], origin: "harvested" }, // array.md
	array_union: { name: "array_union", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }, // array.md
	arrays_overlap: { name: "arrays_overlap", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }, // array.md
	asin: { name: "asin", params: [{ name: "x" }], origin: "harvested" }, // math.md
	at_timezone: {
		name: "at_timezone",
		params: [
			{ name: "timestamp", type: "timestamp" },
			{ name: "zone", type: "varchar" },
		],
		origin: "curated",
	}, // curated: at_timezone(timestamp, zone)
	atan: { name: "atan", params: [{ name: "x" }], origin: "harvested" }, // math.md
	atan2: { name: "atan2", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }, // math.md
	avg: { name: "avg", params: [{ name: "x", type: "numeric" }], origin: "curated" }, // curated: avg(x)
	bar: {
		name: "bar",
		params: [
			{ name: "x" },
			{ name: "width" },
			{ name: "low_color", optional: true },
			{ name: "high_color", optional: true },
		],
		origin: "harvested",
	}, // color.md
	beta_cdf: { name: "beta_cdf", params: [{ name: "a" }, { name: "b" }, { name: "v" }], origin: "harvested" }, // math.md
	bing_tile_at: {
		name: "bing_tile_at",
		params: [{ name: "latitude" }, { name: "longitude" }, { name: "zoom_level" }],
		origin: "harvested",
	}, // geospatial.md
	bing_tile_coordinates: { name: "bing_tile_coordinates", params: [{ name: "tile" }], origin: "harvested" }, // geospatial.md
	bing_tile_polygon: { name: "bing_tile_polygon", params: [{ name: "tile" }], origin: "harvested" }, // geospatial.md
	bing_tile_quadkey: { name: "bing_tile_quadkey", params: [{ name: "tile" }], origin: "harvested" }, // geospatial.md
	bing_tile_zoom_level: { name: "bing_tile_zoom_level", params: [{ name: "tile" }], origin: "harvested" }, // geospatial.md
	bing_tiles_around: {
		name: "bing_tiles_around",
		params: [
			{ name: "latitude" },
			{ name: "longitude" },
			{ name: "zoom_level" },
			{ name: "radius_in_km", optional: true },
		],
		origin: "harvested",
	}, // geospatial.md
	bit_count: { name: "bit_count", params: [{ name: "x" }, { name: "bits" }], origin: "harvested" }, // bitwise.md
	bitwise_and: { name: "bitwise_and", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }, // bitwise.md
	bitwise_and_agg: { name: "bitwise_and_agg", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	bitwise_left_shift: {
		name: "bitwise_left_shift",
		params: [{ name: "value" }, { name: "shift" }],
		origin: "harvested",
	}, // bitwise.md
	bitwise_not: { name: "bitwise_not", params: [{ name: "x" }], origin: "harvested" }, // bitwise.md
	bitwise_or: { name: "bitwise_or", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }, // bitwise.md
	bitwise_or_agg: { name: "bitwise_or_agg", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	bitwise_right_shift: {
		name: "bitwise_right_shift",
		params: [{ name: "value" }, { name: "shift" }],
		origin: "harvested",
	}, // bitwise.md
	bitwise_right_shift_arithmetic: {
		name: "bitwise_right_shift_arithmetic",
		params: [{ name: "value" }, { name: "shift" }],
		origin: "harvested",
	}, // bitwise.md
	bitwise_xor: { name: "bitwise_xor", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }, // bitwise.md
	bitwise_xor_agg: { name: "bitwise_xor_agg", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	bool_and: { name: "bool_and", params: [{ name: "boolean" }], origin: "harvested" }, // aggregate.md
	bool_or: { name: "bool_or", params: [{ name: "boolean" }], origin: "harvested" }, // aggregate.md
	cbrt: { name: "cbrt", params: [{ name: "x" }], origin: "harvested" }, // math.md
	ceil: { name: "ceil", params: [{ name: "x" }], origin: "harvested" }, // math.md
	ceiling: { name: "ceiling", params: [{ name: "x" }], origin: "harvested" }, // math.md
	char2hexint: { name: "char2hexint", params: [{ name: "string" }], origin: "harvested" }, // teradata.md
	checksum: { name: "checksum", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	chr: { name: "chr", params: [{ name: "n" }], origin: "harvested" }, // string.md
	classify: { name: "classify", params: [{ name: "features" }, { name: "model" }], origin: "harvested" }, // ml.md
	coalesce: {
		name: "coalesce",
		params: [
			{ name: "value1", type: "any" },
			{ name: "value2", type: "any" },
		],
		variadic: true,
		origin: "curated",
	}, // curated: coalesce(value1, value2, ...) - AstBuilder.java: "must have at least two arguments", min arity 2
	codepoint: { name: "codepoint", params: [{ name: "string" }], origin: "harvested" }, // string.md
	concat_ws: {
		name: "concat_ws",
		params: [
			{ name: "separator", type: "varchar" },
			{ name: "strings", type: "varchar" },
		],
		variadic: true,
		origin: "curated",
	}, // curated: concat_ws(separator, string1, ..., stringN) - a real variadic flag, not a cosmetic "..." in the type string
	contains_sequence: { name: "contains_sequence", params: [{ name: "x" }, { name: "seq" }], origin: "harvested" }, // array.md
	convex_hull_agg: { name: "convex_hull_agg", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	corr: { name: "corr", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }, // aggregate.md
	cos: { name: "cos", params: [{ name: "x" }], origin: "harvested" }, // math.md
	cosh: { name: "cosh", params: [{ name: "x" }], origin: "harvested" }, // math.md
	cosine_distance: { name: "cosine_distance", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }, // math.md
	cosine_similarity: { name: "cosine_similarity", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }, // math.md
	count: { name: "count", params: [{ name: "x", type: "any" }], origin: "curated" }, // curated: count(x)
	count_if: { name: "count_if", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	covar_pop: { name: "covar_pop", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }, // aggregate.md
	covar_samp: { name: "covar_samp", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }, // aggregate.md
	crc32: { name: "crc32", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	cume_dist: { name: "cume_dist", params: [], origin: "harvested" }, // window.md
	current_timezone: { name: "current_timezone", params: [], origin: "harvested" }, // datetime.md
	date: { name: "date", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	date_add: {
		name: "date_add",
		params: [
			{ name: "unit", type: "varchar" },
			{ name: "value", type: "bigint" },
			{ name: "timestamp", type: "timestamp" },
		],
		origin: "curated",
	}, // curated: date_add(unit, value, timestamp)
	date_diff: {
		name: "date_diff",
		params: [
			{ name: "unit", type: "varchar" },
			{ name: "timestamp1", type: "timestamp" },
			{ name: "timestamp2", type: "timestamp" },
		],
		origin: "curated",
	}, // curated: date_diff(unit, timestamp1, timestamp2)
	date_format: {
		name: "date_format",
		params: [
			{ name: "timestamp", type: "timestamp" },
			{ name: "format", type: "varchar" },
		],
		origin: "curated",
	}, // curated: date_format(timestamp, format)
	date_parse: {
		name: "date_parse",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "format", type: "varchar" },
		],
		origin: "curated",
	}, // curated: date_parse(string, format)
	date_trunc: {
		name: "date_trunc",
		params: [
			{ name: "unit", type: "varchar" },
			{ name: "x", type: "timestamp" },
		],
		origin: "curated",
	}, // curated: date_trunc(unit, x)
	day: { name: "day", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	day_of_month: { name: "day_of_month", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	day_of_week: { name: "day_of_week", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	day_of_year: { name: "day_of_year", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	degrees: { name: "degrees", params: [{ name: "x" }], origin: "harvested" }, // math.md
	dense_rank: { name: "dense_rank", params: [], origin: "harvested" }, // window.md
	dow: { name: "dow", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	doy: { name: "doy", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	e: { name: "e", params: [], origin: "harvested" }, // math.md
	element_at: {
		name: "element_at",
		params: [
			{ name: "collection", type: "array|map" },
			{ name: "key", type: "any" },
		],
		origin: "curated",
	}, // curated: element_at(x, key)
	empty_approx_set: { name: "empty_approx_set", params: [], origin: "harvested" }, // hyperloglog.md
	ends_with: { name: "ends_with", params: [{ name: "string" }, { name: "substring" }], origin: "harvested" }, // string.md
	every: { name: "every", params: [{ name: "boolean" }], origin: "harvested" }, // aggregate.md
	exp: { name: "exp", params: [{ name: "x" }], origin: "harvested" }, // math.md
	features: { name: "features", params: [{ name: "double" }], variadic: true, origin: "harvested" }, // ml.md
	first_value: { name: "first_value", params: [{ name: "x" }], origin: "harvested" }, // window.md
	flatten: { name: "flatten", params: [{ name: "x" }], origin: "harvested" }, // array.md
	floor: { name: "floor", params: [{ name: "x" }], origin: "harvested" }, // math.md
	format: {
		name: "format",
		params: [
			{ name: "format", type: "varchar" },
			{ name: "args", type: "any" },
		],
		variadic: true,
		origin: "curated",
	}, // curated: format(format, args...)
	format_datetime: {
		name: "format_datetime",
		params: [{ name: "timestamp" }, { name: "format" }],
		origin: "harvested",
	}, // datetime.md
	format_number: { name: "format_number", params: [{ name: "number" }], origin: "harvested" }, // conversion.md
	from_base: { name: "from_base", params: [{ name: "string" }, { name: "radix" }], origin: "harvested" }, // math.md
	from_base32: { name: "from_base32", params: [{ name: "string" }], origin: "harvested" }, // binary.md
	from_base64: { name: "from_base64", params: [{ name: "string" }], origin: "harvested" }, // binary.md
	from_base64url: { name: "from_base64url", params: [{ name: "string" }], origin: "harvested" }, // binary.md
	from_big_endian_32: { name: "from_big_endian_32", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	from_big_endian_64: { name: "from_big_endian_64", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	from_encoded_polyline: { name: "from_encoded_polyline", params: [{ name: "varchar" }], origin: "harvested" }, // geospatial.md
	from_geojson_geometry: { name: "from_geojson_geometry", params: [{ name: "varchar" }], origin: "harvested" }, // geospatial.md
	from_hex: { name: "from_hex", params: [{ name: "string" }], origin: "harvested" }, // binary.md
	from_ieee754_32: { name: "from_ieee754_32", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	from_ieee754_64: { name: "from_ieee754_64", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	from_iso8601_date: { name: "from_iso8601_date", params: [{ name: "string" }], origin: "harvested" }, // datetime.md
	from_iso8601_timestamp: { name: "from_iso8601_timestamp", params: [{ name: "string" }], origin: "harvested" }, // datetime.md
	from_iso8601_timestamp_nanos: {
		name: "from_iso8601_timestamp_nanos",
		params: [{ name: "string" }],
		origin: "harvested",
	}, // datetime.md
	from_unixtime: {
		name: "from_unixtime",
		params: [
			{ name: "unixtime", type: "double" },
			{ name: "zone", type: "varchar" },
		],
		origin: "curated",
	}, // curated: from_unixtime(unixtime[, zone])
	from_unixtime_nanos: { name: "from_unixtime_nanos", params: [{ name: "unixtime" }], origin: "harvested" }, // datetime.md
	from_utf8: {
		name: "from_utf8",
		params: [{ name: "binary" }, { name: "replace", optional: true }],
		origin: "harvested",
	}, // string.md
	geometric_mean: { name: "geometric_mean", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	geometry_from_hadoop_shape: {
		name: "geometry_from_hadoop_shape",
		params: [{ name: "varbinary" }],
		origin: "harvested",
	}, // geospatial.md
	geometry_invalid_reason: { name: "geometry_invalid_reason", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	geometry_nearest_points: {
		name: "geometry_nearest_points",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
		origin: "harvested",
	}, // geospatial.md
	geometry_to_bing_tiles: {
		name: "geometry_to_bing_tiles",
		params: [{ name: "geometry" }, { name: "zoom_level" }],
		origin: "harvested",
	}, // geospatial.md
	geometry_union_agg: { name: "geometry_union_agg", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	great_circle_distance: {
		name: "great_circle_distance",
		params: [{ name: "latitude1" }, { name: "longitude1" }, { name: "latitude2" }, { name: "longitude2" }],
		origin: "harvested",
	}, // geospatial.md
	hamming_distance: {
		name: "hamming_distance",
		params: [{ name: "string1" }, { name: "string2" }],
		origin: "harvested",
	}, // string.md
	hash_counts: { name: "hash_counts", params: [{ name: "x" }], origin: "harvested" }, // setdigest.md
	histogram: { name: "histogram", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	hmac_md5: { name: "hmac_md5", params: [{ name: "binary" }, { name: "key" }], origin: "harvested" }, // binary.md
	hmac_sha1: { name: "hmac_sha1", params: [{ name: "binary" }, { name: "key" }], origin: "harvested" }, // binary.md
	hmac_sha256: { name: "hmac_sha256", params: [{ name: "binary" }, { name: "key" }], origin: "harvested" }, // binary.md
	hmac_sha512: { name: "hmac_sha512", params: [{ name: "binary" }, { name: "key" }], origin: "harvested" }, // binary.md
	hour: { name: "hour", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	human_readable_seconds: { name: "human_readable_seconds", params: [{ name: "double" }], origin: "harvested" }, // datetime.md
	if: {
		name: "if",
		params: [
			{ name: "condition", type: "boolean" },
			{ name: "true_value", type: "any" },
			{ name: "false_value", type: "any", optional: true },
		],
		origin: "curated",
	}, // curated: if(cond, t[, f]) - AstBuilder.java: arguments.size() == 2 || 3, false_value optional
	index: { name: "index", params: [{ name: "string" }, { name: "substring" }], origin: "harvested" }, // teradata.md
	infinity: { name: "infinity", params: [], origin: "harvested" }, // math.md
	intersection_cardinality: {
		name: "intersection_cardinality",
		params: [{ name: "x" }, { name: "y" }],
		origin: "harvested",
	}, // setdigest.md
	inverse_beta_cdf: {
		name: "inverse_beta_cdf",
		params: [{ name: "a" }, { name: "b" }, { name: "p" }],
		origin: "harvested",
	}, // math.md
	inverse_normal_cdf: {
		name: "inverse_normal_cdf",
		params: [{ name: "mean" }, { name: "sd" }, { name: "p" }],
		origin: "harvested",
	}, // math.md
	is_finite: { name: "is_finite", params: [{ name: "x" }], origin: "harvested" }, // math.md
	is_infinite: { name: "is_infinite", params: [{ name: "x" }], origin: "harvested" }, // math.md
	is_json_scalar: { name: "is_json_scalar", params: [{ name: "json" }], origin: "harvested" }, // json.md
	is_nan: { name: "is_nan", params: [{ name: "x" }], origin: "harvested" }, // math.md
	jaccard_index: { name: "jaccard_index", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }, // setdigest.md
	json_array_contains: {
		name: "json_array_contains",
		params: [{ name: "json" }, { name: "value" }],
		origin: "harvested",
	}, // json.md
	json_array_get: {
		name: "json_array_get",
		params: [{ name: "json_array" }, { name: "index" }],
		origin: "harvested",
	}, // json.md
	json_array_length: { name: "json_array_length", params: [{ name: "json" }], origin: "harvested" }, // json.md
	json_extract: {
		name: "json_extract",
		params: [
			{ name: "json", type: "json" },
			{ name: "json_path", type: "varchar" },
		],
		origin: "curated",
	}, // curated: json_extract(json, json_path)
	json_extract_scalar: {
		name: "json_extract_scalar",
		params: [
			{ name: "json", type: "json" },
			{ name: "json_path", type: "varchar" },
		],
		origin: "curated",
	}, // curated: json_extract_scalar(json, json_path)
	json_format: { name: "json_format", params: [{ name: "json" }], origin: "harvested" }, // json.md
	json_parse: { name: "json_parse", params: [{ name: "string", type: "varchar" }], origin: "curated" }, // curated: json_parse(string)
	json_size: { name: "json_size", params: [{ name: "json" }, { name: "json_path" }], origin: "harvested" }, // json.md
	kurtosis: { name: "kurtosis", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	lag: {
		name: "lag",
		params: [{ name: "x" }, { name: "offset", optional: true }, { name: "default_value", optional: true }],
		origin: "harvested",
	}, // window.md
	last_day_of_month: { name: "last_day_of_month", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	last_value: { name: "last_value", params: [{ name: "x" }], origin: "harvested" }, // window.md
	lead: {
		name: "lead",
		params: [{ name: "x" }, { name: "offset", optional: true }, { name: "default_value", optional: true }],
		origin: "harvested",
	}, // window.md
	learn_classifier: {
		name: "learn_classifier",
		params: [{ name: "label" }, { name: "features" }],
		origin: "harvested",
	}, // ml.md
	learn_libsvm_classifier: {
		name: "learn_libsvm_classifier",
		params: [{ name: "label" }, { name: "features" }, { name: "params" }],
		origin: "harvested",
	}, // ml.md
	learn_libsvm_regressor: {
		name: "learn_libsvm_regressor",
		params: [{ name: "target" }, { name: "features" }, { name: "params" }],
		origin: "harvested",
	}, // ml.md
	learn_regressor: {
		name: "learn_regressor",
		params: [{ name: "target" }, { name: "features" }],
		origin: "harvested",
	}, // ml.md
	levenshtein_distance: {
		name: "levenshtein_distance",
		params: [{ name: "string1" }, { name: "string2" }],
		origin: "harvested",
	}, // string.md
	line_interpolate_point: {
		name: "line_interpolate_point",
		params: [{ name: "LineString" }, { name: "double" }],
		origin: "harvested",
	}, // geospatial.md
	line_interpolate_points: {
		name: "line_interpolate_points",
		params: [{ name: "LineString" }, { name: "double" }, { name: "repeated" }],
		origin: "harvested",
	}, // geospatial.md
	line_locate_point: {
		name: "line_locate_point",
		params: [{ name: "LineString" }, { name: "Point" }],
		origin: "harvested",
	}, // geospatial.md
	listagg: {
		name: "listagg",
		params: [
			{ name: "expression", type: "varchar" },
			{ name: "separator", type: "varchar", optional: true },
		],
		origin: "curated",
	}, // curated: listagg(expr[, separator]) WITHIN GROUP - separator is optional, defaults to the empty string when not specified
	ln: { name: "ln", params: [{ name: "x" }], origin: "harvested" }, // math.md
	log: { name: "log", params: [{ name: "b" }, { name: "x" }], origin: "harvested" }, // math.md
	log10: { name: "log10", params: [{ name: "x" }], origin: "harvested" }, // math.md
	log2: { name: "log2", params: [{ name: "x" }], origin: "harvested" }, // math.md
	lower: { name: "lower", params: [{ name: "string" }], origin: "harvested" }, // string.md
	lpad: {
		name: "lpad",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "size", type: "bigint" },
			{ name: "padstring", type: "varchar" },
		],
		origin: "curated",
	}, // curated: lpad(string, size, padstring)
	ltrim: { name: "ltrim", params: [{ name: "string" }], origin: "harvested" }, // string.md
	luhn_check: { name: "luhn_check", params: [{ name: "string" }], origin: "harvested" }, // string.md
	make_set_digest: { name: "make_set_digest", params: [{ name: "x" }], origin: "harvested" }, // setdigest.md
	map_agg: { name: "map_agg", params: [{ name: "key" }, { name: "value" }], origin: "harvested" }, // aggregate.md
	max: {
		name: "max",
		params: [
			{ name: "x", type: "any" },
			{ name: "n", type: "bigint", optional: true },
		],
		origin: "curated",
	}, // curated: max(x[, n])
	max_by: {
		name: "max_by",
		params: [
			{ name: "x", type: "any" },
			{ name: "y", type: "any" },
			{ name: "n", type: "bigint", optional: true },
		],
		origin: "curated",
	}, // curated: max_by(x, y[, n])
	md5: { name: "md5", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	merge_set_digest: { name: "merge_set_digest", params: [{ name: "setdigest" }], origin: "harvested" }, // setdigest.md
	millisecond: { name: "millisecond", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	min: {
		name: "min",
		params: [
			{ name: "x", type: "any" },
			{ name: "n", type: "bigint", optional: true },
		],
		origin: "curated",
	}, // curated: min(x[, n])
	min_by: {
		name: "min_by",
		params: [
			{ name: "x", type: "any" },
			{ name: "y", type: "any" },
			{ name: "n", type: "bigint", optional: true },
		],
		origin: "curated",
	}, // curated: min_by(x, y[, n])
	minute: { name: "minute", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	mod: { name: "mod", params: [{ name: "n" }, { name: "m" }], origin: "harvested" }, // math.md
	month: { name: "month", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	multimap_agg: { name: "multimap_agg", params: [{ name: "key" }, { name: "value" }], origin: "harvested" }, // aggregate.md
	murmur3: { name: "murmur3", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	nan: { name: "nan", params: [], origin: "harvested" }, // math.md
	normal_cdf: { name: "normal_cdf", params: [{ name: "mean" }, { name: "sd" }, { name: "v" }], origin: "harvested" }, // math.md
	normalize: {
		name: "normalize",
		params: [{ name: "string" }, { name: "form", optional: true }],
		origin: "harvested",
	}, // string.md
	now: { name: "now", params: [], origin: "harvested" }, // datetime.md
	nth_value: { name: "nth_value", params: [{ name: "x" }, { name: "offset" }], origin: "harvested" }, // window.md
	ntile: { name: "ntile", params: [{ name: "n" }], origin: "harvested" }, // window.md
	nullif: {
		name: "nullif",
		params: [
			{ name: "value1", type: "any" },
			{ name: "value2", type: "any" },
		],
		origin: "curated",
	}, // curated: nullif(value1, value2)
	numeric_histogram: {
		name: "numeric_histogram",
		params: [{ name: "buckets" }, { name: "value" }, { name: "weight", optional: true }],
		origin: "harvested",
	}, // aggregate.md
	parse_data_size: { name: "parse_data_size", params: [{ name: "string" }], origin: "harvested" }, // conversion.md
	parse_datetime: { name: "parse_datetime", params: [{ name: "string" }, { name: "format" }], origin: "harvested" }, // datetime.md
	parse_duration: { name: "parse_duration", params: [{ name: "string" }], origin: "harvested" }, // datetime.md
	percent_rank: { name: "percent_rank", params: [], origin: "harvested" }, // window.md
	pi: { name: "pi", params: [], origin: "harvested" }, // math.md
	pow: { name: "pow", params: [{ name: "x" }, { name: "p" }], origin: "harvested" }, // math.md
	power: { name: "power", params: [{ name: "x" }, { name: "p" }], origin: "harvested" }, // math.md
	qdigest_agg: {
		name: "qdigest_agg",
		params: [{ name: "x" }, { name: "w", optional: true }, { name: "accuracy", optional: true }],
		origin: "harvested",
	}, // aggregate.md
	quarter: { name: "quarter", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	radians: { name: "radians", params: [{ name: "x" }], origin: "harvested" }, // math.md
	rand: { name: "rand", params: [], origin: "harvested" }, // math.md
	rank: { name: "rank", params: [], origin: "harvested" }, // window.md
	reduce: {
		name: "reduce",
		params: [
			{ name: "array", type: "array" },
			{ name: "initialState", type: "any" },
			{ name: "inputFunction", type: "lambda" },
			{ name: "outputFunction", type: "lambda" },
		],
		origin: "curated",
	}, // curated: reduce(array, s0, in, out)
	regexp_count: { name: "regexp_count", params: [{ name: "string" }, { name: "pattern" }], origin: "harvested" }, // regexp.md
	regexp_extract: {
		name: "regexp_extract",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "pattern", type: "varchar" },
			{ name: "group", type: "bigint", optional: true },
		],
		origin: "curated",
	}, // curated: regexp_extract(string, pattern[, group])
	regexp_extract_all: {
		name: "regexp_extract_all",
		params: [{ name: "string" }, { name: "pattern" }, { name: "group", optional: true }],
		origin: "harvested",
	}, // regexp.md
	regexp_like: {
		name: "regexp_like",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "pattern", type: "varchar" },
		],
		origin: "curated",
	}, // curated: regexp_like(string, pattern)
	regexp_position: {
		name: "regexp_position",
		params: [
			{ name: "string" },
			{ name: "pattern" },
			{ name: "start", optional: true },
			{ name: "occurrence", optional: true },
		],
		origin: "harvested",
	}, // regexp.md
	regexp_replace: {
		name: "regexp_replace",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "pattern", type: "varchar" },
			{ name: "replacement", type: "varchar", optional: true },
		],
		origin: "curated",
	}, // curated: regexp_replace(string, pattern[, replacement])
	regexp_split: { name: "regexp_split", params: [{ name: "string" }, { name: "pattern" }], origin: "harvested" }, // regexp.md
	regr_intercept: { name: "regr_intercept", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }, // aggregate.md
	regr_slope: { name: "regr_slope", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }, // aggregate.md
	regress: { name: "regress", params: [{ name: "features" }, { name: "model" }], origin: "harvested" }, // ml.md
	repeat: { name: "repeat", params: [{ name: "element" }, { name: "count" }], origin: "harvested" }, // array.md
	replace: {
		name: "replace",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "search", type: "varchar" },
			{ name: "replace", type: "varchar", optional: true },
		],
		origin: "curated",
	}, // curated: replace(string, search[, replace])
	rgb: { name: "rgb", params: [{ name: "red" }, { name: "green" }, { name: "blue" }], origin: "harvested" }, // color.md
	round: { name: "round", params: [{ name: "x" }, { name: "d", optional: true }], origin: "harvested" }, // math.md
	row_number: { name: "row_number", params: [], origin: "harvested" }, // window.md
	rpad: {
		name: "rpad",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "size", type: "bigint" },
			{ name: "padstring", type: "varchar" },
		],
		origin: "curated",
	}, // curated: rpad(string, size, padstring)
	rtrim: { name: "rtrim", params: [{ name: "string" }], origin: "harvested" }, // string.md
	second: { name: "second", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	sequence: {
		name: "sequence",
		params: [
			{ name: "start", type: "bigint" },
			{ name: "stop", type: "bigint" },
			{ name: "step", type: "bigint", optional: true },
		],
		origin: "curated",
	}, // curated: sequence(start, stop[, step]) - step optional, defaults to incrementing by 1
	sha1: { name: "sha1", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	sha256: { name: "sha256", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	sha512: { name: "sha512", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	shuffle: { name: "shuffle", params: [{ name: "x" }], origin: "harvested" }, // array.md
	sign: { name: "sign", params: [{ name: "x" }], origin: "harvested" }, // math.md
	simplify_geometry: {
		name: "simplify_geometry",
		params: [{ name: "Geometry" }, { name: "double" }],
		origin: "harvested",
	}, // geospatial.md
	sin: { name: "sin", params: [{ name: "x" }], origin: "harvested" }, // math.md
	sinh: { name: "sinh", params: [{ name: "x" }], origin: "harvested" }, // math.md
	skewness: { name: "skewness", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	slice: { name: "slice", params: [{ name: "x" }, { name: "start" }, { name: "length" }], origin: "harvested" }, // array.md
	soundex: { name: "soundex", params: [{ name: "char" }], origin: "harvested" }, // string.md
	split: {
		name: "split",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "delimiter", type: "varchar" },
			{ name: "limit", type: "bigint", optional: true },
		],
		origin: "curated",
	}, // curated: split(string, delimiter[, limit])
	split_part: {
		name: "split_part",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "delimiter", type: "varchar" },
			{ name: "index", type: "bigint" },
		],
		origin: "curated",
	}, // curated: split_part(string, delimiter, index)
	split_to_map: {
		name: "split_to_map",
		params: [{ name: "string" }, { name: "entryDelimiter" }, { name: "keyValueDelimiter" }],
		origin: "harvested",
	}, // string.md
	split_to_multimap: {
		name: "split_to_multimap",
		params: [{ name: "string" }, { name: "entryDelimiter" }, { name: "keyValueDelimiter" }],
		origin: "harvested",
	}, // string.md
	spooky_hash_v2_32: { name: "spooky_hash_v2_32", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	spooky_hash_v2_64: { name: "spooky_hash_v2_64", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	sqrt: { name: "sqrt", params: [{ name: "x" }], origin: "harvested" }, // math.md
	st_asbinary: { name: "ST_AsBinary", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_astext: { name: "ST_AsText", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_boundary: { name: "ST_Boundary", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_buffer: { name: "ST_Buffer", params: [{ name: "Geometry" }, { name: "distance" }], origin: "harvested" }, // geospatial.md
	st_centroid: { name: "ST_Centroid", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_contains: {
		name: "ST_Contains",
		params: [
			{ name: "geometryA", type: "Geometry" },
			{ name: "geometryB", type: "Geometry" },
		],
		origin: "harvested",
	}, // geospatial.md
	st_convexhull: { name: "ST_ConvexHull", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_coorddim: { name: "ST_CoordDim", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_crosses: {
		name: "ST_Crosses",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
		origin: "harvested",
	}, // geospatial.md
	st_difference: {
		name: "ST_Difference",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
		origin: "harvested",
	}, // geospatial.md
	st_dimension: { name: "ST_Dimension", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_disjoint: {
		name: "ST_Disjoint",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
		origin: "harvested",
	}, // geospatial.md
	st_endpoint: { name: "ST_EndPoint", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_envelope: { name: "ST_Envelope", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_envelopeaspts: { name: "ST_EnvelopeAsPts", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_equals: {
		name: "ST_Equals",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
		origin: "harvested",
	}, // geospatial.md
	st_exteriorring: { name: "ST_ExteriorRing", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_geometries: { name: "ST_Geometries", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_geometryfromtext: { name: "ST_GeometryFromText", params: [{ name: "varchar" }], origin: "harvested" }, // geospatial.md
	st_geometryn: { name: "ST_GeometryN", params: [{ name: "Geometry" }, { name: "index" }], origin: "harvested" }, // geospatial.md
	st_geometrytype: { name: "ST_GeometryType", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_geomfrombinary: { name: "ST_GeomFromBinary", params: [{ name: "varbinary" }], origin: "harvested" }, // geospatial.md
	st_geomfromkml: { name: "ST_GeomFromKML", params: [{ name: "varchar" }], origin: "harvested" }, // geospatial.md
	st_interiorringn: {
		name: "ST_InteriorRingN",
		params: [{ name: "Geometry" }, { name: "index" }],
		origin: "harvested",
	}, // geospatial.md
	st_interiorrings: { name: "ST_InteriorRings", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_intersection: {
		name: "ST_Intersection",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
		origin: "harvested",
	}, // geospatial.md
	st_intersects: {
		name: "ST_Intersects",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
		origin: "harvested",
	}, // geospatial.md
	st_isclosed: { name: "ST_IsClosed", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_isempty: { name: "ST_IsEmpty", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_isring: { name: "ST_IsRing", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_issimple: { name: "ST_IsSimple", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_isvalid: { name: "ST_IsValid", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_linefromtext: { name: "ST_LineFromText", params: [{ name: "varchar" }], origin: "harvested" }, // geospatial.md
	st_numgeometries: { name: "ST_NumGeometries", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_numinteriorring: { name: "ST_NumInteriorRing", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_numpoints: { name: "ST_NumPoints", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_overlaps: {
		name: "ST_Overlaps",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
		origin: "harvested",
	}, // geospatial.md
	st_point: {
		name: "ST_Point",
		params: [
			{ name: "lon", type: "double" },
			{ name: "lat", type: "double" },
		],
		origin: "harvested",
	}, // geospatial.md
	st_pointn: { name: "ST_PointN", params: [{ name: "LineString" }, { name: "index" }], origin: "harvested" }, // geospatial.md
	st_points: { name: "ST_Points", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_polygon: { name: "ST_Polygon", params: [{ name: "varchar" }], origin: "harvested" }, // geospatial.md
	st_relate: {
		name: "ST_Relate",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
		origin: "harvested",
	}, // geospatial.md
	st_startpoint: { name: "ST_StartPoint", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_symdifference: {
		name: "ST_SymDifference",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
		origin: "harvested",
	}, // geospatial.md
	st_touches: {
		name: "ST_Touches",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
		origin: "harvested",
	}, // geospatial.md
	st_union: {
		name: "ST_Union",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
		origin: "harvested",
	}, // geospatial.md
	st_within: {
		name: "ST_Within",
		params: [
			{ name: "first", type: "Geometry" },
			{ name: "second", type: "Geometry" },
		],
		origin: "harvested",
	}, // geospatial.md
	st_x: { name: "ST_X", params: [{ name: "Point" }], origin: "harvested" }, // geospatial.md
	st_xmax: { name: "ST_XMax", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_xmin: { name: "ST_XMin", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_y: { name: "ST_Y", params: [{ name: "Point" }], origin: "harvested" }, // geospatial.md
	st_ymax: { name: "ST_YMax", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	st_ymin: { name: "ST_YMin", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	starts_with: { name: "starts_with", params: [{ name: "string" }, { name: "substring" }], origin: "harvested" }, // string.md
	stddev: { name: "stddev", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	stddev_pop: { name: "stddev_pop", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	stddev_samp: { name: "stddev_samp", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	strpos: {
		name: "strpos",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "substring", type: "varchar" },
			{ name: "instance", type: "bigint", optional: true },
		],
		origin: "curated",
	}, // curated: strpos(string, substring[, instance])
	substr: {
		name: "substr",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "start", type: "bigint" },
			{ name: "length", type: "bigint" },
		],
		origin: "curated",
	}, // curated: substr(string, start[, length])
	substring: {
		name: "substring",
		params: [{ name: "string" }, { name: "start" }, { name: "length", optional: true }],
		origin: "harvested",
	}, // string.md
	sum: { name: "sum", params: [{ name: "x", type: "numeric" }], origin: "curated" }, // curated: sum(x)
	t_cdf: { name: "t_cdf", params: [{ name: "x" }, { name: "df" }], origin: "harvested" }, // math.md
	t_pdf: { name: "t_pdf", params: [{ name: "x" }, { name: "df" }], origin: "harvested" }, // math.md
	tan: { name: "tan", params: [{ name: "x" }], origin: "harvested" }, // math.md
	tanh: { name: "tanh", params: [{ name: "x" }], origin: "harvested" }, // math.md
	tdigest_agg: { name: "tdigest_agg", params: [{ name: "x" }, { name: "w", optional: true }], origin: "harvested" }, // aggregate.md
	theta_sketch_cardinality: {
		name: "theta_sketch_cardinality",
		params: [{ name: "sketch" }, { name: "seed", optional: true }],
		origin: "harvested",
	}, // datasketches.md
	timezone_hour: { name: "timezone_hour", params: [{ name: "timestamp" }], origin: "harvested" }, // datetime.md
	timezone_minute: { name: "timezone_minute", params: [{ name: "timestamp" }], origin: "harvested" }, // datetime.md
	to_base: { name: "to_base", params: [{ name: "x" }, { name: "radix" }], origin: "harvested" }, // math.md
	to_base32: { name: "to_base32", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	to_base64: { name: "to_base64", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	to_base64url: { name: "to_base64url", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	to_big_endian_32: { name: "to_big_endian_32", params: [{ name: "integer" }], origin: "harvested" }, // binary.md
	to_big_endian_64: { name: "to_big_endian_64", params: [{ name: "bigint" }], origin: "harvested" }, // binary.md
	to_char: { name: "to_char", params: [{ name: "timestamp" }, { name: "format" }], origin: "harvested" }, // teradata.md
	to_date: { name: "to_date", params: [{ name: "string" }, { name: "format" }], origin: "harvested" }, // teradata.md
	to_encoded_polyline: { name: "to_encoded_polyline", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	to_geojson_geometry: { name: "to_geojson_geometry", params: [{ name: "SphericalGeography" }], origin: "harvested" }, // geospatial.md
	to_geometry: { name: "to_geometry", params: [{ name: "SphericalGeography" }], origin: "harvested" }, // geospatial.md
	to_hex: { name: "to_hex", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	to_ieee754_32: { name: "to_ieee754_32", params: [{ name: "real" }], origin: "harvested" }, // binary.md
	to_ieee754_64: { name: "to_ieee754_64", params: [{ name: "double" }], origin: "harvested" }, // binary.md
	to_iso8601: { name: "to_iso8601", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	to_milliseconds: { name: "to_milliseconds", params: [{ name: "interval" }], origin: "harvested" }, // datetime.md
	to_spherical_geography: { name: "to_spherical_geography", params: [{ name: "Geometry" }], origin: "harvested" }, // geospatial.md
	to_timestamp: { name: "to_timestamp", params: [{ name: "string" }, { name: "format" }], origin: "harvested" }, // teradata.md
	to_unixtime: { name: "to_unixtime", params: [{ name: "timestamp" }], origin: "harvested" }, // datetime.md
	to_utf8: { name: "to_utf8", params: [{ name: "string" }], origin: "harvested" }, // string.md
	transform: {
		name: "transform",
		params: [
			{ name: "array", type: "array" },
			{ name: "function", type: "lambda" },
		],
		origin: "curated",
	}, // curated: transform(array, function) - functions/lambda.html
	trim: { name: "trim", params: [{ name: "string" }], origin: "harvested" }, // string.md
	trim_array: { name: "trim_array", params: [{ name: "x" }, { name: "n" }], origin: "harvested" }, // array.md
	truncate: { name: "truncate", params: [{ name: "x" }, { name: "d", optional: true }], origin: "harvested" }, // math.md
	try: { name: "try", params: [{ name: "expression" }], origin: "harvested" }, // conditional.md
	typeof: { name: "typeof", params: [{ name: "expr" }], origin: "harvested" }, // conversion.md
	upper: { name: "upper", params: [{ name: "string" }], origin: "harvested" }, // string.md
	url_decode: { name: "url_decode", params: [{ name: "value" }], origin: "harvested" }, // url.md
	url_encode: { name: "url_encode", params: [{ name: "value" }], origin: "harvested" }, // url.md
	url_extract_fragment: { name: "url_extract_fragment", params: [{ name: "url" }], origin: "harvested" }, // url.md
	url_extract_host: { name: "url_extract_host", params: [{ name: "url" }], origin: "harvested" }, // url.md
	url_extract_parameter: {
		name: "url_extract_parameter",
		params: [{ name: "url" }, { name: "name" }],
		origin: "harvested",
	}, // url.md
	url_extract_path: { name: "url_extract_path", params: [{ name: "url" }], origin: "harvested" }, // url.md
	url_extract_port: { name: "url_extract_port", params: [{ name: "url" }], origin: "harvested" }, // url.md
	url_extract_protocol: { name: "url_extract_protocol", params: [{ name: "url" }], origin: "harvested" }, // url.md
	url_extract_query: { name: "url_extract_query", params: [{ name: "url" }], origin: "harvested" }, // url.md
	uuid: { name: "uuid", params: [], origin: "harvested" }, // uuid.md
	value_at_quantile: {
		name: "value_at_quantile",
		params: [{ name: "tdigest" }, { name: "quantile" }],
		origin: "harvested",
	}, // tdigest.md
	values_at_quantiles: {
		name: "values_at_quantiles",
		params: [{ name: "tdigest" }, { name: "quantiles" }],
		origin: "harvested",
	}, // tdigest.md
	var_pop: { name: "var_pop", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	var_samp: { name: "var_samp", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	variance: { name: "variance", params: [{ name: "x" }], origin: "harvested" }, // aggregate.md
	variant_is_null: { name: "variant_is_null", params: [{ name: "variant" }], origin: "harvested" }, // variant.md
	version: { name: "version", params: [], origin: "harvested" }, // system.md
	week: { name: "week", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	week_of_year: { name: "week_of_year", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	wilson_interval_lower: {
		name: "wilson_interval_lower",
		params: [{ name: "successes" }, { name: "trials" }, { name: "z" }],
		origin: "harvested",
	}, // math.md
	wilson_interval_upper: {
		name: "wilson_interval_upper",
		params: [{ name: "successes" }, { name: "trials" }, { name: "z" }],
		origin: "harvested",
	}, // math.md
	word_stem: { name: "word_stem", params: [{ name: "word" }, { name: "lang", optional: true }], origin: "harvested" }, // string.md
	xxhash64: { name: "xxhash64", params: [{ name: "binary" }], origin: "harvested" }, // binary.md
	year: { name: "year", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	year_of_week: { name: "year_of_week", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	yow: { name: "yow", params: [{ name: "x" }], origin: "harvested" }, // datetime.md
	zip: { name: "zip", params: [{ name: "array1" }, { name: "array2" }], variadic: true, origin: "harvested" }, // array.md
};
