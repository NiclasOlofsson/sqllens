// Scrape the "Syntax" code block(s) off each Databricks SQL function-reference page into
// databricks/docs/syntax/. Pages are enumerated from the sitemap (no crawling), same as
// tools/scrape-databricks-docs.mjs; this script targets a narrower page set
// (/sql/language-manual/functions/<name>) and a narrower section of each page (only the
// "Syntax" heading's code block(s), not the worked examples).
//
// Observed markup (verified against the live site 2026-07-14): the Syntax heading is an
// `<h2 ... id=syntax>Syntax<a ...>...</a></h2>`; one or more Prism code blocks follow it,
// each `<pre class="prism-code language-text ...">`: note "language-text", NOT
// "language-sql" (that class is reserved for the worked SELECT examples further down the
// page). Each `<pre>` is one syntax "block" (one file); a page can carry several (e.g.
// overloads, or an operator's `x` / `NOT x` forms). The section runs until the next `<h2>`
// (normally "Arguments"). A blank source line inside a block (Prism renders it as a
// `<span class="token plain" style=display:inline-block>` with no text) is a real blank
// line the docs use to visually separate stacked variants within one block (e.g. trim's
// `trim(str)` / blank / `trim(BOTH FROM str)`) and is preserved verbatim.
//
// Resumable via manifest.json; a page with no Syntax heading is recorded with blocks:0 (no
// directory written) rather than being treated as a failure. Raw page HTML is cached under
// HTML_CACHE; a re-run re-extracts offline from the cache (only genuinely-new pages fetch).
//
// Usage: node tools/scrape-databricks-syntax.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { corpusPath } from "./corpus-paths.mjs";

const SITEMAP = "https://docs.databricks.com/aws/en/sitemap.xml";
const OUT = corpusPath("databricks/docs/syntax");
const HTML_CACHE = corpusPath("harness/local/databricks-syntax-html");
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

/** Reconstruct the source lines of one Prism `<pre>` block from its token-line spans. */
function preToLines(pre) {
	return pre
		.split(/<span class=token-line/)
		.slice(1)
		.map((chunk) =>
			unescapeHtml(
				chunk
					.replace(/^[^>]*>/, "") // drop the rest of the token-line opening tag
					.replace(/<[^>]+>/g, ""), // strip inner token spans (and the trailing <br/>)
			),
		);
}

/** Extract the Syntax section's code block(s) from one function-reference page: the HTML
 *  between the `id=syntax` heading and the next `<h2>`, then every Prism `<pre>` within it,
 *  each reconstructed to its source lines and joined back into a block of text. */
export function extractSyntaxBlocks(html) {
	const headingMatch = html.match(/<h2[^>]*\bid=["']?syntax["']?[^>]*>[\s\S]*?<\/h2>/i);
	if (!headingMatch) return [];
	const start = headingMatch.index + headingMatch[0].length;
	const nextH2 = html.indexOf("<h2", start);
	const section = html.slice(start, nextH2 === -1 ? start + 20000 : nextH2);

	const blocks = [];
	for (const m of section.matchAll(/<pre[^>]*prism-code[\s\S]*?<\/pre>/g)) {
		const text = preToLines(m[0]).join("\n").trim();
		if (text !== "") blocks.push(text);
	}
	return blocks;
}

/** Cache filename for a page URL, from its functions/<name> slug, flattened. */
function htmlKey(slug) {
	return `${slug.replace(/\//g, "_")}.html`;
}

async function main() {
	mkdirSync(OUT, { recursive: true });
	let manifest = {};
	try {
		manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
	} catch {}

	mkdirSync(HTML_CACHE, { recursive: true });
	const sitemap = await (await fetch(SITEMAP)).text();
	const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
		.map((m) => m[1])
		.filter((u) => u.includes("/sql/language-manual/functions/"));

	function slugOf(url) {
		return url
			.replace(/^https:\/\/docs\.databricks\.com\/aws\/en\/sql\/language-manual\//, "")
			.replace(/\/$/, "")
			.replace(/[^a-z0-9_/-]/gi, "_");
	}

	const toFetch = urls.filter((u) => !existsSync(join(HTML_CACHE, htmlKey(slugOf(u))))).length;
	console.log(`${urls.length} function pages, ${toFetch} to fetch (rest from HTML cache)`);

	let processed = 0;
	let fetched = 0;
	let files = 0;
	let withSyntax = 0;
	let failures = 0;

	async function worker(queue) {
		for (;;) {
			const url = queue.pop();
			if (!url) return;
			const slug = slugOf(url);
			try {
				const cacheFile = join(HTML_CACHE, htmlKey(slug));
				let html;
				if (existsSync(cacheFile)) {
					html = readFileSync(cacheFile, "utf8"); // offline re-extract
				} else {
					const res = await fetch(url);
					if (!res.ok) {
						manifest[url] = { status: res.status, blocks: 0 };
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
				manifest[url] = { status: 200, blocks: blocks.length };
			} catch (e) {
				manifest[url] = { status: "error", error: String(e), blocks: 0 };
				failures++;
			}
			processed++;
			if (processed % 100 === 0) {
				writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
				console.log(
					`${processed}/${urls.length} pages, ${withSyntax} with syntax, ${files} blocks written, ${fetched} fetched, ${failures} failures`,
				);
			}
		}
	}

	const queue = [...urls]; // one shared queue, workers pop from it
	await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
	writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
	console.log(
		`done: ${processed} pages, ${withSyntax} with syntax, ${files} blocks written, ${fetched} fetched, ${failures} failures`,
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
