// Builds the offline MySQL function-signature SYNTAX tier at mysql/docs/syntax/ in the corpus repo
// (the rebuild path for that tier - re-run this after a manual-version refresh), mirroring
// databricks/docs/syntax's directory-of-numbered-files shape, from the ALREADY-cached refman HTML at
// harness/local/mysql-html/*.html (written by tools/scrape-mysql-docs.mjs; verified 2026-07-14 to
// cover all 77 curated PAGES, one genuine 404 stub at this manual version). No network fetch happens
// here at all: if a future manual revision drops a cached page, re-run tools/scrape-mysql-docs.mjs
// first (it owns the fetch-and-cache step) before re-running this capture. The tier this writes is
// the source tools/harvest-signatures.mjs's MySQL extractor mines.
//
// MARKUP (verified against the live cache, not guessed): a function/operator's reference entry is
//   <a name="function_concat"></a><p>
//     <a class="link" href="...#function_concat"><code class="literal">CONCAT(<em class="replaceable">
//       <code>str1</code></em>,<em class="replaceable"><code>str2</code></em>,...)</code></a>
//   </p>
// - the anchor is `<a name="function_NAME">` or `<a name="operator_NAME">` (docbook id, hyphenated);
//   sometimes it sits immediately before the <p>, sometimes inside it (json-table-functions.html) - in
//   both cases the enclosing paragraph is "from the anchor's end to the next </p>".
// - MySQL documents overloads as SEPARATE call-phrase forms in that one paragraph, each its own
//   `<code class="literal">...</code>` span (comma-joined by plain doc prose between spans, e.g.
//   SUBSTRING's four forms, ROUND's two, TRIM's two). Each span is captured as one form-line.
// - a span nests a nameless `<code>` INSIDE each `<em class="replaceable">` parameter marker, so the
//   literal-vs-param distinction is carried in HTML structure - but since every parameter name is a
//   plain identifier and every literal token is a keyword/paren/comma/bracket, detagging to plain text
//   loses no information the flat-list parser needs (this mirrors how the existing T-SQL/Databricks/
//   Snowflake extractors already work: they classify each token by shape, not by source markup).
// - the INDEX table at the top of each page (`<td><a ...><code class="literal">CONCAT()</code></a></td>`)
//   always renders empty parens regardless of true arity (CONCAT() there vs CONCAT(str1,str2,...) in the
//   definition) - captured here would inject a false zero-arg overload, so it is deliberately EXCLUDED;
//   only the `<a name="...">`-anchored definition paragraphs are scanned.
//
// LAYOUT: one file PER FUNCTION/OPERATOR ENTRY (matching Databricks' directory-of-numbered-files,
// but the directory here is the page slug since one MySQL page lists many functions, unlike
// Databricks' one-page-per-function), numbered sequentially per page:
// mysql/docs/syntax/<page-slug>/N.txt. Each N.txt holds one form PER LINE, in documented order
// (SUBSTRING's four forms are four lines in string-functions/<N>.txt). manifest.json carries the
// anchor slug/kind/URL/form-count per N so the harvester (and any future reader) can trace
// provenance without parsing filenames.
//
// Self-contained by design (repo convention - shares no code with the other scrapers).
// Usage: node tools/capture-mysql-syntax.mjs

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./corpus-paths.mjs";

const CACHE = corpusPath("harness/local/mysql-html");
const OUT = corpusPath("mysql/docs/syntax");
const DOC_VER = "8.4";
const SITE = `https://dev.mysql.com/doc/refman/${DOC_VER}/en`;

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

function detag(html) {
	return unescapeHtml(html.replace(/<[^>]+>/g, ""))
		.replace(/\s+/g, " ")
		.trim();
}

/** All balanced `<code class="literal">...</code>` spans in `paraHtml`, depth-aware so the nameless
 *  `<code>` nested inside each `<em class="replaceable">` parameter marker does not truncate the outer
 *  span at its own first `</code>`. Returns `{ raw, inner }[]` - `raw` is the whole matched element
 *  (open tag through close tag, still tagged, used only to compute the purity residual below); `inner`
 *  is the span's content (still tagged; detag() is applied once a span is kept). */
function extractCodeLiteralSpans(paraHtml) {
	const spans = [];
	const openRe = /<code class="literal">/g;
	let m;
	while ((m = openRe.exec(paraHtml))) {
		const start = m.index + m[0].length;
		let depth = 1;
		const tagRe = /<\/?code[^>]*>/g;
		tagRe.lastIndex = start;
		let t;
		let end = -1;
		while ((t = tagRe.exec(paraHtml))) {
			if (t[0].startsWith("</")) {
				depth--;
				if (depth === 0) {
					end = t.index;
					break;
				}
			} else {
				depth++;
			}
		}
		if (end === -1) {
			openRe.lastIndex = start; // unbalanced - bail this one, keep scanning after the opener
			continue;
		}
		const closeTagEnd = end + "</code>".length;
		spans.push({ raw: paraHtml.slice(m.index, closeTagEnd), inner: paraHtml.slice(start, end) });
		openRe.lastIndex = end;
	}
	return spans;
}

const CALL_SHAPED_RE = /^[A-Za-z_][A-Za-z0-9_]*\(/;

// A handful of entries split ONE documented signature across consecutive <p> elements instead of
// comma-joining every form inside a single <p> (verified empirically: scanning all 316 entries in the
// cache for a directly-following <p> that itself contains a call-shaped code-literal span, only
// cast-functions.html's CAST and CONVERT qualify - every other candidate was a bare `NAME()` prose
// cross-reference to a DIFFERENT function, e.g. MAX's own paragraph mentioning "... MIN() ..."). A
// following <p> is a genuine continuation of THIS entry, not prose, only when NOTHING besides its own
// code-literal span(s) remains once they are removed (a real cross-reference paragraph always carries
// surrounding prose words; a continuation paragraph is pure signature, nothing else). This is checked
// per paragraph, chained, so a third+ paragraph could in principle continue too (none currently do).
function isPureContinuation(pHtml, spans) {
	if (!spans.some((s) => CALL_SHAPED_RE.test(detag(s.inner)))) return false;
	let residual = pHtml;
	for (const s of spans) residual = residual.replace(s.raw, "");
	residual = residual.replace(/<[^>]+>/g, "").replace(/[,\s]/g, "");
	return residual === "";
}

// A gap between one paragraph's `</p>` and the next `<p>` is safe to cross (still the SAME entry) only
// when it holds nothing but whitespace / `<a class="indexterm">` anchors - anything else (a new
// `<li>`, another `<a name="function_.../operator_...">`) means we have moved on to a different entry.
const SAFE_GAP_RE = /^(\s|<a class="indexterm"[^>]*><\/a>)*$/;

/** One page's function/operator reference entries: `{ anchorKind, anchorName, forms }[]`, document order. */
function extractEntries(html) {
	const entries = [];
	const anchorRe = /<a name="(function|operator)_([a-z0-9-]+)"><\/a>/g;
	let m;
	while ((m = anchorRe.exec(html))) {
		const anchorKind = m[1];
		const anchorName = m[2];
		let cursor = m.index + m[0].length;
		const forms = [];
		for (;;) {
			const closeP = html.indexOf("</p>", cursor);
			if (closeP === -1) break; // malformed - stop with whatever was captured so far
			const paraHtml = html.slice(cursor, closeP);
			const spans = extractCodeLiteralSpans(paraHtml);
			forms.push(...spans.map((s) => detag(s.inner)).filter((f) => f !== ""));
			cursor = closeP + "</p>".length;

			// Peek at a directly-following <p>: continue the chain only if the gap is safe AND that
			// paragraph is a pure signature continuation (see isPureContinuation above).
			const nextOpen = html.indexOf("<p>", cursor);
			if (nextOpen === -1 || !SAFE_GAP_RE.test(html.slice(cursor, nextOpen))) break;
			const nextClose = html.indexOf("</p>", nextOpen);
			if (nextClose === -1) break;
			const nextParaHtml = html.slice(nextOpen + "<p>".length, nextClose);
			const nextSpans = extractCodeLiteralSpans(nextParaHtml);
			if (!isPureContinuation(nextParaHtml, nextSpans)) break;
			cursor = nextOpen; // resume the loop at the continuation paragraph
		}
		entries.push({ anchorKind, anchorName, forms });
	}
	return entries;
}

async function main() {
	mkdirSync(CACHE, { recursive: true });
	const cachedPages = new Set(readdirSync(CACHE).filter((f) => f.endsWith(".html")));
	console.log(`cache: ${cachedPages.size} pages present at ${CACHE}`);

	if (existsSync(OUT)) rmSync(OUT, { recursive: true });
	mkdirSync(OUT, { recursive: true });

	const manifest = {};
	let pagesProcessed = 0;
	let pages404 = 0;
	let entriesTotal = 0;
	let entriesNoForms = 0;
	let filesWritten = 0;
	let formsTotal = 0;

	for (const page of [...cachedPages].sort()) {
		const html = readFileSync(join(CACHE, page), "utf8");
		if (html.startsWith("<!-- fetch ") && html.includes("-> 404 -->")) {
			pages404++;
			manifest[page] = { status: 404, entries: 0 };
			continue;
		}
		const slug = page.replace(/\.html$/, "");
		const entries = extractEntries(html);
		pagesProcessed++;

		let n = 0;
		const pageManifest = [];
		for (const entry of entries) {
			entriesTotal++;
			if (entry.forms.length === 0) {
				entriesNoForms++;
				pageManifest.push({ anchor: `${entry.anchorKind}_${entry.anchorName}`, forms: 0 });
				continue;
			}
			n++;
			formsTotal += entry.forms.length;
			const dir = join(OUT, slug);
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, `${n}.txt`), entry.forms.join("\n") + "\n");
			filesWritten++;
			pageManifest.push({
				n,
				anchor: `${entry.anchorKind}_${entry.anchorName}`,
				forms: entry.forms.length,
			});
		}
		manifest[page] = {
			status: 200,
			url: `${SITE}/${page}`,
			entries: entries.length,
			files: n,
			detail: pageManifest,
		};
	}

	writeFileSync(
		join(OUT, "manifest.json"),
		JSON.stringify(
			{
				manual: `MySQL ${DOC_VER} Reference Manual`,
				source: `${SITE}/`,
				capturedFrom: "harness/local/mysql-html (cached by tools/scrape-mysql-docs.mjs)",
				pages: manifest,
			},
			null,
			1,
		),
	);

	console.log(
		`done: ${pagesProcessed} pages scanned, ${pages404} 404-stub pages skipped, ` +
			`${entriesTotal} function/operator entries found (${entriesNoForms} with zero code-literal forms), ` +
			`${filesWritten} N.txt files written, ${formsTotal} total form-lines captured`,
	);
}

await main();
