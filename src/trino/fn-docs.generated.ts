// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for trino (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-14. 387 names (385 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const TRINO_FN_DOCS: Record<string, FnDoc> = {
	abs: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the absolute value of `x`.",
		origin: "vendor-docs",
	},
	acos: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the arc cosine of `x`.",
		origin: "vendor-docs",
	},
	ai_analyze_sentiment: {
		docUrl: "https://trino.io/docs/current/functions/ai.html",
		description: "Analyzes the sentiment of the input text.",
		origin: "vendor-docs",
	},
	ai_classify: {
		docUrl: "https://trino.io/docs/current/functions/ai.html",
		description: "Classifies the input text according to the provided labels.",
		origin: "vendor-docs",
	},
	ai_extract: {
		docUrl: "https://trino.io/docs/current/functions/ai.html",
		description: "Extracts values for the provided labels from the input text.",
		origin: "vendor-docs",
	},
	ai_fix_grammar: {
		docUrl: "https://trino.io/docs/current/functions/ai.html",
		description: "Corrects grammatical errors in the input text.",
		origin: "vendor-docs",
	},
	ai_gen: {
		docUrl: "https://trino.io/docs/current/functions/ai.html",
		description: "Generates text based on the input prompt.",
		origin: "vendor-docs",
	},
	ai_mask: {
		docUrl: "https://trino.io/docs/current/functions/ai.html",
		description:
			"Masks the values for the provided labels in the input text by replacing them with the text `[MASKED]`.",
		origin: "vendor-docs",
	},
	ai_translate: {
		docUrl: "https://trino.io/docs/current/functions/ai.html",
		description: "Translates the input text to the specified language.",
		origin: "vendor-docs",
	},
	any_value: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns an arbitrary non-null value `x`, if one exists.",
		origin: "vendor-docs",
	},
	approx_distinct: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the approximate number of distinct input values.",
		origin: "vendor-docs",
	},
	approx_most_frequent: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Computes the top frequent values up to `buckets` elements approximately.",
		origin: "vendor-docs",
	},
	approx_percentile: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the approximate percentile for all input values of `x` at the given `percentage`.",
		origin: "vendor-docs",
	},
	approx_set: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	arbitrary: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns an arbitrary non-null value of `x`, if one exists.",
		origin: "vendor-docs",
	},
	array_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns an array created from the input `x` elements.",
		origin: "vendor-docs",
	},
	array_distinct: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Remove duplicate values from the array `x`.",
		origin: "vendor-docs",
	},
	array_except: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Returns an array of elements in `x` but not in `y`, without duplicates.",
		origin: "vendor-docs",
	},
	array_histogram: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description:
			"Returns a map where the keys are the unique elements in the input array `x` and the values are the number of times that each element appears in `x`.",
		origin: "vendor-docs",
	},
	array_intersect: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Returns an array of the elements in the intersection of `x` and `y`, without duplicates.",
		origin: "vendor-docs",
	},
	array_join: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Concatenates the elements of the given array using the delimiter.",
		origin: "vendor-docs",
	},
	array_max: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Returns the maximum value of input array.",
		origin: "vendor-docs",
	},
	array_min: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Returns the minimum value of input array.",
		origin: "vendor-docs",
	},
	array_position: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Returns the position of the first occurrence of the `element` in array `x` (or 0 if not found).",
		origin: "vendor-docs",
	},
	array_remove: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Remove all elements that equal `element` from array `x`.",
		origin: "vendor-docs",
	},
	array_sort: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Sorts and returns the array `x`.",
		origin: "vendor-docs",
	},
	array_union: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Returns an array of the elements in the union of `x` and `y`, without duplicates.",
		origin: "vendor-docs",
	},
	arrays_overlap: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Tests if arrays `x` and `y` have any non-null elements in common.",
		origin: "vendor-docs",
	},
	asin: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the arc sine of `x`.",
		origin: "vendor-docs",
	},
	at_timezone: { description: "Converts `x` to a time zone specified in `zone`.", origin: "vendor-docs" },
	atan: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the arc tangent of `x`.",
		origin: "vendor-docs",
	},
	atan2: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the arc tangent of `y / x`.",
		origin: "vendor-docs",
	},
	avg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the average (arithmetic mean) of all input values.",
		origin: "vendor-docs",
	},
	bar: {
		docUrl: "https://trino.io/docs/current/functions/color.html",
		description:
			"Renders a single bar in an ANSI bar chart using a default `low_color` of red and a `high_color` of green.",
		origin: "vendor-docs",
	},
	beta_cdf: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Compute the Beta cdf with given a, b parameters: P(N \\< v; a, b).",
		origin: "vendor-docs",
	},
	bing_tile: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Creates a Bing tile object from XY coordinates and a zoom level.",
		origin: "vendor-docs",
	},
	bing_tile_at: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns a Bing tile at a given zoom level containing a point at a given latitude and longitude.",
		origin: "vendor-docs",
	},
	bing_tile_coordinates: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the XY coordinates of a given Bing tile.",
		origin: "vendor-docs",
	},
	bing_tile_polygon: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the polygon representation of a given Bing tile.",
		origin: "vendor-docs",
	},
	bing_tile_quadkey: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the quadkey of a given Bing tile.",
		origin: "vendor-docs",
	},
	bing_tile_zoom_level: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the zoom level of a given Bing tile.",
		origin: "vendor-docs",
	},
	bing_tiles_around: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description:
			"Returns a collection of Bing tiles that surround the point specified by the latitude and longitude arguments at a given zoom level.",
		origin: "vendor-docs",
	},
	bit_count: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html",
		description:
			"Count the number of bits set in `x` (treated as `bits`-bit signed integer) in 2's complement representation.",
		origin: "vendor-docs",
	},
	bitwise_and: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html",
		description: "Returns the bitwise AND of `x` and `y` in 2's complement representation.",
		origin: "vendor-docs",
	},
	bitwise_and_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the bitwise AND of all input non-NULL values in 2's complement representation.",
		origin: "vendor-docs",
	},
	bitwise_left_shift: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html",
		description: "Returns the left shifted value of `value`.",
		origin: "vendor-docs",
	},
	bitwise_not: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html",
		description: "Returns the bitwise NOT of `x` in 2's complement representation (`NOT x = -x - 1`).",
		origin: "vendor-docs",
	},
	bitwise_or: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html",
		description: "Returns the bitwise OR of `x` and `y` in 2's complement representation.",
		origin: "vendor-docs",
	},
	bitwise_or_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the bitwise OR of all input non-NULL values in 2's complement representation.",
		origin: "vendor-docs",
	},
	bitwise_right_shift: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html",
		description: "Returns the logical right shifted value of `value`.",
		origin: "vendor-docs",
	},
	bitwise_right_shift_arithmetic: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html",
		description: "Returns the arithmetic right shifted value of `value`.",
		origin: "vendor-docs",
	},
	bitwise_xor: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html",
		description: "Returns the bitwise XOR of `x` and `y` in 2's complement representation.",
		origin: "vendor-docs",
	},
	bitwise_xor_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the bitwise XOR of all input non-NULL values in 2's complement representation.",
		origin: "vendor-docs",
	},
	bool_and: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns `TRUE` if every input value is `TRUE`, otherwise `FALSE`.",
		origin: "vendor-docs",
	},
	bool_or: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns `TRUE` if any input value is `TRUE`, otherwise `FALSE`.",
		origin: "vendor-docs",
	},
	cardinality: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Returns the cardinality (size) of the array `x`.",
		origin: "vendor-docs",
	},
	cbrt: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the cube root of `x`.",
		origin: "vendor-docs",
	},
	ceil: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "This is an alias for ceiling.",
		origin: "vendor-docs",
	},
	ceiling: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns `x` rounded up to the nearest integer.",
		origin: "vendor-docs",
	},
	char2hexint: {
		docUrl: "https://trino.io/docs/current/functions/teradata.html",
		description: "Returns the hexadecimal representation of the UTF-16BE encoding of the string.",
		origin: "vendor-docs",
	},
	checksum: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns an order-insensitive checksum of the given values.",
		origin: "vendor-docs",
	},
	chr: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Returns the Unicode code point `n` as a single character string.",
		origin: "vendor-docs",
	},
	classify: {
		docUrl: "https://trino.io/docs/current/functions/ml.html",
		description: "Returns a label predicted by the given classifier SVM model.",
		origin: "vendor-docs",
	},
	coalesce: {
		docUrl: "https://trino.io/docs/current/functions/conditional.html",
		description: "Returns the first non-null `value` in the argument list.",
		origin: "vendor-docs",
	},
	codepoint: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Returns the Unicode code point of the only character of `string`.",
		origin: "vendor-docs",
	},
	color: {
		docUrl: "https://trino.io/docs/current/functions/color.html",
		description: 'Returns a color capturing a decoded RGB value from a 4-character string of the format "#000".',
		origin: "vendor-docs",
	},
	concat_ws: {
		description:
			"Returns the concatenation of `string1`, `string2`, `...`, `stringN` using `separator` to join the values.",
		origin: "vendor-docs",
	},
	contains: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Returns true if the array `x` contains the `element`.",
		origin: "vendor-docs",
	},
	contains_sequence: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description:
			"Return true if array `x` contains all of array `seq` as a subsequence (all values in the same consecutive order).",
		origin: "vendor-docs",
	},
	convex_hull_agg: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the minimum convex geometry that encloses all input geometries.",
		origin: "vendor-docs",
	},
	corr: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns correlation coefficient of input values.",
		origin: "vendor-docs",
	},
	cos: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the cosine of `x`.",
		origin: "vendor-docs",
	},
	cosh: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the hyperbolic cosine of `x`.",
		origin: "vendor-docs",
	},
	cosine_distance: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Calculates the cosine distance between two dense vectors.",
		origin: "vendor-docs",
	},
	cosine_similarity: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Calculates the cosine similarity of two dense vectors.",
		origin: "vendor-docs",
	},
	count: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the number of input rows.",
		origin: "vendor-docs",
	},
	count_if: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the number of `TRUE` input values.",
		origin: "vendor-docs",
	},
	covar_pop: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the population covariance of input values.",
		origin: "vendor-docs",
	},
	covar_samp: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the sample covariance of input values.",
		origin: "vendor-docs",
	},
	crc32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Computes the CRC-32 of `binary`.",
		origin: "vendor-docs",
	},
	cume_dist: {
		docUrl: "https://trino.io/docs/current/functions/window.html",
		description: "Returns the cumulative distribution of a value in a group of values.",
		origin: "vendor-docs",
	},
	current_timezone: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description:
			"Returns the current time zone in the format defined by IANA (e.g., `America/Los_Angeles`) or as fixed offset from UTC (e.g., `+08:35`)",
		origin: "vendor-docs",
	},
	date: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "This is an alias for `CAST(x AS date)`.",
		origin: "vendor-docs",
	},
	date_add: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Adds an interval `value` of type `unit` to `timestamp`.",
		origin: "vendor-docs",
	},
	date_diff: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns `timestamp2 - timestamp1` expressed in terms of `unit`.",
		origin: "vendor-docs",
	},
	date_format: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Formats `timestamp` as a string using `format`.",
		origin: "vendor-docs",
	},
	date_parse: { docUrl: "https://trino.io/docs/current/functions/datetime.html", origin: "vendor-docs" },
	date_trunc: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns `x` truncated to `unit`.",
		origin: "vendor-docs",
	},
	day: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the day of the month from `x`.",
		origin: "vendor-docs",
	},
	day_of_month: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "This is an alias for day.",
		origin: "vendor-docs",
	},
	day_of_week: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the ISO day of the week from `x`.",
		origin: "vendor-docs",
	},
	day_of_year: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the day of the year from `x`.",
		origin: "vendor-docs",
	},
	degrees: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Converts angle `x` in radians to degrees.",
		origin: "vendor-docs",
	},
	dense_rank: {
		docUrl: "https://trino.io/docs/current/functions/window.html",
		description: "Returns the rank of a value in a group of values.",
		origin: "vendor-docs",
	},
	dow: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "This is an alias for day_of_week.",
		origin: "vendor-docs",
	},
	doy: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "This is an alias for day_of_year.",
		origin: "vendor-docs",
	},
	e: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the constant Euler's number.",
		origin: "vendor-docs",
	},
	element_at: { description: "Returns element of `array` at given `index`.", origin: "vendor-docs" },
	empty_approx_set: {
		docUrl: "https://trino.io/docs/current/functions/hyperloglog.html",
		description: "Returns an empty `HyperLogLog`.",
		origin: "vendor-docs",
	},
	ends_with: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Tests whether `substring` is a suffix of `string`.",
		origin: "vendor-docs",
	},
	every: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "This is an alias for bool_and.",
		origin: "vendor-docs",
	},
	exp: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns Euler's number raised to the power of `x`.",
		origin: "vendor-docs",
	},
	features: {
		docUrl: "https://trino.io/docs/current/functions/ml.html",
		description: "Returns the map representing the feature vector.",
		origin: "vendor-docs",
	},
	first_value: {
		docUrl: "https://trino.io/docs/current/functions/window.html",
		description: "Returns the first value of the window.",
		origin: "vendor-docs",
	},
	flatten: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Flattens an `array(array(T))` to an `array(T)` by concatenating the contained arrays.",
		origin: "vendor-docs",
	},
	floor: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns `x` rounded down to the nearest integer.",
		origin: "vendor-docs",
	},
	format: {
		docUrl: "https://trino.io/docs/current/functions/conversion.html",
		description: "Returns a formatted string using the specified format string and arguments.",
		origin: "vendor-docs",
	},
	format_datetime: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Formats `timestamp` as a string using `format`.",
		origin: "vendor-docs",
	},
	format_number: {
		docUrl: "https://trino.io/docs/current/functions/conversion.html",
		description: "Returns a formatted string using a unit symbol.",
		origin: "vendor-docs",
	},
	from_base: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the value of `string` interpreted as a base-`radix` number.",
		origin: "vendor-docs",
	},
	from_base32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Decodes binary data from the base32 encoded `string`.",
		origin: "vendor-docs",
	},
	from_base64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Decodes binary data from the base64 encoded `string`.",
		origin: "vendor-docs",
	},
	from_base64url: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Decodes binary data from the base64 encoded `string` using the URL safe alphabet.",
		origin: "vendor-docs",
	},
	from_big_endian_32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Decodes the 32-bit two's complement big-endian `binary`.",
		origin: "vendor-docs",
	},
	from_big_endian_64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Decodes the 64-bit two's complement big-endian `binary`.",
		origin: "vendor-docs",
	},
	from_encoded_polyline: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Decodes a polyline to a linestring.",
		origin: "vendor-docs",
	},
	from_geojson_geometry: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description:
			"Returns the spherical geography type object from the GeoJSON representation stripping non geometry key/values.",
		origin: "vendor-docs",
	},
	from_hex: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Decodes binary data from the hex encoded `string`.",
		origin: "vendor-docs",
	},
	from_ieee754_32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Decodes the 32-bit big-endian `binary` in IEEE 754 single-precision floating-point format.",
		origin: "vendor-docs",
	},
	from_ieee754_64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Decodes the 64-bit big-endian `binary` in IEEE 754 double-precision floating-point format.",
		origin: "vendor-docs",
	},
	from_iso8601_date: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Parses the ISO 8601 formatted date `string` into a `date`.",
		origin: "vendor-docs",
	},
	from_iso8601_timestamp: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description:
			"Parses the ISO 8601 formatted date `string`, optionally with time and time zone, into a `timestamp(3) with time zone`.",
		origin: "vendor-docs",
	},
	from_iso8601_timestamp_nanos: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Parses the ISO 8601 formatted date and time `string`.",
		origin: "vendor-docs",
	},
	from_unixtime: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the UNIX timestamp `unixtime` as a timestamp with time zone.",
		origin: "vendor-docs",
	},
	from_unixtime_nanos: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the UNIX timestamp `unixtime` as a timestamp with time zone.",
		origin: "vendor-docs",
	},
	from_utf8: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Decodes a UTF-8 encoded string from `binary`.",
		origin: "vendor-docs",
	},
	geometric_mean: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the geometric mean of all input values.",
		origin: "vendor-docs",
	},
	geometry_from_hadoop_shape: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns a geometry type object from Spatial Framework for Hadoop representation.",
		origin: "vendor-docs",
	},
	geometry_invalid_reason: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the reason for why the input geometry is not valid.",
		origin: "vendor-docs",
	},
	geometry_nearest_points: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the points on each geometry nearest the other.",
		origin: "vendor-docs",
	},
	geometry_to_bing_tiles: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the minimum set of Bing tiles that fully covers a given geometry at a given zoom level.",
		origin: "vendor-docs",
	},
	geometry_union_agg: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns a geometry that represents the point set union of all input geometries.",
		origin: "vendor-docs",
	},
	great_circle_distance: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the great-circle distance between two points on Earth's surface in kilometers.",
		origin: "vendor-docs",
	},
	hamming_distance: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Returns the Hamming distance of `string1` and `string2`, i.e.",
		origin: "vendor-docs",
	},
	hash_counts: {
		docUrl: "https://trino.io/docs/current/functions/setdigest.html",
		description:
			"Returns a map containing the Murmur3Hash128 hashed values and the count of their occurences within the internal `MinHash` structure belonging to `x`.",
		origin: "vendor-docs",
	},
	histogram: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns a map containing the count of the number of times each input value occurs.",
		origin: "vendor-docs",
	},
	hmac_md5: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Computes HMAC with MD5 of `binary` with the given `key`.",
		origin: "vendor-docs",
	},
	hmac_sha1: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Computes HMAC with SHA1 of `binary` with the given `key`.",
		origin: "vendor-docs",
	},
	hmac_sha256: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Computes HMAC with SHA256 of `binary` with the given `key`.",
		origin: "vendor-docs",
	},
	hmac_sha512: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Computes HMAC with SHA512 of `binary` with the given `key`.",
		origin: "vendor-docs",
	},
	hour: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the hour of the day from `x`.",
		origin: "vendor-docs",
	},
	human_readable_seconds: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description:
			"Formats the double value of `seconds` into a human-readable string containing `weeks`, `days`, `hours`, `minutes`, and `seconds`.",
		origin: "vendor-docs",
	},
	if: {
		docUrl: "https://trino.io/docs/current/functions/conditional.html",
		description:
			"Evaluates and returns `true_value` if `condition` is true, otherwise null is returned and `true_value` is not evaluated.",
		origin: "vendor-docs",
	},
	index: {
		docUrl: "https://trino.io/docs/current/functions/teradata.html",
		description: "Alias for strpos function.",
		origin: "vendor-docs",
	},
	infinity: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the constant representing positive infinity.",
		origin: "vendor-docs",
	},
	intersection_cardinality: {
		docUrl: "https://trino.io/docs/current/functions/setdigest.html",
		description: "Returns the estimation for the cardinality of the intersection of the two set digests.",
		origin: "vendor-docs",
	},
	inverse_beta_cdf: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description:
			"Compute the inverse of the Beta cdf with given a, b parameters for the cumulative probability (p): P(N \\< n).",
		origin: "vendor-docs",
	},
	inverse_normal_cdf: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description:
			"Compute the inverse of the Normal cdf with given mean and standard deviation (sd) for the cumulative probability (p): P(N \\< n).",
		origin: "vendor-docs",
	},
	is_finite: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Determine if `x` is finite.",
		origin: "vendor-docs",
	},
	is_infinite: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Determine if `x` is infinite.",
		origin: "vendor-docs",
	},
	is_json_scalar: {
		docUrl: "https://trino.io/docs/current/functions/json.html",
		description: "Determine if `json` is a scalar (i.e.",
		origin: "vendor-docs",
	},
	is_nan: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Determine if `x` is not-a-number.",
		origin: "vendor-docs",
	},
	jaccard_index: {
		docUrl: "https://trino.io/docs/current/functions/setdigest.html",
		description: "Returns the estimation of Jaccard index for the two set digests.",
		origin: "vendor-docs",
	},
	json_array_contains: {
		docUrl: "https://trino.io/docs/current/functions/json.html",
		description: "Determine if `value` exists in `json` (a string containing a JSON array).",
		origin: "vendor-docs",
	},
	json_array_get: { docUrl: "https://trino.io/docs/current/functions/json.html", origin: "vendor-docs" },
	json_array_length: {
		docUrl: "https://trino.io/docs/current/functions/json.html",
		description: "Returns the array length of `json` (a string containing a JSON array).",
		origin: "vendor-docs",
	},
	json_extract: {
		docUrl: "https://trino.io/docs/current/functions/json.html",
		description:
			"Evaluates the [JSONPath]-like expression `json_path` on `json` (a string containing JSON) and returns the result as a JSON string.",
		origin: "vendor-docs",
	},
	json_extract_scalar: {
		docUrl: "https://trino.io/docs/current/functions/json.html",
		description:
			"Like json_extract, but returns the result value as a string (as opposed to being encoded as JSON).",
		origin: "vendor-docs",
	},
	json_format: {
		docUrl: "https://trino.io/docs/current/functions/json.html",
		description: "Returns the JSON text serialized from the input JSON value.",
		origin: "vendor-docs",
	},
	json_parse: {
		docUrl: "https://trino.io/docs/current/functions/json.html",
		description: "Returns the JSON value deserialized from the input JSON text.",
		origin: "vendor-docs",
	},
	json_size: {
		docUrl: "https://trino.io/docs/current/functions/json.html",
		description: "Like json_extract, but returns the size of the value.",
		origin: "vendor-docs",
	},
	kurtosis: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the excess kurtosis of all input values.",
		origin: "vendor-docs",
	},
	lag: {
		docUrl: "https://trino.io/docs/current/functions/window.html",
		description: "Returns the value at `offset` rows before the current row in the window partition.",
		origin: "vendor-docs",
	},
	last_day_of_month: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the last day of the month.",
		origin: "vendor-docs",
	},
	last_value: {
		docUrl: "https://trino.io/docs/current/functions/window.html",
		description: "Returns the last value of the window.",
		origin: "vendor-docs",
	},
	lead: {
		docUrl: "https://trino.io/docs/current/functions/window.html",
		description: "Returns the value at `offset` rows after the current row in the window partition.",
		origin: "vendor-docs",
	},
	learn_classifier: {
		docUrl: "https://trino.io/docs/current/functions/ml.html",
		description: "Returns an SVM-based classifier model, trained with the given label and feature data sets.",
		origin: "vendor-docs",
	},
	learn_libsvm_classifier: {
		docUrl: "https://trino.io/docs/current/functions/ml.html",
		description: "Returns an SVM-based classifier model, trained with the given label and feature data sets.",
		origin: "vendor-docs",
	},
	learn_libsvm_regressor: {
		docUrl: "https://trino.io/docs/current/functions/ml.html",
		description: "Returns an SVM-based regressor model, trained with the given target and feature data sets.",
		origin: "vendor-docs",
	},
	learn_regressor: {
		docUrl: "https://trino.io/docs/current/functions/ml.html",
		description: "Returns an SVM-based regressor model, trained with the given target and feature data sets.",
		origin: "vendor-docs",
	},
	length: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	levenshtein_distance: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Returns the Levenshtein edit distance of `string1` and `string2`, i.e.",
		origin: "vendor-docs",
	},
	line_interpolate_point: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns a Point interpolated along a LineString at the fraction given.",
		origin: "vendor-docs",
	},
	line_interpolate_points: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns an array of Points interpolated along a LineString.",
		origin: "vendor-docs",
	},
	line_locate_point: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description:
			"Returns a float between 0 and 1 representing the location of the closest point on the LineString to the given Point, as a fraction of total 2d line length.",
		origin: "vendor-docs",
	},
	listagg: {
		description: "Returns the concatenated input values, separated by the `separator` string.",
		origin: "vendor-docs",
	},
	ln: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the natural logarithm of `x`.",
		origin: "vendor-docs",
	},
	log: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the base `b` logarithm of `x`.",
		origin: "vendor-docs",
	},
	log10: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the base 10 logarithm of `x`.",
		origin: "vendor-docs",
	},
	log2: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the base 2 logarithm of `x`.",
		origin: "vendor-docs",
	},
	lower: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Converts `string` to lowercase.",
		origin: "vendor-docs",
	},
	lpad: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	ltrim: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Removes leading whitespace from `string`.",
		origin: "vendor-docs",
	},
	luhn_check: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Tests whether a `string` of digits is valid according to the Luhn algorithm.",
		origin: "vendor-docs",
	},
	make_set_digest: {
		docUrl: "https://trino.io/docs/current/functions/setdigest.html",
		description: "Composes all input values of `x` into a `setdigest`.",
		origin: "vendor-docs",
	},
	map_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns a map created from the input `key` / `value` pairs.",
		origin: "vendor-docs",
	},
	max: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the maximum value of all input values.",
		origin: "vendor-docs",
	},
	max_by: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the value of `x` associated with the maximum value of `y` over all input values.",
		origin: "vendor-docs",
	},
	md5: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Computes the MD5 hash of `binary`.",
		origin: "vendor-docs",
	},
	merge: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	merge_set_digest: {
		docUrl: "https://trino.io/docs/current/functions/setdigest.html",
		description:
			"Returns the `setdigest` of the aggregate union of the individual `setdigest` Set Digest structures.",
		origin: "vendor-docs",
	},
	millisecond: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the millisecond of the second from `x`.",
		origin: "vendor-docs",
	},
	min: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the minimum value of all input values.",
		origin: "vendor-docs",
	},
	min_by: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the value of `x` associated with the minimum value of `y` over all input values.",
		origin: "vendor-docs",
	},
	minute: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the minute of the hour from `x`.",
		origin: "vendor-docs",
	},
	mod: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the modulo (remainder) of `n` divided by `m`.",
		origin: "vendor-docs",
	},
	month: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the month of the year from `x`.",
		origin: "vendor-docs",
	},
	multimap_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns a multimap created from the input `key` / `value` pairs.",
		origin: "vendor-docs",
	},
	murmur3: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Computes the 128-bit MurmurHash3 hash of `binary`.",
		origin: "vendor-docs",
	},
	nan: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the constant representing not-a-number.",
		origin: "vendor-docs",
	},
	normal_cdf: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Compute the Normal cdf with given mean and standard deviation (sd): P(N \\< v; mean, sd).",
		origin: "vendor-docs",
	},
	normalize: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Transforms `string` with NFC normalization form.",
		origin: "vendor-docs",
	},
	now: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "This is an alias for `current_timestamp`.",
		origin: "vendor-docs",
	},
	nth_value: {
		docUrl: "https://trino.io/docs/current/functions/window.html",
		description: "Returns the value at the specified offset from the beginning of the window.",
		origin: "vendor-docs",
	},
	ntile: {
		docUrl: "https://trino.io/docs/current/functions/window.html",
		description: "Divides the rows for each window partition into `n` buckets ranging from `1` to at most `n`.",
		origin: "vendor-docs",
	},
	nullif: {
		docUrl: "https://trino.io/docs/current/functions/conditional.html",
		description: "Returns null if `value1` equals `value2`, otherwise returns `value1`.",
		origin: "vendor-docs",
	},
	numeric_histogram: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	parse_data_size: {
		docUrl: "https://trino.io/docs/current/functions/conversion.html",
		description:
			"Parses `string` of format `value unit` into a number, where `value` is the fractional number of `unit` values.",
		origin: "vendor-docs",
	},
	parse_datetime: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Parses `string` into a timestamp with time zone using `format`.",
		origin: "vendor-docs",
	},
	parse_duration: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description:
			"Parses `string` of format `value unit` into an interval, where `value` is fractional number of `unit` values.",
		origin: "vendor-docs",
	},
	percent_rank: {
		docUrl: "https://trino.io/docs/current/functions/window.html",
		description: "Returns the percentage ranking of a value in group of values.",
		origin: "vendor-docs",
	},
	pi: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the constant Pi.",
		origin: "vendor-docs",
	},
	pow: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "This is an alias for power.",
		origin: "vendor-docs",
	},
	power: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns `x` raised to the power of `p`.",
		origin: "vendor-docs",
	},
	qdigest_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	quarter: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the quarter of the year from `x`.",
		origin: "vendor-docs",
	},
	radians: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Converts angle `x` in degrees to radians.",
		origin: "vendor-docs",
	},
	rand: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "This is an alias for random().",
		origin: "vendor-docs",
	},
	random: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns a pseudo-random value in the range 0.0 \\<= x \\< 1.0.",
		origin: "vendor-docs",
	},
	rank: {
		docUrl: "https://trino.io/docs/current/functions/window.html",
		description: "Returns the rank of a value in a group of values.",
		origin: "vendor-docs",
	},
	reduce: { description: "Returns a single value reduced from `array`.", origin: "vendor-docs" },
	regexp_count: {
		docUrl: "https://trino.io/docs/current/functions/regexp.html",
		description: "Returns the number of occurrence of `pattern` in `string`.",
		origin: "vendor-docs",
	},
	regexp_extract: {
		docUrl: "https://trino.io/docs/current/functions/regexp.html",
		description: "Returns the first substring matched by the regular expression `pattern` in `string`.",
		origin: "vendor-docs",
	},
	regexp_extract_all: {
		docUrl: "https://trino.io/docs/current/functions/regexp.html",
		description: "Returns the substring(s) matched by the regular expression `pattern` in `string`.",
		origin: "vendor-docs",
	},
	regexp_like: {
		docUrl: "https://trino.io/docs/current/functions/regexp.html",
		description: "Evaluates the regular expression `pattern` and determines if it is contained within `string`.",
		origin: "vendor-docs",
	},
	regexp_position: {
		docUrl: "https://trino.io/docs/current/functions/regexp.html",
		description: "Returns the index of the first occurrence (counting from 1) of `pattern` in `string`.",
		origin: "vendor-docs",
	},
	regexp_replace: {
		docUrl: "https://trino.io/docs/current/functions/regexp.html",
		description:
			"Removes every instance of the substring matched by the regular expression `pattern` from `string`.",
		origin: "vendor-docs",
	},
	regexp_split: {
		docUrl: "https://trino.io/docs/current/functions/regexp.html",
		description: "Splits `string` using the regular expression `pattern` and returns an array.",
		origin: "vendor-docs",
	},
	regr_intercept: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns linear regression intercept of input values.",
		origin: "vendor-docs",
	},
	regr_slope: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns linear regression slope of input values.",
		origin: "vendor-docs",
	},
	regress: {
		docUrl: "https://trino.io/docs/current/functions/ml.html",
		description: "Returns a predicted target value by the given regressor SVM model.",
		origin: "vendor-docs",
	},
	render: {
		docUrl: "https://trino.io/docs/current/functions/color.html",
		description: "Renders value `x` using the specific color using ANSI color codes.",
		origin: "vendor-docs",
	},
	repeat: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Repeat `element` for `count` times.",
		origin: "vendor-docs",
	},
	replace: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Removes all instances of `search` from `string`.",
		origin: "vendor-docs",
	},
	reverse: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	rgb: {
		docUrl: "https://trino.io/docs/current/functions/color.html",
		description:
			"Returns a color value capturing the RGB value of three component color values supplied as int parameters ranging from 0 to 255: `red`, `green`, `blue`.",
		origin: "vendor-docs",
	},
	round: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns `x` rounded to the nearest integer.",
		origin: "vendor-docs",
	},
	row_number: {
		docUrl: "https://trino.io/docs/current/functions/window.html",
		description:
			"Returns a unique, sequential number for each row, starting with one, according to the ordering of rows within the window partition.",
		origin: "vendor-docs",
	},
	rpad: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	rtrim: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Removes trailing whitespace from `string`.",
		origin: "vendor-docs",
	},
	second: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the second of the minute from `x`.",
		origin: "vendor-docs",
	},
	sequence: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description:
			"Generate a sequence of integers from `start` to `stop`, incrementing by `1` if `start` is less than or equal to `stop`, otherwise `-1`.",
		origin: "vendor-docs",
	},
	sha1: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Computes the SHA1 hash of `binary`.",
		origin: "vendor-docs",
	},
	sha256: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Computes the SHA256 hash of `binary`.",
		origin: "vendor-docs",
	},
	sha512: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Computes the SHA512 hash of `binary`.",
		origin: "vendor-docs",
	},
	shuffle: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Generate a random permutation of the given array `x`.",
		origin: "vendor-docs",
	},
	sign: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the signum function of `x`, that is.",
		origin: "vendor-docs",
	},
	simplify_geometry: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: 'Returns a "simplified" version of the input geometry using the Douglas-Peucker algorithm.',
		origin: "vendor-docs",
	},
	sin: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the sine of `x`.",
		origin: "vendor-docs",
	},
	sinh: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the hyperbolic sine of `x`.",
		origin: "vendor-docs",
	},
	skewness: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the Fisher’s moment coefficient of skewness of all input values.",
		origin: "vendor-docs",
	},
	slice: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description:
			"Subsets array `x` starting from index `start` (or starting from the end if `start` is negative) with a length of `length`.",
		origin: "vendor-docs",
	},
	soundex: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "`soundex` returns a character string containing the phonetic representation of `char`.",
		origin: "vendor-docs",
	},
	split: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Splits `string` on `delimiter` and returns an array.",
		origin: "vendor-docs",
	},
	split_part: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Splits `string` on `delimiter` and returns the field `index`.",
		origin: "vendor-docs",
	},
	split_to_map: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Splits `string` by `entryDelimiter` and `keyValueDelimiter` and returns a map.",
		origin: "vendor-docs",
	},
	split_to_multimap: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description:
			"Splits `string` by `entryDelimiter` and `keyValueDelimiter` and returns a map containing an array of values for each unique key.",
		origin: "vendor-docs",
	},
	spooky_hash_v2_32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Computes the 32-bit SpookyHashV2 hash of `binary`.",
		origin: "vendor-docs",
	},
	spooky_hash_v2_64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Computes the 64-bit SpookyHashV2 hash of `binary`.",
		origin: "vendor-docs",
	},
	sqrt: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the square root of `x`.",
		origin: "vendor-docs",
	},
	st_area: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the 2D Euclidean area of a geometry.",
		origin: "vendor-docs",
	},
	st_asbinary: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the WKB representation of the geometry.",
		origin: "vendor-docs",
	},
	st_astext: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the WKT representation of the geometry.",
		origin: "vendor-docs",
	},
	st_boundary: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the closure of the combinatorial boundary of this geometry.",
		origin: "vendor-docs",
	},
	st_buffer: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description:
			"Returns the geometry that represents all points whose distance from the specified geometry is less than or equal to the specified distance.",
		origin: "vendor-docs",
	},
	st_centroid: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the point value that is the mathematical centroid of a geometry.",
		origin: "vendor-docs",
	},
	st_contains: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description:
			"Returns `true` if and only if no points of the second geometry lie in the exterior of the first geometry, and at least one point of the interior of the first geometry lies in the interior of the second geometry.",
		origin: "vendor-docs",
	},
	st_convexhull: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the minimum convex geometry that encloses all input geometries.",
		origin: "vendor-docs",
	},
	st_coorddim: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the coordinate dimension of the geometry.",
		origin: "vendor-docs",
	},
	st_crosses: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns `true` if the supplied geometries have some, but not all, interior points in common.",
		origin: "vendor-docs",
	},
	st_difference: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the geometry value that represents the point set difference of the given geometries.",
		origin: "vendor-docs",
	},
	st_dimension: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description:
			"Returns the inherent dimension of this geometry object, which must be less than or equal to the coordinate dimension.",
		origin: "vendor-docs",
	},
	st_disjoint: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description:
			"Returns `true` if the give geometries do not *spatially intersect* -- if they do not share any space together.",
		origin: "vendor-docs",
	},
	st_distance: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	st_endpoint: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the last point of a LineString geometry as a Point.",
		origin: "vendor-docs",
	},
	st_envelope: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the bounding rectangular polygon of a geometry.",
		origin: "vendor-docs",
	},
	st_envelopeaspts: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description:
			"Returns an array of two points: the lower left and upper right corners of the bounding rectangular polygon of a geometry.",
		origin: "vendor-docs",
	},
	st_equals: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns `true` if the given geometries represent the same geometry.",
		origin: "vendor-docs",
	},
	st_exteriorring: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns a line string representing the exterior ring of the input polygon.",
		origin: "vendor-docs",
	},
	st_geometries: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns an array of geometries in the specified collection.",
		origin: "vendor-docs",
	},
	st_geometryfromtext: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns a geometry type object from WKT representation.",
		origin: "vendor-docs",
	},
	st_geometryn: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the geometry element at a given index (indices start at 1).",
		origin: "vendor-docs",
	},
	st_geometrytype: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the type of the geometry.",
		origin: "vendor-docs",
	},
	st_geomfrombinary: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns a geometry type object from WKB or EWKB representation.",
		origin: "vendor-docs",
	},
	st_geomfromkml: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns a geometry type object from KML representation.",
		origin: "vendor-docs",
	},
	st_interiorringn: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the interior ring element at the specified index (indices start at 1).",
		origin: "vendor-docs",
	},
	st_interiorrings: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description:
			"Returns an array of all interior rings found in the input geometry, or an empty array if the polygon has no interior rings.",
		origin: "vendor-docs",
	},
	st_intersection: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the geometry value that represents the point set intersection of two geometries.",
		origin: "vendor-docs",
	},
	st_intersects: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description:
			"Returns `true` if the given geometries spatially intersect in two dimensions (share any portion of space) and `false` if they do not (they are disjoint).",
		origin: "vendor-docs",
	},
	st_isclosed: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns `true` if the linestring's start and end points are coincident.",
		origin: "vendor-docs",
	},
	st_isempty: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns `true` if this Geometry is an empty geometrycollection, polygon, point etc.",
		origin: "vendor-docs",
	},
	st_isring: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns `true` if and only if the line is closed and simple.",
		origin: "vendor-docs",
	},
	st_issimple: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description:
			"Returns `true` if this Geometry has no anomalous geometric points, such as self intersection or self tangency.",
		origin: "vendor-docs",
	},
	st_isvalid: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns `true` if and only if the input geometry is well-formed.",
		origin: "vendor-docs",
	},
	st_length: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description:
			"Returns the length of a linestring or multi-linestring using Euclidean measurement on a two-dimensional plane (based on spatial ref) in projected units.",
		origin: "vendor-docs",
	},
	st_linefromtext: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns a geometry type linestring object from WKT representation.",
		origin: "vendor-docs",
	},
	st_numgeometries: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the number of geometries in the collection.",
		origin: "vendor-docs",
	},
	st_numinteriorring: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the cardinality of the collection of interior rings of a polygon.",
		origin: "vendor-docs",
	},
	st_numpoints: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the number of points in a geometry.",
		origin: "vendor-docs",
	},
	st_overlaps: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description:
			"Returns `true` if the given geometries share space, are of the same dimension, but are not completely contained by each other.",
		origin: "vendor-docs",
	},
	st_point: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns a geometry type point object with the given coordinate values.",
		origin: "vendor-docs",
	},
	st_pointn: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the vertex of a linestring at a given index (indices start at 1).",
		origin: "vendor-docs",
	},
	st_points: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns an array of points in a linestring.",
		origin: "vendor-docs",
	},
	st_polygon: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns a geometry type polygon object from WKT representation.",
		origin: "vendor-docs",
	},
	st_relate: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns `true` if first geometry is spatially related to second geometry.",
		origin: "vendor-docs",
	},
	st_startpoint: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the first point of a LineString geometry as a Point.",
		origin: "vendor-docs",
	},
	st_symdifference: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the geometry value that represents the point set symmetric difference of two geometries.",
		origin: "vendor-docs",
	},
	st_touches: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description:
			"Returns `true` if the given geometries have at least one point in common, but their interiors do not intersect.",
		origin: "vendor-docs",
	},
	st_union: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns a geometry that represents the point set union of the input geometries.",
		origin: "vendor-docs",
	},
	st_within: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns `true` if first geometry is completely inside second geometry.",
		origin: "vendor-docs",
	},
	st_x: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the X coordinate of the point.",
		origin: "vendor-docs",
	},
	st_xmax: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns X maxima of a bounding box of a geometry.",
		origin: "vendor-docs",
	},
	st_xmin: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns X minima of a bounding box of a geometry.",
		origin: "vendor-docs",
	},
	st_y: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the Y coordinate of the point.",
		origin: "vendor-docs",
	},
	st_ymax: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns Y maxima of a bounding box of a geometry.",
		origin: "vendor-docs",
	},
	st_ymin: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns Y minima of a bounding box of a geometry.",
		origin: "vendor-docs",
	},
	starts_with: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Tests whether `substring` is a prefix of `string`.",
		origin: "vendor-docs",
	},
	stddev: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "This is an alias for stddev_samp.",
		origin: "vendor-docs",
	},
	stddev_pop: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the population standard deviation of all input values.",
		origin: "vendor-docs",
	},
	stddev_samp: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the sample standard deviation of all input values.",
		origin: "vendor-docs",
	},
	strpos: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Returns the starting position of the first instance of `substring` in `string`.",
		origin: "vendor-docs",
	},
	substr: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	substring: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Returns the rest of `string` from the starting position `start`.",
		origin: "vendor-docs",
	},
	sum: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the sum of all input values.",
		origin: "vendor-docs",
	},
	t_cdf: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description:
			"Compute the Student's t-distribution cumulative density function for given x and degrees of freedom (df).",
		origin: "vendor-docs",
	},
	t_pdf: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description:
			"Computes the Student's t-distribution probability density function for given x and degrees of freedom (df).",
		origin: "vendor-docs",
	},
	tan: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the tangent of `x`.",
		origin: "vendor-docs",
	},
	tanh: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the hyperbolic tangent of `x`.",
		origin: "vendor-docs",
	},
	tdigest_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	theta_sketch_cardinality: {
		docUrl: "https://trino.io/docs/current/functions/datasketches.html",
		description: "Returns the estimated value of the sketch.",
		origin: "vendor-docs",
	},
	timezone_hour: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the hour of the time zone offset from `timestamp`.",
		origin: "vendor-docs",
	},
	timezone_minute: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the minute of the time zone offset from `timestamp`.",
		origin: "vendor-docs",
	},
	to_base: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns the base-`radix` representation of `x`.",
		origin: "vendor-docs",
	},
	to_base32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Encodes `binary` into a base32 string representation.",
		origin: "vendor-docs",
	},
	to_base64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Encodes `binary` into a base64 string representation.",
		origin: "vendor-docs",
	},
	to_base64url: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Encodes `binary` into a base64 string representation using the URL safe alphabet.",
		origin: "vendor-docs",
	},
	to_big_endian_32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Encodes `integer` into a 32-bit two's complement big-endian format.",
		origin: "vendor-docs",
	},
	to_big_endian_64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Encodes `bigint` into a 64-bit two's complement big-endian format.",
		origin: "vendor-docs",
	},
	to_char: {
		docUrl: "https://trino.io/docs/current/functions/teradata.html",
		description: "Formats `timestamp` as a string using `format`.",
		origin: "vendor-docs",
	},
	to_date: {
		docUrl: "https://trino.io/docs/current/functions/teradata.html",
		description: "Parses `string` into a `DATE` using `format`.",
		origin: "vendor-docs",
	},
	to_encoded_polyline: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Encodes a linestring or multipoint to a polyline.",
		origin: "vendor-docs",
	},
	to_geojson_geometry: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Returns the GeoJSON encoded defined by the input spherical geography.",
		origin: "vendor-docs",
	},
	to_geometry: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Converts a SphericalGeography object to a Geometry object.",
		origin: "vendor-docs",
	},
	to_hex: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Encodes `binary` into a hex string representation.",
		origin: "vendor-docs",
	},
	to_ieee754_32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description:
			"Encodes `real` into a 32-bit big-endian binary according to IEEE 754 single-precision floating-point format.",
		origin: "vendor-docs",
	},
	to_ieee754_64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description:
			"Encodes `double` into a 64-bit big-endian binary according to IEEE 754 double-precision floating-point format.",
		origin: "vendor-docs",
	},
	to_iso8601: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Formats `x` as an ISO 8601 string.",
		origin: "vendor-docs",
	},
	to_milliseconds: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the day-to-second `interval` as milliseconds.",
		origin: "vendor-docs",
	},
	to_spherical_geography: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html",
		description: "Converts a Geometry object to a SphericalGeography object on the sphere of the Earth's radius.",
		origin: "vendor-docs",
	},
	to_timestamp: {
		docUrl: "https://trino.io/docs/current/functions/teradata.html",
		description: "Parses `string` into a `TIMESTAMP` using `format`.",
		origin: "vendor-docs",
	},
	to_unixtime: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns `timestamp` as a UNIX timestamp.",
		origin: "vendor-docs",
	},
	to_utf8: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Encodes `string` into a UTF-8 varbinary representation.",
		origin: "vendor-docs",
	},
	transform: {
		description: "Returns an array that is the result of applying `function` to each element of `array`.",
		origin: "vendor-docs",
	},
	trim: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	trim_array: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Remove `n` elements from the end of array.",
		origin: "vendor-docs",
	},
	truncate: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description: "Returns `x` rounded to integer by dropping digits after decimal point.",
		origin: "vendor-docs",
	},
	try: {
		docUrl: "https://trino.io/docs/current/functions/conditional.html",
		description: "Evaluate an expression and handle certain types of errors by returning `NULL`.",
		origin: "vendor-docs",
	},
	typeof: {
		docUrl: "https://trino.io/docs/current/functions/conversion.html",
		description: "Returns the name of the type of the provided expression.",
		origin: "vendor-docs",
	},
	upper: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Converts `string` to uppercase.",
		origin: "vendor-docs",
	},
	url_decode: {
		docUrl: "https://trino.io/docs/current/functions/url.html",
		description: "Unescapes the URL encoded `value`.",
		origin: "vendor-docs",
	},
	url_encode: {
		docUrl: "https://trino.io/docs/current/functions/url.html",
		description:
			"Escapes `value` by encoding it so that it can be safely included in URL query parameter names and values.",
		origin: "vendor-docs",
	},
	url_extract_fragment: {
		docUrl: "https://trino.io/docs/current/functions/url.html",
		description: "Returns the fragment identifier from `url`.",
		origin: "vendor-docs",
	},
	url_extract_host: {
		docUrl: "https://trino.io/docs/current/functions/url.html",
		description: "Returns the host from `url`.",
		origin: "vendor-docs",
	},
	url_extract_parameter: {
		docUrl: "https://trino.io/docs/current/functions/url.html",
		description: "Returns the value of the first query string parameter named `name` from `url`.",
		origin: "vendor-docs",
	},
	url_extract_path: {
		docUrl: "https://trino.io/docs/current/functions/url.html",
		description: "Returns the path from `url`.",
		origin: "vendor-docs",
	},
	url_extract_port: {
		docUrl: "https://trino.io/docs/current/functions/url.html",
		description: "Returns the port number from `url`.",
		origin: "vendor-docs",
	},
	url_extract_protocol: {
		docUrl: "https://trino.io/docs/current/functions/url.html",
		description: "Returns the protocol from `url`.",
		origin: "vendor-docs",
	},
	url_extract_query: {
		docUrl: "https://trino.io/docs/current/functions/url.html",
		description: "Returns the query string from `url`.",
		origin: "vendor-docs",
	},
	uuid: {
		docUrl: "https://trino.io/docs/current/functions/uuid.html",
		description: "Returns a pseudo randomly generated uuid-type (type 4).",
		origin: "vendor-docs",
	},
	value_at_quantile: {
		docUrl: "https://trino.io/docs/current/functions/tdigest.html",
		description:
			"Returns the approximate percentile value from the quantile digest given the number `quantile` between 0 and 1.",
		origin: "vendor-docs",
	},
	values_at_quantiles: {
		docUrl: "https://trino.io/docs/current/functions/tdigest.html",
		description:
			"Returns the approximate percentile values as an array given the input quantile digest and array of values between 0 and 1 which represent the quantiles to return.",
		origin: "vendor-docs",
	},
	var_pop: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the population variance of all input values.",
		origin: "vendor-docs",
	},
	var_samp: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "Returns the sample variance of all input values.",
		origin: "vendor-docs",
	},
	variance: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html",
		description: "This is an alias for var_samp.",
		origin: "vendor-docs",
	},
	variant_is_null: {
		docUrl: "https://trino.io/docs/current/functions/variant.html",
		description: "Returns `true` if the input value represents a *variant null*.",
		origin: "vendor-docs",
	},
	version: {
		docUrl: "https://trino.io/docs/current/functions/system.html",
		description: "Returns the Trino version used on the cluster.",
		origin: "vendor-docs",
	},
	week: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the [ISO week] of the year from `x`.",
		origin: "vendor-docs",
	},
	week_of_year: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "This is an alias for week.",
		origin: "vendor-docs",
	},
	width_bucket: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description:
			"Returns the bin number of `x` in an equi-width histogram with the specified `bound1` and `bound2` bounds and `n` number of buckets.",
		origin: "vendor-docs",
	},
	wilson_interval_lower: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description:
			"Returns the lower bound of the Wilson score interval of a Bernoulli trial process at a confidence specified by the z-score `z`.",
		origin: "vendor-docs",
	},
	wilson_interval_upper: {
		docUrl: "https://trino.io/docs/current/functions/math.html",
		description:
			"Returns the upper bound of the Wilson score interval of a Bernoulli trial process at a confidence specified by the z-score `z`.",
		origin: "vendor-docs",
	},
	word_stem: {
		docUrl: "https://trino.io/docs/current/functions/string.html",
		description: "Returns the stem of `word` in the English language.",
		origin: "vendor-docs",
	},
	xxhash64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html",
		description: "Computes the xxHash64 hash of `binary`.",
		origin: "vendor-docs",
	},
	year: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the year from `x`.",
		origin: "vendor-docs",
	},
	year_of_week: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "Returns the year of the [ISO week] from `x`.",
		origin: "vendor-docs",
	},
	yow: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html",
		description: "This is an alias for year_of_week.",
		origin: "vendor-docs",
	},
	zip: {
		docUrl: "https://trino.io/docs/current/functions/array.html",
		description: "Merges the given arrays, element-wise, into a single array of rows.",
		origin: "vendor-docs",
	},
};
