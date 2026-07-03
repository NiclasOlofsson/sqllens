import { type InlayHint, InlayHintKind, type Position, type Range } from "vscode-languageserver-types";
import { formatType, type Schema, type Scope, type SqlDocument } from "../../index.js";
import { cellBaseOf, rangeFromCst, shiftPosition } from "../ranges.js";

// ---------------------------------------------------------------------------
// Inlay hints: each SELECT output column's inferred type, shown inline at the
// end of the projection (like a `: decimal` type annotation). Pure translation
// over the cached document model — walk the scope tree, and for each select
// body's projections ask the cached analyze(schema).types for the type
// (the library's inference, not ours). formatType renders it; unknown types are
// skipped (no schema, or undeterminable — a useless hint). Only hints whose
// anchor falls within the requested (visible) range are emitted. Never throws.
// ---------------------------------------------------------------------------

export function computeInlayHints(doc: SqlDocument, range: Range, schema?: Schema): InlayHint[] {
	const types = doc.analyze(schema).types;
	const out: InlayHint[] = [];

	// Each cell's scope tree carries CELL-relative CST spans, so a projection's anchor position shifts
	// by the owning cell's start. Walking per cell (rather than doc.scopes) is what surfaces hints for
	// every statement — doc.scopes is the empty compound facade for a multi-cell document.
	const walk = (scope: Scope, base: ReturnType<typeof cellBaseOf>): void => {
		if (scope.body.kind === "select") {
			for (const projection of scope.body.projections) {
				if (projection.isStar) continue; // a star has no single type
				const t = types.typeOf(projection.expr, scope);
				if (t.kind === "unknown") continue; // no schema / undeterminable — don't clutter
				const position = shiftPosition(rangeFromCst(projection.cst).end, base);
				if (!within(range, position)) continue; // honor the requested (visible) range
				out.push({
					position,
					label: ": " + formatType(t),
					kind: InlayHintKind.Type,
					paddingLeft: true,
				});
			}
		}
		for (const child of scope.children) walk(child, base);
	};

	for (const cell of doc.statements) walk(cell.scopes.root, cellBaseOf(doc, cell));
	return out;
}

/** Whether `pos` falls within `range` (inclusive of both ends). */
function within(range: Range, pos: Position): boolean {
	return !before(pos, range.start) && !before(range.end, pos);
}

/** True when `a` is strictly before `b` in (line, character) order. */
function before(a: Position, b: Position): boolean {
	return a.line < b.line || (a.line === b.line && a.character < b.character);
}
