// A precomputed line-offset index for O(log n) position<->offset conversion.
// Coordinates here are 0-based line / 0-based column to match the LSP boundary;
// offsets are 0-based char indices into the source text (UTF-16 code units, the
// same units the rest of the code uses for spans). The index is built once in
// the constructor and is read-only afterwards.

/** Maps between char offsets and 0-based { line, column } positions for one text. */
export class LineIndex {
	/** Char offset at which each line starts. `lineStarts[0]` is always 0. */
	private readonly lineStarts: number[];
	private readonly length: number;

	constructor(text: string) {
		this.length = text.length;
		const starts = [0];
		for (let i = 0; i < text.length; i++) {
			// Split on `\n` only; a `\r` (CRLF) stays part of the preceding line.
			if (text.charCodeAt(i) === 10) starts.push(i + 1);
		}
		this.lineStarts = starts;
	}

	/** Number of lines. A text with no trailing newline still counts its last line. */
	get lineCount(): number {
		return this.lineStarts.length;
	}

	/** 0-based line, 0-based column -> 0-based char offset. Out-of-range line clamps to [0, last]. */
	offsetAt(line: number, column: number): number {
		const l = clamp(line, 0, this.lineStarts.length - 1);
		return this.lineStarts[l] + Math.max(0, column);
	}

	/** 0-based char offset -> { line, column }. Offset is clamped into [0, text.length]. */
	positionAt(offset: number): { line: number; column: number } {
		const o = clamp(offset, 0, this.length);
		// Binary search for the greatest line start <= o.
		let lo = 0;
		let hi = this.lineStarts.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (this.lineStarts[mid] <= o) lo = mid;
			else hi = mid - 1;
		}
		return { line: lo, column: o - this.lineStarts[lo] };
	}
}

function clamp(n: number, min: number, max: number): number {
	if (n < min) return min;
	if (n > max) return max;
	return n;
}
