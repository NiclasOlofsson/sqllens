import type { ParserRuleContext } from "antlr4ng";
import type { ColumnRef } from "../databricks/ir.js";
import {
  resolveColumn,
  splitColumnRefInScope,
  type ResolvedSource,
  type Scope,
  type ScopeTree,
} from "../scope/scope.js";
import { parseStructFields, type Schema } from "./schema.js";

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

  // Post-order: a scope's columns may depend on its CTE/subquery children.
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
  // path `f` against `c`'s struct type (when known from a table schema — see checkFieldPath).
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
      checkFieldPath(src, name, split.fields, schema, ref, diagnostics);
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
    let matched: ResolvedSource | undefined;
    for (const src of sources) {
      const cols = sourceColumns(src, schema, resolved);
      if (!cols) unknown++;
      else if (cols.some((c) => normalizeName(c) === name)) {
        matches++;
        matched = src;
      }
    }
    if (matches > 1) {
      diagnostics.push(columnDiag("ambiguous-column", ref, `Ambiguous column: ${name}`));
      return;
    }
    if (matches === 1) {
      if (matched) checkFieldPath(matched, name, split.fields, schema, ref, diagnostics);
      return;
    }
    if (unknown > 0) return; // might live in a source whose columns we don't know
    // all sources here known, none has it — try an enclosing scope (correlation)
  }
  diagnostics.push(columnDiag("unknown-column", ref, `Unknown column: ${name}`));
}

/**
 * Walk a struct/field path (`addr.city`, `a.b.c`) against the base column's struct type.
 * The type is known only when the base column comes from a table schema (CTE/subquery
 * outputs carry names, not types), so otherwise this is a no-op. Conservative: a field is
 * flagged only when its parent type is a *known struct* that lacks it — arrays, maps,
 * primitives, and unknown types stop the walk without flagging.
 */
function checkFieldPath(
  src: ResolvedSource,
  columnName: string,
  fields: string[],
  schema: Schema,
  ref: ColumnRef,
  diagnostics: Diagnostic[],
): void {
  if (fields.length === 0) return;
  if (src.kind !== "table" || src.source.columnAliases) return; // type known only from a table schema
  const col = schema
    .columnsFor(src.name)
    ?.find((c) => normalizeName(c.name) === normalizeName(columnName));
  let type = col?.type;
  for (const field of fields) {
    if (!type) return; // unknown type — stop
    const structFields = parseStructFields(type);
    if (!structFields) return; // not a struct (array/map/primitive) — don't flag
    const hit = structFields.find((f) => normalizeName(f.name) === normalizeName(field));
    if (!hit) {
      diagnostics.push(columnDiag("unknown-field", ref, `Unknown field: ${ref.parts.join(".")}`));
      return;
    }
    type = hit.type;
  }
}

/** Schema-resolved columns of a source, or undefined when unknown (needs a catalog). */
function sourceColumns(
  src: ResolvedSource,
  schema: Schema,
  resolved: Map<Scope, string[] | "unknown">,
): string[] | undefined {
  if (src.kind === "table") {
    if (src.source.columnAliases) return src.source.columnAliases;
    return schema.columnsFor(src.name)?.map((c) => c.name);
  }
  if (src.kind === "cte") {
    if (src.ref.def.columnAliases) return src.ref.def.columnAliases;
    const r = resolved.get(src.ref.scope);
    return r === undefined || r === "unknown" ? undefined : r;
  }
  if (src.kind === "lateral") return src.source.columns;
  if (src.source.columnAliases) return src.source.columnAliases;
  const r = resolved.get(src.scope);
  return r === undefined || r === "unknown" ? undefined : r;
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
