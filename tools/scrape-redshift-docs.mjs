// Scrape SQL examples from the Amazon Redshift docs into harness/local/redshift-docs/.
//
// Pages are enumerated from the developer-guide table of contents (toc-contents.json — no
// crawling). Examples are the `<pre class="programlisting">` blocks in the server-rendered
// HTML; blocks containing an `<em>` placeholder are synopsis/metasyntax (e.g. SELECT
// <em>expression</em>) and are deliberately skipped, the same way the Snowflake scraper drops
// `highlight-syntax`. The corpus is docs-derived, so the output directory is gitignored (like
// the Oatly corpus); this script is the way to rebuild it. Resumable: pages recorded in
// manifest.json are skipped on rerun.
//
// Self-contained by design — it shares no code with the other dialects' scrapers so the
// Redshift work stays isolated. Usage: node tools/scrape-redshift-docs.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { corpusPath } from "./corpus-paths.mjs";

const BASE = "https://docs.aws.amazon.com/redshift/latest/dg";
const TOC = `${BASE}/toc-contents.json`;
const OUT = corpusPath("harness/local/redshift-docs");
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

// First words that can begin a Redshift statement — a block starting with anything else
// (a result-table header, an `ON …` clause) is not a parse-corpus statement. Derived from the
// Redshift SQL commands reference (DDL/DML/utility/transaction/session statements).
const STATEMENT_STARTERS =
	/^(abort|alter|analyze|attach|begin|call|cancel|close|comment|commit|copy|create|deallocate|declare|delete|desc|describe|detach|drop|end|execute|explain|fetch|grant|insert|lock|merge|prepare|reassign|refresh|reset|revoke|rollback|select|set|show|start|truncate|unload|update|vacuum|values|with)\b/i;

// A psql result-table border line — only dashes/pluses/equals/pipes/spaces, with a run of dashes.
// Redshift's psql output uses BOTH multi-column borders (`----+----`) and single-column pure-dash
// rules (`----------------`), so — unlike a +/|-requiring matcher — we accept dash-only borders. A
// SQL `--` comment is `-- text` (dashes then non-border text), so it is not an all-border line.
function isResultBorder(line) {
	return /^[\s\-+=|]+$/.test(line) && /-{3,}/.test(line);
}

// The psql column-header line sits directly above the border (` col1 | col2 ` or ` arrays_overlap `):
// identifiers/pipes/spaces only, no SQL punctuation and not a statement. Used to also drop that
// header when cutting at a border (otherwise a single leaked header line reads as trailing input).
function isHeaderish(line) {
	const t = line.trim();
	return (
		t !== "" &&
		!/[(),;'"*]/.test(line) &&
		!STATEMENT_STARTERS.test(t) &&
		!/^(from|where|group|order|having|union|join|on|and|or|limit|offset|select)\b/i.test(t)
	);
}

// A psql table row/header with no dash border in the scraped HTML: cells joined by `|`, made of
// only word/space/pipe/punctuation-of-data chars — no SQL punctuation (parens/quotes/comma/=/*).
// `'a' || 'b'` has quotes; `a|b` bitwise-or is unspaced and rare in these examples — both excluded.
function isTabular(line) {
	const t = line.trim();
	return /\|/.test(t) && /^[\w\s|.:%/+-]+$/.test(t) && !STATEMENT_STARTERS.test(t);
}

// A leaked English prose line the docs put between the statement and its result, or the psql
// `(N rows)` row-count / `Time:` footers.
const PROSE_LINE = /^\s*(The |This |These |Note:|For example|Here |Output:|Returns? |Result:|Where:)/;
const ROWS_FOOTER = /^\s*\(\d+ rows?\)\s*$/;
const TIMING_FOOTER = /^\s*Time: [\d.]+ ms/;

export function cleanSql(sql) {
	// Docs HTML renders spacing with non-breaking spaces (U+00A0); SQL has none, so the lexer
	// would reject them. Normalize to a plain space.
	sql = sql.replace(/ /g, " ");
	const lines = sql.split("\n");
	// Find where rendered output begins under the SQL. Two signals, whichever comes first:
	//  (a) a result marker — a table border, a `(N rows)` / `Time:` footer, a tabular `a | b` row,
	//      or a leaked prose line; and
	//  (b) a statement terminator (`;`) whose next non-blank line is not itself a SQL statement
	//      (nor a comment) — i.e. psql output that has no dash border in the scraped HTML (a bare
	//      result value, or a `col | col` header). Multi-statement examples are safe: the next line
	//      there DOES start with a statement keyword, so (b) does not fire.
	let cut = -1;
	for (let i = 0; i < lines.length; i++) {
		const l = lines[i];
		// EXPLAIN query-plan output: Redshift/Postgres plan nodes carry the unmistakable
		// "(cost=N..N rows=N …)" annotation. Cut at the plan and also drop a bare introducing
		// EXPLAIN line (and any blanks) so no dangling statement is left behind.
		if (i > 0 && /\(cost=[\d.]+\.\.[\d.]+\s+rows=/.test(l)) {
			let j = i;
			while (j > 0 && lines[j - 1].trim() === "") j--;
			if (j > 0 && /^\s*explain\b/i.test(lines[j - 1])) j--;
			cut = j;
			break;
		}
		if (
			i > 0 &&
			(isResultBorder(l) || ROWS_FOOTER.test(l) || TIMING_FOOTER.test(l) || PROSE_LINE.test(l) || isTabular(l))
		) {
			// psql prints the column header directly above a border — drop it too.
			cut = isResultBorder(l) && i > 1 && isHeaderish(lines[i - 1]) ? i - 1 : i;
			break;
		}
		if (/;\s*$/.test(l)) {
			const next = lines.slice(i + 1).find((x) => x.trim() !== "");
			if (next !== undefined && !STATEMENT_STARTERS.test(next.trim()) && !/^\s*(--|\/\*)/.test(next)) {
				cut = i + 1;
				break;
			}
		}
	}
	const kept = (cut === -1 ? lines : lines.slice(0, cut)).join("\n").trim();
	if (kept === "") return null;
	if (/^[[{]/.test(kept)) return null; // JSON output block
	if (/(^|[\s(,])\.\.\.([\s),;]|$)/.test(kept)) return null; // ellipsis placeholder
	if (/<[a-z_][a-z0-9_]*>/i.test(kept)) return null; // single-word <placeholder> template
	// A spaced metasyntax placeholder ("… * <Price for 1 RPU> …"). Narrow on purpose: the '<' must be
	// preceded by neither a word char (so nested types array<float >, map<…> are NOT matched) nor a
	// quote (so '<IAM role arn>' inside a string literal is NOT matched — that SQL is valid).
	if (/(^|[^\w'"`])<[a-z_][a-z0-9_]* [^>]*>/i.test(kept)) return null;
	// A '('-leading block is a real statement only when it opens a parenthesized query
	// ((SELECT …) UNION …). A bare '(' on prose math ("(200 GB * 50%) / 4 slots"), an expression
	// list ("(1, 5, 10)"), or an UNLOAD arg-string ("('select …')") is not a SQL statement.
	if (!/^\(+\s*(select|with|values|table)\b/i.test(kept) && !STATEMENT_STARTERS.test(kept)) return null;
	return kept;
}

export function extractSql(html) {
	const blocks = [];
	for (const m of html.matchAll(/<pre class="programlisting">([\s\S]*?)<\/pre>/g)) {
		let inner = m[1]
			.replace(/<div class="code-btn-container">[\s\S]*?<\/div>\s*<\/div>/g, "") // copy button
			.replace(/<!--[\s\S]*?-->/g, ""); // <!--DEBUG: cli ()--> markers
		if (/<em[ >]/.test(inner)) continue; // synopsis/metasyntax block — has placeholders
		const sql = cleanSql(unescapeHtml(inner.replace(/<[^>]+>/g, "")));
		if (sql) blocks.push(sql);
	}
	return blocks;
}

// Walk the nested {title, href, contents[]} tree, collecting every same-guide .html page.
function collectHrefs(node, acc) {
	if (Array.isArray(node)) {
		for (const n of node) collectHrefs(n, acc);
		return acc;
	}
	if (node && typeof node === "object") {
		if (typeof node.href === "string" && /^[\w.-]+\.html$/.test(node.href)) acc.add(node.href);
		if (node.contents) collectHrefs(node.contents, acc);
	}
	return acc;
}

async function main() {
	mkdirSync(OUT, { recursive: true });

	let manifest = {};
	try {
		manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
	} catch {}

	const toc = await (await fetch(TOC)).json();
	const pages = [...collectHrefs(toc.contents, new Set())];
	const todo = pages.filter((p) => !(p in manifest));
	console.log(`${pages.length} guide pages, ${todo.length} to fetch`);

	let fetched = 0;
	let files = 0;
	let failures = 0;

	async function worker(queue) {
		for (;;) {
			const page = queue.pop();
			if (!page) return;
			const slug = page.replace(/\.html$/, "").replace(/[^a-z0-9_-]/gi, "_");
			try {
				const res = await fetch(`${BASE}/${page}`);
				if (!res.ok) {
					manifest[page] = { status: res.status, blocks: 0 };
					failures++;
				} else {
					const blocks = extractSql(await res.text());
					if (blocks.length) {
						const dir = join(OUT, slug);
						mkdirSync(dir, { recursive: true });
						blocks.forEach((sql, i) => writeFileSync(join(dir, `${i + 1}.sql`), sql + "\n"));
						files += blocks.length;
					}
					manifest[page] = { status: 200, blocks: blocks.length };
				}
			} catch (e) {
				manifest[page] = { status: "error", error: String(e), blocks: 0 };
				failures++;
			}
			fetched++;
			if (fetched % 100 === 0) {
				writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
				console.log(`${fetched}/${todo.length} pages, ${files} sql files, ${failures} failures`);
			}
			await new Promise((r) => setTimeout(r, 250));
		}
	}

	const queue = [...todo];
	await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
	writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
	console.log(`done: ${fetched} pages fetched, ${files} sql files written, ${failures} failures`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
