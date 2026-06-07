import type { ParserRuleContext } from "antlr4ng";

// ---------------------------------------------------------------------------
// IR — a compact, DIALECT-NEUTRAL semantic model. Each dialect's `lower()` (e.g.
// src/databricks/lower.ts, src/tsql/lower.ts) maps its CST to these same types; the
// semantic layer (scope, qualify, infer, lineage, symbols) operates only on the
// IR and is therefore dialect-agnostic. Every node keeps a back-reference to its
// CST context (`cst`) so exact source spans remain available (cst.start/cst.stop).
//
// The IR is a superset: shared relational concepts plus a few dialect-flavoured
// leaves (e.g. LateralViewSource). A dialect simply doesn't produce the nodes it
// has no syntax for.
// ---------------------------------------------------------------------------

export interface QueryExpr {
  kind: "query";
  ctes: CteDef[];
  body: QueryBody;
  /** ORDER BY sort expressions, if present. */
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
  /** `*` or a qualified `t.*` — `qualifier` is the table parts for the latter. */
  | { kind: "star"; qualifier?: string[]; cst: ParserRuleContext }
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
  | {
      /** A predicate test: `a IS [NOT] NULL`, `a [NOT] IN (…)`, `a [NOT] BETWEEN x AND y`,
       *  `a [NOT] LIKE p`, `a IS [NOT] DISTINCT FROM b`, … */
      kind: "predicate";
      /** between | in | like | ilike | rlike | null | true | false | unknown | distinct from */
      op: string;
      negated: boolean;
      /** The value being tested (left of the predicate). */
      operand: Expr;
      /** Operands of the predicate: BETWEEN → [lower, upper]; IN → list items or a subquery;
       *  LIKE/RLIKE → [pattern]; DISTINCT FROM → [right]; IS NULL/TRUE/… → []. */
      args: Expr[];
      cst: ParserRuleContext;
    }
  /** A lambda used as a higher-order function argument: `x -> x + 1`, `(acc, x) -> …`. */
  | { kind: "lambda"; params: string[]; body: Expr; cst: ParserRuleContext }
  /** Element/array/map access: `arr[0]`, `m['k']`, `split(s,'-')[1]`. */
  | { kind: "subscript"; base: Expr; index: Expr; cst: ParserRuleContext }
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
  /** Set-op-level column references (e.g. a trailing ORDER BY) that resolve against the
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
  /** The lateral relation's alias (Spark `LATERAL VIEW explode(x) v AS c` → "v"). */
  alias?: string;
  /** The alias identifier's own CST node (for its precise span), when aliased. */
  aliasCst?: ParserRuleContext;
  /** The columns it exposes (the AS list — `… AS c1, c2`). */
  columns: string[];
  cst: ParserRuleContext;
}

export interface TableSource {
  kind: "table";
  /** Multipart name parts as written, e.g. ["catalog","schema","t"]. */
  name: string[];
  alias?: string;
  /** The alias identifier's own CST node (for its precise span), when aliased. */
  aliasCst?: ParserRuleContext;
  /** Inline column aliases, e.g. `t AS u (c1, c2)` → ["c1","c2"]. */
  columnAliases?: string[];
  cst: ParserRuleContext;
}

export interface SubquerySource {
  kind: "subquery";
  query: QueryExpr;
  alias?: string;
  /** The alias identifier's own CST node (for its precise span), when aliased. */
  aliasCst?: ParserRuleContext;
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
