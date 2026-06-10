# CLAUDE.md — sql-dialect-grammars

Guidance for Claude Code working in this repository. (Folder name is provisional — rename freely.)

## What this project is

**Generate TypeScript SQL parsers we can use in our own projects**, built from open, split **ANTLR4 grammars (`.g4`)** that we fork or hand-author and run through the **antlr4ng** toolchain. Two kinds of target:
- **Fork-and-clean** — dialects with a good existing `.g4` in `antlr/grammars-v4` we fork, split if needed, and conformance-validate: **Databricks, T-SQL** (the current focus — grammars-v4 gives a head start).
- **Hand-author** — the proprietary cloud warehouses with **no authoritative open grammar**: **Redshift, Snowflake, BigQuery**.

**The primary deliverable is the generated TypeScript parsers** — a `parse(sql, dialect)` library we consume in our own projects, TS-native with no Python or Java at runtime. The `.g4` grammars are the *means*: forking or hand-authoring them is how we build and maintain those parsers, and we optimize for a working parser over grammar elegance. The grammars are a useful by-product — for the warehouse dialects an open spec that doesn't exist today, and where we improve a grammars-v4 grammar we contribute the fix back upstream — but they are not the main delivery.

**The parser is syntax only** — it produces a parse tree. On top of it, for Databricks, we *are* building a **semantic layer** (name resolution = scope, plus schema-fed qualify) because the consumers (editor support, the SQL debugger) need it — Nicke directed this 2026-06-06. **Out — actually Nicke-cleared:** SQL transpilation only (Nicke: "i dont care at all about the transpile", 2026-06-06). **NOT cleared — open, do NOT treat as Out:** **type inference** and **column lineage**. These were carried over from the origin session's "syntax only — no semantic analyzer" framing (which also listed scope resolution + function signatures); Nicke overrode that framing on 2026-06-06 by directing the scope + qualify semantic layer, and never separately cleared type inference or lineage. A prior edit wrongly stamped them "Nicke-cleared" — that was the assistant's assumption, not Nicke's decision. Type info is in fact needed to finish schema-fed validation (e.g. struct-field existence — see [docs/PLAN.md](docs/PLAN.md) Open Gaps); lineage was only ever noted "revisit later" (deferred, rides on qualify), not cut. **Expression modelling** (`a+b`, CASE, calls, aggregates, window/`OVER`, `GROUP BY`/`HAVING`, predicates, lambdas, subscript, the `date_add`/`CURRENT_*` special forms) — **built 2026-06-06**, **corpus-complete: every expr node in all 1558 models lowers to a typed `Expr` — 0 `other`, gated by `tests/ir-completeness.test.ts`**. GROUP BY captures every key (incl. inside ROLLUP/CUBE/GROUPING SETS); qualified `t.*` expands only its source; `aggregate` uses a comprehensive Spark aggregate-name set. Was never a descoping.

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

Current state only, verified 2026-06-10 (22 suites / 228 tests green with all three corpora present). History lives in `git log` and the PLAN.md Open Gaps entries — don't append changelog narrative here; keep this section true to *now*.

- **Phase 0 done; Databricks and T-SQL are at their gates; the Phase 1.5 semantic layer is built and wired.** Next: the warehouse dialects — Redshift → Snowflake → BigQuery (hand-authored; PLAN.md Phases 3–5 still hold stale Redshift-first detail, pending a re-sequence).
- **Databricks** — the Spark-fork grammar generates and typechecks clean. Gate: **1558/1558** Oatly models parse with zero syntax errors (`databricks.local-coverage` asserts zero failures). The semantic corpus suites (`scope.corpus`, `ir-completeness`, `conservation`, `lineage`, `symbols`) run the full pipeline over all 1558 models with 0 throws; expression modelling is corpus-complete — 0 `other` nodes, and the conservation gate fails if the IR drops any clause the parse tree contains.
- **T-SQL** — parse + lower onto the same shared IR; the semantic layer runs **unchanged** on it (`tsql.test.ts`, mutation-verified). `lower` covers the core query language plus PIVOT/UNPIVOT (a named relation exposed under its alias), APPLY, OPENJSON/OPENXML (columns from their `WITH` schema), table-valued functions and XML `.nodes()` (opaque sources), non-ANSI `*=`, and TOP/OFFSET-FETCH (IR `limit`). Gates: the grammars-v4 137-file example corpus parses **135/137** — the 2 failures (`constants.sql`, `keywords_reserved.sql`) are upstream grammar gaps, and that corpus is mostly DDL, so it is grammar-conformance only; `tsql.adventureworks` is the schema-fed gate — a 71-table catalog + 20 `CREATE VIEW` bodies sliced from Microsoft's script, **all 20 parse and resolve with 0 unknown-table/-column**, with lineage and infer spot-checked on real T-SQL. The Oatly corpus is Databricks dialect — **not** a T-SQL gate (only ~14% parses as T-SQL, by design).
- **Type inference is per-dialect** — the engine (`src/infer/infer.ts`) is dialect-agnostic; per-dialect knowledge lives in `src/infer/dialect.ts`: function registries, literal rules, scalar-type aliases (bit→boolean, datetime→timestamp, nvarchar→string, float→double), and per-dialect division (Spark `int/int`→double, T-SQL `int/int`→int). The dialect rides as a string tag on `Scope` (`resolveScopes(query, "tsql")`), so qualify/symbols needed no change. The Spark and T-SQL registries are **comprehensive**, built from the vendor function references (not the corpus); a rule is absent only where the return type is genuinely arg/lambda/schema-dependent in a way not yet modelled. Gate: `tsql.infer.test.ts`.
- **Genuine boundaries / open gaps** (tracked, not descoped — full list in [docs/PLAN.md](docs/PLAN.md) Open Gaps): XML `.nodes()`/`.value()` column extraction needs an XML-shredding subsystem (its own feature); OPENJSON/OPENXML `WITH`-column *types* aren't captured (names only); a larger T-SQL SELECT corpus (e.g. sqlglot's `test_tsql.py` cases) would harden `lower` and type coverage; correctness is self-graded — the corpus gates prove "no throw" plus stats our own code computes, with no curated expected-output conformance set.
- **Vendored inputs (all gitignored):** `vendor/grammars-v4` — sparse clone of `sql/`, SHA `923a1a9`; `vendor/spark` — apache/spark's `SqlBase*.g4` (the Databricks fork base); `vendor/adventureworks/instawdb.sql` — downloaded MS sample; `harness/local/databricks` — the Oatly corpus (proprietary, machine-local).

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

## Commands

```bash
npm run gen -- <dialect>             # antlr-ng → TS into src/generated/<dialect>/ (databricks | tsql); dialect arg required
npm run typecheck                    # tsgo -p tsconfig.json (noEmit; tsc is the fallback compiler)
npm test                             # vitest run — all suites, including the corpus gates
npx vitest run tests/tsql.test.ts    # one test file
npx vitest run -t "expands t.*"      # one test by name
npm run format                       # prettier --write . (format:check for CI-style check)
```

There is no `build` script (the library is consumed as TS; emit is a packaging-phase question) and no separate harness runner — the conformance corpora run as vitest suites. `src/generated/` is gitignored: run `npm run gen -- databricks` and `npm run gen -- tsql` after a fresh clone or any `.g4` edit, or every test fails at import.

The corpus gates `describe.skipIf` their corpus directory away when absent, so they're a no-op on machines without the data:

- `harness/local/databricks` (gitignored, 1558 Oatly compiled-dbt files) — gates `databricks.local-coverage` (parse, 100% required), `scope.corpus`, `ir-completeness`, `conservation`, `lineage`, `symbols`.
- `vendor/grammars-v4/sql/tsql/examples` (gitignored sparse clone) — gates `tsql.corpus`.
- `vendor/adventureworks/instawdb.sql` (gitignored download) — gates `tsql.adventureworks` (schema-fed resolution).

A green run with a corpus absent proves less than it looks like — check the skip count before claiming the gate passed.

Observed once (2026-06-10, Windows): a full `npm test` collapsed in ~5s with every file failing `Cannot read properties of undefined (reading 'config')` and "no tests" — a vitest worker-pool crash, not real failures (immediate rerun was green, 228/228). If you see that exact signature, rerun before debugging anything.

## Code map — the pipeline

`parse → lower → resolveScopes → qualify → infer / lineage / symbols`. Only the first two stages are per-dialect; everything after operates on the shared IR and runs unchanged on every dialect.

```
grammars/<dialect>/        split .g4 pair — the hand-maintained source
src/generated/<dialect>/   antlr-ng output (gitignored build product; never hand-edit)
src/<dialect>/parse.ts     parse wrapper: two-stage SLL→LL with BailErrorStrategy, returns CST + error count
src/<dialect>/lower.ts     CST → IR; the only place that knows the dialect's parse-tree shape
src/ir/ir.ts               dialect-neutral IR (QueryExpr/SelectExpr/Source/Expr…); every node keeps a `cst` back-ref for source spans
src/scope/scope.ts         resolveScopes(query, dialect) — schema-free symbol table: visible sources, CTE resolution, output columns; the dialect string rides on Scope
src/qualify/               Schema (sqlglot-style mapping) + qualify — `*` expansion, unknown-table/column/field diagnostics, bottom-up column types
src/sema/resolve.ts        shared schema-aware column→source binder used by infer + lineage (local-first, then correlation to enclosing scopes)
src/infer/                 inferType — engine in infer.ts is dialect-agnostic; per-dialect knowledge in dialect.ts (function registries in functions.ts, literals.ts, type aliases in types.ts, coercion in coerce.ts)
src/lineage/               lineage/originsOf — base-table origins per output column
src/symbols/               deriveSymbols — kind×modifier symbol model over the scope tree; carries types/origins when given a schema
src/index.ts               public API (Databricks exported; T-SQL parse/lower exist but aren't exported yet)
tools/gen.mjs              generation driver (sorts .g4 so the lexer generates before the parser — tokenVocab)
```

Adding a dialect touches four places: `grammars/<dialect>/`, `src/<dialect>/parse.ts` + `lower.ts`, and one `InferDialect` entry in `src/infer/dialect.ts`. A missing function rule in a registry yields `unknown`, never a wrong type — that's the contract; don't guess return types.

## Conventions

- One folder per dialect: `grammars/<dialect>/<Dialect>Lexer.g4` + `<Dialect>Parser.g4`. No `grammars/core/` — every dialect grammar is standalone.
- Generated TS (`src/generated/`) is **build output** — gitignored, regenerated by `npm run gen`. Never hand-edit it.
- Every dialect-specific grammar rule gets a comment linking the manual section that justifies it.
- The conformance corpus is the gate: a grammar change that regresses the corpus is **not done**. TDD for grammars = add corpus case → harness fails → edit grammar → harness green → commit.
- Match this file's decisions; if a decision turns out wrong, update this file in the same change that departs from it.
- **No descoping core work without Nicke's explicit clearance.** Cutting a real part of the job (e.g. expression modelling) out of scope is a decision only Nicke makes, stated out loud at the time. If something is too big to finish now, it stays a **visible Open Gap** that keeps answering "what's left" — never a quiet scope boundary, a "v1 doesn't do X", or an IR/code comment that removes it from view. Incomplete is fine; silent is not. **But visible is not done.** Building the easy 80% and filing the hard 20% as a tracked Open Gap is still a half-implementation — making the gap *visible* doesn't make the feature *finished*. An Open Gap is legitimate only for (a) genuinely separable work that is its own feature/subsystem (e.g. the type-inference engine), or (b) something needing a decision only Nicke can make — and it must be surfaced **before** building the easy half, so scope is agreed up front, not revealed after. "The harder half of what I'm building right now" is not a gap; it's unfinished work. Finish the feature's real cases — derived as well as base, the common collection/correlated forms — not just the convenient path. The only descoping Nicke has actually cleared is **transpilation**; **type inference** and **lineage** were never cleared (a prior edit wrongly listed them — corrected 2026-06-06) and are open, not Out. Everything else not yet built is an Open Gap, not an exclusion.
- **Drive to completion; do not checkpoint.** When you take on a piece of work (e.g. "type inference"), do it **full and complete** in one continuous push — every determinable case, **wired into its consumers**, working end-to-end. No "ifs, buts, or deferred." Building an engine (inference, symbols) and leaving it unwired is not done; "done" = a consumer can use it and it delivers the value, not that a layer compiles and its unit tests pass in isolation. Do NOT stop to report progress, summarise what's left, ask "should I continue?", or pause at each commit / TDD increment / gap — just keep building the next piece. The only legitimate stops: it genuinely works end-to-end, you are blocked on a decision only Nicke can make, or Nicke redirects. The only things that may stay unbuilt are the genuinely **undeterminable** (e.g. a type with no schema) — an inherent limit, not a deferral — recorded in PLAN.md, never used as a reason to stop early.
