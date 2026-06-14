// Re-clean an already-scraped harness/local/databricks-docs corpus with the scraper's
// cleanSql rules (for corpora scraped before a rule changed). Idempotent.
//
// Usage: node tools/clean-databricks-docs.mjs

import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanSql } from "./scrape-databricks-docs.mjs";
import { corpusPath } from "./corpus-paths.mjs";

const OUT = corpusPath("harness/local/databricks-docs");

function* sqlFiles(dir) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFiles(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}

let kept = 0;
let cleaned = 0;
let removed = 0;
for (const f of sqlFiles(OUT)) {
	const sql = readFileSync(f, "utf8");
	const out = cleanSql(sql);
	if (out === null) {
		unlinkSync(f);
		removed++;
	} else if (out !== sql.trim()) {
		writeFileSync(f, out + "\n");
		cleaned++;
	} else {
		kept++;
	}
}
console.log(`kept ${kept}, truncated ${cleaned}, removed ${removed}`);
