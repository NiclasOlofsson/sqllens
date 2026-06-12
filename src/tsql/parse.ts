import {
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

export interface ParseResult {
	/** The CST rooted at `tsql_file` (`batch* EOF` — the full statement range). */
	tree: ParserRuleContext;
	/** Count of lexer + parser syntax errors. */
	errors: number;
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
		return { tree: parser.tsql_file(), errors };
	} catch {
		tokens.seek(0);
		parser.reset();
		parser.errorHandler = defaultErrorHandler;
		sim.predictionMode = PredictionMode.LL;
		errors = 0;
		attachErrorCounter(lexer, parser, listener);
		return { tree: parser.tsql_file(), errors };
	}
}

function attachErrorCounter(lexer: Lexer, parser: TSqlParser, listener: object): void {
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener as never);
	parser.removeErrorListeners();
	parser.addErrorListener(listener as never);
}
