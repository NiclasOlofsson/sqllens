import { type DocumentSymbol, SymbolKind } from "vscode-languageserver-types";
import type { Sym, SymbolKind as SqlSymbolKind, SqlDocument } from "../../index.js";
import { rangeFromSpan } from "../ranges.js";

// ---------------------------------------------------------------------------
// Document symbols: the outline. Pure translation of the cached document's symbol
// model — declarations (tables/CTEs/subqueries) and output columns become
// DocumentSymbols. Bare references are omitted to keep the outline clean.
// Symbols resolve structurally with no schema; analyze() defaults to one.
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

export function computeDocumentSymbols(doc: SqlDocument): DocumentSymbol[] {
  const out: DocumentSymbol[] = [];
  for (const s of doc.analyze().symbols) {
    if (!include(s)) continue;
    const range = rangeFromSpan(s.span);
    out.push({
      name: s.name,
      kind: KIND[s.kind],
      range,
      selectionRange: range,
      detail: s.frame === "_main_" ? undefined : s.frame,
    });
  }
  return out;
}
