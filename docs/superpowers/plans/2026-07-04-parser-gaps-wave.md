# Parser-Gaps Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ground-up parser correctness (Niclas's order, 2026-07-04): kill the reject-valid-SQL gaps first (snowflake keyword-token identifier holes; duckdb `[::2]` + literal method-calls), then the lossy-lowering pair (duckdb VARIADIC, redshift `(+)`), with ITEM 12's lineage trail metadata as the feature tail.

**Architecture:** One grammar audit driven by a generated cross-check (lexer tokens vs the `id_` alternation) rather than incident-by-incident whack-a-mole; two scoped duckdb grammar allowances; two small lower fixes; one additive metadata field on the hop walk. Grammar edits carry the language-exactness proof kit throughout.

**Tech Stack:** TypeScript (tabs), vitest two tiers, antlr-ng (`npm run gen -- <dialect>` after .g4 edits), tsgo, prettier.

## Global Constraints

- **Never-wrong contract**; a fix that rejects valid SQL or fabricates IR is a defect. Rejecting-valid-SQL fixes (this wave's core) must each carry a doc citation proving the rejected form IS valid vendor SQL.
- **No gate weakened, ever.** Tier-2 green before merge; ratchets/floors only move in permitted directions; LSP acceptance stays green.
- **Grammar edits carry the proof kit**: corpus IR hash-diff vs pre-change grammar over the dialect's full docs `query/` bucket; enumerated changed-set with each change verified correct; fallback ratchets not risen. (Additions that only ACCEPT MORE — this wave's identifier holes and duckdb allowances — should hash-diff clean with an EMPTY changed-set: previously-parsing files must be untouched.)
- **Public API additive.** `src/generated/` regenerated, never hand-edited. Tabs; `npm run format`; `npm run typecheck` clean.
- **Anvil channel protocol** (docs/anvil/CHANNEL.md): master-only, commit-immediately, wall-clock stamps, shipped ⇒ master commit. ITEM 12's ship note owes the 5-red-case acceptance status.
- Subagents on Opus or Sonnet 5, never Fable. Commits end with:
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
- Corpus repo via `SQL_CORPUS_DIR`; organizer runs commit to the corpus repo separately.
- No pause points; escalate only genuine forks (language changes beyond enumerated wrong readings).

---

## TASK 1 — Snowflake: the keyword-token identifier-hole audit

**Recon (probed 2026-07-04):** `SELECT a FROM regions` fails — `REGIONS` is a dedicated lexer token (grammars/snowflake/SnowflakeLexer.g4:820) used in exactly one rule (`SHOW REGIONS`, parser :3884) and absent from the `id_` alternation, so any table/column named `regions` is rejected. This is a CLASS: the fork lexes SHOW-object and statement-option words as dedicated tokens; `keyword`/`non_reserved_words` cover many but nobody has ever cross-checked the full token inventory. (`orders`/`customers` parse clean today — the class is the un-enumerated remainder.)

**Files:**
- Create: `temp_auto/audit-id-holes.mjs` (scratch instrument, uncommitted) — enumerate: every lexer token name that (a) is a plain keyword token (`'WORD'` literal, no fragments/symbols), (b) is NOT reachable from `id_` (expand `keyword`, `non_reserved_words`, `object_type_plural`, `data_type`, the builtin-function alternations), and (c) probe-parse `SELECT a FROM <word>` + `SELECT <word> FROM t` — collect the REJECTED list.
- Modify: `grammars/snowflake/SnowflakeParser.g4` — add the rejected words to the appropriate id-class (follow the file's existing organization: `non_reserved_words` for statement-object words), EXCEPT words whose reservation is engine-true (verify each against docs.snowflake.com reserved-keywords before adding — LEFT/RIGHT-style FROM-alias reservations must NOT be reintroduced into the bare FROM slot; the Task-2-of-last-wave `bare_from_alias` split must keep excluding what it excludes).
- Test: `tests/snowflake.test.ts` — per recovered word (or a table-driven loop): `SELECT a FROM <word>` parses + lowers with the source named correctly; a reject-control for words that are engine-reserved.

- [ ] **Step 1:** run the audit instrument; report the full hole list (word → token line → engine-reserved verdict) in the task report BEFORE editing.
- [ ] **Step 2:** failing tests for the recoverable words (table-driven).
- [ ] **Step 3:** grammar fix; `npm run gen -- snowflake`.
- [ ] **Step 4:** proof kit — hash-diff over snowflake docs `query/` (2,976): expected EMPTY changed-set (pure acceptance widening); fallback ratchet (110) not risen; negative floors not lowered; `npm run test:corpus` green.
- [ ] **Step 5:** commit `fix(snowflake): keyword-token identifier holes — SHOW-object words usable as table/column names` (+ trailer).

## TASK 2 — DuckDB: empty-bound slices + literal method-calls (#13)

**Recon (probed 2026-07-04):** `SELECT ([1,2,3,4])[::2]` → 1 error; `SELECT 'abc'.upper()` → 1 error. Both documented at duckdb.org/docs/current (slicing: empty bounds legal with a step; method sugar works on any expression). Explicit-bound slices and identifier-receiver methods work today.

**Files:**
- Modify: `grammars/duckdb/DuckdbParser.g4` (the subscript/slice rule — allow absent lower/upper bounds when the second `:` step form is present, matching duckdb's documented `list[begin:end:step]` with all three optional; the method-call sugar path — accept `sconst` receivers), regen duckdb.
- Modify (if needed): `src/duckdb/lower.ts` — the slice lowering must represent absent bounds honestly (absent expr, not a fabricated 0/‑1); literal-receiver method chain lowers like identifier receivers (`'abc'.upper()` → `upper('abc')`).
- Test: `tests/duckdb.test.ts` — `[::2]`, `[1::2]`, `[:4:2]`, `[::-1]` parse + lower; `'abc'.upper()` → function `upper` with the literal arg; corpus KNOWN_BAD/unparsed entries for these shapes graduate (self-policing assertions will trip — move the files via the organizer, corpus-repo commit, floors rise explained).

- [ ] **Step 1:** failing tests (the shapes above + no-regression controls: `l[1:4:2]`, `x.f(y)` unchanged).
- [ ] **Step 2:** grammar + lower; regen.
- [ ] **Step 3:** proof kit — hash-diff over duckdb docs `query/` (1,037): EMPTY changed-set expected; ratchet (25) not risen; organizer graduation if corpus files now parse; tier-2 green.
- [ ] **Step 4:** commit `fix(duckdb): empty-bound slices and string-literal method receivers — duckdb.org-documented forms now parse` (+ trailer). Close #13 via `gh issue close 13` citing the commit.

## TASK 3 — The lossy-lowering pair: duckdb VARIADIC, redshift `(+)`

**Recon:** both pre-existing, backlogged by the SLL surgery wave. (a) duckdb `f(VARIADIC a)` lowers `args: []` — the arg expr is dropped (conservation blind spot: corpus gates can't see empty arg lists). (b) redshift's Oracle `(+)` outer-join marker parses (dedicated grammar support exists) but the marker is dropped in lowering — join semantics silently read as inner.

**Files:**
- Modify: `src/duckdb/lower.ts` (the function-arg extraction — VARIADIC-prefixed args keep their expr; smallest honest model: the arg rides `args` as its expr; whether the VARIADIC marker itself needs an IR flag is decided by what consumers need — default NO flag, comment the drop), `src/redshift/lower.ts` (the `(+)` marker: it lives inside the ON/WHERE expr per the redshift grammar — verify where it lands in the CST and model it honestly; smallest model that doesn't LIE about join kind. If honest modelling needs an IR addition, escalate with the proposal rather than fabricating).
- Test: `tests/duckdb.test.ts` (VARIADIC arg present in IR + conservation), `tests/redshift.ir.test.ts` (the `(+)` expr shape pinned; document what the marker means for the join reading).

- [ ] **Step 1:** failing tests. **Step 2:** implement. **Step 3:** full `npm test` + tier-2 (conservation + `other`-ratchets unmoved unless explained). **Step 4:** commit(s) (+ trailer).

## TASK 4 — ITEM 12: lineage trail metadata (`via`)

**Spec amendment first (spec-first house rule):** extend the PLAN.md "Per-hop lineage — SPEC" entry: `LineageHop` and terminals gain `via?: readonly Scope[]` — the ordered scopes the walk collapsed (pure-rename passthroughs) or descended (star/bare relations) through between the consumer and this node, consumer-side first. Pure metadata: no new hops, anti-fabrication intact. Then implement in `src/lineage/hops.ts` (the walk already visits these scopes in `followColumn`; record, don't re-walk).

**Acceptance (from CHANNEL ITEM 12):** anvil's 5 red cases translated: 3 bare-rename fold chains (`WITH a AS (SELECT x AS y FROM t), b AS (SELECT a.y AS z FROM a) SELECT z FROM b` — the z spine's terminal carries `via [b-scope, a-scope]`-equivalent trail), single-source star passthrough (`via [s]`), schema-resolved multi-source star (s reported). Plus: trail EMPTY (absent) when nothing was collapsed; existing hop tests byte-identical (additive).

**Files:** `docs/PLAN.md` (spec amendment), `src/lineage/hops.ts`, `tests/lineage.hops.test.ts` (+5 translated cases, cited `// anvil ITEM 12 case:`), `src/api.ts`/`src/index.ts` only if the type needs re-export (LineageHop already exported — `via` rides it).

- [ ] **Step 1:** PLAN.md spec amendment (commit separately: `docs: ITEM 12 spec — via trail on LineageHop`).
- [ ] **Step 2:** failing tests (the 5 cases + absent-when-empty + additivity pin).
- [ ] **Step 3:** implement; full `npm test` + tier-2 (the oatly totality rider must stay green).
- [ ] **Step 4:** commit `feat(lineage): via trail — collapsed/descended scopes reportable on hops and terminals` (+ trailer).

## TASK 5 — Wave close

- [ ] `npm run test:all` green; format.
- [ ] CLAUDE.md / PLAN.md truth-up (current-state): snowflake holes closed (list the words), #13 closed, VARIADIC/`(+)` modelled, ITEM 12 shipped. GH sync: #13 closed in Task 2; check #15/#11/#10/#3 statuses still true.
- [ ] CHANNEL (master): WAVE-END + ITEM 12 ship note (master commit, the 5-case acceptance status, "revive `spine-renderer-parked`/ee50835"), ITEM 7-adjacent note that the snowflake identifier holes are closed (their corpus may hit such names even if joins didn't).
- [ ] Merge to master per the standing rule (tier-2 green bar); regen parsers in the main checkout; push on Niclas's word.

---

## Self-review notes

- Coverage vs the stated scope: A1→Task 1, A2/#13→Task 2, C7/C8→Task 3, ITEM 12→Task 4, close→Task 5. BigQuery #15 and `SELECT FROM t` #11 are deliberately NOT in this wave (each is its own careful central-rule pass; #15's cost/benefit and #11's four-grammar risk deserve solo attention) — they stay on the GH list, not silently dropped.
- Dependencies: Tasks 1-3 independent; Task 4 independent of 1-3; 5 last. Task 1's engine-reserved verdicts must respect the previous wave's `bare_from_alias` exclusions (constraint stated in-task).
- Honest risk flags: (a) Task 1's audit may surface MANY holes — the fix is table-driven and cheap per word, but if a word's addition creates ambiguity (SLL pressure), it gets the surgery treatment or an escalation, not a force-through. (b) Task 3's `(+)` may genuinely need an IR decision — escalation path named in-task. (c) Task 2's slice grammar touches the c_expr region the surgery wave reordered — the hash-diff guard is the tripwire.
