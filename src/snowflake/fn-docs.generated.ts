// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for snowflake (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-14. 540 names (0 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const SNOWFLAKE_FN_DOCS: Record<string, FnDoc> = {
	abs: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/abs", origin: "vendor-docs" },
	accumulate: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/accumulate", origin: "vendor-docs" },
	acos: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/acos", origin: "vendor-docs" },
	acosh: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/acosh", origin: "vendor-docs" },
	add_months: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/add_months", origin: "vendor-docs" },
	agg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/agg", origin: "vendor-docs" },
	ai_agg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_agg", origin: "vendor-docs" },
	ai_complete: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_complete", origin: "vendor-docs" },
	ai_count_tokens: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_count_tokens",
		origin: "vendor-docs",
	},
	ai_embed: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_embed", origin: "vendor-docs" },
	ai_extract: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_extract", origin: "vendor-docs" },
	ai_filter: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_filter", origin: "vendor-docs" },
	ai_multi_embed: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_multi_embed",
		origin: "vendor-docs",
	},
	ai_similarity: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_similarity",
		origin: "vendor-docs",
	},
	ai_summarize_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_summarize_agg",
		origin: "vendor-docs",
	},
	ai_translate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_translate",
		origin: "vendor-docs",
	},
	all_user_names: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/all_user_names",
		origin: "vendor-docs",
	},
	any_value: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/any_value", origin: "vendor-docs" },
	approx_count_distinct: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_count_distinct",
		origin: "vendor-docs",
	},
	approx_percentile: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_percentile",
		origin: "vendor-docs",
	},
	approx_percentile_accumulate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_percentile_accumulate",
		origin: "vendor-docs",
	},
	approx_percentile_combine: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_percentile_combine",
		origin: "vendor-docs",
	},
	approx_percentile_estimate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_percentile_estimate",
		origin: "vendor-docs",
	},
	approx_top_k: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_top_k",
		origin: "vendor-docs",
	},
	approx_top_k_accumulate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_top_k_accumulate",
		origin: "vendor-docs",
	},
	approx_top_k_combine: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_top_k_combine",
		origin: "vendor-docs",
	},
	approx_top_k_estimate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_top_k_estimate",
		origin: "vendor-docs",
	},
	approximate_jaccard_index: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approximate_jaccard_index",
		origin: "vendor-docs",
	},
	approximate_similarity: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approximate_similarity",
		origin: "vendor-docs",
	},
	array_agg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_agg", origin: "vendor-docs" },
	array_append: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_append",
		origin: "vendor-docs",
	},
	array_cat: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_cat", origin: "vendor-docs" },
	array_compact: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_compact",
		origin: "vendor-docs",
	},
	array_contains: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_contains",
		origin: "vendor-docs",
	},
	array_distinct: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_distinct",
		origin: "vendor-docs",
	},
	array_except: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_except",
		origin: "vendor-docs",
	},
	array_flatten: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_flatten",
		origin: "vendor-docs",
	},
	array_generate_range: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_generate_range",
		origin: "vendor-docs",
	},
	array_insert: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_insert",
		origin: "vendor-docs",
	},
	array_intersection: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_intersection",
		origin: "vendor-docs",
	},
	array_max: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_max", origin: "vendor-docs" },
	array_min: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_min", origin: "vendor-docs" },
	array_position: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_position",
		origin: "vendor-docs",
	},
	array_prepend: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_prepend",
		origin: "vendor-docs",
	},
	array_remove: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_remove",
		origin: "vendor-docs",
	},
	array_remove_at: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_remove_at",
		origin: "vendor-docs",
	},
	array_repeat: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_repeat",
		origin: "vendor-docs",
	},
	array_reverse: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_reverse",
		origin: "vendor-docs",
	},
	array_size: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_size", origin: "vendor-docs" },
	array_slice: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_slice", origin: "vendor-docs" },
	array_sort: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_sort", origin: "vendor-docs" },
	array_to_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_to_string",
		origin: "vendor-docs",
	},
	array_union_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_union_agg",
		origin: "vendor-docs",
	},
	array_unique_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_unique_agg",
		origin: "vendor-docs",
	},
	arrays_overlap: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/arrays_overlap",
		origin: "vendor-docs",
	},
	arrays_to_object: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/arrays_to_object",
		origin: "vendor-docs",
	},
	arrays_zip: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/arrays_zip", origin: "vendor-docs" },
	as_array: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_array", origin: "vendor-docs" },
	as_binary: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_binary", origin: "vendor-docs" },
	as_boolean: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_boolean", origin: "vendor-docs" },
	as_char: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_char-varchar", origin: "vendor-docs" },
	as_date: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_date", origin: "vendor-docs" },
	as_decimal: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_decimal-number",
		origin: "vendor-docs",
	},
	as_double: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_double-real",
		origin: "vendor-docs",
	},
	as_integer: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_integer", origin: "vendor-docs" },
	as_number: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_decimal-number",
		origin: "vendor-docs",
	},
	as_object: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_object", origin: "vendor-docs" },
	as_real: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_double-real", origin: "vendor-docs" },
	as_time: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_time", origin: "vendor-docs" },
	as_timestamp_ltz: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_timestamp",
		origin: "vendor-docs",
	},
	as_timestamp_ntz: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_timestamp",
		origin: "vendor-docs",
	},
	as_timestamp_tz: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_timestamp",
		origin: "vendor-docs",
	},
	as_varchar: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_char-varchar",
		origin: "vendor-docs",
	},
	ascii: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ascii", origin: "vendor-docs" },
	asin: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/asin", origin: "vendor-docs" },
	asinh: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/asinh", origin: "vendor-docs" },
	atan: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/atan", origin: "vendor-docs" },
	atan2: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/atan2", origin: "vendor-docs" },
	atanh: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/atanh", origin: "vendor-docs" },
	avg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/avg", origin: "vendor-docs" },
	base64_decode_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/base64_decode_binary",
		origin: "vendor-docs",
	},
	base64_decode_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/base64_decode_string",
		origin: "vendor-docs",
	},
	bind_values: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bind_values", origin: "vendor-docs" },
	bit_length: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bit_length", origin: "vendor-docs" },
	bitand: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitand", origin: "vendor-docs" },
	bitand_agg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitand_agg", origin: "vendor-docs" },
	bitmap_absolute_position: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_absolute_position",
		origin: "vendor-docs",
	},
	bitmap_and: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_and", origin: "vendor-docs" },
	bitmap_and_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_and_agg",
		origin: "vendor-docs",
	},
	bitmap_bit_position: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_bit_position",
		origin: "vendor-docs",
	},
	bitmap_bucket_number: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_bucket_number",
		origin: "vendor-docs",
	},
	bitmap_construct_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_construct_agg",
		origin: "vendor-docs",
	},
	bitmap_count: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_count",
		origin: "vendor-docs",
	},
	bitmap_or: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_or", origin: "vendor-docs" },
	bitmap_or_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_or_agg",
		origin: "vendor-docs",
	},
	bitmap_to_array: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_to_array",
		origin: "vendor-docs",
	},
	bitnot: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitnot", origin: "vendor-docs" },
	bitor: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitor", origin: "vendor-docs" },
	bitor_agg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitor_agg", origin: "vendor-docs" },
	bitshiftleft: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitshiftleft",
		origin: "vendor-docs",
	},
	bitshiftright: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitshiftright",
		origin: "vendor-docs",
	},
	bitxor: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitxor", origin: "vendor-docs" },
	bitxor_agg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitxor_agg", origin: "vendor-docs" },
	booland: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/booland", origin: "vendor-docs" },
	booland_agg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/booland_agg", origin: "vendor-docs" },
	boolnot: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/boolnot", origin: "vendor-docs" },
	boolor: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/boolor", origin: "vendor-docs" },
	boolor_agg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/boolor_agg", origin: "vendor-docs" },
	boolxor: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/boolxor", origin: "vendor-docs" },
	boolxor_agg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/boolxor_agg", origin: "vendor-docs" },
	cbrt: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/cbrt", origin: "vendor-docs" },
	ceil: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ceil", origin: "vendor-docs" },
	charindex: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/charindex", origin: "vendor-docs" },
	check_json: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/check_json", origin: "vendor-docs" },
	check_xml: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/check_xml", origin: "vendor-docs" },
	chr: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/chr", origin: "vendor-docs" },
	coalesce: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/coalesce", origin: "vendor-docs" },
	collate: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/collate", origin: "vendor-docs" },
	collation: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/collation", origin: "vendor-docs" },
	compress: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/compress", origin: "vendor-docs" },
	concat: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/concat", origin: "vendor-docs" },
	concat_ws: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/concat_ws", origin: "vendor-docs" },
	conditional_change_event: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/conditional_change_event",
		origin: "vendor-docs",
	},
	conditional_true_event: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/conditional_true_event",
		origin: "vendor-docs",
	},
	contains: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/contains", origin: "vendor-docs" },
	convert_timezone: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/convert_timezone",
		origin: "vendor-docs",
	},
	cos: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/cos", origin: "vendor-docs" },
	cosh: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/cosh", origin: "vendor-docs" },
	cot: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/cot", origin: "vendor-docs" },
	count: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/count", origin: "vendor-docs" },
	count_if: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/count_if", origin: "vendor-docs" },
	cume_dist: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/cume_dist", origin: "vendor-docs" },
	current_account: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_account",
		origin: "vendor-docs",
	},
	current_account_name: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_account_name",
		origin: "vendor-docs",
	},
	current_available_roles: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_available_roles",
		origin: "vendor-docs",
	},
	current_client: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_client",
		origin: "vendor-docs",
	},
	current_database: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_database",
		origin: "vendor-docs",
	},
	current_date: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_date",
		origin: "vendor-docs",
	},
	current_ip_address: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_ip_address",
		origin: "vendor-docs",
	},
	current_organization_name: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_organization_name",
		origin: "vendor-docs",
	},
	current_organization_user: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_organization_user",
		origin: "vendor-docs",
	},
	current_region: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_region",
		origin: "vendor-docs",
	},
	current_role: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_role",
		origin: "vendor-docs",
	},
	current_role_type: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_role_type",
		origin: "vendor-docs",
	},
	current_schema: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_schema",
		origin: "vendor-docs",
	},
	current_schemas: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_schemas",
		origin: "vendor-docs",
	},
	current_secondary_roles: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_secondary_roles",
		origin: "vendor-docs",
	},
	current_session: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_session",
		origin: "vendor-docs",
	},
	current_statement: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_statement",
		origin: "vendor-docs",
	},
	current_transaction: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_transaction",
		origin: "vendor-docs",
	},
	current_user: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_user",
		origin: "vendor-docs",
	},
	current_version: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_version",
		origin: "vendor-docs",
	},
	current_warehouse: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_warehouse",
		origin: "vendor-docs",
	},
	database_refresh_history: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/database_refresh_history",
		origin: "vendor-docs",
	},
	database_refresh_progress: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/database_refresh_progress",
		origin: "vendor-docs",
	},
	database_refresh_progress_by_job: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/database_refresh_progress",
		origin: "vendor-docs",
	},
	datasketches_hll: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/datasketches_hll",
		origin: "vendor-docs",
	},
	datasketches_hll_accumulate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/datasketches_hll_accumulate",
		origin: "vendor-docs",
	},
	datasketches_hll_combine: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/datasketches_hll_combine",
		origin: "vendor-docs",
	},
	datasketches_hll_estimate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/datasketches_hll_estimate",
		origin: "vendor-docs",
	},
	date: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_date", origin: "vendor-docs" },
	date_from_parts: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/date_from_parts",
		origin: "vendor-docs",
	},
	date_part: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/date_part", origin: "vendor-docs" },
	date_trunc: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/date_trunc", origin: "vendor-docs" },
	dateadd: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/dateadd", origin: "vendor-docs" },
	datediff: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/datediff", origin: "vendor-docs" },
	day: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year", origin: "vendor-docs" },
	dayname: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/dayname", origin: "vendor-docs" },
	dayofmonth: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year", origin: "vendor-docs" },
	decode: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/decode", origin: "vendor-docs" },
	decompress_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/decompress_binary",
		origin: "vendor-docs",
	},
	decompress_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/decompress_string",
		origin: "vendor-docs",
	},
	degrees: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/degrees", origin: "vendor-docs" },
	dense_rank: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/dense_rank", origin: "vendor-docs" },
	div0: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/div0", origin: "vendor-docs" },
	div0null: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/div0null", origin: "vendor-docs" },
	dp_interval_high: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/dp_interval_high",
		origin: "vendor-docs",
	},
	dp_interval_low: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/dp_interval_low",
		origin: "vendor-docs",
	},
	editdistance: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/editdistance",
		origin: "vendor-docs",
	},
	endswith: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/endswith", origin: "vendor-docs" },
	execute_ai_evaluation: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/execute_ai_evaluation",
		origin: "vendor-docs",
	},
	exp: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/exp", origin: "vendor-docs" },
	explain_json: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/explain_json",
		origin: "vendor-docs",
	},
	extract: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/extract", origin: "vendor-docs" },
	extract_semantic_categories: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/extract_semantic_categories",
		origin: "vendor-docs",
	},
	factorial: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/factorial", origin: "vendor-docs" },
	filter: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/filter", origin: "vendor-docs" },
	first_value: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/first_value", origin: "vendor-docs" },
	floor: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/floor", origin: "vendor-docs" },
	generate_column_description: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/generate_column_description",
		origin: "vendor-docs",
	},
	generate_postgres_access_token_for_user: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/generate_postgres_access_token_for_user",
		origin: "vendor-docs",
	},
	get: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/get", origin: "vendor-docs" },
	get_ignore_case: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/get_ignore_case",
		origin: "vendor-docs",
	},
	get_path: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/get_path", origin: "vendor-docs" },
	get_query_operator_stats: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/get_query_operator_stats",
		origin: "vendor-docs",
	},
	getbit: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/getbit", origin: "vendor-docs" },
	getdate: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/getdate", origin: "vendor-docs" },
	getvariable: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/getvariable", origin: "vendor-docs" },
	greatest: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/greatest", origin: "vendor-docs" },
	greatest_ignore_nulls: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/greatest_ignore_nulls",
		origin: "vendor-docs",
	},
	h3_cell_to_boundary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_cell_to_boundary",
		origin: "vendor-docs",
	},
	h3_cell_to_children: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_cell_to_children",
		origin: "vendor-docs",
	},
	h3_cell_to_children_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_cell_to_children_string",
		origin: "vendor-docs",
	},
	h3_cell_to_parent: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_cell_to_parent",
		origin: "vendor-docs",
	},
	h3_cell_to_point: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_cell_to_point",
		origin: "vendor-docs",
	},
	h3_compact_cells: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_compact_cells",
		origin: "vendor-docs",
	},
	h3_compact_cells_strings: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_compact_cells_strings",
		origin: "vendor-docs",
	},
	h3_coverage: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_coverage", origin: "vendor-docs" },
	h3_coverage_strings: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_coverage_strings",
		origin: "vendor-docs",
	},
	h3_get_resolution: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_get_resolution",
		origin: "vendor-docs",
	},
	h3_grid_disk: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_grid_disk",
		origin: "vendor-docs",
	},
	h3_grid_distance: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_grid_distance",
		origin: "vendor-docs",
	},
	h3_grid_path: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_grid_path",
		origin: "vendor-docs",
	},
	h3_int_to_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_int_to_string",
		origin: "vendor-docs",
	},
	h3_is_pentagon: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_is_pentagon",
		origin: "vendor-docs",
	},
	h3_is_valid_cell: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_is_valid_cell",
		origin: "vendor-docs",
	},
	h3_latlng_to_cell: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_latlng_to_cell",
		origin: "vendor-docs",
	},
	h3_latlng_to_cell_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_latlng_to_cell_string",
		origin: "vendor-docs",
	},
	h3_point_to_cell: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_point_to_cell",
		origin: "vendor-docs",
	},
	h3_point_to_cell_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_point_to_cell_string",
		origin: "vendor-docs",
	},
	h3_polygon_to_cells: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_polygon_to_cells",
		origin: "vendor-docs",
	},
	h3_polygon_to_cells_strings: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_polygon_to_cells_strings",
		origin: "vendor-docs",
	},
	h3_string_to_int: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_string_to_int",
		origin: "vendor-docs",
	},
	h3_try_coverage: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_try_coverage",
		origin: "vendor-docs",
	},
	h3_try_coverage_strings: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_try_coverage_strings",
		origin: "vendor-docs",
	},
	h3_try_grid_distance: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_try_grid_distance",
		origin: "vendor-docs",
	},
	h3_try_grid_path: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_try_grid_path",
		origin: "vendor-docs",
	},
	h3_try_polygon_to_cells: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_try_polygon_to_cells",
		origin: "vendor-docs",
	},
	h3_try_polygon_to_cells_strings: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_try_polygon_to_cells_strings",
		origin: "vendor-docs",
	},
	h3_uncompact_cells: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_uncompact_cells",
		origin: "vendor-docs",
	},
	h3_uncompact_cells_strings: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_uncompact_cells_strings",
		origin: "vendor-docs",
	},
	hash: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hash", origin: "vendor-docs" },
	hash_agg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hash_agg", origin: "vendor-docs" },
	haversine: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/haversine", origin: "vendor-docs" },
	hex_decode_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hex_decode_binary",
		origin: "vendor-docs",
	},
	hex_decode_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hex_decode_string",
		origin: "vendor-docs",
	},
	hex_encode: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hex_encode", origin: "vendor-docs" },
	hll: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hll", origin: "vendor-docs" },
	hll_accumulate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hll_accumulate",
		origin: "vendor-docs",
	},
	hll_combine: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hll_combine", origin: "vendor-docs" },
	hll_estimate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hll_estimate",
		origin: "vendor-docs",
	},
	hll_export: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hll_export", origin: "vendor-docs" },
	hll_import: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hll_import", origin: "vendor-docs" },
	hour: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hour-minute-second", origin: "vendor-docs" },
	iff: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/iff", origin: "vendor-docs" },
	ifnull: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ifnull", origin: "vendor-docs" },
	initcap: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/initcap", origin: "vendor-docs" },
	insert: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/insert", origin: "vendor-docs" },
	interpolate_bfill: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/interpolate_bfill",
		origin: "vendor-docs",
	},
	interpolate_ffill: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/interpolate_bfill",
		origin: "vendor-docs",
	},
	interpolate_linear: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/interpolate_bfill",
		origin: "vendor-docs",
	},
	invoker_role: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/invoker_role",
		origin: "vendor-docs",
	},
	invoker_share: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/invoker_share",
		origin: "vendor-docs",
	},
	is_application_role_in_session: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_application_role_in_session",
		origin: "vendor-docs",
	},
	is_array: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_array", origin: "vendor-docs" },
	is_binary: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_binary", origin: "vendor-docs" },
	is_boolean: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_boolean", origin: "vendor-docs" },
	is_char: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_char-varchar", origin: "vendor-docs" },
	is_database_role_in_session: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_database_role_in_session",
		origin: "vendor-docs",
	},
	is_date: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_date-value", origin: "vendor-docs" },
	is_date_value: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_date-value",
		origin: "vendor-docs",
	},
	is_decimal: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_decimal", origin: "vendor-docs" },
	is_double: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_double-real",
		origin: "vendor-docs",
	},
	is_granted_to_invoker_role: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_granted_to_invoker_role",
		origin: "vendor-docs",
	},
	is_instance_role_in_session: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_instance_role_in_session",
		origin: "vendor-docs",
	},
	is_integer: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_integer", origin: "vendor-docs" },
	is_null_value: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_null_value",
		origin: "vendor-docs",
	},
	is_object: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_object", origin: "vendor-docs" },
	is_organization_user: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_organization_user",
		origin: "vendor-docs",
	},
	is_organization_user_group: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_organization_user_group",
		origin: "vendor-docs",
	},
	is_organization_user_group_in_session: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_organization_user_group_in_session",
		origin: "vendor-docs",
	},
	is_real: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_double-real", origin: "vendor-docs" },
	is_role_in_session: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_role_in_session",
		origin: "vendor-docs",
	},
	is_time: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_time", origin: "vendor-docs" },
	is_timestamp_ltz: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_timestamp",
		origin: "vendor-docs",
	},
	is_timestamp_ntz: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_timestamp",
		origin: "vendor-docs",
	},
	is_timestamp_tz: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_timestamp",
		origin: "vendor-docs",
	},
	is_varchar: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_char-varchar",
		origin: "vendor-docs",
	},
	jarowinkler_similarity: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/jarowinkler_similarity",
		origin: "vendor-docs",
	},
	json_extract_path_text: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/json_extract_path_text",
		origin: "vendor-docs",
	},
	kurtosis: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/kurtosis", origin: "vendor-docs" },
	last_day: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/last_day", origin: "vendor-docs" },
	last_transaction: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/last_transaction",
		origin: "vendor-docs",
	},
	last_value: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/last_value", origin: "vendor-docs" },
	least_ignore_nulls: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/least_ignore_nulls",
		origin: "vendor-docs",
	},
	left: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/left", origin: "vendor-docs" },
	len: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/length", origin: "vendor-docs" },
	length: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/length", origin: "vendor-docs" },
	listagg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/listagg", origin: "vendor-docs" },
	ln: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ln", origin: "vendor-docs" },
	localtime: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/localtime", origin: "vendor-docs" },
	log: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/log", origin: "vendor-docs" },
	lower: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/lower", origin: "vendor-docs" },
	lpad: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/lpad", origin: "vendor-docs" },
	ltrim: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ltrim", origin: "vendor-docs" },
	map_cat: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/map_cat", origin: "vendor-docs" },
	map_contains_key: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/map_contains_key",
		origin: "vendor-docs",
	},
	map_entries: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/map_entries", origin: "vendor-docs" },
	map_insert: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/map_insert", origin: "vendor-docs" },
	map_keys: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/map_keys", origin: "vendor-docs" },
	map_pick: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/map_pick", origin: "vendor-docs" },
	map_size: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/map_size", origin: "vendor-docs" },
	max: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/max", origin: "vendor-docs" },
	max_by: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/max_by", origin: "vendor-docs" },
	md5: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/md5", origin: "vendor-docs" },
	md5_binary: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/md5_binary", origin: "vendor-docs" },
	md5_hex: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/md5", origin: "vendor-docs" },
	md5_number: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/md5_number", origin: "vendor-docs" },
	md5_number_lower64: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/md5_number_lower64",
		origin: "vendor-docs",
	},
	md5_number_upper64: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/md5_number_upper64",
		origin: "vendor-docs",
	},
	median: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/median", origin: "vendor-docs" },
	min: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/min", origin: "vendor-docs" },
	min_by: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/min_by", origin: "vendor-docs" },
	minhash_combine: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/minhash_combine",
		origin: "vendor-docs",
	},
	minute: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hour-minute-second",
		origin: "vendor-docs",
	},
	mod: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/mod", origin: "vendor-docs" },
	mode: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/mode", origin: "vendor-docs" },
	model_monitor_drift_metric: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/model-monitor-drift-metric",
		origin: "vendor-docs",
	},
	model_monitor_performance_metric: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/model-monitor-performance-metric",
		origin: "vendor-docs",
	},
	model_monitor_stat_metric: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/model-monitor-stat-metric",
		origin: "vendor-docs",
	},
	month: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year", origin: "vendor-docs" },
	monthname: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/monthname", origin: "vendor-docs" },
	months_between: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/months_between",
		origin: "vendor-docs",
	},
	next_day: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/next_day", origin: "vendor-docs" },
	normal: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/normal", origin: "vendor-docs" },
	nth_value: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/nth_value", origin: "vendor-docs" },
	ntile: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ntile", origin: "vendor-docs" },
	nullif: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/nullif", origin: "vendor-docs" },
	nullifzero: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/nullifzero", origin: "vendor-docs" },
	nvl: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/nvl", origin: "vendor-docs" },
	nvl2: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/nvl2", origin: "vendor-docs" },
	object_agg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/object_agg", origin: "vendor-docs" },
	object_insert: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/object_insert",
		origin: "vendor-docs",
	},
	object_keys: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/object_keys", origin: "vendor-docs" },
	object_pick: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/object_pick", origin: "vendor-docs" },
	octet_length: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/octet_length",
		origin: "vendor-docs",
	},
	parse_ip: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/parse_ip", origin: "vendor-docs" },
	parse_json: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/parse_json", origin: "vendor-docs" },
	parse_xml: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/parse_xml", origin: "vendor-docs" },
	percent_rank: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/percent_rank",
		origin: "vendor-docs",
	},
	percentile_cont: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/percentile_cont",
		origin: "vendor-docs",
	},
	percentile_disc: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/percentile_disc",
		origin: "vendor-docs",
	},
	pi: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/pi", origin: "vendor-docs" },
	position: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/position", origin: "vendor-docs" },
	previous_day: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/previous_day",
		origin: "vendor-docs",
	},
	quarter: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year", origin: "vendor-docs" },
	radians: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/radians", origin: "vendor-docs" },
	randstr: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/randstr", origin: "vendor-docs" },
	rank: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/rank", origin: "vendor-docs" },
	ratio_to_report: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ratio_to_report",
		origin: "vendor-docs",
	},
	reduce: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/reduce", origin: "vendor-docs" },
	regexp_count: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regexp_count",
		origin: "vendor-docs",
	},
	regexp_instr: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regexp_instr",
		origin: "vendor-docs",
	},
	regexp_like: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regexp_like", origin: "vendor-docs" },
	regexp_replace: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regexp_replace",
		origin: "vendor-docs",
	},
	regexp_substr: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regexp_substr",
		origin: "vendor-docs",
	},
	regexp_substr_all: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regexp_substr_all",
		origin: "vendor-docs",
	},
	regr_valx: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regr_valx", origin: "vendor-docs" },
	regr_valy: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regr_valy", origin: "vendor-docs" },
	repeat: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/repeat", origin: "vendor-docs" },
	replace: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/replace", origin: "vendor-docs" },
	replication_group_dangling_references: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/replication_group_dangling_references",
		origin: "vendor-docs",
	},
	replication_group_refresh_progress: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/replication_group_refresh_progress",
		origin: "vendor-docs",
	},
	replication_group_refresh_progress_by_job: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/replication_group_refresh_progress",
		origin: "vendor-docs",
	},
	reverse: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/reverse", origin: "vendor-docs" },
	right: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/right", origin: "vendor-docs" },
	round: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/round", origin: "vendor-docs" },
	row_number: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/row_number", origin: "vendor-docs" },
	rpad: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/rpad", origin: "vendor-docs" },
	rtrim: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/rtrim", origin: "vendor-docs" },
	rtrimmed_length: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/rtrimmed_length",
		origin: "vendor-docs",
	},
	search_ip: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/search_ip", origin: "vendor-docs" },
	second: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hour-minute-second",
		origin: "vendor-docs",
	},
	sha1: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sha1", origin: "vendor-docs" },
	sha1_binary: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sha1_binary", origin: "vendor-docs" },
	sha1_hex: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sha1", origin: "vendor-docs" },
	sha2: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sha2", origin: "vendor-docs" },
	sha2_binary: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sha2_binary", origin: "vendor-docs" },
	sha2_hex: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sha2", origin: "vendor-docs" },
	sign: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sign", origin: "vendor-docs" },
	sin: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sin", origin: "vendor-docs" },
	sinh: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sinh", origin: "vendor-docs" },
	skew: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/skew", origin: "vendor-docs" },
	soundex: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/soundex", origin: "vendor-docs" },
	space: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/space", origin: "vendor-docs" },
	split: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/split", origin: "vendor-docs" },
	split_part: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/split_part", origin: "vendor-docs" },
	split_to_table: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/split_to_table",
		origin: "vendor-docs",
	},
	st_area: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_area", origin: "vendor-docs" },
	st_asbinary: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_aswkb", origin: "vendor-docs" },
	st_asewkb: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_asewkb", origin: "vendor-docs" },
	st_asewkt: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_asewkt", origin: "vendor-docs" },
	st_asgeojson: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_asgeojson",
		origin: "vendor-docs",
	},
	st_astext: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_aswkt", origin: "vendor-docs" },
	st_aswkb: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_aswkb", origin: "vendor-docs" },
	st_aswkt: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_aswkt", origin: "vendor-docs" },
	st_azimuth: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_azimuth", origin: "vendor-docs" },
	st_buffer: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_buffer", origin: "vendor-docs" },
	st_centroid: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_centroid", origin: "vendor-docs" },
	st_collect: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_collect", origin: "vendor-docs" },
	st_contains: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_contains", origin: "vendor-docs" },
	st_coveredby: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_coveredby",
		origin: "vendor-docs",
	},
	st_covers: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_covers", origin: "vendor-docs" },
	st_difference: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_difference",
		origin: "vendor-docs",
	},
	st_dimension: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_dimension",
		origin: "vendor-docs",
	},
	st_disjoint: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_disjoint", origin: "vendor-docs" },
	st_distance: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_distance", origin: "vendor-docs" },
	st_dwithin: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_dwithin", origin: "vendor-docs" },
	st_endpoint: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_endpoint", origin: "vendor-docs" },
	st_envelope: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_envelope", origin: "vendor-docs" },
	st_geogfromewkb: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkb",
		origin: "vendor-docs",
	},
	st_geogfromewkt: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkt",
		origin: "vendor-docs",
	},
	st_geogfromgeohash: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geogfromgeohash",
		origin: "vendor-docs",
	},
	st_geogfromtext: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkt",
		origin: "vendor-docs",
	},
	st_geogfromwkb: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkb",
		origin: "vendor-docs",
	},
	st_geogfromwkt: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkt",
		origin: "vendor-docs",
	},
	st_geogpointfromgeohash: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geogpointfromgeohash",
		origin: "vendor-docs",
	},
	st_geographyfromewkb: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkb",
		origin: "vendor-docs",
	},
	st_geographyfromewkt: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkt",
		origin: "vendor-docs",
	},
	st_geographyfromtext: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkt",
		origin: "vendor-docs",
	},
	st_geographyfromwkb: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkb",
		origin: "vendor-docs",
	},
	st_geographyfromwkt: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkt",
		origin: "vendor-docs",
	},
	st_geohash: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geohash", origin: "vendor-docs" },
	st_geomfromgeohash: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geomfromgeohash",
		origin: "vendor-docs",
	},
	st_geompointfromgeohash: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geompointfromgeohash",
		origin: "vendor-docs",
	},
	st_hausdorffdistance: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_hausdorffdistance",
		origin: "vendor-docs",
	},
	st_interpolate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_interpolate",
		origin: "vendor-docs",
	},
	st_intersection: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_intersection",
		origin: "vendor-docs",
	},
	st_intersection_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_intersection_agg",
		origin: "vendor-docs",
	},
	st_intersects: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_intersects",
		origin: "vendor-docs",
	},
	st_isvalid: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_isvalid", origin: "vendor-docs" },
	st_length: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_length", origin: "vendor-docs" },
	st_makegeompoint: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_makegeompoint",
		origin: "vendor-docs",
	},
	st_makeline: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_makeline", origin: "vendor-docs" },
	st_makepoint: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_makepoint",
		origin: "vendor-docs",
	},
	st_makepolygon: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_makepolygon",
		origin: "vendor-docs",
	},
	st_makepolygonoriented: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_makepolygonoriented",
		origin: "vendor-docs",
	},
	st_npoints: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_npoints", origin: "vendor-docs" },
	st_perimeter: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_perimeter",
		origin: "vendor-docs",
	},
	st_pointn: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_pointn", origin: "vendor-docs" },
	st_setsrid: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_setsrid", origin: "vendor-docs" },
	st_simplify: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_simplify", origin: "vendor-docs" },
	st_srid: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_srid", origin: "vendor-docs" },
	st_startpoint: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_startpoint",
		origin: "vendor-docs",
	},
	st_symdifference: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_symdifference",
		origin: "vendor-docs",
	},
	st_union: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_union", origin: "vendor-docs" },
	st_union_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_union_agg",
		origin: "vendor-docs",
	},
	st_within: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_within", origin: "vendor-docs" },
	st_x: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_x", origin: "vendor-docs" },
	st_xmax: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_xmax", origin: "vendor-docs" },
	st_xmin: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_xmin", origin: "vendor-docs" },
	st_y: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_y", origin: "vendor-docs" },
	st_ymax: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_ymax", origin: "vendor-docs" },
	st_ymin: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_ymin", origin: "vendor-docs" },
	startswith: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/startswith", origin: "vendor-docs" },
	stddev_pop: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/stddev_pop", origin: "vendor-docs" },
	strip_null_value: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/strip_null_value",
		origin: "vendor-docs",
	},
	strtok_split_to_table: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/strtok_split_to_table",
		origin: "vendor-docs",
	},
	strtok_to_array: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/strtok_to_array",
		origin: "vendor-docs",
	},
	substr: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/substr", origin: "vendor-docs" },
	sum: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sum", origin: "vendor-docs" },
	sys_context: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sys_context", origin: "vendor-docs" },
	sysdate: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sysdate", origin: "vendor-docs" },
	systimestamp: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/systimestamp",
		origin: "vendor-docs",
	},
	tag_references: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/tag_references",
		origin: "vendor-docs",
	},
	tag_references_all_columns: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/tag_references_all_columns",
		origin: "vendor-docs",
	},
	tag_references_with_lineage: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/tag_references_with_lineage",
		origin: "vendor-docs",
	},
	tan: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/tan", origin: "vendor-docs" },
	tanh: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/tanh", origin: "vendor-docs" },
	time: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_time", origin: "vendor-docs" },
	time_from_parts: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/time_from_parts",
		origin: "vendor-docs",
	},
	time_slice: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/time_slice", origin: "vendor-docs" },
	timeadd: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/timeadd", origin: "vendor-docs" },
	timestamp_from_parts: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/timestamp_from_parts",
		origin: "vendor-docs",
	},
	timestamp_ltz_from_parts: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/timestamp_from_parts",
		origin: "vendor-docs",
	},
	timestamp_ntz_from_parts: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/timestamp_from_parts",
		origin: "vendor-docs",
	},
	timestampadd: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/timestampadd",
		origin: "vendor-docs",
	},
	timestampdiff: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/timestampdiff",
		origin: "vendor-docs",
	},
	timestampfunction: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_timestamp",
		origin: "vendor-docs",
	},
	to_array: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_array", origin: "vendor-docs" },
	to_binary: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_binary", origin: "vendor-docs" },
	to_boolean: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_boolean", origin: "vendor-docs" },
	to_char: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_char", origin: "vendor-docs" },
	to_date: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_date", origin: "vendor-docs" },
	to_decfloat: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_decfloat", origin: "vendor-docs" },
	to_double: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_double", origin: "vendor-docs" },
	to_geography: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_geography",
		origin: "vendor-docs",
	},
	to_json: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_json", origin: "vendor-docs" },
	to_object: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_object", origin: "vendor-docs" },
	to_time: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_time", origin: "vendor-docs" },
	to_timestamp: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_timestamp",
		origin: "vendor-docs",
	},
	to_uuid: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_uuid", origin: "vendor-docs" },
	to_varchar: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_char", origin: "vendor-docs" },
	to_variant: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_variant", origin: "vendor-docs" },
	to_xml: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_xml", origin: "vendor-docs" },
	transform: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/transform", origin: "vendor-docs" },
	translate: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/translate", origin: "vendor-docs" },
	trim: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/trim", origin: "vendor-docs" },
	trunc: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/trunc", origin: "vendor-docs" },
	truncate: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/trunc", origin: "vendor-docs" },
	try_base64_decode_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_base64_decode_binary",
		origin: "vendor-docs",
	},
	try_base64_decode_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_base64_decode_string",
		origin: "vendor-docs",
	},
	try_hex_decode_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_hex_decode_binary",
		origin: "vendor-docs",
	},
	try_hex_decode_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_hex_decode_string",
		origin: "vendor-docs",
	},
	try_parse_json: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_parse_json",
		origin: "vendor-docs",
	},
	try_to_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_binary",
		origin: "vendor-docs",
	},
	try_to_boolean: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_boolean",
		origin: "vendor-docs",
	},
	try_to_date: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_date", origin: "vendor-docs" },
	try_to_decfloat: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_decfloat",
		origin: "vendor-docs",
	},
	try_to_double: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_double",
		origin: "vendor-docs",
	},
	try_to_geography: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_geography",
		origin: "vendor-docs",
	},
	try_to_time: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_time", origin: "vendor-docs" },
	try_to_uuid: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_uuid", origin: "vendor-docs" },
	typeof: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/typeof", origin: "vendor-docs" },
	unicode: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/unicode", origin: "vendor-docs" },
	uniform: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/uniform", origin: "vendor-docs" },
	upper: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/upper", origin: "vendor-docs" },
	uuid_string: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/uuid_string", origin: "vendor-docs" },
	var_pop: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/var_pop", origin: "vendor-docs" },
	var_samp: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/var_samp", origin: "vendor-docs" },
	variance: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/variance", origin: "vendor-docs" },
	variance_pop: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/variance_pop",
		origin: "vendor-docs",
	},
	vector_avg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_avg", origin: "vendor-docs" },
	vector_cosine_similarity: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_cosine_similarity",
		origin: "vendor-docs",
	},
	vector_inner_product: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_inner_product",
		origin: "vendor-docs",
	},
	vector_l1_distance: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_l1_distance",
		origin: "vendor-docs",
	},
	vector_l2_distance: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_l2_distance",
		origin: "vendor-docs",
	},
	vector_max: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_max", origin: "vendor-docs" },
	vector_min: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_min", origin: "vendor-docs" },
	vector_normalize: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_normalize",
		origin: "vendor-docs",
	},
	vector_sum: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_sum", origin: "vendor-docs" },
	vector_truncate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_truncate",
		origin: "vendor-docs",
	},
	week: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year", origin: "vendor-docs" },
	weekofyear: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year", origin: "vendor-docs" },
	width_bucket: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/width_bucket",
		origin: "vendor-docs",
	},
	xmlget: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/xmlget", origin: "vendor-docs" },
	year: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year", origin: "vendor-docs" },
	yearofweek: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year", origin: "vendor-docs" },
	zeroifnull: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/zeroifnull", origin: "vendor-docs" },
	zipf: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/zipf", origin: "vendor-docs" },
};
