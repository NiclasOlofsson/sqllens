import { describe, expect, it } from "vitest";
import { CharStream } from "antlr4ng";
import { DatabricksLexer } from "../../src/generated/databricks/DatabricksLexer.js";
import { classifyToken } from "../../src/token/classify.js";
import type { TokenRole } from "../../src/token/token.js";

describe("classifyToken (databricks)", () => {
	const sql = "SELECT a /* c */ FROM 'x' 1.5";
	const lexer = new DatabricksLexer(CharStream.fromString(sql));
	const tokens = lexer.getAllTokens();

	function roleOfText(text: string): TokenRole {
		const tok = tokens.find((t) => t.text === text);
		if (!tok) throw new Error(`no token with text ${JSON.stringify(text)}`);
		return classifyToken(lexer, tok.type, "databricks");
	}

	it("classifies keywords from their alphabetic literal name", () => {
		expect(roleOfText("SELECT")).toBe("keyword");
		expect(roleOfText("FROM")).toBe("keyword");
	});

	it("classifies an identifier from its symbolic name", () => {
		expect(roleOfText("a")).toBe("identifier");
	});

	it("classifies a bracketed comment", () => {
		expect(roleOfText("/* c */")).toBe("comment");
	});

	it("classifies whitespace", () => {
		expect(roleOfText(" ")).toBe("whitespace");
	});

	it("classifies a string literal", () => {
		expect(roleOfText("'x'")).toBe("string");
	});

	it("classifies a numeric literal", () => {
		expect(roleOfText("1.5")).toBe("number");
	});
});
