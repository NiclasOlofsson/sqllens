// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for sqlite (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-15. 123 names (121 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const SQLITE_FN_DOCS: Record<string, FnDoc> = {
	abs: {
		docUrl: "https://sqlite.org/lang_corefunc.html#abs",
		description: "The abs(X) function returns the absolute value of the numeric argument X.",
		origin: "vendor-docs",
	},
	acos: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#acos",
		description: "Return the arccosine of X.",
		origin: "vendor-docs",
	},
	acosh: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#acosh",
		description: "Return the hyperbolic arccosine of X.",
		origin: "vendor-docs",
	},
	asin: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#asin",
		description: "Return the arcsine of X.",
		origin: "vendor-docs",
	},
	asinh: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#asinh",
		description: "Return the hyperbolic arcsine of X.",
		origin: "vendor-docs",
	},
	atan: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#atan",
		description: "Return the arctangent of X.",
		origin: "vendor-docs",
	},
	atan2: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#atan2",
		description: "Return the arctangent of Y/X.",
		origin: "vendor-docs",
	},
	atanh: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#atanh",
		description: "Return the hyperbolic arctangent of X.",
		origin: "vendor-docs",
	},
	avg: {
		docUrl: "https://sqlite.org/lang_aggfunc.html#avg",
		description: "The avg() function returns the average value of all non-NULL X within a group.",
		origin: "vendor-docs",
	},
	ceil: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#ceil",
		description: "Return the first representable integer value greater than or equal to X.",
		origin: "vendor-docs",
	},
	ceiling: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#ceil",
		description: "Return the first representable integer value greater than or equal to X.",
		origin: "vendor-docs",
	},
	changes: {
		docUrl: "https://sqlite.org/lang_corefunc.html#changes",
		description:
			"The changes() function returns the number of database rows that were changed or inserted or deleted by the most recently completed INSERT, DELETE, or UPDATE statement, exclusive of statements in lower-level triggers.",
		origin: "vendor-docs",
	},
	coalesce: {
		docUrl: "https://sqlite.org/lang_corefunc.html#coalesce",
		description:
			"The coalesce() function returns a copy of its first non-NULL argument, or NULL if all arguments are NULL.",
		origin: "vendor-docs",
	},
	concat: {
		docUrl: "https://sqlite.org/lang_corefunc.html#concat",
		description:
			"The concat(...) function returns a string which is the concatenation of the string representation of all of its non-NULL arguments.",
		origin: "vendor-docs",
	},
	concat_ws: {
		docUrl: "https://sqlite.org/lang_corefunc.html#concat_ws",
		description:
			"The concat_ws(SEP,...) function returns a string that is the concatenation of all non-null arguments beyond the first argument, using the text value of the first argument as a separator.",
		origin: "vendor-docs",
	},
	cos: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#cos",
		description: "Return the cosine of X.",
		origin: "vendor-docs",
	},
	cosh: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#cosh",
		description: "Return the hyperbolic cosine of X.",
		origin: "vendor-docs",
	},
	count: {
		docUrl: "https://sqlite.org/lang_aggfunc.html#count",
		description: "The count(X) function returns a count of the number of times that X is not NULL in a group.",
		origin: "vendor-docs",
	},
	cume_dist: {
		docUrl: "https://sqlite.org/windowfunctions.html",
		description: "The cumulative distribution.",
		origin: "vendor-docs",
	},
	date: {
		docUrl: "https://sqlite.org/lang_datefunc.html",
		description: "The date() function returns the date as text in this format: YYYY-MM-DD.",
		origin: "vendor-docs",
	},
	datetime: {
		docUrl: "https://sqlite.org/lang_datefunc.html",
		description:
			"The datetime() function returns the date and time formatted as YYYY-MM-DD HH:MM:SS or as YYYY-MM-DD HH:MM:SS.",
		origin: "vendor-docs",
	},
	degrees: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#degrees",
		description: "Convert value X from radians into degrees.",
		origin: "vendor-docs",
	},
	dense_rank: {
		docUrl: "https://sqlite.org/windowfunctions.html",
		description:
			"The number of the current row's peer group within its partition - the rank of the current row without gaps.",
		origin: "vendor-docs",
	},
	exp: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#exp",
		description: "Compute e (Euler's number, approximately 2.71828182845905) raised to the power X.",
		origin: "vendor-docs",
	},
	first_value: {
		docUrl: "https://sqlite.org/windowfunctions.html",
		description:
			"This built-in window function calculates the window frame for each row in the same way as an aggregate window function.",
		origin: "vendor-docs",
	},
	floor: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#floor",
		description: "Return the first representable integer value less than or equal to X.",
		origin: "vendor-docs",
	},
	format: {
		docUrl: "https://sqlite.org/lang_corefunc.html#format",
		description:
			"The format(FORMAT,...) SQL function works like the sqlite3_mprintf() C-language function and the printf() function from the standard C library.",
		origin: "vendor-docs",
	},
	glob: {
		docUrl: "https://sqlite.org/lang_corefunc.html#glob",
		description: 'The glob(X,Y) function is equivalent to the expression " Y GLOB X ".',
		origin: "vendor-docs",
	},
	group_concat: {
		docUrl: "https://sqlite.org/lang_aggfunc.html#group_concat",
		description:
			"The group_concat() function returns a string which is the concatenation of all non-NULL values of X.",
		origin: "vendor-docs",
	},
	hex: {
		docUrl: "https://sqlite.org/lang_corefunc.html#hex",
		description:
			"The hex() function interprets its argument as a BLOB and returns a string which is the upper-case hexadecimal rendering of the content of that blob.",
		origin: "vendor-docs",
	},
	if: {
		docUrl: "https://sqlite.org/lang_corefunc.html#iif",
		description: "The iif(B1,V1,...,BN,VN) function takes arguments in pairs.",
		origin: "vendor-docs",
	},
	ifnull: {
		docUrl: "https://sqlite.org/lang_corefunc.html#ifnull",
		description:
			"The ifnull() function returns a copy of its first non-NULL argument, or NULL if both arguments are NULL.",
		origin: "vendor-docs",
	},
	iif: {
		docUrl: "https://sqlite.org/lang_corefunc.html#iif",
		description: "The iif(B1,V1,...,BN,VN) function takes arguments in pairs.",
		origin: "vendor-docs",
	},
	instr: {
		docUrl: "https://sqlite.org/lang_corefunc.html#instr",
		description:
			"The instr(X,Y) function finds the first occurrence of string Y within string X and returns the number of prior characters plus 1, or 0 if Y is nowhere found within X.",
		origin: "vendor-docs",
	},
	json: {
		docUrl: "https://sqlite.org/json1.html#the_json_function",
		description:
			"The json(X) function verifies that its argument X is a valid JSON string or JSONB blob and returns a minified version of that JSON string with all unnecessary whitespace removed.",
		origin: "vendor-docs",
	},
	json_array_length: {
		docUrl: "https://sqlite.org/json1.html#the_json_array_length_function",
		description:
			"The json_array_length(X) function returns the number of elements in the JSON array X, or 0 if X is some kind of JSON value other than an array.",
		origin: "vendor-docs",
	},
	json_each: {
		docUrl: "https://sqlite.org/json1.html#table_valued_functions_for_parsing_json_json_each_jsonb_each_json_tree_and_jsonb_tree_",
		description:
			"The json_each(X), jsonb_each(X), json_tree(X), and jsonb_tree(X) table-valued functions all walk the JSON value provided as their first argument and return one row for each element.",
		origin: "vendor-docs",
	},
	json_error_position: {
		docUrl: "https://sqlite.org/json1.html#the_json_error_position_function",
		description:
			"The json_error_position(X) function returns 0 if the input X is a well-formed JSON or JSON5 string.",
		origin: "vendor-docs",
	},
	json_extract: {
		docUrl: "https://sqlite.org/json1.html#the_json_extract_function",
		description:
			"The json_extract(X,P1,P2,...) extracts and returns one or more values from the well-formed JSON at X.",
		origin: "vendor-docs",
	},
	json_group_array: { docUrl: "https://sqlite.org/json1.html", origin: "vendor-docs" },
	json_group_object: { docUrl: "https://sqlite.org/json1.html", origin: "vendor-docs" },
	json_patch: {
		docUrl: "https://sqlite.org/json1.html#the_json_patch_function",
		description:
			"The json_patch(T,P) SQL function runs the RFC-7396 MergePatch algorithm to apply patch P against input T.",
		origin: "vendor-docs",
	},
	json_quote: {
		docUrl: "https://sqlite.org/json1.html#the_json_quote_function",
		description:
			"The json_quote(X) function converts the SQL value X (a number or a string) into its corresponding JSON representation.",
		origin: "vendor-docs",
	},
	json_remove: {
		docUrl: "https://sqlite.org/json1.html#the_json_remove_function",
		description:
			"The json_remove(X,P,...) function takes a single JSON value as its first argument followed by zero or more path arguments.",
		origin: "vendor-docs",
	},
	json_tree: {
		docUrl: "https://sqlite.org/json1.html#table_valued_functions_for_parsing_json_json_each_jsonb_each_json_tree_and_jsonb_tree_",
		description:
			"The json_each(X), jsonb_each(X), json_tree(X), and jsonb_tree(X) table-valued functions all walk the JSON value provided as their first argument and return one row for each element.",
		origin: "vendor-docs",
	},
	json_type: {
		docUrl: "https://sqlite.org/json1.html#the_json_type_function",
		description: 'The json_type(X) function returns the "type" of the outermost element of X.',
		origin: "vendor-docs",
	},
	json_valid: {
		docUrl: "https://sqlite.org/json1.html#the_json_valid_function",
		description:
			"The json_valid(X,Y) function returns 1 if the argument X is well-formed JSON, or returns 0 if X is not well-formed.",
		origin: "vendor-docs",
	},
	jsonb: {
		docUrl: "https://sqlite.org/json1.html#the_jsonb_function",
		description:
			"The jsonb(X) function returns the binary JSONB representation of the JSON provided as argument X.",
		origin: "vendor-docs",
	},
	jsonb_each: {
		docUrl: "https://sqlite.org/json1.html#table_valued_functions_for_parsing_json_json_each_jsonb_each_json_tree_and_jsonb_tree_",
		description:
			"The json_each(X), jsonb_each(X), json_tree(X), and jsonb_tree(X) table-valued functions all walk the JSON value provided as their first argument and return one row for each element.",
		origin: "vendor-docs",
	},
	jsonb_tree: {
		docUrl: "https://sqlite.org/json1.html#table_valued_functions_for_parsing_json_json_each_jsonb_each_json_tree_and_jsonb_tree_",
		description:
			"The json_each(X), jsonb_each(X), json_tree(X), and jsonb_tree(X) table-valued functions all walk the JSON value provided as their first argument and return one row for each element.",
		origin: "vendor-docs",
	},
	julianday: {
		docUrl: "https://sqlite.org/lang_datefunc.html",
		description:
			"The julianday() function returns the Julian day - the fractional number of days since noon in Greenwich on November 24, 4714 B.",
		origin: "vendor-docs",
	},
	lag: {
		docUrl: "https://sqlite.org/windowfunctions.html",
		description:
			"The first form of the lag() function returns the result of evaluating expression expr against the previous row in the partition.",
		origin: "vendor-docs",
	},
	last_insert_rowid: {
		docUrl: "https://sqlite.org/lang_corefunc.html#last_insert_rowid",
		description:
			"The last_insert_rowid() function returns the ROWID of the last row insert from the database connection which invoked the function.",
		origin: "vendor-docs",
	},
	last_value: {
		docUrl: "https://sqlite.org/windowfunctions.html",
		description:
			"This built-in window function calculates the window frame for each row in the same way as an aggregate window function.",
		origin: "vendor-docs",
	},
	lead: {
		docUrl: "https://sqlite.org/windowfunctions.html",
		description:
			"The first form of the lead() function returns the result of evaluating expression expr against the next row in the partition.",
		origin: "vendor-docs",
	},
	length: {
		docUrl: "https://sqlite.org/lang_corefunc.html#length",
		description:
			"For a string value X, the length(X) function returns the number of Unicode code points (not bytes) in input string X prior to the first U+0000 character.",
		origin: "vendor-docs",
	},
	like: {
		docUrl: "https://sqlite.org/lang_corefunc.html#like",
		description: 'The like() function is used to implement the " Y LIKE X [ESCAPE Z] " expression.',
		origin: "vendor-docs",
	},
	likelihood: {
		docUrl: "https://sqlite.org/lang_corefunc.html#likelihood",
		description: "The likelihood(X,Y) function returns argument X unchanged.",
		origin: "vendor-docs",
	},
	likely: {
		docUrl: "https://sqlite.org/lang_corefunc.html#likely",
		description: "The likely(X) function returns the argument X unchanged.",
		origin: "vendor-docs",
	},
	ln: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#ln",
		description: "Return the natural logarithm of X.",
		origin: "vendor-docs",
	},
	load_extension: {
		docUrl: "https://sqlite.org/lang_corefunc.html#load_extension",
		description:
			"The load_extension(X,Y) function loads SQLite extensions out of the shared library file named X using the entry point Y.",
		origin: "vendor-docs",
	},
	log: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#log",
		description: "Return the base-10 logarithm for X.",
		origin: "vendor-docs",
	},
	log10: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#log",
		description: "Return the base-10 logarithm for X.",
		origin: "vendor-docs",
	},
	log2: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#log2",
		description: "Return the logarithm base-2 for the number X.",
		origin: "vendor-docs",
	},
	lower: {
		docUrl: "https://sqlite.org/lang_corefunc.html#lower",
		description:
			"The lower(X) function returns a copy of string X with all ASCII characters converted to lower case.",
		origin: "vendor-docs",
	},
	ltrim: {
		docUrl: "https://sqlite.org/lang_corefunc.html#ltrim",
		description:
			"The ltrim(X,Y) function returns a string formed by removing any and all characters that appear in Y from the left side of X.",
		origin: "vendor-docs",
	},
	max: {
		docUrl: "https://sqlite.org/lang_corefunc.html#max_scalar",
		description:
			"The multi-argument max() function returns the argument with the maximum value, or return NULL if any argument is NULL.",
		origin: "vendor-docs",
	},
	median: {
		docUrl: "https://sqlite.org/lang_aggfunc.html#median",
		description: "The median() function returns the median value of all non-NULL X within a group.",
		origin: "vendor-docs",
	},
	min: {
		docUrl: "https://sqlite.org/lang_corefunc.html#min_scalar",
		description: "The multi-argument min() function returns the argument with the minimum value.",
		origin: "vendor-docs",
	},
	mod: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#mod",
		description: "Return the remainder after dividing X by Y.",
		origin: "vendor-docs",
	},
	nth_value: {
		docUrl: "https://sqlite.org/windowfunctions.html",
		description:
			"This built-in window function calculates the window frame for each row in the same way as an aggregate window function.",
		origin: "vendor-docs",
	},
	ntile: {
		docUrl: "https://sqlite.org/windowfunctions.html",
		description: "Argument N is handled as an integer.",
		origin: "vendor-docs",
	},
	nullif: {
		docUrl: "https://sqlite.org/lang_corefunc.html#nullif",
		description:
			"The nullif(X,Y) function returns its first argument if the arguments are different and NULL if the arguments are the same.",
		origin: "vendor-docs",
	},
	octet_length: {
		docUrl: "https://sqlite.org/lang_corefunc.html#octet_length",
		description: "The octet_length(X) function returns the number of bytes in the encoding of text string X.",
		origin: "vendor-docs",
	},
	percent_rank: {
		docUrl: "https://sqlite.org/windowfunctions.html",
		description:
			"Despite the name, this function always returns a value between 0.0 and 1.0 equal to ( rank - 1)/( partition-rows - 1), where rank is the value returned by built-in window function rank() and partition-rows is the total number of rows in the partition.",
		origin: "vendor-docs",
	},
	percentile: {
		docUrl: "https://sqlite.org/lang_aggfunc.html#percentile",
		description:
			"The percentile(Y,P) aggregate function computes an answer X which is a value that is greater than or equal to P percent of the non-NULL inputs and which is less than or equal to 100-P percent of the inputs.",
		origin: "vendor-docs",
	},
	percentile_cont: {
		docUrl: "https://sqlite.org/lang_aggfunc.html#percentile_cont",
		description:
			"The percentile(Y,P) aggregate function computes an answer X which is a value that is greater than or equal to fraction P of the non-NULL inputs and which is less than or equal to fraction 1.0-P of the inputs.",
		origin: "vendor-docs",
	},
	percentile_disc: {
		docUrl: "https://sqlite.org/lang_aggfunc.html#percentile_disc",
		description:
			"The percentile_disc(Y,P) function works like percentile_cont(Y,P) except that instead of doing a weighted average of the closest available inputs, it always returns a value that is one of the input values - the smaller of the two possible choices.",
		origin: "vendor-docs",
	},
	pi: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#pi",
		description: "Return an approximation for &pi;.",
		origin: "vendor-docs",
	},
	pow: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#pow",
		description: "Compute X raised to the power Y.",
		origin: "vendor-docs",
	},
	power: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#pow",
		description: "Compute X raised to the power Y.",
		origin: "vendor-docs",
	},
	printf: {
		docUrl: "https://sqlite.org/lang_corefunc.html#printf",
		description: "The printf() SQL function is an alias for the format() SQL function.",
		origin: "vendor-docs",
	},
	quote: {
		docUrl: "https://sqlite.org/lang_corefunc.html#quote",
		description:
			"The quote(X) function returns the text of an SQL literal which is the value of its argument suitable for inclusion into an SQL statement.",
		origin: "vendor-docs",
	},
	radians: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#radians",
		description: "Convert X from degrees into radians.",
		origin: "vendor-docs",
	},
	random: {
		docUrl: "https://sqlite.org/lang_corefunc.html#random",
		description:
			"The random() function returns a pseudo-random integer between -9223372036854775807 and +9223372036854775807.",
		origin: "vendor-docs",
	},
	randomblob: {
		docUrl: "https://sqlite.org/lang_corefunc.html#randomblob",
		description: "The randomblob(N) function return an N-byte blob containing pseudo-random bytes.",
		origin: "vendor-docs",
	},
	rank: {
		docUrl: "https://sqlite.org/windowfunctions.html",
		description: "The row_number() of the first peer in each group - the rank of the current row with gaps.",
		origin: "vendor-docs",
	},
	replace: {
		docUrl: "https://sqlite.org/lang_corefunc.html#replace",
		description:
			"The replace(X,Y,Z) function returns a string formed by substituting string Z for every occurrence of string Y in string X.",
		origin: "vendor-docs",
	},
	round: {
		docUrl: "https://sqlite.org/lang_corefunc.html#round",
		description:
			"The round(X,Y) function returns a floating-point value X rounded to Y digits to the right of the decimal point.",
		origin: "vendor-docs",
	},
	row_number: {
		docUrl: "https://sqlite.org/windowfunctions.html",
		description: "The number of the row within the current partition.",
		origin: "vendor-docs",
	},
	rtrim: {
		docUrl: "https://sqlite.org/lang_corefunc.html#rtrim",
		description:
			"The rtrim(X,Y) function returns a string formed by removing any and all characters that appear in Y from the right side of X.",
		origin: "vendor-docs",
	},
	sign: {
		docUrl: "https://sqlite.org/lang_corefunc.html#sign",
		description:
			"The sign(X) function returns -1, 0, or +1 if the argument X is a numeric value that is negative, zero, or positive, respectively.",
		origin: "vendor-docs",
	},
	sin: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#sin",
		description: "Return the sine of X.",
		origin: "vendor-docs",
	},
	sinh: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#sinh",
		description: "Return the hyperbolic sine of X.",
		origin: "vendor-docs",
	},
	soundex: {
		docUrl: "https://sqlite.org/lang_corefunc.html#soundex",
		description: "The soundex(X) function returns a string that is the soundex encoding of the string X.",
		origin: "vendor-docs",
	},
	sqlite_compileoption_get: {
		docUrl: "https://sqlite.org/lang_corefunc.html#sqlite_compileoption_get",
		description:
			"The sqlite_compileoption_get() SQL function is a wrapper around the sqlite3_compileoption_get() C/C++ function.",
		origin: "vendor-docs",
	},
	sqlite_compileoption_used: {
		docUrl: "https://sqlite.org/lang_corefunc.html#sqlite_compileoption_used",
		description:
			"The sqlite_compileoption_used() SQL function is a wrapper around the sqlite3_compileoption_used() C/C++ function.",
		origin: "vendor-docs",
	},
	sqlite_offset: {
		docUrl: "https://sqlite.org/lang_corefunc.html#sqlite_offset",
		description:
			"The sqlite_offset(X) function returns the byte offset in the database file for the beginning of the record from which value would be read.",
		origin: "vendor-docs",
	},
	sqlite_source_id: {
		docUrl: "https://sqlite.org/lang_corefunc.html#sqlite_source_id",
		description:
			"The sqlite_source_id() function returns a string that identifies the specific version of the source code that was used to build the SQLite library.",
		origin: "vendor-docs",
	},
	sqlite_version: {
		docUrl: "https://sqlite.org/lang_corefunc.html#sqlite_version",
		description: "The sqlite_version() function returns the version string for the SQLite library that is running.",
		origin: "vendor-docs",
	},
	sqrt: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#sqrt",
		description: "Return the square root of X.",
		origin: "vendor-docs",
	},
	strftime: {
		docUrl: "https://sqlite.org/lang_datefunc.html",
		description:
			"The strftime() function returns the date formatted according to the format string specified as the first argument.",
		origin: "vendor-docs",
	},
	string_agg: {
		docUrl: "https://sqlite.org/lang_aggfunc.html#group_concat",
		description:
			"The group_concat() function returns a string which is the concatenation of all non-NULL values of X.",
		origin: "vendor-docs",
	},
	substr: {
		docUrl: "https://sqlite.org/lang_corefunc.html#substr",
		description:
			"The substr(X,Y,Z) function returns a substring of input string X that begins with the Y-th character and which is Z characters long.",
		origin: "vendor-docs",
	},
	substring: {
		docUrl: "https://sqlite.org/lang_corefunc.html#substr",
		description:
			"The substr(X,Y,Z) function returns a substring of input string X that begins with the Y-th character and which is Z characters long.",
		origin: "vendor-docs",
	},
	sum: {
		docUrl: "https://sqlite.org/lang_aggfunc.html#sumunc",
		description: "The sum() and total() aggregate functions return the sum of all non-NULL values in the group.",
		origin: "vendor-docs",
	},
	tan: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#tan",
		description: "Return the tangent of X.",
		origin: "vendor-docs",
	},
	tanh: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#tanh",
		description: "Return the hyperbolic tangent of X.",
		origin: "vendor-docs",
	},
	time: {
		docUrl: "https://sqlite.org/lang_datefunc.html",
		description: "The time() function returns the time as text in formatted as HH:MM:SS or as HH:MM:SS.",
		origin: "vendor-docs",
	},
	timediff: {
		docUrl: "https://sqlite.org/lang_datefunc.html",
		description:
			"The timediff(A,B) function returns a string that describes the amount of time that must be added to B in order to reach time A.",
		origin: "vendor-docs",
	},
	total: {
		docUrl: "https://sqlite.org/lang_aggfunc.html#sumunc",
		description: "The sum() and total() aggregate functions return the sum of all non-NULL values in the group.",
		origin: "vendor-docs",
	},
	total_changes: {
		docUrl: "https://sqlite.org/lang_corefunc.html#total_changes",
		description:
			"The total_changes() function returns the number of row changes caused by INSERT, UPDATE or DELETE statements since the current database connection was opened.",
		origin: "vendor-docs",
	},
	trim: {
		docUrl: "https://sqlite.org/lang_corefunc.html#trim",
		description:
			"The trim(X,Y) function returns a string formed by removing any and all characters that appear in Y from both ends of X.",
		origin: "vendor-docs",
	},
	trunc: {
		docUrl: "https://sqlite.org/lang_mathfunc.html#trunc",
		description: "Return the representable integer in between X and 0 (inclusive) that is furthest away from zero.",
		origin: "vendor-docs",
	},
	typeof: {
		docUrl: "https://sqlite.org/lang_corefunc.html#typeof",
		description:
			'The typeof(X) function returns a string that indicates the datatype of the expression X: "null", "integer", "real", "text", or "blob".',
		origin: "vendor-docs",
	},
	unhex: {
		docUrl: "https://sqlite.org/lang_corefunc.html#unhex",
		description: "The unhex(X,Y) function returns a BLOB value which is the decoding of the hexadecimal string X.",
		origin: "vendor-docs",
	},
	unicode: {
		docUrl: "https://sqlite.org/lang_corefunc.html#unicode",
		description:
			"The unicode(X) function returns the numeric unicode code point corresponding to the first character of the string X.",
		origin: "vendor-docs",
	},
	unistr: {
		docUrl: "https://sqlite.org/lang_corefunc.html#unistr",
		description:
			"The unistr(X) function interprets backslash escapes in input string X and returns a new string with those escapes converted into the actual Unicode codepoints that they represent.",
		origin: "vendor-docs",
	},
	unistr_quote: {
		docUrl: "https://sqlite.org/lang_corefunc.html#unistr_quote",
		description:
			"The unistr_quote(X) function returns the text of an SQL literal or constant expression that encodes the value of its argument X and is suitable for inclusion into an SQL statement.",
		origin: "vendor-docs",
	},
	unixepoch: {
		docUrl: "https://sqlite.org/lang_datefunc.html",
		description:
			"The unixepoch() function returns a unix timestamp - the number of seconds since 1970-01-01 00:00:00 UTC.",
		origin: "vendor-docs",
	},
	unlikely: {
		docUrl: "https://sqlite.org/lang_corefunc.html#unlikely",
		description: "The unlikely(X) function returns the argument X unchanged.",
		origin: "vendor-docs",
	},
	upper: {
		docUrl: "https://sqlite.org/lang_corefunc.html#upper",
		description:
			"The upper(X) function returns a copy of input string X in which all lower-case ASCII characters are converted to their upper-case equivalent.",
		origin: "vendor-docs",
	},
	zeroblob: {
		docUrl: "https://sqlite.org/lang_corefunc.html#zeroblob",
		description: "The zeroblob(N) function returns a BLOB consisting of N bytes of 0x00.",
		origin: "vendor-docs",
	},
};
