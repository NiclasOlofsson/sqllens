import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lower } from "../src/databricks/ir.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { resolveScopes } from "../src/scope/scope.js";
import { deriveSymbols } from "../src/symbols/symbols.js";

function symbolsOf(sql: string) {
  return deriveSymbols(resolveScopes(lower(parseDatabricks(sql).tree)));
}

const CORPUS = resolve("harness/local/databricks");

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
    const oid = symbolsOf(
      "SELECT (SELECT max(x) FROM inner_t WHERE inner_t.k = o.id) FROM outer_t AS o",
    ).find((s) => s.name === "o.id");
    expect(oid?.modifiers).toContain("correlated");
  });
});

describe.skipIf(!existsSync(CORPUS))("deriveSymbols over the Oatly corpus", () => {
  it("derives symbols for every model without throwing; each has a frame and a span", () => {
    const files = readdirSync(CORPUS, { recursive: true }).filter(
      (f): f is string => typeof f === "string" && f.endsWith(".sql"),
    );
    let total = 0;
    for (const rel of files) {
      const syms = deriveSymbols(resolveScopes(lower(parseDatabricks(readFileSync(join(CORPUS, rel), "utf8")).tree)));
      for (const s of syms) {
        if (!s.frame || s.span.line < 0) throw new Error(`bad symbol in ${rel}: ${JSON.stringify(s)}`);
      }
      total += syms.length;
    }
    expect(total).toBeGreaterThan(0);
    console.log(`\nderiveSymbols: ${total} symbols across ${files.length} models`);
  }, 120000);
});
