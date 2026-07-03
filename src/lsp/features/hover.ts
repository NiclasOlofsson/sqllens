import type { Hover, Position } from "vscode-languageserver-types";
import { formatType, type Schema, type SqlDocument } from "../../index.js";
import { cellBaseAt, rangeFromCst, rangeFromSpan, shiftRange } from "../ranges.js";
import { symbolAt } from "../sym-at.js";

// ---------------------------------------------------------------------------
// Hover: the inferred type of the expression under the cursor; when inference has no
// answer (no schema, unregistered function), fall back to what the scope tree knows —
// the symbol's kind + name — so hover is never empty on a known symbol.
//
// Meta: Claude Code's LSP tool speaks this method (hover).
// ---------------------------------------------------------------------------

export function computeHover(doc: SqlDocument, position: Position, schema?: Schema): Hover | null {
	const off = doc.lines.offsetAt(position.line, position.character);
	const hit = doc.nodeAt(off);
	if (hit) {
		const type = doc.analyze(schema).types.typeOf(hit.expr, hit.scope);
		if (type.kind !== "unknown") {
			// hit.expr.cst is CELL-relative (doc.nodeAt routes to the owning cell) — shift to doc coords.
			const range = shiftRange(rangeFromCst(hit.expr.cst), cellBaseAt(doc, off));
			return { contents: fence(formatType(type)), range };
		}
	}
	const sym = symbolAt(doc, doc.analyze(schema).symbols, off);
	if (!sym) return null;
	const typed = sym.type && sym.type.kind !== "unknown" ? `: ${formatType(sym.type)}` : "";
	return { contents: fence(`(${sym.kind}) ${sym.name}${typed}`), range: rangeFromSpan(sym.span) };
}

function fence(v: string): { kind: "markdown"; value: string } {
	return { kind: "markdown", value: "```\n" + v + "\n```" };
}
