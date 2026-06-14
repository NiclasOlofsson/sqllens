import type { ParserRuleContext } from "antlr4ng";
import { Select_column_dot_starContext } from "../generated/bigquery/GoogleSQLParser.js";

// Post-parse syntax validation: rules that ZetaSQL enforces with operator-precedence (%prec) or
// hand-parser actions that an ANTLR grammar can't express cleanly, and that are too entangled with the
// left-recursive expression rule to add as inline grammar actions without destabilising ANTLR's
// adaptive prediction. We validate them by walking the finished CST and counting violations, which the
// parser folds into its syntax-error total — same approach as the post-lex escape validation. A walk
// cannot change parse decisions, so it carries none of the prediction-interaction risk of a grammar
// action.

// True when `text` carries a binary/comparison/bitwise operator at the top paren/bracket depth, ignoring
// operators inside parentheses, brackets, or string/backtick literals. A leading sign is not binary.
function hasTopLevelBinaryOp(text: string): boolean {
	let depth = 0;
	let quote = "";
	for (let k = 0; k < text.length; k++) {
		const c = text[k];
		if (quote) {
			if (c === quote) quote = "";
			continue;
		}
		if (c === "'" || c === '"' || c === "`") quote = c;
		else if (c === "(" || c === "[") depth++;
		else if (c === ")" || c === "]") depth--;
		else if (depth === 0 && k > 0 && "+-*/%|&^=<>!".includes(c)) return true;
	}
	return false;
}

/**
 * Count post-parse syntax violations in the CST. Each counts as one syntax error.
 *
 * - select_column_dot_star: googlesql.tm binds `.*` at `.` precedence (`%prec "."`), so the base must be
 *   a postfix expression (`t.*`, `(a+b).*`, `f(x).*`), not a binary one — `a+b.*` parses as `a + (b.*)`
 *   and fails on `*` ("Unexpected *"). A base carrying a top-level binary operator is invalid.
 */
export function countPostParseErrors(tree: ParserRuleContext): number {
	let errors = 0;
	const visit = (node: ParserRuleContext): void => {
		if (node instanceof Select_column_dot_starContext) {
			const base = node.expression_higher_prec_than_and()?.getText() ?? "";
			if (hasTopLevelBinaryOp(base)) errors++;
		}
		const count = node.getChildCount();
		for (let i = 0; i < count; i++) {
			const child = node.getChild(i);
			if (child instanceof Object && "getChildCount" in child && typeof child.getChildCount === "function") {
				visit(child as ParserRuleContext);
			}
		}
	};
	visit(tree);
	return errors;
}
