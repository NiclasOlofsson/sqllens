import {
	BailErrorStrategy,
	CharStream,
	CommonTokenStream,
	type Lexer,
	type ParserATNSimulator,
	type ParserRuleContext,
	PredictionMode,
	Token,
} from "antlr4ng";
import { TSqlLexer } from "../generated/tsql/TSqlLexer.js";
import { TSqlParser } from "../generated/tsql/TSqlParser.js";

export interface ParseResult {
	/** The CST rooted at `select_statement_standalone` (an optional WITH + a query). */
	tree: ParserRuleContext;
	/** Count of lexer + parser syntax errors. */
	errors: number;
}

/**
 * Lex + parse one T-SQL query (a `WITH? SELECT …`). Two-stage parsing: try the fast SLL
 * prediction mode first (bail on the first conflict), fall back to full LL only when SLL
 * fails — same result LL alone would give, just faster on valid input.
 */
export function parseTSql(sql: string): ParseResult {
	const lexer = new TSqlLexer(CharStream.fromString(sql));
	const tokens = new CommonTokenStream(lexer);
	const parser = new TSqlParser(tokens);
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
		const tree = parser.select_statement_standalone();
		if (trailingGarbage(tokens)) errors++;
		return { tree, errors };
	} catch {
		tokens.seek(0);
		parser.reset();
		parser.errorHandler = defaultErrorHandler;
		sim.predictionMode = PredictionMode.LL;
		errors = 0;
		attachErrorCounter(lexer, parser, listener);
		const tree = parser.select_statement_standalone();
		if (trailingGarbage(tokens)) errors++;
		return { tree, errors };
	}
}

/** The grammar's `select_statement_standalone` has no EOF anchor, so a valid-SELECT *prefix*
 *  would otherwise "parse" and silently drop the tail. Reject anything left over except
 *  statement-terminating semicolons. */
function trailingGarbage(tokens: CommonTokenStream): boolean {
	while (tokens.LA(1) === TSqlParser.SEMI) tokens.consume();
	return tokens.LA(1) !== Token.EOF;
}

function attachErrorCounter(lexer: Lexer, parser: TSqlParser, listener: object): void {
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener as never);
	parser.removeErrorListeners();
	parser.addErrorListener(listener as never);
}
