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
| SQLite | `antlr/grammars-v4` `sql/sqlite` (Martin Mirchev) | MIT | `parse` |
| MySQL | `antlr/grammars-v4` `sql/mysql/Positive-Technologies` (Ivan Kochurkin) | MIT | `root` |

Notes on the less obvious lineages:

- **DuckDB** has no open ANTLR grammar anywhere; its real parser is a Bison fork of
  PostgreSQL's, so forking this repo's own postgres pair mirrors reality.
- **Trino** is the only dialect whose vendor ships its real parser's ANTLR grammar.
  `grammars/trino/` is the official `SqlBase.g4` mechanically split into a lexer +
  parser pair (named punctuation tokens, the one Java `isKeyword()` predicate ported
  to TS, a batch `root` entry added — the whole delta is in the grammar headers), so
  upstream parity is by construction. On a new Trino release, diff upstream's
  `SqlBase.g4` against ours and re-apply the small header-documented split delta.
- **MySQL** has a derived-dialect alias, `mariadb`, mapped to the same grammar
  (MariaDB forked from MySQL 5.1 and is a near-superset for ordinary DQL/DML). It
  is a PARTIAL alias, not full coverage — MariaDB-only extensions (sequences,
  `RETURNING`) are unmodeled; see `src/derived-dialects.ts`'s `mariadb` entry.

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
npm run gen -- <dialect>             # antlr-ng → TS into src/generated/<dialect>/ (databricks | tsql | snowflake | bigquery | redshift | postgres | duckdb | trino | sqlite | mysql); dialect arg required
npm run typecheck                    # tsgo -p tsconfig.json (noEmit; tsc is the fallback compiler)
npm test                             # tier 1 — the fast inner loop: units + features (corpus gates excluded); well under a minute
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
src/qualify/               Schema (sqlglot-style mapping) + qualify — * expansion, unknown-table/column/field diagnostics, bottom-up column types; SchemaProvider / DefaultTemplateProvider (on-demand catalog + template resolution); check-calls.ts is the arity/operand-type checker, reading each dialect behavior's merged `signatures` table (arity trusts both origins, operand type trusts curated only)
src/sema/resolve.ts        shared schema-aware column→source binder used by infer + lineage (local-first, then correlation to enclosing scopes)
src/infer/                 inferType — engine in infer.ts is dialect-agnostic; per-dialect knowledge in dialect.ts (rule tables in functions.ts / snowflake.ts / <dialect>.ts, coercion in coerce.ts)
src/lineage/               lineage/originsOf — base-table origins per output column; hops.ts (lineageAt/lineageOf → LineageHop) — the per-hop reference-spine DAG, a filtered view over the frozen scope/IR
src/references/            referencesAt(scopes, offset, schema?, ast?) → Occurrences — the occurrence engine: declaration + every reference of the symbol under the cursor. Total: never throws; null off-symbol
src/symbols/               deriveSymbols — kind×modifier symbol model over the scope tree; carries types/origins when given a schema
src/document/              the living-document model — document.ts (SqlDocument), line-index.ts (LineIndex: O(log n) position↔offset), node-at.ts (CST node at an offset)
src/completion/            scope-aware completion over a SqlDocument — own ATN candidate walk (atn-walk.ts), NO antlr4-c3 dependency; complete.ts (all dialects). Total: never throws
src/signature/             signature help: SIGNATURES, one generated table per dialect (src/<dialect>/signatures.generated.ts), curated overrides (tools/signature-overrides/<dialect>.mjs) folded over the harvested long tail at generation time, `origin` per entry, overload sets per name; signatureAt() is a pure token scan; total
src/api.ts                 the public surface: Dialect, parse, analyze, tokenize, SqlDocument, complete/signatureAt, composable qualify/lineage/deriveSymbols, referencesAt, typed result wrappers
src/index.ts               public barrel: re-exports src/api.ts + the per-dialect parse*/lower building blocks and the raw shared passes
tools/gen.mjs              generation driver (sorts .g4 so the lexer generates before the parser — tokenVocab)
```

Adding a dialect is not a four-file change: the real surface is ~22 touchpoints —
the compile-enforced `Dialect`-union maps the TypeScript compiler catches, plus a
longer tail of silent-gap registries and test/tool matrices it doesn't. See
`.claude/plans/2026-07-10-mysql-sqlite-dialects.md` for the itemized
routine. A missing function rule in a registry yields `unknown`, never a wrong
type — that's the contract; don't guess return types.

**Public-API-only seam.** Everything under `src/` imports only `antlr4ng`. The
editor/LSP consumer lives in its own repo and reaches this codebase only through the
public surface (`src/api.ts` / `src/index.ts`), so the library carries no
editor-protocol dependency of its own.

## Conventions

- **Two standing principles govern every layer: never-wrong and lossless.** They are duals:
  never-wrong constrains what we CLAIM (a name, type, or binding we cannot derive from a
  documented source stays absent or `unknown`, never guessed; a wrong answer is worse than no
  answer), lossless constrains what we KEEP (parsing and lowering never discard information the
  input carried: name-part roles, spans, tokens, delimiters, as-written text). What the parse
  knew, the IR carries; a downstream layer consumes structure, it never re-derives it by
  heuristic. A defect against either principle outranks any feature work it blocks.
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
- **Public interface design is discuss-first.** Before committing to a final shape for any public API
  (new types, methods, result shapes, provider contracts), discuss it with Niclas; never land a final
  shape unilaterally. Standing invariants: reuse the parse (never add a method that re-parses or
  re-derives what `parse()` / the `SqlDocument` already produced, the bug the completion path once had),
  and design for real human consumers (fit for purpose, user-friendly, not AI-friendly). Get the
  interface right while the project has no external users beyond Niclas and the anvil extension, when
  breaking is cheap; and never autonomously land a breaking public-API change (coordinate it with the
  live consumer, and see Releasing for the commit-marker rule).
- Don't silently narrow scope. Work that's too big to finish now stays a visible Open
  Gap — incomplete is fine, silent is not.
- The type-inference contract is **never a wrong type**. Where a documented return
  type is argument-value-dependent or unstated, the rule stays absent and the result
  is `unknown` — not a guess.

## Known shortcuts (tracked)

Deliberate, standing reductions that have been ruled acceptable. This list is the registry:
a shortcut not listed here (or in `.claude/PLAN.md` § Open Gaps, which tracks UNFINISHED work
rather than accepted reductions) is a defect. Each entry names where the shortcut lives; the
cited file carries the full rationale.

- Tier-2 (`npm run test:corpus`) is local-by-design and can NEVER run in CI: the corpus is
  proprietary/closed-license and CI has no access (ruled final 2026-07-19). CI green means
  tier-1 only; the pre-merge tier-2 run happens on the dev machine.
- Total-by-contract degrade: the never-throw public entries (completeAt, referencesAt,
  lineageAt, signatureAt, splitStatements, parseTemplated, templateVariants,
  applyTemplateTags, SqlDocument variants) swallow internal errors and answer their
  documented empty result. `SQLLENS_DEBUG=1` rethrows at every such site (`src/debug.ts`).
- Corpus floors below 100%, each pinned with a dated reason in its gate file: BigQuery
  analyzer positives 14707/14708 (one enumerated chained-call case), analyzer schema
  resolution 2700/3000 (harvested-schema coverage, not a resolver defect), mutated-negative
  rejection floors (mutation cannot guarantee invalidity), per-dialect SLL fallback ratchets
  (performance, may only fall).
- Docs-corpus ratchets gate only the `query` bucket; dml/ddl/unparsed counts are printed,
  never gated (`tests/helpers/docs-ratchet.ts`).
- Known-bad exclusion lists are self-policing (each asserts its entries still fail):
  `tests/*-corpus-known-bad.ts`.
- T-SQL `SET QUOTED_IDENTIFIER OFF` double-quoted string literals are noparse: a session option
  flipping string-literal lexing for the rest of the session is context-sensitive lexing, out of
  reach for an ANTLR lexer without a mode hack tied to statement execution order (entry in
  `tests/tsql-corpus-known-bad.ts`).
- postgres/redshift empty-begin slices with a named bound (`arr[:hi]`) keep their bind-variable
  reading (ruled 2026-07-20): the `:hi` token is lexically identical to a psql/pgbench bind
  variable used as an index, which is real, corpus-attested usage; re-reading it as a slice bound
  would flip an already-parsing construct. `arr[lo:hi]` (any begin bound present) parses as a
  slice; `arr[:(hi)]` is the workaround. postgres/redshift have no third (STEP) slice slot at all,
  so step-slot fusion doesn't apply to them.
  DuckDB is NOT in this entry: real DuckDB v1.5.4 has no `:name` bind form at all (engine-verified
  rejection), so the parameter wave removed it there and duckdb `arr[:hi]` now parses as the slice
  it is (engine-verified accepted). DuckDB's STEP-slot fusion (`arr[1:2:hi]`, a bare-identifier
  STEP after two ordinary bounds) is modeled too (engine-verified against DuckDB v1.5.4,
  `temp_auto/duckdb-oracle/probe-slice-fused-step.mjs`): `indirection_el`'s COLON alt gained a
  trailing `plsqlvariablename` alternative alongside its existing numeric-step tail.
- Recovery-split exemption in `tests/broken-batch.test.ts`: tsql/redshift/postgres/duckdb
  are exempt from the phantom-batch assertion (a recovery fragment is provably
  indistinguishable from two real statements in those grammars).
- MySQL identifier folding assumes the platform-default `lower_case_table_names`; wrong only
  for a Unix-collation database holding two tables differing only in case (`src/mysql/fold.ts`).
- `mariadb` is a PARTIAL derived alias of the mysql grammar; MariaDB-only extensions are
  unmodeled (`src/derived-dialects.ts`).
- BigQuery `DEFINE MACRO` is detect-only: the body is consumed opaquely and flagged, not
  parsed (`grammars/bigquery/GoogleSQLParser.g4`).
- Snowflake `pivot`/`unpivot` are usable as ordinary identifiers (table/column/`AS`-alias) via the
  `pivot_unpivot_word` post-source-slot split, EXCEPT in the bare (AS-less) post-source alias slots
  (`bare_from_alias` and the pivot result alias), where a trailing `PIVOT`/`UNPIVOT` stays reserved for
  the pivot clause — a bare `t pivot` is noparse, use `AS pivot` (mirrors the LEFT/RIGHT bare-alias
  exclusion, `grammars/snowflake/SnowflakeParser.g4`).
- `SELECT FROM t` (empty projection list) parses clean in postgres by documented design ("The list
  of output expressions after SELECT can be empty", postgresql.org/docs/current/sql-select.html);
  tightening risks the positive gates and needs its own pass. Redshift tightened this 2026-07-20
  (`r_SELECT_list.html` mandates a list; SELECT INTO's list stays optional per `r_SELECT_INTO.html`).
- Snowflake embedded UDF bodies (`$$...$$`) are one opaque token; revisit on consumer demand.
- Upstream-inherited grammar TODOs ride the forks as-is (pg-family lexer escape notes,
  Snowflake constraint-combination leniency, T-SQL `data_type` runtime checks, BigQuery
  `TODO(zp)` markers); fixed only when one bites a corpus or consumer.
- SQLite's inference registry is deliberately incomplete: value/modifier-dependent returns
  stay unregistered and the affinity algorithm is unbuilt (`src/sqlite/infer.ts`).
- The corpus reclassifier only runs under `ORGANIZE=1` (`tools/organize-corpus.test.ts`).

## Releasing

Version bumps are automatic. `semantic-release` (`.releaserc.json`) runs `commit-analyzer` with the
default Angular preset over the commits since the last tag and picks the bump from the commit types:
`feat:` is a minor, `fix:` / `perf:` a patch, `refactor:` / `test:` / `chore:` / `docs:` release
nothing on their own, and a `!` after the type (e.g. `feat!:`) or a `BREAKING CHANGE:` footer forces a
major (x.0.0).

**Hard rule, no exceptions: never put a `!` after the commit type and never write a `BREAKING CHANGE:`
footer.** A major release is decided out of band and requires the maintainer's explicit approval first;
it must never be triggered automatically by a commit message. If a change is technically breaking,
commit it as an ordinary `feat:` or `fix:` (describe the break in the body, no marker) so it ships as a
minor or patch, and raise the major-version question with the maintainer separately.
