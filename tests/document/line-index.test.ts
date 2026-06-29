import { describe, expect, it } from "vitest";
import { LineIndex } from "../../src/document/line-index.js";

// Lines of "ab\ncde\n\nf": "ab"@0, "cde"@3, ""@7, "f"@8.
describe("LineIndex", () => {
	const li = new LineIndex("ab\ncde\n\nf");

	it("offsetAt maps 0-based line/column to char offset", () => {
		expect(li.offsetAt(0, 1)).toBe(1);
		expect(li.offsetAt(1, 2)).toBe(5);
		expect(li.offsetAt(3, 0)).toBe(8);
	});

	it("counts every line including the empty and final-no-newline line", () => {
		expect(li.lineCount).toBe(4);
	});

	it("positionAt maps a char offset to { line, column }", () => {
		expect(li.positionAt(5)).toEqual({ line: 1, column: 2 });
		expect(li.positionAt(0)).toEqual({ line: 0, column: 0 });
		expect(li.positionAt(7)).toEqual({ line: 2, column: 0 }); // the empty line
		expect(li.positionAt(9)).toEqual({ line: 3, column: 1 }); // end
	});

	it("round-trips offset -> position -> offset", () => {
		for (const o of [0, 1, 2, 3, 5, 6, 7, 8, 9]) {
			const p = li.positionAt(o);
			expect(li.offsetAt(p.line, p.column)).toBe(o);
		}
	});

	it("treats CRLF \\r as part of the preceding line", () => {
		const crlf = new LineIndex("ab\r\ncd");
		expect(crlf.lineCount).toBe(2);
		// "ab\r" is line 0 (3 chars), "cd" starts at offset 4.
		expect(crlf.offsetAt(1, 0)).toBe(4);
		expect(crlf.positionAt(2)).toEqual({ line: 0, column: 2 }); // the \r
		expect(crlf.positionAt(4)).toEqual({ line: 1, column: 0 });
	});

	it("handles the empty document", () => {
		const empty = new LineIndex("");
		expect(empty.lineCount).toBe(1);
		expect(empty.positionAt(0)).toEqual({ line: 0, column: 0 });
		expect(empty.offsetAt(0, 0)).toBe(0);
	});

	it("clamps an out-of-range offset to the end without throwing", () => {
		expect(li.positionAt(1000)).toEqual({ line: 3, column: 1 });
		expect(li.positionAt(-5)).toEqual({ line: 0, column: 0 });
	});

	it("clamps an out-of-range line in offsetAt to the last line", () => {
		expect(li.offsetAt(99, 0)).toBe(8); // last line ("f") starts at 8
		expect(li.offsetAt(-3, 0)).toBe(0);
	});
});
