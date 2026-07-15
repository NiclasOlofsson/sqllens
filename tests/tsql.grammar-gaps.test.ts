import { describe, expect, it } from "vitest";
import { lower } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";
import { resolveScopes } from "../src/scope/scope.js";
import type { SelectExpr } from "../src/ir/ir.js";

// Query-language constructs the official T-SQL reference documents but the grammars-v4
// fork did not parse (found by doc-coverage probing 2026-06-10): IS [NOT] DISTINCT FROM
// (2022), the WINDOW clause + OVER window_name (2022), FOR SYSTEM_TIME temporal queries,
// TABLESAMPLE, the documented two-arg FREETEXT predicate, and OPENQUERY as a FROM source.

function q(sql: string): SelectExpr {
	const r = parseTSql(sql);
	expect(r.errors, sql).toBe(0);
	const ir = lower(r.tree);
	expect(() => resolveScopes(ir, "tsql")).not.toThrow();
	if (ir.body.kind !== "select") throw new Error("expected select body");
	return ir.body;
}

/** Parse-only (errors === 0); for constructs whose lowering isn't the point. */
function parses(sql: string): void {
	expect(parseTSql(sql).errors, sql).toBe(0);
}

describe("CLR type static methods (geography/geometry/hierarchyid/UDT)", () => {
	it("static constructor method as a SELECT scalar", () => {
		parses("SELECT geography::STGeomFromText('LINESTRING(-122 47, -122 47)', 4326)");
		parses("SELECT geometry::Point(3, 4, 0)");
	});

	it("static method chained with an instance method", () => {
		parses("SELECT geography::Point(47.6, -122.3, 4326).STAsText() AS wkt");
	});

	it("hierarchyid static methods still parse", () => {
		parses("SELECT hierarchyid::GetRoot()");
	});

	it("static method whose name collides with a function keyword (Parse)", () => {
		parses("SELECT geography::Parse('POINT(-122 47)')");
	});

	it("static method on the right of an assignment in a SELECT list", () => {
		parses("SELECT @g = geography::STGeomFromText('POINT(0 0)', 4326)");
	});
});

describe("query OPTION clause (hints)", () => {
	it("OPTION (RECOMPILE)", () => {
		parses("SELECT a FROM t WHERE a = 1 OPTION (RECOMPILE)");
	});

	it("OPTION with USE HINT string list", () => {
		parses(
			"SELECT a FROM t WHERE a = 1 OPTION (RECOMPILE, USE HINT ('ASSUME_MIN_SELECTIVITY_FOR_FILTER_ESTIMATES', 'DISABLE_PARAMETER_SNIFFING'))",
		);
	});

	it("OPTION (MAXDOP n) and table hints together", () => {
		parses("SELECT a FROM t OPTION (MAXDOP 4, OPTIMIZE FOR UNKNOWN)");
	});

	it("OPTION (QUERYTRACEON n), including repeated", () => {
		parses("SELECT a FROM t WHERE a = 1 OPTION (QUERYTRACEON 4199)");
		parses("SELECT a FROM t WHERE a = 1 OPTION (QUERYTRACEON 4199, QUERYTRACEON 4137)");
	});
});

describe("IS [NOT] DISTINCT FROM (SQL Server 2022)", () => {
	it("lowers to a distinct-from predicate", () => {
		const body = q("SELECT a FROM t WHERE a IS DISTINCT FROM b");
		expect(body.where).toMatchObject({ kind: "predicate", op: "distinct from", negated: false });
	});

	it("negated form", () => {
		const body = q("SELECT a FROM t WHERE a IS NOT DISTINCT FROM b");
		expect(body.where).toMatchObject({ kind: "predicate", op: "distinct from", negated: true });
	});

	it("plain IS NULL still lowers as a null predicate", () => {
		const body = q("SELECT a FROM t WHERE a IS NOT NULL");
		expect(body.where).toMatchObject({ kind: "predicate", op: "null", negated: true });
	});
});

describe("WINDOW clause + OVER window_name (SQL Server 2022)", () => {
	it("OVER w resolves to the named window's spec", () => {
		const body = q("SELECT row_number() OVER w AS rn FROM t WINDOW w AS (PARTITION BY a ORDER BY b)");
		const fn = body.projections[0]?.expr;
		if (fn?.kind !== "function") throw new Error("expected function");
		expect(fn.window?.partitionBy).toHaveLength(1);
		expect(fn.window?.orderBy).toHaveLength(1);
	});

	it("OVER (w ORDER BY c) takes the base window's partition and its own order", () => {
		const body = q("SELECT sum(x) OVER (w ORDER BY c) AS s FROM t WINDOW w AS (PARTITION BY a)");
		const fn = body.projections[0]?.expr;
		if (fn?.kind !== "function") throw new Error("expected function");
		expect(fn.window?.partitionBy).toHaveLength(1);
		expect(fn.window?.orderBy).toHaveLength(1);
	});

	it("a window can be based on another named window", () => {
		const body = q("SELECT sum(x) OVER w2 AS s FROM t WINDOW w1 AS (PARTITION BY a), w2 AS (w1 ORDER BY b)");
		const fn = body.projections[0]?.expr;
		if (fn?.kind !== "function") throw new Error("expected function");
		expect(fn.window?.partitionBy).toHaveLength(1);
		expect(fn.window?.orderBy).toHaveLength(1);
	});
});

describe("temporal queries — FOR SYSTEM_TIME (from-transact-sql#system_time)", () => {
	it.each([
		"AS OF '2024-01-01'",
		"FROM '2024-01-01' TO '2024-02-01'",
		"BETWEEN '2024-01-01' AND '2024-02-01'",
		"CONTAINED IN ('2024-01-01', '2024-02-01')",
		"ALL",
	])("parses FOR SYSTEM_TIME %s and still resolves the table", (clause) => {
		const body = q(`SELECT * FROM t FOR SYSTEM_TIME ${clause}`);
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t"] } });
	});

	it("works with an alias after the temporal clause", () => {
		const body = q("SELECT x.a FROM t FOR SYSTEM_TIME AS OF '2024-01-01' AS x");
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t"] }, alias: "x" });
	});
});

describe("TABLESAMPLE (from-transact-sql#tablesample-clause)", () => {
	it("percent form with SYSTEM and REPEATABLE", () => {
		const body = q("SELECT * FROM t TABLESAMPLE SYSTEM (10 PERCENT) REPEATABLE (123)");
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t"] } });
	});

	it("rows form after an alias", () => {
		const body = q("SELECT s.a FROM t AS s TABLESAMPLE (100 ROWS)");
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t"] }, alias: "s" });
	});
});

describe("FREETEXT predicate (freetext-transact-sql: column list first, no table arg)", () => {
	it("two-arg form", () => {
		q("SELECT a FROM t WHERE FREETEXT(a, 'phrase')");
	});

	it("column list + LANGUAGE", () => {
		q("SELECT a FROM t WHERE FREETEXT((a, b), 'phrase', LANGUAGE 1033)");
	});

	it("star form", () => {
		q("SELECT a FROM t WHERE FREETEXT(*, 'phrase')");
	});
});

describe("OPENQUERY as a FROM source (openquery-transact-sql)", () => {
	it("parses and exposes an opaque aliased source", () => {
		const body = q("SELECT x.a FROM OPENQUERY(srv, 'SELECT 1 AS a') AS x");
		expect(body.from[0]).toMatchObject({ kind: "table", alias: "x" });
	});
});
