// Extract SQL examples from the official SQLite language docs into the corpus repo.
//
// Mirror-then-parse (the SQLite site's own recommendation and the politest option): download the
// documentation bundle once (sqlite.org/<year>/sqlite-doc-<ver>.zip), unzip it into the gitignored
// cache, then parse the local `lang_*.html` pages. No per-page hammering, byte-reproducible from a
// pinned bundle version.
//
// Where the SQL lives. SQLite's language pages present *syntax* as pikchr SVG railroad diagrams (not
// extractable text, and not runnable anyway) and *examples* as either:
//   - <pre> blocks (often wrapped `<div class="codeblock"><pre>…</pre></div>`) — statement pages, and
//   - <blockquote> blocks — the function pages (lang_datefunc etc.) put runnable SELECTs here.
// Both are pulled; the hygiene filters below drop metasyntax fragments, ellipsis, prose, and result
// output so what lands is a parse corpus.
//
// Deterministic + re-runnable: wipes OUT and rebuilds from the cached bundle every run, so a rerun
// reproduces the committed corpus exactly. Each file carries a `-- source:` provenance comment (a
// hidden-channel SQLite comment — parse-invisible). Output follows the corpus-repo convention,
// `parser/positive/<kind>/<page-slug>/<n>.sql`, bucketed with the SAME rule the organizer uses
// (bucketOfKinds over the current parser's statementCategories; parse failures → unparsed), which is
// why this scraper — unlike the plain-node siblings — runs under tsx: bucketing imports the TS parser.
//
// Usage:  npx tsx tools/scrape-sqlite-docs.mjs        (needs src/generated/sqlite: npm run gen -- sqlite)
//   Env overrides: SQLITE_DOC_VER / SQLITE_DOC_YEAR (bump on a new SQLite release);
//                  SQLITE_DOC_DIR (point at an already-unzipped doc dir, skips download).

import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { corpusPath } from "./corpus-paths.mjs";

// Pinned SQLite documentation release. Bump these two on a new release, rerun, recommit.
const DOC_VER = process.env.SQLITE_DOC_VER ?? "3530300"; // SQLite 3.53.3
const DOC_YEAR = process.env.SQLITE_DOC_YEAR ?? "2026";
const ZIP_NAME = `sqlite-doc-${DOC_VER}.zip`;
const ZIP_URL = `https://sqlite.org/${DOC_YEAR}/${ZIP_NAME}`;
const SITE = "https://sqlite.org";

const CACHE = corpusPath("harness/local/sqlite-html"); // gitignored (corpus .gitignore: harness/local/*-html/)
const DOC_DIR = process.env.SQLITE_DOC_DIR ?? join(CACHE, `sqlite-doc-${DOC_VER}`);
const OUT = corpusPath("sqlite/docs");

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

// First words that can begin a SQLite statement — the statement list from sqlite.org/lang.html
// (plus VALUES/TABLE, which begin a query). A block starting with anything else is a clause
// fragment, prose, or metasyntax, not a parse-corpus statement.
const STATEMENT_STARTERS =
	/^(alter|analyze|attach|begin|commit|create|delete|detach|drop|end|explain|insert|pragma|reindex|release|replace|rollback|savepoint|select|table|update|vacuum|values|with)\b/i;

// A rendered result-table border line (dashes with a +/| column separator) that leaked in under a
// statement.
function isResultBorder(line) {
	return /^[\s\-+=|]+$/.test(line) && /-{3,}/.test(line) && /[+|]/.test(line);
}
// A psql-style `(N rows)` footer and English prose lines the docs put between a statement and its
// output.
const ROWS_FOOTER = /^\s*\(\d+ rows?\)\s*$/;
const PROSE_LINE = /^\s*(The |This |These |Note:|For example|Here |Output:|Returns? |Result:|Where:|In this)/;

export function cleanSql(sql) {
	// Docs HTML renders spacing with non-breaking spaces (&nbsp; → U+00A0); the SQL lexer rejects
	// them, so normalize to a plain space. Strip zero-width space / soft hyphen / BOM too.
	sql = sql.replace(/ /g, " ").replace(/[​­﻿]/g, "");
	const lines = sql.split("\n");
	// Cut at the first result border, `(N rows)` footer, or prose line that sits UNDER the statement.
	let cut = lines.findIndex((l, i) => i > 0 && (isResultBorder(l) || ROWS_FOOTER.test(l) || PROSE_LINE.test(l)));
	const kept = (cut === -1 ? lines : lines.slice(0, cut)).join("\n").trim();
	if (kept === "") return null;
	if (/^[[{]/.test(kept)) return null; // JSON output block
	if (/(^|[\s(,])\.\.\.([\s),;]|$)/.test(kept)) return null; // ellipsis placeholder anywhere
	// Documentation-abbreviation marker: a `--` comment saying content was left out (e.g. the
	// `-- other content omitted` inside lang_with's CREATE TABLE org) — the block is truncated
	// pseudo-syntax (a trailing comma before `)`), not runnable SQL.
	if (/--[^\n]*\bomitted\b/i.test(kept)) return null;
	if (/<[a-z_][a-z0-9_-]*>/i.test(kept)) return null; // <placeholder> template, not real SQL
	// Metasyntax option brackets `[ … ]` around a keyword — railroad-diagram text, never runnable SQL.
	if (/\[\s*(,|WITH|OR|IF|NOT|AS|LIKE|IN|CASCADE|RESTRICT|COLLATE|ASC|DESC)\b/i.test(kept)) return null;
	if ((kept.match(/'/g) ?? []).length % 2 === 1) return null; // odd quote count — truncated illustration
	// The statement-starter gate must see PAST leading comments: lang_naming's runnable block opens
	// with a `/* … */` banner before its ATTACH/CREATE statements, and testing the raw first word
	// silently dropped it. Strip leading `--` lines and `/* */` blocks for the TEST only — the kept
	// text (comments included) is what gets written.
	let head = kept;
	for (;;) {
		const stripped = head.replace(/^\s*(--[^\n]*(\n|$)|\/\*[\s\S]*?\*\/)/, "");
		if (stripped === head) break;
		head = stripped;
	}
	head = head.trim();
	if (head === "") return null; // comment-only block
	if (!/^\(+\s*(select|with|values|table)\b/i.test(head) && !STATEMENT_STARTERS.test(head)) return null;
	return kept;
}

// SQL examples live in <pre> blocks (incl. `<div class="codeblock"><pre>`) and <blockquote> blocks.
// Both are pulled; cleanSql + the statement-starter gate keep only runnable statements.
// Returns { blocks, raw }: `raw` counts every candidate container found, so the funnel report can
// state raw → hygiene-passed → written honestly.
export function extractSql(html) {
	const blocks = [];
	let raw = 0;
	const push = (rawBlock) => {
		raw++;
		// Drop any block that carried list markup (<li> …): those are enumerations of syntax forms
		// (e.g. the CASE variants on lang_expr), not statements.
		if (/<li[ >]/i.test(rawBlock)) return;
		// Drop blocks wrapping an HTML data table — a <blockquote>/<pre> around a <table> is a
		// comparison/reference table (e.g. lang_altertable's foreign_keys×legacy_alter_table matrix),
		// whose cells flatten into non-SQL noise.
		if (/<t(able|r|d|h)[ >]/i.test(rawBlock)) return;
		const sql = cleanSql(unescapeHtml(rawBlock.replace(/<[^>]+>/g, "")));
		if (sql) blocks.push(sql);
	};
	for (const m of html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)) push(m[1]);
	for (const m of html.matchAll(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi)) push(m[1]);
	return { blocks, raw };
}

async function ensureDocDir() {
	if (existsSync(DOC_DIR)) return;
	mkdirSync(CACHE, { recursive: true });
	const zipPath = join(CACHE, ZIP_NAME);
	if (!existsSync(zipPath)) {
		console.log(`downloading ${ZIP_URL} …`);
		const res = await fetch(ZIP_URL);
		if (!res.ok) throw new Error(`fetch ${ZIP_URL} → ${res.status}`);
		writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
	}
	console.log(`unzipping ${ZIP_NAME} …`);
	try {
		execFileSync("unzip", ["-q", "-o", zipPath, "-d", CACHE], { stdio: "ignore" });
	} catch {
		// No `unzip` on PATH (bare Windows) — fall back to PowerShell's Expand-Archive.
		execFileSync(
			"powershell",
			["-NoProfile", "-Command", `Expand-Archive -Force -LiteralPath '${zipPath}' -DestinationPath '${CACHE}'`],
			{ stdio: "ignore" },
		);
	}
	if (!existsSync(DOC_DIR)) throw new Error(`unzip did not produce ${DOC_DIR}`);
}

// The corpus-convention bucket for one snippet: `parser/positive/<kind>` via the SAME rule the
// organizer applies (tools/organize-corpus.test.ts) — bucketOfKinds over the current parser's
// statementCategories; a snippet the parser rejects lands in `unparsed` (the organizer's rule for
// parse failures). Pure function of the snippet text + the current grammar, so byte-reproducible.
function makeBucketer({ parseSqlite, statementCategories, bucketOfKinds }) {
	return (sql) => {
		let r;
		try {
			r = parseSqlite(sql);
		} catch {
			return "unparsed";
		}
		if (r.errors > 0) return "unparsed";
		try {
			return bucketOfKinds(statementCategories(r.tree));
		} catch {
			return "unparsed";
		}
	};
}

async function main() {
	// Classification needs the real sqlite parser (TypeScript) — hence the tsx usage requirement.
	let classifier;
	try {
		const [{ parseSqlite }, { statementCategories }, { bucketOfKinds }] = await Promise.all([
			import("../src/sqlite/parse.ts"),
			import("../src/sqlite/lower.ts"),
			import("../tests/helpers/statement-bucket.ts"),
		]);
		classifier = makeBucketer({ parseSqlite, statementCategories, bucketOfKinds });
	} catch (e) {
		console.error(
			"cannot load the sqlite parser for bucketing — run via tsx (npx tsx tools/scrape-sqlite-docs.mjs)\n" +
				"and make sure src/generated/sqlite exists (npm run gen -- sqlite).\n" +
				String(e).slice(0, 200),
		);
		process.exit(1);
	}

	await ensureDocDir();
	if (existsSync(OUT)) rmSync(OUT, { recursive: true });
	mkdirSync(OUT, { recursive: true });

	const pages = readdirSync(DOC_DIR)
		.filter((f) => /^lang.*\.html$/.test(f)) // lang.html + every per-statement lang_*.html
		.sort();

	const seen = new Set(); // global content dedupe (same example repeated across pages)
	let rawTotal = 0;
	let passed = 0;
	let written = 0;
	const manifest = {};

	for (const page of pages) {
		const slug = page.replace(/\.html$/, "");
		const url = `${SITE}/${page}`;
		const { blocks, raw } = extractSql(readFileSync(join(DOC_DIR, page), "utf8"));
		rawTotal += raw;
		passed += blocks.length;
		// One file per snippet at parser/positive/<bucket>/<slug>/<n>.sql. `n` counts the page's
		// deduped snippets in document order ACROSS buckets, so a file keeps its number even if a
		// grammar change moves it to another bucket (keeps KNOWN_BAD_DOCS keys traceable).
		let i = 0;
		for (const sql of blocks) {
			const key = sql.replace(/\s+/g, " ").trim();
			if (seen.has(key)) continue;
			seen.add(key);
			i++;
			const bucket = classifier(sql);
			const dir = join(OUT, "parser", "positive", bucket, slug);
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, `${i}.sql`), `-- source: ${url}\n${sql}\n`);
			written++;
		}
		manifest[page] = { raw, hygienePassed: blocks.length, written: i };
	}

	writeFileSync(
		join(OUT, "manifest.json"),
		JSON.stringify({ bundle: ZIP_NAME, source: `${SITE}/lang.html`, pages: manifest }, null, 1),
	);
	console.log(
		`done: ${pages.length} lang pages, ${rawTotal} raw blocks, ${rawTotal - passed} hygiene-rejected, ` +
			`${passed - written} duplicates dropped, ${written} sql files written`,
	);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
