// One-shot re-clean of an already-scraped harness/local/snowflake-docs corpus with the
// scraper's cleanSql rules (for corpora scraped before those rules existed). Idempotent.
//
// Usage: node tools/clean-snowflake-docs.mjs

import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanSql } from "./scrape-snowflake-docs.mjs";
import { corpusPath } from "./corpus-paths.mjs";

const OUT = corpusPath("harness/local/snowflake-docs");

function* sqlFiles(dir) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFiles(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}

let cleaned = 0;
let removed = 0;
let kept = 0;
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
