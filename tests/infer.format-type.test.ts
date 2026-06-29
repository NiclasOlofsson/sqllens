import { describe, it, expect } from "vitest";
import { formatType } from "../src/infer/types.js";

describe("formatType", () => {
	it("renders scalars, arrays, maps, structs, and unknown", () => {
		expect(formatType({ kind: "scalar", name: "decimal" })).toBe("decimal");
		expect(formatType({ kind: "array", element: { kind: "scalar", name: "string" } })).toBe("array<string>");
		expect(
			formatType({
				kind: "map",
				key: { kind: "scalar", name: "string" },
				value: { kind: "scalar", name: "int" },
			}),
		).toBe("map<string,int>");
		expect(
			formatType({
				kind: "struct",
				fields: [
					{ name: "city", type: { kind: "scalar", name: "string" } },
					{ name: "zip", type: { kind: "scalar", name: "int" } },
				],
			}),
		).toBe("struct<city:string,zip:int>");
		expect(formatType({ kind: "unknown" })).toBe("unknown");
	});
});
