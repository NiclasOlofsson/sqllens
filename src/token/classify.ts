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
//   1. per-dialect override map (regex over the symbolic name), shared default
//      first, then the dialect's own entries;
//   2. literal-name heuristic (alphabetic literal -> keyword; bracket/comma/etc.
//      -> punctuation; other symbols -> operator);
//   3. fallback -> "other".
// ---------------------------------------------------------------------------

import type { Lexer } from "antlr4ng";
import type { Dialect } from "../api.js";
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
  tsql: [],
  snowflake: [],
  bigquery: [],
  redshift: [],
};

const PUNCTUATION = new Set(["(", ")", "[", "]", "{", "}", ",", ";", "."]);

/**
 * Classify one lexer token type into a coarse role for the given dialect.
 * Pure over the lexer's static vocabulary; does not look at any token instance.
 */
export function classifyToken(lexer: Lexer, type: number, dialect: Dialect): TokenRole {
  const symbolic = lexer.vocabulary.getSymbolicName(type);

  // 1. Per-dialect overrides first, then the shared defaults — both keyed by
  //    a regex over the symbolic name.
  if (symbolic) {
    for (const rule of DIALECT_RULES[dialect]) {
      if (rule.pattern.test(symbolic)) return rule.role;
    }
    for (const rule of DEFAULT_RULES) {
      if (rule.pattern.test(symbolic)) return rule.role;
    }
  }

  // 2. Literal-name heuristic. The literal carries surrounding single quotes,
  //    e.g. "'SELECT'" or "'('"; strip them, then classify by shape.
  const literal = lexer.vocabulary.getLiteralName(type);
  if (literal) {
    const text = literal.replace(/^'|'$/g, "");
    if (/^[A-Za-z_]/.test(text)) return "keyword";
    if (PUNCTUATION.has(text)) return "punctuation";
    return "operator";
  }

  // 3. Fallback.
  return "other";
}
