import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import { SqliteParser as P } from "../generated/sqlite/SqliteParser.js";
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
} from "../ir/ir.js";
import { keywordCategory, swallowedCategories, swallowedStatements, type StatementCategory } from "../ir/statement.js";
import { partSpansOf } from "../ir/part-span.js";
import { freezeIR } from "../ir/freeze.js";
import { qualifiedNameOf, type QualifiedName } from "../ir/qualified-name.js";
import { SQLITE_NAME_CONFIG } from "./fold.js";

/** The structured name for a table source's raw parts (issue #38) — role assignment + identity
 *  key + fqn happen HERE, at lowering, where the dialect's namespace shape is known. */
function relationOf(rawParts: string[]): QualifiedName {
	return qualifiedNameOf(rawParts, SQLITE_NAME_CONFIG);
}

// ---------------------------------------------------------------------------
// Lowering — SQLite (grammars-v4 sql/sqlite fork, Martin Mirchev's precedence-
// cascade `expr` variant) CST -> the shared, dialect-neutral IR (src/ir/ir.ts).
// The semantic layer runs on the IR unchanged; only this file knows SQLite's
// grammar. Core query path: select_stmt, select_core, join_clause,
// table_or_subquery, result_column, and the expr_or→…→expr_base cascade.
//
// Navigation is by rule index against the generated parser, never by string
// comparison of rule names. Nested `select_stmt` nodes belong to their own
// scope, so shallow walks never descend into them.
//
// Identifier-delimiter contract (docs/identifier-delimiter-contract.md): SQLite
// follows the "kept" convention shared by every dialect except BigQuery — every
// identifier field (ColumnRef.parts / TableSource.name / TableSource.alias /
// CteDef.name / Projection.name) carries its RAW text with quoting delimiters
// intact (SQLite quotes are "double", [brackets], `backticks`). Case-folding
// and delimiter-stripping for identity/display happen downstream in
// src/ident/fold.ts (foldIdentifier / displayName), never here.
// ---------------------------------------------------------------------------

// sqlite.org/lang_aggfunc.html + lang_corefunc's aggregate list — used only to set the
// `aggregate` heuristic flag (which feeds SelectExpr.aggregated); type inference is separate.
const AGGREGATES = new Set(["count", "sum", "total", "avg", "min", "max", "group_concat", "string_agg"]);

/** Lower a parsed SQLite file (`parse`: a `;`-separated sql_stmt_list) into the IR. A single
 *  SELECT/VALUES statement lowers fully; anything else (DDL/DML/pragma/utility, multi-statement
 *  batches, EXPLAIN) becomes a flagged non-query body — a valid parse never throws. */
export function lower(tree: ParserRuleContext): QueryExpr {
	const q = lowerImpl(tree);
	q.dialect = "sqlite";
	return freezeIR(q);
}

function lowerImpl(tree: ParserRuleContext): QueryExpr {
	const statement = statementCategory(tree);
	const list = firstOfRule(tree, P.RULE_sql_stmt_list);
	const stmts = list ? directChildrenOfRule(list, P.RULE_sql_stmt) : [];
	// Recovery-swallowed statements count toward batch-ness: a broken statement makes recovery dump
	// the rest of the batch as flat error nodes, so the sql_stmt count alone under-reports (issue #21).
	const swallowed = swallowedStatements(tree);
	const total = stmts.length + swallowed;
	if (total !== 1 || stmts.length !== 1) {
		// Anchor a multi-statement span to the FIRST statement, not the whole `parse` container (which
		// reaches EOF), so a downstream AST index read doesn't see a bogus enclosure over statements 2..n.
		const cst = total > 1 && stmts.length > 0 ? stmts[0] : tree;
		const q = nonQuery(cst, total > 1 ? "multi-statement" : total === 1 ? "broken" : "empty");
		q.statement = statement;
		return q;
	}
	const stmt = stmts[0];
	// EXPLAIN / EXPLAIN QUERY PLAN returns bytecode or a plan, not the query's rows → utility, not a query.
	const select = hasDirectToken(stmt, P.EXPLAIN_) ? undefined : directChildrenOfRule(stmt, P.RULE_select_stmt)[0];
	if (select) {
		const q = lowerSelectStmt(select);
		q.statement = statement;
		return q;
	}
	const q = nonQuery(stmt, "non-query");
	q.statement = statement;
	return q;
}

// --- statement categories ------------------------------------------------------

/** Per-statement categories for every `sql_stmt` in a parsed `parse`, in source order — the
 *  file-level view behind statementCategory (which folds >1 into "compound"). Parity with the
 *  other dialects; feeds the corpus reclassifier. */
export function statementCategories(tree: ParserRuleContext): StatementCategory[] {
	const list = firstOfRule(tree, P.RULE_sql_stmt_list);
	const stmts = list ? directChildrenOfRule(list, P.RULE_sql_stmt) : [];
	return [...stmts.map(stmtCategory), ...swallowedCategories(tree)];
}

function statementCategory(tree: ParserRuleContext): StatementCategory {
	const cats = statementCategories(tree);
	if (cats.length === 0) return "other";
	if (cats.length > 1) return "compound";
	return cats[0];
}

// SQLite's sql_stmt groups every statement kind as a distinct sub-rule, so the category is exact
// per rule index. Maintenance commands (ANALYZE / REINDEX / VACUUM) and ATTACH / DETACH / PRAGMA
// are session/admin utilities; transaction control is tcl; object DML/DDL are the read/write/define
// paths. EXPLAIN prefixes any of these but yields a plan, not rows → utility.
const STMT_CATEGORY: readonly [number, StatementCategory][] = [
	[P.RULE_select_stmt, "query"],
	[P.RULE_insert_stmt, "dml"],
	[P.RULE_update_stmt, "dml"],
	[P.RULE_delete_stmt, "dml"],
	[P.RULE_alter_table_stmt, "ddl"],
	[P.RULE_create_index_stmt, "ddl"],
	[P.RULE_create_table_stmt, "ddl"],
	[P.RULE_create_trigger_stmt, "ddl"],
	[P.RULE_create_view_stmt, "ddl"],
	[P.RULE_create_virtual_table_stmt, "ddl"],
	[P.RULE_drop_stmt, "ddl"],
	[P.RULE_begin_stmt, "tcl"],
	[P.RULE_commit_stmt, "tcl"],
	[P.RULE_rollback_stmt, "tcl"],
	[P.RULE_savepoint_stmt, "tcl"],
	[P.RULE_release_stmt, "tcl"],
	[P.RULE_analyze_stmt, "utility"],
	[P.RULE_attach_stmt, "utility"],
	[P.RULE_detach_stmt, "utility"],
	[P.RULE_pragma_stmt, "utility"],
	[P.RULE_reindex_stmt, "utility"],
	[P.RULE_vacuum_stmt, "utility"],
];

function stmtCategory(stmt: ParserRuleContext): StatementCategory {
	if (hasDirectToken(stmt, P.EXPLAIN_)) return "utility";
	for (const [rule, cat] of STMT_CATEGORY) if (directChildrenOfRule(stmt, rule).length) return cat;
	// No finer rule matched (mid-edit / recovery) — the leading keyword is the honest fallback.
	return keywordCategory(stmt.start?.text ?? "");
}

function nonQuery(cst: ParserRuleContext, reason: UnsupportedFlag): QueryExpr {
	return {
		kind: "query",
		ctes: [],
		body: { kind: "select", projections: [], from: [], columns: [], aggregated: false, unsupported: [reason], cst },
		cst,
	};
}

// --- SELECT statement ----------------------------------------------------------

/** select_stmt: with_clause? select_core (compound_operator select_core)* order_clause? limit_clause? */
function lowerSelectStmt(stmt: ParserRuleContext): QueryExpr {
	const withClause = directChildrenOfRule(stmt, P.RULE_with_clause)[0];
	const ctes = withClause ? directChildrenOfRule(withClause, P.RULE_common_table_expression).map(lowerCte) : [];
	const cores = directChildrenOfRule(stmt, P.RULE_select_core);
	const ops = directChildrenOfRule(stmt, P.RULE_compound_operator);
	const body = foldCompound(cores, ops, stmt);

	const orderClause = directChildrenOfRule(stmt, P.RULE_order_clause)[0];
	const orderBy = orderClause ? lowerOrderBy(orderClause) : undefined;
	// A trailing ORDER BY resolves against the whole compound's output columns. SQLite never
	// produces a pipe body, but QueryBody includes PipeExpr (no `columns`), so narrow first.
	if (orderBy && body.kind !== "pipe") for (const o of orderBy) columnsOf(o, body.columns, "orderBy");

	const limitClause = directChildrenOfRule(stmt, P.RULE_limit_clause)[0];
	const limit = limitClause ? lowerLimit(limitClause) : undefined;
	return { kind: "query", ctes, body, orderBy, limit, cst: stmt };
}

/** Left-fold a compound SELECT (cores interleaved with UNION/INTERSECT/EXCEPT operators).
 *  SQLite compound operators are left-associative. */
function foldCompound(cores: ParserRuleContext[], ops: ParserRuleContext[], cst: ParserRuleContext): QueryBody {
	let body: QueryBody = cores[0] ? buildSelectCore(cores[0]) : emptyBody(cst);
	for (let i = 0; i < ops.length; i++) {
		const right = cores[i + 1] ? buildSelectCore(cores[i + 1]) : emptyBody(ops[i]);
		body = {
			kind: "setop",
			op: compoundOp(ops[i]),
			all: hasDirectToken(ops[i], P.ALL_),
			left: body,
			right,
			columns: [],
			cst: ops[i],
		};
	}
	return body;
}

/** compound_operator: UNION_ ALL_? | INTERSECT_ | EXCEPT_ */
function compoundOp(op: ParserRuleContext): "union" | "except" | "intersect" {
	if (hasDirectToken(op, P.INTERSECT_)) return "intersect";
	if (hasDirectToken(op, P.EXCEPT_)) return "except";
	return "union";
}

/** common_table_expression: cte_table_name AS_ (NOT_? MATERIALIZED_)? '(' select_stmt ')'
 *  cte_table_name: table_name ('(' column_name (',' column_name)* ')')? */
function lowerCte(cte: ParserRuleContext): CteDef {
	const ctn = directChildrenOfRule(cte, P.RULE_cte_table_name)[0];
	const nameNode = ctn ? directChildrenOfRule(ctn, P.RULE_table_name)[0] : undefined;
	const cols = ctn ? directChildrenOfRule(ctn, P.RULE_column_name).map((c) => c.getText()) : [];
	const sel = directChildrenOfRule(cte, P.RULE_select_stmt)[0];
	return {
		name: nameNode ? nameNode.getText() : "",
		nameCst: nameNode,
		columnAliases: cols.length ? cols : undefined,
		body: sel ? lowerSelectStmt(sel) : emptyQuery(cte),
		cst: cte,
	};
}

// --- the SELECT core -----------------------------------------------------------

/** select_core:
 *    SELECT_ (DISTINCT_|ALL_)? result_column (',' result_column)* (FROM_ join_clause)?
 *      (WHERE_ expr)? (GROUP_ BY_ expr (',' expr)* (HAVING_ expr)?)? (WINDOW_ …)?
 *  | values_clause */
function buildSelectCore(core: ParserRuleContext): SelectExpr {
	const values = directChildrenOfRule(core, P.RULE_values_clause)[0];
	if (values) return buildValues(values);

	const projections = directChildrenOfRule(core, P.RULE_result_column).map(buildProjection);

	const joinClause = directChildrenOfRule(core, P.RULE_join_clause)[0];
	const from = joinClause ? buildSources(joinClause) : [];
	const { joinConditions, onByConstraint, usingByConstraint } = joinClause
		? collectJoinData(joinClause)
		: { joinConditions: [] as Expr[], onByConstraint: new Map(), usingByConstraint: new Map() };
	const joins = joinClause ? buildJoins(joinClause, from, onByConstraint, usingByConstraint) : [];

	const { whereExpr, groupBy, having } = selectCoreClauses(core);

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

	const subqueries = extractExpressionSubqueries(core);

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
		aggregated,
		subqueries: subqueries.length ? subqueries : undefined,
		cst: core,
	};
}

// --- expression subqueries (scalar / IN / EXISTS) --------------------------------

/** Expression subqueries appearing in this select's expressions (SELECT list, WHERE, GROUP BY,
 *  HAVING, JOIN ON, TVF args) — every `select_stmt` reachable without crossing another select_stmt,
 *  EXCLUDING the FROM subqueries (a `table_or_subquery`'s direct select_stmt child is a Source,
 *  scoped separately by buildSource). Mirrors snowflake's extractExpressionSubqueries: the scope
 *  pass discovers expression-nested subqueries ONLY through `SelectExpr.subqueries`, so their
 *  (possibly correlated) columns resolve as children of this scope. */
function extractExpressionSubqueries(core: ParserRuleContext): QueryExpr[] {
	const out: QueryExpr[] = [];
	const walk = (n: ParseTree): void => {
		for (const child of kidsOf(n)) {
			if (!(child instanceof ParserRuleContext)) continue;
			if (child.ruleIndex === P.RULE_select_stmt) {
				// A table_or_subquery's select_stmt is a FROM source, not an expression subquery.
				if (!isRule(child.parent ?? undefined, P.RULE_table_or_subquery)) out.push(lowerSelectStmt(child));
				continue; // its own scope — don't descend
			}
			walk(child);
		}
	};
	walk(core);
	return out;
}

/** The WHERE / GROUP BY / HAVING exprs of a select_core. They are all direct `expr` children of
 *  select_core (result_column and join_clause exprs are nested, so never direct children); classify
 *  each by the keyword token that most recently preceded it. */
function selectCoreClauses(core: ParserRuleContext): { whereExpr?: Expr; groupBy?: Expr[]; having?: Expr } {
	let mode: "where" | "group" | "having" | undefined;
	let whereExpr: Expr | undefined;
	let having: Expr | undefined;
	const groupBy: Expr[] = [];
	for (const c of kidsOf(core)) {
		if (c instanceof TerminalNode) {
			const t = c.symbol.type;
			if (t === P.WHERE_) mode = "where";
			else if (t === P.GROUP_) mode = "group";
			else if (t === P.HAVING_) mode = "having";
			else if (t === P.WINDOW_) mode = undefined;
			continue;
		}
		if (c instanceof ParserRuleContext && c.ruleIndex === P.RULE_expr) {
			const e = lowerExpr(c);
			if (mode === "where") whereExpr = e;
			else if (mode === "group") groupBy.push(e);
			else if (mode === "having") having = e;
		}
	}
	return { whereExpr, groupBy: groupBy.length ? groupBy : undefined, having };
}

/** values_clause: VALUES_ value_row (',' value_row)*  /  value_row: '(' expr (',' expr)* ')'.
 *  Lowers to a modelled select whose projections carry the row exprs, named column1…columnN
 *  (SQLite's default VALUES output names). */
function buildValues(values: ParserRuleContext): SelectExpr {
	const firstRow = directChildrenOfRule(values, P.RULE_value_row)[0];
	const exprs = firstRow ? directChildrenOfRule(firstRow, P.RULE_expr) : [];
	const projections: Projection[] = exprs.map((e, i) => ({
		name: `column${i + 1}`,
		isStar: false,
		expr: lowerExpr(e),
		cst: e,
	}));
	const columns: ColumnRef[] = [];
	for (const p of projections) columnsOf(p.expr, columns, "projection");
	const subqueries = extractExpressionSubqueries(values);
	return {
		kind: "select",
		projections,
		from: [],
		columns,
		aggregated: false,
		subqueries: subqueries.length ? subqueries : undefined,
		cst: values,
	};
}

// --- projections ---------------------------------------------------------------

/** result_column: STAR | table_name '.' STAR | expr (AS_? column_alias)? */
function buildProjection(rc: ParserRuleContext): Projection {
	if (hasDirectToken(rc, P.STAR)) {
		const tableName = directChildrenOfRule(rc, P.RULE_table_name)[0];
		const expr: Expr = { kind: "star", qualifier: tableName ? [tableName.getText()] : undefined, cst: rc };
		return { name: undefined, isStar: true, expr, cst: rc };
	}
	const exprNode = directChildrenOfRule(rc, P.RULE_expr)[0];
	const expr = exprNode ? lowerExpr(exprNode) : otherExpr(rc);
	const aliasNode = directChildrenOfRule(rc, P.RULE_column_alias)[0];
	let name = aliasNode ? aliasNode.getText() : undefined;
	if (name === undefined && expr.kind === "column") name = expr.parts[expr.parts.length - 1];
	return { name, isStar: false, expr, ...(aliasNode ? { aliasCst: aliasNode } : {}), cst: rc };
}

// --- sources -------------------------------------------------------------------

/** The base sources of a join_clause, in source order. A parenthesized join `( join_clause )` is a
 *  grouping (NOT a derived table — its columns stay directly visible), so its inner sources are
 *  flattened into this level rather than hidden behind an anonymous subquery. */
function buildSources(joinClause: ParserRuleContext): Source[] {
	const out: Source[] = [];
	const addSource = (tos: ParserRuleContext): void => {
		const sel = directChildrenOfRule(tos, P.RULE_select_stmt)[0];
		const nested = sel ? undefined : directChildrenOfRule(tos, P.RULE_join_clause)[0];
		if (nested) out.push(...buildSources(nested));
		else out.push(buildSource(tos));
	};
	// join_clause: table_or_subquery join_step*. The left operand is a direct table_or_subquery child;
	// each subsequent operand lives inside a join_step. Direct-then-steps preserves source order.
	for (const tos of directChildrenOfRule(joinClause, P.RULE_table_or_subquery)) addSource(tos);
	for (const step of directChildrenOfRule(joinClause, P.RULE_join_step)) {
		const tos = directChildrenOfRule(step, P.RULE_table_or_subquery)[0];
		if (tos) addSource(tos);
	}
	return out;
}

/** table_or_subquery — one of:
 *    (schema_name '.')? table_name (AS_ table_alias | table_alias_excluding_joins)? …
 *  | (schema_name '.')? table_function_name '(' expr (',' expr)* ')' (AS_? table_alias)?
 *  | '(' select_stmt ')' (AS_? table_alias)? */
function buildSource(tos: ParserRuleContext): Source {
	const { alias, aliasCst } = tableAliasOf(tos);

	// '(' select_stmt ')' — a derived table.
	const sel = directChildrenOfRule(tos, P.RULE_select_stmt)[0];
	if (sel) {
		return { kind: "subquery", query: lowerSelectStmt(sel), alias, aliasCst, cst: tos };
	}

	// table_function_name(args) — a table-valued function; its output columns need the signature
	// (unknown without a catalog, never wrong — the inference contract).
	const tfn = directChildrenOfRule(tos, P.RULE_table_function_name)[0];
	if (tfn) {
		const schemaName = directChildrenOfRule(tos, P.RULE_schema_name)[0];
		const partNodes = [schemaName, tfn].filter((n): n is ParserRuleContext => n !== undefined);
		const name = partNodes.map((n) => n.getText());
		return {
			kind: "table",
			relation: relationOf(name),
			namePartSpans: partSpansOf(partNodes),
			alias,
			aliasCst,
			cst: tos,
		};
	}

	// (schema_name '.')? table_name — a plain table reference.
	const tableName = directChildrenOfRule(tos, P.RULE_table_name)[0];
	const schemaName = directChildrenOfRule(tos, P.RULE_schema_name)[0];
	const partNodes = [schemaName, tableName].filter((n): n is ParserRuleContext => n !== undefined);
	const parts = partNodes.map((n) => n.getText());
	const name = parts.length ? parts : [tos.getText()];
	return {
		kind: "table",
		relation: relationOf(name),
		namePartSpans: partNodes.length ? partSpansOf(partNodes) : undefined,
		alias,
		aliasCst,
		cst: tos,
	};
}

/** The FROM-source alias: `AS table_alias` / bare `table_alias_excluding_joins` (plain table),
 *  or `AS? table_alias` (subquery / table function). */
function tableAliasOf(tos: ParserRuleContext): { alias?: string; aliasCst?: ParserRuleContext } {
	const a =
		directChildrenOfRule(tos, P.RULE_table_alias)[0] ??
		directChildrenOfRule(tos, P.RULE_table_alias_excluding_joins)[0];
	return a ? { alias: a.getText(), aliasCst: a } : {};
}

// --- joins ---------------------------------------------------------------------

/** ON exprs and USING column lists for every join_constraint in this select's join tree (descending
 *  through parenthesized nested join_clauses, but NOT into subquery select_stmts). The ON exprs are
 *  lowered ONCE and keyed by their join_constraint CST so buildJoins shares the same Expr objects
 *  (the reference-identity contract between joinConditions and joins). */
function collectJoinData(joinClause: ParserRuleContext): {
	joinConditions: Expr[];
	onByConstraint: Map<ParserRuleContext, Expr>;
	usingByConstraint: Map<ParserRuleContext, string[]>;
} {
	const joinConditions: Expr[] = [];
	const onByConstraint = new Map<ParserRuleContext, Expr>();
	const usingByConstraint = new Map<ParserRuleContext, string[]>();
	for (const jc of shallowCollectOfRule(joinClause, P.RULE_join_constraint)) {
		const onExpr = directChildrenOfRule(jc, P.RULE_expr)[0];
		if (onExpr) {
			const e = lowerExpr(onExpr);
			joinConditions.push(e);
			onByConstraint.set(jc, e);
		} else {
			const cols = directChildrenOfRule(jc, P.RULE_column_name).map((c) => c.getText());
			if (cols.length) usingByConstraint.set(jc, cols);
		}
	}
	return { joinConditions, onByConstraint, usingByConstraint };
}

/** join_clause: table_or_subquery join_step*  /  join_step: join_operator table_or_subquery
 *  join_constraint?. One Join per join_step whose operator is an explicit JOIN (a bare COMMA step is a
 *  plain FROM entry, not a join — the IR contract). Each join.source is the reference-identical `from`
 *  entry for that step's right table_or_subquery; join.on is the shared Expr from onByConstraint.
 *  Join.cst is the `join_step` node itself, so its span is the full `[type] JOIN <table> [ON …|USING …]`
 *  construct (the src/ir/ir.ts Join.cst contract) — the reason the grammar carries the join_step rule. */
function buildJoins(
	joinClause: ParserRuleContext,
	from: Source[],
	onByConstraint: Map<ParserRuleContext, Expr>,
	usingByConstraint: Map<ParserRuleContext, string[]>,
): Join[] {
	const joins: Join[] = [];
	for (const step of directChildrenOfRule(joinClause, P.RULE_join_step)) {
		const op = directChildrenOfRule(step, P.RULE_join_operator)[0];
		if (!op || hasDirectToken(op, P.COMMA)) continue; // comma → plain from entry, not a join
		const tos = directChildrenOfRule(step, P.RULE_table_or_subquery)[0];
		if (!tos) continue;
		const source = sourceFor(from, tos);
		if (!source) continue;
		const jc = directChildrenOfRule(step, P.RULE_join_constraint)[0];
		const { kind, natural } = joinKind(op);
		const on = jc ? onByConstraint.get(jc) : undefined;
		const using = jc ? usingByConstraint.get(jc) : undefined;
		joins.push({ kind, source, on, using, natural: natural || undefined, cst: step });
	}
	return joins;
}

/** The `from` entry for a join's right table_or_subquery: the source whose cst IS that node, or (a
 *  flattened parenthesized-join operand) the first source nested within it. */
function sourceFor(from: Source[], tos: ParserRuleContext): Source | undefined {
	return from.find((s) => s.cst === tos) ?? from.find((s) => isWithin(s.cst, tos));
}

/** join_operator: COMMA | NATURAL_? ((LEFT_|RIGHT_|FULL_) OUTER_? | INNER_ | CROSS_)? JOIN_ */
function joinKind(op: ParserRuleContext): { kind: JoinKind; natural: boolean } {
	const natural = hasDirectToken(op, P.NATURAL_);
	if (hasDirectToken(op, P.CROSS_)) return { kind: "cross", natural };
	if (hasDirectToken(op, P.LEFT_)) return { kind: "left", natural };
	if (hasDirectToken(op, P.RIGHT_)) return { kind: "right", natural };
	if (hasDirectToken(op, P.FULL_)) return { kind: "full", natural };
	if (hasDirectToken(op, P.INNER_)) return { kind: "inner", natural };
	return { kind: natural ? "natural" : "inner", natural };
}

// --- ORDER BY / LIMIT ----------------------------------------------------------

/** order_clause: ORDER_ BY_ ordering_term (',' ordering_term)*  /  ordering_term: expr … */
function lowerOrderBy(orderClause: ParserRuleContext): Expr[] | undefined {
	const items = orderingTermExprs(orderClause).map(lowerExpr);
	return items.length ? items : undefined;
}

function orderingTermExprs(orderClause: ParserRuleContext): ParserRuleContext[] {
	return directChildrenOfRule(orderClause, P.RULE_ordering_term)
		.map((ot) => directChildrenOfRule(ot, P.RULE_expr)[0])
		.filter((e): e is ParserRuleContext => e !== undefined);
}

/** limit_clause: LIMIT_ expr ((OFFSET_ | COMMA) expr)?. The comma form is SQLite's `LIMIT offset,
 *  count`; the OFFSET form is `LIMIT count OFFSET offset`. */
function lowerLimit(limitClause: ParserRuleContext): LimitInfo | undefined {
	const exprs = directChildrenOfRule(limitClause, P.RULE_expr);
	if (exprs.length === 0) return undefined;
	const info: LimitInfo = {};
	if (hasDirectToken(limitClause, P.COMMA)) {
		info.offset = lowerExpr(exprs[0]);
		if (exprs[1]) info.top = lowerExpr(exprs[1]);
	} else {
		info.top = lowerExpr(exprs[0]);
		if (exprs[1]) info.offset = lowerExpr(exprs[1]);
	}
	return info;
}

// --- the expr precedence cascade ----------------------------------------------
// expr → expr_or → expr_and → expr_not → expr_binary → expr_comparison → expr_bitwise
//      → expr_addition → expr_multiplication → expr_string → expr_collate → expr_unary
//      → expr_base → expr_recursive

function lowerExpr(node: ParserRuleContext): Expr {
	switch (node.ruleIndex) {
		case P.RULE_expr: {
			const c = directChildrenOfRule(node, P.RULE_expr_or)[0];
			return c ? lowerExpr(c) : otherExpr(node);
		}
		case P.RULE_expr_or:
			return foldLeft(node, P.RULE_expr_and, (t) => (t === P.OR_ ? "or" : undefined));
		case P.RULE_expr_and:
			return foldLeft(node, P.RULE_expr_not, (t) => (t === P.AND_ ? "and" : undefined));
		case P.RULE_expr_not:
			return lowerNot(node);
		case P.RULE_expr_binary:
			return lowerBinary(node);
		case P.RULE_expr_comparison:
			return foldLeft(node, P.RULE_expr_bitwise, comparisonOp);
		case P.RULE_expr_bitwise:
			return foldLeft(node, P.RULE_expr_addition, bitwiseOp);
		case P.RULE_expr_addition:
			return foldLeft(node, P.RULE_expr_multiplication, (t) =>
				t === P.PLUS ? "+" : t === P.MINUS ? "-" : undefined,
			);
		case P.RULE_expr_multiplication:
			return foldLeft(node, P.RULE_expr_string, (t) =>
				t === P.STAR ? "*" : t === P.DIV ? "/" : t === P.MOD ? "%" : undefined,
			);
		case P.RULE_expr_string:
			return foldLeft(node, P.RULE_expr_collate, (t) =>
				t === P.PIPE2 ? "||" : t === P.JPTR ? "->" : t === P.JPTR2 ? "->>" : undefined,
			);
		case P.RULE_expr_collate:
			return lowerCollate(node);
		case P.RULE_expr_unary:
			return lowerUnary(node);
		case P.RULE_expr_base:
			return lowerExprBase(node);
		case P.RULE_expr_recursive:
			return lowerExprRecursive(node);
		default:
			return otherExpr(node);
	}
}

function comparisonOp(t: number): string | undefined {
	return t === P.LT ? "<" : t === P.LT_EQ ? "<=" : t === P.GT ? ">" : t === P.GT_EQ ? ">=" : undefined;
}

function bitwiseOp(t: number): string | undefined {
	return t === P.LT2 ? "<<" : t === P.GT2 ? ">>" : t === P.AMP ? "&" : t === P.PIPE ? "|" : undefined;
}

/** A left-associative `child (OP child)*` cascade level: fold the operand rule-nodes into a chain of
 *  binary exprs, taking the operator string from the interleaved tokens. A single operand passes
 *  through untouched. */
function foldLeft(node: ParserRuleContext, childRule: number, opFor: (t: number) => string | undefined): Expr {
	let left: Expr | undefined;
	let op: string | undefined;
	for (const c of kidsOf(node)) {
		if (c instanceof TerminalNode) {
			const o = opFor(c.symbol.type);
			if (o !== undefined) op = o;
			continue;
		}
		if (c instanceof ParserRuleContext && c.ruleIndex === childRule) {
			const e = lowerExpr(c);
			left = left === undefined ? e : { kind: "binary", op: op ?? "", left, right: e, cst: node };
		}
	}
	return left ?? otherExpr(node);
}

/** expr_not: NOT_* expr_binary — wrap in a `not` unary once per leading NOT. */
function lowerNot(node: ParserRuleContext): Expr {
	const inner = directChildrenOfRule(node, P.RULE_expr_binary)[0];
	let e = inner ? lowerExpr(inner) : otherExpr(node);
	for (const c of kidsOf(node)) {
		if (c instanceof TerminalNode && c.symbol.type === P.NOT_)
			e = { kind: "unary", op: "not", operand: e, cst: node };
	}
	return e;
}

/** expr_collate: expr_unary (COLLATE_ collation_name)* — COLLATE is a passthrough (no column refs). */
function lowerCollate(node: ParserRuleContext): Expr {
	const inner = directChildrenOfRule(node, P.RULE_expr_unary)[0];
	return inner ? lowerExpr(inner) : otherExpr(node);
}

/** expr_unary: (MINUS | PLUS | TILDE)* expr_base — wrap each leading sign, innermost binds tightest. */
function lowerUnary(node: ParserRuleContext): Expr {
	const base = directChildrenOfRule(node, P.RULE_expr_base)[0];
	let e = base ? lowerExpr(base) : otherExpr(node);
	const signs: number[] = [];
	for (const c of kidsOf(node)) {
		if (
			c instanceof TerminalNode &&
			(c.symbol.type === P.MINUS || c.symbol.type === P.PLUS || c.symbol.type === P.TILDE)
		) {
			signs.push(c.symbol.type);
		}
	}
	for (let i = signs.length - 1; i >= 0; i--) {
		const op = signs[i] === P.MINUS ? "-" : signs[i] === P.PLUS ? "+" : "~";
		e = { kind: "unary", op, operand: e, cst: node };
	}
	return e;
}

/** expr_base:
 *    literal_value | BIND_PARAMETER | (schema_name '.')? table_name '.' column_name
 *  | column_name_excluding_string | (NOT_? EXISTS_)? '(' select_stmt ')' | raise_function
 *  | expr_recursive */
function lowerExprBase(node: ParserRuleContext): Expr {
	const lit = directChildrenOfRule(node, P.RULE_literal_value)[0];
	if (lit) return { kind: "literal", text: lit.getText(), cst: node };
	if (hasDirectToken(node, P.BIND_PARAMETER)) return lowerBindParameter(node);

	// (schema_name '.')? table_name '.' column_name — a qualified column reference.
	const colName = directChildrenOfRule(node, P.RULE_column_name)[0];
	if (colName) {
		const schemaName = directChildrenOfRule(node, P.RULE_schema_name)[0];
		const tableName = directChildrenOfRule(node, P.RULE_table_name)[0];
		const partNodes = [schemaName, tableName, colName].filter((n): n is ParserRuleContext => n !== undefined);
		return {
			kind: "column",
			parts: partNodes.map((n) => n.getText()),
			partSpans: partSpansOf(partNodes),
			cst: node,
		};
	}
	// column_name_excluding_string — a bare (unqualified) column reference.
	const bareCol = directChildrenOfRule(node, P.RULE_column_name_excluding_string)[0];
	if (bareCol) {
		return { kind: "column", parts: [bareCol.getText()], partSpans: partSpansOf([bareCol]), cst: node };
	}

	// (NOT_? EXISTS_)? '(' select_stmt ')' — a scalar subquery or an [NOT] EXISTS test.
	const sel = directChildrenOfRule(node, P.RULE_select_stmt)[0];
	if (sel) {
		if (hasDirectToken(node, P.EXISTS_)) {
			const exists: Expr = { kind: "exists", query: lowerSelectStmt(sel), cst: node };
			return hasDirectToken(node, P.NOT_) ? { kind: "unary", op: "not", operand: exists, cst: node } : exists;
		}
		return { kind: "subquery", query: lowerSelectStmt(sel), cst: node };
	}

	const rec = directChildrenOfRule(node, P.RULE_expr_recursive)[0];
	if (rec) return lowerExprRecursive(rec);
	return otherExpr(node); // raise_function, or an unmodelled shape — columns recovered from the CST
}

/** BIND_PARAMETER: '?' DIGIT* | [:@$] IDENTIFIER (grammars/sqlite/SQLiteLexer.g4). All five spellings
 *  are caller-bound (bindable via the C API — sqlite.org/lang_expr.html#varparam), never a `variable`:
 *  bare `?` -> parameter (no name/ordinal); `?NNN` -> ordinal NNN; `:name`/`@name`/`$name` -> name with
 *  exactly one leading sigil stripped (lossless: the raw IDENTIFIER text, quoting included, survives
 *  verbatim in `name`, matching this dialect's keep-delimiters convention elsewhere).
 *  The doc's Tcl-only `$AAAA` extension (a `::`-separated path, an optional `(...)` suffix) is NOT
 *  reachable here: our BIND_PARAMETER token is `[:@$] IDENTIFIER` with no such suffix, so anything
 *  past the identifier lexes as separate tokens and the statement fails to parse — verified by probe
 *  (`$name::sub` / `$name(1)` both error "mismatched input ... expecting <EOF>"). Since a grammar
 *  change is out of scope for this task, only the plain identifier form is ever seen here. */
function lowerBindParameter(node: ParserRuleContext): Expr {
	const text = node.getText();
	if (text === "?") return { kind: "parameter", text, cst: node };
	if (text[0] === "?") return { kind: "parameter", text, ordinal: Number(text.slice(1)), cst: node };
	return { kind: "parameter", text, name: text.slice(1), cst: node };
}

/** expr_recursive:
 *    function_name '(' (DISTINCT_? expr (',' expr)* order_clause? | STAR)? ')' percentile? filter? over?
 *  | '(' expr (',' expr)* ')' | CAST_ '(' expr AS_ type_name ')' | CASE_ …  */
function lowerExprRecursive(node: ParserRuleContext): Expr {
	const fn = directChildrenOfRule(node, P.RULE_function_name)[0];
	if (fn) return lowerFunction(node, fn);
	if (hasDirectToken(node, P.CAST_)) {
		const inner = directChildrenOfRule(node, P.RULE_expr)[0];
		const tn = directChildrenOfRule(node, P.RULE_type_name)[0];
		return {
			kind: "cast",
			expr: inner ? lowerExpr(inner) : otherExpr(node),
			typeText: tn ? tn.getText() : "",
			cst: node,
		};
	}
	if (hasDirectToken(node, P.CASE_)) return lowerCase(node);
	// '(' expr (',' expr)* ')' — a parenthesized single expr is grouping (passthrough); a comma tuple
	// has no IR node, so it stays `other` (columnsOf recovers its column refs from the CST).
	const exprs = directChildrenOfRule(node, P.RULE_expr);
	if (exprs.length === 1) return lowerExpr(exprs[0]);
	return otherExpr(node);
}

function lowerFunction(node: ParserRuleContext, fnNode: ParserRuleContext): Expr {
	const name = fnNode.getText().toLowerCase();
	const argExprs = directChildrenOfRule(node, P.RULE_expr).map(lowerExpr);
	// aggregate ORDER BY (group_concat(x ORDER BY y)), WITHIN GROUP (percentile) and FILTER (WHERE …)
	// all feed the call — conserve their column refs as arguments.
	const orderClause = directChildrenOfRule(node, P.RULE_order_clause)[0];
	const orderArgs = orderClause ? orderingTermExprs(orderClause).map(lowerExpr) : [];
	const pc = directChildrenOfRule(node, P.RULE_percentile_clause)[0];
	const pcArgs = pc ? directChildrenOfRule(pc, P.RULE_expr).map(lowerExpr) : [];
	const fc = directChildrenOfRule(node, P.RULE_filter_clause)[0];
	const fcArgs = fc ? directChildrenOfRule(fc, P.RULE_expr).map(lowerExpr) : [];
	const over = directChildrenOfRule(node, P.RULE_over_clause)[0];
	return {
		kind: "function",
		name,
		args: [...argExprs, ...orderArgs, ...pcArgs, ...fcArgs],
		aggregate: AGGREGATES.has(name),
		distinct: hasDirectToken(node, P.DISTINCT_),
		window: over ? lowerOver(over) : undefined,
		cst: node,
	};
}

/** over_clause: OVER_ (window_name | '(' base_window_name? (PARTITION_ BY_ expr (',' expr)*)?
 *  order_clause? frame_spec? ')'). PARTITION BY exprs are direct expr children; ORDER BY exprs are
 *  nested in the order_clause. */
function lowerOver(over: ParserRuleContext): { partitionBy: Expr[]; orderBy: Expr[]; cst: ParserRuleContext } {
	const partitionBy = directChildrenOfRule(over, P.RULE_expr).map(lowerExpr);
	const orderClause = directChildrenOfRule(over, P.RULE_order_clause)[0];
	const orderBy = orderClause ? orderingTermExprs(orderClause).map(lowerExpr) : [];
	return { partitionBy, orderBy, cst: over };
}

/** CASE_ expr? (WHEN_ expr THEN_ expr)+ (ELSE_ expr)? END_. A simple CASE with a subject desugars to
 *  `subject = whenValue` so the subject's columns/types are seen (mirrors the other dialects). */
function lowerCase(node: ParserRuleContext): Expr {
	let subject: Expr | undefined;
	let elseExpr: Expr | undefined;
	let pendingWhen: Expr | undefined;
	let mode: "subject" | "when" | "then" | "else" = "subject";
	const whens: { when: Expr; then: Expr }[] = [];
	for (const c of kidsOf(node)) {
		if (c instanceof TerminalNode) {
			const t = c.symbol.type;
			if (t === P.WHEN_) mode = "when";
			else if (t === P.THEN_) mode = "then";
			else if (t === P.ELSE_) mode = "else";
			continue;
		}
		if (!(c instanceof ParserRuleContext && c.ruleIndex === P.RULE_expr)) continue;
		const e = lowerExpr(c);
		if (mode === "subject") subject = e;
		else if (mode === "when") pendingWhen = e;
		else if (mode === "then") {
			whens.push({ when: pendingWhen ?? otherExpr(node), then: e });
			pendingWhen = undefined;
		} else elseExpr = e;
	}
	if (subject) {
		const desugared = whens.map((w) => ({
			when: { kind: "binary" as const, op: "=", left: subject as Expr, right: w.when, cst: node },
			then: w.then,
		}));
		return { kind: "case", whens: desugared, elseExpr, cst: node };
	}
	return { kind: "case", whens, elseExpr, cst: node };
}

// --- expr_binary (the postfix predicate loop) ----------------------------------
// expr_binary: expr_comparison (
//     (ASSIGN|EQ|NOT_EQ1|NOT_EQ2) expr_comparison
//   | IS_ NOT_? (DISTINCT_ FROM_)? expr_comparison
//   | NOT_? BETWEEN_ expr_comparison AND_ expr_comparison
//   | NOT_? IN_ ( '(' (select_stmt | expr_comparison (',' expr_comparison)*)? ')'
//               | (schema_name '.')? table_name
//               | (schema_name '.')? table_function_name '(' (expr_comparison …)? ')' )
//   | NOT_? ( LIKE_ expr_comparison (ESCAPE_ expr_comparison)? | (GLOB_|REGEXP_|MATCH_) expr_comparison )
//   | ISNULL_ | NOTNULL_ | NOT_ NULL_
// )*

function lowerBinary(node: ParserRuleContext): Expr {
	const kids = kidsOf(node);
	const firstR = nextRule(kids, 0, P.RULE_expr_comparison);
	let left = firstR ? lowerExpr(firstR.node) : otherExpr(node);
	let i = firstR ? firstR.index + 1 : kids.length;

	const operand = (from: number): { expr: Expr; index: number } => {
		const r = nextRule(kids, from, P.RULE_expr_comparison);
		return r ? { expr: lowerExpr(r.node), index: r.index + 1 } : { expr: otherExpr(node), index: from };
	};

	while (i < kids.length) {
		const c = kids[i];
		if (!(c instanceof TerminalNode)) {
			i++;
			continue;
		}
		const t = c.symbol.type;

		if (t === P.ASSIGN || t === P.EQ || t === P.NOT_EQ1 || t === P.NOT_EQ2) {
			const { expr, index } = operand(i + 1);
			left = { kind: "binary", op: c.getText(), left, right: expr, cst: node };
			i = index;
			continue;
		}

		if (t === P.IS_) {
			i++;
			let negated = false;
			if (isToken(kids[i], P.NOT_)) {
				negated = true;
				i++;
			}
			const distinct = isToken(kids[i], P.DISTINCT_);
			if (distinct) {
				i++;
				if (isToken(kids[i], P.FROM_)) i++;
			}
			const { expr, index } = operand(i);
			i = index;
			left = distinct
				? { kind: "predicate", op: "distinct from", negated, operand: left, args: [expr], cst: node }
				: { kind: "binary", op: negated ? "is not" : "is", left, right: expr, cst: node };
			continue;
		}

		let negated = false;
		if (t === P.NOT_) {
			// NOT NULL is a nullness predicate; otherwise NOT prefixes BETWEEN / IN / LIKE-family.
			if (isToken(kids[i + 1], P.NULL_)) {
				left = { kind: "predicate", op: "null", negated: true, operand: left, args: [], cst: node };
				i += 2;
				continue;
			}
			negated = true;
			i++;
		}
		const ot = kids[i] instanceof TerminalNode ? (kids[i] as TerminalNode).symbol.type : undefined;

		if (ot === P.BETWEEN_) {
			const lo = operand(i + 1);
			const hi = operand(lo.index);
			left = { kind: "predicate", op: "between", negated, operand: left, args: [lo.expr, hi.expr], cst: node };
			i = hi.index;
			continue;
		}
		if (ot === P.IN_) {
			const { args, nextIndex } = consumeInPayload(kids, i + 1);
			left = { kind: "predicate", op: "in", negated, operand: left, args, cst: node };
			i = nextIndex;
			continue;
		}
		if (ot === P.LIKE_ || ot === P.GLOB_ || ot === P.REGEXP_ || ot === P.MATCH_) {
			const op = ot === P.LIKE_ ? "like" : ot === P.GLOB_ ? "glob" : ot === P.REGEXP_ ? "rlike" : "match";
			const pat = operand(i + 1);
			const args = [pat.expr];
			i = pat.index;
			if (isToken(kids[i], P.ESCAPE_)) {
				const esc = operand(i + 1);
				args.push(esc.expr);
				i = esc.index;
			}
			left = { kind: "predicate", op, negated, operand: left, args, cst: node };
			continue;
		}
		if (ot === P.ISNULL_) {
			left = { kind: "predicate", op: "null", negated: false, operand: left, args: [], cst: node };
			i++;
			continue;
		}
		if (ot === P.NOTNULL_) {
			left = { kind: "predicate", op: "null", negated: true, operand: left, args: [], cst: node };
			i++;
			continue;
		}
		i++; // an unrecognized token — skip, never throw
	}
	return left;
}

/** Consume an IN payload starting at `from` (just after the IN_ token): a parenthesized
 *  select_stmt / expr_comparison list, a bare (schema.)?table_name, or a table_function_name(args).
 *  Returns the collected args and the index past the payload. */
function consumeInPayload(kids: ParseTree[], from: number): { args: Expr[]; nextIndex: number } {
	const args: Expr[] = [];
	const push = (c: ParserRuleContext): void => {
		if (c.ruleIndex === P.RULE_select_stmt) args.push({ kind: "subquery", query: lowerSelectStmt(c), cst: c });
		else if (c.ruleIndex === P.RULE_expr_comparison) args.push(lowerExpr(c));
	};
	let i = from;
	if (isToken(kids[i], P.OPEN_PAR)) {
		let depth = 0;
		for (; i < kids.length; i++) {
			const c = kids[i];
			if (c instanceof TerminalNode) {
				if (c.symbol.type === P.OPEN_PAR) depth++;
				else if (c.symbol.type === P.CLOSE_PAR && --depth === 0) {
					i++;
					break;
				}
			} else if (c instanceof ParserRuleContext) push(c);
		}
		return { args, nextIndex: i };
	}
	// Non-paren forms: consume the name rule-nodes (and a following table-function paren group).
	while (i < kids.length) {
		const c = kids[i];
		if (isRule(c, P.RULE_schema_name) || isRule(c, P.RULE_table_name) || isRule(c, P.RULE_table_function_name)) {
			i++;
			continue;
		}
		if (isToken(c, P.DOT)) {
			i++;
			continue;
		}
		if (isToken(c, P.OPEN_PAR)) {
			let depth = 0;
			for (; i < kids.length; i++) {
				const k = kids[i];
				if (k instanceof TerminalNode) {
					if (k.symbol.type === P.OPEN_PAR) depth++;
					else if (k.symbol.type === P.CLOSE_PAR && --depth === 0) {
						i++;
						break;
					}
				} else if (k instanceof ParserRuleContext) push(k);
			}
		}
		break;
	}
	return { args, nextIndex: i };
}

// --- column extraction (single source of truth for SelectExpr.columns) ---------

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
 *  lowering any expr_base column, but never into a nested select_stmt (its own scope). */
function cstColumnRefs(node: ParseTree, acc: ColumnRef[], clause: Clause): void {
	for (const child of kidsOf(node)) {
		if (!(child instanceof ParserRuleContext)) continue;
		if (child.ruleIndex === P.RULE_select_stmt) continue;
		if (child.ruleIndex === P.RULE_expr_base) {
			const e = lowerExprBase(child);
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

// --- CST navigation helpers ----------------------------------------------------

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

/** Collect rule nodes within `node` but not inside a nested select_stmt (its own scope); matched
 *  nodes are not themselves descended into. */
function shallowCollectOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext[] {
	const out: ParserRuleContext[] = [];
	const walk = (n: ParseTree): void => {
		for (const child of kidsOf(n)) {
			if (!(child instanceof ParserRuleContext)) continue;
			if (child.ruleIndex === ruleIndex) out.push(child);
			else if (child.ruleIndex === P.RULE_select_stmt) continue;
			else walk(child);
		}
	};
	walk(node);
	return out;
}

/** The first `kids[j >= from]` that is a rule node of `ruleIndex`, with its index. */
function nextRule(
	kids: ParseTree[],
	from: number,
	ruleIndex: number,
): { node: ParserRuleContext; index: number } | undefined {
	for (let j = from; j < kids.length; j++) {
		const c = kids[j];
		if (c instanceof ParserRuleContext && c.ruleIndex === ruleIndex) return { node: c, index: j };
	}
	return undefined;
}

function isRule(node: ParseTree | undefined, ruleIndex: number): boolean {
	return node instanceof ParserRuleContext && node.ruleIndex === ruleIndex;
}

function isToken(node: ParseTree | undefined, type: number): boolean {
	return node instanceof TerminalNode && node.symbol.type === type;
}

function hasDirectToken(node: ParseTree, type: number): boolean {
	for (const child of kidsOf(node)) {
		if (child instanceof TerminalNode && child.symbol.type === type) return true;
	}
	return false;
}

/** True when `node` is a descendant of `ancestor` (used to match a flattened parenthesized-join
 *  source back to its enclosing table_or_subquery). */
function isWithin(node: ParseTree | null | undefined, ancestor: ParseTree): boolean {
	let n = node instanceof ParserRuleContext ? node.parent : undefined;
	while (n) {
		if (n === ancestor) return true;
		n = n.parent;
	}
	return false;
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
