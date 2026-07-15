import { describe, expect, it } from "vitest";
import { inferType } from "../src/infer/infer.js";
import { lineage } from "../src/lineage/lineage.js";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { resolveColumnRef } from "../src/sema/resolve.js";
import { deriveSymbols } from "../src/symbols/symbols.js";
import { lower } from "../src/snowflake/lower.js";
import { parseSnowflake } from "../src/snowflake/parse.js";

// The point of the shared IR: the semantic layer (scope, qualify, infer, lineage, symbols)
// runs on Snowflake-lowered queries unchanged. These tests prove a Snowflake query flows
// through every semantic stage, and that inference uses Snowflake's knowledge (literals,
// function registry, type aliases) rather than another dialect's.

function scopes(sql: string) {
	return resolveScopes(lower(parseSnowflake(sql).tree), "snowflake");
}

function typeOf(sql: string, schema = new Schema({})) {
	const tree = scopes(sql);
	const body = tree.root.body;
	if (body.kind !== "select") throw new Error("expected select");
	return inferType(body.projections[0].expr, tree.root, schema);
}

const T = new Schema({ t: { a: "number", s: "varchar", ts: "timestamp_ntz", v: "variant" } });

describe("Snowflake scope resolution", () => {
	it("resolves CTEs and table aliases", () => {
		const tree = scopes("WITH c AS (SELECT a FROM t) SELECT c.a FROM c");
		expect(tree.root.body.kind).toBe("select");
		// The CTE is visible as a source in the root scope, keyed by its FOLDED identity — an
		// unquoted Snowflake identifier is "stored and resolved as uppercase" (docs.snowflake.com/
		// en/sql-reference/identifiers-syntax), so unquoted `c` keys as C (and `C.a`/`c.a` both bind).
		const names = [...tree.root.sources.keys()];
		expect(names).toContain("C");
	});

	it("exposes FLATTEN's lateral columns to the scope", () => {
		// Same fold rule: the unquoted lateral alias `f` keys as F.
		const tree = scopes("SELECT f.value FROM t, LATERAL FLATTEN(input => t.v) f");
		expect([...tree.root.sources.keys()]).toContain("F");
	});

	// CONNECT BY exposes the LEVEL pseudo-column: docs.snowflake.com/en/sql-reference/constructs/connect-by
	it("binds LEVEL as a pseudo-column on a CONNECT BY hierarchical select", () => {
		const tree = scopes(
			"SELECT employee_ID, title, LEVEL FROM employees START WITH title = 'President' CONNECT BY manager_ID = PRIOR employee_id",
		);
		const body = tree.root.body;
		if (body.kind !== "select") throw new Error("expected select");
		expect(body.unsupported).toBeUndefined();
		const levelRef = body.columns.find((c) => c.parts.join(".").toLowerCase() === "level");
		expect(levelRef).toBeDefined();
		expect(resolveColumnRef(tree.root, levelRef!).kind).toBe("bound");
	});

	// LEVEL is a pseudo-column (like Oracle's): it must resolve by name but must NOT appear in a
	// bare `*` expansion. docs.snowflake.com/en/sql-reference/constructs/connect-by
	it("excludes LEVEL from a schema-fed `SELECT *` on a CONNECT BY query", () => {
		const schema = new Schema({ employees: { employee_id: "number", title: "varchar", manager_id: "number" } });
		const tree = scopes(
			"SELECT * FROM employees START WITH title = 'President' CONNECT BY manager_ID = PRIOR employee_id",
		);
		expect(qualify(tree, schema).columnsOf(tree.root)).toEqual(["employee_id", "title", "manager_id"]);
	});

	it("still binds LEVEL by name alongside a `SELECT *` on a CONNECT BY query", () => {
		const tree = scopes(
			"SELECT *, LEVEL FROM employees START WITH title = 'President' CONNECT BY manager_ID = PRIOR employee_id",
		);
		const body = tree.root.body;
		if (body.kind !== "select") throw new Error("expected select");
		const levelRef = body.columns.find((c) => c.parts.join(".").toLowerCase() === "level");
		expect(levelRef).toBeDefined();
		expect(resolveColumnRef(tree.root, levelRef!).kind).toBe("bound");
	});

	// Non-regression: FLATTEN's lateral columns are real output columns and must keep joining `*`.
	it("still joins FLATTEN's lateral columns into a schema-fed `SELECT *`", () => {
		const schema = new Schema({ t: { v: "variant" } });
		const tree = scopes("SELECT * FROM t, LATERAL FLATTEN(input => t.v) f");
		expect(qualify(tree, schema).columnsOf(tree.root)).toEqual([
			"v",
			"SEQ",
			"KEY",
			"PATH",
			"INDEX",
			"VALUE",
			"THIS",
		]);
	});
});

// CREATE MATERIALIZED VIEW's `AS select_statement` (docs.snowflake.com/en/sql-reference/sql/
// create-materialized-view) must route its body like the sibling CREATE forms (CREATE VIEW,
// CTAS, CREATE TASK): a real select, not an opaque nonquery. (A tracked open gap.)
describe("Snowflake CREATE MATERIALIZED VIEW body routing", () => {
	it("lowers the AS SELECT body like sibling CREATE forms (CREATE VIEW's convention)", () => {
		const mv = lower(parseSnowflake("CREATE MATERIALIZED VIEW mv AS SELECT a, b FROM t").tree);
		const view = lower(parseSnowflake("CREATE VIEW v AS SELECT a, b FROM t").tree);
		// Same statement-kind stamp as its sibling CREATE VIEW.
		expect(mv.statement).toBe(view.statement);
		expect(mv.body.kind).toBe("select");
		if (mv.body.kind !== "select") throw new Error("expected select");
		expect(mv.body.unsupported).toBeUndefined();
		expect(mv.body.projections.map((p) => p.expr)).toEqual(
			[
				{ kind: "column", parts: ["a"], partSpans: expect.anything() },
				{ kind: "column", parts: ["b"], partSpans: expect.anything() },
			].map((e) => expect.objectContaining(e)),
		);
		expect(mv.body.from.map((s) => (s.kind === "table" ? s.relation.parts.join(".") : s.kind))).toEqual(["t"]);

		const tree = resolveScopes(mv, "snowflake");
		const body = tree.root.body;
		if (body.kind !== "select") throw new Error("expected select");
		// No catalog given, so a bare table source's columns aren't known — "needs-schema" (not
		// "unresolved") is the correct binding: the source was found, its columns just aren't.
		for (const col of body.columns) expect(resolveColumnRef(tree.root, col).kind).toBe("needs-schema");

		// With a schema, the columns resolve fully — the same qualify() path CREATE VIEW's body uses.
		const schema = new Schema({ t: { a: "number", b: "number" } });
		const qualified = qualify(tree, schema);
		expect(qualified.columnsOf(tree.root)).toEqual(["a", "b"]);
	});
});

describe("UNION BY NAME output columns", () => {
	it("scope outputs are the name-aligned union (left order, right-only appended)", () => {
		const tree = scopes("SELECT a, b FROM t1 UNION ALL BY NAME SELECT c, a FROM t2");
		expect(tree.root.outputs).toEqual(["a", "b", "c"]);
	});

	it("a positional union keeps the left branch's outputs", () => {
		const tree = scopes("SELECT a, b FROM t1 UNION ALL SELECT c, a FROM t2");
		expect(tree.root.outputs).toEqual(["a", "b"]);
	});

	it("star expansion through a by-name union merges schema columns", () => {
		const schema = new Schema({ t: { a: "number", s: "varchar" }, u: { a: "number", x: "boolean" } });
		const tree = scopes("SELECT * FROM t UNION ALL BY NAME SELECT * FROM u");
		expect(qualify(tree, schema).columnsOf(tree.root)).toEqual(["a", "s", "x"]);
	});
});

describe("Snowflake qualify (star expansion + diagnostics)", () => {
	it("expands * against a schema and reports unknown columns", () => {
		const tree = scopes("SELECT * FROM t WHERE nope > 1");
		const result = qualify(tree, T);
		expect(result.diagnostics.some((d) => d.kind === "unknown-column" && d.message.includes("nope"))).toBe(true);
	});

	it("QUALIFY sees select-list aliases (like HAVING/ORDER BY), so no false diagnostic", () => {
		const tree = scopes("SELECT a, ROW_NUMBER() OVER (ORDER BY a) AS rn FROM t QUALIFY rn = 1");
		const result = qualify(tree, T);
		expect(result.diagnostics.filter((d) => d.message.includes("rn"))).toEqual([]);
	});

	it("star expansion applies EXCLUDE / ILIKE / RENAME", () => {
		// schema t = { a, s, ts, v }
		const exclude = scopes("SELECT * EXCLUDE (a, v) FROM t");
		expect(qualify(exclude, T).columnsOf(exclude.root)).toEqual(["s", "ts"]);

		const ilike = scopes("SELECT * ILIKE '%s%' FROM t");
		expect(qualify(ilike, T).columnsOf(ilike.root)).toEqual(["s", "ts"]);

		const rename = scopes("SELECT * RENAME (a AS id) FROM t");
		expect(qualify(rename, T).columnsOf(rename.root)).toEqual(["id", "s", "ts", "v"]);

		// REPLACE keeps the column's name and position.
		const replace = scopes("SELECT * REPLACE (a / 100 AS a) FROM t");
		expect(qualify(replace, T).columnsOf(replace.root)).toEqual(["a", "s", "ts", "v"]);
	});
});

describe("Snowflake lineage", () => {
	it("traces an output column through a CTE to its base table", () => {
		const tree = scopes("WITH c AS (SELECT a FROM t) SELECT a AS out_a FROM c");
		const cols = lineage(tree, T);
		const out = cols.find((c) => c.output === "out_a");
		expect(out?.origins.map((o) => `${o.table.join(".")}.${o.column}`)).toContain("t.a");
	});
});

describe("Snowflake symbols", () => {
	it("derives symbols over the scope tree", () => {
		const syms = deriveSymbols(scopes("SELECT a, s FROM t"), T);
		expect(syms.length).toBeGreaterThan(0);
	});
});

describe("Snowflake type inference (dialect-specific knowledge)", () => {
	it("types a decimal literal as decimal (NUMBER), not double", () => {
		expect(typeOf("SELECT 1.5 AS x")).toEqual({ kind: "scalar", name: "decimal" });
	});

	it("IFF returns the common type of its branches", () => {
		expect(typeOf("SELECT IFF(a > 0, 'p', 'n') AS x FROM t", T)).toEqual({ kind: "scalar", name: "string" });
	});

	it("ZEROIFNULL keeps its argument's type", () => {
		expect(typeOf("SELECT ZEROIFNULL(a) AS x FROM t", T)).toEqual({ kind: "scalar", name: "decimal" });
	});

	it("LISTAGG returns string", () => {
		expect(typeOf("SELECT LISTAGG(s, ',') AS x FROM t GROUP BY a", T)).toEqual({ kind: "scalar", name: "string" });
	});

	it("CURRENT_WAREHOUSE returns string", () => {
		expect(typeOf("SELECT CURRENT_WAREHOUSE() AS x")).toEqual({ kind: "scalar", name: "string" });
	});

	it("DATEADD returns its date argument's type", () => {
		expect(typeOf("SELECT DATEADD(day, 7, ts) AS x FROM t", T)).toEqual({ kind: "scalar", name: "timestamp" });
	});

	it("casts via :: use Snowflake type aliases (NUMBER → decimal, TIMESTAMP_NTZ → timestamp)", () => {
		expect(typeOf("SELECT s::NUMBER(10,2) AS x FROM t", T)).toEqual({ kind: "scalar", name: "decimal" });
		expect(typeOf("SELECT s::TIMESTAMP_NTZ AS x FROM t", T)).toEqual({ kind: "scalar", name: "timestamp" });
	});

	it("PARSE_JSON returns variant", () => {
		expect(typeOf("SELECT PARSE_JSON(s) AS x FROM t", T)).toEqual({ kind: "scalar", name: "variant" });
	});

	it("TO_NUMBER returns decimal; TO_DOUBLE returns double", () => {
		expect(typeOf("SELECT TO_NUMBER(s) AS x FROM t", T)).toEqual({ kind: "scalar", name: "decimal" });
		expect(typeOf("SELECT TO_DOUBLE(s) AS x FROM t", T)).toEqual({ kind: "scalar", name: "double" });
	});

	it("types flow through a star projection in a CTE", () => {
		expect(typeOf("WITH c AS (SELECT * FROM t) SELECT a FROM c", T)).toEqual({ kind: "scalar", name: "decimal" });
	});

	it("star REPLACE rebinds the column's type; RENAME follows the original; EXCLUDE removes it", () => {
		expect(typeOf("WITH c AS (SELECT * REPLACE (a::STRING AS a) FROM t) SELECT a FROM c", T)).toEqual({
			kind: "scalar",
			name: "string",
		});
		expect(typeOf("WITH c AS (SELECT * RENAME (a AS b) FROM t) SELECT b FROM c", T)).toEqual({
			kind: "scalar",
			name: "decimal",
		});
		expect(typeOf("WITH c AS (SELECT * EXCLUDE (a) FROM t) SELECT a FROM c", T)).toEqual({ kind: "unknown" });
	});

	it("variant paths and subscripts stay variant", () => {
		expect(typeOf("SELECT v:a.b AS x FROM t", T)).toEqual({ kind: "scalar", name: "variant" });
		expect(typeOf("SELECT v:items[0] AS x FROM t", T)).toEqual({ kind: "scalar", name: "variant" });
		expect(typeOf("SELECT v:a::STRING AS x FROM t", T)).toEqual({ kind: "scalar", name: "string" });
	});

	it("types <seq>.NEXTVAL as decimal (NUMBER)", () => {
		// docs.snowflake.com/en/sql-reference/functions/nextval — NEXTVAL returns NUMBER(38,0).
		expect(typeOf("SELECT seq_01.nextval AS x")).toEqual({ kind: "scalar", name: "decimal" });
	});

	it("division is decimal division: numeric/numeric → decimal, float operand → double", () => {
		expect(typeOf("SELECT 10/3 AS x")).toEqual({ kind: "scalar", name: "decimal" });
		expect(typeOf("SELECT a/2 AS x FROM t", T)).toEqual({ kind: "scalar", name: "decimal" });
		expect(typeOf("SELECT TO_DOUBLE(s)/2 AS x FROM t", T)).toEqual({ kind: "scalar", name: "double" });
	});
});
