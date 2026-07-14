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
	// conversion - "CAST and CONVERT" - no offline harvest source covers these three at all (their
	// syntaxsql blocks use a bracketed "data_type [ ( length ) ]" the flat-list model can't represent).
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
	// string - "String Functions" - no harvest source at all for TRIM (its syntaxsql block uses the
	// "{ LEADING | TRAILING | BOTH }" alternation the flat-list model can't represent).
	trim: {
		name: "TRIM",
		params: [{ name: "string" }, { name: "characters", optional: true }],
		cite: "TRIM (Transact-SQL) (characters optional)",
	},
	// conditional / null - "Logical Functions" / "NULLIF" - the harvest gives both params the same
	// bare name "expression" (the doc's own NULLIF ( expression , expression ) notation); expression1/
	// expression2 are a real naming improvement the harvest can't produce on its own.
	nullif: {
		name: "NULLIF",
		params: [{ name: "expression1" }, { name: "expression2" }],
		cite: "NULLIF (Transact-SQL)",
	},
	// aggregate - "Aggregate Functions" - no harvest source at all for COUNT (its syntaxsql block is a
	// "{ [ ALL | DISTINCT ] expression | * }" alternation the flat-list model can't represent).
	count: { name: "COUNT", params: [{ name: "expression" }], cite: "COUNT (Transact-SQL)" },
	// logical - "CHOOSE (Transact-SQL)"
	choose: {
		name: "CHOOSE",
		params: [{ name: "index", type: "int" }, { name: "val_1" }, { name: "val_2" }],
		variadic: true,
		cite: "CHOOSE (Transact-SQL) - CHOOSE ( index, val_1, val_2 [, val_n ] ): the docs' `val_n` convention is a repeating tail, not one more optional param, which the harvester's dots-only variadic detection missed (the harvest itself now recovers val_n as a fourth, non-variadic optional param, which would wrongly cap the call at 4 args)",
	},
};
