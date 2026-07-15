// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for trino (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-15. 387 names (385 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const TRINO_FN_DOCS: Record<string, FnDoc> = {
	abs: {
		docUrl: "https://trino.io/docs/current/functions/math.html#abs",
		description: "Returns the absolute value of `x`.",
		origin: "vendor-docs",
	},
	acos: {
		docUrl: "https://trino.io/docs/current/functions/math.html#acos",
		description: "Returns the arc cosine of `x`.",
		origin: "vendor-docs",
	},
	ai_analyze_sentiment: {
		docUrl: "https://trino.io/docs/current/functions/ai.html#ai_analyze_sentiment",
		description: "Analyzes the sentiment of the input text.",
		origin: "vendor-docs",
	},
	ai_classify: {
		docUrl: "https://trino.io/docs/current/functions/ai.html#ai_classify",
		description: "Classifies the input text according to the provided labels.",
		origin: "vendor-docs",
	},
	ai_extract: {
		docUrl: "https://trino.io/docs/current/functions/ai.html#ai_extract",
		description: "Extracts values for the provided labels from the input text.",
		origin: "vendor-docs",
	},
	ai_fix_grammar: {
		docUrl: "https://trino.io/docs/current/functions/ai.html#ai_fix_grammar",
		description: "Corrects grammatical errors in the input text.",
		origin: "vendor-docs",
	},
	ai_gen: {
		docUrl: "https://trino.io/docs/current/functions/ai.html#ai_gen",
		description: "Generates text based on the input prompt.",
		origin: "vendor-docs",
	},
	ai_mask: {
		docUrl: "https://trino.io/docs/current/functions/ai.html#ai_mask",
		description:
			"Masks the values for the provided labels in the input text by replacing them with the text `[MASKED]`.",
		origin: "vendor-docs",
	},
	ai_translate: {
		docUrl: "https://trino.io/docs/current/functions/ai.html#ai_translate",
		description: "Translates the input text to the specified language.",
		origin: "vendor-docs",
	},
	any_value: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#any_value",
		description: "Returns an arbitrary non-null value `x`, if one exists.",
		origin: "vendor-docs",
	},
	approx_distinct: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#approx_distinct",
		description: "Returns the approximate number of distinct input values.",
		origin: "vendor-docs",
	},
	approx_most_frequent: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#approx_most_frequent",
		description: "Computes the top frequent values up to `buckets` elements approximately.",
		origin: "vendor-docs",
	},
	approx_percentile: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#approx_percentile",
		description: "Returns the approximate percentile for all input values of `x` at the given `percentage`.",
		origin: "vendor-docs",
	},
	approx_set: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#approx_set",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	arbitrary: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#arbitrary",
		description: "Returns an arbitrary non-null value of `x`, if one exists.",
		origin: "vendor-docs",
	},
	array_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#array_agg",
		description: "Returns an array created from the input `x` elements.",
		origin: "vendor-docs",
	},
	array_distinct: {
		docUrl: "https://trino.io/docs/current/functions/array.html#array_distinct",
		description: "Remove duplicate values from the array `x`.",
		origin: "vendor-docs",
	},
	array_except: {
		docUrl: "https://trino.io/docs/current/functions/array.html#array_except",
		description: "Returns an array of elements in `x` but not in `y`, without duplicates.",
		origin: "vendor-docs",
	},
	array_histogram: {
		docUrl: "https://trino.io/docs/current/functions/array.html#array_histogram",
		description:
			"Returns a map where the keys are the unique elements in the input array `x` and the values are the number of times that each element appears in `x`.",
		origin: "vendor-docs",
	},
	array_intersect: {
		docUrl: "https://trino.io/docs/current/functions/array.html#array_intersect",
		description: "Returns an array of the elements in the intersection of `x` and `y`, without duplicates.",
		origin: "vendor-docs",
	},
	array_join: {
		docUrl: "https://trino.io/docs/current/functions/array.html#array_join",
		description: "Concatenates the elements of the given array using the delimiter.",
		origin: "vendor-docs",
	},
	array_max: {
		docUrl: "https://trino.io/docs/current/functions/array.html#array_max",
		description: "Returns the maximum value of input array.",
		origin: "vendor-docs",
	},
	array_min: {
		docUrl: "https://trino.io/docs/current/functions/array.html#array_min",
		description: "Returns the minimum value of input array.",
		origin: "vendor-docs",
	},
	array_position: {
		docUrl: "https://trino.io/docs/current/functions/array.html#array_position",
		description: "Returns the position of the first occurrence of the `element` in array `x` (or 0 if not found).",
		origin: "vendor-docs",
	},
	array_remove: {
		docUrl: "https://trino.io/docs/current/functions/array.html#array_remove",
		description: "Remove all elements that equal `element` from array `x`.",
		origin: "vendor-docs",
	},
	array_sort: {
		docUrl: "https://trino.io/docs/current/functions/array.html#array_sort",
		description: "Sorts and returns the array `x`.",
		origin: "vendor-docs",
	},
	array_union: {
		docUrl: "https://trino.io/docs/current/functions/array.html#array_union",
		description: "Returns an array of the elements in the union of `x` and `y`, without duplicates.",
		origin: "vendor-docs",
	},
	arrays_overlap: {
		docUrl: "https://trino.io/docs/current/functions/array.html#arrays_overlap",
		description: "Tests if arrays `x` and `y` have any non-null elements in common.",
		origin: "vendor-docs",
	},
	asin: {
		docUrl: "https://trino.io/docs/current/functions/math.html#asin",
		description: "Returns the arc sine of `x`.",
		origin: "vendor-docs",
	},
	at_timezone: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#at_timezone",
		description: "Converts `x` to a time zone specified in `zone`.",
		origin: "vendor-docs",
	},
	atan: {
		docUrl: "https://trino.io/docs/current/functions/math.html#atan",
		description: "Returns the arc tangent of `x`.",
		origin: "vendor-docs",
	},
	atan2: {
		docUrl: "https://trino.io/docs/current/functions/math.html#atan2",
		description: "Returns the arc tangent of `y / x`.",
		origin: "vendor-docs",
	},
	avg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#avg",
		description: "Returns the average (arithmetic mean) of all input values.",
		origin: "vendor-docs",
	},
	bar: {
		docUrl: "https://trino.io/docs/current/functions/color.html#bar",
		description:
			"Renders a single bar in an ANSI bar chart using a default `low_color` of red and a `high_color` of green.",
		origin: "vendor-docs",
	},
	beta_cdf: {
		docUrl: "https://trino.io/docs/current/functions/math.html#beta_cdf",
		description: "Compute the Beta cdf with given a, b parameters: P(N \\< v; a, b).",
		origin: "vendor-docs",
	},
	bing_tile: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#bing_tile",
		description: "Creates a Bing tile object from XY coordinates and a zoom level.",
		origin: "vendor-docs",
	},
	bing_tile_at: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#bing_tile_at",
		description: "Returns a Bing tile at a given zoom level containing a point at a given latitude and longitude.",
		origin: "vendor-docs",
	},
	bing_tile_coordinates: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#bing_tile_coordinates",
		description: "Returns the XY coordinates of a given Bing tile.",
		origin: "vendor-docs",
	},
	bing_tile_polygon: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#bing_tile_polygon",
		description: "Returns the polygon representation of a given Bing tile.",
		origin: "vendor-docs",
	},
	bing_tile_quadkey: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#bing_tile_quadkey",
		description: "Returns the quadkey of a given Bing tile.",
		origin: "vendor-docs",
	},
	bing_tile_zoom_level: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#bing_tile_zoom_level",
		description: "Returns the zoom level of a given Bing tile.",
		origin: "vendor-docs",
	},
	bing_tiles_around: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#bing_tiles_around",
		description:
			"Returns a collection of Bing tiles that surround the point specified by the latitude and longitude arguments at a given zoom level.",
		origin: "vendor-docs",
	},
	bit_count: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html#bit_count",
		description:
			"Count the number of bits set in `x` (treated as `bits`-bit signed integer) in 2's complement representation.",
		origin: "vendor-docs",
	},
	bitwise_and: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html#bitwise_and",
		description: "Returns the bitwise AND of `x` and `y` in 2's complement representation.",
		origin: "vendor-docs",
	},
	bitwise_and_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#bitwise_and_agg",
		description: "Returns the bitwise AND of all input non-NULL values in 2's complement representation.",
		origin: "vendor-docs",
	},
	bitwise_left_shift: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html#bitwise_left_shift",
		description: "Returns the left shifted value of `value`.",
		origin: "vendor-docs",
	},
	bitwise_not: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html#bitwise_not",
		description: "Returns the bitwise NOT of `x` in 2's complement representation (`NOT x = -x - 1`).",
		origin: "vendor-docs",
	},
	bitwise_or: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html#bitwise_or",
		description: "Returns the bitwise OR of `x` and `y` in 2's complement representation.",
		origin: "vendor-docs",
	},
	bitwise_or_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#bitwise_or_agg",
		description: "Returns the bitwise OR of all input non-NULL values in 2's complement representation.",
		origin: "vendor-docs",
	},
	bitwise_right_shift: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html#bitwise_right_shift",
		description: "Returns the logical right shifted value of `value`.",
		origin: "vendor-docs",
	},
	bitwise_right_shift_arithmetic: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html#bitwise_right_shift_arithmetic",
		description: "Returns the arithmetic right shifted value of `value`.",
		origin: "vendor-docs",
	},
	bitwise_xor: {
		docUrl: "https://trino.io/docs/current/functions/bitwise.html#bitwise_xor",
		description: "Returns the bitwise XOR of `x` and `y` in 2's complement representation.",
		origin: "vendor-docs",
	},
	bitwise_xor_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#bitwise_xor_agg",
		description: "Returns the bitwise XOR of all input non-NULL values in 2's complement representation.",
		origin: "vendor-docs",
	},
	bool_and: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#bool_and",
		description: "Returns `TRUE` if every input value is `TRUE`, otherwise `FALSE`.",
		origin: "vendor-docs",
	},
	bool_or: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#bool_or",
		description: "Returns `TRUE` if any input value is `TRUE`, otherwise `FALSE`.",
		origin: "vendor-docs",
	},
	cardinality: {
		docUrl: "https://trino.io/docs/current/functions/array.html#cardinality",
		description: "Returns the cardinality (size) of the array `x`.",
		origin: "vendor-docs",
	},
	cbrt: {
		docUrl: "https://trino.io/docs/current/functions/math.html#cbrt",
		description: "Returns the cube root of `x`.",
		origin: "vendor-docs",
	},
	ceil: {
		docUrl: "https://trino.io/docs/current/functions/math.html#ceil",
		description: "This is an alias for ceiling.",
		origin: "vendor-docs",
	},
	ceiling: {
		docUrl: "https://trino.io/docs/current/functions/math.html#ceiling",
		description: "Returns `x` rounded up to the nearest integer.",
		origin: "vendor-docs",
	},
	char2hexint: {
		docUrl: "https://trino.io/docs/current/functions/teradata.html#char2hexint",
		description: "Returns the hexadecimal representation of the UTF-16BE encoding of the string.",
		origin: "vendor-docs",
	},
	checksum: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#checksum",
		description: "Returns an order-insensitive checksum of the given values.",
		origin: "vendor-docs",
	},
	chr: {
		docUrl: "https://trino.io/docs/current/functions/string.html#chr",
		description: "Returns the Unicode code point `n` as a single character string.",
		origin: "vendor-docs",
	},
	classify: {
		docUrl: "https://trino.io/docs/current/functions/ml.html#classify",
		description: "Returns a label predicted by the given classifier SVM model.",
		origin: "vendor-docs",
	},
	coalesce: {
		docUrl: "https://trino.io/docs/current/functions/conditional.html#coalesce",
		description: "Returns the first non-null `value` in the argument list.",
		origin: "vendor-docs",
	},
	codepoint: {
		docUrl: "https://trino.io/docs/current/functions/string.html#codepoint",
		description: "Returns the Unicode code point of the only character of `string`.",
		origin: "vendor-docs",
	},
	color: {
		docUrl: "https://trino.io/docs/current/functions/color.html#color",
		description: 'Returns a color capturing a decoded RGB value from a 4-character string of the format "#000".',
		origin: "vendor-docs",
	},
	concat_ws: {
		docUrl: "https://trino.io/docs/current/functions/string.html#concat_ws",
		description:
			"Returns the concatenation of `string1`, `string2`, `...`, `stringN` using `separator` to join the values.",
		origin: "vendor-docs",
	},
	contains: {
		docUrl: "https://trino.io/docs/current/functions/array.html#contains",
		description: "Returns true if the array `x` contains the `element`.",
		origin: "vendor-docs",
	},
	contains_sequence: {
		docUrl: "https://trino.io/docs/current/functions/array.html#contains_sequence",
		description:
			"Return true if array `x` contains all of array `seq` as a subsequence (all values in the same consecutive order).",
		origin: "vendor-docs",
	},
	convex_hull_agg: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#convex_hull_agg",
		description: "Returns the minimum convex geometry that encloses all input geometries.",
		origin: "vendor-docs",
	},
	corr: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#corr",
		description: "Returns correlation coefficient of input values.",
		origin: "vendor-docs",
	},
	cos: {
		docUrl: "https://trino.io/docs/current/functions/math.html#cos",
		description: "Returns the cosine of `x`.",
		origin: "vendor-docs",
	},
	cosh: {
		docUrl: "https://trino.io/docs/current/functions/math.html#cosh",
		description: "Returns the hyperbolic cosine of `x`.",
		origin: "vendor-docs",
	},
	cosine_distance: {
		docUrl: "https://trino.io/docs/current/functions/math.html#cosine_distance",
		description: "Calculates the cosine distance between two dense vectors.",
		origin: "vendor-docs",
	},
	cosine_similarity: {
		docUrl: "https://trino.io/docs/current/functions/math.html#cosine_similarity",
		description: "Calculates the cosine similarity of two dense vectors.",
		origin: "vendor-docs",
	},
	count: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#count",
		description: "Returns the number of input rows.",
		origin: "vendor-docs",
	},
	count_if: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#count_if",
		description: "Returns the number of `TRUE` input values.",
		origin: "vendor-docs",
	},
	covar_pop: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#covar_pop",
		description: "Returns the population covariance of input values.",
		origin: "vendor-docs",
	},
	covar_samp: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#covar_samp",
		description: "Returns the sample covariance of input values.",
		origin: "vendor-docs",
	},
	crc32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#crc32",
		description: "Computes the CRC-32 of `binary`.",
		origin: "vendor-docs",
	},
	cume_dist: {
		docUrl: "https://trino.io/docs/current/functions/window.html#cume_dist",
		description: "Returns the cumulative distribution of a value in a group of values.",
		origin: "vendor-docs",
	},
	current_timezone: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#current_timezone",
		description:
			"Returns the current time zone in the format defined by IANA (e.g., `America/Los_Angeles`) or as fixed offset from UTC (e.g., `+08:35`)",
		origin: "vendor-docs",
	},
	date: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#date",
		description: "This is an alias for `CAST(x AS date)`.",
		origin: "vendor-docs",
	},
	date_add: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#date_add",
		description: "Adds an interval `value` of type `unit` to `timestamp`.",
		origin: "vendor-docs",
	},
	date_diff: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#date_diff",
		description: "Returns `timestamp2 - timestamp1` expressed in terms of `unit`.",
		origin: "vendor-docs",
	},
	date_format: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#date_format",
		description: "Formats `timestamp` as a string using `format`.",
		origin: "vendor-docs",
	},
	date_parse: { docUrl: "https://trino.io/docs/current/functions/datetime.html#date_parse", origin: "vendor-docs" },
	date_trunc: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#date_trunc",
		description: "Returns `x` truncated to `unit`.",
		origin: "vendor-docs",
	},
	day: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#day",
		description: "Returns the day of the month from `x`.",
		origin: "vendor-docs",
	},
	day_of_month: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#day_of_month",
		description: "This is an alias for day.",
		origin: "vendor-docs",
	},
	day_of_week: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#day_of_week",
		description: "Returns the ISO day of the week from `x`.",
		origin: "vendor-docs",
	},
	day_of_year: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#day_of_year",
		description: "Returns the day of the year from `x`.",
		origin: "vendor-docs",
	},
	degrees: {
		docUrl: "https://trino.io/docs/current/functions/math.html#degrees",
		description: "Converts angle `x` in radians to degrees.",
		origin: "vendor-docs",
	},
	dense_rank: {
		docUrl: "https://trino.io/docs/current/functions/window.html#dense_rank",
		description: "Returns the rank of a value in a group of values.",
		origin: "vendor-docs",
	},
	dow: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#dow",
		description: "This is an alias for day_of_week.",
		origin: "vendor-docs",
	},
	doy: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#doy",
		description: "This is an alias for day_of_year.",
		origin: "vendor-docs",
	},
	e: {
		docUrl: "https://trino.io/docs/current/functions/math.html#e",
		description: "Returns the constant Euler's number.",
		origin: "vendor-docs",
	},
	element_at: {
		docUrl: "https://trino.io/docs/current/functions/array.html#element_at",
		description: "Returns element of `array` at given `index`.",
		origin: "vendor-docs",
	},
	empty_approx_set: {
		docUrl: "https://trino.io/docs/current/functions/hyperloglog.html#empty_approx_set",
		description: "Returns an empty `HyperLogLog`.",
		origin: "vendor-docs",
	},
	ends_with: {
		docUrl: "https://trino.io/docs/current/functions/string.html#ends_with",
		description: "Tests whether `substring` is a suffix of `string`.",
		origin: "vendor-docs",
	},
	every: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#every",
		description: "This is an alias for bool_and.",
		origin: "vendor-docs",
	},
	exp: {
		docUrl: "https://trino.io/docs/current/functions/math.html#exp",
		description: "Returns Euler's number raised to the power of `x`.",
		origin: "vendor-docs",
	},
	features: {
		docUrl: "https://trino.io/docs/current/functions/ml.html#features",
		description: "Returns the map representing the feature vector.",
		origin: "vendor-docs",
	},
	first_value: {
		docUrl: "https://trino.io/docs/current/functions/window.html#first_value",
		description: "Returns the first value of the window.",
		origin: "vendor-docs",
	},
	flatten: {
		docUrl: "https://trino.io/docs/current/functions/array.html#flatten",
		description: "Flattens an `array(array(T))` to an `array(T)` by concatenating the contained arrays.",
		origin: "vendor-docs",
	},
	floor: {
		docUrl: "https://trino.io/docs/current/functions/math.html#floor",
		description: "Returns `x` rounded down to the nearest integer.",
		origin: "vendor-docs",
	},
	format: {
		docUrl: "https://trino.io/docs/current/functions/conversion.html#format",
		description: "Returns a formatted string using the specified format string and arguments.",
		origin: "vendor-docs",
	},
	format_datetime: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#format_datetime",
		description: "Formats `timestamp` as a string using `format`.",
		origin: "vendor-docs",
	},
	format_number: {
		docUrl: "https://trino.io/docs/current/functions/conversion.html#format_number",
		description: "Returns a formatted string using a unit symbol.",
		origin: "vendor-docs",
	},
	from_base: {
		docUrl: "https://trino.io/docs/current/functions/math.html#from_base",
		description: "Returns the value of `string` interpreted as a base-`radix` number.",
		origin: "vendor-docs",
	},
	from_base32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#from_base32",
		description: "Decodes binary data from the base32 encoded `string`.",
		origin: "vendor-docs",
	},
	from_base64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#from_base64",
		description: "Decodes binary data from the base64 encoded `string`.",
		origin: "vendor-docs",
	},
	from_base64url: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#from_base64url",
		description: "Decodes binary data from the base64 encoded `string` using the URL safe alphabet.",
		origin: "vendor-docs",
	},
	from_big_endian_32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#from_big_endian_32",
		description: "Decodes the 32-bit two's complement big-endian `binary`.",
		origin: "vendor-docs",
	},
	from_big_endian_64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#from_big_endian_64",
		description: "Decodes the 64-bit two's complement big-endian `binary`.",
		origin: "vendor-docs",
	},
	from_encoded_polyline: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#from_encoded_polyline",
		description: "Decodes a polyline to a linestring.",
		origin: "vendor-docs",
	},
	from_geojson_geometry: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#from_geojson_geometry",
		description:
			"Returns the spherical geography type object from the GeoJSON representation stripping non geometry key/values.",
		origin: "vendor-docs",
	},
	from_hex: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#from_hex",
		description: "Decodes binary data from the hex encoded `string`.",
		origin: "vendor-docs",
	},
	from_ieee754_32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#from_ieee754_32",
		description: "Decodes the 32-bit big-endian `binary` in IEEE 754 single-precision floating-point format.",
		origin: "vendor-docs",
	},
	from_ieee754_64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#from_ieee754_64",
		description: "Decodes the 64-bit big-endian `binary` in IEEE 754 double-precision floating-point format.",
		origin: "vendor-docs",
	},
	from_iso8601_date: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#from_iso8601_date",
		description: "Parses the ISO 8601 formatted date `string` into a `date`.",
		origin: "vendor-docs",
	},
	from_iso8601_timestamp: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#from_iso8601_timestamp",
		description:
			"Parses the ISO 8601 formatted date `string`, optionally with time and time zone, into a `timestamp(3) with time zone`.",
		origin: "vendor-docs",
	},
	from_iso8601_timestamp_nanos: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#from_iso8601_timestamp_nanos",
		description: "Parses the ISO 8601 formatted date and time `string`.",
		origin: "vendor-docs",
	},
	from_unixtime: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#from_unixtime",
		description: "Returns the UNIX timestamp `unixtime` as a timestamp with time zone.",
		origin: "vendor-docs",
	},
	from_unixtime_nanos: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#from_unixtime_nanos",
		description: "Returns the UNIX timestamp `unixtime` as a timestamp with time zone.",
		origin: "vendor-docs",
	},
	from_utf8: {
		docUrl: "https://trino.io/docs/current/functions/string.html#from_utf8",
		description: "Decodes a UTF-8 encoded string from `binary`.",
		origin: "vendor-docs",
	},
	geometric_mean: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#geometric_mean",
		description: "Returns the geometric mean of all input values.",
		origin: "vendor-docs",
	},
	geometry_from_hadoop_shape: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#geometry_from_hadoop_shape",
		description: "Returns a geometry type object from Spatial Framework for Hadoop representation.",
		origin: "vendor-docs",
	},
	geometry_invalid_reason: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#geometry_invalid_reason",
		description: "Returns the reason for why the input geometry is not valid.",
		origin: "vendor-docs",
	},
	geometry_nearest_points: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#geometry_nearest_points",
		description: "Returns the points on each geometry nearest the other.",
		origin: "vendor-docs",
	},
	geometry_to_bing_tiles: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#geometry_to_bing_tiles",
		description: "Returns the minimum set of Bing tiles that fully covers a given geometry at a given zoom level.",
		origin: "vendor-docs",
	},
	geometry_union_agg: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#geometry_union_agg",
		description: "Returns a geometry that represents the point set union of all input geometries.",
		origin: "vendor-docs",
	},
	great_circle_distance: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#great_circle_distance",
		description: "Returns the great-circle distance between two points on Earth's surface in kilometers.",
		origin: "vendor-docs",
	},
	hamming_distance: {
		docUrl: "https://trino.io/docs/current/functions/string.html#hamming_distance",
		description: "Returns the Hamming distance of `string1` and `string2`, i.e.",
		origin: "vendor-docs",
	},
	hash_counts: {
		docUrl: "https://trino.io/docs/current/functions/setdigest.html#hash_counts",
		description:
			"Returns a map containing the Murmur3Hash128 hashed values and the count of their occurences within the internal `MinHash` structure belonging to `x`.",
		origin: "vendor-docs",
	},
	histogram: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#histogram",
		description: "Returns a map containing the count of the number of times each input value occurs.",
		origin: "vendor-docs",
	},
	hmac_md5: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#hmac_md5",
		description: "Computes HMAC with MD5 of `binary` with the given `key`.",
		origin: "vendor-docs",
	},
	hmac_sha1: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#hmac_sha1",
		description: "Computes HMAC with SHA1 of `binary` with the given `key`.",
		origin: "vendor-docs",
	},
	hmac_sha256: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#hmac_sha256",
		description: "Computes HMAC with SHA256 of `binary` with the given `key`.",
		origin: "vendor-docs",
	},
	hmac_sha512: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#hmac_sha512",
		description: "Computes HMAC with SHA512 of `binary` with the given `key`.",
		origin: "vendor-docs",
	},
	hour: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#hour",
		description: "Returns the hour of the day from `x`.",
		origin: "vendor-docs",
	},
	human_readable_seconds: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#human_readable_seconds",
		description:
			"Formats the double value of `seconds` into a human-readable string containing `weeks`, `days`, `hours`, `minutes`, and `seconds`.",
		origin: "vendor-docs",
	},
	if: {
		docUrl: "https://trino.io/docs/current/functions/conditional.html#if",
		description:
			"Evaluates and returns `true_value` if `condition` is true, otherwise null is returned and `true_value` is not evaluated.",
		origin: "vendor-docs",
	},
	index: {
		docUrl: "https://trino.io/docs/current/functions/teradata.html#index",
		description: "Alias for strpos function.",
		origin: "vendor-docs",
	},
	infinity: {
		docUrl: "https://trino.io/docs/current/functions/math.html#infinity",
		description: "Returns the constant representing positive infinity.",
		origin: "vendor-docs",
	},
	intersection_cardinality: {
		docUrl: "https://trino.io/docs/current/functions/setdigest.html#intersection_cardinality",
		description: "Returns the estimation for the cardinality of the intersection of the two set digests.",
		origin: "vendor-docs",
	},
	inverse_beta_cdf: {
		docUrl: "https://trino.io/docs/current/functions/math.html#inverse_beta_cdf",
		description:
			"Compute the inverse of the Beta cdf with given a, b parameters for the cumulative probability (p): P(N \\< n).",
		origin: "vendor-docs",
	},
	inverse_normal_cdf: {
		docUrl: "https://trino.io/docs/current/functions/math.html#inverse_normal_cdf",
		description:
			"Compute the inverse of the Normal cdf with given mean and standard deviation (sd) for the cumulative probability (p): P(N \\< n).",
		origin: "vendor-docs",
	},
	is_finite: {
		docUrl: "https://trino.io/docs/current/functions/math.html#is_finite",
		description: "Determine if `x` is finite.",
		origin: "vendor-docs",
	},
	is_infinite: {
		docUrl: "https://trino.io/docs/current/functions/math.html#is_infinite",
		description: "Determine if `x` is infinite.",
		origin: "vendor-docs",
	},
	is_json_scalar: {
		docUrl: "https://trino.io/docs/current/functions/json.html#is_json_scalar",
		description: "Determine if `json` is a scalar (i.e.",
		origin: "vendor-docs",
	},
	is_nan: {
		docUrl: "https://trino.io/docs/current/functions/math.html#is_nan",
		description: "Determine if `x` is not-a-number.",
		origin: "vendor-docs",
	},
	jaccard_index: {
		docUrl: "https://trino.io/docs/current/functions/setdigest.html#jaccard_index",
		description: "Returns the estimation of Jaccard index for the two set digests.",
		origin: "vendor-docs",
	},
	json_array_contains: {
		docUrl: "https://trino.io/docs/current/functions/json.html#json_array_contains",
		description: "Determine if `value` exists in `json` (a string containing a JSON array).",
		origin: "vendor-docs",
	},
	json_array_get: {
		docUrl: "https://trino.io/docs/current/functions/json.html#json_array_get",
		origin: "vendor-docs",
	},
	json_array_length: {
		docUrl: "https://trino.io/docs/current/functions/json.html#json_array_length",
		description: "Returns the array length of `json` (a string containing a JSON array).",
		origin: "vendor-docs",
	},
	json_extract: {
		docUrl: "https://trino.io/docs/current/functions/json.html#json_extract",
		description:
			"Evaluates the [JSONPath]-like expression `json_path` on `json` (a string containing JSON) and returns the result as a JSON string.",
		origin: "vendor-docs",
	},
	json_extract_scalar: {
		docUrl: "https://trino.io/docs/current/functions/json.html#json_extract_scalar",
		description:
			"Like json_extract, but returns the result value as a string (as opposed to being encoded as JSON).",
		origin: "vendor-docs",
	},
	json_format: {
		docUrl: "https://trino.io/docs/current/functions/json.html#json_format",
		description: "Returns the JSON text serialized from the input JSON value.",
		origin: "vendor-docs",
	},
	json_parse: {
		docUrl: "https://trino.io/docs/current/functions/json.html#json_parse",
		description: "Returns the JSON value deserialized from the input JSON text.",
		origin: "vendor-docs",
	},
	json_size: {
		docUrl: "https://trino.io/docs/current/functions/json.html#json_size",
		description: "Like json_extract, but returns the size of the value.",
		origin: "vendor-docs",
	},
	kurtosis: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#kurtosis",
		description: "Returns the excess kurtosis of all input values.",
		origin: "vendor-docs",
	},
	lag: {
		docUrl: "https://trino.io/docs/current/functions/window.html#lag",
		description: "Returns the value at `offset` rows before the current row in the window partition.",
		origin: "vendor-docs",
	},
	last_day_of_month: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#last_day_of_month",
		description: "Returns the last day of the month.",
		origin: "vendor-docs",
	},
	last_value: {
		docUrl: "https://trino.io/docs/current/functions/window.html#last_value",
		description: "Returns the last value of the window.",
		origin: "vendor-docs",
	},
	lead: {
		docUrl: "https://trino.io/docs/current/functions/window.html#lead",
		description: "Returns the value at `offset` rows after the current row in the window partition.",
		origin: "vendor-docs",
	},
	learn_classifier: {
		docUrl: "https://trino.io/docs/current/functions/ml.html#learn_classifier",
		description: "Returns an SVM-based classifier model, trained with the given label and feature data sets.",
		origin: "vendor-docs",
	},
	learn_libsvm_classifier: {
		docUrl: "https://trino.io/docs/current/functions/ml.html#learn_libsvm_classifier",
		description: "Returns an SVM-based classifier model, trained with the given label and feature data sets.",
		origin: "vendor-docs",
	},
	learn_libsvm_regressor: {
		docUrl: "https://trino.io/docs/current/functions/ml.html#learn_libsvm_regressor",
		description: "Returns an SVM-based regressor model, trained with the given target and feature data sets.",
		origin: "vendor-docs",
	},
	learn_regressor: {
		docUrl: "https://trino.io/docs/current/functions/ml.html#learn_regressor",
		description: "Returns an SVM-based regressor model, trained with the given target and feature data sets.",
		origin: "vendor-docs",
	},
	length: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#length",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	levenshtein_distance: {
		docUrl: "https://trino.io/docs/current/functions/string.html#levenshtein_distance",
		description: "Returns the Levenshtein edit distance of `string1` and `string2`, i.e.",
		origin: "vendor-docs",
	},
	line_interpolate_point: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#line_interpolate_point",
		description: "Returns a Point interpolated along a LineString at the fraction given.",
		origin: "vendor-docs",
	},
	line_interpolate_points: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#line_interpolate_points",
		description: "Returns an array of Points interpolated along a LineString.",
		origin: "vendor-docs",
	},
	line_locate_point: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#line_locate_point",
		description:
			"Returns a float between 0 and 1 representing the location of the closest point on the LineString to the given Point, as a fraction of total 2d line length.",
		origin: "vendor-docs",
	},
	listagg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#listagg",
		description: "Returns the concatenated input values, separated by the `separator` string.",
		origin: "vendor-docs",
	},
	ln: {
		docUrl: "https://trino.io/docs/current/functions/math.html#ln",
		description: "Returns the natural logarithm of `x`.",
		origin: "vendor-docs",
	},
	log: {
		docUrl: "https://trino.io/docs/current/functions/math.html#log",
		description: "Returns the base `b` logarithm of `x`.",
		origin: "vendor-docs",
	},
	log10: {
		docUrl: "https://trino.io/docs/current/functions/math.html#log10",
		description: "Returns the base 10 logarithm of `x`.",
		origin: "vendor-docs",
	},
	log2: {
		docUrl: "https://trino.io/docs/current/functions/math.html#log2",
		description: "Returns the base 2 logarithm of `x`.",
		origin: "vendor-docs",
	},
	lower: {
		docUrl: "https://trino.io/docs/current/functions/string.html#lower",
		description: "Converts `string` to lowercase.",
		origin: "vendor-docs",
	},
	lpad: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#lpad",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	ltrim: {
		docUrl: "https://trino.io/docs/current/functions/string.html#ltrim",
		description: "Removes leading whitespace from `string`.",
		origin: "vendor-docs",
	},
	luhn_check: {
		docUrl: "https://trino.io/docs/current/functions/string.html#luhn_check",
		description: "Tests whether a `string` of digits is valid according to the Luhn algorithm.",
		origin: "vendor-docs",
	},
	make_set_digest: {
		docUrl: "https://trino.io/docs/current/functions/setdigest.html#make_set_digest",
		description: "Composes all input values of `x` into a `setdigest`.",
		origin: "vendor-docs",
	},
	map_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#map_agg",
		description: "Returns a map created from the input `key` / `value` pairs.",
		origin: "vendor-docs",
	},
	max: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#max",
		description: "Returns the maximum value of all input values.",
		origin: "vendor-docs",
	},
	max_by: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#max_by",
		description: "Returns the value of `x` associated with the maximum value of `y` over all input values.",
		origin: "vendor-docs",
	},
	md5: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#md5",
		description: "Computes the MD5 hash of `binary`.",
		origin: "vendor-docs",
	},
	merge: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#merge",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	merge_set_digest: {
		docUrl: "https://trino.io/docs/current/functions/setdigest.html#merge_set_digest",
		description:
			"Returns the `setdigest` of the aggregate union of the individual `setdigest` Set Digest structures.",
		origin: "vendor-docs",
	},
	millisecond: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#millisecond",
		description: "Returns the millisecond of the second from `x`.",
		origin: "vendor-docs",
	},
	min: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#min",
		description: "Returns the minimum value of all input values.",
		origin: "vendor-docs",
	},
	min_by: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#min_by",
		description: "Returns the value of `x` associated with the minimum value of `y` over all input values.",
		origin: "vendor-docs",
	},
	minute: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#minute",
		description: "Returns the minute of the hour from `x`.",
		origin: "vendor-docs",
	},
	mod: {
		docUrl: "https://trino.io/docs/current/functions/math.html#mod",
		description: "Returns the modulo (remainder) of `n` divided by `m`.",
		origin: "vendor-docs",
	},
	month: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#month",
		description: "Returns the month of the year from `x`.",
		origin: "vendor-docs",
	},
	multimap_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#multimap_agg",
		description: "Returns a multimap created from the input `key` / `value` pairs.",
		origin: "vendor-docs",
	},
	murmur3: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#murmur3",
		description: "Computes the 128-bit MurmurHash3 hash of `binary`.",
		origin: "vendor-docs",
	},
	nan: {
		docUrl: "https://trino.io/docs/current/functions/math.html#nan",
		description: "Returns the constant representing not-a-number.",
		origin: "vendor-docs",
	},
	normal_cdf: {
		docUrl: "https://trino.io/docs/current/functions/math.html#normal_cdf",
		description: "Compute the Normal cdf with given mean and standard deviation (sd): P(N \\< v; mean, sd).",
		origin: "vendor-docs",
	},
	normalize: {
		docUrl: "https://trino.io/docs/current/functions/string.html#normalize",
		description: "Transforms `string` with NFC normalization form.",
		origin: "vendor-docs",
	},
	now: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#now",
		description: "This is an alias for `current_timestamp`.",
		origin: "vendor-docs",
	},
	nth_value: {
		docUrl: "https://trino.io/docs/current/functions/window.html#nth_value",
		description: "Returns the value at the specified offset from the beginning of the window.",
		origin: "vendor-docs",
	},
	ntile: {
		docUrl: "https://trino.io/docs/current/functions/window.html#ntile",
		description: "Divides the rows for each window partition into `n` buckets ranging from `1` to at most `n`.",
		origin: "vendor-docs",
	},
	nullif: {
		docUrl: "https://trino.io/docs/current/functions/conditional.html#nullif",
		description: "Returns null if `value1` equals `value2`, otherwise returns `value1`.",
		origin: "vendor-docs",
	},
	numeric_histogram: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#numeric_histogram",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	parse_data_size: {
		docUrl: "https://trino.io/docs/current/functions/conversion.html#parse_data_size",
		description:
			"Parses `string` of format `value unit` into a number, where `value` is the fractional number of `unit` values.",
		origin: "vendor-docs",
	},
	parse_datetime: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#parse_datetime",
		description: "Parses `string` into a timestamp with time zone using `format`.",
		origin: "vendor-docs",
	},
	parse_duration: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#parse_duration",
		description:
			"Parses `string` of format `value unit` into an interval, where `value` is fractional number of `unit` values.",
		origin: "vendor-docs",
	},
	percent_rank: {
		docUrl: "https://trino.io/docs/current/functions/window.html#percent_rank",
		description: "Returns the percentage ranking of a value in group of values.",
		origin: "vendor-docs",
	},
	pi: {
		docUrl: "https://trino.io/docs/current/functions/math.html#pi",
		description: "Returns the constant Pi.",
		origin: "vendor-docs",
	},
	pow: {
		docUrl: "https://trino.io/docs/current/functions/math.html#pow",
		description: "This is an alias for power.",
		origin: "vendor-docs",
	},
	power: {
		docUrl: "https://trino.io/docs/current/functions/math.html#power",
		description: "Returns `x` raised to the power of `p`.",
		origin: "vendor-docs",
	},
	qdigest_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#qdigest_agg",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	quarter: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#quarter",
		description: "Returns the quarter of the year from `x`.",
		origin: "vendor-docs",
	},
	radians: {
		docUrl: "https://trino.io/docs/current/functions/math.html#radians",
		description: "Converts angle `x` in degrees to radians.",
		origin: "vendor-docs",
	},
	rand: {
		docUrl: "https://trino.io/docs/current/functions/math.html#rand",
		description: "This is an alias for random().",
		origin: "vendor-docs",
	},
	random: {
		docUrl: "https://trino.io/docs/current/functions/math.html#random",
		description: "Returns a pseudo-random value in the range 0.0 \\<= x \\< 1.0.",
		origin: "vendor-docs",
	},
	rank: {
		docUrl: "https://trino.io/docs/current/functions/window.html#rank",
		description: "Returns the rank of a value in a group of values.",
		origin: "vendor-docs",
	},
	reduce: {
		docUrl: "https://trino.io/docs/current/functions/array.html#reduce",
		description: "Returns a single value reduced from `array`.",
		origin: "vendor-docs",
	},
	regexp_count: {
		docUrl: "https://trino.io/docs/current/functions/regexp.html#regexp_count",
		description: "Returns the number of occurrence of `pattern` in `string`.",
		origin: "vendor-docs",
	},
	regexp_extract: {
		docUrl: "https://trino.io/docs/current/functions/regexp.html#regexp_extract",
		description: "Returns the first substring matched by the regular expression `pattern` in `string`.",
		origin: "vendor-docs",
	},
	regexp_extract_all: {
		docUrl: "https://trino.io/docs/current/functions/regexp.html#regexp_extract_all",
		description: "Returns the substring(s) matched by the regular expression `pattern` in `string`.",
		origin: "vendor-docs",
	},
	regexp_like: {
		docUrl: "https://trino.io/docs/current/functions/regexp.html#regexp_like",
		description: "Evaluates the regular expression `pattern` and determines if it is contained within `string`.",
		origin: "vendor-docs",
	},
	regexp_position: {
		docUrl: "https://trino.io/docs/current/functions/regexp.html#regexp_position",
		description: "Returns the index of the first occurrence (counting from 1) of `pattern` in `string`.",
		origin: "vendor-docs",
	},
	regexp_replace: {
		docUrl: "https://trino.io/docs/current/functions/regexp.html#regexp_replace",
		description:
			"Removes every instance of the substring matched by the regular expression `pattern` from `string`.",
		origin: "vendor-docs",
	},
	regexp_split: {
		docUrl: "https://trino.io/docs/current/functions/regexp.html#regexp_split",
		description: "Splits `string` using the regular expression `pattern` and returns an array.",
		origin: "vendor-docs",
	},
	regr_intercept: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#regr_intercept",
		description: "Returns linear regression intercept of input values.",
		origin: "vendor-docs",
	},
	regr_slope: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#regr_slope",
		description: "Returns linear regression slope of input values.",
		origin: "vendor-docs",
	},
	regress: {
		docUrl: "https://trino.io/docs/current/functions/ml.html#regress",
		description: "Returns a predicted target value by the given regressor SVM model.",
		origin: "vendor-docs",
	},
	render: {
		docUrl: "https://trino.io/docs/current/functions/color.html#render",
		description: "Renders value `x` using the specific color using ANSI color codes.",
		origin: "vendor-docs",
	},
	repeat: {
		docUrl: "https://trino.io/docs/current/functions/array.html#repeat",
		description: "Repeat `element` for `count` times.",
		origin: "vendor-docs",
	},
	replace: {
		docUrl: "https://trino.io/docs/current/functions/string.html#replace",
		description: "Removes all instances of `search` from `string`.",
		origin: "vendor-docs",
	},
	reverse: {
		docUrl: "https://trino.io/docs/current/functions/array.html#reverse",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	rgb: {
		docUrl: "https://trino.io/docs/current/functions/color.html#rgb",
		description:
			"Returns a color value capturing the RGB value of three component color values supplied as int parameters ranging from 0 to 255: `red`, `green`, `blue`.",
		origin: "vendor-docs",
	},
	round: {
		docUrl: "https://trino.io/docs/current/functions/math.html#round",
		description: "Returns `x` rounded to the nearest integer.",
		origin: "vendor-docs",
	},
	row_number: {
		docUrl: "https://trino.io/docs/current/functions/window.html#row_number",
		description:
			"Returns a unique, sequential number for each row, starting with one, according to the ordering of rows within the window partition.",
		origin: "vendor-docs",
	},
	rpad: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#rpad",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	rtrim: {
		docUrl: "https://trino.io/docs/current/functions/string.html#rtrim",
		description: "Removes trailing whitespace from `string`.",
		origin: "vendor-docs",
	},
	second: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#second",
		description: "Returns the second of the minute from `x`.",
		origin: "vendor-docs",
	},
	sequence: {
		docUrl: "https://trino.io/docs/current/functions/array.html#sequence",
		description:
			"Generate a sequence of integers from `start` to `stop`, incrementing by `1` if `start` is less than or equal to `stop`, otherwise `-1`.",
		origin: "vendor-docs",
	},
	sha1: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#sha1",
		description: "Computes the SHA1 hash of `binary`.",
		origin: "vendor-docs",
	},
	sha256: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#sha256",
		description: "Computes the SHA256 hash of `binary`.",
		origin: "vendor-docs",
	},
	sha512: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#sha512",
		description: "Computes the SHA512 hash of `binary`.",
		origin: "vendor-docs",
	},
	shuffle: {
		docUrl: "https://trino.io/docs/current/functions/array.html#shuffle",
		description: "Generate a random permutation of the given array `x`.",
		origin: "vendor-docs",
	},
	sign: {
		docUrl: "https://trino.io/docs/current/functions/math.html#sign",
		description: "Returns the signum function of `x`, that is.",
		origin: "vendor-docs",
	},
	simplify_geometry: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#simplify_geometry",
		description: 'Returns a "simplified" version of the input geometry using the Douglas-Peucker algorithm.',
		origin: "vendor-docs",
	},
	sin: {
		docUrl: "https://trino.io/docs/current/functions/math.html#sin",
		description: "Returns the sine of `x`.",
		origin: "vendor-docs",
	},
	sinh: {
		docUrl: "https://trino.io/docs/current/functions/math.html#sinh",
		description: "Returns the hyperbolic sine of `x`.",
		origin: "vendor-docs",
	},
	skewness: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#skewness",
		description: "Returns the Fisher’s moment coefficient of skewness of all input values.",
		origin: "vendor-docs",
	},
	slice: {
		docUrl: "https://trino.io/docs/current/functions/array.html#slice",
		description:
			"Subsets array `x` starting from index `start` (or starting from the end if `start` is negative) with a length of `length`.",
		origin: "vendor-docs",
	},
	soundex: {
		docUrl: "https://trino.io/docs/current/functions/string.html#soundex",
		description: "`soundex` returns a character string containing the phonetic representation of `char`.",
		origin: "vendor-docs",
	},
	split: {
		docUrl: "https://trino.io/docs/current/functions/string.html#split",
		description: "Splits `string` on `delimiter` and returns an array.",
		origin: "vendor-docs",
	},
	split_part: {
		docUrl: "https://trino.io/docs/current/functions/string.html#split_part",
		description: "Splits `string` on `delimiter` and returns the field `index`.",
		origin: "vendor-docs",
	},
	split_to_map: {
		docUrl: "https://trino.io/docs/current/functions/string.html#split_to_map",
		description: "Splits `string` by `entryDelimiter` and `keyValueDelimiter` and returns a map.",
		origin: "vendor-docs",
	},
	split_to_multimap: {
		docUrl: "https://trino.io/docs/current/functions/string.html#split_to_multimap",
		description:
			"Splits `string` by `entryDelimiter` and `keyValueDelimiter` and returns a map containing an array of values for each unique key.",
		origin: "vendor-docs",
	},
	spooky_hash_v2_32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#spooky_hash_v2_32",
		description: "Computes the 32-bit SpookyHashV2 hash of `binary`.",
		origin: "vendor-docs",
	},
	spooky_hash_v2_64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#spooky_hash_v2_64",
		description: "Computes the 64-bit SpookyHashV2 hash of `binary`.",
		origin: "vendor-docs",
	},
	sqrt: {
		docUrl: "https://trino.io/docs/current/functions/math.html#sqrt",
		description: "Returns the square root of `x`.",
		origin: "vendor-docs",
	},
	st_area: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_area",
		description: "Returns the 2D Euclidean area of a geometry.",
		origin: "vendor-docs",
	},
	st_asbinary: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_asbinary",
		description: "Returns the WKB representation of the geometry.",
		origin: "vendor-docs",
	},
	st_astext: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_astext",
		description: "Returns the WKT representation of the geometry.",
		origin: "vendor-docs",
	},
	st_boundary: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_boundary",
		description: "Returns the closure of the combinatorial boundary of this geometry.",
		origin: "vendor-docs",
	},
	st_buffer: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_buffer",
		description:
			"Returns the geometry that represents all points whose distance from the specified geometry is less than or equal to the specified distance.",
		origin: "vendor-docs",
	},
	st_centroid: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_centroid",
		description: "Returns the point value that is the mathematical centroid of a geometry.",
		origin: "vendor-docs",
	},
	st_contains: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_contains",
		description:
			"Returns `true` if and only if no points of the second geometry lie in the exterior of the first geometry, and at least one point of the interior of the first geometry lies in the interior of the second geometry.",
		origin: "vendor-docs",
	},
	st_convexhull: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_convexhull",
		description: "Returns the minimum convex geometry that encloses all input geometries.",
		origin: "vendor-docs",
	},
	st_coorddim: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_coorddim",
		description: "Returns the coordinate dimension of the geometry.",
		origin: "vendor-docs",
	},
	st_crosses: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_crosses",
		description: "Returns `true` if the supplied geometries have some, but not all, interior points in common.",
		origin: "vendor-docs",
	},
	st_difference: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_difference",
		description: "Returns the geometry value that represents the point set difference of the given geometries.",
		origin: "vendor-docs",
	},
	st_dimension: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_dimension",
		description:
			"Returns the inherent dimension of this geometry object, which must be less than or equal to the coordinate dimension.",
		origin: "vendor-docs",
	},
	st_disjoint: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_disjoint",
		description:
			"Returns `true` if the give geometries do not *spatially intersect* -- if they do not share any space together.",
		origin: "vendor-docs",
	},
	st_distance: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_distance",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	st_endpoint: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_endpoint",
		description: "Returns the last point of a LineString geometry as a Point.",
		origin: "vendor-docs",
	},
	st_envelope: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_envelope",
		description: "Returns the bounding rectangular polygon of a geometry.",
		origin: "vendor-docs",
	},
	st_envelopeaspts: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_envelopeaspts",
		description:
			"Returns an array of two points: the lower left and upper right corners of the bounding rectangular polygon of a geometry.",
		origin: "vendor-docs",
	},
	st_equals: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_equals",
		description: "Returns `true` if the given geometries represent the same geometry.",
		origin: "vendor-docs",
	},
	st_exteriorring: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_exteriorring",
		description: "Returns a line string representing the exterior ring of the input polygon.",
		origin: "vendor-docs",
	},
	st_geometries: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_geometries",
		description: "Returns an array of geometries in the specified collection.",
		origin: "vendor-docs",
	},
	st_geometryfromtext: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_geometryfromtext",
		description: "Returns a geometry type object from WKT representation.",
		origin: "vendor-docs",
	},
	st_geometryn: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_geometryn",
		description: "Returns the geometry element at a given index (indices start at 1).",
		origin: "vendor-docs",
	},
	st_geometrytype: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_geometrytype",
		description: "Returns the type of the geometry.",
		origin: "vendor-docs",
	},
	st_geomfrombinary: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_geomfrombinary",
		description: "Returns a geometry type object from WKB or EWKB representation.",
		origin: "vendor-docs",
	},
	st_geomfromkml: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_geomfromkml",
		description: "Returns a geometry type object from KML representation.",
		origin: "vendor-docs",
	},
	st_interiorringn: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_interiorringn",
		description: "Returns the interior ring element at the specified index (indices start at 1).",
		origin: "vendor-docs",
	},
	st_interiorrings: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_interiorrings",
		description:
			"Returns an array of all interior rings found in the input geometry, or an empty array if the polygon has no interior rings.",
		origin: "vendor-docs",
	},
	st_intersection: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_intersection",
		description: "Returns the geometry value that represents the point set intersection of two geometries.",
		origin: "vendor-docs",
	},
	st_intersects: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_intersects",
		description:
			"Returns `true` if the given geometries spatially intersect in two dimensions (share any portion of space) and `false` if they do not (they are disjoint).",
		origin: "vendor-docs",
	},
	st_isclosed: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_isclosed",
		description: "Returns `true` if the linestring's start and end points are coincident.",
		origin: "vendor-docs",
	},
	st_isempty: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_isempty",
		description: "Returns `true` if this Geometry is an empty geometrycollection, polygon, point etc.",
		origin: "vendor-docs",
	},
	st_isring: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_isring",
		description: "Returns `true` if and only if the line is closed and simple.",
		origin: "vendor-docs",
	},
	st_issimple: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_issimple",
		description:
			"Returns `true` if this Geometry has no anomalous geometric points, such as self intersection or self tangency.",
		origin: "vendor-docs",
	},
	st_isvalid: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_isvalid",
		description: "Returns `true` if and only if the input geometry is well-formed.",
		origin: "vendor-docs",
	},
	st_length: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_length",
		description:
			"Returns the length of a linestring or multi-linestring using Euclidean measurement on a two-dimensional plane (based on spatial ref) in projected units.",
		origin: "vendor-docs",
	},
	st_linefromtext: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_linefromtext",
		description: "Returns a geometry type linestring object from WKT representation.",
		origin: "vendor-docs",
	},
	st_numgeometries: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_numgeometries",
		description: "Returns the number of geometries in the collection.",
		origin: "vendor-docs",
	},
	st_numinteriorring: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_numinteriorring",
		description: "Returns the cardinality of the collection of interior rings of a polygon.",
		origin: "vendor-docs",
	},
	st_numpoints: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_numpoints",
		description: "Returns the number of points in a geometry.",
		origin: "vendor-docs",
	},
	st_overlaps: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_overlaps",
		description:
			"Returns `true` if the given geometries share space, are of the same dimension, but are not completely contained by each other.",
		origin: "vendor-docs",
	},
	st_point: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_point",
		description: "Returns a geometry type point object with the given coordinate values.",
		origin: "vendor-docs",
	},
	st_pointn: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_pointn",
		description: "Returns the vertex of a linestring at a given index (indices start at 1).",
		origin: "vendor-docs",
	},
	st_points: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_points",
		description: "Returns an array of points in a linestring.",
		origin: "vendor-docs",
	},
	st_polygon: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_polygon",
		description: "Returns a geometry type polygon object from WKT representation.",
		origin: "vendor-docs",
	},
	st_relate: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_relate",
		description: "Returns `true` if first geometry is spatially related to second geometry.",
		origin: "vendor-docs",
	},
	st_startpoint: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_startpoint",
		description: "Returns the first point of a LineString geometry as a Point.",
		origin: "vendor-docs",
	},
	st_symdifference: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_symdifference",
		description: "Returns the geometry value that represents the point set symmetric difference of two geometries.",
		origin: "vendor-docs",
	},
	st_touches: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_touches",
		description:
			"Returns `true` if the given geometries have at least one point in common, but their interiors do not intersect.",
		origin: "vendor-docs",
	},
	st_union: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_union",
		description: "Returns a geometry that represents the point set union of the input geometries.",
		origin: "vendor-docs",
	},
	st_within: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_within",
		description: "Returns `true` if first geometry is completely inside second geometry.",
		origin: "vendor-docs",
	},
	st_x: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_x",
		description: "Returns the X coordinate of the point.",
		origin: "vendor-docs",
	},
	st_xmax: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_xmax",
		description: "Returns X maxima of a bounding box of a geometry.",
		origin: "vendor-docs",
	},
	st_xmin: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_xmin",
		description: "Returns X minima of a bounding box of a geometry.",
		origin: "vendor-docs",
	},
	st_y: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_y",
		description: "Returns the Y coordinate of the point.",
		origin: "vendor-docs",
	},
	st_ymax: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_ymax",
		description: "Returns Y maxima of a bounding box of a geometry.",
		origin: "vendor-docs",
	},
	st_ymin: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#st_ymin",
		description: "Returns Y minima of a bounding box of a geometry.",
		origin: "vendor-docs",
	},
	starts_with: {
		docUrl: "https://trino.io/docs/current/functions/string.html#starts_with",
		description: "Tests whether `substring` is a prefix of `string`.",
		origin: "vendor-docs",
	},
	stddev: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#stddev",
		description: "This is an alias for stddev_samp.",
		origin: "vendor-docs",
	},
	stddev_pop: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#stddev_pop",
		description: "Returns the population standard deviation of all input values.",
		origin: "vendor-docs",
	},
	stddev_samp: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#stddev_samp",
		description: "Returns the sample standard deviation of all input values.",
		origin: "vendor-docs",
	},
	strpos: {
		docUrl: "https://trino.io/docs/current/functions/string.html#strpos",
		description: "Returns the starting position of the first instance of `substring` in `string`.",
		origin: "vendor-docs",
	},
	substr: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#substr",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	substring: {
		docUrl: "https://trino.io/docs/current/functions/string.html#substring",
		description: "Returns the rest of `string` from the starting position `start`.",
		origin: "vendor-docs",
	},
	sum: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#sum",
		description: "Returns the sum of all input values.",
		origin: "vendor-docs",
	},
	t_cdf: {
		docUrl: "https://trino.io/docs/current/functions/math.html#t_cdf",
		description:
			"Compute the Student's t-distribution cumulative density function for given x and degrees of freedom (df).",
		origin: "vendor-docs",
	},
	t_pdf: {
		docUrl: "https://trino.io/docs/current/functions/math.html#t_pdf",
		description:
			"Computes the Student's t-distribution probability density function for given x and degrees of freedom (df).",
		origin: "vendor-docs",
	},
	tan: {
		docUrl: "https://trino.io/docs/current/functions/math.html#tan",
		description: "Returns the tangent of `x`.",
		origin: "vendor-docs",
	},
	tanh: {
		docUrl: "https://trino.io/docs/current/functions/math.html#tanh",
		description: "Returns the hyperbolic tangent of `x`.",
		origin: "vendor-docs",
	},
	tdigest_agg: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#tdigest_agg",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	theta_sketch_cardinality: {
		docUrl: "https://trino.io/docs/current/functions/datasketches.html#theta_sketch_cardinality",
		description: "Returns the estimated value of the sketch.",
		origin: "vendor-docs",
	},
	timezone_hour: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#timezone_hour",
		description: "Returns the hour of the time zone offset from `timestamp`.",
		origin: "vendor-docs",
	},
	timezone_minute: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#timezone_minute",
		description: "Returns the minute of the time zone offset from `timestamp`.",
		origin: "vendor-docs",
	},
	to_base: {
		docUrl: "https://trino.io/docs/current/functions/math.html#to_base",
		description: "Returns the base-`radix` representation of `x`.",
		origin: "vendor-docs",
	},
	to_base32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#to_base32",
		description: "Encodes `binary` into a base32 string representation.",
		origin: "vendor-docs",
	},
	to_base64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#to_base64",
		description: "Encodes `binary` into a base64 string representation.",
		origin: "vendor-docs",
	},
	to_base64url: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#to_base64url",
		description: "Encodes `binary` into a base64 string representation using the URL safe alphabet.",
		origin: "vendor-docs",
	},
	to_big_endian_32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#to_big_endian_32",
		description: "Encodes `integer` into a 32-bit two's complement big-endian format.",
		origin: "vendor-docs",
	},
	to_big_endian_64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#to_big_endian_64",
		description: "Encodes `bigint` into a 64-bit two's complement big-endian format.",
		origin: "vendor-docs",
	},
	to_char: {
		docUrl: "https://trino.io/docs/current/functions/teradata.html#to_char",
		description: "Formats `timestamp` as a string using `format`.",
		origin: "vendor-docs",
	},
	to_date: {
		docUrl: "https://trino.io/docs/current/functions/teradata.html#to_date",
		description: "Parses `string` into a `DATE` using `format`.",
		origin: "vendor-docs",
	},
	to_encoded_polyline: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#to_encoded_polyline",
		description: "Encodes a linestring or multipoint to a polyline.",
		origin: "vendor-docs",
	},
	to_geojson_geometry: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#to_geojson_geometry",
		description: "Returns the GeoJSON encoded defined by the input spherical geography.",
		origin: "vendor-docs",
	},
	to_geometry: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#to_geometry",
		description: "Converts a SphericalGeography object to a Geometry object.",
		origin: "vendor-docs",
	},
	to_hex: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#to_hex",
		description: "Encodes `binary` into a hex string representation.",
		origin: "vendor-docs",
	},
	to_ieee754_32: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#to_ieee754_32",
		description:
			"Encodes `real` into a 32-bit big-endian binary according to IEEE 754 single-precision floating-point format.",
		origin: "vendor-docs",
	},
	to_ieee754_64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#to_ieee754_64",
		description:
			"Encodes `double` into a 64-bit big-endian binary according to IEEE 754 double-precision floating-point format.",
		origin: "vendor-docs",
	},
	to_iso8601: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#to_iso8601",
		description: "Formats `x` as an ISO 8601 string.",
		origin: "vendor-docs",
	},
	to_milliseconds: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#to_milliseconds",
		description: "Returns the day-to-second `interval` as milliseconds.",
		origin: "vendor-docs",
	},
	to_spherical_geography: {
		docUrl: "https://trino.io/docs/current/functions/geospatial.html#to_spherical_geography",
		description: "Converts a Geometry object to a SphericalGeography object on the sphere of the Earth's radius.",
		origin: "vendor-docs",
	},
	to_timestamp: {
		docUrl: "https://trino.io/docs/current/functions/teradata.html#to_timestamp",
		description: "Parses `string` into a `TIMESTAMP` using `format`.",
		origin: "vendor-docs",
	},
	to_unixtime: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#to_unixtime",
		description: "Returns `timestamp` as a UNIX timestamp.",
		origin: "vendor-docs",
	},
	to_utf8: {
		docUrl: "https://trino.io/docs/current/functions/string.html#to_utf8",
		description: "Encodes `string` into a UTF-8 varbinary representation.",
		origin: "vendor-docs",
	},
	transform: {
		docUrl: "https://trino.io/docs/current/functions/array.html#transform",
		description: "Returns an array that is the result of applying `function` to each element of `array`.",
		origin: "vendor-docs",
	},
	trim: {
		docUrl: "https://trino.io/docs/current/functions/string.html#trim",
		description: ":noindex: true",
		origin: "vendor-docs",
	},
	trim_array: {
		docUrl: "https://trino.io/docs/current/functions/array.html#trim_array",
		description: "Remove `n` elements from the end of array.",
		origin: "vendor-docs",
	},
	truncate: {
		docUrl: "https://trino.io/docs/current/functions/math.html#truncate",
		description: "Returns `x` rounded to integer by dropping digits after decimal point.",
		origin: "vendor-docs",
	},
	try: {
		docUrl: "https://trino.io/docs/current/functions/conditional.html#try",
		description: "Evaluate an expression and handle certain types of errors by returning `NULL`.",
		origin: "vendor-docs",
	},
	typeof: {
		docUrl: "https://trino.io/docs/current/functions/conversion.html#typeof",
		description: "Returns the name of the type of the provided expression.",
		origin: "vendor-docs",
	},
	upper: {
		docUrl: "https://trino.io/docs/current/functions/string.html#upper",
		description: "Converts `string` to uppercase.",
		origin: "vendor-docs",
	},
	url_decode: {
		docUrl: "https://trino.io/docs/current/functions/url.html#url_decode",
		description: "Unescapes the URL encoded `value`.",
		origin: "vendor-docs",
	},
	url_encode: {
		docUrl: "https://trino.io/docs/current/functions/url.html#url_encode",
		description:
			"Escapes `value` by encoding it so that it can be safely included in URL query parameter names and values.",
		origin: "vendor-docs",
	},
	url_extract_fragment: {
		docUrl: "https://trino.io/docs/current/functions/url.html#url_extract_fragment",
		description: "Returns the fragment identifier from `url`.",
		origin: "vendor-docs",
	},
	url_extract_host: {
		docUrl: "https://trino.io/docs/current/functions/url.html#url_extract_host",
		description: "Returns the host from `url`.",
		origin: "vendor-docs",
	},
	url_extract_parameter: {
		docUrl: "https://trino.io/docs/current/functions/url.html#url_extract_parameter",
		description: "Returns the value of the first query string parameter named `name` from `url`.",
		origin: "vendor-docs",
	},
	url_extract_path: {
		docUrl: "https://trino.io/docs/current/functions/url.html#url_extract_path",
		description: "Returns the path from `url`.",
		origin: "vendor-docs",
	},
	url_extract_port: {
		docUrl: "https://trino.io/docs/current/functions/url.html#url_extract_port",
		description: "Returns the port number from `url`.",
		origin: "vendor-docs",
	},
	url_extract_protocol: {
		docUrl: "https://trino.io/docs/current/functions/url.html#url_extract_protocol",
		description: "Returns the protocol from `url`.",
		origin: "vendor-docs",
	},
	url_extract_query: {
		docUrl: "https://trino.io/docs/current/functions/url.html#url_extract_query",
		description: "Returns the query string from `url`.",
		origin: "vendor-docs",
	},
	uuid: {
		docUrl: "https://trino.io/docs/current/functions/uuid.html#uuid",
		description: "Returns a pseudo randomly generated uuid-type (type 4).",
		origin: "vendor-docs",
	},
	value_at_quantile: {
		docUrl: "https://trino.io/docs/current/functions/tdigest.html#value_at_quantile",
		description:
			"Returns the approximate percentile value from the quantile digest given the number `quantile` between 0 and 1.",
		origin: "vendor-docs",
	},
	values_at_quantiles: {
		docUrl: "https://trino.io/docs/current/functions/tdigest.html#values_at_quantiles",
		description:
			"Returns the approximate percentile values as an array given the input quantile digest and array of values between 0 and 1 which represent the quantiles to return.",
		origin: "vendor-docs",
	},
	var_pop: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#var_pop",
		description: "Returns the population variance of all input values.",
		origin: "vendor-docs",
	},
	var_samp: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#var_samp",
		description: "Returns the sample variance of all input values.",
		origin: "vendor-docs",
	},
	variance: {
		docUrl: "https://trino.io/docs/current/functions/aggregate.html#variance",
		description: "This is an alias for var_samp.",
		origin: "vendor-docs",
	},
	variant_is_null: {
		docUrl: "https://trino.io/docs/current/functions/variant.html#variant_is_null",
		description: "Returns `true` if the input value represents a *variant null*.",
		origin: "vendor-docs",
	},
	version: {
		docUrl: "https://trino.io/docs/current/functions/system.html#version",
		description: "Returns the Trino version used on the cluster.",
		origin: "vendor-docs",
	},
	week: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#week",
		description: "Returns the [ISO week] of the year from `x`.",
		origin: "vendor-docs",
	},
	week_of_year: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#week_of_year",
		description: "This is an alias for week.",
		origin: "vendor-docs",
	},
	width_bucket: {
		docUrl: "https://trino.io/docs/current/functions/math.html#width_bucket",
		description:
			"Returns the bin number of `x` in an equi-width histogram with the specified `bound1` and `bound2` bounds and `n` number of buckets.",
		origin: "vendor-docs",
	},
	wilson_interval_lower: {
		docUrl: "https://trino.io/docs/current/functions/math.html#wilson_interval_lower",
		description:
			"Returns the lower bound of the Wilson score interval of a Bernoulli trial process at a confidence specified by the z-score `z`.",
		origin: "vendor-docs",
	},
	wilson_interval_upper: {
		docUrl: "https://trino.io/docs/current/functions/math.html#wilson_interval_upper",
		description:
			"Returns the upper bound of the Wilson score interval of a Bernoulli trial process at a confidence specified by the z-score `z`.",
		origin: "vendor-docs",
	},
	word_stem: {
		docUrl: "https://trino.io/docs/current/functions/string.html#word_stem",
		description: "Returns the stem of `word` in the English language.",
		origin: "vendor-docs",
	},
	xxhash64: {
		docUrl: "https://trino.io/docs/current/functions/binary.html#xxhash64",
		description: "Computes the xxHash64 hash of `binary`.",
		origin: "vendor-docs",
	},
	year: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#year",
		description: "Returns the year from `x`.",
		origin: "vendor-docs",
	},
	year_of_week: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#year_of_week",
		description: "Returns the year of the [ISO week] from `x`.",
		origin: "vendor-docs",
	},
	yow: {
		docUrl: "https://trino.io/docs/current/functions/datetime.html#yow",
		description: "This is an alias for year_of_week.",
		origin: "vendor-docs",
	},
	zip: {
		docUrl: "https://trino.io/docs/current/functions/array.html#zip",
		description: "Merges the given arrays, element-wise, into a single array of rows.",
		origin: "vendor-docs",
	},
};
