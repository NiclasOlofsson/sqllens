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
/** @typedef {{ params: ParamSig[], variadic?: boolean }} OverloadSig */
/** An entry expresses either ONE shape (legacy, still the common case) or an explicit multi-overload
 *  set via `overloads` - either way it replaces the WHOLE overload set for its key. `suppress: true`
 *  drops the name entirely: no flat overload set can represent it (never guessed at). */
/** @typedef {{ name: string, params: ParamSig[], variadic?: boolean, cite: string } | { name: string, overloads: OverloadSig[], cite: string } | { suppress: true, cite: string }} OverrideSig */

/** @type {Record<string, OverrideSig>} */
export const OVERRIDES = {
	// date_trunc/date_add/date_diff/date_format/date_parse deleted 2026-07-14 as typed-duplicates
	// (the harvest reaches the exact same names/arity/optionality on its own; the types above were
	// the only contribution).
	at_timezone: {
		name: "at_timezone",
		params: [
			{ name: "timestamp", type: "timestamp" },
			{ name: "zone", type: "varchar" },
		],
		cite: "at_timezone(timestamp, zone)",
	},
	// string - functions/string.html. split/split_part/strpos/replace/format deleted 2026-07-14 as
	// typed-duplicates. No offline harvest source at all for CONCAT_WS (its own colon-fence line uses
	// a "string1, ..., stringN" mid-list ellipsis the variadic-not-trailing rule blocks).
	concat_ws: {
		name: "concat_ws",
		params: [
			{ name: "separator", type: "varchar" },
			{ name: "strings", type: "varchar" },
		],
		variadic: true,
		cite: 'concat_ws(separator, string1, ..., stringN) - a real variadic flag, not a cosmetic "..." in the type string',
	},
	// regexp - functions/regexp.html. regexp_like/regexp_extract deleted 2026-07-14 as
	// typed-duplicates.
	// json - functions/json.html. json_extract/json_extract_scalar/json_parse deleted 2026-07-14 as
	// typed-duplicates.
	// array - functions/array.html. No offline harvest source at all for ELEMENT_AT (its syntax uses
	// an "array(E) | map(K,V)" parenthesized-type alternation the flat-list model can't represent).
	element_at: {
		name: "element_at",
		params: [
			{ name: "collection", type: "array|map" },
			{ name: "key", type: "any" },
		],
		cite: "element_at(x, key)",
	},
	// array_join/sequence deleted 2026-07-14 as typed-duplicates. No offline harvest source at all for
	// TRANSFORM/REDUCE (their `:::{function}` fences use a parenthesized-type "array(T)" / lambda
	// arrow notation the flat-list model can't represent).
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
	// aggregate - functions/aggregate.html. count/sum/min/max/max_by/min_by/approx_distinct deleted
	// 2026-07-14 as typed-duplicates.
	listagg: {
		name: "listagg",
		params: [
			{ name: "expression", type: "varchar" },
			{ name: "separator", type: "varchar", optional: true },
		],
		cite: "listagg(expr[, separator]) WITHIN GROUP - separator is optional, defaults to the empty string when not specified",
	},
	// conditional - functions/conditional.html. coalesce/nullif/if deleted 2026-07-14 as
	// typed-duplicates.
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
