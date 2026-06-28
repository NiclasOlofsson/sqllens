import { describe, it, expect } from "vitest";
import { parseRedshift, lowerRedshift } from "../src/index.js";

describe("barrel exports redshift", () => {
	it("re-exports parseRedshift + lowerRedshift", () => {
		expect(typeof parseRedshift).toBe("function");
		expect(typeof lowerRedshift).toBe("function");
		expect(lowerRedshift(parseRedshift("SELECT 1").tree).kind).toBe("query");
	});
});
