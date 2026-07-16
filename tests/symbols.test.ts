import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { qualify } from "../src/qualify/qualify.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";
import { toScopes } from "../src/index.js";

function symbolsOf(sql: string) {
	return deriveSymbols(resolveScopes(lower(parseDatabricks(sql).tree)));
}

function symbolsWithSchema(sql: string, schema: Schema) {
	const tree = resolveScopes(lower(parseDatabricks(sql).tree));
	const q = qualify(tree, schema);
	return deriveSymbols(tree, schema, q.expandStarOf);
}

describe("deriveSymbols — relations", () => {
	it("emits a table source as a relation reference", () => {
		const t = symbolsOf("SELECT a FROM t").find((s) => s.name === "t");
		expect(t).toMatchObject({ kind: "table", modifiers: ["reference"], frame: "_main_" });
	});

	it("emits a CTE both as a declaration (at WITH) and a reference (in FROM)", () => {
		const syms = symbolsOf("WITH c AS (SELECT a FROM t) SELECT a FROM c").filter((s) => s.name === "c");
		expect(syms.map((s) => s.modifiers[0]).sort()).toEqual(["declaration", "reference"]);
		expect(syms.every((s) => s.kind === "cte")).toBe(true);
	});

	it("labels a source inside a CTE body with that CTE's frame", () => {
		const t = symbolsOf("WITH c AS (SELECT a FROM t) SELECT a FROM c").find(
			(s) => s.name === "t" && s.kind === "table",
		);
		expect(t?.frame).toBe("c");
	});

	it("carries a span for each symbol", () => {
		const t = symbolsOf("SELECT a FROM t").find((s) => s.name === "t");
		expect(t?.span.line).toBeGreaterThan(0);
		expect(t?.span.endColumn).toBeGreaterThanOrEqual(t!.span.column);
	});

	// A table Sym.name is DISPLAY text (it feeds hover / go-to-definition / find-references), so it must
	// be the as-written spelling, never the dialect-folded identity key. Since #38 ResolvedSource(table)
	// .name carries the folded key, so relationSymbol regressed to showing "TBL" on a case-folding
	// dialect (anvil, 1.5.0). The CTE branch always showed display; the table branch must match it.
	it("shows a table's as-written spelling, not the folded identity key, on a case-folding dialect", () => {
		const syms = deriveSymbols(toScopes('select 1 as x from tbl "My Alias"', { dialect: "snowflake" }));
		const table = syms.find((s) => s.kind === "table");
		expect(table?.name).toBe("tbl"); // was "TBL" — the snowflake fold key leaked through
	});
});

describe("deriveSymbols — columns", () => {
	it("emits a bare projected column as a single reference (not a duplicate declaration)", () => {
		const cols = symbolsOf("SELECT a FROM t").filter((s) => s.kind === "column" && s.name === "a");
		expect(cols).toHaveLength(1);
		expect(cols[0].modifiers).toEqual(["reference"]);
	});

	it("emits an explicit alias as a column declaration + output", () => {
		const x = symbolsOf("SELECT p + q AS x FROM t").find((s) => s.name === "x");
		expect(x?.kind).toBe("column");
		expect(x?.modifiers).toEqual(expect.arrayContaining(["declaration", "output"]));
	});

	it("distinguishes an aliased column ref: declaration x and reference a", () => {
		const syms = symbolsOf("SELECT a AS x FROM t");
		expect(syms.find((s) => s.name === "x")?.modifiers).toContain("declaration");
		expect(syms.find((s) => s.name === "a")?.modifiers).toEqual(["reference"]);
	});

	it("tags a star projection with the star modifier", () => {
		expect(symbolsOf("SELECT * FROM t").some((s) => s.modifiers.includes("star"))).toBe(true);
	});

	it("tags a correlated column reference (bound to an outer frame)", () => {
		const oid = symbolsOf("SELECT (SELECT max(x) FROM inner_t WHERE inner_t.k = o.id) FROM outer_t AS o").find(
			(s) => s.name === "o.id",
		);
		expect(oid?.modifiers).toContain("correlated");
	});
});

describe("deriveSymbols — star expansion", () => {
	const schema = new Schema({ orders: { id: "bigint", total: "double" } });

	it("does not expand a star without an expandStarOf function, even with a schema", () => {
		const tree = resolveScopes(lower(parseDatabricks("SELECT * FROM orders").tree));
		const syms = deriveSymbols(tree, schema); // no 3rd arg
		expect(
			syms.filter(
				(s) => s.kind === "column" && s.modifiers.includes("star") && s.modifiers.includes("reference"),
			),
		).toHaveLength(0);
		expect(syms.some((s) => s.kind === "column" && s.modifiers.length === 1 && s.modifiers[0] === "star")).toBe(
			true,
		);
	});

	it("expands a resolvable star into one additional column Sym per source column, ADDITIVE to the opaque star Sym", () => {
		const syms = symbolsWithSchema("SELECT * FROM orders", schema);
		const opaqueStar = syms.find(
			(s) => s.kind === "column" && s.modifiers.length === 1 && s.modifiers[0] === "star",
		);
		expect(opaqueStar).toBeDefined();
		const expanded = syms.filter(
			(s) => s.kind === "column" && s.modifiers.includes("star") && s.modifiers.includes("reference"),
		);
		expect(expanded.map((s) => s.name).sort()).toEqual(["id", "total"]);
	});

	it("links each expanded column Sym to the owning relation Sym, object-identical to the emitted one", () => {
		const syms = symbolsWithSchema("SELECT * FROM orders", schema);
		const tableSym = syms.find((s) => s.kind === "table" && s.name === "orders");
		const expanded = syms.filter(
			(s) => s.kind === "column" && s.modifiers.includes("star") && s.modifiers.includes("reference"),
		);
		expect(expanded).toHaveLength(2);
		for (const e of expanded) expect(e.source).toBe(tableSym);
	});

	it("gives every expanded column Sym a ZERO-WIDTH span at the star token's own position", () => {
		const syms = symbolsWithSchema("SELECT * FROM orders", schema);
		const starSym = syms.find((s) => s.kind === "column" && s.modifiers.length === 1 && s.modifiers[0] === "star");
		const expanded = syms.filter(
			(s) => s.kind === "column" && s.modifiers.includes("star") && s.modifiers.includes("reference"),
		);
		expect(expanded).toHaveLength(2);
		for (const e of expanded) {
			expect(e.span.column).toBe(e.span.endColumn);
			expect(e.span.line).toBe(e.span.endLine);
			expect(e.span.line).toBe(starSym!.span.line);
			expect(e.span.column).toBe(starSym!.span.column);
		}
	});

	it("expands only the qualified source's columns for a qualified star (t.*)", () => {
		const s2 = new Schema({ orders: { id: "bigint" }, customers: { id: "bigint", name: "string" } });
		const syms = symbolsWithSchema("SELECT o.* FROM orders o, customers c", s2);
		const expanded = syms.filter(
			(s) => s.kind === "column" && s.modifiers.includes("star") && s.modifiers.includes("reference"),
		);
		expect(expanded.map((s) => s.name)).toEqual(["id"]);
	});

	it("does not expand when the source's columns are unresolvable (no schema entry for the table)", () => {
		const syms = symbolsWithSchema("SELECT * FROM nonexistent_table", schema);
		const expanded = syms.filter(
			(s) => s.kind === "column" && s.modifiers.includes("star") && s.modifiers.includes("reference"),
		);
		expect(expanded).toHaveLength(0);
		expect(syms.some((s) => s.kind === "column" && s.modifiers.length === 1 && s.modifiers[0] === "star")).toBe(
			true,
		);
	});
});

describe("deriveSymbols — declaration spans (narrow, not whole-clause)", () => {
	it("spans only the alias identifier for a computed column declaration, not the whole projection", () => {
		const x = symbolsOf("SELECT foo AS bar FROM t").find(
			(s) => s.name === "bar" && s.modifiers.includes("declaration"),
		);
		expect(x).toBeDefined();
		expect(x!.span.endColumn - x!.span.column).toBe("bar".length);
	});

	it("spans only the (quoted) alias identifier, delimiters included, not the whole projection", () => {
		const x = symbolsOf("SELECT foo AS `bar` FROM t").find(
			(s) => s.modifiers.includes("declaration") && s.kind === "column",
		);
		expect(x).toBeDefined();
		expect(x!.span.endColumn - x!.span.column).toBe("`bar`".length);
	});

	it("spans only the CTE name, not the whole `name AS (body)` clause", () => {
		const c = symbolsOf("WITH mycte AS (SELECT 1 AS id) SELECT id FROM mycte").find(
			(s) => s.kind === "cte" && s.modifiers.includes("declaration"),
		);
		expect(c).toBeDefined();
		expect(c!.span.endColumn - c!.span.column).toBe("mycte".length);
	});
});

describe("deriveSymbols — column source links", () => {
	it("links a bound column Sym to its relation Sym, object-identical to the emitted one", () => {
		const syms = symbolsOf("SELECT o.id FROM orders o");
		const tableSym = syms.find((s) => s.kind === "table" && s.name === "orders");
		const columnSym = syms.find(
			(s) => s.kind === "column" && s.modifiers.includes("reference") && s.name === "o.id",
		);
		expect(tableSym).toBeDefined();
		expect(columnSym).toBeDefined();
		expect(columnSym!.source).toBe(tableSym); // object identity, not deep equality
	});

	it("links a correlated column Sym to the OUTER scope's relation Sym", () => {
		const syms = symbolsOf("SELECT (SELECT max(x) FROM inner_t WHERE inner_t.k = o.id) FROM outer_t AS o");
		const outerTable = syms.find((s) => s.kind === "table" && s.name === "outer_t");
		const correlatedCol = syms.find((s) => s.kind === "column" && s.modifiers.includes("correlated"));
		expect(outerTable).toBeDefined();
		expect(correlatedCol).toBeDefined();
		expect(correlatedCol!.source).toBe(outerTable);
	});

	it("has no source link for an unresolved column (schema-fed, no source owns it)", () => {
		const tree = resolveScopes(lower(parseDatabricks("SELECT nonexistent_col FROM orders o").tree));
		const syms = deriveSymbols(tree, new Schema({ orders: { id: "bigint" } }));
		const colSym = syms.find((s) => s.kind === "column" && s.name === "nonexistent_col");
		expect(colSym).toBeDefined();
		expect(colSym!.source).toBeUndefined();
	});

	it("links a bare unqualified column against a physical table when a schema is supplied", () => {
		const tree = resolveScopes(lower(parseDatabricks("SELECT id FROM orders").tree));
		const syms = deriveSymbols(tree, new Schema({ orders: { id: "bigint" } }));
		const tableSym = syms.find((s) => s.kind === "table" && s.name === "orders");
		const columnSym = syms.find((s) => s.kind === "column" && s.modifiers.includes("reference") && s.name === "id");
		expect(tableSym).toBeDefined();
		expect(columnSym).toBeDefined();
		expect(columnSym!.source).toBe(tableSym);
	});
});

describe("deriveSymbols — aliases & definition links", () => {
	it("emits a relation alias as an alias declaration", () => {
		const x = symbolsOf("SELECT a FROM tbl AS x").find((s) => s.kind === "alias" && s.name === "x");
		expect(x).toMatchObject({ kind: "alias", modifiers: ["declaration"], frame: "_main_" });
	});

	it("links a CTE reference to its declaration span (go-to-definition)", () => {
		const syms = symbolsOf("WITH c AS (SELECT a FROM t) SELECT a FROM c");
		const decl = syms.find((s) => s.kind === "cte" && s.modifiers.includes("declaration"));
		const ref = syms.find((s) => s.kind === "cte" && s.modifiers.includes("reference"));
		expect(ref?.definition).toEqual(decl?.span);
	});

	it("links a column reference to the projection that produces it in a CTE", () => {
		const ref = symbolsOf("WITH c AS (SELECT x AS a FROM t) SELECT a FROM c").find(
			(s) => s.kind === "column" && s.name === "a" && s.modifiers.includes("reference"),
		);
		expect(ref?.definition).toBeDefined();
	});

	it("narrows a column reference's producing-projection definition to the alias, not the whole projection", () => {
		const ref = symbolsOf("WITH c AS (SELECT x AS a FROM t) SELECT a FROM c").find(
			(s) => s.kind === "column" && s.name === "a" && s.modifiers.includes("reference"),
		);
		expect(ref?.definition).toBeDefined();
		expect(ref!.definition!.endColumn - ref!.definition!.column).toBe("a".length);
	});

	it("has no in-query definition for a catalog-table column", () => {
		const ref = symbolsOf("SELECT a FROM t").find((s) => s.kind === "column" && s.name === "a");
		expect(ref?.definition).toBeUndefined();
	});

	it("attaches the alias directly to the relation Sym, in addition to the separate alias Sym", () => {
		const syms = symbolsOf("SELECT o.id FROM orders o");
		const tableSym = syms.find((s) => s.kind === "table" && s.name === "orders");
		expect(tableSym).toBeDefined();
		expect(tableSym!.alias).toBeDefined();
		expect(tableSym!.alias!.name).toBe("o");
		// The separate alias-kind Sym still exists too — additive, not a replacement:
		const aliasSym = syms.find((s) => s.kind === "alias" && s.name === "o");
		expect(aliasSym).toBeDefined();
		expect(tableSym!.alias!.span).toEqual(aliasSym!.span);
	});

	it("has no alias field on an unaliased relation Sym", () => {
		const tableSym = symbolsOf("SELECT id FROM orders").find((s) => s.kind === "table" && s.name === "orders");
		expect(tableSym).toBeDefined();
		expect(tableSym!.alias).toBeUndefined();
	});
});

describe("deriveSymbols — functions", () => {
	it("emits a function symbol with its name", () => {
		const f = symbolsOf("SELECT coalesce(a, b) FROM t").find((s) => s.kind === "function");
		expect(f).toMatchObject({ kind: "function", name: "coalesce", frame: "_main_" });
	});

	it("tags an aggregate function", () => {
		const f = symbolsOf("SELECT sum(x) FROM t").find((s) => s.kind === "function" && s.name === "sum");
		expect(f?.modifiers).toContain("aggregate");
	});

	it("tags a window function (and its aggregate, when both)", () => {
		const f = symbolsOf("SELECT sum(x) OVER (PARTITION BY y) FROM t").find(
			(s) => s.kind === "function" && s.name === "sum",
		);
		expect(f?.modifiers).toEqual(expect.arrayContaining(["aggregate", "window"]));
	});

	it("emits functions nested in predicates and other expressions", () => {
		const names = symbolsOf("SELECT 1 FROM t WHERE lower(a) IN (upper(b))")
			.filter((s) => s.kind === "function")
			.map((s) => s.name);
		expect(names).toEqual(expect.arrayContaining(["lower", "upper"]));
	});
});

describe("deriveSymbols — column types (inference wired in)", () => {
	it("carries the inferred type on a column symbol when a schema is given", () => {
		const tree = resolveScopes(lower(parseDatabricks("SELECT a FROM t").tree));
		const a = deriveSymbols(tree, new Schema({ t: { a: "bigint" } })).find(
			(s) => s.kind === "column" && s.name === "a",
		);
		expect(a?.type).toEqual({ kind: "scalar", name: "bigint" });
	});

	it("types a computed output column symbol via inference", () => {
		const tree = resolveScopes(lower(parseDatabricks("SELECT lower(a) AS x FROM t").tree));
		const x = deriveSymbols(tree, new Schema({ t: { a: "string" } })).find((s) => s.name === "x");
		expect(x?.type).toEqual({ kind: "scalar", name: "string" });
	});

	it("carries lineage origins on an output column symbol (through a CTE)", () => {
		const tree = resolveScopes(lower(parseDatabricks("WITH c AS (SELECT a FROM t) SELECT a + 1 AS x FROM c").tree));
		const x = deriveSymbols(tree).find((s) => s.name === "x");
		expect(x?.origins?.map((o) => `${o.table.join(".")}.${o.column}`)).toEqual(["t.a"]);
	});
});

// The corpus-scale deriveSymbols gate moved to tests/corpus/databricks.oatly.test.ts (one pass over
// the Oatly corpus, shared with the other Databricks pipeline gates). The unit cases stay here.
