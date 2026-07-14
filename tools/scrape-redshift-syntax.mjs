// Scrape the "Syntax" code block(s) off each Amazon Redshift SQL-function-reference page into
// redshift/docs/syntax/. Pages are enumerated from the developer-guide table of contents
// (toc-contents.json — no crawling), the same source tools/scrape-redshift-docs.mjs reads, but
// scoped to the "SQL reference" > "SQL functions reference" subtree (~400 pages) rather than the
// whole guide, since that subtree is exactly the function pages this tier wants.
//
// Observed markup (verified against live pages 2026-07-14: DATEADD, DATEDIFF, UPPER, NVL, LISTAGG,
// TO_CHAR, SUBSTRING, JSON_EXTRACT_PATH_TEXT, ARRAY, TRIM, EXTRACT, DATE_PART, FNV_HASH,
// HLL_CREATE_SKETCH, SPLIT_PART, ST_AsBinary, RANK, CURRENT_SCHEMAS): the Syntax heading is a plain
// `<h2 id="...-synopsis">Syntax</h2>` (the id prefix varies per page, unlike Databricks' fixed
// `id=syntax`, so the heading is matched on its literal text, not its id). One or more
// `<pre class="programlisting">...<code ...>SIGNATURE</code></pre>` blocks follow, ending at the
// next `<h2>` (normally "Arguments"/"Argument"). Placeholders are wrapped in `<em>` with no other
// distinguishing markup, so stripping all tags and unescaping entities (the same small helpers
// scrape-redshift-docs.mjs uses for its own `<pre class="programlisting">` blocks) reconstructs the
// exact doc-notation text, e.g. `DATEADD( datepart, interval, {date|time|timetz|timestamp} )` or
// `ARRAY( [ expr1 ] [, expr2 [, ... ]] )`. A page can carry several blocks (SUBSTRING has three
// overload forms, one FROM/FOR-keyword form and two flat forms; NVL's block is followed by a second
// block documenting COALESCE under the same heading) — each `<pre>` is one file, matching the
// Databricks syntax scraper's one-block-one-file convention.
//
// Resumable via manifest.json; a page with no Syntax heading (the ~20 category-landing pages in
// the subtree, e.g. c_SQL_functions.html) is recorded with blocks:0 (no directory written) rather
// than treated as a failure. Raw page HTML is cached under HTML_CACHE; a re-run re-extracts offline
// from the cache (only genuinely-new pages fetch).
//
// Self-contained by design — shares no code with the other scrapers (repo convention).
// Usage: node tools/scrape-redshift-syntax.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { corpusPath } from "./corpus-paths.mjs";

const BASE = "https://docs.aws.amazon.com/redshift/latest/dg";
const TOC = `${BASE}/toc-contents.json`;
const OUT = corpusPath("redshift/docs/syntax");
const HTML_CACHE = corpusPath("harness/local/redshift-syntax-html");
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

/** Walk the nested {title, href, contents[]} tree, collecting every same-guide .html page. */
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

/** Extract the Syntax section's code block(s) from one function-reference page: the HTML between
 *  the "Syntax" heading and the next `<h2>`, then every `<pre class="programlisting">` within it,
 *  tags stripped and entities unescaped. */
export function extractSyntaxBlocks(html) {
	const headingMatch = html.match(/<h2[^>]*>Syntax<\/h2>/);
	if (!headingMatch) return [];
	const start = headingMatch.index + headingMatch[0].length;
	const nextH2 = html.indexOf("<h2", start);
	const section = html.slice(start, nextH2 === -1 ? start + 20000 : nextH2);

	const blocks = [];
	for (const m of section.matchAll(/<pre class="programlisting">([\s\S]*?)<\/pre>/g)) {
		const inner = m[1]
			.replace(/<div class="code-btn-container">[\s\S]*?<\/div>\s*<\/div>/g, "") // copy button
			.replace(/<!--[\s\S]*?-->/g, ""); // <!--DEBUG: cli ()--> markers
		const text = unescapeHtml(inner.replace(/<[^>]+>/g, "")).trim();
		if (text !== "") blocks.push(text);
	}
	return blocks;
}

/** Cache filename for a page href — hrefs in this guide are already flat `<name>.html`. */
function htmlKey(href) {
	return href;
}

async function main() {
	mkdirSync(OUT, { recursive: true });
	let manifest = {};
	try {
		manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
	} catch {}

	mkdirSync(HTML_CACHE, { recursive: true });
	const toc = await (await fetch(TOC)).json();
	const sqlRef = toc.contents.find((n) => n.title === "SQL reference");
	const funcRef = sqlRef?.contents?.find((n) => n.title === "SQL functions reference");
	if (!funcRef) throw new Error('TOC shape changed: "SQL reference" > "SQL functions reference" not found');
	const pages = [...collectHrefs(funcRef, new Set())];

	const toFetch = pages.filter((p) => !existsSync(join(HTML_CACHE, htmlKey(p)))).length;
	console.log(`${pages.length} function-reference pages, ${toFetch} to fetch (rest from HTML cache)`);

	let processed = 0;
	let fetched = 0;
	let files = 0;
	let withSyntax = 0;
	let failures = 0;

	async function worker(queue) {
		for (;;) {
			const page = queue.pop();
			if (!page) return;
			const slug = page.replace(/\.html$/, "").replace(/[^a-z0-9_-]/gi, "_");
			try {
				const cacheFile = join(HTML_CACHE, htmlKey(page));
				let html;
				if (existsSync(cacheFile)) {
					html = readFileSync(cacheFile, "utf8"); // offline re-extract
				} else {
					const res = await fetch(`${BASE}/${page}`);
					if (!res.ok) {
						manifest[page] = { status: res.status, blocks: 0 };
						failures++;
						processed++;
						continue;
					}
					html = await res.text();
					writeFileSync(cacheFile, html);
					fetched++;
					await new Promise((r) => setTimeout(r, 250)); // be polite only when fetching
				}
				const blocks = extractSyntaxBlocks(html);
				if (blocks.length) {
					const dir = join(OUT, slug);
					mkdirSync(dir, { recursive: true });
					blocks.forEach((text, i) => writeFileSync(join(dir, `${i + 1}.txt`), text + "\n"));
					files += blocks.length;
					withSyntax++;
				}
				manifest[page] = { status: 200, blocks: blocks.length };
			} catch (e) {
				manifest[page] = { status: "error", error: String(e), blocks: 0 };
				failures++;
			}
			processed++;
			if (processed % 100 === 0) {
				writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
				console.log(
					`${processed}/${pages.length} pages, ${withSyntax} with syntax, ${files} blocks written, ${fetched} fetched, ${failures} failures`,
				);
			}
		}
	}

	const todo = pages.filter((p) => !(p in manifest));
	console.log(`${todo.length} pages not yet in manifest`);
	const queue = [...todo];
	await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
	writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
	console.log(
		`done: ${processed} pages, ${withSyntax} with syntax, ${files} blocks written, ${fetched} fetched, ${failures} failures`,
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
