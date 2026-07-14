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
	// string - functions-string.html (Table 9.10). concat/concat_ws/substr/regexp_replace deleted
	// 2026-07-14: the harvest independently reaches the same (or a richer) arity now - concat's own
	// pg_proc-cited min-1 reading is what the harvest reaches on its own (val1 required, val2
	// optional, variadic), and substr/regexp_replace's own hand shape is now just ONE of the
	// harvest's own overloads (harvest adds a real bytea overload for substr, and a 6-param
	// start/N/flags overload for regexp_replace, beyond what either override alone supplied).
	// The manual shows the positional comma form only under substr, but the server catalog is the
	// ground truth and settles it: pg_proc.dat (REL_18_STABLE) carries substring(text, int4, int4)
	// (oid 936, prosrc text_substr) AND substring(text, int4) (oid 937, text_substr_no_len), so the
	// positional call is real and count is omittable. Verified 2026-07-14. No offline harvest source
	// at all for SUBSTRING (its own syntax uses "string FROM start FOR count", the FROM/FOR keywords
	// the flat-list model blocks).
	substring: {
		name: "substring",
		params: [
			{ name: "string", type: "text" },
			{ name: "start", type: "int" },
			{ name: "count", type: "int", optional: true },
		],
		cite: "substring(string, start [, count]) - pg_proc oids 936/937",
	},
	// split_part/regexp_replace/lpad/rpad/left/right/format deleted 2026-07-14: typed-duplicates
	// (split_part/lpad/rpad/left/right/format) or superseded by a richer harvest (regexp_replace, see
	// above). No offline harvest source at all for POSITION (its syntax uses "substring IN string",
	// the IN keyword the flat-list model blocks).
	position: {
		name: "position",
		params: [
			{ name: "substring", type: "text" },
			{ name: "string", type: "text" },
		],
		cite: "position(substring in string)",
	},
	// numeric - functions-math.html (Table 9.5). mod deleted 2026-07-14 as a typed-duplicate.
	abs: { name: "abs", params: [{ name: "x", type: "numeric" }], cite: "abs(x)" },
	// aggregates - functions-aggregate.html (Table 9.62)
	count: { name: "count", params: [{ name: "expression" }], cite: "count(expression)" },
	min: { name: "min", params: [{ name: "expression" }], cite: "min(expression)" },
	max: { name: "max", params: [{ name: "expression" }], cite: "max(expression)" },
	// no offline harvest source at all for ARRAY_AGG (its syntax uses an "[ORDER BY ...]" clause the
	// flat-list model blocks).
	array_agg: { name: "array_agg", params: [{ name: "expression" }], cite: "array_agg(expression)" },
	// JSON - functions-json.html. jsonb_extract_path deleted 2026-07-14 as a typed-duplicate.
	json_build_object: {
		name: "json_build_object",
		params: [{ name: "arg" }],
		variadic: true,
		cite: "json_build_object(VARIADIC args)",
	},
};
