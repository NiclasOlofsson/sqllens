import type { Hover, Position } from "vscode-languageserver-types";
import { formatType, symbolAt, type SqlSession } from "../../index.js";
import { cellBaseAt, rangeFromCst, rangeFromSpan, shiftRange } from "../ranges.js";

// ---------------------------------------------------------------------------
// Hover: the inferred type of the expression under the cursor; when inference has no
// answer (no schema, unregistered function), fall back to what the scope tree knows —
// the symbol's kind + name — so hover is never empty on a known symbol.
//
// Meta: Claude Code's LSP tool speaks this method (hover).
// ---------------------------------------------------------------------------

export function computeHover(session: SqlSession, position: Position): Hover | null {
	const off = session.doc.lines.offsetAt(position.line, position.character);
	const hit = session.nodeAt(off);
	if (hit) {
		const types = session.types();
		const type = types.typeOf(hit.expr, hit.scope);
		if (type.kind !== "unknown") {
			// hit.expr.cst is CELL-relative (nodeAt routes to the owning cell) — shift to doc coords.
			const range = shiftRange(rangeFromCst(hit.expr.cst), cellBaseAt(session.doc, off));
			const nullability = types.nullabilityOf(hit.expr, hit.scope);
			const suffix = nullability === "notnull" ? " — not null" : nullability === "nullable" ? " — nullable" : "";
			return { contents: fence(formatType(type) + suffix), range };
		}
	}
	const sym = symbolAt(session.deriveSymbols(), off);
	if (!sym) return null;
	const typed = sym.type && sym.type.kind !== "unknown" ? `: ${formatType(sym.type)}` : "";
	return { contents: fence(`(${sym.kind}) ${sym.name}${typed}`), range: rangeFromSpan(sym.span) };
}

function fence(v: string): { kind: "markdown"; value: string } {
	return { kind: "markdown", value: "```\n" + v + "\n```" };
}
