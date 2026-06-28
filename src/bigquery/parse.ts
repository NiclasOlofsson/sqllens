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
import { countPostParseErrors } from "./post-validate.js";
import { makeErrorCollector, type SyntaxDiagnostic } from "../parse-diagnostics.js";

export interface ParseResult {
	/** The CST rooted at `root` (`stmts EOF`). */
	tree: ParserRuleContext;
	/** Count of lexer + parser + escape + post-parse syntax errors. */
	errors: number;
	/** Positioned syntax diagnostics (listener-captured subset; escape/post-parse extras are
	 *  count-only and not represented here). */
	diagnostics: SyntaxDiagnostic[];
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
	const { source, escapeErrors } = dotPathTokenSource(sql, lexer);
	const tokens = new CommonTokenStream(source);
	const lexExtras = escapeErrors; // positionless extras folded into `errors` only
	// The lexer runs once eagerly above; the SLL→LL retry reseeks the buffered token source and never
	// re-lexes, so lexer diagnostics are NOT re-emitted on the LL path. Snapshot them now so they can
	// be re-pushed after the retry's collector.reset() (which clears everything — parser AND lexer).
	const lexDiags = [...collector.diagnostics];

	const parser = new GoogleSQLParser(tokens);
	const sim = parser.interpreter as ParserATNSimulator;
	parser.removeErrorListeners();
	parser.addErrorListener(collector.listener as never);

	const defaultErrorHandler = parser.errorHandler;
	parser.errorHandler = new BailErrorStrategy();
	sim.predictionMode = PredictionMode.SLL;
	try {
		const tree = parser.root();
		const errors = collector.diagnostics.length + lexExtras + countPostParseErrors(tree);
		return { tree, errors, diagnostics: collector.diagnostics };
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
		const errors = collector.diagnostics.length + lexExtras + countPostParseErrors(tree);
		return { tree, errors, diagnostics: collector.diagnostics };
	}
}
