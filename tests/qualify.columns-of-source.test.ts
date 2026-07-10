import { describe, it, expect } from "vitest";
import { analyze, Schema } from "../src/index.js";

describe("Qualification.columnsOfSource", () => {
	it("returns a source's typed columns and never double-diagnoses", () => {
		const schema = new Schema({ t: { a: "int", b: "string" } });
		const a = analyze("SELECT a FROM t", "duckdb", { schema });
		const src = [...a.scopes.root.sources.values()][0];
		const before = a.diagnostics.length;
		const cols = a.qualification.columnsOfSource(a.scopes.root, src);
		const again = a.qualification.columnsOfSource(a.scopes.root, src);
		expect(cols).not.toBe("unknown");
		expect((cols as { name: string }[]).map((c) => c.name)).toEqual(["a", "b"]);
		// Typed, not names-only: a schema-known table's columns arrive with their declared types
		// (via the same tableSourceColumns path infer/nullability/sema-resolve read).
		expect((cols as { name: string; type?: string }[]).find((c) => c.name === "a")?.type).toBe("int");
		expect(again).toEqual(cols);
		expect(a.diagnostics.length).toBe(before); // idempotent — no diagnostic side effects
	});
	it("answers 'unknown' without a schema", () => {
		const a = analyze("SELECT a FROM t", "duckdb");
		const src = [...a.scopes.root.sources.values()][0];
		expect(a.qualification.columnsOfSource(a.scopes.root, src)).toBe("unknown");
	});
});
