import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { corpusPath } from "../helpers/corpus.js";
import { lower } from "../../src/sqlite/lower.js";
import { parseSqlite } from "../../src/sqlite/parse.js";
import { KNOWN_BAD } from "../sqlite-corpus-known-bad.js";

// One SQLite conformance corpus (gitignored, skipped when absent):
//
//   sqlite/grammars-v4 — the grammar's own 16-file example set from antlr/grammars-v4
//   sql/sqlite/examples, pinned at the same upstream SHA as our fork
//   (8af0d4c26c796ea27c15c3d85418f2d0f77c3adb). Our verbatim fork must keep parsing 100% of it:
//   a regression here means a fork edit broke something upstream already handled. Laid out under
//   parser/positive/<query|dml|ddl>/ per the corpus convention (bucketOfKinds, first substantive
//   statement); the gate recurses, so the buckets are cosmetic here. KNOWN_BAD is empty and asserted
//   so: these are the grammar's own positives.
//
// A scraped sqlite/docs corpus (the full lang.html surface) is a tracked Open Gap, not seeded here.

const VENDOR_EXAMPLES = corpusPath("sqlite/grammars-v4");

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
		let n = 0;
		let fallbacks = 0;
		for (const f of sqlFiles(VENDOR_EXAMPLES)) {
			n++;
			const rel = f.slice(VENDOR_EXAMPLES.length + 1).split("\\").join("/");
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
