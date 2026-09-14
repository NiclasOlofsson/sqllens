// ---------------------------------------------------------------------------
// splitStatements() — the token-level statement splitter.
//
// Stage B of the editor-gold wave needs statement-scoped incremental
// SqlDocuments (Task 5): split a whole file into per-statement cells so an
// edit inside one statement only re-parses that cell. This is the splitter
// those cells come from. It works over the existing total `tokenize()`
// (src/token/tokenize.ts) — walking tokens rather than characters makes
// separators inside string/comment tokens unable to split, for free.
//
// The safety valve is the tiling invariant: the returned spans must exactly
// tile `text` (contiguous, start 0, end text.length). If the compound-depth
// heuristic below ever produces something that fails to tile — or tokenize
// itself misbehaves for a bad/unknown dialect — this falls back to a single
// whole-doc cell, i.e. today's behavior. That fallback bounds all damage from
// an imperfect heuristic; it is not a rare-path afterthought.
// ---------------------------------------------------------------------------

import { debugRethrow } from "../debug.js";
import type { Dialect } from "../dialect.js";
import { tokenize } from "../token/tokenize.js";
import type { Token } from "../token/token.js";

export interface StatementCellSpan {
	/** doc offset, inclusive — cell text includes leading trivia. */
	start: number;
	/** doc offset, exclusive — includes the trailing separator (`;` / GO line); the document's last
	 *  cell also includes whatever trivia follows its separator, up to `text.length`. */
	end: number;
	/** The separator token that terminates this cell, as doc offsets (`start` inclusive, `end`
	 *  exclusive): the `;`, or the `GO` word itself (not its line). Absent when the cell has no
	 *  separator (an unterminated final statement, a separator-free document, the whole-document
	 *  fallback). The statement's own text ends where this starts, before any trailing trivia. */
	separator?: { start: number; end: number };
}

/** One split point: the cell end it produces plus the separator token behind it. */
interface SplitEnd {
	end: number;
	separator: { start: number; end: number };
}

const TRAN_WORDS = new Set(["TRAN", "TRANSACTION", "DISTRIBUTED"]);

// Scripting closers whose OPENER never incremented depth (Databricks/Spark scripting:
// `IF … END IF`, `WHILE … END WHILE`, `FOR/LOOP/REPEAT` likewise). Only BEGIN and CASE
// increment, so an END followed by one of these must not decrement.
const NON_OPENER_END_SUFFIXES = new Set(["IF", "WHILE", "FOR", "LOOP", "REPEAT"]);

/** The single-cell fallback: exactly today's behavior (whole doc, one cell). */
function wholeDoc(text: string): StatementCellSpan[] {
	return [{ start: 0, end: text.length }];
}

/** The split point a `;` or a T-SQL `GO` at `channel0[i]` makes, ignoring depth, or undefined when
 *  the token is neither. A GO batch separator must sit alone on its line among channel-0 tokens
 *  (otherwise it is an identifier/alias use of the word); its cell end is the end of that line. */
function separatorAt(text: string, channel0: Token[], i: number, dialect: Dialect): SplitEnd | undefined {
	const t = channel0[i];
	const separator = { start: t.start, end: t.stop + 1 };
	if (t.text === ";") return { end: t.stop + 1, separator };
	if (dialect === "tsql" && t.text.toUpperCase() === "GO") {
		const prev = channel0[i - 1];
		const next = channel0[i + 1];
		const alone = (!prev || prev.line !== t.line) && (!next || next.line !== t.line);
		if (!alone) return undefined;
		const nl = text.indexOf("\n", t.stop + 1);
		return { end: nl === -1 ? text.length : nl + 1, separator };
	}
	return undefined;
}

/** Every top-level split point in `text`, in ascending order, plus `tail`: the separator of a
 *  terminated final statement that nothing real follows (only whitespace, comments, the final
 *  newline). That separator is not a split end, the trivia after it belongs to the cell it
 *  terminates, so a single terminated statement is one cell rather than a statement plus a
 *  token-less tail cell; `tail` lets that cell still carry its separator.
 *
 *  Depth: `BEGIN`/`CASE` open a level, `END` closes one, and only a separator at depth 0 splits.
 *  When the text ends INSIDE an open level (an unclosed CASE mid-typing, jinja arms that leave
 *  the placeholder with more openers than closers), the walk cannot know where that block ends,
 *  and one cell silently spanning several statements is the worse failure (a "run statement at
 *  cursor" would run them all): the split points before the outermost unclosed opener stand, and
 *  from that opener on every separator splits regardless of depth. Balanced text is unaffected. */
function findSplitEnds(
	text: string,
	tokens: Token[],
	dialect: Dialect,
): { ends: SplitEnd[]; tail?: SplitEnd["separator"] } {
	const channel0 = tokens.filter((t) => t.channel === 0);
	let ends: SplitEnd[] = [];
	let depth = 0;
	/** The outermost currently-open level: where it opened and how many split points preceded it. */
	let opener: { index: number; endsBefore: number } | undefined;

	for (let i = 0; i < channel0.length; i++) {
		const t = channel0[i];
		const upper = t.text.toUpperCase();

		if (upper === "BEGIN") {
			// `BEGIN TRAN`/`TRANSACTION`/`DISTRIBUTED` (T-SQL) starts a transaction, not a
			// scripting compound — it has no matching END, so it must not open a depth level.
			const next = channel0[i + 1];
			if (!next || !TRAN_WORDS.has(next.text.toUpperCase())) {
				if (depth === 0) opener = { index: i, endsBefore: ends.length };
				depth++;
			}
		} else if (upper === "CASE") {
			if (depth === 0) opener = { index: i, endsBefore: ends.length };
			depth++;
		} else if (upper === "END") {
			// Channel-0 lookahead (same mechanism as the BEGIN TRAN exception above):
			// - `END IF/WHILE/FOR/LOOP/REPEAT` closes a construct whose opener never
			//   incremented depth, so this END must not decrement.
			// - `END CASE` closes the CASE statement: decrement, and CONSUME the trailing
			//   CASE keyword so it can't re-increment as a fresh opener.
			const next = channel0[i + 1];
			const nextUpper = next?.text.toUpperCase();
			if (nextUpper !== undefined && NON_OPENER_END_SUFFIXES.has(nextUpper)) {
				// no depth change; the suffix keyword is harmless to leave (IF/WHILE/… never
				// increment), so no consume is needed.
			} else if (nextUpper === "CASE") {
				depth = Math.max(0, depth - 1);
				i++; // consume the CASE of `END CASE`
			} else {
				depth = Math.max(0, depth - 1);
			}
			if (depth === 0) opener = undefined;
		} else if (depth === 0) {
			const sep = separatorAt(text, channel0, i, dialect);
			if (sep) ends.push(sep);
		}
	}
	if (depth > 0 && opener) {
		// Unclosed level: keep the split points before it, then split at every separator from it on.
		ends = ends.slice(0, opener.endsBefore);
		for (let i = opener.index; i < channel0.length; i++) {
			const sep = separatorAt(text, channel0, i, dialect);
			if (sep) ends.push(sep);
		}
	}
	// Tokens are in source order, so the last channel-0 token decides whether anything real follows
	// the last separator.
	const lastReal = channel0[channel0.length - 1];
	const last = ends[ends.length - 1];
	if (last && (lastReal === undefined || lastReal.start < last.end)) {
		ends.pop();
		return { ends, tail: last.separator };
	}
	return { ends };
}

/** Turn ascending split points into contiguous cells tiling `[0, text.length)`. A doc with no
 *  split points is one cell; text after the last split point is the final cell, carrying `tail`
 *  (its own separator, when it is a terminated statement whose trailing trivia was folded in). */
function buildCells(
	splitEnds: SplitEnd[],
	tail: SplitEnd["separator"] | undefined,
	length: number,
): StatementCellSpan[] {
	const spans: StatementCellSpan[] = [];
	let start = 0;
	for (const e of splitEnds) {
		spans.push({ start, end: e.end, separator: e.separator });
		start = e.end;
	}
	if (start < length || spans.length === 0)
		spans.push(tail ? { start, end: length, separator: tail } : { start, end: length });
	return spans;
}

/** The tiling invariant: contiguous, starts at 0, ends at `length`, in order. */
function tiles(spans: StatementCellSpan[], length: number): boolean {
	if (spans.length === 0) return false;
	if (spans[0].start !== 0) return false;
	for (let i = 0; i < spans.length; i++) {
		if (spans[i].end < spans[i].start) return false;
		if (i + 1 < spans.length && spans[i].end !== spans[i + 1].start) return false;
	}
	return spans[spans.length - 1].end === length;
}

/**
 * Split `text` into top-level statement cells using `tokenize(text, dialect)`.
 * Total: never throws. Splits at channel-0 `;` at compound depth 0 (BEGIN/CASE
 * increment, END decrements, floor 0; a T-SQL `BEGIN TRAN`/`TRANSACTION`/
 * `DISTRIBUTED` does not open a depth level) plus, for T-SQL, a `GO` batch
 * separator alone on its line; text ending inside an open level splits at every
 * separator from the unclosed opener on (see `findSplitEnds`). Each cell carries
 * the separator token that ends it. Returns the whole doc as one cell when
 * splitting is unsafe (the tiling invariant fails) or pointless (no separators).
 */
export function splitStatements(text: string, dialect: Dialect): StatementCellSpan[] {
	try {
		const tokens = tokenize(text, dialect);
		const { ends, tail } = findSplitEnds(text, tokens, dialect);
		const spans = buildCells(ends, tail, text.length);
		return tiles(spans, text.length) ? spans : wholeDoc(text);
	} catch (e) {
		debugRethrow(e);
		return wholeDoc(text);
	}
}
