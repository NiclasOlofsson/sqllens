import {
	type ANTLRErrorListener,
	BailErrorStrategy,
	CharStream,
	CommonTokenStream,
	type Lexer,
	type ParserATNSimulator,
	PredictionMode,
} from "antlr4ng";
import { TrinoLexer } from "../generated/trino/TrinoLexer.js";
import { TrinoParser } from "../generated/trino/TrinoParser.js";
import { makeErrorCollector } from "../parse-diagnostics.js";
import type { ParseResult } from "../parse-result.js";
import { CONSUMED_AS_RULES, deriveConsumedAs } from "../token/consumed-as.js";
import { mapTokens } from "../token/map.js";
import type { Token } from "../token/token.js";

/** The CST rooted at `root` (a `;`-separated batch of statements + EOF); see `ParseResult` for
 *  the full result shape. */
export type { ParseResult } from "../parse-result.js";

/**
 * Lex + parse Trino SQL (one statement or a `;`-separated batch). Two-stage parsing:
 * try the fast SLL prediction mode first (bail on the first conflict), fall back to full LL
 * only when SLL fails — same result LL alone would give, just faster on valid input.
 */
export function parseTrino(sql: string): ParseResult {
	const lexer = new TrinoLexer(CharStream.fromString(sql));
	const tokens = new CommonTokenStream(lexer);
	const parser = new TrinoParser(tokens);
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
	const withTokens = (base: Omit<ParseResult, "tokens">): ParseResult => {
		let cached: Token[] | undefined;
		return Object.defineProperty(base as ParseResult, "tokens", {
			get: () =>
				(cached ??= mapTokens(
					lexer,
					tokens.getTokens(),
					"trino",
					deriveConsumedAs((base as ParseResult).tree, CONSUMED_AS_RULES.trino),
				)),
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

function attachErrorCounter(lexer: Lexer, parser: TrinoParser, listener: ANTLRErrorListener): void {
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener);
	parser.removeErrorListeners();
	parser.addErrorListener(listener);
}
