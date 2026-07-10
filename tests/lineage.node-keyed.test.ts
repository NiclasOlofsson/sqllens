import { describe, it, expect } from "vitest";
import { analyze, Schema } from "../src/index.js";

describe("node-keyed lineage", () => {
	it("distinguishes duplicate output names", () => {
		const schema = new Schema({ t: { a: "int", b: "int" } });
		const a = analyze("SELECT a AS x, b AS x FROM t", "duckdb", { schema });
		const body = a.ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		const [p1, p2] = body.projections;
		const o1 = a.lineage.originsOfNode(p1);
		const o2 = a.lineage.originsOfNode(p2);
		expect(o1.map((o) => o.column)).toEqual(["a"]);
		expect(o2.map((o) => o.column)).toEqual(["b"]); // string-keyed originsOf("x") cannot answer this
	});
});
