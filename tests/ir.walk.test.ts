import { describe, it, expect } from "vitest";
import { parse, walkExprs, childExprs } from "../src/index.js";

describe("ir walk", () => {
	it("walkExprs reaches every subexpression", () => {
		const { ast } = parse("SELECT a + b * 2 FROM t", "duckdb");
		const body = ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		const kinds = [...walkExprs(body.projections[0].expr)].map((e) => e.kind);
		expect(kinds).toContain("binary");
		expect(kinds).toContain("column");
		expect(kinds).toContain("literal");
	});
	it("childExprs is exported and leaf-safe", () => {
		const { ast } = parse("SELECT a FROM t", "duckdb");
		const body = ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		expect(childExprs(body.projections[0].expr)).toEqual([]);
	});
});
