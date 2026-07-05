// ---------------------------------------------------------------------------
// Task 2 — the document-level segmenter + placeholder substitution
// (docs/minijinja-front-end.md §mechanism steps 1-2). Pure TS text scanning at the
// DOCUMENT level: it scans raw jinja-SQL over the OUTER jinja language, finds
// where tags start/end, and builds the length- and newline-preserving
// placeholder string the untouched per-dialect SQL lexer will see.
//
// The load-bearing invariant: every placeholder occupies the EXACT [start,end)
// char range of the tag it replaces AND preserves every `\n` at its original
// offset, so antlr start/stop/line/column for SQL tokens stay in original
// document coordinates with no remap (global-constraints §length + newline).
//
// Jinja is the OUTER language: a `{{ }}` inside what LOOKS like a SQL string is
// a real jinja tag (dbt renders into SQL strings). The scan respects only
// JINJA's own nesting — string literals inside a tag's expression, `{% raw %}`
// literal blocks, and `{# #}` comments — never SQL string/comment boundaries.
//
// Total: unterminated tag/string is treated to EOF as that tag; never throws.
// ---------------------------------------------------------------------------

import type { ExpansionShape } from "../qualify/template-catalog.js";

export type Segment =
	| { kind: "sql"; start: number; end: number }
	| {
			kind: "tag";
			tagKind: "expr" | "stmt" | "comment";
			start: number;
			end: number;
			text: string;
	  };

/**
 * A synchronous, by-name syntactic-slot lookup for a MACRO call (inc3.2). The catalog's
 * `expansionShape` bound into a bare callback, so `segment` stays decoupled from the catalog type — it
 * only knows the shape vocabulary, never the `TemplateCatalog` interface. `undefined` = no shape known
 * (fall back to the positional fill). Only macro-call expr tags consult it (ref/source/var/no-output
 * builtins keep their existing fill — they already parse).
 */
export type ShapeOf = (call: { name: string; parts?: string[] }) => ExpansionShape | undefined;

export interface SegmentResult {
	/** Source order, tiling (contiguous, cover [0, text.length)). */
	segments: Segment[];
	/** Same length + same newline positions as the input. */
	placeholder: string;
}

// ---------------------------------------------------------------------------
// The dbt builtins that emit NO SQL text. An expr tag topped by one of these
// (`{{ config(...) }}`, `{{ exceptions.raise_compiler_error(...) }}`, …) fills
// with newline-preserving whitespace, not an identifier — an identifier at
// statement position is a syntax error and config-topped models are the
// majority (spec §the hole — anvil-flagged, 2026-07-04). Exported as the single
// source of truth; Task 4's R2 classifier reuses this same set.
// ---------------------------------------------------------------------------
export const NO_OUTPUT_BUILTINS: ReadonlySet<string> = new Set([
	"config",
	"docs",
	"print",
	"log",
	"return",
	"exceptions",
]);

/** Opening delimiter → interior kind + matching close. Order-independent. */
const OPENERS = {
	"{{": { tagKind: "expr" as const, close: "}}", hasStrings: true },
	"{%": { tagKind: "stmt" as const, close: "%}", hasStrings: true },
	"{#": { tagKind: "comment" as const, close: "#}", hasStrings: false },
};

/** Detect an opening delimiter at `i` (`{{` / `{%` / `{#`). */
function openerAt(text: string, i: number): (typeof OPENERS)[keyof typeof OPENERS] | undefined {
	if (text.charCodeAt(i) !== 0x7b /* { */) return undefined;
	const two = text.slice(i, i + 2);
	return (OPENERS as Record<string, (typeof OPENERS)[keyof typeof OPENERS]>)[two];
}

/**
 * Skip a string literal starting at the opening quote `i`. Respects backslash
 * escapes (minijinja `\'`). Returns the index PAST the closing quote, or the
 * text length if the string is unterminated (total).
 */
function skipString(text: string, i: number): number {
	const quote = text[i];
	i += 1;
	const len = text.length;
	while (i < len) {
		const c = text[i];
		if (c === "\\") {
			i += 2;
			continue;
		}
		if (c === quote) return i + 1;
		i += 1;
	}
	return len;
}

/**
 * Find the matching close for a tag opened at `start`. Scans the interior; for
 * string-bearing tags (`{{ }}` / `{% %}`) a `}}`/`%}` inside a `'...'`/`"..."`
 * string does NOT close (the outer-language rule). Returns the exclusive end
 * offset (past the close delimiter), or the text length if unterminated.
 */
function findClose(text: string, start: number, close: string, hasStrings: boolean): number {
	const len = text.length;
	let i = start + 2; // past the two-char opener
	while (i < len) {
		if (hasStrings) {
			const c = text[i];
			if (c === "'" || c === '"') {
				i = skipString(text, i);
				continue;
			}
		}
		if (text.startsWith(close, i)) return i + close.length;
		i += 1;
	}
	return len;
}

/**
 * The leading word of a tag: strip the two-char opener + optional whitespace-
 * control `-`, skip whitespace, read the first identifier. For an expr tag it is
 * the leading call name (`config`, `ref`, `dbt_utils` in `dbt_utils.star(…)`);
 * for a stmt tag it is the keyword (`raw`, `if`, `for`, …). "" when none.
 */
function leadingWord(tagText: string): string {
	let i = 2; // past `{{` / `{%` / `{#`
	if (tagText[i] === "-") i += 1;
	while (i < tagText.length && /\s/.test(tagText[i])) i += 1;
	let word = "";
	while (i < tagText.length && /[A-Za-z0-9_]/.test(tagText[i])) {
		word += tagText[i];
		i += 1;
	}
	return word;
}

/**
 * Find the start offset of the `{% endraw %}` tag that closes a raw block whose
 * literal region begins at `from`. Only `{% endraw %}` (with any whitespace-
 * control / spacing) closes raw; all other `{% %}`-looking content is literal.
 * Returns the text length when there is no endraw (broken input → raw to EOF).
 */
function findEndraw(text: string, from: number): number {
	const len = text.length;
	let i = from;
	while (i < len) {
		if (text.charCodeAt(i) === 0x7b /* { */ && text[i + 1] === "%") {
			const close = findClose(text, i, "%}", true);
			if (leadingWord(text.slice(i, close)) === "endraw") return i;
			i = close; // a non-endraw stmt inside raw is literal; skip past it
			continue;
		}
		i += 1;
	}
	return len;
}

/** The fill character for a tag segment, or " " for a no-output/whitespace tag. */
function fillChar(seg: Extract<Segment, { kind: "tag" }>): string {
	if (seg.tagKind !== "expr") return " "; // stmt / comment → whitespace to SQL
	// expr: no-output builtin → whitespace; otherwise an identifier token.
	return NO_OUTPUT_BUILTINS.has(leadingWord(seg.text)) ? " " : "j";
}

// ---------------------------------------------------------------------------
// inc3.2 — shaped placeholders. When a catalog answers `expansionShape` for a
// macro-call tag, the single-char identifier fill (`"j"`) generalizes to a
// length-matched, shape-VALID fragment placed at the tag start, padded with
// spaces, newlines preserved — so an unknown callable at statement/CTE/predicate
// position parses instead of failing. Everything here is a no-op without a
// `shapeOf` (the zero-catalog keystone: byte-identical to the char fill above).
// ---------------------------------------------------------------------------

/** Shape → the minimal shape-valid SQL fragment. `SELECT 1` is valid across all eight dialects both as a
 *  standalone statement AND as a `(…)` CTE/subquery body (verified), so `statement`/`relation` share it;
 *  `expr` is absent — it keeps the identifier fill (handled before this table is consulted). */
const SHAPE_FRAGMENT: Record<Exclude<ExpansionShape, "expr">, string> = {
	statement: "SELECT 1",
	relation: "SELECT 1",
	predicate: "1=1",
	"column-list": "1",
};

/** dbt builtins that already parse with the identifier fill and must NOT be shaped — a buggy catalog
 *  returning a shape for `ref` must never break `from {{ ref('x') }}` (spec §only macro-call tags). The
 *  no-output builtins are already excluded via `fillChar`'s whitespace path; this set covers the
 *  value/relation builtins that get the identifier fill today. */
const SHAPE_EXCLUDED: ReadonlySet<string> = new Set(["ref", "source", "var", "env_var"]);

/**
 * The leading CALL of an expr tag: the dotted callee path + whether a `(` follows.
 * `macro_a(` → { name: "macro_a", isCall: true }; `dbt_utils.star(` →
 * { name: "star", parts: ["dbt_utils", "star"], isCall: true }; a bare non-call
 * expr (`{{ x }}`, `{{ a + b }}`) → isCall false. undefined when no identifier leads.
 */
function leadingCall(tagText: string): { name: string; parts?: string[]; isCall: boolean } | undefined {
	let i = 2; // past `{{`
	if (tagText[i] === "-") i += 1;
	const skipWs = (): void => {
		while (i < tagText.length && /\s/.test(tagText[i])) i += 1;
	};
	skipWs();
	const parts: string[] = [];
	for (;;) {
		let word = "";
		while (i < tagText.length && /[A-Za-z0-9_]/.test(tagText[i])) {
			word += tagText[i];
			i += 1;
		}
		if (word === "") break;
		parts.push(word);
		skipWs();
		if (tagText[i] === ".") {
			i += 1;
			skipWs();
			continue; // read the next path segment (`pkg . macro`)
		}
		break;
	}
	if (parts.length === 0) return undefined;
	skipWs();
	const isCall = tagText[i] === "(";
	const name = parts[parts.length - 1];
	return { name, ...(parts.length > 1 ? { parts } : {}), isCall };
}

/**
 * The shaped fill fragment for a tag, or undefined to fall back to the positional
 * char fill. Returns a fragment ONLY for a macro-call expr tag whose `shapeOf`
 * answers a non-`expr` shape AND for which the fragment FITS: it must be no longer
 * than the tag and must contain no `\n` in its placement window (the fit guard —
 * the shaped fill is strictly an improvement, never a regression on a tag it can't
 * shape). The caller places the fragment at the tag start and pads the rest with
 * spaces, preserving every original `\n`.
 */
function shapedFill(seg: Extract<Segment, { kind: "tag" }>, shapeOf: ShapeOf): string | undefined {
	if (seg.tagKind !== "expr") return undefined;
	const lead = leadingWord(seg.text);
	if (NO_OUTPUT_BUILTINS.has(lead) || SHAPE_EXCLUDED.has(lead)) return undefined;
	const call = leadingCall(seg.text);
	if (!call || !call.isCall) return undefined; // only a real macro CALL is shaped
	const shape = shapeOf({ name: call.name, ...(call.parts ? { parts: call.parts } : {}) });
	if (!shape || shape === "expr") return undefined; // expr / unknown → identifier fill (today's default)
	const fragment = SHAPE_FRAGMENT[shape];
	// Fit guard: the fragment must fit within the tag AND before its first `\n`. seg.text[k] is the
	// document char at seg.start + k, so a `\n` at any k < fragment.length would land inside the fragment.
	if (fragment.length > seg.end - seg.start) return undefined;
	for (let k = 0; k < fragment.length; k++) {
		if (seg.text[k] === "\n") return undefined;
	}
	return fragment;
}

/**
 * Segment raw jinja-SQL over the outer jinja language and build the length- and
 * newline-preserving placeholder. Total: never throws on any input.
 *
 * `shapeOf` (inc3.2, optional) supplies a syntactic slot per macro-call tag; when
 * given, a shape-valid fragment (`SELECT 1`, …) replaces the identifier fill for
 * the tags it fits (fit-guarded, newline-safe). With no `shapeOf` — or when it
 * returns undefined / a tag doesn't fit — the placeholder is BYTE-IDENTICAL to the
 * positional char fill (the zero-catalog keystone).
 */
export function segment(text: string, shapeOf?: ShapeOf): SegmentResult {
	const len = text.length;
	const segments: Segment[] = [];
	let i = 0;
	let sqlStart = 0;

	const pushSql = (start: number, end: number): void => {
		if (end > start) segments.push({ kind: "sql", start, end });
	};

	while (i < len) {
		const opener = openerAt(text, i);
		if (!opener) {
			i += 1;
			continue;
		}

		pushSql(sqlStart, i);
		const end = findClose(text, i, opener.close, opener.hasStrings);
		const tagText = text.slice(i, end);
		segments.push({ kind: "tag", tagKind: opener.tagKind, start: i, end, text: tagText });

		if (opener.tagKind === "stmt" && leadingWord(tagText) === "raw") {
			// The region up to `{% endraw %}` is ONE literal sql segment — its
			// `{{ }}`-looking content is NOT segmented. Missing endraw → to EOF.
			const rawStart = end;
			const endrawStart = findEndraw(text, rawStart);
			pushSql(rawStart, endrawStart);
			if (endrawStart < len) {
				const endrawEnd = findClose(text, endrawStart, "%}", true);
				segments.push({
					kind: "tag",
					tagKind: "stmt",
					start: endrawStart,
					end: endrawEnd,
					text: text.slice(endrawStart, endrawEnd),
				});
				i = endrawEnd;
			} else {
				i = len;
			}
		} else {
			i = end;
		}
		sqlStart = i;
	}
	pushSql(sqlStart, len);

	// Build the placeholder: copy the input, overwrite each tag range with its
	// fill, preserving `\n` at its original offset (antlr line/column anchor).
	const chars = text.split(""); // UTF-16 units — indices align with tag offsets
	for (const seg of segments) {
		if (seg.kind !== "tag") continue;
		const shaped = shapeOf ? shapedFill(seg, shapeOf) : undefined;
		if (shaped !== undefined) {
			// Shaped fill: fragment at the tag start, spaces for the rest, `\n` preserved. The fit guard
			// guaranteed no `\n` sits inside [start, start+fragment.length), so the fragment lands intact.
			for (let k = seg.start; k < seg.end; k++) {
				if (chars[k] === "\n") continue;
				const rel = k - seg.start;
				chars[k] = rel < shaped.length ? shaped[rel] : " ";
			}
		} else {
			// Positional char fill. The identifier fill (`"j"`) is placed on the tag's
			// FIRST line only; every continuation line fills with spaces. A multi-line
			// tag otherwise becomes a `j`-run PER LINE (the preserved `\n`s split it),
			// which the SQL lexer reads as SEVERAL adjacent identifiers — a parse error
			// (`select jjjj jjjjjj … as x`). First-line-only yields ONE identifier
			// followed by whitespace. The whitespace fill (`" "`) is unaffected (spaces
			// before AND after a newline are identical); length + newline offsets hold.
			const fill = fillChar(seg);
			let seenNewline = false;
			for (let k = seg.start; k < seg.end; k++) {
				if (chars[k] === "\n") {
					seenNewline = true;
					continue;
				}
				chars[k] = seenNewline ? " " : fill;
			}
		}
	}

	return { segments, placeholder: chars.join("") };
}
