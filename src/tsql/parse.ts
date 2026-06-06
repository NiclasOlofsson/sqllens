import {
  BailErrorStrategy,
  CharStream,
  CommonTokenStream,
  type Lexer,
  type ParserATNSimulator,
  type ParserRuleContext,
  PredictionMode,
} from "antlr4ng";
import { TSqlLexer } from "../generated/tsql/TSqlLexer.js";
import { TSqlParser } from "../generated/tsql/TSqlParser.js";

export interface ParseResult {
  /** The CST rooted at `select_statement_standalone` (an optional WITH + a query). */
  tree: ParserRuleContext;
  /** Count of lexer + parser syntax errors. */
  errors: number;
}

/**
 * Lex + parse one T-SQL query (a `WITH? SELECT …`). Two-stage parsing: try the fast SLL
 * prediction mode first (bail on the first conflict), fall back to full LL only when SLL
 * fails — same result LL alone would give, just faster on valid input.
 */
export function parseTSql(sql: string): ParseResult {
  const lexer = new TSqlLexer(CharStream.fromString(sql));
  const tokens = new CommonTokenStream(lexer);
  const parser = new TSqlParser(tokens);
  const sim = parser.interpreter as ParserATNSimulator;

  let errors = 0;
  const listener = {
    syntaxError() {
      errors++;
    },
    reportAmbiguity() {},
    reportAttemptingFullContext() {},
    reportContextSensitivity() {},
  };
  attachErrorCounter(lexer, parser, listener);

  const defaultErrorHandler = parser.errorHandler;
  parser.errorHandler = new BailErrorStrategy();
  sim.predictionMode = PredictionMode.SLL;
  try {
    return { tree: parser.select_statement_standalone(), errors };
  } catch {
    tokens.seek(0);
    parser.reset();
    parser.errorHandler = defaultErrorHandler;
    sim.predictionMode = PredictionMode.LL;
    errors = 0;
    attachErrorCounter(lexer, parser, listener);
    return { tree: parser.select_statement_standalone(), errors };
  }
}

function attachErrorCounter(lexer: Lexer, parser: TSqlParser, listener: object): void {
  lexer.removeErrorListeners();
  lexer.addErrorListener(listener as never);
  parser.removeErrorListeners();
  parser.addErrorListener(listener as never);
}
