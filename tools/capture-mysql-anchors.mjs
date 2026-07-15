// Capture per-function ANCHORS from the already-cached MySQL 8.4 refman HTML into a committed
// tier at mysql/docs/anchors.json — the deep-link companion of the syntax tier (re-run after
// tools/scrape-mysql-docs.mjs refreshes the cache). The refman marks every function's reference
// entry with a stable `<a name="function_<name>">` anchor in the page HTML (verified against the
// live cache, 2026-07-15: name="function_abs" on mathematical-functions.html, ...); the anchor is
// reproduced verbatim, so the emitted deep link is correct by construction for the manual version
// the cache mirrors. Only the anchor id is captured — no documentation prose (Oracle's manual
// permits no reproduction; links are facts).
//
// Self-contained by design (repo convention — shares no code with the other scrapers).
// Usage: node tools/capture-mysql-anchors.mjs

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./corpus-paths.mjs";

const CACHE = corpusPath("harness/local/mysql-html");
const OUT = corpusPath("mysql/docs/anchors.json");

function main() {
	if (!existsSync(CACHE)) {
		console.error(`missing ${CACHE} — run tools/scrape-mysql-docs.mjs first`);
		process.exitCode = 1;
		return;
	}
	const anchors = new Map();
	const pages = readdirSync(CACHE).filter((f) => f.endsWith(".html"));
	for (const page of pages.sort()) {
		const html = readFileSync(join(CACHE, page), "utf8");
		// The refman anchor spells a function name's underscores as hyphens
		// (name="function_from-base64" for FROM_BASE64); the map key converts back.
		for (const m of html.matchAll(/<a name="function_([a-z0-9-]+)">/g)) {
			const name = m[1].toLowerCase().replace(/-/g, "_");
			if (!anchors.has(name)) anchors.set(name, `${page}#function_${m[1]}`);
		}
	}
	const out = {
		source: "https://dev.mysql.com/doc/refman/8.4/en/",
		note: "name -> page.html#anchor, reproduced verbatim from the cached refman HTML's own <a name> tags",
		anchors: Object.fromEntries([...anchors.entries()].sort(([a], [b]) => a.localeCompare(b))),
	};
	writeFileSync(OUT, JSON.stringify(out, null, 1));
	console.log(`done: ${anchors.size} anchors from ${pages.length} pages -> ${OUT}`);
}

main();
