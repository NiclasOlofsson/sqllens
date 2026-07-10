import { describe, it, expect } from "vitest";
import type { TemplateEngine, TemplatedParseResult } from "../src/index.js";
import { parseTemplated } from "../src/minijinja/index.js";

describe("TemplateEngine contract type", () => {
	it("parseTemplated satisfies the engine parse signature", () => {
		// compile-time proof: an object literal implementing the interface with the existing pipeline
		const probe: TemplateEngine = {
			name: "minijinja",
			parse: (text, dialect, opts) => parseTemplated(text, dialect, opts),
		};
		const r: TemplatedParseResult = probe.parse("select 1", "duckdb");
		expect(r.tags).toEqual([]);
		expect(probe.name).toBe("minijinja");
	});
});
