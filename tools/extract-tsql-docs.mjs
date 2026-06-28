// Extract SQL examples from the Microsoft T-SQL reference (MicrosoftDocs/sql-docs) into
// harness/local/tsql-docs/. The docs are markdown; we take the ```sql fenced blocks
// (runnable examples) and skip ```syntaxsql (metasyntax notation with [ ] placeholders)
// and ```output (result tables). The corpus is docs-derived, so the output directory is
// gitignored (like the Oatly + Snowflake corpora); this script rebuilds it.
//
// Prereq: a sparse checkout of docs/t-sql from MicrosoftDocs/sql-docs in the corpus repo
// ($SQL_CORPUS_DIR, see .env), at vendor/sql-docs:
//   cd "$SQL_CORPUS_DIR/vendor" && git clone --no-checkout --depth 1 --filter=blob:none \
//       https://github.com/MicrosoftDocs/sql-docs.git
//   cd sql-docs && git sparse-checkout init --cone && git sparse-checkout set docs/t-sql && git checkout
//
// Usage: node tools/extract-tsql-docs.mjs

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { corpusPath } from "./corpus-paths.mjs";

const SRC = corpusPath("vendor/sql-docs/docs/t-sql");
const OUT = corpusPath("harness/local/tsql-docs");

// First words that can begin a T-SQL statement (or batch). A block starting with anything
// else (a bare expression, a column list, a WHEN/ON clause) is a fragment, not a statement.
const STATEMENT_STARTERS =
	/^(add|alter|backup|begin|break|bulk|close|commit|continue|create|deallocate|declare|delete|deny|disable|drop|else|enable|end|exec|execute|fetch|goto|grant|if|insert|kill|merge|open|print|raiserror|reconfigure|restore|return|revert|revoke|rollback|save|select|set|setuser|throw|truncate|try|update|use|waitfor|while|with|go|;with)\b/i;

// Lines that mark the start of pasted result/output, not SQL.
const RESULT_LINE = /^\s*(\(\d+\s+rows?\s+affected\)|-{3,}\s*$|={3,}\s*$|\| .* \||[A-Za-z_ ]+\s+-{3,})/;

export function cleanSql(raw) {
	let lines = raw.replace(/\r/g, "").split("\n");
	// Cut at the first result/output marker (docs often paste the result under the query).
	const cut = lines.findIndex((l) => RESULT_LINE.test(l));
	if (cut !== -1) lines = lines.slice(0, cut);
	const kept = lines.join("\n").trim();
	if (kept === "") return null;
	if (/<[a-z_][a-z0-9_]*>/i.test(kept)) return null; // <placeholder> template
	if (/\[[ \t]*\.\.\.[ \t]*\]/.test(kept)) return null; // [ ... ] metasyntax
	if (/(^|[\s(,])\.\.\.([\s),;]|$)/.test(kept)) return null; // ellipsis placeholder
	if (!STATEMENT_STARTERS.test(kept)) return null; // fragment
	return kept;
}

/** Extract the ```sql / ```SQL fenced blocks (not ```syntaxsql) from a markdown string. */
export function extractSqlBlocks(md) {
	const blocks = [];
	// Markdown allows up to 3 spaces of fence indentation; the docs use it inconsistently
	// (a leading space on the closing ``` is common and otherwise leaks into the SQL).
	const fence = /^ {0,3}```(\w+)?[ \t]*$/;
	const lines = md.replace(/\r/g, "").split("\n");
	let lang = null;
	let buf = [];
	for (const line of lines) {
		const m = line.match(fence);
		if (m && lang === null) {
			lang = (m[1] ?? "").toLowerCase();
			buf = [];
		} else if (m && lang !== null) {
			if (lang === "sql") {
				const cleaned = cleanSql(buf.join("\n"));
				if (cleaned) blocks.push(cleaned);
			}
			lang = null;
		} else if (lang !== null) {
			buf.push(line);
		}
	}
	return blocks;
}

function* mdFiles(dir) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* mdFiles(p);
		else if (e.name.endsWith(".md")) yield p;
	}
}

function main() {
	mkdirSync(OUT, { recursive: true });
	let files = 0;
	let written = 0;
	for (const md of mdFiles(SRC)) {
		const blocks = extractSqlBlocks(readFileSync(md, "utf8"));
		if (!blocks.length) continue;
		files++;
		const slug = md
			.slice(SRC.length + 1)
			.replace(/\.md$/, "")
			.replace(/[^a-z0-9_/-]/gi, "_");
		const dir = join(OUT, slug);
		mkdirSync(dir, { recursive: true });
		blocks.forEach((sql, i) => writeFileSync(join(dir, `${i + 1}.sql`), sql + "\n"));
		written += blocks.length;
	}
	console.log(`extracted ${written} sql examples from ${files} docs -> ${OUT}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
