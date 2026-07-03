import type { ParserRuleContext } from "antlr4ng";
import type { Position, Range, SelectionRange } from "vscode-languageserver-types";
import type { SqlDocument } from "../../index.js";
import { type CellBase, cellBaseOf, rangeFromCst, shiftRange } from "../ranges.js";

// ---------------------------------------------------------------------------
// Selection ranges: smart-expand selection from the CST ancestry. For each
// caret, descend the raw parse tree (doc.cst) to the smallest ParserRuleContext
// whose char range covers the offset, then walk .parent upward to the root,
// emitting a nested SelectionRange chain that widens from that node to the whole
// statement. A purely structural translation of the CST — no semantic layer,
// no schema. Never throws → a point range at the caret when nothing covers it.
//
// cstRange / covers / span are re-implemented LOCALLY (mirroring the private
// node-at helpers): a node's 0-based inclusive char range is [start.start,
// stop.stop]; the smallest covering node is the deepest one, tie-broken to the
// narrowest span.
// ---------------------------------------------------------------------------

/** 0-based inclusive char range of a CST node, or undefined if it has no tokens. */
function cstRange(cst: ParserRuleContext): { from: number; to: number } | undefined {
	const start = cst.start;
	const stop = cst.stop ?? cst.start;
	if (!start || !stop) return undefined;
	return { from: start.start, to: stop.stop };
}

function covers(cst: ParserRuleContext, offset: number): boolean {
	const r = cstRange(cst);
	return r !== undefined && r.from <= offset && offset <= r.to;
}

function span(cst: ParserRuleContext): number {
	const r = cstRange(cst);
	return r ? r.to - r.from : Number.MAX_SAFE_INTEGER;
}

/** Whether `node` is a ParserRuleContext (has the .start/.parent shape we walk). Terminal
 *  nodes (TerminalNode) are skipped: they have no .parent chain of rule contexts to widen. */
function isRuleContext(node: unknown): node is ParserRuleContext {
	return (
		typeof node === "object" &&
		node !== null &&
		"start" in node &&
		"parent" in node &&
		typeof (node as { getChildCount?: unknown }).getChildCount === "function"
	);
}

/** Descend from `root`, returning the deepest ParserRuleContext whose range covers `offset`,
 *  tie-broken to the smallest span. undefined if nothing covers it. */
function smallestCovering(root: ParserRuleContext, offset: number): ParserRuleContext | undefined {
	let best: ParserRuleContext | undefined;
	const visit = (node: ParserRuleContext): void => {
		if (!covers(node, offset)) return;
		if (!best || span(node) <= span(best)) best = node;
		const count = node.getChildCount();
		for (let i = 0; i < count; i++) {
			const child = node.getChild(i);
			if (isRuleContext(child)) visit(child);
		}
	};
	visit(root);
	return best;
}

function rangesEqual(a: Range, b: Range): boolean {
	return (
		a.start.line === b.start.line &&
		a.start.character === b.start.character &&
		a.end.line === b.end.line &&
		a.end.character === b.end.character
	);
}

/** Position ordering: a before-or-equal b. */
function lte(a: Position, b: Position): boolean {
	return a.line < b.line || (a.line === b.line && a.character <= b.character);
}

/** Clamp a range's end to `eod` (end-of-document). The root statement node's stop token is
 *  EOF, whose column sits one past the buffer; without this an outer selection would widen
 *  past the text. start is always within the buffer, so only the end needs clamping. */
function clampRange(range: Range, eod: Position): Range {
	if (lte(range.end, eod)) return range;
	return { start: range.start, end: eod };
}

/** Build the nested SelectionRange chain for `node` and return its INNERMOST link (the LSP
 *  contract: the returned range is the smallest, its .parent chain widens outward). Collect the
 *  node's range plus each ancestor's, innermost→outermost, drop any that equals the one below it
 *  (no duplicate), then fold from the outermost inward so each link's .parent is the wider one.
 *  All ranges are clamped to end-of-document so a trailing EOF token can't widen past the buffer. */
function chainFor(node: ParserRuleContext, eod: Position): SelectionRange {
	const ranges: Range[] = [];
	for (let n: ParserRuleContext | null = node; n; n = n.parent) {
		const range = clampRange(rangeFromCst(n), eod);
		if (ranges.length && rangesEqual(range, ranges[ranges.length - 1])) continue;
		ranges.push(range);
	}
	// Fold outermost → innermost so the head is the smallest range and .parent widens.
	let current: SelectionRange = { range: ranges[ranges.length - 1] };
	for (let i = ranges.length - 2; i >= 0; i--) current = { range: ranges[i], parent: current };
	return current;
}

/** A zero-width point range at `position` — the no-covering-node fallback. */
function pointRange(position: Position): SelectionRange {
	const at = { line: position.line, character: position.character };
	return { range: { start: at, end: { ...at } } };
}

/** End-of-cell position (0-based LSP line/character) for a cell's own text — the clamp bound for a
 *  statement root's trailing EOF token, computed in CELL-relative coordinates. */
function endOfText(text: string): Position {
	let line = 0;
	let lastStart = 0;
	for (let i = 0; i < text.length; i++) {
		if (text.charCodeAt(i) === 10) {
			line++;
			lastStart = i + 1;
		}
	}
	return { line, character: text.length - lastStart };
}

/** Shift a whole SelectionRange chain (its .range and every .parent) from cell-relative to doc
 *  coordinates. A zero base short-circuits inside shiftRange (identity). */
function shiftSelectionRange(sr: SelectionRange, base: CellBase): SelectionRange {
	const shifted: SelectionRange = { range: shiftRange(sr.range, base) };
	if (sr.parent) shifted.parent = shiftSelectionRange(sr.parent, base);
	return shifted;
}

export function computeSelectionRanges(doc: SqlDocument, positions: Position[]): SelectionRange[] {
	return positions.map((position) => {
		const off = doc.lines.offsetAt(position.line, position.character);
		const cell = doc.cellAt(off);
		// The cell's cst is CELL-relative: descend it with a cell-relative offset, clamp to the cell's
		// own end, then shift the resulting chain to doc coordinates. Single-cell: base 0, cell IS the doc.
		const cst = cell ? cell.cst : doc.cst;
		const base = cellBaseOf(doc, cell);
		const cellOff = cell ? off - cell.span.start : off;
		const eod = endOfText(cell ? cell.text : doc.text);
		const node = smallestCovering(cst, cellOff);
		return node ? shiftSelectionRange(chainFor(node, eod), base) : pointRange(position);
	});
}
