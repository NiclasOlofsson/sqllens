import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBigQuery } from "../src/bigquery/parse.js";

// The ZetaSQL .test corpus (gitignored; rebuild with tools/extract-googlesql-tests.mjs).
// Two-sided gate — the project's first: positives must parse (ratchet floor), negatives whose
// expected output is "ERROR: Syntax error" must be rejected (ratchet floor). The positive corpus
// also carries semantically-invalid-but-syntactically-valid cases and a few ZetaSQL-only surfaces
// (pipe `|>`, test-only constructs), so the positive rate is a partial floor that ratchets up as
// grammar gaps close — not 100%.
const CORPUS = resolve("harness/local/bigquery-zetasql");
const positives = () => readdirSync(join(CORPUS, "positive")).filter((f) => f.endsWith(".sql"));
const negatives = () => readdirSync(join(CORPUS, "negative")).filter((f) => f.endsWith(".sql"));

// Baselines: regression floors measured from the first green run. Raise as grammar gaps close.
const POSITIVE_BASELINE = 10821; // first green run: 10821/17465; ratchet up as gaps close
const NEGATIVE_BASELINE = 171; // first green run: 171/222 syntax-error cases rejected

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
});
