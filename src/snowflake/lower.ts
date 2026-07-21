import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import { SnowflakeParser as P } from "../generated/snowflake/SnowflakeParser.js";
import type {
	Clause,
	ColumnRef,
	CteDef,
	Expr,
	Join,
	JoinKind,
	LimitInfo,
	PivotInfo,
	Projection,
	QueryBody,
	QueryExpr,
	SelectExpr,
	Source,
	UnpivotInfo,
	UnsupportedFlag,
	VariableDecl,
} from "../ir/ir.js";
import { keywordCategory, swallowedCategories, swallowedStatements, type StatementCategory } from "../ir/statement.js";
import { partSpanOf, partSpansOf, type PartSpan } from "../ir/part-span.js";
import { freezeIR } from "../ir/freeze.js";
import { qualifiedNameOf, type QualifiedName } from "../ir/qualified-name.js";
import { displayName, SNOWFLAKE_NAME_CONFIG } from "./fold.js";

/** The structured name for a table source's raw parts (issue #38) — role assignment + identity
 *  key + fqn happen HERE, at lowering, where the dialect's namespace shape is known. */
function relationOf(rawParts: string[]): QualifiedName {
	return qualifiedNameOf(rawParts, SNOWFLAKE_NAME_CONFIG);
}

// ---------------------------------------------------------------------------
// Lowering — Snowflake (grammars-v4 sql/snowflake fork) CST -> the shared,
// dialect-neutral IR (src/ir/ir.ts). The semantic layer runs on the IR
// unchanged; only this file knows Snowflake's grammar. Core query path:
// query_statement, select_statement, table_sources, search_condition, expr.
// Constructs not yet mapped become explicit `other`/`unsupported`, never
// silently dropped. QUALIFY, the SELECT * modifiers (EXCLUDE/ILIKE/REPLACE/
// RENAME), and CONNECT BY (LEVEL pseudo-column) are modelled onto shared IR
// fields; sequence `<seq>.NEXTVAL` refs lower to typed function exprs.
//
// Navigation is by rule index against the generated parser. Nested
// `subquery`/`select_statement` nodes belong to their own scope, so shallow
// walks never descend into them. A `scripting_block` (a Snowflake Scripting
// `BEGIN...END` compound, optionally `DECLARE`-prefixed) is a statement
// *sequence*, not a nested scope, but gets the same shallow-walk boundary:
// otherwise a search for a query/select statement would happily descend into
// it and claim its first inner SELECT as the whole file's query.
// ---------------------------------------------------------------------------

// docs.snowflake.com/en/sql-reference/functions-aggregation
const AGGREGATES = new Set([
	"any_value",
	"approx_count_distinct",
	"approx_percentile",
	"approx_top_k",
	"array_agg",
	"arrayagg",
	"avg",
	"bitand_agg",
	"bitor_agg",
	"bitxor_agg",
	"booland_agg",
	"boolor_agg",
	"boolxor_agg",
	"corr",
	"count",
	"count_if",
	"covar_pop",
	"covar_samp",
	"grouping",
	"grouping_id",
	"hll",
	"kurtosis",
	"listagg",
	"max",
	"max_by",
	"median",
	"min",
	"min_by",
	"mode",
	"object_agg",
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
	"skew",
	"stddev",
	"stddev_pop",
	"stddev_samp",
	"sum",
	"var_pop",
	"var_samp",
	"variance",
]);

/** The fixed output columns of FLATTEN / SPLIT_TO_TABLE:
 *  docs.snowflake.com/en/sql-reference/functions/flatten (output section). */
const FLATTEN_COLUMNS = ["SEQ", "KEY", "PATH", "INDEX", "VALUE", "THIS"];
const SPLIT_TO_TABLE_COLUMNS = ["SEQ", "INDEX", "VALUE"];

/** The pseudo-column a CONNECT BY hierarchical query exposes (the node's depth, root = 1):
 *  docs.snowflake.com/en/sql-reference/constructs/connect-by */
const CONNECT_BY_PSEUDO_COLUMNS = ["LEVEL"];

/** Lower a parsed Snowflake file (snowflake_file: a `;`-separated batch) into the IR.
 *  A single query statement lowers fully; anything else (DDL, DML, multi-statement
 *  batches) becomes a flagged non-query body — a valid parse never throws. */
export function lower(tree: ParserRuleContext): QueryExpr {
	const q = lowerImpl(tree);
	q.dialect = "snowflake";
	return freezeIR(q);
}

function lowerImpl(tree: ParserRuleContext): QueryExpr {
	const statement = statementCategory(tree);
	const batch = firstOfRule(tree, P.RULE_batch);
	const commands = batch ? directChildrenOfRule(batch, P.RULE_sql_command) : [];
	// Recovery-swallowed statements count toward batch-ness: a broken statement makes recovery dump
	// the rest of the batch as flat error nodes, so the command count alone under-reports.
	const swallowed = swallowedStatements(tree);
	const total = commands.length + swallowed;
	if (total !== 1 || commands.length !== 1) {
		// A multi-statement batch is a flagged compound. Anchor its span to the FIRST command,
		// NOT the whole `snowflake_file` container (which reaches EOF): a whole-file span on a
		// flagged body makes a downstream AST index read a bogus enclosure over commands 2..n.
		// Bounding to command 1 keeps the span honest — the "compound" kind + "multi-statement"
		// flag already tell a consumer this is an unmodelled batch (issue #21). Empty stays `tree`.
		const cst = total > 1 && commands.length > 0 ? commands[0] : tree;
		const q = nonQuery(cst, total > 1 ? "multi-statement" : total === 1 ? "broken" : "empty");
		q.statement = statement;
		return q;
	}
	const q = lowerCommand(commands[0]);
	q.statement = statement;
	return q;
}

/**
 * Lower a single `sql_command` into a QueryExpr: a `query_statement` gets its real body; a
 * `create_materialized_view`-style bare `select_statement` gets its real body (see the
 * query_statement-miss comment below); a standalone Snowflake Scripting BEGIN...END block
 * (isScriptingBlock) gets the flagged "compound" stub PLUS its own declarations/statements
 * (applyScriptingFrame — the routine-frame slice's Snowflake counterpart, see tsql's
 * applyRoutineFrame); anything else gets the flagged "non-query" stub. Shared by the top-level
 * batch's single-command case (lowerImpl) and each scripting-block inner statement whose own
 * alternative is a nested `sql_command` (lowerInnerScriptingStatement) — a nested scripting block
 * recurses through this SAME function, so nesting layers naturally.
 */
function lowerCommand(cmd: ParserRuleContext): QueryExpr {
	const qs = shallowFirstOfRule(cmd, P.RULE_query_statement);
	if (qs) return lowerQueryStatement(qs);
	// create_materialized_view's body is `AS select_statement`, not `AS query_statement` like its
	// sibling CREATE forms (grammars/snowflake/SnowflakeParser.g4 create_materialized_view — upstream
	// comment: "MATERIALIZED VIEW accept only simple select statement at this time"), so the
	// query_statement search above misses it; fall back to a bare select_statement.
	const stmt = shallowFirstOfRule(cmd, P.RULE_select_statement);
	if (stmt) return selectStatementToQuery(stmt);
	// A standalone Snowflake Scripting BEGIN...END block (isScriptingBlock) is a statement
	// *sequence*, not a query — flag the whole thing as "compound" (mirrors databricks'
	// isCompound/"compound" convention) rather than the generic "non-query".
	if (isScriptingBlock(cmd)) {
		const q = nonQuery(cmd, "compound");
		applyScriptingFrame(q, cmd);
		return q;
	}
	return nonQuery(cmd, "non-query");
}

/** Layers a Snowflake Scripting BEGIN...END block's DECLARE-section variables (declarations) and
 *  body statements (statements[]) onto the container's existing flagged "compound" QueryExpr —
 *  docs.snowflake.com/en/developer-guide/snowflake-scripting/blocks. `cmd` is the sql_command whose
 *  isScriptingBlock is true. */
function applyScriptingFrame(q: QueryExpr, cmd: ParserRuleContext): void {
	const oc = directChildrenOfRule(cmd, P.RULE_other_command)[0];
	const sb = oc ? directChildrenOfRule(oc, P.RULE_scripting_block)[0] : undefined;
	const tsb = sb ? directChildrenOfRule(sb, P.RULE_task_scripting_block)[0] : undefined;
	if (!tsb) return;
	// DECLARE <name> (<data_type>|RESULTSET); ... — the block's own signature-like preamble, parallel
	// to a routine's signature parameters (tsql's procedure_param): container-level declarations.
	const declList = directChildrenOfRule(tsb, P.RULE_task_scripting_declaration_list)[0];
	if (declList) {
		const decls = directChildrenOfRule(declList, P.RULE_task_scripting_declaration).map(lowerScriptingDeclaration);
		if (decls.length) q.declarations = decls;
	}
	const stmtList = directChildrenOfRule(tsb, P.RULE_task_scripting_statement_list)[0];
	if (stmtList) {
		const units = directChildrenOfRule(stmtList, P.RULE_task_scripting_statement);
		if (units.length) q.statements = units.map(lowerInnerScriptingStatement);
	}
}

/** One `task_scripting_declaration` (`id_ (data_type | RESULTSET)`, no initializer in this grammar)
 *  -> a VariableDecl. RESULTSET is a Snowflake Scripting variable type, not a general data_type
 *  (docs.snowflake.com/en/developer-guide/snowflake-scripting/variables), so it rides as typeText
 *  the same as a normal declared type. */
function lowerScriptingDeclaration(node: ParserRuleContext): VariableDecl {
	const idNode = directChildrenOfRule(node, P.RULE_id_)[0];
	const dt = directChildrenOfRule(node, P.RULE_data_type)[0];
	return {
		name: idNode?.getText() ?? "",
		nameSpan: (idNode && partSpanOf(idNode)) ?? partSpanOf(node) ?? ZERO_PART_SPAN,
		typeText: dt?.getText() ?? (hasDirectToken(node, P.RESULTSET) ? "RESULTSET" : undefined),
		cst: node,
	};
}

/** One `task_scripting_let` (`LET id_ (data_type | RESULTSET)? (DEFAULT | COLON EQ) expr`) -> a
 *  VariableDecl: declare-and-assign inline, so — unlike task_scripting_declaration — this one DOES
 *  carry a real `init` Expr, lowered through the same shared expr machinery as any other value.
 *  docs.snowflake.com/en/developer-guide/snowflake-scripting/variables */
function lowerScriptingLet(node: ParserRuleContext): VariableDecl {
	const idNode = directChildrenOfRule(node, P.RULE_id_)[0];
	const dt = directChildrenOfRule(node, P.RULE_data_type)[0];
	const exprNode = directChildrenOfRule(node, P.RULE_expr)[0];
	return {
		name: idNode?.getText() ?? "",
		nameSpan: (idNode && partSpanOf(idNode)) ?? partSpanOf(node) ?? ZERO_PART_SPAN,
		typeText: dt?.getText() ?? (hasDirectToken(node, P.RESULTSET) ? "RESULTSET" : undefined),
		init: exprNode ? lowerExpr(exprNode) : undefined,
		cst: node,
	};
}

/** A fallback span for the never-should-happen case a scripting variable's own id_ token is
 *  missing (a broken/partial parse): stays a valid `PartSpan` rather than `undefined`. */
const ZERO_PART_SPAN: PartSpan = { start: 0, end: 0, line: 0, column: 0, endLine: 0, endColumn: 0 };

/** Lower one inner statement of a Snowflake Scripting body (a `task_scripting_statement` node) into
 *  its own QueryExpr — the routine-frame slice's Snowflake counterpart of tsql's
 *  lowerInnerStatement. `sql_command` reuses lowerCommand (a real query gets its real body; a
 *  nested scripting block gets its own declarations/statements, recursively). `task_scripting_let`
 *  declares AND assigns, so its own declaration rides this statement's `declarations` (mirrors a
 *  tsql body DECLARE: mid-body, not container-level — rootDeclarations pools the whole tree
 *  regardless). `call` / `task_scripting_assignment` / `task_scripting_return` are scripting-only
 *  with no query body: honest flagged stubs, categorised like other_command's grab-bag alternatives
 *  (CALL -> utility via keywordCategory; a bare assignment/RETURN carries no recognised verb ->
 *  "other"). RETURN's own expression is deliberately NOT modelled, matching tsql's routine RETURN
 *  (a synthetic projection would be fabricated structure this dialect never wrote). */
function lowerInnerScriptingStatement(unit: ParserRuleContext): QueryExpr {
	const cmd = directChildrenOfRule(unit, P.RULE_sql_command)[0];
	if (cmd) {
		const q = lowerCommand(cmd);
		q.statement = commandCategory(cmd);
		return q;
	}
	const letNode = directChildrenOfRule(unit, P.RULE_task_scripting_let)[0];
	if (letNode) {
		const q = nonQuery(unit, "non-query");
		q.statement = "other";
		q.declarations = [lowerScriptingLet(letNode)];
		return q;
	}
	const q = nonQuery(unit, "non-query");
	q.statement = keywordCategory(unit.start?.text ?? "");
	return q;
}

/** other_command's `scripting_block` alternative: a standalone Snowflake Scripting anonymous
 *  block (`BEGIN...END`, optionally `DECLARE`-prefixed) — docs.snowflake.com/en/developer-guide/
 *  snowflake-scripting/blocks. A statement *sequence*, not a query; mirrors databricks'
 *  isCompound: the whole block gets flagged rather than modelling whichever SELECT happens to
 *  come first inside it. */
function isScriptingBlock(cmd: ParserRuleContext): boolean {
	const oc = directChildrenOfRule(cmd, P.RULE_other_command)[0];
	return !!oc && directChildrenOfRule(oc, P.RULE_scripting_block).length > 0;
}

/** A bare select_statement (no WITH, no set ops — e.g. create_materialized_view's `AS select_statement`)
 *  as a standalone QueryExpr, mirroring ssipToQuery/lowerQueryStatement for the wrapped forms. */
function selectStatementToQuery(stmt: ParserRuleContext): QueryExpr {
	const body = buildSelect(stmt);
	const orderBy = extractOrderBy(stmt);
	if (orderBy) for (const o of orderBy) columnsOf(o, body.columns, "orderBy");
	const limit = extractLimit(stmt);
	return { kind: "query", ctes: [], body, orderBy, limit, cst: stmt };
}

/**
 * The statement category, from the parse. Snowflake's `sql_command` groups its alternatives, so the
 * structural cases are exact: `ddl_command` → ddl, `dml_command` → query (its `query_statement`
 * alternative) or dml, and the SHOW / USE / DESCRIBE commands → utility. A `;`-separated batch of
 * more than one command is a compound script. `other_command` (GRANT, transaction control, SET, …)
 * carries no finer rule, so its leading keyword is the authoritative signal.
 */
function statementCategory(tree: ParserRuleContext): StatementCategory {
	const cats = statementCategories(tree);
	if (cats.length === 0) return "other";
	if (cats.length > 1) return "compound";
	return cats[0];
}

/** Per-statement categories for every `sql_command` in a parsed `snowflake_file`, in source order —
 *  the file-level view behind statementCategory (which folds >1 into "compound"), using the same
 *  `commandCategory` per element. Parity with the other dialects; feeds the corpus reclassifier. */
export function statementCategories(tree: ParserRuleContext): StatementCategory[] {
	const batch = firstOfRule(tree, P.RULE_batch);
	const commands = batch ? directChildrenOfRule(batch, P.RULE_sql_command) : [];
	// Recovery-swallowed statements append as "other" — honest count, no keyword guessing.
	return [...commands.map(commandCategory), ...swallowedCategories(tree)];
}

function commandCategory(cmd: ParserRuleContext): StatementCategory {
	if (directChildrenOfRule(cmd, P.RULE_ddl_command).length) return "ddl";
	const dml = directChildrenOfRule(cmd, P.RULE_dml_command)[0];
	if (dml) return directChildrenOfRule(dml, P.RULE_query_statement).length ? "query" : "dml";
	if (
		directChildrenOfRule(cmd, P.RULE_show_command).length ||
		directChildrenOfRule(cmd, P.RULE_use_command).length ||
		directChildrenOfRule(cmd, P.RULE_describe_command).length
	) {
		return "utility";
	}
	// A BEGIN...END scripting block is a compound statement sequence, not a transaction-control
	// statement — check before the keyword fallback below would misread its leading BEGIN as TCL.
	if (isScriptingBlock(cmd)) return "compound";
	// A FLOW pipe or other_command — categorise by its leading keyword.
	return keywordCategory(cmd.start?.text ?? "");
}

function nonQuery(cst: ParserRuleContext, reason: UnsupportedFlag): QueryExpr {
	return {
		kind: "query",
		ctes: [],
		body: { kind: "select", projections: [], from: [], columns: [], aggregated: false, unsupported: [reason], cst },
		cst,
	};
}

/** query_statement: with_expression? select_statement_in_parentheses set_operators* */
function lowerQueryStatement(qs: ParserRuleContext): QueryExpr {
	const withNode = directChildrenOfRule(qs, P.RULE_with_expression)[0];
	const ctes = withNode ? directChildrenOfRule(withNode, P.RULE_common_table_expression).map(lowerCte) : [];
	const ssip = directChildrenOfRule(qs, P.RULE_select_statement_in_parentheses)[0];
	const chain: SetChainItem[] = [];
	if (ssip) collectSetChain(ssip, chain);
	for (const u of directChildrenOfRule(qs, P.RULE_set_operators)) collectSetOperator(u, chain);
	const body = foldSetChain(chain, qs);
	// ORDER BY / LIMIT live inside the select_statement; hoist to the query level
	// when the body is that single select.
	const stmt = ssip ? onlySelectStatement(ssip) : undefined;
	const orderBy = stmt && body.kind === "select" ? extractOrderBy(stmt) : undefined;
	if (orderBy && body.kind !== "pipe") for (const o of orderBy) columnsOf(o, body.columns, "orderBy");
	const limit = stmt && body.kind === "select" ? extractLimit(stmt) : undefined;
	return { kind: "query", ctes, body, orderBy, limit, cst: qs };
}

function lowerCte(cte: ParserRuleContext): CteDef {
	// common_table_expression: id_ ('(' column_list ')')? AS select_statement_in_parentheses
	const nameNode = directChildrenOfRule(cte, P.RULE_id_)[0];
	const name = nameNode?.getText() ?? "";
	const colList = directChildrenOfRule(cte, P.RULE_column_list_in_parentheses)[0];
	const cols = colList
		? collectOfRule(colList, P.RULE_column_name).map((c) => c.getText())
		: directChildrenOfRule(cte, P.RULE_column_list)
				.flatMap((l) => collectOfRule(l, P.RULE_column_name))
				.map((c) => c.getText());
	const ssip = directChildrenOfRule(cte, P.RULE_select_statement_in_parentheses)[0];
	return {
		name,
		nameCst: nameNode,
		columnAliases: cols.length ? cols : undefined,
		body: ssip ? ssipToQuery(ssip) : emptyQuery(cte),
		cst: cte,
	};
}

/** A select_statement_in_parentheses as a standalone QueryExpr (CTE body, FROM subquery). */
function ssipToQuery(ssip: ParserRuleContext): QueryExpr {
	const body = lowerSsip(ssip);
	const stmt = onlySelectStatement(ssip);
	const orderBy = stmt && body.kind === "select" ? extractOrderBy(stmt) : undefined;
	if (orderBy && body.kind !== "pipe") for (const o of orderBy) columnsOf(o, body.columns, "orderBy");
	const limit = stmt && body.kind === "select" ? extractLimit(stmt) : undefined;
	return { kind: "query", ctes: [], body, orderBy, limit, cst: ssip };
}

/** A set-operation chain in source order: bodies interleaved with operator nodes.
 *  The grammar nests `ssip set_operators` rightward; Snowflake's UNION/EXCEPT/MINUS are
 *  left-associative, so the chain is linearized first and folded left. */
type SetChainItem = { body: QueryBody } | { opNode: ParserRuleContext };

/** select_statement_in_parentheses:
 *  '(' ssip ')' | ssip set_operators | select_statement | with_expression */
function collectSetChain(ssip: ParserRuleContext, chain: SetChainItem[]): void {
	const stmt = directChildrenOfRule(ssip, P.RULE_select_statement)[0];
	if (stmt) {
		chain.push({ body: buildSelect(stmt) });
	} else {
		const inner = directChildrenOfRule(ssip, P.RULE_select_statement_in_parentheses)[0];
		if (inner) {
			// '(' ssip ')' — an explicitly parenthesized branch keeps its own grouping.
			if (hasDirectToken(ssip, P.LR_BRACKET)) chain.push({ body: lowerSsip(inner) });
			else collectSetChain(inner, chain);
		} else {
			chain.push({ body: emptyBody(ssip) });
		}
	}
	for (const u of directChildrenOfRule(ssip, P.RULE_set_operators)) collectSetOperator(u, chain);
}

function collectSetOperator(u: ParserRuleContext, chain: SetChainItem[]): void {
	chain.push({ opNode: u });
	const ssip = directChildrenOfRule(u, P.RULE_select_statement_in_parentheses)[0];
	if (ssip) collectSetChain(ssip, chain);
}

function foldSetChain(chain: SetChainItem[], cst: ParserRuleContext): QueryBody {
	let body: QueryBody | undefined;
	let pendingOp: ParserRuleContext | undefined;
	for (const item of chain) {
		if ("opNode" in item) {
			pendingOp = item.opNode;
			continue;
		}
		if (body === undefined) {
			body = item.body;
		} else {
			const t = pendingOp ? directTokenType(pendingOp, [P.UNION, P.EXCEPT, P.MINUS_, P.INTERSECT]) : undefined;
			const op = t === P.INTERSECT ? "intersect" : t === P.EXCEPT || t === P.MINUS_ ? "except" : "union";
			const byName = pendingOp !== undefined && directChildrenOfRule(pendingOp, P.RULE_by_name).length > 0;
			body = {
				kind: "setop",
				op,
				all: pendingOp !== undefined && hasDirectToken(pendingOp, P.ALL),
				byName: byName || undefined,
				left: body,
				right: item.body,
				columns: [],
				cst: pendingOp ?? cst,
			};
			pendingOp = undefined;
		}
	}
	return body ?? emptyBody(cst);
}

function lowerSsip(ssip: ParserRuleContext): QueryBody {
	const chain: SetChainItem[] = [];
	collectSetChain(ssip, chain);
	return foldSetChain(chain, ssip);
}

/** The single select_statement of an ssip chain, when it is exactly one (no set ops). */
function onlySelectStatement(ssip: ParserRuleContext): ParserRuleContext | undefined {
	if (directChildrenOfRule(ssip, P.RULE_set_operators).length) return undefined;
	const stmt = directChildrenOfRule(ssip, P.RULE_select_statement)[0];
	if (stmt) return stmt;
	const inner = directChildrenOfRule(ssip, P.RULE_select_statement_in_parentheses)[0];
	return inner ? onlySelectStatement(inner) : undefined;
}

// --- the SELECT body ---------------------------------------------------------

function buildSelect(stmt: ParserRuleContext): SelectExpr {
	const selectList = firstOfRule(stmt, P.RULE_select_list);
	const projections = selectList
		? directChildrenOfRule(selectList, P.RULE_select_list_elem).map(buildProjection)
		: [];

	const optional = directChildrenOfRule(stmt, P.RULE_select_optional_clauses)[0];
	const fromClause = optional ? directChildrenOfRule(optional, P.RULE_from_clause)[0] : undefined;
	const sources = fromClause ? shallowNodesOfRule(fromClause, P.RULE_object_ref) : [];
	const from: Source[] = sources.map(buildSource);

	// CONNECT BY hierarchical query: its START WITH / CONNECT BY predicates are ordinary exprs whose
	// columns are conserved (below); LEVEL enters scope as a lateral pseudo-source exposing "LEVEL".
	const connectByNodes = fromClause ? connectByRefs(fromClause) : [];
	const connectByExprs = connectByNodes.flatMap(connectByPredicates);
	if (connectByNodes.length) from.push(levelPseudoSource(connectByNodes[0]));

	const whereSc = optional
		? directChildrenOfRule(
				directChildrenOfRule(optional, P.RULE_where_clause)[0] ?? optional,
				P.RULE_search_condition,
			)[0]
		: undefined;
	const whereExpr = whereSc ? lowerSearch(whereSc) : undefined;

	const groupByClause = optional ? firstOfRule(optional, P.RULE_group_by_clause) : undefined;
	const groupBy = groupByClause ? extractGroupBy(groupByClause) : undefined;
	const groupByAll = groupByClause !== undefined && hasDirectToken(groupByClause, P.ALL);

	const havingClause = optional ? shallowFirstOfRule(optional, P.RULE_having_clause) : undefined;
	const havingSc = havingClause ? directChildrenOfRule(havingClause, P.RULE_search_condition)[0] : undefined;
	const having = havingSc ? lowerSearch(havingSc) : undefined;

	// qualify_clause: QUALIFY expr
	const qualifyClause = optional ? shallowFirstOfRule(optional, P.RULE_qualify_clause) : undefined;
	const qualifyExpr = qualifyClause ? directChildrenOfRule(qualifyClause, P.RULE_expr)[0] : undefined;
	const qualifyP = qualifyClause ? directChildrenOfRule(qualifyClause, P.RULE_predicate)[0] : undefined;
	const qualify = qualifyExpr ? lowerExpr(qualifyExpr) : qualifyP ? lowerPredicate(qualifyP) : undefined;

	const joinConditions: Expr[] = [];
	const onByCst = new Map<ParserRuleContext, Expr>();
	if (fromClause) extractJoinConditions(fromClause, joinConditions, onByCst);
	const joins = fromClause ? buildJoins(fromClause, from, onByCst) : [];
	const subqueries = extractExpressionSubqueries(stmt, fromSubqueryNodes(from));

	const aggregated =
		groupByAll ||
		(groupBy !== undefined && groupBy.length > 0) ||
		projections.some((p) => hasAggregate(p.expr)) ||
		(having !== undefined && hasAggregate(having));

	const columns: ColumnRef[] = [];
	for (const p of projections) columnsOf(p.expr, columns, "projection");
	if (whereExpr) columnsOf(whereExpr, columns, "where");
	for (const j of joinConditions) columnsOf(j, columns, "join");
	for (const g of groupBy ?? []) columnsOf(g, columns, "groupBy");
	if (having) columnsOf(having, columns, "having");
	if (qualify) columnsOf(qualify, columns, "qualify");
	for (const e of connectByExprs) columnsOf(e, columns, "where");

	return {
		kind: "select",
		projections,
		from,
		columns,
		where: whereExpr,
		joinConditions: joinConditions.length ? joinConditions : undefined,
		joins: joins.length ? joins : undefined,
		groupBy,
		having,
		qualify,
		aggregated,
		subqueries: subqueries.length ? subqueries : undefined,
		pivot: fromClause ? extractPivot(fromClause) : undefined,
		unpivot: fromClause ? extractUnpivot(fromClause) : undefined,
		cst: stmt,
	};
}

/** TOP n (in the select list) or the trailing LIMIT/OFFSET/FETCH clause. */
function extractLimit(stmt: ParserRuleContext): LimitInfo | undefined {
	const info: LimitInfo = {};
	let any = false;

	const top = firstOfRule(stmt, P.RULE_top_clause);
	const topNum = top ? directChildrenOfRule(top, P.RULE_num)[0] : undefined;
	if (topNum) {
		any = true;
		info.top = { kind: "literal", text: topNum.getText(), cst: topNum };
	}

	// limit_clause: LIMIT num (OFFSET num)? | (OFFSET num)? row_rows? FETCH first_next? num row_rows? ONLY?
	const limit = directChildrenOfRule(stmt, P.RULE_limit_clause)[0];
	if (limit) {
		any = true;
		const nums = directChildrenOfRule(limit, P.RULE_num);
		if (hasDirectToken(limit, P.LIMIT)) {
			if (nums[0]) info.top = { kind: "literal", text: nums[0].getText(), cst: nums[0] };
			if (nums[1]) info.offset = { kind: "literal", text: nums[1].getText(), cst: nums[1] };
		} else {
			// OFFSET comes first in the FETCH form.
			let i = 0;
			if (hasDirectToken(limit, P.OFFSET)) {
				if (nums[i]) info.offset = { kind: "literal", text: nums[i].getText(), cst: nums[i] };
				i++;
			}
			if (nums[i]) info.fetch = { kind: "literal", text: nums[i].getText(), cst: nums[i] };
		}
	}
	return any ? info : undefined;
}

function extractOrderBy(stmt: ParserRuleContext): Expr[] | undefined {
	const optional = directChildrenOfRule(stmt, P.RULE_select_optional_clauses)[0];
	const obc = optional ? shallowFirstOfRule(optional, P.RULE_order_by_clause) : undefined;
	if (!obc) return undefined;
	const items = directChildrenOfRule(obc, P.RULE_order_item).map(lowerOrderItem);
	return items.length ? items : undefined;
}

/** order_item: (id_ | num | expr) (ASC|DESC)? (NULLS (FIRST|LAST))? */
function lowerOrderItem(item: ParserRuleContext): Expr {
	const expr = directChildrenOfRule(item, P.RULE_expr)[0];
	if (expr) return lowerExpr(expr);
	const id = directChildrenOfRule(item, P.RULE_id_)[0];
	if (id) return { kind: "column", parts: [id.getText()], partSpans: partSpansOf([id]), cst: id };
	const num = directChildrenOfRule(item, P.RULE_num)[0];
	if (num) return { kind: "literal", text: num.getText(), cst: num };
	return otherExpr(item);
}

/** group_by_clause: GROUP BY group_by_list having? | GROUP BY ALL. A group_by_elem may be a
 *  CUBE/ROLLUP/GROUPING SETS or parenthesized-sublist WRAPPER nesting further elems; only the
 *  leaf elems are group keys, so wrappers (direct group_by_list child, or the empty `()`) are
 *  skipped — their leaves are collected on their own. */
function extractGroupBy(clause: ParserRuleContext): Expr[] | undefined {
	const elems = collectOfRule(clause, P.RULE_group_by_elem).filter(
		(e) =>
			directChildrenOfRule(e, P.RULE_column_elem).length > 0 ||
			directChildrenOfRule(e, P.RULE_num).length > 0 ||
			directChildrenOfRule(e, P.RULE_expression_elem).length > 0,
	);
	const items = elems.map((e) => {
		const col = directChildrenOfRule(e, P.RULE_column_elem)[0];
		if (col) return lowerColumnElem(col);
		const num = directChildrenOfRule(e, P.RULE_num)[0];
		if (num) return { kind: "literal", text: num.getText(), cst: num } satisfies Expr;
		const ee = directChildrenOfRule(e, P.RULE_expression_elem)[0];
		const inner = ee
			? (directChildrenOfRule(ee, P.RULE_expr)[0] ?? directChildrenOfRule(ee, P.RULE_predicate_only)[0])
			: undefined;
		return inner
			? inner.ruleIndex === P.RULE_predicate_only
				? lowerPredicate(inner)
				: lowerExpr(inner)
			: otherExpr(e);
	});
	return items.length ? items : undefined;
}

function extractJoinConditions(
	fromClause: ParserRuleContext,
	out: Expr[],
	onByCst: Map<ParserRuleContext, Expr>,
): void {
	for (const jc of shallowNodesOfRule(fromClause, P.RULE_join_clause)) {
		const onUsing = directChildrenOfRule(jc, P.RULE_on_using_clause)[0];
		const sc = onUsing ? directChildrenOfRule(onUsing, P.RULE_search_condition)[0] : undefined;
		// Lower the ON once, keyed by its search_condition CST so buildJoins shares the same Expr.
		if (sc) {
			const e = lowerSearch(sc);
			out.push(e);
			onByCst.set(sc, e);
		}
		// ASOF JOIN … MATCH_CONDITION ( expr ): the temporal-match predicate. Conserved in joinConditions
		// (order unchanged) but not separately linked onto the Join (its `on` is the ON search_condition).
		const match = directChildrenOfRule(jc, P.RULE_expr)[0];
		if (match) out.push(lowerExpr(match));
	}
}

/** The FROM-clause JOIN chain as Join[]: one per join_clause, in tree (source) order. `join.source` is
 *  the reference-identical `from` entry (matched by the join's object_ref CST); `join.on` is the shared
 *  ON Expr from onByCst; USING columns come from the on_using_clause. */
function buildJoins(fromClause: ParserRuleContext, from: Source[], onByCst: Map<ParserRuleContext, Expr>): Join[] {
	const sourceByCst = new Map<ParserRuleContext, Source>();
	for (const s of from) sourceByCst.set(s.cst, s);
	const joins: Join[] = [];
	for (const jc of shallowNodesOfRule(fromClause, P.RULE_join_clause)) {
		const ref = directChildrenOfRule(jc, P.RULE_object_ref)[0];
		const source = ref ? sourceByCst.get(ref) : undefined;
		if (!source) continue;
		const { kind, natural } = snowflakeJoinKind(jc);
		const onUsing = directChildrenOfRule(jc, P.RULE_on_using_clause)[0];
		let on: Expr | undefined;
		let using: string[] | undefined;
		if (onUsing) {
			const sc = directChildrenOfRule(onUsing, P.RULE_search_condition)[0];
			if (sc) on = onByCst.get(sc);
			else using = columnListAliases(onUsing);
		}
		joins.push({ kind, source, on, using, natural: natural || undefined, cst: jc });
	}
	return joins;
}

/** Kind + NATURAL flag for a Snowflake `join_clause` (join_type? | NATURAL | CROSS | ASOF). join_type
 *  is INNER or an outer_join child (LEFT|RIGHT|FULL OUTER?). */
function snowflakeJoinKind(jc: ParserRuleContext): { kind: JoinKind; natural: boolean } {
	const natural = directTokenType(jc, [P.NATURAL]) !== undefined;
	if (directTokenType(jc, [P.CROSS]) !== undefined) return { kind: "cross", natural: false };
	if (directTokenType(jc, [P.ASOF]) !== undefined) return { kind: "asof", natural: false };
	const jt = directChildrenOfRule(jc, P.RULE_join_type)[0];
	let ansi: JoinKind | undefined;
	if (jt) {
		if (directTokenType(jt, [P.INNER]) !== undefined) {
			ansi = "inner";
		} else {
			const oj = directChildrenOfRule(jt, P.RULE_outer_join)[0] ?? jt;
			const t = directTokenType(oj, [P.LEFT, P.RIGHT, P.FULL]);
			if (t === P.LEFT) ansi = "left";
			else if (t === P.RIGHT) ansi = "right";
			else if (t === P.FULL) ansi = "full";
		}
	}
	return { kind: ansi ?? (natural ? "natural" : "inner"), natural };
}

// --- CONNECT BY --------------------------------------------------------------
// object_ref: object_name START WITH predicate CONNECT BY prior_list?
// docs.snowflake.com/en/sql-reference/constructs/connect-by

/** The FROM object_refs that carry a CONNECT BY (hierarchical) clause. */
function connectByRefs(fromClause: ParserRuleContext): ParserRuleContext[] {
	return shallowNodesOfRule(fromClause, P.RULE_object_ref).filter((r) => hasDirectToken(r, P.CONNECT));
}

/** The START WITH predicate and each CONNECT BY prior-item equality, as ordinary exprs. Their column
 *  refs are conserved into the select's `columns` (columnsOf) so scope/qualify see them; the exprs
 *  themselves are not otherwise retained (mirrors join conditions' column conservation). */
function connectByPredicates(ref: ParserRuleContext): Expr[] {
	const out: Expr[] = [];
	const startPred = directChildrenOfRule(ref, P.RULE_predicate)[0];
	if (startPred) out.push(lowerPredicate(startPred));
	const priorList = directChildrenOfRule(ref, P.RULE_prior_list)[0];
	if (priorList)
		for (const item of directChildrenOfRule(priorList, P.RULE_prior_item)) out.push(lowerPriorItem(item));
	return out;
}

/** prior_item: PRIOR? id_ EQ PRIOR? id_ — an equality between two (possibly PRIOR-qualified) columns.
 *  `PRIOR x` lowers as a `prior(x)` function over the column, so columnsOf still reaches `x`. */
function lowerPriorItem(item: ParserRuleContext): Expr {
	const sides: Expr[] = [];
	let pendingPrior = false;
	for (let i = 0; i < item.getChildCount(); i++) {
		const c = item.getChild(i);
		if (c instanceof TerminalNode && c.symbol.type === P.PRIOR) {
			pendingPrior = true;
			continue;
		}
		if (c instanceof ParserRuleContext && c.ruleIndex === P.RULE_id_) {
			const col: Expr = {
				kind: "column",
				parts: [c.getText()],
				partSpans: partSpansOf([c]),
				cst: c,
			};
			sides.push(
				pendingPrior
					? { kind: "function", name: "prior", args: [col], aggregate: false, distinct: false, cst: item }
					: col,
			);
			pendingPrior = false;
		}
	}
	return {
		kind: "binary",
		op: "=",
		left: sides[0] ?? otherExpr(item),
		right: sides[1] ?? otherExpr(item),
		cst: item,
	};
}

/** A lateral pseudo-source exposing the CONNECT BY pseudo-column(s) so `SELECT LEVEL` resolves. */
function levelPseudoSource(cst: ParserRuleContext): Source {
	return { kind: "lateral", columns: CONNECT_BY_PSEUDO_COLUMNS, pseudo: true, cst };
}

// --- PIVOT / UNPIVOT ---------------------------------------------------------

function extractPivot(fromClause: ParserRuleContext): PivotInfo | undefined {
	// pivot_unpivot: PIVOT '(' aggFn '(' aggCol ')' FOR forCol IN '(' pivot_in_clause ')' … ')' (from_alias …)?
	// The trailing RESULT alias is a `from_alias` (post-source slot: bare branch excludes PIVOT/UNPIVOT).
	const node = shallowNodesOfRule(fromClause, P.RULE_pivot_unpivot)[0];
	if (!node || !hasDirectToken(node, P.PIVOT)) return undefined;
	const ids = directChildrenOfRule(node, P.RULE_id_).map((i) => i.getText());
	// ids = [aggFn, aggColumn, forColumn] per the rule shape.
	const inClause = directChildrenOfRule(node, P.RULE_pivot_in_clause)[0];
	const values = inClause ? directChildrenOfRule(inClause, P.RULE_literal).map((l) => stripString(l.getText())) : [];
	const alias = directChildrenOfRule(node, P.RULE_from_alias)[0];
	return {
		values,
		forColumns: ids[2] !== undefined ? [ids[2]] : [],
		aggColumns: ids[1] !== undefined ? [ids[1]] : [],
		alias: alias ? fromAliasParts(alias).text : undefined,
	};
}

function extractUnpivot(fromClause: ParserRuleContext): UnpivotInfo | undefined {
	// UNPIVOT … '(' valueCol FOR nameCol IN '(' aliased_column_list ')' ')'
	const node = shallowNodesOfRule(fromClause, P.RULE_pivot_unpivot)[0];
	if (!node || !hasDirectToken(node, P.UNPIVOT)) return undefined;
	const valueCol = directChildrenOfRule(node, P.RULE_id_)[0];
	const nameCol = directChildrenOfRule(node, P.RULE_column_name)[0];
	const list = directChildrenOfRule(node, P.RULE_aliased_column_list)[0];
	const removed = list ? collectOfRule(list, P.RULE_column_name).map((c) => c.getText()) : [];
	return {
		valueColumn: valueCol ? valueCol.getText() : "",
		nameColumn: nameCol ? nameCol.getText() : "",
		removed,
	};
}

// --- projections --------------------------------------------------------------

function buildProjection(elem: ParserRuleContext): Projection {
	// column_elem_star star_modifier* — docs.snowflake.com/en/sql-reference/sql/select
	const star = directChildrenOfRule(elem, P.RULE_column_elem_star)[0];
	if (star) {
		const qualifier = directChildrenOfRule(star, P.RULE_object_name_or_alias)[0];
		const expr: Extract<Expr, { kind: "star" }> = {
			kind: "star",
			qualifier: qualifier ? nameParts(qualifier) : undefined,
			cst: star,
		};
		for (const mod of directChildrenOfRule(elem, P.RULE_star_modifier)) {
			const excludeClause = directChildrenOfRule(mod, P.RULE_exclude_clause)[0];
			if (excludeClause) {
				expr.exclude = [
					...(expr.exclude ?? []),
					...collectOfRule(excludeClause, P.RULE_column_name).map((c) => c.getText()),
				];
			} else if (hasDirectToken(mod, P.ILIKE)) {
				const pat = directChildrenOfRule(mod, P.RULE_string)[0];
				expr.ilike = stripString(pat?.getText() ?? "");
			} else if (hasDirectToken(mod, P.REPLACE)) {
				const exprs = directChildrenOfRule(mod, P.RULE_expr);
				const names = directChildrenOfRule(mod, P.RULE_column_name);
				expr.replace = [
					...(expr.replace ?? []),
					...exprs.map((e, i) => ({ column: names[i]?.getText() ?? "", expr: lowerExpr(e) })),
				];
			} else if (hasDirectToken(mod, P.RENAME)) {
				const names = directChildrenOfRule(mod, P.RULE_column_name);
				const pairs: { from: string; to: string }[] = [];
				for (let i = 0; i + 1 < names.length; i += 2) {
					pairs.push({ from: names[i].getText(), to: names[i + 1].getText() });
				}
				expr.rename = [...(expr.rename ?? []), ...pairs];
			}
		}
		return { name: undefined, isStar: true, expr, cst: elem };
	}

	const alias = directChildrenOfRule(elem, P.RULE_as_alias)[0];
	// Adjacent-qualifier (`CONNECT_BY_ROOT title`) and $n positional refs keep their own
	// alternative (column_elem_adjacent — neither is an expr form); dotted-name projections now
	// arrive as expression_elem and are classified as columns below (the SLL-surgery
	// select_list_elem de-overlap, 2026-07-03).
	const colAdjacent = directChildrenOfRule(elem, P.RULE_column_elem_adjacent)[0];
	if (colAdjacent) {
		const expr = lowerColumnElem(colAdjacent);
		const name = alias ? aliasText(alias) : expr.kind === "column" ? expr.parts[expr.parts.length - 1] : undefined;
		return { name, isStar: false, expr, ...(alias ? { aliasCst: aliasCstOf(alias) } : {}), cst: elem };
	}

	const exprElem = directChildrenOfRule(elem, P.RULE_expression_elem)[0];
	const inner = exprElem
		? (directChildrenOfRule(exprElem, P.RULE_expr)[0] ?? directChildrenOfRule(exprElem, P.RULE_predicate_only)[0])
		: undefined;
	const expr = inner
		? inner.ruleIndex === P.RULE_predicate_only
			? lowerPredicate(inner)
			: lowerExpr(inner)
		: otherExpr(elem);
	let name = alias ? aliasText(alias) : undefined;
	if (name === undefined && expr.kind === "column") name = expr.parts[expr.parts.length - 1];
	return { name, isStar: false, expr, ...(alias ? { aliasCst: aliasCstOf(alias) } : {}), cst: elem };
}

/** column_elem: object_name_or_alias? column_name | object_name_or_alias? DOLLAR column_position —
 *  also accepts column_elem_adjacent, whose adjacency form carries a bare object_name qualifier. */
function lowerColumnElem(colElem: ParserRuleContext): Expr {
	const qualifier =
		directChildrenOfRule(colElem, P.RULE_object_name_or_alias)[0] ??
		directChildrenOfRule(colElem, P.RULE_object_name)[0];
	const qParts = qualifier ? nameParts(qualifier) : [];
	if (hasDirectToken(colElem, P.DOLLAR)) {
		// `$n` positional — the last part is synthesized (not a token), so partSpans is omitted (all-or-nothing).
		const pos = directChildrenOfRule(colElem, P.RULE_column_position)[0];
		return { kind: "column", parts: [...qParts, `$${pos?.getText() ?? ""}`], cst: colElem };
	}
	const col = directChildrenOfRule(colElem, P.RULE_column_name)[0];
	const cParts = col ? nameParts(col) : [];
	// Concat the qualifier's and column's per-part spans; undefined if either falls back to a dotted split.
	const qSpans = qualifier ? namePartSpans(qualifier) : [];
	const cSpans = col ? namePartSpans(col) : [];
	const partSpans = qSpans && cSpans ? [...qSpans, ...cSpans] : undefined;
	return { kind: "column", parts: [...qParts, ...cParts], partSpans, cst: colElem };
}

// A FROM-source alias node is `from_alias : AS alias | bare_from_alias` (grammar). Read its text and
// the identifier CST node (for the alias's precise span) from whichever branch matched: the `AS alias`
// branch nests an `id_`; the bare branch is a `bare_from_alias` (id_ minus the reserved LEFT/RIGHT).
function fromAliasParts(fa: ParserRuleContext | undefined): {
	text?: string;
	cst?: ParserRuleContext;
} {
	if (!fa) return {};
	const node = firstOfRule(fa, P.RULE_id_) ?? directChildrenOfRule(fa, P.RULE_bare_from_alias)[0];
	return { text: node ? node.getText() : fa.getText(), cst: node };
}

function aliasText(asAlias: ParserRuleContext): string {
	const a = firstOfRule(asAlias, P.RULE_id_);
	return a ? a.getText() : asAlias.getText();
}

/** The alias identifier's own span: as_alias (`AS? alias`, alias `: id_`) → its id_ (dropping AS). */
function aliasCstOf(asAlias: ParserRuleContext): ParserRuleContext {
	return firstOfRule(asAlias, P.RULE_id_) ?? asAlias;
}

// --- sources -------------------------------------------------------------------

function buildSource(ref: ParserRuleContext): Source {
	const asAlias = directChildrenOfRule(ref, P.RULE_from_alias)[0];
	const { text: alias, cst: aliasCst } = fromAliasParts(asAlias);

	// LATERAL FLATTEN(…) f / LATERAL SPLIT_TO_TABLE(…) s — fixed output columns.
	const flatten = directChildrenOfRule(ref, P.RULE_flatten_table)[0];
	const split = directChildrenOfRule(ref, P.RULE_splited_table)[0];
	if (flatten || split) {
		return {
			kind: "lateral",
			alias,
			aliasCst,
			columns: flatten ? FLATTEN_COLUMNS : SPLIT_TO_TABLE_COLUMNS,
			cst: ref,
		};
	}

	// (LATERAL)? ( subquery ) — a derived table.
	const sub = directChildrenOfRule(ref, P.RULE_subquery)[0];
	if (sub) {
		return {
			kind: "subquery",
			query: lowerSubquery(sub),
			alias,
			aliasCst,
			columnAliases: columnListAliases(ref),
			cst: ref,
		};
	}

	// VALUES (…), (…) [v (c1, c2)] — lowers to a modelled select (literal projections
	// named column1…columnN, Snowflake's default VALUES output names).
	const values = directChildrenOfRule(ref, P.RULE_values_table)[0];
	if (values) {
		const body = firstOfRule(values, P.RULE_values_table_body);
		const firstRow = body ? directChildrenOfRule(body, P.RULE_expr_list_in_parentheses)[0] : undefined;
		const exprs = firstRow
			? directChildrenOfRule(directChildrenOfRule(firstRow, P.RULE_expr_list)[0] ?? firstRow, P.RULE_expr)
			: [];
		const projections: Projection[] = exprs.map((e, i) => ({
			name: `column${i + 1}`,
			isStar: false,
			expr: lowerExpr(e),
			cst: e,
		}));
		const innerAs = directChildrenOfRule(values, P.RULE_from_alias)[0];
		const { text: valuesAliasText, cst: valuesAliasCst } = fromAliasParts(innerAs);
		const colAliases = firstOfRule(values, P.RULE_column_alias_list_in_brackets);
		return {
			kind: "subquery",
			query: {
				kind: "query",
				ctes: [],
				body: { kind: "select", projections, from: [], columns: [], aggregated: false, cst: values },
				cst: values,
			},
			alias: innerAs ? valuesAliasText : alias,
			aliasCst: valuesAliasCst ?? aliasCst,
			columnAliases: colAliases
				? directChildrenOfRule(colAliases, P.RULE_id_).map((i) => i.getText())
				: undefined,
			cst: ref,
		};
	}

	// TABLE(fn(…)) — a TVF: opaque columns (they need the function's signature). A
	// TABLE(FLATTEN(…)) is the lateral form in disguise.
	const fn = directChildrenOfRule(ref, P.RULE_function_call)[0];
	if (fn) {
		const name = functionName(fn);
		if (name.toLowerCase() === "flatten") {
			return { kind: "lateral", alias, aliasCst, columns: FLATTEN_COLUMNS, cst: ref };
		}
		if (name.toLowerCase() === "split_to_table") {
			return { kind: "lateral", alias, aliasCst, columns: SPLIT_TO_TABLE_COLUMNS, cst: ref };
		}
		return {
			kind: "table",
			relation: relationOf([name]),
			alias,
			aliasCst,
			columnAliases: columnListAliases(ref),
			cst: ref,
		};
	}

	// @stage[/path] — an opaque staged-file source ($1-style columns need the file).
	const stage =
		directChildrenOfRule(ref, P.RULE_named_stage)[0] ??
		directChildrenOfRule(ref, P.RULE_user_stage)[0] ??
		directChildrenOfRule(ref, P.RULE_table_stage)[0];
	if (stage) {
		return {
			kind: "table",
			relation: relationOf([stage.getText()]),
			alias,
			aliasCst,
			cst: ref,
		};
	}

	// CONNECT BY hierarchies: object_name START WITH predicate CONNECT BY prior_list? — the base
	// relation is this object_name (built below); the START WITH / CONNECT BY predicates and the LEVEL
	// pseudo-column are handled at the select level (extractConnectBy / the LEVEL pseudo-source).
	const objectName = directChildrenOfRule(ref, P.RULE_object_name)[0];
	const parts = objectName ? nameParts(objectName) : [ref.getText()];
	return {
		kind: "table",
		relation: relationOf(parts),
		namePartSpans: objectName ? namePartSpans(objectName) : undefined,
		alias,
		aliasCst,
		columnAliases: columnListAliases(ref),
		cst: ref,
	};
}

function columnListAliases(ref: ParserRuleContext): string[] | undefined {
	const list = directChildrenOfRule(ref, P.RULE_column_list_in_parentheses)[0];
	if (!list) return undefined;
	const cols = collectOfRule(list, P.RULE_column_name).map((c) => c.getText());
	return cols.length ? cols : undefined;
}

// --- search_condition / predicate ---------------------------------------------

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
		const sub = directChildrenOfRule(pred, P.RULE_subquery)[0];
		return sub ? { kind: "exists", query: lowerSubquery(sub), cst: pred } : otherExpr(pred);
	}
	const exprs = directChildrenOfRule(pred, P.RULE_expr);
	const operand = exprs[0] ? lowerExpr(exprs[0]) : otherExpr(pred);
	const negated = hasDirectToken(pred, P.NOT);

	if (hasDirectToken(pred, P.BETWEEN)) {
		return { kind: "predicate", op: "between", negated, operand, args: exprs.slice(1).map(lowerExpr), cst: pred };
	}
	if (hasDirectToken(pred, P.IN)) {
		const sub = directChildrenOfRule(pred, P.RULE_subquery)[0];
		const args = sub
			? [{ kind: "subquery" as const, query: lowerSubquery(sub), cst: sub }]
			: exprListExprs(pred).map(lowerExpr);
		return { kind: "predicate", op: "in", negated, operand, args, cst: pred };
	}
	const likeTok = directTokenType(pred, [P.LIKE, P.ILIKE, P.RLIKE, P.REGEXP]);
	if (likeTok !== undefined) {
		// REGEXP is a documented synonym of RLIKE: docs.snowflake.com/en/sql-reference/functions/regexp
		const op = likeTok === P.RLIKE || likeTok === P.REGEXP ? "rlike" : likeTok === P.ILIKE ? "ilike" : "like";
		return { kind: "predicate", op, negated, operand, args: exprs.slice(1, 2).map(lowerExpr), cst: pred };
	}
	// expr comparison_operator (ALL|SOME|ANY) ( subquery )
	const cmp = directChildrenOfRule(pred, P.RULE_comparison_operator)[0];
	if (cmp) {
		const sub = directChildrenOfRule(pred, P.RULE_subquery)[0];
		const right: Expr = sub
			? { kind: "subquery", query: lowerSubquery(sub), cst: sub }
			: exprs[1]
				? lowerExpr(exprs[1])
				: otherExpr(pred);
		return { kind: "binary", op: cmp.getText(), left: operand, right, cst: pred };
	}
	// fallthrough: a bare expr used as a boolean
	return exprs.length === 1 ? operand : otherExpr(pred);
}

function exprListExprs(node: ParserRuleContext): ParserRuleContext[] {
	// expr_list, or the spread-capable variant used by IN lists and list functions
	// (its direct expr children are the plain values; spread_expr elements are skipped).
	const list =
		directChildrenOfRule(node, P.RULE_expr_list)[0] ?? directChildrenOfRule(node, P.RULE_spread_or_expr_list)[0];
	return list ? directChildrenOfRule(list, P.RULE_expr) : [];
}

// --- expressions ----------------------------------------------------------------

function lowerExpr(node: ParserRuleContext): Expr {
	if (node.ruleIndex !== P.RULE_expr) return lowerExprChild(node);
	const exprs = directChildrenOfRule(node, P.RULE_expr);

	// <seq>.NEXTVAL — a sequence's next value; a NUMBER-returning pseudo-function. The sequence path
	// rides as the `qualifier` (Task 1a's field); infer types it via the Snowflake `special` hook.
	// docs.snowflake.com/en/sql-reference/functions/nextval
	if (hasDirectToken(node, P.NEXTVAL)) {
		const obj = directChildrenOfRule(node, P.RULE_object_name)[0];
		const parts = obj ? nameParts(obj) : [];
		return {
			kind: "function",
			name: "nextval",
			qualifier: parts.length ? parts.join(".").toLowerCase() : undefined,
			args: [],
			aggregate: false,
			distinct: false,
			cst: node,
		};
	}

	// expr :: data_type — cast
	if (hasDirectToken(node, P.COLON_COLON)) {
		const dt = directChildrenOfRule(node, P.RULE_data_type)[0];
		return {
			kind: "cast",
			expr: exprs[0] ? lowerExpr(exprs[0]) : otherExpr(node),
			typeText: dt ? dt.getText() : "",
			cst: node,
		};
	}
	// expr [ expr ] — subscript
	if (hasDirectToken(node, P.LSB) && exprs.length === 2) {
		return { kind: "subscript", base: lowerExpr(exprs[0]), index: lowerExpr(exprs[1]), cst: node };
	}
	// expr : path — semi-structured access; the path adds no column refs of its own.
	if (hasDirectToken(node, P.COLON) && exprs.length === 2) {
		return {
			kind: "subscript",
			base: lowerExpr(exprs[0]),
			index: { kind: "literal", text: exprs[1].getText(), cst: exprs[1] },
			cst: node,
		};
	}
	// expr . VALUE / expr . expr — dotted access; merge column chains where possible.
	if (hasDirectToken(node, P.DOT) && exprs.length >= 1) {
		const base = lowerExpr(exprs[0]);
		const rhs = exprs[1];
		if (rhs) {
			const access = lowerExpr(rhs);
			if (base.kind === "column" && access.kind === "column") {
				const partSpans =
					base.partSpans && access.partSpans ? [...base.partSpans, ...access.partSpans] : undefined;
				return { kind: "column", parts: [...base.parts, ...access.parts], partSpans, cst: node };
			}
			return {
				kind: "subscript",
				base,
				index: { kind: "literal", text: rhs.getText(), cst: rhs },
				cst: node,
			};
		}
		return { kind: "subscript", base, index: { kind: "literal", text: "value", cst: node }, cst: node };
	}
	// expr ! method ( args ) — class-instance method call
	if (hasDirectToken(node, P.BANG)) {
		const method = directChildrenOfRule(node, P.RULE_id_)[0];
		const positional = exprListExprs(node).map(lowerExpr);
		const paramAssoc = directChildrenOfRule(node, P.RULE_param_assoc_list).flatMap(paramAssocValues);
		const base = exprs[0] ? lowerExpr(exprs[0]) : otherExpr(node);
		const args = [base, ...positional, ...paramAssoc.map((v) => v.arg)];
		const argNames = [undefined, ...positional.map(() => undefined), ...paramAssoc.map((v) => v.name)];
		return {
			kind: "function",
			name: method ? method.getText() : "",
			args,
			...(argNames.some((n) => n !== undefined) ? { argNames } : {}),
			aggregate: false,
			distinct: false,
			cst: node,
		};
	}
	// expr OVER (…) — window applied to the inner call
	const over = directChildrenOfRule(node, P.RULE_over_clause)[0];
	if (over && exprs.length === 1) {
		const inner = lowerExpr(exprs[0]);
		const window = lowerOver(over);
		if (inner.kind === "function") return { ...inner, window, cst: node };
		return inner.kind === "other" ? inner : { ...inner, cst: node };
	}
	// IS [NOT] NULL / IS [NOT] DISTINCT FROM
	if (hasDirectToken(node, P.IS)) {
		const operand = exprs[0] ? lowerExpr(exprs[0]) : otherExpr(node);
		const ndf = directChildrenOfRule(node, P.RULE_not_distinct_from)[0];
		if (ndf) {
			return {
				kind: "predicate",
				op: "distinct from",
				negated: hasDirectToken(ndf, P.NOT),
				operand,
				args: exprs.slice(1).map(lowerExpr),
				cst: node,
			};
		}
		const nnn = directChildrenOfRule(node, P.RULE_null_not_null)[0];
		return {
			kind: "predicate",
			op: "null",
			negated: nnn !== undefined && hasDirectToken(nnn, P.NOT),
			operand,
			args: [],
			cst: node,
		};
	}
	// [NOT] IN ( subquery | expr_list )
	if (hasDirectToken(node, P.IN)) {
		const operand = exprs[0] ? lowerExpr(exprs[0]) : otherExpr(node);
		const sub = directChildrenOfRule(node, P.RULE_subquery)[0];
		const args = sub
			? [{ kind: "subquery" as const, query: lowerSubquery(sub), cst: sub }]
			: exprListExprs(node).map(lowerExpr);
		return { kind: "predicate", op: "in", negated: hasDirectToken(node, P.NOT), operand, args, cst: node };
	}
	// [NOT] LIKE / ILIKE / RLIKE / REGEXP (an RLIKE synonym)
	const likeTok = directTokenType(node, [P.LIKE, P.ILIKE, P.RLIKE, P.REGEXP]);
	if (likeTok !== undefined && exprs.length >= 2) {
		const op = likeTok === P.RLIKE || likeTok === P.REGEXP ? "rlike" : likeTok === P.ILIKE ? "ilike" : "like";
		return {
			kind: "predicate",
			op,
			negated: hasDirectToken(node, P.NOT),
			operand: lowerExpr(exprs[0]),
			args: [lowerExpr(exprs[1])],
			cst: node,
		};
	}
	// lambda: lambda_params -> expr
	const lambdaParams = directChildrenOfRule(node, P.RULE_lambda_params)[0];
	if (lambdaParams && exprs.length === 1) {
		const params = directChildrenOfRule(lambdaParams, P.RULE_id_).map((i) => i.getText());
		return { kind: "lambda", params, body: lowerExpr(exprs[0]), cst: node };
	}
	// binary: AND / OR / arithmetic / concat / comparison
	if (exprs.length === 2) {
		const cmp = directChildrenOfRule(node, P.RULE_comparison_operator)[0];
		const opTok = directTokenType(node, [P.AND, P.OR, P.STAR, P.DIVIDE, P.MODULE, P.PLUS, P.MINUS, P.PIPE_PIPE]);
		const op = cmp
			? cmp.getText()
			: opTok === P.AND
				? "and"
				: opTok === P.OR
					? "or"
					: (tokenText(node, opTok) ?? "");
		return { kind: "binary", op, left: lowerExpr(exprs[0]), right: lowerExpr(exprs[1]), cst: node };
	}
	// unary: NOT expr / + expr / - expr / COLLATE passthrough
	if (exprs.length === 1) {
		if (hasDirectToken(node, P.NOT)) {
			return { kind: "unary", op: "not", operand: lowerExpr(exprs[0]), cst: node };
		}
		const sign = directTokenType(node, [P.PLUS, P.MINUS]);
		if (sign !== undefined) {
			return { kind: "unary", op: sign === P.MINUS ? "-" : "+", operand: lowerExpr(exprs[0]), cst: node };
		}
		if (hasDirectToken(node, P.COLLATE)) return lowerExpr(exprs[0]);
		return lowerExpr(exprs[0]);
	}
	// single-child productions
	const child = firstRuleChild(node);
	return child ? lowerExprChild(child) : otherExpr(node);
}

/** Lower a non-`expr` expression-production node. */
function lowerExprChild(node: ParserRuleContext): Expr {
	switch (node.ruleIndex) {
		case P.RULE_bind_variable:
			return lowerBindVariable(node);
		case P.RULE_primitive_expression:
			return lowerPrimitive(node);
		case P.RULE_literal:
			return { kind: "literal", text: node.getText(), cst: node };
		case P.RULE_full_column_name:
			return { kind: "column", parts: nameParts(node), partSpans: namePartSpans(node), cst: node };
		case P.RULE_case_expression:
			return lowerCase(node);
		case P.RULE_iff_expr:
			return lowerIff(node);
		case P.RULE_bracket_expression: {
			const sub = directChildrenOfRule(node, P.RULE_subquery)[0];
			if (sub) return { kind: "subquery", query: lowerSubquery(sub), cst: node };
			const inner = exprListExprs(node);
			return inner[0] ? lowerExpr(inner[0]) : otherExpr(node);
		}
		case P.RULE_arr_literal: {
			const values = collectOfRule(node, P.RULE_value).map((v) => {
				const e = directChildrenOfRule(v, P.RULE_expr)[0];
				return e ? lowerExpr(e) : otherExpr(v);
			});
			return {
				kind: "function",
				name: "array_construct",
				args: values,
				aggregate: false,
				distinct: false,
				cst: node,
			};
		}
		case P.RULE_json_literal: {
			const values = collectOfRule(node, P.RULE_kv_pair).map((kv) => {
				const v = directChildrenOfRule(kv, P.RULE_value)[0];
				const e = v ? directChildrenOfRule(v, P.RULE_expr)[0] : undefined;
				return e ? lowerExpr(e) : otherExpr(kv);
			});
			return {
				kind: "function",
				name: "object_construct",
				args: values,
				aggregate: false,
				distinct: false,
				cst: node,
			};
		}
		case P.RULE_cast_expr: {
			const inner = directChildrenOfRule(node, P.RULE_expr)[0];
			const dt = directChildrenOfRule(node, P.RULE_data_type)[0];
			// CAST(e AS t) where t is a built-in type or a user-defined type (an object_name) —
			// or the literal prefix form DATE '…' / TIMESTAMP '…' / INTERVAL '…'.
			const udt = directChildrenOfRule(node, P.RULE_object_name)[0];
			const lead = leftmostToken(node)?.toUpperCase();
			const typeText = dt ? dt.getText() : udt ? udt.getText() : (lead ?? "");
			return { kind: "cast", expr: inner ? lowerExpr(inner) : otherExpr(node), typeText, cst: node };
		}
		case P.RULE_try_cast_expr: {
			const inner = directChildrenOfRule(node, P.RULE_expr)[0];
			const dt = directChildrenOfRule(node, P.RULE_data_type)[0];
			return {
				kind: "cast",
				expr: inner ? lowerExpr(inner) : otherExpr(node),
				typeText: dt ? dt.getText() : "",
				cst: node,
			};
		}
		case P.RULE_trim_expression: {
			const name = leftmostToken(node)?.toLowerCase() ?? "trim";
			const args = directChildrenOfRule(node, P.RULE_expr).map(lowerExpr);
			return { kind: "function", name, args, aggregate: false, distinct: false, cst: node };
		}
		case P.RULE_function_call:
			return lowerFunctionCall(node);
		case P.RULE_subquery:
			return { kind: "subquery", query: lowerSubquery(node), cst: node };
		case P.RULE_expr:
			return lowerExpr(node);
		default:
			return otherExpr(node);
	}
}

/** primitive_expression: DEFAULT | id_ ('.' id_)* | id_ '.' STAR | degenerate_column_ref | literal | …
 *  (NULL arrives via literal; empty-segment refs via degenerate_column_ref — SLL surgery 2026-07-03). */
function lowerPrimitive(node: ParserRuleContext): Expr {
	const lit = directChildrenOfRule(node, P.RULE_literal)[0];
	if (lit) return { kind: "literal", text: lit.getText(), cst: node };
	if (hasDirectToken(node, P.DEFAULT) || hasDirectToken(node, P.NULL_)) {
		return { kind: "literal", text: node.getText(), cst: node };
	}
	if (hasDirectToken(node, P.STAR)) {
		const ids = directChildrenOfRule(node, P.RULE_id_).map((i) => i.getText());
		return { kind: "star", qualifier: ids.length ? ids : undefined, cst: node };
	}
	const fcn =
		directChildrenOfRule(node, P.RULE_full_column_name)[0] ??
		directChildrenOfRule(node, P.RULE_degenerate_column_ref)[0];
	if (fcn) return { kind: "column", parts: nameParts(fcn), partSpans: namePartSpans(fcn), cst: node };
	const ids = directChildrenOfRule(node, P.RULE_id_);
	if (ids.length)
		return {
			kind: "column",
			parts: ids.map((i) => i.getText()),
			partSpans: partSpansOf(ids),
			cst: node,
		};
	return { kind: "literal", text: node.getText(), cst: node };
}

/** bind_variable: QMARK | COLON id_. A caller-bound placeholder as a general value expression.
 *  `?` is positional (no name; its position is the CONSUMER's derivation, never fabricated here);
 *  `:name` is named (the id_, the leading COLON sigil stripped). `text` is the token as written
 *  (lossless). Distinct from a `$var` session variable (which lowers as a column via id_); vendors
 *  document them separately: docs.snowflake.com/en/sql-reference/bind-variables */
function lowerBindVariable(node: ParserRuleContext): Expr {
	const id = directChildrenOfRule(node, P.RULE_id_)[0];
	return id
		? { kind: "parameter", text: node.getText(), name: id.getText(), cst: node }
		: { kind: "parameter", text: node.getText(), cst: node };
}

function lowerIff(node: ParserRuleContext): Expr {
	// IFF '(' search_condition ',' expr ',' expr ')' → a two-armed case.
	const cond = directChildrenOfRule(node, P.RULE_search_condition)[0];
	const exprs = directChildrenOfRule(node, P.RULE_expr);
	return {
		kind: "case",
		whens: [
			{
				when: cond ? lowerSearch(cond) : otherExpr(node),
				then: exprs[0] ? lowerExpr(exprs[0]) : otherExpr(node),
			},
		],
		elseExpr: exprs[1] ? lowerExpr(exprs[1]) : undefined,
		cst: node,
	};
}

function lowerCase(node: ParserRuleContext): Expr {
	const searchedSecs = directChildrenOfRule(node, P.RULE_switch_search_condition_section);
	const simpleSecs = directChildrenOfRule(node, P.RULE_switch_section);
	const directExprs = directChildrenOfRule(node, P.RULE_expr);

	if (searchedSecs.length > 0) {
		const whens = searchedSecs.map((sec) => {
			const cond = directChildrenOfRule(sec, P.RULE_search_condition)[0];
			const thenE = directChildrenOfRule(sec, P.RULE_expr)[0];
			return {
				when: cond ? lowerSearch(cond) : otherExpr(sec),
				then: thenE ? lowerExpr(thenE) : otherExpr(sec),
			};
		});
		return { kind: "case", whens, elseExpr: directExprs[0] ? lowerExpr(directExprs[0]) : undefined, cst: node };
	}

	// Simple CASE <subject> WHEN v THEN r … — desugar to `subject = v` so columns/types see the subject.
	const subject = directExprs[0] ? lowerExpr(directExprs[0]) : otherExpr(node);
	const whens = simpleSecs.map((sec) => {
		const es = directChildrenOfRule(sec, P.RULE_expr);
		const whenVal = es[0] ? lowerExpr(es[0]) : otherExpr(sec);
		const thenE = es[1] ? lowerExpr(es[1]) : otherExpr(sec);
		return { when: { kind: "binary" as const, op: "=", left: subject, right: whenVal, cst: sec }, then: thenE };
	});
	const elseExpr = directExprs.length > 1 ? lowerExpr(directExprs[directExprs.length - 1]) : undefined;
	return { kind: "case", whens, elseExpr, cst: node };
}

function lowerFunctionCall(node: ParserRuleContext): Expr {
	// ranking_windowed_function: (RANK|DENSE_RANK|ROW_NUMBER|NTILE|LEAD|LAG|FIRST_VALUE|LAST_VALUE) (…) over_clause
	const ranking = directChildrenOfRule(node, P.RULE_ranking_windowed_function)[0];
	if (ranking) {
		const name = leftmostToken(ranking)?.toLowerCase() ?? "";
		const args = directChildrenOfRule(ranking, P.RULE_expr).map(lowerExpr);
		const over = firstOfRule(ranking, P.RULE_over_clause);
		return {
			kind: "function",
			name,
			args,
			aggregate: false,
			distinct: false,
			window: over ? lowerOver(over) : undefined,
			cst: node,
		};
	}

	const agg = directChildrenOfRule(node, P.RULE_aggregate_function)[0];
	if (agg) {
		const id = directChildrenOfRule(agg, P.RULE_id_)[0];
		const name = (id ? displayName(id.getText()) : (leftmostToken(agg) ?? "")).toLowerCase();
		const args = [
			...exprListExprs(agg).map(lowerExpr),
			...directChildrenOfRule(agg, P.RULE_expr).map(lowerExpr),
			// WITHIN GROUP (ORDER BY …) keys are arguments too — they feed the aggregate.
			...collectOfRule(agg, P.RULE_order_item).map(lowerOrderItem),
		];
		return {
			kind: "function",
			name,
			args,
			aggregate: AGGREGATES.has(name),
			distinct: hasTokenShallow(agg, P.DISTINCT),
			cst: node,
		};
	}

	// EXTRACT LR_BRACKET (id_ | string) (FROM | COMMA) expr RR_BRACKET: the date-part operand is an
	// id_/string child, not an expr, so the generic collection below drops it and every
	// EXTRACT(part FROM ts) call under-counts to one argument (a wrong-arity false positive on valid
	// SQL once the arity checker trusts the generated signatures). Lowered as a literal, never a
	// column ref: a date part must not join name resolution.
	if (hasTokenShallow(node, P.EXTRACT)) {
		const part = directChildrenOfRule(node, P.RULE_id_)[0] ?? directChildrenOfRule(node, P.RULE_string)[0];
		const partArgs: Expr[] = part ? [{ kind: "literal", text: part.getText(), cst: part }] : [];
		return {
			kind: "function",
			name: "extract",
			args: [...partArgs, ...directChildrenOfRule(node, P.RULE_expr).map(lowerExpr)],
			aggregate: false,
			distinct: false,
			cst: node,
		};
	}

	const name = functionName(node);
	const positional = [
		...exprListExprs(node).map(lowerExpr),
		...directChildrenOfRule(node, P.RULE_expr).map(lowerExpr),
	];
	const paramAssoc = directChildrenOfRule(node, P.RULE_param_assoc_list).flatMap(paramAssocValues);
	// the object_name(func_arg_list) alternative — positional exprs and named-arg values
	// (STAR / stage / spread / TYPE args carry no expr payload and add nothing here).
	// Also the SLL-surgery wave's home for plain f(args) calls (2026-07-03).
	const funcArg = directChildrenOfRule(node, P.RULE_func_arg_list).flatMap(funcArgValues);
	const args = [...positional, ...paramAssoc.map((v) => v.arg), ...funcArg.map((v) => v.arg)];
	const argNames = [
		...positional.map(() => undefined),
		...paramAssoc.map((v) => v.name),
		...funcArg.map((v) => v.name),
	];
	return {
		kind: "function",
		name: name.toLowerCase(),
		args,
		// Named-argument invocation `fn(name => value)`: the per-arg names make the call
		// conservation-visible and let the arity checker's named-arg bypass fire (a named call's
		// positional count says nothing about the documented positional signature).
		...(argNames.some((n) => n !== undefined) ? { argNames } : {}),
		aggregate: AGGREGATES.has(name.toLowerCase()),
		distinct: hasTokenShallow(node, P.DISTINCT),
		cst: node,
	};
}

/** One func_arg's lowered value plus its `name =>` parameter name (undefined for a plain positional
 *  expr). STAR / stage / spread / TYPE / TABLE(...) args carry no expr payload and are skipped. */
function funcArgValues(list: ParserRuleContext): { arg: Expr; name: string | undefined }[] {
	return directChildrenOfRule(list, P.RULE_func_arg).flatMap((fa) => {
		const e = directChildrenOfRule(fa, P.RULE_expr)[0];
		if (e) return [{ arg: lowerExpr(e), name: undefined }];
		const pa = directChildrenOfRule(fa, P.RULE_param_assoc)[0];
		const one = pa ? oneParamAssoc(pa) : undefined;
		return one ? [one] : [];
	});
}

/** param_assoc_list: every param_assoc child, each lowered via oneParamAssoc. */
function paramAssocValues(list: ParserRuleContext): { arg: Expr; name: string | undefined }[] {
	return directChildrenOfRule(list, P.RULE_param_assoc)
		.map(oneParamAssoc)
		.filter((v): v is { arg: Expr; name: string | undefined } => v !== undefined);
}

/** param_assoc: `(id_ | FILE_FORMAT | PATTERN | LIMIT) ASSOC expr`; the name is the id_ rule when
 *  present, else the leading keyword token itself. */
function oneParamAssoc(pa: ParserRuleContext): { arg: Expr; name: string | undefined } | undefined {
	const e = directChildrenOfRule(pa, P.RULE_expr)[0];
	if (!e) return undefined;
	const id = directChildrenOfRule(pa, P.RULE_id_)[0];
	const name = id ? id.getText() : leftmostToken(pa);
	return { arg: lowerExpr(e), name };
}

function functionName(node: ParserRuleContext): string {
	const obj = directChildrenOfRule(node, P.RULE_object_name)[0];
	if (obj) {
		const parts = nameParts(obj);
		return parts[parts.length - 1] ?? "";
	}
	const listFn = directChildrenOfRule(node, P.RULE_list_function)[0];
	if (listFn) return listFn.getText();
	for (const r of [
		P.RULE_unary_or_binary_builtin_function,
		P.RULE_binary_builtin_function,
		P.RULE_binary_or_ternary_builtin_function,
		P.RULE_ternary_builtin_function,
	]) {
		const b = directChildrenOfRule(node, r)[0];
		if (b) return b.getText();
	}
	return leftmostToken(node) ?? "";
}

function lowerOver(over: ParserRuleContext): { partitionBy: Expr[]; orderBy: Expr[]; cst: ParserRuleContext } {
	const pb = directChildrenOfRule(over, P.RULE_partition_by)[0];
	const partitionBy = pb ? exprListExprs(pb).map(lowerExpr) : [];
	const obe = directChildrenOfRule(over, P.RULE_order_by_expr)[0];
	const sorted = obe ? directChildrenOfRule(obe, P.RULE_expr_list_sorted)[0] : undefined;
	const orderBy = sorted ? directChildrenOfRule(sorted, P.RULE_expr).map(lowerExpr) : [];
	return { partitionBy, orderBy, cst: over };
}

function lowerSubquery(sub: ParserRuleContext): QueryExpr {
	const qs = directChildrenOfRule(sub, P.RULE_query_statement)[0];
	return qs ? lowerQueryStatement(qs) : emptyQuery(sub);
}

// --- column extraction (single source of truth for SelectExpr.columns) --------

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
		if (child.ruleIndex === P.RULE_subquery || child.ruleIndex === P.RULE_select_statement) continue;
		if (child.ruleIndex === P.RULE_full_column_name) {
			acc.push({
				kind: "columnref",
				parts: nameParts(child),
				clause,
				cst: child,
				partSpans: namePartSpans(child),
			});
			continue;
		}
		if (child.ruleIndex === P.RULE_primitive_expression) {
			const e = lowerPrimitive(child);
			if (e.kind === "column")
				acc.push({ kind: "columnref", parts: e.parts, clause, cst: child, partSpans: e.partSpans });
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

// --- expression subqueries (scalar / IN / EXISTS) ------------------------------

function fromSubqueryNodes(from: Source[]): Set<ParserRuleContext> {
	const set = new Set<ParserRuleContext>();
	for (const s of from) {
		if (s.kind === "subquery") {
			const q = firstOfRule(s.cst, P.RULE_subquery);
			if (q) set.add(q);
		}
	}
	return set;
}

function extractExpressionSubqueries(stmt: ParserRuleContext, fromQueries: Set<ParserRuleContext>): QueryExpr[] {
	const out: QueryExpr[] = [];
	const walk = (n: ParseTree): void => {
		for (let i = 0; i < n.getChildCount(); i++) {
			const child = n.getChild(i);
			if (!(child instanceof ParserRuleContext)) continue;
			if (child.ruleIndex === P.RULE_subquery) {
				if (!fromQueries.has(child)) out.push(lowerSubquery(child));
				continue; // its own scope — don't descend
			}
			walk(child);
		}
	};
	walk(stmt);
	return out;
}

// --- CST navigation helpers -----------------------------------------------------

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

/** Collect rule nodes within `node` but not inside a nested subquery/select_statement;
 *  matched nodes are not themselves descended into. */
function shallowNodesOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	const walk = (n: ParseTree): void => {
		for (let i = 0; i < n.getChildCount(); i++) {
			const child = n.getChild(i);
			if (!(child instanceof ParserRuleContext)) continue;
			if (child.ruleIndex === ruleIndex) out.push(child);
			else if (child.ruleIndex === P.RULE_subquery || child.ruleIndex === P.RULE_select_statement) continue;
			else walk(child);
		}
	};
	walk(node);
	return out;
}

function shallowFirstOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext | undefined {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (!(child instanceof ParserRuleContext)) continue;
		if (child.ruleIndex === ruleIndex) return child;
		if (
			child.ruleIndex === P.RULE_subquery ||
			child.ruleIndex === P.RULE_select_statement ||
			child.ruleIndex === P.RULE_scripting_block
		) {
			continue;
		}
		const found = shallowFirstOfRule(child, ruleIndex);
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

/** Token present within `node`, not descending into nested subquery/select/search_condition. */
function hasTokenShallow(node: ParseTree, type: number): boolean {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof TerminalNode && child.symbol.type === type) return true;
		if (
			child instanceof ParserRuleContext &&
			child.ruleIndex !== P.RULE_subquery &&
			child.ruleIndex !== P.RULE_select_statement &&
			child.ruleIndex !== P.RULE_search_condition &&
			hasTokenShallow(child, type)
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

/** The dotted name parts of an object_name / column_name / object_name_or_alias (id_ leaves in order). */
/** Per-part spans PARALLEL to nameParts(node) — one span per `id_` (its quote delimiters included),
 *  all-or-nothing: undefined when there are no id_ children (nameParts then falls back to a dotted
 *  split, whose parts have no single token). One shared span-capture seam. */
function namePartSpans(node: ParserRuleContext) {
	const ids = collectOfRule(node, P.RULE_id_);
	return ids.length ? partSpansOf(ids) : undefined;
}

function nameParts(node: ParserRuleContext): string[] {
	const ids = collectOfRule(node, P.RULE_id_);
	if (ids.length) return ids.map((i) => i.getText());
	return node
		.getText()
		.split(".")
		.filter((p) => p.length > 0);
}

/** Strip '…' string-literal quotes (PIVOT IN-list values). */
function stripString(text: string): string {
	if (text.length >= 2 && text[0] === "'" && text[text.length - 1] === "'") return text.slice(1, -1);
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
