import { CharStream, CommonTokenStream, Token as AntlrToken, type ParserRuleContext } from "antlr4ng";
import { MinijinjaLexer } from "../generated/minijinja/MinijinjaLexer.js";
import { MinijinjaParser } from "../generated/minijinja/MinijinjaParser.js";
import { makeErrorCollector, type SyntaxDiagnostic } from "../parse-diagnostics.js";

// ---------------------------------------------------------------------------
// The first file of the jinja front-end module (docs/minijinja-front-end.md, inc1).
// A minimal wrapper that lexes + parses ONE jinja tag's text (delimiters
// included) with the generated island grammar. Unlike the SQL wrappers this
// uses the DEFAULT recovering error strategy (not BailErrorStrategy), so a
// half-typed `{{ ref(` yields a best-effort tree plus positioned diagnostics
// and never throws (R5 totality). Whole-document scanning is Task 2's job.
// ---------------------------------------------------------------------------

export interface MinijinjaTagParseResult {
	/** The CST rooted at `tag`. Always defined, even on broken/partial input. */
	tree: ParserRuleContext;
	/** Count of lexer + parser syntax errors (0 on a clean tag). */
	errors: number;
	/** Positioned syntax diagnostics (message + line/column/offset/length). */
	diagnostics: SyntaxDiagnostic[];
}

/** Lex + parse a single jinja tag. Total: never throws on any input. */
export function parseMinijinjaTag(text: string): MinijinjaTagParseResult {
	const lexer = new MinijinjaLexer(CharStream.fromString(text));
	const tokens = new CommonTokenStream(lexer);
	const parser = new MinijinjaParser(tokens);

	const collector = makeErrorCollector();
	lexer.removeErrorListeners();
	lexer.addErrorListener(collector.listener as never);
	parser.removeErrorListeners();
	parser.addErrorListener(collector.listener as never);

	const tree = parser.tag();
	return {
		tree,
		errors: collector.diagnostics.length,
		diagnostics: collector.diagnostics,
	};
}

/** The jinja lexer plus its full token list for one tag's text (delimiters included). */
export interface MinijinjaLexResult {
	/** The lexer instance — its `.vocabulary` names the tokens for the neutral mapping. */
	lexer: MinijinjaLexer;
	/** Every token (trivia on HIDDEN included, EOF excluded), tag-relative coordinates. */
	tokens: AntlrToken[];
}

/**
 * Lex a single jinja tag's text into its token list — the LEXER-only view Task 3
 * needs for the unified token stream (parse.ts offsets these into document
 * coordinates and stamps channel 2 / role `"minijinja"`). Total: the island lexer
 * recovers via its STRAY / MINIJINJA_ANY / COMMENT_ANY fallbacks rather than throwing,
 * and no throwing error listener is attached, so this never throws. `getAllTokens`
 * returns default- and hidden-channel tokens and excludes the EOF sentinel.
 */
export function lexMinijinjaTag(text: string): MinijinjaLexResult {
	const lexer = new MinijinjaLexer(CharStream.fromString(text));
	lexer.removeErrorListeners();
	return { lexer, tokens: lexer.getAllTokens() };
}
