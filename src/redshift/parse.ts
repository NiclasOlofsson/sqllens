import {
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

export interface ParseResult {
	/** The CST rooted at `root` (`stmtblock EOF` — a semicolon-separated batch of statements). */
	tree: ParserRuleContext;
	/** Count of lexer + parser syntax errors. */
	errors: number;
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

	let errors = 0;
	const listener = {
		syntaxError() {
			errors++;
		},
		reportAmbiguity() {},
		reportAttemptingFullContext() {},
		reportContextSensitivity() {},
	};
	attachErrorCounter(lexer, parser, listener);

	const defaultErrorHandler = parser.errorHandler;
	parser.errorHandler = new BailErrorStrategy();
	sim.predictionMode = PredictionMode.SLL;
	try {
		return { tree: parser.root(), errors };
	} catch {
		tokens.seek(0);
		parser.reset();
		parser.errorHandler = defaultErrorHandler;
		sim.predictionMode = PredictionMode.LL;
		errors = 0;
		attachErrorCounter(lexer, parser, listener);
		return { tree: parser.root(), errors };
	}
}

function attachErrorCounter(lexer: Lexer, parser: RedshiftParser, listener: object): void {
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener as never);
	parser.removeErrorListeners();
	parser.addErrorListener(listener as never);
}
