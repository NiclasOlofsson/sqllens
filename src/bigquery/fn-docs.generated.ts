// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for bigquery (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-15. 342 names (334 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const BIGQUERY_FN_DOCS: Record<string, FnDoc> = {
	abs: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#abs",
		description: "Computes absolute value.",
		origin: "vendor-docs",
	},
	acos: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#acos",
		description: "Computes the principal value of the inverse cosine of X.",
		origin: "vendor-docs",
	},
	acosh: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#acosh",
		description: "Computes the inverse hyperbolic cosine of X.",
		origin: "vendor-docs",
	},
	add_months: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/datetime_functions",
		description: "Adds a specified number of months to a `DATETIME` value.",
		origin: "vendor-docs",
	},
	agg: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/aggregate_functions",
		description: "Aggregates a [measure type][measure-type].",
		origin: "vendor-docs",
	},
	array_agg: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/aggregate_functions#array_agg",
		description: "Returns an ARRAY of `expression` values.",
		origin: "vendor-docs",
	},
	array_avg: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Returns the average of non-`NULL` values in an array.",
		origin: "vendor-docs",
	},
	array_concat: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Concatenates one or more arrays with the same element type into a single array.",
		origin: "vendor-docs",
	},
	array_filter: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Takes an array, filters out unwanted elements, and returns the results in a new array.",
		origin: "vendor-docs",
	},
	array_first: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Takes an array and returns the first element in the array.",
		origin: "vendor-docs",
	},
	array_includes: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description:
			"Takes an array and returns `TRUE` if there is an element in the array that is equal to the search_value.",
		origin: "vendor-docs",
	},
	array_includes_all: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Takes an array to search and an array of search values.",
		origin: "vendor-docs",
	},
	array_includes_any: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Takes an array to search and an array of search values.",
		origin: "vendor-docs",
	},
	array_is_distinct: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description:
			"Returns `TRUE` if the array contains no repeated elements, using the same equality comparison logic as `SELECT DISTINCT`.",
		origin: "vendor-docs",
	},
	array_last: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Takes an array and returns the last element in the array.",
		origin: "vendor-docs",
	},
	array_length: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Returns the size of the array.",
		origin: "vendor-docs",
	},
	array_max: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Returns the maximum non-`NULL` value in an array.",
		origin: "vendor-docs",
	},
	array_min: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Returns the minimum non-`NULL` value in an array.",
		origin: "vendor-docs",
	},
	array_reverse: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Returns the input `ARRAY` with elements in reverse order.",
		origin: "vendor-docs",
	},
	array_slice: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Returns an array containing zero or more consecutive elements from the input array.",
		origin: "vendor-docs",
	},
	array_sum: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Returns the sum of non-`NULL` values in an array.",
		origin: "vendor-docs",
	},
	array_to_string: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Returns a concatenation of the elements in `array_expression` as a `STRING` or `BYTES` value.",
		origin: "vendor-docs",
	},
	array_transform: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Takes an array, transforms the elements, and returns the results in a new array.",
		origin: "vendor-docs",
	},
	ascii: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Returns the ASCII code for the first character or byte in `value`.",
		origin: "vendor-docs",
	},
	asin: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#asin",
		description: "Computes the principal value of the inverse sine of X.",
		origin: "vendor-docs",
	},
	asinh: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#asinh",
		description: "Computes the inverse hyperbolic sine of X.",
		origin: "vendor-docs",
	},
	atan: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#atan",
		description: "Computes the principal value of the inverse tangent of X.",
		origin: "vendor-docs",
	},
	atan2: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#atan2",
		description:
			"Calculates the principal value of the inverse tangent of X/Y using the signs of the two arguments to determine the quadrant.",
		origin: "vendor-docs",
	},
	atanh: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#atanh",
		description: "Computes the inverse hyperbolic tangent of X.",
		origin: "vendor-docs",
	},
	avg: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/aggregate_functions#avg",
		description: "Returns the average of non-`NULL` values in an aggregated group.",
		origin: "vendor-docs",
	},
	bit_cast_to_int32: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/bit_functions",
		description: "GoogleSQL supports bit casting to `INT32`.",
		origin: "vendor-docs",
	},
	bit_cast_to_int64: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/bit_functions",
		description: "GoogleSQL supports bit casting to `INT64`.",
		origin: "vendor-docs",
	},
	bit_cast_to_uint32: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/bit_functions",
		description: "GoogleSQL supports bit casting to `UINT32`.",
		origin: "vendor-docs",
	},
	bit_cast_to_uint64: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/bit_functions",
		description: "GoogleSQL supports bit casting to `UINT64`.",
		origin: "vendor-docs",
	},
	bit_count: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/bit_functions",
		description: "The input, `expression`, must be an integer or `BYTES`.",
		origin: "vendor-docs",
	},
	bool: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#bool_for_json",
		description: "Converts a JSON boolean to a SQL `BOOL` value.",
		origin: "vendor-docs",
	},
	bool_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#bool_array_for_json",
		description: "Converts a JSON array of booleans to a SQL `ARRAY<BOOL>` value.",
		origin: "vendor-docs",
	},
	byte_length: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"Gets the number of `BYTES` in a `STRING` or `BYTES` value, regardless of whether the value is a `STRING` or `BYTES` type.",
		origin: "vendor-docs",
	},
	cast: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/conversion_functions#cast",
		description:
			"Cast syntax is used in a query to indicate that the result type of an expression should be converted to some other type.",
		origin: "vendor-docs",
	},
	cbrt: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#cbrt",
		description: "Computes the cube root of `X`.",
		origin: "vendor-docs",
	},
	ceil: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#ceil",
		description: "Returns the smallest integral value that isn't less than X.",
		origin: "vendor-docs",
	},
	ceiling: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#ceiling",
		description: "Synonym of CEIL(X)",
		origin: "vendor-docs",
	},
	char_length: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Gets the number of characters in a `STRING` value.",
		origin: "vendor-docs",
	},
	character_length: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Synonym for [CHAR_LENGTH][string-link-to-char-length].",
		origin: "vendor-docs",
	},
	chr: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"Takes a Unicode [code point][string-link-to-code-points-wikipedia] and returns the character that matches the code point.",
		origin: "vendor-docs",
	},
	coalesce: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/conditional_expressions#coalesce",
		description: "Returns the value of the first non-`NULL` expression, if any, otherwise `NULL`.",
		origin: "vendor-docs",
	},
	code_points_to_bytes: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"Takes an array of extended ASCII [code points][string-link-to-code-points-wikipedia] as `ARRAY<INT64>` and returns `BYTES`.",
		origin: "vendor-docs",
	},
	code_points_to_string: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"Takes an array of Unicode [code points][string-link-to-code-points-wikipedia] as `ARRAY<INT64>` and returns a `STRING`.",
		origin: "vendor-docs",
	},
	collate: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		origin: "vendor-docs",
	},
	concat: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Concatenates one or more values into a single result.",
		origin: "vendor-docs",
	},
	cos: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#cos",
		description: "Computes the cosine of X where X is specified in radians.",
		origin: "vendor-docs",
	},
	cosh: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#cosh",
		description: "Computes the hyperbolic cosine of X where X is specified in radians.",
		origin: "vendor-docs",
	},
	cosine_distance: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#cosine_distance",
		description: "Computes the [cosine distance][wiki-cosine-distance] between two vectors.",
		origin: "vendor-docs",
	},
	cot: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#cot",
		description: "Computes the cotangent for the angle of `X`, where `X` is specified in radians.",
		origin: "vendor-docs",
	},
	coth: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#coth",
		description: "Computes the hyperbolic cotangent for the angle of `X`, where `X` is specified in radians.",
		origin: "vendor-docs",
	},
	count: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/aggregate_functions#count",
		description:
			"Gets the number of rows in the input or the number of rows with an expression evaluated to any value other than `NULL`.",
		origin: "vendor-docs",
	},
	csc: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#csc",
		description: "Computes the cosecant of the input angle, which is in radians.",
		origin: "vendor-docs",
	},
	csch: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#csch",
		description: "Computes the hyperbolic cosecant of the input angle, which is in radians.",
		origin: "vendor-docs",
	},
	cume_dist: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/numbering_functions",
		description: "Return the relative rank of a row defined as NP/NR.",
		origin: "vendor-docs",
	},
	current_date: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/date_functions",
		description: "Returns the current date as a `DATE` object.",
		origin: "vendor-docs",
	},
	current_timestamp: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description: "Returns the current date and time as a timestamp object.",
		origin: "vendor-docs",
	},
	date: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/date_functions",
		description: "Constructs or extracts a date.",
		origin: "vendor-docs",
	},
	date_bucket: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/time-series-functions",
		description: "Gets the lower bound of the date bucket that contains a date.",
		origin: "vendor-docs",
	},
	date_diff: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/date_functions",
		description:
			"Gets the number of unit boundaries between two `DATE` values (`end_date` - `start_date`) at a particular time granularity.",
		origin: "vendor-docs",
	},
	date_from_unix_date: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/date_functions",
		description: "Interprets `int64_expression` as the number of days since 1970-01-01.",
		origin: "vendor-docs",
	},
	date_trunc: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/date_functions",
		description: "Truncates a `DATE`, `DATETIME`, or `TIMESTAMP` value at a particular granularity.",
		origin: "vendor-docs",
	},
	datetime_bucket: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/time-series-functions",
		description: "Gets the lower bound of the datetime bucket that contains a datetime.",
		origin: "vendor-docs",
	},
	datetime_diff: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/datetime_functions",
		description:
			"Gets the number of unit boundaries between two `DATETIME` values (`end_datetime` - `start_datetime`) at a particular time granularity.",
		origin: "vendor-docs",
	},
	datetime_trunc: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/datetime_functions",
		description: "Truncates a `DATETIME` or `TIMESTAMP` value at a particular granularity.",
		origin: "vendor-docs",
	},
	dense_rank: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/numbering_functions",
		description: "Returns the ordinal (1-based) rank of each row within the window partition.",
		origin: "vendor-docs",
	},
	destination_node_id: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description: "Gets a unique identifier of a graph edge's destination node.",
		origin: "vendor-docs",
	},
	div: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#div",
		description: "Returns the result of integer division of X by Y.",
		origin: "vendor-docs",
	},
	edges: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description: "Gets the edges in a graph path.",
		origin: "vendor-docs",
	},
	element_definition_name: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description: "Returns the name of the graph element table underlying the graph element.",
		origin: "vendor-docs",
	},
	element_id: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description: "Gets a graph element's unique identifier.",
		origin: "vendor-docs",
	},
	ends_with: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Takes two `STRING` or `BYTES` values.",
		origin: "vendor-docs",
	},
	enum_value_descriptor_proto: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/protocol_buffer_functions",
		description: "Gets the enum value descriptor proto (`proto2.EnumValueDescriptorProto`) for an enum.",
		origin: "vendor-docs",
	},
	error: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/debugging_functions",
		description: "Returns an error.",
		origin: "vendor-docs",
	},
	euclidean_distance: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#euclidean_distance",
		description: "Computes the [Euclidean distance][wiki-euclidean-distance] between two vectors.",
		origin: "vendor-docs",
	},
	exp: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#exp",
		description: "Computes *e* to the power of X, also called the natural exponential function.",
		origin: "vendor-docs",
	},
	farm_fingerprint: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/hash_functions",
		description:
			"Computes the fingerprint of the `STRING` or `BYTES` input using the `Fingerprint64` function from the [open-source FarmHash library][hash-link-to-farmhash-github].",
		origin: "vendor-docs",
	},
	flatten: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description:
			"Takes an array of nested data and flattens a specific part of it into a single, flat array with the [array elements field access operator][array-el-field-operator].",
		origin: "vendor-docs",
	},
	floor: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#floor",
		description: "Returns the largest integral value that isn't greater than X.",
		origin: "vendor-docs",
	},
	format: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "`FORMAT` formats a data type expression as a string.",
		origin: "vendor-docs",
	},
	format_date: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/date_functions",
		description: "Formats a `DATE` value according to a specified format string.",
		origin: "vendor-docs",
	},
	format_datetime: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/datetime_functions",
		description: "Formats a `DATETIME` value according to a specified format string.",
		origin: "vendor-docs",
	},
	format_time: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/time_functions",
		description: "Formats a `TIME` value according to the specified format string.",
		origin: "vendor-docs",
	},
	format_timestamp: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description: "Formats a `TIMESTAMP` value according to the specified format string.",
		origin: "vendor-docs",
	},
	from_base32: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Converts the base32-encoded input `string_expr` into `BYTES` format.",
		origin: "vendor-docs",
	},
	from_base64: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Converts the base64-encoded input `string_expr` into `BYTES` format.",
		origin: "vendor-docs",
	},
	from_hex: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Converts a hexadecimal-encoded `STRING` into `BYTES` format.",
		origin: "vendor-docs",
	},
	from_proto: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/protocol_buffer_functions",
		description: "Returns a GoogleSQL value.",
		origin: "vendor-docs",
	},
	generate_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/array_functions",
		description: "Returns an array of values.",
		origin: "vendor-docs",
	},
	generate_range_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/range-functions",
		description: "Splits a range into an array of subranges.",
		origin: "vendor-docs",
	},
	grouping: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/aggregate_functions",
		description:
			"If a groupable item in the [`GROUP BY` clause][group-by-clause] is aggregated (and thus not grouped), this function returns `1`.",
		origin: "vendor-docs",
	},
	ieee_divide: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#ieee_divide",
		description: "Divides X by Y; this function never fails.",
		origin: "vendor-docs",
	},
	if: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/conditional_expressions#if",
		description:
			"If `expr` evaluates to `TRUE`, returns `true_result`, else returns the evaluation for `else_result`.",
		origin: "vendor-docs",
	},
	iferror: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/debugging_functions",
		description: "Evaluates `try_expression`.",
		origin: "vendor-docs",
	},
	ifnull: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/conditional_expressions#ifnull",
		description: "If `expr` evaluates to `NULL`, returns `null_result`.",
		origin: "vendor-docs",
	},
	initcap: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"Takes a `STRING` and returns it with the first character in each word in uppercase and all other characters in lowercase.",
		origin: "vendor-docs",
	},
	instr: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Returns the lowest 1-based position of `subvalue` in `value`.",
		origin: "vendor-docs",
	},
	int32: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#int32_for_json",
		description: "Converts a JSON number to a SQL `INT32` value.",
		origin: "vendor-docs",
	},
	int32_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#int32_array_for_json",
		description: "Converts a JSON number to a SQL `INT32_ARRAY` value.",
		origin: "vendor-docs",
	},
	int64: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#int64_for_json",
		description: "Converts a JSON number to a SQL `INT64` value.",
		origin: "vendor-docs",
	},
	int64_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#int64_array_for_json",
		description: "Converts a JSON array of numbers to a SQL `INT64_ARRAY` value.",
		origin: "vendor-docs",
	},
	is_acyclic: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description: "Checks if a graph path has a repeating node.",
		origin: "vendor-docs",
	},
	is_first: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/numbering_functions",
		description:
			"Returns `true` if the current row is in the first `k` rows (1-based) in the window; otherwise, returns `false`.",
		origin: "vendor-docs",
	},
	is_inf: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#is_inf",
		description: "Returns `TRUE` if the value is positive or negative infinity.",
		origin: "vendor-docs",
	},
	is_last: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/numbering_functions",
		description:
			"Returns `true` if the current row is in the last `k` rows (1-based) in the window; otherwise, returns `false`.",
		origin: "vendor-docs",
	},
	is_nan: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#is_nan",
		description: "Returns `TRUE` if the value is a `NaN` value.",
		origin: "vendor-docs",
	},
	is_simple: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description: "Checks if a graph path is simple.",
		origin: "vendor-docs",
	},
	is_trail: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description: "Checks if a graph path has a repeating edge.",
		origin: "vendor-docs",
	},
	iserror: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/debugging_functions",
		description: "Evaluates `try_expression`.",
		origin: "vendor-docs",
	},
	json_contains: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_contains",
		description: "Checks if a JSON document contains another JSON document.",
		origin: "vendor-docs",
	},
	json_extract: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_extract",
		description: "Extracts a JSON value and converts it to a SQL JSON-formatted `STRING` or `JSON` value.",
		origin: "vendor-docs",
	},
	json_extract_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_extract_array",
		description:
			"Extracts a JSON array and converts it to a SQL `ARRAY<JSON-formatted STRING>` or `ARRAY<JSON>` value.",
		origin: "vendor-docs",
	},
	json_extract_scalar: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_extract_scalar",
		description: "Extracts a JSON scalar value and converts it to a SQL `STRING` value.",
		origin: "vendor-docs",
	},
	json_extract_string_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_extract_string_array",
		description: "Extracts a JSON array of scalar values and converts it to a SQL `ARRAY<STRING>` value.",
		origin: "vendor-docs",
	},
	json_flatten: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_flatten",
		description:
			"Produces a new SQL `ARRAY<JSON>` value containing all non-array values that are either directly in the input JSON value or children of one or more consecutively nested arrays in the input JSON value.",
		origin: "vendor-docs",
	},
	json_object: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_object",
		description: "Creates a JSON object, using key-value pairs.",
		origin: "vendor-docs",
	},
	json_query: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_query",
		description: "Extracts a JSON value and converts it to a SQL JSON-formatted `STRING` or `JSON` value.",
		origin: "vendor-docs",
	},
	json_query_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_query_array",
		description:
			"Extracts a JSON array and converts it to a SQL `ARRAY<JSON-formatted STRING>` or `ARRAY<JSON>` value.",
		origin: "vendor-docs",
	},
	json_remove: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_remove",
		origin: "vendor-docs",
	},
	json_type: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_type",
		description:
			"Gets the JSON type of the outermost JSON value and converts the name of this type to a SQL `STRING` value.",
		origin: "vendor-docs",
	},
	json_value: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_value",
		description: "Extracts a JSON scalar value and converts it to a SQL `STRING` value.",
		origin: "vendor-docs",
	},
	json_value_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_value_array",
		description: "Extracts a JSON array of scalar values and converts it to a SQL `ARRAY<STRING>` value.",
		origin: "vendor-docs",
	},
	justify_days: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/interval_functions",
		description:
			"Normalizes the day part of the interval to the range from -29 to 29 by incrementing/decrementing the month or year part of the interval.",
		origin: "vendor-docs",
	},
	justify_hours: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/interval_functions",
		description:
			"Normalizes the time part of the interval to the range from -23:59:59.999999 to 23:59:59.999999 by incrementing/decrementing the day part of the interval.",
		origin: "vendor-docs",
	},
	justify_interval: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/interval_functions",
		description: "Normalizes the days and time parts of the interval.",
		origin: "vendor-docs",
	},
	labels: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description: "Gets the labels associated with a graph element and preserves the original case of each label.",
		origin: "vendor-docs",
	},
	lag: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/navigation_functions",
		description: "Returns the value of the `value_expression` on a preceding row.",
		origin: "vendor-docs",
	},
	last_day: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/datetime_functions",
		description: "Returns the last day from a datetime expression that contains the date.",
		origin: "vendor-docs",
	},
	lax_bool: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_bool",
		description: "Attempts to convert a JSON value to a SQL `BOOL` value.",
		origin: "vendor-docs",
	},
	lax_bool_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_bool_array",
		description: "Attempts to convert a JSON value to a SQL `ARRAY<BOOL>` value.",
		origin: "vendor-docs",
	},
	lax_double: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_double",
		description: "Attempts to convert a JSON value to a SQL `DOUBLE` value.",
		origin: "vendor-docs",
	},
	lax_double_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_double_array",
		description: "Attempts to convert a JSON value to a SQL `ARRAY<DOUBLE>` value.",
		origin: "vendor-docs",
	},
	lax_float: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_float",
		description: "Attempts to convert a JSON value to a SQL `FLOAT` value.",
		origin: "vendor-docs",
	},
	lax_float_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_float_array",
		description: "Attempts to convert a JSON value to a SQL `ARRAY<FLOAT>` value.",
		origin: "vendor-docs",
	},
	lax_int32: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_int32",
		description: "Attempts to convert a JSON value to a SQL `INT32` value.",
		origin: "vendor-docs",
	},
	lax_int32_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_int32_array",
		description: "Attempts to convert a JSON value to a SQL `ARRAY<INT32>` value.",
		origin: "vendor-docs",
	},
	lax_int64: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_int64",
		description: "Attempts to convert a JSON value to a SQL `INT64` value.",
		origin: "vendor-docs",
	},
	lax_int64_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_int64_array",
		description: "Attempts to convert a JSON value to a SQL `ARRAY<INT64>` value.",
		origin: "vendor-docs",
	},
	lax_string: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_string",
		description: "Attempts to convert a JSON value to a SQL `STRING` value.",
		origin: "vendor-docs",
	},
	lax_string_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_string_array",
		description: "Attempts to convert a JSON value to a SQL `ARRAY<STRING>` value.",
		origin: "vendor-docs",
	},
	lax_uint32: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_uint32",
		description: "Attempts to convert a JSON value to a SQL `UINT32` value.",
		origin: "vendor-docs",
	},
	lax_uint32_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_uint32_array",
		description: "Attempts to convert a JSON value to a SQL `ARRAY<UINT32>` value.",
		origin: "vendor-docs",
	},
	lax_uint64: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_uint64",
		description: "Attempts to convert a JSON value to a SQL `UINT64` value.",
		origin: "vendor-docs",
	},
	lax_uint64_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#lax_uint64_array",
		description: "Attempts to convert a JSON value to a SQL `ARRAY<UINT64>` value.",
		origin: "vendor-docs",
	},
	lead: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/navigation_functions",
		description: "Returns the value of the `value_expression` on a subsequent row.",
		origin: "vendor-docs",
	},
	left: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"Returns a `STRING` or `BYTES` value that consists of the specified number of leftmost characters or bytes from `value`.",
		origin: "vendor-docs",
	},
	length: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Returns the length of the `STRING` or `BYTES` value.",
		origin: "vendor-docs",
	},
	ln: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#ln",
		description: "Computes the natural logarithm of X.",
		origin: "vendor-docs",
	},
	log: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#log",
		description: "If only X is present, `LOG` is a synonym of `LN`.",
		origin: "vendor-docs",
	},
	log10: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#log10",
		description: "Similar to `LOG`, but computes logarithm to base 10.",
		origin: "vendor-docs",
	},
	lower: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "For `STRING` arguments, returns the original string with all alphabetic characters in lowercase.",
		origin: "vendor-docs",
	},
	lpad: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Returns a `STRING` or `BYTES` value that consists of `original_value` prepended with `pattern`.",
		origin: "vendor-docs",
	},
	ltrim: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Identical to [TRIM][string-link-to-trim], but only removes leading characters.",
		origin: "vendor-docs",
	},
	max: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/aggregate_functions#max",
		description: "Returns the maximum non-`NULL` value in an aggregated group.",
		origin: "vendor-docs",
	},
	md5: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/hash_functions",
		description: "Computes the hash of the input using the [MD5 algorithm][hash-link-to-md5-wikipedia].",
		origin: "vendor-docs",
	},
	min: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/aggregate_functions#min",
		description: "Returns the minimum non-`NULL` value in an aggregated group.",
		origin: "vendor-docs",
	},
	mod: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#mod",
		description: "Modulo function: returns the remainder of the division of X by Y.",
		origin: "vendor-docs",
	},
	months_between: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/datetime_functions",
		description:
			"Returns the number of whole and partial months between `datetime_end` and `datetime_start`, represented as a floating-point number.",
		origin: "vendor-docs",
	},
	next_day: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/datetime_functions",
		description: "Returns the `DATE` of the first weekday named `day_of_week` that is later than `datetime`.",
		origin: "vendor-docs",
	},
	nodes: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description: "Gets the nodes in a graph path.",
		origin: "vendor-docs",
	},
	normalize: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Takes a string value and returns it as a normalized string.",
		origin: "vendor-docs",
	},
	normalize_and_casefold: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Takes a string value and returns it as a normalized string.",
		origin: "vendor-docs",
	},
	ntile: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/numbering_functions",
		description:
			"This function divides the rows into `constant_integer_expression` buckets based on row ordering and returns the 1-based bucket number that is assigned to each row.",
		origin: "vendor-docs",
	},
	nullif: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/conditional_expressions#nullif",
		description: "Returns `NULL` if `expr = expr_to_match` evaluates to `TRUE`, otherwise returns `expr`.",
		origin: "vendor-docs",
	},
	nulliferror: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/debugging_functions",
		description: "Evaluates `try_expression`.",
		origin: "vendor-docs",
	},
	nullifzero: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/conditional_expressions#nullifzero",
		description: "Returns `NULL` if the value of `expr` is `0`.",
		origin: "vendor-docs",
	},
	octet_length: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		origin: "vendor-docs",
	},
	parse_bignumeric: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/conversion_functions",
		description: "Converts a `STRING` to a `BIGNUMERIC` value.",
		origin: "vendor-docs",
	},
	parse_date: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/date_functions",
		description: "Converts a `STRING` value to a `DATE` value.",
		origin: "vendor-docs",
	},
	parse_datetime: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/datetime_functions",
		description: "Converts a `STRING` value to a `DATETIME` value.",
		origin: "vendor-docs",
	},
	parse_numeric: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/conversion_functions",
		description: "Converts a `STRING` to a `NUMERIC` value.",
		origin: "vendor-docs",
	},
	parse_time: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/time_functions",
		description: "Converts a `STRING` value to a `TIME` value.",
		origin: "vendor-docs",
	},
	parse_timestamp: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description: "Converts a `STRING` value to a `TIMESTAMP` value.",
		origin: "vendor-docs",
	},
	path: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description: "Creates a graph path from a list of graph elements.",
		origin: "vendor-docs",
	},
	path_first: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description: "Gets the first node in a graph path.",
		origin: "vendor-docs",
	},
	path_last: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description: "Gets the last node in a graph path.",
		origin: "vendor-docs",
	},
	path_length: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description: "Gets the number of edges in a graph path.",
		origin: "vendor-docs",
	},
	percent_rank: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/numbering_functions",
		description:
			"Return the percentile rank of a row defined as (RK-1)/(NR-1), where RK is the `RANK` of the row and NR is the number of rows in the partition.",
		origin: "vendor-docs",
	},
	pi: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#pi",
		description: "Returns the mathematical constant `π` as a `DOUBLE` value.",
		origin: "vendor-docs",
	},
	pi_bignumeric: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#pi_bignumeric",
		description: "Returns the mathematical constant `π` as a `BIGNUMERIC` value.",
		origin: "vendor-docs",
	},
	pi_numeric: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#pi_numeric",
		description: "Returns the mathematical constant `π` as a `NUMERIC` value.",
		origin: "vendor-docs",
	},
	pow: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#pow",
		description: "Returns the value of X raised to the power of Y.",
		origin: "vendor-docs",
	},
	power: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#power",
		description: "Synonym of [`POW(X, Y)`][pow].",
		origin: "vendor-docs",
	},
	property_names: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description:
			"Gets the name of each property associated with a graph element and preserves the original case of each name.",
		origin: "vendor-docs",
	},
	proto_default_if_null: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/protocol_buffer_functions",
		description: "Evaluates any expression that results in a proto field access.",
		origin: "vendor-docs",
	},
	proto_map_contains_key: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/protocol_buffer_functions",
		description: "Returns whether a [protocol buffer map field][proto-map] contains a given key.",
		origin: "vendor-docs",
	},
	proto_modify_map: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/protocol_buffer_functions",
		description: "Modifies a [protocol buffer map field][proto-map] and returns the modified map field.",
		origin: "vendor-docs",
	},
	rand: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#rand",
		description:
			"Generates a pseudo-random value of type `DOUBLE` in the range of [0, 1), inclusive of 0 and exclusive of 1.",
		origin: "vendor-docs",
	},
	range: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/range-functions",
		description:
			"Constructs a range of [`DATE`][date-type], [`DATETIME`][datetime-type], or [`TIMESTAMP`][timestamp-type] values.",
		origin: "vendor-docs",
	},
	range_bucket: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#range_bucket",
		description:
			"`RANGE_BUCKET` scans through a sorted array and returns the 0-based position of the point's upper bound.",
		origin: "vendor-docs",
	},
	range_contains: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/range-functions",
		description: "Checks if the inner range is in the outer range.",
		origin: "vendor-docs",
	},
	range_end: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/range-functions",
		description: "Gets the upper bound of a range.",
		origin: "vendor-docs",
	},
	range_intersect: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/range-functions",
		description: "Gets a segment of two ranges that intersect.",
		origin: "vendor-docs",
	},
	range_overlaps: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/range-functions",
		description: "Checks if two ranges overlap.",
		origin: "vendor-docs",
	},
	range_start: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/range-functions",
		description: "Gets the lower bound of a range.",
		origin: "vendor-docs",
	},
	rank: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/numbering_functions",
		description: "Returns the ordinal (1-based) rank of each row within the ordered partition.",
		origin: "vendor-docs",
	},
	regexp_contains: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Returns `TRUE` if `value` is a partial match for the regular expression, `regexp`.",
		origin: "vendor-docs",
	},
	regexp_extract: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"Returns the substring in `value` that matches the [re2 regular expression][string-link-to-re2], `regexp`.",
		origin: "vendor-docs",
	},
	regexp_extract_all: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"Returns an array of all substrings of `value` that match the [re2 regular expression][string-link-to-re2], `regexp`.",
		origin: "vendor-docs",
	},
	regexp_extract_groups: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"Returns a `STRUCT` where each field contains a substring from `value` that matches a capturing group in the [re2 regular expression][string-link-to-re2], `regexp`.",
		origin: "vendor-docs",
	},
	regexp_match: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		origin: "vendor-docs",
	},
	regexp_replace: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"Returns a `STRING` where all substrings of `value` that match regular expression `regexp` are replaced with `replacement`.",
		origin: "vendor-docs",
	},
	regexp_substr: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Synonym for [REGEXP_EXTRACT][string-link-to-regex].",
		origin: "vendor-docs",
	},
	repeat: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Returns a `STRING` or `BYTES` value that consists of `original_value`, repeated.",
		origin: "vendor-docs",
	},
	replace: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Replaces all occurrences of `from_pattern` with `to_pattern` in `original_value`.",
		origin: "vendor-docs",
	},
	reverse: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Returns the reverse of the input `STRING` or `BYTES`.",
		origin: "vendor-docs",
	},
	right: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"Returns a `STRING` or `BYTES` value that consists of the specified number of rightmost characters or bytes from `value`.",
		origin: "vendor-docs",
	},
	round: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#round",
		description: "If only X is present, rounds X to the nearest integer.",
		origin: "vendor-docs",
	},
	row_number: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/numbering_functions",
		description: "Returns the sequential row ordinal (1-based) of each row for each ordered partition.",
		origin: "vendor-docs",
	},
	rpad: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Returns a `STRING` or `BYTES` value that consists of `original_value` appended with `pattern`.",
		origin: "vendor-docs",
	},
	rtrim: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Identical to [TRIM][string-link-to-trim], but only removes trailing characters.",
		origin: "vendor-docs",
	},
	safe_add: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#safe_add",
		description: "Equivalent to the addition operator (`+`), but returns `NULL` if overflow occurs.",
		origin: "vendor-docs",
	},
	safe_cast: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/conversion_functions#safe_casting",
		description: "When using `CAST`, a query can fail if GoogleSQL is unable to perform the cast.",
		origin: "vendor-docs",
	},
	safe_convert_bytes_to_string: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Converts a sequence of `BYTES` to a `STRING`.",
		origin: "vendor-docs",
	},
	safe_divide: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#safe_divide",
		description:
			"Equivalent to the division operator (`X / Y`), but returns `NULL` if an error occurs, such as a division by zero error.",
		origin: "vendor-docs",
	},
	safe_multiply: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#safe_multiply",
		description: "Equivalent to the multiplication operator (`*`), but returns `NULL` if overflow occurs.",
		origin: "vendor-docs",
	},
	safe_negate: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#safe_negate",
		description: "Equivalent to the unary minus operator (`-`), but returns `NULL` if overflow occurs.",
		origin: "vendor-docs",
	},
	safe_subtract: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#safe_subtract",
		description: "Returns the result of Y subtracted from X.",
		origin: "vendor-docs",
	},
	safe_to_json: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#safe_to_json",
		description:
			"Similar to the `TO_JSON` function, but for each unsupported field in the input argument, produces a JSON null instead of an error.",
		origin: "vendor-docs",
	},
	sec: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#sec",
		description: "Computes the secant for the angle of `X`, where `X` is specified in radians.",
		origin: "vendor-docs",
	},
	sech: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#sech",
		description: "Computes the hyperbolic secant for the angle of `X`, where `X` is specified in radians.",
		origin: "vendor-docs",
	},
	session_user: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/security_functions",
		description: "For first-party users, returns the email address of the user that's running the query.",
		origin: "vendor-docs",
	},
	sha1: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/hash_functions",
		description: "Computes the hash of the input using the [SHA-1 algorithm][hash-link-to-sha-1-wikipedia].",
		origin: "vendor-docs",
	},
	sha256: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/hash_functions",
		description: "Computes the hash of the input using the [SHA-256 algorithm][hash-link-to-sha-2-wikipedia].",
		origin: "vendor-docs",
	},
	sha512: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/hash_functions",
		description: "Computes the hash of the input using the [SHA-512 algorithm][hash-link-to-sha-2-wikipedia].",
		origin: "vendor-docs",
	},
	sign: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#sign",
		description: "Returns `-1`, `0`, or `+1` for negative, zero and positive arguments respectively.",
		origin: "vendor-docs",
	},
	sin: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#sin",
		description: "Computes the sine of X where X is specified in radians.",
		origin: "vendor-docs",
	},
	sinh: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#sinh",
		description: "Computes the hyperbolic sine of X where X is specified in radians.",
		origin: "vendor-docs",
	},
	soundex: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"Returns a `STRING` that represents the [Soundex][string-link-to-soundex-wikipedia] code for `value`.",
		origin: "vendor-docs",
	},
	source_node_id: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/graph-gql-functions",
		description: "Gets a unique identifier of a graph edge's source node.",
		origin: "vendor-docs",
	},
	split: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Splits a `STRING` or `BYTES` value, using a delimiter.",
		origin: "vendor-docs",
	},
	split_substr: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"Returns a substring from an input `STRING` that's determined by a delimiter, a location that indicates the first split of the substring to return, and the number of splits to include in the returned substring.",
		origin: "vendor-docs",
	},
	sqrt: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#sqrt",
		description: "Computes the square root of X.",
		origin: "vendor-docs",
	},
	st_angle: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_angle",
		description: "Takes three point `GEOGRAPHY` values, which represent two intersecting lines.",
		origin: "vendor-docs",
	},
	st_area: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_area",
		description: "Returns the area in square meters covered by the polygons in the input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_asbinary: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_asbinary",
		description: "Returns the [WKB][wkb-link] representation of an input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_asgeojson: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_asgeojson",
		description:
			"Returns the [RFC 7946][GeoJSON-spec-link] compliant [GeoJSON][geojson-link] representation of the input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_askml: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_askml",
		description: "Takes a `GEOGRAPHY` and returns a `STRING` [KML geometry][kml-geometry-link].",
		origin: "vendor-docs",
	},
	st_astext: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_astext",
		description: "Returns the [WKT][wkt-link] representation of an input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_azimuth: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_azimuth",
		description:
			"Takes two point `GEOGRAPHY` values, and returns the azimuth of the line segment formed by points 1 and 2.",
		origin: "vendor-docs",
	},
	st_boundary: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_boundary",
		description:
			"Returns a single `GEOGRAPHY` that contains the union of the boundaries of each component in the given input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_boundingbox: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_boundingbox",
		description: "Returns a `STRUCT` that represents the bounding box for the specified geography.",
		origin: "vendor-docs",
	},
	st_centroid: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_centroid",
		description: "Returns the _centroid_ of the input `GEOGRAPHY` as a single point `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_closestpoint: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_closestpoint",
		description:
			"Returns a `GEOGRAPHY` containing a point on `geography_1` with the smallest possible distance to `geography_2`.",
		origin: "vendor-docs",
	},
	st_clusterdbscan: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_clusterdbscan",
		origin: "vendor-docs",
	},
	st_contains: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_contains",
		description:
			"Returns `TRUE` if no point of `geography_2` is outside `geography_1`, and the interiors intersect; returns `FALSE` otherwise.",
		origin: "vendor-docs",
	},
	st_convexhull: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_convexhull",
		description: "Returns the convex hull for the input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_coveredby: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_coveredby",
		description: "Returns `FALSE` if `geography_1` or `geography_2` is empty.",
		origin: "vendor-docs",
	},
	st_covers: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_covers",
		description: "Returns `FALSE` if `geography_1` or `geography_2` is empty.",
		origin: "vendor-docs",
	},
	st_difference: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_difference",
		description:
			"Returns a `GEOGRAPHY` that represents the point set difference of `geography_1` and `geography_2`.",
		origin: "vendor-docs",
	},
	st_dimension: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_dimension",
		description: "Returns the dimension of the highest-dimensional element in the input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_disjoint: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_disjoint",
		description:
			"Returns `TRUE` if the intersection of `geography_1` and `geography_2` is empty, that is, no point in `geography_1` also appears in `geography_2`.",
		origin: "vendor-docs",
	},
	st_distance: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_distance",
		description: "Returns the shortest distance in meters between two non-empty `GEOGRAPHY`s.",
		origin: "vendor-docs",
	},
	st_dump: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_dump",
		description:
			"Returns an `ARRAY` of simple `GEOGRAPHY`s where each element is a component of the input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_dumppoints: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_dumppoints",
		description:
			"Takes an input geography and returns all of its points, line vertices, and polygon vertices as an array of point geographies.",
		origin: "vendor-docs",
	},
	st_dwithin: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_dwithin",
		description:
			"Returns `TRUE` if the distance between at least one point in `geography_1` and one point in `geography_2` is less than or equal to the distance given by the `distance` argument; otherwise, returns `FALSE`.",
		origin: "vendor-docs",
	},
	st_endpoint: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_endpoint",
		description: "Returns the last point of a linestring geography as a point geography.",
		origin: "vendor-docs",
	},
	st_equals: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_equals",
		description: "Checks if two `GEOGRAPHY` values represent the same `GEOGRAPHY` value.",
		origin: "vendor-docs",
	},
	st_extent: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_extent",
		description: "Returns a `STRUCT` that represents the bounding box for the set of input `GEOGRAPHY` values.",
		origin: "vendor-docs",
	},
	st_exteriorring: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_exteriorring",
		description: "Returns a linestring geography that corresponds to the outermost ring of a polygon geography.",
		origin: "vendor-docs",
	},
	st_geogfrom: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_geogfrom",
		description: "Converts an expression for a `STRING` or `BYTES` value into a `GEOGRAPHY` value.",
		origin: "vendor-docs",
	},
	st_geogfromkml: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_geogfromkml",
		origin: "vendor-docs",
	},
	st_geogpoint: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_geogpoint",
		description: "Creates a `GEOGRAPHY` with a single point.",
		origin: "vendor-docs",
	},
	st_geogpointfromgeohash: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_geogpointfromgeohash",
		description:
			"Returns a `GEOGRAPHY` value that corresponds to a point in the middle of a bounding box defined in the [GeoHash][geohash-link].",
		origin: "vendor-docs",
	},
	st_geohash: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_geohash",
		description:
			"Takes a single-point `GEOGRAPHY` and returns a [GeoHash][geohash-link] representation of that `GEOGRAPHY` object.",
		origin: "vendor-docs",
	},
	st_geometrytype: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_geometrytype",
		description:
			"Returns the [Open Geospatial Consortium][ogc-link] (OGC) geometry type that describes the input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_interiorrings: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_interiorrings",
		description:
			"Returns an array of linestring geographies that corresponds to the interior rings of a polygon geography.",
		origin: "vendor-docs",
	},
	st_intersection: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_intersection",
		description: "Returns a `GEOGRAPHY` that represents the point set intersection of the two input `GEOGRAPHY`s.",
		origin: "vendor-docs",
	},
	st_intersects: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_intersects",
		description: "Returns `TRUE` if the point set intersection of `geography_1` and `geography_2` is non-empty.",
		origin: "vendor-docs",
	},
	st_intersectsbox: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_intersectsbox",
		description:
			"Returns `TRUE` if `geography` intersects the rectangle between `[lng1, lng2]` and `[lat1, lat2]`.",
		origin: "vendor-docs",
	},
	st_isclosed: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_isclosed",
		description:
			"Returns `TRUE` for a non-empty Geography, where each element in the Geography has an empty boundary.",
		origin: "vendor-docs",
	},
	st_iscollection: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_iscollection",
		description: "Returns `TRUE` if the total number of points, linestrings, and polygons is greater than one.",
		origin: "vendor-docs",
	},
	st_isempty: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_isempty",
		description:
			"Returns `TRUE` if the given `GEOGRAPHY` is empty; that is, the `GEOGRAPHY` doesn't contain any points, lines, or polygons.",
		origin: "vendor-docs",
	},
	st_isring: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_isring",
		description:
			"Returns `TRUE` if the input `GEOGRAPHY` is a linestring and if the linestring is both [`ST_ISCLOSED`][st-isclosed] and simple.",
		origin: "vendor-docs",
	},
	st_length: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_length",
		description: "Returns the total length in meters of the lines in the input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_lineinterpolatepoint: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_lineinterpolatepoint",
		description: "Gets a point at a specific fraction in a linestring `GEOGRAPHY` value.",
		origin: "vendor-docs",
	},
	st_linelocatepoint: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_linelocatepoint",
		description:
			"Gets a section of a linestring between the start point and a selected point (a point on the linestring closest to the `point_geography` argument).",
		origin: "vendor-docs",
	},
	st_linesubstring: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_linesubstring",
		description: "Gets a segment of a linestring at a specific starting and ending fraction.",
		origin: "vendor-docs",
	},
	st_makeline: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_makeline",
		description:
			"Creates a `GEOGRAPHY` with a single linestring by concatenating the point or line vertices of each of the input `GEOGRAPHY`s in the order they are given.",
		origin: "vendor-docs",
	},
	st_makepolygon: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_makepolygon",
		description:
			"Creates a `GEOGRAPHY` containing a single polygon from linestring inputs, where each input linestring is used to construct a polygon ring.",
		origin: "vendor-docs",
	},
	st_makepolygonoriented: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_makepolygonoriented",
		description:
			"Like `ST_MAKEPOLYGON`, but the vertex ordering of each input linestring determines the orientation of each polygon ring.",
		origin: "vendor-docs",
	},
	st_maxdistance: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_maxdistance",
		origin: "vendor-docs",
	},
	st_npoints: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_npoints",
		description: "An alias of [ST_NUMPOINTS][st-numpoints].",
		origin: "vendor-docs",
	},
	st_numgeometries: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_numgeometries",
		description: "Returns the number of geometries in the input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_numpoints: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_numpoints",
		description: "Returns the number of vertices in the input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_perimeter: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_perimeter",
		description: "Returns the length in meters of the boundary of the polygons in the input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_pointn: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_pointn",
		description: "Returns the Nth point of a linestring geography as a point geography, where N is the index.",
		origin: "vendor-docs",
	},
	st_simplify: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_simplify",
		description: "Returns a simplified version of `geography`, the given input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_snaptogrid: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_snaptogrid",
		description: "Returns the input `GEOGRAPHY`, where each vertex has been snapped to a longitude/latitude grid.",
		origin: "vendor-docs",
	},
	st_startpoint: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_startpoint",
		description: "Returns the first point of a linestring geography as a point geography.",
		origin: "vendor-docs",
	},
	st_touches: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_touches",
		description: "Returns `TRUE` provided the following two conditions are satisfied.",
		origin: "vendor-docs",
	},
	st_union: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_union",
		description: "Returns a `GEOGRAPHY` that represents the point set union of all input `GEOGRAPHY`s.",
		origin: "vendor-docs",
	},
	st_union_agg: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_union_agg",
		description: "Returns a `GEOGRAPHY` that represents the point set union of all input `GEOGRAPHY`s.",
		origin: "vendor-docs",
	},
	st_within: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_within",
		description:
			"Returns `TRUE` if no point of `geography_1` is outside of `geography_2` and the interiors of `geography_1` and `geography_2` intersect.",
		origin: "vendor-docs",
	},
	st_x: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_x",
		description: "Returns the longitude in degrees of the single-point input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	st_y: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/geography_functions#st_y",
		description: "Returns the latitude in degrees of the single-point input `GEOGRAPHY`.",
		origin: "vendor-docs",
	},
	starts_with: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Takes two `STRING` or `BYTES` values.",
		origin: "vendor-docs",
	},
	string: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description: "Converts a JSON string to a SQL `STRING` value.",
		origin: "vendor-docs",
	},
	string_agg: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/aggregate_functions#string_agg",
		description: "Returns a value (either `STRING` or `BYTES`) obtained by concatenating non-`NULL` values.",
		origin: "vendor-docs",
	},
	string_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#string_array_for_json",
		description: "Converts a JSON array of strings to a SQL `ARRAY<STRING>` value.",
		origin: "vendor-docs",
	},
	strpos: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Takes two `STRING` or `BYTES` values.",
		origin: "vendor-docs",
	},
	substr: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Gets a portion (substring) of the supplied `STRING` or `BYTES` value.",
		origin: "vendor-docs",
	},
	substring: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		origin: "vendor-docs",
	},
	sum: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/aggregate_functions#sum",
		description: "Returns the sum of non-`NULL` values in an aggregated group.",
		origin: "vendor-docs",
	},
	tan: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#tan",
		description: "Computes the tangent of X where X is specified in radians.",
		origin: "vendor-docs",
	},
	tanh: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#tanh",
		description: "Computes the hyperbolic tangent of X where X is specified in radians.",
		origin: "vendor-docs",
	},
	time_diff: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/time_functions",
		description:
			"Gets the number of unit boundaries between two `TIME` values (`end_time` - `start_time`) at a particular time granularity.",
		origin: "vendor-docs",
	},
	time_trunc: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/time_functions",
		description: "Truncates a `TIME` value at a particular granularity.",
		origin: "vendor-docs",
	},
	timestamp: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description: "+ `string_expression[, time_zone]`: Converts a string to a timestamp.",
		origin: "vendor-docs",
	},
	timestamp_bucket: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/time-series-functions",
		description: "Gets the lower bound of the timestamp bucket that contains a timestamp.",
		origin: "vendor-docs",
	},
	timestamp_diff: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description:
			"Gets the number of unit boundaries between two `TIMESTAMP` values (`end_timestamp` - `start_timestamp`) at a particular time granularity.",
		origin: "vendor-docs",
	},
	timestamp_from_unix_micros: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description:
			"Interprets `int64_expression` as the number of microseconds since 1970-01-01 00:00:00 UTC and returns a timestamp.",
		origin: "vendor-docs",
	},
	timestamp_from_unix_millis: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description:
			"Interprets `int64_expression` as the number of milliseconds since 1970-01-01 00:00:00 UTC and returns a timestamp.",
		origin: "vendor-docs",
	},
	timestamp_from_unix_seconds: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description:
			"Interprets `int64_expression` as the number of seconds since 1970-01-01 00:00:00 UTC and returns a timestamp.",
		origin: "vendor-docs",
	},
	timestamp_micros: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description:
			"Interprets `int64_expression` as the number of microseconds since 1970-01-01 00:00:00 UTC and returns a timestamp.",
		origin: "vendor-docs",
	},
	timestamp_millis: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description:
			"Interprets `int64_expression` as the number of milliseconds since 1970-01-01 00:00:00 UTC and returns a timestamp.",
		origin: "vendor-docs",
	},
	timestamp_seconds: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description:
			"Interprets `int64_expression` as the number of seconds since 1970-01-01 00:00:00 UTC and returns a timestamp.",
		origin: "vendor-docs",
	},
	timestamp_trunc: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description: "Truncates a `TIMESTAMP` or `DATETIME` value at a particular granularity.",
		origin: "vendor-docs",
	},
	to_base32: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Converts a sequence of `BYTES` into a base32-encoded `STRING`.",
		origin: "vendor-docs",
	},
	to_base64: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Converts a sequence of `BYTES` into a base64-encoded `STRING`.",
		origin: "vendor-docs",
	},
	to_code_points: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"Takes a `STRING` or `BYTES` value and returns an array of `INT64` values that represent code points or extended ASCII character values.",
		origin: "vendor-docs",
	},
	to_hex: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Converts a sequence of `BYTES` into a hexadecimal `STRING`.",
		origin: "vendor-docs",
	},
	to_json_string: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#to_json_string",
		description: "Converts a SQL value to a JSON-formatted `STRING` value.",
		origin: "vendor-docs",
	},
	to_proto: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/protocol_buffer_functions",
		description: "Returns a PROTO value.",
		origin: "vendor-docs",
	},
	translate: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description:
			"In `expression`, replaces each character in `source_characters` with the corresponding character in `target_characters`.",
		origin: "vendor-docs",
	},
	trim: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Takes a `STRING` or `BYTES` value to trim.",
		origin: "vendor-docs",
	},
	trunc: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/mathematical_functions#trunc",
		description:
			"If only X is present, `TRUNC` rounds X to the nearest integer whose absolute value isn't greater than the absolute value of X.",
		origin: "vendor-docs",
	},
	uint32: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#uint32_for_json",
		description: "Converts a JSON number to a SQL `UINT32` value.",
		origin: "vendor-docs",
	},
	uint32_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#uint32_array_for_json",
		description: "Converts a JSON number to a SQL `UINT32_ARRAY` value.",
		origin: "vendor-docs",
	},
	uint64: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#uint64_for_json",
		description: "Converts a JSON number to a SQL `UINT64` value.",
		origin: "vendor-docs",
	},
	uint64_array: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#uint64_array_for_json",
		description: "Converts a JSON number to a SQL `UINT64_ARRAY` value.",
		origin: "vendor-docs",
	},
	unicode: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "Returns the Unicode [code point][string-code-point] for the first character in `value`.",
		origin: "vendor-docs",
	},
	unix_date: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/date_functions",
		description: "Returns the number of days since `1970-01-01`.",
		origin: "vendor-docs",
	},
	unix_micros: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description: "Returns the number of microseconds since `1970-01-01 00:00:00 UTC`.",
		origin: "vendor-docs",
	},
	unix_millis: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description: "Returns the number of milliseconds since `1970-01-01 00:00:00 UTC`.",
		origin: "vendor-docs",
	},
	unix_seconds: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions",
		description: "Returns the number of seconds since `1970-01-01 00:00:00 UTC`.",
		origin: "vendor-docs",
	},
	upper: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/string_functions",
		description: "For `STRING` arguments, returns the original string with all alphabetic characters in uppercase.",
		origin: "vendor-docs",
	},
	zeroifnull: {
		docUrl: "https://cloud.google.com/bigquery/docs/reference/standard-sql/conditional_expressions#zeroifnull",
		description: "Returns `0` if the value of `expr` is `NULL`.",
		origin: "vendor-docs",
	},
};
