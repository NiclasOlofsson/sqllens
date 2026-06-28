// tests/lsp.feature-diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { Schema } from "../src/qualify/schema.js";
import { computeDiagnostics } from "../src/lsp/features/diagnostics.js";

// vscode-languageserver-types types Diagnostic.message as `string | MarkupContent`;
// computeDiagnostics only ever emits plain strings, so coerce for the assertions.
const msg = (m: string | { value: string }): string => (typeof m === "string" ? m : m.value);

describe("computeDiagnostics", () => {
	it("reports a positioned syntax diagnostic for broken SQL", () => {
		// `SELECT * FORM x` is rejected by the grammar (FORM is not a clause keyword);
		// `SELECT FROM` is NOT — the Databricks/Spark grammar accepts FROM as the projection.
		const ds = computeDiagnostics("SELECT * FORM x", "databricks");
		expect(ds.length).toBeGreaterThanOrEqual(1);
		expect(ds[0].range.start.line).toBe(0); // 0-based LSP line
		expect(msg(ds[0].message).length).toBeGreaterThan(0);
	});

	it("reports an unknown-column semantic diagnostic when a schema is fed", () => {
		const schema = new Schema({ sales: { amount: "decimal" } });
		const ds = computeDiagnostics("SELECT nope FROM sales", "databricks", schema);
		expect(ds.some((d) => /nope/i.test(msg(d.message)) || /unknown/i.test(msg(d.message)))).toBe(true);
	});

	it("is quiet for valid SQL with a matching schema", () => {
		const schema = new Schema({ sales: { amount: "decimal" } });
		expect(computeDiagnostics("SELECT amount FROM sales", "databricks", schema)).toEqual([]);
	});
});
