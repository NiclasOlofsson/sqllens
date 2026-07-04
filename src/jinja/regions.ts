// ---------------------------------------------------------------------------
// Task 3 — R4: control-flow regions + set/macro template symbols
// (docs/jinja-front-end.md §R4).
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
// (assert by slicing the source). `tagSpan`/`nameSpan` are token-exact so their
// line/column are exact too. `bodySpan` and a region's `span` carry a BEST-EFFORT
// line/column anchored to the opening tag's start — regions.ts has only the tags
// (no source text), so it cannot resolve the document position of a mid-text
// offset (e.g. the char just past a tag's close). The offsets are the contract the
// editor consumes; consumers with the document re-derive line/column from offsets.
// ---------------------------------------------------------------------------

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
export function templateRegions(tags: TagNode[]): TemplateRegion[] {
	const roots: TemplateRegion[] = [];
	const stack: InProgressRegion[] = [];

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
			// Best-effort line/column: anchor to the opening tag (offsets are exact).
			const bodySpan: PartSpan = {
				start: bodyStart,
				end: Math.max(bodyStart, bodyEnd),
				line: a.tagSpan.line,
				column: a.tagSpan.column,
			};
			return { keyword: a.keyword, tagSpan: a.tagSpan, bodySpan, children: a.children };
		});
		const first = ip.arms[0];
		const last = ip.arms[ip.arms.length - 1];
		// EOF span end: the furthest known tag/child end belonging to this region.
		let known = last.tagSpan.end;
		for (const arm of arms) for (const c of arm.children) known = Math.max(known, c.span.end);
		const span: PartSpan = {
			start: first.tagSpan.start,
			end: spanEndOffset ?? known,
			line: first.tagSpan.line,
			column: first.tagSpan.column,
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
