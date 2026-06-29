# TS SQL Dialect Parser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build **TypeScript SQL parsers we can consume in our own projects**, generated from open, split ANTLR4 grammars, each validated against a known-good corpus it must parse with zero errors. The parser is the deliverable; the `.g4` grammar is the means (and a by-product we contribute back upstream when we improve it). Two kinds of target: **fork-and-clean** from an existing grammars-v4 `.g4` (**Databricks, T-SQL** — the current focus) and **hand-author** from the manual (the warehouse dialects with no open grammar: **Redshift, Snowflake, BigQuery**).

**Architecture:** ANTLR4 split grammars (`lexer grammar` + `parser grammar`), **one standalone pair per dialect — no shared "core" grammar, no inheritance** (ANTLR `import` doesn't compose; "core SQL" is a concept, not an artifact). Each dialect is forked from its best starting point: **Databricks** ← apache/spark's `SqlBase*.g4` (forked + renamed, embedded Java ported to TS), **T-SQL** ← grammars-v4 `sql/tsql`, **Snowflake** ← grammars-v4 `sql/snowflake`, **BigQuery** ← `bytebase/parser` `googlesql/` (BSD-3), **Redshift** ← Bytebase's Postgres-derived Redshift grammar (BSD-3) — all forked, none hand-authored. The ANTLR TypeScript target + antlr4ng runtime generate the parsers. A conformance harness parses a per-dialect **known-good corpus** and requires **zero syntax errors**. The parse layer is syntax-only, but Databricks has a **semantic layer** (scope → qualify, plus expression IR) built on the parse tree — see Scope and Phase 1.5.

> **Updated 2026-06-06:** (1) **No shared "core" grammar** — each dialect is a standalone fork (see Architecture); Phase 1 is now the Databricks fork, not a core build. (2) Dialect order: Databricks → T-SQL → Redshift → Snowflake → BigQuery. (3) Validation gate is a **known-good corpus that must parse with zero errors**. Phases 3–5 below still hold the original Redshift-first detail and are **pending a clean re-sequence** — the per-dialect *method* (corpus → fail → manual → grammar edit → green → commit) is unchanged. See CLAUDE.md for rationale.

**Tech Stack:** ANTLR4 (grammars), antlr4ng (TS runtime) + antlr-ng or the ANTLR jar (generator), TypeScript, vitest, Node 20+. No Python in the loop.

---

## Scope

**In:** lexer + parser grammars that recognize each dialect's surface (queries, DML, the common DDL); generated TS parsers; a public `parse(sql, dialect)` returning a parse tree (or a syntax error); a conformance harness.

**Out — actually cleared by Nicke:** SQL transpilation ("i dont care at all about the transpile"); and **object DDL** — CREATE/ALTER/DROP-style object management (UC CREATE CATALOG/VOLUME/EXTERNAL LOCATION/SHARE/CONNECTION, column MASK/ROW FILTER, CLUSTER BY AUTO, `LANGUAGE PYTHON $$…$$` bodies; "what we don't do is regular DDL", Nicke 2026-06-10 — refining the earlier same-day clearance). CTAS/CREATE VIEW stay in (they carry queries), and DDL the Spark fork already parses stays as-is. A query engine is out by definition (this is a parser, not an execution engine).

**Open — likely future scope (NOT Out):** the **operational non-SELECT statements** a data engineer runs outside dbt (Nicke 2026-06-10: "that type of non-select statements might become in scope … we do it occasionally"): COPY INTO, the Delta maintenance commands (OPTIMIZE/VACUUM/RESTORE/REORG/FSCK, SHALLOW CLONE, a real DESCRIBE HISTORY), GRANT/SHOW GRANTS, and modelling depth for UPDATE/DELETE/MERGE (they parse today but lower as flagged non-query). All are pinned at their current level in `tests/databricks.doc-coverage.test.ts` — flip an entry's flag in the change that builds it. **NOT cleared — open, do NOT treat as Out** (a prior edit wrongly stamped these "Nicke-cleared"; corrected 2026-06-06): **type inference** and **column lineage** (lineage was only noted "revisit later", rides on qualify). **Amended 2026-06-06:** name resolution (**scope**) and column/`*` resolution against a supplied schema (**qualify**) are **in scope for Databricks** as a semantic layer on the parse tree (Phase 1.5) — the consumers (editor support, the SQL debugger) need them. The warehouse dialects get the grammar only until a second consumer forces the abstraction.

## Open Gaps (tracked, NOT descoped)

These are real, unfinished parts of the job. They stay here, answering "what's left," until built or until Nicke explicitly moves one to *Out*. They are **not** scope boundaries — never treat them as "v1 doesn't do X."

- **Doc-coverage pass — DONE 2026-06-10.** Measured both dialects against the official references (~250 probes + registry-vs-catalog diffs), then fixed what it found: `parseTSql` now EOF-anchored (it silently truncated valid-SELECT-prefix input); Databricks inline-table bodies (`VALUES`, `INSERT … VALUES`, `TABLE t`) lower instead of throwing; `parseDatabricks` enters at `compoundOrSingleStatement` (SQL-scripting compounds parse, flagged as one unsupported body) and accepts the `t@v123` time-travel shorthand; the T-SQL grammar gained IS [NOT] DISTINCT FROM, the 2022 WINDOW clause + `OVER w` (lower resolves named windows, chained, cycle-guarded), FOR SYSTEM_TIME, TABLESAMPLE, the documented FREETEXT shape, and OPENQUERY in FROM; both registries extended with doc-fetched return types (Spark ~520 entries incl. H3/ST/AI/IP/VARIANT/TIME families, T-SQL ~210 incl. the 2022/2025 additions; phantom `regexp_split` removed). The probe battery is pinned as `tests/{databricks,tsql}.doc-coverage.test.ts`. **Still open from the pass:** T-SQL grammar — BULK INSERT, temporal-table DDL (`PERIOD FOR SYSTEM_TIME`), GRANT permission lists / DENY / REVOKE, ODBC `{fn …}` escapes (upstream grammars-v4 gaps; contribute-back candidates); registry — functions whose documented return type is argument-value-dependent (`ai_query`, `from_avro`, `extract`, sql_variant property functions) or whose pages state no type (the ST measure/coordinate accessors, `h3_distance` family) stay `unknown` by contract.
- **Expression modelling — BUILT 2026-06-06; corpus-complete.** `lowerExpression` produces a typed `Expr` tree for every expression: column, literal, star, binary, unary, function (aggregate + window/`OVER`), `CASE`, cast, scalar subquery, `EXISTS`, **predicate** (`IS [NOT] NULL`, `[NOT] IN`, `BETWEEN`, `LIKE`/`RLIKE`, `IS [NOT] DISTINCT FROM`), **lambda** (`x -> …`), **subscript** (`a[i]`), and the `date_add`/`datediff`/`CURRENT_*` special-form functions. **Every expression node in all 1558 models lowers to a typed node — 0 `other` — enforced by `tests/ir-completeness.test.ts`** (which fails with the exact CST type if anything leaks). The `other` fallback stays in the IR as a safety net for constructs the corpus doesn't use (e.g. `a:b` colon paths), so nothing is ever dropped. `SelectExpr.columns` is derived from the `Expr` trees (projections, WHERE, JOIN `ON`, GROUP BY, HAVING, ORDER BY); a **CST↔IR conservation gate** (`tests/conservation.test.ts`) runs over all 1558 models and fails if the IR drops any clause the parse tree contains. GROUP BY captures **every** grouping key, including each one inside ROLLUP/CUBE/GROUPING SETS. `aggregate` is decided by a comprehensive Spark/Databricks aggregate-name set (the standard approach — there is no signature catalog at parse time).
- **`t.*` qualified-star expansion — FIXED 2026-06-06.** The star Expr captures its qualifier; qualify's `expandStar` expands only the named source (its last name part), not every source.
- **Struct/field dot-access — FIXED 2026-06-06.** `resolveColumn`/`qualify` no longer assume `parts[-2]` is the qualifier. `splitColumnRef` splits a dotted ref into qualifier / column / field-path against the visible sources (a leading part is a qualifier only if it names a source, else it's the column and the rest is field navigation — Spark's resolution order). `t.addr.city` binds to `t` with column `addr`, fields `[city]`; unqualified `addr.city` binds to the column `addr`. Corpus schema-free `unresolved` dropped 44→33. **Struct field-existence validation — BUILT 2026-06-06.** `parseStructFields` (schema.ts) parses `struct<…>` type strings, nesting-aware; qualify's `checkFieldPath` walks the field path against the base column's struct type and emits an `unknown-field` diagnostic when a known struct lacks the field (`t.addr.city` → checks `city` in `addr`'s struct; nested `a.b.c` walks down). **Types propagate through derived columns:** qualify threads column types bottom-up (`resolved` carries `Column[]` with types), so a struct column threaded through a CTE, subquery, aliased CTE (`WITH c (a) AS …`), or union (left branch) is validated too — not only base-table columns. A non-struct, array/map, or unknown type stops the walk without flagging. **Genuine boundary — separate features, not this one:** a *computed* derived column (e.g. `upper(x) AS c`) has no type without the **type-inference engine** (open), so field access on it isn't checked; and array/map element access (`m['k'].f`, `arr[0].f`) needs subscript modelling in the IR (the subscript lowers to `other`, dropping the field path). Subscript/colon forms (`col['k']`, `arr[0]`, variant `v:a.b`) recover only the base column — no mis-binding.
- **Outer-scope walk — FIXED 2026-06-06** in the shared resolver (`src/sema/resolve.ts`): column resolution is **local-first** — a column binds to a local source (even one with unknown columns) before it can correlate to an enclosing source by name coincidence. (scope.ts's schema-free `resolveColumn` is unchanged; this is the schema-aware resolver inference + lineage share.)
- **Correctness is self-graded** — no curated conformance set with expected outputs/bindings yet; the corpus only proves "no throw" + stats our own code computes.
- **`unsupported` is only set for non-query statements** (DDL/DML with no SELECT — there is no query scope to analyze, which is correct). Recursive CTEs lower as ordinary CTEs (the self-reference resolves to the CTE); a table-valued function in FROM (`range(…)`, `explode(…)`) is approximated as an opaque table source (its columns are unknown without the function's signature). Neither is flagged.
- **Symbol model — `src/symbols/`.** A SQL-native symbol model derived from the scope tree: `Sym { kind, modifiers, name, span, frame, definition? }`, a **kind × modifier** taxonomy. Kinds are the actual named relational entities — `table/cte/subquery/lateral` (relations), `column`, `alias`, `function`. (Token-level concerns — literals, keyword highlighting — belong to a separate SemanticTokens projection, not the symbol graph; `view`/parameters would need a catalog / param modelling we don't have, so they aren't kinds.) Modifiers: declaration/reference/output/aggregate/window/correlated/star. Emitted: relation references + CTE declarations; **alias** declarations (`t AS x`, precise span via the IR's `aliasCst`); column references, alias/computed output declarations, `*`; **function** symbols with aggregate/window; `correlated` via `resolveColumn`. **Definition→reference link:** a reference carries `definition` — a CTE ref → its `WITH` declaration; a column ref → the projection in the CTE/subquery that produces it (catalog table columns have none, correctly). `deriveSymbols` runs over all 1558 models with 0 throws.
  Column and function symbols carry their inferred **`type`** when `deriveSymbols(tree, schema)` is given a schema. How a *consumer* renders symbols (LSP `DocumentSymbol`/`SemanticTokens`, the debugger's `@dbg` frames) is the consumer's concern, not this library's. Minor: scalar/IN/EXISTS subqueries use a generic `_sub_` frame label; ORDER BY expressions aren't walked for function symbols.
- **Type inference — `src/infer/`.** A `Type` ADT (scalar/array/map/struct/unknown) + `parseType`; `inferType` is a bottom-up pass over the IR after scope/qualify. Types: literals (by form), casts (target type), columns (schema for base tables; recursing into the producing projection for derived/computed columns, cycle-guarded for recursive CTEs), struct field access, predicates/exists (boolean), operators (numeric-widening coercion via `coerce.ts`; comparisons/logical → boolean; `||` → string; date±interval), function calls (a return-type registry built from the **Databricks/Spark built-in function reference** — ~230 functions by family, NOT the corpus, which is only a validation gate), CASE (common branch type), subscript (array element / map value), **scalar subqueries** (their output column), **higher-order functions** (transform/zip_with/aggregate/reduce/transform_keys/values — bind the lambda params, type the body), and **constructors** (`map`/`struct`/`named_struct`/`from_json`). **Wired into both consumers:** qualify validates struct-field access on *computed* columns through `inferType`; symbols carry column/function `type`. Unknown only when genuinely undeterminable — no schema, or a function with no rule. That is the inherent limit, not a deferral.
- **Lineage — `src/lineage/`.** `lineage(tree, schema)` → for each output column, the **base-table columns it derives from**, traced through CTEs / subqueries / set operations (unions union both branches; `*` expands; higher-order functions need no special case — an output derives from all a function's arguments). Recursive CTEs are cycle-guarded. Rides the same shared resolver (`src/sema/resolve.ts`) as inference; needs no function/coercion catalogs (the payload is a set of origins, not a type). `originsOf(expr, scope, schema)` exposes a single expression's origins; **wired into symbols** as the column `origins` (base-table provenance). Runs over all 1558 models with 0 throws. Inherent limit: a lateral/TVF column has no base-table origin; without a schema, `*` can't be expanded (so star outputs over a bare table aren't enumerated).
- **Living-document editor front end — BUILT (closes the foundational gap).** The lexer/parser front end is no longer batch-shaped — it works on incomplete, changing, usually-invalid (mid-keystroke) input. (a) **Token stream as a first-class artifact:** `parse(sql, dialect)` returns `tokens: Token[]` (every token + exact span + role + channel) and a standalone `tokenize(sql, dialect)` exists (`src/token/{token,classify,map,tokenize}.ts`; roles via a shared classifier + per-dialect override tables). (b) **`lower()` is total** — never throws on broken/partial input (the two Databricks throws removed, the Redshift freeze gap fixed; broken text yields a flagged `query` IR); statement-level error containment verified (one broken statement doesn't truncate the token stream or smear diagnostics). (c) **`SqlDocument` (`src/document/document.ts`)** — the persistent, immutable, position-addressable per-file model that composes parse→resolveScopes (lazy schema `analyze`), caches it, holds tokens/cst/ast/scopes/diagnostics/lines (a new `LineIndex` for O(log n) position↔offset) + `tokenAt`/`nodeAt` (`node-at` moved here from `src/lsp/`). (d) **Three interactive editor features that live in the broken-input world:** semantic tokens (`src/lsp/features/semantic-tokens.ts`, from `doc.tokens`); completion (own ATN candidate walk reimplementing antlr4-c3's algorithm with NO dependency — `src/completion/`; all five dialects); signature help (curated per-dialect signature table — `src/signature/`). The LSP holds one `SqlDocument` per open file and consumes only the public surface (`src/api.ts`/`src/index.ts`). **Remaining limits (tracked, not the foundation):** incremental re-parse is deferred (perf, not correctness) — the document model rebuilds fully on edit; ANTLR isn't incremental and SQL statements are small, so full re-parse per keystroke is acceptable for now. Signature-help curated tables are bounded (~20–40 functions/dialect); the long tail degrades to name + active-argument (by design, Niclas-approved) — signatures are doc-cited, the high-risk arg-order subset doc-verified, the full set authored from established knowledge (re-verify against live docs as a follow-on if desired). `signatureAt` is a pure token scan, so `WITH cte (col, …)` yields a name-only hint (a CTE column list can't be told from a call without parser context) — inherent, low impact. Completion edges: BigQuery's dot-path token rewrite is skipped in the completion parser factory (not needed for the ATN walk) and backtick-quoted relation names aren't in the mid-edit FROM/JOIN fallback set; at the FROM relation slot the walk over-offers (columns/functions alongside tables — editors prefix-filter); a caret immediately inside an identifier token (no trailing space) returns no columns until a space is typed. Param metadata would also enrich completion + feed argument-type checking later (ties to the open type-inference scope).
- **LSP Wave-1 read/navigation/intelligence surface — BUILT.** The LSP now serves diagnostics (push + pull), hover, go-to-definition, references + documentHighlight, document symbols, code lens (reference counts), folding, selection, inlay hints (output-column types), semantic tokens (full + range + delta), completion + completion-resolve, and signature help — each a thin adapter over the public surface, the seam clean (acceptance suite at 36 tests). The new core primitive is `src/references/references.ts` (`referencesAt(scopes, offset, schema?, ast?) → Occurrences`), exported on the public surface. Building Wave-1 surfaced the drivers below: where a feature hits a wall, the wall is a tracked gap that drives the next parser/analysis work — this is the input to the next phase, recorded honestly rather than papered over.

  **LSP-surfaced drivers (what the editor surface needs that the library doesn't yet give it):**
  - **Type-inference depth** — unregistered functions / UDFs and positional `struct(...)` infer `unknown` (now visible via inlayHint). Drives inference-registry expansion + anonymous-struct typing.
  - **Cross-file / view lineage** — references can't unify a column through a view or across files; there is no project model. Drives the dbt project / multi-file model.
  - **Symbol identity edges** — `SELECT *`-expanded columns have no ref node; schema-free correlated / set-op columns under-group (they group correctly once a schema is given); an output-column declaration resolves to the first matching projection, not the deepest origin (matters for rename). Drives lineage / identity work.
  - **Curated signatures bounded** — completion-resolve / signature-help carry only ~20–40 functions per dialect; the long tail has no signature detail. Drives a curated table or full-registry param data.
  - **Minors:** the codeLens command has no click-through wiring yet; `PipeExpr`/`PipeStage` aren't barrel-exported (folding uses a local cast); references' `originKey` should use a tuple key rather than a flattened string before rename ships.

  **Deferred next phase (explicitly deferred, NOT silently cut):** rename / prepareRename (in-document via the references engine; column-across-views needs the lineage work above); codeAction quick-fixes on diagnostics; struct-field hover / typeDefinition; the dbt project / multi-file model + `workspaceSymbol` — which also unlocks **call hierarchy** (the CTE / dbt-model dependency graph) and **go-to-implementation** (a name → its defining view/model query); a formatter (roll in dbt-anvil's); anvil diagnostics as an extra diagnostic source.
- **Public API surface — BUILT (issue #2).** `src/api.ts` is the uniform/layered/composable/immutable surface; `src/index.ts` re-exports it plus the per-dialect `parse*`/`lower` building blocks (all four dialects) and the raw shared passes. `Dialect = "databricks" | "tsql" | "snowflake" | "bigquery"`; `parse(sql, dialect) → { ast, errors, cst }` (ast = the frozen IR, cst = raw-CST escape hatch); `analyze(sql, dialect, { schema? }) → { ast, errors, scopes, diagnostics, qualification, types, lineage, symbols }`. Each tier is a first-class terminal value. Composable: `qualify`/`lineage`/`deriveSymbols` accept the closest upstream `ScopeTree` (zero rework) OR a string/IR via the idempotent lift helpers `toAst`/`toScopes`. Typed wrappers keep raw collections out of the surface — `TypeInfo.typeOf(expr, scope)`, `Lineage.originsOf(column)` + `.all` (existing `Qualification.columnsOf` already complied). **Immutable IR:** every dialect's `lower()` deep-freezes the IR (`src/ir/freeze.ts`, skipping the foreign antlr `cst`/`aliasCst` back-refs); no pass mutates it — `tests/api.test.ts` feeds one `scopes` to qualify/lineage/deriveSymbols in both orders and asserts order-independence + an unchanged IR snapshot. **Inherent limit (not a deferral):** the IR carries no origin-dialect tag, so `toScopes(bareIR)` with no `opts.dialect` defaults to `"databricks"` for the dialect string (which only affects type-inference rules, never scope resolution); pass `{ dialect }` when lifting a bare IR of another dialect, or enter via `analyze`/`resolveScopes(ast, dialect)`.

## Repo layout (target)

```
grammars/<dialect>/ <Dialect>Lexer.g4, <Dialect>Parser.g4   (standalone fork of a grammars-v4 grammar, or hand-authored)
src/generated/      ANTLR output (gitignored, via `npm run gen`)
src/databricks/     parse.ts (parseDatabricks wrapper), ir.ts (IR types + lower CST->IR)  [Phase 1.5]
src/scope/          scope.ts (resolveScopes: schema-free name resolution over the IR)     [Phase 1.5]
src/qualify/        schema.ts (sqlglot-style schema input), qualify.ts (schema-fed)        [Phase 1.5]
src/api.ts          uniform/layered/composable/immutable public surface: Dialect, parse(sql,dialect), analyze(sql,dialect,{schema?}), lift helpers (toAst/toScopes), composable qualify/lineage/deriveSymbols, typed wrappers (TypeInfo/Lineage)
src/index.ts        public barrel: re-exports src/api.ts + the per-dialect parse*/lower building blocks (all four) and the raw shared passes
harness/            corpus loader + zero-errors runner
tools/gen.mjs       generation driver (antlr-ng or jar)
tests/              vitest specs
docs/PLAN.md        this file
```

---

## Phase 0 — Prove "ANTLR → TypeScript" works (de-risk the central bet)

Goal: a generated TS parser parsing a string in a test, before any SQL. This validates the toolchain choice on day one.

### Task 0.1: Scaffold the Node/TS project

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `vitest.config.ts`

- [ ] **Step 1: Init project**

Run:
```bash
cd /c/Development/github/sql-dialect-grammars
npm init -y
npm i -D typescript vitest @types/node
npm i antlr4ng
```

- [ ] **Step 2: Write `tsconfig.json`** (antlr4ng needs ES2022)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `.gitignore`**

```
node_modules/
dist/
src/generated/
harness/corpus/
harness/oracle/
*.tsbuildinfo
```

- [ ] **Step 4: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold sql-dialect-grammars project"
```

### Task 0.2: Generate a toy grammar to TypeScript

**Files:**
- Create: `grammars/toy/ToyLexer.g4`, `grammars/toy/ToyParser.g4`, `tools/gen.mjs`
- Test: `tests/toy.test.ts`

- [ ] **Step 1: Write the toy split grammar**

`grammars/toy/ToyLexer.g4`:
```antlr
lexer grammar ToyLexer;
NUMBER : [0-9]+ ;
PLUS   : '+' ;
WS     : [ \t\r\n]+ -> skip ;
```

`grammars/toy/ToyParser.g4`:
```antlr
parser grammar ToyParser;
options { tokenVocab=ToyLexer; }
sum : NUMBER (PLUS NUMBER)* EOF ;
```

- [ ] **Step 2: Write the generation driver** `tools/gen.mjs`

Try the no-Java path first; document the fallback in a comment.
```js
// Generation driver. Primary: antlr-ng (pure TS, no Java).
// Fallback: `java -jar antlr-4.13.2-complete.jar -Dlanguage=TypeScript ...`
import { execSync } from "node:child_process";
const dialect = process.argv[2] ?? "toy";
const out = `src/generated/${dialect}`;
execSync(
  `npx antlr-ng -Dlanguage=TypeScript -o ${out} grammars/${dialect}/*.g4`,
  { stdio: "inherit" }
);
```
Add to `package.json` scripts: `"gen": "node tools/gen.mjs"`.

- [ ] **Step 3: Run generation, verify it fails first if antlr-ng is missing, then install and succeed**

Run: `npm i -D antlr-ng && npm run gen toy`
Expected: files appear under `src/generated/toy/` (`ToyLexer.ts`, `ToyParser.ts`).
If antlr-ng cannot generate, switch `gen.mjs` to the jar path (requires a JRE) and re-run. **Record which path worked in CLAUDE.md.**

- [ ] **Step 4: Write the failing parse test** `tests/toy.test.ts`

```ts
import { CharStream, CommonTokenStream } from "antlr4ng";
import { ToyLexer } from "../src/generated/toy/ToyLexer.js";
import { ToyParser } from "../src/generated/toy/ToyParser.js";
import { expect, test } from "vitest";

function parse(input: string) {
  const lexer = new ToyLexer(CharStream.fromString(input));
  const parser = new ToyParser(new CommonTokenStream(lexer));
  let errors = 0;
  parser.removeErrorListeners();
  parser.addErrorListener({ syntaxError: () => { errors++; },
    reportAmbiguity(){}, reportAttemptingFullContext(){}, reportContextSensitivity(){} });
  const tree = parser.sum();
  return { tree, errors };
}

test("parses a sum", () => {
  expect(parse("1 + 2 + 3").errors).toBe(0);
});
test("flags a syntax error", () => {
  expect(parse("1 + + 2").errors).toBeGreaterThan(0);
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: both pass. If imports resolve and a tree comes back, the toolchain is proven.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: prove ANTLR4 -> TypeScript (antlr4ng) toolchain with toy grammar"
```

**Phase 0 done when:** `npm run gen toy && npm test` is green and CLAUDE.md records the working generation path.

---

## Phase 1 — Dialect #1: Databricks (fork → generate → smoke test)

Goal: a standalone `grammars/databricks/` grammar, forked from grammars-v4's `sql/databricks`, that generates to TS and smoke-parses a handful of canonical statements. (Replaces the old "core grammar" phase — there is no core.)

### Task 1.1: Fork the Databricks grammar

**Files:**
- Create: `grammars/databricks/DatabricksLexer.g4`, `grammars/databricks/DatabricksParser.g4`

- [ ] **Step 1:** Copy grammars-v4's `DatabricksLexer.g4` + `DatabricksParser.g4` into `grammars/databricks/`. Keep the upstream BSD/MIT license header and record the source commit SHA in a header comment (provenance).
- [ ] **Step 2:** `npm run gen databricks` → generate to `src/generated/databricks/`. If the grammar uses ANTLR features `antlr-ng` can't handle, fall back to the jar (record which worked).
- [ ] **Step 3:** Commit: `feat(databricks): fork grammar from grammars-v4`.

### Task 1.2: Databricks smoke tests

**Files:**
- Test: `tests/databricks.test.ts`

- [ ] **Step 1:** Write a `parseDatabricks(sql)` helper (same shape as the toy test's `parse`, pointing at the Databricks lexer/parser, calling the top rule).
- [ ] **Step 2:** Add tests for ~15 canonical statements (a `SELECT … JOIN … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT`; a CTE; `UNION ALL`; a window function; `INSERT … SELECT`; `CREATE TABLE … USING DELTA`; `CREATE VIEW`). Assert zero syntax errors.
- [ ] **Step 3:** Run, fix the entry rule / any generation issues until green. If the grammars-v4 grammar is too thin for a canonical case, fill the gap (Spark's `SqlBase*.g4` is the reference — Databricks SQL = Spark SQL).
- [ ] **Step 4:** Commit: `test(databricks): canonical statements parse`.

**Phase 1 done when:** the canonical Databricks statements parse with zero errors and `npm run gen databricks` is reproducible.

---

## Phase 1.5 — Databricks semantic layer: scope → qualify (CURRENT FOCUS)

> Added 2026-06-06. The Databricks grammar is in and parses 100% of the real Oatly corpus, so we go **deep on Databricks** before the other dialects: a small semantic layer on top of the parse tree that the editor and the SQL debugger consume. Databricks-only; cross-dialect abstraction is extracted when a second dialect forces it. Build **scope first** (schema-free, unlocks most value), **qualify second** (schema-fed).

> **Status (2026-06-06): name-resolution layer built, 59 tests green, typecheck clean.** Done test-first: `parseDatabricks`, IR + `lower` (SELECT, CTE, aliases incl. column-alias lists, joins, subqueries incl. scalar/correlated, set ops, PIVOT/UNPIVOT/LATERAL VIEW, structural projection naming, `ColumnRef` extraction, non-query stub); `resolveScopes` (sources, CTE resolution, output columns, `resolveColumn` with outer-scope walk); `qualify` + `Schema` (`*` expansion, unknown-table + column-level unknown/ambiguous-column diagnostics); `src/index.ts` public API. Corpus gate (`tests/scope.corpus.test.ts`) runs `lower`+`resolveScopes`+`resolveColumn` over all 1558 Oatly models — **0 throws**; scoreboard: outputs known ~82%, column refs ~55% bound schema-free. **What is genuinely left is in [Open Gaps](#open-gaps-tracked-not-descoped) — chiefly expression modelling (unbuilt, ~half of SQL's meaning), plus `t.*`, struct access, tightening the outer-scope walk, and a curated conformance set. None of that is descoped; it is unfinished.**

**Pipeline:** `sql → parse → CST → lower → IR → resolveScopes → ScopeTree → qualify(schema) → Qualification + Diagnostics`. Each arrow is a pure function. Positions flow through via CST back-references (`ctx.start`/`ctx.stop`), so every IR/scope node maps to an exact source span — the thing editor + debugger need and sqlglot's AST drops (see *Risks & open questions → CST vs AST*, now resolved).

**Why an IR and not the raw CST:** Spark's CST is ~12 levels deep and grammar-shaped; doing name resolution on it directly is painful and couples everything to the grammar. The IR is a compact model (the "thin AST" deferred in Phase 1), and the CST→IR `lower` step is the only Databricks-specific piece — scope and qualify operate on the IR and stay dialect-neutral.

### Task 1.5.1: Parse wrapper + IR types + `lower(tree)`

**Files:** Create `src/databricks/parse.ts`, `src/databricks/lower.ts` (the CST→IR lowering; IR types live in `src/ir/ir.ts`); Test `tests/databricks.ir.test.ts`

- [ ] **Step 1:** `parseDatabricks(sql) → { tree, errors }` — one wrapper that dedupes the lexer/parser/error-listener boilerplate currently copied across the test files.
- [ ] **Step 2:** Define the IR node types in `ir.ts`: `QueryExpr` (CTEs + body), `SelectExpr` (projections, sources, clauses we use), `Source` (`table | subquery | cte-ref | join`), `Projection` (expr CST-ref, output name, `isStar`), `ColumnRef` (qualifier?, name), `CteDef` (name, column aliases?, body). Every node carries a back-ref to its CST context + a `span` helper.
- [ ] **Step 3 (TDD):** Write failing tests asserting the IR shape for the representative queries from `databricks.structure.test.ts` (e.g. `SELECT a, b FROM t` → `SelectExpr` with 2 projections + 1 table source named `t`; a CTE query → 1 `CteDef`). Expressions are not yet modelled (see **Open Gaps** — this is an unfinished gap, not a scope cut); today only `ColumnRef`s are extracted from them.
- [ ] **Step 4:** Implement `lower(tree)` (CST→IR visitor) until green. Commit.

### Task 1.5.2: Scope resolver (schema-free)

**Files:** Create `src/scope/scope.ts`; Test `tests/scope.test.ts`

- [ ] **Step 1:** `resolveScopes(ir) → ScopeTree`. `Scope = { node, sources: Map<name, ResolvedSource>, ctes: Map<name, CteDef>, outputs, parent?, children }`. `ResolvedSource = table | cte-ref→scope | subquery→scope`.
- [ ] **Step 2:** Resolution without schema: alias/name → source; chained CTE references (later CTEs see earlier); subquery outputs (from their projections, `unknown` if they star over a physical table); `resolveColumn(ref) → resolved | ambiguous | needs-schema` (`t.c` → source `t`; bare `c` → the single source whose outputs are known to contain it).
- [ ] **Step 3:** Coverage: SELECT, WITH (chained CTEs), subqueries (derived tables + scalar/IN), JOINs (all kinds), set ops, PIVOT/UNPIVOT/LATERAL VIEW, correlated/outer-scope columns — **built** (2026-06-06). **Still flagged `unsupported` (Open Gaps), never crash:** recursive CTEs, table-valued functions.
- [ ] **Step 4 (TDD):** Tests assert sources per scope, CTE resolution, column→source, ambiguity, and `needs-schema` cases — with spans. Commit.

### Task 1.5.3: Corpus stability + sanity run

**Files:** Test `tests/scope.corpus.test.ts` (skipIf no local corpus)

- [ ] **Step 1:** Run `lower` + `resolveScopes` over a sample of the 1558 Oatly files. Assert **no crashes** and report resolution stats (resolved / ambiguous / needs-schema / unsupported counts). This is a stability + sanity gate, **not** a 100%-resolve gate — schema-free resolution legitimately can't resolve everything.

### Task 1.5.4: Schema input + qualify (schema-fed)

**Files:** Create `src/qualify/schema.ts`, `src/qualify/qualify.ts`; Test `tests/qualify.test.ts`

- [ ] **Step 1:** `Schema` — accept the sqlglot-style nested mappings (`{table:{col:type}}`, `{db:{table:{col}}}`, `{catalog:{schema:{table:{col}}}}`), normalize internally, expose `columnsFor(parts) → {name,type?}[] | undefined` with Databricks case-insensitive matching. Types are opaque strings (reserved for lineage later).
- [ ] **Step 2:** `qualify(scopes, schema) → { resolvedColumns, expandedStars, diagnostics }`. Expand `*`/`t.*` from schema (tables) or subquery/CTE outputs; resolve bare columns via schema column lists; emit span-carrying diagnostics (unknown column, ambiguous column, unknown source). **No SQL rewrite.**
- [ ] **Step 3 (TDD):** Hand-written `Schema`; assert `*` expansion, bare-column resolution, and each diagnostic kind. Commit.

### Task 1.5.5: Public exports

**Files:** Create/extend `src/index.ts`

- [ ] **Step 1:** Export `parseDatabricks`, `lower`, `resolveScopes`, `qualify`, `Schema`, and the IR/Scope/Qualification types. Commit.

**Phase 1.5 done when:** scope resolves the representative + corpus-sample queries with structural assertions (no crashes on the Oatly sample), qualify expands stars + emits diagnostics against a test schema, and the whole pipeline typechecks (tsgo) and is vitest-green. Deferred consumers (debug-symbol emitter matched to dbt-studio's `SymbolEntry`/`@dbg` format; editor diagnostics/semantic tokens) are noted but not built here.

---

## Phase 2 — Conformance harness (the gate for everything after)

Goal: `npm run harness -- --dialect=<d>` parses a **known-good corpus** of valid SQL and requires **zero syntax errors**. No Python in the loop — the corpus *is* the spec of "must parse." Built once, reused for every dialect. Harness shape ported in spirit from `dbt-studio-vscode/experiments/native-sql-parser-v7/harness`.

### Task 2.1: Assemble the known-good corpus

**Files:**
- Create: `harness/corpus/<dialect>/` (committed seed files), `harness/load-corpus.ts`

- [ ] **Step 1:** Collect valid SQL into `harness/corpus/<dialect>/*.sql`, one statement per file (or a JSONL of `{id, sql}`). Sources in priority order: the forked grammar's own `examples/` from grammars-v4 (Databricks and T-SQL both ship these), then a `seed/` of our own real compiled queries, then hand-added cases as gaps surface. Everything in the corpus is *asserted valid* by virtue of being there.
- [ ] **Step 2:** `npm run harness:load -- --dialect=databricks` reports a non-empty corpus count. Commit the seed statements.

### Task 2.2: Runner + KPI (zero-errors gate)

**Files:**
- Create: `harness/run.ts`

- [ ] **Step 1:** For each corpus item, parse with our generated `<dialect>` parser, counting syntax errors via an error listener (same shape as the toy test). Bucket into **pass** (0 errors) and **fail** (>0); capture the first error message + line/col for each failure.
- [ ] **Step 2:** Print a KPI line: `dialect=databricks  corpus=N  pass=NN%  fail=K` and list the failing statements. Exit non-zero if K > threshold (start high, ratchet to 0).
- [ ] **Step 3:** Commit: `feat(harness): zero-errors conformance runner over known-good corpus`.

**Phase 2 done when:** `npm run harness -- --dialect=databricks` runs end to end and prints a zero-errors KPI over its corpus.

---

## Phase 3 — Dialect #1: Redshift (prove the fork-and-edit loop)

Goal: a `grammars/redshift/` grammar (fork of core + Redshift edits) that drives `we-reject-they-accept` to ~0 on the Redshift corpus. Redshift is chosen because its surface is the smallest of the three (Postgres-derived).

### Task 3.1: Fork core → redshift

- [ ] **Step 1:** Copy `grammars/core/*` → `grammars/redshift/` as `RedshiftLexer`/`RedshiftParser`. `npm run gen redshift`. Add a `parseRedshift` test helper. Commit.

### Task 3.2: Drive the corpus green (TDD-for-grammars loop, repeat per failure cluster)

For each cluster of `we-reject-they-accept` failures the harness reports:
- [ ] **Step 1:** Run `npm run harness -- --dialect=redshift`; read the top failing statements.
- [ ] **Step 2:** Identify the missing/incorrect construct; find it in the **Redshift manual** and cross-check **sqlglot's `redshift.py`**.
- [ ] **Step 3:** Edit the grammar to add/adjust the rule. Comment it with the manual link.
- [ ] **Step 4:** `npm run gen redshift && npm run harness -- --dialect=redshift`; confirm the cluster is now accepted and nothing regressed.
- [ ] **Step 5:** Commit: `feat(redshift): support <construct>`.

Known Redshift clusters to expect (seed the corpus with these): `COPY`/`UNLOAD` with option lists, `CREATE TABLE` DISTKEY/SORTKEY (`COMPOUND`/`INTERLEAVED`)/ENCODE, late-binding views (`WITH NO SCHEMA BINDING`), `APPROXIMATE`, `GETDATE()`/Redshift functions, `::` casts, `QUALIFY`.

**Phase 3 done when:** Redshift `we-reject-they-accept` ≤ agreed threshold (target 0 on the seed corpus) and the loop in 3.2 is documented as the per-dialect method.

---

## Phase 4 — Dialect #2: Snowflake — DONE 2026-06-10 (fork-and-clean, not hand-authored)

> **Superseded by the build.** The original framing (hand-author; "no open grammar exists") was wrong: grammars-v4 `sql/snowflake` exists (4.3k-line split parser, actively maintained since 2022, used in production by Bytebase). Snowflake was **forked** from it at `923a1a9` — the same approach as T-SQL — and cleaned against the official docs.

What was built (all gated, see `tests/snowflake.*`):

- **Grammar** (`grammars/snowflake/`): fork plus doc-cited fixes — window frames (upstream had them commented out), `SELECT *` ILIKE/EXCLUDE/REPLACE/RENAME, `$$` strings as expressions, real MATCH_RECOGNIZE patterns, WITHIN GROUP on ordered-set aggregates, multi-row VALUES, structured `OBJECT(…)`/`MAP(…)`/FILE types, quoted-keyword strings (`'CSV'` &c. were lexer tokens), ALTER SESSION with any parameter, `!method()` calls, ICEBERG tables, stage queries in FROM, `IDENTIFIER('…')`, GRANT DATABASE ROLE.
- **Conformance corpus**: every SQL example from all 2,348 docs.snowflake.com sql-reference pages (`tools/scrape-snowflake-docs.mjs` → gitignored `harness/local/snowflake-docs/`, 6,259 files). Gates: grammars-v4's 51 examples at **100%**; the docs corpus as a **ratchet** (baseline in `tests/snowflake.corpus.test.ts`). Remaining shortfall is platform DDL (LISTING/APPLICATION/CORTEX …), standalone Snowflake Scripting blocks, and the statement-option long tail — raise the baseline as fixes land.
- **Pipeline**: `src/snowflake/parse.ts` + `lower.ts` onto the shared IR (QUALIFY, star modifiers, UNION BY NAME, FLATTEN→lateral, PIVOT/UNPIVOT, variant paths→subscript, VALUES→modelled selects, `$n` refs); the semantic layer runs unchanged (`snowflake.pipeline` suite). Inference knowledge in `src/infer/snowflake.ts` (~300 doc-sourced rules, NUMBER→decimal aliases, decimal division).

Open (tracked in `docs/snowflake-backlog.md`): the docs-corpus grammar long tail, embedded UDF bodies beyond `$$`-blob treatment, star-REPLACE type threading, `src/index.ts` export at packaging.

---

## Phase 5 — Dialect #4: BigQuery (GoogleSQL) — DONE 2026-06-13 (fork-and-clean, not hand-authored)

> **Superseded by the build.** The original framing (hand-author; "no open grammar exists") was wrong, the same miss as Snowflake: **`bytebase/parser` `googlesql/`** is a complete ANTLR4 port of GoogleSQL (BSD-3). BigQuery was **forked** from it — vendored at `grammars/bigquery/` — the only work to make it a TS parser was porting the Go-target embedded code (49 `NotifyErrorListeners` error actions + 7 `localctx`/`:=`/`GetStop()` predicate-and-declaration blocks) to the antlr4ng API. Entry rule `root` (`stmts EOF`).

What shipped (see CLAUDE.md Current status for the live detail):
- **Parse** — `src/bigquery/parse.ts` (two-stage SLL→LL). Generates + typechecks clean.
- **Lower** — `src/bigquery/lower.ts` maps the ZetaSQL query CST onto the shared IR: projections (incl. `SELECT * EXCEPT/REPLACE`, `t.*`), table/subquery/UNNEST-lateral sources, join chains + ON, WHERE/GROUP BY (incl. ALL + ROLLUP/CUBE/GROUPING SETS keys)/HAVING/QUALIFY, CTEs (incl. RECURSIVE), UNION/EXCEPT/INTERSECT, ORDER BY/LIMIT, and the left-recursive expression grammar (binary/unary/CASE/CAST/EXTRACT/function+OVER/IN/BETWEEN/LIKE/IS/subscript/STRUCT/ARRAY/lambda/scalar+ARRAY+EXISTS subqueries). Statement-kind is parse-derived. A valid parse never throws; unmodelled forms become `other`.
- **Inference** — `src/infer/bigquery.ts` (INT64/FLOAT64/NUMERIC/BOOL/BYTES/JSON aliases, typed-literal rules, INT64/INT64→FLOAT64 division, a seeded ~190-function GoogleSQL return registry).
- **Grammar build-out (2026-06-13)** — after the initial port, the grammar was extended to the full GoogleSQL/ZetaSQL surface (transcribed from `google/googlesql` `googlesql/parser/googlesql.tm`, the live Textmapper grammar; the old Bison `.y` is gone): **pipe syntax** (`|>`, all operators + FROM-queries + subpipelines), **graph/GQL** (`GRAPH_TABLE(…)`, the `GRAPH …` statement, patterns/quantifiers/path-modes/search-prefixes, CALL/YIELD/PER, `CREATE/DROP PROPERTY GRAPH`, graph subqueries, `IS SOURCE/DESTINATION/LABELED`), **chained calls**, **braced/proto/struct constructors**, **MATCH_RECOGNIZE** (quantifiers/anchors/AFTER MATCH SKIP/OPTIONS), **FOR UPDATE**, **LATERAL**, **MAP type**, sequences, `LIMIT ALL`, `SET GENERATED`, and **DOT_IDENTIFIER** (reserved keywords as post-dot path components). Several upstream port bugs were fixed (TVF paren, AT-TIME-ZONE keyword, `braced_constructor` `{`/`}`, `cube_list` first expr, USING comma-list, the `>>` token swallowing nested-generic closers). `lower` additionally maps FROM-queries and `TABLE name` to modelled selects; pipe transforms and graph patterns parse but lower to `other`/base-query.
- **Gate** — `bigquery.corpus.test.ts` against the **ZetaSQL `.test` golden corpus** (now **17,272 positive / 273 negative** cases; the extractor `tools/extract-googlesql-tests.mjs` is mode-aware — drops `type`-mode, wraps `expression`/`measure_expression` as `SELECT (…)` — and classifies each `{{…}}` alternation variant by its own ALTERNATION GROUP expected). The project's first **two-sided** conformance gate: positives parse at **17,128/17,272 (99.2%)**, syntax-error negatives rejected at **211/273**, plus a no-throw sweep proving `lower`+`resolveScopes` total over every parsed positive.

**Open gaps (not descoped):** the ~144 unparsed positives are ZetaSQL errors mis-bucketed as positive (empty `SELECT FROM`, `*_errors` families whose expected is a non-"Syntax error" error), SQLBuilder round-trip DDL artifacts, and niche DDL/ordering edges (pivot/unpivot after `WITH OFFSET`, detailed struct-column attributes, `show tables |> …` pipes-after-non-query, proto-constructor `*`/`?` update markers, `foo.42` numeric path components). Pipe transforms and graph patterns parse but are not modelled in the IR (lower to `other`/base-query) — modelling them needs IR extensions. Expression coverage isn't wired into `ir-completeness`.

**Ground truth:** Google's **GoogleSQL/ZetaSQL** — read `googlesql/parser/googlesql.tm` as the spec, and the `googlesql/analyzer/testdata/*.test` files as the conformance corpus (the grammar we fork is Bytebase's ANTLR port, extended toward `googlesql.tm`, not ZetaSQL itself).

---

## Phase 6 — Packaging

- [ ] Public `src/index.ts`: `parse(sql: string, dialect: "redshift"|"snowflake"|"bigquery"): ParseResult`.
- [ ] `npm run build` produces a consumable package; document `npm run gen` as a prepublish step.
- [ ] Decide on contributing the grammars upstream (grammars-v4 is BSD and accepts contributions; the dialects with no existing grammar are the highest-value additions).
- [ ] Write `README.md` (deferred until the shape is real).

---

## Cross-cutting: reserved-word strategy (the genuinely hard part)

Warehouse SQL lets most keywords double as identifiers; getting the reserved set right per dialect is the #1 source of grammar pain.

- Keep a `nonReserved` parser rule per dialect listing keyword tokens usable as identifiers (Spark's grammar already has one to fork).
- Seed each dialect's reserved/non-reserved partition from: the vendor manual's reserved-words page (authoritative) + sqlglot's keyword sets + dbt's `*Lexer.tokens`.
- Add corpus cases that use keywords as column/table aliases (e.g. `SELECT 1 AS value`) — these catch over-reservation.

## Cross-cutting: lexer modes

Default to a single lexer mode. Introduce a mode only when a construct can't be tokenized context-free: dollar-quoting and embedded UDF bodies (Snowflake/BigQuery). This is the concrete reason the grammars are **split** (combined grammars can't define modes).

## Risks & open questions

- **antlr-ng maturity:** if the pure-TS generator can't handle a large grammar, fall back to the ANTLR jar (Java). Phase 0 settles this.
- **No automatic over-permissiveness check:** nothing flags SQL we *accept* that is actually invalid. Accepted as a tradeoff given scope (a parse tree for tooling, fed already-valid SQL). The manual is always truth.
- **Parse tree (CST) vs AST:** ~~Decide in Phase 1...~~ **Resolved 2026-06-06:** consumers walk the CST directly for purely positional work (diagnostics, semantic tokens), but the **scope/qualify** semantic layer needs a normalized model, so Phase 1.5 adds a thin **IR** (`lower(tree)`) — built because semantics need it, not speculatively. The IR keeps CST back-refs so positions are never lost.
- **Corpus coverage ≠ correctness:** a green corpus means "parses these inputs," not "complete." Log corpus size and expand it as gaps surface; never claim a dialect is "done," only "passes corpus N."

## Success criteria

- Each shipped dialect: **zero syntax errors** on its committed known-good corpus, corpus ≥ an agreed minimum size, `npm run gen <dialect> && npm run harness -- --dialect=<dialect>` reproducibly green.
- The grammars are readable, manual-cross-referenced `.g4` files that generate working TypeScript parsers via `npm run gen`.
