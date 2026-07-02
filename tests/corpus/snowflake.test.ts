import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corpusPath } from "../helpers/corpus.js";
import { BailErrorStrategy, CharStream, CommonTokenStream, type ParserATNSimulator, PredictionMode } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { SnowflakeLexer } from "../../src/generated/snowflake/SnowflakeLexer.js";
import { SnowflakeParser } from "../../src/generated/snowflake/SnowflakeParser.js";
import { lower } from "../../src/snowflake/lower.js";
import { parseSnowflake } from "../../src/snowflake/parse.js";
import { resolveScopes } from "../../src/scope/scope.js";
import { deriveSymbols } from "../../src/symbols/symbols.js";
import { runDocsRatchet } from "../helpers/docs-ratchet.js";
import { walkIr } from "../helpers/ir-walk.js";
import { KNOWN_BAD } from "../snowflake-corpus-known-bad.js";

// Two Snowflake conformance corpora, both gitignored and skipped when absent:
//
// 1. vendor/grammars-v4/sql/snowflake/examples — the grammar's own 51-file corpus.
//    Our fork must keep parsing 100% of it: a regression here means a fork edit broke
//    something upstream already handled.
//
// 2. harness/local/snowflake-docs — every SQL example scraped from the 2,348
//    docs.snowflake.com sql-reference pages (tools/scrape-snowflake-docs.mjs). It spans
//    the full surface (queries, DDL, admin, scripting); the gate requires 100% of the in-scope
//    query bucket to parse (object/platform DDL is cleared Out and only reported). Bucketing is FROM THE PATH
//    (parser/positive/<kind>/…), placed by the organizer with the current parser. The invalid-SQL
//    examples in Snowflake's own docs fail to parse and sit under unparsed/; KNOWN_BAD asserts they
//    stay there (self-policing) — see tests/snowflake-corpus-known-bad.ts.

const VENDOR_EXAMPLES = corpusPath("snowflake/grammars-v4");
const DOCS_CORPUS = corpusPath("snowflake/docs");
// The query bucket gate is 100% of the in-scope, non-KNOWN_BAD examples (see runDocsRatchet with
// the knownBad option). The numeric baseline is unused in 100% mode but kept as a documented floor.
const QUERY_BASELINE = 2976; // documented floor for the query population (path-bucketed)

// The cross-dialect `other` ratchet (D1, 2026-07-01 review): count `other` expression nodes over the
// in-scope, cleanly-parsed docs query bucket and ratchet the total (it may only fall; drive to 0 like
// Databricks). This rides the SAME single parse the docs ratchet makes (onCleanQuery gets its tree),
// so no file is parsed twice.
const OTHER_BASELINE = 0; // sequence refs (<seq>.NEXTVAL) now lower to typed function exprs (2026-07-02); may only fall

// The SLL→LL fallback ratchet (SLL-surgery wave, task-1-brief.md): Snowflake is grammar-sick — its
// heaviest decisions (select_statement, expression_elem, select_list_elem, function_call) force the
// two-stage parse to bail out of the fast SLL prediction path and reparse under full LL. Measured
// 2026-07-03 via `node --import tsx tools/profile-sll.ts snowflake` over this same docs query bucket.
// Counted on the SAME single parse the docs ratchet makes (the `parse:` closure below), never a
// re-parse. May only fall as the surgery wave's per-dialect tasks land; 0 is healthy (untracked again).
const FALLBACK_RATCHET = 220; // 525 → 315 → 220: select_list_top + expression_elem + select_list_elem surgery (2026-07-03)

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
	it(
		"parses 100% of in-scope query examples (KNOWN_BAD excluded); reports dml/ddl; `other` ratchet",
		{ timeout: 1_800_000 },
		() => {
			// One pass: the docs ratchet parses each file once (via parse, which also yields the tree);
			// the clean query-bucket tree feeds onCleanQuery, which lowers → walks → resolves → derives
			// symbols. The pipeline must never throw and the `other` count must stay at/under baseline.
			const tally = new Map<string, number>();
			const samples = new Map<string, string>();
			const throwers: string[] = [];
			let scoped = 0;
			let fallbacks = 0;
			runDocsRatchet(DOCS_CORPUS, parseFile, QUERY_BASELINE, {
				knownBad: KNOWN_BAD,
				parse: (sql) => {
					const r = parseSnowflake(sql);
					if (r.sllFallback) fallbacks++;
					return { errors: r.errors, tree: r.tree };
				},
				onCleanQuery: (rel, tree) => {
					try {
						const ir = lower(tree);
						walkIr(ir, tally, samples);
						deriveSymbols(resolveScopes(ir, "snowflake"));
						scoped++;
					} catch (e) {
						throwers.push(`${rel}: ${String(e).slice(0, 140)}`);
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
				`\n  snowflake: ${scoped} scoped, ${total} \`other\` exprs (baseline ${OTHER_BASELINE}), ${fallbacks} SLL fallbacks (ratchet ${FALLBACK_RATCHET})${top ? "\n" + top : ""}`,
			);
			expect(scoped).toBeGreaterThan(0);
			expect(throwers, `pipeline threw on:\n${throwers.slice(0, 20).join("\n")}`).toEqual([]);
			expect(total, `\`other\` count rose above the ${OTHER_BASELINE} baseline:\n${top}`).toBeLessThanOrEqual(
				OTHER_BASELINE,
			);
			expect(
				fallbacks,
				`SLL fallback count rose above the ${FALLBACK_RATCHET} ratchet — a grammar edit made prediction sicker`,
			).toBeLessThanOrEqual(FALLBACK_RATCHET);
		},
	);
});
