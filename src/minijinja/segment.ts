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

export type Segment =
	| { kind: "sql"; start: number; end: number }
	| {
			kind: "tag";
			tagKind: "expr" | "stmt" | "comment";
			start: number;
			end: number;
			text: string;
	  };

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

/**
 * Segment raw jinja-SQL over the outer jinja language and build the length- and
 * newline-preserving placeholder. Total: never throws on any input.
 */
export function segment(text: string): SegmentResult {
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
		const fill = fillChar(seg);
		for (let k = seg.start; k < seg.end; k++) {
			if (chars[k] !== "\n") chars[k] = fill;
		}
	}

	return { segments, placeholder: chars.join("") };
}
