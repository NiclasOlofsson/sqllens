import { CharStream, CommonTokenStream } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { DatabricksLexer } from "../src/generated/databricks/DatabricksLexer.js";
import { DatabricksParser } from "../src/generated/databricks/DatabricksParser.js";

// Counts syntax errors from both lexer and parser for a single parse of `sql`.
function countSyntaxErrors(sql: string): number {
  const lexer = new DatabricksLexer(CharStream.fromString(sql));
  const parser = new DatabricksParser(new CommonTokenStream(lexer));
  let errors = 0;
  const listener = {
    syntaxError() {
      errors++;
    },
    reportAmbiguity() {},
    reportAttemptingFullContext() {},
    reportContextSensitivity() {},
  };
  lexer.removeErrorListeners();
  lexer.addErrorListener(listener as never);
  parser.removeErrorListeners();
  parser.addErrorListener(listener as never);
  parser.databricks_file(); // entry rule: statement_list? EOF
  return errors;
}

describe("databricks parser (antlr-ng -> antlr4ng) smoke", () => {
  it("parses valid SQL with zero errors", () => {
    expect(countSyntaxErrors("SELECT 1 AS x FROM t WHERE x > 0")).toBe(0);
  });

  it("flags invalid SQL", () => {
    expect(countSyntaxErrors("SELECT FROM WHERE")).toBeGreaterThan(0);
  });
});
