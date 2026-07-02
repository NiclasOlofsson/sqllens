// Extract SQL examples from the duckdb-web docs (docs/current/**/*.md, MIT) into the corpus repo.
//
// Examples are the ```sql fenced blocks; DuckDB's docs keep rendered output outside the fence
// (markdown tables / separate ```text blocks), so no psql-output stripping is needed. Blocks with
// ⟨angle⟩ placeholders (the docs' metasyntax convention) or CLI dot-commands are skipped.
//
// Self-contained by design (repo convention). Usage: node extract-duckdb-docs.mjs <duckdb-web-dir>

import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { corpusPath } from "./corpus-paths.mjs";
import { pathToFileURL } from "node:url";

const SRC = join(process.argv[2] ?? "duckdb-web", "docs", "current");
const OUT = corpusPath("duckdb/docs");

// First words that can begin a DuckDB statement — includes the DuckDB-only FROM-first queries,
// PIVOT/UNPIVOT/SUMMARIZE/DESCRIBE statements, and ATTACH/INSTALL/LOAD/PRAGMA utilities.
// Derived from https://duckdb.org/docs/current/sql/statements (the statement list).
const STATEMENT_STARTERS =
	/^(abort|alter|analyze|attach|begin|call|checkpoint|comment|commit|copy|create|deallocate|delete|desc|describe|detach|drop|execute|explain|export|force|from|grant|import|insert|install|load|merge|pivot|pragma|prepare|reset|revoke|rollback|select|set|show|summarize|table|truncate|unpivot|update|use|vacuum|values|with)\b/i;

function* mdFiles(dir) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* mdFiles(p);
		else if (e.name.endsWith(".md")) yield p;
	}
}

export function cleanSql(sql) {
	// Some fences carry the rendered result under the statement — cut at the first box-drawing
	// line, or at a `----` sqllogictest-style separator line.
	const lines = sql.split("\n");
	const cut = lines.findIndex((l) => /^[\s]*[┌│├└─┬┴┼┐┤┘]/.test(l) || /^----+\s*$/.test(l));
	const kept = (cut === -1 ? lines : lines.slice(0, cut)).join("\n").trim();
	if (kept === "") return null;
	if (/[⟨⟩]/.test(kept)) return null; // docs metasyntax placeholder ⟨like this⟩
	if (/(^|[\s(,])\.\.\.([\s),;]|$)/.test(kept)) return null; // ellipsis placeholder
	if (/<[a-z_][a-z0-9_]*( [^>]*)?>/i.test(kept)) return null; // <placeholder> template
	if (/\[[a-z]+([ -][a-z()-]+)+\]/i.test(kept)) return null; // [multi-word-placeholder] template
	if (/^\./.test(kept)) return null; // duckdb CLI dot-command block
	if (/^[a-z_][\w]*(=[>#]|-[>#])\s/.test(kept)) return null; // shell/psql transcript
	// A truncated illustration (the CLI-autocompletion demos end mid-string): odd count of
	// single quotes = an unterminated string literal — not a parse-corpus statement.
	if ((kept.match(/'/g) ?? []).length % 2 === 1) return null;
	if (!/^\(+\s*(select|with|values|from|table)\b/i.test(kept) && !STATEMENT_STARTERS.test(kept)) return null;
	return kept;
}

export function extractSql(md) {
	const blocks = [];
	for (const m of md.matchAll(/```sql\r?\n([\s\S]*?)```/g)) {
		const sql = cleanSql(m[1]);
		if (sql) blocks.push(sql);
	}
	return blocks;
}

async function main() {
	if (existsSync(OUT)) rmSync(OUT, { recursive: true });
	mkdirSync(OUT, { recursive: true });
	let files = 0;
	let pages = 0;
	const manifest = {};
	for (const f of mdFiles(SRC)) {
		const rel = relative(SRC, f).split("\\").join("/");
		// SQL/PGQ property-graph queries are the duckpgq COMMUNITY extension's surface, not core
		// DuckDB — out of this dialect's scope (the guide page is the only place it appears).
		if (rel === "guides/sql_features/graph_queries.md") continue;
		const slug = rel.replace(/\.md$/, "").replace(/[^a-z0-9_-]/gi, "_");
		const blocks = extractSql(readFileSync(f, "utf8"));
		manifest[rel] = { blocks: blocks.length };
		if (blocks.length) {
			const dir = join(OUT, slug);
			mkdirSync(dir, { recursive: true });
			blocks.forEach((sql, i) => writeFileSync(join(dir, `${i + 1}.sql`), sql + "\n"));
			files += blocks.length;
			pages++;
		}
	}
	writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
	console.log(`done: ${pages} pages with SQL, ${files} sql files written`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
