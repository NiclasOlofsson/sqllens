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

