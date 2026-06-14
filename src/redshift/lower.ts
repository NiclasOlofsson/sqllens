import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import { RedshiftParser as P } from "../generated/redshift/RedshiftParser.js";
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
	WindowSpec,
} from "../ir/ir.js";
import { keywordCategory, type StatementCategory } from "../ir/statement.js";

// ---------------------------------------------------------------------------
// Lowering — Amazon Redshift (bytebase/parser fork, a PostgreSQL-grammar fork)
// CST -> the shared dialect-neutral IR (src/ir/ir.ts). The semantic layer runs
// on the IR unchanged; only this file knows Redshift's grammar.
//
// The expression grammar is the Postgres precedence cascade
// (a_expr -> a_expr_qual -> … -> a_expr_typecast -> c_expr): each level is its
// own rule, passed through when it carries no operator. Constructs not yet
// modelled become explicit `other`/`unsupported`, never silently dropped.
// Navigation is by rule index; nested select_with_parens / subqueries belong to
// their own scope, so shallow walks never descend into them.
// ---------------------------------------------------------------------------

// docs.aws.amazon.com/redshift/latest/dg/c_Aggregate_Functions.html
// + the approximate / bit / boolean / window-capable aggregate families.
const AGGREGATES = new Set([
	"any_value",
	"approximate",
	"avg",
	"bit_and",
	"bit_or",
	"bool_and",
	"bool_or",
	"corr",
	"count",
	"count_if",
	"covar_pop",
	"covar_samp",
	"cume_dist",
	"kurtosis",
	"listagg",
	"max",
	"median",
	"min",
	"percentile_cont",
	"percentile_disc",
	"regr_avgx",
	"regr_avgy",
	"regr_count",
	"regr_intercept",
	"regr_r2",
	"regr_slope",
	"regr_sxx",
	"regr_sxy",
	"regr_syy",
	"skewness",
	"stddev",
	"stddev_pop",
	"stddev_samp",
	"sum",
	"var_pop",
	"var_samp",
	"variance",
]);

/** Lower a parsed Redshift file (root: stmtblock of `;`-separated statements) into the IR.
 *  A single SELECT statement lowers fully; anything else (DDL, DML, multi-statement batches)
 *  becomes a flagged non-query body — a valid parse never throws. */
export function lower(tree: ParserRuleContext): QueryExpr {
	const stmts = collectOfRule(tree, P.RULE_stmt);
	const statement = statementCategory(stmts);
	if (stmts.length !== 1) {
		const q = nonQuery(tree, stmts.length === 0 ? "empty" : "multi-statement");
		q.statement = statement;
		return q;
	}
	const selectStmt = directChildrenOfRule(stmts[0], P.RULE_selectstmt)[0];
	if (!selectStmt) {
		const q = nonQuery(stmts[0], "non-query");
		q.statement = statement;
		return q;
	}
	const q = lowerSelectStmt(selectStmt);
	q.statement = statement;
	return q;
}

function statementCategory(stmts: ParserRuleContext[]): StatementCategory {
	if (stmts.length === 0) return "other";
	if (stmts.length > 1) return "compound";
	if (directChildrenOfRule(stmts[0], P.RULE_selectstmt).length) return "query";
	return keywordCategory(stmts[0].start?.text ?? "");
}

function nonQuery(cst: ParserRuleContext, reason: string): QueryExpr {
	return {
		kind: "query",
		ctes: [],
		body: { kind: "select", projections: [], from: [], columns: [], aggregated: false, unsupported: [reason], cst },
		cst,
	};
}

// --- query statement: WITH / set ops / ORDER BY / LIMIT -----------------------

/** selectstmt: select_no_parens | select_with_parens */
function lowerSelectStmt(stmt: ParserRuleContext): QueryExpr {
	const noParens = directChildrenOfRule(stmt, P.RULE_select_no_parens)[0];
	if (noParens) return lowerSelectNoParens(noParens);
	const withParens = directChildrenOfRule(stmt, P.RULE_select_with_parens)[0];
	if (withParens) {
		const inner = innerSelect(withParens);
		return inner ? lowerSelectStmt(inner) : emptyQuery(stmt);
	}
	return emptyQuery(stmt);
}

/** select_with_parens: '(' select_no_parens ')' | '(' select_with_parens ')' — unwrap. */
function innerSelect(withParens: ParserRuleContext): ParserRuleContext | undefined {
	const noParens = directChildrenOfRule(withParens, P.RULE_select_no_parens)[0];
	if (noParens) return findSelectStmtParent(noParens);
	const inner = directChildrenOfRule(withParens, P.RULE_select_with_parens)[0];
	return inner ? innerSelect(inner) : undefined;
}

/** A select_no_parens / select_with_parens does not have a selectstmt wrapper, so wrap it. */
function findSelectStmtParent(noParens: ParserRuleContext): ParserRuleContext {
	return noParens; // handled by lowerSelectStmt via the select_no_parens branch when re-dispatched
}

/** select_no_parens: with_clause? select_clause opt_sort_clause? (select_limit | for_locking)? */
function lowerSelectNoParens(node: ParserRuleContext): QueryExpr {
	// with_clause: WITH RECURSIVE? cte_list; cte_list: common_table_expr (COMMA common_table_expr)*
	const withClause = directChildrenOfRule(node, P.RULE_with_clause)[0];
	const cteList = withClause ? directChildrenOfRule(withClause, P.RULE_cte_list)[0] : undefined;
	const ctes = cteList ? directChildrenOfRule(cteList, P.RULE_common_table_expr).map(lowerCte) : [];

	const selectClause = directChildrenOfRule(node, P.RULE_select_clause)[0];
	const body = selectClause ? lowerSelectClause(selectClause) : emptyBody(node);

	const sort = firstShallow(node, P.RULE_sort_clause);
	const orderBy = sort ? extractSortKeys(sort) : undefined;
	if (orderBy && body.kind === "select") for (const o of orderBy) columnsOf(o, body.columns, "orderBy");

	const selectLimit = directChildrenOfRule(node, P.RULE_select_limit)[0];
	const limit = selectLimit ? extractLimit(selectLimit) : undefined;

	return { kind: "query", ctes, body, orderBy, limit, cst: node };
}

/** common_table_expr: name opt_name_list? AS opt_materialized? '(' preparablestmt ')' */
function lowerCte(cte: ParserRuleContext): CteDef {
	const name = firstShallow(cte, P.RULE_name);
	const nameList = directChildrenOfRule(cte, P.RULE_opt_name_list)[0];
	const cols = nameList ? collectOfRule(nameList, P.RULE_name).map((n) => textOf(n)) : [];
	const prep = directChildrenOfRule(cte, P.RULE_preparablestmt)[0];
	const inner = prep ? directChildrenOfRule(prep, P.RULE_selectstmt)[0] : undefined;
	return {
		name: name ? textOf(name) : "",
		columnAliases: cols.length ? cols : undefined,
		body: inner ? lowerSelectStmt(inner) : nonQuery(cte, "non-query-cte"),
		cst: cte,
	};
}

// --- set operations -----------------------------------------------------------
// select_clause     : simple_select_intersect ((UNION|EXCEPT) all_or_distinct? simple_select_intersect)*
// simple_select_intersect : simple_select_pramary (INTERSECT all_or_distinct? simple_select_pramary)*
// Both are left-associative; INTERSECT binds tighter (lower in the grammar) than UNION/EXCEPT.

function lowerSelectClause(clause: ParserRuleContext): QueryBody {
	return foldSetOps(clause, P.RULE_simple_select_intersect, lowerSimpleSelectIntersect, [P.UNION, P.EXCEPT]);
}

function lowerSimpleSelectIntersect(node: ParserRuleContext): QueryBody {
	return foldSetOps(node, P.RULE_simple_select_pramary, lowerSimpleSelectPramary, [P.INTERSECT]);
}

/** Fold `branch (OP branch)*` left into a SetOpExpr chain (or the single branch's body). */
function foldSetOps(
	node: ParserRuleContext,
	branchRule: number,
	lowerBranch: (b: ParserRuleContext) => QueryBody,
	opTokens: number[],
): QueryBody {
	let body: QueryBody | undefined;
	let pendingTok: number | undefined;
	let pendingAll = false;
	let opCst: ParserRuleContext = node;
	for (let i = 0; i < node.getChildCount(); i++) {
		const c = node.getChild(i);
		if (c instanceof TerminalNode) {
			if (opTokens.includes(c.symbol.type)) {
				pendingTok = c.symbol.type;
				opCst = node;
			}
			continue;
		}
		if (!(c instanceof ParserRuleContext)) continue;
		if (c.ruleIndex === P.RULE_all_or_distinct) {
			pendingAll = hasDirectToken(c, P.ALL);
			continue;
		}
		if (c.ruleIndex !== branchRule) continue;
		const branch = lowerBranch(c);
		if (body === undefined) {
			body = branch;
		} else {
			const op = pendingTok === P.INTERSECT ? "intersect" : pendingTok === P.EXCEPT ? "except" : "union";
			body = { kind: "setop", op, all: pendingAll, left: body, right: branch, columns: [], cst: opCst };
			pendingTok = undefined;
			pendingAll = false;
		}
	}
	return body ?? emptyBody(node);
}

// --- the SELECT body ----------------------------------------------------------

/** simple_select_pramary: the SELECT body | values_clause | TABLE relation_expr | select_with_parens */
function lowerSimpleSelectPramary(node: ParserRuleContext): QueryBody {
	const values = directChildrenOfRule(node, P.RULE_values_clause)[0];
	if (values) return lowerValues(values);

	const withParens = directChildrenOfRule(node, P.RULE_select_with_parens)[0];
	if (withParens) {
		const inner = innerSelect(withParens);
		return inner ? lowerSelectStmt(inner).body : emptyBody(node);
	}

	// TABLE relation_expr  ≡  SELECT * FROM relation_expr
	if (hasDirectToken(node, P.TABLE)) {
		const rel = directChildrenOfRule(node, P.RULE_relation_expr)[0];
		const star: Expr = { kind: "star", cst: node };
		return {
			kind: "select",
			projections: [{ isStar: true, expr: star, cst: node }],
			from: rel ? [buildTableFromRelation(rel, undefined, undefined)] : [],
			columns: [],
			aggregated: false,
			cst: node,
		};
	}

	return buildSelect(node);
}

function buildSelect(node: ParserRuleContext): SelectExpr {
	const unsupported: string[] = [];

	const targetList = firstShallow(node, P.RULE_target_list);
	const projections = targetList
		? directChildrenOfRule(targetList, P.RULE_target_el).map(buildProjection)
		: [];

	// SELECT * EXCLUDE (cols) — attach to the star projection.
	const exclude = directChildrenOfRule(node, P.RULE_exclude_clause)[0];
	if (exclude) {
		const cols = collectOfRule(exclude, P.RULE_columnlist)
			.flatMap((l) => collectOfRule(l, P.RULE_columnElem))
			.map((c) => textOf(c));
		for (const p of projections) if (p.expr.kind === "star") p.expr.exclude = cols.length ? cols : undefined;
	}

	const fromClause = directChildrenOfRule(node, P.RULE_from_clause)[0];
	const from: Source[] = [];
	const joinConditions: Expr[] = [];
	if (fromClause) {
		for (const tr of directChildrenOfRule(directChildrenOfRule(fromClause, P.RULE_from_list)[0] ?? fromClause, P.RULE_table_ref)) {
			collectTableRef(tr, from, joinConditions, unsupported);
		}
	}

	const where = directChildrenOfRule(node, P.RULE_where_clause)[0];
	const whereExpr = where ? lowerExpr(firstAExpr(where)) : undefined;

	const groupClause = directChildrenOfRule(node, P.RULE_group_clause)[0];
	const groupBy = groupClause ? extractGroupBy(groupClause) : undefined;
	const groupByAll = groupClause !== undefined && firstShallow(groupClause, P.RULE_group_by_item) === undefined && hasTokenShallow(groupClause, P.ALL);

	const having = directChildrenOfRule(node, P.RULE_having_clause)[0];
	const havingExpr = having ? lowerExpr(firstAExpr(having)) : undefined;

	const qualify = directChildrenOfRule(node, P.RULE_qualify_clause)[0];
	const qualifyExpr = qualify ? lowerExpr(firstAExpr(qualify)) : undefined;

	// CONNECT BY hierarchies (start_with_clause) aren't modelled — flagged, not dropped.
	if (directChildrenOfRule(node, P.RULE_start_with_clause).length) unsupported.push("connect-by");

	const aggregated =
		groupByAll ||
		(groupBy !== undefined && groupBy.length > 0) ||
		projections.some((p) => hasAggregate(p.expr)) ||
		(havingExpr !== undefined && hasAggregate(havingExpr));

	const columns: ColumnRef[] = [];
	for (const p of projections) columnsOf(p.expr, columns, "projection");
	if (whereExpr) columnsOf(whereExpr, columns, "where");
	for (const j of joinConditions) columnsOf(j, columns, "join");
	for (const g of groupBy ?? []) columnsOf(g, columns, "groupBy");
	if (havingExpr) columnsOf(havingExpr, columns, "having");
	if (qualifyExpr) columnsOf(qualifyExpr, columns, "qualify");

	const subqueries = extractExpressionSubqueries(node, fromSubqueryNodes(from));

	return {
		kind: "select",
		projections,
		from,
		columns,
		where: whereExpr,
		joinConditions: joinConditions.length ? joinConditions : undefined,
		groupBy,
		having: havingExpr,
		qualify: qualifyExpr,
		aggregated,
		subqueries: subqueries.length ? subqueries : undefined,
		unsupported: unsupported.length ? unsupported : undefined,
		cst: node,
	};
}

/** values_clause: VALUES '(' expr_list ')' (COMMA '(' expr_list ')')* — lower to a modelled
 *  select with literal/expr projections named column1…columnN (Postgres/Redshift default names). */
function lowerValues(values: ParserRuleContext): SelectExpr {
	const firstList = directChildrenOfRule(values, P.RULE_expr_list)[0];
	const exprs = firstList ? directChildrenOfRule(firstList, P.RULE_a_expr) : [];
	const projections: Projection[] = exprs.map((e, i) => ({
		name: `column${i + 1}`,
		isStar: false,
		expr: lowerExpr(e),
		cst: e,
	}));
	const columns: ColumnRef[] = [];
	for (const p of projections) columnsOf(p.expr, columns, "projection");
	return { kind: "select", projections, from: [], columns, aggregated: false, cst: values };
}

// --- sources / joins ----------------------------------------------------------

/** Flatten a table_ref (its primary + trailing joined_table*) into Sources + ON conditions. */
function collectTableRef(tr: ParserRuleContext, from: Source[], joins: Expr[], unsupported: string[]): void {
	// PIVOT / UNPIVOT reshape the source's output columns; the IR doesn't model that for Redshift
	// yet, so flag it (visible gap) rather than silently keeping only the un-pivoted relation.
	if (directChildrenOfRule(tr, P.RULE_pivot_clause).length) unsupported.push("pivot");
	if (directChildrenOfRule(tr, P.RULE_unpivot_clause).length) unsupported.push("unpivot");
	// PartiQL SUPER object unpivoting (UNPIVOT expr AS val AT attr — a FROM item, not the SQL UNPIVOT
	// suffix) reshapes a SUPER object into (value, attribute) rows; the IR doesn't model it yet, so
	// flag it rather than leaving only an opaque source (docs … query-super.html#unpivoting).
	if (hasDirectToken(tr, P.UNPIVOT) && directChildrenOfRule(tr, P.RULE_a_expr).length) unsupported.push("unpivot");
	from.push(buildPrimarySource(tr, unsupported));
	for (const jt of directChildrenOfRule(tr, P.RULE_joined_table)) {
		const inner = directChildrenOfRule(jt, P.RULE_table_ref)[0];
		if (inner) collectTableRef(inner, from, joins, unsupported);
		const qual = directChildrenOfRule(jt, P.RULE_join_qual)[0];
		const on = qual ? directChildrenOfRule(qual, P.RULE_a_expr)[0] : undefined;
		if (on) joins.push(lowerExpr(on));
	}
}

/** The primary of a table_ref: relation_expr | select_with_parens | func_table | LATERAL … | (join). */
function buildPrimarySource(tr: ParserRuleContext, unsupported: string[]): Source {
	const aliasNode = directChildrenOfRule(tr, P.RULE_opt_alias_clause)[0];
	const alias = aliasNode ? aliasName(aliasNode) : undefined;
	const aliasCst = aliasNode ? firstShallow(aliasNode, P.RULE_table_alias) : undefined;
	const columnAliases = aliasNode ? aliasColumnList(aliasNode) : undefined;

	const rel = directChildrenOfRule(tr, P.RULE_relation_expr)[0];
	if (rel) return buildTableFromRelation(rel, alias, aliasCst, columnAliases);

	const sub = directChildrenOfRule(tr, P.RULE_select_with_parens)[0];
	if (sub) {
		const inner = innerSelect(sub);
		return {
			kind: "subquery",
			query: inner ? lowerSelectStmt(inner) : emptyQuery(sub),
			alias,
			aliasCst,
			columnAliases,
			cst: tr,
		};
	}

	// func_table: a set-returning function in FROM — opaque columns (need the signature).
	const funcTable = directChildrenOfRule(tr, P.RULE_func_table)[0];
	if (funcTable) {
		const fname = firstShallow(funcTable, P.RULE_func_name);
		const funcAlias = directChildrenOfRule(tr, P.RULE_func_alias_clause)[0];
		return {
			kind: "table",
			name: [fname ? lastName(fname) : funcTable.getText()],
			alias: alias ?? (funcAlias ? funcAliasName(funcAlias) : undefined),
			aliasCst,
			cst: tr,
		};
	}

	// LATERAL (…) and a parenthesized join group: descend for the inner sources is handled by the
	// caller for joins; here we record an opaque source so a valid parse never throws.
	const nestedTr = directChildrenOfRule(tr, P.RULE_table_ref)[0];
	if (nestedTr) {
		// '(' table_ref join… ')' — flatten the inner join group into this source list.
		const innerFrom: Source[] = [];
		const innerJoins: Expr[] = [];
		collectTableRef(nestedTr, innerFrom, innerJoins, unsupported);
		// The inner ON conditions belong to the enclosing select; collect via a side channel.
		nestedJoinConditions.push(...innerJoins);
		if (innerFrom.length) return innerFrom[0];
	}

	return { kind: "table", name: [textOrEmpty(tr)], alias, aliasCst, columnAliases, cst: tr };
}

// Parenthesized-join ON conditions surfaced from a nested table_ref, drained by buildSelect's caller.
const nestedJoinConditions: Expr[] = [];

function buildTableFromRelation(
	rel: ParserRuleContext,
	alias: string | undefined,
	aliasCst: ParserRuleContext | undefined,
	columnAliases?: string[],
): Source {
	const qn = directChildrenOfRule(rel, P.RULE_qualified_name)[0];
	const parts = qn ? nameParts(qn) : [textOrEmpty(rel)];
	// Redshift catalog path database@namespace[/cluster].schema.table: the @namespace, optional
	// /cluster, and trailing .schema.table sit beside the qualified_name in relation_expr. Fold them
	// in so the source name isn't silently truncated to just the database
	// (docs.aws.amazon.com/redshift/latest/dg/iceberg-integration-querying.html).
	if (hasDirectToken(rel, P.AT_SIGN)) {
		for (const cid of directChildrenOfRule(rel, P.RULE_colid)) parts.push(textOf(cid));
		const ind = directChildrenOfRule(rel, P.RULE_indirection)[0];
		if (ind) {
			for (const el of directChildrenOfRule(ind, P.RULE_indirection_el)) {
				if (hasDirectToken(el, P.DOT) && !hasDirectToken(el, P.STAR)) {
					const attr = firstShallow(el, P.RULE_attr_name);
					parts.push(attr ? textOf(attr) : el.getText().replace(/^\./, ""));
				}
			}
		}
	}
	return { kind: "table", name: parts, alias, aliasCst, columnAliases, cst: rel };
}

function aliasName(aliasClause: ParserRuleContext): string | undefined {
	const ta = firstShallow(aliasClause, P.RULE_table_alias);
	return ta ? textOf(ta) : undefined;
}

function aliasColumnList(aliasClause: ParserRuleContext): string[] | undefined {
	const nl = firstShallow(aliasClause, P.RULE_name_list);
	if (!nl) return undefined;
	const cols = collectOfRule(nl, P.RULE_name).map((n) => textOf(n));
	return cols.length ? cols : undefined;
}

function funcAliasName(funcAlias: ParserRuleContext): string | undefined {
	const ac = directChildrenOfRule(funcAlias, P.RULE_alias_clause)[0];
	if (ac) {
		const cid = firstShallow(ac, P.RULE_colid);
		return cid ? textOf(cid) : undefined;
	}
	const cid = firstShallow(funcAlias, P.RULE_colid);
	return cid ? textOf(cid) : undefined;
}

// --- projections --------------------------------------------------------------

/** target_el: a_expr target_alias? #target_label | STAR #target_star */
function buildProjection(elem: ParserRuleContext): Projection {
	// target_star — a bare STAR with no a_expr child.
	const a = directChildrenOfRule(elem, P.RULE_a_expr)[0];
	if (!a) {
		return { isStar: true, expr: { kind: "star", cst: elem }, cst: elem };
	}
	const expr = lowerExpr(a);
	const aliasNode = directChildrenOfRule(elem, P.RULE_target_alias)[0];
	const alias = aliasNode ? targetAliasText(aliasNode) : undefined;

	if (expr.kind === "star") {
		return { isStar: true, expr, name: undefined, cst: elem };
	}
	const name = alias ?? (expr.kind === "column" ? expr.parts[expr.parts.length - 1] : undefined);
	return { name, isStar: false, expr, cst: elem };
}

/** target_alias: AS collabel | identifier */
function targetAliasText(node: ParserRuleContext): string {
	const cl = firstShallow(node, P.RULE_collabel) ?? firstShallow(node, P.RULE_identifier);
	return cl ? textOf(cl) : node.getText();
}

// --- GROUP BY / ORDER BY / LIMIT ----------------------------------------------

/** group_clause: GROUP BY group_by_list. A group_by_item is a_expr | () | CUBE/ROLLUP/GROUPING SETS;
 *  collect the leaf a_expr keys (the wrappers' inner expr_list keys included). */
function extractGroupBy(clause: ParserRuleContext): Expr[] | undefined {
	const items = collectOfRule(clause, P.RULE_group_by_item);
	const keys: Expr[] = [];
	for (const item of items) {
		// A bare a_expr key is a direct child; CUBE/ROLLUP/GROUPING SETS hold their keys in an expr_list.
		const direct = directChildrenOfRule(item, P.RULE_a_expr)[0];
		if (direct) {
			keys.push(lowerExpr(direct));
			continue;
		}
		for (const list of collectOfRule(item, P.RULE_expr_list)) {
			for (const e of directChildrenOfRule(list, P.RULE_a_expr)) keys.push(lowerExpr(e));
		}
	}
	return keys.length ? keys : undefined;
}

/** sort_clause: ORDER BY sortby_list; sortby: a_expr (USING … | ASC/DESC)? NULLS …? */
function extractSortKeys(sort: ParserRuleContext): Expr[] | undefined {
	const keys = collectOfRule(sort, P.RULE_sortby).map((s) => {
		const a = directChildrenOfRule(s, P.RULE_a_expr)[0];
		return a ? lowerExpr(a) : otherExpr(s);
	});
	return keys.length ? keys : undefined;
}

/** select_limit: limit_clause offset_clause? | offset_clause limit_clause? */
function extractLimit(node: ParserRuleContext): LimitInfo | undefined {
	const info: LimitInfo = {};
	let any = false;
	const limit = directChildrenOfRule(node, P.RULE_limit_clause)[0];
	if (limit) {
		const v = directChildrenOfRule(limit, P.RULE_select_limit_value)[0];
		const a = v ? directChildrenOfRule(v, P.RULE_a_expr)[0] : undefined;
		if (a) {
			info.top = lowerExpr(a);
			any = true;
		} else if (v && hasDirectToken(v, P.ALL)) {
			any = true; // LIMIT ALL — no row cap; recorded as a present-but-unbounded clause
		}
	}
	const offset = directChildrenOfRule(node, P.RULE_offset_clause)[0];
	if (offset) {
		const ov = directChildrenOfRule(offset, P.RULE_select_offset_value)[0];
		const a = ov ? directChildrenOfRule(ov, P.RULE_a_expr)[0] : undefined;
		if (a) {
			info.offset = lowerExpr(a);
			any = true;
		}
	}
	return any ? info : undefined;
}

// --- expressions: the a_expr precedence cascade -------------------------------

function lowerExpr(node: ParserRuleContext | undefined): Expr {
	if (!node) return { kind: "literal", text: "", cst: emptyCst };
	switch (node.ruleIndex) {
		case P.RULE_a_expr:
		case P.RULE_a_expr_qual:
			return passthrough(node);
		case P.RULE_a_expr_lessless:
			return leftChain(node, P.RULE_a_expr_or);
		case P.RULE_a_expr_or:
			return leftChain(node, P.RULE_a_expr_and);
		case P.RULE_a_expr_and:
			return leftChain(node, P.RULE_a_expr_between);
		case P.RULE_a_expr_between:
			return lowerBetween(node);
		case P.RULE_a_expr_in:
			return lowerIn(node);
		case P.RULE_a_expr_unary_not:
			return lowerUnaryNot(node);
		case P.RULE_a_expr_isnull:
			return lowerIsNull(node);
		case P.RULE_a_expr_is_not:
			return lowerIsNot(node);
		case P.RULE_a_expr_compare:
			return lowerCompare(node);
		case P.RULE_a_expr_prior_or_level:
			return passthroughTo(node, P.RULE_a_expr_like); // PRIOR/LEVEL pseudo-ops: operand carries the refs
		case P.RULE_a_expr_like:
			return lowerLike(node);
		case P.RULE_a_expr_qual_op:
			return leftChain(node, P.RULE_a_expr_unary_qualop);
		case P.RULE_a_expr_unary_qualop:
			return lowerUnaryQualOp(node);
		case P.RULE_a_expr_add:
			return leftChain(node, P.RULE_a_expr_mul);
		case P.RULE_a_expr_mul:
			return leftChain(node, P.RULE_a_expr_caret);
		case P.RULE_a_expr_caret:
			return lowerCaret(node);
		case P.RULE_a_expr_unary_sign:
			return lowerUnarySign(node);
		case P.RULE_a_expr_at_time_zone:
			return lowerAtTimeZone(node);
		case P.RULE_a_expr_collate:
			return passthroughTo(node, P.RULE_a_expr_typecast); // COLLATE doesn't change value/refs
		case P.RULE_a_expr_typecast:
			return lowerTypecast(node);
		case P.RULE_c_expr:
			return lowerCExpr(node);
		case P.RULE_b_expr:
			return lowerBExpr(node);
		default:
			return passthrough(node);
	}
}

/** Recurse into the single rule child (passthrough level). */
function passthrough(node: ParserRuleContext): Expr {
	const child = firstRuleChild(node);
	return child ? lowerExpr(child) : otherExpr(node);
}

function passthroughTo(node: ParserRuleContext, operandRule: number): Expr {
	const child = directChildrenOfRule(node, operandRule)[0];
	return child ? lowerExpr(child) : passthrough(node);
}

/** `operand (OP operand)*` — left-fold into binary nodes. OP is any non-operand child
 *  (a terminal operator token, or a qual_op rule); AND/OR normalize to lowercase. */
function leftChain(node: ParserRuleContext, operandRule: number): Expr {
	let result: Expr | undefined;
	let pendingOp = "";
	for (let i = 0; i < node.getChildCount(); i++) {
		const c = node.getChild(i);
		if (c instanceof ParserRuleContext && c.ruleIndex === operandRule) {
			const e = lowerExpr(c);
			if (result === undefined) result = e;
			else {
				result = { kind: "binary", op: pendingOp, left: result, right: e, cst: node };
				pendingOp = "";
			}
		} else if (c instanceof TerminalNode) {
			pendingOp = opText(c.symbol.type, c.getText());
		} else if (c instanceof ParserRuleContext) {
			pendingOp = c.getText(); // qual_op operator
		}
	}
	return result ?? otherExpr(node);
}

function opText(type: number, text: string): string {
	if (type === P.AND) return "and";
	if (type === P.OR) return "or";
	return text;
}

/** a_expr_between: a_expr_in (NOT? BETWEEN SYMMETRIC? a_expr_in AND a_expr_in)? */
function lowerBetween(node: ParserRuleContext): Expr {
	const operands = directChildrenOfRule(node, P.RULE_a_expr_in);
	if (!hasDirectToken(node, P.BETWEEN) || operands.length < 3) return passthrough(node);
	return {
		kind: "predicate",
		op: "between",
		negated: hasDirectToken(node, P.NOT),
		operand: lowerExpr(operands[0]),
		args: [lowerExpr(operands[1]), lowerExpr(operands[2])],
		cst: node,
	};
}

/** a_expr_in: a_expr_unary_not (NOT? IN_P in_expr)? — in_expr: select_with_parens | '(' expr_list ')' */
function lowerIn(node: ParserRuleContext): Expr {
	const left = directChildrenOfRule(node, P.RULE_a_expr_unary_not)[0];
	if (!hasDirectToken(node, P.IN_P)) return passthrough(node);
	const inExpr = directChildrenOfRule(node, P.RULE_in_expr)[0];
	const sub = inExpr ? directChildrenOfRule(inExpr, P.RULE_select_with_parens)[0] : undefined;
	let args: Expr[];
	if (sub) {
		const inner = innerSelect(sub);
		args = [{ kind: "subquery", query: inner ? lowerSelectStmt(inner) : emptyQuery(sub), cst: sub }];
	} else {
		const list = inExpr ? directChildrenOfRule(inExpr, P.RULE_expr_list)[0] : undefined;
		args = list ? directChildrenOfRule(list, P.RULE_a_expr).map(lowerExpr) : [];
	}
	return {
		kind: "predicate",
		op: "in",
		negated: hasDirectToken(node, P.NOT),
		operand: left ? lowerExpr(left) : otherExpr(node),
		args,
		cst: node,
	};
}

/** a_expr_unary_not: NOT? a_expr_isnull */
function lowerUnaryNot(node: ParserRuleContext): Expr {
	const operand = directChildrenOfRule(node, P.RULE_a_expr_isnull)[0];
	const inner = operand ? lowerExpr(operand) : otherExpr(node);
	return hasDirectToken(node, P.NOT) ? { kind: "unary", op: "not", operand: inner, cst: node } : inner;
}

/** a_expr_isnull: a_expr_is_not (ISNULL | NOTNULL)? */
function lowerIsNull(node: ParserRuleContext): Expr {
	const operand = directChildrenOfRule(node, P.RULE_a_expr_is_not)[0];
	const inner = operand ? lowerExpr(operand) : otherExpr(node);
	if (hasDirectToken(node, P.ISNULL)) return { kind: "predicate", op: "null", negated: false, operand: inner, args: [], cst: node };
	if (hasDirectToken(node, P.NOTNULL)) return { kind: "predicate", op: "null", negated: true, operand: inner, args: [], cst: node };
	return inner;
}

/** a_expr_is_not: a_expr_compare (IS NOT? (NULL|TRUE|FALSE|UNKNOWN | DISTINCT FROM a_expr | …))? */
function lowerIsNot(node: ParserRuleContext): Expr {
	const left = directChildrenOfRule(node, P.RULE_a_expr_compare)[0];
	const inner = left ? lowerExpr(left) : otherExpr(node);
	if (!hasDirectToken(node, P.IS)) return inner;
	const negated = hasDirectToken(node, P.NOT);
	if (hasDirectToken(node, P.DISTINCT)) {
		const rhs = directChildrenOfRule(node, P.RULE_a_expr)[0];
		return {
			kind: "predicate",
			op: "distinct from",
			negated,
			operand: inner,
			args: rhs ? [lowerExpr(rhs)] : [],
			cst: node,
		};
	}
	const op = hasDirectToken(node, P.TRUE_P) ? "true" : hasDirectToken(node, P.FALSE_P) ? "false" : hasDirectToken(node, P.UNKNOWN) ? "unknown" : "null";
	return { kind: "predicate", op, negated, operand: inner, args: [], cst: node };
}

/** a_expr_compare: a_expr_prior_or_level ((cmp) a_expr_prior_or_level | subquery_Op sub_type (…))? */
function lowerCompare(node: ParserRuleContext): Expr {
	const operands = directChildrenOfRule(node, P.RULE_a_expr_prior_or_level);
	const cmp = directTokenType(node, [P.LT, P.GT, P.EQUAL, P.LESS_EQUALS, P.GREATER_EQUALS, P.NOT_EQUALS]);
	if (cmp !== undefined && operands.length === 2) {
		return {
			kind: "binary",
			op: tokenText(node, cmp) ?? "",
			left: lowerExpr(operands[0]),
			right: lowerExpr(operands[1]),
			cst: node,
		};
	}
	// expr subquery_Op (ANY|SOME|ALL) (subquery | (a_expr)) — quantified comparison.
	if (directChildrenOfRule(node, P.RULE_subquery_Op).length) {
		const left = operands[0] ? lowerExpr(operands[0]) : otherExpr(node);
		const sub = directChildrenOfRule(node, P.RULE_select_with_parens)[0];
		if (sub) {
			const inner = innerSelect(sub);
			return {
				kind: "binary",
				op: textOrEmpty(directChildrenOfRule(node, P.RULE_subquery_Op)[0]),
				left,
				right: { kind: "subquery", query: inner ? lowerSelectStmt(inner) : emptyQuery(sub), cst: sub },
				cst: node,
			};
		}
		const a = directChildrenOfRule(node, P.RULE_a_expr)[0];
		return { kind: "binary", op: textOrEmpty(directChildrenOfRule(node, P.RULE_subquery_Op)[0]), left, right: a ? lowerExpr(a) : otherExpr(node), cst: node };
	}
	return passthrough(node);
}

/** a_expr_like: a_expr_qual_op (NOT? (LIKE | ILIKE | SIMILAR TO) a_expr_qual_op opt_escape?)? */
function lowerLike(node: ParserRuleContext): Expr {
	const operands = directChildrenOfRule(node, P.RULE_a_expr_qual_op);
	const tok = directTokenType(node, [P.LIKE, P.ILIKE, P.SIMILAR]);
	if (tok === undefined || operands.length < 2) return operands[0] ? lowerExpr(operands[0]) : passthrough(node);
	const op = tok === P.ILIKE ? "ilike" : tok === P.SIMILAR ? "similar" : "like";
	return {
		kind: "predicate",
		op,
		negated: hasDirectToken(node, P.NOT),
		operand: lowerExpr(operands[0]),
		args: [lowerExpr(operands[1])],
		cst: node,
	};
}

/** a_expr_unary_qualop: qual_op? a_expr_add */
function lowerUnaryQualOp(node: ParserRuleContext): Expr {
	const operand = directChildrenOfRule(node, P.RULE_a_expr_add)[0];
	const inner = operand ? lowerExpr(operand) : otherExpr(node);
	const qualOp = directChildrenOfRule(node, P.RULE_qual_op)[0];
	return qualOp ? { kind: "unary", op: qualOp.getText(), operand: inner, cst: node } : inner;
}

/** a_expr_caret: a_expr_unary_sign (CARET a_expr)? */
function lowerCaret(node: ParserRuleContext): Expr {
	const left = directChildrenOfRule(node, P.RULE_a_expr_unary_sign)[0];
	const inner = left ? lowerExpr(left) : otherExpr(node);
	if (!hasDirectToken(node, P.CARET)) return inner;
	const right = directChildrenOfRule(node, P.RULE_a_expr)[0];
	return { kind: "binary", op: "^", left: inner, right: right ? lowerExpr(right) : otherExpr(node), cst: node };
}

/** a_expr_unary_sign: (MINUS | PLUS)? a_expr_at_time_zone */
function lowerUnarySign(node: ParserRuleContext): Expr {
	const operand = directChildrenOfRule(node, P.RULE_a_expr_at_time_zone)[0];
	const inner = operand ? lowerExpr(operand) : otherExpr(node);
	const sign = directTokenType(node, [P.PLUS, P.MINUS]);
	return sign !== undefined ? { kind: "unary", op: sign === P.MINUS ? "-" : "+", operand: inner, cst: node } : inner;
}

/** a_expr_at_time_zone: a_expr_collate (AT TIME ZONE a_expr)? — modelled as a 2-arg function. */
function lowerAtTimeZone(node: ParserRuleContext): Expr {
	const left = directChildrenOfRule(node, P.RULE_a_expr_collate)[0];
	const inner = left ? lowerExpr(left) : otherExpr(node);
	if (!hasDirectToken(node, P.AT)) return inner;
	const zone = directChildrenOfRule(node, P.RULE_a_expr)[0];
	return {
		kind: "function",
		name: "at_time_zone",
		args: [inner, zone ? lowerExpr(zone) : otherExpr(node)],
		aggregate: false,
		distinct: false,
		cst: node,
	};
}

/** a_expr_typecast: c_expr (TYPECAST typename)* — fold `:: type` casts left. */
function lowerTypecast(node: ParserRuleContext): Expr {
	const cexpr = directChildrenOfRule(node, P.RULE_c_expr)[0];
	let expr = cexpr ? lowerExpr(cexpr) : otherExpr(node);
	if (!hasDirectToken(node, P.TYPECAST)) return expr;
	for (const tn of directChildrenOfRule(node, P.RULE_typename)) {
		expr = { kind: "cast", expr, typeText: tn.getText(), cst: node };
	}
	return expr;
}

/** b_expr is the restricted expression grammar (used in a few positions); left-recursive. */
function lowerBExpr(node: ParserRuleContext): Expr {
	const cexpr = directChildrenOfRule(node, P.RULE_c_expr)[0];
	if (cexpr) return lowerExpr(cexpr);
	const sub = directChildrenOfRule(node, P.RULE_b_expr);
	if (sub.length === 2) {
		const op = directTokenType(node, [P.PLUS, P.MINUS, P.STAR, P.SLASH, P.PERCENT, P.CARET, P.LT, P.GT, P.EQUAL, P.LESS_EQUALS, P.GREATER_EQUALS, P.NOT_EQUALS]);
		return { kind: "binary", op: op !== undefined ? (tokenText(node, op) ?? "") : "", left: lowerExpr(sub[0]), right: lowerExpr(sub[1]), cst: node };
	}
	if (sub.length === 1) return lowerExpr(sub[0]);
	return otherExpr(node);
}

// --- c_expr: the expression leaves --------------------------------------------

function lowerCExpr(node: ParserRuleContext): Expr {
	// EXISTS ( select )
	if (hasDirectToken(node, P.EXISTS)) {
		const sw = directChildrenOfRule(node, P.RULE_select_with_parens)[0];
		const inner = sw ? innerSelect(sw) : undefined;
		return sw ? { kind: "exists", query: inner ? lowerSelectStmt(inner) : emptyQuery(sw), cst: node } : otherExpr(node);
	}
	// columnref — a column / qualified column / qualified star / subscripted column
	const colref = directChildrenOfRule(node, P.RULE_columnref)[0];
	if (colref) return lowerColumnref(colref);
	// case
	const caseExpr = directChildrenOfRule(node, P.RULE_case_expr)[0];
	if (caseExpr) return lowerCase(caseExpr);
	// func_expr
	const funcExpr = directChildrenOfRule(node, P.RULE_func_expr)[0];
	if (funcExpr) return lowerFuncExpr(funcExpr);
	// literal
	const constant = directChildrenOfRule(node, P.RULE_aexprconst)[0];
	if (constant) return { kind: "literal", text: constant.getText(), cst: constant };
	// ( a_expr ) opt_indirection — parenthesized, with optional subscript/field access
	const inParen = directChildrenOfRule(node, P.RULE_a_expr)[0];
	if (inParen) {
		const base = lowerExpr(inParen);
		const ind = directChildrenOfRule(node, P.RULE_opt_indirection)[0];
		return ind ? applyIndirection(base, ind, node) : base;
	}
	// scalar subquery: select_with_parens indirection?
	const sw = directChildrenOfRule(node, P.RULE_select_with_parens)[0];
	if (sw) {
		const inner = innerSelect(sw);
		return { kind: "subquery", query: inner ? lowerSelectStmt(inner) : emptyQuery(sw), cst: node };
	}
	// ARRAY ( select | [elems] )
	if (hasDirectToken(node, P.ARRAY)) {
		const swInner = directChildrenOfRule(node, P.RULE_select_with_parens)[0];
		if (swInner) {
			const inner = innerSelect(swInner);
			return { kind: "subquery", query: inner ? lowerSelectStmt(inner) : emptyQuery(swInner), cst: node };
		}
		const arr = directChildrenOfRule(node, P.RULE_array_expr)[0];
		const elems = arr ? collectOfRule(arr, P.RULE_a_expr).map(lowerExpr) : [];
		return { kind: "function", name: "array", args: elems, aggregate: false, distinct: false, cst: node };
	}
	// GROUPING ( expr_list )
	if (hasDirectToken(node, P.GROUPING)) {
		const list = directChildrenOfRule(node, P.RULE_expr_list)[0];
		const args = list ? directChildrenOfRule(list, P.RULE_a_expr).map(lowerExpr) : [];
		return { kind: "function", name: "grouping", args, aggregate: false, distinct: false, cst: node };
	}
	// PARAM ($1) / plsqlvariablename — a bind parameter / variable; not a column reference.
	if (hasDirectToken(node, P.PARAM)) return { kind: "literal", text: node.getText(), cst: node };
	const plsqlvar = directChildrenOfRule(node, P.RULE_plsqlvariablename)[0];
	if (plsqlvar) return { kind: "column", parts: [plsqlvar.getText()], cst: node };
	// row constructors / OVERLAPS — not modelled structurally.
	const exprs = collectOfRule(node, P.RULE_a_expr).map(lowerExpr);
	if (exprs.length) return { kind: "function", name: "row", args: exprs, aggregate: false, distinct: false, cst: node };
	return otherExpr(node);
}

/** columnref: colid indirection?  — colid is the head; indirection adds .attr / .* / [idx]. */
function lowerColumnref(node: ParserRuleContext): Expr {
	const colid = directChildrenOfRule(node, P.RULE_colid)[0];
	const head = colid ? textOf(colid) : node.getText();
	const ind = directChildrenOfRule(node, P.RULE_indirection)[0];
	const base: Expr = { kind: "column", parts: [head], cst: node };
	return ind ? applyIndirection(base, ind, node) : base;
}

/** Apply indirection_el+ to a base expr: `.attr` extends a column path, `.*` makes a qualified
 *  star, `[idx]` / `[lo:hi]` makes a subscript. Mixed chains compose left-to-right. */
function applyIndirection(base: Expr, indirection: ParserRuleContext, cst: ParserRuleContext): Expr {
	let expr = base;
	for (const el of directChildrenOfRule(indirection, P.RULE_indirection_el)) {
		if (hasDirectToken(el, P.DOT)) {
			if (hasDirectToken(el, P.STAR)) {
				const qualifier = expr.kind === "column" ? expr.parts : undefined;
				expr = { kind: "star", qualifier, cst };
			} else {
				const attr = firstShallow(el, P.RULE_attr_name);
				const part = attr ? textOf(attr) : el.getText().replace(/^\./, "");
				expr = expr.kind === "column" ? { kind: "column", parts: [...expr.parts, part], cst } : { kind: "subscript", base: expr, index: { kind: "literal", text: part, cst: el }, cst };
			}
		} else {
			// '[' a_expr ']' or '[' lo? : hi? ']' subscript
			const idxNode = directChildrenOfRule(el, P.RULE_a_expr)[0];
			const index: Expr = idxNode ? lowerExpr(idxNode) : { kind: "literal", text: el.getText(), cst: el };
			expr = { kind: "subscript", base: expr, index, cst };
		}
	}
	return expr;
}

/** case_expr: CASE case_arg? when_clause+ (ELSE a_expr)? END */
function lowerCase(node: ParserRuleContext): Expr {
	const arg = directChildrenOfRule(node, P.RULE_case_arg)[0];
	const subject = arg ? lowerExpr(directChildrenOfRule(arg, P.RULE_a_expr)[0]) : undefined;
	const whens = collectOfRule(node, P.RULE_when_clause).map((w) => {
		const es = directChildrenOfRule(w, P.RULE_a_expr);
		const whenVal = es[0] ? lowerExpr(es[0]) : otherExpr(w);
		const then = es[1] ? lowerExpr(es[1]) : otherExpr(w);
		// Simple CASE <subject> WHEN v — desugar to `subject = v` so column/type passes see both.
		const when: Expr = subject ? { kind: "binary", op: "=", left: subject, right: whenVal, cst: w } : whenVal;
		return { when, then };
	});
	const def = directChildrenOfRule(node, P.RULE_case_default)[0];
	const elseExpr = def ? lowerExpr(directChildrenOfRule(def, P.RULE_a_expr)[0]) : undefined;
	return { kind: "case", whens, elseExpr, cst: node };
}

/** func_expr: func_application within_group? filter? over? | func_expr_common_subexpr */
function lowerFuncExpr(node: ParserRuleContext): Expr {
	const common = directChildrenOfRule(node, P.RULE_func_expr_common_subexpr)[0];
	if (common) return lowerCommonFunc(common);

	const app = directChildrenOfRule(node, P.RULE_func_application)[0];
	if (!app) return otherExpr(node);
	const fname = firstShallow(app, P.RULE_func_name);
	const name = (fname ? lastName(fname) : leftmostToken(app) ?? "").toLowerCase();
	const args = funcArgs(app);
	// WITHIN GROUP (ORDER BY …) keys feed the aggregate — include as args.
	const within = directChildrenOfRule(node, P.RULE_within_group_clause)[0];
	if (within) {
		const sort = firstShallow(within, P.RULE_sort_clause);
		if (sort) for (const k of extractSortKeys(sort) ?? []) args.push(k);
	}
	const over = directChildrenOfRule(node, P.RULE_over_clause)[0];
	const window = over ? lowerOver(over) : undefined;
	return {
		kind: "function",
		name,
		args,
		aggregate: AGGREGATES.has(name) && !window,
		distinct: hasTokenShallow(app, P.DISTINCT),
		window,
		cst: node,
	};
}

/** func_application: func_name '(' (func_arg_list … | VARIADIC … | (ALL|DISTINCT) func_arg_list … | STAR | ) ')' */
function funcArgs(app: ParserRuleContext): Expr[] {
	const list = directChildrenOfRule(app, P.RULE_func_arg_list)[0];
	if (!list) return []; // STAR (count(*)) or empty arg list
	return directChildrenOfRule(list, P.RULE_func_arg_expr).map((fa) => {
		// func_arg_expr: a_expr | param_name (:=|=>) a_expr  — take the a_expr value.
		const a = directChildrenOfRule(fa, P.RULE_a_expr)[0];
		return a ? lowerExpr(a) : otherExpr(fa);
	});
}

/** func_expr_common_subexpr: CAST/TRY_CAST/EXTRACT/SUBSTRING/COALESCE/NULLIF/TRIM/… */
function lowerCommonFunc(node: ParserRuleContext): Expr {
	// CAST / TRY_CAST / TREAT ( a_expr AS typename )
	if (hasDirectToken(node, P.CAST) || hasDirectToken(node, P.TRY_CAST) || hasDirectToken(node, P.TREAT)) {
		const a = directChildrenOfRule(node, P.RULE_a_expr)[0];
		const tn = directChildrenOfRule(node, P.RULE_typename)[0];
		return { kind: "cast", expr: a ? lowerExpr(a) : otherExpr(node), typeText: tn ? tn.getText() : "", cst: node };
	}
	const name = (leftmostToken(node) ?? "").toLowerCase();
	// Collect every a_expr / b_expr / expr_list argument the form carries (EXTRACT, SUBSTRING,
	// COALESCE, NULLIF, TRIM, POSITION, OVERLAY, GREATEST, LEAST, NORMALIZE, XML*, CURRENT_*).
	const args: Expr[] = [];
	for (const list of directChildrenOfRule(node, P.RULE_expr_list)) {
		for (const a of directChildrenOfRule(list, P.RULE_a_expr)) args.push(lowerExpr(a));
	}
	for (const a of directChildrenOfRule(node, P.RULE_a_expr)) args.push(lowerExpr(a));
	for (const sub of [P.RULE_extract_list, P.RULE_substr_list, P.RULE_overlay_list, P.RULE_trim_list, P.RULE_position_list]) {
		for (const wrap of directChildrenOfRule(node, sub)) {
			for (const a of collectOfRule(wrap, P.RULE_a_expr)) args.push(lowerExpr(a));
			for (const b of collectOfRule(wrap, P.RULE_b_expr)) args.push(lowerExpr(b));
		}
	}
	return { kind: "function", name, args, aggregate: false, distinct: false, cst: node };
}

/** over_clause: OVER (window_specification | colid). */
function lowerOver(over: ParserRuleContext): WindowSpec {
	const spec = directChildrenOfRule(over, P.RULE_window_specification)[0];
	if (!spec) return { partitionBy: [], orderBy: [], cst: over }; // OVER namedWindow
	const part = directChildrenOfRule(spec, P.RULE_opt_partition_clause)[0];
	const partitionBy = part
		? (directChildrenOfRule(part, P.RULE_expr_list)[0]
			? directChildrenOfRule(directChildrenOfRule(part, P.RULE_expr_list)[0], P.RULE_a_expr).map(lowerExpr)
			: [])
		: [];
	const sort = directChildrenOfRule(spec, P.RULE_opt_sort_clause)[0] ?? firstShallow(spec, P.RULE_sort_clause);
	const orderBy = sort ? (extractSortKeys(firstShallow(sort, P.RULE_sort_clause) ?? sort) ?? []) : [];
	return { partitionBy, orderBy, cst: over };
}

// --- expression subqueries (scalar / IN / EXISTS) -----------------------------

function fromSubqueryNodes(from: Source[]): Set<ParserRuleContext> {
	const set = new Set<ParserRuleContext>();
	for (const s of from) {
		if (s.kind === "subquery") {
			const sw = firstShallow(s.cst, P.RULE_select_with_parens);
			if (sw) set.add(sw);
		}
	}
	return set;
}

function extractExpressionSubqueries(node: ParserRuleContext, fromQueries: Set<ParserRuleContext>): QueryExpr[] {
	const out: QueryExpr[] = [];
	const walk = (n: ParseTree): void => {
		for (let i = 0; i < n.getChildCount(); i++) {
			const child = n.getChild(i);
			if (!(child instanceof ParserRuleContext)) continue;
			if (child.ruleIndex === P.RULE_select_with_parens) {
				if (!fromQueries.has(child)) {
					const inner = innerSelect(child);
					out.push(inner ? lowerSelectStmt(inner) : emptyQuery(child));
				}
				continue; // its own scope — don't descend
			}
			walk(child);
		}
	};
	// Walk the whole select body; FROM subqueries are in `fromQueries` and are skipped (and not
	// descended into — they own their scope), so only the expression subqueries (projection / WHERE
	// / HAVING / QUALIFY scalar / IN / EXISTS) remain.
	walk(node);
	return out;
}

// --- column extraction (single source of truth for SelectExpr.columns) --------

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
		case "other":
			cstColumnRefs(expr.cst, acc, clause);
			break;
		// literal / star / subquery / exists / lambda → no column refs at this level
	}
}

/** Fallback: recover column references from inside an unmodelled `other` node. */
function cstColumnRefs(node: ParseTree, acc: ColumnRef[], clause: Clause): void {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (!(child instanceof ParserRuleContext)) continue;
		if (child.ruleIndex === P.RULE_select_with_parens) continue; // own scope
		if (child.ruleIndex === P.RULE_columnref) {
			acc.push({ parts: lowerColumnrefParts(child), clause, cst: child });
			continue;
		}
		cstColumnRefs(child, acc, clause);
	}
}

function lowerColumnrefParts(colref: ParserRuleContext): string[] {
	const e = lowerColumnref(colref);
	return e.kind === "column" ? e.parts : [colref.getText()];
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

// --- CST navigation helpers ---------------------------------------------------

function* descendants(node: ParseTree): Generator<ParserRuleContext> {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof ParserRuleContext) {
			yield child;
			yield* descendants(child);
		}
	}
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

/** First node of `ruleIndex` reachable without descending into a nested select_with_parens. */
function firstShallow(node: ParseTree, ruleIndex: number): ParserRuleContext | undefined {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (!(child instanceof ParserRuleContext)) continue;
		if (child.ruleIndex === ruleIndex) return child;
		if (child.ruleIndex === P.RULE_select_with_parens) continue;
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

/** Token within `node`, not descending into a nested select_with_parens. */
function hasTokenShallow(node: ParseTree, type: number): boolean {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof TerminalNode && child.symbol.type === type) return true;
		if (child instanceof ParserRuleContext && child.ruleIndex !== P.RULE_select_with_parens && hasTokenShallow(child, type)) {
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

function firstAExpr(node: ParserRuleContext): ParserRuleContext | undefined {
	return firstShallow(node, P.RULE_a_expr);
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

/** The dotted name parts of a qualified_name / columnref (colid + indirection attrs). */
function nameParts(node: ParserRuleContext): string[] {
	const colid = directChildrenOfRule(node, P.RULE_colid)[0];
	const parts = colid ? [textOf(colid)] : [];
	const ind = directChildrenOfRule(node, P.RULE_indirection)[0];
	if (ind) {
		for (const el of directChildrenOfRule(ind, P.RULE_indirection_el)) {
			if (hasDirectToken(el, P.DOT) && !hasDirectToken(el, P.STAR)) {
				const attr = firstShallow(el, P.RULE_attr_name);
				parts.push(attr ? textOf(attr) : el.getText().replace(/^\./, ""));
			}
		}
	}
	if (parts.length) return parts;
	return node.getText().split(".").map(stripQuotes).filter((p) => p.length > 0);
}

/** Last component of a (possibly dotted) func_name / name. */
function lastName(node: ParserRuleContext): string {
	const parts = nameParts(node);
	return parts.length ? parts[parts.length - 1] : node.getText();
}

/** Identifier text with quotes stripped (handles colid/name/identifier subtrees). */
function textOf(node: ParserRuleContext): string {
	return stripQuotes(node.getText());
}

function textOrEmpty(node: ParserRuleContext | undefined): string {
	return node ? stripQuotes(node.getText()) : "";
}

function stripQuotes(text: string): string {
	if (text.length >= 2 && text[0] === '"' && text[text.length - 1] === '"') return text.slice(1, -1).replace(/""/g, '"');
	return text;
}

function otherExpr(node: ParserRuleContext): Expr {
	return { kind: "other", text: node.getText(), cst: node };
}

function emptyBody(cst: ParserRuleContext): SelectExpr {
	return { kind: "select", projections: [], from: [], columns: [], aggregated: false, unsupported: ["unparsed"], cst };
}

function emptyQuery(cst: ParserRuleContext): QueryExpr {
	return { kind: "query", ctes: [], body: emptyBody(cst), cst };
}

// A sentinel CST for the rare empty-expression fallback (keeps Expr.cst non-optional).
const emptyCst = new ParserRuleContext(null);
