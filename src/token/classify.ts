// ---------------------------------------------------------------------------
// Token role classifier — a shared heuristic over lexer vocabulary metadata,
// plus a per-dialect override slot.
//
// The role is decided from the token *type number* and the lexer's vocabulary
// (symbolic name + literal name), never from a live token instance: the channel
// (HIDDEN vs default) is recorded separately on the Token in Task 2. This keeps
// the classifier a pure function of the lexer's static type table.
//
// Order of decision:
//   1. literal-name heuristic (alphabetic literal -> keyword; bracket/comma/etc.
//      -> punctuation; other symbols -> operator). Keyword/punctuation/operator
//      tokens carry a fixed literal name; the lexical tokens (string/identifier/
//      number/comment/whitespace) have none and fall through;
//   2. symbolic-name rules: per-dialect override map (regex over the symbolic
//      name) first, then the shared defaults;
//   3. fallback -> "other".
// ---------------------------------------------------------------------------

import type { Lexer } from "antlr4ng";
import type { Dialect } from "../dialect.js";
import type { TokenRole } from "./token.js";

/** A symbolic-name regex that maps a matching token type to a role. */
interface RoleRule {
	role: TokenRole;
	pattern: RegExp;
}

// Shared default rules, applied to every dialect. Keyed by a regex over the
// vocabulary's symbolic name (e.g. IDENTIFIER, STRING_LITERAL, WS). These names
// are stable across antlr-generated lexers, so the same rules fit all dialects.
const DEFAULT_RULES: RoleRule[] = [
	{ role: "identifier", pattern: /ID|IDENTIFIER/ },
	{ role: "string", pattern: /STRING|CHAR|DQ|SQ|DOLLAR/ },
	{ role: "number", pattern: /NUMBER|INT|FLOAT|DECIMAL|REAL|DIGIT/ },
	{ role: "comment", pattern: /COMMENT/ },
	{ role: "whitespace", pattern: /^WS$|WHITESPACE|^SPACE/ },
];

// Per-dialect override rules, checked before the shared defaults. Each dialect
// gets a slot; the others are seeded in Task 2 as their lexers are surveyed.
//
// Databricks (Spark grammar, vendor/spark/SqlBaseLexer.g4): the shared defaults
// already cover its IDENTIFIER, STRING_LITERAL, {DECIMAL,INTEGER,...}_VALUE,
// BRACKETED_COMMENT/SIMPLE_COMMENT, and WS tokens, so no override is needed yet.
const DIALECT_RULES: Record<Dialect, RoleRule[]> = {
	databricks: [],

	// T-SQL (grammars-v4 TSqlLexer): the shared defaults already classify its
	// ID/DOUBLE_QUOTE_ID/SQUARE_BRACKET_ID/LOCAL_ID/TEMP_ID identifiers, STRING,
	// {DECIMAL,FLOAT,REAL} numbers, COMMENT/LINE_COMMENT, and SPACE whitespace, so
	// no override is needed.
	tsql: [],

	// Snowflake (grammars-v4 SnowflakeLexer): two corrections to the defaults.
	snowflake: [
		// The block-comment token SQL_COMMENT is wrongly caught by the default
		// string rule (its name contains "SQ"); reclassify it as a comment first.
		{ role: "comment", pattern: /^SQL_COMMENT$/ },
		// BINARY_LITERAL is a string literal the default string rule misses.
		{ role: "string", pattern: /^BINARY_LITERAL$/ },
	],

	// BigQuery (GoogleSQLLexer): BYTES_LITERAL is a string literal the default
	// string rule misses (STRING_LITERAL is already covered).
	bigquery: [{ role: "string", pattern: /BYTES_LITERAL/ }],

	// Redshift (Postgres-derived RedshiftLexer): its lexical token names are
	// mixed-case (Identifier, StringConstant, Integral/Numeric, LineComment,
	// Whitespace), which the case-sensitive uppercase defaults all miss. Match
	// the exact mixed-case forms so keyword tokens (COMMENT, NUMERIC, …) are not
	// grabbed.
	redshift: [
		// Identifier, QuotedIdentifier, UnicodeQuotedIdentifier, Temporary/Namespace
		// and the PL/pgSQL variable/identifier tokens.
		{ role: "identifier", pattern: /Identifier|PLSQLVARIABLENAME|PLSQLIDENTIFIER/ },
		// StringConstant family (Escape/Unicode/Binary/Hexadecimal/…) and the
		// dollar-quoted-body DollarText token.
		{ role: "string", pattern: /StringConstant|DollarText/ },
		// Integral, Numeric, NumericFail.
		{ role: "number", pattern: /Integral|Numeric/ },
		// LineComment, BlockComment, UnterminatedBlockComment.
		{ role: "comment", pattern: /LineComment|BlockComment/ },
		// Whitespace.
		{ role: "whitespace", pattern: /^Whitespace$/ },
	],

	// Postgres (bytebase/parser postgresql/ fork) and DuckDB (fork of our postgres pair): the
	// same TVL-lineage lexer as Redshift, so the same mixed-case token names apply.
	postgres: [
		{ role: "identifier", pattern: /Identifier|PLSQLVARIABLENAME|PLSQLIDENTIFIER/ },
		{ role: "string", pattern: /StringConstant|DollarText/ },
		{ role: "number", pattern: /Integral|Numeric/ },
		{ role: "comment", pattern: /LineComment|BlockComment/ },
		{ role: "whitespace", pattern: /^Whitespace$/ },
	],
	duckdb: [
		{ role: "identifier", pattern: /Identifier|PLSQLVARIABLENAME|PLSQLIDENTIFIER/ },
		{ role: "string", pattern: /StringConstant|DollarText/ },
		{ role: "number", pattern: /Integral|Numeric/ },
		{ role: "comment", pattern: /LineComment|BlockComment/ },
		{ role: "whitespace", pattern: /^Whitespace$/ },
	],

	// Trino (first-party SqlBase.g4 split): uppercase names, mostly covered by the defaults;
	// two misses - BINARY_LITERAL (a string form) and DOUBLE_VALUE (a number form).
	trino: [
		{ role: "string", pattern: /^BINARY_LITERAL$/ },
		{ role: "number", pattern: /^DOUBLE_VALUE$/ },
	],

	// MySQL (grammars-v4 mysql/Positive-Technologies): two corrections the R6.5 probe proved.
	mysql: [
		// SPEC_MYSQL_COMMENT (`/*! ... */`, the version-conditional executable comment,
		// dev.mysql.com/doc/refman/8.4/en/comments.html) is a comment, but the default string rule grabs
		// it first — its symbolic name contains "SQ" (from "MY-SQ-L"). Reclassify to comment.
		{ role: "comment", pattern: /^SPEC_MYSQL_COMMENT$/ },
		// FILESIZE_LITERAL (`10M` / `4G` = DEC_DIGIT+ ('K'|'M'|'G'|'T'), the tablespace/logfile size
		// literal, dev.mysql.com/doc/refman/8.4/en/create-tablespace.html) is a numeric literal, but its
		// symbolic name matches none of the default number substrings, so it falls through to "other".
		{ role: "number", pattern: /^FILESIZE_LITERAL$/ },
		// STRING_CHARSET_NAME (`_utf8` / `_binary`, the character-set introducer that always immediately
		// precedes a STRING/HEX literal, dev.mysql.com/doc/refman/8.4/en/charset-introducer.html) is left
		// as the default "string": it binds to and renders with the string constant it introduces, so no
		// override is warranted. (Recorded here as the deliberate R6.5 decision, not an oversight.)
	],

	// SQLite (grammars-v4 SqliteLexer): two corrections to the defaults.
	sqlite: [
		// NUMERIC_LITERAL doesn't match any of the shared "number" substrings
		// (NUMBER|INT|FLOAT|DECIMAL|REAL|DIGIT), so it falls through to "other" without this override.
		{ role: "number", pattern: /^NUMERIC_LITERAL$/ },
		// BLOB_LITERAL (X'…' hex/binary string, https://sqlite.org/lang_expr.html#literal_values_constants_)
		// is a binary string literal the default string rule misses — classify it as a string, matching how
		// the other dialects treat their binary/hex literals (snowflake/trino BINARY_LITERAL, bigquery BYTES_LITERAL).
		{ role: "string", pattern: /^BLOB_LITERAL$/ },
	],
};

const PUNCTUATION = new Set(["(", ")", "[", "]", "{", "}", ",", ";", "."]);

/**
 * Classify one lexer token type into a coarse role for the given dialect.
 * Pure over the lexer's static vocabulary; does not look at any token instance.
 */
export function classifyToken(lexer: Lexer, type: number, dialect: Dialect): TokenRole {
	// 1. Literal-name heuristic first. Keyword/punctuation/operator tokens carry a
	//    fixed literal name (e.g. "'SELECT'" or "'('"); the lexical tokens
	//    (string/identifier/number/comment/whitespace) are rule-defined and have NO
	//    literal name, so they fall through to the symbolic-name rules below. Doing
	//    this first prevents keywords like VARCHAR/CHAR/SUBSTRING from being grabbed
	//    by a default regex that matches a substring of their symbolic name.
	const literal = lexer.vocabulary.getLiteralName(type);
	if (literal) {
		const text = literal.replace(/^'|'$/g, "");
		if (/^[A-Za-z_]/.test(text)) return "keyword";
		if (PUNCTUATION.has(text)) return "punctuation";
		// A handful of grammars (MySQL-PT's ZERO_DECIMAL/ONE_DECIMAL/TWO_DECIMAL, defined as exact
		// '0'/'1'/'2' lexer rules for parser disambiguation) give a NUMERIC literal a fixed literal
		// name too, breaking this branch's "lexical tokens have none" assumption — a bare-digit
		// literal is a number, never an operator symbol.
		if (/^[0-9]+$/.test(text)) return "number";
		return "operator";
	}

	// 2. Symbolic-name rules: per-dialect overrides first, then the shared
	//    defaults — both keyed by a regex over the symbolic name.
	const symbolic = lexer.vocabulary.getSymbolicName(type);
	if (symbolic) {
		for (const rule of DIALECT_RULES[dialect]) {
			if (rule.pattern.test(symbolic)) return rule.role;
		}
		for (const rule of DEFAULT_RULES) {
			if (rule.pattern.test(symbolic)) return rule.role;
		}
	}

	// 3. Fallback.
	return "other";
}

/**
 * Classify one minijinja-island lexer token. Minijinja is a FOREIGN vocabulary (not a
 * `Dialect`, no `DIALECT_RULES` entry): every minijinja token — delimiters, keywords,
 * identifiers, strings, operators, whitespace — carries the single coarse role
 * `"minijinja"` so the unified templated stream tells minijinja tokens from SQL tokens at
 * a glance. A finer minijinja sub-classification is a later-increment concern; inc1
 * stamps them all `"minijinja"` (spec §R1). Pure passthrough — the args are kept for a
 * future refinement seam and to mirror `classifyToken`'s shape.
 */
export function classifyMinijinjaToken(_lexer: Lexer, _type: number): TokenRole {
	return "minijinja";
}
