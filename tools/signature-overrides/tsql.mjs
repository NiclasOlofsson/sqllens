// ---------------------------------------------------------------------------
// T-SQL (SQL Server) - learn.microsoft.com Transact-SQL function reference.
// Cites the docs page per entry. Note DATEADD = (datepart, number, date).
// ---------------------------------------------------------------------------
//
// Migrated (mechanically, 2026-07-14) from the hand-curated TSQL table that used to live
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
		params: [{ name: "datepart" }, { name: "number", type: "int" }, { name: "date", type: "date" }],
		cite: "DATEADD (Transact-SQL)",
	},
	datediff: {
		name: "DATEDIFF",
		params: [{ name: "datepart" }, { name: "startdate", type: "date" }, { name: "enddate", type: "date" }],
		cite: "DATEDIFF (Transact-SQL)",
	},
	datepart: {
		name: "DATEPART",
		params: [{ name: "datepart" }, { name: "date", type: "date" }],
		cite: "DATEPART (Transact-SQL)",
	},
	datename: {
		name: "DATENAME",
		params: [{ name: "datepart" }, { name: "date", type: "date" }],
		cite: "DATENAME (Transact-SQL)",
	},
	datefromparts: {
		name: "DATEFROMPARTS",
		params: [
			{ name: "year", type: "int" },
			{ name: "month", type: "int" },
			{ name: "day", type: "int" },
		],
		cite: "DATEFROMPARTS (Transact-SQL)",
	},
	eomonth: {
		name: "EOMONTH",
		params: [
			{ name: "start_date", type: "date" },
			{ name: "month_to_add", type: "int", optional: true },
		],
		cite: "EOMONTH (Transact-SQL) - EOMONTH ( start_date [ , month_to_add ] ): month_to_add is optional",
	},
	// conversion - "CAST and CONVERT"
	convert: {
		name: "CONVERT",
		params: [{ name: "data_type" }, { name: "expression" }, { name: "style", type: "int", optional: true }],
		cite: "CONVERT (Transact-SQL) - CONVERT ( data_type [ ( length ) ] , expression [ , style ] ): style is bracketed/optional",
	},
	cast: { name: "CAST", params: [{ name: "expression" }, { name: "data_type" }], cite: "CAST (Transact-SQL)" },
	try_convert: {
		name: "TRY_CONVERT",
		params: [{ name: "data_type" }, { name: "expression" }, { name: "style", type: "int", optional: true }],
		cite: "TRY_CONVERT (Transact-SQL) - TRY_CONVERT ( data_type [ ( length ) ] , expression [ , style ] ): style is bracketed/optional",
	},
	// string - "String Functions"
	substring: {
		name: "SUBSTRING",
		params: [
			{ name: "expression" },
			{ name: "start", type: "int" },
			{ name: "length", type: "int", optional: true },
		],
		cite: "SUBSTRING (Transact-SQL) (length optional in Fabric/newer)",
	},
	charindex: {
		name: "CHARINDEX",
		params: [
			{ name: "expressionToFind" },
			{ name: "expressionToSearch" },
			{ name: "start_location", type: "int", optional: true },
		],
		cite: "CHARINDEX (Transact-SQL) (start_location optional)",
	},
	left: {
		name: "LEFT",
		params: [{ name: "character_expression" }, { name: "integer_expression", type: "int" }],
		cite: "LEFT (Transact-SQL)",
	},
	right: {
		name: "RIGHT",
		params: [{ name: "character_expression" }, { name: "integer_expression", type: "int" }],
		cite: "RIGHT (Transact-SQL)",
	},
	concat: {
		name: "CONCAT",
		params: [{ name: "argument1" }, { name: "argument2" }],
		variadic: true,
		cite: "CONCAT (Transact-SQL) - CONCAT ( argument1 , argument2 [ , argumentN ] ... ): requires at least two arguments",
	},
	concat_ws: {
		name: "CONCAT_WS",
		params: [{ name: "separator" }, { name: "argument1" }, { name: "argument2" }],
		variadic: true,
		cite: "CONCAT_WS (Transact-SQL) - CONCAT_WS ( separator , argument1 , argument2 [ , argumentN ] ... ): requires a separator and at least two other arguments",
	},
	stuff: {
		name: "STUFF",
		params: [
			{ name: "character_expression" },
			{ name: "start", type: "int" },
			{ name: "length", type: "int" },
			{ name: "replace_with_expression" },
		],
		cite: "STUFF (Transact-SQL) - STUFF ( character_expression , start , length , replace_with_expression )",
	},
	trim: {
		name: "TRIM",
		params: [{ name: "string" }, { name: "characters", optional: true }],
		cite: "TRIM (Transact-SQL) (characters optional)",
	},
	// conditional / null - "Logical Functions" / "NULLIF"
	nullif: {
		name: "NULLIF",
		params: [{ name: "expression1" }, { name: "expression2" }],
		cite: "NULLIF (Transact-SQL)",
	},
	iif: {
		name: "IIF",
		params: [{ name: "boolean_expression", type: "boolean" }, { name: "true_value" }, { name: "false_value" }],
		cite: "IIF (Transact-SQL)",
	},
	// numeric - "Mathematical Functions"
	round: {
		name: "ROUND",
		params: [
			{ name: "numeric_expression", type: "numeric" },
			{ name: "length", type: "int" },
			{ name: "function", type: "int", optional: true },
		],
		cite: "ROUND (Transact-SQL) (function optional)",
	},
	abs: { name: "ABS", params: [{ name: "numeric_expression", type: "numeric" }], cite: "ABS (Transact-SQL)" },
	ceiling: {
		name: "CEILING",
		params: [{ name: "numeric_expression", type: "numeric" }],
		cite: "CEILING (Transact-SQL)",
	},
	floor: { name: "FLOOR", params: [{ name: "numeric_expression", type: "numeric" }], cite: "FLOOR (Transact-SQL)" },
	power: {
		name: "POWER",
		params: [{ name: "float_expression", type: "float" }, { name: "y" }],
		cite: "POWER (Transact-SQL)",
	},
	// aggregate - "Aggregate Functions"
	count: { name: "COUNT", params: [{ name: "expression" }], cite: "COUNT (Transact-SQL)" },
	sum: { name: "SUM", params: [{ name: "expression", type: "numeric" }], cite: "SUM (Transact-SQL)" },
	avg: { name: "AVG", params: [{ name: "expression", type: "numeric" }], cite: "AVG (Transact-SQL)" },
	// logical - "CHOOSE (Transact-SQL)"
	choose: {
		name: "CHOOSE",
		params: [{ name: "index", type: "int" }, { name: "val_1" }, { name: "val_2" }],
		variadic: true,
		cite: "CHOOSE (Transact-SQL) - CHOOSE ( index, val_1, val_2 [, val_n ] ): the docs' `val_n` convention is a repeating tail, not one more optional param, which the harvester's dots-only variadic detection missed",
	},
	// bit manipulation - "SET_BIT (Transact-SQL)"
	set_bit: {
		name: "SET_BIT",
		params: [
			{ name: "expression_value" },
			{ name: "bit_offset", type: "int" },
			{ name: "bit_value", type: "int", optional: true },
		],
		cite: "SET_BIT (Transact-SQL) - the page documents both SET_BIT(expression_value, bit_offset) and SET_BIT(expression_value, bit_offset, bit_value) in one fenced block; the single-call-line parser only kept the first",
	},
};
