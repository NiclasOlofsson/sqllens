// ---------------------------------------------------------------------------
// Schema — the table -> columns catalog qualify resolves against. Mirrors
// sqlglot's MappingSchema input: a nested mapping that bottoms out at
// { column: type }. Accepts any nesting depth:
//   { table: { col: type } }
//   { db:    { table: { col: type } } }
//   { catalog: { schema: { table: { col: type } } } }
// Types are opaque strings for now (reserved for lineage/diagnostics later). A leaf may instead be
// `{ type?, nullable }` — the object form exists to declare nullability; for type-only use the bare
// string. `nullable` is REQUIRED on the object form: without it the object is structurally
// indistinguishable from a nested mapping (a table whose column is named `type` would vanish),
// and a type-only object says nothing the bare string doesn't.
//
// Keys carry no quotedness signal (a JS object key can't say "I was quoted"), so a schema
// mapping key gets the forgiving UNQUOTED fold for its dialect — foldIdentifier(seg, dialect,
// "table") — same as an unquoted table reference in the query. Quoted-key support (a mapping key
// meant to represent a quoted/case-exact identifier) is out of scope.
// ---------------------------------------------------------------------------

import { resolveBehavior } from "../dialect-behavior/registry.js";
import type { SchemaProvider } from "./schema-provider.js";

export interface Column {
	name: string;
	type?: string;
	/** NOT NULL-ness, when the mapping states it. Absent = unknown — never guessed. */
	nullable?: boolean;
}

/** A leaf is either a bare type string, or the object form for declaring nullability (for
 *  type-only, use the bare string). `nullable` is required — see the header note. */
export type SchemaLeaf = string | { type?: string; nullable: boolean };

export type SchemaMapping = { [key: string]: SchemaMapping | SchemaLeaf };

interface DialectIndex {
	/** Folded full dotted path (e.g. "cat.sch.t") -> columns. */
	byPath: Map<string, Column[]>;
	/** Folded bare table name -> columns of the FIRST table with that name — the completion listing
	 *  only (`tables()`); resolution never reads it (#38: the bare-name fallback silently served the
	 *  wrong schema's table). */
	byTable: Map<string, Column[]>;
	/** Folded last part -> every declared table sharing it, with full folded path parts — the
	 *  suffix-matching index: a partial qualification resolves iff exactly ONE declared path ends
	 *  with the written parts, on part boundaries. */
	byLast: Map<string, { parts: string[]; cols: Column[] }[]>;
}

/** Whether `path` ends with `suffix`, comparing whole parts (never string suffixes — `s.orders`
 *  must not match `logs.orders`). */
function endsWithParts(path: string[], suffix: string[]): boolean {
	if (suffix.length > path.length) return false;
	const off = path.length - suffix.length;
	return suffix.every((p, i) => p === path[off + i]);
}

export class Schema implements SchemaProvider {
	/** A declared mapping is a CLOSED world: a miss means the table does not exist (unknown-table fires). */
	readonly world = "closed" as const;
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
	 *  (unfolded) — the fold for `dialect` happens here, once. Resolution is exact-path first, then
	 *  UNIQUE suffix match on part boundaries (#38): a partial qualification (`gold.orders` for
	 *  declared `prod.gold.orders`) resolves; a nonexistent qualified path or an ambiguous bare
	 *  name is a MISS (closed world: unknown table / ambiguity diagnosed by the caller via
	 *  `tableCandidates`), never silently some same-named table from another schema. */
	columnsFor(parts: string[], dialect?: string): Column[] | undefined {
		const exact = this.matches(parts, dialect);
		return exact.length === 1 ? exact[0]!.cols : undefined;
	}

	/** Every declared table whose full path ends with `parts` (folded, part-boundary suffix) — the
	 *  candidates a reference COULD mean. Exactly one = resolvable; several = ambiguous (the caller
	 *  diagnoses, naming them); none = unknown. Exact full-path hits return just that hit. */
	tableCandidates(parts: string[], dialect?: string): string[][] {
		return this.matches(parts, dialect).map((m) => m.parts);
	}

	private matches(parts: string[], dialect?: string): { parts: string[]; cols: Column[] }[] {
		const idx = this.indexFor(dialect);
		const fold = (p: string) => resolveBehavior(dialect).fold(p, "table");
		const fp = parts.map(fold);
		const exact = idx.byPath.get(fp.join("."));
		if (exact) return [{ parts: fp, cols: exact }];
		const last = idx.byLast.get(fp[fp.length - 1] ?? "") ?? [];
		return last.filter((c) => endsWithParts(c.parts, fp));
	}

	/** The bare names of every table in the catalog — the table-name candidate list for completion.
	 *  (Names are the folded last path part; a fully-qualified path resolves via columnsFor.) */
	tables(dialect?: string): string[] {
		return [...this.indexFor(dialect).byTable.keys()];
	}

	/** The immediate children of a namespace path (#38 stage 6): segment completion after a
	 *  qualifier dot. `prefixParts` are RAW (as typed); matching folds per level. Names return AS
	 *  DECLARED (display), each the NEXT SEGMENT only — a completion client replaces the token at
	 *  the caret, so a full path would double-insert. [] when the prefix names no namespace. */
	childrenOf(prefixParts: string[], dialect?: string): { name: string; kind: "namespace" | "table" }[] {
		const fold = (p: string) => resolveBehavior(dialect).fold(p, "table");
		let node: SchemaMapping = this.mapping;
		for (const raw of prefixParts) {
			const want = fold(raw);
			const next = Object.entries(node).find(([k, v]) => typeof v === "object" && !isLeaf(v) && fold(k) === want);
			if (!next) return [];
			node = next[1] as SchemaMapping;
		}
		const out: { name: string; kind: "namespace" | "table" }[] = [];
		for (const [name, child] of Object.entries(node)) {
			if (typeof child !== "object" || isLeaf(child)) continue; // a column leaf — prefix was a table
			const entries = Object.entries(child);
			const isTable = entries.length > 0 && entries.every(([, v]) => typeof v === "string" || isLeaf(v));
			out.push({ name, kind: isTable ? "table" : "namespace" });
		}
		return out;
	}

	private indexFor(dialect: string | undefined): DialectIndex {
		let idx = this.indexes.get(dialect);
		if (!idx) {
			idx = { byPath: new Map(), byTable: new Map(), byLast: new Map() };
			this.ingest(this.mapping, [], idx, dialect);
			this.indexes.set(dialect, idx);
		}
		return idx;
	}

	private ingest(node: SchemaMapping, path: string[], idx: DialectIndex, dialect: string | undefined): void {
		const entries = Object.entries(node);
		// A table node: every value is a column type (string) or a leaf object ({ type?, nullable }).
		const isTable = entries.length > 0 && entries.every(([, v]) => typeof v === "string" || isLeaf(v));
		if (isTable) {
			const cols: Column[] = entries.map(([name, leaf]) => toColumn(name, leaf as SchemaLeaf));
			const fold = (p: string) => resolveBehavior(dialect).fold(p, "table");
			const foldedPath = path.map(fold);
			idx.byPath.set(foldedPath.join("."), cols);
			const bare = foldedPath[foldedPath.length - 1] ?? "";
			if (!idx.byTable.has(bare)) idx.byTable.set(bare, cols);
			const bucket = idx.byLast.get(bare) ?? [];
			bucket.push({ parts: foldedPath, cols });
			idx.byLast.set(bare, bucket);
			return;
		}
		for (const [name, child] of entries) {
			if (typeof child === "object" && !isLeaf(child)) this.ingest(child, [...path, name], idx, dialect);
		}
	}
}

/** True for a leaf-object mapping value: a plain object with `nullable: boolean` PRESENT,
 *  optional `type: string`, and no other keys. Requiring the boolean is what keeps a table
 *  whose column happens to be named `type` (`{ t: { type: "varchar" } }`) classified as a
 *  table — a type-only object would be structurally ambiguous with that nesting, and says
 *  nothing a bare string doesn't. */
function isLeaf(v: unknown): v is { type?: string; nullable: boolean } {
	if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
	const rec = v as Record<string, unknown>;
	return (
		typeof rec.nullable === "boolean" &&
		Object.keys(rec).every((k) => k === "type" || k === "nullable") &&
		(rec.type === undefined || typeof rec.type === "string")
	);
}

function toColumn(name: string, leaf: SchemaLeaf): Column {
	if (typeof leaf === "string") return { name, type: leaf };
	const col: Column = { name, nullable: leaf.nullable };
	if (leaf.type !== undefined) col.type = leaf.type;
	return col;
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
