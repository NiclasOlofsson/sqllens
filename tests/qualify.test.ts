import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";

function run(sql: string, schema: Schema) {
	const tree = resolveScopes(lower(parseDatabricks(sql).tree));
	return { tree, result: qualify(tree, schema) };
}

describe("qualify", () => {
	it("expands SELECT * using the schema", () => {
		const schema = new Schema({ t: { a: "int", b: "string" } });
		const { tree, result } = run("SELECT * FROM t", schema);
		expect(result.columnsOf(tree.root)).toEqual(["a", "b"]);
	});

	it("resolves a 3-part table name from a nested schema", () => {
		const schema = new Schema({ cat: { sch: { t: { x: "int", y: "int" } } } });
		const { tree, result } = run("SELECT * FROM cat.sch.t", schema);
		expect(result.columnsOf(tree.root)).toEqual(["x", "y"]);
	});

	it("reports an unknown table when a star cannot be expanded", () => {
		const schema = new Schema({ t: { a: "int" } });
		const { result } = run("SELECT * FROM missing", schema);
		expect(result.diagnostics.map((d) => d.kind)).toContain("unknown-table");
	});

	it("expands a star over a CTE using the CTE's own columns (no schema needed)", () => {
		const schema = new Schema({ t: { a: "int", b: "int" } });
		const { tree, result } = run("WITH c AS (SELECT a, b FROM t) SELECT * FROM c", schema);
		expect(result.columnsOf(tree.root)).toEqual(["a", "b"]);
	});

	it("expands a star over a table using its inline column aliases (no schema needed)", () => {
		const { tree, result } = run("SELECT * FROM t AS u (c1, c2)", new Schema({}));
		expect(result.columnsOf(tree.root)).toEqual(["c1", "c2"]);
	});

	it("resolves a bare column against the schema with no diagnostic", () => {
		const { result } = run("SELECT a FROM t", new Schema({ t: { a: "int", b: "int" } }));
		expect(result.diagnostics).toEqual([]);
	});

	it("flags a column not present in its table's schema", () => {
		const { result } = run("SELECT nope FROM t", new Schema({ t: { a: "int" } }));
		expect(result.diagnostics.map((d) => d.kind)).toContain("unknown-column");
	});

	it("flags a qualified column not present in its source", () => {
		const { result } = run("SELECT t.nope FROM t", new Schema({ t: { a: "int" } }));
		expect(result.diagnostics.map((d) => d.kind)).toContain("unknown-column");
	});

	it("flags a struct base column not present in the table (t.badcol.city)", () => {
		// `badcol` is the column being navigated; it must exist in t. The field `city` is not
		// type-checked (struct field types are not modelled), but a bad base column is caught.
		const { result } = run("SELECT t.badcol.city FROM t", new Schema({ t: { addr: "struct" } }));
		expect(result.diagnostics.map((d) => d.kind)).toContain("unknown-column");
	});

	it("does not flag the field of a valid struct column (t.addr.city)", () => {
		const { result } = run("SELECT t.addr.city FROM t", new Schema({ t: { addr: "struct" } }));
		expect(result.diagnostics.filter((d) => d.kind === "unknown-column")).toEqual([]);
	});

	it("flags a struct field not present in the column's struct type", () => {
		const schema = new Schema({ t: { addr: "struct<city:string,zip:int>" } });
		const { result } = run("SELECT t.addr.nope FROM t", schema);
		expect(result.diagnostics.map((d) => d.kind)).toContain("unknown-field");
	});

	it("does not flag a struct field that exists", () => {
		const schema = new Schema({ t: { addr: "struct<city:string,zip:int>" } });
		const { result } = run("SELECT t.addr.city FROM t", schema);
		expect(result.diagnostics).toEqual([]);
	});

	it("walks nested struct types (a.b.c) and flags a missing leaf field", () => {
		const schema = new Schema({ t: { a: "struct<b:struct<c:string>>" } });
		const { ok } = { ok: run("SELECT t.a.b.c FROM t", schema) };
		expect(ok.result.diagnostics).toEqual([]);
		const { result } = run("SELECT t.a.b.nope FROM t", schema);
		expect(result.diagnostics.map((d) => d.kind)).toContain("unknown-field");
	});

	it("does not flag field access when the base column is not a struct type", () => {
		// `addr` is a plain string, not a struct — `.city` isn't validated (we don't model
		// field access on non-structs), so no false unknown-field.
		const schema = new Schema({ t: { addr: "string" } });
		const { result } = run("SELECT t.addr.city FROM t", schema);
		expect(result.diagnostics.filter((d) => d.kind === "unknown-field")).toEqual([]);
	});

	it("flags a bad struct field through a pass-through CTE column (type propagated)", () => {
		// `addr` is threaded through the CTE unchanged, so its struct type propagates and
		// `addr.nope` is checkable — a derived column is not an excuse to skip validation.
		const schema = new Schema({ t: { addr: "struct<city:string>" } });
		const { result } = run("WITH c AS (SELECT addr FROM t) SELECT addr.nope FROM c", schema);
		expect(result.diagnostics.map((d) => d.kind)).toContain("unknown-field");
	});

	it("validates a good struct field through a pass-through CTE column", () => {
		const schema = new Schema({ t: { addr: "struct<city:string>" } });
		const { result } = run("WITH c AS (SELECT addr FROM t) SELECT addr.city FROM c", schema);
		expect(result.diagnostics).toEqual([]);
	});

	it("propagates struct types through a subquery and an aliased CTE", () => {
		const schema = new Schema({ t: { addr: "struct<city:string>" } });
		const sub = run("SELECT s.addr.nope FROM (SELECT addr FROM t) s", schema);
		expect(sub.result.diagnostics.map((d) => d.kind)).toContain("unknown-field");
		const aliased = run("WITH c (a) AS (SELECT addr FROM t) SELECT c.a.nope FROM c", schema);
		expect(aliased.result.diagnostics.map((d) => d.kind)).toContain("unknown-field");
	});

	it("flags a bad field on a COMPUTED struct column (via inference)", () => {
		// `addr` is computed by named_struct — only inference can type it. The bad field must flag.
		const schema = new Schema({ t: { x: "string" } });
		const { result } = run(
			"WITH c AS (SELECT named_struct('city', x) AS addr FROM t) SELECT addr.nope FROM c",
			schema,
		);
		expect(result.diagnostics.map((d) => d.kind)).toContain("unknown-field");
	});

	it("validates a good field on a computed struct column", () => {
		const schema = new Schema({ t: { x: "string" } });
		const { result } = run(
			"WITH c AS (SELECT named_struct('city', x) AS addr FROM t) SELECT addr.city FROM c",
			schema,
		);
		expect(result.diagnostics.filter((d) => d.kind === "unknown-field")).toEqual([]);
	});

	it("flags an ambiguous bare column present in two joined tables", () => {
		const { result } = run(
			"SELECT id FROM t JOIN u ON t.x = u.y",
			new Schema({ t: { id: "int", x: "int" }, u: { id: "int", y: "int" } }),
		);
		expect(result.diagnostics.map((d) => d.kind)).toContain("ambiguous-column");
	});

	it("expands a qualified star (t.*) to only that source's columns", () => {
		const schema = new Schema({ t: { a: "int", b: "int" }, u: { c: "int", d: "int" } });
		const { tree, result } = run("SELECT t.* FROM t JOIN u ON t.a = u.c", schema);
		expect(result.columnsOf(tree.root)).toEqual(["a", "b"]);
	});

	it("emits no column diagnostics without a schema (columns unknown)", () => {
		const { result } = run("SELECT whatever FROM t", new Schema({}));
		expect(result.diagnostics.filter((d) => d.kind !== "unknown-table")).toEqual([]);
	});
});
