// ---------------------------------------------------------------------------
// Cell-relative → doc-coordinate shifting.
//
// Each statement cell (src/document/split.ts) is parsed from its own text slice,
// so its tokens and syntax diagnostics carry positions relative to the CELL, not
// the document. When a cached cell is (re)used, its tokens/diagnostics are shifted
// into document coordinates by the cell's start position (from the doc LineIndex).
//
// The base is the cell's start, as taken from the doc LineIndex:
//   baseLine   — 0-based line of the cell start.
//   baseCol    — 0-based column of the cell start.
//   baseOffset — 0-based char offset of the cell start.
//
// Positions here follow the library convention: `line` is 1-based, `column` is
// 0-based, char offsets are 0-based. The subtlety: a position on the cell's FIRST
// line shares the doc line where the cell begins, so its column offsets by baseCol;
// a position on a LATER line starts a fresh line (column already 0-relative), so
// only its line shifts. A zero base is an identity — the first cell never shifts.
// ---------------------------------------------------------------------------

import type { SyntaxDiagnostic } from "../parse-diagnostics.js";
import type { Token } from "../token/token.js";

/** Shift a cell-relative diagnostic to document coordinates. `line` is 1-based, `column` 0-based. */
export function shiftDiagnostic(
	d: SyntaxDiagnostic,
	baseLine: number,
	baseCol: number,
	baseOffset = 0,
): SyntaxDiagnostic {
	const firstLine = d.line === 1;
	return {
		message: d.message,
		line: d.line + baseLine,
		column: firstLine ? d.column + baseCol : d.column,
		offset: d.offset === undefined ? undefined : d.offset + baseOffset,
		length: d.length,
	};
}

/** Shift a cell-relative token to document coordinates. `line` is 1-based, `column` 0-based. */
export function shiftToken(t: Token, baseLine: number, baseCol: number, baseOffset: number): Token {
	const firstLine = t.line === 1;
	return {
		...t,
		start: t.start + baseOffset,
		stop: t.stop + baseOffset,
		line: t.line + baseLine,
		column: firstLine ? t.column + baseCol : t.column,
	};
}

/** Shift a whole diagnostic list; a zero base returns the input array unchanged (the first cell). */
export function shiftDiagnostics(
	diags: readonly SyntaxDiagnostic[],
	baseLine: number,
	baseCol: number,
	baseOffset: number,
): readonly SyntaxDiagnostic[] {
	if (baseLine === 0 && baseCol === 0 && baseOffset === 0) return diags;
	return diags.map((d) => shiftDiagnostic(d, baseLine, baseCol, baseOffset));
}

/** Shift a whole token list; a zero base returns the input array unchanged (the first cell). */
export function shiftTokens(
	tokens: readonly Token[],
	baseLine: number,
	baseCol: number,
	baseOffset: number,
): readonly Token[] {
	if (baseLine === 0 && baseCol === 0 && baseOffset === 0) return tokens;
	return tokens.map((t) => shiftToken(t, baseLine, baseCol, baseOffset));
}
