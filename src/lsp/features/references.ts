import type { Location, Position, DocumentHighlight } from "vscode-languageserver-types";
import { DocumentHighlightKind } from "vscode-languageserver-types";
import { referencesAt, type Occurrence, type SchemaSource, type SqlDocument } from "../../index.js";
import { cellBaseOf, rangeFromSpan, shiftRange } from "../ranges.js";

// ---------------------------------------------------------------------------
// Find-all-references + document highlight: both are pure translations over the
// references engine (referencesAt), which resolves the symbol under the cursor and
// returns its declaration + every occurrence (deduped by span). references maps the
// reference occurrences — plus the declaration when the client asks for it — to LSP
// Locations; documentHighlight maps every occurrence to a same-file highlight, with
// the declaration as a Write and references as Reads. No re-resolution here. Offsets
// come from doc.lines; spans → Ranges via rangeFromSpan. Both are total: any
// no-result (off-symbol, broken input) degrades to [].
//
// Meta: Claude Code's LSP tool speaks computeReferences (findReferences); documentHighlight has no counterpart.
// ---------------------------------------------------------------------------

export function computeReferences(
	doc: SqlDocument,
	position: Position,
	includeDeclaration: boolean,
	uri: string,
	schema?: SchemaSource,
): Location[] {
	const off = doc.lines.offsetAt(position.line, position.character);
	const cell = doc.cellAt(off);
	const scopes = cell ? cell.scopes : doc.scopes;
	const ast = cell ? cell.ast : doc.ast;
	const base = cellBaseOf(doc, cell);
	const occ = referencesAt(scopes, cell ? off - cell.span.start : off, schema, ast);
	if (!occ) return [];
	const out: Location[] = [];
	const seen = new Set<string>();
	for (const o of occ.occurrences) {
		if (o.role === "declaration" && !includeDeclaration) continue;
		const range = shiftRange(rangeFromSpan(o.span), base);
		const key = `${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ uri, range });
	}
	return out;
}

export function computeDocumentHighlight(
	doc: SqlDocument,
	position: Position,
	schema?: SchemaSource,
): DocumentHighlight[] {
	const off = doc.lines.offsetAt(position.line, position.character);
	const cell = doc.cellAt(off);
	const scopes = cell ? cell.scopes : doc.scopes;
	const ast = cell ? cell.ast : doc.ast;
	const base = cellBaseOf(doc, cell);
	const occ = referencesAt(scopes, cell ? off - cell.span.start : off, schema, ast);
	if (!occ) return [];
	return occ.occurrences.map((o: Occurrence) => ({
		range: shiftRange(rangeFromSpan(o.span), base),
		kind: o.role === "declaration" ? DocumentHighlightKind.Write : DocumentHighlightKind.Read,
	}));
}
