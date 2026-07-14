import { describe, expect, it } from "vitest";
import { qualify, toScopes, Schema, formatType, inferType, type Column, type TableResolver } from "../src/index.js";
import { inferNullability } from "../src/infer/nullability.js";
import type { ResolvedRelation } from "../src/index.js";
import { parseTemplated } from "./helpers/templated.js";
import { TestRelationProvider, relKey as relKeyOf } from "./helpers/providers.js";

// ---------------------------------------------------------------------------
// inc3.1 — qualify resolves a templated source's REAL columns through a
// TemplateCatalog.relation, upgrading the R3 blanket exemption to real
// resolution WHEN a catalog answers. Never-wrong: unknown-column fires against a
// templated ref ONLY when `relation` positively returned columns and the column
// is absent. A `relation` miss (undefined) OR a plain SchemaProvider → the R3
// exemption (no fabricated column). A zero-catalog run is byte-identical to R3.
// ---------------------------------------------------------------------------

/** Miss-identity key over the shared TestRelationProvider (call name + arg path). */
function relKey(ref: { kind: "ref" | "source"; nameParts: string[] }): string {
	return relKeyOf(ref.kind, ref.nameParts);
}

const ORDERS: ResolvedRelation = {
	nameParts: ["orders"],
	columns: [{ name: "id" }, { name: "total" }],
};

/** A warm catalog: `orders` (a ref) and `raw.events` (a source) resolve to real columns immediately. */
function warmCatalog(): TestRelationProvider {
	const r = new TestRelationProvider();
	r.cache.set(relKey({ kind: "ref", nameParts: ["orders"] }), ORDERS);
	r.cache.set(relKey({ kind: "source", nameParts: ["raw", "events"] }), {
		nameParts: ["raw", "events"],
		columns: [{ name: "event_id" }, { name: "ts" }],
	});
	return r;
}

const unknownCols = (q: { diagnostics: { kind: string; message: string }[] }) =>
	q.diagnostics.filter((d) => d.kind === "unknown-column");

describe("inc3.1 — qualify resolves templated columns via TemplateCatalog.relation", () => {
	it("resolved ref: a good column resolves (no unknown-column)", () => {
		const r = parseTemplated("SELECT o.id FROM {{ ref('orders') }} o", "databricks");
		const q = qualify(r.sql.ast, warmCatalog());
		expect(unknownCols(q)).toEqual([]);
	});

	it("resolved ref: a bad column FIRES unknown-column (real resolution)", () => {
		const r = parseTemplated("SELECT o.nope FROM {{ ref('orders') }} o", "databricks");
		const q = qualify(r.sql.ast, warmCatalog());
		expect(unknownCols(q).length).toBe(1);
		expect(unknownCols(q)[0]!.message).toContain("nope");
	});

	it("resolved ref: `SELECT *` expands to the real relation columns", () => {
		const tree = toScopes(parseTemplated("SELECT * FROM {{ ref('orders') }} o", "databricks").sql.ast);
		const q = qualify(tree, warmCatalog());
		expect(q.columnsOf(tree.root)).toEqual(["id", "total"]);
	});

	it("source('raw','events') resolves via the catalog the same way", () => {
		const good = parseTemplated("SELECT e.event_id FROM {{ source('raw','events') }} e", "databricks");
		expect(unknownCols(qualify(good.sql.ast, warmCatalog()))).toEqual([]);
		const bad = parseTemplated("SELECT e.nope FROM {{ source('raw','events') }} e", "databricks");
		expect(unknownCols(qualify(bad.sql.ast, warmCatalog())).length).toBe(1);
	});

	// --- Never-wrong: zero-catalog is the R3 exemption, byte-identical. ---

	it("zero-catalog (plain Schema): a bad column on a templated ref stays EXEMPT", () => {
		const r = parseTemplated("SELECT o.nope FROM {{ ref('orders') }} o", "databricks");
		const q = qualify(r.sql.ast, new Schema({ other: { x: "int" } }));
		expect(unknownCols(q)).toEqual([]);
	});

	it("zero-catalog (empty Schema): good column also exempt (unknown, not wrong)", () => {
		const r = parseTemplated("SELECT o.id FROM {{ ref('orders') }} o", "databricks");
		const q = qualify(r.sql.ast, new Schema({}));
		expect(unknownCols(q)).toEqual([]);
	});

	// --- Cold catalog: a miss is the exemption; after prime() the bad column fires. ---

	it("cold → exempt, then prime() → unknown-column fires for the bad column", async () => {
		const catalog = new TestRelationProvider();
		// Not warm yet, but `orders` is fetchable on prime.
		catalog.pending.set(relKey({ kind: "ref", nameParts: ["orders"] }), ORDERS);

		const sql = "SELECT o.nope FROM {{ ref('orders') }} o";
		// Cold: the ref is a miss → exemption, no unknown-column.
		const cold = qualify(parseTemplated(sql, "databricks").sql.ast, catalog);
		expect(unknownCols(cold)).toEqual([]);
		expect(catalog.misses.length).toBe(1);

		// Warm the catalog, then re-analyze.
		const changed = await catalog.prime();
		expect(changed).toBe(true);
		const warm = qualify(parseTemplated(sql, "databricks").sql.ast, catalog);
		expect(unknownCols(warm).length).toBe(1);
	});

	// --- Opaque templated sources never ask `relation`, never fabricate a column. ---

	it("opaque macro-in-FROM: still exempt with a catalog (no relation ask)", () => {
		const r = parseTemplated("SELECT m.col FROM {{ my_macro() }} m", "databricks");
		const q = qualify(r.sql.ast, warmCatalog());
		expect(unknownCols(q)).toEqual([]);
	});

	it("a real (non-templated) unknown table still fires with a catalog present", () => {
		const r = parseTemplated("SELECT * FROM real_missing_table", "databricks");
		const q = qualify(r.sql.ast, warmCatalog());
		expect(q.diagnostics.some((d) => d.kind === "unknown-table")).toBe(true);
	});

	// --- The physical-resolver branch: `relation` returns nameParts only (columns undefined), so
	//     qualify resolves those PHYSICAL parts through the catalog's own columnsFor (logical → physical
	//     → columns). This branch was uncovered by the Task-2 tests (Task-2 follow-up). ---

	/** A test table resolver: `cache` answers columnsFor synchronously by folded dotted path. */
	class TestTableResolver implements TableResolver {
		readonly cache = new Map<string, Column[]>();
		resolve(parts: string[]): Column[] | undefined {
			return this.cache.get(parts.join("."));
		}
	}

	/** A provider whose relation answer carries a PHYSICAL name with `columns: undefined`, backed by
	 *  a columnsFor side that (optionally) knows that physical relation's columns. */
	function physicalCatalog(physical: string[], physicalCols: Column[] | undefined): TestRelationProvider {
		const rel = new TestRelationProvider();
		// `orders` (a ref) resolves to a physical relation but WITHOUT columns (columns undefined).
		rel.cache.set(relKey({ kind: "ref", nameParts: ["orders"] }), { nameParts: physical });
		if (physicalCols) rel.tableColumns.set(physical.join("."), physicalCols);
		return rel;
	}

	it("relation nameParts only (columns undefined) → resolves through columnsFor (physical resolver)", () => {
		const catalog = physicalCatalog(["analytics", "orders"], [{ name: "id" }, { name: "total" }]);
		// A good physical column resolves (no unknown-column).
		const good = parseTemplated("SELECT o.total FROM {{ ref('orders') }} o", "databricks");
		expect(unknownCols(qualify(good.sql.ast, catalog))).toEqual([]);
		// A bad one FIRES — the physical resolver's columns are the real resolution.
		const bad = parseTemplated("SELECT o.nope FROM {{ ref('orders') }} o", "databricks");
		expect(unknownCols(qualify(bad.sql.ast, catalog)).length).toBe(1);
	});

	it("relation nameParts only, but the physical name MISSES in columnsFor → R3 exemption", () => {
		const catalog = physicalCatalog(["analytics", "orders"], undefined); // physical relation unknown
		const bad = parseTemplated("SELECT o.nope FROM {{ ref('orders') }} o", "databricks");
		expect(unknownCols(qualify(bad.sql.ast, catalog))).toEqual([]); // exempt: physical columns unknown
	});
});

// ---------------------------------------------------------------------------
// inc3.2 remainder (2026-07-05) — templated column TYPES thread through
// inference: a warm catalog's `relation` columns (type + nullable) answer
// inferType / inferNullability for `{{ ref('x') }}.col`, so hover/inlay types
// stop being dark on templated sources. The logical-name fallback (a plain
// Schema declaring model names) keeps typing exactly as before; qualify's
// diagnostic exemption stays CATALOG-ONLY (unchanged).
// ---------------------------------------------------------------------------
describe("inc3.2 — templated column types reach inference", () => {
	/** A warm catalog whose `orders` relation carries typed, nullability-tagged columns. */
	function typedCatalog(): TestRelationProvider {
		const r = new TestRelationProvider();
		r.cache.set(relKey({ kind: "ref", nameParts: ["orders"] }), {
			nameParts: ["prod", "core", "orders"],
			columns: [
				{ name: "id", type: "bigint", nullable: false },
				{ name: "total", type: "decimal(10,2)", nullable: true },
			],
		});
		return r;
	}

	function projectionType(sql: string, schema: Parameters<typeof inferType>[2]): string {
		const r = parseTemplated(sql, "databricks");
		const tree = toScopes(r.sql.ast);
		const body = tree.root.body as { projections: { expr: Parameters<typeof inferType>[0] }[] };
		return formatType(inferType(body.projections[0].expr, tree.root, schema));
	}

	it("inferType answers from the catalog relation columns", () => {
		expect(projectionType("SELECT o.total FROM {{ ref('orders') }} o", typedCatalog())).toBe("decimal");
		expect(projectionType("SELECT o.id FROM {{ ref('orders') }} o", typedCatalog())).toBe("bigint");
	});

	it("inferNullability answers from the catalog relation columns", () => {
		const r = parseTemplated("SELECT o.id, o.total FROM {{ ref('orders') }} o", "databricks");
		const tree = toScopes(r.sql.ast);
		const body = tree.root.body as { projections: { expr: Parameters<typeof inferNullability>[0] }[] };
		expect(inferNullability(body.projections[0].expr, tree.root, typedCatalog())).toBe("notnull");
		expect(inferNullability(body.projections[1].expr, tree.root, typedCatalog())).toBe("nullable");
	});

	it("catalog miss / opaque tag stays unknown (never-wrong)", () => {
		const cold = new TestRelationProvider();
		expect(projectionType("SELECT o.total FROM {{ ref('nope') }} o", cold)).toBe("unknown");
		expect(projectionType("SELECT m.x FROM {{ my_macro() }} m", typedCatalog())).toBe("unknown");
	});

	it("a plain Schema declaring the LOGICAL name still types (pre-inc3.2 fallback preserved)", () => {
		const schema = new Schema({ orders: { total: "decimal(10,2)" } });
		expect(projectionType("SELECT o.total FROM {{ ref('orders') }} o", schema)).toBe("decimal");
	});

	it("set-indirection composes: {% set t = ref(...) %} + catalog types the use site", () => {
		const sql = "{% set t = ref('orders') %}\nSELECT o.total FROM {{ t }} o";
		expect(projectionType(sql, typedCatalog())).toBe("decimal");
	});
});
