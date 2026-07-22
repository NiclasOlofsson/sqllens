import {
	type ANTLRErrorListener,
	BailErrorStrategy,
	CharStream,
	CommonTokenStream,
	type Lexer,
	type ParserATNSimulator,
	PredictionMode,
} from "antlr4ng";
import { DatabricksLexer } from "../generated/databricks/DatabricksLexer.js";
import { DatabricksParser } from "../generated/databricks/DatabricksParser.js";
import { makeErrorCollector } from "../parse-diagnostics.js";
import type { ParseResult } from "../parse-result.js";
import { CONSUMED_AS_RULES, deriveConsumedAs } from "../token/consumed-as.js";
import { mapTokens } from "../token/map.js";
import type { Token } from "../token/token.js";

/** The CST rooted at `multiStatement` (a `;`-separated batch of statements and/or
 *  BEGIN…END SQL-scripting compounds, + EOF); see `ParseResult` for the full result shape. */
export type { ParseResult } from "../parse-result.js";

/**
 * Lex + parse one Databricks SQL statement. Two-stage parsing: try the fast SLL
 * prediction mode first (bail on the first conflict), and fall back to full LL only
 * when SLL fails. Valid SQL takes the fast path; the LL fallback guarantees the same
 * result LL alone would produce, so correctness is unchanged — just faster.
 */
export function parseDatabricks(sql: string): ParseResult {
	const lexer = new DatabricksLexer(CharStream.fromString(sql));
	const tokens = new CommonTokenStream(lexer);
	const parser = new DatabricksParser(tokens);
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
			get: () =>
				(cached ??= mapTokens(
					lexer,
					tokens.getTokens(),
					"databricks",
					deriveConsumedAs((base as ParseResult).tree, CONSUMED_AS_RULES.databricks),
				)),
			enumerable: true,
			configurable: true,
		});
	};

	// Stage 1: SLL, bail on the first error (no recovery, no listener noise).
	const defaultErrorHandler = parser.errorHandler;
	parser.errorHandler = new BailErrorStrategy();
	sim.predictionMode = PredictionMode.SLL;
	try {
		const tree = parser.multiStatement();
		return withTokens({
			tree,
			errors: collector.diagnostics.length,
			diagnostics: collector.diagnostics,
			sllFallback: false,
		});
	} catch {
		// Stage 2: full LL with the normal error strategy (reports + recovers).
		tokens.seek(0);
		parser.reset();
		parser.errorHandler = defaultErrorHandler;
		sim.predictionMode = PredictionMode.LL;
		collector.reset(); // discount anything the SLL attempt may have reported
		collector.diagnostics.push(...lexDiags); // restore lexer diagnostics (not re-emitted on the LL path)
		attachErrorCounter(lexer, parser, collector.listener);
		const tree = parser.multiStatement();
		return withTokens({
			tree,
			errors: collector.diagnostics.length,
			diagnostics: collector.diagnostics,
			sllFallback: true,
		});
	}
}

function attachErrorCounter(lexer: Lexer, parser: DatabricksParser, listener: ANTLRErrorListener): void {
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener);
	parser.removeErrorListeners();
	parser.addErrorListener(listener);
}
