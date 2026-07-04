import { describe, expect, it } from "vitest";
import { parseTemplated, qualify, toScopes, Schema } from "../src/index.js";
import {
	CallbackTemplateCatalog,
	type RelationResolver,
	type ResolvedRelation,
	type TemplateRef,
} from "../src/qualify/template-catalog.js";

// ---------------------------------------------------------------------------
// inc3.1 — qualify resolves a templated source's REAL columns through a
// TemplateCatalog.relation, upgrading the R3 blanket exemption to real
// resolution WHEN a catalog answers. Never-wrong: unknown-column fires against a
// templated ref ONLY when `relation` positively returned columns and the column
// is absent. A `relation` miss (undefined) OR a plain SchemaSource → the R3
// exemption (no fabricated column). A zero-catalog run is byte-identical to R3.
// ---------------------------------------------------------------------------

/** Miss-identity key, mirroring template-catalog.ts's internal relKey (kind + folded dotted path). */
function relKey(ref: TemplateRef): string {
	return `${ref.kind}|${ref.nameParts.join(".")}`;
}

/** A test host cache: `cache` answers `resolveRelation` synchronously; `pending` is what a later
 *  `fetchRelations` (prime) warms into `cache`. Both receive FOLDED parts (the catalog folds first). */
class TestRelationResolver implements RelationResolver {
	readonly cache = new Map<string, ResolvedRelation>();
	readonly pending = new Map<string, ResolvedRelation>();
	resolveRelation(ref: TemplateRef): ResolvedRelation | undefined {
		return this.cache.get(relKey(ref));
	}
	async fetchRelations(missing: TemplateRef[]): Promise<void> {
		for (const ref of missing) {
			const k = relKey(ref);
			const p = this.pending.get(k);
			if (p) this.cache.set(k, p);
		}
	}
}

const ORDERS: ResolvedRelation = {
	nameParts: ["orders"],
	columns: [{ name: "id" }, { name: "total" }],
};

/** A warm catalog: `orders` (a ref) and `raw.events` (a source) resolve to real columns immediately. */
function warmCatalog(): CallbackTemplateCatalog {
	const r = new TestRelationResolver();
	r.cache.set(relKey({ kind: "ref", nameParts: ["orders"] }), ORDERS);
	r.cache.set(relKey({ kind: "source", nameParts: ["raw", "events"] }), {
		nameParts: ["raw", "events"],
		columns: [{ name: "event_id" }, { name: "ts" }],
	});
	return new CallbackTemplateCatalog(r);
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
		const resolver = new TestRelationResolver();
		// Not warm yet, but `orders` is fetchable on prime.
		resolver.pending.set(relKey({ kind: "ref", nameParts: ["orders"] }), ORDERS);
		const catalog = new CallbackTemplateCatalog(resolver);

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
});
