/*
 * ANTLR4 lexer grammar for jinja-SQL (split lexer + parser pair).
 *
 * This is the sqllens minijinja "island" front end (docs/minijinja-front-end.md, inc1-inc2). It scans
 * WHOLE documents: the DEFAULT mode emits literal RAW_TEXT plus tag-opening delimiters, the `Minijinja`/
 * `Comment` interior modes lex one `{{ }}`/`{% %}`/`{# #}` tag's body, and the `RawBody` mode spans a
 * `{% raw %} … {% endraw %}` literal block as one run of text (minijinja "Template Inheritance" / raw
 * blocks — see below). `src/minijinja/segment.ts` (Task 2) drives this single whole-document
 * tokenization to build the length/newline-preserving SQL placeholder; a single tag's text (e.g.
 * `{{ ref('x') }}` alone, fed by `src/minijinja/parse-tag.ts`) still works unchanged — a lone tag is
 * itself a valid (one-token-longer) document. Hand-authored (no upstream fork exists for jinja).
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
 *
 * `{% raw %}` raw-block spanning: minijinja's raw blocks are literal — "the contents ... are not
 * interpreted as Jinja code" and the block ends at the FIRST `{% endraw %}`, full stop (reference
 * above, "Template Inheritance" § raw / "Whitespace Control"). Purely declarative: `RAW_TAG` lexes
 * the ENTIRE `{% raw %}` opener as ONE token (maximal munch beats STMT_OPEN's bare `{%` wherever it
 * matches) and pushes `RawBody`, whose only exit is `ENDRAW_TAG` — the entire `{% endraw %}` as one
 * token. The full-tag shapes give exactness for free: `{% rawx %}` / `{% endrawX %}` / `{% raw x %}`
 * simply fail the rules (no predicate, no lexer state), so they lex as ordinary stmt tags / literal
 * raw text. Everything else in RawBody, including text that LOOKS like a jinja tag or a quoted
 * string, is opaque literal text.
 */

lexer grammar MinijinjaLexer;

// ===========================================================================
// DEFAULT mode — literal text and tag openings (minijinja: "Delimiters").
// {{ … }} expressions, {% … %} statements, {# … #} comments, each with the
// four whitespace-control variants ({{- -}} etc.). The optional leading `-`
// is whitespace control (minijinja "Whitespace Control").
// ===========================================================================

// The ENTIRE `{% raw %}` opener as one token (whitespace-control variants and
// internal spacing included). Longest match wins over STMT_OPEN's bare `{%`, so
// no lexer state is needed to detect the raw keyword; a near-miss (`{% rawx %}`,
// `{% raw x %}` — minijinja: raw takes no arguments) fails this rule and lexes
// as an ordinary stmt tag instead of opening a raw block.
RAW_TAG
	: '{%' '-'? [ \t\r\n]* 'raw' [ \t\r\n]* '-'? '%}' -> pushMode(RawBody)
	;

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

// ===========================================================================
// RawBody mode — the literal interior of a `{% raw %} … {% endraw %}` block
// (minijinja raw blocks: content is literal until the first `{% endraw %}`, no
// interpretation of the body — see the header's raw-block citation). Entered
// by RAW_TAG's pushMode, on top of DEFAULT on the mode stack.
// ===========================================================================

mode RawBody;

// The ENTIRE `{% endraw %}` closer as one token — the full-tag shape makes it
// exact with no predicate and no lexer state: `{% endrawX %}`, `{% endraw x %}`
// and an unterminated `{% endraw` all fail the rule and stay literal raw text
// (only a real endraw tag ends a raw block — minijinja semantics, see header).
ENDRAW_TAG
	: '{%' '-'? [ \t\r\n]* 'endraw' [ \t\r\n]* '-'? '%}' -> popMode
	;

// Literal raw-block text: any run not starting a `{%` (mirrors RAW_TEXT's `{`
// handling in DEFAULT mode, but only `{%` needs guarding here — a raw block has
// no `{{`/`{#` delimiters to protect).
RAW_BODY
	: ( '{' ~'%' | ~'{' )+
	;

// Totality fallback: a lone `{` before `%` that isn't a real `{% endraw %}`
// (ENDRAW_TAG failed to match, e.g. `{% if %}` or `{% endrawX %}` inside raw)
// resumes as RAW_BODY from the next char — one stray token, never throws.
RAW_BODY_STRAY
	: .
	;
