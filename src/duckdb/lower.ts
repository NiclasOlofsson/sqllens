import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import { DuckdbParser as P } from "../generated/duckdb/DuckdbParser.js";
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
	WindowSpec,
} from "../ir/ir.js";
import { keywordCategory, swallowedCategories, swallowedStatements, type StatementCategory } from "../ir/statement.js";
import { partSpansOf } from "../ir/part-span.js";
import { freezeIR } from "../ir/freeze.js";
import { qualifiedNameOf, type QualifiedName } from "../ir/qualified-name.js";
import { displayName, DUCKDB_NAME_CONFIG } from "./fold.js";

/** The structured name for a table source's raw parts (issue #38) — role assignment + identity
 *  key + fqn happen HERE, at lowering, where the dialect's namespace shape is known. */
function relationOf(rawParts: string[]): QualifiedName {
	return qualifiedNameOf(rawParts, DUCKDB_NAME_CONFIG);
}

// ---------------------------------------------------------------------------
// Lowering — DuckDB (fork of this repo's grammars/postgres pair, TVL lineage)
// CST -> the shared dialect-neutral IR (src/ir/ir.ts). The semantic layer runs
// on the IR unchanged; only this file knows the DuckDB grammar.
//
// Twin of src/postgres/lower.ts (same CST shapes); DuckDB deltas handled here:
// FROM-first queries (a star projection is synthesized when SELECT is absent),
// QUALIFY, GROUP BY ALL, star EXCLUDE/REPLACE/RENAME + COLUMNS(), prefix
// aliases (x: 42, alias: tbl), list/struct/map literals + comprehensions,
// `lambda x:` lambdas, method chaining (x.f(y) → f(x, y)), string-literal
// relations (FROM 'file.parquet'), and the PIVOT/UNPIVOT statements (modelled
// onto the shared PivotInfo/UnpivotInfo; the statement PIVOT is `dynamic`).
// ---------------------------------------------------------------------------

// https://duckdb.org/docs/current/sql/functions/aggregates.html — general + approximate +
// statistical + ordered-set aggregate names (holistic/nested families included).
const AGGREGATES = new Set([
	"any_value",
	"approx_count_distinct",
	"approx_quantile",
	"approx_top_k",
	"arbitrary",
	"arg_max",
	"arg_max_null",
	"arg_min",
	"arg_min_null",
	"argmax",
	"argmin",
	"array_agg",
	"avg",
	"bit_and",
	"bit_or",
	"bit_xor",
	"bitstring_agg",
	"bool_and",
	"bool_or",
	"corr",
	"count",
	"count_if",
	"count_star",
	"countif",
	"covar_pop",
	"covar_samp",
	"entropy",
	"favg",
	"first",
	"fsum",
	"geomean",
	"geometric_mean",
	"histogram",
	"histogram_exact",
	"kahan_sum",
	"kurtosis",
	"kurtosis_pop",
	"last",
	"list",
	"listagg",
	"mad",
	"max",
	"max_by",
	"mean",
	"median",
	"min",
	"min_by",
	"mode",
	"product",
	"quantile",
	"quantile_cont",
	"quantile_disc",
	"regr_avgx",
	"regr_avgy",
	"regr_count",
	"regr_intercept",
	"regr_r2",
	"regr_slope",
	"regr_sxx",
	"regr_sxy",
	"regr_syy",
	"reservoir_quantile",
	"skewness",
	"stddev",
	"stddev_pop",
	"stddev_samp",
	"string_agg",
	"sum",
	"sumkahan",
	"var_pop",
	"var_samp",
	"variance",
	"weighted_avg",
	"wavg",
]);

/** Lower a parsed DuckDB file (root: stmtblock of `;`-separated statements) into the IR.
 *  A single SELECT (or FROM-first) statement lowers fully; anything else becomes a flagged
 *  non-query body — a valid parse never throws. Frozen — immutable after lower(). */
export function lower(tree: ParserRuleContext): QueryExpr {
	const q = lowerImpl(tree);
	q.dialect = "duckdb";
	return freezeIR(q);
}

function lowerImpl(tree: ParserRuleContext): QueryExpr {
	const stmts = topLevelStmts(tree);
	// Recovery-swallowed statements count toward batch-ness: a broken statement makes recovery dump
	// the rest of the batch as flat error nodes, so the stmt count alone under-reports.
	const swallowed = swallowedStatements(tree);
	const total = stmts.length + swallowed;
	const statement = statementCategory(stmts, swallowed);
	if (total !== 1 || stmts.length !== 1) {
		// A multi-statement batch is a flagged compound. Anchor its span to the FIRST top-level
		// statement, NOT the whole `root` container (which reaches EOF): a whole-file span on a
		// flagged body makes a downstream AST index read a bogus enclosure over statements 2..n.
		// Bounding to statement 1 keeps the span honest — the "compound" kind + "multi-statement"
		// flag already tell a consumer this is an unmodelled batch (issue #21). Empty stays `tree`.
		const cst = total > 1 && stmts.length > 0 ? stmts[0] : tree;
		const q = nonQuery(cst, total > 1 ? "multi-statement" : total === 1 ? "broken" : "empty");
		q.statement = statement;
		return q;
	}
	const selectStmt = directChildrenOfRule(stmts[0], P.RULE_selectstmt)[0];
	if (!selectStmt) {
		// PIVOT/UNPIVOT statements are row-returning table transforms: keep the source relation
		// visible and flag the reshape (a visible gap, not a silent drop).
		const pivot =
			directChildrenOfRule(stmts[0], P.RULE_pivotstmt)[0] ??
			directChildrenOfRule(stmts[0], P.RULE_unpivotstmt)[0];
		if (pivot) {
			const q = lowerPivotStmt(pivot);
			q.statement = statement;
			return q;
		}
		const q = nonQuery(stmts[0], "non-query");
		q.statement = statement;
		return q;
	}
	const q = lowerSelectStmt(selectStmt);
	q.statement = statement;
	return q;
}

function statementCategory(stmts: ParserRuleContext[], swallowed = 0): StatementCategory {
	if (stmts.length + swallowed > 1) return "compound";
	if (stmts.length === 0) return "other";
	return duckdbCategory(stmts[0]);
}

/** Per-statement categories for every top-level `stmt` in a parsed `root`, in source order. */
export function statementCategories(tree: ParserRuleContext): StatementCategory[] {
	// Recovery-swallowed statements append as "other" — honest count, no keyword guessing.
	return [...topLevelStmts(tree).map(duckdbCategory), ...swallowedCategories(tree)];
}

/** The top-level `stmt` nodes of a parsed file — root → stmtblock → stmtmulti's DIRECT `stmt`
 *  children (a deep collect would also pick up a `stmt` nested inside `CREATE FUNCTION … BEGIN
 *  ATOMIC <stmt>; END`, double-counting a single statement — same fix as redshift's).
 */
function topLevelStmts(tree: ParserRuleContext): ParserRuleContext[] {
	const stmtblock = directChildrenOfRule(tree, P.RULE_stmtblock)[0] ?? tree;
	const stmtmulti = directChildrenOfRule(stmtblock, P.RULE_stmtmulti)[0] ?? stmtblock;
	// A token-less stmt (an empty statement slot between `;;`) is no statement at all. NOTE: no
	// separator-based merging here — this grammar parses `select 1 select 2` CLEAN as two sibling
	// stmts (lenient separators), so merging separator-less siblings would silently drop validly
	// parsed statements. The cost: recovery can split ONE broken statement into several sibling
	// fragments, which then over-report as a compound (an over-report on broken input, never an
	// under-report — pinned in tests/broken-batch.test.ts).
	return directChildrenOfRule(stmtmulti, P.RULE_stmt).filter(
		(s) => s.start && s.stop && s.start.tokenIndex <= s.stop.tokenIndex,
	);
}

// Structural statement classification over the `stmt` alternatives (grammars/duckdb/
// DuckdbParser.g4, rule `stmt`). Same contract as the other dialects; the DuckDB-only
// statements cited against duckdb.org/docs/current/sql/statements/.
const DUCKDB_STMT_CATEGORY: Record<string, StatementCategory> = {
	selectstmt: "query",
	// PIVOT/UNPIVOT are row-returning table transforms — reads, not writes (pivot.md, unpivot.md).
	pivotstmt: "query",
	unpivotstmt: "query",
	insertstmt: "dml",
	updatestmt: "dml",
	deletestmt: "dml",
	mergestmt: "dml",
	copystmt: "dml",
	grantstmt: "dcl",
	grantrolestmt: "dcl",
	revokestmt: "dcl",
	revokerolestmt: "dcl",
	reassignownedstmt: "dcl",
	dropownedstmt: "dcl",
	transactionstmt: "tcl",
	variablesetstmt: "utility",
	variableresetstmt: "utility",
	variableshowstmt: "utility",
	constraintssetstmt: "utility",
	explainstmt: "utility",
	analyzestmt: "utility",
	vacuumstmt: "utility",
	refreshmatviewstmt: "utility",
	discardstmt: "utility",
	clusterstmt: "utility",
	reindexstmt: "utility",
	checkpointstmt: "utility",
	lockstmt: "utility",
	dostmt: "utility",
	callstmt: "utility",
	executestmt: "utility",
	preparestmt: "utility",
	deallocatestmt: "utility",
	declarecursorstmt: "utility",
	fetchstmt: "utility",
	closeportalstmt: "utility",
	listenstmt: "utility",
	unlistenstmt: "utility",
	notifystmt: "utility",
	loadstmt: "utility",
	plsqlconsolecommand: "utility",
	// DuckDB session/admin statements — attach.md, use.md, installing_extensions.md, pragmas.md,
	// export.md, summarize.md, describe.md, overview.md#updating-extensions.
	summarizestmt: "utility",
	describestmt: "utility",
	attachstmt: "utility",
	detachstmt: "utility",
	usestmt: "utility",
	installstmt: "utility",
	pragmastmt: "utility",
	exportstmt: "utility",
	importdatabasestmt: "utility",
	updateextensionsstmt: "utility",
	// Object definition — create_macro.md, secrets manager, plus the Postgres non-prefix DDL rules.
	createmacrostmt: "ddl",
	createsecretstmt: "ddl",
	dropsecretstmt: "ddl",
	indexstmt: "ddl",
	viewstmt: "ddl",
	rulestmt: "ddl",
	definestmt: "ddl",
	renamestmt: "ddl",
	commentstmt: "ddl",
	seclabelstmt: "ddl",
	importforeignschemastmt: "ddl",
	truncatestmt: "ddl",
};

function duckdbCategory(stmt: ParserRuleContext): StatementCategory {
	const child = firstRuleChild(stmt);
	if (!child) return keywordCategory(stmt.start?.text ?? "");
	const rule = P.ruleNames[child.ruleIndex];
	const mapped = DUCKDB_STMT_CATEGORY[rule];
	if (mapped) return mapped;
	if (rule.startsWith("create") || rule.startsWith("alter") || rule.startsWith("drop") || rule.startsWith("remove"))
		return "ddl";
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

/** PIVOT/UNPIVOT statement — modelled onto the shared PivotInfo/UnpivotInfo IR, the same shapes the
 *  sibling dialects produce (duckdb.org/docs/current/sql/statements/pivot.md, unpivot.md).
 *
 *  PIVOT `⟨rel⟩ ON ⟨cols⟩ USING ⟨aggs⟩ [GROUP BY ⟨rows⟩]`: the distinct ON-values become output columns,
 *  so the output is data-dependent — modelled as a `dynamic` PivotInfo (structure captured; output
 *  resolves to unknown, never a wrong set). UNPIVOT `⟨rel⟩ ON ⟨cols⟩ [INTO NAME ⟨n⟩ VALUE ⟨v⟩]` is a
 *  static reshape (passthrough minus the ON columns, plus the name/value columns), modelled exactly. */
function lowerPivotStmt(stmt: ParserRuleContext): QueryExpr {
	const isPivot = stmt.ruleIndex === P.RULE_pivotstmt;
	const from: Source[] = [];
	const qn = directChildrenOfRule(stmt, P.RULE_qualified_name)[0];
	if (qn) {
		const pivotParts = nameParts(qn);
		from.push({
			kind: "table",
			relation: relationOf(pivotParts),
			namePartSpans: columnPartSpans(qn),
			cst: qn,
		});
	}
	const sw = directChildrenOfRule(stmt, P.RULE_select_with_parens)[0];
	if (sw) {
		const inner = innerSelect(sw);
		from.push({ kind: "subquery", query: inner ? lowerSelectStmt(inner) : emptyQuery(sw), cst: sw });
	}

	const columns: ColumnRef[] = [];
	// Column names referenced by a clause's a_expr children, recorded into `columns` for lineage.
	const colNames = (clauseRule: number, clause: Clause): string[] => {
		const names: string[] = [];
		for (const node of collectOfRule(stmt, clauseRule))
			for (const a of directChildrenOfRule(node, P.RULE_a_expr)) {
				const refs: ColumnRef[] = [];
				columnsOf(lowerExpr(a), refs, clause);
				for (const r of refs) {
					columns.push(r);
					names.push(r.parts[r.parts.length - 1]);
				}
			}
		return names;
	};

	let pivot: PivotInfo | undefined;
	let unpivot: UnpivotInfo | undefined;
	if (isPivot) {
		const forColumns = colNames(P.RULE_pivot_on, "projection"); // ON columns → the pivot key
		const aggColumns = colNames(P.RULE_target_el, "projection"); // USING aggregate arguments
		colNames(P.RULE_group_by_list, "groupBy"); // GROUP BY dims → referenced, kept visible for lineage
		pivot = { values: [], forColumns, aggColumns, dynamic: true };
	} else {
		const removed = colNames(P.RULE_unpivot_on, "projection"); // ON columns consumed into rows
		// INTO NAME ⟨colid⟩ VALUE ⟨name_list⟩; default DuckDB column names are "name"/"value".
		const nameColumn = directChildrenOfRule(stmt, P.RULE_colid)[0];
		const valueList = directChildrenOfRule(stmt, P.RULE_name_list)[0];
		const valueName = valueList ? collectOfRule(valueList, P.RULE_name)[0] : undefined;
		unpivot = {
			valueColumn: valueName ? textOf(valueName) : "value",
			nameColumn: nameColumn ? textOf(nameColumn) : "name",
			removed,
		};
	}

	const body: SelectExpr = {
		kind: "select",
		projections: [{ isStar: true, expr: { kind: "star", cst: stmt }, cst: stmt }],
		from,
		columns,
		aggregated: false,
		pivot,
		unpivot,
		cst: stmt,
	};
	return { kind: "query", ctes: [], body, cst: stmt };
}

// --- query statement: WITH / set ops / ORDER BY / LIMIT -----------------------

/** selectstmt: select_no_parens | select_with_parens. Also accepts a bare select_no_parens node
 *  directly — innerSelect() returns the UNWRAPPED select_no_parens, and feeding that back in here
 *  used to fall through both child probes and yield an empty flagged body, silently emptying EVERY
 *  parenthesized subquery (FROM/IN/EXISTS/scalar). Found by the Task-2 quoted-identifier pipeline
 *  test; the fix routes it straight to lowerSelectNoParens. */
function lowerSelectStmt(stmt: ParserRuleContext): QueryExpr {
	if (stmt.ruleIndex === P.RULE_select_no_parens) return lowerSelectNoParens(stmt);
	const noParens = directChildrenOfRule(stmt, P.RULE_select_no_parens)[0];
	if (noParens) return lowerSelectNoParens(noParens);
	const withParens = directChildrenOfRule(stmt, P.RULE_select_with_parens)[0];
	if (withParens) {
		const inner = innerSelect(withParens);
		return inner ? lowerSelectStmt(inner) : emptyQuery(stmt);
	}
	return emptyQuery(stmt);
}

function innerSelect(withParens: ParserRuleContext): ParserRuleContext | undefined {
	const noParens = directChildrenOfRule(withParens, P.RULE_select_no_parens)[0];
	if (noParens) return noParens;
	const inner = directChildrenOfRule(withParens, P.RULE_select_with_parens)[0];
	return inner ? innerSelect(inner) : undefined;
}

/** select_no_parens: with_clause? select_clause opt_sort_clause? (select_limit | for_locking)? */
function lowerSelectNoParens(node: ParserRuleContext): QueryExpr {
	const withClause = directChildrenOfRule(node, P.RULE_with_clause)[0];
	const cteList = withClause ? directChildrenOfRule(withClause, P.RULE_cte_list)[0] : undefined;
	const ctes = cteList ? directChildrenOfRule(cteList, P.RULE_common_table_expr).map(lowerCte) : [];

	const selectClause = directChildrenOfRule(node, P.RULE_select_clause)[0];
	const body = selectClause ? lowerSelectClause(selectClause) : emptyBody(node);

	// The query's OWN sort clause is a DIRECT opt_sort_clause child (grammar: select_no_parens).
	// A deep search finds a CTE body's inner ORDER BY first (document order), hoisting the wrong
	// clause whenever the names coincide (anvil bug report, 2026-07-06).
	const optSort = directChildrenOfRule(node, P.RULE_opt_sort_clause)[0];
	const sort = optSort ? directChildrenOfRule(optSort, P.RULE_sort_clause)[0] : undefined;
	const orderBy = sort ? extractSortKeys(sort) : undefined;
	if (orderBy && body.kind === "select") for (const o of orderBy) columnsOf(o, body.columns, "orderBy");

	const selectLimit = directChildrenOfRule(node, P.RULE_select_limit)[0];
	const limit = selectLimit ? extractLimit(selectLimit) : undefined;

	return { kind: "query", ctes, body, orderBy, limit, cst: node };
}

/** common_table_expr: name opt_name_list? (USING KEY (…))? AS opt_materialized? '(' preparablestmt ')' */
function lowerCte(cte: ParserRuleContext): CteDef {
	const name = firstShallow(cte, P.RULE_name);
	const nameList = directChildrenOfRule(cte, P.RULE_opt_name_list)[0];
	const cols = nameList ? collectOfRule(nameList, P.RULE_name).map((n) => textOf(n)) : [];
	const prep = directChildrenOfRule(cte, P.RULE_preparablestmt)[0];
	const inner = prep ? directChildrenOfRule(prep, P.RULE_selectstmt)[0] : undefined;
	const pivot = prep
		? (directChildrenOfRule(prep, P.RULE_pivotstmt)[0] ?? directChildrenOfRule(prep, P.RULE_unpivotstmt)[0])
		: undefined;
	return {
		name: name ? textOf(name) : "",
		nameCst: name,
		columnAliases: cols.length ? cols : undefined,
		body: inner ? lowerSelectStmt(inner) : pivot ? lowerPivotStmt(pivot) : nonQuery(cte, "non-query-cte"),
		cst: cte,
	};
}

// --- set operations -----------------------------------------------------------

function lowerSelectClause(clause: ParserRuleContext): QueryBody {
	return foldSetOps(clause, P.RULE_simple_select_intersect, lowerSimpleSelectIntersect, [P.UNION, P.EXCEPT]);
}

function lowerSimpleSelectIntersect(node: ParserRuleContext): QueryBody {
	return foldSetOps(node, P.RULE_simple_select_pramary, lowerSimpleSelectPramary, [P.INTERSECT]);
}

function foldSetOps(
	node: ParserRuleContext,
	branchRule: number,
	lowerBranch: (b: ParserRuleContext) => QueryBody,
	opTokens: number[],
): QueryBody {
	let body: QueryBody | undefined;
	let pendingTok: number | undefined;
	let pendingAll = false;
	let pendingByName = false;
	let opCst: ParserRuleContext = node;
	for (let i = 0; i < node.getChildCount(); i++) {
		const c = node.getChild(i);
		if (c instanceof TerminalNode) {
			if (opTokens.includes(c.symbol.type)) {
				pendingTok = c.symbol.type;
				opCst = node;
			} else if (c.symbol.type === P.NAME_P) {
				// UNION [ALL] BY NAME — grammars/duckdb/DuckdbParser.g4 select_clause: `(BY NAME_P)?`
				// (bare inline tokens, not a sub-rule). duckdb.org/docs/current/sql/query_syntax/setops#union-all-by-name
				pendingByName = true;
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
			body = {
				kind: "setop",
				op,
				all: pendingAll,
				byName: pendingByName || undefined,
				left: body,
				right: branch,
				columns: [],
				cst: opCst,
			};
			pendingTok = undefined;
			pendingAll = false;
			pendingByName = false;
		}
	}
	return body ?? emptyBody(node);
}

// --- the SELECT body ----------------------------------------------------------

function lowerSimpleSelectPramary(node: ParserRuleContext): QueryBody {
	const values = directChildrenOfRule(node, P.RULE_values_clause)[0];
	if (values) return lowerValues(values);

	const withParens = directChildrenOfRule(node, P.RULE_select_with_parens)[0];
	if (withParens) {
		const inner = innerSelect(withParens);
		return inner ? lowerSelectStmt(inner).body : emptyBody(node);
	}

	// TABLE relation_expr  ≡  SELECT * FROM relation_expr
	if (
		hasDirectToken(node, P.TABLE) &&
		!hasDirectToken(node, P.SELECT) &&
		!directChildrenOfRule(node, P.RULE_from_clause).length
	) {
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
	const unsupported: UnsupportedFlag[] = [];

	const targetList = firstShallow(node, P.RULE_target_list);
	let projections = targetList ? directChildrenOfRule(targetList, P.RULE_target_el).map(buildProjection) : [];
	// FROM-first without a SELECT clause: `FROM tbl` ≡ SELECT * (from.md#from-first-syntax).
	if (
		!projections.length &&
		!hasDirectToken(node, P.SELECT) &&
		directChildrenOfRule(node, P.RULE_from_clause).length
	) {
		projections = [{ isStar: true, expr: { kind: "star", cst: node }, cst: node }];
	}

	const fromClause = directChildrenOfRule(node, P.RULE_from_clause)[0];
	const from: Source[] = [];
	const joinConditions: Expr[] = [];
	const joins: Join[] = [];
	if (fromClause) {
		for (const tr of directChildrenOfRule(
			directChildrenOfRule(fromClause, P.RULE_from_list)[0] ?? fromClause,
			P.RULE_table_ref,
		)) {
			collectTableRef(tr, from, joinConditions, joins, unsupported);
		}
	}
	joinConditions.push(...nestedJoinConditions.splice(0));

	const where = directChildrenOfRule(node, P.RULE_where_clause)[0];
	const whereExpr = where ? lowerExpr(firstAExpr(where)) : undefined;

	const groupClause = directChildrenOfRule(node, P.RULE_group_clause)[0];
	const groupByAll = groupClause !== undefined && hasTokenShallow(groupClause, P.ALL);
	const groupBy = groupClause && !groupByAll ? extractGroupBy(groupClause) : undefined;

	const having = directChildrenOfRule(node, P.RULE_having_clause)[0];
	const havingExpr = having ? lowerExpr(firstAExpr(having)) : undefined;

	const qualify = directChildrenOfRule(node, P.RULE_qualify_clause)[0];
	const qualifyExpr = qualify ? lowerExpr(firstAExpr(qualify)) : undefined;

	const aggregated =
		groupByAll ||
		(groupBy !== undefined && groupBy.length > 0) ||
		projections.some((p) => hasAggregate(p.expr)) ||
		(havingExpr !== undefined && hasAggregate(havingExpr));

	const columns: ColumnRef[] = [];
	for (const p of projections) columnsOf(p.expr, columns, "projection");
	const distinct = directChildrenOfRule(node, P.RULE_distinct_clause)[0];
	if (distinct) {
		const list = directChildrenOfRule(distinct, P.RULE_expr_list)[0];
		if (list)
			for (const e of directChildrenOfRule(list, P.RULE_a_expr)) columnsOf(lowerExpr(e), columns, "projection");
	}
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
		joins: joins.length ? joins : undefined,
		groupBy,
		having: havingExpr,
		qualify: qualifyExpr,
		aggregated,
		subqueries: subqueries.length ? subqueries : undefined,
		unsupported: unsupported.length ? unsupported : undefined,
		cst: node,
	};
}

/** values_clause — lower to a modelled select with projections named col0…colN (DuckDB's
 *  default VALUES column names, duckdb.org/docs/current/sql/statements/values.md). */
function lowerValues(values: ParserRuleContext): SelectExpr {
	const firstList = directChildrenOfRule(values, P.RULE_expr_list)[0];
	const exprs = firstList ? directChildrenOfRule(firstList, P.RULE_a_expr) : [];
	const projections: Projection[] = exprs.map((e, i) => ({
		name: `col${i}`,
		isStar: false,
		expr: lowerExpr(e),
		cst: e,
	}));
	const columns: ColumnRef[] = [];
	for (const p of projections) columnsOf(p.expr, columns, "projection");
	return { kind: "select", projections, from: [], columns, aggregated: false, cst: values };
}

// --- sources / joins ----------------------------------------------------------

function collectTableRef(
	tr: ParserRuleContext,
	from: Source[],
	joinConditions: Expr[],
	joins: Join[],
	unsupported: UnsupportedFlag[],
): void {
	// FROM-level PIVOT/UNPIVOT reshape the source's output columns; flagged, not silently dropped.
	if (directChildrenOfRule(tr, P.RULE_from_pivot_suffix).length) unsupported.push("pivot");
	if (directChildrenOfRule(tr, P.RULE_from_unpivot_suffix).length) unsupported.push("unpivot");
	from.push(buildPrimarySource(tr, unsupported));
	for (const jt of directChildrenOfRule(tr, P.RULE_joined_table)) {
		const inner = directChildrenOfRule(jt, P.RULE_table_ref)[0];
		const idx = from.length;
		if (inner) collectTableRef(inner, from, joinConditions, joins, unsupported);
		// The join's right source is the FIRST source the inner table_ref contributed (reference-identical).
		const source = from[idx] ?? from[from.length - 1];
		const qual = directChildrenOfRule(jt, P.RULE_join_qual)[0];
		const onA = qual ? directChildrenOfRule(qual, P.RULE_a_expr)[0] : undefined;
		let on: Expr | undefined;
		// Lower ON once, shared with joinConditions (order unchanged) → join.on reference-equal to the entry.
		if (onA) {
			on = lowerExpr(onA);
			joinConditions.push(on);
		}
		if (source) joins.push(buildJoin(jt, source, on, qual));
	}
}

/** Assemble a Join from a DuckDB `joined_table`: kind (incl. POSITIONAL/ASOF/SEMI/ANTI) + NATURAL flag,
 *  USING columns from its join_qual. */
function buildJoin(
	jt: ParserRuleContext,
	source: Source,
	on: Expr | undefined,
	qual: ParserRuleContext | undefined,
): Join {
	const { kind, natural } = joinKindAndNatural(jt);
	const using = on === undefined && qual ? usingColumns(qual) : undefined;
	return { kind, source, on, using, natural: natural || undefined, cst: jt };
}

/** Kind + NATURAL flag for a DuckDB `joined_table`. DuckDB adds CROSS/POSITIONAL/ASOF direct-token
 *  forms and SEMI_P/ANTI_P inside join_type (duckdb.org/docs/current/sql/query_syntax/from). ASOF's
 *  optional ANSI join_type (ASOF LEFT JOIN) is subsumed under kind "asof". */
function joinKindAndNatural(jt: ParserRuleContext): { kind: JoinKind; natural: boolean } {
	const natural = hasDirectToken(jt, P.NATURAL);
	if (hasDirectToken(jt, P.CROSS)) return { kind: "cross", natural: false };
	if (hasDirectToken(jt, P.POSITIONAL)) return { kind: "positional", natural: false };
	if (hasDirectToken(jt, P.ASOF)) return { kind: "asof", natural: false };
	const jtype = directChildrenOfRule(jt, P.RULE_join_type)[0];
	let ansi: JoinKind | undefined;
	if (jtype) {
		if (hasDirectToken(jtype, P.SEMI_P)) ansi = "semi";
		else if (hasDirectToken(jtype, P.ANTI_P)) ansi = "anti";
		else if (hasDirectToken(jtype, P.LEFT)) ansi = "left";
		else if (hasDirectToken(jtype, P.RIGHT)) ansi = "right";
		else if (hasDirectToken(jtype, P.FULL)) ansi = "full";
		else ansi = "inner"; // INNER_P
	}
	if (natural) return { kind: ansi ?? "natural", natural: true };
	return { kind: ansi ?? "inner", natural: false };
}

/** The identifier names of a `join_qual`'s `USING (name_list)`, or undefined for an ON qual. */
function usingColumns(qual: ParserRuleContext): string[] | undefined {
	const nl = directChildrenOfRule(qual, P.RULE_name_list)[0];
	if (!nl) return undefined;
	const cols = collectOfRule(nl, P.RULE_name).map((n) => textOf(n));
	return cols.length ? cols : undefined;
}

function buildPrimarySource(tr: ParserRuleContext, unsupported: UnsupportedFlag[]): Source {
	const aliasNode = directChildrenOfRule(tr, P.RULE_opt_alias_clause)[0];
	// A leading `alias:` prefix (select.md#prefix-aliases) is the alias when no AS clause is given.
	const prefixAlias =
		hasDirectToken(tr, P.COLON) && directChildrenOfRule(tr, P.RULE_colid).length
			? textOf(directChildrenOfRule(tr, P.RULE_colid)[0])
			: undefined;
	const alias = (aliasNode ? aliasName(aliasNode) : undefined) ?? prefixAlias;
	// The alias identifier sits under table_alias (AS slot) or bare_table_alias (AS-less slot).
	const aliasCst = aliasNode ? aliasIdentNode(aliasNode) : undefined;
	const columnAliases = aliasNode ? aliasColumnList(aliasNode) : undefined;

	const rel = directChildrenOfRule(tr, P.RULE_relation_expr)[0];
	if (rel) return buildTableFromRelation(rel, alias, aliasCst, columnAliases);

	// FROM 'file.parquet' — a string-literal relation (replacement scan, data/overview.md).
	const fileRel = directChildrenOfRule(tr, P.RULE_sconst)[0];
	if (fileRel) {
		const fileRelName = [stripStringQuotes(fileRel.getText())];
		return {
			kind: "table",
			relation: relationOf(fileRelName),
			namePartSpans: partSpansOf([fileRel]),
			alias,
			aliasCst,
			columnAliases,
			cst: tr,
		};
	}

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

	// FROM (PIVOT …) — a parenthesized pivot statement is a relation (pivot.md).
	const pivot = directChildrenOfRule(tr, P.RULE_pivotstmt)[0] ?? directChildrenOfRule(tr, P.RULE_unpivotstmt)[0];
	if (pivot) {
		return { kind: "subquery", query: lowerPivotStmt(pivot), alias, aliasCst, columnAliases, cst: tr };
	}

	const funcTable = directChildrenOfRule(tr, P.RULE_func_table)[0];
	if (funcTable) {
		const fname = firstShallow(funcTable, P.RULE_func_name);
		const funcAlias = directChildrenOfRule(tr, P.RULE_func_alias_clause)[0];
		const funcTableName = [fname ? lastName(fname) : funcTable.getText()];
		return {
			kind: "table",
			relation: relationOf(funcTableName),
			alias: alias ?? (funcAlias ? funcAliasName(funcAlias) : undefined),
			aliasCst,
			cst: tr,
		};
	}

	const jsonTable = directChildrenOfRule(tr, P.RULE_json_table)[0];
	if (jsonTable) {
		return {
			kind: "table",
			relation: relationOf(["json_table"]),
			alias,
			aliasCst,
			columnAliases,
			cst: tr,
		};
	}

	const nestedTr = directChildrenOfRule(tr, P.RULE_table_ref)[0];
	if (nestedTr) {
		const innerFrom: Source[] = [];
		const innerJoins: Expr[] = [];
		// Paren-group join NODES aren't modelled (only the top-level FROM chain builds Join[] — see the
		// spec); the inner ON exprs stay conserved into the enclosing joinConditions.
		collectTableRef(nestedTr, innerFrom, innerJoins, [], unsupported);
		nestedJoinConditions.push(...innerJoins);
		if (innerFrom.length) return innerFrom[0];
	}

	const tableName = [textOrEmpty(tr)];
	return { kind: "table", relation: relationOf(tableName), alias, aliasCst, columnAliases, cst: tr };
}

const nestedJoinConditions: Expr[] = [];

function buildTableFromRelation(
	rel: ParserRuleContext,
	alias: string | undefined,
	aliasCst: ParserRuleContext | undefined,
	columnAliases?: string[],
): Source {
	const qn = directChildrenOfRule(rel, P.RULE_qualified_name)[0];
	const parts = qn ? nameParts(qn) : [textOrEmpty(rel)];
	const namePartSpans = qn ? columnPartSpans(qn) : undefined;
	return {
		kind: "table",
		relation: relationOf(parts),
		namePartSpans,
		alias,
		aliasCst,
		columnAliases,
		cst: rel,
	};
}

/** The alias identifier node — under table_alias (AS slot) or bare_table_alias (AS-less slot). */
function aliasIdentNode(aliasClause: ParserRuleContext): ParserRuleContext | undefined {
	return firstShallow(aliasClause, P.RULE_table_alias) ?? firstShallow(aliasClause, P.RULE_bare_table_alias);
}

function aliasName(aliasClause: ParserRuleContext): string | undefined {
	const ta = aliasIdentNode(aliasClause);
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
		// The alias name is the DIRECT colid (AS slot) or bare_colid (AS-less slot) child of
		// alias_clause — never a colid buried in the column-alias name_list (`f() tbl(col)`).
		const cid = directChildrenOfRule(ac, P.RULE_colid)[0] ?? directChildrenOfRule(ac, P.RULE_bare_colid)[0];
		return cid ? textOf(cid) : undefined;
	}
	const cid = firstShallow(funcAlias, P.RULE_colid);
	return cid ? textOf(cid) : undefined;
}

// --- projections --------------------------------------------------------------

/** target_el: columnref star_modifier* | colid ':' a_expr | a_expr target_alias? | STAR star_modifier* */
function buildProjection(elem: ParserRuleContext): Projection {
	// Prefix alias `x: 42` (select.md#prefix-aliases): colid COLON a_expr.
	const prefixCid = directChildrenOfRule(elem, P.RULE_colid)[0];
	if (prefixCid && hasDirectToken(elem, P.COLON)) {
		const a = directChildrenOfRule(elem, P.RULE_a_expr)[0];
		const expr = a ? lowerExpr(a) : otherExpr(elem);
		// Prefix alias `x: 42` — the colid before the `:` is the explicit alias identifier.
		return { name: textOf(prefixCid), isStar: false, expr, aliasCst: prefixCid, cst: elem };
	}
	const colref = directChildrenOfRule(elem, P.RULE_columnref)[0];
	const a = directChildrenOfRule(elem, P.RULE_a_expr)[0];
	const base = colref ?? a;
	if (!base) {
		const star: Expr = { kind: "star", cst: elem };
		applyStarModifiers(star, elem);
		return { isStar: true, expr: star, cst: elem };
	}
	const expr = colref ? lowerColumnref(colref) : lowerExpr(a);
	const aliasNode = directChildrenOfRule(elem, P.RULE_target_alias)[0];
	const alias = aliasNode ? targetAliasText(aliasNode) : undefined;
	const aliasCst = aliasNode ? targetAliasIdentNode(aliasNode) : undefined;

	if (expr.kind === "star") {
		applyStarModifiers(expr, elem);
		return { isStar: true, expr, name: undefined, cst: elem };
	}
	const name = alias ?? (expr.kind === "column" ? expr.parts[expr.parts.length - 1] : undefined);
	return { name, isStar: false, expr, ...(aliasCst ? { aliasCst } : {}), cst: elem };
}

/** Star modifiers (star.md): EXCLUDE names ride on the star; REPLACE expressions' column refs
 *  are recovered through columnsOf's `other` fallback (the modifier stays in the CST). */
function applyStarModifiers(star: Expr & { kind: "star" }, elem: ParserRuleContext): void {
	const excludes: string[] = [];
	for (const mod of directChildrenOfRule(elem, P.RULE_star_modifier)) {
		if (hasDirectToken(mod, P.EXCLUDE)) {
			for (const item of directChildrenOfRule(mod, P.RULE_star_exclude_item)) {
				excludes.push(stripStringQuotes(textOf(item)));
			}
		}
	}
	if (excludes.length) star.exclude = excludes;
}

/** target_alias: AS collabel | identifier | sconst — the label/identifier/string alone is the span. */
function targetAliasIdentNode(node: ParserRuleContext): ParserRuleContext | undefined {
	return (
		firstShallow(node, P.RULE_collabel) ??
		firstShallow(node, P.RULE_identifier) ??
		firstShallow(node, P.RULE_sconst)
	);
}

function targetAliasText(node: ParserRuleContext): string {
	const cl = targetAliasIdentNode(node);
	return cl ? stripStringQuotes(textOf(cl)) : node.getText();
}

// --- GROUP BY / ORDER BY / LIMIT ----------------------------------------------

function extractGroupBy(clause: ParserRuleContext): Expr[] | undefined {
	const items = collectOfRule(clause, P.RULE_group_by_item);
	const keys: Expr[] = [];
	for (const item of items) {
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

function extractSortKeys(sort: ParserRuleContext): Expr[] | undefined {
	// ORDER BY ALL (orderby.md#order-by-all) — no per-key exprs; the clause is present but keyless.
	const keys = collectOfRule(sort, P.RULE_sortby).map((s) => {
		const a = directChildrenOfRule(s, P.RULE_a_expr)[0];
		return a ? lowerExpr(a) : otherExpr(s);
	});
	return keys.length ? keys : undefined;
}

function extractLimit(node: ParserRuleContext): LimitInfo | undefined {
	const info: LimitInfo = {};
	let any = false;
	const limit = directChildrenOfRule(node, P.RULE_limit_clause)[0];
	if (limit) {
		const v = directChildrenOfRule(limit, P.RULE_select_limit_value)[0];
		const a = v ? directChildrenOfRule(v, P.RULE_a_expr)[0] : undefined;
		const pct = v ? directChildrenOfRule(v, P.RULE_aexprconst)[0] : undefined;
		if (a) {
			info.top = lowerExpr(a);
			any = true;
		} else if (pct) {
			// LIMIT 10% (limit.md) — the percentage constant is the cap expression.
			info.top = { kind: "literal", text: pct.getText(), cst: pct };
			any = true;
		} else if (v && hasDirectToken(v, P.ALL)) {
			any = true;
		}
		const ff = directChildrenOfRule(limit, P.RULE_select_fetch_first_value)[0];
		if (ff) {
			const c = directChildrenOfRule(ff, P.RULE_c_expr)[0];
			info.top = c ? lowerExpr(c) : { kind: "literal", text: ff.getText(), cst: ff };
			any = true;
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
			return passthroughTo(node, P.RULE_a_expr_typecast);
		case P.RULE_a_expr_typecast:
			return lowerTypecast(node);
		case P.RULE_c_expr:
			return lowerCExpr(node);
		case P.RULE_b_expr:
			return lowerBExpr(node);
		case P.RULE_lambda_expr:
			return lowerLambda(node);
		default:
			return passthrough(node);
	}
}

function passthrough(node: ParserRuleContext): Expr {
	const child = firstRuleChild(node);
	return child ? lowerExpr(child) : otherExpr(node);
}

function passthroughTo(node: ParserRuleContext, operandRule: number): Expr {
	const child = directChildrenOfRule(node, operandRule)[0];
	return child ? lowerExpr(child) : passthrough(node);
}

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
			pendingOp = c.getText();
		}
	}
	return result ?? otherExpr(node);
}

function opText(type: number, text: string): string {
	if (type === P.AND) return "and";
	if (type === P.OR) return "or";
	return text;
}

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

/** a_expr_in: … NOT? IN_P in_expr — in_expr may also be a collection expression (in.md). */
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
		if (list) {
			args = directChildrenOfRule(list, P.RULE_a_expr).map(lowerExpr);
		} else {
			const coll = inExpr ? directChildrenOfRule(inExpr, P.RULE_a_expr)[0] : undefined;
			args = coll ? [lowerExpr(coll)] : [];
		}
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

function lowerUnaryNot(node: ParserRuleContext): Expr {
	const operand = directChildrenOfRule(node, P.RULE_a_expr_isnull)[0];
	const inner = operand ? lowerExpr(operand) : otherExpr(node);
	return hasDirectToken(node, P.NOT) ? { kind: "unary", op: "not", operand: inner, cst: node } : inner;
}

function lowerIsNull(node: ParserRuleContext): Expr {
	const operand = directChildrenOfRule(node, P.RULE_a_expr_is_not)[0];
	const inner = operand ? lowerExpr(operand) : otherExpr(node);
	if (hasDirectToken(node, P.ISNULL))
		return { kind: "predicate", op: "null", negated: false, operand: inner, args: [], cst: node };
	if (hasDirectToken(node, P.NOTNULL))
		return { kind: "predicate", op: "null", negated: true, operand: inner, args: [], cst: node };
	return inner;
}

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
	if (hasDirectToken(node, P.JSON))
		return { kind: "predicate", op: "json", negated, operand: inner, args: [], cst: node };
	const op = hasDirectToken(node, P.TRUE_P)
		? "true"
		: hasDirectToken(node, P.FALSE_P)
			? "false"
			: hasDirectToken(node, P.UNKNOWN)
				? "unknown"
				: "null";
	return { kind: "predicate", op, negated, operand: inner, args: [], cst: node };
}

function lowerCompare(node: ParserRuleContext): Expr {
	const operands = directChildrenOfRule(node, P.RULE_a_expr_like);
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
		return {
			kind: "binary",
			op: textOrEmpty(directChildrenOfRule(node, P.RULE_subquery_Op)[0]),
			left,
			right: a ? lowerExpr(a) : otherExpr(node),
			cst: node,
		};
	}
	return passthrough(node);
}

/** a_expr_like: … NOT? (LIKE | ILIKE | GLOB | SIMILAR TO) … (pattern_matching.md). */
function lowerLike(node: ParserRuleContext): Expr {
	const operands = directChildrenOfRule(node, P.RULE_a_expr_qual_op);
	const tok = directTokenType(node, [P.LIKE, P.ILIKE, P.GLOB, P.SIMILAR]);
	if (tok === undefined || operands.length < 2) return operands[0] ? lowerExpr(operands[0]) : passthrough(node);
	const op = tok === P.ILIKE ? "ilike" : tok === P.SIMILAR ? "similar" : tok === P.GLOB ? "glob" : "like";
	return {
		kind: "predicate",
		op,
		negated: hasDirectToken(node, P.NOT),
		operand: lowerExpr(operands[0]),
		args: [lowerExpr(operands[1])],
		cst: node,
	};
}

function lowerUnaryQualOp(node: ParserRuleContext): Expr {
	const operand = directChildrenOfRule(node, P.RULE_a_expr_add)[0];
	const inner = operand ? lowerExpr(operand) : otherExpr(node);
	const qualOp = directChildrenOfRule(node, P.RULE_qual_op)[0];
	return qualOp ? { kind: "unary", op: qualOp.getText(), operand: inner, cst: node } : inner;
}

function lowerCaret(node: ParserRuleContext): Expr {
	const left = directChildrenOfRule(node, P.RULE_a_expr_unary_sign)[0];
	const inner = left ? lowerExpr(left) : otherExpr(node);
	if (!hasDirectToken(node, P.CARET)) return inner;
	const right = directChildrenOfRule(node, P.RULE_a_expr)[0];
	return { kind: "binary", op: "^", left: inner, right: right ? lowerExpr(right) : otherExpr(node), cst: node };
}

function lowerUnarySign(node: ParserRuleContext): Expr {
	const operand = directChildrenOfRule(node, P.RULE_a_expr_at_time_zone)[0];
	const inner = operand ? lowerExpr(operand) : otherExpr(node);
	const sign = directTokenType(node, [P.PLUS, P.MINUS]);
	return sign !== undefined ? { kind: "unary", op: sign === P.MINUS ? "-" : "+", operand: inner, cst: node } : inner;
}

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

function lowerTypecast(node: ParserRuleContext): Expr {
	const cexpr = directChildrenOfRule(node, P.RULE_c_expr)[0];
	let expr = cexpr ? lowerExpr(cexpr) : otherExpr(node);
	if (!hasDirectToken(node, P.TYPECAST)) return expr;
	for (const tn of directChildrenOfRule(node, P.RULE_typename)) {
		expr = { kind: "cast", expr, typeText: tn.getText(), cst: node };
	}
	return expr;
}

function lowerBExpr(node: ParserRuleContext): Expr {
	const cexpr = directChildrenOfRule(node, P.RULE_c_expr)[0];
	if (cexpr) return lowerExpr(cexpr);
	const sub = directChildrenOfRule(node, P.RULE_b_expr);
	if (sub.length === 2) {
		const op = directTokenType(node, [
			P.PLUS,
			P.MINUS,
			P.STAR,
			P.SLASH,
			P.PERCENT,
			P.CARET,
			P.LT,
			P.GT,
			P.EQUAL,
			P.LESS_EQUALS,
			P.GREATER_EQUALS,
			P.NOT_EQUALS,
		]);
		return {
			kind: "binary",
			op: op !== undefined ? (tokenText(node, op) ?? "") : "",
			left: lowerExpr(sub[0]),
			right: lowerExpr(sub[1]),
			cst: node,
		};
	}
	if (sub.length === 1) return lowerExpr(sub[0]);
	return otherExpr(node);
}

// --- c_expr: the expression leaves --------------------------------------------

function lowerCExpr(node: ParserRuleContext): Expr {
	if (hasDirectToken(node, P.EXISTS)) {
		const sw = directChildrenOfRule(node, P.RULE_select_with_parens)[0];
		const inner = sw ? innerSelect(sw) : undefined;
		return sw
			? { kind: "exists", query: inner ? lowerSelectStmt(inner) : emptyQuery(sw), cst: node }
			: otherExpr(node);
	}
	// COLUMNS(*/'regex'/lambda) — a dynamic multi-column selection; the closest faithful IR node
	// is a star (the concrete column set needs the schema) — star.md#columns-expression.
	if (hasDirectToken(node, P.COLUMNS)) {
		return { kind: "star", cst: node };
	}
	// [1, 2] list literal / [x FOR x IN l] comprehension — data_types/list.md, functions/list.md.
	if (hasDirectToken(node, P.OPEN_BRACKET)) {
		if (hasDirectToken(node, P.FOR)) {
			const exprs = directChildrenOfRule(node, P.RULE_a_expr);
			const body = exprs[0] ? lowerExpr(exprs[0]) : otherExpr(node);
			const params = directChildrenOfRule(node, P.RULE_colid).map((c) => textOf(c));
			const rest = exprs.slice(1).map(lowerExpr);
			return {
				kind: "function",
				name: "list_comprehension",
				args: [{ kind: "lambda", params, body, cst: node }, ...rest],
				aggregate: false,
				distinct: false,
				cst: node,
			};
		}
		const list = directChildrenOfRule(node, P.RULE_expr_list)[0];
		const elems = list ? directChildrenOfRule(list, P.RULE_a_expr).map(lowerExpr) : [];
		const base: Expr = {
			kind: "function",
			name: "list_value",
			args: elems,
			aggregate: false,
			distinct: false,
			cst: node,
		};
		const ind = directChildrenOfRule(node, P.RULE_opt_indirection)[0];
		return ind ? applyIndirection(base, ind, node) : base;
	}
	// {'k': v} struct / MAP {k: v} map literal — struct.md, map.md.
	if (hasDirectToken(node, P.OPEN_BRACE)) {
		const isMap = hasDirectToken(node, P.MAP_P);
		const args: Expr[] = [];
		for (const f of directChildrenOfRule(node, P.RULE_struct_literal_field)) {
			for (const a of directChildrenOfRule(f, P.RULE_a_expr)) args.push(lowerExpr(a));
		}
		const base: Expr = {
			kind: "function",
			name: isMap ? "map" : "struct_pack",
			args,
			aggregate: false,
			distinct: false,
			cst: node,
		};
		const ind = directChildrenOfRule(node, P.RULE_opt_indirection)[0];
		return ind ? applyIndirection(base, ind, node) : base;
	}
	const lambda = directChildrenOfRule(node, P.RULE_lambda_expr)[0];
	if (lambda) return lowerLambda(lambda);
	const colref = directChildrenOfRule(node, P.RULE_columnref)[0];
	if (colref) return lowerColumnref(colref);
	const caseExpr = directChildrenOfRule(node, P.RULE_case_expr)[0];
	if (caseExpr) return lowerCase(caseExpr);
	// The old func_expr alternative is split in the grammar (SLL surgery): plain_func_expr (undotted
	// call, above columnref) and dotted_func_expr (dotted call + json/common special forms, below).
	// Union of the two = the old func_expr language; both lower through the same path.
	const funcExpr =
		directChildrenOfRule(node, P.RULE_plain_func_expr)[0] ?? directChildrenOfRule(node, P.RULE_dotted_func_expr)[0];
	if (funcExpr) {
		const base = lowerFuncExpr(funcExpr);
		const ind = directChildrenOfRule(node, P.RULE_opt_indirection)[0];
		return ind ? applyIndirection(base, ind, node) : base;
	}
	const constant = directChildrenOfRule(node, P.RULE_aexprconst)[0];
	if (constant) {
		const base: Expr = { kind: "literal", text: constant.getText(), cst: constant };
		// A literal receiver may carry a method chain / subscript — 'abc'.upper() → upper('abc')
		// (grammar `aexprconst opt_indirection`, #13). Empty indirection returns base unchanged.
		const ind = directChildrenOfRule(node, P.RULE_opt_indirection)[0];
		return ind ? applyIndirection(base, ind, node) : base;
	}
	const inParen = directChildrenOfRule(node, P.RULE_a_expr)[0];
	if (inParen) {
		const base = lowerExpr(inParen);
		const ind = directChildrenOfRule(node, P.RULE_opt_indirection)[0];
		return ind ? applyIndirection(base, ind, node) : base;
	}
	const sw = directChildrenOfRule(node, P.RULE_select_with_parens)[0];
	if (sw) {
		const inner = innerSelect(sw);
		return { kind: "subquery", query: inner ? lowerSelectStmt(inner) : emptyQuery(sw), cst: node };
	}
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
	if (hasDirectToken(node, P.GROUPING)) {
		const list = directChildrenOfRule(node, P.RULE_expr_list)[0];
		const args = list ? directChildrenOfRule(list, P.RULE_a_expr).map(lowerExpr) : [];
		return { kind: "function", name: "grouping", args, aggregate: false, distinct: false, cst: node };
	}
	// PARAM opt_indirection — DuckDB prepared-statement parameters (extended in this fork):
	// auto-increment `?`, positional `$1`, and named `$name` —
	// duckdb.org/docs/current/sql/query_syntax/prepared_statements. `text` keeps any trailing
	// indirection as-written; the ordinal/name comes from the PARAM token itself, always this alt's
	// first child. A bare `?` carries neither name nor ordinal — its position is the consumer's
	// derivation, never fabricated here (see the `parameter` IR doc comment).
	if (hasDirectToken(node, P.PARAM)) {
		const paramText = node.getChild(0)!.getText();
		const text = node.getText();
		if (paramText === "?") return { kind: "parameter", text, cst: node };
		if (/^\$\d+$/.test(paramText))
			return { kind: "parameter", text, ordinal: Number(paramText.slice(1)), cst: node };
		return { kind: "parameter", text, name: paramText.slice(1), cst: node };
	}
	// No `plsqlvariablename` direct alt here (see the c_expr grammar comment): a bare `:name` is not
	// a real DuckDB feature and no longer parses as a c_expr child at all.
	const exprs = collectOfRule(node, P.RULE_a_expr).map(lowerExpr);
	if (exprs.length)
		return { kind: "function", name: "row", args: exprs, aggregate: false, distinct: false, cst: node };
	return otherExpr(node);
}

/** lambda_expr: LAMBDA colid (',' colid)* ':' a_expr — functions/lambda.md. */
function lowerLambda(node: ParserRuleContext): Expr {
	const params = directChildrenOfRule(node, P.RULE_colid).map((c) => textOf(c));
	const bodyNode = directChildrenOfRule(node, P.RULE_a_expr)[0];
	return { kind: "lambda", params, body: bodyNode ? lowerExpr(bodyNode) : otherExpr(node), cst: node };
}

function lowerColumnref(node: ParserRuleContext): Expr {
	const colid = directChildrenOfRule(node, P.RULE_colid)[0];
	const head = colid ? textOf(colid) : node.getText();
	const ind = directChildrenOfRule(node, P.RULE_indirection)[0];
	const base: Expr = { kind: "column", parts: [head], cst: node };
	const expr = ind ? applyIndirection(base, ind, node) : base;
	// Attach per-part spans only when the reference stayed a pure dotted column (no `.*`/`.f(...)`/
	// subscript); all-or-nothing, so a synthesized part omits the whole array. See src/ir/part-span.ts.
	return expr.kind === "column" ? { ...expr, partSpans: columnPartSpans(node) } : expr;
}

/** The per-part CST nodes of a `columnref`, PARALLEL to its parts — one shared span-capture seam
 *  (reused by the editor-gold identifier-folding rewrite). Mirrors lowerColumnref/applyIndirection:
 *  the colid head plus each plain `.attr_name` (a `.*`, `.f(...)` method call or `[idx]` subscript el
 *  makes the ref non-column, so the wrapper never reaches here for those). */
function columnPartSpans(node: ParserRuleContext) {
	const nodes: (ParseTree | undefined)[] = [directChildrenOfRule(node, P.RULE_colid)[0]];
	const ind = directChildrenOfRule(node, P.RULE_indirection)[0];
	if (ind) {
		for (const el of directChildrenOfRule(ind, P.RULE_indirection_el)) {
			if (hasDirectToken(el, P.DOT) && !hasDirectToken(el, P.STAR) && !hasDirectToken(el, P.OPEN_PAREN))
				nodes.push(firstShallow(el, P.RULE_attr_name));
		}
	}
	return partSpansOf(nodes);
}

/** Apply indirection_el+ to a base expr: `.attr` extends a column path, `.*` makes a qualified
 *  star, `[idx]` / `[lo:hi(:step)]` a subscript, `.f(args)` a chained method call
 *  (x.f(y) ≡ f(x, y) — functions/overview.md#function-chaining-via-the-dot-operator). */
function applyIndirection(base: Expr, indirection: ParserRuleContext, cst: ParserRuleContext): Expr {
	let expr = base;
	for (const el of directChildrenOfRule(indirection, P.RULE_indirection_el)) {
		if (hasDirectToken(el, P.DOT)) {
			if (hasDirectToken(el, P.STAR)) {
				const qualifier = expr.kind === "column" ? expr.parts : undefined;
				expr = { kind: "star", qualifier, cst };
			} else if (hasDirectToken(el, P.OPEN_PAREN)) {
				const attr = firstShallow(el, P.RULE_attr_name);
				const name = (attr ? textOf(attr) : el.getText().replace(/^\./, "")).toLowerCase();
				// Same extraction as the direct-call path (collectFuncArgs, below): func_arg_list's args plus
				// any func_arg_expr riding as a DIRECT child of `el` outside the list. indirection_el's own
				// grammar carries no VARIADIC alt today, so that second loop is a no-op here, kept so this
				// stays the same fidelity as the direct-call path if the grammar ever grows one (#13 follow-up).
				const args = collectFuncArgs(el);
				expr = { kind: "function", name, args: [expr, ...args], aggregate: false, distinct: false, cst };
			} else {
				const attr = firstShallow(el, P.RULE_attr_name);
				const part = attr ? textOf(attr) : el.getText().replace(/^\./, "");
				expr =
					expr.kind === "column"
						? { kind: "column", parts: [...expr.parts, part], cst }
						: { kind: "subscript", base: expr, index: { kind: "literal", text: part, cst: el }, cst };
			}
		} else {
			expr = applySubscriptBracket(el, expr, cst);
		}
	}
	return expr;
}

/** Lower one bracket `indirection_el`: plain `[idx]`, or a slice — `[lo?:hi?]`, `[lo?:hi?:step?]`,
 *  and `[lo?::step?]` where DuckDB's lexer maximal-munches adjacent colons into one TYPECAST token
 *  when `hi` is omitted (functions/list.md#slicing). Position-aware: a plain index is a direct
 *  `a_expr` child of `el` (grammar's first alt); anything else is the slice alt, walked in child
 *  order so each `opt_slice_bound` lands in whichever of begin/end/step slot it sits in, advancing
 *  the slot on each COLON (+1) or TYPECAST (+2, since it stands in for two colons with an implicit
 *  empty middle bound). A bare `-` (MINUS with no wrapping `opt_slice_bound`) is DuckDB's
 *  default-bound placeholder — the same as an empty bound (`l[:-:2]` ≡ `l[::2]`) — so it advances
 *  nothing and fills nothing: never fabricated into a value. A `plsqlvariablename` child
 *  (`arr[1:hi]`, `arr[lo:hi]`, or the empty-begin `arr[:hi]`) is the lexer's PLSQLVARIABLENAME
 *  token standing in for a fused `COLON identifier` bound — see the grammar comment on
 *  `indirection_el`'s plsqlvariablename alt — so it advances the slot by 1 (like COLON) and
 *  un-fuses into a plain column bound; an absent begin never touched slot 0, so this is correct
 *  whether or not a leading `opt_slice_bound` preceded it. */
function applySubscriptBracket(el: ParserRuleContext, base: Expr, cst: ParserRuleContext): Expr {
	const idxNode = directChildrenOfRule(el, P.RULE_a_expr)[0];
	if (idxNode) return { kind: "subscript", base, index: lowerExpr(idxNode), cst };

	let slot = 0;
	const bounds: [Expr | undefined, Expr | undefined, Expr | undefined] = [undefined, undefined, undefined];
	for (let i = 0; i < el.getChildCount(); i++) {
		const child = el.getChild(i);
		if (child instanceof ParserRuleContext && child.ruleIndex === P.RULE_opt_slice_bound) {
			const boundNode = directChildrenOfRule(child, P.RULE_a_expr)[0];
			if (boundNode) bounds[slot] = lowerExpr(boundNode);
		} else if (child instanceof ParserRuleContext && child.ruleIndex === P.RULE_plsqlvariablename) {
			slot += 1;
			bounds[slot] = fusedBoundColumn(child);
		} else if (child instanceof TerminalNode) {
			if (child.symbol.type === P.COLON) slot += 1;
			else if (child.symbol.type === P.TYPECAST) slot += 2;
			// OPEN_BRACKET / CLOSE_BRACKET / a bare MINUS placeholder: no-op.
		}
	}
	return { kind: "subscript", base, index: bounds[0], end: bounds[1], step: bounds[2], slice: true, cst };
}

/** Un-fuse a `plsqlvariablename` (`PLSQLVARIABLENAME`, `:identifier` with no gap) standing in for a
 *  slice's `COLON identifier` bound into a plain column reference, stripping the leading `:`. */
function fusedBoundColumn(node: ParserRuleContext): Expr {
	return { kind: "column", parts: [node.getText().replace(/^:/, "")], cst: node };
}

function lowerCase(node: ParserRuleContext): Expr {
	const arg = directChildrenOfRule(node, P.RULE_case_arg)[0];
	const subject = arg ? lowerExpr(directChildrenOfRule(arg, P.RULE_a_expr)[0]) : undefined;
	const whens = collectOfRule(node, P.RULE_when_clause).map((w) => {
		const es = directChildrenOfRule(w, P.RULE_a_expr);
		const whenVal = es[0] ? lowerExpr(es[0]) : otherExpr(w);
		const then = es[1] ? lowerExpr(es[1]) : otherExpr(w);
		const when: Expr = subject ? { kind: "binary", op: "=", left: subject, right: whenVal, cst: w } : whenVal;
		return { when, then };
	});
	const def = directChildrenOfRule(node, P.RULE_case_default)[0];
	const elseExpr = def ? lowerExpr(directChildrenOfRule(def, P.RULE_a_expr)[0]) : undefined;
	return { kind: "case", whens, elseExpr, cst: node };
}

function lowerFuncExpr(node: ParserRuleContext): Expr {
	const common = directChildrenOfRule(node, P.RULE_func_expr_common_subexpr)[0];
	if (common) return lowerCommonFunc(common);

	const app =
		directChildrenOfRule(node, P.RULE_func_application)[0] ??
		directChildrenOfRule(node, P.RULE_plain_func_application)[0] ??
		directChildrenOfRule(node, P.RULE_dotted_func_application)[0];
	if (!app) return otherExpr(node);
	// Direct children only: the name rule is always an immediate child of its application rule, and a
	// descendant search would find a NESTED func_name first (e.g. the `DATE` of a typed-literal
	// argument in `strftime(DATE '1992-03-02', …)`).
	const fname =
		directChildrenOfRule(app, P.RULE_func_name)[0] ??
		directChildrenOfRule(app, P.RULE_plain_func_name)[0] ??
		directChildrenOfRule(app, P.RULE_dotted_func_name)[0];
	const name = (fname ? displayName(lastName(fname)) : (leftmostToken(app) ?? "")).toLowerCase();
	const args = collectFuncArgs(app);
	const within = directChildrenOfRule(node, P.RULE_within_group_clause)[0];
	if (within) {
		const sort = firstShallow(within, P.RULE_sort_clause);
		if (sort) for (const k of extractSortKeys(sort) ?? []) args.push(k);
	}
	const filter = directChildrenOfRule(node, P.RULE_filter_clause)[0];
	if (filter) {
		const fa = directChildrenOfRule(filter, P.RULE_a_expr)[0];
		if (fa) args.push(lowerExpr(fa));
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

/** Lower one func_arg_expr: `a_expr` directly, or `param_name (:= | =>) a_expr` (both grammar alts
 *  always carry a direct a_expr child, and lowerExpr already recurses an a_expr down through c_expr into
 *  lambda_expr on its own, so the lambda_expr fallback below is defensive, not the primary lambda path). */
function lowerFuncArgExpr(fa: ParserRuleContext): Expr {
	const a = directChildrenOfRule(fa, P.RULE_a_expr)[0];
	if (a) return lowerExpr(a);
	const l = directChildrenOfRule(fa, P.RULE_lambda_expr)[0];
	return l ? lowerLambda(l) : otherExpr(fa);
}

/** func_arg_list's func_arg_expr* plus any func_arg_expr riding as a DIRECT child of `container` outside
 *  the list. A VARIADIC-prefixed arg (`f(VARIADIC list)` and the trailing `f(a, VARIADIC list)`) is the
 *  latter shape: func_application/dotted_func_application/plain_func_application all put it outside
 *  func_arg_list, so it must be collected in this second pass too, else the whole arg is dropped. It
 *  keeps its expr in the result as an ordinary arg; the VARIADIC marker itself is not modelled (no
 *  consumer needs it). The func_arg_list always precedes the trailing variadic child, so source order is
 *  preserved. Shared by the direct-call path (lowerFuncExpr) and the chained method-call path
 *  (applyIndirection's `.f(args)`) so both keep the same argument fidelity. */
function collectFuncArgs(container: ParserRuleContext): Expr[] {
	const out: Expr[] = [];
	const list = directChildrenOfRule(container, P.RULE_func_arg_list)[0];
	if (list) for (const fa of directChildrenOfRule(list, P.RULE_func_arg_expr)) out.push(lowerFuncArgExpr(fa));
	for (const fa of directChildrenOfRule(container, P.RULE_func_arg_expr)) out.push(lowerFuncArgExpr(fa));
	return out;
}

/** func_expr_common_subexpr: CAST, TRY_CAST, EXTRACT, SUBSTRING, COALESCE, NULLIF, TRIM, … */
function lowerCommonFunc(node: ParserRuleContext): Expr {
	if (hasDirectToken(node, P.CAST) || hasDirectToken(node, P.TRY_CAST) || hasDirectToken(node, P.TREAT)) {
		const a = directChildrenOfRule(node, P.RULE_a_expr)[0];
		const tn = directChildrenOfRule(node, P.RULE_typename)[0];
		return { kind: "cast", expr: a ? lowerExpr(a) : otherExpr(node), typeText: tn ? tn.getText() : "", cst: node };
	}
	const name = (leftmostToken(node) ?? "").toLowerCase();
	const args: Expr[] = [];
	for (const list of directChildrenOfRule(node, P.RULE_expr_list)) {
		for (const a of directChildrenOfRule(list, P.RULE_a_expr)) args.push(lowerExpr(a));
	}
	for (const a of directChildrenOfRule(node, P.RULE_a_expr)) args.push(lowerExpr(a));
	for (const jve of collectOfRule(node, P.RULE_json_value_expr)) {
		for (const a of directChildrenOfRule(jve, P.RULE_a_expr)) args.push(lowerExpr(a));
	}
	for (const sub of [
		P.RULE_extract_list,
		P.RULE_substr_list,
		P.RULE_overlay_list,
		P.RULE_trim_list,
		P.RULE_position_list,
	]) {
		for (const wrap of directChildrenOfRule(node, sub)) {
			for (const a of collectOfRule(wrap, P.RULE_a_expr)) args.push(lowerExpr(a));
			for (const b of collectOfRule(wrap, P.RULE_b_expr)) args.push(lowerExpr(b));
		}
	}
	return { kind: "function", name, args, aggregate: false, distinct: false, cst: node };
}

function lowerOver(over: ParserRuleContext): WindowSpec {
	const spec = directChildrenOfRule(over, P.RULE_window_specification)[0];
	if (!spec) return { partitionBy: [], orderBy: [], cst: over };
	const part = directChildrenOfRule(spec, P.RULE_opt_partition_clause)[0];
	const partitionBy = part
		? directChildrenOfRule(part, P.RULE_expr_list)[0]
			? directChildrenOfRule(directChildrenOfRule(part, P.RULE_expr_list)[0], P.RULE_a_expr).map(lowerExpr)
			: []
		: [];
	const sort = directChildrenOfRule(spec, P.RULE_opt_sort_clause)[0] ?? firstShallow(spec, P.RULE_sort_clause);
	const orderBy = sort ? (extractSortKeys(firstShallow(sort, P.RULE_sort_clause) ?? sort) ?? []) : [];
	return { partitionBy, orderBy, cst: over };
}

// --- expression subqueries -----------------------------------------------------

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
				continue;
			}
			walk(child);
		}
	};
	walk(node);
	return out;
}

// --- column extraction ----------------------------------------------------------

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

function cstColumnRefs(node: ParseTree, acc: ColumnRef[], clause: Clause): void {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (!(child instanceof ParserRuleContext)) continue;
		if (child.ruleIndex === P.RULE_select_with_parens) continue;
		if (child.ruleIndex === P.RULE_columnref) {
			// Route through lowerColumnref so parts + partSpans stay aligned (partSpans present only for a
			// pure dotted column; a star/method/subscript columnref keeps its fused single part, no spans).
			const e = lowerColumnref(child);
			if (e.kind === "column")
				acc.push({ kind: "columnref", parts: e.parts, clause, cst: child, partSpans: e.partSpans });
			else acc.push({ kind: "columnref", parts: [child.getText()], clause, cst: child });
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

function hasTokenShallow(node: ParseTree, type: number): boolean {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof TerminalNode && child.symbol.type === type) return true;
		if (
			child instanceof ParserRuleContext &&
			child.ruleIndex !== P.RULE_select_with_parens &&
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
	return node
		.getText()
		.split(".")
		.filter((p) => p.length > 0);
}

function lastName(node: ParserRuleContext): string {
	const parts = nameParts(node);
	return parts.length ? parts[parts.length - 1] : node.getText();
}

/** Identifier text, RAW — delimiters intact (quotedness must survive into the IR; comparisons
 *  fold via foldIdentifier, display via displayName). */
function textOf(node: ParserRuleContext): string {
	return node.getText();
}

function textOrEmpty(node: ParserRuleContext | undefined): string {
	return node?.getText() ?? "";
}

function stripStringQuotes(text: string): string {
	if (text.length >= 2 && text[0] === "'" && text[text.length - 1] === "'")
		return text.slice(1, -1).replace(/''/g, "'");
	return text; // non-string text passes through raw (identifier delimiters survive to the IR)
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

const emptyCst = new ParserRuleContext(null);
