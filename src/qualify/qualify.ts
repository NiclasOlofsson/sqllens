import type { ParserRuleContext } from "antlr4ng";
import type { ResolvedSource, Scope, ScopeTree } from "../scope/scope.js";
import type { Schema } from "./schema.js";

// ---------------------------------------------------------------------------
// Qualify — the schema-fed layer over the scope tree. It resolves what scope
// could not without a catalog: it expands `*` into explicit columns and reports
// diagnostics (today: unknown table). Schema-free resolution already happened in
// scope; qualify only fills the schema-dependent gaps. No SQL is rewritten.
// ---------------------------------------------------------------------------

export interface Diagnostic {
  kind: "unknown-table";
  message: string;
  line: number;
  column: number;
}

export interface Qualification {
  diagnostics: Diagnostic[];
  /** Resolved output columns of a scope (stars expanded), or "unknown". */
  columnsOf(scope: Scope): string[] | "unknown";
}

export function qualify(tree: ScopeTree, schema: Schema): Qualification {
  const diagnostics: Diagnostic[] = [];
  const resolved = new Map<Scope, string[] | "unknown">();

  // Post-order: a scope's columns may depend on its CTE/subquery children.
  const visit = (scope: Scope): void => {
    for (const child of scope.children) visit(child);
    resolved.set(scope, resolveColumns(scope, schema, resolved, diagnostics));
  };
  visit(tree.root);

  return {
    diagnostics,
    columnsOf: (scope) => resolved.get(scope) ?? "unknown",
  };
}

function resolveColumns(
  scope: Scope,
  schema: Schema,
  resolved: Map<Scope, string[] | "unknown">,
  diagnostics: Diagnostic[],
): string[] | "unknown" {
  const body = scope.body;
  if (body.kind === "setop") {
    return scope.branches ? (resolved.get(scope.branches.left) ?? "unknown") : "unknown";
  }

  const out: string[] = [];
  for (const p of body.projections) {
    if (p.isStar) {
      const cols = expandStar(scope, schema, resolved, diagnostics);
      if (cols === undefined) return "unknown";
      out.push(...cols);
    } else if (p.name !== undefined) {
      out.push(p.name);
    } else {
      return "unknown"; // anonymous expression — not nameable without modelling it
    }
  }
  return out;
}

function expandStar(
  scope: Scope,
  schema: Schema,
  resolved: Map<Scope, string[] | "unknown">,
  diagnostics: Diagnostic[],
): string[] | undefined {
  const cols: string[] = [];
  for (const src of scope.sources.values()) {
    const srcCols = columnsOfSource(src, schema, resolved, diagnostics);
    if (srcCols === undefined) return undefined;
    cols.push(...srcCols);
  }
  return cols;
}

function columnsOfSource(
  src: ResolvedSource,
  schema: Schema,
  resolved: Map<Scope, string[] | "unknown">,
  diagnostics: Diagnostic[],
): string[] | undefined {
  if (src.kind === "table") {
    // Inline column aliases (t AS u (c1, c2)) name the columns without a catalog.
    if (src.source.columnAliases) return src.source.columnAliases;
    const cols = schema.columnsFor(src.name);
    if (!cols) {
      diagnostics.push(unknownTable(src.name, src.source.cst));
      return undefined;
    }
    return cols.map((c) => c.name);
  }
  if (src.kind === "cte") {
    if (src.ref.def.columnAliases) return src.ref.def.columnAliases; // WITH c (x, y) AS …
    const r = resolved.get(src.ref.scope);
    return r === undefined || r === "unknown" ? undefined : r;
  }
  if (src.kind === "lateral") return src.source.columns; // exposes its AS columns
  // subquery — inline column aliases, else the already-resolved child scope columns.
  if (src.source.columnAliases) return src.source.columnAliases;
  const r = resolved.get(src.scope);
  return r === undefined || r === "unknown" ? undefined : r;
}

function unknownTable(name: string[], cst: ParserRuleContext): Diagnostic {
  const tok = cst.start;
  return {
    kind: "unknown-table",
    message: `Unknown table: ${name.join(".")}`,
    line: tok?.line ?? 0,
    column: tok?.column ?? 0,
  };
}
