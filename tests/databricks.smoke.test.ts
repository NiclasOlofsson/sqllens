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
	parser.singleStatement(); // entry rule: (statement | setResetStatement) SEMICOLON* EOF
	return errors;
}

describe("databricks parser (antlr-ng -> antlr4ng) smoke", () => {
	it("parses valid SQL with zero errors", () => {
		expect(countSyntaxErrors("SELECT 1 AS x FROM t WHERE x > 0")).toBe(0);
	});

	it("flags invalid SQL", () => {
		// Use an incomplete expression, not "SELECT FROM WHERE": in Spark's default
		// (non-ANSI) mode FROM/WHERE are non-reserved keywords, so that string is valid
		// SQL (a column "from" aliased as "where"). A trailing operator is unambiguously broken.
		expect(countSyntaxErrors("SELECT 1 +")).toBeGreaterThan(0);
	});
});
