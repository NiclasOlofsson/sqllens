import { describe, it, expect } from "vitest";
import { SqlDocument, Schema } from "../src/index.js";
import { minijinja } from "../src/minijinja/index.js";

const MODEL = "select o.total from {{ ref('orders') }} o where o.total > {{ var('min') }}";

describe("SqlDocument + templating engine (the unified door)", () => {
	it("plain document: no templating option → templated is undefined, everything as before", () => {
		const doc = SqlDocument.create("select 1", "databricks");
		expect(doc.templated).toBeUndefined();
	});
	it("templated document: ref binds, facets ride, coordinates are document-true", () => {
		const doc = SqlDocument.create(MODEL, "databricks", { templating: minijinja() });
		expect(doc.templated).toBeDefined();
		expect(doc.templated!.tags.map((t) => t.kind)).toContain("ref");
		// the marker-carrying IR reached scopes: the source is aliased `o` — that's the sources key.
		expect([...doc.scopes.root.sources.keys()]).toContain("o");
		// tokens: one merged stream, channel-2 jinja present, spans slice the source
		const jinja = doc.tokens.filter((t) => t.channel === 2);
		expect(jinja.length).toBeGreaterThan(0);
		for (const t of jinja) expect(MODEL.slice(t.start, t.stop + 1)).toBe(t.text);
		// two-spine join works through the door
		const body = doc.ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		expect(doc.templated!.tagOf(body.from[0])?.kind).toBe("ref");
	});
	it("engine + tag-free text degenerates: facets empty, parse identical to plain door", () => {
		const plain = SqlDocument.create("select a from t", "databricks");
		const doored = SqlDocument.create("select a from t", "databricks", { templating: minijinja() });
		expect(doored.templated!.tags).toEqual([]);
		expect(doored.tokens.map((t) => [t.start, t.stop, t.text])).toEqual(
			plain.tokens.map((t) => [t.start, t.stop, t.text]),
		);
		expect(doored.errors).toBe(plain.errors);
	});
	it("analyze() runs over a templated document (schema-fed types on a templated source's column)", () => {
		const schema = new Schema({ orders: { total: "decimal" } });
		const doc = SqlDocument.create(MODEL, "databricks", { templating: minijinja() });
		const a = doc.analyze(schema);
		expect(a.symbols.length).toBeGreaterThan(0);
		expect(a.diagnostics).toEqual([]); // templated source resolvable → no false unknowns
	});
});
