import { describe, it, expect } from "vitest";
import { SqlSession, Schema } from "../src/index.js";
import { minijinja } from "../src/minijinja/index.js";

const SQL = "select amount from sales where amount > 10";
const MODEL = "select o.total from {{ ref('orders') }} o";

describe("SqlSession — the facade", () => {
	it("properties are the document's products; verbs execute passes", () => {
		const s = SqlSession.create(SQL, "duckdb", { schema: new Schema({ sales: { amount: "int" } }) });
		expect(s.text).toBe(SQL);
		expect(s.scopes.kind).toBe("scopes");
		expect(s.diagnostics()).toEqual([]);
		expect(s.deriveSymbols().length).toBeGreaterThan(0);
		expect(s.lineage().originsOf("amount").length).toBe(1);
	});
	it("cursor verbs: offset in, answers out, total off-target", () => {
		const s = SqlSession.create(SQL, "duckdb", { schema: new Schema({ sales: { amount: "int" } }) });
		const off = SQL.indexOf("amount");
		expect(s.referencesAt(off)?.symbol).toBe("amount");
		expect(s.typeAt(off)).toEqual({ kind: "scalar", name: "int" }); // matches src/infer/types.ts's Type union
		expect(s.completeAt(SQL.length).length).toBeGreaterThan(0);
		expect(s.referencesAt(0)).toBeNull(); // "select" keyword — off-symbol
		expect(s.tokenAt(-5)).toBeUndefined();
	});
	it("template facets flatten; empty on plain", () => {
		const plain = SqlSession.create(SQL, "duckdb");
		expect(plain.tags).toEqual([]);
		expect(plain.tagOf({})).toBeUndefined();
		expect(plain.placeholder).toBe(SQL);
		const t = SqlSession.create(MODEL, "databricks", { templating: minijinja() });
		expect(t.tags.map((x) => x.kind)).toContain("ref");
		const body = t.ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		expect(t.tagOf(body.from[0])?.kind).toBe("ref");
	});
	it("withText: immutable successor, options carried", () => {
		const s = SqlSession.create(MODEL, "databricks", { templating: minijinja() });
		const next = s.withText(MODEL + " ");
		expect(next).not.toBe(s);
		expect(next.tags.length).toBe(s.tags.length);
		expect(s.doc.version).toBeLessThan(next.doc.version);
	});
});
