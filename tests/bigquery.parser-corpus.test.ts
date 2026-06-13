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

// Baselines: regression floors. Raise as gaps close; the goal is positives at a hard 100% and the
// negative bucket reduced to genuine syntax errors we reject.
//
// The extractor (tools/extract-googlesql-parser-tests.mjs) is now FEATURE-AWARE. ZetaSQL's parser is
// feature-gated — a `[language_features=…]` directive turns LanguageFeatures on/off and a syntax that
// needs a disabled feature reports a *Syntax error*. Our parser is a permissive superset (every
// feature we implement is permanently ON), so a case that errors only because a feature WE implement
// is disabled is one we correctly accept — not a valid negative for us. The extractor grades each case
// by the alternation group matching our IMPLEMENTED feature set (all on) instead of the test's default
// (usually feature-off) group, and drops feature-off negatives that have a positive twin. The same
// change also fixed a latent bug where every `ALTERNATION GROUPS:` (plural) block was mis-graded as a
// single positive — those are now graded per config, which reclassified ~70 false-positives into real
// negatives (so the negative total rose; this is the corpus getting more honest, not a regression).
//
// Measured 2026-06-13 on the feature-aware corpus: positives 3364/3603 (93.4%), negatives rejected
// 2153/2522 (85.4%). The ~369 negatives we still accept are GENUINE over-acceptance (grammar too
// loose: incomplete statements, method-call on a numeric literal, FOR UPDATE inside a view, malformed
// graph edges) plus features we deliberately don't implement (dashed/slashed paths) — to be driven
// down by tightening the grammar, NOT by exclusion. Only without-a-doubt feature-off cases are excluded.
const POSITIVE_BASELINE = 3370; // 3370/3603 (93.5%)
const NEGATIVE_BASELINE = 2225; // 2225/2522 (88.2%) — table-path/GROUP BY + comparison non-associativity

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
