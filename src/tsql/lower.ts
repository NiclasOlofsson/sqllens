import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import { TSqlParser as P } from "../generated/tsql/TSqlParser.js";
import type {
	Clause,
	ColumnRef,
	CteDef,
	Expr,
	LimitInfo,
	PivotInfo,
	Projection,
	QueryBody,
	QueryExpr,
	SelectExpr,
	Source,
	UnpivotInfo,
} from "../ir/ir.js";

// ---------------------------------------------------------------------------
// Lowering — T-SQL (grammars-v4 sql/tsql) CST -> the shared, dialect-neutral IR
// (src/ir/ir.ts). The semantic layer (scope/qualify/infer/lineage/symbols) runs
// on the IR unchanged; only this file knows T-SQL's grammar. Core query path:
// query_specification, table_sources, search_condition, expression. Constructs
// not yet mapped become explicit `other`/`unsupported`, never silently dropped.
//
// Navigation is by rule index against the generated parser. Two boundaries are
// respected everywhere: nested `select_statement`/`subquery` nodes belong to
// their own scope, so shallow walks never descend into them.
// ---------------------------------------------------------------------------

const AGGREGATES = new Set([
	"sum",
	"count",
	"count_big",
	"avg",
	"min",
	"max",
	"stdev",
	"stdevp",
	"var",
	"varp",
	"grouping",
	"grouping_id",
	"string_agg",
	"checksum_agg",
	"approx_count_distinct",
]);

const CAST_FUNCS = new Set(["CAST", "TRY_CAST", "CONVERT", "TRY_CONVERT", "PARSE", "TRY_PARSE"]);

/** Lower a parsed T-SQL query (select_statement_standalone) into the IR. */
export function lower(tree: ParserRuleContext): QueryExpr {
	// select_statement_standalone: with_expression? select_statement — both direct children.
	const selectStmt = directChildrenOfRule(tree, P.RULE_select_statement)[0];
	if (!selectStmt) return emptyQuery(tree);
	const ctesNode = directChildrenOfRule(tree, P.RULE_with_expression)[0];
	const ctes = ctesNode ? directChildrenOfRule(ctesNode, P.RULE_common_table_expression).map(lowerCte) : [];
	const query = directChildrenOfRule(selectStmt, P.RULE_query_expression)[0];
	const body = query ? lowerQueryExpression(query) : emptyBody(selectStmt);
	const orderBy = extractOrderBy(selectStmt);
	if (orderBy) for (const o of orderBy) columnsOf(o, body.columns, "orderBy");
	return { kind: "query", ctes, body, orderBy, limit: extractLimit(selectStmt), cst: query ?? selectStmt };
}

function lowerCte(cte: ParserRuleContext): CteDef {
	// common_table_expression: id_ ('(' column_name_list ')')? AS '(' select_statement ')'
	const name = directChildrenOfRule(cte, P.RULE_id_)[0]?.getText() ?? "";
	const inner = directChildrenOfRule(cte, P.RULE_select_statement)[0];
	const colList = directChildrenOfRule(cte, P.RULE_column_name_list)[0];
	const columnAliases = colList
		? directChildrenOfRule(colList, P.RULE_id_).map((i) => stripQuotes(i.getText()))
		: undefined;
	return {
		name: stripQuotes(name),
		columnAliases: columnAliases?.length ? columnAliases : undefined,
		body: inner ? lowerSelect(inner) : emptyQuery(cte),
		cst: cte,
	};
}

/** A select_statement (query_expression + order by) -> QueryExpr. */
function lowerSelect(selectStmt: ParserRuleContext): QueryExpr {
	const query = directChildrenOfRule(selectStmt, P.RULE_query_expression)[0];
	const body = query ? lowerQueryExpression(query) : emptyBody(selectStmt);
	const orderBy = extractOrderBy(selectStmt);
	if (orderBy) for (const o of orderBy) columnsOf(o, body.columns, "orderBy");
	return { kind: "query", ctes: [], body, orderBy, limit: extractLimit(selectStmt), cst: selectStmt };
}

/** TOP n / TOP (expr) [PERCENT] [WITH TIES] from the query_specification, and OFFSET/FETCH from the
 *  select_order_by_clause. Row-limiting only — captured so it's modelled, not dropped. */
function extractLimit(selectStmt: ParserRuleContext): LimitInfo | undefined {
	const info: LimitInfo = {};
	let any = false;

	const top = shallowFirstOfRule(selectStmt, P.RULE_top_clause);
	if (top) {
		any = true;
		const percent = firstOfRule(top, P.RULE_top_percent);
		const countNode = percent ?? firstOfRule(top, P.RULE_top_count);
		const expr = countNode ? firstOfRule(countNode, P.RULE_expression) : undefined;
		info.top = expr
			? lowerExpression(expr)
			: { kind: "literal", text: countNode ? (leftmostToken(countNode) ?? "") : "", cst: top };
		if (percent) info.percent = true;
		if (hasToken(top, P.TIES)) info.withTies = true;
	}

	const obc = shallowFirstOfRule(selectStmt, P.RULE_select_order_by_clause);
	// select_order_by_clause: order_by_clause (OFFSET expr ROWS (FETCH … expr ROWS ONLY)?)? — the
	// offset/fetch expressions are direct children (the sort keys live inside order_by_clause).
	const offsetFetch = obc ? directChildrenOfRule(obc, P.RULE_expression) : [];
	if (offsetFetch.length) {
		any = true;
		info.offset = lowerExpression(offsetFetch[0]);
		if (offsetFetch[1]) info.fetch = lowerExpression(offsetFetch[1]);
	}

	return any ? info : undefined;
}

/** query_expression: query_specification select_order_by? sql_union* | '(' query_expression ')' (UNION …)? */
function lowerQueryExpression(query: ParserRuleContext): QueryBody {
	const spec = directChildrenOfRule(query, P.RULE_query_specification)[0];
	let body: QueryBody | undefined = spec ? buildSelect(spec) : undefined;
	if (!body) {
		// ( query_expression ) [ UNION ALL? query_expression ] — unwrap, then fold trailing UNIONs.
		const inners = directChildrenOfRule(query, P.RULE_query_expression);
		body = inners[0] ? lowerQueryExpression(inners[0]) : emptyBody(query);
		for (let i = 1; i < inners.length; i++) {
			body = {
				kind: "setop",
				op: "union",
				all: hasToken(query, P.ALL),
				left: body,
				right: lowerQueryExpression(inners[i]),
				columns: [],
				cst: query,
			};
		}
	}
	// A trailing list of sql_union branches folds left-to-right into nested set ops.
	for (const u of directChildrenOfRule(query, P.RULE_sql_union)) {
		body = {
			kind: "setop",
			op: setOpKind(u),
			all: directTokenType(u, [P.ALL]) !== undefined,
			left: body,
			right: lowerUnionBranch(u),
			columns: [],
			cst: query,
		};
	}
	return body;
}

function lowerUnionBranch(union: ParserRuleContext): QueryBody {
	const spec = directChildrenOfRule(union, P.RULE_query_specification)[0];
	if (spec) return buildSelect(spec);
	const inner = directChildrenOfRule(union, P.RULE_query_expression)[0];
	return inner ? lowerQueryExpression(inner) : emptyBody(union);
}

function setOpKind(union: ParserRuleContext): "union" | "except" | "intersect" {
	const t = directTokenType(union, [P.UNION, P.EXCEPT, P.INTERSECT]);
	if (t === P.EXCEPT) return "except";
	if (t === P.INTERSECT) return "intersect";
	return "union";
}

function buildSelect(spec: ParserRuleContext): SelectExpr {
	const selectList = directChildrenOfRule(spec, P.RULE_select_list)[0];
	const projections = selectList
		? directChildrenOfRule(selectList, P.RULE_select_list_elem).map(buildProjection)
		: [];

	const fromClause = directChildrenOfRule(spec, P.RULE_table_sources)[0];
	const from: Source[] = fromClause ? shallowNodesOfRule(fromClause, P.RULE_table_source_item).map(buildSource) : [];

	const where = directChildAfter(spec, P.WHERE, P.RULE_search_condition);
	const whereExpr = where ? lowerSearch(where) : undefined;
	const havingCtx = directChildAfter(spec, P.HAVING, P.RULE_search_condition);
	const having = havingCtx ? lowerSearch(havingCtx) : undefined;
	const groupBy = extractGroupBy(spec);
	const joinConditions = fromClause ? extractJoinConditions(fromClause) : [];
	const subqueries = extractExpressionSubqueries(spec, fromSubqueryNodes(from));

	const aggregated =
		(groupBy !== undefined && groupBy.length > 0) ||
		projections.some((p) => hasAggregate(p.expr)) ||
		(having !== undefined && hasAggregate(having));

	const columns: ColumnRef[] = [];
	for (const p of projections) columnsOf(p.expr, columns, "projection");
	if (whereExpr) columnsOf(whereExpr, columns, "where");
	for (const j of joinConditions) columnsOf(j, columns, "join");
	for (const g of groupBy ?? []) columnsOf(g, columns, "groupBy");
	if (having) columnsOf(having, columns, "having");

	return {
		kind: "select",
		projections,
		from,
		columns,
		where: whereExpr,
		joinConditions: joinConditions.length ? joinConditions : undefined,
		groupBy,
		having,
		aggregated,
		subqueries: subqueries.length ? subqueries : undefined,
		pivot: fromClause ? extractPivot(fromClause) : undefined,
		unpivot: fromClause ? extractUnpivot(fromClause) : undefined,
		cst: spec,
	};
}

// --- PIVOT / UNPIVOT --------------------------------------------------------

function extractPivot(fromClause: ParserRuleContext): PivotInfo | undefined {
	// pivot: PIVOT pivot_clause as_table_alias
	// pivot_clause: '(' aggregate_windowed_function FOR full_column_name IN column_alias_list ')'
	const pivot = shallowNodesOfRule(fromClause, P.RULE_pivot)[0];
	if (!pivot) return undefined;
	const clause = firstOfRule(pivot, P.RULE_pivot_clause);
	if (!clause) return undefined;
	const list = directChildrenOfRule(clause, P.RULE_column_alias_list)[0];
	const values = list ? directChildrenOfRule(list, P.RULE_column_alias).map((c) => stripQuotes(c.getText())) : [];
	const forCol = directChildrenOfRule(clause, P.RULE_full_column_name)[0];
	const forColumns = forCol ? [lastPart(nameParts(forCol))] : [];
	const agg = firstOfRule(clause, P.RULE_aggregate_windowed_function);
	const aggColumns = agg ? collectOfRule(agg, P.RULE_full_column_name).map((c) => lastPart(nameParts(c))) : [];
	return { values, forColumns, aggColumns, alias: tableAlias(pivot)?.text };
}

function extractUnpivot(fromClause: ParserRuleContext): UnpivotInfo | undefined {
	// unpivot: UNPIVOT unpivot_clause as_table_alias
	// unpivot_clause: '(' unpivot_exp=expression FOR full_column_name IN '(' full_column_name_list ')' ')'
	const unpivot = shallowNodesOfRule(fromClause, P.RULE_unpivot)[0];
	if (!unpivot) return undefined;
	const clause = firstOfRule(unpivot, P.RULE_unpivot_clause);
	if (!clause) return undefined;
	const valueExpr = directChildrenOfRule(clause, P.RULE_expression)[0];
	const valueFcn = valueExpr ? firstOfRule(valueExpr, P.RULE_full_column_name) : undefined;
	const valueColumn = valueFcn ? lastPart(nameParts(valueFcn)) : stripQuotes(valueExpr?.getText() ?? "");
	const nameCol = directChildrenOfRule(clause, P.RULE_full_column_name)[0];
	const nameColumn = nameCol ? lastPart(nameParts(nameCol)) : "";
	const listNode = firstOfRule(clause, P.RULE_full_column_name_list);
	const removed = listNode
		? directChildrenOfRule(listNode, P.RULE_full_column_name).map((c) => lastPart(nameParts(c)))
		: [];
	return { valueColumn, nameColumn, removed, alias: tableAlias(unpivot)?.text };
}

function lastPart(parts: string[]): string {
	return parts[parts.length - 1] ?? "";
}

// --- projections -----------------------------------------------------------

function buildProjection(elem: ParserRuleContext): Projection {
	const asterisk = directChildrenOfRule(elem, P.RULE_asterisk)[0];
	if (asterisk) {
		const qn = directChildrenOfRule(asterisk, P.RULE_table_name)[0];
		return {
			name: undefined,
			isStar: true,
			expr: { kind: "star", qualifier: qn ? nameParts(qn) : undefined, cst: asterisk },
			cst: elem,
		};
	}
	// expression_elem: `column_alias '=' expression` OR `expression as_column_alias?`
	const exprElem = directChildrenOfRule(elem, P.RULE_expression_elem)[0] ?? elem;
	const exprCtx = directChildrenOfRule(exprElem, P.RULE_expression)[0];
	const aliasCtx =
		directChildrenOfRule(exprElem, P.RULE_as_column_alias)[0] ??
		directChildrenOfRule(exprElem, P.RULE_column_alias)[0];
	const expr = exprCtx ? lowerExpression(exprCtx) : otherExpr(elem);
	let name = aliasCtx ? aliasText(aliasCtx) : undefined;
	if (name === undefined && expr.kind === "column") name = expr.parts[expr.parts.length - 1];
	return { name, isStar: false, expr, cst: elem };
}

function aliasText(alias: ParserRuleContext): string {
	const id = firstOfRule(alias, P.RULE_id_);
	return stripQuotes(id ? id.getText() : alias.getText());
}

// --- sources ---------------------------------------------------------------

function buildSource(item: ParserRuleContext): Source {
	const alias = tableAlias(item);
	const derived = firstOfRule(item, P.RULE_derived_table);
	if (derived) {
		// derived_table -> subquery -> select_statement (the select is a grandchild, not direct).
		const inner = firstOfRule(derived, P.RULE_select_statement);
		return {
			kind: "subquery",
			query: inner ? lowerSelect(inner) : emptyQuery(derived),
			alias: alias?.text,
			aliasCst: alias?.cst,
			columnAliases: columnAliasList(item),
			cst: item,
		};
	}

	// OPENJSON / OPENXML — columns come from the `WITH (col type, …)` schema; the alias lives inside
	// the open_json/open_xml node. Without a WITH clause, OPENJSON's default shape is key/value/type.
	const openNode = directChildrenOfRule(item, P.RULE_open_json)[0] ?? directChildrenOfRule(item, P.RULE_open_xml)[0];
	if (openNode) {
		const al = innerTableAlias(openNode) ?? alias;
		const declared = collectOfRule(openNode, P.RULE_column_declaration)
			.map((cd) => stripQuotes(firstOfRule(cd, P.RULE_id_)?.getText() ?? ""))
			.filter((c) => c.length > 0);
		const isJson = openNode.ruleIndex === P.RULE_open_json;
		const columnAliases = declared.length ? declared : isJson ? ["key", "value", "type"] : undefined;
		return {
			kind: "table",
			name: [al?.text ?? (isJson ? "openjson" : "openxml")],
			alias: al?.text,
			aliasCst: al?.cst,
			columnAliases,
			cst: item,
		};
	}

	// Table-valued function or XML `.nodes()` — opaque columns (a TVF's columns need its signature; a
	// `.nodes()` relation's columns are produced by later `.value()` calls, i.e. XML shredding, a
	// separate subsystem). Modelled as a source so refs resolve to it rather than mis-binding.
	const fn = directChildrenOfRule(item, P.RULE_function_call)[0];
	const nodes = firstOfRule(item, P.RULE_nodes_method);
	if (fn || nodes) {
		return {
			kind: "table",
			name: [fn ? functionName(fn) : "nodes"],
			alias: alias?.text,
			aliasCst: alias?.cst,
			columnAliases: columnAliasList(item), // `… AS f(c1, c2)` declares the output columns
			cst: item,
		};
	}

	const full = directChildrenOfRule(item, P.RULE_full_table_name)[0];
	const parts = full ? nameParts(full) : [stripQuotes(item.getText())];
	return { kind: "table", name: parts, alias: alias?.text, aliasCst: alias?.cst, cst: item };
}

/** The as_table_alias nested inside an open_json/open_xml node (not a direct child of the item). */
function innerTableAlias(node: ParserRuleContext): { text: string; cst: ParserRuleContext } | undefined {
	const asAlias = firstOfRule(node, P.RULE_as_table_alias);
	const id = asAlias ? firstOfRule(asAlias, P.RULE_id_) : undefined;
	return id ? { text: stripQuotes(id.getText()), cst: id } : undefined;
}

function tableAlias(item: ParserRuleContext): { text: string; cst: ParserRuleContext } | undefined {
	const asAlias = directChildrenOfRule(item, P.RULE_as_table_alias)[0];
	const id = asAlias ? firstOfRule(asAlias, P.RULE_id_) : undefined;
	return id ? { text: stripQuotes(id.getText()), cst: id } : undefined;
}

function columnAliasList(item: ParserRuleContext): string[] | undefined {
	const list = directChildrenOfRule(item, P.RULE_column_alias_list)[0];
	if (!list) return undefined;
	const cols = directChildrenOfRule(list, P.RULE_column_alias).map((c) => stripQuotes(c.getText()));
	return cols.length ? cols : undefined;
}

// --- WHERE / GROUP BY / HAVING / ORDER BY ----------------------------------

function extractGroupBy(spec: ParserRuleContext): Expr[] | undefined {
	if (!hasDirectToken(spec, P.GROUP)) return undefined;
	const out = shallowNodesOfRule(spec, P.RULE_group_by_item)
		.map((item) => firstOfRule(item, P.RULE_expression))
		.filter((e): e is ParserRuleContext => e !== undefined)
		.map(lowerExpression);
	return out.length ? out : undefined;
}

function extractJoinConditions(fromClause: ParserRuleContext): Expr[] {
	// join_on: … JOIN table_source ON cond=search_condition — the ON cond is a DIRECT child.
	return shallowNodesOfRule(fromClause, P.RULE_join_on)
		.map((jo) => directChildrenOfRule(jo, P.RULE_search_condition)[0])
		.filter((s): s is ParserRuleContext => s !== undefined)
		.map(lowerSearch);
}

function extractOrderBy(selectStmt: ParserRuleContext): Expr[] | undefined {
	const obc = shallowFirstOfRule(selectStmt, P.RULE_order_by_clause);
	if (!obc) return undefined;
	const items = directChildrenOfRule(obc, P.RULE_order_by_expression)
		.map((o) => firstOfRule(o, P.RULE_expression))
		.filter((e): e is ParserRuleContext => e !== undefined)
		.map(lowerExpression);
	return items.length ? items : undefined;
}

// --- search_condition (boolean) --------------------------------------------

function lowerSearch(sc: ParserRuleContext): Expr {
	// search_condition: NOT* (predicate | '(' search_condition ')') | sc AND sc | sc OR sc
	const subConds = directChildrenOfRule(sc, P.RULE_search_condition);
	if (subConds.length === 2) {
		const op = directTokenType(sc, [P.AND, P.OR]) === P.OR ? "or" : "and";
		return { kind: "binary", op, left: lowerSearch(subConds[0]), right: lowerSearch(subConds[1]), cst: sc };
	}
	if (subConds.length === 1) {
		const inner = lowerSearch(subConds[0]);
		return hasDirectToken(sc, P.NOT) ? { kind: "unary", op: "not", operand: inner, cst: sc } : inner;
	}
	const pred = directChildrenOfRule(sc, P.RULE_predicate)[0];
	const inner = pred ? lowerPredicate(pred) : otherExpr(sc);
	return hasDirectToken(sc, P.NOT) ? { kind: "unary", op: "not", operand: inner, cst: sc } : inner;
}

function lowerPredicate(pred: ParserRuleContext): Expr {
	if (hasDirectToken(pred, P.EXISTS)) {
		const sub = firstOfRule(pred, P.RULE_subquery);
		return sub ? { kind: "exists", query: lowerSubquery(sub), cst: pred } : otherExpr(pred);
	}
	const exprs = directChildrenOfRule(pred, P.RULE_expression);
	const operand = exprs[0] ? lowerExpression(exprs[0]) : otherExpr(pred);
	const negated = hasToken(pred, P.NOT);

	if (hasDirectToken(pred, P.IS)) {
		return { kind: "predicate", op: "null", negated, operand, args: [], cst: pred };
	}
	if (hasDirectToken(pred, P.BETWEEN)) {
		return {
			kind: "predicate",
			op: "between",
			negated,
			operand,
			args: exprs.slice(1).map(lowerExpression),
			cst: pred,
		};
	}
	if (hasDirectToken(pred, P.IN)) {
		const sub = firstOfRule(pred, P.RULE_subquery);
		const args = sub
			? [{ kind: "subquery" as const, query: lowerSubquery(sub), cst: sub }]
			: collectExprList(pred).map(lowerExpression);
		return { kind: "predicate", op: "in", negated, operand, args, cst: pred };
	}
	if (hasDirectToken(pred, P.LIKE)) {
		return {
			kind: "predicate",
			op: "like",
			negated,
			operand,
			args: exprs.slice(1, 2).map(lowerExpression),
			cst: pred,
		};
	}
	// comparison: expression comparison_operator expression
	const cmp = directChildrenOfRule(pred, P.RULE_comparison_operator)[0];
	if (cmp && exprs.length >= 2) {
		return { kind: "binary", op: cmp.getText(), left: operand, right: lowerExpression(exprs[1]), cst: pred };
	}
	// Legacy non-ANSI outer-join operator `*=` (SQL-82) appearing in WHERE — modelled as a comparison
	// so its columns are captured (the outer-join semantics aren't reconstructed).
	if (hasDirectToken(pred, P.MULT_ASSIGN) && exprs.length >= 2) {
		return { kind: "binary", op: "*=", left: operand, right: lowerExpression(exprs[1]), cst: pred };
	}
	return otherExpr(pred);
}

function collectExprList(pred: ParserRuleContext): ParserRuleContext[] {
	const list = firstOfRule(pred, P.RULE_expression_list_);
	return list ? directChildrenOfRule(list, P.RULE_expression) : [];
}

// --- expressions -----------------------------------------------------------

function lowerExpression(node: ParserRuleContext): Expr {
	switch (node.ruleIndex) {
		case P.RULE_bracket_expression: {
			const sub = firstOfRule(node, P.RULE_subquery);
			if (sub) return { kind: "subquery", query: lowerSubquery(sub), cst: node };
			const inner = directChildrenOfRule(node, P.RULE_expression)[0];
			return inner ? lowerExpression(inner) : otherExpr(node);
		}
		case P.RULE_full_column_name:
			return { kind: "column", parts: nameParts(node), cst: node };
		case P.RULE_primitive_expression:
		case P.RULE_primitive_constant:
			return { kind: "literal", text: node.getText(), cst: node };
		case P.RULE_function_call:
			return lowerFunction(node);
		case P.RULE_case_expression:
			return lowerCase(node);
		case P.RULE_unary_operator_expression: {
			const inner = directChildrenOfRule(node, P.RULE_expression)[0];
			const op = node.getChild(0) instanceof TerminalNode ? node.getChild(0)!.getText() : "-";
			return inner ? { kind: "unary", op, operand: lowerExpression(inner), cst: node } : otherExpr(node);
		}
		case P.RULE_expression: {
			const exprs = directChildrenOfRule(node, P.RULE_expression);
			if (exprs.length === 2) {
				return {
					kind: "binary",
					op: binaryOp(node),
					left: lowerExpression(exprs[0]),
					right: lowerExpression(exprs[1]),
					cst: node,
				};
			}
			const inner = firstExprChild(node);
			if (inner) return lowerExpression(inner);
			return otherExpr(node);
		}
		default:
			return otherExpr(node);
	}
}

/** The first child of an `expression` that is one of its single-production rules. */
function firstExprChild(node: ParserRuleContext): ParserRuleContext | undefined {
	const rules = [
		P.RULE_primitive_expression,
		P.RULE_function_call,
		P.RULE_case_expression,
		P.RULE_full_column_name,
		P.RULE_bracket_expression,
		P.RULE_unary_operator_expression,
		P.RULE_expression,
	];
	for (let i = 0; i < node.getChildCount(); i++) {
		const c = node.getChild(i);
		if (c instanceof ParserRuleContext && rules.includes(c.ruleIndex)) return c;
	}
	return undefined;
}

function binaryOp(node: ParserRuleContext): string {
	for (let i = 0; i < node.getChildCount(); i++) {
		const c = node.getChild(i);
		if (c instanceof TerminalNode) return c.getText();
	}
	return "";
}

function lowerFunction(node: ParserRuleContext): Expr {
	const lead = leftmostToken(node)?.toUpperCase();
	if (lead && CAST_FUNCS.has(lead)) return lowerCast(node);
	const name = functionName(node);
	const args = functionArgs(node).map(lowerExpression);
	const over = firstOfRule(node, P.RULE_over_clause);
	return {
		kind: "function",
		name,
		args,
		aggregate: AGGREGATES.has(name.toLowerCase()),
		distinct: hasToken(node, P.DISTINCT),
		window: over ? lowerOver(over) : undefined,
		cst: node,
	};
}

/** CAST/TRY_CAST/CONVERT/PARSE → a cast node: value expression + target type text. */
function lowerCast(node: ParserRuleContext): Expr {
	const exprCtx = functionArgs(node)[0] ?? firstOfRule(node, P.RULE_expression);
	const dt = firstOfRule(node, P.RULE_data_type);
	return {
		kind: "cast",
		expr: exprCtx ? lowerExpression(exprCtx) : otherExpr(node),
		typeText: dt ? dt.getText() : "",
		cst: node,
	};
}

/** Argument expressions of a function call: the top-level `expression` nodes within it,
 *  not descending into a nested call / subquery / OVER clause (those aren't plain args). */
function functionArgs(call: ParserRuleContext): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	const walk = (n: ParseTree): void => {
		for (let i = 0; i < n.getChildCount(); i++) {
			const child = n.getChild(i);
			if (!(child instanceof ParserRuleContext)) continue;
			if (child.ruleIndex === P.RULE_expression) out.push(child);
			else if (
				child.ruleIndex === P.RULE_function_call ||
				child.ruleIndex === P.RULE_subquery ||
				child.ruleIndex === P.RULE_select_statement ||
				child.ruleIndex === P.RULE_over_clause
			)
				continue;
			else walk(child);
		}
	};
	walk(call);
	return out;
}

function functionName(node: ParserRuleContext): string {
	const scalar = directChildrenOfRule(node, P.RULE_scalar_function_name)[0];
	if (scalar) return lastNamePart(scalar.getText());
	return leftmostToken(node) ?? "";
}

function lowerOver(over: ParserRuleContext): { partitionBy: Expr[]; orderBy: Expr[]; cst: ParserRuleContext } {
	const partitionBy = directChildrenOfRule(over, P.RULE_expression_list_)
		.flatMap((l) => directChildrenOfRule(l, P.RULE_expression))
		.map(lowerExpression);
	const orderBy = collectOfRule(over, P.RULE_order_by_expression)
		.map((o) => firstOfRule(o, P.RULE_expression))
		.filter((e): e is ParserRuleContext => e !== undefined)
		.map(lowerExpression);
	return { partitionBy, orderBy, cst: over };
}

function lowerCase(node: ParserRuleContext): Expr {
	const searchedSecs = directChildrenOfRule(node, P.RULE_switch_search_condition_section);
	const simpleSecs = directChildrenOfRule(node, P.RULE_switch_section);
	const directExprs = directChildrenOfRule(node, P.RULE_expression);

	if (searchedSecs.length > 0) {
		// CASE WHEN <cond> THEN <result> … ELSE <expr> END — directExprs holds only the ELSE.
		const whens = searchedSecs.map((sec) => {
			const cond = firstOfRule(sec, P.RULE_search_condition);
			const thenE = directChildrenOfRule(sec, P.RULE_expression)[0];
			return {
				when: cond ? lowerSearch(cond) : otherExpr(sec),
				then: thenE ? lowerExpression(thenE) : otherExpr(sec),
			};
		});
		return {
			kind: "case",
			whens,
			elseExpr: directExprs[0] ? lowerExpression(directExprs[0]) : undefined,
			cst: node,
		};
	}

	// Simple CASE <subject> WHEN <val> THEN <result> … — desugar each WHEN to `subject = val`
	// so columns/lineage/types see the subject. directExprs = [subject, else?].
	const subjectCtx = directExprs[0];
	const subject = subjectCtx ? lowerExpression(subjectCtx) : otherExpr(node);
	const whens = simpleSecs.map((sec) => {
		const es = directChildrenOfRule(sec, P.RULE_expression);
		const whenVal = es[0] ? lowerExpression(es[0]) : otherExpr(sec);
		const thenE = es[1] ? lowerExpression(es[1]) : otherExpr(sec);
		return { when: { kind: "binary" as const, op: "=", left: subject, right: whenVal, cst: sec }, then: thenE };
	});
	const elseExpr = directExprs.length > 1 ? lowerExpression(directExprs[directExprs.length - 1]) : undefined;
	return { kind: "case", whens, elseExpr, cst: node };
}

function lowerSubquery(sub: ParserRuleContext): QueryExpr {
	const inner = directChildrenOfRule(sub, P.RULE_select_statement)[0];
	return inner ? lowerSelect(inner) : emptyQuery(sub);
}

// --- column extraction (single source of truth for SelectExpr.columns) -----

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

/** Fallback: recover full_column_name references from inside an unmodelled `other` node. */
function cstColumnRefs(node: ParseTree, acc: ColumnRef[], clause: Clause): void {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (!(child instanceof ParserRuleContext)) continue;
		if (child.ruleIndex === P.RULE_subquery || child.ruleIndex === P.RULE_select_statement) continue;
		if (child.ruleIndex === P.RULE_full_column_name) {
			acc.push({ parts: nameParts(child), clause, cst: child });
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
		default:
			return false;
	}
}

// --- expression subqueries (scalar / IN / EXISTS) --------------------------

function fromSubqueryNodes(from: Source[]): Set<ParserRuleContext> {
	const set = new Set<ParserRuleContext>();
	for (const s of from) {
		if (s.kind === "subquery") {
			const q = firstOfRule(s.cst, P.RULE_select_statement);
			if (q) set.add(q);
		}
	}
	return set;
}

function extractExpressionSubqueries(spec: ParserRuleContext, fromQueries: Set<ParserRuleContext>): QueryExpr[] {
	const out: QueryExpr[] = [];
	const walk = (n: ParseTree): void => {
		for (let i = 0; i < n.getChildCount(); i++) {
			const child = n.getChild(i);
			if (!(child instanceof ParserRuleContext)) continue;
			if (child.ruleIndex === P.RULE_select_statement) {
				if (!fromQueries.has(child)) out.push(lowerSelect(child));
				continue; // its own scope — don't descend
			}
			walk(child);
		}
	};
	walk(spec);
	return out;
}

// --- CST navigation helpers ------------------------------------------------

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

/** Collect rule nodes within `node` but not inside a nested subquery/select; matched nodes are
 *  not themselves descended into (so the top-most of each is returned). */
function shallowNodesOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	const walk = (n: ParseTree): void => {
		for (let i = 0; i < n.getChildCount(); i++) {
			const child = n.getChild(i);
			if (!(child instanceof ParserRuleContext)) continue;
			if (child.ruleIndex === ruleIndex) out.push(child);
			else if (child.ruleIndex === P.RULE_select_statement || child.ruleIndex === P.RULE_subquery) continue;
			else walk(child);
		}
	};
	walk(node);
	return out;
}

/** First node of a rule within `node`, not descending into nested select_statement/subquery. */
function shallowFirstOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext | undefined {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (!(child instanceof ParserRuleContext)) continue;
		if (child.ruleIndex === ruleIndex) return child;
		if (child.ruleIndex === P.RULE_select_statement || child.ruleIndex === P.RULE_subquery) continue;
		const found = shallowFirstOfRule(child, ruleIndex);
		if (found) return found;
	}
	return undefined;
}

/** The first node of `ruleIndex` that appears after a direct child token of type `tokenType`. */
function directChildAfter(node: ParseTree, tokenType: number, ruleIndex: number): ParserRuleContext | undefined {
	let seen = false;
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (seen && child instanceof ParserRuleContext && child.ruleIndex === ruleIndex) return child;
		if (child instanceof TerminalNode && child.symbol.type === tokenType) seen = true;
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

function hasDirectToken(node: ParseTree, type: number): boolean {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof TerminalNode && child.symbol.type === type) return true;
	}
	return false;
}

function hasToken(node: ParseTree, type: number): boolean {
	for (const d of tokensOf(node)) if (d === type) return true;
	return false;
}

/** Token types within `node`, not descending into a nested subquery/select/search_condition. */
function* tokensOf(node: ParseTree): Generator<number> {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof TerminalNode) yield child.symbol.type;
		else if (
			child instanceof ParserRuleContext &&
			child.ruleIndex !== P.RULE_select_statement &&
			child.ruleIndex !== P.RULE_subquery &&
			child.ruleIndex !== P.RULE_search_condition
		) {
			yield* tokensOf(child);
		}
	}
}

/** Leftmost terminal token text of a subtree (the function name keyword, for built-ins). */
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

/** The dotted name parts of a full_table_name / table_name / full_column_name (id_ leaves in order). */
function nameParts(node: ParserRuleContext): string[] {
	const ids = collectOfRule(node, P.RULE_id_);
	if (ids.length) return ids.map((i) => stripQuotes(i.getText()));
	return node
		.getText()
		.split(".")
		.map(stripQuotes)
		.filter((p) => p.length > 0);
}

function lastNamePart(text: string): string {
	const dot = text.lastIndexOf(".");
	return dot >= 0 ? text.slice(dot + 1) : text;
}

/** Strip T-SQL `[bracket]` / "quoted" identifier delimiters for name comparison. */
function stripQuotes(text: string): string {
	if (text.length >= 2) {
		const a = text[0],
			z = text[text.length - 1];
		if ((a === "[" && z === "]") || (a === '"' && z === '"') || (a === "`" && z === "`")) {
			return text.slice(1, -1);
		}
	}
	return text;
}

function otherExpr(node: ParserRuleContext): Expr {
	return { kind: "other", text: node.getText(), cst: node };
}

function emptyBody(cst: ParserRuleContext): SelectExpr {
	return {
		kind: "select",
		projections: [],
		from: [],
		columns: [],
		aggregated: false,
		unsupported: ["unparsed"],
		cst,
	};
}

function emptyQuery(cst: ParserRuleContext): QueryExpr {
	return { kind: "query", ctes: [], body: emptyBody(cst), cst };
}
