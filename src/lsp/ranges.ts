import type { Token } from "antlr4ng";
import type { Position, Range } from "vscode-languageserver-types";
import type { ParserRuleContext, SqlDocument, StatementCell, SyntaxDiagnostic } from "../index.js";

// ---------------------------------------------------------------------------
// The ONE place that converts library positions to LSP positions. The library
// (antlr tokens, qualify Diagnostic, symbols Span) is 1-based line / 0-based
// column; LSP Position is 0-based line / 0-based character. Every feature routes
// position math through here so the off-by-one rule lives in exactly one file.
// ---------------------------------------------------------------------------

/** A token's start position as an LSP Position (1-based line → 0-based). */
function positionFromStartToken(t: Token): Position {
	return { line: Math.max(0, t.line - 1), character: t.column };
}

/** A token's end position (exclusive) as an LSP Position: column past the last char. When the
 *  token's text spans newlines (multi-line string/dollar-quoted body/block comment as the last
 *  token of a node), the end advances by the newline count and the column is the chars after the
 *  last newline. (Equivalent to the library `endPosition` helper, but this works on an antlr Token
 *  and emits a 0-based LSP line; ranges.ts is in the application layer the library can't import.) */
function positionFromStopToken(t: Token): Position {
	const text = t.text ?? "";
	const lastNl = text.lastIndexOf("\n");
	if (lastNl === -1) {
		return { line: Math.max(0, t.line - 1), character: t.column + text.length };
	}
	let nl = 0;
	for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) nl++;
	return { line: Math.max(0, t.line - 1 + nl), character: text.length - (lastNl + 1) };
}

/** CST node → LSP Range, from its first token's start to its last token's end. */
export function rangeFromCst(cst: ParserRuleContext): Range {
	const start = cst.start;
	if (!start) return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
	const stop = cst.stop ?? start;
	return { start: positionFromStartToken(start), end: positionFromStopToken(stop) };
}

/** The `{ line, column, endLine, endColumn }` shape shared by a symbols `Span` and a qualify
 *  `Diagnostic` (1-based line, 0-based column, endColumn already past the last char) — accepts
 *  either without requiring `Span`'s absolute start/end char offsets, which this doesn't need. */
interface LineSpan {
	line: number;
	column: number;
	endLine: number;
	endColumn: number;
}

export function rangeFromSpan(span: LineSpan): Range {
	return {
		start: { line: Math.max(0, span.line - 1), character: span.column },
		end: { line: Math.max(0, span.endLine - 1), character: span.endColumn },
	};
}

/** A parse `SyntaxDiagnostic` (1-based line, 0-based column, length chars) → Range. */
export function rangeFromSyntaxDiagnostic(d: SyntaxDiagnostic): Range {
	const line = Math.max(0, d.line - 1);
	return {
		start: { line, character: d.column },
		end: { line, character: d.column + Math.max(1, d.length) },
	};
}

// ---------------------------------------------------------------------------
// Cell-relative → document-coordinate shifting (Task 6). A statement cell's
// cst/scopes carry CELL-relative spans (parsed from the cell's own text slice),
// so a feature that turns a cell-relative Range into a document Range shifts it by
// the cell's start. `CellBase` is that start as a 0-based LSP { line, character }.
// A first-line (relative line 0) position shares the doc line where the cell
// begins, so its character offsets by the base column; a later line only shifts
// its line. A zero base (the first cell) is an identity.
// ---------------------------------------------------------------------------

export interface CellBase {
	line: number;
	character: number;
}

/** The doc-coordinate start of the cell owning `offset`, as an LSP { line, character } (0-based). */
export function cellBaseAt(doc: SqlDocument, offset: number): CellBase {
	const cell = doc.cellAt(offset);
	return cellBaseOf(doc, cell);
}

/** The doc-coordinate start of a specific cell (undefined → the zero base). */
export function cellBaseOf(doc: SqlDocument, cell: StatementCell | undefined): CellBase {
	if (!cell) return { line: 0, character: 0 };
	const p = doc.lines.positionAt(cell.span.start);
	return { line: p.line, character: p.column };
}

/** Shift a cell-relative LSP Position into document coordinates by a cell base. */
export function shiftPosition(p: Position, base: CellBase): Position {
	return { line: p.line + base.line, character: p.line === 0 ? p.character + base.character : p.character };
}

/** Shift a cell-relative LSP Range into document coordinates by a cell base. */
export function shiftRange(r: Range, base: CellBase): Range {
	if (base.line === 0 && base.character === 0) return r; // first cell: identity
	return { start: shiftPosition(r.start, base), end: shiftPosition(r.end, base) };
}

/** LSP Position → 0-based char offset into `text` (for mapping a cursor to a node). */
export function positionToOffset(text: string, position: Position): number {
	let line = 0;
	let offset = 0;
	while (line < position.line && offset < text.length) {
		const nl = text.indexOf("\n", offset);
		if (nl === -1) break;
		offset = nl + 1;
		line++;
	}
	return offset + position.character;
}
