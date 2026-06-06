import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { DatabricksLexer } from "../src/generated/databricks/DatabricksLexer.js";
import { DatabricksParser } from "../src/generated/databricks/DatabricksParser.js";

function parseFile(sql: string): { errors: number; first?: string } {
  const lexer = new DatabricksLexer(CharStream.fromString(sql));
  const parser = new DatabricksParser(new CommonTokenStream(lexer));
  let errors = 0;
  let first: string | undefined;
  const listener = {
    syntaxError(_rec: unknown, _sym: unknown, line: number, col: number, msg: string) {
      errors++;
      if (!first) first = `line ${line}:${col} ${msg}`;
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
  return { errors, first };
}

describe("databricks examples corpus (grammars-v4)", () => {
  const dir = resolve("vendor/grammars-v4/sql/databricks/examples");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));

  it("reports coverage over the example files", () => {
    const results = files.map((file) => {
      const { errors, first } = parseFile(readFileSync(resolve(dir, file), "utf8"));
      return { file, errors, first };
    });
    const pass = results.filter((r) => r.errors === 0);
    const fail = results.filter((r) => r.errors > 0);

    const report = [
      ``,
      `Databricks examples corpus: ${results.length} files`,
      `  PASS (0 errors):  ${pass.length}`,
      `  FAIL (>0 errors): ${fail.length}`,
      ...(fail.length ? ["Failures:"] : []),
      ...fail.map((r) => `  - ${r.file.padEnd(22)} ${r.errors} err  | ${r.first}`),
    ];
    console.log(report.join("\n"));

    expect(results.length).toBeGreaterThan(0);
  });
});
