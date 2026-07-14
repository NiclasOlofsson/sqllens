// ---------------------------------------------------------------------------
// Redshift - docs.aws.amazon.com/redshift SQL functions reference. Cites the
// page per entry. DATEADD = (datepart, interval, date).
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
	date_trunc: {
		name: "DATE_TRUNC",
		params: [{ name: "datepart" }, { name: "timestamp", type: "timestamp" }],
		cite: "DATE_TRUNC function",
	},
	to_date: {
		name: "TO_DATE",
		params: [
			{ name: "string", type: "string" },
			{ name: "format", type: "string" },
			{ name: "is_strict", type: "boolean", optional: true },
		],
		cite: "TO_DATE function (is_strict optional)",
	},
	to_timestamp: {
		name: "TO_TIMESTAMP",
		params: [
			{ name: "timestamp", type: "string" },
			{ name: "format", type: "string" },
			{ name: "is_strict", type: "boolean", optional: true },
		],
		cite: "TO_TIMESTAMP function (is_strict optional)",
	},
	// string
	concat: {
		name: "CONCAT",
		params: [
			{ name: "string1", type: "string" },
			{ name: "string2", type: "string" },
		],
		cite: "CONCAT function (binary)",
	},
	substring: {
		name: "SUBSTRING",
		params: [
			{ name: "string", type: "string" },
			{ name: "start_position", type: "integer" },
			{ name: "number_characters", type: "integer", optional: true },
		],
		cite: "SUBSTRING function (number_characters optional)",
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
	replace: {
		name: "REPLACE",
		params: [
			{ name: "string", type: "string" },
			{ name: "old_chars", type: "string" },
			{ name: "new_chars", type: "string" },
		],
		cite: "REPLACE function",
	},
	trim: { name: "TRIM", params: [{ name: "string", type: "string" }], cite: "TRIM function" },
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
	regexp_replace: {
		name: "REGEXP_REPLACE",
		params: [
			{ name: "source_string", type: "string" },
			{ name: "pattern", type: "string" },
			{ name: "replace_string", type: "string", optional: true },
			{ name: "position", type: "integer", optional: true },
			{ name: "parameters", type: "string", optional: true },
		],
		cite: "REGEXP_REPLACE function",
	},
	// conditional / null
	coalesce: { name: "COALESCE", params: [{ name: "expression" }], variadic: true, cite: "COALESCE / NVL (variadic)" },
	nvl: { name: "NVL", params: [{ name: "expression" }], variadic: true, cite: "NVL function (variadic)" },
	nvl2: {
		name: "NVL2",
		params: [{ name: "expression" }, { name: "not_null_return_value" }, { name: "null_return_value" }],
		cite: "NVL2 function",
	},
	nullif: { name: "NULLIF", params: [{ name: "expression1" }, { name: "expression2" }], cite: "NULLIF function" },
	decode: {
		name: "DECODE",
		params: [{ name: "expression" }, { name: "search" }, { name: "result" }],
		variadic: true,
		cite: "DECODE expression (variadic)",
	},
	// numeric
	round: {
		name: "ROUND",
		params: [
			{ name: "number", type: "numeric" },
			{ name: "integer", type: "integer", optional: true },
		],
		cite: "ROUND function (integer optional → 0)",
	},
	abs: { name: "ABS", params: [{ name: "number", type: "numeric" }], cite: "ABS function" },
	ceiling: { name: "CEILING", params: [{ name: "number", type: "numeric" }], cite: "CEILING / CEIL function" },
	floor: { name: "FLOOR", params: [{ name: "number", type: "numeric" }], cite: "FLOOR function" },
	power: {
		name: "POWER",
		params: [
			{ name: "base", type: "numeric" },
			{ name: "exponent", type: "numeric" },
		],
		cite: "POWER function",
	},
	mod: {
		name: "MOD",
		params: [
			{ name: "number1", type: "numeric" },
			{ name: "number2", type: "numeric" },
		],
		cite: "MOD function",
	},
	// aggregate
	count: { name: "COUNT", params: [{ name: "expression" }], cite: "COUNT function" },
	sum: { name: "SUM", params: [{ name: "expression", type: "numeric" }], cite: "SUM function" },
	avg: { name: "AVG", params: [{ name: "expression", type: "numeric" }], cite: "AVG function" },
	min: { name: "MIN", params: [{ name: "expression" }], cite: "MIN function" },
	max: { name: "MAX", params: [{ name: "expression" }], cite: "MAX function" },
	listagg: {
		name: "LISTAGG",
		params: [
			{ name: "aggregate_expression", type: "string" },
			{ name: "delimiter", type: "string" },
		],
		cite: "LISTAGG function",
	},
};
