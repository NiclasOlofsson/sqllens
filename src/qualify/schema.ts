// ---------------------------------------------------------------------------
// Schema — the table -> columns catalog qualify resolves against. Mirrors
// sqlglot's MappingSchema input: a nested mapping that bottoms out at
// { column: type }. Accepts any nesting depth:
//   { table: { col: type } }
//   { db:    { table: { col: type } } }
//   { catalog: { schema: { table: { col: type } } } }
// Types are opaque strings for now (reserved for lineage/diagnostics later).
//
// Keys carry no quotedness signal (a JS object key can't say "I was quoted"), so a schema
// mapping key gets the forgiving UNQUOTED fold for its dialect — foldIdentifier(seg, dialect,
// "table") — same as an unquoted table reference in the query. Quoted-key support (a mapping key
// meant to represent a quoted/case-exact identifier) is out of scope.
// ---------------------------------------------------------------------------

import { foldIdentifier } from "../ident/fold.js";
import type { SchemaSource } from "./schema-source.js";

export interface Column {
	name: string;
	type?: string;
}

export type SchemaMapping = { [key: string]: SchemaMapping | string };

interface DialectIndex {
	/** Folded full dotted path (e.g. "cat.sch.t") -> columns. */
	byPath: Map<string, Column[]>;
	/** Folded bare table name -> columns, as a fallback for partially-qualified references. */
	byTable: Map<string, Column[]>;
}

export class Schema implements SchemaSource {
	/** A full upfront mapping's answers never change, so its invalidation signal is constant 0 — a
	 *  memo keyed on a Schema never has to invalidate (contrast CallbackSchema, which bumps). */
	readonly version = 0;
	private readonly mapping: SchemaMapping;
	/** Per-dialect lazy index cache — one Schema instance serves files of different dialects (the
	 *  LSP reality: one workspace schema, many open documents each with their own dialect). Keyed
	 *  by the dialect tag itself; `undefined` (no dialect) gets its own row — today's legacy fold. */
	private readonly indexes = new Map<string | undefined, DialectIndex>();

	constructor(mapping: SchemaMapping) {
		this.mapping = mapping;
	}

	/** Columns for a table identified by its name parts, or undefined if unknown. `parts` are RAW
	 *  (unfolded) — the fold for `dialect` happens here, once. */
	columnsFor(parts: string[], dialect?: string): Column[] | undefined {
		const idx = this.indexFor(dialect);
		const fold = (p: string) => foldIdentifier(p, dialect, "table");
		const full = parts.map(fold).join(".");
		return idx.byPath.get(full) ?? idx.byTable.get(fold(parts[parts.length - 1] ?? ""));
	}

	/** The bare names of every table in the catalog — the table-name candidate list for completion.
	 *  (Names are the folded last path part; a fully-qualified path resolves via columnsFor.) */
	tables(dialect?: string): string[] {
		return [...this.indexFor(dialect).byTable.keys()];
	}

	private indexFor(dialect: string | undefined): DialectIndex {
		let idx = this.indexes.get(dialect);
		if (!idx) {
			idx = { byPath: new Map(), byTable: new Map() };
			this.ingest(this.mapping, [], idx, dialect);
			this.indexes.set(dialect, idx);
		}
		return idx;
	}

	private ingest(node: SchemaMapping, path: string[], idx: DialectIndex, dialect: string | undefined): void {
		const entries = Object.entries(node);
		// A table node: every value is a column type (string).
		const isTable = entries.length > 0 && entries.every(([, v]) => typeof v === "string");
		if (isTable) {
			const cols: Column[] = entries.map(([name, type]) => ({ name, type: type as string }));
			const fold = (p: string) => foldIdentifier(p, dialect, "table");
			idx.byPath.set(path.map(fold).join("."), cols);
			const bare = fold(path[path.length - 1] ?? "");
			if (!idx.byTable.has(bare)) idx.byTable.set(bare, cols);
			return;
		}
		for (const [name, child] of entries) {
			if (typeof child === "object") this.ingest(child, [...path, name], idx, dialect);
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
