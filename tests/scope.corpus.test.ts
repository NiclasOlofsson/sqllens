import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lower, type QueryBody, type QueryExpr } from "../src/databricks/ir.js";
import { parseDatabricks } from "../src/databricks/parse.js";
import { resolveColumn, resolveScopes, type Scope } from "../src/scope/scope.js";

interface Stats {
  queries: number;
  ctes: number;
  projections: number;
  projectionsNamed: number;
  sources: number;
  tables: number;
  subqueries: number;
}

interface ScopeStats {
  scopes: number;
  outputsKnown: number;
  srcTable: number;
  srcCte: number;
  srcSubquery: number;
  // Why a scope's outputs are unknown:
  unkTableStar: number; // star over physical table(s)/model(s) only — needs the catalog
  unkDerivedStar: number; // star where a source is a CTE/subquery — resolvable schema-free
  unkExprOnly: number; // no star; an unaliased expression has no name
  // Column binding (resolveColumn) over every column reference:
  colTotal: number;
  colBound: number;
  colAmbiguous: number;
  colNeedsSchema: number;
  colUnresolved: number;
}

function walkScopes(scope: Scope, acc: ScopeStats): void {
  acc.scopes++;
  if (scope.outputs !== "unknown") acc.outputsKnown++;
  else if (scope.body.kind === "select") {
    const hasStar = scope.body.projections.some((p) => p.isStar);
    if (!hasStar) {
      acc.unkExprOnly++;
    } else {
      const srcKinds = [...scope.sources.values()];
      const allPhysical = srcKinds.length > 0 && srcKinds.every((s) => s.kind === "table");
      if (allPhysical) acc.unkTableStar++;
      else acc.unkDerivedStar++;
    }
  }
  for (const src of scope.sources.values()) {
    if (src.kind === "table") acc.srcTable++;
    else if (src.kind === "cte") acc.srcCte++;
    else acc.srcSubquery++;
  }
  if (scope.body.kind === "select") {
    for (const ref of scope.body.columns) {
      acc.colTotal++;
      const r = resolveColumn(scope, ref);
      if (r.kind === "bound") acc.colBound++;
      else if (r.kind === "ambiguous") acc.colAmbiguous++;
      else if (r.kind === "needs-schema") acc.colNeedsSchema++;
      else acc.colUnresolved++;
    }
  }
  for (const child of scope.children) walkScopes(child, acc);
}

// Walk the whole IR (main query + CTE bodies + subquery bodies) accumulating fidelity counts.
function walkIr(q: QueryExpr, acc: Stats): void {
  acc.queries++;
  acc.ctes += q.ctes.length;
  for (const cte of q.ctes) walkIr(cte.body, acc);
  walkBody(q.body, acc);
}

function walkBody(body: QueryBody, acc: Stats): void {
  if (body.kind === "setop") {
    walkBody(body.left, acc);
    walkBody(body.right, acc);
    return;
  }
  acc.projections += body.projections.length;
  acc.projectionsNamed += body.projections.filter((p) => p.name !== undefined).length;
  for (const s of body.from) {
    acc.sources++;
    if (s.kind === "table") acc.tables++;
    else {
      acc.subqueries++;
      walkIr(s.query, acc);
    }
  }
}

// The real Oatly corpus is the continuous gate for the semantic layer, the same way
// it gates the grammar. lower + resolveScopes must run over every compiled model
// without throwing. (Correctness of the IR shape is covered by the unit tests; this
// is the stability + coverage signal at scale.) Skips when the corpus is absent.
const CORPUS = resolve("harness/local/databricks");

function clusterKey(msg: string): string {
  return msg
    .replace(/'[^']*'/g, "'X'")
    .replace(/\d+/g, "N")
    .slice(0, 90);
}

describe.skipIf(!existsSync(CORPUS))("semantic layer over the Oatly corpus", () => {
  it("lower + resolveScopes run over every model without throwing", () => {
    const files = readdirSync(CORPUS, { recursive: true }).filter(
      (f): f is string => typeof f === "string" && f.endsWith(".sql"),
    );

    let lowered = 0;
    let scoped = 0;
    let setOpFiles = 0; // files carrying a set-op keyword (now represented as SetOpExpr, not truncated)
    const stats: Stats = {
      queries: 0,
      ctes: 0,
      projections: 0,
      projectionsNamed: 0,
      sources: 0,
      tables: 0,
      subqueries: 0,
    };
    const scopeStats: ScopeStats = {
      scopes: 0,
      outputsKnown: 0,
      srcTable: 0,
      srcCte: 0,
      srcSubquery: 0,
      unkTableStar: 0,
      unkDerivedStar: 0,
      unkExprOnly: 0,
      colTotal: 0,
      colBound: 0,
      colAmbiguous: 0,
      colNeedsSchema: 0,
      colUnresolved: 0,
    };
    const clusters = new Map<string, number>();
    const sample: Record<string, string> = {};

    for (const rel of files) {
      const sql = readFileSync(join(CORPUS, rel), "utf8");
      // Rough flag: a set-op keyword anywhere (overcounts subquery unions, but signals exposure).
      if (/\b(union|except|intersect|minus)\b/i.test(sql)) setOpFiles++;
      try {
        const ir = lower(parseDatabricks(sql).tree);
        lowered++;
        const tree = resolveScopes(ir);
        scoped++;
        walkIr(ir, stats);
        walkScopes(tree.root, scopeStats);
      } catch (e) {
        const key = clusterKey(e instanceof Error ? e.message : String(e));
        clusters.set(key, (clusters.get(key) ?? 0) + 1);
        if (!sample[key]) sample[key] = rel;
      }
    }

    const top = [...clusters.entries()].sort((a, b) => b[1] - a[1]);
    const pct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) : "0.0");
    console.log(
      [
        ``,
        `Semantic layer over ${files.length} compiled models:`,
        `  lower ok:  ${lowered}    scope ok: ${scoped}    failures: ${files.length - scoped}`,
        `  files with a set-op keyword: ${setOpFiles}  (now lowered as SetOpExpr, both branches kept)`,
        ``,
        `IR fidelity (across ${stats.queries} query blocks):`,
        `  CTEs:        ${stats.ctes}`,
        `  sources:     ${stats.sources}  (tables ${stats.tables}, subqueries ${stats.subqueries})`,
        `  projections: ${stats.projections}  named ${stats.projectionsNamed} (${pct(stats.projectionsNamed, stats.projections)}%)`,
        ``,
        `Scope resolution (${scopeStats.scopes} scopes):`,
        `  outputs known: ${scopeStats.outputsKnown} (${pct(scopeStats.outputsKnown, scopeStats.scopes)}%)`,
        `  outputs unknown by cause: table-star ${scopeStats.unkTableStar} (needs catalog), ` +
          `derived-star ${scopeStats.unkDerivedStar} (schema-free), expr-only ${scopeStats.unkExprOnly}`,
        `  sources: table ${scopeStats.srcTable}, cte ${scopeStats.srcCte}, subquery ${scopeStats.srcSubquery}`,
        ``,
        `Column binding (${scopeStats.colTotal} refs, schema-free):`,
        `  bound ${scopeStats.colBound} (${pct(scopeStats.colBound, scopeStats.colTotal)}%), ` +
          `ambiguous ${scopeStats.colAmbiguous}, needs-schema ${scopeStats.colNeedsSchema}, ` +
          `unresolved ${scopeStats.colUnresolved}`,
        ``,
        `Top failure clusters:`,
        ...top.map(([k, n]) => `  ${String(n).padStart(4)}  ${k}   e.g. ${sample[k]}`),
      ].join("\n"),
    );

    expect(files.length).toBeGreaterThan(0);
    // Gate: lower + resolveScopes must never throw on a real model. The printed fidelity
    // stats (set-op exposure, projection-naming %) are the running scoreboard that drives
    // the next cycles — a correctness signal the bare "no throw" can't give.
    expect(scoped).toBe(files.length);
  }, 180000);
});
