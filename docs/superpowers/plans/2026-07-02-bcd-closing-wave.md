# B/C/D Closing Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close everything left on the 2026-07-01 assessment's Tracks B, C and D: the never-wrong inference follow-ups and signature harvesting (B), every enumerated parse/lower hole — the three `other`-ratchet burn-downs, BigQuery's 19 grammar gaps, Redshift PIVOT/UNPIVOT + CONNECT BY, Databricks issue #4 (C), and the verification residue — negative corpora for six dialects (issue #5), doc-coverage pinning for four dialects, the docs-staleness sweep (D). LSP stays untouched (parked by Niclas).

**Architecture:** No new subsystems except two tools that mirror existing ones: a signature harvester beside the docs scrapers, and a corpus mutator beside the organizer. IR changes are additive optional fields (`qualifier` on function exprs; typed columns on sources). Grammar work follows the established TDD-for-grammars loop (corpus case → fail → doc-cited grammar edit → green). Everything rides the existing gates; ratchets only fall.

**Tech Stack:** TypeScript (tabs), vitest two tiers, antlr-ng (`npm run gen -- <dialect>` after any .g4 edit), tsgo, prettier.

## Global Constraints

- **Never-wrong contract**: a missing inference/signature entry yields `unknown`/name-only, never a wrong answer. Doc-cite everything; live-verify anything surprising; deletion over guessing.
- **No gate weakened, ever.** Ratchet baselines may only fall (T-SQL 26, Snowflake 10, BigQuery 234 → all targeting 0; Redshift/Postgres/DuckDB stay 0). Population floors (3088/1555/2976/1808) may only rise, explained by reclassification. `POSITIVE_BASELINE = 14695` and `NEGATIVE_BASELINE = 166` may only rise.
- **The XML-shredding subsystem stays OUT** (its own feature per CLAUDE.md's genuine-boundaries list): Task 3 models the `.value()`/`.nodes()` *expressions* so they stop leaking `other`; it does not extract columns *through* XML documents.
- Corpus repo (`SQL_CORPUS_DIR` → sibling `sqllens-corpus`) is git-backed and private; organizer/mutator changes commit there separately, moves/adds only.
- `src/generated/` is build output; regen after every .g4 edit. Tabs; `npm run format`; `npm run typecheck` clean. Commits end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Long runs → background execution (background shells cannot redirect into workspace files). Known vitest flake ("reading 'config'", every file failing in ~5s) → rerun. Transient "claude-opus-4-8 temporarily unavailable" refusals → wait 30-60s, retry same command.
- Subagents on Opus or Sonnet 5, never Fable.
- **Pause points** (controller may stop for Niclas between): after Task 2 (Part B done), after Task 5, after Task 8 (Part C done), after Task 11 (wave done).

---

## PART B — inference & signatures

### Task 1: Never-wrong engine follow-ups — qualified dotted keys, EXTRACT, avg/div/generate_array

Three related fixes filed by the parity wave's final review (PLAN.md Open Gaps bullet, 2026-07-02).

**Files:** `src/ir/ir.ts` (function Expr), `src/bigquery/lower.ts:1430-1443` (`lowerFunctionCall`) + `lowerExtract` (~1537), `src/infer/infer.ts` (`functionType` lookup), `src/infer/bigquery.ts` (rules), tests: `tests/infer.registry.test.ts`, `tests/bigquery.pipeline.test.ts`.

**Interfaces:** function Expr gains `qualifier?: string` (the dotted path before the last segment, lowercased — additive, optional, no other dialect sets it). `functionType` lookup order becomes: `registry[qualifier + "." + name]` → `registry[name]` → unknown.

- [ ] **1a — qualified keying.** BigQuery's `lowerFunctionCall` currently keeps only the last path segment (line 1433-1435). Keep `name` as-is (last segment) and set `qualifier` when the path has more segments. Registry: re-key the dotted families under their qualified names — `hll_count.init/merge/merge_partial/extract`, `kll_quantiles.*`, `net.*`, `keys.*`/`aead.*` if present — so `hll_count.extract` regains its documented INT64 without colliding with bare EXTRACT. Bare-name entries for those families are removed (a bare `merge(...)` call must NOT resolve via an hll rule). TDD: probe `hll_count.extract` → bigint through a lowered call (pipeline test, not just the registry object), and bare `extract` still undefined in the registry.
- [ ] **1b — EXTRACT special-case.** The precedent is Databricks's lower normalizing special forms (`lowerTimestampFn`, `src/databricks/lower.ts:1050-1056`). Check what `lowerExtract` emits for the datepart today; make the datepart arrive as a recognizable literal/text on the lowered call, then add a narrow special case in `functionType` (or a pre-registry hook) for BigQuery `extract`: map the part keyword → type per the documented table (YEAR/MONTH/DAY/…/DAYOFWEEK/WEEK/ISOWEEK/QUARTER/HOUR/MINUTE/SECOND/MILLISECOND/MICROSECOND → int64; DATE → date; TIME → time; DATETIME → timestamp-family per `BQ_ALIASES`); unrecognized part → unknown. Doc-cite the part table. TDD: `EXTRACT(YEAR FROM ts)` → int, `EXTRACT(DATE FROM dt)` → date, `EXTRACT(bogus FROM x)` → unknown.
- [ ] **1c — the three pins become type-computed rules** (they are argument-TYPE-dependent, which FnRule can express — the prior "value-dependent" label was imprecise): `avg` (int/float64 → double; numeric → numeric... hmm — VERIFY the exact AVG/DIV/GENERATE_ARRAY return-type tables on their live doc pages first and encode exactly what they state; where a case genuinely isn't determinable from arg types, fall through to unknown). `div` (INT64,INT64→INT64; NUMERIC→NUMERIC; BIGNUMERIC→BIGNUMERIC). `generate_array` (element type follows the arguments' common numeric type). Each rule doc-cited; the misleading comments corrected.
- [ ] **Verify + commit:** `npx vitest run tests/infer.registry.test.ts tests/bigquery.pipeline.test.ts tests/infer.arity.test.ts` green; `npm test`; typecheck/format. Update `BQ_FLOOR` to the exact new count (qualified keys change it — report the arithmetic). One commit: `feat(infer): qualified dotted-call keys, EXTRACT part-aware typing, computed avg/div/generate_array rules`.

### Task 2: Signature harvesting — kill the ~36-function ceiling on signature help

Curated tables today: Databricks 37 / T-SQL 36 / Snowflake 36 / BigQuery 36 / Redshift 31 / Postgres 49 / DuckDB 51 (`src/signature/signatures.ts:476-484`). Consumers: `signatureAt` (`src/signature/signature.ts:108-110`) and completion-resolve (`src/lsp/features/completion-resolve.ts:21`). Everything else falls back to name-only hints.

**Design:** a harvester tool per the scraper pattern — `tools/harvest-signatures.mjs` — that mines each dialect's docs source for function syntax blocks and emits **committed, generated** tables `src/signature/generated/<dialect>.ts` (provenance header naming the tool + source + date; rebuildable, never hand-edited). Lookup order in `signature.ts`: curated (hand-verified, wins) → harvested → name-only fallback. `FnSignature` shape unchanged.

**Hard rules:** a harvested signature is emitted ONLY when its syntax block parses unambiguously into `name(param[, param…])` form — anything else (overload prose, optional-group ambiguity the parser can't resolve, tables) is skipped, counted, and reported. Wrong param names/arity are worse than the name-only fallback; skip aggressively. Dialects without a harvestable docs source in the corpus repo get no generated table (report which).

- [ ] Build the harvester: source per dialect from the corpus repo's docs trees (the scrapers' output retains per-page provenance — inspect `manifest.json`/page structure per dialect first and write per-dialect syntax-block extractors only where the format is consistent; start with the two cleanest sources, then extend to the rest, reporting per-dialect yield).
- [ ] Wire lookup order (curated → harvested → fallback) in `signature.ts` + completion-resolve; keep `functionName()`'s membership check working across both layers.
- [ ] Tests: per-dialect harvested-count floors (pinned at achieved yield, ratchet); spot-checks per dialect (3-5 doc-verified signatures incl. one variadic); precedence test (curated beats harvested for a name in both); fallback unchanged for absent names. LSP signature acceptance tests stay green.
- [ ] `npm test` + tier-2 (signature tables don't touch gates, but prove it) + typecheck/format. Commit: `feat(signature): harvested per-dialect signature tables from the docs corpora; curated set becomes the override layer`.

**PAUSE POINT — Part B done.**

---

## PART C — parse/lower completeness

### Task 3: T-SQL — `other` 26 → 0, and OPENJSON/OPENXML WITH-column types

Measured leakers (live run): 18 × `Select_list_elemContext` — XML method calls (`x.value('(@name)[1]','varchar(100)')` etc.) — and 8 × `PredicateContext` — `REGEXP_LIKE(...)` predicate forms. Baseline at `tests/corpus/tsql.test.ts:40`.

- [ ] **Model the XML method-call expressions**: `.value()/.query()/.exist()/.nodes()` chained calls lower to typed `function` exprs (the receiver as first arg or via the `qualifier` field from Task 1a — pick whichever reads cleanest against the CST; the OUT-of-scope boundary stands: no XML shredding, the expr is typed by its second argument where it's a literal type string — `x.value(path, 'varchar(100)')` → string — else unknown).
- [ ] **Model the REGEXP_LIKE predicate forms** → `predicate` IR.
- [ ] **OPENJSON/OPENXML WITH types**: `src/tsql/lower.ts:421-423` keeps only each `column_declaration`'s `id_`; also capture its data-type child. `Source` gains an additive optional `declaredColumns?: { name: string; type?: string }[]` (keep `columnAliases` populated as today for compatibility); `resolveScopes`/`qualify` consume the types so those sources' output columns are typed (they flow into hover/inlay through the existing pipeline). TDD with an OPENJSON WITH example asserting a typed output column.
- [ ] Ratchet 26 → **0** at `tests/corpus/tsql.test.ts:40`; adventureworks + tsql.conformance + doc-coverage all green; `npm run test:corpus` green. Commit per logical unit (XML exprs; regexp; WITH types) or one — implementer's call, trailers on all.

### Task 4: Snowflake — `other` 10 → 0, and CONNECT BY modelling

Leakers: 10 × `Object_nameContext` — sequence references (`seq_01.NEXTVAL` family). CONNECT BY flag at `src/snowflake/lower.ts:660-661`.

- [ ] **Sequence refs**: lower `<seq>.NEXTVAL` (and `.CURRVAL` if the grammar accepts it) to a `function` expr (`name: "nextval"`, `qualifier: <seq name>` — Task 1a's field) typed per the Snowflake docs (NUMBER → decimal alias). Doc-cite. Ratchet 10 → **0** at `tests/corpus/snowflake.test.ts:40`.
- [ ] **CONNECT BY**: un-flag (`lower.ts:660-661`); the START WITH / CONNECT BY predicates lower as ordinary exprs on the select (kept in `columns` via the existing `columnsOf` conservation path); `LEVEL` resolves as a pseudo-column in scope for hierarchical selects (follow how other pseudo-columns/outputs enter scope — smallest mechanism that makes `SELECT LEVEL, …` resolve; `PRIOR x` lowers as a unary/function expr over `x`). Doc-cite docs.snowflake.com CONNECT BY. TDD: a doc example resolves with LEVEL bound and zero `unsupported` flags.
- [ ] Gates green (`tests/corpus/snowflake.test.ts` incl. pipeline totals); `snowflake.pipeline.test.ts` extended for a CONNECT BY case. Commit.

### Task 5: Redshift — PIVOT/UNPIVOT + CONNECT BY modelled

Redshift flags where three dialects model: pivot/unpivot at `src/redshift/lower.ts:457-464` (incl. the PartiQL-SUPER unpivot at :464), connect-by at `:401-402`. Precedents: Databricks `extractPivot/extractUnpivot` (`src/databricks/lower.ts:767-791`), T-SQL (`src/tsql/lower.ts:329-361`), Snowflake (`src/snowflake/lower.ts:454-481`) — all onto the shared `PivotInfo`/`UnpivotInfo`.

- [ ] Port the pattern for Redshift's Postgres-derived CST shapes: SQL PIVOT/UNPIVOT → `PivotInfo`/`UnpivotInfo`; PartiQL `UNPIVOT expr AS val AT attr` → `UnpivotInfo` (value/name columns from AS/AT). Un-flag all three sites; CONNECT BY reuses Task 4's approach (LEVEL pseudo-column, PRIOR expr).
- [ ] The flip-when-implemented markers in `tests/lower-completeness.test.ts:162-182` flip from asserts-flagged to asserts-modelled (that is their documented purpose). `redshift.ir.test.ts` pivot/unpivot expectations updated to modelled shapes. Ratchet stays **0**; docs gate green. Commit.

### Task 6: BigQuery — the 19 unparsed in-scope positives

`POSITIVE_BASELINE = 14695` of 14714 (`tests/corpus/bigquery.analyzer.test.ts:37-40`). The gate collects `fails` but never prints filenames (line 122-127).

- [ ] **First**: make the gate print the failing files (a `console.log` of `fails` — permanent improvement, tiny).
- [ ] Triage the 19 into (a) real grammar gaps — pipe `AGGREGATE WITH DIFFERENTIAL_PRIVACY`, multi-level aggregation `agg(x GROUP BY …)`, TVF `TABLE`/scalar args, `WITH POSITION` on param-table sources, chained braced call — fix each in `grammars/bigquery/*.g4`, doc-cited to `googlesql.tm` (the ground-truth Textmapper grammar), regen, TDD-for-grammars; and (b) mis-bucketed ZetaSQL errors — classify OUT in the shared extractor (`tools/googlesql-testdata.mjs`), rebuild the extracted corpus (`tools/extract-googlesql-tests.mjs`, needs `vendor/googlesql`; corpus-repo commit), so both ZetaSQL gates stay symmetric.
- [ ] Raise `POSITIVE_BASELINE` to the achieved ceiling (report the split: N grammar-fixed, M classified-out; in-scope positives should hit 100% of the remaining population — if anything still fails, it stays enumerated in the baseline comment, never silently tolerated). `NEGATIVE_BASELINE` must not fall; the parser-corpus gate (`bigquery.parser.test.ts`) stays at its floors. Commit(s).

### Task 7: BigQuery — `other` 234 → 0 (the big one)

Leaker census (live run): `Braced_constructorContext` 73 + `Braced_new_constructorContext` 49 + `Struct_braced_constructorContext` 47 + `New_constructorContext` 27 = **196 constructor forms**; `With_expressionContext` 28; `And_expressionContext` 7; `Replace_fields_expressionContext` 3. Baseline at `tests/corpus/bigquery.analyzer.test.ts:45`.

- [ ] **Constructors (196)**: lower braced `{f: v}`, `NEW T{…}` / `NEW T(…)`, `STRUCT{…}` onto the existing constructor-shaped IR the way `struct`/`named_struct` calls lower today (a `function` expr named `struct`/`new` with the field values as args is acceptable-minimal IF conservation keeps every field expr visible and inference can type `STRUCT` constructors where field types are knowable; check how `src/infer/infer.ts`'s `constructor` case consumes these and extend it for the braced field-name form). No dropped field exprs — the conservation gate is the check.
- [ ] **`WITH` expressions (28)**: ZetaSQL's expression-scoped `WITH(a AS expr, …, result)`. Model minimally-honest: lower to the result expression with each binding lowered and retained (bindings visible to conservation and the walker; a binding reference inside `result` may resolve as a plain column ref — document the boundary in the lowering comment). If a genuinely new Expr kind is needed, extend `tests/helpers/ir-walk.ts` + `freezeIR` + conservation in the same change.
- [ ] **`And_expressionContext` (7) + `Replace_fields_expressionContext` (3)**: investigate the 7 first (an `and` leaking suggests a shape bug, not a missing feature); `REPLACE_FIELDS(expr, new AS path…)` lowers as a function expr with all args.
- [ ] Ratchet 234 → **0**; the pipe drift-guard and both ZetaSQL gates stay green; `bigquery.pipeline`/`bigquery.graph` extended with one case per new form. This task is corpus-driven: run the gate, model the top leaker, repeat. Commits at construct-family boundaries.

### Task 8: Databricks issue #4 — the six deferred constructs

`tests/databricks-corpus-known-bad.ts:34-55`, 13 DEFERRED_GRAMMAR entries. One is scraper noise, not grammar: `pipeop/21.sql` carries appended result-table rows from a bad scrape — fix at the scraper/corpus level (clean the file or teach `tools/scrape-databricks-docs.mjs` the pattern; it moves to KNOWN_BAD-scraper-noise, not grammar work).

- [ ] Grammar work, each doc-cited to docs.databricks.com and TDD'd in `tests/databricks.test.ts`/`databricks.ir.test.ts`: (1) `WITH (CREDENTIAL <name>)` table-reference option; (2) `VALUES … tab(cols) |> AS name` — piping an inline aliased VALUES relation (the residual pipe gap in `pipeop/6.sql`); (3) `?::` try-cast (lowers as `try_cast`); (4) `expr : <TYPE>` type ascription (distinct from the variant colon-path — the grammar must disambiguate on the right-hand side being a type); (5) `name => value` named-argument invocation (IR: keep the arg expr; the name may ride a new optional field on the function-arg or be dropped-with-comment — smallest honest model, conservation-visible); (6) `COLLATION FOR (expr)`.
- [ ] Regen; every Databricks gate green (oatly 1558 + docs + doc-coverage — the doc-coverage probes for these constructs flip from `noparse` where pinned).
- [ ] **Organizer rerun** for `databricks/docs` (`ORGANIZE=1`, corpus-repo commit): the fixed files graduate `unparsed/` → `query/`; the DEFERRED_GRAMMAR list EMPTIES (the residency assertions would fail otherwise — that's the mechanism working); the docs floor rises above 3088 accordingly. Close issue #4: `gh issue close 4 --repo NiclasOlofsson/sqllens --comment "All six constructs parse; corpus files graduated to the gated query bucket."`

**PAUSE POINT — Part C done.**

---

## PART D — verification

### Task 9: Negative corpora for six dialects (closes issue #5)

Only BigQuery is two-sided today. The corpus layout and organizer already handle `validity=negative` generically (`tools/organize-corpus.test.ts:148-150` pins parser negatives, never reclassified); only BigQuery populates it. Per issue #5: mutation for volume, curated near-misses for signal.

- [ ] **`tools/mutate-corpus.mjs`**: deterministic (seeded — no `Date.now`/`Math.random` without a fixed seed), reads each dialect's `docs/parser/positive/query/` bucket, emits mutants to `docs/parser/negative/mutated/<class>/…` in the corpus repo. Mutation classes: unbalance a paren/quote, delete a required keyword (FROM/BY after GROUP), swap adjacent keywords, truncate mid-token, duplicate a comma. **Honesty rule:** mutation cannot guarantee invalidity (deleting an optional token yields valid SQL), so mutated gates are REJECTION-RATE RATCHETS (pinned at measured rate, may only rise), never 100% bars. Cap volume (e.g. 2 mutants/file, bounded per dialect) so tier-2 stays sane — report the tier-2 delta.
- [ ] **Curated near-miss sets**: ~20-30 per dialect (databricks, tsql, snowflake, redshift, postgres, duckdb), hand-authored, each doc-informed and commented with WHY it's invalid in that dialect (wrong clause order, reserved word as bare identifier, a sibling dialect's construct — e.g. `QUALIFY` where unsupported, T-SQL `TOP` in postgres). These live in-repo as test fixtures or in the corpus repo under `negative/curated/` — corpus repo, keeping the layout uniform. 100%-rejection bar for curated (a false-accept here is a real grammar precision bug: investigate, fix the grammar or the case, never exclude silently).
- [ ] Gates: extend each dialect's `tests/corpus/<dialect>.test.ts` with the negative side (mirror `bigquery.analyzer.test.ts:142`'s shape): curated 0-accepted; mutated ≥ pinned floor. Snowflake's 3 existing reject unit tests stay; fold their cases into the curated set too.
- [ ] Corpus-repo commit (adds only); repo commit; tier-2 green with reported wall-clock delta. Close issue #5 with the per-dialect numbers.

### Task 10: Doc-coverage pinning suites — snowflake, redshift, postgres, duckdb

Template: `tests/databricks.doc-coverage.test.ts` (134 probes; `Probe = [name, sql, expected]`, `Expected = "query" | "nonquery" | "noparse"`, `outcome()` drives parse→lower→resolveScopes) and `tests/tsql.doc-coverage.test.ts` (91 probes). None exist for the other four.

- [ ] One suite per dialect (`tests/<dialect>.doc-coverage.test.ts`), 60-100 probes each, built from the official reference's construct list (docs.snowflake.com sql-reference, AWS Redshift SQL reference, postgresql.org/docs/18, duckdb.org/docs/current), every probe doc-cited by page in a comment. Pin the CURRENT support level honestly — `noparse`/`nonquery` where that's today's truth (these suites pin state, they don't demand features); the flip-an-entry-in-the-change-that-builds-it convention from the Databricks suite's header carries over.
- [ ] Tier-1 suites (fast, no corpus dependency); green; commit per dialect or one — implementer's call.

### Task 11: Docs staleness sweep + wave close

All verified stale (recon 2026-07-02):
- [ ] `src/snowflake/lower.ts:25-27` header — QUALIFY/star-modifiers are modelled (lines 320-352, 501-523); rewrite the header to current truth.
- [ ] `docs/snowflake-backlog.md:25-26` item 2 (index.ts exports — done long ago): drop it; while there, re-verify items 1/3/4 against current state and prune what Tasks 4/9 of this wave resolved.
- [ ] `docs/PLAN.md:55` — the four-dialect `Dialect` union example → seven members (match `src/api.ts:48`).
- [ ] `CLAUDE.md:44,51` + `docs/PLAN.md:364` — "352" → 351 (matches `BQ_FLOOR` and the live count; adjust again if Task 1 moved it — state the then-current number).
- [ ] `README.md` LSP matrix: add the missing notebook-document-sync row (◻️ not yet); the configuration row gains the parenthetical that file-based `.sqllens.json` config exists (protocol config doesn't).
- [ ] CLAUDE.md/PLAN.md truth-up for everything this wave changed (ratchets at 0, PIVOT/CONNECT BY modelled, negative gates, doc-coverage ×6, signature layers, issue #4/#5 closed). Current-state phrasing, no narrative, no AI-tells. Final commit; ledger closed.

---

## Self-review notes

- Coverage: B → Tasks 1-2; C → Tasks 3-8 (burn-downs 3/4/7, grammar 6/8, modelling 5; XML shredding explicitly stays out); D → Tasks 9-11. All assessment items accounted for; LSP excluded by direction.
- Dependencies: Task 1a's `qualifier` field is used by Tasks 3 and 4 (method-call/sequence lowering) — Task 1 goes first. Task 8's organizer rerun follows its grammar fixes. Task 9's mutator reads the post-Task-8 corpus (order matters only for the floors it pins). Everything else is independent.
- Honest scope flags: Task 2's harvest yield per dialect is unknown until the docs formats are inspected — the task self-reports yield and skips aggressively rather than guessing. Task 7 is the largest single task (196 constructor forms + a possibly-new Expr kind); its corpus-driven loop may surface IR-design questions — the implementer escalates rather than inventing IR shapes silently. Task 9's mutated-set floors are measured, not promised.
