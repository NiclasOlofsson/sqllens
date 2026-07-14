// ---------------------------------------------------------------------------
// PostgreSQL - postgresql.org/docs/18 function reference; cites the doc page/table per entry.
// ---------------------------------------------------------------------------
//
// Migrated (mechanically, 2026-07-14) from the hand-curated POSTGRES table that used to live
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
	age: {
		name: "age",
		params: [
			{ name: "timestamp", type: "timestamp" },
			{ name: "timestamp2", type: "timestamp" },
		],
		cite: "age(timestamp, timestamp)",
	},
	date_trunc: {
		name: "date_trunc",
		params: [
			{ name: "field", type: "text" },
			{ name: "source", type: "timestamp" },
		],
		cite: "date_trunc(field, source)",
	},
	date_part: {
		name: "date_part",
		params: [
			{ name: "field", type: "text" },
			{ name: "source", type: "timestamp" },
		],
		cite: "date_part(field, source)",
	},
	date_bin: {
		name: "date_bin",
		params: [
			{ name: "stride", type: "interval" },
			{ name: "source", type: "timestamp" },
			{ name: "origin", type: "timestamp" },
		],
		cite: "date_bin(stride, source, origin)",
	},
	make_date: {
		name: "make_date",
		params: [
			{ name: "year", type: "int" },
			{ name: "month", type: "int" },
			{ name: "day", type: "int" },
		],
		cite: "make_date(year, month, day)",
	},
	make_interval: {
		name: "make_interval",
		params: [
			{ name: "years", type: "int", optional: true },
			{ name: "months", type: "int", optional: true },
			{ name: "weeks", type: "int", optional: true },
			{ name: "days", type: "int", optional: true },
			{ name: "hours", type: "int", optional: true },
			{ name: "mins", type: "int", optional: true },
			{ name: "secs", type: "double precision", optional: true },
		],
		cite: "make_interval( [years int [, months int [, weeks int [, days int [, hours int [, mins int [, secs double precision]]]]]]] ) - ALL seven params optional (7-deep nested <optional> chain in the doc)",
	},
	to_date: {
		name: "to_date",
		params: [
			{ name: "text", type: "text" },
			{ name: "format", type: "text" },
		],
		cite: "to_date(text, format)",
	},
	to_timestamp: {
		name: "to_timestamp",
		params: [
			{ name: "text", type: "text" },
			{ name: "format", type: "text" },
		],
		cite: "to_timestamp(text, format)",
	},
	to_char: {
		name: "to_char",
		params: [{ name: "value" }, { name: "format", type: "text" }],
		cite: "to_char(value, format)",
	},
	to_number: {
		name: "to_number",
		params: [
			{ name: "text", type: "text" },
			{ name: "format", type: "text" },
		],
		cite: "to_number(text, format)",
	},
	// string - functions-string.html (Table 9.10)
	concat: { name: "concat", params: [{ name: "val" }], variadic: true, cite: "concat(val1, val2, …)" },
	concat_ws: {
		name: "concat_ws",
		params: [{ name: "sep", type: "text" }, { name: "val" }],
		variadic: true,
		cite: "concat_ws(sep, val…)",
	},
	// The manual shows the positional comma form only under substr, but the server catalog is the
	// ground truth and settles it: pg_proc.dat (REL_18_STABLE) carries substring(text, int4, int4)
	// (oid 936, prosrc text_substr) AND substring(text, int4) (oid 937, text_substr_no_len), so the
	// positional call is real and count is omittable. Verified 2026-07-14.
	substring: {
		name: "substring",
		params: [
			{ name: "string", type: "text" },
			{ name: "start", type: "int" },
			{ name: "count", type: "int", optional: true },
		],
		cite: "substring(string, start [, count]) - pg_proc oids 936/937",
	},
	substr: {
		name: "substr",
		params: [
			{ name: "string", type: "text" },
			{ name: "start", type: "int" },
			{ name: "count", type: "int", optional: true },
		],
		cite: "substr(string, start[, count]) - count is trailing-optional in both the text and bytea overloads",
	},
	split_part: {
		name: "split_part",
		params: [
			{ name: "string", type: "text" },
			{ name: "delimiter", type: "text" },
			{ name: "n", type: "int" },
		],
		cite: "split_part(string, delimiter, n)",
	},
	replace: {
		name: "replace",
		params: [
			{ name: "string", type: "text" },
			{ name: "from", type: "text" },
			{ name: "to", type: "text" },
		],
		cite: "replace(string, from, to)",
	},
	regexp_replace: {
		name: "regexp_replace",
		params: [
			{ name: "string", type: "text" },
			{ name: "pattern", type: "text" },
			{ name: "replacement", type: "text" },
			{ name: "flags", type: "text", optional: true },
		],
		cite: "regexp_replace(string, pattern, replacement [, flags])",
	},
	regexp_match: {
		name: "regexp_match",
		params: [
			{ name: "string", type: "text" },
			{ name: "pattern", type: "text" },
			{ name: "flags", type: "text", optional: true },
		],
		cite: "regexp_match(string, pattern [, flags])",
	},
	lpad: {
		name: "lpad",
		params: [
			{ name: "string", type: "text" },
			{ name: "length", type: "int" },
			{ name: "fill", type: "text", optional: true },
		],
		cite: "lpad(string, length[, fill])",
	},
	rpad: {
		name: "rpad",
		params: [
			{ name: "string", type: "text" },
			{ name: "length", type: "int" },
			{ name: "fill", type: "text", optional: true },
		],
		cite: "rpad(string, length[, fill])",
	},
	position: {
		name: "position",
		params: [
			{ name: "substring", type: "text" },
			{ name: "string", type: "text" },
		],
		cite: "position(substring in string)",
	},
	strpos: {
		name: "strpos",
		params: [
			{ name: "string", type: "text" },
			{ name: "substring", type: "text" },
		],
		cite: "strpos(string, substring)",
	},
	left: {
		name: "left",
		params: [
			{ name: "string", type: "text" },
			{ name: "n", type: "int" },
		],
		cite: "left(string, n)",
	},
	right: {
		name: "right",
		params: [
			{ name: "string", type: "text" },
			{ name: "n", type: "int" },
		],
		cite: "right(string, n)",
	},
	format: {
		name: "format",
		params: [
			{ name: "formatstr", type: "text" },
			{ name: "formatarg", optional: true },
		],
		variadic: true,
		cite: "format(formatstr [, formatarg, …]) - formatarg optional, format('hello') alone is valid",
	},
	string_to_array: {
		name: "string_to_array",
		params: [
			{ name: "string", type: "text" },
			{ name: "delimiter", type: "text" },
			{ name: "null_string", type: "text", optional: true },
		],
		cite: "string_to_array(string, delimiter [, null_string])",
	},
	// numeric - functions-math.html (Table 9.5)
	round: {
		name: "round",
		params: [
			{ name: "v", type: "numeric" },
			{ name: "s", type: "int", optional: true },
		],
		cite: "round(v numeric [, s int])",
	},
	trunc: {
		name: "trunc",
		params: [
			{ name: "v", type: "numeric" },
			{ name: "s", type: "int", optional: true },
		],
		cite: "trunc(v numeric [, s int])",
	},
	abs: { name: "abs", params: [{ name: "x", type: "numeric" }], cite: "abs(x)" },
	ceil: { name: "ceil", params: [{ name: "x", type: "numeric" }], cite: "ceil(x)" },
	floor: { name: "floor", params: [{ name: "x", type: "numeric" }], cite: "floor(x)" },
	power: {
		name: "power",
		params: [
			{ name: "a", type: "numeric" },
			{ name: "b", type: "numeric" },
		],
		cite: "power(a, b)",
	},
	mod: {
		name: "mod",
		params: [
			{ name: "y", type: "numeric" },
			{ name: "x", type: "numeric" },
		],
		cite: "mod(y, x)",
	},
	div: {
		name: "div",
		params: [
			{ name: "y", type: "numeric" },
			{ name: "x", type: "numeric" },
		],
		cite: "div(y, x)",
	},
	width_bucket: {
		name: "width_bucket",
		params: [
			{ name: "operand", type: "numeric" },
			{ name: "low", type: "numeric" },
			{ name: "high", type: "numeric" },
			{ name: "count", type: "int" },
		],
		cite: "width_bucket(operand, low, high, count)",
	},
	// conditional - functions-conditional.html
	coalesce: { name: "coalesce", params: [{ name: "value" }], variadic: true, cite: "COALESCE(value…)" },
	nullif: { name: "nullif", params: [{ name: "value1" }, { name: "value2" }], cite: "NULLIF(value1, value2)" },
	greatest: { name: "greatest", params: [{ name: "value" }], variadic: true, cite: "GREATEST(value…)" },
	least: { name: "least", params: [{ name: "value" }], variadic: true, cite: "LEAST(value…)" },
	// aggregates - functions-aggregate.html (Table 9.62)
	count: { name: "count", params: [{ name: "expression" }], cite: "count(expression)" },
	sum: { name: "sum", params: [{ name: "expression", type: "numeric" }], cite: "sum(expression)" },
	avg: { name: "avg", params: [{ name: "expression", type: "numeric" }], cite: "avg(expression)" },
	min: { name: "min", params: [{ name: "expression" }], cite: "min(expression)" },
	max: { name: "max", params: [{ name: "expression" }], cite: "max(expression)" },
	string_agg: {
		name: "string_agg",
		params: [
			{ name: "value", type: "text" },
			{ name: "delimiter", type: "text" },
		],
		cite: "string_agg(value, delimiter)",
	},
	array_agg: { name: "array_agg", params: [{ name: "expression" }], cite: "array_agg(expression)" },
	// JSON - functions-json.html
	jsonb_set: {
		name: "jsonb_set",
		params: [
			{ name: "target", type: "jsonb" },
			{ name: "path", type: "text[]" },
			{ name: "new_value", type: "jsonb" },
			{ name: "create_if_missing", type: "boolean", optional: true },
		],
		cite: "jsonb_set(target, path, new_value [, create_if_missing])",
	},
	jsonb_extract_path: {
		name: "jsonb_extract_path",
		params: [
			{ name: "from_json", type: "jsonb" },
			{ name: "path_elems", type: "text" },
		],
		variadic: true,
		cite: "jsonb_extract_path(from_json, VARIADIC path_elems)",
	},
	json_build_object: {
		name: "json_build_object",
		params: [{ name: "arg" }],
		variadic: true,
		cite: "json_build_object(VARIADIC args)",
	},
};
