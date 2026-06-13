import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import {
	ArithmeticBinaryContext,
	ArithmeticUnaryContext,
	CastByColonContext,
	CastContext,
	ColumnReferenceContext,
	ComparisonContext,
	ConstantDefaultContext,
	CurrentLikeContext,
	DatabricksParser as P,
	DereferenceContext,
	ExistsContext,
	FunctionCallContext,
	LambdaContext,
	LogicalBinaryContext,
	LogicalNotContext,
	ParenthesizedExpressionContext,
	PredicatedContext,
	PrimaryExpressionContext,
	RowConstructorContext,
	SearchedCaseContext,
	ShiftExpressionContext,
	SimpleCaseContext,
	StarContext,
	SubqueryExpressionContext,
	SubscriptContext,
	TimestampaddContext,
	TimestampdiffContext,
} from "../generated/databricks/DatabricksParser.js";

// ---------------------------------------------------------------------------
// Lowering — Databricks (Spark SqlBase) CST -> the shared, dialect-neutral IR
// (src/ir/ir.ts). This file is the only Databricks-specific piece; everything
// downstream (scope, qualify, infer, lineage, symbols) operates on the IR types
// and is dialect-agnostic. Every node keeps a CST back-ref so spans survive.
//
// `lowerExpression` builds a typed `Expr` tree; anything not yet modelled becomes
// an explicit `other` node, never dropped (the IR-completeness gate keeps it 0).
// ---------------------------------------------------------------------------

import type {
	Clause,
	ColumnRef,
	CteDef,
	Expr,
	LateralViewSource,
	PivotInfo,
	Projection,
	QueryBody,
	QueryExpr,
	SelectExpr,
	Source,
	UnpivotInfo,
	WindowSpec,
} from "../ir/ir.js";
import { keywordCategory, type StatementCategory } from "../ir/statement.js";

// ---------------------------------------------------------------------------
// CST navigation helpers
// ---------------------------------------------------------------------------

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

/**
 * Like firstOfRule, but never descends into a nested `query` — so it finds a query's
 * OWN clause, not one belonging to a subquery in its SELECT/WHERE. Without this, a
 * scalar subquery in the select list hijacks the outer query's FROM.
 */
function shallowFirstOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext | undefined {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (!(child instanceof ParserRuleContext)) continue;
		if (child.ruleIndex === ruleIndex) return child;
		if (child.ruleIndex === P.RULE_query) continue; // belongs to a subquery
		const found = shallowFirstOfRule(child, ruleIndex);
		if (found) return found;
	}
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

/** One pass over a node's DIRECT children, returning the first child of each requested rule index.
 *  Replaces N separate scans of the same node (e.g. a querySpecification's clauses) with one. */
function directFirstByRule(node: ParseTree, ruleIndexes: readonly number[]): Map<number, ParserRuleContext> {
	const want = new Set(ruleIndexes);
	const found = new Map<number, ParserRuleContext>();
	for (let i = 0; i < node.getChildCount() && found.size < want.size; i++) {
		const child = node.getChild(i);
		if (child instanceof ParserRuleContext && want.has(child.ruleIndex) && !found.has(child.ruleIndex)) {
			found.set(child.ruleIndex, child);
		}
	}
	return found;
}

/** The first direct child token whose type is one of `types`, if any. */
function directTokenType(node: ParseTree, types: number[]): number | undefined {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof TerminalNode && types.includes(child.symbol.type)) return child.symbol.type;
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Lowering
// ---------------------------------------------------------------------------

/** Lower a parsed Databricks statement (CST) into the IR. */
export function lower(tree: ParserRuleContext): QueryExpr {
	const statement = statementCategory(tree);
	// A BEGIN…END scripting compound is a statement *sequence*, not a query — flag the
	// whole thing rather than modelling whichever SELECT happens to come first inside it.
	if (firstOfRule(tree, P.RULE_singleCompoundStatement)) {
		const body: SelectExpr = {
			kind: "select",
			projections: [],
			from: [],
			columns: [],
			aggregated: false,
			unsupported: ["compound"],
			cst: tree,
		};
		return { kind: "query", statement, ctes: [], body, cst: tree };
	}
	const query = firstOfRule(tree, P.RULE_query);
	if (!query) {
		// A non-query statement (DDL/DML without a SELECT). Return an empty, flagged body
		// rather than throwing, so consumers get a stable IR they can recognize and skip.
		const body: SelectExpr = {
			kind: "select",
			projections: [],
			from: [],
			columns: [],
			aggregated: false,
			unsupported: ["non-query"],
			cst: tree,
		};
		return { kind: "query", statement, ctes: [], body, cst: tree };
	}
	const lowered = lowerQuery(query);
	lowered.statement = statement;
	return lowered;
}

/**
 * The statement category, from the parse — not the source text. Spark's `statement` rule labels its
 * alternatives, so the structural cases are exact: a `#dmlStatement` (`ctes? dmlStatementNoWith`) is
 * DML even when written `WITH cte … INSERT …`, and a `BEGIN…END` compound is its own category. For
 * the remaining keyword-led commands (object DDL, GRANT, SET/USE/SHOW, …) the leading keyword is the
 * authoritative signal — Spark has no grouping rule above them.
 */
function statementCategory(tree: ParserRuleContext): StatementCategory {
	if (firstOfRule(tree, P.RULE_singleCompoundStatement)) return "compound";
	if (shallowFirstOfRule(tree, P.RULE_dmlStatementNoWith)) return "dml";
	return keywordCategory(tree.start?.text ?? "");
}

function lowerQuery(query: ParserRuleContext): QueryExpr {
	const ctesNode = directChildrenOfRule(query, P.RULE_ctes)[0];
	const ctes = ctesNode ? directChildrenOfRule(ctesNode, P.RULE_namedQuery).map(lowerNamedQuery) : [];

	// The main body is this query's own queryTerm — NOT the querySpecifications inside
	// the CTE bodies (which sit under `ctes`, earlier in the tree).
	const queryTerm = directChildrenOfRule(query, P.RULE_queryTerm)[0];
	if (!queryTerm) throw new Error("lower: query has no queryTerm body");
	const body = lowerQueryTerm(queryTerm);
	const orderBy = extractOrderBy(query);
	// ORDER BY references the body's output (a select's scope, or a set-op's left branch),
	// so its columns belong to the body's `columns` — for both selects and set ops.
	if (orderBy) for (const o of orderBy) columnsOf(o, body.columns, "orderBy");
	return { kind: "query", ctes, body, orderBy, cst: query };
}

/** The ORDER BY sort expressions from the query's queryOrganization (not SORT/CLUSTER/DISTRIBUTE BY). */
function extractOrderBy(query: ParserRuleContext): Expr[] | undefined {
	const qo = directChildrenOfRule(query, P.RULE_queryOrganization)[0];
	if (!qo) return undefined;
	const items: Expr[] = [];
	let started = false;
	for (let i = 0; i < qo.getChildCount(); i++) {
		const child = qo.getChild(i);
		if (!(child instanceof ParserRuleContext)) {
			const t = (child as TerminalNode | null)?.symbol?.type;
			if (t === P.ORDER) started = true;
			else if (started && (t === P.SORT || t === P.CLUSTER || t === P.DISTRIBUTE)) break;
			continue;
		}
		if (!started) continue;
		if (child.ruleIndex === P.RULE_sortItem) {
			const e = firstOfRule(child, P.RULE_expression);
			items.push(e ? lowerExpression(e) : otherExpr(child));
		} else {
			break; // a clusterBy/distributeBy expression — past the ORDER BY group
		}
	}
	return items.length ? items : undefined;
}

/** A queryTerm is either a set operation (two queryTerm branches) or a single select. */
function lowerQueryTerm(queryTerm: ParserRuleContext): QueryBody {
	const branches = directChildrenOfRule(queryTerm, P.RULE_queryTerm);
	if (branches.length === 2) {
		return {
			kind: "setop",
			op: setOpKind(queryTerm),
			all: hasAllQuantifier(queryTerm),
			left: lowerQueryTerm(branches[0]),
			right: lowerQueryTerm(branches[1]),
			columns: [],
			cst: queryTerm,
		};
	}
	// A parenthesized query — queryPrimary is `( query )`. Unwrap to its body, or nested
	// set ops / WHEREs inside the parens are silently lost.
	const queryPrimary = firstOfRule(queryTerm, P.RULE_queryPrimary);
	const innerQuery = queryPrimary ? directChildrenOfRule(queryPrimary, P.RULE_query)[0] : undefined;
	if (innerQuery) return lowerQuery(innerQuery).body;

	if (queryPrimary) {
		// The primary's own select — checked directly (not deep) so a scalar subquery
		// inside a VALUES row can't be mistaken for the body.
		const direct = directChildrenOfRule(queryPrimary, P.RULE_querySpecification)[0];
		if (direct) return buildSelect(direct);

		// VALUES (1,'a'),(2,'b') [AS v(x,y)] — an inline table is a leaf relation; its
		// output columns come from the alias list, else Spark's default col1..colN.
		const inlineTable = directChildrenOfRule(queryPrimary, P.RULE_inlineTable)[0];
		if (inlineTable) return buildInlineTable(inlineTable);

		// TABLE t — shorthand for SELECT * FROM t.
		if (directTokenType(queryPrimary, [P.TABLE]) !== undefined) return buildTableShorthand(queryPrimary);
	}

	const querySpec = firstOfRule(queryTerm, P.RULE_querySpecification);
	if (querySpec) return buildSelect(querySpec);

	// Any other body shape (e.g. FROM-first statements): flag it — a valid parse must never throw.
	return {
		kind: "select",
		projections: [],
		from: [],
		columns: [],
		aggregated: false,
		unsupported: ["query-body"],
		cst: queryTerm,
	};
}

/** VALUES rows: the first row fixes the output shape — its expressions become the
 *  projections, named by the table alias's column list or Spark's default col1..colN. */
function buildInlineTable(inlineTable: ParserRuleContext): SelectExpr {
	const rows = directChildrenOfRule(inlineTable, P.RULE_expression);
	const first = rows[0];

	// A multi-column row is a rowConstructor `(a, b, …)`; otherwise the row is one bare expression.
	let ctor: ParserRuleContext | undefined;
	let cur: ParseTree | null = first ?? null;
	while (cur instanceof ParserRuleContext) {
		if (cur instanceof RowConstructorContext) {
			ctor = cur;
			break;
		}
		if (cur.getChildCount() !== 1) break;
		cur = cur.getChild(0);
	}
	const colExprs = ctor
		? directChildrenOfRule(ctor, P.RULE_namedExpression).map(
				(n) => directChildrenOfRule(n, P.RULE_expression)[0] ?? n,
			)
		: first
			? [first]
			: [];

	const tableAlias = directChildrenOfRule(inlineTable, P.RULE_tableAlias)[0];
	const aliases = tableAlias ? columnAliasList(tableAlias) : undefined;

	const projections: Projection[] = colExprs.map((e, i) => ({
		name: aliases?.[i] ?? `col${i + 1}`,
		isStar: false,
		expr: lowerExpression(e),
		cst: e,
	}));
	const columns: ColumnRef[] = [];
	for (const p of projections) columnsOf(p.expr, columns, "projection");
	return { kind: "select", projections, from: [], columns, aggregated: false, cst: inlineTable };
}

/** `TABLE t` — shorthand for `SELECT * FROM t`. */
function buildTableShorthand(queryPrimary: ParserRuleContext): SelectExpr {
	const multipart = firstOfRule(queryPrimary, P.RULE_multipartIdentifier);
	const name = multipart
		? directChildrenOfRule(multipart, P.RULE_errorCapturingIdentifier).map((p) => p.getText())
		: [];
	const star: Expr = { kind: "star", cst: queryPrimary };
	return {
		kind: "select",
		projections: [{ isStar: true, expr: star, cst: queryPrimary }],
		from: [{ kind: "table", name, cst: queryPrimary }],
		columns: [],
		aggregated: false,
		cst: queryPrimary,
	};
}

function setOpKind(queryTerm: ParserRuleContext): "union" | "except" | "intersect" {
	const t = directTokenType(queryTerm, [P.UNION, P.INTERSECT, P.EXCEPT, P.SETMINUS]);
	if (t === P.UNION) return "union";
	if (t === P.INTERSECT) return "intersect";
	return "except"; // EXCEPT, or its MINUS/SETMINUS synonym
}

function hasAllQuantifier(queryTerm: ParserRuleContext): boolean {
	const sq = directChildrenOfRule(queryTerm, P.RULE_setQuantifier)[0];
	return sq !== undefined && directTokenType(sq, [P.ALL]) !== undefined;
}

function lowerNamedQuery(namedQuery: ParserRuleContext): CteDef {
	const name = directChildrenOfRule(namedQuery, P.RULE_errorCapturingIdentifier)[0]?.getText() ?? "";
	const innerQuery = firstOfRule(namedQuery, P.RULE_query);
	if (!innerQuery) throw new Error("lower: CTE without a query body");
	return {
		name,
		columnAliases: columnAliasList(namedQuery),
		body: lowerQuery(innerQuery),
		cst: namedQuery,
	};
}

/** The identifier names in a `( a, b, c )` column-alias list directly under `node`, if present. */
function columnAliasList(node: ParserRuleContext): string[] | undefined {
	const list = directChildrenOfRule(node, P.RULE_identifierList)[0];
	if (!list) return undefined;
	const seq = firstOfRule(list, P.RULE_identifierSeq);
	if (!seq) return undefined;
	return directChildrenOfRule(seq, P.RULE_errorCapturingIdentifier).map((i) => i.getText());
}

function buildSelect(querySpec: ParserRuleContext): SelectExpr {
	// Each clause must be THIS query's own — never one nested inside a subquery in the select/where
	// list. They are all DIRECT children of the (regular)querySpecification (grammar: selectClause
	// fromClause? lateralView* whereClause? aggregationClause? havingClause? … qualifyClause?), so a
	// single pass over the direct children collects every clause — no descent into the expression
	// subtrees, which is what the per-clause shallow walks were paying for.
	const clauses = directFirstByRule(querySpec, [
		P.RULE_selectClause,
		P.RULE_fromClause,
		P.RULE_whereClause,
		P.RULE_aggregationClause,
		P.RULE_havingClause,
		P.RULE_qualifyClause,
	]);

	// The top-level projections are the direct children of the select's namedExpressionSeq.
	const selectClause = clauses.get(P.RULE_selectClause);
	const seq = selectClause ? directChildrenOfRule(selectClause, P.RULE_namedExpressionSeq)[0] : undefined;
	const projections = seq ? directChildrenOfRule(seq, P.RULE_namedExpression).map(buildProjection) : [];

	const fromClause = clauses.get(P.RULE_fromClause);
	const from: Source[] = fromClause ? topRelationPrimaries(fromClause).map(buildSource) : [];
	if (fromClause) from.push(...extractLateralViews(fromClause));

	// Subqueries in expressions (not the FROM): exclude the FROM sources' own query nodes.
	const fromSubqueryNodes = new Set<ParserRuleContext>();
	for (const s of from) {
		if (s.kind === "subquery") {
			const q = firstOfRule(s.cst, P.RULE_query);
			if (q) fromSubqueryNodes.add(q);
		}
	}
	const subqueries = extractExpressionSubqueries(querySpec, fromSubqueryNodes);

	const whereCtx = clauses.get(P.RULE_whereClause);
	const where = whereCtx ? lowerClausePredicate(whereCtx) : undefined;
	const groupByCtx = clauses.get(P.RULE_aggregationClause);
	const groupBy = groupByCtx ? extractGroupBy(groupByCtx) : undefined;
	const havingCtx = clauses.get(P.RULE_havingClause);
	const having = havingCtx ? lowerClausePredicate(havingCtx) : undefined;
	// qualifyClause: QUALIFY booleanExpression — filters on window results (Databricks SQL).
	const qualifyCtx = clauses.get(P.RULE_qualifyClause);
	const qualify = qualifyCtx ? lowerClausePredicate(qualifyCtx) : undefined;

	const joinConditions = fromClause ? extractJoinConditions(fromClause) : [];

	const aggregated =
		(groupBy !== undefined && groupBy.length > 0) ||
		projections.some((p) => hasAggregate(p.expr)) ||
		(having !== undefined && hasAggregate(having));

	// `columns` is derived from the modelled Expr trees — the single source of truth.
	// (ORDER BY columns are appended in lowerQuery, since ORDER BY lives on the QueryExpr.)
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
		pivot: fromClause ? extractPivot(fromClause) : undefined,
		unpivot: fromClause ? extractUnpivot(fromClause) : undefined,
		cst: querySpec,
	};
}

/** ON predicates (joinCriteria -> ON booleanExpression) at this query level, lowered. */
function extractJoinConditions(fromClause: ParserRuleContext): Expr[] {
	return shallowNodesOfRule(fromClause, P.RULE_joinCriteria)
		.map((jc) => firstOfRule(jc, P.RULE_booleanExpression))
		.filter((b): b is ParserRuleContext => b !== undefined)
		.map(lowerExpression);
}

/** GROUP BY keys — every grouping expression, including each one inside ROLLUP / CUBE /
 *  GROUPING SETS (all of which bottom out at `expression` nodes). Collects the outermost
 *  expressions without descending into a nested subquery. */
function extractGroupBy(aggregationClause: ParserRuleContext): Expr[] {
	return shallowNodesOfRule(aggregationClause, P.RULE_expression).map(lowerExpression);
}

/** Lower the boolean expression inside a WHERE/HAVING clause. */
function lowerClausePredicate(clause: ParserRuleContext): Expr | undefined {
	const inner = firstOfRule(clause, P.RULE_booleanExpression);
	return inner ? lowerExpression(inner) : undefined;
}

/** True if an expression contains an aggregate function anywhere. */
function hasAggregate(expr: Expr): boolean {
	switch (expr.kind) {
		case "function":
			// An aggregate used as a window function (sum(x) OVER …) does not aggregate the query.
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
		case "lambda":
			return hasAggregate(expr.body);
		case "subscript":
			return hasAggregate(expr.base) || hasAggregate(expr.index);
		default:
			return false;
	}
}

/** Top-level nested queries that are NOT FROM sources — scalar/IN/EXISTS subqueries in expressions. */
function extractExpressionSubqueries(
	querySpec: ParserRuleContext,
	fromSourceQueries: Set<ParserRuleContext>,
): QueryExpr[] {
	const out: QueryExpr[] = [];
	const walk = (n: ParseTree) => {
		for (let i = 0; i < n.getChildCount(); i++) {
			const child = n.getChild(i);
			if (!(child instanceof ParserRuleContext)) continue;
			if (child.ruleIndex === P.RULE_query) {
				if (!fromSourceQueries.has(child)) out.push(lowerQuery(child));
				continue; // never descend into a query — it is its own scope
			}
			walk(child);
		}
	};
	walk(querySpec);
	return out;
}

/** Collect rule nodes within `node` but not inside nested subqueries (and don't descend into matches). */
function shallowNodesOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	const walk = (n: ParseTree) => {
		for (let i = 0; i < n.getChildCount(); i++) {
			const child = n.getChild(i);
			if (!(child instanceof ParserRuleContext)) continue;
			if (child.ruleIndex === ruleIndex) out.push(child);
			else if (child.ruleIndex === P.RULE_query)
				continue; // subquery — its own scope
			else walk(child);
		}
	};
	walk(node);
	return out;
}

function extractLateralViews(fromClause: ParserRuleContext): LateralViewSource[] {
	// pivot/unpivot/lateral attach under relation -> relationExtension, not directly to fromClause.
	return shallowNodesOfRule(fromClause, P.RULE_lateralView).map((lv) => {
		// children: qualifiedName (the function) then tblName=identifier then AS colName=identifier*
		const ids = directChildrenOfRule(lv, P.RULE_identifier);
		return {
			kind: "lateral",
			alias: ids[0]?.getText(),
			aliasCst: ids[0],
			columns: ids.slice(1).map((i) => i.getText()),
			cst: lv,
		};
	});
}

function extractPivot(fromClause: ParserRuleContext): PivotInfo | undefined {
	const pivotClause = shallowNodesOfRule(fromClause, P.RULE_pivotClause)[0];
	if (!pivotClause) return undefined;
	const values = collectOfRule(pivotClause, P.RULE_pivotValue).map((pv) => {
		const alias = directChildrenOfRule(pv, P.RULE_errorCapturingIdentifier)[0];
		return alias ? alias.getText() : pv.getText();
	});
	const pivotColumn = directChildrenOfRule(pivotClause, P.RULE_pivotColumn)[0];
	const forColumns = pivotColumn
		? directChildrenOfRule(pivotColumn, P.RULE_errorCapturingIdentifier).map((i) => i.getText())
		: [];
	const aggregates = directChildrenOfRule(pivotClause, P.RULE_namedExpressionSeq)[0];
	const aggRefs: ColumnRef[] = [];
	if (aggregates) cstColumnRefs(aggregates, aggRefs, "projection");
	const aggColumns = aggRefs.map((r) => r.parts[r.parts.length - 1]);
	return { values, forColumns, aggColumns };
}

function extractUnpivot(fromClause: ParserRuleContext): UnpivotInfo | undefined {
	const unpivotClause = shallowNodesOfRule(fromClause, P.RULE_unpivotClause)[0];
	if (!unpivotClause) return undefined;
	return {
		valueColumn: firstOfRule(unpivotClause, P.RULE_unpivotValueColumn)?.getText() ?? "",
		nameColumn: firstOfRule(unpivotClause, P.RULE_unpivotNameColumn)?.getText() ?? "",
		removed: collectOfRule(unpivotClause, P.RULE_unpivotColumn).map((c) => lastNamePart(c.getText())),
	};
}

function lastNamePart(text: string): string {
	const dot = text.lastIndexOf(".");
	return dot >= 0 ? text.slice(dot + 1) : text;
}

function collectOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	for (const d of descendants(node)) if (d.ruleIndex === ruleIndex) out.push(d);
	return out;
}

function buildProjection(named: ParserRuleContext): Projection {
	const alias = directChildrenOfRule(named, P.RULE_errorCapturingIdentifier)[0];
	const exprCtx = directChildrenOfRule(named, P.RULE_expression)[0];
	const expr = exprCtx ? classifyExpression(exprCtx) : ({ kind: "expr" } as const);

	let name: string | undefined;
	if (alias) {
		name = alias.getText(); // explicit alias wins
	} else if (expr.kind === "column") {
		name = expr.parts[expr.parts.length - 1]; // output name is the column's last part
	}
	return {
		name,
		isStar: expr.kind === "star",
		expr: exprCtx ? lowerExpression(exprCtx) : otherExpr(named),
		cst: named,
	};
}

function otherExpr(node: ParserRuleContext): Expr {
	return { kind: "other", text: node.getText(), cst: node };
}

const AGGREGATES = new Set([
	"sum",
	"count",
	"avg",
	"mean",
	"min",
	"max",
	"first",
	"last",
	"first_value",
	"last_value",
	"stddev",
	"std",
	"stddev_pop",
	"stddev_samp",
	"variance",
	"var_pop",
	"var_samp",
	"collect_list",
	"collect_set",
	"approx_count_distinct",
	"count_if",
	"any",
	"some",
	"every",
	"any_value",
	"bool_and",
	"bool_or",
	"corr",
	"covar_pop",
	"covar_samp",
	"skewness",
	"kurtosis",
	"percentile",
	"percentile_approx",
	"approx_percentile",
	"median",
	"mode",
	"array_agg",
	"max_by",
	"min_by",
	"bit_and",
	"bit_or",
	"bit_xor",
	"grouping",
	"grouping_id",
	"histogram_numeric",
	"count_min_sketch",
	"try_sum",
	"try_avg",
	"regr_avgx",
	"regr_avgy",
	"regr_count",
	"regr_intercept",
	"regr_r2",
	"regr_slope",
	"regr_sxx",
	"regr_sxy",
	"regr_syy",
	"hll_sketch_agg",
	"hll_union_agg",
	"bitmap_construct_agg",
	"bitmap_or_agg",
]);

const EXPR_RULES = new Set([
	P.RULE_expression,
	P.RULE_booleanExpression,
	P.RULE_valueExpression,
	P.RULE_primaryExpression,
]);

/** Lower any expression CST node into a typed Expr. Unmodelled shapes become `other`, never dropped. */
function lowerExpression(node: ParserRuleContext): Expr {
	if (node instanceof ParenthesizedExpressionContext) {
		const inner = firstOfRule(node, P.RULE_expression);
		return inner ? lowerExpression(inner) : otherExpr(node);
	}
	if (node instanceof ColumnReferenceContext || node instanceof DereferenceContext) {
		const parts = columnParts(node);
		return parts ? { kind: "column", parts, cst: node } : otherExpr(node);
	}
	if (node instanceof StarContext) {
		return { kind: "star", qualifier: starQualifier(node), exclude: starExclude(node), cst: node };
	}
	if (node instanceof ConstantDefaultContext) return { kind: "literal", text: node.getText(), cst: node };
	if (node instanceof FunctionCallContext) return lowerFunction(node);
	if (node instanceof SearchedCaseContext || node instanceof SimpleCaseContext) return lowerCase(node);
	if (node instanceof CastContext || node instanceof CastByColonContext) {
		const inner = firstOfRule(node, P.RULE_expression) ?? firstOfRule(node, P.RULE_valueExpression);
		const dt = firstOfRule(node, P.RULE_dataType);
		return {
			kind: "cast",
			expr: inner ? lowerExpression(inner) : otherExpr(node),
			typeText: dt?.getText() ?? "",
			cst: node,
		};
	}
	if (node instanceof SubqueryExpressionContext) {
		const q = firstOfRule(node, P.RULE_query);
		return q ? { kind: "subquery", query: lowerQuery(q), cst: node } : otherExpr(node);
	}
	if (node instanceof ExistsContext) {
		const q = firstOfRule(node, P.RULE_query);
		return q ? { kind: "exists", query: lowerQuery(q), cst: node } : otherExpr(node);
	}
	if (node instanceof PredicatedContext) {
		// `valueExpression predicate?` — only the form WITH a predicate is a predicate node;
		// a bare wrapper (no predicate) falls through to the soleExprChild recursion below.
		const pred = directChildrenOfRule(node, P.RULE_predicate)[0];
		if (pred) return lowerPredicated(node, pred);
	}
	// Special-form functions whose first argument is a time-unit keyword, plus the niladic
	// CURRENT_* keywords — all modelled as ordinary function calls.
	if (node instanceof TimestampaddContext || node instanceof TimestampdiffContext) {
		return lowerTimestampFn(node);
	}
	if (node instanceof CurrentLikeContext) {
		return {
			kind: "function",
			name: leadingTokenText(node),
			args: [],
			aggregate: false,
			distinct: false,
			cst: node,
		};
	}
	if (node instanceof LambdaContext) {
		const bodyCtx = directChildrenOfRule(node, P.RULE_expression)[0];
		return {
			kind: "lambda",
			params: directChildrenOfRule(node, P.RULE_identifier).map((i) => i.getText()),
			body: bodyCtx ? lowerExpression(bodyCtx) : otherExpr(node),
			cst: node,
		};
	}
	if (node instanceof SubscriptContext) {
		const base = directChildrenOfRule(node, P.RULE_primaryExpression)[0];
		const index = directChildrenOfRule(node, P.RULE_valueExpression)[0];
		return {
			kind: "subscript",
			base: base ? lowerExpression(base) : otherExpr(node),
			index: index ? lowerExpression(index) : otherExpr(node),
			cst: node,
		};
	}
	if (
		node instanceof ArithmeticBinaryContext ||
		node instanceof ComparisonContext ||
		node instanceof ShiftExpressionContext ||
		node instanceof LogicalBinaryContext
	) {
		return lowerBinary(node);
	}
	if (node instanceof ArithmeticUnaryContext || node instanceof LogicalNotContext) {
		return lowerUnary(node);
	}
	// Wrapper rule (expression, ValueExpressionDefault, Predicated with no predicate, …):
	// recurse into the single expression child if that's all there is.
	const sole = soleExprChild(node);
	return sole ? lowerExpression(sole) : otherExpr(node);
}

/** Lower a `valueExpression predicate` (PredicatedContext) into a typed predicate Expr. */
function lowerPredicated(predicated: ParserRuleContext, predicate: ParserRuleContext): Expr {
	const operandCtx = directChildrenOfRule(predicated, P.RULE_valueExpression)[0];
	const operand = operandCtx ? lowerExpression(operandCtx) : otherExpr(predicated);
	const negated = directChildrenOfRule(predicate, P.RULE_errorCapturingNot).length > 0;
	const args: Expr[] = [];
	for (let i = 0; i < predicate.getChildCount(); i++) {
		const child = predicate.getChild(i);
		if (!(child instanceof ParserRuleContext)) continue;
		if (child.ruleIndex === P.RULE_query) {
			args.push({ kind: "subquery", query: lowerQuery(child), cst: child });
		} else if (EXPR_RULES.has(child.ruleIndex)) {
			args.push(lowerExpression(child));
		}
	}
	return { kind: "predicate", op: predicateOp(predicate), negated, operand, args, cst: predicated };
}

function predicateOp(predicate: ParserRuleContext): string {
	const t = directTokenType(predicate, [
		P.BETWEEN,
		P.IN,
		P.RLIKE,
		P.LIKE,
		P.ILIKE,
		P.NULL,
		P.TRUE,
		P.FALSE,
		P.UNKNOWN,
		P.DISTINCT,
	]);
	switch (t) {
		case P.BETWEEN:
			return "between";
		case P.IN:
			return "in";
		case P.RLIKE:
			return "rlike";
		case P.LIKE:
			return "like";
		case P.ILIKE:
			return "ilike";
		case P.NULL:
			return "null";
		case P.TRUE:
			return "true";
		case P.FALSE:
			return "false";
		case P.UNKNOWN:
			return "unknown";
		case P.DISTINCT:
			return "distinct from";
		default:
			return "";
	}
}

/** Lower a date_add/datediff-style special form (time-unit keyword + value args) as a function call. */
function lowerTimestampFn(node: ParserRuleContext): Expr {
	const args: Expr[] = [];
	const unit = directChildrenOfRule(node, P.RULE_datetimeUnit)[0] ?? directChildrenOfRule(node, P.RULE_stringLit)[0];
	if (unit) args.push({ kind: "literal", text: unit.getText(), cst: unit });
	for (const ve of directChildrenOfRule(node, P.RULE_valueExpression)) args.push(lowerExpression(ve));
	return { kind: "function", name: leadingTokenText(node), args, aggregate: false, distinct: false, cst: node };
}

/** The text of a node's first child token — the `name=` keyword of these labelled alternatives. */
function leadingTokenText(node: ParserRuleContext): string {
	const c = node.getChild(0);
	return c instanceof TerminalNode ? c.getText() : "";
}

/** The table parts of a qualified star `t.*` / `db.t.*`, or undefined for a bare `*`. */
function starQualifier(node: StarContext): string[] | undefined {
	const qn = directChildrenOfRule(node, P.RULE_qualifiedName)[0];
	return qn ? directChildrenOfRule(qn, P.RULE_identifier).map((i) => i.getText()) : undefined;
}

/** `* EXCEPT (a, b)` — exceptClause: EXCEPT '(' multipartIdentifierList ')'. */
function starExclude(node: StarContext): string[] | undefined {
	const except = directChildrenOfRule(node, P.RULE_exceptClause)[0];
	if (!except) return undefined;
	const cols = collectOfRule(except, P.RULE_multipartIdentifier).map((m) => m.getText());
	return cols.length ? cols : undefined;
}

/** The single expression-rule child of `node`, if `node` is just a wrapper (no operator/predicate). */
function soleExprChild(node: ParserRuleContext): ParserRuleContext | undefined {
	let found: ParserRuleContext | undefined;
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof ParserRuleContext) {
			if (!EXPR_RULES.has(child.ruleIndex)) return undefined; // a predicate/other rule — not a wrapper
			if (found) return undefined;
			found = child;
		} else {
			return undefined; // a terminal (operator) — not a plain wrapper
		}
	}
	return found;
}

function lowerBinary(node: ParserRuleContext): Expr {
	const operands: ParserRuleContext[] = [];
	const op: string[] = [];
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof ParserRuleContext && EXPR_RULES.has(child.ruleIndex)) operands.push(child);
		else if (child) op.push(child.getText());
	}
	if (operands.length !== 2) return otherExpr(node);
	return {
		kind: "binary",
		op: op.join(" ").trim(),
		left: lowerExpression(operands[0]),
		right: lowerExpression(operands[1]),
		cst: node,
	};
}

function lowerUnary(node: ParserRuleContext): Expr {
	let operand: ParserRuleContext | undefined;
	const op: string[] = [];
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof ParserRuleContext && EXPR_RULES.has(child.ruleIndex)) operand = child;
		else if (child) op.push(child.getText());
	}
	return operand
		? { kind: "unary", op: op.join(" ").trim(), operand: lowerExpression(operand), cst: node }
		: otherExpr(node);
}

function lowerFunction(node: FunctionCallContext): Expr {
	const name = firstOfRule(node, P.RULE_functionName)?.getText() ?? "";
	const args = directChildrenOfRule(node, P.RULE_functionArgument).map((a) => {
		const e = firstOfRule(a, P.RULE_expression);
		return e ? lowerExpression(e) : otherExpr(a);
	});
	const windowCtx = firstOfRule(node, P.RULE_windowSpec);
	return {
		kind: "function",
		name,
		args,
		aggregate: AGGREGATES.has(name.toLowerCase()),
		distinct: directTokenType(node, [P.DISTINCT]) !== undefined,
		window: windowCtx ? lowerWindow(windowCtx) : undefined,
		cst: node,
	};
}

function lowerWindow(windowSpec: ParserRuleContext): WindowSpec {
	const sortItems = collectOfRule(windowSpec, P.RULE_sortItem);
	const orderBy = sortItems.map((si) => {
		const e = firstOfRule(si, P.RULE_expression);
		return e ? lowerExpression(e) : otherExpr(si);
	});
	// PARTITION BY expressions are the top-level expressions not inside a sortItem (ORDER BY).
	const partitionBy: Expr[] = [];
	const walk = (n: ParseTree) => {
		for (let i = 0; i < n.getChildCount(); i++) {
			const child = n.getChild(i);
			if (!(child instanceof ParserRuleContext)) continue;
			if (child.ruleIndex === P.RULE_sortItem) continue;
			if (child.ruleIndex === P.RULE_expression) {
				partitionBy.push(lowerExpression(child));
				continue;
			}
			walk(child);
		}
	};
	walk(windowSpec);
	return { partitionBy, orderBy, cst: windowSpec };
}

function lowerCase(node: ParserRuleContext): Expr {
	const whens = collectOfRule(node, P.RULE_whenClause).map((wc) => {
		const exprs = directChildrenOfRule(wc, P.RULE_expression);
		return {
			when: exprs[0] ? lowerExpression(exprs[0]) : otherExpr(wc),
			then: exprs[1] ? lowerExpression(exprs[1]) : otherExpr(wc),
		};
	});
	// The ELSE expression is a direct `expression` child of the case node (not inside a whenClause).
	const elseCtx = directChildrenOfRule(node, P.RULE_expression).at(-1);
	return { kind: "case", whens, elseExpr: elseCtx ? lowerExpression(elseCtx) : undefined, cst: node };
}

type ClassifiedExpr = { kind: "column"; parts: string[] } | { kind: "star" } | { kind: "expr" };

/**
 * Decide, from the tree, whether a select expression is a plain column reference
 * (`a`, `t.a`, `a.b.c`), a star (`*`, `t.*`), or a compound expression. Descends
 * through the single-child expression wrappers; any branching (an operator, a
 * call, a predicate) means it is not a bare column/star.
 */
function classifyExpression(expr: ParserRuleContext): ClassifiedExpr {
	let node: ParserRuleContext = expr;
	while (!(node instanceof PrimaryExpressionContext)) {
		if (node.getChildCount() !== 1) return { kind: "expr" };
		const only = node.getChild(0);
		if (!(only instanceof ParserRuleContext)) return { kind: "expr" };
		node = only;
	}
	if (node instanceof StarContext) return { kind: "star" };
	const parts = columnParts(node);
	return parts ? { kind: "column", parts } : { kind: "expr" };
}

/** Collect column references out of a modelled Expr tree. The single source of truth for
 *  `SelectExpr.columns`. Stops at nested subqueries (their columns belong to that scope);
 *  for an unmodelled `other` node, falls back to a CST walk so its columns are not lost. */
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
		case "lambda": {
			// The body may close over outer columns, but a reference to a lambda PARAM is a local —
			// it must not leak as a (table) column. Collect the body's refs, then drop the params.
			const inner: ColumnRef[] = [];
			columnsOf(expr.body, inner, clause);
			const params = new Set(expr.params.map((p) => p.toLowerCase()));
			for (const ref of inner) {
				if (!params.has((ref.parts[0] ?? "").toLowerCase())) acc.push(ref);
			}
			break;
		}
		case "subscript":
			columnsOf(expr.base, acc, clause);
			columnsOf(expr.index, acc, clause);
			break;
		case "other":
			cstColumnRefs(expr.cst, acc, clause);
			break;
		// literal, star, subquery, exists → no column refs at this level
	}
}

/** Fallback: collect maximal column paths from a CST subtree (stops at nested subqueries).
 *  Used only to recover columns inside an unmodelled `other` Expr node. */
function cstColumnRefs(node: ParseTree, acc: ColumnRef[], clause: Clause): void {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (!(child instanceof ParserRuleContext)) continue;
		if (child.ruleIndex === P.RULE_query) continue;
		if (child instanceof ColumnReferenceContext || child instanceof DereferenceContext) {
			const parts = columnParts(child);
			if (parts) {
				acc.push({ parts, clause, cst: child });
				continue;
			}
		}
		cstColumnRefs(child, acc, clause);
	}
}

/** The identifier parts of a column-reference primaryExpression, or undefined if it isn't one. */
function columnParts(primary: PrimaryExpressionContext): string[] | undefined {
	if (primary instanceof ColumnReferenceContext) {
		return [primary.identifier().getText()];
	}
	if (primary instanceof DereferenceContext) {
		const base = columnParts(primary.primaryExpression()); // base must itself be a column path
		if (!base) return undefined;
		return [...base, primary.identifier().getText()];
	}
	return undefined;
}

/**
 * The relationPrimary nodes belonging to THIS query level. Stops at each
 * relationPrimary instead of descending into it, so a derived table's inner
 * tables are not mistaken for sources of the outer query.
 */
function topRelationPrimaries(node: ParseTree): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	const walk = (n: ParseTree) => {
		for (let i = 0; i < n.getChildCount(); i++) {
			const child = n.getChild(i);
			if (!(child instanceof ParserRuleContext)) continue;
			if (child.ruleIndex === P.RULE_relationPrimary) out.push(child);
			else if (child.ruleIndex === P.RULE_query)
				continue; // a subquery in an ON/WHERE — not a source
			else walk(child);
		}
	};
	walk(node);
	return out;
}

function buildSource(relationPrimary: ParserRuleContext): Source {
	const tableAlias = directChildrenOfRule(relationPrimary, P.RULE_tableAlias)[0];
	const aliasCst = tableAlias ? firstOfRule(tableAlias, P.RULE_strictIdentifier) : undefined;
	const alias = aliasCst?.getText();
	const columnAliases = tableAlias ? columnAliasList(tableAlias) : undefined;

	// A derived table: `( query ) alias`.
	const innerQuery = firstOfRule(relationPrimary, P.RULE_query);
	if (innerQuery) {
		return {
			kind: "subquery",
			query: lowerQuery(innerQuery),
			alias,
			aliasCst,
			columnAliases,
			cst: relationPrimary,
		};
	}

	const multipart = firstOfRule(relationPrimary, P.RULE_multipartIdentifier);
	const parts = multipart
		? directChildrenOfRule(multipart, P.RULE_errorCapturingIdentifier).map((p) => p.getText())
		: [];
	return {
		kind: "table",
		name: parts.length ? parts : multipart ? [multipart.getText()] : [],
		alias,
		aliasCst,
		columnAliases,
		cst: relationPrimary,
	};
}
