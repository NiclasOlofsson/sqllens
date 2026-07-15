// Capture per-function one-line DESCRIPTIONS from the six sqlite.org function-reference pages
// into a committed tier at sqlite/docs/descriptions.json — the companion of the syntax tier that
// tools/capture-sqlite-syntax.mjs writes (re-run both after a doc-bundle refresh). SQLite's code
// and documentation are dedicated to the public domain (sqlite.org/copyright.html), so verbatim
// prose is legally clean; entries land in the fn-docs table as origin "vendor-docs".
//
// MARKUP, verified against the cached SQLite 3.53.3 doc bundle (2026-07-15):
//   - lang_corefunc.html, lang_aggfunc.html, lang_mathfunc.html, windowfunctions.html: the details
//     section is a <dl> of `<a name="anchor"></a> <dt><p><b>name(args)[<br>overload...]</b></dt>
//     <dd><p> prose </dd>` pairs — the dd's first sentence is the description. A dt carrying
//     several <br>-separated overloads describes ONE function; a dt naming several distinct
//     functions (rare) maps the same dd sentence to each name it mentions.
//   - json1.html: prose sections under <h2> headings ("4.8. The json_insert(), json_replace(),
//     and json_set() functions"); every jsonb?-named function in the heading gets the section's
//     first sentence.
//   - lang_datefunc.html: no per-function structure; the overview prose describes each function in
//     a "The <name>() function returns ..." sentence — those sentences are captured per function.
//
// Self-contained by design (repo convention — shares no code with the other scrapers).
// Usage: node tools/capture-sqlite-descriptions.mjs

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./corpus-paths.mjs";

const DOC_VER = process.env.SQLITE_DOC_VER ?? "3530300"; // matches tools/capture-sqlite-syntax.mjs
const DOC_DIR = corpusPath(`harness/local/sqlite-html/sqlite-doc-${DOC_VER}`);
const OUT = corpusPath("sqlite/docs/descriptions.json");

const DL_PAGES = ["lang_corefunc.html", "lang_aggfunc.html", "lang_mathfunc.html", "windowfunctions.html"];

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
const stripTags = (s) =>
	unescapeHtml(s.replace(/<[^>]+>/g, " "))
		.replace(/\s+/g, " ")
		.trim();

function firstSentenceOf(text, cap = 300) {
	const t = text
		.replace(/\s+/g, " ")
		.replace(/\s+([.,;)])/g, "$1")
		.trim();
	const m = t.match(/^.*?[.!?](?=\s|$)/);
	const sentence = m ? m[0] : t;
	return (sentence.length >= 20 ? sentence : t).slice(0, cap).trim().replace(/:$/, ".");
}

/** Every distinct function name called in a fragment of dt/heading text. */
function namesIn(text) {
	const names = new Set();
	for (const m of text.matchAll(/\b([a-z_][a-z0-9_]*)\s*\(/gi)) names.add(m[1].toLowerCase());
	return [...names];
}

/** The <dl> detail pages: dt (signature, maybe several <br>-separated overloads) + dd (prose).
 *  A `<a name="X"></a>` immediately before the dt is the entry's own anchor (reproduced verbatim
 *  into the anchors map). */
function extractDlDescriptions(html, page, into, anchors) {
	const re =
		/(?:<a name="([^"]+)"><\/a>\s*)?<dt><p[^>]*><b>([\s\S]*?)<\/b>\s*(?:<\/p>)?\s*<\/dt>\s*<dd>(?:<p>)?([\s\S]*?)<\/dd>/g;
	for (const m of html.matchAll(re)) {
		const desc = firstSentenceOf(stripTags(m[3]));
		if (!desc) continue;
		for (const name of namesIn(stripTags(m[2]))) {
			if (!into.has(name)) into.set(name, desc);
			if (m[1] && !anchors.has(name)) anchors.set(name, `${page}#${m[1]}`);
		}
	}
}

/** json1.html: h2 section headings name the functions; the section's first sentence describes
 *  them, and the heading's own id is their anchor. */
function extractJson1Descriptions(html, into, anchors) {
	const start = html.indexOf('<h1 id="function_details"');
	if (start === -1) return;
	const body = html.slice(start);
	const headings = [...body.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)];
	for (let i = 0; i < headings.length; i++) {
		const names = namesIn(stripTags(headings[i][2])).filter((n) => /^jsonb?(_\w+)?$/.test(n));
		if (names.length === 0) continue;
		const sectionEnd = i + 1 < headings.length ? headings[i + 1].index : body.length;
		const section = body.slice(headings[i].index + headings[i][0].length, sectionEnd);
		const firstPara = section.match(/<p>([\s\S]*?)<\/p>/);
		if (!firstPara) continue;
		const desc = firstSentenceOf(stripTags(firstPara[1]));
		if (!desc) continue;
		for (const name of names) {
			if (!into.has(name)) into.set(name, desc);
			if (!anchors.has(name)) anchors.set(name, `json1.html#${headings[i][1]}`);
		}
	}
}

/** The index-list pages (corefunc/aggfunc/mathfunc) link every function as
 *  `<a href='PAGE#anchor'>name(...)</a>` — the anchors, reproduced verbatim. */
function extractIndexAnchors(html, page, anchors) {
	const re = new RegExp(`<a href='${page}#([^']*)'>([a-z_][a-z0-9_]*)\\(`, "g");
	for (const m of html.matchAll(re)) {
		const name = m[2].toLowerCase();
		if (!anchors.has(name)) anchors.set(name, `${page}#${m[1]}`);
	}
}

/** lang_datefunc.html: "The <name>(...) function/routine ..." sentences in the prose. A name can
 *  be mentioned in several such sentences; prefer the first one that says what it RETURNS (the
 *  definitional sentence) over continuation prose ("... also takes ..."). */
function extractDatefuncDescriptions(html, into) {
	const text = stripTags(html);
	const re = /The ([a-z_][a-z0-9_]*)\s*\([^)]*\)\s+(?:function|routine)\s+[^.]*\./g;
	const byName = new Map();
	for (const m of text.matchAll(re)) {
		const name = m[1].toLowerCase();
		if (!byName.has(name)) byName.set(name, []);
		byName.get(name).push(m[0]);
	}
	for (const [name, sentences] of byName) {
		if (into.has(name)) continue;
		const definitional = sentences.find((s) => /\breturns?\b/.test(s));
		into.set(name, firstSentenceOf(definitional ?? sentences[0]));
	}
}

function main() {
	const descriptions = new Map();
	const anchors = new Map();
	const pages = {};
	for (const page of [...DL_PAGES, "json1.html", "lang_datefunc.html"]) {
		const p = join(DOC_DIR, page);
		if (!existsSync(p)) {
			console.error(`missing ${p} — refresh the doc bundle first (tools/scrape-sqlite-docs.mjs)`);
			process.exitCode = 1;
			return;
		}
		const html = readFileSync(p, "utf8");
		const before = descriptions.size;
		if (DL_PAGES.includes(page)) {
			extractDlDescriptions(html, page, descriptions, anchors);
			extractIndexAnchors(html, page, anchors);
		} else if (page === "json1.html") extractJson1Descriptions(html, descriptions, anchors);
		else extractDatefuncDescriptions(html, descriptions);
		pages[page] = descriptions.size - before;
		console.log(`${page}: ${descriptions.size - before} descriptions`);
	}
	const out = {
		source: "https://sqlite.org (documentation dedicated to the public domain)",
		bundle: `sqlite-doc-${DOC_VER}`,
		pages,
		descriptions: Object.fromEntries([...descriptions.entries()].sort(([a], [b]) => a.localeCompare(b))),
		// name -> page.html#anchor, reproduced verbatim from the pages' own anchors/index links.
		anchors: Object.fromEntries([...anchors.entries()].sort(([a], [b]) => a.localeCompare(b))),
	};
	writeFileSync(OUT, JSON.stringify(out, null, 1));
	console.log(`done: ${descriptions.size} descriptions, ${anchors.size} anchors -> ${OUT}`);
}

main();
