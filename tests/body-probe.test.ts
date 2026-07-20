import { describe, expect, it } from "vitest";
import { parse } from "../src/index.js";
import type { QueryExpr, SelectExpr } from "../src/ir/ir.js";
import { probeBody } from "./helpers/body-probe.js";

// Pins the body-non-emptiness probe's own behavior (tests/helpers/body-probe.ts) — see
// .claude/PLAN.md "Corpus gates can't see an empty lowered body" for the gap this closes.

function wrap(body: SelectExpr): QueryExpr {
	return { kind: "query", ctes: [], body, cst: {} as never };
}

describe("body-non-emptiness probe", () => {
	it("passes a normal select (real projections + FROM)", () => {
		const { ast } = parse("SELECT a FROM t", "duckdb");
		const hits: string[] = [];
		probeBody(ast, "normal.sql", hits);
		expect(hits).toEqual([]);
	});

	it("flags a synthetic empty body (no projections, no FROM, no unsupported)", () => {
		const empty: SelectExpr = {
			kind: "select",
			projections: [],
			from: [],
			columns: [],
			aggregated: false,
			cst: {} as never,
		};
		const hits: string[] = [];
		probeBody(wrap(empty), "empty.sql", hits);
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatch(/^empty\.sql:/);
	});

	it("passes a flagged-unsupported empty body (the broken/recovered case)", () => {
		const broken: SelectExpr = {
			kind: "select",
			projections: [],
			from: [],
			columns: [],
			aggregated: false,
			unsupported: ["broken"],
			cst: {} as never,
		};
		const hits: string[] = [];
		probeBody(wrap(broken), "broken.sql", hits);
		expect(hits).toEqual([]);
	});

	it("passes postgres's legal empty-projection form (SELECT FROM t)", () => {
		const { ast } = parse("SELECT FROM t", "postgres");
		const hits: string[] = [];
		probeBody(ast, "select-from.sql", hits);
		expect(hits).toEqual([]);
	});
});
