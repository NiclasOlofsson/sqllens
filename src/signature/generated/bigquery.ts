// GENERATED — do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// Source: google/googlesql reference markdown  vendor/googlesql-docs/docs/*.md (per-function heading + syntax fences)
// Harvested 2026-07-14. 295 signatures. Curated FUNCTION_SIGNATURES override these.
import type { FnSignature } from "../signatures.js";

/** Harvested (doc-syntax-derived) parameter signatures for bigquery, keyed by lowercased name. */
export const BIGQUERY_HARVESTED: Record<string, FnSignature> = {
	abs: { name: "ABS", params: [{ name: "X" }] }, // mathematical_functions.md
	acos: { name: "ACOS", params: [{ name: "X" }] }, // mathematical_functions.md
	acosh: { name: "ACOSH", params: [{ name: "X" }] }, // mathematical_functions.md
	agg: { name: "AGG", params: [{ name: "measure_expression" }] }, // aggregate_functions.md
	array: { name: "ARRAY", params: [{ name: "subquery" }] }, // array_functions.md
	array_avg: { name: "ARRAY_AVG", params: [{ name: "input_array" }] }, // array_functions.md
	array_concat: { name: "ARRAY_CONCAT", params: [{ name: "array_expression" }], variadic: true }, // array_functions.md
	array_first: { name: "ARRAY_FIRST", params: [{ name: "array_expression" }] }, // array_functions.md
	array_includes: { name: "ARRAY_INCLUDES", params: [{ name: "array_to_search" }, { name: "search_value" }] }, // array_functions.md
	array_includes_all: {
		name: "ARRAY_INCLUDES_ALL",
		params: [{ name: "array_to_search" }, { name: "search_values" }],
	}, // array_functions.md
	array_includes_any: {
		name: "ARRAY_INCLUDES_ANY",
		params: [{ name: "array_to_search" }, { name: "search_values" }],
	}, // array_functions.md
	array_is_distinct: { name: "ARRAY_IS_DISTINCT", params: [{ name: "value" }] }, // array_functions.md
	array_last: { name: "ARRAY_LAST", params: [{ name: "array_expression" }] }, // array_functions.md
	array_length: { name: "ARRAY_LENGTH", params: [{ name: "array_expression" }] }, // array_functions.md
	array_max: { name: "ARRAY_MAX", params: [{ name: "input_array" }] }, // array_functions.md
	array_min: { name: "ARRAY_MIN", params: [{ name: "input_array" }] }, // array_functions.md
	array_reverse: { name: "ARRAY_REVERSE", params: [{ name: "value" }] }, // array_functions.md
	array_slice: {
		name: "ARRAY_SLICE",
		params: [{ name: "array_to_slice" }, { name: "start_offset" }, { name: "end_offset" }],
	}, // array_functions.md
	array_sum: { name: "ARRAY_SUM", params: [{ name: "input_array" }] }, // array_functions.md
	array_to_string: {
		name: "ARRAY_TO_STRING",
		params: [{ name: "array_expression" }, { name: "delimiter" }, { name: "null_text", optional: true }],
	}, // array_functions.md
	ascii: { name: "ASCII", params: [{ name: "value" }] }, // string_functions.md
	asin: { name: "ASIN", params: [{ name: "X" }] }, // mathematical_functions.md
	asinh: { name: "ASINH", params: [{ name: "X" }] }, // mathematical_functions.md
	atan: { name: "ATAN", params: [{ name: "X" }] }, // mathematical_functions.md
	atan2: { name: "ATAN2", params: [{ name: "X" }, { name: "Y" }] }, // mathematical_functions.md
	atanh: { name: "ATANH", params: [{ name: "X" }] }, // mathematical_functions.md
	bit_cast_to_int32: { name: "BIT_CAST_TO_INT32", params: [{ name: "value" }] }, // bit_functions.md
	bit_cast_to_int64: { name: "BIT_CAST_TO_INT64", params: [{ name: "value" }] }, // bit_functions.md
	bit_cast_to_uint32: { name: "BIT_CAST_TO_UINT32", params: [{ name: "value" }] }, // bit_functions.md
	bit_cast_to_uint64: { name: "BIT_CAST_TO_UINT64", params: [{ name: "value" }] }, // bit_functions.md
	bit_count: { name: "BIT_COUNT", params: [{ name: "expression" }] }, // bit_functions.md
	bool: { name: "BOOL", params: [{ name: "json_expr" }] }, // json_functions.md
	bool_array: { name: "BOOL_ARRAY", params: [{ name: "json_expr" }] }, // json_functions.md
	byte_length: { name: "BYTE_LENGTH", params: [{ name: "value" }] }, // string_functions.md
	cbrt: { name: "CBRT", params: [{ name: "X" }] }, // mathematical_functions.md
	ceil: { name: "CEIL", params: [{ name: "X" }] }, // mathematical_functions.md
	ceiling: { name: "CEILING", params: [{ name: "X" }] }, // mathematical_functions.md
	char_length: { name: "CHAR_LENGTH", params: [{ name: "value" }] }, // string_functions.md
	character_length: { name: "CHARACTER_LENGTH", params: [{ name: "value" }] }, // string_functions.md
	chr: { name: "CHR", params: [{ name: "value" }] }, // string_functions.md
	coalesce: { name: "COALESCE", params: [{ name: "expr" }], variadic: true }, // conditional_expressions.md
	code_points_to_bytes: { name: "CODE_POINTS_TO_BYTES", params: [{ name: "ascii_code_points" }] }, // string_functions.md
	code_points_to_string: { name: "CODE_POINTS_TO_STRING", params: [{ name: "unicode_code_points" }] }, // string_functions.md
	collate: { name: "COLLATE", params: [{ name: "value" }, { name: "collate_specification" }] }, // string_functions.md
	concat: { name: "CONCAT", params: [{ name: "value1" }], variadic: true }, // string_functions.md
	cos: { name: "COS", params: [{ name: "X" }] }, // mathematical_functions.md
	cosh: { name: "COSH", params: [{ name: "X" }] }, // mathematical_functions.md
	cosine_distance: { name: "COSINE_DISTANCE", params: [{ name: "vector1" }, { name: "vector2" }] }, // mathematical_functions.md
	cot: { name: "COT", params: [{ name: "X" }] }, // mathematical_functions.md
	coth: { name: "COTH", params: [{ name: "X" }] }, // mathematical_functions.md
	csc: { name: "CSC", params: [{ name: "X" }] }, // mathematical_functions.md
	csch: { name: "CSCH", params: [{ name: "X" }] }, // mathematical_functions.md
	current_date: { name: "CURRENT_DATE", params: [{ name: "time_zone_expression", optional: true }] }, // date_functions.md
	current_timestamp: { name: "CURRENT_TIMESTAMP", params: [] }, // timestamp_functions.md
	date_bucket: {
		name: "DATE_BUCKET",
		params: [{ name: "date_in_bucket" }, { name: "bucket_width" }, { name: "bucket_origin_date", optional: true }],
	}, // time-series-functions.md
	date_diff: { name: "DATE_DIFF", params: [{ name: "end_date" }, { name: "start_date" }, { name: "granularity" }] }, // date_functions.md
	date_from_unix_date: { name: "DATE_FROM_UNIX_DATE", params: [{ name: "int64_expression" }] }, // date_functions.md
	datetime_bucket: {
		name: "DATETIME_BUCKET",
		params: [
			{ name: "datetime_in_bucket" },
			{ name: "bucket_width" },
			{ name: "bucket_origin_datetime", optional: true },
		],
	}, // time-series-functions.md
	datetime_diff: {
		name: "DATETIME_DIFF",
		params: [{ name: "end_datetime" }, { name: "start_datetime" }, { name: "granularity" }],
	}, // datetime_functions.md
	destination_node_id: { name: "DESTINATION_NODE_ID", params: [{ name: "edge_element" }] }, // graph-gql-functions.md
	div: { name: "DIV", params: [{ name: "X" }, { name: "Y" }] }, // mathematical_functions.md
	edges: { name: "EDGES", params: [{ name: "graph_path" }] }, // graph-gql-functions.md
	element_definition_name: { name: "ELEMENT_DEFINITION_NAME", params: [{ name: "element" }] }, // graph-gql-functions.md
	element_id: { name: "ELEMENT_ID", params: [{ name: "element" }] }, // graph-gql-functions.md
	ends_with: { name: "ENDS_WITH", params: [{ name: "value" }, { name: "suffix" }] }, // string_functions.md
	enum_value_descriptor_proto: { name: "ENUM_VALUE_DESCRIPTOR_PROTO", params: [{ name: "proto_enum" }] }, // protocol_buffer_functions.md
	error: { name: "ERROR", params: [{ name: "error_message" }] }, // debugging_functions.md
	euclidean_distance: { name: "EUCLIDEAN_DISTANCE", params: [{ name: "vector1" }, { name: "vector2" }] }, // mathematical_functions.md
	exp: { name: "EXP", params: [{ name: "X" }] }, // mathematical_functions.md
	farm_fingerprint: { name: "FARM_FINGERPRINT", params: [{ name: "value" }] }, // hash_functions.md
	flatten: { name: "FLATTEN", params: [{ name: "array_elements_field_access_expression" }] }, // array_functions.md
	floor: { name: "FLOOR", params: [{ name: "X" }] }, // mathematical_functions.md
	format: {
		name: "FORMAT",
		params: [{ name: "format_string_expression" }, { name: "data_type_expression" }],
		variadic: true,
	}, // string_functions.md
	format_date: { name: "FORMAT_DATE", params: [{ name: "format_string" }, { name: "date_expr" }] }, // date_functions.md
	format_datetime: { name: "FORMAT_DATETIME", params: [{ name: "format_string" }, { name: "datetime_expr" }] }, // datetime_functions.md
	format_time: { name: "FORMAT_TIME", params: [{ name: "format_string" }, { name: "time_expr" }] }, // time_functions.md
	format_timestamp: {
		name: "FORMAT_TIMESTAMP",
		params: [{ name: "format_string" }, { name: "timestamp_expr" }, { name: "time_zone", optional: true }],
	}, // timestamp_functions.md
	from_base32: { name: "FROM_BASE32", params: [{ name: "string_expr" }] }, // string_functions.md
	from_base64: { name: "FROM_BASE64", params: [{ name: "string_expr" }] }, // string_functions.md
	from_hex: { name: "FROM_HEX", params: [{ name: "string" }] }, // string_functions.md
	from_proto: { name: "FROM_PROTO", params: [{ name: "expression" }] }, // protocol_buffer_functions.md
	generate_array: {
		name: "GENERATE_ARRAY",
		params: [{ name: "start_expression" }, { name: "end_expression" }, { name: "step_expression", optional: true }],
	}, // array_functions.md
	generate_range_array: {
		name: "GENERATE_RANGE_ARRAY",
		params: [
			{ name: "range_to_split" },
			{ name: "step_interval" },
			{ name: "include_last_partial_range", optional: true },
		],
	}, // range-functions.md
	grouping: { name: "GROUPING", params: [{ name: "groupable_value" }] }, // aggregate_functions.md
	ieee_divide: { name: "IEEE_DIVIDE", params: [{ name: "X" }, { name: "Y" }] }, // mathematical_functions.md
	if: { name: "IF", params: [{ name: "expr" }, { name: "true_result" }, { name: "else_result" }] }, // conditional_expressions.md
	iferror: { name: "IFERROR", params: [{ name: "try_expression" }, { name: "catch_expression" }] }, // debugging_functions.md
	ifnull: { name: "IFNULL", params: [{ name: "expr" }, { name: "null_result" }] }, // conditional_expressions.md
	initcap: { name: "INITCAP", params: [{ name: "value" }, { name: "delimiters", optional: true }] }, // string_functions.md
	instr: {
		name: "INSTR",
		params: [
			{ name: "value" },
			{ name: "subvalue" },
			{ name: "position", optional: true },
			{ name: "occurrence", optional: true },
		],
	}, // string_functions.md
	int32: { name: "INT32", params: [{ name: "json_expr" }] }, // json_functions.md
	int32_array: { name: "INT32_ARRAY", params: [{ name: "json_expr" }] }, // json_functions.md
	int64: { name: "INT64", params: [{ name: "json_expr" }] }, // json_functions.md
	int64_array: { name: "INT64_ARRAY", params: [{ name: "json_expr" }] }, // json_functions.md
	is_acyclic: { name: "IS_ACYCLIC", params: [{ name: "graph_path" }] }, // graph-gql-functions.md
	is_inf: { name: "IS_INF", params: [{ name: "X" }] }, // mathematical_functions.md
	is_nan: { name: "IS_NAN", params: [{ name: "X" }] }, // mathematical_functions.md
	is_simple: { name: "IS_SIMPLE", params: [{ name: "graph_path" }] }, // graph-gql-functions.md
	is_trail: { name: "IS_TRAIL", params: [{ name: "graph_path" }] }, // graph-gql-functions.md
	iserror: { name: "ISERROR", params: [{ name: "try_expression" }] }, // debugging_functions.md
	json_contains: { name: "JSON_CONTAINS", params: [{ name: "json_expr" }, { name: "json_expr" }] }, // json_functions.md
	json_flatten: { name: "JSON_FLATTEN", params: [{ name: "json_expr" }] }, // json_functions.md
	json_object: { name: "JSON_OBJECT", params: [{ name: "json_key_array" }, { name: "json_value_array" }] }, // json_functions.md
	json_remove: { name: "JSON_REMOVE", params: [{ name: "json_expr" }, { name: "json_path" }], variadic: true }, // json_functions.md
	json_type: { name: "JSON_TYPE", params: [{ name: "json_expr" }] }, // json_functions.md
	justify_days: { name: "JUSTIFY_DAYS", params: [{ name: "interval_expression" }] }, // interval_functions.md
	justify_hours: { name: "JUSTIFY_HOURS", params: [{ name: "interval_expression" }] }, // interval_functions.md
	justify_interval: { name: "JUSTIFY_INTERVAL", params: [{ name: "interval_expression" }] }, // interval_functions.md
	labels: { name: "LABELS", params: [{ name: "element" }] }, // graph-gql-functions.md
	lax_bool: { name: "LAX_BOOL", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_bool_array: { name: "LAX_BOOL_ARRAY", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_double: { name: "LAX_DOUBLE", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_double_array: { name: "LAX_DOUBLE_ARRAY", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_float: { name: "LAX_FLOAT", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_float_array: { name: "LAX_FLOAT_ARRAY", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_int32: { name: "LAX_INT32", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_int32_array: { name: "LAX_INT32_ARRAY", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_int64: { name: "LAX_INT64", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_int64_array: { name: "LAX_INT64_ARRAY", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_string: { name: "LAX_STRING", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_string_array: { name: "LAX_STRING_ARRAY", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_uint32: { name: "LAX_UINT32", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_uint32_array: { name: "LAX_UINT32_ARRAY", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_uint64: { name: "LAX_UINT64", params: [{ name: "json_expr" }] }, // json_functions.md
	lax_uint64_array: { name: "LAX_UINT64_ARRAY", params: [{ name: "json_expr" }] }, // json_functions.md
	left: { name: "LEFT", params: [{ name: "value" }, { name: "length" }] }, // string_functions.md
	length: { name: "LENGTH", params: [{ name: "value" }] }, // string_functions.md
	ln: { name: "LN", params: [{ name: "X" }] }, // mathematical_functions.md
	log: { name: "LOG", params: [{ name: "X" }, { name: "Y", optional: true }] }, // mathematical_functions.md
	log10: { name: "LOG10", params: [{ name: "X" }] }, // mathematical_functions.md
	lower: { name: "LOWER", params: [{ name: "value" }] }, // string_functions.md
	lpad: {
		name: "LPAD",
		params: [{ name: "original_value" }, { name: "return_length" }, { name: "pattern", optional: true }],
	}, // string_functions.md
	ltrim: { name: "LTRIM", params: [{ name: "value1" }, { name: "value2", optional: true }] }, // string_functions.md
	md5: { name: "MD5", params: [{ name: "input" }] }, // hash_functions.md
	mod: { name: "MOD", params: [{ name: "X" }, { name: "Y" }] }, // mathematical_functions.md
	nodes: { name: "NODES", params: [{ name: "graph_path" }] }, // graph-gql-functions.md
	normalize: { name: "NORMALIZE", params: [{ name: "value" }, { name: "normalization_mode", optional: true }] }, // string_functions.md
	normalize_and_casefold: {
		name: "NORMALIZE_AND_CASEFOLD",
		params: [{ name: "value" }, { name: "normalization_mode", optional: true }],
	}, // string_functions.md
	nullif: { name: "NULLIF", params: [{ name: "expr" }, { name: "expr_to_match" }] }, // conditional_expressions.md
	nulliferror: { name: "NULLIFERROR", params: [{ name: "try_expression" }] }, // debugging_functions.md
	nullifzero: { name: "NULLIFZERO", params: [{ name: "expr" }] }, // conditional_expressions.md
	octet_length: { name: "OCTET_LENGTH", params: [{ name: "value" }] }, // string_functions.md
	parse_bignumeric: { name: "PARSE_BIGNUMERIC", params: [{ name: "string_expression" }] }, // conversion_functions.md
	parse_date: { name: "PARSE_DATE", params: [{ name: "format_string" }, { name: "date_string" }] }, // date_functions.md
	parse_datetime: { name: "PARSE_DATETIME", params: [{ name: "format_string" }, { name: "datetime_string" }] }, // datetime_functions.md
	parse_numeric: { name: "PARSE_NUMERIC", params: [{ name: "string_expression" }] }, // conversion_functions.md
	parse_time: { name: "PARSE_TIME", params: [{ name: "format_string" }, { name: "time_string" }] }, // time_functions.md
	parse_timestamp: {
		name: "PARSE_TIMESTAMP",
		params: [{ name: "format_string" }, { name: "timestamp_string" }, { name: "time_zone", optional: true }],
	}, // timestamp_functions.md
	path: { name: "PATH", params: [{ name: "graph_element" }], variadic: true }, // graph-gql-functions.md
	path_first: { name: "PATH_FIRST", params: [{ name: "graph_path" }] }, // graph-gql-functions.md
	path_last: { name: "PATH_LAST", params: [{ name: "graph_path" }] }, // graph-gql-functions.md
	path_length: { name: "PATH_LENGTH", params: [{ name: "graph_path" }] }, // graph-gql-functions.md
	pi: { name: "PI", params: [] }, // mathematical_functions.md
	pi_bignumeric: { name: "PI_BIGNUMERIC", params: [] }, // mathematical_functions.md
	pi_numeric: { name: "PI_NUMERIC", params: [] }, // mathematical_functions.md
	pow: { name: "POW", params: [{ name: "X" }, { name: "Y" }] }, // mathematical_functions.md
	power: { name: "POWER", params: [{ name: "X" }, { name: "Y" }] }, // mathematical_functions.md
	property_names: { name: "PROPERTY_NAMES", params: [{ name: "element" }] }, // graph-gql-functions.md
	proto_default_if_null: { name: "PROTO_DEFAULT_IF_NULL", params: [{ name: "proto_field_expression" }] }, // protocol_buffer_functions.md
	proto_map_contains_key: {
		name: "PROTO_MAP_CONTAINS_KEY",
		params: [{ name: "proto_map_field_expression" }, { name: "key" }],
	}, // protocol_buffer_functions.md
	rand: { name: "RAND", params: [] }, // mathematical_functions.md
	range: { name: "RANGE", params: [{ name: "lower_bound" }, { name: "upper_bound" }] }, // range-functions.md
	range_bucket: { name: "RANGE_BUCKET", params: [{ name: "point" }, { name: "boundaries_array" }] }, // mathematical_functions.md
	range_end: { name: "RANGE_END", params: [{ name: "range_to_check" }] }, // range-functions.md
	range_intersect: { name: "RANGE_INTERSECT", params: [{ name: "range_a" }, { name: "range_b" }] }, // range-functions.md
	range_overlaps: { name: "RANGE_OVERLAPS", params: [{ name: "range_a" }, { name: "range_b" }] }, // range-functions.md
	range_start: { name: "RANGE_START", params: [{ name: "range_to_check" }] }, // range-functions.md
	regexp_contains: { name: "REGEXP_CONTAINS", params: [{ name: "value" }, { name: "regexp" }] }, // string_functions.md
	regexp_extract: {
		name: "REGEXP_EXTRACT",
		params: [
			{ name: "value" },
			{ name: "regexp" },
			{ name: "position", optional: true },
			{ name: "occurrence", optional: true },
		],
	}, // string_functions.md
	regexp_extract_all: { name: "REGEXP_EXTRACT_ALL", params: [{ name: "value" }, { name: "regexp" }] }, // string_functions.md
	regexp_extract_groups: { name: "REGEXP_EXTRACT_GROUPS", params: [{ name: "value" }, { name: "regexp" }] }, // string_functions.md
	regexp_match: { name: "REGEXP_MATCH", params: [{ name: "value" }, { name: "regexp" }] }, // string_functions.md
	regexp_replace: {
		name: "REGEXP_REPLACE",
		params: [{ name: "value" }, { name: "regexp" }, { name: "replacement" }],
	}, // string_functions.md
	regexp_substr: {
		name: "REGEXP_SUBSTR",
		params: [
			{ name: "value" },
			{ name: "regexp" },
			{ name: "position", optional: true },
			{ name: "occurrence", optional: true },
		],
	}, // string_functions.md
	repeat: { name: "REPEAT", params: [{ name: "original_value" }, { name: "repetitions" }] }, // string_functions.md
	replace: {
		name: "REPLACE",
		params: [{ name: "original_value" }, { name: "from_pattern" }, { name: "to_pattern" }],
	}, // string_functions.md
	reverse: { name: "REVERSE", params: [{ name: "value" }] }, // string_functions.md
	right: { name: "RIGHT", params: [{ name: "value" }, { name: "length" }] }, // string_functions.md
	round: {
		name: "ROUND",
		params: [{ name: "X" }, { name: "N", optional: true }, { name: "rounding_mode", optional: true }],
	}, // mathematical_functions.md
	rpad: {
		name: "RPAD",
		params: [{ name: "original_value" }, { name: "return_length" }, { name: "pattern", optional: true }],
	}, // string_functions.md
	rtrim: { name: "RTRIM", params: [{ name: "value1" }, { name: "value2", optional: true }] }, // string_functions.md
	safe_add: { name: "SAFE_ADD", params: [{ name: "X" }, { name: "Y" }] }, // mathematical_functions.md
	safe_convert_bytes_to_string: { name: "SAFE_CONVERT_BYTES_TO_STRING", params: [{ name: "value" }] }, // string_functions.md
	safe_divide: { name: "SAFE_DIVIDE", params: [{ name: "X" }, { name: "Y" }] }, // mathematical_functions.md
	safe_multiply: { name: "SAFE_MULTIPLY", params: [{ name: "X" }, { name: "Y" }] }, // mathematical_functions.md
	safe_negate: { name: "SAFE_NEGATE", params: [{ name: "X" }] }, // mathematical_functions.md
	safe_subtract: { name: "SAFE_SUBTRACT", params: [{ name: "X" }, { name: "Y" }] }, // mathematical_functions.md
	safe_to_json: { name: "SAFE_TO_JSON", params: [{ name: "sql_value" }] }, // json_functions.md
	sec: { name: "SEC", params: [{ name: "X" }] }, // mathematical_functions.md
	sech: { name: "SECH", params: [{ name: "X" }] }, // mathematical_functions.md
	session_user: { name: "SESSION_USER", params: [] }, // security_functions.md
	sha1: { name: "SHA1", params: [{ name: "input" }] }, // hash_functions.md
	sha256: { name: "SHA256", params: [{ name: "input" }] }, // hash_functions.md
	sha512: { name: "SHA512", params: [{ name: "input" }] }, // hash_functions.md
	sign: { name: "SIGN", params: [{ name: "X" }] }, // mathematical_functions.md
	sin: { name: "SIN", params: [{ name: "X" }] }, // mathematical_functions.md
	sinh: { name: "SINH", params: [{ name: "X" }] }, // mathematical_functions.md
	soundex: { name: "SOUNDEX", params: [{ name: "value" }] }, // string_functions.md
	source_node_id: { name: "SOURCE_NODE_ID", params: [{ name: "edge_element" }] }, // graph-gql-functions.md
	split: { name: "SPLIT", params: [{ name: "value" }, { name: "delimiter", optional: true }] }, // string_functions.md
	split_substr: {
		name: "SPLIT_SUBSTR",
		params: [{ name: "value" }, { name: "delimiter" }, { name: "start_split" }, { name: "count", optional: true }],
	}, // string_functions.md
	sqrt: { name: "SQRT", params: [{ name: "X" }] }, // mathematical_functions.md
	st_angle: {
		name: "ST_ANGLE",
		params: [{ name: "point_geography_1" }, { name: "point_geography_2" }, { name: "point_geography_3" }],
	}, // geography_functions.md
	st_area: { name: "ST_AREA", params: [{ name: "geography_expression" }, { name: "use_spheroid", optional: true }] }, // geography_functions.md
	st_asbinary: { name: "ST_ASBINARY", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_asgeojson: { name: "ST_ASGEOJSON", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_askml: { name: "ST_ASKML", params: [{ name: "geography" }] }, // geography_functions.md
	st_astext: { name: "ST_ASTEXT", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_azimuth: { name: "ST_AZIMUTH", params: [{ name: "point_geography_1" }, { name: "point_geography_2" }] }, // geography_functions.md
	st_boundary: { name: "ST_BOUNDARY", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_boundingbox: { name: "ST_BOUNDINGBOX", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_centroid: { name: "ST_CENTROID", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_closestpoint: {
		name: "ST_CLOSESTPOINT",
		params: [{ name: "geography_1" }, { name: "geography_2" }, { name: "use_spheroid", optional: true }],
	}, // geography_functions.md
	st_contains: { name: "ST_CONTAINS", params: [{ name: "geography_1" }, { name: "geography_2" }] }, // geography_functions.md
	st_convexhull: { name: "ST_CONVEXHULL", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_coveredby: { name: "ST_COVEREDBY", params: [{ name: "geography_1" }, { name: "geography_2" }] }, // geography_functions.md
	st_covers: { name: "ST_COVERS", params: [{ name: "geography_1" }, { name: "geography_2" }] }, // geography_functions.md
	st_difference: { name: "ST_DIFFERENCE", params: [{ name: "geography_1" }, { name: "geography_2" }] }, // geography_functions.md
	st_dimension: { name: "ST_DIMENSION", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_disjoint: { name: "ST_DISJOINT", params: [{ name: "geography_1" }, { name: "geography_2" }] }, // geography_functions.md
	st_distance: {
		name: "ST_DISTANCE",
		params: [{ name: "geography_1" }, { name: "geography_2" }, { name: "use_spheroid", optional: true }],
	}, // geography_functions.md
	st_dump: { name: "ST_DUMP", params: [{ name: "geography" }, { name: "dimension", optional: true }] }, // geography_functions.md
	st_dumppoints: { name: "ST_DUMPPOINTS", params: [{ name: "geography" }] }, // geography_functions.md
	st_dwithin: {
		name: "ST_DWITHIN",
		params: [
			{ name: "geography_1" },
			{ name: "geography_2" },
			{ name: "distance" },
			{ name: "use_spheroid", optional: true },
		],
	}, // geography_functions.md
	st_endpoint: { name: "ST_ENDPOINT", params: [{ name: "linestring_geography" }] }, // geography_functions.md
	st_equals: { name: "ST_EQUALS", params: [{ name: "geography_1" }, { name: "geography_2" }] }, // geography_functions.md
	st_extent: { name: "ST_EXTENT", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_exteriorring: { name: "ST_EXTERIORRING", params: [{ name: "polygon_geography" }] }, // geography_functions.md
	st_geogfrom: { name: "ST_GEOGFROM", params: [{ name: "expression" }] }, // geography_functions.md
	st_geogfromkml: { name: "ST_GEOGFROMKML", params: [{ name: "kml_geometry" }] }, // geography_functions.md
	st_geogpoint: { name: "ST_GEOGPOINT", params: [{ name: "longitude" }, { name: "latitude" }] }, // geography_functions.md
	st_geogpointfromgeohash: { name: "ST_GEOGPOINTFROMGEOHASH", params: [{ name: "geohash" }] }, // geography_functions.md
	st_geohash: {
		name: "ST_GEOHASH",
		params: [{ name: "geography_expression" }, { name: "maxchars", optional: true }],
	}, // geography_functions.md
	st_geometrytype: { name: "ST_GEOMETRYTYPE", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_interiorrings: { name: "ST_INTERIORRINGS", params: [{ name: "polygon_geography" }] }, // geography_functions.md
	st_intersection: { name: "ST_INTERSECTION", params: [{ name: "geography_1" }, { name: "geography_2" }] }, // geography_functions.md
	st_intersects: { name: "ST_INTERSECTS", params: [{ name: "geography_1" }, { name: "geography_2" }] }, // geography_functions.md
	st_intersectsbox: {
		name: "ST_INTERSECTSBOX",
		params: [{ name: "geography" }, { name: "lng1" }, { name: "lat1" }, { name: "lng2" }, { name: "lat2" }],
	}, // geography_functions.md
	st_isclosed: { name: "ST_ISCLOSED", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_iscollection: { name: "ST_ISCOLLECTION", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_isempty: { name: "ST_ISEMPTY", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_isring: { name: "ST_ISRING", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_length: {
		name: "ST_LENGTH",
		params: [{ name: "geography_expression" }, { name: "use_spheroid", optional: true }],
	}, // geography_functions.md
	st_lineinterpolatepoint: {
		name: "ST_LINEINTERPOLATEPOINT",
		params: [{ name: "linestring_geography" }, { name: "fraction" }],
	}, // geography_functions.md
	st_linelocatepoint: {
		name: "ST_LINELOCATEPOINT",
		params: [{ name: "linestring_geography" }, { name: "point_geography" }],
	}, // geography_functions.md
	st_makepolygon: {
		name: "ST_MAKEPOLYGON",
		params: [{ name: "polygon_shell" }, { name: "array_of_polygon_holes", optional: true }],
	}, // geography_functions.md
	st_makepolygonoriented: { name: "ST_MAKEPOLYGONORIENTED", params: [{ name: "array_of_geography" }] }, // geography_functions.md
	st_maxdistance: {
		name: "ST_MAXDISTANCE",
		params: [{ name: "geography_1" }, { name: "geography_2" }, { name: "use_spheroid", optional: true }],
	}, // geography_functions.md
	st_npoints: { name: "ST_NPOINTS", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_numgeometries: { name: "ST_NUMGEOMETRIES", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_numpoints: { name: "ST_NUMPOINTS", params: [{ name: "geography_expression" }] }, // geography_functions.md
	st_perimeter: {
		name: "ST_PERIMETER",
		params: [{ name: "geography_expression" }, { name: "use_spheroid", optional: true }],
	}, // geography_functions.md
	st_pointn: { name: "ST_POINTN", params: [{ name: "linestring_geography" }, { name: "index" }] }, // geography_functions.md
	st_simplify: { name: "ST_SIMPLIFY", params: [{ name: "geography" }, { name: "tolerance_meters" }] }, // geography_functions.md
	st_snaptogrid: { name: "ST_SNAPTOGRID", params: [{ name: "geography_expression" }, { name: "grid_size" }] }, // geography_functions.md
	st_startpoint: { name: "ST_STARTPOINT", params: [{ name: "linestring_geography" }] }, // geography_functions.md
	st_touches: { name: "ST_TOUCHES", params: [{ name: "geography_1" }, { name: "geography_2" }] }, // geography_functions.md
	st_union_agg: { name: "ST_UNION_AGG", params: [{ name: "geography" }] }, // geography_functions.md
	st_within: { name: "ST_WITHIN", params: [{ name: "geography_1" }, { name: "geography_2" }] }, // geography_functions.md
	st_x: { name: "ST_X", params: [{ name: "point_geography_expression" }] }, // geography_functions.md
	st_y: { name: "ST_Y", params: [{ name: "point_geography_expression" }] }, // geography_functions.md
	starts_with: { name: "STARTS_WITH", params: [{ name: "value" }, { name: "prefix" }] }, // string_functions.md
	string_array: { name: "STRING_ARRAY", params: [{ name: "json_expr" }] }, // json_functions.md
	strpos: { name: "STRPOS", params: [{ name: "value" }, { name: "subvalue" }] }, // string_functions.md
	substr: { name: "SUBSTR", params: [{ name: "value" }, { name: "position" }, { name: "length", optional: true }] }, // string_functions.md
	substring: {
		name: "SUBSTRING",
		params: [{ name: "value" }, { name: "position" }, { name: "length", optional: true }],
	}, // string_functions.md
	tan: { name: "TAN", params: [{ name: "X" }] }, // mathematical_functions.md
	tanh: { name: "TANH", params: [{ name: "X" }] }, // mathematical_functions.md
	time_diff: { name: "TIME_DIFF", params: [{ name: "end_time" }, { name: "start_time" }, { name: "granularity" }] }, // time_functions.md
	time_trunc: { name: "TIME_TRUNC", params: [{ name: "time_value" }, { name: "time_granularity" }] }, // time_functions.md
	timestamp_bucket: {
		name: "TIMESTAMP_BUCKET",
		params: [
			{ name: "timestamp_in_bucket" },
			{ name: "bucket_width" },
			{ name: "bucket_origin_timestamp", optional: true },
		],
	}, // time-series-functions.md
	timestamp_diff: {
		name: "TIMESTAMP_DIFF",
		params: [{ name: "end_timestamp" }, { name: "start_timestamp" }, { name: "granularity" }],
	}, // timestamp_functions.md
	timestamp_micros: { name: "TIMESTAMP_MICROS", params: [{ name: "int64_expression" }] }, // timestamp_functions.md
	timestamp_millis: { name: "TIMESTAMP_MILLIS", params: [{ name: "int64_expression" }] }, // timestamp_functions.md
	timestamp_seconds: { name: "TIMESTAMP_SECONDS", params: [{ name: "int64_expression" }] }, // timestamp_functions.md
	to_base32: { name: "TO_BASE32", params: [{ name: "bytes_expr" }] }, // string_functions.md
	to_base64: { name: "TO_BASE64", params: [{ name: "bytes_expr" }] }, // string_functions.md
	to_code_points: { name: "TO_CODE_POINTS", params: [{ name: "value" }] }, // string_functions.md
	to_hex: { name: "TO_HEX", params: [{ name: "bytes" }] }, // string_functions.md
	to_json_string: { name: "TO_JSON_STRING", params: [{ name: "value" }, { name: "pretty_print", optional: true }] }, // json_functions.md
	to_proto: { name: "TO_PROTO", params: [{ name: "expression" }] }, // protocol_buffer_functions.md
	translate: {
		name: "TRANSLATE",
		params: [{ name: "expression" }, { name: "source_characters" }, { name: "target_characters" }],
	}, // string_functions.md
	trim: {
		name: "TRIM",
		params: [{ name: "value_to_trim" }, { name: "set_of_characters_to_remove", optional: true }],
	}, // string_functions.md
	trunc: { name: "TRUNC", params: [{ name: "X" }, { name: "N", optional: true }] }, // mathematical_functions.md
	uint32: { name: "UINT32", params: [{ name: "json_expr" }] }, // json_functions.md
	uint32_array: { name: "UINT32_ARRAY", params: [{ name: "json_expr" }] }, // json_functions.md
	uint64: { name: "UINT64", params: [{ name: "json_expr" }] }, // json_functions.md
	uint64_array: { name: "UINT64_ARRAY", params: [{ name: "json_expr" }] }, // json_functions.md
	unicode: { name: "UNICODE", params: [{ name: "value" }] }, // string_functions.md
	unix_date: { name: "UNIX_DATE", params: [{ name: "date_expression" }] }, // date_functions.md
	unix_micros: { name: "UNIX_MICROS", params: [{ name: "timestamp_expression" }] }, // timestamp_functions.md
	unix_millis: { name: "UNIX_MILLIS", params: [{ name: "timestamp_expression" }] }, // timestamp_functions.md
	unix_seconds: { name: "UNIX_SECONDS", params: [{ name: "timestamp_expression" }] }, // timestamp_functions.md
	upper: { name: "UPPER", params: [{ name: "value" }] }, // string_functions.md
	zeroifnull: { name: "ZEROIFNULL", params: [{ name: "expr" }] }, // conditional_expressions.md
};
