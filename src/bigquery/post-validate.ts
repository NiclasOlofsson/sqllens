import type { ParserRuleContext } from "antlr4ng";
import {
	Expression_higher_prec_than_andContext,
	Graph_call_operator_coreContext,
	Pipe_aggregate_itemContext,
	Pipe_callContext,
	Select_clauseContext,
	Select_column_dot_starContext,
	Shift_operatorContext,
} from "../generated/bigquery/GoogleSQLParser.js";

// An expression node whose top operator is a comparison-family operator (the non-associative set —
// googlesql.tm marks these so an operand can't itself be one without parentheses).
function isComparisonFamily(ctx: Expression_higher_prec_than_andContext | null): boolean {
	return !!(
		ctx &&
		(ctx.comparative_operator() ||
			ctx.between_operator() ||
			ctx.in_operator() ||
			ctx.like_operator() ||
			ctx.distinct_operator() ||
			ctx.is_operator())
	);
}

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
 * - shift_operator `>>`: the grammar recombines two `>` tokens so nested generics close
 *   (`ARRAY<STRUCT<INT64>>`), but ZetaSQL only lexes `>>` when the two `>` are ADJACENT. With a space —
 *   `1 > > 2` — they are two comparison operators and chaining them is "Unexpected >".
 * - SELECT WITH <kind> OPTIONS(...): `WITH kind OPTIONS(…)` is the differential-privacy with-clause's
 *   own OPTIONS, leaving an empty SELECT list ("SELECT list must not be empty" / "Unexpected ,"). ANTLR
 *   instead reads `OPTIONS(…)` as a select item (so the with-clause has no OPTIONS); detect that shape —
 *   a `WITH <id>` with no OPTIONS whose first select item is an `OPTIONS(…)` call — and reject it.
 * - CALL tvf suffixes: googlesql.tm `pipe_call` is `CALL tvf as_alias?` (no PIVOT/UNPIVOT) and a graph
 *   `CALL … tvf` takes a bare tvf (no alias, no pivot). Our shared tvf_with_suffixes permits both, so
 *   flag a pipe CALL with a PIVOT/UNPIVOT, and a graph CALL with any tvf alias/pivot suffix.
 * - pipe AGGREGATE dot-star order: googlesql.tm's pipe_selection_item_with_order allows an ASC/DESC
 *   order only on an expression item, not on a dot-star (`|> AGGREGATE s.* ASC`).
 * - LIKE ANY/SOME/ALL chained on a comparison: `'1' IN (…) LIKE ANY (…)` — the LIKE-quantified alts
 *   lack the inline non-associativity guard the plain comparison alts have, so a comparison-family LHS
 *   ("Expression to the left of LIKE must be parenthesized") slips through.
 */
export function countPostParseErrors(tree: ParserRuleContext): number {
	let errors = 0;
	const visit = (node: ParserRuleContext): void => {
		if (node instanceof Select_column_dot_starContext) {
			const base = node.expression_higher_prec_than_and()?.getText() ?? "";
			if (hasTopLevelBinaryOp(base)) errors++;
		} else if (node instanceof Shift_operatorContext) {
			const gts = node.GT_OPERATOR();
			if (gts.length === 2) {
				const a = gts[0].symbol;
				const b = gts[1].symbol;
				if (a.stop + 1 !== b.start) errors++; // `> >` (spaced) is not the `>>` shift operator
			}
		} else if (node instanceof Select_clauseContext) {
			// `SELECT WITH kind OPTIONS(…)` with the OPTIONS bound (by ZetaSQL) to the with-clause and NO
			// further select item is an empty SELECT list. ANTLR instead reads it as `WITH kind` + a select
			// item `OPTIONS(…)`; flag only the bare form — a `WITH <id>` with no OPTIONS whose first item is
			// an un-aliased `OPTIONS(…)` call (an aliased `OPTIONS(…) x` is a genuine select item, valid).
			// An intervening ALL/DISTINCT (`WITH kind ALL OPTIONS(…)`) separates the with-clause from the
			// OPTIONS, so there it IS a select item — only flag the form with no all_or_distinct.
			const w = node.opt_select_with();
			const first = node.select_list()?.select_list_item(0)?.select_column_expr();
			if (w && !w.OPTIONS_SYMBOL() && !node.all_or_distinct() && first && !first.identifier() && !first.select_column_expr_with_as_alias()) {
				if (/^OPTIONS\s*\(.*\)$/is.test(first.expression()?.getText() ?? "")) errors++;
			}
		} else if (node instanceof Pipe_callContext) {
			const suffix = node.tvf_with_suffixes().pivot_or_unpivot_clause_and_aliases();
			if (suffix?.pivot_clause() || suffix?.unpivot_clause()) errors++; // pipe CALL takes no PIVOT/UNPIVOT
		} else if (node instanceof Graph_call_operator_coreContext) {
			if (node.tvf_with_suffixes()?.pivot_or_unpivot_clause_and_aliases()) errors++; // graph CALL takes a bare tvf
		} else if (node instanceof Pipe_aggregate_itemContext) {
			if (node.opt_selection_item_order() && node.pipe_selection_item().select_column_dot_star()) errors++; // no ASC/DESC on a dot-star
		} else if (node instanceof Expression_higher_prec_than_andContext) {
			// LIKE ANY/SOME/ALL with a comparison-family LHS must be parenthesized.
			if (node.like_operator() && node.any_some_all() && isComparisonFamily(node.expression_higher_prec_than_and(0))) errors++;
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
