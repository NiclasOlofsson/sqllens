import type { ParserRuleContext } from "antlr4ng";
import type { PartSpan } from "./part-span.js";
import type { QualifiedName } from "./qualified-name.js";
import type { StatementCategory } from "./statement.js";

export type { PartSpan } from "./part-span.js";
export type { QualifiedName, QualifiedNameConfig, NameRole } from "./qualified-name.js";

/**
 * The identity of one template call, the `expansion()` key. Args are LITERAL
 * string values: quote-stripped, escapes NOT resolved — an argument whose
 * literal contains an escape, or any computed argument, is `null` (never-wrong:
 * a fabricated literal is worse than an unknown one). Kwargs are carried, not
 * dropped, in source order; the provider interprets them (so
 * `ref(package='a', model='b')` is fully reachable). A bare identifier tag
 * (`{{ docs }}`) keys with `args: []` like a zero-arg call.
 */
export interface TemplateCall {
	name: string;
	/** Dotted path before the name (`dbt_utils` in `dbt_utils.star(...)`). */
	packageParts?: string[];
	args: (string | null)[];
	kwargs?: { name: string; value: string | null }[];
}

/** A template tag standing in a scalar/expression slot: the tag's span + (when a call/identifier
 *  leads it) its provider key. Attached post-lower by the jinja front end; plain SQL never carries it. */
export interface TemplateExprInfo {
	/** The whole tag's span ({{ … }} inclusive), document coordinates. */
	span: PartSpan;
	/** The provider key, absent for a composed/opaque expression tag. */
	call?: TemplateCall;
}

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
	/** The statement's own variable declarations (T-SQL `DECLARE @x int = 1, @y int`, or a routine's
	 *  signature parameters), set by the dialect's lower() on the QueryExpr they belong to: the
	 *  top-level statement for a DECLARE, or a routine's own container/inner statement for its
	 *  parameters. Populated today only by tsql; absent means none. See `VariableDecl`. */
	declarations?: VariableDecl[];
	/** The inner statements of a routine body (CREATE/ALTER PROCEDURE, a scalar/table-valued
	 *  FUNCTION) or a scripting compound (BEGIN...END), each a full QueryExpr lowered through the
	 *  same per-statement machinery as a top-level batch unit (own body, own ctes, own cst). The
	 *  CONTAINER statement (this QueryExpr) keeps its own `statement` category and its flagged stub
	 *  `body`; the real content lives here. Populated today only by tsql; absent means none (a
	 *  routine with an external body, or any non-routine statement). See `VariableDecl` for how a
	 *  routine's own signature parameters ride `declarations` instead. */
	statements?: QueryExpr[];
	cst: ParserRuleContext;
}

/**
 * One variable declared by the statement itself (T-SQL `DECLARE @x int = 1`): a SCRIPT-bound
 * declaration, distinct from a caller-bound `parameter` (see the `parameter`/`variable` Expr
 * kinds below: this is the declaration site a `variable` reference resolves to). `nameSpan` is
 * the declared name's own span, sigil excluded, the same convention as the `variable` Expr's
 * `name`. `typeText` is the declared type as written (a scalar type, or the TABLE(...)/XML(...)
 * shape for a table-type/XML-schema DECLARE, no deep modeling of those). `init` is the
 * initializer expression when the DECLARE assigns one (`= expr`); absent otherwise. Populated
 * today only by T-SQL's DECLARE (learn.microsoft.com/en-us/sql/t-sql/language-elements/
 * declare-local-variable-transact-sql).
 */
export interface VariableDecl {
	name: string;
	nameSpan: PartSpan;
	typeText?: string;
	init?: Expr;
	/** T-SQL routine parameter modifier: `OUT`/`OUTPUT` ("out") or `READONLY` ("readonly").
	 *  Absent for a plain DECLARE'd variable and for a parameter with no modifier. No semantic
	 *  effect yet beyond carrying the field (learn.microsoft.com/en-us/sql/relational-databases/
	 *  stored-procedures/parameters). */
	mode?: "out" | "readonly";
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

/**
 * The closed vocabulary of `SelectExpr.unsupported` flags — every value any dialect's `lower()`
 * pushes onto that field, enumerated by grepping all eight `src/<dialect>/lower.ts` (2026-07-06,
 * review finding 7). A closed union catches a typo'd flag string at compile time; the field used
 * to be `string[]`, letting any dialect push anything with no shared vocabulary.
 */
export type UnsupportedFlag =
	| "multi-statement" // a `;`-batch (healthy or recovery-swallowed) — flagged stub body. All dialects.
	| "broken" // a wholly-unparsed statement (recovery consumed it; input was NOT empty). All dialects.
	| "empty" // genuinely empty input. databricks, snowflake, bigquery, redshift, postgres, duckdb, trino,
	// sqlite, mysql (T-SQL folds this case into "unparsed" instead — see that member).
	| "compound" // a BEGIN…END scripting compound body. databricks (`flagged(stmt, statement, "compound")`),
	// snowflake (`nonQuery(commands[0], "compound")`, a standalone Scripting block).
	| "non-query" // a parsed statement with no query body (utility/DDL/DML/DCL/TCL, no SELECT).
	// databricks, snowflake, bigquery, redshift, postgres, duckdb, trino, sqlite, mysql (T-SQL uses
	// "unparsed" for this case).
	| "non-query-cte" // a CTE whose body has no inner SELECT to lower. postgres, redshift, duckdb only.
	| "unparsed" // the generic unparseable-body fallback (T-SQL's default reason incl. empty input;
	// also snowflake/postgres/redshift/duckdb's `emptyBody()`/`emptyQuery()` no-reason-given default).
	| "query-body" // an inline table body (VALUES / INSERT…VALUES / TABLE t) not lowered into a real
	// select body. databricks only.
	| "session-properties" // a Trino `EXECUTE ... USING` / query with session-property overrides
	// the IR doesn't model. trino only.
	| "inline-function" // a Trino query carrying an inline `WITH FUNCTION` specification. trino only.
	| "group-by-auto" // Trino's automatic/implicit GROUP BY grouping. trino only.
	| "match_recognize" // a `MATCH_RECOGNIZE` clause (base relation stays visible, the pattern-match
	// transform itself is not modelled). trino only.
	| "pivot" // a FROM-level PIVOT reshape (suffix form) or a standalone PIVOT statement whose output
	// columns the IR doesn't derive. duckdb only.
	| "unpivot"; // the UNPIVOT counterpart of "pivot". duckdb only.

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
	/** The explicit JOIN operations of the FROM clause, in source order (left-to-right, as written).
	 *  ADDITIVE: `from` + `joinConditions` stay populated exactly as before; `joins` is a first-class,
	 *  span-addressable view over the same objects (each `join.source` is reference-identical to its
	 *  `from` entry, each `join.on` reference-equal to its `joinConditions` entry). Absent (undefined)
	 *  when the select has no explicit JOIN — comma-separated sources are plain `from` entries, not joins.
	 *  See the Join-node model documented below. */
	joins?: Join[];
	/** GROUP BY expressions, if present. */
	groupBy?: Expr[];
	/** The HAVING predicate, modelled. */
	having?: Expr;
	/** The QUALIFY predicate (filters on window-function results; Databricks + Snowflake), modelled. */
	qualify?: Expr;
	/** True when the query aggregates: a GROUP BY, or an aggregate function in the projections/HAVING. */
	aggregated: boolean;
	/** Inline-table (VALUES) rows AFTER the first, each a per-column Expr list parallel to
	 *  `projections` (which carry row 1). Lossless: without this, rows 2+ were dropped and a
	 *  column's type could only echo row 1 (VALUES (1,2),(7,77.7) claimed int where the
	 *  engine says decimal). Absent on single-row and non-VALUES selects. */
	moreRows?: Expr[][];
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
	unsupported?: UnsupportedFlag[];
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
	/** True when the output columns are data-dependent and cannot be enumerated statically (DuckDB's
	 *  statement `PIVOT … ON … USING` with no fixed IN-list — the distinct ON-values become columns).
	 *  The reshape is still modelled (source + consumed columns visible); downstream resolves the output
	 *  to "unknown" rather than guessing a column set. */
	dynamic?: boolean;
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

// ---------------------------------------------------------------------------
// Join — a first-class, span-addressable model of one FROM-clause JOIN operation. ADDITIVE over
// `from` + `joinConditions` (which stay exactly as before): `Join.source` is the SAME object as the
// matching `from` entry, `Join.on` the SAME object as the matching `joinConditions` entry — a Join
// carries no unique expr/source, only the kind + the full-construct span. A formatter consumer
// tests span containment against it; the SQL debugger slices the query text at join boundaries. Semantics (scope/qualify/lineage/symbols) are NOT migrated onto
// `joins` in this task — they keep reading `from` + `joinConditions`.
// ---------------------------------------------------------------------------

export type JoinKind =
	"inner" | "left" | "right" | "full" | "cross" | "semi" | "anti" | "asof" | "positional" | "natural" | "lateral";

export interface Join {
	/** The join category. NATURAL/LATERAL ride as the `natural`/`lateral` flags with `kind` set to the
	 *  ANSI type when one is also present (NATURAL LEFT → kind "left", natural true); `kind` is
	 *  "natural"/"lateral" only for a bare NATURAL/LATERAL join with no ANSI type. */
	kind: JoinKind;
	/** The joined (right-side) source — REFERENCE-IDENTICAL to the matching `SelectExpr.from` entry. */
	source: Source;
	/** The ON predicate — REFERENCE-EQUAL to the matching `SelectExpr.joinConditions` entry (not a copy).
	 *  Mutually exclusive with `using`. */
	on?: Expr;
	/** USING (col, …) column names. Mutually exclusive with `on`. */
	using?: string[];
	/** NATURAL modifier (kind still carries the ANSI type, e.g. NATURAL LEFT → kind "left", natural true). */
	natural?: boolean;
	/** LATERAL modifier (the right source is correlated to earlier sources). */
	lateral?: boolean;
	/** Spans the full `[type] JOIN … [ON …|USING …]` construct. */
	cst: ParserRuleContext;
}

export type Clause = "projection" | "where" | "join" | "groupBy" | "having" | "qualify" | "orderBy";

export interface ColumnRef {
	/** Discriminant tag — lets a consumer identify a bare ColumnRef record structurally
	 *  (e.g. a template placeholder fill) without shape-sniffing `parts`/`clause`. */
	kind: "columnref";
	/** Reference parts as written: ["c"], ["t","c"], or ["a","b","c"]. */
	parts: string[];
	/** Present when this ref is a template tag's placeholder fill (see the column Expr's
	 *  `template`) — qualify skips unknown-column checks on it. Attached post-lower. */
	template?: TemplateExprInfo;
	/** Per-part source spans, PARALLEL to `parts` (same length) — each covers that part's own
	 *  token(s) including any quoting delimiters, excluding the dots. ADDITIVE/optional: present only
	 *  when every part was read from a real token; absent (all-or-nothing) when any part is synthesized.
	 *  Lets a consumer hit-test a cursor on `o` vs `order_id` in `o.order_id`. See src/ir/part-span.ts. */
	partSpans?: PartSpan[];
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
	/** A column reference. `partSpans` (when present) is PARALLEL to `parts` — one span per part,
	 *  covering that part's own token(s) incl. quotes, excluding dots; absent (all-or-nothing) when any
	 *  part is synthesized rather than read from a token. See src/ir/part-span.ts.
	 *  `outerJoinMarker` is the Oracle-style `(+)` outer-join marker as-written on this column ref
	 *  (`a.id = b.id (+)`); sqllens preserves it verbatim and derives NO join kind — the marker means
	 *  b's table is the null-extended side, but which LEFT/RIGHT join that implies across a
	 *  multi-predicate WHERE is Oracle-semantics the consumer (or a future dedicated pass) resolves.
	 *  Redshift only; absent on every other dialect's columns. */
	| {
			kind: "column";
			parts: string[];
			partSpans?: PartSpan[];
			outerJoinMarker?: true;
			/** Present when this "column" is really a template tag's placeholder fill in a scalar slot
			 *  (`select {{ my_macro() }}` / `{{ var('x') }} > 1`) — attached post-lower by the jinja
			 *  front end (apply-tags), so inference resolves it through the TemplateProvider and
			 *  qualify never fires unknown-column against a placeholder name. */
			template?: TemplateExprInfo;
			cst: ParserRuleContext;
	  }
	| { kind: "literal"; text: string; cst: ParserRuleContext }
	/** A caller-bound placeholder: `?`, `?3` (T-SQL/ODBC-style ordinal), `:name`, `$1`/`$name`
	 *  (Postgres-family positional/named), BigQuery `@name`. `text` is the token exactly as
	 *  written (lossless). `name` is set for a named form (the identifier, sigil stripped);
	 *  `ordinal` for an explicitly numbered form (`$1` -> 1, `?3` -> 3); neither is set for a bare
	 *  `?`, since its position is the CONSUMER's derivation, never fabricated here. A DIFFERENT
	 *  concept from `variable` below (vendors document them separately): a parameter is bound by
	 *  the CALLER at execution time, a variable is bound by the SCRIPT itself. */
	| { kind: "parameter"; text: string; name?: string; ordinal?: number; cst: ParserRuleContext }
	/** A session/local variable reference: T-SQL/MySQL `@x` (local), `@@version`-style system
	 *  variables (`system: true`), BigQuery `@@x` (system, script-level). `name` is the
	 *  identifier with its sigil(s) stripped; `text` is the token as written. See `parameter`
	 *  above for why these stay separate node kinds. */
	| { kind: "variable"; text: string; name: string; system?: true; cst: ParserRuleContext }
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
			/** The dotted path before the last segment, lowercased (e.g. `hll_count` in
			 *  `HLL_COUNT.EXTRACT`) — the qualifier under which a dotted-family call keys its return
			 *  type. Absent for a bare call. Additive/optional; set by BigQuery (dotted paths) and Snowflake (sequence NEXTVAL). */
			qualifier?: string;
			args: Expr[];
			/** Parallel to `args`: the parameter name for a named-argument invocation
			 *  (`fn(name => value)`), or `undefined` for a positional argument. Absent when the
			 *  call has no named arguments at all. Keeps the `name =>` conservation-visible. */
			argNames?: (string | undefined)[];
			/** Heuristic: name is in a known-aggregate set (sum/count/avg/…). */
			aggregate: boolean;
			distinct: boolean;
			/** Present when the call has an OVER clause (a window function). */
			window?: WindowSpec;
			cst: ParserRuleContext;
	  }
	| { kind: "case"; whens: { when: Expr; then: Expr }[]; elseExpr?: Expr; cst: ParserRuleContext }
	| {
			kind: "cast";
			expr: Expr;
			typeText: string;
			/** `?::` / `TRY_CAST` — null on failure. */ try?: boolean;
			cst: ParserRuleContext;
	  }
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
	/** Element/array/map access: `arr[0]`, `m['k']`, `split(s,'-')[1]`. Also carries a SLICE
	 *  (`l[lo:hi]`, `l[lo:hi:step]` — DuckDB/Postgres/Redshift list & string slicing,
	 *  functions/list.md#slicing): `slice: true`, with `index` reused as the begin bound.
	 *  Plain element access: `index` is the subscript expression, `end`/`step`/`slice` absent.
	 *  Slice access: `index`/`end`/`step` are each present ONLY when that bound was actually
	 *  written — an omitted bound (incl. DuckDB's bare `-` default-bound placeholder, which means
	 *  the same as omitting it, e.g. `l[:-:2]` ≡ `l[::2]`) stays absent, never fabricated. Each
	 *  present bound keeps its own `cst` span; `cst` on the node itself spans the whole `base[...]`. */
	| { kind: "subscript"; base: Expr; index?: Expr; end?: Expr; step?: Expr; slice?: true; cst: ParserRuleContext }
	/** ZetaSQL's expression-scoped `WITH(name AS expr, …, result)` — SQL-scoped let-bindings whose scope
	 *  is the result expression. Modelled faithfully: the lowered `bindings` are retained (conservation and
	 *  the walker see every binding value expr) and `result` is the expression the WITH evaluates to. We do
	 *  NOT substitute bindings, so a binding reference inside `result` resolves as a plain column ref — an
	 *  accepted boundary (googlesql WITH-expression). Only BigQuery produces this node today. */
	| { kind: "with"; bindings: { name: string; value: Expr }[]; result: Expr; cst: ParserRuleContext }
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
	/** The alias identifier's own span — present ⇔ the projection carries an EXPLICIT alias in
	 *  source (with or without AS); covers the identifier only (quoting delimiters included, the
	 *  AS keyword excluded). A derived name (a bare column ref's own name) gets NO aliasCst. */
	aliasCst?: ParserRuleContext;
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
	/** True for a synthetic pseudo-column source (e.g. Snowflake/Oracle CONNECT BY's `LEVEL`):
	 *  it resolves by name but is excluded from a bare `SELECT *` expansion, matching real
	 *  pseudo-column semantics. Absent (or false) for a real lateral relation like FLATTEN,
	 *  whose columns DO join `*`. */
	pseudo?: true;
	cst: ParserRuleContext;
}

/** Present when a source was written as a minijinja template tag: a call in a FROM slot
 *  ({{ ref('x') }} / {{ source('a','b') }} / a macro), or a non-call expression. Attached post-lower by
 *  the jinja front end (src/minijinja/apply-tags.ts); plain SQL parses never carry it. When the
 *  TemplateProvider resolves the call's relation, `name` carries the resolved name parts and the
 *  source's columns bind through the provider. When it does not (the neutral provider, a plain macro, a
 *  computed call), `name` stays the raw placeholder and the source is an opaque relation (no
 *  unknown-table/-column diagnostics). The tag AST and this marker are dbt-NEUTRAL: ref vs source is not
 *  a stored kind but the callee name on `call` (call.name === "ref"), resolved by the provider the same
 *  way a SQL function's type comes from a dialect registry. This type is IR-neutral (no import from
 *  src/minijinja); consumers needing the full TagNode correlate by `span` with parseTemplated().tags. */
export interface TemplateSourceInfo {
	/** `"call"` = a template call occupies the slot; its `call` is the provider key that names the
	 *  source and types its columns. `"expr"` = a non-call templated expression (a bare variable
	 *  `{{ t }}`, a concat `{{ a ~ b }}`) that carries no call, so it stays opaque and `name` is the
	 *  raw placeholder. */
	kind: "call" | "expr";
	/** The whole tag's span ({{ … }} inclusive), document coordinates. */
	span: PartSpan;
	opaque?: true;
	/** Present when a bare `{{ t }}` resolved through a literal `{% set t = ref('x') %}`: `name`/`call`
	 *  carry the resolved relation, but the TagNode at `span` is the USE site (kind "other"), not the
	 *  call node, so consumers correlating span to TagNode must not expect a call node here. */
	indirect?: true;
	/** The provider key for this source's tag (any call in a FROM slot, and resolved set-indirection):
	 *  the semantic layer resolves the source through `TemplateProvider.expansion(call)`. Absent only on
	 *  the opaque `"expr"` kind (no call to ask about). */
	call?: TemplateCall;
}

export interface TableSource {
	kind: "table";
	/** The STRUCTURED name (issue #38): the object's own `name`, `parts` exactly as written, roles
	 *  right-aligned per the dialect's namespace, the folded identity `key`, and a display-ready
	 *  `fqn`. Built by the dialect's lower() (the one layer that knows the namespace shape);
	 *  consumers read structure here and never re-derive it from a parts array. */
	relation: QualifiedName;
	/** Per-part spans PARALLEL to `relation.parts`, one per multipart segment — same all-or-nothing
	 *  convention as `ColumnRef.partSpans` (absent when any part lacks a real token). Lets a
	 *  consumer hit-test a cursor on `catalog` vs `schema` vs `t` in `catalog.schema.t`, and recover
	 *  each part's raw (delimiter-included) source text via span + document text without re-scanning
	 *  the token stream. */
	namePartSpans?: PartSpan[];
	alias?: string;
	/** The alias identifier's own CST node (for its precise span), when aliased. */
	aliasCst?: ParserRuleContext;
	/** Inline column aliases, e.g. `t AS u (c1, c2)` → ["c1","c2"]. */
	columnAliases?: string[];
	/** Declared columns WITH their types, for sources that name both — T-SQL OPENJSON/OPENXML
	 *  `WITH (col type …)`. Additive/optional: `columnAliases` still carries the bare names for
	 *  compatibility; `declaredColumns` adds the per-column type text so inference can type the
	 *  source's output columns. `type` is absent when only a name is declared. */
	declaredColumns?: { name: string; type?: string }[];
	/** Present when this source was written as a minijinja template tag in a FROM/JOIN slot; attached
	 *  post-lower by the jinja front end (src/minijinja/apply-tags.ts). See TemplateSourceInfo. */
	template?: TemplateSourceInfo;
	/** True when the LIBRARY built this node rather than lowering it from user syntax (a graph
	 *  element variable exposed as a relation). Catalog existence semantics don't apply: a closed
	 *  world's unknown-table never fires for a synthesized source. */
	synthesized?: true;
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
	/** The CTE name identifier's own CST node (for its precise span) — same convention as
	 *  `TableSource.aliasCst`/`Projection.aliasCst`. Absent only when the name itself has no real
	 *  token (a genuinely broken/nameless CTE on mid-edit input). */
	nameCst?: ParserRuleContext;
	/** Declared column aliases, e.g. `WITH c (x, y) AS (…)` → ["x","y"]; these rename the CTE's outputs. */
	columnAliases?: string[];
	body: QueryExpr;
	cst: ParserRuleContext;
}
