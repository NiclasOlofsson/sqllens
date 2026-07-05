/*
 * ANTLR4 parser grammar for a single Jinja tag (split lexer + parser pair).
 *
 * Companion to MinijinjaLexer.g4 (docs/minijinja-front-end.md, inc1). Q2 scope: recognize CALLS
 * precisely (this is what R2 / Task 4 extracts — ref/source/macro-call), plus literals, dotted
 * and subscript access, and grouping; the rest of the expression language (filters `|`, tests
 * `is`, arithmetic, `~`, the conditional `a if b else c`) is modeled loosely/opaque — enough to
 * not reject real dbt, precise enough that a `call` is recognizable. Statement tags recognize
 * the leading keyword and tokenize the rest loosely (precise if/for/set structure is inc2).
 *
 * Oracle: minijinja. https://docs.rs/minijinja/latest/minijinja/syntax/index.html
 * The parse is error-tolerant (R5): the wrapper uses the default recovering error strategy, so a
 * half-typed `{{ ref(` yields a best-effort tree + positioned diagnostics and never throws.
 */

parser grammar MinijinjaParser;

options {
	tokenVocab = MinijinjaLexer;
}

// Entry — a run of tags and/or literal text, EOF-anchored. Per-tag input is one
// tag; the `*` + RAW_TEXT tolerance keeps it total on surrounding text too.
tag
	: ( expr_tag | stmt_tag | comment_tag | raw_tag | endraw_tag | RAW_TEXT | STRAY )* EOF
	;

expr_tag
	: EXPR_OPEN expr? EXPR_CLOSE
	;

stmt_tag
	: STMT_OPEN stmt STMT_CLOSE
	;

comment_tag
	: COMMENT_OPEN COMMENT_TEXT? COMMENT_CLOSE
	;

// A `{% raw %}` / `{% endraw %}` block delimiter, as it arrives in a DOCUMENT-native token
// slice: the lexer recognizes each ENTIRE tag as ONE token (RAW_TAG in DEFAULT mode,
// ENDRAW_TAG in RawBody mode — see MinijinjaLexer.g4), so neither goes through
// `stmt_tag`/`stmt`'s ordinary STMT_OPEN+keyword shape. A near-miss (`{% raw x %}`,
// `{% endrawX %}`) fails the lexer rule and never produces these tokens at all.
raw_tag
	: RAW_TAG
	;

endraw_tag
	: ENDRAW_TAG
	;

// Statement body — recognize the leading keyword, then tokenize the rest
// loosely: an `expr` where one starts (so calls inside {% set x = ref('y') %}
// are recognized for R2), otherwise any token that is not the close (covers the
// connectives `= , as import from in` etc.). Precise structure is inc2.
//
// The lead is `keyword` for a known jinja keyword (a KeywordContext inc2/Task 4
// key off) OR an unknown `id` — so dbt-custom statement tags in non-model files
// (`{% snapshot s %}`, `{% docs d %}`, `{% materialization m, default %}`,
// `{% test t(model, col) %}`) parse with 0 errors instead of false-erroring on a
// non-jinja lead. `keyword` is first so known leads still bind to KeywordContext.
stmt
	: ( keyword | id )? ( expr | ~STMT_CLOSE )*
	;

keyword
	: IF | ELIF | ELSE | ENDIF
	| FOR | ENDFOR
	| SET | ENDSET
	| MACRO | ENDMACRO
	| CALL | ENDCALL
	| FILTER | ENDFILTER
	| BLOCK | ENDBLOCK
	| EXTENDS | INCLUDE | IMPORT | FROM
	| WITH | ENDWITH
	| AUTOESCAPE | ENDAUTOESCAPE
	| RAW | ENDRAW
	| DO | BREAK | CONTINUE
	;

// ---------------------------------------------------------------------------
// Expressions. The precedence chain bottoms out at the left-recursive `primary`
// (where calls / member access / subscript live). Operator layers above it are
// loose — modeled enough to accept real dbt, not to pin exact semantics (inc1).
// ---------------------------------------------------------------------------

expr
	: cond
	;

// Conditional a if b else c (minijinja "if expression").
cond
	: or_expr ( IF or_expr ( ELSE or_expr )? )?
	;

or_expr
	: and_expr ( OR and_expr )*
	;

and_expr
	: not_expr ( AND not_expr )*
	;

not_expr
	: NOT not_expr
	| comparison
	;

// Comparisons and membership/identity tests (minijinja: == != < <= > >= in,
// `is <test>`). RHS is a full `concat`, so `x is defined` / `x is not none` /
// `x is divisibleby(3)` all parse (the test name/args ride as an ordinary
// primary/call — opaque at inc1).
comparison
	: concat ( comp_op concat )*
	;

comp_op
	: EQ | NE | LT | LE | GT | GE
	| IN
	| NOT IN
	| IS NOT?
	;

// String/other concatenation `~` (minijinja).
concat
	: additive ( TILDE additive )*
	;

additive
	: term ( ( PLUS | MINUS ) term )*
	;

term
	: factor ( ( STAR | SLASH | DSLASH | PERCENT ) factor )*
	;

factor
	: ( PLUS | MINUS ) factor
	| power
	;

power
	: filtered ( POW factor )*
	;

// Filters (minijinja "Filters"): value | name / value | name(args). Opaque —
// captured, not semantically resolved, at inc1.
filtered
	: primary ( PIPE filter )*
	;

filter
	: id ( LPAREN arg_list? RPAREN )?
	;

// The core, precise part (Q2): calls, member access, subscript, grouping,
// literals, names. Left-recursive — ANTLR4 resolves it; `callExpr` is the R2
// target (its left operand is the callee name path; `arg_list` its arguments).
primary
	: primary LPAREN arg_list? RPAREN                            # callExpr
	| primary DOT id                                             # memberExpr
	| primary LBRACK subscript RBRACK                            # indexExpr
	| LPAREN expr ( COMMA expr )* COMMA? RPAREN                  # groupExpr
	| LBRACK ( expr ( COMMA expr )* COMMA? )? RBRACK             # listExpr
	| LBRACE ( dict_entry ( COMMA dict_entry )* COMMA? )? RBRACE # dictExpr
	| literal                                                    # literalExpr
	| id                                                         # nameExpr
	;

// Call arguments: positional and keyword (minijinja "Function/macro calls":
// k=v kwargs). Top-level commas split args; nested parens ride via `expr`.
arg_list
	: arg ( COMMA arg )* COMMA?
	;

arg
	: id ASSIGN expr # kwarg
	| expr           # posarg
	;

// Subscript / slice a[b], a[i:j:k] (minijinja "Subscripting" / slices).
subscript
	: slice_bound ( COLON slice_bound ( COLON slice_bound )? )?
	;

slice_bound
	: expr?
	;

dict_entry
	: expr COLON expr
	;

literal
	: STRING | INT | FLOAT | TRUE | FALSE | NONE
	;

// Identifier — a bare ID, or a statement keyword used in identifier position
// (so a macro/var named `filter`, `set`, `block`, … still parses). The
// expression-operator keywords (and/or/not/in/is/if/else) are intentionally NOT
// foldable here — they must stay operators.
id
	: ID
	| ELIF | ENDIF
	| FOR | ENDFOR
	| SET | ENDSET
	| MACRO | ENDMACRO
	| CALL | ENDCALL
	| FILTER | ENDFILTER
	| BLOCK | ENDBLOCK
	| EXTENDS | INCLUDE | IMPORT | FROM
	| WITH | ENDWITH
	| AUTOESCAPE | ENDAUTOESCAPE
	| RAW | ENDRAW
	| DO | BREAK | CONTINUE
	| AS
	;
