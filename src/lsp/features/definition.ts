import type { Location, Position } from "vscode-languageserver-types";
import { symbolAt, type SqlSession } from "../../index.js";
import { rangeFromSpan } from "../ranges.js";

// ---------------------------------------------------------------------------
// Go-to-definition: reuse the cached document's symbol model. analyze().symbols
// already resolves each in-query reference to the span of its declaration
// (Sym.definition — a CTE name, or the projection in a CTE/subquery that produces
// a column). This finds the reference under the cursor and returns its definition
// Location. Pure translation: no re-resolution here. Offsets come from doc.lines.
//
// Goes through session.doc.analyze() (schema-free), not session.analyze(): this
// feature has never threaded a schema (the server never passed one), so the
// escape hatch preserves that — session.analyze() would apply the session's
// configured schema and change which symbols (e.g. star-expanded columns) show up.
//
// Meta: Claude Code's LSP tool speaks this method (goToDefinition).
// ---------------------------------------------------------------------------

export function computeDefinition(session: SqlSession, position: Position, uri: string): Location | null {
	const cursor = session.doc.lines.offsetAt(position.line, position.character);
	const best = symbolAt(session.doc.analyze().symbols, cursor, (s) => !!s.definition);
	if (!best?.definition) return null;
	return { uri, range: rangeFromSpan(best.definition) };
}
