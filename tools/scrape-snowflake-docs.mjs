// Scrape SQL examples from the Snowflake reference docs into harness/local/snowflake-docs/.
//
// Pages are enumerated from the sitemap (no crawling); examples are the `highlight-sql`
// code blocks in the static HTML — `highlight-output` (result tables) and `highlight-syntax`
// (metasyntax notation) are deliberately not extracted. The corpus is docs-derived and
// proprietary, so the output directory is gitignored (like the Oatly corpus); this script
// is the way to rebuild it. Resumable: pages recorded in manifest.json are skipped on rerun.
//
// Usage: node tools/scrape-snowflake-docs.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { corpusPath } from "./corpus-paths.mjs";

const BASE = "https://docs.snowflake.com";
const OUT = corpusPath("harness/local/snowflake-docs");
const MANIFEST = join(OUT, "manifest.json");
const CONCURRENCY = 4;

function unescapeHtml(s) {
	return s
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&");
}

// Docs code blocks mix SQL with non-SQL: ASCII result tables pasted after the statement,
// `...` ellipsis fragments, and JSON output mislabeled as highlight-sql. Cleaned here so
// the corpus stays a parse corpus.
// First words that can begin a Snowflake statement — a block starting with anything else
// (ON …, PACKAGES = …, WHEN …) is a clause fragment, not a parse-corpus statement.
const STATEMENT_STARTERS =
	/^(alter|begin|call|comment|commit|copy|create|declare|delete|desc|describe|drop|execute|explain|get|grant|insert|list|ls|merge|put|remove|revoke|rollback|select|set|show|start|truncate|undrop|unset|update|use|with|!)\b/i;

// A result-table border line — only dashes/pluses/equals/pipes/spaces, with a run of dashes
// and at least one column separator (+ or |). Snowflake renders tables both `+---+` (plus-led)
// and `---+---+` (dash-led); requiring a +/| separator avoids cutting at a `-- ───` comment.
function isResultBorder(line) {
	return /^[\s\-+=|]+$/.test(line) && /-{3,}/.test(line) && /[+|]/.test(line);
}

// A leaked Snowflake error message under the statement, e.g. "100051 (22012): Division by zero".
const ERROR_LINE = /^\s*\d{4,} \([0-9A-Z]+\):/;
// A leaked English prose line that docs put between the statement and its result.
const PROSE_LINE = /^\s*(The |This |These |Note:|For example|Here |Output:|Returns? |Result:|Where:)/;

export function cleanSql(sql) {
	// Docs HTML renders indentation/spacing with non-breaking spaces (&nbsp; → U+00A0);
	// SQL has no such whitespace, so the lexer rejects it. Normalize to a plain space.
	sql = sql.replace(/ /g, " ");
	const lines = sql.split("\n");
	// Cut at the first result-table border, leaked error message, or prose line (output under the SQL).
	let cut = lines.findIndex((l, i) => i > 0 && (isResultBorder(l) || ERROR_LINE.test(l) || PROSE_LINE.test(l)));
	const kept = (cut === -1 ? lines : lines.slice(0, cut)).join("\n").trim();
	if (kept === "") return null;
	if (/^[[{]/.test(kept)) return null; // JSON output block
	if (/(^|[\s(,])\.\.\.([\s),;]|$)/.test(kept)) return null; // ellipsis placeholder anywhere
	if (/<[a-z_][a-z0-9_]*>/i.test(kept)) return null; // <placeholder> template, not real SQL
	if (/^\(\s*(?!select|with|\()/i.test(kept)) return null; // call-argument fragment, e.g. (mytable.*)
	if (!/^\(/.test(kept) && !STATEMENT_STARTERS.test(kept)) return null; // clause fragment
	if (/`/.test(kept)) return null; // backtick-wrapped content — a markdown artifact (Snowflake has no backtick syntax)
	return kept;
}

function extractSql(html) {
	const blocks = [];
	for (const m of html.matchAll(/<div class="highlight-sql[^"]*">[\s\S]*?<pre>([\s\S]*?)<\/pre>/g)) {
		const sql = cleanSql(unescapeHtml(m[1].replace(/<[^>]+>/g, "")));
		if (sql) blocks.push(sql);
	}
	return blocks;
}

async function main() {
	mkdirSync(OUT, { recursive: true });

	let manifest = {};
	try {
		manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
	} catch {}

	const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
	const urls = [...sitemap.matchAll(/<loc>(https:\/\/docs\.snowflake\.com\/en\/sql-reference\/[^<]+)<\/loc>/g)]
		.map((m) => m[1])
		// robots.txt disallows the commands-* nav-index pages; they hold no examples anyway.
		.filter((u) => !/\/sql-reference\/commands-/.test(u));

	const todo = urls.filter((u) => !(u in manifest));
	console.log(`${urls.length} sql-reference pages, ${todo.length} to fetch`);

	let fetched = 0;
	let files = 0;
	let failures = 0;

	async function worker(queue) {
		for (;;) {
			const url = queue.pop();
			if (!url) return;
			const slug = url.slice(`${BASE}/en/sql-reference/`.length).replace(/[^a-z0-9_/-]/gi, "_");
			try {
				const res = await fetch(url);
				if (!res.ok) {
					manifest[url] = { status: res.status, blocks: 0 };
					failures++;
				} else {
					const blocks = extractSql(await res.text());
					if (blocks.length) {
						const dir = join(OUT, slug);
						mkdirSync(dir, { recursive: true });
						blocks.forEach((sql, i) => writeFileSync(join(dir, `${i + 1}.sql`), sql + "\n"));
						files += blocks.length;
					}
					manifest[url] = { status: 200, blocks: blocks.length };
				}
			} catch (e) {
				manifest[url] = { status: "error", error: String(e), blocks: 0 };
				failures++;
			}
			fetched++;
			if (fetched % 100 === 0) {
				writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
				console.log(`${fetched}/${todo.length} pages, ${files} sql files, ${failures} failures`);
			}
			await new Promise((r) => setTimeout(r, 250)); // with fetch latency, ~3-5 req/s across 4 workers
		}
	}

	const queue = [...todo];
	await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
	writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
	console.log(`done: ${fetched} pages fetched, ${files} sql files written, ${failures} failures`);
}

// Run only when invoked directly — tools/clean-snowflake-docs.mjs imports cleanSql from here.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
