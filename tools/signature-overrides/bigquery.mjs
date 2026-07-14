// ---------------------------------------------------------------------------
// BigQuery (GoogleSQL) - cloud.google.com/bigquery/docs function reference.
// Cites the page per entry. DATE_ADD = (date, INTERVAL int part) - modelled
// here as (date_expression, interval) since the INTERVAL literal is one arg slot.
// ---------------------------------------------------------------------------
//
// Migrated (mechanically, 2026-07-14) from the hand-curated BIGQUERY table that used to live
// in src/signature/signatures.ts, into a plain-data override input for
// tools/harvest-signatures.mjs. An override wins by key over the harvest at generation time and
// is tagged origin "curated" in the emitted table; "cite" carries the original entry's doc
// citation forward into the generated table's comment.

/** @typedef {{ name: string, type?: string, optional?: boolean }} ParamSig */
/** @typedef {{ name: string, params: ParamSig[], variadic?: boolean, cite: string }} OverrideSig */

/** @type {Record<string, OverrideSig>} */
export const OVERRIDES = {
	date_add: {
		name: "DATE_ADD",
		params: [
			{ name: "date_expression", type: "DATE" },
			{ name: "interval", type: "INTERVAL" },
		],
		cite: "DATE_ADD",
	},
	date_sub: {
		name: "DATE_SUB",
		params: [
			{ name: "date_expression", type: "DATE" },
			{ name: "interval", type: "INTERVAL" },
		],
		cite: "DATE_SUB",
	},
	date_diff: {
		name: "DATE_DIFF",
		params: [{ name: "end_date", type: "DATE" }, { name: "start_date", type: "DATE" }, { name: "granularity" }],
		cite: "DATE_DIFF",
	},
	date_trunc: {
		name: "DATE_TRUNC",
		params: [{ name: "date_expression", type: "DATE" }, { name: "granularity" }],
		cite: "DATE_TRUNC",
	},
	timestamp_diff: {
		name: "TIMESTAMP_DIFF",
		params: [
			{ name: "end_timestamp", type: "TIMESTAMP" },
			{ name: "start_timestamp", type: "TIMESTAMP" },
			{ name: "granularity" },
		],
		cite: "TIMESTAMP_DIFF",
	},
	parse_date: {
		name: "PARSE_DATE",
		params: [
			{ name: "format_string", type: "STRING" },
			{ name: "date_string", type: "STRING" },
		],
		cite: "PARSE_DATE",
	},
	format_date: {
		name: "FORMAT_DATE",
		params: [
			{ name: "format_string", type: "STRING" },
			{ name: "date_expr", type: "DATE" },
		],
		cite: "FORMAT_DATE",
	},
	// string
	concat: { name: "CONCAT", params: [{ name: "value", type: "STRING" }], variadic: true, cite: "CONCAT (variadic)" },
	substr: {
		name: "SUBSTR",
		params: [
			{ name: "value", type: "STRING" },
			{ name: "position", type: "INT64" },
			{ name: "length", type: "INT64", optional: true },
		],
		cite: "SUBSTR (length optional)",
	},
	substring: {
		name: "SUBSTRING",
		params: [
			{ name: "value", type: "STRING" },
			{ name: "position", type: "INT64" },
			{ name: "length", type: "INT64", optional: true },
		],
		cite: "SUBSTRING (length optional)",
	},
	split: {
		name: "SPLIT",
		params: [
			{ name: "value", type: "STRING" },
			{ name: "delimiter", type: "STRING", optional: true },
		],
		cite: "SPLIT (delimiter optional → comma)",
	},
	replace: {
		name: "REPLACE",
		params: [
			{ name: "original_value", type: "STRING" },
			{ name: "from_pattern", type: "STRING" },
			{ name: "to_pattern", type: "STRING" },
		],
		cite: "REPLACE(original_value, from_pattern, to_pattern) - string_functions.md, from/to symmetry",
	},
	trim: {
		name: "TRIM",
		params: [
			{ name: "value", type: "STRING" },
			{ name: "chars_to_trim", type: "STRING", optional: true },
		],
		cite: "TRIM (chars optional)",
	},
	lpad: {
		name: "LPAD",
		params: [
			{ name: "original_value", type: "STRING" },
			{ name: "return_length", type: "INT64" },
			{ name: "pattern", type: "STRING", optional: true },
		],
		cite: "LPAD(original_value, return_length[, pattern]) - pattern optional, defaults to a blank space",
	},
	rpad: {
		name: "RPAD",
		params: [
			{ name: "original_value", type: "STRING" },
			{ name: "return_length", type: "INT64" },
			{ name: "pattern", type: "STRING", optional: true },
		],
		cite: "RPAD(original_value, return_length[, pattern]) - pattern optional, defaults to a blank space",
	},
	regexp_replace: {
		name: "REGEXP_REPLACE",
		params: [
			{ name: "value", type: "STRING" },
			{ name: "regexp", type: "STRING" },
			{ name: "replacement", type: "STRING" },
		],
		cite: "REGEXP_REPLACE",
	},
	regexp_extract: {
		name: "REGEXP_EXTRACT",
		params: [
			{ name: "value", type: "STRING" },
			{ name: "regexp", type: "STRING" },
			{ name: "position", type: "INT64", optional: true },
			{ name: "occurrence", type: "INT64", optional: true },
		],
		cite: "REGEXP_EXTRACT(value, regexp[, position[, occurrence]])",
	},
	// conditional / null
	coalesce: { name: "COALESCE", params: [{ name: "expr" }], variadic: true, cite: "COALESCE (variadic)" },
	ifnull: { name: "IFNULL", params: [{ name: "expr" }, { name: "null_result" }], cite: "IFNULL" },
	nullif: { name: "NULLIF", params: [{ name: "expr" }, { name: "expr_to_match" }], cite: "NULLIF" },
	if: {
		name: "IF",
		params: [{ name: "expr", type: "BOOL" }, { name: "true_result" }, { name: "else_result" }],
		cite: "IF",
	},
	safe_cast: { name: "SAFE_CAST", params: [{ name: "expression" }, { name: "typename" }], cite: "SAFE_CAST" },
	cast: { name: "CAST", params: [{ name: "expression" }, { name: "typename" }], cite: "CAST" },
	// numeric
	round: {
		name: "ROUND",
		params: [
			{ name: "X", type: "FLOAT64" },
			{ name: "N", type: "INT64", optional: true },
			{ name: "rounding_mode", optional: true },
		],
		cite: "ROUND (N + rounding_mode optional)",
	},
	abs: { name: "ABS", params: [{ name: "X", type: "numeric" }], cite: "ABS" },
	ceil: { name: "CEIL", params: [{ name: "X", type: "FLOAT64" }], cite: "CEIL" },
	floor: { name: "FLOOR", params: [{ name: "X", type: "FLOAT64" }], cite: "FLOOR" },
	power: {
		name: "POWER",
		params: [
			{ name: "X", type: "FLOAT64" },
			{ name: "Y", type: "FLOAT64" },
		],
		cite: "POWER",
	},
	mod: {
		name: "MOD",
		params: [
			{ name: "X", type: "INT64" },
			{ name: "Y", type: "INT64" },
		],
		cite: "MOD",
	},
	// aggregate
	count: { name: "COUNT", params: [{ name: "expression" }], cite: "COUNT" },
	sum: { name: "SUM", params: [{ name: "expression", type: "numeric" }], cite: "SUM" },
	avg: { name: "AVG", params: [{ name: "expression", type: "numeric" }], cite: "AVG" },
	min: { name: "MIN", params: [{ name: "expression" }], cite: "MIN" },
	max: { name: "MAX", params: [{ name: "expression" }], cite: "MAX" },
	array_agg: { name: "ARRAY_AGG", params: [{ name: "expression" }], cite: "ARRAY_AGG" },
	string_agg: {
		name: "STRING_AGG",
		params: [
			{ name: "expression", type: "STRING" },
			{ name: "delimiter", type: "STRING", optional: true },
		],
		cite: 'STRING_AGG(expression[, delimiter]) - "otherwise, a comma is used"',
	},
	// array_functions.md documents ARRAY(subquery) as a 1-arg function ("The ARRAY function returns
	// an ARRAY with one element for each row in a subquery"), but this dialect's lowering also names
	// the ARRAY<T>[...] / ARRAY[...] / bare [...] array-CONSTRUCTOR syntax "array", with each
	// element becoming a positional arg (so ARRAY<int64>[1,2,3] lowers to a 3-arg "array" call,
	// ARRAY<int32>[] to a 0-arg one, and so on for any element count) - a dual-nature name sharing
	// one lowering between a real 1-arg function and an unrelated 0..N-arg literal constructor. No
	// flat signature can represent both; real analyzer-corpus hits confirm both are genuine (e.g.
	// `select [1, 2, 3], ARRAY[1, 2, 3], ARRAY<int64>[1, 2, 3]` in array_construction_1.sql).
	array: {
		suppress: true,
		cite: "ARRAY(subquery) 1-arg function vs ARRAY<T>[...]/ARRAY[...]/[...] array-constructor literal (flattened to its element count by this dialect's lowering) - non-mergeable, array_functions.md",
	},
};
