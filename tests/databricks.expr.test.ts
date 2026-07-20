import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import type { Expr, SelectExpr } from "../src/ir/ir.js";
import { parseDatabricks } from "../src/databricks/parse.js";

function selectOf(sql: string): SelectExpr {
	const body = lower(parseDatabricks(sql).tree).body;
	if (body.kind !== "select") throw new Error("expected select");
	return body;
}
function exprOf(sql: string): Expr {
	const e = selectOf(sql).projections[0].expr;
	if (!e) throw new Error("no projection expr");
	return e;
}

describe("lowerExpression", () => {
	it("lowers a column reference", () => {
		expect(exprOf("SELECT t.a FROM t")).toMatchObject({ kind: "column", parts: ["t", "a"] });
	});

	it("lowers a literal", () => {
		expect(exprOf("SELECT 42 FROM t")).toMatchObject({ kind: "literal" });
	});

	it("lowers arithmetic into a binary expr", () => {
		expect(exprOf("SELECT a + b FROM t")).toMatchObject({
			kind: "binary",
			op: "+",
			left: { kind: "column", parts: ["a"] },
			right: { kind: "column", parts: ["b"] },
		});
	});

	it("lowers a comparison into a binary expr", () => {
		expect(exprOf("SELECT a = b FROM t")).toMatchObject({ kind: "binary", op: "=" });
	});

	it("lowers a function call with its arguments", () => {
		const e = exprOf("SELECT coalesce(a, 0) FROM t");
		expect(e).toMatchObject({ kind: "function", name: "coalesce" });
		if (e.kind !== "function") throw new Error("fn");
		expect(e.args).toHaveLength(2);
		expect(e.args[0]).toMatchObject({ kind: "column", parts: ["a"] });
	});

	it("keeps a qualified named-argument key intact (databricks.connection => ...)", () => {
		// docs.databricks.com/aws/en/sql/language-manual/functions/ai_parse_document: read_files
		// options accept a dotted key like `databricks.connection => 'conn'`. namedArgumentExpression's
		// key widened from a single identifier to a multipartIdentifier (GAP 1); pin that the lowered
		// argName carries the full dotted text, not just its first part.
		const e = exprOf("SELECT read_files(a, databricks.connection => 'x') FROM t");
		expect(e).toMatchObject({ kind: "function", name: "read_files" });
		if (e.kind !== "function") throw new Error("fn");
		expect(e.argNames).toEqual([undefined, "databricks.connection"]);
	});

	it("marks an aggregate function", () => {
		expect(exprOf("SELECT sum(x) FROM t")).toMatchObject({ kind: "function", name: "sum", aggregate: true });
	});

	it("captures a window function's OVER partition/order", () => {
		const e = exprOf("SELECT row_number() OVER (PARTITION BY y ORDER BY z) FROM t");
		expect(e).toMatchObject({ kind: "function", name: "row_number" });
		if (e.kind !== "function") throw new Error("fn");
		expect(e.window?.partitionBy).toHaveLength(1);
		expect(e.window?.orderBy).toHaveLength(1);
	});

	it("lowers CASE", () => {
		const e = exprOf("SELECT CASE WHEN a = 1 THEN 'x' ELSE 'y' END FROM t");
		expect(e.kind).toBe("case");
	});

	it("lowers a CAST", () => {
		expect(exprOf("SELECT cast(a AS string) FROM t")).toMatchObject({ kind: "cast" });
	});

	it("represents a genuinely unmodelled expression as 'other', never dropped", () => {
		// Semi-structured colon access (a:b) appears nowhere in the corpus — the IR-completeness
		// gate enforces 0 `other` there — and isn't modelled, so it must still surface as an Expr
		// node (other), proving the fallback degrades gracefully instead of dropping or throwing.
		const e = exprOf("SELECT a:b FROM t");
		expect(e.kind).toBe("other");
	});
});

describe("lowerExpression — predicates", () => {
	it("models IS NULL", () => {
		expect(exprOf("SELECT a IS NULL FROM t")).toMatchObject({
			kind: "predicate",
			op: "null",
			negated: false,
			operand: { kind: "column", parts: ["a"] },
		});
	});

	it("models IS NOT NULL with negation", () => {
		expect(exprOf("SELECT a IS NOT NULL FROM t")).toMatchObject({
			kind: "predicate",
			op: "null",
			negated: true,
		});
	});

	it("models IN with its list as args", () => {
		expect(exprOf("SELECT a IN (1, 2, 3) FROM t")).toMatchObject({
			kind: "predicate",
			op: "in",
			operand: { kind: "column", parts: ["a"] },
			args: [{ kind: "literal" }, { kind: "literal" }, { kind: "literal" }],
		});
	});

	it("models NOT BETWEEN with lower/upper args", () => {
		expect(exprOf("SELECT a NOT BETWEEN 1 AND 9 FROM t")).toMatchObject({
			kind: "predicate",
			op: "between",
			negated: true,
			args: [{ kind: "literal" }, { kind: "literal" }],
		});
	});

	it("models LIKE with the pattern arg", () => {
		expect(exprOf("SELECT a LIKE 'x%' FROM t")).toMatchObject({
			kind: "predicate",
			op: "like",
			operand: { kind: "column", parts: ["a"] },
		});
	});

	it("models IN (subquery) with the subquery as an arg", () => {
		const e = exprOf("SELECT a IN (SELECT b FROM u) FROM t");
		expect(e).toMatchObject({ kind: "predicate", op: "in" });
		if (e.kind !== "predicate") throw new Error("predicate");
		expect(e.args[0]?.kind).toBe("subquery");
	});

	it("extracts columns from inside a predicate (WHERE x IN (y, z))", () => {
		const sel = selectOf("SELECT 1 FROM t WHERE x IN (y, z)");
		const cols = sel.columns.filter((c) => c.clause === "where").map((c) => c.parts.join("."));
		expect(cols).toEqual(["x", "y", "z"]);
	});
});

describe("lowerExpression — special forms", () => {
	it("models date_add(unit, n, ts) as a function call (reaching its column args)", () => {
		const sel = selectOf("SELECT date_add(YEAR, -1, ref_date) FROM t");
		expect(sel.projections[0].expr).toMatchObject({ kind: "function", name: "date_add" });
		expect(sel.columns.map((c) => c.parts.join("."))).toContain("ref_date");
	});

	it("models datediff(unit, a, b) as a function call", () => {
		expect(exprOf("SELECT datediff(DAY, a, b) FROM t")).toMatchObject({
			kind: "function",
			name: "datediff",
		});
	});

	it("models a bare CURRENT_DATE as a niladic function", () => {
		expect(exprOf("SELECT current_date FROM t")).toMatchObject({ kind: "function", args: [] });
	});

	it("models a lambda argument with its params and body", () => {
		const e = exprOf("SELECT transform(arr, x -> x + 1) FROM t");
		if (e.kind !== "function") throw new Error("fn");
		expect(e.args[1]).toMatchObject({ kind: "lambda", params: ["x"], body: { kind: "binary" } });
	});

	it("models subscript access arr[0]", () => {
		expect(exprOf("SELECT arr[0] FROM t")).toMatchObject({
			kind: "subscript",
			base: { kind: "column", parts: ["arr"] },
		});
	});

	it("excludes lambda parameters from extracted columns (the param is a local, not a column)", () => {
		const sel = selectOf("SELECT transform(arr, x -> x + outer_col) FROM t");
		const cols = sel.columns.map((c) => c.parts.join("."));
		expect(cols).toContain("outer_col"); // a real outer column the lambda closes over
		expect(cols).toContain("arr"); // the collection argument
		expect(cols).not.toContain("x"); // the lambda parameter must not leak as a column ref
	});

	it("reaches the base column of a subscript for resolution (split(s,'-')[1])", () => {
		const sel = selectOf("SELECT split(s, '-')[1] AS first FROM t");
		expect(sel.columns.map((c) => c.parts.join("."))).toContain("s");
	});
});

describe("IDENTIFIER() clause — constant-string case (sql-ref-names-identifier-clause)", () => {
	it("resolves a bare IDENTIFIER('c1') to a real column reference", () => {
		expect(exprOf("SELECT IDENTIFIER('c1') FROM t")).toMatchObject({ kind: "column", parts: ["c1"] });
	});

	it("derives the projection name from the resolved column, same as a plain column ref", () => {
		expect(selectOf("SELECT IDENTIFIER('c1') FROM t").projections[0].name).toBe("c1");
	});

	it("feeds the resolved column into scope resolution (SelectExpr.columns), same as a plain ref", () => {
		const sel = selectOf("SELECT IDENTIFIER('c1') FROM t");
		expect(sel.columns.map((c) => c.parts.join("."))).toEqual(["c1"]);
	});

	it("resolves AS IDENTIFIER('col1') to the alias it names, not the raw constructor text", () => {
		// The pinned Spark-goldens case (identifier-clause.sql.out): Spark names this column
		// `col1`; before this fix, lower() kept the raw "IDENTIFIER('col1')" constructor text.
		expect(selectOf("SELECT 1 AS IDENTIFIER('col1')").projections[0].name).toBe("col1");
	});

	it("keeps a backtick-quoted resolved name delimited (identifier delimiter contract: kept)", () => {
		expect(exprOf("SELECT IDENTIFIER('`c 1`') FROM t")).toMatchObject({ kind: "column", parts: ["`c 1`"] });
	});

	it("never-wrong: a bind-parameter argument stays an unresolved function call", () => {
		expect(exprOf("SELECT IDENTIFIER(:param) FROM t")).toMatchObject({ kind: "function", name: "IDENTIFIER" });
	});

	it("never-wrong: a column argument stays an unresolved function call", () => {
		expect(exprOf("SELECT IDENTIFIER(c) FROM t")).toMatchObject({ kind: "function", name: "IDENTIFIER" });
	});

	it("never-wrong: a bind-parameter alias argument keeps the raw constructor text", () => {
		expect(selectOf("SELECT 1 AS IDENTIFIER(:param)").projections[0].name).toBe("IDENTIFIER(:param)");
	});

	it("splits a dotted constant into multi-part name parts (sql-ref-names-identifier-clause)", () => {
		// IDENTIFIER('a.b') names table a, column b: a dot OUTSIDE any backtick-quoted segment
		// separates parts, same as writing a.b directly.
		expect(exprOf("SELECT IDENTIFIER('a.b') FROM t")).toMatchObject({ kind: "column", parts: ["a", "b"] });
	});

	it("keeps a backtick-quoted segment as ONE part even when it embeds a dot", () => {
		// A backtick-quoted segment protects an embedded dot from splitting (the doc's own example:
		// a qualified name like `default`.`tab1`); the part keeps its own delimiters (kept, per
		// identifier-delimiter-contract.md's databricks row).
		expect(exprOf("SELECT IDENTIFIER('`a.b`') FROM t")).toMatchObject({ kind: "column", parts: ["`a.b`"] });
	});

	it("never-wrong: an escaped segment in a dotted constant still declines", () => {
		// The doubled single-quote in 'a''b.c' is a string-literal escape (a literal apostrophe).
		// Decoding it is out of scope for identifier resolution, so the whole clause stays an
		// unresolved function call, same as the unescaped-dot case did before this fix (unchanged
		// caution: escapes never guess).
		expect(exprOf("SELECT IDENTIFIER('a''b.c') FROM t")).toMatchObject({ kind: "function", name: "IDENTIFIER" });
	});

	it("leaves the IDENTIFIER-as-function-name form (a trailing call) untouched", () => {
		// IDENTIFIER('COAL' || 'ESCE')(NULL, 1) resolves the FUNCTION NAME, not a column — a
		// different grammar shape (functionName's own literal alt); not this fix's scope.
		expect(exprOf("SELECT IDENTIFIER('COAL' || 'ESCE')(NULL, 1) FROM t")).toMatchObject({ kind: "function" });
	});
});

describe("aggregation clauses", () => {
	it("captures GROUP BY / HAVING as exprs and marks the select aggregated", () => {
		const sel = selectOf("SELECT a, sum(x) FROM t GROUP BY a HAVING sum(x) > 1");
		expect(sel.groupBy).toHaveLength(1);
		expect(sel.having).toBeDefined();
		expect(sel.aggregated).toBe(true);
	});

	it("marks a select with an aggregate but no GROUP BY as aggregated", () => {
		expect(selectOf("SELECT count(*) FROM t").aggregated).toBe(true);
	});

	it("a plain select is not aggregated", () => {
		expect(selectOf("SELECT a FROM t").aggregated).toBe(false);
	});

	it("lowers WHERE into an expr", () => {
		const sel = selectOf("SELECT a FROM t WHERE a > 1");
		expect(sel.where).toMatchObject({ kind: "binary", op: ">" });
	});

	it("captures all GROUP BY keys under ROLLUP, not just the first", () => {
		const sel = selectOf("SELECT a, b, sum(x) FROM t GROUP BY ROLLUP(a, b)");
		expect(sel.groupBy?.map((g) => (g.kind === "column" ? g.parts.join(".") : g.kind))).toEqual(["a", "b"]);
	});

	it("captures every key across GROUPING SETS", () => {
		const sel = selectOf("SELECT a, b FROM t GROUP BY GROUPING SETS ((a, b), (a))");
		const keys = sel.groupBy?.filter((g) => g.kind === "column").length ?? 0;
		expect(keys).toBe(3); // a, b, a
	});

	it("recognizes additional Spark aggregates (every) by name", () => {
		expect(selectOf("SELECT every(x > 0) FROM t").aggregated).toBe(true);
	});
});
