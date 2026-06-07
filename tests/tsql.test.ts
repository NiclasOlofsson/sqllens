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

	it("strips [bracketed] identifiers", () => {
		const { q } = ir("SELECT [a] FROM [dbo].[t]");
		if (q.body.kind !== "select") throw new Error("select");
		expect(q.body.from[0]).toMatchObject({ kind: "table", name: ["dbo", "t"] });
		expect(q.body.projections[0].expr).toMatchObject({ kind: "column", parts: ["a"] });
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
