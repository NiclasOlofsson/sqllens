import {
	BailErrorStrategy,
	CharStream,
	CommonTokenStream,
	type ParserATNSimulator,
	type ParserRuleContext,
	PredictionMode,
} from "antlr4ng";
import { GoogleSQLLexer } from "../generated/bigquery/GoogleSQLLexer.js";
import { GoogleSQLParser } from "../generated/bigquery/GoogleSQLParser.js";
import { dotPathTokenSource } from "./dot-path.js";
import { postParseDiagnostics } from "./post-validate.js";
import { makeErrorCollector, type SyntaxDiagnostic } from "../parse-diagnostics.js";
import { mapTokens } from "../token/map.js";
import type { Token } from "../token/token.js";

export interface ParseResult {
	/** The CST rooted at `root` (`stmts EOF`). */
	tree: ParserRuleContext;
	/** Count of lexer + parser + escape + post-parse syntax errors; equals `diagnostics.length`. */
	errors: number;
	/** Positioned syntax diagnostics — lexer/parser (listener-captured) plus escape and post-parse
	 *  errors, all carrying a source span. `errors === diagnostics.length`. */
	diagnostics: SyntaxDiagnostic[];
	/** Every token the parser consumed (trivia included, EOF excluded), as neutral `Token`s. Built
	 *  from the dot-path-rewritten stream, so spans match the consumed source. */
	tokens: Token[];
	/** True when the fast SLL prediction pass bailed and the parse re-ran under full LL. Same result
	 *  either way — this just says which path produced it, for perf profiling (tools/profile-sll.ts). */
	sllFallback: boolean;
}

/**
 * Lex + parse BigQuery / GoogleSQL (one statement or a `;`-separated batch). Two-stage parsing:
 * try the fast SLL prediction mode first (bail on the first conflict), fall back to full LL
 * only when SLL fails — same result LL alone would give, just faster on valid input.
 */
export function parseBigQuery(sql: string): ParseResult {
	const collector = makeErrorCollector();

	const lexer = new GoogleSQLLexer(CharStream.fromString(sql));
	lexer.removeErrorListeners();
	lexer.addErrorListener(collector.listener as never);
	const { source, escapeDiagnostics } = dotPathTokenSource(sql, lexer);
	const tokens = new CommonTokenStream(source);
	// Escape diagnostics are token-derived, so (like lexer diagnostics) they are stable across the
	// SLL→LL retry and are appended once at each return rather than going through the collector.
	// The lexer runs once eagerly above; the SLL→LL retry reseeks the buffered token source and never
	// re-lexes, so lexer diagnostics are NOT re-emitted on the LL path. Snapshot them now so they can
	// be re-pushed after the retry's collector.reset() (which clears everything — parser AND lexer).
	const lexDiags = [...collector.diagnostics];
	// Map the dot-path-rewritten stream the parser actually consumes. fill() is required to read the
	// whole buffer; the list source carries hidden-channel trivia, so it is preserved. The list is
	// stable across the SLL→LL retry (the same buffer is reseeked, never re-lexed). The lexer instance
	// is still the right vocabulary source for token names/roles.
	tokens.fill();
	// Projecting the buffered token stream to neutral `Token`s is deferred behind a lazy getter: most
	// consumers (the corpus gates especially) never read `.tokens`, so they should not pay for the
	// mapping. `fill()` above still runs eagerly — the parser needs the buffer and lexer diagnostics
	// surface there — but the projection maps once, on first read.
	const withTokens = (base: Omit<ParseResult, "tokens">): ParseResult => {
		let cached: Token[] | undefined;
		return Object.defineProperty(base as ParseResult, "tokens", {
			get: () => (cached ??= mapTokens(lexer, tokens.getTokens(), "bigquery")),
			enumerable: true,
			configurable: true,
		});
	};

	const parser = new GoogleSQLParser(tokens);
	const sim = parser.interpreter as ParserATNSimulator;
	parser.removeErrorListeners();
	parser.addErrorListener(collector.listener as never);

	const defaultErrorHandler = parser.errorHandler;
	parser.errorHandler = new BailErrorStrategy();
	sim.predictionMode = PredictionMode.SLL;
	try {
		const tree = parser.root();
		const diagnostics = [...collector.diagnostics, ...escapeDiagnostics, ...postParseDiagnostics(tree)];
		return withTokens({ tree, errors: diagnostics.length, diagnostics, sllFallback: false });
	} catch {
		tokens.seek(0);
		parser.reset();
		parser.errorHandler = defaultErrorHandler;
		sim.predictionMode = PredictionMode.LL;
		collector.reset(); // discount the SLL attempt's parser diagnostics
		collector.diagnostics.push(...lexDiags); // restore lexer diagnostics (not re-emitted on the LL path)
		parser.removeErrorListeners();
		parser.addErrorListener(collector.listener as never);
		const tree = parser.root();
		const diagnostics = [...collector.diagnostics, ...escapeDiagnostics, ...postParseDiagnostics(tree)];
		return withTokens({ tree, errors: diagnostics.length, diagnostics, sllFallback: true });
	}
}
