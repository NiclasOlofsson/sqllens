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
	/**
	 * How a KEYWORD-role token was actually consumed by the parse, derived post-parse from the CST
	 * (see `consumed-as.ts`): `"identifier"` when the parser's grammar absorbed it through a
	 * non-reserved-word / name-wrapper rule (a keyword used as a bare column/table/alias name),
	 * `"type"` when absorbed through a data-type production (a keyword used as a type name, only
	 * for the dialects where that grammar cleanly separates from identifier use; see the per-dialect
	 * notes next to `CONSUMED_AS_RULES`), `"keyword"` when neither: the token's ordinary keyword
	 * sense. ABSENT (no field) for: every non-keyword-role token, `tokenize()`'s lexer-only stream (no
	 * parse ran), a keyword-role token the parse never actually consumed (error-recovery skipped
	 * regions; hidden-channel tokens never reach the parser to begin with), and any case with no
	 * clean verdict. Honest absence, never a guess.
	 */
	consumedAs?: "keyword" | "identifier" | "type";
}
