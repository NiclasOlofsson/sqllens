// ---------------------------------------------------------------------------
// Task 4 — variant expansion (docs/minijinja-front-end.md §Variant realization).
//
// `templateVariants(text, dialect)` enumerates the `{% if %}/{% elif %}/{% else %}`
// branch variants of a dbt template as coherent, lazily-parsed alternatives, so the
// editor can give feedback on EVERY arm regardless of which one runs at render time.
//
// ARM-COVERAGE, NOT cross-product (the decided shape):
//   - Variant 0 = every region's arm 0 active (all-defaults).
//   - Then ONE variant per (region, armIndex>0): that variant activates that one
//     non-default arm plus its ANCESTOR path (below); every non-ancestor region takes
//     arm 0.
// LINEAR in total arm count — 1 + Σ over regions of (arms−1) — never combinatorial.
// A `{% for %}`/`{% macro %}` region is single-arm (its default IS the representative
// single iteration / the body parses in place), so it contributes NO extra variant.
//
// SYNTHETIC EMPTY-ELSE ARM (Stage-5 Task 1, acceptance brief A8b): an `{% if %}` region
// whose LAST arm is `if`/`elif` (no `else`) has no branch for "condition false" — its
// body would otherwise be live in EVERY variant, so "optional absent" was never a
// coverage point. Such a region gets ONE additional synthetic variant, with the WHOLE
// region blanked (every arm's body, none active). Count law: 1 + Σ(arms−1) +
// #(else-less if-regions) — still linear. Ancestor-path activation (below) still pins
// this region's ancestors to the arm that contains it, so a nested else-less region's
// synthetic variant realizes in a realistic surrounding branch. Blanking the WHOLE
// region's body also blanks any descendant regions nested inside it for free (their
// text is a subset of the blanked span), so a synthetic blank never leaves an orphaned
// live fragment.
//
// ANCESTOR-PATH ACTIVATION (the coverage guarantee): a variant for (region R, arm k)
// activates arm k of R AND, for every ANCESTOR region on R's path to root, the arm that
// CONTAINS R (not arm 0); all NON-ancestor regions take arm 0. So varying an inner else
// nested inside an outer else pins the outer region to its else arm (the one containing
// the inner region) → the outer else is live, the inner arm is live, and every arm —
// including one nested inside a NON-default arm — is live in EXACTLY one variant. This
// keeps each variant ONE coherent root-to-leaf branch selection and does NOT change the
// count (it changes WHICH arms activate inside an already-enumerated variant): when R
// sits in its parent's arm 0 the pinned ancestor arm IS arm 0, identical to no pinning.
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

import { debugRethrow } from "../debug.js";
import type { Dialect } from "../dialect.js";
import { parseTemplated, type TemplatedParseResult } from "./parse.js";
import { templateRegions, type TemplateRegion } from "./regions.js";

/** One enumerated branch alternative of a template — a coherent, lazily-parsed variant. */
export interface TemplateVariant {
	/**
	 * The one non-default arm this variant activates; undefined for variant 0 (all
	 * defaults). `syntheticEmpty`: the region's body is wholly absent in this
	 * realization (the synthetic empty-else arm — see file header); `armIndex` is 0 as
	 * a type-stable placeholder — the discriminator is `syntheticEmpty`, never the
	 * index. (0 collides with nothing: real non-default arms start at 1, and keeping
	 * `armIndex` REQUIRED keeps the anvil channel contract additive.)
	 */
	active?: { region: TemplateRegion; armIndex: number; syntheticEmpty?: true };
	/**
	 * This variant's realized source: the ORIGINAL text with every inactive arm's body
	 * whitespace-blanked (identical length, newlines at identical offsets). Lazy + memoized
	 * separately from `parse()` — calling `text()` alone never forces a parse.
	 */
	text(): string;
	/** Parse this variant (lazy + memoized). Coordinates are ORIGINAL-document; inactive arm bodies are whitespace-blanked. */
	parse(): TemplatedParseResult;
}

/** One ancestor hop on a region's path to root: which arm of `region` contains the descendant. */
interface Ancestor {
	region: TemplateRegion;
	armIndex: number;
}

/** A flattened region plus its ancestor path (root-to-parent) — the arm of each ancestor
 *  that CONTAINS this region, so a variant can pin the whole containing branch. */
interface RegionEntry {
	region: TemplateRegion;
	ancestors: Ancestor[];
}

/** Flatten the region tree to a source-ordered (pre-order) list — every region, nested
 *  ones included — each tagged with its ancestor path (which parent arm it sits in). */
function flattenRegions(regions: readonly TemplateRegion[]): RegionEntry[] {
	const out: RegionEntry[] = [];
	const walk = (rs: readonly TemplateRegion[], ancestors: Ancestor[]): void => {
		for (const r of rs) {
			out.push({ region: r, ancestors });
			r.arms.forEach((arm, i) => walk(arm.children, [...ancestors, { region: r, armIndex: i }]));
		}
	};
	walk(regions, []);
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
 * Realize one variant's blanked source. The active arm index per region is 0 (default)
 * EXCEPT: the varied region takes `armIndex`, and each of its ancestors takes the arm
 * that CONTAINS the varied region (ancestor-path activation — the coverage guarantee).
 * Every arm that is NOT its region's active arm has its body span blanked.
 *
 * `syntheticEmpty` (Stage-5 Task 1): the varied region itself has NO active arm — every
 * one of its arms' bodies is blanked (its ancestors are still pinned per the above, so
 * the "whole region absent" variant still realizes inside a realistic branch).
 */
function realize(
	text: string,
	flat: readonly RegionEntry[],
	varied: RegionEntry | undefined,
	armIndex: number,
	syntheticEmpty = false,
): string {
	const activeIdx = new Map<TemplateRegion, number>();
	if (varied) {
		if (!syntheticEmpty) activeIdx.set(varied.region, armIndex);
		for (const anc of varied.ancestors) activeIdx.set(anc.region, anc.armIndex);
	}
	const ranges: [number, number][] = [];
	for (const { region } of flat) {
		if (syntheticEmpty && varied && region === varied.region) {
			for (const arm of region.arms) ranges.push([arm.bodySpan.start, arm.bodySpan.end]);
			continue;
		}
		const idx = activeIdx.get(region) ?? 0;
		region.arms.forEach((arm, i) => {
			if (i !== idx) ranges.push([arm.bodySpan.start, arm.bodySpan.end]);
		});
	}
	return blankRanges(text, ranges);
}

/** Build a lazy, memoized variant over the shared flattened region list. `varied` is the
 *  region entry this variant activates (with `armIndex`); undefined for variant 0.
 *  `syntheticEmpty` (Stage-5 Task 1): `varied` is an else-less if-region blanked whole —
 *  no arm is active; `active.syntheticEmpty` is the discriminator and `active.armIndex`
 *  is 0 as a type-stable placeholder (never emitted for a real non-default arm). */
function makeVariant(
	text: string,
	dialect: Dialect,
	flat: readonly RegionEntry[],
	varied: RegionEntry | undefined,
	armIndex: number,
	syntheticEmpty = false,
): TemplateVariant {
	let realized: string | undefined;
	let cached: TemplatedParseResult | undefined;
	const textOf = (): string => (realized ??= realize(text, flat, varied, armIndex, syntheticEmpty));
	return {
		active: varied
			? syntheticEmpty
				? { region: varied.region, armIndex: 0, syntheticEmpty: true }
				: { region: varied.region, armIndex }
			: undefined,
		text: textOf,
		parse(): TemplatedParseResult {
			return (cached ??= parseTemplated(textOf(), dialect));
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
	} catch (e) {
		debugRethrow(e);
		regions = [];
	}
	const flat = flattenRegions(regions);

	const variants: TemplateVariant[] = [makeVariant(text, dialect, flat, undefined, 0)];
	for (const entry of flat) {
		for (let armIndex = 1; armIndex < entry.region.arms.length; armIndex++) {
			variants.push(makeVariant(text, dialect, flat, entry, armIndex));
		}
		// Synthetic empty-else arm (Stage-5 Task 1): an if-region whose LAST arm is
		// `if`/`elif` (no `else`) gets one extra variant with its whole body blanked —
		// "optional absent" becomes a coverage point too. Law: 1 + Σ(arms−1) +
		// #(else-less if-regions).
		const lastArm = entry.region.arms[entry.region.arms.length - 1];
		if (entry.region.kind === "if" && lastArm && lastArm.keyword !== "else") {
			variants.push(makeVariant(text, dialect, flat, entry, 0, true));
		}
	}
	return variants;
}
