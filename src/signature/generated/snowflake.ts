// GENERATED — do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// Source: docs.snowflake.com  snowflake/docs/syntax/functions/<name>/N.txt (Syntax blocks, captured by tools/scrape-snowflake-syntax.mjs)
// Harvested 2026-07-14. 516 signatures. Curated FUNCTION_SIGNATURES override these.
import type { FnSignature } from "../signatures.js";

/** Harvested (doc-syntax-derived) parameter signatures for snowflake, keyed by lowercased name. */
export const SNOWFLAKE_HARVESTED: Record<string, FnSignature> = {
	abs: { name: "ABS", params: [{ name: "num_expr" }] }, // functions/abs/1.txt
	accumulate: {
		name: "ACCUMULATE",
		params: [
			{ name: "input_expr" },
			{ name: "initialize_lambda" },
			{ name: "accumulate_lambda" },
			{ name: "combine_lambda" },
			{ name: "terminate_lambda" },
		],
	}, // functions/accumulate/1.txt
	acos: { name: "ACOS", params: [{ name: "input_expr" }] }, // functions/acos/1.txt
	acosh: { name: "ACOSH", params: [{ name: "input_expr" }] }, // functions/acosh/1.txt
	add_months: { name: "ADD_MONTHS", params: [{ name: "date_or_timestamp_expr" }, { name: "num_months_expr" }] }, // functions/add_months/1.txt
	agg: { name: "AGG", params: [{ name: "metric_in_semantic_view" }] }, // functions/agg/1.txt
	ai_agg: { name: "AI_AGG", params: [{ name: "expr" }, { name: "instruction" }] }, // functions/ai_agg/1.txt
	ai_count_tokens: {
		name: "AI_COUNT_TOKENS",
		params: [{ name: "function_name" }, { name: "input_text" }, { name: "return_error_details", optional: true }],
	}, // functions/ai_count_tokens/1.txt
	ai_embed: { name: "AI_EMBED", params: [{ name: "model" }, { name: "input" }] }, // functions/ai_embed/1.txt
	ai_multi_embed: {
		name: "AI_MULTI_EMBED",
		params: [{ name: "model" }, { name: "input" }, { name: "options", optional: true }],
	}, // functions/ai_multi_embed/1.txt
	ai_similarity: {
		name: "AI_SIMILARITY",
		params: [{ name: "input1" }, { name: "input2" }, { name: "config_object", optional: true }],
	}, // functions/ai_similarity/2.txt
	ai_summarize_agg: { name: "AI_SUMMARIZE_AGG", params: [{ name: "expr" }] }, // functions/ai_summarize_agg/1.txt
	ai_translate: {
		name: "AI_TRANSLATE",
		params: [
			{ name: "text" },
			{ name: "source_language" },
			{ name: "target_language" },
			{ name: "return_error_details", optional: true },
		],
	}, // functions/ai_translate/1.txt
	all_user_names: { name: "ALL_USER_NAMES", params: [] }, // functions/all_user_names/1.txt
	any_value: { name: "ANY_VALUE", params: [{ name: "expr1" }] }, // functions/any_value/1.txt
	approx_count_distinct: { name: "APPROX_COUNT_DISTINCT", params: [{ name: "expr1" }], variadic: true }, // functions/approx_count_distinct/1.txt
	approx_percentile: { name: "APPROX_PERCENTILE", params: [{ name: "expr" }, { name: "percentile" }] }, // functions/approx_percentile/1.txt
	approx_percentile_accumulate: { name: "APPROX_PERCENTILE_ACCUMULATE", params: [{ name: "expr" }] }, // functions/approx_percentile_accumulate/1.txt
	approx_percentile_combine: { name: "APPROX_PERCENTILE_COMBINE", params: [{ name: "state" }] }, // functions/approx_percentile_combine/1.txt
	approx_percentile_estimate: {
		name: "APPROX_PERCENTILE_ESTIMATE",
		params: [{ name: "state" }, { name: "percentile" }],
	}, // functions/approx_percentile_estimate/1.txt
	approx_top_k: {
		name: "APPROX_TOP_K",
		params: [{ name: "expr" }, { name: "k", optional: true }, { name: "counters", optional: true }],
	}, // functions/approx_top_k/1.txt
	approx_top_k_accumulate: { name: "APPROX_TOP_K_ACCUMULATE", params: [{ name: "expr" }, { name: "counters" }] }, // functions/approx_top_k_accumulate/1.txt
	approx_top_k_combine: {
		name: "APPROX_TOP_K_COMBINE",
		params: [{ name: "state" }, { name: "counters", optional: true }],
	}, // functions/approx_top_k_combine/1.txt
	approx_top_k_estimate: {
		name: "APPROX_TOP_K_ESTIMATE",
		params: [{ name: "state" }, { name: "k", optional: true }],
	}, // functions/approx_top_k_estimate/1.txt
	approximate_jaccard_index: { name: "APPROXIMATE_JACCARD_INDEX", params: [{ name: "expr" }], variadic: true }, // functions/approximate_jaccard_index/1.txt
	approximate_similarity: { name: "APPROXIMATE_SIMILARITY", params: [{ name: "expr" }], variadic: true }, // functions/approximate_similarity/1.txt
	array_agg: { name: "ARRAY_AGG", params: [{ name: "expr1" }] }, // functions/array_agg/1.txt
	array_append: { name: "ARRAY_APPEND", params: [{ name: "array" }, { name: "new_element" }] }, // functions/array_append/1.txt
	array_cat: { name: "ARRAY_CAT", params: [{ name: "array1" }, { name: "array2" }] }, // functions/array_cat/1.txt
	array_compact: { name: "ARRAY_COMPACT", params: [{ name: "array1" }] }, // functions/array_compact/1.txt
	array_contains: { name: "ARRAY_CONTAINS", params: [{ name: "value_expr" }, { name: "array" }] }, // functions/array_contains/1.txt
	array_distinct: { name: "ARRAY_DISTINCT", params: [{ name: "array" }] }, // functions/array_distinct/1.txt
	array_except: {
		name: "ARRAY_EXCEPT",
		params: [{ name: "source_array" }, { name: "array_of_elements_to_exclude" }],
	}, // functions/array_except/1.txt
	array_flatten: { name: "ARRAY_FLATTEN", params: [{ name: "array" }] }, // functions/array_flatten/1.txt
	array_generate_range: {
		name: "ARRAY_GENERATE_RANGE",
		params: [{ name: "start" }, { name: "stop" }, { name: "step", optional: true }],
	}, // functions/array_generate_range/1.txt
	array_insert: { name: "ARRAY_INSERT", params: [{ name: "array" }, { name: "pos" }, { name: "new_element" }] }, // functions/array_insert/1.txt
	array_intersection: { name: "ARRAY_INTERSECTION", params: [{ name: "array1" }, { name: "array2" }] }, // functions/array_intersection/1.txt
	array_max: { name: "ARRAY_MAX", params: [{ name: "array" }] }, // functions/array_max/1.txt
	array_min: { name: "ARRAY_MIN", params: [{ name: "array" }] }, // functions/array_min/1.txt
	array_position: { name: "ARRAY_POSITION", params: [{ name: "variant_expr" }, { name: "array" }] }, // functions/array_position/1.txt
	array_prepend: { name: "ARRAY_PREPEND", params: [{ name: "array" }, { name: "new_element" }] }, // functions/array_prepend/1.txt
	array_remove: { name: "ARRAY_REMOVE", params: [{ name: "array" }, { name: "value_of_elements_to_remove" }] }, // functions/array_remove/1.txt
	array_remove_at: { name: "ARRAY_REMOVE_AT", params: [{ name: "array" }, { name: "position" }] }, // functions/array_remove_at/1.txt
	array_repeat: { name: "ARRAY_REPEAT", params: [{ name: "element" }, { name: "count" }] }, // functions/array_repeat/1.txt
	array_reverse: { name: "ARRAY_REVERSE", params: [{ name: "array" }] }, // functions/array_reverse/1.txt
	array_slice: { name: "ARRAY_SLICE", params: [{ name: "array" }, { name: "from" }, { name: "to" }] }, // functions/array_slice/1.txt
	array_sort: {
		name: "ARRAY_SORT",
		params: [
			{ name: "array" },
			{ name: "sort_ascending", optional: true },
			{ name: "nulls_first", optional: true },
		],
	}, // functions/array_sort/1.txt
	array_to_string: { name: "ARRAY_TO_STRING", params: [{ name: "array" }, { name: "separator_string" }] }, // functions/array_to_string/1.txt
	array_union_agg: { name: "ARRAY_UNION_AGG", params: [{ name: "column" }] }, // functions/array_union_agg/1.txt
	array_unique_agg: { name: "ARRAY_UNIQUE_AGG", params: [{ name: "column" }] }, // functions/array_unique_agg/1.txt
	arrays_overlap: { name: "ARRAYS_OVERLAP", params: [{ name: "array1" }, { name: "array2" }] }, // functions/arrays_overlap/1.txt
	arrays_to_object: { name: "ARRAYS_TO_OBJECT", params: [{ name: "key_array" }, { name: "value_array" }] }, // functions/arrays_to_object/1.txt
	arrays_zip: { name: "ARRAYS_ZIP", params: [{ name: "array" }, { name: "array", optional: true }], variadic: true }, // functions/arrays_zip/1.txt
	as_array: { name: "AS_ARRAY", params: [{ name: "variant_expr" }] }, // functions/as_array/1.txt
	as_binary: { name: "AS_BINARY", params: [{ name: "variant_expr" }] }, // functions/as_binary/1.txt
	as_boolean: { name: "AS_BOOLEAN", params: [{ name: "variant_expr" }] }, // functions/as_boolean/1.txt
	as_char: { name: "AS_CHAR", params: [{ name: "variant_expr" }] }, // functions/as_char-varchar/1.txt
	as_date: { name: "AS_DATE", params: [{ name: "variant_expr" }] }, // functions/as_date/1.txt
	as_decimal: {
		name: "AS_DECIMAL",
		params: [{ name: "variant_expr" }, { name: "precision", optional: true }, { name: "scale", optional: true }],
	}, // functions/as_decimal-number/1.txt
	as_double: { name: "AS_DOUBLE", params: [{ name: "variant_expr" }] }, // functions/as_double-real/1.txt
	as_integer: { name: "AS_INTEGER", params: [{ name: "variant_expr" }] }, // functions/as_integer/1.txt
	as_number: {
		name: "AS_NUMBER",
		params: [{ name: "variant_expr" }, { name: "precision", optional: true }, { name: "scale", optional: true }],
	}, // functions/as_decimal-number/1.txt
	as_object: { name: "AS_OBJECT", params: [{ name: "variant_expr" }] }, // functions/as_object/1.txt
	as_real: { name: "AS_REAL", params: [{ name: "variant_expr" }] }, // functions/as_double-real/1.txt
	as_time: { name: "AS_TIME", params: [{ name: "variant_expr" }] }, // functions/as_time/1.txt
	as_timestamp_ltz: { name: "AS_TIMESTAMP_LTZ", params: [{ name: "variant_expr" }] }, // functions/as_timestamp/1.txt
	as_timestamp_ntz: { name: "AS_TIMESTAMP_NTZ", params: [{ name: "variant_expr" }] }, // functions/as_timestamp/1.txt
	as_timestamp_tz: { name: "AS_TIMESTAMP_TZ", params: [{ name: "variant_expr" }] }, // functions/as_timestamp/1.txt
	as_varchar: { name: "AS_VARCHAR", params: [{ name: "variant_expr" }] }, // functions/as_char-varchar/1.txt
	ascii: { name: "ASCII", params: [{ name: "input" }] }, // functions/ascii/1.txt
	asin: { name: "ASIN", params: [{ name: "input_expr" }] }, // functions/asin/1.txt
	asinh: { name: "ASINH", params: [{ name: "input_expr" }] }, // functions/asinh/1.txt
	atan: { name: "ATAN", params: [{ name: "input_expr" }] }, // functions/atan/1.txt
	atan2: { name: "ATAN2", params: [{ name: "y" }, { name: "x" }] }, // functions/atan2/1.txt
	atanh: { name: "ATANH", params: [{ name: "input_expr" }] }, // functions/atanh/1.txt
	avg: { name: "AVG", params: [{ name: "expr1" }] }, // functions/avg/1.txt
	base64_decode_binary: {
		name: "BASE64_DECODE_BINARY",
		params: [{ name: "input" }, { name: "alphabet", optional: true }],
	}, // functions/base64_decode_binary/1.txt
	base64_decode_string: {
		name: "BASE64_DECODE_STRING",
		params: [{ name: "input" }, { name: "alphabet", optional: true }],
	}, // functions/base64_decode_string/1.txt
	bind_values: { name: "BIND_VALUES", params: [{ name: "query_id" }] }, // functions/bind_values/1.txt
	bit_length: { name: "BIT_LENGTH", params: [{ name: "string_or_binary" }] }, // functions/bit_length/1.txt
	bitand: { name: "BITAND", params: [{ name: "expr1" }, { name: "expr2" }, { name: "padside", optional: true }] }, // functions/bitand/1.txt
	bitand_agg: { name: "BITAND_AGG", params: [{ name: "expr1" }] }, // functions/bitand_agg/1.txt
	bitmap_absolute_position: {
		name: "BITMAP_ABSOLUTE_POSITION",
		params: [{ name: "bucket_number" }, { name: "relative_position" }],
	}, // functions/bitmap_absolute_position/1.txt
	bitmap_and: { name: "BITMAP_AND", params: [{ name: "bitmap1" }, { name: "bitmap2" }] }, // functions/bitmap_and/1.txt
	bitmap_and_agg: { name: "BITMAP_AND_AGG", params: [{ name: "bitmap" }] }, // functions/bitmap_and_agg/1.txt
	bitmap_bit_position: { name: "BITMAP_BIT_POSITION", params: [{ name: "numeric_expr" }] }, // functions/bitmap_bit_position/1.txt
	bitmap_bucket_number: { name: "BITMAP_BUCKET_NUMBER", params: [{ name: "numeric_expr" }] }, // functions/bitmap_bucket_number/1.txt
	bitmap_construct_agg: { name: "BITMAP_CONSTRUCT_AGG", params: [{ name: "relative_position" }] }, // functions/bitmap_construct_agg/1.txt
	bitmap_count: { name: "BITMAP_COUNT", params: [{ name: "bitmap" }] }, // functions/bitmap_count/1.txt
	bitmap_or: { name: "BITMAP_OR", params: [{ name: "bitmap1" }, { name: "bitmap2" }] }, // functions/bitmap_or/1.txt
	bitmap_or_agg: { name: "BITMAP_OR_AGG", params: [{ name: "bitmap" }] }, // functions/bitmap_or_agg/1.txt
	bitmap_to_array: {
		name: "BITMAP_TO_ARRAY",
		params: [{ name: "bitmap" }, { name: "bucket_number", optional: true }],
	}, // functions/bitmap_to_array/1.txt
	bitnot: { name: "BITNOT", params: [{ name: "expr" }] }, // functions/bitnot/1.txt
	bitor: { name: "BITOR", params: [{ name: "expr1" }, { name: "expr2" }, { name: "padside", optional: true }] }, // functions/bitor/1.txt
	bitor_agg: { name: "BITOR_AGG", params: [{ name: "expr1" }] }, // functions/bitor_agg/1.txt
	bitshiftleft: { name: "BITSHIFTLEFT", params: [{ name: "expr1" }, { name: "n" }] }, // functions/bitshiftleft/1.txt
	bitshiftright: { name: "BITSHIFTRIGHT", params: [{ name: "expr1" }, { name: "n" }] }, // functions/bitshiftright/1.txt
	bitxor: { name: "BITXOR", params: [{ name: "expr1" }, { name: "expr2" }, { name: "padside", optional: true }] }, // functions/bitxor/1.txt
	bitxor_agg: { name: "BITXOR_AGG", params: [{ name: "expr1" }] }, // functions/bitxor_agg/1.txt
	booland: { name: "BOOLAND", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/booland/1.txt
	booland_agg: { name: "BOOLAND_AGG", params: [{ name: "expr" }] }, // functions/booland_agg/1.txt
	boolnot: { name: "BOOLNOT", params: [{ name: "expr" }] }, // functions/boolnot/1.txt
	boolor: { name: "BOOLOR", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/boolor/1.txt
	boolor_agg: { name: "BOOLOR_AGG", params: [{ name: "expr" }] }, // functions/boolor_agg/1.txt
	boolxor: { name: "BOOLXOR", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/boolxor/1.txt
	boolxor_agg: { name: "BOOLXOR_AGG", params: [{ name: "expr" }] }, // functions/boolxor_agg/1.txt
	cbrt: { name: "CBRT", params: [{ name: "input_expr" }] }, // functions/cbrt/1.txt
	ceil: { name: "CEIL", params: [{ name: "input_expr" }, { name: "scale_expr", optional: true }] }, // functions/ceil/1.txt
	charindex: {
		name: "CHARINDEX",
		params: [{ name: "expr1" }, { name: "expr2" }, { name: "start_pos", optional: true }],
	}, // functions/charindex/1.txt
	check_json: { name: "CHECK_JSON", params: [{ name: "string_or_variant_expr" }] }, // functions/check_json/1.txt
	check_xml: {
		name: "CHECK_XML",
		params: [{ name: "string_containing_xml" }, { name: "disable_auto_convert", optional: true }],
	}, // functions/check_xml/1.txt
	chr: { name: "CHR", params: [{ name: "input" }] }, // functions/chr/1.txt
	coalesce: { name: "COALESCE", params: [{ name: "expr1" }, { name: "expr2" }], variadic: true }, // functions/coalesce/1.txt
	collate: { name: "COLLATE", params: [{ name: "string_expression" }, { name: "collation_specification" }] }, // functions/collate/1.txt
	collation: { name: "COLLATION", params: [{ name: "expression" }] }, // functions/collation/1.txt
	compress: { name: "COMPRESS", params: [{ name: "input" }, { name: "method" }] }, // functions/compress/1.txt
	concat: { name: "CONCAT", params: [{ name: "expr" }, { name: "expr", optional: true }], variadic: true }, // functions/concat/1.txt
	concat_ws: {
		name: "CONCAT_WS",
		params: [{ name: "separator" }, { name: "expression" }, { name: "expression", optional: true }],
		variadic: true,
	}, // functions/concat_ws/1.txt
	conditional_change_event: { name: "CONDITIONAL_CHANGE_EVENT", params: [{ name: "expr1" }] }, // functions/conditional_change_event/1.txt
	conditional_true_event: { name: "CONDITIONAL_TRUE_EVENT", params: [{ name: "expr1" }] }, // functions/conditional_true_event/1.txt
	contains: { name: "CONTAINS", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/contains/1.txt
	cos: { name: "COS", params: [{ name: "input_expr" }] }, // functions/cos/1.txt
	cosh: { name: "COSH", params: [{ name: "input_expr" }] }, // functions/cosh/1.txt
	cot: { name: "COT", params: [{ name: "input_expr" }] }, // functions/cot/1.txt
	count: { name: "COUNT", params: [{ name: "expr1" }, { name: "expr2", optional: true }], variadic: true }, // functions/count/1.txt
	count_if: { name: "COUNT_IF", params: [{ name: "condition" }] }, // functions/count_if/1.txt
	cume_dist: { name: "CUME_DIST", params: [] }, // functions/cume_dist/1.txt
	current_account: { name: "CURRENT_ACCOUNT", params: [] }, // functions/current_account/1.txt
	current_account_name: { name: "CURRENT_ACCOUNT_NAME", params: [] }, // functions/current_account_name/1.txt
	current_available_roles: { name: "CURRENT_AVAILABLE_ROLES", params: [] }, // functions/current_available_roles/1.txt
	current_client: { name: "CURRENT_CLIENT", params: [] }, // functions/current_client/1.txt
	current_database: { name: "CURRENT_DATABASE", params: [] }, // functions/current_database/1.txt
	current_date: { name: "CURRENT_DATE", params: [] }, // functions/current_date/1.txt
	current_ip_address: { name: "CURRENT_IP_ADDRESS", params: [] }, // functions/current_ip_address/1.txt
	current_organization_name: { name: "CURRENT_ORGANIZATION_NAME", params: [] }, // functions/current_organization_name/1.txt
	current_organization_user: { name: "CURRENT_ORGANIZATION_USER", params: [] }, // functions/current_organization_user/1.txt
	current_region: { name: "CURRENT_REGION", params: [] }, // functions/current_region/1.txt
	current_role: { name: "CURRENT_ROLE", params: [] }, // functions/current_role/1.txt
	current_role_type: { name: "CURRENT_ROLE_TYPE", params: [] }, // functions/current_role_type/1.txt
	current_schema: { name: "CURRENT_SCHEMA", params: [] }, // functions/current_schema/1.txt
	current_schemas: { name: "CURRENT_SCHEMAS", params: [] }, // functions/current_schemas/1.txt
	current_secondary_roles: { name: "CURRENT_SECONDARY_ROLES", params: [] }, // functions/current_secondary_roles/1.txt
	current_session: { name: "CURRENT_SESSION", params: [] }, // functions/current_session/1.txt
	current_statement: { name: "CURRENT_STATEMENT", params: [] }, // functions/current_statement/1.txt
	current_transaction: { name: "CURRENT_TRANSACTION", params: [] }, // functions/current_transaction/1.txt
	current_user: { name: "CURRENT_USER", params: [] }, // functions/current_user/1.txt
	current_version: { name: "CURRENT_VERSION", params: [] }, // functions/current_version/1.txt
	current_warehouse: { name: "CURRENT_WAREHOUSE", params: [] }, // functions/current_warehouse/1.txt
	database_refresh_history: { name: "DATABASE_REFRESH_HISTORY", params: [{ name: "secondary_db_name" }] }, // functions/database_refresh_history/1.txt
	database_refresh_progress: { name: "DATABASE_REFRESH_PROGRESS", params: [{ name: "secondary_db_name" }] }, // functions/database_refresh_progress/1.txt
	database_refresh_progress_by_job: { name: "DATABASE_REFRESH_PROGRESS_BY_JOB", params: [{ name: "query_id" }] }, // functions/database_refresh_progress/1.txt
	datasketches_hll: { name: "DATASKETCHES_HLL", params: [{ name: "expr1" }, { name: "max_log_k", optional: true }] }, // functions/datasketches_hll/1.txt
	datasketches_hll_accumulate: {
		name: "DATASKETCHES_HLL_ACCUMULATE",
		params: [{ name: "expr" }, { name: "max_log_k", optional: true }],
	}, // functions/datasketches_hll_accumulate/1.txt
	datasketches_hll_combine: {
		name: "DATASKETCHES_HLL_COMBINE",
		params: [{ name: "state" }, { name: "max_log_k", optional: true }],
	}, // functions/datasketches_hll_combine/1.txt
	datasketches_hll_estimate: { name: "DATASKETCHES_HLL_ESTIMATE", params: [{ name: "binary_sketch" }] }, // functions/datasketches_hll_estimate/1.txt
	date: { name: "DATE", params: [{ name: "string_expr" }, { name: "format", optional: true }] }, // functions/to_date/1.txt
	date_from_parts: { name: "DATE_FROM_PARTS", params: [{ name: "year" }, { name: "month" }, { name: "day" }] }, // functions/date_from_parts/1.txt
	date_part: {
		name: "DATE_PART",
		params: [{ name: "date_or_time_part" }, { name: "date_interval_time_or_timestamp_expr" }],
	}, // functions/date_part/1.txt
	date_trunc: { name: "DATE_TRUNC", params: [{ name: "date_or_time_part" }, { name: "date_or_time_expr" }] }, // functions/date_trunc/1.txt
	dateadd: {
		name: "DATEADD",
		params: [{ name: "date_or_time_part" }, { name: "value" }, { name: "date_or_time_expr" }],
	}, // functions/dateadd/1.txt
	datediff: {
		name: "DATEDIFF",
		params: [{ name: "date_or_time_part" }, { name: "date_or_time_expr1" }, { name: "date_or_time_expr2" }],
	}, // functions/datediff/1.txt
	day: { name: "DAY", params: [{ name: "date_interval_or_timestamp_expr" }] }, // functions/year/1.txt
	dayname: { name: "DAYNAME", params: [{ name: "date_or_timestamp_expr" }] }, // functions/dayname/1.txt
	dayofmonth: { name: "DAYOFMONTH", params: [{ name: "date_or_timestamp_expr" }] }, // functions/year/1.txt
	decompress_binary: { name: "DECOMPRESS_BINARY", params: [{ name: "input" }, { name: "method" }] }, // functions/decompress_binary/1.txt
	decompress_string: { name: "DECOMPRESS_STRING", params: [{ name: "input" }, { name: "method" }] }, // functions/decompress_string/1.txt
	degrees: { name: "DEGREES", params: [{ name: "input_expr" }] }, // functions/degrees/1.txt
	dense_rank: { name: "DENSE_RANK", params: [] }, // functions/dense_rank/1.txt
	div0: { name: "DIV0", params: [{ name: "dividend" }, { name: "divisor" }] }, // functions/div0/1.txt
	div0null: { name: "DIV0NULL", params: [{ name: "dividend" }, { name: "divisor" }] }, // functions/div0null/1.txt
	dp_interval_high: { name: "DP_INTERVAL_HIGH", params: [{ name: "aggregated_column" }] }, // functions/dp_interval_high/1.txt
	dp_interval_low: { name: "DP_INTERVAL_LOW", params: [{ name: "aggregated_column" }] }, // functions/dp_interval_low/1.txt
	editdistance: {
		name: "EDITDISTANCE",
		params: [{ name: "string_expr1" }, { name: "string_expr2" }, { name: "max_distance", optional: true }],
	}, // functions/editdistance/1.txt
	endswith: { name: "ENDSWITH", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/endswith/1.txt
	execute_ai_evaluation: {
		name: "EXECUTE_AI_EVALUATION",
		params: [{ name: "evaluation_job" }, { name: "run_parameters" }, { name: "config_file_path" }],
	}, // functions/execute_ai_evaluation/1.txt
	exp: { name: "EXP", params: [{ name: "input_expr" }] }, // functions/exp/1.txt
	explain_json: { name: "EXPLAIN_JSON", params: [{ name: "explain_output_in_json_format" }] }, // functions/explain_json/1.txt
	extract: {
		name: "EXTRACT",
		params: [{ name: "date_or_time_part" }, { name: "date_interval_time_or_timestamp_expr" }],
	}, // functions/extract/2.txt
	extract_semantic_categories: {
		name: "EXTRACT_SEMANTIC_CATEGORIES",
		params: [{ name: "object_name" }, { name: "max_rows_to_scan", optional: true }],
	}, // functions/extract_semantic_categories/1.txt
	factorial: { name: "FACTORIAL", params: [{ name: "integer_expr" }] }, // functions/factorial/1.txt
	filter: { name: "FILTER", params: [{ name: "array" }, { name: "lambda_expression" }] }, // functions/filter/1.txt
	first_value: { name: "FIRST_VALUE", params: [{ name: "expr" }] }, // functions/first_value/1.txt
	floor: { name: "FLOOR", params: [{ name: "input_expr" }, { name: "scale_expr", optional: true }] }, // functions/floor/1.txt
	generate_column_description: {
		name: "GENERATE_COLUMN_DESCRIPTION",
		params: [{ name: "expr" }, { name: "string" }],
	}, // functions/generate_column_description/1.txt
	generate_postgres_access_token_for_user: {
		name: "GENERATE_POSTGRES_ACCESS_TOKEN_FOR_USER",
		params: [{ name: "snowflake_postgres_instance_name" }, { name: "postgres_username" }],
	}, // functions/generate_postgres_access_token_for_user/1.txt
	get_path: { name: "GET_PATH", params: [{ name: "column_identifier" }, { name: "path_name" }] }, // functions/get_path/1.txt
	get_query_operator_stats: { name: "GET_QUERY_OPERATOR_STATS", params: [{ name: "query_id" }] }, // functions/get_query_operator_stats/1.txt
	getbit: { name: "GETBIT", params: [{ name: "integer_expr" }, { name: "bit_position" }] }, // functions/getbit/1.txt
	getdate: { name: "GETDATE", params: [] }, // functions/getdate/1.txt
	getvariable: { name: "GETVARIABLE", params: [{ name: "name" }] }, // functions/getvariable/1.txt
	greatest: { name: "GREATEST", params: [{ name: "expr1" }, { name: "expr2", optional: true }], variadic: true }, // functions/greatest/1.txt
	greatest_ignore_nulls: {
		name: "GREATEST_IGNORE_NULLS",
		params: [{ name: "expr1" }, { name: "expr2", optional: true }],
		variadic: true,
	}, // functions/greatest_ignore_nulls/1.txt
	h3_cell_to_boundary: { name: "H3_CELL_TO_BOUNDARY", params: [{ name: "cell_id" }] }, // functions/h3_cell_to_boundary/1.txt
	h3_cell_to_children: { name: "H3_CELL_TO_CHILDREN", params: [{ name: "cell_id" }, { name: "target_resolution" }] }, // functions/h3_cell_to_children/1.txt
	h3_cell_to_children_string: {
		name: "H3_CELL_TO_CHILDREN_STRING",
		params: [{ name: "cell_id" }, { name: "target_resolution" }],
	}, // functions/h3_cell_to_children_string/1.txt
	h3_cell_to_parent: { name: "H3_CELL_TO_PARENT", params: [{ name: "cell_id" }, { name: "target_resolution" }] }, // functions/h3_cell_to_parent/1.txt
	h3_cell_to_point: { name: "H3_CELL_TO_POINT", params: [{ name: "cell_id" }] }, // functions/h3_cell_to_point/1.txt
	h3_compact_cells: { name: "H3_COMPACT_CELLS", params: [{ name: "array_of_cell_ids" }] }, // functions/h3_compact_cells/1.txt
	h3_compact_cells_strings: { name: "H3_COMPACT_CELLS_STRINGS", params: [{ name: "array_of_cell_ids" }] }, // functions/h3_compact_cells_strings/1.txt
	h3_coverage: { name: "H3_COVERAGE", params: [{ name: "geography_expression" }, { name: "target_resolution" }] }, // functions/h3_coverage/1.txt
	h3_coverage_strings: {
		name: "H3_COVERAGE_STRINGS",
		params: [{ name: "geography_expression" }, { name: "target_resolution" }],
	}, // functions/h3_coverage_strings/1.txt
	h3_get_resolution: { name: "H3_GET_RESOLUTION", params: [{ name: "cell_id" }] }, // functions/h3_get_resolution/1.txt
	h3_grid_disk: { name: "H3_GRID_DISK", params: [{ name: "cell_id" }, { name: "k_value" }] }, // functions/h3_grid_disk/1.txt
	h3_grid_distance: { name: "H3_GRID_DISTANCE", params: [{ name: "cell_id_1" }, { name: "cell_id_2" }] }, // functions/h3_grid_distance/1.txt
	h3_grid_path: { name: "H3_GRID_PATH", params: [{ name: "cell_id_1" }, { name: "cell_id_2" }] }, // functions/h3_grid_path/1.txt
	h3_int_to_string: { name: "H3_INT_TO_STRING", params: [{ name: "cell_id" }] }, // functions/h3_int_to_string/1.txt
	h3_is_pentagon: { name: "H3_IS_PENTAGON", params: [{ name: "cell_id" }] }, // functions/h3_is_pentagon/1.txt
	h3_is_valid_cell: { name: "H3_IS_VALID_CELL", params: [{ name: "cell_id" }] }, // functions/h3_is_valid_cell/1.txt
	h3_latlng_to_cell: {
		name: "H3_LATLNG_TO_CELL",
		params: [{ name: "latitude" }, { name: "longitude" }, { name: "target_resolution" }],
	}, // functions/h3_latlng_to_cell/1.txt
	h3_latlng_to_cell_string: {
		name: "H3_LATLNG_TO_CELL_STRING",
		params: [{ name: "latitude" }, { name: "longitude" }, { name: "target_resolution" }],
	}, // functions/h3_latlng_to_cell_string/1.txt
	h3_point_to_cell: {
		name: "H3_POINT_TO_CELL",
		params: [{ name: "geography_point" }, { name: "target_resolution" }],
	}, // functions/h3_point_to_cell/1.txt
	h3_point_to_cell_string: {
		name: "H3_POINT_TO_CELL_STRING",
		params: [{ name: "geography_point" }, { name: "target_resolution" }],
	}, // functions/h3_point_to_cell_string/1.txt
	h3_polygon_to_cells: {
		name: "H3_POLYGON_TO_CELLS",
		params: [{ name: "geography_polygon" }, { name: "target_resolution" }],
	}, // functions/h3_polygon_to_cells/1.txt
	h3_polygon_to_cells_strings: {
		name: "H3_POLYGON_TO_CELLS_STRINGS",
		params: [{ name: "geography_polygon" }, { name: "target_resolution" }],
	}, // functions/h3_polygon_to_cells_strings/1.txt
	h3_string_to_int: { name: "H3_STRING_TO_INT", params: [{ name: "cell_id" }] }, // functions/h3_string_to_int/1.txt
	h3_try_coverage: {
		name: "H3_TRY_COVERAGE",
		params: [{ name: "geography_expression" }, { name: "target_resolution" }],
	}, // functions/h3_try_coverage/1.txt
	h3_try_coverage_strings: {
		name: "H3_TRY_COVERAGE_STRINGS",
		params: [{ name: "geography_expression" }, { name: "target_resolution" }],
	}, // functions/h3_try_coverage_strings/1.txt
	h3_try_grid_distance: { name: "H3_TRY_GRID_DISTANCE", params: [{ name: "cell_id_1" }, { name: "cell_id_2" }] }, // functions/h3_try_grid_distance/1.txt
	h3_try_grid_path: { name: "H3_TRY_GRID_PATH", params: [{ name: "cell_id_1" }, { name: "cell_id_2" }] }, // functions/h3_try_grid_path/1.txt
	h3_try_polygon_to_cells: {
		name: "H3_TRY_POLYGON_TO_CELLS",
		params: [{ name: "geography_polygon" }, { name: "target_resolution" }],
	}, // functions/h3_try_polygon_to_cells/1.txt
	h3_try_polygon_to_cells_strings: {
		name: "H3_TRY_POLYGON_TO_CELLS_STRINGS",
		params: [{ name: "geography_polygon" }, { name: "target_resolution" }],
	}, // functions/h3_try_polygon_to_cells_strings/1.txt
	h3_uncompact_cells: {
		name: "H3_UNCOMPACT_CELLS",
		params: [{ name: "array_of_cell_ids" }, { name: "target_resolution" }],
	}, // functions/h3_uncompact_cells/1.txt
	h3_uncompact_cells_strings: {
		name: "H3_UNCOMPACT_CELLS_STRINGS",
		params: [{ name: "array_of_cell_ids" }, { name: "target_resolution" }],
	}, // functions/h3_uncompact_cells_strings/1.txt
	hash: { name: "HASH", params: [{ name: "expr" }, { name: "expr", optional: true }], variadic: true }, // functions/hash/1.txt
	hash_agg: { name: "HASH_AGG", params: [{ name: "expr" }, { name: "expr2", optional: true }], variadic: true }, // functions/hash_agg/1.txt
	haversine: { name: "HAVERSINE", params: [{ name: "lat1" }, { name: "lon1" }, { name: "lat2" }, { name: "lon2" }] }, // functions/haversine/1.txt
	hex_decode_binary: { name: "HEX_DECODE_BINARY", params: [{ name: "input" }] }, // functions/hex_decode_binary/1.txt
	hex_decode_string: { name: "HEX_DECODE_STRING", params: [{ name: "input" }] }, // functions/hex_decode_string/1.txt
	hex_encode: { name: "HEX_ENCODE", params: [{ name: "input" }, { name: "case", optional: true }] }, // functions/hex_encode/1.txt
	hll: { name: "HLL", params: [{ name: "expr1" }], variadic: true }, // functions/hll/1.txt
	hll_accumulate: { name: "HLL_ACCUMULATE", params: [{ name: "expr" }] }, // functions/hll_accumulate/1.txt
	hll_combine: { name: "HLL_COMBINE", params: [{ name: "state" }] }, // functions/hll_combine/1.txt
	hll_estimate: { name: "HLL_ESTIMATE", params: [{ name: "state" }] }, // functions/hll_estimate/1.txt
	hll_export: { name: "HLL_EXPORT", params: [{ name: "binary_expr" }] }, // functions/hll_export/1.txt
	hll_import: { name: "HLL_IMPORT", params: [{ name: "obj" }] }, // functions/hll_import/1.txt
	hour: { name: "HOUR", params: [{ name: "time_interval_or_timestamp_expr" }] }, // functions/hour-minute-second/1.txt
	iff: { name: "IFF", params: [{ name: "condition" }, { name: "expr1" }, { name: "expr2" }] }, // functions/iff/1.txt
	ifnull: { name: "IFNULL", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/ifnull/1.txt
	initcap: { name: "INITCAP", params: [{ name: "expr" }, { name: "delimiters", optional: true }] }, // functions/initcap/1.txt
	insert: {
		name: "INSERT",
		params: [{ name: "base_expr" }, { name: "pos" }, { name: "len" }, { name: "insert_expr" }],
	}, // functions/insert/1.txt
	interpolate_bfill: { name: "INTERPOLATE_BFILL", params: [{ name: "expr" }] }, // functions/interpolate_bfill/1.txt
	interpolate_ffill: { name: "INTERPOLATE_FFILL", params: [{ name: "expr" }] }, // functions/interpolate_bfill/2.txt
	interpolate_linear: { name: "INTERPOLATE_LINEAR", params: [{ name: "expr" }] }, // functions/interpolate_bfill/3.txt
	invoker_role: { name: "INVOKER_ROLE", params: [] }, // functions/invoker_role/1.txt
	invoker_share: { name: "INVOKER_SHARE", params: [] }, // functions/invoker_share/1.txt
	is_application_role_in_session: { name: "IS_APPLICATION_ROLE_IN_SESSION", params: [{ name: "string_literal" }] }, // functions/is_application_role_in_session/1.txt
	is_array: { name: "IS_ARRAY", params: [{ name: "variant_expr" }] }, // functions/is_array/1.txt
	is_binary: { name: "IS_BINARY", params: [{ name: "variant_expr" }] }, // functions/is_binary/1.txt
	is_boolean: { name: "IS_BOOLEAN", params: [{ name: "variant_expr" }] }, // functions/is_boolean/1.txt
	is_char: { name: "IS_CHAR", params: [{ name: "variant_expr" }] }, // functions/is_char-varchar/1.txt
	is_date: { name: "IS_DATE", params: [{ name: "variant_expr" }] }, // functions/is_date-value/1.txt
	is_date_value: { name: "IS_DATE_VALUE", params: [{ name: "variant_expr" }] }, // functions/is_date-value/1.txt
	is_decimal: { name: "IS_DECIMAL", params: [{ name: "variant_expr" }] }, // functions/is_decimal/1.txt
	is_double: { name: "IS_DOUBLE", params: [{ name: "variant_expr" }] }, // functions/is_double-real/1.txt
	is_granted_to_invoker_role: { name: "IS_GRANTED_TO_INVOKER_ROLE", params: [{ name: "string_literal" }] }, // functions/is_granted_to_invoker_role/1.txt
	is_instance_role_in_session: {
		name: "IS_INSTANCE_ROLE_IN_SESSION",
		params: [{ name: "instance_name" }, { name: "instance_role_name" }],
	}, // functions/is_instance_role_in_session/1.txt
	is_integer: { name: "IS_INTEGER", params: [{ name: "variant_expr" }] }, // functions/is_integer/1.txt
	is_null_value: { name: "IS_NULL_VALUE", params: [{ name: "variant_expr" }] }, // functions/is_null_value/1.txt
	is_object: { name: "IS_OBJECT", params: [{ name: "variant_expr" }] }, // functions/is_object/1.txt
	is_organization_user: { name: "IS_ORGANIZATION_USER", params: [{ name: "exp" }] }, // functions/is_organization_user/1.txt
	is_organization_user_group: { name: "IS_ORGANIZATION_USER_GROUP", params: [{ name: "role" }] }, // functions/is_organization_user_group/1.txt
	is_organization_user_group_in_session: {
		name: "IS_ORGANIZATION_USER_GROUP_IN_SESSION",
		params: [{ name: "string_literal" }],
	}, // functions/is_organization_user_group_in_session/1.txt
	is_real: { name: "IS_REAL", params: [{ name: "variant_expr" }] }, // functions/is_double-real/1.txt
	is_time: { name: "IS_TIME", params: [{ name: "variant_expr" }] }, // functions/is_time/1.txt
	is_timestamp_ltz: { name: "IS_TIMESTAMP_LTZ", params: [{ name: "variant_expr" }] }, // functions/is_timestamp/1.txt
	is_timestamp_ntz: { name: "IS_TIMESTAMP_NTZ", params: [{ name: "variant_expr" }] }, // functions/is_timestamp/1.txt
	is_timestamp_tz: { name: "IS_TIMESTAMP_TZ", params: [{ name: "variant_expr" }] }, // functions/is_timestamp/1.txt
	is_varchar: { name: "IS_VARCHAR", params: [{ name: "variant_expr" }] }, // functions/is_char-varchar/1.txt
	jarowinkler_similarity: {
		name: "JAROWINKLER_SIMILARITY",
		params: [{ name: "string_expr1" }, { name: "string_expr2" }],
	}, // functions/jarowinkler_similarity/1.txt
	json_extract_path_text: {
		name: "JSON_EXTRACT_PATH_TEXT",
		params: [{ name: "column_identifier" }, { name: "path_name" }],
	}, // functions/json_extract_path_text/1.txt
	kurtosis: { name: "KURTOSIS", params: [{ name: "expr" }] }, // functions/kurtosis/1.txt
	last_day: { name: "LAST_DAY", params: [{ name: "date_or_timestamp_expr" }, { name: "date_part", optional: true }] }, // functions/last_day/1.txt
	last_transaction: { name: "LAST_TRANSACTION", params: [] }, // functions/last_transaction/1.txt
	last_value: { name: "LAST_VALUE", params: [{ name: "expr" }] }, // functions/last_value/1.txt
	least_ignore_nulls: {
		name: "LEAST_IGNORE_NULLS",
		params: [{ name: "expr1" }, { name: "expr2", optional: true }],
		variadic: true,
	}, // functions/least_ignore_nulls/1.txt
	left: { name: "LEFT", params: [{ name: "string_expr" }, { name: "length_expr" }] }, // functions/left/1.txt
	len: { name: "LEN", params: [{ name: "expression" }] }, // functions/length/1.txt
	length: { name: "LENGTH", params: [{ name: "expression" }] }, // functions/length/1.txt
	listagg: { name: "LISTAGG", params: [{ name: "expr1" }, { name: "delimiter", optional: true }] }, // functions/listagg/1.txt
	ln: { name: "LN", params: [{ name: "expr" }] }, // functions/ln/1.txt
	localtime: { name: "LOCALTIME", params: [] }, // functions/localtime/1.txt
	log: { name: "LOG", params: [{ name: "base" }, { name: "expr" }] }, // functions/log/1.txt
	lower: { name: "LOWER", params: [{ name: "expr" }] }, // functions/lower/1.txt
	lpad: { name: "LPAD", params: [{ name: "base" }, { name: "length_expr" }, { name: "pad", optional: true }] }, // functions/lpad/1.txt
	ltrim: { name: "LTRIM", params: [{ name: "expr" }, { name: "characters", optional: true }] }, // functions/ltrim/1.txt
	map_cat: { name: "MAP_CAT", params: [{ name: "map1" }, { name: "map2" }] }, // functions/map_cat/1.txt
	map_contains_key: { name: "MAP_CONTAINS_KEY", params: [{ name: "key" }, { name: "map" }] }, // functions/map_contains_key/1.txt
	map_entries: { name: "MAP_ENTRIES", params: [{ name: "map" }] }, // functions/map_entries/1.txt
	map_insert: {
		name: "MAP_INSERT",
		params: [{ name: "map" }, { name: "key" }, { name: "value" }, { name: "updateFlag", optional: true }],
	}, // functions/map_insert/1.txt
	map_keys: { name: "MAP_KEYS", params: [{ name: "map" }] }, // functions/map_keys/1.txt
	map_pick: { name: "MAP_PICK", params: [{ name: "map" }, { name: "array" }] }, // functions/map_pick/1.txt
	map_size: { name: "MAP_SIZE", params: [{ name: "map" }] }, // functions/map_size/1.txt
	max: { name: "MAX", params: [{ name: "expr" }] }, // functions/max/1.txt
	max_by: {
		name: "MAX_BY",
		params: [
			{ name: "col_to_return" },
			{ name: "col_containing_maximum" },
			{ name: "maximum_number_of_values_to_return", optional: true },
		],
	}, // functions/max_by/1.txt
	md5: { name: "MD5", params: [{ name: "msg" }] }, // functions/md5/1.txt
	md5_binary: { name: "MD5_BINARY", params: [{ name: "msg" }] }, // functions/md5_binary/1.txt
	md5_hex: { name: "MD5_HEX", params: [{ name: "msg" }] }, // functions/md5/1.txt
	md5_number: { name: "MD5_NUMBER", params: [{ name: "msg" }] }, // functions/md5_number/1.txt
	md5_number_lower64: { name: "MD5_NUMBER_LOWER64", params: [{ name: "msg" }] }, // functions/md5_number_lower64/1.txt
	md5_number_upper64: { name: "MD5_NUMBER_UPPER64", params: [{ name: "msg" }] }, // functions/md5_number_upper64/1.txt
	median: { name: "MEDIAN", params: [{ name: "expr" }] }, // functions/median/1.txt
	min: { name: "MIN", params: [{ name: "expr" }] }, // functions/min/1.txt
	min_by: {
		name: "MIN_BY",
		params: [
			{ name: "col_to_return" },
			{ name: "col_containing_minimum" },
			{ name: "maximum_number_of_values_to_return", optional: true },
		],
	}, // functions/min_by/1.txt
	minhash_combine: { name: "MINHASH_COMBINE", params: [{ name: "state" }] }, // functions/minhash_combine/1.txt
	minute: { name: "MINUTE", params: [{ name: "time_interval_or_timestamp_expr" }] }, // functions/hour-minute-second/1.txt
	mod: { name: "MOD", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/mod/1.txt
	mode: { name: "MODE", params: [{ name: "expr1" }] }, // functions/mode/1.txt
	model_monitor_drift_metric: {
		name: "MODEL_MONITOR_DRIFT_METRIC",
		params: [
			{ name: "model_monitor_name" },
			{ name: "drift_metric_name" },
			{ name: "column_name" },
			{ name: "granularity", optional: true },
			{ name: "start_time", optional: true },
			{ name: "end_time", optional: true },
			{ name: "extra_args", optional: true },
		],
	}, // functions/model-monitor-drift-metric/1.txt
	model_monitor_performance_metric: {
		name: "MODEL_MONITOR_PERFORMANCE_METRIC",
		params: [
			{ name: "model_monitor_name" },
			{ name: "performance_metric_name" },
			{ name: "granularity", optional: true },
			{ name: "start_time", optional: true },
			{ name: "end_time", optional: true },
			{ name: "extra_args", optional: true },
		],
	}, // functions/model-monitor-performance-metric/1.txt
	model_monitor_stat_metric: {
		name: "MODEL_MONITOR_STAT_METRIC",
		params: [
			{ name: "model_monitor_name" },
			{ name: "stat_metric_name" },
			{ name: "column_name" },
			{ name: "granularity", optional: true },
			{ name: "start_time", optional: true },
			{ name: "end_time", optional: true },
			{ name: "extra_args", optional: true },
		],
	}, // functions/model-monitor-stat-metric/1.txt
	month: { name: "MONTH", params: [{ name: "date_interval_or_timestamp_expr" }] }, // functions/year/1.txt
	monthname: { name: "MONTHNAME", params: [{ name: "date_or_timestamp_expr" }] }, // functions/monthname/1.txt
	months_between: { name: "MONTHS_BETWEEN", params: [{ name: "date_expr1" }, { name: "date_expr2" }] }, // functions/months_between/1.txt
	next_day: { name: "NEXT_DAY", params: [{ name: "date_or_timestamp_expr" }, { name: "dow_string" }] }, // functions/next_day/1.txt
	normal: { name: "NORMAL", params: [{ name: "mean" }, { name: "stddev" }, { name: "gen" }] }, // functions/normal/1.txt
	nth_value: { name: "NTH_VALUE", params: [{ name: "expr" }, { name: "n" }] }, // functions/nth_value/1.txt
	ntile: { name: "NTILE", params: [{ name: "constant_value" }] }, // functions/ntile/1.txt
	nullif: { name: "NULLIF", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/nullif/1.txt
	nullifzero: { name: "NULLIFZERO", params: [{ name: "expr" }] }, // functions/nullifzero/1.txt
	nvl: { name: "NVL", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/nvl/1.txt
	nvl2: { name: "NVL2", params: [{ name: "expr1" }, { name: "expr2" }, { name: "expr3" }] }, // functions/nvl2/1.txt
	object_agg: { name: "OBJECT_AGG", params: [{ name: "key" }, { name: "value" }] }, // functions/object_agg/1.txt
	object_insert: {
		name: "OBJECT_INSERT",
		params: [{ name: "object" }, { name: "key" }, { name: "value" }, { name: "updateFlag", optional: true }],
	}, // functions/object_insert/1.txt
	object_keys: { name: "OBJECT_KEYS", params: [{ name: "object" }] }, // functions/object_keys/1.txt
	object_pick: { name: "OBJECT_PICK", params: [{ name: "object" }, { name: "array" }] }, // functions/object_pick/1.txt
	octet_length: { name: "OCTET_LENGTH", params: [{ name: "string_or_binary" }] }, // functions/octet_length/1.txt
	parse_ip: {
		name: "PARSE_IP",
		params: [{ name: "expr" }, { name: "type" }, { name: "permissive", optional: true }],
	}, // functions/parse_ip/1.txt
	parse_json: { name: "PARSE_JSON", params: [{ name: "expr" }, { name: "parameter", optional: true }] }, // functions/parse_json/1.txt
	parse_xml: {
		name: "PARSE_XML",
		params: [{ name: "string_containing_xml" }, { name: "disable_auto_convert", optional: true }],
	}, // functions/parse_xml/1.txt
	percent_rank: { name: "PERCENT_RANK", params: [] }, // functions/percent_rank/1.txt
	percentile_cont: { name: "PERCENTILE_CONT", params: [{ name: "percentile" }] }, // functions/percentile_cont/1.txt
	percentile_disc: { name: "PERCENTILE_DISC", params: [{ name: "percentile" }] }, // functions/percentile_disc/1.txt
	pi: { name: "PI", params: [] }, // functions/pi/1.txt
	position: {
		name: "POSITION",
		params: [{ name: "expr1" }, { name: "expr2" }, { name: "start_pos", optional: true }],
	}, // functions/position/1.txt
	previous_day: { name: "PREVIOUS_DAY", params: [{ name: "date_or_timestamp_expr" }, { name: "dow" }] }, // functions/previous_day/1.txt
	quarter: { name: "QUARTER", params: [{ name: "date_or_timestamp_expr" }] }, // functions/year/1.txt
	radians: { name: "RADIANS", params: [{ name: "input_expr" }] }, // functions/radians/1.txt
	randstr: { name: "RANDSTR", params: [{ name: "length" }, { name: "gen" }] }, // functions/randstr/1.txt
	rank: { name: "RANK", params: [] }, // functions/rank/1.txt
	ratio_to_report: { name: "RATIO_TO_REPORT", params: [{ name: "expr1" }] }, // functions/ratio_to_report/1.txt
	reduce: { name: "REDUCE", params: [{ name: "array" }, { name: "init" }, { name: "lambda_expression" }] }, // functions/reduce/1.txt
	regexp_count: {
		name: "REGEXP_COUNT",
		params: [
			{ name: "subject" },
			{ name: "pattern" },
			{ name: "position", optional: true },
			{ name: "parameters", optional: true },
		],
	}, // functions/regexp_count/1.txt
	regexp_instr: {
		name: "REGEXP_INSTR",
		params: [
			{ name: "subject" },
			{ name: "pattern" },
			{ name: "position", optional: true },
			{ name: "occurrence", optional: true },
			{ name: "option", optional: true },
			{ name: "regexp_parameters", optional: true },
			{ name: "group_num", optional: true },
		],
	}, // functions/regexp_instr/1.txt
	regexp_like: {
		name: "REGEXP_LIKE",
		params: [{ name: "subject" }, { name: "pattern" }, { name: "parameters", optional: true }],
	}, // functions/regexp_like/1.txt
	regexp_replace: {
		name: "REGEXP_REPLACE",
		params: [
			{ name: "subject" },
			{ name: "pattern" },
			{ name: "replacement", optional: true },
			{ name: "position", optional: true },
			{ name: "occurrence", optional: true },
			{ name: "parameters", optional: true },
		],
	}, // functions/regexp_replace/1.txt
	regexp_substr: {
		name: "REGEXP_SUBSTR",
		params: [
			{ name: "subject" },
			{ name: "pattern" },
			{ name: "position", optional: true },
			{ name: "occurrence", optional: true },
			{ name: "regex_parameters", optional: true },
			{ name: "group_num", optional: true },
		],
	}, // functions/regexp_substr/1.txt
	regexp_substr_all: {
		name: "REGEXP_SUBSTR_ALL",
		params: [
			{ name: "subject" },
			{ name: "pattern" },
			{ name: "position", optional: true },
			{ name: "occurrence", optional: true },
			{ name: "regex_parameters", optional: true },
			{ name: "group_num", optional: true },
		],
	}, // functions/regexp_substr_all/1.txt
	regr_valx: { name: "REGR_VALX", params: [{ name: "y" }, { name: "x" }] }, // functions/regr_valx/1.txt
	regr_valy: { name: "REGR_VALY", params: [{ name: "y" }, { name: "x" }] }, // functions/regr_valy/1.txt
	repeat: { name: "REPEAT", params: [{ name: "input" }, { name: "n" }] }, // functions/repeat/1.txt
	replace: {
		name: "REPLACE",
		params: [{ name: "subject" }, { name: "pattern" }, { name: "replacement", optional: true }],
	}, // functions/replace/1.txt
	replication_group_dangling_references: {
		name: "REPLICATION_GROUP_DANGLING_REFERENCES",
		params: [{ name: "replication_or_failover_group_name" }],
	}, // functions/replication_group_dangling_references/1.txt
	replication_group_refresh_progress: {
		name: "REPLICATION_GROUP_REFRESH_PROGRESS",
		params: [{ name: "secondary_group_name" }],
	}, // functions/replication_group_refresh_progress/1.txt
	replication_group_refresh_progress_by_job: {
		name: "REPLICATION_GROUP_REFRESH_PROGRESS_BY_JOB",
		params: [{ name: "query_id" }],
	}, // functions/replication_group_refresh_progress/1.txt
	reverse: { name: "REVERSE", params: [{ name: "subject" }] }, // functions/reverse/1.txt
	right: { name: "RIGHT", params: [{ name: "string_expr" }, { name: "length_expr" }] }, // functions/right/1.txt
	round: {
		name: "ROUND",
		params: [
			{ name: "input_expr" },
			{ name: "scale_expr", optional: true },
			{ name: "rounding_mode", optional: true },
		],
	}, // functions/round/1.txt
	row_number: { name: "ROW_NUMBER", params: [] }, // functions/row_number/1.txt
	rpad: { name: "RPAD", params: [{ name: "base" }, { name: "length_expr" }, { name: "pad", optional: true }] }, // functions/rpad/1.txt
	rtrim: { name: "RTRIM", params: [{ name: "expr" }, { name: "characters", optional: true }] }, // functions/rtrim/1.txt
	rtrimmed_length: { name: "RTRIMMED_LENGTH", params: [{ name: "string_expr" }] }, // functions/rtrimmed_length/1.txt
	search_ip: { name: "SEARCH_IP", params: [{ name: "search_data" }, { name: "search_string" }] }, // functions/search_ip/1.txt
	second: { name: "SECOND", params: [{ name: "time_interval_or_timestamp_expr" }] }, // functions/hour-minute-second/1.txt
	sha1: { name: "SHA1", params: [{ name: "msg" }] }, // functions/sha1/1.txt
	sha1_binary: { name: "SHA1_BINARY", params: [{ name: "msg" }] }, // functions/sha1_binary/1.txt
	sha1_hex: { name: "SHA1_HEX", params: [{ name: "msg" }] }, // functions/sha1/1.txt
	sha2: { name: "SHA2", params: [{ name: "msg" }, { name: "digest_size", optional: true }] }, // functions/sha2/1.txt
	sha2_binary: { name: "SHA2_BINARY", params: [{ name: "msg" }, { name: "digest_size", optional: true }] }, // functions/sha2_binary/1.txt
	sha2_hex: { name: "SHA2_HEX", params: [{ name: "msg" }, { name: "digest_size", optional: true }] }, // functions/sha2/1.txt
	sign: { name: "SIGN", params: [{ name: "expr" }] }, // functions/sign/1.txt
	sin: { name: "SIN", params: [{ name: "input_expr" }] }, // functions/sin/1.txt
	sinh: { name: "SINH", params: [{ name: "input_expr" }] }, // functions/sinh/1.txt
	skew: { name: "SKEW", params: [{ name: "expr" }] }, // functions/skew/1.txt
	soundex: { name: "SOUNDEX", params: [{ name: "varchar_expr" }] }, // functions/soundex/1.txt
	space: { name: "SPACE", params: [{ name: "n" }] }, // functions/space/1.txt
	split: { name: "SPLIT", params: [{ name: "string" }, { name: "separator" }] }, // functions/split/1.txt
	split_part: { name: "SPLIT_PART", params: [{ name: "string" }, { name: "delimiter" }, { name: "partNumber" }] }, // functions/split_part/1.txt
	split_to_table: { name: "SPLIT_TO_TABLE", params: [{ name: "string" }, { name: "delimiter" }] }, // functions/split_to_table/1.txt
	st_area: { name: "ST_AREA", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_area/1.txt
	st_asbinary: { name: "ST_ASBINARY", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_aswkb/1.txt
	st_asewkb: { name: "ST_ASEWKB", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_asewkb/1.txt
	st_asewkt: { name: "ST_ASEWKT", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_asewkt/1.txt
	st_asgeojson: { name: "ST_ASGEOJSON", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_asgeojson/1.txt
	st_astext: { name: "ST_ASTEXT", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_aswkt/1.txt
	st_aswkb: { name: "ST_ASWKB", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_aswkb/1.txt
	st_aswkt: { name: "ST_ASWKT", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_aswkt/1.txt
	st_azimuth: {
		name: "ST_AZIMUTH",
		params: [{ name: "geography_expression_for_origin" }, { name: "geography_expression_for_target" }],
	}, // functions/st_azimuth/1.txt
	st_buffer: { name: "ST_BUFFER", params: [{ name: "geometry_expression" }, { name: "distance" }] }, // functions/st_buffer/1.txt
	st_centroid: { name: "ST_CENTROID", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_centroid/1.txt
	st_collect: {
		name: "ST_COLLECT",
		params: [{ name: "geography_expression_1" }, { name: "geography_expression_2", optional: true }],
	}, // functions/st_collect/1.txt
	st_difference: {
		name: "ST_DIFFERENCE",
		params: [{ name: "geography_expression_1" }, { name: "geography_expression_2" }],
	}, // functions/st_difference/1.txt
	st_dimension: { name: "ST_DIMENSION", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_dimension/1.txt
	st_distance: {
		name: "ST_DISTANCE",
		params: [{ name: "geography_or_geometry_expression_1" }, { name: "geography_or_geometry_expression_2" }],
	}, // functions/st_distance/1.txt
	st_dwithin: {
		name: "ST_DWITHIN",
		params: [
			{ name: "geography_expression_1" },
			{ name: "geography_expression_2" },
			{ name: "distance_in_meters" },
		],
	}, // functions/st_dwithin/1.txt
	st_endpoint: { name: "ST_ENDPOINT", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_endpoint/1.txt
	st_envelope: { name: "ST_ENVELOPE", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_envelope/1.txt
	st_geogfromewkb: {
		name: "ST_GEOGFROMEWKB",
		params: [{ name: "varchar_or_binary_expression" }, { name: "allow_invalid", optional: true }],
	}, // functions/st_geographyfromwkb/1.txt
	st_geogfromewkt: {
		name: "ST_GEOGFROMEWKT",
		params: [{ name: "varchar_expression" }, { name: "allow_invalid", optional: true }],
	}, // functions/st_geographyfromwkt/1.txt
	st_geogfromgeohash: {
		name: "ST_GEOGFROMGEOHASH",
		params: [{ name: "geohash" }, { name: "precision", optional: true }],
	}, // functions/st_geogfromgeohash/1.txt
	st_geogfromtext: {
		name: "ST_GEOGFROMTEXT",
		params: [{ name: "varchar_expression" }, { name: "allow_invalid", optional: true }],
	}, // functions/st_geographyfromwkt/1.txt
	st_geogfromwkb: {
		name: "ST_GEOGFROMWKB",
		params: [{ name: "varchar_or_binary_expression" }, { name: "allow_invalid", optional: true }],
	}, // functions/st_geographyfromwkb/1.txt
	st_geogfromwkt: {
		name: "ST_GEOGFROMWKT",
		params: [{ name: "varchar_expression" }, { name: "allow_invalid", optional: true }],
	}, // functions/st_geographyfromwkt/1.txt
	st_geogpointfromgeohash: { name: "ST_GEOGPOINTFROMGEOHASH", params: [{ name: "geohash" }] }, // functions/st_geogpointfromgeohash/1.txt
	st_geographyfromewkb: {
		name: "ST_GEOGRAPHYFROMEWKB",
		params: [{ name: "varchar_or_binary_expression" }, { name: "allow_invalid", optional: true }],
	}, // functions/st_geographyfromwkb/1.txt
	st_geographyfromewkt: {
		name: "ST_GEOGRAPHYFROMEWKT",
		params: [{ name: "varchar_expression" }, { name: "allow_invalid", optional: true }],
	}, // functions/st_geographyfromwkt/1.txt
	st_geographyfromtext: {
		name: "ST_GEOGRAPHYFROMTEXT",
		params: [{ name: "varchar_expression" }, { name: "allow_invalid", optional: true }],
	}, // functions/st_geographyfromwkt/1.txt
	st_geographyfromwkb: {
		name: "ST_GEOGRAPHYFROMWKB",
		params: [{ name: "varchar_or_binary_expression" }, { name: "allow_invalid", optional: true }],
	}, // functions/st_geographyfromwkb/1.txt
	st_geographyfromwkt: {
		name: "ST_GEOGRAPHYFROMWKT",
		params: [{ name: "varchar_expression" }, { name: "allow_invalid", optional: true }],
	}, // functions/st_geographyfromwkt/1.txt
	st_geomfromgeohash: {
		name: "ST_GEOMFROMGEOHASH",
		params: [{ name: "geohash" }, { name: "precision", optional: true }],
	}, // functions/st_geomfromgeohash/1.txt
	st_geompointfromgeohash: { name: "ST_GEOMPOINTFROMGEOHASH", params: [{ name: "geohash" }] }, // functions/st_geompointfromgeohash/1.txt
	st_hausdorffdistance: {
		name: "ST_HAUSDORFFDISTANCE",
		params: [{ name: "geography_expression_1" }, { name: "geography_expression_2" }],
	}, // functions/st_hausdorffdistance/1.txt
	st_interpolate: {
		name: "ST_INTERPOLATE",
		params: [{ name: "geography_expression" }, { name: "tolerance", optional: true }],
	}, // functions/st_interpolate/1.txt
	st_intersection: {
		name: "ST_INTERSECTION",
		params: [{ name: "geography_expression_1" }, { name: "geography_expression_2" }],
	}, // functions/st_intersection/1.txt
	st_intersection_agg: { name: "ST_INTERSECTION_AGG", params: [{ name: "geography_column" }] }, // functions/st_intersection_agg/1.txt
	st_isvalid: { name: "ST_ISVALID", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_isvalid/1.txt
	st_length: { name: "ST_LENGTH", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_length/1.txt
	st_makegeompoint: { name: "ST_MAKEGEOMPOINT", params: [{ name: "longitude" }, { name: "latitude" }] }, // functions/st_makegeompoint/1.txt
	st_makepoint: { name: "ST_MAKEPOINT", params: [{ name: "longitude" }, { name: "latitude" }] }, // functions/st_makepoint/1.txt
	st_makepolygon: { name: "ST_MAKEPOLYGON", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_makepolygon/1.txt
	st_makepolygonoriented: { name: "ST_MAKEPOLYGONORIENTED", params: [{ name: "geography_expression" }] }, // functions/st_makepolygonoriented/1.txt
	st_npoints: { name: "ST_NPOINTS", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_npoints/1.txt
	st_perimeter: { name: "ST_PERIMETER", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_perimeter/1.txt
	st_pointn: { name: "ST_POINTN", params: [{ name: "geography_or_geometry_expression" }, { name: "index" }] }, // functions/st_pointn/1.txt
	st_setsrid: { name: "ST_SETSRID", params: [{ name: "geometry_expression" }, { name: "srid" }] }, // functions/st_setsrid/1.txt
	st_simplify: {
		name: "ST_SIMPLIFY",
		params: [
			{ name: "geography_expression" },
			{ name: "tolerance" },
			{ name: "preserve_collapsed", optional: true },
		],
	}, // functions/st_simplify/1.txt
	st_srid: { name: "ST_SRID", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_srid/1.txt
	st_startpoint: { name: "ST_STARTPOINT", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_startpoint/1.txt
	st_symdifference: {
		name: "ST_SYMDIFFERENCE",
		params: [{ name: "geography_expression_1" }, { name: "geography_expression_2" }],
	}, // functions/st_symdifference/1.txt
	st_union: { name: "ST_UNION", params: [{ name: "geography_expression_1" }, { name: "geography_expression_2" }] }, // functions/st_union/1.txt
	st_union_agg: { name: "ST_UNION_AGG", params: [{ name: "geography_column" }] }, // functions/st_union_agg/1.txt
	st_x: { name: "ST_X", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_x/1.txt
	st_xmax: { name: "ST_XMAX", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_xmax/1.txt
	st_xmin: { name: "ST_XMIN", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_xmin/1.txt
	st_y: { name: "ST_Y", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_y/1.txt
	st_ymax: { name: "ST_YMAX", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_ymax/1.txt
	st_ymin: { name: "ST_YMIN", params: [{ name: "geography_or_geometry_expression" }] }, // functions/st_ymin/1.txt
	startswith: { name: "STARTSWITH", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/startswith/1.txt
	stddev_pop: { name: "STDDEV_POP", params: [{ name: "expr1" }] }, // functions/stddev_pop/1.txt
	strip_null_value: { name: "STRIP_NULL_VALUE", params: [{ name: "variant_expr" }] }, // functions/strip_null_value/1.txt
	strtok_split_to_table: {
		name: "STRTOK_SPLIT_TO_TABLE",
		params: [{ name: "string" }, { name: "delimiter_list", optional: true }],
	}, // functions/strtok_split_to_table/1.txt
	strtok_to_array: { name: "STRTOK_TO_ARRAY", params: [{ name: "string" }, { name: "delimiter", optional: true }] }, // functions/strtok_to_array/1.txt
	substr: {
		name: "SUBSTR",
		params: [{ name: "base_expr" }, { name: "start_expr" }, { name: "length_expr", optional: true }],
	}, // functions/substr/1.txt
	substring: {
		name: "SUBSTRING",
		params: [{ name: "base_expr" }, { name: "start_expr" }, { name: "length_expr", optional: true }],
	}, // functions/substr/1.txt
	sum: { name: "SUM", params: [{ name: "expr1" }] }, // functions/sum/1.txt
	sysdate: { name: "SYSDATE", params: [] }, // functions/sysdate/1.txt
	systimestamp: { name: "SYSTIMESTAMP", params: [] }, // functions/systimestamp/1.txt
	tag_references: { name: "TAG_REFERENCES", params: [{ name: "object_name" }, { name: "object_domain" }] }, // functions/tag_references/1.txt
	tag_references_all_columns: {
		name: "TAG_REFERENCES_ALL_COLUMNS",
		params: [{ name: "object_name" }, { name: "object_domain" }],
	}, // functions/tag_references_all_columns/1.txt
	tag_references_with_lineage: { name: "TAG_REFERENCES_WITH_LINEAGE", params: [{ name: "name" }] }, // functions/tag_references_with_lineage/1.txt
	tan: { name: "TAN", params: [{ name: "input_expr" }] }, // functions/tan/1.txt
	tanh: { name: "TANH", params: [{ name: "real_expr" }] }, // functions/tanh/1.txt
	time: { name: "TIME", params: [{ name: "string_expr" }] }, // functions/to_time/1.txt
	time_from_parts: {
		name: "TIME_FROM_PARTS",
		params: [{ name: "hour" }, { name: "minute" }, { name: "second" }, { name: "nanoseconds", optional: true }],
	}, // functions/time_from_parts/1.txt
	time_slice: {
		name: "TIME_SLICE",
		params: [
			{ name: "date_or_time_expr" },
			{ name: "slice_length" },
			{ name: "date_or_time_part" },
			{ name: "start_or_end", optional: true },
		],
	}, // functions/time_slice/1.txt
	timeadd: {
		name: "TIMEADD",
		params: [{ name: "date_or_time_part" }, { name: "value" }, { name: "date_or_time_expr" }],
	}, // functions/timeadd/1.txt
	timestamp_from_parts: { name: "TIMESTAMP_FROM_PARTS", params: [{ name: "date_expr" }, { name: "time_expr" }] }, // functions/timestamp_from_parts/1.txt
	timestamp_ltz_from_parts: {
		name: "TIMESTAMP_LTZ_FROM_PARTS",
		params: [
			{ name: "year" },
			{ name: "month" },
			{ name: "day" },
			{ name: "hour" },
			{ name: "minute" },
			{ name: "second" },
			{ name: "nanosecond", optional: true },
		],
	}, // functions/timestamp_from_parts/2.txt
	timestampadd: {
		name: "TIMESTAMPADD",
		params: [{ name: "date_or_time_part" }, { name: "time_value" }, { name: "date_or_time_expr" }],
	}, // functions/timestampadd/1.txt
	timestampdiff: {
		name: "TIMESTAMPDIFF",
		params: [{ name: "date_or_time_part" }, { name: "date_or_time_expr1" }, { name: "date_or_time_expr2" }],
	}, // functions/timestampdiff/1.txt
	to_array: { name: "TO_ARRAY", params: [{ name: "expr" }] }, // functions/to_array/1.txt
	to_binary: { name: "TO_BINARY", params: [{ name: "string_expr" }, { name: "format", optional: true }] }, // functions/to_binary/1.txt
	to_boolean: { name: "TO_BOOLEAN", params: [{ name: "string_or_numeric_expr" }] }, // functions/to_boolean/1.txt
	to_char: { name: "TO_CHAR", params: [{ name: "expr" }] }, // functions/to_char/1.txt
	to_date: { name: "TO_DATE", params: [{ name: "string_expr" }, { name: "format", optional: true }] }, // functions/to_date/1.txt
	to_decfloat: { name: "TO_DECFLOAT", params: [{ name: "expr" }, { name: "format", optional: true }] }, // functions/to_decfloat/1.txt
	to_double: { name: "TO_DOUBLE", params: [{ name: "expr" }, { name: "format", optional: true }] }, // functions/to_double/1.txt
	to_json: { name: "TO_JSON", params: [{ name: "expr" }] }, // functions/to_json/1.txt
	to_object: { name: "TO_OBJECT", params: [{ name: "expr" }] }, // functions/to_object/1.txt
	to_time: { name: "TO_TIME", params: [{ name: "string_expr" }, { name: "format", optional: true }] }, // functions/to_time/1.txt
	to_uuid: { name: "TO_UUID", params: [{ name: "string_expr" }] }, // functions/to_uuid/1.txt
	to_varchar: { name: "TO_VARCHAR", params: [{ name: "expr" }] }, // functions/to_char/1.txt
	to_variant: { name: "TO_VARIANT", params: [{ name: "expr" }] }, // functions/to_variant/1.txt
	to_xml: { name: "TO_XML", params: [{ name: "expression" }] }, // functions/to_xml/1.txt
	transform: { name: "TRANSFORM", params: [{ name: "array" }, { name: "lambda_expression" }] }, // functions/transform/1.txt
	translate: {
		name: "TRANSLATE",
		params: [{ name: "subject" }, { name: "sourceAlphabet" }, { name: "targetAlphabet" }],
	}, // functions/translate/1.txt
	trim: { name: "TRIM", params: [{ name: "expr" }, { name: "characters", optional: true }] }, // functions/trim/1.txt
	truncate: { name: "TRUNCATE", params: [{ name: "input_expr" }, { name: "scale_expr", optional: true }] }, // functions/trunc/1.txt
	try_base64_decode_binary: {
		name: "TRY_BASE64_DECODE_BINARY",
		params: [{ name: "input" }, { name: "alphabet", optional: true }],
	}, // functions/try_base64_decode_binary/1.txt
	try_base64_decode_string: {
		name: "TRY_BASE64_DECODE_STRING",
		params: [{ name: "input" }, { name: "alphabet", optional: true }],
	}, // functions/try_base64_decode_string/1.txt
	try_hex_decode_binary: { name: "TRY_HEX_DECODE_BINARY", params: [{ name: "input" }] }, // functions/try_hex_decode_binary/1.txt
	try_hex_decode_string: { name: "TRY_HEX_DECODE_STRING", params: [{ name: "input" }] }, // functions/try_hex_decode_string/1.txt
	try_parse_json: { name: "TRY_PARSE_JSON", params: [{ name: "expr" }, { name: "parameter", optional: true }] }, // functions/try_parse_json/1.txt
	try_to_binary: { name: "TRY_TO_BINARY", params: [{ name: "string_expr" }, { name: "format", optional: true }] }, // functions/try_to_binary/1.txt
	try_to_boolean: { name: "TRY_TO_BOOLEAN", params: [{ name: "string_expr" }] }, // functions/try_to_boolean/1.txt
	try_to_date: { name: "TRY_TO_DATE", params: [{ name: "string_expr" }, { name: "format", optional: true }] }, // functions/try_to_date/1.txt
	try_to_decfloat: { name: "TRY_TO_DECFLOAT", params: [{ name: "string_expr" }, { name: "format", optional: true }] }, // functions/try_to_decfloat/1.txt
	try_to_double: { name: "TRY_TO_DOUBLE", params: [{ name: "string_expr" }, { name: "format", optional: true }] }, // functions/try_to_double/1.txt
	try_to_time: { name: "TRY_TO_TIME", params: [{ name: "string_expr" }, { name: "format", optional: true }] }, // functions/try_to_time/1.txt
	try_to_uuid: { name: "TRY_TO_UUID", params: [{ name: "string_expr" }] }, // functions/try_to_uuid/1.txt
	typeof: { name: "TYPEOF", params: [{ name: "expr" }] }, // functions/typeof/1.txt
	unicode: { name: "UNICODE", params: [{ name: "input" }] }, // functions/unicode/1.txt
	uniform: { name: "UNIFORM", params: [{ name: "min" }, { name: "max" }, { name: "gen" }] }, // functions/uniform/1.txt
	upper: { name: "UPPER", params: [{ name: "expr" }] }, // functions/upper/1.txt
	uuid_string: {
		name: "UUID_STRING",
		params: [
			{ name: "uuid", optional: true },
			{ name: "name", optional: true },
		],
	}, // functions/uuid_string/1.txt
	var_pop: { name: "VAR_POP", params: [{ name: "expr1" }] }, // functions/var_pop/1.txt
	var_samp: { name: "VAR_SAMP", params: [{ name: "expr1" }] }, // functions/var_samp/1.txt
	variance: { name: "VARIANCE", params: [{ name: "expr1" }] }, // functions/variance/1.txt
	variance_pop: { name: "VARIANCE_POP", params: [{ name: "expr1" }] }, // functions/variance_pop/1.txt
	vector_avg: { name: "VECTOR_AVG", params: [{ name: "vector_column" }] }, // functions/vector_avg/1.txt
	vector_cosine_similarity: { name: "VECTOR_COSINE_SIMILARITY", params: [{ name: "vector" }, { name: "vector" }] }, // functions/vector_cosine_similarity/1.txt
	vector_inner_product: { name: "VECTOR_INNER_PRODUCT", params: [{ name: "vector" }, { name: "vector" }] }, // functions/vector_inner_product/1.txt
	vector_l1_distance: { name: "VECTOR_L1_DISTANCE", params: [{ name: "vector" }, { name: "vector" }] }, // functions/vector_l1_distance/1.txt
	vector_l2_distance: { name: "VECTOR_L2_DISTANCE", params: [{ name: "vector" }, { name: "vector" }] }, // functions/vector_l2_distance/1.txt
	vector_max: { name: "VECTOR_MAX", params: [{ name: "vector_column" }] }, // functions/vector_max/1.txt
	vector_min: { name: "VECTOR_MIN", params: [{ name: "vector_column" }] }, // functions/vector_min/1.txt
	vector_normalize: { name: "VECTOR_NORMALIZE", params: [{ name: "vector" }] }, // functions/vector_normalize/1.txt
	vector_sum: { name: "VECTOR_SUM", params: [{ name: "vector_column" }] }, // functions/vector_sum/1.txt
	vector_truncate: { name: "VECTOR_TRUNCATE", params: [{ name: "vector" }, { name: "dimension" }] }, // functions/vector_truncate/1.txt
	week: { name: "WEEK", params: [{ name: "date_or_timestamp_expr" }] }, // functions/year/1.txt
	weekofyear: { name: "WEEKOFYEAR", params: [{ name: "date_or_timestamp_expr" }] }, // functions/year/1.txt
	width_bucket: {
		name: "WIDTH_BUCKET",
		params: [{ name: "expr" }, { name: "min_value" }, { name: "max_value" }, { name: "num_buckets" }],
	}, // functions/width_bucket/1.txt
	xmlget: {
		name: "XMLGET",
		params: [{ name: "expression" }, { name: "tag_name" }, { name: "instance_number", optional: true }],
	}, // functions/xmlget/1.txt
	year: { name: "YEAR", params: [{ name: "date_interval_or_timestamp_expr" }] }, // functions/year/1.txt
	yearofweek: { name: "YEAROFWEEK", params: [{ name: "date_or_timestamp_expr" }] }, // functions/year/1.txt
	zeroifnull: { name: "ZEROIFNULL", params: [{ name: "expr" }] }, // functions/zeroifnull/1.txt
	zipf: { name: "ZIPF", params: [{ name: "s" }, { name: "N" }, { name: "gen" }] }, // functions/zipf/1.txt
};
