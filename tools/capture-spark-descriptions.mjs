// Capture per-function one-line DESCRIPTIONS for the databricks dialect from Apache Spark's
// generated "Built-in Functions" SQL API page into a committed tier at
// databricks/docs/descriptions.json. Databricks's own docs publish no redistribution license, so
// their prose is off limits — but Databricks SQL is Spark SQL, and Spark's page is generated from
// the engine's @ExpressionDescription usage strings (Apache-2.0): name-keyed, one usage line per
// function ("abs(expr) - Returns the absolute value of the numeric or interval value."). Entries
// land in the fn-docs table as origin "spark-docs" — honest about the lineage: Spark-authored
// prose describing the shared surface, linked to the Databricks page by docUrl. Databricks-only
// functions are simply absent here (the authored layer covers them).
//
// MARKUP, verified against the live 4.0.1 page (2026-07-15): one `<h3 id="name">` per function,
// followed by `<p>usage - description...</p>`; operators appear as their symbol ids and drop out
// naturally when joined against the signature table's keys.
//
// Self-contained by design (repo convention — shares no code with the other scrapers).
// Usage: node tools/capture-spark-descriptions.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./corpus-paths.mjs";

const SPARK_VER = process.env.SPARK_DOC_VER ?? "4.0.1";
const URL = `https://spark.apache.org/docs/${SPARK_VER}/api/sql/index.html`;
const CACHE_DIR = corpusPath("harness/local/spark-html");
const CACHE = join(CACHE_DIR, `spark-${SPARK_VER}-sql-api.html`);
const OUT = corpusPath("databricks/docs/descriptions.json");

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

async function ensurePage() {
	if (existsSync(CACHE)) return readFileSync(CACHE, "utf8");
	console.log(`cache miss — fetching ${URL} ...`);
	const res = await fetch(URL);
	if (!res.ok) throw new Error(`fetch ${URL} -> ${res.status}`);
	const html = await res.text();
	mkdirSync(CACHE_DIR, { recursive: true });
	writeFileSync(CACHE, html);
	return html;
}

async function main() {
	const html = await ensurePage();
	const descriptions = new Map();
	const re = /<h3 id="([^"]+)">[\s\S]*?<\/h3>\s*<p>([\s\S]*?)<\/p>/g;
	for (const m of html.matchAll(re)) {
		const name = unescapeHtml(m[1]).toLowerCase();
		if (!/^[a-z_][a-z0-9_]*$/.test(name)) continue; // operator symbol ids — not function names
		const usage = stripTags(m[2]);
		// "name(args) - Returns ..." → the prose after the first " - "; a usage line without the
		// separator carries no description (skip, absent beats wrong).
		const sep = usage.indexOf(" - ");
		if (sep === -1) continue;
		const desc = firstSentenceOf(usage.slice(sep + 3));
		if (desc && !descriptions.has(name)) descriptions.set(name, desc);
	}
	const out = {
		source: URL,
		license: "Apache-2.0 (generated from Apache Spark's @ExpressionDescription usage strings)",
		sparkVersion: SPARK_VER,
		descriptions: Object.fromEntries([...descriptions.entries()].sort(([a], [b]) => a.localeCompare(b))),
	};
	writeFileSync(OUT, JSON.stringify(out, null, 1));
	console.log(`done: ${descriptions.size} descriptions -> ${OUT}`);
}

await main();
