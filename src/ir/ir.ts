import type { ParserRuleContext } from "antlr4ng";
import type { StatementCategory } from "./statement.js";

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
	/** The statement category this query was lowered from, set by the dialect's lower() on the
	 *  TOP-LEVEL statement only (nested subqueries / CTE bodies leave it undefined — they are not
	 *  statements). Reported to the semantic layer so consumers can tell query / dml / ddl / dcl /
	 *  tcl / utility / compound apart without re-parsing. See src/ir/statement.ts. */
	statement?: StatementCategory;
	/** The dialect whose lower() produced this IR, set on the TOP-LEVEL statement only —
	 *  lets resolveScopes/toScopes select the inference knowledge without the caller
	 *  re-supplying it (issue #7). An explicit dialect argument overrides the tag. */
	dialect?: string;
	ctes: CteDef[];
	body: QueryBody;
	/** ORDER BY sort expressions, if present. */
	orderBy?: Expr[];
	/** Row-limiting clause (Spark LIMIT, T-SQL TOP / OFFSET-FETCH). Does not change the output
	 *  columns or types — kept so the clause is modelled rather than silently dropped. */
	limit?: LimitInfo;
	cst: ParserRuleContext;
}

export interface LimitInfo {
	/** TOP n / TOP (expr) / LIMIT n — the row-count expression. */
	top?: Expr;
	/** TOP … PERCENT. */
	percent?: boolean;
	/** TOP … WITH TIES. */
	withTies?: boolean;
	/** OFFSET n ROWS. */
	offset?: Expr;
	/** FETCH NEXT n ROWS ONLY. */
	fetch?: Expr;
}

export type QueryBody = SelectExpr | SetOpExpr | PipeExpr;

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
	/** The QUALIFY predicate (filters on window-function results; Databricks + Snowflake), modelled. */
	qualify?: Expr;
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
	/** The pivoted relation's alias (T-SQL `… PIVOT (…) AS pvt`), referenced by later columns.
	 *  Absent for Spark, where the pivot transforms the SELECT directly. */
	alias?: string;
}

export interface UnpivotInfo {
	/** The value column the unpivot produces. */
	valueColumn: string;
	/** The name column the unpivot produces. */
	nameColumn: string;
	/** The input columns consumed (turned into rows). */
	removed: string[];
	/** The unpivoted relation's alias (T-SQL `… UNPIVOT (…) AS u`), referenced by later columns. */
	alias?: string;
}

export type Clause = "projection" | "where" | "join" | "groupBy" | "having" | "qualify" | "orderBy";

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
	/** `*` or a qualified `t.*` — `qualifier` is the table parts for the latter. The optional
	 *  modifiers transform the expansion (Snowflake `* EXCLUDE/ILIKE/RENAME/REPLACE …`,
	 *  Databricks `* EXCEPT (…)`); they are applied by the qualify pass, which owns expansion. */
	| {
			kind: "star";
			qualifier?: string[];
			/** Columns removed from the expansion (Snowflake EXCLUDE, Databricks EXCEPT). */
			exclude?: string[];
			/** SQL LIKE pattern (case-insensitive) the expanded names must match (Snowflake ILIKE). */
			ilike?: string;
			/** `REPLACE (<expr> AS <col>)` — the column keeps its name/position, swaps its expression. */
			replace?: { column: string; expr: Expr }[];
			/** `RENAME (<col> AS <new>)` — renames applied to the expansion. */
			rename?: { from: string; to: string }[];
			cst: ParserRuleContext;
	  }
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
	/** Snowflake `UNION [ALL] BY NAME` — branch columns align by name, not position;
	 *  the output is the name-matched column set rather than the left branch's positions. */
	byName?: boolean;
	left: QueryBody;
	right: QueryBody;
	/** Set-op-level column references (e.g. a trailing ORDER BY) that resolve against the
	 *  set-op output (the left branch's columns). */
	columns: ColumnRef[];
	cst: ParserRuleContext;
}

// ---------------------------------------------------------------------------
// Pipe queries (`base |> op |> op …`). GoogleSQL pipe syntax (GA in BigQuery) and Spark 4.0 `|>`.
// Modelled FAITHFULLY: the base relation plus an ORDERED list of pipe operators, each a first-class
// PipeStage that keeps its own `|> OPERATOR …` source span — NOT desugared into nested subqueries.
// This serves the editor consumers (semantic tokens, document symbols, hover, go-to-def see the real
// pipe structure) and never silently rewrites a concept. The semantic layer FLOWS the relation through
// the stages (scope computes the columns entering and leaving each), so each real column reference still
// resolves against the relation visible at that point in the pipeline.
// ---------------------------------------------------------------------------

export interface PipeExpr {
	kind: "pipe";
	/** The relation the pipeline starts from (a SELECT, a set operation, a bare FROM, `TABLE name`). */
	input: QueryBody;
	/** The pipe operators, applied left-to-right. */
	stages: PipeStage[];
	cst: ParserRuleContext;
}

/** One `|> OPERATOR …` step. `op` names the operator; the payload carries the modelled parts (reusing
 *  the shared IR — Projection[]/Expr/Source). Each stage keeps its own `cst` span. Stages divide into:
 *  column-set transforms (select/extend/set/drop/rename/aggregate/window/call/pivot/unpivot), relation
 *  combiners (join/setop), pass-throughs that keep the column set (where/orderBy/limit/distinct/
 *  tablesample/as), and `other` — a pipe operator whose relation effect the IR does not model
 *  (DESCRIBE/LOG/ASSERT/FORK/TEE/IF/EXPORT/CREATE/INSERT/WITH/RECURSIVE UNION/MATCH_RECOGNIZE), kept
 *  with its kind + span and flagged rather than dropped. */
export type PipeStage =
	| { op: "where"; predicate: Expr; columns: ColumnRef[]; cst: ParserRuleContext }
	| { op: "select"; projections: Projection[]; columns: ColumnRef[]; cst: ParserRuleContext }
	| { op: "extend"; projections: Projection[]; columns: ColumnRef[]; cst: ParserRuleContext }
	| { op: "set"; assignments: PipeSetItem[]; columns: ColumnRef[]; cst: ParserRuleContext }
	| { op: "drop"; drop: string[]; cst: ParserRuleContext }
	| { op: "rename"; renames: { from: string; to: string }[]; cst: ParserRuleContext }
	| {
			op: "aggregate";
			aggregates: Projection[];
			groupBy: Expr[];
			columns: ColumnRef[];
			cst: ParserRuleContext;
	  }
	| { op: "orderBy"; keys: Expr[]; columns: ColumnRef[]; cst: ParserRuleContext }
	| { op: "limit"; limit: LimitInfo; cst: ParserRuleContext }
	| { op: "distinct"; cst: ParserRuleContext }
	| { op: "join"; source: Source; joinConditions?: Expr[]; columns: ColumnRef[]; cst: ParserRuleContext }
	| {
			op: "setop";
			setOp: "union" | "except" | "intersect";
			all: boolean;
			byName?: boolean;
			operands: QueryExpr[];
			cst: ParserRuleContext;
	  }
	| { op: "as"; alias: string; cst: ParserRuleContext }
	| { op: "window"; projections: Projection[]; columns: ColumnRef[]; cst: ParserRuleContext }
	/** `|> CALL tvf(...)` — a table-valued function over the pipe relation; its output columns come from
	 *  the TVF signature (unknown without a catalog, never wrong — the inference contract). */
	| { op: "call"; name: string[]; args: Expr[]; columns: ColumnRef[]; cst: ParserRuleContext }
	| {
			op: "setop";
			setOp: "union" | "except" | "intersect";
			all: boolean;
			byName?: boolean;
			operands: QueryExpr[];
			cst: ParserRuleContext;
	  }
	/** `|> RECURSIVE UNION …` — a recursive set operation; `operand` is the recursive term. */
	| { op: "recursiveUnion"; all: boolean; operand: QueryExpr; alias?: string; cst: ParserRuleContext }
	| { op: "pivot"; pivot: PivotInfo; cst: ParserRuleContext }
	| { op: "unpivot"; unpivot: UnpivotInfo; cst: ParserRuleContext }
	/** `|> TABLESAMPLE …` — samples rows; the column set is unchanged. */
	| { op: "tablesample"; cst: ParserRuleContext }
	/** `|> ASSERT cond [, payload…]` — asserts a row condition; the relation passes through unchanged. */
	| { op: "assert"; condition: Expr; payload: Expr[]; columns: ColumnRef[]; cst: ParserRuleContext }
	/** `|> LOG [ (subpipeline) ]` — logs the relation (optionally a side-pipeline view of it) and passes
	 *  it through unchanged. */
	| { op: "log"; pipeline?: PipeStage[]; cst: ParserRuleContext }
	/** `|> DESCRIBE` — replaces the relation with a description result (a fixed name/type/… schema). */
	| { op: "describe"; cst: ParserRuleContext }
	/** `|> STATIC_DESCRIBE` — prints the static schema; the relation passes through unchanged. */
	| { op: "staticDescribe"; cst: ParserRuleContext }
	/** `|> WITH cte AS (…)` — introduces CTEs visible to the rest of the pipeline; relation unchanged. */
	| { op: "with"; ctes: CteDef[]; cst: ParserRuleContext }
	/** `|> IF cond THEN (subpipeline) [ELSEIF …] [ELSE (subpipeline)]` — conditional sub-pipelines.
	 *  `arms[0]` is the IF (with condition); middle arms are ELSEIF (with condition); a final arm with no
	 *  condition is the ELSE. Each arm's `pipeline` runs on the relation entering the IF. */
	| { op: "if"; arms: PipeBranch[]; columns: ColumnRef[]; cst: ParserRuleContext }
	/** `|> FORK (subpipeline), (subpipeline), …` — splits the relation into several independent outputs. */
	| { op: "fork"; branches: PipeStage[][]; cst: ParserRuleContext }
	/** `|> TEE (subpipeline), …` — like FORK but also passes the relation through unchanged. */
	| { op: "tee"; branches: PipeStage[][]; cst: ParserRuleContext }
	/** `|> MATCH_RECOGNIZE (PARTITION BY … MEASURES … PATTERN … DEFINE …)` — row-pattern matching; the
	 *  output is the partition keys + the MEASURES columns. The PATTERN/DEFINE row-pattern detail is its
	 *  own surface, captured by `cst`; column-flow uses partitionBy + measures. */
	| {
			op: "matchRecognize";
			partitionBy: Expr[];
			measures: Projection[];
			defines: Expr[];
			columns: ColumnRef[];
			cst: ParserRuleContext;
	  }
	/** `|> EXPORT DATA …` — a terminal sink that writes the relation out (no downstream relation). */
	| { op: "exportData"; cst: ParserRuleContext }
	/** `|> CREATE TABLE name …` — a terminal sink creating a table from the relation (object DDL). */
	| { op: "createTable"; name: string[]; cst: ParserRuleContext }
	/** `|> INSERT [INTO] name …` — a terminal sink inserting the relation into a table. */
	| { op: "insert"; name: string[]; cst: ParserRuleContext }
	/** Drift guard ONLY — never produced for known GoogleSQL/Spark pipe syntax (all operators above are
	 *  modelled). Reached only if the grammar grows an operator the lowering hasn't caught up to; gated to
	 *  zero over the corpus so it can't silently mask a real operator. */
	| { op: "other"; name: string; cst: ParserRuleContext };

/** A `|> SET col = expr` assignment (updates an existing column's value, keeping its position). */
export interface PipeSetItem {
	column: string;
	expr: Expr;
}

/** One arm of a `|> IF …` — a condition (absent for the trailing ELSE) and its sub-pipeline. */
export interface PipeBranch {
	condition?: Expr;
	pipeline: PipeStage[];
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

export type Source = TableSource | SubquerySource | LateralViewSource | GraphTableSource;

// ---------------------------------------------------------------------------
// Graph / GQL (BigQuery `GRAPH_TABLE(graph MATCH … COLUMNS(…))` in FROM, and the standalone
// `GRAPH graph MATCH … RETURN …` statement). Modelled FAITHFULLY: the property-graph name, the
// MATCH pattern's element variables (nodes/edges with their labels + direction, each with its span),
// the WHERE, and the output columns (the COLUMNS / RETURN list). The element variables form the graph
// query's own little relation namespace — the WHERE/COLUMNS/RETURN expressions resolve against them —
// so an editor can highlight and resolve `(a)-[e]->(b)`'s `a`, `e`, `b` as graph elements.
// ---------------------------------------------------------------------------

export interface GraphTableSource {
	kind: "graphtable";
	/** The property graph name (`GRAPH_TABLE(my_graph MATCH …)`). */
	graph: string[];
	/** The element variables bound by the MATCH pattern(s) — nodes and edges, in order. */
	elements: GraphElement[];
	/** The MATCH WHERE predicate(s), modelled. */
	where?: Expr;
	/** Output columns — the `COLUMNS(<select_list>)` shape or the `RETURN <items>` list. */
	columns: Projection[];
	/** Every column reference inside the pattern fillers / WHERE / output list (for resolution). */
	columnRefs: ColumnRef[];
	alias?: string;
	aliasCst?: ParserRuleContext;
	cst: ParserRuleContext;
}

/** A graph pattern element — a node `(a:Label {p} WHERE …)` or an edge `-[e:Label]->`. */
export interface GraphElement {
	graphKind: "node" | "edge";
	/** The element variable (`a`), if named. */
	variable?: string;
	variableCst?: ParserRuleContext;
	/** The label expression text (`Person`, `Knows|Likes`), if present. */
	label?: string;
	/** Edge direction: `->` right, `<-` left, `-`/`~` any (undirected). Absent for nodes. */
	direction?: "left" | "right" | "any";
	cst: ParserRuleContext;
}

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
