// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for redshift (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-15. 307 names (266 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const REDSHIFT_FN_DOCS: Record<string, FnDoc> = {
	abs: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ABS.html",
		description: "Returns the absolute value of a numeric expression.",
		origin: "authored",
	},
	acos: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ACOS.html",
		description: "Returns the arc cosine (inverse cosine) of a numeric argument in radians.",
		origin: "authored",
	},
	addbbox: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/AddBBox-function.html", origin: "vendor-docs" },
	any_value: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ANY_VALUE.html", origin: "vendor-docs" },
	array: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_array.html",
		description: "Constructs an array from the given expressions.",
		origin: "authored",
	},
	array_concat: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_array_concat.html",
		description: "Concatenates two arrays into a single array.",
		origin: "authored",
	},
	array_contains: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/array_contains.html",
		description: "Returns true if the array contains the specified value.",
		origin: "authored",
	},
	array_distinct: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/array_distinct.html",
		description: "Returns an array with duplicate elements removed.",
		origin: "authored",
	},
	array_flatten: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/array_flatten.html",
		description: "Flattens a nested array structure into a single-level array.",
		origin: "authored",
	},
	array_position: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/array_position.html",
		description: "Returns the position of the first occurrence of a value in the array.",
		origin: "authored",
	},
	array_positions: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/array_positions.html",
		description: "Returns an array of all positions where the specified value occurs in the input array.",
		origin: "authored",
	},
	array_sort: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/array_sort.html",
		description: "Sorts array elements in ascending or descending order, with optional null handling.",
		origin: "authored",
	},
	array_union: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/array_union.html",
		description: "Returns the union of two arrays, combining all unique elements.",
		origin: "authored",
	},
	arrays_overlap: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/arrays_overlap.html",
		description: "Returns true if the two arrays have any common elements.",
		origin: "authored",
	},
	ascii: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ASCII.html",
		description: "Returns the ASCII numeric code value of the first character in a string.",
		origin: "authored",
	},
	asin: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ASIN.html",
		description: "Returns the arc sine (inverse sine) of a numeric argument in radians.",
		origin: "authored",
	},
	atan: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ATAN.html",
		description: "Returns the arc tangent (inverse tangent) of a numeric argument in radians.",
		origin: "authored",
	},
	atan2: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ATAN2.html",
		description: "Returns the arc tangent of two arguments as a single angle in radians.",
		origin: "authored",
	},
	avg: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_AVG.html",
		description: "Calculates the average value of a numeric expression across rows.",
		origin: "authored",
	},
	bit_and: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_BIT_AND.html",
		description: "Performs bitwise AND operation across values in an aggregation.",
		origin: "authored",
	},
	bit_or: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_BIT_OR.html",
		description: "Performs bitwise OR operation across values in an aggregation.",
		origin: "authored",
	},
	bool_and: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_BOOL_AND.html",
		description: "Returns true if all input boolean values are true in an aggregation.",
		origin: "authored",
	},
	bool_or: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_BOOL_OR.html",
		description: "Returns true if any input boolean value is true in an aggregation.",
		origin: "authored",
	},
	bpcharcmp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_BPCHARCMP.html",
		description: "Compares two blank-padded character strings and returns -1, 0, or 1 based on comparison result.",
		origin: "authored",
	},
	btrim: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_BTRIM.html",
		description: "Removes leading and trailing characters (spaces by default) from a string.",
		origin: "authored",
	},
	cbrt: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CBRT.html",
		description: "Returns the cube root of a numeric value.",
		origin: "authored",
	},
	ceiling: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CEILING_FLOOR.html",
		description: "Rounds a numeric value up to the nearest integer.",
		origin: "authored",
	},
	change_query_priority: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CHANGE_QUERY_PRIORITY.html",
		origin: "vendor-docs",
	},
	change_session_priority: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CHANGE_SESSION_PRIORITY.html",
		description: "Changes the Workload Management priority level for a session.",
		origin: "authored",
	},
	change_user_priority: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CHANGE_USER_PRIORITY.html",
		description: "Changes the Workload Management priority level for all queries from a specific user.",
		origin: "authored",
	},
	charindex: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CHARINDEX.html",
		description: "Returns the position of the first occurrence of a substring within a string.",
		origin: "authored",
	},
	checksum: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CHECKSUM.html", origin: "vendor-docs" },
	chr: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CHR.html",
		description: "Returns the character corresponding to the ASCII numeric code value.",
		origin: "authored",
	},
	coalesce: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_NVL_function.html",
		description: "Returns the first non-null expression from a list of expressions.",
		origin: "authored",
	},
	concat: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CONCAT.html", origin: "vendor-docs" },
	convert: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CONVERT_function.html",
		description: "Converts an expression to a different data type.",
		origin: "authored",
	},
	cos: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_COS.html",
		description: "Returns the cosine of a numeric argument in radians.",
		origin: "authored",
	},
	cot: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_COT.html",
		description: "Returns the cotangent of a numeric argument in radians.",
		origin: "authored",
	},
	count: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_COUNT.html",
		description: "Counts the number of rows or non-null values in a result set.",
		origin: "authored",
	},
	crc32: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/crc32-function.html",
		description: "Computes the CRC32 checksum hash value of a string.",
		origin: "authored",
	},
	cume_dist: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_WF_CUME_DIST.html",
		description: "Returns the cumulative distribution of a value within an ordered group of values.",
		origin: "authored",
	},
	current_database: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CURRENT_DATABASE.html",
		description: "Returns the name of the current database.",
		origin: "authored",
	},
	current_schema: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CURRENT_SCHEMA.html",
		description: "Returns the current schema name from the search path.",
		origin: "authored",
	},
	current_schemas: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CURRENT_SCHEMAS.html",
		description: "Returns an array of schema names currently in the search path.",
		origin: "authored",
	},
	current_session_arn: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CURRENT_SESSION_ARN.html",
		origin: "vendor-docs",
	},
	current_setting: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_CURRENT_SETTING.html",
		description: "Returns the current value of a database configuration parameter.",
		origin: "authored",
	},
	date_cmp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DATE_CMP.html",
		description: "Compares two dates and returns an integer indicating their relationship.",
		origin: "authored",
	},
	date_cmp_timestamp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DATE_CMP_TIMESTAMP.html",
		description: "Compares a date with a timestamp and returns an ordering value.",
		origin: "authored",
	},
	date_cmp_timestamptz: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DATE_CMP_TIMESTAMPTZ.html",
		description: "Compares a date with a timestamp having timezone information.",
		origin: "authored",
	},
	date_part: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DATE_PART_function.html",
		description: "Extracts a specific component (year, month, day, hour, etc.) from a timestamp.",
		origin: "authored",
	},
	date_part_year: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DATE_PART_YEAR.html",
		description: "Extracts the year component from a date value.",
		origin: "authored",
	},
	date_trunc: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DATE_TRUNC.html",
		description: "Truncates a timestamp to the specified precision level.",
		origin: "authored",
	},
	dateadd: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DATEADD_function.html",
		description: "Adds a specified interval to a date, returning the new date.",
		origin: "authored",
	},
	datediff: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DATEDIFF_function.html",
		description: "Calculates the difference between two dates in the specified datepart units.",
		origin: "authored",
	},
	db_collation: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DB_COLLATION.html",
		description: "Returns the collation specification of the current database.",
		origin: "authored",
	},
	decimal_precision: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_decimal_precision.html",
		description: "Returns the precision (total number of digits) of a numeric SUPER value.",
		origin: "authored",
	},
	decimal_scale: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_decimal_scale.html",
		description: "Returns the scale (digits after decimal point) of a numeric SUPER value.",
		origin: "authored",
	},
	decode: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DECODE_expression.html",
		description: "Returns result values based on comparisons, acting as a conditional expression.",
		origin: "authored",
	},
	degrees: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DEGREES.html",
		description: "Converts an angle from radians to degrees.",
		origin: "authored",
	},
	dexp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DEXP.html",
		description: "Returns e raised to the power of the argument.",
		origin: "authored",
	},
	difference: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/DIFFERENCE.html",
		description: "Returns the difference between Soundex codes of two strings as an integer.",
		origin: "authored",
	},
	dlog10: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_DLOG10.html",
		description: "Returns the base-10 logarithm of the argument.",
		origin: "authored",
	},
	dropbbox: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/DropBBox-function.html",
		origin: "vendor-docs",
	},
	exp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_EXP.html",
		description: "Returns e raised to the power of the argument.",
		origin: "authored",
	},
	farmfingerprint64: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_FARMFINGERPRINT64.html",
		description: "Computes a 64-bit FarmHash fingerprint of the input value.",
		origin: "authored",
	},
	floor: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_FLOOR.html",
		description: "Returns the largest integer value less than or equal to the argument.",
		origin: "authored",
	},
	fnv_hash: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_FNV_HASH.html",
		description: "Computes an FNV-1a hash of the input value with an optional seed.",
		origin: "authored",
	},
	from_hex: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_FROM_HEX.html",
		description: "Converts a hexadecimal string to its binary representation.",
		origin: "authored",
	},
	from_varbyte: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_FROM_VARBYTE.html",
		origin: "vendor-docs",
	},
	geometrytype: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/GeometryType-function.html",
		origin: "vendor-docs",
	},
	get_array_length: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/get_array_length.html",
		description: "Returns the number of elements in an array within a SUPER value.",
		origin: "authored",
	},
	get_mounted_role: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/GET_MOUNTED_ROLE.html",
		origin: "vendor-docs",
	},
	get_number_attributes: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/get_number_attributes.html",
		description: "Returns the count of key-value pairs in an object within a SUPER value.",
		origin: "authored",
	},
	getbit: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_GETBIT.html",
		description: "Extracts a single bit value from binary data at the specified index.",
		origin: "authored",
	},
	getdate: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_GETDATE.html",
		description: "Returns the current date and time.",
		origin: "authored",
	},
	greatest: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_GREATEST_LEAST.html",
		description: "Returns the largest value from a list of arguments, ignoring nulls.",
		origin: "authored",
	},
	h3_boundary: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_Boundary-function.html",
		origin: "vendor-docs",
	},
	h3_center: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_Center-function.html",
		origin: "vendor-docs",
	},
	h3_fromlonglat: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_FromLongLat-function.html",
		origin: "vendor-docs",
	},
	h3_frompoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_FromPoint-function.html",
		origin: "vendor-docs",
	},
	h3_isvalid: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_IsValid-function.html",
		description: "Returns true if the index is a valid H3 cell identifier.",
		origin: "authored",
	},
	h3_polyfill: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_Polyfill-function.html",
		description: "Returns an array of H3 cell indices that cover the given geometry at the specified resolution.",
		origin: "authored",
	},
	h3_resolution: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_Resolution-function.html",
		description: "Returns the resolution level of the given H3 cell index.",
		origin: "authored",
	},
	h3_tochildren: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_ToChildren-function.html",
		description: "Returns an array of child H3 cell indices at a finer resolution.",
		origin: "authored",
	},
	h3_toparent: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/H3_ToParent-function.html",
		description: "Returns the parent H3 cell index at a coarser resolution.",
		origin: "authored",
	},
	hll: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_HLL_function.html", origin: "vendor-docs" },
	hll_cardinality: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_HLL_CARDINALITY.html",
		description: "Returns the estimated cardinality (distinct count) from an HyperLogLog sketch.",
		origin: "authored",
	},
	hll_combine: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_HLL_COMBINE.html",
		description: "Combines HyperLogLog sketches into a single sketch for merged cardinality estimation.",
		origin: "authored",
	},
	hll_combine_sketches: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_HLL_COMBINE_SKETCHES.html",
		description: "Merges two HyperLogLog sketches and returns the combined sketch.",
		origin: "authored",
	},
	hll_create_sketch: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_HLL_CREATE_SKETCH.html",
		origin: "vendor-docs",
	},
	initcap: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_INITCAP.html",
		description: "Returns the string with the first letter of each word capitalized.",
		origin: "authored",
	},
	interval_cmp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_INTERVAL_CMP.html",
		description: "Compares two intervals and returns -1, 0, or 1 for less than, equal, or greater than.",
		origin: "authored",
	},
	is_array: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_array.html",
		description: "Returns true if the SUPER value is an array type.",
		origin: "authored",
	},
	is_bigint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_bigint.html",
		description: "Returns true if the SUPER value is a bigint type.",
		origin: "authored",
	},
	is_boolean: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_boolean.html",
		description: "Returns true if the SUPER value is a boolean type.",
		origin: "authored",
	},
	is_char: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_char.html",
		description: "Returns true if the SUPER value is a character type.",
		origin: "authored",
	},
	is_decimal: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_decimal.html",
		description: "Returns true if the SUPER value is a decimal numeric type.",
		origin: "authored",
	},
	is_float: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_float.html",
		description: "Returns true if the SUPER value is a floating-point type.",
		origin: "authored",
	},
	is_integer: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_integer.html",
		description: "Returns true if the SUPER value is an integer type.",
		origin: "authored",
	},
	is_object: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_object.html",
		description: "Returns true if the SUPER value is an object type.",
		origin: "authored",
	},
	is_scalar: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_scalar.html",
		description: "Returns true if the SUPER value is a scalar (not an array or object).",
		origin: "authored",
	},
	is_smallint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_smallint.html",
		description: "Returns true if the SUPER value is a smallint type.",
		origin: "authored",
	},
	is_valid_json: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/IS_VALID_JSON.html",
		description: "Returns true if the string is valid JSON.",
		origin: "authored",
	},
	is_valid_json_array: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/IS_VALID_JSON_ARRAY.html",
		description: "Returns true if the value is a valid JSON array.",
		origin: "authored",
	},
	is_varchar: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_is_varchar.html",
		description: "Returns true if the SUPER value is a varchar type.",
		origin: "authored",
	},
	json_array_length: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/JSON_ARRAY_LENGTH.html",
		description: "Returns the number of elements in a JSON array.",
		origin: "authored",
	},
	json_extract_path_text: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/JSON_EXTRACT_PATH_TEXT.html",
		description: "Extracts text value from a JSON string at the specified path.",
		origin: "authored",
	},
	json_serialize: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/JSON_SERIALIZE.html",
		description: "Serializes a SUPER value to a JSON-formatted string.",
		origin: "authored",
	},
	json_serialize_to_varbyte: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/JSON_SERIALIZE_TO_VARBYTE.html",
		description: "Serializes a SUPER value to binary-encoded JSON format.",
		origin: "authored",
	},
	json_size: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_json_size.html", origin: "vendor-docs" },
	json_typeof: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_json_typeof.html",
		description: "Returns the type of a JSON value as a string (e.g., 'object', 'array', 'string').",
		origin: "authored",
	},
	last_user_query_id: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/LAST_USER_QUERY_ID.html",
		origin: "vendor-docs",
	},
	least: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_GREATEST_LEAST.html",
		description: "Returns the minimum value from the given arguments.",
		origin: "authored",
	},
	left: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LEFT.html",
		description: "Returns the leftmost N characters from a string.",
		origin: "authored",
	},
	len: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LEN.html",
		description: "Returns the number of characters in a string expression.",
		origin: "authored",
	},
	listagg: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LISTAGG.html",
		description: "Concatenates values from a group into a delimited string.",
		origin: "authored",
	},
	ln: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LN.html",
		description: "Returns the natural logarithm of a numeric expression.",
		origin: "authored",
	},
	lower: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LOWER.html",
		description: "Returns the string converted to lowercase.",
		origin: "authored",
	},
	lower_attribute_names: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_lower_attribute_names.html",
		origin: "vendor-docs",
	},
	lpad: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LPAD.html",
		description: "Returns a string left-padded to a specified length with an optional padding character.",
		origin: "authored",
	},
	ltrim: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LTRIM.html",
		description: "Removes leading whitespace or specified characters from the left side of a string.",
		origin: "authored",
	},
	max: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_MAX.html",
		description: "Returns the maximum value of an expression or column.",
		origin: "authored",
	},
	md5: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_MD5.html",
		description: "Computes the MD5 hash digest of a string.",
		origin: "authored",
	},
	median: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_MEDIAN.html",
		description: "Returns the median value from an expression within a group.",
		origin: "authored",
	},
	min: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_MIN.html",
		description: "Returns the minimum value of an expression or column.",
		origin: "authored",
	},
	mod: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_MOD.html",
		description: "Returns the remainder after dividing one number by another.",
		origin: "authored",
	},
	months_between: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_MONTHS_BETWEEN_function.html",
		description: "Returns the number of months between two dates.",
		origin: "authored",
	},
	murmur3_32_hash: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/MURMUR3_32_HASH.html",
		description: "Computes a 32-bit MurmurHash3 hash value for an input with optional seed.",
		origin: "authored",
	},
	ntile: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_WF_NTILE.html",
		description: "Divides rows within a partition into a specified number of buckets ranked sequentially.",
		origin: "authored",
	},
	nullif: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_NULLIF_function.html",
		description: "Returns NULL if two expressions are equal, otherwise returns the first expression.",
		origin: "authored",
	},
	nvl: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_NVL_function.html",
		description: "Returns the first non-NULL value from a list of expressions.",
		origin: "authored",
	},
	nvl2: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_NVL2.html",
		description: "Returns one value if an expression is not NULL, or another value if it is NULL.",
		origin: "authored",
	},
	octet_length: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_OCTET_LENGTH.html",
		description: "Returns the number of bytes in a string.",
		origin: "authored",
	},
	octetindex: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/OCTETINDEX.html",
		description: "Returns the byte-based position of a substring within a string.",
		origin: "authored",
	},
	percent_rank: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_WF_PERCENT_RANK.html",
		description: "Returns the relative rank of a row within its partition as a decimal between 0 and 1.",
		origin: "authored",
	},
	pg_backend_pid: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_BACKEND_PID.html",
		description: "Returns the backend process ID of the current session.",
		origin: "authored",
	},
	pg_cancel_backend: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_CANCEL_BACKEND.html",
		origin: "vendor-docs",
	},
	pg_get_cols: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_GET_COLS.html",
		description: "Returns column metadata for a table or view as a comma-separated list.",
		origin: "authored",
	},
	pg_get_grantee_by_iam_role: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_GET_GRANTEE_BY_IAMROLE.html",
		description: "Returns all users and groups that have been granted a specified IAM role.",
		origin: "authored",
	},
	pg_get_iam_role_by_user: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_GET_IAM_ROLE_BY_USER.html",
		description: "Returns all IAM roles and command privileges granted to a specified user.",
		origin: "authored",
	},
	pg_get_late_binding_view_cols: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_GET_LATE_BINDING_VIEW_COLS.html",
		description: "Returns column metadata for all late-binding views in the database.",
		origin: "authored",
	},
	pg_get_session_roles: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_GET_SESSION_ROLES.html",
		description: "Returns the roles active in the current session.",
		origin: "authored",
	},
	pg_last_copy_count: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_LAST_COPY_COUNT.html",
		description: "Returns the number of rows copied by the most recent COPY command.",
		origin: "authored",
	},
	pg_last_copy_id: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_LAST_COPY_ID.html",
		description: "Returns the unique ID of the most recent COPY command.",
		origin: "authored",
	},
	pg_last_query_id: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_LAST_QUERY_ID.html",
		description: "Returns the unique ID of the most recently executed query.",
		origin: "authored",
	},
	pg_last_unload_count: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_LAST_UNLOAD_COUNT.html",
		description: "Returns the number of rows unloaded by the most recent UNLOAD command.",
		origin: "authored",
	},
	pg_last_unload_id: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_LAST_UNLOAD_ID.html",
		description: "Returns the unique ID of the most recent UNLOAD command.",
		origin: "authored",
	},
	pg_terminate_backend: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/PG_TERMINATE_BACKEND.html",
		description: "Terminates a backend process with the specified process ID.",
		origin: "authored",
	},
	pi: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_PI.html", origin: "vendor-docs" },
	power: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_POWER.html",
		description: "Returns the result of raising a base number to an exponent.",
		origin: "authored",
	},
	quote_ident: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_QUOTE_IDENT.html",
		description: "Escapes and quotes an identifier for safe use in SQL statements.",
		origin: "authored",
	},
	quote_literal: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_QUOTE_LITERAL.html",
		description: "Escapes and quotes a string literal for safe use in SQL statements.",
		origin: "authored",
	},
	radians: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_RADIANS.html",
		description: "Converts an angle measurement from degrees to radians.",
		origin: "authored",
	},
	random: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_RANDOM.html",
		description: "Returns a random floating-point value between 0.0 (inclusive) and 1.0 (exclusive).",
		origin: "authored",
	},
	ratio_to_report: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_WF_RATIO_TO_REPORT.html",
		description: "Returns the ratio of a value to the sum of values in a partition as a decimal.",
		origin: "authored",
	},
	regexp_count: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/REGEXP_COUNT.html",
		description: "Returns the number of times a regular expression pattern matches in a string.",
		origin: "authored",
	},
	regexp_replace: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/REGEXP_REPLACE.html",
		description: "Replaces substrings matching a regular expression pattern with a replacement string.",
		origin: "authored",
	},
	regexp_substr: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/REGEXP_SUBSTR.html",
		description: "Returns the substring matching a regular expression pattern in a string.",
		origin: "authored",
	},
	repeat: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_REPEAT.html",
		description: "Returns a string repeated a specified number of times consecutively.",
		origin: "authored",
	},
	replace: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_REPLACE.html",
		description: "Replaces all occurrences of a substring with another substring in a string.",
		origin: "authored",
	},
	reverse: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_REVERSE.html",
		description: "Returns the input string with its characters in reverse order.",
		origin: "authored",
	},
	right: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LEFT.html",
		description: "Returns the rightmost characters from a string up to the specified length.",
		origin: "authored",
	},
	role_is_member_of: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ROLE_IS_MEMBER_OF.html",
		description: "Checks whether a role is a member of another role, returning a boolean result.",
		origin: "authored",
	},
	round: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_ROUND.html",
		description: "Rounds a numeric value to the specified number of decimal places.",
		origin: "authored",
	},
	rpad: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_LPAD.html",
		description: "Pads a string on the right to reach a specified length using a fill character or string.",
		origin: "authored",
	},
	rtrim: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_RTRIM.html",
		description: "Removes trailing whitespace or specified characters from the right side of a string.",
		origin: "authored",
	},
	set_config: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SET_CONFIG.html",
		description: "Sets a session or transaction-level configuration parameter to a new value.",
		origin: "authored",
	},
	sha1: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/SHA1.html",
		description: "Returns a SHA-1 cryptographic hash digest of the input as a hexadecimal string.",
		origin: "authored",
	},
	sha2: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/SHA2.html", origin: "vendor-docs" },
	sign: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SIGN.html",
		description: "Returns -1, 0, or 1 indicating the sign of a numeric value.",
		origin: "authored",
	},
	sin: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SIN.html",
		description: "Returns the sine of an angle expressed in radians.",
		origin: "authored",
	},
	size: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SIZE.html", origin: "vendor-docs" },
	slice_num: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SLICE_NUM.html", origin: "vendor-docs" },
	soundex: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/SOUNDEX.html",
		description: "Returns the Soundex code (phonetic representation) of a string for sound-alike matching.",
		origin: "authored",
	},
	split_part: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/SPLIT_PART.html",
		description: "Splits a string by a delimiter and returns the specified part (1-based index).",
		origin: "authored",
	},
	split_to_array: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/split_to_array.html",
		description: "Splits a string by a delimiter and returns the results as an array.",
		origin: "authored",
	},
	sqrt: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SQRT.html",
		description: "Returns the square root of a numeric value.",
		origin: "authored",
	},
	st_addpoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AddPoint-function.html",
		origin: "vendor-docs",
	},
	st_angle: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Angle-function.html",
		description: "Calculates the angle formed by three or four points in a geometry.",
		origin: "authored",
	},
	st_area: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Area-function.html",
		description: "Returns the area of a 2D geometry or geography.",
		origin: "authored",
	},
	st_asbinary: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AsBinary-function.html",
		description: "Returns a geometry in WKB (Well-Known Binary) format.",
		origin: "authored",
	},
	st_asewkb: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AsEWKB-function.html",
		description: "Returns a geometry in EWKB (Extended Well-Known Binary) format including SRID information.",
		origin: "authored",
	},
	st_asewkt: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AsEWKT-function.html",
		description: "Returns a geometry as EWKT (Extended Well-Known Text) with SRID and optional precision.",
		origin: "authored",
	},
	st_asgeojson: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AsGeoJSON-function.html",
		description: "Returns a geometry formatted as GeoJSON with optional coordinate precision.",
		origin: "authored",
	},
	st_ashexewkb: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AsHexEWKB-function.html",
		description: "Returns a geometry as a hexadecimal-encoded EWKB string.",
		origin: "authored",
	},
	st_ashexwkb: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AsHexWKB-function.html",
		description: "Returns a geometry as a hexadecimal-encoded WKB string.",
		origin: "authored",
	},
	st_astext: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_AsText-function.html",
		description: "Returns a geometry as WKT (Well-Known Text) with optional coordinate precision.",
		origin: "authored",
	},
	st_azimuth: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Azimuth-function.html",
		description: "Calculates the azimuth (compass bearing in radians) from one point to another.",
		origin: "authored",
	},
	st_boundary: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Boundary-function.html",
		description: "Returns the boundary (edge) geometry of the input geometry.",
		origin: "authored",
	},
	st_buffer: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Buffer-function.html",
		description: "Creates a polygon that represents all points within a specified distance of a geometry.",
		origin: "authored",
	},
	st_centroid: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Centroid-function.html",
		description: "Returns the centroid (mathematical center point) of a geometry.",
		origin: "authored",
	},
	st_collect: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Collect-function.html",
		description: "Combines two geometries into a multi-geometry, or aggregates geometries from a column.",
		origin: "authored",
	},
	st_contains: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Contains-function.html",
		description: "Tests whether one geometry completely contains another geometry.",
		origin: "authored",
	},
	st_containsproperly: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_ContainsProperly-function.html",
		description: "Tests whether one geometry properly contains another (touching at boundary is excluded).",
		origin: "authored",
	},
	st_convexhull: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_ConvexHull-function.html",
		description: "Returns the convex hull (smallest convex polygon) enclosing all points in a geometry.",
		origin: "authored",
	},
	st_coveredby: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_CoveredBy-function.html",
		description: "Tests whether one geometry is completely covered by another geometry.",
		origin: "authored",
	},
	st_covers: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Covers-function.html",
		description: "Tests whether one geometry completely covers another geometry.",
		origin: "authored",
	},
	st_crosses: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Crosses-function.html",
		description: "Tests whether two geometries cross (share interior points but neither contains the other).",
		origin: "authored",
	},
	st_dimension: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Dimension-function.html",
		description: "Returns the dimensionality of a geometry (0 for point, 1 for line, 2 for surface).",
		origin: "authored",
	},
	st_disjoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Disjoint-function.html",
		description: "Tests whether two geometries are disjoint (have no points in common).",
		origin: "authored",
	},
	st_distance: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Distance-function.html",
		description: "Returns the minimum distance between two geometries in the same coordinate system.",
		origin: "authored",
	},
	st_distancesphere: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_DistanceSphere-function.html",
		origin: "vendor-docs",
	},
	st_dwithin: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_DWithin-function.html",
		description: "Returns true if two geometries are within a specified distance threshold of each other.",
		origin: "authored",
	},
	st_endpoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_EndPoint-function.html",
		origin: "vendor-docs",
	},
	st_envelope: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Envelope-function.html",
		description: "Returns the bounding box of a geometry as a polygon.",
		origin: "authored",
	},
	st_equals: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Equals-function.html",
		description: "Returns true if two geometries represent the same shape and location.",
		origin: "authored",
	},
	st_exteriorring: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_ExteriorRing-function.html",
		description: "Returns the outer boundary ring of a polygon as a linestring.",
		origin: "authored",
	},
	st_force2d: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Force2D-function.html",
		description: "Casts a geometry to two dimensions by dropping Z and M coordinates.",
		origin: "authored",
	},
	st_force3dm: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Force3DM-function.html",
		description: "Casts a geometry to three dimensions, retaining only the M coordinate as the third dimension.",
		origin: "authored",
	},
	st_force3dz: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Force3DZ-function.html",
		description: "Casts a geometry to three dimensions, retaining only the Z coordinate as the third dimension.",
		origin: "authored",
	},
	st_force4d: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Force4D-function.html",
		description: "Casts a geometry to four dimensions with both Z and M coordinates.",
		origin: "authored",
	},
	st_geogfromtext: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeogFromText-function.html",
		description: "Converts a WKT (well-known text) string into a geography type.",
		origin: "authored",
	},
	st_geogfromwkb: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeogFromWKB-function.html",
		description: "Converts a WKB (well-known binary) representation into a geography type.",
		origin: "authored",
	},
	st_geohash: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeoHash-function.html",
		description: "Encodes a geometry as a geohash string for spatial indexing and proximity queries.",
		origin: "authored",
	},
	st_geometryn: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeometryN-function.html",
		description: "Returns the geometry at the specified index within a geometry collection.",
		origin: "authored",
	},
	st_geometrytype: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeometryType-function.html",
		origin: "vendor-docs",
	},
	st_geomfromewkb: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeomFromEWKB-function.html",
		description: "Converts an EWKB (extended well-known binary) representation into a geometry type.",
		origin: "authored",
	},
	st_geomfromewkt: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeomFromEWKT-function.html",
		description: "Converts an EWKT (extended well-known text) string into a geometry type.",
		origin: "authored",
	},
	st_geomfromgeohash: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeomFromGeoHash-function.html",
		description: "Converts a geohash string into a geometry representing its bounding box.",
		origin: "authored",
	},
	st_geomfromgeojson: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeomFromGeoJSON-function.html",
		description: "Converts a GeoJSON string into a geometry type.",
		origin: "authored",
	},
	st_geomfromgeosquare: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeomFromGeoSquare-function.html",
		description: "Converts a geosquare code string into a geometry.",
		origin: "authored",
	},
	st_geomfromtext: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeomFromText-function.html",
		description: "Converts a WKT (well-known text) string into a geometry type with optional SRID.",
		origin: "authored",
	},
	st_geomfromwkb: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeomFromWKB-function.html",
		description: "Converts a WKB (well-known binary) representation into a geometry type with optional SRID.",
		origin: "authored",
	},
	st_geosquare: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_GeoSquare-function.html",
		description: "Encodes a geometry as a geosquare code string for spatial partitioning.",
		origin: "authored",
	},
	st_interiorringn: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_InteriorRingN-function.html",
		description: "Returns the interior ring at the specified index of a polygon.",
		origin: "authored",
	},
	st_intersection: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Intersection-function.html",
		description: "Returns the spatial intersection of two geometries.",
		origin: "authored",
	},
	st_intersects: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Intersects-function.html",
		description: "Returns true if two geometries have any points in common.",
		origin: "authored",
	},
	st_isclosed: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsClosed-function.html",
		description: "Returns true if a geometry's start and end points are the same.",
		origin: "authored",
	},
	st_iscollection: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsCollection-function.html",
		description: "Returns true if a geometry is a collection type (Multi* or GeometryCollection).",
		origin: "authored",
	},
	st_isempty: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsEmpty-function.html",
		description: "Returns true if a geometry has no points or area.",
		origin: "authored",
	},
	st_ispolygonccw: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsPolygonCCW-function.html",
		origin: "vendor-docs",
	},
	st_ispolygoncw: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsPolygonCW-function.html",
		origin: "vendor-docs",
	},
	st_isring: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsRing-function.html",
		description: "Returns true if a linestring is closed and simple (no self-intersections).",
		origin: "authored",
	},
	st_issimple: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsSimple-function.html",
		description: "Returns true if a geometry does not self-intersect or self-touch.",
		origin: "authored",
	},
	st_isvalid: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_IsValid-function.html",
		description: "Returns true if a geometry is valid according to spatial topology rules.",
		origin: "authored",
	},
	st_length: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Length-function.html",
		description: "Returns the length of a geometry in its coordinate system units.",
		origin: "authored",
	},
	st_lengthsphere: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_LengthSphere-function.html",
		origin: "vendor-docs",
	},
	st_linefrommultipoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_LineFromMultiPoint-function.html",
		description: "Converts a multipoint geometry into a linestring by connecting the points in order.",
		origin: "authored",
	},
	st_lineinterpolatepoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_LineInterpolatePoint-function.html",
		description: "Returns a point at a specified fraction of the distance along a linestring.",
		origin: "authored",
	},
	st_m: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_M-function.html",
		description: "Returns the M (measure) coordinate of a point geometry.",
		origin: "authored",
	},
	st_makeenvelope: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_MakeEnvelope-function.html",
		origin: "vendor-docs",
	},
	st_makeline: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_MakeLine-function.html",
		description: "Constructs a line string geometry from two geometries.",
		origin: "authored",
	},
	st_makepoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_MakePoint-function.html",
		description: "Constructs a point geometry from x and y coordinates, with optional z and m dimensions.",
		origin: "authored",
	},
	st_makepolygon: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_MakePolygon-function.html",
		description: "Constructs a polygon from a line string ring and optional interior ring geometries.",
		origin: "authored",
	},
	st_memsize: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_MemSize-function.html",
		origin: "vendor-docs",
	},
	st_mmax: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_MMax-function.html",
		description: "Returns the maximum M coordinate value in a geometry.",
		origin: "authored",
	},
	st_mmin: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_MMin-function.html",
		description: "Returns the minimum M coordinate value in a geometry.",
		origin: "authored",
	},
	st_multi: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Multi-function.html",
		description: "Converts a geometry to its multi-variant (MultiPoint, MultiLineString, or MultiPolygon).",
		origin: "authored",
	},
	st_ndims: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_NDims-function.html",
		description: "Returns the number of dimensions (2, 3, or 4) in a geometry.",
		origin: "authored",
	},
	st_npoints: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_NPoints-function.html",
		description: "Returns the number of points in a geometry.",
		origin: "authored",
	},
	st_nrings: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_NRings-function.html",
		description: "Returns the number of rings in a geometry.",
		origin: "authored",
	},
	st_numgeometries: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_NumGeometries-function.html",
		description: "Returns the number of geometries in a multi-geometry object.",
		origin: "authored",
	},
	st_numinteriorrings: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_NumInteriorRings-function.html",
		description: "Returns the number of interior rings (holes) in a polygon.",
		origin: "authored",
	},
	st_numpoints: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_NumPoints-function.html",
		origin: "vendor-docs",
	},
	st_perimeter: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Perimeter-function.html",
		origin: "vendor-docs",
	},
	st_point: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Point-function.html",
		description: "Constructs a point geometry from x and y coordinates.",
		origin: "authored",
	},
	st_pointn: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_PointN-function.html",
		description: "Returns the point at the specified index position in a geometry.",
		origin: "authored",
	},
	st_points: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Points-function.html",
		origin: "vendor-docs",
	},
	st_polygon: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Polygon-function.html",
		description: "Constructs a polygon from a line string ring using the specified SRID.",
		origin: "authored",
	},
	st_removepoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_RemovePoint-function.html",
		description: "Removes the point at the specified index from a geometry.",
		origin: "authored",
	},
	st_reverse: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Reverse-function.html",
		description: "Reverses the order of vertices in a geometry.",
		origin: "authored",
	},
	st_setpoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_SetPoint-function.html",
		description: "Replaces the point at the specified index in a geometry with another point.",
		origin: "authored",
	},
	st_setsrid: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_SetSRID-function.html",
		description: "Sets the SRID (spatial reference system identifier) of a geometry.",
		origin: "authored",
	},
	st_simplify: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Simplify-function.html",
		description: "Simplifies a geometry by removing vertices within a specified tolerance distance.",
		origin: "authored",
	},
	st_srid: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_SRID-function.html",
		description: "Returns the SRID (spatial reference system identifier) of a geometry.",
		origin: "authored",
	},
	st_startpoint: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_StartPoint-function.html",
		description: "Returns the first point in a geometry.",
		origin: "authored",
	},
	st_touches: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Touches-function.html",
		description: "Tests whether two geometries have at least one point in common but do not overlap.",
		origin: "authored",
	},
	st_transform: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Transform-function.html",
		description: "Transforms a geometry to a different SRID (spatial reference system).",
		origin: "authored",
	},
	st_union: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Union-function.html",
		description: "Computes the geometric union of two geometries.",
		origin: "authored",
	},
	st_within: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Within-function.html",
		description: "Tests whether one geometry is completely within another geometry.",
		origin: "authored",
	},
	st_x: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_X-function.html",
		description: "Returns the X coordinate of a point geometry.",
		origin: "authored",
	},
	st_xmax: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_XMax-function.html",
		description: "Returns the maximum X coordinate value in a geometry's bounding box.",
		origin: "authored",
	},
	st_xmin: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_XMin-function.html",
		description: "Returns the minimum X coordinate value in a geometry's bounding box.",
		origin: "authored",
	},
	st_y: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Y-function.html",
		description: "Returns the Y coordinate of a point geometry.",
		origin: "authored",
	},
	st_ymax: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_YMax-function.html",
		description: "Returns the maximum Y coordinate value in a geometry's bounding box.",
		origin: "authored",
	},
	st_ymin: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_YMin-function.html",
		description: "Returns the minimum Y coordinate value in a geometry's bounding box.",
		origin: "authored",
	},
	st_z: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_Z-function.html",
		description: "Returns the Z coordinate of a point geometry.",
		origin: "authored",
	},
	st_zmax: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_ZMax-function.html",
		description: "Returns the maximum Z coordinate value in a geometry.",
		origin: "authored",
	},
	st_zmin: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/ST_ZMin-function.html",
		description: "Returns the minimum Z coordinate value in a geometry.",
		origin: "authored",
	},
	stddev_pop: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_STDDEV_functions.html",
		description: "Calculates the population standard deviation of a numeric expression across all rows.",
		origin: "authored",
	},
	strpos: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_STRPOS.html",
		description: "Returns the position of a substring within a string, using 1-based indexing, or 0 if not found.",
		origin: "authored",
	},
	strtol: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_STRTOL.html",
		description: "Converts a string representation of a number in the given base to its integer value.",
		origin: "authored",
	},
	subarray: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_subarray.html",
		description: "Extracts a contiguous slice from an array starting at the given position for a specified length.",
		origin: "authored",
	},
	substring: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SUBSTRING.html",
		description: "Extracts a substring starting at a position for a specified number of characters or bytes.",
		origin: "authored",
	},
	sum: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_SUM.html",
		description: "Aggregates numeric values across rows, returning their sum.",
		origin: "authored",
	},
	supportsbbox: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/SupportsBBox-function.html",
		origin: "vendor-docs",
	},
	tan: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TAN.html",
		description: "Returns the tangent of a numeric argument interpreted as radians.",
		origin: "authored",
	},
	text_to_int_alt: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TEXT_TO_INT_ALT.html",
		origin: "vendor-docs",
	},
	timeofday: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TIMEOFDAY_function.html",
		description: "Returns the current date and time as a text string.",
		origin: "authored",
	},
	timestamp_cmp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TIMESTAMP_CMP.html",
		description: "Compares two timestamps and returns -1, 0, or 1 to indicate their relative ordering.",
		origin: "authored",
	},
	timestamp_cmp_date: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TIMESTAMP_CMP_DATE.html",
		description: "Compares a timestamp to a date and returns -1, 0, or 1 based on their ordering.",
		origin: "authored",
	},
	timestamp_cmp_timestamptz: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TIMESTAMP_CMP_TIMESTAMPTZ.html",
		description: "Compares a timestamp to a timestamp with time zone and returns -1, 0, or 1.",
		origin: "authored",
	},
	timestamptz_cmp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TIMESTAMPTZ_CMP.html",
		description: "Compares two timestamps with time zone and returns -1, 0, or 1 to indicate their order.",
		origin: "authored",
	},
	timestamptz_cmp_date: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TIMESTAMPTZ_CMP_DATE.html",
		description: "Compares a timestamp with time zone to a date and returns -1, 0, or 1.",
		origin: "authored",
	},
	timestamptz_cmp_timestamp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TIMESTAMPTZ_CMP_TIMESTAMP.html",
		description: "Compares a timestamp with time zone to a timestamp and returns -1, 0, or 1.",
		origin: "authored",
	},
	to_date: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TO_DATE_function.html",
		description: "Converts a string to a date using the specified format string.",
		origin: "authored",
	},
	to_hex: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TO_HEX.html",
		description: "Converts a value to its hexadecimal string representation.",
		origin: "authored",
	},
	to_number: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TO_NUMBER.html", origin: "vendor-docs" },
	to_timestamp: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TO_TIMESTAMP.html",
		description: "Converts a string to a timestamp using the specified format string.",
		origin: "authored",
	},
	to_varbyte: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TO_VARBYTE.html",
		description: "Converts a string to a binary varbyte value using the specified format.",
		origin: "authored",
	},
	translate: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TRANSLATE.html",
		description: "Replaces characters in an expression based on character-to-character substitution rules.",
		origin: "authored",
	},
	trim: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TRIM.html", origin: "vendor-docs" },
	trunc: { docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_TRUNC.html", origin: "vendor-docs" },
	upper: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_UPPER.html",
		description: "Converts a string to uppercase.",
		origin: "authored",
	},
	upper_attribute_names: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_upper_attribute_names.html",
		description: "Converts attribute names in a SUPER data type to uppercase.",
		origin: "authored",
	},
	var_pop: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_VARIANCE_functions.html",
		description: "Calculates the population variance of numeric values.",
		origin: "authored",
	},
	version: {
		docUrl: "https://docs.aws.amazon.com/redshift/latest/dg/r_VERSION.html",
		description: "Returns the version string of the Redshift instance.",
		origin: "authored",
	},
};
