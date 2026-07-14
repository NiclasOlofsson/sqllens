// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// Harvested source: docs.databricks.com  databricks/docs/syntax/functions/<name>/N.txt (Syntax blocks, captured by tools/scrape-databricks-syntax.mjs)
// Overrides source: tools/signature-overrides/databricks.mjs
// Built 2026-07-14. 668 names (16 curated, 652 harvested), 10 with 2+ overloads.
import type { FnSignature } from "../signature/signatures.js";

/** The merged function-signature table for databricks: curated overrides folded over the harvested
 *  doc-derived long tail (overrides win by key, replacing the whole overload set), keyed by
 *  lowercased name. Each name maps to an ORDERED overload set - a name with one documented shape
 *  is a one-element array. `origin` says which layer produced the set. */
export const DATABRICKS_SIGNATURES: Record<string, FnSignature[]> = {
	abs: [{ name: "abs", params: [{ name: "expr", type: "numeric" }], origin: "curated" }], // curated: abs function
	acos: [{ name: "acos", params: [{ name: "expr" }], origin: "harvested" }], // functions/acos/1.txt
	acosh: [{ name: "acosh", params: [{ name: "expr" }], origin: "harvested" }], // functions/acosh/1.txt
	add_months: [{ name: "add_months", params: [{ name: "startDate" }, { name: "numMonths" }], origin: "harvested" }], // functions/add_months/1.txt
	aes_decrypt: [
		{
			name: "aes_decrypt",
			params: [
				{ name: "expr" },
				{ name: "key" },
				{ name: "mode", optional: true },
				{ name: "padding", optional: true },
				{ name: "aad", optional: true },
			],
			origin: "harvested",
		},
	], // functions/aes_decrypt/1.txt
	aes_encrypt: [
		{
			name: "aes_encrypt",
			params: [
				{ name: "expr" },
				{ name: "key" },
				{ name: "mode", optional: true },
				{ name: "padding", optional: true },
				{ name: "iv", optional: true },
				{ name: "aad", optional: true },
			],
			origin: "harvested",
		},
	], // functions/aes_encrypt/1.txt
	agg: [{ name: "agg", params: [{ name: "measure_column" }], origin: "harvested" }], // functions/agg/1.txt
	aggregate: [
		{
			name: "aggregate",
			params: [{ name: "expr" }, { name: "start" }, { name: "merge" }, { name: "finish", optional: true }],
			origin: "harvested",
		},
	], // functions/aggregate/1.txt
	ai_analyze_sentiment: [{ name: "ai_analyze_sentiment", params: [{ name: "content" }], origin: "harvested" }], // functions/ai_analyze_sentiment/1.txt
	ai_classify: [
		{
			name: "ai_classify",
			params: [{ name: "content" }, { name: "labels" }, { name: "options", optional: true }],
			origin: "harvested",
		},
	], // functions/ai_classify/1.txt
	ai_extract: [
		{
			name: "ai_extract",
			params: [{ name: "content" }, { name: "schema" }, { name: "options", optional: true }],
			origin: "harvested",
		},
		{
			name: "ai_extract",
			params: [{ name: "content" }, { name: "labels" }, { name: "options", optional: true }],
			origin: "harvested",
		},
	], // functions/ai_extract/1.txt, functions/ai_extract/3.txt
	ai_fix_grammar: [{ name: "ai_fix_grammar", params: [{ name: "content" }], origin: "harvested" }], // functions/ai_fix_grammar/1.txt
	ai_gen: [{ name: "ai_gen", params: [{ name: "prompt" }], origin: "harvested" }], // functions/ai_gen/1.txt
	ai_mask: [{ name: "ai_mask", params: [{ name: "content" }, { name: "labels" }], origin: "harvested" }], // functions/ai_mask/1.txt
	ai_parse_document: [
		{
			name: "ai_parse_document",
			params: [{ name: "content" }, { name: "options", optional: true }],
			origin: "curated",
		},
	], // curated: ai_parse_document(content) | ai_parse_document(content, Map("version" -> "2.0"))
	ai_prep_search: [
		{
			name: "ai_prep_search",
			params: [{ name: "parsed" }, { name: "options", optional: true }],
			origin: "harvested",
		},
	], // functions/ai_prep_search/1.txt
	ai_query: [
		{
			name: "ai_query",
			params: [
				{ name: "endpoint" },
				{ name: "request" },
				{ name: "returnType", optional: true },
				{ name: "failOnError", optional: true },
			],
			origin: "harvested",
		},
	], // functions/ai_query/3.txt
	ai_similarity: [{ name: "ai_similarity", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/ai_similarity/1.txt
	ai_summarize: [
		{
			name: "ai_summarize",
			params: [{ name: "content" }, { name: "max_words", optional: true }],
			origin: "harvested",
		},
	], // functions/ai_summarize/1.txt
	ai_translate: [{ name: "ai_translate", params: [{ name: "content" }, { name: "to_lang" }], origin: "harvested" }], // functions/ai_translate/1.txt
	any_value: [
		{ name: "any_value", params: [{ name: "expr" }, { name: "ignoreNull", optional: true }], origin: "harvested" },
	], // functions/any_value/1.txt
	approx_count_distinct: [
		{
			name: "approx_count_distinct",
			params: [{ name: "expr" }, { name: "relativeSD", optional: true }],
			origin: "harvested",
		},
	], // functions/approx_count_distinct/1.txt
	approx_percentile: [
		{
			name: "approx_percentile",
			params: [{ name: "expr" }, { name: "percentile" }, { name: "accuracy", optional: true }],
			origin: "harvested",
		},
	], // functions/approx_percentile/1.txt
	approx_top_k: [
		{
			name: "approx_top_k",
			params: [{ name: "expr" }, { name: "k", optional: true }, { name: "maxItemsTracked", optional: true }],
			origin: "harvested",
		},
	], // functions/approx_top_k/1.txt
	approx_top_k_accumulate: [
		{
			name: "approx_top_k_accumulate",
			params: [{ name: "expr" }, { name: "maxItemsTracked", optional: true }],
			origin: "harvested",
		},
	], // functions/approx_top_k_accumulate/1.txt
	approx_top_k_combine: [
		{
			name: "approx_top_k_combine",
			params: [{ name: "state" }, { name: "maxItemsTracked", optional: true }],
			origin: "harvested",
		},
	], // functions/approx_top_k_combine/1.txt
	approx_top_k_estimate: [
		{
			name: "approx_top_k_estimate",
			params: [{ name: "state" }, { name: "k", optional: true }],
			origin: "harvested",
		},
	], // functions/approx_top_k_estimate/1.txt
	array: [{ name: "array", params: [{ name: "expr" }], variadic: true, origin: "harvested" }], // functions/array/1.txt
	array_agg: [{ name: "array_agg", params: [{ name: "expr" }], origin: "harvested" }], // functions/array_agg/1.txt
	array_append: [{ name: "array_append", params: [{ name: "array" }, { name: "elem" }], origin: "harvested" }], // functions/array_append/1.txt
	array_compact: [{ name: "array_compact", params: [{ name: "array" }], origin: "harvested" }], // functions/array_compact/1.txt
	array_contains: [{ name: "array_contains", params: [{ name: "array" }, { name: "value" }], origin: "harvested" }], // functions/array_contains/1.txt
	array_distinct: [{ name: "array_distinct", params: [{ name: "array" }], origin: "harvested" }], // functions/array_distinct/1.txt
	array_except: [{ name: "array_except", params: [{ name: "array1" }, { name: "array2" }], origin: "harvested" }], // functions/array_except/1.txt
	array_insert: [
		{ name: "array_insert", params: [{ name: "array" }, { name: "index" }, { name: "elem" }], origin: "harvested" },
	], // functions/array_insert/1.txt
	array_intersect: [
		{ name: "array_intersect", params: [{ name: "array1" }, { name: "array2" }], origin: "harvested" },
	], // functions/array_intersect/1.txt
	array_join: [
		{
			name: "array_join",
			params: [{ name: "array" }, { name: "delimiter" }, { name: "nullReplacement", optional: true }],
			origin: "harvested",
		},
	], // functions/array_join/1.txt
	array_max: [{ name: "array_max", params: [{ name: "array" }], origin: "harvested" }], // functions/array_max/1.txt
	array_min: [{ name: "array_min", params: [{ name: "array" }], origin: "harvested" }], // functions/array_min/1.txt
	array_position: [{ name: "array_position", params: [{ name: "array" }, { name: "element" }], origin: "harvested" }], // functions/array_position/1.txt
	array_prepend: [{ name: "array_prepend", params: [{ name: "array" }, { name: "elem" }], origin: "harvested" }], // functions/array_prepend/1.txt
	array_remove: [{ name: "array_remove", params: [{ name: "array" }, { name: "element" }], origin: "harvested" }], // functions/array_remove/1.txt
	array_repeat: [{ name: "array_repeat", params: [{ name: "element" }, { name: "count" }], origin: "harvested" }], // functions/array_repeat/1.txt
	array_size: [{ name: "array_size", params: [{ name: "array" }], origin: "harvested" }], // functions/array_size/1.txt
	array_sort: [
		{ name: "array_sort", params: [{ name: "array" }, { name: "func", optional: true }], origin: "curated" },
	], // curated: array_sort(array[, func]) - func omitted sorts ascending (Returns section, docs.databricks.com/en/sql/language-manual/functions/array_sort)
	array_union: [{ name: "array_union", params: [{ name: "array1" }, { name: "array2" }], origin: "harvested" }], // functions/array_union/1.txt
	arrays_overlap: [{ name: "arrays_overlap", params: [{ name: "array1" }, { name: "array2" }], origin: "harvested" }], // functions/arrays_overlap/1.txt
	arrays_zip: [{ name: "arrays_zip", params: [{ name: "array1" }], variadic: true, origin: "harvested" }], // functions/arrays_zip/1.txt
	ascii: [{ name: "ascii", params: [{ name: "str" }], origin: "harvested" }], // functions/ascii/1.txt
	asin: [{ name: "asin", params: [{ name: "expr" }], origin: "harvested" }], // functions/asin/1.txt
	asinh: [{ name: "asinh", params: [{ name: "expr" }], origin: "harvested" }], // functions/asinh/1.txt
	assert_true: [
		{
			name: "assert_true",
			params: [{ name: "condition" }, { name: "message", optional: true }],
			origin: "harvested",
		},
	], // functions/assert_true/1.txt
	atan: [{ name: "atan", params: [{ name: "expr" }], origin: "harvested" }], // functions/atan/1.txt
	atan2: [{ name: "atan2", params: [{ name: "exprY" }, { name: "exprX" }], origin: "harvested" }], // functions/atan2/1.txt
	atanh: [{ name: "atanh", params: [{ name: "expr" }], origin: "harvested" }], // functions/atanh/1.txt
	avg: [{ name: "avg", params: [{ name: "expr" }], origin: "harvested" }], // functions/avg/1.txt
	base64: [{ name: "base64", params: [{ name: "expr" }], origin: "harvested" }], // functions/base64/1.txt
	bigint: [{ name: "bigint", params: [{ name: "expr" }], origin: "harvested" }], // functions/bigint/1.txt
	bin: [{ name: "bin", params: [{ name: "expr" }], origin: "harvested" }], // functions/bin/1.txt
	binary: [{ name: "binary", params: [{ name: "expr" }], origin: "harvested" }], // functions/binary/1.txt
	bit_and: [{ name: "bit_and", params: [{ name: "expr" }], origin: "harvested" }], // functions/bit_and/1.txt
	bit_count: [{ name: "bit_count", params: [{ name: "expr" }], origin: "harvested" }], // functions/bit_count/1.txt
	bit_get: [{ name: "bit_get", params: [{ name: "expr" }, { name: "pos" }], origin: "harvested" }], // functions/bit_get/1.txt
	bit_length: [{ name: "bit_length", params: [{ name: "expr" }], origin: "harvested" }], // functions/bit_length/1.txt
	bit_or: [{ name: "bit_or", params: [{ name: "expr" }], origin: "harvested" }], // functions/bit_or/1.txt
	bit_reverse: [{ name: "bit_reverse", params: [{ name: "expr" }], origin: "harvested" }], // functions/bit_reverse/1.txt
	bit_xor: [{ name: "bit_xor", params: [{ name: "expr" }], origin: "harvested" }], // functions/bit_xor/1.txt
	bitmap_and_agg: [{ name: "bitmap_and_agg", params: [{ name: "expr" }], origin: "harvested" }], // functions/bitmap_and_agg/1.txt
	bitmap_bit_position: [{ name: "bitmap_bit_position", params: [{ name: "expr" }], origin: "harvested" }], // functions/bitmap_bit_position/1.txt
	bitmap_bucket_number: [{ name: "bitmap_bucket_number", params: [{ name: "expr" }], origin: "harvested" }], // functions/bitmap_bucket_number/1.txt
	bitmap_construct_agg: [{ name: "bitmap_construct_agg", params: [{ name: "expr" }], origin: "harvested" }], // functions/bitmap_construct_agg/1.txt
	bitmap_count: [{ name: "bitmap_count", params: [{ name: "expr" }], origin: "harvested" }], // functions/bitmap_count/1.txt
	bitmap_or_agg: [{ name: "bitmap_or_agg", params: [{ name: "expr" }], origin: "harvested" }], // functions/bitmap_or_agg/1.txt
	bool_and: [{ name: "bool_and", params: [{ name: "expr" }], origin: "harvested" }], // functions/bool_and/1.txt
	bool_or: [{ name: "bool_or", params: [{ name: "expr" }], origin: "harvested" }], // functions/bool_or/1.txt
	boolean: [{ name: "boolean", params: [{ name: "expr" }], origin: "harvested" }], // functions/boolean/1.txt
	bround: [
		{ name: "bround", params: [{ name: "expr" }, { name: "targetScale", optional: true }], origin: "harvested" },
	], // functions/bround/1.txt
	btrim: [{ name: "btrim", params: [{ name: "str" }, { name: "trimStr", optional: true }], origin: "harvested" }], // functions/btrim/1.txt
	cardinality: [{ name: "cardinality", params: [{ name: "expr" }], origin: "harvested" }], // functions/cardinality/1.txt
	cast: [{ name: "cast", params: [{ name: "expr" }, { name: "type" }], origin: "curated" }], // curated: cast function
	cbrt: [{ name: "cbrt", params: [{ name: "expr" }], origin: "harvested" }], // functions/cbrt/1.txt
	ceil: [{ name: "ceil", params: [{ name: "expr" }, { name: "targetScale", optional: true }], origin: "harvested" }], // functions/ceil/1.txt
	ceiling: [
		{ name: "ceiling", params: [{ name: "expr" }, { name: "targetScale", optional: true }], origin: "harvested" },
	], // functions/ceiling/1.txt
	char: [{ name: "char", params: [{ name: "expr" }], origin: "harvested" }], // functions/char/1.txt
	char_length: [{ name: "char_length", params: [{ name: "expr" }], origin: "harvested" }], // functions/char_length/1.txt
	character_length: [{ name: "character_length", params: [{ name: "expr" }], origin: "harvested" }], // functions/character_length/1.txt
	charindex: [
		{
			name: "charindex",
			params: [{ name: "substr" }, { name: "str" }, { name: "pos", optional: true }],
			origin: "harvested",
		},
	], // functions/charindex/1.txt
	chr: [{ name: "chr", params: [{ name: "expr" }], origin: "harvested" }], // functions/chr/1.txt
	classifier: [{ name: "classifier", params: [], origin: "harvested" }], // functions/classifier/1.txt
	coalesce: [{ name: "coalesce", params: [{ name: "expr" }], variadic: true, origin: "curated" }], // curated: coalesce function (variadic)
	collation: [{ name: "collation", params: [{ name: "strExpr" }], origin: "harvested" }], // functions/collation/1.txt
	collations: [{ name: "collations", params: [], origin: "harvested" }], // functions/collations/1.txt
	collect_list: [{ name: "collect_list", params: [{ name: "expr" }], origin: "harvested" }], // functions/collect_list/1.txt
	collect_set: [{ name: "collect_set", params: [{ name: "expr" }], origin: "harvested" }], // functions/collect_set/1.txt
	concat: [{ name: "concat", params: [{ name: "expr1" }, { name: "expr2" }], variadic: true, origin: "harvested" }], // functions/concat/1.txt
	concat_ws: [
		{
			name: "concat_ws",
			params: [
				{ name: "sep", type: "string" },
				{ name: "expr", type: "string", optional: true },
			],
			variadic: true,
			origin: "curated",
		},
	], // curated: concat_ws function - concat_ws('s') = '' is a documented valid call (separator-only)
	contains: [{ name: "contains", params: [{ name: "expr" }, { name: "subExpr" }], origin: "harvested" }], // functions/contains/1.txt
	conv: [{ name: "conv", params: [{ name: "num" }, { name: "fromBase" }, { name: "toBase" }], origin: "harvested" }], // functions/conv/1.txt
	corr: [{ name: "corr", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/corr/1.txt
	cos: [{ name: "cos", params: [{ name: "expr" }], origin: "harvested" }], // functions/cos/1.txt
	cosh: [{ name: "cosh", params: [{ name: "expr" }], origin: "harvested" }], // functions/cosh/1.txt
	cot: [{ name: "cot", params: [{ name: "expr" }], origin: "harvested" }], // functions/cot/1.txt
	count: [{ name: "count", params: [{ name: "expr" }], variadic: true, origin: "harvested" }], // functions/count/2.txt
	count_if: [{ name: "count_if", params: [{ name: "expr" }], origin: "harvested" }], // functions/count_if/1.txt
	count_min_sketch: [
		{
			name: "count_min_sketch",
			params: [{ name: "column" }, { name: "epsilon" }, { name: "confidence" }, { name: "seed" }],
			origin: "harvested",
		},
	], // functions/count_min_sketch/1.txt
	covar_pop: [{ name: "covar_pop", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/covar_pop/1.txt
	covar_samp: [{ name: "covar_samp", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/covar_samp/1.txt
	crc32: [{ name: "crc32", params: [{ name: "expr" }], origin: "harvested" }], // functions/crc32/1.txt
	csc: [{ name: "csc", params: [{ name: "expr" }], origin: "harvested" }], // functions/csc/1.txt
	cube: [{ name: "cube", params: [{ name: "expr1" }], variadic: true, origin: "harvested" }], // functions/cube/1.txt
	cume_dist: [{ name: "cume_dist", params: [], origin: "harvested" }], // functions/cume_dist/1.txt
	curdate: [{ name: "curdate", params: [], origin: "harvested" }], // functions/curdate/1.txt
	current_catalog: [{ name: "current_catalog", params: [], origin: "harvested" }], // functions/current_catalog/1.txt
	current_database: [{ name: "current_database", params: [], origin: "harvested" }], // functions/current_database/1.txt
	current_date: [{ name: "current_date", params: [], origin: "harvested" }], // functions/current_date/1.txt
	current_metastore: [{ name: "current_metastore", params: [], origin: "harvested" }], // functions/current_metastore/1.txt
	current_recipient: [{ name: "current_recipient", params: [{ name: "key" }], origin: "harvested" }], // functions/current_recipient/1.txt
	current_schema: [{ name: "current_schema", params: [], origin: "harvested" }], // functions/current_schema/1.txt
	current_time: [{ name: "current_time", params: [{ name: "precision", optional: true }], origin: "harvested" }], // functions/current_time/1.txt
	current_timestamp: [{ name: "current_timestamp", params: [], origin: "harvested" }], // functions/current_timestamp/1.txt
	current_timezone: [{ name: "current_timezone", params: [], origin: "harvested" }], // functions/current_timezone/1.txt
	current_user: [{ name: "current_user", params: [], origin: "harvested" }], // functions/current_user/1.txt
	current_version: [{ name: "current_version", params: [], origin: "harvested" }], // functions/current_version/1.txt
	date: [{ name: "date", params: [{ name: "expr" }], origin: "harvested" }], // functions/date/1.txt
	date_add: [
		{ name: "date_add", params: [{ name: "unit" }, { name: "value" }, { name: "expr" }], origin: "harvested" },
		{ name: "date_add", params: [{ name: "startDate" }, { name: "numDays" }], origin: "harvested" },
	], // functions/date_add3/1.txt, functions/date_add/1.txt
	date_diff: [
		{ name: "date_diff", params: [{ name: "unit" }, { name: "start" }, { name: "end" }], origin: "harvested" },
	], // functions/date_diff/1.txt
	date_format: [{ name: "date_format", params: [{ name: "expr" }, { name: "fmt" }], origin: "harvested" }], // functions/date_format/1.txt
	date_from_unix_date: [{ name: "date_from_unix_date", params: [{ name: "days" }], origin: "harvested" }], // functions/date_from_unix_date/1.txt
	date_part: [{ name: "date_part", params: [{ name: "fieldStr" }, { name: "expr" }], origin: "harvested" }], // functions/date_part/1.txt
	date_sub: [
		{
			name: "date_sub",
			params: [
				{ name: "start_date", type: "date" },
				{ name: "num_days", type: "int" },
			],
			origin: "curated",
		},
	], // curated: date_sub function - docs.databricks.com functions/date_sub documents only date_sub(startDate, numDays); no unit-based 3-arg overload exists (unlike date_add)
	date_trunc: [{ name: "date_trunc", params: [{ name: "unit" }, { name: "expr" }], origin: "harvested" }], // functions/date_trunc/1.txt
	dateadd: [
		{ name: "dateadd", params: [{ name: "unit" }, { name: "value" }, { name: "expr" }], origin: "harvested" },
		{ name: "dateadd", params: [{ name: "startDate" }, { name: "numDays" }], origin: "harvested" },
	], // functions/dateadd/1.txt, functions/dateadd2/1.txt
	datediff: [
		{ name: "datediff", params: [{ name: "unit" }, { name: "start" }, { name: "end" }], origin: "harvested" },
		{ name: "datediff", params: [{ name: "endDate" }, { name: "startDate" }], origin: "harvested" },
	], // functions/datediff3/1.txt, functions/datediff/1.txt
	day: [{ name: "day", params: [{ name: "expr" }], origin: "harvested" }], // functions/day/1.txt
	dayname: [{ name: "dayname", params: [{ name: "expr" }], origin: "harvested" }], // functions/dayname/1.txt
	dayofmonth: [{ name: "dayofmonth", params: [{ name: "expr" }], origin: "harvested" }], // functions/dayofmonth/1.txt
	dayofweek: [{ name: "dayofweek", params: [{ name: "expr" }], origin: "harvested" }], // functions/dayofweek/1.txt
	dayofyear: [{ name: "dayofyear", params: [{ name: "expr" }], origin: "harvested" }], // functions/dayofyear/1.txt
	decimal: [{ name: "decimal", params: [{ name: "expr" }], origin: "harvested" }], // functions/decimal/1.txt
	decode: [
		{ name: "decode", params: [{ name: "bin" }, { name: "charSet" }], origin: "curated" },
		{
			name: "decode",
			params: [{ name: "expr" }, { name: "search" }, { name: "result" }],
			variadic: true,
			origin: "curated",
		},
	], // curated: decode(bin, charSet) 2-arg charset decode, and decode(expr, search, result, ...) Oracle-style conditional decode (expr + 1+ key/value pairs + an optional default) - docs/syntax/functions/decode_cs vs decode
	degrees: [{ name: "degrees", params: [{ name: "expr" }], origin: "harvested" }], // functions/degrees/1.txt
	dense_rank: [{ name: "dense_rank", params: [], origin: "harvested" }], // functions/dense_rank/1.txt
	double: [{ name: "double", params: [{ name: "expr" }], origin: "harvested" }], // functions/double/1.txt
	e: [{ name: "e", params: [], origin: "harvested" }], // functions/e/1.txt
	element_at: [
		{ name: "element_at", params: [{ name: "arrayExpr" }, { name: "index" }], origin: "harvested" },
		{ name: "element_at", params: [{ name: "mapExpr" }, { name: "key" }], origin: "harvested" },
	], // functions/element_at/1.txt, functions/element_at/2.txt
	elt: [{ name: "elt", params: [{ name: "index" }, { name: "expr1" }], variadic: true, origin: "harvested" }], // functions/elt/1.txt
	encode: [{ name: "encode", params: [{ name: "expr" }, { name: "charSet" }], origin: "harvested" }], // functions/encode/1.txt
	endswith: [{ name: "endswith", params: [{ name: "expr" }, { name: "endExpr" }], origin: "harvested" }], // functions/endswith/1.txt
	equal_null: [{ name: "equal_null", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/equal_null/1.txt
	every: [{ name: "every", params: [{ name: "expr" }], origin: "harvested" }], // functions/every/1.txt
	exp: [{ name: "exp", params: [{ name: "expr" }], origin: "harvested" }], // functions/exp/1.txt
	explode: [{ name: "explode", params: [{ name: "collection" }], origin: "harvested" }], // functions/explode/1.txt
	explode_outer: [{ name: "explode_outer", params: [{ name: "collection" }], origin: "harvested" }], // functions/explode_outer/1.txt
	expm1: [{ name: "expm1", params: [{ name: "expr" }], origin: "harvested" }], // functions/expm1/1.txt
	factorial: [{ name: "factorial", params: [{ name: "expr" }], origin: "harvested" }], // functions/factorial/1.txt
	filter: [{ name: "filter", params: [{ name: "expr" }, { name: "func" }], origin: "harvested" }], // functions/filter/1.txt
	find_in_set: [
		{ name: "find_in_set", params: [{ name: "searchExpr" }, { name: "sourceExpr" }], origin: "harvested" },
	], // functions/find_in_set/1.txt
	first: [{ name: "first", params: [{ name: "expr" }, { name: "ignoreNull", optional: true }], origin: "harvested" }], // functions/first/1.txt
	first_value: [
		{
			name: "first_value",
			params: [{ name: "expr" }, { name: "ignoreNull", optional: true }],
			origin: "harvested",
		},
	], // functions/first_value/1.txt
	flatten: [{ name: "flatten", params: [{ name: "expr" }], origin: "harvested" }], // functions/flatten/1.txt
	float: [{ name: "float", params: [{ name: "expr" }], origin: "harvested" }], // functions/float/1.txt
	floor: [
		{ name: "floor", params: [{ name: "expr" }, { name: "targetScale", optional: true }], origin: "harvested" },
	], // functions/floor/1.txt
	forall: [{ name: "forall", params: [{ name: "expr" }, { name: "func" }], origin: "harvested" }], // functions/forall/1.txt
	format_number: [
		{ name: "format_number", params: [{ name: "expr" }, { name: "scale" }], origin: "harvested" },
		{ name: "format_number", params: [{ name: "expr" }, { name: "fmt" }], origin: "harvested" },
	], // functions/format_number/1.txt, functions/format_number/2.txt
	format_string: [
		{
			name: "format_string",
			params: [{ name: "strfmt" }, { name: "obj1", optional: true }],
			variadic: true,
			origin: "harvested",
		},
	], // functions/format_string/1.txt
	from_avro: [
		{
			name: "from_avro",
			params: [{ name: "avroBin" }, { name: "jsonSchemaStr" }, { name: "options", optional: true }],
			origin: "curated",
		},
	], // curated: from_avro(avroBin, jsonSchemaStr[, options]) - options optional, docs.databricks.com/en/sql/language-manual/functions/from_avro
	from_csv: [
		{
			name: "from_csv",
			params: [{ name: "csvStr" }, { name: "schema" }, { name: "options", optional: true }],
			origin: "harvested",
		},
	], // functions/from_csv/1.txt
	from_json: [
		{
			name: "from_json",
			params: [{ name: "jsonStr" }, { name: "schema" }, { name: "options", optional: true }],
			origin: "harvested",
		},
	], // functions/from_json/1.txt
	from_unixtime: [
		{ name: "from_unixtime", params: [{ name: "unixTime" }, { name: "fmt", optional: true }], origin: "harvested" },
	], // functions/from_unixtime/1.txt
	from_utc_timestamp: [
		{ name: "from_utc_timestamp", params: [{ name: "expr" }, { name: "timeZone" }], origin: "harvested" },
	], // functions/from_utc_timestamp/1.txt
	from_xml: [
		{
			name: "from_xml",
			params: [{ name: "xmlStr" }, { name: "schema" }, { name: "options", optional: true }],
			origin: "harvested",
		},
	], // functions/from_xml/1.txt
	get: [{ name: "get", params: [{ name: "arrayExpr" }, { name: "index" }], origin: "harvested" }], // functions/get/1.txt
	get_json_object: [{ name: "get_json_object", params: [{ name: "expr" }, { name: "path" }], origin: "harvested" }], // functions/get_json_object/1.txt
	getdate: [{ name: "getdate", params: [], origin: "harvested" }], // functions/getdate/1.txt
	greatest: [
		{ name: "greatest", params: [{ name: "expr1" }, { name: "expr2" }], variadic: true, origin: "harvested" },
	], // functions/greatest/1.txt
	grouping: [{ name: "grouping", params: [{ name: "col" }], origin: "harvested" }], // functions/grouping/1.txt
	h3_boundaryasgeojson: [{ name: "h3_boundaryasgeojson", params: [{ name: "h3CellIdExpr" }], origin: "harvested" }], // functions/h3_boundaryasgeojson/1.txt
	h3_boundaryaswkb: [{ name: "h3_boundaryaswkb", params: [{ name: "h3CellIdExpr" }], origin: "harvested" }], // functions/h3_boundaryaswkb/1.txt
	h3_boundaryaswkt: [{ name: "h3_boundaryaswkt", params: [{ name: "h3CellIdExpr" }], origin: "harvested" }], // functions/h3_boundaryaswkt/1.txt
	h3_centerasgeojson: [{ name: "h3_centerasgeojson", params: [{ name: "h3CellIdExpr" }], origin: "harvested" }], // functions/h3_centerasgeojson/1.txt
	h3_centeraswkb: [{ name: "h3_centeraswkb", params: [{ name: "h3CellIdExpr" }], origin: "harvested" }], // functions/h3_centeraswkb/1.txt
	h3_centeraswkt: [{ name: "h3_centeraswkt", params: [{ name: "h3CellIdExpr" }], origin: "harvested" }], // functions/h3_centeraswkt/1.txt
	h3_compact: [{ name: "h3_compact", params: [{ name: "h3CellIdsExpr" }], origin: "harvested" }], // functions/h3_compact/1.txt
	h3_coverash3: [
		{ name: "h3_coverash3", params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }], origin: "harvested" },
	], // functions/h3_coverash3/1.txt
	h3_distance: [
		{ name: "h3_distance", params: [{ name: "h3CellId1Expr" }, { name: "h3CellId2Expr" }], origin: "harvested" },
	], // functions/h3_distance/1.txt
	h3_h3tostring: [{ name: "h3_h3tostring", params: [{ name: "h3CellIdExpr" }], origin: "harvested" }], // functions/h3_h3tostring/1.txt
	h3_hexring: [{ name: "h3_hexring", params: [{ name: "h3CellIdExpr" }, { name: "kExpr" }], origin: "harvested" }], // functions/h3_hexring/1.txt
	h3_ischildof: [
		{ name: "h3_ischildof", params: [{ name: "h3CellId1Expr" }, { name: "h3cellId2Expr" }], origin: "harvested" },
	], // functions/h3_ischildof/1.txt
	h3_ispentagon: [{ name: "h3_ispentagon", params: [{ name: "h3CellIdExpr" }], origin: "harvested" }], // functions/h3_ispentagon/1.txt
	h3_isvalid: [{ name: "h3_isvalid", params: [{ name: "expr" }], origin: "harvested" }], // functions/h3_isvalid/1.txt
	h3_kring: [{ name: "h3_kring", params: [{ name: "h3CellIdExpr" }, { name: "kExpr" }], origin: "harvested" }], // functions/h3_kring/1.txt
	h3_kringdistances: [
		{ name: "h3_kringdistances", params: [{ name: "h3CellIdExpr" }, { name: "kExpr" }], origin: "harvested" },
	], // functions/h3_kringdistances/1.txt
	h3_longlatash3: [
		{
			name: "h3_longlatash3",
			params: [{ name: "longitudeExpr" }, { name: "latitudeExpr" }, { name: "resolutionExpr" }],
			origin: "harvested",
		},
	], // functions/h3_longlatash3/1.txt
	h3_longlatash3string: [
		{
			name: "h3_longlatash3string",
			params: [{ name: "longitudeExpr" }, { name: "latitudeExpr" }, { name: "resolutionExpr" }],
			origin: "harvested",
		},
	], // functions/h3_longlatash3string/1.txt
	h3_maxchild: [
		{ name: "h3_maxchild", params: [{ name: "h3cellIdExpr" }, { name: "resolutionExpr" }], origin: "harvested" },
	], // functions/h3_maxchild/1.txt
	h3_minchild: [
		{ name: "h3_minchild", params: [{ name: "h3cellIdExpr" }, { name: "resolutionExpr" }], origin: "harvested" },
	], // functions/h3_minchild/1.txt
	h3_pointash3: [
		{ name: "h3_pointash3", params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }], origin: "harvested" },
	], // functions/h3_pointash3/1.txt
	h3_pointash3string: [
		{
			name: "h3_pointash3string",
			params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }],
			origin: "harvested",
		},
	], // functions/h3_pointash3string/1.txt
	h3_polyfillash3: [
		{
			name: "h3_polyfillash3",
			params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }],
			origin: "harvested",
		},
	], // functions/h3_polyfillash3/1.txt
	h3_polyfillash3string: [
		{
			name: "h3_polyfillash3string",
			params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }],
			origin: "harvested",
		},
	], // functions/h3_polyfillash3string/1.txt
	h3_resolution: [{ name: "h3_resolution", params: [{ name: "h3CellIdExpr" }], origin: "harvested" }], // functions/h3_resolution/1.txt
	h3_stringtoh3: [{ name: "h3_stringtoh3", params: [{ name: "h3CellIdExpr" }], origin: "harvested" }], // functions/h3_stringtoh3/1.txt
	h3_tessellateaswkb: [
		{
			name: "h3_tessellateaswkb",
			params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }],
			origin: "harvested",
		},
	], // functions/h3_tessellateaswkb/1.txt
	h3_tochildren: [
		{ name: "h3_tochildren", params: [{ name: "h3cellIdExpr" }, { name: "resolutionExpr" }], origin: "harvested" },
	], // functions/h3_tochildren/1.txt
	h3_toparent: [
		{ name: "h3_toparent", params: [{ name: "h3cellIdExpr" }, { name: "resolutionExpr" }], origin: "harvested" },
	], // functions/h3_toparent/1.txt
	h3_try_coverash3: [
		{
			name: "h3_try_coverash3",
			params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }],
			origin: "harvested",
		},
	], // functions/h3_try_coverash3/1.txt
	h3_try_coverash3string: [
		{
			name: "h3_try_coverash3string",
			params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }],
			origin: "harvested",
		},
	], // functions/h3_try_coverash3string/1.txt
	h3_try_distance: [
		{
			name: "h3_try_distance",
			params: [{ name: "h3CellId1Expr" }, { name: "h3CellId2Expr" }],
			origin: "harvested",
		},
	], // functions/h3_try_distance/1.txt
	h3_try_polyfillash3: [
		{
			name: "h3_try_polyfillash3",
			params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }],
			origin: "harvested",
		},
	], // functions/h3_try_polyfillash3/1.txt
	h3_try_polyfillash3string: [
		{
			name: "h3_try_polyfillash3string",
			params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }],
			origin: "harvested",
		},
	], // functions/h3_try_polyfillash3string/1.txt
	h3_try_tessellateaswkb: [
		{
			name: "h3_try_tessellateaswkb",
			params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }],
			origin: "harvested",
		},
	], // functions/h3_try_tessellateaswkb/1.txt
	h3_try_validate: [{ name: "h3_try_validate", params: [{ name: "h3CellIdExpr" }], origin: "harvested" }], // functions/h3_try_validate/1.txt
	h3_uncompact: [
		{ name: "h3_uncompact", params: [{ name: "h3CellIdsExpr" }, { name: "resolutionExpr" }], origin: "harvested" },
	], // functions/h3_uncompact/1.txt
	h3_validate: [{ name: "h3_validate", params: [{ name: "h3CellIdExpr" }], origin: "harvested" }], // functions/h3_validate/1.txt
	hash: [{ name: "hash", params: [{ name: "expr1" }], variadic: true, origin: "harvested" }], // functions/hash/1.txt
	hex: [{ name: "hex", params: [{ name: "expr" }], origin: "harvested" }], // functions/hex/1.txt
	histogram_numeric: [
		{ name: "histogram_numeric", params: [{ name: "expr" }, { name: "numBins" }], origin: "harvested" },
	], // functions/histogram_numeric/1.txt
	hll_sketch_agg: [
		{
			name: "hll_sketch_agg",
			params: [{ name: "expr" }, { name: "lgConfigK", optional: true }],
			origin: "harvested",
		},
	], // functions/hll_sketch_agg/1.txt
	hll_sketch_estimate: [{ name: "hll_sketch_estimate", params: [{ name: "expr" }], origin: "harvested" }], // functions/hll_sketch_estimate/1.txt
	hll_union: [
		{
			name: "hll_union",
			params: [{ name: "expr1" }, { name: "expr2" }, { name: "allowDifferentLgConfigK", optional: true }],
			origin: "harvested",
		},
	], // functions/hll_union/1.txt
	hll_union_agg: [
		{
			name: "hll_union_agg",
			params: [{ name: "expr" }, { name: "allowDifferentLgConfigK", optional: true }],
			origin: "harvested",
		},
	], // functions/hll_union_agg/1.txt
	hour: [{ name: "hour", params: [{ name: "expr" }], origin: "harvested" }], // functions/hour/1.txt
	hypot: [{ name: "hypot", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/hypot/1.txt
	if: [
		{
			name: "if",
			params: [{ name: "cond", type: "boolean" }, { name: "ifTrue" }, { name: "ifFalse" }],
			origin: "curated",
		},
	], // curated: if function
	iff: [{ name: "iff", params: [{ name: "cond" }, { name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/iff/1.txt
	ifnull: [{ name: "ifnull", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/ifnull/1.txt
	initcap: [{ name: "initcap", params: [{ name: "expr" }], origin: "harvested" }], // functions/initcap/1.txt
	inline: [{ name: "inline", params: [{ name: "input" }], origin: "harvested" }], // functions/inline/1.txt
	inline_outer: [{ name: "inline_outer", params: [{ name: "input" }], origin: "harvested" }], // functions/inline_outer/1.txt
	input_file_block_length: [{ name: "input_file_block_length", params: [], origin: "harvested" }], // functions/input_file_block_length/1.txt
	input_file_block_start: [{ name: "input_file_block_start", params: [], origin: "harvested" }], // functions/input_file_block_start/1.txt
	input_file_name: [{ name: "input_file_name", params: [], origin: "harvested" }], // functions/input_file_name/1.txt
	instr: [{ name: "instr", params: [{ name: "str" }, { name: "substr" }], origin: "harvested" }], // functions/instr/1.txt
	int: [{ name: "int", params: [{ name: "expr" }], origin: "harvested" }], // functions/int/1.txt
	ip_as_binary: [{ name: "ip_as_binary", params: [{ name: "ip_or_cidr" }], origin: "harvested" }], // functions/ip_as_binary/1.txt
	ip_as_string: [{ name: "ip_as_string", params: [{ name: "ip_or_cidr" }], origin: "harvested" }], // functions/ip_as_string/1.txt
	ip_cidr: [{ name: "ip_cidr", params: [{ name: "cidr" }], origin: "harvested" }], // functions/ip_cidr/1.txt
	ip_cidr_contains: [
		{ name: "ip_cidr_contains", params: [{ name: "cidr" }, { name: "needle" }], origin: "harvested" },
	], // functions/ip_cidr_contains/1.txt
	ip_host: [{ name: "ip_host", params: [{ name: "ip" }], origin: "harvested" }], // functions/ip_host/1.txt
	ip_network: [{ name: "ip_network", params: [{ name: "cidr" }], origin: "harvested" }], // functions/ip_network/1.txt
	ip_network_first: [{ name: "ip_network_first", params: [{ name: "cidr" }], origin: "harvested" }], // functions/ip_network_first/1.txt
	ip_network_last: [{ name: "ip_network_last", params: [{ name: "cidr" }], origin: "harvested" }], // functions/ip_network_last/1.txt
	ip_prefix_length: [{ name: "ip_prefix_length", params: [{ name: "cidr" }], origin: "harvested" }], // functions/ip_prefix_length/1.txt
	ip_version: [{ name: "ip_version", params: [{ name: "ip_or_cidr" }], origin: "harvested" }], // functions/ip_version/1.txt
	is_account_group_member: [{ name: "is_account_group_member", params: [{ name: "group" }], origin: "harvested" }], // functions/is_account_group_member/1.txt
	is_member: [{ name: "is_member", params: [{ name: "group" }], origin: "harvested" }], // functions/is_member/1.txt
	is_valid_utf8: [{ name: "is_valid_utf8", params: [{ name: "strExpr" }], origin: "harvested" }], // functions/is_valid_utf8/1.txt
	is_variant_null: [{ name: "is_variant_null", params: [{ name: "variantExpr" }], origin: "harvested" }], // functions/is_variant_null/1.txt
	isnan: [{ name: "isnan", params: [{ name: "expr" }], origin: "harvested" }], // functions/isnan/1.txt
	isnotnull: [{ name: "isnotnull", params: [{ name: "expr" }], origin: "harvested" }], // functions/isnotnull/1.txt
	isnull: [{ name: "isnull", params: [{ name: "expr" }], origin: "harvested" }], // functions/isnull/1.txt
	java_method: [
		{
			name: "java_method",
			params: [{ name: "class" }, { name: "method" }, { name: "arg1", optional: true }],
			variadic: true,
			origin: "harvested",
		},
	], // functions/java_method/1.txt
	json_array_length: [{ name: "json_array_length", params: [{ name: "jsonArray" }], origin: "harvested" }], // functions/json_array_length/1.txt
	json_object_keys: [{ name: "json_object_keys", params: [{ name: "jsonObject" }], origin: "harvested" }], // functions/json_object_keys/1.txt
	json_tuple: [
		{ name: "json_tuple", params: [{ name: "jsonStr" }, { name: "path1" }], variadic: true, origin: "harvested" },
	], // functions/json_tuple/1.txt
	kll_merge_agg_bigint: [
		{
			name: "kll_merge_agg_bigint",
			params: [{ name: "sketch" }, { name: "k", optional: true }],
			origin: "harvested",
		},
	], // functions/kll_merge_agg_bigint/1.txt
	kll_merge_agg_double: [
		{
			name: "kll_merge_agg_double",
			params: [{ name: "sketch" }, { name: "k", optional: true }],
			origin: "harvested",
		},
	], // functions/kll_merge_agg_double/1.txt
	kll_merge_agg_float: [
		{
			name: "kll_merge_agg_float",
			params: [{ name: "sketch" }, { name: "k", optional: true }],
			origin: "harvested",
		},
	], // functions/kll_merge_agg_float/1.txt
	kll_sketch_agg_bigint: [
		{
			name: "kll_sketch_agg_bigint",
			params: [{ name: "expr" }, { name: "k", optional: true }],
			origin: "harvested",
		},
	], // functions/kll_sketch_agg_bigint/1.txt
	kll_sketch_agg_double: [
		{
			name: "kll_sketch_agg_double",
			params: [{ name: "expr" }, { name: "k", optional: true }],
			origin: "harvested",
		},
	], // functions/kll_sketch_agg_double/1.txt
	kll_sketch_agg_float: [
		{
			name: "kll_sketch_agg_float",
			params: [{ name: "expr" }, { name: "k", optional: true }],
			origin: "harvested",
		},
	], // functions/kll_sketch_agg_float/1.txt
	kll_sketch_get_n_bigint: [{ name: "kll_sketch_get_n_bigint", params: [{ name: "sketch" }], origin: "harvested" }], // functions/kll_sketch_get_n_bigint/1.txt
	kll_sketch_get_n_double: [{ name: "kll_sketch_get_n_double", params: [{ name: "sketch" }], origin: "harvested" }], // functions/kll_sketch_get_n_double/1.txt
	kll_sketch_get_n_float: [{ name: "kll_sketch_get_n_float", params: [{ name: "sketch" }], origin: "harvested" }], // functions/kll_sketch_get_n_float/1.txt
	kll_sketch_get_quantile_bigint: [
		{ name: "kll_sketch_get_quantile_bigint", params: [{ name: "sketch" }, { name: "rank" }], origin: "harvested" },
	], // functions/kll_sketch_get_quantile_bigint/1.txt
	kll_sketch_get_quantile_double: [
		{ name: "kll_sketch_get_quantile_double", params: [{ name: "sketch" }, { name: "rank" }], origin: "harvested" },
	], // functions/kll_sketch_get_quantile_double/1.txt
	kll_sketch_get_quantile_float: [
		{ name: "kll_sketch_get_quantile_float", params: [{ name: "sketch" }, { name: "rank" }], origin: "harvested" },
	], // functions/kll_sketch_get_quantile_float/1.txt
	kll_sketch_get_rank_bigint: [
		{ name: "kll_sketch_get_rank_bigint", params: [{ name: "sketch" }, { name: "value" }], origin: "harvested" },
	], // functions/kll_sketch_get_rank_bigint/1.txt
	kll_sketch_get_rank_double: [
		{ name: "kll_sketch_get_rank_double", params: [{ name: "sketch" }, { name: "value" }], origin: "harvested" },
	], // functions/kll_sketch_get_rank_double/1.txt
	kll_sketch_get_rank_float: [
		{ name: "kll_sketch_get_rank_float", params: [{ name: "sketch" }, { name: "value" }], origin: "harvested" },
	], // functions/kll_sketch_get_rank_float/1.txt
	kll_sketch_merge_bigint: [
		{ name: "kll_sketch_merge_bigint", params: [{ name: "sketch1" }, { name: "sketch2" }], origin: "harvested" },
	], // functions/kll_sketch_merge_bigint/1.txt
	kll_sketch_merge_double: [
		{ name: "kll_sketch_merge_double", params: [{ name: "sketch1" }, { name: "sketch2" }], origin: "harvested" },
	], // functions/kll_sketch_merge_double/1.txt
	kll_sketch_merge_float: [
		{ name: "kll_sketch_merge_float", params: [{ name: "sketch1" }, { name: "sketch2" }], origin: "harvested" },
	], // functions/kll_sketch_merge_float/1.txt
	kll_sketch_to_string_bigint: [
		{ name: "kll_sketch_to_string_bigint", params: [{ name: "sketch" }], origin: "harvested" },
	], // functions/kll_sketch_to_string_bigint/1.txt
	kll_sketch_to_string_double: [
		{ name: "kll_sketch_to_string_double", params: [{ name: "sketch" }], origin: "harvested" },
	], // functions/kll_sketch_to_string_double/1.txt
	kll_sketch_to_string_float: [
		{ name: "kll_sketch_to_string_float", params: [{ name: "sketch" }], origin: "harvested" },
	], // functions/kll_sketch_to_string_float/1.txt
	kurtosis: [{ name: "kurtosis", params: [{ name: "expr" }], origin: "harvested" }], // functions/kurtosis/1.txt
	lag: [
		{
			name: "lag",
			params: [{ name: "expr" }, { name: "offset", optional: true }, { name: "default", optional: true }],
			origin: "harvested",
		},
	], // functions/lag/1.txt
	last: [{ name: "last", params: [{ name: "expr" }, { name: "ignoreNull", optional: true }], origin: "harvested" }], // functions/last/1.txt
	last_day: [{ name: "last_day", params: [{ name: "expr" }], origin: "harvested" }], // functions/last_day/1.txt
	last_value: [
		{ name: "last_value", params: [{ name: "expr" }, { name: "ignoreNull", optional: true }], origin: "harvested" },
	], // functions/last_value/1.txt
	lcase: [{ name: "lcase", params: [{ name: "expr" }], origin: "harvested" }], // functions/lcase/1.txt
	lead: [
		{
			name: "lead",
			params: [{ name: "expr" }, { name: "offset", optional: true }, { name: "default", optional: true }],
			origin: "harvested",
		},
	], // functions/lead/1.txt
	least: [{ name: "least", params: [{ name: "expr1" }, { name: "expr2" }], variadic: true, origin: "harvested" }], // functions/least/1.txt
	left: [{ name: "left", params: [{ name: "str" }, { name: "len" }], origin: "harvested" }], // functions/left/1.txt
	len: [{ name: "len", params: [{ name: "expr" }], origin: "harvested" }], // functions/len/1.txt
	length: [{ name: "length", params: [{ name: "expr" }], origin: "harvested" }], // functions/length/1.txt
	levenshtein: [
		{
			name: "levenshtein",
			params: [{ name: "str1" }, { name: "str2" }, { name: "maxDistance", optional: true }],
			origin: "harvested",
		},
	], // functions/levenshtein/1.txt
	list_secrets: [{ name: "list_secrets", params: [{ name: "scopeStr", optional: true }], origin: "harvested" }], // functions/list_secrets/1.txt
	listagg: [
		{ name: "listagg", params: [{ name: "expr" }, { name: "delimiter", optional: true }], origin: "harvested" },
	], // functions/listagg/1.txt
	ln: [{ name: "ln", params: [{ name: "expr" }], origin: "harvested" }], // functions/ln/1.txt
	locate: [
		{
			name: "locate",
			params: [{ name: "substr" }, { name: "str" }, { name: "pos", optional: true }],
			origin: "harvested",
		},
	], // functions/locate/1.txt
	log10: [{ name: "log10", params: [{ name: "expr" }], origin: "harvested" }], // functions/log10/1.txt
	log1p: [{ name: "log1p", params: [{ name: "expr" }], origin: "harvested" }], // functions/log1p/1.txt
	log2: [{ name: "log2", params: [{ name: "expr" }], origin: "harvested" }], // functions/log2/1.txt
	lower: [{ name: "lower", params: [{ name: "expr" }], origin: "harvested" }], // functions/lower/1.txt
	lpad: [
		{
			name: "lpad",
			params: [
				{ name: "str", type: "string" },
				{ name: "len", type: "int" },
				{ name: "pad", type: "string", optional: true },
			],
			origin: "curated",
		},
	], // curated: lpad function (pad optional)
	luhn_check: [{ name: "luhn_check", params: [{ name: "numStr" }], origin: "harvested" }], // functions/luhn_check/1.txt
	make_date: [
		{ name: "make_date", params: [{ name: "year" }, { name: "month" }, { name: "day" }], origin: "harvested" },
	], // functions/make_date/1.txt
	make_time: [
		{ name: "make_time", params: [{ name: "hour" }, { name: "minute" }, { name: "second" }], origin: "harvested" },
	], // functions/make_time/1.txt
	make_timestamp: [
		{
			name: "make_timestamp",
			params: [
				{ name: "year" },
				{ name: "month" },
				{ name: "day" },
				{ name: "hour" },
				{ name: "min" },
				{ name: "sec" },
				{ name: "timezone", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "make_timestamp",
			params: [{ name: "date" }, { name: "time", optional: true }, { name: "timezone", optional: true }],
			origin: "harvested",
		},
	], // functions/make_timestamp/1.txt
	make_valid_utf8: [{ name: "make_valid_utf8", params: [{ name: "strExpr" }], origin: "harvested" }], // functions/make_valid_utf8/1.txt
	map_contains_key: [{ name: "map_contains_key", params: [{ name: "map" }, { name: "key" }], origin: "harvested" }], // functions/map_contains_key/1.txt
	map_entries: [{ name: "map_entries", params: [{ name: "map" }], origin: "harvested" }], // functions/map_entries/1.txt
	map_filter: [{ name: "map_filter", params: [{ name: "expr" }, { name: "func" }], origin: "harvested" }], // functions/map_filter/1.txt
	map_from_arrays: [{ name: "map_from_arrays", params: [{ name: "keys" }, { name: "values" }], origin: "harvested" }], // functions/map_from_arrays/1.txt
	map_from_entries: [{ name: "map_from_entries", params: [{ name: "expr" }], origin: "harvested" }], // functions/map_from_entries/1.txt
	map_keys: [{ name: "map_keys", params: [{ name: "map" }], origin: "harvested" }], // functions/map_keys/1.txt
	map_values: [{ name: "map_values", params: [{ name: "map" }], origin: "harvested" }], // functions/map_values/1.txt
	map_zip_with: [
		{ name: "map_zip_with", params: [{ name: "map1" }, { name: "map2" }, { name: "func" }], origin: "harvested" },
	], // functions/map_zip_with/1.txt
	mask: [
		{
			name: "mask",
			params: [
				{ name: "str" },
				{ name: "upperChar", optional: true },
				{ name: "lowerChar", optional: true },
				{ name: "digitChar", optional: true },
				{ name: "otherChar", optional: true },
			],
			origin: "harvested",
		},
	], // functions/mask/1.txt
	match_number: [{ name: "match_number", params: [], origin: "harvested" }], // functions/match_number/1.txt
	max: [{ name: "max", params: [{ name: "expr" }], origin: "harvested" }], // functions/max/1.txt
	max_by: [
		{
			name: "max_by",
			params: [{ name: "expr" }, { name: "ordExpr" }, { name: "limit", optional: true }],
			origin: "harvested",
		},
	], // functions/max_by/2.txt
	md5: [{ name: "md5", params: [{ name: "expr" }], origin: "harvested" }], // functions/md5/1.txt
	mean: [{ name: "mean", params: [{ name: "expr" }], origin: "harvested" }], // functions/mean/1.txt
	measure: [{ name: "measure", params: [{ name: "measure_column" }], origin: "harvested" }], // functions/measure/1.txt
	median: [{ name: "median", params: [{ name: "expr" }], origin: "harvested" }], // functions/median/1.txt
	min: [{ name: "min", params: [{ name: "expr" }], origin: "harvested" }], // functions/min/1.txt
	min_by: [
		{
			name: "min_by",
			params: [{ name: "expr" }, { name: "ordExpr" }, { name: "limit", optional: true }],
			origin: "harvested",
		},
	], // functions/min_by/2.txt
	minute: [{ name: "minute", params: [{ name: "expr" }], origin: "harvested" }], // functions/minute/1.txt
	mod: [{ name: "mod", params: [{ name: "dividend" }, { name: "divisor" }], origin: "harvested" }], // functions/mod/1.txt
	mode: [
		{ name: "mode", params: [{ name: "expr" }, { name: "deterministic", optional: true }], origin: "harvested" },
	], // functions/mode/1.txt
	monotonically_increasing_id: [{ name: "monotonically_increasing_id", params: [], origin: "harvested" }], // functions/monotonically_increasing_id/1.txt
	month: [{ name: "month", params: [{ name: "expr" }], origin: "harvested" }], // functions/month/1.txt
	months_between: [
		{
			name: "months_between",
			params: [{ name: "expr1" }, { name: "expr2" }, { name: "roundOff", optional: true }],
			origin: "harvested",
		},
	], // functions/months_between/1.txt
	nanvl: [{ name: "nanvl", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/nanvl/1.txt
	negative: [{ name: "negative", params: [{ name: "expr" }], origin: "harvested" }], // functions/negative/1.txt
	next_day: [{ name: "next_day", params: [{ name: "expr" }, { name: "dayOfWeek" }], origin: "harvested" }], // functions/next_day/1.txt
	now: [{ name: "now", params: [], origin: "harvested" }], // functions/now/1.txt
	nth_value: [{ name: "nth_value", params: [{ name: "expr" }, { name: "offset" }], origin: "harvested" }], // functions/nth_value/1.txt
	ntile: [{ name: "ntile", params: [{ name: "n", optional: true }], origin: "harvested" }], // functions/ntile/1.txt
	nullif: [{ name: "nullif", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/nullif/1.txt
	nullifzero: [{ name: "nullifzero", params: [{ name: "expr" }], origin: "harvested" }], // functions/nullifzero/1.txt
	nvl: [{ name: "nvl", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/nvl/1.txt
	nvl2: [{ name: "nvl2", params: [{ name: "expr1" }, { name: "expr2" }, { name: "expr3" }], origin: "harvested" }], // functions/nvl2/1.txt
	octet_length: [{ name: "octet_length", params: [{ name: "expr" }], origin: "harvested" }], // functions/octet_length/1.txt
	overlay: [
		{
			name: "overlay",
			params: [{ name: "input" }, { name: "replace" }, { name: "pos" }, { name: "len", optional: true }],
			origin: "harvested",
		},
	], // functions/overlay/1.txt
	parse_json: [{ name: "parse_json", params: [{ name: "jsonStr" }], origin: "harvested" }], // functions/parse_json/1.txt
	parse_url: [
		{
			name: "parse_url",
			params: [{ name: "url" }, { name: "partToExtract" }, { name: "key", optional: true }],
			origin: "harvested",
		},
	], // functions/parse_url/1.txt
	percent_rank: [{ name: "percent_rank", params: [], origin: "harvested" }], // functions/percent_rank/1.txt
	percentile: [
		{
			name: "percentile",
			params: [{ name: "expr" }, { name: "percentage" }, { name: "frequency", optional: true }],
			origin: "harvested",
		},
	], // functions/percentile/1.txt
	percentile_approx: [
		{
			name: "percentile_approx",
			params: [{ name: "expr" }, { name: "percentile" }, { name: "accuracy", optional: true }],
			origin: "harvested",
		},
	], // functions/percentile_approx/1.txt
	percentile_cont: [{ name: "percentile_cont", params: [{ name: "percentile" }], origin: "harvested" }], // functions/percentile_cont/1.txt
	percentile_disc: [{ name: "percentile_disc", params: [{ name: "percentile" }], origin: "harvested" }], // functions/percentile_disc/1.txt
	pi: [{ name: "pi", params: [], origin: "harvested" }], // functions/pi/1.txt
	pmod: [{ name: "pmod", params: [{ name: "dividend" }, { name: "divisor" }], origin: "harvested" }], // functions/pmod/1.txt
	posexplode: [{ name: "posexplode", params: [{ name: "collection" }], origin: "harvested" }], // functions/posexplode/1.txt
	posexplode_outer: [{ name: "posexplode_outer", params: [{ name: "collection" }], origin: "harvested" }], // functions/posexplode_outer/1.txt
	position: [
		{
			name: "position",
			params: [{ name: "substr" }, { name: "str" }, { name: "pos", optional: true }],
			origin: "harvested",
		},
	], // functions/position/1.txt
	positive: [{ name: "positive", params: [{ name: "expr" }], origin: "harvested" }], // functions/positive/1.txt
	pow: [{ name: "pow", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/pow/1.txt
	power: [{ name: "power", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/power/1.txt
	quarter: [{ name: "quarter", params: [{ name: "expr" }], origin: "harvested" }], // functions/quarter/1.txt
	radians: [{ name: "radians", params: [{ name: "expr" }], origin: "harvested" }], // functions/radians/1.txt
	raise_error: [{ name: "raise_error", params: [{ name: "expr" }], origin: "harvested" }], // functions/raise_error/1.txt
	rand: [{ name: "rand", params: [{ name: "seed", optional: true }], origin: "harvested" }], // functions/rand/1.txt
	randn: [{ name: "randn", params: [{ name: "seed", optional: true }], origin: "harvested" }], // functions/randn/1.txt
	random: [{ name: "random", params: [{ name: "seed", optional: true }], origin: "harvested" }], // functions/random/1.txt
	randstr: [{ name: "randstr", params: [{ name: "length" }, { name: "seed", optional: true }], origin: "harvested" }], // functions/randstr/1.txt
	range: [
		{
			name: "range",
			params: [
				{ name: "start" },
				{ name: "end" },
				{ name: "step", optional: true },
				{ name: "numParts", optional: true },
			],
			origin: "harvested",
		},
		{ name: "range", params: [{ name: "end" }], origin: "harvested" },
	], // functions/range/1.txt
	rank: [{ name: "rank", params: [], origin: "harvested" }], // functions/rank/1.txt
	read_state_metadata: [{ name: "read_state_metadata", params: [{ name: "path" }], origin: "harvested" }], // functions/read_state_metadata/1.txt
	reduce: [
		{
			name: "reduce",
			params: [{ name: "expr" }, { name: "start" }, { name: "merge" }, { name: "finish", optional: true }],
			origin: "harvested",
		},
	], // functions/reduce/1.txt
	regexp_count: [{ name: "regexp_count", params: [{ name: "str" }, { name: "regexp" }], origin: "harvested" }], // functions/regexp_count/1.txt
	regexp_extract: [
		{
			name: "regexp_extract",
			params: [{ name: "str" }, { name: "regexp" }, { name: "idx", optional: true }],
			origin: "harvested",
		},
	], // functions/regexp_extract/1.txt
	regexp_extract_all: [
		{
			name: "regexp_extract_all",
			params: [{ name: "str" }, { name: "regexp" }, { name: "idx", optional: true }],
			origin: "harvested",
		},
	], // functions/regexp_extract_all/1.txt
	regexp_instr: [{ name: "regexp_instr", params: [{ name: "str" }, { name: "regexp" }], origin: "harvested" }], // functions/regexp_instr/1.txt
	regexp_replace: [
		{
			name: "regexp_replace",
			params: [{ name: "str" }, { name: "regexp" }, { name: "rep" }, { name: "position", optional: true }],
			origin: "harvested",
		},
	], // functions/regexp_replace/1.txt
	regexp_substr: [{ name: "regexp_substr", params: [{ name: "str" }, { name: "regexp" }], origin: "harvested" }], // functions/regexp_substr/1.txt
	regr_avgx: [{ name: "regr_avgx", params: [{ name: "yExpr" }, { name: "xExpr" }], origin: "harvested" }], // functions/regr_avgx/1.txt
	regr_avgy: [{ name: "regr_avgy", params: [{ name: "yExpr" }, { name: "xExpr" }], origin: "harvested" }], // functions/regr_avgy/1.txt
	regr_count: [{ name: "regr_count", params: [{ name: "yExpr" }, { name: "xExpr" }], origin: "harvested" }], // functions/regr_count/1.txt
	regr_intercept: [{ name: "regr_intercept", params: [{ name: "yExpr" }, { name: "xExpr" }], origin: "harvested" }], // functions/regr_intercept/1.txt
	regr_r2: [{ name: "regr_r2", params: [{ name: "yExpr" }, { name: "xExpr" }], origin: "harvested" }], // functions/regr_r2/1.txt
	regr_slope: [{ name: "regr_slope", params: [{ name: "yExpr" }, { name: "xExpr" }], origin: "harvested" }], // functions/regr_slope/1.txt
	regr_sxx: [{ name: "regr_sxx", params: [{ name: "yExpr" }, { name: "xExpr" }], origin: "harvested" }], // functions/regr_sxx/1.txt
	regr_sxy: [{ name: "regr_sxy", params: [{ name: "yExpr" }, { name: "xExpr" }], origin: "harvested" }], // functions/regr_sxy/1.txt
	regr_syy: [{ name: "regr_syy", params: [{ name: "yExpr" }, { name: "xExpr" }], origin: "harvested" }], // functions/regr_syy/1.txt
	repeat: [{ name: "repeat", params: [{ name: "expr" }, { name: "n" }], origin: "harvested" }], // functions/repeat/1.txt
	replace: [
		{
			name: "replace",
			params: [{ name: "str" }, { name: "search" }, { name: "replace", optional: true }],
			origin: "harvested",
		},
	], // functions/replace/1.txt
	reverse: [{ name: "reverse", params: [{ name: "expr" }], origin: "harvested" }], // functions/reverse/1.txt
	right: [{ name: "right", params: [{ name: "str" }, { name: "len" }], origin: "harvested" }], // functions/right/1.txt
	rint: [{ name: "rint", params: [{ name: "expr" }], origin: "harvested" }], // functions/rint/1.txt
	round: [
		{ name: "round", params: [{ name: "expr" }, { name: "targetScale", optional: true }], origin: "harvested" },
	], // functions/round/1.txt
	row_number: [{ name: "row_number", params: [], origin: "harvested" }], // functions/row_number/1.txt
	rpad: [
		{
			name: "rpad",
			params: [
				{ name: "str", type: "string" },
				{ name: "len", type: "int" },
				{ name: "pad", type: "string", optional: true },
			],
			origin: "curated",
		},
	], // curated: rpad function (pad optional)
	schema_of_csv: [
		{ name: "schema_of_csv", params: [{ name: "csv" }, { name: "options", optional: true }], origin: "harvested" },
	], // functions/schema_of_csv/1.txt
	schema_of_json: [
		{
			name: "schema_of_json",
			params: [{ name: "jsonStr" }, { name: "options", optional: true }],
			origin: "harvested",
		},
	], // functions/schema_of_json/1.txt
	schema_of_json_agg: [
		{
			name: "schema_of_json_agg",
			params: [{ name: "jsonStr" }, { name: "options", optional: true }],
			origin: "harvested",
		},
	], // functions/schema_of_json_agg/1.txt
	schema_of_variant: [{ name: "schema_of_variant", params: [{ name: "variantExpr" }], origin: "harvested" }], // functions/schema_of_variant/1.txt
	schema_of_variant_agg: [{ name: "schema_of_variant_agg", params: [{ name: "variantExpr" }], origin: "harvested" }], // functions/schema_of_variant_agg/1.txt
	schema_of_xml: [
		{
			name: "schema_of_xml",
			params: [{ name: "xmlStr" }, { name: "options", optional: true }],
			origin: "harvested",
		},
	], // functions/schema_of_xml/1.txt
	sec: [{ name: "sec", params: [{ name: "expr" }], origin: "harvested" }], // functions/sec/1.txt
	second: [{ name: "second", params: [{ name: "expr" }], origin: "harvested" }], // functions/second/1.txt
	secret: [{ name: "secret", params: [{ name: "scope" }, { name: "key" }], origin: "harvested" }], // functions/secret/1.txt
	sequence: [
		{
			name: "sequence",
			params: [{ name: "start" }, { name: "stop" }, { name: "step", optional: true }],
			origin: "harvested",
		},
	], // functions/sequence/1.txt
	session_user: [{ name: "session_user", params: [], origin: "harvested" }], // functions/session_user/1.txt
	session_window: [
		{ name: "session_window", params: [{ name: "expr" }, { name: "gapDuration" }], origin: "harvested" },
	], // functions/session_window/1.txt
	sha: [{ name: "sha", params: [{ name: "expr" }], origin: "harvested" }], // functions/sha/1.txt
	sha1: [{ name: "sha1", params: [{ name: "expr" }], origin: "harvested" }], // functions/sha1/1.txt
	sha2: [{ name: "sha2", params: [{ name: "expr" }, { name: "bitLength" }], origin: "harvested" }], // functions/sha2/1.txt
	shiftleft: [{ name: "shiftleft", params: [{ name: "expr" }, { name: "n" }], origin: "harvested" }], // functions/shiftleft/1.txt
	shiftright: [{ name: "shiftright", params: [{ name: "expr" }, { name: "n" }], origin: "harvested" }], // functions/shiftright/1.txt
	shiftrightunsigned: [
		{ name: "shiftrightunsigned", params: [{ name: "expr" }, { name: "n" }], origin: "harvested" },
	], // functions/shiftrightunsigned/1.txt
	shuffle: [{ name: "shuffle", params: [{ name: "expr" }], origin: "harvested" }], // functions/shuffle/1.txt
	sign: [{ name: "sign", params: [{ name: "expr" }], origin: "harvested" }], // functions/sign/1.txt
	signum: [{ name: "signum", params: [{ name: "expr" }], origin: "harvested" }], // functions/signum/1.txt
	sin: [{ name: "sin", params: [{ name: "expr" }], origin: "harvested" }], // functions/sin/1.txt
	sinh: [{ name: "sinh", params: [{ name: "expr" }], origin: "harvested" }], // functions/sinh/1.txt
	size: [{ name: "size", params: [{ name: "expr" }], origin: "harvested" }], // functions/size/1.txt
	skewness: [{ name: "skewness", params: [{ name: "expr" }], origin: "harvested" }], // functions/skewness/1.txt
	slice: [{ name: "slice", params: [{ name: "expr" }, { name: "start" }, { name: "length" }], origin: "harvested" }], // functions/slice/1.txt
	smallint: [{ name: "smallint", params: [{ name: "expr" }], origin: "harvested" }], // functions/smallint/1.txt
	sort_array: [
		{
			name: "sort_array",
			params: [{ name: "expr" }, { name: "ascendingOrder", optional: true }],
			origin: "harvested",
		},
	], // functions/sort_array/1.txt
	soundex: [{ name: "soundex", params: [{ name: "expr" }], origin: "harvested" }], // functions/soundex/1.txt
	space: [{ name: "space", params: [{ name: "n" }], origin: "harvested" }], // functions/space/1.txt
	spark_partition_id: [{ name: "spark_partition_id", params: [], origin: "harvested" }], // functions/spark_partition/1.txt
	split: [
		{
			name: "split",
			params: [{ name: "str" }, { name: "regex" }, { name: "limit", optional: true }],
			origin: "harvested",
		},
	], // functions/split/1.txt
	split_part: [
		{
			name: "split_part",
			params: [
				{ name: "str", type: "string" },
				{ name: "delimiter", type: "string" },
				{ name: "partNum", type: "int" },
			],
			origin: "curated",
		},
	], // curated: split_part function
	sql_keywords: [{ name: "sql_keywords", params: [], origin: "harvested" }], // functions/sql_keywords/1.txt
	sqrt: [{ name: "sqrt", params: [{ name: "expr" }], origin: "harvested" }], // functions/sqrt/1.txt
	st_addpoint: [
		{
			name: "st_addpoint",
			params: [{ name: "geo1Expr" }, { name: "geo2Expr" }, { name: "indexExpr", optional: true }],
			origin: "harvested",
		},
	], // functions/st_addpoint/1.txt
	st_area: [{ name: "st_area", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_area/1.txt
	st_asbinary: [
		{
			name: "st_asbinary",
			params: [{ name: "geoExpr" }, { name: "endiannessExpr", optional: true }],
			origin: "harvested",
		},
	], // functions/st_asbinary/1.txt
	st_asewkb: [
		{
			name: "st_asewkb",
			params: [{ name: "geoExpr" }, { name: "endiannessExpr", optional: true }],
			origin: "harvested",
		},
	], // functions/st_asewkb/1.txt
	st_asgeojson: [{ name: "st_asgeojson", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_asgeojson/1.txt
	st_astext: [{ name: "st_astext", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_astext/1.txt
	st_aswkb: [
		{
			name: "st_aswkb",
			params: [{ name: "geoExpr" }, { name: "endiannessExpr", optional: true }],
			origin: "harvested",
		},
	], // functions/st_aswkb/1.txt
	st_aswkt: [{ name: "st_aswkt", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_aswkt/1.txt
	st_azimuth: [{ name: "st_azimuth", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }], origin: "harvested" }], // functions/st_azimuth/1.txt
	st_boundary: [{ name: "st_boundary", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_boundary/1.txt
	st_buffer: [{ name: "st_buffer", params: [{ name: "geoExpr" }, { name: "radiusExpr" }], origin: "harvested" }], // functions/st_buffer/1.txt
	st_centroid: [{ name: "st_centroid", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_centroid/1.txt
	st_closestpoint: [
		{ name: "st_closestpoint", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }], origin: "harvested" },
	], // functions/st_closestpoint/1.txt
	st_collect: [{ name: "st_collect", params: [{ name: "geoArray" }], origin: "harvested" }], // functions/st_collect/1.txt
	st_concavehull: [
		{
			name: "st_concavehull",
			params: [{ name: "geoExpr" }, { name: "lengthRatioExpr" }, { name: "allowHolesExpr", optional: true }],
			origin: "harvested",
		},
	], // functions/st_concavehull/1.txt
	st_contains: [{ name: "st_contains", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }], origin: "harvested" }], // functions/st_contains/1.txt
	st_convexhull: [{ name: "st_convexhull", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_convexhull/1.txt
	st_covers: [{ name: "st_covers", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }], origin: "harvested" }], // functions/st_covers/1.txt
	st_difference: [
		{ name: "st_difference", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }], origin: "harvested" },
	], // functions/st_difference/1.txt
	st_dimension: [{ name: "st_dimension", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_dimension/1.txt
	st_disjoint: [{ name: "st_disjoint", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }], origin: "harvested" }], // functions/st_disjoint/1.txt
	st_distance: [{ name: "st_distance", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }], origin: "harvested" }], // functions/st_distance/1.txt
	st_distancesphere: [
		{ name: "st_distancesphere", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }], origin: "harvested" },
	], // functions/st_distancesphere/1.txt
	st_distancespheroid: [
		{ name: "st_distancespheroid", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }], origin: "harvested" },
	], // functions/st_distancespheroid/1.txt
	st_dump: [{ name: "st_dump", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_dump/1.txt
	st_dwithin: [
		{
			name: "st_dwithin",
			params: [{ name: "geoExpr1" }, { name: "geoExpr2" }, { name: "distanceExpr" }],
			origin: "harvested",
		},
	], // functions/st_dwithin/1.txt
	st_endpoint: [{ name: "st_endpoint", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_endpoint/1.txt
	st_envelope: [{ name: "st_envelope", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_envelope/1.txt
	st_envelope_agg: [{ name: "st_envelope_agg", params: [{ name: "geoCol" }], origin: "harvested" }], // functions/st_envelope_agg/1.txt
	st_equals: [{ name: "st_equals", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }], origin: "harvested" }], // functions/st_equals/1.txt
	st_estimatesrid: [{ name: "st_estimatesrid", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_estimatesrid/1.txt
	st_exteriorring: [{ name: "st_exteriorring", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_exteriorring/1.txt
	st_flipcoordinates: [{ name: "st_flipcoordinates", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_flipcoordinates/1.txt
	st_force2d: [{ name: "st_force2d", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_force2d/1.txt
	st_geogfromewkt: [{ name: "st_geogfromewkt", params: [{ name: "ewktExpr" }], origin: "harvested" }], // functions/st_geogfromewkt/1.txt
	st_geogfromgeojson: [{ name: "st_geogfromgeojson", params: [{ name: "geojsonExpr" }], origin: "harvested" }], // functions/st_geogfromgeojson/1.txt
	st_geogfromtext: [{ name: "st_geogfromtext", params: [{ name: "wktExpr" }], origin: "harvested" }], // functions/st_geogfromtext/1.txt
	st_geogfromwkb: [{ name: "st_geogfromwkb", params: [{ name: "wkbExpr" }], origin: "harvested" }], // functions/st_geogfromwkb/1.txt
	st_geogfromwkt: [{ name: "st_geogfromwkt", params: [{ name: "wktExpr" }], origin: "harvested" }], // functions/st_geogfromwkt/1.txt
	st_geohash: [
		{
			name: "st_geohash",
			params: [{ name: "geoExpr" }, { name: "precisionExpr", optional: true }],
			origin: "harvested",
		},
	], // functions/st_geohash/1.txt
	st_geometryn: [{ name: "st_geometryn", params: [{ name: "geoExpr" }, { name: "nExpr" }], origin: "harvested" }], // functions/st_geometryn/1.txt
	st_geometrytype: [{ name: "st_geometrytype", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_geometrytype/1.txt
	st_geomfromewkb: [{ name: "st_geomfromewkb", params: [{ name: "ewkbExpr" }], origin: "harvested" }], // functions/st_geomfromewkb/1.txt
	st_geomfromewkt: [{ name: "st_geomfromewkt", params: [{ name: "ewktExpr" }], origin: "harvested" }], // functions/st_geomfromewkt/1.txt
	st_geomfromgeohash: [{ name: "st_geomfromgeohash", params: [{ name: "geohashExpr" }], origin: "harvested" }], // functions/st_geomfromgeohash/1.txt
	st_geomfromgeojson: [{ name: "st_geomfromgeojson", params: [{ name: "geojsonExpr" }], origin: "harvested" }], // functions/st_geomfromgeojson/1.txt
	st_geomfromtext: [
		{
			name: "st_geomfromtext",
			params: [{ name: "wktExpr" }, { name: "sridExpr", optional: true }],
			origin: "harvested",
		},
	], // functions/st_geomfromtext/1.txt
	st_geomfromwkb: [
		{
			name: "st_geomfromwkb",
			params: [{ name: "wkbExpr" }, { name: "sridExpr", optional: true }],
			origin: "harvested",
		},
	], // functions/st_geomfromwkb/1.txt
	st_geomfromwkt: [
		{
			name: "st_geomfromwkt",
			params: [{ name: "wktExpr" }, { name: "sridExpr", optional: true }],
			origin: "harvested",
		},
	], // functions/st_geomfromwkt/1.txt
	st_interiorringn: [
		{ name: "st_interiorringn", params: [{ name: "geoExpr" }, { name: "indexExpr" }], origin: "harvested" },
	], // functions/st_interiorringn/1.txt
	st_intersection: [
		{ name: "st_intersection", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }], origin: "harvested" },
	], // functions/st_intersection/1.txt
	st_intersects: [
		{ name: "st_intersects", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }], origin: "harvested" },
	], // functions/st_intersects/1.txt
	st_isempty: [{ name: "st_isempty", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_isempty/1.txt
	st_isvalid: [{ name: "st_isvalid", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_isvalid/1.txt
	st_length: [{ name: "st_length", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_length/1.txt
	st_m: [{ name: "st_m", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_m/1.txt
	st_makeenvelope: [
		{
			name: "st_makeenvelope",
			params: [{ name: "x1" }, { name: "y1" }, { name: "x2" }, { name: "y2" }],
			origin: "harvested",
		},
	], // functions/st_makeenvelope/1.txt
	st_makeline: [{ name: "st_makeline", params: [{ name: "geoArray" }], origin: "harvested" }], // functions/st_makeline/1.txt
	st_makepoint: [
		{
			name: "st_makepoint",
			params: [{ name: "x" }, { name: "y" }, { name: "z", optional: true }, { name: "m", optional: true }],
			origin: "harvested",
		},
	], // functions/st_makepoint/1.txt
	st_makepolygon: [
		{
			name: "st_makepolygon",
			params: [{ name: "outer" }, { name: "innerArray", optional: true }],
			origin: "harvested",
		},
	], // functions/st_makepolygon/1.txt
	st_multi: [{ name: "st_multi", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_multi/1.txt
	st_ndims: [{ name: "st_ndims", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_ndims/1.txt
	st_npoints: [{ name: "st_npoints", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_npoints/1.txt
	st_nrings: [{ name: "st_nrings", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_nrings/1.txt
	st_numgeometries: [{ name: "st_numgeometries", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_numgeometries/1.txt
	st_numinteriorrings: [{ name: "st_numinteriorrings", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_numinteriorrings/1.txt
	st_numpoints: [{ name: "st_numpoints", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_numpoints/1.txt
	st_perimeter: [{ name: "st_perimeter", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_perimeter/1.txt
	st_point: [
		{
			name: "st_point",
			params: [{ name: "x" }, { name: "y" }, { name: "srid", optional: true }],
			origin: "harvested",
		},
	], // functions/st_point/1.txt
	st_pointfromgeohash: [{ name: "st_pointfromgeohash", params: [{ name: "geohash" }], origin: "harvested" }], // functions/st_pointfromgeohash/1.txt
	st_pointn: [{ name: "st_pointn", params: [{ name: "geoExpr" }, { name: "indexExpr" }], origin: "harvested" }], // functions/st_pointn/1.txt
	st_pointonsurface: [{ name: "st_pointonsurface", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_pointonsurface/1.txt
	st_removepoint: [
		{ name: "st_removepoint", params: [{ name: "geoExpr" }, { name: "indexExpr" }], origin: "harvested" },
	], // functions/st_removepoint/1.txt
	st_reverse: [{ name: "st_reverse", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_reverse/1.txt
	st_rotate: [{ name: "st_rotate", params: [{ name: "geoExpr" }, { name: "rotationAngle" }], origin: "harvested" }], // functions/st_rotate/1.txt
	st_scale: [
		{
			name: "st_scale",
			params: [
				{ name: "geoExpr" },
				{ name: "xfactor" },
				{ name: "yfactor" },
				{ name: "zfactor", optional: true },
			],
			origin: "harvested",
		},
	], // functions/st_scale/1.txt
	st_setpoint: [
		{
			name: "st_setpoint",
			params: [{ name: "geo1Expr" }, { name: "indexExpr" }, { name: "geo2Expr" }],
			origin: "harvested",
		},
	], // functions/st_setpoint/1.txt
	st_setsrid: [{ name: "st_setsrid", params: [{ name: "geo" }, { name: "srid" }], origin: "harvested" }], // functions/st_setsrid/1.txt
	st_simplify: [{ name: "st_simplify", params: [{ name: "geo" }, { name: "tolerance" }], origin: "harvested" }], // functions/st_simplify/1.txt
	st_srid: [{ name: "st_srid", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_srid/1.txt
	st_startpoint: [{ name: "st_startpoint", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_startpoint/1.txt
	st_touches: [{ name: "st_touches", params: [{ name: "geo1" }, { name: "geo2" }], origin: "harvested" }], // functions/st_touches/1.txt
	st_transform: [{ name: "st_transform", params: [{ name: "geo" }, { name: "srid" }], origin: "harvested" }], // functions/st_transform/1.txt
	st_translate: [
		{
			name: "st_translate",
			params: [
				{ name: "geoExpr" },
				{ name: "xfactor" },
				{ name: "yfactor" },
				{ name: "zfactor", optional: true },
			],
			origin: "harvested",
		},
	], // functions/st_translate/1.txt
	st_union: [{ name: "st_union", params: [{ name: "geo1" }, { name: "geo2" }], origin: "harvested" }], // functions/st_union/1.txt
	st_union_agg: [{ name: "st_union_agg", params: [{ name: "geoCol" }], origin: "harvested" }], // functions/st_union_agg/1.txt
	st_within: [{ name: "st_within", params: [{ name: "geo1" }, { name: "geo2" }], origin: "harvested" }], // functions/st_within/1.txt
	st_x: [{ name: "st_x", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_x/1.txt
	st_xmax: [{ name: "st_xmax", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_xmax/1.txt
	st_xmin: [{ name: "st_xmin", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_xmin/1.txt
	st_y: [{ name: "st_y", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_y/1.txt
	st_ymax: [{ name: "st_ymax", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_ymax/1.txt
	st_ymin: [{ name: "st_ymin", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_ymin/1.txt
	st_z: [{ name: "st_z", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_z/1.txt
	st_zmax: [{ name: "st_zmax", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_zmax/1.txt
	st_zmin: [{ name: "st_zmin", params: [{ name: "geoExpr" }], origin: "harvested" }], // functions/st_zmin/1.txt
	stack: [{ name: "stack", params: [{ name: "numRows" }, { name: "expr1" }], variadic: true, origin: "harvested" }], // functions/stack/1.txt
	startswith: [{ name: "startswith", params: [{ name: "expr" }, { name: "startExpr" }], origin: "harvested" }], // functions/startswith/1.txt
	std: [{ name: "std", params: [{ name: "expr" }], origin: "harvested" }], // functions/std/1.txt
	stddev: [{ name: "stddev", params: [{ name: "expr" }], origin: "harvested" }], // functions/stddev/1.txt
	stddev_pop: [{ name: "stddev_pop", params: [{ name: "expr" }], origin: "harvested" }], // functions/stddev_pop/1.txt
	stddev_samp: [{ name: "stddev_samp", params: [{ name: "expr" }], origin: "harvested" }], // functions/stddev_samp/1.txt
	str_to_map: [
		{
			name: "str_to_map",
			params: [
				{ name: "expr" },
				{ name: "pairDelim", optional: true },
				{ name: "keyValueDelim", optional: true },
			],
			origin: "harvested",
		},
	], // functions/str_to_map/1.txt
	string: [{ name: "string", params: [{ name: "expr" }], origin: "harvested" }], // functions/string/1.txt
	string_agg: [
		{ name: "string_agg", params: [{ name: "expr" }, { name: "delimiter", optional: true }], origin: "harvested" },
	], // functions/string_agg/1.txt
	substr: [
		{
			name: "substr",
			params: [
				{ name: "str", type: "string" },
				{ name: "pos", type: "int", optional: true },
				{ name: "len", type: "int", optional: true },
			],
			origin: "curated",
		},
	], // curated: substr function
	substring: [
		{
			name: "substring",
			params: [
				{ name: "str", type: "string" },
				{ name: "pos", type: "int" },
				{ name: "len", type: "int", optional: true },
			],
			origin: "curated",
		},
	], // curated: substring function
	substring_index: [
		{
			name: "substring_index",
			params: [{ name: "expr" }, { name: "delim" }, { name: "count" }],
			origin: "harvested",
		},
	], // functions/substring_index/1.txt
	sum: [{ name: "sum", params: [{ name: "expr" }], origin: "harvested" }], // functions/sum/1.txt
	table_changes: [
		{
			name: "table_changes",
			params: [{ name: "table_str" }, { name: "start" }, { name: "end", optional: true }],
			origin: "harvested",
		},
	], // functions/table_changes/1.txt
	tan: [{ name: "tan", params: [{ name: "expr" }], origin: "harvested" }], // functions/tan/1.txt
	tanh: [{ name: "tanh", params: [{ name: "expr" }], origin: "harvested" }], // functions/tanh/1.txt
	theta_difference: [
		{ name: "theta_difference", params: [{ name: "first" }, { name: "second" }], origin: "harvested" },
	], // functions/theta_difference/1.txt
	theta_intersection: [
		{ name: "theta_intersection", params: [{ name: "first" }, { name: "second" }], origin: "harvested" },
	], // functions/theta_intersection/1.txt
	theta_intersection_agg: [{ name: "theta_intersection_agg", params: [{ name: "sketch" }], origin: "harvested" }], // functions/theta_intersection_agg/1.txt
	theta_sketch_agg: [
		{
			name: "theta_sketch_agg",
			params: [{ name: "expr" }, { name: "lgNomEntries", optional: true }],
			origin: "harvested",
		},
	], // functions/theta_sketch_agg/1.txt
	theta_sketch_estimate: [{ name: "theta_sketch_estimate", params: [{ name: "sketch" }], origin: "harvested" }], // functions/theta_sketch_estimate/1.txt
	theta_union: [
		{
			name: "theta_union",
			params: [{ name: "first" }, { name: "second" }, { name: "lgNomEntries", optional: true }],
			origin: "harvested",
		},
	], // functions/theta_union/1.txt
	theta_union_agg: [
		{
			name: "theta_union_agg",
			params: [{ name: "sketch" }, { name: "lgNomEntries", optional: true }],
			origin: "harvested",
		},
	], // functions/theta_union_agg/1.txt
	time_diff: [
		{ name: "time_diff", params: [{ name: "unit" }, { name: "start" }, { name: "end" }], origin: "harvested" },
	], // functions/time_diff/1.txt
	time_from_micros: [{ name: "time_from_micros", params: [{ name: "expr" }], origin: "harvested" }], // functions/time_from_micros/1.txt
	time_from_millis: [{ name: "time_from_millis", params: [{ name: "expr" }], origin: "harvested" }], // functions/time_from_millis/1.txt
	time_from_seconds: [{ name: "time_from_seconds", params: [{ name: "expr" }], origin: "harvested" }], // functions/time_from_seconds/1.txt
	time_to_micros: [{ name: "time_to_micros", params: [{ name: "expr" }], origin: "harvested" }], // functions/time_to_micros/1.txt
	time_to_millis: [{ name: "time_to_millis", params: [{ name: "expr" }], origin: "harvested" }], // functions/time_to_millis/1.txt
	time_to_seconds: [{ name: "time_to_seconds", params: [{ name: "expr" }], origin: "harvested" }], // functions/time_to_seconds/1.txt
	time_trunc: [{ name: "time_trunc", params: [{ name: "unit" }, { name: "expr" }], origin: "harvested" }], // functions/time_trunc/1.txt
	timediff: [
		{ name: "timediff", params: [{ name: "unit" }, { name: "start" }, { name: "end" }], origin: "harvested" },
	], // functions/timediff/1.txt
	timestamp: [{ name: "timestamp", params: [{ name: "expr" }], origin: "harvested" }], // functions/timestamp/1.txt
	timestamp_micros: [{ name: "timestamp_micros", params: [{ name: "expr" }], origin: "harvested" }], // functions/timestamp_micros/1.txt
	timestamp_millis: [{ name: "timestamp_millis", params: [{ name: "expr" }], origin: "harvested" }], // functions/timestamp_millis/1.txt
	timestamp_seconds: [{ name: "timestamp_seconds", params: [{ name: "expr" }], origin: "harvested" }], // functions/timestamp_seconds/1.txt
	timestampadd: [
		{ name: "timestampadd", params: [{ name: "unit" }, { name: "value" }, { name: "expr" }], origin: "harvested" },
	], // functions/timestampadd/1.txt
	timestampdiff: [
		{ name: "timestampdiff", params: [{ name: "unit" }, { name: "start" }, { name: "end" }], origin: "harvested" },
	], // functions/timestampdiff/1.txt
	tinyint: [{ name: "tinyint", params: [{ name: "expr" }], origin: "harvested" }], // functions/tinyint/1.txt
	to_avro: [
		{
			name: "to_avro",
			params: [{ name: "expr" }, { name: "avroSchemaSpec", optional: true }],
			origin: "harvested",
		},
	], // functions/to_avro/1.txt
	to_binary: [
		{ name: "to_binary", params: [{ name: "expr" }, { name: "fmt", optional: true }], origin: "harvested" },
	], // functions/to_binary/1.txt
	to_csv: [{ name: "to_csv", params: [{ name: "expr" }, { name: "options", optional: true }], origin: "harvested" }], // functions/to_csv/1.txt
	to_date: [{ name: "to_date", params: [{ name: "expr" }, { name: "fmt", optional: true }], origin: "harvested" }], // functions/to_date/1.txt
	to_geography: [{ name: "to_geography", params: [{ name: "geoRepExpr" }], origin: "harvested" }], // functions/to_geography/1.txt
	to_geometry: [{ name: "to_geometry", params: [{ name: "geoRepExpr" }], origin: "harvested" }], // functions/to_geometry/1.txt
	to_json: [
		{ name: "to_json", params: [{ name: "expr" }, { name: "options", optional: true }], origin: "harvested" },
	], // functions/to_json/1.txt
	to_number: [{ name: "to_number", params: [{ name: "expr" }, { name: "fmt" }], origin: "harvested" }], // functions/to_number/1.txt
	to_time: [{ name: "to_time", params: [{ name: "expr" }, { name: "fmt", optional: true }], origin: "harvested" }], // functions/to_time/1.txt
	to_timestamp: [
		{ name: "to_timestamp", params: [{ name: "expr" }, { name: "fmt", optional: true }], origin: "harvested" },
	], // functions/to_timestamp/1.txt
	to_unix_timestamp: [
		{ name: "to_unix_timestamp", params: [{ name: "expr" }, { name: "fmt", optional: true }], origin: "harvested" },
	], // functions/to_unix_timestamp/1.txt
	to_utc_timestamp: [
		{ name: "to_utc_timestamp", params: [{ name: "expr" }, { name: "timeZone" }], origin: "harvested" },
	], // functions/to_utc_timestamp/1.txt
	to_variant_object: [{ name: "to_variant_object", params: [{ name: "expr" }], origin: "harvested" }], // functions/to_variant_object/1.txt
	to_xml: [{ name: "to_xml", params: [{ name: "expr" }, { name: "options", optional: true }], origin: "harvested" }], // functions/to_xml/1.txt
	transform: [{ name: "transform", params: [{ name: "expr" }, { name: "func" }], origin: "harvested" }], // functions/transform/1.txt
	transform_keys: [{ name: "transform_keys", params: [{ name: "expr" }, { name: "func" }], origin: "harvested" }], // functions/transform_keys/1.txt
	transform_values: [{ name: "transform_values", params: [{ name: "expr" }, { name: "func" }], origin: "harvested" }], // functions/transform_values/1.txt
	trim: [
		{
			name: "trim",
			params: [
				{ name: "str", type: "string" },
				{ name: "trimStr", type: "string", optional: true },
			],
			origin: "curated",
		},
	], // curated: trim function (trimStr optional)
	trunc: [{ name: "trunc", params: [{ name: "expr" }, { name: "unit" }], origin: "harvested" }], // functions/trunc/1.txt
	try_add: [{ name: "try_add", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/try_add/1.txt
	try_aes_decrypt: [
		{
			name: "try_aes_decrypt",
			params: [
				{ name: "expr" },
				{ name: "key" },
				{ name: "mode", optional: true },
				{ name: "padding", optional: true },
				{ name: "aad", optional: true },
			],
			origin: "harvested",
		},
	], // functions/try_aes_decrypt/1.txt
	try_avg: [{ name: "try_avg", params: [{ name: "expr" }], origin: "harvested" }], // functions/try_avg/1.txt
	try_divide: [{ name: "try_divide", params: [{ name: "dividend" }, { name: "divisor" }], origin: "harvested" }], // functions/try_divide/1.txt
	try_element_at: [
		{ name: "try_element_at", params: [{ name: "arrayExpr" }, { name: "index" }], origin: "harvested" },
		{ name: "try_element_at", params: [{ name: "mapExpr" }, { name: "key" }], origin: "harvested" },
	], // functions/try_element_at/1.txt, functions/try_element_at/2.txt
	try_ip_as_binary: [{ name: "try_ip_as_binary", params: [{ name: "ip_or_cidr" }], origin: "harvested" }], // functions/try_ip_as_binary/1.txt
	try_ip_as_string: [{ name: "try_ip_as_string", params: [{ name: "ip_or_cidr" }], origin: "harvested" }], // functions/try_ip_as_string/1.txt
	try_ip_cidr: [{ name: "try_ip_cidr", params: [{ name: "cidr" }], origin: "harvested" }], // functions/try_ip_cidr/1.txt
	try_ip_host: [{ name: "try_ip_host", params: [{ name: "ip" }], origin: "harvested" }], // functions/try_ip_host/1.txt
	try_mod: [{ name: "try_mod", params: [{ name: "dividend" }, { name: "divisor" }], origin: "harvested" }], // functions/try_mod/1.txt
	try_multiply: [
		{ name: "try_multiply", params: [{ name: "multiplier" }, { name: "multiplicand" }], origin: "harvested" },
	], // functions/try_multiply/1.txt
	try_parse_json: [{ name: "try_parse_json", params: [{ name: "jsonStr" }], origin: "harvested" }], // functions/try_parse_json/1.txt
	try_secret: [{ name: "try_secret", params: [{ name: "scope" }, { name: "key" }], origin: "harvested" }], // functions/try_secret/1.txt
	try_subtract: [{ name: "try_subtract", params: [{ name: "expr1" }, { name: "expr2" }], origin: "harvested" }], // functions/try_subtract/1.txt
	try_sum: [{ name: "try_sum", params: [{ name: "expr" }], origin: "harvested" }], // functions/try_sum/1.txt
	try_to_binary: [
		{ name: "try_to_binary", params: [{ name: "expr" }, { name: "fmt", optional: true }], origin: "harvested" },
	], // functions/try_to_binary/1.txt
	try_to_geography: [{ name: "try_to_geography", params: [{ name: "geoRepExpr" }], origin: "harvested" }], // functions/try_to_geography/1.txt
	try_to_geometry: [{ name: "try_to_geometry", params: [{ name: "geoRepExpr" }], origin: "harvested" }], // functions/try_to_geometry/1.txt
	try_to_number: [{ name: "try_to_number", params: [{ name: "expr" }, { name: "fmt" }], origin: "harvested" }], // functions/try_to_number/1.txt
	try_to_time: [
		{ name: "try_to_time", params: [{ name: "expr" }, { name: "fmt", optional: true }], origin: "harvested" },
	], // functions/try_to_time/1.txt
	try_to_timestamp: [
		{ name: "try_to_timestamp", params: [{ name: "expr" }, { name: "fmt", optional: true }], origin: "harvested" },
	], // functions/try_to_timestamp/1.txt
	try_url_decode: [{ name: "try_url_decode", params: [{ name: "str" }], origin: "harvested" }], // functions/try_url_decode/1.txt
	try_validate_utf8: [{ name: "try_validate_utf8", params: [{ name: "strExpr" }], origin: "harvested" }], // functions/try_validate_utf8/1.txt
	try_variant_get: [
		{
			name: "try_variant_get",
			params: [{ name: "variantExpr" }, { name: "path" }, { name: "type" }],
			origin: "harvested",
		},
	], // functions/try_variant_get/1.txt
	try_zstd_decompress: [{ name: "try_zstd_decompress", params: [{ name: "value" }], origin: "harvested" }], // functions/try_zstd_decompress/1.txt
	tuple_difference_double: [
		{ name: "tuple_difference_double", params: [{ name: "first" }, { name: "second" }], origin: "harvested" },
	], // functions/tuple_difference_double/1.txt
	tuple_difference_integer: [
		{ name: "tuple_difference_integer", params: [{ name: "first" }, { name: "second" }], origin: "harvested" },
	], // functions/tuple_difference_integer/1.txt
	tuple_intersection_agg_double: [
		{
			name: "tuple_intersection_agg_double",
			params: [{ name: "sketch" }, { name: "mode", optional: true }],
			origin: "harvested",
		},
	], // functions/tuple_intersection_agg_double/1.txt
	tuple_intersection_agg_integer: [
		{
			name: "tuple_intersection_agg_integer",
			params: [{ name: "sketch" }, { name: "mode", optional: true }],
			origin: "harvested",
		},
	], // functions/tuple_intersection_agg_integer/1.txt
	tuple_intersection_double: [
		{
			name: "tuple_intersection_double",
			params: [{ name: "first" }, { name: "second" }, { name: "mode", optional: true }],
			origin: "harvested",
		},
	], // functions/tuple_intersection_double/1.txt
	tuple_intersection_integer: [
		{
			name: "tuple_intersection_integer",
			params: [{ name: "first" }, { name: "second" }, { name: "mode", optional: true }],
			origin: "harvested",
		},
	], // functions/tuple_intersection_integer/1.txt
	tuple_sketch_agg_double: [
		{
			name: "tuple_sketch_agg_double",
			params: [
				{ name: "key" },
				{ name: "summary" },
				{ name: "lgNomEntries", optional: true },
				{ name: "mode", optional: true },
			],
			origin: "harvested",
		},
	], // functions/tuple_sketch_agg_double/1.txt
	tuple_sketch_agg_integer: [
		{
			name: "tuple_sketch_agg_integer",
			params: [
				{ name: "key" },
				{ name: "summary" },
				{ name: "lgNomEntries", optional: true },
				{ name: "mode", optional: true },
			],
			origin: "harvested",
		},
	], // functions/tuple_sketch_agg_integer/1.txt
	tuple_sketch_estimate_double: [
		{ name: "tuple_sketch_estimate_double", params: [{ name: "sketch" }], origin: "harvested" },
	], // functions/tuple_sketch_estimate_double/1.txt
	tuple_sketch_estimate_integer: [
		{ name: "tuple_sketch_estimate_integer", params: [{ name: "sketch" }], origin: "harvested" },
	], // functions/tuple_sketch_estimate_integer/1.txt
	tuple_sketch_summary_double: [
		{
			name: "tuple_sketch_summary_double",
			params: [{ name: "sketch" }, { name: "mode", optional: true }],
			origin: "harvested",
		},
	], // functions/tuple_sketch_summary_double/1.txt
	tuple_sketch_summary_integer: [
		{
			name: "tuple_sketch_summary_integer",
			params: [{ name: "sketch" }, { name: "mode", optional: true }],
			origin: "harvested",
		},
	], // functions/tuple_sketch_summary_integer/1.txt
	tuple_sketch_theta_double: [
		{ name: "tuple_sketch_theta_double", params: [{ name: "sketch" }], origin: "harvested" },
	], // functions/tuple_sketch_theta_double/1.txt
	tuple_sketch_theta_integer: [
		{ name: "tuple_sketch_theta_integer", params: [{ name: "sketch" }], origin: "harvested" },
	], // functions/tuple_sketch_theta_integer/1.txt
	tuple_union_agg_double: [
		{
			name: "tuple_union_agg_double",
			params: [{ name: "sketch" }, { name: "lgNomEntries", optional: true }, { name: "mode", optional: true }],
			origin: "harvested",
		},
	], // functions/tuple_union_agg_double/1.txt
	tuple_union_agg_integer: [
		{
			name: "tuple_union_agg_integer",
			params: [{ name: "sketch" }, { name: "lgNomEntries", optional: true }, { name: "mode", optional: true }],
			origin: "harvested",
		},
	], // functions/tuple_union_agg_integer/1.txt
	tuple_union_double: [
		{
			name: "tuple_union_double",
			params: [
				{ name: "first" },
				{ name: "second" },
				{ name: "lgNomEntries", optional: true },
				{ name: "mode", optional: true },
			],
			origin: "harvested",
		},
	], // functions/tuple_union_double/1.txt
	tuple_union_integer: [
		{
			name: "tuple_union_integer",
			params: [
				{ name: "first" },
				{ name: "second" },
				{ name: "lgNomEntries", optional: true },
				{ name: "mode", optional: true },
			],
			origin: "harvested",
		},
	], // functions/tuple_union_integer/1.txt
	typeof: [{ name: "typeof", params: [{ name: "expr" }], origin: "harvested" }], // functions/typeof/1.txt
	ucase: [{ name: "ucase", params: [{ name: "expr" }], origin: "harvested" }], // functions/ucase/1.txt
	unbase64: [{ name: "unbase64", params: [{ name: "expr" }], origin: "harvested" }], // functions/unbase64/1.txt
	unhex: [{ name: "unhex", params: [{ name: "expr" }], origin: "harvested" }], // functions/unhex/1.txt
	uniform: [
		{
			name: "uniform",
			params: [{ name: "boundaryExpr1" }, { name: "boundaryExpr2" }, { name: "seed", optional: true }],
			origin: "harvested",
		},
	], // functions/uniform/1.txt
	unix_date: [{ name: "unix_date", params: [{ name: "expr" }], origin: "harvested" }], // functions/unix_date/1.txt
	unix_micros: [{ name: "unix_micros", params: [{ name: "expr" }], origin: "harvested" }], // functions/unix_micros/1.txt
	unix_millis: [{ name: "unix_millis", params: [{ name: "expr" }], origin: "harvested" }], // functions/unix_millis/1.txt
	unix_seconds: [{ name: "unix_seconds", params: [{ name: "expr" }], origin: "harvested" }], // functions/unix_seconds/1.txt
	upper: [{ name: "upper", params: [{ name: "expr" }], origin: "harvested" }], // functions/upper/1.txt
	url_decode: [{ name: "url_decode", params: [{ name: "str" }], origin: "harvested" }], // functions/url_decode/1.txt
	url_encode: [{ name: "url_encode", params: [{ name: "str" }], origin: "harvested" }], // functions/url_encode/1.txt
	user: [{ name: "user", params: [], origin: "harvested" }], // functions/user/1.txt
	uuid: [{ name: "uuid", params: [], origin: "harvested" }], // functions/uuid/1.txt
	validate_utf8: [{ name: "validate_utf8", params: [{ name: "strExpr" }], origin: "harvested" }], // functions/validate_utf8/1.txt
	var_pop: [{ name: "var_pop", params: [{ name: "expr" }], origin: "harvested" }], // functions/var_pop/1.txt
	var_samp: [{ name: "var_samp", params: [{ name: "expr" }], origin: "harvested" }], // functions/var_samp/1.txt
	variance: [{ name: "variance", params: [{ name: "expr" }], origin: "harvested" }], // functions/variance/1.txt
	variant_explode: [{ name: "variant_explode", params: [{ name: "input" }], origin: "harvested" }], // functions/variant_explode/1.txt
	variant_explode_outer: [{ name: "variant_explode_outer", params: [{ name: "variantExpr" }], origin: "harvested" }], // functions/variant_explode_outer/1.txt
	variant_get: [
		{
			name: "variant_get",
			params: [{ name: "variantExpr" }, { name: "path" }, { name: "type" }],
			origin: "harvested",
		},
	], // functions/variant_get/1.txt
	vector_avg: [{ name: "vector_avg", params: [{ name: "vectors" }], origin: "harvested" }], // functions/vector_avg/1.txt
	vector_cosine_similarity: [
		{ name: "vector_cosine_similarity", params: [{ name: "vector1" }, { name: "vector2" }], origin: "harvested" },
	], // functions/vector_cosine_similarity/1.txt
	vector_inner_product: [
		{ name: "vector_inner_product", params: [{ name: "vector1" }, { name: "vector2" }], origin: "harvested" },
	], // functions/vector_inner_product/1.txt
	vector_l2_distance: [
		{ name: "vector_l2_distance", params: [{ name: "vector1" }, { name: "vector2" }], origin: "harvested" },
	], // functions/vector_l2_distance/1.txt
	vector_norm: [
		{ name: "vector_norm", params: [{ name: "vector" }, { name: "degree", optional: true }], origin: "harvested" },
	], // functions/vector_norm/1.txt
	vector_normalize: [
		{
			name: "vector_normalize",
			params: [{ name: "vector" }, { name: "degree", optional: true }],
			origin: "harvested",
		},
	], // functions/vector_normalize/1.txt
	vector_sum: [{ name: "vector_sum", params: [{ name: "vectors" }], origin: "harvested" }], // functions/vector_sum/1.txt
	version: [{ name: "version", params: [], origin: "harvested" }], // functions/version/1.txt
	weekday: [{ name: "weekday", params: [{ name: "expr" }], origin: "harvested" }], // functions/weekday/1.txt
	weekofyear: [{ name: "weekofyear", params: [{ name: "expr" }], origin: "harvested" }], // functions/weekofyear/1.txt
	width_bucket: [
		{
			name: "width_bucket",
			params: [{ name: "expr" }, { name: "minExpr" }, { name: "maxExpr" }, { name: "numBuckets" }],
			origin: "harvested",
		},
	], // functions/width_bucket/1.txt
	window: [
		{
			name: "window",
			params: [
				{ name: "expr" },
				{ name: "width" },
				{ name: "slide", optional: true },
				{ name: "start", optional: true },
			],
			origin: "harvested",
		},
	], // functions/window/1.txt
	window_time: [{ name: "window_time", params: [{ name: "window" }], origin: "harvested" }], // functions/window_time/1.txt
	xpath: [{ name: "xpath", params: [{ name: "xml" }, { name: "xpath" }], origin: "harvested" }], // functions/xpath/1.txt
	xpath_boolean: [{ name: "xpath_boolean", params: [{ name: "xml" }, { name: "xpath" }], origin: "harvested" }], // functions/xpath_boolean/1.txt
	xpath_double: [{ name: "xpath_double", params: [{ name: "xml" }, { name: "xpath" }], origin: "harvested" }], // functions/xpath_double/1.txt
	xpath_float: [{ name: "xpath_float", params: [{ name: "xml" }, { name: "xpath" }], origin: "harvested" }], // functions/xpath_float/1.txt
	xpath_int: [{ name: "xpath_int", params: [{ name: "xml" }, { name: "xpath" }], origin: "harvested" }], // functions/xpath_int/1.txt
	xpath_long: [{ name: "xpath_long", params: [{ name: "xml" }, { name: "xpath" }], origin: "harvested" }], // functions/xpath_long/1.txt
	xpath_number: [{ name: "xpath_number", params: [{ name: "xml" }, { name: "xpath" }], origin: "harvested" }], // functions/xpath_number/1.txt
	xpath_short: [{ name: "xpath_short", params: [{ name: "xml" }, { name: "xpath" }], origin: "harvested" }], // functions/xpath_short/1.txt
	xpath_string: [{ name: "xpath_string", params: [{ name: "xml" }, { name: "xpath" }], origin: "harvested" }], // functions/xpath_string/1.txt
	xxhash64: [{ name: "xxhash64", params: [{ name: "expr1" }], variadic: true, origin: "harvested" }], // functions/xxhash64/1.txt
	year: [{ name: "year", params: [{ name: "expr" }], origin: "harvested" }], // functions/year/1.txt
	zeroifnull: [{ name: "zeroifnull", params: [{ name: "expr" }], origin: "harvested" }], // functions/zeroifnull/1.txt
	zip_with: [
		{ name: "zip_with", params: [{ name: "expr1" }, { name: "expr2" }, { name: "func" }], origin: "harvested" },
	], // functions/zip_with/1.txt
	zstd_compress: [
		{
			name: "zstd_compress",
			params: [{ name: "value" }, { name: "level", optional: true }, { name: "streaming_mode", optional: true }],
			origin: "harvested",
		},
	], // functions/zstd_compress/1.txt
	zstd_decompress: [{ name: "zstd_decompress", params: [{ name: "value" }], origin: "harvested" }], // functions/zstd_decompress/1.txt
};
