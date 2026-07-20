import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import { TSqlParser as P } from "../generated/tsql/TSqlParser.js";
import type {
	Clause,
	ColumnRef,
	CteDef,
	Expr,
	Join,
	JoinKind,
	LimitInfo,
	PartSpan,
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
import { partSpanOf, partSpansOf } from "../ir/part-span.js";
import { freezeIR } from "../ir/freeze.js";
import { qualifiedNameOf, type QualifiedName } from "../ir/qualified-name.js";
import { displayName, fold, TSQL_NAME_CONFIG } from "./fold.js";

/** The structured name for a table source's raw parts (issue #38) — role assignment + identity
 *  key + fqn happen HERE, at lowering, where the dialect's namespace shape is known. */
function relationOf(rawParts: string[]): QualifiedName {
	return qualifiedNameOf(rawParts, TSQL_NAME_CONFIG);
}

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

/**
 * Lower a parsed T-SQL input (`tsql_file`, from `parseTSql`) into the IR, reporting the statement
 * category for ANY statement kind — the single entry, the same shape as the Databricks/Snowflake
 * `lower`. A query is modelled onto the IR (its body lowered, so the semantic layer runs on it);
 * DML / DDL / control-flow / admin statements are categorised but not modelled (no object-DDL
 * lowering — out of scope), returning a flagged-empty body that carries the category.
 */
export function lower(tree: ParserRuleContext): QueryExpr {
	const q = lowerImpl(tree);
	q.dialect = "tsql";
	return freezeIR(q);
}

function lowerImpl(tree: ParserRuleContext): QueryExpr {
	const statement = statementCategory(tree);
	if (statement === "query") {
		const sel = firstOfRule(tree, P.RULE_select_statement_standalone);
		if (sel) {
			const q = lowerStandalone(sel);
			q.statement = "query";
			return q;
		}
	}
	// A multi-statement batch is a flagged compound. Anchor its span to the FIRST top-level statement,
	// NOT the whole `tsql_file` (which reaches EOF): a whole-file span on a flagged body makes a
	// downstream AST index read a bogus enclosure over statements 2..n. Bounding to statement 1 keeps
	// the span honest — the "compound" kind already tells a consumer this is an unmodelled batch
	// (issue #21). Single-statement and empty inputs keep `tree` (byte-identical). Recovery-swallowed
	// statements count toward batch-ness (a broken batch stays "compound", flag "multi-statement").
	const units = topLevelUnits(tree);
	const swallowed = swallowedStatements(tree);
	const total = units.length + swallowed;
	const cst = total > 1 && units.length > 0 ? units[0] : tree;
	const q = emptyQuery(
		cst,
		total > 1 ? "multi-statement" : units.length === 0 && swallowed > 0 ? "broken" : undefined,
	);
	q.statement = statement;
	// A lone DECLARE statement (statementCategory folds it to "utility", see unitCategory's
	// another_statement branch) carries no query body to lower, but its variable declarations are
	// real IR content, not a gap: populate them onto the flagged-empty QueryExpr. Only when this
	// batch is exactly one real top-level statement; a multi-statement batch stays a flagged
	// compound with no per-statement modeling, matching every other non-query category here.
	if (statement === "utility" && total === 1 && units.length === 1) {
		const decls = declarationsOf(units[0]);
		if (decls) q.declarations = decls;
	}
	// A CREATE/ALTER PROCEDURE or FUNCTION (the only "ddl" batch_level_statement alternatives with a
	// signature + body this slice models, trigger/view are untouched): layer signature parameters
	// and body statements onto the SAME flagged-stub container (routine-frame slice).
	if (statement === "ddl" && total === 1 && units.length === 1) {
		applyRoutineFrame(q, units[0]);
	}
	return q;
}

/** The routine-frame slice: CREATE/ALTER PROCEDURE and CREATE/ALTER FUNCTION signature parameters +
 *  body statements, layered onto the container's existing flagged-stub QueryExpr (same "ddl"
 *  category, same stub body, EXCEPT the inline-TVF form, which genuinely IS a query and gets its
 *  real body). `unit` is the top-level `batch_level_statement`; every other alternative (trigger,
 *  view) is left untouched. */
function applyRoutineFrame(q: QueryExpr, unit: ParserRuleContext): void {
	const proc = directChildrenOfRule(unit, P.RULE_create_or_alter_procedure)[0];
	if (proc) {
		lowerProcedureFrame(q, proc);
		return;
	}
	const func = directChildrenOfRule(unit, P.RULE_create_or_alter_function)[0];
	if (func) lowerFunctionFrame(q, func);
}

/** `create_or_alter_procedure`: procedure_param(s) -> declarations; `AS sql_clauses*` -> statements
 *  (unwrapping a single outer BEGIN...END, see routineBodyUnits). An `as_external_name` body has no
 *  sql_clauses at all, so statements stays absent, matching the CLR-external DECLARE/RETURN gaps
 *  already accepted elsewhere in this file. */
function lowerProcedureFrame(q: QueryExpr, proc: ParserRuleContext): void {
	const params = directChildrenOfRule(proc, P.RULE_procedure_param).map(lowerProcedureParam);
	if (params.length) q.declarations = params;
	const units = routineBodyUnits(directChildrenOfRule(proc, P.RULE_sql_clauses));
	if (units.length) q.statements = units.map(lowerInnerStatement);
}

/** `create_or_alter_function`: procedure_param(s) -> declarations (shared across all three body
 *  forms), then per RETURNS form:
 *   - func_body_returns_scalar: BEGIN sql_clauses* RETURN <expr> END -> statements (the sql_clauses
 *     only; RETURN's own scalar expression is deliberately NOT modelled: a synthetic statement
 *     carrying it as a projection would be fabricated structure this dialect never wrote).
 *   - func_body_returns_select: RETURNS TABLE ... RETURN select_statement_standalone -- this one
 *     genuinely IS a query: its SELECT becomes the statement's OWN body (replacing the flagged
 *     stub), so scopes/symbols/inference just work on it like any other query.
 *   - func_body_returns_table: RETURNS @t TABLE(...) BEGIN sql_clauses* RETURN END -> statements,
 *     plus the return table variable registers as its own VariableDecl (name + typeText), the same
 *     shape as `DECLARE @t TABLE(...)`. */
function lowerFunctionFrame(q: QueryExpr, func: ParserRuleContext): void {
	const params = directChildrenOfRule(func, P.RULE_procedure_param).map(lowerProcedureParam);
	if (params.length) q.declarations = params;

	const scalar = directChildrenOfRule(func, P.RULE_func_body_returns_scalar)[0];
	if (scalar) {
		const units = routineBodyUnits(directChildrenOfRule(scalar, P.RULE_sql_clauses));
		if (units.length) q.statements = units.map(lowerInnerStatement);
		return;
	}

	const select = directChildrenOfRule(func, P.RULE_func_body_returns_select)[0];
	if (select) {
		const sel = firstOfRule(select, P.RULE_select_statement_standalone);
		if (sel) {
			const inner = lowerStandalone(sel);
			q.body = inner.body;
			q.ctes = inner.ctes;
			q.orderBy = inner.orderBy;
			q.limit = inner.limit;
		}
		return;
	}

	const table = directChildrenOfRule(func, P.RULE_func_body_returns_table)[0];
	if (table) {
		const units = routineBodyUnits(directChildrenOfRule(table, P.RULE_sql_clauses));
		if (units.length) q.statements = units.map(lowerInnerStatement);
		const localId = directTerminal(table, P.LOCAL_ID);
		if (localId) {
			const typeNode = directChildrenOfRule(table, P.RULE_table_type_definition)[0];
			const tableVarDecl: VariableDecl = {
				name: localId.getText().slice(1),
				nameSpan: partSpanOf(localId) ?? partSpanOf(table) ?? ZERO_PART_SPAN,
				typeText: typeNode?.getText(),
				cst: table,
			};
			q.declarations = q.declarations ? [...q.declarations, tableVarDecl] : [tableVarDecl];
		}
	}
}

/** The routine body's own inner statement units: the `sql_clauses` directly following AS,
 *  UNWRAPPING a single outer BEGIN...END wrapper (the block_statement's own sql_clauses children),
 *  since that wrapper is syntactic grouping, not a nested statement of its own. A body with no
 *  BEGIN...END (a bare `AS SELECT 1`, or several ungrouped sql_clauses) keeps each of its own units
 *  as-is. Only create_or_alter_procedure's body needs this: func_body_returns_scalar/table bake
 *  BEGIN...END directly into their own grammar rule, so their sql_clauses are already the inner
 *  statements. */
function routineBodyUnits(directUnits: ParserRuleContext[]): ParserRuleContext[] {
	if (directUnits.length === 1 && unitCategory(directUnits[0]) === "compound") {
		const cfl = directChildrenOfRule(directUnits[0], P.RULE_cfl_statement)[0];
		const block = cfl ? directChildrenOfRule(cfl, P.RULE_block_statement)[0] : undefined;
		if (block) return directChildrenOfRule(block, P.RULE_sql_clauses);
	}
	return directUnits;
}

/** Lower one inner statement of a routine body / scripting compound (a `sql_clauses` node,
 *  SHAPE-IDENTICAL to a top-level batch unit, see topLevelUnits/unitCategory above) into its own
 *  QueryExpr. A query unit gets its real body (through the existing lowerStandalone path); every
 *  other category keeps the SAME honest flagged form + declarations handling a single top-level
 *  unit of that category would get (unitCategory, declarationsOf): this reuses that per-unit
 *  machinery one level deeper, it is not a separate lowering path. */
function lowerInnerStatement(unit: ParserRuleContext): QueryExpr {
	const category = unitCategory(unit);
	if (category === "query") {
		const sel = firstOfRule(unit, P.RULE_select_statement_standalone);
		if (sel) {
			const q = lowerStandalone(sel);
			q.statement = "query";
			return q;
		}
	}
	const q = emptyQuery(unit);
	q.statement = category;
	if (category === "utility") {
		const decls = declarationsOf(unit);
		if (decls) q.declarations = decls;
	}
	return q;
}

/** One `procedure_param` (`LOCAL_ID AS? (type_schema '.')? data_type VARYING? ('=' default)?
 *  (OUT|OUTPUT|READONLY)?`) -> a VariableDecl: name (sigil stripped), nameSpan from the LOCAL_ID,
 *  typeText as written (the schema prefix + VARYING suffix are separate grammar pieces from
 *  data_type, so they're stitched back on: normalized punctuation/spacing, not a token-exact
 *  slice, same as this file's other multi-piece typeText captures), default value lowered as
 *  init, mode from OUT/OUTPUT/READONLY. https://learn.microsoft.com/en-us/sql/relational-databases/
 *  stored-procedures/parameters */
function lowerProcedureParam(node: ParserRuleContext): VariableDecl {
	const localId = directTerminal(node, P.LOCAL_ID);
	const dt = directChildrenOfRule(node, P.RULE_data_type)[0];
	const typeSchema = directChildrenOfRule(node, P.RULE_id_)[0];
	let typeText = dt?.getText();
	if (typeText !== undefined && typeSchema) typeText = `${typeSchema.getText()}.${typeText}`;
	if (typeText !== undefined && hasDirectToken(node, P.VARYING)) typeText = `${typeText} VARYING`;
	const def = directChildrenOfRule(node, P.RULE_procedure_param_default_value)[0];
	return {
		name: localId ? localId.getText().slice(1) : "",
		nameSpan: (localId && partSpanOf(localId)) ?? partSpanOf(node) ?? ZERO_PART_SPAN,
		typeText,
		init: def ? lowerProcedureParamDefault(def) : undefined,
		mode: paramMode(node),
		cst: node,
	};
}

/** `(OUT | OUTPUT | READONLY)?`: OUT/OUTPUT both mean the same modifier ("out"); absent otherwise. */
function paramMode(node: ParserRuleContext): "out" | "readonly" | undefined {
	if (hasDirectToken(node, P.OUT) || hasDirectToken(node, P.OUTPUT)) return "out";
	if (hasDirectToken(node, P.READONLY)) return "readonly";
	return undefined;
}

/** `procedure_param_default_value`: NULL_ | DEFAULT | constant | LOCAL_ID. A `constant` lowers as a
 *  literal (matching every other constant lowering in this file); a LOCAL_ID default (another
 *  variable) lowers as a `variable` reference, same as any other `@x` use; the bare NULL_/DEFAULT
 *  keyword forms fall back to a literal of their own text. */
function lowerProcedureParamDefault(node: ParserRuleContext): Expr {
	const c = directChildrenOfRule(node, P.RULE_constant)[0];
	if (c) return { kind: "literal", text: c.getText(), cst: node };
	const localId = directTerminal(node, P.LOCAL_ID);
	if (localId) {
		const text = localId.getText();
		return { kind: "variable", text, name: text.slice(1), cst: node };
	}
	return { kind: "literal", text: node.getText(), cst: node };
}

/** The variable declarations of a single top-level DECLARE statement (`another_statement ->
 *  declare_statement`), or undefined when `unit` isn't a DECLARE. The list form (`declare_local`,
 *  comma-separated) lowers each entry's name/type/initializer fully; the table-type
 *  (`TABLE(...)` / a qualified user-defined table type name) and XML-schema-collection
 *  alternatives get a bare name + their type text only (no deep modeling of the table shape). */
function declarationsOf(unit: ParserRuleContext): VariableDecl[] | undefined {
	const another = directChildrenOfRule(unit, P.RULE_another_statement)[0];
	const declStmt = another ? directChildrenOfRule(another, P.RULE_declare_statement)[0] : undefined;
	if (!declStmt) return undefined;
	const locals = directChildrenOfRule(declStmt, P.RULE_declare_local);
	if (locals.length) return locals.map(lowerDeclareLocal);
	// `DECLARE @t TABLE(...)` / `DECLARE @t dbo.MyTableType` / `DECLARE @t XML(...)`: a single
	// LOCAL_ID plus one of the three type-shape alternatives declare_local can't express.
	const localId = directTerminal(declStmt, P.LOCAL_ID);
	if (!localId) return undefined;
	const typeNode =
		directChildrenOfRule(declStmt, P.RULE_table_type_definition)[0] ??
		directChildrenOfRule(declStmt, P.RULE_declare_as_table_name)[0] ??
		directChildrenOfRule(declStmt, P.RULE_xml_type_definition)[0];
	return [
		{
			name: localId.getText().slice(1),
			nameSpan: partSpanOf(localId) ?? partSpanOf(declStmt) ?? ZERO_PART_SPAN,
			typeText: typeNode?.getText(),
			cst: declStmt,
		},
	];
}

/** A fallback span for the never-should-happen case a DECLARE target's own token is missing (a
 *  broken/partial parse): `total`, so this stays a valid `PartSpan` rather than `undefined`. */
const ZERO_PART_SPAN: PartSpan = { start: 0, end: 0, line: 0, column: 0, endLine: 0, endColumn: 0 };

/** One `declare_local`: `LOCAL_ID AS? data_type ('=' expression)?`. */
function lowerDeclareLocal(node: ParserRuleContext): VariableDecl {
	const localId = directTerminal(node, P.LOCAL_ID);
	const dt = directChildrenOfRule(node, P.RULE_data_type)[0];
	const initExpr = directChildrenOfRule(node, P.RULE_expression)[0];
	return {
		// The @ sigil stripped, matching the `variable` Expr's `name` (a DECLARE target is always a
		// local, never the `@@` system-variable form).
		name: localId ? localId.getText().slice(1) : "",
		nameSpan: (localId && partSpanOf(localId)) ?? partSpanOf(node) ?? ZERO_PART_SPAN,
		typeText: dt?.getText(),
		init: initExpr ? lowerExpression(initExpr) : undefined,
		cst: node,
	};
}

/**
 * The statement category, from the parse — structural over the grammar's groupings, like the other
 * dialects. A batch with more than one top-level statement is a compound; a single statement maps by
 * its `sql_clauses` child rule (or `batch_level_statement`, the CREATE/ALTER function/proc/trigger/
 * view forms).
 */
function statementCategory(tree: ParserRuleContext): StatementCategory {
	const cats = statementCategories(tree);
	if (cats.length === 0) return "other";
	if (cats.length > 1) return "compound";
	return cats[0];
}

/** Per-statement categories for every top-level unit of a parsed `tsql_file`, in source order —
 *  the file-level view behind statementCategory (which folds >1 into "compound"). Lets consumers
 *  (e.g. the corpus gates) see what a multi-statement script contains. */
export function statementCategories(tree: ParserRuleContext): StatementCategory[] {
	// Recovery-swallowed statements append as "other" — honest count, no keyword guessing.
	return [...topLevelUnits(tree).map(unitCategory), ...swallowedCategories(tree)];
}

/** The top-level statement nodes of a parsed `tsql_file`, in source order — each batch's
 *  `sql_clauses` and `batch_level_statement` children. Behind both statementCategories (mapped to
 *  categories) and lower's multi-statement span anchoring (issue #21). */
function topLevelUnits(tree: ParserRuleContext): ParserRuleContext[] {
	const units: ParserRuleContext[] = [];
	for (const b of directChildrenOfRule(tree, P.RULE_batch)) {
		units.push(...directChildrenOfRule(b, P.RULE_sql_clauses));
		units.push(...directChildrenOfRule(b, P.RULE_batch_level_statement));
	}
	return units;
}

/** Categorise one top-level statement node (a `sql_clauses` or a `batch_level_statement`). */
function unitCategory(unit: ParserRuleContext): StatementCategory {
	// CREATE/ALTER function | procedure | trigger | view — object definition.
	if (unit.ruleIndex === P.RULE_batch_level_statement) return "ddl";
	if (directChildrenOfRule(unit, P.RULE_ddl_clause).length) return "ddl";
	const dml = directChildrenOfRule(unit, P.RULE_dml_clause)[0];
	// dml_clause covers SELECT too (select_statement_standalone) — that branch is usually a query.
	if (dml) {
		const sel = directChildrenOfRule(dml, P.RULE_select_statement_standalone)[0];
		return sel ? selectCategory(sel) : "dml";
	}
	const cfl = directChildrenOfRule(unit, P.RULE_cfl_statement)[0];
	// A BEGIN…END block is a compound; other control flow (IF/WHILE/TRY/…) is its own thing.
	if (cfl) return directChildrenOfRule(cfl, P.RULE_block_statement).length ? "compound" : "other";
	const another = directChildrenOfRule(unit, P.RULE_another_statement)[0];
	// another_statement is the admin/session grab-bag; GRANT/REVOKE/DENY (security_statement) is
	// DCL and BEGIN/COMMIT/ROLLBACK/SAVE TRAN (transaction_statement) is TCL, like the other dialects.
	if (another) {
		if (directChildrenOfRule(another, P.RULE_security_statement).length) return "dcl";
		if (directChildrenOfRule(another, P.RULE_transaction_statement).length) return "tcl";
		return "utility";
	}
	// dbcc_clause / backup_statement / bare semicolon.
	return keywordCategory(unit.start?.text ?? "");
}

/**
 * A SELECT is the read path — except the two side-effecting forms that share its syntax: `SELECT …
 * INTO t` materialises a table (categorised `dml`), and `SELECT @v = expr` assigns a variable and
 * returns no result set (`other`). Both are documented under SELECT but are not queries, so they
 * must not be modelled as one.
 */
function selectCategory(sel: ParserRuleContext): StatementCategory {
	// The OUTER statement's own query spec — walked structurally (select_statement_standalone →
	// select_statement → query_expression (→ parenthesized query_expression)* → the first
	// query_specification), NOT a document-order DFS, which would land on a CTE body's spec
	// when a WITH clause precedes the SELECT. INTO and @v= are only legal in that outer spec.
	const stmt = directChildrenOfRule(sel, P.RULE_select_statement)[0];
	let qe = stmt ? directChildrenOfRule(stmt, P.RULE_query_expression)[0] : undefined;
	let spec: ParserRuleContext | undefined;
	while (qe && !(spec = directChildrenOfRule(qe, P.RULE_query_specification)[0])) {
		qe = directChildrenOfRule(qe, P.RULE_query_expression)[0];
	}
	if (spec) {
		if (directTokenType(spec, [P.INTO]) !== undefined) return "dml";
		const list = directChildrenOfRule(spec, P.RULE_select_list)[0];
		if (list) {
			for (const elem of directChildrenOfRule(list, P.RULE_select_list_elem)) {
				if (directTokenType(elem, [P.LOCAL_ID]) !== undefined) return "other";
			}
		}
	}
	return "query";
}

/** Lower a `select_statement_standalone` (WITH? + a query) into the IR — the query body of a
 *  statement whose category is `query`. Called by `lower` once the category is known. */
function lowerStandalone(tree: ParserRuleContext): QueryExpr {
	// select_statement_standalone: with_expression? select_statement — both direct children.
	const selectStmt = directChildrenOfRule(tree, P.RULE_select_statement)[0];
	if (!selectStmt) return emptyQuery(tree);
	const ctesNode = directChildrenOfRule(tree, P.RULE_with_expression)[0];
	const ctes = ctesNode ? directChildrenOfRule(ctesNode, P.RULE_common_table_expression).map(lowerCte) : [];
	const query = directChildrenOfRule(selectStmt, P.RULE_query_expression)[0];
	const body = query ? lowerQueryExpression(query) : emptyBody(selectStmt);
	const orderBy = extractOrderBy(selectStmt);
	if (orderBy && body.kind !== "pipe") for (const o of orderBy) columnsOf(o, body.columns, "orderBy");
	return { kind: "query", ctes, body, orderBy, limit: extractLimit(selectStmt), cst: query ?? selectStmt };
}

function lowerCte(cte: ParserRuleContext): CteDef {
	// common_table_expression: id_ ('(' column_name_list ')')? AS '(' with_expression? select_statement ')'
	const nameNode = directChildrenOfRule(cte, P.RULE_id_)[0];
	const name = nameNode?.getText() ?? "";
	const inner = directChildrenOfRule(cte, P.RULE_select_statement)[0];
	const colList = directChildrenOfRule(cte, P.RULE_column_name_list)[0];
	const columnAliases = colList ? directChildrenOfRule(colList, P.RULE_id_).map((i) => i.getText()) : undefined;
	const body = inner ? lowerSelect(inner) : emptyQuery(cte);
	// A nested WITH inside this CTE's own body (nested-common-table-expression): its CTEs scope to
	// this CTE's inner query alone, so they ride that query's own `ctes` — not the outer WITH list.
	const nestedWith = directChildrenOfRule(cte, P.RULE_with_expression)[0];
	const nestedCtes = nestedWith ? directChildrenOfRule(nestedWith, P.RULE_common_table_expression).map(lowerCte) : [];
	return {
		name,
		nameCst: nameNode,
		columnAliases: columnAliases?.length ? columnAliases : undefined,
		body: nestedCtes.length ? { ...body, ctes: nestedCtes } : body,
		cst: cte,
	};
}

/** A select_statement (query_expression + order by) -> QueryExpr. */
function lowerSelect(selectStmt: ParserRuleContext): QueryExpr {
	const query = directChildrenOfRule(selectStmt, P.RULE_query_expression)[0];
	const body = query ? lowerQueryExpression(query) : emptyBody(selectStmt);
	const orderBy = extractOrderBy(selectStmt);
	if (orderBy && body.kind !== "pipe") for (const o of orderBy) columnsOf(o, body.columns, "orderBy");
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
	const joinConditions: Expr[] = [];
	const onByCst = new Map<ParserRuleContext, Expr>();
	if (fromClause) extractJoinConditions(fromClause, joinConditions, onByCst);
	const joins = fromClause ? buildJoins(fromClause, from, onByCst) : [];
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
		joins: joins.length ? joins : undefined,
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
	const values = list ? directChildrenOfRule(list, P.RULE_column_alias).map((c) => c.getText()) : [];
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
	const valueColumn = valueFcn ? lastPart(nameParts(valueFcn)) : (valueExpr?.getText() ?? "");
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
	// `receiver.method('...')` in a select list parses as `udt_elem` (id_ '.' id_ udt_method_arguments)
	// — the XML data type methods value()/query()/exist()/modify() (their args are string/@var only).
	// Modelled as a function with the receiver conserved as arg 0, so the receiver column resolves.
	const udt = directChildrenOfRule(elem, P.RULE_udt_elem)[0];
	if (udt) {
		const alias = directChildrenOfRule(udt, P.RULE_as_column_alias)[0];
		return {
			name: alias ? aliasText(alias) : undefined,
			isStar: false,
			expr: lowerUdtElem(udt),
			...(alias ? { aliasCst: aliasCstOf(alias) } : {}),
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
	return { name, isStar: false, expr, ...(aliasCtx ? { aliasCst: aliasCstOf(aliasCtx) } : {}), cst: elem };
}

/** The alias identifier's own span: as_column_alias (`AS? column_alias`) → its column_alias child
 *  (dropping AS); a bare column_alias (the `col = expr` form) is already the identifier. */
function aliasCstOf(alias: ParserRuleContext): ParserRuleContext {
	return directChildrenOfRule(alias, P.RULE_column_alias)[0] ?? alias;
}

function aliasText(alias: ParserRuleContext): string {
	const id = firstOfRule(alias, P.RULE_id_);
	return id ? id.getText() : alias.getText();
}

/** An XML data type method in a select list — `receiver.method('arg', …)` (grammar rule `udt_elem`:
 *  `id_ '.'|'::' id_ udt_method_arguments`). value()/query()/exist()/modify() take string/@var args.
 *  Modelled as a `function`: the receiver becomes arg 0 (a column ref, so it stays conserved and
 *  resolvable — the receiver is a value-bearing subexpression, unlike BigQuery's namespace qualifier),
 *  the method-call strings follow. Typed later by the T-SQL `special` inference hook (value → the
 *  literal sqltype, exist → boolean, query → xml). https://learn.microsoft.com/en-us/sql/t-sql/xml/xml-data-type-methods */
function lowerUdtElem(udt: ParserRuleContext): Expr {
	const ids = directChildrenOfRule(udt, P.RULE_id_);
	const receiver = ids[0];
	const method = ids[1];
	const receiverExpr: Expr = receiver
		? {
				kind: "column",
				parts: [receiver.getText()],
				partSpans: partSpansOf([receiver]),
				cst: receiver,
			}
		: otherExpr(udt);
	const argsNode = directChildrenOfRule(udt, P.RULE_udt_method_arguments)[0];
	const methodArgs: Expr[] = argsNode
		? directChildrenOfRule(argsNode, P.RULE_execute_var_string).map((a) => ({
				kind: "literal",
				text: a.getText(),
				cst: a,
			}))
		: [];
	return {
		kind: "function",
		name: method ? displayName(method.getText()).toLowerCase() : "",
		args: [receiverExpr, ...methodArgs],
		aggregate: false,
		distinct: false,
		cst: udt,
	};
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
		// Each WITH `column_declaration` is `id_ data_type STRING?` — capture the name AND the data-type
		// text, so inference can type the source's output columns (declaredColumns), keeping the bare
		// names on columnAliases for compatibility. https://learn.microsoft.com/en-us/sql/t-sql/functions/openjson-transact-sql
		const declared = collectOfRule(openNode, P.RULE_column_declaration)
			.map((cd) => ({
				name: firstOfRule(cd, P.RULE_id_)?.getText() ?? "",
				type: directChildrenOfRule(cd, P.RULE_data_type)[0]?.getText(),
			}))
			.filter((c) => c.name.length > 0);
		const isJson = openNode.ruleIndex === P.RULE_open_json;
		const columnAliases = declared.length
			? declared.map((c) => c.name)
			: isJson
				? ["key", "value", "type"]
				: undefined;
		return {
			kind: "table",
			relation: relationOf([al?.text ?? (isJson ? "openjson" : "openxml")]),
			alias: al?.text,
			aliasCst: al?.cst,
			columnAliases,
			declaredColumns: declared.length ? declared : undefined,
			cst: item,
		};
	}

	// OPENQUERY / OPENDATASOURCE — a remote rowset; its columns need the remote schema,
	// so an opaque source under its alias (same treatment as a TVF).
	const limited = directChildrenOfRule(item, P.RULE_rowset_function_limited)[0];
	if (limited) {
		return {
			kind: "table",
			relation: relationOf([leftmostToken(limited)?.toLowerCase() ?? "openquery"]),
			alias: alias?.text,
			aliasCst: alias?.cst,
			columnAliases: columnAliasList(item),
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
			relation: relationOf([fn ? functionName(fn) : "nodes"]),
			alias: alias?.text,
			aliasCst: alias?.cst,
			columnAliases: columnAliasList(item), // `… AS f(c1, c2)` declares the output columns
			cst: item,
		};
	}

	const full = directChildrenOfRule(item, P.RULE_full_table_name)[0];
	const parts = full ? nameParts(full) : [item.getText()];
	const namePartSpans = full ? columnPartSpans(full) : undefined;
	return {
		kind: "table",
		relation: relationOf(parts),
		namePartSpans,
		alias: alias?.text,
		aliasCst: alias?.cst,
		cst: item,
	};
}

/** The as_table_alias nested inside an open_json/open_xml node (not a direct child of the item). */
function innerTableAlias(node: ParserRuleContext): { text: string; cst: ParserRuleContext } | undefined {
	const asAlias = firstOfRule(node, P.RULE_as_table_alias);
	const id = asAlias ? firstOfRule(asAlias, P.RULE_id_) : undefined;
	return id ? { text: id.getText(), cst: id } : undefined;
}

function tableAlias(item: ParserRuleContext): { text: string; cst: ParserRuleContext } | undefined {
	const asAlias = directChildrenOfRule(item, P.RULE_as_table_alias)[0];
	const id = asAlias ? firstOfRule(asAlias, P.RULE_id_) : undefined;
	return id ? { text: id.getText(), cst: id } : undefined;
}

function columnAliasList(item: ParserRuleContext): string[] | undefined {
	const list = directChildrenOfRule(item, P.RULE_column_alias_list)[0];
	if (!list) return undefined;
	const cols = directChildrenOfRule(list, P.RULE_column_alias).map((c) => c.getText());
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

function extractJoinConditions(
	fromClause: ParserRuleContext,
	out: Expr[],
	onByCst: Map<ParserRuleContext, Expr>,
): void {
	// join_on: … JOIN table_source ON cond=search_condition — the ON cond is a DIRECT child. Lower once,
	// keyed by the search_condition CST so buildJoins shares the same Expr on the Join (reference-equal).
	for (const jo of shallowNodesOfRule(fromClause, P.RULE_join_on)) {
		const sc = directChildrenOfRule(jo, P.RULE_search_condition)[0];
		if (!sc) continue;
		const e = lowerSearch(sc);
		out.push(e);
		onByCst.set(sc, e);
	}
}

/** The FROM-clause JOIN chain as Join[]: one per join_on / cross_join, in tree (source) order. APPLY,
 *  pivot, and unpivot join_parts are NOT joins (APPLY has no ON and never flowed through joinConditions;
 *  its right source stays a plain `from` entry). `join.source` is the reference-identical `from` entry
 *  (matched by the right table_source_item CST); `join.on` is the shared ON Expr from onByCst. */
function buildJoins(fromClause: ParserRuleContext, from: Source[], onByCst: Map<ParserRuleContext, Expr>): Join[] {
	const sourceByCst = new Map<ParserRuleContext, Source>();
	for (const s of from) sourceByCst.set(s.cst, s);
	const rightItem = (node: ParserRuleContext): ParserRuleContext | undefined => {
		// join_on's right is `source=table_source` (whose leading table_source_item is the operand);
		// cross_join's right is a direct table_source_item.
		const ts = directChildrenOfRule(node, P.RULE_table_source)[0];
		const host = ts ?? node;
		return directChildrenOfRule(host, P.RULE_table_source_item)[0];
	};
	const joins: Join[] = [];
	for (const jp of shallowNodesOfRule(fromClause, P.RULE_join_part)) {
		const joinOn = directChildrenOfRule(jp, P.RULE_join_on)[0];
		const crossJoin = directChildrenOfRule(jp, P.RULE_cross_join)[0];
		const node = joinOn ?? crossJoin;
		if (!node) continue; // apply_ / pivot / unpivot — not a join
		const item = rightItem(node);
		const source = item ? sourceByCst.get(item) : undefined;
		if (!source) continue;
		if (joinOn) {
			const t = directTokenType(joinOn, [P.LEFT, P.RIGHT, P.FULL, P.INNER]);
			const kind: JoinKind = t === P.LEFT ? "left" : t === P.RIGHT ? "right" : t === P.FULL ? "full" : "inner";
			const sc = directChildrenOfRule(joinOn, P.RULE_search_condition)[0];
			joins.push({ kind, source, on: sc ? onByCst.get(sc) : undefined, cst: joinOn });
		} else {
			joins.push({ kind: "cross", source, cst: crossJoin });
		}
	}
	return joins;
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

	// REGEXP_LIKE(string, pattern [, flags]) — the boolean regex predicate (SQL Server 2025). The
	// operand is the string; args are the pattern (+ optional flags). Modelled as an `rlike` predicate
	// (→ boolean). https://learn.microsoft.com/en-us/sql/t-sql/functions/regexp-like-transact-sql
	if (hasDirectToken(pred, P.REGEXP_LIKE)) {
		return {
			kind: "predicate",
			op: "rlike",
			negated,
			operand,
			args: exprs.slice(1).map(lowerExpression),
			cst: pred,
		};
	}

	// Full-text search `CONTAINS(cols, '…')` / `FREETEXT(cols, '…')` — a boolean predicate. The searched
	// columns are conserved as the operand + column args; the search-condition string(s) follow.
	// https://learn.microsoft.com/en-us/sql/t-sql/queries/contains-transact-sql
	const ft = directChildrenOfRule(pred, P.RULE_freetext_predicate)[0];
	if (ft) {
		const cols: Expr[] = collectOfRule(ft, P.RULE_full_column_name).map((c) => ({
			kind: "column",
			parts: nameParts(c),
			partSpans: columnPartSpans(c),
			cst: c,
		}));
		const searches = directChildrenOfRule(ft, P.RULE_expression).map(lowerExpression);
		return {
			kind: "predicate",
			op: hasDirectToken(ft, P.CONTAINS) ? "contains" : "freetext",
			negated,
			operand: cols[0] ?? { kind: "literal", text: ft.getText(), cst: ft },
			args: [...cols.slice(1), ...searches],
			cst: ft,
		};
	}

	// SQL Graph `MATCH(<graph_pattern>)` — a boolean predicate over a node/edge traversal pattern (the
	// pattern names graph node/edge tables already in FROM, not columns). We model it the way XML is
	// modelled — as a boolean predicate, keeping the pattern text, without shredding the topology.
	// https://learn.microsoft.com/en-us/sql/t-sql/queries/match-sql-graph
	if (hasDirectToken(pred, P.MATCH)) {
		const pat = firstOfRule(pred, P.RULE_graph_match_pattern);
		return {
			kind: "predicate",
			op: "match",
			negated,
			operand: pat ? { kind: "literal", text: pat.getText(), cst: pat } : otherExpr(pred),
			args: [],
			cst: pred,
		};
	}

	// IS [NOT] DISTINCT FROM (2022) — checked before the plain IS branch, which would
	// otherwise read it as a null test.
	if (hasDirectToken(pred, P.IS) && hasDirectToken(pred, P.DISTINCT)) {
		return {
			kind: "predicate",
			op: "distinct from",
			negated,
			operand,
			args: exprs.slice(1, 2).map(lowerExpression),
			cst: pred,
		};
	}
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
	// Quantified comparison: `expr <cmp> ALL|SOME|ANY (subquery)` — the right side is a subquery, so
	// there is only one expression. Modelled as a boolean predicate (op = "<cmp> all|some|any") whose
	// arg is the subquery, so the operand column and the subquery scope are both conserved.
	// https://learn.microsoft.com/en-us/sql/t-sql/language-elements/all-transact-sql
	if (cmp) {
		const sub = firstOfRule(pred, P.RULE_subquery);
		if (sub) {
			const quant = directTokenType(pred, [P.ALL, P.SOME, P.ANY]);
			const q = quant === P.ALL ? "all" : quant === P.SOME ? "some" : "any";
			return {
				kind: "predicate",
				op: `${cmp.getText()} ${q}`,
				negated,
				operand,
				args: [{ kind: "subquery", query: lowerSubquery(sub), cst: sub }],
				cst: pred,
			};
		}
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
			return { kind: "column", parts: nameParts(node), partSpans: columnPartSpans(node), cst: node };
		case P.RULE_primitive_expression:
		case P.RULE_primitive_constant: {
			// LOCAL_ID (`@x` local, `@@x` system -- a single lexer token, distinguished by leading
			// `@` count, learn.microsoft.com/en-us/sql/t-sql/language-elements/variables-transact-sql)
			// is a session/local variable, not a literal; a bare `?` (PLACEHOLDER, nested one rule
			// deeper via `primitive_constant -> parameter -> PLACEHOLDER`) is a caller-bound
			// parameter marker. Everything else here (NULL/DEFAULT/string/numeric/money literals)
			// stays a literal, unchanged.
			const localId = directTerminal(node, P.LOCAL_ID);
			if (localId) {
				const text = localId.getText();
				return text.startsWith("@@")
					? { kind: "variable", text, name: text.slice(2), system: true, cst: node }
					: { kind: "variable", text, name: text.slice(1), cst: node };
			}
			if (hasToken(node, P.PLACEHOLDER)) return { kind: "parameter", text: node.getText(), cst: node };
			return { kind: "literal", text: node.getText(), cst: node };
		}
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
			// ODBC GUID literal escape: `{ GUID 'nnnnnnnn-...' }`. Modelled as a cast of the string
			// literal to uniqueidentifier, matching what the escape sequence means.
			if (hasDirectToken(node, P.GUID)) {
				const str = directTerminal(node, P.STRING);
				return {
					kind: "cast",
					expr: str ? { kind: "literal", text: str.getText(), cst: node } : otherExpr(node),
					typeText: "uniqueidentifier",
					cst: node,
				};
			}
			const clrMethod = directChildrenOfRule(node, P.RULE_clr_method_name)[0];
			if (clrMethod) {
				const receiverExpr = directChildrenOfRule(node, P.RULE_expression)[0];
				if (receiverExpr) {
					// Instance method call: `expression '.' clr_method_name '(' args ')'`
					// (@g.STAsText(), point.STDistance(other), col.STBuffer(1)). Receiver conserved
					// as arg 0, matching lowerUdtElem's shape for the XML data type methods.
					const argsList = directChildrenOfRule(node, P.RULE_expression_list_)[0];
					const args = argsList ? directChildrenOfRule(argsList, P.RULE_expression).map(lowerExpression) : [];
					return {
						kind: "function",
						name: displayName(clrMethod.getText()).toLowerCase(),
						args: [lowerExpression(receiverExpr), ...args],
						aggregate: false,
						distinct: false,
						cst: node,
					};
				}
				// Bare property off a @variable, no parens: `LOCAL_ID '.' clr_method_name` (@g.Lat, @p.X).
				const receiverTok = directTerminal(node, P.LOCAL_ID);
				return {
					kind: "function",
					name: displayName(clrMethod.getText()).toLowerCase(),
					args: [receiverTok ? { kind: "literal", text: receiverTok.getText(), cst: node } : otherExpr(node)],
					aggregate: false,
					distinct: false,
					cst: node,
				};
			}
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
	// static_method_call (geography::STGeomFromText(...), geometry::[Null]): the callable name is
	// the member after `::`, not the leading type name (leftmostToken would return "geography").
	const staticCall = directChildrenOfRule(node, P.RULE_static_method_call)[0];
	const staticMethod = staticCall && directChildrenOfRule(staticCall, P.RULE_clr_method_name)[0];
	if (staticMethod) return displayName(staticMethod.getText()).toLowerCase();
	// ODBC scalar function escape `{fn NAME(...)}` where NAME is a reserved keyword (TRUNCATE,
	// CURRENT_DATE, CURRENT_TIME) rather than a scalar_function_name — the terminal right after FN.
	const afterFn = directTerminalAfter(node, P.FN);
	if (afterFn) return displayName(afterFn.getText()).toLowerCase();
	return leftmostToken(node) ?? "";
}

/** The first direct-child terminal appearing after a direct child token of type `tokenType`. */
function directTerminalAfter(node: ParseTree, tokenType: number): TerminalNode | undefined {
	let seen = false;
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (seen && child instanceof TerminalNode) return child;
		if (child instanceof TerminalNode && child.symbol.type === tokenType) seen = true;
	}
	return undefined;
}

function lowerOver(over: ParserRuleContext): { partitionBy: Expr[]; orderBy: Expr[]; cst: ParserRuleContext } {
	const own = windowParts(over);
	// 2022 named windows: `OVER w` or `OVER (w …)` — the name resolves against the
	// enclosing select's WINDOW clause; the OVER's own parts override the base's.
	const refName = directChildrenOfRule(over, P.RULE_id_)[0]?.getText();
	const base = refName ? resolveNamedWindow(over, refName, new Set()) : undefined;
	return {
		partitionBy: own.partitionBy.length ? own.partitionBy : (base?.partitionBy ?? []),
		orderBy: own.orderBy.length ? own.orderBy : (base?.orderBy ?? []),
		cst: over,
	};
}

/** The PARTITION BY / ORDER BY expressions directly inside an over_clause or window_specification. */
function windowParts(node: ParserRuleContext): { partitionBy: Expr[]; orderBy: Expr[] } {
	const partitionBy = directChildrenOfRule(node, P.RULE_expression_list_)
		.flatMap((l) => directChildrenOfRule(l, P.RULE_expression))
		.map(lowerExpression);
	const orderBy = collectOfRule(node, P.RULE_order_by_expression)
		.map((o) => firstOfRule(o, P.RULE_expression))
		.filter((e): e is ParserRuleContext => e !== undefined)
		.map(lowerExpression);
	return { partitionBy, orderBy };
}

/** Resolve a window name against the enclosing query spec's WINDOW clause. A definition may
 *  itself start with another window's name (chained); `seen` guards against cycles. */
function resolveNamedWindow(
	from: ParserRuleContext,
	name: string,
	seen: Set<string>,
): { partitionBy: Expr[]; orderBy: Expr[] } | undefined {
	const key = fold(name);
	if (seen.has(key)) return undefined;
	seen.add(key);

	let spec: ParserRuleContext | null = from.parent;
	while (spec && spec.ruleIndex !== P.RULE_query_specification) spec = spec.parent;
	if (!spec) return undefined;
	const clause = directChildrenOfRule(spec, P.RULE_select_window_clause)[0];
	if (!clause) return undefined;

	for (const def of directChildrenOfRule(clause, P.RULE_window_definition)) {
		const defName = directChildrenOfRule(def, P.RULE_id_)[0]?.getText();
		if (!defName || fold(defName) !== key) continue;
		const ws = directChildrenOfRule(def, P.RULE_window_specification)[0];
		if (!ws) return undefined;
		const parts = windowParts(ws);
		const baseRef = directChildrenOfRule(ws, P.RULE_id_)[0]?.getText();
		const base = baseRef ? resolveNamedWindow(def, baseRef, seen) : undefined;
		return {
			partitionBy: parts.partitionBy.length ? parts.partitionBy : (base?.partitionBy ?? []),
			orderBy: parts.orderBy.length ? parts.orderBy : (base?.orderBy ?? []),
		};
	}
	return undefined;
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

/** Fallback: recover full_column_name references from inside an unmodelled `other` node. */
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
				partSpans: columnPartSpans(child),
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

/** The first direct-child terminal of the given token type, if any. */
function directTerminal(node: ParseTree, type: number): TerminalNode | undefined {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof TerminalNode && child.symbol.type === type) return child;
	}
	return undefined;
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
/** Per-part spans PARALLEL to nameParts(node) — one span per `id_` (its bracket/quote delimiters
 *  included), all-or-nothing: undefined when there are no id_ children (nameParts falls back to a
 *  dotted split then). One shared span-capture seam (reused by the editor-gold rewrite). */
function columnPartSpans(node: ParserRuleContext) {
	return partSpansOf(collectOfRule(node, P.RULE_id_));
}

function nameParts(node: ParserRuleContext): string[] {
	const ids = collectOfRule(node, P.RULE_id_);
	if (ids.length) return ids.map((i) => i.getText());
	return node
		.getText()
		.split(".")
		.filter((p) => p.length > 0);
}

function lastNamePart(text: string): string {
	const dot = text.lastIndexOf(".");
	return dot >= 0 ? text.slice(dot + 1) : text;
}

function otherExpr(node: ParserRuleContext): Expr {
	return { kind: "other", text: node.getText(), cst: node };
}

function emptyBody(cst: ParserRuleContext, reason: UnsupportedFlag = "unparsed"): SelectExpr {
	return {
		kind: "select",
		projections: [],
		from: [],
		columns: [],
		aggregated: false,
		unsupported: [reason],
		cst,
	};
}

function emptyQuery(cst: ParserRuleContext, reason?: UnsupportedFlag): QueryExpr {
	return { kind: "query", ctes: [], body: emptyBody(cst, reason), cst };
}
