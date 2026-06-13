import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import { GoogleSQLParser as P } from "../generated/bigquery/GoogleSQLParser.js";
import type {
	Clause,
	ColumnRef,
	CteDef,
	Expr,
	LimitInfo,
	Projection,
	QueryBody,
	QueryExpr,
	SelectExpr,
	Source,
} from "../ir/ir.js";
import { keywordCategory, type StatementCategory } from "../ir/statement.js";

// ---------------------------------------------------------------------------
// Lowering — BigQuery / GoogleSQL (forked bytebase/parser googlesql/) CST ->
// the shared, dialect-neutral IR (src/ir/ir.ts). The semantic layer runs on
// the IR unchanged; only this file knows GoogleSQL's grammar. A single query
// statement lowers fully; anything else (DDL, DML, multi-statement batches)
// becomes a flagged non-query body — a valid parse never throws.
//
// Statement structure: root -> stmts -> unterminated_sql_statement ->
// sql_statement_body -> one of the *_statement rules. The query path:
// query_statement -> query -> query_without_pipe_operators ->
// query_primary_or_set_operation -> query_primary -> select.
//
// The expression grammar is the ZetaSQL left-recursive form: `expression` and
// `expression_higher_prec_than_and` carry all operator alternatives flattened
// into one rule each, navigated by their rule/token children (same approach as
// src/snowflake/lower.ts). Constructs not yet mapped become explicit
// `other`/`unsupported`, never silently dropped.
// ---------------------------------------------------------------------------

// cloud.google.com/bigquery/docs/reference/standard-sql/aggregate_functions (+ approximate / statistical).
const AGGREGATES = new Set([
	"any_value",
	"array_agg",
	"array_concat_agg",
	"avg",
	"bit_and",
	"bit_or",
	"bit_xor",
	"count",
	"countif",
	"grouping",
	"logical_and",
	"logical_or",
	"max",
	"max_by",
	"min",
	"min_by",
	"string_agg",
	"sum",
	"corr",
	"covar_pop",
	"covar_samp",
	"stddev",
	"stddev_pop",
	"stddev_samp",
	"var_pop",
	"var_samp",
	"variance",
	"approx_count_distinct",
	"approx_quantiles",
	"approx_top_count",
	"approx_top_sum",
	"percentile_cont",
	"percentile_disc",
]);

/** Lower a parsed GoogleSQL file (`stmts`: a `;`-separated batch) into the IR. */
export function lower(tree: ParserRuleContext): QueryExpr {
	const statement = statementCategory(tree);
	if (statement === "query") {
		const qs = firstOfRule(tree, P.RULE_query_statement);
		if (qs) {
			const lowered = lowerQueryStatement(qs);
			lowered.statement = "query";
			return lowered;
		}
	}
	const q = emptyQuery(tree, statement === "other" ? "empty" : "non-query");
	q.statement = statement;
	return q;
}

// --- statement category ---------------------------------------------------------

function statementCategory(tree: ParserRuleContext): StatementCategory {
	const bodies: ParserRuleContext[] = [];
	for (const s of directChildrenOfRule(tree, P.RULE_stmts)) {
		for (const u of directChildrenOfRule(s, P.RULE_unterminated_sql_statement)) {
			bodies.push(...directChildrenOfRule(u, P.RULE_sql_statement_body));
		}
	}
	if (bodies.length === 0) return "other";
	if (bodies.length > 1) return "compound";
	return bodyCategory(bodies[0]);
}

function bodyCategory(body: ParserRuleContext): StatementCategory {
	if (directChildrenOfRule(body, P.RULE_query_statement).length) return "query";
	if (
		directChildrenOfRule(body, P.RULE_dml_statement).length ||
		directChildrenOfRule(body, P.RULE_merge_statement).length
	) {
		return "dml";
	}
	// CREATE/ALTER/DROP/TRUNCATE → ddl, GRANT/REVOKE → dcl, BEGIN/COMMIT/ROLLBACK → tcl,
	// SET/CALL/SHOW/DESCRIBE → utility (EXPORT/IMPORT/etc. fall through to "other").
	return keywordCategory(body.start?.text ?? "");
}

// --- query / set-op --------------------------------------------------------------

/** query_statement: query. query: query_without_pipe_operators. */
function lowerQueryStatement(qs: ParserRuleContext): QueryExpr {
	const qwpo = firstOfRule(qs, P.RULE_query_without_pipe_operators);
	if (!qwpo) return emptyQuery(qs, "non-query");

	const withClause = directChildrenOfRule(qwpo, P.RULE_with_clause)[0];
	const ctes = withClause ? directChildrenOfRule(withClause, P.RULE_aliased_query).map(lowerCte) : [];

	const qpos = directChildrenOfRule(qwpo, P.RULE_query_primary_or_set_operation)[0];
	const body = qpos ? lowerPrimaryOrSetOp(qpos) : emptyBody(qwpo, "non-query");

	const orderByClause = directChildrenOfRule(qwpo, P.RULE_order_by_clause)[0];
	const orderBy = orderByClause ? extractOrderBy(orderByClause) : undefined;
	if (orderBy && body.kind === "select") for (const o of orderBy) columnsOf(o, body.columns, "orderBy");

	const limitClause = directChildrenOfRule(qwpo, P.RULE_limit_offset_clause)[0];
	const limit = limitClause ? extractLimit(limitClause) : undefined;

	return { kind: "query", ctes, body, orderBy, limit, cst: qs };
}

/** aliased_query: identifier AS parenthesized_query opt_aliased_query_modifiers? */
function lowerCte(aq: ParserRuleContext): CteDef {
	const name = directChildrenOfRule(aq, P.RULE_identifier)[0];
	const paren = directChildrenOfRule(aq, P.RULE_parenthesized_query)[0];
	return {
		name: name ? identText(name) : "",
		body: paren ? lowerParenthesizedQuery(paren) : emptyQuery(aq, "non-query"),
		cst: aq,
	};
}

function lowerPrimaryOrSetOp(qpos: ParserRuleContext): QueryBody {
	const setop = directChildrenOfRule(qpos, P.RULE_query_set_operation)[0];
	if (setop) return lowerSetOperation(setop);
	const primary = directChildrenOfRule(qpos, P.RULE_query_primary)[0];
	return primary ? lowerQueryPrimary(primary) : emptyBody(qpos, "non-query");
}

/** query_primary: select | parenthesized_query opt_as_alias_with_required_as? */
function lowerQueryPrimary(primary: ParserRuleContext): QueryBody {
	const select = directChildrenOfRule(primary, P.RULE_select)[0];
	if (select) return buildSelect(select);
	const paren = directChildrenOfRule(primary, P.RULE_parenthesized_query)[0];
	if (paren) return lowerParenthesizedQuery(paren).body;
	return emptyBody(primary, "non-query");
}

/**
 * query_set_operation -> query_set_operation_prefix: query_primary query_set_operation_item+.
 * Each item is `set_operation_metadata query_primary`. UNION/EXCEPT/INTERSECT are left-associative.
 */
function lowerSetOperation(setop: ParserRuleContext): QueryBody {
	const prefix = firstOfRule(setop, P.RULE_query_set_operation_prefix);
	if (!prefix) return emptyBody(setop, "non-query");
	const firstPrimary = directChildrenOfRule(prefix, P.RULE_query_primary)[0];
	let body: QueryBody = firstPrimary ? lowerQueryPrimary(firstPrimary) : emptyBody(prefix, "non-query");
	for (const item of directChildrenOfRule(prefix, P.RULE_query_set_operation_item)) {
		const meta = directChildrenOfRule(item, P.RULE_set_operation_metadata)[0];
		const rhsPrimary = directChildrenOfRule(item, P.RULE_query_primary)[0];
		const right = rhsPrimary ? lowerQueryPrimary(rhsPrimary) : emptyBody(item, "non-query");
		const typeNode = meta ? directChildrenOfRule(meta, P.RULE_query_set_operation_type)[0] : undefined;
		const t = typeNode ? directTokenType(typeNode, [P.UNION_SYMBOL, P.EXCEPT_SYMBOL, P.INTERSECT_SYMBOL]) : undefined;
		const op = t === P.INTERSECT_SYMBOL ? "intersect" : t === P.EXCEPT_SYMBOL ? "except" : "union";
		// set_operation_metadata … all_or_distinct (ALL | DISTINCT) — ALL present => UNION ALL.
		const all = meta !== undefined && hasTokenDeep(meta, P.ALL_SYMBOL);
		body = { kind: "setop", op, all, left: body, right, columns: [], cst: meta ?? item };
	}
	return body;
}

/** parenthesized_query: '(' query ')' — a full QueryExpr. */
function lowerParenthesizedQuery(paren: ParserRuleContext): QueryExpr {
	const qs = firstOfRule(paren, P.RULE_query_statement);
	if (qs) return lowerQueryStatement(qs);
	const query = directChildrenOfRule(paren, P.RULE_query)[0];
	if (query) {
		const qwpo = firstOfRule(query, P.RULE_query_without_pipe_operators);
		// Reuse the statement path by treating the inner query directly.
		return lowerInnerQuery(query, qwpo);
	}
	return emptyQuery(paren, "non-query");
}

/** Lower a `query` node (no enclosing query_statement) — CTE/subquery bodies. */
function lowerInnerQuery(query: ParserRuleContext, qwpo: ParserRuleContext | undefined): QueryExpr {
	if (!qwpo) return emptyQuery(query, "non-query");
	const withClause = directChildrenOfRule(qwpo, P.RULE_with_clause)[0];
	const ctes = withClause ? directChildrenOfRule(withClause, P.RULE_aliased_query).map(lowerCte) : [];
	const qpos = directChildrenOfRule(qwpo, P.RULE_query_primary_or_set_operation)[0];
	const body = qpos ? lowerPrimaryOrSetOp(qpos) : emptyBody(qwpo, "non-query");
	const orderByClause = directChildrenOfRule(qwpo, P.RULE_order_by_clause)[0];
	const orderBy = orderByClause ? extractOrderBy(orderByClause) : undefined;
	if (orderBy && body.kind === "select") for (const o of orderBy) columnsOf(o, body.columns, "orderBy");
	const limitClause = directChildrenOfRule(qwpo, P.RULE_limit_offset_clause)[0];
	const limit = limitClause ? extractLimit(limitClause) : undefined;
	return { kind: "query", ctes, body, orderBy, limit, cst: query };
}

// --- SELECT body -----------------------------------------------------------------

/** select: select_clause from_clause? opt_clauses_following_from? */
function buildSelect(select: ParserRuleContext): SelectExpr {
	const unsupported: string[] = [];

	const selectClause = directChildrenOfRule(select, P.RULE_select_clause)[0];
	const selectList = selectClause ? directChildrenOfRule(selectClause, P.RULE_select_list)[0] : undefined;
	const projections = selectList
		? directChildrenOfRule(selectList, P.RULE_select_list_item).map(buildProjection)
		: [];

	const fromClause = directChildrenOfRule(select, P.RULE_from_clause)[0];
	const fromContents = fromClause ? directChildrenOfRule(fromClause, P.RULE_from_clause_contents)[0] : undefined;
	const from = fromContents ? buildSources(fromContents, unsupported) : [];
	const joinConditions = fromContents ? extractJoinConditions(fromContents) : [];

	const following = directChildrenOfRule(select, P.RULE_opt_clauses_following_from)[0];
	const whereClause = following ? firstShallow(following, P.RULE_where_clause) : undefined;
	const where = whereClause ? lowerExpr(directChildrenOfRule(whereClause, P.RULE_expression)[0]) : undefined;

	const groupByClause = following ? firstShallow(following, P.RULE_group_by_clause) : undefined;
	const groupBy = groupByClause ? extractGroupBy(groupByClause) : undefined;
	const groupByAll = groupByClause !== undefined && directChildrenOfRule(groupByClause, P.RULE_group_by_all).length > 0;

	const havingClause = following ? firstShallow(following, P.RULE_having_clause) : undefined;
	const having = havingClause ? lowerExpr(directChildrenOfRule(havingClause, P.RULE_expression)[0]) : undefined;

	const qualifyClause = following ? firstShallow(following, P.RULE_qualify_clause_nonreserved) : undefined;
	const qualify = qualifyClause ? lowerExpr(directChildrenOfRule(qualifyClause, P.RULE_expression)[0]) : undefined;

	const subqueries = extractExpressionSubqueries(select, fromSubqueryNodes(from));

	const aggregated =
		groupByAll ||
		(groupBy !== undefined && groupBy.length > 0) ||
		projections.some((p) => hasAggregate(p.expr)) ||
		(having !== undefined && hasAggregate(having));

	const columns: ColumnRef[] = [];
	for (const p of projections) columnsOf(p.expr, columns, "projection");
	if (where) columnsOf(where, columns, "where");
	for (const j of joinConditions) columnsOf(j, columns, "join");
	for (const g of groupBy ?? []) columnsOf(g, columns, "groupBy");
	if (having) columnsOf(having, columns, "having");
	if (qualify) columnsOf(qualify, columns, "qualify");

	return {
		kind: "select",
		projections,
		from,
		columns,
		where,
		joinConditions: joinConditions.length ? joinConditions : undefined,
		groupBy,
		having,
		qualify,
		aggregated,
		subqueries: subqueries.length ? subqueries : undefined,
		unsupported: unsupported.length ? unsupported : undefined,
		cst: select,
	};
}

// --- projections -----------------------------------------------------------------

function buildProjection(item: ParserRuleContext): Projection {
	// select_column_star: '*' star_modifiers?
	const starNode = directChildrenOfRule(item, P.RULE_select_column_star)[0];
	if (starNode) {
		return { name: undefined, isStar: true, expr: lowerStar(starNode, undefined), cst: item };
	}
	// select_column_dot_star: ehpa '.' '*' star_modifiers?
	const dotStar = directChildrenOfRule(item, P.RULE_select_column_dot_star)[0];
	if (dotStar) {
		const base = directChildrenOfRule(dotStar, P.RULE_expression_higher_prec_than_and)[0];
		const qualifier = base ? exprToNameParts(base) : undefined;
		return { name: undefined, isStar: true, expr: lowerStar(dotStar, qualifier), cst: item };
	}
	// select_column_expr: expression | expression AS identifier | expression identifier
	const colExpr = directChildrenOfRule(item, P.RULE_select_column_expr)[0];
	if (colExpr) {
		const withAlias = directChildrenOfRule(colExpr, P.RULE_select_column_expr_with_as_alias)[0];
		const exprNode = withAlias
			? directChildrenOfRule(withAlias, P.RULE_expression)[0]
			: directChildrenOfRule(colExpr, P.RULE_expression)[0];
		const aliasId = withAlias
			? directChildrenOfRule(withAlias, P.RULE_identifier)[0]
			: directChildrenOfRule(colExpr, P.RULE_identifier)[0];
		const expr = exprNode ? lowerExpr(exprNode) : otherExpr(colExpr);
		const name = aliasId ? identText(aliasId) : expr.kind === "column" ? expr.parts[expr.parts.length - 1] : undefined;
		return { name, isStar: false, expr, cst: item };
	}
	return { name: undefined, isStar: false, expr: otherExpr(item), cst: item };
}

/** select_column_star / select_column_dot_star with star_modifiers (EXCEPT / REPLACE). */
function lowerStar(node: ParserRuleContext, qualifier: string[] | undefined): Extract<Expr, { kind: "star" }> {
	const expr: Extract<Expr, { kind: "star" }> = { kind: "star", qualifier, cst: node };
	const mods = directChildrenOfRule(node, P.RULE_star_modifiers)[0];
	if (mods) {
		const except = directChildrenOfRule(mods, P.RULE_star_except_list)[0];
		if (except) expr.exclude = directChildrenOfRule(except, P.RULE_identifier).map(identText);
		const replace = directChildrenOfRule(mods, P.RULE_star_replace_list)[0];
		if (replace) {
			expr.replace = directChildrenOfRule(replace, P.RULE_star_replace_item).map((ri) => {
				const e = directChildrenOfRule(ri, P.RULE_expression)[0];
				const id = directChildrenOfRule(ri, P.RULE_identifier)[0];
				return { column: id ? identText(id) : "", expr: e ? lowerExpr(e) : otherExpr(ri) };
			});
		}
	}
	return expr;
}

// --- sources ---------------------------------------------------------------------

/** from_clause_contents: table_primary from_clause_contents_suffix* */
function buildSources(contents: ParserRuleContext, unsupported: string[]): Source[] {
	const out: Source[] = [];
	const first = directChildrenOfRule(contents, P.RULE_table_primary)[0];
	if (first) collectTablePrimary(first, out, unsupported);
	for (const suffix of directChildrenOfRule(contents, P.RULE_from_clause_contents_suffix)) {
		const tp = directChildrenOfRule(suffix, P.RULE_table_primary)[0];
		if (tp) collectTablePrimary(tp, out, unsupported);
	}
	return out;
}

/** A table_primary may wrap a parenthesized `join` (a nested join tree) — flatten it. */
function collectTablePrimary(tp: ParserRuleContext, out: Source[], unsupported: string[]): void {
	const join = directChildrenOfRule(tp, P.RULE_join)[0];
	if (join) {
		const inner = directChildrenOfRule(join, P.RULE_table_primary)[0];
		if (inner) collectTablePrimary(inner, out, unsupported);
		for (const ji of directChildrenOfRule(join, P.RULE_join_item)) {
			const t = directChildrenOfRule(ji, P.RULE_table_primary)[0];
			if (t) collectTablePrimary(t, out, unsupported);
		}
		return;
	}
	// table_primary match_recognize_clause | table_primary sample_clause — unwrap to the inner primary.
	const innerPrimary = directChildrenOfRule(tp, P.RULE_table_primary)[0];
	if (innerPrimary) {
		collectTablePrimary(innerPrimary, out, unsupported);
		return;
	}
	out.push(buildSource(tp, unsupported));
}

function buildSource(tp: ParserRuleContext, unsupported: string[]): Source {
	// table_subquery: parenthesized_query opt_pivot_or_unpivot_clause_and_alias?
	const subquery = directChildrenOfRule(tp, P.RULE_table_subquery)[0];
	if (subquery) {
		const paren = directChildrenOfRule(subquery, P.RULE_parenthesized_query)[0];
		const aliasInfo = aliasOf(directChildrenOfRule(subquery, P.RULE_opt_pivot_or_unpivot_clause_and_alias)[0]);
		return {
			kind: "subquery",
			query: paren ? lowerParenthesizedQuery(paren) : emptyQuery(tp, "non-query"),
			alias: aliasInfo?.alias,
			aliasCst: aliasInfo?.cst,
			cst: tp,
		};
	}

	// table_path_expression: table_path_expression_base hint? alias? with_offset? at_system_time?
	const pathExpr = directChildrenOfRule(tp, P.RULE_table_path_expression)[0];
	if (pathExpr) return buildPathSource(pathExpr);

	// tvf_with_suffixes: a table-valued function — opaque columns (need the signature).
	const tvf = directChildrenOfRule(tp, P.RULE_tvf_with_suffixes)[0];
	if (tvf) {
		const path = firstOfRule(tvf, P.RULE_path_expression);
		const aliasInfo = aliasOf(directChildrenOfRule(tvf, P.RULE_pivot_or_unpivot_clause_and_aliases)[0]);
		return {
			kind: "table",
			name: path ? pathParts(path) : [tp.getText()],
			alias: aliasInfo?.alias,
			aliasCst: aliasInfo?.cst,
			cst: tp,
		};
	}

	return { kind: "table", name: [stripBackticks(tp.getText())], cst: tp };
}

/** table_path_expression: base (unnest | path) + alias. */
function buildPathSource(pathExpr: ParserRuleContext): Source {
	const base = directChildrenOfRule(pathExpr, P.RULE_table_path_expression_base)[0];
	const aliasInfo =
		aliasOf(directChildrenOfRule(pathExpr, P.RULE_opt_pivot_or_unpivot_clause_and_alias)[0]) ??
		offsetAliasOf(pathExpr);

	const unnest = base ? firstOfRule(base, P.RULE_unnest_expression) : undefined;
	if (unnest) {
		return {
			kind: "lateral",
			alias: aliasInfo?.alias,
			aliasCst: aliasInfo?.cst,
			columns: aliasInfo?.alias ? [aliasInfo.alias] : [],
			cst: pathExpr,
		};
	}

	const path = base ? firstOfRule(base, P.RULE_path_expression) : undefined;
	const name = path ? pathParts(path) : base ? dashedPathParts(base) : [stripBackticks(pathExpr.getText())];
	return { kind: "table", name, alias: aliasInfo?.alias, aliasCst: aliasInfo?.cst, cst: pathExpr };
}

/** opt_pivot_or_unpivot_clause_and_alias / pivot_or_unpivot_clause_and_aliases → its leading identifier. */
function aliasOf(node: ParserRuleContext | undefined): { alias: string; cst: ParserRuleContext } | undefined {
	if (!node) return undefined;
	const id = directChildrenOfRule(node, P.RULE_identifier)[0];
	return id ? { alias: identText(id), cst: id } : undefined;
}

/** WITH OFFSET AS alias (table_path_expression opt_with_offset_and_alias). */
function offsetAliasOf(pathExpr: ParserRuleContext): { alias: string; cst: ParserRuleContext } | undefined {
	const off = directChildrenOfRule(pathExpr, P.RULE_opt_with_offset_and_alias)[0];
	if (!off) return undefined;
	const asAlias = directChildrenOfRule(off, P.RULE_as_alias)[0];
	const id = asAlias ? directChildrenOfRule(asAlias, P.RULE_identifier)[0] : undefined;
	return id ? { alias: identText(id), cst: id } : undefined;
}

function extractJoinConditions(contents: ParserRuleContext): Expr[] {
	const out: Expr[] = [];
	const walk = (node: ParseTree): void => {
		for (const oc of shallowNodesOfRule(node, P.RULE_on_clause)) {
			const e = directChildrenOfRule(oc, P.RULE_expression)[0];
			if (e) out.push(lowerExpr(e));
		}
	};
	walk(contents);
	return out;
}

// --- GROUP BY / ORDER BY / LIMIT -------------------------------------------------

/** group_by_clause: group_by_all | group_by_clause_prefix (… grouping_item …). */
function extractGroupBy(clause: ParserRuleContext): Expr[] | undefined {
	const prefix = firstOfRule(clause, P.RULE_group_by_clause_prefix);
	if (!prefix) return undefined;
	const items: Expr[] = [];
	for (const gi of directChildrenOfRule(prefix, P.RULE_grouping_item)) {
		// grouping_item may be (), a plain expression, or ROLLUP/CUBE/GROUPING SETS — collect every key expr.
		for (const e of collectOfRule(gi, P.RULE_expression)) items.push(lowerExpr(e));
	}
	return items.length ? items : undefined;
}

function extractOrderBy(clause: ParserRuleContext): Expr[] | undefined {
	const items = collectOfRule(clause, P.RULE_ordering_expression).map((oe) => {
		const e = directChildrenOfRule(oe, P.RULE_expression)[0];
		return e ? lowerExpr(e) : otherExpr(oe);
	});
	return items.length ? items : undefined;
}

/** limit_offset_clause: LIMIT expression (OFFSET expression)? */
function extractLimit(clause: ParserRuleContext): LimitInfo | undefined {
	const exprs = directChildrenOfRule(clause, P.RULE_expression);
	if (!exprs.length) return undefined;
	const info: LimitInfo = { top: lowerExpr(exprs[0]) };
	if (exprs[1]) info.offset = lowerExpr(exprs[1]);
	return info;
}

// --- expressions -----------------------------------------------------------------

function lowerExpr(node: ParserRuleContext | undefined): Expr {
	if (!node) return { kind: "literal", text: "", cst: node as never };
	switch (node.ruleIndex) {
		case P.RULE_expression:
			return lowerExpression(node);
		case P.RULE_and_expression:
			return lowerAnd(node);
		case P.RULE_expression_higher_prec_than_and:
		case P.RULE_expression_maybe_parenthesized_not_a_query:
			return lowerHigherPrec(node);
		default:
			return lowerLeaf(node);
	}
}

/** expression: expression_higher_prec_than_and | and_expression | expression OR expression */
function lowerExpression(node: ParserRuleContext): Expr {
	const orParts = directChildrenOfRule(node, P.RULE_expression);
	if (orParts.length === 2) {
		return { kind: "binary", op: "or", left: lowerExpr(orParts[0]), right: lowerExpr(orParts[1]), cst: node };
	}
	const and = directChildrenOfRule(node, P.RULE_and_expression)[0];
	if (and) return lowerAnd(and);
	const ehpa = directChildrenOfRule(node, P.RULE_expression_higher_prec_than_and)[0];
	return ehpa ? lowerHigherPrec(ehpa) : otherExpr(node);
}

/** and_expression: ehpa AND ehpa (AND ehpa)* — left-fold to binary "and". */
function lowerAnd(node: ParserRuleContext): Expr {
	const parts = directChildrenOfRule(node, P.RULE_expression_higher_prec_than_and);
	if (!parts.length) return otherExpr(node);
	let acc = lowerHigherPrec(parts[0]);
	for (let i = 1; i < parts.length; i++) {
		acc = { kind: "binary", op: "and", left: acc, right: lowerHigherPrec(parts[i]), cst: node };
	}
	return acc;
}

/** The flattened ZetaSQL `expression_higher_prec_than_and` rule. */
function lowerHigherPrec(node: ParserRuleContext): Expr {
	const subs = directChildrenOfRule(node, P.RULE_expression_higher_prec_than_and);

	// Operator predicates (binary precedence rules carry their own operator sub-rule).
	if (subs.length >= 1) {
		// IS [NOT] DISTINCT FROM
		const distinct = directChildrenOfRule(node, P.RULE_distinct_operator)[0];
		if (distinct && subs.length === 2) {
			return {
				kind: "predicate",
				op: "distinct from",
				negated: hasDirectToken(distinct, P.NOT_SYMBOL),
				operand: lowerHigherPrec(subs[0]),
				args: [lowerHigherPrec(subs[1])],
				cst: node,
			};
		}
		// IS [NOT] NULL / TRUE / FALSE / UNKNOWN
		const isOp = directChildrenOfRule(node, P.RULE_is_operator)[0];
		if (isOp) {
			const negated = hasDirectToken(isOp, P.NOT_SYMBOL);
			const operand = lowerHigherPrec(subs[0]);
			if (hasDirectToken(node, P.UNKNOWN_SYMBOL)) {
				return { kind: "predicate", op: "unknown", negated, operand, args: [], cst: node };
			}
			const boolLit = directChildrenOfRule(node, P.RULE_boolean_literal)[0];
			if (boolLit) {
				return { kind: "predicate", op: boolLit.getText().toLowerCase(), negated, operand, args: [], cst: node };
			}
			return { kind: "predicate", op: "null", negated, operand, args: [], cst: node };
		}
		// [NOT] BETWEEN x AND y
		const between = directChildrenOfRule(node, P.RULE_between_operator)[0];
		if (between && subs.length >= 3) {
			return {
				kind: "predicate",
				op: "between",
				negated: hasDirectToken(between, P.NOT_SYMBOL),
				operand: lowerHigherPrec(subs[0]),
				args: [lowerHigherPrec(subs[1]), lowerHigherPrec(subs[2])],
				cst: node,
			};
		}
		// [NOT] IN (list | subquery | UNNEST)
		const inOp = directChildrenOfRule(node, P.RULE_in_operator)[0];
		if (inOp) {
			return {
				kind: "predicate",
				op: "in",
				negated: hasDirectToken(inOp, P.NOT_SYMBOL),
				operand: lowerHigherPrec(subs[0]),
				args: inRhsArgs(node),
				cst: node,
			};
		}
		// [NOT] LIKE pattern (optionally ANY/SOME/ALL)
		const likeOp = directChildrenOfRule(node, P.RULE_like_operator)[0];
		if (likeOp && subs.length === 2) {
			return {
				kind: "predicate",
				op: "like",
				negated: hasDirectToken(likeOp, P.NOT_SYMBOL),
				operand: lowerHigherPrec(subs[0]),
				args: [lowerHigherPrec(subs[1])],
				cst: node,
			};
		}
	}

	// Binary arithmetic / comparison / bitwise.
	if (subs.length === 2) {
		const op = binaryOp(node);
		return { kind: "binary", op, left: lowerHigherPrec(subs[0]), right: lowerHigherPrec(subs[1]), cst: node };
	}

	// Unary: NOT ehpa | unary_operator ehpa
	if (subs.length === 1) {
		// subscript: ehpa '[' expression ']'
		if (hasDirectToken(node, P.LS_BRACKET_SYMBOL)) {
			const idx = directChildrenOfRule(node, P.RULE_expression)[0];
			return {
				kind: "subscript",
				base: lowerHigherPrec(subs[0]),
				index: idx ? lowerExpr(idx) : otherExpr(node),
				cst: node,
			};
		}
		// dotted field access: ehpa '.' identifier  |  ehpa '.' '(' path ')'
		if (hasDirectToken(node, P.DOT_SYMBOL)) {
			const base = lowerHigherPrec(subs[0]);
			const id = directChildrenOfRule(node, P.RULE_identifier)[0];
			if (id && base.kind === "column") {
				return { kind: "column", parts: [...base.parts, identText(id)], cst: node };
			}
			const path = directChildrenOfRule(node, P.RULE_path_expression)[0];
			const idxText = id ? identText(id) : path ? path.getText() : "field";
			return { kind: "subscript", base, index: { kind: "literal", text: idxText, cst: node }, cst: node };
		}
		const unary = directChildrenOfRule(node, P.RULE_unary_operator)[0];
		if (unary) {
			return { kind: "unary", op: unary.getText(), operand: lowerHigherPrec(subs[0]), cst: node };
		}
		if (hasDirectToken(node, P.NOT_SYMBOL)) {
			return { kind: "unary", op: "not", operand: lowerHigherPrec(subs[0]), cst: node };
		}
		// a single ehpa child with no operator — a parenthesized passthrough.
		return lowerHigherPrec(subs[0]);
	}

	// Leaf alternatives (no nested ehpa): a literal / identifier / call / constructor / subquery.
	return lowerLeafAlternative(node);
}

function binaryOp(node: ParserRuleContext): string {
	for (const r of [
		P.RULE_comparative_operator,
		P.RULE_additive_operator,
		P.RULE_multiplicative_operator,
		P.RULE_shift_operator,
	]) {
		const opNode = directChildrenOfRule(node, r)[0];
		if (opNode) return opNode.getText();
	}
	const t = directTokenType(node, [P.STROKE_SYMBOL, P.CIRCUMFLEX_SYMBOL, P.BIT_AND_SYMBOL, P.BOOL_OR_SYMBOL]);
	if (t !== undefined) return tokenText(node, t) ?? "";
	return "";
}

/** The RHS of IN: a parenthesized list, a subquery, or UNNEST(...). */
function inRhsArgs(node: ParserRuleContext): Expr[] {
	const rhs = directChildrenOfRule(node, P.RULE_parenthesized_in_rhs)[0];
	if (rhs) {
		const paren = directChildrenOfRule(rhs, P.RULE_parenthesized_query)[0];
		if (paren) return [{ kind: "subquery", query: lowerParenthesizedQuery(paren), cst: paren }];
		const prefix = directChildrenOfRule(rhs, P.RULE_in_list_two_or_more_prefix)[0];
		if (prefix) return directChildrenOfRule(prefix, P.RULE_expression).map(lowerExpr);
		const single = directChildrenOfRule(rhs, P.RULE_expression_maybe_parenthesized_not_a_query)[0];
		if (single) return [lowerExpr(single)];
	}
	const unnest = directChildrenOfRule(node, P.RULE_unnest_expression)[0];
	if (unnest) return collectOfRule(unnest, P.RULE_expression).map(lowerExpr);
	return [];
}

/** A leaf `expression_higher_prec_than_and` — dispatch on its single rule child. */
function lowerLeafAlternative(node: ParserRuleContext): Expr {
	// parenthesized subquery / grouping
	const paren = directChildrenOfRule(node, P.RULE_parenthesized_query)[0];
	if (paren) return { kind: "subquery", query: lowerParenthesizedQuery(paren), cst: node };
	const group = directChildrenOfRule(node, P.RULE_parenthesized_expression_not_a_query)[0];
	if (group) {
		const inner = firstOfRule(group, P.RULE_expression_maybe_parenthesized_not_a_query);
		return inner ? lowerExpr(inner) : otherExpr(node);
	}
	const child = firstRuleChild(node);
	return child ? lowerLeaf(child) : otherExpr(node);
}

/** Lower a concrete leaf-expression production node. */
function lowerLeaf(node: ParserRuleContext): Expr {
	switch (node.ruleIndex) {
		case P.RULE_expression:
			return lowerExpression(node);
		case P.RULE_expression_higher_prec_than_and:
		case P.RULE_expression_maybe_parenthesized_not_a_query:
			return lowerHigherPrec(node);
		case P.RULE_null_literal:
		case P.RULE_boolean_literal:
		case P.RULE_string_literal:
		case P.RULE_bytes_literal:
		case P.RULE_integer_literal:
		case P.RULE_numeric_literal:
		case P.RULE_bignumeric_literal:
		case P.RULE_json_literal:
		case P.RULE_floating_point_literal:
		case P.RULE_date_or_time_literal:
		case P.RULE_range_literal:
		case P.RULE_parameter_expression:
		case P.RULE_system_variable_expression:
			return { kind: "literal", text: node.getText(), cst: node };
		case P.RULE_identifier:
			return { kind: "column", parts: [identText(node)], cst: node };
		case P.RULE_path_expression:
			return { kind: "column", parts: pathParts(node), cst: node };
		case P.RULE_function_call_expression_with_clauses:
			return lowerFunctionCall(node);
		case P.RULE_case_expression:
			return lowerCase(node);
		case P.RULE_cast_expression:
			return lowerCast(node);
		case P.RULE_extract_expression:
			return lowerExtract(node);
		case P.RULE_interval_expression: {
			const args = directChildrenOfRule(node, P.RULE_expression).map(lowerExpr);
			return { kind: "function", name: "interval", args, aggregate: false, distinct: false, cst: node };
		}
		case P.RULE_array_constructor:
			return { kind: "function", name: "array", args: collectArgExprs(node), aggregate: false, distinct: false, cst: node };
		case P.RULE_struct_constructor:
			return { kind: "function", name: "struct", args: collectArgExprs(node), aggregate: false, distinct: false, cst: node };
		case P.RULE_expression_subquery_with_keyword:
			return lowerSubqueryKeyword(node);
		case P.RULE_parenthesized_expression_not_a_query: {
			const inner = firstOfRule(node, P.RULE_expression_maybe_parenthesized_not_a_query);
			return inner ? lowerExpr(inner) : otherExpr(node);
		}
		case P.RULE_parenthesized_query:
			return { kind: "subquery", query: lowerParenthesizedQuery(node), cst: node };
		default:
			return otherExpr(node);
	}
}

/** ARRAY(subquery) | EXISTS(subquery). */
function lowerSubqueryKeyword(node: ParserRuleContext): Expr {
	const paren = directChildrenOfRule(node, P.RULE_parenthesized_query)[0];
	const query = paren ? lowerParenthesizedQuery(paren) : emptyQuery(node, "non-query");
	if (hasDirectToken(node, P.EXISTS_SYMBOL)) return { kind: "exists", query, cst: node };
	return { kind: "subquery", query, cst: node };
}

/** function_call_expression_with_clauses: path_expression '(' DISTINCT? suffix | keyword '(' suffix */
function lowerFunctionCall(node: ParserRuleContext): Expr {
	const path = directChildrenOfRule(node, P.RULE_path_expression)[0];
	const keyword = directChildrenOfRule(node, P.RULE_function_name_from_keyword)[0];
	const name = (path ? pathParts(path).slice(-1)[0] : keyword ? keyword.getText() : leftmostToken(node) ?? "").toLowerCase();

	const suffix = directChildrenOfRule(node, P.RULE_function_call_expression_with_clauses_suffix)[0];
	const args = suffix ? collectCallArgs(suffix) : [];
	const over = suffix ? firstOfRule(suffix, P.RULE_over_clause) : undefined;
	const window = over ? lowerOver(over) : undefined;
	const distinct = hasDirectToken(node, P.DISTINCT_SYMBOL);

	return { kind: "function", name, args, aggregate: AGGREGATES.has(name), distinct, window, cst: node };
}

/** function_call_argument children of the suffix (skipping nested calls' own args). */
function collectCallArgs(suffix: ParserRuleContext): Expr[] {
	const out: Expr[] = [];
	for (const arg of shallowNodesOfRule(suffix, P.RULE_function_call_argument)) {
		// function_call_argument: expression alias? | named_argument | lambda_argument | sequence_arg
		const named = directChildrenOfRule(arg, P.RULE_named_argument)[0];
		if (named) {
			const e = directChildrenOfRule(named, P.RULE_expression)[0];
			if (e) out.push(lowerExpr(e));
			const lam = directChildrenOfRule(named, P.RULE_lambda_argument)[0];
			if (lam) out.push(lowerLambda(lam));
			continue;
		}
		const lambda = directChildrenOfRule(arg, P.RULE_lambda_argument)[0];
		if (lambda) {
			out.push(lowerLambda(lambda));
			continue;
		}
		const e = directChildrenOfRule(arg, P.RULE_expression)[0];
		if (e) out.push(lowerExpr(e));
	}
	return out;
}

/** lambda_argument: lambda_argument_list -> expression. */
function lowerLambda(node: ParserRuleContext): Expr {
	const list = directChildrenOfRule(node, P.RULE_lambda_argument_list)[0];
	const params = list ? collectOfRule(list, P.RULE_identifier).map(identText) : [];
	const body = directChildrenOfRule(node, P.RULE_expression)[0];
	return { kind: "lambda", params, body: body ? lowerExpr(body) : otherExpr(node), cst: node };
}

function lowerOver(over: ParserRuleContext): { partitionBy: Expr[]; orderBy: Expr[]; cst: ParserRuleContext } {
	const spec = directChildrenOfRule(over, P.RULE_window_specification)[0] ?? over;
	const pb = firstOfRule(spec, P.RULE_partition_by_clause);
	const partitionBy = pb ? collectOfRule(pb, P.RULE_expression).map(lowerExpr) : [];
	const ob = directChildrenOfRule(spec, P.RULE_order_by_clause)[0];
	const orderBy = ob ? collectOfRule(ob, P.RULE_ordering_expression).map((oe) => {
		const e = directChildrenOfRule(oe, P.RULE_expression)[0];
		return e ? lowerExpr(e) : otherExpr(oe);
	}) : [];
	return { partitionBy, orderBy, cst: over };
}

function lowerCase(node: ParserRuleContext): Expr {
	// case_value_expression_prefix has a leading subject expr; case_no_value does not.
	const hasValue = firstOfRule(node, P.RULE_case_value_expression_prefix) !== undefined;
	const exprs = collectCaseExprs(node);
	let idx = 0;
	let subject: Expr | undefined;
	if (hasValue && exprs.length) subject = lowerExpr(exprs[idx++]);
	const whens: { when: Expr; then: Expr }[] = [];
	// remaining exprs come as (when, then) pairs; a trailing single expr is the ELSE.
	const remaining = exprs.slice(idx);
	const hasElse = hasElseClause(node);
	const pairCount = hasElse ? (remaining.length - 1) / 2 : remaining.length / 2;
	for (let i = 0; i < pairCount; i++) {
		const whenVal = lowerExpr(remaining[i * 2]);
		const then = lowerExpr(remaining[i * 2 + 1]);
		const when = subject
			? { kind: "binary" as const, op: "=", left: subject, right: whenVal, cst: node }
			: whenVal;
		whens.push({ when, then });
	}
	const elseExpr = hasElse ? lowerExpr(remaining[remaining.length - 1]) : undefined;
	return { kind: "case", whens, elseExpr, cst: node };
}

function collectCaseExprs(node: ParserRuleContext): ParserRuleContext[] {
	// All `expression` nodes that belong to this CASE (prefix WHEN/THEN/subject + the ELSE expr),
	// not descending into nested CASE/subquery.
	return shallowNodesOfRule(node, P.RULE_expression);
}

function hasElseClause(node: ParserRuleContext): boolean {
	// case_expression: prefix END | prefix ELSE expression END — ELSE present iff an expression is a
	// direct child of case_expression (the prefix holds the WHEN/THEN/subject exprs).
	return directChildrenOfRule(node, P.RULE_expression).length > 0;
}

function lowerCast(node: ParserRuleContext): Expr {
	const inner = directChildrenOfRule(node, P.RULE_expression)[0];
	const type = directChildrenOfRule(node, P.RULE_type)[0];
	return {
		kind: "cast",
		expr: inner ? lowerExpr(inner) : otherExpr(node),
		typeText: type ? type.getText() : "",
		cst: node,
	};
}

function lowerExtract(node: ParserRuleContext): Expr {
	const args = collectOfRule(node, P.RULE_expression).map(lowerExpr);
	return { kind: "function", name: "extract", args, aggregate: false, distinct: false, cst: node };
}

/** Collect the direct `expression` arguments of a constructor (array/struct). */
function collectArgExprs(node: ParserRuleContext): Expr[] {
	return shallowNodesOfRule(node, P.RULE_expression).map(lowerExpr);
}

// --- column extraction (single source of truth for SelectExpr.columns) -----------

function columnsOf(expr: Expr, acc: ColumnRef[], clause: Clause): void {
	switch (expr.kind) {
		case "column":
			acc.push({ parts: expr.parts, clause, cst: expr.cst });
			break;
		case "binary":
			columnsOf(expr.left, acc, clause);
			columnsOf(expr.right, acc, clause);
			break;
		case "unary":
			columnsOf(expr.operand, acc, clause);
			break;
		case "cast":
			columnsOf(expr.expr, acc, clause);
			break;
		case "function":
			expr.args.forEach((a) => columnsOf(a, acc, clause));
			expr.window?.partitionBy.forEach((a) => columnsOf(a, acc, clause));
			expr.window?.orderBy.forEach((a) => columnsOf(a, acc, clause));
			break;
		case "case":
			expr.whens.forEach((w) => {
				columnsOf(w.when, acc, clause);
				columnsOf(w.then, acc, clause);
			});
			if (expr.elseExpr) columnsOf(expr.elseExpr, acc, clause);
			break;
		case "predicate":
			columnsOf(expr.operand, acc, clause);
			expr.args.forEach((a) => columnsOf(a, acc, clause));
			break;
		case "subscript":
			columnsOf(expr.base, acc, clause);
			columnsOf(expr.index, acc, clause);
			break;
		case "lambda":
			columnsOf(expr.body, acc, clause);
			break;
		case "other":
			cstColumnRefs(expr.cst, acc, clause);
			break;
		// literal / star / subquery / exists → no column refs at this level
	}
}

/** Fallback: recover column references from inside an unmodelled `other` node. */
function cstColumnRefs(node: ParseTree, acc: ColumnRef[], clause: Clause): void {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (!(child instanceof ParserRuleContext)) continue;
		if (child.ruleIndex === P.RULE_parenthesized_query) continue; // its own scope
		if (child.ruleIndex === P.RULE_path_expression) {
			acc.push({ parts: pathParts(child), clause, cst: child });
			continue;
		}
		if (child.ruleIndex === P.RULE_identifier) {
			acc.push({ parts: [identText(child)], clause, cst: child });
			continue;
		}
		cstColumnRefs(child, acc, clause);
	}
}

function hasAggregate(expr: Expr): boolean {
	switch (expr.kind) {
		case "function":
			return (expr.aggregate && !expr.window) || expr.args.some(hasAggregate);
		case "binary":
			return hasAggregate(expr.left) || hasAggregate(expr.right);
		case "unary":
			return hasAggregate(expr.operand);
		case "cast":
			return hasAggregate(expr.expr);
		case "case":
			return (
				expr.whens.some((w) => hasAggregate(w.when) || hasAggregate(w.then)) ||
				(expr.elseExpr !== undefined && hasAggregate(expr.elseExpr))
			);
		case "predicate":
			return hasAggregate(expr.operand) || expr.args.some(hasAggregate);
		case "subscript":
			return hasAggregate(expr.base);
		default:
			return false;
	}
}

// --- expression subqueries (scalar / IN / EXISTS / ARRAY) ------------------------

function fromSubqueryNodes(from: Source[]): Set<ParserRuleContext> {
	const set = new Set<ParserRuleContext>();
	for (const s of from) {
		if (s.kind === "subquery") {
			const q = firstOfRule(s.cst, P.RULE_parenthesized_query);
			if (q) set.add(q);
		}
	}
	return set;
}

function extractExpressionSubqueries(select: ParserRuleContext, fromQueries: Set<ParserRuleContext>): QueryExpr[] {
	const out: QueryExpr[] = [];
	const walk = (n: ParseTree): void => {
		for (let i = 0; i < n.getChildCount(); i++) {
			const child = n.getChild(i);
			if (!(child instanceof ParserRuleContext)) continue;
			if (child.ruleIndex === P.RULE_parenthesized_query) {
				if (!fromQueries.has(child)) out.push(lowerParenthesizedQuery(child));
				continue; // its own scope — don't descend
			}
			// the FROM sources are lowered separately; don't re-collect their subqueries here.
			if (child.ruleIndex === P.RULE_from_clause) continue;
			walk(child);
		}
	};
	walk(select);
	return out;
}

// --- name helpers ----------------------------------------------------------------

/** path_expression: identifier (DOT identifier)* — the dotted parts. A single backtick-quoted
 *  identifier may itself hold a dotted path (`proj.ds.t`), so each part is split on `.`. */
function pathParts(node: ParserRuleContext): string[] {
	const ids = collectOfRule(node, P.RULE_identifier);
	if (ids.length) return ids.flatMap((id) => stripBackticks(id.getText()).split("."));
	return node
		.getText()
		.split(".")
		.map(stripBackticks)
		.filter((p) => p.length > 0);
}

/** A dashed/slashed path (BigQuery `project-id.dataset.table`) used as a table name. */
function dashedPathParts(base: ParserRuleContext): string[] {
	const text = stripBackticks(base.getText());
	return text.split(".").map(stripBackticks).filter((p) => p.length > 0);
}

/** The name parts of the leading ehpa of `t.*` (for the star qualifier). */
function exprToNameParts(node: ParserRuleContext): string[] | undefined {
	const path = firstOfRule(node, P.RULE_path_expression);
	if (path) return pathParts(path);
	const id = firstOfRule(node, P.RULE_identifier);
	return id ? [identText(id)] : undefined;
}

function identText(node: ParserRuleContext): string {
	return stripBackticks(node.getText());
}

function stripBackticks(text: string): string {
	if (text.length >= 2 && text[0] === "`" && text[text.length - 1] === "`") return text.slice(1, -1);
	return text;
}

// --- generic CST navigation (ported from src/snowflake/lower.ts) -----------------

function* descendants(node: ParseTree): Generator<ParserRuleContext> {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof ParserRuleContext) {
			yield child;
			yield* descendants(child);
		}
	}
}

function firstOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext | undefined {
	for (const d of descendants(node)) if (d.ruleIndex === ruleIndex) return d;
	return undefined;
}

function directChildrenOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof ParserRuleContext && child.ruleIndex === ruleIndex) out.push(child);
	}
	return out;
}

function collectOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	for (const d of descendants(node)) if (d.ruleIndex === ruleIndex) out.push(d);
	return out;
}

/** Rule nodes within `node`, not descending into a nested subquery (parenthesized_query) or a
 *  matched node; matched nodes are not themselves descended into. */
function shallowNodesOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	const walk = (n: ParseTree): void => {
		for (let i = 0; i < n.getChildCount(); i++) {
			const child = n.getChild(i);
			if (!(child instanceof ParserRuleContext)) continue;
			if (child.ruleIndex === ruleIndex) out.push(child);
			else if (child.ruleIndex === P.RULE_parenthesized_query) continue;
			else walk(child);
		}
	};
	walk(node);
	return out;
}

function firstShallow(node: ParseTree, ruleIndex: number): ParserRuleContext | undefined {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (!(child instanceof ParserRuleContext)) continue;
		if (child.ruleIndex === ruleIndex) return child;
		if (child.ruleIndex === P.RULE_parenthesized_query) continue;
		const found = firstShallow(child, ruleIndex);
		if (found) return found;
	}
	return undefined;
}

function directTokenType(node: ParseTree, types: number[]): number | undefined {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof TerminalNode && types.includes(child.symbol.type)) return child.symbol.type;
	}
	return undefined;
}

function tokenText(node: ParseTree, type: number | undefined): string | undefined {
	if (type === undefined) return undefined;
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof TerminalNode && child.symbol.type === type) return child.getText();
	}
	return undefined;
}

function hasDirectToken(node: ParseTree, type: number): boolean {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof TerminalNode && child.symbol.type === type) return true;
	}
	return false;
}

/** Token present anywhere within `node`, not descending into a nested subquery. */
function hasTokenDeep(node: ParseTree, type: number): boolean {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof TerminalNode && child.symbol.type === type) return true;
		if (child instanceof ParserRuleContext && child.ruleIndex !== P.RULE_parenthesized_query && hasTokenDeep(child, type)) {
			return true;
		}
	}
	return false;
}

function firstRuleChild(node: ParserRuleContext): ParserRuleContext | undefined {
	for (let i = 0; i < node.getChildCount(); i++) {
		const c = node.getChild(i);
		if (c instanceof ParserRuleContext) return c;
	}
	return undefined;
}

function leftmostToken(node: ParseTree): string | undefined {
	let n: ParseTree = node;
	while (n.getChildCount() > 0) {
		const first = n.getChild(0);
		if (!first) return undefined;
		if (first instanceof TerminalNode) return first.getText();
		n = first;
	}
	return undefined;
}

function otherExpr(node: ParserRuleContext): Expr {
	return { kind: "other", text: node.getText(), cst: node };
}

function emptyBody(cst: ParserRuleContext, reason: string): SelectExpr {
	return { kind: "select", projections: [], from: [], columns: [], aggregated: false, unsupported: [reason], cst };
}

function emptyQuery(cst: ParserRuleContext, reason: string): QueryExpr {
	return { kind: "query", ctes: [], body: emptyBody(cst, reason), cst };
}
