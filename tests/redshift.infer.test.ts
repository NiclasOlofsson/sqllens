import { describe, it, expect } from "vitest";
import { parseRedshift } from "../src/redshift/parse.js";
import { lower } from "../src/redshift/lower.js";
import { resolveScopes } from "../src/scope/scope.js";
import { inferType } from "../src/infer/infer.js";
import { Schema } from "../src/qualify/schema.js";
import { redshiftParseType, REDSHIFT_ALIASES, redshiftLiteral } from "../src/infer/redshift.js";
import { scalar, UNKNOWN } from "../src/infer/types.js";

describe("redshift inference", () => {
	it("maps Postgres scalar names to canonical types", () => {
		expect(redshiftParseType("int4")).toEqual({ kind: "scalar", name: "int" });
		expect(redshiftParseType("int8")).toEqual({ kind: "scalar", name: "bigint" });
		expect(redshiftParseType("float8")).toEqual({ kind: "scalar", name: "double" });
		expect(redshiftParseType("numeric(10,2)")).toEqual({ kind: "scalar", name: "decimal" });
		expect(redshiftParseType("character varying")).toEqual({ kind: "scalar", name: "string" });
		expect(REDSHIFT_ALIASES.int2).toBe("smallint");
	});

	it("integer/integer divides to int (Redshift truncates)", () => {
		const sql = "SELECT a / b AS r FROM t";
		const scopes = resolveScopes(lower(parseRedshift(sql).tree), "redshift");
		const schema = new Schema({ t: { a: "int4", b: "int4" } });
		// locate the division expr in the root select's projection
		const body = scopes.root.body as any;
		const div = body.projections[0].expr;
		expect(inferType(div, scopes.root, schema)).toEqual({ kind: "scalar", name: "int" });
	});

	it("a known base-table column infers its schema type", () => {
		const sql = "SELECT amount FROM sales";
		const scopes = resolveScopes(lower(parseRedshift(sql).tree), "redshift");
		const schema = new Schema({ sales: { amount: "numeric(10,2)" } });
		const col = (scopes.root.body as any).projections[0].expr;
		expect(inferType(col, scopes.root, schema)).toEqual({ kind: "scalar", name: "decimal" });
	});
});

describe("redshift literal typing", () => {
	it("types a decimal-point literal as decimal, not double (AWS r_numeric_literals671)", () => {
		expect(redshiftLiteral("1.5")).toEqual(scalar("decimal"));
	});
	it("types an exponent literal as double (float8)", () => {
		expect(redshiftLiteral("1.5e3")).toEqual(scalar("double"));
	});
	it("types a bare integer as int", () => {
		expect(redshiftLiteral("42")).toEqual(scalar("int"));
	});
	it("does NOT treat double-quoted text as a string (identifiers in Redshift)", () => {
		expect(redshiftLiteral('"col"')).toEqual(UNKNOWN);
	});
	it("types typed literals", () => {
		expect(redshiftLiteral("date '2026-01-01'")).toEqual(scalar("date"));
		expect(redshiftLiteral("timestamp '2026-01-01 00:00:00'")).toEqual(scalar("timestamp"));
		expect(redshiftLiteral("interval '1 day'")).toEqual(scalar("interval"));
	});
	it("NULL is unknown, never guessed", () => {
		expect(redshiftLiteral("NULL")).toEqual(UNKNOWN);
	});
});
