import { describe, expect, it } from "vitest";
import { analyze, Schema } from "../../src/index.js";

// issue #38 stages 3-4: resolution consumes QualifiedName keys instead of collapsing to the last
// part. Each case here was a probe-verified defect on 1.4.0 (see the issue); together they are
// the definition of done for the resolution half of the wave.

const schema = new Schema({
	prod: {
		gold: { orders: { id: "int", amount: "decimal" } },
		silver: { orders: { id: "int", raw: "string" } },
	},
});

const messages = (sql: string) => analyze(sql, "databricks", { schema }).diagnostics.map((d) => d.message);

describe("qualified references resolve by key suffix, never by bare-name fallback", () => {
	it("full FQN resolves (control)", () => {
		expect(messages("select amount from prod.gold.orders")).toEqual([]);
	});

	it("partial qualification (schema.table) resolves via suffix matching", () => {
		expect(messages("select amount from gold.orders")).toEqual([]);
	});

	it("a nonexistent qualified path is an unknown table in a closed world — never silently another schema's table", () => {
		const msgs = messages("select amount from prod.bronze.orders");
		expect(msgs.some((m) => /unknown table/i.test(m))).toBe(true);
		// and the wrong table's columns must NOT have been served:
		expect(msgs.some((m) => /unknown column: amount/i.test(m))).toBe(false); // suppressed source ⇒ no column noise
	});

	it("an ambiguous bare name (two suffix matches) is diagnosed, not first-wins", () => {
		const msgs = messages("select id from orders");
		expect(msgs.some((m) => /ambiguous/i.test(m) && /orders/i.test(m))).toBe(true);
	});
});

describe("column qualifiers are validated against the source's key, at any depth", () => {
	it("a 4-part column reference binds (catalog.schema.table.column)", () => {
		expect(messages("select prod.gold.orders.amount from prod.gold.orders")).toEqual([]);
	});

	it("a 3-part column reference binds (schema.table.column)", () => {
		expect(messages("select gold.orders.amount from prod.gold.orders")).toEqual([]);
	});

	it("a WRONG leading qualifier part does not bind", () => {
		const msgs = messages("select wrong.orders.amount from prod.gold.orders");
		expect(msgs.length).toBeGreaterThan(0); // unknown column/qualifier — anything but silence
	});

	it("joined FQN sources sharing a last part stay distinct through their qualifiers", () => {
		const sql =
			"select gold.orders.amount, silver.orders.raw from prod.gold.orders join prod.silver.orders on gold.orders.id = silver.orders.id";
		expect(messages(sql)).toEqual([]);
	});
});
