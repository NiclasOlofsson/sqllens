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
		expect(q.body.from[0]).toMatchObject({ kind: "table", name: ["t"] });
	});

	it("captures a column alias and a table alias", () => {
		const { q } = ir("SELECT t.a AS x FROM tbl AS t");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.projections[0].name).toBe("x");
		expect(q.body.projections[0].expr).toMatchObject({ kind: "column", parts: ["t", "a"] });
		expect(q.body.from[0]).toMatchObject({ kind: "table", name: ["tbl"], alias: "t" });
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
		expect(q.body.from[0]).toMatchObject({ kind: "table", name: ["[dbo]", "[t]"] });
		expect(q.body.projections[0].expr).toMatchObject({ kind: "column", parts: ["[a]"] });
	});

	it("models a JOIN with two sources and an ON condition", () => {
		const { q } = ir("SELECT a FROM t1 JOIN t2 ON t1.id = t2.id");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.from.map((s) => (s.kind === "table" ? s.name.join(".") : "?"))).toEqual(["t1", "t2"]);
		expect(q.body.joinConditions?.[0]).toMatchObject({ kind: "binary", op: "=" });
	});

	it("models a CTE", () => {
		const { q } = ir("WITH c AS (SELECT a FROM t) SELECT a FROM c");
		expect(q.ctes.map((c) => c.name)).toEqual(["c"]);
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.from[0]).toMatchObject({ kind: "table", name: ["c"] });
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
