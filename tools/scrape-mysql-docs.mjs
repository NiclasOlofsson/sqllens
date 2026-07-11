// Extract SQL examples from the official MySQL 8.4 Reference Manual into the corpus repo.
//
// Fetch-then-parse (MySQL ships no HTML bundle — only a PDF, a poor SQL-extraction source). A curated
// set of SQL-statement and function/operator chapter pages is fetched ONCE into a gitignored cache
// (harness/local/mysql-html/<slug>.html), politely and with a UA; a page already cached is never
// re-fetched. The build phase then parses the local cache and is byte-reproducible: it wipes OUT and
// rebuilds every run, so a rerun with the cache warm reproduces the committed corpus exactly, offline.
//
// Where the SQL lives. The manual renders SQL as `<pre class="programlisting ... language-sql">`
// blocks (language-clike = C code, deliberately skipped). Two flavors, both handled:
//   - bare SQL blocks (statement pages: SELECT/INSERT/CREATE TABLE examples), and
//   - `mysql>`-prompt transcripts (function pages: `mysql> SELECT ASCII('2');` then result output).
// A transcript <pre> holds MANY statements; splitTranscript() cuts it into one statement per `mysql>`
// prompt, strips the `mysql>` / continuation (`->`, `'>`, `">`, `` `> ``, `/*>`) prompts, and drops the
// result tables / `N rows in set` / `Query OK` output. Both flavors then pass through cleanSql, whose
// hygiene filters drop metasyntax skeletons (`[ ... ]` optional-clause brackets, `{ | }` choice braces,
// `...` ellipsis, `<placeholder>`), truncated snippets, and leaked prose/result lines. Placeholder
// identifiers (tbl_name, col_name, select_expr) are NOT metasyntax — they are valid identifiers and
// parse fine, so they are kept.
//
// Each file carries a `-- source:` provenance comment (a hidden-channel MySQL comment — parse-invisible).
// Output follows the corpus-repo convention, parser/positive/<kind>/<page-slug>/<n>.sql, bucketed with
// the SAME rule the organizer uses (bucketOfKinds over the current parser's statementCategories; parse
// failures -> unparsed), which is why this scraper runs under tsx: bucketing imports the TS parser.
//
// Usage:  npx tsx tools/scrape-mysql-docs.mjs        (needs src/generated/mysql: npm run gen -- mysql)
//   Env overrides: MYSQL_DOC_VER (manual version in the URL, default 8.4); MYSQL_NO_FETCH=1 forces
//                  build-from-cache-only (fails loudly if a curated page is missing from the cache).

import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { corpusPath } from "./corpus-paths.mjs";

// Pinned MySQL manual release. Bump MYSQL_DOC_VER on a new manual, re-fetch (delete the cache), recommit.
const DOC_VER = process.env.MYSQL_DOC_VER ?? "8.4";
const SITE = `https://dev.mysql.com/doc/refman/${DOC_VER}/en`;
// dev.mysql.com sits behind a WAF that 403s non-browser User-Agents; a browser UA + Accept header is
// required to retrieve the (robots.txt-permitted) /doc/refman/ pages. The fetch is one-time and cached.
const FETCH_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
	Accept: "text/html,application/xhtml+xml",
	"Accept-Language": "en-US,en;q=0.9",
};

const CACHE = corpusPath("harness/local/mysql-html"); // gitignored (corpus .gitignore: harness/local/*-html/)
const OUT = corpusPath("mysql/docs");

// Curated page set: the SQL-statement chapters (SELECT / DML / the CREATE TABLE family) plus the
// function-and-operator chapters — exactly the surface the docs tier is meant to validate. A page that
// 404s is recorded in the manifest and skipped (keeps the list forgiving across manual revisions).
const PAGES = [
	// Query surface
	"select.html",
	"join.html",
	"union.html",
	"parenthesized-query-expressions.html",
	"subqueries.html",
	"comparisons-using-subqueries.html",
	"any-in-some-subqueries.html",
	"all-subqueries.html",
	"exists-and-not-exists-subqueries.html",
	"correlated-subqueries.html",
	"row-subqueries.html",
	"scalar-subqueries.html",
	"derived-tables.html",
	"lateral-derived-tables.html",
	"with.html",
	"values.html",
	"table.html",
	"set-operations.html",
	"intersect.html",
	"except.html",
	// DML
	"insert.html",
	"insert-select.html",
	"insert-on-duplicate.html",
	"update.html",
	"delete.html",
	"replace.html",
	"load-data.html",
	"load-xml.html",
	"do.html",
	"handler.html",
	"import-table.html",
	"truncate-table.html",
	"call.html",
	// DDL that parses
	"create-table.html",
	"create-table-select.html",
	"create-table-like.html",
	"create-view.html",
	"create-index.html",
	"create-temporary-table.html",
	// Expressions / operators
	"expressions.html",
	"operator-precedence.html",
	"comparison-operators.html",
	"logical-operators.html",
	"assignment-operators.html",
	"arithmetic-functions.html",
	"mathematical-functions.html",
	// Functions
	"string-functions.html",
	"string-comparison-functions.html",
	"regexp.html",
	"character-set-functions.html",
	"date-and-time-functions.html",
	"flow-control-functions.html",
	"cast-functions.html",
	"bit-functions.html",
	"encryption-functions.html",
	"information-functions.html",
	"locking-functions.html",
	"miscellaneous-functions.html",
	"aggregate-functions.html",
	"group-by-modifiers.html",
	// JSON
	"json-functions.html",
	"json-creation-functions.html",
	"json-search-functions.html",
	"json-modification-functions.html",
	"json-attribute-functions.html",
	"json-utility-functions.html",
	"json-table-functions.html",
	"json-validation-functions.html",
	// Window functions
	"window-functions.html",
	"window-functions-usage.html",
	"window-function-descriptions.html",
	"window-functions-frames.html",
	"window-functions-named-windows.html",
	// Full-text
	"fulltext-search.html",
	"fulltext-boolean.html",
	"fulltext-natural-language.html",
	"fulltext-query-expansion.html",
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

// First words that can begin a MySQL statement (dev.mysql.com/doc/refman/8.4/en/sql-statements.html),
// plus VALUES / TABLE which begin a query. A block starting with anything else is a clause fragment,
// prose, or metasyntax, not a parse-corpus statement.
const STATEMENT_STARTERS =
	/^(alter|analyze|begin|binlog|cache|call|change|check|checksum|clone|commit|create|deallocate|delete|desc|describe|do|drop|execute|explain|flush|get|grant|handler|help|import|insert|install|kill|load|lock|optimize|prepare|purge|rename|repair|replace|reset|resignal|restart|revoke|rollback|savepoint|select|set|show|shutdown|signal|start|stop|table|truncate|uninstall|unlock|update|use|values|with|xa)\b/i;

// A rendered result-table border line (dashes with a +/| column separator) leaked under a statement.
function isResultBorder(line) {
	return /^[\s\-+=|]+$/.test(line) && /-{3,}/.test(line) && /[+|]/.test(line);
}
// The MySQL client's result footers and the English prose lines the docs put under a statement.
const ROWS_FOOTER =
	/^\s*(\d+ rows? in set|Query OK|Empty set|Records:|Rows matched:|Affected rows:|\d+ rows? affected)/i;
const PROSE_LINE =
	/^\s*(The |This |These |Note:|For example|Here |Output:|Returns? |Result:|Where:|In this|If |When |Suppose |Assume |Compare )/;
// A leaked terse-result arrow line (`        -> 2`) in a block that carries results WITHOUT a `mysql>`
// prompt, so splitTranscript never saw it. `->` at line start is never SQL (the JSON `->`/`->>` operator
// is always inline), so cutting here drops the leaked result and keeps the statement above it.
const RESULT_ARROW = /^\s*->/;

// Remove string / backtick-identifier contents so the metasyntax test below sees only structural
// syntax — a `[` inside a JSON string literal ('$[1]') or a `<` inside a string is not metasyntax.
// Doubled and backslash escapes are consumed; the residue keeps balanced-quote markers only.
function stripStrings(s) {
	return s
		.replace(/'(?:[^'\\]|\\.|'')*'/g, "''")
		.replace(/"(?:[^"\\]|\\.|"")*"/g, '""')
		.replace(/`(?:[^`]|``)*`/g, "``");
}

export function cleanSql(sql) {
	// Docs HTML renders spacing with non-breaking spaces (&nbsp; -> U+00A0); the SQL lexer rejects
	// them, so normalize to a plain space. Strip zero-width space / soft hyphen / BOM too.
	sql = sql.replace(/ /g, " ").replace(/[​­﻿]/g, "");
	const lines = sql.split("\n");
	// Cut at the first result border, client footer, terse-result arrow, or prose line under the statement.
	const cut = lines.findIndex(
		(l, i) => i > 0 && (isResultBorder(l) || ROWS_FOOTER.test(l) || RESULT_ARROW.test(l) || PROSE_LINE.test(l)),
	);
	let kept = (cut === -1 ? lines : lines.slice(0, cut)).join("\n").trim();
	if (kept === "") return null;
	if (/^[[{]/.test(kept)) return null; // JSON output block
	const bare = stripStrings(kept); // structural residue: strings collapsed to balanced markers
	if (/(^|[\s(,])\.\.\.([\s),;]|$)/.test(bare)) return null; // ellipsis placeholder anywhere
	if (/[[\]]/.test(bare)) return null; // `[ ... ]` optional-clause metasyntax (MySQL has no bracket syntax)
	if (/[{}]/.test(bare)) return null; // `{ a | b }` choice-brace metasyntax
	if (/<[a-z_][a-z0-9_-]*>/i.test(bare)) return null; // <placeholder> template, not real SQL
	// A lone quote/backtick surviving stripStrings means a truncated string literal — pseudo-syntax.
	if (/['"`]/.test(bare.replace(/''|""|``/g, ""))) return null;
	// The statement-starter gate must see PAST leading comments: strip leading `--` / `#` lines and
	// `/* */` blocks for the TEST only — the kept text (comments included) is what gets written.
	let head = kept;
	for (;;) {
		const stripped = head.replace(/^\s*(--[^\n]*(\n|$)|#[^\n]*(\n|$)|\/\*[\s\S]*?\*\/)/, "");
		if (stripped === head) break;
		head = stripped;
	}
	head = head.trim();
	if (head === "") return null; // comment-only block
	if (!/^\(+\s*(select|with|values|table)\b/i.test(head) && !STATEMENT_STARTERS.test(head)) return null;
	return kept;
}

// Split a `mysql>`-prompt transcript <pre> into individual statements. A statement opens at a `mysql>`
// line and continues across continuation-prompt lines (`->`, `'>`, `">`, `` `> ``, `/*>`) UNTIL it is
// terminated (`;`, `\G`, or `\g` at end, judged on string-stripped text). Once terminated, following
// lines (terse `-> result`, result tables, `N rows in set`) are output and skipped until the next
// `mysql>`. The trailing `\G` / `\g` display terminator is dropped; a `;` is kept. Unterminated
// (truncated) statements are dropped.
const PROMPT = /^\s*mysql>\s?/;
const CONT = /^\s*(->|'>|">|`>|\/\*>)\s?/;
function isTerminated(stmt) {
	const bare = stripStrings(stmt).trimEnd();
	return /;$/.test(bare) || /\\[gG]$/.test(bare);
}
function splitTranscript(text) {
	const lines = text.split("\n");
	const out = [];
	let i = 0;
	while (i < lines.length) {
		if (!PROMPT.test(lines[i])) {
			i++;
			continue;
		}
		let stmt = lines[i].replace(PROMPT, "");
		i++;
		while (!isTerminated(stmt) && i < lines.length && CONT.test(lines[i])) {
			stmt += "\n" + lines[i].replace(CONT, "");
			i++;
		}
		if (!isTerminated(stmt)) continue; // truncated — drop
		out.push(stmt.replace(/\\[gG]\s*$/, "").trim()); // drop the \G display terminator
	}
	return out;
}

// SQL examples live in `<pre class="programlisting ... language-sql">` blocks. Transcript blocks
// (any `mysql>` line) split into per-statement snippets; bare blocks pass through whole. cleanSql +
// the statement-starter gate keep only runnable statements.
// Returns { blocks, raw }: `raw` counts every candidate <pre> found, so the funnel report can state
// raw -> hygiene-passed honestly.
export function extractSql(html) {
	const blocks = [];
	let raw = 0;
	for (const m of html.matchAll(/<pre class="programlisting[^"]*language-sql[^"]*">([\s\S]*?)<\/pre>/gi)) {
		raw++;
		const text = unescapeHtml(m[1].replace(/<[^>]+>/g, ""));
		const candidates = PROMPT.test(text) ? splitTranscript(text) : [text];
		for (const c of candidates) {
			const sql = cleanSql(c);
			if (sql) blocks.push(sql);
		}
	}
	return { blocks, raw };
}

async function ensureCached() {
	mkdirSync(CACHE, { recursive: true });
	const noFetch = process.env.MYSQL_NO_FETCH === "1";
	for (const page of PAGES) {
		const path = join(CACHE, page);
		if (existsSync(path)) continue;
		if (noFetch) throw new Error(`MYSQL_NO_FETCH=1 but ${page} is not cached`);
		const url = `${SITE}/${page}`;
		// Retry transient blocks (WAF 403 / 5xx) with backoff; a genuine 404 is a permanent absent page
		// (a curated slug that does not exist at this manual version) — stub it so reruns skip it.
		let res;
		for (let attempt = 0; ; attempt++) {
			res = await fetch(url, { headers: FETCH_HEADERS });
			if (res.ok || res.status === 404 || attempt >= 3) break;
			await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
		}
		if (res.ok) {
			writeFileSync(path, await res.text());
		} else if (res.status === 404) {
			writeFileSync(path, `<!-- fetch ${url} -> 404 -->`);
			console.log(`  ${page}: HTTP 404 (absent at ${DOC_VER})`);
		} else {
			throw new Error(`fetch ${url} -> ${res.status} after retries — not cached, aborting`);
		}
		await new Promise((r) => setTimeout(r, 400)); // polite throttle
	}
}

// The corpus-convention bucket for one snippet: parser/positive/<kind> via the SAME rule the organizer
// applies — bucketOfKinds over the current parser's statementCategories; a snippet the parser rejects
// lands in `unparsed`. Pure function of the snippet text + the current grammar, so byte-reproducible.
function makeBucketer({ parseMysql, statementCategories, bucketOfKinds }) {
	return (sql) => {
		let r;
		try {
			r = parseMysql(sql);
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
	// Classification needs the real mysql parser (TypeScript) — hence the tsx usage requirement.
	let classifier;
	try {
		const [{ parseMysql }, { statementCategories }, { bucketOfKinds }] = await Promise.all([
			import("../src/mysql/parse.ts"),
			import("../src/mysql/lower.ts"),
			import("../tests/helpers/statement-bucket.ts"),
		]);
		classifier = makeBucketer({ parseMysql, statementCategories, bucketOfKinds });
	} catch (e) {
		console.error(
			"cannot load the mysql parser for bucketing — run via tsx (npx tsx tools/scrape-mysql-docs.mjs)\n" +
				"and make sure src/generated/mysql exists (npm run gen -- mysql).\n" +
				String(e).slice(0, 200),
		);
		process.exit(1);
	}

	await ensureCached();
	if (existsSync(OUT)) rmSync(OUT, { recursive: true });
	mkdirSync(OUT, { recursive: true });

	const seen = new Set(); // global content dedupe (same example repeated across pages)
	let rawTotal = 0;
	let passed = 0;
	let written = 0;
	const manifest = {};

	for (const page of PAGES) {
		const slug = page.replace(/\.html$/, "");
		const url = `${SITE}/${page}`;
		const cached = readFileSync(join(CACHE, page), "utf8");
		const { blocks, raw } = extractSql(cached);
		rawTotal += raw;
		passed += blocks.length;
		// One file per snippet at parser/positive/<bucket>/<slug>/<n>.sql. `n` counts the page's deduped
		// snippets in document order ACROSS buckets, so a file keeps its number even if a grammar change
		// moves it to another bucket (keeps KNOWN_BAD_DOCS keys traceable).
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
		JSON.stringify({ manual: `MySQL ${DOC_VER} Reference Manual`, source: `${SITE}/`, pages: manifest }, null, 1),
	);
	console.log(
		`done: ${PAGES.length} manual pages, ${rawTotal} raw language-sql blocks, ` +
			`${passed} hygiene-passed snippets, ${passed - written} duplicates dropped, ${written} sql files written`,
	);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
