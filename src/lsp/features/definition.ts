import type { Location, Position } from "vscode-languageserver-types";
import { deriveSymbols, type Dialect } from "../../api.js";
import type { Span, Sym } from "../../symbols/symbols.js";
import { rangeFromSpan, positionToOffset } from "../ranges.js";

// ---------------------------------------------------------------------------
// Go-to-definition: reuse the library's symbol model. deriveSymbols already
// resolves each in-query reference to the span of its declaration (Sym.definition
// — a CTE name, or the projection in a CTE/subquery that produces a column). This
// finds the reference under the cursor and returns its definition Location. Pure
// translation: no re-resolution here.
// ---------------------------------------------------------------------------

export function computeDefinition(
  text: string,
  dialect: Dialect,
  position: Position,
  uri: string,
): Location | null {
  const syms = deriveSymbols(text, undefined, { dialect });
  // The smallest reference symbol whose span covers the cursor and that has a definition.
  let best: Sym | undefined;
  for (const s of syms) {
    if (!s.definition) continue;
    if (!spanCoversCursor(text, s.span, position)) continue;
    if (!best || spanLength(text, s.span) < spanLength(text, best.span)) best = s;
  }
  if (!best || !best.definition) return null;
  return { uri, range: rangeFromSpan(best.definition) };
}

/** Char offset of a span's start: line is 1-based, column 0-based. */
function spanStartOffset(text: string, span: Span): number {
  return positionToOffset(text, { line: span.line - 1, character: span.column });
}
function spanEndOffset(text: string, span: Span): number {
  return positionToOffset(text, { line: span.endLine - 1, character: span.endColumn });
}
function spanCoversCursor(text: string, span: Span, position: Position): boolean {
  const cur = positionToOffset(text, position);
  return spanStartOffset(text, span) <= cur && cur <= spanEndOffset(text, span);
}
function spanLength(text: string, span: Span): number {
  return spanEndOffset(text, span) - spanStartOffset(text, span);
}
