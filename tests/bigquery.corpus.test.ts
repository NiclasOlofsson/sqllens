import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./helpers/corpus.js";
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
const CORPUS = corpusPath("harness/local/bigquery-zetasql");
const positives = () => readdirSync(join(CORPUS, "positive")).filter((f) => f.endsWith(".sql"));
const negatives = () => readdirSync(join(CORPUS, "negative")).filter((f) => f.endsWith(".sql"));

// Detect-only classification — identical to the parser-corpus gate (bigquery.parser-corpus.test.ts).
// Object DDL (CREATE/ALTER/DROP, incl. …FUNCTION/TABLE/PROCEDURE) and DEFINE MACRO are recognized and
// flagged but not parsed/validated, by cleared scope, so they are out of BOTH gates symmetrically: a
// malformed one we accept is not an over-acceptance bug, and a valid one we don't fully parse is not a
// coverage gap. Keyed on the LEADING KEYWORD only (deliberately not the broad ddl category, which would
// also hide in-scope ANALYZE/TRUNCATE/…). A comment/whitespace-only input is a valid EMPTY SCRIPT under
// our `root` entry but an error under ZetaSQL's single-statement entry — that mode mismatch is also out
// of both gates. Mirrors the parser gate so the two corpora grade identically.
const leadKeyword = (sql: string): string =>
	sql
		.replace(/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*/, "")
		.replace(/^@\{[^}]*\}\s*/, "")
		.match(/^[A-Za-z_]+/)?.[0]
		?.toLowerCase() ?? "";
const isMacro = (sql: string): boolean =>
	/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*(?:@\{[^}]*\}\s*)?DEFINE\s+MACRO\b/i.test(sql);
const isEmptyScript = (sql: string): boolean =>
	sql
		.replace(/--[^\n]*/g, "")
		.replace(/#[^\n]*/g, "")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.trim() === "";
const DETECT_ONLY_LEAD = new Set(["create", "alter", "drop"]); // object DDL — cleared Out
const isDetectOnly = (sql: string): boolean =>
	isMacro(sql) || isEmptyScript(sql) || DETECT_ONLY_LEAD.has(leadKeyword(sql));

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
			const sql = readFileSync(join(CORPUS, "positive", f), "utf8");
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
			const sql = readFileSync(join(CORPUS, "negative", f), "utf8");
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
