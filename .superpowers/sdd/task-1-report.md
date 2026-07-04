# Task 1 report — Snowflake keyword-token identifier-hole audit

**Status:** DONE. `fix(snowflake): keyword-token identifier holes` committed; all gates green.

## What was broken (the class)

The Snowflake fork lexes hundreds of SHOW-object, plural, and statement/option words as dedicated
lexer tokens (`REGIONS : 'REGIONS';` at SnowflakeLexer.g4:820, used only by `SHOW REGIONS`). Those
tokens were absent from the `id_` alternation, so any table/column/alias named after one was rejected
— `SELECT a FROM regions` failed to parse. Snowflake reserves very few words
(docs.snowflake.com/en/sql-reference/reserved-keywords); every non-reserved token is a legal
identifier, so the whole un-enumerated remainder was an acceptance bug.

## The audit (`temp_auto/audit-id-holes.mjs`)

Method: (1) parse the lexer for plain keyword tokens (`NAME : 'WORD';`, bare alpha literal, no
fragments/char-classes/symbols) → **931** tokens; (2) compute the token set reachable from `id_` by
expanding all of `keyword`, `non_reserved_words`, `object_type_plural`, `data_type`, and the five
builtin-function alternations → **68** reachable; (3) the **876** non-reachable plain keyword tokens
were probe-parsed in **both** positions (`SELECT a FROM <word>` and `SELECT <word> FROM t`).

### Hole tally

| bucket | count |
|---|---|
| plain keyword tokens | 931 |
| reachable from `id_` (already fine) | 68 |
| non-reachable plain keyword tokens | 876 |
| **REJECTED in ≥1 position (holes)** | **610** |
|   engine-reserved (correctly rejected, stay out) | 65 |
|   non-reserved candidates | 545 |
|     excluded — dedicated grammar role (see below) | 8 |
|     **added to `non_reserved_words`** | **537** |

Every hole rejected in BOTH positions (`FROM` and `SELECT`) — no per-position asymmetry among the
holes. (Two words showed a `FROM REJECT / SELECT ok` split — `DEFAULT`, `FALSE` — because they are
valid *expressions* in the SELECT list; both are correctly kept out of `id_`: FALSE is reserved,
DEFAULT is a dedicated-role exclusion.)

### Engine-reserved holes — NOT added (65)

Verified against docs.snowflake.com/en/sql-reference/reserved-keywords (fetched once). These stay
rejected; adding any would violate the never-wrong contract in reverse:

`ALL ALTER AND ANY AS BETWEEN BY CASE CHECK COLUMN CONNECT CONNECTION CONSTRAINT CREATE CROSS CURRENT
DELETE DISTINCT DROP ELSE EXISTS FALSE FOLLOWING FOR FROM FULL GRANT GROUP HAVING IN INCREMENT INNER
INSERT INTERSECT INTO IS LATERAL MINUS NATURAL OF ON OR ORGANIZATION QUALIFY REVOKE RLIKE ROW ROWS
SAMPLE SELECT SET SOME START TABLE TABLESAMPLE THEN TRUE UNION UNIQUE UPDATE USING VIEW WHEN WHERE WITH`

(ORDER, TIMESTAMP, VALUES, etc. are reserved but were already reachable via the pre-existing
`keyword` rule — pre-existing behavior, untouched.)

### Non-reserved but excluded — dedicated grammar role (8)

These are NOT reserved, but reaching them from `id_` **re-reads existing SQL** — proven by the proof
kit (non-empty IR changed-set and/or a fallback-ratchet rise). Each is kept out on the LEFT/RIGHT
precedent (a word whose clause-keyword reading must win):

| word | lexer line | why excluded | how it surfaced |
|---|---|---|---|
| ASC | 101 | `asc_desc` sort direction | twin of DESC (latent; excluded on principle) |
| DESC | 295 | `asc_desc` sort direction | changed IR of `ORDER BY … DESC` corpus files |
| NEXTVAL | 616 | `object_name DOT NEXTVAL` | changed IR of `seq.nextval` corpus files |
| LISTAGG | 1246 | its `WITHIN GROUP` aggregate rule | changed IR of listagg corpus files |
| PIVOT | 735 | the pivot clause (`pivot_unpivot*` vs a trailing source) | +1 fallback on `constructs/pivot/19.sql` (two PIVOTs after a subquery) |
| UNPIVOT | 1140 | twin of PIVOT | latent; excluded with PIVOT |
| DEFAULT | 281 | `USE SECONDARY ROLES DEFAULT` / column DEFAULT sentinel | broke the existing `rejects DEFAULT` unit test |
| DO | 308 | `ON n PERCENT DO (SUSPEND\|…)` trigger action | flipped one truncation-mutant to valid (`ORDER BY do`); kept out to hold the negative floor |

Note on PIVOT/UNPIVOT: I first tried the brief's surgical cure (keep them in `id_`, exclude only from
`bare_from_alias`), but the fallback on pivot/19 is NOT the alias slot — it is the `pivot_unpivot*`
loop competing with `id_` after a subquery source, so alias-only exclusion did not clear it. Full
exclusion from `id_` was the only language-exact cure, so PIVOT/UNPIVOT join the dedicated-role class.

## The fix

`grammars/snowflake/SnowflakeParser.g4`: the 537 non-reserved, non-dedicated-role tokens appended to
`non_reserved_words` (which `id_` and `bare_from_alias` both reach), in a commented block citing the
audit and the reserved-keyword boundary. `bare_from_alias`'s existing LEFT/RIGHT exclusion is
untouched — none of the 537 added words are join keywords, so nothing new flows into a join-keyword
ambiguity in the bare FROM slot. `npm run gen -- snowflake` regenerated.

## Proof kit (all clean)

- **IR hash-diff** (parse+lower+stable-stringify-minus-cst → sha1) over the snowflake docs `query/`
  bucket, **2,976 files**, pre-change grammar vs post: **changed-set = 0** (empty — pure acceptance
  widening, no existing file re-read). Instruments: `temp_auto/hash-corpus.mjs`.
- **Fallback ratchet:** 110 → **110** (unchanged; the +3 the naive 545-word add caused were traced to
  DESC/NEXTVAL/LISTAGG and PIVOT and cured by the 8 exclusions).
- **Negative floors:** mutated rejection floor **332 held** (DO's exclusion prevented the one
  truncation-mutant flip); curated 100%-reject intact.
- `npm test` (tier 1): **2497 passed, 1 skipped**. `tests/snowflake.test.ts`: **208 passed** (added a
  22-word table-driven recovered test + 8 dedicated-role + 5 engine-reserved reject-controls).
- `npm run test:corpus` (tier 2): **10 files, 32 tests, all green** (snowflake docs `query/` 100%,
  `other`-ratchet 0, negatives, fallback ratchet).
- `npm run typecheck`: clean. `prettier --check`: clean.

## Concerns / judgment calls

- **DO excluded to hold the negative floor.** DO is non-reserved, so `SELECT do FROM t` is
  technically valid Snowflake — excluding it leaves a one-word micro-hole. But adding it flipped a
  single mechanical truncation-mutant (`…ORDER BY do`, a complete valid clause — exactly the
  "mutation cannot guarantee invalidity" case the ratchet documents) from rejected to accepted,
  dropping the floor 332→331. DO has a genuine dedicated grammar role (`ON n PERCENT DO`), so it sits
  in the same principled exclusion bucket as the other seven, and keeping it out holds **every gate
  frozen** (no floor moved). I judged a frozen gate + one rare micro-hole preferable to a floor
  re-pin; flagging it here as the one place the never-wrong ideal and the "no gate weakened" absolute
  pulled against each other.

## Files

- Grammar: `grammars/snowflake/SnowflakeParser.g4` (non_reserved_words block; +537 tokens, +comment).
- Tests: `tests/snowflake.test.ts` (new describe block, table-driven).
- Scratch (uncommitted, `temp_auto/`): `audit-id-holes.mjs`, `hash-corpus.mjs`, `fallback-files.mjs`,
  `accepted-mutants.mjs`, and the holes/hash JSON snapshots.

---

## Follow-up fixes (coordinator review, 2026-07-04)

Niclas ruled on the fork; three fixes applied on top of the 537-word core:

1. **`DO` added to `id_` (never-wrong).** `DO` is not reserved, so `SELECT do FROM t` must parse —
   leaving it out was a defect. Added to `non_reserved_words` (now **538** recovered). This flips the
   truncation-mutant `truncate/functions-table/3.sql` (`… ORDER BY do`, a complete valid clause) from
   rejected to accepted, so the snowflake mutated rejection floor is **re-pinned 332 → 331** in
   `tests/corpus/snowflake.test.ts` with a comment citing the documented cause (the ratchet's own
   "mutation cannot guarantee invalidity" case — a floor correction, not a weakening). Niclas approved
   the floor-direction change. Re-ran the proof kit: changed-set still **empty** over the 2,976 files,
   fallback still **110**. Test: `do` moved into the RECOVERED table (asserts `FROM do` → source named
   `do`, and `SELECT do FROM t` parses).

2. **PIVOT/UNPIVOT reclassified.** They are NOT reserved, so the full-`id_` exclusion is an
   over-exclusion (the real ambiguity is only the post-source `pivot_unpivot*` slot; the alias-only
   cure was tried and did not clear the loop). Moved out of the "re-reads existing SQL" bucket in the
   grammar comment and the test comment; the pragmatic full exclusion stays, now tracked as an **Open
   Gap in docs/PLAN.md** ("Snowflake `pivot`/`unpivot` as bare identifiers — noparse; language-exact
   cure is a post-source-slot split, deferred") so it keeps answering "what's left."

3. **`warehouse` dropped from the RECOVERED test list.** `WAREHOUSE` was already reachable via the
   pre-existing `keyword` rule — not a genuinely recovered word. Removed to keep the assertion honest.

**Exclusion count is now 7 dedicated-role words** (ASC, DESC, NEXTVAL, LISTAGG, DEFAULT, PIVOT,
UNPIVOT) — DO left the set. Re-verified: `tests/snowflake.test.ts` 207 pass, `npm test` 2498 pass (one
worker-pool flake on the first run, green on rerun — the documented vitest signature), `npm run
test:corpus` 10 files / 32 tests green (floor 331), typecheck + prettier clean.
