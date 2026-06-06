// ---------------------------------------------------------------------------
// Schema — the table -> columns catalog qualify resolves against. Mirrors
// sqlglot's MappingSchema input: a nested mapping that bottoms out at
// { column: type }. Accepts any nesting depth:
//   { table: { col: type } }
//   { db:    { table: { col: type } } }
//   { catalog: { schema: { table: { col: type } } } }
// Types are opaque strings for now (reserved for lineage/diagnostics later).
// ---------------------------------------------------------------------------

export interface Column {
  name: string;
  type?: string;
}

export type SchemaMapping = { [key: string]: SchemaMapping | string };

export class Schema {
  /** Normalized full dotted path (e.g. "cat.sch.t") -> columns. */
  private readonly byPath = new Map<string, Column[]>();
  /** Bare table name -> columns, as a fallback for partially-qualified references. */
  private readonly byTable = new Map<string, Column[]>();

  constructor(mapping: SchemaMapping) {
    this.ingest(mapping, []);
  }

  /** Columns for a table identified by its name parts, or undefined if unknown. */
  columnsFor(parts: string[]): Column[] | undefined {
    const full = parts.map(normalizeName).join(".");
    return this.byPath.get(full) ?? this.byTable.get(normalizeName(parts[parts.length - 1] ?? ""));
  }

  private ingest(node: SchemaMapping, path: string[]): void {
    const entries = Object.entries(node);
    // A table node: every value is a column type (string).
    const isTable = entries.length > 0 && entries.every(([, v]) => typeof v === "string");
    if (isTable) {
      const cols: Column[] = entries.map(([name, type]) => ({ name, type: type as string }));
      this.byPath.set(path.map(normalizeName).join("."), cols);
      const bare = normalizeName(path[path.length - 1] ?? "");
      if (!this.byTable.has(bare)) this.byTable.set(bare, cols);
      return;
    }
    for (const [name, child] of entries) {
      if (typeof child === "object") this.ingest(child, [...path, name]);
    }
  }
}

/** Databricks identifiers are case-insensitive; strip surrounding backticks too. */
function normalizeName(name: string): string {
  const unquoted = name.startsWith("`") && name.endsWith("`") ? name.slice(1, -1) : name;
  return unquoted.toLowerCase();
}
