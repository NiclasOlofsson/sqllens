// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// Harvested source: duckdb-web  docs/current/sql/functions/*.md ("#### `name(...)`" headings)
// Overrides source: tools/signature-overrides/duckdb.mjs
// Built 2026-07-14. 410 names (5 curated, 405 harvested), 41 with 2+ overloads.
import type { FnSignature } from "../signature/signatures.js";

/** The merged function-signature table for duckdb: curated overrides folded over the harvested
 *  doc-derived long tail (overrides win by key, replacing the whole overload set), keyed by
 *  lowercased name. Each name maps to an ORDERED overload set - a name with one documented shape
 *  is a one-element array. `origin` says which layer produced the set. */
export const DUCKDB_SIGNATURES: Record<string, FnSignature[]> = {
	abs: [{ name: "abs", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	acos: [{ name: "acos", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	acosh: [{ name: "acosh", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	add: [{ name: "add", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }], // sql/functions/numeric.md
	age: [
		{ name: "age", params: [{ name: "timestamp" }, { name: "timestamp", optional: true }], origin: "harvested" },
		{
			name: "age",
			params: [{ name: "timestamptz" }, { name: "timestamptz", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/timestamp.md, sql/functions/timestamptz.md
	ago: [{ name: "ago", params: [{ name: "interval" }], origin: "harvested" }], // sql/functions/timestamp.md
	alias: [{ name: "alias", params: [{ name: "column" }], origin: "harvested" }], // sql/functions/utility.md
	any_value: [{ name: "any_value", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	arg_max: [
		{
			name: "arg_max",
			params: [{ name: "arg" }, { name: "val" }, { name: "n", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/aggregates.md
	arg_max_null: [{ name: "arg_max_null", params: [{ name: "arg" }, { name: "val" }], origin: "harvested" }], // sql/functions/aggregates.md
	arg_min: [
		{
			name: "arg_min",
			params: [{ name: "arg" }, { name: "val" }, { name: "n", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/aggregates.md
	arg_min_null: [{ name: "arg_min_null", params: [{ name: "arg" }, { name: "val" }], origin: "harvested" }], // sql/functions/aggregates.md
	array_cosine_distance: [
		{ name: "array_cosine_distance", params: [{ name: "array1" }, { name: "array2" }], origin: "harvested" },
	], // sql/functions/array.md
	array_cosine_similarity: [
		{ name: "array_cosine_similarity", params: [{ name: "array1" }, { name: "array2" }], origin: "harvested" },
	], // sql/functions/array.md
	array_cross_product: [
		{ name: "array_cross_product", params: [{ name: "array" }, { name: "array" }], origin: "harvested" },
	], // sql/functions/array.md
	array_distance: [{ name: "array_distance", params: [{ name: "array1" }, { name: "array2" }], origin: "harvested" }], // sql/functions/array.md
	array_extract: [
		{ name: "array_extract", params: [{ name: "list" }, { name: "index" }], origin: "harvested" },
		{ name: "array_extract", params: [{ name: "string" }, { name: "index" }], origin: "harvested" },
	], // sql/functions/list.md, sql/functions/text.md
	array_inner_product: [
		{ name: "array_inner_product", params: [{ name: "array1" }, { name: "array2" }], origin: "harvested" },
	], // sql/functions/array.md
	array_negative_inner_product: [
		{ name: "array_negative_inner_product", params: [{ name: "array1" }, { name: "array2" }], origin: "harvested" },
	], // sql/functions/array.md
	array_pop_back: [{ name: "array_pop_back", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	array_pop_front: [{ name: "array_pop_front", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	array_push_front: [
		{ name: "array_push_front", params: [{ name: "list" }, { name: "element" }], origin: "harvested" },
	], // sql/functions/list.md
	array_slice: [
		{ name: "array_slice", params: [{ name: "list" }, { name: "begin" }, { name: "end" }], origin: "harvested" },
	], // sql/functions/text.md
	array_to_string: [
		{ name: "array_to_string", params: [{ name: "list" }, { name: "delimiter" }], origin: "harvested" },
	], // sql/functions/list.md
	array_to_string_comma_default: [
		{ name: "array_to_string_comma_default", params: [{ name: "array" }], origin: "harvested" },
	], // sql/functions/list.md
	array_value: [{ name: "array_value", params: [{ name: "arg" }], variadic: true, origin: "harvested" }], // sql/functions/array.md
	ascii: [{ name: "ascii", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	asin: [{ name: "asin", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	asinh: [{ name: "asinh", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	atan: [{ name: "atan", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	atan2: [{ name: "atan2", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	atanh: [{ name: "atanh", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	avg: [{ name: "avg", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	bar: [
		{
			name: "bar",
			params: [{ name: "x" }, { name: "min" }, { name: "max" }, { name: "width", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/text.md
	bin: [{ name: "bin", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	bit_and: [{ name: "bit_and", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	bit_count: [
		{ name: "bit_count", params: [{ name: "bitstring" }], origin: "harvested" },
		{ name: "bit_count", params: [{ name: "x" }], origin: "harvested" },
	], // sql/functions/bitstring.md, sql/functions/numeric.md
	bit_length: [
		{ name: "bit_length", params: [{ name: "bitstring" }], origin: "harvested" },
		{ name: "bit_length", params: [{ name: "string" }], origin: "harvested" },
	], // sql/functions/bitstring.md, sql/functions/text.md
	bit_or: [{ name: "bit_or", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	bit_position: [
		{ name: "bit_position", params: [{ name: "substring" }, { name: "bitstring" }], origin: "harvested" },
	], // sql/functions/bitstring.md
	bit_xor: [{ name: "bit_xor", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	bitstring: [{ name: "bitstring", params: [{ name: "bitstring" }, { name: "length" }], origin: "harvested" }], // sql/functions/bitstring.md
	bitstring_agg: [
		{
			name: "bitstring_agg",
			params: [{ name: "arg" }, { name: "min", optional: true }, { name: "max", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/bitstring.md
	bool_and: [{ name: "bool_and", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	bool_or: [{ name: "bool_or", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	can_cast_implicitly: [
		{
			name: "can_cast_implicitly",
			params: [{ name: "source_value" }, { name: "target_value" }],
			origin: "harvested",
		},
	], // sql/functions/utility.md
	cardinality: [{ name: "cardinality", params: [{ name: "map" }], origin: "harvested" }], // sql/functions/map.md
	cbrt: [{ name: "cbrt", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	ceil: [{ name: "ceil", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	ceiling: [{ name: "ceiling", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	century: [
		{ name: "century", params: [{ name: "date" }], origin: "harvested" },
		{ name: "century", params: [{ name: "timestamp" }], origin: "harvested" },
	], // sql/functions/datepart.md, sql/functions/timestamp.md
	checkpoint: [{ name: "checkpoint", params: [{ name: "database" }], origin: "harvested" }], // sql/functions/utility.md
	chr: [{ name: "chr", params: [{ name: "code_point" }], origin: "harvested" }], // sql/functions/text.md
	coalesce: [{ name: "coalesce", params: [{ name: "expr" }], variadic: true, origin: "harvested" }], // sql/functions/utility.md
	concat: [{ name: "concat", params: [{ name: "value" }], variadic: true, origin: "harvested" }], // sql/functions/list.md
	concat_ws: [
		{
			name: "concat_ws",
			params: [{ name: "separator", type: "text" }, { name: "value" }],
			variadic: true,
			origin: "curated",
		},
	], // curated: concat_ws(separator, value, ...)
	constant_or_null: [{ name: "constant_or_null", params: [{ name: "arg1" }, { name: "arg2" }], origin: "harvested" }], // sql/functions/utility.md
	contains: [
		{ name: "contains", params: [{ name: "list" }, { name: "element" }], origin: "harvested" },
		{ name: "contains", params: [{ name: "string" }, { name: "search_string" }], origin: "harvested" },
	], // sql/functions/list.md, sql/functions/text.md
	corr: [{ name: "corr", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	cos: [{ name: "cos", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	cot: [{ name: "cot", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	count: [{ name: "count", params: [{ name: "arg", optional: true }], origin: "harvested" }], // sql/functions/aggregates.md
	count_if: [{ name: "count_if", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/utility.md
	countif: [{ name: "countif", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	covar_pop: [{ name: "covar_pop", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	covar_samp: [{ name: "covar_samp", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	current_catalog: [{ name: "current_catalog", params: [], origin: "harvested" }], // sql/functions/utility.md
	current_database: [{ name: "current_database", params: [], origin: "harvested" }], // sql/functions/utility.md
	current_localtime: [{ name: "current_localtime", params: [], origin: "harvested" }], // sql/functions/timestamptz.md
	current_localtimestamp: [{ name: "current_localtimestamp", params: [], origin: "harvested" }], // sql/functions/timestamp.md
	current_query: [{ name: "current_query", params: [], origin: "harvested" }], // sql/functions/utility.md
	current_schema: [{ name: "current_schema", params: [], origin: "harvested" }], // sql/functions/utility.md
	current_schemas: [{ name: "current_schemas", params: [{ name: "boolean" }], origin: "harvested" }], // sql/functions/utility.md
	damerau_levenshtein: [
		{ name: "damerau_levenshtein", params: [{ name: "s1" }, { name: "s2" }], origin: "harvested" },
	], // sql/functions/text.md
	date_add: [{ name: "date_add", params: [{ name: "date" }, { name: "interval" }], origin: "harvested" }], // sql/functions/date.md
	date_diff: [
		{
			name: "date_diff",
			params: [{ name: "part" }, { name: "startdate" }, { name: "enddate" }],
			origin: "harvested",
		},
		{
			name: "date_diff",
			params: [{ name: "part" }, { name: "starttime" }, { name: "endtime" }],
			origin: "harvested",
		},
		{
			name: "date_diff",
			params: [{ name: "part" }, { name: "starttimestamp" }, { name: "endtimestamp" }],
			origin: "harvested",
		},
		{
			name: "date_diff",
			params: [{ name: "part" }, { name: "starttimestamptz" }, { name: "endtimestamptz" }],
			origin: "harvested",
		},
	], // sql/functions/date.md, sql/functions/time.md, sql/functions/timestamp.md, sql/functions/timestamptz.md
	date_part: [
		{ name: "date_part", params: [{ name: "part" }, { name: "date" }], origin: "harvested" },
		{ name: "date_part", params: [{ name: "part" }, { name: "interval" }], origin: "harvested" },
		{ name: "date_part", params: [{ name: "part" }, { name: "time" }], origin: "harvested" },
		{ name: "date_part", params: [{ name: "part" }, { name: "timestamp" }], origin: "harvested" },
		{ name: "date_part", params: [{ name: "part" }, { name: "timestamptz" }], origin: "harvested" },
	], // sql/functions/date.md, sql/functions/interval.md, sql/functions/time.md, sql/functions/timestamp.md, sql/functions/timestamptz.md
	date_sub: [
		{
			name: "date_sub",
			params: [{ name: "part" }, { name: "startdate" }, { name: "enddate" }],
			origin: "harvested",
		},
		{
			name: "date_sub",
			params: [{ name: "part" }, { name: "starttime" }, { name: "endtime" }],
			origin: "harvested",
		},
		{
			name: "date_sub",
			params: [{ name: "part" }, { name: "starttimestamp" }, { name: "endtimestamp" }],
			origin: "harvested",
		},
		{
			name: "date_sub",
			params: [{ name: "part" }, { name: "starttimestamptz" }, { name: "endtimestamptz" }],
			origin: "harvested",
		},
	], // sql/functions/date.md, sql/functions/time.md, sql/functions/timestamp.md, sql/functions/timestamptz.md
	date_trunc: [
		{ name: "date_trunc", params: [{ name: "part" }, { name: "date" }], origin: "harvested" },
		{ name: "date_trunc", params: [{ name: "part" }, { name: "timestamp" }], origin: "harvested" },
		{ name: "date_trunc", params: [{ name: "part" }, { name: "timestamptz" }], origin: "harvested" },
	], // sql/functions/date.md, sql/functions/timestamp.md, sql/functions/timestamptz.md
	datepart: [{ name: "datepart", params: [{ name: "part" }, { name: "interval" }], origin: "harvested" }], // sql/functions/interval.md
	day: [{ name: "day", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	dayname: [
		{ name: "dayname", params: [{ name: "date" }], origin: "harvested" },
		{ name: "dayname", params: [{ name: "timestamp" }], origin: "harvested" },
	], // sql/functions/date.md, sql/functions/timestamp.md
	dayofmonth: [{ name: "dayofmonth", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	dayofweek: [{ name: "dayofweek", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	dayofyear: [{ name: "dayofyear", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	days_in_month: [{ name: "days_in_month", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/date.md
	decade: [{ name: "decade", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	decode: [{ name: "decode", params: [{ name: "blob" }, { name: "on_error", optional: true }], origin: "harvested" }], // sql/functions/blob.md
	degrees: [{ name: "degrees", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	dense_rank: [{ name: "dense_rank", params: [], origin: "harvested" }], // sql/functions/window_functions.md
	divide: [{ name: "divide", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }], // sql/functions/numeric.md
	element_at: [{ name: "element_at", params: [{ name: "map" }, { name: "key" }], origin: "harvested" }], // sql/functions/map.md
	encode: [{ name: "encode", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/blob.md
	entropy: [{ name: "entropy", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	enum_code: [{ name: "enum_code", params: [{ name: "enum_value" }], origin: "harvested" }], // sql/functions/enum.md
	enum_first: [{ name: "enum_first", params: [{ name: "enum" }], origin: "harvested" }], // sql/functions/enum.md
	enum_last: [{ name: "enum_last", params: [{ name: "enum" }], origin: "harvested" }], // sql/functions/enum.md
	enum_range: [{ name: "enum_range", params: [{ name: "enum" }], origin: "harvested" }], // sql/functions/enum.md
	enum_range_boundary: [
		{ name: "enum_range_boundary", params: [{ name: "enum" }, { name: "enum" }], origin: "harvested" },
	], // sql/functions/enum.md
	epoch: [
		{ name: "epoch", params: [{ name: "date" }], origin: "harvested" },
		{ name: "epoch", params: [{ name: "interval" }], origin: "harvested" },
		{ name: "epoch", params: [{ name: "timestamp" }], origin: "harvested" },
	], // sql/functions/datepart.md, sql/functions/interval.md, sql/functions/timestamp.md
	epoch_ms: [{ name: "epoch_ms", params: [{ name: "timestamp" }], origin: "harvested" }], // sql/functions/timestamp.md
	epoch_ns: [
		{ name: "epoch_ns", params: [{ name: "timestamp" }], origin: "harvested" },
		{ name: "epoch_ns", params: [{ name: "timestamptz" }], origin: "harvested" },
	], // sql/functions/timestamp.md, sql/functions/timestamptz.md
	epoch_us: [
		{ name: "epoch_us", params: [{ name: "timestamp" }], origin: "harvested" },
		{ name: "epoch_us", params: [{ name: "timestamptz" }], origin: "harvested" },
	], // sql/functions/timestamp.md, sql/functions/timestamptz.md
	era: [{ name: "era", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	error: [{ name: "error", params: [{ name: "message" }], origin: "harvested" }], // sql/functions/utility.md
	even: [{ name: "even", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	exp: [{ name: "exp", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	factorial: [{ name: "factorial", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	favg: [{ name: "favg", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	fdiv: [{ name: "fdiv", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }], // sql/functions/numeric.md
	first: [{ name: "first", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	flatten: [{ name: "flatten", params: [{ name: "nested_list" }], origin: "harvested" }], // sql/functions/list.md
	floor: [{ name: "floor", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	fmod: [{ name: "fmod", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }], // sql/functions/numeric.md
	force_checkpoint: [{ name: "force_checkpoint", params: [{ name: "database" }], origin: "harvested" }], // sql/functions/utility.md
	format: [{ name: "format", params: [{ name: "format" }], variadic: true, origin: "harvested" }], // sql/functions/text.md
	format_bytes: [{ name: "format_bytes", params: [{ name: "integer" }], origin: "harvested" }], // sql/functions/text.md
	formatreadabledecimalsize: [
		{ name: "formatReadableDecimalSize", params: [{ name: "integer" }], origin: "harvested" },
	], // sql/functions/text.md
	from_base64: [{ name: "from_base64", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/blob.md
	fsum: [{ name: "fsum", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	gamma: [{ name: "gamma", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	gcd: [{ name: "gcd", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }], // sql/functions/numeric.md
	gen_random_uuid: [{ name: "gen_random_uuid", params: [], origin: "harvested" }], // sql/functions/utility.md
	generate_series: [
		{
			name: "generate_series",
			params: [{ name: "start" }, { name: "stop", optional: true }, { name: "step", optional: true }],
			origin: "harvested",
		},
		{
			name: "generate_series",
			params: [{ name: "timestamp" }, { name: "timestamp" }, { name: "interval" }],
			origin: "harvested",
		},
		{
			name: "generate_series",
			params: [{ name: "timestamptz" }, { name: "timestamptz" }, { name: "interval" }],
			origin: "harvested",
		},
		{ name: "generate_series", params: [{ name: "stop" }], origin: "harvested" },
	], // sql/functions/list.md, sql/functions/timestamp.md, sql/functions/timestamptz.md
	generate_subscripts: [
		{ name: "generate_subscripts", params: [{ name: "arr" }, { name: "dim" }], origin: "harvested" },
	], // sql/functions/list.md
	geometric_mean: [{ name: "geometric_mean", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	get_bit: [{ name: "get_bit", params: [{ name: "bitstring" }, { name: "index" }], origin: "harvested" }], // sql/functions/bitstring.md
	get_current_time: [{ name: "get_current_time", params: [], origin: "harvested" }], // sql/functions/time.md
	get_current_timestamp: [{ name: "get_current_timestamp", params: [], origin: "harvested" }], // sql/functions/timestamptz.md
	getenv: [{ name: "getenv", params: [{ name: "var" }], origin: "harvested" }], // sql/functions/utility.md
	glob: [{ name: "glob", params: [{ name: "search_path" }], origin: "harvested" }], // sql/functions/utility.md
	greatest: [
		{ name: "greatest", params: [{ name: "date" }, { name: "date" }], origin: "harvested" },
		{ name: "greatest", params: [{ name: "x1" }, { name: "x2" }], variadic: true, origin: "harvested" },
		{ name: "greatest", params: [{ name: "timestamp" }, { name: "timestamp" }], origin: "harvested" },
		{ name: "greatest", params: [{ name: "timestamptz" }, { name: "timestamptz" }], origin: "harvested" },
		{ name: "greatest", params: [{ name: "arg1" }], variadic: true, origin: "harvested" },
	], // sql/functions/date.md, sql/functions/numeric.md, sql/functions/timestamp.md, sql/functions/timestamptz.md, sql/functions/text.md
	greatest_common_divisor: [
		{ name: "greatest_common_divisor", params: [{ name: "x" }, { name: "y" }], origin: "harvested" },
	], // sql/functions/numeric.md
	hamming: [{ name: "hamming", params: [{ name: "s1" }, { name: "s2" }], origin: "harvested" }], // sql/functions/text.md
	hash: [{ name: "hash", params: [{ name: "value" }], variadic: true, origin: "harvested" }], // sql/functions/text.md
	hex: [
		{ name: "hex", params: [{ name: "blob" }], origin: "harvested" },
		{ name: "hex", params: [{ name: "string" }], origin: "harvested" },
	], // sql/functions/blob.md, sql/functions/text.md
	histogram: [
		{ name: "histogram", params: [{ name: "arg" }, { name: "boundaries", optional: true }], origin: "harvested" },
	], // sql/functions/aggregates.md
	histogram_exact: [
		{ name: "histogram_exact", params: [{ name: "arg" }, { name: "elements" }], origin: "harvested" },
	], // sql/functions/aggregates.md
	histogram_values: [
		{
			name: "histogram_values",
			params: [{ name: "source" }, { name: "col_name" }, { name: "technique" }, { name: "bin_count" }],
			origin: "harvested",
		},
	], // sql/functions/aggregates.md
	hour: [{ name: "hour", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	icu_sort_key: [{ name: "icu_sort_key", params: [{ name: "string" }, { name: "collator" }], origin: "harvested" }], // sql/functions/utility.md
	if: [
		{
			name: "if",
			params: [{ name: "condition", type: "boolean" }, { name: "a" }, { name: "b" }],
			origin: "curated",
		},
	], // curated: if(condition, a, b)
	ifnull: [{ name: "ifnull", params: [{ name: "expr" }, { name: "other" }], origin: "harvested" }], // sql/functions/utility.md
	ilike_escape: [
		{
			name: "ilike_escape",
			params: [{ name: "string" }, { name: "like_specifier" }, { name: "escape_character" }],
			origin: "harvested",
		},
	], // sql/functions/text.md
	instr: [{ name: "instr", params: [{ name: "string" }, { name: "search_string" }], origin: "harvested" }], // sql/functions/text.md
	is_histogram_other_bin: [{ name: "is_histogram_other_bin", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/utility.md
	isfinite: [
		{ name: "isfinite", params: [{ name: "date" }], origin: "harvested" },
		{ name: "isfinite", params: [{ name: "x" }], origin: "harvested" },
		{ name: "isfinite", params: [{ name: "timestamp" }], origin: "harvested" },
		{ name: "isfinite", params: [{ name: "timestamptz" }], origin: "harvested" },
	], // sql/functions/date.md, sql/functions/numeric.md, sql/functions/timestamp.md, sql/functions/timestamptz.md
	isinf: [
		{ name: "isinf", params: [{ name: "date" }], origin: "harvested" },
		{ name: "isinf", params: [{ name: "x" }], origin: "harvested" },
		{ name: "isinf", params: [{ name: "timestamp" }], origin: "harvested" },
		{ name: "isinf", params: [{ name: "timestamptz" }], origin: "harvested" },
	], // sql/functions/date.md, sql/functions/numeric.md, sql/functions/timestamp.md, sql/functions/timestamptz.md
	isnan: [{ name: "isnan", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	isodow: [{ name: "isodow", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	isoyear: [{ name: "isoyear", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	jaccard: [{ name: "jaccard", params: [{ name: "s1" }, { name: "s2" }], origin: "harvested" }], // sql/functions/text.md
	jaro_similarity: [
		{
			name: "jaro_similarity",
			params: [{ name: "s1" }, { name: "s2" }, { name: "score_cutoff", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/text.md
	jaro_winkler_similarity: [
		{
			name: "jaro_winkler_similarity",
			params: [{ name: "s1" }, { name: "s2" }, { name: "score_cutoff", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/text.md
	julian: [
		{ name: "julian", params: [{ name: "date" }], origin: "harvested" },
		{ name: "julian", params: [{ name: "timestamp" }], origin: "harvested" },
	], // sql/functions/date.md, sql/functions/timestamp.md
	kurtosis: [{ name: "kurtosis", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	kurtosis_pop: [{ name: "kurtosis_pop", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	last: [{ name: "last", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	last_day: [
		{ name: "last_day", params: [{ name: "date" }], origin: "harvested" },
		{ name: "last_day", params: [{ name: "timestamp" }], origin: "harvested" },
		{ name: "last_day", params: [{ name: "timestamptz" }], origin: "harvested" },
	], // sql/functions/date.md, sql/functions/timestamp.md, sql/functions/timestamptz.md
	lcm: [{ name: "lcm", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }], // sql/functions/numeric.md
	least: [
		{ name: "least", params: [{ name: "date" }, { name: "date" }], origin: "harvested" },
		{ name: "least", params: [{ name: "x1" }, { name: "x2" }], variadic: true, origin: "harvested" },
		{ name: "least", params: [{ name: "timestamp" }, { name: "timestamp" }], origin: "harvested" },
		{ name: "least", params: [{ name: "timestamptz" }, { name: "timestamptz" }], origin: "harvested" },
		{ name: "least", params: [{ name: "arg1" }], variadic: true, origin: "harvested" },
	], // sql/functions/date.md, sql/functions/numeric.md, sql/functions/timestamp.md, sql/functions/timestamptz.md, sql/functions/text.md
	least_common_multiple: [
		{ name: "least_common_multiple", params: [{ name: "x" }, { name: "y" }], origin: "harvested" },
	], // sql/functions/numeric.md
	left: [{ name: "left", params: [{ name: "string" }, { name: "count" }], origin: "harvested" }], // sql/functions/text.md
	left_grapheme: [{ name: "left_grapheme", params: [{ name: "string" }, { name: "count" }], origin: "harvested" }], // sql/functions/text.md
	length: [
		{ name: "length", params: [{ name: "bitstring" }], origin: "harvested" },
		{ name: "length", params: [{ name: "list" }], origin: "harvested" },
		{ name: "length", params: [{ name: "string" }], origin: "harvested" },
	], // sql/functions/bitstring.md, sql/functions/list.md, sql/functions/text.md
	length_grapheme: [{ name: "length_grapheme", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	levenshtein: [{ name: "levenshtein", params: [{ name: "s1" }, { name: "s2" }], origin: "harvested" }], // sql/functions/text.md
	lgamma: [{ name: "lgamma", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	like_escape: [
		{
			name: "like_escape",
			params: [{ name: "string" }, { name: "like_specifier" }, { name: "escape_character" }],
			origin: "harvested",
		},
	], // sql/functions/text.md
	list: [{ name: "list", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	list_aggregate: [
		{
			name: "list_aggregate",
			params: [{ name: "list" }, { name: "function_name" }],
			variadic: true,
			origin: "harvested",
		},
	], // sql/functions/list.md
	list_any_value: [{ name: "list_any_value", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_append: [{ name: "list_append", params: [{ name: "list" }, { name: "element" }], origin: "harvested" }], // sql/functions/list.md
	list_approx_count_distinct: [
		{ name: "list_approx_count_distinct", params: [{ name: "list" }], origin: "harvested" },
	], // sql/functions/list.md
	list_avg: [{ name: "list_avg", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_bit_and: [{ name: "list_bit_and", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_bit_or: [{ name: "list_bit_or", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_bit_xor: [{ name: "list_bit_xor", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_bool_and: [{ name: "list_bool_and", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_bool_or: [{ name: "list_bool_or", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_contains: [{ name: "list_contains", params: [{ name: "list" }, { name: "element" }], origin: "harvested" }], // sql/functions/list.md
	list_cosine_distance: [
		{ name: "list_cosine_distance", params: [{ name: "list1" }, { name: "list2" }], origin: "harvested" },
	], // sql/functions/list.md
	list_cosine_similarity: [
		{ name: "list_cosine_similarity", params: [{ name: "list1" }, { name: "list2" }], origin: "harvested" },
	], // sql/functions/list.md
	list_count: [{ name: "list_count", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_distance: [{ name: "list_distance", params: [{ name: "list1" }, { name: "list2" }], origin: "harvested" }], // sql/functions/list.md
	list_distinct: [{ name: "list_distinct", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_entropy: [{ name: "list_entropy", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_extract: [{ name: "list_extract", params: [{ name: "list" }, { name: "index" }], origin: "harvested" }], // sql/functions/list.md
	list_filter: [
		{ name: "list_filter", params: [{ name: "list", type: "list" }, { name: "lambda" }], origin: "curated" },
	], // curated: list_filter(list, lambda)
	list_first: [{ name: "list_first", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_grade_up: [
		{
			name: "list_grade_up",
			params: [{ name: "list" }, { name: "col1", optional: true }, { name: "col2", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/list.md
	list_has_all: [{ name: "list_has_all", params: [{ name: "list1" }, { name: "list2" }], origin: "harvested" }], // sql/functions/list.md
	list_has_any: [{ name: "list_has_any", params: [{ name: "list1" }, { name: "list2" }], origin: "harvested" }], // sql/functions/list.md
	list_histogram: [{ name: "list_histogram", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_inner_product: [
		{ name: "list_inner_product", params: [{ name: "list1" }, { name: "list2" }], origin: "harvested" },
	], // sql/functions/list.md
	list_intersect: [{ name: "list_intersect", params: [{ name: "list1" }, { name: "list2" }], origin: "harvested" }], // sql/functions/list.md
	list_kurtosis: [{ name: "list_kurtosis", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_kurtosis_pop: [{ name: "list_kurtosis_pop", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_last: [{ name: "list_last", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_mad: [{ name: "list_mad", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_max: [{ name: "list_max", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_median: [{ name: "list_median", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_min: [{ name: "list_min", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_mode: [{ name: "list_mode", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_negative_inner_product: [
		{ name: "list_negative_inner_product", params: [{ name: "list1" }, { name: "list2" }], origin: "harvested" },
	], // sql/functions/list.md
	list_position: [{ name: "list_position", params: [{ name: "list" }, { name: "element" }], origin: "harvested" }], // sql/functions/list.md
	list_prepend: [{ name: "list_prepend", params: [{ name: "element" }, { name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_product: [{ name: "list_product", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_reduce: [
		{
			name: "list_reduce",
			params: [{ name: "list", type: "list" }, { name: "lambda" }, { name: "initial_value", optional: true }],
			origin: "curated",
		},
	], // curated: list_reduce(list, lambda[, initial_value])
	list_reverse: [{ name: "list_reverse", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_reverse_sort: [
		{
			name: "list_reverse_sort",
			params: [{ name: "list" }, { name: "col1", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/list.md
	list_select: [
		{ name: "list_select", params: [{ name: "value_list" }, { name: "index_list" }], origin: "harvested" },
	], // sql/functions/list.md
	list_sem: [{ name: "list_sem", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_skewness: [{ name: "list_skewness", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_slice: [
		{
			name: "list_slice",
			params: [{ name: "list" }, { name: "begin" }, { name: "end" }, { name: "step", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/list.md
	list_sort: [
		{
			name: "list_sort",
			params: [{ name: "list" }, { name: "col1", optional: true }, { name: "col2", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/list.md
	list_stddev_pop: [{ name: "list_stddev_pop", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_stddev_samp: [{ name: "list_stddev_samp", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_string_agg: [{ name: "list_string_agg", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_sum: [{ name: "list_sum", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_transform: [
		{ name: "list_transform", params: [{ name: "list", type: "list" }, { name: "lambda" }], origin: "curated" },
	], // curated: list_transform(list, lambda)
	list_unique: [{ name: "list_unique", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_value: [{ name: "list_value", params: [{ name: "arg" }], variadic: true, origin: "harvested" }], // sql/functions/list.md
	list_var_pop: [{ name: "list_var_pop", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_var_samp: [{ name: "list_var_samp", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	list_where: [{ name: "list_where", params: [{ name: "value_list" }, { name: "mask_list" }], origin: "harvested" }], // sql/functions/list.md
	ln: [{ name: "ln", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	log: [{ name: "log", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	log10: [{ name: "log10", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	log2: [{ name: "log2", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	lower: [{ name: "lower", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	lpad: [
		{ name: "lpad", params: [{ name: "string" }, { name: "count" }, { name: "character" }], origin: "harvested" },
	], // sql/functions/text.md
	ltrim: [
		{ name: "ltrim", params: [{ name: "string" }, { name: "characters", optional: true }], origin: "harvested" },
	], // sql/functions/text.md
	mad: [{ name: "mad", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	make_date: [
		{ name: "make_date", params: [{ name: "year" }, { name: "month" }, { name: "day" }], origin: "harvested" },
	], // sql/functions/date.md
	make_time: [
		{
			name: "make_time",
			params: [{ name: "bigint" }, { name: "bigint" }, { name: "double" }],
			origin: "harvested",
		},
	], // sql/functions/time.md
	make_timestamp: [
		{
			name: "make_timestamp",
			params: [
				{ name: "bigint" },
				{ name: "bigint" },
				{ name: "bigint" },
				{ name: "bigint" },
				{ name: "bigint" },
				{ name: "double" },
			],
			origin: "harvested",
		},
		{ name: "make_timestamp", params: [{ name: "microseconds" }], origin: "harvested" },
	], // sql/functions/timestamp.md
	make_timestamp_ms: [{ name: "make_timestamp_ms", params: [{ name: "milliseconds" }], origin: "harvested" }], // sql/functions/timestamp.md
	make_timestamp_ns: [{ name: "make_timestamp_ns", params: [{ name: "nanoseconds" }], origin: "harvested" }], // sql/functions/timestamp.md
	make_timestamptz: [
		{
			name: "make_timestamptz",
			params: [
				{ name: "bigint" },
				{ name: "bigint" },
				{ name: "bigint" },
				{ name: "bigint" },
				{ name: "bigint" },
				{ name: "double" },
				{ name: "string", optional: true },
			],
			origin: "harvested",
		},
		{ name: "make_timestamptz", params: [{ name: "microseconds" }], origin: "harvested" },
	], // sql/functions/timestamptz.md
	map_contains: [{ name: "map_contains", params: [{ name: "map" }, { name: "key" }], origin: "harvested" }], // sql/functions/map.md
	map_contains_entry: [
		{
			name: "map_contains_entry",
			params: [{ name: "map" }, { name: "key" }, { name: "value" }],
			origin: "harvested",
		},
	], // sql/functions/map.md
	map_contains_value: [
		{ name: "map_contains_value", params: [{ name: "map" }, { name: "value" }], origin: "harvested" },
	], // sql/functions/map.md
	map_entries: [{ name: "map_entries", params: [{ name: "map" }], origin: "harvested" }], // sql/functions/map.md
	map_extract: [{ name: "map_extract", params: [{ name: "map" }, { name: "key" }], origin: "harvested" }], // sql/functions/map.md
	map_extract_value: [{ name: "map_extract_value", params: [{ name: "map" }, { name: "key" }], origin: "harvested" }], // sql/functions/map.md
	map_keys: [{ name: "map_keys", params: [{ name: "map" }], origin: "harvested" }], // sql/functions/map.md
	map_values: [{ name: "map_values", params: [{ name: "map" }], origin: "harvested" }], // sql/functions/map.md
	max: [{ name: "max", params: [{ name: "arg" }, { name: "n", optional: true }], origin: "harvested" }], // sql/functions/aggregates.md
	md5: [
		{ name: "md5", params: [{ name: "blob" }], origin: "harvested" },
		{ name: "md5", params: [{ name: "string" }], origin: "harvested" },
	], // sql/functions/blob.md, sql/functions/text.md
	md5_number: [
		{ name: "md5_number", params: [{ name: "blob" }], origin: "harvested" },
		{ name: "md5_number", params: [{ name: "string" }], origin: "harvested" },
	], // sql/functions/blob.md, sql/functions/text.md
	md5_number_lower: [{ name: "md5_number_lower", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	md5_number_upper: [{ name: "md5_number_upper", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	median: [{ name: "median", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	microsecond: [{ name: "microsecond", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	millennium: [{ name: "millennium", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	millisecond: [{ name: "millisecond", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	min: [{ name: "min", params: [{ name: "arg" }, { name: "n", optional: true }], origin: "harvested" }], // sql/functions/aggregates.md
	minute: [{ name: "minute", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	mode: [{ name: "mode", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	month: [{ name: "month", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	monthname: [
		{ name: "monthname", params: [{ name: "date" }], origin: "harvested" },
		{ name: "monthname", params: [{ name: "timestamp" }], origin: "harvested" },
	], // sql/functions/date.md, sql/functions/timestamp.md
	multiply: [{ name: "multiply", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }], // sql/functions/numeric.md
	nextafter: [{ name: "nextafter", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }], // sql/functions/numeric.md
	nfc_normalize: [{ name: "nfc_normalize", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	not_ilike_escape: [
		{
			name: "not_ilike_escape",
			params: [{ name: "string" }, { name: "like_specifier" }, { name: "escape_character" }],
			origin: "harvested",
		},
	], // sql/functions/text.md
	not_like_escape: [
		{
			name: "not_like_escape",
			params: [{ name: "string" }, { name: "like_specifier" }, { name: "escape_character" }],
			origin: "harvested",
		},
	], // sql/functions/text.md
	now: [{ name: "now", params: [], origin: "harvested" }], // sql/functions/timestamptz.md
	nullif: [{ name: "nullif", params: [{ name: "a" }, { name: "b" }], origin: "harvested" }], // sql/functions/utility.md
	octet_length: [
		{ name: "octet_length", params: [{ name: "bitstring" }], origin: "harvested" },
		{ name: "octet_length", params: [{ name: "blob" }], origin: "harvested" },
	], // sql/functions/bitstring.md, sql/functions/blob.md
	parse_dirname: [
		{
			name: "parse_dirname",
			params: [{ name: "path" }, { name: "separator", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/text.md
	parse_dirpath: [
		{
			name: "parse_dirpath",
			params: [{ name: "path" }, { name: "separator", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/text.md
	parse_filename: [
		{
			name: "parse_filename",
			params: [
				{ name: "string" },
				{ name: "trim_extension", optional: true },
				{ name: "separator", optional: true },
			],
			origin: "harvested",
		},
	], // sql/functions/text.md
	parse_formatted_bytes: [{ name: "parse_formatted_bytes", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/utility.md
	parse_path: [
		{ name: "parse_path", params: [{ name: "path" }, { name: "separator", optional: true }], origin: "harvested" },
	], // sql/functions/text.md
	pg_typeof: [{ name: "pg_typeof", params: [{ name: "expression" }], origin: "harvested" }], // sql/functions/utility.md
	pi: [{ name: "pi", params: [], origin: "harvested" }], // sql/functions/numeric.md
	pow: [{ name: "pow", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }], // sql/functions/numeric.md
	power: [{ name: "power", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }], // sql/functions/numeric.md
	prefix: [{ name: "prefix", params: [{ name: "string" }, { name: "search_string" }], origin: "harvested" }], // sql/functions/text.md
	printf: [{ name: "printf", params: [{ name: "format" }], variadic: true, origin: "harvested" }], // sql/functions/text.md
	product: [{ name: "product", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	quantile_cont: [{ name: "quantile_cont", params: [{ name: "x" }, { name: "pos" }], origin: "harvested" }], // sql/functions/aggregates.md
	quantile_disc: [{ name: "quantile_disc", params: [{ name: "x" }, { name: "pos" }], origin: "harvested" }], // sql/functions/aggregates.md
	quarter: [{ name: "quarter", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	query: [{ name: "query", params: [{ name: "query_string" }], origin: "harvested" }], // sql/functions/utility.md
	query_table: [{ name: "query_table", params: [{ name: "tbl_name" }], origin: "harvested" }], // sql/functions/utility.md
	radians: [{ name: "radians", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	random: [{ name: "random", params: [], origin: "harvested" }], // sql/functions/numeric.md
	range: [
		{
			name: "range",
			params: [{ name: "start" }, { name: "stop", optional: true }, { name: "step", optional: true }],
			origin: "harvested",
		},
		{
			name: "range",
			params: [{ name: "timestamp" }, { name: "timestamp" }, { name: "interval" }],
			origin: "harvested",
		},
		{
			name: "range",
			params: [{ name: "timestamptz" }, { name: "timestamptz" }, { name: "interval" }],
			origin: "harvested",
		},
		{ name: "range", params: [{ name: "stop" }], origin: "harvested" },
	], // sql/functions/list.md, sql/functions/timestamp.md, sql/functions/timestamptz.md
	read_blob: [{ name: "read_blob", params: [{ name: "source" }], origin: "harvested" }], // sql/functions/blob.md
	read_text: [{ name: "read_text", params: [{ name: "source" }], origin: "harvested" }], // sql/functions/text.md
	regexp_escape: [{ name: "regexp_escape", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	regexp_extract: [
		{
			name: "regexp_extract",
			params: [
				{ name: "string" },
				{ name: "pattern" },
				{ name: "name_list" },
				{ name: "options", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "regexp_extract",
			params: [
				{ name: "string" },
				{ name: "regex" },
				{ name: "group", optional: true },
				{ name: "options", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "regexp_extract",
			params: [{ name: "string" }, { name: "regex" }, { name: "name_list" }, { name: "options", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/regular_expressions.md, sql/functions/text.md
	regexp_extract_all: [
		{
			name: "regexp_extract_all",
			params: [{ name: "string" }, { name: "regex" }, { name: "name_list" }, { name: "options", optional: true }],
			origin: "harvested",
		},
		{
			name: "regexp_extract_all",
			params: [
				{ name: "string" },
				{ name: "regex" },
				{ name: "group", optional: true },
				{ name: "options", optional: true },
			],
			origin: "harvested",
		},
	], // sql/functions/regular_expressions.md, sql/functions/text.md
	regexp_full_match: [
		{
			name: "regexp_full_match",
			params: [{ name: "string" }, { name: "regex" }, { name: "options", optional: true }],
			origin: "harvested",
		},
		{
			name: "regexp_full_match",
			params: [{ name: "string" }, { name: "regex" }, { name: "col2", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/regular_expressions.md, sql/functions/text.md
	regexp_matches: [
		{
			name: "regexp_matches",
			params: [{ name: "string" }, { name: "pattern" }, { name: "options", optional: true }],
			origin: "harvested",
		},
		{
			name: "regexp_matches",
			params: [{ name: "string" }, { name: "regex" }, { name: "options", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/regular_expressions.md, sql/functions/text.md
	regexp_replace: [
		{
			name: "regexp_replace",
			params: [
				{ name: "string" },
				{ name: "pattern" },
				{ name: "replacement" },
				{ name: "options", optional: true },
			],
			origin: "harvested",
		},
		{
			name: "regexp_replace",
			params: [
				{ name: "string" },
				{ name: "regex" },
				{ name: "replacement" },
				{ name: "options", optional: true },
			],
			origin: "harvested",
		},
	], // sql/functions/regular_expressions.md, sql/functions/text.md
	regexp_split_to_array: [
		{
			name: "regexp_split_to_array",
			params: [{ name: "string" }, { name: "regex" }, { name: "options", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/regular_expressions.md
	regexp_split_to_table: [
		{
			name: "regexp_split_to_table",
			params: [{ name: "string" }, { name: "regex" }, { name: "options", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/regular_expressions.md
	regr_avgx: [{ name: "regr_avgx", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	regr_avgy: [{ name: "regr_avgy", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	regr_count: [{ name: "regr_count", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	regr_intercept: [{ name: "regr_intercept", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	regr_r2: [{ name: "regr_r2", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	regr_slope: [{ name: "regr_slope", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	regr_sxx: [{ name: "regr_sxx", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	regr_sxy: [{ name: "regr_sxy", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	regr_syy: [{ name: "regr_syy", params: [{ name: "y" }, { name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	repeat: [
		{ name: "repeat", params: [{ name: "blob" }, { name: "count" }], origin: "harvested" },
		{ name: "repeat", params: [{ name: "list" }, { name: "count" }], origin: "harvested" },
		{ name: "repeat", params: [{ name: "string" }, { name: "count" }], origin: "harvested" },
	], // sql/functions/blob.md, sql/functions/list.md, sql/functions/text.md
	repeat_row: [{ name: "repeat_row", params: [{ name: "varargs" }, { name: "num_rows" }], origin: "harvested" }], // sql/functions/utility.md
	replace: [
		{ name: "replace", params: [{ name: "string" }, { name: "source" }, { name: "target" }], origin: "harvested" },
	], // sql/functions/text.md
	replace_type: [
		{
			name: "replace_type",
			params: [{ name: "value" }, { name: "source_type" }, { name: "target_type" }],
			origin: "harvested",
		},
	], // sql/functions/utility.md
	reverse: [{ name: "reverse", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	right: [{ name: "right", params: [{ name: "string" }, { name: "count" }], origin: "harvested" }], // sql/functions/text.md
	right_grapheme: [{ name: "right_grapheme", params: [{ name: "string" }, { name: "count" }], origin: "harvested" }], // sql/functions/text.md
	round: [
		{
			name: "round",
			params: [
				{ name: "v", type: "NUMERIC" },
				{ name: "s", type: "INTEGER" },
			],
			origin: "harvested",
		},
	], // sql/functions/numeric.md
	round_even: [
		{
			name: "round_even",
			params: [
				{ name: "v", type: "NUMERIC" },
				{ name: "s", type: "INTEGER" },
			],
			origin: "harvested",
		},
	], // sql/functions/numeric.md
	roundbankers: [
		{
			name: "roundbankers",
			params: [
				{ name: "v", type: "NUMERIC" },
				{ name: "s", type: "INTEGER" },
			],
			origin: "harvested",
		},
	], // sql/functions/numeric.md
	row: [{ name: "row", params: [{ name: "any" }], variadic: true, origin: "harvested" }], // sql/functions/struct.md
	rpad: [
		{ name: "rpad", params: [{ name: "string" }, { name: "count" }, { name: "character" }], origin: "harvested" },
	], // sql/functions/text.md
	rtrim: [
		{ name: "rtrim", params: [{ name: "string" }, { name: "characters", optional: true }], origin: "harvested" },
	], // sql/functions/text.md
	second: [{ name: "second", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	sem: [{ name: "sem", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	set_bit: [
		{
			name: "set_bit",
			params: [{ name: "bitstring" }, { name: "index" }, { name: "new_value" }],
			origin: "harvested",
		},
	], // sql/functions/bitstring.md
	setseed: [{ name: "setseed", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	sha1: [
		{ name: "sha1", params: [{ name: "blob" }], origin: "harvested" },
		{ name: "sha1", params: [{ name: "value" }], origin: "harvested" },
		{ name: "sha1", params: [{ name: "string" }], origin: "harvested" },
	], // sql/functions/blob.md, sql/functions/text.md, sql/functions/utility.md
	sha256: [
		{ name: "sha256", params: [{ name: "blob" }], origin: "harvested" },
		{ name: "sha256", params: [{ name: "value" }], origin: "harvested" },
		{ name: "sha256", params: [{ name: "string" }], origin: "harvested" },
	], // sql/functions/blob.md, sql/functions/text.md, sql/functions/utility.md
	sign: [{ name: "sign", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	signbit: [{ name: "signbit", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	sin: [{ name: "sin", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	skewness: [{ name: "skewness", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	sleep_ms: [{ name: "sleep_ms", params: [{ name: "milliseconds" }], origin: "harvested" }], // sql/functions/utility.md
	split_part: [
		{
			name: "split_part",
			params: [{ name: "string" }, { name: "separator" }, { name: "index" }],
			origin: "harvested",
		},
	], // sql/functions/text.md
	sqrt: [{ name: "sqrt", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	starts_with: [
		{ name: "starts_with", params: [{ name: "string" }, { name: "search_string" }], origin: "harvested" },
	], // sql/functions/text.md
	stats: [{ name: "stats", params: [{ name: "expression" }], origin: "harvested" }], // sql/functions/utility.md
	stddev_pop: [{ name: "stddev_pop", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	stddev_samp: [{ name: "stddev_samp", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	strftime: [
		{ name: "strftime", params: [{ name: "date" }, { name: "format" }], origin: "harvested" },
		{ name: "strftime", params: [{ name: "timestamp" }, { name: "format" }], origin: "harvested" },
		{ name: "strftime", params: [{ name: "timestamptz" }, { name: "format" }], origin: "harvested" },
	], // sql/functions/date.md, sql/functions/timestamp.md, sql/functions/timestamptz.md
	string_agg: [
		{ name: "string_agg", params: [{ name: "arg" }, { name: "sep", optional: true }], origin: "harvested" },
	], // sql/functions/aggregates.md
	string_split: [{ name: "string_split", params: [{ name: "string" }, { name: "separator" }], origin: "harvested" }], // sql/functions/text.md
	string_split_regex: [
		{
			name: "string_split_regex",
			params: [{ name: "string" }, { name: "regex" }, { name: "options", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/text.md
	strip_accents: [{ name: "strip_accents", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	strlen: [{ name: "strlen", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	strptime: [{ name: "strptime", params: [{ name: "text" }, { name: "format" }], origin: "harvested" }], // sql/functions/timestamp.md
	struct_contains: [
		{ name: "struct_contains", params: [{ name: "struct" }, { name: "entry" }], origin: "harvested" },
	], // sql/functions/struct.md
	struct_extract: [{ name: "struct_extract", params: [{ name: "struct" }, { name: "idx" }], origin: "harvested" }], // sql/functions/struct.md
	struct_extract_at: [
		{ name: "struct_extract_at", params: [{ name: "struct" }, { name: "idx" }], origin: "harvested" },
	], // sql/functions/struct.md
	struct_position: [
		{ name: "struct_position", params: [{ name: "struct" }, { name: "entry" }], origin: "harvested" },
	], // sql/functions/struct.md
	struct_values: [{ name: "struct_values", params: [{ name: "struct" }], origin: "harvested" }], // sql/functions/struct.md
	substring: [
		{
			name: "substring",
			params: [{ name: "string" }, { name: "start" }, { name: "length", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/text.md
	substring_grapheme: [
		{
			name: "substring_grapheme",
			params: [{ name: "string" }, { name: "start" }, { name: "length", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/text.md
	subtract: [{ name: "subtract", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }], // sql/functions/numeric.md
	suffix: [{ name: "suffix", params: [{ name: "string" }, { name: "search_string" }], origin: "harvested" }], // sql/functions/text.md
	sum: [{ name: "sum", params: [{ name: "arg" }], origin: "harvested" }], // sql/functions/aggregates.md
	tan: [{ name: "tan", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	time_bucket: [
		{
			name: "time_bucket",
			params: [{ name: "bucket_width" }, { name: "date" }, { name: "offset", optional: true }],
			origin: "harvested",
		},
		{
			name: "time_bucket",
			params: [{ name: "bucket_width" }, { name: "date" }, { name: "origin", optional: true }],
			origin: "harvested",
		},
		{
			name: "time_bucket",
			params: [{ name: "bucket_width" }, { name: "timestamp" }, { name: "offset", optional: true }],
			origin: "harvested",
		},
		{
			name: "time_bucket",
			params: [{ name: "bucket_width" }, { name: "timestamp" }, { name: "origin", optional: true }],
			origin: "harvested",
		},
		{
			name: "time_bucket",
			params: [{ name: "bucket_width" }, { name: "timestamptz" }, { name: "offset", optional: true }],
			origin: "harvested",
		},
		{
			name: "time_bucket",
			params: [{ name: "bucket_width" }, { name: "timestamptz" }, { name: "origin", optional: true }],
			origin: "harvested",
		},
		{
			name: "time_bucket",
			params: [{ name: "bucket_width" }, { name: "timestamptz" }, { name: "timezone", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/date.md, sql/functions/timestamp.md, sql/functions/timestamptz.md
	timetz_byte_comparable: [{ name: "timetz_byte_comparable", params: [{ name: "timetz" }], origin: "harvested" }], // sql/functions/timestamptz.md
	timezone: [
		{ name: "timezone", params: [{ name: "text" }, { name: "timestamp" }], origin: "harvested" },
		{ name: "timezone", params: [{ name: "text" }, { name: "timestamptz" }], origin: "harvested" },
		{ name: "timezone", params: [{ name: "date" }], origin: "harvested" },
	], // sql/functions/timestamptz.md, sql/functions/datepart.md
	timezone_hour: [{ name: "timezone_hour", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	timezone_minute: [{ name: "timezone_minute", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	to_base: [
		{
			name: "to_base",
			params: [{ name: "number" }, { name: "radix" }, { name: "min_length", optional: true }],
			origin: "harvested",
		},
	], // sql/functions/text.md
	to_base64: [{ name: "to_base64", params: [{ name: "blob" }], origin: "harvested" }], // sql/functions/blob.md
	to_centuries: [{ name: "to_centuries", params: [{ name: "integer" }], origin: "harvested" }], // sql/functions/interval.md
	to_days: [{ name: "to_days", params: [{ name: "integer" }], origin: "harvested" }], // sql/functions/interval.md
	to_decades: [{ name: "to_decades", params: [{ name: "integer" }], origin: "harvested" }], // sql/functions/interval.md
	to_hours: [{ name: "to_hours", params: [{ name: "integer" }], origin: "harvested" }], // sql/functions/interval.md
	to_microseconds: [{ name: "to_microseconds", params: [{ name: "integer" }], origin: "harvested" }], // sql/functions/interval.md
	to_millennia: [{ name: "to_millennia", params: [{ name: "integer" }], origin: "harvested" }], // sql/functions/interval.md
	to_milliseconds: [{ name: "to_milliseconds", params: [{ name: "integer" }], origin: "harvested" }], // sql/functions/interval.md
	to_minutes: [{ name: "to_minutes", params: [{ name: "integer" }], origin: "harvested" }], // sql/functions/interval.md
	to_months: [{ name: "to_months", params: [{ name: "integer" }], origin: "harvested" }], // sql/functions/interval.md
	to_quarters: [{ name: "to_quarters", params: [{ name: "integer" }], origin: "harvested" }], // sql/functions/interval.md
	to_seconds: [{ name: "to_seconds", params: [{ name: "integer" }], origin: "harvested" }], // sql/functions/interval.md
	to_timestamp: [{ name: "to_timestamp", params: [{ name: "double" }], origin: "harvested" }], // sql/functions/timestamptz.md
	to_weeks: [{ name: "to_weeks", params: [{ name: "integer" }], origin: "harvested" }], // sql/functions/interval.md
	to_years: [{ name: "to_years", params: [{ name: "integer" }], origin: "harvested" }], // sql/functions/interval.md
	today: [{ name: "today", params: [], origin: "harvested" }], // sql/functions/date.md
	transaction_timestamp: [{ name: "transaction_timestamp", params: [], origin: "harvested" }], // sql/functions/timestamptz.md
	translate: [
		{ name: "translate", params: [{ name: "string" }, { name: "from" }, { name: "to" }], origin: "harvested" },
	], // sql/functions/text.md
	trim: [{ name: "trim", params: [{ name: "string" }, { name: "characters", optional: true }], origin: "harvested" }], // sql/functions/text.md
	trunc: [{ name: "trunc", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/numeric.md
	try_strptime: [{ name: "try_strptime", params: [{ name: "text" }, { name: "format" }], origin: "harvested" }], // sql/functions/timestamp.md
	txid_current: [{ name: "txid_current", params: [], origin: "harvested" }], // sql/functions/utility.md
	typeof: [{ name: "typeof", params: [{ name: "expression" }], origin: "harvested" }], // sql/functions/utility.md
	unbin: [{ name: "unbin", params: [{ name: "value" }], origin: "harvested" }], // sql/functions/blob.md
	unhex: [{ name: "unhex", params: [{ name: "value" }], origin: "harvested" }], // sql/functions/blob.md
	unicode: [{ name: "unicode", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	union_tag: [{ name: "union_tag", params: [{ name: "union" }], origin: "harvested" }], // sql/functions/union.md
	unnest: [{ name: "unnest", params: [{ name: "list" }], origin: "harvested" }], // sql/functions/list.md
	unpivot_list: [{ name: "unpivot_list", params: [{ name: "arg" }], variadic: true, origin: "harvested" }], // sql/functions/list.md
	upper: [{ name: "upper", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	url_decode: [{ name: "url_decode", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	url_encode: [{ name: "url_encode", params: [{ name: "string" }], origin: "harvested" }], // sql/functions/text.md
	uuid: [{ name: "uuid", params: [], origin: "harvested" }], // sql/functions/utility.md
	uuid_extract_timestamp: [{ name: "uuid_extract_timestamp", params: [{ name: "uuidv7" }], origin: "harvested" }], // sql/functions/utility.md
	uuid_extract_version: [{ name: "uuid_extract_version", params: [{ name: "uuid" }], origin: "harvested" }], // sql/functions/utility.md
	uuidv4: [{ name: "uuidv4", params: [], origin: "harvested" }], // sql/functions/utility.md
	uuidv7: [{ name: "uuidv7", params: [], origin: "harvested" }], // sql/functions/utility.md
	var_pop: [{ name: "var_pop", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	var_samp: [{ name: "var_samp", params: [{ name: "x" }], origin: "harvested" }], // sql/functions/aggregates.md
	version: [{ name: "version", params: [], origin: "harvested" }], // sql/functions/utility.md
	week: [{ name: "week", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	weekday: [{ name: "weekday", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	weekofyear: [{ name: "weekofyear", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	weighted_avg: [{ name: "weighted_avg", params: [{ name: "arg" }, { name: "weight" }], origin: "harvested" }], // sql/functions/aggregates.md
	xor: [{ name: "xor", params: [{ name: "x" }, { name: "y" }], origin: "harvested" }], // sql/functions/numeric.md
	year: [{ name: "year", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
	yearweek: [{ name: "yearweek", params: [{ name: "date" }], origin: "harvested" }], // sql/functions/datepart.md
};
