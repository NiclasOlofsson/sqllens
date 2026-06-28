import { existsSync } from "node:fs";
import { corpusPath } from "./helpers/corpus.js";
import { describe, it } from "vitest";
import { parseDatabricks } from "../src/databricks/parse.js";
import { KNOWN_BAD, DEFERRED_GRAMMAR } from "./databricks-corpus-known-bad.js";
import { runDocsRatchet } from "./helpers/docs-ratchet.js";

// SQL examples scraped from the Databricks SQL language manual
// (docs.databricks.com/.../sql/language-manual via tools/scrape-databricks-docs.mjs; gitignored,
// ~4,070 files — one statement per file, the Spark `>`-prompt and printed-result rows stripped).
// Because the grammar IS the Spark grammar, this validates it against its own authoritative
// reference. The scraper caches raw page HTML, so re-extracting after a stripper change is offline.
//
// The gate requires 100% of the in-scope query bucket; the dml/ddl buckets are reported but never
// gate (object/platform DDL — Unity Catalog CATALOG/SHARE/RECIPIENT/EXTERNAL LOCATION/VOLUME/
// MATERIALIZED VIEW/STREAMING TABLE, plus operational Delta maintenance — is cleared Out of scope).
// Bucketing is the leading-keyword regex (sql-kind.ts): this corpus is one statement per file, so
// the regex is accurate and avoids parsing the out-of-scope DDL bulk. Excluded from the query gate
// (tests/databricks-corpus-known-bad.ts, asserted to still fail): documented-broken examples
// (KNOWN_BAD) and valid SQL the Spark grammar doesn't accept yet (DEFERRED_GRAMMAR, tracked in
// issue #4). Triaged file-by-file 2026-06-13.

const CORPUS = corpusPath("databricks/docs");
const QUERY_BASELINE = 3062; // unused in 100% mode; kept as a documented floor

describe.skipIf(!existsSync(CORPUS))("Databricks grammar vs the scraped SQL language manual", () => {
	it(
		"parses 100% of in-scope query examples (KNOWN_BAD + issue-#4 gaps excluded); reports dml/ddl",
		{ timeout: 600000 },
		() => {
			runDocsRatchet(CORPUS, (sql) => parseDatabricks(sql).errors, QUERY_BASELINE, {
				knownBad: { ...KNOWN_BAD, ...DEFERRED_GRAMMAR },
			});
		},
	);
});
