import { describe, expect, it } from "vitest";
import { parseDatabricks } from "../src/databricks/parse.js";
import { lower } from "../src/databricks/lower.js";
import type { QueryBody, SelectExpr } from "../src/ir/ir.js";
import { analyze } from "../src/index.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";

function asSelect(body: QueryBody): SelectExpr {
	if (body.kind !== "select") throw new Error("expected a select body");
	return body;
}

describe("lower: CST -> IR", () => {
	it("lowers a simple SELECT to a SelectExpr with projections and a table source", () => {
		const { tree, errors } = parseDatabricks("SELECT a FROM t");
		expect(errors).toBe(0);

		const ir = lower(tree);
		expect(ir.body.kind).toBe("select");
		if (ir.body.kind !== "select") throw new Error("expected a select body");

		expect(ir.body.projections.map((p) => p.name)).toEqual(["a"]);
		expect(ir.body.from).toHaveLength(1);
		expect(ir.body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t"] } });
	});

	it("models a top-level LIMIT / OFFSET (queryOrganization, not just the pipe-stage form)", () => {
		const { tree, errors } = parseDatabricks("SELECT a FROM t ORDER BY a LIMIT 10 OFFSET 5");
		expect(errors).toBe(0);
		const ir = lower(tree);
		expect(ir.orderBy).toHaveLength(1);
		expect(ir.limit?.top).toMatchObject({ kind: "literal", text: "10" });
		expect(ir.limit?.offset).toMatchObject({ kind: "literal", text: "5" });
	});

	// docs.databricks.com/en/sql/language-manual/sql-ref-syntax-qry-select-limit.html — LIMIT ALL is
	// Spark's documented no-cap spelling: the clause is present but carries no row-count expression.
	it("models LIMIT ALL as a present-but-unbounded clause", () => {
		const { tree, errors } = parseDatabricks("SELECT a FROM t LIMIT ALL");
		expect(errors).toBe(0);
		const ir = lower(tree);
		expect(ir.limit).toBeDefined();
		expect(ir.limit?.top).toBeUndefined();
	});

	it("does not throw on a non-query statement; flags it as non-query", () => {
		const ir = lower(parseDatabricks("CREATE TABLE t (a INT, b STRING)").tree);
		const sel = asSelect(ir.body);
		expect(sel.from).toEqual([]);
		expect(sel.unsupported).toContain("non-query");
	});

	it("models * EXCEPT (…) as a star exclusion", () => {
		const { tree, errors } = parseDatabricks("SELECT * EXCEPT (a, b) FROM t");
		expect(errors).toBe(0);
		const sel = asSelect(lower(tree).body);
		expect(sel.projections[0].expr).toMatchObject({ kind: "star", exclude: ["a", "b"] });
	});

	it("models QUALIFY (Databricks SQL) with clause-tagged column refs", () => {
		const { tree, errors } = parseDatabricks(
			"SELECT a, row_number() OVER (ORDER BY a) AS rn FROM t QUALIFY rn = 1",
		);
		expect(errors).toBe(0);
		const sel = asSelect(lower(tree).body);
		expect(sel.qualify).toMatchObject({ kind: "binary", op: "=" });
		expect(sel.columns.some((c) => c.clause === "qualify" && c.parts.join(".") === "rn")).toBe(true);
	});

	it("lowers a WITH clause into CteDefs with a name and a query body", () => {
		const { tree, errors } = parseDatabricks("WITH c AS (SELECT 1 AS x) SELECT a FROM c");
		expect(errors).toBe(0);

		const ir = lower(tree);
		expect(ir.ctes).toHaveLength(1);
		expect(ir.ctes[0].name).toBe("c");
		expect(ir.ctes[0].body.kind).toBe("query");
		expect(ir.ctes[0].body.body.kind).toBe("select");

		// The main query still resolves its own FROM independently of the CTE body.
		expect(asSelect(ir.body).from).toMatchObject([{ kind: "table", relation: { parts: ["c"] } }]);
	});

	it("captures a table alias", () => {
		const ir = lower(parseDatabricks("SELECT x FROM t AS a").tree);
		expect(asSelect(ir.body).from).toMatchObject([{ kind: "table", relation: { parts: ["t"] }, alias: "a" }]);
	});

	it("captures both relations of a JOIN as separate sources", () => {
		const ir = lower(parseDatabricks("SELECT x FROM a JOIN b ON a.id = b.id").tree);
		expect(asSelect(ir.body).from).toMatchObject([
			{ kind: "table", relation: { parts: ["a"] } },
			{ kind: "table", relation: { parts: ["b"] } },
		]);
	});

	it("treats a derived table as a subquery source without leaking its inner tables", () => {
		const ir = lower(parseDatabricks("SELECT x FROM (SELECT a FROM t) sub").tree);
		const select = asSelect(ir.body);
		expect(select.from).toHaveLength(1);
		const src = select.from[0];
		expect(src.kind).toBe("subquery");
		if (src.kind !== "subquery") throw new Error("expected a subquery source");
		expect(src.alias).toBe("sub");
		expect(src.query.body.kind).toBe("select");
		if (src.query.body.kind !== "select") throw new Error("expected select");
		expect(src.query.body.from).toMatchObject([{ kind: "table", relation: { parts: ["t"] } }]);
	});

	it("names an implicit projection alias (no AS)", () => {
		const sel = asSelect(lower(parseDatabricks("SELECT a x FROM t").tree).body);
		expect(sel.projections[0].name).toBe("x");
	});

	it("captures an implicit table alias (no AS)", () => {
		const sel = asSelect(lower(parseDatabricks("SELECT a FROM t u").tree).body);
		expect(sel.from[0]).toMatchObject({ kind: "table", alias: "u" });
	});

	it("captures CTE column aliases", () => {
		const ir = lower(parseDatabricks("WITH c (x, y) AS (SELECT a, b FROM t) SELECT a FROM c").tree);
		expect(ir.ctes[0].columnAliases).toEqual(["x", "y"]);
	});

	it("captures table column aliases", () => {
		const sel = asSelect(lower(parseDatabricks("SELECT a FROM t AS u (c1, c2)").tree).body);
		expect(sel.from[0]).toMatchObject({ kind: "table", alias: "u", columnAliases: ["c1", "c2"] });
	});

	it("names a qualified column by its last part (structurally, not by regex)", () => {
		const sel = asSelect(lower(parseDatabricks("SELECT t.col, a.b.c FROM t").tree).body);
		expect(sel.projections.map((p) => p.name)).toEqual(["col", "c"]);
	});

	it("gives a compound expression no inferred name", () => {
		const sel = asSelect(lower(parseDatabricks("SELECT a + b FROM t").tree).body);
		expect(sel.projections[0].name).toBeUndefined();
		expect(sel.projections[0].isStar).toBe(false);
	});

	it("flags a qualified star (t.*) as a star", () => {
		const sel = asSelect(lower(parseDatabricks("SELECT t.* FROM t").tree).body);
		expect(sel.projections[0].isStar).toBe(true);
	});

	it("uses the query's own FROM, not a scalar subquery's in the SELECT list", () => {
		const sel = asSelect(lower(parseDatabricks("SELECT (SELECT x FROM inner_t) AS s, a FROM main_t").tree).body);
		expect(sel.from).toMatchObject([{ kind: "table", relation: { parts: ["main_t"] } }]);
	});

	it("does not count a scalar subquery's inner projection as a top-level projection", () => {
		const sel = asSelect(lower(parseDatabricks("SELECT (SELECT x FROM inner_t) AS s, a FROM main_t").tree).body);
		expect(sel.projections.map((p) => p.name)).toEqual(["s", "a"]);
	});

	it("does not treat a subquery in a JOIN/WHERE condition as a FROM source", () => {
		const sel = asSelect(
			lower(parseDatabricks("SELECT a FROM t JOIN u ON t.id IN (SELECT id FROM other)").tree).body,
		);
		expect(sel.from).toMatchObject([
			{ kind: "table", relation: { parts: ["t"] } },
			{ kind: "table", relation: { parts: ["u"] } },
		]);
	});

	it("collects column references at the select level (projections + WHERE)", () => {
		const sel = asSelect(lower(parseDatabricks("SELECT a, t.b FROM t WHERE c > 1").tree).body);
		expect(sel.columns.map((c) => c.parts.join("."))).toEqual(expect.arrayContaining(["a", "t.b", "c"]));
	});

	it("does not collect column references from inside a subquery", () => {
		const sel = asSelect(lower(parseDatabricks("SELECT x FROM (SELECT inner_col FROM t) s").tree).body);
		expect(sel.columns.map((c) => c.parts.join("."))).not.toContain("inner_col");
	});

	it("models LATERAL VIEW as a source exposing its AS columns", () => {
		const sel = asSelect(lower(parseDatabricks("SELECT a FROM t LATERAL VIEW explode(arr) v AS col").tree).body);
		expect(sel.from.find((s) => s.kind === "lateral")).toMatchObject({
			kind: "lateral",
			alias: "v",
			columns: ["col"],
		});
	});

	it("captures a PIVOT's value columns, FOR column, and aggregate columns", () => {
		const sel = asSelect(
			lower(parseDatabricks("SELECT * FROM t PIVOT (max(val) FOR seg IN ('a' AS a, 'b' AS b))").tree).body,
		);
		expect(sel.pivot).toMatchObject({ values: ["a", "b"], forColumns: ["seg"], aggColumns: ["val"] });
	});

	it("captures an UNPIVOT's value, name, and removed columns", () => {
		const sel = asSelect(lower(parseDatabricks("SELECT * FROM t UNPIVOT (amt FOR mon IN (jan, feb))").tree).body);
		expect(sel.unpivot).toMatchObject({ valueColumn: "amt", nameColumn: "mon", removed: ["jan", "feb"] });
	});

	it("lowers a set operation into a SetOpExpr with both branches", () => {
		const ir = lower(parseDatabricks("SELECT a FROM t UNION ALL SELECT b FROM u").tree);
		expect(ir.body.kind).toBe("setop");
		if (ir.body.kind !== "setop") throw new Error("expected a setop body");

		expect(ir.body.op).toBe("union");
		expect(ir.body.all).toBe(true);
		expect(ir.body.left.kind).toBe("select");
		expect(ir.body.right.kind).toBe("select");
		if (ir.body.left.kind !== "select" || ir.body.right.kind !== "select") throw new Error("selects");
		expect(ir.body.left.from).toMatchObject([{ kind: "table", relation: { parts: ["t"] } }]);
		expect(ir.body.right.from).toMatchObject([{ kind: "table", relation: { parts: ["u"] } }]);
	});
});

// Issue #4 — the deferred grammar constructs. Each doc-cited to docs.databricks.com; a parse
// assertion (the grammar accepts it) plus an IR assertion (it lowers to sane, conservation-visible
// shape). https://github.com/NiclasOlofsson/sqllens/issues/4
describe("issue #4 constructs", () => {
	it("(1) accepts WITH (CREDENTIAL <name>) on a path-based table reference", () => {
		// https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-qry-select-table-reference
		expect(parseDatabricks("SELECT count(1) FROM `delta`.`s3://d/f` WITH (CREDENTIAL my_cred)").errors).toBe(0);
		// no-space form `WITH(CREDENTIAL ...)`, and used as a real credential name that is a keyword-ish word
		expect(parseDatabricks("SELECT * FROM `csv`.`x.csv` WITH(CREDENTIAL some_credential)").errors).toBe(0);
		// CREDENTIAL stays usable as an ordinary identifier (non-reserved)
		expect(parseDatabricks("SELECT credential FROM t").errors).toBe(0);
	});

	it("(2) pipes an inline aliased VALUES relation through |> AS then |> SELECT", () => {
		// https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-qry-select-pipeop
		const r = parseDatabricks("VALUES (0, 1) tab(col1, col2)\n  |> AS new_tab\n  |> SELECT col1 + col2");
		expect(r.errors).toBe(0);
	});

	it("(3) accepts the ?:: try-cast operator and lowers it to a try-flagged cast", () => {
		// https://docs.databricks.com/aws/en/sql/language-manual/functions/questiondoublecolonsign
		const { tree, errors } = parseDatabricks("SELECT NULL?::STRING");
		expect(errors).toBe(0);
		const e = asSelect(lower(tree).body).projections[0].expr;
		expect(e).toMatchObject({ kind: "cast", typeText: "STRING", try: true });
	});

	it("(3) accepts ?:: after a variant colon-path (try_variant_get docs example)", () => {
		const { errors } = parseDatabricks(`SELECT '{"key": 123, "data": [4]}':data[1].a ?::STRING`);
		expect(errors).toBe(0);
	});

	it("(3) marks TRY_CAST(x AS t) as a try cast too", () => {
		const sel = asSelect(lower(parseDatabricks("SELECT TRY_CAST(x AS INT) FROM t").tree).body);
		expect(sel.projections[0].expr).toMatchObject({ kind: "cast", typeText: "INT", try: true });
	});

	it("(4) accepts `expr : <complex type>` type ascription and lowers it to a cast", () => {
		// https://docs.databricks.com/aws/en/sql/language-manual/functions/from_avro
		const { tree, errors } = parseDatabricks("SELECT NULL:MAP<STRING, STRING>");
		expect(errors).toBe(0);
		const e = asSelect(lower(tree).body).projections[0].expr;
		expect(e).toMatchObject({ kind: "cast", typeText: "MAP<STRING,STRING>" });
		// a type ascription is not a try cast
		expect(e && "try" in e && e.try).toBeFalsy();
	});

	it("(4) does NOT read a bare variant colon-path as a type ascription", () => {
		// The disambiguation must not regress the variant `:` path (heavy in the Oatly corpus):
		// `c:field` and even `c:map` (a field named like a type, no `<...>`) stay variant paths.
		expect(parseDatabricks("SELECT c:field.sub FROM t").errors).toBe(0);
		expect(parseDatabricks("SELECT c:map FROM t").errors).toBe(0);
		const e = asSelect(lower(parseDatabricks("SELECT c:field.sub FROM t").tree).body).projections[0].expr;
		expect(e?.kind).not.toBe("cast");
	});

	it("(5) captures named-argument names on the function IR (name => value)", () => {
		// https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-create-sql-function
		const sel = asSelect(lower(parseDatabricks("SELECT http_request(conn => 'x', method => 'POST')").tree).body);
		expect(sel.projections[0].expr).toMatchObject({
			kind: "function",
			name: "http_request",
			argNames: ["conn", "method"],
		});
	});

	it("(5) leaves a fully positional call with no argNames field", () => {
		const sel = asSelect(lower(parseDatabricks("SELECT concat(a, b) FROM t").tree).body);
		const e = sel.projections[0].expr;
		expect(e?.kind).toBe("function");
		expect(e && "argNames" in e).toBe(false);
	});

	it("(6) accepts COLLATION FOR(expr) and lowers it to a unary function", () => {
		// https://docs.databricks.com/aws/en/sql/language-manual/functions/collation
		const { tree, errors } = parseDatabricks("SELECT COLLATION FOR(c1) FROM v");
		expect(errors).toBe(0);
		const e = asSelect(lower(tree).body).projections[0].expr;
		expect(e).toMatchObject({ kind: "function", name: "collation for" });
		expect(e && e.kind === "function" && e.args).toHaveLength(1);
	});
});

describe("batch parse entry (issue #1)", () => {
	it("accepts a multi-statement batch with zero syntax errors", () => {
		expect(parseDatabricks("SELECT 1; SELECT 2").errors).toBe(0);
		expect(parseDatabricks("SELECT 1;;\nSELECT 2;").errors).toBe(0);
	});
	it("lowers a multi-statement batch as one flagged compound (parity with the other dialects)", () => {
		const ir = lower(parseDatabricks("SELECT 1; SELECT 2").tree);
		expect(ir.statement).toBe("compound");
		expect(ir.body.kind === "select" && ir.body.unsupported).toContain("multi-statement");
	});
	it("a single statement with trailing semicolons still lowers fully", () => {
		const ir = lower(parseDatabricks("SELECT a FROM t;").tree);
		expect(ir.body.kind).toBe("select");
		expect(ir.body.kind === "select" && (ir.body.unsupported ?? [])).toEqual([]);
	});
	it("a BEGIN…END compound still parses and flags as compound", () => {
		const r = parseDatabricks("BEGIN SELECT 1; END");
		expect(r.errors).toBe(0);
		const ir = lower(r.tree);
		expect(ir.statement).toBe("compound");
	});
	it("empty input parses clean and lowers flagged empty (an editor opens empty files)", () => {
		const r = parseDatabricks("");
		expect(r.errors).toBe(0);
		const ir = lower(r.tree);
		expect(ir.body.kind === "select" && ir.body.unsupported).toContain("empty");
	});
	it("contains an error to its own statement — later statements still lex", () => {
		const r = parseDatabricks("SELECT 1;\nSELEC 2;\nSELECT 3;");
		expect(r.errors).toBeGreaterThan(0);
		// the token stream covers the WHOLE text (statement containment, editor mandate)
		const last = r.tokens[r.tokens.length - 1];
		expect(last.text).toBe(";");
		// SyntaxDiagnostic.line is 1-based (src/parse-diagnostics.ts); the broken `SELEC 2`
		// is on the second source line, so the first diagnostic reports line 2.
		expect(r.diagnostics[0].line).toBe(2);
	});
});

// `?` and `:name` are Databricks' caller-bound parameter markers
// (docs.databricks.com/en/sql/language-manual/sql-ref-parameter-marker.html), grammar alts
// #posParameterLiteral / #namedParameterLiteral of `constant`, both collapsing through
// ConstantDefaultContext — this pins the `parameter` IR lowering (src/ir/ir.ts). Databricks has no
// documented `variable` (session/local) form of its own.
function selectBody(sql: string): SelectExpr {
	const r = parseDatabricks(sql);
	expect(r.errors, sql).toBe(0);
	return asSelect(lower(r.tree).body);
}

describe("Databricks parameter references", () => {
	it("lowers a bare `?` to a parameter node in SELECT and WHERE position, no name/ordinal", () => {
		const body = selectBody("SELECT ? FROM t WHERE a = ?");
		expect(body.projections[0].expr).toMatchObject({ kind: "parameter", text: "?" });
		expect((body.projections[0].expr as { name?: string }).name).toBeUndefined();
		expect((body.where as { right?: unknown }).right).toMatchObject({ kind: "parameter", text: "?" });
	});

	it("lowers `:name` to a named parameter node in SELECT and WHERE position", () => {
		const body = selectBody("SELECT :who FROM t WHERE a = :who");
		expect(body.projections[0].expr).toMatchObject({ kind: "parameter", text: ":who", name: "who" });
		expect((body.where as { right?: unknown }).right).toMatchObject({
			kind: "parameter",
			text: ":who",
			name: "who",
		});
	});

	it("IDENTIFIER(:p) stays a function call, its argument still a real parameter node", () => {
		const body = selectBody("SELECT IDENTIFIER(:p) FROM t");
		expect(body.projections[0].expr).toMatchObject({
			kind: "function",
			name: "IDENTIFIER",
			args: [{ kind: "parameter", text: ":p", name: "p" }],
		});
	});

	it("fires no unknown-column diagnostic on a schema-attached analyze for either form", () => {
		const schema = new Schema({ t: { a: "int", b: "string" } });
		const { diagnostics } = analyze("SELECT ?, :who, a FROM t WHERE a = ? AND b = :who", "databricks", { schema });
		expect(diagnostics).toEqual([]);
	});

	it("as a call argument, is an unknown-typed operand: curated abs's numeric check stays silent", () => {
		const schema = new Schema({ t: { a: "int" } });
		const { diagnostics } = analyze("SELECT abs(?), abs(:x) FROM t", "databricks", { schema });
		const kinds = diagnostics.map((d) => d.kind);
		expect(kinds).not.toContain("wrong-arity");
		expect(kinds).not.toContain("wrong-argument-type");
	});

	it("deriveSymbols emits parameter kinds, one Sym per occurrence", () => {
		const r = parseDatabricks("SELECT ?, :who FROM t");
		const scopes = resolveScopes(lower(r.tree), "databricks");
		const syms = deriveSymbols(scopes).filter((s) => s.kind === "parameter");
		expect(syms.map((s) => [s.kind, s.name])).toEqual([
			["parameter", "?"],
			["parameter", "who"],
		]);
		expect(syms.every((s) => s.modifiers.includes("reference"))).toBe(true);
	});
});
