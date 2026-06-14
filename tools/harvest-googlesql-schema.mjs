// Harvest a schema (table -> {column: type}) from ZetaSQL's ANALYZER golden files, by reading the
// resolved ASTs rather than parsing Google's C++ SampleCatalog. The goldens state the catalog
// implicitly: `TableScan(column_list=[T.Col#id…], table=T)` names a table's columns, and
// `ColumnRef(type=Ty, column=T.Col#id)` gives a column's type. The per-query `#id` is unstable, so we
// key on the stable `Table.Column` name and aggregate across all goldens.
//
// Output: harness/local/googlesql-schema.json — a SchemaMapping ({ table: { col: type } }) that plugs
// straight into `new Schema(mapping)` (src/qualify/schema.ts). Tier 1: covers columns the queries
// actually reference (sufficient for positive resolution + type checks; NOT a complete catalog, so it
// can't authoritatively drive unknown-column negatives — that needs the C++ catalog subset later).
//
// Run: node tools/harvest-googlesql-schema.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { corpusPath } from "./corpus-paths.mjs";

const SRC = corpusPath("vendor/googlesql/googlesql/analyzer/testdata");
const OUT = corpusPath("harness/local/googlesql-schema.json");

if (!existsSync(SRC)) {
	console.error(`missing ${SRC} — sparse-clone google/googlesql analyzer/testdata first`);
	process.exit(1);
}

const TABLESCAN = /TableScan\(column_list=\[([^\]]*)\], table=([A-Za-z0-9_]+)/g;
// ColumnRef(type=<TYPE>[, type_annotation_map={…}], column=<prefix>.<col>#<n>[{…}]). The type capture
// stops before the optional `, type_annotation_map={…}` (collated columns); the annotation map AND the
// column's own trailing `{…}` collation tag are skipped so `#<n>)` matches. Without this, a collated
// ColumnRef either doesn't match (`#n{…})` ≠ `#n)`) or captures "STRING, type_annotation_map={…}" as
// the type — poisoning CollatedTable and order-dependent KeyValue.
const COLUMNREF =
	/ColumnRef\(type=(.*?)(?:, type_annotation_map=\{[^}]*\})?, column=([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)#\d+(?:\{[^}]*\})?\)/g;
const COLENTRY = /([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)#\d+/g; // inside a column_list
// Value-table pseudo-columns ZetaSQL surfaces in scans that are not real schema columns.
const PSEUDO_COLUMNS = new Set(["value", "Filename", "RowId"]);

const tables = new Set(); // real table names (from `table=`)
const schema = {}; // table -> { col: type | null }
const pending = []; // [prefix, col, type] from ColumnRefs; applied once the table set is known

function ensure(table, col) {
	if (PSEUDO_COLUMNS.has(col)) return; // skip value-table pseudo-columns
	schema[table] ??= {};
	if (!(col in schema[table])) schema[table][col] = null;
}

for (const file of readdirSync(SRC).filter((f) => f.endsWith(".test"))) {
	const text = readFileSync(join(SRC, file), "utf8");
	// 1) table names + their columns (names) from TableScans
	for (const m of text.matchAll(TABLESCAN)) {
		const [, colList, table] = m;
		tables.add(table);
		for (const c of colList.matchAll(COLENTRY)) {
			const [, prefix, col] = c;
			if (prefix === table) ensure(table, col);
		}
	}
	// 2) column types from ColumnRefs (filtered to real tables below). The regex already excludes the
	// annotation map, so `type` is the bare type.
	for (const m of text.matchAll(COLUMNREF)) {
		const [, type, prefix, col] = m;
		// defer: prefix may be a real table or a computed scope ($groupby…); resolve after pass
		pending.push([prefix, col, type.trim()]);
	}
}

// Apply types only where the prefix is a real table.
let typed = 0;
for (const [prefix, col, type] of pending) {
	if (!tables.has(prefix) || PSEUDO_COLUMNS.has(col)) continue;
	ensure(prefix, col);
	if (schema[prefix][col] == null) {
		schema[prefix][col] = type;
		typed++;
	}
}

// Normalize: drop nulls to a placeholder so the JSON is a valid SchemaMapping (all-string values).
const out = {};
let totalCols = 0;
let untyped = 0;
for (const [t, cols] of Object.entries(schema).sort()) {
	out[t] = {};
	for (const [c, ty] of Object.entries(cols).sort()) {
		out[t][c] = ty ?? "UNKNOWN";
		totalCols++;
		if (ty == null) untyped++;
	}
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(
	`harvested ${Object.keys(out).length} tables, ${totalCols} columns ` +
		`(${totalCols - untyped} typed, ${untyped} type-unknown) -> ${OUT}`,
);
