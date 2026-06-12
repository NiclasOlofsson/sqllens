import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDatabricks } from "../src/databricks/parse.js";

// SQL examples scraped from the Databricks SQL language manual
// (docs.databricks.com/.../sql/language-manual via tools/scrape-databricks-docs.mjs;
// gitignored, ~4,085 files — one statement per file, the Spark `>`-prompt result rows
// stripped). Because the grammar IS the Spark grammar, this validates it against its own
// authoritative reference. Ratchet: the pass count must never drop below the baseline.
//
// The shortfall is object/platform DDL that is cleared OUT of scope (Unity Catalog object
// management — CREATE/ALTER CATALOG, SHARE, RECIPIENT, EXTERNAL LOCATION, VOLUME, GOVERNED
// TAG, MATERIALIZED VIEW / STREAMING TABLE) plus the operational Delta-maintenance gaps
// (OPTIMIZE, REORG, VACUUM) tracked as open gaps. The query language parses cleanly.
// Raise the baseline as fixes land.

const CORPUS = resolve("harness/local/databricks-docs");
const DOCS_BASELINE = 3699;

function* sqlFiles(dir: string): Generator<string> {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFiles(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}

describe.skipIf(!existsSync(CORPUS))("Databricks grammar vs the scraped SQL language manual", () => {
	it(`parses at least ${DOCS_BASELINE} docs examples (ratchet)`, { timeout: 600000 }, () => {
		let pass = 0;
		let total = 0;
		for (const f of sqlFiles(CORPUS)) {
			total++;
			let errs = 1;
			try {
				errs = parseDatabricks(readFileSync(f, "utf8")).errors;
			} catch {
				errs = -1;
			}
			if (errs === 0) pass++;
		}
		expect(pass, `docs-corpus pass count dropped: ${pass}/${total} (baseline ${DOCS_BASELINE})`).toBeGreaterThanOrEqual(
			DOCS_BASELINE,
		);
	});
});
