// tests/lsp.feature-diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { Schema } from "../src/qualify/schema.js";
import { SqlDocument } from "../src/document/document.js";
import { computeDiagnostics } from "../src/lsp/features/diagnostics.js";

// vscode-languageserver-types types Diagnostic.message as `string | MarkupContent`;
// computeDiagnostics only ever emits plain strings, so coerce for the assertions.
const msg = (m: string | { value: string }): string => (typeof m === "string" ? m : m.value);

const doc = (sql: string) => SqlDocument.create(sql, "databricks");

describe("computeDiagnostics", () => {
	it("reports a positioned syntax diagnostic for broken SQL", () => {
		// `SELECT * FORM x` is rejected by the grammar (FORM is not a clause keyword);
		// `SELECT FROM` is NOT — the Databricks/Spark grammar accepts FROM as the projection.
		const ds = computeDiagnostics(doc("SELECT * FORM x"));
		expect(ds.length).toBeGreaterThanOrEqual(1);
		expect(ds[0].range.start.line).toBe(0); // 0-based LSP line
		expect(msg(ds[0].message).length).toBeGreaterThan(0);
	});

	it("reports an unknown-column semantic diagnostic when a schema is fed", () => {
		const schema = new Schema({ sales: { amount: "decimal" } });
		const ds = computeDiagnostics(doc("SELECT nope FROM sales"), schema);
		expect(ds.some((d) => /nope/i.test(msg(d.message)) || /unknown/i.test(msg(d.message)))).toBe(true);
	});

	it("is quiet for valid SQL with a matching schema", () => {
		const schema = new Schema({ sales: { amount: "decimal" } });
		expect(computeDiagnostics(doc("SELECT amount FROM sales"), schema)).toEqual([]);
	});
});
