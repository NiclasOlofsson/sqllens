import { describe, expect, it } from "vitest";
import { parse, tokenize } from "../src/api.js";
import type { Token } from "../src/token/token.js";

// consumedAs: the post-parse "how was this keyword actually used" classification (see
// src/token/token.ts's field doc and src/token/consumed-as.ts's derivation algorithm). The
// probe scripts that produced these fixtures live in temp_auto/ (probe-broken*.mjs): real
// parses, not hand-guessed expectations.

function byText(tokens: Token[], text: string, occurrence = 0): Token {
	const matches = tokens.filter((t) => t.text === text);
	const t = matches[occurrence];
	if (!t) throw new Error(`no token ${JSON.stringify(text)} (occurrence ${occurrence}) in ${tokens.length} tokens`);
	return t;
}

describe("consumedAs: identifier absorption (Databricks Hive-mode)", () => {
	it("SELECT a FROM and: AND consumed as a table identifier (the audit's own case)", () => {
		const { tokens } = parse("SELECT a FROM and", "databricks");
		const and = byText(tokens, "and");
		expect(and.role).toBe("keyword");
		expect(and.consumedAs).toBe("identifier");
	});

	it("SELECT from FROM t: the bare column `from`, vs. the clause-head FROM", () => {
		const { tokens } = parse("SELECT from FROM t", "databricks");
		const column = byText(tokens, "from");
		const clause = byText(tokens, "FROM");
		expect(column.consumedAs).toBe("identifier");
		expect(clause.consumedAs).toBe("keyword");
	});

	it('a clause-head FROM is always "keyword"', () => {
		const { tokens } = parse("SELECT a FROM t", "databricks");
		expect(byText(tokens, "FROM").consumedAs).toBe("keyword");
		expect(byText(tokens, "SELECT").consumedAs).toBe("keyword");
	});
});

describe("consumedAs: type absorption", () => {
	it('databricks: CAST(x AS INT), INT is "type"', () => {
		const { tokens } = parse("SELECT CAST(x AS INT) FROM t", "databricks");
		expect(byText(tokens, "INT").consumedAs).toBe("type");
	});

	it('tsql: CAST(x AS INT), INT is "type"', () => {
		const { tokens } = parse("SELECT CAST(x AS INT) FROM t", "tsql");
		expect(byText(tokens, "INT").consumedAs).toBe("type");
	});

	it('snowflake: CAST(x AS VARCHAR), VARCHAR is "type"', () => {
		const { tokens } = parse("SELECT CAST(x AS VARCHAR) FROM t", "snowflake");
		expect(byText(tokens, "VARCHAR").consumedAs).toBe("type");
	});

	it('snowflake: a bare column named varchar, the outer id_ wins, VARCHAR is "identifier"', () => {
		// Snowflake's own id_ rule lists data_type as one of the ways to spell an object name
		// (SnowflakeParser.g4), so this is the real identifier-wraps-type crossover the derivation
		// algorithm exists to resolve, not a hypothetical.
		const { tokens } = parse("SELECT varchar FROM t", "snowflake");
		expect(byText(tokens, "varchar").consumedAs).toBe("identifier");
	});

	it('postgres: CAST(x AS BIGINT), BIGINT is "type"', () => {
		const { tokens } = parse("SELECT CAST(x AS BIGINT) FROM t", "postgres");
		expect(byText(tokens, "BIGINT").consumedAs).toBe("type");
	});

	it('postgres: a bare column named bigint, col_name_keyword wins, BIGINT is "identifier"', () => {
		// Postgres's col_name_keyword (BIGINT among them) feeds BOTH `numeric` (the type production)
		// and `colid`/`nonreservedword` (the identifier production) as two separate, non-nested
		// grammar paths; this exercises the identifier path.
		const { tokens } = parse("SELECT bigint FROM t", "postgres");
		expect(byText(tokens, "bigint").consumedAs).toBe("identifier");
	});
});

describe("consumedAs: absence contract", () => {
	it("tokenize() never sets consumedAs, even on keyword-role tokens", () => {
		const tokens = tokenize("SELECT a FROM t", "databricks");
		expect(tokens.length).toBeGreaterThan(0);
		for (const t of tokens) expect(t.consumedAs).toBeUndefined();
		// Sanity: the SELECT/FROM tokens really are keyword-role here (the field the assertion above
		// would have populated, had a parse run).
		expect(byText(tokens, "SELECT").role).toBe("keyword");
	});

	it('a keyword-role token the parse never consumed (error recovery) is absent, not "keyword"', () => {
		// T-SQL treats AND as genuinely reserved (unlike Databricks' Hive-mode leniency above): the
		// dangling AND right after WHERE cannot be read as an expression start, so the parser's
		// recovery drops it as an error node rather than reinterpreting it as a name.
		const { tokens, errors } = parse("SELECT a FROM t WHERE AND 1=1", "tsql");
		expect(errors).toBeGreaterThan(0);
		const and = byText(tokens, "AND");
		expect(and.role).toBe("keyword");
		expect(and.consumedAs).toBeUndefined();
	});

	it("a keyword inside a quoted identifier is not keyword-role at all: no field either way", () => {
		const { tokens } = parse('SELECT "SELECT" FROM t', "databricks");
		const quoted = byText(tokens, '"SELECT"');
		expect(quoted.role).not.toBe("keyword");
		expect(quoted.consumedAs).toBeUndefined();
	});

	it('sqlite has no clean type separation: a keyword used as a CAST target stays "identifier", never "type"', () => {
		// SQLite's type_name is a bare repetition of `name` (its universal identifier wrapper), see
		// consumed-as.ts's SQLite note. ACTION is a genuine keyword-role token there (unlike SQLite's
		// scalar type names, which are not keyword tokens at all: SQLite reserves no type-name
		// vocabulary, so a real type name like INTEGER never even reaches this classifier). No dialect
		// ever gets a "type" verdict it isn't due; SQLite is the one dialect where "type" is
		// structurally impossible.
		const { tokens } = parse("SELECT CAST(x AS ACTION) FROM t", "sqlite");
		const action = byText(tokens, "ACTION");
		expect(action.role).toBe("keyword");
		expect(action.consumedAs).toBe("identifier");
	});
});

describe("consumedAs: no other Token field changes", () => {
	const DIALECTS_AND_SQL: Array<["databricks" | "tsql" | "snowflake" | "postgres", string]> = [
		["databricks", "SELECT a, and, from FROM t WHERE a = 1"],
		["tsql", "SELECT a FROM t WHERE a = 1"],
		["snowflake", "SELECT varchar FROM t WHERE a = 1"],
		["postgres", "SELECT bigint FROM t WHERE a = 1"],
	];

	for (const [dialect, sql] of DIALECTS_AND_SQL) {
		it(`${dialect}: parse().tokens matches tokenize() on every field except consumedAs`, () => {
			const parsed = parse(sql, dialect).tokens;
			const lexed = tokenize(sql, dialect);
			expect(parsed.length).toBe(lexed.length);
			for (let i = 0; i < parsed.length; i++) {
				const { consumedAs: _ignored, ...parsedRest } = parsed[i];
				const { consumedAs: _ignoredToo, ...lexedRest } = lexed[i];
				expect(parsedRest).toEqual(lexedRest);
				expect(lexed[i].consumedAs).toBeUndefined();
			}
		});
	}
});
