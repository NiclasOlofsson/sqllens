// ---------------------------------------------------------------------------
// Per-part spans on a column reference. `ColumnRef`/`column` Expr carry `parts:
// string[]` and ONE `cst` span covering the whole reference; the dbt Anvil
// extension needs each part's OWN span so it can hit-test a cursor on `o` vs
// `order_id` in `o.order_id` (alias/relation actions vs column actions). This is
// the one shared place that turns a per-part CST node into a `PartSpan`.
//
// A span covers each part's own token(s) INCLUDING any quoting delimiters
// (`"a b"` spans the quotes, `[a]` the brackets, `` `a` `` the backticks — the
// extension maps cursor offsets and the quote chars are part of the source) but
// EXCLUDING the dots between parts. It is ADDITIVE/optional: absent when any part
// was synthesized rather than read from a real token (all-or-nothing per ref, see
// `partSpansOf`), so a consumer either gets one span per part or none.
//
// The editor-gold wave's later identifier-folding rewrite reuses this helper —
// keep the per-dialect span capture funneled through `partSpansOf` so it has one
// seam to rewrite.
// ---------------------------------------------------------------------------

import { ParserRuleContext, TerminalNode, type ParseTree, type Token } from "antlr4ng";
import { endPosition } from "./span.js";

export interface PartSpan {
	/** Absolute char offset of the part's first token, inclusive (0-based). */
	start: number;
	/** Absolute char offset one past the part's last token, exclusive (0-based). */
	end: number;
	/** 1-based line of the part's first token (matches src/parse-diagnostics.ts SyntaxDiagnostic). */
	line: number;
	/** 0-based column of the part's first token (matches src/parse-diagnostics.ts SyntaxDiagnostic). */
	column: number;
	/** 1-based line of the span END (one past the last char) — same convention as symbols.ts `Span`. */
	endLine: number;
	/** 0-based column of the span END (one past the last char). */
	endColumn: number;
}

function startToken(node: ParseTree): Token | null {
	if (node instanceof TerminalNode) return node.symbol;
	if (node instanceof ParserRuleContext) return node.start;
	return null;
}

function stopToken(node: ParseTree): Token | null {
	if (node instanceof TerminalNode) return node.symbol;
	if (node instanceof ParserRuleContext) return node.stop;
	return null;
}

/** The span of a single part's CST node (a rule context or terminal). `undefined` when the node is
 *  missing or carries no token — the caller treats that as "this part has no real token". */
export function partSpanOf(node: ParseTree | null | undefined): PartSpan | undefined {
	if (!node) return undefined;
	const s = startToken(node);
	const e = stopToken(node);
	if (!s || !e) return undefined;
	const end = endPosition(e.line, e.column, e.text ?? "");
	return {
		start: s.start,
		end: e.stop + 1,
		line: s.line,
		column: s.column,
		endLine: end.endLine,
		endColumn: end.endColumn,
	};
}

/** The `PartSpan` of the identifier inside a fused dot-glued token — one lexer token whose text is a
 *  leading dot immediately followed by a plain identifier (MySQL `DOT_ID: '.' ID_LITERAL`, produced
 *  for the unspaced `a.b` writing style). The dot is NOT part of the identifier, so the span starts
 *  one char past the token start and runs to the token end; the identifier is the token's tail. Its
 *  offsets are interchangeable with a span `partSpanOf` would produce from a real identifier node.
 *  `ID_LITERAL` admits only a plain unquoted identifier — a quoted part lexes as a separate quoted-id
 *  token and takes the `'.' uid` parser path instead — so no quoting delimiter can hide in this span,
 *  and the token is single-line (`.` + identifier, no newline), so `endLine === line`. */
export function dotIdPartSpanOf(symbol: Token): PartSpan {
	// endPosition over the WHOLE token gives the identifier's end too: the identifier is the token's
	// tail, so it ends exactly where the token ends. The dot only shifts the START forward one char.
	const end = endPosition(symbol.line, symbol.column, symbol.text ?? "");
	return {
		start: symbol.start + 1,
		end: symbol.stop + 1,
		line: symbol.line,
		column: symbol.column + 1,
		endLine: end.endLine,
		endColumn: end.endColumn,
	};
}

/** All-or-nothing collapse over already-computed spans: one array only when EVERY part produced a real
 *  span, else `undefined`. The single shared implementation of the convention so `partSpans` /
 *  `namePartSpans` never misaligns with `parts`. `partSpansOf` (node-derived spans) delegates here;
 *  callers that MIX node-derived spans with directly-computed ones (MySQL's fused DOT_ID part, whose
 *  span comes from `dotIdPartSpanOf`, not a node) call this with the mixed span list. */
export function collapsePartSpans(spans: (PartSpan | undefined)[]): PartSpan[] | undefined {
	if (spans.length === 0) return undefined;
	const out: PartSpan[] = [];
	for (const s of spans) {
		if (!s) return undefined;
		out.push(s);
	}
	return out;
}

/** All-or-nothing per column reference: return one `PartSpan` per node only when EVERY part has a
 *  real token; otherwise `undefined`. A synthesized part — postgres's empty-segment `d.s..c`, a
 *  dotted single-token path (BigQuery DOT_IDENTIFIER), star-expansion internals, pipe-stage
 *  synthetics — yields `undefined` for the whole ref, so `partSpans` never misaligns with `parts`. */
export function partSpansOf(nodes: (ParseTree | null | undefined)[]): PartSpan[] | undefined {
	return collapsePartSpans(nodes.map((n) => partSpanOf(n)));
}

/** The literal `*` terminal within a star projection's CST subtree — the star's OWN span, excluding
 *  any qualifier (`t.` in `t.*`) and any trailing modifier clause (`EXCEPT (...)`/`EXCLUDE (...)`/
 *  `REPLACE (...)`). Every dialect's star `Expr.cst` covers, at most, qualifier + `*` + modifiers —
 *  never just the `*` alone (see docs/identifier-delimiter-contract.md's sibling concern for column
 *  text; this is the span analogue for stars) — and there is no shared per-dialect token-type constant
 *  to key on at this dialect-agnostic layer. So this walks the subtree pre-order (left to right) and
 *  returns the FIRST terminal whose text is exactly "*": the projection's own star always precedes any
 *  modifier clause in source order, so "first" finds it unambiguously even when a `REPLACE (a * 2 AS
 *  c)` modifier's own expression contains a `*` multiplication operator later in the same subtree.
 *  `undefined` only if the subtree genuinely carries no `*` token (a broken/synthesized star). */
export function starSpanOf(node: ParseTree | null | undefined): PartSpan | undefined {
	return partSpanOf(findStarTerminal(node));
}

function findStarTerminal(node: ParseTree | null | undefined): TerminalNode | undefined {
	if (!node) return undefined;
	if (node instanceof TerminalNode) return node.getText() === "*" ? node : undefined;
	if (node instanceof ParserRuleContext) {
		for (let i = 0; i < node.getChildCount(); i++) {
			const hit = findStarTerminal(node.getChild(i));
			if (hit) return hit;
		}
	}
	return undefined;
}
