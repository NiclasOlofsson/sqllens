# CLAUDE.md — sqllens

Guidance for working in this repository, whether you're a human contributor or an
AI assistant.

## What this project is

sqllens is a **TypeScript SQL parser and static analyzer**. It parses SQL into a
concrete syntax tree, lowers it to a dialect-neutral IR, and runs a semantic layer
over that IR: name resolution (scope), schema-fed qualification, type inference,
and column lineage. Give it a query and it tells you the query's sources, its
output columns, their types, and where each column comes from.

The parsers are **generated TypeScript** built from split **ANTLR4 grammars
(`.g4`)** run through the [antlr4ng](https://github.com/mike-lischke/antlr4ng)
runtime — TS-native, with no Python or Java at runtime. The `.g4` grammars are the
*means*; the generated `parse(sql, dialect)` library is the deliverable. Each
grammar is a fork of an upstream ANTLR grammar (see the dialect table below), and
where a fork fixes a real bug in an upstream grammar the fix is contributed back.

**Primary use — editor / language tooling.** sqllens exists first to power an
**LSP** (diagnostics, hover types, go-to-definition, completion, document symbols,
signature help, semantic tokens) and a **SQL debugger**. That makes editor-shaped
requirements first-class: positional diagnostics (line/column for squiggles, not a
bare error count), small per-dialect load (an extension bundles one dialect, not
all of them), and stable analysis results that survive incremental edits. Non-editor
/ batch programmatic use is supported but secondary; when a design choice trades
off, favor the editor/LSP consumer.

**The front end is a living-document model, not a one-shot batch transform.** Editor
features run on incomplete, changing, usually-invalid input (the user is
mid-keystroke), so:

- the **token stream is a first-class artifact** — `parse(sql, dialect)` returns
  `tokens: Token[]` (every token + exact span + role + channel), and a standalone
  `tokenize(sql, dialect)` exists;
- **`lower()` is total** — it never throws on broken/partial input (broken text
  yields a flagged IR), with statement-level error containment;
- a **`SqlDocument`** model is the persistent, immutable, position-addressable
  per-file model that composes and caches the pipeline (`parse → resolveScopes`,
  lazy schema analyze) with an O(log n) `LineIndex`.

The interactive features that live in the broken-input world — completion, semantic
tokens, signature help — are built on this, not on a "parse must succeed first"
front end. Reference shape: lossless, error-tolerant syntax trees (tree-sitter,
Roslyn, rust-analyzer, the TypeScript compiler).

## Scope

The parser produces a parse tree; on top of it there is a full **semantic layer**
(`scope → qualify → infer → lineage → symbols`) because the editor/debugger
consumers need it. The semantic layer is dialect-agnostic — it operates on the
shared IR and runs unchanged on every dialect.

- **In scope:** the query language (SELECT and its full surface), expression
  modelling, name resolution, schema-fed qualification, type inference, and column
  lineage.
- **Out of scope:** SQL transpilation, and object DDL — CREATE/ALTER/DROP-style
  object management (catalog object DDL, column masks/row filters, UDF bodies).
- **Open, not out:** the operational non-SELECT statements a data engineer runs
  (COPY INTO, table-maintenance commands, GRANT, UPDATE/DELETE/MERGE depth). These
  are tracked as Open Gaps, not cut.

Anything not yet built is a **visible Open Gap** — a tracked, known limitation,
never a silent scope boundary.

## The dialects

All of them parse + lower at their corpus gates, and the semantic layer runs
unchanged on each. Every grammar is a standalone split pair
(`grammars/<dialect>/<Dialect>Lexer.g4` + `<Dialect>Parser.g4`), forked in place.

| Dialect | Fork base | Grammar license | Entry rule |
|---|---|---|---|
| Databricks (Spark SQL) | `apache/spark` `SqlBase*.g4` | Apache-2.0 | `multiStatement` |
| T-SQL | `antlr/grammars-v4` `sql/tsql` | MIT | (EOF-anchored) |
| Snowflake | `antlr/grammars-v4` `sql/snowflake` | MIT | — |
| BigQuery (GoogleSQL) | `bytebase/parser` `googlesql/` | BSD-3 | `root` |
| Redshift | `bytebase/parser` `redshift/` (Postgres-derived) | BSD-3 | `root` |
| PostgreSQL | `bytebase/parser` `postgresql/` (PG18 keywords) | BSD-3 | `root` |
| DuckDB | this repo's own `grammars/postgres/` pair | BSD-3 (inherited) | `root` |
| Trino | first-party `trinodb/trino` `SqlBase.g4` (rel. 482), mechanically split | Apache-2.0 | `root` |

Notes on the less obvious lineages:

- **DuckDB** has no open ANTLR grammar anywhere; its real parser is a Bison fork of
  PostgreSQL's, so forking this repo's own postgres pair mirrors reality.
- **Trino** is the only dialect whose vendor ships its real parser's ANTLR grammar.
  `grammars/trino/` is the official `SqlBase.g4` mechanically split into a lexer +
  parser pair (named punctuation tokens, the one Java `isKeyword()` predicate ported
  to TS, a batch `root` entry added — the whole delta is in the grammar headers), so
  upstream parity is by construction. On a new Trino release, diff upstream's
  `SqlBase.g4` against ours and re-apply the small header-documented split delta.

Third-party grammar attributions are in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md);
each `.g4` also retains its upstream license header.

There is also an additive **jinja-SQL front end** under `src/minijinja/` (grammar at
`grammars/minijinja/`, hand-authored — no upstream fork exists) that parses raw dbt
templates. It is reachable only through the public barrel and leaves the SQL
grammars untouched. The oracle is **minijinja** (the Rust engine dbt Fusion uses,
not Jinja2). See [docs/minijinja-front-end.md](docs/minijinja-front-end.md).

## Locked decisions (don't relitigate without a new reason)

- **Format:** ANTLR4, **split** grammars per dialect — a `lexer grammar <Dialect>Lexer`
  + a `parser grammar <Dialect>Parser`. Split is required for lexer **modes**
  (dollar-quoting, embedded UDF bodies) and avoids ANTLR's anonymous `T__n` tokens.
- **No shared "core" grammar and no inheritance.** "Core SQL" is a concept, not an
  artifact — and ANTLR `import` doesn't compose cleanly. Each dialect is a standalone
  split pair, forked from its best starting point and edited in place (how
  dbt/Calcite/everyone does it).
- **TS generation:** the ANTLR4 TypeScript target + the **antlr4ng** runtime. The
  pure-TS **`antlr-ng` CLI** does the generation — no Java/jar needed:
  `npx antlr-ng -D language=TypeScript -o src/generated/<dialect> grammars/<dialect>/*.g4`
  (antlr-ng defaults to a Java target, so `-D language=TypeScript` is required).
  Generated `.ts` uses `.js` ESM imports and runs under `moduleResolution: Bundler`.
- **Typecheck vs. build compiler:** `npm run typecheck` uses the TS7 native
  compiler (`tsgo`, `@typescript/native-preview`, `noEmit`). Emit is a separate
  step: `npm run build` (`gen:all` + `tsc -p tsconfig.build.json`) shipped the
  published package's JS + `.d.ts` to `dist/`, and it uses **`tsc`**, not `tsgo`,
  for the declaration output. `prepublishOnly` runs the build.
- **Validation:** a conformance harness parses per-dialect known-good corpora and
  requires the generated parser to parse them with **zero syntax errors**. No Python
  and no external oracle in the dev/CI loop.

## Sources of truth, per dialect

- **Authoritative syntax:** the dialect vendor's official SQL manual. Always wins.
- **Per-dialect deltas:** sqlglot's dialect files (`databricks.py`, `tsql.py`,
  `snowflake.py`, `bigquery.py`, `redshift.py`, `postgres.py`, `duckdb.py`) — the
  curated "what's different from base SQL." Reference only; sqlglot is not run or
  used as an oracle.
- **Reference / fork-base grammars:** `antlr/grammars-v4` (BSD/MIT) for T-SQL and
  Snowflake; the `bytebase/parser` monorepo (BSD-3) for BigQuery, Redshift and
  PostgreSQL; `apache/spark` for Databricks; `trinodb/trino` for Trino.
- **BigQuery ground truth:** Google's ZetaSQL / GoogleSQL — the syntax spec is
  `google/googlesql` `googlesql/parser/googlesql.tm` (a Textmapper grammar). Read it
  for exact productions; don't port it wholesale. The grammar we fork is Bytebase's
  ANTLR port, extended toward `googlesql.tm`.

## Commands

```bash
npm run gen -- <dialect>             # antlr-ng → TS into src/generated/<dialect>/ (databricks | tsql | snowflake | bigquery | redshift | postgres | duckdb | trino); dialect arg required
npm run typecheck                    # tsgo -p tsconfig.json (noEmit; tsc is the fallback compiler)
npm test                             # tier 1 — the fast inner loop: units + features + LSP (corpus gates excluded); well under a minute
npm run test:corpus                  # tier 2 — the conformance gates (tests/corpus/**); ~3–5 min. Green required before any merge to master
npm run test:all                     # both tiers (npm test && npm run test:corpus)
npx vitest run tests/tsql.test.ts    # one test file
npx vitest run -t "expands t.*"      # one test by name
npm run format                       # prettier --write . (format:check for a CI-style check)
```

The suite is split into two tiers by path. `npm test` (tier 1) is the inner loop and
excludes `tests/corpus/**`. The corpus conformance gates live in `tests/corpus/` and
run as `npm run test:corpus` (tier 2, `vitest.corpus.config.ts`); each corpus file is
parsed once, at the highest pipeline level. `npm run build` (`gen:all` + `tsc -p
tsconfig.build.json`) emits the published package to `dist/` (JS + `.d.ts`); in-repo
the library is consumed directly as TypeScript. `src/generated/` is
gitignored: run `npm run gen -- <dialect>` for each dialect after a fresh clone or any
`.g4` edit, or every test fails at import.

**Corpus location (`SQL_CORPUS_DIR`).** The conformance corpora (large upstream clones
plus scraped vendor-docs examples, some under closed licenses) are too large / not
redistributable to commit here. They live in a separate repository, located via the
`SQL_CORPUS_DIR` environment variable. Set it as a persistent user env var (e.g.
`setx SQL_CORPUS_DIR "…"` on Windows); a local `.env` at the repo root is an optional
override (untracked + gitignored). The resolver lives in two twins —
`tests/helpers/corpus.ts` (vitest) and `tools/corpus-paths.mjs` (node scripts) — each
reads `process.env.SQL_CORPUS_DIR` first, else parses a local `.env`, else throws. Both
expose `corpusPath(rel)`. The corpus gates `describe.skipIf` themselves away when their
data is absent, so they're a no-op on a machine without the corpus — **a green run with
a corpus absent proves less than it looks like; check the skip count before claiming a
gate passed.**

## Code map — the pipeline

`parse → lower → resolveScopes → qualify → infer / lineage / symbols`. Only the first
two stages are per-dialect; everything after operates on the shared IR and runs
unchanged on every dialect.

```
grammars/<dialect>/        split .g4 pair — the hand-maintained source
src/generated/<dialect>/   antlr-ng output (gitignored build product; never hand-edit)
src/<dialect>/parse.ts     parse wrapper: two-stage SLL→LL with BailErrorStrategy, returns CST + error count + positioned diagnostics + the token list
src/<dialect>/lower.ts     CST → IR; the only place that knows the dialect's parse-tree shape. Total — never throws, even on broken/partial input. Freezes the IR before returning (immutable after lower(); no pass writes back)
src/ir/freeze.ts           deep-freeze of the IR (skips the foreign antlr cst back-refs), called at the end of every dialect's lower()
src/ir/ir.ts               dialect-neutral IR (QueryExpr/SelectExpr/SetOpExpr/PipeExpr/Source/Expr…; PipeExpr = base + ordered PipeStage[]; GraphTableSource for GQL); every node keeps a cst back-ref for source spans, and Projection.aliasCst the alias identifier's own span. Per-field identifier delimiter-stripping behavior (which of ColumnRef.parts/TableSource.name/alias/CteDef.name/Projection.name keep vs strip quoting delimiters, per dialect) is documented in docs/identifier-delimiter-contract.md
src/token/                 the first-class token stream — token.ts (neutral Token + TokenRole), classify.ts (shared role classifier + per-dialect overrides), map.ts (CST/lexer token → Token + exact span + channel), tokenize.ts (standalone lexer-only tokenize(sql,dialect)). Always available, even when the parse fails
src/minijinja/             the additive jinja-SQL front end — segment.ts (outer-jinja segmenter + length/newline-preserving placeholders), parse.ts (parseTemplated/tokenizeTemplated), tag-ast.ts (ref/source/macro TagNodes), apply-tags.ts ({{ ref }}/{{ source }} in a FROM slot → a real TableSource.template), regions.ts (control-flow region tree + go-to-def symbols), variants.ts (arm-coverage branch enumeration). Total; reachable only through the barrel; the SQL grammars are untouched
src/scope/scope.ts         resolveScopes(query, dialect) — schema-free symbol table: visible sources, CTE resolution, output columns; the dialect string rides on Scope
src/qualify/               Schema (sqlglot-style mapping) + qualify — * expansion, unknown-table/column/field diagnostics, bottom-up column types; SchemaProvider / DefaultTemplateProvider (on-demand catalog + template resolution)
src/sema/resolve.ts        shared schema-aware column→source binder used by infer + lineage (local-first, then correlation to enclosing scopes)
src/infer/                 inferType — engine in infer.ts is dialect-agnostic; per-dialect knowledge in dialect.ts (rule tables in functions.ts / snowflake.ts / <dialect>.ts, coercion in coerce.ts)
src/lineage/               lineage/originsOf — base-table origins per output column; hops.ts (lineageAt/lineageOf → LineageHop) — the per-hop reference-spine DAG, a filtered view over the frozen scope/IR
src/references/            referencesAt(scopes, offset, schema?, ast?) → Occurrences — the occurrence engine: declaration + every reference of the symbol under the cursor. Total: never throws; null off-symbol
src/symbols/               deriveSymbols — kind×modifier symbol model over the scope tree; carries types/origins when given a schema
src/document/              the living-document model — document.ts (SqlDocument), line-index.ts (LineIndex: O(log n) position↔offset), node-at.ts (CST node at an offset)
src/completion/            scope-aware completion over a SqlDocument — own ATN candidate walk (atn-walk.ts), NO antlr4-c3 dependency; complete.ts (all dialects). Total: never throws
src/signature/             signature help — curated per-dialect signature tables plus a harvested doc-derived long tail; signatureAt() is a pure token scan; total
src/api.ts                 the public surface: Dialect, parse, analyze, tokenize, SqlDocument, complete/signatureAt, composable qualify/lineage/deriveSymbols, referencesAt, typed result wrappers
src/index.ts               public barrel: re-exports src/api.ts + the per-dialect parse*/lower building blocks and the raw shared passes
src/lsp/                   the LSP server (an application, not the library) — one SqlDocument per open file, serves every feature from it. Imports ONLY the public surface (src/api.ts/src/index.ts) + vscode-languageserver-* — the seam to extract it into its own repo
tools/gen.mjs              generation driver (sorts .g4 so the lexer generates before the parser — tokenVocab)
```

Adding a dialect touches four places: `grammars/<dialect>/`, `src/<dialect>/parse.ts`
+ `lower.ts`, and one entry in `src/infer/dialect.ts`. A missing function rule in a
registry yields `unknown`, never a wrong type — that's the contract; don't guess
return types.

**Public-API-only seam.** Everything under `src/` except `src/lsp/` imports only
`antlr4ng`. The LSP layer is the one editor consumer and reaches the rest of the
codebase only through `src/api.ts` / `src/index.ts` (plus `vscode-languageserver-*`
/ `minimatch`), so it can be lifted into its own repo without touching the library.

## Conventions

- One folder per dialect: `grammars/<dialect>/<Dialect>Lexer.g4` +
  `<Dialect>Parser.g4`. No `grammars/core/` — every dialect grammar is standalone.
- Generated TS (`src/generated/`) is **build output** — gitignored, regenerated by
  `npm run gen`. Never hand-edit it; commit the `.g4` source, not the output.
- Every dialect-specific grammar rule gets a comment linking the vendor manual
  section that justifies it. Keep upstream license headers intact.
- **The conformance corpus is the gate.** A grammar change that regresses a corpus is
  not done. Grammar work is test-driven: add a corpus case (or probe) that fails →
  edit the `.g4` → regenerate → run the gate until green → commit.
- Match this file's decisions; if a decision turns out wrong, update this file in the
  same change that departs from it.
- Don't silently narrow scope. Work that's too big to finish now stays a visible Open
  Gap — incomplete is fine, silent is not.
- The type-inference contract is **never a wrong type**. Where a documented return
  type is argument-value-dependent or unstated, the rule stays absent and the result
  is `unknown` — not a guess.
