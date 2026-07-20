import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "../helpers/corpus.js";
import { describe, expect, it } from "vitest";
import { lower } from "../../src/bigquery/lower.js";
import { parseBigQuery } from "../../src/bigquery/parse.js";
import { resolveScopes } from "../../src/scope/scope.js";
import { probeBody } from "../helpers/body-probe.js";

// Is this case DETECT-ONLY — recognized and flagged but not parsed/validated, by cleared scope?
// Two families: object DDL (CREATE/ALTER/DROP, incl. …FUNCTION/TABLE/PROCEDURE) and DEFINE MACRO
// (GoogleSQL's preprocessor, whose body uses a lexer mode we don't model — like Spark's CREATE
// TEMPORARY MACRO). Both are out of BOTH gates, symmetrically: a malformed one we accept is not an
// over-acceptance bug (negatives), and a valid one we don't fully parse is not a coverage gap
// (positives). It is keyed on the LEADING KEYWORD only — deliberately NOT the broad keywordCategory,
// which also tags ANALYZE/TRUNCATE/RENAME/REFRESH/… as "ddl"; those are operational statements that
// are in scope and must not be hidden from either gate (that would inflate the in-scope rates and
// shrink the negative pool). Same disciplined, per-case classification as the feature-off cases.
const leadKeyword = (sql: string): string =>
	sql
		.replace(/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*/, "")
		.replace(/^@\{[^}]*\}\s*/, "") // skip an optional statement hint
		.match(/^[A-Za-z_]+/)?.[0]
		?.toLowerCase() ?? "";
const isMacro = (sql: string): boolean =>
	/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*(?:@\{[^}]*\}\s*)?DEFINE\s+MACRO\b/i.test(sql);
// A comment/whitespace-only input is a valid EMPTY SCRIPT under our entry (ParseScript / `root`), but
// an error under ZetaSQL's single-statement entry (ParseStatement). Some testdata asserts that
// statement-mode error; that mode mismatch is out of both gates — not a positive gap, not negative
// over-acceptance — same spirit as the feature-off exclusion.
const isEmptyScript = (sql: string): boolean =>
	sql
		.replace(/--[^\n]*/g, "")
		.replace(/#[^\n]*/g, "")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.trim() === "";
const DETECT_ONLY_LEAD = new Set(["create", "alter", "drop"]); // object DDL — cleared Out
function isDetectOnly(sql: string): boolean {
	return isMacro(sql) || isEmptyScript(sql) || DETECT_ONLY_LEAD.has(leadKeyword(sql));
}

// The ZetaSQL PARSER .test corpus (gitignored; rebuild with tools/extract-googlesql-parser-tests.mjs,
// needs `git -C "$SQL_CORPUS_DIR/vendor/googlesql" sparse-checkout add googlesql/parser/testdata`). This is a second,
// stricter two-sided gate alongside bigquery.analyzer.test.ts (the analyzer corpus). The parser
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
const CORPUS = corpusPath("bigquery/zetasql/parser");
// positives/negatives now live under <category>/ subdirs (post-reorg), so walk recursively and
// return full paths.
function* sqlFiles(dir: string): Generator<string> {
	if (!existsSync(dir)) return;
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFiles(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}
const positives = () => [...sqlFiles(join(CORPUS, "positive"))];
const negatives = () => [...sqlFiles(join(CORPUS, "negative"))];

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
//   2. Detect-only (here, see isDetectOnly): object DDL and DEFINE MACRO are recognized and flagged
//      but not parsed/validated, by cleared scope, so they are out of BOTH gates — malformed forms
//      out of the must-reject (negatives) and valid forms out of the must-parse (positives).
// Both are per-case, not blanket drops. The in-scope POSITIVE bucket is the query/DML/script surface
// we do parse (remaining gaps: qualify-as-alias, graph edges, and assorted expression singletons).
// The in-scope NEGATIVE bucket is genuine over-acceptance (numeric-literal method calls, set-op
// CORRESPONDING edges, `1 > > 2`, WITH ANONYMIZATION, …).
//
// The extractor now classifies a custom parser ERROR (not just "Syntax error: …") as a negative —
// "EXCEPT must be followed by ALL, DISTINCT, or (", "… is an expression, not a query", "DEFINE MACRO
// … cannot be nested", "Syntax error: WHERE not supported after FROM query" — while still treating a
// post-parse feature/support rejection ("… is not supported", "… is not a supported object type") as
// accepted (permissive superset / DDL). This moved a batch of mis-bucketed error cases out of the
// positive bucket and into negatives we already reject.
//
// The extractor also strips leading bracketed directive lines (`[NEWLINE \n]`, …) from an expected
// block before the error check, so error cases prefixed by such a directive (e.g. the multiline
// triple-quoted "Unexpected string literal" cases) classify as negatives, not positives.
//
// The extractor reconstructs each cell's ALTERNATION GROUP label (our directive feature choices +
// the variant's query choices, each TRIMMED, joined with "," — matching ZetaSQL's trimmed labels) to
// grade multi-dimensional/grouped alternations; and string/bytes/identifier escapes are validated in
// parseBigQuery as syntax errors (ZetaSQL's ParseStringLiteral/CUnescapeInternal, src/bigquery/
// literal-escapes.ts) — both corpora reject invalid escapes now.
//
// Measured 2026-06-14, reconciled 2026-07-12 (issue #10): of 3543 positives, 881 are detect-only/
// empty-script (excluded); in-scope positives parse at 2662/2662 (100%). Negatives: of 2519, 485
// detect-only/empty-script excluded; the 2034 in-scope negatives are ALL rejected (0 accepted); exact
// join_processor balance, numeric/
// string-method bases, INSERT modes, STRICT/CORRESPONDING set-op rules, dot-star precedence (post-
// parse), graph quantifier/hint/prop-spec/endpoint-chain/FOR-OFFSET/cost/CALL rules, pipe CREATE/
// join/aggregate/call edges, lambda arg lists, replace_fields, WITH-kind OPTIONS, ANALYZE OPTIONS,
// braced-constructor extension separators, SEQUENCE-CLAMPED, signed-exponent floats glued to idents.
// Deliberate divergences and feature-off/config cases are classified out of the bucket in the
// extractor (bare QUALIFY, PIPES-off FROM-queries and outer-query aliases, ALLOW_CONSECUTIVE_ON
// subjoins, no_reserve_graph_table, ALLOW_DASHES_IN_TABLE_NAME), per CLAUDE.md, not wrongly rejected.
const IN_SCOPE_POSITIVE_BASELINE = 2662; // in-scope parsed of 2662 — 100% of the in-scope query/DML/script surface
const IN_SCOPE_NEGATIVE_BASELINE = 2034; // in-scope rejected of 2034 (100%, zero accepted). Was 2035 until 2026-07-12, when reconciling with the current extractor (issue #10) dropped negative/unparsed/parser_7.sql (`\# Comment without query.`), a stale `\#`-escaped comment-only case the post-Task-6 cleanQuery no longer emits.

describe.skipIf(!existsSync(CORPUS))("BigQuery vs the ZetaSQL parser .test corpus", () => {
	it("parses the in-scope positive cases (ratchet; DDL detect-only excluded)", { timeout: 600000 }, () => {
		let ddlExcluded = 0; // DDL out of scope (detect-only — not parsed/validated)
		let inScopeParsed = 0;
		let inScopeFailed = 0; // in-scope coverage gaps still to fix
		for (const f of positives()) {
			const sql = readFileSync(f, "utf8");
			let errs = 1;
			let tree: unknown = null;
			try {
				const r = parseBigQuery(sql);
				errs = r.errors;
				tree = r.tree;
			} catch {
				errs = -1;
			}
			if (isDetectOnly(sql)) {
				ddlExcluded++;
				continue;
			}
			if (errs === 0) inScopeParsed++;
			else inScopeFailed++;
		}
		// eslint-disable-next-line no-console
		console.log(
			`BigQuery parser-corpus in-scope positives parsed: ${inScopeParsed}/${inScopeParsed + inScopeFailed}` +
				` (${ddlExcluded} DDL/macro detect-only, excluded)`,
		);
		expect(inScopeParsed).toBeGreaterThanOrEqual(IN_SCOPE_POSITIVE_BASELINE);
	});

	it(
		"rejects the in-scope syntax-error negative cases (ratchet; DDL detect-only excluded)",
		{ timeout: 600000 },
		() => {
			let ddlExcluded = 0; // DDL-validation out of scope (detect-only)
			let inScopeRejected = 0;
			let inScopeAccepted = 0; // in-scope over-acceptance still to fix
			for (const f of negatives()) {
				const sql = readFileSync(f, "utf8");
				let errs = 0;
				let tree: unknown = null;
				try {
					const r = parseBigQuery(sql);
					errs = r.errors;
					tree = r.tree;
				} catch {
					errs = 1;
				}
				if (isDetectOnly(sql)) {
					ddlExcluded++;
					continue;
				}
				if (errs > 0) inScopeRejected++;
				else inScopeAccepted++;
			}
			// eslint-disable-next-line no-console
			console.log(
				`BigQuery parser-corpus in-scope negatives rejected: ${inScopeRejected}/${inScopeRejected + inScopeAccepted}` +
					` (${ddlExcluded} DDL/macro detect-only, excluded)`,
			);
			expect(inScopeRejected).toBeGreaterThanOrEqual(IN_SCOPE_NEGATIVE_BASELINE);
		},
	);

	it("lower + resolveScopes never throw on a parsed positive case; body-non-emptiness probe", { timeout: 600000 }, () => {
		const throws: string[] = [];
		const bodyEmpty: string[] = []; // body-non-emptiness probe (see tests/helpers/body-probe.ts)
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
				const ir = lower(res.tree);
				probeBody(ir, f, bodyEmpty);
				resolveScopes(ir, "bigquery");
			} catch (e) {
				throws.push(`${f}: ${(e as Error).message}`);
			}
		}
		expect(throws, `lower/resolveScopes threw on:\n${throws.slice(0, 20).join("\n")}`).toEqual([]);
		expect(
			bodyEmpty,
			`empty, unflagged SelectExpr bodies found:\n${bodyEmpty.slice(0, 20).join("\n")}`,
		).toEqual([]);
	});
});
