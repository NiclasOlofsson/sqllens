# Snowflake backlog — remaining items

The shared-level changes parked during the 2026-06-10 parallel build were merged the
same day once Nicke lifted the restriction: IR `qualify` (modelled for Snowflake AND
Databricks, alias-visible in scope, conservation-gated), star modifiers
(EXCLUDE/ILIKE/RENAME/REPLACE + Databricks `* EXCEPT`, expanded by the qualify pass),
`UNION BY NAME` flag, the three-way `division` strategy (Snowflake decimal division),
variant subscript typing, and the move of the Snowflake infer knowledge to
`src/infer/snowflake.ts`. CLAUDE.md and PLAN.md were corrected (Snowflake is
fork-and-clean, not hand-authored).

Resolved 2026-06-10 (same day, second pass): star-REPLACE type threading (a column
through a modified `*` types by resolving inside the producing scope), UNION BY NAME
output alignment in scope/qualify/resolve, platform DDL now parsing generically,
standalone scripting blocks, COPY FILES — ratchet moved 71.0% → 80.6% on a cleaner
corpus (clause fragments and `<placeholder>` templates dropped by the scraper).

Still open:

1. **Docs-corpus grammar long tail** — the ~19% behind the ratchet baseline in
   `tests/snowflake.corpus.test.ts` is now a flat tail (≤8 files per failure class):
   scripting statement kinds (IF/FOR/LET/cursors), assorted statement options, DDL
   details. Raise the baseline as fixes land.

2. **`src/index.ts` export** — Snowflake (and T-SQL) parse/lower aren't exported yet;
   packaging-phase decision.

3. **Embedded UDF bodies** — JS/Python/Java/Scala in `CREATE FUNCTION … AS` parse as
   one opaque `$$…$$` token. Fine for the query layer; revisit only if a consumer
   needs structure inside the body.

4. **Upstream contributions** — the fork fixes are upstreamable to antlr/grammars-v4
   (window frames, MATCH_RECOGNIZE patterns, star modifiers, quoted-keyword strings,
   WITHIN GROUP, multi-row VALUES, ICEBERG, the `pattern` split…). Per project policy
   we contribute back when we improve a grammars-v4 grammar — needs Nicke's go (PRs
   from his GitHub account).
