import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { inferType } from "../src/infer/infer.js";
import { scalar } from "../src/infer/types.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";

function typeOf(sql: string, schema: Schema) {
	const tree = resolveScopes(lower(parseDatabricks(sql).tree));
	const body = tree.root.body;
	if (body.kind !== "select") throw new Error("expected select");
	return inferType(body.projections[0].expr, tree.root, schema);
}

describe("inferType", () => {
	it("types an integer literal", () => {
		expect(typeOf("SELECT 42 FROM t", new Schema({}))).toEqual({ kind: "scalar", name: "int" });
	});

	it("types a string literal", () => {
		expect(typeOf("SELECT 'x' FROM t", new Schema({}))).toEqual({ kind: "scalar", name: "string" });
	});

	it("types a cast as its target type", () => {
		expect(typeOf("SELECT cast(a AS double) FROM t", new Schema({}))).toEqual({
			kind: "scalar",
			name: "double",
		});
	});

	it("types a base-table column from the schema", () => {
		expect(typeOf("SELECT a FROM t", new Schema({ t: { a: "bigint" } }))).toEqual({
			kind: "scalar",
			name: "bigint",
		});
	});

	it("types a column threaded through a CTE (recursive origin-walk)", () => {
		expect(typeOf("WITH c AS (SELECT a FROM t) SELECT a FROM c", new Schema({ t: { a: "bigint" } }))).toEqual({
			kind: "scalar",
			name: "bigint",
		});
	});

	it("types struct field access via the column's struct type", () => {
		expect(typeOf("SELECT t.addr.city FROM t", new Schema({ t: { addr: "struct<city:string>" } }))).toEqual({
			kind: "scalar",
			name: "string",
		});
	});

	it("types a predicate as boolean", () => {
		expect(typeOf("SELECT a IS NULL FROM t", new Schema({}))).toEqual({
			kind: "scalar",
			name: "boolean",
		});
	});

	it("types Spark `/` as float division (int / int → double, not int)", () => {
		expect(typeOf("SELECT a / b FROM t", new Schema({ t: { a: "int", b: "int" } }))).toEqual({
			kind: "scalar",
			name: "double",
		});
	});

	it("types Spark ranking functions as int", () => {
		expect(typeOf("SELECT row_number() OVER (ORDER BY a) FROM t", new Schema({ t: { a: "int" } }))).toEqual({
			kind: "scalar",
			name: "int",
		});
	});

	it("types added Spark system functions (factorial → bigint, current_user → string)", () => {
		expect(typeOf("SELECT factorial(a) FROM t", new Schema({ t: { a: "int" } }))).toEqual({
			kind: "scalar",
			name: "bigint",
		});
		expect(typeOf("SELECT current_user() FROM t", new Schema({}))).toEqual({ kind: "scalar", name: "string" });
	});

	it("does not terminate-loop on a recursive CTE (returns a type, unknown is fine)", () => {
		const t = typeOf(
			"WITH RECURSIVE c(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM c) SELECT n FROM c",
			new Schema({}),
		);
		expect(t.kind).toBeDefined();
	});

	it("types a scalar subquery by its single output column", () => {
		expect(typeOf("SELECT (SELECT max(x) FROM u) AS m FROM t", new Schema({ u: { x: "date" } }))).toEqual(
			scalar("date"),
		);
	});
});

describe("inferType — subqueries, constructors, higher-order functions", () => {
	it("types a struct constructor and its field access", () => {
		expect(
			typeOf("SELECT named_struct('city', a, 'zip', b) FROM t", new Schema({ t: { a: "string", b: "int" } })),
		).toEqual({
			kind: "struct",
			fields: [
				{ name: "city", type: scalar("string") },
				{ name: "zip", type: scalar("int") },
			],
		});
	});

	it("types map() from its key/value arguments", () => {
		expect(typeOf("SELECT map('k', a) FROM t", new Schema({ t: { a: "int" } }))).toEqual({
			kind: "map",
			key: scalar("string"),
			value: scalar("int"),
		});
	});

	it("types from_json() from its schema argument", () => {
		expect(typeOf("SELECT from_json(j, 'struct<n:int>') FROM t", new Schema({ t: { j: "string" } }))).toEqual({
			kind: "struct",
			fields: [{ name: "n", type: scalar("int") }],
		});
	});

	it("types transform() as an array of the lambda body's type", () => {
		// arr: array<int>, x -> x + 1 (int) ⇒ array<int>
		expect(typeOf("SELECT transform(arr, x -> x + 1) FROM t", new Schema({ t: { arr: "array<int>" } }))).toEqual({
			kind: "array",
			element: scalar("int"),
		});
	});

	it("types transform() whose lambda changes the element type", () => {
		// arr: array<int>, x -> cast(x AS string) ⇒ array<string>
		expect(
			typeOf("SELECT transform(arr, x -> cast(x AS string)) FROM t", new Schema({ t: { arr: "array<int>" } })),
		).toEqual({ kind: "array", element: scalar("string") });
	});

	it("types aggregate()/reduce() by the accumulator", () => {
		expect(
			typeOf("SELECT aggregate(arr, 0, (acc, x) -> acc + x) FROM t", new Schema({ t: { arr: "array<int>" } })),
		).toEqual(scalar("int"));
	});
});

describe("inferType — operators, functions, case", () => {
	it("widens numeric arithmetic (int + double → double)", () => {
		expect(typeOf("SELECT a + b FROM t", new Schema({ t: { a: "int", b: "double" } }))).toEqual(scalar("double"));
	});

	it("types comparisons as boolean", () => {
		expect(typeOf("SELECT a > b FROM t", new Schema({ t: { a: "int", b: "int" } }))).toEqual(scalar("boolean"));
	});

	it("types a string function", () => {
		expect(typeOf("SELECT lower(a) FROM t", new Schema({ t: { a: "string" } }))).toEqual(scalar("string"));
	});

	it("types count() as bigint", () => {
		expect(typeOf("SELECT count(a) FROM t", new Schema({ t: { a: "int" } }))).toEqual(scalar("bigint"));
	});

	it("types coalesce by the common type of its args", () => {
		expect(typeOf("SELECT coalesce(a, b) FROM t", new Schema({ t: { a: "int", b: "bigint" } }))).toEqual(
			scalar("bigint"),
		);
	});

	it("types max() as the argument's type", () => {
		expect(typeOf("SELECT max(d) FROM t", new Schema({ t: { d: "date" } }))).toEqual(scalar("date"));
	});

	it("widens sum(int) to bigint", () => {
		expect(typeOf("SELECT sum(a) FROM t", new Schema({ t: { a: "int" } }))).toEqual(scalar("bigint"));
	});

	it("types a CASE by its branches", () => {
		expect(typeOf("SELECT CASE WHEN a THEN 1 ELSE 2 END FROM t", new Schema({ t: { a: "boolean" } }))).toEqual(
			scalar("int"),
		);
	});

	it("types array element access via subscript", () => {
		expect(typeOf("SELECT arr[0] FROM t", new Schema({ t: { arr: "array<string>" } }))).toEqual(scalar("string"));
	});
});
