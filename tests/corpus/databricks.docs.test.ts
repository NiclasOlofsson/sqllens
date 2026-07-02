import { existsSync } from "node:fs";
import { corpusPath } from "../helpers/corpus.js";
import { describe, it } from "vitest";
import { parseDatabricks } from "../../src/databricks/parse.js";
import { KNOWN_BAD, DEFERRED_GRAMMAR } from "../databricks-corpus-known-bad.js";
import { runDocsRatchet } from "../helpers/docs-ratchet.js";
import { runNegativeCorpus } from "../helpers/negative-corpus.js";

// SQL examples scraped from the Databricks SQL language manual
// (docs.databricks.com/.../sql/language-manual via tools/scrape-databricks-docs.mjs; gitignored,
// ~4,070 files — one statement per file, the Spark `>`-prompt and printed-result rows stripped).
// Because the grammar IS the Spark grammar, this validates it against its own authoritative
// reference. The scraper caches raw page HTML, so re-extracting after a stripper change is offline.
//
// The gate requires 100% of the in-scope query bucket; the dml/ddl buckets are reported but never
// gate (object/platform DDL — Unity Catalog CATALOG/SHARE/RECIPIENT/EXTERNAL LOCATION/VOLUME/
// MATERIALIZED VIEW/STREAMING TABLE, plus operational Delta maintenance — is cleared Out of scope).
// Bucketing is FROM THE PATH (parser/positive/<kind>/…), placed by the organizer with the current
// parser — the gate parses only the query bucket, never re-classifies. Documented-broken examples
// (KNOWN_BAD) and valid SQL the Spark grammar doesn't accept yet (DEFERRED_GRAMMAR, issue #4) fail to
// parse and sit under unparsed/; the gate asserts they stay there (self-policing). Triaged
// file-by-file 2026-06-13 (tests/databricks-corpus-known-bad.ts).
//
// Single-pass by construction: runDocsRatchet parses each query-bucket file once. The Databricks
// pipeline (lower → scope → symbols) is covered corpus-wide by databricks.oatly.test.ts, so this
// gate stays parse-only.

const CORPUS = corpusPath("databricks/docs");
const QUERY_BASELINE = 3099; // documented floor for the query population (raised +11 when issue #4 constructs graduated, 2026-07-02)
// The negative side (issue #5): mutated (rejection-rate ratchet) + curated (100%-reject).
const NEGATIVES = corpusPath("databricks/docs/parser/negative/unparsed");
const MUTATED_FLOOR = 334; // 334/400 mutants rejected (2026-07-02)

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

describe.skipIf(!existsSync(NEGATIVES))("Databricks negative corpus (issue #5)", () => {
	it("curated near-misses 100%-reject; mutated rejection ratchet", { timeout: 600_000 }, () => {
		runNegativeCorpus("databricks", NEGATIVES, (sql) => parseDatabricks(sql).errors, MUTATED_FLOOR);
	});
});
