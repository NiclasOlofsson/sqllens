// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for duckdb (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-14. 410 names (409 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const DUCKDB_FN_DOCS: Record<string, FnDoc> = {
	abs: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Absolute value.",
		origin: "vendor-docs",
	},
	acos: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the inverse cosine of `x`.",
		origin: "vendor-docs",
	},
	acosh: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the inverse hyperbolic cosine of `x`.",
		origin: "vendor-docs",
	},
	add: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Alias for `x + y`.",
		origin: "vendor-docs",
	},
	age: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html",
		description: "Subtract arguments, resulting in the time difference between the two timestamps.",
		origin: "vendor-docs",
	},
	ago: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html",
		description: "Subtracts an interval from the current timestamp, returning a timestamp in the past.",
		origin: "vendor-docs",
	},
	alias: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Return the name of the column.",
		origin: "vendor-docs",
	},
	any_value: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns the first non-`NULL` value from `arg`.",
		origin: "vendor-docs",
	},
	arg_max: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Finds the row with the maximum `val` and calculates the `arg` expression at that row.",
		origin: "vendor-docs",
	},
	arg_max_null: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Finds the row with the maximum `val` and calculates the `arg` expression at that row.",
		origin: "vendor-docs",
	},
	arg_min: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Finds the row with the minimum `val` and calculates the `arg` expression at that row.",
		origin: "vendor-docs",
	},
	arg_min_null: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Finds the row with the minimum `val` and calculates the `arg` expression at that row.",
		origin: "vendor-docs",
	},
	array_cosine_distance: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/array.html",
		description: "Computes the cosine distance between two arrays of the same size.",
		origin: "vendor-docs",
	},
	array_cosine_similarity: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/array.html",
		description: "Computes the cosine similarity between two arrays of the same size.",
		origin: "vendor-docs",
	},
	array_cross_product: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/array.html",
		description: "Computes the cross product of two arrays of size 3.",
		origin: "vendor-docs",
	},
	array_distance: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/array.html",
		description: "Computes the distance between two arrays of the same size.",
		origin: "vendor-docs",
	},
	array_extract: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Extracts the `index`th (1-based) value from the `list`.",
		origin: "vendor-docs",
	},
	array_inner_product: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/array.html",
		description: "Computes the inner product between two arrays of the same size.",
		origin: "vendor-docs",
	},
	array_negative_inner_product: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/array.html",
		description: "Computes the negative inner product between two arrays of the same size.",
		origin: "vendor-docs",
	},
	array_pop_back: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Returns the `list` without the last element.",
		origin: "vendor-docs",
	},
	array_pop_front: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Returns the `list` without the first element.",
		origin: "vendor-docs",
	},
	array_push_front: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Prepends `element` to `list`.",
		origin: "vendor-docs",
	},
	array_slice: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Extracts a sublist or substring using slice conventions.",
		origin: "vendor-docs",
	},
	array_to_string: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Concatenates list/array elements using an optional `delimiter`.",
		origin: "vendor-docs",
	},
	array_to_string_comma_default: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Concatenates list/array elements with a comma delimiter.",
		origin: "vendor-docs",
	},
	array_value: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/array.html",
		description: "Creates an `ARRAY` containing the argument values.",
		origin: "vendor-docs",
	},
	ascii: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Returns an integer that represents the Unicode code point of the first character of the `string`.",
		origin: "vendor-docs",
	},
	asin: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the inverse sine of `x`.",
		origin: "vendor-docs",
	},
	asinh: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the inverse hyperbolic sine of `x`.",
		origin: "vendor-docs",
	},
	atan: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the inverse tangent of `x`.",
		origin: "vendor-docs",
	},
	atan2: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the inverse tangent (y, x).",
		origin: "vendor-docs",
	},
	atanh: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the inverse hyperbolic tangent of `x`.",
		origin: "vendor-docs",
	},
	avg: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Calculates the average of all non-null values in `arg`.",
		origin: "vendor-docs",
	},
	bar: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Draws a band whose width is proportional to (`x - min`) and equal to `width` characters when `x` = `max`.",
		origin: "vendor-docs",
	},
	bin: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Converts the `string` to binary representation.",
		origin: "vendor-docs",
	},
	bit_and: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns the bitwise `AND` of all bits in a given expression.",
		origin: "vendor-docs",
	},
	bit_count: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html",
		description: "Returns the number of set bits in the bitstring.",
		origin: "vendor-docs",
	},
	bit_length: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html",
		description: "Returns the number of bits in the bitstring.",
		origin: "vendor-docs",
	},
	bit_or: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns the bitwise `OR` of all bits in a given expression.",
		origin: "vendor-docs",
	},
	bit_position: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html",
		description:
			"Returns first starting index of the specified substring within bits, or zero if it's not present.",
		origin: "vendor-docs",
	},
	bit_xor: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns the bitwise `XOR` of all bits in a given expression.",
		origin: "vendor-docs",
	},
	bitstring: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html",
		description: "Returns a bitstring of determined length.",
		origin: "vendor-docs",
	},
	bitstring_agg: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html",
		description:
			"Returns a bitstring whose length corresponds to the range of the non-null (integer) values, with bits set at the location of each (distinct) value.",
		origin: "vendor-docs",
	},
	bool_and: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns `true` if every input value is `true`, otherwise `false`.",
		origin: "vendor-docs",
	},
	bool_or: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns `true` if any input value is `true`, otherwise `false`.",
		origin: "vendor-docs",
	},
	can_cast_implicitly: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Whether or not we can implicitly cast from the types of the source value to the target value.",
		origin: "vendor-docs",
	},
	cardinality: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html",
		description: "Return the size of the map (or the number of entries in the map).",
		origin: "vendor-docs",
	},
	cbrt: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Returns the cube root of the number.",
		origin: "vendor-docs",
	},
	ceil: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Rounds the number up.",
		origin: "vendor-docs",
	},
	ceiling: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Rounds the number up.",
		origin: "vendor-docs",
	},
	century: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Century.",
		origin: "vendor-docs",
	},
	checkpoint: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Synchronize WAL with file for (optional) database without interrupting transactions.",
		origin: "vendor-docs",
	},
	chr: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Returns a character which is corresponding the ASCII code value or Unicode code point.",
		origin: "vendor-docs",
	},
	coalesce: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Return the first expression that evaluates to a non-`NULL` value.",
		origin: "vendor-docs",
	},
	concat: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Concatenates multiple strings or lists.",
		origin: "vendor-docs",
	},
	concat_ws: { description: "Concatenates many strings, separated by `separator`.", origin: "vendor-docs" },
	constant_or_null: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "If `arg2` is `NULL`, return `NULL`.",
		origin: "vendor-docs",
	},
	contains: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Returns `true` if the `list` contains the `element`.",
		origin: "vendor-docs",
	},
	corr: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The correlation coefficient.",
		origin: "vendor-docs",
	},
	cos: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the cosine of `x`.",
		origin: "vendor-docs",
	},
	cot: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the cotangent of `x`.",
		origin: "vendor-docs",
	},
	count: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns the number of rows.",
		origin: "vendor-docs",
	},
	count_if: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Aggregate function; rows contribute 1 if `x` is `true` or a non-zero number, else 0.",
		origin: "vendor-docs",
	},
	countif: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns the number of rows where `arg` is `true`.",
		origin: "vendor-docs",
	},
	covar_pop: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The population covariance, which does not include bias correction.",
		origin: "vendor-docs",
	},
	covar_samp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The sample covariance, which includes Bessel's bias correction.",
		origin: "vendor-docs",
	},
	current_catalog: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Return the name of the currently active catalog.",
		origin: "vendor-docs",
	},
	current_database: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Return the name of the currently active database.",
		origin: "vendor-docs",
	},
	current_localtime: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html",
		description: "Returns a `TIME` whose GMT bin values correspond to local time in the current time zone.",
		origin: "vendor-docs",
	},
	current_localtimestamp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html",
		description: "Returns the current timestamp with time zone (at the start of the transaction).",
		origin: "vendor-docs",
	},
	current_query: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Return the current query as a string.",
		origin: "vendor-docs",
	},
	current_schema: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Return the name of the currently active schema.",
		origin: "vendor-docs",
	},
	current_schemas: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Return list of schemas.",
		origin: "vendor-docs",
	},
	damerau_levenshtein: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Extension of Levenshtein distance to also include transposition of adjacent characters as an allowed edit operation.",
		origin: "vendor-docs",
	},
	date_add: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "Add the interval to the date and return a `DATETIME` value.",
		origin: "vendor-docs",
	},
	date_diff: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description:
			"The number of `part` boundaries between `startdate` and `enddate`, inclusive of the larger date and exclusive of the smaller date.",
		origin: "vendor-docs",
	},
	date_part: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "Get the subfield (equivalent to `extract`).",
		origin: "vendor-docs",
	},
	date_sub: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description:
			"The signed length of the interval between `startdate` and `enddate`, truncated to whole multiples of `part`.",
		origin: "vendor-docs",
	},
	date_trunc: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "Truncate to specified precision.",
		origin: "vendor-docs",
	},
	datepart: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html",
		description: "Alias of `date_part`.",
		origin: "vendor-docs",
	},
	day: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Day.",
		origin: "vendor-docs",
	},
	dayname: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "The (English) name of the weekday.",
		origin: "vendor-docs",
	},
	dayofmonth: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Day (synonym).",
		origin: "vendor-docs",
	},
	dayofweek: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Numeric weekday (Sunday = 0, Saturday = 6).",
		origin: "vendor-docs",
	},
	dayofyear: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Day of the year (starts from 1, i.e., January 1 = 1).",
		origin: "vendor-docs",
	},
	days_in_month: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "The number of days in the month of the given date.",
		origin: "vendor-docs",
	},
	decade: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Decade (year / 10).",
		origin: "vendor-docs",
	},
	decode: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html",
		description: "Converts `blob` to `VARCHAR`.",
		origin: "vendor-docs",
	},
	degrees: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Converts radians to degrees.",
		origin: "vendor-docs",
	},
	dense_rank: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/window_functions.html",
		description: "The rank of the current row *without gaps;* this function counts peer groups.",
		origin: "vendor-docs",
	},
	divide: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Alias for `x // y`.",
		origin: "vendor-docs",
	},
	element_at: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html",
		description:
			"Return the value for a given `key` as a list, or an empty list if the key is not contained in the map.",
		origin: "vendor-docs",
	},
	encode: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html",
		description: "Converts the `string` to `BLOB`.",
		origin: "vendor-docs",
	},
	entropy: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The log-2 entropy of count input-values.",
		origin: "vendor-docs",
	},
	enum_code: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/enum.html",
		description: "Returns the numeric value backing the given enum value.",
		origin: "vendor-docs",
	},
	enum_first: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/enum.html",
		description: "Returns the first value of the input enum type.",
		origin: "vendor-docs",
	},
	enum_last: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/enum.html",
		description: "Returns the last value of the input enum type.",
		origin: "vendor-docs",
	},
	enum_range: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/enum.html",
		description: "Returns all values of the input enum type as an array.",
		origin: "vendor-docs",
	},
	enum_range_boundary: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/enum.html",
		description: "Returns the range between the two given enum values as an array.",
		origin: "vendor-docs",
	},
	epoch: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Seconds since 1970-01-01.",
		origin: "vendor-docs",
	},
	epoch_ms: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html",
		description: "Returns the total number of milliseconds since the epoch.",
		origin: "vendor-docs",
	},
	epoch_ns: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html",
		description: "Returns the total number of nanoseconds since the epoch.",
		origin: "vendor-docs",
	},
	epoch_us: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html",
		description: "Returns the total number of microseconds since the epoch.",
		origin: "vendor-docs",
	},
	era: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Calendar era.",
		origin: "vendor-docs",
	},
	error: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Throws the given error `message`.",
		origin: "vendor-docs",
	},
	even: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Round to next even number by rounding away from zero.",
		origin: "vendor-docs",
	},
	exp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes `e ** x`.",
		origin: "vendor-docs",
	},
	factorial: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "See the `!` operator.",
		origin: "vendor-docs",
	},
	favg: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Calculates the average using a more accurate floating point summation (Kahan Sum).",
		origin: "vendor-docs",
	},
	fdiv: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Performs integer division (`x // y`) but returns a `DOUBLE` value.",
		origin: "vendor-docs",
	},
	first: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns the first value (null or non-null) from `arg`.",
		origin: "vendor-docs",
	},
	flatten: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Flattens a nested list by one level.",
		origin: "vendor-docs",
	},
	floor: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Rounds the number down.",
		origin: "vendor-docs",
	},
	fmod: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Calculates the modulo value.",
		origin: "vendor-docs",
	},
	force_checkpoint: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Synchronize WAL with file for (optional) database interrupting transactions.",
		origin: "vendor-docs",
	},
	format: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Formats a string using the fmt syntax.",
		origin: "vendor-docs",
	},
	format_bytes: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Converts `integer` to a human-readable representation using units based on powers of 2 (KiB, MiB, GiB, etc.).",
		origin: "vendor-docs",
	},
	formatreadabledecimalsize: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Converts `integer` to a human-readable representation using units based on powers of 10 (KB, MB, GB, etc.).",
		origin: "vendor-docs",
	},
	from_base64: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html",
		description: "Converts a base64 encoded `string` to a character string (`BLOB`).",
		origin: "vendor-docs",
	},
	fsum: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Calculates the sum using a more accurate floating point summation (Kahan Sum).",
		origin: "vendor-docs",
	},
	gamma: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Interpolation of the factorial of `x - 1`.",
		origin: "vendor-docs",
	},
	gcd: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the greatest common divisor of `x` and `y`.",
		origin: "vendor-docs",
	},
	gen_random_uuid: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Return a random UUID (UUIDv4) similar to this: `eeccb8c5-9943-b2bb-bb5e-222f4e14b687`.",
		origin: "vendor-docs",
	},
	generate_series: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Creates a list of values between `start` and `stop` - the stop parameter is inclusive.",
		origin: "vendor-docs",
	},
	generate_subscripts: { docUrl: "https://duckdb.org/docs/current/sql/functions/list.html", origin: "vendor-docs" },
	geometric_mean: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Calculates the geometric mean of all non-null values in `arg`.",
		origin: "vendor-docs",
	},
	get_bit: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html",
		description: "Extracts the nth bit from bitstring; the first (leftmost) bit is indexed 0.",
		origin: "vendor-docs",
	},
	get_current_time: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/time.html",
		description: "Current time (start of current transaction) in the local time zone as `TIMETZ`.",
		origin: "vendor-docs",
	},
	get_current_timestamp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html",
		description: "Current date and time (start of current transaction).",
		origin: "vendor-docs",
	},
	getenv: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Returns the value of the environment variable `var`.",
		origin: "vendor-docs",
	},
	glob: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description:
			"Return filenames found at the location indicated by the *search_path* in a single column named `file`.",
		origin: "vendor-docs",
	},
	greatest: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "The later of two dates.",
		origin: "vendor-docs",
	},
	greatest_common_divisor: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the greatest common divisor of `x` and `y`.",
		origin: "vendor-docs",
	},
	hamming: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"The Hamming distance between two strings, i.e., the number of positions with different characters for two strings of equal length.",
		origin: "vendor-docs",
	},
	hash: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Returns a `UBIGINT` with the hash of the `value`.",
		origin: "vendor-docs",
	},
	hex: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html",
		description: "Converts `blob` to `VARCHAR` using hexadecimal encoding.",
		origin: "vendor-docs",
	},
	histogram: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns a `MAP` of key-value pairs representing buckets and counts.",
		origin: "vendor-docs",
	},
	histogram_exact: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns a `MAP` of key-value pairs representing the requested elements and their counts.",
		origin: "vendor-docs",
	},
	histogram_values: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns the upper boundaries of the bins and their counts.",
		origin: "vendor-docs",
	},
	hour: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Hours.",
		origin: "vendor-docs",
	},
	icu_sort_key: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Surrogate sort key used to sort special characters according to the specific locale.",
		origin: "vendor-docs",
	},
	if: { description: "Ternary conditional operator; returns b if a, else returns c.", origin: "vendor-docs" },
	ifnull: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "A two-argument version of coalesce.",
		origin: "vendor-docs",
	},
	ilike_escape: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Returns `true` if the `string` matches the `like_specifier` (see Pattern Matching) using case-insensitive matching.",
		origin: "vendor-docs",
	},
	instr: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Returns location of first occurrence of `search_string` in `string`, counting from 1.",
		origin: "vendor-docs",
	},
	is_histogram_other_bin: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description:
			'Returns `true` when `arg` is the "catch-all element" of its datatype for the purpose of the `histogram_exact` function, which is equal to the "right-most boundary" of its datatype for the purpose of the `histogram` function.',
		origin: "vendor-docs",
	},
	isfinite: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "Returns `true` if the date is finite, false otherwise.",
		origin: "vendor-docs",
	},
	isinf: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "Returns `true` if the date is infinite, false otherwise.",
		origin: "vendor-docs",
	},
	isnan: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Returns true if the floating point value is not a number, false otherwise.",
		origin: "vendor-docs",
	},
	isodow: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Numeric ISO weekday (Monday = 1, Sunday = 7).",
		origin: "vendor-docs",
	},
	isoyear: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "ISO Year number (Starts on Monday of week containing Jan 4th).",
		origin: "vendor-docs",
	},
	jaccard: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "The Jaccard similarity between two strings.",
		origin: "vendor-docs",
	},
	jaro_similarity: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "The Jaro similarity between two strings.",
		origin: "vendor-docs",
	},
	jaro_winkler_similarity: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "The Jaro-Winkler similarity between two strings.",
		origin: "vendor-docs",
	},
	julian: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "Extract the Julian Day number from a date.",
		origin: "vendor-docs",
	},
	kurtosis: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The excess kurtosis (Fisher's definition) with bias correction according to the sample size.",
		origin: "vendor-docs",
	},
	kurtosis_pop: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The excess kurtosis (Fisher’s definition) without bias correction.",
		origin: "vendor-docs",
	},
	last: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns the last value of a column.",
		origin: "vendor-docs",
	},
	last_day: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "The last day of the corresponding month in the date.",
		origin: "vendor-docs",
	},
	lcm: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the least common multiple of `x` and `y`.",
		origin: "vendor-docs",
	},
	least: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "The earlier of two dates.",
		origin: "vendor-docs",
	},
	least_common_multiple: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the least common multiple of `x` and `y`.",
		origin: "vendor-docs",
	},
	left: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Extracts the left-most count characters.",
		origin: "vendor-docs",
	},
	left_grapheme: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Extracts the left-most count grapheme clusters.",
		origin: "vendor-docs",
	},
	length: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html",
		description: "Alias for `bit_length`.",
		origin: "vendor-docs",
	},
	length_grapheme: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Number of grapheme clusters in `string`.",
		origin: "vendor-docs",
	},
	levenshtein: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"The minimum number of single-character edits (insertions, deletions or substitutions) required to change one string to the other.",
		origin: "vendor-docs",
	},
	lgamma: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the log of the `gamma` function.",
		origin: "vendor-docs",
	},
	like_escape: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Returns `true` if the `string` matches the `like_specifier` (see Pattern Matching) using case-sensitive matching.",
		origin: "vendor-docs",
	},
	list: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns a `LIST` containing all the values of a column.",
		origin: "vendor-docs",
	},
	list_aggregate: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Executes the aggregate function `function_name` on the elements of `list`.",
		origin: "vendor-docs",
	},
	list_any_value: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `any_value` to the `list`.",
		origin: "vendor-docs",
	},
	list_append: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Appends `element` to `list`.",
		origin: "vendor-docs",
	},
	list_approx_count_distinct: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `approx_count_distinct` to the `list`.",
		origin: "vendor-docs",
	},
	list_avg: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `avg` to the `list`.",
		origin: "vendor-docs",
	},
	list_bit_and: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `bit_and` to the `list`.",
		origin: "vendor-docs",
	},
	list_bit_or: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `bit_or` to the `list`.",
		origin: "vendor-docs",
	},
	list_bit_xor: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `bit_xor` to the `list`.",
		origin: "vendor-docs",
	},
	list_bool_and: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `bool_and` to the `list`.",
		origin: "vendor-docs",
	},
	list_bool_or: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `bool_or` to the `list`.",
		origin: "vendor-docs",
	},
	list_contains: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Returns true if the list contains the element.",
		origin: "vendor-docs",
	},
	list_cosine_distance: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Computes the cosine distance between two same-sized lists.",
		origin: "vendor-docs",
	},
	list_cosine_similarity: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Computes the cosine similarity between two same-sized lists.",
		origin: "vendor-docs",
	},
	list_count: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `count` to the `list`.",
		origin: "vendor-docs",
	},
	list_distance: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description:
			"Calculates the Euclidean distance between two points with coordinates given in two inputs lists of equal length.",
		origin: "vendor-docs",
	},
	list_distinct: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Removes all duplicates and `NULL` values from a list.",
		origin: "vendor-docs",
	},
	list_entropy: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `entropy` to the `list`.",
		origin: "vendor-docs",
	},
	list_extract: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Extract the `index`th (1-based) value from the list.",
		origin: "vendor-docs",
	},
	list_filter: {
		description:
			"Constructs a list from those elements of the input `list` for which the `lambda` function returns `true`.",
		origin: "vendor-docs",
	},
	list_first: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `first` to the `list`.",
		origin: "vendor-docs",
	},
	list_grade_up: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description:
			"Works like `list_sort`, but the results are the indexes that correspond to the position in the original list instead of the actual values.",
		origin: "vendor-docs",
	},
	list_has_all: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Returns true if all elements of list2 are in list1.",
		origin: "vendor-docs",
	},
	list_has_any: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Returns true if the lists have any element in common.",
		origin: "vendor-docs",
	},
	list_histogram: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `histogram` to the `list`.",
		origin: "vendor-docs",
	},
	list_inner_product: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Computes the inner product between two same-sized lists.",
		origin: "vendor-docs",
	},
	list_intersect: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Returns a list of all the elements that exist in both `list1` and `list2`, without duplicates.",
		origin: "vendor-docs",
	},
	list_kurtosis: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `kurtosis` to the `list`.",
		origin: "vendor-docs",
	},
	list_kurtosis_pop: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `kurtosis_pop` to the `list`.",
		origin: "vendor-docs",
	},
	list_last: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `last` to the `list`.",
		origin: "vendor-docs",
	},
	list_mad: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `mad` to the `list`.",
		origin: "vendor-docs",
	},
	list_max: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `max` to the `list`.",
		origin: "vendor-docs",
	},
	list_median: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `median` to the `list`.",
		origin: "vendor-docs",
	},
	list_min: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `min` to the `list`.",
		origin: "vendor-docs",
	},
	list_mode: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `mode` to the `list`.",
		origin: "vendor-docs",
	},
	list_negative_inner_product: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Computes the negative inner product between two same-sized lists.",
		origin: "vendor-docs",
	},
	list_position: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Returns the index of the `element` if the `list` contains the `element`.",
		origin: "vendor-docs",
	},
	list_prepend: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Prepends `element` to `list`.",
		origin: "vendor-docs",
	},
	list_product: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `product` to the `list`.",
		origin: "vendor-docs",
	},
	list_reduce: {
		description:
			"Reduces all elements of the input `list` into a single scalar value by executing the `lambda` function on a running result and the next list element.",
		origin: "vendor-docs",
	},
	list_reverse: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Reverses the `list`.",
		origin: "vendor-docs",
	},
	list_reverse_sort: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Sorts the elements of the list in reverse order.",
		origin: "vendor-docs",
	},
	list_select: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Returns a list based on the elements selected by the `index_list`.",
		origin: "vendor-docs",
	},
	list_sem: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `sem` to the `list`.",
		origin: "vendor-docs",
	},
	list_skewness: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `skewness` to the `list`.",
		origin: "vendor-docs",
	},
	list_slice: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Extracts a sublist or substring using slice conventions.",
		origin: "vendor-docs",
	},
	list_sort: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Sorts the elements of the list.",
		origin: "vendor-docs",
	},
	list_stddev_pop: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `stddev_pop` to the `list`.",
		origin: "vendor-docs",
	},
	list_stddev_samp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `stddev_samp` to the `list`.",
		origin: "vendor-docs",
	},
	list_string_agg: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `string_agg` to the `list`.",
		origin: "vendor-docs",
	},
	list_sum: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `sum` to the `list`.",
		origin: "vendor-docs",
	},
	list_transform: {
		description:
			"Returns a list that is the result of applying the `lambda` function to each element of the input `list`.",
		origin: "vendor-docs",
	},
	list_unique: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Counts the unique elements of a `list`.",
		origin: "vendor-docs",
	},
	list_value: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Creates a LIST containing the argument values.",
		origin: "vendor-docs",
	},
	list_var_pop: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `var_pop` to the `list`.",
		origin: "vendor-docs",
	},
	list_var_samp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Applies aggregate function `var_samp` to the `list`.",
		origin: "vendor-docs",
	},
	list_where: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Returns a list with the `BOOLEAN`s in `mask_list` applied as a mask to the `value_list`.",
		origin: "vendor-docs",
	},
	ln: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the natural logarithm of `x`.",
		origin: "vendor-docs",
	},
	log: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the base-10 log of `x`.",
		origin: "vendor-docs",
	},
	log10: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Alias of `log`. Computes the base-10 log of `x`.",
		origin: "vendor-docs",
	},
	log2: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the base-2 log of `x`.",
		origin: "vendor-docs",
	},
	lower: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Converts `string` to lower case.",
		origin: "vendor-docs",
	},
	lpad: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Pads the `string` with the `character` on the left until it has `count` characters.",
		origin: "vendor-docs",
	},
	ltrim: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Removes any occurrences of any of the `characters` from the left side of the `string`.",
		origin: "vendor-docs",
	},
	mad: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The median absolute deviation.",
		origin: "vendor-docs",
	},
	make_date: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "The date for the given parts.",
		origin: "vendor-docs",
	},
	make_time: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/time.html",
		description: "The time for the given parts.",
		origin: "vendor-docs",
	},
	make_timestamp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html",
		description: "The timestamp for the given parts.",
		origin: "vendor-docs",
	},
	make_timestamp_ms: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html",
		description: "Converts milliseconds since the epoch to a timestamp.",
		origin: "vendor-docs",
	},
	make_timestamp_ns: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html",
		description: "Converts nanoseconds since the epoch to a timestamp.",
		origin: "vendor-docs",
	},
	make_timestamptz: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html",
		description: "The `TIMESTAMP WITH TIME ZONE` for the given parts and time zone.",
		origin: "vendor-docs",
	},
	map_contains: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html",
		description: "Checks if a map contains a given key.",
		origin: "vendor-docs",
	},
	map_contains_entry: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html",
		description: "Check if a map contains a given key-value pair.",
		origin: "vendor-docs",
	},
	map_contains_value: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html",
		description: "Checks if a map contains a given value.",
		origin: "vendor-docs",
	},
	map_entries: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html",
		description: "Return a list of struct(k, v) for each key-value pair in the map.",
		origin: "vendor-docs",
	},
	map_extract: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html",
		description: "Return the value for a given `key` as a list, or `NULL` if the key is not contained in the map.",
		origin: "vendor-docs",
	},
	map_extract_value: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html",
		description: "Returns the value for a given `key` or `NULL` if the `key` is not contained in the map.",
		origin: "vendor-docs",
	},
	map_keys: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html",
		description: "Return a list of all keys in the map.",
		origin: "vendor-docs",
	},
	map_values: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html",
		description: "Return a list of all values in the map.",
		origin: "vendor-docs",
	},
	max: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns the maximum value present in `arg`.",
		origin: "vendor-docs",
	},
	md5: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html",
		description: "Returns the MD5 hash of the `blob` as a `VARCHAR`.",
		origin: "vendor-docs",
	},
	md5_number: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html",
		description: "Returns the MD5 hash of the `blob` as a `HUGEINT`.",
		origin: "vendor-docs",
	},
	md5_number_lower: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Returns the lower 64-bit segment of the MD5 hash of the `string` as a `UBIGINT`.",
		origin: "vendor-docs",
	},
	md5_number_upper: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Returns the upper 64-bit segment of the MD5 hash of the `string` as a `UBIGINT`.",
		origin: "vendor-docs",
	},
	median: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The middle value of the set.",
		origin: "vendor-docs",
	},
	microsecond: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Sub-minute microseconds.",
		origin: "vendor-docs",
	},
	millennium: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Millennium.",
		origin: "vendor-docs",
	},
	millisecond: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Sub-minute milliseconds.",
		origin: "vendor-docs",
	},
	min: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Returns the minimum value present in `arg`.",
		origin: "vendor-docs",
	},
	minute: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Minutes.",
		origin: "vendor-docs",
	},
	mode: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The most frequent value.",
		origin: "vendor-docs",
	},
	month: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Month.",
		origin: "vendor-docs",
	},
	monthname: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "The (English) name of the month.",
		origin: "vendor-docs",
	},
	multiply: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Alias for `x * y`.",
		origin: "vendor-docs",
	},
	nextafter: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Return the next floating point value after `x` in the direction of `y`.",
		origin: "vendor-docs",
	},
	nfc_normalize: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Converts `string` to Unicode NFC normalized string.",
		origin: "vendor-docs",
	},
	not_ilike_escape: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Returns `false` if the `string` matches the `like_specifier` (see Pattern Matching) using case-insensitive matching.",
		origin: "vendor-docs",
	},
	not_like_escape: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Returns `false` if the `string` matches the `like_specifier` (see Pattern Matching) using case-sensitive matching.",
		origin: "vendor-docs",
	},
	now: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html",
		description: "Current date and time (start of current transaction).",
		origin: "vendor-docs",
	},
	nullif: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Return `NULL` if a = b, else return a.",
		origin: "vendor-docs",
	},
	octet_length: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html",
		description: "Returns the number of bytes in the bitstring.",
		origin: "vendor-docs",
	},
	parse_dirname: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Returns the top-level directory name from the given `path`.",
		origin: "vendor-docs",
	},
	parse_dirpath: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Returns the head of the `path` (the pathname until the last slash) similarly to Python's `os.path.dirname`.",
		origin: "vendor-docs",
	},
	parse_filename: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Returns the last component of the `path` similarly to Python's `os.path.basename` function.",
		origin: "vendor-docs",
	},
	parse_formatted_bytes: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Parse a human-readable byte size string (e.g., `'16 KiB'`) into a `UBIGINT` number of bytes.",
		origin: "vendor-docs",
	},
	parse_path: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Returns a list of the components (directories and filename) in the `path` similarly to Python's `pathlib.parts` function.",
		origin: "vendor-docs",
	},
	pg_typeof: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Returns the lower case name of the data type of the result of the expression.",
		origin: "vendor-docs",
	},
	pi: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Returns the value of pi.",
		origin: "vendor-docs",
	},
	pow: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes `x` to the power of `y`.",
		origin: "vendor-docs",
	},
	power: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Alias of `pow`. Computes `x` to the power of `y`.",
		origin: "vendor-docs",
	},
	prefix: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Returns `true` if `string` starts with `search_string`.",
		origin: "vendor-docs",
	},
	printf: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Formats a `string` using printf syntax.",
		origin: "vendor-docs",
	},
	product: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Calculates the product of all non-null values in `arg`.",
		origin: "vendor-docs",
	},
	quantile_cont: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The interpolated `pos`-quantile of `x` for `0 <= pos <= 1`.",
		origin: "vendor-docs",
	},
	quantile_disc: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The discrete `pos`-quantile of `x` for `0 <= pos <= 1`.",
		origin: "vendor-docs",
	},
	quarter: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Quarter.",
		origin: "vendor-docs",
	},
	query: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Table function that parses and executes the query defined in `query_string`.",
		origin: "vendor-docs",
	},
	query_table: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Table function that returns the table given in `tbl_name`.",
		origin: "vendor-docs",
	},
	radians: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Converts degrees to radians.",
		origin: "vendor-docs",
	},
	random: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Returns a random number `x` in the range `0.0 <= x < 1.0`.",
		origin: "vendor-docs",
	},
	range: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Creates a list of values between `start` and `stop` - the stop parameter is exclusive.",
		origin: "vendor-docs",
	},
	read_blob: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html",
		description:
			"Returns the content from `source` (a filename, a list of filenames, or a glob pattern) as a `BLOB`.",
		origin: "vendor-docs",
	},
	read_text: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Returns the content from `source` (a filename, a list of filenames, or a glob pattern) as a `VARCHAR`.",
		origin: "vendor-docs",
	},
	regexp_escape: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Escapes special patterns to turn `string` into a regular expression similarly to Python's `re.escape` function.",
		origin: "vendor-docs",
	},
	regexp_extract: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/regular_expressions.html",
		description:
			"If `string` contains the regexp `pattern`, returns the capturing group specified by optional parameter `group`; otherwise, returns the empty string.",
		origin: "vendor-docs",
	},
	regexp_extract_all: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/regular_expressions.html",
		description:
			"Finds non-overlapping occurrences of `regex` in `string` and returns the corresponding values of `group`.",
		origin: "vendor-docs",
	},
	regexp_full_match: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/regular_expressions.html",
		description: "Returns `true` if the entire `string` matches the `regex`.",
		origin: "vendor-docs",
	},
	regexp_matches: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/regular_expressions.html",
		description: "Returns `true` if `string` contains the regexp `pattern`, `false` otherwise.",
		origin: "vendor-docs",
	},
	regexp_replace: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/regular_expressions.html",
		description: "If `string` contains the regexp `pattern`, replaces the matching part with `replacement`.",
		origin: "vendor-docs",
	},
	regexp_split_to_array: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/regular_expressions.html",
		description: "Alias of `string_split_regex`.",
		origin: "vendor-docs",
	},
	regexp_split_to_table: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/regular_expressions.html",
		description: "Splits the `string` along the `regex` and returns a row for each part.",
		origin: "vendor-docs",
	},
	regr_avgx: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description:
			"The average of the independent variable for non-`NULL` pairs, where x is the independent variable and y is the dependent variable.",
		origin: "vendor-docs",
	},
	regr_avgy: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description:
			"The average of the dependent variable for non-`NULL` pairs, where x is the independent variable and y is the dependent variable.",
		origin: "vendor-docs",
	},
	regr_count: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The number of non-`NULL` pairs.",
		origin: "vendor-docs",
	},
	regr_intercept: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description:
			"The intercept of the univariate linear regression line, where x is the independent variable and y is the dependent variable.",
		origin: "vendor-docs",
	},
	regr_r2: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The squared Pearson correlation coefficient between y and x.",
		origin: "vendor-docs",
	},
	regr_slope: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description:
			"Returns the slope of the linear regression line, where x is the independent variable and y is the dependent variable.",
		origin: "vendor-docs",
	},
	regr_sxx: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description:
			"The sample variance, which includes Bessel's bias correction, of the independent variable for non-`NULL` pairs, where x is the independent variable and y is the dependent variable.",
		origin: "vendor-docs",
	},
	regr_sxy: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The sample covariance, which includes Bessel's bias correction.",
		origin: "vendor-docs",
	},
	regr_syy: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description:
			"The sample variance, which includes Bessel's bias correction, of the dependent variable for non-`NULL` pairs, where x is the independent variable and y is the dependent variable.",
		origin: "vendor-docs",
	},
	repeat: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html",
		description: "Repeats the `blob` `count` number of times.",
		origin: "vendor-docs",
	},
	repeat_row: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Returns a table with `num_rows` rows, each containing the fields defined in `varargs`.",
		origin: "vendor-docs",
	},
	replace: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Replaces any occurrences of the `source` with `target` in `string`.",
		origin: "vendor-docs",
	},
	replace_type: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Recursively casts every field of `value` that has type `source_type` to `target_type`.",
		origin: "vendor-docs",
	},
	reverse: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Reverses the `string`.",
		origin: "vendor-docs",
	},
	right: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Extract the right-most `count` characters.",
		origin: "vendor-docs",
	},
	right_grapheme: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Extracts the right-most `count` grapheme clusters.",
		origin: "vendor-docs",
	},
	round: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Round to `s` decimal places.",
		origin: "vendor-docs",
	},
	round_even: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Alias of `roundbankers(v, s)`.",
		origin: "vendor-docs",
	},
	roundbankers: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Alias of `round_even(v, s)`.",
		origin: "vendor-docs",
	},
	row: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/struct.html",
		description: "Create an unnamed `STRUCT` (tuple) containing the argument values.",
		origin: "vendor-docs",
	},
	rpad: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Pads the `string` with the `character` on the right until it has `count` characters.",
		origin: "vendor-docs",
	},
	rtrim: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Removes any occurrences of any of the `characters` from the right side of the `string`.",
		origin: "vendor-docs",
	},
	second: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Seconds.",
		origin: "vendor-docs",
	},
	sem: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The standard error of the mean.",
		origin: "vendor-docs",
	},
	set_bit: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html",
		description: "Sets the nth bit in bitstring to newvalue; the first (leftmost) bit is indexed 0.",
		origin: "vendor-docs",
	},
	setseed: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Sets the seed to be used for the random function.",
		origin: "vendor-docs",
	},
	sha1: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html",
		description: "Returns a `VARCHAR` with the SHA-1 hash of the `blob`.",
		origin: "vendor-docs",
	},
	sha256: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html",
		description: "Returns a `VARCHAR` with the SHA-256 hash of the `blob`.",
		origin: "vendor-docs",
	},
	sign: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Returns the sign of `x` as -1, 0 or 1.",
		origin: "vendor-docs",
	},
	signbit: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Returns whether the signbit is set or not.",
		origin: "vendor-docs",
	},
	sin: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the sin of `x`.",
		origin: "vendor-docs",
	},
	skewness: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The skewness.",
		origin: "vendor-docs",
	},
	sleep_ms: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Pause execution for the specified number of milliseconds.",
		origin: "vendor-docs",
	},
	split_part: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Splits the `string` along the `separator` and returns the data at the (1-based) `index` of the list.",
		origin: "vendor-docs",
	},
	sqrt: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Returns the square root of the number.",
		origin: "vendor-docs",
	},
	starts_with: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Returns `true` if `string` begins with `search_string`.",
		origin: "vendor-docs",
	},
	stats: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Returns a string with statistics about the expression.",
		origin: "vendor-docs",
	},
	stddev_pop: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The population standard deviation.",
		origin: "vendor-docs",
	},
	stddev_samp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The sample standard deviation.",
		origin: "vendor-docs",
	},
	strftime: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "Converts a date to a string according to the format string.",
		origin: "vendor-docs",
	},
	string_agg: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Concatenates the column string values with a comma separator (`,`).",
		origin: "vendor-docs",
	},
	string_split: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Splits the `string` along the `separator`.",
		origin: "vendor-docs",
	},
	string_split_regex: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Splits the `string` along the `regex`.",
		origin: "vendor-docs",
	},
	strip_accents: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Strips accents from `string`.",
		origin: "vendor-docs",
	},
	strlen: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Number of bytes in `string`.",
		origin: "vendor-docs",
	},
	strptime: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html",
		description:
			"Converts the string `text` to timestamp applying the format strings in the list until one succeeds.",
		origin: "vendor-docs",
	},
	struct_contains: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/struct.html",
		description: "Check if the `STRUCT` contains the specified entry.",
		origin: "vendor-docs",
	},
	struct_extract: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/struct.html",
		description: "Extract the named entry from the `STRUCT`.",
		origin: "vendor-docs",
	},
	struct_extract_at: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/struct.html",
		description: "Extract the entry from a `STRUCT` (tuple) using an index (1-based).",
		origin: "vendor-docs",
	},
	struct_position: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/struct.html",
		description: "Return the index of the entry within the `STRUCT` (1-based), or `NULL` if not found.",
		origin: "vendor-docs",
	},
	struct_values: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/struct.html",
		description: "Return the values of a `STRUCT` as an unnamed `STRUCT` (tuple).",
		origin: "vendor-docs",
	},
	substring: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Extracts substring starting from character `start` up to the end of the string.",
		origin: "vendor-docs",
	},
	substring_grapheme: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Extracts substring starting from grapheme clusters `start` up to the end of the string.",
		origin: "vendor-docs",
	},
	subtract: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Alias for `x - y`.",
		origin: "vendor-docs",
	},
	suffix: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Returns `true` if `string` ends with `search_string`.",
		origin: "vendor-docs",
	},
	sum: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "Calculates the sum of all non-null values in `arg` / counts `true` values when `arg` is boolean.",
		origin: "vendor-docs",
	},
	tan: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Computes the tangent of `x`.",
		origin: "vendor-docs",
	},
	time_bucket: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "Truncate `date` to a grid of width `bucket_width`.",
		origin: "vendor-docs",
	},
	timetz_byte_comparable: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html",
		description: "Converts a `TIME WITH TIME ZONE` to a `UBIGINT` sort key.",
		origin: "vendor-docs",
	},
	timezone: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html",
		description: "Time zone offset in minutes.",
		origin: "vendor-docs",
	},
	timezone_hour: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Time zone offset hour portion.",
		origin: "vendor-docs",
	},
	timezone_minute: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Time zone offset minutes portion.",
		origin: "vendor-docs",
	},
	to_base: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Converts `number` to a string in the given base `radix`, optionally padding with leading zeros to `min_length`.",
		origin: "vendor-docs",
	},
	to_base64: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html",
		description: "Converts a `blob` to a base64 encoded string.",
		origin: "vendor-docs",
	},
	to_centuries: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html",
		description: "Construct a century interval.",
		origin: "vendor-docs",
	},
	to_days: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html",
		description: "Construct a day interval.",
		origin: "vendor-docs",
	},
	to_decades: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html",
		description: "Construct a decade interval.",
		origin: "vendor-docs",
	},
	to_hours: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html",
		description: "Construct an hour interval.",
		origin: "vendor-docs",
	},
	to_microseconds: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html",
		description: "Construct a microsecond interval.",
		origin: "vendor-docs",
	},
	to_millennia: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html",
		description: "Construct a millennium interval.",
		origin: "vendor-docs",
	},
	to_milliseconds: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html",
		description: "Construct a millisecond interval.",
		origin: "vendor-docs",
	},
	to_minutes: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html",
		description: "Construct a minute interval.",
		origin: "vendor-docs",
	},
	to_months: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html",
		description: "Construct a month interval.",
		origin: "vendor-docs",
	},
	to_quarters: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html",
		description: "Construct an interval of `integer` quarters.",
		origin: "vendor-docs",
	},
	to_seconds: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html",
		description: "Construct a second interval.",
		origin: "vendor-docs",
	},
	to_timestamp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html",
		description: "Converts seconds since the epoch to a timestamp with time zone.",
		origin: "vendor-docs",
	},
	to_weeks: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html",
		description: "Construct a week interval.",
		origin: "vendor-docs",
	},
	to_years: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html",
		description: "Construct a year interval.",
		origin: "vendor-docs",
	},
	today: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html",
		description: "Current date (start of current transaction) in the local time zone.",
		origin: "vendor-docs",
	},
	transaction_timestamp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html",
		description: "Current date and time (start of current transaction).",
		origin: "vendor-docs",
	},
	translate: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Replaces each character in `string` that matches a character in the `from` set with the corresponding character in the `to` set.",
		origin: "vendor-docs",
	},
	trim: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Removes any occurrences of any of the `characters` from either side of the `string`.",
		origin: "vendor-docs",
	},
	trunc: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Truncates the number.",
		origin: "vendor-docs",
	},
	try_strptime: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html",
		description:
			"Converts the string `text` to timestamp applying the format strings in the list until one succeeds.",
		origin: "vendor-docs",
	},
	txid_current: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Returns the current transaction's identifier, a `BIGINT` value.",
		origin: "vendor-docs",
	},
	typeof: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Returns the name of the data type of the result of the expression.",
		origin: "vendor-docs",
	},
	unbin: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html",
		description: "Converts a `value` from binary representation to a blob.",
		origin: "vendor-docs",
	},
	unhex: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html",
		description: "Converts a `value` from hexadecimal representation to a blob.",
		origin: "vendor-docs",
	},
	unicode: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description:
			"Returns an `INTEGER` representing the `unicode` codepoint of the first character in the `string`.",
		origin: "vendor-docs",
	},
	union_tag: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/union.html",
		description: "Retrieve the currently selected tag of the union as an Enum.",
		origin: "vendor-docs",
	},
	unnest: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Unnests a list by one level.",
		origin: "vendor-docs",
	},
	unpivot_list: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html",
		description: "Identical to list_value, but generated as part of unpivot for better error messages.",
		origin: "vendor-docs",
	},
	upper: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Converts `string` to upper case.",
		origin: "vendor-docs",
	},
	url_decode: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Decodes a URL from a representation using Percent-Encoding.",
		origin: "vendor-docs",
	},
	url_encode: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html",
		description: "Encodes a URL to a representation using Percent-Encoding.",
		origin: "vendor-docs",
	},
	uuid: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Return a random UUID (UUIDv4) similar to this: `eeccb8c5-9943-b2bb-bb5e-222f4e14b687`.",
		origin: "vendor-docs",
	},
	uuid_extract_timestamp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Extracts `TIMESTAMP WITH TIME ZONE` from a UUIDv7 value.",
		origin: "vendor-docs",
	},
	uuid_extract_version: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Extracts UUID version (`4` or `7`).",
		origin: "vendor-docs",
	},
	uuidv4: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Return a random UUID (UUIDv4) similar to this: `eeccb8c5-9943-b2bb-bb5e-222f4e14b687`.",
		origin: "vendor-docs",
	},
	uuidv7: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Return a random UUIDv7 similar to this: `81964ebe-00b1-7e1d-b0f9-43c29b6fb8f5`.",
		origin: "vendor-docs",
	},
	var_pop: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The population variance, which does not include bias correction.",
		origin: "vendor-docs",
	},
	var_samp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description: "The sample variance, which includes Bessel's bias correction.",
		origin: "vendor-docs",
	},
	version: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html",
		description: "Return the currently active version of DuckDB in this format.",
		origin: "vendor-docs",
	},
	week: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "ISO Week.",
		origin: "vendor-docs",
	},
	weekday: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Numeric weekday synonym (Sunday = 0, Saturday = 6).",
		origin: "vendor-docs",
	},
	weekofyear: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "ISO Week (synonym).",
		origin: "vendor-docs",
	},
	weighted_avg: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html",
		description:
			"Calculates the weighted average of all non-null values in `arg`, where each value is scaled by its corresponding `weight`.",
		origin: "vendor-docs",
	},
	xor: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html",
		description: "Bitwise XOR.",
		origin: "vendor-docs",
	},
	year: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "Year.",
		origin: "vendor-docs",
	},
	yearweek: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html",
		description: "`BIGINT` of combined ISO Year number and 2-digit version of ISO Week number.",
		origin: "vendor-docs",
	},
};
