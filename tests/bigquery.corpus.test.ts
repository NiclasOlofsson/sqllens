import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./helpers/corpus.js";
import { describe, expect, it } from "vitest";
import { lower } from "../src/bigquery/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { resolveScopes } from "../src/scope/scope.js";
import { isDetectOnly, sqlFiles } from "./helpers/googlesql-scope.js";

// The ZetaSQL .test corpus (gitignored; rebuild with tools/extract-googlesql-tests.mjs).
// Two-sided gate — the project's first: positives must parse (ratchet floor), negatives whose
// expected output is "ERROR: Syntax error" must be rejected (ratchet floor). The positive corpus
// also carries semantically-invalid-but-syntactically-valid cases and a few ZetaSQL-only surfaces
// (pipe `|>`, test-only constructs), so the positive rate is a partial floor that ratchets up as
// grammar gaps close — not 100%.
const CORPUS = corpusPath("bigquery/zetasql/analyzer");
const positives = () => [...sqlFiles(join(CORPUS, "positive"))];
const negatives = () => [...sqlFiles(join(CORPUS, "negative"))];

// Baselines: regression floors over the IN-SCOPE bucket (object DDL / DEFINE MACRO / empty-script are
// detect-only, excluded by isDetectOnly — symmetric with the parser-corpus gate). Corpus is mode-aware
// (type-mode dropped, expression-mode wrapped as SELECT). The extractor classifies out cases that are
// not parse-negatives for us: feature-off / divergence (featureOffExpected — PIPES from-queries, bare
// QUALIFY, dashed names, …), post-parse structural errors ZetaSQL labels "Syntax error" but its bare
// PARSER accepts (isParserAcceptedPostParse — mixed set operations, hint-on-non-first set op), the
// single-statement-mode boundary, and expression-mode query-wrap artifacts — all shared with the parser
// extractor so the two corpora grade identically.
const POSITIVE_BASELINE = 14695; // in-scope positives parsed (14695/14714); the 19 remaining are real
// grammar gaps (pipe AGGREGATE WITH DIFFERENTIAL_PRIVACY, multi-level aggregation `agg(x GROUP BY …)`,
// TVF TABLE/scalar args, WITH POSITION on param-table sources, chained braced call) plus a few mis-
// bucketed ZetaSQL errors — see docs Open Gaps.
const NEGATIVE_BASELINE = 166; // 166/166 in-scope syntax-error negatives rejected — zero accepted

describe.skipIf(!existsSync(CORPUS))("BigQuery vs the ZetaSQL .test corpus", () => {
	it("parses the positive cases (ratchet; DDL detect-only excluded)", { timeout: 600000 }, () => {
		let pass = 0;
		let ddlExcluded = 0;
		const fails: string[] = [];
		for (const f of positives()) {
			const sql = readFileSync(f, "utf8");
			if (isDetectOnly(sql)) {
				ddlExcluded++;
				continue;
			}
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
		console.log(
			`BigQuery positives: ${pass}/${pass + fails.length} (${ddlExcluded} DDL/macro detect-only, excluded)`,
		);
		expect(pass).toBeGreaterThanOrEqual(POSITIVE_BASELINE);
	});

	it("rejects the syntax-error negative cases (ratchet; DDL detect-only excluded)", { timeout: 600000 }, () => {
		let rejected = 0;
		let accepted = 0;
		let ddlExcluded = 0;
		for (const f of negatives()) {
			const sql = readFileSync(f, "utf8");
			if (isDetectOnly(sql)) {
				ddlExcluded++;
				continue;
			}
			let errs = 0;
			try {
				errs = parseBigQuery(sql).errors;
			} catch {
				errs = 1;
			}
			if (errs > 0) rejected++;
			else accepted++;
		}
		// eslint-disable-next-line no-console
		console.log(
			`BigQuery negatives rejected: ${rejected}/${rejected + accepted} (${ddlExcluded} DDL/macro detect-only, excluded)`,
		);
		expect(rejected).toBeGreaterThanOrEqual(NEGATIVE_BASELINE);
	});

	it("lower + resolveScopes never throw on a parsed positive case", { timeout: 600000 }, () => {
		const throws: string[] = [];
		for (const f of positives()) {
			const sql = readFileSync(f, "utf8");
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
