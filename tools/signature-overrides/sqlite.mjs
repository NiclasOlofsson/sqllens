// ---------------------------------------------------------------------------
// SQLite - sqlite.org/lang_corefunc.html, lang_aggfunc.html, lang_datefunc.html,
// lang_mathfunc.html; cites the page per entry. min()/max()/count()/sum()/total()/avg()/
// group_concat() are always lowered with the `aggregate` flag set (src/sqlite/lower.ts's
// AGGREGATES set is name-based, not arg-count-based), so the arity checker in
// src/qualify/check-calls.ts never applies these signatures to a call - they exist here purely
// for the signature-help hint. `log(X)` / `log(B,X)` is deliberately NOT curated: the two forms
// disagree on argument ORDER, not just optional trailing count, and this table's ParamSig can't
// express a leading-optional/reordered overload without asserting a wrong arity for one form.
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
	// string - lang_corefunc.html
	substr: {
		name: "substr",
		params: [
			{ name: "X", type: "text" },
			{ name: "Y", type: "int" },
			{ name: "Z", type: "int", optional: true },
		],
		cite: "substr(X,Y,Z) / substr(X,Y)",
	},
	replace: {
		name: "replace",
		params: [
			{ name: "X", type: "text" },
			{ name: "Y", type: "text" },
			{ name: "Z", type: "text" },
		],
		cite: "replace(X,Y,Z)",
	},
	trim: {
		name: "trim",
		params: [
			{ name: "X", type: "text" },
			{ name: "Y", type: "text", optional: true },
		],
		cite: "trim(X,Y)",
	},
	ltrim: {
		name: "ltrim",
		params: [
			{ name: "X", type: "text" },
			{ name: "Y", type: "text", optional: true },
		],
		cite: "ltrim(X,Y)",
	},
	rtrim: {
		name: "rtrim",
		params: [
			{ name: "X", type: "text" },
			{ name: "Y", type: "text", optional: true },
		],
		cite: "rtrim(X,Y)",
	},
	instr: {
		name: "instr",
		params: [
			{ name: "X", type: "text" },
			{ name: "Y", type: "text" },
		],
		cite: "instr(X,Y)",
	},
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
	printf: {
		name: "printf",
		params: [{ name: "format", type: "text" }, { name: "args" }],
		variadic: true,
		cite: "printf(FORMAT,...) - alias for format()",
	},
	quote: { name: "quote", params: [{ name: "X" }], cite: "quote(X)" },
	soundex: { name: "soundex", params: [{ name: "X", type: "text" }], cite: "soundex(X)" },
	// numeric - lang_corefunc.html + lang_mathfunc.html
	round: {
		name: "round",
		params: [
			{ name: "X", type: "numeric" },
			{ name: "Y", type: "int", optional: true },
		],
		cite: "round(X,Y) / round(X)",
	},
	abs: { name: "abs", params: [{ name: "X", type: "numeric" }], cite: "abs(X)" },
	sign: { name: "sign", params: [{ name: "X", type: "numeric" }], cite: "sign(X)" },
	hex: { name: "hex", params: [{ name: "X", type: "blob" }], cite: "hex(X)" },
	power: {
		name: "power",
		params: [
			{ name: "X", type: "numeric" },
			{ name: "Y", type: "numeric" },
		],
		cite: "power(X,Y) - lang_mathfunc.html",
	},
	sqrt: { name: "sqrt", params: [{ name: "X", type: "numeric" }], cite: "sqrt(X) - lang_mathfunc.html" },
	mod: {
		name: "mod",
		params: [
			{ name: "X", type: "numeric" },
			{ name: "Y", type: "numeric" },
		],
		cite: "mod(X,Y) - lang_mathfunc.html",
	},
	pi: { name: "pi", params: [], cite: "pi() - lang_mathfunc.html" },
	exp: { name: "exp", params: [{ name: "X", type: "numeric" }], cite: "exp(X) - lang_mathfunc.html" },
	ln: { name: "ln", params: [{ name: "X", type: "numeric" }], cite: "ln(X) - lang_mathfunc.html" },
	// conditional/null - lang_corefunc.html
	coalesce: {
		name: "coalesce",
		params: [{ name: "X" }, { name: "Y" }],
		variadic: true,
		cite: "coalesce(X,Y,...) (SQLite requires >= 2 args)",
	},
	ifnull: { name: "ifnull", params: [{ name: "X" }, { name: "Y" }], cite: "ifnull(X,Y)" },
	nullif: { name: "nullif", params: [{ name: "X" }, { name: "Y" }], cite: "nullif(X,Y)" },
	iif: {
		name: "iif",
		params: [{ name: "condition", type: "boolean" }, { name: "true_value" }, { name: "false_value" }],
		variadic: true,
		cite: "iif(B1,V1,B2,V2,...,else)",
	},
	// aggregate - lang_aggfunc.html (see the module note: never arity-checked, name-based aggregate flag)
	count: { name: "count", params: [{ name: "X" }], cite: "count(X) / count(*)" },
	sum: { name: "sum", params: [{ name: "X", type: "numeric" }], cite: "sum(X)" },
	total: { name: "total", params: [{ name: "X", type: "numeric" }], cite: "total(X)" },
	avg: { name: "avg", params: [{ name: "X", type: "numeric" }], cite: "avg(X)" },
	min: { name: "min", params: [{ name: "X" }], variadic: true, cite: "min(X) aggregate / min(X,Y,...) scalar" },
	max: { name: "max", params: [{ name: "X" }], variadic: true, cite: "max(X) aggregate / max(X,Y,...) scalar" },
	group_concat: {
		name: "group_concat",
		params: [
			{ name: "X", type: "text" },
			{ name: "Y", type: "text", optional: true },
		],
		cite: "group_concat(X[,Y])",
	},
};
