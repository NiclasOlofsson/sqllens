import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { corpusPath } from "../helpers/corpus.js";
import { beforeAll, describe, expect, it } from "vitest";
import { lower } from "../../src/postgres/lower.js";
import { parsePostgres } from "../../src/postgres/parse.js";
import { resolveScopes } from "../../src/scope/scope.js";
import { deriveSymbols } from "../../src/symbols/symbols.js";
import { probeBody } from "../helpers/body-probe.js";
import { sweepCallDiagnostics } from "../helpers/call-check.js";
import { runDocsRatchet } from "../helpers/docs-ratchet.js";
import { runNegativeCorpus } from "../helpers/negative-corpus.js";
import { walkIr } from "../helpers/ir-walk.js";
import { KNOWN_BAD } from "../postgres-corpus-known-bad.js";

// Two PostgreSQL conformance corpora, both in the corpus repo and skipped when absent:
//
// 1. postgres/bytebase — the upstream grammar's own example corpus (217 files, largely PG
//    regression-suite-derived). Our fork must keep parsing all of it: a regression here means a
//    port edit broke something the upstream grammar already handled.
//
// 2. postgres/docs — every SQL example scraped from the PostgreSQL 18 manual
//    (tools/scrape-postgres-docs.mjs, ~1,226 files; PostgreSQL License). Organizer-bucketed
//    (parser/positive/<kind>/…); the gate trusts the paths and requires 100% of the query bucket.

const VENDOR_EXAMPLES = corpusPath("postgres/bytebase");
const DOCS_CORPUS = corpusPath("postgres/docs");
// The negative side (issue #5): mutated (rejection-rate ratchet) + curated (100%-reject). Floor pinned
// at the measured rejection count — mutation cannot guarantee invalidity, so it may only rise.
const NEGATIVES = corpusPath("postgres/docs/parser/negative/unparsed");
const MUTATED_FLOOR = 325; // 325/400 mutants rejected (2026-07-02)

const VENDOR_BASELINE = 217; // upstream's own example corpus: the fork parses all of it
const QUERY_BASELINE = 330; // documented floor; the gate itself is 100%-of-query-bucket
// The cross-dialect `other` ratchet: Postgres is expression-corpus-complete — 0 `other`
// (measured 2026-07-02 over the parsed docs query bucket).
const OTHER_BASELINE = 0;

// The SLL→LL fallback ratchet (SLL-surgery wave, task-4-report.md): Postgres was grammar-sick — its
// heaviest decisions forced the two-stage parse to bail out of the fast SLL prediction path and reparse
// under full LL. Grammar edits cut it from 112 to 7: (1) deleting `target_el`'s `columnref` subset
// alternative, (2) ordering c_expr's identifier-prefix alternatives most-specific-first — `aexprconst`
// (typed literals) then `func_expr` (calls) then `explicit_row` (`ROW(…)`) then `columnref` (bare ids)
// — so the correct reading is the minimum alternative in each conflict. Measured via
// `node --import tsx tools/profile-sll.ts postgres` over this same docs query bucket. Counted on the
// SAME single parse the docs ratchet makes (the `parse:` closure below), never a re-parse. This is the
// dress rehearsal for duckdb/redshift's identical TVL-lineage decisions; may only fall.
const FALLBACK_RATCHET = 7;

// Documented-broken query examples (docs bugs) and out-of-scope UDF-body wrappers — see
// tests/postgres-corpus-known-bad.ts for the full breakdown. By construction they fail to parse,
// so the organizer files them under unparsed/; the gate asserts they STAY there.

describe.skipIf(!existsSync(VENDOR_EXAMPLES))("Postgres grammar vs the bytebase example corpus", () => {
	let files: string[];
	beforeAll(() => {
		const walk = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
				const p = join(dir, e.name);
				if (e.isDirectory()) return walk(p);
				return e.name.endsWith(".sql") ? [relative(VENDOR_EXAMPLES, p).split("\\").join("/")] : [];
			});
		files = walk(VENDOR_EXAMPLES);
	});

	it("parses the upstream examples (ratchet)", { timeout: 300_000 }, () => {
		const fails: string[] = [];
		for (const rel of files) {
			try {
				if (parsePostgres(readFileSync(join(VENDOR_EXAMPLES, rel), "utf8")).errors > 0) fails.push(rel);
			} catch (e) {
				fails.push(`${rel} THREW ${String(e).slice(0, 80)}`);
			}
		}
		expect(files.length).toBeGreaterThan(0);
		const pass = files.length - fails.length;
		console.log(`\n  bytebase postgresql examples: ${pass}/${files.length} parse`);
		if (fails.length) console.log(`  fails:\n    ${fails.join("\n    ")}`);
		expect(pass, `bytebase example pass count dropped below ${VENDOR_BASELINE}`).toBeGreaterThanOrEqual(
			VENDOR_BASELINE,
		);
	});
});

describe.skipIf(!existsSync(DOCS_CORPUS))("Postgres grammar vs the scraped PostgreSQL-manual corpus", () => {
	it(
		"parses 100% of the query bucket (organizer paths; KNOWN_BAD stay unparsed); lower+scope total; `other` ratchet",
		{ timeout: 1_800_000 },
		() => {
			const tally = new Map<string, number>();
			const samples = new Map<string, string>();
			const throwers: string[] = [];
			const callHits: string[] = []; // Task 12: call-signature diagnostics must be zero over valid SQL
			const bodyEmpty: string[] = []; // body-non-emptiness probe (see tests/helpers/body-probe.ts)
			let scoped = 0;
			let fallbacks = 0;
			runDocsRatchet(DOCS_CORPUS, (sql) => parsePostgres(sql).errors, QUERY_BASELINE, {
				knownBad: KNOWN_BAD,
				parse: (sql) => {
					const r = parsePostgres(sql);
					if (r.sllFallback) fallbacks++;
					return { errors: r.errors, tree: r.tree };
				},
				onCleanQuery: (rel, tree) => {
					try {
						const ir = lower(tree);
						walkIr(ir, tally, samples);
						probeBody(ir, rel, bodyEmpty);
						const scopes = resolveScopes(ir, "postgres");
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
				`\n  postgres: ${scoped} scoped, ${total} \`other\` exprs (baseline ${OTHER_BASELINE}), ${fallbacks} SLL fallbacks (ratchet ${FALLBACK_RATCHET})${top ? "\n" + top : ""}`,
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

describe.skipIf(!existsSync(NEGATIVES))("Postgres negative corpus (issue #5)", () => {
	it("curated near-misses 100%-reject; mutated rejection ratchet", { timeout: 600_000 }, () => {
		runNegativeCorpus("postgres", NEGATIVES, (sql) => parsePostgres(sql).errors, MUTATED_FLOOR);
	});
});
