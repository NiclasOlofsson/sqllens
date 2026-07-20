import { ParserRuleContext, type ParseTree, type TerminalNode } from "antlr4ng";
import {
	AndContext,
	ArithmeticBinaryContext,
	ArithmeticUnaryContext,
	ArrayConstructorContext,
	AtLocalContext,
	AtTimeZoneContext,
	AutoContext,
	BetweenContext,
	BooleanTestContext,
	CastContext,
	ColumnReferenceContext,
	ComparisonContext,
	ConcatenationContext,
	CreateMaterializedViewContext,
	CreateTableAsSelectContext,
	CreateViewContext,
	CurrentCatalogContext,
	CurrentDateContext,
	CurrentPathContext,
	CurrentSchemaContext,
	CurrentTimeContext,
	CurrentTimestampContext,
	CurrentUserContext,
	DeleteContext,
	DereferenceContext,
	DistinctFromContext,
	ExistsContext,
	ExplainAnalyzeContext,
	ExplainContext,
	ExtractContext,
	FunctionCallContext,
	GroupingOperationContext,
	InListContext,
	InlineTableContext,
	InSubqueryContext,
	InsertIntoContext,
	JoinRelationContext,
	JsonArrayContext,
	JsonExistsContext,
	JsonObjectContext,
	JsonQueryContext,
	JsonTableContext,
	JsonValueContext,
	LambdaContext,
	LateralContext,
	LikeContext,
	ListaggContext,
	LiteralsContext,
	LocalTimeContext,
	LocalTimestampContext,
	LogicalNotContext,
	MatchContext,
	MeasureContext,
	MergeContext,
	MethodCallContext,
	NearestContext,
	NormalizeContext,
	NullPredicateContext,
	OrContext,
	OrdinalityColumnContext,
	OverlayContext,
	ParameterContext,
	ParenthesizedExpressionContext,
	ParenthesizedRelationContext,
	PositionContext,
	PredicatedContext,
	QuantifiedComparisonContext,
	QueryColumnContext,
	QueryPrimaryDefaultContext,
	RootContext,
	RowConstructorContext,
	SearchedCaseContext,
	SelectAllContext,
	SelectSingleContext,
	SetOperationContext,
	SimpleCaseContext,
	StatementDefaultContext,
	StaticMethodCallContext,
	SubqueryContext,
	SubqueryExpressionContext,
	SubqueryRelationContext,
	SubscriptContext,
	SubstringContext,
	TableContext,
	TableFunctionInvocationContext,
	TableNameContext,
	TrimContext,
	TrinoParser as P,
	UniqueContext,
	UnnestContext,
	UpdateContext,
	ValueColumnContext,
	ValueExpressionDefaultContext,
	type AliasedRelationContext,
	type ArgumentContext,
	type BooleanExpressionContext,
	type ExpressionContext,
	type GroupingElementContext,
	type JsonTableColumnContext,
	type NamedQueryContext,
	type OverContext,
	type PatternRecognitionContext,
	type PredicateContext,
	type PrimaryExpressionContext,
	type QueryContext,
	type QueryNoWithContext,
	type QuerySpecificationContext,
	type QueryTermContext,
	type RelationContext,
	type RelationPrimaryContext,
	type RootQueryContext,
	type SampledRelationContext,
	type SelectItemContext,
	type StatementContext,
	type ValueExpressionContext,
	type WindowSpecificationContext,
} from "../generated/trino/TrinoParser.js";
import type {
	Clause,
	ColumnRef,
	CteDef,
	Expr,
	Join,
	JoinKind,
	LimitInfo,
	Projection,
	QueryBody,
	QueryExpr,
	SelectExpr,
	SetOpExpr,
	Source,
	UnsupportedFlag,
	WindowSpec,
} from "../ir/ir.js";
import { keywordCategory, swallowedCategories, swallowedStatements, type StatementCategory } from "../ir/statement.js";
import { partSpansOf } from "../ir/part-span.js";
import { freezeIR } from "../ir/freeze.js";
import { qualifiedNameOf, type QualifiedName } from "../ir/qualified-name.js";
import { fold, TRINO_NAME_CONFIG } from "./fold.js";

/** The structured name for a table source's raw parts (issue #38) — role assignment + identity
 *  key + fqn happen HERE, at lowering, where the dialect's namespace shape is known. */
function relationOf(rawParts: string[]): QualifiedName {
	return qualifiedNameOf(rawParts, TRINO_NAME_CONFIG);
}

// ---------------------------------------------------------------------------
// Lowering — Trino (the first-party trinodb SqlBase.g4, split in grammars/trino/) CST -> the
// shared, dialect-neutral IR (src/ir/ir.ts). The semantic layer runs on the IR unchanged; only
// this file knows Trino's grammar. The grammar uses labeled alternatives throughout, so
// navigation is instanceof on the generated per-label context classes. A single query statement
// lowers fully; DML with an embedded query lowers that query as the body (flagged); anything
// else becomes a flagged non-query body — a valid parse never throws.
// ---------------------------------------------------------------------------

// trino.io/docs/current/functions/aggregate.html (+ approximate; window-only fns excluded).
const AGGREGATES = new Set([
	"any_value",
	"approx_distinct",
	"approx_most_frequent",
	"approx_percentile",
	"approx_set",
	"arbitrary",
	"array_agg",
	"avg",
	"bitwise_and_agg",
	"bitwise_or_agg",
	"bitwise_xor_agg",
	"bool_and",
	"bool_or",
	"checksum",
	"corr",
	"count",
	"count_if",
	"covar_pop",
	"covar_samp",
	"every",
	"geometric_mean",
	"histogram",
	"kurtosis",
	"listagg",
	"map_agg",
	"map_union",
	"max",
	"max_by",
	"merge",
	"min",
	"min_by",
	"multimap_agg",
	"numeric_histogram",
	"qdigest_agg",
	"regr_intercept",
	"regr_slope",
	"reduce_agg",
	"skewness",
	"stddev",
	"stddev_pop",
	"stddev_samp",
	"string_agg",
	"sum",
	"tdigest_agg",
	"var_pop",
	"var_samp",
	"variance",
]);

interface Ctx {
	/** Named-window definitions in scope (WINDOW w AS (…)), for `OVER w` resolution. */
	windows: Map<string, WindowSpecificationContext>;
}

export function lower(tree: ParserRuleContext): QueryExpr {
	return freezeIR(lowerRoot(tree));
}

function lowerRoot(tree: ParserRuleContext): QueryExpr {
	const statements = tree instanceof RootContext ? tree.statement() : [];
	// Recovery-swallowed statements count toward batch-ness: a broken statement makes recovery dump
	// the rest of the batch as flat error nodes, so the statement count alone under-reports.
	const swallowed = tree instanceof RootContext ? swallowedStatements(tree) : 0;
	const total = statements.length + swallowed;
	if (total === 0) return flagged(tree, "other", "empty");
	if (total > 1) {
		// A multi-statement batch is a flagged compound. Anchor its span to the FIRST statement,
		// NOT the whole `root` container (which reaches EOF): a whole-file span on a flagged body
		// makes a downstream AST index read a bogus enclosure over statements 2..n. Bounding to
		// statement 1 keeps the span honest — the "compound" kind + "multi-statement" flag already
		// tell a consumer this is an unmodelled batch (issue #21).
		return flagged(statements[0] ?? tree, "compound", "multi-statement");
	}
	if (statements.length === 0) return flagged(tree, "other", "broken");
	return lowerStatement(statements[0]);
}

/** Structural per-statement categories over the root's top-level statements (the organizer/gate
 *  bucket source). Mirrors lowerStatement's mapping without building IR. */
export function statementCategories(tree: ParserRuleContext): StatementCategory[] {
	const statements = tree instanceof RootContext ? tree.statement() : [];
	// Recovery-swallowed statements append as "other" — honest count, no keyword guessing.
	return [...statements.map(categoryOf), ...swallowedCategories(tree)];
}

function categoryOf(stmt: StatementContext): StatementCategory {
	if (stmt instanceof StatementDefaultContext) return "query";
	if (
		stmt instanceof InsertIntoContext ||
		stmt instanceof MergeContext ||
		stmt instanceof UpdateContext ||
		stmt instanceof DeleteContext
	)
		return "dml";
	// Everything else begins with its verb — the keyword is the authoritative signal
	// (CREATE/DROP/ALTER/COMMENT → ddl, GRANT/DENY/REVOKE → dcl, COMMIT/… → tcl, SHOW/… → utility).
	// Trino verbs the shared table lacks: PREPARE/DEALLOCATE are session-scoped statement
	// preparation (utility, sql/prepare.md).
	const first = (stmt.start?.text ?? "").toUpperCase();
	if (first === "PREPARE" || first === "DEALLOCATE") return "utility";
	return keywordCategory(first);
}

function flagged(cst: ParserRuleContext, statement: StatementCategory, flag: UnsupportedFlag): QueryExpr {
	return {
		kind: "query",
		statement,
		dialect: "trino",
		ctes: [],
		body: {
			kind: "select",
			projections: [],
			from: [],
			columns: [],
			aggregated: false,
			unsupported: [flag],
			cst,
		},
		cst,
	};
}

function lowerStatement(stmt: StatementContext): QueryExpr {
	if (stmt instanceof StatementDefaultContext) {
		const rq = stmt.rootQueryWithSession();
		const flags: UnsupportedFlag[] = [];
		if (rq.sessionProperty().length > 0) flags.push("session-properties");
		const root = rq.rootQuery();
		if (!root) return flagged(stmt, "query", "broken");
		if (root.functionSpecification().length > 0) flags.push("inline-function");
		const q = lowerQuery(root.query(), { windows: new Map() }, root);
		q.statement = "query";
		q.dialect = "trino";
		if (flags.length && q.body.kind === "select") q.body.unsupported = [...(q.body.unsupported ?? []), ...flags];
		q.cst = stmt;
		return q;
	}
	// INSERT INTO t <query> — the embedded query is real; lower it as the body, category dml.
	if (stmt instanceof InsertIntoContext) {
		const q = lowerRootQuery(stmt.rootQuery(), stmt);
		q.statement = "dml";
		return q;
	}
	// CTAS / CREATE [MATERIALIZED] VIEW — carry queries (in scope); category ddl.
	if (stmt instanceof CreateTableAsSelectContext) {
		const q = lowerRootQuery(stmt.rootQuery(), stmt);
		q.statement = "ddl";
		return q;
	}
	if (stmt instanceof CreateViewContext || stmt instanceof CreateMaterializedViewContext) {
		const q = lowerRootQuery(stmt.rootQuery(), stmt);
		q.statement = "ddl";
		return q;
	}
	// Unmodelled non-query statement: one closed flag, not a class-name-derived vocabulary.
	return flagged(stmt, categoryOf(stmt), "non-query");
}

function lowerRootQuery(root: RootQueryContext | null, cst: ParserRuleContext): QueryExpr {
	if (!root) return flagged(cst, "other", "broken");
	const q = lowerQuery(root.query(), { windows: new Map() }, root);
	if (root.functionSpecification().length > 0 && q.body.kind === "select")
		q.body.unsupported = [...(q.body.unsupported ?? []), "inline-function"];
	q.dialect = "trino";
	q.cst = cst;
	return q;
}

// ---------------------------------------------------------------------------
// Query layer
// ---------------------------------------------------------------------------

// `query`/`queryNoWith` are typed as required (non-null) children by the generated grammar
// accessors, but under error recovery on truncated input (e.g. `CREATE VIEW v AS` with nothing
// following, or a `WITH r AS (SELECT`/`WITH a AS (...), b AS (` with no trailing main query) the
// accessor genuinely returns null at runtime despite its compile-time signature — the same class
// of gap as applyFilter's booleanExpression() guard below. Every call site passes a non-null
// `anchor` (the enclosing, already-live context) so the fallback still gets a real span.
function lowerQuery(query: QueryContext | null, ctx: Ctx, anchor: ParserRuleContext): QueryExpr {
	if (!query) return flagged(anchor, "other", "broken");
	const ctes: CteDef[] = [];
	const withCtx = query.with();
	if (withCtx) for (const nq of withCtx.namedQuery()) ctes.push(lowerNamedQuery(nq, ctx));
	const q = lowerQueryNoWith(query.queryNoWith(), ctx, query);
	q.ctes = ctes;
	q.cst = query;
	return q;
}

function lowerNamedQuery(nq: NamedQueryContext, ctx: Ctx): CteDef {
	const name = nq._name ? idText(nq._name) : "";
	const aliases = nq.columnAliases()?.identifier().map(idText);
	return { name, nameCst: nq._name, columnAliases: aliases, body: lowerQuery(nq.query(), ctx, nq), cst: nq };
}

function lowerQueryNoWith(qnw: QueryNoWithContext | null, ctx: Ctx, anchor: ParserRuleContext): QueryExpr {
	if (!qnw) return flagged(anchor, "other", "broken");
	const term = qnw.queryTerm();
	if (!term) return flagged(qnw, "other", "broken");
	const body = lowerQueryTerm(term, ctx);
	const q: QueryExpr = { kind: "query", ctes: [], body, cst: qnw };
	const ob = qnw.orderBy();
	if (ob) {
		q.orderBy = ob.sortItem().map((s) => lowerExpression(s.expression(), ctx));
		collectInto(q.body, q.orderBy, "orderBy");
	}
	const limit: LimitInfo = {};
	if (qnw._offset) limit.offset = { kind: "literal", text: qnw._offset.getText(), cst: qnw._offset };
	if (qnw._limit && qnw._limit.getText().toUpperCase() !== "ALL")
		limit.top = { kind: "literal", text: qnw._limit.getText(), cst: qnw._limit };
	if (qnw._fetchFirst) limit.fetch = { kind: "literal", text: qnw._fetchFirst.getText(), cst: qnw._fetchFirst };
	if (qnw.FETCH() && !qnw._fetchFirst) limit.fetch = { kind: "literal", text: "1", cst: qnw }; // FETCH FIRST ROW ONLY defaults to 1
	if (limit.top || limit.offset || limit.fetch) q.limit = limit;
	return q;
}

function lowerQueryTerm(term: QueryTermContext, ctx: Ctx): QueryBody {
	if (term instanceof SetOperationContext) {
		const op =
			term._operator?.text?.toLowerCase() === "intersect"
				? "intersect"
				: term._operator?.text?.toLowerCase() === "except"
					? "except"
					: "union";
		const setop: SetOpExpr = {
			kind: "setop",
			op,
			all: term.setQuantifier()?.ALL() != null,
			left: term._left ? lowerQueryTerm(term._left, ctx) : emptySelect(term),
			right: term._right ? lowerQueryTerm(term._right, ctx) : emptySelect(term),
			columns: [],
			cst: term,
		};
		// CORRESPONDING [BY (…)] — branch columns align by NAME (SQL standard; Trino 470+).
		if (term.corresponding()) setop.byName = true;
		return setop;
	}
	const prim = (term as QueryPrimaryDefaultContext | ParserRuleContext).getChild(0);
	return lowerQueryPrimary(term.getChild(0) as ParserRuleContext, term, ctx);
}

function lowerQueryPrimary(prim: ParserRuleContext, holder: ParserRuleContext, ctx: Ctx): QueryBody {
	const node =
		holder instanceof QueryPrimaryDefaultContext ||
		holder instanceof TableContext ||
		holder instanceof InlineTableContext ||
		holder instanceof SubqueryContext
			? holder
			: prim;
	if (node instanceof QueryPrimaryDefaultContext) return lowerQuerySpecification(node.querySpecification(), ctx);
	if (node instanceof TableContext) {
		// TABLE t — equivalent to SELECT * FROM t (modelled, not flagged).
		const qn = node.qualifiedName();
		const name = nameParts(qn);
		const src: Source = {
			kind: "table",
			relation: relationOf(name),
			namePartSpans: namePartSpans(qn),
			cst: node,
		};
		return {
			kind: "select",
			projections: [{ isStar: true, expr: { kind: "star", cst: node }, cst: node }],
			from: [src],
			columns: [],
			aggregated: false,
			cst: node,
		};
	}
	if (node instanceof InlineTableContext) {
		// VALUES (…), (…) — a modelled select whose projections are the first row's expressions.
		const rows = node.expression();
		const first = rows[0];
		const projections: Projection[] =
			first == null ? [] : rowExprs(first, ctx).map((e) => ({ isStar: false, expr: e, cst: e.cst }));
		return { kind: "select", projections, from: [], columns: [], aggregated: false, cst: node };
	}
	if (node instanceof SubqueryContext) {
		const inner = lowerQueryNoWith(node.queryNoWith(), ctx, node);
		// A parenthesized query nests orderBy/limit; keep it as the body when trivial, else subquery-wrap.
		if (!inner.orderBy && !inner.limit && inner.ctes.length === 0) return inner.body;
		return {
			kind: "select",
			projections: [{ isStar: true, expr: { kind: "star", cst: node }, cst: node }],
			from: [{ kind: "subquery", query: inner, cst: node }],
			columns: [],
			aggregated: false,
			cst: node,
		};
	}
	return emptySelect(holder);
}

/** VALUES row: `(a, b)` rowConstructor → its item expressions; a bare expression → itself. */
function rowExprs(e: ExpressionContext, ctx: Ctx): Expr[] {
	const be = e.booleanExpression();
	if (be instanceof PredicatedContext && !be.predicate()) {
		const ve = be.valueExpression();
		if (ve instanceof ValueExpressionDefaultContext) {
			const pe = ve.primaryExpression();
			if (pe instanceof RowConstructorContext) {
				const items = pe.expression();
				if (items.length > 0) return items.map((x) => lowerExpression(x, ctx));
				const fields = pe.fieldConstructor();
				if (fields.length > 0) return fields.map((f) => lowerExpression(f.expression(), ctx));
			}
		}
	}
	return [lowerExpression(e, ctx)];
}

function emptySelect(cst: ParserRuleContext): SelectExpr {
	return { kind: "select", projections: [], from: [], columns: [], aggregated: false, cst };
}

function lowerQuerySpecification(spec: QuerySpecificationContext, ctx: Ctx): SelectExpr {
	// Named windows (WINDOW w AS (…)) go into scope FIRST so projections' OVER w resolve.
	const local: Ctx = { windows: new Map(ctx.windows) };
	for (const wd of spec.windowDefinition()) {
		if (wd._name) local.windows.set(fold(wd._name.getText()), wd.windowSpecification());
	}

	const select = emptySelect(spec);
	const flags = new Set<UnsupportedFlag>();

	for (const item of spec.selectItem()) select.projections.push(lowerSelectItem(item, local));

	const joinConditions: Expr[] = [];
	const joins: Join[] = [];
	for (const rel of spec.relation())
		lowerRelation(rel, select.from, joinConditions, joins, select.columns, flags, local);
	if (joinConditions.length) select.joinConditions = joinConditions;
	if (joins.length) select.joins = joins;

	if (spec._where) {
		select.where = lowerBoolean(spec._where, local);
		collectColumns(select.where, "where", select.columns);
	}
	const gb = spec.groupBy();
	if (gb) {
		select.groupBy = [];
		for (const ge of gb.groupingElement()) lowerGroupingElement(ge, select.groupBy, flags, local);
		collectInto(select, select.groupBy, "groupBy");
		select.aggregated = true;
	}
	if (spec._having) {
		select.having = lowerBoolean(spec._having, local);
		collectColumns(select.having, "having", select.columns);
	}

	for (const p of select.projections) collectColumns(p.expr, "projection", select.columns);
	if (!select.aggregated)
		select.aggregated =
			select.projections.some((p) => hasAggregate(p.expr)) ||
			(select.having != null && hasAggregate(select.having));

	const subs: QueryExpr[] = [];
	collectSubqueries(select, subs);
	if (subs.length) select.subqueries = subs;
	if (flags.size) select.unsupported = [...flags];
	return select;
}

function lowerGroupingElement(ge: GroupingElementContext, out: Expr[], flags: Set<UnsupportedFlag>, ctx: Ctx): void {
	// Every grouping key is captured, including each one inside ROLLUP/CUBE/GROUPING SETS.
	if (ge instanceof AutoContext) {
		// GROUP BY AUTO — keys inferred by the engine; nothing textual to capture.
		flags.add("group-by-auto");
		return;
	}
	// singleGroupingSet's accessor yields ONE groupingSet; rollup/cube/GROUPING SETS yield arrays.
	const raw = (
		ge as ParserRuleContext & { groupingSet?: () => ParserRuleContext | ParserRuleContext[] | null }
	).groupingSet?.();
	const sets = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
	for (const gs of sets) {
		const exprsRaw = (
			gs as ParserRuleContext & { expression?: () => ExpressionContext | ExpressionContext[] | null }
		).expression?.();
		const exprs = exprsRaw == null ? [] : Array.isArray(exprsRaw) ? exprsRaw : [exprsRaw];
		for (const e of exprs) out.push(lowerExpression(e, ctx));
	}
}

function lowerSelectItem(item: SelectItemContext, ctx: Ctx): Projection {
	if (item instanceof SelectSingleContext) {
		const expr = lowerExpression(item.expression(), ctx);
		const alias = item.identifier();
		const name = alias ? idText(alias) : expr.kind === "column" ? expr.parts[expr.parts.length - 1] : undefined;
		return { name, isStar: false, expr, cst: item, ...(alias ? { aliasCst: alias } : {}) } as Projection;
	}
	if (item instanceof SelectAllContext) {
		const qualExpr = item.primaryExpression();
		let qualifier: string[] | undefined;
		if (qualExpr) qualifier = pathParts(qualExpr) ?? [qualExpr.getText()];
		return { isStar: true, expr: { kind: "star", qualifier, cst: item }, cst: item };
	}
	// Broken/recovered input: neither labeled alternative matched (an error node) — never throw.
	return { isStar: false, expr: other(item), cst: item };
}

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

function lowerRelation(
	rel: RelationContext,
	out: Source[],
	joinConditions: Expr[],
	joins: Join[],
	columns: ColumnRef[],
	flags: Set<UnsupportedFlag>,
	ctx: Ctx,
): void {
	if (rel instanceof JoinRelationContext) {
		const j = rel;
		if (j._left) lowerRelation(j._left, out, joinConditions, joins, columns, flags, ctx);
		// The right operand's FIRST source is the join's right source (reference-identical to the from
		// entry just pushed). `relation` is left-recursive, so `j`'s span includes the left input — the
		// join.cst is therefore cumulative (base…ON), unlike the isolated `JOIN x ON …` of other dialects.
		const idx = out.length;
		if (j._rightRelation) lowerRelation(j._rightRelation, out, joinConditions, joins, columns, flags, ctx);
		if (j._right) lowerSampledRelation(j._right, out, flags, ctx);
		const source = out[idx] ?? out[out.length - 1];
		const crit = j.joinCriteria();
		let on: Expr | undefined;
		let using: string[] | undefined;
		if (crit) {
			const onB = crit.booleanExpression();
			if (onB) {
				on = lowerBoolean(onB, ctx);
				joinConditions.push(on);
				collectColumns(on, "join", columns);
			}
			const ids = crit.identifier();
			if (ids.length) using = ids.map((id) => idText(id));
			for (const id of ids)
				columns.push({
					kind: "columnref",
					parts: [idText(id)],
					clause: "join",
					cst: id,
					partSpans: partSpansOf([id]),
				});
		}
		if (source) joins.push(buildTrinoJoin(j, source, on, using));
		return;
	}
	const sampled = (
		rel as ParserRuleContext & { sampledRelation(): SampledRelationContext | null }
	).sampledRelation?.();
	if (sampled) lowerSampledRelation(sampled, out, flags, ctx);
}

/** Assemble a Join from a Trino JoinRelation: CROSS / joinType JOIN / NATURAL joinType JOIN. */
function buildTrinoJoin(
	j: JoinRelationContext,
	source: Source,
	on: Expr | undefined,
	using: string[] | undefined,
): Join {
	const natural = j.NATURAL() != null;
	let kind: JoinKind;
	if (j.CROSS() != null) {
		kind = "cross";
	} else {
		const jt = j.joinType();
		let ansi: JoinKind | undefined;
		if (jt) {
			if (jt.LEFT()) ansi = "left";
			else if (jt.RIGHT()) ansi = "right";
			else if (jt.FULL()) ansi = "full";
			else if (jt.INNER()) ansi = "inner";
			// else: a bare (empty) joinType — leave ansi undefined so `NATURAL JOIN` reads as "natural"
		}
		kind = ansi ?? (natural ? "natural" : "inner");
	}
	return { kind, source, on, using, natural: natural || undefined, cst: j };
}

function lowerSampledRelation(sr: SampledRelationContext, out: Source[], flags: Set<UnsupportedFlag>, ctx: Ctx): void {
	const pr = sr.patternRecognition();
	lowerPatternRecognition(pr, out, flags, ctx);
}

function lowerPatternRecognition(
	pr: PatternRecognitionContext,
	out: Source[],
	flags: Set<UnsupportedFlag>,
	ctx: Ctx,
): void {
	const aliased = pr.aliasedRelation();
	if (pr.MATCH_RECOGNIZE()) {
		// MATCH_RECOGNIZE transforms the relation via row-pattern matching. The base relation stays
		// visible; the transform is flagged (its MEASURES/DEFINE refs bind pattern variables, a
		// namespace the IR does not model) — visible gap, not a silent drop.
		flags.add("match_recognize");
	}
	lowerAliasedRelation(aliased, out, flags, ctx);
	if (pr.MATCH_RECOGNIZE()) {
		// AS alias (columnAliases) after the closing paren renames the LAST source.
		const alias = pr.identifier();
		const last = out[out.length - 1];
		if (alias && last) {
			(last as { alias?: string }).alias = idText(alias);
			(last as { aliasCst?: ParserRuleContext }).aliasCst = alias;
			const cas = pr.columnAliases();
			if (cas) (last as { columnAliases?: string[] }).columnAliases = cas.identifier().map(idText);
		}
	}
}

function lowerAliasedRelation(ar: AliasedRelationContext, out: Source[], flags: Set<UnsupportedFlag>, ctx: Ctx): void {
	const src = lowerRelationPrimary(ar.relationPrimary(), out, flags, ctx);
	if (!src) return;
	const alias = ar.identifier();
	if (alias) {
		src.alias = idText(alias);
		(src as { aliasCst?: ParserRuleContext }).aliasCst = alias;
	}
	const cas = ar.columnAliases();
	if (cas && (src.kind === "table" || src.kind === "subquery" || src.kind === "lateral")) {
		const names = cas.identifier().map(idText);
		if (src.kind === "lateral") src.columns = names;
		else src.columnAliases = names;
	}
	out.push(src);
}

function lowerRelationPrimary(
	rp: RelationPrimaryContext,
	out: Source[],
	flags: Set<UnsupportedFlag>,
	ctx: Ctx,
): (Source & { alias?: string }) | null {
	if (rp instanceof TableNameContext) {
		const qn = rp.qualifiedName();
		const name = nameParts(qn);
		return { kind: "table", relation: relationOf(name), namePartSpans: namePartSpans(qn), cst: rp };
	}
	if (rp instanceof SubqueryRelationContext) {
		return { kind: "subquery", query: lowerQuery(rp.query(), ctx, rp), cst: rp };
	}
	if (rp instanceof UnnestContext) {
		// UNNEST(a, b) [WITH ORDINALITY] — a lateral relation; its output columns come from the
		// enclosing aliasedRelation's column list (AS u(x, o)), applied by the caller.
		return { kind: "lateral", columns: [], cst: rp };
	}
	if (rp instanceof LateralContext) {
		return { kind: "subquery", query: lowerQuery(rp.query(), ctx, rp), cst: rp };
	}
	if (rp instanceof TableFunctionInvocationContext) {
		// TABLE(tvf(…)) — an opaque source: columns come from the TVF's signature (unknown without
		// a catalog — the never-wrong contract). Embedded TABLE(name/query) arguments stay visible
		// as additional sources so their columns resolve.
		const call = rp.tableFunctionCall();
		const qn = call?.qualifiedName();
		const name = qn ? nameParts(qn) : ["table_function"];
		return {
			kind: "table",
			relation: relationOf(name),
			namePartSpans: qn ? namePartSpans(qn) : undefined,
			cst: rp,
		};
	}
	if (rp instanceof ParenthesizedRelationContext) {
		const inner: Source[] = [];
		const conditions: Expr[] = [];
		const cols: ColumnRef[] = [];
		// A paren-group's join nodes aren't modelled (only the top-level FROM chain builds Join[] — see
		// the spec); its sources + ON conditions flow up as before.
		lowerRelation(rp.relation(), inner, conditions, [], cols, flags, ctx);
		// A parenthesized JOIN contributes all its sources; a single relation passes through.
		if (inner.length === 1 && conditions.length === 0) return inner[0] as Source & { alias?: string };
		for (const s of inner) out.push(s);
		return null;
	}
	if (rp instanceof JsonTableContext) {
		// JSON_TABLE(json, path COLUMNS(…)) — the COLUMNS names (nested included) become the
		// source's output columns, same as the PostgreSQL lowering.
		const names: string[] = [];
		for (const col of rp.jsonTableColumn()) collectJsonTableColumns(col, names);
		return { kind: "lateral", columns: names, cst: rp };
	}
	if (rp instanceof NearestContext) {
		// NEAREST(FROM rel WHERE … MATCH …) — a filtered view of rel (Trino 482 vector search):
		// modelled as a subquery over the inner relation so its columns flow through.
		const inner: SelectExpr = emptySelect(rp);
		const conditions: Expr[] = [];
		lowerRelation(rp.relation(), inner.from, conditions, [], inner.columns, flags, ctx);
		inner.projections.push({ isStar: true, expr: { kind: "star", cst: rp }, cst: rp });
		if (rp._where) {
			inner.where = lowerBoolean(rp._where, ctx);
			collectColumns(inner.where, "where", inner.columns);
		}
		if (rp._match) {
			const m = lowerBoolean(rp._match, ctx);
			inner.joinConditions = [m];
			collectColumns(m, "join", inner.columns);
		}
		return { kind: "subquery", query: { kind: "query", ctes: [], body: inner, cst: rp }, cst: rp };
	}
	return null;
}

function collectJsonTableColumns(col: JsonTableColumnContext, out: string[]): void {
	if (
		col instanceof OrdinalityColumnContext ||
		col instanceof ValueColumnContext ||
		col instanceof QueryColumnContext
	) {
		const id = col.identifier();
		if (id) out.push(idText(id));
		return;
	}
	// NestedColumnsContext — recurse into COLUMNS(…).
	for (const inner of (
		col as ParserRuleContext & { jsonTableColumn(): JsonTableColumnContext[] }
	).jsonTableColumn?.() ?? [])
		collectJsonTableColumns(inner, out);
}

// ---------------------------------------------------------------------------
// Expressions
// ---------------------------------------------------------------------------

function lowerExpression(e: ExpressionContext, ctx: Ctx): Expr {
	return lowerBoolean(e.booleanExpression(), ctx);
}

function lowerBoolean(be: BooleanExpressionContext, ctx: Ctx): Expr {
	if (be instanceof PredicatedContext) {
		const value = lowerValue(be.valueExpression(), ctx);
		const pred = be.predicate();
		return pred ? lowerPredicate(pred, value, ctx) : value;
	}
	if (be instanceof LogicalNotContext) {
		return { kind: "unary", op: "NOT", operand: lowerBoolean(be.booleanExpression(), ctx), cst: be };
	}
	if (be instanceof AndContext || be instanceof OrContext) {
		const parts = be.booleanExpression();
		return {
			kind: "binary",
			op: be instanceof AndContext ? "AND" : "OR",
			left: lowerBoolean(parts[0], ctx),
			right: lowerBoolean(parts[1], ctx),
			cst: be,
		};
	}
	return other(be);
}

function lowerPredicate(pred: PredicateContext, operand: Expr, ctx: Ctx): Expr {
	if (pred instanceof ComparisonContext) {
		return {
			kind: "binary",
			op: pred.comparisonOperator().getText(),
			left: operand,
			right: pred._right ? lowerValue(pred._right, ctx) : other(pred),
			cst: pred,
		};
	}
	if (pred instanceof QuantifiedComparisonContext) {
		return {
			kind: "predicate",
			op: `${pred.comparisonOperator().getText()} ${pred.comparisonQuantifier().getText().toLowerCase()}`,
			negated: false,
			operand,
			args: [subqueryExpr(pred.query(), pred, ctx)],
			cst: pred,
		};
	}
	if (pred instanceof BetweenContext) {
		return {
			kind: "predicate",
			op: "between",
			negated: pred.NOT() != null,
			operand,
			args: [
				pred._lower ? lowerValue(pred._lower, ctx) : other(pred),
				pred._upper ? lowerValue(pred._upper, ctx) : other(pred),
			],
			cst: pred,
		};
	}
	if (pred instanceof InListContext) {
		return {
			kind: "predicate",
			op: "in",
			negated: pred.NOT() != null,
			operand,
			args: pred.expression().map((x) => lowerExpression(x, ctx)),
			cst: pred,
		};
	}
	if (pred instanceof InSubqueryContext) {
		return {
			kind: "predicate",
			op: "in",
			negated: pred.NOT() != null,
			operand,
			args: [subqueryExpr(pred.query(), pred, ctx)],
			cst: pred,
		};
	}
	if (pred instanceof LikeContext) {
		const args = [pred._pattern ? lowerValue(pred._pattern, ctx) : other(pred)];
		if (pred._escape) args.push(lowerValue(pred._escape, ctx));
		return { kind: "predicate", op: "like", negated: pred.NOT() != null, operand, args, cst: pred };
	}
	if (pred instanceof NullPredicateContext) {
		return { kind: "predicate", op: "null", negated: pred.NOT() != null, operand, args: [], cst: pred };
	}
	if (pred instanceof BooleanTestContext) {
		return {
			kind: "predicate",
			op: pred._truthValue?.text?.toLowerCase() ?? "true",
			negated: pred.NOT() != null,
			operand,
			args: [],
			cst: pred,
		};
	}
	if (pred instanceof DistinctFromContext) {
		return {
			kind: "predicate",
			op: "distinct from",
			negated: pred.NOT() != null,
			operand,
			args: [pred._right ? lowerValue(pred._right, ctx) : other(pred)],
			cst: pred,
		};
	}
	if (pred instanceof MatchContext) {
		return {
			kind: "predicate",
			op: "match",
			negated: false,
			operand,
			args: [subqueryExpr(pred.query(), pred, ctx)],
			cst: pred,
		};
	}
	return other(pred);
}

function lowerValue(ve: ValueExpressionContext, ctx: Ctx): Expr {
	if (ve instanceof ValueExpressionDefaultContext) return lowerPrimary(ve.primaryExpression(), ctx);
	if (ve instanceof AtTimeZoneContext) {
		const tz = ve.timeZoneSpecifier();
		const zone: Expr = { kind: "literal", text: tz.getText(), cst: tz };
		return {
			kind: "binary",
			op: "AT TIME ZONE",
			left: lowerValue(ve.valueExpression(), ctx),
			right: zone,
			cst: ve,
		};
	}
	if (ve instanceof AtLocalContext) {
		return { kind: "unary", op: "AT LOCAL", operand: lowerValue(ve.valueExpression(), ctx), cst: ve };
	}
	if (ve instanceof ArithmeticUnaryContext) {
		return {
			kind: "unary",
			op: ve._operator?.text ?? "-",
			operand: lowerValue(ve.valueExpression(), ctx),
			cst: ve,
		};
	}
	if (ve instanceof ArithmeticBinaryContext) {
		return {
			kind: "binary",
			op: ve._operator?.text ?? "?",
			left: ve._left ? lowerValue(ve._left, ctx) : other(ve),
			right: ve._right ? lowerValue(ve._right, ctx) : other(ve),
			cst: ve,
		};
	}
	if (ve instanceof ConcatenationContext) {
		return {
			kind: "binary",
			op: "||",
			left: ve._left ? lowerValue(ve._left, ctx) : other(ve),
			right: ve._right ? lowerValue(ve._right, ctx) : other(ve),
			cst: ve,
		};
	}
	return other(ve);
}

function lowerPrimary(pe: PrimaryExpressionContext, ctx: Ctx): Expr {
	if (pe instanceof LiteralsContext) return { kind: "literal", text: pe.getText(), cst: pe };
	// `?` is Trino's only bind-parameter form (trino.io/docs/current/sql/execute.html); the CST
	// gives no ordinal, so this stays a bare parameter (the consumer's own derivation).
	if (pe instanceof ParameterContext) return { kind: "parameter", text: "?", cst: pe };
	if (pe instanceof PositionContext) {
		return fn(
			pe,
			"position",
			pe.valueExpression().map((v) => lowerValue(v, ctx)),
		);
	}
	if (pe instanceof RowConstructorContext) {
		const items = pe.expression().map((x) => lowerExpression(x, ctx));
		const fields = pe.fieldConstructor().map((f) => lowerExpression(f.expression(), ctx));
		return fn(pe, "row", items.length ? items : fields);
	}
	if (pe instanceof ListaggContext) {
		const args = [lowerExpression(pe.expression(), ctx)];
		const sep = pe.string();
		if (sep) args.push({ kind: "literal", text: sep.getText(), cst: sep });
		const call = fn(pe, "listagg", args, { aggregate: true, distinct: pe.setQuantifier()?.DISTINCT() != null });
		// WITHIN GROUP (ORDER BY …) keys ride as trailing args so their columns resolve.
		const ob = pe.orderBy();
		if (ob && call.kind === "function")
			call.args.push(...ob.sortItem().map((s) => lowerExpression(s.expression(), ctx)));
		applyOver(call, pe.over(), ctx);
		applyFilter(call, pe.filter(), ctx);
		return call;
	}
	if (pe instanceof FunctionCallContext) {
		const name = nameParts(pe.qualifiedName()).join(".").toLowerCase();
		const args: Expr[] = [];
		if (pe.ASTERISK()) {
			const label = pe._label ? [idText(pe._label)] : undefined;
			args.push({ kind: "star", qualifier: label, cst: pe });
		}
		for (const a of pe.argument()) args.push(lowerArgument(a, ctx));
		const call = fn(pe, name, args, {
			aggregate: AGGREGATES.has(name.split(".").pop() ?? name),
			distinct: pe.setQuantifier()?.DISTINCT() != null,
		});
		// An ORDER BY inside the call (ordered-set aggregates) — keys as trailing args (columns resolve;
		// arity-sensitive inference rules read args[0] only, so the type contract stays never-wrong).
		const ob = pe.orderBy();
		if (ob && call.kind === "function")
			call.args.push(...ob.sortItem().map((s) => lowerExpression(s.expression(), ctx)));
		applyOver(call, pe.over(), ctx);
		applyFilter(call, pe.filter(), ctx);
		return call;
	}
	if (pe instanceof StaticMethodCallContext) {
		const name = `${pe.qualifiedName().getText()}::${pe.methodName().getText()}`.toLowerCase();
		return fn(
			pe,
			name,
			pe.argument().map((a) => lowerArgument(a, ctx)),
		);
	}
	if (pe instanceof MethodCallContext) {
		// x.f(y) — method-call sugar for f(x, y) (the engine's dispatch); lowered that way so the
		// registry sees the real function.
		const base = lowerPrimary(pe.primaryExpression(), ctx);
		const name = pe.methodName().getText().toLowerCase();
		const args = [base, ...pe.argument().map((a) => lowerArgument(a, ctx))];
		return fn(pe, name, args);
	}
	if (pe instanceof MeasureContext) {
		const call = fn(pe, fold(pe.identifier().getText()), []);
		applyOver(call, pe.over(), ctx);
		return call;
	}
	if (pe instanceof LambdaContext) {
		return {
			kind: "lambda",
			params: pe.identifier().map(idText),
			body: lowerExpression(pe.expression(), ctx),
			cst: pe,
		};
	}
	if (pe instanceof SubqueryExpressionContext) return subqueryExpr(pe.query(), pe, ctx);
	if (pe instanceof ExistsContext) {
		return { kind: "exists", query: lowerQuery(pe.query(), ctx, pe), cst: pe };
	}
	if (pe instanceof UniqueContext) {
		return fn(pe, "unique", [subqueryExpr(pe.query(), pe, ctx)]);
	}
	if (pe instanceof SimpleCaseContext) {
		const operand = pe._operand ? lowerExpression(pe._operand, ctx) : other(pe);
		const whens = pe.simpleWhenClause().map((w) => {
			const partial = w._partial;
			const when = partial
				? lowerPredicate(partial, operand, ctx)
				: w._condition
					? lowerExpression(w._condition, ctx)
					: other(w);
			return { when, then: w._result ? lowerExpression(w._result, ctx) : other(w) };
		});
		return {
			kind: "case",
			whens: [{ when: operand, then: operand }, ...whens].slice(1), // operand columns collected via whens
			elseExpr: pe._elseExpression ? lowerExpression(pe._elseExpression, ctx) : undefined,
			cst: pe,
		};
	}
	if (pe instanceof SearchedCaseContext) {
		return {
			kind: "case",
			whens: pe.searchedWhenClause().map((w) => ({
				when: w._condition ? lowerExpression(w._condition, ctx) : other(w),
				then: w._result ? lowerExpression(w._result, ctx) : other(w),
			})),
			elseExpr: pe._elseExpression ? lowerExpression(pe._elseExpression, ctx) : undefined,
			cst: pe,
		};
	}
	if (pe instanceof CastContext) {
		return { kind: "cast", expr: lowerExpression(pe.expression(), ctx), typeText: pe.type().getText(), cst: pe };
	}
	if (pe instanceof ArrayConstructorContext) {
		return fn(
			pe,
			"array",
			pe.expression().map((x) => lowerExpression(x, ctx)),
		);
	}
	if (pe instanceof SubscriptContext) {
		return {
			kind: "subscript",
			base: pe._value ? lowerPrimary(pe._value, ctx) : other(pe),
			index: pe._index ? lowerValue(pe._index, ctx) : other(pe),
			cst: pe,
		};
	}
	if (pe instanceof ColumnReferenceContext) {
		return { kind: "column", parts: [idText(pe.identifier())], partSpans: partSpansOf([pe.identifier()]), cst: pe };
	}
	if (pe instanceof DereferenceContext) {
		const parts = pathParts(pe);
		if (parts) return { kind: "column", parts, partSpans: pathPartSpans(pe), cst: pe };
		// Field access on a non-name base ((CAST(… AS ROW(…))).x): subscript with a literal field —
		// element access whose type stays unknown unless the base type is known (never-wrong).
		return {
			kind: "subscript",
			base: pe._base ? lowerPrimary(pe._base, ctx) : other(pe),
			index: { kind: "literal", text: `'${pe._fieldName ? idText(pe._fieldName) : ""}'`, cst: pe },
			cst: pe,
		};
	}
	if (
		pe instanceof CurrentDateContext ||
		pe instanceof CurrentTimeContext ||
		pe instanceof CurrentTimestampContext ||
		pe instanceof LocalTimeContext ||
		pe instanceof LocalTimestampContext ||
		pe instanceof CurrentUserContext ||
		pe instanceof CurrentCatalogContext ||
		pe instanceof CurrentSchemaContext ||
		pe instanceof CurrentPathContext
	) {
		const name = pe._name?.text ?? pe.getText();
		return fn(pe, name.toLowerCase(), []);
	}
	if (pe instanceof TrimContext) {
		const args: Expr[] = [];
		if (pe._trimChar) args.push(lowerValue(pe._trimChar, ctx));
		if (pe._trimSource) args.push(lowerValue(pe._trimSource, ctx));
		return fn(pe, "trim", args);
	}
	if (pe instanceof SubstringContext) {
		return fn(
			pe,
			"substring",
			pe.valueExpression().map((v) => lowerValue(v, ctx)),
		);
	}
	if (pe instanceof OverlayContext) {
		const args = [pe._source, pe._replacement, pe._start, pe._length]
			.filter((x): x is ValueExpressionContext => x != null)
			.map((v) => lowerValue(v, ctx));
		return fn(pe, "overlay", args);
	}
	if (pe instanceof NormalizeContext) {
		return fn(pe, "normalize", pe.valueExpression() ? [lowerValue(pe.valueExpression()!, ctx)] : []);
	}
	if (pe instanceof ExtractContext) {
		const field: Expr = { kind: "literal", text: `'${pe.identifier().getText()}'`, cst: pe.identifier() };
		return fn(pe, "extract", [field, lowerValue(pe.valueExpression(), ctx)]);
	}
	if (pe instanceof ParenthesizedExpressionContext) return lowerExpression(pe.expression(), ctx);
	if (pe instanceof GroupingOperationContext) {
		return fn(
			pe,
			"grouping",
			pe
				.qualifiedName()
				.map((qn) => ({ kind: "column", parts: nameParts(qn), partSpans: namePartSpans(qn), cst: qn }) as Expr),
		);
	}
	if (pe instanceof JsonExistsContext || pe instanceof JsonValueContext || pe instanceof JsonQueryContext) {
		const inv = pe.jsonPathInvocation();
		const args: Expr[] = [lowerExpression(inv.jsonValueExpression().expression(), ctx)];
		const path = inv._path;
		if (path) args.push({ kind: "literal", text: path.getText(), cst: path });
		for (const ja of inv.jsonArgument()) args.push(lowerExpression(ja.jsonValueExpression().expression(), ctx));
		const name =
			pe instanceof JsonExistsContext
				? "json_exists"
				: pe instanceof JsonValueContext
					? "json_value"
					: "json_query";
		return fn(pe, name, args);
	}
	if (pe instanceof JsonObjectContext) {
		const args: Expr[] = [];
		for (const m of pe.jsonObjectMember()) {
			args.push(lowerExpression(m.expression(), ctx));
			args.push(lowerExpression(m.jsonValueExpression().expression(), ctx));
		}
		return fn(pe, "json_object", args);
	}
	if (pe instanceof JsonArrayContext) {
		return fn(
			pe,
			"json_array",
			pe.jsonValueExpression().map((v) => lowerExpression(v.expression(), ctx)),
		);
	}
	return other(pe);
}

/** argument: #positionalArgument (expression) | #namedArgument (identifier => expression) —
 *  the value expression lowers either way (the name is call metadata, not a column). */
function lowerArgument(a: ArgumentContext, ctx: Ctx): Expr {
	const e = (a as ParserRuleContext & { expression(): ExpressionContext | null }).expression?.();
	return e ? lowerExpression(e, ctx) : other(a);
}

function subqueryExpr(query: QueryContext | null, cst: ParserRuleContext, ctx: Ctx): Expr {
	return { kind: "subquery", query: lowerQuery(query, ctx, cst), cst };
}

function fn(
	cst: ParserRuleContext,
	name: string,
	args: Expr[],
	opts: { aggregate?: boolean; distinct?: boolean } = {},
): Expr {
	return {
		kind: "function",
		name,
		args,
		aggregate: opts.aggregate ?? AGGREGATES.has(name),
		distinct: opts.distinct ?? false,
		cst,
	};
}

function other(cst: ParserRuleContext): Expr {
	return { kind: "other", text: cst.getText().slice(0, 80), cst };
}

function applyFilter(call: Expr, filter: ParserRuleContext | null, ctx: Ctx): void {
	if (!filter || call.kind !== "function") return;
	// FILTER (WHERE cond) — the predicate rides as a trailing arg so its columns resolve.
	// booleanExpression() can be null on error-recovered/truncated input (e.g. a broken
	// "FILTER (" at EOF) despite its non-null compile-time signature — guard like the
	// joinCriteria() booleanExpression() site above.
	const be = (filter as ParserRuleContext & { booleanExpression(): BooleanExpressionContext }).booleanExpression();
	if (!be) return;
	call.args.push(lowerBoolean(be, ctx));
}

function applyOver(call: Expr, over: OverContext | null, ctx: Ctx): void {
	if (!over || call.kind !== "function") return;
	const spec = resolveWindow(over, ctx);
	if (!spec) {
		call.window = { partitionBy: [], orderBy: [], cst: over };
		return;
	}
	call.window = lowerWindowSpec(spec, ctx);
}

function resolveWindow(over: OverContext, ctx: Ctx): WindowSpecificationContext | null {
	const direct = over.windowSpecification();
	if (direct) return direct;
	const name = over._windowName ? fold(over._windowName.getText()) : null;
	return name ? (ctx.windows.get(name) ?? null) : null;
}

function lowerWindowSpec(spec: WindowSpecificationContext, ctx: Ctx, depth = 0): WindowSpec {
	const out: WindowSpec = { partitionBy: [], orderBy: [], cst: spec };
	// A named window may extend another (existingWindowName); chain, cycle-guarded by depth.
	if (spec._existingWindowName && depth < 8) {
		const base = ctx.windows.get(fold(spec._existingWindowName.getText()));
		if (base) {
			const inherited = lowerWindowSpec(base, ctx, depth + 1);
			out.partitionBy.push(...inherited.partitionBy);
			out.orderBy.push(...inherited.orderBy);
		}
	}
	for (const p of spec._partition ?? []) out.partitionBy.push(lowerExpression(p, ctx));
	const ob = spec.orderBy();
	if (ob) out.orderBy.push(...ob.sortItem().map((s) => lowerExpression(s.expression(), ctx)));
	return out;
}

// ---------------------------------------------------------------------------
// Column / subquery collection
// ---------------------------------------------------------------------------

/** Identifier text, RAW — delimiters intact (quotedness must survive into the IR; comparisons
 *  fold via foldIdentifier, display via displayName). */
function idText(id: ParserRuleContext | TerminalNode): string {
	return id.getText();
}

function nameParts(qn: ParserRuleContext | null): string[] {
	if (!qn) return [];
	const parts: string[] = [];
	for (const id of (qn as ParserRuleContext & { identifier(): ParserRuleContext[] }).identifier?.() ?? [])
		parts.push(idText(id));
	return parts.length ? parts : [qn.getText()];
}

/** A pure dotted-name chain (identifier(.identifier)*) → its parts; anything else → null. */
function pathParts(pe: ParserRuleContext): string[] | null {
	if (pe instanceof ColumnReferenceContext) return [idText(pe.identifier())];
	if (pe instanceof DereferenceContext) {
		const base = pe._base ? pathParts(pe._base) : null;
		if (!base || !pe._fieldName) return null;
		return [...base, idText(pe._fieldName)];
	}
	if (pe instanceof ParenthesizedExpressionContext) return null;
	return null;
}

/** Per-part spans PARALLEL to nameParts(qn) — one span per identifier (its quote delimiters
 *  included), all-or-nothing: undefined when qn has no identifier children (nameParts then falls
 *  back to getText()). One shared span-capture seam (reused by the editor-gold rewrite). */
function namePartSpans(qn: ParserRuleContext | null) {
	if (!qn) return undefined;
	const ids = (qn as ParserRuleContext & { identifier(): ParserRuleContext[] }).identifier?.() ?? [];
	return ids.length ? partSpansOf(ids) : undefined;
}

/** Per-part spans PARALLEL to pathParts(pe) — the identifier chain's per-part spans, all-or-nothing:
 *  undefined when pe isn't a pure dotted-name chain (matches pathParts returning null). */
function pathPartSpans(pe: ParserRuleContext) {
	const nodes = pathPartNodes(pe);
	return nodes ? partSpansOf(nodes) : undefined;
}

function pathPartNodes(pe: ParserRuleContext): ParseTree[] | null {
	if (pe instanceof ColumnReferenceContext) return [pe.identifier()];
	if (pe instanceof DereferenceContext) {
		const base = pe._base ? pathPartNodes(pe._base) : null;
		if (!base || !pe._fieldName) return null;
		return [...base, pe._fieldName];
	}
	return null;
}

function collectColumns(e: Expr, clause: Clause, out: ColumnRef[]): void {
	switch (e.kind) {
		case "column":
			out.push({ kind: "columnref", parts: e.parts, clause, cst: e.cst, partSpans: e.partSpans });
			return;
		case "star":
			return;
		case "binary":
			collectColumns(e.left, clause, out);
			collectColumns(e.right, clause, out);
			return;
		case "unary":
			collectColumns(e.operand, clause, out);
			return;
		case "function":
			for (const a of e.args) collectColumns(a, clause, out);
			if (e.window) {
				for (const p of e.window.partitionBy) collectColumns(p, clause, out);
				for (const o of e.window.orderBy) collectColumns(o, clause, out);
			}
			return;
		case "case":
			for (const w of e.whens) {
				collectColumns(w.when, clause, out);
				collectColumns(w.then, clause, out);
			}
			if (e.elseExpr) collectColumns(e.elseExpr, clause, out);
			return;
		case "cast":
			collectColumns(e.expr, clause, out);
			return;
		case "predicate":
			collectColumns(e.operand, clause, out);
			for (const a of e.args) collectColumns(a, clause, out);
			return;
		case "lambda":
			collectColumns(e.body, clause, out);
			return;
		case "subscript":
			collectColumns(e.base, clause, out);
			if (e.index) collectColumns(e.index, clause, out);
			if (e.end) collectColumns(e.end, clause, out);
			if (e.step) collectColumns(e.step, clause, out);
			return;
		case "subquery":
		case "exists":
		case "literal":
		case "other":
			return;
	}
}

function collectInto(body: QueryBody, exprs: Expr[], clause: Clause): void {
	const columns = body.kind === "setop" ? body.columns : body.kind === "select" ? body.columns : null;
	if (!columns) return;
	for (const e of exprs) collectColumns(e, clause, columns);
}

function hasAggregate(e: Expr): boolean {
	switch (e.kind) {
		case "function":
			return (e.aggregate && !e.window) || e.args.some(hasAggregate);
		case "binary":
			return hasAggregate(e.left) || hasAggregate(e.right);
		case "unary":
			return hasAggregate(e.operand);
		case "case":
			return (
				e.whens.some((w) => hasAggregate(w.when) || hasAggregate(w.then)) ||
				(e.elseExpr != null && hasAggregate(e.elseExpr))
			);
		case "cast":
			return hasAggregate(e.expr);
		case "predicate":
			return hasAggregate(e.operand) || e.args.some(hasAggregate);
		case "subscript":
			return (
				hasAggregate(e.base) ||
				(e.index !== undefined && hasAggregate(e.index)) ||
				(e.end !== undefined && hasAggregate(e.end)) ||
				(e.step !== undefined && hasAggregate(e.step))
			);
		case "lambda":
			return hasAggregate(e.body);
		default:
			return false;
	}
}

function collectSubqueries(select: SelectExpr, out: QueryExpr[]): void {
	const visit = (e: Expr): void => {
		switch (e.kind) {
			case "subquery":
			case "exists":
				out.push(e.query);
				return;
			case "binary":
				visit(e.left);
				visit(e.right);
				return;
			case "unary":
				visit(e.operand);
				return;
			case "function":
				e.args.forEach(visit);
				if (e.window) {
					e.window.partitionBy.forEach(visit);
					e.window.orderBy.forEach(visit);
				}
				return;
			case "case":
				e.whens.forEach((w) => {
					visit(w.when);
					visit(w.then);
				});
				if (e.elseExpr) visit(e.elseExpr);
				return;
			case "cast":
				visit(e.expr);
				return;
			case "predicate":
				visit(e.operand);
				e.args.forEach(visit);
				return;
			case "lambda":
				visit(e.body);
				return;
			case "subscript":
				visit(e.base);
				if (e.index) visit(e.index);
				if (e.end) visit(e.end);
				if (e.step) visit(e.step);
				return;
			default:
				return;
		}
	};
	for (const p of select.projections) visit(p.expr);
	if (select.where) visit(select.where);
	for (const j of select.joinConditions ?? []) visit(j);
	for (const g of select.groupBy ?? []) visit(g);
	if (select.having) visit(select.having);
}
