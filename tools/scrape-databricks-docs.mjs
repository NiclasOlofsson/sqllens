// Scrape SQL examples from the Databricks SQL language manual into harness/local/databricks-docs/.
//
// Pages are enumerated from the sitemap (no crawling); examples are the Prism
// `language-sql` code blocks in the static HTML. Databricks (like Spark) renders
// function/example blocks with the `>`-prompt convention — `> SELECT …;` is the
// statement, the unprefixed lines after it are the printed result — so prompt blocks
// are split into their `>`-statements and the result rows dropped. Blocks with no
// prompt (syntax pages) are taken whole.
//
// The corpus is docs-derived, so the output directory is gitignored (like the Oatly /
// Snowflake / T-SQL corpora); this script rebuilds it. Resumable via manifest.json.
//
// Usage: node tools/scrape-databricks-docs.mjs
//
// Raw page HTML is cached under HTML_CACHE; a re-run re-extracts the .sql from the cache OFFLINE
// (only genuinely-new pages are fetched). So after changing the SQL extraction (stripTrailingOutput
// &c.), regenerate with `rm -rf harness/local/databricks-docs && node tools/scrape-databricks-docs.mjs`
// — it rebuilds from cached HTML with no network. Delete HTML_CACHE to force a full re-fetch.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { corpusPath } from "./corpus-paths.mjs";

const SITEMAP = "https://docs.databricks.com/aws/en/sitemap.xml";
const OUT = corpusPath("harness/local/databricks-docs");
const HTML_CACHE = corpusPath("harness/local/databricks-docs-html");
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

// First words that can begin a Databricks/Spark SQL statement — a block starting with
// anything else is an output row or a clause fragment, not a parse-corpus statement.
const STATEMENT_STARTERS =
	/^(alter|analyze|cache|clear|comment|commit|copy|create|deny|describe|desc|drop|explain|export|grant|insert|list|load|merge|msck|optimize|reduce|refresh|reorg|repair|replace|reset|restore|revoke|rollback|select|set|show|truncate|uncache|update|use|values|vacuum|with|\()/i;

/** Reconstruct the source lines of one Prism `<pre language-sql>` block. */
function preToLines(pre) {
	return pre
		.split(/<span class=token-line/)
		.slice(1)
		.map((chunk) =>
			unescapeHtml(
				chunk
					.replace(/^[^>]*>/, "") // drop the rest of the token-line opening tag
					.replace(/<[^>]+>/g, ""), // strip inner token spans
			),
		);
}

/** Split a `>`-prompt example into its statements (drop result rows); accumulate
 *  continuation lines until a `;` terminates the statement. */
function splitPromptStatements(lines) {
	const out = [];
	let buf = null;
	for (const line of lines) {
		const m = line.match(/^\s*>\s?(.*)$/);
		if (m) {
			if (buf !== null) out.push(buf.trim());
			buf = m[1];
		} else if (buf !== null) {
			// Continuation only while the statement is unterminated; after `;` the rest is output.
			if (/;\s*$/.test(buf)) {
				out.push(buf.trim());
				buf = null;
			} else if (line.trim() !== "") {
				buf += "\n" + line;
			}
		}
	}
	if (buf !== null) out.push(buf.trim());
	return out.filter((s) => s !== "");
}

// A printed result row in a non-prompt example block (no `>` to mark input vs output):
// a JSON/array result, a binary/obfuscated marker, or a bare scalar value on its own line.
const OUTPUT_LINE =
	/^\s*(\[|\{|[+|]-{2,}|[0-9.]+\s*$|-?[0-9.]+\s+\S|\d{4}-\d{1,2}-\d{1,2}([ T]|\s*$)|NULL\s*$|true\s*$|false\s*$|\[(binary data|obfuscated)\])/i;

// Result rows the structured patterns above miss: a tabular row (≥2 spaces between two
// non-space tokens), a bare dash/equals separator, or an error / warning / summary banner.
// Only consulted for a line that is NOT a SQL continuation (see CONTINUATION_LINE), so a SELECT
// list with internal alignment spacing is never mistaken for a tabular result.
const OUTPUT_SHAPE = /\S {2,}\S|^\s*[-=—]{3,}\s*$|^\s*(ERROR\b|Error:|\[?WARN|#{2,}\s)/;

// The accumulated statement is NOT complete (so the next line is still SQL) if it ends with a
// token that demands a continuation: an operator/comma/open-bracket/dot, or a clause keyword.
const WANTS_MORE_TAIL =
	/([,([{.|&^~]|[-+*/%=<>:])\s*$|\b(AND|OR|NOT|SELECT|FROM|WHERE|GROUP|ORDER|BY|HAVING|JOIN|ON|USING|UNION|INTERSECT|EXCEPT|ALL|AS|WITH|RECURSIVE|VALUES|IN|LIKE|BETWEEN|CASE|WHEN|THEN|ELSE|OVER|PARTITION|QUALIFY|WINDOW|LATERAL|DISTRIBUTE|CLUSTER|SORT|LIMIT|OFFSET|INTO|SET|PIVOT|UNPIVOT|ROWS|RANGE|PRECEDING|FOLLOWING|UNBOUNDED|CURRENT)\s*$/i;

// A line that continues a SQL statement rather than starting printed output: leading punctuation
// (open/close bracket, dot, comma, pipe, operator), a comment, or ANY word that begins a SQL
// statement or clause. Printed result rows are data values, which essentially never lead with a
// reserved keyword — so a keyword-led line is kept, and only non-keyword data lines are cut.
const CONTINUATION_LINE =
	/^\s*(--|\/\*|\*\/|[([)\].,|]|[-+*/%=<>]|\|>|(SELECT|FROM|WHERE|GROUP|ORDER|HAVING|LIMIT|OFFSET|JOIN|INNER|LEFT|RIGHT|FULL|CROSS|OUTER|NATURAL|ANTI|SEMI|ON|USING|UNION|INTERSECT|EXCEPT|MINUS|QUALIFY|WINDOW|PIVOT|UNPIVOT|LATERAL|CLUSTER|DISTRIBUTE|SORT|AS|WITH|RECURSIVE|VALUES|AND|OR|NOT|WHEN|THEN|ELSE|END|CASE|TABLESAMPLE|ROWS|RANGE|BETWEEN|PRECEDING|FOLLOWING|UNBOUNDED|CURRENT|INTO|INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|REPLACE|SET|SHOW|DESCRIBE|DESC|EXPLAIN|USE|GRANT|REVOKE|DENY|CACHE|UNCACHE|REFRESH|ANALYZE|OPTIMIZE|VACUUM|COPY|LOAD|MSCK|REORG|RESTORE|COMMENT|DECLARE|FOR|IN|BY|OVER|PARTITION|FILTER|DISTINCT|ALL|MAP|REDUCE|TABLE|LIKE|IS|NULL|FETCH|FIRST|NEXT|TOP)\b)/i;

/** Strip the trailing `--` line comment and trailing whitespace from a source line, ignoring a
 *  `--` that sits inside a single-quoted string. */
function stripLineComment(line) {
	let inStr = false;
	for (let j = 0; j < line.length; j++) {
		if (inStr && line[j] === "\\")
			j++; // backslash escape inside a string
		else if (line[j] === "'") {
			if (line[j + 1] === "'") j++;
			else inStr = !inStr;
		} else if (!inStr && line[j] === "-" && line[j + 1] === "-") {
			return line.slice(0, j);
		}
	}
	return line;
}

/** Cut a non-prompt block at the first printed-result line (docs paste the output under the
 *  statement without a `>` prompt to separate them). A line is output only at the TOP LEVEL —
 *  not inside a single-quoted string and not inside open brackets — and only once the statement
 *  so far already looks complete (balanced brackets guaranteed by the top-level check, and not
 *  ending on a token that wants more). Then it's output if it matches a result pattern
 *  (OUTPUT_LINE / OUTPUT_SHAPE) or is simply not a SQL continuation (catches string / word /
 *  scalar results the patterns miss). Paren- and comment-aware so multi-line SQL — `OVER (…
 *  ORDER BY x`, `WITH RECURSIVE`, `SELECT -- note` — is never cut mid-statement. */
function stripTrailingOutput(sql) {
	const lines = sql.split("\n");
	let inStr = false;
	let depth = 0;
	let lastTail = ""; // last non-empty accumulated line, comment-stripped
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (
			i > 0 &&
			!inStr &&
			depth === 0 &&
			line.trim() !== "" &&
			lastTail !== "" &&
			!WANTS_MORE_TAIL.test(lastTail)
		) {
			// CONTINUATION_LINE is a hard gate — a keyword- or punctuation-led line is SQL and is
			// never cut (so a SELECT list with internal alignment spacing isn't mistaken for a
			// tabular result). A line is output only if it is a structured result (OUTPUT_LINE) or
			// a bare separator — both of which can start with a "continuation" char — or it simply
			// isn't a continuation at all (bare scalar / tabular data row).
			const isOutput = OUTPUT_LINE.test(line) || /^\s*[-=—]{3,}\s*$/.test(line) || !CONTINUATION_LINE.test(line);
			if (isOutput) return lines.slice(0, i).join("\n").trim();
		}
		// Advance inStr / bracket depth across this line (top level only), stopping at a `--`.
		for (let j = 0; j < line.length; j++) {
			const c = line[j];
			if (inStr) {
				if (c === "\\")
					j++; // backslash escape inside a string
				else if (c === "'") {
					if (line[j + 1] === "'") j++;
					else inStr = false;
				}
				continue;
			}
			if (c === "'") inStr = true;
			else if (c === "-" && line[j + 1] === "-")
				break; // rest of line is a comment
			else if (c === "(" || c === "[" || c === "{") depth++;
			else if (c === ")" || c === "]" || c === "}") depth = Math.max(0, depth - 1);
		}
		const tail = stripLineComment(line).trim();
		if (tail !== "") lastTail = tail;
	}
	return sql.trim();
}

export function cleanSql(sql) {
	const kept = stripTrailingOutput(sql.trim());
	if (kept === "") return null;
	if (/<[a-z_][a-z0-9_]*>/i.test(kept)) return null; // <placeholder> template
	if (/\$\{/.test(kept)) return null; // ${param} notebook-widget template, not standalone SQL
	if (/(^|[\s(,])\.\.\.([\s),;]|$)/.test(kept)) return null; // ellipsis placeholder
	if (!STATEMENT_STARTERS.test(kept)) return null; // output row / fragment
	return kept;
}

export function extractSql(html) {
	const blocks = [];
	for (const m of html.matchAll(/<pre[^>]*prism-code language-sql[\s\S]*?<\/pre>/g)) {
		const lines = preToLines(m[0]);
		const hasPrompt = lines.some((l) => /^\s*>/.test(l));
		const statements = hasPrompt ? splitPromptStatements(lines) : [lines.join("\n")];
		for (const s of statements) {
			const c = cleanSql(s);
			if (c) blocks.push(c);
		}
	}
	// Dedupe within a page (the same example often appears in multiple code blocks).
	return [...new Set(blocks)];
}

/** Cache filename for a page URL — its language-manual slug, flattened. */
function htmlKey(url) {
	return `${url
		.replace(/^https:\/\/docs\.databricks\.com\/aws\/en\/sql\/language-manual\//, "")
		.replace(/\/$/, "")
		.replace(/[^a-z0-9_-]/gi, "_")}.html`;
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
		.filter((u) => u.includes("/sql/language-manual/"));
	// Every page is (re)processed each run; pages whose HTML is already cached extract offline,
	// only uncached ones are fetched.
	const toFetch = urls.filter((u) => !existsSync(join(HTML_CACHE, htmlKey(u)))).length;
	console.log(`${urls.length} language-manual pages, ${toFetch} to fetch (rest from HTML cache)`);

	let processed = 0;
	let fetched = 0;
	let files = 0;
	let failures = 0;

	async function worker(queue) {
		for (;;) {
			const url = queue.pop();
			if (!url) return;
			const slug = url
				.replace(/^https:\/\/docs\.databricks\.com\/aws\/en\/sql\/language-manual\//, "")
				.replace(/\/$/, "")
				.replace(/[^a-z0-9_/-]/gi, "_");
			try {
				const cacheFile = join(HTML_CACHE, htmlKey(url));
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
				const blocks = extractSql(html);
				if (blocks.length) {
					const dir = join(OUT, slug);
					mkdirSync(dir, { recursive: true });
					blocks.forEach((sql, i) => writeFileSync(join(dir, `${i + 1}.sql`), sql + "\n"));
					files += blocks.length;
				}
				manifest[url] = { status: 200, blocks: blocks.length };
			} catch (e) {
				manifest[url] = { status: "error", error: String(e), blocks: 0 };
				failures++;
			}
			processed++;
			if (processed % 200 === 0) {
				writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
				console.log(
					`${processed}/${urls.length} pages, ${files} sql files, ${fetched} fetched, ${failures} failures`,
				);
			}
		}
	}

	const queue = [...urls]; // one shared queue — workers pop from it
	await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
	writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
	console.log(`done: ${processed} pages, ${files} sql files written, ${fetched} fetched, ${failures} failures`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
