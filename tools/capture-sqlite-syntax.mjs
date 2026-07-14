// Capture SQLite function call-shape phrases from the six sqlite.org doc pages that carry the
// function reference (lang_corefunc, lang_aggfunc, lang_datefunc, lang_mathfunc, json1,
// windowfunctions) into the committed syntax tier at sqlite/docs/syntax/ (the rebuild path for
// that tier - re-run this after a doc-bundle refresh), mirroring databricks/docs/syntax and
// snowflake/docs/syntax: one call phrase per <page-slug>/N.txt file plus a manifest.json. The six
// pages are read from tools/scrape-sqlite-docs.mjs's cached doc-bundle mirror
// (harness/local/sqlite-html/sqlite-doc-<ver>/) - no fetch is exercised on a normal run, but a
// small polite per-page fetch fallback is included in case a page is ever missing from the cache.
// The tier this writes is the source tools/harvest-signatures.mjs's SQLite extractor mines.
//
// MARKUP, verified against the cached SQLite 3.53.3 doc bundle (2026-07-14):
//   - lang_corefunc.html, lang_aggfunc.html, lang_mathfunc.html: each carries a "List of ... functions"
//     index directly as <li><a href='PAGE.html#anchor'>name(args)</a></li>, one <li> per overload
//     (e.g. substr(X,Y) and substr(X,Y,Z) are two separate <li>s). This index is a pure structural
//     signal - equivalent to databricks' Syntax <pre> blocks - and is captured verbatim, no judgment.
//   - lang_datefunc.html: no index list; the overview section has an <ol><li><b>name(</b><i>params</i>
//     <b>)</b></li>...</ol> list using multi-word hyphenated param names (time-value, modifier, ...).
//     Captured verbatim too (the never-wrong contract will skip these downstream - multi-word/hyphenated
//     params - which is expected and reported, not avoided here).
//   - windowfunctions.html: no index list; the "Built-in Window Functions" section has a <dl><dt><p>
//     <b>name(args)<br>name(args)...</b> deflist, one <dt> per function with sibling overloads
//     <br>-separated (e.g. lag(expr)<br>lag(expr, offset)<br>lag(expr, offset, default)). Captured
//     structurally, no judgment.
//   - json1.html: the odd one out - no index list, no deflist. Function reference is prose under
//     <h2 id="the_..._function"> headings, each introduced by a topic sentence like "The
//     json_extract(X,P1,P2,...) extracts ...". Because there is no structural markup bounding "the
//     syntax" here (unlike the other five pages), capture applies ONE light heuristic per section to
//     find candidate signature sentences among worked examples: keep a `name(args)` match only when
//     args is non-empty and every arg looks like a plain identifier (this is what a placeholder
//     signature looks like; a worked example's args are literals - '{"a":2}', 3.14159 - and fail this
//     test on their own). Empty-arg mentions ("json_array()", "the json_extract() function...") are
//     NEVER captured, even a function's own self-citation in its own section: a first pass captured
//     these and it broke downstream - an empty param list trivially "prefixes" any real occurrence in
//     the overload-merge step, so a bare later-paragraph citation like "SQLite json_extract()" (found
//     while comparing to MySQL's version, well after the real json_extract(X,P1,P2,...) topic
//     sentence) silently widened X/P1/P2 to all-optional. Dropping empty-arg capture entirely loses a
//     few genuinely-nullary forms (json_array(), json_object(), ...) this page never writes in
//     placeholder form anyway, but that is a missing signature, not a wrong one - the correct trade
//     under the never-wrong contract. This is source identification (finding the candidate sentences
//     at all), not the never-wrong CONTRACT's validity judgment - that still lives in the harvester.
//
// Self-contained by design (repo convention - shares no code with the other scrapers).
// Usage: node tools/capture-sqlite-syntax.mjs

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./corpus-paths.mjs";

const DOC_VER = process.env.SQLITE_DOC_VER ?? "3530300"; // SQLite 3.53.3 - matches tools/scrape-sqlite-docs.mjs
const SITE = "https://sqlite.org";
const CACHE = corpusPath("harness/local/sqlite-html");
const DOC_DIR = join(CACHE, `sqlite-doc-${DOC_VER}`);
const OUT = corpusPath("sqlite/docs/syntax");

const PAGES = [
	"lang_corefunc.html",
	"lang_aggfunc.html",
	"lang_datefunc.html",
	"lang_mathfunc.html",
	"json1.html",
	"windowfunctions.html",
];

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

const stripTags = (s) => s.replace(/<[^>]+>/g, "");
const stripTagsToSpace = (s) => s.replace(/<[^>]+>/g, " ");

/** Reads a page from the versioned bundle dir, else a flat sibling cache, else fetches it politely
 *  (250ms delay) from sqlite.org and caches it flat. Returns the page's HTML text. */
async function ensurePage(page) {
	const bundlePath = join(DOC_DIR, page);
	if (existsSync(bundlePath)) return { html: readFileSync(bundlePath, "utf8"), fetched: false };
	const flatPath = join(CACHE, page);
	if (existsSync(flatPath)) return { html: readFileSync(flatPath, "utf8"), fetched: false };
	console.log(`cache miss for ${page} - fetching ${SITE}/${page} ...`);
	const res = await fetch(`${SITE}/${page}`);
	if (!res.ok) throw new Error(`fetch ${page} -> ${res.status}`);
	const html = await res.text();
	mkdirSync(CACHE, { recursive: true });
	writeFileSync(flatPath, html);
	await new Promise((r) => setTimeout(r, 250)); // be polite only when actually fetching
	return { html, fetched: true };
}

/** lang_corefunc.html / lang_aggfunc.html / lang_mathfunc.html: the "List of ... functions" index,
 *  one <li><a href='PAGE.html#anchor'>phrase</a></li> per overload. Pure structural extraction. */
function extractIndexListPhrases(html, page) {
	const re = new RegExp(`<li><a href='${page}#[^']*'>([^<]*)</a></li>`, "g");
	const seen = new Set();
	const out = [];
	for (const m of html.matchAll(re)) {
		const phrase = unescapeHtml(m[1]).trim();
		if (phrase && !seen.has(phrase)) {
			seen.add(phrase);
			out.push(phrase);
		}
	}
	return out;
}

/** lang_datefunc.html: the overview <ol> list. Multi-word hyphenated params - captured verbatim,
 *  normalized to a single-line "name(args)" shape; the harvester decides what to do with them. */
function extractDatefuncPhrases(html) {
	const startIdx = html.indexOf('<h1 id="overview"');
	const olStart = html.indexOf("<ol>", startIdx);
	const olEnd = html.indexOf("</ol>", olStart);
	if (startIdx === -1 || olStart === -1 || olEnd === -1) return [];
	const section = html.slice(olStart, olEnd);
	const items = section.split(/<li>/).slice(1);
	const seen = new Set();
	const out = [];
	for (const raw of items) {
		let text = unescapeHtml(stripTags(raw)).replace(/\s+/g, " ").trim();
		text = text
			.replace(/\(\s+/g, "(")
			.replace(/\s+\)/g, ")")
			.replace(/\s*,\s*/g, ", ");
		if (text && !seen.has(text)) {
			seen.add(text);
			out.push(text);
		}
	}
	return out;
}

/** windowfunctions.html: the built-in window functions <dl><dt><p><b>name(args)<br>...</b> deflist. */
function extractWindowfuncPhrases(html) {
	const startIdx = html.indexOf('<h1 id="built_in_window_functions"');
	const endIdx = html.indexOf('<h1 id="window_chaining"', startIdx);
	if (startIdx === -1 || endIdx === -1) return [];
	const section = html.slice(startIdx, endIdx);
	const dlStart = section.indexOf("<dl>");
	const dlEnd = section.lastIndexOf("</dl>");
	if (dlStart === -1 || dlEnd === -1) return [];
	const dl = section.slice(dlStart, dlEnd);
	const seen = new Set();
	const out = [];
	for (const m of dl.matchAll(/<dt><p><b>([\s\S]*?)<\/b>/g)) {
		for (const part of m[1].split(/<br\s*\/?>/i)) {
			const text = unescapeHtml(stripTags(part)).replace(/\s+/g, " ").trim();
			if (text && !seen.has(text)) {
				seen.add(text);
				out.push(text);
			}
		}
	}
	return out;
}

/** json1.html: prose-only function reference. See the module header for the capture heuristic.
 *  Two extra guards earned by inspecting the actual false positives on a first pass:
 *   - every worked example on this page is wrapped `<li><span class='jex'>CALL</span>
 *     <span class='jans'>-&gt; RESULT</span></li>` - a structural "this is a runnable example"
 *     marker the page itself uses, so `jex` spans are stripped before scanning (this is what
 *     caught json_valid(NULL)/json_quote(NULL): NULL is identifier-shaped, so the plain-identifier
 *     test alone didn't reject it - the jex wrapper does).
 *   - every real function on this page is named json(...)/jsonb(...)/json_..(...)/jsonb_..(...);
 *     requiring that prefix drops incidental prose matches (e.g. "CREATE TABLE user(name,phone)"
 *     in the json_each/json_tree worked-example prose parses as user(name,phone) under the bare
 *     name(args) regex - both args are valid identifiers, but "user" is not a json1 function). */
function extractJson1Phrases(html) {
	const startIdx = html.indexOf('<h1 id="function_details"');
	if (startIdx === -1) return [];
	const body = html.slice(startIdx).replace(/<span class='j(ex|ans)'>[\s\S]*?<\/span>/g, "");
	const headingRe = /<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g;
	const headings = [...body.matchAll(headingRe)];
	const seen = new Set();
	const out = [];
	for (let i = 0; i < headings.length; i++) {
		const h = headings[i];
		const sectionStart = h.index + h[0].length;
		const sectionEnd = i + 1 < headings.length ? headings[i + 1].index : body.length;
		const sectionText = unescapeHtml(stripTagsToSpace(body.slice(sectionStart, sectionEnd))).replace(/\s+/g, " ");
		for (const cm of sectionText.matchAll(/\b([a-z][a-z0-9_]*)\(([^()]*)\)/g)) {
			const name = cm[1];
			if (!/^jsonb?(_\w+)?$/.test(name)) continue; // not a json1 function name - stray prose match
			const argsRaw = cm[2].trim();
			if (argsRaw === "") continue; // empty-arg mention: citation, not a signature - see header
			const args = argsRaw.split(",").map((a) => a.trim());
			const allIdentifierish = args.every((a) => a === "..." || /^[A-Za-z_][A-Za-z0-9_]*$/.test(a));
			if (!allIdentifierish) continue; // a worked example's literal args - drop
			const phrase = `${name}(${argsRaw})`;
			if (!seen.has(phrase)) {
				seen.add(phrase);
				out.push(phrase);
			}
		}
	}
	return out;
}

function extractPhrases(page, html) {
	switch (page) {
		case "lang_corefunc.html":
		case "lang_aggfunc.html":
		case "lang_mathfunc.html":
			return extractIndexListPhrases(html, page);
		case "lang_datefunc.html":
			return extractDatefuncPhrases(html);
		case "windowfunctions.html":
			return extractWindowfuncPhrases(html);
		case "json1.html":
			return extractJson1Phrases(html);
		default:
			return [];
	}
}

async function main() {
	// Wipe and rebuild every run (same convention as tools/scrape-sqlite-docs.mjs) - a shrinking page
	// (json1.html's heuristic changed between runs during development) must not leave stale N.txt
	// files behind from a larger previous run.
	if (existsSync(OUT)) rmSync(OUT, { recursive: true });
	mkdirSync(OUT, { recursive: true });
	const manifest = { source: `${SITE}/lang.html`, bundle: `sqlite-doc-${DOC_VER}`, pages: {} };
	let totalPhrases = 0;
	let totalWritten = 0;

	for (const page of PAGES) {
		const { html, fetched } = await ensurePage(page);
		const phrases = extractPhrases(page, html);
		const slug = page.replace(/\.html$/, "");
		const dir = join(OUT, slug);
		mkdirSync(dir, { recursive: true });
		phrases.forEach((phrase, i) => writeFileSync(join(dir, `${i + 1}.txt`), phrase + "\n"));
		manifest.pages[page] = {
			url: `${SITE}/${page}`,
			fetched,
			phrasesFound: phrases.length,
			written: phrases.length,
		};
		totalPhrases += phrases.length;
		totalWritten += phrases.length;
		console.log(`${page}: ${phrases.length} phrases captured`);
	}

	writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
	console.log(`done: ${PAGES.length} pages, ${totalPhrases} phrases captured, ${totalWritten} files written`);
}

await main();
