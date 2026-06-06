import { ParserRuleContext, type ParseTree } from "antlr4ng";
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
  body: SelectExpr; // becomes SelectExpr | SetOpExpr once a set-op test forces it
  cst: ParserRuleContext;
}

export interface SelectExpr {
  kind: "select";
  projections: Projection[];
  from: Source[];
  cst: ParserRuleContext;
}

export interface Projection {
  /** Output column name: explicit alias, or the column name for a bare column ref. */
  name?: string;
  isStar: boolean;
  cst: ParserRuleContext;
}

export type Source = TableSource;

export interface TableSource {
  kind: "table";
  /** Multipart name parts as written, e.g. ["catalog","schema","t"]. */
  name: string[];
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
  const querySpec = queryTerm ? firstOfRule(queryTerm, P.RULE_querySpecification) : undefined;
  if (!querySpec) {
    throw new Error("lower: query body is not a querySpecification (set ops not modelled yet)");
  }
  return { kind: "query", ctes, body: buildSelect(querySpec), cst: query };
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
  const from = fromClause
    ? nodesOfRule(fromClause, P.RULE_relationPrimary).map(buildTableSource)
    : [];

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

function buildTableSource(relationPrimary: ParserRuleContext): TableSource {
  const multipart = firstOfRule(relationPrimary, P.RULE_multipartIdentifier);
  const parts = multipart
    ? directChildrenOfRule(multipart, P.RULE_errorCapturingIdentifier).map((p) => p.getText())
    : [];
  return {
    kind: "table",
    name: parts.length ? parts : multipart ? [multipart.getText()] : [],
    cst: relationPrimary,
  };
}
