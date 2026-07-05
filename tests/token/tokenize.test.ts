import { describe, expect, it } from "vitest";
import type { Dialect } from "../../src/api.js";
import { tokenize } from "../../src/token/tokenize.js";
import type { Token } from "../../src/token/token.js";

const DIALECTS: Dialect[] = ["databricks", "tsql", "snowflake", "bigquery", "redshift"];

// Find the first non-trivia token whose text equals `text`.
function byText(tokens: Token[], text: string): Token | undefined {
	return tokens.find((t) => t.text === text);
}

describe("tokenize — per dialect", () => {
	for (const dialect of DIALECTS) {
		describe(dialect, () => {
			it("classifies keyword / number / comment and preserves order + spans", () => {
				const sql = "SELECT 1 -- c";
				const tokens = tokenize(sql, dialect);

				const select = byText(tokens, "SELECT");
				expect(select?.role).toBe("keyword");

				const one = byText(tokens, "1");
				expect(one?.role).toBe("number");

				// The line comment token may or may not carry the trailing text verbatim,
				// so match by role over the slice that starts at the dashes.
				const comment = tokens.find((t) => t.role === "comment" && t.text.startsWith("--"));
				expect(comment, "expected a comment token starting with --").toBeDefined();

				// Spans are non-decreasing in start, and the stream covers the input.
				const real = tokens.filter((t) => t.start >= 0);
				for (let i = 1; i < real.length; i++) {
					expect(real[i].start).toBeGreaterThanOrEqual(real[i - 1].start);
				}
				const maxStop = Math.max(...real.map((t) => t.stop));
				expect(maxStop).toBeGreaterThanOrEqual(sql.length - 2);
			});

			it("classifies identifier and single-quoted string", () => {
				// Single-quoted string literal is valid in all five dialects.
				const tokens = tokenize("SELECT col, 'str' FROM t", dialect);
				expect(byText(tokens, "col")?.role).toBe("identifier");
				expect(byText(tokens, "'str'")?.role).toBe("string");
			});

			// Regression: VARCHAR/CHAR are keywords whose symbolic names contain a
			// default-regex substring ("CHAR"/"STRING"). The literal-name heuristic
			// must run before the symbolic-name rules, or they classify as "string".
			// (bigquery/GoogleSQL treats them as identifiers, not keywords, so it is
			// excluded — it has no fixed literal name for them.)
			if (dialect !== "bigquery") {
				it("classifies VARCHAR/CHAR keywords as keyword, not string", () => {
					const tokens = tokenize("CAST(x AS VARCHAR(10))", dialect);
					expect(byText(tokens, "VARCHAR")?.role, "VARCHAR").toBe("keyword");

					const charTokens = tokenize("CAST(x AS CHAR(10))", dialect);
					expect(byText(charTokens, "CHAR")?.role, "CHAR").toBe("keyword");
				});
			}

			it("is total on broken and empty input", () => {
				expect(() => tokenize("(((", dialect)).not.toThrow();
				expect(Array.isArray(tokenize("(((", dialect))).toBe(true);
				expect(() => tokenize("", dialect)).not.toThrow();
				expect(Array.isArray(tokenize("", dialect))).toBe(true);
			});
		});
	}
});

// ---------------------------------------------------------------------------
// endLine/endColumn (anvil work order 2026-07-05) — producer-computed end
// positions on every Token: 1-based endLine / 0-based endColumn, one past the
// last char; a multi-line token advances endLine and resets the column count.
// ---------------------------------------------------------------------------
describe("Token endLine/endColumn", () => {
	it("single-line tokens: endLine === line, endColumn = column + length", () => {
		const tokens = tokenize("SELECT abc FROM t", "databricks");
		for (const t of tokens) {
			expect(t.endLine).toBe(t.line);
			expect(t.endColumn).toBe(t.column + t.text.length);
		}
	});

	it("a multi-line block comment advances endLine and resets the column", () => {
		const sql = "SELECT 1 /* line1\nline2\nline3 */ FROM t";
		const tokens = tokenize(sql, "databricks");
		const comment = tokens.find((t) => t.role === "comment");
		expect(comment).toBeDefined();
		expect(comment!.line).toBe(1);
		expect(comment!.endLine).toBe(3);
		expect(comment!.endColumn).toBe("line3 */".length);
	});

	it("tokens after a multi-line token carry correct start AND end lines", () => {
		const sql = "SELECT 1 /* a\nb */ FROM t";
		const from = tokenize(sql, "databricks").find((t) => t.text === "FROM");
		expect(from!.line).toBe(2);
		expect(from!.endLine).toBe(2);
		expect(from!.endColumn).toBe(from!.column + 4);
	});
});
