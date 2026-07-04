import { describe, expect, it } from "vitest";
import {
	CallbackTemplateCatalog,
	type RelationResolver,
	type ResolvedRelation,
	type TemplateRef,
} from "../src/qualify/template-catalog.js";
import type { Column } from "../src/qualify/schema.js";
import type { TableResolver } from "../src/qualify/schema-source.js";

// ---------------------------------------------------------------------------
// CallbackTemplateCatalog (inc3.1) — the `relation` slice of the TemplateCatalog
// seam. It mirrors CallbackSchema exactly (sync resolve → recorded misses → an
// async prime() that drains + bumps a monotonic version, with in-flight
// coalescing and re-entrant-miss truncation), but wraps BOTH a RelationResolver
// (logical ref → physical relation+columns) and, optionally, a TableResolver
// (the inherited columnsFor/tables physical-table side). ONE version, ONE
// prime() draining BOTH miss lists.
// ---------------------------------------------------------------------------

/** A relation resolver over a host-side `store` (keyed by folded dotted path). `warm` primes the
 *  store synchronously; `fetchRelations` warms it from the fixed `map` backend — modelling the
 *  async warehouse describe. */
function relResolver(map: Record<string, ResolvedRelation>) {
	const store: Record<string, ResolvedRelation> = {};
	return {
		store,
		warm: (k: string) => {
			store[k] = map[k];
		},
		resolver: {
			resolveRelation: (ref: TemplateRef) => store[ref.nameParts.join(".")],
			fetchRelations: async (missing: TemplateRef[]) => {
				for (const m of missing) store[m.nameParts.join(".")] = map[m.nameParts.join(".")];
			},
		} satisfies RelationResolver,
	};
}

describe("CallbackTemplateCatalog", () => {
	it("relation resolves logical→physical+columns from warm cache; miss returns undefined + records", () => {
		const { resolver, warm } = relResolver({
			orders: { nameParts: ["analytics", "orders"], columns: [{ name: "id", type: "int", nullable: false }] },
		});
		const cat = new CallbackTemplateCatalog(resolver);
		expect(cat.relation({ kind: "ref", nameParts: ["orders"] })).toBeUndefined(); // cold
		expect(cat.misses.length).toBe(1);

		warm("orders"); // host cache now knows it
		const r = cat.relation({ kind: "ref", nameParts: ["orders"] });
		expect(r?.nameParts).toEqual(["analytics", "orders"]);
		expect(r?.columns?.map((c) => c.name)).toEqual(["id"]);
	});

	it("prime() drains relation misses, bumps version once, resolves on re-probe", async () => {
		const { resolver } = relResolver({
			orders: { nameParts: ["analytics", "orders"], columns: [{ name: "id", type: "int", nullable: false }] },
		});
		const cat = new CallbackTemplateCatalog(resolver);
		cat.relation({ kind: "ref", nameParts: ["orders"] }); // miss
		const v0 = cat.version;
		const changed = await cat.prime();
		expect(changed).toBe(true);
		expect(cat.version).toBe(v0 + 1);
		expect(cat.misses).toEqual([]); // drained
		const r = cat.relation({ kind: "ref", nameParts: ["orders"] });
		expect(r?.nameParts).toEqual(["analytics", "orders"]);
		expect(r?.columns?.map((c) => c.name)).toEqual(["id"]);
	});

	it("prime() with nothing new returns false and does NOT bump version", async () => {
		// A relation resolver whose fetch warms nothing — the ref stays cold.
		const resolver: RelationResolver = { resolveRelation: () => undefined, fetchRelations: async () => {} };
		const cat = new CallbackTemplateCatalog(resolver);
		cat.relation({ kind: "ref", nameParts: ["orders"] });
		expect(cat.misses.length).toBe(1);
		const changed = await cat.prime();
		expect(changed).toBe(false);
		expect(cat.version).toBe(0);
		expect(cat.misses.length).toBe(1); // still missing
	});

	it("misses are distinct and in first-seen order (ref vs source are distinct keys)", () => {
		const resolver: RelationResolver = { resolveRelation: () => undefined };
		const cat = new CallbackTemplateCatalog(resolver);
		cat.relation({ kind: "ref", nameParts: ["orders"] });
		cat.relation({ kind: "source", nameParts: ["raw", "events"] });
		cat.relation({ kind: "ref", nameParts: ["orders"] }); // dup — not re-recorded
		expect(cat.misses.length).toBe(2);
	});

	it("is a SchemaSource too — columnsFor delegates to the table resolver", () => {
		const cache = new Map<string, Column[]>([["analytics.orders", [{ name: "id", type: "int" }]]]);
		const tableResolver: TableResolver = { resolve: (parts) => cache.get(parts.join(".")) };
		// relation resolver deliberately answers nothing — a relation miss must not break the table side.
		const relResolverOnly: RelationResolver = { resolveRelation: () => undefined };
		const cat = new CallbackTemplateCatalog(relResolverOnly, tableResolver);

		expect(cat.columnsFor(["analytics", "orders"], "databricks")).toEqual([{ name: "id", type: "int" }]);
		expect(cat.columnsFor(["nope"], "databricks")).toBeUndefined(); // physical-table miss
		expect(cat.relation({ kind: "ref", nameParts: ["x"] })).toBeUndefined(); // relation miss — independent
		// misses carries BOTH the physical-table miss and the relation miss.
		expect(cat.misses.length).toBe(2);
		expect(cat.tables()).toEqual(["orders"]); // only the resolved physical table is revealed
	});

	it("a relation-only catalog (no table resolver) returns undefined for every columnsFor", () => {
		const resolver: RelationResolver = { resolveRelation: () => undefined };
		const cat = new CallbackTemplateCatalog(resolver);
		expect(cat.columnsFor(["anything"], "databricks")).toBeUndefined();
		expect(cat.tables()).toEqual([]);
	});

	it("prime() drains BOTH the table misses and the relation misses in one pass, bumping version once", async () => {
		const cache = new Map<string, Column[]>();
		const tableResolver: TableResolver = {
			resolve: (parts) => cache.get(parts.join(".")),
			fetch: async (missing) => {
				for (const m of missing)
					if (m.join(".") === "orders") cache.set("orders", [{ name: "a", type: "int" }]);
			},
		};
		const { resolver } = relResolver({
			customers: {
				nameParts: ["analytics", "customers"],
				columns: [{ name: "id", type: "int", nullable: false }],
			},
		});
		const cat = new CallbackTemplateCatalog(resolver, tableResolver);
		cat.columnsFor(["orders"], "databricks"); // table miss
		cat.relation({ kind: "ref", nameParts: ["customers"] }); // relation miss
		expect(cat.misses.length).toBe(2);

		const changed = await cat.prime();
		expect(changed).toBe(true);
		expect(cat.version).toBe(1); // ONE bump for both
		expect(cat.misses).toEqual([]); // both drained
		expect(cat.columnsFor(["orders"], "databricks")).toEqual([{ name: "a", type: "int" }]);
		expect(cat.relation({ kind: "ref", nameParts: ["customers"] })?.nameParts).toEqual(["analytics", "customers"]);
	});

	it("prime() coalesces concurrent calls (one fetch each resolver, one version bump)", async () => {
		const cache = new Map<string, Column[]>();
		let tableFetches = 0;
		let relFetches = 0;
		const tableResolver: TableResolver = {
			resolve: (parts) => cache.get(parts.join(".")),
			fetch: async (missing) => {
				tableFetches++;
				await new Promise((r) => setTimeout(r, 5)); // real async gap so the second prime() overlaps
				for (const m of missing)
					if (m.join(".") === "orders") cache.set("orders", [{ name: "a", type: "int" }]);
			},
		};
		const store: Record<string, ResolvedRelation> = {};
		const relationResolver: RelationResolver = {
			resolveRelation: (ref) => store[ref.nameParts.join(".")],
			fetchRelations: async (missing) => {
				relFetches++;
				await new Promise((r) => setTimeout(r, 5));
				for (const m of missing)
					if (m.nameParts.join(".") === "customers")
						store["customers"] = { nameParts: ["analytics", "customers"] };
			},
		};
		const cat = new CallbackTemplateCatalog(relationResolver, tableResolver);
		cat.columnsFor(["orders"], "databricks");
		cat.relation({ kind: "ref", nameParts: ["customers"] });

		const [r1, r2] = await Promise.all([cat.prime(), cat.prime()]);
		expect(r1).toBe(true);
		expect(r2).toBe(true);
		expect(tableFetches).toBe(1); // coalesced
		expect(relFetches).toBe(1); // coalesced
		expect(cat.version).toBe(1); // one bump, not two
		expect(cat.misses).toEqual([]); // drained

		expect(await cat.prime()).toBe(false); // no misses left — clean no-op
	});

	it("folds nameParts with the dialect table-fold before resolving — the resolver receives FOLDED parts", () => {
		const seen: TemplateRef[] = [];
		const resolver: RelationResolver = {
			resolveRelation: (ref) => {
				seen.push(ref);
				return undefined;
			},
		};
		const cat = new CallbackTemplateCatalog(resolver);
		cat.relation({ kind: "ref", nameParts: ["MySchema", "Orders"] }, "snowflake"); // snowflake unquoted → UPPER
		cat.relation({ kind: "source", nameParts: ['"KeepCase"'] }, "snowflake"); // quoted → preserved
		cat.relation({ kind: "ref", nameParts: ["Foo"] }, "databricks"); // databricks → lower
		expect(seen[0].nameParts).toEqual(["MYSCHEMA", "ORDERS"]);
		expect(seen[0].kind).toBe("ref");
		expect(seen[1].nameParts).toEqual(["KeepCase"]);
		expect(seen[2].nameParts).toEqual(["foo"]);
	});
});
