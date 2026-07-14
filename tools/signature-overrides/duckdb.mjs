// ---------------------------------------------------------------------------
// DuckDB - duckdb.org/docs/current/sql/functions reference; cites the page per entry.
// ---------------------------------------------------------------------------
//
// Migrated (mechanically, 2026-07-14) from the hand-curated DUCKDB table that used to live
// in src/signature/signatures.ts, into a plain-data override input for
// tools/harvest-signatures.mjs. An override wins by key over the harvest at generation time and
// is tagged origin "curated" in the emitted table; "cite" carries the original entry's doc
// citation forward into the generated table's comment.

/** @typedef {{ name: string, type?: string, optional?: boolean }} ParamSig */
/** @typedef {{ params: ParamSig[], variadic?: boolean }} OverloadSig */
/** An entry expresses either ONE shape (legacy, still the common case) or an explicit multi-overload
 *  set via `overloads` - either way it replaces the WHOLE overload set for its key. `suppress: true`
 *  drops the name entirely: no flat overload set can represent it (never guessed at). */
/** @typedef {{ name: string, params: ParamSig[], variadic?: boolean, cite: string } | { name: string, overloads: OverloadSig[], cite: string } | { suppress: true, cite: string }} OverrideSig */

/** @type {Record<string, OverrideSig>} */
export const OVERRIDES = {
	date_add: {
		name: "date_add",
		params: [
			{ name: "date", type: "date" },
			{ name: "interval", type: "interval" },
		],
		cite: "date_add(date, interval)",
	},
	strptime: {
		name: "strptime",
		params: [
			{ name: "text", type: "text" },
			{ name: "format", type: "text" },
		],
		cite: "strptime(text, format)",
	},
	make_date: {
		name: "make_date",
		params: [
			{ name: "year", type: "bigint" },
			{ name: "month", type: "bigint" },
			{ name: "day", type: "bigint" },
		],
		cite: "make_date(year, month, day)",
	},
	time_bucket: {
		name: "time_bucket",
		params: [
			{ name: "bucket_width", type: "interval" },
			{ name: "timestamp", type: "timestamp" },
			{ name: "offset", type: "interval", optional: true },
		],
		cite: "time_bucket(bucket_width, timestamp[, offset])",
	},
	// text - functions/text.md
	concat_ws: {
		name: "concat_ws",
		params: [{ name: "separator", type: "text" }, { name: "value" }],
		variadic: true,
		cite: "concat_ws(separator, value, ...)",
	},
	substring: {
		name: "substring",
		params: [
			{ name: "string", type: "text" },
			{ name: "start", type: "int" },
			{ name: "length", type: "int", optional: true },
		],
		cite: "substring(string, start[, length]) - length is optional, extracts to the end of the string when omitted",
	},
	split_part: {
		name: "split_part",
		params: [
			{ name: "string", type: "text" },
			{ name: "separator", type: "text" },
			{ name: "index", type: "int" },
		],
		cite: "split_part(string, separator, index)",
	},
	replace: {
		name: "replace",
		params: [
			{ name: "string", type: "text" },
			{ name: "source", type: "text" },
			{ name: "target", type: "text" },
		],
		cite: "replace(string, source, target)",
	},
	lpad: {
		name: "lpad",
		params: [
			{ name: "string", type: "text" },
			{ name: "count", type: "int" },
			{ name: "character", type: "text" },
		],
		cite: "lpad(string, count, character)",
	},
	rpad: {
		name: "rpad",
		params: [
			{ name: "string", type: "text" },
			{ name: "count", type: "int" },
			{ name: "character", type: "text" },
		],
		cite: "rpad(string, count, character)",
	},
	left: {
		name: "left",
		params: [
			{ name: "string", type: "text" },
			{ name: "count", type: "int" },
		],
		cite: "left(string, count)",
	},
	right: {
		name: "right",
		params: [
			{ name: "string", type: "text" },
			{ name: "count", type: "int" },
		],
		cite: "right(string, count)",
	},
	starts_with: {
		name: "starts_with",
		params: [
			{ name: "string", type: "text" },
			{ name: "search_string", type: "text" },
		],
		cite: "starts_with(string, search_string)",
	},
	printf: {
		name: "printf",
		params: [{ name: "format", type: "text" }],
		variadic: true,
		cite: "printf(format, ...) - text.md:528, only format is required (printf('hello') is valid)",
	},
	format: {
		name: "format",
		params: [{ name: "format", type: "text" }],
		variadic: true,
		cite: "format(format, ...) - text.md:268, same shape as printf, only format is required",
	},
	// numeric - functions/numeric.md
	round: {
		name: "round",
		params: [
			{ name: "v", type: "numeric" },
			{ name: "s", type: "int" },
		],
		cite: "round(v, s)",
	},
	trunc: { name: "trunc", params: [{ name: "x", type: "numeric" }], cite: "trunc(x)" },
	abs: { name: "abs", params: [{ name: "x", type: "numeric" }], cite: "abs(x)" },
	ceil: { name: "ceil", params: [{ name: "x", type: "numeric" }], cite: "ceil(x)" },
	floor: { name: "floor", params: [{ name: "x", type: "numeric" }], cite: "floor(x)" },
	power: {
		name: "power",
		params: [
			{ name: "x", type: "numeric" },
			{ name: "y", type: "numeric" },
		],
		cite: "power(x, y)",
	},
	// list - functions/list.md
	list_transform: {
		name: "list_transform",
		params: [{ name: "list", type: "list" }, { name: "lambda" }],
		cite: "list_transform(list, lambda)",
	},
	list_filter: {
		name: "list_filter",
		params: [{ name: "list", type: "list" }, { name: "lambda" }],
		cite: "list_filter(list, lambda)",
	},
	list_reduce: {
		name: "list_reduce",
		params: [{ name: "list", type: "list" }, { name: "lambda" }, { name: "initial_value", optional: true }],
		cite: "list_reduce(list, lambda[, initial_value])",
	},
	list_extract: {
		name: "list_extract",
		params: [
			{ name: "list", type: "list" },
			{ name: "index", type: "int" },
		],
		cite: "list_extract(list, index)",
	},
	list_contains: {
		name: "list_contains",
		params: [{ name: "list", type: "list" }, { name: "element" }],
		cite: "list_contains(list, element)",
	},
	array_to_string: {
		name: "array_to_string",
		params: [
			{ name: "list", type: "list" },
			{ name: "delimiter", type: "text" },
		],
		cite: "array_to_string(list, delimiter)",
	},
	unnest: { name: "unnest", params: [{ name: "list", type: "list" }], cite: "unnest(list)" },
	// conditional - functions/utility.md
	if: {
		name: "if",
		params: [{ name: "condition", type: "boolean" }, { name: "a" }, { name: "b" }],
		cite: "if(condition, a, b)",
	},
	// aggregates - functions/aggregates.md
	sum: { name: "sum", params: [{ name: "arg", type: "numeric" }], cite: "sum(arg)" },
	avg: { name: "avg", params: [{ name: "arg", type: "numeric" }], cite: "avg(arg)" },
	min: { name: "min", params: [{ name: "arg" }, { name: "n", type: "int", optional: true }], cite: "min(arg[, n])" },
	max: { name: "max", params: [{ name: "arg" }, { name: "n", type: "int", optional: true }], cite: "max(arg[, n])" },
	arg_max: {
		name: "arg_max",
		params: [{ name: "arg" }, { name: "val" }, { name: "n", type: "int", optional: true }],
		cite: "arg_max(arg, val[, n])",
	},
	arg_min: {
		name: "arg_min",
		params: [{ name: "arg" }, { name: "val" }, { name: "n", type: "int", optional: true }],
		cite: "arg_min(arg, val[, n])",
	},
	string_agg: {
		name: "string_agg",
		params: [
			{ name: "arg", type: "text" },
			{ name: "sep", type: "text", optional: true },
		],
		cite: "string_agg(arg[, sep]) - sep is optional, defaults to a comma separator",
	},
	quantile_cont: {
		name: "quantile_cont",
		params: [
			{ name: "x", type: "numeric" },
			{ name: "pos", type: "double" },
		],
		cite: "quantile_cont(x, pos)",
	},
	// map - sql/functions/map.md documents map() (empty-map constructor, 0 args) AND the two-list
	// form MAP(key_list, value_list) (2 args) AND the brace literal MAP {k: v, ...} (which this
	// dialect's lowering also names "map", flattening each key/value into positional args, so a
	// 3-pair brace literal like `MAP {'a':1,'b':2,'c':3}` lowers to a 6-arg "map" call). These are
	// non-mergeable: no single flat param list can cover 0, 2, 4, and 6 args at once without
	// misrepresenting what each position means. sql/data_types/map.md: "To construct a MAP, use the
	// bracket syntax preceded by the MAP keyword" (MAP {...}) "A map can be also created using two
	// lists: keys and values ... SELECT MAP(['key1','key2','key3'], [10, 20, 30])"; sql/functions/map.md
	// "#### `map()`" / "Returns an empty map."
	map: {
		suppress: true,
		cite: "map() 0-arg empty-map constructor vs MAP(keys, values) 2-arg vs MAP {k:v,...} brace literal (flattened to 2n positional args by this dialect's lowering) - non-mergeable shapes, see sql/data_types/map.md and sql/functions/map.md",
	},
};
