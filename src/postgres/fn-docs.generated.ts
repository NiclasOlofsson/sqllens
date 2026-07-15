// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for postgres (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-15. 596 names (537 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const POSTGRES_FN_DOCS: Record<string, FnDoc> = {
	abbrev: {
		docUrl: "https://www.postgresql.org/docs/18/functions-net.html",
		description: "Creates an abbreviated display format as text.",
		origin: "vendor-docs",
	},
	abs: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Absolute value",
		origin: "vendor-docs",
	},
	acldefault: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Constructs an aclitem array holding the default access privileges for an object of type type belonging to the role with OID ownerId.",
		origin: "vendor-docs",
	},
	aclexplode: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the aclitem array as a set of rows.",
		origin: "vendor-docs",
	},
	acos: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Inverse cosine, result in radians",
		origin: "vendor-docs",
	},
	acosd: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Inverse cosine, result in degrees",
		origin: "vendor-docs",
	},
	acosh: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Inverse hyperbolic cosine",
		origin: "vendor-docs",
	},
	age: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description:
			"Subtract arguments, producing a symbolic result that uses years and months, rather than just days",
		origin: "vendor-docs",
	},
	any_value: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Returns an arbitrary value from the non-null input values.",
		origin: "vendor-docs",
	},
	area: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description:
			"Computes area. Available for box, path, circle. A path input must be closed, else NULL is returned. Also, if the path is self-intersecting, the result may be meaningless.",
		origin: "vendor-docs",
	},
	array_agg: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Collects all the input values, including nulls, into an array.",
		origin: "vendor-docs",
	},
	array_append: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description:
			"Appends an element to the end of an array (same as the anycompatiblearray || anycompatible operator).",
		origin: "vendor-docs",
	},
	array_cat: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Concatenates two arrays (same as the anycompatiblearray || anycompatiblearray operator).",
		origin: "vendor-docs",
	},
	array_dims: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Returns a text representation of the array's dimensions.",
		origin: "vendor-docs",
	},
	array_fill: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description:
			"Returns an array filled with copies of the given value, having dimensions of the lengths specified by the second argument.",
		origin: "vendor-docs",
	},
	array_length: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Returns the length of the requested array dimension.",
		origin: "vendor-docs",
	},
	array_lower: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Returns the lower bound of the requested array dimension.",
		origin: "vendor-docs",
	},
	array_ndims: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Returns the number of dimensions of the array.",
		origin: "vendor-docs",
	},
	array_position: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description:
			"Returns the subscript of the first occurrence of the second argument in the array, or NULL if it's not present.",
		origin: "vendor-docs",
	},
	array_positions: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description:
			"Returns an array of the subscripts of all occurrences of the second argument in the array given as first argument.",
		origin: "vendor-docs",
	},
	array_prepend: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description:
			"Prepends an element to the beginning of an array (same as the anycompatible || anycompatiblearray operator).",
		origin: "vendor-docs",
	},
	array_remove: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Removes all elements equal to the given value from the array.",
		origin: "vendor-docs",
	},
	array_replace: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Replaces each array element equal to the second argument with the third argument.",
		origin: "vendor-docs",
	},
	array_reverse: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Reverses the first dimension of the array.",
		origin: "vendor-docs",
	},
	array_sample: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Returns an array of n items randomly selected from array.",
		origin: "vendor-docs",
	},
	array_shuffle: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Randomly shuffles the first dimension of the array.",
		origin: "vendor-docs",
	},
	array_sort: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Sorts the first dimension of the array.",
		origin: "vendor-docs",
	},
	array_to_json: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Converts an SQL array to a JSON array.",
		origin: "vendor-docs",
	},
	array_to_string: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description:
			"Converts each array element to its text representation, and concatenates those separated by the delimiter string.",
		origin: "vendor-docs",
	},
	array_to_tsvector: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description: "Converts an array of text strings to a tsvector.",
		origin: "vendor-docs",
	},
	array_upper: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Returns the upper bound of the requested array dimension.",
		origin: "vendor-docs",
	},
	ascii: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Returns the numeric code of the first character of the argument.",
		origin: "vendor-docs",
	},
	asin: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Inverse sine, result in radians",
		origin: "vendor-docs",
	},
	asind: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Inverse sine, result in degrees",
		origin: "vendor-docs",
	},
	asinh: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Inverse hyperbolic sine",
		origin: "vendor-docs",
	},
	atan: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Inverse tangent, result in radians",
		origin: "vendor-docs",
	},
	atan2: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Inverse tangent of y/x, result in radians",
		origin: "vendor-docs",
	},
	atan2d: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Inverse tangent of y/x, result in degrees",
		origin: "vendor-docs",
	},
	atand: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Inverse tangent, result in degrees",
		origin: "vendor-docs",
	},
	atanh: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Inverse hyperbolic tangent",
		origin: "vendor-docs",
	},
	avg: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the average (arithmetic mean) of all the non-null input values.",
		origin: "vendor-docs",
	},
	bit_and: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the bitwise AND of all non-null input values.",
		origin: "vendor-docs",
	},
	bit_count: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description: "Returns the number of bits set in the binary string (also known as popcount).",
		origin: "vendor-docs",
	},
	bit_length: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Returns number of bits in the string (8 times the octet_length).",
		origin: "vendor-docs",
	},
	bit_or: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the bitwise OR of all non-null input values.",
		origin: "vendor-docs",
	},
	bit_xor: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the bitwise exclusive OR of all non-null input values.",
		origin: "vendor-docs",
	},
	bool_and: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Returns true if all non-null input values are true, otherwise false.",
		origin: "vendor-docs",
	},
	bool_or: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Returns true if any non-null input value is true, otherwise false.",
		origin: "vendor-docs",
	},
	bound_box: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Computes bounding box of two boxes.",
		origin: "vendor-docs",
	},
	box: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Computes box inscribed within the circle.",
		origin: "vendor-docs",
	},
	brin_desummarize_range: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Removes the BRIN index tuple that summarizes the page range covering the given table block, if there is one.",
		origin: "vendor-docs",
	},
	brin_summarize_new_values: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Scans the specified BRIN index to find page ranges in the base table that are not currently summarized by the index; for any such range it creates a new summary index tuple by scanning those table pages.",
		origin: "vendor-docs",
	},
	brin_summarize_range: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Summarizes the page range covering the given block, if not already summarized.",
		origin: "vendor-docs",
	},
	broadcast: {
		docUrl: "https://www.postgresql.org/docs/18/functions-net.html",
		description: "Computes the broadcast address for the address's network.",
		origin: "vendor-docs",
	},
	btrim: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Removes the longest string containing only characters in characters (a space by default) from the start and end of string.",
		origin: "vendor-docs",
	},
	cardinality: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Returns the total number of elements in the array, or 0 if the array is empty.",
		origin: "vendor-docs",
	},
	casefold: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Performs case folding of the input string according to the collation.",
		origin: "vendor-docs",
	},
	cbrt: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Cube root",
		origin: "vendor-docs",
	},
	ceil: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Nearest integer greater than or equal to argument",
		origin: "vendor-docs",
	},
	ceiling: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Nearest integer greater than or equal to argument (same as ceil)",
		origin: "vendor-docs",
	},
	center: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Computes center point.",
		origin: "vendor-docs",
	},
	char_length: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Returns number of characters in the string.",
		origin: "vendor-docs",
	},
	character_length: { docUrl: "https://www.postgresql.org/docs/18/functions-string.html", origin: "vendor-docs" },
	chr: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Returns the character with the given code.",
		origin: "vendor-docs",
	},
	circle: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Computes smallest circle enclosing box.",
		origin: "vendor-docs",
	},
	clock_timestamp: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Current date and time (changes during statement execution); see",
		origin: "vendor-docs",
	},
	coalesce: { docUrl: "https://www.postgresql.org/docs/18/functions-conditional.html", origin: "vendor-docs" },
	col_description: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the comment for a table column, which is specified by the OID of its table and its column number.",
		origin: "vendor-docs",
	},
	concat: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Concatenates the text representations of all the arguments.",
		origin: "vendor-docs",
	},
	concat_ws: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Concatenates all but the first argument, with separators.",
		origin: "vendor-docs",
	},
	convert: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description:
			"Converts a binary string representing text in encoding src_encoding to a binary string in encoding dest_encoding (see for available conversions).",
		origin: "vendor-docs",
	},
	convert_from: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description:
			"Converts a binary string representing text in encoding src_encoding to text in the database encoding (see for available conversions).",
		origin: "vendor-docs",
	},
	convert_to: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description:
			"Converts a text string (in the database encoding) to a binary string encoded in encoding dest_encoding (see for available conversions).",
		origin: "vendor-docs",
	},
	corr: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the correlation coefficient.",
		origin: "vendor-docs",
	},
	cos: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Cosine, argument in radians",
		origin: "vendor-docs",
	},
	cosd: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Cosine, argument in degrees",
		origin: "vendor-docs",
	},
	cosh: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Hyperbolic cosine",
		origin: "vendor-docs",
	},
	cot: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Cotangent, argument in radians",
		origin: "vendor-docs",
	},
	cotd: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Cotangent, argument in degrees",
		origin: "vendor-docs",
	},
	count: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the number of input rows.",
		origin: "vendor-docs",
	},
	covar_pop: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the population covariance.",
		origin: "vendor-docs",
	},
	covar_samp: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the sample covariance.",
		origin: "vendor-docs",
	},
	crc32: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description: "Computes the CRC-32 value of the binary string.",
		origin: "vendor-docs",
	},
	crc32c: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description: "Computes the CRC-32C value of the binary string.",
		origin: "vendor-docs",
	},
	cume_dist: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description:
			"Computes the cumulative distribution, that is (number of rows preceding or peers with hypothetical row) / (total rows).",
		origin: "vendor-docs",
	},
	current_catalog: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the name of the current database.",
		origin: "vendor-docs",
	},
	current_database: { docUrl: "https://www.postgresql.org/docs/18/functions-info.html", origin: "vendor-docs" },
	current_date: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Current date; see",
		origin: "vendor-docs",
	},
	current_query: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the text of the currently executing query, as submitted by the client (which might contain more than one statement).",
		origin: "vendor-docs",
	},
	current_role: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "This is equivalent to current_user.",
		origin: "vendor-docs",
	},
	current_schema: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the name of the schema that is first in the search path (or a null value if the search path is empty).",
		origin: "vendor-docs",
	},
	current_schemas: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns an array of the names of all schemas presently in the effective search path, in their priority order.",
		origin: "vendor-docs",
	},
	current_setting: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Returns the current value of the setting setting_name.",
		origin: "vendor-docs",
	},
	current_time: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Current time of day; see",
		origin: "vendor-docs",
	},
	current_timestamp: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Current date and time (start of current transaction); see",
		origin: "vendor-docs",
	},
	current_user: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the user name of the current execution context.",
		origin: "vendor-docs",
	},
	currval: {
		docUrl: "https://www.postgresql.org/docs/18/functions-sequence.html",
		description: "Returns the value most recently obtained by nextval for this sequence in the current session.",
		origin: "vendor-docs",
	},
	date_add: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description:
			"Add an interval to a timestamp with time zone, computing times of day and daylight-savings adjustments according to the time zone named by the third argument, or the current setting if that is omitted.",
		origin: "vendor-docs",
	},
	date_bin: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Bin input into specified interval aligned with specified origin; see",
		origin: "vendor-docs",
	},
	date_part: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Get timestamp subfield (equivalent to extract); see",
		origin: "vendor-docs",
	},
	date_subtract: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description:
			"Subtract an interval from a timestamp with time zone, computing times of day and daylight-savings adjustments according to the time zone named by the third argument, or the current setting if that is omitted.",
		origin: "vendor-docs",
	},
	date_trunc: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Truncate to specified precision; see",
		origin: "vendor-docs",
	},
	decode: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description:
			"Decodes binary data from a textual representation; supported format values are the same as for encode.",
		origin: "vendor-docs",
	},
	degrees: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Converts radians to degrees",
		origin: "vendor-docs",
	},
	dense_rank: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description:
			"Computes the rank of the hypothetical row, without gaps; this function effectively counts peer groups.",
		origin: "vendor-docs",
	},
	diagonal: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Extracts box's diagonal as a line segment (same as lseg(box)).",
		origin: "vendor-docs",
	},
	diameter: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Computes diameter of circle.",
		origin: "vendor-docs",
	},
	div: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Integer quotient of y/x (truncates towards zero)",
		origin: "vendor-docs",
	},
	encode: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description:
			"Encodes binary data into a textual representation; supported format values are: base64, escape, hex.",
		origin: "vendor-docs",
	},
	enum_first: {
		docUrl: "https://www.postgresql.org/docs/18/functions-enum.html",
		description: "Returns the first value of the input enum type.",
		origin: "vendor-docs",
	},
	enum_last: {
		docUrl: "https://www.postgresql.org/docs/18/functions-enum.html",
		description: "Returns the last value of the input enum type.",
		origin: "vendor-docs",
	},
	enum_range: {
		docUrl: "https://www.postgresql.org/docs/18/functions-enum.html",
		description: "Returns all values of the input enum type in an ordered array.",
		origin: "vendor-docs",
	},
	erf: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Error function",
		origin: "vendor-docs",
	},
	erfc: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Complementary error function (1 - erf(x), without loss of precision for large inputs)",
		origin: "vendor-docs",
	},
	every: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "This is the SQL standard's equivalent to bool_and.",
		origin: "vendor-docs",
	},
	exp: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Exponential (e raised to the given power)",
		origin: "vendor-docs",
	},
	factorial: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Factorial",
		origin: "vendor-docs",
	},
	family: {
		docUrl: "https://www.postgresql.org/docs/18/functions-net.html",
		description: "Returns the address's family: 4 for IPv4, 6 for IPv6.",
		origin: "vendor-docs",
	},
	first_value: {
		docUrl: "https://www.postgresql.org/docs/18/functions-window.html",
		description: "Returns value evaluated at the row that is the first row of the window frame.",
		origin: "vendor-docs",
	},
	floor: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Nearest integer less than or equal to argument",
		origin: "vendor-docs",
	},
	format: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Formats arguments according to a format string; see .",
		origin: "vendor-docs",
	},
	format_type: { docUrl: "https://www.postgresql.org/docs/18/functions-info.html", origin: "vendor-docs" },
	gamma: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Gamma function",
		origin: "vendor-docs",
	},
	gcd: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description:
			"Greatest common divisor (the largest positive number that divides both inputs with no remainder); returns 0 if both inputs are zero; available for integer, bigint, and numeric",
		origin: "vendor-docs",
	},
	gen_random_uuid: {
		docUrl: "https://www.postgresql.org/docs/18/functions-uuid.html",
		description: "Generates a version 4 (random) UUID",
		origin: "vendor-docs",
	},
	generate_series: {
		docUrl: "https://www.postgresql.org/docs/18/functions-srf.html",
		description: "Generates a series of values from start to stop, with a step size of step.",
		origin: "vendor-docs",
	},
	generate_subscripts: {
		docUrl: "https://www.postgresql.org/docs/18/functions-srf.html",
		description: "Generates a series comprising the valid subscripts of the dim'th dimension of the given array.",
		origin: "vendor-docs",
	},
	get_bit: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description: "Extracts n'th bit from binary string.",
		origin: "vendor-docs",
	},
	get_byte: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description: "Extracts n'th byte from binary string.",
		origin: "vendor-docs",
	},
	get_current_ts_config: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description: "Returns the OID of the current default text search configuration (as set by ).",
		origin: "vendor-docs",
	},
	gin_clean_pending_list: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Cleans up the pending list of the specified GIN index by moving entries in it, in bulk, to the main GIN data structure.",
		origin: "vendor-docs",
	},
	greatest: { docUrl: "https://www.postgresql.org/docs/18/functions-conditional.html", origin: "vendor-docs" },
	grouping: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description:
			"Returns a bit mask indicating which GROUP BY expressions are not included in the current grouping set.",
		origin: "vendor-docs",
	},
	height: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Computes vertical size of box.",
		origin: "vendor-docs",
	},
	host: {
		docUrl: "https://www.postgresql.org/docs/18/functions-net.html",
		description: "Returns the IP address as text, ignoring the netmask.",
		origin: "vendor-docs",
	},
	hostmask: {
		docUrl: "https://www.postgresql.org/docs/18/functions-net.html",
		description: "Computes the host mask for the address's network.",
		origin: "vendor-docs",
	},
	icu_unicode_version: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns a string representing the version of Unicode used by ICU, if the server was built with ICU support; otherwise returns NULL",
		origin: "vendor-docs",
	},
	inet_client_addr: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the IP address of the current client, or NULL if the current connection is via a Unix-domain socket.",
		origin: "vendor-docs",
	},
	inet_client_port: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the IP port number of the current client, or NULL if the current connection is via a Unix-domain socket.",
		origin: "vendor-docs",
	},
	inet_merge: {
		docUrl: "https://www.postgresql.org/docs/18/functions-net.html",
		description: "Computes the smallest network that includes both of the given networks.",
		origin: "vendor-docs",
	},
	inet_same_family: {
		docUrl: "https://www.postgresql.org/docs/18/functions-net.html",
		description: "Tests whether the addresses belong to the same IP family.",
		origin: "vendor-docs",
	},
	inet_server_addr: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the IP address on which the server accepted the current connection, or NULL if the current connection is via a Unix-domain socket.",
		origin: "vendor-docs",
	},
	inet_server_port: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the IP port number on which the server accepted the current connection, or NULL if the current connection is via a Unix-domain socket.",
		origin: "vendor-docs",
	},
	initcap: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Converts the first letter of each word to upper case and the rest to lower case.",
		origin: "vendor-docs",
	},
	isclosed: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Is path closed?",
		origin: "vendor-docs",
	},
	isempty: {
		docUrl: "https://www.postgresql.org/docs/18/functions-range.html",
		description: "Is the range empty?",
		origin: "vendor-docs",
	},
	isfinite: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Test for finite date (not +/-infinity)",
		origin: "vendor-docs",
	},
	isopen: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Is path open?",
		origin: "vendor-docs",
	},
	json_agg_strict: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Collects all the input values, skipping nulls, into a JSON array.",
		origin: "vendor-docs",
	},
	json_array_elements: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Expands the top-level JSON array into a set of JSON values.",
		origin: "vendor-docs",
	},
	json_array_elements_text: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Expands the top-level JSON array into a set of text values.",
		origin: "vendor-docs",
	},
	json_array_length: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Returns the number of elements in the top-level JSON array.",
		origin: "vendor-docs",
	},
	json_build_array: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Builds a possibly-heterogeneously-typed JSON array out of a variadic argument list.",
		origin: "vendor-docs",
	},
	json_build_object: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Builds a JSON object out of a variadic argument list.",
		origin: "vendor-docs",
	},
	json_each: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Expands the top-level JSON object into a set of key/value pairs.",
		origin: "vendor-docs",
	},
	json_each_text: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Expands the top-level JSON object into a set of key/value pairs.",
		origin: "vendor-docs",
	},
	json_extract_path: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Extracts JSON sub-object at the specified path.",
		origin: "vendor-docs",
	},
	json_extract_path_text: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Extracts JSON sub-object at the specified path as text.",
		origin: "vendor-docs",
	},
	json_object: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Constructs a JSON object of all the key/value pairs given, or an empty object if none are given.",
		origin: "vendor-docs",
	},
	json_object_agg_strict: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Collects all the key/value pairs into a JSON object.",
		origin: "vendor-docs",
	},
	json_object_agg_unique: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Collects all the key/value pairs into a JSON object.",
		origin: "vendor-docs",
	},
	json_object_agg_unique_strict: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Collects all the key/value pairs into a JSON object.",
		origin: "vendor-docs",
	},
	json_object_keys: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Returns the set of keys in the top-level JSON object.",
		origin: "vendor-docs",
	},
	json_populate_record: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Expands the top-level JSON object to a row having the composite type of the base argument.",
		origin: "vendor-docs",
	},
	json_populate_recordset: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description:
			"Expands the top-level JSON array of objects to a set of rows having the composite type of the base argument.",
		origin: "vendor-docs",
	},
	json_scalar: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Converts a given SQL scalar value into a JSON scalar value.",
		origin: "vendor-docs",
	},
	json_strip_nulls: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Deletes all object fields that have null values from the given JSON value, recursively.",
		origin: "vendor-docs",
	},
	json_to_record: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Expands the top-level JSON object to a row having the composite type defined by an AS clause.",
		origin: "vendor-docs",
	},
	json_to_recordset: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description:
			"Expands the top-level JSON array of objects to a set of rows having the composite type defined by an AS clause.",
		origin: "vendor-docs",
	},
	json_typeof: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Returns the type of the top-level JSON value as a text string.",
		origin: "vendor-docs",
	},
	jsonb_agg_strict: { docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html", origin: "vendor-docs" },
	jsonb_array_elements: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_array_elements_text: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		origin: "vendor-docs",
	},
	jsonb_array_length: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_build_array: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_build_object: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_each: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_each_text: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_extract_path: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_extract_path_text: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		origin: "vendor-docs",
	},
	jsonb_insert: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Returns target with new_value inserted.",
		origin: "vendor-docs",
	},
	jsonb_object: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_object_agg_strict: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		origin: "vendor-docs",
	},
	jsonb_object_agg_unique: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		origin: "vendor-docs",
	},
	jsonb_object_agg_unique_strict: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		origin: "vendor-docs",
	},
	jsonb_object_keys: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_path_exists: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Checks whether the JSON path returns any item for the specified JSON value.",
		origin: "vendor-docs",
	},
	jsonb_path_exists_tz: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description:
			"These functions act like their counterparts described above without the _tz suffix, except that these functions support comparisons of date/time values that require timezone-aware conversions.",
		origin: "vendor-docs",
	},
	jsonb_path_match: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Returns the SQL boolean result of a JSON path predicate check for the specified JSON value.",
		origin: "vendor-docs",
	},
	jsonb_path_match_tz: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_path_query: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Returns all JSON items returned by the JSON path for the specified JSON value.",
		origin: "vendor-docs",
	},
	jsonb_path_query_array: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Returns all JSON items returned by the JSON path for the specified JSON value, as a JSON array.",
		origin: "vendor-docs",
	},
	jsonb_path_query_array_tz: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		origin: "vendor-docs",
	},
	jsonb_path_query_first: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description:
			"Returns the first JSON item returned by the JSON path for the specified JSON value, or NULL if there are no results.",
		origin: "vendor-docs",
	},
	jsonb_path_query_first_tz: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		origin: "vendor-docs",
	},
	jsonb_path_query_tz: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_populate_record: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_populate_record_valid: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Function for testing jsonb_populate_record.",
		origin: "vendor-docs",
	},
	jsonb_populate_recordset: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		origin: "vendor-docs",
	},
	jsonb_pretty: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Converts the given JSON value to pretty-printed, indented text.",
		origin: "vendor-docs",
	},
	jsonb_set: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description:
			"Returns target with the item designated by path replaced by new_value, or with new_value added if create_if_missing is true (which is the default) and the item designated by path does not exist.",
		origin: "vendor-docs",
	},
	jsonb_set_lax: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "If new_value is not NULL, behaves identically to jsonb_set.",
		origin: "vendor-docs",
	},
	jsonb_strip_nulls: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_to_record: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_to_recordset: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	jsonb_typeof: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	justify_days: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Adjust interval, converting 30-day time periods to months",
		origin: "vendor-docs",
	},
	justify_hours: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Adjust interval, converting 24-hour time periods to days",
		origin: "vendor-docs",
	},
	justify_interval: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Adjust interval using justify_days and justify_hours, with additional sign adjustments",
		origin: "vendor-docs",
	},
	lag: {
		docUrl: "https://www.postgresql.org/docs/18/functions-window.html",
		description:
			"Returns value evaluated at the row that is offset rows before the current row within the partition; if there is no such row, instead returns default (which must be of a type compatible with value).",
		origin: "vendor-docs",
	},
	last_value: {
		docUrl: "https://www.postgresql.org/docs/18/functions-window.html",
		description: "Returns value evaluated at the row that is the last row of the window frame.",
		origin: "vendor-docs",
	},
	lastval: {
		docUrl: "https://www.postgresql.org/docs/18/functions-sequence.html",
		description: "Returns the value most recently returned by nextval in the current session.",
		origin: "vendor-docs",
	},
	lcm: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description:
			"Least common multiple (the smallest strictly positive number that is an integral multiple of both inputs); returns 0 if either input is zero; available for integer, bigint, and numeric",
		origin: "vendor-docs",
	},
	lead: {
		docUrl: "https://www.postgresql.org/docs/18/functions-window.html",
		description:
			"Returns value evaluated at the row that is offset rows after the current row within the partition; if there is no such row, instead returns default (which must be of a type compatible with value).",
		origin: "vendor-docs",
	},
	least: { docUrl: "https://www.postgresql.org/docs/18/functions-conditional.html", origin: "vendor-docs" },
	left: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Returns first n characters in the string, or when n is negative, returns all but last |n| characters.",
		origin: "vendor-docs",
	},
	length: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description: "Returns the number of characters in the string.",
		origin: "vendor-docs",
	},
	lgamma: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Natural logarithm of the absolute value of the gamma function",
		origin: "vendor-docs",
	},
	line: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Converts two points to the line through them.",
		origin: "vendor-docs",
	},
	ln: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Natural logarithm",
		origin: "vendor-docs",
	},
	localtime: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Current time of day; see",
		origin: "vendor-docs",
	},
	localtimestamp: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Current date and time (start of current transaction); see",
		origin: "vendor-docs",
	},
	log: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Base 10 logarithm",
		origin: "vendor-docs",
	},
	log10: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Base 10 logarithm (same as log)",
		origin: "vendor-docs",
	},
	lower: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Converts the string to all lower case, according to the rules of the database's locale.",
		origin: "vendor-docs",
	},
	lower_inc: {
		docUrl: "https://www.postgresql.org/docs/18/functions-range.html",
		description: "Is the range's lower bound inclusive?",
		origin: "vendor-docs",
	},
	lower_inf: {
		docUrl: "https://www.postgresql.org/docs/18/functions-range.html",
		description: "Does the range have no lower bound?",
		origin: "vendor-docs",
	},
	lpad: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Extends the string to length length by prepending the characters fill (a space by default).",
		origin: "vendor-docs",
	},
	lseg: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Extracts box's diagonal as a line segment.",
		origin: "vendor-docs",
	},
	ltrim: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Removes the longest string containing only characters in characters (a space by default) from the start of string.",
		origin: "vendor-docs",
	},
	macaddr8_set7bit: {
		docUrl: "https://www.postgresql.org/docs/18/functions-net.html",
		description:
			"Sets the 7th bit of the address to one, creating what is known as modified EUI-64, for inclusion in an IPv6 address.",
		origin: "vendor-docs",
	},
	make_date: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Create date from year, month and day fields (negative years signify BC)",
		origin: "vendor-docs",
	},
	make_interval: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description:
			"Create interval from years, months, weeks, days, hours, minutes and seconds fields, each of which can default to zero",
		origin: "vendor-docs",
	},
	make_time: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Create time from hour, minute and seconds fields",
		origin: "vendor-docs",
	},
	make_timestamp: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description:
			"Create timestamp from year, month, day, hour, minute and seconds fields (negative years signify BC)",
		origin: "vendor-docs",
	},
	make_timestamptz: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description:
			"Create timestamp with time zone from year, month, day, hour, minute and seconds fields (negative years signify BC).",
		origin: "vendor-docs",
	},
	makeaclitem: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Constructs an aclitem with the given properties.",
		origin: "vendor-docs",
	},
	masklen: {
		docUrl: "https://www.postgresql.org/docs/18/functions-net.html",
		description: "Returns the netmask length in bits.",
		origin: "vendor-docs",
	},
	max: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the maximum of the non-null input values.",
		origin: "vendor-docs",
	},
	md5: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Computes the MD5 hash of the argument, with the result written in hexadecimal.",
		origin: "vendor-docs",
	},
	merge_action: { docUrl: "https://www.postgresql.org/docs/18/functions-merge-support.html", origin: "vendor-docs" },
	min: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the minimum of the non-null input values.",
		origin: "vendor-docs",
	},
	min_scale: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description:
			"Minimum scale (number of fractional decimal digits) needed to represent the supplied value precisely",
		origin: "vendor-docs",
	},
	mod: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Remainder of y/x; available for smallint, integer, bigint, and numeric",
		origin: "vendor-docs",
	},
	mode: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description:
			"Computes the mode, the most frequent value of the aggregated argument (arbitrarily choosing the first one if there are multiple equally-frequent values).",
		origin: "vendor-docs",
	},
	multirange: {
		docUrl: "https://www.postgresql.org/docs/18/functions-range.html",
		description: "Returns a multirange containing just the given range.",
		origin: "vendor-docs",
	},
	mxid_age: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the number of multixacts IDs between the supplied multixact ID and the current multixacts counter.",
		origin: "vendor-docs",
	},
	netmask: {
		docUrl: "https://www.postgresql.org/docs/18/functions-net.html",
		description: "Computes the network mask for the address's network.",
		origin: "vendor-docs",
	},
	network: {
		docUrl: "https://www.postgresql.org/docs/18/functions-net.html",
		description: "Returns the network part of the address, zeroing out whatever is to the right of the netmask.",
		origin: "vendor-docs",
	},
	nextval: {
		docUrl: "https://www.postgresql.org/docs/18/functions-sequence.html",
		description: "Advances the sequence object to its next value and returns that value.",
		origin: "vendor-docs",
	},
	normalize: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Converts the string to the specified Unicode normalization form.",
		origin: "vendor-docs",
	},
	now: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Current date and time (start of current transaction); see",
		origin: "vendor-docs",
	},
	npoints: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Returns the number of points.",
		origin: "vendor-docs",
	},
	nth_value: {
		docUrl: "https://www.postgresql.org/docs/18/functions-window.html",
		description:
			"Returns value evaluated at the row that is the n'th row of the window frame (counting from 1); returns NULL if there is no such row.",
		origin: "vendor-docs",
	},
	ntile: {
		docUrl: "https://www.postgresql.org/docs/18/functions-window.html",
		description:
			"Returns an integer ranging from 1 to the argument value, dividing the partition as equally as possible.",
		origin: "vendor-docs",
	},
	nullif: { docUrl: "https://www.postgresql.org/docs/18/functions-conditional.html", origin: "vendor-docs" },
	num_nonnulls: {
		docUrl: "https://www.postgresql.org/docs/18/functions-comparison.html",
		description: "Returns the number of non-null arguments.",
		origin: "vendor-docs",
	},
	num_nulls: {
		docUrl: "https://www.postgresql.org/docs/18/functions-comparison.html",
		description: "Returns the number of null arguments.",
		origin: "vendor-docs",
	},
	numnode: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description: "Returns the number of lexemes plus operators in the tsquery.",
		origin: "vendor-docs",
	},
	obj_description: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the comment for a database object specified by its OID and the name of the containing system catalog.",
		origin: "vendor-docs",
	},
	octet_length: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Returns number of bytes in the string.",
		origin: "vendor-docs",
	},
	path: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Converts polygon to a closed path with the same list of points.",
		origin: "vendor-docs",
	},
	pclose: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Converts path to closed form.",
		origin: "vendor-docs",
	},
	percent_rank: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the relative rank of the hypothetical row, that is (rank - 1) / (total rows - 1).",
		origin: "vendor-docs",
	},
	percentile_cont: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description:
			"Computes the continuous percentile, a value corresponding to the specified fraction within the ordered set of aggregated argument values.",
		origin: "vendor-docs",
	},
	percentile_disc: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description:
			"Computes the discrete percentile, the first value within the ordered set of aggregated argument values whose position in the ordering equals or exceeds the specified fraction.",
		origin: "vendor-docs",
	},
	pg_advisory_lock: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Obtains an exclusive session-level advisory lock, waiting if necessary.",
		origin: "vendor-docs",
	},
	pg_advisory_lock_shared: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Obtains a shared session-level advisory lock, waiting if necessary.",
		origin: "vendor-docs",
	},
	pg_advisory_unlock: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Releases a previously-acquired exclusive session-level advisory lock.",
		origin: "vendor-docs",
	},
	pg_advisory_unlock_all: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Releases all session-level advisory locks held by the current session.",
		origin: "vendor-docs",
	},
	pg_advisory_unlock_shared: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Releases a previously-acquired shared session-level advisory lock.",
		origin: "vendor-docs",
	},
	pg_advisory_xact_lock: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Obtains an exclusive transaction-level advisory lock, waiting if necessary.",
		origin: "vendor-docs",
	},
	pg_advisory_xact_lock_shared: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Obtains a shared transaction-level advisory lock, waiting if necessary.",
		origin: "vendor-docs",
	},
	pg_available_wal_summaries: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns information about the WAL summary files present in the data directory, under pg_wal/summaries.",
		origin: "vendor-docs",
	},
	pg_backend_pid: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the process ID of the server process attached to the current session.",
		origin: "vendor-docs",
	},
	pg_backup_start: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Prepares the server to begin an on-line backup.",
		origin: "vendor-docs",
	},
	pg_backup_stop: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Finishes performing an on-line backup.",
		origin: "vendor-docs",
	},
	pg_basetype: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the OID of the base type of a domain identified by its type OID.",
		origin: "vendor-docs",
	},
	pg_blocking_pids: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns an array of the process ID(s) of the sessions that are blocking the server process with the specified process ID from acquiring a lock, or an empty array if there is no such server process or it is not blocked.",
		origin: "vendor-docs",
	},
	pg_cancel_backend: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Cancels the current query of the session whose backend process has the specified process ID.",
		origin: "vendor-docs",
	},
	pg_char_to_encoding: { docUrl: "https://www.postgresql.org/docs/18/functions-info.html", origin: "vendor-docs" },
	pg_clear_attribute_stats: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Clears column-level statistics for the given relation and attribute, as though the table was newly created.",
		origin: "vendor-docs",
	},
	pg_clear_relation_stats: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Clears table-level statistics for the given relation, as though the table was newly created.",
		origin: "vendor-docs",
	},
	pg_client_encoding: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Returns current client encoding name.",
		origin: "vendor-docs",
	},
	pg_collation_actual_version: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Returns the actual version of the collation object as it is currently installed in the operating system.",
		origin: "vendor-docs",
	},
	pg_collation_is_visible: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Is collation visible in search path?",
		origin: "vendor-docs",
	},
	pg_column_compression: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Shows the compression algorithm that was used to compress an individual variable-length value.",
		origin: "vendor-docs",
	},
	pg_column_size: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Shows the number of bytes used to store any individual data value.",
		origin: "vendor-docs",
	},
	pg_column_toast_chunk_id: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Shows the chunk_id of an on-disk TOASTed value.",
		origin: "vendor-docs",
	},
	pg_conf_load_time: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the time when the server configuration files were last loaded.",
		origin: "vendor-docs",
	},
	pg_control_checkpoint: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns information about current checkpoint state, as shown in .",
		origin: "vendor-docs",
	},
	pg_control_init: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns information about cluster initialization state, as shown in .",
		origin: "vendor-docs",
	},
	pg_control_recovery: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns information about recovery state, as shown in .",
		origin: "vendor-docs",
	},
	pg_control_system: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns information about current control file state, as shown in .",
		origin: "vendor-docs",
	},
	pg_conversion_is_visible: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Is conversion visible in search path?",
		origin: "vendor-docs",
	},
	pg_copy_logical_replication_slot: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Copies an existing logical replication slot named src_slot_name to a logical replication slot named dst_slot_name, optionally changing the output plugin and persistence.",
		origin: "vendor-docs",
	},
	pg_copy_physical_replication_slot: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Copies an existing physical replication slot named src_slot_name to a physical replication slot named dst_slot_name.",
		origin: "vendor-docs",
	},
	pg_create_restore_point: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Creates a named marker record in the write-ahead log that can later be used as a recovery target, and returns the corresponding write-ahead log location.",
		origin: "vendor-docs",
	},
	pg_current_logfile: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the path name of the log file currently in use by the logging collector.",
		origin: "vendor-docs",
	},
	pg_current_snapshot: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns a current snapshot, a data structure showing which transaction IDs are now in-progress.",
		origin: "vendor-docs",
	},
	pg_current_wal_flush_lsn: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Returns the current write-ahead log flush location (see notes below).",
		origin: "vendor-docs",
	},
	pg_current_wal_insert_lsn: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Returns the current write-ahead log insert location (see notes below).",
		origin: "vendor-docs",
	},
	pg_current_wal_lsn: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Returns the current write-ahead log write location (see notes below).",
		origin: "vendor-docs",
	},
	pg_current_xact_id: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the current transaction's ID.",
		origin: "vendor-docs",
	},
	pg_current_xact_id_if_assigned: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the current transaction's ID, or NULL if no ID is assigned yet.",
		origin: "vendor-docs",
	},
	pg_database_collation_actual_version: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Returns the actual version of the database's collation as it is currently installed in the operating system.",
		origin: "vendor-docs",
	},
	pg_database_size: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Computes the total disk space used by the database with the specified name or OID.",
		origin: "vendor-docs",
	},
	pg_describe_object: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns a textual description of a database object identified by catalog OID, object OID, and sub-object ID (such as a column number within a table; the sub-object ID is zero when referring to a whole object).",
		origin: "vendor-docs",
	},
	pg_drop_replication_slot: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Drops the physical or logical replication slot named slot_name.",
		origin: "vendor-docs",
	},
	pg_encoding_to_char: { docUrl: "https://www.postgresql.org/docs/18/functions-info.html", origin: "vendor-docs" },
	pg_event_trigger_ddl_commands: {
		docUrl: "https://www.postgresql.org/docs/18/functions-event-triggers.html",
		origin: "vendor-docs",
	},
	pg_event_trigger_dropped_objects: {
		docUrl: "https://www.postgresql.org/docs/18/functions-event-triggers.html",
		origin: "vendor-docs",
	},
	pg_event_trigger_table_rewrite_oid: {
		docUrl: "https://www.postgresql.org/docs/18/functions-event-triggers.html",
		description: "Returns the OID of the table about to be rewritten.",
		origin: "vendor-docs",
	},
	pg_event_trigger_table_rewrite_reason: {
		docUrl: "https://www.postgresql.org/docs/18/functions-event-triggers.html",
		description: "Returns a code explaining the reason(s) for rewriting.",
		origin: "vendor-docs",
	},
	pg_export_snapshot: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Saves the transaction's current snapshot and returns a text string identifying the snapshot.",
		origin: "vendor-docs",
	},
	pg_filenode_relation: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Returns a relation's OID given the tablespace OID and filenode it is stored under.",
		origin: "vendor-docs",
	},
	pg_function_is_visible: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Is function visible in search path?",
		origin: "vendor-docs",
	},
	pg_get_acl: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the ACL for a database object, specified by catalog OID, object OID and sub-object ID.",
		origin: "vendor-docs",
	},
	pg_get_catalog_foreign_keys: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns a set of records describing the foreign key relationships that exist within the PostgreSQL system catalogs.",
		origin: "vendor-docs",
	},
	pg_get_constraintdef: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Reconstructs the creating command for a constraint.",
		origin: "vendor-docs",
	},
	pg_get_expr: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Decompiles the internal form of an expression stored in the system catalogs, such as the default value for a column.",
		origin: "vendor-docs",
	},
	pg_get_function_arguments: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Reconstructs the argument list of a function or procedure, in the form it would need to appear in within CREATE FUNCTION (including default values).",
		origin: "vendor-docs",
	},
	pg_get_function_identity_arguments: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Reconstructs the argument list necessary to identify a function or procedure, in the form it would need to appear in within commands such as ALTER FUNCTION.",
		origin: "vendor-docs",
	},
	pg_get_function_result: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Reconstructs the RETURNS clause of a function, in the form it would need to appear in within CREATE FUNCTION.",
		origin: "vendor-docs",
	},
	pg_get_functiondef: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Reconstructs the creating command for a function or procedure.",
		origin: "vendor-docs",
	},
	pg_get_keywords: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns a set of records describing the SQL keywords recognized by the server.",
		origin: "vendor-docs",
	},
	pg_get_loaded_modules: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns a list of the loadable modules that are loaded into the current server session.",
		origin: "vendor-docs",
	},
	pg_get_multixact_members: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the transaction ID and lock mode for each member of the specified multixact ID.",
		origin: "vendor-docs",
	},
	pg_get_object_address: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns a row containing enough information to uniquely identify the database object specified by a type code and object name and argument arrays.",
		origin: "vendor-docs",
	},
	pg_get_partition_constraintdef: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Reconstructs the definition of a partition constraint.",
		origin: "vendor-docs",
	},
	pg_get_partkeydef: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Reconstructs the definition of a partitioned table's partition key, in the form it would have in the PARTITION BY clause of CREATE TABLE.",
		origin: "vendor-docs",
	},
	pg_get_ruledef: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Reconstructs the creating command for a rule.",
		origin: "vendor-docs",
	},
	pg_get_serial_sequence: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the name of the sequence associated with a column, or NULL if no sequence is associated with the column.",
		origin: "vendor-docs",
	},
	pg_get_statisticsobjdef: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Reconstructs the creating command for an extended statistics object.",
		origin: "vendor-docs",
	},
	pg_get_triggerdef: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Reconstructs the creating command for a trigger.",
		origin: "vendor-docs",
	},
	pg_get_userbyid: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns a role's name given its OID.",
		origin: "vendor-docs",
	},
	pg_get_viewdef: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Reconstructs the underlying SELECT command for a view or materialized view.",
		origin: "vendor-docs",
	},
	pg_get_wal_replay_pause_state: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Returns recovery pause state.",
		origin: "vendor-docs",
	},
	pg_get_wal_resource_managers: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Returns the currently-loaded WAL resource managers in the system.",
		origin: "vendor-docs",
	},
	pg_get_wal_summarizer_state: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns information about the progress of the WAL summarizer.",
		origin: "vendor-docs",
	},
	pg_identify_object: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns a row containing enough information to uniquely identify the database object specified by catalog OID, object OID and sub-object ID.",
		origin: "vendor-docs",
	},
	pg_identify_object_as_address: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns a row containing enough information to uniquely identify the database object specified by catalog OID, object OID and sub-object ID.",
		origin: "vendor-docs",
	},
	pg_import_system_collations: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Adds collations to the system catalog pg_collation based on all the locales it finds in the operating system.",
		origin: "vendor-docs",
	},
	pg_index_column_has_property: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Tests whether an index column has the named property.",
		origin: "vendor-docs",
	},
	pg_index_has_property: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Tests whether an index has the named property.",
		origin: "vendor-docs",
	},
	pg_indexam_has_property: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Tests whether an index access method has the named property.",
		origin: "vendor-docs",
	},
	pg_indexes_size: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Computes the total disk space used by indexes attached to the specified table.",
		origin: "vendor-docs",
	},
	pg_input_error_info: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Tests whether the given string is valid input for the specified data type; if not, return the details of the error that would have been thrown.",
		origin: "vendor-docs",
	},
	pg_input_is_valid: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Tests whether the given string is valid input for the specified data type, returning true or false.",
		origin: "vendor-docs",
	},
	pg_is_in_recovery: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Returns true if recovery is still in progress.",
		origin: "vendor-docs",
	},
	pg_is_other_temp_schema: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns true if the given OID is the OID of another session's temporary schema.",
		origin: "vendor-docs",
	},
	pg_is_wal_replay_paused: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Returns true if recovery pause is requested.",
		origin: "vendor-docs",
	},
	pg_jit_available: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns true if a JIT compiler extension is available (see ) and the configuration parameter is set to on.",
		origin: "vendor-docs",
	},
	pg_last_committed_xact: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the transaction ID, commit timestamp and replication origin of the latest committed transaction.",
		origin: "vendor-docs",
	},
	pg_last_wal_receive_lsn: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Returns the last write-ahead log location that has been received and synced to disk by streaming replication.",
		origin: "vendor-docs",
	},
	pg_last_wal_replay_lsn: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Returns the last write-ahead log location that has been replayed during recovery.",
		origin: "vendor-docs",
	},
	pg_last_xact_replay_timestamp: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Returns the time stamp of the last transaction replayed during recovery.",
		origin: "vendor-docs",
	},
	pg_listening_channels: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the set of names of asynchronous notification channels that the current session is listening to.",
		origin: "vendor-docs",
	},
	pg_log_backend_memory_contexts: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Requests to log the memory contexts of the backend with the specified process ID.",
		origin: "vendor-docs",
	},
	pg_log_standby_snapshot: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Take a snapshot of running transactions and write it to WAL, without having to wait for bgwriter or checkpointer to log one.",
		origin: "vendor-docs",
	},
	pg_logical_slot_get_binary_changes: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		origin: "vendor-docs",
	},
	pg_logical_slot_get_changes: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		origin: "vendor-docs",
	},
	pg_logical_slot_peek_binary_changes: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Behaves just like the pg_logical_slot_peek_changes() function, except that changes are returned as bytea.",
		origin: "vendor-docs",
	},
	pg_logical_slot_peek_changes: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		origin: "vendor-docs",
	},
	pg_ls_archive_statusdir: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Returns the name, size, and last modification time (mtime) of each ordinary file in the server's WAL archive status directory (pg_wal/archive_status).",
		origin: "vendor-docs",
	},
	pg_ls_logdir: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Returns the name, size, and last modification time (mtime) of each ordinary file in the server's log directory.",
		origin: "vendor-docs",
	},
	pg_ls_logicalmapdir: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Returns the name, size, and last modification time (mtime) of each ordinary file in the server's pg_logical/mappings directory.",
		origin: "vendor-docs",
	},
	pg_ls_logicalsnapdir: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Returns the name, size, and last modification time (mtime) of each ordinary file in the server's pg_logical/snapshots directory.",
		origin: "vendor-docs",
	},
	pg_ls_replslotdir: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Returns the name, size, and last modification time (mtime) of each ordinary file in the server's pg_replslot/slot_name directory, where slot_name is the name of the replication slot provided as input of the function.",
		origin: "vendor-docs",
	},
	pg_ls_summariesdir: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Returns the name, size, and last modification time (mtime) of each ordinary file in the server's WAL summaries directory (pg_wal/summaries).",
		origin: "vendor-docs",
	},
	pg_ls_tmpdir: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Returns the name, size, and last modification time (mtime) of each ordinary file in the temporary file directory for the specified tablespace.",
		origin: "vendor-docs",
	},
	pg_ls_waldir: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Returns the name, size, and last modification time (mtime) of each ordinary file in the server's write-ahead log (WAL) directory.",
		origin: "vendor-docs",
	},
	pg_mcv_list_items: {
		docUrl: "https://www.postgresql.org/docs/18/functions-statistics.html",
		origin: "vendor-docs",
	},
	pg_my_temp_schema: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the OID of the current session's temporary schema, or zero if it has none (because it has not created any temporary tables).",
		origin: "vendor-docs",
	},
	pg_notification_queue_usage: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the fraction (0&ndash;1) of the asynchronous notification queue's maximum size that is currently occupied by notifications that are waiting to be processed.",
		origin: "vendor-docs",
	},
	pg_numa_available: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns true if the server has been compiled with NUMA support.",
		origin: "vendor-docs",
	},
	pg_opclass_is_visible: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Is operator class visible in search path?",
		origin: "vendor-docs",
	},
	pg_operator_is_visible: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Is operator visible in search path?",
		origin: "vendor-docs",
	},
	pg_opfamily_is_visible: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Is operator family visible in search path?",
		origin: "vendor-docs",
	},
	pg_options_to_table: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the set of storage options represented by a value from pg_class.reloptions or pg_attribute.attoptions.",
		origin: "vendor-docs",
	},
	pg_partition_ancestors: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Lists the ancestor relations of the given partition, including the relation itself.",
		origin: "vendor-docs",
	},
	pg_partition_root: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Returns the top-most parent of the partition tree to which the given relation belongs.",
		origin: "vendor-docs",
	},
	pg_partition_tree: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Lists the tables or indexes in the partition tree of the given partitioned table or partitioned index, with one row for each partition.",
		origin: "vendor-docs",
	},
	pg_postmaster_start_time: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the time when the server started.",
		origin: "vendor-docs",
	},
	pg_relation_filenode: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Returns the filenode number currently assigned to the specified relation.",
		origin: "vendor-docs",
	},
	pg_relation_filepath: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Returns the entire file path name (relative to the database cluster's data directory, PGDATA) of the relation.",
		origin: "vendor-docs",
	},
	pg_relation_size: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Computes the disk space used by one fork of the specified relation.",
		origin: "vendor-docs",
	},
	pg_reload_conf: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Causes all processes of the PostgreSQL server to reload their configuration files.",
		origin: "vendor-docs",
	},
	pg_replication_origin_advance: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		origin: "vendor-docs",
	},
	pg_replication_origin_create: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		origin: "vendor-docs",
	},
	pg_replication_origin_drop: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		origin: "vendor-docs",
	},
	pg_replication_origin_oid: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Looks up a replication origin by name and returns the internal ID.",
		origin: "vendor-docs",
	},
	pg_replication_origin_progress: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		origin: "vendor-docs",
	},
	pg_replication_origin_session_is_setup: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Returns true if a replication origin has been selected in the current session.",
		origin: "vendor-docs",
	},
	pg_replication_origin_session_progress: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		origin: "vendor-docs",
	},
	pg_replication_origin_session_reset: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Cancels the effects of pg_replication_origin_session_setup().",
		origin: "vendor-docs",
	},
	pg_replication_origin_session_setup: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		origin: "vendor-docs",
	},
	pg_replication_origin_xact_reset: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		origin: "vendor-docs",
	},
	pg_replication_origin_xact_setup: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		origin: "vendor-docs",
	},
	pg_replication_slot_advance: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		origin: "vendor-docs",
	},
	pg_restore_attribute_stats: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Creates or updates column-level statistics.",
		origin: "vendor-docs",
	},
	pg_restore_relation_stats: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Updates table-level statistics.",
		origin: "vendor-docs",
	},
	pg_rotate_logfile: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Signals the log-file manager to switch to a new output file immediately.",
		origin: "vendor-docs",
	},
	pg_safe_snapshot_blocking_pids: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns an array of the process ID(s) of the sessions that are blocking the server process with the specified process ID from acquiring a safe snapshot, or an empty array if there is no such server process or it is not blocked.",
		origin: "vendor-docs",
	},
	pg_settings_get_flags: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns an array of the flags associated with the given GUC, or NULL if it does not exist.",
		origin: "vendor-docs",
	},
	pg_size_bytes: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Converts a size in human-readable format (as returned by pg_size_pretty) into bytes.",
		origin: "vendor-docs",
	},
	pg_size_pretty: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Converts a size in bytes into a more easily human-readable format with size units (bytes, kB, MB, GB, TB, or PB as appropriate).",
		origin: "vendor-docs",
	},
	pg_snapshot_xip: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the set of in-progress transaction IDs contained in a snapshot.",
		origin: "vendor-docs",
	},
	pg_snapshot_xmax: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the xmax of a snapshot.",
		origin: "vendor-docs",
	},
	pg_snapshot_xmin: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the xmin of a snapshot.",
		origin: "vendor-docs",
	},
	pg_split_walfile_name: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Extracts the sequence number and timeline ID from a WAL file name.",
		origin: "vendor-docs",
	},
	pg_stat_file: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Returns a record containing the file's size, last access time stamp, last modification time stamp, last file status change time stamp (Unix platforms only), file creation time stamp (Windows only), and a flag indicating if it is a directory.",
		origin: "vendor-docs",
	},
	pg_statistics_obj_is_visible: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Is statistics object visible in search path?",
		origin: "vendor-docs",
	},
	pg_switch_wal: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Forces the server to switch to a new write-ahead log file, which allows the current file to be archived (assuming you are using continuous archiving).",
		origin: "vendor-docs",
	},
	pg_sync_replication_slots: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		origin: "vendor-docs",
	},
	pg_table_is_visible: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Is table visible in search path?",
		origin: "vendor-docs",
	},
	pg_table_size: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description:
			"Computes the disk space used by the specified table, excluding indexes (but including its TOAST table if any, free space map, and visibility map).",
		origin: "vendor-docs",
	},
	pg_tablespace_databases: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the set of OIDs of databases that have objects stored in the specified tablespace.",
		origin: "vendor-docs",
	},
	pg_tablespace_location: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the file system path that this tablespace is located in.",
		origin: "vendor-docs",
	},
	pg_tablespace_size: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Computes the total disk space used in the tablespace with the specified name or OID.",
		origin: "vendor-docs",
	},
	pg_total_relation_size: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Computes the total disk space used by the specified table, including all indexes and TOAST data.",
		origin: "vendor-docs",
	},
	pg_trigger_depth: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the current nesting level of PostgreSQL triggers (0 if not called, directly or indirectly, from inside a trigger).",
		origin: "vendor-docs",
	},
	pg_try_advisory_lock: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Obtains an exclusive session-level advisory lock if available.",
		origin: "vendor-docs",
	},
	pg_try_advisory_lock_shared: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Obtains a shared session-level advisory lock if available.",
		origin: "vendor-docs",
	},
	pg_try_advisory_xact_lock: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Obtains an exclusive transaction-level advisory lock if available.",
		origin: "vendor-docs",
	},
	pg_try_advisory_xact_lock_shared: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Obtains a shared transaction-level advisory lock if available.",
		origin: "vendor-docs",
	},
	pg_ts_config_is_visible: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Is text search configuration visible in search path?",
		origin: "vendor-docs",
	},
	pg_ts_dict_is_visible: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Is text search dictionary visible in search path?",
		origin: "vendor-docs",
	},
	pg_ts_parser_is_visible: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Is text search parser visible in search path?",
		origin: "vendor-docs",
	},
	pg_ts_template_is_visible: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Is text search template visible in search path?",
		origin: "vendor-docs",
	},
	pg_type_is_visible: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Is type (or domain) visible in search path?",
		origin: "vendor-docs",
	},
	pg_typeof: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the OID of the data type of the value that is passed to it.",
		origin: "vendor-docs",
	},
	pg_visible_in_snapshot: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Is the given transaction ID visible according to this snapshot (that is, was it completed before the snapshot was taken)?",
		origin: "vendor-docs",
	},
	pg_wal_lsn_diff: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Calculates the difference in bytes (lsn1 - lsn2) between two write-ahead log locations.",
		origin: "vendor-docs",
	},
	pg_wal_replay_pause: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Request to pause recovery.",
		origin: "vendor-docs",
	},
	pg_wal_replay_resume: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Restarts recovery if it was paused.",
		origin: "vendor-docs",
	},
	pg_wal_summary_contents: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns one information about the contents of a single WAL summary file identified by TLI and starting and ending LSNs.",
		origin: "vendor-docs",
	},
	pg_walfile_name: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Converts a write-ahead log location to the name of the WAL file holding that location.",
		origin: "vendor-docs",
	},
	pg_walfile_name_offset: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Converts a write-ahead log location to a WAL file name and byte offset within that file.",
		origin: "vendor-docs",
	},
	pg_xact_commit_timestamp: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the commit timestamp of a transaction.",
		origin: "vendor-docs",
	},
	pg_xact_commit_timestamp_origin: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the commit timestamp and replication origin of a transaction.",
		origin: "vendor-docs",
	},
	pg_xact_status: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Reports the commit status of a recent transaction.",
		origin: "vendor-docs",
	},
	pi: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Approximate value of &pi;",
		origin: "vendor-docs",
	},
	point: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Constructs point from its coordinates.",
		origin: "vendor-docs",
	},
	polygon: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Converts box to a 4-point polygon.",
		origin: "vendor-docs",
	},
	popen: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Converts path to open form.",
		origin: "vendor-docs",
	},
	position: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Returns first starting index of the specified substring within string, or zero if it's not present.",
		origin: "vendor-docs",
	},
	power: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "a raised to the power of b",
		origin: "vendor-docs",
	},
	querytree: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description: "Produces a representation of the indexable portion of a tsquery.",
		origin: "vendor-docs",
	},
	quote_ident: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Returns the given string suitably quoted to be used as an identifier in an SQL statement string.",
		origin: "vendor-docs",
	},
	quote_literal: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Returns the given string suitably quoted to be used as a string literal in an SQL statement string.",
		origin: "vendor-docs",
	},
	quote_nullable: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Returns the given string suitably quoted to be used as a string literal in an SQL statement string; or, if the argument is null, returns NULL.",
		origin: "vendor-docs",
	},
	radians: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Converts degrees to radians",
		origin: "vendor-docs",
	},
	radius: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Computes radius of circle.",
		origin: "vendor-docs",
	},
	random: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Returns a random value in the range 0.0 <= x < 1.0",
		origin: "vendor-docs",
	},
	random_normal: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description:
			"Returns a random value from the normal distribution with the given parameters; mean defaults to 0.0 and stddev defaults to 1.0",
		origin: "vendor-docs",
	},
	range_agg: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the union of the non-null input values.",
		origin: "vendor-docs",
	},
	range_intersect_agg: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the intersection of the non-null input values.",
		origin: "vendor-docs",
	},
	range_merge: {
		docUrl: "https://www.postgresql.org/docs/18/functions-range.html",
		description: "Computes the smallest range that includes both of the given ranges.",
		origin: "vendor-docs",
	},
	rank: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description:
			"Computes the rank of the hypothetical row, with gaps; that is, the row number of the first row in its peer group.",
		origin: "vendor-docs",
	},
	regexp_count: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Returns the number of times the POSIX regular expression pattern matches in the string; see .",
		origin: "vendor-docs",
	},
	regexp_instr: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Returns the position within string where the N'th match of the POSIX regular expression pattern occurs, or zero if there is no such match; see .",
		origin: "vendor-docs",
	},
	regexp_like: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Checks whether a match of the POSIX regular expression pattern occurs within string; see .",
		origin: "vendor-docs",
	},
	regexp_match: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Returns substrings within the first match of the POSIX regular expression pattern to the string; see .",
		origin: "vendor-docs",
	},
	regexp_matches: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Returns substrings within the first match of the POSIX regular expression pattern to the string, or substrings within all such matches if the g flag is used; see .",
		origin: "vendor-docs",
	},
	regexp_replace: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Replaces the substring that is the first match to the POSIX regular expression pattern, or all such matches if the g flag is used; see .",
		origin: "vendor-docs",
	},
	regexp_split_to_array: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Splits string using a POSIX regular expression as the delimiter, producing an array of results; see .",
		origin: "vendor-docs",
	},
	regexp_split_to_table: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Splits string using a POSIX regular expression as the delimiter, producing a set of results; see .",
		origin: "vendor-docs",
	},
	regexp_substr: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Returns the substring within string that matches the N'th occurrence of the POSIX regular expression pattern, or NULL if there is no such match; see .",
		origin: "vendor-docs",
	},
	regr_avgx: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the average of the independent variable, sum(X)/N.",
		origin: "vendor-docs",
	},
	regr_avgy: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the average of the dependent variable, sum(Y)/N.",
		origin: "vendor-docs",
	},
	regr_count: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the number of rows in which both inputs are non-null.",
		origin: "vendor-docs",
	},
	regr_intercept: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description:
			"Computes the y-intercept of the least-squares-fit linear equation determined by the (X, Y) pairs.",
		origin: "vendor-docs",
	},
	regr_r2: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the square of the correlation coefficient.",
		origin: "vendor-docs",
	},
	regr_slope: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the slope of the least-squares-fit linear equation determined by the (X, Y) pairs.",
		origin: "vendor-docs",
	},
	regr_sxx: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the sum of squares of the independent variable, sum(X^2) - sum(X)^2/N.",
		origin: "vendor-docs",
	},
	regr_sxy: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description:
			"Computes the sum of products of independent times dependent variables, sum(X*Y) - sum(X) * sum(Y)/N.",
		origin: "vendor-docs",
	},
	regr_syy: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the sum of squares of the dependent variable, sum(Y^2) - sum(Y)^2/N.",
		origin: "vendor-docs",
	},
	repeat: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Repeats string the specified number of times.",
		origin: "vendor-docs",
	},
	replace: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Replaces all occurrences in string of substring from with substring to.",
		origin: "vendor-docs",
	},
	reverse: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Reverses the order of the characters in the string.",
		origin: "vendor-docs",
	},
	right: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Returns last n characters in the string, or when n is negative, returns all but first |n| characters.",
		origin: "vendor-docs",
	},
	round: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Rounds to nearest integer.",
		origin: "vendor-docs",
	},
	row_number: {
		docUrl: "https://www.postgresql.org/docs/18/functions-window.html",
		description: "Returns the number of the current row within its partition, counting from 1.",
		origin: "vendor-docs",
	},
	row_to_json: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Converts an SQL composite value to a JSON object.",
		origin: "vendor-docs",
	},
	rpad: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Extends the string to length length by appending the characters fill (a space by default).",
		origin: "vendor-docs",
	},
	rtrim: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Removes the longest string containing only characters in characters (a space by default) from the end of string.",
		origin: "vendor-docs",
	},
	scale: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Scale of the argument (the number of decimal digits in the fractional part)",
		origin: "vendor-docs",
	},
	session_user: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns the session user's name.",
		origin: "vendor-docs",
	},
	set_bit: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description: "Sets n'th bit in binary string to newvalue.",
		origin: "vendor-docs",
	},
	set_byte: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description: "Sets n'th byte in binary string to newvalue.",
		origin: "vendor-docs",
	},
	set_config: {
		docUrl: "https://www.postgresql.org/docs/18/functions-admin.html",
		description: "Sets the parameter setting_name to new_value, and returns that value.",
		origin: "vendor-docs",
	},
	set_masklen: {
		docUrl: "https://www.postgresql.org/docs/18/functions-net.html",
		description: "Sets the netmask length for an inet value.",
		origin: "vendor-docs",
	},
	setseed: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description:
			"Sets the seed for subsequent random() and random_normal() calls; argument must be between -1.0 and 1.0, inclusive",
		origin: "vendor-docs",
	},
	setval: {
		docUrl: "https://www.postgresql.org/docs/18/functions-sequence.html",
		description: "Sets the sequence object's current value, and optionally its is_called flag.",
		origin: "vendor-docs",
	},
	setweight: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description: "Assigns the specified weight to each element of the vector.",
		origin: "vendor-docs",
	},
	sha224: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description: "Computes the SHA-224 hash of the binary string.",
		origin: "vendor-docs",
	},
	sha256: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description: "Computes the SHA-256 hash of the binary string.",
		origin: "vendor-docs",
	},
	sha384: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description: "Computes the SHA-384 hash of the binary string.",
		origin: "vendor-docs",
	},
	sha512: {
		docUrl: "https://www.postgresql.org/docs/18/functions-binarystring.html",
		description: "Computes the SHA-512 hash of the binary string.",
		origin: "vendor-docs",
	},
	shobj_description: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the comment for a shared database object specified by its OID and the name of the containing system catalog.",
		origin: "vendor-docs",
	},
	sign: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Sign of the argument (-1, 0, or +1)",
		origin: "vendor-docs",
	},
	sin: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Sine, argument in radians",
		origin: "vendor-docs",
	},
	sind: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Sine, argument in degrees",
		origin: "vendor-docs",
	},
	sinh: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Hyperbolic sine",
		origin: "vendor-docs",
	},
	slope: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Computes slope of a line drawn through the two points.",
		origin: "vendor-docs",
	},
	split_part: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Splits string at occurrences of delimiter and returns the n'th field (counting from one), or when n is negative, returns the |n|'th-from-last field.",
		origin: "vendor-docs",
	},
	sqrt: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Square root",
		origin: "vendor-docs",
	},
	starts_with: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Returns true if string starts with prefix.",
		origin: "vendor-docs",
	},
	statement_timestamp: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Current date and time (start of current statement); see",
		origin: "vendor-docs",
	},
	stddev: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "This is a historical alias for stddev_samp.",
		origin: "vendor-docs",
	},
	stddev_pop: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the population standard deviation of the input values.",
		origin: "vendor-docs",
	},
	stddev_samp: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the sample standard deviation of the input values.",
		origin: "vendor-docs",
	},
	string_agg: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Concatenates the non-null input values into a string.",
		origin: "vendor-docs",
	},
	string_to_array: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Splits the string at occurrences of delimiter and forms the resulting fields into a text array.",
		origin: "vendor-docs",
	},
	string_to_table: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Splits the string at occurrences of delimiter and returns the resulting fields as a set of text rows.",
		origin: "vendor-docs",
	},
	strip: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description: "Removes positions and weights from the tsvector.",
		origin: "vendor-docs",
	},
	strpos: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Returns first starting index of the specified substring within string, or zero if it's not present.",
		origin: "vendor-docs",
	},
	substr: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Extracts the substring of string starting at the start'th character, and extending for count characters if that is specified.",
		origin: "vendor-docs",
	},
	substring: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Extracts the substring of string starting at the start'th character if that is specified, and stopping after count characters if that is specified.",
		origin: "vendor-docs",
	},
	sum: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the sum of the non-null input values.",
		origin: "vendor-docs",
	},
	suppress_redundant_updates_trigger: {
		docUrl: "https://www.postgresql.org/docs/18/functions-trigger.html",
		description: "Suppresses do-nothing update operations.",
		origin: "vendor-docs",
	},
	system_user: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Returns the authentication method and the identity (if any) that the user presented during the authentication cycle before they were assigned a database role.",
		origin: "vendor-docs",
	},
	tan: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Tangent, argument in radians",
		origin: "vendor-docs",
	},
	tand: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Tangent, argument in degrees",
		origin: "vendor-docs",
	},
	tanh: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Hyperbolic tangent",
		origin: "vendor-docs",
	},
	text: {
		docUrl: "https://www.postgresql.org/docs/18/functions-net.html",
		description: "Returns the unabbreviated IP address and netmask length as text.",
		origin: "vendor-docs",
	},
	timeofday: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Current date and time (like clock_timestamp, but as a text string); see",
		origin: "vendor-docs",
	},
	to_ascii: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Converts string to ASCII from another encoding, which may be identified by name or number.",
		origin: "vendor-docs",
	},
	to_bin: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Converts the number to its equivalent two's complement binary representation.",
		origin: "vendor-docs",
	},
	to_char: {
		docUrl: "https://www.postgresql.org/docs/18/functions-formatting.html",
		description: "Converts time stamp to string according to the given format.",
		origin: "vendor-docs",
	},
	to_date: {
		docUrl: "https://www.postgresql.org/docs/18/functions-formatting.html",
		description: "Converts string to date according to the given format.",
		origin: "vendor-docs",
	},
	to_hex: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Converts the number to its equivalent two's complement hexadecimal representation.",
		origin: "vendor-docs",
	},
	to_json: {
		docUrl: "https://www.postgresql.org/docs/18/functions-json.html",
		description: "Converts any SQL value to json or jsonb.",
		origin: "vendor-docs",
	},
	to_jsonb: { docUrl: "https://www.postgresql.org/docs/18/functions-json.html", origin: "vendor-docs" },
	to_number: {
		docUrl: "https://www.postgresql.org/docs/18/functions-formatting.html",
		description: "Converts string to numeric according to the given format.",
		origin: "vendor-docs",
	},
	to_oct: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Converts the number to its equivalent two's complement octal representation.",
		origin: "vendor-docs",
	},
	to_regclass: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Translates a textual relation name to its OID.",
		origin: "vendor-docs",
	},
	to_regcollation: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Translates a textual collation name to its OID.",
		origin: "vendor-docs",
	},
	to_regnamespace: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Translates a textual schema name to its OID.",
		origin: "vendor-docs",
	},
	to_regoper: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Translates a textual operator name to its OID.",
		origin: "vendor-docs",
	},
	to_regoperator: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Translates a textual operator name (with parameter types) to its OID.",
		origin: "vendor-docs",
	},
	to_regproc: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Translates a textual function or procedure name to its OID.",
		origin: "vendor-docs",
	},
	to_regprocedure: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Translates a textual function or procedure name (with argument types) to its OID.",
		origin: "vendor-docs",
	},
	to_regrole: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Translates a textual role name to its OID.",
		origin: "vendor-docs",
	},
	to_regtype: { docUrl: "https://www.postgresql.org/docs/18/functions-info.html", origin: "vendor-docs" },
	to_regtypemod: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description:
			"Parses a string of text, extracts a potential type name from it, and translates its type modifier, if any.",
		origin: "vendor-docs",
	},
	to_timestamp: {
		docUrl: "https://www.postgresql.org/docs/18/functions-formatting.html",
		description: "Converts string to time stamp according to the given format.",
		origin: "vendor-docs",
	},
	transaction_timestamp: {
		docUrl: "https://www.postgresql.org/docs/18/functions-datetime.html",
		description: "Current date and time (start of current transaction); see",
		origin: "vendor-docs",
	},
	translate: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description:
			"Replaces each character in string that matches a character in the from set with the corresponding character in the to set.",
		origin: "vendor-docs",
	},
	trim_array: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Trims an array by removing the last n elements.",
		origin: "vendor-docs",
	},
	trim_scale: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Reduces the value's scale (number of fractional decimal digits) by removing trailing zeroes",
		origin: "vendor-docs",
	},
	trunc: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description: "Truncates to integer (towards zero)",
		origin: "vendor-docs",
	},
	ts_delete: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description: "Removes any occurrence of the given lexeme from the vector.",
		origin: "vendor-docs",
	},
	ts_filter: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description: "Selects only elements with the given weights from the vector.",
		origin: "vendor-docs",
	},
	ts_lexize: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description:
			"Returns an array of replacement lexemes if the input token is known to the dictionary, or an empty array if the token is known to the dictionary but it is a stop word, or NULL if it is not a known word.",
		origin: "vendor-docs",
	},
	ts_parse: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description: "Extracts tokens from the document using the named parser.",
		origin: "vendor-docs",
	},
	ts_rewrite: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description: "Replaces occurrences of target with substitute within the query.",
		origin: "vendor-docs",
	},
	ts_stat: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description:
			"Executes the sqlquery, which must return a single tsvector column, and returns statistics about each distinct lexeme contained in the data.",
		origin: "vendor-docs",
	},
	ts_token_type: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description: "Returns a table that describes each type of token the named parser can recognize.",
		origin: "vendor-docs",
	},
	tsquery_phrase: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description:
			"Constructs a phrase query that searches for matches of query1 and query2 at successive lexemes (same as <-> operator).",
		origin: "vendor-docs",
	},
	tsvector_to_array: {
		docUrl: "https://www.postgresql.org/docs/18/functions-textsearch.html",
		description: "Converts a tsvector to an array of lexemes.",
		origin: "vendor-docs",
	},
	tsvector_update_trigger: {
		docUrl: "https://www.postgresql.org/docs/18/functions-trigger.html",
		description: "Automatically updates a tsvector column from associated plain-text document column(s).",
		origin: "vendor-docs",
	},
	tsvector_update_trigger_column: {
		docUrl: "https://www.postgresql.org/docs/18/functions-trigger.html",
		description: "Automatically updates a tsvector column from associated plain-text document column(s).",
		origin: "vendor-docs",
	},
	txid_current: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "See pg_current_xact_id().",
		origin: "vendor-docs",
	},
	txid_current_if_assigned: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "See pg_current_xact_id_if_assigned().",
		origin: "vendor-docs",
	},
	txid_current_snapshot: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "See pg_current_snapshot().",
		origin: "vendor-docs",
	},
	txid_snapshot_xip: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "See pg_snapshot_xip().",
		origin: "vendor-docs",
	},
	txid_snapshot_xmax: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "See pg_snapshot_xmax().",
		origin: "vendor-docs",
	},
	txid_snapshot_xmin: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "See pg_snapshot_xmin().",
		origin: "vendor-docs",
	},
	txid_status: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "See pg_xact_status().",
		origin: "vendor-docs",
	},
	txid_visible_in_snapshot: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "See pg_visible_in_snapshot().",
		origin: "vendor-docs",
	},
	unicode_assigned: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Returns true if all characters in the string are assigned Unicode codepoints; false otherwise.",
		origin: "vendor-docs",
	},
	unicode_version: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns a string representing the version of Unicode used by PostgreSQL.",
		origin: "vendor-docs",
	},
	unistr: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Evaluate escaped Unicode characters in the argument.",
		origin: "vendor-docs",
	},
	unnest: {
		docUrl: "https://www.postgresql.org/docs/18/functions-array.html",
		description: "Expands a tsvector into a set of rows, one per lexeme.",
		origin: "vendor-docs",
	},
	upper: {
		docUrl: "https://www.postgresql.org/docs/18/functions-string.html",
		description: "Converts the string to all upper case, according to the rules of the database's locale.",
		origin: "vendor-docs",
	},
	upper_inc: {
		docUrl: "https://www.postgresql.org/docs/18/functions-range.html",
		description: "Is the range's upper bound inclusive?",
		origin: "vendor-docs",
	},
	upper_inf: {
		docUrl: "https://www.postgresql.org/docs/18/functions-range.html",
		description: "Does the range have no upper bound?",
		origin: "vendor-docs",
	},
	user: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "This is equivalent to current_user.",
		origin: "vendor-docs",
	},
	uuid_extract_timestamp: {
		docUrl: "https://www.postgresql.org/docs/18/functions-uuid.html",
		description: "Extracts a timestamp with time zone from a UUID of version 1 or 7.",
		origin: "vendor-docs",
	},
	uuid_extract_version: {
		docUrl: "https://www.postgresql.org/docs/18/functions-uuid.html",
		description: "Extracts the version from a UUID of one of the variants described by RFC 9562.",
		origin: "vendor-docs",
	},
	uuidv4: { docUrl: "https://www.postgresql.org/docs/18/functions-uuid.html", origin: "vendor-docs" },
	uuidv7: {
		docUrl: "https://www.postgresql.org/docs/18/functions-uuid.html",
		description: "Generates a version 7 (time-ordered) UUID.",
		origin: "vendor-docs",
	},
	var_pop: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description:
			"Computes the population variance of the input values (square of the population standard deviation).",
		origin: "vendor-docs",
	},
	var_samp: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "Computes the sample variance of the input values (square of the sample standard deviation).",
		origin: "vendor-docs",
	},
	variance: {
		docUrl: "https://www.postgresql.org/docs/18/functions-aggregate.html",
		description: "This is a historical alias for var_samp.",
		origin: "vendor-docs",
	},
	version: {
		docUrl: "https://www.postgresql.org/docs/18/functions-info.html",
		description: "Returns a string describing the PostgreSQL server's version.",
		origin: "vendor-docs",
	},
	width: {
		docUrl: "https://www.postgresql.org/docs/18/functions-geometry.html",
		description: "Computes horizontal size of box.",
		origin: "vendor-docs",
	},
	width_bucket: {
		docUrl: "https://www.postgresql.org/docs/18/functions-math.html",
		description:
			"Returns the number of the bucket in which operand falls in a histogram having count equal-width buckets spanning the range low to high.",
		origin: "vendor-docs",
	},
	xmlagg: {
		docUrl: "https://www.postgresql.org/docs/18/functions-xml.html",
		description: "Concatenates the non-null XML input values (see ).",
		origin: "vendor-docs",
	},
	xmlcomment: { docUrl: "https://www.postgresql.org/docs/18/functions-xml.html", origin: "vendor-docs" },
	xmlconcat: { docUrl: "https://www.postgresql.org/docs/18/functions-xml.html", origin: "vendor-docs" },
	xmltext: { docUrl: "https://www.postgresql.org/docs/18/functions-xml.html", origin: "vendor-docs" },
	xpath: { docUrl: "https://www.postgresql.org/docs/18/functions-xml.html", origin: "vendor-docs" },
	xpath_exists: { docUrl: "https://www.postgresql.org/docs/18/functions-xml.html", origin: "vendor-docs" },
};
