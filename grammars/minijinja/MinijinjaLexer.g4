/*
 * ANTLR4 lexer grammar for a single Jinja tag (split lexer + parser pair).
 *
 * This is the sqllens minijinja "island" front end (docs/minijinja-front-end.md, inc1). It lexes ONE
 * jinja tag's text — delimiters included — e.g. `{{ ref('x') }}`, `{% if c %}`, `{# c #}`. It
 * does NOT scan whole documents; a TS segmenter (Task 2) splits raw jinja-SQL into runs of SQL
 * text and tags, then feeds each tag here. Hand-authored (no upstream fork exists for jinja).
 *
 * Oracle: minijinja (the Rust engine dbt Fusion uses — NOT Jinja2; cited per rule). Reference:
 *   https://docs.rs/minijinja/latest/minijinja/syntax/index.html
 *
 * Lexer design — ISLAND MODES, patterned on grammars/postgres/PostgresLexer.g4's dollar-quote
 * `pushMode(DollarQuotedStringMode)`/`popMode`. The DEFAULT mode emits literal RAW_TEXT and, on
 * an opening delimiter (with the optional whitespace-control `-`), pushes an interior mode; the
 * closing delimiter pops. `{{`/`{%` share one interior mode (Minijinja) — both close tokens live
 * there and the parser tells expr-tags from stmt-tags by which OPEN started them; `{#` uses a
 * separate CommentMode whose body is opaque. No `caseInsensitive` (jinja keywords are lowercase).
 * A `{% raw %}` tag lexes as an ordinary stmt tag here — raw-block spanning is the segmenter's job.
 */

lexer grammar MinijinjaLexer;

// ===========================================================================
// DEFAULT mode — literal text and tag openings (minijinja: "Delimiters").
// {{ … }} expressions, {% … %} statements, {# … #} comments, each with the
// four whitespace-control variants ({{- -}} etc.). The optional leading `-`
// is whitespace control (minijinja "Whitespace Control").
// ===========================================================================

EXPR_OPEN
	: '{{' '-'? -> pushMode(Minijinja)
	;

STMT_OPEN
	: '{%' '-'? -> pushMode(Minijinja)
	;

COMMENT_OPEN
	: '{#' '-'? -> pushMode(Comment)
	;

// Any run of literal text that does not begin a delimiter. `{` is only literal
// when not followed by `{`, `%`, or `#` (those are handled by the OPEN tokens
// above via maximal munch). Keeps the lexer total on document-shaped input.
RAW_TEXT
	: ( ~'{' | '{' ~[{%#] )+
	;

// Totality fallback: a lone `{` at end-of-input (or any otherwise-unmatched
// char) — never throws, degrades to a single stray token.
STRAY
	: .
	;

// ===========================================================================
// Interior mode for {{ … }} and {% … %} — the minijinja expression/statement
// language (minijinja "Expressions"). Both close tokens live here; the parser
// pairs them with the opening delimiter.
// ===========================================================================

mode Minijinja;

// Closing delimiters, with optional whitespace-control `-`. Longest-match wins
// over MINUS `-` / RBRACE `}` at `-}}` / `}}`.
EXPR_CLOSE
	: '-'? '}}' -> popMode
	;

STMT_CLOSE
	: '-'? '%}' -> popMode
	;

JWS
	: [ \t\r\n]+ -> channel(HIDDEN)
	;

// String literals — single OR double quoted, with backslash escapes (minijinja
// "Literals": strings). Kept permissive so no real dbt string is rejected.
STRING
	: '\'' ( '\\' . | ~['\\] )* '\''
	| '"'  ( '\\' . | ~["\\] )* '"'
	;

// Numeric literals (minijinja "Literals": integers dec/hex/oct/bin with `_`
// group separators; floats). FLOAT before INT so `1.5` is not lexed as `1`.
FLOAT
	: DIGITS '.' DIGITS ( [eE] [+-]? DIGITS )?
	| DIGITS [eE] [+-]? DIGITS
	;

INT
	: '0' [xX] [0-9a-fA-F] [0-9a-fA-F_]*
	| '0' [oO] [0-7] [0-7_]*
	| '0' [bB] [01] [01_]*
	| DIGITS
	;

fragment DIGITS
	: [0-9] [0-9_]*
	;

// Constants (minijinja "Literals": true/false/none). Both cases accepted for
// Jinja2 source compatibility (dbt templates commonly use Python-style True/None).
TRUE  : 'true'  | 'True'  ;
FALSE : 'false' | 'False' ;
NONE  : 'none'  | 'None' | 'null' ;

// Expression-operator keywords (minijinja "Expressions": logic/membership/test/
// conditional). These stay operators and are NOT foldable into `id`.
AND  : 'and' ;
OR   : 'or'  ;
NOT  : 'not' ;
IN   : 'in'  ;
IS   : 'is'  ;
IF   : 'if'  ;
ELSE : 'else' ;

// Statement keywords (minijinja "Statements"). These may also serve as
// identifiers in expression position — the parser's `id` rule folds them back
// (a macro/variable named e.g. `filter` must still parse). Leading-keyword
// recognition for stmt tags reads these directly.
ELIF          : 'elif' ;
ENDIF         : 'endif' ;
FOR           : 'for' ;
ENDFOR        : 'endfor' ;
SET           : 'set' ;
ENDSET        : 'endset' ;
MACRO         : 'macro' ;
ENDMACRO      : 'endmacro' ;
CALL          : 'call' ;
ENDCALL       : 'endcall' ;
FILTER        : 'filter' ;
ENDFILTER     : 'endfilter' ;
BLOCK         : 'block' ;
ENDBLOCK      : 'endblock' ;
EXTENDS       : 'extends' ;
INCLUDE       : 'include' ;
IMPORT        : 'import' ;
FROM          : 'from' ;
WITH          : 'with' ;
ENDWITH       : 'endwith' ;
AUTOESCAPE    : 'autoescape' ;
ENDAUTOESCAPE : 'endautoescape' ;
RAW           : 'raw' ;
ENDRAW        : 'endraw' ;
DO            : 'do' ;
BREAK         : 'break' ;
CONTINUE      : 'continue' ;
AS            : 'as' ;

// Identifiers (minijinja: same rules as Python identifiers).
ID
	: [a-zA-Z_] [a-zA-Z0-9_]*
	;

// Punctuation and operators (minijinja "Expressions"). Multi-char operators are
// listed before their single-char prefixes so maximal munch resolves ties.
POW    : '**' ;
STAR   : '*' ;
DSLASH : '//' ;
SLASH  : '/' ;
PLUS   : '+' ;
MINUS  : '-' ;
PERCENT: '%' ;
EQ     : '==' ;
NE     : '!=' ;
LE     : '<=' ;
GE     : '>=' ;
LT     : '<' ;
GT     : '>' ;
ASSIGN : '=' ;
LPAREN : '(' ;
RPAREN : ')' ;
LBRACK : '[' ;
RBRACK : ']' ;
LBRACE : '{' ;
RBRACE : '}' ;
COMMA  : ',' ;
COLON  : ':' ;
DOT    : '.' ;
PIPE   : '|' ;
TILDE  : '~' ;

// Totality fallback inside a tag: any otherwise-unrecognized char degrades to a
// single token instead of throwing (R5). The parser treats it as leftover.
MINIJINJA_ANY
	: .
	;

// ===========================================================================
// Comment mode for {# … #} (minijinja "Comments"). Body is opaque — one
// COMMENT_TEXT token up to the close. The optional whitespace-control `-` on
// the close is absorbed into the body here (comment content is not structured
// at inc1); the close still pops correctly.
// ===========================================================================

mode Comment;

COMMENT_CLOSE
	: '-'? '#}' -> popMode
	;

COMMENT_TEXT
	: ( '#' ~'}' | ~'#' )+
	;

COMMENT_ANY
	: .
	;
