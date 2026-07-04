import { CharStream, CommonTokenStream, type ParserRuleContext } from "antlr4ng";
import { JinjaLexer } from "../generated/jinja/JinjaLexer.js";
import { JinjaParser } from "../generated/jinja/JinjaParser.js";
import { makeErrorCollector, type SyntaxDiagnostic } from "../parse-diagnostics.js";

// ---------------------------------------------------------------------------
// The first file of the jinja front-end module (docs/jinja-front-end.md, inc1).
// A minimal wrapper that lexes + parses ONE jinja tag's text (delimiters
// included) with the generated island grammar. Unlike the SQL wrappers this
// uses the DEFAULT recovering error strategy (not BailErrorStrategy), so a
// half-typed `{{ ref(` yields a best-effort tree plus positioned diagnostics
// and never throws (R5 totality). Whole-document scanning is Task 2's job.
// ---------------------------------------------------------------------------

export interface JinjaTagParseResult {
	/** The CST rooted at `tag`. Always defined, even on broken/partial input. */
	tree: ParserRuleContext;
	/** Count of lexer + parser syntax errors (0 on a clean tag). */
	errors: number;
	/** Positioned syntax diagnostics (message + line/column/offset/length). */
	diagnostics: SyntaxDiagnostic[];
}

/** Lex + parse a single jinja tag. Total: never throws on any input. */
export function parseJinjaTag(text: string): JinjaTagParseResult {
	const lexer = new JinjaLexer(CharStream.fromString(text));
	const tokens = new CommonTokenStream(lexer);
	const parser = new JinjaParser(tokens);

	const collector = makeErrorCollector();
	lexer.removeErrorListeners();
	lexer.addErrorListener(collector.listener as never);
	parser.removeErrorListeners();
	parser.addErrorListener(collector.listener as never);

	const tree = parser.tag();
	return {
		tree,
		errors: collector.diagnostics.length,
		diagnostics: collector.diagnostics,
	};
}
