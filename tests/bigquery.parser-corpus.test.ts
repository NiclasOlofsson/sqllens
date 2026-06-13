import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lower } from "../src/bigquery/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { resolveScopes } from "../src/scope/scope.js";

// The ZetaSQL PARSER .test corpus (gitignored; rebuild with tools/extract-googlesql-parser-tests.mjs,
// needs `git -C vendor/googlesql sparse-checkout add googlesql/parser/testdata`). This is a second,
// stricter two-sided gate alongside bigquery.corpus.test.ts (the analyzer corpus). The parser
// testdata is pure syntax — every positive is parseable by construction and every negative is a
// *true* parser syntax error — so it is a cleaner conformance signal than the analyzer corpus.
//
// It is still a ratchet, not 100%, for two reasons: (1) our parser implements the full GoogleSQL
// feature superset (all language_features on), so it legitimately accepts feature-OFF negatives — a
// "syntax error" only because PIPES/SQL_GRAPH/etc. is disabled — and a handful of ZetaSQL hand-parser
// errors an ANTLR grammar doesn't reproduce (custom "STRICT cannot be used with outer mode" style
// productions, some unclosed-literal lexer messages); (2) the positive bucket carries a few
// parser-emitted "… is not supported" structures our grammar doesn't model. Raise both floors as the
// grammar closes gaps.
const CORPUS = resolve("harness/local/bigquery-zetasql-parser");
const positives = () => readdirSync(join(CORPUS, "positive")).filter((f) => f.endsWith(".sql"));
const negatives = () => readdirSync(join(CORPUS, "negative")).filter((f) => f.endsWith(".sql"));

// Baselines: regression floors (measured 2026-06-13 against grammar @30f18e8). Raise as gaps close.
// At baseline: positives 3200/3740 (85.6%), negatives rejected 2135/2473 (86.3%). The stricter
// parser corpus scores well below the analyzer corpus's 99.2% — it exposes real grammar gaps and
// over-acceptance (e.g. STRICT-with-outer-mode) the analyzer corpus masks.
// Corpus is now mode-aware (type-mode dropped, expression-mode wrapped); totals shifted from the
// first extraction. Raised after top-level scripting, quantified comparisons, graph composite
// outer-mode, and reserved-keyword field access landed.
const POSITIVE_BASELINE = 3395; // 3395/3679 (92.3%)
// 2108/2451. The drop from the first extraction's 2135/2473 is: ~22 negatives removed by
// mode-handling (can't reject what's gone) + the superset accepting feature-OFF negatives + a
// handful of hand-parser validations a CFG can't reproduce (graph edge-delimiter whitespace
// adjacency, numeric dot-path components needing a DOT_IDENTIFIER lexer mode). Not a masked
// regression — the one script-exposed case (bare top-level RAISE;) is parser-conformant.
const NEGATIVE_BASELINE = 2108;

describe.skipIf(!existsSync(CORPUS))("BigQuery vs the ZetaSQL parser .test corpus", () => {
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
		console.log(`BigQuery parser-corpus positives: ${pass}/${positives().length}`);
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
		console.log(`BigQuery parser-corpus negatives rejected: ${rejected}/${negatives().length}`);
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
