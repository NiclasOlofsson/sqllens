import type { ParserRuleContext } from "antlr4ng";
import type { ColumnRef, Projection } from "../databricks/ir.js";
import {
  resolveColumn,
  splitColumnRefInScope,
  type ResolvedSource,
  type Scope,
  type ScopeTree,
  type SplitRef,
} from "../scope/scope.js";
import { parseStructFields, type Column, type Schema } from "./schema.js";

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
  const resolved = new Map<Scope, Column[] | "unknown">();

  // Post-order: a scope's columns (and their types) may depend on its CTE/subquery children.
  const visit = (scope: Scope): void => {
    for (const child of scope.children) visit(child);
    resolved.set(scope, resolveColumns(scope, schema, resolved, diagnostics));
    for (const ref of scope.body.columns) checkColumn(scope, ref, schema, resolved, diagnostics);
  };
  visit(tree.root);

  return {
    diagnostics,
    columnsOf: (scope) => {
      const r = resolved.get(scope);
      return r === undefined || r === "unknown" ? "unknown" : r.map((c) => c.name);
    },
  };
}

function resolveColumns(
  scope: Scope,
  schema: Schema,
  resolved: Map<Scope, Column[] | "unknown">,
  diagnostics: Diagnostic[],
): Column[] | "unknown" {
  const body = scope.body;
  if (body.kind === "setop") {
    return scope.branches ? (resolved.get(scope.branches.left) ?? "unknown") : "unknown";
  }

  const out: Column[] = [];
  for (const p of body.projections) {
    if (p.isStar) {
      const cols = expandStar(scope, schema, resolved, diagnostics);
      if (cols === undefined) return "unknown";
      out.push(...cols);
    } else if (p.name !== undefined) {
      // A pass-through column ref carries its source column's type; a computed expression has
      // no type without inference (the one honest boundary), so its type stays undefined.
      out.push({ name: p.name, type: projectionType(scope, p, schema, resolved) });
    } else {
      return "unknown"; // anonymous expression — not nameable without modelling it
    }
  }
  return out;
}

/** The type of a projection's output when it is a pass-through column reference (else undefined). */
function projectionType(
  scope: Scope,
  p: Projection,
  schema: Schema,
  resolved: Map<Scope, Column[] | "unknown">,
): string | undefined {
  if (p.expr.kind !== "column") return undefined; // computed — needs the type-inference engine
  const split = splitColumnRefInScope(scope, p.expr.parts);
  const src = sourceOfColumn(scope, split, schema, resolved);
  if (!src) return undefined;
  const base = sourceColumnType(src, split.column, schema, resolved);
  return split.fields.length ? walkFieldType(base, split.fields) : base;
}

/**
 * The source a (possibly qualified) column resolves to, using the schema for membership —
 * unlike scope's schema-free resolveColumn, which can't bind a bare column over a bare table.
 */
function sourceOfColumn(
  scope: Scope,
  split: SplitRef,
  schema: Schema,
  resolved: Map<Scope, Column[] | "unknown">,
): ResolvedSource | undefined {
  if (split.qualifier !== undefined) {
    for (let s: Scope | undefined = scope; s; s = s.parent) {
      const src = s.sources.get(split.qualifier);
      if (src) return src;
    }
    return undefined;
  }
  const name = normalizeName(split.column);
  for (let s: Scope | undefined = scope; s; s = s.parent) {
    for (const src of s.sources.values()) {
      const cols = sourceColumns(src, schema, resolved);
      if (cols?.some((c) => normalizeName(c) === name)) return src;
    }
  }
  return undefined;
}

function expandStar(
  scope: Scope,
  schema: Schema,
  resolved: Map<Scope, Column[] | "unknown">,
  diagnostics: Diagnostic[],
): Column[] | undefined {
  const cols: Column[] = [];
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
  resolved: Map<Scope, Column[] | "unknown">,
  diagnostics: Diagnostic[],
): Column[] | undefined {
  if (src.kind === "table") {
    // Inline column aliases (t AS u (c1, c2)) name the columns without a catalog (no types).
    if (src.source.columnAliases) return src.source.columnAliases.map((name) => ({ name }));
    const cols = schema.columnsFor(src.name);
    if (!cols) {
      diagnostics.push(unknownTable(src.name, src.source.cst));
      return undefined;
    }
    return cols;
  }
  if (src.kind === "cte") {
    const body = resolved.get(src.ref.scope);
    if (src.ref.def.columnAliases) return renameColumns(src.ref.def.columnAliases, body); // WITH c (x,y) AS …
    return body === undefined || body === "unknown" ? undefined : body;
  }
  if (src.kind === "lateral") return src.source.columns.map((name) => ({ name })); // AS columns, no types
  // subquery — inline column aliases (rename, keep types by position), else the child columns.
  const body = resolved.get(src.scope);
  if (src.source.columnAliases) return renameColumns(src.source.columnAliases, body);
  return body === undefined || body === "unknown" ? undefined : body;
}

/** Rename a derived relation's columns by position (its alias list), carrying each type along. */
function renameColumns(aliases: string[], body: Column[] | "unknown" | undefined): Column[] {
  const cols = body !== undefined && body !== "unknown" ? body : undefined;
  return aliases.map((name, i) => ({ name, type: cols?.[i]?.type }));
}

/**
 * The declared type of `columnName` in a resolved source — the schema for a table, the
 * already-computed child columns for a CTE/subquery (honoring a positional alias list).
 * This is how a struct type threads through derived columns without expression inference.
 */
function sourceColumnType(
  src: ResolvedSource,
  columnName: string,
  schema: Schema,
  resolved: Map<Scope, Column[] | "unknown">,
): string | undefined {
  if (src.kind === "table") {
    if (src.source.columnAliases) return undefined; // inline aliases carry no type
    return schema.columnsFor(src.name)?.find((c) => normalizeName(c.name) === normalizeName(columnName))
      ?.type;
  }
  if (src.kind === "cte") {
    return columnFrom(resolved.get(src.ref.scope), columnName, src.ref.def.columnAliases)?.type;
  }
  if (src.kind === "subquery") {
    return columnFrom(resolved.get(src.scope), columnName, src.source.columnAliases)?.type;
  }
  return undefined; // lateral — no types
}

/** Find a column by output name in a resolved column list, honoring a positional alias list. */
function columnFrom(
  cols: Column[] | "unknown" | undefined,
  name: string,
  aliases: string[] | undefined,
): Column | undefined {
  if (cols === undefined || cols === "unknown") return undefined;
  if (aliases) {
    const i = aliases.findIndex((a) => normalizeName(a) === normalizeName(name));
    return i >= 0 ? cols[i] : undefined;
  }
  return cols.find((c) => normalizeName(c.name) === normalizeName(name));
}

/** Walk a field path through nested struct types, returning the leaf type, or undefined if unknown. */
function walkFieldType(type: string | undefined, fields: string[]): string | undefined {
  let t = type;
  for (const field of fields) {
    if (!t) return undefined;
    const structFields = parseStructFields(t);
    if (!structFields) return undefined;
    const hit = structFields.find((f) => normalizeName(f.name) === normalizeName(field));
    if (!hit) return undefined;
    t = hit.type;
  }
  return t;
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
  resolved: Map<Scope, Column[] | "unknown">,
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
      checkFieldPath(src, name, split.fields, schema, resolved, ref, diagnostics);
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
      if (matched) checkFieldPath(matched, name, split.fields, schema, resolved, ref, diagnostics);
      return;
    }
    if (unknown > 0) return; // might live in a source whose columns we don't know
    // all sources here known, none has it — try an enclosing scope (correlation)
  }
  diagnostics.push(columnDiag("unknown-column", ref, `Unknown column: ${name}`));
}

/**
 * Walk a struct/field path (`addr.city`, `a.b.c`) against the base column's struct type. The
 * type is resolved from a table schema or threaded through a derived (CTE/subquery) column —
 * so field access on a derived column is validated too, not just on base tables. Conservative:
 * a field is flagged only when its parent is a *known struct* that lacks it; arrays, maps,
 * primitives, and unknown types (e.g. a computed column, which needs type inference) stop the
 * walk without flagging.
 */
function checkFieldPath(
  src: ResolvedSource,
  columnName: string,
  fields: string[],
  schema: Schema,
  resolved: Map<Scope, Column[] | "unknown">,
  ref: ColumnRef,
  diagnostics: Diagnostic[],
): void {
  if (fields.length === 0) return;
  let type = sourceColumnType(src, columnName, schema, resolved);
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

/** Schema-resolved column names of a source, or undefined when unknown (needs a catalog). */
function sourceColumns(
  src: ResolvedSource,
  schema: Schema,
  resolved: Map<Scope, Column[] | "unknown">,
): string[] | undefined {
  if (src.kind === "table") {
    if (src.source.columnAliases) return src.source.columnAliases;
    return schema.columnsFor(src.name)?.map((c) => c.name);
  }
  if (src.kind === "cte") {
    if (src.ref.def.columnAliases) return src.ref.def.columnAliases;
    const r = resolved.get(src.ref.scope);
    return r === undefined || r === "unknown" ? undefined : r.map((c) => c.name);
  }
  if (src.kind === "lateral") return src.source.columns;
  if (src.source.columnAliases) return src.source.columnAliases;
  const r = resolved.get(src.scope);
  return r === undefined || r === "unknown" ? undefined : r.map((c) => c.name);
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
