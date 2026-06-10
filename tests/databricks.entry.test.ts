import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { resolveScopes } from "../src/scope/scope.js";

// Entry-rule coverage: SQL scripting compounds (BEGIN ... END) and the Delta time-travel
// @-shorthand (t@v123 / t@yyyyMMddHHmmssSSS) are documented Databricks SQL
// (sql-ref-scripting; delta time travel in sql-ref-syntax-qry-select-table-reference).

describe("SQL scripting entry", () => {
	it("parses a BEGIN ... END compound and flags it (scripting has no single query scope)", () => {
		const r = parseDatabricks("BEGIN DECLARE x INT DEFAULT 0; SET x = x + 1; END");
		expect(r.errors).toBe(0);
		const ir = lower(r.tree);
		if (ir.body.kind !== "select") throw new Error("expected flagged select body");
		expect(ir.body.unsupported).toBeTruthy();
	});

	it("flags a compound even when it contains a SELECT (no partial mis-modelling)", () => {
		const r = parseDatabricks("BEGIN SELECT 1; END");
		expect(r.errors).toBe(0);
		const ir = lower(r.tree);
		if (ir.body.kind !== "select") throw new Error("expected flagged select body");
		expect(ir.body.unsupported).toContain("compound");
		expect(() => resolveScopes(ir, "databricks")).not.toThrow();
	});

	it("still parses and models a plain statement", () => {
		const r = parseDatabricks("SELECT a FROM t");
		expect(r.errors).toBe(0);
		const ir = lower(r.tree);
		expect(ir.body.kind).toBe("select");
		if (ir.body.kind === "select") expect(ir.body.unsupported).toBeUndefined();
	});
});

describe("time-travel @ shorthand", () => {
	it("parses t@v123 and lowers to the table t", () => {
		const r = parseDatabricks("SELECT * FROM t@v123");
		expect(r.errors).toBe(0);
		const ir = lower(r.tree);
		if (ir.body.kind !== "select") throw new Error("select");
		expect(ir.body.from[0]).toMatchObject({ kind: "table", name: ["t"] });
	});

	it("parses the timestamp form t@20240101000000000", () => {
		expect(parseDatabricks("SELECT * FROM t@20240101000000000").errors).toBe(0);
	});
});
