import { describe, it, expect } from "vitest";
import { SqlDocument } from "../src/document/document.js";
import { Schema, type Column } from "../src/qualify/schema.js";
import { CallbackSchema, type TableResolver } from "../src/qualify/schema-source.js";

// ---------------------------------------------------------------------------
// SchemaSource + CallbackSchema (Task 7). A resolve-on-demand catalog: the
// analysis pipeline stays 100% sync (columnsFor answers from whatever the host
// cache holds NOW; unknown tables degrade to unknown types exactly like a
// missing mapping entry), and asynchrony lives entirely in prime(), which
// drains recorded misses through the resolver and bumps a monotonic `version`
// so SqlDocument.analyze invalidates its memo.
// ---------------------------------------------------------------------------

/** A resolver over a host-side cache Map (keyed by folded dotted path). `fetch` warms the cache
 *  from a fixed "backend" that knows `t2` — modelling the async metadata load. */
function makeResolver(cache: Map<string, Column[]>): TableResolver {
	return {
		resolve: (parts) => cache.get(parts.join(".")),
		fetch: async (missing) => {
			for (const m of missing) {
				if (m.join(".") === "t2") cache.set("t2", [{ name: "b", type: "int" }]);
			}
		},
	};
}

describe("CallbackSchema — fold contract at the resolver boundary", () => {
	it("folds parts (Task 3 rules) before delegating — the resolver receives FOLDED parts", () => {
		const seen: string[][] = [];
		const cb = new CallbackSchema({
			resolve: (parts) => {
				seen.push(parts);
				return undefined;
			},
		});
		cb.columnsFor(["MyTable"], "snowflake"); // snowflake unquoted → UPPER
		cb.columnsFor(['"KeepCase"'], "snowflake"); // snowflake quoted → preserved
		cb.columnsFor(["Foo"], "databricks"); // databricks → lower
		expect(seen[0]).toEqual(["MYTABLE"]);
		expect(seen[1]).toEqual(["KeepCase"]);
		expect(seen[2]).toEqual(["foo"]);
	});

	it("tables() reflects only what the resolver has revealed (a miss reveals nothing)", () => {
		const cache = new Map<string, Column[]>([["t1", [{ name: "a" }]]]);
		const cb = new CallbackSchema(makeResolver(cache));
		expect(cb.tables()).toEqual([]);
		cb.columnsFor(["t1"], "databricks");
		expect(cb.tables()).toEqual(["t1"]);
		cb.columnsFor(["nope"], "databricks");
		expect(cb.tables()).toEqual(["t1"]);
	});
});

describe("CallbackSchema — analyze over a resolve-on-demand catalog", () => {
	it("(a) resolves a known table and records a miss (unknown-table) for an unknown one", () => {
		const cache = new Map<string, Column[]>([["t1", [{ name: "a", type: "int" }]]]);
		const cb = new CallbackSchema(makeResolver(cache));
		const doc = SqlDocument.create("SELECT * FROM t1;\nSELECT * FROM t2;", "databricks");
		const a = doc.analyze(cb);
		expect(a.diagnostics.filter((d) => d.kind === "unknown-table").map((d) => d.message)).toEqual([
			"Unknown table: t2",
		]);
		expect(cb.misses).toEqual([["t2"]]);
	});

	it("(b) prime() drains misses, bumps version, and re-analyze resolves the fetched table", async () => {
		const cache = new Map<string, Column[]>([["t1", [{ name: "a", type: "int" }]]]);
		const cb = new CallbackSchema(makeResolver(cache));
		const doc = SqlDocument.create("SELECT * FROM t1;\nSELECT * FROM t2;", "databricks");

		const first = doc.analyze(cb);
		expect(first.diagnostics.some((d) => d.kind === "unknown-table")).toBe(true);
		expect(cb.version).toBe(0);

		const changed = await cb.prime();
		expect(changed).toBe(true);
		expect(cb.version).toBe(1);
		expect(cb.misses).toEqual([]); // drained

		const second = doc.analyze(cb);
		expect(second).not.toBe(first); // memo invalidated by the version bump
		expect(second.diagnostics.some((d) => d.kind === "unknown-table")).toBe(false); // t2 now resolves
	});

	it("(b2) prime() with nothing new returns false and does NOT bump version", async () => {
		const cache = new Map<string, Column[]>([["t1", [{ name: "a", type: "int" }]]]);
		// A resolver whose fetch warms nothing — t3 stays unknown.
		const resolver: TableResolver = { resolve: (parts) => cache.get(parts.join(".")), fetch: async () => {} };
		const cb = new CallbackSchema(resolver);
		const doc = SqlDocument.create("SELECT * FROM t3", "databricks");
		doc.analyze(cb);
		expect(cb.misses).toEqual([["t3"]]);
		const changed = await cb.prime();
		expect(changed).toBe(false);
		expect(cb.version).toBe(0);
		expect(cb.misses).toEqual([["t3"]]); // still missing
	});

	it("(c) a plain Schema memoizes analyze() exactly as before (version constant 0)", () => {
		const schema = new Schema({ t1: { a: "int" } });
		expect(schema.version).toBe(0);
		const doc = SqlDocument.create("SELECT * FROM t1", "databricks");
		const a = doc.analyze(schema);
		const b = doc.analyze(schema);
		expect(b).toBe(a); // same instance — identity memo hit, no version thrash
	});

	it("(d) misses are distinct and in first-seen order", () => {
		const cache = new Map<string, Column[]>();
		const cb = new CallbackSchema(makeResolver(cache));
		const doc = SqlDocument.create("SELECT * FROM t2;\nSELECT * FROM t3;\nSELECT * FROM t2;", "databricks");
		doc.analyze(cb);
		expect(cb.misses).toEqual([["t2"], ["t3"]]);
	});
});
