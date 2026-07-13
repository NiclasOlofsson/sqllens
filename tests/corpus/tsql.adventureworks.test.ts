import { existsSync } from "node:fs";
import { corpusPath } from "../helpers/corpus.js";
import { beforeAll, describe, expect, it } from "vitest";
import { displayName, foldIdentifier } from "../../src/dialect-behavior/public-fold.js";
import { inferType } from "../../src/infer/infer.js";
import { lineage } from "../../src/lineage/lineage.js";
import { qualify } from "../../src/qualify/qualify.js";
import { Schema } from "../../src/qualify/schema.js";
import { resolveScopes } from "../../src/scope/scope.js";
import { lower } from "../../src/tsql/lower.js";
import { parseTSql } from "../../src/tsql/parse.js";
import { parseAdventureWorks } from "../helpers/adventureworks.js";

// Microsoft AdventureWorks (vendor/adventureworks/instawdb.sql — a gitignored download; see
// tests/helpers/adventureworks.ts) is the first T-SQL corpus that pairs a real schema with real
// queries, so it's the first thing that exercises the *schema-fed* semantic layer (qualify / infer
// / lineage) on T-SQL rather than hand-written toys. The catalog (71 tables) feeds `Schema`; the 20
// view SELECTs run through parse -> lower -> scope -> qualify -> lineage. Several views use XML
// CROSS/OUTER APPLY or PIVOT (T-SQL `lower()` gaps), so not all 20 parse — the gate locks the
// portion that does and that the layer handles cleanly, plus concrete spot-checks with teeth.

const FILE = corpusPath("vendor/adventureworks/instawdb.sql");

describe.skipIf(!existsSync(FILE))("T-SQL semantic layer vs AdventureWorks (schema + views)", () => {
	// Read the corpus in beforeAll, not at suite-collection time: vitest still runs the describe
	// body to collect tests even when skipIf is true, so a top-level read throws ENOENT when the
	// gitignored file is absent. beforeAll runs only when the suite actually runs.
	let aw: ReturnType<typeof parseAdventureWorks>;
	let schema: Schema;
	beforeAll(() => {
		aw = parseAdventureWorks(FILE);
		schema = new Schema(aw.schema);
	});

	it("extracts the catalog from the DDL", () => {
		expect(aw.tableCount).toBeGreaterThanOrEqual(60);
		// a concrete table/column sanity check
		const addr = schema.columnsFor(["Person", "Address"], "tsql")?.map((c) => c.name) ?? [];
		expect(addr).toContain("AddressID");
		expect(addr).toContain("City");
	});

	it("parses every view and resolves it against the real catalog", () => {
		expect(aw.views.length).toBeGreaterThanOrEqual(18);
		let parsed = 0;
		let unknownTableTotal = 0;
		let columnCleanViews = 0;
		const parseFails: string[] = [];
		for (const v of aw.views) {
			const r = parseTSql(v.body);
			if (r.errors !== 0) {
				parseFails.push(v.name);
				continue;
			}
			parsed++;
			const tree = resolveScopes(lower(r.tree), "tsql"); // must not throw
			const q = qualify(tree, schema); // must not throw
			unknownTableTotal += q.diagnostics.filter((d) => d.kind === "unknown-table").length;
			if (!q.diagnostics.some((d) => d.kind === "unknown-column")) columnCleanViews++;
		}
		// The grammars-v4 T-SQL grammar parses all 20 views (APPLY/PIVOT/XML included — they parse even
		// where lower() doesn't yet model them), and the layer runs over each without throwing.
		expect(parseFails).toEqual([]);
		expect(parsed).toBe(aw.views.length);
		// Every table referenced by every view resolves against the extracted 71-table catalog.
		expect(unknownTableTotal).toBe(0);
		// Every view resolves every column against the real catalog — including the PIVOT view
		// (the pivoted relation is exposed under its alias) and the derived-table views.
		expect(columnCleanViews).toBe(aw.views.length);
	}, 60000);

	it("resolves real columns against the schema on a multi-join view (no unknown-table)", () => {
		const v = view("Sales.vStoreWithAddresses");
		const tree = resolveScopes(lower(parseTSql(v.body).tree), "tsql");
		const q = qualify(tree, schema);
		expect(q.diagnostics.filter((d) => d.kind === "unknown-table")).toEqual([]);
	}, 30000);

	it("traces an aliased view column back to its base table (lineage on real T-SQL)", () => {
		// [HumanResources].[vEmployeeDepartment]: `d.[Name] AS [Department]` where d = HumanResources.Department.
		// IR names are stored RAW (bracketed as written); look up / render via the identity fold +
		// displayName — Task 2 keep-raw.
		const v = view("HumanResources.vEmployeeDepartment");
		const tree = resolveScopes(lower(parseTSql(v.body).tree), "tsql");
		const dept = lineage(tree, schema).find((c) => foldIdentifier(c.output, "tsql") === "department");
		expect(dept?.origins.map((o) => [...o.table, o.column].map((p) => displayName(p, "tsql")).join("."))).toContain(
			"HumanResources.Department.Name",
		);
	}, 30000);

	it("infers a column's type from the real catalog (infer travels on real T-SQL)", () => {
		// vEmployeeDepartment projects `edh.[StartDate]` → EmployeeDepartmentHistory.StartDate (date).
		const v = view("HumanResources.vEmployeeDepartment");
		const tree = resolveScopes(lower(parseTSql(v.body).tree), "tsql");
		const body = tree.root.body;
		if (body.kind !== "select") throw new Error("select");
		const startDate = body.projections.find(
			(p) => p.name !== undefined && foldIdentifier(p.name, "tsql") === "startdate",
		);
		expect(inferType(startDate!.expr, tree.root, schema)).toEqual({ kind: "scalar", name: "date" });
	}, 30000);

	function view(name: string): { name: string; body: string } {
		const v = aw.views.find((x) => x.name.toLowerCase() === name.toLowerCase());
		if (!v) throw new Error(`view ${name} not found`);
		return v;
	}
});
