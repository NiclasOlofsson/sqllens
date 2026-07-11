import { describe, expect, it } from "vitest";
import { parse, tokenize, type Dialect } from "../../src/index.js";
import { parseDatabricks } from "../../src/databricks/parse.js";
import { parseTSql } from "../../src/tsql/parse.js";
import { parseSnowflake } from "../../src/snowflake/parse.js";
import { parseBigQuery } from "../../src/bigquery/parse.js";
import { parseRedshift } from "../../src/redshift/parse.js";
import { parsePostgres } from "../../src/postgres/parse.js";
import { parseDuckdb } from "../../src/duckdb/parse.js";
import { parseTrino } from "../../src/trino/parse.js";
import { parseSqlite } from "../../src/sqlite/parse.js";
import { parseMysql } from "../../src/mysql/parse.js";
import type { Token } from "../../src/token/token.js";

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

// The per-dialect parse* functions are the layer that adds the token list to its ParseResult; the
// broken-input guarantee (tokens present, no throw, even with syntax errors) is asserted there. The
// full parse() pipeline (parse + lower) is exercised on valid input — lower's own error tolerance is
// a separate front-end concern, not what this task threads.
const PARSE_FNS: Record<Dialect, (sql: string) => { tokens: Token[]; errors: number }> = {
	databricks: parseDatabricks,
	tsql: parseTSql,
	snowflake: parseSnowflake,
	bigquery: parseBigQuery,
	redshift: parseRedshift,
	postgres: parsePostgres,
	duckdb: parseDuckdb,
	trino: parseTrino,
	sqlite: parseSqlite,
	mysql: parseMysql,
};

function byText(tokens: Token[], text: string): Token | undefined {
	return tokens.find((t) => t.text === text);
}

describe("parse() — tokens on the result", () => {
	it("databricks: carries the classified SELECT keyword and identifier", () => {
		const { tokens } = parse("SELECT a FROM t", "databricks");
		const select = byText(tokens, "SELECT");
		expect(select?.role).toBe("keyword");
		const a = byText(tokens, "a");
		expect(a?.role).toBe("identifier");
	});

	for (const dialect of DIALECTS) {
		describe(dialect, () => {
			it("includes a number token for SELECT 1", () => {
				const { tokens } = parse("SELECT 1", dialect);
				const one = byText(tokens, "1");
				expect(one?.role).toBe("number");
			});

			it("tokens are present on broken input and the parse does not throw", () => {
				let result: { tokens: Token[]; errors: number } | undefined;
				expect(() => {
					result = PARSE_FNS[dialect]("(((");
				}).not.toThrow();
				expect(Array.isArray(result?.tokens)).toBe(true);
				expect(result!.tokens.length).toBeGreaterThan(0);
				// Tokens must survive even when the input has syntax errors.
				expect(result!.errors).toBeGreaterThan(0);
			});

			it("spans stay within the input length", () => {
				const sql = "SELECT 1";
				const { tokens } = parse(sql, dialect);
				for (const t of tokens) {
					expect(t.start).toBeGreaterThanOrEqual(0);
					expect(t.stop).toBeLessThan(sql.length);
				}
			});
		});
	}

	it("exposes tokenize from the public barrel", () => {
		expect(tokenize("SELECT 1", "databricks").length).toBeGreaterThan(0);
	});
});
