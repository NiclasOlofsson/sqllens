# Snowflake backlog — shared-level changes parked during parallel development

The Snowflake dialect was built while another session worked on the shared code
(2026-06-10, Nicke's direction: stay inside `grammars/snowflake` + `src/snowflake`,
note shared-level needs here and clean up at the end). Each item below is a change
to shared files (`src/ir`, `src/infer` engine, `src/scope`, CLAUDE.md/PLAN.md) that
the Snowflake dialect needs or that follows from it. None are descoped — they are
deferred merges.

## IR / semantic layer

1. **`qualify?: Expr` on `SelectExpr`** (`src/ir/ir.ts`) plus a `"qualify"` member on
   `Clause`, alias visibility in scope (QUALIFY sees select aliases, like HAVING/ORDER
   BY), and conservation coverage. Until then `src/snowflake/lower.ts` flags QUALIFY
   queries `unsupported: ["qualify"]`. The Spark grammar parses QUALIFY too, so
   Databricks gets the same modelling for free when the field lands.

2. **Star modifiers on the `star` Expr node** — Snowflake `* ILIKE '…' / EXCLUDE … /
   REPLACE (…) / RENAME (…)` (and Databricks `* EXCEPT (…)`). Needs fields on the star
   node and expansion handling in the qualify pass. Until then flagged
   `unsupported: ["star-modifier"]`.

3. **`UNION BY NAME`** — needs a flag on `SetOpExpr` (column matching by name, not
   position, changes the output column set). Currently lowered as a plain union.

4. **Division semantics hook on `InferDialect`** — Snowflake `int/int` is decimal
   division (`10/3 → 3.333333`, NUMBER with extended scale): neither Spark's double
   nor T-SQL's integer division. `floatDivision: boolean` can't express it; needs a
   three-way strategy (or a `division(left, right): Type` hook). Approximated with
   `floatDivision: true` (non-integer result, type name `double` instead of `decimal`).

5. **Variant subscript typing** — the infer engine types `subscript` over arrays/maps;
   `variant:path` / `variant[0]` should yield `variant` (it yields `unknown` today —
   safe, but typed paths would feed schema-fed validation better).

## Code placement / conventions

6. **Move `src/snowflake/infer.ts` knowledge into `src/infer/`** (functions/literals/
   types files) to match the Databricks/T-SQL convention, once parallel sessions stop
   touching those shared files. `src/infer/dialect.ts` already imports from the
   snowflake folder; only the file location is unconventional.

7. **`src/index.ts` export** — snowflake parse/lower are not exported yet (same status
   as T-SQL; packaging-phase decision).

## Docs

8. **CLAUDE.md locked-decisions correction** — the architecture section says Snowflake
   has *no* grammars-v4 grammar and must be hand-authored. Wrong since 2022: grammars-v4
   `sql/snowflake` exists (4.3k-line parser, actively maintained, Bytebase uses it in
   production). Snowflake is now **fork-and-clean** (forked at 923a1a9), like T-SQL.
   Update the locked decision, the dialect-order rationale, and the Current status
   section (new gates: `snowflake.test`, `snowflake.pipeline`, `snowflake.corpus` —
   51/51 vendor examples, docs-corpus ratchet 4442/6259).

9. **PLAN.md Phase 4 (Snowflake)** still says hand-author; supersede with the fork
   approach and the docs-corpus conformance harness (`tools/scrape-snowflake-docs.mjs`).

## Grammar gaps (tracked by the docs-corpus ratchet, not semantic backlog)

Platform DDL (ALTER LISTING / APPLICATION / CORTEX SEARCH / NETWORK RULE …),
standalone Snowflake Scripting blocks (DECLARE/BEGIN…END outside CREATE TASK),
EXECUTE IMMEDIATE bodies, COPY FILES, and the statement-option long tail — the
~29% of `harness/local/snowflake-docs` that doesn't parse yet. Raise
`DOCS_BASELINE` in `tests/snowflake.corpus.test.ts` as fixes land.
