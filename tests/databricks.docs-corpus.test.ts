import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "vitest";
import { parseDatabricks } from "../src/databricks/parse.js";
import { runDocsRatchet } from "./helpers/docs-ratchet.js";

// SQL examples scraped from the Databricks SQL language manual
// (docs.databricks.com/.../sql/language-manual via tools/scrape-databricks-docs.mjs;
// gitignored, ~4,085 files — one statement per file, the Spark `>`-prompt result rows
// stripped). Because the grammar IS the Spark grammar, this validates it against its own
// authoritative reference.
//
// The gate RATCHETS on the in-scope query bucket only; the dml/ddl buckets are reported but
// never gate (object/platform DDL — Unity Catalog CATALOG/SHARE/RECIPIENT/EXTERNAL LOCATION/
// VOLUME/MATERIALIZED VIEW/STREAMING TABLE, plus operational Delta maintenance — is cleared
// Out of scope). Query conformance is 3062/3119 (98.2%). Raise the baseline as fixes land.

const CORPUS = resolve("harness/local/databricks-docs");
const QUERY_BASELINE = 3062;

describe.skipIf(!existsSync(CORPUS))("Databricks grammar vs the scraped SQL language manual", () => {
	it("parses the in-scope query examples (ratchet); reports dml/ddl", { timeout: 600000 }, () => {
		runDocsRatchet(CORPUS, (sql) => parseDatabricks(sql).errors, QUERY_BASELINE);
	});
});
