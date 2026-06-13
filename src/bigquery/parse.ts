import {
	BailErrorStrategy,
	CharStream,
	CommonTokenStream,
	type Lexer,
	type ParserATNSimulator,
	type ParserRuleContext,
	PredictionMode,
} from "antlr4ng";
import { GoogleSQLLexer } from "../generated/bigquery/GoogleSQLLexer.js";
import { GoogleSQLParser } from "../generated/bigquery/GoogleSQLParser.js";

export interface ParseResult {
	/** The CST rooted at `root` (`stmts EOF`). */
	tree: ParserRuleContext;
	/** Count of lexer + parser syntax errors. */
	errors: number;
}

/**
 * Lex + parse BigQuery / GoogleSQL (one statement or a `;`-separated batch). Two-stage parsing:
 * try the fast SLL prediction mode first (bail on the first conflict), fall back to full LL
 * only when SLL fails — same result LL alone would give, just faster on valid input.
 */
export function parseBigQuery(sql: string): ParseResult {
	const lexer = new GoogleSQLLexer(CharStream.fromString(sql));
	const tokens = new CommonTokenStream(lexer);
	const parser = new GoogleSQLParser(tokens);
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

function attachErrorCounter(lexer: Lexer, parser: GoogleSQLParser, listener: object): void {
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener as never);
	parser.removeErrorListeners();
	parser.addErrorListener(listener as never);
}
