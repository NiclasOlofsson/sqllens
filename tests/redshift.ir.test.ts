import { describe, expect, it } from "vitest";
import type { Expr, QueryExpr, SelectExpr, SetOpExpr } from "../src/ir/ir.js";
import { lower } from "../src/redshift/lower.js";
import { parseRedshift } from "../src/redshift/parse.js";
import { resolveScopes } from "../src/scope/scope.js";
import { resolveColumnRef } from "../src/sema/resolve.js";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { inferType } from "../src/infer/infer.js";
import { deriveSymbols, parse, referencesAt } from "../src/index.js";

// IR lowering for Redshift (CST -> the shared dialect-neutral IR). Tests encode the SEMANTIC
// shape each query should lower to, so a regression in lower() — or a wrong CST assumption —
// fails here. The semantic layer (scope/qualify/infer/lineage) runs on this IR unchanged.

function ir(sql: string): QueryExpr {
	const { tree, errors } = parseRedshift(sql);
	expect(errors, `parse errors for: ${sql}`).toBe(0);
	return lower(tree);
}

function selectBody(sql: string): SelectExpr {
	const q = ir(sql);
	if (q.body.kind !== "select") throw new Error(`expected select body, got ${q.body.kind}`);
	return q.body;
}

describe("Redshift lower — SELECT skeleton", () => {
	it("projections and a table source", () => {
		const b = selectBody("SELECT a, b FROM t");
		expect(b.projections.map((p) => p.name)).toEqual(["a", "b"]);
		expect(b.from).toHaveLength(1);
		expect(b.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t"] } });
	});

	it("table alias and qualified name", () => {
		const b = selectBody("SELECT x.a FROM schema.tbl x");
		expect(b.from[0]).toMatchObject({ kind: "table", relation: { parts: ["schema", "tbl"] }, alias: "x" });
		expect(b.projections[0].expr).toMatchObject({ kind: "column", parts: ["x", "a"] });
	});

	it("SELECT * is a star projection", () => {
		const b = selectBody("SELECT * FROM t");
		expect(b.projections[0]).toMatchObject({ isStar: true });
		expect(b.projections[0].expr.kind).toBe("star");
	});

	it("qualified star t.*", () => {
		const b = selectBody("SELECT t.* FROM t");
		expect(b.projections[0].expr).toMatchObject({ kind: "star", qualifier: ["t"] });
	});

	it("alias via AS", () => {
		const b = selectBody("SELECT a + 1 AS total FROM t");
		expect(b.projections[0].name).toBe("total");
		expect(b.projections[0].expr).toMatchObject({ kind: "binary", op: "+" });
	});
});

describe("Redshift lower — expressions", () => {
	it("WHERE binary comparison", () => {
		const b = selectBody("SELECT a FROM t WHERE a > 10");
		expect(b.where).toMatchObject({ kind: "binary", op: ">" });
	});

	it("AND / OR nest by precedence", () => {
		const b = selectBody("SELECT a FROM t WHERE a = 1 OR b = 2 AND c = 3");
		// OR is the top operator; the right side is the AND.
		expect(b.where).toMatchObject({ kind: "binary", op: "or" });
		const or = b.where as Extract<Expr, { kind: "binary" }>;
		expect(or.right).toMatchObject({ kind: "binary", op: "and" });
	});

	it("function call, aggregate flagged", () => {
		const b = selectBody("SELECT sum(x), upper(name) FROM t");
		const sum = b.projections[0].expr as Extract<Expr, { kind: "function" }>;
		expect(sum).toMatchObject({ kind: "function", name: "sum", aggregate: true });
		expect(b.projections[1].expr).toMatchObject({ kind: "function", name: "upper", aggregate: false });
		expect(b.aggregated).toBe(true);
	});

	it(":: typecast", () => {
		const b = selectBody("SELECT a::int FROM t");
		expect(b.projections[0].expr).toMatchObject({ kind: "cast", typeText: "int" });
	});

	it("CAST(... AS ...)", () => {
		const b = selectBody("SELECT CAST(a AS varchar) FROM t");
		expect(b.projections[0].expr).toMatchObject({ kind: "cast" });
	});

	it("CASE expression", () => {
		const b = selectBody("SELECT CASE WHEN a > 0 THEN 'p' ELSE 'n' END FROM t");
		const c = b.projections[0].expr as Extract<Expr, { kind: "case" }>;
		expect(c.kind).toBe("case");
		expect(c.whens).toHaveLength(1);
		expect(c.elseExpr).toBeDefined();
	});

	it("window function OVER", () => {
		const b = selectBody("SELECT row_number() OVER (PARTITION BY dept ORDER BY salary) FROM emp");
		const f = b.projections[0].expr as Extract<Expr, { kind: "function" }>;
		expect(f.kind).toBe("function");
		expect(f.window).toBeDefined();
		expect(f.window?.partitionBy).toHaveLength(1);
	});

	it("IN predicate", () => {
		const b = selectBody("SELECT a FROM t WHERE a IN (1, 2, 3)");
		expect(b.where).toMatchObject({ kind: "predicate", op: "in", negated: false });
	});

	it("BETWEEN predicate", () => {
		const b = selectBody("SELECT a FROM t WHERE a BETWEEN 1 AND 10");
		expect(b.where).toMatchObject({ kind: "predicate", op: "between" });
	});

	it("IS NULL predicate", () => {
		const b = selectBody("SELECT a FROM t WHERE a IS NOT NULL");
		expect(b.where).toMatchObject({ kind: "predicate", op: "null", negated: true });
	});

	it("LIKE predicate", () => {
		const b = selectBody("SELECT a FROM t WHERE a LIKE 'x%'");
		expect(b.where).toMatchObject({ kind: "predicate", op: "like" });
	});

	it("scalar subquery in projection collected", () => {
		const b = selectBody("SELECT (SELECT max(x) FROM u) AS m FROM t");
		expect(b.subqueries?.length).toBe(1);
	});
});

describe("Redshift lower — clauses", () => {
	it("GROUP BY and HAVING", () => {
		const b = selectBody("SELECT dept, count(*) FROM emp GROUP BY dept HAVING count(*) > 5");
		expect(b.groupBy).toHaveLength(1);
		expect(b.groupBy?.[0]).toMatchObject({ kind: "column", parts: ["dept"] });
		expect(b.having).toBeDefined();
		expect(b.aggregated).toBe(true);
	});

	it("ORDER BY and LIMIT hoist to query level", () => {
		const q = ir("SELECT a FROM t ORDER BY a DESC LIMIT 5");
		expect(q.orderBy).toHaveLength(1);
		expect(q.limit?.top).toMatchObject({ kind: "literal", text: "5" });
	});

	it("QUALIFY", () => {
		const b = selectBody("SELECT a, row_number() OVER (ORDER BY a) rn FROM t QUALIFY rn = 1");
		expect(b.qualify).toBeDefined();
	});

	it("join ON condition captured", () => {
		const b = selectBody("SELECT a FROM t JOIN u ON t.id = u.id");
		expect(b.from).toHaveLength(2);
		expect(b.joinConditions).toHaveLength(1);
		expect(b.joinConditions?.[0]).toMatchObject({ kind: "binary", op: "=" });
	});

	it("comma-join (two sources, no condition)", () => {
		const b = selectBody("SELECT a FROM t, u");
		expect(b.from).toHaveLength(2);
	});

	// PartiQL nested-data unnest join: a comma FROM list may end with a bare ON predicate, no JOIN
	// keyword (docs.aws.amazon.com/redshift/latest/dg/nested-data-use-cases.html, "Joining Amazon
	// Redshift and nested data"). Per the Join-node contract, comma-separated sources stay plain
	// `from` entries; the trailing ON is conserved into joinConditions WITHOUT a synthesized Join.
	it("comma FROM list with a trailing bare ON: conserved into joinConditions, no Join node", () => {
		const b = selectBody(
			"SELECT c.name.given, COUNT(o.date) AS n FROM spectrum.customers2 c, c.orders o, prices p ON o.item = p.id GROUP BY c.id, c.name.given",
		);
		expect(b.from).toHaveLength(3);
		expect(b.from.every((s) => s.kind === "table")).toBe(true);
		expect(b.joinConditions).toHaveLength(1);
		expect(b.joinConditions?.[0]).toMatchObject({
			kind: "binary",
			op: "=",
			left: { kind: "column", parts: ["o", "item"] },
			right: { kind: "column", parts: ["p", "id"] },
		});
		expect(b.joins).toBeUndefined();
	});

	it("ordinary explicit JOIN...ON is unaffected, still produces a Join node", () => {
		const b = selectBody("SELECT a FROM t JOIN u ON t.id = u.id");
		expect(b.joins).toHaveLength(1);
		expect(b.joins?.[0]).toMatchObject({ kind: "inner", on: { kind: "binary", op: "=" } });
	});

	it("subquery source", () => {
		const b = selectBody("SELECT s.a FROM (SELECT a FROM t) s");
		expect(b.from[0]).toMatchObject({ kind: "subquery", alias: "s" });
		const sub = b.from[0] as Extract<(typeof b.from)[0], { kind: "subquery" }>;
		expect(sub.query.body.kind).toBe("select");
	});
});

describe("Redshift lower — CTE, set ops, VALUES", () => {
	it("WITH cte", () => {
		const q = ir("WITH c AS (SELECT a FROM t) SELECT a FROM c");
		expect(q.ctes).toHaveLength(1);
		expect(q.ctes[0].name).toBe("c");
		expect(q.ctes[0].body.body.kind).toBe("select");
	});

	it("UNION ALL set op", () => {
		const q = ir("SELECT a FROM t UNION ALL SELECT a FROM u");
		expect(q.body.kind).toBe("setop");
		const s = q.body as SetOpExpr;
		expect(s.op).toBe("union");
		expect(s.all).toBe(true);
	});

	it("EXCEPT / INTERSECT", () => {
		expect((ir("SELECT a FROM t EXCEPT SELECT a FROM u").body as SetOpExpr).op).toBe("except");
		expect((ir("SELECT a FROM t INTERSECT SELECT a FROM u").body as SetOpExpr).op).toBe("intersect");
	});

	it("VALUES lowers to a modelled select", () => {
		const b = selectBody("VALUES (1, 'a'), (2, 'b')");
		expect(b.projections).toHaveLength(2);
		expect(b.projections[0].expr.kind).toBe("literal");
	});
});

// PIVOT / UNPIVOT / CONNECT BY are modelled onto the shared IR (PivotInfo / UnpivotInfo / conserved
// predicate columns + LEVEL pseudo-source), the same shapes the sibling dialects produce — no longer
// flagged unsupported. Doc-cited against the AWS Redshift SQL reference.
describe("Redshift lower — PIVOT / UNPIVOT / CONNECT BY modelled", () => {
	// docs.aws.amazon.com/redshift/latest/dg/r_FROM_clause-pivot-unpivot-examples.html
	it("PIVOT lowers to PivotInfo (values / FOR column / aggregate column), not a flag", () => {
		const b = selectBody("SELECT * FROM sales PIVOT (sum(qty) FOR region IN ('A', 'B'))");
		expect(b.unsupported).toBeUndefined();
		expect(b.pivot).toEqual({ values: ["A", "B"], forColumns: ["region"], aggColumns: ["qty"], alias: undefined });
		expect(b.unpivot).toBeUndefined();
	});

	// The IN-list may alias each output column (val [AS] alias); the alias names the pivoted column.
	it("PIVOT with aliased IN-list values uses the aliases as output column names", () => {
		const b = selectBody("SELECT * FROM sales PIVOT (sum(qty) FOR region IN ('A' AS ap, 'B' AS bp)) p");
		expect(b.pivot).toEqual({ values: ["ap", "bp"], forColumns: ["region"], aggColumns: ["qty"], alias: "p" });
	});

	// docs.aws.amazon.com/redshift/latest/dg/r_FROM_clause-pivot-unpivot-examples.html
	it("UNPIVOT lowers to UnpivotInfo (value / name / removed columns), not a flag", () => {
		const b = selectBody("SELECT * FROM (SELECT a, b FROM t) UNPIVOT (v FOR n IN (a, b))");
		expect(b.unsupported).toBeUndefined();
		expect(b.unpivot).toEqual({ valueColumn: "v", nameColumn: "n", removed: ["a", "b"], alias: undefined });
		expect(b.pivot).toBeUndefined();
	});

	// docs.aws.amazon.com/redshift/latest/dg/r_CONNECT_BY_clause.html — START WITH / CONNECT BY.
	it("CONNECT BY is un-flagged; START WITH / CONNECT BY predicate columns are conserved", () => {
		const b = selectBody("SELECT id FROM t START WITH id = 1 CONNECT BY PRIOR id = pid");
		expect(b.unsupported).toBeUndefined();
		const whereCols = b.columns.filter((c) => c.clause === "where").map((c) => c.parts.join(".").toLowerCase());
		// START WITH `id`, and both sides of `PRIOR id = pid` (a dropped PRIOR arg would lose `id`).
		expect(whereCols).toEqual(expect.arrayContaining(["id", "pid"]));
	});

	// `PRIOR x` lowers as a `prior(x)` function so columnsOf still reaches `x` (Task-4 Snowflake shape).
	it("PRIOR lowers as a prior(x) function over the referenced column", () => {
		const b = selectBody("SELECT id FROM t START WITH parent IS NULL CONNECT BY parent = PRIOR id");
		expect(b.unsupported).toBeUndefined();
		const whereCols = b.columns.filter((c) => c.clause === "where").map((c) => c.parts.join(".").toLowerCase());
		expect(whereCols).toEqual(expect.arrayContaining(["parent", "id"]));
	});
});

describe("Redshift lower — Redshift-specific sources", () => {
	it("catalog path database@namespace.schema.table keeps every name part (no silent truncation)", () => {
		const b = selectBody("SELECT * FROM b@a.c.d");
		expect(b.from[0]).toMatchObject({ kind: "table", relation: { parts: ["b", "a", "c", "d"] } });
	});

	// PartiQL SUPER object unpivoting: UNPIVOT expr AS value AT attribute is a FROM item that reshapes a
	// SUPER object into (value, attribute) rows — docs.aws.amazon.com/redshift/latest/dg/query-super.html#unpivoting
	it("PartiQL SUPER UNPIVOT in FROM lowers to UnpivotInfo with value/name from AS/AT, not a flag", () => {
		const b = selectBody("SELECT attr FROM customer_orders_lineitem c, UNPIVOT c.c_orders[0] AS val AT attr");
		expect(b.unsupported).toBeUndefined();
		expect(b.unpivot).toEqual({ valueColumn: "val", nameColumn: "attr", removed: [], alias: undefined });
	});
});

// SUPER object transform's KEEP/SET mini-grammar (docs.aws.amazon.com/redshift/latest/dg/
// r_object_transform_function.html). Lowers to an ordinary "function" node named object_transform;
// args conserve input, then KEEP paths, then SET path/value pairs, in source order (each KEEP/SET
// wraps its own expr_list, so the generic direct-a_expr/expr_list collection can't see them; a
// dedicated branch in lowerCommonFunc handles the ordering).
describe("Redshift lower: OBJECT_TRANSFORM (SUPER KEEP/SET)", () => {
	it("plain call (no KEEP/SET): a single-arg function", () => {
		const b = selectBody("SELECT OBJECT_TRANSFORM(col_person) FROM employees");
		expect(b.projections[0].expr).toMatchObject({
			kind: "function",
			name: "object_transform",
			args: [{ kind: "column", parts: ["col_person"] }],
		});
	});

	it("KEEP only: paths conserved after input, in order", () => {
		const b = selectBody(`SELECT OBJECT_TRANSFORM(col_person KEEP '"a"', '"b"') FROM employees`);
		const expr = b.projections[0].expr;
		expect(expr).toMatchObject({ kind: "function", name: "object_transform" });
		if (expr.kind !== "function") throw new Error("expected function");
		expect(expr.args).toHaveLength(3);
		expect(expr.args[0]).toMatchObject({ kind: "column", parts: ["col_person"] });
		expect(expr.args[1]).toMatchObject({ kind: "literal", text: `'"a"'` });
		expect(expr.args[2]).toMatchObject({ kind: "literal", text: `'"b"'` });
	});

	it("KEEP + SET: the docs example, full arg order preserved (input, keep paths, set pairs)", () => {
		const b = selectBody(
			`SELECT OBJECT_TRANSFORM(col_person KEEP '"name"."first"', '"age"' SET '"age"', col_person.age + 5) AS x FROM employees`,
		);
		const expr = b.projections[0].expr;
		if (expr.kind !== "function") throw new Error("expected function");
		expect(expr.name).toBe("object_transform");
		expect(expr.args.map((a) => a.kind)).toEqual(["column", "literal", "literal", "literal", "binary"]);
		expect(expr.args[0]).toMatchObject({ parts: ["col_person"] });
		expect(expr.args[1]).toMatchObject({ text: `'"name"."first"'` });
		expect(expr.args[2]).toMatchObject({ text: `'"age"'` });
		expect(expr.args[3]).toMatchObject({ text: `'"age"'` });
		expect(expr.args[4]).toMatchObject({ kind: "binary", op: "+" });
	});

	it("OBJECT_TRANSFORM and KEEP stay usable as ordinary identifiers outside the call", () => {
		const b = selectBody("SELECT object_transform, keep FROM t");
		expect(b.projections.map((p) => p.expr)).toMatchObject([
			{ kind: "column", parts: ["object_transform"] },
			{ kind: "column", parts: ["keep"] },
		]);
	});
});

// The PartiQL SUPER unpivot lateral (`UNPIVOT expr AS val AT attr`) registers val/attr as an ordinary
// lateral source AND UnpivotInfo re-adds nameColumn/valueColumn on top (the SUPER-unpivot reshape) — a
// bare `SELECT *` must not double them. Mirrors the CONNECT BY LEVEL pseudo-column fix below.
// docs.aws.amazon.com/redshift/latest/dg/query-super.html#unpivoting
describe("Redshift PartiQL UNPIVOT — no duplicate val/attr under a schema-fed SELECT *", () => {
	function scopes(sql: string) {
		return resolveScopes(lower(parseRedshift(sql).tree), "redshift");
	}
	const UNPIVOT_SQL = "FROM customer_orders_lineitem c, UNPIVOT c.c_orders[0] AS val AT attr";

	it("excludes val/attr from a bare star expansion (no duplicates)", () => {
		const schema = new Schema({ customer_orders_lineitem: { id: "int4", c_orders: "super" } });
		const tree = scopes(`SELECT * ${UNPIVOT_SQL}`);
		expect(qualify(tree, schema).columnsOf(tree.root)).toEqual(["id", "c_orders", "attr", "val"]);
	});

	it("named val/attr still resolve bound", () => {
		const tree = scopes(`SELECT val, attr ${UNPIVOT_SQL}`);
		const body = tree.root.body;
		if (body.kind !== "select") throw new Error("expected select");
		const valRef = body.columns.find((c) => c.parts.join(".").toLowerCase() === "val");
		const attrRef = body.columns.find((c) => c.parts.join(".").toLowerCase() === "attr");
		expect(valRef).toBeDefined();
		expect(attrRef).toBeDefined();
		expect(resolveColumnRef(tree.root, valRef!).kind).toBe("bound");
		expect(resolveColumnRef(tree.root, attrRef!).kind).toBe("bound");
	});
});

// The CONNECT BY LEVEL pseudo-column: it resolves by name (a lateral pseudo-source), but must NOT
// appear in a bare `SELECT *` expansion — real pseudo-column semantics, like Snowflake/Oracle.
// docs.aws.amazon.com/redshift/latest/dg/r_CONNECT_BY_clause.html
describe("Redshift CONNECT BY — LEVEL pseudo-column semantics", () => {
	function scopes(sql: string) {
		return resolveScopes(lower(parseRedshift(sql).tree), "redshift");
	}

	it("binds LEVEL by name on a CONNECT BY hierarchical select", () => {
		const tree = scopes("SELECT id, LEVEL FROM t START WITH id = 1 CONNECT BY PRIOR id = pid");
		const body = tree.root.body;
		if (body.kind !== "select") throw new Error("expected select");
		expect(body.unsupported).toBeUndefined();
		const levelRef = body.columns.find((c) => c.parts.join(".").toLowerCase() === "level");
		expect(levelRef).toBeDefined();
		expect(resolveColumnRef(tree.root, levelRef!).kind).toBe("bound");
	});

	it("excludes LEVEL from a schema-fed `SELECT *` on a CONNECT BY query", () => {
		const schema = new Schema({ t: { id: "int4", pid: "int4" } });
		const tree = scopes("SELECT * FROM t START WITH id = 1 CONNECT BY PRIOR id = pid");
		expect(qualify(tree, schema).columnsOf(tree.root)).toEqual(["id", "pid"]);
	});
});

describe("Redshift lower — non-query", () => {
	it("a non-SELECT statement lowers to a flagged non-query body, never throws", () => {
		const q = ir("CREATE TABLE t (a int)");
		expect(q.body.kind).toBe("select");
		expect((q.body as SelectExpr).unsupported).toBeDefined();
		expect(q.statement).toBe("ddl");
	});
});

// Oracle-style `(+)` outer-join marker (docs.aws.amazon.com/redshift/latest/dg/r_WHERE_oracle_outer.html).
// The marker rides the columnref it annotates (`a.id = b.id (+)`), meaning b's table is the
// null-extended side. sqllens PRESERVES it verbatim on the column Expr (`outerJoinMarker: true`) and
// derives NO join kind — which LEFT/RIGHT join it implies across a multi-predicate WHERE is
// Oracle-semantics a consumer (or a future dedicated pass) resolves. Before this, the marker was
// dropped in lowering, so the predicate read as a plain inner comma-join — silently wrong.
describe("Redshift lower — the `(+)` outer-join marker", () => {
	function binaryWhere(sql: string): { left: Expr; right: Expr } {
		const w = selectBody(sql).where;
		if (!w || w.kind !== "binary") throw new Error("expected a binary WHERE");
		return { left: w.left, right: w.right };
	}

	it("preserves `(+)` on the marked column and leaves the unmarked side clean", () => {
		const { left, right } = binaryWhere("SELECT * FROM a, b WHERE a.id = b.id (+)");
		// b.id carries the raw marker; a.id (no `(+)`) does not.
		expect(right).toMatchObject({ kind: "column", parts: ["b", "id"], outerJoinMarker: true });
		expect(left).toMatchObject({ kind: "column", parts: ["a", "id"] });
		expect((left as { outerJoinMarker?: true }).outerJoinMarker).toBeUndefined();
	});

	it("a plain predicate with no `(+)` carries no marker (absent field)", () => {
		const { left, right } = binaryWhere("SELECT * FROM a, b WHERE a.id = b.id");
		expect((left as { outerJoinMarker?: true }).outerJoinMarker).toBeUndefined();
		expect((right as { outerJoinMarker?: true }).outerJoinMarker).toBeUndefined();
	});

	it("each marked column in a multi-`(+)` WHERE carries the marker independently", () => {
		// a.id = b.id (+) AND b.x = c.x (+): the two right-hand columns are marked, the two
		// left-hand columns are not — no join kind is claimed for either predicate.
		const w = selectBody("SELECT * FROM a, b, c WHERE a.id = b.id (+) AND b.x = c.x (+)").where;
		if (!w || w.kind !== "binary" || w.op !== "and") throw new Error("expected AND of two predicates");
		for (const side of [w.left, w.right]) {
			if (side.kind !== "binary") throw new Error("expected a comparison");
			expect((side.left as { outerJoinMarker?: true }).outerJoinMarker).toBeUndefined();
			expect(side.right).toMatchObject({ kind: "column", outerJoinMarker: true });
		}
	});
});

// Position-aware slice lowering (#lossless), ported from the postgres fix: applyIndirection's
// bracket branch used to read only a DIRECT a_expr child of indirection_el, which exists for a
// plain `[idx]` but never for the slice alt (`opt_slice_bound? COLON opt_slice_bound?` wraps each
// bound one level deeper) — so every slice fell to the whole-bracket-text literal fallback, fusing
// lo/hi into one opaque string and dropping any column referenced in either bound. Fixed by walking
// indirection_el's children in order so the bound before COLON becomes `index` (begin) and the
// bound after becomes `end`; an omitted bound stays absent, never fabricated.
describe("Redshift subscript slicing — position-aware begin/end (#lossless)", () => {
	const strip = (o: unknown) =>
		JSON.parse(JSON.stringify(o, (k, v) => (k === "cst" || k === "aliasCst" || k === "partSpans" ? undefined : v)));
	const shapeOf = (sql: string) => {
		const { ast } = parse(sql, "redshift");
		const expr = ast.body.kind === "select" ? ast.body.projections[0]?.expr : undefined;
		return strip(expr);
	};
	const num = (n: number) => ({ kind: "literal", text: String(n) });
	const arr = { kind: "column", parts: ["arr"] };

	it("x[2] — plain element access, unchanged shape (no slice flag)", () => {
		expect(shapeOf("SELECT arr[2] FROM t;")).toEqual({ kind: "subscript", base: arr, index: num(2) });
	});

	it("x[2:4] — begin + end, slice flag", () => {
		expect(shapeOf("SELECT arr[2:4] FROM t;")).toEqual({
			kind: "subscript",
			base: arr,
			index: num(2),
			end: num(4),
			slice: true,
		});
	});

	it("x[:4] — empty begin stays absent, does NOT get misattributed as index", () => {
		expect(shapeOf("SELECT arr[:4] FROM t;")).toEqual({ kind: "subscript", base: arr, end: num(4), slice: true });
	});

	it("x[2:] — empty end stays absent", () => {
		expect(shapeOf("SELECT arr[2:] FROM t;")).toEqual({ kind: "subscript", base: arr, index: num(2), slice: true });
	});

	it("x[:] — both bounds absent, still a slice", () => {
		expect(shapeOf("SELECT arr[:] FROM t;")).toEqual({ kind: "subscript", base: arr, slice: true });
	});

	// A bare colid immediately after the slice COLON used to not parse at all — a genuine LEXER
	// collision, not a parser ambiguity: `:hi` (no gap) maximal-munches as ONE PLSQLVARIABLENAME
	// token (psql/pgbench `:variable` interpolation, docs.postgresql.org/current/app-psql.html
	// #APP-PSQL-INTERPOLATION — real corpus use: postgres/docs/parser/positive/dml/pgbench/1.sql,
	// shared pg-family lexer), so the parser never sees a standalone COLON before "hi". Fixed for a
	// non-empty NUMERIC begin (`arr[1:hi]`) by a new indirection_el alt that accepts the fused token
	// and un-fuses it in lower() (postgresql.org/docs/current/arrays.html#ARRAYS-ACCESSING — a bound
	// is any expression). Parenthesizing still works too.
	it("a column used in a slice's end bound is not dropped from SelectExpr.columns", () => {
		const { ast } = parse("SELECT arr[1:(hi)] FROM t;", "redshift");
		if (ast.body.kind !== "select") throw new Error("expected select");
		const cols = ast.body.columns.map((c) => c.parts.join("."));
		expect(cols).toContain("arr");
		expect(cols).toContain("hi"); // the defect's observable: previously dropped
	});

	// arr[1:hi]: numeric begin + bare identifier end now parses without parens via the
	// plsqlvariablename alt (un-fused in applySubscriptBracket).
	it("x[1:hi] — numeric begin, bare-identifier end (no parens needed)", () => {
		expect(shapeOf("SELECT arr[1:hi] FROM t;")).toEqual({
			kind: "subscript",
			base: arr,
			index: num(1),
			end: { kind: "column", parts: ["hi"] },
			slice: true,
		});
		const { ast } = parse("SELECT arr[1:hi] FROM t;", "redshift");
		if (ast.body.kind !== "select") throw new Error("expected select");
		expect(ast.body.columns.map((c) => c.parts.join("."))).toEqual(expect.arrayContaining(["arr", "hi"]));
	});

	// arr[lo:hi]: BOTH bounds bare identifiers fuse even more aggressively in Redshift specifically —
	// its own `NamespaceUser: Identifier ':' Identifier` lexer rule (datashare-consumer role refs,
	// `GRANT ... TO IAM:Bob` — real corpus use:
	// redshift/docs/parser/positive/ddl/lake-formation-getting-started-consumer/1.sql) out-munches
	// PLSQLVARIABLENAME and swallows the WHOLE "lo:hi" into one token. A dedicated indirection_el alt
	// accepts that token too; lower() splits its text on the colon to recover both identifiers.
	it("x[lo:hi] — both bounds bare identifiers (the Redshift NamespaceUser fusion)", () => {
		expect(shapeOf("SELECT arr[lo:hi] FROM t;")).toEqual({
			kind: "subscript",
			base: arr,
			index: { kind: "column", parts: ["lo"] },
			end: { kind: "column", parts: ["hi"] },
			slice: true,
		});
		const { ast } = parse("SELECT arr[lo:hi] FROM t;", "redshift");
		if (ast.body.kind !== "select") throw new Error("expected select");
		expect(ast.body.columns.map((c) => c.parts.join("."))).toEqual(expect.arrayContaining(["arr", "lo", "hi"]));
	});

	// arr[:hi] (EMPTY begin, bare-identifier end) is NOT fixed as a slice — deliberately. The fused
	// token here is indistinguishable at the parser level from a bind-variable used as a plain index
	// (the pgbench reading), since there's no preceding bound to disambiguate on. Flipping this
	// reading would change what an ALREADY-PARSING construct means, not just widen acceptance — a
	// semantic priority call between two independently-real features, left to a human decision rather
	// than resolved unilaterally. Current (unchanged) behavior: reads as a plain index whose value is
	// the bind variable `:hi` — NOT a slice — now lowered as a `parameter` node (not a column), since
	// psql/pgbench `:name` interpolation is a caller-bound placeholder, not a column reference
	// (docs.postgresql.org/current/app-psql.html#APP-PSQL-INTERPOLATION).
	it("x[:hi] — still the pre-existing plsqlvariablename-index reading, not fixed (see task report)", () => {
		expect(shapeOf("SELECT arr[:hi] FROM t;")).toEqual({
			kind: "subscript",
			base: arr,
			index: { kind: "parameter", text: ":hi", name: "hi" },
		});
	});

	it("a slice's type is the base's own type (array/string), never the element type", () => {
		const typeOf = (sql: string, schema: Schema) => {
			const tree = resolveScopes(lower(parseRedshift(sql).tree));
			const body = tree.root.body;
			if (body.kind !== "select") throw new Error("expected select");
			return inferType(body.projections[0].expr, tree.root, schema);
		};
		// A slice of array<string> is still array<string> — not the element type "string".
		expect(typeOf("SELECT arr[2:4] FROM t", new Schema({ t: { arr: "array<string>" } }))).toEqual({
			kind: "array",
			element: { kind: "scalar", name: "string" },
		});
		// Plain (non-slice) element access is unaffected by the slice-type rule: array<string>[2] → string.
		expect(typeOf("SELECT arr[2] FROM t", new Schema({ t: { arr: "array<string>" } }))).toEqual({
			kind: "scalar",
			name: "string",
		});
	});
});

// `:name` (PLSQLVARIABLENAME) is psql/pgbench CLIENT-side variable interpolation, not a server-side
// bind parameter (docs.postgresql.org/current/app-psql.html#APP-PSQL-INTERPOLATION), inherited by
// this fork from the Postgres grammar; `$1` is a real server-side positional bind parameter. Both
// previously lowered wrong — `:name` as a plain column (firing a false unknown-column diagnostic),
// `$1` as a literal — so neither participated in the shared parameter/variable consumers (qualify,
// symbols, references; see tests/parameter-ir.test.ts). Both now lower to the `parameter` IR node.
describe("redshift parameter IR — :name / $1", () => {
	function select(sql: string): SelectExpr {
		const body = lower(parseRedshift(sql).tree).body;
		if (body.kind !== "select") throw new Error("expected select");
		return body;
	}

	it(":x lowers to a parameter node in both a SELECT projection and a WHERE comparison", () => {
		const body = select("SELECT :x FROM t WHERE a > :x");
		expect(body.projections[0]?.expr).toMatchObject({ kind: "parameter", text: ":x", name: "x" });
		expect(body.where).toMatchObject({ kind: "binary", right: { kind: "parameter", text: ":x", name: "x" } });
	});

	it("$1 lowers to a parameter node with its ordinal, in both a projection and a WHERE comparison", () => {
		const body = select("SELECT $1 FROM t WHERE a > $2");
		expect(body.projections[0]?.expr).toMatchObject({ kind: "parameter", text: "$1", ordinal: 1 });
		expect(body.where).toMatchObject({ kind: "binary", right: { kind: "parameter", text: "$2", ordinal: 2 } });
	});

	it("a schema-attached qualify fires zero unknown-column diagnostics for :x used twice", () => {
		const scopes = resolveScopes(parse("SELECT :x FROM t WHERE a > :x", "redshift").ast, "redshift");
		expect(qualify(scopes, new Schema({ t: { a: "int" } })).diagnostics).toEqual([]);
	});

	it("deriveSymbols emits a parameter symbol, not a phantom column, for :x", () => {
		const scopes = resolveScopes(parse("SELECT :x FROM t WHERE a > :x", "redshift").ast, "redshift");
		const syms = deriveSymbols(scopes, new Schema({ t: { a: "int" } }));
		const paramSyms = syms.filter((s) => s.name === "x");
		expect(paramSyms).toHaveLength(2);
		for (const s of paramSyms) expect(s.kind).toBe("parameter");
		expect(syms.some((s) => s.kind === "column" && s.name === "x")).toBe(false);
	});

	it("referencesAt groups the two :x occurrences", () => {
		const sql = "SELECT :x FROM t WHERE a > :x";
		const scopes = resolveScopes(parse(sql, "redshift").ast, "redshift");
		const occ = referencesAt(scopes, sql.indexOf(":x"));
		expect(occ).not.toBeNull();
		expect(occ!.kind).toBe("parameter");
		expect(occ!.occurrences).toHaveLength(2);
	});
});
