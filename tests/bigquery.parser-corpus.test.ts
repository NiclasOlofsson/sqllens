import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lower } from "../src/bigquery/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { keywordCategory } from "../src/ir/statement.js";
import { resolveScopes } from "../src/scope/scope.js";

// Is this negative a DDL statement? DDL is DETECT-ONLY in this project — the parser recognizes and
// flags object DDL (CREATE/ALTER/DROP/PROCEDURE/…) but does not VALIDATE its arity/params/parens, by
// cleared scope. So a malformed DDL we accept is by design, not an over-acceptance bug, and is excluded
// from the must-reject gate (tagged "DDL-validation out of scope"). Keyed off the parser's OWN
// recognition: lower().statement === "ddl" for cases we parse; a leading-keyword fallback for cases we
// reject (which can't be lowered). This is the same disciplined, per-case exclusion as the feature-off
// cases — every excluded negative is individually classified, not a blanket drop of the bucket.
const ddlLeadKeyword = (sql: string): string =>
	sql.replace(/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*/, "").match(/^[A-Za-z_]+/)?.[0] ?? "";
function isDdlNegative(sql: string, errors: number, tree: unknown): boolean {
	if (errors === 0) {
		try {
			return lower(tree as never).statement === "ddl";
		} catch {
			return false;
		}
	}
	return keywordCategory(ddlLeadKeyword(sql)) === "ddl";
}

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
// The negative gate measures only IN-SCOPE over-acceptance — the malformed SQL we actually intend to
// reject. Two disciplined, per-case exclusions narrow the corpus to that:
//   1. Feature-off (in the extractor): a case that errors only because a feature WE implement is
//      disabled is one we correctly accept as a permissive superset — not a valid negative for us.
//   2. DDL detect-only (here, see isDdlNegative): object DDL is recognized and flagged but not
//      validated, by cleared scope, so malformed-DDL arity/param/paren forms are out of the gate.
// Both are per-case, not blanket drops. What remains in the in-scope bucket is genuine over-acceptance
// (numeric-literal method calls, set-op CORRESPONDING edges, `1 > > 2`, WITH ANONYMIZATION, …) to be
// driven down by tightening the grammar.
//
// Measured 2026-06-13: positives 3370/3603 (93.5%). Negatives: 494 DDL excluded (detect-only); of the
// 2028 in-scope negatives we reject 1821 and still wrongly accept 207. The in-scope floor ratchets up
// as the grammar tightens. The earlier feature-aware extractor rewrite (grading each case by our
// IMPLEMENTED feature set; fixing the plural ALTERNATION GROUPS mis-grading) set the corpus shape.
const POSITIVE_BASELINE = 3370; // 3370/3603 (93.5%)
const IN_SCOPE_NEGATIVE_BASELINE = 1821; // in-scope (non-DDL) rejected of 2028; 207 in-scope still accepted

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

	it("rejects the in-scope syntax-error negative cases (ratchet; DDL detect-only excluded)", { timeout: 600000 }, () => {
		let ddlExcluded = 0; // DDL-validation out of scope (detect-only)
		let inScopeRejected = 0;
		let inScopeAccepted = 0; // in-scope over-acceptance still to fix
		for (const f of negatives()) {
			const sql = readFileSync(join(CORPUS, "negative", f), "utf8");
			let errs = 0;
			let tree: unknown = null;
			try {
				const r = parseBigQuery(sql);
				errs = r.errors;
				tree = r.tree;
			} catch {
				errs = 1;
			}
			if (isDdlNegative(sql, errs, tree)) {
				ddlExcluded++;
				continue;
			}
			if (errs > 0) inScopeRejected++;
			else inScopeAccepted++;
		}
		// eslint-disable-next-line no-console
		console.log(
			`BigQuery parser-corpus in-scope negatives rejected: ${inScopeRejected}/${inScopeRejected + inScopeAccepted}` +
				` (${ddlExcluded} DDL-validation out of scope, excluded)`,
		);
		expect(inScopeRejected).toBeGreaterThanOrEqual(IN_SCOPE_NEGATIVE_BASELINE);
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
