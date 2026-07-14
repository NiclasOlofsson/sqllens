// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// Harvested source: docs.aws.amazon.com/redshift  redshift/docs/syntax/<page>/N.txt (Syntax blocks, captured by tools/scrape-redshift-syntax.mjs)
// Overrides source: tools/signature-overrides/redshift.mjs
// Built 2026-07-14. 307 names (13 curated, 294 harvested), 6 with 2+ overloads.
import type { FnSignature } from "../signature/signatures.js";

/** The merged function-signature table for redshift: curated overrides folded over the harvested
 *  doc-derived long tail (overrides win by key, replacing the whole overload set), keyed by
 *  lowercased name. Each name maps to an ORDERED overload set - a name with one documented shape
 *  is a one-element array. `origin` says which layer produced the set. */
export const REDSHIFT_SIGNATURES: Record<string, FnSignature[]> = {
	abs: [{ name: "ABS", params: [{ name: "number" }], origin: "harvested" }], // r_ABS/1.txt
	acos: [{ name: "ACOS", params: [{ name: "number" }], origin: "harvested" }], // r_ACOS/1.txt
	addbbox: [{ name: "AddBBox", params: [{ name: "geom" }], origin: "harvested" }], // AddBBox-function/1.txt
	any_value: [{ name: "ANY_VALUE", params: [{ name: "expression" }], origin: "harvested" }], // r_ANY_VALUE/1.txt
	array: [
		{
			name: "ARRAY",
			params: [
				{ name: "expr1", optional: true },
				{ name: "expr2", optional: true },
			],
			variadic: true,
			origin: "harvested",
		},
	], // r_array/1.txt
	array_concat: [{ name: "ARRAY_CONCAT", params: [{ name: "array1" }, { name: "array2" }], origin: "harvested" }], // r_array_concat/1.txt
	array_contains: [
		{
			name: "ARRAY_CONTAINS",
			params: [{ name: "array" }, { name: "value" }, { name: "null_match", optional: true }],
			origin: "harvested",
		},
	], // array_contains/1.txt
	array_distinct: [{ name: "ARRAY_DISTINCT", params: [{ name: "array" }], origin: "harvested" }], // array_distinct/1.txt
	array_flatten: [{ name: "ARRAY_FLATTEN", params: [{ name: "array" }], origin: "harvested" }], // array_flatten/1.txt
	array_position: [
		{
			name: "ARRAY_POSITION",
			params: [{ name: "array" }, { name: "value" }, { name: "null_match", optional: true }],
			origin: "harvested",
		},
	], // array_position/1.txt
	array_positions: [
		{
			name: "ARRAY_POSITIONS",
			params: [{ name: "array" }, { name: "value" }, { name: "null_match", optional: true }],
			origin: "harvested",
		},
	], // array_positions/1.txt
	array_sort: [
		{
			name: "ARRAY_SORT",
			params: [
				{ name: "array" },
				{ name: "sort_ascending", optional: true },
				{ name: "nulls_first", optional: true },
			],
			origin: "harvested",
		},
	], // array_sort/1.txt
	array_union: [{ name: "ARRAY_UNION", params: [{ name: "array1" }, { name: "array2" }], origin: "harvested" }], // array_union/1.txt
	arrays_overlap: [{ name: "ARRAYS_OVERLAP", params: [{ name: "array1" }, { name: "array2" }], origin: "harvested" }], // arrays_overlap/1.txt
	ascii: [{ name: "ASCII", params: [{ name: "string" }], origin: "harvested" }], // r_ASCII/1.txt
	asin: [{ name: "ASIN", params: [{ name: "number" }], origin: "harvested" }], // r_ASIN/1.txt
	atan: [{ name: "ATAN", params: [{ name: "number" }], origin: "harvested" }], // r_ATAN/1.txt
	atan2: [{ name: "ATAN2", params: [{ name: "number1" }, { name: "number2" }], origin: "harvested" }], // r_ATAN2/1.txt
	avg: [{ name: "AVG", params: [{ name: "expression" }], origin: "harvested" }], // r_AVG/1.txt
	bit_and: [{ name: "BIT_AND", params: [{ name: "expression" }], origin: "harvested" }], // r_BIT_AND/1.txt
	bit_or: [{ name: "BIT_OR", params: [{ name: "expression" }], origin: "harvested" }], // r_BIT_OR/1.txt
	bool_and: [{ name: "BOOL_AND", params: [{ name: "expression" }], origin: "harvested" }], // r_BOOL_AND/1.txt
	bool_or: [{ name: "BOOL_OR", params: [{ name: "expression" }], origin: "harvested" }], // r_BOOL_OR/1.txt
	bpcharcmp: [{ name: "BPCHARCMP", params: [{ name: "string1" }, { name: "string2" }], origin: "harvested" }], // r_BPCHARCMP/1.txt
	btrim: [
		{ name: "BTRIM", params: [{ name: "string" }, { name: "trim_chars", optional: true }], origin: "harvested" },
	], // r_BTRIM/1.txt
	cbrt: [{ name: "CBRT", params: [{ name: "number" }], origin: "harvested" }], // r_CBRT/1.txt
	ceiling: [{ name: "CEILING", params: [{ name: "number", type: "numeric" }], origin: "curated" }], // curated: CEILING / CEIL function
	change_query_priority: [
		{ name: "CHANGE_QUERY_PRIORITY", params: [{ name: "query_id" }, { name: "priority" }], origin: "harvested" },
	], // r_CHANGE_QUERY_PRIORITY/1.txt
	change_session_priority: [
		{ name: "CHANGE_SESSION_PRIORITY", params: [{ name: "pid" }, { name: "priority" }], origin: "harvested" },
	], // r_CHANGE_SESSION_PRIORITY/1.txt
	change_user_priority: [
		{ name: "CHANGE_USER_PRIORITY", params: [{ name: "user_name" }, { name: "priority" }], origin: "harvested" },
	], // r_CHANGE_USER_PRIORITY/1.txt
	charindex: [{ name: "CHARINDEX", params: [{ name: "substring" }, { name: "string" }], origin: "harvested" }], // r_CHARINDEX/1.txt
	checksum: [{ name: "CHECKSUM", params: [{ name: "expression" }], origin: "harvested" }], // r_CHECKSUM/1.txt
	chr: [{ name: "CHR", params: [{ name: "number" }], origin: "harvested" }], // r_CHR/1.txt
	coalesce: [
		{
			name: "COALESCE",
			params: [{ name: "expression" }, { name: "expression" }],
			variadic: true,
			origin: "harvested",
		},
	], // r_NVL_function/2.txt
	concat: [
		{
			name: "CONCAT",
			params: [
				{ name: "string1", type: "string" },
				{ name: "string2", type: "string" },
			],
			origin: "curated",
		},
	], // curated: CONCAT function (binary)
	convert: [{ name: "CONVERT", params: [{ name: "type" }, { name: "expression" }], origin: "harvested" }], // r_CONVERT_function/1.txt
	cos: [{ name: "COS", params: [{ name: "double_precision" }], origin: "harvested" }], // r_COS/1.txt
	cot: [{ name: "COT", params: [{ name: "number" }], origin: "harvested" }], // r_COT/1.txt
	count: [{ name: "COUNT", params: [{ name: "expression" }], origin: "harvested" }], // r_COUNT/2.txt
	crc32: [{ name: "CRC32", params: [{ name: "string" }], origin: "harvested" }], // crc32-function/1.txt
	cume_dist: [{ name: "CUME_DIST", params: [], origin: "harvested" }], // r_WF_CUME_DIST/1.txt
	current_database: [{ name: "current_database", params: [], origin: "harvested" }], // r_CURRENT_DATABASE/1.txt
	current_schema: [{ name: "current_schema", params: [], origin: "harvested" }], // r_CURRENT_SCHEMA/1.txt
	current_schemas: [{ name: "current_schemas", params: [{ name: "include_implicit" }], origin: "harvested" }], // r_CURRENT_SCHEMAS/1.txt
	current_session_arn: [{ name: "current_session_arn", params: [], origin: "harvested" }], // r_CURRENT_SESSION_ARN/1.txt
	current_setting: [
		{
			name: "current_setting",
			params: [{ name: "variable_name" }, { name: "error_if_undefined", optional: true }],
			origin: "harvested",
		},
		{ name: "current_setting", params: [{ name: "parameter" }], origin: "harvested" },
	], // r_CURRENT_SETTING/2.txt, r_CURRENT_SETTING/1.txt
	date_cmp: [{ name: "DATE_CMP", params: [{ name: "date1" }, { name: "date2" }], origin: "harvested" }], // r_DATE_CMP/1.txt
	date_cmp_timestamp: [
		{ name: "DATE_CMP_TIMESTAMP", params: [{ name: "date" }, { name: "timestamp" }], origin: "harvested" },
	], // r_DATE_CMP_TIMESTAMP/1.txt
	date_cmp_timestamptz: [
		{ name: "DATE_CMP_TIMESTAMPTZ", params: [{ name: "date" }, { name: "timestamptz" }], origin: "harvested" },
	], // r_DATE_CMP_TIMESTAMPTZ/1.txt
	date_part: [
		{
			name: "DATE_PART",
			params: [{ name: "datepart" }, { name: "timestamp", type: "timestamp" }],
			origin: "curated",
		},
	], // curated: DATE_PART function
	date_part_year: [{ name: "DATE_PART_YEAR", params: [{ name: "date" }], origin: "harvested" }], // r_DATE_PART_YEAR/1.txt
	date_trunc: [{ name: "DATE_TRUNC", params: [{ name: "datepart" }, { name: "timestamp" }], origin: "harvested" }], // r_DATE_TRUNC/1.txt
	dateadd: [
		{
			name: "DATEADD",
			params: [{ name: "datepart" }, { name: "interval", type: "integer" }, { name: "date", type: "date" }],
			origin: "curated",
		},
	], // curated: DATEADD function
	datediff: [
		{
			name: "DATEDIFF",
			params: [{ name: "datepart" }, { name: "startdate", type: "date" }, { name: "enddate", type: "date" }],
			origin: "curated",
		},
	], // curated: DATEDIFF function
	db_collation: [{ name: "db_collation", params: [], origin: "harvested" }], // r_DB_COLLATION/1.txt
	decimal_precision: [{ name: "DECIMAL_PRECISION", params: [{ name: "super_expression" }], origin: "harvested" }], // r_decimal_precision/1.txt
	decimal_scale: [{ name: "DECIMAL_SCALE", params: [{ name: "super_expression" }], origin: "harvested" }], // r_decimal_scale/1.txt
	decode: [
		{
			name: "DECODE",
			params: [{ name: "expression" }, { name: "search" }, { name: "result" }],
			variadic: true,
			origin: "curated",
		},
	], // curated: DECODE expression (variadic)
	degrees: [{ name: "DEGREES", params: [{ name: "number" }], origin: "harvested" }], // r_DEGREES/1.txt
	dexp: [{ name: "DEXP", params: [{ name: "number" }], origin: "harvested" }], // r_DEXP/1.txt
	difference: [{ name: "DIFFERENCE", params: [{ name: "string1" }, { name: "string2" }], origin: "harvested" }], // DIFFERENCE/1.txt
	dlog10: [{ name: "DLOG10", params: [{ name: "number" }], origin: "harvested" }], // r_DLOG10/1.txt
	dropbbox: [{ name: "DropBBox", params: [{ name: "geom" }], origin: "harvested" }], // DropBBox-function/1.txt
	exp: [{ name: "EXP", params: [{ name: "expression" }], origin: "harvested" }], // r_EXP/1.txt
	farmfingerprint64: [{ name: "farmFingerprint64", params: [{ name: "expression" }], origin: "harvested" }], // r_FARMFINGERPRINT64/1.txt
	floor: [{ name: "FLOOR", params: [{ name: "number" }], origin: "harvested" }], // r_FLOOR/1.txt
	fnv_hash: [
		{ name: "FNV_HASH", params: [{ name: "value" }, { name: "seed", optional: true }], origin: "harvested" },
	], // r_FNV_HASH/1.txt
	from_hex: [{ name: "FROM_HEX", params: [{ name: "hex_string" }], origin: "harvested" }], // r_FROM_HEX/1.txt
	from_varbyte: [
		{ name: "FROM_VARBYTE", params: [{ name: "binary_value" }, { name: "format" }], origin: "harvested" },
	], // r_FROM_VARBYTE/1.txt
	geometrytype: [{ name: "GeometryType", params: [{ name: "geom" }], origin: "harvested" }], // GeometryType-function/1.txt
	get_array_length: [{ name: "GET_ARRAY_LENGTH", params: [{ name: "super_expr" }], origin: "harvested" }], // get_array_length/1.txt
	get_mounted_role: [{ name: "get_mounted_role", params: [], origin: "harvested" }], // GET_MOUNTED_ROLE/1.txt
	get_number_attributes: [
		{ name: "GET_NUMBER_ATTRIBUTES", params: [{ name: "super_expression" }], origin: "harvested" },
	], // get_number_attributes/1.txt
	getbit: [{ name: "GETBIT", params: [{ name: "binary_value" }, { name: "index" }], origin: "harvested" }], // r_GETBIT/1.txt
	getdate: [{ name: "GETDATE", params: [], origin: "harvested" }], // r_GETDATE/1.txt
	greatest: [{ name: "GREATEST", params: [{ name: "value" }], variadic: true, origin: "harvested" }], // r_GREATEST_LEAST/1.txt
	h3_boundary: [{ name: "H3_Boundary", params: [{ name: "index" }], origin: "harvested" }], // H3_Boundary-function/1.txt
	h3_center: [{ name: "H3_Center", params: [{ name: "index" }], origin: "harvested" }], // H3_Center-function/1.txt
	h3_fromlonglat: [
		{
			name: "H3_FromLongLat",
			params: [{ name: "longitude" }, { name: "latitude" }, { name: "resolution" }],
			origin: "harvested",
		},
	], // H3_FromLongLat-function/1.txt
	h3_frompoint: [{ name: "H3_FromPoint", params: [{ name: "geom" }, { name: "resolution" }], origin: "harvested" }], // H3_FromPoint-function/1.txt
	h3_isvalid: [{ name: "H3_IsValid", params: [{ name: "index" }], origin: "harvested" }], // H3_IsValid-function/1.txt
	h3_polyfill: [{ name: "H3_Polyfill", params: [{ name: "geom" }, { name: "resolution" }], origin: "harvested" }], // H3_Polyfill-function/1.txt
	h3_resolution: [{ name: "H3_Resolution", params: [{ name: "index" }], origin: "harvested" }], // H3_Resolution-function/1.txt
	h3_tochildren: [
		{ name: "H3_ToChildren", params: [{ name: "index" }, { name: "resolution" }], origin: "harvested" },
	], // H3_ToChildren-function/1.txt
	h3_toparent: [{ name: "H3_ToParent", params: [{ name: "index" }, { name: "resolution" }], origin: "harvested" }], // H3_ToParent-function/1.txt
	hll: [{ name: "HLL", params: [{ name: "aggregate_expression" }], origin: "harvested" }], // r_HLL_function/1.txt
	hll_cardinality: [{ name: "HLL_CARDINALITY", params: [{ name: "hllsketch_expression" }], origin: "harvested" }], // r_HLL_CARDINALITY/1.txt
	hll_combine: [{ name: "HLL_COMBINE", params: [{ name: "hllsketch_expression" }], origin: "harvested" }], // r_HLL_COMBINE/1.txt
	hll_combine_sketches: [
		{
			name: "HLL_COMBINE_SKETCHES",
			params: [{ name: "hllsketch_expression1" }, { name: "hllsketch_expression2" }],
			origin: "harvested",
		},
	], // r_HLL_COMBINE_SKETCHES/1.txt
	hll_create_sketch: [{ name: "HLL_CREATE_SKETCH", params: [{ name: "aggregate_expression" }], origin: "harvested" }], // r_HLL_CREATE_SKETCH/1.txt
	initcap: [{ name: "INITCAP", params: [{ name: "string" }], origin: "harvested" }], // r_INITCAP/1.txt
	interval_cmp: [
		{ name: "INTERVAL_CMP", params: [{ name: "interval1" }, { name: "interval2" }], origin: "harvested" },
	], // r_INTERVAL_CMP/1.txt
	is_array: [{ name: "IS_ARRAY", params: [{ name: "super_expression" }], origin: "harvested" }], // r_is_array/1.txt
	is_bigint: [{ name: "IS_BIGINT", params: [{ name: "super_expression" }], origin: "harvested" }], // r_is_bigint/1.txt
	is_boolean: [{ name: "IS_BOOLEAN", params: [{ name: "super_expression" }], origin: "harvested" }], // r_is_boolean/1.txt
	is_char: [{ name: "IS_CHAR", params: [{ name: "super_expression" }], origin: "harvested" }], // r_is_char/1.txt
	is_decimal: [{ name: "IS_DECIMAL", params: [{ name: "super_expression" }], origin: "harvested" }], // r_is_decimal/1.txt
	is_float: [{ name: "IS_FLOAT", params: [{ name: "super_expression" }], origin: "harvested" }], // r_is_float/1.txt
	is_integer: [{ name: "IS_INTEGER", params: [{ name: "super_expression" }], origin: "harvested" }], // r_is_integer/1.txt
	is_object: [{ name: "IS_OBJECT", params: [{ name: "super_expression" }], origin: "harvested" }], // r_is_object/1.txt
	is_scalar: [{ name: "IS_SCALAR", params: [{ name: "super_expression" }], origin: "harvested" }], // r_is_scalar/1.txt
	is_smallint: [{ name: "IS_SMALLINT", params: [{ name: "super_expression" }], origin: "harvested" }], // r_is_smallint/1.txt
	is_valid_json: [{ name: "IS_VALID_JSON", params: [{ name: "json_string" }], origin: "harvested" }], // IS_VALID_JSON/1.txt
	is_valid_json_array: [{ name: "IS_VALID_JSON_ARRAY", params: [{ name: "json_array" }], origin: "harvested" }], // IS_VALID_JSON_ARRAY/1.txt
	is_varchar: [{ name: "IS_VARCHAR", params: [{ name: "super_expression" }], origin: "harvested" }], // r_is_varchar/1.txt
	json_array_length: [
		{
			name: "JSON_ARRAY_LENGTH",
			params: [{ name: "json_array" }, { name: "null_if_invalid", optional: true }],
			origin: "harvested",
		},
	], // JSON_ARRAY_LENGTH/1.txt
	json_extract_path_text: [
		{
			name: "JSON_EXTRACT_PATH_TEXT",
			params: [
				{ name: "json_string" },
				{ name: "path_elem" },
				{ name: "path_elem", optional: true },
				{ name: "null_if_invalid", optional: true },
			],
			variadic: true,
			origin: "harvested",
		},
	], // JSON_EXTRACT_PATH_TEXT/1.txt
	json_serialize: [{ name: "JSON_SERIALIZE", params: [{ name: "super_expression" }], origin: "harvested" }], // JSON_SERIALIZE/1.txt
	json_serialize_to_varbyte: [
		{ name: "JSON_SERIALIZE_TO_VARBYTE", params: [{ name: "super_expression" }], origin: "harvested" },
	], // JSON_SERIALIZE_TO_VARBYTE/1.txt
	json_size: [{ name: "JSON_SIZE", params: [{ name: "super_expression" }], origin: "harvested" }], // r_json_size/1.txt
	json_typeof: [{ name: "JSON_TYPEOF", params: [{ name: "super_expression" }], origin: "harvested" }], // r_json_typeof/1.txt
	last_user_query_id: [{ name: "last_user_query_id", params: [], origin: "harvested" }], // LAST_USER_QUERY_ID/1.txt
	least: [{ name: "LEAST", params: [{ name: "value" }], variadic: true, origin: "harvested" }], // r_GREATEST_LEAST/1.txt
	left: [{ name: "LEFT", params: [{ name: "string" }, { name: "integer" }], origin: "harvested" }], // r_LEFT/1.txt
	len: [{ name: "LEN", params: [{ name: "expression" }], origin: "harvested" }], // r_LEN/1.txt
	listagg: [
		{
			name: "LISTAGG",
			params: [{ name: "aggregate_expression" }, { name: "delimiter", optional: true }],
			origin: "harvested",
		},
		{
			name: "LISTAGG",
			params: [{ name: "expression" }, { name: "delimiter", optional: true }],
			origin: "harvested",
		},
	], // r_LISTAGG/1.txt, r_WF_LISTAGG/1.txt
	ln: [{ name: "LN", params: [{ name: "expression" }], origin: "harvested" }], // r_LN/1.txt
	lower: [{ name: "LOWER", params: [{ name: "string" }], origin: "harvested" }], // r_LOWER/1.txt
	lower_attribute_names: [
		{ name: "LOWER_ATTRIBUTE_NAMES", params: [{ name: "super_expression" }], origin: "harvested" },
	], // r_lower_attribute_names/1.txt
	lpad: [
		{
			name: "LPAD",
			params: [
				{ name: "string", type: "string" },
				{ name: "length", type: "integer" },
				{ name: "pad", type: "string", optional: true },
			],
			origin: "curated",
		},
	], // curated: LPAD function (pad optional)
	ltrim: [
		{ name: "LTRIM", params: [{ name: "string" }, { name: "trim_chars", optional: true }], origin: "harvested" },
	], // r_LTRIM/1.txt
	max: [{ name: "MAX", params: [{ name: "expression" }], origin: "harvested" }], // r_MAX/1.txt
	md5: [{ name: "MD5", params: [{ name: "string" }], origin: "harvested" }], // r_MD5/1.txt
	median: [{ name: "MEDIAN", params: [{ name: "median_expression" }], origin: "harvested" }], // r_MEDIAN/1.txt
	min: [{ name: "MIN", params: [{ name: "expression" }], origin: "harvested" }], // r_MIN/1.txt
	mod: [{ name: "MOD", params: [{ name: "number1" }, { name: "number2" }], origin: "harvested" }], // r_MOD/1.txt
	months_between: [{ name: "MONTHS_BETWEEN", params: [{ name: "date1" }, { name: "date2" }], origin: "harvested" }], // r_MONTHS_BETWEEN_function/1.txt
	murmur3_32_hash: [
		{ name: "MURMUR3_32_HASH", params: [{ name: "value" }, { name: "seed", optional: true }], origin: "harvested" },
	], // MURMUR3_32_HASH/1.txt
	ntile: [{ name: "NTILE", params: [{ name: "expr" }], origin: "harvested" }], // r_WF_NTILE/1.txt
	nullif: [{ name: "NULLIF", params: [{ name: "expression1" }, { name: "expression2" }], origin: "harvested" }], // r_NULLIF_function/1.txt
	nvl: [
		{ name: "NVL", params: [{ name: "expression" }, { name: "expression" }], variadic: true, origin: "harvested" },
	], // r_NVL_function/1.txt
	nvl2: [
		{
			name: "NVL2",
			params: [{ name: "expression" }, { name: "not_null_return_value" }, { name: "null_return_value" }],
			origin: "harvested",
		},
	], // r_NVL2/1.txt
	octet_length: [{ name: "OCTET_LENGTH", params: [{ name: "expression" }], origin: "harvested" }], // r_OCTET_LENGTH/1.txt
	octetindex: [{ name: "OCTETINDEX", params: [{ name: "substring" }, { name: "string" }], origin: "harvested" }], // OCTETINDEX/1.txt
	percent_rank: [{ name: "PERCENT_RANK", params: [], origin: "harvested" }], // r_WF_PERCENT_RANK/1.txt
	pg_backend_pid: [{ name: "pg_backend_pid", params: [], origin: "harvested" }], // PG_BACKEND_PID/1.txt
	pg_cancel_backend: [{ name: "pg_cancel_backend", params: [{ name: "pid" }], origin: "harvested" }], // PG_CANCEL_BACKEND/1.txt
	pg_get_cols: [{ name: "pg_get_cols", params: [{ name: "name" }], origin: "harvested" }], // PG_GET_COLS/1.txt
	pg_get_grantee_by_iam_role: [
		{ name: "pg_get_grantee_by_iam_role", params: [{ name: "iam_role_arn" }], origin: "harvested" },
	], // PG_GET_GRANTEE_BY_IAMROLE/1.txt
	pg_get_iam_role_by_user: [{ name: "pg_get_iam_role_by_user", params: [{ name: "name" }], origin: "harvested" }], // PG_GET_IAM_ROLE_BY_USER/1.txt
	pg_get_late_binding_view_cols: [{ name: "pg_get_late_binding_view_cols", params: [], origin: "harvested" }], // PG_GET_LATE_BINDING_VIEW_COLS/1.txt
	pg_get_session_roles: [{ name: "pg_get_session_roles", params: [], origin: "harvested" }], // PG_GET_SESSION_ROLES/1.txt
	pg_last_copy_count: [{ name: "pg_last_copy_count", params: [], origin: "harvested" }], // PG_LAST_COPY_COUNT/1.txt
	pg_last_copy_id: [{ name: "pg_last_copy_id", params: [], origin: "harvested" }], // PG_LAST_COPY_ID/1.txt
	pg_last_query_id: [{ name: "pg_last_query_id", params: [], origin: "harvested" }], // PG_LAST_QUERY_ID/1.txt
	pg_last_unload_count: [{ name: "pg_last_unload_count", params: [], origin: "harvested" }], // PG_LAST_UNLOAD_COUNT/1.txt
	pg_last_unload_id: [{ name: "PG_LAST_UNLOAD_ID", params: [], origin: "harvested" }], // PG_LAST_UNLOAD_ID/1.txt
	pg_terminate_backend: [{ name: "pg_terminate_backend", params: [{ name: "pid" }], origin: "harvested" }], // PG_TERMINATE_BACKEND/1.txt
	pi: [{ name: "PI", params: [], origin: "harvested" }], // r_PI/1.txt
	power: [
		{
			name: "POWER",
			params: [
				{ name: "base", type: "numeric" },
				{ name: "exponent", type: "numeric" },
			],
			origin: "curated",
		},
	], // curated: POWER function
	quote_ident: [{ name: "QUOTE_IDENT", params: [{ name: "string" }], origin: "harvested" }], // r_QUOTE_IDENT/1.txt
	quote_literal: [{ name: "QUOTE_LITERAL", params: [{ name: "string" }], origin: "harvested" }], // r_QUOTE_LITERAL/1.txt
	radians: [{ name: "RADIANS", params: [{ name: "number" }], origin: "harvested" }], // r_RADIANS/1.txt
	random: [{ name: "RANDOM", params: [], origin: "harvested" }], // r_RANDOM/1.txt
	ratio_to_report: [{ name: "RATIO_TO_REPORT", params: [{ name: "ratio_expression" }], origin: "harvested" }], // r_WF_RATIO_TO_REPORT/1.txt
	regexp_count: [
		{
			name: "REGEXP_COUNT",
			params: [
				{ name: "source_string" },
				{ name: "pattern" },
				{ name: "position", optional: true },
				{ name: "parameters", optional: true },
			],
			origin: "harvested",
		},
	], // REGEXP_COUNT/1.txt
	regexp_replace: [
		{
			name: "REGEXP_REPLACE",
			params: [
				{ name: "source_string" },
				{ name: "pattern" },
				{ name: "replace_string", optional: true },
				{ name: "position", optional: true },
				{ name: "parameters", optional: true },
			],
			origin: "harvested",
		},
	], // REGEXP_REPLACE/1.txt
	regexp_substr: [
		{
			name: "REGEXP_SUBSTR",
			params: [
				{ name: "source_string" },
				{ name: "pattern" },
				{ name: "position", optional: true },
				{ name: "occurrence", optional: true },
				{ name: "parameters", optional: true },
			],
			origin: "harvested",
		},
	], // REGEXP_SUBSTR/1.txt
	repeat: [{ name: "REPEAT", params: [{ name: "string" }, { name: "integer" }], origin: "harvested" }], // r_REPEAT/1.txt
	replace: [
		{
			name: "REPLACE",
			params: [{ name: "string" }, { name: "old_chars" }, { name: "new_chars" }],
			origin: "harvested",
		},
	], // r_REPLACE/1.txt
	reverse: [{ name: "REVERSE", params: [{ name: "expression" }], origin: "harvested" }], // r_REVERSE/1.txt
	right: [{ name: "RIGHT", params: [{ name: "string" }, { name: "integer" }], origin: "harvested" }], // r_LEFT/1.txt
	role_is_member_of: [
		{
			name: "role_is_member_of",
			params: [{ name: "role_name" }, { name: "granted_role_name" }],
			origin: "harvested",
		},
	], // r_ROLE_IS_MEMBER_OF/1.txt
	round: [{ name: "ROUND", params: [{ name: "number" }, { name: "integer", optional: true }], origin: "harvested" }], // r_ROUND/1.txt
	rpad: [
		{
			name: "RPAD",
			params: [
				{ name: "string", type: "string" },
				{ name: "length", type: "integer" },
				{ name: "pad", type: "string", optional: true },
			],
			origin: "curated",
		},
	], // curated: RPAD function (pad optional)
	rtrim: [
		{
			name: "RTRIM",
			params: [
				{ name: "string", type: "string" },
				{ name: "trim_chars", type: "string", optional: true },
			],
			origin: "curated",
		},
	], // curated: RTRIM function - trim_chars optional per the Arguments section and the corpus's 1-arg calls (r_RTRIM/1.sql), though the Syntax line omits the brackets
	set_config: [
		{
			name: "SET_CONFIG",
			params: [{ name: "parameter" }, { name: "new_value" }, { name: "is_local" }],
			origin: "harvested",
		},
		{
			name: "set_config",
			params: [{ name: "variable_name" }, { name: "new_value" }, { name: "is_local" }],
			origin: "harvested",
		},
	], // r_SET_CONFIG/1.txt, r_SET_CONFIG/2.txt
	sha1: [{ name: "SHA1", params: [{ name: "string" }], origin: "harvested" }], // SHA1/1.txt
	sha2: [{ name: "SHA2", params: [{ name: "string" }, { name: "bits" }], origin: "harvested" }], // SHA2/1.txt
	sign: [{ name: "SIGN", params: [{ name: "number" }], origin: "harvested" }], // r_SIGN/1.txt
	sin: [{ name: "SIN", params: [{ name: "number" }], origin: "harvested" }], // r_SIN/1.txt
	size: [{ name: "SIZE", params: [{ name: "super_expression" }], origin: "harvested" }], // r_SIZE/1.txt
	slice_num: [{ name: "SLICE_NUM", params: [], origin: "harvested" }], // r_SLICE_NUM/1.txt
	soundex: [{ name: "SOUNDEX", params: [{ name: "string" }], origin: "harvested" }], // SOUNDEX/1.txt
	split_part: [
		{
			name: "SPLIT_PART",
			params: [
				{ name: "string", type: "string" },
				{ name: "delimiter", type: "string" },
				{ name: "part", type: "integer" },
			],
			origin: "curated",
		},
	], // curated: SPLIT_PART function
	split_to_array: [
		{ name: "SPLIT_TO_ARRAY", params: [{ name: "string" }, { name: "delimiter" }], origin: "harvested" },
	], // split_to_array/1.txt
	sqrt: [{ name: "SQRT", params: [{ name: "expression" }], origin: "harvested" }], // r_SQRT/1.txt
	st_addpoint: [
		{
			name: "ST_AddPoint",
			params: [{ name: "geom1" }, { name: "geom2" }, { name: "index", optional: true }],
			origin: "harvested",
		},
	], // ST_AddPoint-function/2.txt
	st_angle: [
		{
			name: "ST_Angle",
			params: [{ name: "geom1" }, { name: "geom2" }, { name: "geom3" }, { name: "geom4", optional: true }],
			origin: "harvested",
		},
	], // ST_Angle-function/2.txt
	st_area: [{ name: "ST_Area", params: [{ name: "geo" }], origin: "harvested" }], // ST_Area-function/1.txt
	st_asbinary: [{ name: "ST_AsBinary", params: [{ name: "geom" }], origin: "harvested" }], // ST_AsBinary-function/1.txt
	st_asewkb: [{ name: "ST_AsEWKB", params: [{ name: "geom" }], origin: "harvested" }], // ST_AsEWKB-function/1.txt
	st_asewkt: [
		{ name: "ST_AsEWKT", params: [{ name: "geo" }, { name: "precision", optional: true }], origin: "harvested" },
	], // ST_AsEWKT-function/2.txt
	st_asgeojson: [
		{ name: "ST_AsGeoJSON", params: [{ name: "geo" }, { name: "precision", optional: true }], origin: "harvested" },
	], // ST_AsGeoJSON-function/2.txt
	st_ashexewkb: [{ name: "ST_AsHexEWKB", params: [{ name: "geo" }], origin: "harvested" }], // ST_AsHexEWKB-function/1.txt
	st_ashexwkb: [{ name: "ST_AsHexWKB", params: [{ name: "geo" }], origin: "harvested" }], // ST_AsHexWKB-function/1.txt
	st_astext: [
		{ name: "ST_AsText", params: [{ name: "geo" }, { name: "precision", optional: true }], origin: "harvested" },
	], // ST_AsText-function/2.txt
	st_azimuth: [{ name: "ST_Azimuth", params: [{ name: "point1" }, { name: "point2" }], origin: "harvested" }], // ST_Azimuth-function/1.txt
	st_boundary: [{ name: "ST_Boundary", params: [{ name: "geom" }], origin: "harvested" }], // ST_Boundary-function/1.txt
	st_buffer: [
		{
			name: "ST_Buffer",
			params: [
				{ name: "geom" },
				{ name: "distance" },
				{ name: "number_of_segments_per_quarter_circle", optional: true },
			],
			origin: "harvested",
		},
	], // ST_Buffer-function/2.txt
	st_centroid: [{ name: "ST_Centroid", params: [{ name: "geom" }], origin: "harvested" }], // ST_Centroid-function/1.txt
	st_collect: [
		{ name: "ST_Collect", params: [{ name: "geom1" }, { name: "geom2" }], origin: "curated" },
		{ name: "ST_Collect", params: [{ name: "aggregate_expression" }], origin: "curated" },
	], // curated: ST_Collect(geom1, geom2) scalar and ST_Collect(aggregate_expression) WITHIN GROUP aggregate - ST_Collect-function, corpus 1-arg calls in ST_Collect-function/2.sql and 3.sql
	st_contains: [{ name: "ST_Contains", params: [{ name: "geom1" }, { name: "geom2" }], origin: "harvested" }], // ST_Contains-function/1.txt
	st_containsproperly: [
		{ name: "ST_ContainsProperly", params: [{ name: "geom1" }, { name: "geom2" }], origin: "harvested" },
	], // ST_ContainsProperly-function/1.txt
	st_convexhull: [{ name: "ST_ConvexHull", params: [{ name: "geom" }], origin: "harvested" }], // ST_ConvexHull-function/1.txt
	st_coveredby: [{ name: "ST_CoveredBy", params: [{ name: "geom1" }, { name: "geom2" }], origin: "harvested" }], // ST_CoveredBy-function/1.txt
	st_covers: [{ name: "ST_Covers", params: [{ name: "geom1" }, { name: "geom2" }], origin: "harvested" }], // ST_Covers-function/1.txt
	st_crosses: [{ name: "ST_Crosses", params: [{ name: "geom1" }, { name: "geom2" }], origin: "harvested" }], // ST_Crosses-function/1.txt
	st_dimension: [{ name: "ST_Dimension", params: [{ name: "geom" }], origin: "harvested" }], // ST_Dimension-function/1.txt
	st_disjoint: [{ name: "ST_Disjoint", params: [{ name: "geom1" }, { name: "geom2" }], origin: "harvested" }], // ST_Disjoint-function/1.txt
	st_distance: [{ name: "ST_Distance", params: [{ name: "geo1" }, { name: "geo2" }], origin: "harvested" }], // ST_Distance-function/1.txt
	st_distancesphere: [
		{
			name: "ST_DistanceSphere",
			params: [{ name: "geom1" }, { name: "geom2" }, { name: "radius", optional: true }],
			origin: "harvested",
		},
	], // ST_DistanceSphere-function/2.txt
	st_dwithin: [
		{
			name: "ST_DWithin",
			params: [{ name: "geom1" }, { name: "geom2" }, { name: "threshold" }],
			origin: "harvested",
		},
	], // ST_DWithin-function/1.txt
	st_endpoint: [{ name: "ST_EndPoint", params: [{ name: "geom" }], origin: "harvested" }], // ST_EndPoint-function/1.txt
	st_envelope: [{ name: "ST_Envelope", params: [{ name: "geom" }], origin: "harvested" }], // ST_Envelope-function/1.txt
	st_equals: [{ name: "ST_Equals", params: [{ name: "geom1" }, { name: "geom2" }], origin: "harvested" }], // ST_Equals-function/1.txt
	st_exteriorring: [{ name: "ST_ExteriorRing", params: [{ name: "geom" }], origin: "harvested" }], // ST_ExteriorRing-function/1.txt
	st_force2d: [{ name: "ST_Force2D", params: [{ name: "geom" }], origin: "harvested" }], // ST_Force2D-function/1.txt
	st_force3dm: [{ name: "ST_Force3DM", params: [{ name: "geom" }], origin: "harvested" }], // ST_Force3DM-function/1.txt
	st_force3dz: [{ name: "ST_Force3DZ", params: [{ name: "geom" }], origin: "harvested" }], // ST_Force3DZ-function/1.txt
	st_force4d: [{ name: "ST_Force4D", params: [{ name: "geom" }], origin: "harvested" }], // ST_Force4D-function/1.txt
	st_geogfromtext: [{ name: "ST_GeogFromText", params: [{ name: "wkt_string" }], origin: "harvested" }], // ST_GeogFromText-function/1.txt
	st_geogfromwkb: [{ name: "ST_GeogFromWKB", params: [{ name: "wkb_string" }], origin: "harvested" }], // ST_GeogFromWKB-function/1.txt
	st_geohash: [
		{ name: "ST_GeoHash", params: [{ name: "geom" }, { name: "precision", optional: true }], origin: "harvested" },
	], // ST_GeoHash-function/2.txt
	st_geometryn: [{ name: "ST_GeometryN", params: [{ name: "geom" }, { name: "index" }], origin: "harvested" }], // ST_GeometryN-function/1.txt
	st_geometrytype: [{ name: "ST_GeometryType", params: [{ name: "geom" }], origin: "harvested" }], // ST_GeometryType-function/1.txt
	st_geomfromewkb: [{ name: "ST_GeomFromEWKB", params: [{ name: "ewkb_string" }], origin: "harvested" }], // ST_GeomFromEWKB-function/1.txt
	st_geomfromewkt: [{ name: "ST_GeomFromEWKT", params: [{ name: "ewkt_string" }], origin: "harvested" }], // ST_GeomFromEWKT-function/1.txt
	st_geomfromgeohash: [
		{
			name: "ST_GeomFromGeoHash",
			params: [{ name: "geohash_string" }, { name: "precision", optional: true }],
			origin: "harvested",
		},
	], // ST_GeomFromGeoHash-function/2.txt
	st_geomfromgeojson: [{ name: "ST_GeomFromGeoJSON", params: [{ name: "geojson_string" }], origin: "harvested" }], // ST_GeomFromGeoJSON-function/1.txt
	st_geomfromgeosquare: [
		{
			name: "ST_GeomFromGeoSquare",
			params: [{ name: "geosquare" }, { name: "max_depth", optional: true }],
			origin: "harvested",
		},
	], // ST_GeomFromGeoSquare-function/2.txt
	st_geomfromtext: [
		{
			name: "ST_GeomFromText",
			params: [{ name: "wkt_string" }, { name: "srid", optional: true }],
			origin: "harvested",
		},
	], // ST_GeomFromText-function/2.txt
	st_geomfromwkb: [
		{
			name: "ST_GeomFromWKB",
			params: [{ name: "wkb_string" }, { name: "srid", optional: true }],
			origin: "harvested",
		},
	], // ST_GeomFromWKB-function/2.txt
	st_geosquare: [
		{
			name: "ST_GeoSquare",
			params: [{ name: "geom" }, { name: "max_depth", optional: true }],
			origin: "harvested",
		},
	], // ST_GeoSquare-function/2.txt
	st_interiorringn: [
		{ name: "ST_InteriorRingN", params: [{ name: "geom" }, { name: "index" }], origin: "harvested" },
	], // ST_InteriorRingN-function/1.txt
	st_intersection: [{ name: "ST_Intersection", params: [{ name: "geom1" }, { name: "geom2" }], origin: "harvested" }], // ST_Intersection-function/1.txt
	st_intersects: [{ name: "ST_Intersects", params: [{ name: "geom1" }, { name: "geom2" }], origin: "harvested" }], // ST_Intersects-function/1.txt
	st_isclosed: [{ name: "ST_IsClosed", params: [{ name: "geom" }], origin: "harvested" }], // ST_IsClosed-function/1.txt
	st_iscollection: [{ name: "ST_IsCollection", params: [{ name: "geom" }], origin: "harvested" }], // ST_IsCollection-function/1.txt
	st_isempty: [{ name: "ST_IsEmpty", params: [{ name: "geom" }], origin: "harvested" }], // ST_IsEmpty-function/1.txt
	st_ispolygonccw: [{ name: "ST_IsPolygonCCW", params: [{ name: "geom" }], origin: "harvested" }], // ST_IsPolygonCCW-function/1.txt
	st_ispolygoncw: [{ name: "ST_IsPolygonCW", params: [{ name: "geom" }], origin: "harvested" }], // ST_IsPolygonCW-function/1.txt
	st_isring: [{ name: "ST_IsRing", params: [{ name: "geom" }], origin: "harvested" }], // ST_IsRing-function/1.txt
	st_issimple: [{ name: "ST_IsSimple", params: [{ name: "geom" }], origin: "harvested" }], // ST_IsSimple-function/1.txt
	st_isvalid: [{ name: "ST_IsValid", params: [{ name: "geom" }], origin: "harvested" }], // ST_IsValid-function/1.txt
	st_length: [{ name: "ST_Length", params: [{ name: "geo" }], origin: "harvested" }], // ST_Length-function/1.txt
	st_lengthsphere: [{ name: "ST_LengthSphere", params: [{ name: "geom" }], origin: "harvested" }], // ST_LengthSphere-function/1.txt
	st_linefrommultipoint: [{ name: "ST_LineFromMultiPoint", params: [{ name: "geom" }], origin: "harvested" }], // ST_LineFromMultiPoint-function/1.txt
	st_lineinterpolatepoint: [
		{ name: "ST_LineInterpolatePoint", params: [{ name: "geom" }, { name: "fraction" }], origin: "harvested" },
	], // ST_LineInterpolatePoint-function/1.txt
	st_m: [{ name: "ST_M", params: [{ name: "point" }], origin: "harvested" }], // ST_M-function/1.txt
	st_makeenvelope: [
		{
			name: "ST_MakeEnvelope",
			params: [
				{ name: "xmin" },
				{ name: "ymin" },
				{ name: "xmax" },
				{ name: "ymax" },
				{ name: "srid", optional: true },
			],
			origin: "harvested",
		},
	], // ST_MakeEnvelope-function/2.txt
	st_makeline: [{ name: "ST_MakeLine", params: [{ name: "geom1" }, { name: "geom2" }], origin: "harvested" }], // ST_MakeLine-function/1.txt
	st_makepoint: [
		{
			name: "ST_MakePoint",
			params: [{ name: "x" }, { name: "y" }, { name: "z", optional: true }, { name: "m", optional: true }],
			origin: "harvested",
		},
	], // ST_MakePoint-function/3.txt
	st_makepolygon: [
		{ name: "ST_MakePolygon", params: [{ name: "geom1" }, { name: "geom2", optional: true }], origin: "harvested" },
	], // ST_MakePolygon-function/2.txt
	st_memsize: [{ name: "ST_MemSize", params: [{ name: "geom" }], origin: "harvested" }], // ST_MemSize-function/1.txt
	st_mmax: [{ name: "ST_MMax", params: [{ name: "geom" }], origin: "harvested" }], // ST_MMax-function/1.txt
	st_mmin: [{ name: "ST_MMin", params: [{ name: "geom" }], origin: "harvested" }], // ST_MMin-function/1.txt
	st_multi: [{ name: "ST_Multi", params: [{ name: "geom" }], origin: "harvested" }], // ST_Multi-function/1.txt
	st_ndims: [{ name: "ST_NDims", params: [{ name: "geom" }], origin: "harvested" }], // ST_NDims-function/1.txt
	st_npoints: [{ name: "ST_NPoints", params: [{ name: "geo" }], origin: "harvested" }], // ST_NPoints-function/1.txt
	st_nrings: [{ name: "ST_NRings", params: [{ name: "geom" }], origin: "harvested" }], // ST_NRings-function/1.txt
	st_numgeometries: [{ name: "ST_NumGeometries", params: [{ name: "geom" }], origin: "harvested" }], // ST_NumGeometries-function/1.txt
	st_numinteriorrings: [{ name: "ST_NumInteriorRings", params: [{ name: "geom" }], origin: "harvested" }], // ST_NumInteriorRings-function/1.txt
	st_numpoints: [{ name: "ST_NumPoints", params: [{ name: "geom" }], origin: "harvested" }], // ST_NumPoints-function/1.txt
	st_perimeter: [{ name: "ST_Perimeter", params: [{ name: "geo" }], origin: "harvested" }], // ST_Perimeter-function/1.txt
	st_point: [{ name: "ST_Point", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }], // ST_Point-function/1.txt
	st_pointn: [{ name: "ST_PointN", params: [{ name: "geom" }, { name: "index" }], origin: "harvested" }], // ST_PointN-function/1.txt
	st_points: [{ name: "ST_Points", params: [{ name: "geom" }], origin: "harvested" }], // ST_Points-function/1.txt
	st_polygon: [{ name: "ST_Polygon", params: [{ name: "linestring" }, { name: "srid" }], origin: "harvested" }], // ST_Polygon-function/1.txt
	st_removepoint: [{ name: "ST_RemovePoint", params: [{ name: "geom" }, { name: "index" }], origin: "harvested" }], // ST_RemovePoint-function/1.txt
	st_reverse: [{ name: "ST_Reverse", params: [{ name: "geom" }], origin: "harvested" }], // ST_Reverse-function/1.txt
	st_setpoint: [
		{ name: "ST_SetPoint", params: [{ name: "geom1" }, { name: "index" }, { name: "geom2" }], origin: "harvested" },
	], // ST_SetPoint-function/1.txt
	st_setsrid: [{ name: "ST_SetSRID", params: [{ name: "geom" }, { name: "srid" }], origin: "harvested" }], // ST_SetSRID-function/1.txt
	st_simplify: [{ name: "ST_Simplify", params: [{ name: "geom" }, { name: "tolerance" }], origin: "harvested" }], // ST_Simplify-function/1.txt
	st_srid: [{ name: "ST_SRID", params: [{ name: "geom" }], origin: "harvested" }], // ST_SRID-function/1.txt
	st_startpoint: [{ name: "ST_StartPoint", params: [{ name: "geom" }], origin: "harvested" }], // ST_StartPoint-function/1.txt
	st_touches: [{ name: "ST_Touches", params: [{ name: "geom1" }, { name: "geom2" }], origin: "harvested" }], // ST_Touches-function/1.txt
	st_transform: [{ name: "ST_Transform", params: [{ name: "geom" }, { name: "srid" }], origin: "harvested" }], // ST_Transform-function/1.txt
	st_union: [{ name: "ST_Union", params: [{ name: "geom1" }, { name: "geom2" }], origin: "harvested" }], // ST_Union-function/1.txt
	st_within: [{ name: "ST_Within", params: [{ name: "geom1" }, { name: "geom2" }], origin: "harvested" }], // ST_Within-function/1.txt
	st_x: [{ name: "ST_X", params: [{ name: "point" }], origin: "harvested" }], // ST_X-function/1.txt
	st_xmax: [{ name: "ST_XMax", params: [{ name: "geom" }], origin: "harvested" }], // ST_XMax-function/1.txt
	st_xmin: [{ name: "ST_XMin", params: [{ name: "geom" }], origin: "harvested" }], // ST_XMin-function/1.txt
	st_y: [{ name: "ST_Y", params: [{ name: "point" }], origin: "harvested" }], // ST_Y-function/1.txt
	st_ymax: [{ name: "ST_YMax", params: [{ name: "geom" }], origin: "harvested" }], // ST_YMax-function/1.txt
	st_ymin: [{ name: "ST_YMin", params: [{ name: "geom" }], origin: "harvested" }], // ST_YMin-function/1.txt
	st_z: [{ name: "ST_Z", params: [{ name: "point" }], origin: "harvested" }], // ST_Z-function/1.txt
	st_zmax: [{ name: "ST_ZMax", params: [{ name: "geom" }], origin: "harvested" }], // ST_ZMax-function/1.txt
	st_zmin: [{ name: "ST_ZMin", params: [{ name: "geom" }], origin: "harvested" }], // ST_ZMin-function/1.txt
	stddev_pop: [{ name: "STDDEV_POP", params: [{ name: "expression" }], origin: "harvested" }], // r_STDDEV_functions/1.txt
	strpos: [{ name: "STRPOS", params: [{ name: "string" }, { name: "substring" }], origin: "harvested" }], // r_STRPOS/1.txt
	strtol: [{ name: "STRTOL", params: [{ name: "num_string" }, { name: "base" }], origin: "harvested" }], // r_STRTOL/1.txt
	subarray: [
		{
			name: "SUBARRAY",
			params: [{ name: "super_expr" }, { name: "start_position" }, { name: "length" }],
			origin: "harvested",
		},
	], // r_subarray/1.txt
	substring: [
		{
			name: "SUBSTRING",
			params: [{ name: "character_string" }, { name: "start_position" }, { name: "number_characters" }],
			origin: "harvested",
		},
		{
			name: "SUBSTRING",
			params: [{ name: "binary_expression" }, { name: "start_byte" }, { name: "number_bytes", optional: true }],
			origin: "harvested",
		},
	], // r_SUBSTRING/2.txt, r_SUBSTRING/3.txt
	sum: [{ name: "SUM", params: [{ name: "expression" }], origin: "harvested" }], // r_SUM/1.txt
	supportsbbox: [{ name: "SupportsBBox", params: [{ name: "geom" }], origin: "harvested" }], // SupportsBBox-function/1.txt
	tan: [{ name: "TAN", params: [{ name: "number" }], origin: "harvested" }], // r_TAN/1.txt
	text_to_int_alt: [
		{
			name: "TEXT_TO_INT_ALT",
			params: [{ name: "expression" }, { name: "format", optional: true }],
			origin: "harvested",
		},
	], // r_TEXT_TO_INT_ALT/1.txt
	timeofday: [{ name: "TIMEOFDAY", params: [], origin: "harvested" }], // r_TIMEOFDAY_function/1.txt
	timestamp_cmp: [
		{ name: "TIMESTAMP_CMP", params: [{ name: "timestamp1" }, { name: "timestamp2" }], origin: "harvested" },
	], // r_TIMESTAMP_CMP/1.txt
	timestamp_cmp_date: [
		{ name: "TIMESTAMP_CMP_DATE", params: [{ name: "timestamp" }, { name: "date" }], origin: "harvested" },
	], // r_TIMESTAMP_CMP_DATE/1.txt
	timestamp_cmp_timestamptz: [
		{
			name: "TIMESTAMP_CMP_TIMESTAMPTZ",
			params: [{ name: "timestamp" }, { name: "timestamptz" }],
			origin: "harvested",
		},
	], // r_TIMESTAMP_CMP_TIMESTAMPTZ/1.txt
	timestamptz_cmp: [
		{ name: "TIMESTAMPTZ_CMP", params: [{ name: "timestamptz1" }, { name: "timestamptz2" }], origin: "harvested" },
	], // r_TIMESTAMPTZ_CMP/1.txt
	timestamptz_cmp_date: [
		{ name: "TIMESTAMPTZ_CMP_DATE", params: [{ name: "timestamptz" }, { name: "date" }], origin: "harvested" },
	], // r_TIMESTAMPTZ_CMP_DATE/1.txt
	timestamptz_cmp_timestamp: [
		{
			name: "TIMESTAMPTZ_CMP_TIMESTAMP",
			params: [{ name: "timestamptz" }, { name: "timestamp" }],
			origin: "harvested",
		},
	], // r_TIMESTAMPTZ_CMP_TIMESTAMP/1.txt
	to_date: [
		{
			name: "TO_DATE",
			params: [{ name: "string" }, { name: "format" }, { name: "is_strict", optional: true }],
			origin: "harvested",
		},
	], // r_TO_DATE_function/2.txt
	to_hex: [{ name: "TO_HEX", params: [{ name: "value" }], origin: "harvested" }], // r_TO_HEX/1.txt
	to_number: [{ name: "to_number", params: [{ name: "string" }, { name: "format" }], origin: "harvested" }], // r_TO_NUMBER/1.txt
	to_timestamp: [
		{
			name: "to_timestamp",
			params: [{ name: "timestamp" }, { name: "format" }, { name: "is_strict", optional: true }],
			origin: "harvested",
		},
	], // r_TO_TIMESTAMP/2.txt
	to_varbyte: [{ name: "TO_VARBYTE", params: [{ name: "string" }, { name: "format" }], origin: "harvested" }], // r_TO_VARBYTE/1.txt
	translate: [
		{
			name: "TRANSLATE",
			params: [{ name: "expression" }, { name: "characters_to_replace" }, { name: "characters_to_substitute" }],
			origin: "harvested",
		},
	], // r_TRANSLATE/1.txt
	trim: [{ name: "TRIM", params: [{ name: "string", type: "string" }], origin: "curated" }], // curated: TRIM function
	trunc: [
		{ name: "TRUNC", params: [{ name: "number" }, { name: "integer", optional: true }], origin: "harvested" },
		{ name: "TRUNC", params: [{ name: "timestamp" }], origin: "harvested" },
	], // r_TRUNC/1.txt, r_TRUNC_date/1.txt
	upper: [{ name: "UPPER", params: [{ name: "string" }], origin: "harvested" }], // r_UPPER/1.txt
	upper_attribute_names: [
		{ name: "UPPER_ATTRIBUTE_NAMES", params: [{ name: "super_expression" }], origin: "harvested" },
	], // r_upper_attribute_names/1.txt
	var_pop: [{ name: "VAR_POP", params: [{ name: "expression" }], origin: "harvested" }], // r_VARIANCE_functions/1.txt
	version: [{ name: "VERSION", params: [], origin: "harvested" }], // r_VERSION/1.txt
};
