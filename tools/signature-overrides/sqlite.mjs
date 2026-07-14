// ---------------------------------------------------------------------------
// SQLite - sqlite.org/lang_corefunc.html, lang_aggfunc.html, lang_datefunc.html,
// lang_mathfunc.html; cites the page per entry. min()/max()/count()/sum()/total()/avg()/
// group_concat() are always lowered with the `aggregate` flag set (src/sqlite/lower.ts's
// AGGREGATES set is name-based, not arg-count-based), so the arity checker in
// src/qualify/check-calls.ts never applies these signatures to a call - the harvested entries
// exist purely for the signature-help hint. `log(X)` / `log(B,X)` needs no curated entry anymore:
// the two forms disagree on argument ORDER, not just optional trailing count, which a single
// ParamSig shape can't express - but the overload-set model represents exactly that, and the
// harvest now emits log's two documented forms as two separate overloads on its own.
//
// Pruned 2026-07-14 against the new sqlite/docs/syntax harvest (captured by
// tools/capture-sqlite-syntax.mjs, mined by tools/harvest-signatures.mjs's SQLite extractor):
// deleted 6 entries identical to the harvest (quote, pi, coalesce, ifnull, nullif, count), 20
// typed-duplicates whose only contribution over the harvest was type fields (substr, replace,
// trim, ltrim, rtrim, instr, soundex, round, abs, sign, hex, power, sqrt, mod, exp, ln, sum,
// total, avg, group_concat), and 2 whose harvested set became richer than the hand shape (min,
// max - the harvest reads the scalar min(X,Y,...) form's second slot). What survives is only what
// the harvest provably cannot produce (the datefunc pages' multi-word "time-value"/"modifier"
// params skip as multi-word-param) plus entries whose hand-authored param names still differ from
// the harvest (glob/like keep the pattern/string naming that disambiguates the reversed operator
// argument order; printf/iif keep their descriptive names over the doc's FORMAT/B1/V1).
// ---------------------------------------------------------------------------
//
// Migrated (mechanically, 2026-07-14) from the hand-curated SQLITE table that used to live
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
	// date/time - lang_datefunc.html. No harvest exists for any of these seven: their doc phrases
	// use multi-word hyphenated params ("time-value", "modifier", "time-value-1") the flat-list
	// model skips as multi-word-param.
	date: {
		name: "date",
		params: [
			{ name: "time_value", type: "text" },
			{ name: "modifier", type: "text" },
		],
		variadic: true,
		cite: "date(time-value, modifier, ...)",
	},
	time: {
		name: "time",
		params: [
			{ name: "time_value", type: "text" },
			{ name: "modifier", type: "text" },
		],
		variadic: true,
		cite: "time(time-value, modifier, ...)",
	},
	datetime: {
		name: "datetime",
		params: [
			{ name: "time_value", type: "text" },
			{ name: "modifier", type: "text" },
		],
		variadic: true,
		cite: "datetime(time-value, modifier, ...)",
	},
	julianday: {
		name: "julianday",
		params: [
			{ name: "time_value", type: "text" },
			{ name: "modifier", type: "text" },
		],
		variadic: true,
		cite: "julianday(time-value, modifier, ...)",
	},
	unixepoch: {
		name: "unixepoch",
		params: [
			{ name: "time_value", type: "text" },
			{ name: "modifier", type: "text" },
		],
		variadic: true,
		cite: "unixepoch(time-value, modifier, ...)",
	},
	strftime: {
		name: "strftime",
		params: [
			{ name: "format", type: "text" },
			{ name: "time_value", type: "text" },
			{ name: "modifier", type: "text" },
		],
		variadic: true,
		cite: "strftime(format, time-value, modifier, ...)",
	},
	timediff: {
		name: "timediff",
		params: [
			{ name: "time_value_1", type: "text" },
			{ name: "time_value_2", type: "text" },
		],
		cite: "timediff(time-value-1, time-value-2)",
	},
	// operator-form functions - lang_corefunc.html. The harvest emits glob(X,Y) / like(X,Y[,Z]) with
	// the doc's own X/Y/Z names; the hand entries keep pattern/string naming because the argument
	// order is the REVERSE of the operator form ("Y GLOB X", "Y LIKE X [ESCAPE Z]") and bare X/Y in
	// a signature hint would hide exactly the confusion worth preventing.
	glob: {
		name: "glob",
		params: [
			{ name: "pattern", type: "text" },
			{ name: "string", type: "text" },
		],
		cite: 'glob(X,Y) ("Y GLOB X")',
	},
	like: {
		name: "like",
		params: [
			{ name: "pattern", type: "text" },
			{ name: "string", type: "text" },
			{ name: "escape", type: "text", optional: true },
		],
		cite: 'like(X,Y[,Z]) ("Y LIKE X [ESCAPE Z]")',
	},
	// string - lang_corefunc.html. The harvest's printf entry is the bare printf(FORMAT, ...) index
	// phrase; the hand entry keeps the descriptive format/args naming.
	printf: {
		name: "printf",
		params: [{ name: "format", type: "text" }, { name: "args" }],
		variadic: true,
		cite: "printf(FORMAT,...) - alias for format()",
	},
	// conditional - lang_corefunc.html. The harvest's iif entry is the doc's iif(B1,V1,...) repeat
	// notation; the hand entry keeps the descriptive condition/true_value/false_value naming.
	iif: {
		name: "iif",
		params: [{ name: "condition", type: "boolean" }, { name: "true_value" }, { name: "false_value" }],
		variadic: true,
		cite: "iif(B1,V1,B2,V2,...,else)",
	},
};
