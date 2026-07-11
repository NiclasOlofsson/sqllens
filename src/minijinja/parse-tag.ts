import { CharStream, CommonTokenStream, type ParserRuleContext } from "antlr4ng";
import { MinijinjaLexer } from "../generated/minijinja/MinijinjaLexer.js";
import { MinijinjaParser } from "../generated/minijinja/MinijinjaParser.js";
import { makeErrorCollector, type SyntaxDiagnostic } from "../parse-diagnostics.js";

// ---------------------------------------------------------------------------
// The first file of the jinja front-end module (docs/minijinja-front-end.md).
// A minimal wrapper that lexes + parses ONE jinja tag's text (delimiters
// included) with the generated island grammar. Unlike the SQL wrappers this
// uses the DEFAULT recovering error strategy (not BailErrorStrategy), so a
// half-typed `{{ ref(` yields a best-effort tree plus positioned diagnostics
// and never throws (R5 totality). Whole-document scanning is Task 2's job
// (segment.ts); parse.ts's document pipeline now drives its OWN per-tag parse
// over segment()'s document-native token slices rather than calling this — this
// wrapper's re-lex-from-text `parseMinijinjaTag` stays for the grammar's own
// standalone-tag tests (a lone tag is itself a valid one-token-longer document).
// ---------------------------------------------------------------------------

export interface MinijinjaTagParseResult {
	/** The CST rooted at `tag`. Always defined, even on broken/partial input. */
	tree: ParserRuleContext;
	/** Count of lexer + parser syntax errors (0 on a clean tag). */
	errors: number;
	/** Positioned syntax diagnostics (message + line/column/offset/length). */
	diagnostics: SyntaxDiagnostic[];
}

/** Lex + parse a single jinja tag. Total: never throws on any input. */
export function parseMinijinjaTag(text: string): MinijinjaTagParseResult {
	const lexer = new MinijinjaLexer(CharStream.fromString(text));
	const tokens = new CommonTokenStream(lexer);
	const parser = new MinijinjaParser(tokens);

	const collector = makeErrorCollector();
	lexer.removeErrorListeners();
	lexer.addErrorListener(collector.listener);
	parser.removeErrorListeners();
	parser.addErrorListener(collector.listener);

	const tree = parser.tag();
	return {
		tree,
		errors: collector.diagnostics.length,
		diagnostics: collector.diagnostics,
	};
}
