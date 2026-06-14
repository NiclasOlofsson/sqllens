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
//    reference (tools/scrape-redshift-docs.mjs, ~3,193 files). It spans the full surface; the
//    gate ratchets the in-scope query bucket (SELECT/WITH/VALUES/…) and only REPORTS dml/ddl,
//    since object/platform DDL is cleared Out (CLAUDE.md). Regex bucketing (sql-kind.ts) until
//    Redshift lower() exposes parse-derived statement kinds — same as Snowflake/Databricks.

const VENDOR_EXAMPLES = corpusPath("vendor/bytebase-parser/redshift/examples");
const DOCS_CORPUS = corpusPath("harness/local/redshift-docs");

// Ratchet floors — pass counts must never drop below these. Raised as grammar fixes land.
const VENDOR_BASELINE = 115; // upstream's own 115-file corpus: the fork parses all of it
const QUERY_BASELINE = 1768; // scraped-docs in-scope query bucket (of 1,809, 97.7%); raised by grammar cleaning

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
	it("ratchets the in-scope query bucket; reports dml/ddl", { timeout: 1_800_000 }, () => {
		runDocsRatchet(DOCS_CORPUS, parseFile, QUERY_BASELINE);
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
