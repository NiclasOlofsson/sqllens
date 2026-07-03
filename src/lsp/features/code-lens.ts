import type { CodeLens } from "vscode-languageserver-types";
import { referencesAt, type Schema, type Sym, type SqlDocument } from "../../index.js";
import { rangeFromSpan } from "../ranges.js";

// ---------------------------------------------------------------------------
// CodeLens: a "N references" count over each in-query declaration. Pure translation
// over the cached document's symbol model + the references engine (referencesAt) —
// no re-resolution of its own. For each declaration worth a count (cte/alias/column/
// subquery), it maps the declaration's span start to an offset, asks referencesAt for
// every occurrence of that symbol, and emits a lens whose title is the occurrence
// count. Sym.span is 1-based line / 0-based column; doc.lines.offsetAt is 0-based line
// — convert (span.line - 1). Total: any decl that doesn't resolve is skipped; never
// throws → []. The command is empty (display-only); a client may resolve it later.
// ---------------------------------------------------------------------------

const COUNTABLE = new Set<Sym["kind"]>(["cte", "alias", "column", "subquery"]);

export function computeCodeLens(doc: SqlDocument, schema?: Schema): CodeLens[] {
	try {
		const out: CodeLens[] = [];
		for (const s of doc.analyze(schema).symbols) {
			if (!s.modifiers.includes("declaration")) continue;
			if (!COUNTABLE.has(s.kind)) continue;
			// s.span is in DOC coordinates (analyze() merges every cell's symbols there); resolve the
			// count over the CELL owning the declaration, with a cell-relative offset.
			const offset = doc.lines.offsetAt(s.span.line - 1, s.span.column);
			const cell = doc.cellAt(offset);
			const scopes = cell ? cell.scopes : doc.scopes;
			const ast = cell ? cell.ast : doc.ast;
			const occ = referencesAt(scopes, cell ? offset - cell.span.start : offset, schema, ast);
			if (!occ) continue;
			const n = occ.occurrences.filter((o) => o.role === "reference").length;
			out.push({
				range: rangeFromSpan(s.span),
				command: { title: `${n} reference${n === 1 ? "" : "s"}`, command: "" },
			});
		}
		return out;
	} catch {
		return []; // total: any internal failure degrades to no lenses, never a throw
	}
}
