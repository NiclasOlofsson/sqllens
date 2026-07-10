import type { Location, Position, DocumentHighlight } from "vscode-languageserver-types";
import { DocumentHighlightKind } from "vscode-languageserver-types";
import { type Occurrence, type SqlSession } from "../../index.js";
import { rangeFromSpan } from "../ranges.js";

// ---------------------------------------------------------------------------
// Find-all-references + document highlight: both are pure translations over the
// references engine (session.referencesAt), which resolves the symbol under the
// cursor and returns its declaration + every occurrence (deduped by span), already
// shifted to DOCUMENT coordinates — the multi-statement cell dance lives inside
// SqlDocument.referencesAt now, not here. references maps the reference
// occurrences — plus the declaration when the client asks for it — to LSP
// Locations; documentHighlight maps every occurrence to a same-file highlight, with
// the declaration as a Write and references as Reads. No re-resolution here. Spans
// → Ranges via rangeFromSpan. Both are total: any no-result (off-symbol, broken
// input) degrades to [].
//
// Meta: Claude Code's LSP tool speaks computeReferences (findReferences); documentHighlight has no counterpart.
// ---------------------------------------------------------------------------

export function computeReferences(
	session: SqlSession,
	position: Position,
	includeDeclaration: boolean,
	uri: string,
): Location[] {
	const off = session.doc.lines.offsetAt(position.line, position.character);
	const occ = session.referencesAt(off);
	if (!occ) return [];
	const out: Location[] = [];
	const seen = new Set<string>();
	for (const o of occ.occurrences) {
		if (o.role === "declaration" && !includeDeclaration) continue;
		const range = rangeFromSpan(o.span);
		const key = `${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ uri, range });
	}
	return out;
}

export function computeDocumentHighlight(session: SqlSession, position: Position): DocumentHighlight[] {
	const off = session.doc.lines.offsetAt(position.line, position.character);
	const occ = session.referencesAt(off);
	if (!occ) return [];
	return occ.occurrences.map((o: Occurrence) => ({
		range: rangeFromSpan(o.span),
		kind: o.role === "declaration" ? DocumentHighlightKind.Write : DocumentHighlightKind.Read,
	}));
}
