// ---------------------------------------------------------------------------
// Redshift - docs.aws.amazon.com/redshift SQL functions reference. Cites the
// page per entry. DATEADD = (datepart, interval, date).
//
// Pruned 2026-07-14 against the new redshift/docs/syntax harvest (captured by
// tools/scrape-redshift-syntax.mjs, mined by tools/harvest-signatures.mjs's Redshift extractor):
// deleted 5 entries identical to the harvest (nvl2, nullif, count, min, max), 11 typed-duplicates
// whose only contribution over the harvest was type fields (date_trunc, to_date, to_timestamp,
// replace, regexp_replace, round, abs, floor, mod, sum, avg), and 5 whose harvested set became
// richer than the hand shape (substring - the harvest adds the binary_expression overload, and its
// binary form's 2-arg floor keeps every 2-3-arg call arity-clean; listagg - the harvest emits both
// the aggregate and window forms with delimiter correctly optional, where the hand shape wrongly
// required it; coalesce, nvl - the harvest reads the documented two-expression minimum). What
// survives is only what the harvest provably cannot produce (alternation/clause/optional-group
// pages the NEVER-WRONG contract skips), two entries whose hand-authored param names still
// differ from the harvest (concat, split_part), and two safety-valve entries the corpus gate
// forced the same day (rtrim, st_collect - see their own comments below).
// ---------------------------------------------------------------------------
//
// Migrated (mechanically, 2026-07-14) from the hand-curated REDSHIFT table that used to live
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
	// No harvest exists for DATEADD/DATEDIFF/DATE_PART: their Syntax blocks use a
	// "{date|time|timetz|timestamp}" alternation the flat-list model can't represent.
	dateadd: {
		name: "DATEADD",
		params: [{ name: "datepart" }, { name: "interval", type: "integer" }, { name: "date", type: "date" }],
		cite: "DATEADD function",
	},
	datediff: {
		name: "DATEDIFF",
		params: [{ name: "datepart" }, { name: "startdate", type: "date" }, { name: "enddate", type: "date" }],
		cite: "DATEDIFF function",
	},
	date_part: {
		name: "DATE_PART",
		params: [{ name: "datepart" }, { name: "timestamp", type: "timestamp" }],
		cite: "DATE_PART function",
	},
	// string. The harvest names CONCAT's params expression1/expression2 and SPLIT_PART's third param
	// "position"; these two keep the hand-authored names plus types (a naming difference, not a
	// typed-duplicate). No harvest exists for TRIM (its block is the
	// "[ BOTH | LEADING | TRAILING ] [trim_chars FROM ] string" clause form) or LPAD/RPAD (their
	// "[ string2 ]" bracket group carries no leading comma, which the bracket-chain model rejects).
	concat: {
		name: "CONCAT",
		params: [
			{ name: "string1", type: "string" },
			{ name: "string2", type: "string" },
		],
		cite: "CONCAT function (binary)",
	},
	split_part: {
		name: "SPLIT_PART",
		params: [
			{ name: "string", type: "string" },
			{ name: "delimiter", type: "string" },
			{ name: "part", type: "integer" },
		],
		cite: "SPLIT_PART function",
	},
	trim: { name: "TRIM", params: [{ name: "string", type: "string" }], cite: "TRIM function" },
	// rtrim - safety-valve entry forced by the corpus gate (tests/corpus/redshift.test.ts call sweep):
	// r_RTRIM's own Syntax line reads "RTRIM( string, trim_chars )" with NO brackets, so the harvest
	// faithfully emitted trim_chars as required - but the page's Arguments section documents
	// trim_chars as optional, and the doc corpus is full of genuine 1-arg calls (r_RTRIM/1.sql's own
	// `rtrim('     abc    ')`, plus r_STL_DDLTEXT, r_STL_QUERYTEXT, r_SVL_STATEMENTTEXT and a dozen
	// more system-table example pages). The sibling LTRIM Syntax line has the brackets
	// ("LTRIM( string [, trim_chars] )"), so this is an AWS doc inconsistency, not a harvest bug.
	rtrim: {
		name: "RTRIM",
		params: [
			{ name: "string", type: "string" },
			{ name: "trim_chars", type: "string", optional: true },
		],
		cite: "RTRIM function - trim_chars optional per the Arguments section and the corpus's 1-arg calls (r_RTRIM/1.sql), though the Syntax line omits the brackets",
	},
	lpad: {
		name: "LPAD",
		params: [
			{ name: "string", type: "string" },
			{ name: "length", type: "integer" },
			{ name: "pad", type: "string", optional: true },
		],
		cite: "LPAD function (pad optional)",
	},
	rpad: {
		name: "RPAD",
		params: [
			{ name: "string", type: "string" },
			{ name: "length", type: "integer" },
			{ name: "pad", type: "string", optional: true },
		],
		cite: "RPAD function (pad optional)",
	},
	// conditional / null. No harvest exists for DECODE: its
	// "expression, search, result [, search, result ]... [ ,default ]" repeating-pair notation is a
	// non-trailing optional group the flat-list model can't represent.
	decode: {
		name: "DECODE",
		params: [{ name: "expression" }, { name: "search" }, { name: "result" }],
		variadic: true,
		cite: "DECODE expression (variadic)",
	},
	// spatial. st_collect - safety-valve entry forced by the corpus gate: ST_Collect-function's
	// Syntax section documents TWO forms, the 2-arg scalar `ST_Collect(geom1, geom2)` and the 1-arg
	// aggregate `ST_Collect(aggregate_expression) [WITHIN GROUP (ORDER BY sort_expression1 ...)]`.
	// The aggregate line's WITHIN GROUP tail carries ASC/DESC and a repeat group, richer than the
	// extractor's recognized WITHIN GROUP shape, so that line skips as trailing-content and the
	// harvest kept only the 2-arg form - which false-flagged the corpus's genuine 1-arg aggregate
	// calls (ST_Collect-function/2.sql, 3.sql).
	st_collect: {
		name: "ST_Collect",
		overloads: [{ params: [{ name: "geom1" }, { name: "geom2" }] }, { params: [{ name: "aggregate_expression" }] }],
		cite: "ST_Collect(geom1, geom2) scalar and ST_Collect(aggregate_expression) WITHIN GROUP aggregate - ST_Collect-function, corpus 1-arg calls in ST_Collect-function/2.sql and 3.sql",
	},
	// numeric. No harvest exists for CEILING or POWER: their Syntax blocks open with a
	// "{CEIL | CEILING}" / "{POW | POWER}" name alternation, so no line starts with a plain
	// `identifier(` call shape.
	ceiling: { name: "CEILING", params: [{ name: "number", type: "numeric" }], cite: "CEILING / CEIL function" },
	power: {
		name: "POWER",
		params: [
			{ name: "base", type: "numeric" },
			{ name: "exponent", type: "numeric" },
		],
		cite: "POWER function",
	},
};
