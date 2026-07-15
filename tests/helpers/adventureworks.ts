import { readFileSync } from "node:fs";
import type { SchemaMapping } from "../../src/qualify/schema.js";

// ---------------------------------------------------------------------------
// AdventureWorks ingestion (TEST INFRASTRUCTURE, not shipped library code).
// Microsoft's AdventureWorks OLTP install script (vendor/adventureworks/instawdb.sql,
// a gitignored download) is the one corpus that gives us *schema + real queries
// together*: 71 CREATE TABLE statements -> a catalog our `Schema` resolves against,
// and 20 CREATE VIEW statements -> real multi-join T-SQL SELECTs to run the semantic
// layer over. The script is SQLCMD-flavoured (:setvar, GO, BULK INSERT), so we don't
// feed the whole file to the parser — we slice out the CREATE TABLE / CREATE VIEW
// statements textually and parse only the view SELECT bodies (our deliverable). The
// table extraction is regex-based and good enough for a test catalog: it recovers
// column *names* reliably (what qualify needs) and best-effort *types* (computed
// columns and a few UDTs degrade to a placeholder — noted, not hidden).
// ---------------------------------------------------------------------------

export interface ViewDef {
	/** "Schema.viewName", as referenced. */
	name: string;
	/** The SELECT body (everything after the view's `AS`). */
	body: string;
}

export interface AdventureWorks {
	schema: SchemaMapping;
	views: ViewDef[];
	tableCount: number;
}

export function parseAdventureWorks(path: string): AdventureWorks {
	const sql = readFileSync(path, "utf8");
	const schema: SchemaMapping = {};
	const views: ViewDef[] = [];
	let tableCount = 0;

	for (const batch of sql.split(/^\s*GO\s*$/im)) {
		// A batch may hold SEVERAL `;`-separated CREATE TABLE statements (Person's
		// BusinessEntityAddress + BusinessEntityContact share one GO) — extract all of them.
		const tables = matchCreateTables(batch);
		if (tables.length > 0) {
			for (const table of tables) {
				addTable(schema, table.schema, table.table, table.columns);
				tableCount++;
			}
			continue;
		}
		const view = matchCreateView(batch);
		if (view) views.push(view);
	}
	return { schema, views, tableCount };
}

interface TableDef {
	schema: string;
	table: string;
	columns: { name: string; type: string }[];
}

function matchCreateTables(rawBatch: string): TableDef[] {
	// Strip `--` line and `/* */` block comments first: AdventureWorks documents columns inline
	// (`[StoreID] [int] NULL,  -- if the customer is a store…`) and those comments contain commas,
	// which would otherwise split mid-column and drop the columns after them.
	const batch = stripComments(rawBatch);
	// CREATE TABLE [schema].[Table]( <body> ) ON [PRIMARY];  — the body runs LAZILY up to the
	// `) ON [` filegroup terminator every AW table carries (a nested `DEFAULT (NEWID())` never
	// precedes `ON [`), so several tables in one batch each match (/g), instead of the old
	// greedy first-match that swallowed a batch's second table into the first's body.
	const out: TableDef[] = [];
	const re = /CREATE TABLE \[(\w+)\]\.\[([\w ]+)\]\s*\(([\s\S]*?)\)\s*ON\s*\[/gi;
	for (const m of batch.matchAll(re)) {
		const columns: { name: string; type: string }[] = [];
		for (const part of splitTopLevelCommas(m[3]!)) {
			const col = /^\s*\[([\w ]+)\]\s+(\[?\w+\]?)/.exec(part);
			if (!col) continue; // a table constraint (CONSTRAINT/PRIMARY KEY/…) — not a column
			const type = stripBrackets(col[2]!);
			columns.push({ name: col[1]!, type: type.toLowerCase() === "as" ? "unknown" : type });
		}
		out.push({ schema: m[1]!, table: m[2]!, columns });
	}
	return out;
}

function matchCreateView(batch: string): ViewDef | undefined {
	// CREATE VIEW [schema].[name] [options] AS <body>. The first `AS` after the (bracketed) name
	// is the view's AS; column aliases inside the body come later, so a non-greedy skip to the
	// first AS is safe.
	const m = /CREATE VIEW \[(\w+)\]\.\[([\w ]+)\][\s\S]*?\bAS\b([\s\S]*)$/i.exec(batch);
	if (!m) return undefined;
	const body = m[3].replace(/;\s*$/, "").trim();
	return { name: `${m[1]}.${m[2]}`, body };
}

function addTable(
	schema: SchemaMapping,
	schemaName: string,
	table: string,
	columns: { name: string; type: string }[],
): void {
	const ns = (schema[schemaName] ??= {}) as SchemaMapping;
	const cols: SchemaMapping = {};
	for (const c of columns) cols[c.name] = c.type;
	ns[table] = cols;
}

/** Split on commas at paren-depth 0 (so `IDENTITY (1, 1)` / `DEFAULT (NEWID())` stay intact). */
function splitTopLevelCommas(s: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (ch === "(") depth++;
		else if (ch === ")") depth--;
		else if (ch === "," && depth === 0) {
			out.push(s.slice(start, i));
			start = i + 1;
		}
	}
	out.push(s.slice(start));
	return out;
}

function stripBrackets(s: string): string {
	return s.startsWith("[") && s.endsWith("]") ? s.slice(1, -1) : s;
}

/** Remove line and block SQL comments (their embedded commas break column splitting). */
function stripComments(s: string): string {
	return s.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}
