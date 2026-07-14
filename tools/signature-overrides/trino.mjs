// ---------------------------------------------------------------------------
// Trino - trino.io/docs/current/functions reference; cites the page per entry.
// ---------------------------------------------------------------------------
//
// Migrated (mechanically, 2026-07-14) from the hand-curated TRINO table that used to live
// in src/signature/signatures.ts, into a plain-data override input for
// tools/harvest-signatures.mjs. An override wins by key over the harvest at generation time and
// is tagged origin "curated" in the emitted table; "cite" carries the original entry's doc
// citation forward into the generated table's comment.

/** @typedef {{ name: string, type?: string, optional?: boolean }} ParamSig */
/** @typedef {{ name: string, params: ParamSig[], variadic?: boolean, cite: string }} OverrideSig */

/** @type {Record<string, OverrideSig>} */
export const OVERRIDES = {
	date_trunc: {
		name: "date_trunc",
		params: [
			{ name: "unit", type: "varchar" },
			{ name: "x", type: "timestamp" },
		],
		cite: "date_trunc(unit, x)",
	},
	date_add: {
		name: "date_add",
		params: [
			{ name: "unit", type: "varchar" },
			{ name: "value", type: "bigint" },
			{ name: "timestamp", type: "timestamp" },
		],
		cite: "date_add(unit, value, timestamp)",
	},
	date_diff: {
		name: "date_diff",
		params: [
			{ name: "unit", type: "varchar" },
			{ name: "timestamp1", type: "timestamp" },
			{ name: "timestamp2", type: "timestamp" },
		],
		cite: "date_diff(unit, timestamp1, timestamp2)",
	},
	date_format: {
		name: "date_format",
		params: [
			{ name: "timestamp", type: "timestamp" },
			{ name: "format", type: "varchar" },
		],
		cite: "date_format(timestamp, format)",
	},
	date_parse: {
		name: "date_parse",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "format", type: "varchar" },
		],
		cite: "date_parse(string, format)",
	},
	from_unixtime: {
		name: "from_unixtime",
		params: [
			{ name: "unixtime", type: "double" },
			{ name: "zone", type: "varchar" },
		],
		cite: "from_unixtime(unixtime[, zone])",
	},
	at_timezone: {
		name: "at_timezone",
		params: [
			{ name: "timestamp", type: "timestamp" },
			{ name: "zone", type: "varchar" },
		],
		cite: "at_timezone(timestamp, zone)",
	},
	// string - functions/string.html
	substr: {
		name: "substr",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "start", type: "bigint" },
			{ name: "length", type: "bigint" },
		],
		cite: "substr(string, start[, length])",
	},
	split: {
		name: "split",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "delimiter", type: "varchar" },
			{ name: "limit", type: "bigint", optional: true },
		],
		cite: "split(string, delimiter[, limit])",
	},
	split_part: {
		name: "split_part",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "delimiter", type: "varchar" },
			{ name: "index", type: "bigint" },
		],
		cite: "split_part(string, delimiter, index)",
	},
	strpos: {
		name: "strpos",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "substring", type: "varchar" },
			{ name: "instance", type: "bigint", optional: true },
		],
		cite: "strpos(string, substring[, instance])",
	},
	replace: {
		name: "replace",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "search", type: "varchar" },
			{ name: "replace", type: "varchar", optional: true },
		],
		cite: "replace(string, search[, replace])",
	},
	lpad: {
		name: "lpad",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "size", type: "bigint" },
			{ name: "padstring", type: "varchar" },
		],
		cite: "lpad(string, size, padstring)",
	},
	rpad: {
		name: "rpad",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "size", type: "bigint" },
			{ name: "padstring", type: "varchar" },
		],
		cite: "rpad(string, size, padstring)",
	},
	concat_ws: {
		name: "concat_ws",
		params: [
			{ name: "separator", type: "varchar" },
			{ name: "strings", type: "varchar" },
		],
		variadic: true,
		cite: 'concat_ws(separator, string1, ..., stringN) - a real variadic flag, not a cosmetic "..." in the type string',
	},
	format: {
		name: "format",
		params: [
			{ name: "format", type: "varchar" },
			{ name: "args", type: "any" },
		],
		variadic: true,
		cite: "format(format, args...)",
	},
	// regexp - functions/regexp.html
	regexp_like: {
		name: "regexp_like",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "pattern", type: "varchar" },
		],
		cite: "regexp_like(string, pattern)",
	},
	regexp_extract: {
		name: "regexp_extract",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "pattern", type: "varchar" },
			{ name: "group", type: "bigint", optional: true },
		],
		cite: "regexp_extract(string, pattern[, group])",
	},
	regexp_replace: {
		name: "regexp_replace",
		params: [
			{ name: "string", type: "varchar" },
			{ name: "pattern", type: "varchar" },
			{ name: "replacement", type: "varchar", optional: true },
		],
		cite: "regexp_replace(string, pattern[, replacement])",
	},
	// json - functions/json.html
	json_extract: {
		name: "json_extract",
		params: [
			{ name: "json", type: "json" },
			{ name: "json_path", type: "varchar" },
		],
		cite: "json_extract(json, json_path)",
	},
	json_extract_scalar: {
		name: "json_extract_scalar",
		params: [
			{ name: "json", type: "json" },
			{ name: "json_path", type: "varchar" },
		],
		cite: "json_extract_scalar(json, json_path)",
	},
	json_parse: { name: "json_parse", params: [{ name: "string", type: "varchar" }], cite: "json_parse(string)" },
	// array - functions/array.html
	element_at: {
		name: "element_at",
		params: [
			{ name: "collection", type: "array|map" },
			{ name: "key", type: "any" },
		],
		cite: "element_at(x, key)",
	},
	array_join: {
		name: "array_join",
		params: [
			{ name: "x", type: "array" },
			{ name: "delimiter", type: "varchar" },
			{ name: "null_replacement", type: "varchar", optional: true },
		],
		cite: "array_join(x, delimiter[, null_replacement])",
	},
	sequence: {
		name: "sequence",
		params: [
			{ name: "start", type: "bigint" },
			{ name: "stop", type: "bigint" },
			{ name: "step", type: "bigint", optional: true },
		],
		cite: "sequence(start, stop[, step]) - step optional, defaults to incrementing by 1",
	},
	transform: {
		name: "transform",
		params: [
			{ name: "array", type: "array" },
			{ name: "function", type: "lambda" },
		],
		cite: "transform(array, function) - functions/lambda.html",
	},
	reduce: {
		name: "reduce",
		params: [
			{ name: "array", type: "array" },
			{ name: "initialState", type: "any" },
			{ name: "inputFunction", type: "lambda" },
			{ name: "outputFunction", type: "lambda" },
		],
		cite: "reduce(array, s0, in, out)",
	},
	// aggregate - functions/aggregate.html
	count: { name: "count", params: [{ name: "x", type: "any" }], cite: "count(x)" },
	sum: { name: "sum", params: [{ name: "x", type: "numeric" }], cite: "sum(x)" },
	avg: { name: "avg", params: [{ name: "x", type: "numeric" }], cite: "avg(x)" },
	min: {
		name: "min",
		params: [
			{ name: "x", type: "any" },
			{ name: "n", type: "bigint", optional: true },
		],
		cite: "min(x[, n])",
	},
	max: {
		name: "max",
		params: [
			{ name: "x", type: "any" },
			{ name: "n", type: "bigint", optional: true },
		],
		cite: "max(x[, n])",
	},
	max_by: {
		name: "max_by",
		params: [
			{ name: "x", type: "any" },
			{ name: "y", type: "any" },
			{ name: "n", type: "bigint", optional: true },
		],
		cite: "max_by(x, y[, n])",
	},
	min_by: {
		name: "min_by",
		params: [
			{ name: "x", type: "any" },
			{ name: "y", type: "any" },
			{ name: "n", type: "bigint", optional: true },
		],
		cite: "min_by(x, y[, n])",
	},
	approx_percentile: {
		name: "approx_percentile",
		params: [
			{ name: "x", type: "numeric" },
			{ name: "percentile", type: "double" },
		],
		cite: "approx_percentile(x, percentile)",
	},
	approx_distinct: {
		name: "approx_distinct",
		params: [
			{ name: "x", type: "any" },
			{ name: "e", type: "double", optional: true },
		],
		cite: "approx_distinct(x[, e])",
	},
	listagg: {
		name: "listagg",
		params: [
			{ name: "expression", type: "varchar" },
			{ name: "separator", type: "varchar", optional: true },
		],
		cite: "listagg(expr[, separator]) WITHIN GROUP - separator is optional, defaults to the empty string when not specified",
	},
	// conditional - functions/conditional.html
	coalesce: {
		name: "coalesce",
		params: [
			{ name: "value1", type: "any" },
			{ name: "value2", type: "any" },
		],
		variadic: true,
		cite: 'coalesce(value1, value2, ...) - AstBuilder.java: "must have at least two arguments", min arity 2',
	},
	nullif: {
		name: "nullif",
		params: [
			{ name: "value1", type: "any" },
			{ name: "value2", type: "any" },
		],
		cite: "nullif(value1, value2)",
	},
	if: {
		name: "if",
		params: [
			{ name: "condition", type: "boolean" },
			{ name: "true_value", type: "any" },
			{ name: "false_value", type: "any", optional: true },
		],
		cite: "if(cond, t[, f]) - AstBuilder.java: arguments.size() == 2 || 3, false_value optional",
	},
	// map - functions/map.md documents two non-mergeable forms: `map() -> map<unknown, unknown>`
	// (0 args, the empty-map constructor) and `map(array(K), array(V)) -> map(K,V)` (2 args, from a
	// key array and a value array). The parenthesized-type notation ("array(K)") means the harvester
	// skips the 2-arg form outright (its NEVER-WRONG contract treats "(...)" inside a param as a
	// complex/unrepresentable shape), leaving only the 0-arg form in the harvest; real calls like
	// MAP(ARRAY['a'], ARRAY[1.0]) are the genuine 2-arg constructor, not a variant of the 0-arg one.
	map: {
		suppress: true,
		cite: "map() 0-arg empty-map constructor vs map(array(K), array(V)) 2-arg constructor - non-mergeable, functions/map.md",
	},
};
