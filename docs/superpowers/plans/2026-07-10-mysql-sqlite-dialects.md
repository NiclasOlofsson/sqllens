# MySQL + SQLite dialects — implementation plan

> **For agentic workers:** this plan uses checkbox (`- [ ]`) steps for tracking. To run it agentically, drive it task-by-task with superpowers:subagent-driven-development or superpowers:executing-plans. It is equally executable by hand — every touchpoint has an exact path, the mechanical edits carry real code, and the discovery-driven edits carry a reference file to mirror plus an objective completion gate.

**Goal:** Add `mysql` and `sqlite` as first-class sqllens dialects (grammar → parse → lower → full semantic layer), forked from `antlr/grammars-v4`, each green at its corpus gate and covered by the existing all-dialects test matrix.

**Architecture:** Each dialect is a standalone split ANTLR4 pair under `grammars/<dialect>/`, generated to `src/generated/<dialect>/`, wrapped by `src/<dialect>/parse.ts` + `lower.ts`. Everything after `lower()` (scope → qualify → infer → lineage → symbols) is dialect-neutral and runs unchanged; the per-dialect work is the grammar, the CST→IR lowering, and ~20 registration touchpoints. The `Dialect` union in `src/dialect.ts` is the keystone: adding a member turns the TypeScript compiler into a checklist for the 11 compile-enforced registrations, leaving a short list of silent-gap points to handle by hand.

**Tech stack:** TypeScript, antlr4ng runtime, antlr-ng CLI (pure-TS generation, no Java), vitest, tsgo (typecheck). Grammar sources: `antlr/grammars-v4` `sql/sqlite` (MIT, Martin Mirchev) and `sql/mysql/Positive-Technologies` (MIT, Ivan Kochurkin / Positive Technologies).

## Global constraints

- **Do SQLite first, MySQL second.** SQLite's grammar is ~21 KB (a quarter of MySQL's ~95 KB) with an official complete syntax spec to gate against. It de-risks the whole routine before you take on MySQL's bulk. Track B reuses everything Track A establishes.
- **Split grammars only.** A `lexer grammar <Dialect>Lexer` + a `parser grammar <Dialect>Parser` with `options { tokenVocab = <Dialect>Lexer; }`. No combined grammar, no `grammars/core/`.
- **Entry rule must be batch-level.** `parse.ts` calls a `;`-separated, EOF-anchored top rule (like every existing dialect), enforced by `tests/batch-parity.test.ts`. Upstream already provides one for both: SQLite's is `parse` (EOF-anchored, `;`-separated `sql_stmt_list`), MySQL-PT's is `root` (`sqlStatements? EOF`). Confirm the exact name after generation.
- **`lower()` is total.** It never throws on grammar-legal input; unrecognized constructs become an explicit unsupported-flagged IR node, never a silent drop. It calls `freezeIR(q)` before returning.
- **Type-inference contract: never a wrong type.** A missing function rule yields `unknown`, never a guess. `src/infer/<dialect>.ts` starts small and grows; do not fabricate return types.
- **Generated code is gitignored build output.** Commit `.g4` source, never `src/generated/`. Regenerate after every grammar edit.
- **The corpus gate is the definition of done for grammar work.** Native loop: add/point a corpus that fails → edit `.g4` → `npm run gen -- <dialect>` → run the gate until zero syntax errors → commit. `npm run test:corpus` must be green (and check the skip count — a gate skips itself away when `SQL_CORPUS_DIR` lacks its data; a green run with the corpus absent proves nothing).
- **Provenance + license headers stay intact.** Every `.g4` keeps its upstream MIT header plus a fork-provenance block (upstream commit SHA + retrieval date). Add the attribution to `THIRD-PARTY-NOTICES.md`.
- **Commands:** `npm run gen -- <dialect>` (generate), `npm run typecheck` (tsgo), `npm test` (fast tier), `npm run test:corpus` (gates), `npx vitest run <file>` (one file). `SQL_CORPUS_DIR` must point at the private corpus clone for the gates to run.

## Reality check — what's mechanical vs discovery-driven

Read this before estimating anything.

- **Mechanical, templated verbatim (real code in this plan):** `parse.ts`, the 11 compile-enforced registry entries, the barrel exports, `derived-dialects.ts`, the `gen:all` script, the test-registry additions. `sed s/snowflake/<dialect>/` plus the entry-rule name gets you 90% of these.
- **Discovery-driven (procedure + reference file to mirror + a completion gate, not pre-written code):** forking/splitting the `.g4` and reaching corpus-green; writing `lower.ts`'s CST-navigation body against the *generated* parser's rule indices; deciding which `classify.ts` token-role overrides are needed; the case-fold rule in `ident/fold.ts`. These cannot be honestly pre-written — the rule indices and lexer token names only exist after generation. Each such task names the file to mirror (`src/snowflake/lower.ts`, etc.) and an objective gate (corpus parses 100%, IR test passes).
- **Correctness landmine:** `src/ident/fold.ts` is silent-gap and identity-critical. Its own header warns that the wrong fold *direction* silently breaks identifier equality. SQLite unquoted identifiers are case-insensitive but case-preserving; MySQL identifier case-sensitivity is collation/OS-dependent. Get these rules right deliberately, do not copy-paste another dialect's.

---

## The per-dialect routine

This is the full ordered routine, written once with real code. Each track below invokes it with its own `<dialect>` / `<Dialect>` / entry-rule / fold-rule / corpus specifics. `<dialect>` is the lowercase folder name (`sqlite`); `<Dialect>` is PascalCase (`Sqlite`); `<Entry>` is the batch entry rule (`parse` / `root`).

### R1 — Fork, split, generate the grammar

**Files:** Create `grammars/<dialect>/<Dialect>Lexer.g4`, `grammars/<dialect>/<Dialect>Parser.g4`.

- [ ] **R1.1** Copy the upstream pair into `grammars/<dialect>/`, renaming to the sqllens convention. SQLite is already split (`SQLiteLexer.g4` + `SQLiteParser.g4`); MySQL-PT is already split (`MySqlLexer.g4` + `MySqlParser.g4`). Rename files and the `lexer grammar` / `parser grammar` declaration lines to `<Dialect>Lexer` / `<Dialect>Parser`, and set `options { tokenVocab = <Dialect>Lexer; }` in the parser.
- [ ] **R1.2** Prepend the fork-provenance header to each `.g4`, keeping the upstream MIT license block below it. Mirror the block in `grammars/snowflake/SnowflakeLexer.g4`:

  ```
  // ---------------------------------------------------------------------------
  // Forked from antlr/grammars-v4 (sql/<dialect>)
  //   upstream commit: <REAL_SHA>
  //   retrieved:       2026-07-10
  // Upstream MIT license retained below. Local edits tracked in git history.
  // ---------------------------------------------------------------------------
  ```

  Get `<REAL_SHA>` from `https://api.github.com/repos/antlr/grammars-v4/commits?path=sql/<dialect>&per_page=1`.
- [ ] **R1.3** Confirm the batch entry rule exists and is EOF-anchored `;`-separated. If upstream's top rule isn't batch-level, add one mirroring `snowflake_file`/`batch` in `grammars/snowflake/SnowflakeParser.g4`. Note the final entry-rule name — it flows into R3 and R4.
- [ ] **R1.4** Generate: `npm run gen -- <dialect>`. Expect `src/generated/<dialect>/` to fill with `.ts`. Fix any grammar errors antlr-ng reports before moving on.
- [ ] **R1.5** Commit. `git add grammars/<dialect>/ THIRD-PARTY-NOTICES.md && git commit -m "feat(<dialect>): fork + split grammar from grammars-v4"` (add the `THIRD-PARTY-NOTICES.md` attribution entry in this commit).

### R2 — parse.ts + fast-tier smoke test

**Files:** Create `src/<dialect>/parse.ts`, `tests/<dialect>.test.ts`.

- [ ] **R2.1** Write `src/<dialect>/parse.ts` by copying `src/snowflake/parse.ts` verbatim and substituting: `SnowflakeLexer`/`SnowflakeParser` → `<Dialect>Lexer`/`<Dialect>Parser` (import from `../generated/<dialect>/...`), `parseSnowflake` → `parse<Dialect>`, `mapTokens(..., "snowflake")` → `mapTokens(..., "<dialect>")`, and `parser.snowflake_file()` → `parser.<Entry>()` (both occurrences — SLL try + LL fallback). Nothing else changes; `ParseResult` is shared.
- [ ] **R2.2** Write the failing smoke test `tests/<dialect>.test.ts`, mirroring `tests/snowflake.test.ts`:

  ```ts
  import { lower } from "../src/<dialect>/lower.js";
  import { parse<Dialect> } from "../src/<dialect>/parse.js";

  const errorsOf = (sql: string) => parse<Dialect>(sql).errors;

  describe("<Dialect> parse", () => {
    it("parses a basic SELECT with zero syntax errors", () => {
      expect(errorsOf("SELECT a, b FROM t WHERE a > 1")).toBe(0);
    });
  });
  ```

  (The `lower` import will dangle until R3 — that's expected; the parse assertion is the R2 gate.)
- [ ] **R2.3** Run it: `npx vitest run tests/<dialect>.test.ts -t "basic SELECT"`. Expect PASS on the parse assertion. If the entry rule name is wrong, this fails loudly here.
- [ ] **R2.4** Commit. `git add src/<dialect>/parse.ts tests/<dialect>.test.ts && git commit -m "feat(<dialect>): parse wrapper + smoke test"`

### R3 — lower.ts (CST → IR)

**Files:** Create `src/<dialect>/lower.ts`. Reference: `src/snowflake/lower.ts` (structure) and any closer-shaped dialect.

- [ ] **R3.1** Scaffold `src/<dialect>/lower.ts` with the mandatory contract shape, mirroring `src/snowflake/lower.ts`'s imports and exports:

  ```ts
  import { ParserRuleContext, type ParseTree } from "antlr4ng";
  import { <Dialect>Parser as P } from "../generated/<dialect>/<Dialect>Parser.js";
  import type { /* Clause, ColumnRef, CteDef, Expr, QueryExpr, SelectExpr, Source, ... */ } from "../ir/ir.js";
  import { freezeIR } from "../ir/freeze.js";
  import { keywordCategory, type StatementCategory } from "../ir/statement.js";

  export function lower(tree: ParserRuleContext): QueryExpr {
    const q = lowerImpl(tree);
    q.dialect = "<dialect>";
    return freezeIR(q);
  }

  export function statementCategories(tree: ParserRuleContext): StatementCategory[] { /* mirror snowflake */ }

  function lowerImpl(tree: ParserRuleContext): QueryExpr { /* navigate by P.RULE_* against the generated parser */ }
  ```

- [ ] **R3.2** Write the `lowerImpl` body against the generated parser. Navigate by rule index (`P.RULE_<rule>`), never by string. This is dialect-specific and written by reading `src/generated/<dialect>/<Dialect>Parser.ts` for the real rule names and mirroring how `src/snowflake/lower.ts` handles the analogous constructs (select body, sources, joins, CTEs, projections). Unrecognized statements become an unsupported-flagged non-query node — copy snowflake's `nonQuery(...)` pattern — never a throw, never a drop.
- [ ] **R3.3** Extend `tests/<dialect>.test.ts` with IR assertions mirroring `tests/snowflake.test.ts`'s `selectBody` helper — assert a basic `SELECT` lowers to a `select` body with the expected projections and source. This is the lowering gate.
- [ ] **R3.4** `npm run typecheck` (expect clean) and `npx vitest run tests/<dialect>.test.ts` (expect PASS).
- [ ] **R3.5** Commit. `git add src/<dialect>/lower.ts tests/<dialect>.test.ts && git commit -m "feat(<dialect>): lower CST to IR"`

### R4 — register the dialect (compiler-driven)

**Files (compile-enforced — the union member propagates errors to each until filled):** `src/dialect.ts`, `src/api.ts`, `src/index.ts`, `src/completion/config.ts`, `src/completion/parser-factory.ts`, `src/token/classify.ts`, `src/token/tokenize.ts`, `src/dialect-symbols.ts`, `src/qualify/check-calls.ts`, `src/signature/signatures.ts`.

- [ ] **R4.1** Add `"<dialect>"` to the `Dialect` union in `src/dialect.ts`. Run `npm run typecheck` — the errors it now lists are your checklist for R4.2–R4.10.
- [ ] **R4.2** `src/api.ts`: import `parse<Dialect>` / `lower as lower<Dialect>` and add `<dialect>: { parse: parse<Dialect>, lower: lower<Dialect> }` to `DIALECTS`.
- [ ] **R4.3** `src/index.ts`: add `export { parse<Dialect> } from "./<dialect>/parse.js";` and `export { lower as lower<Dialect> } from "./<dialect>/lower.js";`.
- [ ] **R4.4** `src/completion/config.ts`: add a `COMPLETION_CONFIG["<dialect>"]` entry mirroring `snowflake`'s (`preferredRules`, `ignoredTokens`, `tableRules`, `columnRules`, `relationKeywordTokens`, `nameTokens`) with this dialect's rule/token indices.
- [ ] **R4.5** `src/completion/parser-factory.ts`: add `<dialect>: <dialect>Factory` to `FACTORIES` and write `<dialect>Factory` mirroring `snowflakeFactory` (`entryRuleIndex: <Dialect>Parser.RULE_<Entry>`, `runEntry: () => parser.<Entry>()`).
- [ ] **R4.6** `src/token/classify.ts`: add `<dialect>: []` to `DIALECT_RULES` to start. Add role-override rules only where a token-role probe fails (see R6.5) — check the generated lexer's symbolic token names against the shared `DEFAULT_RULES` regexes first.
- [ ] **R4.7** `src/token/tokenize.ts`: add `<dialect>: (cs) => new <Dialect>Lexer(cs)` to the lexer-factory map.
- [ ] **R4.8** `src/dialect-symbols.ts`: add `<dialect>: () => new <Dialect>Lexer(CharStream.fromString(""))` to `LEXERS`, and `<dialect>: <DIALECT>_ALIASES` to `TYPE_ALIASES` (the alias table is defined in R5.2).
- [ ] **R4.9** `src/qualify/check-calls.ts`: add `<dialect>: false` to `ARITY_USES_HARVESTED`. Also decide `IMPLICIT_STR_TO_NUM` / `IMPLICIT_BOOL_NUM` membership (both string-keyed `Set`s, silent — see R5.4).
- [ ] **R4.10** `src/signature/signatures.ts`: add `<dialect>: <DIALECT>` to `FUNCTION_SIGNATURES` (curated table from R5.3) and `<dialect>: {}` to `HARVESTED_SIGNATURES`.
- [ ] **R4.11** `npm run typecheck` — expect clean. Commit. `git commit -am "feat(<dialect>): register in compile-enforced dialect maps"`

### R5 — the silent-gap registrations + inference

**Files (NOT compile-enforced — no error if forgotten):** `src/infer/dialect.ts` (+ new `src/infer/<dialect>.ts`), `src/ident/fold.ts`, `src/qualify/check-calls.ts` sets, `src/derived-dialects.ts`.

- [ ] **R5.1** Create `src/infer/<dialect>.ts` mirroring `src/infer/snowflake.ts`'s five exports: `<DIALECT>_FUNCTION_RETURNS` (start with a handful of unambiguous ones — `COUNT`→int, `UPPER`→string; leave the rest absent so they infer `unknown`), `<dialect>Literal`, `<DIALECT>_ALIASES`, `<dialect>ParseType`, optional `<dialect>Special`. Then in `src/infer/dialect.ts`: import them, build the `InferDialect` object (`functions`, `literal`, `parseType`, `division`, optional `special`), and add `<dialect>` to the `DIALECTS` record. **This is silent** — a missing entry falls back to Databricks' rules with no error. Verify by a probe: infer a division expression and confirm the dialect's `division` mode applies.
- [ ] **R5.2** `src/ident/fold.ts`: add `RULES["<dialect>"]` with the correct fold rule. **Identity-critical, silent.** Choose deliberately per the track's fold-rule spec below; do not copy another dialect's. Verify with a test asserting two identifiers that should be equal under this dialect's rules resolve to the same symbol.
- [ ] **R5.3** Author the curated `<DIALECT>` signature table in `src/signature/signatures.ts` (~20–40 entries from the vendor manual; this is what R4.10 references).
- [ ] **R5.4** Set `IMPLICIT_STR_TO_NUM` / `IMPLICIT_BOOL_NUM` membership in `src/qualify/check-calls.ts` per the track spec. Wrong membership causes the corpus gate to false-reject valid SQL, so this gets verified by R6, not in isolation.
- [ ] **R5.5** `src/derived-dialects.ts`: add the identity entry `<dialect>: "<dialect>"` plus any family aliases (see track spec).
- [ ] **R5.6** `npm run typecheck` + `npm test`. Commit. `git commit -am "feat(<dialect>): inference, fold rule, derived-dialect wiring"`

### R6 — corpus gate

**Files:** Create `tests/corpus/<dialect>.test.ts`, `tests/<dialect>-corpus-known-bad.ts`. Requires `SQL_CORPUS_DIR` and the `<dialect>/grammars-v4` corpus placed in the private corpus clone.

- [ ] **R6.1** Place the upstream `sql/<dialect>` `examples/` into the corpus clone at `<dialect>/grammars-v4` (the must-parse-100% positive tier).
- [ ] **R6.2** Write `tests/corpus/<dialect>.test.ts` mirroring `tests/corpus/snowflake.test.ts`: import `parse<Dialect>` + `lower`, `corpusPath("<dialect>/grammars-v4")`, a `describe.skipIf(!existsSync(...))` that parses every file and asserts zero syntax errors, seeded baselines. Create `tests/<dialect>-corpus-known-bad.ts` as an empty `Record<string,string>` to start.
- [ ] **R6.3** Run the gate: `npm run test:corpus -- <dialect>` (or `npx vitest run -c vitest.corpus.config.ts tests/corpus/<dialect>.test.ts`). It will fail on real grammar gaps.
- [ ] **R6.4** Native grammar loop until green: read the failing example → fix `grammars/<dialect>/*.g4` (with a vendor-manual citation comment per repo convention) → `npm run gen -- <dialect>` → rerun the gate. Genuinely-invalid upstream examples go in `tests/<dialect>-corpus-known-bad.ts` with a cited reason, not worked around in the grammar.
- [ ] **R6.5** Token-role check: run a token probe over a few corpus files and confirm comments/strings/numbers classify correctly. Add `classify.ts` `DIALECT_RULES["<dialect>"]` overrides only for the mismatches (mirror snowflake's two-rule example).
- [ ] **R6.6** Commit. `git add grammars/<dialect>/ tests/corpus/<dialect>.test.ts tests/<dialect>-corpus-known-bad.ts src/token/classify.ts && git commit -m "feat(<dialect>): corpus gate green"`

### R6b — docs-corpus tier (scrape the vendor manual, second gate, correct the grammar against it)

**Files:** Create `tools/scrape-<dialect>-docs.mjs`; extend `tests/corpus/<dialect>.test.ts` and `tests/<dialect>-corpus-known-bad.ts`. Corpus output to `<dialect>/docs` in the corpus clone. This tier is what validates the grammar against the vendor's documented syntax — the grammars-v4 examples only cover what upstream contributors happened to write.

- [ ] **R6b.1** Read the existing scrapers (`tools/scrape-snowflake-docs.mjs`, `tools/extract-trino-docs.mjs`) and how the snowflake/trino corpus gates consume their `<dialect>/docs` tier. Mirror the closest fit: fetch pages → extract SQL example snippets → hygiene filters (skip pseudo-syntax/ellipsis/placeholder fragments, dedupe) → one file per snippet with a source-URL provenance comment, following whatever layout/manifest conventions the existing docs tiers use in the corpus clone.
- [ ] **R6b.2** Write `tools/scrape-<dialect>-docs.mjs` against the track's official docs source (see track spec) and run it into `$SQL_CORPUS_DIR/<dialect>/docs`.
- [ ] **R6b.3** Extend `tests/corpus/<dialect>.test.ts` with a `<dialect>/docs` describe block mirroring snowflake's docs tier (own `describe.skipIf`, zero-syntax-error assertion, known-bad quarantine with cited reasons).
- [ ] **R6b.4** Native loop to green. Triage each failure honestly: (a) valid dialect SQL the grammar rejects → a real grammar gap — fix the `.g4` with a vendor-manual citation comment, regenerate, rerun; (b) scraper artifact (pseudo-syntax, truncated snippet, prose caught by the extractor) → fix the scraper filter and re-scrape; (c) genuinely invalid SQL printed in the docs → quarantine in `tests/<dialect>-corpus-known-bad.ts` with the citation. Never quarantine category (a) — if a gap is structural (an entire missing statement family needing large grammar surgery), STOP and report it to the controller for a scope ruling instead of hiding it.
- [ ] **R6b.5** `npm run test:corpus` green with both tiers present (check the skip count). Commit: `git add tools/scrape-<dialect>-docs.mjs tests/corpus/<dialect>.test.ts tests/<dialect>-corpus-known-bad.ts grammars/<dialect>/ && git commit -m "feat(<dialect>): docs-corpus tier green"`

### R7 — test matrix, tooling registries, docs

**Files (test-only + tool registries that carry their own dialect lists — silent):** `tests/lsp.acceptance.dialects.test.ts`, `tests/derived-dialects.test.ts`, `tests/multistmt-span.all-dialects.test.ts`, `tests/batch-parity.test.ts`, `tests/token/parse-tokens.test.ts`, `tools/organize-corpus.test.ts`, `tools/mutate-corpus.mjs`. **Docs:** `README.md`, `src/lsp/README.md`, `docs/identifier-delimiter-contract.md`, `CLAUDE.md`, `package.json`.

- [ ] **R7.1** Add `<dialect>` to each all-dialects test registry: the `DIALECTS`/`Record<Dialect,…>` in `tests/lsp.acceptance.dialects.test.ts`, `tests/derived-dialects.test.ts`, `tests/multistmt-span.all-dialects.test.ts`, `tests/batch-parity.test.ts`, `tests/token/parse-tokens.test.ts` (add the `parse<Dialect>`/`lower<Dialect>` imports + the `PARSE_FNS` entry).
- [ ] **R7.2** Add `<dialect>` to the two tool registries that keep their **own** copy of the union (they do not import `src/dialect.ts`, so the compiler will not catch these): the local `type Dialect` + `PARSERS` + `CORPORA` in `tools/organize-corpus.test.ts`, and the `DIALECTS` array in `tools/mutate-corpus.mjs`.
- [ ] **R7.3** `package.json`: insert `&& npm run gen -- <dialect>` into `gen:all` before the trailing `&& npm run gen -- minijinja` (minijinja stays last), and add `"<dialect>"` to `keywords`.
- [ ] **R7.4** Docs: add the `README.md` dialect-table row + bump the "eight dialects / 15 engines" counts; add the `docs/identifier-delimiter-contract.md` column; add `<dialect>` to `src/lsp/README.md`'s supported list.
- [ ] **R7.5** `npm test && npm run test:corpus` — both green (check the corpus skip count). `git commit -am "feat(<dialect>): test matrix, tool registries, docs"`

---

## Track A — SQLite (do this first)

Run R1–R7 with:

- `<dialect>` = `sqlite`, `<Dialect>` = `Sqlite`, `<DIALECT>` = `SQLITE`.
- **Source:** `antlr/grammars-v4` `sql/sqlite` (already split: `SQLiteLexer.g4` + `SQLiteParser.g4`, MIT / Martin Mirchev).
- **Entry rule (R1.3):** upstream top rule is `parse` (EOF-anchored, `;`-separated `sql_stmt_list`). Confirm it satisfies batch-parity; use `parser.parse()` in R2.1.
- **Fold rule (R5.2):** SQLite unquoted identifiers are **case-insensitive but case-preserving** for ASCII; folding for equality is ASCII-lower, display keeps original case. Double-quoted identifiers are also case-insensitive in SQLite (a quirk — it does not enforce quoted-name case-sensitivity the way Postgres does). Set the rule to match, and add a test asserting `Foo` and `foo` resolve equal.
- **Implicit coercions (R5.4):** SQLite has flexible/dynamic typing with broad implicit string↔number affinity — include `sqlite` in `IMPLICIT_STR_TO_NUM`. It has no dedicated boolean type (0/1) — leave it out of `IMPLICIT_BOOL_NUM` unless the corpus proves otherwise.
- **Derived aliases (R5.5):** identity only (`sqlite: "sqlite"`). No common engine aliases.
- **Corpus (R6):** `sqlite/grammars-v4` from the upstream `examples/`.
- **Docs tier (R6b):** scrape source = the official SQLite language docs at `sqlite.org/lang.html` and the per-statement pages beneath it (`sqlite.org/lang_*.html`); their examples are authoritative and the syntax-diagram pages carry runnable snippets. SQLite's docs are also downloadable as a bundle (`sqlite.org/download.html`, "Documentation" zip) — mirror-then-parse beats per-page fetching if rate limits bite.
- **Why first:** smallest grammar, official complete spec, minimal registry surface. This track proves the routine end to end.

**Track A completion criteria:** `npx vitest run tests/sqlite.test.ts` green; `npm run typecheck` clean; `npm run test:corpus` green with BOTH `sqlite/grammars-v4` and `sqlite/docs` present (not skipped); `sqlite` present in every all-dialects test and both tool registries; README/docs updated.

## Track B — MySQL

Run R1–R7 with:

- `<dialect>` = `mysql`, `<Dialect>` = `Mysql`, `<DIALECT>` = `MYSQL`.
- **Source:** `antlr/grammars-v4` `sql/mysql/Positive-Technologies` (already split: `MySqlLexer.g4` ~53 KB + `MySqlParser.g4` ~95 KB, MIT / Kochurkin). **Not** the `sql/mysql/Oracle` sibling variant.
- **Entry rule (R1.3):** upstream top rule is `root` (`sqlStatements? EOF`, `;`-separated). Use `parser.root()` in R2.1.
- **Fold rule (R5.2):** MySQL identifier case-sensitivity is **collation/OS-dependent** (`lower_case_table_names`): table/database names vary by platform, but column and alias names are case-insensitive everywhere. For a static analyzer with no server context, fold column/alias identifiers case-insensitively (ASCII-lower for equality, preserve display). Document the table-name platform-dependence as a known limitation in the fold rule comment. Add a test asserting column `Amount`/`amount` resolve equal.
- **Implicit coercions (R5.4):** MySQL implicitly coerces strings↔numbers in arithmetic — include `mysql` in `IMPLICIT_STR_TO_NUM`. It treats booleans as tinyint(1) — consider `IMPLICIT_BOOL_NUM` membership, verified against the corpus.
- **Derived aliases (R5.5):** `mysql: "mysql"` plus `mariadb: "mysql"` (MariaDB's SQL is a near-identical superset — a derived dialect, no separate grammar). Spot-check a few MariaDB-specific statements against the grammar before claiming the alias; if they fail, note MariaDB as a partial/Open-Gap alias rather than asserting full coverage.
- **Corpus (R6):** `mysql/grammars-v4` from the upstream `examples/` (this grammar ships a substantial example set — expect a longer R6.4 loop than SQLite given the 95 KB parser and the grammar's known lag on newer MySQL 8 features).
- **Docs tier (R6b):** scrape source = the MySQL 8.4 reference manual at `dev.mysql.com/doc/refman/8.4/en/` — the SQL-statement chapters (`sql-statements.html` and beneath) plus the function/operator chapters. Expect the longest loop of the whole plan here: the PT grammar lags newer 8.x features, and every valid-but-unparsed manual example is a real gap to fix, not to quarantine. Structural gaps (an entire missing statement family) get escalated to the controller for a scope ruling per R6b.4, never silently quarantined.
- **Reuse:** every mechanical edit is identical to Track A with the dialect string swapped; the compiler (R4.1) re-lists the enforced points for you. The genuinely new work is `lower.ts` (R3.2, larger surface) and the corpus loop (R6.4).

**Track B completion criteria:** same as Track A with `mysql`; MariaDB derived-alias behavior documented (full or partial); `tests/derived-dialects.test.ts` covers `mariadb → mysql`.

---

## Open Gaps (deferred, tracked — not silent scope cuts)

These are visible, intentional deferrals. Ship the dialects without them; record them so they're known.

- **Negative/mutated corpus tier.** The docs-corpus scrape was originally deferred here but is now in scope as R6b (decided 2026-07-10 — the docs tier is what corrects and validates the grammar; the grammars-v4 examples alone are not a real gate). Still deferred: the negative/mutated corpus tier (`tools/mutate-corpus.mjs`, curated negatives) — follow-on hardening once both docs gates are green.
- **Doc-coverage probe suite.** `tests/<dialect>.doc-coverage.test.ts` (a `Record<string, Probe[]>` of official-docs constructs) is worth adding once each grammar stabilizes; not a launch blocker.
- **Signature/inference long tail.** `src/infer/<dialect>.ts` and the curated signature table start minimal and grow. Missing entries infer `unknown` by contract — correct, not a bug.
- **CLAUDE.md "four places" correction.** The code-map line claiming a dialect touches four places is stale (the real surface is ~22 touchpoints). Per CLAUDE.md's own rule ("if a decision turns out wrong, update this file in the same change that departs from it"), fold a corrected sentence into the Track A PR, citing this plan's routine as the itemized reality.
- **MySQL `quantifiedSubqueryAtom` residual quirk.** In the semicolon-less statement-FINAL position, `... WHERE b > ANY (SELECT 1)<EOF>` (no trailing `;`) still mis-splits into two statements — `sqlStatements`'s `(A)* A` loop has already committed at token 0, which requires a following statement. Any `;`-terminated batch (every real one) parses the quantified form correctly. Root fix needs the WITH/SELECT adjacency restructure first, to allow requiring `SEMI` between statements; tracked in the grammar comment at `predicate` in `grammars/mysql/MysqlParser.g4`, not done.
  - **2026-07-11 — root fix built and validated, BLOCKED on a pinned-gate decision.** The restructure: `sqlStatements` requires a `SEMI` between statements (`(statementItem (MINUS MINUS)? SEMI | emptyStatement_)* (statementItem ((MINUS MINUS)? SEMI)? | emptyStatement_)`), with a new `statementItem : withStatement sqlStatement | sqlStatement | emptyStatement_` admitting the one no-semicolon adjacency real MySQL has (a `WITH` clause bound to its query); `lower()` flattens `statementItem` and rejoins the WITH/SELECT pair. This fixes the `ANY`/`SOME` mis-split (both parse as one query, no trailing `;`), resolves the WITH/SELECT semicolon-nondistinction, and made SLL health *better* (grammars-v4 fallbacks 11→7, docs 612→38). The scraped official-docs corpus (1257 files) stayed 0-errors. It is BLOCKED only because 2 grammars-v4 fixtures — `parser/positive/ddl/grant.sql` (≈135 delimiter-less `GRANT`/`REVOKE` lines) and `parser/positive/ddl/ddl_create.sql` (a trigger `END` with no `;` before the next `CREATE TRIGGER`) — genuinely rely on semicolon-less statement adjacency, which is invalid MySQL (real MySQL requires the `;` delimiter). Landing the fix needs those 2 invalid-MySQL fixtures recorded in `KNOWN_BAD` with a citation (a pinned-gate change) plus a floor re-seed to 7/38 — deferred to the maintainer per the task's escalation ("do not weaken pinned tests" without a decision).
- **MySQL docs-tier SLL floor (612/1252 files fall back).** Two conflict classes inherited from upstream dominate: the scalar-vs-UDF function-call ambiguity (`simpleId` includes `scalarFunctionName`, so every `fn(...)` predicts both ways) and the UNION trailing-vs-level chain nesting. SLL surgery on those two classes is the tracked follow-up (`tests/corpus/mysql.test.ts`'s `DOCS_FALLBACK_FLOOR` comment).
- **MySQL `scalarFunctionName` reserved-word audit follow-up.** ~~Worth a systematic audit...~~ DONE (2026-07-11, `fix(mysql): reserved-word identifier audit`). Every 8.4-RESERVED word reachable as a bare identifier via `simpleId` (`keywordsCanBeId`, `functionNameBase`, `scalarFunctionName`, the `*Base` rules) was cross-referenced against the manual's `(R)` markers and probed as a real parse+lower. Result: after the earlier LEFT/RIGHT fix, no remaining admitted reserved word mis-parses a VALID query (they only over-accept invalid input, e.g. `SELECT a group FROM t` reads `group` as an alias); the correct production always wins for legal input. Left as a deliberate, inert over-acceptance (documented at `keywordsCanBeId`), with `IF`/`REPLACE`/`INSERT`/`REPEAT` call+statement forms and `RANK`/`ROW_NUMBER` calls pinned in `tests/mysql.test.ts`. `CONVERT` is a `specificFunction` (CAST family), never admission-reachable.

## Self-review notes

- Every compile-enforced registration (11) is covered in R4; every silent-gap point (infer/dialect, ident/fold, check-calls sets, the two tool registries with private unions) is called out explicitly with its silence flagged in R5/R7.
- Names are consistent: `parse<Dialect>` (parse.ts), `lower` + `statementCategories` (lower.ts), `<DIALECT>_FUNCTION_RETURNS`/`<dialect>Literal`/`<DIALECT>_ALIASES`/`<dialect>ParseType`/`<dialect>Special` (infer/<dialect>.ts), `<dialect>Factory` (parser-factory), `<DIALECT>` (signatures) — matching the snowflake template throughout.
- The fold rule and implicit-coercion set are the two silent correctness risks; both carry a track-specific spec and a verification test rather than a copy-paste default.
