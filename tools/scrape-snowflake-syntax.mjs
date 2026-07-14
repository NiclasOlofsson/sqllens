// Scrape the Snowflake function-reference SYNTAX blocks (the `<placeholder>` metasyntax notation,
// e.g. `UPPER( <expr> )`) into snowflake/docs/syntax/, committed corpus data, unlike
// scrape-snowflake-docs.mjs's runnable-SQL examples. This tier is the offline source for the
// harvestSnowflake extractor in tools/harvest-signatures.mjs, which parses it into
// src/signature/generated/snowflake.ts (the example scraper only ever kept extracted example
// SQL, never the syntax notation).
//
// Pages are enumerated from the sitemap (no crawling), restricted to per-function pages
// (/en/sql-reference/functions/*). The `highlight-syntax` blocks are the metasyntax notation;
// `highlight-sql` (runnable examples) is deliberately not extracted here, that's the sibling
// script's job. Raw page HTML is cached in harness/local/snowflake-syntax-html/ (gitignored) so
// a re-run after an extraction-logic fix re-extracts offline instead of re-fetching. Resumable:
// pages recorded in manifest.json are skipped on rerun.
//
// Usage: node tools/scrape-snowflake-syntax.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { corpusPath } from "./corpus-paths.mjs";

const BASE = "https://docs.snowflake.com";
const OUT = corpusPath("snowflake/docs/syntax");
const HTML_CACHE = corpusPath("harness/local/snowflake-syntax-html");
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

// Every `highlight-syntax` block on a function page, the `<placeholder>` metasyntax notation
// Snowflake renders next to (not instead of) its runnable examples. A page can carry more than
// one block (e.g. a base form plus a windowed `OVER (...)` form).
function extractSyntax(html) {
	const blocks = [];
	for (const m of html.matchAll(/<div class="highlight-syntax[^"]*">[\s\S]*?<pre>([\s\S]*?)<\/pre>/g)) {
		const text = unescapeHtml(m[1].replace(/<[^>]+>/g, "")).trim();
		if (text) blocks.push(text);
	}
	return blocks;
}

// Read a cached copy of the page's HTML when we have one (no network call, no politeness delay
// needed); otherwise fetch it and cache it for next time. Returns html === null on a non-200.
async function fetchHtml(url, cachePath) {
	if (existsSync(cachePath)) {
		return { html: readFileSync(cachePath, "utf8"), status: 200 };
	}
	const res = await fetch(url);
	if (!res.ok) return { html: null, status: res.status };
	const html = await res.text();
	mkdirSync(dirname(cachePath), { recursive: true });
	writeFileSync(cachePath, html);
	return { html, status: res.status };
}

async function main() {
	mkdirSync(OUT, { recursive: true });
	mkdirSync(HTML_CACHE, { recursive: true });

	let manifest = {};
	try {
		manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
	} catch {}

	const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
	const urls = [...sitemap.matchAll(/<loc>(https:\/\/docs\.snowflake\.com\/en\/sql-reference\/[^<]+)<\/loc>/g)]
		.map((m) => m[1])
		.filter((u) => /\/sql-reference\/functions\//.test(u))
		// robots.txt disallows the commands-* nav-index pages; none match functions/ anyway, kept for parity.
		.filter((u) => !/\/sql-reference\/commands-/.test(u));

	const todo = urls.filter((u) => !(u in manifest));
	console.log(`${urls.length} function pages, ${todo.length} to fetch`);

	let fetched = 0;
	let files = 0;
	let failures = 0;

	async function worker(queue) {
		for (;;) {
			const url = queue.pop();
			if (!url) return;
			const slug = url.slice(`${BASE}/en/sql-reference/`.length).replace(/[^a-z0-9_/-]/gi, "_");
			const cachePath = join(HTML_CACHE, `${slug}.html`);
			try {
				const { html, status } = await fetchHtml(url, cachePath);
				if (!html) {
					manifest[url] = { status, blocks: 0 };
					failures++;
				} else {
					const blocks = extractSyntax(html);
					if (blocks.length) {
						const dir = join(OUT, slug);
						mkdirSync(dir, { recursive: true });
						blocks.forEach((text, i) => writeFileSync(join(dir, `${i + 1}.txt`), text + "\n"));
						files += blocks.length;
					}
					manifest[url] = { status, blocks: blocks.length };
				}
			} catch (e) {
				manifest[url] = { status: "error", error: String(e), blocks: 0 };
				failures++;
			}
			fetched++;
			if (fetched % 100 === 0) {
				writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
				console.log(`${fetched}/${todo.length} pages, ${files} syntax files, ${failures} failures`);
			}
			await new Promise((r) => setTimeout(r, 250)); // with fetch latency, ~3-5 req/s across 4 workers
		}
	}

	const queue = [...todo];
	await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
	writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
	console.log(`done: ${fetched} pages fetched, ${files} syntax files written, ${failures} failures`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
