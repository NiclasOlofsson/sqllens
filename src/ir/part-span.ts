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

/** All-or-nothing per column reference: return one `PartSpan` per node only when EVERY part has a
 *  real token; otherwise `undefined`. A synthesized part — postgres's empty-segment `d.s..c`, a
 *  dotted single-token path (BigQuery DOT_IDENTIFIER), star-expansion internals, pipe-stage
 *  synthetics — yields `undefined` for the whole ref, so `partSpans` never misaligns with `parts`. */
export function partSpansOf(nodes: (ParseTree | null | undefined)[]): PartSpan[] | undefined {
	if (nodes.length === 0) return undefined;
	const out: PartSpan[] = [];
	for (const n of nodes) {
		const span = partSpanOf(n);
		if (!span) return undefined;
		out.push(span);
	}
	return out;
}
