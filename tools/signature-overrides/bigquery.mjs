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
/** @typedef {{ params: ParamSig[], variadic?: boolean }} OverloadSig */
/** An entry expresses either ONE shape (legacy, still the common case) or an explicit multi-overload
 *  set via `overloads` - either way it replaces the WHOLE overload set for its key. `suppress: true`
 *  drops the name entirely: no flat overload set can represent it (never guessed at). */
/** @typedef {{ name: string, params: ParamSig[], variadic?: boolean, cite: string } | { name: string, overloads: OverloadSig[], cite: string } | { suppress: true, cite: string }} OverrideSig */

/** @type {Record<string, OverrideSig>} */
export const OVERRIDES = {
	// date_diff/timestamp_diff/parse_date/format_date deleted 2026-07-14: the harvest reaches the
	// exact same names/arity/optionality on its own (typed-duplicate; the types above were the only
	// contribution). date_add/date_sub keep no override here at all - BigQuery has no offline harvest
	// source for either (their syntax fences use the INTERVAL clause keyword the flat-list model
	// blocks), so DATE_ADD/DATE_SUB carry no signature entry today.
	// string - substr/substring/split/replace/lpad/rpad/regexp_replace/regexp_extract deleted
	// 2026-07-14 as typed-duplicates (the harvest reaches the exact same names/arity/optionality on
	// its own; the types above were the only contribution).
	concat: { name: "CONCAT", params: [{ name: "value", type: "STRING" }], variadic: true, cite: "CONCAT (variadic)" },
	trim: {
		name: "TRIM",
		params: [
			{ name: "value", type: "STRING" },
			{ name: "chars_to_trim", type: "STRING", optional: true },
		],
		cite: "TRIM (chars optional)",
	},
	// conditional / null - if deleted 2026-07-14 as a typed-duplicate (same reasoning); no offline
	// harvest source at all for SAFE_CAST/CAST (their syntax uses "expr AS typename", the AS keyword
	// the flat-list model blocks as a clause).
	safe_cast: { name: "SAFE_CAST", params: [{ name: "expression" }, { name: "typename" }], cite: "SAFE_CAST" },
	cast: { name: "CAST", params: [{ name: "expression" }, { name: "typename" }], cite: "CAST" },
	// numeric - round/ceil/floor/power/mod deleted 2026-07-14 as typed-duplicates.
	// abs was deleted 2026-07-14 as a typed-duplicate too, then RESTORED: check-calls.ts's operand-type
	// check only ever trusts a curated-origin, single-overload signature (src/qualify/check-calls.ts
	// line ~187), so dropping the type silently disabled the ABS('x') string->numeric diagnostic -
	// tests/qualify.calls.test.ts > "BigQuery flags ABS('x')" failed.
	abs: { name: "ABS", params: [{ name: "X", type: "numeric" }], cite: "ABS" },
	// No offline harvest source at all for the aggregates below (their syntax fences use the DISTINCT
	// clause keyword the flat-list model blocks).
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
	// json_extract / json_query - json_functions.md's own syntax fences show json_path as REQUIRED in
	// both overloads (json_string_expr, json_path) and (json_expr, json_path); both functions are
	// documented "deprecated" (JSON_EXTRACT in favor of JSON_QUERY, and JSON_QUERY itself superseded by
	// JSON_VALUE for scalar extraction) and the sibling JSON_EXTRACT_ARRAY/JSON_VALUE family already
	// documents json_path as optional. Corpus-proven 2026-07-14: the ZetaSQL analyzer corpus's own
	// positive tests call both with json_path omitted (collation_81.sql: `json_extract(string_ci)`,
	// collation_85.sql: `json_query(string_ci)`), so the real engine accepts the 1-arg form even though
	// the doc's syntax fence doesn't bracket it - corpus ground truth wins over the literal fence.
	json_extract: {
		name: "JSON_EXTRACT",
		overloads: [
			{ params: [{ name: "json_string_expr" }, { name: "json_path", optional: true }] },
			{ params: [{ name: "json_expr" }, { name: "json_path", optional: true }] },
		],
		cite: "JSON_EXTRACT(json_string_expr[, json_path]) / JSON_EXTRACT(json_expr[, json_path]) - json_path optional per the ZetaSQL analyzer corpus (collation_81.sql), json_functions.md",
	},
	json_query: {
		name: "JSON_QUERY",
		overloads: [
			{ params: [{ name: "json_string_expr" }, { name: "json_path", optional: true }] },
			{ params: [{ name: "json_expr" }, { name: "json_path", optional: true }] },
		],
		cite: "JSON_QUERY(json_string_expr[, json_path]) / JSON_QUERY(json_expr[, json_path]) - json_path optional per the ZetaSQL analyzer corpus (collation_85.sql), json_functions.md",
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
