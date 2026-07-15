// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for snowflake (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-15. 542 names (435 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const SNOWFLAKE_FN_DOCS: Record<string, FnDoc> = {
	abs: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/abs",
		description: "Returns the absolute value of the argument.",
		origin: "authored",
	},
	accumulate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/accumulate",
		description:
			"Processes an input expression through initialization and accumulation lambda functions to compute an aggregate result.",
		origin: "authored",
	},
	acos: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/acos",
		description: "Returns the arc cosine (inverse cosine) of the input in radians.",
		origin: "authored",
	},
	acosh: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/acosh",
		description: "Returns the inverse hyperbolic cosine of the argument.",
		origin: "authored",
	},
	add_months: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/add_months",
		description: "Returns a date or timestamp advanced by the specified number of months.",
		origin: "authored",
	},
	agg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/agg", origin: "vendor-docs" },
	ai_agg: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_agg", origin: "vendor-docs" },
	ai_complete: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_complete", origin: "vendor-docs" },
	ai_count_tokens: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_count_tokens",
		description: "Returns the number of tokens required to encode the input text for a specified AI function.",
		origin: "authored",
	},
	ai_embed: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_embed",
		description: "Generates a vector embedding for the input using the specified AI model.",
		origin: "authored",
	},
	ai_extract: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_extract",
		description: "Extracts and structures data from text or files according to the specified response format.",
		origin: "authored",
	},
	ai_filter: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_filter", origin: "vendor-docs" },
	ai_multi_embed: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_multi_embed",
		origin: "vendor-docs",
	},
	ai_similarity: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_similarity",
		description: "Computes a similarity score between two inputs using vector embeddings.",
		origin: "authored",
	},
	ai_summarize_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_summarize_agg",
		origin: "vendor-docs",
	},
	ai_translate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ai_translate",
		description: "Translates text from one language to another.",
		origin: "authored",
	},
	all_user_names: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/all_user_names",
		origin: "vendor-docs",
	},
	any_value: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/any_value",
		description: "Returns an arbitrary value from the input group in an aggregation.",
		origin: "authored",
	},
	approx_count_distinct: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_count_distinct",
		description: "Returns an approximate count of distinct non-null values using the HyperLogLog algorithm.",
		origin: "authored",
	},
	approx_percentile: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_percentile",
		description: "Computes an approximate percentile of the input values using sketches.",
		origin: "authored",
	},
	approx_percentile_accumulate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_percentile_accumulate",
		description: "Initializes or accumulates sketch state for approximate percentile computation.",
		origin: "authored",
	},
	approx_percentile_combine: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_percentile_combine",
		description: "Combines multiple approximate percentile sketches into a single sketch.",
		origin: "authored",
	},
	approx_percentile_estimate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_percentile_estimate",
		description: "Computes a percentile estimate from an accumulated approximate percentile sketch.",
		origin: "authored",
	},
	approx_top_k: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_top_k",
		description: "Returns an approximate list of the k most frequent values with their occurrence counts.",
		origin: "authored",
	},
	approx_top_k_accumulate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_top_k_accumulate",
		description: "Accumulates state for tracking the most frequent values in a dataset.",
		origin: "authored",
	},
	approx_top_k_combine: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_top_k_combine",
		description: "Combines multiple approximate top-k sketches into a single sketch.",
		origin: "authored",
	},
	approx_top_k_estimate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approx_top_k_estimate",
		description:
			"Returns the approximate top-k most frequent values and their counts from accumulated sketch state.",
		origin: "authored",
	},
	approximate_jaccard_index: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approximate_jaccard_index",
		description: "Computes the approximate Jaccard similarity coefficient between sets.",
		origin: "authored",
	},
	approximate_similarity: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/approximate_similarity",
		origin: "vendor-docs",
	},
	array_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_agg",
		description: "Aggregates non-null values from a group into a single array.",
		origin: "authored",
	},
	array_append: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_append",
		description: "Appends a new element to the end of an array.",
		origin: "authored",
	},
	array_cat: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_cat",
		description: "Concatenates two arrays into a single array.",
		origin: "authored",
	},
	array_compact: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_compact",
		description: "Removes all null elements from an array.",
		origin: "authored",
	},
	array_contains: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_contains",
		description: "Returns true if the specified value is present in the array.",
		origin: "authored",
	},
	array_distinct: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_distinct",
		description: "Returns an array containing only the distinct elements from the input array.",
		origin: "authored",
	},
	array_except: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_except",
		description: "Returns elements from the first array that are not present in the second array.",
		origin: "authored",
	},
	array_flatten: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_flatten",
		description: "Flattens a nested array by removing one level of nesting.",
		origin: "authored",
	},
	array_generate_range: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_generate_range",
		description: "Generates an array of integers spanning from start to stop with an optional step value.",
		origin: "authored",
	},
	array_insert: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_insert",
		description: "Inserts a new element at the specified position in an array.",
		origin: "authored",
	},
	array_intersection: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_intersection",
		description: "Returns the elements that appear in both input arrays.",
		origin: "authored",
	},
	array_max: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_max",
		description: "Returns the largest element in an array.",
		origin: "authored",
	},
	array_min: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_min",
		description: "Returns the smallest element in an array.",
		origin: "authored",
	},
	array_position: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_position",
		description: "Returns the index of the first occurrence of a value in an array, or null if not found.",
		origin: "authored",
	},
	array_prepend: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_prepend",
		description: "Adds an element to the beginning of an array.",
		origin: "authored",
	},
	array_remove: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_remove",
		description: "Removes all occurrences of a value from an array.",
		origin: "authored",
	},
	array_remove_at: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_remove_at",
		description: "Removes the element at a specified index from an array.",
		origin: "authored",
	},
	array_repeat: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_repeat",
		description: "Creates an array by repeating an element a specified number of times.",
		origin: "authored",
	},
	array_reverse: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_reverse",
		description: "Returns a new array with elements in reverse order.",
		origin: "authored",
	},
	array_size: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_size",
		description: "Returns the number of elements in an array.",
		origin: "authored",
	},
	array_slice: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_slice",
		description: "Extracts a portion of an array between specified start and end indices.",
		origin: "authored",
	},
	array_sort: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_sort",
		description: "Returns an array sorted in ascending or descending order with configurable null placement.",
		origin: "authored",
	},
	array_to_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_to_string",
		description: "Joins array elements into a string separated by a specified delimiter.",
		origin: "authored",
	},
	array_union_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_union_agg",
		description: "Aggregate function that combines arrays from multiple rows into a single array.",
		origin: "authored",
	},
	array_unique_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/array_unique_agg",
		origin: "vendor-docs",
	},
	arrays_overlap: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/arrays_overlap",
		description: "Returns true if two arrays have at least one element in common.",
		origin: "authored",
	},
	arrays_to_object: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/arrays_to_object",
		description: "Combines a key array and value array into an object with keys mapped to values.",
		origin: "authored",
	},
	arrays_zip: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/arrays_zip", origin: "vendor-docs" },
	as_array: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_array",
		description: "Converts a variant value to an array type.",
		origin: "authored",
	},
	as_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_binary",
		description: "Converts a variant value to a binary type.",
		origin: "authored",
	},
	as_boolean: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_boolean",
		description: "Converts a variant value to a boolean type.",
		origin: "authored",
	},
	as_char: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_char-varchar",
		description: "Converts a variant value to a character type.",
		origin: "authored",
	},
	as_date: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_date",
		description: "Converts a variant value to a date type.",
		origin: "authored",
	},
	as_decimal: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_decimal-number",
		description: "Converts a variant value to a decimal type with optional precision and scale.",
		origin: "authored",
	},
	as_double: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_double-real",
		description: "Converts a variant value to a double-precision floating-point type.",
		origin: "authored",
	},
	as_integer: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_integer",
		description: "Converts a variant value to an integer type.",
		origin: "authored",
	},
	as_number: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_decimal-number",
		description: "Converts a variant value to a numeric type with optional precision and scale.",
		origin: "authored",
	},
	as_object: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_object",
		description: "Converts a variant value to an object type.",
		origin: "authored",
	},
	as_real: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_double-real", origin: "vendor-docs" },
	as_time: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_time",
		description: "Converts a variant value to a time type.",
		origin: "authored",
	},
	as_timestamp_ltz: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_timestamp",
		description: "Converts a variant value to a timestamp with local time zone.",
		origin: "authored",
	},
	as_timestamp_ntz: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_timestamp",
		description: "Converts a variant value to a timestamp without time zone.",
		origin: "authored",
	},
	as_timestamp_tz: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_timestamp",
		description: "Converts a variant value to a timestamp with time zone.",
		origin: "authored",
	},
	as_varchar: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/as_char-varchar",
		description: "Converts a variant value to a varchar (string) type.",
		origin: "authored",
	},
	ascii: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ascii",
		description: "Returns the ASCII numeric code of the first character in a string.",
		origin: "authored",
	},
	asin: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/asin",
		description: "Returns the inverse sine (arcsine) of a numeric value in radians.",
		origin: "authored",
	},
	asinh: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/asinh",
		description: "Returns the inverse hyperbolic sine of a numeric value.",
		origin: "authored",
	},
	atan: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/atan",
		description: "Returns the inverse tangent (arctangent) of a numeric value in radians.",
		origin: "authored",
	},
	atan2: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/atan2",
		description: "Returns the arctangent of two numeric arguments (y/x) in radians.",
		origin: "authored",
	},
	atanh: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/atanh",
		description: "Returns the inverse hyperbolic tangent of a numeric value.",
		origin: "authored",
	},
	avg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/avg",
		description: "Returns the average of numeric values in a group.",
		origin: "authored",
	},
	base64_decode_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/base64_decode_binary",
		description: "Decodes a base64-encoded string to binary data.",
		origin: "authored",
	},
	base64_decode_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/base64_decode_string",
		origin: "vendor-docs",
	},
	bind_values: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bind_values", origin: "vendor-docs" },
	bit_length: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bit_length",
		description: "Returns the number of bits in a string or binary value.",
		origin: "authored",
	},
	bitand: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitand", origin: "vendor-docs" },
	bitand_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitand_agg",
		description: "Aggregates bitwise AND across rows in a group.",
		origin: "authored",
	},
	bitmap_absolute_position: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_absolute_position",
		origin: "vendor-docs",
	},
	bitmap_and: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_and",
		description: "Returns the bitwise AND of two bitmap values.",
		origin: "authored",
	},
	bitmap_and_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_and_agg",
		description: "Aggregates bitwise AND of bitmap values across rows.",
		origin: "authored",
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
		description: "Constructs a bitmap from relative bit positions across rows.",
		origin: "authored",
	},
	bitmap_count: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_count",
		description: "Returns the count of set bits in a bitmap.",
		origin: "authored",
	},
	bitmap_or: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_or",
		description: "Returns the bitwise OR of two bitmap values.",
		origin: "authored",
	},
	bitmap_or_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_or_agg",
		description: "Aggregates bitwise OR of bitmap values across rows.",
		origin: "authored",
	},
	bitmap_to_array: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitmap_to_array",
		description: "Converts a bitmap to an array of set bit positions.",
		origin: "authored",
	},
	bitnot: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitnot", origin: "vendor-docs" },
	bitor: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitor", origin: "vendor-docs" },
	bitor_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitor_agg",
		description: "Aggregates bitwise OR across rows in a group.",
		origin: "authored",
	},
	bitshiftleft: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitshiftleft",
		description: "Shifts the bits of an expression left by n positions.",
		origin: "authored",
	},
	bitshiftright: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitshiftright",
		description: "Shifts the bits of an expression right by n positions.",
		origin: "authored",
	},
	bitxor: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitxor", origin: "vendor-docs" },
	bitxor_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/bitxor_agg",
		description: "Aggregates bitwise XOR across rows in a group.",
		origin: "authored",
	},
	booland: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/booland", origin: "vendor-docs" },
	booland_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/booland_agg",
		description: "Aggregates logical AND across boolean values in rows.",
		origin: "authored",
	},
	boolnot: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/boolnot", origin: "vendor-docs" },
	boolor: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/boolor", origin: "vendor-docs" },
	boolor_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/boolor_agg",
		description: "Aggregates logical OR across boolean values in rows.",
		origin: "authored",
	},
	boolxor: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/boolxor", origin: "vendor-docs" },
	boolxor_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/boolxor_agg",
		description: "Aggregates logical XOR across boolean values in rows.",
		origin: "authored",
	},
	cbrt: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/cbrt",
		description: "Returns the cube root of a number.",
		origin: "authored",
	},
	ceil: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ceil",
		description: "Rounds a number up to the nearest integer or specified decimal place.",
		origin: "authored",
	},
	charindex: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/charindex",
		description: "Returns the position of the first occurrence of a substring in a string.",
		origin: "authored",
	},
	check_json: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/check_json", origin: "vendor-docs" },
	check_xml: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/check_xml", origin: "vendor-docs" },
	chr: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/chr",
		description: "Returns the character corresponding to a numeric Unicode code point.",
		origin: "authored",
	},
	coalesce: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/coalesce",
		description: "Returns the first non-null argument from the list.",
		origin: "authored",
	},
	collate: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/collate", origin: "vendor-docs" },
	collation: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/collation", origin: "vendor-docs" },
	compress: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/compress",
		description: "Compresses data using the specified compression method.",
		origin: "authored",
	},
	concat: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/concat",
		description: "Concatenates two or more expressions into a single string.",
		origin: "authored",
	},
	concat_ws: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/concat_ws",
		description: "Concatenates multiple expressions into a single string with a specified separator between them.",
		origin: "authored",
	},
	conditional_change_event: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/conditional_change_event",
		origin: "vendor-docs",
	},
	conditional_true_event: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/conditional_true_event",
		origin: "vendor-docs",
	},
	contains: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/contains",
		description: "Returns true if the first expression contains the second expression as a substring.",
		origin: "authored",
	},
	convert_timezone: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/convert_timezone",
		description: "Converts a timestamp from one time zone to another.",
		origin: "authored",
	},
	cos: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/cos",
		description: "Returns the cosine of the input angle in radians.",
		origin: "authored",
	},
	cosh: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/cosh",
		description: "Returns the hyperbolic cosine of the input expression.",
		origin: "authored",
	},
	cot: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/cot",
		description: "Returns the cotangent of the input angle in radians.",
		origin: "authored",
	},
	count: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/count", origin: "vendor-docs" },
	count_if: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/count_if",
		description: "Returns the count of rows where the condition evaluates to true.",
		origin: "authored",
	},
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
		description: "Returns a variant array of all roles available to the current user.",
		origin: "authored",
	},
	current_client: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_client",
		origin: "vendor-docs",
	},
	current_database: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_database",
		description: "Returns the name of the current database.",
		origin: "authored",
	},
	current_date: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_date",
		description: "Returns the current date in the session time zone.",
		origin: "authored",
	},
	current_ip_address: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_ip_address",
		description: "Returns the IP address of the client connection.",
		origin: "authored",
	},
	current_organization_name: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_organization_name",
		description: "Returns the name of the current organization.",
		origin: "authored",
	},
	current_organization_user: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_organization_user",
		origin: "vendor-docs",
	},
	current_region: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_region",
		description: "Returns the cloud region where the current Snowflake account resides.",
		origin: "authored",
	},
	current_role: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_role",
		description: "Returns the name of the current role.",
		origin: "authored",
	},
	current_role_type: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_role_type",
		origin: "vendor-docs",
	},
	current_schema: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_schema",
		description: "Returns the name of the current schema.",
		origin: "authored",
	},
	current_schemas: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_schemas",
		description: "Returns a variant array representing the current schema search path.",
		origin: "authored",
	},
	current_secondary_roles: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_secondary_roles",
		description: "Returns a variant array of secondary roles enabled in the current session.",
		origin: "authored",
	},
	current_session: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_session",
		origin: "vendor-docs",
	},
	current_statement: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_statement",
		description: "Returns the text of the SQL statement currently being executed.",
		origin: "authored",
	},
	current_transaction: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_transaction",
		origin: "vendor-docs",
	},
	current_user: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_user",
		description: "Returns the login name of the current user.",
		origin: "authored",
	},
	current_version: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_version",
		description: "Returns the version of Snowflake.",
		origin: "authored",
	},
	current_warehouse: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/current_warehouse",
		description: "Returns the name of the current warehouse.",
		origin: "authored",
	},
	database_refresh_history: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/database_refresh_history",
		description: "Returns the history of refresh operations for a secondary database.",
		origin: "authored",
	},
	database_refresh_progress: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/database_refresh_progress",
		description: "Returns the progress of an ongoing refresh operation for a secondary database.",
		origin: "authored",
	},
	database_refresh_progress_by_job: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/database_refresh_progress",
		description: "Returns the refresh progress details for a specific job.",
		origin: "authored",
	},
	datasketches_hll: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/datasketches_hll",
		description: "Returns an approximate count of distinct values using the HyperLogLog algorithm.",
		origin: "authored",
	},
	datasketches_hll_accumulate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/datasketches_hll_accumulate",
		description: "Accumulates values into a HyperLogLog sketch state for cardinality estimation.",
		origin: "authored",
	},
	datasketches_hll_combine: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/datasketches_hll_combine",
		description: "Combines multiple HyperLogLog sketch states into a single aggregated state.",
		origin: "authored",
	},
	datasketches_hll_estimate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/datasketches_hll_estimate",
		description: "Returns the cardinality estimate from a HyperLogLog sketch state.",
		origin: "authored",
	},
	date: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_date",
		description: "Converts a value to a date from string, timestamp, integer, or variant.",
		origin: "authored",
	},
	date_from_parts: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/date_from_parts",
		description: "Constructs a date from year, month, and day components.",
		origin: "authored",
	},
	date_part: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/date_part",
		description: "Extracts a specified date or time part from a date, time, or timestamp.",
		origin: "authored",
	},
	date_trunc: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/date_trunc",
		description: "Truncates a date or timestamp to the nearest specified date or time part.",
		origin: "authored",
	},
	dateadd: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/dateadd",
		description: "Adds a specified number of date or time units to a date or timestamp.",
		origin: "authored",
	},
	datediff: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/datediff",
		description: "Calculates the difference in specified units between two dates or timestamps.",
		origin: "authored",
	},
	day: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year",
		description: "Extracts the day-of-month component from a date or timestamp.",
		origin: "authored",
	},
	dayname: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/dayname",
		description: "Returns the name of the day of the week for a date or timestamp.",
		origin: "authored",
	},
	dayofmonth: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year",
		description: "Returns the day of the month for a date or timestamp value.",
		origin: "authored",
	},
	decode: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/decode",
		description: "Evaluates an expression and returns a result matching the first search value that equals it.",
		origin: "authored",
	},
	decompress_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/decompress_binary",
		description: "Decompresses binary data using the specified compression method.",
		origin: "authored",
	},
	decompress_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/decompress_string",
		description: "Decompresses binary data as a string using the specified compression method.",
		origin: "authored",
	},
	degrees: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/degrees",
		description: "Converts a radian value to its equivalent in degrees.",
		origin: "authored",
	},
	dense_rank: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/dense_rank",
		description: "Assigns a dense rank (without gaps) to rows based on the ordering specification.",
		origin: "authored",
	},
	div0: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/div0",
		description: "Performs division and returns zero if the divisor is zero.",
		origin: "authored",
	},
	div0null: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/div0null",
		description: "Performs division and returns null if the divisor is zero.",
		origin: "authored",
	},
	dp_interval_high: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/dp_interval_high",
		description: "Returns the upper confidence bound for a differentially private aggregation.",
		origin: "authored",
	},
	dp_interval_low: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/dp_interval_low",
		description: "Returns the lower confidence bound for a differentially private aggregation.",
		origin: "authored",
	},
	editdistance: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/editdistance",
		description: "Calculates the edit distance (Levenshtein distance) between two strings.",
		origin: "authored",
	},
	endswith: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/endswith",
		description: "Tests whether the first expression ends with the string value in the second.",
		origin: "authored",
	},
	execute_ai_evaluation: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/execute_ai_evaluation",
		origin: "vendor-docs",
	},
	exp: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/exp",
		description: "Returns e (the mathematical constant) raised to the power of the input expression.",
		origin: "authored",
	},
	explain_json: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/explain_json",
		origin: "vendor-docs",
	},
	extract: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/extract",
		description: "Extracts a specified date or time part from a date, time interval, or timestamp.",
		origin: "authored",
	},
	extract_semantic_categories: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/extract_semantic_categories",
		origin: "vendor-docs",
	},
	factorial: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/factorial",
		description: "Computes the factorial of an integer expression.",
		origin: "authored",
	},
	filter: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/filter",
		description: "Returns a new array containing only elements matching the lambda filter condition.",
		origin: "authored",
	},
	first_value: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/first_value",
		description: "Returns the first value in a window frame, respecting the ordering specification.",
		origin: "authored",
	},
	floor: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/floor",
		description: "Rounds down a numeric value to the nearest integer or specified decimal scale.",
		origin: "authored",
	},
	generate_column_description: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/generate_column_description",
		origin: "vendor-docs",
	},
	generate_postgres_access_token_for_user: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/generate_postgres_access_token_for_user",
		description: "Generates a Postgres authentication token for a Snowflake Postgres service instance.",
		origin: "authored",
	},
	get: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/get",
		description: "Retrieves an element or field from an array, object, map, or variant value.",
		origin: "authored",
	},
	get_ignore_case: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/get_ignore_case",
		description: "Retrieves a field from an object or variant using case-insensitive matching.",
		origin: "authored",
	},
	get_path: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/get_path",
		description: "Retrieves a value at a specified path within a variant or structured column.",
		origin: "authored",
	},
	get_query_operator_stats: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/get_query_operator_stats",
		description: "Retrieves execution statistics for individual operators in a query plan.",
		origin: "authored",
	},
	getbit: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/getbit",
		description: "Returns the bit value (0 or 1) at a specified position in an integer.",
		origin: "authored",
	},
	getdate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/getdate",
		description: "Returns the current date and time as a timestamp with local time zone.",
		origin: "authored",
	},
	getvariable: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/getvariable",
		description: "Retrieves the value of a session or user-defined variable by name.",
		origin: "authored",
	},
	greatest: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/greatest",
		description: "Returns the greatest (maximum) value among the input expressions.",
		origin: "authored",
	},
	greatest_ignore_nulls: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/greatest_ignore_nulls",
		description: "Returns the greatest value among non-NULL input expressions.",
		origin: "authored",
	},
	h3_cell_to_boundary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_cell_to_boundary",
		description: "Returns a polygon geography representing the boundary of an H3 cell.",
		origin: "authored",
	},
	h3_cell_to_children: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_cell_to_children",
		description: "Returns an array of H3 cells that are children of the given cell at the target resolution.",
		origin: "authored",
	},
	h3_cell_to_children_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_cell_to_children_string",
		description: "Returns an array of H3 child cell IDs as strings at the target resolution.",
		origin: "authored",
	},
	h3_cell_to_parent: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_cell_to_parent",
		description: "Returns the H3 parent cell of the given cell at the target resolution.",
		origin: "authored",
	},
	h3_cell_to_point: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_cell_to_point",
		description: "Returns the center point of an H3 cell as a geography.",
		origin: "authored",
	},
	h3_compact_cells: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_compact_cells",
		origin: "vendor-docs",
	},
	h3_compact_cells_strings: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_compact_cells_strings",
		origin: "vendor-docs",
	},
	h3_coverage: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_coverage",
		description: "Returns an array of H3 cells that cover a geography at the specified resolution.",
		origin: "authored",
	},
	h3_coverage_strings: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_coverage_strings",
		description: "Returns an array of H3 cell ID strings that cover a geography at the specified resolution.",
		origin: "authored",
	},
	h3_get_resolution: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_get_resolution",
		description: "Returns the resolution level of an H3 cell (an integer from 0 to 15).",
		origin: "authored",
	},
	h3_grid_disk: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_grid_disk",
		description: "Returns an array of H3 cells within a grid distance of k from the given cell.",
		origin: "authored",
	},
	h3_grid_distance: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_grid_distance",
		description: "Returns the grid distance between two H3 cells as an integer.",
		origin: "authored",
	},
	h3_grid_path: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_grid_path",
		description: "Returns an array of H3 cells forming the shortest path between two cells.",
		origin: "authored",
	},
	h3_int_to_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_int_to_string",
		description: "Converts an integer H3 cell ID to its string representation.",
		origin: "authored",
	},
	h3_is_pentagon: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_is_pentagon",
		description: "Returns true if the H3 cell is a pentagon; false otherwise.",
		origin: "authored",
	},
	h3_is_valid_cell: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_is_valid_cell",
		description: "Returns true if the given value is a valid H3 cell ID; false otherwise.",
		origin: "authored",
	},
	h3_latlng_to_cell: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_latlng_to_cell",
		description: "Returns the H3 cell ID at the given resolution containing the latitude and longitude.",
		origin: "authored",
	},
	h3_latlng_to_cell_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_latlng_to_cell_string",
		description: "Returns the H3 cell ID as a string at the given resolution for the latitude and longitude.",
		origin: "authored",
	},
	h3_point_to_cell: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_point_to_cell",
		description: "Returns the H3 cell ID at the target resolution containing the given geography point.",
		origin: "authored",
	},
	h3_point_to_cell_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_point_to_cell_string",
		description: "Returns the H3 cell ID as a string at the target resolution containing the geography point.",
		origin: "authored",
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
		description: "Converts a string H3 cell ID to its integer representation.",
		origin: "authored",
	},
	h3_try_coverage: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_try_coverage",
		description: "Returns H3 cells covering a geography at the target resolution, or null if the operation fails.",
		origin: "authored",
	},
	h3_try_coverage_strings: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_try_coverage_strings",
		description: "Returns H3 cell ID strings covering a geography, or null if the operation fails.",
		origin: "authored",
	},
	h3_try_grid_distance: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_try_grid_distance",
		description: "Returns the grid distance between two H3 cells, or null if the operation fails.",
		origin: "authored",
	},
	h3_try_grid_path: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_try_grid_path",
		description: "Returns the shortest path of H3 cells between two cells, or null if the operation fails.",
		origin: "authored",
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
		description: "Returns an array of H3 cells at the target resolution by uncompacting a compacted set of cells.",
		origin: "authored",
	},
	h3_uncompact_cells_strings: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/h3_uncompact_cells_strings",
		description: "Returns an array of H3 cell ID strings at the target resolution by uncompacting compacted cells.",
		origin: "authored",
	},
	hash: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hash", origin: "vendor-docs" },
	hash_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hash_agg",
		description: "Aggregate function that computes a hash over all values in a group.",
		origin: "authored",
	},
	haversine: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/haversine", origin: "vendor-docs" },
	hex_decode_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hex_decode_binary",
		description: "Decodes a hexadecimal-encoded string to its binary representation.",
		origin: "authored",
	},
	hex_decode_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hex_decode_string",
		description: "Decodes a hexadecimal-encoded string to its original string value.",
		origin: "authored",
	},
	hex_encode: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hex_encode",
		description: "Encodes an input value to hexadecimal representation, optionally in uppercase or lowercase.",
		origin: "authored",
	},
	hll: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hll",
		description:
			"Computes HyperLogLog cardinality estimation for distinct count aggregation over one or more expressions.",
		origin: "authored",
	},
	hll_accumulate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hll_accumulate",
		description: "Accumulates values into a HyperLogLog state for cardinality estimation.",
		origin: "authored",
	},
	hll_combine: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hll_combine",
		description: "Combines multiple HyperLogLog states into a single state.",
		origin: "authored",
	},
	hll_estimate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hll_estimate",
		description: "Estimates the cardinality of a dataset from a HyperLogLog sketch state.",
		origin: "authored",
	},
	hll_export: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hll_export", origin: "vendor-docs" },
	hll_import: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hll_import", origin: "vendor-docs" },
	hour: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hour-minute-second",
		description: "Extracts the hour component from a time or timestamp expression.",
		origin: "authored",
	},
	iff: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/iff",
		description: "Returns one of two expressions based on a boolean condition.",
		origin: "authored",
	},
	ifnull: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ifnull",
		description: "Returns the first expression if not null, otherwise returns the second expression.",
		origin: "authored",
	},
	initcap: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/initcap",
		description: "Capitalizes the first letter of each word in a string.",
		origin: "authored",
	},
	insert: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/insert",
		description: "Inserts a substring into a string at a specified position, replacing a given length.",
		origin: "authored",
	},
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
		description: "Fills missing values using linear interpolation between surrounding non-null points.",
		origin: "authored",
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
		description: "Tests whether a specified application role is currently active in the session.",
		origin: "authored",
	},
	is_array: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_array",
		description: "Tests whether a variant value is an array type.",
		origin: "authored",
	},
	is_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_binary",
		description: "Tests whether a variant value is a binary type.",
		origin: "authored",
	},
	is_boolean: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_boolean",
		description: "Tests whether a variant value is a boolean type.",
		origin: "authored",
	},
	is_char: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_char-varchar",
		description: "Tests whether a variant value is a character type.",
		origin: "authored",
	},
	is_database_role_in_session: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_database_role_in_session",
		description: "Tests whether a specified database role is currently active in the session.",
		origin: "authored",
	},
	is_date: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_date-value",
		description: "Tests whether a variant value is a date type.",
		origin: "authored",
	},
	is_date_value: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_date-value",
		description: "Tests whether a variant value contains a valid date.",
		origin: "authored",
	},
	is_decimal: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_decimal",
		description: "Tests whether a variant value is a decimal type.",
		origin: "authored",
	},
	is_double: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_double-real",
		origin: "vendor-docs",
	},
	is_granted_to_invoker_role: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_granted_to_invoker_role",
		description: "Tests whether a privilege is granted to the current invoker's role.",
		origin: "authored",
	},
	is_instance_role_in_session: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_instance_role_in_session",
		origin: "vendor-docs",
	},
	is_integer: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_integer",
		description: "Tests whether a variant value is an integer type.",
		origin: "authored",
	},
	is_null_value: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_null_value",
		origin: "vendor-docs",
	},
	is_object: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_object",
		description: "Tests whether a variant value is an object type.",
		origin: "authored",
	},
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
		description: "Tests whether a specified organization user group is currently active in the session.",
		origin: "authored",
	},
	is_real: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_double-real", origin: "vendor-docs" },
	is_role_in_session: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_role_in_session",
		description: "Tests whether a specified role is currently active in the session.",
		origin: "authored",
	},
	is_time: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_time",
		description: "Tests whether a variant value is a time type.",
		origin: "authored",
	},
	is_timestamp_ltz: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_timestamp",
		description: "Tests whether a variant value is a local-timezone timestamp type.",
		origin: "authored",
	},
	is_timestamp_ntz: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_timestamp",
		description: "Tests whether a variant value is a timezone-agnostic timestamp type.",
		origin: "authored",
	},
	is_timestamp_tz: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_timestamp",
		description: "Tests whether a variant value is a timezone-aware timestamp type.",
		origin: "authored",
	},
	is_varchar: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/is_char-varchar",
		description: "Tests whether a variant value is a varchar type.",
		origin: "authored",
	},
	jarowinkler_similarity: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/jarowinkler_similarity",
		origin: "vendor-docs",
	},
	json_extract_path_text: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/json_extract_path_text",
		description: "Extracts a value from a JSON column at a specified path and returns it as text.",
		origin: "authored",
	},
	kurtosis: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/kurtosis", origin: "vendor-docs" },
	last_day: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/last_day", origin: "vendor-docs" },
	last_transaction: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/last_transaction",
		origin: "vendor-docs",
	},
	last_value: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/last_value",
		description: "Returns the value from the last row in the window frame.",
		origin: "authored",
	},
	least_ignore_nulls: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/least_ignore_nulls",
		description: "Returns the smallest value among the arguments, treating NULL values as absent.",
		origin: "authored",
	},
	left: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/left",
		description: "Returns the leftmost N characters from a string.",
		origin: "authored",
	},
	len: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/length",
		description: "Returns the number of characters in a string.",
		origin: "authored",
	},
	length: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/length",
		description: "Returns the number of characters in a string.",
		origin: "authored",
	},
	listagg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/listagg",
		description: "Concatenates strings from multiple rows into a single string separated by a delimiter.",
		origin: "authored",
	},
	ln: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ln",
		description: "Returns the natural logarithm of the argument.",
		origin: "authored",
	},
	localtime: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/localtime",
		description: "Returns the current time of day without time zone information.",
		origin: "authored",
	},
	log: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/log",
		description: "Returns the logarithm of the second argument with the first argument as the base.",
		origin: "authored",
	},
	lower: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/lower",
		description: "Converts a string to lowercase.",
		origin: "authored",
	},
	lpad: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/lpad",
		description: "Left-pads a string to a specified length by repeating a fill string.",
		origin: "authored",
	},
	ltrim: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ltrim",
		description: "Removes leading whitespace or specified characters from a string.",
		origin: "authored",
	},
	map_cat: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/map_cat",
		description:
			"Merges two maps into a single map, with keys from the second map overwriting the first if present.",
		origin: "authored",
	},
	map_contains_key: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/map_contains_key",
		description: "Returns true if the map contains the specified key.",
		origin: "authored",
	},
	map_entries: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/map_entries",
		description: "Returns an array of objects, each containing a key-value pair from the input map.",
		origin: "authored",
	},
	map_insert: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/map_insert", origin: "vendor-docs" },
	map_keys: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/map_keys",
		description: "Returns an array of all keys from the input map.",
		origin: "authored",
	},
	map_pick: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/map_pick",
		description: "Returns a new map containing only the specified keys from the source map.",
		origin: "authored",
	},
	map_size: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/map_size",
		description: "Returns the number of key-value pairs in a map.",
		origin: "authored",
	},
	max: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/max", origin: "vendor-docs" },
	max_by: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/max_by",
		description: "Returns the value from the first column corresponding to the maximum value in the second column.",
		origin: "authored",
	},
	md5: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/md5",
		description: "Returns the MD5 hash of the input as a hexadecimal string.",
		origin: "authored",
	},
	md5_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/md5_binary",
		description: "Returns the MD5 hash of the input as a binary value.",
		origin: "authored",
	},
	md5_hex: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/md5",
		description: "Returns the MD5 hash of the input as a hexadecimal string.",
		origin: "authored",
	},
	md5_number: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/md5_number", origin: "vendor-docs" },
	md5_number_lower64: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/md5_number_lower64",
		origin: "vendor-docs",
	},
	md5_number_upper64: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/md5_number_upper64",
		origin: "vendor-docs",
	},
	median: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/median",
		description: "Returns the median value (50th percentile) of the expression.",
		origin: "authored",
	},
	min: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/min", origin: "vendor-docs" },
	min_by: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/min_by",
		description: "Returns the value from the first column corresponding to the minimum value in the second column.",
		origin: "authored",
	},
	minhash_combine: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/minhash_combine",
		origin: "vendor-docs",
	},
	minute: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hour-minute-second",
		description: "Returns the minute component of a time or timestamp expression.",
		origin: "authored",
	},
	mod: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/mod",
		description: "Returns the remainder when the first argument is divided by the second argument.",
		origin: "authored",
	},
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
	month: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year",
		description: "Returns the month (1-12) of a date or timestamp expression.",
		origin: "authored",
	},
	monthname: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/monthname", origin: "vendor-docs" },
	months_between: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/months_between",
		description: "Returns the number of months between two date expressions.",
		origin: "authored",
	},
	next_day: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/next_day",
		description: "Returns the first date after the given date that matches the specified day of the week.",
		origin: "authored",
	},
	normal: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/normal", origin: "vendor-docs" },
	nth_value: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/nth_value",
		description: "Returns the nth value in an ordered window partition, or null if the nth row does not exist.",
		origin: "authored",
	},
	ntile: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ntile",
		description: "Divides rows into n approximately equal buckets and returns the bucket number for each row.",
		origin: "authored",
	},
	nullif: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/nullif",
		description: "Returns null if expr1 equals expr2, otherwise returns expr1.",
		origin: "authored",
	},
	nullifzero: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/nullifzero",
		description: "Returns null if the expression equals zero, otherwise returns the expression.",
		origin: "authored",
	},
	nvl: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/nvl",
		description: "Returns the first non-null argument, or null if all arguments are null.",
		origin: "authored",
	},
	nvl2: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/nvl2",
		description: "Returns expr2 if expr1 is not null, otherwise returns expr3.",
		origin: "authored",
	},
	object_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/object_agg",
		description: "Aggregates key-value pairs into a single object.",
		origin: "authored",
	},
	object_insert: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/object_insert",
		description: "Inserts or updates a key-value pair in an object.",
		origin: "authored",
	},
	object_keys: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/object_keys",
		description: "Returns an array of the keys in an object.",
		origin: "authored",
	},
	object_pick: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/object_pick",
		description: "Returns a new object containing only the specified keys from the input object.",
		origin: "authored",
	},
	octet_length: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/octet_length",
		description: "Returns the length in bytes of a string or binary value.",
		origin: "authored",
	},
	parse_ip: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/parse_ip", origin: "vendor-docs" },
	parse_json: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/parse_json",
		description: "Parses a JSON string and returns a variant object.",
		origin: "authored",
	},
	parse_xml: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/parse_xml",
		description: "Parses an XML string and returns an object representation.",
		origin: "authored",
	},
	percent_rank: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/percent_rank",
		description: "Returns the relative rank of a row as a decimal between 0 and 1 within its partition.",
		origin: "authored",
	},
	percentile_cont: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/percentile_cont",
		origin: "vendor-docs",
	},
	percentile_disc: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/percentile_disc",
		origin: "vendor-docs",
	},
	pi: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/pi",
		description: "Returns the mathematical constant pi (approximately 3.14159).",
		origin: "authored",
	},
	position: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/position",
		description: "Returns the position (1-based) of the first occurrence of expr1 in expr2, or 0 if not found.",
		origin: "authored",
	},
	power: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/pow",
		description: "Raises a numeric base to a numeric exponent.",
		origin: "authored",
	},
	previous_day: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/previous_day",
		description: "Returns the previous occurrence of a specified day of the week before the given date.",
		origin: "authored",
	},
	quarter: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year",
		description: "Returns the quarter (1-4) of a date or timestamp expression.",
		origin: "authored",
	},
	radians: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/radians",
		description: "Converts an angle from degrees to radians.",
		origin: "authored",
	},
	randstr: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/randstr", origin: "vendor-docs" },
	rank: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/rank",
		description: "Returns the rank of a row within a partition, with ties receiving the same rank.",
		origin: "authored",
	},
	ratio_to_report: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/ratio_to_report",
		description: "Returns the ratio of a value to the sum of all values in the partition.",
		origin: "authored",
	},
	reduce: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/reduce",
		description: "Reduces an array to a single value using a lambda accumulator function.",
		origin: "authored",
	},
	regexp_count: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regexp_count",
		description: "Returns the number of times a regular expression pattern matches in a string.",
		origin: "authored",
	},
	regexp_instr: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regexp_instr",
		description: "Returns the position where a regular expression pattern first matches in a string.",
		origin: "authored",
	},
	regexp_like: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regexp_like",
		description: "Returns true if a string matches a regular expression pattern, false otherwise.",
		origin: "authored",
	},
	regexp_replace: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regexp_replace",
		description: "Replaces all substrings matching a regular expression pattern with a replacement string.",
		origin: "authored",
	},
	regexp_substr: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regexp_substr",
		description: "Returns the substring of the first match of a regular expression pattern.",
		origin: "authored",
	},
	regexp_substr_all: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regexp_substr_all",
		description: "Returns all substrings matching a regular expression pattern as an array.",
		origin: "authored",
	},
	regr_valx: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regr_valx", origin: "vendor-docs" },
	regr_valy: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/regr_valy", origin: "vendor-docs" },
	repeat: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/repeat",
		description: "Returns a string consisting of the input repeated a specified number of times.",
		origin: "authored",
	},
	replace: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/replace",
		description: "Replaces all occurrences of a pattern in a subject string with a replacement string.",
		origin: "authored",
	},
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
	reverse: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/reverse",
		description: "Returns the input string with characters in reverse order.",
		origin: "authored",
	},
	right: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/right",
		description: "Returns the rightmost number of characters from a string.",
		origin: "authored",
	},
	round: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/round",
		description: "Rounds a number to the nearest value at the specified scale.",
		origin: "authored",
	},
	row_number: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/row_number",
		description: "Returns the sequential number of each row within a partition, starting from 1.",
		origin: "authored",
	},
	rpad: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/rpad",
		description: "Right-pads a string to a specified length using an optional padding string.",
		origin: "authored",
	},
	rtrim: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/rtrim",
		description: "Removes trailing characters (or whitespace if unspecified) from a string.",
		origin: "authored",
	},
	rtrimmed_length: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/rtrimmed_length",
		description: "Returns the length of a string after removing trailing whitespace.",
		origin: "authored",
	},
	search_ip: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/search_ip", origin: "vendor-docs" },
	second: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/hour-minute-second",
		description: "Extracts the seconds component from a time interval or timestamp.",
		origin: "authored",
	},
	sha1: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sha1",
		description: "Computes the SHA-1 cryptographic hash of a string and returns it as a string.",
		origin: "authored",
	},
	sha1_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sha1_binary",
		description: "Computes the SHA-1 cryptographic hash of input and returns the result as binary.",
		origin: "authored",
	},
	sha1_hex: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sha1",
		description: "Computes the SHA-1 cryptographic hash of a string and returns it as a hexadecimal string.",
		origin: "authored",
	},
	sha2: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sha2", origin: "vendor-docs" },
	sha2_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sha2_binary",
		description: "Computes the SHA-2 cryptographic hash of input and returns the result as binary data.",
		origin: "authored",
	},
	sha2_hex: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sha2",
		description: "Computes the SHA-2 cryptographic hash and returns it as a hexadecimal string.",
		origin: "authored",
	},
	sign: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sign",
		description: "Returns -1 if the argument is negative, 0 if zero, or 1 if positive.",
		origin: "authored",
	},
	sin: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sin",
		description: "Computes the sine of a number (angle in radians).",
		origin: "authored",
	},
	sinh: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sinh",
		description: "Computes the hyperbolic sine of a number.",
		origin: "authored",
	},
	skew: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/skew",
		description: "Computes the skewness of values in a group, measuring asymmetry of a distribution.",
		origin: "authored",
	},
	soundex: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/soundex",
		description: "Returns a four-character soundex code representing the phonetic value of a string.",
		origin: "authored",
	},
	space: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/space",
		description: "Returns a string consisting of N space characters.",
		origin: "authored",
	},
	split: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/split",
		description: "Splits a string by a separator and returns the results as an array.",
		origin: "authored",
	},
	split_part: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/split_part",
		description: "Splits a string by a delimiter and returns the specified part (1-indexed).",
		origin: "authored",
	},
	split_to_table: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/split_to_table",
		description: "Splits a string by a delimiter and returns the parts as rows in a table.",
		origin: "authored",
	},
	st_area: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_area", origin: "vendor-docs" },
	st_asbinary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_aswkb",
		description: "Converts a geography or geometry object to its binary (WKB) representation.",
		origin: "authored",
	},
	st_asewkb: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_asewkb",
		description: "Converts a geography or geometry object to extended well-known binary (EWKB) format.",
		origin: "authored",
	},
	st_asewkt: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_asewkt",
		description: "Converts a geography or geometry object to extended well-known text (EWKT) format.",
		origin: "authored",
	},
	st_asgeojson: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_asgeojson",
		description: "Converts a geography or geometry object to GeoJSON format.",
		origin: "authored",
	},
	st_astext: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_aswkt",
		description: "Converts a geography or geometry object to well-known text (WKT) format.",
		origin: "authored",
	},
	st_aswkb: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_aswkb",
		description: "Converts a geography or geometry object to well-known binary (WKB) format.",
		origin: "authored",
	},
	st_aswkt: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_aswkt",
		description: "Converts a geography or geometry object to well-known text (WKT) format.",
		origin: "authored",
	},
	st_azimuth: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_azimuth", origin: "vendor-docs" },
	st_buffer: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_buffer",
		description: "Creates a geometry that represents all points within a specified distance of the input geometry.",
		origin: "authored",
	},
	st_centroid: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_centroid",
		description: "Computes the centroid (geometric center) of a geography or geometry object.",
		origin: "authored",
	},
	st_collect: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_collect",
		description: "Combines multiple geography objects into a single multi-object collection.",
		origin: "authored",
	},
	st_contains: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_contains",
		description: "Tests whether the first geography spatially contains the second.",
		origin: "authored",
	},
	st_coveredby: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_coveredby",
		description: "Tests whether the first geography is completely covered by the second.",
		origin: "authored",
	},
	st_covers: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_covers",
		description: "Tests whether the first geography completely covers the second.",
		origin: "authored",
	},
	st_difference: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_difference",
		description: "Returns the set-theoretic difference between two geographies.",
		origin: "authored",
	},
	st_dimension: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_dimension",
		description: "Returns the topological dimension (0 for point, 1 for line, 2 for polygon) of a geography.",
		origin: "authored",
	},
	st_disjoint: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_disjoint",
		description: "Tests whether two geographies have no spatial overlap.",
		origin: "authored",
	},
	st_distance: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_distance", origin: "vendor-docs" },
	st_dwithin: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_dwithin",
		description: "Tests whether two geographies are within a specified distance in meters.",
		origin: "authored",
	},
	st_endpoint: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_endpoint",
		description: "Returns the last point of a line string geography.",
		origin: "authored",
	},
	st_envelope: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_envelope",
		description: "Returns the minimum bounding rectangle of a geography or geometry.",
		origin: "authored",
	},
	st_geogfromewkb: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkb",
		description: "Parses extended well-known binary format into a geography object.",
		origin: "authored",
	},
	st_geogfromewkt: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkt",
		description: "Parses extended well-known text format into a geography object.",
		origin: "authored",
	},
	st_geogfromgeohash: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geogfromgeohash",
		origin: "vendor-docs",
	},
	st_geogfromtext: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkt",
		description: "Parses well-known text format into a geography object.",
		origin: "authored",
	},
	st_geogfromwkb: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkb",
		description: "Parses well-known binary format into a geography object.",
		origin: "authored",
	},
	st_geogfromwkt: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkt",
		description: "Parses well-known text format into a geography object.",
		origin: "authored",
	},
	st_geogpointfromgeohash: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geogpointfromgeohash",
		description: "Decodes a geohash string into a point geography.",
		origin: "authored",
	},
	st_geographyfromewkb: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkb",
		description: "Parses extended well-known binary format into a geography object.",
		origin: "authored",
	},
	st_geographyfromewkt: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkt",
		description: "Parses extended well-known text format into a geography object.",
		origin: "authored",
	},
	st_geographyfromtext: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkt",
		origin: "vendor-docs",
	},
	st_geographyfromwkb: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkb",
		description: "Parses well-known binary format into a geography object.",
		origin: "authored",
	},
	st_geographyfromwkt: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geographyfromwkt",
		description: "Parses well-known text format into a geography object.",
		origin: "authored",
	},
	st_geohash: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geohash",
		description: "Encodes a geography or geometry into a geohash string representation.",
		origin: "authored",
	},
	st_geomfromgeohash: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geomfromgeohash",
		description: "Decodes a geohash string into a geometry object.",
		origin: "authored",
	},
	st_geompointfromgeohash: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_geompointfromgeohash",
		description: "Decodes a geohash string into a point geometry.",
		origin: "authored",
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
		description: "Returns the spatial intersection of two geographies.",
		origin: "authored",
	},
	st_intersection_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_intersection_agg",
		description: "Aggregates geographies by computing their spatial intersection.",
		origin: "authored",
	},
	st_intersects: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_intersects",
		description: "Tests whether two geographies have any spatial overlap.",
		origin: "authored",
	},
	st_isvalid: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_isvalid", origin: "vendor-docs" },
	st_length: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_length", origin: "vendor-docs" },
	st_makegeompoint: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_makegeompoint",
		description: "Creates a point geometry from longitude and latitude coordinates.",
		origin: "authored",
	},
	st_makeline: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_makeline",
		description: "Creates a line string from two geography or geometry objects.",
		origin: "authored",
	},
	st_makepoint: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_makepoint",
		description: "Creates a point geography from longitude and latitude coordinates.",
		origin: "authored",
	},
	st_makepolygon: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_makepolygon",
		origin: "vendor-docs",
	},
	st_makepolygonoriented: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_makepolygonoriented",
		origin: "vendor-docs",
	},
	st_npoints: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_npoints",
		description: "Returns the number of coordinate points in a geography or geometry.",
		origin: "authored",
	},
	st_perimeter: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_perimeter",
		description: "Returns the perimeter of a geography or geometry.",
		origin: "authored",
	},
	st_pointn: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_pointn",
		description: "Returns the Nth point from a geography or geometry curve.",
		origin: "authored",
	},
	st_setsrid: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_setsrid",
		description: "Assigns a spatial reference identifier to a geometry.",
		origin: "authored",
	},
	st_simplify: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_simplify",
		description: "Reduces vertices in a geography or geometry while preserving shape.",
		origin: "authored",
	},
	st_srid: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_srid",
		description: "Returns the spatial reference identifier of a geography or geometry.",
		origin: "authored",
	},
	st_startpoint: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_startpoint",
		description: "Returns the first point of a geography or geometry curve.",
		origin: "authored",
	},
	st_symdifference: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_symdifference",
		description: "Returns the symmetric difference between two geographies.",
		origin: "authored",
	},
	st_union: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_union",
		description: "Returns the union of two geographies combined into a single shape.",
		origin: "authored",
	},
	st_union_agg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_union_agg",
		description: "Aggregates multiple geography values into their combined union.",
		origin: "authored",
	},
	st_within: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_within",
		description: "Tests whether one geography or geometry is entirely within another.",
		origin: "authored",
	},
	st_x: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_x",
		description: "Returns the longitude coordinate of a geography or geometry point.",
		origin: "authored",
	},
	st_xmax: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_xmax",
		description: "Returns the maximum X coordinate of a geography or geometry bounding box.",
		origin: "authored",
	},
	st_xmin: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_xmin",
		description: "Returns the minimum X coordinate of a geography or geometry bounding box.",
		origin: "authored",
	},
	st_y: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_y",
		description: "Returns the latitude coordinate of a geography or geometry point.",
		origin: "authored",
	},
	st_ymax: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_ymax",
		description: "Returns the maximum Y coordinate of a geography or geometry bounding box.",
		origin: "authored",
	},
	st_ymin: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/st_ymin",
		description: "Returns the minimum Y coordinate of a geography or geometry bounding box.",
		origin: "authored",
	},
	startswith: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/startswith",
		description: "Tests whether a string begins with a specified substring.",
		origin: "authored",
	},
	stddev_pop: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/stddev_pop",
		description: "Returns the population standard deviation of numeric values.",
		origin: "authored",
	},
	strip_null_value: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/strip_null_value",
		origin: "vendor-docs",
	},
	strtok_split_to_table: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/strtok_split_to_table",
		description: "Splits a string by delimiters and returns results as table rows.",
		origin: "authored",
	},
	strtok_to_array: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/strtok_to_array",
		description: "Splits a string by delimiters and returns results as an array.",
		origin: "authored",
	},
	substr: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/substr",
		description: "Returns a substring starting at a specified position with optional length.",
		origin: "authored",
	},
	substring: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/substr",
		description: "Returns a substring starting at a specified position with optional length.",
		origin: "authored",
	},
	sum: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sum",
		description: "Returns the sum of numeric values.",
		origin: "authored",
	},
	sys_context: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sys_context",
		description: "Returns system context information by namespace and property.",
		origin: "authored",
	},
	sysdate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/sysdate",
		description: "Returns the current system date and time.",
		origin: "authored",
	},
	systimestamp: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/systimestamp",
		description: "Returns the current system timestamp with time zone information.",
		origin: "authored",
	},
	tag_references: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/tag_references",
		description: "Returns all tag references applied to a specified object.",
		origin: "authored",
	},
	tag_references_all_columns: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/tag_references_all_columns",
		description: "Returns all tag references for columns in a specified object.",
		origin: "authored",
	},
	tag_references_with_lineage: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/tag_references_with_lineage",
		origin: "vendor-docs",
	},
	tan: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/tan",
		description: "Returns the tangent of an angle in radians.",
		origin: "authored",
	},
	tanh: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/tanh",
		description: "Returns the hyperbolic tangent of a numeric value.",
		origin: "authored",
	},
	time: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_time",
		description: "Converts a string, timestamp, integer, or variant to time.",
		origin: "authored",
	},
	time_from_parts: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/time_from_parts",
		description: "Constructs a time value from hour, minute, second, and nanosecond parts.",
		origin: "authored",
	},
	time_slice: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/time_slice", origin: "vendor-docs" },
	timeadd: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/timeadd",
		description: "Adds or subtracts a time interval from a date or timestamp.",
		origin: "authored",
	},
	timestamp_from_parts: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/timestamp_from_parts",
		description: "Constructs a timestamp from date/time parts or a date and time.",
		origin: "authored",
	},
	timestamp_ltz_from_parts: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/timestamp_from_parts",
		description: "Constructs a local-time-zone timestamp from year, month, day, and time parts.",
		origin: "authored",
	},
	timestamp_ntz_from_parts: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/timestamp_from_parts",
		description: "Constructs a time-zone-naive timestamp from date/time parts.",
		origin: "authored",
	},
	timestampadd: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/timestampadd",
		description: "Adds a time interval to a timestamp.",
		origin: "authored",
	},
	timestampdiff: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/timestampdiff",
		description: "Returns the number of time intervals between two timestamps.",
		origin: "authored",
	},
	timestampfunction: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_timestamp",
		origin: "vendor-docs",
	},
	to_array: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_array",
		description: "Converts the expression to an array value.",
		origin: "authored",
	},
	to_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_binary",
		description: "Converts the expression to a binary value.",
		origin: "authored",
	},
	to_boolean: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_boolean",
		description: "Converts the expression to a boolean value.",
		origin: "authored",
	},
	to_char: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_char",
		description: "Converts the expression to a string in the specified format.",
		origin: "authored",
	},
	to_date: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_date",
		description: "Converts the expression to a date value.",
		origin: "authored",
	},
	to_decfloat: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_decfloat",
		description: "Converts the expression to a decimal floating-point value.",
		origin: "authored",
	},
	to_double: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_double",
		description: "Converts the expression to a double-precision floating-point value.",
		origin: "authored",
	},
	to_geography: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_geography",
		description: "Converts the expression to a geography object.",
		origin: "authored",
	},
	to_json: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_json",
		description: "Converts the expression to a JSON-formatted string.",
		origin: "authored",
	},
	to_object: { docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_object", origin: "vendor-docs" },
	to_time: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_time",
		description: "Converts the expression to a time value.",
		origin: "authored",
	},
	to_timestamp: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_timestamp",
		description: "Converts the expression to a timestamp value.",
		origin: "authored",
	},
	to_uuid: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_uuid",
		description: "Converts the string to a UUID value.",
		origin: "authored",
	},
	to_varchar: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_char",
		description: "Converts the expression to a string in the specified format.",
		origin: "authored",
	},
	to_variant: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_variant",
		description: "Converts the expression to a variant value.",
		origin: "authored",
	},
	to_xml: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/to_xml",
		description: "Converts the expression to an XML-formatted string.",
		origin: "authored",
	},
	transform: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/transform",
		description: "Applies a lambda expression to each element of an array and returns the transformed array.",
		origin: "authored",
	},
	translate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/translate",
		description: "Replaces characters in the source alphabet with characters from the target alphabet.",
		origin: "authored",
	},
	trim: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/trim",
		description: "Removes specified characters from the beginning and end of the string.",
		origin: "authored",
	},
	trunc: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/trunc",
		description: "Truncates a numeric value to the specified scale or a date/timestamp to the specified part.",
		origin: "authored",
	},
	truncate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/trunc",
		description: "Truncates a numeric value to the specified scale.",
		origin: "authored",
	},
	try_base64_decode_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_base64_decode_binary",
		description: "Decodes a base64-encoded string to binary, or returns null if decoding fails.",
		origin: "authored",
	},
	try_base64_decode_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_base64_decode_string",
		description: "Decodes a base64-encoded string to text, or returns null if decoding fails.",
		origin: "authored",
	},
	try_hex_decode_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_hex_decode_binary",
		description: "Decodes a hexadecimal-encoded string to binary, or returns null if decoding fails.",
		origin: "authored",
	},
	try_hex_decode_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_hex_decode_string",
		description: "Decodes a hexadecimal-encoded string to text, or returns null if decoding fails.",
		origin: "authored",
	},
	try_parse_json: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_parse_json",
		description: "Parses a JSON string, or returns null if parsing fails.",
		origin: "authored",
	},
	try_to_binary: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_binary",
		description: "Attempts to convert the string to binary, or returns null if conversion fails.",
		origin: "authored",
	},
	try_to_boolean: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_boolean",
		description: "Attempts to convert the string to boolean, or returns null if conversion fails.",
		origin: "authored",
	},
	try_to_date: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_date",
		description: "Attempts to convert to a date value, or returns null if conversion fails.",
		origin: "authored",
	},
	try_to_decfloat: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_decfloat",
		description: "Attempts to convert to a decimal floating-point value, or returns null if conversion fails.",
		origin: "authored",
	},
	try_to_double: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_double",
		description:
			"Attempts to convert to a double-precision floating-point value, or returns null if conversion fails.",
		origin: "authored",
	},
	try_to_geography: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_geography",
		description: "Attempts to convert to a geography object, or returns null if conversion fails.",
		origin: "authored",
	},
	try_to_time: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_time",
		description: "Attempts to convert to a time value, or returns null if conversion fails.",
		origin: "authored",
	},
	try_to_uuid: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/try_to_uuid",
		description: "Attempts to convert the string to a UUID, or returns null if conversion fails.",
		origin: "authored",
	},
	typeof: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/typeof",
		description: "Returns the type of the expression as a string.",
		origin: "authored",
	},
	unicode: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/unicode",
		description: "Returns the numeric Unicode code point of the first character.",
		origin: "authored",
	},
	uniform: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/uniform",
		description: "Returns a random value uniformly distributed between the minimum and maximum values.",
		origin: "authored",
	},
	upper: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/upper",
		description: "Converts the string to uppercase.",
		origin: "authored",
	},
	uuid_string: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/uuid_string",
		description: "Generates a UUID string, optionally deriving from an input UUID and name.",
		origin: "authored",
	},
	var_pop: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/var_pop",
		description: "Returns the population variance of the argument.",
		origin: "authored",
	},
	var_samp: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/var_samp",
		description: "Returns the sample variance of the argument.",
		origin: "authored",
	},
	variance: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/variance",
		description: "Returns the sample variance of the argument.",
		origin: "authored",
	},
	variance_pop: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/variance_pop",
		description: "Returns the population variance of the argument.",
		origin: "authored",
	},
	vector_avg: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_avg",
		description: "Returns the element-wise average of vectors in a column.",
		origin: "authored",
	},
	vector_cosine_similarity: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_cosine_similarity",
		description: "Returns the cosine similarity between two vectors.",
		origin: "authored",
	},
	vector_inner_product: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_inner_product",
		description: "Returns the inner product of two vectors.",
		origin: "authored",
	},
	vector_l1_distance: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_l1_distance",
		description: "Returns the L1 (Manhattan) distance between two vectors.",
		origin: "authored",
	},
	vector_l2_distance: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_l2_distance",
		description: "Returns the L2 (Euclidean) distance between two vectors.",
		origin: "authored",
	},
	vector_max: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_max",
		description: "Returns the element-wise maximum of vectors in a column.",
		origin: "authored",
	},
	vector_min: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_min",
		description: "Returns the element-wise minimum of vectors in a column.",
		origin: "authored",
	},
	vector_normalize: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_normalize",
		description: "Returns the L2-normalized vector.",
		origin: "authored",
	},
	vector_sum: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_sum",
		description: "Returns the element-wise sum of vectors in a column.",
		origin: "authored",
	},
	vector_truncate: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/vector_truncate",
		description: "Returns the vector truncated to the specified number of dimensions.",
		origin: "authored",
	},
	week: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year",
		description: "Returns the week number of the date or timestamp.",
		origin: "authored",
	},
	weekofyear: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year",
		description: "Returns the week number within the year.",
		origin: "authored",
	},
	width_bucket: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/width_bucket",
		description: "Returns the bucket number of a value within a range divided into buckets.",
		origin: "authored",
	},
	xmlget: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/xmlget",
		description: "Returns the XML element matching the specified tag name from an XML expression.",
		origin: "authored",
	},
	year: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year",
		description: "Returns the year component of a date or timestamp.",
		origin: "authored",
	},
	yearofweek: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/year",
		description: "Returns the year containing the specified week.",
		origin: "authored",
	},
	zeroifnull: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/zeroifnull",
		description: "Returns zero if the argument is null; otherwise returns the argument.",
		origin: "authored",
	},
	zipf: {
		docUrl: "https://docs.snowflake.com/en/sql-reference/functions/zipf",
		description: "Returns a random value sampled from a Zipf distribution.",
		origin: "authored",
	},
};
