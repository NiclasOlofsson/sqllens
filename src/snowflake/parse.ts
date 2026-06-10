import {
	BailErrorStrategy,
	CharStream,
	CommonTokenStream,
	type Lexer,
	type ParserATNSimulator,
	type ParserRuleContext,
	PredictionMode,
} from "antlr4ng";
import { SnowflakeLexer } from "../generated/snowflake/SnowflakeLexer.js";
import { SnowflakeParser } from "../generated/snowflake/SnowflakeParser.js";

export interface ParseResult {
	/** The CST rooted at `snowflake_file` (a semicolon-separated batch of statements). */
	tree: ParserRuleContext;
	/** Count of lexer + parser syntax errors. */
	errors: number;
}

/**
 * Lex + parse Snowflake SQL (one statement or a `;`-separated batch). Two-stage parsing:
 * try the fast SLL prediction mode first (bail on the first conflict), fall back to full LL
 * only when SLL fails — same result LL alone would give, just faster on valid input.
 */
export function parseSnowflake(sql: string): ParseResult {
	const lexer = new SnowflakeLexer(CharStream.fromString(sql));
	const tokens = new CommonTokenStream(lexer);
	const parser = new SnowflakeParser(tokens);
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
		return { tree: parser.snowflake_file(), errors };
	} catch {
		tokens.seek(0);
		parser.reset();
		parser.errorHandler = defaultErrorHandler;
		sim.predictionMode = PredictionMode.LL;
		errors = 0;
		attachErrorCounter(lexer, parser, listener);
		return { tree: parser.snowflake_file(), errors };
	}
}

function attachErrorCounter(lexer: Lexer, parser: SnowflakeParser, listener: object): void {
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener as never);
	parser.removeErrorListeners();
	parser.addErrorListener(listener as never);
}
