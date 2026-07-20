import { describe, expect, it } from "vitest";
import { inferType } from "../src/infer/infer.js";
import { lineage } from "../src/lineage/lineage.js";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";
import { lower } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";

// The whole point of T-SQL as the second dialect: the semantic layer (scope, qualify, infer,
// lineage, symbols) is dialect-agnostic — it runs on the shared IR. Only the grammar and lower()
// are T-SQL-specific. These tests prove a T-SQL query flows through every semantic stage, so a
// regression in the T-SQL lowering (not just "it parses") is caught.

function ir(sql: string) {
	const { tree, errors } = parseTSql(sql);
	return { q: lower(tree), errors };
}
function scopes(sql: string) {
	return resolveScopes(lower(parseTSql(sql).tree), "tsql");
}
function origins(sql: string, output: string, schema = new Schema({})): string[] {
	const col = lineage(scopes(sql), schema).find((c) => c.output === output);
	return (col?.origins ?? []).map((o) => `${o.table.join(".")}.${o.column}`).sort();
}
function typeOf(sql: string, schema: Schema) {
	const tree = scopes(sql);
	const body = tree.root.body;
	if (body.kind !== "select") throw new Error("expected select");
	return inferType(body.projections[0].expr, tree.root, schema);
}

describe("T-SQL lower -> IR", () => {
	it("lowers a basic SELECT to a select body with projections and a table source", () => {
		const { q, errors } = ir("SELECT a, b FROM t");
		expect(errors).toBe(0);
		expect(q.body.kind).toBe("select");
		if (q.body.kind !== "select") return;
		expect(q.body.projections.map((p) => p.name)).toEqual(["a", "b"]);
		expect(q.body.from).toHaveLength(1);
		expect(q.body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t"] } });
	});

	it("captures a column alias and a table alias", () => {
		const { q } = ir("SELECT t.a AS x FROM tbl AS t");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.projections[0].name).toBe("x");
		expect(q.body.projections[0].expr).toMatchObject({ kind: "column", parts: ["t", "a"] });
		expect(q.body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["tbl"] }, alias: "t" });
	});

	it("models a WHERE predicate as a binary comparison", () => {
		const { q } = ir("SELECT a FROM t WHERE a > 1");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.where).toMatchObject({ kind: "binary", op: ">" });
		expect(q.body.columns.some((c) => c.clause === "where" && c.parts.join(".") === "a")).toBe(true);
	});

	it("keeps [bracketed] identifiers RAW in the IR (identity via foldIdentifier, not stripping)", () => {
		// Task 2 (quotedness survives lowering): delimiters stay in the IR; comparisons fold
		// ([a] ≡ a under T-SQL's default-CI fold), display goes through displayName.
		const { q } = ir("SELECT [a] FROM [dbo].[t]");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["dbo", "t"] } });
		expect(q.body.projections[0].expr).toMatchObject({ kind: "column", parts: ["[a]"] });
	});

	it("models a JOIN with two sources and an ON condition", () => {
		const { q } = ir("SELECT a FROM t1 JOIN t2 ON t1.id = t2.id");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.from.map((s) => (s.kind === "table" ? s.relation.parts.join(".") : "?"))).toEqual(["t1", "t2"]);
		expect(q.body.joinConditions?.[0]).toMatchObject({ kind: "binary", op: "=" });
	});

	it("models a CTE", () => {
		const { q } = ir("WITH c AS (SELECT a FROM t) SELECT a FROM c");
		expect(q.ctes.map((c) => c.name)).toEqual(["c"]);
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["c"] } });
	});

	it("models a UNION as a set operation", () => {
		const { q } = ir("SELECT a FROM t UNION SELECT b FROM u");
		expect(q.body.kind).toBe("setop");
		if (q.body.kind !== "setop") return;
		expect(q.body.op).toBe("union");
	});

	it("flags an aggregate query and a CAST", () => {
		const agg = ir("SELECT COUNT(*) AS n FROM t");
		if (agg.q.body.kind !== "select") throw new Error("select");
		expect(agg.q.body.aggregated).toBe(true);

		const cast = ir("SELECT CAST(a AS int) AS x FROM t");
		if (cast.q.body.kind !== "select") throw new Error("select");
		expect(cast.q.body.projections[0].expr).toMatchObject({ kind: "cast" });
	});

	it("leaves no expression as an unmodelled `other` node for the core query path", () => {
		const { q } = ir(
			"SELECT t.a AS x, b + 1 AS y, CASE WHEN a > 0 THEN 'p' ELSE 'n' END AS s FROM t WHERE a > 1 AND b < 2",
		);
		if (q.body.kind !== "select") throw new Error("select");
		const kinds = q.body.projections.map((p) => p.expr.kind);
		expect(kinds).not.toContain("other");
	});
});

// The collapsed primitive_expression/primitive_constant case used to lower `@x`, `@@sysvar`, and
// `?` all to one indistinguishable `literal` node. Split per the parameter/variable IR (ir.ts,
// tests/parameter-ir.test.ts): LOCAL_ID is a session/local variable (double-`@` = system), a bare
// `?` is a caller-bound parameter marker. Everything else in the collapsed case (NULL/DEFAULT/
// string/numeric/money literals) is untouched.
describe("T-SQL lower -> IR: parameter/variable split", () => {
	it("lowers a local variable `@x` to a variable node", () => {
		const { q } = ir("SELECT @x");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.projections[0].expr).toMatchObject({ kind: "variable", text: "@x", name: "x" });
		expect(q.body.projections[0].expr).not.toHaveProperty("system");
	});

	it("lowers a system variable `@@version` to a variable node with system: true", () => {
		const { q } = ir("SELECT @@version");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.projections[0].expr).toMatchObject({
			kind: "variable",
			text: "@@version",
			name: "version",
			system: true,
		});
	});

	it("lowers a bare `?` to a parameter node", () => {
		const { q } = ir("SELECT ?");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.projections[0].expr).toMatchObject({ kind: "parameter", text: "?" });
		expect(q.body.projections[0].expr).not.toHaveProperty("name");
		expect(q.body.projections[0].expr).not.toHaveProperty("ordinal");
	});

	it("leaves other primitive_expression/primitive_constant forms as literals", () => {
		const { q } = ir("SELECT 1, 1.5, 'a', NULL, DEFAULT, $5.00");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.projections.map((p) => p.expr)).toEqual(
			["1", "1.5", "'a'", "NULL", "DEFAULT", "$5.00"].map((text) =>
				expect.objectContaining({ kind: "literal", text }),
			),
		);
	});

	it("a variable used as a function argument lowers to a variable node, not a literal", () => {
		const { q } = ir("SELECT f(@x, @@rowcount, ?)");
		if (q.body.kind !== "select") throw new Error("select");
		const call = q.body.projections[0].expr;
		if (call.kind !== "function") throw new Error("function");
		expect(call.args).toEqual([
			expect.objectContaining({ kind: "variable", name: "x" }),
			expect.objectContaining({ kind: "variable", name: "rowcount", system: true }),
			expect.objectContaining({ kind: "parameter", text: "?" }),
		]);
	});
});

describe("T-SQL flows through the dialect-agnostic semantic layer", () => {
	it("resolveScopes builds sources from the T-SQL IR", () => {
		const tree = scopes("SELECT a FROM t");
		expect(tree.root.sources).toHaveLength(1);
	});

	it("qualify expands SELECT * using the schema", () => {
		const schema = new Schema({ t: { a: "int", b: "string" } });
		const tree = scopes("SELECT * FROM t");
		expect(qualify(tree, schema).columnsOf(tree.root)).toEqual(["a", "b"]);
	});

	it("qualify reports an unknown table", () => {
		const tree = scopes("SELECT * FROM missing");
		expect(qualify(tree, new Schema({ t: { a: "int" } })).diagnostics.map((d) => d.kind)).toContain(
			"unknown-table",
		);
	});

	it("inferType types a literal, a schema column and a cast", () => {
		expect(typeOf("SELECT 42 FROM t", new Schema({}))).toEqual({ kind: "scalar", name: "int" });
		expect(typeOf("SELECT a FROM t", new Schema({ t: { a: "bigint" } }))).toEqual({
			kind: "scalar",
			name: "bigint",
		});
		expect(typeOf("SELECT CAST(a AS int) AS x FROM t", new Schema({}))).toEqual({ kind: "scalar", name: "int" });
	});

	it("lineage traces base, computed and CTE columns to their base tables", () => {
		expect(origins("SELECT a FROM t", "a")).toEqual(["t.a"]);
		expect(origins("SELECT a + b AS c FROM t", "c")).toEqual(["t.a", "t.b"]);
		expect(origins("WITH c AS (SELECT a FROM t) SELECT a FROM c", "a")).toEqual(["t.a"]);
	});

	it("deriveSymbols produces symbols for a T-SQL query", () => {
		const syms = deriveSymbols(scopes("SELECT t.a AS x FROM tbl AS t"));
		expect(syms.length).toBeGreaterThan(0);
		// the table alias `t` and the output column `x` should both surface as symbols
		expect(syms.some((s) => s.name === "t")).toBe(true);
		expect(syms.some((s) => s.name === "x")).toBe(true);
	});
});

// SLL-surgery probes (see .superpowers/sdd/task-3-report.md). Each pins BOTH that the surviving
// forms still parse cleanly AND that the pruned/left-factored decision no longer mispredicts
// (sllFallback === false), plus reject probes for the nearby invalid forms.
describe("T-SQL SLL-surgery — grammar-health probes", () => {
	/** Parses cleanly (0 syntax errors) AND without an SLL→LL bail. */
	function clean(sql: string): void {
		const r = parseTSql(sql);
		expect(r.errors, `expected a clean parse of: ${sql}`).toBe(0);
		expect(r.sllFallback, `expected no SLL→LL fallback on: ${sql}`).toBe(false);
	}
	/** A syntactically invalid form: must still be rejected (errors > 0). */
	function rejected(sql: string): void {
		expect(parseTSql(sql).errors, `expected a syntax error for: ${sql}`).toBeGreaterThan(0);
	}

	// Iteration 1 — declare_statement: the scalar-data_type alternative was a subset of declare_local.
	// Pruning it (and requiring a qualifier on the table-name alternative) keeps every valid DECLARE
	// while ending the `= expr` / `, @v2` mispredict.
	// learn.microsoft.com/en-us/sql/t-sql/language-elements/declare-local-variable-transact-sql
	describe("declare_statement (iter 1)", () => {
		it("declares a scalar variable, with and without an initializer, no fallback", () => {
			clean("DECLARE @ID NVARCHAR(MAX) = N'x';");
			clean("DECLARE @n INT;");
			clean("DECLARE @n AS INT;");
			clean("DECLARE @d DECIMAL(10, 2) = 1.5;");
		});
		it("declares multiple variables in one comma list", () => {
			clean("DECLARE @s AS NVARCHAR(4000), @h AS hierarchyid;");
			clean("DECLARE @a INT, @b VARCHAR(10) = 'x', @c BIT;");
		});
		it("declares a table variable — inline TABLE(...) and a user-defined table type", () => {
			clean("DECLARE @t TABLE (c INT, d VARCHAR(10));");
			clean("DECLARE @t AS dbo.MyTableType;"); // qualified UDT — the declare_as_table_name path
			clean("DECLARE @t MyTableType;"); // bare UDT name — rides declare_local's data_type
		});
		it("rejects a DECLARE with no type and a bare initializer", () => {
			rejected("DECLARE @x;");
			rejected("DECLARE = 5;");
		});
	});

	// Iteration 2 — full_column_name: the qualifier was `(DELETED|INSERTED|full_table_name) '.'`, whose
	// embedded full_table_name forced a deep-lookahead table-vs-column carving (context sensitivity).
	// Left-factored into a bounded local dotted chain; every qualified shape still parses and lowers to
	// the same `{kind:"column", parts:[…]}` (nameParts reads only the id_ leaves).
	// learn.microsoft.com/en-us/sql/t-sql/language-elements/transact-sql-syntax-conventions-transact-sql
	describe("full_column_name (iter 2)", () => {
		/** The `parts` of the single projected column reference. */
		function colParts(sql: string): string[] {
			const q = lower(parseTSql(sql).tree);
			if (q.body.kind !== "select") throw new Error("expected select");
			const e = q.body.projections[0].expr;
			if (e.kind !== "column") throw new Error(`expected a column, got ${e.kind}`);
			return e.parts;
		}
		it("parses 1- through 5-part column references with no fallback", () => {
			clean("SELECT a FROM t");
			clean("SELECT t.a FROM t");
			clean("SELECT s.t.a FROM s.t");
			clean("SELECT d.s.t.a FROM d.s.t");
			clean("SELECT srv.d.s.t.a FROM srv.d.s.t");
		});
		it("preserves the id_-leaf part list for every qualifier depth (IR unchanged)", () => {
			expect(colParts("SELECT a FROM t")).toEqual(["a"]);
			expect(colParts("SELECT t.a FROM t")).toEqual(["t", "a"]);
			expect(colParts("SELECT s.t.a FROM s.t")).toEqual(["s", "t", "a"]);
			expect(colParts("SELECT d.s.t.a FROM d.s.t")).toEqual(["d", "s", "t", "a"]);
			expect(colParts("SELECT srv.d.s.t.a FROM srv.d.s.t")).toEqual(["srv", "d", "s", "t", "a"]);
		});
		it("keeps the omitted-database empty-segment forms (server..schema.table.col)", () => {
			// The only degenerate shape full_table_name produced: an empty 2nd part.
			clean("SELECT d..t.a FROM d..t");
			expect(colParts("SELECT d..t.a FROM d..t")).toEqual(["d", "t", "a"]);
			clean("SELECT srv..s.t.a FROM srv..s.t");
			expect(colParts("SELECT srv..s.t.a FROM srv..s.t")).toEqual(["srv", "s", "t", "a"]);
		});
		it("still parses DELETED/INSERTED-qualified and graph pseudo-columns", () => {
			clean("SELECT DELETED.a FROM t");
			clean("SELECT INSERTED.a FROM t");
			clean("SELECT $IDENTITY FROM t");
			clean("SELECT p.$node_id FROM g AS p");
		});
		it("rejects a dangling-dot column reference", () => {
			rejected("SELECT a. FROM t");
			rejected("SELECT .a FROM t");
		});
	});
});

// Doc-compliance gap-fix wave (2026-07-20 triage over the scraped MS-docs corpus,
// tests/corpus/tsql.test.ts's docs/parser/positive/unparsed/ bucket): each cluster below was a
// documented T-SQL construct absent from the grammar. Every gap is doc-cited at its grammar-rule
// edit; these pin the parse and, for expression-shaped constructs, that lowering lands on a real
// IR node rather than degrading to `other` (the corpus `other` ratchet is 0 for T-SQL).
import { walkIr } from "./helpers/ir-walk.js";

/** Lower `sql`, assert a clean parse, and return the `other`-node tally (empty == fully modelled). */
function otherTally(sql: string): Map<string, number> {
	const r = parseTSql(sql);
	expect(r.errors, sql).toBe(0);
	const tally = new Map<string, number>();
	walkIr(lower(r.tree), tally, new Map());
	return tally;
}

describe("T-SQL doc-compliance gap fixes (2026-07-20 wave)", () => {
	// VECTOR(n, float16|float32) storage-precision parameter:
	// learn.microsoft.com/en-us/sql/t-sql/data-types/vector-data-type
	it("parses VECTOR(n, float16|float32) storage-precision parameter", () => {
		expect(parseTSql("DECLARE @v VECTOR(3, float16) = '[0.1, 2, 30]';").errors).toBe(0);
		expect(parseTSql("CREATE TABLE t (v VECTOR(3, float32));").errors).toBe(0);
		expect(parseTSql("DECLARE @v VECTOR(3);").errors).toBe(0); // unaffected: no precision arg
	});

	// LAG/LEAD ... IGNORE NULLS | RESPECT NULLS OVER (SQL 2022+):
	// learn.microsoft.com/en-us/sql/t-sql/functions/lag-transact-sql (+ lead-transact-sql)
	it("parses LAG/LEAD IGNORE NULLS | RESPECT NULLS and lowers to a function call, not `other`", () => {
		expect(parseTSql("SELECT LAG(c, 1) IGNORE NULLS OVER (ORDER BY a) FROM t;").errors).toBe(0);
		expect(parseTSql("SELECT LEAD(c, 1) RESPECT NULLS OVER (ORDER BY a) FROM t;").errors).toBe(0);
		expect([...otherTally("SELECT LAG(c) IGNORE NULLS OVER (ORDER BY a) FROM t")]).toEqual([]);
	});

	// APPROX_PERCENTILE_CONT/DISC ... WITHIN GROUP, no OVER (SQL 2022+):
	// learn.microsoft.com/en-us/sql/t-sql/functions/approx-percentile-cont-transact-sql (+ disc)
	it("parses APPROX_PERCENTILE_CONT/DISC WITHIN GROUP and lowers to a function call, not `other`", () => {
		expect(
			parseTSql("SELECT APPROX_PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a) FROM t GROUP BY b;").errors,
		).toBe(0);
		expect(
			parseTSql("SELECT APPROX_PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY a) FROM t GROUP BY b;").errors,
		).toBe(0);
		expect([...otherTally("SELECT APPROX_PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a) FROM t")]).toEqual([]);
	});

	describe("ODBC escape sequences", () => {
		// {fn scalar_function(...)}: learn.microsoft.com/en-us/sql/t-sql/functions/odbc-scalar-functions-transact-sql
		it("parses {fn NAME(args)} and lowers to a function call, not `other`", () => {
			expect(parseTSql("SELECT {fn OCTET_LENGTH(a)} FROM t;").errors).toBe(0);
			expect([...otherTally("SELECT {fn OCTET_LENGTH(a)} FROM t")]).toEqual([]);
		});
		it("parses ODBC names that are reserved T-SQL keywords elsewhere (TRUNCATE, CURRENT_DATE, CURRENT_TIME)", () => {
			expect(parseTSql("SELECT {fn TRUNCATE(a, 2)} FROM t;").errors).toBe(0);
			expect(parseTSql("SELECT {fn CURRENT_DATE()};").errors).toBe(0);
			expect(parseTSql("SELECT {fn CURRENT_TIME(6)};").errors).toBe(0);
		});
		// {GUID '...'}: learn.microsoft.com/en-us/sql/odbc/reference/appendixes/guid-escape-sequences
		it("parses {GUID '...'} and lowers to a cast of the literal to uniqueidentifier", () => {
			const r = parseTSql("SELECT a FROM t WHERE a = { GUID '92C4279F-1207-48A3-8448-4636514EB7E2' };");
			expect(r.errors).toBe(0);
			const q = lower(r.tree);
			if (q.body.kind !== "select") throw new Error("select");
			expect(q.body.where).toMatchObject({
				kind: "binary",
				right: { kind: "cast", typeText: "uniqueidentifier" },
			});
		});
	});

	describe("spatial / CLR bare property access", () => {
		// .Lat/.Long/.Z/.M/.HasZ/.HasM/.STSrid/.STX/.STY without parens:
		// learn.microsoft.com/en-us/sql/t-sql/spatial-geography/lat-geography-data-type (+ sibling pages)
		it("parses an instance bare property and lowers to a function call, not `other`", () => {
			expect(parseTSql("SELECT @g.Lat, @g.Long, @g.STSrid, @g.STX, @g.HasZ FROM t;").errors).toBe(0);
			expect([...otherTally("SELECT @g.Lat FROM t")]).toEqual([]);
		});
		// Static bare property, e.g. geography::[Null]:
		// learn.microsoft.com/en-us/sql/t-sql/spatial-geography/null-geography-data-type (+ geometry sibling)
		it("parses a static bare property (geography::[Null] / geometry::[Null])", () => {
			expect(parseTSql("SET @g = geography::[Null];").errors).toBe(0);
			expect(parseTSql("SET @g = geometry::[Null];").errors).toBe(0);
		});
		it("still parses a static method call with parens and arguments", () => {
			expect(parseTSql("SET @g = geography::STGeomFromText('POINT(1 1)', 4326);").errors).toBe(0);
		});
		// learn.microsoft.com/en-us/sql/t-sql/language-elements/set-local-variable-transact-sql Example F
		it("allows a bare property on both sides of an assignment (Point.X)", () => {
			expect(parseTSql("SET @p.X = @p.X + 1.1;").errors).toBe(0);
		});
	});

	// VECTOR_SEARCH TOP(N) WITH APPROXIMATE / WITH (FORCE_ANN_ONLY) hint:
	// learn.microsoft.com/en-us/sql/t-sql/functions/vector-search-transact-sql
	it("parses SELECT TOP(N) WITH APPROXIMATE and a VECTOR_SEARCH source WITH (FORCE_ANN_ONLY)", () => {
		const sql = `
			SELECT TOP (10) WITH APPROXIMATE t.id, r.distance
			FROM VECTOR_SEARCH(TABLE = t, COLUMN = v, SIMILAR_TO = @qv, METRIC = 'cosine') AS r WITH (FORCE_ANN_ONLY)
			ORDER BY r.distance;
		`;
		expect(parseTSql(sql).errors).toBe(0);
	});

	describe("nested CTEs", () => {
		// A WITH inside another CTE's own AS (...) body is supported; the same WITH inside a general
		// subquery is documented to fail (Msg 156) and must stay rejected.
		// learn.microsoft.com/en-us/sql/t-sql/queries/nested-common-table-expression
		it("parses a WITH nested inside a CTE body and threads the inner CTEs onto that CTE's own scope", () => {
			const r = parseTSql(
				"WITH outer_cte AS (WITH inner_cte AS (SELECT a FROM t) SELECT a FROM inner_cte) SELECT a FROM outer_cte;",
			);
			expect(r.errors).toBe(0);
			const q = lower(r.tree);
			expect(q.ctes.map((c) => c.name)).toEqual(["outer_cte"]);
			expect(q.ctes[0].body.ctes.map((c) => c.name)).toEqual(["inner_cte"]);
		});
		it("still rejects a WITH nested inside a general (non-CTE) subquery", () => {
			expect(parseTSql("SELECT * FROM (WITH c AS (SELECT a FROM t) SELECT a FROM c) AS s;").errors).toBeGreaterThan(
				0,
			);
		});
	});

	// SELECT ... INTO new_table ON filegroup (SQL Server 2016 SP2+):
	// learn.microsoft.com/en-us/sql/t-sql/queries/select-into-clause-transact-sql
	it("parses SELECT ... INTO new_table ON filegroup", () => {
		expect(parseTSql("SELECT * INTO dbo.t2 ON FG2 FROM dbo.t1;").errors).toBe(0);
	});

	// ||= concatenation compound-assignment operator (SQL 2025):
	// learn.microsoft.com/en-us/sql/t-sql/language-elements/compound-assignment-pipes-transact-sql
	it("parses the ||= concatenation compound-assignment operator", () => {
		expect(parseTSql("DECLARE @v varchar(10) = 'a'; SET @v ||= 'b';").errors).toBe(0);
	});

	// EXECUTE AS ... WITH COOKIE INTO @var / WITH NO REVERT, and REVERT WITH COOKIE:
	// learn.microsoft.com/en-us/sql/t-sql/statements/execute-as-transact-sql (+ revert-transact-sql)
	it("parses EXECUTE AS ... WITH COOKIE INTO @var / WITH NO REVERT, and REVERT WITH COOKIE", () => {
		expect(parseTSql("EXECUTE AS USER = 'user1' WITH COOKIE INTO @cookie;").errors).toBe(0);
		expect(parseTSql("EXECUTE AS USER = 'user1' WITH NO REVERT;").errors).toBe(0);
		expect(parseTSql("REVERT WITH COOKIE = @cookie;").errors).toBe(0);
	});
});
