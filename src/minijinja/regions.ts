// ---------------------------------------------------------------------------
// Task 3 — R4: control-flow regions + set/macro template symbols
// (docs/minijinja-front-end.md §R4).
//
// `templateRegions(tags)` stack-pairs the enriched `control` TagNodes into a
// source-ordered region tree — `{% if %}/{% elif %}/{% else %}/{% endif %}`,
// `{% for %}…{% endfor %}`, `{% macro %}…{% endmacro %}` — for completion inside
// `{{ }}`, folding, and later variant expansion. `templateSymbols(tags)` extracts
// the go-to-def symbols (`{% set %}` targets, `{% macro %}` names).
//
// TOLERANT / TOTAL (global-constraints): a stray closer is skipped; an unclosed
// opener closes at the last known tag; an orphan `elif`/`else` becomes its own
// single-arm `if` region. Never throws on any tag sequence.
//
// SPAN CONTRACT: every span's OFFSETS (start/end) are exact and content-true
// (assert by slicing the source). `tagSpan`/`nameSpan` are token-exact, and a
// region's `span` / a symbol's `span` anchor their line/column to their OWN start
// offset, so those are coherent. `bodySpan.start` is the char PAST the opening tag
// (not the tag start), so its line/column can only be resolved from the source
// text: pass `text` to `templateRegions` and each bodySpan's line/column is the
// exact document position of its start offset (via `LineIndex`). Without `text`
// the function stays usable standalone, falling back to the opening tag's anchor
// as a best-effort (offsets still exact) — the only case where line/column is
// approximate.
// ---------------------------------------------------------------------------

import { LineIndex } from "../document/line-index.js";
import type { PartSpan } from "../ir/part-span.js";
import type { TagNode } from "./tag-ast.js";

/** One arm of a control region — an `if`/`elif`/`else` branch, or the single body of a `for`/`macro`. */
export interface TemplateArm {
	/** `"if"` | `"elif"` | `"else"` | `"for"` | `"macro"` — the arm's opening keyword. */
	keyword: string;
	/** The arm's opening tag (`{% if a %}`, `{% else %}`, `{% for … %}`, `{% macro … %}`). */
	tagSpan: PartSpan;
	/** End of the opening tag → start of the next arm/close tag (may be empty). */
	bodySpan: PartSpan;
	/** Nested regions inside this arm. */
	children: TemplateRegion[];
}

/** A control-flow region — an `if`/`for`/`macro` block paired from its control tags. */
export interface TemplateRegion {
	kind: "if" | "for" | "macro";
	/** `if`: one arm per `if`/`elif`/`else`; `for`/`macro`: exactly one. */
	arms: TemplateArm[];
	/** Opening tag start → closing tag end (or the last known tag end when unbalanced). */
	span: PartSpan;
}

/** A go-to-def template symbol — a `{% set %}` target or a `{% macro %}` name. */
export interface TemplateSymbol {
	kind: "set" | "macro";
	name: string;
	nameSpan: PartSpan;
	/** The whole tag (`{% set x = … %}`) or block (`{% macro %}…{% endmacro %}`). */
	span: PartSpan;
}

/** The `control` arm of the TagNode union — carries the R4 enrichment. */
type ControlTag = Extract<TagNode, { kind: "control" }>;

/** opener keyword → region kind. */
const OPENERS: Record<string, TemplateRegion["kind"]> = { if: "if", for: "for", macro: "macro" };
/** closer keyword → the region kind it closes. */
const CLOSERS: Record<string, TemplateRegion["kind"]> = { endif: "if", endfor: "for", endmacro: "macro" };

/** A region under construction — arms accumulate; `bodyEnd` is filled as the next boundary is seen. */
interface InProgressArm {
	keyword: string;
	tagSpan: PartSpan;
	/** Offset where this arm's body ends (start of the next arm/closer); undefined until known. */
	bodyEnd: number | undefined;
	children: TemplateRegion[];
}
interface InProgressRegion {
	kind: TemplateRegion["kind"];
	arms: InProgressArm[];
}

function newArm(t: ControlTag): InProgressArm {
	return { keyword: t.keyword ?? "", tagSpan: t.tagSpan, bodyEnd: undefined, children: [] };
}

/**
 * Pair the control tags into a source-ordered region tree. Total: any tag
 * sequence (balanced, unbalanced, stray, orphan) yields a best-effort tree and
 * never throws.
 */
export function templateRegions(tags: TagNode[], text?: string): TemplateRegion[] {
	const roots: TemplateRegion[] = [];
	const stack: InProgressRegion[] = [];
	// When the source text is available, resolve each bodySpan's start offset to its
	// EXACT document position (LineIndex is 0-based line/column; PartSpan is 1-based
	// line / 0-based column). Absent → best-effort anchor to the opening tag.
	const lineIndex = text === undefined ? undefined : new LineIndex(text);

	/** Emit a finalized region into the enclosing arm's children, or the roots. */
	const emit = (region: TemplateRegion): void => {
		const parent = stack[stack.length - 1];
		if (parent) parent.arms[parent.arms.length - 1].children.push(region);
		else roots.push(region);
	};

	/**
	 * Finalize an in-progress region. `bodyEndOffset` closes the last arm's body
	 * (the closer's start, or undefined at EOF → body ends at the arm's tag);
	 * `spanEndOffset` closes the region span (the closer's end, or undefined at EOF
	 * → the last known tag/child end).
	 */
	const finalize = (
		ip: InProgressRegion,
		bodyEndOffset: number | undefined,
		spanEndOffset: number | undefined,
	): TemplateRegion => {
		const arms: TemplateArm[] = ip.arms.map((a) => {
			const bodyStart = a.tagSpan.end;
			const bodyEnd = a.bodyEnd ?? bodyEndOffset ?? bodyStart;
			const clampedEnd = Math.max(bodyStart, bodyEnd);
			// bodyStart is the char PAST the opening tag — exactly the tag's OWN end
			// position (tagSpan.endLine/endColumn), no index needed. The body END
			// position resolves from the LineIndex when text is available; without
			// text it degrades to the start position (a known limit of the text-less
			// templateRegions overload — parseTemplated always passes text).
			const endPos = lineIndex?.positionAt(clampedEnd);
			const bodySpan: PartSpan = {
				start: bodyStart,
				end: clampedEnd,
				line: a.tagSpan.endLine,
				column: a.tagSpan.endColumn,
				endLine: endPos ? endPos.line + 1 : a.tagSpan.endLine,
				endColumn: endPos ? endPos.column : a.tagSpan.endColumn,
			};
			return { keyword: a.keyword, tagSpan: a.tagSpan, bodySpan, children: a.children };
		});
		const first = ip.arms[0];
		const last = ip.arms[ip.arms.length - 1];
		// EOF span end: the furthest known tag/child end belonging to this region.
		let known = last.tagSpan.end;
		for (const arm of arms) for (const c of arm.children) known = Math.max(known, c.span.end);
		const spanEnd = spanEndOffset ?? known;
		// Region end position: exact via the LineIndex; text-less fallback = the last
		// arm tag's own end (exact whenever the region ends at that tag).
		const spanEndPos = lineIndex?.positionAt(spanEnd);
		const span: PartSpan = {
			start: first.tagSpan.start,
			end: spanEnd,
			line: first.tagSpan.line,
			column: first.tagSpan.column,
			endLine: spanEndPos ? spanEndPos.line + 1 : last.tagSpan.endLine,
			endColumn: spanEndPos ? spanEndPos.column : last.tagSpan.endColumn,
		};
		return { kind: ip.kind, arms, span };
	};

	/** Close a region of `kind` on behalf of a closer, auto-closing any unclosed inner regions. */
	const close = (kind: TemplateRegion["kind"], closer: ControlTag): void => {
		let idx = -1;
		for (let j = stack.length - 1; j >= 0; j--) {
			if (stack[j].kind === kind) {
				idx = j;
				break;
			}
		}
		if (idx === -1) return; // stray closer — skip (tolerant)
		// Auto-close unclosed inner regions above the match (they end at the closer's start).
		while (stack.length - 1 > idx) {
			emit(finalize(stack.pop()!, closer.tagSpan.start, closer.tagSpan.start));
		}
		emit(finalize(stack.pop()!, closer.tagSpan.start, closer.tagSpan.end));
	};

	for (const tag of tags) {
		if (tag.kind !== "control") continue;
		const kw = tag.keyword;
		if (!kw) continue;

		if (kw in OPENERS) {
			stack.push({ kind: OPENERS[kw], arms: [newArm(tag)] });
			continue;
		}
		if (kw in CLOSERS) {
			close(CLOSERS[kw], tag);
			continue;
		}
		if (kw === "elif" || kw === "else") {
			const top = stack[stack.length - 1];
			if (top && top.kind === "if") {
				top.arms[top.arms.length - 1].bodyEnd = tag.tagSpan.start;
				top.arms.push(newArm(tag));
			} else {
				// Orphan elif/else (no open if at the top) → its own single-arm if region.
				stack.push({ kind: "if", arms: [newArm(tag)] });
			}
			continue;
		}
		// Any other keyword (set/do/block/custom dbt tag) is not a region control.
	}

	// EOF: close every still-open region (unbalanced) at its last known tag.
	while (stack.length) emit(finalize(stack.pop()!, undefined, undefined));

	return roots;
}

/**
 * Extract go-to-def symbols: `{% set x = … %}` targets (span = the whole tag) and
 * `{% macro name(...) %}…{% endmacro %}` names (span = the whole block). Total:
 * never throws; a name is emitted only when the tag actually declared one
 * (never-wrong — no fabricated names). Source-ordered by span start.
 */
export function templateSymbols(tags: TagNode[]): TemplateSymbol[] {
	const out: TemplateSymbol[] = [];
	const openMacros: ControlTag[] = [];

	for (const tag of tags) {
		if (tag.kind !== "control") continue;
		const kw = tag.keyword;
		if (kw === "set" && tag.name && tag.nameSpan) {
			out.push({ kind: "set", name: tag.name, nameSpan: tag.nameSpan, span: tag.tagSpan });
		} else if (kw === "macro" && tag.name && tag.nameSpan) {
			openMacros.push(tag);
		} else if (kw === "endmacro") {
			const open = openMacros.pop();
			if (open && open.name && open.nameSpan) {
				out.push({
					kind: "macro",
					name: open.name,
					nameSpan: open.nameSpan,
					span: {
						start: open.tagSpan.start,
						end: tag.tagSpan.end,
						line: open.tagSpan.line,
						column: open.tagSpan.column,
						// The symbol span ends exactly where the endmacro tag ends.
						endLine: tag.tagSpan.endLine,
						endColumn: tag.tagSpan.endColumn,
					},
				});
			}
		}
	}
	// Unclosed macros still surface a symbol (span = the opening tag alone).
	for (const open of openMacros) {
		if (open.name && open.nameSpan) {
			out.push({ kind: "macro", name: open.name, nameSpan: open.nameSpan, span: open.tagSpan });
		}
	}

	return out.sort((a, b) => a.span.start - b.span.start);
}
