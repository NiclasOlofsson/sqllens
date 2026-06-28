import { describe, it, expect } from "vitest";
import {
  rangeFromCst,
  rangeFromSpan,
  rangeFromSyntaxDiagnostic,
  positionToOffset,
} from "../src/lsp/ranges.js";

const fakeToken = (line: number, column: number, text: string) => ({ line, column, text }) as any;

describe("ranges", () => {
  it("rangeFromCst: single token — end is column + text.length, line 1→0", () => {
    const cst = { start: fakeToken(1, 7, "amount"), stop: fakeToken(1, 7, "amount") } as any;
    expect(rangeFromCst(cst)).toEqual({
      start: { line: 0, character: 7 },
      end: { line: 0, character: 13 }, // 7 + "amount".length (6)
    });
  });

  it("rangeFromCst: multi-token span — end uses the STOP token, not start", () => {
    const cst = { start: fakeToken(1, 7, "amount"), stop: fakeToken(1, 20, "x") } as any;
    expect(rangeFromCst(cst)).toEqual({
      start: { line: 0, character: 7 },
      end: { line: 0, character: 21 }, // 20 + "x".length (1)
    });
  });

  it("rangeFromCst: multi-line STOP token — end advances line and uses chars after the last newline", () => {
    // A single string-literal token `'x\ny\nz'` starting at line 1, col 7 (7 chars total, 2 newlines).
    const cst = { start: fakeToken(1, 7, "'x\ny\nz'"), stop: fakeToken(1, 7, "'x\ny\nz'") } as any;
    expect(rangeFromCst(cst)).toEqual({
      start: { line: 0, character: 7 },
      end: { line: 2, character: 2 }, // start line 1 + 2 newlines → 0-based line 2; "z'" after last \n → col 2
    });
  });

  it("rangeFromCst: missing start token → zero range (never throws)", () => {
    const cst = { start: undefined, stop: undefined } as any;
    expect(rangeFromCst(cst)).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    });
  });

  it("rangeFromSpan converts 1-based antlr line to 0-based LSP line, keeps 0-based column", () => {
    // Span: line/column are 1-based line, 0-based column; endColumn already past the last char.
    const r = rangeFromSpan({ line: 1, column: 7, endLine: 1, endColumn: 11 });
    expect(r.start).toEqual({ line: 0, character: 7 });
    expect(r.end).toEqual({ line: 0, character: 11 });
  });

  it("rangeFromSyntaxDiagnostic spans `length` chars from the column on a 0-based line", () => {
    const r = rangeFromSyntaxDiagnostic({ message: "x", line: 2, column: 3, offset: 20, length: 5 });
    expect(r.start).toEqual({ line: 1, character: 3 });
    expect(r.end).toEqual({ line: 1, character: 8 });
  });

  it("positionToOffset maps an LSP position to a 0-based char offset", () => {
    const text = "SELECT a\nFROM t";
    expect(positionToOffset(text, { line: 0, character: 7 })).toBe(7); // the 'a'
    expect(positionToOffset(text, { line: 1, character: 0 })).toBe(9); // start of 'FROM'
  });
});
