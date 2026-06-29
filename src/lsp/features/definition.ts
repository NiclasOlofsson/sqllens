import type { Location, Position } from "vscode-languageserver-types";
import type { Span, Sym, SqlDocument } from "../../index.js";
import { rangeFromSpan } from "../ranges.js";

// ---------------------------------------------------------------------------
// Go-to-definition: reuse the cached document's symbol model. analyze().symbols
// already resolves each in-query reference to the span of its declaration
// (Sym.definition — a CTE name, or the projection in a CTE/subquery that produces
// a column). This finds the reference under the cursor and returns its definition
// Location. Pure translation: no re-resolution here. Offsets come from doc.lines.
// ---------------------------------------------------------------------------

export function computeDefinition(doc: SqlDocument, position: Position, uri: string): Location | null {
	const cursor = doc.lines.offsetAt(position.line, position.character);
	// The smallest reference symbol whose span covers the cursor and that has a definition.
	let best: Sym | undefined;
	for (const s of doc.analyze().symbols) {
		if (!s.definition) continue;
		if (!spanCoversCursor(doc, s.span, cursor)) continue;
		if (!best || spanLength(doc, s.span) < spanLength(doc, best.span)) best = s;
	}
	if (!best || !best.definition) return null;
	return { uri, range: rangeFromSpan(best.definition) };
}

/** Char offset of a span's start: line is 1-based, column 0-based → 0-based line for LineIndex. */
function spanStartOffset(doc: SqlDocument, span: Span): number {
	return doc.lines.offsetAt(span.line - 1, span.column);
}
function spanEndOffset(doc: SqlDocument, span: Span): number {
	return doc.lines.offsetAt(span.endLine - 1, span.endColumn);
}
function spanCoversCursor(doc: SqlDocument, span: Span, cursor: number): boolean {
	return spanStartOffset(doc, span) <= cursor && cursor <= spanEndOffset(doc, span);
}
function spanLength(doc: SqlDocument, span: Span): number {
	return spanEndOffset(doc, span) - spanStartOffset(doc, span);
}
