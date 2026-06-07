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

/**
 * Parse a Databricks/Spark struct type string into its fields, or undefined if `type`
 * is not a struct (a primitive, array, map, or anything unparseable — callers stop there).
 * Handles nesting: a field's `type` may itself be `struct<…>` and is parsed on demand.
 *   "struct<city:string,zip:int>" -> [{name:"city",type:"string"}, {name:"zip",type:"int"}]
 */
export function parseStructFields(type: string): Column[] | undefined {
	const m = /^\s*struct\s*<(.*)>\s*$/is.exec(type);
	if (!m) return undefined;
	const fields: Column[] = [];
	for (const part of splitTopLevel(m[1])) {
		const colon = topLevelColon(part);
		if (colon < 0) continue; // not a `name:type` field — skip rather than mis-read
		const name = normalizeName(part.slice(0, colon).trim());
		let fieldType = part.slice(colon + 1).trim();
		const comment = fieldType.search(/\s+comment\s+'/i); // strip a trailing COMMENT '…'
		if (comment >= 0) fieldType = fieldType.slice(0, comment).trim();
		if (name) fields.push({ name, type: fieldType });
	}
	return fields;
}

/** Split on commas that are not nested inside `<…>` or `(…)`. */
function splitTopLevel(s: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (ch === "<" || ch === "(") depth++;
		else if (ch === ">" || ch === ")") depth--;
		else if (ch === "," && depth === 0) {
			out.push(s.slice(start, i));
			start = i + 1;
		}
	}
	out.push(s.slice(start));
	return out.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Index of the first `:` not nested inside `<…>` or `(…)`, or -1. */
function topLevelColon(s: string): number {
	let depth = 0;
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (ch === "<" || ch === "(") depth++;
		else if (ch === ">" || ch === ")") depth--;
		else if (ch === ":" && depth === 0) return i;
	}
	return -1;
}

/** Databricks identifiers are case-insensitive; strip surrounding backticks too. */
function normalizeName(name: string): string {
	const unquoted = name.startsWith("`") && name.endsWith("`") ? name.slice(1, -1) : name;
	return unquoted.toLowerCase();
}
