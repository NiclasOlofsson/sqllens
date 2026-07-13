import { parseType, scalar, UNKNOWN, type Type } from "../infer/types.js";
import type { FnRule } from "../infer/functions.js";
import { fold } from "./fold.js";

// ---------------------------------------------------------------------------
// MySQL inference knowledge — function return types, literal forms, and scalar-type aliases,
// from the MySQL 8.4 Reference Manual (dev.mysql.com/doc/refman/8.4/en/). Same contract as every
// other dialect: an absent FUNCTION_RETURNS rule yields `unknown`, never a guess — populated only
// with return types the manual states unconditionally (see the per-entry citations below); the
// many argument-dependent numeric functions (ROUND/TRUNCATE/ABS/SUM/MIN/MAX/GREATEST/LEAST/
// IFNULL/COALESCE, …) stay unregistered by design.
// ---------------------------------------------------------------------------

export const MYSQL_ALIASES: Record<string, string> = {
	// numeric-type-syntax.html: "This type is a synonym for INT."
	integer: "int",
	// numeric-type-syntax.html: "These types are synonyms for DECIMAL." (DEC/NUMERIC/FIXED — the
	// FIXED synonym "is available for compatibility with other database systems").
	dec: "decimal",
	fixed: "decimal",
	numeric: "decimal",
	// numeric-type-syntax.html: "These types are synonyms for TINYINT(1)." BOOL/BOOLEAN are NOT a
	// distinct storage class in MySQL — mapping them into the numeric family (not this module's
	// shared `boolean` scalar) is the doc-faithful choice. This is the exact fork point
	// src/qualify/check-calls.ts's IMPLICIT_BOOL_NUM comment anticipated: because this maps BOOL to
	// `tinyint` and not `boolean`, a declared BOOL/BOOLEAN column still never surfaces our shared
	// `boolean` scalar — comparison/predicate expressions (typed `boolean` by the dialect-agnostic
	// engine regardless of this table) remain the only source of a boolean-typed value reaching a
	// numeric MySQL argument, which is what IMPLICIT_BOOL_NUM's mysql membership (R5.4) bridges.
	bool: "tinyint",
	boolean: "tinyint",
	// numeric-type-syntax.html: "These types are synonyms for DOUBLE." (DOUBLE PRECISION). CAST's
	// getText() concatenates keyword tokens with no separating space (every dialect's lower.ts does
	// this uniformly), so the alias key is the concatenated form.
	doubleprecision: "double",
	// numeric-type-syntax.html: "These types are synonyms for DOUBLE. Exception: if REAL_AS_FLOAT
	// ... is enabled, REAL is a synonym for FLOAT" — REAL_AS_FLOAT defaults OFF
	// (sql-mode.html#sqlmode_real_as_float), so REAL's server-default meaning is DOUBLE. Bare FLOAT
	// needs no entry: normalizeScalar's identity fallback already keeps it as this module's own
	// `float` scalar, matching FLOAT's default (p<=24) single-precision meaning
	// (cast-functions.html) — the same simplification postgres.ts makes for its own bare FLOAT.
	real: "double",
	// string-type-syntax.html: "CHAR is shorthand for CHARACTER."
	character: "string",
	// cast-functions.html: "NCHAR ... Like CHAR, but produces a string with the national character
	// set."
	nchar: "string",
	// datetime.html: DATETIME is a full date+time value — the same shape this module's shared
	// `timestamp` scalar models for every other dialect (mirrors TSQL_ALIASES's datetime mapping).
	datetime: "timestamp",
	// cast-functions.html: CAST's restricted SIGNED/UNSIGNED target keywords. "SIGNED [INTEGER]:
	// Produces a signed BIGINT value." / "UNSIGNED [INTEGER]: Produces an unsigned BIGINT value."
	// This module's Type has no unsigned modifier, so both fold into the same `bigint` family — a
	// documented simplification, not a guess (the two keywords, per MySqlParser.g4's
	// convertedDataType rule, are `(SIGNED | UNSIGNED) (INTEGER | INT)?`; getText() concatenates the
	// optional suffix with no space, hence the extra concatenated-form keys).
	signed: "bigint",
	signedinteger: "bigint",
	signedint: "bigint",
	unsigned: "bigint",
	unsignedinteger: "bigint",
	unsignedint: "bigint",
};

export function mysqlParseType(text: string): Type {
	return parseType(text, MYSQL_ALIASES, fold);
}

const S = scalar("string");
const BIG = scalar("bigint");
const I = scalar("int");
const DEC = scalar("decimal");
const D = scalar("double");
const BIN = scalar("binary");
const DATE = scalar("date");
const TS = scalar("timestamp");

const fixed =
	(t: Type): FnRule =>
	() =>
		t;

function group(rule: FnRule, names: string[]): Record<string, FnRule> {
	return Object.fromEntries(names.map((n) => [n, rule]));
}

/** MySQL literal forms (dev.mysql.com/doc/refman/8.4/en/literals.html). Numerics split on MySQL's
 *  exact-vs-approximate line (.../precision-math-numbers.html): a literal with a decimal point and
 *  no exponent (`3.5`, `.2`) is an EXACT-value DECIMAL; only the scientific-notation form (`1.2E3`)
 *  is an approximate-value DOUBLE — the same split snowflake/redshift/postgres/duckdb/trino encode
 *  (NOT sqlite, whose five storage classes have no DECIMAL, so its classifier's `double` there is
 *  correct for it and wrong here). A bare integer stays `int` (house convention across every
 *  dialect's classifier). TRUE/FALSE are documented synonyms for the integers 1/0
 *  (.../numeric-type-syntax.html "BOOL, BOOLEAN ... TINYINT(1)"), not a distinct boolean type. A
 *  hexadecimal literal (X'…' / 0x…) is, per its own syntax alone with no surrounding context, "a
 *  binary string" by default (.../hexadecimal-literals.html) — the numeric-context
 *  reinterpretation needs the call site, which this text-only classifier doesn't have, so it stays
 *  at the documented default rather than guessing. Bit-value literals (b'…' / 0b…) are left
 *  UNKNOWN: unlike hex literals, the docs don't name a context-free default
 *  (.../bit-value-literals.html), so classifying either way would be a guess. */
export function mysqlLiteral(text: string): Type {
	const t = text.trim();
	if (/^['"]/.test(t)) return S; // string literal ('…' or "…")
	if (/^x'/i.test(t) || /^0x[0-9a-f]+$/i.test(t)) return BIN; // hexadecimal literal
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^(true|false)$/i.test(t)) return I; // TINYINT(1) synonyms, not a boolean type
	if (/^[+-]?\d+$/.test(t)) return I; // integer exact-value literal
	if (/^[+-]?(\d+\.?\d*|\.\d+)[eE][+-]?\d+$/.test(t)) return D; // scientific notation → approximate (DOUBLE)
	if (/^[+-]?(\d+\.\d*|\.\d+)$/.test(t)) return DEC; // fractional exact-value literal → DECIMAL
	return UNKNOWN;
}

export const MYSQL_FUNCTION_RETURNS: Record<string, FnRule> = {
	// --- aggregate — aggregate-functions.html -----------------------------------------------------
	// #function_count: "The return value is a BIGINT value" — unconditional on the argument.
	count: fixed(BIG),

	// --- string — string-functions.html: each entry documented as unconditionally typed ------------
	concat: fixed(S), // #function_concat: "Returns NULL if any argument is NULL", otherwise a string
	...group(fixed(I), [
		"char_length", // #function_char-length: "Returns the length of the string str, measured in code points"
		"character_length", // documented synonym of CHAR_LENGTH
		"length", // #function_length: "Returns the length of the string str, measured in bytes"
	]),
	...group(fixed(S), [
		"lower", // #function_lower: "Returns the string str with all characters ... changed to lowercase"
		"lcase", // documented synonym of LOWER
		"upper", // #function_upper: "Returns the string str with all characters ... changed to uppercase"
		"ucase", // documented synonym of UPPER
		"hex", // #function_hex: string arg → "a hexadecimal string representation of str"; numeric arg → same, of N
	]),

	// --- date/time — date-and-time-functions.html: the function-index table types each of these by
	// its native temporal type (NOW/SYSDATE → DATETIME, CURDATE → DATE); the "string or numeric
	// context" wording on each function's own description is MySQL's general implicit-conversion
	// behavior for ANY temporal value (same as a real DATETIME/DATE column), not a documented lack
	// of a native type — so these are NOT copied as sqlite's context-free `string` here. ----------
	...group(fixed(TS), [
		"now", // #function_now
		"current_timestamp", // synonym of NOW() (bare-keyword form, no-arg specificFunction alt)
		"sysdate", // #function_sysdate — same DATETIME-returning family as NOW
	]),
	...group(fixed(DATE), [
		"curdate", // #function_curdate
		"current_date", // documented synonym of CURDATE()
	]),

	// --- information — information-functions.html: session/server metadata, unconditionally typed -
	...group(fixed(S), [
		"database", // #function_database: "a string in the utf8mb3 character set"
		"schema", // documented synonym of DATABASE()
		"user", // #function_user: "the current MySQL user name and host name as a string"
		"current_user", // its own string-returning function (may differ from USER() under a proxy user)
		"version", // #function_version: "a string that indicates the MySQL server version"
	]),
	// #function_last-insert-id: "a BIGINT UNSIGNED (64-bit) value" (no-arg form)
	last_insert_id: fixed(BIG),
	// #function_found-rows: "returns a number indicating how many rows..." — a row count, same
	// unconditional-bigint treatment as COUNT() above (FOUND_ROWS() is documented deprecated, but
	// its return shape is unconditional either way).
	found_rows: fixed(BIG),

	// --- JSON — json-attribute-functions.html --------------------------------------------------
	json_type: fixed(S), // #function_json-type: "Returns a utf8mb4 string indicating the type of a JSON value"
};
