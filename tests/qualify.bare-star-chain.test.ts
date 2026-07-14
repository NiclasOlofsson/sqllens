import { describe, it, expect } from "vitest";
import { parse } from "../src/api.js";
import { parseTemplated } from "./helpers/templated.js";
import { resolveScopes, type Scope } from "../src/scope/scope.js";
import { resolveColumnRef } from "../src/sema/resolve.js";
import { Schema } from "../src/qualify/schema.js";
import { qualify } from "../src/qualify/qualify.js";
import { resolveColumnSource, outputNames } from "../src/sema/resolve.js";
import type { ColumnRef } from "../src/ir/ir.js";

// ---------------------------------------------------------------------------
// A bare column must bind through a schema-fed `SELECT *` chain across CTEs.
// `select * from {{ ref(...) }}` staging CTEs, then bare columns downstream, is
// one of THE most common dbt shapes — go-to-definition + hover run on it.
//
// The schema-fed binder is resolveColumnSource -> columnNamesOf -> outputNames,
// which expands a CTE's `SELECT *` against the schema. The defect (fixed here):
// outputNames threaded a `visited` set that was added-on-entry but NEVER removed,
// so it acted as a "seen-ever" set instead of a "current-path" stack. A `SELECT *`
// that expands two sibling sources reaching the SAME CTE scope (a staging CTE
// reused across a join) hit a FALSE cycle on the second sibling -> undefined ->
// the whole expansion collapsed to undefined -> bare columns downstream unbound.
// The fix makes `visited` a proper path stack (delete on exit): a genuine recursive
// CTE (scope on the active path) is still guarded, an off-path re-visit is allowed.
// ---------------------------------------------------------------------------

const schema = new Schema({
	gold__address: { city: "TEXT", country: "TEXT" },
	gold__warehouse: { gold_warehousekey: "TEXT" },
	phys_address: { city: "TEXT", country: "TEXT" },
	phys_warehouse: { gold_warehousekey: "TEXT" },
});

function cteScope(scopes: { root: Scope }, name: string): Scope {
	const s = scopes.root.ctes.get(name);
	if (!s) throw new Error(`no cte ${name}`);
	return s.scope;
}

describe("bare column through a schema-fed SELECT* chain across CTEs", () => {
	it("reporter's exact templated shape: bare `city` binds to the CTE that exposes it", () => {
		// Only address_with_country's columns include `city` (learned by expanding its
		// SELECT * against gold__address); gold__warehouse (wh) does not.
		const sql = `with address_with_country as ( select * from {{ ref('gold__address') }} ),
warehouses_enriched as (
    select city as warehouse_address_city
    from {{ ref('gold__warehouse') }} as wh
    left join address_with_country as addr on wh.gold_warehousekey = addr.city
)
select * from warehouses_enriched`;
		const res = parseTemplated(sql, "duckdb");
		const scopes = resolveScopes(res.sql.ast, "duckdb");
		const we = cteScope(scopes, "warehouses_enriched");

		const bound = resolveColumnSource(we, ["city"], schema);
		expect(bound).toBeDefined();
		expect(bound!.source.kind).toBe("cte"); // the address_with_country CTE (addr), not wh
		// It resolves to the SAME source object keyed `addr` in the scope.
		expect(bound!.source).toBe(we.sources.get("addr"));

		// And qualify does not flag it (it is bound, not unknown/ambiguous).
		expect(qualify(scopes, schema).diagnostics).toEqual([]);
	});

	it("non-templated twin of the reporter shape binds identically", () => {
		const sql = `with address_with_country as ( select * from phys_address ),
warehouses_enriched as (
    select city as warehouse_address_city
    from phys_warehouse as wh
    left join address_with_country as addr on wh.gold_warehousekey = addr.city
)
select * from warehouses_enriched`;
		const scopes = resolveScopes(parse(sql, "duckdb").ast, "duckdb");
		const we = cteScope(scopes, "warehouses_enriched");
		const bound = resolveColumnSource(we, ["city"], schema);
		expect(bound?.source.kind).toBe("cte");
		expect(bound!.source).toBe(we.sources.get("addr"));
		expect(qualify(scopes, schema).diagnostics).toEqual([]);
	});

	// --- the false-cycle case: a staging CTE reused across a join in a `SELECT *` ---
	// Before the fix, `enriched`'s star expansion reached `stg` via BOTH mid_a and
	// mid_b; the second reached an already-"visited" stg scope and returned undefined,
	// collapsing enriched's columns to undefined and unbinding the bare `country` below.

	it("templated: staging CTE reused across a join, bare column downstream binds", () => {
		const sql = `with stg as ( select * from {{ ref('gold__address') }} ),
mid_a as ( select * from stg ),
mid_b as ( select * from stg ),
enriched as ( select * from mid_a join mid_b on mid_a.city = mid_b.city ),
final as ( select country as c from enriched )
select * from final`;
		const res = parseTemplated(sql, "duckdb");
		const scopes = resolveScopes(res.sql.ast, "duckdb");

		// enriched's SELECT * must enumerate (two copies of the staging columns), not collapse.
		expect(outputNames(cteScope(scopes, "enriched"), schema)).toEqual(["city", "country", "city", "country"]);

		// The bare `country` in final binds through the chain.
		const final = cteScope(scopes, "final");
		const bound = resolveColumnSource(final, ["country"], schema);
		expect(bound?.source.kind).toBe("cte");
	});

	it("non-templated twin: staging CTE reused across a join binds the bare column", () => {
		const sql = `with stg as ( select * from phys_address ),
mid_a as ( select * from stg ),
mid_b as ( select * from stg ),
enriched as ( select * from mid_a join mid_b on mid_a.city = mid_b.city ),
final as ( select country as c from enriched )
select * from final`;
		const scopes = resolveScopes(parse(sql, "duckdb").ast, "duckdb");
		expect(outputNames(cteScope(scopes, "enriched"), schema)).toEqual(["city", "country", "city", "country"]);
		expect(resolveColumnSource(cteScope(scopes, "final"), ["country"], schema)?.source.kind).toBe("cte");
	});

	it("simple self-join diamond: SELECT * over the same CTE twice enumerates both copies", () => {
		const sql = `with a as ( select * from phys_address )
select * from a x join a y on x.city = y.city`;
		const scopes = resolveScopes(parse(sql, "duckdb").ast, "duckdb");
		expect(outputNames(scopes.root, schema)).toEqual(["city", "country", "city", "country"]);
	});

	// --- never-wrong guards: the fix must not fabricate a binding or drop ambiguity ---

	it("a genuinely ambiguous column across the star chain stays ambiguous (not silently bound)", () => {
		// `city` is present in BOTH mid_a and mid_b (each a SELECT * of stg); referencing it
		// unqualified is ambiguous and MUST be flagged, not quietly bound to the first source.
		const sql = `with stg as ( select * from phys_address ),
mid_a as ( select * from stg ),
mid_b as ( select * from stg )
select city from mid_a join mid_b on mid_a.country = mid_b.country`;
		const scopes = resolveScopes(parse(sql, "duckdb").ast, "duckdb");
		const diags = qualify(scopes, schema).diagnostics;
		expect(diags.some((d) => d.kind === "ambiguous-column")).toBe(true);
	});

	it("recursive CTE is still cycle-guarded (no infinite recursion, terminates)", () => {
		const sql = `with recursive r as ( select 1 as n union all select n + 1 from r where n < 5 )
select * from r`;
		const scopes = resolveScopes(parse(sql, "duckdb").ast, "duckdb");
		// The recursive self-reference must not loop forever; the non-recursive branch names the output.
		expect(outputNames(scopes.root, schema)).toEqual(["n"]);
	});

	it("a truly unknown bare column does not bind (no fabrication)", () => {
		const sql = `with stg as ( select * from phys_address )
select nope from stg`;
		const scopes = resolveScopes(parse(sql, "duckdb").ast, "duckdb");
		const ref: ColumnRef = { kind: "columnref", parts: ["nope"], clause: "projection", cst: {} as never };
		// schema-free resolveColumn: stg's columns ARE known (schema-fed elsewhere), but schema-free
		// they are "unknown" — so it needs a schema, never a false bind.
		const r = resolveColumnRef(scopes.root, ref);
		expect(r.kind).not.toBe("bound");
		// schema-fed: no source exposes `nope`, so it stays unbound (undefined), not fabricated.
		expect(resolveColumnSource(scopes.root, ["nope"], schema)).toBeUndefined();
	});
});
