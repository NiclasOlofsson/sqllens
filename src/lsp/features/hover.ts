import type { Hover, Position } from "vscode-languageserver-types";
import { formatType, type Schema, type SqlDocument } from "../../index.js";
import { rangeFromCst } from "../ranges.js";

// ---------------------------------------------------------------------------
// Hover: the inferred type of the expression under the cursor. Pure translation
// over the cached document model — nodeAt finds the expr + its scope, the cached
// analyze(schema).types infers the type (the library's inference, not ours),
// formatType renders it. No re-parse here.
// ---------------------------------------------------------------------------

export function computeHover(doc: SqlDocument, position: Position, schema?: Schema): Hover | null {
	const off = doc.lines.offsetAt(position.line, position.character);
	const hit = doc.nodeAt(off);
	if (!hit) return null;

	const type = doc.analyze(schema).types.typeOf(hit.expr, hit.scope);
	if (type.kind === "unknown") return null;

	return {
		contents: { kind: "markdown", value: "```\n" + formatType(type) + "\n```" },
		range: rangeFromCst(hit.expr.cst),
	};
}
