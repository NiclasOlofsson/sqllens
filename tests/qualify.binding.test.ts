import { describe, expect, it } from "vitest";
import { parseTemplated, toScopes, qualify, Schema } from "../src/index.js";
import type { ColumnRef } from "../src/ir/ir.js";
import type { Scope } from "../src/scope/scope.js";

// Qualification.bindingOf — the read-only column→source binding the extension consumes for BARE columns
// (a read-only qualify never rewrites `city` → `addr.city`, so the binding must be queryable). The
// load-bearing case: a bare column that binds through a schema-fed SELECT* staging CTE.

const SCHEMA = new Schema({
	gold__address: { city: "TEXT", country: "TEXT" },
	gold__warehouse: { gold_warehousekey: "TEXT" },
});

/** Walk the scope tree for the first scope whose sources include a key EXACTLY `key` (exact, not
 *  substring — `"addr"` must not match a `gold__address` source key). */
function scopeWithSource(root: Scope, key: string): Scope | undefined {
	const hit = [...root.sources.keys()].some((k) => k === key);
	if (hit) return root;
	for (const c of root.children) {
		const f = scopeWithSource(c, key);
		if (f) return f;
	}
	return undefined;
}

/** Find the first ColumnRef whose leaf part folds to `name` anywhere under an IR node. */
function findColumnRef(node: unknown, name: string, seen = new Set<unknown>()): ColumnRef | undefined {
	if (!node || typeof node !== "object" || seen.has(node)) return undefined;
	seen.add(node);
	const n = node as Record<string, unknown>;
	if (Array.isArray((n as { parts?: unknown }).parts) && (n as { kind?: unknown }).kind === undefined) {
		const parts = n.parts as string[];
		if (parts[parts.length - 1]?.toLowerCase() === name) return n as unknown as ColumnRef;
	}
	for (const v of Object.values(n)) {
		if (v === (n as { cst?: unknown }).cst) continue; // don't descend the antlr back-ref
		const f = Array.isArray(v)
			? v.map((x) => findColumnRef(x, name, seen)).find(Boolean)
			: findColumnRef(v, name, seen);
		if (f) return f;
	}
	return undefined;
}

describe("Qualification.bindingOf", () => {
	const sql = `with address_with_country as ( select * from {{ ref('gold__address') }} ),
warehouses_enriched as (
  select city as warehouse_address_city
  from {{ ref('gold__warehouse') }} as wh
  left join address_with_country as addr on wh.gold_warehousekey = addr.city
)
select * from warehouses_enriched`;

	it("binds a BARE column through a schema-fed SELECT* staging CTE to its source (the anvil repro)", () => {
		const r = parseTemplated(sql, "duckdb");
		const scopes = toScopes(r.sql.ast);
		const q = qualify(scopes, SCHEMA);
		const we = scopeWithSource(scopes.root, "addr")!;
		const cityRef = findColumnRef(r.sql.ast, "city")!; // the bare `city` in warehouses_enriched's SELECT
		expect(we).toBeDefined();
		expect(cityRef.parts).toEqual(["city"]);
		const binding = q.bindingOf(we, cityRef);
		expect(binding).toBeDefined();
		// bound to addr (address_with_country) — the only visible source exposing `city`
		expect(binding!.column.toLowerCase()).toBe("city");
		expect(binding!.source.kind).toBe("cte"); // addr aliases the address_with_country CTE
	});

	it("returns undefined for a genuinely unknown bare column (never a fabricated binding)", () => {
		const r = parseTemplated("select nope_col from {{ ref('gold__warehouse') }} as wh", "duckdb");
		const scopes = toScopes(r.sql.ast);
		const q = qualify(scopes, SCHEMA);
		const scope = scopeWithSource(scopes.root, "wh")!;
		const ref = findColumnRef(r.sql.ast, "nope_col")!;
		expect(q.bindingOf(scope, ref)).toBeUndefined();
	});

	it("returns undefined for a genuinely AMBIGUOUS bare column (never a wrong first-match)", () => {
		// `id` is exposed by BOTH a and b — the old first-match binder wrongly returned source a.
		const AMBIG = new Schema({ a: { id: "TEXT" }, b: { id: "TEXT" } });
		const r = parseTemplated("select id from a join b on a.id = b.id", "duckdb");
		const scopes = toScopes(r.sql.ast);
		const q = qualify(scopes, AMBIG);
		const scope = scopeWithSource(scopes.root, "a")!;
		const ref = findColumnRef(r.sql.ast, "id")!;
		expect(ref.parts).toEqual(["id"]);
		expect(q.bindingOf(scope, ref)).toBeUndefined();
	});

	it("binds a QUALIFIED column to its aliased source", () => {
		const r = parseTemplated("select wh.gold_warehousekey from {{ ref('gold__warehouse') }} as wh", "duckdb");
		const scopes = toScopes(r.sql.ast);
		const q = qualify(scopes, SCHEMA);
		const scope = scopeWithSource(scopes.root, "wh")!;
		const ref = findColumnRef(r.sql.ast, "gold_warehousekey")!;
		const binding = q.bindingOf(scope, ref);
		expect(binding?.source.kind).toBe("table");
		expect(binding?.column.toLowerCase()).toBe("gold_warehousekey");
	});
});
