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
	date_bin: {
		name: "date_bin",
		params: [
			{ name: "stride", type: "interval" },
			{ name: "source", type: "timestamp" },
			{ name: "origin", type: "timestamp" },
		],
		cite: "date_bin(stride, source, origin)",
	},
	to_date: {
		name: "to_date",
		params: [
			{ name: "text", type: "text" },
			{ name: "format", type: "text" },
		],
		cite: "to_date(text, format)",
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
	concat: { name: "concat", params: [{ name: "val" }], variadic: true, cite: "concat(val, ...) - pg_proc oid 3058: one VARIADIC any slot, a 1-arg call is valid (the doc table just displays two slots)" },
	concat_ws: {
		name: "concat_ws",
		params: [{ name: "sep", type: "text" }, { name: "val" }],
		variadic: true,
		cite: "concat_ws(sep, val, ...) - pg_proc oid 3059: text plus VARIADIC any, minimum 2 args (kept over the harvest reading of the doc display slots)",
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
	// numeric - functions-math.html (Table 9.5)
	abs: { name: "abs", params: [{ name: "x", type: "numeric" }], cite: "abs(x)" },
	mod: {
		name: "mod",
		params: [
			{ name: "y", type: "numeric" },
			{ name: "x", type: "numeric" },
		],
		cite: "mod(y, x)",
	},
	// aggregates - functions-aggregate.html (Table 9.62)
	count: { name: "count", params: [{ name: "expression" }], cite: "count(expression)" },
	min: { name: "min", params: [{ name: "expression" }], cite: "min(expression)" },
	max: { name: "max", params: [{ name: "expression" }], cite: "max(expression)" },
	array_agg: { name: "array_agg", params: [{ name: "expression" }], cite: "array_agg(expression)" },
	// JSON - functions-json.html
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
