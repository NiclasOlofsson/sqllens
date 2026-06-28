import type { ParserRuleContext, Token } from "antlr4ng";
import type { Position, Range } from "vscode-languageserver-types";
import type { Span } from "../symbols/symbols.js";
import type { SyntaxDiagnostic } from "../parse-diagnostics.js";

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

/** A token's end position (exclusive) as an LSP Position: column past the last char. */
function positionFromStopToken(t: Token): Position {
  return { line: Math.max(0, t.line - 1), character: t.column + (t.text?.length ?? 0) };
}

/** CST node → LSP Range, from its first token's start to its last token's end. */
export function rangeFromCst(cst: ParserRuleContext): Range {
  const start = cst.start;
  const stop = cst.stop ?? cst.start;
  if (!start) return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
  return { start: positionFromStartToken(start), end: positionFromStopToken(stop ?? start) };
}

/** A symbols `Span` (1-based line, 0-based column, endColumn already past the last char) → Range. */
export function rangeFromSpan(span: Span): Range {
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
