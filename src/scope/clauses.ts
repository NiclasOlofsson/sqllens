import type { ParserRuleContext } from "antlr4ng";
import { debugRethrow } from "../debug.js";
import type { Expr } from "../ir/ir.js";
import { partSpanOf, type PartSpan } from "../ir/part-span.js";
import type { Token } from "../token/token.js";
import type { Scope } from "./scope.js";

// ---------------------------------------------------------------------------
// clausesOf: per-frame clause geometry for the SQL debugger's marker planting:
// which clause (SELECT/FROM/JOIN/WHERE/GROUP BY/HAVING/QUALIFY/ORDER BY/LIMIT) a
// document position sits in, anchored on the clause's own leading keyword.
//
// The IR keeps each clause's CONTENT (the WHERE predicate's Expr, the GROUP BY
// expressions, and so on) but not the leading keyword token itself: "WHERE"/
// "GROUP"/"BY" carry no semantic payload, so no dialect's lower() retains them.
// Rather than re-lexing or sniffing each dialect's differently-shaped CST around
// the clause (every dialect's grammar names its clause rules differently), this
// reads the ALREADY-CAPTURED token stream (the first-class artifact `parse()`/
// SqlDocument always carries) and looks for the expected keyword phrase
// immediately adjacent to the clause's own content, never fabricating a keyword
// that isn't actually there. A phrase that doesn't match at the expected
// position (a dialect quirk, a broken parse) makes the WHOLE clause entry
// abstain, never a wrong span.
//
// Two clause kinds are handled differently because their own Join/body.cst
// ALREADY spans the leading keyword: a `Join`'s `cst` starts at its own
// `[NATURAL] [LATERAL] [kind] JOIN` keyword run (scanned FORWARD), and a
// select's own `body.cst` starts at "SELECT" itself (checked directly): no
// backward scan needed for either.
//
// Stated boundaries (never fabricate, never silently claim more than this does):
//  - "window" is in the KIND vocabulary but never emitted: no dialect's lower()
//    retains a top-level named WINDOW clause (only per-function OVER specs via
//    Expr.function.window). Revisit if a future lower.ts starts keeping one.
//  - T-SQL's inline `TOP n` (a SELECT-list modifier, positioned before the
//    projection list) is not modelled as its own "limit" clause: it has no
//    separate trailing construct, and its tokens fall inside "select"'s own
//    span. Only a genuine trailing OFFSET/FETCH forms a T-SQL "limit" clause.
//  - `span` runs from the anchor to the end of the last piece of content the IR
//    retains; a trailing bare keyword with no IR-held content (T-SQL's
//    `ROWS ONLY` after FETCH) is not included.
//  - A pipe-stage scope's synthesized "select" body carries no `where`/`groupBy`/
//    `having`/`qualify`/`joins`/`from` fields (those live on `PipeStage`'s own
//    op-specific shape), so those clause kinds naturally never fire for a stage;
//    only "select" fires when GoogleSQL's `|> SELECT ...` literally uses that
//    keyword. A set-op scope has no clauses of its own (its branches are
//    separate scopes; use `setOpArmsOf` for arm geometry).
// ---------------------------------------------------------------------------

export type ClauseKind =
	| "select"
	| "from"
	| "join"
	| "where"
	| "groupBy"
	| "having"
	| "qualify"
	| "window"
	| "orderBy"
	| "limit";

export interface ClauseInfo {
	kind: ClauseKind;
	/** The clause's leading keyword token span (GROUP BY / ORDER BY span both tokens; a JOIN spans its
	 *  full `[NATURAL] [LATERAL] [INNER|LEFT|RIGHT|FULL|CROSS|SEMI|ANTI|ASOF] JOIN` keyword run). */
	anchorSpan: PartSpan;
	/** The full clause construct, anchor through the end of the last IR-held content: see the file's
	 *  stated boundaries above for what this does NOT include. */
	span: PartSpan;
}

/** Per-scope clause list for `scope` (typically the `scope` a `frameAt` hit returns), ordered by
 *  document position. `tokens` is the SAME token stream the owning SqlDocument/parse() already
 *  carries: cell-relative when called with a cell's own tokens, document-coordinate otherwise (the
 *  caller picks; `SqlDocument.clausesOf` handles the cell-relative case and shifts the result). Emits
 *  only clauses that actually exist in the text; never fabricates. Total: never throws. */
export function clausesOf(scope: Scope, tokens: readonly Token[]): ClauseInfo[] {
	try {
		return compute(scope, tokens);
	} catch (e) {
		debugRethrow(e);
		return [];
	}
}

interface Coded {
	tokens: Token[];
	indexByStart: Map<number, number>;
}

function codeOf(tokens: readonly Token[]): Coded {
	const arr = tokens.filter((t) => t.channel === 0);
	const indexByStart = new Map<number, number>();
	arr.forEach((t, i) => indexByStart.set(t.start, i));
	return { tokens: arr, indexByStart };
}

function compute(scope: Scope, tokens: readonly Token[]): ClauseInfo[] {
	const coded = codeOf(tokens);
	const out: ClauseInfo[] = [];
	const body = scope.body;

	if (body.kind === "select") {
		if (body.projections.length > 0) {
			const content = spanUnion(body.projections.map((p) => p.cst));
			const anchor = content && selectAnchor(coded, body.cst);
			if (content && anchor) out.push({ kind: "select", anchorSpan: anchor, span: mergeSpan(anchor, content) });
		}
		// The FROM clause's own span extends through its trailing JOINs' ON/USING predicates too: a
		// join's SOURCE alone (`body.from`'s own per-entry cst) stops short of that predicate text, so
		// the union also takes each `Join.cst` (already documented to span the full
		// "[type] JOIN ... [ON ...|USING ...]" construct) when explicit joins are present.
		pushBackward(out, "from", [...body.from, ...(body.joins ?? [])], ["FROM"], coded);
		if (body.joins) {
			for (const j of body.joins) {
				const jspan = partSpanOf(j.cst);
				const anchor = jspan && joinAnchor(coded, jspan.start);
				if (jspan && anchor) out.push({ kind: "join", anchorSpan: anchor, span: jspan });
			}
		}
		if (body.where) pushBackward(out, "where", [{ cst: body.where.cst }], ["WHERE"], coded);
		if (body.groupBy?.length) pushBackward(out, "groupBy", body.groupBy, ["GROUP", "BY"], coded);
		if (body.having) pushBackward(out, "having", [{ cst: body.having.cst }], ["HAVING"], coded);
		if (body.qualify) pushBackward(out, "qualify", [{ cst: body.qualify.cst }], ["QUALIFY"], coded);
	}

	// orderBy/limit belong to the QueryExpr this scope's construct came from (Scope.orderBy/limit,
	// copied there by buildQueryScope), present regardless of body.kind (select/setop/pipe all can
	// carry a trailing ORDER BY/LIMIT over their whole construct).
	if (scope.orderBy?.length) pushBackward(out, "orderBy", scope.orderBy, ["ORDER", "BY"], coded);
	const limitClause = limitClauseOf(scope, coded);
	if (limitClause) out.push(limitClause);

	out.sort((a, b) => a.anchorSpan.start - b.anchorSpan.start);
	return out;
}

function limitClauseOf(scope: Scope, coded: Coded): ClauseInfo | undefined {
	const limit = scope.limit;
	if (!limit) return undefined;
	if (scope.dialect === "tsql") {
		// TOP is a SELECT-list modifier with no separate trailing construct (see file header); only a
		// genuine trailing OFFSET/FETCH forms a "limit" clause.
		if (!limit.offset) return undefined;
		return backwardClause(nodesOf(limit.offset, limit.fetch), ["OFFSET"], coded, "limit");
	}
	if (!limit.top) return undefined;
	return backwardClause(nodesOf(limit.top, limit.offset, limit.fetch), ["LIMIT"], coded, "limit");
}

function nodesOf(...exprs: (Expr | undefined)[]): { cst: ParserRuleContext }[] {
	return exprs.filter((e): e is Expr => e !== undefined).map((e) => ({ cst: e.cst }));
}

function pushBackward(
	out: ClauseInfo[],
	kind: ClauseKind,
	nodes: { cst: ParserRuleContext }[],
	phrase: string[],
	coded: Coded,
): void {
	const c = backwardClause(nodes, phrase, coded, kind);
	if (c) out.push(c);
}

/** A clause whose leading keyword sits immediately BEFORE its own content (WHERE/HAVING/QUALIFY/
 *  GROUP BY/ORDER BY/FROM/LIMIT/OFFSET): scan backward from the content's own (textually leftmost)
 *  start token for the expected phrase; abstain (undefined) on any mismatch, never fabricate. */
function backwardClause(
	nodes: { cst: ParserRuleContext }[],
	phrase: string[],
	coded: Coded,
	kind: ClauseKind,
): ClauseInfo | undefined {
	if (nodes.length === 0) return undefined;
	const content = spanUnion(nodes.map((n) => n.cst));
	if (!content) return undefined;
	const anchor = matchBackward(coded, content.start, phrase);
	if (!anchor) return undefined;
	return { kind, anchorSpan: anchor, span: mergeSpan(anchor, content) };
}

/** The "SELECT" keyword itself: body.cst's own first token, confirmed (never assumed) to read
 *  "SELECT". Modifiers (DISTINCT/ALL/T-SQL TOP) that may follow stay inside the select clause's own
 *  span without needing their own anchor. */
function selectAnchor(coded: Coded, bodyCst: ParserRuleContext): PartSpan | undefined {
	const span = partSpanOf(bodyCst);
	return span && matchForwardExact(coded, span.start, ["SELECT"]);
}

/** Keywords that can lead a JOIN construct, scanned forward from `Join.cst`'s own start (which is
 *  documented to begin exactly at the leading join keyword). Stops the run right after "JOIN" (the
 *  joined table's own text follows). APPLY (T-SQL CROSS/OUTER APPLY) never reaches here: those never
 *  lower into a `Join` node in the first place (tsql/lower.ts's own join-chain comment). */
const JOIN_KEYWORDS = new Set([
	"NATURAL",
	"LATERAL",
	"INNER",
	"LEFT",
	"RIGHT",
	"FULL",
	"OUTER",
	"CROSS",
	"SEMI",
	"ANTI",
	"ASOF",
	"POSITIONAL",
	"JOIN",
]);

function joinAnchor(coded: Coded, offset: number): PartSpan | undefined {
	const idx = coded.indexByStart.get(offset);
	if (idx === undefined) return undefined;
	let end = idx;
	while (end < coded.tokens.length && JOIN_KEYWORDS.has(coded.tokens[end].text.toUpperCase())) {
		const isJoin = coded.tokens[end].text.toUpperCase() === "JOIN";
		end++;
		if (isJoin) break;
	}
	if (end === idx) return undefined;
	return spanFromTokens(coded.tokens[idx], coded.tokens[end - 1]);
}

/** The index of the first `coded.tokens` entry whose `start >= offset` (coded.tokens is
 *  source-ordered), or `coded.tokens.length` when none qualifies. Whenever a token really does
 *  start exactly at `offset` this is that token's own index — identical to an exact
 *  `indexByStart` lookup for the overwhelmingly common case. It also degrades correctly when NO
 *  token starts exactly at `offset`: a templated FROM/JOIN source's content starts at the
 *  placeholder fill's position, but that fill is entirely CHANNEL-2 jinja tokens in the merged
 *  stream (src/minijinja/parse.ts's clipToTagBoundaries drops the placeholder's own channel-0
 *  token wholesale), so no channel-0 token starts there. Using the next real token as the
 *  reference point still finds the true keyword immediately before it: nothing real (only the
 *  clipped tag) sits between the keyword and the content in that case. */
function indexAtOrAfter(coded: Coded, offset: number): number {
	let lo = 0;
	let hi = coded.tokens.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (coded.tokens[mid].start < offset) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

/** `phrase` immediately preceding the content that starts at `contentStart` (e.g. content-start =
 *  the first GROUP BY expression's own start ⇒ the two tokens right before it must read "GROUP",
 *  "BY"). Uses `indexAtOrAfter` rather than an exact `indexByStart` lookup so a templated FROM
 *  fill (whose own token is missing from this channel-0 view, see `indexAtOrAfter`) still anchors
 *  on the real keyword preceding it, instead of the whole clause silently vanishing. */
function matchBackward(coded: Coded, contentStart: number, phrase: string[]): PartSpan | undefined {
	const idx = indexAtOrAfter(coded, contentStart);
	if (idx < phrase.length) return undefined;
	const from = idx - phrase.length;
	for (let i = 0; i < phrase.length; i++) {
		if (coded.tokens[from + i].text.toUpperCase() !== phrase[i]) return undefined;
	}
	return spanFromTokens(coded.tokens[from], coded.tokens[idx - 1]);
}

/** `phrase` starting exactly at `offset` (used for "SELECT", whose own body.cst already starts there). */
function matchForwardExact(coded: Coded, offset: number, phrase: string[]): PartSpan | undefined {
	const idx = coded.indexByStart.get(offset);
	if (idx === undefined || idx + phrase.length > coded.tokens.length) return undefined;
	for (let i = 0; i < phrase.length; i++) {
		if (coded.tokens[idx + i].text.toUpperCase() !== phrase[i]) return undefined;
	}
	return spanFromTokens(coded.tokens[idx], coded.tokens[idx + phrase.length - 1]);
}

function spanFromTokens(a: Token, b: Token): PartSpan {
	return { start: a.start, end: b.stop + 1, line: a.line, column: a.column, endLine: b.endLine, endColumn: b.endColumn };
}

/** The span from the textually-leftmost to the textually-rightmost of `csts`, robust to `csts` not
 *  being supplied in text order (Postgres permits `OFFSET ... LIMIT ...` in either order). `undefined`
 *  (never a partial union) when any node carries no real token. */
function spanUnion(csts: ParserRuleContext[]): PartSpan | undefined {
	const spans: PartSpan[] = [];
	for (const c of csts) {
		const s = partSpanOf(c);
		if (!s) return undefined;
		spans.push(s);
	}
	if (spans.length === 0) return undefined;
	let first = spans[0]!;
	let last = spans[0]!;
	for (const s of spans) {
		if (s.start < first.start) first = s;
		if (s.end > last.end) last = s;
	}
	return { start: first.start, end: last.end, line: first.line, column: first.column, endLine: last.endLine, endColumn: last.endColumn };
}

function mergeSpan(anchor: PartSpan, content: PartSpan): PartSpan {
	return {
		start: anchor.start,
		end: content.end,
		line: anchor.line,
		column: anchor.column,
		endLine: content.endLine,
		endColumn: content.endColumn,
	};
}
