import { parseType, scalar, UNKNOWN, type Type } from "./types.js";
import type { FnRule } from "./functions.js";

// ---------------------------------------------------------------------------
// SQLite inference knowledge — currently a minimal, honest stub (A-R4). SQLite has no
// declared-type enforcement: a column's declared type name is matched by SUBSTRING against
// a small set of patterns to pick one of five *type affinities* (INTEGER/TEXT/BLOB/REAL/
// NUMERIC), not looked up in a fixed alias table the way other dialects' CREATE TABLE types
// are (sqlite.org/datatype3.html §3.1 "Determination Of Column Affinity"). That affinity
// algorithm is a real design decision (R5's job), so `SQLITE_ALIASES` stays empty here rather
// than guess at it, and `SQLITE_FUNCTION_RETURNS` stays empty until the function reference
// (sqlite.org/lang_corefunc.html, lang_aggfunc.html, lang_datefunc.html) is worked through.
// Contract holds: an absent rule yields `unknown`, never a guess.
// ---------------------------------------------------------------------------

export const SQLITE_ALIASES: Record<string, string> = {};

export function sqliteParseType(text: string): Type {
	return parseType(text, SQLITE_ALIASES, "sqlite");
}

const S = scalar("string");
const I = scalar("int");
const D = scalar("double");
const BIN = scalar("binary");

/** SQLite literal forms, by storage class (sqlite.org/datatype3.html has exactly five: NULL,
 *  INTEGER, REAL, TEXT, BLOB — there is no native BOOLEAN or DATE/TIME/TIMESTAMP class).
 *  TRUE/FALSE are literal aliases for the integers 1/0, not a boolean type
 *  (sqlite.org/lang_expr.html#literal_values_constants_). CURRENT_TIME/CURRENT_DATE/
 *  CURRENT_TIMESTAMP expand to a formatted TEXT value (sqlite.org/lang_createtable.html
 *  §"The DEFAULT clause"), not a date/time type. */
export function sqliteLiteral(text: string): Type {
	const t = text.trim();
	if (/^'/.test(t)) return S; // STRING_LITERAL
	if (/^x'/i.test(t)) return BIN; // BLOB_LITERAL — X'...'
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^(true|false)$/i.test(t)) return I; // integer aliases, not a boolean type
	if (/^current_(time|date|timestamp)$/i.test(t)) return S;
	if (/^[+-]?0x[0-9a-f](_?[0-9a-f])*$/i.test(t)) return I; // hex integer literal
	if (/^[+-]?\d(_?\d)*$/.test(t)) return I; // plain integer, no '.' or exponent
	if (/^[+-]?(\d(_?\d)*)?\.(\d(_?\d)*)?([eE][+-]?\d+)?$/.test(t) && /\d/.test(t)) return D; // has a '.'
	if (/^[+-]?\d(_?\d)*[eE][+-]?\d+$/.test(t)) return D; // exponent form, no '.'
	return UNKNOWN;
}

/** Empty until the function reference is worked through (R5) — never guess a return type. */
export const SQLITE_FUNCTION_RETURNS: Record<string, FnRule> = {};
