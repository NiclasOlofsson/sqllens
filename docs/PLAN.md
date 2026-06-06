# TS SQL Dialect Parser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build **TypeScript SQL parsers we can consume in our own projects**, generated from open, split ANTLR4 grammars, each validated against a known-good corpus it must parse with zero errors. The parser is the deliverable; the `.g4` grammar is the means (and a by-product we contribute back upstream when we improve it). Two kinds of target: **fork-and-clean** from an existing grammars-v4 `.g4` (**Databricks, T-SQL** — the current focus) and **hand-author** from the manual (the warehouse dialects with no open grammar: **Redshift, Snowflake, BigQuery**).

**Architecture:** ANTLR4 split grammars (`lexer grammar` + `parser grammar`), **one standalone pair per dialect — no shared "core" grammar, no inheritance** (ANTLR `import` doesn't compose; "core SQL" is a concept, not an artifact). Each dialect is forked from its best starting point: **Databricks** ← apache/spark's `SqlBase*.g4` (forked + renamed, embedded Java ported to TS), **T-SQL** ← grammars-v4 `sql/tsql`, and Redshift/Snowflake/BigQuery hand-authored. The ANTLR TypeScript target + antlr4ng runtime generate the parsers. A conformance harness parses a per-dialect **known-good corpus** and requires **zero syntax errors**. The parse layer is syntax-only, but Databricks has a **semantic layer** (scope → qualify, plus expression IR) built on the parse tree — see Scope and Phase 1.5.

> **Updated 2026-06-06:** (1) **No shared "core" grammar** — each dialect is a standalone fork (see Architecture); Phase 1 is now the Databricks fork, not a core build. (2) Dialect order: Databricks → T-SQL → Redshift → Snowflake → BigQuery. (3) Validation gate is a **known-good corpus that must parse with zero errors**. Phases 3–5 below still hold the original Redshift-first detail and are **pending a clean re-sequence** — the per-dialect *method* (corpus → fail → manual → grammar edit → green → commit) is unchanged. See CLAUDE.md for rationale.

**Tech Stack:** ANTLR4 (grammars), antlr4ng (TS runtime) + antlr-ng or the ANTLR jar (generator), TypeScript, vitest, Node 20+. No Python in the loop.

---

## Scope

**In:** lexer + parser grammars that recognize each dialect's surface (queries, DML, the common DDL); generated TS parsers; a public `parse(sql, dialect)` returning a parse tree (or a syntax error); a conformance harness.

**Out — actually cleared by Nicke:** SQL transpilation only ("i dont care at all about the transpile"). A query engine is out by definition (this is a parser, not an execution engine). **NOT cleared — open, do NOT treat as Out** (a prior edit wrongly stamped these "Nicke-cleared"; corrected 2026-06-06): **type inference** and **column lineage** (lineage was only noted "revisit later", rides on qualify). **Amended 2026-06-06:** name resolution (**scope**) and column/`*` resolution against a supplied schema (**qualify**) are **in scope for Databricks** as a semantic layer on the parse tree (Phase 1.5) — the consumers (editor support, the SQL debugger) need them. The warehouse dialects get the grammar only until a second consumer forces the abstraction.

## Open Gaps (tracked, NOT descoped)

These are real, unfinished parts of the job. They stay here, answering "what's left," until built or until Nicke explicitly moves one to *Out*. They are **not** scope boundaries — never treat them as "v1 doesn't do X."

- **Expression modelling — BUILT 2026-06-06; corpus-complete.** `lowerExpression` produces a typed `Expr` tree for every expression: column, literal, star, binary, unary, function (aggregate + window/`OVER`), `CASE`, cast, scalar subquery, `EXISTS`, **predicate** (`IS [NOT] NULL`, `[NOT] IN`, `BETWEEN`, `LIKE`/`RLIKE`, `IS [NOT] DISTINCT FROM`), **lambda** (`x -> …`), **subscript** (`a[i]`), and the `date_add`/`datediff`/`CURRENT_*` special-form functions. **Every expression node in all 1558 models lowers to a typed node — 0 `other` — enforced by `tests/ir-completeness.test.ts`** (which fails with the exact CST type if anything leaks). The `other` fallback stays in the IR as a safety net for constructs the corpus doesn't use (e.g. `a:b` colon paths), so nothing is ever dropped. `SelectExpr.columns` is derived from the `Expr` trees (projections, WHERE, JOIN `ON`, GROUP BY, HAVING, ORDER BY); a **CST↔IR conservation gate** (`tests/conservation.test.ts`) runs over all 1558 models and fails if the IR drops any clause the parse tree contains. GROUP BY captures **every** grouping key, including each one inside ROLLUP/CUBE/GROUPING SETS. `aggregate` is decided by a comprehensive Spark/Databricks aggregate-name set (the standard approach — there is no signature catalog at parse time).
- **`t.*` qualified-star expansion — FIXED 2026-06-06.** The star Expr captures its qualifier; qualify's `expandStar` expands only the named source (its last name part), not every source.
- **Struct/field dot-access — FIXED 2026-06-06.** `resolveColumn`/`qualify` no longer assume `parts[-2]` is the qualifier. `splitColumnRef` splits a dotted ref into qualifier / column / field-path against the visible sources (a leading part is a qualifier only if it names a source, else it's the column and the rest is field navigation — Spark's resolution order). `t.addr.city` binds to `t` with column `addr`, fields `[city]`; unqualified `addr.city` binds to the column `addr`. Corpus schema-free `unresolved` dropped 44→33. **Struct field-existence validation — BUILT 2026-06-06.** `parseStructFields` (schema.ts) parses `struct<…>` type strings, nesting-aware; qualify's `checkFieldPath` walks the field path against the base column's struct type and emits an `unknown-field` diagnostic when a known struct lacks the field (`t.addr.city` → checks `city` in `addr`'s struct; nested `a.b.c` walks down). **Types propagate through derived columns:** qualify threads column types bottom-up (`resolved` carries `Column[]` with types), so a struct column threaded through a CTE, subquery, aliased CTE (`WITH c (a) AS …`), or union (left branch) is validated too — not only base-table columns. A non-struct, array/map, or unknown type stops the walk without flagging. **Genuine boundary — separate features, not this one:** a *computed* derived column (e.g. `upper(x) AS c`) has no type without the **type-inference engine** (open), so field access on it isn't checked; and array/map element access (`m['k'].f`, `arr[0].f`) needs subscript modelling in the IR (the subscript lowers to `other`, dropping the field path). Subscript/colon forms (`col['k']`, `arr[0]`, variant `v:a.b`) recover only the base column — no mis-binding.
- **Outer-scope (`resolveColumn`) walk is too permissive** — it walks all enclosing scopes for any unresolved ref, so a typo can "resolve" to an outer source by name coincidence. Needs tightening to genuine correlation rules.
- **Correctness is self-graded** — no curated conformance set with expected outputs/bindings yet; the corpus only proves "no throw" + stats our own code computes.
- **`unsupported` is only set for non-query statements** (DDL/DML with no SELECT — there is no query scope to analyze, which is correct). Recursive CTEs lower as ordinary CTEs (the self-reference resolves to the CTE); a table-valued function in FROM (`range(…)`, `explode(…)`) is approximated as an opaque table source (its columns are unknown without the function's signature). Neither is flagged.
- **Symbol model — `src/symbols/`.** A SQL-native symbol model derived from the scope tree: `Sym { kind, modifiers, name, span, frame, definition? }`, a **kind × modifier** taxonomy. Kinds are the actual named relational entities — `table/cte/subquery/lateral` (relations), `column`, `alias`, `function`. (Token-level concerns — literals, keyword highlighting — belong to a separate SemanticTokens projection, not the symbol graph; `view`/parameters would need a catalog / param modelling we don't have, so they aren't kinds.) Modifiers: declaration/reference/output/aggregate/window/correlated/star. Emitted: relation references + CTE declarations; **alias** declarations (`t AS x`, precise span via the IR's `aliasCst`); column references, alias/computed output declarations, `*`; **function** symbols with aggregate/window; `correlated` via `resolveColumn`. **Definition→reference link:** a reference carries `definition` — a CTE ref → its `WITH` declaration; a column ref → the projection in the CTE/subquery that produces it (catalog table columns have none, correctly). `deriveSymbols` runs over all 1558 models with 0 throws.
  **NOT done (open):** **types on column symbols** — wiring inference (below) in. How a *consumer* renders symbols (LSP `DocumentSymbol`/`SemanticTokens`, the debugger's `@dbg` frames) is the consumer's concern, not this library's. Minor: scalar/IN/EXISTS subqueries use a generic `_sub_` frame label; ORDER BY expressions aren't walked for function symbols.
- **Type inference — `src/infer/`.** A `Type` ADT (scalar/array/map/struct/unknown) + `parseType`; `inferType` is a bottom-up pass over the IR after scope/qualify. Types: literals (by form), casts (target type), columns (schema for base tables; recursing into the producing projection for derived columns, cycle-guarded for recursive CTEs), struct field access, predicates, operators (numeric-widening coercion via `coerce.ts`; comparisons/logical → boolean; `||` → string; date±interval), function calls (a return-type registry built from the **Databricks/Spark built-in function reference** — ~230 functions by family, NOT the corpus, which is only a validation gate), CASE (common branch type), subscript (array element / map value). Unknown only when there is no rule — never a guessed type.
  **NOT done (open):** scalar subqueries and lambdas aren't typed; functions whose return is genuinely arg/lambda/schema-dependent (`transform`, `from_json`, `named_struct`, `map`/`struct` constructors) are `unknown`; **not yet wired into qualify** (so computed-column struct-field validation still can't run) **or the symbol model** (column `type`). The wiring is the payoff and the next step.

## Repo layout (target)

```
grammars/<dialect>/ <Dialect>Lexer.g4, <Dialect>Parser.g4   (standalone fork of a grammars-v4 grammar, or hand-authored)
src/generated/      ANTLR output (gitignored, via `npm run gen`)
src/databricks/     parse.ts (parseDatabricks wrapper), ir.ts (IR types + lower CST->IR)  [Phase 1.5]
src/scope/          scope.ts (resolveScopes: schema-free name resolution over the IR)     [Phase 1.5]
src/qualify/        schema.ts (sqlglot-style schema input), qualify.ts (schema-fed)        [Phase 1.5]
src/index.ts        public API: parseDatabricks, lower, resolveScopes, qualify, Schema
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

**Files:** Create `src/databricks/parse.ts`, `src/databricks/ir.ts`; Test `tests/databricks.ir.test.ts`

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

## Phase 4 — Dialect #2: Snowflake (the hard one)

> Detailed bite-sized tasks for this phase are written **after Phase 3** lands, because the exact rule edits depend on the harness output. The method is identical to Task 3.2 (corpus → fail → manual+sqlglot → grammar edit → green → commit). What differs is volume and these known-hard areas, each of which gets its own corpus seed + task cluster:

- **Lexer modes** (this forces real work in `SnowflakeLexer.g4`): dollar-quoted strings `$$ … $$`, and **embedded UDF bodies** (JS/Python/Java/Scala inside `CREATE FUNCTION … AS`). Decide per body: opaque blob vs sub-mode. Default to opaque blob unless a corpus case needs structure.
- **Semi-structured access:** `col:path.to.field`, `col['key']`, `arr[0]`, `FLATTEN`/`LATERAL FLATTEN`, `OBJECT_CONSTRUCT`, VARIANT/OBJECT/ARRAY types, `::` casts everywhere.
- **The DDL jungle:** `CREATE TABLE` with its large option grammar, plus `STAGE`/`PIPE`/`STREAM`/`TASK`/`FILE FORMAT`/masking & row-access policies, `COPY INTO`, `MERGE`, time travel (`AT`/`BEFORE`), `QUALIFY`, `MATCH_RECOGNIZE`.
- **Reserved vs non-reserved keywords:** see the dedicated strategy below — Snowflake lets most keywords be identifiers.

Seed the corpus from sqlglot's snowflake fixtures + dbt's `SnowflakeLexer.tokens` vocabulary checklist + grammars-v4 `sql/snowflake` as a structural reference.

**Phase 4 done when:** Snowflake `we-reject-they-accept` ≤ threshold on the corpus, including at least one embedded-UDF and one semi-structured-access case.

---

## Phase 5 — Dialect #3: BigQuery

> Bite-sized tasks written after Phase 4. Method identical. Known-hard areas:

- `STRUCT<…>` / `ARRAY<…>` typed literals, `UNNEST`, `SELECT * EXCEPT(…) REPLACE(…)`, backtick-quoted multipart names, `SAFE.` / `SAFE_CAST`, parameterized types, `FOR SYSTEM_TIME AS OF`, scripting (`DECLARE`/`SET`/`BEGIN…END`).
- **Ground truth:** read Google's **ZetaSQL** Bison grammar as the authoritative spec for ambiguous cases (do not port it).

**Phase 5 done when:** BigQuery `we-reject-they-accept` ≤ threshold on the corpus.

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
