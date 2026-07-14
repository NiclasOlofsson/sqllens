// GENERATED — do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// Source: postgresql.org PostgreSQL 18 DocBook SGML  vendor/postgres-sgml/func.sgml (`<para role="func_signature">` and `<synopsis>` blocks)
// Harvested 2026-07-14. 508 signatures. Curated FUNCTION_SIGNATURES override these.
import type { FnSignature } from "../signatures.js";

/** Harvested (doc-syntax-derived) parameter signatures for postgres, keyed by lowercased name. */
export const POSTGRES_HARVESTED: Record<string, FnSignature> = {
	abs: { name: "abs", params: [{ name: "numeric_type" }] }, // func.sgml
	acldefault: {
		name: "acldefault",
		params: [
			{ name: "type", type: '"char"' },
			{ name: "ownerId", type: "oid" },
		],
	}, // func.sgml
	aclexplode: { name: "aclexplode", params: [{ name: "aclitem[]" }] }, // func.sgml
	acos: { name: "acos", params: [{ name: "double precision" }] }, // func.sgml
	acosd: { name: "acosd", params: [{ name: "double precision" }] }, // func.sgml
	acosh: { name: "acosh", params: [{ name: "double precision" }] }, // func.sgml
	any_value: { name: "any_value", params: [{ name: "anyelement" }] }, // func.sgml
	area: { name: "area", params: [{ name: "geometric_type" }] }, // func.sgml
	array_append: { name: "array_append", params: [{ name: "anycompatiblearray" }, { name: "anycompatible" }] }, // func.sgml
	array_cat: { name: "array_cat", params: [{ name: "anycompatiblearray" }, { name: "anycompatiblearray" }] }, // func.sgml
	array_dims: { name: "array_dims", params: [{ name: "anyarray" }] }, // func.sgml
	array_fill: {
		name: "array_fill",
		params: [{ name: "anyelement" }, { name: "integer[]" }, { name: "integer[]", optional: true }],
	}, // func.sgml
	array_length: { name: "array_length", params: [{ name: "anyarray" }, { name: "integer" }] }, // func.sgml
	array_lower: { name: "array_lower", params: [{ name: "anyarray" }, { name: "integer" }] }, // func.sgml
	array_ndims: { name: "array_ndims", params: [{ name: "anyarray" }] }, // func.sgml
	array_position: {
		name: "array_position",
		params: [{ name: "anycompatiblearray" }, { name: "anycompatible" }, { name: "integer", optional: true }],
	}, // func.sgml
	array_positions: { name: "array_positions", params: [{ name: "anycompatiblearray" }, { name: "anycompatible" }] }, // func.sgml
	array_prepend: { name: "array_prepend", params: [{ name: "anycompatible" }, { name: "anycompatiblearray" }] }, // func.sgml
	array_remove: { name: "array_remove", params: [{ name: "anycompatiblearray" }, { name: "anycompatible" }] }, // func.sgml
	array_replace: {
		name: "array_replace",
		params: [{ name: "anycompatiblearray" }, { name: "anycompatible" }, { name: "anycompatible" }],
	}, // func.sgml
	array_reverse: { name: "array_reverse", params: [{ name: "anyarray" }] }, // func.sgml
	array_sample: {
		name: "array_sample",
		params: [
			{ name: "array", type: "anyarray" },
			{ name: "n", type: "integer" },
		],
	}, // func.sgml
	array_shuffle: { name: "array_shuffle", params: [{ name: "anyarray" }] }, // func.sgml
	array_sort: {
		name: "array_sort",
		params: [
			{ name: "array", type: "anyarray" },
			{ name: "descending", type: "boolean", optional: true },
			{ name: "nulls_first", type: "boolean", optional: true },
		],
	}, // func.sgml
	array_to_json: { name: "array_to_json", params: [{ name: "anyarray" }, { name: "boolean", optional: true }] }, // func.sgml
	array_to_string: {
		name: "array_to_string",
		params: [
			{ name: "array", type: "anyarray" },
			{ name: "delimiter", type: "text" },
			{ name: "null_string", type: "text", optional: true },
		],
	}, // func.sgml
	array_to_tsvector: { name: "array_to_tsvector", params: [{ name: "text[]" }] }, // func.sgml
	array_upper: { name: "array_upper", params: [{ name: "anyarray" }, { name: "integer" }] }, // func.sgml
	ascii: { name: "ascii", params: [{ name: "text" }] }, // func.sgml
	asin: { name: "asin", params: [{ name: "double precision" }] }, // func.sgml
	asind: { name: "asind", params: [{ name: "double precision" }] }, // func.sgml
	asinh: { name: "asinh", params: [{ name: "double precision" }] }, // func.sgml
	atan: { name: "atan", params: [{ name: "double precision" }] }, // func.sgml
	atan2: {
		name: "atan2",
		params: [
			{ name: "y", type: "double precision" },
			{ name: "x", type: "double precision" },
		],
	}, // func.sgml
	atan2d: {
		name: "atan2d",
		params: [
			{ name: "y", type: "double precision" },
			{ name: "x", type: "double precision" },
		],
	}, // func.sgml
	atand: { name: "atand", params: [{ name: "double precision" }] }, // func.sgml
	atanh: { name: "atanh", params: [{ name: "double precision" }] }, // func.sgml
	bool_and: { name: "bool_and", params: [{ name: "boolean" }] }, // func.sgml
	bool_or: { name: "bool_or", params: [{ name: "boolean" }] }, // func.sgml
	bound_box: { name: "bound_box", params: [{ name: "box" }, { name: "box" }] }, // func.sgml
	brin_desummarize_range: {
		name: "brin_desummarize_range",
		params: [
			{ name: "index", type: "regclass" },
			{ name: "blockNumber", type: "bigint" },
		],
	}, // func.sgml
	brin_summarize_new_values: { name: "brin_summarize_new_values", params: [{ name: "index", type: "regclass" }] }, // func.sgml
	brin_summarize_range: {
		name: "brin_summarize_range",
		params: [
			{ name: "index", type: "regclass" },
			{ name: "blockNumber", type: "bigint" },
		],
	}, // func.sgml
	broadcast: { name: "broadcast", params: [{ name: "inet" }] }, // func.sgml
	cardinality: { name: "cardinality", params: [{ name: "anyarray" }] }, // func.sgml
	casefold: { name: "casefold", params: [{ name: "text" }] }, // func.sgml
	cbrt: { name: "cbrt", params: [{ name: "double precision" }] }, // func.sgml
	center: { name: "center", params: [{ name: "geometric_type" }] }, // func.sgml
	char_length: { name: "char_length", params: [{ name: "text" }] }, // func.sgml
	character_length: { name: "character_length", params: [{ name: "text" }] }, // func.sgml
	chr: { name: "chr", params: [{ name: "integer" }] }, // func.sgml
	clock_timestamp: { name: "clock_timestamp", params: [] }, // func.sgml
	coalesce: { name: "COALESCE", params: [{ name: "value" }], variadic: true }, // func.sgml
	col_description: {
		name: "col_description",
		params: [
			{ name: "table", type: "oid" },
			{ name: "column", type: "integer" },
		],
	}, // func.sgml
	concat: {
		name: "concat",
		params: [
			{ name: "val1", type: '"any"' },
			{ name: "val2", type: '"any"', optional: true },
		],
		variadic: true,
	}, // func.sgml
	concat_ws: {
		name: "concat_ws",
		params: [
			{ name: "sep", type: "text" },
			{ name: "val1", type: '"any"' },
			{ name: "val2", type: '"any"', optional: true },
		],
		variadic: true,
	}, // func.sgml
	convert: {
		name: "convert",
		params: [
			{ name: "bytes", type: "bytea" },
			{ name: "src_encoding", type: "name" },
			{ name: "dest_encoding", type: "name" },
		],
	}, // func.sgml
	convert_from: {
		name: "convert_from",
		params: [
			{ name: "bytes", type: "bytea" },
			{ name: "src_encoding", type: "name" },
		],
	}, // func.sgml
	convert_to: {
		name: "convert_to",
		params: [
			{ name: "string", type: "text" },
			{ name: "dest_encoding", type: "name" },
		],
	}, // func.sgml
	corr: {
		name: "corr",
		params: [
			{ name: "Y", type: "double precision" },
			{ name: "X", type: "double precision" },
		],
	}, // func.sgml
	cos: { name: "cos", params: [{ name: "double precision" }] }, // func.sgml
	cosd: { name: "cosd", params: [{ name: "double precision" }] }, // func.sgml
	cosh: { name: "cosh", params: [{ name: "double precision" }] }, // func.sgml
	cot: { name: "cot", params: [{ name: "double precision" }] }, // func.sgml
	cotd: { name: "cotd", params: [{ name: "double precision" }] }, // func.sgml
	count: { name: "count", params: [{ name: '"any"' }] }, // func.sgml
	covar_pop: {
		name: "covar_pop",
		params: [
			{ name: "Y", type: "double precision" },
			{ name: "X", type: "double precision" },
		],
	}, // func.sgml
	covar_samp: {
		name: "covar_samp",
		params: [
			{ name: "Y", type: "double precision" },
			{ name: "X", type: "double precision" },
		],
	}, // func.sgml
	crc32: { name: "crc32", params: [{ name: "bytea" }] }, // func.sgml
	crc32c: { name: "crc32c", params: [{ name: "bytea" }] }, // func.sgml
	cume_dist: { name: "cume_dist", params: [{ name: "args", optional: true }] }, // func.sgml
	current_catalog: { name: "current_catalog", params: [] }, // func.sgml
	current_database: { name: "current_database", params: [] }, // func.sgml
	current_date: { name: "current_date", params: [] }, // func.sgml
	current_query: { name: "current_query", params: [] }, // func.sgml
	current_role: { name: "current_role", params: [] }, // func.sgml
	current_schema: { name: "current_schema", params: [] }, // func.sgml
	current_schemas: { name: "current_schemas", params: [{ name: "include_implicit", type: "boolean" }] }, // func.sgml
	current_setting: {
		name: "current_setting",
		params: [
			{ name: "setting_name", type: "text" },
			{ name: "missing_ok", type: "boolean", optional: true },
		],
	}, // func.sgml
	current_time: { name: "current_time", params: [{ name: "integer", optional: true }] }, // func.sgml
	current_timestamp: { name: "current_timestamp", params: [{ name: "integer", optional: true }] }, // func.sgml
	current_user: { name: "current_user", params: [] }, // func.sgml
	currval: { name: "currval", params: [{ name: "regclass" }] }, // func.sgml
	date_add: {
		name: "date_add",
		params: [{ name: "timestamp with time zone" }, { name: "interval" }, { name: "text", optional: true }],
	}, // func.sgml
	date_bin: { name: "date_bin", params: [{ name: "interval" }, { name: "timestamp" }, { name: "timestamp" }] }, // func.sgml
	date_subtract: {
		name: "date_subtract",
		params: [{ name: "timestamp with time zone" }, { name: "interval" }, { name: "text", optional: true }],
	}, // func.sgml
	decode: {
		name: "decode",
		params: [
			{ name: "string", type: "text" },
			{ name: "format", type: "text" },
		],
	}, // func.sgml
	degrees: { name: "degrees", params: [{ name: "double precision" }] }, // func.sgml
	dense_rank: { name: "dense_rank", params: [{ name: "args", optional: true }] }, // func.sgml
	diagonal: { name: "diagonal", params: [{ name: "box" }] }, // func.sgml
	diameter: { name: "diameter", params: [{ name: "circle" }] }, // func.sgml
	div: {
		name: "div",
		params: [
			{ name: "y", type: "numeric" },
			{ name: "x", type: "numeric" },
		],
	}, // func.sgml
	encode: {
		name: "encode",
		params: [
			{ name: "bytes", type: "bytea" },
			{ name: "format", type: "text" },
		],
	}, // func.sgml
	enum_first: { name: "enum_first", params: [{ name: "anyenum" }] }, // func.sgml
	enum_last: { name: "enum_last", params: [{ name: "anyenum" }] }, // func.sgml
	enum_range: { name: "enum_range", params: [{ name: "anyenum" }, { name: "anyenum", optional: true }] }, // func.sgml
	erf: { name: "erf", params: [{ name: "double precision" }] }, // func.sgml
	erfc: { name: "erfc", params: [{ name: "double precision" }] }, // func.sgml
	every: { name: "every", params: [{ name: "boolean" }] }, // func.sgml
	factorial: { name: "factorial", params: [{ name: "bigint" }] }, // func.sgml
	family: { name: "family", params: [{ name: "inet" }] }, // func.sgml
	first_value: { name: "first_value", params: [{ name: "value", type: "anyelement" }] }, // func.sgml
	format: {
		name: "format",
		params: [
			{ name: "formatstr", type: "text" },
			{ name: "formatarg", type: '"any"', optional: true },
		],
		variadic: true,
	}, // func.sgml
	format_type: {
		name: "format_type",
		params: [
			{ name: "type", type: "oid" },
			{ name: "typemod", type: "integer" },
		],
	}, // func.sgml
	gamma: { name: "gamma", params: [{ name: "double precision" }] }, // func.sgml
	gcd: { name: "gcd", params: [{ name: "numeric_type" }, { name: "numeric_type" }] }, // func.sgml
	gen_random_uuid: { name: "gen_random_uuid", params: [] }, // func.sgml
	generate_subscripts: {
		name: "generate_subscripts",
		params: [
			{ name: "array", type: "anyarray" },
			{ name: "dim", type: "integer" },
			{ name: "reverse", type: "boolean", optional: true },
		],
	}, // func.sgml
	get_byte: {
		name: "get_byte",
		params: [
			{ name: "bytes", type: "bytea" },
			{ name: "n", type: "integer" },
		],
	}, // func.sgml
	get_current_ts_config: { name: "get_current_ts_config", params: [] }, // func.sgml
	gin_clean_pending_list: { name: "gin_clean_pending_list", params: [{ name: "index", type: "regclass" }] }, // func.sgml
	greatest: { name: "GREATEST", params: [{ name: "value" }], variadic: true }, // func.sgml
	grouping: { name: "GROUPING", params: [{ name: "group_by_expression(s)" }] }, // func.sgml
	height: { name: "height", params: [{ name: "box" }] }, // func.sgml
	host: { name: "host", params: [{ name: "inet" }] }, // func.sgml
	hostmask: { name: "hostmask", params: [{ name: "inet" }] }, // func.sgml
	icu_unicode_version: { name: "icu_unicode_version", params: [] }, // func.sgml
	inet_client_addr: { name: "inet_client_addr", params: [] }, // func.sgml
	inet_client_port: { name: "inet_client_port", params: [] }, // func.sgml
	inet_merge: { name: "inet_merge", params: [{ name: "inet" }, { name: "inet" }] }, // func.sgml
	inet_same_family: { name: "inet_same_family", params: [{ name: "inet" }, { name: "inet" }] }, // func.sgml
	inet_server_addr: { name: "inet_server_addr", params: [] }, // func.sgml
	inet_server_port: { name: "inet_server_port", params: [] }, // func.sgml
	initcap: { name: "initcap", params: [{ name: "text" }] }, // func.sgml
	isclosed: { name: "isclosed", params: [{ name: "path" }] }, // func.sgml
	isopen: { name: "isopen", params: [{ name: "path" }] }, // func.sgml
	json_agg_strict: { name: "json_agg_strict", params: [{ name: "anyelement" }] }, // func.sgml
	json_array_elements: { name: "json_array_elements", params: [{ name: "json" }] }, // func.sgml
	json_array_elements_text: { name: "json_array_elements_text", params: [{ name: "json" }] }, // func.sgml
	json_array_length: { name: "json_array_length", params: [{ name: "json" }] }, // func.sgml
	json_build_array: { name: "json_build_array", params: [{ name: '"any"' }], variadic: true }, // func.sgml
	json_build_object: { name: "json_build_object", params: [{ name: '"any"' }], variadic: true }, // func.sgml
	json_each: { name: "json_each", params: [{ name: "json" }] }, // func.sgml
	json_each_text: { name: "json_each_text", params: [{ name: "json" }] }, // func.sgml
	json_extract_path: {
		name: "json_extract_path",
		params: [
			{ name: "from_json", type: "json" },
			{ name: "path_elems", type: "text[]" },
		],
		variadic: true,
	}, // func.sgml
	json_extract_path_text: {
		name: "json_extract_path_text",
		params: [
			{ name: "from_json", type: "json" },
			{ name: "path_elems", type: "text[]" },
		],
		variadic: true,
	}, // func.sgml
	json_object_agg_strict: {
		name: "json_object_agg_strict",
		params: [
			{ name: "key", type: '"any"' },
			{ name: "value", type: '"any"' },
		],
	}, // func.sgml
	json_object_agg_unique: {
		name: "json_object_agg_unique",
		params: [
			{ name: "key", type: '"any"' },
			{ name: "value", type: '"any"' },
		],
	}, // func.sgml
	json_object_agg_unique_strict: {
		name: "json_object_agg_unique_strict",
		params: [
			{ name: "key", type: '"any"' },
			{ name: "value", type: '"any"' },
		],
	}, // func.sgml
	json_object_keys: { name: "json_object_keys", params: [{ name: "json" }] }, // func.sgml
	json_populate_record: {
		name: "json_populate_record",
		params: [
			{ name: "base", type: "anyelement" },
			{ name: "from_json", type: "json" },
		],
	}, // func.sgml
	json_populate_recordset: {
		name: "json_populate_recordset",
		params: [
			{ name: "base", type: "anyelement" },
			{ name: "from_json", type: "json" },
		],
	}, // func.sgml
	json_scalar: { name: "json_scalar", params: [{ name: "expression" }] }, // func.sgml
	json_strip_nulls: {
		name: "json_strip_nulls",
		params: [
			{ name: "target", type: "json" },
			{ name: "strip_in_arrays", type: "boolean", optional: true },
		],
	}, // func.sgml
	json_to_record: { name: "json_to_record", params: [{ name: "json" }] }, // func.sgml
	json_to_recordset: { name: "json_to_recordset", params: [{ name: "json" }] }, // func.sgml
	json_typeof: { name: "json_typeof", params: [{ name: "json" }] }, // func.sgml
	jsonb_agg_strict: { name: "jsonb_agg_strict", params: [{ name: "anyelement" }] }, // func.sgml
	jsonb_array_elements: { name: "jsonb_array_elements", params: [{ name: "jsonb" }] }, // func.sgml
	jsonb_array_elements_text: { name: "jsonb_array_elements_text", params: [{ name: "jsonb" }] }, // func.sgml
	jsonb_array_length: { name: "jsonb_array_length", params: [{ name: "jsonb" }] }, // func.sgml
	jsonb_build_array: { name: "jsonb_build_array", params: [{ name: '"any"' }], variadic: true }, // func.sgml
	jsonb_build_object: { name: "jsonb_build_object", params: [{ name: '"any"' }], variadic: true }, // func.sgml
	jsonb_each: { name: "jsonb_each", params: [{ name: "jsonb" }] }, // func.sgml
	jsonb_each_text: { name: "jsonb_each_text", params: [{ name: "jsonb" }] }, // func.sgml
	jsonb_extract_path: {
		name: "jsonb_extract_path",
		params: [
			{ name: "from_json", type: "jsonb" },
			{ name: "path_elems", type: "text[]" },
		],
		variadic: true,
	}, // func.sgml
	jsonb_extract_path_text: {
		name: "jsonb_extract_path_text",
		params: [
			{ name: "from_json", type: "jsonb" },
			{ name: "path_elems", type: "text[]" },
		],
		variadic: true,
	}, // func.sgml
	jsonb_insert: {
		name: "jsonb_insert",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "path", type: "text[]" },
			{ name: "new_value", type: "jsonb" },
			{ name: "insert_after", type: "boolean", optional: true },
		],
	}, // func.sgml
	jsonb_object_agg_strict: {
		name: "jsonb_object_agg_strict",
		params: [
			{ name: "key", type: '"any"' },
			{ name: "value", type: '"any"' },
		],
	}, // func.sgml
	jsonb_object_agg_unique: {
		name: "jsonb_object_agg_unique",
		params: [
			{ name: "key", type: '"any"' },
			{ name: "value", type: '"any"' },
		],
	}, // func.sgml
	jsonb_object_agg_unique_strict: {
		name: "jsonb_object_agg_unique_strict",
		params: [
			{ name: "key", type: '"any"' },
			{ name: "value", type: '"any"' },
		],
	}, // func.sgml
	jsonb_object_keys: { name: "jsonb_object_keys", params: [{ name: "jsonb" }] }, // func.sgml
	jsonb_path_exists: {
		name: "jsonb_path_exists",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "path", type: "jsonpath" },
			{ name: "vars", type: "jsonb", optional: true },
			{ name: "silent", type: "boolean", optional: true },
		],
	}, // func.sgml
	jsonb_path_exists_tz: {
		name: "jsonb_path_exists_tz",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "path", type: "jsonpath" },
			{ name: "vars", type: "jsonb", optional: true },
			{ name: "silent", type: "boolean", optional: true },
		],
	}, // func.sgml
	jsonb_path_match: {
		name: "jsonb_path_match",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "path", type: "jsonpath" },
			{ name: "vars", type: "jsonb", optional: true },
			{ name: "silent", type: "boolean", optional: true },
		],
	}, // func.sgml
	jsonb_path_match_tz: {
		name: "jsonb_path_match_tz",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "path", type: "jsonpath" },
			{ name: "vars", type: "jsonb", optional: true },
			{ name: "silent", type: "boolean", optional: true },
		],
	}, // func.sgml
	jsonb_path_query: {
		name: "jsonb_path_query",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "path", type: "jsonpath" },
			{ name: "vars", type: "jsonb", optional: true },
			{ name: "silent", type: "boolean", optional: true },
		],
	}, // func.sgml
	jsonb_path_query_array: {
		name: "jsonb_path_query_array",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "path", type: "jsonpath" },
			{ name: "vars", type: "jsonb", optional: true },
			{ name: "silent", type: "boolean", optional: true },
		],
	}, // func.sgml
	jsonb_path_query_array_tz: {
		name: "jsonb_path_query_array_tz",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "path", type: "jsonpath" },
			{ name: "vars", type: "jsonb", optional: true },
			{ name: "silent", type: "boolean", optional: true },
		],
	}, // func.sgml
	jsonb_path_query_first: {
		name: "jsonb_path_query_first",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "path", type: "jsonpath" },
			{ name: "vars", type: "jsonb", optional: true },
			{ name: "silent", type: "boolean", optional: true },
		],
	}, // func.sgml
	jsonb_path_query_first_tz: {
		name: "jsonb_path_query_first_tz",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "path", type: "jsonpath" },
			{ name: "vars", type: "jsonb", optional: true },
			{ name: "silent", type: "boolean", optional: true },
		],
	}, // func.sgml
	jsonb_path_query_tz: {
		name: "jsonb_path_query_tz",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "path", type: "jsonpath" },
			{ name: "vars", type: "jsonb", optional: true },
			{ name: "silent", type: "boolean", optional: true },
		],
	}, // func.sgml
	jsonb_populate_record: {
		name: "jsonb_populate_record",
		params: [
			{ name: "base", type: "anyelement" },
			{ name: "from_json", type: "jsonb" },
		],
	}, // func.sgml
	jsonb_populate_record_valid: {
		name: "jsonb_populate_record_valid",
		params: [
			{ name: "base", type: "anyelement" },
			{ name: "from_json", type: "json" },
		],
	}, // func.sgml
	jsonb_populate_recordset: {
		name: "jsonb_populate_recordset",
		params: [
			{ name: "base", type: "anyelement" },
			{ name: "from_json", type: "jsonb" },
		],
	}, // func.sgml
	jsonb_pretty: { name: "jsonb_pretty", params: [{ name: "jsonb" }] }, // func.sgml
	jsonb_set: {
		name: "jsonb_set",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "path", type: "text[]" },
			{ name: "new_value", type: "jsonb" },
			{ name: "create_if_missing", type: "boolean", optional: true },
		],
	}, // func.sgml
	jsonb_set_lax: {
		name: "jsonb_set_lax",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "path", type: "text[]" },
			{ name: "new_value", type: "jsonb" },
			{ name: "create_if_missing", type: "boolean", optional: true },
			{ name: "null_value_treatment", type: "text", optional: true },
		],
	}, // func.sgml
	jsonb_strip_nulls: {
		name: "jsonb_strip_nulls",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "strip_in_arrays", type: "boolean", optional: true },
		],
	}, // func.sgml
	jsonb_to_record: { name: "jsonb_to_record", params: [{ name: "jsonb" }] }, // func.sgml
	jsonb_to_recordset: { name: "jsonb_to_recordset", params: [{ name: "jsonb" }] }, // func.sgml
	jsonb_typeof: { name: "jsonb_typeof", params: [{ name: "jsonb" }] }, // func.sgml
	justify_days: { name: "justify_days", params: [{ name: "interval" }] }, // func.sgml
	justify_hours: { name: "justify_hours", params: [{ name: "interval" }] }, // func.sgml
	justify_interval: { name: "justify_interval", params: [{ name: "interval" }] }, // func.sgml
	lag: {
		name: "lag",
		params: [
			{ name: "value", type: "anycompatible" },
			{ name: "offset", type: "integer", optional: true },
			{ name: "default", type: "anycompatible", optional: true },
		],
	}, // func.sgml
	last_value: { name: "last_value", params: [{ name: "value", type: "anyelement" }] }, // func.sgml
	lastval: { name: "lastval", params: [] }, // func.sgml
	lcm: { name: "lcm", params: [{ name: "numeric_type" }, { name: "numeric_type" }] }, // func.sgml
	lead: {
		name: "lead",
		params: [
			{ name: "value", type: "anycompatible" },
			{ name: "offset", type: "integer", optional: true },
			{ name: "default", type: "anycompatible", optional: true },
		],
	}, // func.sgml
	least: { name: "LEAST", params: [{ name: "value" }], variadic: true }, // func.sgml
	left: {
		name: "left",
		params: [
			{ name: "string", type: "text" },
			{ name: "n", type: "integer" },
		],
	}, // func.sgml
	lgamma: { name: "lgamma", params: [{ name: "double precision" }] }, // func.sgml
	line: { name: "line", params: [{ name: "point" }, { name: "point" }] }, // func.sgml
	localtime: { name: "localtime", params: [{ name: "integer", optional: true }] }, // func.sgml
	localtimestamp: { name: "localtimestamp", params: [{ name: "integer", optional: true }] }, // func.sgml
	lpad: {
		name: "lpad",
		params: [
			{ name: "string", type: "text" },
			{ name: "length", type: "integer" },
			{ name: "fill", type: "text", optional: true },
		],
	}, // func.sgml
	macaddr8_set7bit: { name: "macaddr8_set7bit", params: [{ name: "macaddr8" }] }, // func.sgml
	make_date: {
		name: "make_date",
		params: [
			{ name: "year", type: "int" },
			{ name: "month", type: "int" },
			{ name: "day", type: "int" },
		],
	}, // func.sgml
	make_interval: {
		name: "make_interval",
		params: [
			{ name: "years", type: "int", optional: true },
			{ name: "months", type: "int", optional: true },
			{ name: "weeks", type: "int", optional: true },
			{ name: "days", type: "int", optional: true },
			{ name: "hours", type: "int", optional: true },
			{ name: "mins", type: "int", optional: true },
			{ name: "secs", type: "double precision", optional: true },
		],
	}, // func.sgml
	make_time: {
		name: "make_time",
		params: [
			{ name: "hour", type: "int" },
			{ name: "min", type: "int" },
			{ name: "sec", type: "double precision" },
		],
	}, // func.sgml
	make_timestamp: {
		name: "make_timestamp",
		params: [
			{ name: "year", type: "int" },
			{ name: "month", type: "int" },
			{ name: "day", type: "int" },
			{ name: "hour", type: "int" },
			{ name: "min", type: "int" },
			{ name: "sec", type: "double precision" },
		],
	}, // func.sgml
	make_timestamptz: {
		name: "make_timestamptz",
		params: [
			{ name: "year", type: "int" },
			{ name: "month", type: "int" },
			{ name: "day", type: "int" },
			{ name: "hour", type: "int" },
			{ name: "min", type: "int" },
			{ name: "sec", type: "double precision" },
			{ name: "timezone", type: "text", optional: true },
		],
	}, // func.sgml
	makeaclitem: {
		name: "makeaclitem",
		params: [
			{ name: "grantee", type: "oid" },
			{ name: "grantor", type: "oid" },
			{ name: "privileges", type: "text" },
			{ name: "is_grantable", type: "boolean" },
		],
	}, // func.sgml
	masklen: { name: "masklen", params: [{ name: "inet" }] }, // func.sgml
	max: { name: "max", params: [{ name: "see text" }] }, // func.sgml
	merge_action: { name: "merge_action", params: [] }, // func.sgml
	min: { name: "min", params: [{ name: "see text" }] }, // func.sgml
	min_scale: { name: "min_scale", params: [{ name: "numeric" }] }, // func.sgml
	mod: {
		name: "mod",
		params: [
			{ name: "y", type: "numeric_type" },
			{ name: "x", type: "numeric_type" },
		],
	}, // func.sgml
	mode: { name: "mode", params: [] }, // func.sgml
	multirange: { name: "multirange", params: [{ name: "anyrange" }] }, // func.sgml
	mxid_age: { name: "mxid_age", params: [{ name: "xid" }] }, // func.sgml
	netmask: { name: "netmask", params: [{ name: "inet" }] }, // func.sgml
	network: { name: "network", params: [{ name: "inet" }] }, // func.sgml
	nextval: { name: "nextval", params: [{ name: "regclass" }] }, // func.sgml
	normalize: { name: "normalize", params: [{ name: "text" }, { name: "form", optional: true }] }, // func.sgml
	now: { name: "now", params: [] }, // func.sgml
	npoints: { name: "npoints", params: [{ name: "geometric_type" }] }, // func.sgml
	nth_value: {
		name: "nth_value",
		params: [
			{ name: "value", type: "anyelement" },
			{ name: "n", type: "integer" },
		],
	}, // func.sgml
	ntile: { name: "ntile", params: [{ name: "num_buckets", type: "integer" }] }, // func.sgml
	nullif: { name: "NULLIF", params: [{ name: "value1" }, { name: "value2" }] }, // func.sgml
	num_nonnulls: { name: "num_nonnulls", params: [{ name: '"any"' }], variadic: true }, // func.sgml
	num_nulls: { name: "num_nulls", params: [{ name: '"any"' }], variadic: true }, // func.sgml
	numnode: { name: "numnode", params: [{ name: "tsquery" }] }, // func.sgml
	obj_description: {
		name: "obj_description",
		params: [
			{ name: "object", type: "oid" },
			{ name: "catalog", type: "name", optional: true },
		],
	}, // func.sgml
	path: { name: "path", params: [{ name: "polygon" }] }, // func.sgml
	pclose: { name: "pclose", params: [{ name: "path" }] }, // func.sgml
	percent_rank: { name: "percent_rank", params: [{ name: "args", optional: true }] }, // func.sgml
	pg_advisory_unlock_all: { name: "pg_advisory_unlock_all", params: [] }, // func.sgml
	pg_available_wal_summaries: { name: "pg_available_wal_summaries", params: [] }, // func.sgml
	pg_backend_pid: { name: "pg_backend_pid", params: [] }, // func.sgml
	pg_backup_start: {
		name: "pg_backup_start",
		params: [
			{ name: "label", type: "text" },
			{ name: "fast", type: "boolean", optional: true },
		],
	}, // func.sgml
	pg_backup_stop: { name: "pg_backup_stop", params: [{ name: "wait_for_archive", type: "boolean", optional: true }] }, // func.sgml
	pg_basetype: { name: "pg_basetype", params: [{ name: "regtype" }] }, // func.sgml
	pg_blocking_pids: { name: "pg_blocking_pids", params: [{ name: "integer" }] }, // func.sgml
	pg_cancel_backend: { name: "pg_cancel_backend", params: [{ name: "pid", type: "integer" }] }, // func.sgml
	pg_char_to_encoding: { name: "pg_char_to_encoding", params: [{ name: "encoding", type: "name" }] }, // func.sgml
	pg_clear_attribute_stats: {
		name: "pg_clear_attribute_stats",
		params: [
			{ name: "schemaname", type: "text" },
			{ name: "relname", type: "text" },
			{ name: "attname", type: "text" },
			{ name: "inherited", type: "boolean" },
		],
	}, // func.sgml
	pg_clear_relation_stats: {
		name: "pg_clear_relation_stats",
		params: [
			{ name: "schemaname", type: "text" },
			{ name: "relname", type: "text" },
		],
	}, // func.sgml
	pg_client_encoding: { name: "pg_client_encoding", params: [] }, // func.sgml
	pg_collation_actual_version: { name: "pg_collation_actual_version", params: [{ name: "oid" }] }, // func.sgml
	pg_collation_is_visible: { name: "pg_collation_is_visible", params: [{ name: "collation", type: "oid" }] }, // func.sgml
	pg_column_compression: { name: "pg_column_compression", params: [{ name: '"any"' }] }, // func.sgml
	pg_column_size: { name: "pg_column_size", params: [{ name: '"any"' }] }, // func.sgml
	pg_column_toast_chunk_id: { name: "pg_column_toast_chunk_id", params: [{ name: '"any"' }] }, // func.sgml
	pg_conf_load_time: { name: "pg_conf_load_time", params: [] }, // func.sgml
	pg_control_checkpoint: { name: "pg_control_checkpoint", params: [] }, // func.sgml
	pg_control_init: { name: "pg_control_init", params: [] }, // func.sgml
	pg_control_recovery: { name: "pg_control_recovery", params: [] }, // func.sgml
	pg_control_system: { name: "pg_control_system", params: [] }, // func.sgml
	pg_conversion_is_visible: { name: "pg_conversion_is_visible", params: [{ name: "conversion", type: "oid" }] }, // func.sgml
	pg_copy_logical_replication_slot: {
		name: "pg_copy_logical_replication_slot",
		params: [
			{ name: "src_slot_name", type: "name" },
			{ name: "dst_slot_name", type: "name" },
			{ name: "temporary", type: "boolean", optional: true },
			{ name: "plugin", type: "name", optional: true },
		],
	}, // func.sgml
	pg_copy_physical_replication_slot: {
		name: "pg_copy_physical_replication_slot",
		params: [
			{ name: "src_slot_name", type: "name" },
			{ name: "dst_slot_name", type: "name" },
			{ name: "temporary", type: "boolean", optional: true },
		],
	}, // func.sgml
	pg_create_restore_point: { name: "pg_create_restore_point", params: [{ name: "name", type: "text" }] }, // func.sgml
	pg_current_logfile: { name: "pg_current_logfile", params: [{ name: "text", optional: true }] }, // func.sgml
	pg_current_snapshot: { name: "pg_current_snapshot", params: [] }, // func.sgml
	pg_current_wal_flush_lsn: { name: "pg_current_wal_flush_lsn", params: [] }, // func.sgml
	pg_current_wal_insert_lsn: { name: "pg_current_wal_insert_lsn", params: [] }, // func.sgml
	pg_current_wal_lsn: { name: "pg_current_wal_lsn", params: [] }, // func.sgml
	pg_current_xact_id: { name: "pg_current_xact_id", params: [] }, // func.sgml
	pg_current_xact_id_if_assigned: { name: "pg_current_xact_id_if_assigned", params: [] }, // func.sgml
	pg_database_collation_actual_version: { name: "pg_database_collation_actual_version", params: [{ name: "oid" }] }, // func.sgml
	pg_describe_object: {
		name: "pg_describe_object",
		params: [
			{ name: "classid", type: "oid" },
			{ name: "objid", type: "oid" },
			{ name: "objsubid", type: "integer" },
		],
	}, // func.sgml
	pg_drop_replication_slot: { name: "pg_drop_replication_slot", params: [{ name: "slot_name", type: "name" }] }, // func.sgml
	pg_encoding_to_char: { name: "pg_encoding_to_char", params: [{ name: "encoding", type: "integer" }] }, // func.sgml
	pg_event_trigger_ddl_commands: { name: "pg_event_trigger_ddl_commands", params: [] }, // func.sgml
	pg_event_trigger_dropped_objects: { name: "pg_event_trigger_dropped_objects", params: [] }, // func.sgml
	pg_event_trigger_table_rewrite_oid: { name: "pg_event_trigger_table_rewrite_oid", params: [] }, // func.sgml
	pg_event_trigger_table_rewrite_reason: { name: "pg_event_trigger_table_rewrite_reason", params: [] }, // func.sgml
	pg_export_snapshot: { name: "pg_export_snapshot", params: [] }, // func.sgml
	pg_filenode_relation: {
		name: "pg_filenode_relation",
		params: [
			{ name: "tablespace", type: "oid" },
			{ name: "filenode", type: "oid" },
		],
	}, // func.sgml
	pg_function_is_visible: { name: "pg_function_is_visible", params: [{ name: "function", type: "oid" }] }, // func.sgml
	pg_get_acl: {
		name: "pg_get_acl",
		params: [
			{ name: "classid", type: "oid" },
			{ name: "objid", type: "oid" },
			{ name: "objsubid", type: "integer" },
		],
	}, // func.sgml
	pg_get_catalog_foreign_keys: { name: "pg_get_catalog_foreign_keys", params: [] }, // func.sgml
	pg_get_constraintdef: {
		name: "pg_get_constraintdef",
		params: [
			{ name: "constraint", type: "oid" },
			{ name: "pretty", type: "boolean", optional: true },
		],
	}, // func.sgml
	pg_get_expr: {
		name: "pg_get_expr",
		params: [
			{ name: "expr", type: "pg_node_tree" },
			{ name: "relation", type: "oid" },
			{ name: "pretty", type: "boolean", optional: true },
		],
	}, // func.sgml
	pg_get_function_arguments: { name: "pg_get_function_arguments", params: [{ name: "func", type: "oid" }] }, // func.sgml
	pg_get_function_identity_arguments: {
		name: "pg_get_function_identity_arguments",
		params: [{ name: "func", type: "oid" }],
	}, // func.sgml
	pg_get_function_result: { name: "pg_get_function_result", params: [{ name: "func", type: "oid" }] }, // func.sgml
	pg_get_functiondef: { name: "pg_get_functiondef", params: [{ name: "func", type: "oid" }] }, // func.sgml
	pg_get_keywords: { name: "pg_get_keywords", params: [] }, // func.sgml
	pg_get_loaded_modules: { name: "pg_get_loaded_modules", params: [] }, // func.sgml
	pg_get_multixact_members: { name: "pg_get_multixact_members", params: [{ name: "multixid", type: "xid" }] }, // func.sgml
	pg_get_object_address: {
		name: "pg_get_object_address",
		params: [
			{ name: "type", type: "text" },
			{ name: "object_names", type: "text[]" },
			{ name: "object_args", type: "text[]" },
		],
	}, // func.sgml
	pg_get_partition_constraintdef: {
		name: "pg_get_partition_constraintdef",
		params: [{ name: "table", type: "oid" }],
	}, // func.sgml
	pg_get_partkeydef: { name: "pg_get_partkeydef", params: [{ name: "table", type: "oid" }] }, // func.sgml
	pg_get_ruledef: {
		name: "pg_get_ruledef",
		params: [
			{ name: "rule", type: "oid" },
			{ name: "pretty", type: "boolean", optional: true },
		],
	}, // func.sgml
	pg_get_serial_sequence: {
		name: "pg_get_serial_sequence",
		params: [
			{ name: "table", type: "text" },
			{ name: "column", type: "text" },
		],
	}, // func.sgml
	pg_get_statisticsobjdef: { name: "pg_get_statisticsobjdef", params: [{ name: "statobj", type: "oid" }] }, // func.sgml
	pg_get_triggerdef: {
		name: "pg_get_triggerdef",
		params: [
			{ name: "trigger", type: "oid" },
			{ name: "pretty", type: "boolean", optional: true },
		],
	}, // func.sgml
	pg_get_userbyid: { name: "pg_get_userbyid", params: [{ name: "role", type: "oid" }] }, // func.sgml
	pg_get_wal_replay_pause_state: { name: "pg_get_wal_replay_pause_state", params: [] }, // func.sgml
	pg_get_wal_resource_managers: { name: "pg_get_wal_resource_managers", params: [] }, // func.sgml
	pg_get_wal_summarizer_state: { name: "pg_get_wal_summarizer_state", params: [] }, // func.sgml
	pg_identify_object: {
		name: "pg_identify_object",
		params: [
			{ name: "classid", type: "oid" },
			{ name: "objid", type: "oid" },
			{ name: "objsubid", type: "integer" },
		],
	}, // func.sgml
	pg_identify_object_as_address: {
		name: "pg_identify_object_as_address",
		params: [
			{ name: "classid", type: "oid" },
			{ name: "objid", type: "oid" },
			{ name: "objsubid", type: "integer" },
		],
	}, // func.sgml
	pg_import_system_collations: {
		name: "pg_import_system_collations",
		params: [{ name: "schema", type: "regnamespace" }],
	}, // func.sgml
	pg_index_column_has_property: {
		name: "pg_index_column_has_property",
		params: [
			{ name: "index", type: "regclass" },
			{ name: "column", type: "integer" },
			{ name: "property", type: "text" },
		],
	}, // func.sgml
	pg_index_has_property: {
		name: "pg_index_has_property",
		params: [
			{ name: "index", type: "regclass" },
			{ name: "property", type: "text" },
		],
	}, // func.sgml
	pg_indexam_has_property: {
		name: "pg_indexam_has_property",
		params: [
			{ name: "am", type: "oid" },
			{ name: "property", type: "text" },
		],
	}, // func.sgml
	pg_indexes_size: { name: "pg_indexes_size", params: [{ name: "regclass" }] }, // func.sgml
	pg_input_error_info: {
		name: "pg_input_error_info",
		params: [
			{ name: "string", type: "text" },
			{ name: "type", type: "text" },
		],
	}, // func.sgml
	pg_input_is_valid: {
		name: "pg_input_is_valid",
		params: [
			{ name: "string", type: "text" },
			{ name: "type", type: "text" },
		],
	}, // func.sgml
	pg_is_in_recovery: { name: "pg_is_in_recovery", params: [] }, // func.sgml
	pg_is_other_temp_schema: { name: "pg_is_other_temp_schema", params: [{ name: "oid" }] }, // func.sgml
	pg_is_wal_replay_paused: { name: "pg_is_wal_replay_paused", params: [] }, // func.sgml
	pg_jit_available: { name: "pg_jit_available", params: [] }, // func.sgml
	pg_last_committed_xact: { name: "pg_last_committed_xact", params: [] }, // func.sgml
	pg_last_wal_receive_lsn: { name: "pg_last_wal_receive_lsn", params: [] }, // func.sgml
	pg_last_wal_replay_lsn: { name: "pg_last_wal_replay_lsn", params: [] }, // func.sgml
	pg_last_xact_replay_timestamp: { name: "pg_last_xact_replay_timestamp", params: [] }, // func.sgml
	pg_listening_channels: { name: "pg_listening_channels", params: [] }, // func.sgml
	pg_log_backend_memory_contexts: {
		name: "pg_log_backend_memory_contexts",
		params: [{ name: "pid", type: "integer" }],
	}, // func.sgml
	pg_log_standby_snapshot: { name: "pg_log_standby_snapshot", params: [] }, // func.sgml
	pg_logical_slot_get_binary_changes: {
		name: "pg_logical_slot_get_binary_changes",
		params: [
			{ name: "slot_name", type: "name" },
			{ name: "upto_lsn", type: "pg_lsn" },
			{ name: "upto_nchanges", type: "integer" },
			{ name: "options", type: "text[]" },
		],
		variadic: true,
	}, // func.sgml
	pg_logical_slot_get_changes: {
		name: "pg_logical_slot_get_changes",
		params: [
			{ name: "slot_name", type: "name" },
			{ name: "upto_lsn", type: "pg_lsn" },
			{ name: "upto_nchanges", type: "integer" },
			{ name: "options", type: "text[]" },
		],
		variadic: true,
	}, // func.sgml
	pg_logical_slot_peek_binary_changes: {
		name: "pg_logical_slot_peek_binary_changes",
		params: [
			{ name: "slot_name", type: "name" },
			{ name: "upto_lsn", type: "pg_lsn" },
			{ name: "upto_nchanges", type: "integer" },
			{ name: "options", type: "text[]" },
		],
		variadic: true,
	}, // func.sgml
	pg_logical_slot_peek_changes: {
		name: "pg_logical_slot_peek_changes",
		params: [
			{ name: "slot_name", type: "name" },
			{ name: "upto_lsn", type: "pg_lsn" },
			{ name: "upto_nchanges", type: "integer" },
			{ name: "options", type: "text[]" },
		],
		variadic: true,
	}, // func.sgml
	pg_ls_archive_statusdir: { name: "pg_ls_archive_statusdir", params: [] }, // func.sgml
	pg_ls_logdir: { name: "pg_ls_logdir", params: [] }, // func.sgml
	pg_ls_logicalmapdir: { name: "pg_ls_logicalmapdir", params: [] }, // func.sgml
	pg_ls_logicalsnapdir: { name: "pg_ls_logicalsnapdir", params: [] }, // func.sgml
	pg_ls_replslotdir: { name: "pg_ls_replslotdir", params: [{ name: "slot_name", type: "text" }] }, // func.sgml
	pg_ls_summariesdir: { name: "pg_ls_summariesdir", params: [] }, // func.sgml
	pg_ls_tmpdir: { name: "pg_ls_tmpdir", params: [{ name: "tablespace", type: "oid", optional: true }] }, // func.sgml
	pg_ls_waldir: { name: "pg_ls_waldir", params: [] }, // func.sgml
	pg_mcv_list_items: { name: "pg_mcv_list_items", params: [{ name: "pg_mcv_list" }] }, // func.sgml
	pg_my_temp_schema: { name: "pg_my_temp_schema", params: [] }, // func.sgml
	pg_notification_queue_usage: { name: "pg_notification_queue_usage", params: [] }, // func.sgml
	pg_numa_available: { name: "pg_numa_available", params: [] }, // func.sgml
	pg_opclass_is_visible: { name: "pg_opclass_is_visible", params: [{ name: "opclass", type: "oid" }] }, // func.sgml
	pg_operator_is_visible: { name: "pg_operator_is_visible", params: [{ name: "operator", type: "oid" }] }, // func.sgml
	pg_opfamily_is_visible: { name: "pg_opfamily_is_visible", params: [{ name: "opclass", type: "oid" }] }, // func.sgml
	pg_options_to_table: { name: "pg_options_to_table", params: [{ name: "options_array", type: "text[]" }] }, // func.sgml
	pg_partition_ancestors: { name: "pg_partition_ancestors", params: [{ name: "regclass" }] }, // func.sgml
	pg_partition_root: { name: "pg_partition_root", params: [{ name: "regclass" }] }, // func.sgml
	pg_partition_tree: { name: "pg_partition_tree", params: [{ name: "regclass" }] }, // func.sgml
	pg_postmaster_start_time: { name: "pg_postmaster_start_time", params: [] }, // func.sgml
	pg_relation_filenode: { name: "pg_relation_filenode", params: [{ name: "relation", type: "regclass" }] }, // func.sgml
	pg_relation_filepath: { name: "pg_relation_filepath", params: [{ name: "relation", type: "regclass" }] }, // func.sgml
	pg_relation_size: {
		name: "pg_relation_size",
		params: [
			{ name: "relation", type: "regclass" },
			{ name: "fork", type: "text", optional: true },
		],
	}, // func.sgml
	pg_reload_conf: { name: "pg_reload_conf", params: [] }, // func.sgml
	pg_replication_origin_advance: {
		name: "pg_replication_origin_advance",
		params: [
			{ name: "node_name", type: "text" },
			{ name: "lsn", type: "pg_lsn" },
		],
	}, // func.sgml
	pg_replication_origin_create: {
		name: "pg_replication_origin_create",
		params: [{ name: "node_name", type: "text" }],
	}, // func.sgml
	pg_replication_origin_drop: { name: "pg_replication_origin_drop", params: [{ name: "node_name", type: "text" }] }, // func.sgml
	pg_replication_origin_oid: { name: "pg_replication_origin_oid", params: [{ name: "node_name", type: "text" }] }, // func.sgml
	pg_replication_origin_progress: {
		name: "pg_replication_origin_progress",
		params: [
			{ name: "node_name", type: "text" },
			{ name: "flush", type: "boolean" },
		],
	}, // func.sgml
	pg_replication_origin_session_is_setup: { name: "pg_replication_origin_session_is_setup", params: [] }, // func.sgml
	pg_replication_origin_session_progress: {
		name: "pg_replication_origin_session_progress",
		params: [{ name: "flush", type: "boolean" }],
	}, // func.sgml
	pg_replication_origin_session_reset: { name: "pg_replication_origin_session_reset", params: [] }, // func.sgml
	pg_replication_origin_session_setup: {
		name: "pg_replication_origin_session_setup",
		params: [{ name: "node_name", type: "text" }],
	}, // func.sgml
	pg_replication_origin_xact_reset: { name: "pg_replication_origin_xact_reset", params: [] }, // func.sgml
	pg_replication_origin_xact_setup: {
		name: "pg_replication_origin_xact_setup",
		params: [
			{ name: "origin_lsn", type: "pg_lsn" },
			{ name: "origin_timestamp", type: "timestamp with time zone" },
		],
	}, // func.sgml
	pg_replication_slot_advance: {
		name: "pg_replication_slot_advance",
		params: [
			{ name: "slot_name", type: "name" },
			{ name: "upto_lsn", type: "pg_lsn" },
		],
	}, // func.sgml
	pg_restore_attribute_stats: {
		name: "pg_restore_attribute_stats",
		params: [{ name: "kwargs", type: '"any"' }],
		variadic: true,
	}, // func.sgml
	pg_restore_relation_stats: {
		name: "pg_restore_relation_stats",
		params: [{ name: "kwargs", type: '"any"' }],
		variadic: true,
	}, // func.sgml
	pg_rotate_logfile: { name: "pg_rotate_logfile", params: [] }, // func.sgml
	pg_safe_snapshot_blocking_pids: { name: "pg_safe_snapshot_blocking_pids", params: [{ name: "integer" }] }, // func.sgml
	pg_settings_get_flags: { name: "pg_settings_get_flags", params: [{ name: "guc", type: "text" }] }, // func.sgml
	pg_size_bytes: { name: "pg_size_bytes", params: [{ name: "text" }] }, // func.sgml
	pg_snapshot_xip: { name: "pg_snapshot_xip", params: [{ name: "pg_snapshot" }] }, // func.sgml
	pg_snapshot_xmax: { name: "pg_snapshot_xmax", params: [{ name: "pg_snapshot" }] }, // func.sgml
	pg_snapshot_xmin: { name: "pg_snapshot_xmin", params: [{ name: "pg_snapshot" }] }, // func.sgml
	pg_split_walfile_name: { name: "pg_split_walfile_name", params: [{ name: "file_name", type: "text" }] }, // func.sgml
	pg_stat_file: {
		name: "pg_stat_file",
		params: [
			{ name: "filename", type: "text" },
			{ name: "missing_ok", type: "boolean", optional: true },
		],
	}, // func.sgml
	pg_statistics_obj_is_visible: { name: "pg_statistics_obj_is_visible", params: [{ name: "stat", type: "oid" }] }, // func.sgml
	pg_switch_wal: { name: "pg_switch_wal", params: [] }, // func.sgml
	pg_sync_replication_slots: { name: "pg_sync_replication_slots", params: [] }, // func.sgml
	pg_table_is_visible: { name: "pg_table_is_visible", params: [{ name: "table", type: "oid" }] }, // func.sgml
	pg_table_size: { name: "pg_table_size", params: [{ name: "regclass" }] }, // func.sgml
	pg_tablespace_databases: { name: "pg_tablespace_databases", params: [{ name: "tablespace", type: "oid" }] }, // func.sgml
	pg_tablespace_location: { name: "pg_tablespace_location", params: [{ name: "tablespace", type: "oid" }] }, // func.sgml
	pg_total_relation_size: { name: "pg_total_relation_size", params: [{ name: "regclass" }] }, // func.sgml
	pg_trigger_depth: { name: "pg_trigger_depth", params: [] }, // func.sgml
	pg_ts_config_is_visible: { name: "pg_ts_config_is_visible", params: [{ name: "config", type: "oid" }] }, // func.sgml
	pg_ts_dict_is_visible: { name: "pg_ts_dict_is_visible", params: [{ name: "dict", type: "oid" }] }, // func.sgml
	pg_ts_parser_is_visible: { name: "pg_ts_parser_is_visible", params: [{ name: "parser", type: "oid" }] }, // func.sgml
	pg_ts_template_is_visible: { name: "pg_ts_template_is_visible", params: [{ name: "template", type: "oid" }] }, // func.sgml
	pg_type_is_visible: { name: "pg_type_is_visible", params: [{ name: "type", type: "oid" }] }, // func.sgml
	pg_typeof: { name: "pg_typeof", params: [{ name: '"any"' }] }, // func.sgml
	pg_visible_in_snapshot: { name: "pg_visible_in_snapshot", params: [{ name: "xid8" }, { name: "pg_snapshot" }] }, // func.sgml
	pg_wal_lsn_diff: {
		name: "pg_wal_lsn_diff",
		params: [
			{ name: "lsn1", type: "pg_lsn" },
			{ name: "lsn2", type: "pg_lsn" },
		],
	}, // func.sgml
	pg_wal_replay_pause: { name: "pg_wal_replay_pause", params: [] }, // func.sgml
	pg_wal_replay_resume: { name: "pg_wal_replay_resume", params: [] }, // func.sgml
	pg_wal_summary_contents: {
		name: "pg_wal_summary_contents",
		params: [
			{ name: "tli", type: "bigint" },
			{ name: "start_lsn", type: "pg_lsn" },
			{ name: "end_lsn", type: "pg_lsn" },
		],
	}, // func.sgml
	pg_walfile_name: { name: "pg_walfile_name", params: [{ name: "lsn", type: "pg_lsn" }] }, // func.sgml
	pg_walfile_name_offset: { name: "pg_walfile_name_offset", params: [{ name: "lsn", type: "pg_lsn" }] }, // func.sgml
	pg_xact_commit_timestamp: { name: "pg_xact_commit_timestamp", params: [{ name: "xid" }] }, // func.sgml
	pg_xact_commit_timestamp_origin: { name: "pg_xact_commit_timestamp_origin", params: [{ name: "xid" }] }, // func.sgml
	pg_xact_status: { name: "pg_xact_status", params: [{ name: "xid8" }] }, // func.sgml
	pi: { name: "pi", params: [] }, // func.sgml
	popen: { name: "popen", params: [{ name: "path" }] }, // func.sgml
	querytree: { name: "querytree", params: [{ name: "tsquery" }] }, // func.sgml
	quote_ident: { name: "quote_ident", params: [{ name: "text" }] }, // func.sgml
	radians: { name: "radians", params: [{ name: "double precision" }] }, // func.sgml
	radius: { name: "radius", params: [{ name: "circle" }] }, // func.sgml
	random_normal: {
		name: "random_normal",
		params: [
			{ name: "mean", type: "double precision", optional: true },
			{ name: "stddev", type: "double precision", optional: true },
		],
	}, // func.sgml
	rank: { name: "rank", params: [{ name: "args", optional: true }] }, // func.sgml
	regexp_count: {
		name: "regexp_count",
		params: [
			{ name: "string", type: "text" },
			{ name: "pattern", type: "text" },
			{ name: "start", type: "integer", optional: true },
			{ name: "flags", type: "text", optional: true },
		],
	}, // func.sgml
	regexp_instr: {
		name: "regexp_instr",
		params: [
			{ name: "string", type: "text" },
			{ name: "pattern", type: "text" },
			{ name: "start", type: "integer", optional: true },
			{ name: "N", type: "integer", optional: true },
			{ name: "endoption", type: "integer", optional: true },
			{ name: "flags", type: "text", optional: true },
			{ name: "subexpr", type: "integer", optional: true },
		],
	}, // func.sgml
	regexp_like: {
		name: "regexp_like",
		params: [
			{ name: "string", type: "text" },
			{ name: "pattern", type: "text" },
			{ name: "flags", type: "text", optional: true },
		],
	}, // func.sgml
	regexp_match: {
		name: "regexp_match",
		params: [
			{ name: "string", type: "text" },
			{ name: "pattern", type: "text" },
			{ name: "flags", type: "text", optional: true },
		],
	}, // func.sgml
	regexp_matches: {
		name: "regexp_matches",
		params: [
			{ name: "string", type: "text" },
			{ name: "pattern", type: "text" },
			{ name: "flags", type: "text", optional: true },
		],
	}, // func.sgml
	regexp_split_to_array: {
		name: "regexp_split_to_array",
		params: [
			{ name: "string", type: "text" },
			{ name: "pattern", type: "text" },
			{ name: "flags", type: "text", optional: true },
		],
	}, // func.sgml
	regexp_split_to_table: {
		name: "regexp_split_to_table",
		params: [
			{ name: "string", type: "text" },
			{ name: "pattern", type: "text" },
			{ name: "flags", type: "text", optional: true },
		],
	}, // func.sgml
	regexp_substr: {
		name: "regexp_substr",
		params: [
			{ name: "string", type: "text" },
			{ name: "pattern", type: "text" },
			{ name: "start", type: "integer", optional: true },
			{ name: "N", type: "integer", optional: true },
			{ name: "flags", type: "text", optional: true },
			{ name: "subexpr", type: "integer", optional: true },
		],
	}, // func.sgml
	regr_avgx: {
		name: "regr_avgx",
		params: [
			{ name: "Y", type: "double precision" },
			{ name: "X", type: "double precision" },
		],
	}, // func.sgml
	regr_avgy: {
		name: "regr_avgy",
		params: [
			{ name: "Y", type: "double precision" },
			{ name: "X", type: "double precision" },
		],
	}, // func.sgml
	regr_count: {
		name: "regr_count",
		params: [
			{ name: "Y", type: "double precision" },
			{ name: "X", type: "double precision" },
		],
	}, // func.sgml
	regr_intercept: {
		name: "regr_intercept",
		params: [
			{ name: "Y", type: "double precision" },
			{ name: "X", type: "double precision" },
		],
	}, // func.sgml
	regr_r2: {
		name: "regr_r2",
		params: [
			{ name: "Y", type: "double precision" },
			{ name: "X", type: "double precision" },
		],
	}, // func.sgml
	regr_slope: {
		name: "regr_slope",
		params: [
			{ name: "Y", type: "double precision" },
			{ name: "X", type: "double precision" },
		],
	}, // func.sgml
	regr_sxx: {
		name: "regr_sxx",
		params: [
			{ name: "Y", type: "double precision" },
			{ name: "X", type: "double precision" },
		],
	}, // func.sgml
	regr_sxy: {
		name: "regr_sxy",
		params: [
			{ name: "Y", type: "double precision" },
			{ name: "X", type: "double precision" },
		],
	}, // func.sgml
	regr_syy: {
		name: "regr_syy",
		params: [
			{ name: "Y", type: "double precision" },
			{ name: "X", type: "double precision" },
		],
	}, // func.sgml
	repeat: {
		name: "repeat",
		params: [
			{ name: "string", type: "text" },
			{ name: "number", type: "integer" },
		],
	}, // func.sgml
	replace: {
		name: "replace",
		params: [
			{ name: "string", type: "text" },
			{ name: "from", type: "text" },
			{ name: "to", type: "text" },
		],
	}, // func.sgml
	right: {
		name: "right",
		params: [
			{ name: "string", type: "text" },
			{ name: "n", type: "integer" },
		],
	}, // func.sgml
	row_number: { name: "row_number", params: [] }, // func.sgml
	row_to_json: { name: "row_to_json", params: [{ name: "record" }, { name: "boolean", optional: true }] }, // func.sgml
	rpad: {
		name: "rpad",
		params: [
			{ name: "string", type: "text" },
			{ name: "length", type: "integer" },
			{ name: "fill", type: "text", optional: true },
		],
	}, // func.sgml
	scale: { name: "scale", params: [{ name: "numeric" }] }, // func.sgml
	session_user: { name: "session_user", params: [] }, // func.sgml
	set_byte: {
		name: "set_byte",
		params: [
			{ name: "bytes", type: "bytea" },
			{ name: "n", type: "integer" },
			{ name: "newvalue", type: "integer" },
		],
	}, // func.sgml
	set_config: {
		name: "set_config",
		params: [
			{ name: "setting_name", type: "text" },
			{ name: "new_value", type: "text" },
			{ name: "is_local", type: "boolean" },
		],
	}, // func.sgml
	setseed: { name: "setseed", params: [{ name: "double precision" }] }, // func.sgml
	setval: { name: "setval", params: [{ name: "regclass" }, { name: "bigint" }, { name: "boolean", optional: true }] }, // func.sgml
	setweight: {
		name: "setweight",
		params: [
			{ name: "vector", type: "tsvector" },
			{ name: "weight", type: '"char"' },
			{ name: "lexemes", type: "text[]", optional: true },
		],
	}, // func.sgml
	sha224: { name: "sha224", params: [{ name: "bytea" }] }, // func.sgml
	sha256: { name: "sha256", params: [{ name: "bytea" }] }, // func.sgml
	sha384: { name: "sha384", params: [{ name: "bytea" }] }, // func.sgml
	sha512: { name: "sha512", params: [{ name: "bytea" }] }, // func.sgml
	shobj_description: {
		name: "shobj_description",
		params: [
			{ name: "object", type: "oid" },
			{ name: "catalog", type: "name" },
		],
	}, // func.sgml
	sin: { name: "sin", params: [{ name: "double precision" }] }, // func.sgml
	sind: { name: "sind", params: [{ name: "double precision" }] }, // func.sgml
	sinh: { name: "sinh", params: [{ name: "double precision" }] }, // func.sgml
	slope: { name: "slope", params: [{ name: "point" }, { name: "point" }] }, // func.sgml
	split_part: {
		name: "split_part",
		params: [
			{ name: "string", type: "text" },
			{ name: "delimiter", type: "text" },
			{ name: "n", type: "integer" },
		],
	}, // func.sgml
	starts_with: {
		name: "starts_with",
		params: [
			{ name: "string", type: "text" },
			{ name: "prefix", type: "text" },
		],
	}, // func.sgml
	statement_timestamp: { name: "statement_timestamp", params: [] }, // func.sgml
	stddev: { name: "stddev", params: [{ name: "numeric_type" }] }, // func.sgml
	stddev_pop: { name: "stddev_pop", params: [{ name: "numeric_type" }] }, // func.sgml
	stddev_samp: { name: "stddev_samp", params: [{ name: "numeric_type" }] }, // func.sgml
	string_agg: {
		name: "string_agg",
		params: [
			{ name: "value", type: "text" },
			{ name: "delimiter", type: "text" },
		],
	}, // func.sgml
	string_to_array: {
		name: "string_to_array",
		params: [
			{ name: "string", type: "text" },
			{ name: "delimiter", type: "text" },
			{ name: "null_string", type: "text", optional: true },
		],
	}, // func.sgml
	string_to_table: {
		name: "string_to_table",
		params: [
			{ name: "string", type: "text" },
			{ name: "delimiter", type: "text" },
			{ name: "null_string", type: "text", optional: true },
		],
	}, // func.sgml
	strip: { name: "strip", params: [{ name: "tsvector" }] }, // func.sgml
	strpos: {
		name: "strpos",
		params: [
			{ name: "string", type: "text" },
			{ name: "substring", type: "text" },
		],
	}, // func.sgml
	suppress_redundant_updates_trigger: { name: "suppress_redundant_updates_trigger", params: [] }, // func.sgml
	system_user: { name: "system_user", params: [] }, // func.sgml
	tan: { name: "tan", params: [{ name: "double precision" }] }, // func.sgml
	tand: { name: "tand", params: [{ name: "double precision" }] }, // func.sgml
	tanh: { name: "tanh", params: [{ name: "double precision" }] }, // func.sgml
	text: { name: "text", params: [{ name: "inet" }] }, // func.sgml
	timeofday: { name: "timeofday", params: [] }, // func.sgml
	to_date: { name: "to_date", params: [{ name: "text" }, { name: "text" }] }, // func.sgml
	to_json: { name: "to_json", params: [{ name: "anyelement" }] }, // func.sgml
	to_jsonb: { name: "to_jsonb", params: [{ name: "anyelement" }] }, // func.sgml
	to_number: { name: "to_number", params: [{ name: "text" }, { name: "text" }] }, // func.sgml
	to_regclass: { name: "to_regclass", params: [{ name: "text" }] }, // func.sgml
	to_regcollation: { name: "to_regcollation", params: [{ name: "text" }] }, // func.sgml
	to_regnamespace: { name: "to_regnamespace", params: [{ name: "text" }] }, // func.sgml
	to_regoper: { name: "to_regoper", params: [{ name: "text" }] }, // func.sgml
	to_regoperator: { name: "to_regoperator", params: [{ name: "text" }] }, // func.sgml
	to_regproc: { name: "to_regproc", params: [{ name: "text" }] }, // func.sgml
	to_regprocedure: { name: "to_regprocedure", params: [{ name: "text" }] }, // func.sgml
	to_regrole: { name: "to_regrole", params: [{ name: "text" }] }, // func.sgml
	to_regtype: { name: "to_regtype", params: [{ name: "text" }] }, // func.sgml
	to_regtypemod: { name: "to_regtypemod", params: [{ name: "text" }] }, // func.sgml
	transaction_timestamp: { name: "transaction_timestamp", params: [] }, // func.sgml
	translate: {
		name: "translate",
		params: [
			{ name: "string", type: "text" },
			{ name: "from", type: "text" },
			{ name: "to", type: "text" },
		],
	}, // func.sgml
	trim_array: {
		name: "trim_array",
		params: [
			{ name: "array", type: "anyarray" },
			{ name: "n", type: "integer" },
		],
	}, // func.sgml
	trim_scale: { name: "trim_scale", params: [{ name: "numeric" }] }, // func.sgml
	ts_filter: {
		name: "ts_filter",
		params: [
			{ name: "vector", type: "tsvector" },
			{ name: "weights", type: '"char"[]' },
		],
	}, // func.sgml
	ts_lexize: {
		name: "ts_lexize",
		params: [
			{ name: "dict", type: "regdictionary" },
			{ name: "token", type: "text" },
		],
	}, // func.sgml
	ts_stat: {
		name: "ts_stat",
		params: [
			{ name: "sqlquery", type: "text" },
			{ name: "weights", type: "text", optional: true },
		],
	}, // func.sgml
	tsquery_phrase: {
		name: "tsquery_phrase",
		params: [
			{ name: "query1", type: "tsquery" },
			{ name: "query2", type: "tsquery" },
			{ name: "distance", type: "integer", optional: true },
		],
	}, // func.sgml
	tsvector_to_array: { name: "tsvector_to_array", params: [{ name: "tsvector" }] }, // func.sgml
	tsvector_update_trigger: { name: "tsvector_update_trigger", params: [] }, // func.sgml
	tsvector_update_trigger_column: { name: "tsvector_update_trigger_column", params: [] }, // func.sgml
	txid_current: { name: "txid_current", params: [] }, // func.sgml
	txid_current_if_assigned: { name: "txid_current_if_assigned", params: [] }, // func.sgml
	txid_current_snapshot: { name: "txid_current_snapshot", params: [] }, // func.sgml
	txid_snapshot_xip: { name: "txid_snapshot_xip", params: [{ name: "txid_snapshot" }] }, // func.sgml
	txid_snapshot_xmax: { name: "txid_snapshot_xmax", params: [{ name: "txid_snapshot" }] }, // func.sgml
	txid_snapshot_xmin: { name: "txid_snapshot_xmin", params: [{ name: "txid_snapshot" }] }, // func.sgml
	txid_status: { name: "txid_status", params: [{ name: "bigint" }] }, // func.sgml
	txid_visible_in_snapshot: {
		name: "txid_visible_in_snapshot",
		params: [{ name: "bigint" }, { name: "txid_snapshot" }],
	}, // func.sgml
	unicode_assigned: { name: "unicode_assigned", params: [{ name: "text" }] }, // func.sgml
	unicode_version: { name: "unicode_version", params: [] }, // func.sgml
	unistr: { name: "unistr", params: [{ name: "text" }] }, // func.sgml
	user: { name: "user", params: [] }, // func.sgml
	uuid_extract_timestamp: { name: "uuid_extract_timestamp", params: [{ name: "uuid" }] }, // func.sgml
	uuid_extract_version: { name: "uuid_extract_version", params: [{ name: "uuid" }] }, // func.sgml
	uuidv4: { name: "uuidv4", params: [] }, // func.sgml
	uuidv7: { name: "uuidv7", params: [{ name: "shift", type: "interval", optional: true }] }, // func.sgml
	var_pop: { name: "var_pop", params: [{ name: "numeric_type" }] }, // func.sgml
	var_samp: { name: "var_samp", params: [{ name: "numeric_type" }] }, // func.sgml
	variance: { name: "variance", params: [{ name: "numeric_type" }] }, // func.sgml
	version: { name: "version", params: [] }, // func.sgml
	width: { name: "width", params: [{ name: "box" }] }, // func.sgml
	xmlagg: { name: "xmlagg", params: [{ name: "xml" }] }, // func.sgml
	xmlcomment: { name: "xmlcomment", params: [{ name: "text" }] }, // func.sgml
	xmlconcat: { name: "xmlconcat", params: [{ name: "xml" }], variadic: true }, // func.sgml
	xmltext: { name: "xmltext", params: [{ name: "text" }] }, // func.sgml
	xpath: {
		name: "xpath",
		params: [
			{ name: "xpath", type: "text" },
			{ name: "xml", type: "xml" },
			{ name: "nsarray", type: "text[]", optional: true },
		],
	}, // func.sgml
	xpath_exists: {
		name: "xpath_exists",
		params: [
			{ name: "xpath", type: "text" },
			{ name: "xml", type: "xml" },
			{ name: "nsarray", type: "text[]", optional: true },
		],
	}, // func.sgml
};
