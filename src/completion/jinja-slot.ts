// ---------------------------------------------------------------------------
// jinjaSlotAt(), where the caret sits inside a jinja tag, for completion.
//
// The NEUTRAL half of jinja completion (anvil REQ1/REQ2): given the templated
// document's tags + the caret offset, it says which call the caret is in and
// which arg slot, `{{ ref('cu| }}` → { callee: "ref", argIndex: 0, prefix: "cu" }.
// It carries NO dbt vocabulary: it does not know that `ref`'s arg 0 is a model.
// A consumer (a DbtTemplateProvider / the host) maps callee + argIndex to a role
// (ref arg0 → a model name) and supplies the candidates, exactly the way the SQL
// side maps a grammar slot to a schema lookup.
//
// Reuses the parse: it reads the tags the document already produced, never
// re-parses. Total: returns undefined off any jinja call slot; never throws.
// ---------------------------------------------------------------------------

import type { TagNode } from "../minijinja/tag-ast.js";

/** Where the caret sits inside a jinja call tag. NEUTRAL, the callee is a bare string; the dbt
 *  meaning of the slot (ref arg0 = a model) is the consumer's to apply. */
export interface JinjaSlot {
	/** The callee name, e.g. `"ref"`, `"source"`, `"my_macro"`. */
	callee: string;
	/** Dotted package before the callee (`dbt_utils` in `dbt_utils.star(...)`). */
	packageName?: string;
	/** 0-based index of the positional arg the caret is in. The callee-name slot (caret still in the
	 *  callee identifier, `{{ my_mac|`) is `-1`. */
	argIndex: number;
	/** The already-typed text of this slot up to the caret, quote-stripped, the prefix a consumer
	 *  filters its candidates by. Empty when the slot is untyped (`{{ ref(|`). */
	prefix: string;
	/** True when the enclosing tag is unclosed / mid-typing (its call node is `incomplete`). */
	incomplete: boolean;
}

/**
 * The jinja completion slot at `offset`, or undefined when the caret is not inside a call tag's
 * callee or arguments. `tags` is `parseTemplated(...).tags` (or `doc.templated.tags`); `text` is the
 * document source. Reuses the already-computed tags; never re-parses.
 */
export function jinjaSlotAt(tags: readonly TagNode[], text: string, offset: number): JinjaSlot | undefined {
	const tag = tags.find(
		(t): t is Extract<TagNode, { kind: "call" }> =>
			t.kind === "call" && offset >= t.tagSpan.start && offset <= t.tagSpan.end,
	);
	if (!tag) return undefined;

	const base = { callee: tag.name, ...(tag.packageName !== undefined ? { packageName: tag.packageName } : {}) };
	const incomplete = tag.incomplete === true;

	// Callee-name slot: the caret is still within (or right at the end of) the callee identifier,
	// before the open paren, the user is typing the macro name itself.
	if (offset <= tag.nameSpan.end) {
		return { ...base, argIndex: -1, prefix: text.slice(tag.nameSpan.start, offset), incomplete };
	}

	// Between the name and the open paren (e.g. whitespace) is no completable slot.
	const parenStart = tag.argsSpan?.start ?? Number.MAX_SAFE_INTEGER;
	if (offset < parenStart) return undefined;

	// Inside the arguments. The arg whose span covers the caret; else the caret sits in a gap (after
	// the open paren or a comma), so the slot is the next arg being typed = the count of args that
	// already ended before the caret.
	const inArg = tag.args.findIndex((a) => offset >= a.span.start && offset <= a.span.end);
	if (inArg >= 0) {
		const prefix = stripQuote(text.slice(tag.args[inArg].span.start, offset));
		return { ...base, argIndex: inArg, prefix, incomplete };
	}
	const argIndex = tag.args.filter((a) => a.span.end <= offset).length;
	return { ...base, argIndex, prefix: "", incomplete };
}

/** Drop a single leading quote from a partial string arg (`'cu` → `cu`) so the prefix is the value
 *  the consumer filters by. Leaves a non-string arg untouched. */
function stripQuote(raw: string): string {
	return raw.replace(/^['"]/, "");
}
