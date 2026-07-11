// Root ORDER BY must bind to the query's OWN sort clause, never a same-name inner one
// (anvil bug report, 2026-07-06): in the postgres-family lowers, the sort clause was found
// with a document-order deep search, so a CTE body's `ORDER BY sid, seed` (line 1) was
// hoisted as the ROOT query's orderBy whenever the root's clause (line 4) used the same
// names — wrong CST spans on the order-by ColumnRefs, and the root's real clause dropped.
// The grammar puts the query's own clause in a DIRECT `opt_sort_clause` child.

import { describe, expect, test } from "vitest";
import { parse, type Dialect } from "../src/index.js";

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

// The CTE body carries an inner ORDER BY with the SAME column names as the root's (line 1
// vs line 4) — the trap: a document-order deep search finds the inner clause first.
const SQL = `with c as (select 1 as sid, 2 as seed union all select 3, 4 order by sid, seed)
select *, seed || sid as x
from c
order by sid, seed`;

describe.each(DIALECTS)("root ORDER BY binds to its own clause — %s", (dialect) => {
	test("orderBy keys and order-by column refs carry line-4 spans", () => {
		const r = parse(SQL, dialect);
		expect(r.errors).toBe(0);
		const ast = r.ast as {
			orderBy?: { cst?: { start?: { line: number } } }[];
			body: { columns: { parts: string[]; clause?: string; cst?: { start?: { line: number } } }[] };
		};
		expect(ast.orderBy).toHaveLength(2);
		for (const key of ast.orderBy!) expect(key.cst?.start?.line).toBe(4);
		const obRefs = ast.body.columns.filter((c) => c.clause === "orderBy");
		expect(obRefs.map((c) => c.parts.join("."))).toEqual(["sid", "seed"]);
		for (const ref of obRefs) expect(ref.cst?.start?.line).toBe(4);
	});
});
