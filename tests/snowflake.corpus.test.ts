import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	BailErrorStrategy,
	CharStream,
	CommonTokenStream,
	type ParserATNSimulator,
	PredictionMode,
} from "antlr4ng";
import { describe, expect, it } from "vitest";
import { SnowflakeLexer } from "../src/generated/snowflake/SnowflakeLexer.js";
import { SnowflakeParser } from "../src/generated/snowflake/SnowflakeParser.js";
import { runDocsRatchet } from "./helpers/docs-ratchet.js";

// Two Snowflake conformance corpora, both gitignored and skipped when absent:
//
// 1. vendor/grammars-v4/sql/snowflake/examples — the grammar's own 51-file corpus.
//    Our fork must keep parsing 100% of it: a regression here means a fork edit broke
//    something upstream already handled.
//
// 2. harness/local/snowflake-docs — every SQL example scraped from the 2,348
//    docs.snowflake.com sql-reference pages (tools/scrape-snowflake-docs.mjs). It spans
//    the full surface (queries, DDL, admin, scripting); the gate RATCHETS on the in-scope
//    query bucket only and reports dml/ddl (object/platform DDL is cleared Out of scope).
//    Query conformance is ~2929/2978 (98.4%). Raise the baseline as fixes land.

const VENDOR_EXAMPLES = resolve("vendor/grammars-v4/sql/snowflake/examples");
const DOCS_CORPUS = resolve("harness/local/snowflake-docs");
// A few-file margin below the observed pass count: the two-stage SLL→LL parse shows ±1 jitter
// on a couple of ambiguous files, and this is a floor (never-regress), not a target.
const QUERY_BASELINE = 2927;

/** Two-stage SLL→LL parse of a whole file; returns the syntax-error count. */
function parseFile(sql: string): number {
	const lexer = new SnowflakeLexer(CharStream.fromString(sql));
	const tokens = new CommonTokenStream(lexer);
	const parser = new SnowflakeParser(tokens);
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
		parser.snowflake_file();
		return 0;
	} catch {
		tokens.seek(0);
		parser.reset();
		parser.errorHandler = defaultErrorHandler;
		sim.predictionMode = PredictionMode.LL;
		errors = 0;
		attach();
		parser.snowflake_file();
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

describe.skipIf(!existsSync(VENDOR_EXAMPLES))("Snowflake grammar vs the grammars-v4 example corpus", () => {
	it("parses every example with zero syntax errors", { timeout: 120_000 }, () => {
		const fails: string[] = [];
		let n = 0;
		for (const f of sqlFiles(VENDOR_EXAMPLES)) {
			n++;
			if (parseFile(readFileSync(f, "utf8")) > 0) fails.push(f.slice(VENDOR_EXAMPLES.length + 1));
		}
		expect(n).toBeGreaterThan(0);
		expect(fails, `fork regressed upstream-supported files:\n${fails.join("\n")}`).toEqual([]);
	});
});

describe.skipIf(!existsSync(DOCS_CORPUS))("Snowflake grammar vs the scraped docs corpus", () => {
	it("parses the in-scope query examples (ratchet); reports dml/ddl", { timeout: 1_800_000 }, () => {
		runDocsRatchet(DOCS_CORPUS, parseFile, QUERY_BASELINE);
	});
});
