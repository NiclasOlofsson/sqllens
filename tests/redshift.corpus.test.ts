import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "./helpers/corpus.js";
import { BailErrorStrategy, CharStream, CommonTokenStream, type ParserATNSimulator, PredictionMode } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { RedshiftLexer } from "../src/generated/redshift/RedshiftLexer.js";
import { RedshiftParser } from "../src/generated/redshift/RedshiftParser.js";
import { lower } from "../src/redshift/lower.js";
import { parseRedshift } from "../src/redshift/parse.js";
import { resolveScopes } from "../src/scope/scope.js";
import { classifySql } from "./helpers/sql-kind.js";
import { runDocsRatchet } from "./helpers/docs-ratchet.js";

// Two Redshift conformance corpora, both gitignored and skipped when absent:
//
// 1. vendor/bytebase-parser/redshift/examples — the upstream grammar's own example corpus
//    (115 files, ~85% DDL). Our fork must keep parsing it: a regression here means a port edit
//    broke something the upstream grammar already handled. Ratchets on the pass count.
//
// 2. harness/local/redshift-docs — every SQL example scraped from the Amazon Redshift SQL
//    reference (tools/scrape-redshift-docs.mjs, ~3,186 files). It spans the full surface; the
//    gate requires 100% of the in-scope query bucket (SELECT/WITH/VALUES/…) to parse — minus the
//    verified KNOWN_BAD documented-broken examples — and only REPORTS dml/ddl, since object/
//    platform DDL is cleared Out (CLAUDE.md). Regex bucketing (sql-kind.ts) until Redshift lower()
//    exposes parse-derived statement kinds — same as Snowflake/Databricks.

const VENDOR_EXAMPLES = corpusPath("redshift/bytebase");
const DOCS_CORPUS = corpusPath("redshift/docs");

// Ratchet floors — pass counts must never drop below these. Raised as grammar fixes land.
const VENDOR_BASELINE = 115; // upstream's own 115-file corpus: the fork parses all of it
const QUERY_BASELINE = 1790; // scraped-docs in-scope query bucket; superseded by the 100%/knownBad gate below

// Documented-broken query examples — every in-scope query example must parse EXCEPT these, each
// verified against its AWS doc source as genuinely malformed SQL (not a grammar gap, not scraper
// noise). Passing `knownBad` flips the query gate from "ratchet ≥ baseline" to "100% of the rest
// must parse", and a known-bad that starts parsing fails the gate as stale. (T-SQL precedent:
// tests/tsql-corpus-known-bad.ts.) Pure scraper noise — leaked EXPLAIN plans, prose math,
// expression-fragment listings, bare <placeholder> metasyntax — is fixed at the scraper instead
// (tools/scrape-redshift-docs.mjs) so it never reaches the corpus.
const KNOWN_BAD: Record<string, string> = {
	"nested-data-use-cases/7.sql":
		"AWS doc 'illustration' mixes comma-join with a trailing ON clause (FROM …, prices p ON …) — no JOIN keyword; rejected by the PostgreSQL/PartiQL grammar.",
	"r_COPY_command_examples/34.sql":
		"AWS doc Oracle-export example REPLACE(c2, \\n',\\\\n') is malformed — a stray \\n sits outside the string and the quotes are mismatched.",
	"r_GROUP_BY_clause/3.sql":
		"AWS doc typo — missing comma between col2 and sum(col3): `SELECT col1, col2 sum(col3) … GROUP BY ALL`. (GROUP BY ALL itself parses — see redshift.test.ts.)",
	"r_SET_CONFIG/2.sql":
		"AWS doc uses typographic smart quotes (‘…’) around the SET_CONFIG arguments — not valid SQL string delimiters.",
	"SYS_DATASHARE_USAGE_PRODUCER/1.sql":
		"AWS doc typo — `SELECT DISTINCT` with an empty select list before FROM.",
	"tutorial_multi-class_classification/7.sql":
		"AWS doc has unbalanced parentheses — the first SELECT closes with ) but has no opening ( before UNION.",
};

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
	it("parses 100% of the in-scope query bucket (minus verified known-bad); reports dml/ddl", { timeout: 1_800_000 }, () => {
		// No-other policy: every in-scope query example parses, or it is a documented-broken example
		// listed (and justified) in KNOWN_BAD. There is no silently-tolerated failing tail.
		runDocsRatchet(DOCS_CORPUS, parseFile, QUERY_BASELINE, { knownBad: KNOWN_BAD });
	});

	// lower() + resolveScopes must be TOTAL over every parsed query: a valid parse never throws in
	// the semantic pipeline (unmodelled forms become `other`/`unsupported`, not exceptions). This is
	// the contract the shared semantic layer relies on — proven here over the real corpus, not faked.
	it("lower + resolveScopes never throw over the parsed query corpus", { timeout: 1_800_000 }, () => {
		const throwers: string[] = [];
		let parsed = 0;
		for (const f of sqlFiles(DOCS_CORPUS)) {
			const sql = readFileSync(f, "utf8");
			if (classifySql(sql) !== "query") continue;
			const { tree, errors } = parseRedshift(sql);
			if (errors > 0) continue; // unparsed — the ratchet covers those
			parsed++;
			try {
				resolveScopes(lower(tree), "redshift");
			} catch (e) {
				throwers.push(`${f.slice(DOCS_CORPUS.length + 1).split("\\").join("/")}: ${String(e).slice(0, 120)}`);
			}
		}
		expect(parsed).toBeGreaterThan(0);
		expect(throwers, `lower/resolveScopes threw on:\n${throwers.slice(0, 20).join("\n")}`).toEqual([]);
	});
});
