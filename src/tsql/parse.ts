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
import { TSqlLexer } from "../generated/tsql/TSqlLexer.js";
import { TSqlParser } from "../generated/tsql/TSqlParser.js";
import { makeErrorCollector, type SyntaxDiagnostic } from "../parse-diagnostics.js";
import { mapTokens } from "../token/map.js";
import type { Token } from "../token/token.js";

export interface ParseResult {
	/** The CST rooted at `tsql_file` (`batch* EOF` — the full statement range). */
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
 * Lex + parse a T-SQL input via the grammar's full-file rule (`tsql_file` — `batch* EOF`), the same
 * shape as `parseDatabricks`/`parseSnowflake`: one entry that accepts any statement (query, DML, DDL,
 * control-flow, admin) and a `;`-separated batch of them. EOF-anchored, so trailing garbage is an
 * error rather than silently dropped. Two-stage parsing: try the fast SLL prediction mode first (bail
 * on the first conflict), fall back to full LL only when SLL fails — same result LL alone would give.
 */
export function parseTSql(sql: string): ParseResult {
	const lexer = new TSqlLexer(CharStream.fromString(sql));
	const tokens = new CommonTokenStream(lexer);
	const parser = new TSqlParser(tokens);
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
			get: () => (cached ??= mapTokens(lexer, tokens.getTokens(), "tsql")),
			enumerable: true,
			configurable: true,
		});
	};

	// Stage 1: SLL, bail on the first error (no recovery, no listener noise).
	const defaultErrorHandler = parser.errorHandler;
	parser.errorHandler = new BailErrorStrategy();
	sim.predictionMode = PredictionMode.SLL;
	try {
		const tree = parser.tsql_file();
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
		const tree = parser.tsql_file();
		return withTokens({
			tree,
			errors: collector.diagnostics.length,
			diagnostics: collector.diagnostics,
			sllFallback: true,
		});
	}
}

function attachErrorCounter(lexer: Lexer, parser: TSqlParser, listener: ANTLRErrorListener): void {
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener);
	parser.removeErrorListeners();
	parser.addErrorListener(listener);
}
