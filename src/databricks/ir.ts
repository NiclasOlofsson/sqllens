import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import {
  ColumnReferenceContext,
  DatabricksParser as P,
  DereferenceContext,
  PrimaryExpressionContext,
  StarContext,
} from "../generated/databricks/DatabricksParser.js";

// ---------------------------------------------------------------------------
// IR — a compact semantic model lowered from the deep Databricks CST. Every node
// keeps a back-reference to its CST context (`cst`) so exact source spans remain
// available (cst.start / cst.stop). Scope and qualify operate on this, not the CST.
//
// The IR is grown test-by-test; today it models the minimum the first scope cases
// need. Expressions are not modelled — they stay as CST refs and we extract only
// what name resolution requires.
// ---------------------------------------------------------------------------

export interface QueryExpr {
  kind: "query";
  ctes: CteDef[];
  body: QueryBody;
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

export interface ColumnRef {
  /** Reference parts as written: ["c"], ["t","c"], or ["a","b","c"]. */
  parts: string[];
  cst: ParserRuleContext;
}

export interface SetOpExpr {
  kind: "setop";
  op: "union" | "except" | "intersect";
  /** true for ALL (e.g. UNION ALL); false for the default DISTINCT. */
  all: boolean;
  left: QueryBody;
  right: QueryBody;
  cst: ParserRuleContext;
}

export interface Projection {
  /** Output column name: explicit alias, or the column name for a bare column ref. */
  name?: string;
  isStar: boolean;
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
  return { kind: "query", ctes, body: lowerQueryTerm(queryTerm), cst: query };
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
      cst: queryTerm,
    };
  }
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

  return {
    kind: "select",
    projections,
    from,
    columns: extractColumnRefs(querySpec),
    subqueries: subqueries.length ? subqueries : undefined,
    pivot: fromClause ? extractPivot(fromClause) : undefined,
    unpivot: fromClause ? extractUnpivot(fromClause) : undefined,
    cst: querySpec,
  };
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
  const aggColumns = aggregates
    ? extractColumnRefs(aggregates).map((r) => r.parts[r.parts.length - 1])
    : [];
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
  return { name, isStar: expr.kind === "star", cst: named };
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

/**
 * Collect every column reference at this query level — projections, WHERE, JOIN ON,
 * GROUP BY, etc. Stops at nested `query` nodes (those columns belong to that
 * subquery's own scope) and at each column path (so `a.b.c` is one ref, not three).
 */
function extractColumnRefs(querySpec: ParserRuleContext): ColumnRef[] {
  const refs: ColumnRef[] = [];
  const walk = (node: ParseTree): void => {
    for (let i = 0; i < node.getChildCount(); i++) {
      const child = node.getChild(i);
      if (!(child instanceof ParserRuleContext)) continue;
      if (child.ruleIndex === P.RULE_query) continue; // nested subquery — its own scope

      if (child instanceof ColumnReferenceContext || child instanceof DereferenceContext) {
        const parts = columnParts(child);
        if (parts) {
          refs.push({ parts, cst: child });
          continue; // a column path is one ref; don't re-collect its base
        }
        // e.g. f(x).field — not a pure column path; fall through to find refs inside it
      }
      walk(child);
    }
  };
  walk(querySpec);
  return refs;
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
