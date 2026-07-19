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
	/** doc offset, exclusive — includes the trailing separator (`;` / GO line). */
	end: number;
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

/** Every offset in `text` where a top-level separator ends (exclusive), in ascending order. */
function findSplitEnds(text: string, tokens: Token[], dialect: Dialect): number[] {
	const channel0 = tokens.filter((t) => t.channel === 0);
	const ends: number[] = [];
	let depth = 0;

	for (let i = 0; i < channel0.length; i++) {
		const t = channel0[i];
		const upper = t.text.toUpperCase();

		if (upper === "BEGIN") {
			// `BEGIN TRAN`/`TRANSACTION`/`DISTRIBUTED` (T-SQL) starts a transaction, not a
			// scripting compound — it has no matching END, so it must not open a depth level.
			const next = channel0[i + 1];
			if (!next || !TRAN_WORDS.has(next.text.toUpperCase())) depth++;
		} else if (upper === "CASE") {
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
		} else if (t.text === ";") {
			if (depth === 0) ends.push(t.stop + 1);
		} else if (dialect === "tsql" && upper === "GO" && depth === 0) {
			// A GO batch separator must sit alone on its line among channel-0 tokens —
			// otherwise it's an identifier/alias use of the word `GO`, not a separator.
			const prev = channel0[i - 1];
			const next = channel0[i + 1];
			const alone = (!prev || prev.line !== t.line) && (!next || next.line !== t.line);
			if (alone) {
				const nl = text.indexOf("\n", t.stop + 1);
				ends.push(nl === -1 ? text.length : nl + 1);
			}
		}
	}
	return ends;
}

/** Turn ascending split-end offsets into contiguous cells tiling `[0, text.length)`. A doc
 *  with no separators is one cell; trailing text after the last separator is its own cell —
 *  but when the last separator already reaches `length` there is no trailing cell to add. */
function buildCells(splitEnds: number[], length: number): StatementCellSpan[] {
	const spans: StatementCellSpan[] = [];
	let start = 0;
	for (const end of splitEnds) {
		spans.push({ start, end });
		start = end;
	}
	if (start < length || spans.length === 0) spans.push({ start, end: length });
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
 * separator alone on its line. Returns the whole doc as one cell when
 * splitting is unsafe (the tiling invariant fails) or pointless (no separators).
 */
export function splitStatements(text: string, dialect: Dialect): StatementCellSpan[] {
	try {
		const tokens = tokenize(text, dialect);
		const splitEnds = findSplitEnds(text, tokens, dialect);
		const spans = buildCells(splitEnds, text.length);
		return tiles(spans, text.length) ? spans : wholeDoc(text);
	} catch (e) {
		debugRethrow(e);
		return wholeDoc(text);
	}
}
