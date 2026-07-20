import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import { GoogleSQLParser as P } from "../generated/bigquery/GoogleSQLParser.js";
import type {
	Clause,
	ColumnRef,
	CteDef,
	Expr,
	GraphElement,
	GraphTableSource,
	Join,
	JoinKind,
	LimitInfo,
	PipeBranch,
	PipeExpr,
	PipeSetItem,
	PipeStage,
	PivotInfo,
	Projection,
	QueryBody,
	QueryExpr,
	SelectExpr,
	Source,
	UnpivotInfo,
	UnsupportedFlag,
} from "../ir/ir.js";
import { keywordCategory, swallowedCategories, swallowedStatements, type StatementCategory } from "../ir/statement.js";
import { partSpanOf, partSpansOf } from "../ir/part-span.js";
import { freezeIR } from "../ir/freeze.js";
import { synthesizedQualifiedName, type QualifiedName } from "../ir/qualified-name.js";
import { BIGQUERY_NAME_CONFIG } from "./fold.js";

/** The structured name for a table source's parts (issue #38). BigQuery's lower() strips
 *  backtick delimiters from every identifier (the documented exception in
 *  docs/identifier-delimiter-contract.md), so parts arrive BARE: the synthesized builder is the
 *  correct one (identity is unaffected — quoted and unquoted fold identically in this dialect),
 *  and `fqn` re-renders quoting only where a part needs it. The byte-exact written form stays
 *  recoverable via namePartSpans, per the contract's own remedy. */
function relationOf(rawParts: string[]): QualifiedName {
	return synthesizedQualifiedName(rawParts, BIGQUERY_NAME_CONFIG);
}

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
	const q = lowerImpl(tree);
	q.dialect = "bigquery";
	return freezeIR(q);
}

function lowerImpl(tree: ParserRuleContext): QueryExpr {
	const statement = statementCategory(tree);
	if (statement === "query") {
		const qs = firstOfRule(tree, P.RULE_query_statement);
		if (qs) {
			const lowered = lowerQueryStatement(qs);
			lowered.statement = "query";
			return lowered;
		}
	}
	// Standalone GQL: `GRAPH g MATCH … RETURN …` — a relation-producing graph query.
	const gql = firstOfRule(tree, P.RULE_gql_statement);
	if (gql) {
		const lowered = lowerGqlStatement(gql);
		lowered.statement = "query";
		return lowered;
	}
	// A multi-statement batch is a flagged compound. Anchor its span to the FIRST statement body,
	// NOT the whole `root` container (which reaches EOF): a whole-file span on a flagged body makes a
	// downstream AST index read a bogus enclosure over statements 2..n. Bounding to statement 1 keeps
	// the span honest — the "compound" kind already tells a consumer this is an unmodelled batch
	// (issue #21). Single-statement and empty inputs keep `tree` (byte-identical). A batch (healthy
	// or recovery-swallowed) flags "multi-statement"; a wholly-unparsed statement flags "broken".
	const bodies = sqlStatementBodies(tree);
	const cst = bodies.length > 1 ? bodies[0] : tree;
	const reason =
		statement === "compound"
			? "multi-statement"
			: statement === "other"
				? swallowedStatements(tree) > 0
					? "broken"
					: "empty"
				: "non-query";
	const q = emptyQuery(cst, reason);
	q.statement = statement;
	return q;
}

// --- statement category ---------------------------------------------------------

function statementCategory(tree: ParserRuleContext): StatementCategory {
	const cats = statementCategories(tree);
	if (cats.length === 0) return "other";
	if (cats.length > 1) return "compound";
	return cats[0];
}

/** The `sql_statement_body` nodes under `root`, in source order. Script statements (DECLARE/IF/LOOP/…)
 *  and DEFINE MACRO carry no `sql_statement_body`, so they contribute nothing here (as before). */
function sqlStatementBodies(tree: ParserRuleContext): ParserRuleContext[] {
	// stmts → top_statement → (define_macro_statement | unterminated_statement); an
	// unterminated_statement → (unterminated_sql_statement | unterminated_script_statement).
	const bodies: ParserRuleContext[] = [];
	for (const s of directChildrenOfRule(tree, P.RULE_stmts)) {
		for (const tp of directChildrenOfRule(s, P.RULE_top_statement)) {
			for (const ut of directChildrenOfRule(tp, P.RULE_unterminated_statement)) {
				for (const u of directChildrenOfRule(ut, P.RULE_unterminated_sql_statement)) {
					bodies.push(...directChildrenOfRule(u, P.RULE_sql_statement_body));
				}
			}
		}
	}
	return bodies;
}

/** Per-statement categories for every top-level SQL statement body in a parsed `root`, in source
 *  order — the file-level view behind statementCategory (which folds >1 into "compound"), using the
 *  same `bodyCategory` per element. Parity with the other dialects; feeds the corpus reclassifier. */
export function statementCategories(tree: ParserRuleContext): StatementCategory[] {
	// Recovery-swallowed statements append as "other" — honest count, no keyword guessing.
	return [...sqlStatementBodies(tree).map(bodyCategory), ...swallowedCategories(tree)];
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

/** query_statement: query. */
function lowerQueryStatement(qs: ParserRuleContext): QueryExpr {
	return lowerQueryNode(firstOfRule(qs, P.RULE_query), qs);
}

/**
 * Lower a `query` node — `query_without_pipe_operators pipe_operator*`. `cst` is the span to record on
 * the QueryExpr (the enclosing query_statement at top level, else the query itself). When pipe operators
 * follow the base, the body becomes a PipeExpr: the base relation plus an ordered list of faithful
 * PipeStage nodes (the base ORDER BY / LIMIT, which sit inside query_without_pipe_operators and apply to
 * the input, lead as orderBy/limit stages). No pipes → the plain base body, with ORDER BY / LIMIT on the
 * QueryExpr as before.
 */
function lowerQueryNode(query: ParserRuleContext | undefined, cst: ParserRuleContext): QueryExpr {
	const qwpo = query ? directChildrenOfRule(query, P.RULE_query_without_pipe_operators)[0] : undefined;
	if (!query || !qwpo) return emptyQuery(cst, "non-query");

	const withClause = directChildrenOfRule(qwpo, P.RULE_with_clause)[0];
	// with_clause → with_clause_entry → aliased_query (the GROUP ROWS entry form has no aliased_query).
	const ctes = withClause
		? directChildrenOfRule(withClause, P.RULE_with_clause_entry)
				.flatMap((e) => directChildrenOfRule(e, P.RULE_aliased_query))
				.map(lowerCte)
		: [];

	const qpos = directChildrenOfRule(qwpo, P.RULE_query_primary_or_set_operation)[0];
	const fromQuery = directChildrenOfRule(qwpo, P.RULE_from_query)[0];
	const base = qpos
		? lowerPrimaryOrSetOp(qpos)
		: fromQuery
			? buildFromQuery(fromQuery)
			: emptyBody(qwpo, "non-query");

	const orderByClause = directChildrenOfRule(qwpo, P.RULE_order_by_clause)[0];
	const orderBy = orderByClause ? extractOrderBy(orderByClause) : undefined;
	const limitClause = directChildrenOfRule(qwpo, P.RULE_limit_offset_clause)[0];
	const limit = limitClause ? extractLimit(limitClause) : undefined;

	const pipeOps = directChildrenOfRule(query, P.RULE_pipe_operator);
	if (pipeOps.length > 0) {
		const stages: PipeStage[] = [];
		if (orderBy && orderByClause) stages.push(makeOrderByStage(orderBy, orderByClause));
		if (limit && limitClause) stages.push({ op: "limit", limit, cst: limitClause });
		for (const po of pipeOps) stages.push(lowerPipeOperator(po));
		const body: PipeExpr = { kind: "pipe", input: base, stages, cst: query };
		return { kind: "query", ctes, body, cst };
	}

	if (orderBy && base.kind !== "pipe") for (const o of orderBy) columnsOf(o, base.columns, "orderBy");
	return { kind: "query", ctes, body: base, orderBy, limit, cst };
}

/** aliased_query: identifier AS parenthesized_query opt_aliased_query_modifiers? */
function lowerCte(aq: ParserRuleContext): CteDef {
	const name = directChildrenOfRule(aq, P.RULE_identifier)[0];
	const paren = directChildrenOfRule(aq, P.RULE_parenthesized_query)[0];
	return {
		name: name ? identText(name) : "",
		nameCst: name,
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

/** query_primary: select | TABLE path | parenthesized_query opt_as_alias_with_required_as? */
function lowerQueryPrimary(primary: ParserRuleContext): QueryBody {
	const select = directChildrenOfRule(primary, P.RULE_select)[0];
	if (select) return buildSelect(select);
	const paren = directChildrenOfRule(primary, P.RULE_parenthesized_query)[0];
	if (paren) return lowerParenthesizedQuery(paren).body;
	// `TABLE name` ≡ `SELECT * FROM name`.
	const path = directChildrenOfRule(primary, P.RULE_path_expression)[0];
	if (path) {
		const name = pathParts(path);
		return {
			kind: "select",
			projections: [implicitStar(primary)],
			from: [{ kind: "table", relation: relationOf(name), namePartSpans: pathPartSpans(path), cst: path }],
			columns: [],
			aggregated: false,
			cst: primary,
		};
	}
	return emptyBody(primary, "non-query");
}

/** from_query: from_clause — a bare FROM (no SELECT), implicitly `SELECT * FROM …`. */
function buildFromQuery(fromQuery: ParserRuleContext): SelectExpr {
	const unsupported: UnsupportedFlag[] = [];
	const fromClause = directChildrenOfRule(fromQuery, P.RULE_from_clause)[0];
	const fromContents = fromClause ? directChildrenOfRule(fromClause, P.RULE_from_clause_contents)[0] : undefined;
	const from = fromContents ? buildSources(fromContents, unsupported) : [];
	const joinConditions: Expr[] = [];
	const onByCst = new Map<ParserRuleContext, Expr>();
	if (fromContents) extractJoinConditions(fromContents, joinConditions, onByCst);
	const joins = fromContents ? buildJoins(fromContents, from, onByCst) : [];
	const columns: ColumnRef[] = [];
	for (const j of joinConditions) columnsOf(j, columns, "join");
	// A bare FROM-query (`FROM t`) is implicitly `SELECT * FROM t` — carry the star so its outputs expand.
	return {
		kind: "select",
		projections: [implicitStar(fromQuery)],
		from,
		columns,
		joinConditions: joinConditions.length ? joinConditions : undefined,
		joins: joins.length ? joins : undefined,
		aggregated: false,
		unsupported: unsupported.length ? unsupported : undefined,
		cst: fromQuery,
	};
}

/** An implicit `SELECT *` projection for a bare FROM-query or `TABLE name` (both ≡ SELECT * FROM …). */
function implicitStar(cst: ParserRuleContext): Projection {
	return { name: undefined, isStar: true, expr: { kind: "star", cst }, cst };
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
		const t = typeNode
			? directTokenType(typeNode, [P.UNION_SYMBOL, P.EXCEPT_SYMBOL, P.INTERSECT_SYMBOL])
			: undefined;
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
	if (query) return lowerQueryNode(query, query);
	return emptyQuery(paren, "non-query");
}

// --- pipe operators --------------------------------------------------------------
// pipe_operator: PIPE_SYMBOL (pipe_where | pipe_select | …). Each operator lowers to a faithful
// PipeStage keeping its `|> OPERATOR …` span (cst = the pipe_operator node). No operator is dropped.

/** An ORDER BY (base or `|> ORDER BY`) as a pipe stage. */
function makeOrderByStage(keys: Expr[], cst: ParserRuleContext): PipeStage {
	const columns: ColumnRef[] = [];
	for (const k of keys) columnsOf(k, columns, "orderBy");
	return { op: "orderBy", keys, columns, cst };
}

/** select_clause → its projection list (shared with buildSelect's path). */
function projectionsOfSelectClause(sc: ParserRuleContext | undefined): Projection[] {
	const selectList = sc ? directChildrenOfRule(sc, P.RULE_select_list)[0] : undefined;
	return selectList ? directChildrenOfRule(selectList, P.RULE_select_list_item).map(buildProjection) : [];
}

/** pipe_selection_item_list → projections (pipe_selection_item is select_column_expr|dot_star, which
 *  buildProjection already handles). */
function projectionsOfSelectionList(list: ParserRuleContext | undefined): Projection[] {
	return list ? directChildrenOfRule(list, P.RULE_pipe_selection_item).map(buildProjection) : [];
}

function projectionColumns(projections: Projection[]): ColumnRef[] {
	const columns: ColumnRef[] = [];
	for (const p of projections) columnsOf(p.expr, columns, "projection");
	return columns;
}

/** as_alias → its identifier text, if present. */
function asAliasText(node: ParserRuleContext | undefined): string | undefined {
	if (!node) return undefined;
	const id = firstOfRule(node, P.RULE_identifier);
	return id ? identText(id) : undefined;
}

/** A (maybe-dashed) path target → its name parts (best-effort; a dashed path keeps its joined text). */
function dashedPathPartsOf(ctx: ParserRuleContext): string[] {
	const path = firstOfRule(ctx, P.RULE_path_expression);
	if (path) return pathParts(path);
	const dashed = firstOfRule(ctx, P.RULE_dashed_path_expression);
	return dashed ? [dashed.getText()] : [];
}

/** subpipeline: '(' pipe_operator* ')'. */
function lowerSubpipeline(sp: ParserRuleContext): PipeStage[] {
	return directChildrenOfRule(sp, P.RULE_pipe_operator).map(lowerPipeOperator);
}

/** subquery_or_subpipeline → a QueryExpr (a subpipeline becomes a pipe with an implicit input). */
function lowerSubqueryOrSubpipeline(node: ParserRuleContext | undefined, fallbackCst: ParserRuleContext): QueryExpr {
	if (!node) return emptyQuery(fallbackCst, "non-query");
	const paren = directChildrenOfRule(node, P.RULE_parenthesized_query)[0];
	if (paren) return lowerParenthesizedQuery(paren);
	const sp = directChildrenOfRule(node, P.RULE_subpipeline)[0];
	if (sp) {
		const body: PipeExpr = {
			kind: "pipe",
			input: emptyBody(sp, "non-query"),
			stages: lowerSubpipeline(sp),
			cst: sp,
		};
		return { kind: "query", ctes: [], body, cst: sp };
	}
	return emptyQuery(node, "non-query");
}

/** pipe_set_operation_operand: parenthesized_query | table_clause. */
function lowerPipeSetOperand(operand: ParserRuleContext): QueryExpr {
	const paren = directChildrenOfRule(operand, P.RULE_parenthesized_query)[0];
	if (paren) return lowerParenthesizedQuery(paren);
	const tc = directChildrenOfRule(operand, P.RULE_table_clause)[0];
	if (tc) {
		// table_clause: TABLE path_expression | TABLE tvf — `TABLE name` ≡ `SELECT * FROM name`.
		const path = directChildrenOfRule(tc, P.RULE_path_expression)[0];
		const name = path ? pathParts(path) : undefined;
		const body: SelectExpr = {
			kind: "select",
			projections: path ? [implicitStar(tc)] : [],
			from:
				path && name
					? [
							{
								kind: "table",
								relation: relationOf(name),
								namePartSpans: pathPartSpans(path),
								cst: path,
							},
						]
					: [],
			columns: [],
			aggregated: false,
			cst: tc,
		};
		return { kind: "query", ctes: [], body, cst: tc };
	}
	return emptyQuery(operand, "non-query");
}

/** pipe_aggregate: AGGREGATE pipe_aggregate_item_list? pipe_group_by_clause? */
function lowerPipeAggregate(agg: ParserRuleContext, cst: ParserRuleContext): PipeStage {
	const list = directChildrenOfRule(agg, P.RULE_pipe_aggregate_item_list)[0];
	const aggregates: Projection[] = list
		? directChildrenOfRule(list, P.RULE_pipe_aggregate_item).flatMap((it) => {
				const si = directChildrenOfRule(it, P.RULE_pipe_selection_item)[0];
				return si ? [buildProjection(si)] : [];
			})
		: [];
	const gbClause = directChildrenOfRule(agg, P.RULE_pipe_group_by_clause)[0];
	const groupBy: Expr[] = [];
	if (gbClause)
		for (const gi of directChildrenOfRule(gbClause, P.RULE_grouping_item_in_pipe)) {
			for (const e of collectOfRule(gi, P.RULE_expression)) groupBy.push(lowerExpr(e));
		}
	const columns: ColumnRef[] = projectionColumns(aggregates);
	for (const g of groupBy) columnsOf(g, columns, "groupBy");
	return { op: "aggregate", aggregates, groupBy, columns, cst };
}

/** pipe_join: opt_natural? join_type? join_hint? JOIN hint? table_primary on_or_using_clause? */
function lowerPipeJoin(join: ParserRuleContext, cst: ParserRuleContext): PipeStage {
	const unsupported: UnsupportedFlag[] = [];
	const out: Source[] = [];
	const tp = directChildrenOfRule(join, P.RULE_table_primary)[0];
	if (tp) collectTablePrimary(tp, out, unsupported);
	const source: Source = out[0] ?? { kind: "table", relation: relationOf([]), cst: join };
	const joinConditions: Expr[] = [];
	const columns: ColumnRef[] = [];
	const onUsing = directChildrenOfRule(join, P.RULE_on_or_using_clause)[0];
	const onClause = onUsing ? directChildrenOfRule(onUsing, P.RULE_on_clause)[0] : undefined;
	const onExpr = onClause ? directChildrenOfRule(onClause, P.RULE_expression)[0] : undefined;
	if (onExpr) {
		const ex = lowerExpr(onExpr);
		joinConditions.push(ex);
		columnsOf(ex, columns, "join");
	}
	return { op: "join", source, joinConditions: joinConditions.length ? joinConditions : undefined, columns, cst };
}

/** pipe_set_operation: set_operation_metadata pipe_set_operation_operand (, operand)*. */
function lowerPipeSetOperation(setop: ParserRuleContext, cst: ParserRuleContext): PipeStage {
	const meta = directChildrenOfRule(setop, P.RULE_set_operation_metadata)[0];
	const typeNode = meta ? directChildrenOfRule(meta, P.RULE_query_set_operation_type)[0] : undefined;
	const t = typeNode ? directTokenType(typeNode, [P.UNION_SYMBOL, P.EXCEPT_SYMBOL, P.INTERSECT_SYMBOL]) : undefined;
	const setOp = t === P.INTERSECT_SYMBOL ? "intersect" : t === P.EXCEPT_SYMBOL ? "except" : "union";
	const all = meta !== undefined && hasTokenDeep(meta, P.ALL_SYMBOL);
	const byName = meta !== undefined && hasTokenDeep(meta, P.NAME_SYMBOL);
	const operands = directChildrenOfRule(setop, P.RULE_pipe_set_operation_operand).map(lowerPipeSetOperand);
	return { op: "setop", setOp, all, byName: byName || undefined, operands, cst };
}

/** pipe_if: IF expr THEN subpipeline pipe_if_elseif* (ELSE subpipeline)?. */
function lowerPipeIf(ifOp: ParserRuleContext, cst: ParserRuleContext): PipeStage {
	const arms: PipeBranch[] = [];
	const columns: ColumnRef[] = [];
	const ifCond = directChildrenOfRule(ifOp, P.RULE_expression)[0];
	const ifSubs = directChildrenOfRule(ifOp, P.RULE_subpipeline);
	if (ifSubs[0]) {
		const cond = ifCond ? lowerExpr(ifCond) : undefined;
		if (cond) columnsOf(cond, columns, "where");
		arms.push({ condition: cond, pipeline: lowerSubpipeline(ifSubs[0]), cst: ifOp });
	}
	for (const ei of directChildrenOfRule(ifOp, P.RULE_pipe_if_elseif)) {
		const c = directChildrenOfRule(ei, P.RULE_expression)[0];
		const s = directChildrenOfRule(ei, P.RULE_subpipeline)[0];
		const cond = c ? lowerExpr(c) : undefined;
		if (cond) columnsOf(cond, columns, "where");
		arms.push({ condition: cond, pipeline: s ? lowerSubpipeline(s) : [], cst: ei });
	}
	if (ifSubs.length > 1) {
		arms.push({ pipeline: lowerSubpipeline(ifSubs[ifSubs.length - 1]), cst: ifOp });
	}
	return { op: "if", arms, columns, cst };
}

/** pipe_match_recognize → match_recognize_clause (PARTITION BY … MEASURES … PATTERN … DEFINE …). */
function lowerPipeMatchRecognize(mr: ParserRuleContext, cst: ParserRuleContext): PipeStage {
	const clause = directChildrenOfRule(mr, P.RULE_match_recognize_clause)[0];
	const partitionBy: Expr[] = [];
	const measures: Projection[] = [];
	const defines: Expr[] = [];
	if (clause) {
		const part = directChildrenOfRule(clause, P.RULE_partition_by_clause_prefix)[0];
		if (part) for (const e of directChildrenOfRule(part, P.RULE_expression)) partitionBy.push(lowerExpr(e));
		const meas = directChildrenOfRule(clause, P.RULE_select_list_prefix_with_as_aliases)[0];
		if (meas) {
			for (const it of directChildrenOfRule(meas, P.RULE_select_column_expr_with_as_alias)) {
				measures.push(projectionOfExprWithAlias(it));
			}
		}
		const defs = directChildrenOfRule(clause, P.RULE_with_expression_variable_prefix)[0];
		if (defs) {
			for (const v of directChildrenOfRule(defs, P.RULE_with_expression_variable)) {
				const e = directChildrenOfRule(v, P.RULE_expression)[0];
				if (e) defines.push(lowerExpr(e));
			}
		}
	}
	const columns: ColumnRef[] = [];
	for (const e of partitionBy) columnsOf(e, columns, "groupBy");
	for (const m of measures) columnsOf(m.expr, columns, "projection");
	for (const d of defines) columnsOf(d, columns, "where");
	return { op: "matchRecognize", partitionBy, measures, defines, columns, cst };
}

/** select_column_expr_with_as_alias: expression AS identifier. */
function projectionOfExprWithAlias(it: ParserRuleContext): Projection {
	const e = directChildrenOfRule(it, P.RULE_expression)[0];
	const id = directChildrenOfRule(it, P.RULE_identifier)[0];
	const expr = e ? lowerExpr(e) : otherExpr(it);
	const name = id ? identText(id) : expr.kind === "column" ? expr.parts[expr.parts.length - 1] : undefined;
	return { name, isStar: false, expr, ...(id ? { aliasCst: id } : {}), cst: it };
}

/** pipe_pivot: pivot_clause as_alias? → PivotInfo (best-effort column extraction). */
function pivotInfoOf(pipePivot: ParserRuleContext): PivotInfo {
	const pc = directChildrenOfRule(pipePivot, P.RULE_pivot_clause)[0];
	const aggColumns: string[] = [];
	const forColumns: string[] = [];
	const values: string[] = [];
	if (pc) {
		const aggList = directChildrenOfRule(pc, P.RULE_pivot_expression_list)[0];
		if (aggList) {
			const refs: ColumnRef[] = [];
			for (const pe of directChildrenOfRule(aggList, P.RULE_pivot_expression)) {
				const e = directChildrenOfRule(pe, P.RULE_expression)[0];
				if (e) columnsOf(lowerExpr(e), refs, "projection");
			}
			for (const r of refs) aggColumns.push(r.parts[r.parts.length - 1]);
		}
		const forExpr = directChildrenOfRule(pc, P.RULE_expression_higher_prec_than_and)[0];
		const fnp = forExpr ? exprToNameParts(forExpr) : undefined;
		if (fnp && fnp.length) forColumns.push(fnp[fnp.length - 1]);
		const valList = directChildrenOfRule(pc, P.RULE_pivot_value_list)[0];
		if (valList) {
			for (const pv of directChildrenOfRule(valList, P.RULE_pivot_value)) {
				const alias = asAliasText(directChildrenOfRule(pv, P.RULE_as_alias)[0]);
				const e = directChildrenOfRule(pv, P.RULE_expression)[0];
				values.push(alias ?? (e ? e.getText() : ""));
			}
		}
	}
	return { values, forColumns, aggColumns, alias: asAliasText(directChildrenOfRule(pipePivot, P.RULE_as_alias)[0]) };
}

/** pipe_unpivot: unpivot_clause as_alias? → UnpivotInfo (best-effort). */
function unpivotInfoOf(pipeUnpivot: ParserRuleContext): UnpivotInfo {
	const uc = directChildrenOfRule(pipeUnpivot, P.RULE_unpivot_clause)[0];
	let valueColumn = "";
	let nameColumn = "";
	const removed: string[] = [];
	if (uc) {
		const valCols = directChildrenOfRule(uc, P.RULE_path_expression_list_with_opt_parens)[0];
		const firstVal = valCols ? firstOfRule(valCols, P.RULE_path_expression) : undefined;
		if (firstVal) valueColumn = pathParts(firstVal).slice(-1)[0] ?? "";
		const forPath = directChildrenOfRule(uc, P.RULE_path_expression)[0];
		if (forPath) nameColumn = pathParts(forPath).slice(-1)[0] ?? "";
		const inList = directChildrenOfRule(uc, P.RULE_unpivot_in_item_list)[0];
		if (inList)
			for (const p of collectOfRule(inList, P.RULE_path_expression))
				removed.push(pathParts(p).slice(-1)[0] ?? "");
	}
	return {
		valueColumn,
		nameColumn,
		removed,
		alias: asAliasText(directChildrenOfRule(pipeUnpivot, P.RULE_as_alias)[0]),
	};
}

// A FROM-clause table source may carry a PIVOT/UNPIVOT suffix (`FROM t PIVOT(…) AS p`). The pivot_clause
// sits inside the source's `pivot_or_unpivot_clause_and_aliases` / `…_pivot_suffix` wrapper, which (like
// pipe_pivot) has the clause + an `as_alias?` as direct children — so pivotInfoOf/unpivotInfoOf read it
// as-is. shallowNodesOfRule stops at parenthesized_query, so a derived table's own pivot isn't pulled
// up. Lowered Spark-style (alias dropped) so the pivot transforms THIS select's output via pivotOutputs.
function extractFromPivot(fromContents: ParserRuleContext): PivotInfo | undefined {
	const pc = shallowNodesOfRule(fromContents, P.RULE_pivot_clause)[0];
	if (!pc || !(pc.parent instanceof ParserRuleContext)) return undefined;
	return pivotInfoOf(pc.parent); // keeps the `AS p` result alias when present (aliased-pivot path)
}

function extractFromUnpivot(fromContents: ParserRuleContext): UnpivotInfo | undefined {
	const uc = shallowNodesOfRule(fromContents, P.RULE_unpivot_clause)[0];
	if (!uc || !(uc.parent instanceof ParserRuleContext)) return undefined;
	return unpivotInfoOf(uc.parent);
}

/** Lower one pipe_operator to its faithful PipeStage. Every GoogleSQL pipe operator is handled. */
function lowerPipeOperator(po: ParserRuleContext): PipeStage {
	const where = directChildrenOfRule(po, P.RULE_pipe_where)[0];
	if (where) {
		const wc = directChildrenOfRule(where, P.RULE_where_clause)[0];
		const predicate = optionalClauseExpr(wc) ?? otherExpr(where);
		const columns: ColumnRef[] = [];
		columnsOf(predicate, columns, "where");
		return { op: "where", predicate, columns, cst: po };
	}
	const select = directChildrenOfRule(po, P.RULE_pipe_select)[0];
	if (select) {
		const projections = projectionsOfSelectClause(directChildrenOfRule(select, P.RULE_select_clause)[0]);
		return { op: "select", projections, columns: projectionColumns(projections), cst: po };
	}
	const extend = directChildrenOfRule(po, P.RULE_pipe_extend)[0];
	if (extend) {
		const projections = projectionsOfSelectionList(
			directChildrenOfRule(extend, P.RULE_pipe_selection_item_list)[0],
		);
		return { op: "extend", projections, columns: projectionColumns(projections), cst: po };
	}
	const set = directChildrenOfRule(po, P.RULE_pipe_set)[0];
	if (set) {
		const assignments: PipeSetItem[] = [];
		const columns: ColumnRef[] = [];
		for (const item of directChildrenOfRule(set, P.RULE_pipe_set_item)) {
			const id = directChildrenOfRule(item, P.RULE_identifier)[0];
			const e = directChildrenOfRule(item, P.RULE_expression)[0];
			const expr = e ? lowerExpr(e) : otherExpr(item);
			assignments.push({ column: id ? identText(id) : "", expr });
			columnsOf(expr, columns, "projection");
		}
		return { op: "set", assignments, columns, cst: po };
	}
	const drop = directChildrenOfRule(po, P.RULE_pipe_drop)[0];
	if (drop) return { op: "drop", drop: directChildrenOfRule(drop, P.RULE_identifier).map(identText), cst: po };
	const rename = directChildrenOfRule(po, P.RULE_pipe_rename)[0];
	if (rename) {
		const renames = directChildrenOfRule(rename, P.RULE_pipe_rename_item).map((it) => {
			const ids = directChildrenOfRule(it, P.RULE_identifier);
			return { from: ids[0] ? identText(ids[0]) : "", to: ids[1] ? identText(ids[1]) : "" };
		});
		return { op: "rename", renames, cst: po };
	}
	const agg = directChildrenOfRule(po, P.RULE_pipe_aggregate)[0];
	if (agg) return lowerPipeAggregate(agg, po);
	const orderBy = directChildrenOfRule(po, P.RULE_pipe_order_by)[0];
	if (orderBy) {
		const oc = directChildrenOfRule(orderBy, P.RULE_order_by_clause)[0];
		return makeOrderByStage(oc ? (extractOrderBy(oc) ?? []) : [], po);
	}
	const limit = directChildrenOfRule(po, P.RULE_pipe_limit_offset)[0];
	if (limit) {
		const lc = directChildrenOfRule(limit, P.RULE_limit_offset_clause)[0];
		return { op: "limit", limit: (lc ? extractLimit(lc) : undefined) ?? {}, cst: po };
	}
	if (directChildrenOfRule(po, P.RULE_pipe_distinct)[0]) return { op: "distinct", cst: po };
	const window = directChildrenOfRule(po, P.RULE_pipe_window)[0];
	if (window) {
		const projections = projectionsOfSelectionList(
			directChildrenOfRule(window, P.RULE_pipe_selection_item_list)[0],
		);
		return { op: "window", projections, columns: projectionColumns(projections), cst: po };
	}
	const join = directChildrenOfRule(po, P.RULE_pipe_join)[0];
	if (join) return lowerPipeJoin(join, po);
	const call = directChildrenOfRule(po, P.RULE_pipe_call)[0];
	if (call) {
		const tvf = directChildrenOfRule(call, P.RULE_tvf_with_suffixes)[0];
		const pathNode = tvf ? firstOfRule(tvf, P.RULE_path_expression) : undefined;
		const name = pathNode ? pathParts(pathNode) : [];
		const args = tvf ? collectOfRule(tvf, P.RULE_expression).map((e) => lowerExpr(e)) : [];
		const columns: ColumnRef[] = [];
		for (const a of args) columnsOf(a, columns, "projection");
		return { op: "call", name, args, columns, cst: po };
	}
	const as = directChildrenOfRule(po, P.RULE_pipe_as)[0];
	if (as) {
		const id = directChildrenOfRule(as, P.RULE_identifier)[0];
		return { op: "as", alias: id ? identText(id) : "", cst: po };
	}
	const setop = directChildrenOfRule(po, P.RULE_pipe_set_operation)[0];
	if (setop) return lowerPipeSetOperation(setop, po);
	const recUnion = directChildrenOfRule(po, P.RULE_pipe_recursive_union)[0];
	if (recUnion) {
		const meta = directChildrenOfRule(recUnion, P.RULE_set_operation_metadata)[0];
		const all = meta !== undefined && hasTokenDeep(meta, P.ALL_SYMBOL);
		const operand = lowerSubqueryOrSubpipeline(
			directChildrenOfRule(recUnion, P.RULE_subquery_or_subpipeline)[0],
			recUnion,
		);
		const aliasId = firstOfRule(recUnion, P.RULE_identifier);
		return { op: "recursiveUnion", all, operand, alias: aliasId ? identText(aliasId) : undefined, cst: po };
	}
	const pivot = directChildrenOfRule(po, P.RULE_pipe_pivot)[0];
	if (pivot) return { op: "pivot", pivot: pivotInfoOf(pivot), cst: po };
	const unpivot = directChildrenOfRule(po, P.RULE_pipe_unpivot)[0];
	if (unpivot) return { op: "unpivot", unpivot: unpivotInfoOf(unpivot), cst: po };
	if (directChildrenOfRule(po, P.RULE_pipe_tablesample)[0]) return { op: "tablesample", cst: po };
	const assert = directChildrenOfRule(po, P.RULE_pipe_assert)[0];
	if (assert) {
		const exprs = directChildrenOfRule(assert, P.RULE_expression).map((e) => lowerExpr(e));
		const columns: ColumnRef[] = [];
		for (const e of exprs) columnsOf(e, columns, "where");
		const [condition, ...payload] = exprs.length ? exprs : [otherExpr(assert)];
		return { op: "assert", condition, payload, columns, cst: po };
	}
	const log = directChildrenOfRule(po, P.RULE_pipe_log)[0];
	if (log) {
		const sp = directChildrenOfRule(log, P.RULE_subpipeline)[0];
		return { op: "log", pipeline: sp ? lowerSubpipeline(sp) : undefined, cst: po };
	}
	if (directChildrenOfRule(po, P.RULE_pipe_describe)[0]) return { op: "describe", cst: po };
	if (directChildrenOfRule(po, P.RULE_pipe_static_describe)[0]) return { op: "staticDescribe", cst: po };
	const withOp = directChildrenOfRule(po, P.RULE_pipe_with)[0];
	if (withOp) {
		const wc = directChildrenOfRule(withOp, P.RULE_with_clause)[0];
		const ctes = wc
			? directChildrenOfRule(wc, P.RULE_with_clause_entry)
					.flatMap((e) => directChildrenOfRule(e, P.RULE_aliased_query))
					.map(lowerCte)
			: [];
		return { op: "with", ctes, cst: po };
	}
	const ifOp = directChildrenOfRule(po, P.RULE_pipe_if)[0];
	if (ifOp) return lowerPipeIf(ifOp, po);
	const fork = directChildrenOfRule(po, P.RULE_pipe_fork)[0];
	if (fork)
		return { op: "fork", branches: directChildrenOfRule(fork, P.RULE_subpipeline).map(lowerSubpipeline), cst: po };
	const tee = directChildrenOfRule(po, P.RULE_pipe_tee)[0];
	if (tee)
		return { op: "tee", branches: directChildrenOfRule(tee, P.RULE_subpipeline).map(lowerSubpipeline), cst: po };
	const mr = directChildrenOfRule(po, P.RULE_pipe_match_recognize)[0];
	if (mr) return lowerPipeMatchRecognize(mr, po);
	if (directChildrenOfRule(po, P.RULE_pipe_export_data)[0]) return { op: "exportData", cst: po };
	const createTable = directChildrenOfRule(po, P.RULE_pipe_create_table)[0];
	if (createTable) {
		const cts = directChildrenOfRule(createTable, P.RULE_create_table_statement)[0];
		return { op: "createTable", name: cts ? dashedPathPartsOf(cts) : [], cst: po };
	}
	const insert = directChildrenOfRule(po, P.RULE_pipe_insert)[0];
	if (insert) {
		const prefix = directChildrenOfRule(insert, P.RULE_insert_statement_prefix)[0];
		return { op: "insert", name: prefix ? dashedPathPartsOf(prefix) : [], cst: po };
	}
	// Unreachable for known GoogleSQL syntax — every pipe operator is handled above. Drift guard only.
	return { op: "other", name: po.getText().slice(0, 24), cst: po };
}

// --- SELECT body -----------------------------------------------------------------

/** select: select_clause from_clause? opt_clauses_following_from? */
function buildSelect(select: ParserRuleContext): SelectExpr {
	const unsupported: UnsupportedFlag[] = [];

	const selectClause = directChildrenOfRule(select, P.RULE_select_clause)[0];
	const projections = projectionsOfSelectClause(selectClause);

	const fromClause = directChildrenOfRule(select, P.RULE_from_clause)[0];
	const fromContents = fromClause ? directChildrenOfRule(fromClause, P.RULE_from_clause_contents)[0] : undefined;
	const from = fromContents ? buildSources(fromContents, unsupported) : [];
	const joinConditions: Expr[] = [];
	const onByCst = new Map<ParserRuleContext, Expr>();
	if (fromContents) extractJoinConditions(fromContents, joinConditions, onByCst);
	const joins = fromContents ? buildJoins(fromContents, from, onByCst) : [];

	const following = directChildrenOfRule(select, P.RULE_opt_clauses_following_from)[0];
	const whereClause = following ? firstShallow(following, P.RULE_where_clause) : undefined;
	const where = optionalClauseExpr(whereClause);

	const groupByClause = following ? firstShallow(following, P.RULE_group_by_clause) : undefined;
	const groupBy = groupByClause ? extractGroupBy(groupByClause) : undefined;
	const groupByAll =
		groupByClause !== undefined && directChildrenOfRule(groupByClause, P.RULE_group_by_all).length > 0;

	const havingClause = following ? firstShallow(following, P.RULE_having_clause) : undefined;
	const having = optionalClauseExpr(havingClause);

	const qualifyClause = following ? firstShallow(following, P.RULE_qualify_clause_nonreserved) : undefined;
	const qualify = optionalClauseExpr(qualifyClause);

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
		joins: joins.length ? joins : undefined,
		groupBy,
		having,
		qualify,
		aggregated,
		subqueries: subqueries.length ? subqueries : undefined,
		pivot: fromContents ? extractFromPivot(fromContents) : undefined,
		unpivot: fromContents ? extractFromUnpivot(fromContents) : undefined,
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
		const name = aliasId
			? identText(aliasId)
			: expr.kind === "column"
				? expr.parts[expr.parts.length - 1]
				: undefined;
		// The identifier alone is the alias span (AS, when present, is its sibling token).
		return { name, isStar: false, expr, ...(aliasId ? { aliasCst: aliasId } : {}), cst: item };
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
function buildSources(contents: ParserRuleContext, unsupported: UnsupportedFlag[]): Source[] {
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
function collectTablePrimary(tp: ParserRuleContext, out: Source[], unsupported: UnsupportedFlag[]): void {
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

function buildSource(tp: ParserRuleContext, unsupported: UnsupportedFlag[]): Source {
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

	// graph_table_query: GRAPH_TABLE(graph MATCH … COLUMNS(…)) — a graph relation.
	const graphTable = directChildrenOfRule(tp, P.RULE_graph_table_query)[0];
	if (graphTable) return buildGraphTableSource(graphTable);

	// table_path_expression: table_path_expression_base hint? alias? with_offset? at_system_time?
	const pathExpr = directChildrenOfRule(tp, P.RULE_table_path_expression)[0];
	if (pathExpr) return buildPathSource(pathExpr);

	// tvf_with_suffixes: a table-valued function — opaque columns (need the signature).
	const tvf = directChildrenOfRule(tp, P.RULE_tvf_with_suffixes)[0];
	if (tvf) {
		const path = firstOfRule(tvf, P.RULE_path_expression);
		const aliasInfo = aliasOf(directChildrenOfRule(tvf, P.RULE_pivot_or_unpivot_clause_and_aliases)[0]);
		const name = path ? pathParts(path) : [tp.getText()];
		return {
			kind: "table",
			relation: relationOf(name),
			namePartSpans: path ? pathPartSpans(path) : undefined,
			alias: aliasInfo?.alias,
			aliasCst: aliasInfo?.cst,
			cst: tp,
		};
	}

	const name = [stripBackticks(tp.getText())];
	return { kind: "table", relation: relationOf(name), cst: tp };
}

// --- graph / GQL -----------------------------------------------------------------
// GRAPH_TABLE(graph MATCH … COLUMNS(…)) in FROM, and the standalone `GRAPH g … RETURN …` statement.
// Modelled faithfully: the graph name, the MATCH element variables (nodes/edges + labels + direction),
// the WHERE, and the output columns (COLUMNS / RETURN). The element variables are the graph query's own
// relation namespace; scope resolves the WHERE / output expressions against them.

/** A standalone gql_statement (`GRAPH g … RETURN …`) → `SELECT * FROM <graph-table>`. */
function lowerGqlStatement(gql: ParserRuleContext): QueryExpr {
	const src = buildGraphTableSource(gql);
	const body: SelectExpr = {
		kind: "select",
		projections: [implicitStar(gql)],
		from: [src],
		columns: [],
		aggregated: false,
		cst: gql,
	};
	return { kind: "query", ctes: [], body, cst: gql };
}

/** graph_table_query / gql_statement → a GraphTableSource (MATCH form or operation-block/RETURN form). */
function buildGraphTableSource(graph: ParserRuleContext): GraphTableSource {
	const pathNode = directChildrenOfRule(graph, P.RULE_path_expression)[0];
	const name = pathNode ? pathParts(pathNode) : [];
	const elements: GraphElement[] = [];
	const columnRefs: ColumnRef[] = [];
	let where: Expr | undefined;
	let columns: Projection[] = [];

	const matchOp = directChildrenOfRule(graph, P.RULE_graph_match_operator)[0];
	const pattern = matchOp ? directChildrenOfRule(matchOp, P.RULE_graph_pattern)[0] : undefined;
	if (pattern) {
		collectGraphElements(pattern, elements);
		const wc = directChildrenOfRule(pattern, P.RULE_where_clause)[0];
		if (wc) {
			where = optionalClauseExpr(wc);
			if (where) columnsOf(where, columnRefs, "where");
		}
	}
	const shape = directChildrenOfRule(graph, P.RULE_graph_shape_clause)[0];
	if (shape) {
		const sl = directChildrenOfRule(shape, P.RULE_select_list)[0];
		columns = sl ? directChildrenOfRule(sl, P.RULE_select_list_item).map(buildProjection) : [];
	}
	const opBlock = directChildrenOfRule(graph, P.RULE_graph_operation_block)[0];
	if (opBlock) {
		for (const pat of collectOfRule(opBlock, P.RULE_graph_pattern)) {
			collectGraphElements(pat, elements);
			const wc = directChildrenOfRule(pat, P.RULE_where_clause)[0];
			if (wc) {
				const w = optionalClauseExpr(wc);
				if (w) {
					columnsOf(w, columnRefs, "where");
					where ??= w;
				}
			}
		}
		const retList = collectOfRule(opBlock, P.RULE_graph_return_item_list)[0];
		if (retList) columns = directChildrenOfRule(retList, P.RULE_graph_return_item).map(graphReturnProjection);
	}
	for (const p of columns) columnsOf(p.expr, columnRefs, "projection");
	const aliasInfo = aliasOf(directChildrenOfRule(graph, P.RULE_as_alias)[0]);
	return {
		kind: "graphtable",
		graph: name,
		elements,
		where,
		columns,
		columnRefs,
		alias: aliasInfo?.alias,
		aliasCst: aliasInfo?.cst,
		cst: graph,
	};
}

/** Collect node/edge element variables (with labels + edge direction) from a graph pattern. */
function collectGraphElements(node: ParserRuleContext, out: GraphElement[]): void {
	for (const ep of collectOfRule(node, P.RULE_graph_element_pattern)) {
		const nodePat = directChildrenOfRule(ep, P.RULE_graph_node_pattern)[0];
		const edgePat = directChildrenOfRule(ep, P.RULE_graph_edge_pattern)[0];
		const filler = firstOfRule(ep, P.RULE_graph_element_pattern_filler);
		const variable = filler ? graphElementVar(filler) : undefined;
		const label = filler ? graphElementLabel(filler) : undefined;
		if (nodePat) {
			out.push({ graphKind: "node", variable: variable?.text, variableCst: variable?.cst, label, cst: ep });
		} else if (edgePat) {
			out.push({
				graphKind: "edge",
				variable: variable?.text,
				variableCst: variable?.cst,
				label,
				direction: edgeDirection(edgePat),
				cst: ep,
			});
		}
	}
}

function graphElementVar(filler: ParserRuleContext): { text: string; cst: ParserRuleContext } | undefined {
	const id = directChildrenOfRule(filler, P.RULE_opt_graph_element_identifier)[0];
	const gid = id ? firstOfRule(id, P.RULE_graph_identifier) : undefined;
	return gid ? { text: stripBackticks(gid.getText()), cst: gid } : undefined;
}

function graphElementLabel(filler: ParserRuleContext): string | undefined {
	const lbl = directChildrenOfRule(filler, P.RULE_opt_is_label_expression)[0];
	const le = lbl ? firstOfRule(lbl, P.RULE_label_expression) : undefined;
	return le ? le.getText() : undefined;
}

function edgeDirection(edgePat: ParserRuleContext): "left" | "right" | "any" {
	if (directTokenType(edgePat, [P.SUB_GT_BRACKET_SYMBOL]) !== undefined) return "right";
	if (directTokenType(edgePat, [P.LT_OPERATOR]) !== undefined) return "left";
	return "any";
}

/** graph_return_item: expression (AS identifier)? | *. */
function graphReturnProjection(item: ParserRuleContext): Projection {
	if (directTokenType(item, [P.MULTIPLY_OPERATOR]) !== undefined) {
		return { name: undefined, isStar: true, expr: { kind: "star", cst: item }, cst: item };
	}
	const e = directChildrenOfRule(item, P.RULE_expression)[0];
	const id = directChildrenOfRule(item, P.RULE_identifier)[0];
	const expr = e ? lowerExpr(e) : otherExpr(item);
	const name = id ? identText(id) : expr.kind === "column" ? expr.parts[expr.parts.length - 1] : undefined;
	return { name, isStar: false, expr, ...(id ? { aliasCst: id } : {}), cst: item };
}

/** table_path_expression: base (unnest | path) + alias. */
function buildPathSource(pathExpr: ParserRuleContext): Source {
	const base = directChildrenOfRule(pathExpr, P.RULE_table_path_expression_base)[0];
	const aliasInfo =
		aliasOf(directChildrenOfRule(pathExpr, P.RULE_table_path_alias_or_qualify)[0]) ??
		aliasOf(directChildrenOfRule(pathExpr, P.RULE_table_path_pivot_suffix)[0]) ??
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
	const namePartSpans = path ? pathPartSpans(path) : undefined;
	return {
		kind: "table",
		relation: relationOf(name),
		namePartSpans,
		alias: aliasInfo?.alias,
		aliasCst: aliasInfo?.cst,
		cst: pathExpr,
	};
}

/** table_path_alias_or_qualify / table_path_pivot_suffix / pivot_or_unpivot_clause_and_aliases → its leading identifier. */
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

function extractJoinConditions(contents: ParserRuleContext, out: Expr[], onByCst: Map<ParserRuleContext, Expr>): void {
	// Every ON expr (top-level suffixes AND nested parenthesized joins), in tree order. Lowered once and
	// keyed by its on_clause CST so buildJoins can share the same Expr on the matching top-level Join.
	for (const oc of shallowNodesOfRule(contents, P.RULE_on_clause)) {
		const e = directChildrenOfRule(oc, P.RULE_expression)[0];
		if (!e) continue;
		const lowered = lowerExpr(e);
		out.push(lowered);
		onByCst.set(oc, lowered);
	}
}

/** The top-level FROM join chain as Join[]: one per JOIN from_clause_contents_suffix, in source order.
 *  COMMA suffixes are not joins; nested parenthesized-join `join_item`s aren't modelled here (their ON
 *  exprs stay conserved in joinConditions). `join.source` is the reference-identical `from` entry — found
 *  by positional count (buildSource sets `cst` to an inner node per source kind, so a CST map can't
 *  match), which is the FIRST leaf source the suffix's table_primary contributes. `join.on`/`using` come
 *  from on_or_using_clause_list. */
function buildJoins(contents: ParserRuleContext, from: Source[], onByCst: Map<ParserRuleContext, Expr>): Join[] {
	const joins: Join[] = [];
	const first = directChildrenOfRule(contents, P.RULE_table_primary)[0];
	let idx = first ? countPrimarySources(first) : 0; // sources contributed by the base relation
	for (const suffix of directChildrenOfRule(contents, P.RULE_from_clause_contents_suffix)) {
		const tp = directChildrenOfRule(suffix, P.RULE_table_primary)[0];
		if (!tp) continue;
		const before = idx;
		idx += countPrimarySources(tp);
		if (directTokenType(suffix, [P.JOIN_SYMBOL]) === undefined) continue; // COMMA suffix — not a join
		const source = from[before];
		if (!source) continue;
		const { kind, natural } = bigqueryJoinKind(suffix);
		const list = directChildrenOfRule(suffix, P.RULE_on_or_using_clause_list)[0];
		let on: Expr | undefined;
		let using: string[] | undefined;
		if (list) {
			const oc = firstShallow(list, P.RULE_on_clause);
			if (oc) on = onByCst.get(oc);
			const uc = firstShallow(list, P.RULE_using_clause);
			if (uc && !on) using = directChildrenOfRule(uc, P.RULE_identifier).map((i) => i.getText());
		}
		joins.push({ kind, source, on, using, natural: natural || undefined, cst: suffix });
	}
	return joins;
}

/** How many leaf sources collectTablePrimary pushes for `tp` (1 for a plain relation; the sum of a
 *  parenthesized `join`'s inputs; the inner primary's count through a match_recognize/sample wrapper).
 *  Mirrors collectTablePrimary exactly so the running index aligns with `from`. */
function countPrimarySources(tp: ParserRuleContext): number {
	const join = directChildrenOfRule(tp, P.RULE_join)[0];
	if (join) {
		let n = 0;
		const inner = directChildrenOfRule(join, P.RULE_table_primary)[0];
		if (inner) n += countPrimarySources(inner);
		for (const ji of directChildrenOfRule(join, P.RULE_join_item)) {
			const t = directChildrenOfRule(ji, P.RULE_table_primary)[0];
			if (t) n += countPrimarySources(t);
		}
		return n;
	}
	const innerPrimary = directChildrenOfRule(tp, P.RULE_table_primary)[0];
	return innerPrimary ? countPrimarySources(innerPrimary) : 1;
}

/** Kind + NATURAL flag for a GoogleSQL join suffix (opt_natural? join_type? JOIN …). join_type:
 *  CROSS | FULL opt_outer? | INNER | LEFT opt_outer? | RIGHT opt_outer?. */
function bigqueryJoinKind(suffix: ParserRuleContext): { kind: JoinKind; natural: boolean } {
	const natural = directChildrenOfRule(suffix, P.RULE_opt_natural).length > 0;
	const jt = directChildrenOfRule(suffix, P.RULE_join_type)[0];
	let ansi: JoinKind | undefined;
	if (jt) {
		const t = directTokenType(jt, [P.CROSS_SYMBOL, P.FULL_SYMBOL, P.INNER_SYMBOL, P.LEFT_SYMBOL, P.RIGHT_SYMBOL]);
		if (t === P.CROSS_SYMBOL) ansi = "cross";
		else if (t === P.FULL_SYMBOL) ansi = "full";
		else if (t === P.INNER_SYMBOL) ansi = "inner";
		else if (t === P.LEFT_SYMBOL) ansi = "left";
		else if (t === P.RIGHT_SYMBOL) ansi = "right";
	}
	return { kind: ansi ?? (natural ? "natural" : "inner"), natural };
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

function lowerExpr(node: ParserRuleContext): Expr {
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
				return {
					kind: "predicate",
					op: boolLit.getText().toLowerCase(),
					negated,
					operand,
					args: [],
					cst: node,
				};
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
		// dotted field access: ehpa '.' dot_identifier  |  ehpa '.' '(' path ')'
		// dot_identifier wraps `identifier | <reserved keyword>` (lexical DOT_IDENTIFIER).
		if (hasDirectToken(node, P.DOT_SYMBOL)) {
			const base = lowerHigherPrec(subs[0]);
			const dotId = directChildrenOfRule(node, P.RULE_dot_identifier)[0];
			const id =
				directChildrenOfRule(node, P.RULE_identifier)[0] ??
				(dotId ? directChildrenOfRule(dotId, P.RULE_identifier)[0] : undefined);
			const fieldName = id ? identText(id) : dotId ? stripBackticks(dotId.getText()) : undefined;
			if (fieldName !== undefined && base.kind === "column") {
				// Extend the base's per-part spans with the field's own identifier span; omit (all-or-nothing)
				// if the base had none or the field is a DOT_IDENTIFIER (dot-fused, no clean identifier node).
				const fieldSpan = id ? partSpanOf(id) : undefined;
				const partSpans = base.partSpans && fieldSpan ? [...base.partSpans, fieldSpan] : undefined;
				return { kind: "column", parts: [...base.parts, fieldName], partSpans, cst: node };
			}
			const path = directChildrenOfRule(node, P.RULE_path_expression)[0];
			const idxText = fieldName ?? (path ? path.getText() : "field");
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

	// An ehpa / expression_maybe_parenthesized_not_a_query can reduce DIRECTLY to a bare `and_expression`
	// or `expression OR expression` (both rules carry those alts — a mutual-left-recursion artifact of the
	// ZetaSQL grammar). With no ehpa child, `subs` is empty and these would otherwise fall to lowerLeaf's
	// default `other` (the parenthesized-AND leak: `ON (a=b and c=d and (e=f and g=h))`). Route them here.
	const andChild = directChildrenOfRule(node, P.RULE_and_expression)[0];
	if (andChild) return lowerAnd(andChild);
	const orParts = directChildrenOfRule(node, P.RULE_expression);
	if (orParts.length === 2 && hasDirectToken(node, P.OR_SYMBOL)) {
		return { kind: "binary", op: "or", left: lowerExpr(orParts[0]), right: lowerExpr(orParts[1]), cst: node };
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
			return { kind: "literal", text: node.getText(), cst: node };
		case P.RULE_parameter_expression:
			return lowerParameterExpression(node);
		case P.RULE_system_variable_expression:
			return lowerSystemVariableExpression(node);
		case P.RULE_identifier:
			return { kind: "column", parts: [identText(node)], partSpans: partSpansOf([node]), cst: node };
		case P.RULE_path_expression:
			return { kind: "column", parts: pathParts(node), partSpans: pathPartSpans(node), cst: node };
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
			return {
				kind: "function",
				name: "array",
				args: collectArgExprs(node),
				aggregate: false,
				distinct: false,
				cst: node,
			};
		case P.RULE_struct_constructor:
			return {
				kind: "function",
				name: "struct",
				args: collectArgExprs(node),
				aggregate: false,
				distinct: false,
				cst: node,
			};
		// Braced proto/struct constructors — `{f: v}`, `STRUCT{…}` / `STRUCT<…>{…}`, `NEW T{…}`
		// (proto-messages#value_syntax). The field values are retained as args in the named_struct shape
		// (interleaved [nameLiteral, value, …]) so infer types the STRUCT by its field names where knowable;
		// a NEW-proto constructor names `new` (its message type is unknowable → infer stays UNKNOWN).
		case P.RULE_braced_constructor:
			return lowerBraced(node, "named_struct", node);
		case P.RULE_struct_braced_constructor: {
			const braced = firstShallow(node, P.RULE_braced_constructor);
			return braced ? lowerBraced(braced, "named_struct", node) : otherExpr(node);
		}
		case P.RULE_braced_new_constructor: {
			const braced = firstShallow(node, P.RULE_braced_constructor);
			return braced
				? lowerBraced(braced, "new", node)
				: { kind: "function", name: "new", args: [], aggregate: false, distinct: false, cst: node };
		}
		case P.RULE_new_constructor:
			return lowerNewConstructor(node);
		case P.RULE_replace_fields_expression:
			return lowerReplaceFields(node);
		case P.RULE_with_expression:
			return lowerWithExpression(node);
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
	// The call name is the LAST path segment; the segments before it are the qualifier (lowercased),
	// under which a dotted-family call (HLL_COUNT.EXTRACT, NET.IP_FROM_STRING, AEAD.ENCRYPT, …) keys
	// its return type — see functionType's `qualifier.name` → `name` lookup order.
	let name: string;
	let qualifier: string | undefined;
	if (path) {
		const parts = pathParts(path);
		name = (parts[parts.length - 1] ?? "").toLowerCase();
		if (parts.length > 1) qualifier = parts.slice(0, -1).join(".").toLowerCase();
	} else {
		name = (keyword ? keyword.getText() : (leftmostToken(node) ?? "")).toLowerCase();
	}

	const suffix = directChildrenOfRule(node, P.RULE_function_call_expression_with_clauses_suffix)[0];
	const { args, argNames } = suffix ? collectCallArgs(suffix) : { args: [], argNames: [] };
	const over = suffix ? firstOfRule(suffix, P.RULE_over_clause) : undefined;
	const window = over ? lowerOver(over) : undefined;
	const distinct = hasDirectToken(node, P.DISTINCT_SYMBOL);

	return {
		kind: "function",
		name,
		qualifier,
		args,
		// Named-argument invocation `fn(name => value)`: the per-arg names make the call
		// conservation-visible and let the arity checker's named-arg bypass fire (a named call's
		// positional count says nothing about the documented positional signature).
		...(argNames.some((n) => n !== undefined) ? { argNames } : {}),
		aggregate: AGGREGATES.has(name),
		distinct,
		window,
		cst: node,
	};
}

/** function_call_argument children of the suffix (skipping nested calls' own args), with the
 *  `name => value` parameter name per arg slot (undefined for positional args). */
function collectCallArgs(suffix: ParserRuleContext): { args: Expr[]; argNames: (string | undefined)[] } {
	const args: Expr[] = [];
	const argNames: (string | undefined)[] = [];
	for (const arg of shallowNodesOfRule(suffix, P.RULE_function_call_argument)) {
		// function_call_argument: expression alias? | named_argument | lambda_argument | sequence_arg
		const named = directChildrenOfRule(arg, P.RULE_named_argument)[0];
		if (named) {
			const argName = directChildrenOfRule(named, P.RULE_identifier)[0]?.getText();
			const e = directChildrenOfRule(named, P.RULE_expression)[0];
			if (e) {
				args.push(lowerExpr(e));
				argNames.push(argName);
			}
			const lam = directChildrenOfRule(named, P.RULE_lambda_argument)[0];
			if (lam) {
				args.push(lowerLambda(lam));
				argNames.push(argName);
			}
			continue;
		}
		const lambda = directChildrenOfRule(arg, P.RULE_lambda_argument)[0];
		if (lambda) {
			args.push(lowerLambda(lambda));
			argNames.push(undefined);
			continue;
		}
		const e = directChildrenOfRule(arg, P.RULE_expression)[0];
		if (e) {
			args.push(lowerExpr(e));
			argNames.push(undefined);
		}
	}
	return { args, argNames };
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
	const orderBy = ob
		? collectOfRule(ob, P.RULE_ordering_expression).map((oe) => {
				const e = directChildrenOfRule(oe, P.RULE_expression)[0];
				return e ? lowerExpr(e) : otherExpr(oe);
			})
		: [];
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
		const when = subject ? { kind: "binary" as const, op: "=", left: subject, right: whenVal, cst: node } : whenVal;
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

/** EXTRACT(part FROM source [AT TIME ZONE tz]) — the datepart keyword drives the return type
 *  (functionType's EXTRACT special form), so it arrives as args[0], a recognizable literal carrying
 *  the keyword text (YEAR / WEEK(MONDAY) / DATE / …), mirroring Databricks's lowerTimestampFn. The
 *  base holds exactly two direct `expression` children — the datepart and the source — so it does
 *  not deep-collect the source's own nested expressions. */
function lowerExtract(node: ParserRuleContext): Expr {
	const base = firstOfRule(node, P.RULE_extract_expression_base) ?? node;
	const [partExpr, sourceExpr] = directChildrenOfRule(base, P.RULE_expression);
	const args: Expr[] = [{ kind: "literal", text: partExpr?.getText() ?? "", cst: partExpr ?? node }];
	if (sourceExpr) args.push(lowerExpr(sourceExpr));
	// AT TIME ZONE <tz>: the tz `expression` hangs off the extract_expression wrapper, not the base.
	const tz = directChildrenOfRule(node, P.RULE_expression)[0];
	if (tz) args.push(lowerExpr(tz));
	return { kind: "function", name: "extract", args, aggregate: false, distinct: false, cst: node };
}

/** Collect the direct `expression` arguments of a constructor (array/struct). */
function collectArgExprs(node: ParserRuleContext): Expr[] {
	return shallowNodesOfRule(node, P.RULE_expression).map(lowerExpr);
}

/** A braced constructor `{ f: v, g { … }, (pkg.Ext): w }` → a `function` expr whose args are the fields
 *  interleaved [nameLiteral, valueExpr, …] (the named_struct shape). Field values are `: expression` or a
 *  nested braced_constructor (recursed). Field names come from the lhs path / proto-extension text; they
 *  ride as `literal` args (leaves — not column refs), so every real value expr stays visible to the walker
 *  and to columnsOf. `cst` is the outer constructor node so the source span covers the whole form. */
function lowerBraced(braced: ParserRuleContext, name: string, cst: ParserRuleContext): Expr {
	return { kind: "function", name, args: bracedFields(braced), aggregate: false, distinct: false, cst };
}

function bracedFields(braced: ParserRuleContext): Expr[] {
	const out: Expr[] = [];
	for (const field of bracedFieldNodes(braced)) {
		const lhs = firstShallow(field, P.RULE_braced_constructor_lhs);
		out.push({ kind: "literal", text: lhs ? stripBackticks(lhs.getText()) : "", cst: lhs ?? field });
		out.push(bracedFieldValue(field));
	}
	return out;
}

/** The `braced_constructor_field` nodes of THIS constructor only — the prefix chain is left-recursive, so
 *  walk it, but stop at each field (its value, possibly a nested braced_constructor, belongs to the field)
 *  and never descend into a nested braced_constructor. */
function bracedFieldNodes(braced: ParserRuleContext): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	const walk = (n: ParseTree): void => {
		for (let i = 0; i < n.getChildCount(); i++) {
			const c = n.getChild(i);
			if (!(c instanceof ParserRuleContext)) continue;
			if (c.ruleIndex === P.RULE_braced_constructor_field) out.push(c);
			else if (c.ruleIndex === P.RULE_braced_constructor)
				continue; // a nested value — its own fields
			else walk(c);
		}
	};
	walk(braced);
	return out;
}

/** braced_constructor_field_value: `COLON expression` | nested braced_constructor. */
function bracedFieldValue(field: ParserRuleContext): Expr {
	const value = firstShallow(field, P.RULE_braced_constructor_field_value) ?? field;
	const e = directChildrenOfRule(value, P.RULE_expression)[0];
	if (e) return lowerExpr(e);
	const nested = directChildrenOfRule(value, P.RULE_braced_constructor)[0];
	return nested ? lowerBraced(nested, "named_struct", nested) : otherExpr(value);
}

/** NEW Type ( arg [AS field], … ) — a parenthesized proto constructor. Each arg keeps its VALUE expression
 *  (the `AS <field>` is a label, not a value); infer stays UNKNOWN (the message type is unknowable). */
function lowerNewConstructor(node: ParserRuleContext): Expr {
	const args: Expr[] = [];
	for (const arg of shallowNodesOfRule(node, P.RULE_new_constructor_arg)) {
		const e = directChildrenOfRule(arg, P.RULE_expression)[0];
		if (e) args.push(lowerExpr(e));
	}
	return { kind: "function", name: "new", args, aggregate: false, distinct: false, cst: node };
}

/** REPLACE_FIELDS(expr, value AS path, …) — replaces struct/proto fields (functions#replace_fields). Lowers
 *  as a `replace_fields` call keeping the base expr plus each replacement VALUE (the `AS <path>` targets are
 *  field labels, not value exprs). infer stays UNKNOWN — the modified proto/struct type is not knowable. */
function lowerReplaceFields(node: ParserRuleContext): Expr {
	const prefix = firstShallow(node, P.RULE_replace_fields_prefix) ?? node;
	const args: Expr[] = [];
	const baseExpr = directChildrenOfRule(prefix, P.RULE_expression)[0]; // the only direct `expression` — the base
	if (baseExpr) args.push(lowerExpr(baseExpr));
	for (const arg of shallowNodesOfRule(prefix, P.RULE_replace_fields_arg)) {
		const e = directChildrenOfRule(arg, P.RULE_expression)[0];
		if (e) args.push(lowerExpr(e));
	}
	return { kind: "function", name: "replace_fields", args, aggregate: false, distinct: false, cst: node };
}

/** WITH(name AS expr, …, result) — ZetaSQL's expression-scoped let-bindings (operators#with_expression).
 *  Lowers to the `with` IR node: bindings are lowered and RETAINED (conservation — every binding value expr
 *  stays visible to the walker and columnsOf), and `result` is the with_expression's own direct `expression`
 *  (the tail after the variable prefix). Bindings are NOT substituted, so a binding reference inside result
 *  resolves as a plain column ref — the accepted lowering boundary. */
function lowerWithExpression(node: ParserRuleContext): Expr {
	const prefix = firstShallow(node, P.RULE_with_expression_variable_prefix);
	const bindings = prefix
		? shallowNodesOfRule(prefix, P.RULE_with_expression_variable).map((v) => {
				const id = directChildrenOfRule(v, P.RULE_identifier)[0];
				const e = directChildrenOfRule(v, P.RULE_expression)[0];
				return { name: id ? identText(id) : "", value: e ? lowerExpr(e) : otherExpr(v) };
			})
		: [];
	const result = directChildrenOfRule(node, P.RULE_expression)[0];
	return { kind: "with", bindings, result: result ? lowerExpr(result) : otherExpr(node), cst: node };
}

// --- column extraction (single source of truth for SelectExpr.columns) -----------

function columnsOf(expr: Expr, acc: ColumnRef[], clause: Clause): void {
	switch (expr.kind) {
		case "column":
			acc.push({ kind: "columnref", parts: expr.parts, clause, cst: expr.cst, partSpans: expr.partSpans });
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
			if (expr.index) columnsOf(expr.index, acc, clause);
			if (expr.end) columnsOf(expr.end, acc, clause);
			if (expr.step) columnsOf(expr.step, acc, clause);
			break;
		case "lambda":
			columnsOf(expr.body, acc, clause);
			break;
		case "with":
			// Retained bindings + result: collect every referenced column so scope sees binding values too
			// (a binding NAME referenced in result resolves as a plain column — the documented boundary).
			expr.bindings.forEach((b) => columnsOf(b.value, acc, clause));
			columnsOf(expr.result, acc, clause);
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
			acc.push({
				kind: "columnref",
				parts: pathParts(child),
				clause,
				cst: child,
				partSpans: pathPartSpans(child),
			});
			continue;
		}
		if (child.ruleIndex === P.RULE_identifier) {
			acc.push({
				kind: "columnref",
				parts: [identText(child)],
				clause,
				cst: child,
				partSpans: partSpansOf([child]),
			});
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
		case "with":
			return expr.bindings.some((b) => hasAggregate(b.value)) || hasAggregate(expr.result);
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

/** parameter_expression: named_parameter_expression | QUESTION_SYMBOL
 *  (cloud.google.com/bigquery/docs/parameterized-queries). Bare `?` carries no name/ordinal —
 *  BigQuery's positional form has no explicit index, so `ordinal` stays a consumer derivation,
 *  never fabricated here. `@name` resolves through named_parameter_expression's single
 *  dot_identifier; reusing pathParts is safe since that rule holds exactly one dot_identifier
 *  and no identifier head, so it degenerates to a one-element (dot-split, backtick-stripped) path. */
function lowerParameterExpression(node: ParserRuleContext): Expr {
	const named = firstOfRule(node, P.RULE_named_parameter_expression);
	if (!named) return { kind: "parameter", text: node.getText(), cst: node };
	return { kind: "parameter", text: node.getText(), name: pathParts(named).join("."), cst: node };
}

/** system_variable_expression: ATAT_SYMBOL dot_identifier (DOT_SYMBOL dot_identifier)* — a script-
 *  level system variable (cloud.google.com/bigquery/docs/reference/system-variables), e.g.
 *  `@@dataset_id` or the dotted `@@a.b`. `name` is the dotted path with the `@@` sigil stripped;
 *  pathParts already handles this shape (no identifier head, one-or-more dot_identifier tail). */
function lowerSystemVariableExpression(node: ParserRuleContext): Expr {
	return { kind: "variable", text: node.getText(), name: pathParts(node).join("."), system: true, cst: node };
}

/** path_expression: identifier (DOT dot_identifier)* — the dotted parts. The head is an identifier;
 *  later parts are dot_identifier (which may be a reserved keyword after the dot). A single
 *  backtick-quoted identifier may itself hold a dotted path (`proj.ds.t`), so split each part on `.`. */
function pathParts(node: ParserRuleContext): string[] {
	const head = directChildrenOfRule(node, P.RULE_identifier)[0];
	const tail = directChildrenOfRule(node, P.RULE_dot_identifier);
	if (head || tail.length) {
		const parts: string[] = [];
		if (head) parts.push(...stripBackticks(head.getText()).split("."));
		for (const d of tail) parts.push(...stripBackticks(d.getText()).split("."));
		return parts;
	}
	return node
		.getText()
		.split(".")
		.map(stripBackticks)
		.filter((p) => p.length > 0);
}

/** Per-part spans PARALLEL to pathParts(node) — one span per path node (its backticks included),
 *  all-or-nothing: undefined when any node fuses dots (a backtick-quoted `a.b` head or a dot-fused
 *  DOT_IDENTIFIER — pathParts splits those into multiple parts from one token, so no per-part span is
 *  possible) or the getText() fallback fires. Each tail's inner identifier is preferred so the span
 *  excludes the leading dot. One shared span-capture seam (reused by the editor-gold rewrite). */
function pathPartSpans(node: ParserRuleContext) {
	const head = directChildrenOfRule(node, P.RULE_identifier)[0];
	const tail = directChildrenOfRule(node, P.RULE_dot_identifier);
	if (!head && !tail.length) return undefined;
	const nodes: ParserRuleContext[] = [];
	if (head) {
		if (stripBackticks(head.getText()).includes(".")) return undefined;
		nodes.push(head);
	}
	for (const d of tail) {
		const partNode = directChildrenOfRule(d, P.RULE_identifier)[0] ?? d;
		if (stripBackticks(partNode.getText()).includes(".")) return undefined;
		nodes.push(partNode);
	}
	return partSpansOf(nodes);
}

/** A dashed/slashed path (BigQuery `project-id.dataset.table`) used as a table name. */
function dashedPathParts(base: ParserRuleContext): string[] {
	const text = stripBackticks(base.getText());
	return text
		.split(".")
		.map(stripBackticks)
		.filter((p) => p.length > 0);
}

/** The name parts of the leading ehpa of `t.*` (for the star qualifier). */
function exprToNameParts(node: ParserRuleContext): string[] | undefined {
	const path = firstOfRule(node, P.RULE_path_expression);
	if (path) return pathParts(path);
	const id = firstOfRule(node, P.RULE_identifier);
	return id ? [identText(id)] : undefined;
}

// NOTE (editor-gold Task 2, quotedness-survives-lowering): BigQuery is the DOCUMENTED exception to
// the keep-raw convention the other dialects follow. Backticks are not case-quoting here — the fold
// rules (src/ident/fold.ts) treat a quoted identifier exactly like its unquoted twin for every kind
// (tables preserve case, everything else lowers, quoted or not) — so stripping the delimiter at
// lower time loses NO identity information. And it is structurally required: one backticked token
// may embed a dotted path (`proj.ds.t`) that pathParts/dashedPathParts must split into name parts.
// (Backslash-escaped backticks inside a quoted identifier are not unescaped here — pre-existing,
// exotic; fold.ts documents the escape rule.)
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
		if (
			child instanceof ParserRuleContext &&
			child.ruleIndex !== P.RULE_parenthesized_query &&
			hasTokenDeep(child, type)
		) {
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

/** A clause's single `expression` child, honestly: no clause at all -> undefined; a clause present but
 *  recovery dropped its expression child -> otherExpr(clause) (a real cst, never a fabricated one);
 *  clause + expression both present -> the real lowered Expr. Keeps lowerExpr's invariant — every Expr
 *  it returns carries a genuine ParserRuleContext cst — without threading a parent through every call. */
function optionalClauseExpr(clause: ParserRuleContext | undefined): Expr | undefined {
	if (!clause) return undefined;
	const e = directChildrenOfRule(clause, P.RULE_expression)[0];
	return e ? lowerExpr(e) : otherExpr(clause);
}

function emptyBody(cst: ParserRuleContext, reason: UnsupportedFlag): SelectExpr {
	return { kind: "select", projections: [], from: [], columns: [], aggregated: false, unsupported: [reason], cst };
}

function emptyQuery(cst: ParserRuleContext, reason: UnsupportedFlag): QueryExpr {
	return { kind: "query", ctes: [], body: emptyBody(cst, reason), cst };
}
