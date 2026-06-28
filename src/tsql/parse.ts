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
import { makeErrorCollector, type SyntaxDiagnostic } from "../parse-diagnostics.js";

export interface ParseResult {
	/** The CST rooted at `tsql_file` (`batch* EOF` — the full statement range). */
	tree: ParserRuleContext;
	/** Count of lexer + parser syntax errors. */
	errors: number;
	/** Positioned syntax diagnostics (message + line/column/offset/length), in report order. */
	diagnostics: SyntaxDiagnostic[];
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

	// Stage 1: SLL, bail on the first error (no recovery, no listener noise).
	const defaultErrorHandler = parser.errorHandler;
	parser.errorHandler = new BailErrorStrategy();
	sim.predictionMode = PredictionMode.SLL;
	try {
		const tree = parser.tsql_file();
		return { tree, errors: collector.diagnostics.length, diagnostics: collector.diagnostics };
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
		return { tree, errors: collector.diagnostics.length, diagnostics: collector.diagnostics };
	}
}

function attachErrorCounter(lexer: Lexer, parser: TSqlParser, listener: object): void {
	lexer.removeErrorListeners();
	lexer.addErrorListener(listener as never);
	parser.removeErrorListeners();
	parser.addErrorListener(listener as never);
}
