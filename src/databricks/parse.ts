import { CharStream, CommonTokenStream, type ParserRuleContext } from "antlr4ng";
import { DatabricksLexer } from "../generated/databricks/DatabricksLexer.js";
import { DatabricksParser } from "../generated/databricks/DatabricksParser.js";

export interface ParseResult {
  /** The CST rooted at `singleStatement` (one statement + EOF). */
  tree: ParserRuleContext;
  /** Count of lexer + parser syntax errors. */
  errors: number;
}

/**
 * Lex + parse one Databricks SQL statement. The single entry point that dedupes
 * the lexer/parser/error-listener wiring otherwise copied across tests.
 */
export function parseDatabricks(sql: string): ParseResult {
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
  return { tree: parser.singleStatement(), errors };
}
