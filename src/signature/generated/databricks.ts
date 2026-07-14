// GENERATED — do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// Source: docs.databricks.com  databricks/docs/syntax/functions/<name>/N.txt (Syntax blocks, captured by tools/scrape-databricks-syntax.mjs)
// Harvested 2026-07-14. 639 signatures. Curated FUNCTION_SIGNATURES override these.
import type { FnSignature } from "../signatures.js";

/** Harvested (doc-syntax-derived) parameter signatures for databricks, keyed by lowercased name. */
export const DATABRICKS_HARVESTED: Record<string, FnSignature> = {
	abs: { name: "abs", params: [{ name: "expr" }] }, // functions/abs/1.txt
	acos: { name: "acos", params: [{ name: "expr" }] }, // functions/acos/1.txt
	acosh: { name: "acosh", params: [{ name: "expr" }] }, // functions/acosh/1.txt
	add_months: { name: "add_months", params: [{ name: "startDate" }, { name: "numMonths" }] }, // functions/add_months/1.txt
	aes_decrypt: {
		name: "aes_decrypt",
		params: [
			{ name: "expr" },
			{ name: "key" },
			{ name: "mode", optional: true },
			{ name: "padding", optional: true },
			{ name: "aad", optional: true },
		],
	}, // functions/aes_decrypt/1.txt
	aes_encrypt: {
		name: "aes_encrypt",
		params: [
			{ name: "expr" },
			{ name: "key" },
			{ name: "mode", optional: true },
			{ name: "padding", optional: true },
			{ name: "iv", optional: true },
			{ name: "aad", optional: true },
		],
	}, // functions/aes_encrypt/1.txt
	agg: { name: "agg", params: [{ name: "measure_column" }] }, // functions/agg/1.txt
	aggregate: {
		name: "aggregate",
		params: [{ name: "expr" }, { name: "start" }, { name: "merge" }, { name: "finish", optional: true }],
	}, // functions/aggregate/1.txt
	ai_analyze_sentiment: { name: "ai_analyze_sentiment", params: [{ name: "content" }] }, // functions/ai_analyze_sentiment/1.txt
	ai_classify: {
		name: "ai_classify",
		params: [{ name: "content" }, { name: "labels" }, { name: "options", optional: true }],
	}, // functions/ai_classify/1.txt
	ai_fix_grammar: { name: "ai_fix_grammar", params: [{ name: "content" }] }, // functions/ai_fix_grammar/1.txt
	ai_gen: { name: "ai_gen", params: [{ name: "prompt" }] }, // functions/ai_gen/1.txt
	ai_mask: { name: "ai_mask", params: [{ name: "content" }, { name: "labels" }] }, // functions/ai_mask/1.txt
	ai_parse_document: { name: "ai_parse_document", params: [{ name: "content" }] }, // functions/ai_parse_document/1.txt
	ai_prep_search: { name: "ai_prep_search", params: [{ name: "parsed" }, { name: "options", optional: true }] }, // functions/ai_prep_search/1.txt
	ai_query: {
		name: "ai_query",
		params: [
			{ name: "endpoint" },
			{ name: "request" },
			{ name: "returnType", optional: true },
			{ name: "failOnError", optional: true },
		],
	}, // functions/ai_query/3.txt
	ai_similarity: { name: "ai_similarity", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/ai_similarity/1.txt
	ai_summarize: { name: "ai_summarize", params: [{ name: "content" }, { name: "max_words", optional: true }] }, // functions/ai_summarize/1.txt
	ai_translate: { name: "ai_translate", params: [{ name: "content" }, { name: "to_lang" }] }, // functions/ai_translate/1.txt
	approx_count_distinct: {
		name: "approx_count_distinct",
		params: [{ name: "expr" }, { name: "relativeSD", optional: true }],
	}, // functions/approx_count_distinct/1.txt
	approx_percentile: {
		name: "approx_percentile",
		params: [{ name: "expr" }, { name: "percentile" }, { name: "accuracy", optional: true }],
	}, // functions/approx_percentile/1.txt
	approx_top_k: {
		name: "approx_top_k",
		params: [{ name: "expr" }, { name: "k", optional: true }, { name: "maxItemsTracked", optional: true }],
	}, // functions/approx_top_k/1.txt
	approx_top_k_accumulate: {
		name: "approx_top_k_accumulate",
		params: [{ name: "expr" }, { name: "maxItemsTracked", optional: true }],
	}, // functions/approx_top_k_accumulate/1.txt
	approx_top_k_combine: {
		name: "approx_top_k_combine",
		params: [{ name: "state" }, { name: "maxItemsTracked", optional: true }],
	}, // functions/approx_top_k_combine/1.txt
	approx_top_k_estimate: {
		name: "approx_top_k_estimate",
		params: [{ name: "state" }, { name: "k", optional: true }],
	}, // functions/approx_top_k_estimate/1.txt
	array: { name: "array", params: [{ name: "expr" }], variadic: true }, // functions/array/1.txt
	array_agg: { name: "array_agg", params: [{ name: "expr" }] }, // functions/array_agg/1.txt
	array_append: { name: "array_append", params: [{ name: "array" }, { name: "elem" }] }, // functions/array_append/1.txt
	array_compact: { name: "array_compact", params: [{ name: "array" }] }, // functions/array_compact/1.txt
	array_contains: { name: "array_contains", params: [{ name: "array" }, { name: "value" }] }, // functions/array_contains/1.txt
	array_distinct: { name: "array_distinct", params: [{ name: "array" }] }, // functions/array_distinct/1.txt
	array_except: { name: "array_except", params: [{ name: "array1" }, { name: "array2" }] }, // functions/array_except/1.txt
	array_insert: { name: "array_insert", params: [{ name: "array" }, { name: "index" }, { name: "elem" }] }, // functions/array_insert/1.txt
	array_intersect: { name: "array_intersect", params: [{ name: "array1" }, { name: "array2" }] }, // functions/array_intersect/1.txt
	array_join: {
		name: "array_join",
		params: [{ name: "array" }, { name: "delimiter" }, { name: "nullReplacement", optional: true }],
	}, // functions/array_join/1.txt
	array_max: { name: "array_max", params: [{ name: "array" }] }, // functions/array_max/1.txt
	array_min: { name: "array_min", params: [{ name: "array" }] }, // functions/array_min/1.txt
	array_position: { name: "array_position", params: [{ name: "array" }, { name: "element" }] }, // functions/array_position/1.txt
	array_prepend: { name: "array_prepend", params: [{ name: "array" }, { name: "elem" }] }, // functions/array_prepend/1.txt
	array_remove: { name: "array_remove", params: [{ name: "array" }, { name: "element" }] }, // functions/array_remove/1.txt
	array_repeat: { name: "array_repeat", params: [{ name: "element" }, { name: "count" }] }, // functions/array_repeat/1.txt
	array_size: { name: "array_size", params: [{ name: "array" }] }, // functions/array_size/1.txt
	array_sort: { name: "array_sort", params: [{ name: "array" }, { name: "func" }] }, // functions/array_sort/1.txt
	array_union: { name: "array_union", params: [{ name: "array1" }, { name: "array2" }] }, // functions/array_union/1.txt
	arrays_overlap: { name: "arrays_overlap", params: [{ name: "array1" }, { name: "array2" }] }, // functions/arrays_overlap/1.txt
	arrays_zip: { name: "arrays_zip", params: [{ name: "array1" }], variadic: true }, // functions/arrays_zip/1.txt
	ascii: { name: "ascii", params: [{ name: "str" }] }, // functions/ascii/1.txt
	asin: { name: "asin", params: [{ name: "expr" }] }, // functions/asin/1.txt
	asinh: { name: "asinh", params: [{ name: "expr" }] }, // functions/asinh/1.txt
	assert_true: { name: "assert_true", params: [{ name: "condition" }, { name: "message", optional: true }] }, // functions/assert_true/1.txt
	atan: { name: "atan", params: [{ name: "expr" }] }, // functions/atan/1.txt
	atan2: { name: "atan2", params: [{ name: "exprY" }, { name: "exprX" }] }, // functions/atan2/1.txt
	atanh: { name: "atanh", params: [{ name: "expr" }] }, // functions/atanh/1.txt
	avg: { name: "avg", params: [{ name: "expr" }] }, // functions/avg/1.txt
	base64: { name: "base64", params: [{ name: "expr" }] }, // functions/base64/1.txt
	bigint: { name: "bigint", params: [{ name: "expr" }] }, // functions/bigint/1.txt
	bin: { name: "bin", params: [{ name: "expr" }] }, // functions/bin/1.txt
	binary: { name: "binary", params: [{ name: "expr" }] }, // functions/binary/1.txt
	bit_and: { name: "bit_and", params: [{ name: "expr" }] }, // functions/bit_and/1.txt
	bit_count: { name: "bit_count", params: [{ name: "expr" }] }, // functions/bit_count/1.txt
	bit_length: { name: "bit_length", params: [{ name: "expr" }] }, // functions/bit_length/1.txt
	bit_or: { name: "bit_or", params: [{ name: "expr" }] }, // functions/bit_or/1.txt
	bit_reverse: { name: "bit_reverse", params: [{ name: "expr" }] }, // functions/bit_reverse/1.txt
	bit_xor: { name: "bit_xor", params: [{ name: "expr" }] }, // functions/bit_xor/1.txt
	bitmap_and_agg: { name: "bitmap_and_agg", params: [{ name: "expr" }] }, // functions/bitmap_and_agg/1.txt
	bitmap_bit_position: { name: "bitmap_bit_position", params: [{ name: "expr" }] }, // functions/bitmap_bit_position/1.txt
	bitmap_bucket_number: { name: "bitmap_bucket_number", params: [{ name: "expr" }] }, // functions/bitmap_bucket_number/1.txt
	bitmap_construct_agg: { name: "bitmap_construct_agg", params: [{ name: "expr" }] }, // functions/bitmap_construct_agg/1.txt
	bitmap_count: { name: "bitmap_count", params: [{ name: "expr" }] }, // functions/bitmap_count/1.txt
	bitmap_or_agg: { name: "bitmap_or_agg", params: [{ name: "expr" }] }, // functions/bitmap_or_agg/1.txt
	bool_and: { name: "bool_and", params: [{ name: "expr" }] }, // functions/bool_and/1.txt
	bool_or: { name: "bool_or", params: [{ name: "expr" }] }, // functions/bool_or/1.txt
	boolean: { name: "boolean", params: [{ name: "expr" }] }, // functions/boolean/1.txt
	bround: { name: "bround", params: [{ name: "expr" }, { name: "targetScale", optional: true }] }, // functions/bround/1.txt
	btrim: { name: "btrim", params: [{ name: "str" }, { name: "trimStr", optional: true }] }, // functions/btrim/1.txt
	cardinality: { name: "cardinality", params: [{ name: "expr" }] }, // functions/cardinality/1.txt
	cbrt: { name: "cbrt", params: [{ name: "expr" }] }, // functions/cbrt/1.txt
	ceil: { name: "ceil", params: [{ name: "expr" }, { name: "targetScale", optional: true }] }, // functions/ceil/1.txt
	ceiling: { name: "ceiling", params: [{ name: "expr" }, { name: "targetScale", optional: true }] }, // functions/ceiling/1.txt
	char: { name: "char", params: [{ name: "expr" }] }, // functions/char/1.txt
	char_length: { name: "char_length", params: [{ name: "expr" }] }, // functions/char_length/1.txt
	character_length: { name: "character_length", params: [{ name: "expr" }] }, // functions/character_length/1.txt
	charindex: { name: "charindex", params: [{ name: "substr" }, { name: "str" }, { name: "pos", optional: true }] }, // functions/charindex/1.txt
	chr: { name: "chr", params: [{ name: "expr" }] }, // functions/chr/1.txt
	classifier: { name: "classifier", params: [] }, // functions/classifier/1.txt
	coalesce: { name: "coalesce", params: [{ name: "expr1" }], variadic: true }, // functions/coalesce/1.txt
	collation: { name: "collation", params: [{ name: "strExpr" }] }, // functions/collation/1.txt
	collations: { name: "collations", params: [] }, // functions/collations/1.txt
	collect_list: { name: "collect_list", params: [{ name: "expr" }] }, // functions/collect_list/1.txt
	collect_set: { name: "collect_set", params: [{ name: "expr" }] }, // functions/collect_set/1.txt
	concat: { name: "concat", params: [{ name: "expr1" }, { name: "expr2" }], variadic: true }, // functions/concat/1.txt
	concat_ws: { name: "concat_ws", params: [{ name: "sep" }, { name: "expr1", optional: true }], variadic: true }, // functions/concat_ws/1.txt
	contains: { name: "contains", params: [{ name: "expr" }, { name: "subExpr" }] }, // functions/contains/1.txt
	conv: { name: "conv", params: [{ name: "num" }, { name: "fromBase" }, { name: "toBase" }] }, // functions/conv/1.txt
	corr: { name: "corr", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/corr/1.txt
	cos: { name: "cos", params: [{ name: "expr" }] }, // functions/cos/1.txt
	cosh: { name: "cosh", params: [{ name: "expr" }] }, // functions/cosh/1.txt
	cot: { name: "cot", params: [{ name: "expr" }] }, // functions/cot/1.txt
	count: { name: "count", params: [{ name: "expr" }], variadic: true }, // functions/count/2.txt
	count_if: { name: "count_if", params: [{ name: "expr" }] }, // functions/count_if/1.txt
	count_min_sketch: {
		name: "count_min_sketch",
		params: [{ name: "column" }, { name: "epsilon" }, { name: "confidence" }, { name: "seed" }],
	}, // functions/count_min_sketch/1.txt
	covar_pop: { name: "covar_pop", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/covar_pop/1.txt
	covar_samp: { name: "covar_samp", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/covar_samp/1.txt
	crc32: { name: "crc32", params: [{ name: "expr" }] }, // functions/crc32/1.txt
	csc: { name: "csc", params: [{ name: "expr" }] }, // functions/csc/1.txt
	cube: { name: "cube", params: [{ name: "expr1" }], variadic: true }, // functions/cube/1.txt
	curdate: { name: "curdate", params: [] }, // functions/curdate/1.txt
	current_catalog: { name: "current_catalog", params: [] }, // functions/current_catalog/1.txt
	current_database: { name: "current_database", params: [] }, // functions/current_database/1.txt
	current_date: { name: "current_date", params: [] }, // functions/current_date/1.txt
	current_metastore: { name: "current_metastore", params: [] }, // functions/current_metastore/1.txt
	current_recipient: { name: "current_recipient", params: [{ name: "key" }] }, // functions/current_recipient/1.txt
	current_schema: { name: "current_schema", params: [] }, // functions/current_schema/1.txt
	current_time: { name: "current_time", params: [{ name: "precision", optional: true }] }, // functions/current_time/1.txt
	current_timestamp: { name: "current_timestamp", params: [] }, // functions/current_timestamp/1.txt
	current_timezone: { name: "current_timezone", params: [] }, // functions/current_timezone/1.txt
	current_user: { name: "current_user", params: [] }, // functions/current_user/1.txt
	current_version: { name: "current_version", params: [] }, // functions/current_version/1.txt
	date: { name: "date", params: [{ name: "expr" }] }, // functions/date/1.txt
	date_add: { name: "date_add", params: [{ name: "startDate" }, { name: "numDays" }] }, // functions/date_add/1.txt
	date_format: { name: "date_format", params: [{ name: "expr" }, { name: "fmt" }] }, // functions/date_format/1.txt
	date_from_unix_date: { name: "date_from_unix_date", params: [{ name: "days" }] }, // functions/date_from_unix_date/1.txt
	date_part: { name: "date_part", params: [{ name: "fieldStr" }, { name: "expr" }] }, // functions/date_part/1.txt
	date_sub: { name: "date_sub", params: [{ name: "startDate" }, { name: "numDays" }] }, // functions/date_sub/1.txt
	date_trunc: { name: "date_trunc", params: [{ name: "unit" }, { name: "expr" }] }, // functions/date_trunc/1.txt
	dateadd: { name: "dateadd", params: [{ name: "startDate" }, { name: "numDays" }] }, // functions/dateadd2/1.txt
	datediff: { name: "datediff", params: [{ name: "endDate" }, { name: "startDate" }] }, // functions/datediff/1.txt
	day: { name: "day", params: [{ name: "expr" }] }, // functions/day/1.txt
	dayname: { name: "dayname", params: [{ name: "expr" }] }, // functions/dayname/1.txt
	dayofmonth: { name: "dayofmonth", params: [{ name: "expr" }] }, // functions/dayofmonth/1.txt
	dayofweek: { name: "dayofweek", params: [{ name: "expr" }] }, // functions/dayofweek/1.txt
	dayofyear: { name: "dayofyear", params: [{ name: "expr" }] }, // functions/dayofyear/1.txt
	decimal: { name: "decimal", params: [{ name: "expr" }] }, // functions/decimal/1.txt
	decode: { name: "decode", params: [{ name: "expr" }, { name: "charSet" }] }, // functions/decode_cs/1.txt
	degrees: { name: "degrees", params: [{ name: "expr" }] }, // functions/degrees/1.txt
	dense_rank: { name: "dense_rank", params: [] }, // functions/dense_rank/1.txt
	double: { name: "double", params: [{ name: "expr" }] }, // functions/double/1.txt
	e: { name: "e", params: [] }, // functions/e/1.txt
	elt: { name: "elt", params: [{ name: "index" }, { name: "expr1" }], variadic: true }, // functions/elt/1.txt
	encode: { name: "encode", params: [{ name: "expr" }, { name: "charSet" }] }, // functions/encode/1.txt
	endswith: { name: "endswith", params: [{ name: "expr" }, { name: "endExpr" }] }, // functions/endswith/1.txt
	equal_null: { name: "equal_null", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/equal_null/1.txt
	every: { name: "every", params: [{ name: "expr" }] }, // functions/every/1.txt
	exp: { name: "exp", params: [{ name: "expr" }] }, // functions/exp/1.txt
	explode: { name: "explode", params: [{ name: "collection" }] }, // functions/explode/1.txt
	explode_outer: { name: "explode_outer", params: [{ name: "collection" }] }, // functions/explode_outer/1.txt
	expm1: { name: "expm1", params: [{ name: "expr" }] }, // functions/expm1/1.txt
	factorial: { name: "factorial", params: [{ name: "expr" }] }, // functions/factorial/1.txt
	filter: { name: "filter", params: [{ name: "expr" }, { name: "func" }] }, // functions/filter/1.txt
	find_in_set: { name: "find_in_set", params: [{ name: "searchExpr" }, { name: "sourceExpr" }] }, // functions/find_in_set/1.txt
	flatten: { name: "flatten", params: [{ name: "expr" }] }, // functions/flatten/1.txt
	float: { name: "float", params: [{ name: "expr" }] }, // functions/float/1.txt
	floor: { name: "floor", params: [{ name: "expr" }, { name: "targetScale", optional: true }] }, // functions/floor/1.txt
	forall: { name: "forall", params: [{ name: "expr" }, { name: "func" }] }, // functions/forall/1.txt
	format_string: {
		name: "format_string",
		params: [{ name: "strfmt" }, { name: "obj1", optional: true }],
		variadic: true,
	}, // functions/format_string/1.txt
	from_avro: { name: "from_avro", params: [{ name: "avroBin" }, { name: "jsonSchemaStr" }, { name: "options" }] }, // functions/from_avro/1.txt
	from_csv: {
		name: "from_csv",
		params: [{ name: "csvStr" }, { name: "schema" }, { name: "options", optional: true }],
	}, // functions/from_csv/1.txt
	from_json: {
		name: "from_json",
		params: [{ name: "jsonStr" }, { name: "schema" }, { name: "options", optional: true }],
	}, // functions/from_json/1.txt
	from_unixtime: { name: "from_unixtime", params: [{ name: "unixTime" }, { name: "fmt", optional: true }] }, // functions/from_unixtime/1.txt
	from_utc_timestamp: { name: "from_utc_timestamp", params: [{ name: "expr" }, { name: "timeZone" }] }, // functions/from_utc_timestamp/1.txt
	from_xml: {
		name: "from_xml",
		params: [{ name: "xmlStr" }, { name: "schema" }, { name: "options", optional: true }],
	}, // functions/from_xml/1.txt
	get: { name: "get", params: [{ name: "arrayExpr" }, { name: "index" }] }, // functions/get/1.txt
	get_json_object: { name: "get_json_object", params: [{ name: "expr" }, { name: "path" }] }, // functions/get_json_object/1.txt
	getdate: { name: "getdate", params: [] }, // functions/getdate/1.txt
	greatest: { name: "greatest", params: [{ name: "expr1" }, { name: "expr2" }], variadic: true }, // functions/greatest/1.txt
	grouping: { name: "grouping", params: [{ name: "col" }] }, // functions/grouping/1.txt
	h3_boundaryasgeojson: { name: "h3_boundaryasgeojson", params: [{ name: "h3CellIdExpr" }] }, // functions/h3_boundaryasgeojson/1.txt
	h3_boundaryaswkb: { name: "h3_boundaryaswkb", params: [{ name: "h3CellIdExpr" }] }, // functions/h3_boundaryaswkb/1.txt
	h3_boundaryaswkt: { name: "h3_boundaryaswkt", params: [{ name: "h3CellIdExpr" }] }, // functions/h3_boundaryaswkt/1.txt
	h3_centerasgeojson: { name: "h3_centerasgeojson", params: [{ name: "h3CellIdExpr" }] }, // functions/h3_centerasgeojson/1.txt
	h3_centeraswkb: { name: "h3_centeraswkb", params: [{ name: "h3CellIdExpr" }] }, // functions/h3_centeraswkb/1.txt
	h3_centeraswkt: { name: "h3_centeraswkt", params: [{ name: "h3CellIdExpr" }] }, // functions/h3_centeraswkt/1.txt
	h3_compact: { name: "h3_compact", params: [{ name: "h3CellIdsExpr" }] }, // functions/h3_compact/1.txt
	h3_coverash3: { name: "h3_coverash3", params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }] }, // functions/h3_coverash3/1.txt
	h3_distance: { name: "h3_distance", params: [{ name: "h3CellId1Expr" }, { name: "h3CellId2Expr" }] }, // functions/h3_distance/1.txt
	h3_h3tostring: { name: "h3_h3tostring", params: [{ name: "h3CellIdExpr" }] }, // functions/h3_h3tostring/1.txt
	h3_hexring: { name: "h3_hexring", params: [{ name: "h3CellIdExpr" }, { name: "kExpr" }] }, // functions/h3_hexring/1.txt
	h3_ischildof: { name: "h3_ischildof", params: [{ name: "h3CellId1Expr" }, { name: "h3cellId2Expr" }] }, // functions/h3_ischildof/1.txt
	h3_ispentagon: { name: "h3_ispentagon", params: [{ name: "h3CellIdExpr" }] }, // functions/h3_ispentagon/1.txt
	h3_isvalid: { name: "h3_isvalid", params: [{ name: "expr" }] }, // functions/h3_isvalid/1.txt
	h3_kring: { name: "h3_kring", params: [{ name: "h3CellIdExpr" }, { name: "kExpr" }] }, // functions/h3_kring/1.txt
	h3_kringdistances: { name: "h3_kringdistances", params: [{ name: "h3CellIdExpr" }, { name: "kExpr" }] }, // functions/h3_kringdistances/1.txt
	h3_longlatash3: {
		name: "h3_longlatash3",
		params: [{ name: "longitudeExpr" }, { name: "latitudeExpr" }, { name: "resolutionExpr" }],
	}, // functions/h3_longlatash3/1.txt
	h3_longlatash3string: {
		name: "h3_longlatash3string",
		params: [{ name: "longitudeExpr" }, { name: "latitudeExpr" }, { name: "resolutionExpr" }],
	}, // functions/h3_longlatash3string/1.txt
	h3_maxchild: { name: "h3_maxchild", params: [{ name: "h3cellIdExpr" }, { name: "resolutionExpr" }] }, // functions/h3_maxchild/1.txt
	h3_minchild: { name: "h3_minchild", params: [{ name: "h3cellIdExpr" }, { name: "resolutionExpr" }] }, // functions/h3_minchild/1.txt
	h3_pointash3: { name: "h3_pointash3", params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }] }, // functions/h3_pointash3/1.txt
	h3_pointash3string: { name: "h3_pointash3string", params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }] }, // functions/h3_pointash3string/1.txt
	h3_polyfillash3: { name: "h3_polyfillash3", params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }] }, // functions/h3_polyfillash3/1.txt
	h3_polyfillash3string: {
		name: "h3_polyfillash3string",
		params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }],
	}, // functions/h3_polyfillash3string/1.txt
	h3_resolution: { name: "h3_resolution", params: [{ name: "h3CellIdExpr" }] }, // functions/h3_resolution/1.txt
	h3_stringtoh3: { name: "h3_stringtoh3", params: [{ name: "h3CellIdExpr" }] }, // functions/h3_stringtoh3/1.txt
	h3_tessellateaswkb: { name: "h3_tessellateaswkb", params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }] }, // functions/h3_tessellateaswkb/1.txt
	h3_tochildren: { name: "h3_tochildren", params: [{ name: "h3cellIdExpr" }, { name: "resolutionExpr" }] }, // functions/h3_tochildren/1.txt
	h3_toparent: { name: "h3_toparent", params: [{ name: "h3cellIdExpr" }, { name: "resolutionExpr" }] }, // functions/h3_toparent/1.txt
	h3_try_coverash3: { name: "h3_try_coverash3", params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }] }, // functions/h3_try_coverash3/1.txt
	h3_try_coverash3string: {
		name: "h3_try_coverash3string",
		params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }],
	}, // functions/h3_try_coverash3string/1.txt
	h3_try_distance: { name: "h3_try_distance", params: [{ name: "h3CellId1Expr" }, { name: "h3CellId2Expr" }] }, // functions/h3_try_distance/1.txt
	h3_try_polyfillash3: {
		name: "h3_try_polyfillash3",
		params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }],
	}, // functions/h3_try_polyfillash3/1.txt
	h3_try_polyfillash3string: {
		name: "h3_try_polyfillash3string",
		params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }],
	}, // functions/h3_try_polyfillash3string/1.txt
	h3_try_tessellateaswkb: {
		name: "h3_try_tessellateaswkb",
		params: [{ name: "geographyExpr" }, { name: "resolutionExpr" }],
	}, // functions/h3_try_tessellateaswkb/1.txt
	h3_try_validate: { name: "h3_try_validate", params: [{ name: "h3CellIdExpr" }] }, // functions/h3_try_validate/1.txt
	h3_uncompact: { name: "h3_uncompact", params: [{ name: "h3CellIdsExpr" }, { name: "resolutionExpr" }] }, // functions/h3_uncompact/1.txt
	h3_validate: { name: "h3_validate", params: [{ name: "h3CellIdExpr" }] }, // functions/h3_validate/1.txt
	hash: { name: "hash", params: [{ name: "expr1" }], variadic: true }, // functions/hash/1.txt
	hex: { name: "hex", params: [{ name: "expr" }] }, // functions/hex/1.txt
	histogram_numeric: { name: "histogram_numeric", params: [{ name: "expr" }, { name: "numBins" }] }, // functions/histogram_numeric/1.txt
	hll_sketch_agg: { name: "hll_sketch_agg", params: [{ name: "expr" }, { name: "lgConfigK", optional: true }] }, // functions/hll_sketch_agg/1.txt
	hll_sketch_estimate: { name: "hll_sketch_estimate", params: [{ name: "expr" }] }, // functions/hll_sketch_estimate/1.txt
	hll_union: {
		name: "hll_union",
		params: [{ name: "expr1" }, { name: "expr2" }, { name: "allowDifferentLgConfigK", optional: true }],
	}, // functions/hll_union/1.txt
	hll_union_agg: {
		name: "hll_union_agg",
		params: [{ name: "expr" }, { name: "allowDifferentLgConfigK", optional: true }],
	}, // functions/hll_union_agg/1.txt
	hour: { name: "hour", params: [{ name: "expr" }] }, // functions/hour/1.txt
	hypot: { name: "hypot", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/hypot/1.txt
	if: { name: "if", params: [{ name: "cond" }, { name: "expr1" }, { name: "expr2" }] }, // functions/if/1.txt
	iff: { name: "iff", params: [{ name: "cond" }, { name: "expr1" }, { name: "expr2" }] }, // functions/iff/1.txt
	ifnull: { name: "ifnull", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/ifnull/1.txt
	initcap: { name: "initcap", params: [{ name: "expr" }] }, // functions/initcap/1.txt
	inline: { name: "inline", params: [{ name: "input" }] }, // functions/inline/1.txt
	inline_outer: { name: "inline_outer", params: [{ name: "input" }] }, // functions/inline_outer/1.txt
	input_file_block_length: { name: "input_file_block_length", params: [] }, // functions/input_file_block_length/1.txt
	input_file_block_start: { name: "input_file_block_start", params: [] }, // functions/input_file_block_start/1.txt
	input_file_name: { name: "input_file_name", params: [] }, // functions/input_file_name/1.txt
	instr: { name: "instr", params: [{ name: "str" }, { name: "substr" }] }, // functions/instr/1.txt
	int: { name: "int", params: [{ name: "expr" }] }, // functions/int/1.txt
	ip_as_binary: { name: "ip_as_binary", params: [{ name: "ip_or_cidr" }] }, // functions/ip_as_binary/1.txt
	ip_as_string: { name: "ip_as_string", params: [{ name: "ip_or_cidr" }] }, // functions/ip_as_string/1.txt
	ip_cidr: { name: "ip_cidr", params: [{ name: "cidr" }] }, // functions/ip_cidr/1.txt
	ip_cidr_contains: { name: "ip_cidr_contains", params: [{ name: "cidr" }, { name: "needle" }] }, // functions/ip_cidr_contains/1.txt
	ip_host: { name: "ip_host", params: [{ name: "ip" }] }, // functions/ip_host/1.txt
	ip_network: { name: "ip_network", params: [{ name: "cidr" }] }, // functions/ip_network/1.txt
	ip_network_first: { name: "ip_network_first", params: [{ name: "cidr" }] }, // functions/ip_network_first/1.txt
	ip_network_last: { name: "ip_network_last", params: [{ name: "cidr" }] }, // functions/ip_network_last/1.txt
	ip_prefix_length: { name: "ip_prefix_length", params: [{ name: "cidr" }] }, // functions/ip_prefix_length/1.txt
	ip_version: { name: "ip_version", params: [{ name: "ip_or_cidr" }] }, // functions/ip_version/1.txt
	is_account_group_member: { name: "is_account_group_member", params: [{ name: "group" }] }, // functions/is_account_group_member/1.txt
	is_member: { name: "is_member", params: [{ name: "group" }] }, // functions/is_member/1.txt
	is_valid_utf8: { name: "is_valid_utf8", params: [{ name: "strExpr" }] }, // functions/is_valid_utf8/1.txt
	is_variant_null: { name: "is_variant_null", params: [{ name: "variantExpr" }] }, // functions/is_variant_null/1.txt
	isnan: { name: "isnan", params: [{ name: "expr" }] }, // functions/isnan/1.txt
	isnotnull: { name: "isnotnull", params: [{ name: "expr" }] }, // functions/isnotnull/1.txt
	isnull: { name: "isnull", params: [{ name: "expr" }] }, // functions/isnull/1.txt
	java_method: {
		name: "java_method",
		params: [{ name: "class" }, { name: "method" }, { name: "arg1", optional: true }],
		variadic: true,
	}, // functions/java_method/1.txt
	json_array_length: { name: "json_array_length", params: [{ name: "jsonArray" }] }, // functions/json_array_length/1.txt
	json_object_keys: { name: "json_object_keys", params: [{ name: "jsonObject" }] }, // functions/json_object_keys/1.txt
	json_tuple: { name: "json_tuple", params: [{ name: "jsonStr" }, { name: "path1" }], variadic: true }, // functions/json_tuple/1.txt
	kll_merge_agg_bigint: { name: "kll_merge_agg_bigint", params: [{ name: "sketch" }, { name: "k", optional: true }] }, // functions/kll_merge_agg_bigint/1.txt
	kll_merge_agg_double: { name: "kll_merge_agg_double", params: [{ name: "sketch" }, { name: "k", optional: true }] }, // functions/kll_merge_agg_double/1.txt
	kll_merge_agg_float: { name: "kll_merge_agg_float", params: [{ name: "sketch" }, { name: "k", optional: true }] }, // functions/kll_merge_agg_float/1.txt
	kll_sketch_agg_bigint: { name: "kll_sketch_agg_bigint", params: [{ name: "expr" }, { name: "k", optional: true }] }, // functions/kll_sketch_agg_bigint/1.txt
	kll_sketch_agg_double: { name: "kll_sketch_agg_double", params: [{ name: "expr" }, { name: "k", optional: true }] }, // functions/kll_sketch_agg_double/1.txt
	kll_sketch_agg_float: { name: "kll_sketch_agg_float", params: [{ name: "expr" }, { name: "k", optional: true }] }, // functions/kll_sketch_agg_float/1.txt
	kll_sketch_get_n_bigint: { name: "kll_sketch_get_n_bigint", params: [{ name: "sketch" }] }, // functions/kll_sketch_get_n_bigint/1.txt
	kll_sketch_get_n_double: { name: "kll_sketch_get_n_double", params: [{ name: "sketch" }] }, // functions/kll_sketch_get_n_double/1.txt
	kll_sketch_get_n_float: { name: "kll_sketch_get_n_float", params: [{ name: "sketch" }] }, // functions/kll_sketch_get_n_float/1.txt
	kll_sketch_get_quantile_bigint: {
		name: "kll_sketch_get_quantile_bigint",
		params: [{ name: "sketch" }, { name: "rank" }],
	}, // functions/kll_sketch_get_quantile_bigint/1.txt
	kll_sketch_get_quantile_double: {
		name: "kll_sketch_get_quantile_double",
		params: [{ name: "sketch" }, { name: "rank" }],
	}, // functions/kll_sketch_get_quantile_double/1.txt
	kll_sketch_get_quantile_float: {
		name: "kll_sketch_get_quantile_float",
		params: [{ name: "sketch" }, { name: "rank" }],
	}, // functions/kll_sketch_get_quantile_float/1.txt
	kll_sketch_get_rank_bigint: { name: "kll_sketch_get_rank_bigint", params: [{ name: "sketch" }, { name: "value" }] }, // functions/kll_sketch_get_rank_bigint/1.txt
	kll_sketch_get_rank_double: { name: "kll_sketch_get_rank_double", params: [{ name: "sketch" }, { name: "value" }] }, // functions/kll_sketch_get_rank_double/1.txt
	kll_sketch_get_rank_float: { name: "kll_sketch_get_rank_float", params: [{ name: "sketch" }, { name: "value" }] }, // functions/kll_sketch_get_rank_float/1.txt
	kll_sketch_merge_bigint: { name: "kll_sketch_merge_bigint", params: [{ name: "sketch1" }, { name: "sketch2" }] }, // functions/kll_sketch_merge_bigint/1.txt
	kll_sketch_merge_double: { name: "kll_sketch_merge_double", params: [{ name: "sketch1" }, { name: "sketch2" }] }, // functions/kll_sketch_merge_double/1.txt
	kll_sketch_merge_float: { name: "kll_sketch_merge_float", params: [{ name: "sketch1" }, { name: "sketch2" }] }, // functions/kll_sketch_merge_float/1.txt
	kll_sketch_to_string_bigint: { name: "kll_sketch_to_string_bigint", params: [{ name: "sketch" }] }, // functions/kll_sketch_to_string_bigint/1.txt
	kll_sketch_to_string_double: { name: "kll_sketch_to_string_double", params: [{ name: "sketch" }] }, // functions/kll_sketch_to_string_double/1.txt
	kll_sketch_to_string_float: { name: "kll_sketch_to_string_float", params: [{ name: "sketch" }] }, // functions/kll_sketch_to_string_float/1.txt
	kurtosis: { name: "kurtosis", params: [{ name: "expr" }] }, // functions/kurtosis/1.txt
	last_day: { name: "last_day", params: [{ name: "expr" }] }, // functions/last_day/1.txt
	lcase: { name: "lcase", params: [{ name: "expr" }] }, // functions/lcase/1.txt
	least: { name: "least", params: [{ name: "expr1" }, { name: "expr2" }], variadic: true }, // functions/least/1.txt
	left: { name: "left", params: [{ name: "str" }, { name: "len" }] }, // functions/left/1.txt
	len: { name: "len", params: [{ name: "expr" }] }, // functions/len/1.txt
	length: { name: "length", params: [{ name: "expr" }] }, // functions/length/1.txt
	levenshtein: {
		name: "levenshtein",
		params: [{ name: "str1" }, { name: "str2" }, { name: "maxDistance", optional: true }],
	}, // functions/levenshtein/1.txt
	list_secrets: { name: "list_secrets", params: [{ name: "scopeStr", optional: true }] }, // functions/list_secrets/1.txt
	ln: { name: "ln", params: [{ name: "expr" }] }, // functions/ln/1.txt
	locate: { name: "locate", params: [{ name: "substr" }, { name: "str" }, { name: "pos", optional: true }] }, // functions/locate/1.txt
	log10: { name: "log10", params: [{ name: "expr" }] }, // functions/log10/1.txt
	log1p: { name: "log1p", params: [{ name: "expr" }] }, // functions/log1p/1.txt
	log2: { name: "log2", params: [{ name: "expr" }] }, // functions/log2/1.txt
	lower: { name: "lower", params: [{ name: "expr" }] }, // functions/lower/1.txt
	lpad: { name: "lpad", params: [{ name: "expr" }, { name: "len" }, { name: "pad", optional: true }] }, // functions/lpad/1.txt
	luhn_check: { name: "luhn_check", params: [{ name: "numStr" }] }, // functions/luhn_check/1.txt
	make_date: { name: "make_date", params: [{ name: "year" }, { name: "month" }, { name: "day" }] }, // functions/make_date/1.txt
	make_time: { name: "make_time", params: [{ name: "hour" }, { name: "minute" }, { name: "second" }] }, // functions/make_time/1.txt
	make_valid_utf8: { name: "make_valid_utf8", params: [{ name: "strExpr" }] }, // functions/make_valid_utf8/1.txt
	map_contains_key: { name: "map_contains_key", params: [{ name: "map" }, { name: "key" }] }, // functions/map_contains_key/1.txt
	map_entries: { name: "map_entries", params: [{ name: "map" }] }, // functions/map_entries/1.txt
	map_filter: { name: "map_filter", params: [{ name: "expr" }, { name: "func" }] }, // functions/map_filter/1.txt
	map_from_arrays: { name: "map_from_arrays", params: [{ name: "keys" }, { name: "values" }] }, // functions/map_from_arrays/1.txt
	map_from_entries: { name: "map_from_entries", params: [{ name: "expr" }] }, // functions/map_from_entries/1.txt
	map_keys: { name: "map_keys", params: [{ name: "map" }] }, // functions/map_keys/1.txt
	map_values: { name: "map_values", params: [{ name: "map" }] }, // functions/map_values/1.txt
	map_zip_with: { name: "map_zip_with", params: [{ name: "map1" }, { name: "map2" }, { name: "func" }] }, // functions/map_zip_with/1.txt
	mask: {
		name: "mask",
		params: [
			{ name: "str" },
			{ name: "upperChar", optional: true },
			{ name: "lowerChar", optional: true },
			{ name: "digitChar", optional: true },
			{ name: "otherChar", optional: true },
		],
	}, // functions/mask/1.txt
	match_number: { name: "match_number", params: [] }, // functions/match_number/1.txt
	max: { name: "max", params: [{ name: "expr" }] }, // functions/max/1.txt
	max_by: { name: "max_by", params: [{ name: "expr" }, { name: "ordExpr" }, { name: "limit", optional: true }] }, // functions/max_by/2.txt
	md5: { name: "md5", params: [{ name: "expr" }] }, // functions/md5/1.txt
	mean: { name: "mean", params: [{ name: "expr" }] }, // functions/mean/1.txt
	measure: { name: "measure", params: [{ name: "measure_column" }] }, // functions/measure/1.txt
	median: { name: "median", params: [{ name: "expr" }] }, // functions/median/1.txt
	min: { name: "min", params: [{ name: "expr" }] }, // functions/min/1.txt
	min_by: { name: "min_by", params: [{ name: "expr" }, { name: "ordExpr" }, { name: "limit", optional: true }] }, // functions/min_by/2.txt
	minute: { name: "minute", params: [{ name: "expr" }] }, // functions/minute/1.txt
	mod: { name: "mod", params: [{ name: "dividend" }, { name: "divisor" }] }, // functions/mod/1.txt
	mode: { name: "mode", params: [{ name: "expr" }, { name: "deterministic", optional: true }] }, // functions/mode/1.txt
	monotonically_increasing_id: { name: "monotonically_increasing_id", params: [] }, // functions/monotonically_increasing_id/1.txt
	month: { name: "month", params: [{ name: "expr" }] }, // functions/month/1.txt
	months_between: {
		name: "months_between",
		params: [{ name: "expr1" }, { name: "expr2" }, { name: "roundOff", optional: true }],
	}, // functions/months_between/1.txt
	nanvl: { name: "nanvl", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/nanvl/1.txt
	negative: { name: "negative", params: [{ name: "expr" }] }, // functions/negative/1.txt
	next_day: { name: "next_day", params: [{ name: "expr" }, { name: "dayOfWeek" }] }, // functions/next_day/1.txt
	now: { name: "now", params: [] }, // functions/now/1.txt
	ntile: { name: "ntile", params: [{ name: "n", optional: true }] }, // functions/ntile/1.txt
	nullif: { name: "nullif", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/nullif/1.txt
	nullifzero: { name: "nullifzero", params: [{ name: "expr" }] }, // functions/nullifzero/1.txt
	nvl: { name: "nvl", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/nvl/1.txt
	nvl2: { name: "nvl2", params: [{ name: "expr1" }, { name: "expr2" }, { name: "expr3" }] }, // functions/nvl2/1.txt
	octet_length: { name: "octet_length", params: [{ name: "expr" }] }, // functions/octet_length/1.txt
	overlay: {
		name: "overlay",
		params: [{ name: "input" }, { name: "replace" }, { name: "pos" }, { name: "len", optional: true }],
	}, // functions/overlay/1.txt
	parse_json: { name: "parse_json", params: [{ name: "jsonStr" }] }, // functions/parse_json/1.txt
	parse_url: {
		name: "parse_url",
		params: [{ name: "url" }, { name: "partToExtract" }, { name: "key", optional: true }],
	}, // functions/parse_url/1.txt
	percent_rank: { name: "percent_rank", params: [] }, // functions/percent_rank/1.txt
	percentile: {
		name: "percentile",
		params: [{ name: "expr" }, { name: "percentage" }, { name: "frequency", optional: true }],
	}, // functions/percentile/1.txt
	percentile_approx: {
		name: "percentile_approx",
		params: [{ name: "expr" }, { name: "percentile" }, { name: "accuracy", optional: true }],
	}, // functions/percentile_approx/1.txt
	pi: { name: "pi", params: [] }, // functions/pi/1.txt
	pmod: { name: "pmod", params: [{ name: "dividend" }, { name: "divisor" }] }, // functions/pmod/1.txt
	posexplode: { name: "posexplode", params: [{ name: "collection" }] }, // functions/posexplode/1.txt
	posexplode_outer: { name: "posexplode_outer", params: [{ name: "collection" }] }, // functions/posexplode_outer/1.txt
	position: { name: "position", params: [{ name: "substr" }, { name: "str" }, { name: "pos", optional: true }] }, // functions/position/1.txt
	positive: { name: "positive", params: [{ name: "expr" }] }, // functions/positive/1.txt
	pow: { name: "pow", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/pow/1.txt
	power: { name: "power", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/power/1.txt
	quarter: { name: "quarter", params: [{ name: "expr" }] }, // functions/quarter/1.txt
	radians: { name: "radians", params: [{ name: "expr" }] }, // functions/radians/1.txt
	raise_error: { name: "raise_error", params: [{ name: "expr" }] }, // functions/raise_error/1.txt
	rand: { name: "rand", params: [{ name: "seed", optional: true }] }, // functions/rand/1.txt
	randn: { name: "randn", params: [{ name: "seed", optional: true }] }, // functions/randn/1.txt
	random: { name: "random", params: [{ name: "seed", optional: true }] }, // functions/random/1.txt
	randstr: { name: "randstr", params: [{ name: "length" }, { name: "seed", optional: true }] }, // functions/randstr/1.txt
	rank: { name: "rank", params: [] }, // functions/rank/1.txt
	read_state_metadata: { name: "read_state_metadata", params: [{ name: "path" }] }, // functions/read_state_metadata/1.txt
	reduce: {
		name: "reduce",
		params: [{ name: "expr" }, { name: "start" }, { name: "merge" }, { name: "finish", optional: true }],
	}, // functions/reduce/1.txt
	regexp_count: { name: "regexp_count", params: [{ name: "str" }, { name: "regexp" }] }, // functions/regexp_count/1.txt
	regexp_extract: {
		name: "regexp_extract",
		params: [{ name: "str" }, { name: "regexp" }, { name: "idx", optional: true }],
	}, // functions/regexp_extract/1.txt
	regexp_extract_all: {
		name: "regexp_extract_all",
		params: [{ name: "str" }, { name: "regexp" }, { name: "idx", optional: true }],
	}, // functions/regexp_extract_all/1.txt
	regexp_instr: { name: "regexp_instr", params: [{ name: "str" }, { name: "regexp" }] }, // functions/regexp_instr/1.txt
	regexp_replace: {
		name: "regexp_replace",
		params: [{ name: "str" }, { name: "regexp" }, { name: "rep" }, { name: "position", optional: true }],
	}, // functions/regexp_replace/1.txt
	regexp_substr: { name: "regexp_substr", params: [{ name: "str" }, { name: "regexp" }] }, // functions/regexp_substr/1.txt
	regr_avgx: { name: "regr_avgx", params: [{ name: "yExpr" }, { name: "xExpr" }] }, // functions/regr_avgx/1.txt
	regr_avgy: { name: "regr_avgy", params: [{ name: "yExpr" }, { name: "xExpr" }] }, // functions/regr_avgy/1.txt
	regr_count: { name: "regr_count", params: [{ name: "yExpr" }, { name: "xExpr" }] }, // functions/regr_count/1.txt
	regr_intercept: { name: "regr_intercept", params: [{ name: "yExpr" }, { name: "xExpr" }] }, // functions/regr_intercept/1.txt
	regr_r2: { name: "regr_r2", params: [{ name: "yExpr" }, { name: "xExpr" }] }, // functions/regr_r2/1.txt
	regr_slope: { name: "regr_slope", params: [{ name: "yExpr" }, { name: "xExpr" }] }, // functions/regr_slope/1.txt
	regr_sxx: { name: "regr_sxx", params: [{ name: "yExpr" }, { name: "xExpr" }] }, // functions/regr_sxx/1.txt
	regr_sxy: { name: "regr_sxy", params: [{ name: "yExpr" }, { name: "xExpr" }] }, // functions/regr_sxy/1.txt
	regr_syy: { name: "regr_syy", params: [{ name: "yExpr" }, { name: "xExpr" }] }, // functions/regr_syy/1.txt
	repeat: { name: "repeat", params: [{ name: "expr" }, { name: "n" }] }, // functions/repeat/1.txt
	replace: { name: "replace", params: [{ name: "str" }, { name: "search" }, { name: "replace", optional: true }] }, // functions/replace/1.txt
	reverse: { name: "reverse", params: [{ name: "expr" }] }, // functions/reverse/1.txt
	right: { name: "right", params: [{ name: "str" }, { name: "len" }] }, // functions/right/1.txt
	rint: { name: "rint", params: [{ name: "expr" }] }, // functions/rint/1.txt
	round: { name: "round", params: [{ name: "expr" }, { name: "targetScale", optional: true }] }, // functions/round/1.txt
	row_number: { name: "row_number", params: [] }, // functions/row_number/1.txt
	rpad: { name: "rpad", params: [{ name: "expr" }, { name: "len" }, { name: "pad", optional: true }] }, // functions/rpad/1.txt
	schema_of_csv: { name: "schema_of_csv", params: [{ name: "csv" }, { name: "options", optional: true }] }, // functions/schema_of_csv/1.txt
	schema_of_json: { name: "schema_of_json", params: [{ name: "jsonStr" }, { name: "options", optional: true }] }, // functions/schema_of_json/1.txt
	schema_of_json_agg: {
		name: "schema_of_json_agg",
		params: [{ name: "jsonStr" }, { name: "options", optional: true }],
	}, // functions/schema_of_json_agg/1.txt
	schema_of_variant: { name: "schema_of_variant", params: [{ name: "variantExpr" }] }, // functions/schema_of_variant/1.txt
	schema_of_variant_agg: { name: "schema_of_variant_agg", params: [{ name: "variantExpr" }] }, // functions/schema_of_variant_agg/1.txt
	schema_of_xml: { name: "schema_of_xml", params: [{ name: "xmlStr" }, { name: "options", optional: true }] }, // functions/schema_of_xml/1.txt
	sec: { name: "sec", params: [{ name: "expr" }] }, // functions/sec/1.txt
	second: { name: "second", params: [{ name: "expr" }] }, // functions/second/1.txt
	secret: { name: "secret", params: [{ name: "scope" }, { name: "key" }] }, // functions/secret/1.txt
	sequence: { name: "sequence", params: [{ name: "start" }, { name: "stop" }, { name: "step", optional: true }] }, // functions/sequence/1.txt
	session_user: { name: "session_user", params: [] }, // functions/session_user/1.txt
	session_window: { name: "session_window", params: [{ name: "expr" }, { name: "gapDuration" }] }, // functions/session_window/1.txt
	sha: { name: "sha", params: [{ name: "expr" }] }, // functions/sha/1.txt
	sha1: { name: "sha1", params: [{ name: "expr" }] }, // functions/sha1/1.txt
	sha2: { name: "sha2", params: [{ name: "expr" }, { name: "bitLength" }] }, // functions/sha2/1.txt
	shiftleft: { name: "shiftleft", params: [{ name: "expr" }, { name: "n" }] }, // functions/shiftleft/1.txt
	shiftright: { name: "shiftright", params: [{ name: "expr" }, { name: "n" }] }, // functions/shiftright/1.txt
	shiftrightunsigned: { name: "shiftrightunsigned", params: [{ name: "expr" }, { name: "n" }] }, // functions/shiftrightunsigned/1.txt
	shuffle: { name: "shuffle", params: [{ name: "expr" }] }, // functions/shuffle/1.txt
	sign: { name: "sign", params: [{ name: "expr" }] }, // functions/sign/1.txt
	signum: { name: "signum", params: [{ name: "expr" }] }, // functions/signum/1.txt
	sin: { name: "sin", params: [{ name: "expr" }] }, // functions/sin/1.txt
	sinh: { name: "sinh", params: [{ name: "expr" }] }, // functions/sinh/1.txt
	size: { name: "size", params: [{ name: "expr" }] }, // functions/size/1.txt
	skewness: { name: "skewness", params: [{ name: "expr" }] }, // functions/skewness/1.txt
	slice: { name: "slice", params: [{ name: "expr" }, { name: "start" }, { name: "length" }] }, // functions/slice/1.txt
	smallint: { name: "smallint", params: [{ name: "expr" }] }, // functions/smallint/1.txt
	sort_array: { name: "sort_array", params: [{ name: "expr" }, { name: "ascendingOrder", optional: true }] }, // functions/sort_array/1.txt
	soundex: { name: "soundex", params: [{ name: "expr" }] }, // functions/soundex/1.txt
	space: { name: "space", params: [{ name: "n" }] }, // functions/space/1.txt
	spark_partition_id: { name: "spark_partition_id", params: [] }, // functions/spark_partition/1.txt
	split: { name: "split", params: [{ name: "str" }, { name: "regex" }, { name: "limit", optional: true }] }, // functions/split/1.txt
	split_part: { name: "split_part", params: [{ name: "str" }, { name: "delim" }, { name: "partNum" }] }, // functions/split_part/1.txt
	sql_keywords: { name: "sql_keywords", params: [] }, // functions/sql_keywords/1.txt
	sqrt: { name: "sqrt", params: [{ name: "expr" }] }, // functions/sqrt/1.txt
	st_addpoint: {
		name: "st_addpoint",
		params: [{ name: "geo1Expr" }, { name: "geo2Expr" }, { name: "indexExpr", optional: true }],
	}, // functions/st_addpoint/1.txt
	st_area: { name: "st_area", params: [{ name: "geoExpr" }] }, // functions/st_area/1.txt
	st_asbinary: { name: "st_asbinary", params: [{ name: "geoExpr" }, { name: "endiannessExpr", optional: true }] }, // functions/st_asbinary/1.txt
	st_asewkb: { name: "st_asewkb", params: [{ name: "geoExpr" }, { name: "endiannessExpr", optional: true }] }, // functions/st_asewkb/1.txt
	st_asgeojson: { name: "st_asgeojson", params: [{ name: "geoExpr" }] }, // functions/st_asgeojson/1.txt
	st_astext: { name: "st_astext", params: [{ name: "geoExpr" }] }, // functions/st_astext/1.txt
	st_aswkb: { name: "st_aswkb", params: [{ name: "geoExpr" }, { name: "endiannessExpr", optional: true }] }, // functions/st_aswkb/1.txt
	st_aswkt: { name: "st_aswkt", params: [{ name: "geoExpr" }] }, // functions/st_aswkt/1.txt
	st_azimuth: { name: "st_azimuth", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }] }, // functions/st_azimuth/1.txt
	st_boundary: { name: "st_boundary", params: [{ name: "geoExpr" }] }, // functions/st_boundary/1.txt
	st_buffer: { name: "st_buffer", params: [{ name: "geoExpr" }, { name: "radiusExpr" }] }, // functions/st_buffer/1.txt
	st_centroid: { name: "st_centroid", params: [{ name: "geoExpr" }] }, // functions/st_centroid/1.txt
	st_closestpoint: { name: "st_closestpoint", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }] }, // functions/st_closestpoint/1.txt
	st_collect: { name: "st_collect", params: [{ name: "geoArray" }] }, // functions/st_collect/1.txt
	st_concavehull: {
		name: "st_concavehull",
		params: [{ name: "geoExpr" }, { name: "lengthRatioExpr" }, { name: "allowHolesExpr", optional: true }],
	}, // functions/st_concavehull/1.txt
	st_contains: { name: "st_contains", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }] }, // functions/st_contains/1.txt
	st_convexhull: { name: "st_convexhull", params: [{ name: "geoExpr" }] }, // functions/st_convexhull/1.txt
	st_covers: { name: "st_covers", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }] }, // functions/st_covers/1.txt
	st_difference: { name: "st_difference", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }] }, // functions/st_difference/1.txt
	st_dimension: { name: "st_dimension", params: [{ name: "geoExpr" }] }, // functions/st_dimension/1.txt
	st_disjoint: { name: "st_disjoint", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }] }, // functions/st_disjoint/1.txt
	st_distance: { name: "st_distance", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }] }, // functions/st_distance/1.txt
	st_distancesphere: { name: "st_distancesphere", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }] }, // functions/st_distancesphere/1.txt
	st_distancespheroid: { name: "st_distancespheroid", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }] }, // functions/st_distancespheroid/1.txt
	st_dump: { name: "st_dump", params: [{ name: "geoExpr" }] }, // functions/st_dump/1.txt
	st_dwithin: { name: "st_dwithin", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }, { name: "distanceExpr" }] }, // functions/st_dwithin/1.txt
	st_endpoint: { name: "st_endpoint", params: [{ name: "geoExpr" }] }, // functions/st_endpoint/1.txt
	st_envelope: { name: "st_envelope", params: [{ name: "geoExpr" }] }, // functions/st_envelope/1.txt
	st_envelope_agg: { name: "st_envelope_agg", params: [{ name: "geoCol" }] }, // functions/st_envelope_agg/1.txt
	st_equals: { name: "st_equals", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }] }, // functions/st_equals/1.txt
	st_estimatesrid: { name: "st_estimatesrid", params: [{ name: "geoExpr" }] }, // functions/st_estimatesrid/1.txt
	st_exteriorring: { name: "st_exteriorring", params: [{ name: "geoExpr" }] }, // functions/st_exteriorring/1.txt
	st_flipcoordinates: { name: "st_flipcoordinates", params: [{ name: "geoExpr" }] }, // functions/st_flipcoordinates/1.txt
	st_force2d: { name: "st_force2d", params: [{ name: "geoExpr" }] }, // functions/st_force2d/1.txt
	st_geogfromewkt: { name: "st_geogfromewkt", params: [{ name: "ewktExpr" }] }, // functions/st_geogfromewkt/1.txt
	st_geogfromgeojson: { name: "st_geogfromgeojson", params: [{ name: "geojsonExpr" }] }, // functions/st_geogfromgeojson/1.txt
	st_geogfromtext: { name: "st_geogfromtext", params: [{ name: "wktExpr" }] }, // functions/st_geogfromtext/1.txt
	st_geogfromwkb: { name: "st_geogfromwkb", params: [{ name: "wkbExpr" }] }, // functions/st_geogfromwkb/1.txt
	st_geogfromwkt: { name: "st_geogfromwkt", params: [{ name: "wktExpr" }] }, // functions/st_geogfromwkt/1.txt
	st_geohash: { name: "st_geohash", params: [{ name: "geoExpr" }, { name: "precisionExpr", optional: true }] }, // functions/st_geohash/1.txt
	st_geometryn: { name: "st_geometryn", params: [{ name: "geoExpr" }, { name: "nExpr" }] }, // functions/st_geometryn/1.txt
	st_geometrytype: { name: "st_geometrytype", params: [{ name: "geoExpr" }] }, // functions/st_geometrytype/1.txt
	st_geomfromewkb: { name: "st_geomfromewkb", params: [{ name: "ewkbExpr" }] }, // functions/st_geomfromewkb/1.txt
	st_geomfromewkt: { name: "st_geomfromewkt", params: [{ name: "ewktExpr" }] }, // functions/st_geomfromewkt/1.txt
	st_geomfromgeohash: { name: "st_geomfromgeohash", params: [{ name: "geohashExpr" }] }, // functions/st_geomfromgeohash/1.txt
	st_geomfromgeojson: { name: "st_geomfromgeojson", params: [{ name: "geojsonExpr" }] }, // functions/st_geomfromgeojson/1.txt
	st_geomfromtext: { name: "st_geomfromtext", params: [{ name: "wktExpr" }, { name: "sridExpr", optional: true }] }, // functions/st_geomfromtext/1.txt
	st_geomfromwkb: { name: "st_geomfromwkb", params: [{ name: "wkbExpr" }, { name: "sridExpr", optional: true }] }, // functions/st_geomfromwkb/1.txt
	st_geomfromwkt: { name: "st_geomfromwkt", params: [{ name: "wktExpr" }, { name: "sridExpr", optional: true }] }, // functions/st_geomfromwkt/1.txt
	st_interiorringn: { name: "st_interiorringn", params: [{ name: "geoExpr" }, { name: "indexExpr" }] }, // functions/st_interiorringn/1.txt
	st_intersection: { name: "st_intersection", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }] }, // functions/st_intersection/1.txt
	st_intersects: { name: "st_intersects", params: [{ name: "geoExpr1" }, { name: "geoExpr2" }] }, // functions/st_intersects/1.txt
	st_isempty: { name: "st_isempty", params: [{ name: "geoExpr" }] }, // functions/st_isempty/1.txt
	st_isvalid: { name: "st_isvalid", params: [{ name: "geoExpr" }] }, // functions/st_isvalid/1.txt
	st_length: { name: "st_length", params: [{ name: "geoExpr" }] }, // functions/st_length/1.txt
	st_m: { name: "st_m", params: [{ name: "geoExpr" }] }, // functions/st_m/1.txt
	st_makeenvelope: {
		name: "st_makeenvelope",
		params: [{ name: "x1" }, { name: "y1" }, { name: "x2" }, { name: "y2" }],
	}, // functions/st_makeenvelope/1.txt
	st_makeline: { name: "st_makeline", params: [{ name: "geoArray" }] }, // functions/st_makeline/1.txt
	st_makepoint: {
		name: "st_makepoint",
		params: [{ name: "x" }, { name: "y" }, { name: "z", optional: true }, { name: "m", optional: true }],
	}, // functions/st_makepoint/1.txt
	st_makepolygon: { name: "st_makepolygon", params: [{ name: "outer" }, { name: "innerArray", optional: true }] }, // functions/st_makepolygon/1.txt
	st_multi: { name: "st_multi", params: [{ name: "geoExpr" }] }, // functions/st_multi/1.txt
	st_ndims: { name: "st_ndims", params: [{ name: "geoExpr" }] }, // functions/st_ndims/1.txt
	st_npoints: { name: "st_npoints", params: [{ name: "geoExpr" }] }, // functions/st_npoints/1.txt
	st_nrings: { name: "st_nrings", params: [{ name: "geoExpr" }] }, // functions/st_nrings/1.txt
	st_numgeometries: { name: "st_numgeometries", params: [{ name: "geoExpr" }] }, // functions/st_numgeometries/1.txt
	st_numinteriorrings: { name: "st_numinteriorrings", params: [{ name: "geoExpr" }] }, // functions/st_numinteriorrings/1.txt
	st_numpoints: { name: "st_numpoints", params: [{ name: "geoExpr" }] }, // functions/st_numpoints/1.txt
	st_perimeter: { name: "st_perimeter", params: [{ name: "geoExpr" }] }, // functions/st_perimeter/1.txt
	st_point: { name: "st_point", params: [{ name: "x" }, { name: "y" }, { name: "srid", optional: true }] }, // functions/st_point/1.txt
	st_pointfromgeohash: { name: "st_pointfromgeohash", params: [{ name: "geohash" }] }, // functions/st_pointfromgeohash/1.txt
	st_pointn: { name: "st_pointn", params: [{ name: "geoExpr" }, { name: "indexExpr" }] }, // functions/st_pointn/1.txt
	st_pointonsurface: { name: "st_pointonsurface", params: [{ name: "geoExpr" }] }, // functions/st_pointonsurface/1.txt
	st_removepoint: { name: "st_removepoint", params: [{ name: "geoExpr" }, { name: "indexExpr" }] }, // functions/st_removepoint/1.txt
	st_reverse: { name: "st_reverse", params: [{ name: "geoExpr" }] }, // functions/st_reverse/1.txt
	st_rotate: { name: "st_rotate", params: [{ name: "geoExpr" }, { name: "rotationAngle" }] }, // functions/st_rotate/1.txt
	st_scale: {
		name: "st_scale",
		params: [{ name: "geoExpr" }, { name: "xfactor" }, { name: "yfactor" }, { name: "zfactor", optional: true }],
	}, // functions/st_scale/1.txt
	st_setpoint: { name: "st_setpoint", params: [{ name: "geo1Expr" }, { name: "indexExpr" }, { name: "geo2Expr" }] }, // functions/st_setpoint/1.txt
	st_setsrid: { name: "st_setsrid", params: [{ name: "geo" }, { name: "srid" }] }, // functions/st_setsrid/1.txt
	st_simplify: { name: "st_simplify", params: [{ name: "geo" }, { name: "tolerance" }] }, // functions/st_simplify/1.txt
	st_srid: { name: "st_srid", params: [{ name: "geoExpr" }] }, // functions/st_srid/1.txt
	st_startpoint: { name: "st_startpoint", params: [{ name: "geoExpr" }] }, // functions/st_startpoint/1.txt
	st_touches: { name: "st_touches", params: [{ name: "geo1" }, { name: "geo2" }] }, // functions/st_touches/1.txt
	st_transform: { name: "st_transform", params: [{ name: "geo" }, { name: "srid" }] }, // functions/st_transform/1.txt
	st_translate: {
		name: "st_translate",
		params: [{ name: "geoExpr" }, { name: "xfactor" }, { name: "yfactor" }, { name: "zfactor", optional: true }],
	}, // functions/st_translate/1.txt
	st_union: { name: "st_union", params: [{ name: "geo1" }, { name: "geo2" }] }, // functions/st_union/1.txt
	st_union_agg: { name: "st_union_agg", params: [{ name: "geoCol" }] }, // functions/st_union_agg/1.txt
	st_within: { name: "st_within", params: [{ name: "geo1" }, { name: "geo2" }] }, // functions/st_within/1.txt
	st_x: { name: "st_x", params: [{ name: "geoExpr" }] }, // functions/st_x/1.txt
	st_xmax: { name: "st_xmax", params: [{ name: "geoExpr" }] }, // functions/st_xmax/1.txt
	st_xmin: { name: "st_xmin", params: [{ name: "geoExpr" }] }, // functions/st_xmin/1.txt
	st_y: { name: "st_y", params: [{ name: "geoExpr" }] }, // functions/st_y/1.txt
	st_ymax: { name: "st_ymax", params: [{ name: "geoExpr" }] }, // functions/st_ymax/1.txt
	st_ymin: { name: "st_ymin", params: [{ name: "geoExpr" }] }, // functions/st_ymin/1.txt
	st_z: { name: "st_z", params: [{ name: "geoExpr" }] }, // functions/st_z/1.txt
	st_zmax: { name: "st_zmax", params: [{ name: "geoExpr" }] }, // functions/st_zmax/1.txt
	st_zmin: { name: "st_zmin", params: [{ name: "geoExpr" }] }, // functions/st_zmin/1.txt
	stack: { name: "stack", params: [{ name: "numRows" }, { name: "expr1" }], variadic: true }, // functions/stack/1.txt
	startswith: { name: "startswith", params: [{ name: "expr" }, { name: "startExpr" }] }, // functions/startswith/1.txt
	std: { name: "std", params: [{ name: "expr" }] }, // functions/std/1.txt
	stddev: { name: "stddev", params: [{ name: "expr" }] }, // functions/stddev/1.txt
	stddev_pop: { name: "stddev_pop", params: [{ name: "expr" }] }, // functions/stddev_pop/1.txt
	stddev_samp: { name: "stddev_samp", params: [{ name: "expr" }] }, // functions/stddev_samp/1.txt
	str_to_map: {
		name: "str_to_map",
		params: [{ name: "expr" }, { name: "pairDelim", optional: true }, { name: "keyValueDelim", optional: true }],
	}, // functions/str_to_map/1.txt
	string: { name: "string", params: [{ name: "expr" }] }, // functions/string/1.txt
	substr: { name: "substr", params: [{ name: "expr" }, { name: "pos" }, { name: "len", optional: true }] }, // functions/substr/1.txt
	substring: { name: "substring", params: [{ name: "expr" }, { name: "pos" }, { name: "len", optional: true }] }, // functions/substring/1.txt
	substring_index: { name: "substring_index", params: [{ name: "expr" }, { name: "delim" }, { name: "count" }] }, // functions/substring_index/1.txt
	sum: { name: "sum", params: [{ name: "expr" }] }, // functions/sum/1.txt
	table_changes: {
		name: "table_changes",
		params: [{ name: "table_str" }, { name: "start" }, { name: "end", optional: true }],
	}, // functions/table_changes/1.txt
	tan: { name: "tan", params: [{ name: "expr" }] }, // functions/tan/1.txt
	tanh: { name: "tanh", params: [{ name: "expr" }] }, // functions/tanh/1.txt
	theta_difference: { name: "theta_difference", params: [{ name: "first" }, { name: "second" }] }, // functions/theta_difference/1.txt
	theta_intersection: { name: "theta_intersection", params: [{ name: "first" }, { name: "second" }] }, // functions/theta_intersection/1.txt
	theta_intersection_agg: { name: "theta_intersection_agg", params: [{ name: "sketch" }] }, // functions/theta_intersection_agg/1.txt
	theta_sketch_agg: {
		name: "theta_sketch_agg",
		params: [{ name: "expr" }, { name: "lgNomEntries", optional: true }],
	}, // functions/theta_sketch_agg/1.txt
	theta_sketch_estimate: { name: "theta_sketch_estimate", params: [{ name: "sketch" }] }, // functions/theta_sketch_estimate/1.txt
	theta_union: {
		name: "theta_union",
		params: [{ name: "first" }, { name: "second" }, { name: "lgNomEntries", optional: true }],
	}, // functions/theta_union/1.txt
	theta_union_agg: {
		name: "theta_union_agg",
		params: [{ name: "sketch" }, { name: "lgNomEntries", optional: true }],
	}, // functions/theta_union_agg/1.txt
	time_from_micros: { name: "time_from_micros", params: [{ name: "expr" }] }, // functions/time_from_micros/1.txt
	time_from_millis: { name: "time_from_millis", params: [{ name: "expr" }] }, // functions/time_from_millis/1.txt
	time_from_seconds: { name: "time_from_seconds", params: [{ name: "expr" }] }, // functions/time_from_seconds/1.txt
	time_to_micros: { name: "time_to_micros", params: [{ name: "expr" }] }, // functions/time_to_micros/1.txt
	time_to_millis: { name: "time_to_millis", params: [{ name: "expr" }] }, // functions/time_to_millis/1.txt
	time_to_seconds: { name: "time_to_seconds", params: [{ name: "expr" }] }, // functions/time_to_seconds/1.txt
	time_trunc: { name: "time_trunc", params: [{ name: "unit" }, { name: "expr" }] }, // functions/time_trunc/1.txt
	timestamp: { name: "timestamp", params: [{ name: "expr" }] }, // functions/timestamp/1.txt
	timestamp_micros: { name: "timestamp_micros", params: [{ name: "expr" }] }, // functions/timestamp_micros/1.txt
	timestamp_millis: { name: "timestamp_millis", params: [{ name: "expr" }] }, // functions/timestamp_millis/1.txt
	timestamp_seconds: { name: "timestamp_seconds", params: [{ name: "expr" }] }, // functions/timestamp_seconds/1.txt
	tinyint: { name: "tinyint", params: [{ name: "expr" }] }, // functions/tinyint/1.txt
	to_avro: { name: "to_avro", params: [{ name: "expr" }, { name: "avroSchemaSpec", optional: true }] }, // functions/to_avro/1.txt
	to_binary: { name: "to_binary", params: [{ name: "expr" }, { name: "fmt", optional: true }] }, // functions/to_binary/1.txt
	to_csv: { name: "to_csv", params: [{ name: "expr" }, { name: "options", optional: true }] }, // functions/to_csv/1.txt
	to_date: { name: "to_date", params: [{ name: "expr" }, { name: "fmt", optional: true }] }, // functions/to_date/1.txt
	to_geography: { name: "to_geography", params: [{ name: "geoRepExpr" }] }, // functions/to_geography/1.txt
	to_geometry: { name: "to_geometry", params: [{ name: "geoRepExpr" }] }, // functions/to_geometry/1.txt
	to_json: { name: "to_json", params: [{ name: "expr" }, { name: "options", optional: true }] }, // functions/to_json/1.txt
	to_time: { name: "to_time", params: [{ name: "expr" }, { name: "fmt", optional: true }] }, // functions/to_time/1.txt
	to_timestamp: { name: "to_timestamp", params: [{ name: "expr" }, { name: "fmt", optional: true }] }, // functions/to_timestamp/1.txt
	to_unix_timestamp: { name: "to_unix_timestamp", params: [{ name: "expr" }, { name: "fmt", optional: true }] }, // functions/to_unix_timestamp/1.txt
	to_utc_timestamp: { name: "to_utc_timestamp", params: [{ name: "expr" }, { name: "timeZone" }] }, // functions/to_utc_timestamp/1.txt
	to_variant_object: { name: "to_variant_object", params: [{ name: "expr" }] }, // functions/to_variant_object/1.txt
	to_xml: { name: "to_xml", params: [{ name: "expr" }, { name: "options", optional: true }] }, // functions/to_xml/1.txt
	transform: { name: "transform", params: [{ name: "expr" }, { name: "func" }] }, // functions/transform/1.txt
	transform_keys: { name: "transform_keys", params: [{ name: "expr" }, { name: "func" }] }, // functions/transform_keys/1.txt
	transform_values: { name: "transform_values", params: [{ name: "expr" }, { name: "func" }] }, // functions/transform_values/1.txt
	trunc: { name: "trunc", params: [{ name: "expr" }, { name: "unit" }] }, // functions/trunc/1.txt
	try_add: { name: "try_add", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/try_add/1.txt
	try_aes_decrypt: {
		name: "try_aes_decrypt",
		params: [
			{ name: "expr" },
			{ name: "key" },
			{ name: "mode", optional: true },
			{ name: "padding", optional: true },
			{ name: "aad", optional: true },
		],
	}, // functions/try_aes_decrypt/1.txt
	try_avg: { name: "try_avg", params: [{ name: "expr" }] }, // functions/try_avg/1.txt
	try_divide: { name: "try_divide", params: [{ name: "dividend" }, { name: "divisor" }] }, // functions/try_divide/1.txt
	try_ip_as_binary: { name: "try_ip_as_binary", params: [{ name: "ip_or_cidr" }] }, // functions/try_ip_as_binary/1.txt
	try_ip_as_string: { name: "try_ip_as_string", params: [{ name: "ip_or_cidr" }] }, // functions/try_ip_as_string/1.txt
	try_ip_cidr: { name: "try_ip_cidr", params: [{ name: "cidr" }] }, // functions/try_ip_cidr/1.txt
	try_ip_host: { name: "try_ip_host", params: [{ name: "ip" }] }, // functions/try_ip_host/1.txt
	try_mod: { name: "try_mod", params: [{ name: "dividend" }, { name: "divisor" }] }, // functions/try_mod/1.txt
	try_multiply: { name: "try_multiply", params: [{ name: "multiplier" }, { name: "multiplicand" }] }, // functions/try_multiply/1.txt
	try_parse_json: { name: "try_parse_json", params: [{ name: "jsonStr" }] }, // functions/try_parse_json/1.txt
	try_secret: { name: "try_secret", params: [{ name: "scope" }, { name: "key" }] }, // functions/try_secret/1.txt
	try_subtract: { name: "try_subtract", params: [{ name: "expr1" }, { name: "expr2" }] }, // functions/try_subtract/1.txt
	try_sum: { name: "try_sum", params: [{ name: "expr" }] }, // functions/try_sum/1.txt
	try_to_binary: { name: "try_to_binary", params: [{ name: "expr" }, { name: "fmt", optional: true }] }, // functions/try_to_binary/1.txt
	try_to_geography: { name: "try_to_geography", params: [{ name: "geoRepExpr" }] }, // functions/try_to_geography/1.txt
	try_to_geometry: { name: "try_to_geometry", params: [{ name: "geoRepExpr" }] }, // functions/try_to_geometry/1.txt
	try_to_time: { name: "try_to_time", params: [{ name: "expr" }, { name: "fmt", optional: true }] }, // functions/try_to_time/1.txt
	try_to_timestamp: { name: "try_to_timestamp", params: [{ name: "expr" }, { name: "fmt", optional: true }] }, // functions/try_to_timestamp/1.txt
	try_url_decode: { name: "try_url_decode", params: [{ name: "str" }] }, // functions/try_url_decode/1.txt
	try_validate_utf8: { name: "try_validate_utf8", params: [{ name: "strExpr" }] }, // functions/try_validate_utf8/1.txt
	try_variant_get: { name: "try_variant_get", params: [{ name: "variantExpr" }, { name: "path" }, { name: "type" }] }, // functions/try_variant_get/1.txt
	try_zstd_decompress: { name: "try_zstd_decompress", params: [{ name: "value" }] }, // functions/try_zstd_decompress/1.txt
	tuple_difference_double: { name: "tuple_difference_double", params: [{ name: "first" }, { name: "second" }] }, // functions/tuple_difference_double/1.txt
	tuple_difference_integer: { name: "tuple_difference_integer", params: [{ name: "first" }, { name: "second" }] }, // functions/tuple_difference_integer/1.txt
	tuple_intersection_agg_double: {
		name: "tuple_intersection_agg_double",
		params: [{ name: "sketch" }, { name: "mode", optional: true }],
	}, // functions/tuple_intersection_agg_double/1.txt
	tuple_intersection_agg_integer: {
		name: "tuple_intersection_agg_integer",
		params: [{ name: "sketch" }, { name: "mode", optional: true }],
	}, // functions/tuple_intersection_agg_integer/1.txt
	tuple_intersection_double: {
		name: "tuple_intersection_double",
		params: [{ name: "first" }, { name: "second" }, { name: "mode", optional: true }],
	}, // functions/tuple_intersection_double/1.txt
	tuple_intersection_integer: {
		name: "tuple_intersection_integer",
		params: [{ name: "first" }, { name: "second" }, { name: "mode", optional: true }],
	}, // functions/tuple_intersection_integer/1.txt
	tuple_sketch_agg_double: {
		name: "tuple_sketch_agg_double",
		params: [
			{ name: "key" },
			{ name: "summary" },
			{ name: "lgNomEntries", optional: true },
			{ name: "mode", optional: true },
		],
	}, // functions/tuple_sketch_agg_double/1.txt
	tuple_sketch_agg_integer: {
		name: "tuple_sketch_agg_integer",
		params: [
			{ name: "key" },
			{ name: "summary" },
			{ name: "lgNomEntries", optional: true },
			{ name: "mode", optional: true },
		],
	}, // functions/tuple_sketch_agg_integer/1.txt
	tuple_sketch_estimate_double: { name: "tuple_sketch_estimate_double", params: [{ name: "sketch" }] }, // functions/tuple_sketch_estimate_double/1.txt
	tuple_sketch_estimate_integer: { name: "tuple_sketch_estimate_integer", params: [{ name: "sketch" }] }, // functions/tuple_sketch_estimate_integer/1.txt
	tuple_sketch_summary_double: {
		name: "tuple_sketch_summary_double",
		params: [{ name: "sketch" }, { name: "mode", optional: true }],
	}, // functions/tuple_sketch_summary_double/1.txt
	tuple_sketch_summary_integer: {
		name: "tuple_sketch_summary_integer",
		params: [{ name: "sketch" }, { name: "mode", optional: true }],
	}, // functions/tuple_sketch_summary_integer/1.txt
	tuple_sketch_theta_double: { name: "tuple_sketch_theta_double", params: [{ name: "sketch" }] }, // functions/tuple_sketch_theta_double/1.txt
	tuple_sketch_theta_integer: { name: "tuple_sketch_theta_integer", params: [{ name: "sketch" }] }, // functions/tuple_sketch_theta_integer/1.txt
	tuple_union_agg_double: {
		name: "tuple_union_agg_double",
		params: [{ name: "sketch" }, { name: "lgNomEntries", optional: true }, { name: "mode", optional: true }],
	}, // functions/tuple_union_agg_double/1.txt
	tuple_union_agg_integer: {
		name: "tuple_union_agg_integer",
		params: [{ name: "sketch" }, { name: "lgNomEntries", optional: true }, { name: "mode", optional: true }],
	}, // functions/tuple_union_agg_integer/1.txt
	tuple_union_double: {
		name: "tuple_union_double",
		params: [
			{ name: "first" },
			{ name: "second" },
			{ name: "lgNomEntries", optional: true },
			{ name: "mode", optional: true },
		],
	}, // functions/tuple_union_double/1.txt
	tuple_union_integer: {
		name: "tuple_union_integer",
		params: [
			{ name: "first" },
			{ name: "second" },
			{ name: "lgNomEntries", optional: true },
			{ name: "mode", optional: true },
		],
	}, // functions/tuple_union_integer/1.txt
	typeof: { name: "typeof", params: [{ name: "expr" }] }, // functions/typeof/1.txt
	ucase: { name: "ucase", params: [{ name: "expr" }] }, // functions/ucase/1.txt
	unbase64: { name: "unbase64", params: [{ name: "expr" }] }, // functions/unbase64/1.txt
	unhex: { name: "unhex", params: [{ name: "expr" }] }, // functions/unhex/1.txt
	uniform: {
		name: "uniform",
		params: [{ name: "boundaryExpr1" }, { name: "boundaryExpr2" }, { name: "seed", optional: true }],
	}, // functions/uniform/1.txt
	unix_date: { name: "unix_date", params: [{ name: "expr" }] }, // functions/unix_date/1.txt
	unix_micros: { name: "unix_micros", params: [{ name: "expr" }] }, // functions/unix_micros/1.txt
	unix_millis: { name: "unix_millis", params: [{ name: "expr" }] }, // functions/unix_millis/1.txt
	unix_seconds: { name: "unix_seconds", params: [{ name: "expr" }] }, // functions/unix_seconds/1.txt
	upper: { name: "upper", params: [{ name: "expr" }] }, // functions/upper/1.txt
	url_decode: { name: "url_decode", params: [{ name: "str" }] }, // functions/url_decode/1.txt
	url_encode: { name: "url_encode", params: [{ name: "str" }] }, // functions/url_encode/1.txt
	user: { name: "user", params: [] }, // functions/user/1.txt
	uuid: { name: "uuid", params: [] }, // functions/uuid/1.txt
	validate_utf8: { name: "validate_utf8", params: [{ name: "strExpr" }] }, // functions/validate_utf8/1.txt
	var_pop: { name: "var_pop", params: [{ name: "expr" }] }, // functions/var_pop/1.txt
	var_samp: { name: "var_samp", params: [{ name: "expr" }] }, // functions/var_samp/1.txt
	variance: { name: "variance", params: [{ name: "expr" }] }, // functions/variance/1.txt
	variant_explode: { name: "variant_explode", params: [{ name: "input" }] }, // functions/variant_explode/1.txt
	variant_explode_outer: { name: "variant_explode_outer", params: [{ name: "variantExpr" }] }, // functions/variant_explode_outer/1.txt
	variant_get: { name: "variant_get", params: [{ name: "variantExpr" }, { name: "path" }, { name: "type" }] }, // functions/variant_get/1.txt
	vector_avg: { name: "vector_avg", params: [{ name: "vectors" }] }, // functions/vector_avg/1.txt
	vector_cosine_similarity: { name: "vector_cosine_similarity", params: [{ name: "vector1" }, { name: "vector2" }] }, // functions/vector_cosine_similarity/1.txt
	vector_inner_product: { name: "vector_inner_product", params: [{ name: "vector1" }, { name: "vector2" }] }, // functions/vector_inner_product/1.txt
	vector_l2_distance: { name: "vector_l2_distance", params: [{ name: "vector1" }, { name: "vector2" }] }, // functions/vector_l2_distance/1.txt
	vector_norm: { name: "vector_norm", params: [{ name: "vector" }, { name: "degree", optional: true }] }, // functions/vector_norm/1.txt
	vector_normalize: { name: "vector_normalize", params: [{ name: "vector" }, { name: "degree", optional: true }] }, // functions/vector_normalize/1.txt
	vector_sum: { name: "vector_sum", params: [{ name: "vectors" }] }, // functions/vector_sum/1.txt
	version: { name: "version", params: [] }, // functions/version/1.txt
	weekday: { name: "weekday", params: [{ name: "expr" }] }, // functions/weekday/1.txt
	weekofyear: { name: "weekofyear", params: [{ name: "expr" }] }, // functions/weekofyear/1.txt
	width_bucket: {
		name: "width_bucket",
		params: [{ name: "expr" }, { name: "minExpr" }, { name: "maxExpr" }, { name: "numBuckets" }],
	}, // functions/width_bucket/1.txt
	window: {
		name: "window",
		params: [
			{ name: "expr" },
			{ name: "width" },
			{ name: "slide", optional: true },
			{ name: "start", optional: true },
		],
	}, // functions/window/1.txt
	window_time: { name: "window_time", params: [{ name: "window" }] }, // functions/window_time/1.txt
	xpath: { name: "xpath", params: [{ name: "xml" }, { name: "xpath" }] }, // functions/xpath/1.txt
	xpath_boolean: { name: "xpath_boolean", params: [{ name: "xml" }, { name: "xpath" }] }, // functions/xpath_boolean/1.txt
	xpath_double: { name: "xpath_double", params: [{ name: "xml" }, { name: "xpath" }] }, // functions/xpath_double/1.txt
	xpath_float: { name: "xpath_float", params: [{ name: "xml" }, { name: "xpath" }] }, // functions/xpath_float/1.txt
	xpath_int: { name: "xpath_int", params: [{ name: "xml" }, { name: "xpath" }] }, // functions/xpath_int/1.txt
	xpath_long: { name: "xpath_long", params: [{ name: "xml" }, { name: "xpath" }] }, // functions/xpath_long/1.txt
	xpath_number: { name: "xpath_number", params: [{ name: "xml" }, { name: "xpath" }] }, // functions/xpath_number/1.txt
	xpath_short: { name: "xpath_short", params: [{ name: "xml" }, { name: "xpath" }] }, // functions/xpath_short/1.txt
	xpath_string: { name: "xpath_string", params: [{ name: "xml" }, { name: "xpath" }] }, // functions/xpath_string/1.txt
	xxhash64: { name: "xxhash64", params: [{ name: "expr1" }], variadic: true }, // functions/xxhash64/1.txt
	year: { name: "year", params: [{ name: "expr" }] }, // functions/year/1.txt
	zeroifnull: { name: "zeroifnull", params: [{ name: "expr" }] }, // functions/zeroifnull/1.txt
	zip_with: { name: "zip_with", params: [{ name: "expr1" }, { name: "expr2" }, { name: "func" }] }, // functions/zip_with/1.txt
	zstd_compress: {
		name: "zstd_compress",
		params: [{ name: "value" }, { name: "level", optional: true }, { name: "streaming_mode", optional: true }],
	}, // functions/zstd_compress/1.txt
	zstd_decompress: { name: "zstd_decompress", params: [{ name: "value" }] }, // functions/zstd_decompress/1.txt
};
