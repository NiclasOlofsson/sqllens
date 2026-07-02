# SLL Grammar-Surgery Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive the five SLL-sick dialect grammars to healthy fallback rates via profile-guided grammar surgery. Census (2026-07-02, `temp_auto/profile-sll.ts` over the docs `query/` buckets): tsql 16.7%, snowflake 17.6%, postgres 29.6%, duckdb 34.8%, redshift 55.5% of valid files pay the SLL-bail → full-LL double parse; the healthy reference is databricks/trino/bigquery at ≤1.7%. Snowflake averages 40.7 ms/file on ~100-byte doc examples (Databricks: 0.24 ms median on 2.4 KB files). This is the largest single performance lever in the codebase — it leads; the editor-gold wave queues behind it (Niclas, 2026-07-02).

**Architecture:** No new subsystems. Per iteration: the profiler names the costliest grammar decision → exact-ambiguity diagnosis on its trigger files → one rule restructured (subset-alternative pruned / context left-factored / shared prefix hoisted) → `lower()` absorbs the CST shape change onto the UNCHANGED IR → gates prove the language identical → the new fallback ratchet falls. Pure Pareto loop with a monotonicity guard; profile-guided optimization, compiler-style.

**Tech Stack:** TypeScript (tabs), vitest two tiers, antlr-ng (`npm run gen -- <dialect>` after every .g4 edit), antlr4ng `ProfilingATNSimulator`, tsgo, prettier.

## Global Constraints

- **Language preservation is the hard invariant.** A fix may change HOW the grammar decides, never WHAT it accepts or rejects. Enforced three ways per fix: (1) the dialect's corpus gates stay at 100% (nothing valid stops parsing); (2) for every pruned/merged alternative, add explicit reject probes for the nearby *invalid* forms it might now leak (TDD'd in the dialect's feature test — the "grammar never gets dumber about syntax" teeth, standing in until B/C/D Task 9's negative corpora land and take over); (3) doc-coverage suites unchanged.
- **The grammar owns well-formedness; `lower()` owns identity.** Only semantically-undecidable classifications (labels the syntax never could decide, e.g. column-vs-expression) move to lowering. Genuinely syntactic distinctions keep their rules. Doc-cite any rule whose surface syntax is restated (repo convention).
- **"This needs an IR change" is a stop-the-line alarm, not a step.** The language is unchanged, so the meaning-space is unchanged, so the IR cannot legitimately move. If a fix appears to demand it, halt: either the fix isn't language-preserving or a latent defect surfaced — report to Niclas either way.
- **Ratchets only fall.** Task 1 adds a per-dialect SLL-fallback ratchet to the corpus gates; after that, every commit must hold or lower it. All existing gate floors/ratchets unchanged.
- **Sequencing vs the B/C/D branch (in flight):** snowflake + tsql (their grammar tasks done) and postgres + duckdb (untouched by them) are safe NOW in a worktree. **Redshift waits for their Task-5 merge** — do not touch `grammars/redshift/` or `src/redshift/lower.ts` before it lands. `tests/corpus/*.test.ts` will see additive edits from both branches (their Tasks 9-10, our ratchet) — keep ratchet blocks self-contained for clean rebases.
- Regenerate after every .g4 edit (`npm run gen -- <dialect>`); `src/generated/` is build output. Tabs; `npm run format`; `npm run typecheck` clean. Commits end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Subagents on Opus or Sonnet 5, never Fable.
- **Pause points** for Niclas: after Task 1 (instrument committed), after each dialect reaches its exit criterion (Tasks 2-6).

## Exit criterion (per dialect — the Pareto knee, measured not guessed)

Fallback rate **≤2%** of the docs `query/` bucket (the healthy-grammar level), OR the top remaining decision holds **<3%** of total prediction time (the tail isn't worth the churn). Record the achieved number in the gate's ratchet constant with a dated comment.

---

### Task 1: The instrument — committed profiler + fallback ratchet

The wave's tooling, promoted from the throwaway probe (`temp_auto/profile-sll.ts`) into the repo.

**Files:**
- Create: `tools/profile-sll.ts` (run: `node --import tsx tools/profile-sll.ts <dialect> [--decision N]`)
- Modify: every `src/<dialect>/parse.ts` (8 files), `tests/corpus/{tsql,snowflake,postgres,duckdb,redshift}.test.ts`
- Test: `tests/parse-fallback.test.ts` (tier 1, tiny)

**Interfaces (produced):**
- `ParseResult` gains `sllFallback: boolean` — additive, set true when stage 2 ran. Zero cost: the two-stage wrapper already knows; it just doesn't say.
- `tools/profile-sll.ts`: per-dialect census (full query bucket: fallback count/%, two-stage time) + profiled pass (per-decision table: time share, rule name, invocations, ctx-sensitivities, ambiguities, maxLook — the temp_auto probe's shape) + `--decision N` drill-down: re-run the fallback files under `PredictionMode.LL_EXACT_AMBIG_DETECTION` and print, for that decision, the conflicting alternative pairs and 3 sample trigger files. That drill-down is each iteration's diagnosis input.

- [ ] Add `sllFallback` to all 8 parse wrappers (the LL retry path sets it; SLL success leaves it false). Unit test: a valid statement → false; a construct known to SLL-bail (take any census fallback file) → true, parses clean.
- [ ] Write the tool (port the probe; add exact-ambiguity drill-down; keep corpus paths via `tools/corpus-paths.mjs`'s `corpusPath`).
- [ ] Ratchet: each sick dialect's corpus gate counts `sllFallback` over the existing single parse (no re-parse — tier-2 rule) and asserts `<= FALLBACK_RATCHET`, seeded at the measured current value with a dated comment (tsql 259, snowflake 525, postgres 112, duckdb 361, redshift 1004 — re-measure at implementation; B/C/D merges may have moved them). Healthy dialects get no ratchet (they're the target, not the patient).
- [ ] `npm test` + tier-2 green (ratchets seeded at current = no red). Commit: `feat(parse,tools): surface SLL fallbacks + committed profiler — the surgery wave's instrument`

### Tasks 2–6: the surgery loop, one dialect each

Order: **2 = snowflake, 3 = tsql, 4 = postgres, 5 = duckdb, 6 = redshift (blocked on B/C/D merge)**. Snowflake first: biggest absolute time; its B/C/D grammar work is finished. Each task is the same loop run to the exit criterion; the census JSONs (`temp_auto/sll-profile-<dialect>.json`, regenerate via the tool) seed the first iterations.

**The loop (each iteration is one commit):**

1. `node --import tsx tools/profile-sll.ts <dialect>` → take the top decision by prediction time (or by fallback count when that diverges — fallbacks are the user-facing pain).
2. `--decision N` drill-down → conflicting alternative pairs + trigger files. Classify the disease:
   - **Subset alternative** (ambiguities ≈ invocations): one alternative's language ⊆ another's. Transform: delete the subset; the general alternative covers it; `lower()` reclassifies by inspecting the parsed shape (the healthy-grammar idiom — cf. Spark's single `namedExpression : expression (AS? …)?`).
   - **Context sensitivity** (ctx > 0, drives the bails): decidable only via the rule's caller. Transform: left-factor — split into caller-specialized rules or hoist the discriminating token above the fork, so local lookahead suffices.
   - **Shared prefix** (maxLook in the hundreds, low ambiguity): `x y suffix1 | x y suffix2` → `x y (suffix1 | suffix2)`.
3. Apply the transform to the ONE rule (+ its immediate satellites); regen; adjust the dialect's `lower.ts` where the CST shape moved (IR output identical — see the alarm constraint).
4. TDD guards in the same commit: (a) 2-3 of the trigger files' constructs as feature-test cases asserting they parse AND `sllFallback === false` now; (b) reject probes for invalid forms adjacent to any pruned alternative.
5. Verify: `npm run gen -- <dialect>`; dialect feature tests; **full tier-2 for the dialect** (corpus 100%, `other`-ratchet unchanged, fallback ratchet LOWERED to the new measured count); typecheck/format.
6. Commit `perf(<dialect>): <rule> — <disease> fix; fallbacks N→M`. Loop until the exit criterion.

**Known first targets (from the census — re-profile before trusting, the B/C/D branch moves grammars):**

- [ ] **Task 2 — snowflake** (17.6% → ≤2%): `select_statement` (43.9% of time, amb 861/876), `expression_elem` (16.4%, amb 889/890), `select_list_elem` (`column_elem | column_elem_star | expression_elem` at SnowflakeParser.g4:4974 — the textbook subset case), `function_call` (amb 874/1091, maxLook 169), `query_statement` (maxLook 457). Also re-run the ~40.7 ms/file number after: expect order-of-magnitude drop; record it in the PLAN.md/memory perf notes.
- [ ] **Task 3 — tsql** (16.7% → ≤2%): `function_call` (29.2%, amb 746/1201), `select_statement` (amb 889/990), `sql_clauses`/`batch` (statement-boundary ambiguity — T-SQL's optional semicolons; expect the fix here to be prefix-hoisting, not pruning), `full_table_name` (ctx 250, maxLook 132), `declare_statement` (ctx 51).
- [ ] **Task 4 — postgres** (29.6% → ≤2%): `target_el` (44.8%, amb 342/779), `c_expr` (ctx 173, maxLook 613), `target_list` (maxLook 751). Fixes here are the dress rehearsal for duckdb and redshift — same TVL lineage, likely the same rules.
- [ ] **Task 5 — duckdb** (34.8% → ≤2%): `simple_select_pramary` (47.5%, amb 440/855 — upstream typo and all), `c_expr` (ctx 401), `target_el` — port Task 4's fixes first, then profile for duckdb-specific residue (FROM-first queries, star modifiers).
- [ ] **Task 6 — redshift** (55.5% → ≤2%) — **starts only after the B/C/D branch merges** (their Task 5 owns redshift lower/grammar until then): `simple_select_pramary` (68.5%, amb 871/880), `c_expr` (ctx 848, maxLook 563). Port the postgres/duckdb fixes, profile the residue (Redshift-specific surface: `(+)` joins, PartiQL).

### Task 7: close the wave

- [ ] Re-run the full census (all 8) with the committed tool; record the league table in `docs/PLAN.md` (perf/health note) and truth-up CLAUDE.md's Current status with one line (fallback ratchets live, per-dialect numbers). Update the `sll-health-census` memory equivalent in the PLAN if referenced.
- [ ] Editor-gold plan sequencing note flips: it now queues behind THIS wave + B/C/D.
- [ ] Optional footnote experiment (skip unless Niclas asks): re-run the Rust-vs-antlr4ng Snowflake benchmark post-surgery — the 6.6× was measured on the pathological grammar; the honest ratio is the healthy-grammar one.
- [ ] `npm run test:all` green; final commit `docs: SLL surgery wave close — league table + ratchet state`.

---

## Self-review notes

- **Coverage:** instrument (1), five sick dialects worst-pain-first within the collision constraints (2-6), close-out (7). Healthy dialects deliberately untouched — no ratchet, no churn.
- **Dependencies:** Task 1 before all (the ratchet + drill-down are the loop's guard and input). Tasks 2-5 independent of each other and of B/C/D's remaining work; Task 6 hard-blocked on the B/C/D merge. Task 4 before 5 and 6 is soft (fix-porting economy), not correctness.
- **Honest scope flags:** (a) exit criteria are measured knees, not promises — a dialect may stall above 2% if its remaining conflicts are genuinely context-sensitive at acceptable cost; the task then records the achieved knee + why, and Niclas judges at the pause point. (b) tsql's `sql_clauses`/`batch` ambiguity is structural (optional statement terminators) and may be the hardest single item in the wave — if it resists local transforms, it gets reported with options rather than forced. (c) The census numbers predate the B/C/D merge; every task re-profiles before cutting. (d) Trigger-file TDD cases quote proprietary-corpus constructs only for databricks (not in this wave); the five patients' corpora are scraped vendor docs — cite the doc page, not the corpus file, in committed tests.
