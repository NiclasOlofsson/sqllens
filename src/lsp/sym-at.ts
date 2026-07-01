import type { Span, Sym, SqlDocument } from "../index.js";

// The smallest symbol whose span covers a cursor offset — the shared position→symbol
// lookup for definition (pred: has a definition) and hover's symbol fallback.
export function symbolAt(
	doc: SqlDocument,
	syms: readonly Sym[],
	cursor: number,
	pred: (s: Sym) => boolean = () => true,
): Sym | undefined {
	let best: Sym | undefined;
	for (const s of syms) {
		if (!pred(s)) continue;
		if (!covers(doc, s.span, cursor)) continue;
		if (!best || spanLength(doc, s.span) < spanLength(doc, best.span)) best = s;
	}
	return best;
}

/** Char offset of a span's start: line is 1-based, column 0-based → 0-based line for LineIndex. */
function startOffset(doc: SqlDocument, span: Span): number {
	return doc.lines.offsetAt(span.line - 1, span.column);
}
function endOffset(doc: SqlDocument, span: Span): number {
	return doc.lines.offsetAt(span.endLine - 1, span.endColumn);
}
function covers(doc: SqlDocument, span: Span, cursor: number): boolean {
	return startOffset(doc, span) <= cursor && cursor <= endOffset(doc, span);
}
function spanLength(doc: SqlDocument, span: Span): number {
	return endOffset(doc, span) - startOffset(doc, span);
}
