// ---------------------------------------------------------------------------
// jinjaSlotAt(), where the caret sits inside a jinja tag, for completion.
//
// The NEUTRAL half of jinja completion (anvil REQ1/REQ2): given the templated
// document's tags + the caret offset, it says which call the caret is in and which
// arg slot, `{{ ref('cu| }}` -> { callee: "ref", argIndex: 0, prefix: "cu" }. It
// carries NO dbt vocabulary: it does not know that `ref`'s arg 0 is a model. A
// consumer (a DbtTemplateProvider / the host) maps callee + argIndex to a role (ref
// arg0 -> a model name) and supplies the candidates, exactly the way the SQL side
// maps a grammar slot to a schema lookup.
//
// It finds the INNERMOST call covering the caret across every tag's call list, so a
// nested `outer(inner(|))` reports `inner`, and a call embedded in a control tag
// (`{% if is_incremental(| %}`) is found at all, not just a top-level `{{ call() }}`.
// A caret on a bare leading identifier with no open paren yet (`{{ re`, still typing
// the callee) is a callee-name slot too, read straight off the text.
//
// Reuses the parse: it reads the tags the document already produced, never re-parses.
// Total: returns undefined off any jinja completion slot; never throws.
// ---------------------------------------------------------------------------

import type { PartSpan } from "../ir/part-span.js";
import type { TemplateCall } from "../qualify/template-provider.js";
import { callOf } from "../minijinja/apply-tags.js";
import type { MacroCall, TagArg, TagNode } from "../minijinja/tag-ast.js";

/** Where the caret sits inside a jinja call tag. NEUTRAL, the callee is a bare string; the dbt
 *  meaning of the slot (ref arg0 = a model) is the consumer's to apply. */
export interface JinjaSlot {
	/** The callee name, e.g. `"ref"`, `"source"`, `"my_macro"`. */
	callee: string;
	/** Dotted package before the callee (`dbt_utils` in `dbt_utils.star(...)`). */
	packageName?: string;
	/** The WHOLE parsed call (issue #37): name, packageParts and every sibling arg's literal value
	 *  (null where computed) — the same TemplateCall shape every provider method receives. A slot's
	 *  candidates can depend on the other args (source('raw', '|')'s candidates are the tables OF
	 *  raw), so the provider callback gets the call, not just the callee name. */
	call: TemplateCall;
	/** 0-based index of the positional arg the caret is in. The callee-name slot (caret still in the
	 *  callee identifier, `{{ my_mac|`) is `-1`. */
	argIndex: number;
	/** The already-typed text of this slot up to the caret, quote-stripped, the prefix a consumer
	 *  filters its candidates by. Empty when the slot is untyped (`{{ ref(|`). */
	prefix: string;
	/** True when the slot is unclosed / mid-typing (an `incomplete` call node, or a bare callee with no
	 *  open paren yet). */
	incomplete: boolean;
}

/** A call the caret might sit in, with the extent used to pick the innermost. `start`..`end` is the
 *  tag span for a top-level call (so a caret in leading whitespace still resolves to it) and the
 *  name-through-args span for a nested/embedded call (so the tighter one wins). */
interface CallHit {
	name: string;
	nameSpan: PartSpan;
	packageName?: string;
	argsSpan?: PartSpan;
	args: readonly TagArg[];
	incomplete: boolean;
	start: number;
	end: number;
}

/**
 * The jinja completion slot at `offset`, or undefined when the caret is not in a completable jinja
 * position. `tags` is `parseTemplated(...).tags` (or `doc.templated.tags`); `text` is the document
 * source. Reuses the already-computed tags; never re-parses.
 */
export function jinjaSlotAt(tags: readonly TagNode[], text: string, offset: number): JinjaSlot | undefined {
	const hit = innermostCallAt(tags, offset);
	if (hit) return slotFromCall(hit, text, offset);
	// No call covers the caret: a bare leading identifier being typed is still a callee-name slot.
	return bareCalleeSlot(tags, text, offset);
}

/** The innermost call covering `offset`: the top-level call node of a `{{ call() }}` tag, plus every
 *  nested call (`calls[1..]`) and every call embedded in a `{% … %}` control tag (`calls[]`). The
 *  smallest covering extent wins, so `inner` beats `outer` and a control-tag call is reachable. */
function innermostCallAt(tags: readonly TagNode[], offset: number): CallHit | undefined {
	let best: CallHit | undefined;
	const consider = (h: CallHit): void => {
		if (offset < h.start || offset > h.end) return;
		if (!best || h.end - h.start < best.end - best.start) best = h;
	};
	for (const t of tags) {
		if (t.kind === "call") {
			// The node's own top-level call carries the `incomplete` flag; its tag span is the extent so a
			// caret in the tag's leading whitespace still resolves to it. `calls[0]` duplicates this
			// top-level, so nested calls are `calls[1..]`.
			consider({
				name: t.name,
				nameSpan: t.nameSpan,
				...(t.packageName !== undefined ? { packageName: t.packageName } : {}),
				...(t.argsSpan ? { argsSpan: t.argsSpan } : {}),
				args: t.args,
				incomplete: t.incomplete === true,
				start: t.tagSpan.start,
				end: t.tagSpan.end,
			});
			for (const c of t.calls.slice(1)) consider(macroHit(c));
		} else if (t.kind === "control") {
			for (const c of t.calls) consider(macroHit(c));
		}
	}
	return best;
}

/** A nested / control-embedded MacroCall as a CallHit: its extent is the callee (with any package)
 *  through the close paren, so it is tighter than the enclosing tag and wins the innermost pick. */
function macroHit(c: MacroCall): CallHit {
	return {
		name: c.name,
		nameSpan: c.nameSpan,
		...(c.packageName !== undefined ? { packageName: c.packageName } : {}),
		...(c.argsSpan ? { argsSpan: c.argsSpan } : {}),
		args: c.args,
		incomplete: false,
		start: c.packageSpan?.start ?? c.nameSpan.start,
		end: c.argsSpan?.end ?? c.nameSpan.end,
	};
}

/** The slot for a caret inside a resolved call: the callee name, or the positional argument. */
function slotFromCall(c: CallHit, text: string, offset: number): JinjaSlot | undefined {
	// The whole call rides the slot (#37): callOf reads name + literal args off the source text,
	// the same extraction apply-tags feeds the provider everywhere else.
	const call = callOf(
		{
			name: c.name,
			nameSpan: c.nameSpan,
			args: c.args,
			...(c.packageName !== undefined ? { packageName: c.packageName } : {}),
		} as MacroCall,
		text,
	);
	const base = { callee: c.name, call, ...(c.packageName !== undefined ? { packageName: c.packageName } : {}) };

	// Callee-name slot: the caret is still within (or right at the end of) the callee identifier,
	// before the open paren, the user is typing the macro name itself.
	if (offset <= c.nameSpan.end) {
		return { ...base, argIndex: -1, prefix: text.slice(c.nameSpan.start, offset), incomplete: c.incomplete };
	}

	// Between the name and the open paren (e.g. whitespace) is no completable slot.
	const parenStart = c.argsSpan?.start ?? Number.MAX_SAFE_INTEGER;
	if (offset < parenStart) return undefined;

	// Inside the arguments. The arg whose span covers the caret; else the caret sits in a gap (after
	// the open paren or a comma), so the slot is the next arg being typed = the count of args that
	// already ended before the caret.
	const inArg = c.args.findIndex((a) => offset >= a.span.start && offset <= a.span.end);
	if (inArg >= 0) {
		return {
			...base,
			argIndex: inArg,
			prefix: stripQuote(text.slice(c.args[inArg]!.span.start, offset)),
			incomplete: c.incomplete,
		};
	}
	const argIndex = c.args.filter((a) => a.span.end <= offset).length;
	return { ...base, argIndex, prefix: "", incomplete: c.incomplete };
}

/** A bare leading identifier being typed in a `{{ }}` expression (`{{ re`, `{{ region`) as a
 *  callee-name slot. The `other` tag drops the identifier, so read it off the text: only an
 *  expression tag (opens `{{`), and only when the caret sits on a single leading identifier (nothing
 *  but whitespace before it, no member access or operators). So a callee being typed toward a call
 *  and a bare variable both offer the host's callee candidates, filtered by the prefix. */
function bareCalleeSlot(tags: readonly TagNode[], text: string, offset: number): JinjaSlot | undefined {
	const tag = tags.find((t) => t.kind === "other" && offset > t.tagSpan.start && offset <= t.tagSpan.end);
	if (!tag) return undefined;
	if (text.slice(tag.tagSpan.start, tag.tagSpan.start + 2) !== "{{") return undefined;
	const before = text.slice(tag.tagSpan.start + 2, offset);
	const m = /^\s*([A-Za-z_]\w*)$/.exec(before);
	if (!m) return undefined;
	// No parsed call exists yet (`{{ re`) — the slot's call is the bare callee with no args.
	return { callee: m[1]!, call: { name: m[1]!, args: [] }, argIndex: -1, prefix: m[1]!, incomplete: true };
}

/** Drop a single leading quote from a partial string arg (`'cu` -> `cu`) so the prefix is the value
 *  the consumer filters by. Leaves a non-string arg untouched. */
function stripQuote(raw: string): string {
	return raw.replace(/^['"]/, "");
}
