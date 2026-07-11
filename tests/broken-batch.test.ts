// Broken-batch honesty (anvil bug report, 2026-07-05): when a statement inside a
// `;`-separated batch fails to parse, ANTLR's recovery cannot resync at the `;`
// boundary — the healthy statements after the break are swallowed as flat error
// nodes under the batch root. The CST then shows ONE element, so a CST-derived
// statement kind reported "query" (not "compound"), statementCategories
// under-counted, and the IR carried no flag: a consumer detecting batch-ness by
// statement kind was lied to, and had to gate on `compound OR errors>0` instead.
//
// The fix derives batch-ness from the swallowed TOKENS (always intact) — a batch
// with a broken statement reports statement="compound" + the "multi-statement"
// flag exactly like a healthy batch, and statementCategories counts every
// `;`-separated swallowed unit as "other". A single broken statement (no `;`
// boundary in the swallowed tail) must NOT become a phantom batch.

import { describe, expect, test } from "vitest";
import { parse, type Dialect, type UnsupportedFlag } from "../src/index.js";
import type { StatementCategory } from "../src/ir/statement.js";
import type { ParserRuleContext } from "antlr4ng";
import { statementCategories as databricksCats } from "../src/databricks/lower.js";
import { statementCategories as tsqlCats } from "../src/tsql/lower.js";
import { statementCategories as snowflakeCats } from "../src/snowflake/lower.js";
import { statementCategories as bigqueryCats } from "../src/bigquery/lower.js";
import { statementCategories as redshiftCats } from "../src/redshift/lower.js";
import { statementCategories as postgresCats } from "../src/postgres/lower.js";
import { statementCategories as duckdbCats } from "../src/duckdb/lower.js";
import { statementCategories as trinoCats } from "../src/trino/lower.js";
import { statementCategories as sqliteCats } from "../src/sqlite/lower.js";
import { statementCategories as mysqlCats } from "../src/mysql/lower.js";

const CATS: Record<Dialect, (tree: ParserRuleContext) => StatementCategory[]> = {
	databricks: databricksCats,
	tsql: tsqlCats,
	snowflake: snowflakeCats,
	bigquery: bigqueryCats,
	redshift: redshiftCats,
	postgres: postgresCats,
	duckdb: duckdbCats,
	trino: trinoCats,
	sqlite: sqliteCats,
	mysql: mysqlCats,
};
const DIALECTS = Object.keys(CATS) as Dialect[];

// `group by` cannot start a statement in any of the dialect grammars, so the middle
// statement is genuinely broken everywhere (unlike e.g. `select where`, which is a
// valid identifier select on databricks).
const BROKEN_MIDDLE = "select a from t; group by ; select b from u";
const BROKEN_FIRST = "group by ; select b from u";
const BROKEN_LAST = "select a from t; group by";

describe.each(DIALECTS)("broken-batch honesty — %s", (dialect) => {
	const flagsOf = (sql: string) => {
		const r = parse(sql, dialect);
		const body = r.ast.body as { unsupported?: string[] };
		return {
			errors: r.errors,
			statement: r.ast.statement,
			unsupported: body.unsupported ?? [],
			cats: CATS[dialect](r.cst as ParserRuleContext),
		};
	};

	test("broken middle statement: batch still reports compound + flag, all 3 units counted", () => {
		const r = flagsOf(BROKEN_MIDDLE);
		expect(r.errors).toBeGreaterThan(0);
		expect(r.statement).toBe("compound");
		expect(r.unsupported).toContain("multi-statement");
		// ≥3: every real statement is counted; recovery shape may add a unit (tsql's resync
		// produces an extra recovered fragment), but nothing may be silently dropped.
		expect(r.cats.length).toBeGreaterThanOrEqual(3);
		expect(r.cats[0]).toBe("query");
	});

	test("broken first statement: batch reports compound", () => {
		const r = flagsOf(BROKEN_FIRST);
		expect(r.errors).toBeGreaterThan(0);
		expect(r.statement).toBe("compound");
		expect(r.unsupported).toContain("multi-statement");
		expect(r.cats.length).toBeGreaterThanOrEqual(2);
	});

	test("broken last statement: batch reports compound, 2 categories", () => {
		const r = flagsOf(BROKEN_LAST);
		expect(r.errors).toBeGreaterThan(0);
		expect(r.statement).toBe("compound");
		expect(r.unsupported).toContain("multi-statement");
		expect(r.cats).toHaveLength(2);
	});

	// Exempt where recovery-split fragments are indistinguishable from real statements:
	// T-SQL's statements legally need no separator (`select 1 select 2` is a valid batch), and
	// the postgres-family grammar parses separator-less siblings CLEAN too — so a recovery split
	// of one broken statement cannot be told apart from two statements without silently dropping
	// validly parsed content. Those dialects may over-report a broken single statement as a
	// compound (over-report on broken input, never an under-report).
	const RECOVERY_SPLIT = ["tsql", "redshift", "postgres", "duckdb"];
	test.skipIf(RECOVERY_SPLIT.includes(dialect))("single broken statement is NOT a phantom batch", () => {
		const r = flagsOf("select ((( from");
		expect(r.errors).toBeGreaterThan(0);
		expect(r.statement).not.toBe("compound");
		expect(r.unsupported).not.toContain("multi-statement");
	});

	test("wholly-unparsed single statement flags broken, not empty, not compound", () => {
		const r = flagsOf("group by");
		expect(r.errors).toBeGreaterThan(0);
		expect(r.statement).not.toBe("compound");
		expect(r.unsupported).not.toContain("empty");
	});

	test("healthy single statement unchanged", () => {
		const r = flagsOf("select a from t");
		expect(r.errors).toBe(0);
		expect(r.statement).toBe("query");
		expect(r.cats).toEqual(["query"]);
	});

	test("healthy single statement with trailing semicolon unchanged", () => {
		const r = flagsOf("select a from t;");
		expect(r.errors).toBe(0);
		expect(r.statement).toBe("query");
		expect(r.cats).toEqual(["query"]);
	});

	test("healthy batch unchanged: compound + flag, 2 categories", () => {
		const r = flagsOf("select a from t; select b from u");
		expect(r.errors).toBe(0);
		expect(r.statement).toBe("compound");
		expect(r.unsupported).toContain("multi-statement");
		expect(r.cats).toEqual(["query", "query"]);
	});
});

// UnsupportedFlag is a closed union exported from the public barrel (review finding 7) — a
// typo'd flag string is now a compile error at every lower.ts push site, not just at runtime.
// This is a compile-time pin: if the import or the literal ever stop type-checking, `npm run
// typecheck` fails even though nothing here executes a meaningful runtime assertion.
test("UnsupportedFlag is exported and the batch flags type-narrow", () => {
	const multiStatement: UnsupportedFlag = "multi-statement";
	const broken: UnsupportedFlag = "broken";
	expect(multiStatement).toBe("multi-statement");
	expect(broken).toBe("broken");
});
