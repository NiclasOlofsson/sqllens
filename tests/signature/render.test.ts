import { describe, expect, it } from "vitest";
import { renderSignature } from "../../src/signature/render.js";
import type { FnSignature } from "../../src/signature/signatures.js";

// issue #33: ONE canonical renderer emitting the vendor syntax notation the harvest mined
// (optional params bracketed and nested, variadic as a trailing ellipsis, types inline), so
// signature help, completion detail and hover show identical notation everywhere.

const sig = (name: string, params: FnSignature["params"], variadic?: boolean): FnSignature =>
	variadic ? { name, params, variadic } : { name, params };

describe("renderSignature", () => {
	it("renders a trailing optional param in vendor bracket notation, types inline", () => {
		const s = sig("round", [
			{ name: "v", type: "NUMERIC" },
			{ name: "s", type: "INTEGER", optional: true },
		]);
		expect(renderSignature(s)).toBe("round(v: NUMERIC [, s: INTEGER])");
	});

	it("nests a run of trailing optionals (the aes_decrypt shape)", () => {
		const s = sig("aes_decrypt", [
			{ name: "expr" },
			{ name: "key" },
			{ name: "mode", optional: true },
			{ name: "padding", optional: true },
			{ name: "aad", optional: true },
		]);
		expect(renderSignature(s)).toBe("aes_decrypt(expr, key [, mode [, padding [, aad]]])");
	});

	it("renders variadic as a trailing ellipsis", () => {
		expect(renderSignature(sig("concat", [{ name: "value" }], true))).toBe("concat(value, ...)");
	});

	it("compact form drops types but keeps the bracket structure", () => {
		const s = sig("round", [
			{ name: "v", type: "NUMERIC" },
			{ name: "s", type: "INTEGER", optional: true },
		]);
		expect(renderSignature(s, { types: false })).toBe("round(v [, s])");
	});

	it("renders a zero-param signature as bare parens", () => {
		expect(renderSignature(sig("current_date", []))).toBe("current_date()");
	});

	it("brackets a leading optional without a comma (all-optional shape)", () => {
		expect(renderSignature(sig("rand", [{ name: "seed", optional: true }]))).toBe("rand([seed])");
		expect(
			renderSignature(
				sig("f", [
					{ name: "a", optional: true },
					{ name: "b", optional: true },
				]),
			),
		).toBe("f([a [, b]])");
	});

	it("puts the variadic ellipsis inside the innermost bracket when the last param is optional", () => {
		const s = sig("json_array", [{ name: "a" }, { name: "b", optional: true }], true);
		expect(renderSignature(s)).toBe("json_array(a [, b, ...])");
	});

	it("treats a non-trailing optional as required (defensive: optionals must be trailing)", () => {
		const s = sig("f", [{ name: "a", optional: true }, { name: "b" }]);
		expect(renderSignature(s)).toBe("f(a, b)");
	});
});
