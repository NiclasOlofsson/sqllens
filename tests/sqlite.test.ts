import { describe, expect, it } from "vitest";
import { lower } from "../src/sqlite/lower.js";
import { parseSqlite } from "../src/sqlite/parse.js";
import { analyze } from "../src/api.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";
import { referencesAt } from "../src/references/references.js";

// SQLite is a new dialect: grammar forked from grammars-v4 sql/sqlite (Martin Mirchev's
// precedence-cascade expr variant). Only parse() and lower() are SQLite-specific — the
// semantic layer runs unchanged on the shared IR. These tests are the R3 lowering gate.

const errorsOf = (sql: string) => parseSqlite(sql).errors;

function ir(sql: string) {
	const { tree, errors } = parseSqlite(sql);
	return { q: lower(tree), errors };
}

function selectBody(sql: string) {
	const { q, errors } = ir(sql);
	expect(errors).toBe(0);
	if (q.body.kind !== "select") throw new Error(`expected select body, got ${q.body.kind}`);
	return { q, body: q.body };
}

describe("Sqlite parse", () => {
	it("parses a basic SELECT with zero syntax errors", () => {
		expect(errorsOf("SELECT a, b FROM t WHERE a > 1")).toBe(0);
	});
});

describe("Sqlite lower -> IR", () => {
	it("lowers a basic SELECT to a select body with projections, a source and WHERE", () => {
		const { body } = selectBody("SELECT a, b FROM t WHERE a > 1");
		expect(body.projections.map((p) => p.name)).toEqual(["a", "b"]);
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["t"] } });
		expect(body.where).toMatchObject({ kind: "binary", op: ">" });
		expect(body.columns.some((c) => c.clause === "where" && c.parts.join(".") === "a")).toBe(true);
	});

	it("captures column and table aliases, with and without AS", () => {
		const { body } = selectBody("SELECT t.a AS x, t.b y FROM main.tbl t");
		expect(body.projections[0].name).toBe("x");
		expect(body.projections[0].expr).toMatchObject({ kind: "column", parts: ["t", "a"] });
		expect(body.projections[1].name).toBe("y");
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["main", "tbl"] }, alias: "t" });
	});

	it("models a qualified `t.*` projection", () => {
		const { body } = selectBody("SELECT t.* FROM t");
		expect(body.projections[0].isStar).toBe(true);
		expect(body.projections[0].expr).toMatchObject({ kind: "star", qualifier: ["t"] });
	});

	it("models a bare `*` projection", () => {
		const { body } = selectBody("SELECT * FROM t");
		expect(body.projections[0].isStar).toBe(true);
		expect(body.projections[0].expr).toMatchObject({ kind: "star" });
		expect((body.projections[0].expr as { qualifier?: string[] }).qualifier).toBeUndefined();
	});

	it("keeps quoting delimiters on identifier fields (raw, delimiters intact)", () => {
		const { body } = selectBody('SELECT "col" FROM "tbl"');
		expect(body.projections[0].expr).toMatchObject({ kind: "column", parts: ['"col"'] });
		expect(body.from[0]).toMatchObject({ kind: "table", relation: { parts: ["tbl"] } });
	});

	it("lowers CTEs with declared column aliases", () => {
		const { q } = selectBody("WITH c (x, y) AS (SELECT a, b FROM t) SELECT x FROM c");
		expect(q.ctes).toHaveLength(1);
		expect(q.ctes[0].name).toBe("c");
		expect(q.ctes[0].columnAliases).toEqual(["x", "y"]);
		expect(q.ctes[0].body.body.kind).toBe("select");
	});

	it("lowers a FROM subquery with an alias", () => {
		const { body } = selectBody("SELECT s.a FROM (SELECT a FROM t) s");
		expect(body.from[0]).toMatchObject({ kind: "subquery", alias: "s" });
		if (body.from[0].kind !== "subquery") throw new Error("subquery");
		expect(body.from[0].query.body.kind).toBe("select");
	});

	it("captures JOIN ON conditions, sources and their column refs", () => {
		const { body } = selectBody("SELECT * FROM a JOIN b ON a.id = b.id");
		expect(body.from).toHaveLength(2);
		expect(body.joins).toHaveLength(1);
		expect(body.joins?.[0]).toMatchObject({ kind: "inner" });
		expect(body.joinConditions).toHaveLength(1);
		expect(body.columns.some((c) => c.clause === "join" && c.parts.join(".") === "a.id")).toBe(true);
	});

	it("captures a LEFT JOIN USING (col) constraint", () => {
		const { body } = selectBody("SELECT * FROM a LEFT JOIN b USING (id)");
		expect(body.joins?.[0]).toMatchObject({ kind: "left", using: ["id"] });
	});

	it("models GROUP BY and HAVING and sets aggregated", () => {
		const { body } = selectBody("SELECT g, SUM(x) FROM t GROUP BY g HAVING SUM(x) > 0");
		expect(body.groupBy).toHaveLength(1);
		expect(body.having).toMatchObject({ kind: "binary", op: ">" });
		expect(body.aggregated).toBe(true);
	});

	it("sets aggregated for a bare aggregate with no GROUP BY", () => {
		expect(selectBody("SELECT MAX(x) FROM t").body.aggregated).toBe(true);
		expect(selectBody("SELECT x FROM t").body.aggregated).toBe(false);
	});

	it("models ORDER BY and LIMIT/OFFSET (OFFSET form)", () => {
		const { q } = selectBody("SELECT a FROM t ORDER BY a DESC LIMIT 10 OFFSET 5");
		expect(q.orderBy).toHaveLength(1);
		expect(q.limit?.top).toMatchObject({ kind: "literal", text: "10" });
		expect(q.limit?.offset).toMatchObject({ kind: "literal", text: "5" });
	});

	it("reads the SQLite comma LIMIT form as `offset, count`", () => {
		const { q } = selectBody("SELECT a FROM t LIMIT 5, 10");
		expect(q.limit?.offset).toMatchObject({ kind: "literal", text: "5" });
		expect(q.limit?.top).toMatchObject({ kind: "literal", text: "10" });
	});

	it("lowers a UNION ALL compound to a setop body", () => {
		const { q } = ir("SELECT a FROM t1 UNION ALL SELECT a FROM t2");
		if (q.body.kind !== "setop") throw new Error(`expected setop, got ${q.body.kind}`);
		expect(q.body.op).toBe("union");
		expect(q.body.all).toBe(true);
		expect(q.body.left.kind).toBe("select");
		expect(q.body.right.kind).toBe("select");
	});

	it("lowers EXCEPT and INTERSECT compounds, left-folded", () => {
		const except = ir("SELECT a FROM t1 EXCEPT SELECT a FROM t2").q;
		if (except.body.kind !== "setop") throw new Error("setop");
		expect(except.body.op).toBe("except");
		expect(except.body.all).toBe(false);

		const chained = ir("SELECT a FROM t1 UNION SELECT a FROM t2 INTERSECT SELECT a FROM t3").q;
		if (chained.body.kind !== "setop") throw new Error("setop");
		expect(chained.body.op).toBe("intersect");
		if (chained.body.left.kind !== "setop") throw new Error("nested setop");
		expect(chained.body.left.op).toBe("union");
	});

	it("lowers a VALUES clause to literal-named projections", () => {
		const { body } = selectBody("VALUES (1, 2), (3, 4)");
		expect(body.projections.map((p) => p.name)).toEqual(["column1", "column2"]);
		expect(body.projections[0].expr).toMatchObject({ kind: "literal", text: "1" });
	});

	it("models IN, LIKE and BETWEEN predicates", () => {
		const inp = selectBody("SELECT a FROM t WHERE a IN (1, 2, 3)").body;
		expect(inp.where).toMatchObject({ kind: "predicate", op: "in", negated: false });
		const lk = selectBody("SELECT a FROM t WHERE a LIKE 'x%'").body;
		expect(lk.where).toMatchObject({ kind: "predicate", op: "like" });
		const bw = selectBody("SELECT a FROM t WHERE a NOT BETWEEN 1 AND 2").body;
		expect(bw.where).toMatchObject({ kind: "predicate", op: "between", negated: true });
	});

	it("models a scalar function call and a CASE expression", () => {
		const fn = selectBody("SELECT upper(name) AS u FROM t").body;
		expect(fn.projections[0].expr).toMatchObject({ kind: "function", name: "upper" });
		const cs = selectBody("SELECT CASE WHEN a > 0 THEN 1 ELSE 0 END AS c FROM t").body;
		expect(cs.projections[0].expr).toMatchObject({ kind: "case" });
	});

	it("lowers a non-SELECT statement to an unsupported non-query with a sensible category", () => {
		const { q } = ir("CREATE TABLE t (a INTEGER, b TEXT)");
		expect(q.statement).toBe("ddl");
		if (q.body.kind !== "select") throw new Error("expected flagged select body");
		expect(q.body.unsupported).toContain("non-query");
	});

	it("categorizes DML, TCL and utility statements", () => {
		expect(ir("INSERT INTO t (a) VALUES (1)").q.statement).toBe("dml");
		expect(ir("DELETE FROM t WHERE a = 1").q.statement).toBe("dml");
		expect(ir("BEGIN TRANSACTION").q.statement).toBe("tcl");
		expect(ir("PRAGMA foreign_keys = ON").q.statement).toBe("utility");
	});

	it("flags a multi-statement batch as a compound non-query", () => {
		const { q } = ir("SELECT 1; SELECT 2");
		expect(q.statement).toBe("compound");
		if (q.body.kind !== "select") throw new Error("expected flagged select body");
		expect(q.body.unsupported).toContain("multi-statement");
	});

	it("collects IN / EXISTS / scalar expression subqueries into body.subqueries", () => {
		const inq = selectBody("SELECT a FROM t WHERE a IN (SELECT b FROM u)").body;
		expect(inq.subqueries).toHaveLength(1);
		expect(inq.subqueries?.[0].body).toMatchObject({
			kind: "select",
			from: [{ kind: "table", relation: { parts: ["u"] } }],
		});

		const ex = selectBody("SELECT a FROM t WHERE EXISTS (SELECT 1 FROM u)").body;
		expect(ex.subqueries).toHaveLength(1);
		expect(ex.subqueries?.[0].body).toMatchObject({
			kind: "select",
			from: [{ kind: "table", relation: { parts: ["u"] } }],
		});

		const scalar = selectBody("SELECT (SELECT max(b) FROM u) AS m, a FROM t").body;
		expect(scalar.subqueries).toHaveLength(1);
		expect(scalar.subqueries?.[0].body).toMatchObject({
			kind: "select",
			from: [{ kind: "table", relation: { parts: ["u"] } }],
		});
	});

	it("does not duplicate FROM subqueries into body.subqueries", () => {
		const plain = selectBody("SELECT s.a FROM (SELECT a FROM t) s").body;
		expect(plain.subqueries).toBeUndefined();

		// Mixed: the FROM subquery stays a Source; only the WHERE IN subquery lands in subqueries.
		const mixed = selectBody("SELECT s.a FROM (SELECT a FROM t) s WHERE s.a IN (SELECT b FROM u)").body;
		expect(mixed.subqueries).toHaveLength(1);
		expect(mixed.subqueries?.[0].body).toMatchObject({
			kind: "select",
			from: [{ kind: "table", relation: { parts: ["u"] } }],
		});
	});

	// lower() is TOTAL — never throws, even on the broken/partial input the editor feeds it.
	it("never throws on deliberately broken input", () => {
		for (const sql of ["SELECT", "SELECT FROM WHERE", "SELECT a FROM", "WITH x AS (", ")(;;", ""]) {
			expect(() => lower(parseSqlite(sql).tree)).not.toThrow();
		}
	});
});

// BIND_PARAMETER (grammars/sqlite/SQLiteLexer.g4: '?' DIGIT* | [:@$] IDENTIFIER) — every spelling
// is a caller-bound placeholder, bindable via the C API (sqlite.org/lang_expr.html#varparam), so
// all five lower to `parameter`, never `variable`. It used to collapse into an anonymous literal;
// this pins the IR shape (src/ir/ir.ts). The doc's Tcl-only `$AAAA` extension (a `::`-separated
// path, an optional `(...)` suffix) is NOT reachable through our grammar: probed directly, `SELECT
// $name::sub` and `SELECT $name(1)` both fail to parse ("mismatched input ... expecting <EOF>"),
// since BIND_PARAMETER's `$` alt only ever consumes a single IDENTIFIER. Only the plain identifier
// form is exercised here.
describe("Sqlite parameter references", () => {
	it("lowers a bare `?` to a parameter node in SELECT and WHERE position, no name/ordinal", () => {
		const { body } = selectBody("SELECT ? FROM t WHERE a = ?");
		expect(body.projections[0].expr).toMatchObject({ kind: "parameter", text: "?" });
		expect((body.projections[0].expr as { name?: string }).name).toBeUndefined();
		expect((body.where as { right?: unknown }).right).toMatchObject({ kind: "parameter", text: "?" });
	});

	it("lowers `?3` to a parameter node carrying its explicit ordinal", () => {
		const { body } = selectBody("SELECT ?3 FROM t");
		expect(body.projections[0].expr).toMatchObject({ kind: "parameter", text: "?3", ordinal: 3 });
	});

	it("lowers `:name` / `@name` / `$name` to a named parameter, sigil stripped", () => {
		const { body } = selectBody("SELECT :who, @who, $who FROM t");
		expect(body.projections[0].expr).toMatchObject({ kind: "parameter", text: ":who", name: "who" });
		expect(body.projections[1].expr).toMatchObject({ kind: "parameter", text: "@who", name: "who" });
		expect(body.projections[2].expr).toMatchObject({ kind: "parameter", text: "$who", name: "who" });
	});

	it("lowers `:name` to a named parameter node in WHERE position", () => {
		const { body } = selectBody("SELECT a FROM t WHERE a = :who");
		expect((body.where as { right?: unknown }).right).toMatchObject({
			kind: "parameter",
			text: ":who",
			name: "who",
		});
	});

	it("fires no unknown-column diagnostic on a schema-attached analyze for any of these forms", () => {
		const schema = new Schema({ t: { a: "integer", b: "text" } });
		const { diagnostics } = analyze("SELECT ?, ?3, :who, @who, $who, a FROM t WHERE a = ? AND b = :who", "sqlite", {
			schema,
		});
		expect(diagnostics).toEqual([]);
	});

	it("as a call argument, is an unknown-typed operand: no false call diagnostic", () => {
		const schema = new Schema({ t: { a: "integer" } });
		const { diagnostics } = analyze("SELECT abs(?), abs(:x) FROM t", "sqlite", { schema });
		const kinds = diagnostics.map((d) => d.kind);
		expect(kinds).not.toContain("wrong-arity");
		expect(kinds).not.toContain("wrong-argument-type");
	});

	it("deriveSymbols emits parameter kinds, one Sym per occurrence", () => {
		const scopes = resolveScopes(lower(parseSqlite("SELECT ?, ?3, :who, @x, $x FROM t").tree), "sqlite");
		const syms = deriveSymbols(scopes).filter((s) => s.kind === "parameter");
		expect(syms.map((s) => [s.kind, s.name])).toEqual([
			["parameter", "?"],
			["parameter", "?3"],
			["parameter", "who"],
			["parameter", "x"],
			["parameter", "x"],
		]);
		expect(syms.every((s) => s.modifiers.includes("reference"))).toBe(true);
	});

	it("referencesAt groups two `:x` occurrences and keys separately from an unrelated name", () => {
		const sql = "SELECT :x FROM t WHERE a = :x AND b = :y";
		const scopes = resolveScopes(lower(parseSqlite(sql).tree), "sqlite");
		const occ = referencesAt(scopes, sql.indexOf(":x"));
		expect(occ).not.toBeNull();
		expect(occ!.kind).toBe("parameter");
		expect(occ!.symbol).toBe("x");
		expect(occ!.occurrences).toHaveLength(2);
		expect(occ!.occurrences.every((o) => o.role === "reference")).toBe(true);
	});
});
