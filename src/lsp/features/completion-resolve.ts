import { MarkupKind } from "vscode-languageserver-types";
import type { CompletionItem } from "vscode-languageserver-types";
import { FUNCTION_SIGNATURES, type FnSignature, type ParamSig } from "../../index.js";
import type { CompletionItemData } from "./completion.js";

// ---------------------------------------------------------------------------
// completionItem/resolve: the lazy second half of completion. The list handler
// (computeCompletion) emits bare items with a `data` payload but no expensive
// detail; the editor calls resolve only for the item it focuses, and we fill the
// function signature THEN — never for the whole list. resolve receives ONLY the
// item, so everything the lookup needs (kind, label, dialect) rides in `data`.
// Pure translation over the public FUNCTION_SIGNATURES table; never throws.
// ---------------------------------------------------------------------------

/** Resolve one CompletionItem: a curated function gains a rendered signature in `detail` (and a
 *  Markdown `documentation`); every other item is returned unchanged. Total — never throws. */
export function resolveCompletion(item: CompletionItem): CompletionItem {
	const data = item.data as CompletionItemData | undefined;
	if (!data || data.kind !== "function") return item;

	const sig = FUNCTION_SIGNATURES[data.dialect]?.[data.label.toLowerCase()];
	if (!sig) return item; // long-tail function with no curated signature — leave as-is.

	const rendered = renderSignature(sig);
	item.detail = rendered;
	item.documentation = { kind: MarkupKind.Markdown, value: "```sql\n" + rendered + "\n```" };
	return item;
}

/** `name(p1: t1, p2: t2)`; a variadic signature marks its repeating last param with a trailing `…`. */
function renderSignature(sig: FnSignature): string {
	const parts = sig.params.map(paramLabel);
	const rendered =
		sig.variadic && parts.length > 0 ? [...parts.slice(0, -1), `${parts[parts.length - 1]}, …`] : parts;
	return `${sig.name}(${rendered.join(", ")})`;
}

/** One param's display string: `name: type` when typed, else just `name`. */
function paramLabel(p: ParamSig): string {
	return p.type ? `${p.name}: ${p.type}` : p.name;
}
