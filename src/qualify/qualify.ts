import type { ParserRuleContext } from "antlr4ng";
import type { ColumnRef } from "../databricks/ir.js";
import {
  resolveColumn,
  splitColumnRefInScope,
  type ResolvedSource,
  type Scope,
  type ScopeTree,
} from "../scope/scope.js";
import { inferType } from "../infer/infer.js";
import { type Schema } from "./schema.js";

// ---------------------------------------------------------------------------
// Qualify — the schema-fed layer over the scope tree. It resolves what scope
// could not without a catalog: it expands `*` into explicit columns and reports
// diagnostics (today: unknown table). Schema-free resolution already happened in
// scope; qualify only fills the schema-dependent gaps. No SQL is rewritten.
// ---------------------------------------------------------------------------

export interface Diagnostic {
  kind: "unknown-table" | "unknown-column" | "ambiguous-column" | "unknown-field";
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

  // Post-order: a scope's columns (and their types) may depend on its CTE/subquery children.
  const visit = (scope: Scope): void => {
    for (const child of scope.children) visit(child);
    resolved.set(scope, resolveColumns(scope, schema, resolved, diagnostics));
    for (const ref of scope.body.columns) checkColumn(scope, ref, schema, resolved, diagnostics);
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
      const qualifier = p.expr.kind === "star" ? p.expr.qualifier : undefined;
      const cols = expandStar(scope, schema, resolved, diagnostics, qualifier);
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
  qualifier?: string[],
): string[] | undefined {
  // A qualified star `t.*` expands only the source keyed by `t` (its last name part); a bare
  // `*` expands every source in order.
  const want = qualifier ? normalizeName(qualifier[qualifier.length - 1] ?? "") : undefined;
  const cols: string[] = [];
  let matched = false;
  for (const [key, src] of scope.sources) {
    if (want !== undefined && key !== want) continue;
    matched = true;
    const srcCols = columnsOfSource(src, schema, resolved, diagnostics);
    if (srcCols === undefined) return undefined;
    cols.push(...srcCols);
  }
  if (want !== undefined && !matched) return undefined; // qualified star naming no visible source
  return cols;
}

/** The output column names of a source — schema for a table (reporting unknown-table if absent),
 *  the resolved child names for a CTE/subquery (column aliases rename them), the AS columns for a
 *  lateral view. Types are not threaded here; type inference (src/infer) owns types. */
function columnsOfSource(
  src: ResolvedSource,
  schema: Schema,
  resolved: Map<Scope, string[] | "unknown">,
  diagnostics: Diagnostic[],
): string[] | undefined {
  if (src.kind === "table") {
    if (src.source.columnAliases) return src.source.columnAliases;
    const cols = schema.columnsFor(src.name);
    if (!cols) {
      diagnostics.push(unknownTable(src.name, src.source.cst));
      return undefined;
    }
    return cols.map((c) => c.name);
  }
  if (src.kind === "cte") return src.ref.def.columnAliases ?? known(resolved.get(src.ref.scope));
  if (src.kind === "lateral") return src.source.columns;
  return src.source.columnAliases ?? known(resolved.get(src.scope));
}

function known(r: string[] | "unknown" | undefined): string[] | undefined {
  return r === undefined || r === "unknown" ? undefined : r;
}

/**
 * Verify a column reference against the schema-resolved sources (walking enclosing scopes
 * for correlation). Conservative: a diagnostic fires only when a source's columns are
 * actually known and the column is missing/ambiguous — never merely because a schema is absent.
 */
function checkColumn(
  scope: Scope,
  ref: ColumnRef,
  schema: Schema,
  resolved: Map<Scope, string[] | "unknown">,
  diagnostics: Diagnostic[],
): void {
  // A bare name in GROUP BY/HAVING/ORDER BY (incl. after a UNION) may reference a SELECT alias
  // rather than a column — don't flag it. resolveColumn applies the alias + precedence rules.
  if (resolveColumn(scope, ref).kind === "alias") return;

  // Split off struct/field navigation: `t.c.f` checks the column `c`, then walks the field
  // path `f` against `c`'s struct type — resolved from a table schema or threaded through a
  // derived (CTE/subquery) column; see checkFieldPath.
  const split = splitColumnRefInScope(scope, ref.parts);
  const name = normalizeName(split.column);

  if (split.qualifier !== undefined) {
    for (let s: Scope | undefined = scope; s; s = s.parent) {
      const src = s.sources.get(split.qualifier);
      if (!src) continue;
      const cols = sourceColumns(src, schema, resolved);
      if (cols && !cols.some((c) => normalizeName(c) === name)) {
        diagnostics.push(columnDiag("unknown-column", ref, `Unknown column: ${ref.parts.join(".")}`));
        return; // base column missing — don't also walk its (nonexistent) fields
      }
      checkFieldPath(split.fields, scope, schema, ref, diagnostics);
      return; // qualifier resolved (or columns unknown) — done
    }
    return; // qualifier visible but not found in this chain — defensive; don't flag
  }

  // Unqualified: the innermost scope with a known match wins; ambiguous if several here.
  for (let s: Scope | undefined = scope; s; s = s.parent) {
    const sources = [...s.sources.values()];
    if (sources.length === 0) continue;
    let matches = 0;
    let unknown = 0;
    for (const src of sources) {
      const cols = sourceColumns(src, schema, resolved);
      if (!cols) unknown++;
      else if (cols.some((c) => normalizeName(c) === name)) matches++;
    }
    if (matches > 1) {
      diagnostics.push(columnDiag("ambiguous-column", ref, `Ambiguous column: ${name}`));
      return;
    }
    if (matches === 1) {
      checkFieldPath(split.fields, scope, schema, ref, diagnostics);
      return;
    }
    if (unknown > 0) return; // might live in a source whose columns we don't know
    // all sources here known, none has it — try an enclosing scope (correlation)
  }
  diagnostics.push(columnDiag("unknown-column", ref, `Unknown column: ${name}`));
}

/**
 * Validate a struct/field path (`addr.city`, `a.b.c`) against the base column's *inferred* type.
 * inferType resolves the base column — the schema for a base table, the producing projection for
 * a derived column, the function for a computed one — so field access on a computed column is
 * checked too. Conservative: a field is flagged only when its parent is a known struct that lacks
 * it; an unknown or non-struct (array/map/primitive) type stops the walk without flagging.
 */
function checkFieldPath(
  fields: string[],
  scope: Scope,
  schema: Schema,
  ref: ColumnRef,
  diagnostics: Diagnostic[],
): void {
  if (fields.length === 0) return;
  const baseParts = ref.parts.slice(0, ref.parts.length - fields.length);
  let type = inferType({ kind: "column", parts: baseParts, cst: ref.cst }, scope, schema);
  for (const field of fields) {
    if (type.kind !== "struct") return; // unknown / non-struct — don't flag
    const hit = type.fields.find((f) => normalizeName(f.name) === normalizeName(field));
    if (!hit) {
      diagnostics.push(columnDiag("unknown-field", ref, `Unknown field: ${ref.parts.join(".")}`));
      return;
    }
    type = hit.type;
  }
}

/** Schema-resolved column names of a source, or undefined when unknown (needs a catalog). */
function sourceColumns(
  src: ResolvedSource,
  schema: Schema,
  resolved: Map<Scope, string[] | "unknown">,
): string[] | undefined {
  if (src.kind === "table") {
    if (src.source.columnAliases) return src.source.columnAliases;
    return schema.columnsFor(src.name)?.map((c) => c.name);
  }
  if (src.kind === "cte") return src.ref.def.columnAliases ?? known(resolved.get(src.ref.scope));
  if (src.kind === "lateral") return src.source.columns;
  return src.source.columnAliases ?? known(resolved.get(src.scope));
}

function columnDiag(kind: Diagnostic["kind"], ref: ColumnRef, message: string): Diagnostic {
  const tok = ref.cst.start;
  return { kind, message, line: tok?.line ?? 0, column: tok?.column ?? 0 };
}

function normalizeName(name: string): string {
  const unquoted = name.startsWith("`") && name.endsWith("`") ? name.slice(1, -1) : name;
  return unquoted.toLowerCase();
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
