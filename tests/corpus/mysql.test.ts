import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { corpusPath } from "../helpers/corpus.js";
import { lower } from "../../src/mysql/lower.js";
import { parseMysql } from "../../src/mysql/parse.js";
import { probeBody } from "../helpers/body-probe.js";
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
// falls back to full LL only on a conflict; a fallback is a cost signal, not an error. Re-measured
// 2026-07-11 after the SEMI-required batch restructure (see sqlStatements in the grammar): 6 files fall
// back, down from 11 — the optional statement separator was a prediction conflict at every statement
// boundary, and requiring the SEMI removed it. The residual 6 (ddl_alter, ddl_create, dml_insert,
// dml_select, dml_union, dml_with) are in-statement conflicts of the big Positive-Technologies grammar
// (95 KB, real-world DDL/DML). Seed honest, ratchet down: only rise if a fork edit makes prediction
// sicker.
const FALLBACK_FLOOR = 6;

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
		const bodyEmpty: string[] = []; // body-non-emptiness probe (see tests/helpers/body-probe.ts)
		let n = 0;
		let fallbacks = 0;
		for (const f of sqlFiles(VENDOR_EXAMPLES)) {
			n++;
			const rel = f
				.slice(VENDOR_EXAMPLES.length + 1)
				.split("\\")
				.join("/");
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
				const ir = lower(r.tree);
				probeBody(ir, rel, bodyEmpty);
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
		expect(
			bodyEmpty,
			`empty, unflagged SelectExpr bodies found:\n${bodyEmpty.slice(0, 20).join("\n")}`,
		).toEqual([]);
	});
});

// The SLL→LL fallback floor over the docs corpus, counted only over the files that SHOULD parse
// (KNOWN_BAD_DOCS excluded — a failing parse always falls back, so counting them would just measure
// the known-bad set). Re-measured 2026-07-11 after the SEMI-required batch restructure: 33 of the 1252
// parseable files fall back, down from 612 — the SEMI requirement was the ONLY change between the two
// measurements, so the optional statement separator (an SLL conflict at nearly every statement boundary)
// was the real driver, not the function-call/UNION-chain shapes previously blamed. The residual 33
// concentrate in WITH/CTE-shaped files (14 under query/with — the withStatement→query adjacency is the
// one no-semicolon statement pair the batch rule still admits) and set-operation chains (5 under
// set-operations/union), with a 14-file long tail of singleton pages. Seed honest, ratchet down — the
// WITH-adjacency prediction is the remaining SLL-surgery candidate.
const DOCS_FALLBACK_FLOOR = 33;

describe.skipIf(!existsSync(DOCS_CORPUS))("MySQL grammar vs the scraped official-docs corpus", () => {
	it(
		"parses every documented example with zero syntax errors, lowers totally; SLL-fallback floor",
		{ timeout: 300_000 },
		() => {
			const fails: string[] = [];
			const throwers: string[] = [];
			const bodyEmpty: string[] = []; // body-non-emptiness probe (see tests/helpers/body-probe.ts)
			let n = 0;
			let fallbacks = 0;
			for (const f of sqlFiles(DOCS_CORPUS)) {
				n++;
				const rel = f
					.slice(DOCS_CORPUS.length + 1)
					.split("\\")
					.join("/");
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
					const ir = lower(r.tree);
					probeBody(ir, rel, bodyEmpty);
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
			expect(
				bodyEmpty,
				`empty, unflagged SelectExpr bodies found:\n${bodyEmpty.slice(0, 20).join("\n")}`,
			).toEqual([]);
		},
	);
});
