import { describe, expect, it } from "vitest";
import { toScopes, qualify, lineage, Schema } from "../src/index.js";
import { parseTemplated } from "./helpers/templated.js";
import type { ResolvedSource } from "../src/scope/scope.js";

// ---------------------------------------------------------------------------
// R3 pipeline proof (docs/minijinja-front-end.md §R3). Task 1 attached `template` +
// the real dbt-logical name onto a templated FROM/JOIN source; Task 2 makes the
// downstream pipeline correct over it: scope binds the model name, lineage
// reports the model (not the `jjj…` placeholder), and qualify EXEMPTS a
// templated source from unknown-table/-column diagnostics — a diagnostic
// against a templated source's dbt-logical name would be never-wrong-violating
// (the physical relation is dbt knowledge sqllens doesn't have until inc3's
// catalog). The exemption is SCOPED: a real unknown table in hand-written SQL
// still fires. Both directions proven.
// ---------------------------------------------------------------------------

const sql = "SELECT o.id, o.total FROM {{ ref('orders') }} o WHERE o.total > 0";

/** The table source keyed by `key` in the root scope (undefined if none). */
function tableSource(
	tree: ReturnType<typeof toScopes>,
	key: string,
): Extract<ResolvedSource, { kind: "table" }> | undefined {
	const src = tree.root.sources.get(key);
	return src && src.kind === "table" ? src : undefined;
}

describe("R3 pipeline — scope/qualify/lineage over templated sources", () => {
	it("scope binds the ref model name (not the placeholder); o resolves to orders", () => {
		const r = parseTemplated(sql, "databricks");
		const tree = toScopes(r.sql.ast);
		// The FROM source is keyed by its alias `o` and carries the dbt-logical name `orders`.
		const o = tableSource(tree, "o");
		expect(o).toBeDefined();
		expect(o!.name).toEqual(["orders"]);
		// It is marked templated (Task 1's ref binding), never the `jjj…` placeholder run.
		expect(o!.source.template?.call?.name).toBe("ref");
		expect(o!.name.join(".")).not.toMatch(/jjj/);
	});

	it("lineage origins report the model, not the placeholder", () => {
		const r = parseTemplated(sql, "databricks");
		const origins = lineage(r.sql.ast, new Schema({})).originsOf("id");
		expect(JSON.stringify(origins)).toContain("orders");
		expect(JSON.stringify(origins)).not.toMatch(/jjj/);
		expect(origins).toEqual([{ table: ["orders"], column: "id" }]);
	});

	it("qualify with a schema that lacks the model emits NO unknown-table/-column", () => {
		const r = parseTemplated(sql, "databricks");
		const schema = new Schema({ other_table: { x: "int" } });
		const q = qualify(r.sql.ast, schema);
		const bad = q.diagnostics.filter((d) => d.kind === "unknown-table" || d.kind === "unknown-column");
		expect(bad).toEqual([]);
	});

	it("`SELECT *` over a templated source exempts unknown-table (columns read unknown)", () => {
		const r = parseTemplated("SELECT * FROM {{ ref('orders') }}", "databricks");
		const tree = toScopes(r.sql.ast);
		const q = qualify(tree, new Schema({ other: { x: "int" } }));
		expect(q.diagnostics.filter((d) => d.kind === "unknown-table")).toEqual([]);
		// The star can't be expanded without a catalog for the model — columns are unknown, not wrong.
		expect(q.columnsOf(tree.root)).toBe("unknown");
	});

	it("qualify against a NON-templated unknown table still fires (guard is scoped)", () => {
		const r = parseTemplated("SELECT * FROM real_missing_table", "databricks");
		const q = qualify(r.sql.ast, new Schema({ other: { x: "int" } }));
		expect(q.diagnostics.some((d) => d.kind === "unknown-table")).toBe(true);
	});

	it("opaque macro source: no diagnostics, columns unknown", () => {
		const r = parseTemplated("SELECT m.col FROM {{ my_macro() }} m", "databricks");
		const tree = toScopes(r.sql.ast);
		// The macro FROM tag is opaque (name stays the placeholder, template.opaque set).
		const m = tableSource(tree, "m");
		expect(m?.source.template?.kind).toBe("call"); // consultable (call attached), no longer opaque
		expect(m?.source.template?.call?.name).toBe("my_macro");
		const q = qualify(tree, new Schema({ other: { x: "int" } }));
		const bad = q.diagnostics.filter((d) => d.kind === "unknown-table" || d.kind === "unknown-column");
		expect(bad).toEqual([]);
	});
});
