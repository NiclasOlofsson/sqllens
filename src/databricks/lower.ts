import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import {
	ArithmeticBinaryContext,
	ArithmeticUnaryContext,
	CastByColonContext,
	CastContext,
	CollationForContext,
	ColumnReferenceContext,
	ComparisonContext,
	ConstantDefaultContext,
	CreateVariableContext,
	CurrentLikeContext,
	DatabricksParser as P,
	DereferenceContext,
	ExistsContext,
	FunctionCallContext,
	IdentifierLiteralContext,
	LambdaContext,
	LogicalBinaryContext,
	LogicalNotContext,
	NamedParameterLiteralContext,
	ParenthesizedExpressionContext,
	PosParameterLiteralContext,
	PredicatedContext,
	PrimaryExpressionContext,
	RowConstructorContext,
	SearchedCaseContext,
	ShiftExpressionContext,
	SimpleCaseContext,
	StarContext,
	StringLitContext,
	StringLiteralContext,
	SubqueryExpressionContext,
	SubscriptContext,
	TimestampaddContext,
	TimestampdiffContext,
	TryCastByColonContext,
	TypeAscriptionContext,
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
	Join,
	JoinKind,
	LateralViewSource,
	LimitInfo,
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
	VariableDecl,
	WindowSpec,
} from "../ir/ir.js";
import { keywordCategory, swallowedCategories, swallowedStatements, type StatementCategory } from "../ir/statement.js";
import { partSpanOf, partSpansOf, type PartSpan } from "../ir/part-span.js";
import { freezeIR } from "../ir/freeze.js";
import { qualifiedNameOf, type QualifiedName } from "../ir/qualified-name.js";
import { DATABRICKS_NAME_CONFIG } from "./fold.js";

/** The structured name for a table source's raw parts (issue #38) — role assignment + identity
 *  key + fqn happen HERE, at lowering, where the dialect's namespace shape is known. */
function relationOf(rawParts: string[]): QualifiedName {
	return qualifiedNameOf(rawParts, DATABRICKS_NAME_CONFIG);
}

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

/** A DIRECT child of `node` with the given rule index — never descends. A nested construct
 *  would otherwise donate ITS matching child first in walk order: in `x :: long :: int` /
 *  `cast(cast(x AS double) AS timestamp)` the deep-first search returned the INNER cast's
 *  dataType as the outer's typeText (caught by the Spark-goldens gate). */
function directOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext | undefined {
	for (let i = 0; i < node.getChildCount(); i++) {
		const child = node.getChild(i);
		if (child instanceof ParserRuleContext && child.ruleIndex === ruleIndex) return child;
	}
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

/** Lower a parsed Databricks statement (CST) into the IR, frozen — immutable after lower() (no pass writes back). */
export function lower(tree: ParserRuleContext): QueryExpr {
	const q = lowerImpl(tree);
	q.dialect = "databricks";
	return freezeIR(q);
}

/** An empty, flagged body — the stable non-throw shape for anything not modelled.
 *  Parameter order unified with trino's `flagged()` (review finding 7): `(cst, statement, flag)`. */
function flagged(cst: ParserRuleContext, statement: StatementCategory, flag: UnsupportedFlag): QueryExpr {
	const body: SelectExpr = {
		kind: "select",
		projections: [],
		from: [],
		columns: [],
		aggregated: false,
		unsupported: [flag],
		cst,
	};
	return { kind: "query", statement, ctes: [], body, cst };
}

function lowerImpl(tree: ParserRuleContext): QueryExpr {
	// multiStatement root (issue #1): >1 element is a compound script — flagged, not modelled
	// (the issue is parse-entry parity only). 0 elements is an empty file — also flagged,
	// never a throw (an editor opens empty documents).
	const elements = directChildrenOfRule(tree, P.RULE_multiStatementElement);
	// Statements swallowed by error recovery count toward batch-ness: a broken statement makes
	// recovery dump the rest of the batch (healthy statements included) as flat error nodes, so
	// the element count alone under-reports and a broken batch would misreport as "query".
	const swallowed = tree.ruleIndex === P.RULE_multiStatement ? swallowedStatements(tree) : 0;
	// A `;`-separated batch of >1 statements is a compound script — flagged, not modelled.
	// Anchor the flagged body's CST span to the FIRST statement element, NOT the whole
	// `multiStatement` container: the container reaches EOF, and a whole-file span on a
	// `kind: "select"` body makes a downstream AST index read a bogus Select enclosure over
	// statements 2..n (which carry none of their inner structure). Bounding to statement 1
	// keeps the span honest — the "compound" statement kind + "multi-statement" flag already
	// tell a consumer this is an unmodelled batch (issue #21).
	if (elements.length + swallowed > 1) return flagged(elements[0] ?? tree, "compound", "multi-statement");
	if (elements.length === 0 && tree.ruleIndex === P.RULE_multiStatement)
		return flagged(tree, "other", swallowed > 0 ? "broken" : "empty");
	const stmt = elements[0] ?? tree; // the single element, or a legacy single-statement root
	const statement = statementCategory(stmt);
	// A BEGIN…END scripting compound is a statement *sequence*, not a query — flag the whole thing
	// rather than modelling whichever SELECT happens to come first inside it, PLUS its own inner
	// statements (applyCompoundFrame — the routine-frame slice's Databricks counterpart, see tsql's
	// applyRoutineFrame / snowflake's applyScriptingFrame).
	if (isCompound(stmt)) {
		const q = flagged(stmt, statement, "compound");
		applyCompoundFrame(q, stmt);
		return q;
	}
	return lowerStatement(stmt);
}

/** Lower a single statement-shaped node into a QueryExpr: a real query gets its real body;
 *  anything else gets the flagged "non-query" stub. Shared by lowerImpl's single-element case and
 *  each compound inner statement whose own alternative is a nested `statement`
 *  (lowerInnerCompoundStatement). */
function lowerStatement(stmt: ParserRuleContext): QueryExpr {
	const statement = statementCategory(stmt);
	const query = firstOfRule(stmt, P.RULE_query);
	if (!query) return flagged(stmt, statement, "non-query");
	const lowered = lowerQuery(query);
	lowered.statement = statement;
	return lowered;
}

/** A BEGIN…END scripting compound: the batch element's BEGIN-led alternative, or a legacy
 *  `singleCompoundStatement` root (other entries into this lowering still work). A NESTED
 *  `beginEndCompoundBlock` inside another compound's own body is detected directly by
 *  lowerInnerCompoundStatement instead (it is never routed through `statement`/lowerStatement, so
 *  it never reaches this function). */
function isCompound(stmt: ParserRuleContext): boolean {
	if (stmt.ruleIndex === P.RULE_multiStatementElement && stmt.start?.type === P.BEGIN) return true;
	return !!firstOfRule(stmt, P.RULE_singleCompoundStatement);
}

/** The `compoundBody` of a compound-shaped node: a direct child for the two shapes that carry one
 *  right on themselves (a BEGIN-led `multiStatementElement`, or a nested `beginEndCompoundBlock`),
 *  else a deep search for the legacy `singleCompoundStatement` root's own child. */
function compoundBodyOf(stmt: ParserRuleContext): ParserRuleContext | undefined {
	const direct = directChildrenOfRule(stmt, P.RULE_compoundBody)[0];
	if (direct) return direct;
	const single = firstOfRule(stmt, P.RULE_singleCompoundStatement);
	return single ? directChildrenOfRule(single, P.RULE_compoundBody)[0] : undefined;
}

/** Layers a BEGIN...END scripting compound's inner statements (statements[]) onto the container's
 *  existing flagged "compound" QueryExpr. Databricks' compoundBody has no variable-DECLARE
 *  statement of its own (declareConditionStatement declares a named SQLSTATE handler condition, not
 *  a typed variable — grammars/databricks/DatabricksParser.g4); the DECLARE-VARIABLE form
 *  (`#createVariable`) is a plain `statement` alternative reachable from inside a compound body too,
 *  so it rides that inner statement's own `declarations` (lowerInnerCompoundStatement) — there is no
 *  container-level declarations counterpart here, unlike tsql/snowflake's signature-like preamble. */
function applyCompoundFrame(q: QueryExpr, stmt: ParserRuleContext): void {
	const body = compoundBodyOf(stmt);
	if (!body) return;
	const units = directChildrenOfRule(body, P.RULE_compoundStatement);
	if (units.length) q.statements = units.map(lowerInnerCompoundStatement);
}

/** One `compoundStatement` of a scripting body -> its own QueryExpr. A nested `beginEndCompoundBlock`
 *  gets the same flagged "compound" stub + recursive statements[] (applyCompoundFrame called again,
 *  so nesting layers naturally to any depth). A `statement` gets its real body via the shared
 *  per-statement lowering (lowerStatement); its `#createVariable` alternative (DECLARE [OR REPLACE] [VARIABLE]
 *  name [, name...] [data_type] [DEFAULT|= expr] — sql-ref-syntax-ddl-declare-variable) ALSO carries
 *  its own `declarations`, mirroring a tsql body DECLARE / a Snowflake scripting LET: mid-body, not
 *  container-level (rootDeclarations pools the whole tree regardless of nesting depth). Every other
 *  scripting-only control-flow alternative (declareConditionStatement, setStatementInsideSqlScript,
 *  declareHandlerStatement, ifElseStatement, caseStatement, whileStatement, repeatStatement,
 *  leaveStatement, iterateStatement, loopStatement, forStatement) has no query body to lower — an
 *  honest flagged "non-query" stub, categorised by leading keyword like the top-level grab-bag
 *  commands. */
function lowerInnerCompoundStatement(unit: ParserRuleContext): QueryExpr {
	const nested = directChildrenOfRule(unit, P.RULE_beginEndCompoundBlock)[0];
	if (nested) {
		const q = flagged(nested, "compound", "compound");
		applyCompoundFrame(q, nested);
		return q;
	}
	const stmt = directChildrenOfRule(unit, P.RULE_statement)[0];
	if (stmt) {
		const q = lowerStatement(stmt);
		if (stmt instanceof CreateVariableContext) q.declarations = lowerCreateVariable(stmt);
		return q;
	}
	return flagged(unit, keywordCategory(unit.start?.text ?? ""), "non-query");
}

/** `DECLARE [OR REPLACE] [VARIABLE] name [, name...] [data_type] [{DEFAULT|=} expr]` (Databricks
 *  session variables, sql-ref-syntax-ddl-declare-variable): ONE shared data_type/default expression
 *  across every name in the list — duplicated onto EACH name's own VariableDecl, matching the doc's
 *  own multi-name example (`DECLARE var1, var2 DOUBLE DEFAULT rand()`: both get type DOUBLE and
 *  their own evaluation of the same expression). */
function lowerCreateVariable(node: CreateVariableContext): VariableDecl[] {
	const dt = node.dataType();
	const typeText = dt?.getText();
	const defaultExpr = node.variableDefaultExpression();
	const init = defaultExpr ? lowerExpression(defaultExpr.expression()) : undefined;
	return node.identifierReference().map((idRef) => ({
		name: idRef.getText(),
		nameSpan: partSpanOf(idRef) ?? partSpanOf(node) ?? ZERO_PART_SPAN,
		typeText,
		init,
		cst: idRef,
	}));
}

/** A fallback span for the never-should-happen case a declared variable's own name token is missing
 *  (a broken/partial parse): stays a valid `PartSpan` rather than `undefined`. */
const ZERO_PART_SPAN: PartSpan = { start: 0, end: 0, line: 0, column: 0, endLine: 0, endColumn: 0 };

/**
 * The statement category, from the parse — not the source text. Spark's `statement` rule labels its
 * alternatives, so the structural cases are exact: a `#dmlStatement` (`ctes? dmlStatementNoWith`) is
 * DML even when written `WITH cte … INSERT …`, and a BEGIN…END compound is its own category. For
 * the remaining keyword-led commands (object DDL, GRANT, SET/USE/SHOW, …) the leading keyword is the
 * authoritative signal — Spark has no grouping rule above them.
 */
function statementCategory(stmt: ParserRuleContext): StatementCategory {
	if (isCompound(stmt)) return "compound";
	if (shallowFirstOfRule(stmt, P.RULE_dmlStatementNoWith)) return "dml";
	return keywordCategory(stmt.start?.text ?? "");
}

/** Per-statement categories for every top-level unit of a parsed `multiStatement`, in source order —
 *  one entry per `multiStatementElement`, using the same per-element `statementCategory` lower() uses.
 *  Parity with the other dialects' `statementCategories`; feeds the corpus reclassifier. A legacy
 *  single-statement root (not a `multiStatement`) yields its one category; an empty batch yields []. */
export function statementCategories(tree: ParserRuleContext): StatementCategory[] {
	const elements = directChildrenOfRule(tree, P.RULE_multiStatementElement);
	if (elements.length === 0 && tree.ruleIndex !== P.RULE_multiStatement) {
		return [statementCategory(tree)];
	}
	// Recovery-swallowed statements append as "other" — honest count, no keyword guessing.
	return [...elements.map(statementCategory), ...swallowedCategories(tree)];
}

function lowerQuery(query: ParserRuleContext): QueryExpr {
	const ctesNode = directChildrenOfRule(query, P.RULE_ctes)[0];
	const ctes = ctesNode ? directChildrenOfRule(ctesNode, P.RULE_namedQuery).map(lowerNamedQuery) : [];

	// The main body is this query's own queryTerm — NOT the querySpecifications inside
	// the CTE bodies (which sit under `ctes`, earlier in the tree).
	const queryTerm = directChildrenOfRule(query, P.RULE_queryTerm)[0];
	// A broken / partial query CST may have no queryTerm child (e.g. "(((" mid-edit). Degrade to the
	// same flagged empty body the unmodeled-body branch produces — lower() never throws.
	if (!queryTerm) {
		const body: SelectExpr = {
			kind: "select",
			projections: [],
			from: [],
			columns: [],
			aggregated: false,
			unsupported: ["query-body"],
			cst: query,
		};
		return { kind: "query", ctes, body, cst: query };
	}
	const body = lowerQueryTerm(queryTerm);
	const orderBy = extractOrderBy(query);
	// ORDER BY references the body's output (a select's scope, or a set-op's left branch),
	// so its columns belong to the body's `columns` — for both selects and set ops.
	if (orderBy && body.kind !== "pipe") for (const o of orderBy) columnsOf(o, body.columns, "orderBy");
	const limit = extractLimit(query);
	return { kind: "query", ctes, body, orderBy, limit, cst: query };
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

/** The LIMIT / OFFSET row-limiting clause from the query's queryOrganization (grammar:
 *  `(LIMIT (ALL | expression))? (OFFSET expression)?`) — learn.microsoft.com/en-us/azure/databricks/
 *  sql/language-manual/sql-ref-syntax-qry-select-limit. `LIMIT ALL` is Spark's documented no-cap
 *  spelling (no row-count expression to carry); recorded as a present-but-unbounded clause, the
 *  same convention as postgres' extractLimit's `LIMIT ALL` handling. */
function extractLimit(query: ParserRuleContext): LimitInfo | undefined {
	const qo = directChildrenOfRule(query, P.RULE_queryOrganization)[0];
	if (!qo) return undefined;
	const info: LimitInfo = {};
	let any = false;
	let afterLimit = false;
	let afterOffset = false;
	for (let i = 0; i < qo.getChildCount(); i++) {
		const child = qo.getChild(i);
		if (!(child instanceof ParserRuleContext)) {
			const t = (child as TerminalNode | null)?.symbol?.type;
			if (t === P.LIMIT) {
				any = true;
				afterLimit = true;
			} else if (t === P.ALL) {
				afterLimit = false; // LIMIT ALL — no row cap; recorded as present-but-unbounded
			} else if (t === P.OFFSET) {
				any = true;
				afterOffset = true;
				afterLimit = false;
			}
			continue;
		}
		if (afterLimit && child.ruleIndex === P.RULE_expression) {
			info.top = lowerExpression(child);
			afterLimit = false;
		} else if (afterOffset && child.ruleIndex === P.RULE_expression) {
			info.offset = lowerExpression(child);
			afterOffset = false;
		}
	}
	return any ? info : undefined;
}

/** A queryTerm is a pipe (`queryTerm |> rhs`), a set operation (two queryTerm branches), or a select. */
function lowerQueryTerm(queryTerm: ParserRuleContext): QueryBody {
	// Pipe (Spark 4.0 `|>`): the queryTerm left-recurses — `((base |> op1) |> op2)`. Unwind the left
	// spine into the base relation (input) plus the operators in order, modelled as a faithful PipeExpr.
	if (directChildrenOfRule(queryTerm, P.RULE_operatorPipeRightSide)[0]) return lowerPipe(queryTerm);
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

// --- pipe operators (Spark 4.0 `|>`) ---------------------------------------------
// Spark's pipe operator set is a subset of GoogleSQL's; each operatorPipeRightSide lowers to a faithful
// PipeStage keeping its span (cst = the rhs node). The relation flows through the stages in scope.

/** Unwind a left-recursive pipe queryTerm (`((base |> op1) |> op2)`) into a PipeExpr. */
function lowerPipe(queryTerm: ParserRuleContext): PipeExpr {
	const rhsChain: ParserRuleContext[] = [];
	let cur = queryTerm;
	for (;;) {
		const rhs = directChildrenOfRule(cur, P.RULE_operatorPipeRightSide)[0];
		const left = directChildrenOfRule(cur, P.RULE_queryTerm)[0];
		if (rhs && left) {
			rhsChain.unshift(rhs);
			cur = left;
		} else break;
	}
	return { kind: "pipe", input: lowerQueryTerm(cur), stages: rhsChain.map(lowerSparkPipeRhs), cst: queryTerm };
}

function pipeProjCols(projections: Projection[]): ColumnRef[] {
	const cols: ColumnRef[] = [];
	for (const p of projections) columnsOf(p.expr, cols, "projection");
	return cols;
}

/** operatorPipeRightSide → a faithful PipeStage. */
function lowerSparkPipeRhs(rhs: ParserRuleContext): PipeStage {
	const namedSeqProjections = (): Projection[] => {
		const seq = directChildrenOfRule(rhs, P.RULE_namedExpressionSeq)[0];
		return seq ? directChildrenOfRule(seq, P.RULE_namedExpression).map(buildProjection) : [];
	};
	if (directTokenType(rhs, [P.EXTEND]) !== undefined) {
		const projections = namedSeqProjections();
		return { op: "extend", projections, columns: pipeProjCols(projections), cst: rhs };
	}
	if (directTokenType(rhs, [P.AGGREGATE]) !== undefined) {
		const aggregates = namedSeqProjections();
		const aggCtx = directChildrenOfRule(rhs, P.RULE_aggregationClause)[0];
		const groupBy = aggCtx ? extractGroupBy(aggCtx) : [];
		const columns = pipeProjCols(aggregates);
		for (const g of groupBy) columnsOf(g, columns, "groupBy");
		return { op: "aggregate", aggregates, groupBy, columns, cst: rhs };
	}
	// selectClause aggregationClause? windowClause? — `|> SELECT …` (trailing agg is an error case).
	const selectClause = directChildrenOfRule(rhs, P.RULE_selectClause)[0];
	if (selectClause) {
		const seq = directChildrenOfRule(selectClause, P.RULE_namedExpressionSeq)[0];
		const projections = seq ? directChildrenOfRule(seq, P.RULE_namedExpression).map(buildProjection) : [];
		return { op: "select", projections, columns: pipeProjCols(projections), cst: rhs };
	}
	const setSeq = directChildrenOfRule(rhs, P.RULE_operatorPipeSetAssignmentSeq)[0];
	if (setSeq) {
		const idents = directChildrenOfRule(setSeq, P.RULE_errorCapturingIdentifier);
		const exprs = directChildrenOfRule(setSeq, P.RULE_expression);
		const assignments: PipeSetItem[] = [];
		const columns: ColumnRef[] = [];
		for (let i = 0; i < exprs.length; i++) {
			const expr = lowerExpression(exprs[i]);
			assignments.push({ column: idents[i] ? idents[i].getText() : "", expr });
			columnsOf(expr, columns, "projection");
		}
		return { op: "set", assignments, columns, cst: rhs };
	}
	const dropList = directChildrenOfRule(rhs, P.RULE_multipartIdentifierList)[0];
	if (dropList) {
		const drop = directChildrenOfRule(dropList, P.RULE_multipartIdentifier).map((m) => lastNamePart(m.getText()));
		return { op: "drop", drop, cst: rhs };
	}
	if (directTokenType(rhs, [P.AS]) !== undefined) {
		const id = directChildrenOfRule(rhs, P.RULE_errorCapturingIdentifier)[0];
		return { op: "as", alias: id ? id.getText() : "", cst: rhs };
	}
	const whereCtx = directChildrenOfRule(rhs, P.RULE_whereClause)[0];
	if (whereCtx) {
		const predicate = lowerClausePredicate(whereCtx) ?? otherExpr(rhs);
		const columns: ColumnRef[] = [];
		columnsOf(predicate, columns, "where");
		return { op: "where", predicate, columns, cst: rhs };
	}
	if (shallowNodesOfRule(rhs, P.RULE_pivotClause)[0]) {
		const pivot = extractPivot(rhs);
		if (pivot) return { op: "pivot", pivot, cst: rhs };
	}
	if (shallowNodesOfRule(rhs, P.RULE_unpivotClause)[0]) {
		const unpivot = extractUnpivot(rhs);
		if (unpivot) return { op: "unpivot", unpivot, cst: rhs };
	}
	if (directChildrenOfRule(rhs, P.RULE_sample)[0]) return { op: "tablesample", cst: rhs };
	const join = directChildrenOfRule(rhs, P.RULE_joinRelation)[0];
	if (join) {
		const rel = directChildrenOfRule(join, P.RULE_relationPrimary)[0];
		const source: Source = rel ? buildSource(rel) : { kind: "table", relation: relationOf([]), cst: rhs };
		const joinConditions: Expr[] = [];
		const columns: ColumnRef[] = [];
		const crit = directChildrenOfRule(join, P.RULE_joinCriteria)[0];
		const bool = crit ? firstOfRule(crit, P.RULE_booleanExpression) : undefined;
		if (bool) {
			const e = lowerExpression(bool);
			joinConditions.push(e);
			columnsOf(e, columns, "join");
		}
		return {
			op: "join",
			source,
			joinConditions: joinConditions.length ? joinConditions : undefined,
			columns,
			cst: rhs,
		};
	}
	const setTok = directTokenType(rhs, [P.UNION, P.EXCEPT, P.SETMINUS, P.INTERSECT]);
	const qp = directChildrenOfRule(rhs, P.RULE_queryPrimary)[0];
	if (setTok !== undefined && qp) {
		const setOp = setTok === P.INTERSECT ? "intersect" : setTok === P.UNION ? "union" : "except";
		const all = directTokenType(rhs, [P.ALL]) !== undefined;
		return { op: "setop", setOp, all, operands: [queryPrimaryAsQuery(qp)], cst: rhs };
	}
	const qo = directChildrenOfRule(rhs, P.RULE_queryOrganization)[0];
	if (qo) return lowerPipeQueryOrg(qo, rhs);
	// Unreachable for known Spark pipe syntax — drift guard.
	return { op: "other", name: rhs.getText().slice(0, 24), cst: rhs };
}

/** A pipe set-op operand: queryPrimary → a QueryExpr. Mirrors lowerQueryTerm's queryPrimary handling
 *  (inline VALUES table, TABLE t shorthand, flagged fallback) so a pipe `|> UNION ALL VALUES (...)`
 *  operand lowers the same way a top-level VALUES body does, instead of silently landing on a bare
 *  empty, unflagged SelectExpr (body-non-emptiness probe finding, tests/helpers/body-probe.ts). */
function queryPrimaryAsQuery(qp: ParserRuleContext): QueryExpr {
	const inner = directChildrenOfRule(qp, P.RULE_query)[0];
	if (inner) return lowerQuery(inner);
	const spec = directChildrenOfRule(qp, P.RULE_querySpecification)[0];
	if (spec) return { kind: "query", ctes: [], body: buildSelect(spec), cst: qp };
	// VALUES (1,'a'),(2,'b') [AS v(x,y)] — an inline table, same as lowerQueryTerm's handling.
	const inlineTable = directChildrenOfRule(qp, P.RULE_inlineTable)[0];
	if (inlineTable) return { kind: "query", ctes: [], body: buildInlineTable(inlineTable), cst: qp };
	// TABLE t — shorthand for SELECT * FROM t.
	if (directTokenType(qp, [P.TABLE]) !== undefined)
		return { kind: "query", ctes: [], body: buildTableShorthand(qp), cst: qp };
	// Any other body shape: flag it — a valid parse must never throw (mirrors lowerQueryTerm's fallback).
	const body: QueryBody = {
		kind: "select",
		projections: [],
		from: [],
		columns: [],
		aggregated: false,
		unsupported: ["query-body"],
		cst: qp,
	};
	return { kind: "query", ctes: [], body, cst: qp };
}

/** queryOrganization as a pipe stage: ORDER BY → orderBy, else LIMIT → limit. */
function lowerPipeQueryOrg(qo: ParserRuleContext, cst: ParserRuleContext): PipeStage {
	const keys: Expr[] = [];
	let inOrder = false;
	let limitExpr: Expr | undefined;
	for (let i = 0; i < qo.getChildCount(); i++) {
		const c = qo.getChild(i);
		if (!(c instanceof ParserRuleContext)) {
			const t = (c as TerminalNode | null)?.symbol?.type;
			if (t === P.ORDER) inOrder = true;
			else if (t === P.CLUSTER || t === P.DISTRIBUTE || t === P.SORT) inOrder = false;
			else if (t === P.LIMIT) {
				inOrder = false;
				const nx = qo.getChild(i + 1);
				if (nx instanceof ParserRuleContext && nx.ruleIndex === P.RULE_expression)
					limitExpr = lowerExpression(nx);
			}
			continue;
		}
		if (inOrder && c.ruleIndex === P.RULE_sortItem) {
			const e = firstOfRule(c, P.RULE_expression);
			if (e) keys.push(lowerExpression(e));
		}
	}
	if (keys.length) {
		const columns: ColumnRef[] = [];
		for (const k of keys) columnsOf(k, columns, "orderBy");
		return { op: "orderBy", keys, columns, cst };
	}
	if (limitExpr) return { op: "limit", limit: { top: limitExpr }, cst };
	return { op: "orderBy", keys: [], columns: [], cst };
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
	// Rows after the first, per-column, parallel to `projections` (SelectExpr.moreRows): kept
	// so a column's type can union across rows instead of echoing row 1.
	const moreRows: Expr[][] = rows.slice(1).map((row) => {
		let rctor: ParserRuleContext | undefined;
		let rcur: ParseTree | null = row;
		while (rcur instanceof ParserRuleContext) {
			if (rcur instanceof RowConstructorContext) {
				rctor = rcur;
				break;
			}
			if (rcur.getChildCount() !== 1) break;
			rcur = rcur.getChild(0);
		}
		const exprs = rctor
			? directChildrenOfRule(rctor, P.RULE_namedExpression).map(
					(n) => directChildrenOfRule(n, P.RULE_expression)[0] ?? n,
				)
			: [row];
		return exprs.map((e) => lowerExpression(e));
	});
	const columns: ColumnRef[] = [];
	for (const p of projections) columnsOf(p.expr, columns, "projection");
	return {
		kind: "select",
		projections,
		from: [],
		columns,
		aggregated: false,
		...(moreRows.length ? { moreRows } : {}),
		cst: inlineTable,
	};
}

/** `TABLE t` — shorthand for `SELECT * FROM t`. */
function buildTableShorthand(queryPrimary: ParserRuleContext): SelectExpr {
	const multipart = firstOfRule(queryPrimary, P.RULE_multipartIdentifier);
	const partNodes = multipart ? directChildrenOfRule(multipart, P.RULE_errorCapturingIdentifier) : [];
	const name = partNodes.length ? partNodes.map((p) => p.getText()) : [];
	const namePartSpans = partNodes.length ? partSpansOf(partNodes) : undefined;
	const star: Expr = { kind: "star", cst: queryPrimary };
	return {
		kind: "select",
		projections: [{ isStar: true, expr: star, cst: queryPrimary }],
		from: [{ kind: "table", relation: relationOf(name), namePartSpans, cst: queryPrimary }],
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
	const nameNode = directChildrenOfRule(namedQuery, P.RULE_errorCapturingIdentifier)[0];
	const name = nameNode?.getText() ?? "";
	const innerQuery = firstOfRule(namedQuery, P.RULE_query);
	// A broken / partial CTE may have no query body (e.g. "WITH x AS ( SELECT" mid-edit). Emit the CTE
	// with a flagged empty body so the enclosing query still lowers — lower() never throws.
	const body: QueryExpr = innerQuery
		? lowerQuery(innerQuery)
		: {
				kind: "query",
				ctes: [],
				body: {
					kind: "select",
					projections: [],
					from: [],
					columns: [],
					aggregated: false,
					unsupported: ["query-body"],
					cst: namedQuery,
				},
				cst: namedQuery,
			};
	return {
		name,
		nameCst: nameNode,
		columnAliases: columnAliasList(namedQuery),
		body,
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

	// ON predicates are lowered ONCE here and shared: `joinConditions` (byte-identical to before) and
	// each Join.on hold the SAME Expr object (looked up by the ON CST via onByCst).
	const joinConditions: Expr[] = [];
	const onByCst = new Map<ParserRuleContext, Expr>();
	if (fromClause) extractJoinConditions(fromClause, joinConditions, onByCst);
	const joins = fromClause ? buildJoins(fromClause, from, onByCst) : [];

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
		joins: joins.length ? joins : undefined,
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

/** ON predicates (joinCriteria -> ON booleanExpression) at this query level, lowered in tree order.
 *  Fills `out` (the joinConditions array, unchanged from before) AND records each ON's Expr keyed by its
 *  booleanExpression CST, so buildJoins can attach the SAME Expr object to the matching Join (no re-lower,
 *  reference-equal). */
function extractJoinConditions(
	fromClause: ParserRuleContext,
	out: Expr[],
	onByCst: Map<ParserRuleContext, Expr>,
): void {
	for (const jc of shallowNodesOfRule(fromClause, P.RULE_joinCriteria)) {
		const bool = firstOfRule(jc, P.RULE_booleanExpression);
		if (!bool) continue;
		const e = lowerExpression(bool);
		out.push(e);
		onByCst.set(bool, e);
	}
}

/** The FROM-clause JOIN chain as Join[]: one per joinRelation, in source order. `join.source` is the
 *  reference-identical `from` entry (matched by the right relationPrimary CST); `join.on` is the shared
 *  ON Expr from onByCst. Comma-separated relations and lateral views are not joins. */
function buildJoins(fromClause: ParserRuleContext, from: Source[], onByCst: Map<ParserRuleContext, Expr>): Join[] {
	const sourceByCst = new Map<ParserRuleContext, Source>();
	for (const s of from) sourceByCst.set(s.cst, s);
	const joins: Join[] = [];
	for (const relation of directChildrenOfRule(fromClause, P.RULE_relation)) {
		for (const ext of directChildrenOfRule(relation, P.RULE_relationExtension)) {
			const jr = directChildrenOfRule(ext, P.RULE_joinRelation)[0];
			if (!jr) continue; // pivot/unpivot extension, not a join
			const rightRp = directChildrenOfRule(jr, P.RULE_relationPrimary)[0];
			const source = rightRp ? sourceByCst.get(rightRp) : undefined;
			if (!source) continue;
			const { kind, natural } = databricksJoinKind(jr);
			const lateral = directTokenType(jr, [P.LATERAL]) !== undefined;
			const crit = directChildrenOfRule(jr, P.RULE_joinCriteria)[0];
			let on: Expr | undefined;
			let using: string[] | undefined;
			if (crit) {
				const bool = firstOfRule(crit, P.RULE_booleanExpression);
				if (bool) on = onByCst.get(bool);
				else using = columnAliasList(crit);
			}
			joins.push({
				kind,
				source,
				on,
				using,
				natural: natural || undefined,
				lateral: lateral || undefined,
				cst: jr,
			});
		}
	}
	return joins;
}

/** Kind + NATURAL flag for a Spark `joinRelation`. joinType carries CROSS / LEFT SEMI / LEFT ANTI /
 *  LEFT|RIGHT|FULL OUTER? / INNER; a bare NATURAL JOIN (empty joinType) → kind "natural". */
function databricksJoinKind(jr: ParserRuleContext): { kind: JoinKind; natural: boolean } {
	const natural = directTokenType(jr, [P.NATURAL]) !== undefined;
	const jt = directChildrenOfRule(jr, P.RULE_joinType)[0];
	const has = (tok: number): boolean => jt !== undefined && directTokenType(jt, [tok]) !== undefined;
	let ansi: JoinKind | undefined;
	// SEMI/ANTI first: `LEFT SEMI`/`LEFT ANTI` carry a leading LEFT that must not win over the modifier.
	if (has(P.CROSS)) ansi = "cross";
	else if (has(P.SEMI)) ansi = "semi";
	else if (has(P.ANTI)) ansi = "anti";
	else if (has(P.LEFT)) ansi = "left";
	else if (has(P.RIGHT)) ansi = "right";
	else if (has(P.FULL)) ansi = "full";
	else if (has(P.INNER)) ansi = "inner";
	return { kind: ansi ?? (natural ? "natural" : "inner"), natural };
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
			return (
				hasAggregate(expr.base) ||
				(expr.index !== undefined && hasAggregate(expr.index)) ||
				(expr.end !== undefined && hasAggregate(expr.end)) ||
				(expr.step !== undefined && hasAggregate(expr.step))
			);
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
		// `AS IDENTIFIER('col1')` — the alias identifier itself can be the identifier clause;
		// resolve it to the name it constantly names (identifierLiteralText), else keep the
		// raw constructor text as today (a non-constant argument, e.g. a session variable).
		name = identifierLiteralText(alias) ?? alias.getText(); // explicit alias wins
	} else if (expr.kind === "column") {
		name = expr.parts[expr.parts.length - 1]; // output name is the column's last part
	}
	return {
		name,
		isStar: expr.kind === "star",
		expr: exprCtx ? lowerExpression(exprCtx) : otherExpr(named),
		// namedExpression: expression (AS? errorCapturingIdentifier | identifierList)? — the
		// errorCapturingIdentifier is the alias identifier alone (AS is its sibling token).
		...(alias ? { aliasCst: alias } : {}),
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
		return parts ? { kind: "column", parts, partSpans: columnPartSpans(node), cst: node } : otherExpr(node);
	}
	if (node instanceof StarContext) {
		return { kind: "star", qualifier: starQualifier(node), exclude: starExclude(node), cst: node };
	}
	if (node instanceof ConstantDefaultContext) return lowerConstant(node);
	if (node instanceof FunctionCallContext) {
		// A bare `IDENTIFIER('c1')` parses ambiguously as a call to a function literally named
		// IDENTIFIER (see identifierClauseParts) — resolve it to the column it names before
		// falling back to an ordinary function call.
		const idParts = identifierClauseParts(node);
		return idParts ? { kind: "column", parts: idParts, cst: node } : lowerFunction(node);
	}
	if (node instanceof SearchedCaseContext || node instanceof SimpleCaseContext) return lowerCase(node);
	if (node instanceof CastContext || node instanceof CastByColonContext) {
		const inner =
			directOfRule(node, P.RULE_expression) ??
			directOfRule(node, P.RULE_valueExpression) ??
			directOfRule(node, P.RULE_primaryExpression);
		const dt = directOfRule(node, P.RULE_dataType);
		return {
			kind: "cast",
			expr: inner ? lowerExpression(inner) : otherExpr(node),
			typeText: dt?.getText() ?? "",
			// `TRY_CAST(x AS t)` is the try form of the `#cast` alternative (CAST | TRY_CAST).
			...(directTokenType(node, [P.TRY_CAST]) !== undefined ? { try: true } : {}),
			cst: node,
		};
	}
	// `expr ?:: <type>` — the try-cast operator; models like a cast, flagged `try`.
	if (node instanceof TryCastByColonContext) {
		const inner = directOfRule(node, P.RULE_primaryExpression);
		const dt = directOfRule(node, P.RULE_dataType);
		return {
			kind: "cast",
			expr: inner ? lowerExpression(inner) : otherExpr(node),
			typeText: dt?.getText() ?? "",
			try: true,
			cst: node,
		};
	}
	// `expr : <complex type>` — type ascription (a typed value, e.g. `NULL:MAP<STRING,STRING>`);
	// models as a plain cast to the ascribed type.
	if (node instanceof TypeAscriptionContext) {
		const inner = directOfRule(node, P.RULE_primaryExpression);
		const asc = directOfRule(node, P.RULE_complexTypeArgumented);
		return {
			kind: "cast",
			expr: inner ? lowerExpression(inner) : otherExpr(node),
			typeText: asc?.getText() ?? "",
			cst: node,
		};
	}
	// `COLLATION FOR (expr)` — the SQL-standard collation accessor; a unary function of its arg.
	if (node instanceof CollationForContext) {
		const inner = firstOfRule(node, P.RULE_expression);
		return {
			kind: "function",
			name: "collation for",
			args: inner ? [lowerExpression(inner)] : [],
			aggregate: false,
			distinct: false,
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

/** `constant` (dispatched through its `#constantDefault` wrapper) — every alt but the two bind-
 *  parameter markers stays a plain literal, as before. `?` -> parameter (no name/ordinal, per
 *  docs.databricks.com/en/sql/language-manual/sql-ref-parameter-marker.html); `:name` -> parameter
 *  with the leading `:` stripped (the identifier keeps its own delimiters as written, matching this
 *  dialect's keep-not-strip convention). `IDENTIFIER(:p)` never reaches here — it's a function-call
 *  shape handled earlier in lowerExpression. */
function lowerConstant(node: ConstantDefaultContext): Expr {
	const constant = node.constant();
	if (constant instanceof PosParameterLiteralContext) {
		return { kind: "parameter", text: node.getText(), cst: node };
	}
	if (constant instanceof NamedParameterLiteralContext) {
		const name = constant.namedParameterMarker().simpleIdentifier().getText();
		return { kind: "parameter", text: node.getText(), name, cst: node };
	}
	return { kind: "literal", text: node.getText(), cst: node };
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
	const argCtxs = directChildrenOfRule(node, P.RULE_functionArgument);
	const args = argCtxs.map((a) => {
		const e = firstOfRule(a, P.RULE_expression);
		return e ? lowerExpression(e) : otherExpr(a);
	});
	// Named-argument invocation `fn(name => value)`: capture the parameter name per arg so the
	// `name =>` is conservation-visible. Only set when at least one arg is named. The key is a
	// multipartIdentifier (Databricks allows a dotted key, e.g. `databricks.connection => …` in
	// read_files/ai_parse_document options); read its full text so a qualifier is never dropped.
	const argNames = argCtxs.map((a) => {
		const named = shallowFirstOfRule(a, P.RULE_namedArgumentExpression);
		return named ? firstOfRule(named, P.RULE_multipartIdentifier)?.getText() : undefined;
	});
	const windowCtx = firstOfRule(node, P.RULE_windowSpec);
	return {
		kind: "function",
		name,
		args,
		...(argNames.some((n) => n !== undefined) ? { argNames } : {}),
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

/** Descend through single-child expression wrappers (expression -> booleanExpression ->
 *  valueExpression -> ...) down to the primaryExpression node; undefined once any level
 *  branches (an operator, a call, a predicate means it is not a bare primary). Shared by
 *  classifyExpression and the IDENTIFIER-clause constant-argument check below. */
function singleChildPrimary(expr: ParserRuleContext): PrimaryExpressionContext | undefined {
	let node: ParserRuleContext = expr;
	while (!(node instanceof PrimaryExpressionContext)) {
		if (node.getChildCount() !== 1) return undefined;
		const only = node.getChild(0);
		if (!(only instanceof ParserRuleContext)) return undefined;
		node = only;
	}
	return node;
}

/**
 * Decide, from the tree, whether a select expression is a plain column reference
 * (`a`, `t.a`, `a.b.c`), a star (`*`, `t.*`), or a compound expression. Descends
 * through the single-child expression wrappers; any branching (an operator, a
 * call, a predicate) means it is not a bare column/star.
 */
function classifyExpression(expr: ParserRuleContext): ClassifiedExpr {
	const node = singleChildPrimary(expr);
	if (!node) return { kind: "expr" };
	if (node instanceof StarContext) return { kind: "star" };
	// A bare IDENTIFIER('c1') parses as a call to a function literally named IDENTIFIER
	// (see identifierClauseParts) — a constant-string argument makes it a column, not a call.
	if (node instanceof FunctionCallContext) {
		const idParts = identifierClauseParts(node);
		if (idParts) return { kind: "column", parts: idParts };
	}
	const parts = columnParts(node);
	return parts ? { kind: "column", parts } : { kind: "expr" };
}

/** Collect column references out of a modelled Expr tree. The single source of truth for
 *  `SelectExpr.columns`. Stops at nested subqueries (their columns belong to that scope);
 *  for an unmodelled `other` node, falls back to a CST walk so its columns are not lost. */
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
			if (expr.index) columnsOf(expr.index, acc, clause);
			if (expr.end) columnsOf(expr.end, acc, clause);
			if (expr.step) columnsOf(expr.step, acc, clause);
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
				acc.push({ kind: "columnref", parts, clause, cst: child, partSpans: columnPartSpans(child) });
				continue;
			}
		}
		cstColumnRefs(child, acc, clause);
	}
}

/** Per-part spans PARALLEL to columnParts(primary) — each identifier's own token (backticks included),
 *  all-or-nothing: undefined when the primary isn't a pure column-path chain. One shared span-capture
 *  seam (reused by the editor-gold identifier-folding rewrite). */
function columnPartSpans(primary: PrimaryExpressionContext) {
	const nodes = columnPartNodes(primary);
	return nodes ? partSpansOf(nodes) : undefined;
}

function columnPartNodes(primary: PrimaryExpressionContext): ParseTree[] | undefined {
	if (primary instanceof ColumnReferenceContext) return [primary.identifier()];
	if (primary instanceof DereferenceContext) {
		const base = columnPartNodes(primary.primaryExpression());
		if (!base) return undefined;
		return [...base, primary.identifier()];
	}
	return undefined;
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

// ---------------------------------------------------------------------------
// The IDENTIFIER(expr) clause, constant-string case only.
// https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-names-identifier-clause :
// "identifierExpr: A constant STRING expression... When strLiteral is a constant, ... it is
// exactly equivalent to specifying the identifier represented by str directly." Never-wrong: a
// non-constant argument (a column, a bind parameter, `||` concatenation) is left exactly as
// today — an unresolved function call / the raw constructor text — never a guess.
//
// Two call sites need this, because the grammar routes the SAME clause through two different
// CST shapes (grammars/databricks/DatabricksParser.g4, not touched here):
//   - wherever a plain `identifier` is expected (a column alias, `errorCapturingIdentifier`),
//     `strictIdentifier` has a dedicated `#identifierLiteral` alt for it;
//   - a BARE `IDENTIFIER('c1')` value (no surrounding alias/dot) instead parses as a call to a
//     function literally named IDENTIFIER (`functionName`'s `identFunc=IDENTIFIER_KW` alt) —
//     Databricks has no such function, so with a constant-string argument this is always the
//     clause, never a real call.
// A `FROM IDENTIFIER('t')` table reference uses a THIRD, still different shape
// (`identifierReference`'s own `IDENTIFIER_KW LEFT_PAREN expression RIGHT_PAREN` alt) — out of
// scope here; see buildSource.
// ---------------------------------------------------------------------------

/** Resolve `IDENTIFIER('literal')` wherever it parses as `strictIdentifier`'s `#identifierLiteral`
 *  alt somewhere under `node` (an errorCapturingIdentifier, typically) to the identifier it
 *  constantly names; undefined when `node` isn't that shape at all, the argument isn't constant,
 *  or the constant names a MULTI-part path (an alias position takes one identifier, never a path). */
function identifierLiteralText(node: ParseTree): string | undefined {
	const ident = firstOfRule(node, P.RULE_identifier);
	const strict = ident && firstOfRule(ident, P.RULE_strictIdentifier);
	if (!(strict instanceof IdentifierLiteralContext)) return undefined;
	const text = identifierClauseText(strict.stringLit());
	if (text === undefined) return undefined;
	const parts = splitIdentifierClauseText(text);
	return parts && parts.length === 1 ? parts[0] : undefined;
}

/** `IDENTIFIER('c1')` used as a bare value parses as a call to a function literally named
 *  IDENTIFIER — the SAME token sequence `#identifierLiteral` also matches. Returns the resolved
 *  name parts when the lone argument is a constant string (`'a.b'` → `["a", "b"]`, per
 *  sql-ref-names-identifier-clause); undefined for anything else (a different function name, more
 *  than one argument, DISTINCT/OVER/FILTER/WITHIN GROUP, or a non-constant argument), so the caller
 *  falls back to an ordinary function-call lowering. */
function identifierClauseParts(node: FunctionCallContext): string[] | undefined {
	const fn = node.functionName();
	if (!fn.IDENTIFIER_KW() || fn.expression() || fn.qualifiedName()) return undefined;
	if (node.setQuantifier() || node.windowSpec() || node.FILTER() || node.WITHIN()) return undefined;
	const args = node.functionArgument();
	if (args.length !== 1) return undefined;
	const argExpr = args[0].expression();
	const text = argExpr ? constantStringExprText(argExpr) : undefined;
	return text !== undefined ? splitIdentifierClauseText(text) : undefined;
}

/** The constant string an `expression` node reduces to, or undefined if it is anything else
 *  (a column, a bind parameter, `||` concatenation, ...) — see identifierClauseText for what
 *  "constant" means. */
function constantStringExprText(exprCtx: ParserRuleContext): string | undefined {
	const primary = singleChildPrimary(exprCtx);
	if (!(primary instanceof ConstantDefaultContext)) return undefined;
	const constant = primary.constant();
	return constant instanceof StringLiteralContext ? identifierClauseText(constant.stringLit()) : undefined;
}

/**
 * A `stringLit` (`singleStringLit+` — one or more literal/parameter-marker segments coalesced)
 * resolved to its constant text, or undefined when it isn't constant:
 *   - ANY segment is a parameter marker (`:name`/`?`) — resolved at execution time, not constant.
 *   - ANY segment carries a backslash/doubled-quote escape (unquoteSimpleStringLiteral): decoding
 *     Spark's full string-literal escape table is out of scope for identifier resolution, so an
 *     escaped literal stays unresolved rather than a guess.
 * Splitting the text into name parts (dots outside backticks) is `splitIdentifierClauseText`'s job.
 */
function identifierClauseText(stringLitCtx: StringLitContext): string | undefined {
	let text = "";
	for (const single of stringLitCtx.singleStringLit()) {
		const lit = single.singleStringLitWithoutMarker();
		if (!lit) return undefined; // a parameter-marker segment -> not constant
		const body = unquoteSimpleStringLiteral(lit.getText());
		if (body === undefined) return undefined;
		text += body;
	}
	return text.length > 0 ? text : undefined;
}

/**
 * Split an IDENTIFIER() clause's resolved constant text into name parts.
 * docs.databricks.com/aws/en/sql/language-manual/sql-ref-names-identifier-clause's own example is a
 * qualified table name, `` '`default`.`tab1`' ``: a dot OUTSIDE a backtick-quoted segment separates
 * parts, same as writing the path directly (`IDENTIFIER('a.b')` names table `a`, column `b`). A
 * backtick-quoted segment is one part and keeps ITS OWN backticks in the part text (identifier-
 * delimiter-contract.md's databricks row: `ColumnRef.parts` keeps delimiters, never strips them).
 * Declines (returns undefined) on anything not confidently a plain dotted/backtick-quoted path: an
 * unterminated backtick, or an empty part from a leading/trailing/doubled dot, never a guess.
 */
function splitIdentifierClauseText(text: string): string[] | undefined {
	const parts: string[] = [];
	let current = "";
	let inBacktick = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inBacktick) {
			if (c === "`") {
				if (text[i + 1] === "`") {
					current += "``"; // an escaped backtick within the segment, stays in the segment
					i++;
				} else {
					current += "`"; // the closing delimiter
					inBacktick = false;
				}
			} else {
				current += c;
			}
			continue;
		}
		if (c === "`") {
			current += "`"; // the opening delimiter
			inBacktick = true;
		} else if (c === ".") {
			if (!current) return undefined; // a leading or doubled dot, no part precedes it
			parts.push(current);
			current = "";
		} else {
			current += c;
		}
	}
	if (inBacktick) return undefined; // an unterminated backtick-quoted segment
	if (!current) return undefined; // a trailing dot
	parts.push(current);
	return parts;
}

/** Strip one STRING_LITERAL/DOUBLEQUOTED_STRING token's delimiters (grammars/databricks/
 *  DatabricksLexer.g4's STRING_LITERAL/DOUBLEQUOTED_STRING). `R'...'`/`R"..."` raw strings have no
 *  escaping by definition. Otherwise declines — rather than guesses — whenever the body carries a
 *  backslash or doubled-quote escape: decoding Spark's full string-literal escape table is out of
 *  scope for identifier resolution; an escaped literal just stays unresolved, as today. */
function unquoteSimpleStringLiteral(raw: string): string | undefined {
	if (raw.startsWith("R'") && raw.endsWith("'")) return raw.slice(2, -1);
	if (raw.startsWith('R"') && raw.endsWith('"')) return raw.slice(2, -1);
	const quote = raw[0];
	if ((quote !== "'" && quote !== '"') || !raw.endsWith(quote) || raw.length < 2) return undefined;
	const body = raw.slice(1, -1);
	return body.includes("\\") || body.includes(quote + quote) ? undefined : body;
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
	// `VALUES (...), (...) AS alias(cols)` as a relationPrimary (#inlineTableDefault2) nests its own
	// tableAlias INSIDE the inlineTable node, one level below relationPrimary's direct children.
	const inlineTable = firstOfRule(relationPrimary, P.RULE_inlineTable);
	const tableAlias =
		directChildrenOfRule(relationPrimary, P.RULE_tableAlias)[0] ??
		(inlineTable ? directChildrenOfRule(inlineTable, P.RULE_tableAlias)[0] : undefined);
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

	// An inline table constructor used as a FROM-clause relation: lower its rows the same way as a
	// top-level VALUES query body (buildInlineTable already names each projection from the alias's
	// own column list) and expose the result as a subquery source, so `SELECT *` expands against ITS
	// OWN named projections (schema-free) instead of falling into the generic multipartIdentifier
	// branch below — which has nothing to read here and previously produced an anonymous EMPTY-named
	// "table" source that any real schema misses as unknown-table (Spark-goldens gate, 2026-07-21).
	if (inlineTable) {
		return {
			kind: "subquery",
			query: { kind: "query", ctes: [], body: buildInlineTable(inlineTable), cst: inlineTable },
			alias,
			aliasCst,
			cst: relationPrimary,
		};
	}

	const multipart = firstOfRule(relationPrimary, P.RULE_multipartIdentifier);
	const partNodes = multipart ? directChildrenOfRule(multipart, P.RULE_errorCapturingIdentifier) : [];
	const parts = partNodes.length ? partNodes.map((p) => p.getText()) : multipart ? [multipart.getText()] : [];
	const namePartSpans = partNodes.length ? partSpansOf(partNodes) : multipart ? partSpansOf([multipart]) : undefined;
	return {
		kind: "table",
		relation: relationOf(parts),
		namePartSpans,
		alias,
		aliasCst,
		columnAliases,
		cst: relationPrimary,
	};
}
