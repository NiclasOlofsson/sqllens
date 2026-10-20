import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { lineageOf, type LineageHop } from "../src/lineage/hops.js";
import { originsOf as originsOfExpr } from "../src/lineage/lineage.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";

const schema = new Schema({
	db: {
		fact: { tag_id: "string", amount: "int" },
		dim: { tag_id: "string", tag_name: "string" },
	},
});

function trace(sql: string) {
	const tree = resolveScopes(lower(parseDatabricks(sql).tree));
	if (tree.root.body.kind !== "select") throw new Error("Expected SELECT");
	const projection = tree.root.body.projections[0]!;
	const seen = new Set<LineageHop>();
	const pending = [lineageOf(projection, tree.root, schema)];
	const origins = new Set<string>();
	let unresolved = false;
	while (pending.length) {
		const hop = pending.pop()!;
		if (seen.has(hop)) continue;
		seen.add(hop);
		if (hop.terminal === "unresolved") unresolved = true;
		else for (const origin of hop.terminal ?? []) origins.add(`${origin.table.join(".")}.${origin.column}`);
		pending.push(...hop.downstream);
	}
	return {
		flat: originsOfExpr(projection.expr, tree.root, schema)
			.map((o) => `${o.table.join(".")}.${o.column}`)
			.sort(),
		hops: [...origins].sort(),
		unresolved,
	};
}

const join = "FROM db.fact f JOIN db.dim d ON f.tag_id = d.tag_id";

describe("qualified-star lineage across derived outputs (#52)", () => {
	for (const [name, sql] of [
		["CTE", `WITH c AS (SELECT d.tag_name, f.* ${join}) SELECT c.tag_id FROM c`],
		["derived table", `SELECT c.tag_id FROM (SELECT d.tag_name, f.* ${join}) c`],
		["nested CTE", `WITH c AS (SELECT d.tag_name, f.* ${join}), c2 AS (SELECT c.* FROM c) SELECT tag_id FROM c2`],
		["explicit control", `WITH c AS (SELECT d.tag_name, f.tag_id, f.amount ${join}) SELECT tag_id FROM c`],
		["single-source control", "WITH c AS (SELECT f.* FROM db.fact f) SELECT tag_id FROM c"],
		["EXCEPT", `WITH c AS (SELECT d.tag_name, f.* EXCEPT (amount) ${join}) SELECT tag_id FROM c`],
	] as const) {
		it(`preserves the qualified source through ${name}`, () => {
			expect(trace(sql)).toEqual({ flat: ["db.fact.tag_id"], hops: ["db.fact.tag_id"], unresolved: false });
		});
	}

	it("keeps every expression dependency after crossing a qualified star", () => {
		const sql = `WITH c AS (SELECT d.tag_name, f.* ${join}) SELECT SUM(IF(tag_id = 'A', amount, 0)) AS total FROM c`;
		expect(trace(sql)).toEqual({
			flat: ["db.fact.amount", "db.fact.tag_id"],
			hops: ["db.fact.amount", "db.fact.tag_id"],
			unresolved: false,
		});
	});

	it("does not choose a source when both selected stars expose the name", () => {
		expect(trace(`WITH c AS (SELECT f.*, d.* ${join}) SELECT tag_id FROM c`)).toEqual({
			flat: [],
			hops: [],
			unresolved: true,
		});
	});
});
