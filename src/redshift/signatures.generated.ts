// GENERATED - do not edit by hand. Rebuild: node tools/harvest-signatures.mjs && npm run format
// No offline docs-syntax source in the corpus repo yet for redshift - curated overrides only.
// Overrides source: tools/signature-overrides/redshift.mjs
// Built 2026-07-14. 31 names (31 curated, 0 harvested), 0 with 2+ overloads.
import type { FnSignature } from "../signature/signatures.js";

/** The merged function-signature table for redshift: curated overrides folded over the harvested
 *  doc-derived long tail (overrides win by key, replacing the whole overload set), keyed by
 *  lowercased name. Each name maps to an ORDERED overload set - a name with one documented shape
 *  is a one-element array. `origin` says which layer produced the set. */
export const REDSHIFT_SIGNATURES: Record<string, FnSignature[]> = {
	abs: [{ name: "ABS", params: [{ name: "number", type: "numeric" }], origin: "curated" }], // curated: ABS function
	avg: [{ name: "AVG", params: [{ name: "expression", type: "numeric" }], origin: "curated" }], // curated: AVG function
	ceiling: [{ name: "CEILING", params: [{ name: "number", type: "numeric" }], origin: "curated" }], // curated: CEILING / CEIL function
	coalesce: [{ name: "COALESCE", params: [{ name: "expression" }], variadic: true, origin: "curated" }], // curated: COALESCE / NVL (variadic)
	concat: [
		{
			name: "CONCAT",
			params: [
				{ name: "string1", type: "string" },
				{ name: "string2", type: "string" },
			],
			origin: "curated",
		},
	], // curated: CONCAT function (binary)
	count: [{ name: "COUNT", params: [{ name: "expression" }], origin: "curated" }], // curated: COUNT function
	date_part: [
		{
			name: "DATE_PART",
			params: [{ name: "datepart" }, { name: "timestamp", type: "timestamp" }],
			origin: "curated",
		},
	], // curated: DATE_PART function
	date_trunc: [
		{
			name: "DATE_TRUNC",
			params: [{ name: "datepart" }, { name: "timestamp", type: "timestamp" }],
			origin: "curated",
		},
	], // curated: DATE_TRUNC function
	dateadd: [
		{
			name: "DATEADD",
			params: [{ name: "datepart" }, { name: "interval", type: "integer" }, { name: "date", type: "date" }],
			origin: "curated",
		},
	], // curated: DATEADD function
	datediff: [
		{
			name: "DATEDIFF",
			params: [{ name: "datepart" }, { name: "startdate", type: "date" }, { name: "enddate", type: "date" }],
			origin: "curated",
		},
	], // curated: DATEDIFF function
	decode: [
		{
			name: "DECODE",
			params: [{ name: "expression" }, { name: "search" }, { name: "result" }],
			variadic: true,
			origin: "curated",
		},
	], // curated: DECODE expression (variadic)
	floor: [{ name: "FLOOR", params: [{ name: "number", type: "numeric" }], origin: "curated" }], // curated: FLOOR function
	listagg: [
		{
			name: "LISTAGG",
			params: [
				{ name: "aggregate_expression", type: "string" },
				{ name: "delimiter", type: "string" },
			],
			origin: "curated",
		},
	], // curated: LISTAGG function
	lpad: [
		{
			name: "LPAD",
			params: [
				{ name: "string", type: "string" },
				{ name: "length", type: "integer" },
				{ name: "pad", type: "string", optional: true },
			],
			origin: "curated",
		},
	], // curated: LPAD function (pad optional)
	max: [{ name: "MAX", params: [{ name: "expression" }], origin: "curated" }], // curated: MAX function
	min: [{ name: "MIN", params: [{ name: "expression" }], origin: "curated" }], // curated: MIN function
	mod: [
		{
			name: "MOD",
			params: [
				{ name: "number1", type: "numeric" },
				{ name: "number2", type: "numeric" },
			],
			origin: "curated",
		},
	], // curated: MOD function
	nullif: [{ name: "NULLIF", params: [{ name: "expression1" }, { name: "expression2" }], origin: "curated" }], // curated: NULLIF function
	nvl: [{ name: "NVL", params: [{ name: "expression" }], variadic: true, origin: "curated" }], // curated: NVL function (variadic)
	nvl2: [
		{
			name: "NVL2",
			params: [{ name: "expression" }, { name: "not_null_return_value" }, { name: "null_return_value" }],
			origin: "curated",
		},
	], // curated: NVL2 function
	power: [
		{
			name: "POWER",
			params: [
				{ name: "base", type: "numeric" },
				{ name: "exponent", type: "numeric" },
			],
			origin: "curated",
		},
	], // curated: POWER function
	regexp_replace: [
		{
			name: "REGEXP_REPLACE",
			params: [
				{ name: "source_string", type: "string" },
				{ name: "pattern", type: "string" },
				{ name: "replace_string", type: "string", optional: true },
				{ name: "position", type: "integer", optional: true },
				{ name: "parameters", type: "string", optional: true },
			],
			origin: "curated",
		},
	], // curated: REGEXP_REPLACE function
	replace: [
		{
			name: "REPLACE",
			params: [
				{ name: "string", type: "string" },
				{ name: "old_chars", type: "string" },
				{ name: "new_chars", type: "string" },
			],
			origin: "curated",
		},
	], // curated: REPLACE function
	round: [
		{
			name: "ROUND",
			params: [
				{ name: "number", type: "numeric" },
				{ name: "integer", type: "integer", optional: true },
			],
			origin: "curated",
		},
	], // curated: ROUND function (integer optional → 0)
	rpad: [
		{
			name: "RPAD",
			params: [
				{ name: "string", type: "string" },
				{ name: "length", type: "integer" },
				{ name: "pad", type: "string", optional: true },
			],
			origin: "curated",
		},
	], // curated: RPAD function (pad optional)
	split_part: [
		{
			name: "SPLIT_PART",
			params: [
				{ name: "string", type: "string" },
				{ name: "delimiter", type: "string" },
				{ name: "part", type: "integer" },
			],
			origin: "curated",
		},
	], // curated: SPLIT_PART function
	substring: [
		{
			name: "SUBSTRING",
			params: [
				{ name: "string", type: "string" },
				{ name: "start_position", type: "integer" },
				{ name: "number_characters", type: "integer", optional: true },
			],
			origin: "curated",
		},
	], // curated: SUBSTRING function (number_characters optional)
	sum: [{ name: "SUM", params: [{ name: "expression", type: "numeric" }], origin: "curated" }], // curated: SUM function
	to_date: [
		{
			name: "TO_DATE",
			params: [
				{ name: "string", type: "string" },
				{ name: "format", type: "string" },
				{ name: "is_strict", type: "boolean", optional: true },
			],
			origin: "curated",
		},
	], // curated: TO_DATE function (is_strict optional)
	to_timestamp: [
		{
			name: "TO_TIMESTAMP",
			params: [
				{ name: "timestamp", type: "string" },
				{ name: "format", type: "string" },
				{ name: "is_strict", type: "boolean", optional: true },
			],
			origin: "curated",
		},
	], // curated: TO_TIMESTAMP function (is_strict optional)
	trim: [{ name: "TRIM", params: [{ name: "string", type: "string" }], origin: "curated" }], // curated: TRIM function
};
