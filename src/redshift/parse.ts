import {
	type ANTLRErrorListener,
	BailErrorStrategy,
	CharStream,
	CommonTokenStream,
	type Lexer,
	type ParserATNSimulator,
	type ParserRuleContext,
	PredictionMode,
} from "antlr4ng";
import { RedshiftLexer } from "../generated/redshift/RedshiftLexer.js";
import { RedshiftParser } from "../generated/redshift/RedshiftParser.js";
import { makeErrorCollector, type SyntaxDiagnostic } from "../parse-diagnostics.js";
import { mapTokens } from "../token/map.js";
import type { Token } from "../token/token.js";

export interface ParseResult {
	/** The CST rooted at `root` (`stmtblock EOF` — a semicolon-separated batch of statements). */
	tree: ParserRuleContext;
	/** Count of lexer + parser syntax errors. */
	errors: number;
	/** Positioned syntax diagnostics (message + line/column/offset/length), in report order. */
	diagnostics: SyntaxDiagnostic[];
	/** Every lexer token (trivia included, EOF excluded), as neutral `Token`s with exact spans. */
	tokens: Token[];
	/** True when the fast SLL prediction pass bailed and the parse re-ran under full LL. Same result
	 *  either way — this just says which path produced it, for perf profiling (tools/profile-sll.ts). */
	sllFallback: boolean;
}

/**
 * Lex + parse Amazon Redshift SQL (one statement or a `;`-separated batch). Two-stage parsing:
 * try the fast SLL prediction mode first (bail on the first conflict), fall back to full LL
 * only when SLL fails — same result LL alone would give, just faster on valid input.
 */
export function parseRedshift(sql: string): ParseResult {
	const lexer = new RedshiftLexer(CharStream.fromString(sql));
	const tokens = new CommonTokenStream(lexer);
	const parser = new RedshiftParser(tokens);
	const sim = parser.interpreter as ParserATNSimulator;

	const collector = makeErrorCollector();
	attachErrorCounter(lexer, parser, collector.listener);
	// Force a full lex now so every lexer error fires eagerly (CommonTokenStream lexes lazily, and the
	// SLL→LL retry reseeks the SAME buffered tokens without re-lexing — so lexer errors are NOT
	// re-emitted on the LL path). Snapshot them so they can be re-pushed after the retry's
	// collector.reset(), which clears parser AND lexer diagnostics.
	tokens.fill();
	const lexDiags = [...collector.diagnostics];
	// The token list is stable once filled — the SLL→LL retry reseeks the same buffer, never re-lexes.
	// Projecting it to neutral `Token`s is deferred behind a lazy getter: most consumers (the corpus
	// gates especially) never read `.tokens`, so they should not pay for the mapping. `fill()` above
	// still runs eagerly — it surfaces lexer diagnostics — but the projection maps once, on first read.
	const withTokens = (base: Omit<ParseResult, "tokens">): ParseResult => {
		let cached: Token[] | undefined;
		return Object.defineProperty(base as ParseResult, "tokens", {
			get: () => (cached ??= mapTokens(lexer, tokens.getTokens(), "redshift")),
			enumerable: true,
			configurable: true,
		});
	};

	const defaultErrorHandler = parser.errorHandler;
	parser.errorHandler = new BailErrorStrategy();
	sim.predictionMode = PredictionMode.SLL;
	try {
		const tree = parser.root();
		return withTokens({
			tree,
			errors: collector.diagnostics.length,
			diagnostics: collector.diagnostics,
			sllFallback: false,
		});
	} catch {
		tokens.seek(0);
		parser.reset();
		parser.errorHandler = defaultErrorHandler;
		sim.predictionMode = PredictionMode.LL;
		collector.reset(); // discount anything the SLL attempt may have reported
		collector.diagnostics.push(...lexDiags); // restore lexer diagnostics (not re-emitted on the LL path)
		attachErrorCounter(lexer, parser, collector.listener);
		const tree = parser.root();
		return withTokens({
			tree,
			errors: collector.diagnostics.length,
			diagnostics: collector.diagnostics,
			sllFallback: true,
		});
	}
}

function attachErrorCounter(lexer: Lexer, parser: RedshiftParser, listener: ANTLRErrorListener): void {
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener);
	parser.removeErrorListeners();
	parser.addErrorListener(listener);
}
