// Shared span-end math for the library passes (symbols, qualify). antlr tokens carry only their
// START line/column; when the last token's TEXT spans newlines (a multi-line string literal,
// dollar-quoted body, or block comment), the end position must advance the line and reset the
// column. This is the one place that does that math so symbols.ts and qualify.ts agree.

/**
 * End position (exclusive) of a token, given its 1-based start `line`, 0-based start `column`, and
 * `text`. For a single-line token this is the start line and `column + text.length`. For a token
 * whose text contains `\n`, the end line advances by the newline count and the end column is the
 * number of chars after the last newline.
 */
export function endPosition(line: number, column: number, text: string): { endLine: number; endColumn: number } {
	const lastNl = text.lastIndexOf("\n");
	if (lastNl === -1) return { endLine: line, endColumn: column + text.length };
	let nl = 0;
	for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) nl++;
	return { endLine: line + nl, endColumn: text.length - (lastNl + 1) };
}
