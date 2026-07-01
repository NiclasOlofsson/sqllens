import type { Location, Position } from "vscode-languageserver-types";
import type { SqlDocument } from "../../index.js";
import { rangeFromSpan } from "../ranges.js";
import { symbolAt } from "../sym-at.js";

// ---------------------------------------------------------------------------
// Go-to-definition: reuse the cached document's symbol model. analyze().symbols
// already resolves each in-query reference to the span of its declaration
// (Sym.definition — a CTE name, or the projection in a CTE/subquery that produces
// a column). This finds the reference under the cursor and returns its definition
// Location. Pure translation: no re-resolution here. Offsets come from doc.lines.
//
// Meta: Claude Code's LSP tool speaks this method (goToDefinition).
// ---------------------------------------------------------------------------

export function computeDefinition(doc: SqlDocument, position: Position, uri: string): Location | null {
	const cursor = doc.lines.offsetAt(position.line, position.character);
	const best = symbolAt(doc, doc.analyze().symbols, cursor, (s) => !!s.definition);
	if (!best?.definition) return null;
	return { uri, range: rangeFromSpan(best.definition) };
}
