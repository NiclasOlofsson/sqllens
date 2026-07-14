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
	// date_add/strptime/make_date deleted 2026-07-14 as typed-duplicates. time_bucket deleted
	// 2026-07-14: the harvest now independently resolves 7 real per-type overloads (date/timestamp/
	// timestamptz x offset/origin/timezone), a superset of this override's own single shape.
	// text - functions/text.md
	concat_ws: {
		name: "concat_ws",
		params: [{ name: "separator", type: "text" }, { name: "value" }],
		variadic: true,
		cite: "concat_ws(separator, value, ...)",
	},
	// substring/split_part/replace/lpad/rpad/left/right/starts_with/printf/format deleted
	// 2026-07-14 as typed-duplicates.
	// numeric - functions/numeric.md. round/trunc/abs/ceil/floor/power deleted 2026-07-14 as
	// typed-duplicates.
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
	// list_extract/list_contains/array_to_string/unnest deleted 2026-07-14 as typed-duplicates.
	// conditional - functions/utility.md
	if: {
		name: "if",
		params: [{ name: "condition", type: "boolean" }, { name: "a" }, { name: "b" }],
		cite: "if(condition, a, b)",
	},
	// aggregates - functions/aggregates.md. sum/avg/min/max/arg_max/arg_min/string_agg/quantile_cont
	// deleted 2026-07-14 as typed-duplicates.
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
