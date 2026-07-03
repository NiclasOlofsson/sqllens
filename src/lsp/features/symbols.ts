import { type DocumentSymbol, SymbolKind } from "vscode-languageserver-types";
import {
	formatType,
	type SchemaSource,
	type Sym,
	type SymbolKind as SqlSymbolKind,
	type SqlDocument,
} from "../../index.js";
import { rangeFromSpan } from "../ranges.js";

// ---------------------------------------------------------------------------
// Document symbols: the outline. Pure translation of the cached document's symbol
// model — declarations (tables/CTEs/subqueries) and output columns become
// DocumentSymbols. Bare references are omitted to keep the outline clean.
// Symbols resolve structurally with no schema; when one is configured, analyze(schema)
// carries inferred types into the outline detail.
//
// Meta: Claude Code's LSP tool speaks this method (documentSymbol); no workspaceSymbol here — single-document.
// ---------------------------------------------------------------------------

const KIND: Record<SqlSymbolKind, SymbolKind> = {
	table: SymbolKind.Class,
	cte: SymbolKind.Namespace,
	subquery: SymbolKind.Namespace,
	lateral: SymbolKind.Namespace,
	column: SymbolKind.Field,
	alias: SymbolKind.Field,
	function: SymbolKind.Function,
};

function include(s: Sym): boolean {
	if (s.modifiers.includes("declaration")) return true;
	if (s.modifiers.includes("output")) return true;
	return false;
}

export function computeDocumentSymbols(doc: SqlDocument, schema?: SchemaSource): DocumentSymbol[] {
	const out: DocumentSymbol[] = [];
	for (const s of doc.analyze(schema).symbols) {
		if (!include(s)) continue;
		const range = rangeFromSpan(s.span);
		const parts: string[] = [];
		if (s.type && s.type.kind !== "unknown") parts.push(formatType(s.type));
		if (s.frame !== "_main_") parts.push(s.frame);
		out.push({
			name: s.name,
			kind: KIND[s.kind],
			range,
			selectionRange: range,
			detail: parts.length ? parts.join(" — ") : undefined,
		});
	}
	return out;
}
