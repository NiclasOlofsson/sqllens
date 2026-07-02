// Scrape SQL examples from the PostgreSQL docs (postgresql.org/docs/<ver>/) into the corpus repo.
//
// Pages are enumerated by a bounded BFS crawl from index.html (chapters link their sections;
// depth 2 covers the whole book). Examples are the `<pre class="programlisting">` blocks —
// PostgreSQL's DocBook HTML puts SQL there and rendered psql output in separate
// `<pre class="screen">` blocks, so output-stripping is lighter than the AWS scraper's. Blocks
// containing a `replaceable`/`<em>` placeholder are synopsis/metasyntax and are skipped.
// Resumable: pages recorded in manifest.json are skipped on rerun.
//
// Self-contained by design — shares no code with the other dialects' scrapers (repo convention).
// Usage: node tools/scrape-postgres-docs.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { corpusPath } from "./corpus-paths.mjs";

const VER = "18";
const BASE = `https://www.postgresql.org/docs/${VER}`;
const OUT = corpusPath("postgres/docs");
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

// First words that can begin a PostgreSQL statement — a block starting with anything else is
// C/shell/psql-meta/output, not a parse-corpus statement. Derived from the PostgreSQL 18 SQL
// commands reference (https://www.postgresql.org/docs/18/sql-commands.html).
const STATEMENT_STARTERS =
	/^(abort|alter|analyze|begin|call|checkpoint|close|cluster|comment|commit|copy|create|deallocate|declare|delete|discard|do|drop|end|execute|explain|fetch|grant|import|insert|listen|load|lock|merge|move|notify|prepare|reassign|refresh|reindex|release|reset|revoke|rollback|savepoint|security|select|set|show|start|table|truncate|unlisten|update|vacuum|values|with)\b/i;

// psql result-table border / row detection — programlisting blocks occasionally still carry
// inline output (older pages), same signals as the Redshift scraper.
function isResultBorder(line) {
	return /^[\s\-+=|]+$/.test(line) && /-{3,}/.test(line);
}
function isHeaderish(line) {
	const t = line.trim();
	return (
		t !== "" &&
		!/[(),;'"*]/.test(line) &&
		!STATEMENT_STARTERS.test(t) &&
		!/^(from|where|group|order|having|union|join|on|and|or|limit|offset|select)\b/i.test(t)
	);
}
function isTabular(line) {
	const t = line.trim();
	// `||` is the SQL concat operator (`path || g.id`), never a psql column separator — a line
	// containing it is expression text, not a result row.
	return /\|/.test(t) && !/\|\|/.test(t) && /^[\w\s|.:%/+-]+$/.test(t) && !STATEMENT_STARTERS.test(t);
}
const ROWS_FOOTER = /^\s*\(\d+ rows?\)\s*$/;
const RECORD_SEP = /^\s*-\[ RECORD \d+ \]/; // psql expanded-mode (\x) record separator
const PROSE_LINE = /^\s*(The |This |These |Note:|For example|Here |Output:|Returns? |Result:|Where:)/;

export function cleanSql(sql) {
	// Strip zero-width space / soft hyphen / BOM — the PG docs HTML carries U+200B inside long
	// result-table border lines, which breaks border detection.
	sql = sql.replace(/[​­﻿]/g, "");
	sql = sql.replace(/ /g, " ");
	const lines = sql.split("\n");
	let cut = -1;
	for (let i = 0; i < lines.length; i++) {
		const l = lines[i];
		// psql prompt lines (`=>`, `=#`, `-#`) mean the block is a psql session transcript — keep
		// only what follows the prompt on prompt lines; simplest correct handling: reject the block
		// (sessions mix meta-commands and output).
		if (/^[a-z_][\w]*(=[>#]|-[>#])\s/.test(l)) return null;
		if (/^\\/.test(l.trim())) return null; // psql meta-command (\d, \set, …)
		if (i > 0 && /\(cost=[\d.]+\.\.[\d.]+\s+rows=/.test(l)) {
			let j = i;
			while (j > 0 && lines[j - 1].trim() === "") j--;
			if (j > 0 && /^\s*explain\b/i.test(lines[j - 1])) j--;
			cut = j;
			break;
		}
		if (
			i > 0 &&
			(isResultBorder(l) || ROWS_FOOTER.test(l) || RECORD_SEP.test(l) || PROSE_LINE.test(l) || isTabular(l))
		) {
			cut = isResultBorder(l) && i > 1 && isHeaderish(lines[i - 1]) ? i - 1 : i;
			break;
		}
		// A statement terminator whose next non-blank line is not itself a SQL statement (nor a
		// comment) — inline rendered output with no border (bare values, `{a,b}` array output).
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
	if (/<[a-z_][a-z0-9_]*>/i.test(kept)) return null; // <placeholder> template
	if (/(^|[^\w'"`])<[a-z_][a-z0-9_]* [^>]*>/i.test(kept)) return null;
	if (!/^\(+\s*(select|with|values|table)\b/i.test(kept) && !STATEMENT_STARTERS.test(kept)) return null;
	return kept;
}

export function extractSql(html) {
	const blocks = [];
	for (const m of html.matchAll(/<pre class="programlisting">([\s\S]*?)<\/pre>/g)) {
		let inner = m[1].replace(/<!--[\s\S]*?-->/g, "");
		if (/<em[ >]|replaceable/.test(inner)) continue; // synopsis/metasyntax placeholders
		const sql = cleanSql(unescapeHtml(inner.replace(/<[^>]+>/g, "")));
		if (sql) blocks.push(sql);
	}
	return blocks;
}

function pageLinks(html) {
	const acc = new Set();
	for (const m of html.matchAll(/href="([a-z0-9][a-z0-9._-]*\.html)"/gi)) acc.add(m[1]);
	return acc;
}

async function fetchText(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${res.status} ${url}`);
	return await res.text();
}

async function main() {
	mkdirSync(OUT, { recursive: true });
	let manifest = {};
	try {
		manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
	} catch {}

	// BFS crawl, depth 2 from index.html: index → chapters → sections. The set stabilizes there
	// (PostgreSQL's book is chapters > sect1 pages; deeper links are cross-references).
	console.log("crawling TOC…");
	const seen = new Set(["index.html"]);
	let frontier = [...pageLinks(await fetchText(`${BASE}/index.html`))].filter((p) => !seen.has(p));
	for (let depth = 0; depth < 2; depth++) {
		frontier.forEach((p) => seen.add(p));
		const next = new Set();
		let i = 0;
		async function worker() {
			for (;;) {
				const page = frontier[i++];
				if (!page) return;
				try {
					for (const l of pageLinks(await fetchText(`${BASE}/${page}`))) if (!seen.has(l)) next.add(l);
				} catch {}
			}
		}
		await Promise.all(Array.from({ length: 8 }, worker));
		frontier = [...next];
		console.log(`depth ${depth + 1}: ${seen.size} pages known, ${frontier.length} new`);
	}
	frontier.forEach((p) => seen.add(p));
	// Procedural-language chapters (PL/pgSQL, PL/Tcl, PL/Perl, PL/Python) document function-BODY
	// languages, not the SQL dialect — their examples are body fragments (IF/LOOP/RAISE) or
	// host-language-escaped SQL, out of a SQL parser's scope.
	const pages = [...seen].filter((p) => !/^(plpgsql|pltcl|plperl|plpython)-/.test(p)).sort();
	const todo = pages.filter((p) => !(p in manifest));
	console.log(`${pages.length} pages, ${todo.length} to fetch`);

	let fetched = 0;
	let files = 0;
	let failures = 0;
	async function worker(queue) {
		for (;;) {
			const page = queue.pop();
			if (!page) return;
			const slug = page.replace(/\.html$/, "").replace(/[^a-z0-9_-]/gi, "_");
			try {
				const blocks = extractSql(await fetchText(`${BASE}/${page}`));
				if (blocks.length) {
					const dir = join(OUT, slug);
					mkdirSync(dir, { recursive: true });
					blocks.forEach((sql, i) => writeFileSync(join(dir, `${i + 1}.sql`), sql + "\n"));
					files += blocks.length;
				}
				manifest[page] = { status: 200, blocks: blocks.length };
			} catch (e) {
				manifest[page] = { status: "error", error: String(e).slice(0, 100), blocks: 0 };
				failures++;
			}
			fetched++;
			if (fetched % 100 === 0) {
				writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
				console.log(`${fetched}/${todo.length} pages, ${files} sql files, ${failures} failures`);
			}
			await new Promise((r) => setTimeout(r, 150));
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
