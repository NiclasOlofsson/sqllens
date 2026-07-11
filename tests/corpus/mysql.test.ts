import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { corpusPath } from "../helpers/corpus.js";
import { lower } from "../../src/mysql/lower.js";
import { parseMysql } from "../../src/mysql/parse.js";
import { KNOWN_BAD, KNOWN_BAD_DOCS } from "../mysql-corpus-known-bad.js";

// Two MySQL conformance corpora (both gitignored, each skipped when absent):
//
//   mysql/grammars-v4 — the grammar's own 24-file example set from antlr/grammars-v4
//   sql/mysql/Positive-Technologies/examples, pinned at the same upstream SHA as our fork
//   (bf61744020dc46f2d7b8761e35b0c0cb39b3f31a). Our fork must keep parsing 100% of it: a regression
//   here means a fork edit broke something upstream already handled. Laid out under
//   parser/positive/<query|dml|ddl>/ per the corpus convention (bucketOfKinds over the current parse,
//   first substantive statement — MySQL is a full-language grammar, so DDL / admin / DML all parse);
//   the gate recurses, so the buckets are cosmetic here. KNOWN_BAD is empty and asserted so: these are
//   the grammar's own positives.
//
//   mysql/docs — every runnable SQL example scraped from the official MySQL 8.4 Reference Manual
//   (dev.mysql.com/doc/refman/8.4/en/, the SQL-statement + function/operator chapters;
//   tools/scrape-mysql-docs.mjs). This is the grammar's real validation against the vendor's
//   documented syntax — and what drove the fork's 8.0.19+ query-expression restructure plus the
//   bounded gap fixes (see grammars/mysql/*.g4 for the per-production citations). Laid out per the
//   corpus convention, parser/positive/<query|dml|ddl|unparsed>/<page-slug>/<n>.sql — the scraper
//   buckets with the organizer's own rule (bucketOfKinds over the current parser; parse failures →
//   unparsed). The gate recurses the whole tier and requires zero syntax errors on every file,
//   lowering each totally; the buckets are informational here, never an exclusion. KNOWN_BAD_DOCS
//   holds the manual's own deliberately-not-runnable examples (parse-error illustrations,
//   "Incorrect:"/"illegal:" contrasts, metasyntactic templates — under unparsed/ by construction),
//   asserted to STILL fail. The scraper is deterministic (wipe+rebuild from the cached pages), so a
//   rerun reproduces this corpus exactly and the KNOWN_BAD_DOCS keys stay stable.

const VENDOR_EXAMPLES = corpusPath("mysql/grammars-v4");
const DOCS_CORPUS = corpusPath("mysql/docs");

// The SLL→LL fallback health floor over this corpus. parseMysql tries fast SLL prediction first and
// falls back to full LL only on a conflict; a fallback is a cost signal, not an error. Measured over
// these 24 files against the fixed grammar (2026-07-11): 11 files fall back — the Positive-Technologies
// grammar (95 KB, real-world DDL/DML) has genuine SLL/LL prediction conflicts on this corpus
// (ddl_alter, ddl_create, dml_delete/insert/update, dml_select/union/with, ext_tests, smoke_tests,
// bitrix_queries_cut). This is far messier than SQLite's clean 0, as expected for the larger grammar.
// Seed honest, ratchet down: only rise if a fork edit makes prediction sicker.
const FALLBACK_FLOOR = 11;

function* sqlFiles(dir: string): Generator<string> {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFiles(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}

describe.skipIf(!existsSync(VENDOR_EXAMPLES))("MySQL grammar vs the grammars-v4 example corpus", () => {
	it("parses every example with zero syntax errors, lowers totally; SLL-fallback floor", { timeout: 120_000 }, () => {
		const fails: string[] = [];
		const throwers: string[] = [];
		let n = 0;
		let fallbacks = 0;
		for (const f of sqlFiles(VENDOR_EXAMPLES)) {
			n++;
			const rel = f.slice(VENDOR_EXAMPLES.length + 1).split("\\").join("/");
			const known = rel in KNOWN_BAD;
			const r = parseMysql(readFileSync(f, "utf8"));
			if (r.sllFallback) fallbacks++;
			// KNOWN_BAD examples must STILL fail (self-policing: if upstream fixes one, flag it stale).
			if (known) {
				if (r.errors === 0) fails.push(`${rel} (KNOWN_BAD but now parses — remove the entry)`);
				continue;
			}
			if (r.errors > 0) {
				fails.push(rel);
				continue;
			}
			// lower() is total: it must never throw on grammar-legal input.
			try {
				lower(r.tree);
			} catch (e) {
				throwers.push(`${rel}: ${String(e).slice(0, 140)}`);
			}
		}
		expect(n).toBeGreaterThan(0);
		expect(fails, `fork regressed upstream-supported files:\n${fails.join("\n")}`).toEqual([]);
		expect(throwers, `lower() threw on grammar-legal input:\n${throwers.join("\n")}`).toEqual([]);
		expect(
			fallbacks,
			`SLL fallback count rose above the ${FALLBACK_FLOOR} floor — a grammar edit made prediction sicker`,
		).toBeLessThanOrEqual(FALLBACK_FLOOR);
	});
});

// The SLL→LL fallback floor over the docs corpus, counted only over the files that SHOULD parse
// (KNOWN_BAD_DOCS excluded — a failing parse always falls back, so counting them would just measure
// the known-bad set). Measured over the 1257 scraped files (2026-07-11): 612 of the 1252 parseable
// files fall back — dominated by two conflicts INHERITED from upstream, verified present on the
// pre-restructure grammar: the scalar-vs-UDF function-call ambiguity (simpleId includes
// scalarFunctionName, so every `fn(...)` predicts both ways) and the UNION trailing-vs-level chain
// nesting; the docs corpus is function-example-heavy, so it measures them at full strength. Seed
// honest, ratchet down — SLL surgery on those two classes is the tracked follow-up.
const DOCS_FALLBACK_FLOOR = 612;

describe.skipIf(!existsSync(DOCS_CORPUS))("MySQL grammar vs the scraped official-docs corpus", () => {
	it(
		"parses every documented example with zero syntax errors, lowers totally; SLL-fallback floor",
		{ timeout: 300_000 },
		() => {
			const fails: string[] = [];
			const throwers: string[] = [];
			let n = 0;
			let fallbacks = 0;
			for (const f of sqlFiles(DOCS_CORPUS)) {
				n++;
				const rel = f.slice(DOCS_CORPUS.length + 1).split("\\").join("/");
				const known = rel in KNOWN_BAD_DOCS;
				const r = parseMysql(readFileSync(f, "utf8"));
				// KNOWN_BAD_DOCS examples must STILL fail (self-policing: if a re-scrape fixes one, flag it stale).
				if (known) {
					if (r.errors === 0) fails.push(`${rel} (KNOWN_BAD_DOCS but now parses — remove the entry)`);
					continue;
				}
				if (r.sllFallback) fallbacks++;
				if (r.errors > 0) {
					fails.push(rel);
					continue;
				}
				// lower() is total: it must never throw on grammar-legal input.
				try {
					lower(r.tree);
				} catch (e) {
					throwers.push(`${rel}: ${String(e).slice(0, 140)}`);
				}
			}
			expect(n).toBeGreaterThan(0);
			expect(fails, `grammar rejected documented MySQL examples:\n${fails.join("\n")}`).toEqual([]);
			expect(throwers, `lower() threw on grammar-legal input:\n${throwers.join("\n")}`).toEqual([]);
			expect(
				fallbacks,
				`SLL fallback count rose above the ${DOCS_FALLBACK_FLOOR} floor — a grammar edit made prediction sicker`,
			).toBeLessThanOrEqual(DOCS_FALLBACK_FLOOR);
		},
	);
});
