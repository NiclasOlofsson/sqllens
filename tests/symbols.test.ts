import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./helpers/corpus.js";
import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/lower.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { Schema } from "../src/qualify/schema.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";

function symbolsOf(sql: string) {
	return deriveSymbols(resolveScopes(lower(parseDatabricks(sql).tree)));
}

const CORPUS = corpusPath("harness/local/databricks");

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

	it("has no in-query definition for a catalog-table column", () => {
		const ref = symbolsOf("SELECT a FROM t").find((s) => s.kind === "column" && s.name === "a");
		expect(ref?.definition).toBeUndefined();
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

describe.skipIf(!existsSync(CORPUS))("deriveSymbols over the Oatly corpus", () => {
	it("derives symbols for every model without throwing; each has a frame and a span", () => {
		const files = readdirSync(CORPUS, { recursive: true }).filter(
			(f): f is string => typeof f === "string" && f.endsWith(".sql"),
		);
		let total = 0;
		for (const rel of files) {
			const syms = deriveSymbols(
				resolveScopes(lower(parseDatabricks(readFileSync(join(CORPUS, rel), "utf8")).tree)),
			);
			for (const s of syms) {
				if (!s.frame || s.span.line < 0) throw new Error(`bad symbol in ${rel}: ${JSON.stringify(s)}`);
			}
			total += syms.length;
		}
		expect(total).toBeGreaterThan(0);
		console.log(`\nderiveSymbols: ${total} symbols across ${files.length} models`);
	}, 120000);
});
