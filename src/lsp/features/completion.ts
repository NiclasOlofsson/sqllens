import { CompletionItemKind } from "vscode-languageserver-types";
import type { CompletionItem, Position } from "vscode-languageserver-types";
import { complete, type Completion, type Dialect, type SchemaProvider, type SqlDocument } from "../../index.js";

// ---------------------------------------------------------------------------
// Completion: the interactive editor feature that lives in the BROKEN-input
// world (the user is mid-keystroke). It maps the cached document's caret offset
// to the public `complete()` candidates — keywords, schema tables, scope
// columns, function names — and turns each into an LSP CompletionItem. Pure
// translation: positions in (line/character), items out. complete() never
// throws, so neither does this.
// ---------------------------------------------------------------------------

// Our coarse completion kind → the standard LSP CompletionItemKind.
const KIND: Record<Completion["kind"], CompletionItemKind> = {
	keyword: CompletionItemKind.Keyword,
	column: CompletionItemKind.Field,
	table: CompletionItemKind.Class,
	function: CompletionItemKind.Function,
};

export function computeCompletion(doc: SqlDocument, position: Position, schema?: SchemaProvider): CompletionItem[] {
	const off = doc.lines.offsetAt(position.line, position.character);
	const items = complete(doc, off, schema);
	return items.map((c) => {
		const item: CompletionItem = { label: c.label, kind: KIND[c.kind] };
		if (c.detail !== undefined) item.detail = c.detail;
		// Everything completionItem/resolve needs, since resolve receives ONLY the item (no
		// doc/position): the kind, the label, and the document's dialect for the signature lookup.
		item.data = { kind: c.kind, label: c.label, dialect: doc.dialect } satisfies CompletionItemData;
		return item;
	});
}

/** The `data` payload carried on each CompletionItem so completionItem/resolve — which gets only the
 *  item — can fill a function's signature lazily. */
export interface CompletionItemData {
	kind: Completion["kind"];
	label: string;
	dialect: Dialect;
}
