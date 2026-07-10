import { describe, expect, it } from "vitest";
import { parseMysql } from "../src/mysql/parse.js";

// MySQL is a new dialect: grammar forked from grammars-v4 sql/mysql/Positive-Technologies
// (Kochurkin's split MySqlLexer/MySqlParser pair). Only parse() and lower() are
// MySQL-specific — the semantic layer runs unchanged on the shared IR.
//
// The `lower` import dangles until R3 (module doesn't exist yet) — deliberately omitted
// here so this file's only gate is the parse assertion below.

const errorsOf = (sql: string) => parseMysql(sql).errors;

describe("Mysql parse", () => {
	it("parses a basic SELECT with zero syntax errors", () => {
		expect(errorsOf("SELECT a, b FROM t WHERE a > 1")).toBe(0);
	});
});
