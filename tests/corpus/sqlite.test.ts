import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { corpusPath } from "../helpers/corpus.js";
import { lower } from "../../src/sqlite/lower.js";
import { parseSqlite } from "../../src/sqlite/parse.js";
import { probeBody } from "../helpers/body-probe.js";
import { KNOWN_BAD, KNOWN_BAD_DOCS } from "../sqlite-corpus-known-bad.js";

// Two SQLite conformance corpora (both gitignored, each skipped when absent):
//
//   sqlite/grammars-v4 — the grammar's own 16-file example set from antlr/grammars-v4
//   sql/sqlite/examples, pinned at the same upstream SHA as our fork
//   (8af0d4c26c796ea27c15c3d85418f2d0f77c3adb). Our verbatim fork must keep parsing 100% of it:
//   a regression here means a fork edit broke something upstream already handled. Laid out under
//   parser/positive/<query|dml|ddl>/ per the corpus convention (bucketOfKinds, first substantive
//   statement); the gate recurses, so the buckets are cosmetic here. KNOWN_BAD is empty and asserted
//   so: these are the grammar's own positives.
//
//   sqlite/docs — every runnable SQL example scraped from the official SQLite language docs
//   (sqlite.org/lang*.html, bundle sqlite-doc-3530300 = SQLite 3.53.3; tools/scrape-sqlite-docs.mjs).
//   This is the grammar's real validation against the vendor's documented syntax — the grammars-v4
//   examples only cover what upstream contributors happened to write. Laid out per the corpus
//   convention, parser/positive/<query|dml|ddl|unparsed>/<page-slug>/<n>.sql — the scraper buckets
//   with the organizer's own rule (bucketOfKinds over the current parser; parse failures → unparsed).
//   The gate recurses the whole tier and requires zero syntax errors on every file (SQLite's is a
//   full-language grammar, so DDL / PRAGMA / functions all parse — no query-only carve-out), lowering
//   each totally; the buckets are informational here, never an exclusion. KNOWN_BAD_DOCS holds the
//   docs' own genuinely-not-SQLite examples (a MySQL counter-example, under unparsed/ by
//   construction), asserted to STILL fail. The scraper is deterministic (wipe+rebuild from the pinned
//   bundle), so a rerun reproduces this corpus exactly and the KNOWN_BAD_DOCS keys stay stable.

const VENDOR_EXAMPLES = corpusPath("sqlite/grammars-v4");
const DOCS_CORPUS = corpusPath("sqlite/docs");

// The SLL→LL fallback health floor over this corpus. parseSqlite tries fast SLL prediction first and
// falls back to full LL only on a conflict; a fallback is a cost signal, not an error. Measured over
// these 16 files (2026-07-10): 0 files fall back — SQLite's grammar predicts cleanly under SLL. May
// only rise if a fork edit makes prediction sicker; 0 is healthy. Seed honest, ratchet down.
const FALLBACK_FLOOR = 0;

function* sqlFiles(dir: string): Generator<string> {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) yield* sqlFiles(p);
		else if (e.name.endsWith(".sql")) yield p;
	}
}

describe.skipIf(!existsSync(VENDOR_EXAMPLES))("SQLite grammar vs the grammars-v4 example corpus", () => {
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
			const r = parseSqlite(readFileSync(f, "utf8"));
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
// the known-bad set). Measured over the 48 scraped files (2026-07-10): 0 of the 47 parseable files
// fall back. Seed honest, ratchet down.
const DOCS_FALLBACK_FLOOR = 0;

describe.skipIf(!existsSync(DOCS_CORPUS))("SQLite grammar vs the scraped official-docs corpus", () => {
	it(
		"parses every documented example with zero syntax errors, lowers totally; SLL-fallback floor",
		{ timeout: 120_000 },
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
				const r = parseSqlite(readFileSync(f, "utf8"));
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
			expect(fails, `grammar rejected documented SQLite examples:\n${fails.join("\n")}`).toEqual([]);
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
