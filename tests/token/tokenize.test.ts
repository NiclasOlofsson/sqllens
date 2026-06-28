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

			it("is total on broken and empty input", () => {
				expect(() => tokenize("(((", dialect)).not.toThrow();
				expect(Array.isArray(tokenize("(((", dialect))).toBe(true);
				expect(() => tokenize("", dialect)).not.toThrow();
				expect(Array.isArray(tokenize("", dialect))).toBe(true);
			});
		});
	}
});
