import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lower } from "../src/bigquery/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { resolveScopes } from "../src/scope/scope.js";

// The ZetaSQL .test corpus (gitignored; rebuild with tools/extract-googlesql-tests.mjs).
// Two-sided gate — the project's first: positives must parse (ratchet floor), negatives whose
// expected output is "ERROR: Syntax error" must be rejected (ratchet floor). The positive corpus
// also carries semantically-invalid-but-syntactically-valid cases and a few ZetaSQL-only surfaces
// (pipe `|>`, test-only constructs), so the positive rate is a partial floor that ratchets up as
// grammar gaps close — not 100%.
const CORPUS = resolve("harness/local/bigquery-zetasql");
const positives = () => readdirSync(join(CORPUS, "positive")).filter((f) => f.endsWith(".sql"));
const negatives = () => readdirSync(join(CORPUS, "negative")).filter((f) => f.endsWith(".sql"));

// Baselines: regression floors. Raise as grammar gaps close. Corpus is mode-aware (type-mode
// blocks dropped, expression-mode wrapped as SELECT) so totals differ from the first extraction.
const POSITIVE_BASELINE = 17128; // 17128/17272 (99.2%); the ~144 remaining are ZetaSQL errors
// mis-bucketed as positive (empty `SELECT FROM`, `*_errors` cases), SQLBuilder round-trip DDL
// artifacts, and a few niche DDL/ordering edges — see docs Open Gaps.
// The parser implements the full GoogleSQL feature superset (all language_features on), so it
// legitimately accepts the corpus's feature-OFF negatives — SQL that is a "syntax error" only
// because a feature (PIPES, …) is disabled — plus a few parser-vs-analyzer cases (mixed set-ops,
// edge TVF forms). The floor below is the achievable rejection count, not the total.
const NEGATIVE_BASELINE = 211; // 211/273 true syntax-error cases rejected

describe.skipIf(!existsSync(CORPUS))("BigQuery vs the ZetaSQL .test corpus", () => {
	it("parses the positive cases (ratchet)", { timeout: 600000 }, () => {
		let pass = 0;
		const fails: string[] = [];
		for (const f of positives()) {
			const sql = readFileSync(join(CORPUS, "positive", f), "utf8");
			let errs = 1;
			try {
				errs = parseBigQuery(sql).errors;
			} catch {
				errs = -1;
			}
			if (errs === 0) pass++;
			else fails.push(f);
		}
		// eslint-disable-next-line no-console
		console.log(`BigQuery positives: ${pass}/${positives().length}`);
		expect(pass).toBeGreaterThanOrEqual(POSITIVE_BASELINE);
	});

	it("rejects the syntax-error negative cases (ratchet)", { timeout: 600000 }, () => {
		let rejected = 0;
		for (const f of negatives()) {
			const sql = readFileSync(join(CORPUS, "negative", f), "utf8");
			let errs = 0;
			try {
				errs = parseBigQuery(sql).errors;
			} catch {
				errs = 1;
			}
			if (errs > 0) rejected++;
		}
		// eslint-disable-next-line no-console
		console.log(`BigQuery negatives rejected: ${rejected}/${negatives().length}`);
		expect(rejected).toBeGreaterThanOrEqual(NEGATIVE_BASELINE);
	});

	it("lower + resolveScopes never throw on a parsed positive case", { timeout: 600000 }, () => {
		const throws: string[] = [];
		for (const f of positives()) {
			const sql = readFileSync(join(CORPUS, "positive", f), "utf8");
			let res;
			try {
				res = parseBigQuery(sql);
			} catch {
				continue; // parse-stage failures are counted by the ratchet, not here
			}
			if (res.errors !== 0) continue; // only fully-parsed cases must lower cleanly
			try {
				resolveScopes(lower(res.tree), "bigquery");
			} catch (e) {
				throws.push(`${f}: ${(e as Error).message}`);
			}
		}
		expect(throws, `lower/resolveScopes threw on:\n${throws.slice(0, 20).join("\n")}`).toEqual([]);
	});
});
