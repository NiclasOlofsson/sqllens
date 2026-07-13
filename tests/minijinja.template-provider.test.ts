import { describe, expect, it } from "vitest";
import { DbtTemplateProvider, DefaultTemplateProvider, type ExpansionShape, type TemplateCall } from "../src/index.js";
import { TestRelationProvider, relKey } from "./helpers/providers.js";

// ---------------------------------------------------------------------------
// The shipped template-resolution seam (the catalog-unification redesign). These pin:
//   1. the dbt builtin knowledge — carried by `DbtTemplateProvider`, NOT the neutral default
//      (ref/source are dbt macros, not minijinja knowledge): ref/source → a logical relation;
//      env_var → a string value; the no-output builtins → shape "nothing"; everything else → unknown;
//   2. the shape-derivation precedence in `DefaultTemplateProvider.expansion` (explicit wins;
//      relation → "relation", columns → "column-list", value → "expr");
//   3. the lazy machinery (recordMiss → misses → prime() → fetch → re-probe →
//      version bump, with in-flight coalescing).
// The neutral `DefaultTemplateProvider` knowing NONE of the dbt vocabulary is pinned in
// tests/minijinja.dbt-provider.test.ts.
// ---------------------------------------------------------------------------

describe("DefaultTemplateProvider — statelessness (safe to share as OPEN_PROVIDER)", () => {
	it("the bare base provider is STATELESS: safe to share as the no-schema default", async () => {
		const p = new DefaultTemplateProvider();
		// Consult unknown calls + tables heavily:
		for (let i = 0; i < 50; i++) {
			p.expansion({ name: `m${i}`, args: [] });
			p.columnsFor([`t${i}`]);
		}
		// The BASE records nothing (only subclass overrides call recordMiss/recordTableMiss):
		expect(p.misses).toEqual([]);
		expect(p.version).toBe(0);
		expect(await p.prime()).toBe(false);
	});
});

const call = (name: string, args: (string | null)[] = [], extra?: Partial<TemplateCall>): TemplateCall => ({
	name,
	args,
	...extra,
});

describe("DbtTemplateProvider — builtin knowledge", () => {
	const dp = new DbtTemplateProvider();

	it("ref('x') is a relation logically named x; ref('pkg','x') takes the LAST positional", () => {
		expect(dp.expansion(call("ref", ["orders"]))?.relation?.nameParts).toEqual(["orders"]);
		expect(dp.expansion(call("ref", ["pkg", "orders"]))?.relation?.nameParts).toEqual(["orders"]);
	});

	it("ref(model='x') resolves through the kwarg; a computed model does not fabricate", () => {
		expect(
			dp.expansion(call("ref", [], { kwargs: [{ name: "model", value: "orders" }] }))?.relation?.nameParts,
		).toEqual(["orders"]);
		expect(dp.expansion(call("ref", [null]))?.relation).toBeUndefined();
	});

	it("source(a,b) is a two-part logical relation; computed args do not fabricate", () => {
		expect(dp.expansion(call("source", ["raw", "events"]))?.relation?.nameParts).toEqual(["raw", "events"]);
		expect(dp.expansion(call("source", ["raw", null]))?.relation).toBeUndefined();
	});

	it("env_var is a string value; var is unknown (host knowledge)", () => {
		expect(dp.expansion(call("env_var", ["HOME"]))?.value).toEqual({ type: "string" });
		expect(dp.expansion(call("var", ["x"]))?.value).toBeUndefined();
	});

	it("the no-output builtins answer shape 'nothing' — bare and package-leading", () => {
		for (const name of ["config", "docs", "print", "log", "return"]) {
			expect(dp.expansion(call(name))?.shape).toBe("nothing");
		}
		expect(dp.expansion(call("raise_compiler_error", ["x"], { packageParts: ["exceptions"] }))?.shape).toBe(
			"nothing",
		);
	});

	it("an unknown macro has NO expansion at all (the zero-knowledge floor)", () => {
		expect(dp.expansion(call("my_macro", ["a"]))).toBeUndefined();
		expect(dp.expansion(call("star", [null], { packageParts: ["dbt_utils"] }))).toBeUndefined();
	});
});

describe("DefaultTemplateProvider — shape derivation precedence", () => {
	it("relation derives 'relation', value derives 'expr'; an explicit shapeOf always wins", () => {
		const dp = new DbtTemplateProvider();
		expect(dp.expansion(call("ref", ["x"]))?.shape).toBe("relation");
		expect(dp.expansion(call("env_var", ["X"]))?.shape).toBe("expr");

		class Forced extends DefaultTemplateProvider {
			override shapeOf(): ExpansionShape {
				return "statement";
			}
		}
		expect(new Forced().expansion(call("ref", ["x"]))?.shape).toBe("statement");
	});

	it("columns derive 'column-list'", () => {
		class Cols extends DefaultTemplateProvider {
			override columnsOf(): { name: string }[] {
				return [{ name: "a" }, { name: "b" }];
			}
		}
		const e = new Cols().expansion(call("star_cols"));
		expect(e?.shape).toBe("column-list");
		expect(e?.columns?.map((c) => c.name)).toEqual(["a", "b"]);
	});
});

describe("DefaultTemplateProvider — lazy machinery (miss → prime → version)", () => {
	const ORDERS = { nameParts: ["analytics", "orders"], columns: [{ name: "id", type: "int", nullable: false }] };

	it("a cold relationOf records a miss; warming the cache resolves without prime", () => {
		const p = new TestRelationProvider();
		expect(p.expansion(call("ref", ["orders"]))?.relation).toBeUndefined();
		expect(p.misses.length).toBe(1);
		p.cache.set(relKey("ref", ["orders"]), ORDERS);
		expect(p.expansion(call("ref", ["orders"]))?.relation?.nameParts).toEqual(["analytics", "orders"]);
	});

	it("prime() drains through fetchExpansions, re-probes, bumps version ONCE, returns true", async () => {
		const p = new TestRelationProvider();
		p.pending.set(relKey("ref", ["orders"]), ORDERS);
		p.expansion(call("ref", ["orders"])); // miss
		p.expansion(call("ref", ["orders"])); // duplicate — coalesces
		expect(p.misses.length).toBe(1);
		expect(p.version).toBe(0);

		expect(await p.prime()).toBe(true);
		expect(p.version).toBe(1);
		expect(p.misses.length).toBe(0);
		expect(p.expansion(call("ref", ["orders"]))?.relation?.columns?.map((c) => c.name)).toEqual(["id"]);
	});

	it("a still-cold miss re-records itself on the prime re-probe and stays on the list", async () => {
		const p = new TestRelationProvider(); // nothing pending — fetch warms nothing
		p.expansion(call("ref", ["nope"]));
		expect(await p.prime()).toBe(false);
		expect(p.version).toBe(0);
		expect(p.misses.length).toBe(1); // re-recorded by the re-probe, ready for the next prime
	});

	it("prime() with no misses resolves false immediately; concurrent primes coalesce", async () => {
		const p = new TestRelationProvider();
		expect(await p.prime()).toBe(false);

		p.pending.set(relKey("ref", ["orders"]), ORDERS);
		p.expansion(call("ref", ["orders"]));
		const a = p.prime();
		const b = p.prime();
		expect(a).toBe(b); // the SAME in-flight promise
		expect(await a).toBe(true);
		expect(p.version).toBe(1);
	});

	it("table misses (columnsFor side) drain through the same prime", async () => {
		class Tables extends TestRelationProvider {
			readonly pendingTables = new Map<string, { name: string }[]>();
			override columnsFor(parts: string[]): { name: string }[] | undefined {
				const hit = this.tableColumns.get(parts.join("."));
				if (hit) return hit;
				this.recordTableMiss(parts);
				return undefined;
			}
			protected override fetchTables(missing: string[][]): Promise<void> {
				for (const parts of missing) {
					const p = this.pendingTables.get(parts.join("."));
					if (p) this.tableColumns.set(parts.join("."), p);
				}
				return Promise.resolve();
			}
		}
		const p = new Tables();
		p.pendingTables.set("t", [{ name: "a" }]);
		expect(p.columnsFor(["t"])).toBeUndefined();
		expect(p.misses.length).toBe(1);
		expect(await p.prime()).toBe(true);
		expect(p.columnsFor(["t"])?.map((c) => c.name)).toEqual(["a"]);
	});
});
