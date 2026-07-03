# Consolidation Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kill the two silent-wrong parser defects (join-keyword-as-alias, snowflake MV body), ship the two Anvil-blocking API features (Projection `aliasCst`, per-hop lineage per the PLAN.md spec), and — if the wave has room — close trino's verification-parity gap.

**Architecture:** Two grammar-precision fixes with the SLL-surgery proof kit (reject/accept probes + corpus-wide IR hash-diff as the tree-exactness oracle); one small lower routing fix; one additive IR field mirrored across eight lowerings; one new analysis walk (`src/lineage/hops.ts`) beside `originsOf` over the same shared resolver, returning a spine of references into frozen structures. Everything additive on the public surface.

**Tech Stack:** TypeScript (tabs), vitest two tiers, antlr-ng (`npm run gen -- <dialect>` after any .g4 edit), tsgo, prettier.

## Global Constraints

- **Never-wrong contract:** a wrong tree, type, or lineage hop is a defect; `unknown`/`unresolved` is always the fallback, never a guess.
- **No gate weakened, ever.** All tier-2 corpus gates green before any merge; ratchets/floors move only in their permitted direction (fallback ratchets down, negative-corpus rejection floors up, query-bucket populations up-with-explanation). LSP acceptance suites stay green.
- **Grammar edits carry language-exactness proofs:** every alternative change is proven either pairwise-disjoint or corpus-IR-hash-identical over the dialect's full docs `query/` bucket against the pre-change grammar (the SLL-surgery method — see PLAN.md "SLL→LL fallback surgery"); where the fix is a deliberate language change (rejecting a previously-accepted wrong reading), the CHANGED cases are enumerated and each is proven to re-parse to the CORRECT reading, not rejected.
- **Public API additive.** `src/generated/` regenerated, never hand-edited. Tabs; `npm run format`; `npm run typecheck` (tsgo) clean.
- **Anvil channel protocol** (docs/anvil/CHANNEL.md): ship notes cite master commits inline, wall-clock timestamps, write⇒commit immediately. The defect block's ship note MUST include the per-dialect affected-shapes list and a rerun ping (ITEM 9 asks a+b).
- Subagents on Opus or Sonnet 5, never Fable. Commits end with:
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
- Corpus repo via `SQL_CORPUS_DIR` (committed `.env`); corpus-repo changes (organizer moves) commit there separately.
- No pause points: escalate to Niclas only on a genuine fork (e.g. a fix that must widen/narrow the language beyond the enumerated wrong-reading set).

---

## TASK 1 — DuckDB: bare join keywords stop parsing as aliases

**Recon (verified 2026-07-03):** `ASOF`, `POSITIONAL`, `ANTI_P`, `SEMI_P` are in `unreserved_keyword` (grammars/duckdb/DuckdbParser.g4:5504-5512, this fork's additions), making them identifier-usable in every context including the bare (AS-less) table alias. `a SEMI JOIN b` therefore reads SEMI as `a`'s alias and the join becomes a plain (inner) JOIN — silently wrong kind. The join rules live at :3364-3392 (`ASOF join_type? JOIN …`, `(FULL|LEFT|RIGHT|INNER_P|SEMI_P|ANTI_P) OUTER_P? …`).

**Files:**
- Modify: `grammars/duckdb/DuckdbParser.g4` (the bare-alias path — find where table aliases derive from `ColId`/`unreserved_keyword`; the fix targets the BARE alias only, explicit `AS semi` stays legal)
- Test: `tests/duckdb.test.ts` (feature TDD), corpus gates untouched (they re-prove)
- Regen: `npm run gen -- duckdb`

**Interfaces:** none new — tree-shape fix only. `lower.ts` needs no change if the join now parses through the existing join path (verify: the Join IR node must come out `kind: "semi"` etc.).

**Ground truth to verify before coding (doc-cite in the grammar comment):** what real DuckDB does with `FROM a SEMI JOIN b` (join wins — verify against duckdb.org/docs/current/sql/query_syntax/from and/or duckdb's libpg_query grammar precedence) AND with `FROM t semi` alone (alias reading legal?). Encode exactly the engine's resolution.

- [ ] **Step 1: failing tests.** `SELECT * FROM a SEMI JOIN b ON a.x = b.x` → IR has `joins[0].kind === "semi"` (currently: no semi join, `b`… mis-shaped tree). Same for `ANTI JOIN`, `ASOF JOIN`, `POSITIONAL JOIN` after a bare table ref. Positive-control cases: `FROM t AS semi` still parses (explicit AS), `SELECT semi FROM t` still parses (column position unaffected).
- [ ] **Step 2: grammar fix.** Prefer the structural split (the SLL-surgery house style): a `bare_alias_keyword` class = `unreserved_keyword` minus the four join-openers, used ONLY in the AS-less alias slot; the explicit-AS slot keeps full `unreserved_keyword`. If DuckDB's engine resolves differently (e.g. alias legal when NOT followed by JOIN), a one-token lookahead predicate is acceptable — but argue the choice in the grammar comment with the doc citation.
- [ ] **Step 3: regen + proofs.** `npm run gen -- duckdb`. Proof kit: (a) the new tests green; (b) corpus IR hash-diff over `duckdb/docs` `query/` (all 1,037) vs the pre-change grammar — every file identical EXCEPT an enumerated changed-set, and each changed file's new tree is verified to be the join reading (list them in the report); (c) `npm run test:corpus` — duckdb gate green, fallback ratchet not risen.
- [ ] **Step 4: negative floors.** Run the duckdb mutated-negative gate; if rejection count rose (mutants of this shape now rejected), raise the pinned floor to the measured value in `tests/corpus/duckdb.test.ts`. Report the delta.
- [ ] **Step 5: commit** `fix(duckdb): bare SEMI/ANTI/ASOF/POSITIONAL before JOIN are join keywords, not aliases` (+ trailer).

## TASK 2 — Snowflake: LEFT/RIGHT stop parsing as aliases before JOIN

**Recon (verified 2026-07-03):** `alias : id_` (grammars/snowflake/SnowflakeParser.g4:~4363 area) and `id_` includes `binary_builtin_function` (:~4536 region), which contains `LEFT` and `RIGHT` (the 2-arg string functions). So `FROM t LEFT JOIN u ON …` — the dominant join spelling in dbt models — reads LEFT as `t`'s alias; the join degrades to plain JOIN (inner). FULL/INNER/CROSS/NATURAL are NOT in any `id_` path (verified) — snowflake's affected set is exactly {LEFT, RIGHT}.

**Files:**
- Modify: `grammars/snowflake/SnowflakeParser.g4` (the `as_alias : AS? alias` split: explicit-AS keeps `alias`/`id_` in full; the bare branch uses an alias id class excluding LEFT/RIGHT — smallest structural change that removes the wrong reading)
- Test: `tests/snowflake.test.ts`; regen `npm run gen -- snowflake`

**Wait — first verify the mis-parse is REAL:** parse `SELECT * FROM t LEFT JOIN u ON t.a = u.a` with the current parser and inspect the IR joins. It is possible ANTLR's alternative ordering already prefers the join reading in the common case and the bug bites only in specific shapes (e.g. inside `object_ref … as_alias? …` before `join_clause*`). Map the ACTUAL affected shapes empirically (a small probe script over: bare `t LEFT JOIN`, parenthesized, with sample, with pivot, `t RIGHT JOIN` …) — the affected-shapes list is a deliverable (CHANNEL ITEM 9 ask a). If the common shape turns out correct today, the fix narrows to the genuinely broken shapes; report honestly either way.

- [ ] **Step 1: probe + failing tests** per the empirical map (each broken shape → a test asserting `joins[0].kind === "left"|"right"` and the alias ABSENT).
- [ ] **Step 2: grammar fix** (bare-alias id class minus LEFT/RIGHT; explicit `AS left` stays legal; `SELECT LEFT(x,1)` function calls unaffected — they never route through alias).
- [ ] **Step 3: regen + the same proof kit as Task 1** over `snowflake/docs` `query/` (2,976 files): hash-identical except the enumerated changed-set, each changed tree verified as the join reading; snowflake gate green; fallback ratchet (115 floor) not risen — watch this closely, LEFT/RIGHT ambiguity may interact with SLL prediction.
- [ ] **Step 4: negative floors** (snowflake mutated gate; raise floor if measured higher).
- [ ] **Step 5: commit** `fix(snowflake): bare LEFT/RIGHT before JOIN are join keywords, not aliases` (+ trailer).

## TASK 3 — Snowflake: CREATE MATERIALIZED VIEW … AS SELECT lowers its body

**Recon:** PLAN.md Open Gaps :99 — MV lowers as opaque `nonquery` while CREATE VIEW / CTAS / CREATE TASK model their embedded SELECT. The DDL shell stays unmodelled (cleared-Out scope); only the `AS SELECT` body routing changes, mirroring the sibling forms.

**Files:**
- Modify: `src/snowflake/lower.ts` (find the statement dispatch where `create_view`'s body routes to the query lower — grep `create_view` / the `statementCategories` walk — and replicate for the materialized-view rule)
- Test: `tests/snowflake.test.ts` + `tests/snowflake.doc-coverage.test.ts` (the MV probe flips from its current pinned level to `query` — that flip is the doc-coverage convention working)

- [ ] **Step 1: failing test.** `CREATE MATERIALIZED VIEW mv AS SELECT a, b FROM t` → `ast.statement` matches the CREATE VIEW convention (same kind the siblings produce), body is a real select (projections a,b; source t), `resolveScopes` binds them.
- [ ] **Step 2: implement** (route the body; statement kind matches the sibling CREATE forms' convention exactly — read what CREATE VIEW stamps and copy it).
- [ ] **Step 3: green + corpus.** `npm run test:corpus` — snowflake docs gate: some `ddl/`-bucket MV files may now classify as query-bucket material; if `statementCategories` changed, run the organizer (`ORGANIZE=1`, corpus-repo commit) and explain the floor moves in the commit body. Doc-coverage probe flipped.
- [ ] **Step 4: commit** `fix(snowflake): CREATE MATERIALIZED VIEW routes its AS SELECT body like its sibling CREATE forms` (+ trailer).

## TASK 4 — Defect-block close: the CHANNEL ship note

**Files:** `docs/anvil/CHANNEL.md` (ITEM 7 + ITEM 9 updates), `docs/PLAN.md` (join-alias line moves from Open Gaps to fixed, MV line :99 removed/updated), `CLAUDE.md` (the two defect mentions truth-up, current-state phrasing, no AI-tells)

- [ ] **Step 1:** CHANNEL ITEM 7 ship note: commits cited, **the affected-shapes list per dialect** (Task 1's four keywords + Task 2's empirical map — exactly what anvil asked in ITEM 9a), the negative-floor deltas, and **the rerun ping** (ITEM 9b: "rerun your shadow harness + join-stage tests against master `<merge-commit>`"). Wall-clock stamp, commit immediately.
- [ ] **Step 2:** PLAN.md/CLAUDE.md truth-up for the three fixes. Commit `docs: defect-block close — ship note, affected shapes, gap lines retired` (+ trailer).

## TASK 5 — `aliasCst` on Projection (Anvil ITEM 5)

**Recon:** `Projection { name?, isStar, expr, cst }` (src/ir/ir.ts:409-416). `TableSource`/`SubquerySource` already carry `aliasCst`, and `src/ir/freeze.ts` already skips fields NAMED `aliasCst` — reuse the exact name so freeze needs no change (verify that skip is by name, not by owner type, before relying on it).

**Files:**
- Modify: `src/ir/ir.ts` (Projection gains `aliasCst?: ParserRuleContext` — the alias identifier's own node, quoting included, absent when there is no explicit alias), all eight `src/<dialect>/lower.ts` projection-lowering sites (capture the alias node where the CST has one; a derived name — bare column ref's own name — gets NO aliasCst)
- Test: `tests/ir.alias-span.test.ts` (new, tier 1)

**Interfaces (produced):** `Projection.aliasCst?: ParserRuleContext` — present ⇔ the projection has an explicit alias token in source; its span covers the alias identifier only (delimiters included), never the AS keyword.

- [ ] **Step 1: failing tests** per dialect: `SELECT a + 1 AS total FROM t` → `projections[0].aliasCst` spans exactly `total`; quoted alias per dialect (`"Total"`, `` `total` ``, `[total]`); implicit-alias-less projection (`SELECT a FROM t`) → `aliasCst` undefined; the anvil edge cases: alias followed by trailing comment, parenthesized expr before the alias.
- [ ] **Step 2: implement** across the eight lowerings (each dialect's projection rule has the alias node in its CST children — same capture style as the sources' aliasCst).
- [ ] **Step 3: green** — new suite + full `npm test` + `npm run test:corpus` (additivity: no gate notices). Verify freeze skips the new field (a frozen-IR test touching aliasCst).
- [ ] **Step 4:** CHANNEL ITEM 5 ship note (commit cited; "delete TODO(sqllens-aliascst)"). Commit `feat(ir): aliasCst on Projection — the alias identifier's own span, all eight dialects` (+ trailer).

## TASK 6 — Per-hop lineage (Anvil ITEM 4)

**Spec:** docs/PLAN.md Open Gaps → "Per-hop lineage — SPEC" — implement it VERBATIM. Locked decisions recap (the spec is the authority where this recap drifts): `LineageHop { scope, projection, expr, downstream, terminal? }` — references into frozen structures, never copies; DAG with shared hops; `lineageAt(scopes, offset, schema?)` + `lineageOf(node, scope, schema?)`; schema optional (schema-free = within-query); `"unresolved"` terminals; set-op forks as pure downstream fan-out (positional vs BY-NAME per the IR flag, INTERSECT/EXCEPT both legs, recursive legs cycle-guard to unresolved); star hops explicit where resolvable.

**Files:**
- Create: `src/lineage/hops.ts` (the walk — **graph-factorable**: internally emit (node, edge) pairs into the spine builder so a later `columnGraph` reuses the emitter, per the WAVE-START commitment; keep the emitter private, no graph API this wave)
- Modify: `src/lineage/lineage.ts` (share `columnRefOrigins`/`derivedOrigins`-adjacent helpers — extract shared resolution steps rather than duplicating; `originsOf` behavior byte-identical), `src/api.ts` + `src/index.ts` (export `lineageAt`, `lineageOf`, `LineageHop`)
- Test: `tests/lineage.hops.test.ts` (tier 1) + a totality sweep added to ONE dialect corpus gate rider (see Step 4)

**Interfaces (produced):**
```ts
export interface LineageHop {
	scope: Scope;                       // frame this hop lives in (pre-existing object)
	projection: Projection;             // the producing projection (cst + Task 5's aliasCst)
	expr: Expr;                         // its expression (cst span)
	downstream: LineageHop[];           // toward base tables; [] at a terminal
	terminal?: Origin[] | "unresolved"; // leaves, or an honest dead end
}
export function lineageOf(node: Expr | Projection, scope: Scope, schema?: SchemaSource): LineageHop;
export function lineageAt(scopes: ScopeTree, offset: number, schema?: SchemaSource): LineageHop | undefined;
```

- [ ] **Step 1: failing tests.** The spec's acceptance set: (a) the brief case `WITH a AS (SELECT x+1 AS y FROM t), b AS (SELECT y*2 AS z FROM a) SELECT z FROM b` — z's spine is b.z(`y*2`) → a.y(`x+1`) → terminal t.x, each hop's projection/expr spans asserted against source offsets; (b) a UNION case — fan-out to both legs, positional matching, different leg column names; (c) a UNION BY NAME case (duckdb) — name matching; (d) a self-join / CTE-used-twice case — shared hop object (reference equality across the two paths); (e) schema-free: unqualified column over a 2-table FROM → `"unresolved"` terminal; same query WITH schema → resolved; (f) `lineageAt` on an offset inside a WHERE clause column ref → same spine as the projection route; on a keyword offset → undefined; (g) recursive CTE → anchor chain + cycle-guarded unresolved recursive leg.
- [ ] **Step 2: translate the anvil contract.** Port the 17 cases from `dbt-studio-vscode/src/ftl/sqllens/lineage.ts`'s test suite into `tests/lineage.hops.test.ts` (read their test file; each case becomes an equivalent assertion against our API — cite the source case in a comment). Failures here are design feedback, not test bugs — investigate before adjusting either side.
- [ ] **Step 3: implement** `hops.ts` per the spec; extract the shared resolution helpers from `lineage.ts` so both walks ride identical binding logic (this is the drift-kill the whole feature exists for).
- [ ] **Step 4: totality + green.** Add a rider to `tests/corpus/databricks.oatly.test.ts`'s existing single pass: for every model, `lineageAt` at 3 sampled offsets (start/middle of first projection, one WHERE-clause ref when present) never throws. Full `npm test` + `npm run test:corpus`.
- [ ] **Step 5:** CHANNEL ITEM 4 ship note: commit cited, API summary, "your clone is deletable — the fold-parity risk dies with it", REPLY-OWED: anvil (confirm deletion or file divergences as new ITEMs). Commit `feat(lineage): per-hop lineage — reference-spine DAG, cursor-anchored, graph-factorable` (+ trailer).

## TASK 7 — Trino verification parity (STRETCH — drops to the next wave without ceremony)

**Recon:** PLAN.md Open Gaps "Trino parity follow-ups". The machinery all exists: `tools/mutate-corpus.mjs` (deterministic mutator, other six dialects' floors pinned), the curated near-miss convention (24/dialect, doc-cited, 100% rejection), `tests/<dialect>.doc-coverage.test.ts` template (Probe/Expected/outcome — snowflake's is the closest sibling), `tools/harvest-signatures.mjs` (per-dialect extractors; trino's sphinx docs are in the corpus repo at `trino/docs`).

- [ ] **Step 1:** mutator run for trino (`docs/parser/positive/query/` → `negative/mutated/`, corpus-repo commit); rejection-rate ratchet added to `tests/corpus/trino.test.ts`, floor pinned at measured.
- [ ] **Step 2:** 24 curated near-misses (doc-cited to trino.io, each with a WHY-invalid comment), 100%-rejection bar in the same gate.
- [ ] **Step 3:** `tests/trino.doc-coverage.test.ts` — 60-100 probes from trino.io/docs/current SQL reference, each pinning CURRENT support level honestly.
- [ ] **Step 4:** signature harvest for trino (inspect the sphinx corpus format first; skip aggressively per the harvester's hard rules; report yield); lookup order already handles the generated table.
- [ ] **Step 5: commit(s)** per unit + PLAN.md "Trino parity follow-ups" entry retired.

## TASK 8 — Wave close

- [ ] `npm run test:all` green; `npm run format`.
- [ ] CLAUDE.md / PLAN.md truth-up (current-state, no AI-tells): defects fixed, aliasCst + hop lineage shipped, trino parity state (done or explicitly still-open).
- [ ] CHANNEL: `WAVE-END (sqllens)` entry — what shipped (commits), what dropped, REPLY-OWED: none.
- [ ] Final commit `docs: consolidation wave close` (+ trailer); merge decision per the standing rule (tier-2 green required; merge to master; push only on Niclas's word).

---

## Self-review notes

- **Coverage vs the agreed scope:** ITEM 7 → Tasks 1-2 (+4 ship note); MV → Task 3; ITEM 5 → Task 5; ITEM 4 → Task 6; trino parity → Task 7 (stretch, pre-agreed droppable); channel obligations (affected shapes, ping, ship notes, WAVE-END) all have explicit steps.
- **Dependencies:** 1/2/3 independent of each other; 4 needs 1-3; 5 before 6 (the hop payload cites `aliasCst`); 6 consumes the PLAN.md spec + Task 5; 7 independent; 8 last. The two grammar tasks are the likeliest Niclas-escalation candidates (language-change beyond the enumerated wrong readings ⇒ stop).
- **Honest risk flags:** (a) Task 2's premise is partially unverified — the plan mandates the empirical probe FIRST and sizes the fix to what's actually broken; the affected-shapes deliverable makes the truth visible either way. (b) Task 6's Step 2 (17-test translation) may surface contract mismatches between their walk and our spec — the plan says investigate-don't-paper; a genuine conflict is a channel conversation, not a silent adjustment. (c) Task 7 is sized like half the wave; it is explicitly the drop candidate and nothing depends on it.
- **Type consistency:** `LineageHop`/`lineageOf`/`lineageAt` match the PLAN.md spec verbatim; `aliasCst` reuses the existing freeze-skipped field name; Task 6 references Task 5's field by its final name.
