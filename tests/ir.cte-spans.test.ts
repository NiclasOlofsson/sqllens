import { describe, expect, test } from "vitest";
import { parse, partSpanOf } from "../src/index.js";
import type { QueryExpr } from "../src/index.js";

const DIALECTS = [
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
] as const;

describe("CteDef.nameCst", () => {
	for (const dialect of DIALECTS) {
		test(`${dialect}: a WITH clause's CTE name carries its own cst`, () => {
			const r = parse("with c as (select 1) select * from c", dialect);
			expect(r.errors).toBe(0);
			const ast = r.ast as QueryExpr;
			expect(ast.ctes).toHaveLength(1);
			const cte = ast.ctes[0]!;
			expect(cte.name).toBe("c");
			expect(cte.nameCst).toBeDefined();
			const span = partSpanOf(cte.nameCst);
			expect(span).toBeDefined();
			expect(span!.end - span!.start).toBe(1); // spans exactly "c"
		});
	}
});
