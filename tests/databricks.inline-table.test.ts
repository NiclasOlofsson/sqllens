import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { resolveScopes } from "../src/scope/scope.js";

// Inline-table query bodies (VALUES ...) and TABLE shorthand. lower() used to throw
// "queryTerm has no querySpecification" on these — a valid parse must never throw,
// it either models the body or flags it unsupported.

function lowered(sql: string) {
	const r = parseDatabricks(sql);
	expect(r.errors).toBe(0);
	return lower(r.tree);
}

describe("inline-table query bodies", () => {
	it("models top-level VALUES with an alias: output columns from the alias list", () => {
		const ir = lowered("VALUES (1, 'a'), (2, 'b') AS v(x, y)");
		expect(ir.body.kind).toBe("select");
		if (ir.body.kind !== "select") return;
		const scope = resolveScopes(ir, "databricks");
		expect(scope.root.outputs).toEqual(["x", "y"]);
	});

	it("models bare VALUES with Spark's default colN names", () => {
		const ir = lowered("VALUES (1, 'a'), (2, 'b')");
		expect(ir.body.kind).toBe("select");
		if (ir.body.kind !== "select") return;
		const scope = resolveScopes(ir, "databricks");
		expect(scope.root.outputs).toEqual(["col1", "col2"]);
	});

	it("does not throw on INSERT INTO ... VALUES", () => {
		const ir = lowered("INSERT INTO t VALUES (1, 'a')");
		expect(() => resolveScopes(ir, "databricks")).not.toThrow();
	});

	it("models TABLE t as SELECT * FROM t", () => {
		const ir = lowered("TABLE t");
		expect(ir.body.kind).toBe("select");
		if (ir.body.kind !== "select") return;
		expect(ir.body.from).toHaveLength(1);
		expect(ir.body.projections[0]?.expr.kind).toBe("star");
		expect(() => resolveScopes(ir, "databricks")).not.toThrow();
	});

	it("still models a VALUES branch inside a set operation", () => {
		const ir = lowered("SELECT a, b FROM t UNION ALL (VALUES (1, 'x') AS v(a, b))");
		expect(ir.body.kind).toBe("setop");
		expect(() => resolveScopes(ir, "databricks")).not.toThrow();
	});
});
