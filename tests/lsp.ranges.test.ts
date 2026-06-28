import { describe, it, expect } from "vitest";
import { rangeFromSpan, rangeFromSyntaxDiagnostic, positionToOffset } from "../src/lsp/ranges.js";

describe("ranges", () => {
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
