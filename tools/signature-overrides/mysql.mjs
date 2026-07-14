// ---------------------------------------------------------------------------
// MySQL - dev.mysql.com/doc/refman/8.4/en/, cites the function-reference page per entry. TRIM is
// deliberately NOT curated: MySQL's grammar gives it two structurally different shapes - a bare
// `TRIM(str)` (1 arg, the ordinary function-call path) and the `TRIM([{BOTH|LEADING|TRAILING}]
// [remstr] FROM str)` form (a dedicated grammar production) - a leading-optional/reordered shape
// that can't be curated without asserting a wrong arity for one form. The harvest emits nothing
// for it either: both captured doc lines carry the FROM clause form (string-functions/46.txt), so
// they skip as clause syntax under the NEVER-WRONG contract - TRIM stays name-only by design.
// DATE_ADD/DATE_SUB ARE curated: MySqlParser.g4's grammar folds their whole `INTERVAL expr unit`
// operand into a single expression (a dedicated `intervalExpressionAtom`), so the call is a
// genuine, arity-safe 2-argument form at the functionArgs level despite the multi-word SQL surface
// syntax.
//
// Pruned 2026-07-14 against the new mysql/docs/syntax harvest (captured by
// tools/capture-mysql-syntax.mjs, mined by tools/harvest-signatures.mjs's MySQL extractor):
// deleted 6 entries identical to the harvest (ifnull, nullif, coalesce, greatest, least, convert),
// 31 typed-duplicates whose only contribution over the harvest was type fields (substring, substr,
// left, right, lpad, rpad, replace, repeat, locate, instr, substring_index, insert, format, round,
// truncate, mod, pow, power, sqrt, ceiling, ceil, floor, rand, sign, abs, datediff, date_format,
// str_to_date, if, json_contains, json_keys), and 4 whose harvested set became richer than the
// hand shape (hex - the harvest emits the documented HEX(str)/HEX(N) polymorphic pair as two real
// overloads instead of one merged N_or_str param; concat, concat_ws, field - the harvest reads the
// documented multi-slot minimums). What survives is only what the harvest provably cannot produce
// (keyword-argument forms the NEVER-WRONG contract skips) plus one entry whose hand-authored param
// names still differ from the harvest (strcmp).
// ---------------------------------------------------------------------------
//
// Migrated (mechanically, 2026-07-14) from the hand-curated MYSQL table that used to live
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
	// string. The harvest names STRCMP's params expr1/expr2; the hand entry keeps the doc page's own
	// str1/str2 naming plus types (a naming difference, not a typed-duplicate).
	strcmp: {
		name: "STRCMP",
		params: [
			{ name: "str1", type: "string" },
			{ name: "str2", type: "string" },
		],
		cite: "STRCMP(str1,str2)",
	},
	// date/time - date-and-time-functions.html. No harvest exists for DATE_ADD/DATE_SUB: their doc
	// lines are `DATE_ADD(date,INTERVAL expr unit)`, whose INTERVAL keyword operand the flat-list
	// model skips as clause syntax (see the header note for why the 2-arg curated shape is
	// nevertheless arity-safe against the grammar).
	date_add: {
		name: "DATE_ADD",
		params: [
			{ name: "date", type: "date" },
			{ name: "expr", type: "interval" },
		],
		cite: "DATE_ADD(date, INTERVAL expr unit)",
	},
	date_sub: {
		name: "DATE_SUB",
		params: [
			{ name: "date", type: "date" },
			{ name: "expr", type: "interval" },
		],
		cite: "DATE_SUB(date, INTERVAL expr unit)",
	},
	// conversion - cast-functions.html (both CAST and CONVERT lower to a `cast` IR node, not a
	// `function` call, in src/mysql/lower.ts - this entry exists purely for the signature-help
	// token-scan, never reaching the arity checker). No harvest exists for CAST: its doc lines are
	// `CAST(expr AS type [ARRAY])` / `CAST(timestamp_value AT TIME ZONE ...)`, keyword forms the
	// flat-list model skips as clause syntax. CONVERT's own override was deleted in the prune above:
	// its comma form `CONVERT(expr,type)` harvests cleanly and identically (the USING form skips).
	cast: { name: "CAST", params: [{ name: "expr" }, { name: "type" }], cite: "CAST(expr AS type)" },
	// JSON - json-search-functions.html. No harvest exists for JSON_EXTRACT: its doc line is
	// `JSON_EXTRACT(json_doc, path[, path] ...)`, whose bracketed-repeat-then-ellipsis tail is a
	// non-trailing optional group the flat-list model can't represent.
	json_extract: {
		name: "JSON_EXTRACT",
		params: [
			{ name: "json_doc", type: "json" },
			{ name: "path", type: "string" },
		],
		variadic: true,
		cite: "JSON_EXTRACT(json_doc,path[,path]...)",
	},
};
