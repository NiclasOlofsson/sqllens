# Snowflake backlog — remaining items

The shared-level changes parked during the 2026-06-10 parallel build were merged the
same day once Nicke lifted the restriction: IR `qualify` (modelled for Snowflake AND
Databricks, alias-visible in scope, conservation-gated), star modifiers
(EXCLUDE/ILIKE/RENAME/REPLACE + Databricks `* EXCEPT`, expanded by the qualify pass),
`UNION BY NAME` flag, the three-way `division` strategy (Snowflake decimal division),
variant subscript typing, and the move of the Snowflake infer knowledge to
`src/infer/snowflake.ts`. CLAUDE.md and PLAN.md were corrected (Snowflake is
fork-and-clean, not hand-authored).

Still open:

1. **Docs-corpus grammar long tail** — the shortfall behind the ratchet baseline in
   `tests/snowflake.corpus.test.ts`: platform DDL (ALTER LISTING / APPLICATION /
   CORTEX SEARCH …), standalone Snowflake Scripting blocks (DECLARE/BEGIN…END outside
   CREATE TASK), EXECUTE IMMEDIATE bodies, COPY FILES, statement-option gaps. Raise
   the baseline as fixes land.

2. **Star-REPLACE type threading** — `* REPLACE (expr AS col)` keeps the column's
   name/position in the expansion (done), but a consumer asking inferType for that
   column still gets the original column's type, not the replacing expression's.

3. **UNION BY NAME output columns** — the flag is recorded; scope/qualify still
   compute set-op outputs from the left branch's positions. By-name alignment would
   change the output set when branches differ.

4. **`src/index.ts` export** — Snowflake (and T-SQL) parse/lower aren't exported yet;
   packaging-phase decision.

5. **Embedded UDF bodies** — JS/Python/Java/Scala in `CREATE FUNCTION … AS` parse as
   one opaque `$$…$$` token. Fine for the query layer; revisit only if a consumer
   needs structure inside the body.

6. **Upstream contributions** — the fork fixes are upstreamable to antlr/grammars-v4
   (window frames, MATCH_RECOGNIZE patterns, star modifiers, quoted-keyword strings,
   WITHIN GROUP, multi-row VALUES, ICEBERG…). Per project policy we contribute back
   when we improve a grammars-v4 grammar.
