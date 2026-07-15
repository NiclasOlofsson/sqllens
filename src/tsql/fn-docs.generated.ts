// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for tsql (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-15. 205 names (198 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const TSQL_FN_DOCS: Record<string, FnDoc> = {
	abs: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/abs-transact-sql",
		description:
			"A mathematical function that returns the absolute (positive) value of the specified numeric expression.",
		origin: "vendor-docs",
	},
	acos: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/acos-transact-sql",
		description: "A function that returns the angle, in radians, whose cosine is the specified float expression.",
		origin: "vendor-docs",
	},
	any_value: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/any-value-transact-sql",
		description: "The `ANY_VALUE` function returns any (non-`NULL` if possible) value from a group of rows.",
		origin: "vendor-docs",
	},
	app_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/app-name-transact-sql",
		description:
			"This function returns the application name for the current session, if the application sets that name value.",
		origin: "vendor-docs",
	},
	approx_count_distinct: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/approx-count-distinct-transact-sql",
		description: "This function returns the approximate number of unique non-null values in a group.",
		origin: "vendor-docs",
	},
	approx_percentile_cont: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/approx-percentile-cont-transact-sql",
		description:
			"This function returns an approximate interpolated value from the set of values in a group based on percentile value and sort specification.",
		origin: "vendor-docs",
	},
	approx_percentile_disc: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/approx-percentile-disc-transact-sql",
		description:
			"This function returns the value from the set of values in a group based on the provided percentile and sort specification.",
		origin: "vendor-docs",
	},
	ascii: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/ascii-transact-sql",
		description: "Returns the ASCII code value of the leftmost character of a character expression.",
		origin: "vendor-docs",
	},
	asin: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/asin-transact-sql",
		description: "A function that returns the angle, in radians, whose sine is the specified **float** expression.",
		origin: "vendor-docs",
	},
	atan: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/atan-transact-sql",
		description:
			"A function that returns the angle, in radians, whose tangent is a specified **float** expression.",
		origin: "vendor-docs",
	},
	atn2: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/atn2-transact-sql",
		description:
			"Returns the angle, in radians, between the positive x-axis and the ray from the origin to the point (y, x), where x and y are the values of the two specified float expressions.",
		origin: "vendor-docs",
	},
	avg: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/avg-transact-sql",
		description: "This function returns the average of the values in a group.",
		origin: "vendor-docs",
	},
	base64_decode: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/base64-decode-transact-sql",
		description:
			"`BASE64_DECODE` converts a Base64-encoded **varchar** expression into the corresponding **varbinary** expression.",
		origin: "vendor-docs",
	},
	base64_encode: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/base64-encode-transact-sql",
		description:
			"`BASE64_ENCODE` converts the value of a **varbinary** expression into a Base64-encoded **varchar** expression.",
		origin: "vendor-docs",
	},
	bit_count: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/bit-count-transact-sql",
		description:
			"`BIT_COUNT` takes one parameter and returns the number of bits set to 1 in that parameter as a **bigint** type.",
		origin: "vendor-docs",
	},
	cast: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/cast-and-convert-transact-sql",
		origin: "vendor-docs",
	},
	ceiling: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/ceiling-transact-sql",
		description:
			"This function returns the smallest integer greater than, or equal to, the specified numeric expression.",
		origin: "vendor-docs",
	},
	certencoded: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/certencoded-transact-sql",
		description: "This function returns the public portion of a certificate in binary format.",
		origin: "vendor-docs",
	},
	char: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/char-transact-sql",
		description:
			"Returns the single-byte character with the specified integer code, as defined by the character set and encoding of the default collation of the current database.",
		origin: "vendor-docs",
	},
	charindex: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/charindex-transact-sql",
		description:
			"This function searches for one character expression inside a second character expression, returning the starting position of the first expression if found.",
		origin: "vendor-docs",
	},
	checksum_agg: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/checksum-agg-transact-sql",
		description: "This function returns the checksum of the values in a group.",
		origin: "vendor-docs",
	},
	choose: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/logical-functions-choose-transact-sql",
		origin: "vendor-docs",
	},
	coalesce: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/language-elements/coalesce-transact-sql",
		description:
			"Evaluates the arguments in order and returns the current value of the first expression that initially doesn't evaluate to `NULL`.",
		origin: "vendor-docs",
	},
	col_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/col-name-transact-sql",
		description:
			"This function returns the name of a table column, based on the table identification number and column identification number values of that table column.",
		origin: "vendor-docs",
	},
	collationproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/collation-functions-collationproperty-transact-sql",
		description: "This function returns the requested property of a specified collation.",
		origin: "vendor-docs",
	},
	columnproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/columnproperty-transact-sql",
		description: "This function returns column or parameter information.",
		origin: "vendor-docs",
	},
	columns_updated: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/columns-updated-transact-sql",
		description:
			"This function returns a **varbinary** bit pattern indicating the inserted or updated columns of a table or view.",
		origin: "vendor-docs",
	},
	compress: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/compress-transact-sql",
		description: "This function compresses the input expression, using the **Gzip** algorithm.",
		origin: "vendor-docs",
	},
	concat: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/concat-transact-sql",
		description:
			"This function returns a string resulting from the concatenation, or joining, of two or more string values in an end-to-end manner.",
		origin: "vendor-docs",
	},
	concat_ws: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/concat-ws-transact-sql",
		description:
			"This function returns a string resulting from the concatenation, or joining, of two or more string values in an end-to-end manner.",
		origin: "vendor-docs",
	},
	connectionproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/connectionproperty-transact-sql",
		description:
			"For a request that comes in to the server, this function returns information about the connection properties of the unique connection which supports that request.",
		origin: "vendor-docs",
	},
	context_info: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/context-info-transact-sql",
		description:
			"This function returns the **context_info** value either set for the current session or batch, or derived through use of the SET CONTEXT_INFO statement.",
		origin: "vendor-docs",
	},
	convert: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/cast-and-convert-transact-sql",
		origin: "vendor-docs",
	},
	cos: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/cos-transact-sql",
		description:
			"A mathematical function that returns the trigonometric cosine of the specified angle - measured in radians - in the specified expression.",
		origin: "vendor-docs",
	},
	cot: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/cot-transact-sql",
		description:
			"A mathematical function that returns the trigonometric cotangent of the specified angle - in radians - in the specified **float** expression.",
		origin: "vendor-docs",
	},
	count: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/count-transact-sql",
		origin: "vendor-docs",
	},
	crypt_gen_random: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/crypt-gen-random-transact-sql",
		description:
			"This function returns a cryptographic, randomly-generated number, generated by the Crypto API (CAPI).",
		origin: "vendor-docs",
	},
	cume_dist: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/cume-dist-transact-sql",
		description:
			"For !INCLUDE[ssNoVersion], this function calculates the cumulative distribution of a value within a group of values.",
		origin: "vendor-docs",
	},
	current_request_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/current-request-id-transact-sql",
		description: "This function returns the ID of the current request within the current session.",
		origin: "vendor-docs",
	},
	current_timezone: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/current-timezone-transact-sql",
		description: "This function returns the name of the time zone observed by a server or an instance.",
		origin: "vendor-docs",
	},
	current_timezone_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/current-timezone-id-transact-sql",
		description: "This function returns the ID of the time zone observed by a server or an instance.",
		origin: "vendor-docs",
	},
	current_transaction_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/current-transaction-id-transact-sql",
		description: "This function returns the transaction ID of the current transaction in the current session.",
		origin: "vendor-docs",
	},
	databasepropertyex: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/databasepropertyex-transact-sql",
		description:
			"For a specified database in !INCLUDE [ssNoVersion], the `DATABASEPROPERTYEX` function returns the current setting of the specified database option or property.",
		origin: "vendor-docs",
	},
	datalength: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datalength-transact-sql",
		description: "This function returns the number of bytes used to represent any expression.",
		origin: "vendor-docs",
	},
	date_bucket: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/date-bucket-transact-sql",
		description:
			"This function returns the date-time value corresponding to the start of each date-time bucket from the timestamp defined by the *origin* parameter, or the default origin value of `1900-01-01 00:00:00.000` if the origin parameter isn't specified.",
		origin: "vendor-docs",
	},
	dateadd: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/dateadd-transact-sql",
		description:
			"This function adds a *number* (a signed integer) to a *datepart* of an input *date*, and returns a modified date/time value.",
		origin: "vendor-docs",
	},
	datediff: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datediff-transact-sql",
		description:
			"This function returns the count (as a signed integer value) of the specified datepart boundaries crossed between the specified *startdate* and *enddate*.",
		origin: "vendor-docs",
	},
	datediff_big: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datediff-big-transact-sql",
		description:
			"This function returns the count (as a signed big integer value) of the specified *datepart* boundaries crossed between the specified *startdate* and *enddate*.",
		origin: "vendor-docs",
	},
	datefromparts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datefromparts-transact-sql",
		description: "This function returns a **date** value that maps to the specified year, month, and day values.",
		origin: "vendor-docs",
	},
	datename: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datename-transact-sql",
		description:
			"This function returns a character string representing the specified *datepart* of the specified *date*.",
		origin: "vendor-docs",
	},
	datepart: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datepart-transact-sql",
		description: "This function returns an integer representing the specified *datepart* of the specified *date*.",
		origin: "vendor-docs",
	},
	datetime2fromparts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datetime2fromparts-transact-sql",
		description: "This function returns a **datetime2** value for the specified date and time arguments.",
		origin: "vendor-docs",
	},
	datetimefromparts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datetimefromparts-transact-sql",
		description: "This function returns a **datetime** value for the specified date and time arguments.",
		origin: "vendor-docs",
	},
	datetimeoffsetfromparts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datetimeoffsetfromparts-transact-sql",
		description: "Returns a **datetimeoffset** value for the specified date and time arguments.",
		origin: "vendor-docs",
	},
	datetrunc: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/datetrunc-transact-sql",
		description: "The `DATETRUNC` function returns an input *date* truncated to a specified *datepart*.",
		origin: "vendor-docs",
	},
	day: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/day-transact-sql",
		description:
			"This function returns an integer that represents the day (day of the month) of the specified *date*.",
		origin: "vendor-docs",
	},
	db_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/db-name-transact-sql",
		description: "This function returns the name of a specified database.",
		origin: "vendor-docs",
	},
	decompress: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/decompress-transact-sql",
		description: "This function decompresses an input expression value, using the **Gzip** algorithm.",
		origin: "vendor-docs",
	},
	degrees: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/degrees-transact-sql",
		description: "This function returns the corresponding angle, in degrees, for an angle specified in radians.",
		origin: "vendor-docs",
	},
	dense_rank: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/dense-rank-transact-sql",
		description:
			"This function returns the rank of each row within a result set partition, with no gaps in the ranking values.",
		origin: "vendor-docs",
	},
	difference: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/difference-transact-sql",
		description:
			"This function returns an integer value measuring the difference between the SOUNDEX() values of two different character expressions.",
		origin: "vendor-docs",
	},
	edge_id_from_parts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/edge-id-from-parts-transact-sql",
		description: "Returns the character representation (JSON) of the edge ID for a given object ID and graph ID.",
		origin: "vendor-docs",
	},
	eomonth: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/eomonth-transact-sql",
		description:
			"This function returns the last day of the month containing a specified date, with an optional offset.",
		origin: "vendor-docs",
	},
	error_line: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/error-line-transact-sql",
		description:
			"This function returns the line number of occurrence of an error that caused the CATCH block of a TRY...CATCH construct to execute.",
		origin: "vendor-docs",
	},
	error_message: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/error-message-transact-sql",
		description:
			"This function returns the message text of the error that caused the CATCH block of a TRY...CATCH construct to execute.",
		origin: "vendor-docs",
	},
	error_number: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/error-number-transact-sql",
		description:
			"This function returns the error number of the error that caused the CATCH block of a TRY...CATCH construct to execute.",
		origin: "vendor-docs",
	},
	error_procedure: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/error-procedure-transact-sql",
		description:
			"This function returns the name of the stored procedure or trigger where an error occurs, if that error caused the `CATCH` block of a `TRY...CATCH` construct to execute.",
		origin: "vendor-docs",
	},
	error_severity: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/error-severity-transact-sql",
		description:
			"This function returns the severity value of the error where an error occurs, if that error caused the `CATCH` block of a `TRY...CATCH` construct to execute.",
		origin: "vendor-docs",
	},
	error_state: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/error-state-transact-sql",
		description:
			"Returns the state number of the error that caused the CATCH block of a TRY...CATCH construct to be run.",
		origin: "vendor-docs",
	},
	eventdata: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/eventdata-transact-sql",
		description: "This function returns information about server or database events.",
		origin: "vendor-docs",
	},
	exp: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/exp-transact-sql",
		description: "Returns the exponential value of the specified **float** expression.",
		origin: "vendor-docs",
	},
	file_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/file-id-transact-sql",
		description:
			"For the given logical name for a component file of the current database, this function returns the file identification (ID) number.",
		origin: "vendor-docs",
	},
	file_idex: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/file-idex-transact-sql",
		description:
			"This function returns the file identification (ID) number for the specified logical name of a data, log, or full-text file of the current database.",
		origin: "vendor-docs",
	},
	file_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/file-name-transact-sql",
		description:
			"This function returns the logical file name for a given file identification (ID) number, in the context of the current database.",
		origin: "vendor-docs",
	},
	filegroup_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/filegroup-name-transact-sql",
		description: "This function returns the filegroup name for the specified filegroup identification (ID) number.",
		origin: "vendor-docs",
	},
	filegroupproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/filegroupproperty-transact-sql",
		description: "This function returns the filegroup property value for a specified name and filegroup value.",
		origin: "vendor-docs",
	},
	fileproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/fileproperty-transact-sql",
		description:
			"Returns the specified file name property value when a file name in the current database and a property name are specified.",
		origin: "vendor-docs",
	},
	filepropertyex: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/filepropertyex-transact-sql",
		description:
			"Returns the specified extended file property value when a file name in the current database and a property name are specified.",
		origin: "vendor-docs",
	},
	first_value: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/first-value-transact-sql",
		description: "Returns the first value in an ordered set of values.",
		origin: "vendor-docs",
	},
	floor: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/floor-transact-sql",
		description: "Returns the largest integer less than or equal to the specified numeric expression.",
		origin: "vendor-docs",
	},
	format: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/format-transact-sql",
		description: "Returns a value formatted with the specified format and optional culture.",
		origin: "vendor-docs",
	},
	generate_series: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/generate-series-transact-sql",
		description: "Generates a series of numbers within a given interval.",
		origin: "vendor-docs",
	},
	get_bit: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/get-bit-transact-sql",
		description:
			"`GET_BIT` takes two parameters and returns the bit in *expression_value* that is in the offset defined by *bit_offset*.",
		origin: "vendor-docs",
	},
	get_filestream_transaction_context: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/get-filestream-transaction-context-transact-sql",
		description: "Returns a token that represents the current transaction context of a session.",
		origin: "vendor-docs",
	},
	getdate: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/getdate-transact-sql",
		description:
			"Returns the current database system timestamp as a **datetime** value without the database time zone offset.",
		origin: "vendor-docs",
	},
	getutcdate: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/getutcdate-transact-sql",
		description: "Returns the current database system timestamp as a **datetime** value.",
		origin: "vendor-docs",
	},
	graph_id_from_edge_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/graph-id-from-edge-id-transact-sql",
		description: "Returns the internal graph ID for a given edge ID.",
		origin: "vendor-docs",
	},
	graph_id_from_node_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/graph-id-from-node-id-transact-sql",
		description: "Returns the internal graph ID for a given node ID.",
		origin: "vendor-docs",
	},
	greatest: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/logical-functions-greatest-transact-sql",
		description: "This function returns the maximum value from a list of one or more expressions.",
		origin: "vendor-docs",
	},
	host_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/host-id-transact-sql",
		description: "Returns the workstation identification number.",
		origin: "vendor-docs",
	},
	host_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/host-name-transact-sql",
		description: "Returns the workstation name.",
		origin: "vendor-docs",
	},
	iif: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/logical-functions-iif-transact-sql",
		description:
			"Returns one of two values, depending on whether the Boolean expression evaluates to true or false in !INCLUDE[ssNoVersion].",
		origin: "vendor-docs",
	},
	indexkey_property: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/indexkey-property-transact-sql",
		description: "Returns information about the index key.",
		origin: "vendor-docs",
	},
	indexproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/indexproperty-transact-sql",
		description:
			"Returns the named index or statistics property value of a specified table identification number, index or statistics name, and property name.",
		origin: "vendor-docs",
	},
	isdate: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/isdate-transact-sql",
		description: "Returns 1 if the *expression* is a valid **datetime** value; otherwise, 0.",
		origin: "vendor-docs",
	},
	isjson: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/isjson-transact-sql",
		description: "The `ISJSON` syntax tests whether a string contains valid JSON.",
		origin: "vendor-docs",
	},
	isnull: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/isnull-transact-sql",
		description: "Replaces `NULL` with the specified replacement value.",
		origin: "vendor-docs",
	},
	isnumeric: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/isnumeric-transact-sql",
		description: "Determines whether an expression is a valid numeric type.",
		origin: "vendor-docs",
	},
	json_contains: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/json-contains-transact-sql",
		description: "Searches for a SQL value in a path in a JSON document.",
		origin: "vendor-docs",
	},
	json_modify: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/json-modify-transact-sql",
		description:
			"The `JSON_MODIFY` syntax updates the value of a property in a JSON string and returns the updated JSON string.",
		origin: "vendor-docs",
	},
	json_path_exists: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/json-path-exists-transact-sql",
		description:
			"The `JSON_PATH_EXISTS` syntax tests whether a specified SQL/JSON path exists in the input JSON string.",
		origin: "vendor-docs",
	},
	json_value: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/json-value-transact-sql",
		description: "Use the `JSON_VALUE` syntax to extract a scalar value from a JSON string.",
		origin: "vendor-docs",
	},
	lag: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/lag-transact-sql",
		description:
			"Accesses data from a previous row in the same result set without the use of a self-join starting with !INCLUDE[ssSQL11].",
		origin: "vendor-docs",
	},
	last_value: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/last-value-transact-sql",
		description: "Returns the last value in an ordered set of values.",
		origin: "vendor-docs",
	},
	lead: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/lead-transact-sql",
		description:
			"Accesses data from a subsequent row in the same result set without the use of a self-join starting with !INCLUDE [ssSQL11].",
		origin: "vendor-docs",
	},
	least: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/logical-functions-least-transact-sql",
		description: "This function returns the minimum value from a list of one or more expressions.",
		origin: "vendor-docs",
	},
	left: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/left-transact-sql",
		description: "Returns the left part of a character string with the specified number of characters.",
		origin: "vendor-docs",
	},
	left_shift: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/left-shift-transact-sql",
		description:
			"`LEFT_SHIFT` takes two parameters, and returns the first parameter bit-shifted left by the number of bits specified in the second parameter.",
		origin: "vendor-docs",
	},
	len: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/len-transact-sql",
		description: "Returns the number of characters of the specified string expression, excluding trailing spaces.",
		origin: "vendor-docs",
	},
	log: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/log-transact-sql",
		description: "Returns the natural logarithm of the specified **float** expression in !INCLUDE[ssNoVersion].",
		origin: "vendor-docs",
	},
	log10: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/log10-transact-sql",
		description: "Returns the base-10 logarithm of the specified **float** expression.",
		origin: "vendor-docs",
	},
	lower: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/lower-transact-sql",
		description: "Returns a character expression after converting uppercase character data to lowercase.",
		origin: "vendor-docs",
	},
	ltrim: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/ltrim-transact-sql",
		description: "Returns a character string after truncating all leading spaces.",
		origin: "vendor-docs",
	},
	max: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/max-transact-sql",
		description: "Returns the maximum of all values of the specified expression in a group.",
		origin: "vendor-docs",
	},
	min: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/min-transact-sql",
		description: "Returns the minimum of all values of the specified expression in a group.",
		origin: "vendor-docs",
	},
	min_active_rowversion: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/min-active-rowversion-transact-sql",
		description: "Returns the lowest active **rowversion** value in the current database.",
		origin: "vendor-docs",
	},
	month: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/month-transact-sql",
		description: "Returns an integer that represents the month of the specified *date*.",
		origin: "vendor-docs",
	},
	nchar: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/nchar-transact-sql",
		description:
			"Returns the Unicode character with the specified integer code, as defined by the Unicode standard.",
		origin: "vendor-docs",
	},
	newid: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/newid-transact-sql",
		description: "Creates a unique value of type **uniqueidentifier**.",
		origin: "vendor-docs",
	},
	newsequentialid: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/newsequentialid-transact-sql",
		description:
			"Creates a GUID that is greater than any GUID previously generated by this function on a specified computer since Windows was started.",
		origin: "vendor-docs",
	},
	node_id_from_parts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/node-id-from-parts-transact-sql",
		description: "Returns the character representation (JSON) of the node ID for a given object ID and graph ID.",
		origin: "vendor-docs",
	},
	ntile: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/ntile-transact-sql",
		description: "Distributes the rows in an ordered partition into a specified number of groups.",
		origin: "vendor-docs",
	},
	nullif: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/language-elements/nullif-transact-sql",
		origin: "vendor-docs",
	},
	object_definition: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/object-definition-transact-sql",
		description: "Returns the !INCLUDE[tsql] source text of the definition of a specified object.",
		origin: "vendor-docs",
	},
	object_id_from_edge_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/object-id-from-edge-id-transact-sql",
		description: "Returns the object ID for a given graph edge ID.",
		origin: "vendor-docs",
	},
	object_id_from_node_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/object-id-from-node-id-transact-sql",
		description: "Returns the object ID for a given graph node ID.",
		origin: "vendor-docs",
	},
	object_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/object-name-transact-sql",
		description: "Returns the database object name for schema-scoped objects.",
		origin: "vendor-docs",
	},
	object_schema_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/object-schema-name-transact-sql",
		description: "Returns the database schema name for schema-scoped objects.",
		origin: "vendor-docs",
	},
	objectproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/objectproperty-transact-sql",
		description: "Returns information about schema-scoped objects in the current database.",
		origin: "vendor-docs",
	},
	objectpropertyex: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/objectpropertyex-transact-sql",
		description:
			"The `OBJECTPROPERTYEX` function returns information about schema-scoped objects in the current database.",
		origin: "vendor-docs",
	},
	openjson: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/openjson-transact-sql",
		description:
			"The `OPENJSON` table-valued function parses JSON text and returns objects and properties from the JSON input as rows and columns.",
		origin: "vendor-docs",
	},
	original_db_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/original-db-name-transact-sql",
		description: "Returns the database name specified by the user in the database connection string.",
		origin: "vendor-docs",
	},
	original_login: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/original-login-transact-sql",
		description: "Returns the name of the login that connected to the instance of !INCLUDE[ssNoVersion].",
		origin: "vendor-docs",
	},
	percent_rank: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/percent-rank-transact-sql",
		description: "Calculates the relative rank of a row within a group of rows in !INCLUDE [ssnoversion].",
		origin: "vendor-docs",
	},
	percentile_cont: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/percentile-cont-transact-sql",
		description:
			"Calculates a percentile based on a continuous distribution of the column value in the !INCLUDE [ssdenoversion-md].",
		origin: "vendor-docs",
	},
	percentile_disc: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/percentile-disc-transact-sql",
		description:
			"Computes a specific percentile for sorted values in an entire rowset or within a rowset's distinct partitions in !INCLUDE [ssNoVersion].",
		origin: "vendor-docs",
	},
	pi: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/pi-transact-sql",
		description: "Returns the constant value of PI.",
		origin: "vendor-docs",
	},
	power: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/power-transact-sql",
		description: "Returns the value of the specified expression to the specified power.",
		origin: "vendor-docs",
	},
	product: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/product-aggregate-transact-sql",
		description:
			"The `PRODUCT` function returns the product of all the values, or only the `DISTINCT` values, in an expression.",
		origin: "vendor-docs",
	},
	publishingservername: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/replication-functions-publishingservername",
		description:
			"Returns the name of the originating Publisher for a published database participating in a database mirroring session.",
		origin: "vendor-docs",
	},
	radians: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/radians-transact-sql",
		description: "Returns radians when a numeric expression, in degrees, is entered.",
		origin: "vendor-docs",
	},
	rand: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/rand-transact-sql",
		description: "Returns a pseudo-random **float** value from `0` through `1`, exclusive.",
		origin: "vendor-docs",
	},
	rank: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/rank-transact-sql",
		description: "Returns the rank of each row within the partition of a result set.",
		origin: "vendor-docs",
	},
	replace: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/replace-transact-sql",
		description: "Replaces all occurrences of a specified string value with another string value.",
		origin: "vendor-docs",
	},
	replicate: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/replicate-transact-sql",
		description: "Repeats a string value a specified number of times.",
		origin: "vendor-docs",
	},
	reverse: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/reverse-transact-sql",
		description: "Returns the reverse order of a string value.",
		origin: "vendor-docs",
	},
	right: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/right-transact-sql",
		description: "Returns the right part of a character string with the specified number of characters.",
		origin: "vendor-docs",
	},
	right_shift: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/right-shift-transact-sql",
		description:
			"`RIGHT_SHIFT` takes two parameters, and returns the first parameter bit-shifted right by the number of bits specified in the second parameter.",
		origin: "vendor-docs",
	},
	round: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/round-transact-sql",
		description: "Returns a numeric value, rounded to the specified length or precision.",
		origin: "vendor-docs",
	},
	row_number: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/row-number-transact-sql",
		description: "Numbers the output of a result set.",
		origin: "vendor-docs",
	},
	rowcount_big: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/rowcount-big-transact-sql",
		description: "Returns the number of rows affected by the last statement executed.",
		origin: "vendor-docs",
	},
	rtrim: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/rtrim-transact-sql",
		description: "Returns a character string after truncating all trailing spaces.",
		origin: "vendor-docs",
	},
	schema_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/schema-id-transact-sql",
		description: "Returns the schema ID associated with a schema name.",
		origin: "vendor-docs",
	},
	schema_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/schema-name-transact-sql",
		description: "Returns the schema name associated with a schema ID.",
		origin: "vendor-docs",
	},
	scope_identity: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/scope-identity-transact-sql",
		description: "Returns the last identity value inserted into an identity column in the same scope.",
		origin: "vendor-docs",
	},
	session_id: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/session-id-transact-sql",
		description: "Returns the ID of the current !INCLUDE[ssazuresynapse-md] or !INCLUDE[ssPDW_md] session.",
		origin: "vendor-docs",
	},
	sessionproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sessionproperty-transact-sql",
		description: "Returns the SET options settings of a session.",
		origin: "vendor-docs",
	},
	set_bit: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/set-bit-transact-sql",
		description: "`SET_BIT` returns *expression_value* offset by the bit defined by *bit_offset*.",
		origin: "vendor-docs",
	},
	sign: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sign-transact-sql",
		description: "Returns the positive (+1), zero (0), or negative (-1) sign of the specified expression.",
		origin: "vendor-docs",
	},
	sin: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sin-transact-sql",
		description:
			"Returns the trigonometric sine of the specified angle, in radians, and in an approximate numeric, **float**, expression.",
		origin: "vendor-docs",
	},
	smalldatetimefromparts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/smalldatetimefromparts-transact-sql",
		description: "Returns a **smalldatetime** value for the specified date and time.",
		origin: "vendor-docs",
	},
	soundex: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/soundex-transact-sql",
		description: "Returns a four-character (`SOUNDEX`) code to evaluate the similarity of two strings.",
		origin: "vendor-docs",
	},
	space: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/space-transact-sql",
		description: "Returns a string of repeated spaces.",
		origin: "vendor-docs",
	},
	sql_variant_property: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sql-variant-property-transact-sql",
		description: "Returns the base data type and other information about a **sql_variant** value.",
		origin: "vendor-docs",
	},
	sqrt: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sqrt-transact-sql",
		description: "Returns the square root of the specified float value.",
		origin: "vendor-docs",
	},
	square: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/square-transact-sql",
		description: "Returns the square of the specified float value.",
		origin: "vendor-docs",
	},
	stats_date: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/stats-date-transact-sql",
		description: "Returns the date of the most recent update for statistics on a table or indexed view.",
		origin: "vendor-docs",
	},
	stdev: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/stdev-transact-sql",
		description: "Returns the statistical standard deviation of all values in the specified expression.",
		origin: "vendor-docs",
	},
	stdevp: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/stdevp-transact-sql",
		description:
			"Returns the statistical standard deviation for the population for all values in the specified expression.",
		origin: "vendor-docs",
	},
	string_agg: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/string-agg-transact-sql",
		description: "Concatenates the values of string expressions and places separator values between them.",
		origin: "vendor-docs",
	},
	string_escape: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/string-escape-transact-sql",
		description: "Escapes special characters in texts and returns text with escaped characters.",
		origin: "vendor-docs",
	},
	string_split: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/string-split-transact-sql",
		description:
			"`STRING_SPLIT` is a table-valued function that splits a string into rows of substrings, based on a specified separator character.",
		origin: "vendor-docs",
	},
	stuff: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/stuff-transact-sql",
		description: "The STUFF function inserts a string into another string.",
		origin: "vendor-docs",
	},
	substring: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/substring-transact-sql",
		description: "Returns part of a character, binary, text, or image expression in !INCLUDE [ssNoVersion].",
		origin: "vendor-docs",
	},
	sum: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sum-transact-sql",
		description: "Returns the sum of all the values, or only the `DISTINCT` values, in the expression.",
		origin: "vendor-docs",
	},
	suser_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/suser-name-transact-sql",
		description: "Returns the login identification name of the user.",
		origin: "vendor-docs",
	},
	suser_sname: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/suser-sname-transact-sql",
		description: "Returns the login name associated with a security identification number (SID).",
		origin: "vendor-docs",
	},
	switchoffset: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/switchoffset-transact-sql",
		description:
			"Returns a **datetimeoffset** value that is changed from the stored time zone offset to a specified new time zone offset.",
		origin: "vendor-docs",
	},
	sysdatetime: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sysdatetime-transact-sql",
		description:
			"Returns a **datetime2(7)** value that contains the date and time of the computer on which the instance of !INCLUDE[ssNoVersion] is running.",
		origin: "vendor-docs",
	},
	sysdatetimeoffset: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sysdatetimeoffset-transact-sql",
		description:
			"Returns a **datetimeoffset(7)** value that contains the date and time of the computer on which the instance of !INCLUDE[ssNoVersion] is running.",
		origin: "vendor-docs",
	},
	sysutcdatetime: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/sysutcdatetime-transact-sql",
		description:
			"Returns a **datetime2** value that contains the date and time of the computer on which the instance of !INCLUDE [ssNoVersion] is running.",
		origin: "vendor-docs",
	},
	tan: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/tan-transact-sql",
		description: "Returns the tangent of the input expression.",
		origin: "vendor-docs",
	},
	tertiary_weights: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/collation-functions-tertiary-weights-transact-sql",
		description:
			"For each character in a non-Unicode string expression - defined with a SQL tertiary collation - this function returns a binary string of weights.",
		origin: "vendor-docs",
	},
	textptr: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/text-and-image-functions-textptr-transact-sql",
		description:
			"Returns the text-pointer value that corresponds to a **text**, **ntext**, or **image** column in **varbinary** format.",
		origin: "vendor-docs",
	},
	timefromparts: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/timefromparts-transact-sql",
		description: "Returns a **time** value for the specified time and with the specified precision.",
		origin: "vendor-docs",
	},
	todatetimeoffset: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/todatetimeoffset-transact-sql",
		description: "Returns a **datetimeoffset** value that is translated from a **datetime2** expression.",
		origin: "vendor-docs",
	},
	translate: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/translate-transact-sql",
		description:
			"Returns the string provided as a first argument, after some characters specified in the second argument are translated into a destination set of characters, specified in the third argument.",
		origin: "vendor-docs",
	},
	trim: { docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/trim-transact-sql", origin: "vendor-docs" },
	try_convert: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/try-convert-transact-sql",
		origin: "vendor-docs",
	},
	type_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/type-name-transact-sql",
		description: "Returns the unqualified type name of a specified type ID.",
		origin: "vendor-docs",
	},
	typeproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/typeproperty-transact-sql",
		description: "Returns information about a data type.",
		origin: "vendor-docs",
	},
	update: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/update-trigger-functions-transact-sql",
		description:
			"Returns a Boolean value that indicates whether an INSERT or UPDATE attempt was made on a specified column of a table or view.",
		origin: "vendor-docs",
	},
	upper: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/upper-transact-sql",
		description: "Returns a character expression with lowercase character data converted to uppercase.",
		origin: "vendor-docs",
	},
	user_name: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/user-name-transact-sql",
		description: "Returns a database user name from a specified identification number, or the current user name.",
		origin: "vendor-docs",
	},
	var: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/var-transact-sql",
		description: "Returns the statistical variance of all values in the specified expression.",
		origin: "vendor-docs",
	},
	varp: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/varp-transact-sql",
		description: "Returns the statistical variance for the population for all values in the specified expression.",
		origin: "vendor-docs",
	},
	vector_distance: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/vector-distance-transact-sql",
		description:
			"The `VECTOR_DISTANCE` function calculates the distance between two vectors using a specified distance metric.",
		origin: "vendor-docs",
	},
	vector_norm: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/vector-norm-transact-sql",
		description:
			"Use `VECTOR_NORM` to take a vector as an input and return the norm of the vector (which is a measure of its length or magnitude) in a given norm type.",
		origin: "vendor-docs",
	},
	vector_normalize: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/vector-normalize-transact-sql",
		description:
			"Use `VECTOR_NORMALIZE` to take a vector as an input and return the normalized vector, which is a vector scaled to have a length of 1 in a given norm type.",
		origin: "vendor-docs",
	},
	vectorproperty: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/vectorproperty-transact-sql",
		description: "The `VECTORPROPERTY` function returns specific properties of a given vector.",
		origin: "vendor-docs",
	},
	verifysignedbyasymkey: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/verifysignedbyasymkey-transact-sql",
		description: "Tests whether digitally signed data has been changed since it was signed.",
		origin: "vendor-docs",
	},
	verifysignedbycert: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/verifysignedbycert-transact-sql",
		description: "Tests whether digitally signed data has been changed since it was signed.",
		origin: "vendor-docs",
	},
	version: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/version-transact-sql-metadata-functions",
		description:
			"Returns the version of !INCLUDE[ssazuresynapse-md] or !INCLUDE[ssPDW_md] running on the appliance.",
		origin: "vendor-docs",
	},
	xact_state: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/xact-state-transact-sql",
		description: "Is a scalar function that reports the user transaction state of the current session.",
		origin: "vendor-docs",
	},
	year: {
		docUrl: "https://learn.microsoft.com/en-us/sql/t-sql/functions/year-transact-sql",
		description: "Returns an integer that represents the year of the specified *date*.",
		origin: "vendor-docs",
	},
};
