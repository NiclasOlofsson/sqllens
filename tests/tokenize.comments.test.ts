import { describe, expect, it } from "vitest";
import type { Dialect } from "../src/api.js";
import { tokenize } from "../src/token/tokenize.js";
import type { Token } from "../src/token/token.js";

// P4 (Anvil phase-0, item 5 — .superpowers/sdd/anvil-phase0-brief.md): "confirm tokenize(sql, dialect)
// emits comment tokens (role 'comment') with exact spans for -- and /* */, including a trailing
// comment at EOF and a comment between two tokens, for all dialects."
//
// Existing coverage before this file: tests/token/tokenize.test.ts already asserts a role="comment"
// token exists for a trailing `--` line comment, for 5 dialects (databricks/tsql/snowflake/bigquery/
// redshift) — but only checks the role, not the exact span, has no `/* */` case, and doesn't cover
// postgres/duckdb/trino. tests/token/classify.test.ts asserts a `/* c */` block comment classifies as
// role "comment", but only for databricks, only through the raw lexer (not the public tokenize()), and
// without a span assertion. This file is the exact-span, all-8-dialect, all-4-shape pin the brief asks
// for; it doesn't replace the above (kept for their own regression value), it closes their gaps.
//
// Span-exactness note: databricks/trino/bigquery's `--` comment lexer rule optionally consumes the
// trailing line terminator into the token itself (`SIMPLE_COMMENT`/`DASH_COMMENT`); postgres/redshift/
// duckdb/snowflake/tsql's does not (`~[\r\n]*`, newline is a separate token). Both are legitimate
// per-grammar lexer designs — the pin here is that the reported span always slices out exactly the
// reported text (`sql.slice(start, stop+1) === text`), which is the real "exact spans" contract; the
// comparison against the expected comment body tolerates a captured trailing newline.

const DIALECTS: Dialect[] = [
	"databricks",
	"tsql",
	"snowflake",
	"bigquery",
	"redshift",
	"postgres",
	"duckdb",
	"trino",
	"sqlite",
	"mysql",
];

/** Strip one trailing CR/LF/CRLF, if a comment token captured it (databricks/trino/bigquery do). */
function stripTrailingNewline(s: string): string {
	return s.replace(/\r?\n$/, "");
}

function commentTokens(sql: string, dialect: Dialect): Token[] {
	return tokenize(sql, dialect).filter((t) => t.role === "comment");
}

/** The fundamental "exact span" contract: slicing the source at [start, stop+1) reproduces `text`. */
function assertSelfConsistentSpan(sql: string, t: Token): void {
	expect(sql.slice(t.start, t.stop + 1)).toBe(t.text);
}

describe.each(DIALECTS)("tokenize() comment tokens — %s", (dialect) => {
	it("-- line comment trailing at EOF (no newline after)", () => {
		const sql = "SELECT 1 -- trail";
		const comments = commentTokens(sql, dialect);
		expect(comments, `${dialect}: exactly one comment token`).toHaveLength(1);
		const c = comments[0];
		assertSelfConsistentSpan(sql, c);
		expect(c.text).toBe("-- trail");
		expect(c.start).toBe(sql.indexOf("-- trail"));
		expect(c.stop).toBe(sql.length - 1);
	});

	it("-- line comment between two tokens", () => {
		const sql = "SELECT 1 -- mid\nFROM t";
		const comments = commentTokens(sql, dialect);
		expect(comments, `${dialect}: exactly one comment token`).toHaveLength(1);
		const c = comments[0];
		assertSelfConsistentSpan(sql, c);
		expect(stripTrailingNewline(c.text)).toBe("-- mid");
		expect(c.start).toBe(sql.indexOf("-- mid"));
		// FROM must still lex as its own token, positioned after the comment (+ any newline it ate).
		const from = tokenize(sql, dialect).find((t) => t.text === "FROM");
		expect(from, `${dialect}: FROM token present after the comment`).toBeDefined();
		expect(from!.start).toBe(sql.indexOf("FROM"));
	});

	it("/* */ block comment between two tokens", () => {
		const sql = "SELECT 1 /* mid */ FROM t";
		const comments = commentTokens(sql, dialect);
		expect(comments, `${dialect}: exactly one comment token`).toHaveLength(1);
		const c = comments[0];
		assertSelfConsistentSpan(sql, c);
		expect(c.text).toBe("/* mid */");
		expect(c.start).toBe(sql.indexOf("/* mid */"));
		expect(c.stop).toBe(sql.indexOf("/* mid */") + "/* mid */".length - 1);
	});

	it("/* */ block comment trailing at EOF", () => {
		const sql = "SELECT 1 /* trail */";
		const comments = commentTokens(sql, dialect);
		expect(comments, `${dialect}: exactly one comment token`).toHaveLength(1);
		const c = comments[0];
		assertSelfConsistentSpan(sql, c);
		expect(c.text).toBe("/* trail */");
		expect(c.stop).toBe(sql.length - 1);
	});
});
