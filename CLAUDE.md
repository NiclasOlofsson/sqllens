# CLAUDE.md — sql-dialect-grammars

Guidance for Claude Code working in this repository. (Folder name is provisional — rename freely.)

## What this project is

**Generate TypeScript SQL parsers we can use in our own projects**, built from open, split **ANTLR4 grammars (`.g4`)** that we fork or hand-author and run through the **antlr4ng** toolchain. Two kinds of target:
- **Fork-and-clean** — dialects with a good existing `.g4` in `antlr/grammars-v4` we fork, split if needed, and conformance-validate: **Databricks, T-SQL** (the current focus — grammars-v4 gives a head start).
- **Hand-author** — the proprietary cloud warehouses with **no authoritative open grammar**: **Redshift, Snowflake, BigQuery**.

**The primary deliverable is the generated TypeScript parsers** — a `parse(sql, dialect)` library we consume in our own projects, TS-native with no Python or Java at runtime. The `.g4` grammars are the *means*: forking or hand-authoring them is how we build and maintain those parsers, and we optimize for a working parser over grammar elegance. The grammars are a useful by-product — for the warehouse dialects an open spec that doesn't exist today, and where we improve a grammars-v4 grammar we contribute the fix back upstream — but they are not the main delivery.

**Scope is syntax only**: produce a parse tree. This is *not* a semantic analyzer — no type inference, scope resolution, function signatures, or column lineage. That boundary is deliberate and keeps the project finishable.

## Origin / design rationale — READ THIS FIRST in a fresh session

This project was designed in a long discussion in the **sibling workspace** `c:\Development\github\dbt-studio-vscode` on **2026-06-05**. The full reasoning — why ANTLR/`.g4`, why hand-authored, why these dialects, why a sqlglot conformance oracle, the dbt-Fusion open-source investigation that motivated all of it, the TS-vs-Go/Rust porting discussion — lives in that session's transcript:

```
C:\Users\nicke\.claude\projects\c--Development-github-dbt-studio-vscode\0ef58efb-c91e-4bee-ac6f-9d8fa3c2d45d.jsonl
```

It is JSONL (one message per line). To recover context, read it or grep it for: `ZetaSQL`, `bigqueryuntyped`, `SqlBaseParser`, `antlr4ng`, `sqlglot`, `Fivetran`, `T__0`.

Related durable notes from that workspace:
```
C:\Users\nicke\.claude\projects\c--Development-github-dbt-studio-vscode\memory\MEMORY.md
  → especially project_dbt_grammars_not_oss.md
```

The development plan is at **[docs/PLAN.md](docs/PLAN.md)** — start there.

## Current status

**Phase 0 done; Phase 1 underway (2026-06-06).** Toolchain proven end-to-end with **no Java/Python in the loop** — `antlr-ng` generates TS from the `.g4` grammars, antlr4ng runs it; **typecheck on TS7 native (`tsgo`)**. Done: project scaffolded (`package.json` ESM, `tsconfig.json`, `.gitignore`); scripts `gen`/`typecheck`/`test` wired (`tools/gen.mjs` drives antlr-ng); `vendor/` holds a sparse clone of grammars-v4 `sql/` (gitignored, SHA `923a1a9`) plus apache/spark's `SqlBase*.g4` at `vendor/spark/`. **Databricks now forks apache/spark's `SqlBase*.g4`** (renamed `DatabricksLexer`/`DatabricksParser`), with the embedded Java `@members`/actions ported to TypeScript and `options { caseInsensitive = true; }` standing in for Spark's runtime `UpperCaseCharStream` — see the Databricks bullet under *Locked decisions*. Generates clean, **typecheck clean (tsgo)**; minimal-construct diagnostic parses 12/12 (SELECT, CTE, joins, CASE, cast, backtick/3-part names, aggregates). **Baseline gate: `tests/databricks.local-coverage.test.ts` parses the real Oatly compiled-dbt corpus (`harness/local/databricks`, gitignored, 1558 `.sql`) — 1558/1558, 100%, zero syntax errors.** That test now asserts zero failures and is the Databricks regression gate (it `skipIf`s when the corpus is absent, so it's a no-op on CI / other machines). The grammars-v4 `sql/databricks/examples` corpus and its test were dropped — 11 of 16 files were empty `-- TODO` stubs, worthless as a signal. T-SQL grammar copied + generates (still grammars-v4, actionless). **Phase 1.5 semantic layer (scope → qualify) core built (2026-06-06):** `src/databricks/` (parse wrapper + IR/`lower`), `src/scope/` (`resolveScopes`: sources, CTE resolution, output columns), `src/qualify/` (`qualify` + sqlglot-style `Schema`: `*` expansion, unknown-table diagnostics), `src/index.ts` public API. CST→IR→scope→qualify, all pure functions, positions via CST back-refs. 27 vitest green; corpus gate `tests/scope.corpus.test.ts` runs lower+scope over all 1558 Oatly models with 0 throws (fidelity scoreboard printed). See [docs/PLAN.md](docs/PLAN.md) Phase 1.5. **Next:** column binding (needs expression modelling → `ColumnRef`s) for scope `resolveColumn` + qualify column-level resolution; then T-SQL smoke test. PLAN.md Phases 3–5 still hold stale Redshift-first detail (pending the re-sequence).

## Locked decisions (don't relitigate without a new reason)

- **Format:** ANTLR4, **split** grammars per dialect — a `lexer grammar <Dialect>Lexer` + a `parser grammar <Dialect>Parser`. Split is required for lexer **modes** (dollar-quoting, embedded JS/Python UDF bodies) and avoids ANTLR's anonymous `T__n` tokens.
- **TS generation:** ANTLR4 TypeScript target + the **antlr4ng** runtime (actively maintained by Mike Lischke; ~9–35% faster than the older, semi-abandoned antlr4ts). **Verified 2026-06-06** on both Databricks and T-SQL: the pure-TS **`antlr-ng` CLI works — no Java/jar needed**. Command: `npx antlr-ng -D language=TypeScript -o src/generated/<dialect> grammars/<dialect>/*.g4` — antlr-ng **defaults to a Java target**, so `-D language=TypeScript` is required. Versions: antlr-ng 1.0.10, antlr4ng 3.0.16. Generated `.ts` uses `.js` ESM imports and runs under vitest with `moduleResolution: Bundler`. (Jar fallback `antlr-4.13.x-complete.jar -Dlanguage=TypeScript` no longer needed.)
- **Build / typecheck compiler:** **TS7 native (`tsgo`, `@typescript/native-preview`)** — adopted 2026-06-06 to experiment ahead of GA. Measured ~2.2× faster than TS6 `tsc` on our generated code (1.8s vs 4.0s; gap widens as dialects are added). `tsc` (TS 6.0.3) stays installed as fallback. `npm run typecheck` runs `tsgo`. **Revisit at packaging:** validate `.d.ts` emit from `tsgo` before shipping — `.ts→.d.ts` is at parity in the 7.0 beta but has tracked intentional diffs (typescript-go#989); fall back to `tsc` for the declaration step only if its output differs.
- **Architecture:** **no shared "core" grammar and no inheritance.** "Core SQL" is a concept (dialects share an ANSI-ish ancestry), not an artifact we build — and ANTLR `import` doesn't compose cleanly anyway. Each dialect is a **standalone pair of split `.g4` files**, forked from its best starting point and edited in place (how dbt/Calcite/everyone does it):
  - **Databricks** ← fork **apache/spark's `SqlBaseLexer.g4`/`SqlBaseParser.g4`** (vendored at `vendor/spark/`), renamed to `DatabricksLexer`/`DatabricksParser`. **Switched 2026-06-06** from grammars-v4's `sql/databricks`: that grammar was light (~30 KB) and incomplete; Spark's is the complete, authoritative grammar (Databricks SQL = Spark SQL) at the cost of a one-time port of its embedded Java `@members`/actions to TypeScript. The port: `getText()`→`this.text`, `_input`→`this.inputStream` (LA returns a char code), `Deque<String>`→`string[]`, every action/predicate prefixed with `this.`, and a `@header` import so the parser's `complexDataType` action can cast the token source to the lexer. Spark relies on a runtime `UpperCaseCharStream` for case-insensitive keywords, which we don't have — replaced with ANTLR's `options { caseInsensitive = true; }` on the lexer. Entry rule is Spark's `singleStatement` (one statement + EOF), not the old `databricks_file`.
  - **T-SQL** ← fork grammars-v4's `sql/tsql` (`TSqlLexer.g4`/`TSqlParser.g4`, mature, ~200 KB parser).
  - **Redshift / Snowflake / BigQuery** ← hand-authored standalone (no grammars-v4 grammar exists); crib structure from grammars-v4 `sql/snowflake`, `sql/trino`.
- **Validation:** a conformance harness that parses a per-dialect **known-good corpus** (our own compiled SQL, plus grammars-v4 `examples/` only where they're substantive — they were dropped for Databricks as near-empty stubs) and requires the generated parser to parse it all with **zero syntax errors**. For Databricks the corpus is the real Oatly compiled-dbt SQL (`harness/local/databricks`). No Python in the dev/CI loop, and no sqlglot/oracle cross-check (dropped 2026-06-06). Harness shape mirrors `dbt-studio-vscode/experiments/native-sql-parser-v7/harness`.
- **Dialect order (reordered 2026-06-06):** **Databricks** (≈ Spark SQL → forked apache/spark's `SqlBase*.g4`, fastest to first green: 100% on the Oatly corpus) → **T-SQL** (fork grammars-v4's mature `sql/tsql`) → then the warehouse dialects with no open grammar: **Redshift** → **Snowflake** → **BigQuery**. Databricks/T-SQL go first because forkable split `.g4` starting points exist for both (apache/spark for Databricks, grammars-v4 for T-SQL); R/S/B remain the original motivation, now sequenced after.

## Sources of truth, per dialect

- **Authoritative syntax:** the dialect vendor's official SQL manual. Always wins.
- **Per-dialect deltas:** sqlglot's dialect files (`databricks.py`, `tsql.py`, `snowflake.py`, `bigquery.py`, `redshift.py`) — the curated "what's different from base SQL." Read as a reference only (we don't run sqlglot or use it as an oracle).
- **Vocabulary / reserved-word checklist:** dbt's generated lexer token lists in `dbt-labs/dbt-core` → `crates/dbt-sql/dbt-lexer-*/.../*Lexer.tokens`.
- **Reference / fork-base grammars** (`antlr/grammars-v4`, BSD/MIT — forkable): `sql/tsql` (mature, split — the **fork base for T-SQL**), `sql/databricks` (light, split — **cross-reference** for Databricks), plus `sql/snowflake`, `sql/trino` to crib structure. No BigQuery or Redshift there.
- **BigQuery ground truth:** Google's **ZetaSQL** (a Bison `.y` grammar in C++). Read it as a *spec*; do not port it.

## Intended commands (firm these up in Phase 0)

```bash
npm run gen                      # ANTLR → TypeScript into src/generated/<dialect>/
npm run build                    # tsc
npm run harness -- --dialect=databricks # parse known-good corpus, require zero syntax errors
npm test                         # vitest
```

## Conventions

- One folder per dialect: `grammars/<dialect>/<Dialect>Lexer.g4` + `<Dialect>Parser.g4`. No `grammars/core/` — every dialect grammar is standalone.
- Generated TS (`src/generated/`) is **build output** — gitignored, regenerated by `npm run gen`. Never hand-edit it.
- Every dialect-specific grammar rule gets a comment linking the manual section that justifies it.
- The conformance corpus is the gate: a grammar change that regresses the corpus is **not done**. TDD for grammars = add corpus case → harness fails → edit grammar → harness green → commit.
- Match this file's decisions; if a decision turns out wrong, update this file in the same change that departs from it.
