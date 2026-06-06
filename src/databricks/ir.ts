import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import {
  ArithmeticBinaryContext,
  ArithmeticUnaryContext,
  CastByColonContext,
  CastContext,
  ColumnReferenceContext,
  ComparisonContext,
  ConstantDefaultContext,
  DatabricksParser as P,
  DereferenceContext,
  ExistsContext,
  FunctionCallContext,
  LogicalBinaryContext,
  LogicalNotContext,
  ParenthesizedExpressionContext,
  PrimaryExpressionContext,
  SearchedCaseContext,
  ShiftExpressionContext,
  SimpleCaseContext,
  StarContext,
  SubqueryExpressionContext,
} from "../generated/databricks/DatabricksParser.js";

// ---------------------------------------------------------------------------
// IR — a compact semantic model lowered from the deep Databricks CST. Every node
// keeps a back-reference to its CST context (`cst`) so exact source spans remain
// available (cst.start / cst.stop). Scope and qualify operate on this, not the CST.
//
// OPEN GAP (not a scope decision): expressions are NOT modelled yet. `a+b`, CASE,
// function calls, aggregates, window/OVER, GROUP BY/HAVING semantics are opaque —
// today we only extract ColumnRefs + a projection name. This is roughly half of
// SQL's meaning and is unfinished work, tracked in docs/PLAN.md "Open Gaps". Do not
// treat it as descoped.
// ---------------------------------------------------------------------------

export interface QueryExpr {
  kind: "query";
  ctes: CteDef[];
  body: QueryBody;
  /** ORDER BY sort expressions (from the query's queryOrganization), if present. */
  orderBy?: Expr[];
  cst: ParserRuleContext;
}

export type QueryBody = SelectExpr | SetOpExpr;

export interface SelectExpr {
  kind: "select";
  projections: Projection[];
  from: Source[];
  /** Every column reference at this query level (projections, WHERE, JOIN ON, …),
   *  excluding those inside nested subqueries (which belong to their own scope). */
  columns: ColumnRef[];
  /** The WHERE predicate, modelled. */
  where?: Expr;
  /** JOIN ON predicates at this query level, modelled. */
  joinConditions?: Expr[];
  /** GROUP BY expressions, if present. */
  groupBy?: Expr[];
  /** The HAVING predicate, modelled. */
  having?: Expr;
  /** True when the query aggregates: a GROUP BY, or an aggregate function in the projections/HAVING. */
  aggregated: boolean;
  /** Scalar / IN / EXISTS subqueries appearing in this select's expressions (SELECT list,
   *  WHERE, …) — not the FROM sources. Scoped as children so their (possibly correlated)
   *  columns resolve. */
  subqueries?: QueryExpr[];
  /** A PIVOT applied to the FROM relation, if present (transforms the output columns). */
  pivot?: PivotInfo;
  /** An UNPIVOT applied to the FROM relation, if present. */
  unpivot?: UnpivotInfo;
  /** Constructs present here that the IR still does not model — a flag so consumers
   *  know this block is incomplete rather than trusting it silently. Absent when none. */
  unsupported?: string[];
  cst: ParserRuleContext;
}

export interface PivotInfo {
  /** Output column names produced by the pivot (the IN-list aliases/values). */
  values: string[];
  /** The FOR column(s), consumed by the pivot. */
  forColumns: string[];
  /** Columns referenced by the aggregate(s), consumed by the pivot. */
  aggColumns: string[];
}

export interface UnpivotInfo {
  /** The value column the unpivot produces. */
  valueColumn: string;
  /** The name column the unpivot produces. */
  nameColumn: string;
  /** The input columns consumed (turned into rows). */
  removed: string[];
}

export type Clause = "projection" | "where" | "join" | "groupBy" | "having" | "orderBy";

export interface ColumnRef {
  /** Reference parts as written: ["c"], ["t","c"], or ["a","b","c"]. */
  parts: string[];
  /** Which clause the reference appears in — GROUP BY/HAVING/ORDER BY may reference a select alias. */
  clause: Clause;
  cst: ParserRuleContext;
}

// ---------------------------------------------------------------------------
// Expression IR. Every select expression lowers to a typed Expr node — common
// forms are modelled; anything not yet modelled is an explicit `other` node
// (never silently dropped), so the gap is visible and measurable.
// ---------------------------------------------------------------------------

export type Expr =
  | { kind: "column"; parts: string[]; cst: ParserRuleContext }
  | { kind: "literal"; text: string; cst: ParserRuleContext }
  | { kind: "star"; cst: ParserRuleContext }
  | { kind: "binary"; op: string; left: Expr; right: Expr; cst: ParserRuleContext }
  | { kind: "unary"; op: string; operand: Expr; cst: ParserRuleContext }
  | {
      kind: "function";
      name: string;
      args: Expr[];
      /** Heuristic: name is in a known-aggregate set (sum/count/avg/…). */
      aggregate: boolean;
      distinct: boolean;
      /** Present when the call has an OVER clause (a window function). */
      window?: WindowSpec;
      cst: ParserRuleContext;
    }
  | { kind: "case"; whens: { when: Expr; then: Expr }[]; elseExpr?: Expr; cst: ParserRuleContext }
  | { kind: "cast"; expr: Expr; typeText: string; cst: ParserRuleContext }
  | { kind: "subquery"; query: QueryExpr; cst: ParserRuleContext }
  | { kind: "exists"; query: QueryExpr; cst: ParserRuleContext }
  /** An expression the IR does not model yet — kept, not dropped. */
  | { kind: "other"; text: string; cst: ParserRuleContext };

export interface WindowSpec {
  partitionBy: Expr[];
  orderBy: Expr[];
  cst: ParserRuleContext;
}

export interface SetOpExpr {
  kind: "setop";
  op: "union" | "except" | "intersect";
  /** true for ALL (e.g. UNION ALL); false for the default DISTINCT. */
  all: boolean;
  left: QueryBody;
  right: QueryBody;
  /** Union-level column references (e.g. a trailing ORDER BY) that resolve against the
   *  set-op output (the left branch's columns). */
  columns: ColumnRef[];
  cst: ParserRuleContext;
}

export interface Projection {
  /** Output column name: explicit alias, or the column name for a bare column ref. */
  name?: string;
  isStar: boolean;
  /** The projected expression, modelled. */
  expr: Expr;
  cst: ParserRuleContext;
}

export type Source = TableSource | SubquerySource | LateralViewSource;

export interface LateralViewSource {
  kind: "lateral";
  /** The lateral view's table alias (`LATERAL VIEW explode(x) v AS c` → "v"). */
  alias?: string;
  /** The columns it exposes (the AS list — `… AS c1, c2`). */
  columns: string[];
  cst: ParserRuleContext;
}

export interface TableSource {
  kind: "table";
  /** Multipart name parts as written, e.g. ["catalog","schema","t"]. */
  name: string[];
  alias?: string;
  /** Inline column aliases, e.g. `t AS u (c1, c2)` → ["c1","c2"]. */
  columnAliases?: string[];
  cst: ParserRuleContext;
}

export interface SubquerySource {
  kind: "subquery";
  query: QueryExpr;
  alias?: string;
  /** Inline column aliases, e.g. `(…) s (c1, c2)` → ["c1","c2"]. */
  columnAliases?: string[];
  cst: ParserRuleContext;
}

export interface CteDef {
  name: string;
  /** Declared column aliases, e.g. `WITH c (x, y) AS (…)` → ["x","y"]; these rename the CTE's outputs. */
  columnAliases?: string[];
  body: QueryExpr;
  cst: ParserRuleContext;
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
    return { kind: "query", ctes: [], body, cst: tree };
  }
  return lowerQuery(query);
}

function lowerQuery(query: ParserRuleContext): QueryExpr {
  const ctesNode = directChildrenOfRule(query, P.RULE_ctes)[0];
  const ctes = ctesNode
    ? directChildrenOfRule(ctesNode, P.RULE_namedQuery).map(lowerNamedQuery)
    : [];

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

  const querySpec = firstOfRule(queryTerm, P.RULE_querySpecification);
  if (!querySpec) throw new Error("lower: queryTerm has no querySpecification");
  return buildSelect(querySpec);
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
  // Each clause must be THIS query's own — never one nested inside a subquery in
  // the select/where list. The top-level projections are the direct children of
  // the select's namedExpressionSeq (not namedExpressions nested in subqueries).
  const selectClause = shallowFirstOfRule(querySpec, P.RULE_selectClause);
  const seq = selectClause ? shallowFirstOfRule(selectClause, P.RULE_namedExpressionSeq) : undefined;
  const projections = seq
    ? directChildrenOfRule(seq, P.RULE_namedExpression).map(buildProjection)
    : [];

  const fromClause = shallowFirstOfRule(querySpec, P.RULE_fromClause);
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

  const whereCtx = shallowFirstOfRule(querySpec, P.RULE_whereClause);
  const where = whereCtx ? lowerClausePredicate(whereCtx) : undefined;
  const groupByCtx = shallowFirstOfRule(querySpec, P.RULE_aggregationClause);
  const groupBy = groupByCtx ? extractGroupBy(groupByCtx) : undefined;
  const havingCtx = shallowFirstOfRule(querySpec, P.RULE_havingClause);
  const having = havingCtx ? lowerClausePredicate(havingCtx) : undefined;

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

  return {
    kind: "select",
    projections,
    from,
    columns,
    where,
    joinConditions: joinConditions.length ? joinConditions : undefined,
    groupBy,
    having,
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

/** GROUP BY items: each grouping item (groupByClause / namedExpression) yields its expression.
 *  Grouping analytics (ROLLUP/CUBE/GROUPING SETS) only contribute their first expression for now. */
function extractGroupBy(aggregationClause: ParserRuleContext): Expr[] {
  const out: Expr[] = [];
  for (let i = 0; i < aggregationClause.getChildCount(); i++) {
    const child = aggregationClause.getChild(i);
    if (!(child instanceof ParserRuleContext)) continue;
    const e = firstOfRule(child, P.RULE_expression);
    if (e) out.push(lowerExpression(e));
  }
  return out;
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
      return expr.whens.some((w) => hasAggregate(w.when) || hasAggregate(w.then)) ||
        (expr.elseExpr !== undefined && hasAggregate(expr.elseExpr));
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
      else if (child.ruleIndex === P.RULE_query) continue; // subquery — its own scope
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
  "sum", "count", "avg", "mean", "min", "max", "first", "last", "first_value", "last_value",
  "stddev", "stddev_pop", "stddev_samp", "variance", "var_pop", "var_samp", "collect_list",
  "collect_set", "approx_count_distinct", "count_if", "any", "some", "bool_and", "bool_or",
  "corr", "covar_pop", "covar_samp", "skewness", "kurtosis", "percentile", "percentile_approx",
  "median", "mode", "array_agg", "max_by", "min_by", "bit_and", "bit_or", "bit_xor",
]);

const EXPR_RULES = new Set([
  P.RULE_expression, P.RULE_booleanExpression, P.RULE_valueExpression, P.RULE_primaryExpression,
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
  if (node instanceof StarContext) return { kind: "star", cst: node };
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

type ClassifiedExpr =
  | { kind: "column"; parts: string[] }
  | { kind: "star" }
  | { kind: "expr" };

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
      else if (child.ruleIndex === P.RULE_query) continue; // a subquery in an ON/WHERE — not a source
      else walk(child);
    }
  };
  walk(node);
  return out;
}

function buildSource(relationPrimary: ParserRuleContext): Source {
  const tableAlias = directChildrenOfRule(relationPrimary, P.RULE_tableAlias)[0];
  const alias = tableAlias ? firstOfRule(tableAlias, P.RULE_strictIdentifier)?.getText() : undefined;
  const columnAliases = tableAlias ? columnAliasList(tableAlias) : undefined;

  // A derived table: `( query ) alias`.
  const innerQuery = firstOfRule(relationPrimary, P.RULE_query);
  if (innerQuery) {
    return {
      kind: "subquery",
      query: lowerQuery(innerQuery),
      alias,
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
    columnAliases,
    cst: relationPrimary,
  };
}
