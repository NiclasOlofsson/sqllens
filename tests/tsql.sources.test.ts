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
			name: ["fn"],
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
