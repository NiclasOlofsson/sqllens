import { describe, expect, it } from "vitest";
import { parseType } from "../src/infer/types.js";
import { foldIdentifier } from "../src/dialect-behavior/public-fold.js";

describe("parseType", () => {
	it("parses a scalar and normalizes aliases", () => {
		expect(parseType("int")).toEqual({ kind: "scalar", name: "int" });
		expect(parseType("integer")).toEqual({ kind: "scalar", name: "int" });
		expect(parseType("BIGINT")).toEqual({ kind: "scalar", name: "bigint" });
		expect(parseType("varchar(255)")).toEqual({ kind: "scalar", name: "string" });
	});

	it("strips scalar precision/params", () => {
		expect(parseType("decimal(10,2)")).toEqual({ kind: "scalar", name: "decimal" });
	});

	it("parses array<T>", () => {
		expect(parseType("array<string>")).toEqual({
			kind: "array",
			element: { kind: "scalar", name: "string" },
		});
	});

	it("parses map<K,V>", () => {
		expect(parseType("map<string, int>")).toEqual({
			kind: "map",
			key: { kind: "scalar", name: "string" },
			value: { kind: "scalar", name: "int" },
		});
	});

	it("parses struct<...> with nested types", () => {
		expect(parseType("struct<a:int, b:array<string>>", undefined, (n) => foldIdentifier(n, "databricks"))).toEqual({
			kind: "struct",
			fields: [
				{ name: "a", type: { kind: "scalar", name: "int" } },
				{ name: "b", type: { kind: "array", element: { kind: "scalar", name: "string" } } },
			],
		});
	});

	it("returns unknown for empty or unparseable input", () => {
		expect(parseType("")).toEqual({ kind: "unknown" });
		expect(parseType("   ")).toEqual({ kind: "unknown" });
	});
});
