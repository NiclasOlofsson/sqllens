import { describe, expect, it } from "vitest";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { lower } from "../src/tsql/lower.js";
import { parseTSql } from "../src/tsql/parse.js";

// APPLY / OPENJSON / OPENXML are table_source_item forms; lower() models each as a source so its
// columns resolve (or, for opaque TVF / XML `.nodes()`, so refs bind to it rather than mis-parsing
// the construct as a table name). Legacy `*=` and TOP/OFFSET-FETCH are modelled too.

function ir(sql: string) {
	return lower(parseTSql(sql).tree);
}
function tree(sql: string) {
	return resolveScopes(lower(parseTSql(sql).tree), "tsql");
}

describe("T-SQL APPLY / OPENJSON / OPENXML sources", () => {
	it("CROSS APPLY (derived table) exposes its columns", () => {
		const t = tree("SELECT d.x FROM t CROSS APPLY (SELECT 1 AS x) AS d");
		const q = qualify(t, new Schema({ t: { id: "int" } }));
		expect(q.diagnostics.filter((d) => d.kind === "unknown-column")).toEqual([]);
		expect([...t.root.sources.keys()].sort()).toEqual(["d", "t"]);
	});

	it("OPENJSON WITH (schema) exposes the declared columns", () => {
		const t = tree("SELECT j.id, j.nm FROM OPENJSON('[]') WITH (id int, nm nvarchar(50)) AS j");
		const q = qualify(t, new Schema({}));
		expect(q.diagnostics.filter((d) => d.kind === "unknown-column")).toEqual([]);
		expect(q.columnsOf(t.root)).toEqual(["id", "nm"]);
	});

	it("a table-valued function is a source (opaque columns, no garbage name)", () => {
		const b = ir("SELECT f.val FROM t CROSS APPLY dbo.fn(t.id) AS f").body;
		if (b.kind !== "select") throw new Error("select");
		expect(b.from.find((s) => s.kind === "table" && s.alias === "f")).toMatchObject({
			kind: "table",
			relation: { parts: ["fn"] },
			alias: "f",
		});
	});

	it("XML .nodes() is a source with its declared column, not a mis-parsed table name", () => {
		const t = tree("SELECT n.c FROM t CROSS APPLY t.doc.nodes('/x') AS n(c)");
		const b = t.root.body;
		if (b.kind !== "select") throw new Error("select");
		expect(b.from.some((s) => s.kind === "table" && s.alias === "n")).toBe(true);
		expect(qualify(t, new Schema({})).diagnostics.filter((d) => d.kind === "unknown-column")).toEqual([]);
	});
});

describe("T-SQL XML data type methods and REGEXP_LIKE predicate", () => {
	// XML `.value()/.query()/.exist()` in a select list parse as `udt_elem` (receiver id_ '.' method
	// udt_method_arguments); lower() models them as function exprs with the receiver as the FIRST arg,
	// so the receiver column is conserved (walkable, resolvable) rather than buried in a string field.
	// https://learn.microsoft.com/en-us/sql/t-sql/xml/xml-data-type-methods
	it("models an XML .value() call as a function with the receiver conserved as arg 0", () => {
		const b = ir("SELECT ev.value('(@name)[1]', 'varchar(100)') AS nm FROM t").body;
		if (b.kind !== "select") throw new Error("select");
		const p = b.projections[0];
		expect(p.name).toBe("nm");
		expect(p.expr).toMatchObject({
			kind: "function",
			name: "value",
			args: [{ kind: "column", parts: ["ev"] }, { kind: "literal" }, { kind: "literal", text: "'varchar(100)'" }],
		});
		// the receiver column is captured as a projection column (conservation → it resolves)
		expect(b.columns.filter((c) => c.clause === "projection").map((c) => c.parts.join("."))).toContain("ev");
	});

	it("models .query() and .exist() XML methods as functions (no `other` leak)", () => {
		const q = ir("SELECT c.query('/root') AS x FROM t").body;
		if (q.kind !== "select") throw new Error("select");
		expect(q.projections[0].expr).toMatchObject({ kind: "function", name: "query" });
		const e = ir("SELECT c.exist('/root') AS x FROM t").body;
		if (e.kind !== "select") throw new Error("select");
		expect(e.projections[0].expr).toMatchObject({ kind: "function", name: "exist" });
	});

	// REGEXP_LIKE in a WHERE clause parses as the `predicate` alternative (not a function call), so
	// lower() maps it to a `predicate` IR node — the boolean regex test — with its columns captured.
	// https://learn.microsoft.com/en-us/sql/t-sql/functions/regexp-like-transact-sql (SQL Server 2025)
	it("models REGEXP_LIKE in WHERE as an rlike predicate with its columns captured", () => {
		const b = ir("SELECT a FROM t WHERE REGEXP_LIKE(s, '[0-9]+')").body;
		if (b.kind !== "select") throw new Error("select");
		expect(b.where).toMatchObject({
			kind: "predicate",
			op: "rlike",
			negated: false,
			operand: { kind: "column", parts: ["s"] },
			args: [{ kind: "literal", text: "'[0-9]+'" }],
		});
		expect(b.columns.filter((c) => c.clause === "where").map((c) => c.parts.join("."))).toContain("s");
	});

	it("REGEXP_LIKE with an optional flags argument still models as a predicate", () => {
		const b = ir("SELECT a FROM t WHERE REGEXP_LIKE(s, '^A.*Y$', 'i')").body;
		if (b.kind !== "select") throw new Error("select");
		expect(b.where).toMatchObject({ kind: "predicate", op: "rlike" });
	});

	// Quantified comparison `expr <cmp> ALL|SOME|ANY (subquery)` — one expression + a subquery on the
	// right — models as a boolean predicate; operand column + subquery scope both conserved.
	// https://learn.microsoft.com/en-us/sql/t-sql/language-elements/some-any-transact-sql
	it("models `= ANY (subquery)` as a quantified-comparison predicate", () => {
		const t = tree("SELECT a FROM t WHERE t.name = ANY (SELECT v.name FROM v)");
		const b = t.root.body;
		if (b.kind !== "select") throw new Error("select");
		expect(b.where).toMatchObject({
			kind: "predicate",
			op: "= any",
			operand: { kind: "column", parts: ["t", "name"] },
			args: [{ kind: "subquery" }],
		});
		expect(b.columns.filter((c) => c.clause === "where").map((c) => c.parts.join("."))).toContain("t.name");
		// the subquery became its own child scope (its columns don't leak into this block)
		expect(b.subqueries?.length).toBe(1);
	});

	// SQL Graph MATCH(<pattern>) in WHERE — a boolean predicate; modelled without shredding the graph.
	// https://learn.microsoft.com/en-us/sql/t-sql/queries/match-sql-graph
	it("models a SQL Graph MATCH() as a boolean `match` predicate (no `other` leak)", () => {
		const b = ir("SELECT p1.name FROM Person p1, likes l, Person p2 WHERE MATCH(p1-(l)->p2)").body;
		if (b.kind !== "select") throw new Error("select");
		expect(b.where).toMatchObject({ kind: "predicate", op: "match" });
		expect(b.where && "operand" in b.where ? b.where.operand.kind : "").not.toBe("other");
	});

	// Full-text CONTAINS/FREETEXT predicate — boolean; the searched columns are conserved.
	// https://learn.microsoft.com/en-us/sql/t-sql/queries/contains-transact-sql
	it("models a full-text CONTAINS() as a boolean predicate with its column conserved", () => {
		const b = ir("SELECT a FROM t WHERE CONTAINS(descr, 'fast')").body;
		if (b.kind !== "select") throw new Error("select");
		expect(b.where).toMatchObject({
			kind: "predicate",
			op: "contains",
			operand: { kind: "column", parts: ["descr"] },
		});
		expect(b.columns.filter((c) => c.clause === "where").map((c) => c.parts.join("."))).toContain("descr");
	});

	// OPENJSON/OPENXML WITH captures each declared column's data type (additive to columnAliases).
	// https://learn.microsoft.com/en-us/sql/t-sql/functions/openjson-transact-sql
	it("OPENJSON WITH captures declared column names AND types", () => {
		const b = ir("SELECT * FROM OPENJSON(@j) WITH (id int '$.id', nm nvarchar(50) '$.name') AS j").body;
		if (b.kind !== "select") throw new Error("select");
		const src = b.from.find((s) => s.kind === "table" && s.alias === "j");
		expect(src).toMatchObject({
			kind: "table",
			columnAliases: ["id", "nm"],
			declaredColumns: [
				{ name: "id", type: "int" },
				{ name: "nm", type: "nvarchar(50)" },
			],
		});
	});
});

describe("T-SQL legacy *= join and row-limiting", () => {
	it("models the non-ANSI *= operator as a comparison and captures its columns", () => {
		const b = ir("SELECT a FROM t1, t2 WHERE t1.id *= t2.id").body;
		if (b.kind !== "select") throw new Error("select");
		expect(b.where).toMatchObject({ kind: "binary", op: "*=" });
		expect(b.columns.filter((c) => c.clause === "where").map((c) => c.parts.join("."))).toEqual(["t1.id", "t2.id"]);
	});

	it("captures TOP and TOP … PERCENT", () => {
		expect(ir("SELECT TOP 10 a FROM t").limit).toMatchObject({ top: { kind: "literal", text: "10" } });
		expect(ir("SELECT TOP 5 PERCENT a FROM t").limit).toMatchObject({
			top: { kind: "literal", text: "5" },
			percent: true,
		});
	});

	it("captures OFFSET / FETCH", () => {
		const q = ir("SELECT a FROM t ORDER BY a OFFSET 10 ROWS FETCH NEXT 5 ROWS ONLY");
		expect(q.limit?.offset).toMatchObject({ kind: "literal", text: "10" });
		expect(q.limit?.fetch).toMatchObject({ kind: "literal", text: "5" });
	});
});
