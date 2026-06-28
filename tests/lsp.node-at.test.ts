import { describe, it, expect } from "vitest";
import { parse } from "../src/api.js";
import { resolveScopes } from "../src/scope/scope.js";
import { nodeAt } from "../src/lsp/node-at.js";

function scopesFor(sql: string) {
	return resolveScopes(parse(sql, "databricks").ast, "databricks");
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

	it("resolves a column inside a subquery to the subquery's scope", () => {
		const sql = "SELECT x FROM (SELECT b AS x FROM t) s";
		const tree = scopesFor(sql);
		const hit = nodeAt(tree, sql.indexOf("b AS"))!;
		expect(hit.expr.kind).toBe("column");
		// owning scope is the subquery, not the root
		expect(hit.scope).not.toBe(tree.root);
	});
});
