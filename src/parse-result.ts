import type { ParserRuleContext } from "antlr4ng";
import type { SyntaxDiagnostic } from "./parse-diagnostics.js";
import type { Token } from "./token/token.js";

/** The result shape shared by every dialect's parse wrapper (parseDatabricks … parseTrino). */
export interface ParseResult {
	tree: ParserRuleContext;
	errors: number;
	diagnostics: SyntaxDiagnostic[];
	tokens: Token[];
	sllFallback: boolean;
}
