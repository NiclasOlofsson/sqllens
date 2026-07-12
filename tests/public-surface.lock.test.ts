import { describe, expect, it } from "vitest";
import * as api from "../src/api.js";
import * as index from "../src/index.js";

// The frozen public surface. Adding/removing/renaming an export, or changing a public function's
// declared arity, breaks this on purpose (the dialect-behavior refactor must be an INTERNAL
// restructure only). If you MEANT to change the surface, this test is the deliberate gate — do not
// edit it to make a refactor pass; change it only when a public change is intended.
describe("public surface is frozen", () => {
	it("api.ts exports exactly the expected names", () => {
		expect(Object.keys(api).sort()).toMatchSnapshot("api-exports");
	});

	it("index.ts exports exactly the expected names", () => {
		expect(Object.keys(index).sort()).toMatchSnapshot("index-exports");
	});

	it("public function arities are unchanged", () => {
		const arities = Object.fromEntries(
			Object.entries(api)
				.filter(([, v]) => typeof v === "function")
				.map(([k, v]) => [k, (v as (...a: unknown[]) => unknown).length]),
		);
		expect(arities).toMatchSnapshot("api-fn-arities");
	});

	it("does NOT leak the internal dialect-behavior seam", () => {
		for (const barrel of [api, index] as Record<string, unknown>[]) {
			expect("DialectBehavior" in barrel).toBe(false);
			expect("resolveBehavior" in barrel).toBe(false);
			expect("behaviorOf" in barrel).toBe(false);
			expect("bindBehavior" in barrel).toBe(false);
		}
	});
});
