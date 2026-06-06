import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import { DatabricksParser as P } from "../generated/databricks/DatabricksParser.js";

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

export type Source = TableSource | SubquerySource;

export interface TableSource {
  kind: "table";
  /** Multipart name parts as written, e.g. ["catalog","schema","t"]. */
  name: string[];
  alias?: string;
  cst: ParserRuleContext;
}

export interface SubquerySource {
  kind: "subquery";
  query: QueryExpr;
  alias?: string;
  cst: ParserRuleContext;
}

export interface CteDef {
  name: string;
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

function nodesOfRule(node: ParseTree, ruleIndex: number): ParserRuleContext[] {
  const out: ParserRuleContext[] = [];
  for (const d of descendants(node)) if (d.ruleIndex === ruleIndex) out.push(d);
  return out;
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
    throw new Error("lower: no query found (non-query statements not modelled yet)");
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
  return { name, body: lowerQuery(innerQuery), cst: namedQuery };
}

function buildSelect(querySpec: ParserRuleContext): SelectExpr {
  const selectClause = firstOfRule(querySpec, P.RULE_selectClause);
  const projections = selectClause
    ? nodesOfRule(selectClause, P.RULE_namedExpression).map(buildProjection)
    : [];

  const fromClause = firstOfRule(querySpec, P.RULE_fromClause);
  const from = fromClause ? topRelationPrimaries(fromClause).map(buildSource) : [];

  return { kind: "select", projections, from, cst: querySpec };
}

function buildProjection(named: ParserRuleContext): Projection {
  const alias = directChildrenOfRule(named, P.RULE_errorCapturingIdentifier)[0];
  let name: string | undefined;
  if (alias) {
    name = alias.getText();
  } else {
    const text = named.getText();
    // A bare column reference: use its name. Anything with operators/calls gets no
    // inferred name until expressions are modelled.
    if (/^`[^`]*`$|^[A-Za-z_]\w*$/.test(text)) name = text;
  }
  return { name, isStar: named.getText() === "*", cst: named };
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
      else walk(child);
    }
  };
  walk(node);
  return out;
}

function aliasOf(relationPrimary: ParserRuleContext): string | undefined {
  const tableAlias = directChildrenOfRule(relationPrimary, P.RULE_tableAlias)[0];
  if (!tableAlias) return undefined;
  return firstOfRule(tableAlias, P.RULE_strictIdentifier)?.getText();
}

function buildSource(relationPrimary: ParserRuleContext): Source {
  const alias = aliasOf(relationPrimary);

  // A derived table: `( query ) alias`.
  const innerQuery = firstOfRule(relationPrimary, P.RULE_query);
  if (innerQuery) {
    return { kind: "subquery", query: lowerQuery(innerQuery), alias, cst: relationPrimary };
  }

  const multipart = firstOfRule(relationPrimary, P.RULE_multipartIdentifier);
  const parts = multipart
    ? directChildrenOfRule(multipart, P.RULE_errorCapturingIdentifier).map((p) => p.getText())
    : [];
  return {
    kind: "table",
    name: parts.length ? parts : multipart ? [multipart.getText()] : [],
    alias,
    cst: relationPrimary,
  };
}
