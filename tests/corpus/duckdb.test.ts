import { existsSync } from "node:fs";
import { corpusPath } from "../helpers/corpus.js";
import { describe, expect, it } from "vitest";
import { lower } from "../../src/duckdb/lower.js";
import { parseDuckdb } from "../../src/duckdb/parse.js";
import { resolveScopes } from "../../src/scope/scope.js";
import { deriveSymbols } from "../../src/symbols/symbols.js";
import { probeBody } from "../helpers/body-probe.js";
import { sweepCallDiagnostics } from "../helpers/call-check.js";
import { runDocsRatchet } from "../helpers/docs-ratchet.js";
import { runNegativeCorpus } from "../helpers/negative-corpus.js";
import { walkIr } from "../helpers/ir-walk.js";
import { KNOWN_BAD } from "../duckdb-corpus-known-bad.js";

// DuckDB conformance corpus (skipped when absent): duckdb/docs — every ```sql example from the
// duckdb-web docs/current tree (tools/extract-duckdb-docs.mjs, ~2,026 files; duckdb-web is MIT).
// Organizer-bucketed (parser/positive/<kind>/…); the gate trusts the paths and requires 100% of
// the query bucket. DuckDB's PIVOT/UNPIVOT statements classify as query (row-returning reads).

const DOCS_CORPUS = corpusPath("duckdb/docs");
// The negative side (issue #5): mutated (rejection-rate ratchet) + curated (100%-reject).
const NEGATIVES = corpusPath("duckdb/docs/parser/negative/unparsed");
const MUTATED_FLOOR = 333; // 333/400 mutants rejected (2026-07-02)

const QUERY_BASELINE = 900; // documented floor; the gate itself is 100%-of-query-bucket
// The cross-dialect `other` ratchet: DuckDB is expression-corpus-complete — 0 `other`
// (measured 2026-07-02 over the parsed docs query bucket).
const OTHER_BASELINE = 0;

// The SLL→LL fallback ratchet (SLL-surgery wave, task-1-brief.md): DuckDB is grammar-sick — its
// heaviest decisions (simple_select_pramary [sic — upstream typo], c_expr, target_el) force the
// two-stage parse to bail out of the fast SLL prediction path and reparse under full LL. Measured
// 2026-07-03 via `node --import tsx tools/profile-sll.ts duckdb` over this same docs query bucket.
// Counted on the SAME single parse the docs ratchet makes (the `parse:` closure below), never a
// re-parse. Shares its TVL-lineage decisions with postgres/redshift; may only fall.
//
// History: 361 → 52 (func_expr-above-columnref reorder — REJECTED in review: it flipped the reading
// of ALIASED dotted calls, `sch.f(a) AS score` → f(a) with the receiver dropped, because the dotted
// call is a GENUINE columnref/func_expr ambiguity in this fork and min-alt ordering decides the
// reading) → 21 (aexprconst reorder, adjudicated clean) → RAISED to 338 by the revert (the one
// sanctioned direction-up move: correcting an unsound fix) → 25 via the STRUCTURAL cure: the old
// func_expr split into plain_func_expr (undotted call, disjoint from columnref on a full match by
// construction, above it) and dotted_func_expr (below columnref — method-chain reading preserved).
// The split is IR-identical over this whole corpus vs the pre-surgery grammar (hash-diffed, 1037/1037).
const FALLBACK_RATCHET = 25;

describe.skipIf(!existsSync(DOCS_CORPUS))("DuckDB grammar vs the duckdb-web docs corpus", () => {
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
			runDocsRatchet(DOCS_CORPUS, (sql) => parseDuckdb(sql).errors, QUERY_BASELINE, {
				knownBad: KNOWN_BAD,
				parse: (sql) => {
					const r = parseDuckdb(sql);
					if (r.sllFallback) fallbacks++;
					return { errors: r.errors, tree: r.tree };
				},
				onCleanQuery: (rel, tree) => {
					try {
						const ir = lower(tree);
						walkIr(ir, tally, samples);
						probeBody(ir, rel, bodyEmpty);
						const scopes = resolveScopes(ir, "duckdb");
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
				`\n  duckdb: ${scoped} scoped, ${total} \`other\` exprs (baseline ${OTHER_BASELINE}), ${fallbacks} SLL fallbacks (ratchet ${FALLBACK_RATCHET})${top ? "\n" + top : ""}`,
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

describe.skipIf(!existsSync(NEGATIVES))("DuckDB negative corpus (issue #5)", () => {
	it("curated near-misses 100%-reject; mutated rejection ratchet", { timeout: 600_000 }, () => {
		runNegativeCorpus("duckdb", NEGATIVES, (sql) => parseDuckdb(sql).errors, MUTATED_FLOOR);
	});
});
