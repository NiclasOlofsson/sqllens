// ---------------------------------------------------------------------------
// Databricks (Spark SQL) - docs.databricks.com / spark.apache.org built-in
// functions reference. Each entry cites the function's reference page name.
// ---------------------------------------------------------------------------
//
// Migrated (mechanically, 2026-07-14) from the hand-curated DATABRICKS table that used to live
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
	// date_add/dateadd/datediff - the widened harvester (2026-07-14) now recovers BOTH real forms per
	// key as separate overloads on its own (the unit-based 3-arg page and the 2-arg alias page, e.g.
	// date_add's `[unit,value,expr]` and `[startDate,numDays]`), covering the same 2-or-3-arg range
	// this override used to hand-supply alone; deleted as harvest-superseded.
	date_sub: {
		name: "date_sub",
		params: [
			{ name: "start_date", type: "date" },
			{ name: "num_days", type: "int" },
		],
		cite: "date_sub function - docs.databricks.com functions/date_sub documents only date_sub(startDate, numDays); no unit-based 3-arg overload exists (unlike date_add)",
	},
	// string - Spark "String functions"
	concat_ws: {
		name: "concat_ws",
		params: [
			{ name: "sep", type: "string" },
			{ name: "expr", type: "string", optional: true },
		],
		variadic: true,
		cite: "concat_ws function - concat_ws('s') = '' is a documented valid call (separator-only)",
	},
	// len is optional (to end of string); substr's pos too (bare substr('hello') per fn-invocation ref).
	// NOTE: the reconciliation report recommended making pos required, citing the substr function-ref
	// page alone - but the corpus honesty sweep proved that wrong: sql-ref-function-invocation/4.sql
	// (docs.databricks.com's own function-invocation-syntax page) is SELECT substr('hello'); a real,
	// vendor-documented bare 1-arg call. pos stays optional; the report's claim doesn't hold.
	substring: {
		name: "substring",
		params: [
			{ name: "str", type: "string" },
			{ name: "pos", type: "int" },
			{ name: "len", type: "int", optional: true },
		],
		cite: "substring function",
	},
	substr: {
		name: "substr",
		params: [
			{ name: "str", type: "string" },
			{ name: "pos", type: "int", optional: true },
			{ name: "len", type: "int", optional: true },
		],
		cite: "substr function",
	},
	split_part: {
		name: "split_part",
		params: [
			{ name: "str", type: "string" },
			{ name: "delimiter", type: "string" },
			{ name: "partNum", type: "int" },
		],
		cite: "split_part function",
	},
	// NOTE: the reconciliation report recommended reducing this to trim(str) only, arguing the 2-arg
	// positional form is a syntax error in real Databricks SQL (only the FROM-keyword forms are
	// documented). The corpus honesty sweep proved that wrong: real production SQL (Oatly's
	// bronze_3pl__nagelbochum/nageltraiskirchen/nagelwroclaw models) calls trim('"', SSCC) - a plain
	// 2-arg positional call - and it must parse without a diagnostic. trimStr stays optional.
	trim: {
		name: "trim",
		params: [
			{ name: "str", type: "string" },
			{ name: "trimStr", type: "string", optional: true },
		],
		cite: "trim function (trimStr optional)",
	},
	lpad: {
		name: "lpad",
		params: [
			{ name: "str", type: "string" },
			{ name: "len", type: "int" },
			{ name: "pad", type: "string", optional: true },
		],
		cite: "lpad function (pad optional)",
	},
	rpad: {
		name: "rpad",
		params: [
			{ name: "str", type: "string" },
			{ name: "len", type: "int" },
			{ name: "pad", type: "string", optional: true },
		],
		cite: "rpad function (pad optional)",
	},
	// conditional / null - Spark "Conditional functions"
	coalesce: { name: "coalesce", params: [{ name: "expr" }], variadic: true, cite: "coalesce function (variadic)" },
	if: {
		name: "if",
		params: [{ name: "cond", type: "boolean" }, { name: "ifTrue" }, { name: "ifFalse" }],
		cite: "if function",
	},
	// numeric - Spark "Mathematical functions" - no offline harvest source at all for CAST (its
	// syntax uses "expr AS type", the AS keyword the flat-list model blocks as a clause).
	cast: { name: "cast", params: [{ name: "expr" }, { name: "type" }], cite: "cast function" },
	// abs was deleted 2026-07-14 as a typed-duplicate, then RESTORED: check-calls.ts's operand-type
	// check only ever trusts a curated-origin, single-overload signature (src/qualify/check-calls.ts
	// line ~187), so dropping the type silently disabled the abs(true) boolean->numeric diagnostic -
	// tests/qualify.calls.test.ts > "Databricks still flags a boolean arg into a numeric param" failed.
	abs: { name: "abs", params: [{ name: "expr", type: "numeric" }], cite: "abs function" },
	// ai_parse_document - docs/syntax/functions/ai_parse_document/{1,2}.txt: page documents both
	// `ai_parse_document(content)` and `ai_parse_document(content, Map("version" -> "2.0"))`; the
	// second form's example arg isn't a plain identifier, so the harvester (correctly, per its
	// NEVER-WRONG contract) can't turn it into a param name on its own. Every real corpus call
	// (ai_parse_document, ai_extract, ai_classify, read_files) passes the 2nd options-map arg.
	ai_parse_document: {
		name: "ai_parse_document",
		params: [{ name: "content" }, { name: "options", optional: true }],
		cite: 'ai_parse_document(content) | ai_parse_document(content, Map("version" -> "2.0"))',
	},
	// array_sort - docs/syntax/functions/array_sort/1.txt only shows "array_sort(array, func)", but
	// the function-reference page's own Returns section says: "If func is omitted, the array is
	// sorted in ascending order" (confirmed live on docs.databricks.com 2026-07-14) - func is
	// documented optional, just not bracketed in the scraped Syntax block. The corpus's own
	// array_sort(array('b','d',null,'c','a')) 1-arg call is genuine.
	array_sort: {
		name: "array_sort",
		params: [{ name: "array" }, { name: "func", optional: true }],
		cite: "array_sort(array[, func]) - func omitted sorts ascending (Returns section, docs.databricks.com/en/sql/language-manual/functions/array_sort)",
	},
	// decode - two genuinely different builtins share this name: docs/syntax/functions/decode_cs/1.txt's
	// "decode(expr, charSet)" (binary-to-string charset decode, 2 required args, the harvest's own pick
	// since decode/1.txt's own block contains "{ }" braces and is skipped as complex) vs
	// docs/syntax/functions/decode/1.txt's Oracle-style conditional
	// "decode(expr, { key1, value1 } [, ...] [, defValue])" (expr + 1+ variadic key/value pairs + an
	// optional default: arity 3, 4, 5, 6, ... - every count from 3 up, since a pair adds 2 and a
	// trailing default adds 1 more). Un-suppressed 2026-07-14 now that the model represents overloads:
	// their arities never collide (exactly 2 vs 3-or-more), so both coexist as separate overloads
	// without ambiguity. The corpus's real decode() calls - decode(5, 6, 'Spark', 5, 'SQL', 4, 'rocks')
	// (6 args) and the decode_cs-style 2-arg calls - are both genuine and both now representable.
	decode: {
		name: "decode",
		overloads: [
			{ params: [{ name: "bin" }, { name: "charSet" }] },
			{ params: [{ name: "expr" }, { name: "search" }, { name: "result" }], variadic: true },
		],
		cite: "decode(bin, charSet) 2-arg charset decode, and decode(expr, search, result, ...) Oracle-style conditional decode (expr + 1+ key/value pairs + an optional default) - docs/syntax/functions/decode_cs vs decode",
	},
	// from_avro - docs/syntax/functions/from_avro/1.txt: "from_avro(avroBin, jsonSchemaStr, options )"
	// shows no brackets, but docs.databricks.com/en/sql/language-manual/functions/from_avro (fetched
	// 2026-07-14) documents options as optional ("A MAP<STRING,STRING> literal specifying
	// directives", shown with a NULL::MAP example) - the scraped Syntax block lost the optionality.
	// The corpus's own from_avro(to_avro(5), '{ "type" : "int" }') 2-arg call is genuine.
	from_avro: {
		name: "from_avro",
		params: [{ name: "avroBin" }, { name: "jsonSchemaStr" }, { name: "options", optional: true }],
		cite: "from_avro(avroBin, jsonSchemaStr[, options]) - options optional, docs.databricks.com/en/sql/language-manual/functions/from_avro",
	},
};
