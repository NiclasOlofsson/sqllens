import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "../helpers/corpus.js";
import { BailErrorStrategy, CharStream, CommonTokenStream, type ParserATNSimulator, PredictionMode } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { RedshiftLexer } from "../../src/generated/redshift/RedshiftLexer.js";
import { RedshiftParser } from "../../src/generated/redshift/RedshiftParser.js";
import { lower } from "../../src/redshift/lower.js";
import { parseRedshift } from "../../src/redshift/parse.js";
import { resolveScopes } from "../../src/scope/scope.js";
import { deriveSymbols } from "../../src/symbols/symbols.js";
import { probeBody } from "../helpers/body-probe.js";
import { sweepCallDiagnostics } from "../helpers/call-check.js";
import { runDocsRatchet } from "../helpers/docs-ratchet.js";
import { runNegativeCorpus } from "../helpers/negative-corpus.js";
import { walkIr } from "../helpers/ir-walk.js";
import { KNOWN_BAD } from "../redshift-corpus-known-bad.js";

// Two Redshift conformance corpora, both gitignored and skipped when absent:
//
// 1. vendor/bytebase-parser/redshift/examples — the upstream grammar's own example corpus
//    (115 files, ~85% DDL). Our fork must keep parsing it: a regression here means a port edit
//    broke something the upstream grammar already handled. Ratchets on the pass count.
//
// 2. harness/local/redshift-docs — every SQL example scraped from the Amazon Redshift SQL
//    reference (tools/scrape-redshift-docs.mjs, ~3,186 files). It spans the full surface; the
//    gate requires 100% of the in-scope query bucket (SELECT/WITH/VALUES/…) to parse and only
//    REPORTS dml/ddl, since object/platform DDL is cleared Out (CLAUDE.md). Bucketing is FROM THE
//    PATH (parser/positive/<kind>/…), placed by the organizer with the current parser; the
//    documented-broken KNOWN_BAD examples fail to parse and sit under unparsed/ (asserted to stay).

const VENDOR_EXAMPLES = corpusPath("redshift/bytebase");
const DOCS_CORPUS = corpusPath("redshift/docs");
// The negative side (issue #5): mutated (rejection-rate ratchet) + curated (100%-reject).
const NEGATIVES = corpusPath("redshift/docs/parser/negative/unparsed");
const MUTATED_FLOOR = 320; // 320/400 mutants rejected (2026-07-02)

// Ratchet floors — pass counts must never drop below these. Raised as grammar fixes land.
const VENDOR_BASELINE = 115; // upstream's own 115-file corpus: the fork parses all of it
const QUERY_BASELINE = 1808; // documented floor for the scraped-docs query population (path-bucketed)
// The cross-dialect `other` ratchet (D1, 2026-07-01 review): count `other` expression nodes over the
// in-scope, cleanly-parsed docs query bucket. Redshift is corpus-complete — 0 `other`. This rides the
// SAME single parse the docs ratchet makes (onCleanQuery gets its tree), so no file is parsed twice.
const OTHER_BASELINE = 0; // measured 2026-07-01 over the parsed Redshift docs query bucket; corpus-complete

// The SLL→LL fallback ratchet (SLL-surgery wave, task-1-brief.md): Redshift is the sickest dialect on
// the roster — its heaviest decisions (simple_select_pramary [sic — upstream typo], c_expr) force the
// two-stage parse to bail out of the fast SLL prediction path and reparse under full LL. Measured
// 2026-07-03 via `node --import tsx tools/profile-sll.ts redshift` over this same docs query bucket.
// Counted on the SAME single parse the docs ratchet makes (the `parse:` closure below), never a
// re-parse. Task 6 (blocked on the B/C/D branch merge) is expected to port the postgres/duckdb fixes
// here first; may only fall.
const FALLBACK_RATCHET = 4;

// Documented-broken / out-of-scope query examples, each verified against its AWS doc source (or
// mechanically, for the CREATE PROCEDURE/FUNCTION $$-body group) as genuinely not an in-scope grammar
// gap. They fail to parse, so the organizer files them under unparsed/; `knownBad` asserts each STILL
// sits there (self-policing: if one starts parsing it leaves unparsed/ and the assertion fails, so the
// entry is removed). The query gate is 100% of query/. Pure scraper noise (leaked EXPLAIN plans, prose
// math, expression-fragment listings, bare <placeholder> metasyntax) is fixed at the scraper instead
// (tools/scrape-redshift-docs.mjs) so it never reaches the corpus. Full list + rationale, categorized:
// tests/redshift-corpus-known-bad.ts.

/** Two-stage SLL→LL parse of a whole file; returns the syntax-error count. */
function parseFile(sql: string): number {
	const lexer = new RedshiftLexer(CharStream.fromString(sql));
	const tokens = new CommonTokenStream(lexer);
	const parser = new RedshiftParser(tokens);
	const sim = parser.interpreter as ParserATNSimulator;
	let errors = 0;
	const listener = {
		syntaxError() {
			errors++;
		},
		reportAmbiguity() {},
		reportAttemptingFullContext() {},
		reportContextSensitivity() {},
	};
	const attach = () => {
		lexer.removeErrorListeners();
		lexer.addErrorListener(listener as never);
		parser.removeErrorListeners();
		parser.addErrorListener(listener as never);
	};
	attach();
	const defaultErrorHandler = parser.errorHandler;
	parser.errorHandler = new BailErrorStrategy();
	sim.predictionMode = PredictionMode.SLL;
	try {
		parser.root();
		return 0;
	} catch {
		tokens.seek(0);
		parser.reset();
		parser.errorHandler = defaultErrorHandler;
		sim.predictionMode = PredictionMode.LL;
		errors = 0;
		attach();
		parser.root();
		return errors;
	}
}

function* sqlFiles(dir: string): Generator<string> {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFiles(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}

describe.skipIf(!existsSync(VENDOR_EXAMPLES))("Redshift grammar vs the bytebase example corpus", () => {
	it("parses the upstream examples (ratchet)", { timeout: 120_000 }, () => {
		const fails: string[] = [];
		let n = 0;
		for (const f of sqlFiles(VENDOR_EXAMPLES)) {
			n++;
			if (parseFile(readFileSync(f, "utf8")) > 0) fails.push(f.slice(VENDOR_EXAMPLES.length + 1));
		}
		expect(n).toBeGreaterThan(0);
		const pass = n - fails.length;
		console.log(`\n  bytebase examples: ${pass}/${n} parse (${((100 * pass) / n).toFixed(1)}%)`);
		if (fails.length) console.log(`  fails:\n    ${fails.join("\n    ")}`);
		expect(pass, `bytebase example pass count dropped below ${VENDOR_BASELINE}`).toBeGreaterThanOrEqual(
			VENDOR_BASELINE,
		);
	});
});

describe.skipIf(!existsSync(DOCS_CORPUS))("Redshift grammar vs the scraped docs corpus", () => {
	// ONE pass merges the two former docs passes (runDocsRatchet + the lower/scope no-throw sweep):
	// the ratchet parses each file once, then hands each clean query-bucket tree to onCleanQuery,
	// which lowers → walks (other-count, baseline 0) → resolves → derives symbols. lower/resolveScopes
	// must be TOTAL (a valid parse never throws in the semantic pipeline — unmodelled forms become
	// `other`/`unsupported`, not exceptions); that contract and the `other` ratchet are proven together
	// over the real corpus. No-other policy on the ratchet: every in-scope query example parses, or it
	// is a documented-broken example listed (and justified) in KNOWN_BAD.
	it(
		"parses 100% of the in-scope query bucket (minus verified known-bad); reports dml/ddl; lower+scope total; `other` ratchet",
		{ timeout: 1_800_000 },
		() => {
			const tally = new Map<string, number>();
			const samples = new Map<string, string>();
			const throwers: string[] = [];
			const callHits: string[] = []; // Task 12: call-signature diagnostics must be zero over valid SQL
			const bodyEmpty: string[] = []; // body-non-emptiness probe (see tests/helpers/body-probe.ts)
			let scoped = 0;
			let fallbacks = 0;
			runDocsRatchet(DOCS_CORPUS, parseFile, QUERY_BASELINE, {
				knownBad: KNOWN_BAD,
				parse: (sql) => {
					const r = parseRedshift(sql);
					if (r.sllFallback) fallbacks++;
					return { errors: r.errors, tree: r.tree };
				},
				onCleanQuery: (rel, tree) => {
					try {
						const ir = lower(tree);
						walkIr(ir, tally, samples);
						probeBody(ir, rel, bodyEmpty);
						const scopes = resolveScopes(ir, "redshift");
						deriveSymbols(scopes);
						sweepCallDiagnostics(scopes, rel, callHits);
						scoped++;
					} catch (e) {
						throwers.push(`${rel}: ${String(e).slice(0, 120)}`);
					}
				},
			});
			const total = [...tally.values()].reduce((s, n) => s + n, 0);
			const top = [...tally.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10)
				.map(([name, n]) => `  ${n}  ${name}   e.g. ${samples.get(name)}`)
				.join("\n");
			console.log(
				`\n  redshift: ${scoped} scoped, ${total} \`other\` exprs (baseline ${OTHER_BASELINE}), ${fallbacks} SLL fallbacks (ratchet ${FALLBACK_RATCHET})${top ? "\n" + top : ""}`,
			);
			expect(scoped).toBeGreaterThan(0);
			expect(throwers, `lower/resolveScopes threw on:\n${throwers.slice(0, 20).join("\n")}`).toEqual([]);
			expect(
				callHits,
				`call-signature checker fired on valid SQL (fix the signature table / checker, never exclude):\n${callHits.slice(0, 20).join("\n")}`,
			).toEqual([]);
			expect(total, `\`other\` count rose above the ${OTHER_BASELINE} baseline:\n${top}`).toBeLessThanOrEqual(
				OTHER_BASELINE,
			);
			expect(
				fallbacks,
				`SLL fallback count rose above the ${FALLBACK_RATCHET} ratchet — a grammar edit made prediction sicker`,
			).toBeLessThanOrEqual(FALLBACK_RATCHET);
			expect(
				bodyEmpty,
				`empty, unflagged SelectExpr bodies found:\n${bodyEmpty.slice(0, 20).join("\n")}`,
			).toEqual([]);
		},
	);
});

describe.skipIf(!existsSync(NEGATIVES))("Redshift negative corpus (issue #5)", () => {
	it("curated near-misses 100%-reject; mutated rejection ratchet", { timeout: 600_000 }, () => {
		runNegativeCorpus("redshift", NEGATIVES, (sql) => parseRedshift(sql).errors, MUTATED_FLOOR);
	});
});
