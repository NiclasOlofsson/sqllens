// ---------------------------------------------------------------------------
// Snowflake - docs.snowflake.com SQL function reference. Cites the page per
// entry. DATEADD = (date_or_time_part, value, date_or_time_expr).
// ---------------------------------------------------------------------------
//
// Migrated (mechanically, 2026-07-14) from the hand-curated SNOWFLAKE table that used to live
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
	// dateadd, concat, concat_ws, to_date, to_char, to_varchar, ai_count_tokens deleted 2026-07-14:
	// the widened per-segment-repeat harvester now independently recovers a harvest at least as
	// rich as each of these hand shapes (dateadd's own arity/types match the harvest name-for-name;
	// concat's/concat_ws's own lax minimum is now what the harvest reaches on its own; to_date/to_char/
	// to_varchar's per-type overload sets - previously only the segment's first line - are now fully
	// recovered; ai_count_tokens's four hand-authored overloads are now the harvest's own four,
	// just in a different order).
	date_part: {
		name: "DATE_PART",
		params: [{ name: "date_or_time_part" }, { name: "date_or_time_expr" }],
		cite: "DATE_PART",
	},
	to_timestamp: {
		name: "TO_TIMESTAMP",
		params: [{ name: "expr" }, { name: "format", type: "string", optional: true }],
		cite: "TO_TIMESTAMP (format optional)",
	},
	timestampadd: {
		name: "TIMESTAMPADD",
		params: [{ name: "date_or_time_part" }, { name: "value", type: "integer" }, { name: "date_or_time_expr" }],
		cite: "TIMESTAMPADD",
	},
	last_day: {
		name: "LAST_DAY",
		params: [{ name: "date_or_time_expr" }, { name: "date_part", optional: true }],
		cite: "LAST_DAY (date_part optional)",
	},
	// string
	substr: {
		name: "SUBSTR",
		params: [
			{ name: "base_expr", type: "string" },
			{ name: "start_pos", type: "integer" },
			{ name: "length", type: "integer", optional: true },
		],
		cite: "SUBSTR , SUBSTRING (length optional)",
	},
	substring: {
		name: "SUBSTRING",
		params: [
			{ name: "base_expr", type: "string" },
			{ name: "start_pos", type: "integer" },
			{ name: "length", type: "integer", optional: true },
		],
		cite: "SUBSTRING (length optional)",
	},
	split_part: {
		name: "SPLIT_PART",
		params: [
			{ name: "string", type: "string" },
			{ name: "delimiter", type: "string" },
			{ name: "part_number", type: "integer" },
		],
		cite: "SPLIT_PART",
	},
	lpad: {
		name: "LPAD",
		params: [
			{ name: "base", type: "string" },
			{ name: "length", type: "integer" },
			{ name: "pad", type: "string", optional: true },
		],
		cite: "LPAD (pad optional)",
	},
	rpad: {
		name: "RPAD",
		params: [
			{ name: "base", type: "string" },
			{ name: "length", type: "integer" },
			{ name: "pad", type: "string", optional: true },
		],
		cite: "RPAD (pad optional)",
	},
	// conditional / null
	decode: {
		name: "DECODE",
		params: [{ name: "expr" }, { name: "search" }, { name: "result" }],
		variadic: true,
		cite: "DECODE (variadic search/result)",
	},
	// numeric - no offline harvest source at all for POWER (its syntax uses a "^" infix-operator
	// alternation the flat-list model can't represent).
	power: {
		name: "POWER",
		params: [
			{ name: "base", type: "numeric" },
			{ name: "exponent", type: "numeric" },
		],
		cite: "POWER",
	},
	// aggregate
	sum: { name: "SUM", params: [{ name: "expr", type: "numeric" }], cite: "SUM" },
	avg: { name: "AVG", params: [{ name: "expr", type: "numeric" }], cite: "AVG" },
	listagg: {
		name: "LISTAGG",
		params: [
			{ name: "expr", type: "string" },
			{ name: "delimiter", type: "string", optional: true },
		],
		cite: 'LISTAGG([DISTINCT] expr1[, delimiter]) - "If no delimiter is specified, an empty string is used"',
	},
	// to_char, to_varchar, ai_count_tokens deleted 2026-07-14: the widened per-segment-repeat
	// harvester (which now walks EVERY call-shaped line in a segment, not just the first) recovers
	// to_char's/to_varchar's four per-type overloads and ai_count_tokens's four generic-arity
	// overloads on its own - the exact shapes these three hand entries used to supply alone.
	// timestamp_from_parts - functions/timestamp_from_parts/1.txt documents two forms: (year, month,
	// day, hour, minute, second[, nanosecond][, time_zone]) (6-8 args, two SIBLING optional-bracket
	// groups the harvester's chain parser can't walk, since it treats a second `[` as nesting inside the
	// first rather than following it, so this form never became a harvested candidate) and
	// (date_expr, time_expr) (2 args, the harvest's sole survivor). Un-suppressed 2026-07-14: both forms
	// are hand-authored here as separate overloads (the harvester's own limitation, not a real
	// ambiguity). Real calls like timestamp_from_parts(2013, 4, 5, 12, 0, -3600) (6 args) are genuine
	// under the first form.
	timestamp_from_parts: {
		name: "TIMESTAMP_FROM_PARTS",
		overloads: [
			{
				params: [
					{ name: "year" },
					{ name: "month" },
					{ name: "day" },
					{ name: "hour" },
					{ name: "minute" },
					{ name: "second" },
					{ name: "nanosecond", optional: true },
					{ name: "time_zone", optional: true },
				],
			},
			{ params: [{ name: "date_expr" }, { name: "time_expr" }] },
		],
		cite: "TIMESTAMP_FROM_PARTS(year,month,day,hour,minute,second[,nanosecond][,time_zone]) 6-8 args, and TIMESTAMP_FROM_PARTS(date_expr,time_expr) 2 args - functions/timestamp_from_parts/1.txt",
	},
	// object_pick - functions/object_pick/1.txt documents two forms: (object, key1[, key2, ...]) (a
	// variadic scalar key list, min 2 args) and (object, array) (a single array standing in for the
	// whole key list, exactly 2 args). The harvest kept only the array form. Un-suppressed 2026-07-14:
	// their arity ranges (2+ and exactly 2) never conflict, so both coexist as separate overloads. The
	// corpus's OBJECT_PICK(obj, 'a', 'b') (3 args) is genuine under the variadic-keys form.
	object_pick: {
		name: "OBJECT_PICK",
		overloads: [
			{ params: [{ name: "object" }, { name: "key1" }], variadic: true },
			{ params: [{ name: "object" }, { name: "array" }] },
		],
		cite: "OBJECT_PICK(object, key1[, key2, ...]) variadic keys, and OBJECT_PICK(object, array) single array - functions/object_pick/1.txt",
	},
};
