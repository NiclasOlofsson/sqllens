import { describe, expect, it } from "vitest";
import type { GraphTableSource, SelectExpr } from "../src/ir/ir.js";
import { lower } from "../src/bigquery/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";

// BigQuery graph (GQL) is modelled faithfully: a GraphTableSource keeps the property-graph name, the
// MATCH element variables (nodes/edges + labels + direction, with spans), the WHERE, and the output
// columns (COLUMNS / RETURN). The element variables are the graph query's own relation namespace.

function graphSource(sql: string): GraphTableSource {
	const r = parseBigQuery(sql);
	expect(r.errors, sql).toBe(0);
	const body = lower(r.tree).body as SelectExpr;
	expect(body.kind).toBe("select");
	const src = body.from[0];
	expect(src?.kind).toBe("graphtable");
	return src as GraphTableSource;
}

describe("BigQuery graph (GQL) — faithful GraphTableSource model", () => {
	it("models GRAPH_TABLE(... MATCH ... COLUMNS ...) with element variables and output columns", () => {
		const src = graphSource(
			"SELECT * FROM GRAPH_TABLE(fg MATCH (a:Person)-[e:Knows]->(b:Person) COLUMNS(a.name AS src, b.name AS dst))",
		);
		expect(src.graph).toEqual(["fg"]);
		expect(src.elements.map((el) => el.variable)).toEqual(["a", "e", "b"]);
		expect(src.elements.map((el) => el.graphKind)).toEqual(["node", "edge", "node"]);
		expect(src.elements.find((el) => el.variable === "e")?.direction).toBe("right");
		expect(src.columns.map((c) => c.name)).toEqual(["src", "dst"]);
	});

	it("exposes the COLUMNS list as the relation's output to the enclosing query", () => {
		const sql =
			"SELECT * FROM GRAPH_TABLE(fg MATCH (a:Person)-[e:Knows]->(b:Person) COLUMNS(a.name AS src, b.name AS dst))";
		const tree = resolveScopes(lower(parseBigQuery(sql).tree), "bigquery");
		expect(qualify(tree, new Schema({})).columnsOf(tree.root)).toEqual(["src", "dst"]);
	});

	it("a graph-element reference does not raise an unknown-table diagnostic (elements are bound)", () => {
		const sql = "SELECT * FROM GRAPH_TABLE(fg MATCH (a:Person)-[e:Knows]->(b:Person) COLUMNS(a.name AS src))";
		const tree = resolveScopes(lower(parseBigQuery(sql).tree), "bigquery");
		const diags = qualify(tree, new Schema({})).diagnostics;
		expect(diags.some((d) => d.kind === "unknown-table")).toBe(false);
	});

	it("models a standalone GRAPH … RETURN … statement as a graph-table query", () => {
		const r = parseBigQuery("GRAPH fg MATCH (a:Person)-[e:Knows]->(b:Person) RETURN a.name AS src, b.name AS dst");
		expect(r.errors).toBe(0);
		const q = lower(r.tree);
		expect(q.statement).toBe("query");
		const body = q.body as SelectExpr;
		expect(body.from[0]?.kind).toBe("graphtable");
		const tree = resolveScopes(q, "bigquery");
		expect(qualify(tree, new Schema({})).columnsOf(tree.root)).toEqual(["src", "dst"]);
	});
});
