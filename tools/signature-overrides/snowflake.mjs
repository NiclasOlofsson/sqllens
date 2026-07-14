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
/** @typedef {{ name: string, params: ParamSig[], variadic?: boolean, cite: string }} OverrideSig */

/** @type {Record<string, OverrideSig>} */
export const OVERRIDES = {
	dateadd: {
		name: "DATEADD",
		params: [{ name: "date_or_time_part" }, { name: "value", type: "integer" }, { name: "date_or_time_expr" }],
		cite: "DATEADD",
	},
	datediff: {
		name: "DATEDIFF",
		params: [{ name: "date_or_time_part" }, { name: "date_or_time_expr1" }, { name: "date_or_time_expr2" }],
		cite: "DATEDIFF",
	},
	date_part: {
		name: "DATE_PART",
		params: [{ name: "date_or_time_part" }, { name: "date_or_time_expr" }],
		cite: "DATE_PART",
	},
	date_trunc: {
		name: "DATE_TRUNC",
		params: [{ name: "date_or_time_part" }, { name: "date_or_time_expr" }],
		cite: "DATE_TRUNC",
	},
	to_date: {
		name: "TO_DATE",
		params: [{ name: "expr" }, { name: "format", type: "string", optional: true }],
		cite: "TO_DATE , DATE (format optional)",
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
	concat: { name: "CONCAT", params: [{ name: "expr", type: "string" }], variadic: true, cite: "CONCAT (variadic)" },
	concat_ws: {
		name: "CONCAT_WS",
		params: [
			{ name: "separator", type: "string" },
			{ name: "expr", type: "string" },
		],
		variadic: true,
		cite: "CONCAT_WS",
	},
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
	replace: {
		name: "REPLACE",
		params: [
			{ name: "subject", type: "string" },
			{ name: "pattern", type: "string" },
			{ name: "replacement", type: "string", optional: true },
		],
		cite: "REPLACE (replacement optional → '')",
	},
	trim: {
		name: "TRIM",
		params: [
			{ name: "expr", type: "string" },
			{ name: "characters", type: "string", optional: true },
		],
		cite: "TRIM (characters optional)",
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
	regexp_replace: {
		name: "REGEXP_REPLACE",
		params: [
			{ name: "subject", type: "string" },
			{ name: "pattern", type: "string" },
			{ name: "replacement", type: "string", optional: true },
			{ name: "position", type: "integer", optional: true },
			{ name: "occurrence", type: "integer", optional: true },
			{ name: "parameters", type: "string", optional: true },
		],
		cite: "REGEXP_REPLACE",
	},
	// conditional / null
	coalesce: {
		name: "COALESCE",
		params: [{ name: "expr1" }, { name: "expr2" }],
		variadic: true,
		cite: "COALESCE (min 2, then variadic) - COALESCE( <expr1> , <expr2> [ , ... , <exprN> ] )",
	},
	nvl: { name: "NVL", params: [{ name: "expr1" }, { name: "expr2" }], cite: "NVL" },
	ifnull: { name: "IFNULL", params: [{ name: "expr1" }, { name: "expr2" }], cite: "IFNULL" },
	nullif: { name: "NULLIF", params: [{ name: "expr1" }, { name: "expr2" }], cite: "NULLIF" },
	iff: {
		name: "IFF",
		params: [{ name: "condition", type: "boolean" }, { name: "expr1" }, { name: "expr2" }],
		cite: "IFF",
	},
	decode: {
		name: "DECODE",
		params: [{ name: "expr" }, { name: "search" }, { name: "result" }],
		variadic: true,
		cite: "DECODE (variadic search/result)",
	},
	// numeric
	round: {
		name: "ROUND",
		params: [
			{ name: "input_expr", type: "numeric" },
			{ name: "scale_expr", type: "integer", optional: true },
			{ name: "rounding_mode", type: "string", optional: true },
		],
		cite: "ROUND (scale + rounding_mode optional)",
	},
	abs: { name: "ABS", params: [{ name: "expr", type: "numeric" }], cite: "ABS" },
	ceil: {
		name: "CEIL",
		params: [
			{ name: "input_expr", type: "numeric" },
			{ name: "scale_expr", type: "integer", optional: true },
		],
		cite: "CEIL (scale optional)",
	},
	floor: {
		name: "FLOOR",
		params: [
			{ name: "input_expr", type: "numeric" },
			{ name: "scale_expr", type: "integer", optional: true },
		],
		cite: "FLOOR (scale optional)",
	},
	power: {
		name: "POWER",
		params: [
			{ name: "base", type: "numeric" },
			{ name: "exponent", type: "numeric" },
		],
		cite: "POWER",
	},
	mod: {
		name: "MOD",
		params: [
			{ name: "expr1", type: "numeric" },
			{ name: "expr2", type: "numeric" },
		],
		cite: "MOD",
	},
	// aggregate
	count: {
		name: "COUNT",
		params: [{ name: "expr1" }, { name: "expr2", optional: true }],
		variadic: true,
		cite: 'COUNT([DISTINCT] expr1[, expr2, ...]) - multi-column count: "expr2 You can include additional column name(s)"',
	},
	sum: { name: "SUM", params: [{ name: "expr", type: "numeric" }], cite: "SUM" },
	avg: { name: "AVG", params: [{ name: "expr", type: "numeric" }], cite: "AVG" },
	min: { name: "MIN", params: [{ name: "expr" }], cite: "MIN" },
	max: { name: "MAX", params: [{ name: "expr" }], cite: "MAX" },
	listagg: {
		name: "LISTAGG",
		params: [
			{ name: "expr", type: "string" },
			{ name: "delimiter", type: "string", optional: true },
		],
		cite: 'LISTAGG([DISTINCT] expr1[, delimiter]) - "If no delimiter is specified, an empty string is used"',
	},
	// to_char / to_varchar - functions/to_char/1.txt documents four segments back-to-back with no
	// blank-line separator (TO_CHAR(<expr>) / TO_CHAR(<numeric_expr>[, '<format>']) /
	// TO_CHAR(<date_or_time_expr>[, '<format>']) / TO_CHAR(<binary_expr>[, '<format>'])), and the
	// harvester's per-segment scan only ever parses the FIRST call-shaped line of a segment, so it
	// kept only the bare 1-arg form and silently dropped the other three - which are the same shape
	// (expr, format optional) under different per-type param names. Real calls like
	// TO_CHAR(TO_BINARY(c1,'hex'), 'base64') and TO_VARCHAR(date1, 'dd-mon-yyyy hh:mi:ss') are the
	// genuine 2-arg form.
	to_char: {
		name: "TO_CHAR",
		params: [{ name: "expr" }, { name: "format", type: "string", optional: true }],
		cite: "TO_CHAR(<expr>) | TO_CHAR(<numeric_expr|date_or_time_expr|binary_expr>[, '<format>'])",
	},
	to_varchar: {
		name: "TO_VARCHAR",
		params: [{ name: "expr" }, { name: "format", type: "string", optional: true }],
		cite: "TO_VARCHAR(<expr>) | TO_VARCHAR(<numeric_expr|date_or_time_expr|binary_expr>[, '<format>'])",
	},
	// ai_count_tokens - functions/ai_count_tokens/{1,2}.txt document seven shapes whose arity and
	// meaning both hinge on the literal <function_name> value being counted for: the generic form
	// (function_name, [model_name,] input_text, [options,] [return_error_details]) spans 2-5 args,
	// and three named forms carry their own fixed arity - 'ai_similarity' takes two input texts plus
	// options (4-5), 'ai_classify' takes input_text + categories (2-3), 'ai_translate' takes
	// input_text + source_language + target_language (3-4). No flat param list represents this; the
	// harvester's per-segment-first-line scan kept only the first generic 2-3-arg line. Real calls
	// like AI_COUNT_TOKENS('ai_similarity', text1, text2, {...}) (4 args) and
	// AI_COUNT_TOKENS('ai_translate', text, 'en', 'de') (4 args) are genuine under the named forms.
	ai_count_tokens: {
		suppress: true,
		cite: "AI_COUNT_TOKENS - arity depends on the literal function_name arg (generic 2-5, 'ai_similarity' 4-5, 'ai_classify' 2-3, 'ai_translate' 3-4) - non-mergeable, functions/ai_count_tokens/{1,2}.txt",
	},
	// timestamp_from_parts - functions/timestamp_from_parts/1.txt documents two non-mergeable forms:
	// (year, month, day, hour, minute, second[, nanosecond][, time_zone]) (6-8 args, two SIBLING
	// optional-bracket groups the harvester's chain parser can't walk, since it treats a second `[`
	// as nesting inside the first rather than following it, so this form never becomes a candidate)
	// and (date_expr, time_expr) (2 args, the harvest's sole survivor). Real calls like
	// timestamp_from_parts(2013, 4, 5, 12, 0, -3600) (6 args) are genuine under the first form.
	timestamp_from_parts: {
		suppress: true,
		cite: "TIMESTAMP_FROM_PARTS(year,month,day,hour,minute,second[,nanosecond][,time_zone]) 6-8 args vs TIMESTAMP_FROM_PARTS(date_expr,time_expr) 2 args - non-mergeable, functions/timestamp_from_parts/1.txt",
	},
	// object_pick - functions/object_pick/1.txt documents two non-mergeable forms: (object, key1[,
	// key2, ...]) (a variadic scalar key list, min 2 args) and (object, array) (a single array
	// standing in for the whole key list, exactly 2 args). The harvest kept only the array form.
	// The corpus's OBJECT_PICK(obj, 'a', 'b') (3 args) is genuine under the variadic-keys form.
	object_pick: {
		suppress: true,
		cite: "OBJECT_PICK(object, key1[, key2, ...]) variadic keys vs OBJECT_PICK(object, array) single array - non-mergeable, functions/object_pick/1.txt",
	},
};
