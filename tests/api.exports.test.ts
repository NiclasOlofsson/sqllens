import { describe, it, expect } from "vitest";
import { nodeAt, endPosition, parse } from "../src/index.js";
import type {
	PipeExpr,
	PipeStage,
	LateralViewSource,
	GraphTableSource,
	PivotInfo,
	UnpivotInfo,
	Clause,
	WindowSpec,
	LimitInfo,
	NodeHit,
	ParseResult,
	ParserRuleContext,
} from "../src/index.js";

describe("barrel completeness", () => {
	it("exports the walk/position values", () => {
		expect(typeof nodeAt).toBe("function");
		expect(typeof endPosition).toBe("function");
	});
	it("union-member types are consumable", () => {
		// compile-time proof: naming each type in a signature must typecheck
		const f = (
			a: PipeStage,
			b: LateralViewSource,
			c: WindowSpec,
			d: NodeHit,
			e: ParseResult,
			g: ParserRuleContext,
		): void => void [a, b, c, d, e, g];
		expect(typeof f).toBe("function");
		const r: ParseResult = { ...parse("SELECT 1", "duckdb"), tree: parse("SELECT 1", "duckdb").cst } as never;
		void r;
	});
});
