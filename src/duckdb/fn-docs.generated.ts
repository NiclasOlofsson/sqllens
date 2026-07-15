// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for duckdb (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-15. 410 names (409 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const DUCKDB_FN_DOCS: Record<string, FnDoc> = {
	abs: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#absx",
		description: "Absolute value.",
		origin: "vendor-docs",
	},
	acos: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#acosx",
		description: "Computes the inverse cosine of `x`.",
		origin: "vendor-docs",
	},
	acosh: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#acoshx",
		description: "Computes the inverse hyperbolic cosine of `x`.",
		origin: "vendor-docs",
	},
	add: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#addx-y",
		description: "Alias for `x + y`.",
		origin: "vendor-docs",
	},
	age: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html#agetimestamp-timestamp",
		description: "Subtract arguments, resulting in the time difference between the two timestamps.",
		origin: "vendor-docs",
	},
	ago: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html#agointerval",
		description: "Subtracts an interval from the current timestamp, returning a timestamp in the past.",
		origin: "vendor-docs",
	},
	alias: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#aliascolumn",
		description: "Return the name of the column.",
		origin: "vendor-docs",
	},
	any_value: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#any_valuearg",
		description: "Returns the first non-`NULL` value from `arg`.",
		origin: "vendor-docs",
	},
	arg_max: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#arg_maxarg-val",
		description: "Finds the row with the maximum `val` and calculates the `arg` expression at that row.",
		origin: "vendor-docs",
	},
	arg_max_null: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#arg_max_nullarg-val",
		description: "Finds the row with the maximum `val` and calculates the `arg` expression at that row.",
		origin: "vendor-docs",
	},
	arg_min: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#arg_minarg-val",
		description: "Finds the row with the minimum `val` and calculates the `arg` expression at that row.",
		origin: "vendor-docs",
	},
	arg_min_null: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#arg_min_nullarg-val",
		description: "Finds the row with the minimum `val` and calculates the `arg` expression at that row.",
		origin: "vendor-docs",
	},
	array_cosine_distance: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/array.html#array_cosine_distancearray1-array2",
		description: "Computes the cosine distance between two arrays of the same size.",
		origin: "vendor-docs",
	},
	array_cosine_similarity: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/array.html#array_cosine_similarityarray1-array2",
		description: "Computes the cosine similarity between two arrays of the same size.",
		origin: "vendor-docs",
	},
	array_cross_product: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/array.html#array_cross_productarray-array",
		description: "Computes the cross product of two arrays of size 3.",
		origin: "vendor-docs",
	},
	array_distance: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/array.html#array_distancearray1-array2",
		description: "Computes the distance between two arrays of the same size.",
		origin: "vendor-docs",
	},
	array_extract: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#array_extractlist-index",
		description: "Extracts the `index`th (1-based) value from the `list`.",
		origin: "vendor-docs",
	},
	array_inner_product: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/array.html#array_inner_productarray1-array2",
		description: "Computes the inner product between two arrays of the same size.",
		origin: "vendor-docs",
	},
	array_negative_inner_product: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/array.html#array_negative_inner_productarray1-array2",
		description: "Computes the negative inner product between two arrays of the same size.",
		origin: "vendor-docs",
	},
	array_pop_back: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#array_pop_backlist",
		description: "Returns the `list` without the last element.",
		origin: "vendor-docs",
	},
	array_pop_front: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#array_pop_frontlist",
		description: "Returns the `list` without the first element.",
		origin: "vendor-docs",
	},
	array_push_front: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#array_push_frontlist-element",
		description: "Prepends `element` to `list`.",
		origin: "vendor-docs",
	},
	array_slice: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#array_slicelist-begin-end",
		description: "Extracts a sublist or substring using slice conventions.",
		origin: "vendor-docs",
	},
	array_to_string: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#array_to_stringlist-delimiter",
		description: "Concatenates list/array elements using an optional `delimiter`.",
		origin: "vendor-docs",
	},
	array_to_string_comma_default: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#array_to_string_comma_defaultarray",
		description: "Concatenates list/array elements with a comma delimiter.",
		origin: "vendor-docs",
	},
	array_value: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/array.html#array_valuearg-",
		description: "Creates an `ARRAY` containing the argument values.",
		origin: "vendor-docs",
	},
	ascii: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#asciistring",
		description:
			"Returns an integer that represents the Unicode code point of the first character of the `string`.",
		origin: "vendor-docs",
	},
	asin: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#asinx",
		description: "Computes the inverse sine of `x`.",
		origin: "vendor-docs",
	},
	asinh: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#asinhx",
		description: "Computes the inverse hyperbolic sine of `x`.",
		origin: "vendor-docs",
	},
	atan: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#atanx",
		description: "Computes the inverse tangent of `x`.",
		origin: "vendor-docs",
	},
	atan2: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#atan2y-x",
		description: "Computes the inverse tangent (y, x).",
		origin: "vendor-docs",
	},
	atanh: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#atanhx",
		description: "Computes the inverse hyperbolic tangent of `x`.",
		origin: "vendor-docs",
	},
	avg: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#avgarg",
		description: "Calculates the average of all non-null values in `arg`.",
		origin: "vendor-docs",
	},
	bar: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#barx-min-max-width",
		description:
			"Draws a band whose width is proportional to (`x - min`) and equal to `width` characters when `x` = `max`.",
		origin: "vendor-docs",
	},
	bin: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#binstring",
		description: "Converts the `string` to binary representation.",
		origin: "vendor-docs",
	},
	bit_and: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#bit_andarg",
		description: "Returns the bitwise `AND` of all bits in a given expression.",
		origin: "vendor-docs",
	},
	bit_count: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html#bit_countbitstring",
		description: "Returns the number of set bits in the bitstring.",
		origin: "vendor-docs",
	},
	bit_length: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html#bit_lengthbitstring",
		description: "Returns the number of bits in the bitstring.",
		origin: "vendor-docs",
	},
	bit_or: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#bit_orarg",
		description: "Returns the bitwise `OR` of all bits in a given expression.",
		origin: "vendor-docs",
	},
	bit_position: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html#bit_positionsubstring-bitstring",
		description:
			"Returns first starting index of the specified substring within bits, or zero if it's not present.",
		origin: "vendor-docs",
	},
	bit_xor: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#bit_xorarg",
		description: "Returns the bitwise `XOR` of all bits in a given expression.",
		origin: "vendor-docs",
	},
	bitstring: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html#bitstringbitstring-length",
		description: "Returns a bitstring of determined length.",
		origin: "vendor-docs",
	},
	bitstring_agg: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html#bitstring_aggarg",
		description:
			"Returns a bitstring whose length corresponds to the range of the non-null (integer) values, with bits set at the location of each (distinct) value.",
		origin: "vendor-docs",
	},
	bool_and: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#bool_andarg",
		description: "Returns `true` if every input value is `true`, otherwise `false`.",
		origin: "vendor-docs",
	},
	bool_or: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#bool_orarg",
		description: "Returns `true` if any input value is `true`, otherwise `false`.",
		origin: "vendor-docs",
	},
	can_cast_implicitly: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#can_cast_implicitlysource_value-target_value",
		description: "Whether or not we can implicitly cast from the types of the source value to the target value.",
		origin: "vendor-docs",
	},
	cardinality: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html#cardinalitymap",
		description: "Return the size of the map (or the number of entries in the map).",
		origin: "vendor-docs",
	},
	cbrt: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#cbrtx",
		description: "Returns the cube root of the number.",
		origin: "vendor-docs",
	},
	ceil: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#ceilx",
		description: "Rounds the number up.",
		origin: "vendor-docs",
	},
	ceiling: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#ceilingx",
		description: "Rounds the number up.",
		origin: "vendor-docs",
	},
	century: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#centurydate",
		description: "Century.",
		origin: "vendor-docs",
	},
	checkpoint: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#checkpointdatabase",
		description: "Synchronize WAL with file for (optional) database without interrupting transactions.",
		origin: "vendor-docs",
	},
	chr: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#chrcode_point",
		description: "Returns a character which is corresponding the ASCII code value or Unicode code point.",
		origin: "vendor-docs",
	},
	coalesce: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#coalesceexpr-",
		description: "Return the first expression that evaluates to a non-`NULL` value.",
		origin: "vendor-docs",
	},
	concat: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#concatvalue-",
		description: "Concatenates multiple strings or lists.",
		origin: "vendor-docs",
	},
	concat_ws: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#concat_wsseparator-string-",
		description: "Concatenates many strings, separated by `separator`.",
		origin: "vendor-docs",
	},
	constant_or_null: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#constant_or_nullarg1-arg2",
		description: "If `arg2` is `NULL`, return `NULL`.",
		origin: "vendor-docs",
	},
	contains: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#containslist-element",
		description: "Returns `true` if the `list` contains the `element`.",
		origin: "vendor-docs",
	},
	corr: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#corry-x",
		description: "The correlation coefficient.",
		origin: "vendor-docs",
	},
	cos: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#cosx",
		description: "Computes the cosine of `x`.",
		origin: "vendor-docs",
	},
	cot: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#cotx",
		description: "Computes the cotangent of `x`.",
		origin: "vendor-docs",
	},
	count: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#count",
		description: "Returns the number of rows.",
		origin: "vendor-docs",
	},
	count_if: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#count_ifx",
		description: "Aggregate function; rows contribute 1 if `x` is `true` or a non-zero number, else 0.",
		origin: "vendor-docs",
	},
	countif: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#countifarg",
		description: "Returns the number of rows where `arg` is `true`.",
		origin: "vendor-docs",
	},
	covar_pop: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#covar_popy-x",
		description: "The population covariance, which does not include bias correction.",
		origin: "vendor-docs",
	},
	covar_samp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#covar_sampy-x",
		description: "The sample covariance, which includes Bessel's bias correction.",
		origin: "vendor-docs",
	},
	current_catalog: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#current_catalog",
		description: "Return the name of the currently active catalog.",
		origin: "vendor-docs",
	},
	current_database: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#current_database",
		description: "Return the name of the currently active database.",
		origin: "vendor-docs",
	},
	current_localtime: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html#current_localtime",
		description: "Returns a `TIME` whose GMT bin values correspond to local time in the current time zone.",
		origin: "vendor-docs",
	},
	current_localtimestamp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html#current_localtimestamp",
		description: "Returns the current timestamp with time zone (at the start of the transaction).",
		origin: "vendor-docs",
	},
	current_query: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#current_query",
		description: "Return the current query as a string.",
		origin: "vendor-docs",
	},
	current_schema: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#current_schema",
		description: "Return the name of the currently active schema.",
		origin: "vendor-docs",
	},
	current_schemas: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#current_schemasboolean",
		description: "Return list of schemas.",
		origin: "vendor-docs",
	},
	damerau_levenshtein: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#damerau_levenshteins1-s2",
		description:
			"Extension of Levenshtein distance to also include transposition of adjacent characters as an allowed edit operation.",
		origin: "vendor-docs",
	},
	date_add: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#date_adddate-interval",
		description: "Add the interval to the date and return a `DATETIME` value.",
		origin: "vendor-docs",
	},
	date_diff: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#date_diffpart-startdate-enddate",
		description:
			"The number of `part` boundaries between `startdate` and `enddate`, inclusive of the larger date and exclusive of the smaller date.",
		origin: "vendor-docs",
	},
	date_part: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#date_partpart-date",
		description: "Get the subfield (equivalent to `extract`).",
		origin: "vendor-docs",
	},
	date_sub: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#date_subpart-startdate-enddate",
		description:
			"The signed length of the interval between `startdate` and `enddate`, truncated to whole multiples of `part`.",
		origin: "vendor-docs",
	},
	date_trunc: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#date_truncpart-date",
		description: "Truncate to specified precision.",
		origin: "vendor-docs",
	},
	datepart: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html#datepartpart-interval",
		description: "Alias of `date_part`.",
		origin: "vendor-docs",
	},
	day: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#daydate",
		description: "Day.",
		origin: "vendor-docs",
	},
	dayname: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#daynamedate",
		description: "The (English) name of the weekday.",
		origin: "vendor-docs",
	},
	dayofmonth: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#dayofmonthdate",
		description: "Day (synonym).",
		origin: "vendor-docs",
	},
	dayofweek: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#dayofweekdate",
		description: "Numeric weekday (Sunday = 0, Saturday = 6).",
		origin: "vendor-docs",
	},
	dayofyear: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#dayofyeardate",
		description: "Day of the year (starts from 1, i.e., January 1 = 1).",
		origin: "vendor-docs",
	},
	days_in_month: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#days_in_monthdate",
		description: "The number of days in the month of the given date.",
		origin: "vendor-docs",
	},
	decade: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#decadedate",
		description: "Decade (year / 10).",
		origin: "vendor-docs",
	},
	decode: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html#decodeblob-on_error",
		description: "Converts `blob` to `VARCHAR`.",
		origin: "vendor-docs",
	},
	degrees: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#degreesx",
		description: "Converts radians to degrees.",
		origin: "vendor-docs",
	},
	dense_rank: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/window_functions.html#dense_rank",
		description: "The rank of the current row *without gaps;* this function counts peer groups.",
		origin: "vendor-docs",
	},
	divide: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#dividex-y",
		description: "Alias for `x // y`.",
		origin: "vendor-docs",
	},
	element_at: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html#element_atmap-key",
		description:
			"Return the value for a given `key` as a list, or an empty list if the key is not contained in the map.",
		origin: "vendor-docs",
	},
	encode: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html#encodestring",
		description: "Converts the `string` to `BLOB`.",
		origin: "vendor-docs",
	},
	entropy: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#entropyx",
		description: "The log-2 entropy of count input-values.",
		origin: "vendor-docs",
	},
	enum_code: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/enum.html#enum_codeenum_value",
		description: "Returns the numeric value backing the given enum value.",
		origin: "vendor-docs",
	},
	enum_first: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/enum.html#enum_firstenum",
		description: "Returns the first value of the input enum type.",
		origin: "vendor-docs",
	},
	enum_last: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/enum.html#enum_lastenum",
		description: "Returns the last value of the input enum type.",
		origin: "vendor-docs",
	},
	enum_range: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/enum.html#enum_rangeenum",
		description: "Returns all values of the input enum type as an array.",
		origin: "vendor-docs",
	},
	enum_range_boundary: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/enum.html#enum_range_boundaryenum-enum",
		description: "Returns the range between the two given enum values as an array.",
		origin: "vendor-docs",
	},
	epoch: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#epochdate",
		description: "Seconds since 1970-01-01.",
		origin: "vendor-docs",
	},
	epoch_ms: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html#epoch_mstimestamp",
		description: "Returns the total number of milliseconds since the epoch.",
		origin: "vendor-docs",
	},
	epoch_ns: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html#epoch_nstimestamp",
		description: "Returns the total number of nanoseconds since the epoch.",
		origin: "vendor-docs",
	},
	epoch_us: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html#epoch_ustimestamp",
		description: "Returns the total number of microseconds since the epoch.",
		origin: "vendor-docs",
	},
	era: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#eradate",
		description: "Calendar era.",
		origin: "vendor-docs",
	},
	error: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#errormessage",
		description: "Throws the given error `message`.",
		origin: "vendor-docs",
	},
	even: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#evenx",
		description: "Round to next even number by rounding away from zero.",
		origin: "vendor-docs",
	},
	exp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#expx",
		description: "Computes `e ** x`.",
		origin: "vendor-docs",
	},
	factorial: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#factorialx",
		description: "See the `!` operator.",
		origin: "vendor-docs",
	},
	favg: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#favgarg",
		description: "Calculates the average using a more accurate floating point summation (Kahan Sum).",
		origin: "vendor-docs",
	},
	fdiv: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#fdivx-y",
		description: "Performs integer division (`x // y`) but returns a `DOUBLE` value.",
		origin: "vendor-docs",
	},
	first: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#firstarg",
		description: "Returns the first value (null or non-null) from `arg`.",
		origin: "vendor-docs",
	},
	flatten: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#flattennested_list",
		description: "Flattens a nested list by one level.",
		origin: "vendor-docs",
	},
	floor: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#floorx",
		description: "Rounds the number down.",
		origin: "vendor-docs",
	},
	fmod: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#fmodx-y",
		description: "Calculates the modulo value.",
		origin: "vendor-docs",
	},
	force_checkpoint: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#force_checkpointdatabase",
		description: "Synchronize WAL with file for (optional) database interrupting transactions.",
		origin: "vendor-docs",
	},
	format: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#formatformat-",
		description: "Formats a string using the fmt syntax.",
		origin: "vendor-docs",
	},
	format_bytes: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#format_bytesinteger",
		description:
			"Converts `integer` to a human-readable representation using units based on powers of 2 (KiB, MiB, GiB, etc.).",
		origin: "vendor-docs",
	},
	formatreadabledecimalsize: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#formatreadabledecimalsizeinteger",
		description:
			"Converts `integer` to a human-readable representation using units based on powers of 10 (KB, MB, GB, etc.).",
		origin: "vendor-docs",
	},
	from_base64: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html#from_base64string",
		description: "Converts a base64 encoded `string` to a character string (`BLOB`).",
		origin: "vendor-docs",
	},
	fsum: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#fsumarg",
		description: "Calculates the sum using a more accurate floating point summation (Kahan Sum).",
		origin: "vendor-docs",
	},
	gamma: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#gammax",
		description: "Interpolation of the factorial of `x - 1`.",
		origin: "vendor-docs",
	},
	gcd: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#gcdx-y",
		description: "Computes the greatest common divisor of `x` and `y`.",
		origin: "vendor-docs",
	},
	gen_random_uuid: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#gen_random_uuid",
		description: "Return a random UUID (UUIDv4) similar to this: `eeccb8c5-9943-b2bb-bb5e-222f4e14b687`.",
		origin: "vendor-docs",
	},
	generate_series: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#generate_seriesstart-stop-step",
		description: "Creates a list of values between `start` and `stop` - the stop parameter is inclusive.",
		origin: "vendor-docs",
	},
	generate_subscripts: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#generate_subscriptsarr-dim",
		origin: "vendor-docs",
	},
	geometric_mean: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#geometric_meanarg",
		description: "Calculates the geometric mean of all non-null values in `arg`.",
		origin: "vendor-docs",
	},
	get_bit: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html#get_bitbitstring-index",
		description: "Extracts the nth bit from bitstring; the first (leftmost) bit is indexed 0.",
		origin: "vendor-docs",
	},
	get_current_time: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/time.html#get_current_time",
		description: "Current time (start of current transaction) in the local time zone as `TIMETZ`.",
		origin: "vendor-docs",
	},
	get_current_timestamp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html#get_current_timestamp",
		description: "Current date and time (start of current transaction).",
		origin: "vendor-docs",
	},
	getenv: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#getenvvar",
		description: "Returns the value of the environment variable `var`.",
		origin: "vendor-docs",
	},
	glob: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#globsearch_path",
		description:
			"Return filenames found at the location indicated by the *search_path* in a single column named `file`.",
		origin: "vendor-docs",
	},
	greatest: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#greatestdate-date",
		description: "The later of two dates.",
		origin: "vendor-docs",
	},
	greatest_common_divisor: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#greatest_common_divisorx-y",
		description: "Computes the greatest common divisor of `x` and `y`.",
		origin: "vendor-docs",
	},
	hamming: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#hammings1-s2",
		description:
			"The Hamming distance between two strings, i.e., the number of positions with different characters for two strings of equal length.",
		origin: "vendor-docs",
	},
	hash: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#hashvalue-",
		description: "Returns a `UBIGINT` with the hash of the `value`.",
		origin: "vendor-docs",
	},
	hex: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html#hexblob",
		description: "Converts `blob` to `VARCHAR` using hexadecimal encoding.",
		origin: "vendor-docs",
	},
	histogram: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#histogramarg",
		description: "Returns a `MAP` of key-value pairs representing buckets and counts.",
		origin: "vendor-docs",
	},
	histogram_exact: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#histogram_exactarg-elements",
		description: "Returns a `MAP` of key-value pairs representing the requested elements and their counts.",
		origin: "vendor-docs",
	},
	histogram_values: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#histogram_valuessource-col_name-technique-bin_count",
		description: "Returns the upper boundaries of the bins and their counts.",
		origin: "vendor-docs",
	},
	hour: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#hourdate",
		description: "Hours.",
		origin: "vendor-docs",
	},
	icu_sort_key: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#icu_sort_keystring-collator",
		description: "Surrogate sort key used to sort special characters according to the specific locale.",
		origin: "vendor-docs",
	},
	if: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#ifa-b-c",
		description: "Ternary conditional operator; returns b if a, else returns c.",
		origin: "vendor-docs",
	},
	ifnull: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#ifnullexpr-other",
		description: "A two-argument version of coalesce.",
		origin: "vendor-docs",
	},
	ilike_escape: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#ilike_escapestring-like_specifier-escape_character",
		description:
			"Returns `true` if the `string` matches the `like_specifier` (see Pattern Matching) using case-insensitive matching.",
		origin: "vendor-docs",
	},
	instr: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#instrstring-search_string",
		description: "Returns location of first occurrence of `search_string` in `string`, counting from 1.",
		origin: "vendor-docs",
	},
	is_histogram_other_bin: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#is_histogram_other_binarg",
		description:
			'Returns `true` when `arg` is the "catch-all element" of its datatype for the purpose of the `histogram_exact` function, which is equal to the "right-most boundary" of its datatype for the purpose of the `histogram` function.',
		origin: "vendor-docs",
	},
	isfinite: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#isfinitedate",
		description: "Returns `true` if the date is finite, false otherwise.",
		origin: "vendor-docs",
	},
	isinf: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#isinfdate",
		description: "Returns `true` if the date is infinite, false otherwise.",
		origin: "vendor-docs",
	},
	isnan: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#isnanx",
		description: "Returns true if the floating point value is not a number, false otherwise.",
		origin: "vendor-docs",
	},
	isodow: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#isodowdate",
		description: "Numeric ISO weekday (Monday = 1, Sunday = 7).",
		origin: "vendor-docs",
	},
	isoyear: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#isoyeardate",
		description: "ISO Year number (Starts on Monday of week containing Jan 4th).",
		origin: "vendor-docs",
	},
	jaccard: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#jaccards1-s2",
		description: "The Jaccard similarity between two strings.",
		origin: "vendor-docs",
	},
	jaro_similarity: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#jaro_similaritys1-s2-score_cutoff",
		description: "The Jaro similarity between two strings.",
		origin: "vendor-docs",
	},
	jaro_winkler_similarity: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#jaro_winkler_similaritys1-s2-score_cutoff",
		description: "The Jaro-Winkler similarity between two strings.",
		origin: "vendor-docs",
	},
	julian: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#juliandate",
		description: "Extract the Julian Day number from a date.",
		origin: "vendor-docs",
	},
	kurtosis: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#kurtosisx",
		description: "The excess kurtosis (Fisher's definition) with bias correction according to the sample size.",
		origin: "vendor-docs",
	},
	kurtosis_pop: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#kurtosis_popx",
		description: "The excess kurtosis (Fisher’s definition) without bias correction.",
		origin: "vendor-docs",
	},
	last: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#lastarg",
		description: "Returns the last value of a column.",
		origin: "vendor-docs",
	},
	last_day: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#last_daydate",
		description: "The last day of the corresponding month in the date.",
		origin: "vendor-docs",
	},
	lcm: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#lcmx-y",
		description: "Computes the least common multiple of `x` and `y`.",
		origin: "vendor-docs",
	},
	least: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#leastdate-date",
		description: "The earlier of two dates.",
		origin: "vendor-docs",
	},
	least_common_multiple: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#least_common_multiplex-y",
		description: "Computes the least common multiple of `x` and `y`.",
		origin: "vendor-docs",
	},
	left: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#leftstring-count",
		description: "Extracts the left-most count characters.",
		origin: "vendor-docs",
	},
	left_grapheme: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#left_graphemestring-count",
		description: "Extracts the left-most count grapheme clusters.",
		origin: "vendor-docs",
	},
	length: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html#lengthbitstring",
		description: "Alias for `bit_length`.",
		origin: "vendor-docs",
	},
	length_grapheme: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#length_graphemestring",
		description: "Number of grapheme clusters in `string`.",
		origin: "vendor-docs",
	},
	levenshtein: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#levenshteins1-s2",
		description:
			"The minimum number of single-character edits (insertions, deletions or substitutions) required to change one string to the other.",
		origin: "vendor-docs",
	},
	lgamma: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#lgammax",
		description: "Computes the log of the `gamma` function.",
		origin: "vendor-docs",
	},
	like_escape: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#like_escapestring-like_specifier-escape_character",
		description:
			"Returns `true` if the `string` matches the `like_specifier` (see Pattern Matching) using case-sensitive matching.",
		origin: "vendor-docs",
	},
	list: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#listarg",
		description: "Returns a `LIST` containing all the values of a column.",
		origin: "vendor-docs",
	},
	list_aggregate: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_aggregatelist-function_name-",
		description: "Executes the aggregate function `function_name` on the elements of `list`.",
		origin: "vendor-docs",
	},
	list_any_value: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_any_valuelist",
		description: "Applies aggregate function `any_value` to the `list`.",
		origin: "vendor-docs",
	},
	list_append: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_appendlist-element",
		description: "Appends `element` to `list`.",
		origin: "vendor-docs",
	},
	list_approx_count_distinct: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_approx_count_distinctlist",
		description: "Applies aggregate function `approx_count_distinct` to the `list`.",
		origin: "vendor-docs",
	},
	list_avg: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_avglist",
		description: "Applies aggregate function `avg` to the `list`.",
		origin: "vendor-docs",
	},
	list_bit_and: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_bit_andlist",
		description: "Applies aggregate function `bit_and` to the `list`.",
		origin: "vendor-docs",
	},
	list_bit_or: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_bit_orlist",
		description: "Applies aggregate function `bit_or` to the `list`.",
		origin: "vendor-docs",
	},
	list_bit_xor: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_bit_xorlist",
		description: "Applies aggregate function `bit_xor` to the `list`.",
		origin: "vendor-docs",
	},
	list_bool_and: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_bool_andlist",
		description: "Applies aggregate function `bool_and` to the `list`.",
		origin: "vendor-docs",
	},
	list_bool_or: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_bool_orlist",
		description: "Applies aggregate function `bool_or` to the `list`.",
		origin: "vendor-docs",
	},
	list_contains: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_containslist-element",
		description: "Returns true if the list contains the element.",
		origin: "vendor-docs",
	},
	list_cosine_distance: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_cosine_distancelist1-list2",
		description: "Computes the cosine distance between two same-sized lists.",
		origin: "vendor-docs",
	},
	list_cosine_similarity: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_cosine_similaritylist1-list2",
		description: "Computes the cosine similarity between two same-sized lists.",
		origin: "vendor-docs",
	},
	list_count: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_countlist",
		description: "Applies aggregate function `count` to the `list`.",
		origin: "vendor-docs",
	},
	list_distance: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_distancelist1-list2",
		description:
			"Calculates the Euclidean distance between two points with coordinates given in two inputs lists of equal length.",
		origin: "vendor-docs",
	},
	list_distinct: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_distinctlist",
		description: "Removes all duplicates and `NULL` values from a list.",
		origin: "vendor-docs",
	},
	list_entropy: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_entropylist",
		description: "Applies aggregate function `entropy` to the `list`.",
		origin: "vendor-docs",
	},
	list_extract: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_extractlist-index",
		description: "Extract the `index`th (1-based) value from the list.",
		origin: "vendor-docs",
	},
	list_filter: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_filterlist-lambdax",
		description:
			"Constructs a list from those elements of the input `list` for which the `lambda` function returns `true`.",
		origin: "vendor-docs",
	},
	list_first: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_firstlist",
		description: "Applies aggregate function `first` to the `list`.",
		origin: "vendor-docs",
	},
	list_grade_up: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_grade_uplist-col1-col2",
		description:
			"Works like `list_sort`, but the results are the indexes that correspond to the position in the original list instead of the actual values.",
		origin: "vendor-docs",
	},
	list_has_all: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_has_alllist1-list2",
		description: "Returns true if all elements of list2 are in list1.",
		origin: "vendor-docs",
	},
	list_has_any: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_has_anylist1-list2",
		description: "Returns true if the lists have any element in common.",
		origin: "vendor-docs",
	},
	list_histogram: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_histogramlist",
		description: "Applies aggregate function `histogram` to the `list`.",
		origin: "vendor-docs",
	},
	list_inner_product: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_inner_productlist1-list2",
		description: "Computes the inner product between two same-sized lists.",
		origin: "vendor-docs",
	},
	list_intersect: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_intersectlist1-list2",
		description: "Returns a list of all the elements that exist in both `list1` and `list2`, without duplicates.",
		origin: "vendor-docs",
	},
	list_kurtosis: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_kurtosislist",
		description: "Applies aggregate function `kurtosis` to the `list`.",
		origin: "vendor-docs",
	},
	list_kurtosis_pop: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_kurtosis_poplist",
		description: "Applies aggregate function `kurtosis_pop` to the `list`.",
		origin: "vendor-docs",
	},
	list_last: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_lastlist",
		description: "Applies aggregate function `last` to the `list`.",
		origin: "vendor-docs",
	},
	list_mad: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_madlist",
		description: "Applies aggregate function `mad` to the `list`.",
		origin: "vendor-docs",
	},
	list_max: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_maxlist",
		description: "Applies aggregate function `max` to the `list`.",
		origin: "vendor-docs",
	},
	list_median: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_medianlist",
		description: "Applies aggregate function `median` to the `list`.",
		origin: "vendor-docs",
	},
	list_min: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_minlist",
		description: "Applies aggregate function `min` to the `list`.",
		origin: "vendor-docs",
	},
	list_mode: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_modelist",
		description: "Applies aggregate function `mode` to the `list`.",
		origin: "vendor-docs",
	},
	list_negative_inner_product: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_negative_inner_productlist1-list2",
		description: "Computes the negative inner product between two same-sized lists.",
		origin: "vendor-docs",
	},
	list_position: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_positionlist-element",
		description: "Returns the index of the `element` if the `list` contains the `element`.",
		origin: "vendor-docs",
	},
	list_prepend: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_prependelement-list",
		description: "Prepends `element` to `list`.",
		origin: "vendor-docs",
	},
	list_product: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_productlist",
		description: "Applies aggregate function `product` to the `list`.",
		origin: "vendor-docs",
	},
	list_reduce: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_reducelist-lambdaxy-initial_value",
		description:
			"Reduces all elements of the input `list` into a single scalar value by executing the `lambda` function on a running result and the next list element.",
		origin: "vendor-docs",
	},
	list_reverse: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_reverselist",
		description: "Reverses the `list`.",
		origin: "vendor-docs",
	},
	list_reverse_sort: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_reverse_sortlist-col1",
		description: "Sorts the elements of the list in reverse order.",
		origin: "vendor-docs",
	},
	list_select: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_selectvalue_list-index_list",
		description: "Returns a list based on the elements selected by the `index_list`.",
		origin: "vendor-docs",
	},
	list_sem: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_semlist",
		description: "Applies aggregate function `sem` to the `list`.",
		origin: "vendor-docs",
	},
	list_skewness: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_skewnesslist",
		description: "Applies aggregate function `skewness` to the `list`.",
		origin: "vendor-docs",
	},
	list_slice: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_slicelist-begin-end",
		description: "Extracts a sublist or substring using slice conventions.",
		origin: "vendor-docs",
	},
	list_sort: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_sortlist-col1-col2",
		description: "Sorts the elements of the list.",
		origin: "vendor-docs",
	},
	list_stddev_pop: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_stddev_poplist",
		description: "Applies aggregate function `stddev_pop` to the `list`.",
		origin: "vendor-docs",
	},
	list_stddev_samp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_stddev_samplist",
		description: "Applies aggregate function `stddev_samp` to the `list`.",
		origin: "vendor-docs",
	},
	list_string_agg: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_string_agglist",
		description: "Applies aggregate function `string_agg` to the `list`.",
		origin: "vendor-docs",
	},
	list_sum: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_sumlist",
		description: "Applies aggregate function `sum` to the `list`.",
		origin: "vendor-docs",
	},
	list_transform: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_transformlist-lambdax",
		description:
			"Returns a list that is the result of applying the `lambda` function to each element of the input `list`.",
		origin: "vendor-docs",
	},
	list_unique: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_uniquelist",
		description: "Counts the unique elements of a `list`.",
		origin: "vendor-docs",
	},
	list_value: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_valuearg-",
		description: "Creates a LIST containing the argument values.",
		origin: "vendor-docs",
	},
	list_var_pop: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_var_poplist",
		description: "Applies aggregate function `var_pop` to the `list`.",
		origin: "vendor-docs",
	},
	list_var_samp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_var_samplist",
		description: "Applies aggregate function `var_samp` to the `list`.",
		origin: "vendor-docs",
	},
	list_where: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#list_wherevalue_list-mask_list",
		description: "Returns a list with the `BOOLEAN`s in `mask_list` applied as a mask to the `value_list`.",
		origin: "vendor-docs",
	},
	ln: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#lnx",
		description: "Computes the natural logarithm of `x`.",
		origin: "vendor-docs",
	},
	log: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#logx",
		description: "Computes the base-10 log of `x`.",
		origin: "vendor-docs",
	},
	log10: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#log10x",
		description: "Alias of `log`. Computes the base-10 log of `x`.",
		origin: "vendor-docs",
	},
	log2: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#log2x",
		description: "Computes the base-2 log of `x`.",
		origin: "vendor-docs",
	},
	lower: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#lowerstring",
		description: "Converts `string` to lower case.",
		origin: "vendor-docs",
	},
	lpad: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#lpadstring-count-character",
		description: "Pads the `string` with the `character` on the left until it has `count` characters.",
		origin: "vendor-docs",
	},
	ltrim: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#ltrimstring-characters",
		description: "Removes any occurrences of any of the `characters` from the left side of the `string`.",
		origin: "vendor-docs",
	},
	mad: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#madx",
		description: "The median absolute deviation.",
		origin: "vendor-docs",
	},
	make_date: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#make_dateyear-month-day",
		description: "The date for the given parts.",
		origin: "vendor-docs",
	},
	make_time: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/time.html#make_timebigint-bigint-double",
		description: "The time for the given parts.",
		origin: "vendor-docs",
	},
	make_timestamp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html#make_timestampbigint-bigint-bigint-bigint-bigint-double",
		description: "The timestamp for the given parts.",
		origin: "vendor-docs",
	},
	make_timestamp_ms: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html#make_timestamp_msmilliseconds",
		description: "Converts milliseconds since the epoch to a timestamp.",
		origin: "vendor-docs",
	},
	make_timestamp_ns: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html#make_timestamp_nsnanoseconds",
		description: "Converts nanoseconds since the epoch to a timestamp.",
		origin: "vendor-docs",
	},
	make_timestamptz: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html#make_timestamptzbigint-bigint-bigint-bigint-bigint-double-string",
		description: "The `TIMESTAMP WITH TIME ZONE` for the given parts and time zone.",
		origin: "vendor-docs",
	},
	map_contains: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html#map_containsmap-key",
		description: "Checks if a map contains a given key.",
		origin: "vendor-docs",
	},
	map_contains_entry: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html#map_contains_entrymap-key-value",
		description: "Check if a map contains a given key-value pair.",
		origin: "vendor-docs",
	},
	map_contains_value: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html#map_contains_valuemap-value",
		description: "Checks if a map contains a given value.",
		origin: "vendor-docs",
	},
	map_entries: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html#map_entriesmap",
		description: "Return a list of struct(k, v) for each key-value pair in the map.",
		origin: "vendor-docs",
	},
	map_extract: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html#map_extractmap-key",
		description: "Return the value for a given `key` as a list, or `NULL` if the key is not contained in the map.",
		origin: "vendor-docs",
	},
	map_extract_value: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html#map_extract_valuemap-key",
		description: "Returns the value for a given `key` or `NULL` if the `key` is not contained in the map.",
		origin: "vendor-docs",
	},
	map_keys: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html#map_keysmap",
		description: "Return a list of all keys in the map.",
		origin: "vendor-docs",
	},
	map_values: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/map.html#map_valuesmap",
		description: "Return a list of all values in the map.",
		origin: "vendor-docs",
	},
	max: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#maxarg",
		description: "Returns the maximum value present in `arg`.",
		origin: "vendor-docs",
	},
	md5: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html#md5blob",
		description: "Returns the MD5 hash of the `blob` as a `VARCHAR`.",
		origin: "vendor-docs",
	},
	md5_number: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html#md5_numberblob",
		description: "Returns the MD5 hash of the `blob` as a `HUGEINT`.",
		origin: "vendor-docs",
	},
	md5_number_lower: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#md5_number_lowerstring",
		description: "Returns the lower 64-bit segment of the MD5 hash of the `string` as a `UBIGINT`.",
		origin: "vendor-docs",
	},
	md5_number_upper: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#md5_number_upperstring",
		description: "Returns the upper 64-bit segment of the MD5 hash of the `string` as a `UBIGINT`.",
		origin: "vendor-docs",
	},
	median: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#medianx",
		description: "The middle value of the set.",
		origin: "vendor-docs",
	},
	microsecond: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#microseconddate",
		description: "Sub-minute microseconds.",
		origin: "vendor-docs",
	},
	millennium: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#millenniumdate",
		description: "Millennium.",
		origin: "vendor-docs",
	},
	millisecond: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#milliseconddate",
		description: "Sub-minute milliseconds.",
		origin: "vendor-docs",
	},
	min: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#minarg",
		description: "Returns the minimum value present in `arg`.",
		origin: "vendor-docs",
	},
	minute: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#minutedate",
		description: "Minutes.",
		origin: "vendor-docs",
	},
	mode: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#modex",
		description: "The most frequent value.",
		origin: "vendor-docs",
	},
	month: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#monthdate",
		description: "Month.",
		origin: "vendor-docs",
	},
	monthname: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#monthnamedate",
		description: "The (English) name of the month.",
		origin: "vendor-docs",
	},
	multiply: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#multiplyx-y",
		description: "Alias for `x * y`.",
		origin: "vendor-docs",
	},
	nextafter: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#nextafterx-y",
		description: "Return the next floating point value after `x` in the direction of `y`.",
		origin: "vendor-docs",
	},
	nfc_normalize: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#nfc_normalizestring",
		description: "Converts `string` to Unicode NFC normalized string.",
		origin: "vendor-docs",
	},
	not_ilike_escape: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#not_ilike_escapestring-like_specifier-escape_character",
		description:
			"Returns `false` if the `string` matches the `like_specifier` (see Pattern Matching) using case-insensitive matching.",
		origin: "vendor-docs",
	},
	not_like_escape: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#not_like_escapestring-like_specifier-escape_character",
		description:
			"Returns `false` if the `string` matches the `like_specifier` (see Pattern Matching) using case-sensitive matching.",
		origin: "vendor-docs",
	},
	now: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html#now",
		description: "Current date and time (start of current transaction).",
		origin: "vendor-docs",
	},
	nullif: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#nullifa-b",
		description: "Return `NULL` if a = b, else return a.",
		origin: "vendor-docs",
	},
	octet_length: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html#octet_lengthbitstring",
		description: "Returns the number of bytes in the bitstring.",
		origin: "vendor-docs",
	},
	parse_dirname: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#parse_dirnamepath-separator",
		description: "Returns the top-level directory name from the given `path`.",
		origin: "vendor-docs",
	},
	parse_dirpath: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#parse_dirpathpath-separator",
		description:
			"Returns the head of the `path` (the pathname until the last slash) similarly to Python's `os.path.dirname`.",
		origin: "vendor-docs",
	},
	parse_filename: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#parse_filenamestring-trim_extension-separator",
		description: "Returns the last component of the `path` similarly to Python's `os.path.basename` function.",
		origin: "vendor-docs",
	},
	parse_formatted_bytes: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#parse_formatted_bytesstring",
		description: "Parse a human-readable byte size string (e.g., `'16 KiB'`) into a `UBIGINT` number of bytes.",
		origin: "vendor-docs",
	},
	parse_path: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#parse_pathpath-separator",
		description:
			"Returns a list of the components (directories and filename) in the `path` similarly to Python's `pathlib.parts` function.",
		origin: "vendor-docs",
	},
	pg_typeof: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#pg_typeofexpression",
		description: "Returns the lower case name of the data type of the result of the expression.",
		origin: "vendor-docs",
	},
	pi: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#pi",
		description: "Returns the value of pi.",
		origin: "vendor-docs",
	},
	pow: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#powx-y",
		description: "Computes `x` to the power of `y`.",
		origin: "vendor-docs",
	},
	power: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#powerx-y",
		description: "Alias of `pow`. Computes `x` to the power of `y`.",
		origin: "vendor-docs",
	},
	prefix: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#prefixstring-search_string",
		description: "Returns `true` if `string` starts with `search_string`.",
		origin: "vendor-docs",
	},
	printf: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#printfformat-",
		description: "Formats a `string` using printf syntax.",
		origin: "vendor-docs",
	},
	product: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#productarg",
		description: "Calculates the product of all non-null values in `arg`.",
		origin: "vendor-docs",
	},
	quantile_cont: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#quantile_contx-pos",
		description: "The interpolated `pos`-quantile of `x` for `0 <= pos <= 1`.",
		origin: "vendor-docs",
	},
	quantile_disc: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#quantile_discx-pos",
		description: "The discrete `pos`-quantile of `x` for `0 <= pos <= 1`.",
		origin: "vendor-docs",
	},
	quarter: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#quarterdate",
		description: "Quarter.",
		origin: "vendor-docs",
	},
	query: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#queryquery_string",
		description: "Table function that parses and executes the query defined in `query_string`.",
		origin: "vendor-docs",
	},
	query_table: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#query_tabletbl_name",
		description: "Table function that returns the table given in `tbl_name`.",
		origin: "vendor-docs",
	},
	radians: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#radiansx",
		description: "Converts degrees to radians.",
		origin: "vendor-docs",
	},
	random: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#random",
		description: "Returns a random number `x` in the range `0.0 <= x < 1.0`.",
		origin: "vendor-docs",
	},
	range: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#rangestart-stop-step",
		description: "Creates a list of values between `start` and `stop` - the stop parameter is exclusive.",
		origin: "vendor-docs",
	},
	read_blob: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html#read_blobsource",
		description:
			"Returns the content from `source` (a filename, a list of filenames, or a glob pattern) as a `BLOB`.",
		origin: "vendor-docs",
	},
	read_text: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#read_textsource",
		description:
			"Returns the content from `source` (a filename, a list of filenames, or a glob pattern) as a `VARCHAR`.",
		origin: "vendor-docs",
	},
	regexp_escape: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#regexp_escapestring",
		description:
			"Escapes special patterns to turn `string` into a regular expression similarly to Python's `re.escape` function.",
		origin: "vendor-docs",
	},
	regexp_extract: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/regular_expressions.html#regexp_extractstring-pattern-name_list-options",
		description:
			"If `string` contains the regexp `pattern`, returns the capturing group specified by optional parameter `group`; otherwise, returns the empty string.",
		origin: "vendor-docs",
	},
	regexp_extract_all: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/regular_expressions.html#regexp_extract_allstring-regex-name_list-options",
		description:
			"Finds non-overlapping occurrences of `regex` in `string` and returns the corresponding values of `group`.",
		origin: "vendor-docs",
	},
	regexp_full_match: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/regular_expressions.html#regexp_full_matchstring-regex-options",
		description: "Returns `true` if the entire `string` matches the `regex`.",
		origin: "vendor-docs",
	},
	regexp_matches: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/regular_expressions.html#regexp_matchesstring-pattern-options",
		description: "Returns `true` if `string` contains the regexp `pattern`, `false` otherwise.",
		origin: "vendor-docs",
	},
	regexp_replace: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/regular_expressions.html#regexp_replacestring-pattern-replacement-options",
		description: "If `string` contains the regexp `pattern`, replaces the matching part with `replacement`.",
		origin: "vendor-docs",
	},
	regexp_split_to_array: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/regular_expressions.html#regexp_split_to_arraystring-regex-options",
		description: "Alias of `string_split_regex`.",
		origin: "vendor-docs",
	},
	regexp_split_to_table: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/regular_expressions.html#regexp_split_to_tablestring-regex-options",
		description: "Splits the `string` along the `regex` and returns a row for each part.",
		origin: "vendor-docs",
	},
	regr_avgx: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#regr_avgxy-x",
		description:
			"The average of the independent variable for non-`NULL` pairs, where x is the independent variable and y is the dependent variable.",
		origin: "vendor-docs",
	},
	regr_avgy: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#regr_avgyy-x",
		description:
			"The average of the dependent variable for non-`NULL` pairs, where x is the independent variable and y is the dependent variable.",
		origin: "vendor-docs",
	},
	regr_count: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#regr_county-x",
		description: "The number of non-`NULL` pairs.",
		origin: "vendor-docs",
	},
	regr_intercept: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#regr_intercepty-x",
		description:
			"The intercept of the univariate linear regression line, where x is the independent variable and y is the dependent variable.",
		origin: "vendor-docs",
	},
	regr_r2: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#regr_r2y-x",
		description: "The squared Pearson correlation coefficient between y and x.",
		origin: "vendor-docs",
	},
	regr_slope: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#regr_slopey-x",
		description:
			"Returns the slope of the linear regression line, where x is the independent variable and y is the dependent variable.",
		origin: "vendor-docs",
	},
	regr_sxx: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#regr_sxxy-x",
		description:
			"The sample variance, which includes Bessel's bias correction, of the independent variable for non-`NULL` pairs, where x is the independent variable and y is the dependent variable.",
		origin: "vendor-docs",
	},
	regr_sxy: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#regr_sxyy-x",
		description: "The sample covariance, which includes Bessel's bias correction.",
		origin: "vendor-docs",
	},
	regr_syy: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#regr_syyy-x",
		description:
			"The sample variance, which includes Bessel's bias correction, of the dependent variable for non-`NULL` pairs, where x is the independent variable and y is the dependent variable.",
		origin: "vendor-docs",
	},
	repeat: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html#repeatblob-count",
		description: "Repeats the `blob` `count` number of times.",
		origin: "vendor-docs",
	},
	repeat_row: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#repeat_rowvarargs-num_rows",
		description: "Returns a table with `num_rows` rows, each containing the fields defined in `varargs`.",
		origin: "vendor-docs",
	},
	replace: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#replacestring-source-target",
		description: "Replaces any occurrences of the `source` with `target` in `string`.",
		origin: "vendor-docs",
	},
	replace_type: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#replace_typevalue-source_type-target_type",
		description: "Recursively casts every field of `value` that has type `source_type` to `target_type`.",
		origin: "vendor-docs",
	},
	reverse: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#reversestring",
		description: "Reverses the `string`.",
		origin: "vendor-docs",
	},
	right: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#rightstring-count",
		description: "Extract the right-most `count` characters.",
		origin: "vendor-docs",
	},
	right_grapheme: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#right_graphemestring-count",
		description: "Extracts the right-most `count` grapheme clusters.",
		origin: "vendor-docs",
	},
	round: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#roundv-numeric-s-integer",
		description: "Round to `s` decimal places.",
		origin: "vendor-docs",
	},
	round_even: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#round_evenv-numeric-s-integer",
		description: "Alias of `roundbankers(v, s)`.",
		origin: "vendor-docs",
	},
	roundbankers: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#roundbankersv-numeric-s-integer",
		description: "Alias of `round_even(v, s)`.",
		origin: "vendor-docs",
	},
	row: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/struct.html#rowany-",
		description: "Create an unnamed `STRUCT` (tuple) containing the argument values.",
		origin: "vendor-docs",
	},
	rpad: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#rpadstring-count-character",
		description: "Pads the `string` with the `character` on the right until it has `count` characters.",
		origin: "vendor-docs",
	},
	rtrim: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#rtrimstring-characters",
		description: "Removes any occurrences of any of the `characters` from the right side of the `string`.",
		origin: "vendor-docs",
	},
	second: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#seconddate",
		description: "Seconds.",
		origin: "vendor-docs",
	},
	sem: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#semx",
		description: "The standard error of the mean.",
		origin: "vendor-docs",
	},
	set_bit: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/bitstring.html#set_bitbitstring-index-new_value",
		description: "Sets the nth bit in bitstring to newvalue; the first (leftmost) bit is indexed 0.",
		origin: "vendor-docs",
	},
	setseed: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#setseedx",
		description: "Sets the seed to be used for the random function.",
		origin: "vendor-docs",
	},
	sha1: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html#sha1blob",
		description: "Returns a `VARCHAR` with the SHA-1 hash of the `blob`.",
		origin: "vendor-docs",
	},
	sha256: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html#sha256blob",
		description: "Returns a `VARCHAR` with the SHA-256 hash of the `blob`.",
		origin: "vendor-docs",
	},
	sign: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#signx",
		description: "Returns the sign of `x` as -1, 0 or 1.",
		origin: "vendor-docs",
	},
	signbit: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#signbitx",
		description: "Returns whether the signbit is set or not.",
		origin: "vendor-docs",
	},
	sin: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#sinx",
		description: "Computes the sin of `x`.",
		origin: "vendor-docs",
	},
	skewness: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#skewnessx",
		description: "The skewness.",
		origin: "vendor-docs",
	},
	sleep_ms: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#sleep_msmilliseconds",
		description: "Pause execution for the specified number of milliseconds.",
		origin: "vendor-docs",
	},
	split_part: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#split_partstring-separator-index",
		description:
			"Splits the `string` along the `separator` and returns the data at the (1-based) `index` of the list.",
		origin: "vendor-docs",
	},
	sqrt: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#sqrtx",
		description: "Returns the square root of the number.",
		origin: "vendor-docs",
	},
	starts_with: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#starts_withstring-search_string",
		description: "Returns `true` if `string` begins with `search_string`.",
		origin: "vendor-docs",
	},
	stats: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#statsexpression",
		description: "Returns a string with statistics about the expression.",
		origin: "vendor-docs",
	},
	stddev_pop: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#stddev_popx",
		description: "The population standard deviation.",
		origin: "vendor-docs",
	},
	stddev_samp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#stddev_sampx",
		description: "The sample standard deviation.",
		origin: "vendor-docs",
	},
	strftime: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#strftimedate-format",
		description: "Converts a date to a string according to the format string.",
		origin: "vendor-docs",
	},
	string_agg: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#string_aggarg",
		description: "Concatenates the column string values with a comma separator (`,`).",
		origin: "vendor-docs",
	},
	string_split: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#string_splitstring-separator",
		description: "Splits the `string` along the `separator`.",
		origin: "vendor-docs",
	},
	string_split_regex: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#string_split_regexstring-regex-options",
		description: "Splits the `string` along the `regex`.",
		origin: "vendor-docs",
	},
	strip_accents: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#strip_accentsstring",
		description: "Strips accents from `string`.",
		origin: "vendor-docs",
	},
	strlen: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#strlenstring",
		description: "Number of bytes in `string`.",
		origin: "vendor-docs",
	},
	strptime: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html#strptimetext-format",
		description:
			"Converts the string `text` to timestamp applying the format strings in the list until one succeeds.",
		origin: "vendor-docs",
	},
	struct_contains: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/struct.html#struct_containsstruct-entry",
		description: "Check if the `STRUCT` contains the specified entry.",
		origin: "vendor-docs",
	},
	struct_extract: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/struct.html#struct_extractstruct-idx",
		description: "Extract the named entry from the `STRUCT`.",
		origin: "vendor-docs",
	},
	struct_extract_at: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/struct.html#struct_extract_atstruct-idx",
		description: "Extract the entry from a `STRUCT` (tuple) using an index (1-based).",
		origin: "vendor-docs",
	},
	struct_position: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/struct.html#struct_positionstruct-entry",
		description: "Return the index of the entry within the `STRUCT` (1-based), or `NULL` if not found.",
		origin: "vendor-docs",
	},
	struct_values: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/struct.html#struct_valuesstruct",
		description: "Return the values of a `STRUCT` as an unnamed `STRUCT` (tuple).",
		origin: "vendor-docs",
	},
	substring: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#substringstring-start-length",
		description: "Extracts substring starting from character `start` up to the end of the string.",
		origin: "vendor-docs",
	},
	substring_grapheme: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#substring_graphemestring-start-length",
		description: "Extracts substring starting from grapheme clusters `start` up to the end of the string.",
		origin: "vendor-docs",
	},
	subtract: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#subtractx-y",
		description: "Alias for `x - y`.",
		origin: "vendor-docs",
	},
	suffix: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#suffixstring-search_string",
		description: "Returns `true` if `string` ends with `search_string`.",
		origin: "vendor-docs",
	},
	sum: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#sumarg",
		description: "Calculates the sum of all non-null values in `arg` / counts `true` values when `arg` is boolean.",
		origin: "vendor-docs",
	},
	tan: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#tanx",
		description: "Computes the tangent of `x`.",
		origin: "vendor-docs",
	},
	time_bucket: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#time_bucketbucket_width-date-offset",
		description: "Truncate `date` to a grid of width `bucket_width`.",
		origin: "vendor-docs",
	},
	timetz_byte_comparable: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html#timetz_byte_comparabletimetz",
		description: "Converts a `TIME WITH TIME ZONE` to a `UBIGINT` sort key.",
		origin: "vendor-docs",
	},
	timezone: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html#timezonedate",
		description: "Time zone offset in minutes.",
		origin: "vendor-docs",
	},
	timezone_hour: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#timezone_hourdate",
		description: "Time zone offset hour portion.",
		origin: "vendor-docs",
	},
	timezone_minute: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#timezone_minutedate",
		description: "Time zone offset minutes portion.",
		origin: "vendor-docs",
	},
	to_base: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#to_basenumber-radix-min_length",
		description:
			"Converts `number` to a string in the given base `radix`, optionally padding with leading zeros to `min_length`.",
		origin: "vendor-docs",
	},
	to_base64: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html#to_base64blob",
		description: "Converts a `blob` to a base64 encoded string.",
		origin: "vendor-docs",
	},
	to_centuries: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html#to_centuriesinteger",
		description: "Construct a century interval.",
		origin: "vendor-docs",
	},
	to_days: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html#to_daysinteger",
		description: "Construct a day interval.",
		origin: "vendor-docs",
	},
	to_decades: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html#to_decadesinteger",
		description: "Construct a decade interval.",
		origin: "vendor-docs",
	},
	to_hours: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html#to_hoursinteger",
		description: "Construct an hour interval.",
		origin: "vendor-docs",
	},
	to_microseconds: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html#to_microsecondsinteger",
		description: "Construct a microsecond interval.",
		origin: "vendor-docs",
	},
	to_millennia: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html#to_millenniainteger",
		description: "Construct a millennium interval.",
		origin: "vendor-docs",
	},
	to_milliseconds: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html#to_millisecondsinteger",
		description: "Construct a millisecond interval.",
		origin: "vendor-docs",
	},
	to_minutes: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html#to_minutesinteger",
		description: "Construct a minute interval.",
		origin: "vendor-docs",
	},
	to_months: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html#to_monthsinteger",
		description: "Construct a month interval.",
		origin: "vendor-docs",
	},
	to_quarters: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html#to_quartersinteger",
		description: "Construct an interval of `integer` quarters.",
		origin: "vendor-docs",
	},
	to_seconds: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html#to_secondsinteger",
		description: "Construct a second interval.",
		origin: "vendor-docs",
	},
	to_timestamp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html#to_timestampdouble",
		description: "Converts seconds since the epoch to a timestamp with time zone.",
		origin: "vendor-docs",
	},
	to_weeks: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html#to_weeksinteger",
		description: "Construct a week interval.",
		origin: "vendor-docs",
	},
	to_years: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/interval.html#to_yearsinteger",
		description: "Construct a year interval.",
		origin: "vendor-docs",
	},
	today: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/date.html#today",
		description: "Current date (start of current transaction) in the local time zone.",
		origin: "vendor-docs",
	},
	transaction_timestamp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamptz.html#transaction_timestamp",
		description: "Current date and time (start of current transaction).",
		origin: "vendor-docs",
	},
	translate: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#translatestring-from-to",
		description:
			"Replaces each character in `string` that matches a character in the `from` set with the corresponding character in the `to` set.",
		origin: "vendor-docs",
	},
	trim: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#trimstring-characters",
		description: "Removes any occurrences of any of the `characters` from either side of the `string`.",
		origin: "vendor-docs",
	},
	trunc: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#truncx",
		description: "Truncates the number.",
		origin: "vendor-docs",
	},
	try_strptime: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/timestamp.html#try_strptimetext-format",
		description:
			"Converts the string `text` to timestamp applying the format strings in the list until one succeeds.",
		origin: "vendor-docs",
	},
	txid_current: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#txid_current",
		description: "Returns the current transaction's identifier, a `BIGINT` value.",
		origin: "vendor-docs",
	},
	typeof: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#typeofexpression",
		description: "Returns the name of the data type of the result of the expression.",
		origin: "vendor-docs",
	},
	unbin: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html#unbinvalue",
		description: "Converts a `value` from binary representation to a blob.",
		origin: "vendor-docs",
	},
	unhex: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/blob.html#unhexvalue",
		description: "Converts a `value` from hexadecimal representation to a blob.",
		origin: "vendor-docs",
	},
	unicode: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#unicodestring",
		description:
			"Returns an `INTEGER` representing the `unicode` codepoint of the first character in the `string`.",
		origin: "vendor-docs",
	},
	union_tag: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/union.html#union_tagunion",
		description: "Retrieve the currently selected tag of the union as an Enum.",
		origin: "vendor-docs",
	},
	unnest: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#unnestlist",
		description: "Unnests a list by one level.",
		origin: "vendor-docs",
	},
	unpivot_list: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/list.html#unpivot_listarg-",
		description: "Identical to list_value, but generated as part of unpivot for better error messages.",
		origin: "vendor-docs",
	},
	upper: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#upperstring",
		description: "Converts `string` to upper case.",
		origin: "vendor-docs",
	},
	url_decode: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#url_decodestring",
		description: "Decodes a URL from a representation using Percent-Encoding.",
		origin: "vendor-docs",
	},
	url_encode: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/text.html#url_encodestring",
		description: "Encodes a URL to a representation using Percent-Encoding.",
		origin: "vendor-docs",
	},
	uuid: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#uuid",
		description: "Return a random UUID (UUIDv4) similar to this: `eeccb8c5-9943-b2bb-bb5e-222f4e14b687`.",
		origin: "vendor-docs",
	},
	uuid_extract_timestamp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#uuid_extract_timestampuuidv7",
		description: "Extracts `TIMESTAMP WITH TIME ZONE` from a UUIDv7 value.",
		origin: "vendor-docs",
	},
	uuid_extract_version: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#uuid_extract_versionuuid",
		description: "Extracts UUID version (`4` or `7`).",
		origin: "vendor-docs",
	},
	uuidv4: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#uuidv4",
		description: "Return a random UUID (UUIDv4) similar to this: `eeccb8c5-9943-b2bb-bb5e-222f4e14b687`.",
		origin: "vendor-docs",
	},
	uuidv7: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#uuidv7",
		description: "Return a random UUIDv7 similar to this: `81964ebe-00b1-7e1d-b0f9-43c29b6fb8f5`.",
		origin: "vendor-docs",
	},
	var_pop: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#var_popx",
		description: "The population variance, which does not include bias correction.",
		origin: "vendor-docs",
	},
	var_samp: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#var_sampx",
		description: "The sample variance, which includes Bessel's bias correction.",
		origin: "vendor-docs",
	},
	version: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/utility.html#version",
		description: "Return the currently active version of DuckDB in this format.",
		origin: "vendor-docs",
	},
	week: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#weekdate",
		description: "ISO Week.",
		origin: "vendor-docs",
	},
	weekday: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#weekdaydate",
		description: "Numeric weekday synonym (Sunday = 0, Saturday = 6).",
		origin: "vendor-docs",
	},
	weekofyear: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#weekofyeardate",
		description: "ISO Week (synonym).",
		origin: "vendor-docs",
	},
	weighted_avg: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/aggregates.html#weighted_avgarg-weight",
		description:
			"Calculates the weighted average of all non-null values in `arg`, where each value is scaled by its corresponding `weight`.",
		origin: "vendor-docs",
	},
	xor: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/numeric.html#xorx-y",
		description: "Bitwise XOR.",
		origin: "vendor-docs",
	},
	year: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#yeardate",
		description: "Year.",
		origin: "vendor-docs",
	},
	yearweek: {
		docUrl: "https://duckdb.org/docs/current/sql/functions/datepart.html#yearweekdate",
		description: "`BIGINT` of combined ISO Year number and 2-digit version of ISO Week number.",
		origin: "vendor-docs",
	},
};
