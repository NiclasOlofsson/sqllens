// ---------------------------------------------------------------------------
// Task 4 — variant expansion (docs/jinja-front-end.md §Variant realization).
//
// `templateVariants(text, dialect)` enumerates the `{% if %}/{% elif %}/{% else %}`
// branch variants of a dbt template as coherent, lazily-parsed alternatives, so the
// editor can give feedback on EVERY arm regardless of which one runs at render time.
//
// ARM-COVERAGE, NOT cross-product (the decided shape):
//   - Variant 0 = every region's arm 0 active (all-defaults).
//   - Then ONE variant per (region, armIndex>0): that variant activates exactly that
//     one non-default arm; ALL other regions take their arm 0.
// LINEAR in total arm count — 1 + Σ over regions of (arms−1) — never combinatorial.
// A `{% for %}`/`{% macro %}` region is single-arm (its default IS the representative
// single iteration / the body parses in place), so it contributes NO extra variant.
//
// REALIZATION: for a given variant, whitespace-blank (newline-preserving, coordinates
// intact — the exact technique the segmenter uses for its placeholder fill) the
// `bodySpan` ranges of every INACTIVE arm over the ORIGINAL text, then run the
// UNTOUCHED `parseTemplated` on the blank. The active arm's body stays live; inactive
// arms' bodies become whitespace, so an incoherent "two WHEREs" never reaches the SQL
// parse. The control-tag DELIMITERS themselves (`{% if %}`, `{% else %}`, `{% endif %}`)
// are already whitespace-filled by parseTemplated's own placeholder pass — blanking
// only the bodies composes cleanly with it (a blanked body that happens to span a
// nested region's tags simply erases those tags too, still coherent).
//
// LAZY: `TemplateVariant.parse()` computes on first call and MEMOIZES.
// TOTAL (global-constraints): never throws — region enumeration is guarded and
// `parseTemplated` is itself total. The primary `parseTemplated` result is UNCHANGED
// (all-text-live); variants are a separate additive API.
// ---------------------------------------------------------------------------

import type { Dialect } from "../api.js";
import { parseTemplated, type TemplatedParseResult } from "./parse.js";
import { templateRegions, type TemplateRegion } from "./regions.js";

/** One enumerated branch alternative of a template — a coherent, lazily-parsed variant. */
export interface TemplateVariant {
	/** The one non-default arm this variant activates; undefined for variant 0 (all defaults). */
	active?: { region: TemplateRegion; armIndex: number };
	/** Parse this variant (lazy + memoized). Coordinates are ORIGINAL-document; inactive arm bodies are whitespace-blanked. */
	parse(): TemplatedParseResult;
}

/** Flatten the region tree to a source-ordered (pre-order) list — every region,
 *  nested ones included, so each contributes its own arm-coverage variants. */
function flattenRegions(regions: readonly TemplateRegion[]): TemplateRegion[] {
	const out: TemplateRegion[] = [];
	const walk = (rs: readonly TemplateRegion[]): void => {
		for (const r of rs) {
			out.push(r);
			for (const arm of r.arms) walk(arm.children);
		}
	};
	walk(regions);
	return out;
}

/**
 * Whitespace-blank the given [start, end) ranges over `text`, preserving every `\n`
 * at its original offset (the segmenter's length-/newline-preserving technique). The
 * result has identical length and newline positions, so a subsequent parse stays in
 * original document coordinates. Overlapping ranges are fine (nested-arm blanking).
 */
function blankRanges(text: string, ranges: readonly (readonly [number, number])[]): string {
	if (ranges.length === 0) return text;
	const chars = text.split(""); // UTF-16 units — indices align with span offsets
	for (const [start, end] of ranges) {
		const s = Math.max(0, start);
		const e = Math.min(chars.length, end);
		for (let k = s; k < e; k++) {
			if (chars[k] !== "\n") chars[k] = " ";
		}
	}
	return chars.join("");
}

/**
 * Realize one variant's blanked source: for each region, the active arm is arm 0
 * (default) unless this is the region being varied, in which case it is `armIndex`;
 * every OTHER arm's body span is blanked.
 */
function realize(text: string, flat: readonly TemplateRegion[], active: TemplateVariant["active"]): string {
	const ranges: [number, number][] = [];
	for (const region of flat) {
		const activeIdx = active && active.region === region ? active.armIndex : 0;
		region.arms.forEach((arm, i) => {
			if (i !== activeIdx) ranges.push([arm.bodySpan.start, arm.bodySpan.end]);
		});
	}
	return blankRanges(text, ranges);
}

/** Build a lazy, memoized variant over the shared flattened region list. */
function makeVariant(
	text: string,
	dialect: Dialect,
	flat: readonly TemplateRegion[],
	active: TemplateVariant["active"],
): TemplateVariant {
	let computed = false;
	let cached: TemplatedParseResult;
	return {
		active,
		parse(): TemplatedParseResult {
			if (!computed) {
				cached = parseTemplated(realize(text, flat, active), dialect);
				computed = true;
			}
			return cached;
		},
	};
}

/**
 * Enumerate the arm-coverage branch variants of a dbt template (see file header).
 * Linear in total arm count; each variant is a coherent, lazily-parsed alternative.
 * Total — never throws on any input.
 */
export function templateVariants(text: string, dialect: Dialect): TemplateVariant[] {
	// Enumerate over the ORIGINAL text's control-flow regions (original coordinates —
	// the bodySpans we blank). templateRegions needs the tag nodes; reuse the total
	// parseTemplated to derive them (its result is discarded — variant 0 re-parses its
	// own blank so the all-defaults arms are honoured too).
	let regions: TemplateRegion[];
	try {
		regions = templateRegions(parseTemplated(text, dialect).tags, text);
	} catch {
		regions = [];
	}
	const flat = flattenRegions(regions);

	const variants: TemplateVariant[] = [makeVariant(text, dialect, flat, undefined)];
	for (const region of flat) {
		for (let armIndex = 1; armIndex < region.arms.length; armIndex++) {
			variants.push(makeVariant(text, dialect, flat, { region, armIndex }));
		}
	}
	return variants;
}
