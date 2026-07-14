import { describe, it, expect } from "vitest";
import { SqlSession, Schema, complete, completeAt } from "../src/index.js";
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
		expect(t.tags.some((x) => x.kind === "call" && x.name === "ref")).toBe(true);
		const body = t.ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		const fromTag = t.tagOf(body.from[0]);
		expect(fromTag?.kind === "call" && fromTag.name).toBe("ref");
	});
	it("multi-statement: cursor verbs are cell-aware, spans in document coordinates", () => {
		const TWO = "select a from t; select b from u";
		const s = SqlSession.create(TWO, "duckdb", { schema: new Schema({ t: { a: "int" }, u: { b: "int" } }) });
		// statement 2: cursor on `b`
		const off = TWO.indexOf("b from");
		const occ = s.referencesAt(off);
		expect(occ?.symbol).toBe("b");
		for (const o of occ!.occurrences) expect(TWO.slice(o.span.start, o.span.end)).toBe("b");
		expect(s.nodeAt(off)?.expr.kind).toBe("column");
		expect(s.typeAt(off)).toEqual({ kind: "scalar", name: "int" });
		// statement 1 unchanged
		const offA = TWO.indexOf("a");
		const occA = s.referencesAt(offA);
		expect(occA?.symbol).toBe("a");
		for (const o of occA!.occurrences) expect(TWO.slice(o.span.start, o.span.end)).toBe("a");
		expect(s.typeAt(offA)).toEqual({ kind: "scalar", name: "int" });
	});
	it("withText: immutable successor, options carried", () => {
		const s = SqlSession.create(MODEL, "databricks", { templating: minijinja() });
		const next = s.withText(MODEL + " ");
		expect(next).not.toBe(s);
		expect(next.tags.length).toBe(s.tags.length);
		expect(s.doc.version).toBeLessThan(next.doc.version);
	});
	it("complete is the deprecated alias of completeAt — same function, not a wrapper", () => {
		expect(complete).toBe(completeAt);
		const s = SqlSession.create(SQL, "duckdb", { schema: new Schema({ sales: { amount: "int" } }) });
		expect(completeAt(s.doc, SQL.length).length).toBeGreaterThan(0);
	});
	it("variantAt/variants are one-line delegations to the document", () => {
		const IF = "select {% if v %}a{% else %}b{% endif %} from t";
		const s = SqlSession.create(IF, "duckdb", { templating: minijinja() });
		expect(s.variantAt(IF.indexOf("a"))).toBe(s.doc.variantAt(IF.indexOf("a")));
		expect(s.variants).toBe(s.doc.variants);
	});
	it("unionSymbols/unionDiagnostics/unionCtes/unionOutputColumns are one-line delegations with the session's schema", () => {
		const IF = "with data as (select {% if v %}a{% else %}b{% endif %} from t) select * from data";
		const schema = new Schema({ t: { a: "int", b: "int" } });
		const s = SqlSession.create(IF, "duckdb", { templating: minijinja(), schema });
		expect(s.unionSymbols()).toBe(s.doc.unionSymbols(schema));
		expect(s.unionDiagnostics()).toBe(s.doc.unionDiagnostics(schema));
		expect(s.unionCtes()).toBe(s.doc.unionCtes(schema));
		expect(s.unionOutputColumns()).toBe(s.doc.unionOutputColumns(schema));
	});
});
