import { existsSync } from "node:fs";
import { corpusPath } from "../helpers/corpus.js";
import { describe, expect, it } from "vitest";
import { lower } from "../../src/databricks/lower.js";
import { parseDatabricks } from "../../src/databricks/parse.js";
import { resolveScopes } from "../../src/scope/scope.js";
import { KNOWN_BAD, DEFERRED_GRAMMAR, OUT_OF_SCOPE_WRAPPER } from "../databricks-corpus-known-bad.js";
import { probeBody } from "../helpers/body-probe.js";
import { runDocsRatchet } from "../helpers/docs-ratchet.js";
import { runNegativeCorpus } from "../helpers/negative-corpus.js";
import { sweepCallDiagnostics } from "../helpers/call-check.js";

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
// gate stayed parse-only — until Task 12: the call-signature honesty sweep runs HERE too, riding
// the same single parse (lower → resolveScopes → sweepCallDiagnostics per clean query file),
// because this corpus is vendor-doc SQL — exactly where documented implicit-coercion examples like
// substring('hello', '1', 2) live, the zone the operand-type rule can over-fire on. The oatly gate
// (real dbt SQL, schema-free column args → unknown → silent) cannot exercise that zone.

const CORPUS = corpusPath("databricks/docs");
const QUERY_BASELINE = 3099; // documented floor for the query population (raised +11 when issue #4 constructs graduated, 2026-07-02)
// The negative side (issue #5): mutated (rejection-rate ratchet) + curated (100%-reject).
const NEGATIVES = corpusPath("databricks/docs/parser/negative/unparsed");
const MUTATED_FLOOR = 334; // 334/400 mutants rejected (2026-07-02)

describe.skipIf(!existsSync(CORPUS))("Databricks grammar vs the scraped SQL language manual", () => {
	it(
		"parses 100% of in-scope query examples (KNOWN_BAD + issue-#4 gaps excluded); reports dml/ddl; call-diagnostics sweep",
		{ timeout: 600000 },
		() => {
			const throwers: string[] = [];
			const callHits: string[] = []; // Task 12: call-signature diagnostics must be zero over valid SQL
			const bodyEmpty: string[] = []; // body-non-emptiness probe (see tests/helpers/body-probe.ts)
			runDocsRatchet(CORPUS, (sql) => parseDatabricks(sql).errors, QUERY_BASELINE, {
				knownBad: { ...KNOWN_BAD, ...DEFERRED_GRAMMAR, ...OUT_OF_SCOPE_WRAPPER },
				parse: (sql) => {
					const r = parseDatabricks(sql);
					return { errors: r.errors, tree: r.tree };
				},
				onCleanQuery: (rel, tree) => {
					try {
						const ir = lower(tree);
						probeBody(ir, rel, bodyEmpty);
						sweepCallDiagnostics(resolveScopes(ir, "databricks"), rel, callHits);
					} catch (e) {
						throwers.push(`${rel}: ${String(e).slice(0, 140)}`);
					}
				},
			});
			expect(throwers, `pipeline threw on:\n${throwers.slice(0, 20).join("\n")}`).toEqual([]);
			expect(
				callHits,
				`call-signature checker fired on valid SQL (fix the signature table / checker, never exclude):\n${callHits.slice(0, 20).join("\n")}`,
			).toEqual([]);
			expect(
				bodyEmpty,
				`empty, unflagged SelectExpr bodies found:\n${bodyEmpty.slice(0, 20).join("\n")}`,
			).toEqual([]);
		},
	);
});

describe.skipIf(!existsSync(NEGATIVES))("Databricks negative corpus (issue #5)", () => {
	it("curated near-misses 100%-reject; mutated rejection ratchet", { timeout: 600_000 }, () => {
		runNegativeCorpus("databricks", NEGATIVES, (sql) => parseDatabricks(sql).errors, MUTATED_FLOOR);
	});
});
