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

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SITEMAP = "https://docs.databricks.com/aws/en/sitemap.xml";
const OUT = join(import.meta.dirname, "..", "harness", "local", "databricks-docs");
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

/** Cut a non-prompt block at the first printed-result line (docs paste the output under
 *  the statement without a `>` prompt to separate them). Quote-aware: a result-looking
 *  line inside an open single-quoted string (e.g. multi-line JSON passed to VALUES) is
 *  part of the statement, not output, so cutting only happens at the top level. */
function stripTrailingOutput(sql) {
	const lines = sql.split("\n");
	let inStr = false;
	for (let i = 0; i < lines.length; i++) {
		if (i > 0 && !inStr && OUTPUT_LINE.test(lines[i])) {
			return lines.slice(0, i).join("\n").trim();
		}
		const line = lines[i];
		for (let j = 0; j < line.length; j++) {
			if (line[j] !== "'") continue;
			if (line[j + 1] === "'") j++; // doubled '' escape
			else inStr = !inStr;
		}
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

async function main() {
	mkdirSync(OUT, { recursive: true });
	let manifest = {};
	try {
		manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
	} catch {}

	const sitemap = await (await fetch(SITEMAP)).text();
	const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
		.map((m) => m[1])
		.filter((u) => u.includes("/sql/language-manual/"));
	const todo = urls.filter((u) => !(u in manifest));
	console.log(`${urls.length} language-manual pages, ${todo.length} to fetch`);

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
				const res = await fetch(url);
				if (!res.ok) {
					manifest[url] = { status: res.status, blocks: 0 };
					failures++;
				} else {
					const blocks = extractSql(await res.text());
					if (blocks.length) {
						const dir = join(OUT, slug);
						mkdirSync(dir, { recursive: true });
						blocks.forEach((sql, i) => writeFileSync(join(dir, `${i + 1}.sql`), sql + "\n"));
						files += blocks.length;
					}
					manifest[url] = { status: 200, blocks: blocks.length };
				}
			} catch (e) {
				manifest[url] = { status: "error", error: String(e), blocks: 0 };
				failures++;
			}
			fetched++;
			if (fetched % 100 === 0) {
				writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
				console.log(`${fetched}/${todo.length} pages, ${files} sql files, ${failures} failures`);
			}
			await new Promise((r) => setTimeout(r, 250));
		}
	}

	const queue = [...todo]; // one shared queue — workers pop from it
	await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
	writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
	console.log(`done: ${fetched} pages fetched, ${files} sql files written, ${failures} failures`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
