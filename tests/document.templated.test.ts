import { describe, it, expect } from "vitest";
import { SqlDocument, Schema } from "../src/index.js";
import { minijinja } from "../src/minijinja/index.js";
import { TestRelationProvider, relKey } from "./helpers/providers.js";

const MODEL = "select o.total from {{ ref('orders') }} o where o.total > {{ var('min') }}";

describe("SqlDocument + templating engine (the unified door)", () => {
	it("plain document: no templating option → templated is undefined, everything as before", () => {
		const doc = SqlDocument.create("select 1", "databricks");
		expect(doc.templated).toBeUndefined();
	});
	it("templated document: ref binds, facets ride, coordinates are document-true", () => {
		const doc = SqlDocument.create(MODEL, "databricks", { templating: minijinja() });
		expect(doc.templated).toBeDefined();
		expect(doc.templated!.tags.some((t) => t.kind === "call" && t.name === "ref")).toBe(true);
		// the marker-carrying IR reached scopes: the source is aliased `o` — that's the sources key.
		expect([...doc.scopes.root.sources.keys()]).toContain("o");
		// tokens: one merged stream, channel-2 jinja present, spans slice the source
		const jinja = doc.tokens.filter((t) => t.channel === 2);
		expect(jinja.length).toBeGreaterThan(0);
		for (const t of jinja) expect(MODEL.slice(t.start, t.stop + 1)).toBe(t.text);
		// two-spine join works through the door
		const body = doc.ast.body;
		if (body.kind !== "select") throw new Error("expected select");
		const fromTag = doc.templated!.tagOf(body.from[0]);
		expect(fromTag?.kind === "call" && fromTag.name).toBe("ref");
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
	it("withText carries the engine: the child re-parses templated", () => {
		const doc = SqlDocument.create(MODEL, "databricks", { templating: minijinja() });
		const next = doc.withText(MODEL + " ", 2);
		expect(next.templated).toBeDefined();
		expect(next.templated!.tags.length).toBe(doc.templated!.tags.length);
	});
	it("unchanged text reuses the cached templated cell across withText", () => {
		const doc = SqlDocument.create(MODEL, "databricks", { templating: minijinja() });
		const next = doc.withText(MODEL, 2);
		expect(next.statements[0].ast).toBe(doc.statements[0].ast); // object identity = cache hit
	});
	it("a provider version bump invalidates the cached templated parse", async () => {
		// TestRelationProvider (tests/helpers/providers.ts) is a DefaultTemplateProvider subclass
		// driven exactly like a host: relationOf records a miss on a cold ref('orders'), and
		// prime() drains it through fetchExpansions and bumps `version` — the real invalidation
		// path (mirrors how an editor drives schema.prime() on each publish), not a poke at
		// the counter.
		const provider = new TestRelationProvider();
		const doc = SqlDocument.create(MODEL, "databricks", { templating: minijinja(), provider });
		expect(provider.misses.length).toBe(1); // the ref('orders') tag missed during that parse
		provider.pending.set(relKey("ref", ["orders"]), { nameParts: ["orders"] });
		expect(await provider.prime()).toBe(true); // real bump
		const next = doc.withText(MODEL, 2);
		expect(next.statements[0].ast).not.toBe(doc.statements[0].ast); // stale entry missed
	});
});
