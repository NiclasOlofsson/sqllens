import { describe, it, expect } from "vitest";
import { SqlDocument } from "../../src/document/document.js";
import { Schema } from "../../src/qualify/schema.js";
import { formatType } from "../../src/infer/types.js";

// ---------------------------------------------------------------------------
// SqlDocument: the persistent, immutable per-document model. It runs the
// schema-free pipeline once in create(), is frozen (an edit yields a new
// instance), is position-addressable (tokenAt / nodeAt), and memoizes the
// schema-dependent analyze(schema) by schema identity.
// ---------------------------------------------------------------------------

describe("SqlDocument", () => {
	it("create() runs the schema-free pipeline once and freezes the instance", () => {
		const doc = SqlDocument.create("SELECT amount FROM sales", "databricks");
		expect(doc.tokens.length).toBeGreaterThan(0);
		expect(doc.ast.kind).toBe("query");
		expect(doc.scopes.root).toBeDefined();
		expect(Object.isFrozen(doc)).toBe(true);
	});

	it("tokenAt() resolves the identifier under an offset", () => {
		const doc = SqlDocument.create("SELECT amount FROM sales", "databricks");
		const tok = doc.tokenAt(doc.text.indexOf("amount"));
		expect(tok?.role).toBe("identifier");
		expect(tok?.text).toBe("amount");
	});

	it("nodeAt() finds the column expr under an offset", () => {
		const doc = SqlDocument.create("SELECT amount FROM sales", "databricks");
		const hit = doc.nodeAt(doc.text.indexOf("amount"));
		expect(hit).toBeDefined();
		expect(hit?.expr.kind).toBe("column");
	});

	it("create() is total — broken input does not throw and still yields a query AST", () => {
		const doc = SqlDocument.create("(((", "databricks");
		expect(doc.ast.kind).toBe("query");
	});

	it("withText() returns a new instance and leaves the original untouched", () => {
		const doc = SqlDocument.create("SELECT amount FROM sales", "databricks");
		const original = doc.text;
		const d2 = doc.withText("SELECT id FROM sales", doc.version + 1);
		expect(d2).not.toBe(doc);
		expect(d2.text).not.toBe(doc.text);
		expect(doc.text).toBe(original);
		expect(d2.version).toBe(doc.version + 1);
	});

	it("analyze(schema) types a column and memoizes by schema identity", () => {
		const doc = SqlDocument.create("SELECT amount FROM sales", "databricks");
		const schema = new Schema({ sales: { amount: "decimal", id: "int" } });
		const a = doc.analyze(schema);

		const hit = doc.nodeAt(doc.text.indexOf("amount"));
		expect(hit).toBeDefined();
		const type = a.types.typeOf(hit!.expr, hit!.scope);
		expect(formatType(type)).toMatch(/decimal/);

		// Same schema instance returns the identical cached analysis object.
		expect(doc.analyze(schema)).toBe(a);
	});
});
