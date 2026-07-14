import { describe, it, expect } from "vitest";
import { parse } from "../src/api.js";
import { resolveScopes } from "../src/scope/scope.js";
import { nodeAt } from "../src/index.js";

function scopesFor(sql: string) {
	return resolveScopes(parse(sql, "databricks").ast, "databricks");
}

function astAndScopes(sql: string) {
	const ast = parse(sql, "databricks").ast;
	return { ast, tree: resolveScopes(ast, "databricks") };
}

describe("nodeAt", () => {
	it("finds the column expression under the cursor", () => {
		const sql = "SELECT amount + 1 FROM sales";
		const tree = scopesFor(sql);
		const hit = nodeAt(tree, sql.indexOf("amount")); // offset of 'amount'
		expect(hit).toBeDefined();
		expect(hit!.expr.kind).toBe("column");
		expect((hit!.expr as any).parts).toEqual(["amount"]);
	});

	it("prefers the smallest covering expr (column over the enclosing binary)", () => {
		const sql = "SELECT amount + 1 FROM sales";
		const tree = scopesFor(sql);
		const onAmount = nodeAt(tree, sql.indexOf("amount"))!;
		expect(onAmount.expr.kind).toBe("column"); // not "binary"
	});

	it("returns the function expr when the cursor is on the function name", () => {
		const sql = "SELECT sum(amount) FROM sales";
		const tree = scopesFor(sql);
		const hit = nodeAt(tree, sql.indexOf("sum"))!;
		expect(hit.expr.kind).toBe("function");
	});

	it("returns undefined when the offset is outside every expression", () => {
		const sql = "SELECT a FROM t";
		const tree = scopesFor(sql);
		expect(nodeAt(tree, sql.indexOf("FROM"))).toBeUndefined();
	});

	it("reaches a column inside a window OVER clause", () => {
		const sql = "SELECT rank() OVER (PARTITION BY region ORDER BY ts) AS r FROM t";
		const tree = scopesFor(sql);
		const hit = nodeAt(tree, sql.indexOf("region"))!;
		expect(hit.expr.kind).toBe("column");
		expect((hit.expr as any).parts).toEqual(["region"]);
	});

	it("resolves a column inside a subquery to the subquery's scope", () => {
		const sql = "SELECT x FROM (SELECT b AS x FROM t) s";
		const tree = scopesFor(sql);
		const hit = nodeAt(tree, sql.indexOf("b AS"))!;
		expect(hit.expr.kind).toBe("column");
		// owning scope is the subquery, not the root
		expect(hit.scope).not.toBe(tree.root);
	});

	it("reaches a top-level ORDER BY column (when given the ast)", () => {
		const sql = "SELECT a FROM t ORDER BY a";
		const { ast, tree } = astAndScopes(sql);
		// the trailing 'a' (the ORDER BY key), not the projection 'a'
		const off = sql.lastIndexOf("a");
		const hit = nodeAt(tree, off, ast)!;
		expect(hit.expr.kind).toBe("column");
		expect((hit.expr as any).parts).toEqual(["a"]);
	});

	it("reaches column and function inside ORDER BY upper(x)", () => {
		const sql = "SELECT x FROM t ORDER BY upper(x)";
		const { ast, tree } = astAndScopes(sql);
		const onArg = nodeAt(tree, sql.lastIndexOf("x"), ast)!;
		expect(onArg.expr.kind).toBe("column");
		expect((onArg.expr as any).parts).toEqual(["x"]);
		const onFn = nodeAt(tree, sql.indexOf("upper"), ast)!;
		expect(onFn.expr.kind).toBe("function");
	});

	it("resolves a subquery's own ORDER BY to the subquery scope", () => {
		const sql = "SELECT * FROM (SELECT b FROM t ORDER BY b) s";
		const { ast, tree } = astAndScopes(sql);
		const hit = nodeAt(tree, sql.lastIndexOf("b"), ast)!;
		expect(hit.expr.kind).toBe("column");
		expect(hit.scope).not.toBe(tree.root);
	});

	it("reaches the ORDER BY inside a pipe JOIN subquery source", () => {
		const sql = "FROM t |> JOIN (SELECT a FROM u ORDER BY a) v ON t.id = v.a";
		const { ast, tree } = astAndScopes(sql);
		expect(parse(sql, "databricks").errors).toBe(0); // shape parses cleanly
		const off = sql.indexOf("ORDER BY a") + "ORDER BY ".length; // the inner ORDER BY key
		const hit = nodeAt(tree, off, ast)!;
		expect(hit.expr.kind).toBe("column");
		expect((hit.expr as any).parts).toEqual(["a"]);
		// owned by the JOIN subquery's scope, not the root pipe
		expect(hit.scope).not.toBe(tree.root);
	});
});
