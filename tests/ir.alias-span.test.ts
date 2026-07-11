import type { ParserRuleContext } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { parse, type Dialect, type SelectExpr } from "../src/index.js";

// Task 5 — `aliasCst` on Projection: the alias identifier's own span (delimiters included,
// the AS keyword excluded). Present ⇔ the projection carries an EXPLICIT alias in source; a
// derived name (a bare column ref's own name) gets NO aliasCst. Same field name as the sources'
// aliasCst, so freeze (prototype-based, skips foreign ParserRuleContext) needs no change.

/** The exact source slice a CST node covers, by its start/stop token char offsets. */
function span(ctx: ParserRuleContext, src: string): string {
	return src.slice(ctx.start!.start, ctx.stop!.stop + 1);
}

function selectBody(sql: string, dialect: Dialect): SelectExpr {
	const { ast } = parse(sql, dialect);
	if (ast.body.kind !== "select") throw new Error(`expected a select body, got ${ast.body.kind}`);
	return ast.body;
}

function firstProjection(sql: string, dialect: Dialect) {
	return selectBody(sql, dialect).projections[0]!;
}

// Per-dialect quoted-alias delimiter (dialect-true): backtick for Spark/BigQuery, brackets for
// T-SQL, double-quote everywhere else.
const DIALECTS: { dialect: Dialect; quoted: string }[] = [
	{ dialect: "databricks", quoted: "`total`" },
	{ dialect: "tsql", quoted: "[total]" },
	{ dialect: "snowflake", quoted: '"Total"' },
	{ dialect: "bigquery", quoted: "`total`" },
	{ dialect: "redshift", quoted: '"Total"' },
	{ dialect: "postgres", quoted: '"Total"' },
	{ dialect: "duckdb", quoted: '"Total"' },
	{ dialect: "trino", quoted: '"Total"' },
	{ dialect: "sqlite", quoted: '"Total"' },
	{ dialect: "mysql", quoted: "`Total`" },
];

describe("aliasCst on Projection — alias identifier span, all dialects", () => {
	for (const { dialect, quoted } of DIALECTS) {
		describe(dialect, () => {
			it("AS alias — span covers the identifier only, not AS", () => {
				const sql = "SELECT a + 1 AS total FROM t";
				const p = firstProjection(sql, dialect);
				expect(p.aliasCst).toBeDefined();
				expect(span(p.aliasCst!, sql)).toBe("total");
				expect(p.name).toBe("total");
			});

			it("AS-less alias — span covers the identifier", () => {
				const sql = "SELECT a + 1 total FROM t";
				const p = firstProjection(sql, dialect);
				expect(p.aliasCst).toBeDefined();
				expect(span(p.aliasCst!, sql)).toBe("total");
				expect(p.name).toBe("total");
			});

			it("quoted alias — span includes the quoting delimiters", () => {
				const sql = `SELECT a + 1 AS ${quoted} FROM t`;
				const p = firstProjection(sql, dialect);
				expect(p.aliasCst).toBeDefined();
				expect(span(p.aliasCst!, sql)).toBe(quoted);
			});

			it("no explicit alias — a derived name gets NO aliasCst", () => {
				const p = firstProjection("SELECT a FROM t", dialect);
				expect(p.name).toBe("a"); // derived from the bare column ref
				expect(p.aliasCst).toBeUndefined();
			});

			it("bare expression, no alias — no aliasCst", () => {
				const p = firstProjection("SELECT a + 1 FROM t", dialect);
				expect(p.aliasCst).toBeUndefined();
			});

			it("alias followed by a trailing line comment — span is still just the identifier", () => {
				const sql = "SELECT a + 1 AS total -- trailing\nFROM t";
				const p = firstProjection(sql, dialect);
				expect(p.aliasCst).toBeDefined();
				expect(span(p.aliasCst!, sql)).toBe("total");
			});

			it("parenthesized expression before the alias — span is just the identifier", () => {
				const sql = "SELECT (a + b) AS total FROM t";
				const p = firstProjection(sql, dialect);
				expect(p.aliasCst).toBeDefined();
				expect(span(p.aliasCst!, sql)).toBe("total");
			});
		});
	}

	it("aliasCst survives the freeze — reachable, and the IR stays frozen", () => {
		const sql = "SELECT a + 1 AS total FROM t";
		const body = selectBody(sql, "databricks");
		const p = body.projections[0]!;
		// The projection object is deep-frozen (no pass may write back into the IR)…
		expect(Object.isFrozen(body)).toBe(true);
		expect(Object.isFrozen(body.projections)).toBe(true);
		expect(Object.isFrozen(p)).toBe(true);
		// …yet the foreign CST back-ref is still reachable (freeze stops at the ParserRuleContext).
		expect(p.aliasCst).toBeDefined();
		expect(span(p.aliasCst!, sql)).toBe("total");
	});
});
