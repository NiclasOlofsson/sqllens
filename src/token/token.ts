// ---------------------------------------------------------------------------
// Neutral token type — a dialect-independent view of one lexer token.
//
// This is the first-class artifact the editor front end needs: every token with
// its exact span and a coarse role, decoupled from antlr's internal token classes.
// Task 1 defines the type and the role classifier; later tasks fill these from a
// `tokenize()` pass and thread them through `parse()`.
// ---------------------------------------------------------------------------

/** Coarse lexical role, derived from the lexer vocabulary (see classify.ts).
 *  `"minijinja"` is the foreign-vocabulary role every minijinja-island token carries in the
 *  unified templated stream (channel 2); SQL tokens never use it. Adding it is a
 *  closed-union change — every exhaustive `TokenRole` consumer gets a `"minijinja"` arm
 *  (the semantic-token color map skips it, so minijinja tokens are not SQL-highlighted). */
export type TokenRole =
	| "keyword"
	| "identifier"
	| "string"
	| "number"
	| "comment"
	| "operator"
	| "punctuation"
	| "whitespace"
	| "minijinja"
	| "other";

/** One lexer token, with exact source span and a coarse role. */
export interface Token {
	/** antlr token type number. */
	type: number;
	/** symbolic name (vocabulary.getSymbolicName) ?? display name. */
	name: string;
	text: string;
	/** 0-based inclusive char offset (antlr token.start). */
	start: number;
	/** 0-based inclusive char offset (antlr token.stop). */
	stop: number;
	/** 1-based (antlr token.line). */
	line: number;
	/** 0-based (antlr token.column). */
	column: number;
	/** 1-based line of the token END (one past the last char; multi-line tokens advance it). */
	endLine: number;
	/** 0-based column of the token END (one past the last char). */
	endColumn: number;
	/** 0 = default, 1 = HIDDEN. */
	channel: number;
	role: TokenRole;
}
