import {
	BailErrorStrategy,
	CharStream,
	CommonTokenStream,
	type Lexer,
	type ParserATNSimulator,
	type ParserRuleContext,
	PredictionMode,
} from "antlr4ng";
import { DatabricksLexer } from "../generated/databricks/DatabricksLexer.js";
import { DatabricksParser } from "../generated/databricks/DatabricksParser.js";
import { makeErrorCollector, type SyntaxDiagnostic } from "../parse-diagnostics.js";

export interface ParseResult {
	/** The CST rooted at `compoundOrSingleStatement` (one statement, or a BEGIN…END
	 *  SQL-scripting compound, + EOF). */
	tree: ParserRuleContext;
	/** Count of lexer + parser syntax errors. */
	errors: number;
	/** Positioned syntax diagnostics (message + line/column/offset/length), in report order. */
	diagnostics: SyntaxDiagnostic[];
}

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

	// Stage 1: SLL, bail on the first error (no recovery, no listener noise).
	const defaultErrorHandler = parser.errorHandler;
	parser.errorHandler = new BailErrorStrategy();
	sim.predictionMode = PredictionMode.SLL;
	try {
		const tree = parser.compoundOrSingleStatement();
		return { tree, errors: collector.diagnostics.length, diagnostics: collector.diagnostics };
	} catch {
		// Stage 2: full LL with the normal error strategy (reports + recovers).
		tokens.seek(0);
		parser.reset();
		parser.errorHandler = defaultErrorHandler;
		sim.predictionMode = PredictionMode.LL;
		collector.reset(); // discount anything the SLL attempt may have reported
		attachErrorCounter(lexer, parser, collector.listener);
		const tree = parser.compoundOrSingleStatement();
		return { tree, errors: collector.diagnostics.length, diagnostics: collector.diagnostics };
	}
}

function attachErrorCounter(lexer: Lexer, parser: DatabricksParser, listener: object): void {
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener as never);
	parser.removeErrorListeners();
	parser.addErrorListener(listener as never);
}
