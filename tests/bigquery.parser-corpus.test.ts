import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lower } from "../src/bigquery/lower.js";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { keywordCategory } from "../src/ir/statement.js";
import { resolveScopes } from "../src/scope/scope.js";

// Is this case a DDL statement? DDL is DETECT-ONLY in this project — the parser recognizes and flags
// object DDL (CREATE/ALTER/DROP/PROCEDURE/…) but does not parse or VALIDATE its structure, by cleared
// scope. So DDL is out of BOTH gates, symmetrically: a malformed DDL we accept is not an
// over-acceptance bug (negatives), and a valid DDL we don't fully parse is not a coverage gap
// (positives) — both are by design. Keyed off the parser's OWN recognition: lower().statement ===
// "ddl" for cases we parse; a leading-keyword fallback for cases that error (and can't be lowered).
// This is the same disciplined, per-case classification as the feature-off cases — every excluded
// case is individually identified, not a blanket drop of a bucket.
const ddlLeadKeyword = (sql: string): string =>
	sql.replace(/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*/, "").match(/^[A-Za-z_]+/)?.[0] ?? "";
function isDdl(sql: string, errors: number, tree: unknown): boolean {
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
// Both gates measure only the IN-SCOPE bucket. Two disciplined, per-case classifications narrow each
// corpus to that:
//   1. Feature-off (in the extractor): a case that errors only because a feature WE implement is
//      disabled is one we correctly accept as a permissive superset — not a valid negative for us.
//   2. DDL detect-only (here, see isDdl): object DDL is recognized and flagged but not parsed or
//      validated, by cleared scope, so it is out of BOTH gates — malformed-DDL forms out of the
//      must-reject (negatives) and valid-DDL forms out of the must-parse (positives).
// Both are per-case, not blanket drops. The in-scope POSITIVE bucket is the query/DML/script surface
// we do parse (remaining gaps: macros, set-op edges, qualify-as-alias, group_rows, pipe-after-non-
// query, multiline string literals, …). The in-scope NEGATIVE bucket is genuine over-acceptance
// (numeric-literal method calls, set-op CORRESPONDING edges, `1 > > 2`, WITH ANONYMIZATION, …).
//
// The extractor now classifies a custom parser ERROR (not just "Syntax error: …") as a negative —
// "EXCEPT must be followed by ALL, DISTINCT, or (", "… is an expression, not a query", "DEFINE MACRO
// … cannot be nested", "Syntax error: WHERE not supported after FROM query" — while still treating a
// post-parse feature/support rejection ("… is not supported", "… is not a supported object type") as
// accepted (permissive superset / DDL). This moved a batch of mis-bucketed error cases out of the
// positive bucket and into negatives we already reject.
//
// Measured 2026-06-13: of 3550 positives, 881 are DDL (excluded); in-scope positives parse at
// 2579/2669 (96.6%) after the GoogleSQL DOT_IDENTIFIER rewrite (src/bigquery/dot-path.ts — numeric
// path components `foo.123`, `x.1.2.3`, `t.2daysago`, and dotted `x.y.2.0.z` in path context).
// Negatives: of 2566, 496 DDL excluded; of the 2070 in-scope negatives we reject 1856 and still
// wrongly accept 214. Both in-scope floors ratchet up as the grammar tightens.
const IN_SCOPE_POSITIVE_BASELINE = 2598; // in-scope (non-DDL) parsed of 2669; 71 in-scope still failing
const IN_SCOPE_NEGATIVE_BASELINE = 1856; // in-scope (non-DDL) rejected of 2070; 214 in-scope still accepted

describe.skipIf(!existsSync(CORPUS))("BigQuery vs the ZetaSQL parser .test corpus", () => {
	it("parses the in-scope positive cases (ratchet; DDL detect-only excluded)", { timeout: 600000 }, () => {
		let ddlExcluded = 0; // DDL out of scope (detect-only — not parsed/validated)
		let inScopeParsed = 0;
		let inScopeFailed = 0; // in-scope coverage gaps still to fix
		for (const f of positives()) {
			const sql = readFileSync(join(CORPUS, "positive", f), "utf8");
			let errs = 1;
			let tree: unknown = null;
			try {
				const r = parseBigQuery(sql);
				errs = r.errors;
				tree = r.tree;
			} catch {
				errs = -1;
			}
			if (isDdl(sql, errs, tree)) {
				ddlExcluded++;
				continue;
			}
			if (errs === 0) inScopeParsed++;
			else inScopeFailed++;
		}
		// eslint-disable-next-line no-console
		console.log(
			`BigQuery parser-corpus in-scope positives parsed: ${inScopeParsed}/${inScopeParsed + inScopeFailed}` +
				` (${ddlExcluded} DDL detect-only, excluded)`,
		);
		expect(inScopeParsed).toBeGreaterThanOrEqual(IN_SCOPE_POSITIVE_BASELINE);
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
			if (isDdl(sql, errs, tree)) {
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
