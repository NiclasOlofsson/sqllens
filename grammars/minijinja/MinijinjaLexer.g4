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
 * above, "Template Inheritance" § raw / "Whitespace Control"). The `@members` `nextToken()` override
 * below detects a `{% raw %}` stmt tag (RAW as its leading keyword) and pushes the `RawBody` mode,
 * whose only exit is `ENDRAW_OPEN` — an exact `{% endraw %}` (predicate-guarded so `{% endrawX %}`
 * stays literal). Everything else in RawBody, including text that LOOKS like a jinja tag or a quoted
 * string, is opaque literal text.
 */

lexer grammar MinijinjaLexer;

@members {
	// Raw-block ({% raw %} … {% endraw %}) detection state, consulted/reset by nextToken() below.
	// `stmtOpened` is true only for the single token immediately following a STMT_OPEN — long enough
	// to see whether RAW is that tag's leading keyword (a variable named `raw`, e.g. `{% set raw = 1
	// %}`, must NOT trigger: SET consumes and clears `stmtOpened` before the RAW token arrives).
	private stmtOpened = false;
	// True once RAW has been seen as a stmt tag's leading keyword; consumed by that same tag's
	// STMT_CLOSE, which pushes RawBody.
	private rawPending = false;

	/**
	 * Semantic predicate for ENDRAW_OPEN: the next input char must not continue an identifier, so
	 * `{% endrawX %}` stays literal RawBody text — only an EXACT `endraw` tag closes the block
	 * (minijinja raw-block semantics, see the header above). LA(1) returns -1 at EOF, which is
	 * correctly "not an identifier char".
	 */
	private laNotIdentifier(): boolean {
		const c = this.inputStream.LA(1);
		return !((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || c === 95 || (c >= 97 && c <= 122));
	}

	/**
	 * Detects a `{% raw %}` stmt tag — STMT_OPEN, then RAW as the tag's very first token, then
	 * STMT_CLOSE — and pushes RawBody so the literal block that follows is scanned as opaque text,
	 * not re-segmented into further tags. The channel guard skips hidden JWS (whitespace) tokens so
	 * whitespace between `{%` and `raw` doesn't defeat detection. `pushMode` (not `mode`) here because
	 * RawBody must sit ON TOP of the pre-tag mode (DEFAULT) on the mode stack; ENDRAW_OPEN's own
	 * `-> mode(Minijinja)` command (a plain mode-set, not push/pop) then leaves that stack entry
	 * intact so the endraw tag's STMT_CLOSE `popMode` correctly returns to DEFAULT.
	 */
	public override nextToken(): Token {
		const t = super.nextToken();
		if (t.channel === Token.DEFAULT_CHANNEL && t.type !== Token.EOF) {
			if (t.type === MinijinjaLexer.STMT_OPEN) {
				this.stmtOpened = true;
				this.rawPending = false;
			} else {
				if (t.type === MinijinjaLexer.RAW && this.stmtOpened) this.rawPending = true;
				if (t.type === MinijinjaLexer.STMT_CLOSE && this.rawPending) {
					this.rawPending = false;
					this.pushMode(MinijinjaLexer.RawBody);
				}
				this.stmtOpened = false;
			}
		}
		return t;
	}
}

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

// ===========================================================================
// RawBody mode — the literal interior of a `{% raw %} … {% endraw %}` block
// (minijinja raw blocks: content is literal until the first `{% endraw %}`, no
// interpretation of the body — see the header's raw-block citation). Entered
// by the `nextToken()` override above, on top of DEFAULT on the mode stack.
// ===========================================================================

mode RawBody;

// Closes the raw block: an exact `endraw` keyword (optional whitespace-control
// `-`, any run of intervening whitespace), guarded so the following char must
// not continue an identifier (`{% endrawX %}` stays literal). `mode(Minijinja)`
// is a plain mode-set (see the nextToken doc above), NOT popMode+pushMode.
ENDRAW_OPEN
	: '{%' '-'? [ \t\r\n]* 'endraw' {this.laNotIdentifier()}? -> mode(Minijinja)
	;

// Literal raw-block text: any run not starting a `{%` (mirrors RAW_TEXT's `{`
// handling in DEFAULT mode, but only `{%` needs guarding here — a raw block has
// no `{{`/`{#` delimiters to protect).
RAW_BODY
	: ( '{' ~'%' | ~'{' )+
	;

// Totality fallback: a lone `{` before `%` that isn't `{% endraw ...%}` (the
// ENDRAW_OPEN predicate failed, e.g. `{% if %}` or `{% endrawX %}` inside raw)
// resumes as RAW_BODY from the next char — one stray token, never throws.
RAW_BODY_STRAY
	: .
	;
