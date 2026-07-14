import { describe, it, expect } from "vitest";
import { parseTemplated } from "../src/minijinja/index.js";

describe("TemplatedParseResult Of-accessors", () => {
	it("tagOf/nodeOf join a templated FROM source to its ref tag", () => {
		const r = parseTemplated("select * from {{ ref('orders') }}", "databricks");
		const body = r.sql.ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		const src = body.from[0];
		const tag = r.tagOf(src);
		expect(tag?.kind).toBe("call");
		expect(tag?.kind === "call" && tag.name).toBe("ref");
		expect(r.nodeOf(tag!)).toBe(src);
	});
	it("control tags have no node; plain SQL answers undefined/[]", () => {
		const r = parseTemplated("{% if x %}select 1{% endif %}", "databricks");
		const control = r.tags.find((t) => t.kind === "control")!;
		expect(r.nodeOf(control)).toBeUndefined();
		expect(r.diagnosticsOf(control)).toEqual([]);
		const plain = parseTemplated("select 1", "databricks");
		expect(plain.tagOf({})).toBeUndefined();
	});
	it("diagnosticsOf attributes a broken macro's diagnostics to its tag", () => {
		const r = parseTemplated("select {{ half_open( }} from t", "databricks");
		const macro = r.tags[0];
		expect(macro).toBeDefined();
		expect(r.diagnosticsOf(macro).length).toBeGreaterThan(0);
	});
	it("nodeOf resolves a scalar-slot tag to its column Expr, not its parallel ColumnRef record", () => {
		// A scalar-slot placeholder fill lowers to BOTH a column Expr (in the projection) and a
		// parallel ColumnRef record (in body.columns, same cst) — nodeOf's contract is the column
		// expr specifically, so byTag must prefer it regardless of tree-walk visit order.
		const r = parseTemplated("select {{ m() }} as x from t", "databricks");
		const body = r.sql.ast.body as { kind: string; projections?: { expr: object }[] };
		if (body.kind !== "select" || !body.projections) throw new Error("expected select with projections");
		const projExpr = body.projections[0]!.expr;
		const tag = r.tagOf(projExpr);
		expect(tag).toBeDefined();
		expect(r.nodeOf(tag!)).toBe(projExpr);
	});
});
