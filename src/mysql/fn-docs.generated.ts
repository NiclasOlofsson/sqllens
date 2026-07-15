// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for mysql (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-15. 246 names (218 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const MYSQL_FN_DOCS: Record<string, FnDoc> = {
	abs: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_abs",
		description: "Returns the absolute value of the argument.",
		origin: "authored",
	},
	acos: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_acos",
		description: "Returns the arc cosine of the argument in radians.",
		origin: "authored",
	},
	adddate: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_adddate",
		description: "Returns the date that results from adding the specified number of days to a date.",
		origin: "authored",
	},
	addtime: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_addtime",
		description: "Adds a time interval to a time or datetime value and returns the result.",
		origin: "authored",
	},
	any_value: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_any-value",
		description: "Returns an arbitrary value from the group; suppresses ONLY_FULL_GROUP_BY constraint checks.",
		origin: "authored",
	},
	ascii: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_ascii",
		description: "Returns the numeric ASCII code value of the leftmost character in the string.",
		origin: "authored",
	},
	asin: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_asin",
		description: "Returns the arc sine of the argument in radians.",
		origin: "authored",
	},
	atan: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_atan",
		description: "Returns the arc tangent of the argument (or Y/X when two arguments given) in radians.",
		origin: "authored",
	},
	atan2: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_atan2",
		description: "Returns the arc tangent of Y/X in radians.",
		origin: "authored",
	},
	avg: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_avg",
		description: "Returns the average value of a numeric expression over a row set.",
		origin: "authored",
	},
	benchmark: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_benchmark",
		description: "Executes the expression repeatedly and returns zero, useful for timing operations.",
		origin: "authored",
	},
	bin: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_bin",
		description: "Returns the binary string representation of the argument.",
		origin: "authored",
	},
	bin_to_uuid: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_bin-to-uuid",
		description: "Converts a binary UUID to its text representation in standard UUID format.",
		origin: "authored",
	},
	bit_and: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_bit-and",
		description: "Returns the bitwise AND of all values in a group.",
		origin: "authored",
	},
	bit_count: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/bit-functions.html#function_bit-count",
		description: "Returns the number of set bits in the argument.",
		origin: "authored",
	},
	bit_length: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_bit-length",
		description: "Returns the length of the argument in bits.",
		origin: "authored",
	},
	bit_or: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_bit-or",
		description: "Returns the bitwise OR of all values in a group.",
		origin: "authored",
	},
	bit_xor: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_bit-xor",
		description: "Returns the bitwise XOR of all values in a group.",
		origin: "authored",
	},
	cast: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/cast-functions.html#function_cast",
		description: "Converts the argument to a specified type.",
		origin: "authored",
	},
	ceil: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_ceil",
		description: "Returns the smallest integer value not less than the argument.",
		origin: "authored",
	},
	ceiling: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_ceiling",
		description: "Returns the smallest integer value not less than the argument (synonym for CEIL).",
		origin: "authored",
	},
	char_length: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_char-length",
		description: "Returns the number of characters in the string argument.",
		origin: "authored",
	},
	character_length: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_character-length",
		description: "Returns the number of characters in the string argument (synonym for CHAR_LENGTH).",
		origin: "authored",
	},
	charset: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_charset",
		description: "Returns the character set of the argument string.",
		origin: "authored",
	},
	coalesce: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/comparison-operators.html#function_coalesce",
		description: "Returns the first non-NULL value from the argument list.",
		origin: "authored",
	},
	coercibility: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_coercibility",
		description: "Returns the collation coercibility value of the argument string.",
		origin: "authored",
	},
	collation: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_collation",
		description: "Returns the collation of the argument string.",
		origin: "authored",
	},
	compress: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/encryption-functions.html#function_compress",
		description: "Compresses the string using the zlib algorithm and returns the compressed result as binary.",
		origin: "authored",
	},
	concat: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_concat",
		description: "Concatenates the argument strings and returns the resulting string.",
		origin: "authored",
	},
	concat_ws: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_concat-ws",
		description: "Concatenates strings with a separator between each argument.",
		origin: "authored",
	},
	connection_id: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_connection-id",
		description: "Returns the numeric identifier for the current connection.",
		origin: "authored",
	},
	conv: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_conv",
		description: "Converts a number from one base to another and returns the result as a string.",
		origin: "authored",
	},
	convert: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/cast-functions.html#function_convert",
		description: "Converts the argument to a specified type (equivalent to CAST).",
		origin: "authored",
	},
	convert_tz: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_convert-tz",
		description: "Converts a datetime value from one timezone to another.",
		origin: "authored",
	},
	cos: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_cos",
		origin: "vendor-docs",
	},
	cot: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_cot",
		origin: "vendor-docs",
	},
	count: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_count",
		description: "Returns the number of rows or non-NULL values in a set.",
		origin: "authored",
	},
	crc32: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_crc32",
		description: "Returns the CRC32 checksum value of the argument string.",
		origin: "authored",
	},
	cume_dist: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html#function_cume-dist",
		description: "Returns the cumulative distribution of the current row within a partition over the result set.",
		origin: "authored",
	},
	curdate: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_curdate",
		description: "Returns the current date.",
		origin: "authored",
	},
	current_date: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_current-date",
		description: "Returns the current date as DATE type.",
		origin: "authored",
	},
	current_role: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_current-role",
		origin: "vendor-docs",
	},
	current_time: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_current-time",
		description: "Returns the current time with optional fractional seconds precision.",
		origin: "authored",
	},
	current_timestamp: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_current-timestamp",
		description: "Returns the current date and time with optional fractional seconds precision.",
		origin: "authored",
	},
	current_user: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_current-user",
		description: "Returns the current user's name and host as a string.",
		origin: "authored",
	},
	curtime: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_curtime",
		description: "Returns the current time with optional fractional seconds precision.",
		origin: "authored",
	},
	database: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_database",
		description: "Returns the name of the currently selected database.",
		origin: "authored",
	},
	date: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_date",
		description: "Extracts the date portion from a datetime or timestamp expression.",
		origin: "authored",
	},
	date_add: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_date-add",
		origin: "vendor-docs",
	},
	date_format: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_date-format",
		description: "Formats a date according to the specified format string.",
		origin: "authored",
	},
	date_sub: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_date-sub",
		description: "Subtracts an interval from a date and returns the result.",
		origin: "authored",
	},
	datediff: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_datediff",
		description: "Returns the number of days between two date expressions.",
		origin: "authored",
	},
	day: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_day",
		description: "Returns the day of the month from a date as an integer between 1 and 31.",
		origin: "authored",
	},
	dayname: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_dayname",
		description: "Returns the name of the day of the week for a date.",
		origin: "authored",
	},
	dayofmonth: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_dayofmonth",
		description: "Returns the day of the month from a date as an integer between 1 and 31.",
		origin: "authored",
	},
	dayofweek: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_dayofweek",
		description: "Returns the day of the week as an integer where 1 is Sunday and 7 is Saturday.",
		origin: "authored",
	},
	dayofyear: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_dayofyear",
		description: "Returns the day of the year from a date as an integer between 1 and 366.",
		origin: "authored",
	},
	default: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_default",
		description: "Returns the default value defined for a column.",
		origin: "authored",
	},
	degrees: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_degrees",
		description: "Converts radians to degrees.",
		origin: "authored",
	},
	dense_rank: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html#function_dense-rank",
		description: "Returns the rank of the current row within its partition, with no gaps in ranking.",
		origin: "authored",
	},
	elt: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_elt",
		description: "Returns the Nth element from a list of strings (1-based indexing).",
		origin: "authored",
	},
	exp: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_exp",
		description: "Returns the mathematical constant e raised to the power of the argument.",
		origin: "authored",
	},
	export_set: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_export-set",
		description: "Returns a string representing bits in a binary value, with on/off strings for each bit.",
		origin: "authored",
	},
	field: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_field",
		description: "Returns the 1-based position of a string in a list, or 0 if not found.",
		origin: "authored",
	},
	find_in_set: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_find-in-set",
		description: "Returns the 1-based position of a string within a comma-separated list, or 0 if not found.",
		origin: "authored",
	},
	first_value: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html#function_first-value",
		description: "Returns the first value in an ordered set of rows within a partition.",
		origin: "authored",
	},
	floor: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_floor",
		description: "Returns the largest integer less than or equal to the argument.",
		origin: "authored",
	},
	format: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_format",
		description: "Formats a number with a specified number of decimal places using optional locale formatting.",
		origin: "authored",
	},
	found_rows: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_found-rows",
		origin: "vendor-docs",
	},
	from_base64: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_from-base64",
		description: "Decodes a base64-encoded string and returns the result as a binary value.",
		origin: "authored",
	},
	from_days: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_from-days",
		origin: "vendor-docs",
	},
	from_unixtime: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_from-unixtime",
		description:
			"Converts a Unix timestamp to a date or datetime, optionally formatted according to a format string.",
		origin: "authored",
	},
	get_lock: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html#function_get-lock",
		description: "Acquires a named advisory lock and returns 1 on success, 0 on timeout, or null on error.",
		origin: "authored",
	},
	greatest: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/comparison-operators.html#function_greatest",
		description: "Returns the maximum value from a list of arguments.",
		origin: "authored",
	},
	group_concat: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_group-concat",
		description: "Concatenates values from multiple rows in a group into a single string.",
		origin: "authored",
	},
	hex: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_hex",
		description: "Returns the hexadecimal representation of a string or number.",
		origin: "authored",
	},
	hour: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_hour",
		origin: "vendor-docs",
	},
	icu_version: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_icu-version",
		description: "Returns the version of the International Components for Unicode library.",
		origin: "authored",
	},
	if: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/flow-control-functions.html#function_if",
		description: "Returns the second argument if the condition is true, otherwise returns the third argument.",
		origin: "authored",
	},
	ifnull: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/flow-control-functions.html#function_ifnull",
		description: "Returns the first argument if it is not null, otherwise returns the second argument.",
		origin: "authored",
	},
	inet6_aton: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_inet6-aton",
		description: "Converts an IPv6 address string to its binary representation.",
		origin: "authored",
	},
	inet6_ntoa: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_inet6-ntoa",
		description: "Converts an IPv6 address from binary representation to a string.",
		origin: "authored",
	},
	inet_aton: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_inet-aton",
		description: "Converts an IPv4 address string to its numeric representation.",
		origin: "authored",
	},
	inet_ntoa: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_inet-ntoa",
		description: "Converts an IPv4 address from numeric representation to a string.",
		origin: "authored",
	},
	insert: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_insert",
		description: "Replaces a substring of specified length starting at a position with a new string.",
		origin: "authored",
	},
	instr: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_instr",
		description: "Returns the position of the first occurrence of a substring within a string.",
		origin: "authored",
	},
	interval: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/comparison-operators.html#function_interval",
		description: "Returns the index of the first argument value that is greater than the initial value.",
		origin: "authored",
	},
	is_free_lock: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html#function_is-free-lock",
		origin: "vendor-docs",
	},
	is_ipv4: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_is-ipv4",
		description: "Tests whether an expression represents a valid IPv4 address.",
		origin: "authored",
	},
	is_ipv4_compat: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_is-ipv4-compat",
		description: "Tests whether an IPv6 address is IPv4-compatible.",
		origin: "authored",
	},
	is_ipv4_mapped: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_is-ipv4-mapped",
		description: "Tests whether an IPv6 address is IPv4-mapped.",
		origin: "authored",
	},
	is_ipv6: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_is-ipv6",
		description: "Tests whether an expression represents a valid IPv6 address.",
		origin: "authored",
	},
	is_used_lock: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html#function_is-used-lock",
		description: "Returns the connection ID holding a named lock, or NULL if the lock is not held.",
		origin: "authored",
	},
	is_uuid: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_is-uuid",
		description: "Tests whether an expression represents a valid UUID.",
		origin: "authored",
	},
	isnull: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/comparison-operators.html#function_isnull",
		description: "Returns 1 if the argument is NULL, 0 otherwise.",
		origin: "authored",
	},
	json_arrayagg: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_json-arrayagg",
		description: "Aggregates values into a JSON array by collecting each argument value.",
		origin: "authored",
	},
	json_contains: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-search-functions.html#function_json-contains",
		description: "Tests whether one JSON document is contained within another.",
		origin: "authored",
	},
	json_depth: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-attribute-functions.html#function_json-depth",
		description: "Returns the maximum depth of a JSON document.",
		origin: "authored",
	},
	json_extract: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-search-functions.html#function_json-extract",
		description: "Extracts data from a JSON document at the specified path or paths.",
		origin: "authored",
	},
	json_keys: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-search-functions.html#function_json-keys",
		origin: "vendor-docs",
	},
	json_length: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-attribute-functions.html#function_json-length",
		description: "Returns the length of a JSON document or a JSON element at a specified path.",
		origin: "authored",
	},
	json_objectagg: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_json-objectagg",
		description: "Aggregates key-value pairs into a JSON object.",
		origin: "authored",
	},
	json_overlaps: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-search-functions.html#function_json-overlaps",
		description: "Tests whether two JSON documents have overlapping content.",
		origin: "authored",
	},
	json_pretty: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-utility-functions.html#function_json-pretty",
		description: "Returns a formatted version of a JSON document with indentation.",
		origin: "authored",
	},
	json_quote: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-creation-functions.html#function_json-quote",
		description: "Quotes a string as a JSON string, escaping special characters.",
		origin: "authored",
	},
	json_schema_valid: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-validation-functions.html#function_json-schema-valid",
		description: "Tests whether a JSON document is valid according to a JSON schema.",
		origin: "authored",
	},
	json_schema_validation_report: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-validation-functions.html#function_json-schema-validation-report",
		description: "Returns a JSON report detailing validation errors for a document against a schema.",
		origin: "authored",
	},
	json_storage_free: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-utility-functions.html#function_json-storage-free",
		origin: "vendor-docs",
	},
	json_storage_size: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-utility-functions.html#function_json-storage-size",
		description: "Returns the size in bytes of the storage space used by a JSON document.",
		origin: "authored",
	},
	json_type: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-attribute-functions.html#function_json-type",
		origin: "vendor-docs",
	},
	json_unquote: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-modification-functions.html#function_json-unquote",
		description: "Unquotes a JSON string, removing outer quotes and interpreting escape sequences.",
		origin: "authored",
	},
	json_valid: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-attribute-functions.html#function_json-valid",
		description: "Tests whether an expression is valid JSON.",
		origin: "authored",
	},
	json_value: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/json-search-functions.html#function_json-value",
		description: "Extracts a scalar JSON value from a document at the specified path, or NULL if not a scalar.",
		origin: "authored",
	},
	lag: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html#function_lag",
		description: "Accesses data from a row at a specified offset before the current row within a window.",
		origin: "authored",
	},
	last_day: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_last-day",
		description: "Returns the last day of the month for the given date.",
		origin: "authored",
	},
	last_insert_id: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_last-insert-id",
		description: "Returns the value generated by an AUTO_INCREMENT column in the most recent insert.",
		origin: "authored",
	},
	last_value: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html#function_last-value",
		description: "Returns the last value within the ordered window frame.",
		origin: "authored",
	},
	lcase: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_lcase",
		description: "Converts a string to lowercase.",
		origin: "authored",
	},
	lead: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html#function_lead",
		description: "Accesses data from a row at a specified offset after the current row within a window.",
		origin: "authored",
	},
	least: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/comparison-operators.html#function_least",
		description: "Returns the smallest value from a list of values.",
		origin: "authored",
	},
	left: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_left",
		description: "Returns the leftmost N characters of a string.",
		origin: "authored",
	},
	length: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_length",
		origin: "vendor-docs",
	},
	ln: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_ln",
		description: "Returns the natural logarithm of a number.",
		origin: "authored",
	},
	load_file: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_load-file",
		description: "Reads and returns the contents of a file as a string.",
		origin: "authored",
	},
	localtime: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_localtime",
		description: "Returns the current date and time.",
		origin: "authored",
	},
	localtimestamp: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_localtimestamp",
		description: "Returns the current date and time.",
		origin: "authored",
	},
	locate: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_locate",
		description: "Returns the position of the first occurrence of a substring within a string.",
		origin: "authored",
	},
	log: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_log",
		description:
			"Returns the logarithm of a number to a specified base, or the natural logarithm if no base is given.",
		origin: "authored",
	},
	log10: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_log10",
		description: "Returns the base-10 logarithm of a number.",
		origin: "authored",
	},
	log2: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_log2",
		description: "Returns the base-2 logarithm of a number.",
		origin: "authored",
	},
	lower: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_lower",
		description: "Returns a string converted to lowercase.",
		origin: "authored",
	},
	lpad: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_lpad",
		description: "Returns a string padded on the left to a specified length.",
		origin: "authored",
	},
	ltrim: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_ltrim",
		origin: "vendor-docs",
	},
	make_set: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_make-set",
		description: "Returns a comma-separated string of values corresponding to the set bits in the first argument.",
		origin: "authored",
	},
	makedate: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_makedate",
		description: "Returns a date constructed from a year and a day-of-year value.",
		origin: "authored",
	},
	maketime: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_maketime",
		description: "Returns a time value constructed from hour, minute, and second arguments.",
		origin: "authored",
	},
	max: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_max",
		description: "Returns the maximum value from a set of values.",
		origin: "authored",
	},
	md5: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/encryption-functions.html#function_md5",
		description: "Returns the MD5 hash digest of a string.",
		origin: "authored",
	},
	microsecond: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_microsecond",
		description: "Returns the microsecond component from a time or datetime value.",
		origin: "authored",
	},
	mid: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_mid",
		description: "Returns a substring starting at a specified position.",
		origin: "authored",
	},
	min: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_min",
		description: "Returns the minimum value from a set of values.",
		origin: "authored",
	},
	minute: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_minute",
		description: "Returns the minute component from a time or datetime value.",
		origin: "authored",
	},
	mod: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_mod",
		description: "Returns the remainder when the first number is divided by the second.",
		origin: "authored",
	},
	month: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_month",
		description: "Returns the month component from a date value.",
		origin: "authored",
	},
	monthname: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_monthname",
		description: "Returns the full name of the month from a date value.",
		origin: "authored",
	},
	name_const: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_name-const",
		description: "Returns a value; used to associate a display name with an expression in result sets.",
		origin: "authored",
	},
	now: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_now",
		description: "Returns the current date and time.",
		origin: "authored",
	},
	nth_value: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html#function_nth-value",
		description: "Returns the nth value within a partition in a window function context.",
		origin: "authored",
	},
	ntile: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html#function_ntile",
		description: "Divides rows into N approximately equal-sized groups in a window partition.",
		origin: "authored",
	},
	nullif: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/flow-control-functions.html#function_nullif",
		description: "Returns NULL if two expressions are equal, otherwise returns the first expression.",
		origin: "authored",
	},
	oct: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_oct",
		description: "Returns the octal string representation of a number.",
		origin: "authored",
	},
	octet_length: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_octet-length",
		description: "Returns the length of a string in bytes.",
		origin: "authored",
	},
	ord: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_ord",
		origin: "vendor-docs",
	},
	percent_rank: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html#function_percent-rank",
		description: "Returns the relative rank of a row as a percentage within a partition.",
		origin: "authored",
	},
	period_add: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_period-add",
		description: "Adds a number of months to a period value and returns the result.",
		origin: "authored",
	},
	period_diff: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_period-diff",
		description: "Returns the number of months between two period values.",
		origin: "authored",
	},
	pi: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_pi",
		description: "Returns the value of pi, approximately 3.141593.",
		origin: "authored",
	},
	pow: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_pow",
		description: "Returns a number raised to a specified power.",
		origin: "authored",
	},
	power: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_power",
		description: "Returns a number raised to a specified power.",
		origin: "authored",
	},
	quarter: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_quarter",
		description: "Returns the quarter (1-4) of a date value.",
		origin: "authored",
	},
	quote: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_quote",
		origin: "vendor-docs",
	},
	radians: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_radians",
		description: "Converts an angle measurement from degrees to radians.",
		origin: "authored",
	},
	rand: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_rand",
		description: "Returns a random floating-point value between 0 (inclusive) and 1 (exclusive).",
		origin: "authored",
	},
	random_bytes: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/encryption-functions.html#function_random-bytes",
		description: "Generates a cryptographically secure random byte string of specified length.",
		origin: "authored",
	},
	rank: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html#function_rank",
		description: "Returns the rank of a row within a partition, with gaps for ties.",
		origin: "authored",
	},
	regexp_instr: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/regexp.html#function_regexp-instr",
		description: "Returns the starting position of a substring matching a regular expression pattern.",
		origin: "authored",
	},
	regexp_like: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/regexp.html#function_regexp-like",
		description: "Tests whether a string matches a regular expression pattern, returning 1 or 0.",
		origin: "authored",
	},
	regexp_replace: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/regexp.html#function_regexp-replace",
		description: "Replaces substrings matching a regular expression pattern with a replacement string.",
		origin: "authored",
	},
	regexp_substr: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/regexp.html#function_regexp-substr",
		description: "Extracts the substring matching a regular expression pattern from a string.",
		origin: "authored",
	},
	release_all_locks: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html#function_release-all-locks",
		description: "Releases all named locks held by the current session acquired via GET_LOCK().",
		origin: "authored",
	},
	release_lock: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html#function_release-lock",
		description: "Releases a named lock previously acquired with GET_LOCK(), returning 1 on success.",
		origin: "authored",
	},
	repeat: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_repeat",
		description: "Returns a string repeated the specified number of times.",
		origin: "authored",
	},
	replace: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_replace",
		description: "Replaces all occurrences of a substring with a replacement string.",
		origin: "authored",
	},
	reverse: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_reverse",
		description: "Returns a string with characters in reverse order.",
		origin: "authored",
	},
	right: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_right",
		description: "Returns the rightmost specified number of characters from a string.",
		origin: "authored",
	},
	roles_graphml: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_roles-graphml",
		origin: "vendor-docs",
	},
	round: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_round",
		description: "Rounds a number to the nearest integer or to a specified number of decimal places.",
		origin: "authored",
	},
	row_count: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_row-count",
		origin: "vendor-docs",
	},
	row_number: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html#function_row-number",
		description: "Returns the sequential row number within a partition in a result set.",
		origin: "authored",
	},
	rpad: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_rpad",
		description: "Right-pads a string to the specified length with a padding string.",
		origin: "authored",
	},
	rtrim: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_rtrim",
		description: "Removes trailing spaces from a string.",
		origin: "authored",
	},
	schema: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_schema",
		description: "Returns the name of the current database selected for the session.",
		origin: "authored",
	},
	sec_to_time: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_sec-to-time",
		description: "Converts a number of seconds to TIME format (HHH:MM:SS).",
		origin: "authored",
	},
	second: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_second",
		description: "Extracts the second component (0-59) from a time or datetime expression.",
		origin: "authored",
	},
	session_user: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_session-user",
		description: "Returns the user name and host of the current session (equivalent to USER()).",
		origin: "authored",
	},
	sha: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/encryption-functions.html",
		description: "Computes the SHA-1 cryptographic hash of a string, returning a hexadecimal string.",
		origin: "authored",
	},
	sha1: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/encryption-functions.html#function_sha1",
		description: "Computes the SHA-1 cryptographic hash of a string, returning a 40-character hexadecimal value.",
		origin: "authored",
	},
	sha2: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/encryption-functions.html#function_sha2",
		description:
			"Computes the SHA-2 cryptographic hash (SHA-224, SHA-256, SHA-384, or SHA-512) specified by hash_length.",
		origin: "authored",
	},
	sign: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_sign",
		description: "Returns -1 for negative numbers, 0 for zero, and 1 for positive numbers.",
		origin: "authored",
	},
	sin: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_sin",
		description: "Returns the sine of a value in radians.",
		origin: "authored",
	},
	sleep: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_sleep",
		description: "Pauses execution for the specified number of seconds, returning 0 on success.",
		origin: "authored",
	},
	soundex: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_soundex",
		origin: "vendor-docs",
	},
	space: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_space",
		description: "Returns a string consisting of the specified number of space characters.",
		origin: "authored",
	},
	sqrt: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_sqrt",
		description: "Returns the square root of a non-negative number.",
		origin: "authored",
	},
	statement_digest: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/encryption-functions.html#function_statement-digest",
		origin: "vendor-docs",
	},
	statement_digest_text: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/encryption-functions.html#function_statement-digest-text",
		origin: "vendor-docs",
	},
	std: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_std",
		origin: "vendor-docs",
	},
	stddev: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_stddev",
		origin: "vendor-docs",
	},
	stddev_pop: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_stddev-pop",
		description: "Returns the population standard deviation calculated over all values in a set.",
		origin: "authored",
	},
	stddev_samp: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_stddev-samp",
		description: "Returns the sample standard deviation calculated over values in a set.",
		origin: "authored",
	},
	str_to_date: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_str-to-date",
		origin: "vendor-docs",
	},
	strcmp: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-comparison-functions.html#function_strcmp",
		description:
			"Compares two strings lexicographically, returning 0 if equal, negative if first is less, positive if greater.",
		origin: "authored",
	},
	subdate: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_subdate",
		description: "Returns a date with an interval subtracted from it.",
		origin: "authored",
	},
	substr: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_substr",
		description: "Returns the substring of str starting at pos, optionally limited to len characters.",
		origin: "authored",
	},
	substring: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_substring",
		description: "Returns the substring of str starting at pos, optionally limited to len characters.",
		origin: "authored",
	},
	substring_index: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_substring-index",
		description: "Returns the substring before the nth occurrence of delimiter, or after if count is negative.",
		origin: "authored",
	},
	subtime: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_subtime",
		description: "Subtracts a time interval from expr1 and returns the result as a time or datetime.",
		origin: "authored",
	},
	sum: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_sum",
		origin: "vendor-docs",
	},
	sysdate: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_sysdate",
		description: "Returns the current date and time at the moment of statement execution.",
		origin: "authored",
	},
	system_user: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_system-user",
		origin: "vendor-docs",
	},
	tan: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_tan",
		description: "Returns the tangent of the angle argument in radians.",
		origin: "authored",
	},
	time: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_time",
		description: "Extracts the time portion of a datetime expression or converts an expression to a TIME value.",
		origin: "authored",
	},
	time_format: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_time-format",
		description: "Formats a time value according to the specified format string.",
		origin: "authored",
	},
	time_to_sec: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_time-to-sec",
		description: "Returns the number of seconds from midnight for the given time value.",
		origin: "authored",
	},
	timediff: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_timediff",
		description: "Returns the time difference between two time or datetime expressions.",
		origin: "authored",
	},
	timestamp: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_timestamp",
		origin: "vendor-docs",
	},
	timestampadd: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_timestampadd",
		description: "Adds a time interval to a datetime value.",
		origin: "authored",
	},
	timestampdiff: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_timestampdiff",
		description: "Returns the integer difference between two datetime values in the specified unit.",
		origin: "authored",
	},
	to_base64: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_to-base64",
		description: "Encodes a string in base64 format.",
		origin: "authored",
	},
	to_days: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_to-days",
		description: "Converts a date to the number of days since year 0000.",
		origin: "authored",
	},
	to_seconds: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_to-seconds",
		description: "Converts a datetime to the number of seconds since year 0000.",
		origin: "authored",
	},
	truncate: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/mathematical-functions.html#function_truncate",
		description: "Truncates a number to D decimal places.",
		origin: "authored",
	},
	ucase: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_ucase",
		description: "Converts a string to uppercase.",
		origin: "authored",
	},
	uncompress: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/encryption-functions.html#function_uncompress",
		description: "Decompresses a ZLIB-compressed string.",
		origin: "authored",
	},
	uncompressed_length: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/encryption-functions.html#function_uncompressed-length",
		description: "Returns the length of a string before COMPRESS was applied to it.",
		origin: "authored",
	},
	unhex: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_unhex",
		description: "Converts a hexadecimal string to its binary representation.",
		origin: "authored",
	},
	unix_timestamp: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_unix-timestamp",
		description: "Returns the number of seconds since the Unix epoch (1970-01-01 00:00:00 UTC).",
		origin: "authored",
	},
	upper: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_upper",
		description: "Converts a string to uppercase.",
		origin: "authored",
	},
	user: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_user",
		description: "Returns the current user name and host connected to the database.",
		origin: "authored",
	},
	utc_date: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_utc-date",
		description: "Returns the current date in UTC timezone.",
		origin: "authored",
	},
	utc_time: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_utc-time",
		description: "Returns the current time in UTC timezone.",
		origin: "authored",
	},
	utc_timestamp: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_utc-timestamp",
		description: "Returns the current date and time in UTC timezone.",
		origin: "authored",
	},
	uuid: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_uuid",
		description: "Generates a universally unique identifier.",
		origin: "authored",
	},
	uuid_short: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_uuid-short",
		description: "Generates a short UUID as a 64-bit unsigned integer.",
		origin: "authored",
	},
	uuid_to_bin: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_uuid-to-bin",
		description: "Converts a UUID string to a binary representation.",
		origin: "authored",
	},
	validate_password_strength: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/encryption-functions.html#function_validate-password-strength",
		description: "Estimates the strength of a password (requires Validate Password plugin).",
		origin: "authored",
	},
	values: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_values",
		description: "In INSERT...ON DUPLICATE KEY UPDATE, returns the value provided in the INSERT clause.",
		origin: "authored",
	},
	var_pop: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_var-pop",
		description: "Calculates the population variance of an expression.",
		origin: "authored",
	},
	var_samp: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_var-samp",
		description: "Calculates the sample variance of an expression.",
		origin: "authored",
	},
	variance: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_variance",
		origin: "vendor-docs",
	},
	version: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/information-functions.html#function_version",
		description: "Returns the MySQL server version string.",
		origin: "authored",
	},
	week: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_week",
		origin: "vendor-docs",
	},
	weekday: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_weekday",
		description: "Returns the day-of-week index (0=Monday through 6=Sunday) for a date.",
		origin: "authored",
	},
	weekofyear: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_weekofyear",
		description: "Returns the week number (1-53) of a date using ISO 8601 conventions.",
		origin: "authored",
	},
	year: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_year",
		description: "Returns the year portion of a date as a four-digit integer.",
		origin: "authored",
	},
	yearweek: {
		docUrl: "https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_yearweek",
		description:
			"Returns the year and week number combined as a six-digit integer (e.g., 202401 for week 1 of 2024), with optional mode parameter.",
		origin: "authored",
	},
};
