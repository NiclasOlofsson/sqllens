import { commonType, widenSum } from "../infer/coerce.js";
import { parseType, scalar, UNKNOWN, type Type } from "../infer/types.js";
import type { FnRule } from "../infer/functions.js";
import { fold } from "./fold.js";

// ---------------------------------------------------------------------------
// SQLite inference knowledge. Literal typing (A-R4) is storage-class-faithful (sqlite.org/
// datatype3.html has exactly five: NULL/INTEGER/REAL/TEXT/BLOB — no native BOOLEAN or DATE/TIME/
// TIMESTAMP class, so this file never reaches for a `boolean` scalar). The function-return
// registry (R5) is worked through the core/aggregate/date/math references — lang_corefunc.html,
// lang_aggfunc.html, lang_datefunc.html, lang_mathfunc.html — and stays deliberately incomplete:
// SQLite's dynamic/flexible typing (lang_expr.html, datatype3.html) makes several documented
// "returns a number" functions genuinely value- or modifier-dependent (SUM/AVG/MAX/MIN's
// argument-shaped results, unixepoch()'s subsec-modifier int/float switch, every lang_mathfunc.html
// entry's undocumented storage class for its "representable integer" wording) — those stay
// unregistered by design, not by oversight. SQLITE_ALIASES stays empty: a CREATE TABLE column's
// declared type name is matched by SUBSTRING against a small pattern set to pick one of five
// *type affinities* (datatype3.html §3.1 "Determination Of Column Affinity"), not looked up in a
// fixed alias table the way other dialects' declared types are — that affinity algorithm is a
// distinct, not-yet-built feature, not a registration gap. Contract holds throughout: an absent
// rule yields `unknown`, never a guess.
// ---------------------------------------------------------------------------

export const SQLITE_ALIASES: Record<string, string> = {};

export function sqliteParseType(text: string): Type {
	return parseType(text, SQLITE_ALIASES, fold);
}

const S = scalar("string");
const I = scalar("int");
const BIG = scalar("bigint");
const D = scalar("double");
const BIN = scalar("binary");

const fixed =
	(t: Type): FnRule =>
	() =>
		t;
/** "returns argument X unchanged" (likelihood/likely/unlikely) / plain numeric passthrough (abs). */
const firstArg: FnRule = (args) => args[0] ?? UNKNOWN;
/** coalesce/ifnull: "returns a copy of its first non-NULL argument" — the common type of the args
 *  (falls back to unknown, never a guess, when they don't agree). */
const common: FnRule = (args) => commonType(args);

function group(rule: FnRule, names: string[]): Record<string, FnRule> {
	return Object.fromEntries(names.map((n) => [n, rule]));
}

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

export const SQLITE_FUNCTION_RETURNS: Record<string, FnRule> = {
	// --- string — lang_corefunc.html: each of these is documented as unconditionally returning a
	// string, independent of the argument's own storage class ------------------------------------
	...group(fixed(S), [
		"upper", // "returns a copy of input string X in which all lower-case ASCII characters are converted to their upper-case equivalent"
		"lower", // "returns a copy of string X with all ASCII characters converted to lower case"
		"typeof", // "returns a string that indicates the datatype of the expression X: null, integer, real, text, or blob"
		"hex", // "returns a string which is the upper-case hexadecimal rendering of the content of that blob"
		"quote", // "returns the text of an SQL literal which is the value of its argument suitable for inclusion into an SQL statement"
		"ltrim", // "returns a string formed by removing any and all characters that appear in Y from the left side"
		"rtrim", // "returns a string formed by removing any and all characters that appear in Y from the right side"
		"trim", // "returns a string formed by removing any and all characters that appear in Y from both ends of X"
		"replace", // "returns a string formed by substituting string Z for every occurrence of string Y in string X"
		"soundex", // "returns a string that is the soundex encoding of the string X"
	]),
	// --- date/time — lang_datefunc.html: date/time/datetime/strftime/timediff all format to TEXT.
	// unixepoch() is the one date function left OUT — its optional subsec modifier switches the
	// return between integer and floating-point, a call-shape (not argument-type) dependency this
	// registry has no precedent for modelling -----------------------------------------------------
	...group(fixed(S), ["date", "time", "datetime", "strftime", "timediff"]),
	// --- aggregate text — lang_aggfunc.html ---------------------------------------------------------
	...group(fixed(S), ["group_concat", "string_agg"]), // "returns a string which is the concatenation of all non-NULL values of X"

	// --- integer — lang_corefunc.html ---------------------------------------------------------------
	...group(fixed(I), [
		"length", // text: "number of Unicode code points"; blob: "number of bytes" — an integer either way
		"octet_length", // "returns the number of bytes in the encoding of text string X"
		"unicode", // "returns the numeric unicode code point corresponding to the first character of the string X"
		"instr", // "returns the number of prior characters plus 1, or 0 if Y is nowhere found within X"
		"sign", // "returns -1, 0, or +1" — always one of those three integers, regardless of whether X is REAL or INTEGER
	]),
	// --- bigint — values documented across the full 64-bit signed range --------------------------
	count: fixed(BIG), // lang_aggfunc.html: "returns a count of the number of times that X is not NULL in a group"
	random: fixed(BIG), // lang_corefunc.html: "returns a pseudo-random integer between -9223372036854775807 and +9223372036854775807"

	// --- real/double ---------------------------------------------------------------------------------
	round: fixed(D), // lang_corefunc.html: "returns a floating-point value X rounded to Y digits" — always real, even round(X) with no Y
	total: fixed(D), // lang_aggfunc.html: "result of total() is always a floating point value" (documented always-float, unlike sum())
	avg: fixed(D), // lang_aggfunc.html: "is always a floating point value whenever there is at least one non-NULL input" — unlike other dialects' input-typed AVG
	julianday: fixed(D), // lang_datefunc.html: "the Julian day - the fractional number of days since noon in Greenwich..."

	// --- blob ------------------------------------------------------------------------------------------
	...group(fixed(BIN), [
		"unhex", // "returns a BLOB value which is the decoding of the hexadecimal string X"
		"zeroblob", // "returns a BLOB consisting of N bytes of 0x00"
		"randomblob", // "return an N-byte blob containing pseudo-random bytes"
	]),

	// --- passthrough — lang_corefunc.html -----------------------------------------------------------
	abs: firstArg, // "returns the absolute value of the numeric argument X" — same numeric family as its input (firstArg is the universal cross-dialect precedent for abs)
	...group(firstArg, ["likelihood", "likely", "unlikely"]), // each: "returns argument X unchanged"

	// --- aggregate widening ------------------------------------------------------------------------
	// lang_aggfunc.html: "sum(X) ... Returns an integer if all inputs are integers; otherwise
	// returns floating-point" — exactly the int-family→bigint / float→double / decimal→decimal
	// shape widenSum already encodes (the same rule databricks/snowflake/redshift use verbatim).
	sum: (args) => widenSum(args[0] ?? UNKNOWN),

	// --- common-type — lang_corefunc.html: "returns a copy of its first non-NULL argument" -----------
	coalesce: common,
	ifnull: common,
};
