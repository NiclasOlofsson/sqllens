import { parseType, scalar, UNKNOWN, type Type } from "./types.js";
import type { FnRule } from "./functions.js";

// ---------------------------------------------------------------------------
// MySQL inference knowledge — currently a minimal, honest stub (B-R4). `MYSQL_ALIASES` stays
// empty: MySQL's declared-type surface (INT/TINYINT/DECIMAL(p,s)/VARCHAR(n)/…, plus BOOL/BOOLEAN
// as documented TINYINT(1) synonyms — dev.mysql.com/doc/refman/8.4/en/numeric-type-syntax.html)
// is a real doc-driven alias table, deliberately deferred to B-R5.2 rather than assembled here.
// `MYSQL_FUNCTION_RETURNS` carries only the two return types the B-R4 brief itself certifies as
// argument-independent (dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html,
// .../string-functions.html); every other function — including the many numeric ones whose
// return type depends on argument type/precision — stays unregistered by design. Contract holds:
// an absent rule yields `unknown`, never a guess.
// ---------------------------------------------------------------------------

export const MYSQL_ALIASES: Record<string, string> = {};

export function mysqlParseType(text: string): Type {
	return parseType(text, MYSQL_ALIASES, "mysql");
}

const S = scalar("string");
const BIG = scalar("bigint");
const I = scalar("int");
const D = scalar("double");
const BIN = scalar("binary");

const fixed =
	(t: Type): FnRule =>
	() =>
		t;

/** MySQL literal forms (dev.mysql.com/doc/refman/8.4/en/literals.html). TRUE/FALSE are documented
 *  synonyms for the integers 1/0 (.../numeric-type-syntax.html "BOOL, BOOLEAN ... TINYINT(1)"),
 *  not a distinct boolean type. A hexadecimal literal (X'…' / 0x…) is, per its own syntax alone
 *  with no surrounding context, "a binary string" by default (.../hexadecimal-literals.html) — the
 *  numeric-context reinterpretation needs the call site, which this text-only classifier doesn't
 *  have, so it stays at the documented default rather than guessing. Bit-value literals (b'…' /
 *  0b…) are left UNKNOWN: unlike hex literals, the docs don't name a context-free default
 *  (.../bit-value-literals.html), so classifying either way would be a guess. */
export function mysqlLiteral(text: string): Type {
	const t = text.trim();
	if (/^['"]/.test(t)) return S; // string literal ('…' or "…")
	if (/^x'/i.test(t) || /^0x[0-9a-f]+$/i.test(t)) return BIN; // hexadecimal literal
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^(true|false)$/i.test(t)) return I; // TINYINT(1) synonyms, not a boolean type
	if (/^[+-]?\d+$/.test(t)) return I; // plain integer, no '.' or exponent
	if (/^[+-]?(\d+\.\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return D; // has a '.'
	if (/^[+-]?\d+[eE][+-]?\d+$/.test(t)) return D; // exponent form, no '.'
	return UNKNOWN;
}

export const MYSQL_FUNCTION_RETURNS: Record<string, FnRule> = {
	// dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html#function_count:
	// "The return value is a BIGINT value" — unconditional on the argument.
	count: fixed(BIG),
	// dev.mysql.com/doc/refman/8.4/en/string-functions.html#function_concat: "Returns NULL if any
	// argument is NULL" and otherwise concatenates its arguments into one string.
	concat: fixed(S),
};
