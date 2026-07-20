import { ParserRuleContext, TerminalNode, type ParseTree, type Token } from "antlr4ng";
import { MysqlParser as P } from "../generated/mysql/MysqlParser.js";
import type {
	Clause,
	ColumnRef,
	CteDef,
	Expr,
	Join,
	JoinKind,
	LimitInfo,
	Projection,
	QueryBody,
	QueryExpr,
	SelectExpr,
	Source,
	UnsupportedFlag,
	WindowSpec,
} from "../ir/ir.js";
import { keywordCategory, swallowedCategories, swallowedStatements, type StatementCategory } from "../ir/statement.js";
import { collapsePartSpans, dotIdPartSpanOf, partSpanOf, type PartSpan } from "../ir/part-span.js";
import { freezeIR } from "../ir/freeze.js";
import { qualifiedNameOf, type QualifiedName } from "../ir/qualified-name.js";
import { MYSQL_NAME_CONFIG } from "./fold.js";

/** The structured name for a table source's raw parts (issue #38) — role assignment + identity
 *  key + fqn happen HERE, at lowering, where the dialect's namespace shape is known. */
function relationOf(rawParts: string[]): QualifiedName {
	return qualifiedNameOf(rawParts, MYSQL_NAME_CONFIG);
}

// ---------------------------------------------------------------------------
// Lowering — MySQL (grammars-v4 sql/mysql/Positive-Technologies fork, Ivan
// Kochurkin's split MySqlLexer/MySqlParser) CST -> the shared, dialect-neutral
// IR (src/ir/ir.ts). The semantic layer runs on the IR unchanged; only this
// file knows MySQL's grammar. Core query path: selectStatement,
// querySpecification, tableSources/tableSourceItem, joinPart, selectElements,
// and the left-recursive expression -> predicate -> expressionAtom cascade.
//
// Navigation is by rule index against the generated parser, never by string
// comparison of rule names. Nested `selectStatement` nodes belong to their own
// scope, so shallow walks never descend into them.
//
// Two grammar realities shape this lowering (see the R3 report):
//  1. WITH/SELECT split — MySQL-PT models `WITH cte AS (...) SELECT ...` as a bare
//     `withStatement` (the CTE clause only) immediately followed by its query. The
//     batch rule requires a SEMI between every other statement pair, so this is the
//     one no-semicolon adjacency, carried by statementItem's `withStatement
//     sqlStatement` alternative; lowerImpl rejoins the two into one CTE query. Set
//     operations are a flat linearized chain (UNION / EXCEPT / INTERSECT since the
//     8.0.19+ fork restructure); INTERSECT's higher precedence is realized in foldSetop.
//  2. Bare `LEFT`/`RIGHT` before JOIN now parse as an outer join, not a swallowed
//     table alias — our fork removed the reserved words LEFT/RIGHT from the
//     keyword-as-identifier path (upstream let them alias); joinPart carries the token.
//
// Identifier-delimiter contract (docs/identifier-delimiter-contract.md): MySQL
// follows the "kept" convention shared by every dialect except BigQuery — every
// identifier field (ColumnRef.parts / TableSource.name / TableSource.alias /
// CteDef.name / Projection.name) carries its RAW text with quoting delimiters
// intact. MySQL quotes are `backticks` and (in ANSI_QUOTES mode) "double
// quotes"; both lex to STRING_LITERAL and reach the `uid` rule, so getText()
// returns the delimiters verbatim. Case-folding / delimiter-stripping for
// identity/display happen downstream in src/ident/fold.ts, never here.
// ---------------------------------------------------------------------------

// dev.mysql.com/doc/refman/8.0/en/aggregate-functions.html — used only for the `aggregate`
// heuristic on scalar-parsed calls; structural aggregates (aggregateWindowedFunction) set it directly.
const AGGREGATES = new Set([
	"avg",
	"bit_and",
	"bit_or",
	"bit_xor",
	"count",
	"group_concat",
	"json_arrayagg",
	"json_objectagg",
	"max",
	"min",
	"std",
	"stddev",
	"stddev_pop",
	"stddev_samp",
	"sum",
	"var_pop",
	"var_samp",
	"variance",
]);

/** The core query "primary" rules the union linearizer treats as branch cores. Beyond the four
 *  upstream select shapes: the 8.0.19+ query primaries (explicitTable / tableValueConstructor, i.e.
 *  `TABLE t` and `VALUES ROW(...)`) and their statement wrappers (tableStatement / valuesStatement,
 *  reachable as parenthesized operands `(TABLE t ORDER BY x)`). */
const CORE_RULES = new Set<number>([
	P.RULE_querySpecification,
	P.RULE_querySpecificationNointo,
	P.RULE_queryExpression,
	P.RULE_queryExpressionNointo,
	P.RULE_explicitTable,
	P.RULE_tableValueConstructor,
	P.RULE_tableStatement,
	P.RULE_valuesStatement,
]);

/** Lower a parsed MySQL file (`root`: a `;`-separated batch of statements) into the IR. A single
 *  SELECT / VALUES / TABLE statement (plus the WITH/SELECT rejoin) lowers fully; anything else
 *  (DDL/DML/admin/utility, multi-statement batches) becomes a flagged non-query body — a valid
 *  parse never throws, and neither does broken/partial input. */
export function lower(tree: ParserRuleContext): QueryExpr {
	const q = lowerImpl(tree);
	q.dialect = "mysql";
	return freezeIR(q);
}

function lowerImpl(tree: ParserRuleContext): QueryExpr {
	const statementsNode = firstOfRule(tree, P.RULE_sqlStatements);
	const stmts = statementsNode ? collectStatements(statementsNode) : [];
	// Recovery-swallowed statements count toward batch-ness (a broken statement dumps the rest of the
	// batch as flat error nodes, under-reporting the sqlStatement count).
	const swallowed = swallowedStatements(tree);

	// WITH/SELECT rejoin: MySQL-PT models `WITH cte AS (...) SELECT ...` as a bare withStatement (the CTE
	// clause only) immediately followed by its query — the one no-semicolon statement adjacency real
	// MySQL has, carried by statementItem's `withStatement sqlStatement` alternative. collectStatements
	// surfaces it as the two adjacent statements stmts[0] (the withStatement) and stmts[1] (the query);
	// merge them into one CTE query so the CTE resolves downstream. Because a SEMI is now REQUIRED between
	// every other statement pair, this adjacency is unambiguous: `WITH ...; SELECT ...` (semicolon
	// between — invalid MySQL, the WITH is left dangling) arrives instead as a lone withStatement + a
	// separate statement (stmts[0] is a sqlStatement, not a bare withStatement), so it is NOT rejoined.
	if (stmts.length === 2 && swallowed === 0) {
		const withStmt = stmts[0].ruleIndex === P.RULE_withStatement ? stmts[0] : undefined;
		const trailingDml = dmlOf(stmts[1]);
		if (withStmt && trailingDml && isQueryDml(trailingDml)) {
			const q = lowerQueryDml(trailingDml);
			q.ctes = collectCteNodes(withStmt).map(lowerCteNode);
			q.statement = "query";
			return q;
		}
	}

	const total = stmts.length + swallowed;
	if (total !== 1 || stmts.length !== 1) {
		// Anchor a multi-statement span to the FIRST statement, not the whole `root` container (which
		// reaches EOF), so a downstream AST index read doesn't see a bogus enclosure over statements 2..n.
		const cst = total > 1 && stmts.length > 0 ? stmts[0] : tree;
		const q = nonQuery(cst, total > 1 ? "multi-statement" : total === 1 ? "broken" : "empty");
		q.statement = statementCategory(tree);
		return q;
	}

	const stmt = stmts[0];
	const dml = dmlOf(stmt);
	if (dml) {
		const sel = directChildrenOfRule(dml, P.RULE_selectStatement)[0];
		if (sel) {
			const q = lowerSelectStatement(sel);
			q.statement = "query";
			return q;
		}
		const vs = directChildrenOfRule(dml, P.RULE_valuesStatement)[0];
		if (vs) {
			const q = lowerValuesQuery(vs);
			q.statement = "query";
			return q;
		}
		const tblStmt = directChildrenOfRule(dml, P.RULE_tableStatement)[0];
		if (tblStmt) {
			const q = buildTableQuery(tblStmt);
			q.statement = "query";
			return q;
		}
		const withStmt = directChildrenOfRule(dml, P.RULE_withStatement)[0];
		if (withStmt) {
			// A lone WITH with no trailing query captured (mid-edit / broken) — keep the CTEs, empty body.
			const q: QueryExpr = {
				kind: "query",
				ctes: collectCteNodes(withStmt).map(lowerCteNode),
				body: emptyBody(withStmt),
				cst: stmt,
			};
			q.statement = "query";
			return q;
		}
	}
	const q = nonQuery(stmt, "non-query");
	q.statement = statementCategory(tree);
	return q;
}

// --- statement categories ------------------------------------------------------

/** Per-statement categories for every `sqlStatement` in a parsed `root`, in source order — the
 *  file-level view behind statementCategory (which folds >1 into "compound"). Parity with the other
 *  dialects; feeds the corpus reclassifier. Note the WITH/SELECT split shows here as two "query"
 *  entries even though lowerImpl rejoins them into one query. */
export function statementCategories(tree: ParserRuleContext): StatementCategory[] {
	const statementsNode = firstOfRule(tree, P.RULE_sqlStatements);
	const stmts = statementsNode ? collectStatements(statementsNode) : [];
	return [...stmts.map(stmtCategory), ...swallowedCategories(tree)];
}

/** The batch's statement contexts, in source order, flattened out of the statementItem wrappers
 *  (sqlStatements is now a SEMI-separated list of statementItem — see the grammar). A `withStatement
 *  sqlStatement` item (MySQL's one no-semicolon adjacency: a CTE clause bound to its query) contributes
 *  BOTH nodes — the bare withStatement then its query — so a lone `WITH cte AS (...) SELECT ...` still
 *  arrives as the two adjacent statements the WITH/SELECT rejoin expects. A bare withStatement head
 *  categorizes as "query" via stmtCategory's keyword fallback, matching the split's prior two entries. */
function collectStatements(statementsNode: ParserRuleContext): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	for (const item of directChildrenOfRule(statementsNode, P.RULE_statementItem)) {
		const withHead = directChildrenOfRule(item, P.RULE_withStatement)[0];
		if (withHead) out.push(withHead);
		const stmt = directChildrenOfRule(item, P.RULE_sqlStatement)[0];
		if (stmt) out.push(stmt);
	}
	return out;
}

function statementCategory(tree: ParserRuleContext): StatementCategory {
	const cats = statementCategories(tree);
	if (cats.length === 0) return "other";
	if (cats.length > 1) return "compound";
	return cats[0];
}

/** MySQL's sqlStatement groups statement kinds behind the ddl/dml/transaction/administration/utility/
 *  replication/prepared meta-rules, so the big buckets are structural; admin/utility/replication/
 *  prepared refine by their leading keyword (GRANT→dcl, SET/SHOW→utility, …), mirroring snowflake. */
function stmtCategory(stmt: ParserRuleContext): StatementCategory {
	if (directChildrenOfRule(stmt, P.RULE_ddlStatement).length) return "ddl";
	const dml = dmlOf(stmt);
	if (dml) return dmlCategory(dml);
	if (directChildrenOfRule(stmt, P.RULE_transactionStatement).length) return "tcl";
	if (
		directChildrenOfRule(stmt, P.RULE_administrationStatement).length ||
		directChildrenOfRule(stmt, P.RULE_replicationStatement).length ||
		directChildrenOfRule(stmt, P.RULE_preparedStatement).length
	) {
		return keywordCategory(stmt.start?.text ?? "");
	}
	if (directChildrenOfRule(stmt, P.RULE_utilityStatement).length) return "utility";
	return keywordCategory(stmt.start?.text ?? "");
}

function dmlCategory(dml: ParserRuleContext): StatementCategory {
	if (isQueryDml(dml) || directChildrenOfRule(dml, P.RULE_withStatement).length) return "query";
	// CALL invokes a stored procedure — a utility, not a data write.
	if (directChildrenOfRule(dml, P.RULE_callStatement).length) return "utility";
	// INSERT / UPDATE / DELETE / REPLACE / LOAD DATA / LOAD XML / DO / HANDLER → data movement.
	return "dml";
}

function isQueryDml(dml: ParserRuleContext): boolean {
	return (
		directChildrenOfRule(dml, P.RULE_selectStatement).length > 0 ||
		directChildrenOfRule(dml, P.RULE_valuesStatement).length > 0 ||
		directChildrenOfRule(dml, P.RULE_tableStatement).length > 0
	);
}

function dmlOf(stmt: ParserRuleContext): ParserRuleContext | undefined {
	return directChildrenOfRule(stmt, P.RULE_dmlStatement)[0];
}

function nonQuery(cst: ParserRuleContext, reason: UnsupportedFlag): QueryExpr {
	return { kind: "query", ctes: [], body: nonQuerySelect(cst, reason), cst };
}

function nonQuerySelect(cst: ParserRuleContext, reason: UnsupportedFlag): SelectExpr {
	return { kind: "select", projections: [], from: [], columns: [], aggregated: false, unsupported: [reason], cst };
}

// --- SELECT statement ----------------------------------------------------------

/** A dmlStatement that is a query primary (select / VALUES / TABLE) → a QueryExpr. */
function lowerQueryDml(dml: ParserRuleContext): QueryExpr {
	const sel = directChildrenOfRule(dml, P.RULE_selectStatement)[0];
	if (sel) return lowerSelectStatement(sel);
	const vs = directChildrenOfRule(dml, P.RULE_valuesStatement)[0];
	if (vs) return lowerValuesQuery(vs);
	const tblStmt = directChildrenOfRule(dml, P.RULE_tableStatement)[0];
	if (tblStmt) return buildTableQuery(tblStmt);
	return { kind: "query", ctes: [], body: nonQuerySelect(dml, "non-query"), cst: dml };
}

/** selectStatement (all five labelled alternatives). A single querySpecification lowers to a select
 *  body; a UNION chain folds left into a setop body; the trailing ORDER BY / LIMIT hoist to the
 *  QueryExpr level (from the querySpecification for a single select, from the selectStatement for a
 *  union). */
function lowerSelectStatement(selectStmt: ParserRuleContext): QueryExpr {
	const { cores, ops } = collectUnion(selectStmt);
	const body: QueryBody =
		cores.length > 1
			? foldSetop(cores, ops, selectStmt)
			: cores[0]
				? buildCoreBody(cores[0])
				: emptyBody(selectStmt);

	// ORDER BY / LIMIT: at the selectStatement level (union case) or inside the single core.
	const single = cores.length === 1 && cores[0] ? unwrapCore(cores[0]) : undefined;
	const orderBy = extractOrderBy(selectStmt) ?? (single ? extractOrderBy(single) : undefined);
	if (orderBy && body.kind !== "pipe") for (const o of orderBy) columnsOf(o, body.columns, "orderBy");
	const limit = extractLimit(selectStmt) ?? (single ? extractLimit(single) : undefined);
	return { kind: "query", ctes: [], body, orderBy, limit, cst: selectStmt };
}

/** One linearized set operator: its kind (union / except / intersect), ALL flag, and the CST node
 *  anchoring the setop's span (the unionStatement/unionParenthesis rule node, or — for the trailing
 *  into-tail arm, whose operator/ALL are loose tokens — the trailing branch core itself). */
type SetOpKind = "union" | "except" | "intersect";
type UnionOp = { op: SetOpKind; all: boolean; cst: ParserRuleContext };

function opKindOf(n: ParserRuleContext): SetOpKind {
	if (hasDirectToken(n, P.EXCEPT)) return "except";
	if (hasDirectToken(n, P.INTERSECT)) return "intersect";
	return "union";
}

/** Linearize the set-operation chain of a selectStatement (or a parenthesized query-expression core —
 *  buildCoreBody folds those as their own unit) into ordered branch cores + operator entries. The
 *  grammar nests the operator both directly under selectStatement AND as the trailing child of a
 *  querySpecificationNointo core, so ONLY the querySpecification(Nointo) cores are followed into a
 *  trailing operator (a parenthesized core's operators belong to ITS chain, never this level).
 *  unionSelect/unionParenthesisSelect additionally allow ONE trailing `(UNION|EXCEPT|INTERSECT)
 *  (ALL|DISTINCT)? (querySpecification|queryExpression)` into-tail arm whose operator/ALL are LOOSE
 *  direct tokens of selectStatement and whose branch is a bare direct core — collected here as a
 *  branch of its own (previously silently dropped; B-R3 review finding). */
function collectUnion(selectStmt: ParserRuleContext): { cores: ParserRuleContext[]; ops: UnionOp[] } {
	const cores: ParserRuleContext[] = [];
	const ops: UnionOp[] = [];
	const isOp = (n: ParserRuleContext): boolean =>
		n.ruleIndex === P.RULE_unionStatement || n.ruleIndex === P.RULE_unionParenthesis;

	const processCore = (core: ParserRuleContext): void => {
		cores.push(core);
		// Only querySpecification(Nointo) may carry a trailing set operator as a DIRECT child.
		if (core.ruleIndex === P.RULE_querySpecification || core.ruleIndex === P.RULE_querySpecificationNointo) {
			for (const c of kidsOf(core)) if (c instanceof ParserRuleContext && isOp(c)) processOp(c);
		}
	};
	const processOp = (op: ParserRuleContext): void => {
		ops.push({ op: opKindOf(op), all: hasDirectToken(op, P.ALL), cst: op });
		const core = firstCoreChild(op);
		if (core) processCore(core);
	};

	let pendingAll = false; // the loose ALL token preceding the trailing into-tail branch
	let pendingOp: SetOpKind = "union"; // the loose operator token preceding it
	for (const c of kidsOf(selectStmt)) {
		if (c instanceof TerminalNode) {
			if (c.symbol.type === P.ALL) pendingAll = true;
			else if (c.symbol.type === P.EXCEPT) pendingOp = "except";
			else if (c.symbol.type === P.INTERSECT) pendingOp = "intersect";
			continue;
		}
		if (!(c instanceof ParserRuleContext)) continue;
		if (isOp(c)) {
			processOp(c);
			pendingAll = false;
			pendingOp = "union";
		} else if (CORE_RULES.has(c.ruleIndex)) {
			if (cores.length > 0) ops.push({ op: pendingOp, all: pendingAll, cst: c }); // the trailing into-tail branch
			processCore(c);
			pendingAll = false;
			pendingOp = "union";
		}
	}
	return { cores, ops };
}

/** Fold the linearized branch bodies with MySQL's set-operator precedence: INTERSECT binds tighter
 *  than UNION / EXCEPT (dev.mysql.com/doc/refman/8.4/en/set-operations.html); equal-precedence
 *  operators group left-to-right. Pass 1 collapses INTERSECT runs into their left neighbor; pass 2
 *  left-folds the remaining UNION/EXCEPT chain. A missing op entry (never expected — cores always
 *  lead ops by one) folds as the UNION DISTINCT default. */
function foldSetop(cores: ParserRuleContext[], ops: UnionOp[], cst: ParserRuleContext): QueryBody {
	const bodies = cores.map(buildCoreBody);
	const groups: QueryBody[] = [bodies[0] ?? emptyBody(cst)];
	const outer: (UnionOp | undefined)[] = [];
	for (let i = 1; i < bodies.length; i++) {
		const op = ops[i - 1];
		if (op?.op === "intersect") {
			groups[groups.length - 1] = setopNode(op, groups[groups.length - 1], bodies[i], cst);
		} else {
			outer.push(op);
			groups.push(bodies[i]);
		}
	}
	let body = groups[0];
	for (let i = 1; i < groups.length; i++) {
		body = setopNode(outer[i - 1], body, groups[i], cst);
	}
	return body;
}

function setopNode(op: UnionOp | undefined, left: QueryBody, right: QueryBody, fallback: ParserRuleContext): QueryBody {
	return {
		kind: "setop",
		op: op?.op ?? "union",
		all: op?.all ?? false,
		left,
		right,
		columns: [],
		cst: op?.cst ?? fallback,
	};
}

/** A branch core -> QueryBody. querySpecification(Nointo) builds a select; explicitTable /
 *  tableValueConstructor (and their statement wrappers, reachable as parenthesized operands) build
 *  TABLE/VALUES bodies; queryExpression(Nointo) folds its OWN parenthesized chain as a unit (parens
 *  grouping survives the flat outer linearization) or unwraps a single inner core. A parenthesized
 *  branch's own ORDER BY / LIMIT (`(TABLE t ORDER BY x) UNION ...`) have no per-branch IR slot — an
 *  accepted boundary (the refs stay CST-addressable). */
function buildCoreBody(core: ParserRuleContext): QueryBody {
	if (core.ruleIndex === P.RULE_querySpecification || core.ruleIndex === P.RULE_querySpecificationNointo) {
		return buildSelect(core);
	}
	if (core.ruleIndex === P.RULE_explicitTable) return buildTableBody(core);
	if (core.ruleIndex === P.RULE_tableStatement) {
		const et = directChildrenOfRule(core, P.RULE_explicitTable)[0];
		return et ? buildTableBody(et) : emptyBody(core);
	}
	if (core.ruleIndex === P.RULE_tableValueConstructor || core.ruleIndex === P.RULE_valuesStatement) {
		return buildValues(core);
	}
	// queryExpression(Nointo): fold the parenthesized chain (single inner core -> plain recursion).
	const { cores, ops } = collectUnion(core);
	if (cores.length > 1) return foldSetop(cores, ops, core);
	return cores[0] ? buildCoreBody(cores[0]) : emptyBody(core);
}

function unwrapCore(core: ParserRuleContext): ParserRuleContext {
	if (
		core.ruleIndex === P.RULE_querySpecification ||
		core.ruleIndex === P.RULE_querySpecificationNointo ||
		core.ruleIndex === P.RULE_tableStatement ||
		core.ruleIndex === P.RULE_valuesStatement
	) {
		return core;
	}
	const inner = firstCoreChild(core);
	return inner ? unwrapCore(inner) : core;
}

function firstCoreChild(node: ParserRuleContext): ParserRuleContext | undefined {
	for (const c of kidsOf(node)) if (c instanceof ParserRuleContext && CORE_RULES.has(c.ruleIndex)) return c;
	return undefined;
}

// --- CTEs ---------------------------------------------------------------------

/** The commonTableExpressions nodes of a withStatement, in order. The rule is right-recursive (each
 *  cte's trailing `(',' commonTableExpressions)?` holds the next), and withStatement also lists them
 *  directly — following the direct-child chain covers both, without descending into the CTE bodies. */
function collectCteNodes(withStmt: ParserRuleContext): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	const visit = (n: ParserRuleContext): void => {
		for (const cte of directChildrenOfRule(n, P.RULE_commonTableExpressions)) {
			out.push(cte);
			visit(cte);
		}
	};
	visit(withStmt);
	return out;
}

/** commonTableExpressions: cteName ('(' cteColumnName (',' cteColumnName)* ')')? AS '(' dmlStatement ')' … */
function lowerCteNode(cte: ParserRuleContext): CteDef {
	const nameNode = directChildrenOfRule(cte, P.RULE_cteName)[0];
	const nameUid = nameNode ? directChildrenOfRule(nameNode, P.RULE_uid)[0] : undefined;
	const cols = directChildrenOfRule(cte, P.RULE_cteColumnName).map((c) => c.getText());
	const dml = directChildrenOfRule(cte, P.RULE_dmlStatement)[0];
	return {
		name: nameUid ? nameUid.getText() : (nameNode?.getText() ?? ""),
		nameCst: nameUid ?? nameNode,
		columnAliases: cols.length ? cols : undefined,
		body: dml ? lowerQueryDml(dml) : emptyQuery(cte),
		cst: cte,
	};
}

// --- the SELECT body ----------------------------------------------------------

/** querySpecification: SELECT selectSpec* selectElements selectIntoExpression? fromClause? groupByClause?
 *  havingClause? windowClause? orderByClause? limitClause?  (WHERE lives INSIDE fromClause). */
function buildSelect(qspec: ParserRuleContext): SelectExpr {
	const projections = buildProjections(qspec);

	const fromClause = directChildrenOfRule(qspec, P.RULE_fromClause)[0];
	const { from, joins, joinConditions, fromSubqueries } = fromClause
		? buildFrom(fromClause)
		: {
				from: [] as Source[],
				joins: [] as Join[],
				joinConditions: [] as Expr[],
				fromSubqueries: new Set<ParserRuleContext>(),
			};

	// fromClause: (FROM tableSources)? (WHERE whereExpr=expression)? — the WHERE is fromClause's own
	// direct expression child (join ON / source exprs are nested deeper).
	const whereNode = fromClause ? directChildrenOfRule(fromClause, P.RULE_expression)[0] : undefined;
	const where = whereNode ? lowerExpr(whereNode) : undefined;

	const groupByClause = directChildrenOfRule(qspec, P.RULE_groupByClause)[0];
	const groupBy = groupByClause ? extractGroupBy(groupByClause) : undefined;

	const havingClause = directChildrenOfRule(qspec, P.RULE_havingClause)[0];
	const havingNode = havingClause ? directChildrenOfRule(havingClause, P.RULE_expression)[0] : undefined;
	const having = havingNode ? lowerExpr(havingNode) : undefined;

	const subqueries = extractExpressionSubqueries(qspec, fromSubqueries);

	const aggregated =
		(groupBy !== undefined && groupBy.length > 0) ||
		projections.some((p) => hasAggregate(p.expr)) ||
		(having !== undefined && hasAggregate(having));

	const columns: ColumnRef[] = [];
	for (const p of projections) columnsOf(p.expr, columns, "projection");
	if (where) columnsOf(where, columns, "where");
	for (const j of joinConditions) columnsOf(j, columns, "join");
	for (const g of groupBy ?? []) columnsOf(g, columns, "groupBy");
	if (having) columnsOf(having, columns, "having");

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
		aggregated,
		subqueries: subqueries.length ? subqueries : undefined,
		cst: qspec,
	};
}

/** selectElements: (star='*' | selectElement) (',' selectElement)*. */
function buildProjections(qspec: ParserRuleContext): Projection[] {
	const se = directChildrenOfRule(qspec, P.RULE_selectElements)[0];
	if (!se) return [];
	const out: Projection[] = [];
	// A bare leading '*' is a direct token of selectElements, not wrapped in a selectElement.
	if (hasDirectToken(se, P.STAR))
		out.push({ name: undefined, isStar: true, expr: { kind: "star", cst: se }, cst: se });
	for (const el of directChildrenOfRule(se, P.RULE_selectElement)) out.push(buildProjection(el));
	return out;
}

/** selectElement:
 *    fullId '.' '*'                               (qualified star)
 *  | fullColumnName (AS? uid)?
 *  | functionCall (AS? uid)?
 *  | (LOCAL_ID VAR_ASSIGN)? expression (AS? uid)? */
function buildProjection(el: ParserRuleContext): Projection {
	if (hasDirectToken(el, P.STAR)) {
		const fullId = directChildrenOfRule(el, P.RULE_fullId)[0];
		const qualifier = fullId ? dottedParts(fullId).parts : [];
		return {
			name: undefined,
			isStar: true,
			expr: { kind: "star", qualifier: qualifier.length ? qualifier : undefined, cst: el },
			cst: el,
		};
	}
	const alias = directChildrenOfRule(el, P.RULE_uid)[0]; // the (AS? uid) alias, a direct child
	const fcn = directChildrenOfRule(el, P.RULE_fullColumnName)[0];
	const fc = directChildrenOfRule(el, P.RULE_functionCall)[0];
	const exprNode = directChildrenOfRule(el, P.RULE_expression)[0];
	const expr = fcn ? columnRef(fcn) : fc ? lowerFunctionCall(fc) : exprNode ? lowerExpr(exprNode) : otherExpr(el);
	let name = alias ? alias.getText() : undefined;
	if (name === undefined && expr.kind === "column") name = expr.parts[expr.parts.length - 1];
	return { name, isStar: false, expr, ...(alias ? { aliasCst: alias } : {}), cst: el };
}

/** groupByClause: GROUP BY groupByItem (',' groupByItem)* (WITH ROLLUP)?  /  groupByItem: expression … */
function extractGroupBy(clause: ParserRuleContext): Expr[] | undefined {
	const items = directChildrenOfRule(clause, P.RULE_groupByItem)
		.map((gi) => directChildrenOfRule(gi, P.RULE_expression)[0])
		.filter((e): e is ParserRuleContext => e !== undefined)
		.map(lowerExpr);
	return items.length ? items : undefined;
}

// --- VALUES / TABLE -----------------------------------------------------------

/** A valuesStatement (tableValueConstructor orderByClause? limitClause?) or a bare
 *  tableValueConstructor: VALUES ROW(1,-2,3), ROW(5,7,9) — the 8.0.19 VALUES statement
 *  (dev.mysql.com/doc/refman/8.4/en/values.html; ROW? also admits upstream's bare `VALUES (...)`
 *  shape). Lowers to a modelled select whose projections carry the FIRST row's exprs, named
 *  column_0…column_N (MySQL's default table-value-constructor output names). */
function buildValues(vs: ParserRuleContext): SelectExpr {
	const host = directChildrenOfRule(vs, P.RULE_tableValueConstructor)[0] ?? vs;
	const firstRow = directChildrenOfRule(host, P.RULE_expressionsWithDefaults)[0];
	const items = firstRow ? directChildrenOfRule(firstRow, P.RULE_expressionOrDefault) : [];
	const projections: Projection[] = items.map((eod, i) => {
		const e = directChildrenOfRule(eod, P.RULE_expression)[0];
		return {
			name: `column_${i}`,
			isStar: false,
			expr: e ? lowerExpr(e) : { kind: "literal", text: eod.getText(), cst: eod },
			cst: eod,
		};
	});
	const columns: ColumnRef[] = [];
	for (const p of projections) columnsOf(p.expr, columns, "projection");
	return { kind: "select", projections, from: [], columns, aggregated: false, cst: vs };
}

/** explicitTable: TABLE tableName — the 8.0.19 explicit-table query primary, equivalent to
 *  `SELECT * FROM t` (dev.mysql.com/doc/refman/8.4/en/table.html). */
function buildTableBody(et: ParserRuleContext): SelectExpr {
	const tn = directChildrenOfRule(et, P.RULE_tableName)[0];
	const from = tn ? [tableSourceFromName(tn, undefined, et)] : [];
	return {
		kind: "select",
		projections: [{ name: undefined, isStar: true, expr: { kind: "star", cst: et }, cst: et }],
		from,
		columns: [],
		aggregated: false,
		cst: et,
	};
}

/** tableStatement: explicitTable orderByClause? limitClause? — the standalone TABLE statement. */
function buildTableQuery(ts: ParserRuleContext): QueryExpr {
	const et = directChildrenOfRule(ts, P.RULE_explicitTable)[0];
	const body = et ? buildTableBody(et) : emptyBody(ts);
	const orderBy = extractOrderBy(ts);
	if (orderBy) for (const o of orderBy) columnsOf(o, body.columns, "orderBy");
	return { kind: "query", ctes: [], body, orderBy, limit: extractLimit(ts), cst: ts };
}

/** valuesStatement as a standalone statement: the VALUES body plus hoisted ORDER BY / LIMIT
 *  (dev.mysql.com/doc/refman/8.4/en/values.html). */
function lowerValuesQuery(vs: ParserRuleContext): QueryExpr {
	const body = buildValues(vs);
	const orderBy = extractOrderBy(vs);
	if (orderBy) for (const o of orderBy) columnsOf(o, body.columns, "orderBy");
	return { kind: "query", ctes: [], body, orderBy, limit: extractLimit(vs), cst: vs };
}

/** subqueryBody (withClause? selectStatement | tableStatement | valuesStatement) — the query forms
 *  admissible inside subquery/derived-table parentheses — to a QueryExpr. A withClause's CTEs attach
 *  to the query they prefix (CTEs are legal in derived tables/subqueries,
 *  dev.mysql.com/doc/refman/8.4/en/with.html). */
function lowerSubqueryBody(sb: ParserRuleContext): QueryExpr {
	const sel = directChildrenOfRule(sb, P.RULE_selectStatement)[0];
	if (sel) {
		const q = lowerSelectStatement(sel);
		const wc = directChildrenOfRule(sb, P.RULE_withClause)[0];
		if (wc) q.ctes = collectCteNodes(wc).map(lowerCteNode);
		return q;
	}
	const ts = directChildrenOfRule(sb, P.RULE_tableStatement)[0];
	if (ts) return buildTableQuery(ts);
	const vs = directChildrenOfRule(sb, P.RULE_valuesStatement)[0];
	if (vs) return lowerValuesQuery(vs);
	return emptyQuery(sb);
}

/** The subquery of an operand node — its direct subqueryBody ('(' … ')' forms) or bare selectStatement
 *  child — with the node that anchors it. */
function subqueryOf(node: ParserRuleContext): { query: QueryExpr; cst: ParserRuleContext } | undefined {
	const sb = directChildrenOfRule(node, P.RULE_subqueryBody)[0];
	if (sb) return { query: lowerSubqueryBody(sb), cst: sb };
	const sel = directChildrenOfRule(node, P.RULE_selectStatement)[0];
	return sel ? { query: lowerSelectStatement(sel), cst: sel } : undefined;
}

// --- sources ------------------------------------------------------------------

function buildFrom(fromClause: ParserRuleContext): {
	from: Source[];
	joins: Join[];
	joinConditions: Expr[];
	fromSubqueries: Set<ParserRuleContext>;
} {
	const from: Source[] = [];
	const joins: Join[] = [];
	const joinConditions: Expr[] = [];
	const fromSubqueries = new Set<ParserRuleContext>();

	const tableSources = directChildrenOfRule(fromClause, P.RULE_tableSources)[0];
	if (!tableSources) return { from, joins, joinConditions, fromSubqueries };

	for (const ts of directChildrenOfRule(tableSources, P.RULE_tableSource)) {
		// tableSource: tableSourceItem joinPart* | '(' tableSourceItem joinPart* ')' | jsonTable.
		const jt = directChildrenOfRule(ts, P.RULE_jsonTable)[0];
		if (jt) {
			from.push({ kind: "table", relation: relationOf([jt.getText()]), cst: jt });
			continue;
		}
		const base = directChildrenOfRule(ts, P.RULE_tableSourceItem)[0];
		if (base) from.push(...buildSourceItem(base, fromSubqueries));
		for (const jp of directChildrenOfRule(ts, P.RULE_joinPart)) {
			const jItem = directChildrenOfRule(jp, P.RULE_tableSourceItem)[0];
			const jSources = jItem ? buildSourceItem(jItem, fromSubqueries) : [];
			from.push(...jSources);
			const target = jSources[0];
			if (!target) continue;
			const { kind, natural } = joinKind(jp);
			const { on, using } = joinSpecOf(jp, joinConditions);
			joins.push({ kind, source: target, on, using, natural: natural || undefined, cst: jp });
		}
	}
	return { from, joins, joinConditions, fromSubqueries };
}

/** tableSourceItem:
 *    tableName (PARTITION …)? (AS? alias=uid)? (indexHint …)*             (atomTableItem)
 *  | sequenceFunctionName '(' DECIMAL_LITERAL ')' (AS? alias)?             (sequenceTableItem)
 *  | (selectStatement | '(' subqueryBody ')') AS? alias=uid ('(' uidList ')')?  (subqueryTableItem)
 *  | '(' tableSources ')'                                                  (tableSourcesItem — flattened)
 *  | jsonTable                                                             (jsonTableItem) */
function buildSourceItem(item: ParserRuleContext, fromSubqueries: Set<ParserRuleContext>): Source[] {
	const sb: ParserRuleContext | undefined = directChildrenOfRule(item, P.RULE_subqueryBody)[0];
	const sel = sb ?? directChildrenOfRule(item, P.RULE_selectStatement)[0];
	if (sel) {
		fromSubqueries.add(sel);
		const alias = directChildrenOfRule(item, P.RULE_uid)[0];
		// The derived-table column-alias list: `(SELECT 1, 2) AS dt (a, b)` — its uidList is a direct
		// child (the PARTITION uidList lives on atomTableItem, a different branch).
		const ul = directChildrenOfRule(item, P.RULE_uidList)[0];
		const columnAliases = ul ? directChildrenOfRule(ul, P.RULE_uid).map((u) => u.getText()) : undefined;
		return [
			{
				kind: "subquery",
				query: sb ? lowerSubqueryBody(sb) : lowerSelectStatement(sel),
				alias: alias?.getText(),
				aliasCst: alias,
				...(columnAliases?.length ? { columnAliases } : {}),
				cst: item,
			},
		];
	}

	// '(' tableSources ')' — a parenthesized source group; flatten its members (any inner joins are not
	// separately modelled, an accepted boundary).
	const inner = directChildrenOfRule(item, P.RULE_tableSources)[0];
	if (inner) {
		const out: Source[] = [];
		for (const ts of directChildrenOfRule(inner, P.RULE_tableSource)) {
			const b = directChildrenOfRule(ts, P.RULE_tableSourceItem)[0];
			if (b) out.push(...buildSourceItem(b, fromSubqueries));
			for (const jp of directChildrenOfRule(ts, P.RULE_joinPart)) {
				const ji = directChildrenOfRule(jp, P.RULE_tableSourceItem)[0];
				if (ji) out.push(...buildSourceItem(ji, fromSubqueries));
			}
		}
		return out;
	}

	const tn = directChildrenOfRule(item, P.RULE_tableName)[0];
	if (tn) {
		const alias = directChildrenOfRule(item, P.RULE_uid)[0];
		return [tableSourceFromName(tn, alias, item)];
	}

	// sequenceFunctionName(n) — a TVF-ish source; its columns need the signature (unknown, never wrong).
	const seq = directChildrenOfRule(item, P.RULE_sequenceFunctionName)[0];
	if (seq) {
		const alias = directChildrenOfRule(item, P.RULE_uid)[0];
		return [
			{
				kind: "table",
				relation: relationOf([seq.getText()]),
				alias: alias?.getText(),
				aliasCst: alias,
				cst: item,
			},
		];
	}
	return [{ kind: "table", relation: relationOf([item.getText()]), cst: item }];
}

function tableSourceFromName(
	tn: ParserRuleContext,
	alias: ParserRuleContext | undefined,
	cst: ParserRuleContext,
): Source {
	const fullId = directChildrenOfRule(tn, P.RULE_fullId)[0] ?? tn;
	const { parts, spans } = dottedParts(fullId);
	return {
		kind: "table",
		relation: relationOf(parts.length ? parts : [tn.getText()]),
		namePartSpans: collapsePartSpans(spans),
		alias: alias?.getText(),
		aliasCst: alias,
		cst,
	};
}

/** joinPart:
 *    (INNER | CROSS)? JOIN LATERAL? tableSourceItem joinSpec*       (innerJoin)
 *  | STRAIGHT_JOIN tableSourceItem (ON expression)*                 (straightJoin → inner)
 *  | (LEFT | RIGHT) OUTER? JOIN LATERAL? tableSourceItem joinSpec*  (outerJoin)
 *  | NATURAL ((LEFT | RIGHT) OUTER?)? JOIN tableSourceItem          (naturalJoin) */
function joinKind(jp: ParserRuleContext): { kind: JoinKind; natural: boolean } {
	const natural = hasDirectToken(jp, P.NATURAL);
	if (hasDirectToken(jp, P.CROSS)) return { kind: "cross", natural: false };
	if (hasDirectToken(jp, P.LEFT)) return { kind: "left", natural };
	if (hasDirectToken(jp, P.RIGHT)) return { kind: "right", natural };
	return { kind: natural ? "natural" : "inner", natural };
}

/** ON exprs (lowered ONCE, pushed to joinConditions AND returned as join.on for reference identity)
 *  and USING columns for a joinPart. STRAIGHT_JOIN carries ON as a bare expression child; the others
 *  wrap it in a joinSpec. */
function joinSpecOf(jp: ParserRuleContext, joinConditions: Expr[]): { on?: Expr; using?: string[] } {
	let on: Expr | undefined;
	let using: string[] | undefined;
	for (const js of directChildrenOfRule(jp, P.RULE_joinSpec)) {
		const e = directChildrenOfRule(js, P.RULE_expression)[0];
		if (e) {
			const lowered = lowerExpr(e);
			joinConditions.push(lowered);
			if (!on) on = lowered;
			continue;
		}
		const ul = directChildrenOfRule(js, P.RULE_uidList)[0];
		if (ul) {
			const cols = directChildrenOfRule(ul, P.RULE_uid).map((u) => u.getText());
			if (cols.length && !using) using = cols;
		}
	}
	// straightJoin's ON is a direct expression child of joinPart (no joinSpec wrapper).
	for (const e of directChildrenOfRule(jp, P.RULE_expression)) {
		const lowered = lowerExpr(e);
		joinConditions.push(lowered);
		if (!on) on = lowered;
	}
	return { on, using };
}

// --- ORDER BY / LIMIT ---------------------------------------------------------

/** orderByClause: ORDER BY orderByExpression (',' orderByExpression)*  /  orderByExpression: expression order? */
function extractOrderBy(node: ParserRuleContext): Expr[] | undefined {
	const obc = directChildrenOfRule(node, P.RULE_orderByClause)[0];
	if (!obc) return undefined;
	const items = orderByExprs(obc);
	return items.length ? items : undefined;
}

function orderByExprs(obc: ParserRuleContext): Expr[] {
	return directChildrenOfRule(obc, P.RULE_orderByExpression)
		.map((oe) => directChildrenOfRule(oe, P.RULE_expression)[0])
		.filter((e): e is ParserRuleContext => e !== undefined)
		.map(lowerExpr);
}

/** limitClause: LIMIT ((offset=limitClauseAtom ',')? limit=limitClauseAtom | limit OFFSET offset).
 *  The comma form is MySQL's `LIMIT offset, count`; the OFFSET form is `LIMIT count OFFSET offset`. */
function extractLimit(node: ParserRuleContext): LimitInfo | undefined {
	const lc = directChildrenOfRule(node, P.RULE_limitClause)[0];
	if (!lc) return undefined;
	const atoms = directChildrenOfRule(lc, P.RULE_limitClauseAtom);
	if (atoms.length === 0) return undefined;
	const info: LimitInfo = {};
	if (hasDirectToken(lc, P.OFFSET)) {
		info.top = limitAtom(atoms[0]);
		if (atoms[1]) info.offset = limitAtom(atoms[1]);
	} else if (atoms.length >= 2) {
		// `offset, count`
		info.offset = limitAtom(atoms[0]);
		info.top = limitAtom(atoms[1]);
	} else {
		info.top = limitAtom(atoms[0]);
	}
	return info;
}

function limitAtom(atom: ParserRuleContext): Expr {
	return { kind: "literal", text: atom.getText(), cst: atom };
}

// --- expressions (left-recursive: expression -> predicate -> expressionAtom) ---

function lowerExpr(node: ParserRuleContext): Expr {
	switch (node.ruleIndex) {
		case P.RULE_expression:
			return lowerExpression(node);
		case P.RULE_predicate:
			return lowerPredicate(node);
		case P.RULE_expressionAtom:
			return lowerExpressionAtom(node);
		case P.RULE_functionCall:
			return lowerFunctionCall(node);
		case P.RULE_constant:
			return lowerConstant(node);
		case P.RULE_fullColumnName:
			return columnRef(node);
		case P.RULE_expressionOrDefault: {
			const e = directChildrenOfRule(node, P.RULE_expression)[0];
			return e ? lowerExpr(e) : { kind: "literal", text: node.getText(), cst: node };
		}
		default:
			return otherExpr(node);
	}
}

/** `constant`: a literal, EXCEPT the `?` prepared-statement placeholder
 *  (dev.mysql.com/doc/refman/8.4/en/sql-prepared-statements.html) — a caller-bound parameter, not
 *  a literal. Shared by every site that lowers a bare `constant` node (lowerExpr's direct
 *  dispatch, constantExpressionAtom, and the generic functionArgs/functionArg fast path used by
 *  most scalar function calls), so `?` gets the same treatment everywhere the grammar shapes a
 *  constant. `cst` defaults to `node` itself; callers that lower a `constant` reached through an
 *  outer expressionAtom pass that outer node instead, matching their existing span convention. */
function lowerConstant(node: ParserRuleContext, cst: ParserRuleContext = node): Expr {
	if (hasDirectToken(node, P.PLACEHOLDER)) return { kind: "parameter", text: node.getText(), cst };
	return { kind: "literal", text: node.getText(), cst };
}

/** expression:
 *    (NOT | '!') expression                               (notExpression)
 *  | expression logicalOperator expression                (logicalExpression)
 *  | predicate IS NOT? (TRUE | FALSE | UNKNOWN)            (isExpression)
 *  | predicate                                            (predicateExpression) */
function lowerExpression(node: ParserRuleContext): Expr {
	const exprs = directChildrenOfRule(node, P.RULE_expression);
	if (exprs.length === 2) {
		const lop = directChildrenOfRule(node, P.RULE_logicalOperator)[0];
		return {
			kind: "binary",
			op: lop ? logicalOpText(lop) : "",
			left: lowerExpr(exprs[0]),
			right: lowerExpr(exprs[1]),
			cst: node,
		};
	}
	if (exprs.length === 1) {
		// notExpression — a leading NOT / '!' over one expression.
		return { kind: "unary", op: "not", operand: lowerExpr(exprs[0]), cst: node };
	}
	const pred = directChildrenOfRule(node, P.RULE_predicate)[0];
	if (pred && hasDirectToken(node, P.IS)) {
		// isExpression: IS [NOT] TRUE/FALSE/UNKNOWN.
		const op = hasDirectToken(node, P.TRUE) ? "true" : hasDirectToken(node, P.FALSE) ? "false" : "unknown";
		return {
			kind: "predicate",
			op,
			negated: hasDirectToken(node, P.NOT),
			operand: lowerExpr(pred),
			args: [],
			cst: node,
		};
	}
	return pred ? lowerExpr(pred) : otherExpr(node);
}

function logicalOpText(lop: ParserRuleContext): string {
	if (hasDirectToken(lop, P.AND)) return "and";
	if (hasDirectToken(lop, P.OR)) return "or";
	if (hasDirectToken(lop, P.XOR)) return "xor";
	// '&&' -> and, '||' -> or (the operator-token forms).
	const t = lop.getText();
	return t === "&&" ? "and" : t === "||" ? "or" : t;
}

/** predicate (labelled left-recursive alternatives — see the grammar). Detected structurally by the
 *  operator token / sub-rule shapes; a bare expressionAtom passes through. */
function lowerPredicate(node: ParserRuleContext): Expr {
	const preds = directChildrenOfRule(node, P.RULE_predicate);
	if (preds.length === 0) {
		// expressionAtomPredicate
		const atom = directChildrenOfRule(node, P.RULE_expressionAtom)[0];
		return atom ? lowerExpressionAtom(atom) : otherExpr(node);
	}
	const operand = lowerExpr(preds[0]);
	const negated = hasDirectToken(node, P.NOT);

	// predicate NOT? IN '(' (subqueryBody | expressions) ')'
	if (hasDirectToken(node, P.IN)) {
		const sub = subqueryOf(node);
		const args = sub
			? [{ kind: "subquery" as const, query: sub.query, cst: sub.cst }]
			: expressionsExprs(node).map(lowerExpr);
		return { kind: "predicate", op: "in", negated, operand, args, cst: node };
	}
	// predicate IS nullNotnull
	const nn = directChildrenOfRule(node, P.RULE_nullNotnull)[0];
	if (nn) {
		return { kind: "predicate", op: "null", negated: hasDirectToken(nn, P.NOT), operand, args: [], cst: node };
	}
	// predicate NOT? BETWEEN predicate AND predicate
	if (hasDirectToken(node, P.BETWEEN)) {
		return {
			kind: "predicate",
			op: "between",
			negated,
			operand,
			args: [preds[1] ? lowerExpr(preds[1]) : otherExpr(node), preds[2] ? lowerExpr(preds[2]) : otherExpr(node)],
			cst: node,
		};
	}
	// predicate SOUNDS LIKE predicate
	if (hasDirectToken(node, P.SOUNDS)) {
		return {
			kind: "predicate",
			op: "like",
			negated: false,
			operand,
			args: preds[1] ? [lowerExpr(preds[1])] : [],
			cst: node,
		};
	}
	// predicate NOT? LIKE predicate (ESCAPE STRING_LITERAL)?
	if (hasDirectToken(node, P.LIKE)) {
		return {
			kind: "predicate",
			op: "like",
			negated,
			operand,
			args: preds[1] ? [lowerExpr(preds[1])] : [],
			cst: node,
		};
	}
	// predicate NOT? (REGEXP | RLIKE) predicate
	if (hasDirectToken(node, P.REGEXP) || hasDirectToken(node, P.RLIKE)) {
		return {
			kind: "predicate",
			op: "rlike",
			negated,
			operand,
			args: preds[1] ? [lowerExpr(preds[1])] : [],
			cst: node,
		};
	}
	// predicate MEMBER OF '(' predicate ')'
	if (hasDirectToken(node, P.MEMBER)) {
		return {
			kind: "predicate",
			op: "member of",
			negated: false,
			operand,
			args: preds[1] ? [lowerExpr(preds[1])] : [],
			cst: node,
		};
	}
	// binaryComparisonPredicate / subqueryComparisonPredicate: left comparisonOperator (right | ANY/ALL/SOME (subqueryBody))
	const cmp = directChildrenOfRule(node, P.RULE_comparisonOperator)[0];
	if (cmp) {
		const sub = subqueryOf(node);
		const right: Expr = sub
			? { kind: "subquery", query: sub.query, cst: sub.cst }
			: preds[1]
				? lowerExpr(preds[1])
				: otherExpr(node);
		return { kind: "binary", op: cmp.getText(), left: operand, right, cst: node };
	}
	return operand;
}

/** expressionAtom (labelled left-recursive alternatives — see the grammar). */
function lowerExpressionAtom(node: ParserRuleContext): Expr {
	const atoms = directChildrenOfRule(node, P.RULE_expressionAtom);

	// constantExpressionAtom. Bare `?`, so neither `name` nor `ordinal` is set on the resulting
	// parameter node — MySQL's placeholder carries no positional/named identity of its own (see
	// ir.ts's `parameter` doc comment).
	const c = directChildrenOfRule(node, P.RULE_constant)[0];
	if (c && atoms.length === 0) return lowerConstant(c, node);
	// matchAgainstExpressionAtom: MATCH '(' cols ')' AGAINST '(' expr searchModifier? ')' — modelled as
	// a function call so EVERY matched column and the against-expression contribute column refs (a MATCH
	// atom has direct fullColumnName children, so this must run before the bare-column branch below).
	if (hasDirectToken(node, P.MATCH)) {
		const cols = directChildrenOfRule(node, P.RULE_fullColumnName).map(columnRef);
		const against = directChildrenOfRule(node, P.RULE_expression)[0];
		return {
			kind: "function",
			name: "match",
			args: [...cols, ...(against ? [lowerExpr(against)] : [])],
			aggregate: false,
			distinct: false,
			cst: node,
		};
	}
	// fullColumnNameExpressionAtom
	const fcn = directChildrenOfRule(node, P.RULE_fullColumnName)[0];
	if (fcn && atoms.length === 0) return columnRef(fcn);
	// functionCallExpressionAtom
	const fc = directChildrenOfRule(node, P.RULE_functionCall)[0];
	if (fc && atoms.length === 0) return lowerFunctionCall(fc);
	// mysqlVariableExpressionAtom: LOCAL_ID (`@x`, a user variable) or GLOBAL_ID (`@@version` /
	// `@@GLOBAL.x` / `@@SESSION.x`, a system variable) — session/local variable references, not
	// literals (dev.mysql.com/doc/refman/8.4/en/user-variables.html,
	// .../using-system-variables.html). `name` strips only the sigil(s); a scope qualifier
	// (`GLOBAL.` / `SESSION.`) stays part of the name, since it is part of the variable's path.
	const mv = directChildrenOfRule(node, P.RULE_mysqlVariable)[0];
	if (mv && atoms.length === 0) {
		const text = mv.getText();
		if (hasDirectToken(mv, P.GLOBAL_ID)) {
			return { kind: "variable", text, name: text.slice(2), system: true, cst: node };
		}
		return { kind: "variable", text, name: text.slice(1), cst: node };
	}

	// existsExpressionAtom: EXISTS '(' subqueryBody ')'
	if (hasDirectToken(node, P.EXISTS)) {
		const sub = subqueryOf(node);
		return sub ? { kind: "exists", query: sub.query, cst: node } : otherExpr(node);
	}
	// subqueryExpressionAtom: '(' subqueryBody ')'
	const sub = subqueryOf(node);
	if (sub) return { kind: "subquery", query: sub.query, cst: node };

	// collateExpressionAtom / binaryExpressionAtom / variableAssignExpressionAtom — passthroughs.
	if (
		atoms.length === 1 &&
		(hasDirectToken(node, P.COLLATE) || hasDirectToken(node, P.BINARY) || hasDirectToken(node, P.VAR_ASSIGN))
	) {
		return lowerExpr(atoms[0]);
	}
	// unaryExpressionAtom: unaryOperator expressionAtom
	const unary = directChildrenOfRule(node, P.RULE_unaryOperator)[0];
	if (unary && atoms.length === 1) {
		return { kind: "unary", op: unary.getText(), operand: lowerExpr(atoms[0]), cst: node };
	}
	// intervalExpressionAtom: INTERVAL expression intervalType — keep the inner expr's columns.
	if (hasDirectToken(node, P.INTERVAL)) {
		const e = directChildrenOfRule(node, P.RULE_expression)[0];
		return e ? lowerExpr(e) : otherExpr(node);
	}
	// bitExpressionAtom / mathExpressionAtom / jsonExpressionAtom: left OP right
	if (atoms.length === 2) {
		return {
			kind: "binary",
			op: binaryAtomOp(node),
			left: lowerExpr(atoms[0]),
			right: lowerExpr(atoms[1]),
			cst: node,
		};
	}

	// nestedExpressionAtom: '(' expression (',' expression)* ')' — a single expr is grouping
	// (passthrough); a tuple stays `other` (columnsOf recovers its refs from the CST).
	const innerExprs = directChildrenOfRule(node, P.RULE_expression);
	if (innerExprs.length === 1 && atoms.length === 0) return lowerExpr(innerExprs[0]);
	if (atoms.length === 1) return lowerExpr(atoms[0]);
	return otherExpr(node);
}

function binaryAtomOp(node: ParserRuleContext): string {
	for (const r of [P.RULE_bitOperator, P.RULE_multOperator, P.RULE_addOperator, P.RULE_jsonOperator]) {
		const op = directChildrenOfRule(node, r)[0];
		if (op) return op.getText();
	}
	return "";
}

/** The direct expression children of the `expressions` list inside an IN payload. */
function expressionsExprs(node: ParserRuleContext): ParserRuleContext[] {
	const list = directChildrenOfRule(node, P.RULE_expressions)[0];
	return list ? directChildrenOfRule(list, P.RULE_expression) : [];
}

// --- function calls -----------------------------------------------------------

/** functionCall:
 *    specificFunction | aggregateWindowedFunction | nonAggregateWindowedFunction
 *  | scalarFunctionName '(' functionArgs? ')' | fullId '(' functionArgs? ')' | passwordFunctionClause */
function lowerFunctionCall(fc: ParserRuleContext): Expr {
	const agg = directChildrenOfRule(fc, P.RULE_aggregateWindowedFunction)[0];
	if (agg) return lowerWindowedFunction(agg, fc, true);
	const nonAgg = directChildrenOfRule(fc, P.RULE_nonAggregateWindowedFunction)[0];
	if (nonAgg) return lowerWindowedFunction(nonAgg, fc, false);
	const spec = directChildrenOfRule(fc, P.RULE_specificFunction)[0];
	if (spec) return lowerSpecificFunction(spec);

	const scalarName = directChildrenOfRule(fc, P.RULE_scalarFunctionName)[0];
	const fullId = directChildrenOfRule(fc, P.RULE_fullId)[0];
	const name = scalarName
		? scalarName.getText()
		: fullId
			? lastPart(dottedParts(fullId).parts)
			: (leftmostToken(fc) ?? "");
	return {
		kind: "function",
		name: name.toLowerCase(),
		args: argsOf(fc),
		aggregate: AGGREGATES.has(name.toLowerCase()),
		distinct: false,
		cst: fc,
	};
}

/** aggregate / non-aggregate windowed function → a function expr; carries DISTINCT and an OVER window. */
function lowerWindowedFunction(fn: ParserRuleContext, fc: ParserRuleContext, aggregate: boolean): Expr {
	const name = (leftmostToken(fn) ?? "").toLowerCase();
	const over = directChildrenOfRule(fn, P.RULE_overClause)[0] ?? directChildrenOfRule(fc, P.RULE_overClause)[0];
	return {
		kind: "function",
		name,
		args: argsOf(fn),
		// A windowed aggregate is not a grouping aggregate for the `aggregated` heuristic — hasAggregate
		// already ignores calls with a window, so `aggregate: true` here is safe and correct.
		aggregate: aggregate || AGGREGATES.has(name),
		distinct: hasDirectToken(fn, P.DISTINCT),
		window: over ? lowerOver(over) : undefined,
		cst: fc,
	};
}

/** specificFunction — CAST/CONVERT lower to a cast; CASE to a case; the rest to a generic function. */
function lowerSpecificFunction(spec: ParserRuleContext): Expr {
	if (hasDirectToken(spec, P.CASE)) return lowerCaseFunc(spec);
	if (hasDirectToken(spec, P.CAST) || hasDirectToken(spec, P.CONVERT)) {
		const inner = directChildrenOfRule(spec, P.RULE_expression)[0];
		const dt = directChildrenOfRule(spec, P.RULE_convertedDataType)[0];
		return {
			kind: "cast",
			expr: inner ? lowerExpr(inner) : otherExpr(spec),
			typeText: dt ? dt.getText() : "",
			cst: spec,
		};
	}
	const name = (leftmostToken(spec) ?? "").toLowerCase();
	return { kind: "function", name, args: argsOf(spec), aggregate: false, distinct: false, cst: spec };
}

/** CASE: `CASE expr? (WHEN fArg THEN fArg)+ (ELSE fArg)? END`. A simple CASE (with a subject expr)
 *  desugars to `subject = whenValue` so the subject's columns are seen (mirrors the other dialects). */
function lowerCaseFunc(spec: ParserRuleContext): Expr {
	const subjectNode = directChildrenOfRule(spec, P.RULE_expression)[0];
	const subject = subjectNode ? lowerExpr(subjectNode) : undefined;
	const whens = directChildrenOfRule(spec, P.RULE_caseFuncAlternative).map((alt) => {
		const fargs = directChildrenOfRule(alt, P.RULE_functionArg);
		const whenE = fargs[0] ? lowerArg(fargs[0]) : otherExpr(alt);
		const thenE = fargs[1] ? lowerArg(fargs[1]) : otherExpr(alt);
		return subject
			? { when: { kind: "binary" as const, op: "=", left: subject, right: whenE, cst: alt }, then: thenE }
			: { when: whenE, then: thenE };
	});
	// The ELSE functionArg is a direct child of specificFunction (WHEN/THEN ones live in caseFuncAlternative).
	const elseNode = directChildrenOfRule(spec, P.RULE_functionArg)[0];
	return { kind: "case", whens, elseExpr: elseNode ? lowerArg(elseNode) : undefined, cst: spec };
}

/** functionArgs / functionArg args of a call node → lowered Expr[]. Both wrap constant / fullColumnName
 *  / functionCall / expression; some callers (aggregates, CAST) attach these arg rules directly. */
function argsOf(host: ParserRuleContext): Expr[] {
	const out: Expr[] = [];
	for (const c of kidsOf(host)) {
		if (!(c instanceof ParserRuleContext)) continue;
		if (c.ruleIndex === P.RULE_functionArgs) {
			for (const a of directArgRuleChildren(c)) out.push(lowerArg(a));
		} else if (c.ruleIndex === P.RULE_functionArg) {
			const a = directArgRuleChildren(c)[0];
			if (a) out.push(lowerArg(a));
		} else if (ARG_RULES.has(c.ruleIndex)) {
			out.push(lowerArg(c));
		}
	}
	return out;
}

const ARG_RULES = new Set<number>([P.RULE_constant, P.RULE_fullColumnName, P.RULE_functionCall, P.RULE_expression]);

function directArgRuleChildren(node: ParserRuleContext): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	for (const c of kidsOf(node)) if (c instanceof ParserRuleContext && ARG_RULES.has(c.ruleIndex)) out.push(c);
	return out;
}

function lowerArg(node: ParserRuleContext): Expr {
	switch (node.ruleIndex) {
		case P.RULE_constant:
			return lowerConstant(node);
		case P.RULE_fullColumnName:
			return columnRef(node);
		case P.RULE_functionCall:
			return lowerFunctionCall(node);
		default:
			return lowerExpr(node);
	}
}

/** overClause: OVER ('(' windowSpec? ')' | windowName)  /  windowSpec: windowName? partitionClause?
 *  orderByClause? frameClause?  /  partitionClause: PARTITION BY expression (',' expression)*. */
function lowerOver(over: ParserRuleContext): WindowSpec {
	const spec = directChildrenOfRule(over, P.RULE_windowSpec)[0];
	const pc = spec ? directChildrenOfRule(spec, P.RULE_partitionClause)[0] : undefined;
	const partitionBy = pc ? directChildrenOfRule(pc, P.RULE_expression).map(lowerExpr) : [];
	const obc = spec ? directChildrenOfRule(spec, P.RULE_orderByClause)[0] : undefined;
	const orderBy = obc ? orderByExprs(obc) : [];
	return { partitionBy, orderBy, cst: over };
}

// --- identifiers --------------------------------------------------------------

/** A fullColumnName / fullId as a column Expr — RAW parts (delimiters intact, dots stripped). */
function columnRef(node: ParserRuleContext): Expr {
	const { parts, spans } = dottedParts(node);
	return {
		kind: "column",
		parts: parts.length ? parts : [node.getText()],
		partSpans: collapsePartSpans(spans),
		cst: node,
	};
}

/** The dotted parts of a fullColumnName / fullId, each with its own `PartSpan` (all-or-nothing per
 *  ref, collapsed by the caller). A `uid` rule and a `.uid` dottedId go through the shared
 *  `partSpanOf`; a glued `DOT_ID` token (the unspaced `a.b` style, `DOT_ID: '.' ID_LITERAL`) is a
 *  single lexer token, not a node, so its identifier span is computed past the leading dot via
 *  `dotIdPartSpanOf`. `DOT_ID` reaches this two ways, both handled: as a direct terminal child of
 *  `fullId` (`uid (DOT_ID | '.' uid)?`), and nested inside a `dottedId` of `fullColumnName`
 *  (`uid (dottedId dottedId?)?` where `dottedId: DOT_ID | '.' uid`). Both strip the leading dot from
 *  the emitted part text. A span is `undefined` only for a part that genuinely carries no token. */
function dottedParts(node: ParserRuleContext): { parts: string[]; spans: (PartSpan | undefined)[] } {
	const parts: string[] = [];
	const spans: (PartSpan | undefined)[] = [];
	const pushDotId = (sym: Token): void => {
		const t = sym.text ?? "";
		parts.push(t.startsWith(".") ? t.slice(1) : t);
		spans.push(dotIdPartSpanOf(sym));
	};
	for (const c of kidsOf(node)) {
		if (c instanceof ParserRuleContext) {
			if (c.ruleIndex === P.RULE_uid) {
				parts.push(c.getText());
				spans.push(partSpanOf(c));
			} else if (c.ruleIndex === P.RULE_dottedId) {
				const iu = directChildrenOfRule(c, P.RULE_uid)[0];
				const dotId = dotIdTerminalOf(c);
				if (iu) {
					parts.push(iu.getText());
					spans.push(partSpanOf(iu));
				} else if (dotId) {
					pushDotId(dotId.symbol);
				} else {
					const t = c.getText();
					parts.push(t.startsWith(".") ? t.slice(1) : t);
					spans.push(undefined);
				}
			}
		} else if (c instanceof TerminalNode && c.symbol.type === P.DOT_ID) {
			pushDotId(c.symbol);
		}
	}
	return { parts, spans };
}

/** The `DOT_ID` terminal directly under a `dottedId` (its `: DOT_ID` alternative), else `undefined`
 *  (the `'.' uid` alternative). */
function dotIdTerminalOf(node: ParserRuleContext): TerminalNode | undefined {
	for (const c of kidsOf(node)) if (c instanceof TerminalNode && c.symbol.type === P.DOT_ID) return c;
	return undefined;
}

function lastPart(parts: string[]): string {
	return parts.length ? parts[parts.length - 1] : "";
}

// --- expression subqueries (scalar / IN / EXISTS) -----------------------------

/** Scalar / IN / EXISTS subqueries in this query spec's expressions — every nested `subqueryBody` /
 *  `selectStatement` that is NOT a FROM source. Rooted at the querySpecification, so SELECT-list /
 *  WHERE / GROUP BY / HAVING / ORDER BY / LIMIT expressions are all covered. `continue` at each
 *  boundary so an inner query collects its own expression subqueries in its own scope (a subqueryBody
 *  is the boundary for the '(' … ')' operand forms — its inner selectStatement is never re-visited). */
function extractExpressionSubqueries(qspec: ParserRuleContext, fromSubqueries: Set<ParserRuleContext>): QueryExpr[] {
	const out: QueryExpr[] = [];
	const walk = (n: ParseTree): void => {
		for (const c of kidsOf(n)) {
			if (!(c instanceof ParserRuleContext)) continue;
			if (c.ruleIndex === P.RULE_selectStatement || c.ruleIndex === P.RULE_subqueryBody) {
				if (!fromSubqueries.has(c)) {
					out.push(c.ruleIndex === P.RULE_subqueryBody ? lowerSubqueryBody(c) : lowerSelectStatement(c));
				}
				continue; // its own scope — don't descend
			}
			walk(c);
		}
	};
	walk(qspec);
	return out;
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
		// literal / star / subquery / exists / lambda / with → no column refs at this level
	}
}

/** Fallback: recover column references from inside an unmodelled `other` node — descend the CST,
 *  lowering any fullColumnName, but never into a nested selectStatement / subqueryBody (own scope). */
function cstColumnRefs(node: ParseTree, acc: ColumnRef[], clause: Clause): void {
	for (const child of kidsOf(node)) {
		if (!(child instanceof ParserRuleContext)) continue;
		if (child.ruleIndex === P.RULE_selectStatement || child.ruleIndex === P.RULE_subqueryBody) continue;
		if (child.ruleIndex === P.RULE_fullColumnName) {
			const e = columnRef(child);
			if (e.kind === "column") {
				acc.push({ kind: "columnref", parts: e.parts, clause, cst: child, partSpans: e.partSpans });
				continue;
			}
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

// --- CST navigation helpers ---------------------------------------------------

function kidsOf(node: ParseTree): ParseTree[] {
	if (node instanceof ParserRuleContext) return node.children ?? [];
	const out: ParseTree[] = [];
	for (let i = 0; i < node.getChildCount(); i++) {
		const c = node.getChild(i);
		if (c) out.push(c);
	}
	return out;
}

function* descendants(node: ParseTree): Generator<ParserRuleContext> {
	for (const child of kidsOf(node)) {
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
	for (const child of kidsOf(node)) {
		if (child instanceof ParserRuleContext && child.ruleIndex === ruleIndex) out.push(child);
	}
	return out;
}

function hasDirectToken(node: ParseTree, type: number): boolean {
	for (const child of kidsOf(node)) {
		if (child instanceof TerminalNode && child.symbol.type === type) return true;
	}
	return false;
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
