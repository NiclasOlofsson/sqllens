import { ParserRuleContext, type ParseTree } from "antlr4ng";
import {
	Analyze_statementContext,
	Braced_constructor_prefixContext,
	Expression_higher_prec_than_andContext,
	Expression_maybe_parenthesized_not_a_queryContext,
	Graph_call_operator_coreContext,
	Graph_element_pattern_fillerContext,
	Graph_linear_operator_listContext,
	Lambda_argumentContext,
	Pipe_aggregate_itemContext,
	Pipe_callContext,
	Select_clauseContext,
	Select_column_dot_starContext,
	Shift_operatorContext,
	StmtsContext,
} from "../generated/bigquery/GoogleSQLParser.js";
import type { SyntaxDiagnostic } from "../parse-diagnostics.js";

// A positioned diagnostic spanning a CST node — node-granular per the A7 spec. antlr tokens carry a
// 1-based line / 0-based column; offset/length are 0-based inclusive char indices.
function diagAt(ctx: ParserRuleContext, message: string): SyntaxDiagnostic {
	const s = ctx.start;
	const e = ctx.stop ?? ctx.start;
	return {
		message,
		line: s?.line ?? 1,
		column: s?.column ?? 0,
		offset: s?.start,
		length: s && e ? e.stop - s.start + 1 : 1,
	};
}

// A graph endpoint predicate `expr IS [NOT] SOURCE|DESTINATION [OF] expr`. Duck-typed: the alt appears
// in both expression_higher_prec_than_and and expression_maybe_parenthesized_not_a_query.
function isGraphEndpointPredicate(
	ctx: { IS_SYMBOL?(): unknown; SOURCE_SYMBOL?(): unknown; DESTINATION_SYMBOL?(): unknown } | null,
): boolean {
	return !!(ctx?.IS_SYMBOL?.() && (ctx.SOURCE_SYMBOL?.() || ctx.DESTINATION_SYMBOL?.()));
}

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

// A lambda parameter list is valid only as a bare path (`e`, `a.b.c`) or a parenthesized struct
// constructor with a top-level comma (`(e, i>0)`, `()`); a single parenthesized non-path (`(e>0)`) or a
// query (`(SELECT 1)`) is "Expecting lambda argument list". Mirrors the grammar's lambdaArgListValid,
// but the grammar runs it on getText() — which drops token spacing, so `SELECT 1` collapses to the
// identifier-like `SELECT1` and wrongly passes. We re-check on SPACED text so keyword boundaries survive.
function lambdaArgListValid(text: string): boolean {
	const t = (text ?? "").trim();
	if (/^(`[^`]*`|[A-Za-z_]\w*)(\s*\.\s*(`[^`]*`|[A-Za-z_]\w*))*$/.test(t)) return true; // bare path
	if (!t.startsWith("(") || !t.endsWith(")")) return false;
	let depth = 0;
	for (let k = 0; k < t.length; k++) {
		const c = t[k];
		if (c === "(") depth++;
		else if (c === ")") depth--;
		else if (c === "," && depth === 1) return true; // top-level comma → struct constructor
	}
	return lambdaArgListValid(t.slice(1, -1));
}

// Space-joined token text of a CST node — preserves the keyword boundaries that getText() loses.
function spacedText(node: ParserRuleContext): string {
	const parts: string[] = [];
	const walk = (n: ParseTree): void => {
		const c = n.getChildCount();
		if (c === 0) {
			parts.push(n.getText());
			return;
		}
		for (let i = 0; i < c; i++) {
			const child = n.getChild(i);
			if (child) walk(child);
		}
	};
	walk(node);
	return parts.join(" ");
}

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
 * Collect post-parse syntax violations in the CST as positioned diagnostics. Each is one syntax error.
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
 * - ANALYZE OPTIONS: `OPTIONS` after ANALYZE commits to the OPTIONS keyword (which needs `(...)`), so
 *   `ANALYZE OPTIONS` / `ANALYZE OPTIONS, T` — where it is read as a table name — is a syntax error.
 * - standalone subpipeline: a bare `|> …` subpipeline is its own single-statement entry in ZetaSQL, so
 *   it can't be one of several `;`-separated statements (`|> WHERE true; |> WHERE false`, `|> DESCRIBE;
 *   SELECT 1` → "Expected end of input"/"Unexpected"). It must be the sole top-level statement.
 * - IN value-list hint: a `@{…}` hint on `IN (value, …)` is "HINTs cannot be specified on IN clause with
 *   value list" (the grammar already rejects the UNNEST form inline; the value-list form is here).
 * - lambda argument list: a lambda parameter list must be a path or a parenthesized struct (`(e, i>0)`),
 *   not a query (`(SELECT 1) -> …`) — "Expecting lambda argument list". The grammar's getText()-based
 *   check misses keyword boundaries; re-validated here on spaced text.
 */
export function postParseDiagnostics(tree: ParserRuleContext): SyntaxDiagnostic[] {
	const out: SyntaxDiagnostic[] = [];
	const visit = (node: ParserRuleContext): void => {
		if (node instanceof Select_column_dot_starContext) {
			const base = node.expression_higher_prec_than_and()?.getText() ?? "";
			if (hasTopLevelBinaryOp(base))
				out.push(diagAt(node, "dot-star base must be a postfix expression, not a binary one"));
		} else if (node instanceof Shift_operatorContext) {
			const gts = node.GT_OPERATOR();
			if (gts.length === 2) {
				const a = gts[0].symbol;
				const b = gts[1].symbol;
				if (a.stop + 1 !== b.start)
					out.push(diagAt(node, "unexpected '>' (spaced '> >' is not the '>>' shift operator)")); // `> >` (spaced) is not the `>>` shift operator
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
			// A bare `OPTIONS(…)` (empty list) or `OPTIONS(…) AS x` (the with-options binds OPTIONS, leaving
			// `AS x` — which can't start a select item) is invalid. A bare-word alias `OPTIONS(…) x` is a
			// genuine select item (x is the list), so exclude that (first.identifier()).
			if (w && !w.OPTIONS_SYMBOL() && !node.all_or_distinct() && first && !first.identifier()) {
				const expr = first.select_column_expr_with_as_alias()?.expression() ?? first.expression();
				if (/^OPTIONS\s*\(.*\)$/is.test(expr?.getText() ?? ""))
					out.push(diagAt(node, "SELECT list must not be empty"));
			}
		} else if (node instanceof Pipe_callContext) {
			const suffix = node.tvf_with_suffixes().pivot_or_unpivot_clause_and_aliases();
			if (suffix?.pivot_clause() || suffix?.unpivot_clause())
				out.push(diagAt(node, "pipe CALL takes no PIVOT/UNPIVOT")); // pipe CALL takes no PIVOT/UNPIVOT
		} else if (node instanceof Graph_element_pattern_fillerContext) {
			// `[cost 12]` — a leading `cost` is the element NAME, not the COST keyword (which only trails a
			// name/label/where). A filler that is ONLY a COST clause means `cost` was misread as the keyword
			// and the following expr is unexpected ("Expected "]" but got …").
			if (
				node.opt_graph_cost() &&
				!node.opt_graph_element_identifier() &&
				!node.opt_is_label_expression() &&
				!node.graph_property_specification() &&
				!node.where_clause()
			) {
				out.push(diagAt(node, "unexpected expression after 'cost' (read as the element name)"));
			}
		} else if (node instanceof Graph_call_operator_coreContext) {
			if (node.tvf_with_suffixes()?.pivot_or_unpivot_clause_and_aliases())
				out.push(diagAt(node, "graph CALL takes a bare tvf")); // graph CALL takes a bare tvf
		} else if (node instanceof Graph_linear_operator_listContext) {
			// After `FOR x IN expr`, a `WITH` binds to the FOR's offset clause — it must be `WITH OFFSET`.
			// A FOR with no offset directly followed by a WITH operator is "Expected keyword OFFSET …".
			const ops = node.graph_linear_operator();
			for (let k = 0; k < ops.length - 1; k++) {
				const forOp = ops[k].graph_for_operator();
				if (forOp && !forOp.opt_with_offset_and_alias_with_required_as() && ops[k + 1].graph_with_operator())
					out.push(diagAt(ops[k], "expected keyword OFFSET after FOR"));
			}
		} else if (node instanceof Pipe_aggregate_itemContext) {
			if (node.opt_selection_item_order() && node.pipe_selection_item().select_column_dot_star())
				out.push(diagAt(node, "ASC/DESC order is not allowed on a dot-star")); // no ASC/DESC on a dot-star
		} else if (node instanceof Expression_higher_prec_than_andContext) {
			// LIKE ANY/SOME/ALL with a comparison-family LHS must be parenthesized.
			if (
				node.like_operator() &&
				node.any_some_all() &&
				isComparisonFamily(node.expression_higher_prec_than_and(0))
			)
				out.push(diagAt(node, "expression to the left of LIKE must be parenthesized"));
			else if (
				isGraphEndpointPredicate(node) &&
				isGraphEndpointPredicate(node.expression_higher_prec_than_and(0))
			)
				out.push(diagAt(node, "graph endpoint predicate cannot be chained"));
			// A hint on an IN value list (`IN @{…} (a, b)` / `IN @{…} (x)`) is rejected; a hint on an IN
			// SUBQUERY (`IN @{…} (SELECT …)`) is allowed, as is the IN-UNNEST form (caught in-grammar).
			const inRhs = node.parenthesized_in_rhs();
			if (node.in_operator() && node.hint() && inRhs && !inRhs.parenthesized_query())
				out.push(diagAt(node, "HINTs cannot be specified on IN clause with value list"));
		} else if (node instanceof Lambda_argumentContext) {
			// Flag only what the grammar's getText()-based check let through: valid when flattened (keyword
			// boundary lost) but invalid on spaced text — e.g. `(SELECT 1) -> …`.
			const e = node.lambda_argument_list().expression();
			if (e && lambdaArgListValid(e.getText()) && !lambdaArgListValid(spacedText(e)))
				out.push(diagAt(node, "expecting lambda argument list"));
		} else if (node instanceof Expression_maybe_parenthesized_not_a_queryContext) {
			// A graph endpoint predicate (IS SOURCE/DESTINATION OF) cannot be chained — its LHS may not be
			// another endpoint predicate (`a IS SOURCE OF e IS DESTINATION OF d`).
			if (isGraphEndpointPredicate(node) && isGraphEndpointPredicate(node.expression_higher_prec_than_and(0)))
				out.push(diagAt(node, "graph endpoint predicate cannot be chained"));
		} else if (node instanceof Analyze_statementContext) {
			// A bare `OPTIONS` table name is really the OPTIONS keyword (which requires `(...)`).
			const firstTable = node.table_and_column_info_list()?.table_and_column_info(0);
			if (
				!node.opt_options_list() &&
				/^OPTIONS$/i.test(firstTable?.maybe_dashed_path_expression()?.getText() ?? "")
			)
				out.push(diagAt(node, "OPTIONS requires '(...)'"));
		} else if (node instanceof StmtsContext) {
			// A standalone subpipeline (`|> …`) must be the only statement — it can't be `;`-chained.
			const tops = node.top_statement();
			if (tops.length > 1 && tops.some((t) => t.getText().startsWith("|>"))) {
				const offender = tops.find((t) => t.getText().startsWith("|>")) ?? node;
				out.push(diagAt(offender, "a standalone subpipeline must be the only statement"));
			}
		} else if (node instanceof Braced_constructor_prefixContext) {
			// An extension field `(pkg.Ext)…` that is not the first field needs a preceding comma —
			// `{ foo: "bar" (ext){…} }` is "Function call cannot be applied to this expression" (ZetaSQL
			// tries to call the prior value). When the prior value is a path/call (`foo: column (ext)`) the
			// `(ext)` is absorbed as the call's args, so no comma-less extension field arises there.
			const inner = node.braced_constructor_prefix();
			const next = node.braced_constructor_field();
			if (inner && next && !node.COMMA_SYMBOL() && next.braced_constructor_lhs().braced_constructor_extension())
				out.push(diagAt(next, "extension field must be preceded by a comma"));
		}
		const count = node.getChildCount();
		for (let i = 0; i < count; i++) {
			const child = node.getChild(i);
			if (child instanceof ParserRuleContext) visit(child);
		}
	};
	visit(tree);
	return out;
}
