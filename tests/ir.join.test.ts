import type { ParserRuleContext } from "antlr4ng";
import { describe, expect, it } from "vitest";
import type { Join, SelectExpr } from "../src/ir/ir.js";
import { lower as lowerDatabricks } from "../src/databricks/lower.js";
import { lower as lowerTSql } from "../src/tsql/lower.js";
import { lower as lowerSnowflake } from "../src/snowflake/lower.js";
import { lower as lowerBigQuery } from "../src/bigquery/lower.js";
import { lower as lowerRedshift } from "../src/redshift/lower.js";
import { lower as lowerPostgres } from "../src/postgres/lower.js";
import { lower as lowerDuckdb } from "../src/duckdb/lower.js";
import { lower as lowerTrino } from "../src/trino/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { parseTSql } from "../src/tsql/parse.js";
import { parseSnowflake } from "../src/snowflake/parse.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { parseRedshift } from "../src/redshift/parse.js";
import { parsePostgres } from "../src/postgres/parse.js";
import { parseDuckdb } from "../src/duckdb/parse.js";
import { parseTrino } from "../src/trino/parse.js";
import { lower as lowerSqlite } from "../src/sqlite/lower.js";
import { parseSqlite } from "../src/sqlite/parse.js";
import { lower as lowerMysql } from "../src/mysql/lower.js";
import { parseMysql } from "../src/mysql/parse.js";

// P1 (Anvil): the additive Join[] view over the FROM join chain. Per dialect: a 3-join chain (spans
// ordered left-to-right, each covering its own JOIN…ON text), a USING join where the grammar has one,
// kind coverage over the dialect's surface, ON reference-EQUAL to the joinConditions entry, source
// reference-IDENTICAL to the from entry, and single-table → joins undefined. The `from`/joinConditions
// content is asserted unchanged by the corpus IR-hash-diff oracle, not here.

type LowerFn = (tree: ParserRuleContext) => { body: unknown };
interface Dialect {
	name: string;
	parse: (sql: string) => { tree: ParserRuleContext };
	lower: LowerFn;
	/** Trino's `relation` is left-recursive, so a JoinRelation's span includes the left input — the
	 *  join spans are cumulative (base…ON) rather than the isolated `JOIN x ON …` of every other dialect. */
	cumulativeSpans?: boolean;
}

function sel(d: Dialect, sql: string): SelectExpr {
	const body = d.lower(d.parse(sql).tree).body as SelectExpr;
	if (body.kind !== "select") throw new Error(`${d.name}: expected a select body, got ${body.kind}`);
	return body;
}
function span(sql: string, cst: ParserRuleContext): string {
	const start = cst.start?.start ?? 0;
	const stop = cst.stop?.stop ?? -1;
	return sql.slice(start, stop + 1);
}

const DIALECTS: Record<string, Dialect> = {
	databricks: { name: "databricks", parse: parseDatabricks, lower: lowerDatabricks as LowerFn },
	tsql: { name: "tsql", parse: parseTSql, lower: lowerTSql as LowerFn },
	snowflake: { name: "snowflake", parse: parseSnowflake, lower: lowerSnowflake as LowerFn },
	bigquery: { name: "bigquery", parse: parseBigQuery, lower: lowerBigQuery as LowerFn },
	redshift: { name: "redshift", parse: parseRedshift, lower: lowerRedshift as LowerFn },
	postgres: { name: "postgres", parse: parsePostgres, lower: lowerPostgres as LowerFn },
	duckdb: { name: "duckdb", parse: parseDuckdb, lower: lowerDuckdb as LowerFn },
	trino: { name: "trino", parse: parseTrino, lower: lowerTrino as LowerFn, cumulativeSpans: true },
	sqlite: { name: "sqlite", parse: parseSqlite, lower: lowerSqlite as LowerFn },
	mysql: { name: "mysql", parse: parseMysql, lower: lowerMysql as LowerFn },
};

// --- Shared per-dialect assertions ------------------------------------------

/** A 3-join INNER chain. Every dialect writes this identically (ANSI JOIN … ON). */
const CHAIN = "SELECT * FROM a JOIN b ON a.x = b.x JOIN c ON b.y = c.y JOIN d ON c.z = d.z";

for (const key of Object.keys(DIALECTS)) {
	const d = DIALECTS[key];
	describe(`Join IR — ${d.name}`, () => {
		it("a 3-join chain: three joins in source order, source/on reference-shared", () => {
			const s = sel(d, CHAIN);
			expect(s.joins?.length, "three joins").toBe(3);
			const joins = s.joins as Join[];
			// order: b, c, d — the joined (right) source name is the last from entry per step
			const names = joins.map((j) =>
				j.source.kind === "table" ? j.source.relation.parts.join(".") : j.source.kind,
			);
			expect(names).toEqual(["b", "c", "d"]);
			for (const j of joins) {
				// source reference-IDENTICAL to a from entry
				expect(s.from.includes(j.source), `${d.name}: join.source is a from entry`).toBe(true);
				// on reference-EQUAL to a joinConditions entry
				expect(j.on, "join has ON").toBeDefined();
				expect(s.joinConditions?.includes(j.on!), `${d.name}: join.on is a joinConditions entry`).toBe(true);
				expect(j.kind).toBe("inner");
			}
			// spans ordered left-to-right, each ending at its own JOIN…ON text
			const texts = joins.map((j) => span(CHAIN, j.cst));
			if (d.cumulativeSpans) {
				// Trino's left-recursive relation: each join span starts at the base and GROWS through the
				// chain (cumulative slices — exactly the debugger's progressive stages).
				expect(texts[0].endsWith("JOIN b ON a.x = b.x")).toBe(true);
				expect(texts[1].endsWith("JOIN c ON b.y = c.y")).toBe(true);
				expect(texts[2].endsWith("JOIN d ON c.z = d.z")).toBe(true);
				expect(texts[0].length).toBeLessThan(texts[1].length);
				expect(texts[1].length).toBeLessThan(texts[2].length);
			} else {
				// Isolated per-step spans: `[type] JOIN <table> [ON …]`, the src/ir/ir.ts Join.cst construct.
				// sqlite joins this branch once its join_step sub-rule gives a full-construct node (task A-R8).
				expect(texts[0]).toBe("JOIN b ON a.x = b.x");
				expect(texts[1]).toBe("JOIN c ON b.y = c.y");
				expect(texts[2]).toBe("JOIN d ON c.z = d.z");
				// span STARTS strictly increase (isolated spans begin at successive JOIN keywords). Not true
				// of cumulative spans, which all start at the base — hence this lives in the isolated branch.
				const starts = joins.map((j) => j.cst.start?.start ?? -1);
				expect(starts[0]).toBeLessThan(starts[1]);
				expect(starts[1]).toBeLessThan(starts[2]);
			}
			// stop offsets strictly increase (source order left-to-right — holds for both span styles)
			const stops = joins.map((j) => j.cst.stop?.stop ?? -1);
			expect(stops[0]).toBeLessThan(stops[1]);
			expect(stops[1]).toBeLessThan(stops[2]);
		});

		it("single-table select → joins undefined", () => {
			const s = sel(d, "SELECT * FROM a");
			expect(s.joins).toBeUndefined();
		});

		it("comma-separated sources are not joins", () => {
			const s = sel(d, "SELECT * FROM a, b");
			expect(s.joins).toBeUndefined();
			expect(s.from.length).toBe(2);
		});
	});
}

// --- USING joins (where the grammar supports one) ---------------------------

const USING_CASES: Record<string, string> = {
	databricks: "SELECT * FROM a JOIN b USING (x)",
	snowflake: "SELECT * FROM a JOIN b USING (x)",
	bigquery: "SELECT * FROM a JOIN b USING (x)",
	redshift: "SELECT * FROM a JOIN b USING (x)",
	postgres: "SELECT * FROM a JOIN b USING (x)",
	duckdb: "SELECT * FROM a JOIN b USING (x)",
	trino: "SELECT * FROM a JOIN b USING (x)",
	sqlite: "SELECT * FROM a JOIN b USING (x)",
	mysql: "SELECT * FROM a JOIN b USING (x)",
};
for (const key of Object.keys(USING_CASES)) {
	const d = DIALECTS[key];
	it(`Join IR — ${d.name}: USING join carries the column list, no ON`, () => {
		const s = sel(d, USING_CASES[key]);
		expect(s.joins?.length).toBe(1);
		const j = (s.joins as Join[])[0];
		expect(j.using).toEqual(["x"]);
		expect(j.on).toBeUndefined();
		expect(s.from.includes(j.source)).toBe(true);
	});
}

// --- Per-dialect kind coverage ----------------------------------------------

function kindsOf(d: Dialect, sql: string): string[] {
	return (sel(d, sql).joins ?? []).map((j) => j.kind);
}

describe("Join kind coverage", () => {
	it("databricks: left/cross/full/semi/anti + natural flag", () => {
		const d = DIALECTS.databricks;
		expect(kindsOf(d, "SELECT * FROM a LEFT JOIN b ON a.x = b.x")).toEqual(["left"]);
		expect(kindsOf(d, "SELECT * FROM a FULL OUTER JOIN b ON a.x = b.x")).toEqual(["full"]);
		expect(kindsOf(d, "SELECT * FROM a CROSS JOIN b")).toEqual(["cross"]);
		expect(kindsOf(d, "SELECT * FROM a LEFT SEMI JOIN b ON a.x = b.x")).toEqual(["semi"]);
		expect(kindsOf(d, "SELECT * FROM a LEFT ANTI JOIN b ON a.x = b.x")).toEqual(["anti"]);
		const nat = sel(d, "SELECT * FROM a NATURAL LEFT JOIN b");
		expect(nat.joins?.[0].kind).toBe("left");
		expect(nat.joins?.[0].natural).toBe(true);
	});

	it("tsql: left/cross/full; APPLY is not a join", () => {
		const d = DIALECTS.tsql;
		expect(kindsOf(d, "SELECT * FROM a LEFT JOIN b ON a.x = b.x")).toEqual(["left"]);
		expect(kindsOf(d, "SELECT * FROM a FULL OUTER JOIN b ON a.x = b.x")).toEqual(["full"]);
		expect(kindsOf(d, "SELECT * FROM a CROSS JOIN b")).toEqual(["cross"]);
		// CROSS APPLY contributes a from source but no Join node.
		const ap = sel(d, "SELECT * FROM a CROSS APPLY dbo.f(a.x) AS t");
		expect(ap.joins).toBeUndefined();
		expect(ap.from.length).toBe(2);
	});

	it("snowflake: left/cross/full/natural/asof", () => {
		const d = DIALECTS.snowflake;
		// Snowflake's as_alias is greedy: after a bare table `a LEFT JOIN b` reads LEFT as a's alias
		// (a pre-existing grammar precision gap, tracked as an open gap). LEFT OUTER / an aliased left side
		// disambiguates, and the kind is then modelled faithfully.
		expect(kindsOf(d, "SELECT * FROM a LEFT OUTER JOIN b ON a.x = b.x")).toEqual(["left"]);
		expect(kindsOf(d, "SELECT * FROM a FULL OUTER JOIN b ON a.x = b.x")).toEqual(["full"]);
		expect(kindsOf(d, "SELECT * FROM a CROSS JOIN b")).toEqual(["cross"]);
		const nat = sel(d, "SELECT * FROM a NATURAL JOIN b");
		expect(nat.joins?.[0].kind).toBe("natural");
		expect(nat.joins?.[0].natural).toBe(true);
		expect(kindsOf(d, "SELECT * FROM a ASOF JOIN b MATCH_CONDITION (a.t >= b.t) ON a.k = b.k")).toEqual(["asof"]);
	});

	it("bigquery: left/cross/full/inner + natural flag", () => {
		const d = DIALECTS.bigquery;
		expect(kindsOf(d, "SELECT * FROM a LEFT JOIN b ON a.x = b.x")).toEqual(["left"]);
		expect(kindsOf(d, "SELECT * FROM a FULL OUTER JOIN b ON a.x = b.x")).toEqual(["full"]);
		expect(kindsOf(d, "SELECT * FROM a CROSS JOIN b")).toEqual(["cross"]);
		expect(kindsOf(d, "SELECT * FROM a INNER JOIN b ON a.x = b.x")).toEqual(["inner"]);
	});

	for (const key of ["redshift", "postgres"] as const) {
		it(`${key}: left/cross/full + natural flag`, () => {
			const d = DIALECTS[key];
			expect(kindsOf(d, "SELECT * FROM a LEFT JOIN b ON a.x = b.x")).toEqual(["left"]);
			expect(kindsOf(d, "SELECT * FROM a FULL OUTER JOIN b ON a.x = b.x")).toEqual(["full"]);
			expect(kindsOf(d, "SELECT * FROM a CROSS JOIN b")).toEqual(["cross"]);
			const nat = sel(d, "SELECT * FROM a NATURAL JOIN b");
			expect(nat.joins?.[0].kind).toBe("natural");
			expect(nat.joins?.[0].natural).toBe(true);
		});
	}

	it("duckdb: left/cross/full/semi/anti/positional/asof", () => {
		const d = DIALECTS.duckdb;
		expect(kindsOf(d, "SELECT * FROM a LEFT JOIN b ON a.x = b.x")).toEqual(["left"]);
		expect(kindsOf(d, "SELECT * FROM a FULL OUTER JOIN b ON a.x = b.x")).toEqual(["full"]);
		expect(kindsOf(d, "SELECT * FROM a CROSS JOIN b")).toEqual(["cross"]);
		// SEMI/ANTI are non-reserved in the DuckDB grammar: after a BARE table `a SEMI JOIN b` reads SEMI
		// as the alias of `a` (a pre-existing grammar precision gap, tracked as an open gap). With the left
		// side aliased, the SEMI/ANTI keyword lands in join_type and the kind is modelled faithfully.
		expect(kindsOf(d, "SELECT * FROM a AS x SEMI JOIN b ON x.k = b.k")).toEqual(["semi"]);
		expect(kindsOf(d, "SELECT * FROM a AS x ANTI JOIN b ON x.k = b.k")).toEqual(["anti"]);
		expect(kindsOf(d, "SELECT * FROM a POSITIONAL JOIN b")).toEqual(["positional"]);
		// ASOF is likewise non-reserved; alias the left side so it lands as the join keyword.
		expect(kindsOf(d, "SELECT * FROM a AS x ASOF JOIN b ON x.t >= b.t")).toEqual(["asof"]);
	});

	it("trino: left/cross/full + natural flag", () => {
		const d = DIALECTS.trino;
		expect(kindsOf(d, "SELECT * FROM a LEFT JOIN b ON a.x = b.x")).toEqual(["left"]);
		expect(kindsOf(d, "SELECT * FROM a FULL OUTER JOIN b ON a.x = b.x")).toEqual(["full"]);
		expect(kindsOf(d, "SELECT * FROM a CROSS JOIN b")).toEqual(["cross"]);
		const nat = sel(d, "SELECT * FROM a NATURAL JOIN b");
		expect(nat.joins?.[0].kind).toBe("natural");
		expect(nat.joins?.[0].natural).toBe(true);
	});

	it("sqlite: left/right/cross/full/inner + natural flag", () => {
		const d = DIALECTS.sqlite;
		expect(kindsOf(d, "SELECT * FROM a LEFT JOIN b ON a.x = b.x")).toEqual(["left"]);
		// RIGHT / FULL joins exist since SQLite 3.39 (sqlite.org/lang_select.html).
		expect(kindsOf(d, "SELECT * FROM a RIGHT JOIN b ON a.x = b.x")).toEqual(["right"]);
		expect(kindsOf(d, "SELECT * FROM a FULL OUTER JOIN b ON a.x = b.x")).toEqual(["full"]);
		expect(kindsOf(d, "SELECT * FROM a CROSS JOIN b")).toEqual(["cross"]);
		expect(kindsOf(d, "SELECT * FROM a INNER JOIN b ON a.x = b.x")).toEqual(["inner"]);
		const nat = sel(d, "SELECT * FROM a NATURAL JOIN b");
		expect(nat.joins?.[0].kind).toBe("natural");
		expect(nat.joins?.[0].natural).toBe(true);
	});

	it("mysql: left/right/cross/inner + natural flag; no FULL (grammar has no FULL JOIN production)", () => {
		const d = DIALECTS.mysql;
		expect(kindsOf(d, "SELECT * FROM a LEFT JOIN b ON a.x = b.x")).toEqual(["left"]);
		expect(kindsOf(d, "SELECT * FROM a RIGHT JOIN b ON a.x = b.x")).toEqual(["right"]);
		expect(kindsOf(d, "SELECT * FROM a CROSS JOIN b")).toEqual(["cross"]);
		expect(kindsOf(d, "SELECT * FROM a INNER JOIN b ON a.x = b.x")).toEqual(["inner"]);
		const nat = sel(d, "SELECT * FROM a NATURAL JOIN b");
		expect(nat.joins?.[0].kind).toBe("natural");
		expect(nat.joins?.[0].natural).toBe(true);
		// MySQL's joinPart production only has INNER/CROSS/LEFT/RIGHT/NATURAL/STRAIGHT_JOIN alternatives
		// (grammars/mysql/MysqlParser.g4) — no FULL keyword branch, matching real MySQL (no FULL OUTER
		// JOIN until you emulate it with a UNION). A genuine grammar gap, not a lowering omission.
		expect(parseMysql("SELECT * FROM a FULL OUTER JOIN b ON a.x = b.x").errors).toBeGreaterThan(0);
		// STRAIGHT_JOIN is MySQL-specific (a join-order hint) and lowers to "inner" — documented in
		// src/mysql/lower.ts's joinKind() doc comment.
		expect(kindsOf(d, "SELECT * FROM a STRAIGHT_JOIN b ON a.x = b.x")).toEqual(["inner"]);
	});
});
