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
	let errors = 0;
	const listener = {
		syntaxError() {
			errors++;
		},
		reportAmbiguity() {},
		reportAttemptingFullContext() {},
		reportContextSensitivity() {},
	};

	// Lex once (the GoogleSQL DOT_IDENTIFIER rewrite needs the full token list), counting lexer
	// errors. The rewritten token source is buffered, so the SLL→LL retry reseeks without re-lexing;
	// we keep the lexer-error count across the reset and only re-zero the parser errors.
	const lexer = new GoogleSQLLexer(CharStream.fromString(sql));
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener as never);
	const { source, escapeErrors } = dotPathTokenSource(sql, lexer);
	const tokens = new CommonTokenStream(source);
	// Invalid string/bytes/identifier escapes are parse-time syntax errors in GoogleSQL (validated in
	// the parser, not the lexer). Fold them into the baseline so both parse attempts report them.
	errors += escapeErrors;
	const lexErrors = errors;

	const parser = new GoogleSQLParser(tokens);
	const sim = parser.interpreter as ParserATNSimulator;
	parser.removeErrorListeners();
	parser.addErrorListener(listener as never);

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
		errors = lexErrors;
		parser.removeErrorListeners();
		parser.addErrorListener(listener as never);
		return { tree: parser.root(), errors };
	}
}
