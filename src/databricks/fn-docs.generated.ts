// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// The per-NAME function docs table for databricks (issue #34), parallel to the signature table:
// docUrl points at the vendor's published page for the same source the signature harvest read;
// description (where present) is origin-tagged prose. Same lowercased-name keys as *_SIGNATURES.
// Built 2026-07-15. 668 names (589 with descriptions).
import type { FnDoc } from "../signature/docs.js";

export const DATABRICKS_FN_DOCS: Record<string, FnDoc> = {
	abs: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/abs",
		description: "Returns the absolute value of the numeric or interval value.",
		origin: "spark-docs",
	},
	acos: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/acos",
		description: "Returns the inverse cosine (a.k.a.",
		origin: "spark-docs",
	},
	acosh: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/acosh",
		description: "Returns inverse hyperbolic cosine of expr.",
		origin: "spark-docs",
	},
	add_months: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/add_months",
		description: "Returns the date that is num_months after start_date.",
		origin: "spark-docs",
	},
	aes_decrypt: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/aes_decrypt",
		description: "Returns a decrypted value of expr using AES in mode with padding.",
		origin: "spark-docs",
	},
	aes_encrypt: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/aes_encrypt",
		description: "Returns an encrypted value of expr using AES in given mode with the specified padding.",
		origin: "spark-docs",
	},
	agg: { docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/agg", origin: "vendor-docs" },
	aggregate: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/aggregate",
		description:
			"Applies a binary operator to an initial state and all elements in the array, and reduces this to a single state.",
		origin: "spark-docs",
	},
	ai_analyze_sentiment: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_analyze_sentiment",
		description: "Analyzes the sentiment of the provided text content, returning a sentiment classification.",
		origin: "authored",
	},
	ai_classify: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_classify",
		description: "Classifies text content into one or more provided label categories using a language model.",
		origin: "authored",
	},
	ai_extract: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_extract",
		description: "Extracts structured data or specific fields from unstructured text or documents using AI.",
		origin: "authored",
	},
	ai_fix_grammar: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_fix_grammar",
		description: "Corrects grammar and spelling errors in the provided text.",
		origin: "authored",
	},
	ai_gen: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_gen",
		description: "Generates text content based on the provided prompt using a language model.",
		origin: "authored",
	},
	ai_mask: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_mask",
		description: "Masks or redacts sensitive information matching specified labels from the input text.",
		origin: "authored",
	},
	ai_parse_document: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_parse_document",
		description: "Parses unstructured documents into structured content using document understanding models.",
		origin: "authored",
	},
	ai_prep_search: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_prep_search",
		description: "Prepares parsed document content for semantic search and retrieval operations.",
		origin: "authored",
	},
	ai_query: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_query",
		description: "Sends a request to a specified AI endpoint and returns the response.",
		origin: "authored",
	},
	ai_similarity: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_similarity",
		origin: "vendor-docs",
	},
	ai_summarize: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_summarize",
		origin: "vendor-docs",
	},
	ai_translate: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_translate",
		description: "Translates text from one language to another.",
		origin: "authored",
	},
	any_value: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/any_value",
		description: "Returns some value of expr for a group of rows.",
		origin: "spark-docs",
	},
	approx_count_distinct: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/approx_count_distinct",
		description: "Returns the estimated cardinality by HyperLogLog++.",
		origin: "spark-docs",
	},
	approx_percentile: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/approx_percentile",
		description:
			"Returns the approximate percentile of the numeric or ansi interval column col which is the smallest value in the ordered col values (sorted from least to greatest) such that no more than percentage of col values is less than the value or equal to that value.",
		origin: "spark-docs",
	},
	approx_top_k: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/approx_top_k",
		origin: "vendor-docs",
	},
	approx_top_k_accumulate: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/approx_top_k_accumulate",
		description: "Initializes or accumulates state for approximate top-k frequency estimation.",
		origin: "authored",
	},
	approx_top_k_combine: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/approx_top_k_combine",
		description: "Combines multiple top-k approximation states into a single state.",
		origin: "authored",
	},
	approx_top_k_estimate: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/approx_top_k_estimate",
		description: "Extracts top-k estimates and frequencies from accumulated approximation state.",
		origin: "authored",
	},
	array: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array",
		description: "Returns an array with the given elements.",
		origin: "spark-docs",
	},
	array_agg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_agg",
		description: "Collects and returns a list of non-unique elements.",
		origin: "spark-docs",
	},
	array_append: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_append",
		description: "Add the element at the end of the array passed as first argument.",
		origin: "spark-docs",
	},
	array_compact: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_compact",
		description: "Removes null values from the array.",
		origin: "spark-docs",
	},
	array_contains: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_contains",
		description: "Returns true if the array contains the value.",
		origin: "spark-docs",
	},
	array_distinct: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_distinct",
		description: "Removes duplicate values from the array.",
		origin: "spark-docs",
	},
	array_except: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_except",
		description: "Returns an array of the elements in array1 but not in array2, without duplicates.",
		origin: "spark-docs",
	},
	array_insert: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_insert",
		description: "Places val into index pos of array x.",
		origin: "spark-docs",
	},
	array_intersect: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_intersect",
		description: "Returns an array of the elements in the intersection of array1 and array2, without duplicates.",
		origin: "spark-docs",
	},
	array_join: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_join",
		description:
			"Concatenates the elements of the given array using the delimiter and an optional string to replace nulls.",
		origin: "spark-docs",
	},
	array_max: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_max",
		description: "Returns the maximum value in the array.",
		origin: "spark-docs",
	},
	array_min: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_min",
		description: "Returns the minimum value in the array.",
		origin: "spark-docs",
	},
	array_position: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_position",
		description:
			"Returns the (1-based) index of the first matching element of the array as long, or 0 if no match is found.",
		origin: "spark-docs",
	},
	array_prepend: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_prepend",
		description: "Add the element at the beginning of the array passed as first argument.",
		origin: "spark-docs",
	},
	array_remove: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_remove",
		description: "Remove all elements that equal to element from array.",
		origin: "spark-docs",
	},
	array_repeat: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_repeat",
		description: "Returns the array containing element count times.",
		origin: "spark-docs",
	},
	array_size: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_size",
		description: "Returns the size of an array.",
		origin: "spark-docs",
	},
	array_sort: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_sort",
		description: "Sorts the input array.",
		origin: "spark-docs",
	},
	array_union: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/array_union",
		description: "Returns an array of the elements in the union of array1 and array2, without duplicates.",
		origin: "spark-docs",
	},
	arrays_overlap: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/arrays_overlap",
		description: "Returns true if a1 contains at least a non-null element present also in a2.",
		origin: "spark-docs",
	},
	arrays_zip: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/arrays_zip",
		description:
			"Returns a merged array of structs in which the N-th struct contains all N-th values of input arrays.",
		origin: "spark-docs",
	},
	ascii: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ascii",
		description: "Returns the numeric value of the first character of str.",
		origin: "spark-docs",
	},
	asin: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/asin",
		description: "Returns the inverse sine (a.k.a.",
		origin: "spark-docs",
	},
	asinh: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/asinh",
		description: "Returns inverse hyperbolic sine of expr.",
		origin: "spark-docs",
	},
	assert_true: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/assert_true",
		description: "Throws an exception if expr is not true.",
		origin: "spark-docs",
	},
	atan: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/atan",
		description: "Returns the inverse tangent (a.k.a.",
		origin: "spark-docs",
	},
	atan2: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/atan2",
		description:
			"Returns the angle in radians between the positive x-axis of a plane and the point given by the coordinates ( exprX, exprY), as if computed by java.lang.Math.atan2.",
		origin: "spark-docs",
	},
	atanh: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/atanh",
		description: "Returns inverse hyperbolic tangent of expr.",
		origin: "spark-docs",
	},
	avg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/avg",
		description: "Returns the mean calculated from values of a group.",
		origin: "spark-docs",
	},
	base64: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/base64",
		description: "Converts the argument from a binary bin to a base 64 string.",
		origin: "spark-docs",
	},
	bigint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bigint",
		description: "Casts the value expr to the target data type bigint.",
		origin: "spark-docs",
	},
	bin: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bin",
		description: "Returns the string representation of the long value expr represented in binary.",
		origin: "spark-docs",
	},
	binary: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/binary",
		description: "Casts the value expr to the target data type binary.",
		origin: "spark-docs",
	},
	bit_and: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bit_and",
		description: "Returns the bitwise AND of all non-null input values, or null if none.",
		origin: "spark-docs",
	},
	bit_count: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bit_count",
		description:
			"Returns the number of bits that are set in the argument expr as an unsigned 64-bit integer, or NULL if the argument is NULL.",
		origin: "spark-docs",
	},
	bit_get: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bit_get",
		description: "Returns the value of the bit (0 or 1) at the specified position.",
		origin: "spark-docs",
	},
	bit_length: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bit_length",
		description: "Returns the bit length of string data or number of bits of binary data.",
		origin: "spark-docs",
	},
	bit_or: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bit_or",
		description: "Returns the bitwise OR of all non-null input values, or null if none.",
		origin: "spark-docs",
	},
	bit_reverse: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bit_reverse",
		description: "Reverses the bit order in a numeric value.",
		origin: "authored",
	},
	bit_xor: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bit_xor",
		description: "Returns the bitwise XOR of all non-null input values, or null if none.",
		origin: "spark-docs",
	},
	bitmap_and_agg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bitmap_and_agg",
		description: "Aggregates bitmaps using bitwise AND operation across rows.",
		origin: "authored",
	},
	bitmap_bit_position: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bitmap_bit_position",
		description: "Returns the bit position for the given input child expression.",
		origin: "spark-docs",
	},
	bitmap_bucket_number: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bitmap_bucket_number",
		description: "Returns the bucket number for the given input child expression.",
		origin: "spark-docs",
	},
	bitmap_construct_agg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bitmap_construct_agg",
		description:
			"Returns a bitmap with the positions of the bits set from all the values from the child expression.",
		origin: "spark-docs",
	},
	bitmap_count: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bitmap_count",
		description: "Returns the number of set bits in the child bitmap.",
		origin: "spark-docs",
	},
	bitmap_or_agg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bitmap_or_agg",
		description: "Returns a bitmap that is the bitwise OR of all of the bitmaps from the child expression.",
		origin: "spark-docs",
	},
	bool_and: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bool_and",
		description: "Returns true if all values of expr are true.",
		origin: "spark-docs",
	},
	bool_or: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bool_or",
		description: "Returns true if at least one value of expr is true.",
		origin: "spark-docs",
	},
	boolean: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/boolean",
		description: "Casts the value expr to the target data type boolean.",
		origin: "spark-docs",
	},
	bround: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/bround",
		description: "Returns expr rounded to d decimal places using HALF_EVEN rounding mode.",
		origin: "spark-docs",
	},
	btrim: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/btrim",
		description: "Removes the leading and trailing space characters from str.",
		origin: "spark-docs",
	},
	cardinality: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/cardinality",
		description: "Returns the size of an array or a map.",
		origin: "spark-docs",
	},
	cast: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/cast",
		description: "Casts the value expr to the target data type type.",
		origin: "spark-docs",
	},
	cbrt: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/cbrt",
		description: "Returns the cube root of expr.",
		origin: "spark-docs",
	},
	ceil: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ceil",
		description: "Returns the smallest number after rounding up that is not smaller than expr.",
		origin: "spark-docs",
	},
	ceiling: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ceiling",
		description: "Returns the smallest number after rounding up that is not smaller than expr.",
		origin: "spark-docs",
	},
	char: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/char",
		description: "Returns the ASCII character having the binary equivalent to expr.",
		origin: "spark-docs",
	},
	char_length: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/char_length",
		description: "Returns the character length of string data or number of bytes of binary data.",
		origin: "spark-docs",
	},
	character_length: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/character_length",
		description: "Returns the character length of string data or number of bytes of binary data.",
		origin: "spark-docs",
	},
	charindex: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/charindex",
		description: "Returns the position of a substring within a string, using 1-based indexing.",
		origin: "authored",
	},
	chr: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/chr",
		description: "Returns the ASCII character having the binary equivalent to expr.",
		origin: "spark-docs",
	},
	classifier: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/classifier",
		origin: "vendor-docs",
	},
	coalesce: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/coalesce",
		description: "Returns the first non-null argument if exists.",
		origin: "spark-docs",
	},
	collation: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/collation",
		description: "Returns the collation name of a given expression.",
		origin: "spark-docs",
	},
	collations: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/collations",
		description: "Get all of the Spark SQL string collations",
		origin: "spark-docs",
	},
	collect_list: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/collect_list",
		description: "Collects and returns a list of non-unique elements.",
		origin: "spark-docs",
	},
	collect_set: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/collect_set",
		description: "Collects and returns a set of unique elements.",
		origin: "spark-docs",
	},
	concat: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/concat",
		description: "Returns the concatenation of col1, col2,..., colN.",
		origin: "spark-docs",
	},
	concat_ws: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/concat_ws",
		description: "Returns the concatenation of the strings separated by sep, skipping null values.",
		origin: "spark-docs",
	},
	contains: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/contains",
		description:
			"Returns a boolean. The value is True if right is found inside left. Returns NULL if either input expression is NULL. Otherwise, returns False. Both left or right must be of STRING or BINARY type.",
		origin: "spark-docs",
	},
	conv: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/conv",
		description: "Convert num from from_base to to_base.",
		origin: "spark-docs",
	},
	corr: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/corr",
		description: "Returns Pearson coefficient of correlation between a set of number pairs.",
		origin: "spark-docs",
	},
	cos: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/cos",
		description: "Returns the cosine of expr, as if computed by java.lang.Math.cos.",
		origin: "spark-docs",
	},
	cosh: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/cosh",
		description: "Returns the hyperbolic cosine of expr, as if computed by java.lang.Math.cosh.",
		origin: "spark-docs",
	},
	cot: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/cot",
		description: "Returns the cotangent of expr, as if computed by 1/java.lang.Math.tan.",
		origin: "spark-docs",
	},
	count: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/count",
		description: "Returns the total number of retrieved rows, including rows containing null.",
		origin: "spark-docs",
	},
	count_if: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/count_if",
		description: "Returns the number of TRUE values for the expression.",
		origin: "spark-docs",
	},
	count_min_sketch: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/count_min_sketch",
		description: "Returns a count-min sketch of a column with the given esp, confidence and seed.",
		origin: "spark-docs",
	},
	covar_pop: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/covar_pop",
		description: "Returns the population covariance of a set of number pairs.",
		origin: "spark-docs",
	},
	covar_samp: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/covar_samp",
		description: "Returns the sample covariance of a set of number pairs.",
		origin: "spark-docs",
	},
	crc32: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/crc32",
		description: "Returns a cyclic redundancy check value of the expr as a bigint.",
		origin: "spark-docs",
	},
	csc: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/csc",
		description: "Returns the cosecant of expr, as if computed by 1/java.lang.Math.sin.",
		origin: "spark-docs",
	},
	cube: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/cube",
		description:
			"Generates multi-dimensional grouping sets for aggregation, including all combinations of the specified columns.",
		origin: "authored",
	},
	cume_dist: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/cume_dist",
		description: "Computes the position of a value relative to all values in the partition.",
		origin: "spark-docs",
	},
	curdate: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/curdate",
		description: "Returns the current date at the start of query evaluation.",
		origin: "spark-docs",
	},
	current_catalog: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/current_catalog",
		description: "Returns the current catalog.",
		origin: "spark-docs",
	},
	current_database: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/current_database",
		description: "Returns the current database.",
		origin: "spark-docs",
	},
	current_date: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/current_date",
		description: "Returns the current date at the start of query evaluation.",
		origin: "spark-docs",
	},
	current_metastore: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/current_metastore",
		origin: "vendor-docs",
	},
	current_recipient: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/current_recipient",
		origin: "vendor-docs",
	},
	current_schema: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/current_schema",
		description: "Returns the current database.",
		origin: "spark-docs",
	},
	current_time: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/current_time",
		description: "Returns the current time at the specified precision.",
		origin: "authored",
	},
	current_timestamp: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/current_timestamp",
		description: "Returns the current timestamp at the start of query evaluation.",
		origin: "spark-docs",
	},
	current_timezone: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/current_timezone",
		description: "Returns the current session local timezone.",
		origin: "spark-docs",
	},
	current_user: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/current_user",
		description: "user name of current execution context.",
		origin: "spark-docs",
	},
	current_version: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/current_version",
		origin: "vendor-docs",
	},
	date: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/date",
		description: "Casts the value expr to the target data type date.",
		origin: "spark-docs",
	},
	date_add: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/date_add",
		description: "Returns the date that is num_days after start_date.",
		origin: "spark-docs",
	},
	date_diff: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/date_diff",
		description: "Returns the number of days from startDate to endDate.",
		origin: "spark-docs",
	},
	date_format: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/date_format",
		description: "Converts timestamp to a value of string in the format specified by the date format fmt.",
		origin: "spark-docs",
	},
	date_from_unix_date: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/date_from_unix_date",
		description: "Create date from the number of days since 1970-01-01.",
		origin: "spark-docs",
	},
	date_part: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/date_part",
		description: "Extracts a part of the date/timestamp or interval source.",
		origin: "spark-docs",
	},
	date_sub: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/date_sub",
		description: "Returns the date that is num_days before start_date.",
		origin: "spark-docs",
	},
	date_trunc: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/date_trunc",
		description: "Returns timestamp ts truncated to the unit specified by the format model fmt.",
		origin: "spark-docs",
	},
	dateadd: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/dateadd",
		description: "Returns the date that is num_days after start_date.",
		origin: "spark-docs",
	},
	datediff: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/datediff",
		description: "Returns the number of days from startDate to endDate.",
		origin: "spark-docs",
	},
	day: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/day",
		description: "Returns the day of month of the date/timestamp.",
		origin: "spark-docs",
	},
	dayname: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/dayname",
		description: "Returns the three-letter abbreviated day name from the given date.",
		origin: "spark-docs",
	},
	dayofmonth: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/dayofmonth",
		description: "Returns the day of month of the date/timestamp.",
		origin: "spark-docs",
	},
	dayofweek: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/dayofweek",
		description: "Returns the day of the week for date/timestamp (1 = Sunday, 2 = Monday,..., 7 = Saturday).",
		origin: "spark-docs",
	},
	dayofyear: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/dayofyear",
		description: "Returns the day of year of the date/timestamp.",
		origin: "spark-docs",
	},
	decimal: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/decimal",
		description: "Casts the value expr to the target data type decimal.",
		origin: "spark-docs",
	},
	decode: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/decode",
		description: "Decodes the first argument using the second argument character set.",
		origin: "spark-docs",
	},
	degrees: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/degrees",
		description: "Converts radians to degrees.",
		origin: "spark-docs",
	},
	dense_rank: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/dense_rank",
		description: "Computes the rank of a value in a group of values.",
		origin: "spark-docs",
	},
	double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/double",
		description: "Casts the value expr to the target data type double.",
		origin: "spark-docs",
	},
	e: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/e",
		description: "Returns Euler's number, e.",
		origin: "spark-docs",
	},
	element_at: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/element_at",
		description: "Returns element of array at given (1-based) index.",
		origin: "spark-docs",
	},
	elt: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/elt",
		description: "Returns the n -th input, e.g., returns input2 when n is 2.",
		origin: "spark-docs",
	},
	encode: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/encode",
		description: "Encodes the first argument using the second argument character set.",
		origin: "spark-docs",
	},
	endswith: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/endswith",
		description:
			"Returns a boolean. The value is True if left ends with right. Returns NULL if either input expression is NULL. Otherwise, returns False. Both left or right must be of STRING or BINARY type.",
		origin: "spark-docs",
	},
	equal_null: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/equal_null",
		description:
			"Returns same result as the EQUAL(=) operator for non-null operands, but returns true if both are null, false if one of the them is null.",
		origin: "spark-docs",
	},
	every: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/every",
		description: "Returns true if all values of expr are true.",
		origin: "spark-docs",
	},
	exp: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/exp",
		description: "Returns e to the power of expr.",
		origin: "spark-docs",
	},
	explode: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/explode",
		description:
			"Separates the elements of array expr into multiple rows, or the elements of map expr into multiple rows and columns.",
		origin: "spark-docs",
	},
	explode_outer: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/explode_outer",
		description:
			"Separates the elements of array expr into multiple rows, or the elements of map expr into multiple rows and columns.",
		origin: "spark-docs",
	},
	expm1: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/expm1",
		description: "Returns exp( expr) - 1.",
		origin: "spark-docs",
	},
	factorial: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/factorial",
		description: "Returns the factorial of expr.",
		origin: "spark-docs",
	},
	filter: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/filter",
		description: "Filters the input array using the given predicate.",
		origin: "spark-docs",
	},
	find_in_set: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/find_in_set",
		description: "Returns the index (1-based) of the given string ( str) in the comma-delimited list ( str_array).",
		origin: "spark-docs",
	},
	first: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/first",
		description: "Returns the first value of expr for a group of rows.",
		origin: "spark-docs",
	},
	first_value: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/first_value",
		description: "Returns the first value of expr for a group of rows.",
		origin: "spark-docs",
	},
	flatten: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/flatten",
		description: "Transforms an array of arrays into a single array.",
		origin: "spark-docs",
	},
	float: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/float",
		description: "Casts the value expr to the target data type float.",
		origin: "spark-docs",
	},
	floor: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/floor",
		description: "Returns the largest number after rounding down that is not greater than expr.",
		origin: "spark-docs",
	},
	forall: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/forall",
		description: "Tests whether a predicate holds for all elements in the array.",
		origin: "spark-docs",
	},
	format_number: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/format_number",
		description: "Formats the number expr1 like '#,###,###.##', rounded to expr2 decimal places.",
		origin: "spark-docs",
	},
	format_string: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/format_string",
		description: "Returns a formatted string from printf-style format strings.",
		origin: "spark-docs",
	},
	from_avro: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/from_avro",
		description: "Converts a binary Avro value into a Catalyst value.",
		origin: "spark-docs",
	},
	from_csv: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/from_csv",
		description: "Returns a struct value with the given csvStr and schema.",
		origin: "spark-docs",
	},
	from_json: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/from_json",
		description: "Returns a struct value with the given jsonStr and schema.",
		origin: "spark-docs",
	},
	from_unixtime: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/from_unixtime",
		description: "Returns unix_time in the specified fmt.",
		origin: "spark-docs",
	},
	from_utc_timestamp: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/from_utc_timestamp",
		description:
			"Given a timestamp like '2017-07-14 02:40:00.0', interprets it as a time in UTC, and renders that time as a timestamp in the given time zone.",
		origin: "spark-docs",
	},
	from_xml: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/from_xml",
		description: "Returns a struct value with the given xmlStr and schema.",
		origin: "spark-docs",
	},
	get: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/get",
		description: "Returns element of array at given (0-based) index.",
		origin: "spark-docs",
	},
	get_json_object: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/get_json_object",
		description: "Extracts a json object from path.",
		origin: "spark-docs",
	},
	getdate: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/getdate",
		description: "Returns the current date and time as a timestamp.",
		origin: "authored",
	},
	greatest: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/greatest",
		description: "Returns the greatest value of all parameters, skipping null values.",
		origin: "spark-docs",
	},
	grouping: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/grouping",
		description:
			'indicates whether a specified column in a GROUP BY is aggregated or not, returns 1 for aggregated or 0 for not aggregated in the result set.",',
		origin: "spark-docs",
	},
	h3_boundaryasgeojson: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_boundaryasgeojson",
		description: "Returns the boundary of an H3 hexagon cell as a GeoJSON polygon.",
		origin: "authored",
	},
	h3_boundaryaswkb: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_boundaryaswkb",
		description: "Returns the boundary of an H3 hexagon cell in WKB (well-known binary) format.",
		origin: "authored",
	},
	h3_boundaryaswkt: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_boundaryaswkt",
		description: "Returns the boundary of an H3 hexagon cell as WKT (well-known text) geometry.",
		origin: "authored",
	},
	h3_centerasgeojson: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_centerasgeojson",
		description: "Returns the center point of an H3 hexagon cell as a GeoJSON point.",
		origin: "authored",
	},
	h3_centeraswkb: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_centeraswkb",
		description: "Returns the center point of an H3 hexagon cell in WKB (well-known binary) format.",
		origin: "authored",
	},
	h3_centeraswkt: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_centeraswkt",
		description: "Returns the center point of an H3 hexagon cell as WKT (well-known text) geometry.",
		origin: "authored",
	},
	h3_compact: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_compact",
		description: "Compresses a set of H3 cells to their minimal representation, combining contained cells.",
		origin: "authored",
	},
	h3_coverash3: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_coverash3",
		description: "Returns H3 hexagon cells that cover a given geographic area at the specified resolution.",
		origin: "authored",
	},
	h3_distance: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_distance",
		description: "Calculates the distance in hexagon steps between two H3 cells.",
		origin: "authored",
	},
	h3_h3tostring: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_h3tostring",
		description: "Converts an H3 cell ID from numeric representation to hexadecimal string format.",
		origin: "authored",
	},
	h3_hexring: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_hexring",
		description: "Returns the hexagon ring located k steps away from a given H3 cell.",
		origin: "authored",
	},
	h3_ischildof: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_ischildof",
		description: "Tests whether the first H3 cell is a child of (contained within) the second cell.",
		origin: "authored",
	},
	h3_ispentagon: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_ispentagon",
		origin: "vendor-docs",
	},
	h3_isvalid: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_isvalid",
		origin: "vendor-docs",
	},
	h3_kring: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_kring",
		origin: "vendor-docs",
	},
	h3_kringdistances: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_kringdistances",
		origin: "vendor-docs",
	},
	h3_longlatash3: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_longlatash3",
		origin: "vendor-docs",
	},
	h3_longlatash3string: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_longlatash3string",
		origin: "vendor-docs",
	},
	h3_maxchild: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_maxchild",
		origin: "vendor-docs",
	},
	h3_minchild: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_minchild",
		origin: "vendor-docs",
	},
	h3_pointash3: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_pointash3",
		origin: "vendor-docs",
	},
	h3_pointash3string: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_pointash3string",
		origin: "vendor-docs",
	},
	h3_polyfillash3: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_polyfillash3",
		origin: "vendor-docs",
	},
	h3_polyfillash3string: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_polyfillash3string",
		origin: "vendor-docs",
	},
	h3_resolution: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_resolution",
		origin: "vendor-docs",
	},
	h3_stringtoh3: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_stringtoh3",
		origin: "vendor-docs",
	},
	h3_tessellateaswkb: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_tessellateaswkb",
		origin: "vendor-docs",
	},
	h3_tochildren: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_tochildren",
		origin: "vendor-docs",
	},
	h3_toparent: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_toparent",
		origin: "vendor-docs",
	},
	h3_try_coverash3: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_try_coverash3",
		origin: "vendor-docs",
	},
	h3_try_coverash3string: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_try_coverash3string",
		origin: "vendor-docs",
	},
	h3_try_distance: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_try_distance",
		origin: "vendor-docs",
	},
	h3_try_polyfillash3: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_try_polyfillash3",
		origin: "vendor-docs",
	},
	h3_try_polyfillash3string: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_try_polyfillash3string",
		origin: "vendor-docs",
	},
	h3_try_tessellateaswkb: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_try_tessellateaswkb",
		origin: "vendor-docs",
	},
	h3_try_validate: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_try_validate",
		origin: "vendor-docs",
	},
	h3_uncompact: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_uncompact",
		origin: "vendor-docs",
	},
	h3_validate: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/h3_validate",
		origin: "vendor-docs",
	},
	hash: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/hash",
		description: "Returns a hash value of the arguments.",
		origin: "spark-docs",
	},
	hex: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/hex",
		description: "Converts expr to hexadecimal.",
		origin: "spark-docs",
	},
	histogram_numeric: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/histogram_numeric",
		description: "Computes a histogram on numeric 'expr' using nb bins.",
		origin: "spark-docs",
	},
	hll_sketch_agg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/hll_sketch_agg",
		description: "Returns the HllSketch's updatable binary representation.",
		origin: "spark-docs",
	},
	hll_sketch_estimate: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/hll_sketch_estimate",
		description:
			"Returns the estimated number of unique values given the binary representation of a Datasketches HllSketch.",
		origin: "spark-docs",
	},
	hll_union: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/hll_union",
		description:
			"Merges two binary representations of Datasketches HllSketch objects, using a Datasketches Union object.",
		origin: "spark-docs",
	},
	hll_union_agg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/hll_union_agg",
		description: "Returns the estimated number of unique values.",
		origin: "spark-docs",
	},
	hour: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/hour",
		description: "Returns the hour component of the string/timestamp.",
		origin: "spark-docs",
	},
	hypot: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/hypot",
		description: "Returns sqrt( expr1 ² + expr2 ²).",
		origin: "spark-docs",
	},
	if: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/if",
		description: "If expr1 evaluates to true, then returns expr2; otherwise returns expr3.",
		origin: "spark-docs",
	},
	iff: { docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/iff", origin: "vendor-docs" },
	ifnull: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ifnull",
		description: "Returns expr2 if expr1 is null, or expr1 otherwise.",
		origin: "spark-docs",
	},
	initcap: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/initcap",
		description: "Returns str with the first letter of each word in uppercase.",
		origin: "spark-docs",
	},
	inline: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/inline",
		description: "Explodes an array of structs into a table.",
		origin: "spark-docs",
	},
	inline_outer: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/inline_outer",
		description: "Explodes an array of structs into a table.",
		origin: "spark-docs",
	},
	input_file_block_length: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/input_file_block_length",
		description: "Returns the length of the block being read, or -1 if not available.",
		origin: "spark-docs",
	},
	input_file_block_start: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/input_file_block_start",
		description: "Returns the start offset of the block being read, or -1 if not available.",
		origin: "spark-docs",
	},
	input_file_name: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/input_file_name",
		description: "Returns the name of the file being read, or empty string if not available.",
		origin: "spark-docs",
	},
	instr: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/instr",
		description: "Returns the (1-based) index of the first occurrence of substr in str.",
		origin: "spark-docs",
	},
	int: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/int",
		description: "Casts the value expr to the target data type int.",
		origin: "spark-docs",
	},
	ip_as_binary: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ip_as_binary",
		description: "Converts an IP address or CIDR notation to binary form.",
		origin: "authored",
	},
	ip_as_string: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ip_as_string",
		description: "Converts an IP address or CIDR notation to string representation.",
		origin: "authored",
	},
	ip_cidr: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ip_cidr",
		origin: "vendor-docs",
	},
	ip_cidr_contains: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ip_cidr_contains",
		description: "Returns true if a CIDR range contains a given IP address or another CIDR.",
		origin: "authored",
	},
	ip_host: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ip_host",
		origin: "vendor-docs",
	},
	ip_network: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ip_network",
		origin: "vendor-docs",
	},
	ip_network_first: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ip_network_first",
		description: "Returns the first IP address in a network range.",
		origin: "authored",
	},
	ip_network_last: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ip_network_last",
		description: "Returns the last IP address in a network range.",
		origin: "authored",
	},
	ip_prefix_length: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ip_prefix_length",
		origin: "vendor-docs",
	},
	ip_version: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ip_version",
		description: "Returns the IP version (4 or 6) of an IP address or CIDR.",
		origin: "authored",
	},
	is_account_group_member: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/is_account_group_member",
		origin: "vendor-docs",
	},
	is_member: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/is_member",
		origin: "vendor-docs",
	},
	is_valid_utf8: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/is_valid_utf8",
		description: "Returns true if str is a valid UTF-8 string, otherwise returns false.",
		origin: "spark-docs",
	},
	is_variant_null: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/is_variant_null",
		description: "Check if a variant value is a variant null.",
		origin: "spark-docs",
	},
	isnan: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/isnan",
		description: "Returns true if expr is NaN, or false otherwise.",
		origin: "spark-docs",
	},
	isnotnull: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/isnotnull",
		description: "Returns true if expr is not null, or false otherwise.",
		origin: "spark-docs",
	},
	isnull: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/isnull",
		description: "Returns true if expr is null, or false otherwise.",
		origin: "spark-docs",
	},
	java_method: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/java_method",
		description: "Calls a method with reflection.",
		origin: "spark-docs",
	},
	json_array_length: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/json_array_length",
		description: "Returns the number of elements in the outermost JSON array.",
		origin: "spark-docs",
	},
	json_object_keys: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/json_object_keys",
		description: "Returns all the keys of the outermost JSON object as an array.",
		origin: "spark-docs",
	},
	json_tuple: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/json_tuple",
		description: "Returns a tuple like the function get_json_object, but it takes multiple names.",
		origin: "spark-docs",
	},
	kll_merge_agg_bigint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_merge_agg_bigint",
		origin: "vendor-docs",
	},
	kll_merge_agg_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_merge_agg_double",
		origin: "vendor-docs",
	},
	kll_merge_agg_float: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_merge_agg_float",
		description:
			"Aggregates KLL float sketches by merging them incrementally to estimate quantiles across a dataset.",
		origin: "authored",
	},
	kll_sketch_agg_bigint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_agg_bigint",
		description: "Builds a KLL sketch from bigint values to enable approximate quantile queries on large datasets.",
		origin: "authored",
	},
	kll_sketch_agg_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_agg_double",
		description: "Builds a KLL sketch from double values to enable approximate quantile queries on large datasets.",
		origin: "authored",
	},
	kll_sketch_agg_float: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_agg_float",
		description: "Builds a KLL sketch from float values to enable approximate quantile queries on large datasets.",
		origin: "authored",
	},
	kll_sketch_get_n_bigint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_get_n_bigint",
		description: "Returns the count of items that were added to the bigint KLL sketch.",
		origin: "authored",
	},
	kll_sketch_get_n_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_get_n_double",
		description: "Returns the count of items that were added to the double KLL sketch.",
		origin: "authored",
	},
	kll_sketch_get_n_float: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_get_n_float",
		description: "Returns the count of items that were added to the float KLL sketch.",
		origin: "authored",
	},
	kll_sketch_get_quantile_bigint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_get_quantile_bigint",
		description: "Returns an approximate quantile value at the given rank from a bigint KLL sketch.",
		origin: "authored",
	},
	kll_sketch_get_quantile_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_get_quantile_double",
		description: "Returns an approximate quantile value at the given rank from a double KLL sketch.",
		origin: "authored",
	},
	kll_sketch_get_quantile_float: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_get_quantile_float",
		description: "Returns an approximate quantile value at the given rank from a float KLL sketch.",
		origin: "authored",
	},
	kll_sketch_get_rank_bigint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_get_rank_bigint",
		origin: "vendor-docs",
	},
	kll_sketch_get_rank_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_get_rank_double",
		origin: "vendor-docs",
	},
	kll_sketch_get_rank_float: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_get_rank_float",
		origin: "vendor-docs",
	},
	kll_sketch_merge_bigint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_merge_bigint",
		description: "Merges two bigint KLL sketches into a single sketch representing both datasets.",
		origin: "authored",
	},
	kll_sketch_merge_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_merge_double",
		description: "Merges two double KLL sketches into a single sketch representing both datasets.",
		origin: "authored",
	},
	kll_sketch_merge_float: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_merge_float",
		description: "Merges two float KLL sketches into a single sketch representing both datasets.",
		origin: "authored",
	},
	kll_sketch_to_string_bigint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_to_string_bigint",
		origin: "vendor-docs",
	},
	kll_sketch_to_string_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_to_string_double",
		origin: "vendor-docs",
	},
	kll_sketch_to_string_float: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kll_sketch_to_string_float",
		origin: "vendor-docs",
	},
	kurtosis: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/kurtosis",
		description: "Returns the kurtosis value calculated from values of a group.",
		origin: "spark-docs",
	},
	lag: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/lag",
		description: "Returns the value of input at the offset th row before the current row in the window.",
		origin: "spark-docs",
	},
	last: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/last",
		description: "Returns the last value of expr for a group of rows.",
		origin: "spark-docs",
	},
	last_day: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/last_day",
		description: "Returns the last day of the month which the date belongs to.",
		origin: "spark-docs",
	},
	last_value: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/last_value",
		description: "Returns the last value of expr for a group of rows.",
		origin: "spark-docs",
	},
	lcase: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/lcase",
		description: "Returns str with all characters changed to lowercase.",
		origin: "spark-docs",
	},
	lead: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/lead",
		description: "Returns the value of input at the offset th row after the current row in the window.",
		origin: "spark-docs",
	},
	least: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/least",
		description: "Returns the least value of all parameters, skipping null values.",
		origin: "spark-docs",
	},
	left: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/left",
		description:
			"Returns the leftmost len ( len can be string type) characters from the string str,if len is less or equal than 0 the result is an empty string.",
		origin: "spark-docs",
	},
	len: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/len",
		description: "Returns the character length of string data or number of bytes of binary data.",
		origin: "spark-docs",
	},
	length: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/length",
		description: "Returns the character length of string data or number of bytes of binary data.",
		origin: "spark-docs",
	},
	levenshtein: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/levenshtein",
		description: "Returns the Levenshtein distance between the two given strings.",
		origin: "spark-docs",
	},
	list_secrets: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/list_secrets",
		origin: "vendor-docs",
	},
	listagg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/listagg",
		description: "Returns the concatenation of non-NULL input values, separated by the delimiter ordered by key.",
		origin: "spark-docs",
	},
	ln: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ln",
		description: "Returns the natural logarithm (base e) of expr.",
		origin: "spark-docs",
	},
	locate: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/locate",
		description: "Returns the position of the first occurrence of substr in str after position pos.",
		origin: "spark-docs",
	},
	log10: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/log10",
		description: "Returns the logarithm of expr with base 10.",
		origin: "spark-docs",
	},
	log1p: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/log1p",
		description: "Returns log(1 + expr).",
		origin: "spark-docs",
	},
	log2: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/log2",
		description: "Returns the logarithm of expr with base 2.",
		origin: "spark-docs",
	},
	lower: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/lower",
		description: "Returns str with all characters changed to lowercase.",
		origin: "spark-docs",
	},
	lpad: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/lpad",
		description: "Returns str, left-padded with pad to a length of len.",
		origin: "spark-docs",
	},
	luhn_check: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/luhn_check",
		description: "Checks that a string of digits is valid according to the Luhn algorithm.",
		origin: "spark-docs",
	},
	make_date: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/make_date",
		description: "Create date from year, month and day fields.",
		origin: "spark-docs",
	},
	make_time: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/make_time",
		description: "Constructs a time value from hour, minute, and second components.",
		origin: "authored",
	},
	make_timestamp: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/make_timestamp",
		description: "Create timestamp from year, month, day, hour, min, sec and timezone fields.",
		origin: "spark-docs",
	},
	make_valid_utf8: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/make_valid_utf8",
		description:
			"Returns the original string if str is a valid UTF-8 string, otherwise returns a new string whose invalid UTF8 byte sequences are replaced using the UNICODE replacement character U+FFFD.",
		origin: "spark-docs",
	},
	map_contains_key: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/map_contains_key",
		description: "Returns true if the map contains the key.",
		origin: "spark-docs",
	},
	map_entries: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/map_entries",
		description: "Returns an unordered array of all entries in the given map.",
		origin: "spark-docs",
	},
	map_filter: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/map_filter",
		description: "Filters entries in a map using the function.",
		origin: "spark-docs",
	},
	map_from_arrays: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/map_from_arrays",
		description: "Creates a map with a pair of the given key/value arrays.",
		origin: "spark-docs",
	},
	map_from_entries: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/map_from_entries",
		description: "Returns a map created from the given array of entries.",
		origin: "spark-docs",
	},
	map_keys: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/map_keys",
		description: "Returns an unordered array containing the keys of the map.",
		origin: "spark-docs",
	},
	map_values: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/map_values",
		description: "Returns an unordered array containing the values of the map.",
		origin: "spark-docs",
	},
	map_zip_with: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/map_zip_with",
		description:
			"Merges two given maps into a single map by applying function to the pair of values with the same key.",
		origin: "spark-docs",
	},
	mask: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/mask",
		description: "masks the given string value.",
		origin: "spark-docs",
	},
	match_number: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/match_number",
		description: "Returns the ordinal position of the current match within a MATCH_RECOGNIZE clause.",
		origin: "authored",
	},
	max: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/max",
		description: "Returns the maximum value of expr.",
		origin: "spark-docs",
	},
	max_by: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/max_by",
		description: "Returns the value of x associated with the maximum value of y.",
		origin: "spark-docs",
	},
	md5: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/md5",
		description: "Returns an MD5 128-bit checksum as a hex string of expr.",
		origin: "spark-docs",
	},
	mean: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/mean",
		description: "Returns the mean calculated from values of a group.",
		origin: "spark-docs",
	},
	measure: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/measure",
		description: "Evaluates a measure defined in a semantic model and returns its computed value.",
		origin: "authored",
	},
	median: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/median",
		description: "Returns the median of numeric or ANSI interval column col.",
		origin: "spark-docs",
	},
	min: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/min",
		description: "Returns the minimum value of expr.",
		origin: "spark-docs",
	},
	min_by: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/min_by",
		description: "Returns the value of x associated with the minimum value of y.",
		origin: "spark-docs",
	},
	minute: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/minute",
		description: "Returns the minute component of the string/timestamp.",
		origin: "spark-docs",
	},
	mod: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/mod",
		description: "Returns the remainder after expr1 / expr2.",
		origin: "spark-docs",
	},
	mode: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/mode",
		description: "Returns the most frequent value for the values within col.",
		origin: "spark-docs",
	},
	monotonically_increasing_id: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/monotonically_increasing_id",
		description: "Returns monotonically increasing 64-bit integers.",
		origin: "spark-docs",
	},
	month: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/month",
		description: "Returns the month component of the date/timestamp.",
		origin: "spark-docs",
	},
	months_between: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/months_between",
		description: "If timestamp1 is later than timestamp2, then the result is positive.",
		origin: "spark-docs",
	},
	nanvl: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/nanvl",
		description: "Returns expr1 if it's not NaN, or expr2 otherwise.",
		origin: "spark-docs",
	},
	negative: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/negative",
		description: "Returns the negated value of expr.",
		origin: "spark-docs",
	},
	next_day: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/next_day",
		description: "Returns the first date which is later than start_date and named as indicated.",
		origin: "spark-docs",
	},
	now: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/now",
		description: "Returns the current timestamp at the start of query evaluation.",
		origin: "spark-docs",
	},
	nth_value: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/nth_value",
		description:
			"Returns the value of input at the row that is the offset th row from beginning of the window frame.",
		origin: "spark-docs",
	},
	ntile: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ntile",
		description: "Divides the rows for each window partition into n buckets ranging from 1 to at most n.",
		origin: "spark-docs",
	},
	nullif: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/nullif",
		description: "Returns null if expr1 equals to expr2, or expr1 otherwise.",
		origin: "spark-docs",
	},
	nullifzero: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/nullifzero",
		description: "Returns null if expr is equal to zero, or expr otherwise.",
		origin: "spark-docs",
	},
	nvl: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/nvl",
		description: "Returns expr2 if expr1 is null, or expr1 otherwise.",
		origin: "spark-docs",
	},
	nvl2: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/nvl2",
		description: "Returns expr2 if expr1 is not null, or expr3 otherwise.",
		origin: "spark-docs",
	},
	octet_length: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/octet_length",
		description: "Returns the byte length of string data or number of bytes of binary data.",
		origin: "spark-docs",
	},
	overlay: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/overlay",
		description: "Replace input with replace that starts at pos and is of length len.",
		origin: "spark-docs",
	},
	parse_json: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/parse_json",
		description: "Parse a JSON string as a Variant value.",
		origin: "spark-docs",
	},
	parse_url: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/parse_url",
		description: "Extracts a part from a URL.",
		origin: "spark-docs",
	},
	percent_rank: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/percent_rank",
		description: "Computes the percentage ranking of a value in a group of values.",
		origin: "spark-docs",
	},
	percentile: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/percentile",
		description:
			"Returns the exact percentile value of numeric or ANSI interval column col at the given percentage.",
		origin: "spark-docs",
	},
	percentile_approx: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/percentile_approx",
		description:
			"Returns the approximate percentile of the numeric or ansi interval column col which is the smallest value in the ordered col values (sorted from least to greatest) such that no more than percentage of col values is less than the value or equal to that value.",
		origin: "spark-docs",
	},
	percentile_cont: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/percentile_cont",
		description:
			"Return a percentile value based on a continuous distribution of numeric or ANSI interval column col at the given percentage (specified in ORDER BY clause).",
		origin: "spark-docs",
	},
	percentile_disc: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/percentile_disc",
		description:
			"Return a percentile value based on a discrete distribution of numeric or ANSI interval column col at the given percentage (specified in ORDER BY clause).",
		origin: "spark-docs",
	},
	pi: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/pi",
		description: "Returns pi.",
		origin: "spark-docs",
	},
	pmod: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/pmod",
		description: "Returns the positive value of expr1 mod expr2.",
		origin: "spark-docs",
	},
	posexplode: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/posexplode",
		description:
			"Separates the elements of array expr into multiple rows with positions, or the elements of map expr into multiple rows and columns with positions.",
		origin: "spark-docs",
	},
	posexplode_outer: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/posexplode_outer",
		description:
			"Separates the elements of array expr into multiple rows with positions, or the elements of map expr into multiple rows and columns with positions.",
		origin: "spark-docs",
	},
	position: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/position",
		description: "Returns the position of the first occurrence of substr in str after position pos.",
		origin: "spark-docs",
	},
	positive: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/positive",
		description: "Returns the value of expr.",
		origin: "spark-docs",
	},
	pow: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/pow",
		description: "Raises expr1 to the power of expr2.",
		origin: "spark-docs",
	},
	power: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/power",
		description: "Raises expr1 to the power of expr2.",
		origin: "spark-docs",
	},
	quarter: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/quarter",
		description: "Returns the quarter of the year for date, in the range 1 to 4.",
		origin: "spark-docs",
	},
	radians: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/radians",
		description: "Converts degrees to radians.",
		origin: "spark-docs",
	},
	raise_error: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/raise_error",
		description: "Throws a USER_RAISED_EXCEPTION with expr as message.",
		origin: "spark-docs",
	},
	rand: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/rand",
		description:
			"Returns a random value with independent and identically distributed (i.i.d.) uniformly distributed values in [0, 1).",
		origin: "spark-docs",
	},
	randn: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/randn",
		description:
			"Returns a random value with independent and identically distributed (i.i.d.) values drawn from the standard normal distribution.",
		origin: "spark-docs",
	},
	random: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/random",
		description:
			"Returns a random value with independent and identically distributed (i.i.d.) uniformly distributed values in [0, 1).",
		origin: "spark-docs",
	},
	randstr: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/randstr",
		description:
			"Returns a string of the specified length whose characters are chosen uniformly at random from the following pool of characters: 0-9, a-z, A-Z.",
		origin: "spark-docs",
	},
	range: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/range",
		description: "Returns a table of values within a specified range.",
		origin: "spark-docs",
	},
	rank: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/rank",
		description: "Computes the rank of a value in a group of values.",
		origin: "spark-docs",
	},
	read_state_metadata: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/read_state_metadata",
		origin: "vendor-docs",
	},
	reduce: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/reduce",
		description:
			"Applies a binary operator to an initial state and all elements in the array, and reduces this to a single state.",
		origin: "spark-docs",
	},
	regexp_count: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regexp_count",
		description:
			"Returns a count of the number of times that the regular expression pattern regexp is matched in the string str.",
		origin: "spark-docs",
	},
	regexp_extract: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regexp_extract",
		description:
			"Extract the first string in the str that match the regexp expression and corresponding to the regex group index.",
		origin: "spark-docs",
	},
	regexp_extract_all: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regexp_extract_all",
		description:
			"Extract all strings in the str that match the regexp expression and corresponding to the regex group index.",
		origin: "spark-docs",
	},
	regexp_instr: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regexp_instr",
		description:
			"Searches a string for a regular expression and returns an integer that indicates the beginning position of the matched substring.",
		origin: "spark-docs",
	},
	regexp_replace: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regexp_replace",
		description: "Replaces all substrings of str that match regexp with rep.",
		origin: "spark-docs",
	},
	regexp_substr: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regexp_substr",
		description: "Returns the substring that matches the regular expression regexp within the string str.",
		origin: "spark-docs",
	},
	regr_avgx: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regr_avgx",
		description:
			"Returns the average of the independent variable for non-null pairs in a group, where y is the dependent variable and x is the independent variable.",
		origin: "spark-docs",
	},
	regr_avgy: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regr_avgy",
		description:
			"Returns the average of the dependent variable for non-null pairs in a group, where y is the dependent variable and x is the independent variable.",
		origin: "spark-docs",
	},
	regr_count: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regr_count",
		description:
			"Returns the number of non-null number pairs in a group, where y is the dependent variable and x is the independent variable.",
		origin: "spark-docs",
	},
	regr_intercept: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regr_intercept",
		description:
			"Returns the intercept of the univariate linear regression line for non-null pairs in a group, where y is the dependent variable and x is the independent variable.",
		origin: "spark-docs",
	},
	regr_r2: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regr_r2",
		description:
			"Returns the coefficient of determination for non-null pairs in a group, where y is the dependent variable and x is the independent variable.",
		origin: "spark-docs",
	},
	regr_slope: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regr_slope",
		description:
			"Returns the slope of the linear regression line for non-null pairs in a group, where y is the dependent variable and x is the independent variable.",
		origin: "spark-docs",
	},
	regr_sxx: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regr_sxx",
		description:
			"Returns REGR_COUNT(y, x) * VAR_POP(x) for non-null pairs in a group, where y is the dependent variable and x is the independent variable.",
		origin: "spark-docs",
	},
	regr_sxy: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regr_sxy",
		description:
			"Returns REGR_COUNT(y, x) * COVAR_POP(y, x) for non-null pairs in a group, where y is the dependent variable and x is the independent variable.",
		origin: "spark-docs",
	},
	regr_syy: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/regr_syy",
		description:
			"Returns REGR_COUNT(y, x) * VAR_POP(y) for non-null pairs in a group, where y is the dependent variable and x is the independent variable.",
		origin: "spark-docs",
	},
	repeat: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/repeat",
		description: "Returns the string which repeats the given string value n times.",
		origin: "spark-docs",
	},
	replace: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/replace",
		description: "Replaces all occurrences of search with replace.",
		origin: "spark-docs",
	},
	reverse: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/reverse",
		description: "Returns a reversed string or an array with reverse order of elements.",
		origin: "spark-docs",
	},
	right: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/right",
		description:
			"Returns the rightmost len ( len can be string type) characters from the string str,if len is less or equal than 0 the result is an empty string.",
		origin: "spark-docs",
	},
	rint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/rint",
		description:
			"Returns the double value that is closest in value to the argument and is equal to a mathematical integer.",
		origin: "spark-docs",
	},
	round: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/round",
		description: "Returns expr rounded to d decimal places using HALF_UP rounding mode.",
		origin: "spark-docs",
	},
	row_number: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/row_number",
		description:
			"Assigns a unique, sequential number to each row, starting with one, according to the ordering of rows within the window partition.",
		origin: "spark-docs",
	},
	rpad: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/rpad",
		description: "Returns str, right-padded with pad to a length of len.",
		origin: "spark-docs",
	},
	schema_of_csv: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/schema_of_csv",
		description: "Returns schema in the DDL format of CSV string.",
		origin: "spark-docs",
	},
	schema_of_json: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/schema_of_json",
		description: "Returns schema in the DDL format of JSON string.",
		origin: "spark-docs",
	},
	schema_of_json_agg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/schema_of_json_agg",
		origin: "vendor-docs",
	},
	schema_of_variant: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/schema_of_variant",
		description: "Returns schema in the SQL format of a variant.",
		origin: "spark-docs",
	},
	schema_of_variant_agg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/schema_of_variant_agg",
		description: "Returns the merged schema in the SQL format of a variant column.",
		origin: "spark-docs",
	},
	schema_of_xml: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/schema_of_xml",
		description: "Returns schema in the DDL format of XML string.",
		origin: "spark-docs",
	},
	sec: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/sec",
		description: "Returns the secant of expr, as if computed by 1/java.lang.Math.cos.",
		origin: "spark-docs",
	},
	second: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/second",
		description: "Returns the second component of the string/timestamp.",
		origin: "spark-docs",
	},
	secret: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/secret",
		description: "Retrieves the value of a secret from the specified scope and key.",
		origin: "authored",
	},
	sequence: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/sequence",
		description: "Generates an array of elements from start to stop (inclusive), incrementing by step.",
		origin: "spark-docs",
	},
	session_user: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/session_user",
		description: "user name of current execution context.",
		origin: "spark-docs",
	},
	session_window: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/session_window",
		description: "Generates session window given a timestamp specifying column and gap duration.",
		origin: "spark-docs",
	},
	sha: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/sha",
		description: "Returns a sha1 hash value as a hex string of the expr.",
		origin: "spark-docs",
	},
	sha1: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/sha1",
		description: "Returns a sha1 hash value as a hex string of the expr.",
		origin: "spark-docs",
	},
	sha2: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/sha2",
		description: "Returns a checksum of SHA-2 family as a hex string of expr.",
		origin: "spark-docs",
	},
	shiftleft: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/shiftleft",
		description: "Bitwise left shift.",
		origin: "spark-docs",
	},
	shiftright: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/shiftright",
		description: "Bitwise (signed) right shift.",
		origin: "spark-docs",
	},
	shiftrightunsigned: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/shiftrightunsigned",
		description: "Bitwise unsigned right shift.",
		origin: "spark-docs",
	},
	shuffle: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/shuffle",
		description: "Returns a random permutation of the given array.",
		origin: "spark-docs",
	},
	sign: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/sign",
		description: "Returns -1.0, 0.0 or 1.0 as expr is negative, 0 or positive.",
		origin: "spark-docs",
	},
	signum: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/signum",
		description: "Returns -1.0, 0.0 or 1.0 as expr is negative, 0 or positive.",
		origin: "spark-docs",
	},
	sin: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/sin",
		description: "Returns the sine of expr, as if computed by java.lang.Math.sin.",
		origin: "spark-docs",
	},
	sinh: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/sinh",
		description: "Returns hyperbolic sine of expr, as if computed by java.lang.Math.sinh.",
		origin: "spark-docs",
	},
	size: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/size",
		description: "Returns the size of an array or a map.",
		origin: "spark-docs",
	},
	skewness: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/skewness",
		description: "Returns the skewness value calculated from values of a group.",
		origin: "spark-docs",
	},
	slice: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/slice",
		description:
			"Subsets array x starting from index start (array indices start at 1, or starting from the end if start is negative) with the specified length.",
		origin: "spark-docs",
	},
	smallint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/smallint",
		description: "Casts the value expr to the target data type smallint.",
		origin: "spark-docs",
	},
	sort_array: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/sort_array",
		description:
			"Sorts the input array in ascending or descending order according to the natural ordering of the array elements.",
		origin: "spark-docs",
	},
	soundex: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/soundex",
		description: "Returns Soundex code of the string.",
		origin: "spark-docs",
	},
	space: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/space",
		description: "Returns a string consisting of n spaces.",
		origin: "spark-docs",
	},
	spark_partition_id: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/spark_partition",
		description: "Returns the current partition id.",
		origin: "spark-docs",
	},
	split: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/split",
		description:
			"Splits str around occurrences that match regex and returns an array with a length of at most limit",
		origin: "spark-docs",
	},
	split_part: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/split_part",
		description: "Splits str by delimiter and return requested part of the split (1-based).",
		origin: "spark-docs",
	},
	sql_keywords: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/sql_keywords",
		description: "Get Spark SQL keywords",
		origin: "spark-docs",
	},
	sqrt: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/sqrt",
		description: "Returns the square root of expr.",
		origin: "spark-docs",
	},
	st_addpoint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_addpoint",
		description: "Adds a point to a geometry or geography, optionally at a specified index position.",
		origin: "authored",
	},
	st_area: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_area",
		origin: "vendor-docs",
	},
	st_asbinary: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_asbinary",
		description: "Converts a geometry or geography to its well-known binary (WKB) representation.",
		origin: "authored",
	},
	st_asewkb: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_asewkb",
		description: "Converts a geometry or geography to extended well-known binary (EWKB) format.",
		origin: "authored",
	},
	st_asgeojson: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_asgeojson",
		description: "Converts a geometry or geography to GeoJSON format.",
		origin: "authored",
	},
	st_astext: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_astext",
		description: "Converts a geometry or geography to its well-known text (WKT) representation.",
		origin: "authored",
	},
	st_aswkb: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_aswkb",
		description: "Converts a geometry or geography to well-known binary (WKB) format.",
		origin: "authored",
	},
	st_aswkt: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_aswkt",
		description: "Converts a geometry or geography to well-known text (WKT) format.",
		origin: "authored",
	},
	st_azimuth: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_azimuth",
		description: "Calculates the azimuth (bearing angle) from the first geometry to the second.",
		origin: "authored",
	},
	st_boundary: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_boundary",
		description: "Returns the boundary geometry of a given geometry.",
		origin: "authored",
	},
	st_buffer: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_buffer",
		description: "Creates a buffer polygon at a specified distance around a geometry.",
		origin: "authored",
	},
	st_centroid: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_centroid",
		description: "Returns the centroid (geometric center) of a geometry.",
		origin: "authored",
	},
	st_closestpoint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_closestpoint",
		description: "Returns the closest point on the first geometry to the second geometry.",
		origin: "authored",
	},
	st_collect: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_collect",
		origin: "vendor-docs",
	},
	st_concavehull: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_concavehull",
		description:
			"Returns the concave hull of a geometry, with the lengthRatio parameter controlling the degree of concavity.",
		origin: "authored",
	},
	st_contains: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_contains",
		description: "Tests whether the first geometry completely contains the second geometry.",
		origin: "authored",
	},
	st_convexhull: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_convexhull",
		description: "Returns the convex hull of a geometry, the smallest convex polygon containing all points.",
		origin: "authored",
	},
	st_covers: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_covers",
		description: "Tests whether the first geometry covers the second geometry without necessarily containing it.",
		origin: "authored",
	},
	st_difference: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_difference",
		description: "Returns the portion of the first geometry that does not intersect with the second geometry.",
		origin: "authored",
	},
	st_dimension: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_dimension",
		description: "Returns the dimension of a geometry as an integer: 0 for point, 1 for line, 2 for polygon.",
		origin: "authored",
	},
	st_disjoint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_disjoint",
		description: "Tests whether two geometries have no points in common.",
		origin: "authored",
	},
	st_distance: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_distance",
		description: "Calculates the shortest distance between two geometries.",
		origin: "authored",
	},
	st_distancesphere: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_distancesphere",
		origin: "vendor-docs",
	},
	st_distancespheroid: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_distancespheroid",
		origin: "vendor-docs",
	},
	st_dump: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_dump",
		description: "Breaks down a geometry into its constituent single-part geometries.",
		origin: "authored",
	},
	st_dwithin: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_dwithin",
		description: "Tests whether two geometries are within a specified distance of each other.",
		origin: "authored",
	},
	st_endpoint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_endpoint",
		origin: "vendor-docs",
	},
	st_envelope: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_envelope",
		description: "Returns the minimum bounding rectangle (axis-aligned box) of a geometry.",
		origin: "authored",
	},
	st_envelope_agg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_envelope_agg",
		description: "Returns the aggregate minimum bounding rectangle of multiple geometries across rows.",
		origin: "authored",
	},
	st_equals: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_equals",
		description: "Tests whether two geometries are spatially equal.",
		origin: "authored",
	},
	st_estimatesrid: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_estimatesrid",
		origin: "vendor-docs",
	},
	st_exteriorring: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_exteriorring",
		description: "Returns the exterior ring of a polygon as a line string.",
		origin: "authored",
	},
	st_flipcoordinates: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_flipcoordinates",
		description: "Swaps the X and Y coordinates of a geometry.",
		origin: "authored",
	},
	st_force2d: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_force2d",
		description: "Converts a geometry to 2D by removing the Z coordinate.",
		origin: "authored",
	},
	st_geogfromewkt: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geogfromewkt",
		description: "Constructs a geography from an Extended Well-Known Text (EWKT) string.",
		origin: "authored",
	},
	st_geogfromgeojson: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geogfromgeojson",
		origin: "vendor-docs",
	},
	st_geogfromtext: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geogfromtext",
		description: "Constructs a geography from a Well-Known Text (WKT) string.",
		origin: "authored",
	},
	st_geogfromwkb: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geogfromwkb",
		description: "Constructs a geography from Well-Known Binary (WKB) format.",
		origin: "authored",
	},
	st_geogfromwkt: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geogfromwkt",
		description: "Constructs a geography from a Well-Known Text (WKT) string.",
		origin: "authored",
	},
	st_geohash: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geohash",
		description: "Encodes a geometry as a Geohash string with optional precision parameter.",
		origin: "authored",
	},
	st_geometryn: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geometryn",
		description: "Returns the nth geometry from a geometry collection (1-indexed).",
		origin: "authored",
	},
	st_geometrytype: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geometrytype",
		origin: "vendor-docs",
	},
	st_geomfromewkb: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geomfromewkb",
		description: "Constructs a geometry from Extended Well-Known Binary (EWKB) format.",
		origin: "authored",
	},
	st_geomfromewkt: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geomfromewkt",
		description: "Constructs a geometry from an Extended Well-Known Text (EWKT) string.",
		origin: "authored",
	},
	st_geomfromgeohash: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geomfromgeohash",
		description: "Constructs a geometry from a Geohash string.",
		origin: "authored",
	},
	st_geomfromgeojson: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geomfromgeojson",
		origin: "vendor-docs",
	},
	st_geomfromtext: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geomfromtext",
		description: "Constructs a geometry from a Well-Known Text (WKT) string with optional SRID.",
		origin: "authored",
	},
	st_geomfromwkb: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geomfromwkb",
		description: "Constructs a geometry from Well-Known Binary (WKB) format with optional SRID.",
		origin: "authored",
	},
	st_geomfromwkt: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_geomfromwkt",
		description: "Constructs a geometry from a Well-Known Text (WKT) string with optional SRID.",
		origin: "authored",
	},
	st_interiorringn: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_interiorringn",
		description: "Returns the nth interior ring (hole) of a polygon (1-indexed).",
		origin: "authored",
	},
	st_intersection: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_intersection",
		description: "Returns the geometry formed by the points common to both input geometries.",
		origin: "authored",
	},
	st_intersects: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_intersects",
		description: "Tests whether two geometries share any space.",
		origin: "authored",
	},
	st_isempty: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_isempty",
		description: "Tests whether a geometry is empty.",
		origin: "authored",
	},
	st_isvalid: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_isvalid",
		origin: "vendor-docs",
	},
	st_length: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_length",
		description: "Returns the length of the geometry along its edges.",
		origin: "authored",
	},
	st_m: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_m",
		description: "Extracts the M (measure) coordinate from a point.",
		origin: "authored",
	},
	st_makeenvelope: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_makeenvelope",
		description: "Creates a rectangular geometry (envelope) from the given corner coordinates.",
		origin: "authored",
	},
	st_makeline: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_makeline",
		description: "Creates a line geometry from an array of point geometries.",
		origin: "authored",
	},
	st_makepoint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_makepoint",
		description: "Creates a point geometry from x and y coordinates, optionally z and m values.",
		origin: "authored",
	},
	st_makepolygon: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_makepolygon",
		description: "Creates a polygon geometry from an exterior ring and optional interior rings.",
		origin: "authored",
	},
	st_multi: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_multi",
		description: "Converts a geometry to a multi-type geometry (Multi-Point, Multi-Line, or Multi-Polygon).",
		origin: "authored",
	},
	st_ndims: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_ndims",
		description: "Returns the number of dimensions (2, 3, or 4) in the geometry.",
		origin: "authored",
	},
	st_npoints: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_npoints",
		description: "Returns the number of points that make up the geometry.",
		origin: "authored",
	},
	st_nrings: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_nrings",
		description: "Returns the number of rings in the geometry.",
		origin: "authored",
	},
	st_numgeometries: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_numgeometries",
		description: "Returns the number of component geometries in a multi-geometry.",
		origin: "authored",
	},
	st_numinteriorrings: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_numinteriorrings",
		description: "Returns the number of interior rings (holes) in a polygon.",
		origin: "authored",
	},
	st_numpoints: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_numpoints",
		description: "Returns the number of points in the geometry.",
		origin: "authored",
	},
	st_perimeter: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_perimeter",
		description: "Returns the perimeter (boundary length) of the geometry.",
		origin: "authored",
	},
	st_point: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_point",
		description: "Creates a point geometry from x and y coordinates, optionally specifying an SRID.",
		origin: "authored",
	},
	st_pointfromgeohash: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_pointfromgeohash",
		description: "Creates a point geometry from a geohash string.",
		origin: "authored",
	},
	st_pointn: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_pointn",
		description: "Returns the point at the specified index position in the geometry.",
		origin: "authored",
	},
	st_pointonsurface: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_pointonsurface",
		description: "Returns a point that is guaranteed to lie on the surface of the geometry.",
		origin: "authored",
	},
	st_removepoint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_removepoint",
		description: "Removes the point at the specified index from a geometry.",
		origin: "authored",
	},
	st_reverse: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_reverse",
		description: "Returns a geometry with the order of points reversed.",
		origin: "authored",
	},
	st_rotate: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_rotate",
		origin: "vendor-docs",
	},
	st_scale: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_scale",
		description: "Returns a geometry scaled by the given factors along x, y, and optionally z axes.",
		origin: "authored",
	},
	st_setpoint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_setpoint",
		description: "Returns a geometry with the point at the specified index replaced by another point.",
		origin: "authored",
	},
	st_setsrid: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_setsrid",
		description: "Returns the geometry with the spatial reference system ID set to the specified value.",
		origin: "authored",
	},
	st_simplify: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_simplify",
		description: "Returns a simplified geometry removing points within the specified tolerance distance.",
		origin: "authored",
	},
	st_srid: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_srid",
		description: "Returns the spatial reference system ID associated with the geometry.",
		origin: "authored",
	},
	st_startpoint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_startpoint",
		description: "Returns the first point of a line or ring geometry.",
		origin: "authored",
	},
	st_touches: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_touches",
		description: "Tests whether two geometries touch at one or more points without overlapping.",
		origin: "authored",
	},
	st_transform: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_transform",
		description: "Transforms the geometry to a different spatial reference system identified by the SRID.",
		origin: "authored",
	},
	st_translate: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_translate",
		description:
			"Returns a geometry translated (moved) by the specified distance along x, y, and optionally z axes.",
		origin: "authored",
	},
	st_union: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_union",
		description: "Returns the geometric union of two geometries.",
		origin: "authored",
	},
	st_union_agg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_union_agg",
		description: "Aggregates the union of all geometries in a column into a single geometry.",
		origin: "authored",
	},
	st_within: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_within",
		description: "Tests whether the first geometry is completely within the second geometry.",
		origin: "authored",
	},
	st_x: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_x",
		description: "Extracts the X coordinate from a point.",
		origin: "authored",
	},
	st_xmax: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_xmax",
		description: "Returns the maximum X coordinate of the geometry's bounding box.",
		origin: "authored",
	},
	st_xmin: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_xmin",
		description: "Returns the minimum X coordinate of the geometry's bounding box.",
		origin: "authored",
	},
	st_y: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_y",
		description: "Extracts the Y coordinate from a point.",
		origin: "authored",
	},
	st_ymax: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_ymax",
		description: "Returns the maximum Y coordinate of the geometry's bounding box.",
		origin: "authored",
	},
	st_ymin: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_ymin",
		description: "Returns the minimum Y coordinate of the geometry's bounding box.",
		origin: "authored",
	},
	st_z: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_z",
		description: "Extracts the Z coordinate from a point.",
		origin: "authored",
	},
	st_zmax: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_zmax",
		description: "Returns the maximum Z coordinate value of a geospatial object.",
		origin: "authored",
	},
	st_zmin: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/st_zmin",
		description: "Returns the minimum Z coordinate value of a geospatial object.",
		origin: "authored",
	},
	stack: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/stack",
		description: "Separates expr1,..., exprk into n rows.",
		origin: "spark-docs",
	},
	startswith: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/startswith",
		description:
			"Returns a boolean. The value is True if left starts with right. Returns NULL if either input expression is NULL. Otherwise, returns False. Both left or right must be of STRING or BINARY type.",
		origin: "spark-docs",
	},
	std: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/std",
		description: "Returns the sample standard deviation calculated from values of a group.",
		origin: "spark-docs",
	},
	stddev: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/stddev",
		description: "Returns the sample standard deviation calculated from values of a group.",
		origin: "spark-docs",
	},
	stddev_pop: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/stddev_pop",
		description: "Returns the population standard deviation calculated from values of a group.",
		origin: "spark-docs",
	},
	stddev_samp: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/stddev_samp",
		description: "Returns the sample standard deviation calculated from values of a group.",
		origin: "spark-docs",
	},
	str_to_map: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/str_to_map",
		description: "Creates a map after splitting the text into key/value pairs using delimiters.",
		origin: "spark-docs",
	},
	string: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/string",
		description: "Casts the value expr to the target data type string.",
		origin: "spark-docs",
	},
	string_agg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/string_agg",
		description: "Returns the concatenation of non-NULL input values, separated by the delimiter ordered by key.",
		origin: "spark-docs",
	},
	substr: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/substr",
		description:
			"Returns the substring of str that starts at pos and is of length len, or the slice of byte array that starts at pos and is of length len.",
		origin: "spark-docs",
	},
	substring: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/substring",
		description:
			"Returns the substring of str that starts at pos and is of length len, or the slice of byte array that starts at pos and is of length len.",
		origin: "spark-docs",
	},
	substring_index: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/substring_index",
		description: "Returns the substring from str before count occurrences of the delimiter delim.",
		origin: "spark-docs",
	},
	sum: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/sum",
		description: "Returns the sum calculated from values of a group.",
		origin: "spark-docs",
	},
	table_changes: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/table_changes",
		description: "Returns change data capture records from a Delta table between specified versions or timestamps.",
		origin: "authored",
	},
	tan: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tan",
		description: "Returns the tangent of expr, as if computed by java.lang.Math.tan.",
		origin: "spark-docs",
	},
	tanh: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tanh",
		description: "Returns the hyperbolic tangent of expr, as if computed by java.lang.Math.tanh.",
		origin: "spark-docs",
	},
	theta_difference: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/theta_difference",
		description: "Returns a theta sketch representing elements in the first sketch but not in the second.",
		origin: "authored",
	},
	theta_intersection: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/theta_intersection",
		description: "Returns a theta sketch representing elements common to both input sketches.",
		origin: "authored",
	},
	theta_intersection_agg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/theta_intersection_agg",
		description: "Aggregates theta sketches by computing their intersection over a set of rows.",
		origin: "authored",
	},
	theta_sketch_agg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/theta_sketch_agg",
		description: "Aggregates distinct values into a theta sketch for cardinality estimation.",
		origin: "authored",
	},
	theta_sketch_estimate: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/theta_sketch_estimate",
		description: "Returns the cardinality estimate from a theta sketch.",
		origin: "authored",
	},
	theta_union: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/theta_union",
		description: "Returns a theta sketch representing elements present in either or both input sketches.",
		origin: "authored",
	},
	theta_union_agg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/theta_union_agg",
		description: "Aggregates theta sketches by computing their union over a set of rows.",
		origin: "authored",
	},
	time_diff: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/time_diff",
		origin: "vendor-docs",
	},
	time_from_micros: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/time_from_micros",
		description: "Creates a time value from an integer representing microseconds since midnight.",
		origin: "authored",
	},
	time_from_millis: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/time_from_millis",
		description: "Creates a time value from an integer representing milliseconds since midnight.",
		origin: "authored",
	},
	time_from_seconds: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/time_from_seconds",
		description: "Creates a time value from an integer representing seconds since midnight.",
		origin: "authored",
	},
	time_to_micros: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/time_to_micros",
		description: "Converts a time value to the number of microseconds since midnight.",
		origin: "authored",
	},
	time_to_millis: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/time_to_millis",
		description: "Converts a time value to the number of milliseconds since midnight.",
		origin: "authored",
	},
	time_to_seconds: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/time_to_seconds",
		description: "Converts a time value to the number of seconds since midnight.",
		origin: "authored",
	},
	time_trunc: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/time_trunc",
		origin: "vendor-docs",
	},
	timediff: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/timediff",
		origin: "vendor-docs",
	},
	timestamp: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/timestamp",
		description: "Casts the value expr to the target data type timestamp.",
		origin: "spark-docs",
	},
	timestamp_micros: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/timestamp_micros",
		description: "Creates timestamp from the number of microseconds since UTC epoch.",
		origin: "spark-docs",
	},
	timestamp_millis: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/timestamp_millis",
		description: "Creates timestamp from the number of milliseconds since UTC epoch.",
		origin: "spark-docs",
	},
	timestamp_seconds: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/timestamp_seconds",
		description: "Creates timestamp from the number of seconds (can be fractional) since UTC epoch.",
		origin: "spark-docs",
	},
	timestampadd: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/timestampadd",
		description: "Adds a time interval to a timestamp and returns the resulting timestamp.",
		origin: "authored",
	},
	timestampdiff: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/timestampdiff",
		description: "Returns the difference between two timestamps as an integer in the specified unit.",
		origin: "authored",
	},
	tinyint: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tinyint",
		description: "Casts the value expr to the target data type tinyint.",
		origin: "spark-docs",
	},
	to_avro: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/to_avro",
		description: "Converts a Catalyst binary input value into its corresponding Avro format result.",
		origin: "spark-docs",
	},
	to_binary: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/to_binary",
		description: "Converts the input str to a binary value based on the supplied fmt.",
		origin: "spark-docs",
	},
	to_csv: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/to_csv",
		description: "Returns a CSV string with a given struct value",
		origin: "spark-docs",
	},
	to_date: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/to_date",
		description: "Parses the date_str expression with the fmt expression to a date.",
		origin: "spark-docs",
	},
	to_geography: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/to_geography",
		origin: "vendor-docs",
	},
	to_geometry: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/to_geometry",
		origin: "vendor-docs",
	},
	to_json: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/to_json",
		description: "Returns a JSON string with a given struct value",
		origin: "spark-docs",
	},
	to_number: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/to_number",
		description: "Convert string 'expr' to a number based on the string format 'fmt'.",
		origin: "spark-docs",
	},
	to_time: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/to_time",
		origin: "vendor-docs",
	},
	to_timestamp: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/to_timestamp",
		description: "Parses the timestamp_str expression with the fmt expression to a timestamp.",
		origin: "spark-docs",
	},
	to_unix_timestamp: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/to_unix_timestamp",
		description: "Returns the UNIX timestamp of the given time.",
		origin: "spark-docs",
	},
	to_utc_timestamp: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/to_utc_timestamp",
		description:
			"Given a timestamp like '2017-07-14 02:40:00.0', interprets it as a time in the given time zone, and renders that time as a timestamp in UTC.",
		origin: "spark-docs",
	},
	to_variant_object: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/to_variant_object",
		description:
			"Convert a nested input (array/map/struct) into a variant where maps and structs are converted to variant objects which are unordered unlike SQL structs.",
		origin: "spark-docs",
	},
	to_xml: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/to_xml",
		description: "Returns a XML string with a given struct value",
		origin: "spark-docs",
	},
	transform: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/transform",
		description: "Transforms elements in an array using the function.",
		origin: "spark-docs",
	},
	transform_keys: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/transform_keys",
		description: "Transforms elements in a map using the function.",
		origin: "spark-docs",
	},
	transform_values: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/transform_values",
		description: "Transforms values in the map using the function.",
		origin: "spark-docs",
	},
	trim: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/trim",
		description: "Removes the leading and trailing space characters from str.",
		origin: "spark-docs",
	},
	trunc: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/trunc",
		description:
			"Returns date with the time portion of the day truncated to the unit specified by the format model fmt.",
		origin: "spark-docs",
	},
	try_add: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_add",
		description: "Returns the sum of expr1 and expr2 and the result is null on overflow.",
		origin: "spark-docs",
	},
	try_aes_decrypt: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_aes_decrypt",
		description:
			"This is a special version of aes_decrypt that performs the same operation, but returns a NULL value instead of raising an error if the decryption cannot be performed.",
		origin: "spark-docs",
	},
	try_avg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_avg",
		description: "Returns the mean calculated from values of a group and the result is null on overflow.",
		origin: "spark-docs",
	},
	try_divide: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_divide",
		description: "Returns dividend / divisor.",
		origin: "spark-docs",
	},
	try_element_at: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_element_at",
		description: "Returns element of array at given (1-based) index.",
		origin: "spark-docs",
	},
	try_ip_as_binary: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_ip_as_binary",
		description: "Converts an IP address or CIDR notation to binary form, returning null on invalid input.",
		origin: "authored",
	},
	try_ip_as_string: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_ip_as_string",
		description: "Converts an IP address or CIDR notation to string representation, returning null on failure.",
		origin: "authored",
	},
	try_ip_cidr: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_ip_cidr",
		origin: "vendor-docs",
	},
	try_ip_host: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_ip_host",
		origin: "vendor-docs",
	},
	try_mod: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_mod",
		description: "Returns the remainder after expr1 / expr2.",
		origin: "spark-docs",
	},
	try_multiply: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_multiply",
		description: "Returns expr1 * expr2 and the result is null on overflow.",
		origin: "spark-docs",
	},
	try_parse_json: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_parse_json",
		description: "Parse a JSON string as a Variant value.",
		origin: "spark-docs",
	},
	try_secret: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_secret",
		description: "Retrieves a secret from Databricks secret storage, returning null if the secret does not exist.",
		origin: "authored",
	},
	try_subtract: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_subtract",
		description: "Returns expr1 - expr2 and the result is null on overflow.",
		origin: "spark-docs",
	},
	try_sum: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_sum",
		description: "Returns the sum calculated from values of a group and the result is null on overflow.",
		origin: "spark-docs",
	},
	try_to_binary: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_to_binary",
		description:
			"This is a special version of to_binary that performs the same operation, but returns a NULL value instead of raising an error if the conversion cannot be performed.",
		origin: "spark-docs",
	},
	try_to_geography: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_to_geography",
		origin: "vendor-docs",
	},
	try_to_geometry: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_to_geometry",
		origin: "vendor-docs",
	},
	try_to_number: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_to_number",
		description: "Convert string 'expr' to a number based on the string format fmt.",
		origin: "spark-docs",
	},
	try_to_time: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_to_time",
		description: "Converts a string or expression to a time value with optional format, returning null on failure.",
		origin: "authored",
	},
	try_to_timestamp: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_to_timestamp",
		description: "Parses the timestamp_str expression with the fmt expression to a timestamp.",
		origin: "spark-docs",
	},
	try_url_decode: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_url_decode",
		description:
			"This is a special version of url_decode that performs the same operation, but returns a NULL value instead of raising an error if the decoding cannot be performed.",
		origin: "spark-docs",
	},
	try_validate_utf8: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_validate_utf8",
		description: "Returns the original string if str is a valid UTF-8 string, otherwise returns NULL.",
		origin: "spark-docs",
	},
	try_variant_get: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_variant_get",
		description: "Extracts a sub-variant from v according to path, and then cast the sub-variant to type.",
		origin: "spark-docs",
	},
	try_zstd_decompress: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/try_zstd_decompress",
		description: "Decompresses data using the ZSTD algorithm, returning null if decompression fails.",
		origin: "authored",
	},
	tuple_difference_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_difference_double",
		description:
			"Returns a tuple sketch representing elements in the first sketch but not in the second with double summaries.",
		origin: "authored",
	},
	tuple_difference_integer: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_difference_integer",
		description:
			"Returns a tuple sketch representing elements in the first sketch but not in the second with integer summaries.",
		origin: "authored",
	},
	tuple_intersection_agg_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_intersection_agg_double",
		description: "Aggregates tuple sketches by computing their intersection with double-type summaries over rows.",
		origin: "authored",
	},
	tuple_intersection_agg_integer: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_intersection_agg_integer",
		description: "Aggregates tuple sketches by computing their intersection with integer-type summaries over rows.",
		origin: "authored",
	},
	tuple_intersection_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_intersection_double",
		description:
			"Returns a tuple sketch representing key-value pairs common to both sketches with double summaries.",
		origin: "authored",
	},
	tuple_intersection_integer: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_intersection_integer",
		description:
			"Returns a tuple sketch representing key-value pairs common to both sketches with integer summaries.",
		origin: "authored",
	},
	tuple_sketch_agg_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_sketch_agg_double",
		origin: "vendor-docs",
	},
	tuple_sketch_agg_integer: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_sketch_agg_integer",
		origin: "vendor-docs",
	},
	tuple_sketch_estimate_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_sketch_estimate_double",
		origin: "vendor-docs",
	},
	tuple_sketch_estimate_integer: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_sketch_estimate_integer",
		origin: "vendor-docs",
	},
	tuple_sketch_summary_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_sketch_summary_double",
		description: "Returns summary statistics as a double from a tuple sketch containing numeric summaries.",
		origin: "authored",
	},
	tuple_sketch_summary_integer: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_sketch_summary_integer",
		description: "Returns summary statistics as an integer from a tuple sketch containing numeric summaries.",
		origin: "authored",
	},
	tuple_sketch_theta_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_sketch_theta_double",
		description: "Extracts the theta (inclusion probability threshold) value from a tuple sketch as a double.",
		origin: "authored",
	},
	tuple_sketch_theta_integer: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_sketch_theta_integer",
		origin: "vendor-docs",
	},
	tuple_union_agg_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_union_agg_double",
		description:
			"Aggregates unions of tuple sketches across rows to combine approximate summaries with double-typed data.",
		origin: "authored",
	},
	tuple_union_agg_integer: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_union_agg_integer",
		description:
			"Aggregates unions of tuple sketches across rows to combine approximate summaries with integer-typed data.",
		origin: "authored",
	},
	tuple_union_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_union_double",
		description:
			"Returns the union of two tuple sketches, combining their approximate summaries of double-typed data.",
		origin: "authored",
	},
	tuple_union_integer: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/tuple_union_integer",
		description:
			"Returns the union of two tuple sketches, combining their approximate summaries of integer-typed data.",
		origin: "authored",
	},
	typeof: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/typeof",
		description: "Return DDL-formatted type string for the data type of the input.",
		origin: "spark-docs",
	},
	ucase: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/ucase",
		description: "Returns str with all characters changed to uppercase.",
		origin: "spark-docs",
	},
	unbase64: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/unbase64",
		description: "Converts the argument from a base 64 string str to a binary.",
		origin: "spark-docs",
	},
	unhex: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/unhex",
		description: "Converts hexadecimal expr to binary.",
		origin: "spark-docs",
	},
	uniform: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/uniform",
		description:
			"Returns a random value with independent and identically distributed (i.i.d.) values with the specified range of numbers.",
		origin: "spark-docs",
	},
	unix_date: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/unix_date",
		description: "Returns the number of days since 1970-01-01.",
		origin: "spark-docs",
	},
	unix_micros: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/unix_micros",
		description: "Returns the number of microseconds since 1970-01-01 00:00:00 UTC.",
		origin: "spark-docs",
	},
	unix_millis: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/unix_millis",
		description: "Returns the number of milliseconds since 1970-01-01 00:00:00 UTC.",
		origin: "spark-docs",
	},
	unix_seconds: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/unix_seconds",
		description: "Returns the number of seconds since 1970-01-01 00:00:00 UTC.",
		origin: "spark-docs",
	},
	upper: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/upper",
		description: "Returns str with all characters changed to uppercase.",
		origin: "spark-docs",
	},
	url_decode: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/url_decode",
		description: "Decodes a str in 'application/x-www-form-urlencoded' format using a specific encoding scheme.",
		origin: "spark-docs",
	},
	url_encode: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/url_encode",
		description:
			"Translates a string into 'application/x-www-form-urlencoded' format using a specific encoding scheme.",
		origin: "spark-docs",
	},
	user: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/user",
		description: "user name of current execution context.",
		origin: "spark-docs",
	},
	uuid: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/uuid",
		description: "Returns an universally unique identifier (UUID) string.",
		origin: "spark-docs",
	},
	validate_utf8: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/validate_utf8",
		description: "Returns the original string if str is a valid UTF-8 string, otherwise throws an exception.",
		origin: "spark-docs",
	},
	var_pop: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/var_pop",
		description: "Returns the population variance calculated from values of a group.",
		origin: "spark-docs",
	},
	var_samp: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/var_samp",
		description: "Returns the sample variance calculated from values of a group.",
		origin: "spark-docs",
	},
	variance: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/variance",
		description: "Returns the sample variance calculated from values of a group.",
		origin: "spark-docs",
	},
	variant_explode: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/variant_explode",
		description: "It separates a variant object/array into multiple rows containing its fields/elements.",
		origin: "spark-docs",
	},
	variant_explode_outer: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/variant_explode_outer",
		description: "It separates a variant object/array into multiple rows containing its fields/elements.",
		origin: "spark-docs",
	},
	variant_get: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/variant_get",
		description: "Extracts a sub-variant from v according to path, and then cast the sub-variant to type.",
		origin: "spark-docs",
	},
	vector_avg: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/vector_avg",
		description: "Computes the element-wise average of a collection of vectors.",
		origin: "authored",
	},
	vector_cosine_similarity: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/vector_cosine_similarity",
		origin: "vendor-docs",
	},
	vector_inner_product: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/vector_inner_product",
		description: "Computes the inner (dot) product of two vectors.",
		origin: "authored",
	},
	vector_l2_distance: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/vector_l2_distance",
		description: "Computes the Euclidean (L2) distance between two vectors.",
		origin: "authored",
	},
	vector_norm: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/vector_norm",
		description:
			"Computes the norm (magnitude) of a vector, with optional degree parameter to specify which norm to compute.",
		origin: "authored",
	},
	vector_normalize: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/vector_normalize",
		description:
			"Scales a vector to unit length, with optional degree parameter specifying the normalization method.",
		origin: "authored",
	},
	vector_sum: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/vector_sum",
		description: "Computes the element-wise sum of a collection of vectors.",
		origin: "authored",
	},
	version: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/version",
		description: "Returns the Spark version.",
		origin: "spark-docs",
	},
	weekday: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/weekday",
		description: "Returns the day of the week for date/timestamp (0 = Monday, 1 = Tuesday,..., 6 = Sunday).",
		origin: "spark-docs",
	},
	weekofyear: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/weekofyear",
		description: "Returns the week of the year of the given date.",
		origin: "spark-docs",
	},
	width_bucket: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/width_bucket",
		description:
			'Returns the bucket number to which value would be assigned in an equiwidth histogram with num_bucket buckets, in the range min_value to max_value."',
		origin: "spark-docs",
	},
	window: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/window",
		description: "Bucketize rows into one or more time windows given a timestamp specifying column.",
		origin: "spark-docs",
	},
	window_time: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/window_time",
		description:
			"Extract the time value from time/session window column which can be used for event time value of window.",
		origin: "spark-docs",
	},
	xpath: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/xpath",
		description: "Returns a string array of values within the nodes of xml that match the XPath expression.",
		origin: "spark-docs",
	},
	xpath_boolean: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/xpath_boolean",
		description: "Returns true if the XPath expression evaluates to true, or if a matching node is found.",
		origin: "spark-docs",
	},
	xpath_double: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/xpath_double",
		description:
			"Returns a double value, the value zero if no match is found, or NaN if a match is found but the value is non-numeric.",
		origin: "spark-docs",
	},
	xpath_float: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/xpath_float",
		description:
			"Returns a float value, the value zero if no match is found, or NaN if a match is found but the value is non-numeric.",
		origin: "spark-docs",
	},
	xpath_int: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/xpath_int",
		description:
			"Returns an integer value, or the value zero if no match is found, or a match is found but the value is non-numeric.",
		origin: "spark-docs",
	},
	xpath_long: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/xpath_long",
		description:
			"Returns a long integer value, or the value zero if no match is found, or a match is found but the value is non-numeric.",
		origin: "spark-docs",
	},
	xpath_number: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/xpath_number",
		description:
			"Returns a double value, the value zero if no match is found, or NaN if a match is found but the value is non-numeric.",
		origin: "spark-docs",
	},
	xpath_short: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/xpath_short",
		description:
			"Returns a short integer value, or the value zero if no match is found, or a match is found but the value is non-numeric.",
		origin: "spark-docs",
	},
	xpath_string: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/xpath_string",
		description: "Returns the text contents of the first xml node that matches the XPath expression.",
		origin: "spark-docs",
	},
	xxhash64: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/xxhash64",
		description: "Returns a 64-bit hash value of the arguments.",
		origin: "spark-docs",
	},
	year: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/year",
		description: "Returns the year component of the date/timestamp.",
		origin: "spark-docs",
	},
	zeroifnull: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/zeroifnull",
		description: "Returns zero if expr is equal to null, or expr otherwise.",
		origin: "spark-docs",
	},
	zip_with: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/zip_with",
		description: "Merges the two given arrays, element-wise, into a single array using function.",
		origin: "spark-docs",
	},
	zstd_compress: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/zstd_compress",
		description:
			"Compresses data using the Zstandard (zstd) algorithm, with optional compression level and streaming mode parameters.",
		origin: "authored",
	},
	zstd_decompress: {
		docUrl: "https://docs.databricks.com/aws/en/sql/language-manual/functions/zstd_decompress",
		description: "Decompresses data that was compressed with the Zstandard (zstd) algorithm.",
		origin: "authored",
	},
};
