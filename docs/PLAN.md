# TS SQL Dialect Parser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build **TypeScript SQL parsers we can consume in our own projects**, generated from open, split ANTLR4 grammars, each validated against a known-good corpus it must parse with zero errors. The parser is the deliverable; the `.g4` grammar is the means (and a by-product we contribute back upstream when we improve it). Every shipped dialect is **fork-and-clean** — Databricks (apache/spark), T-SQL and Snowflake (grammars-v4), BigQuery and Redshift and PostgreSQL (bytebase/parser), DuckDB (this repo's own postgres pair), Trino (the first-party trinodb SqlBase.g4, mechanically split) — the original "hand-author" track died when every assumed-missing grammar turned out to exist.

**Architecture:** ANTLR4 split grammars (`lexer grammar` + `parser grammar`), **one standalone pair per dialect — no shared "core" grammar, no inheritance** (ANTLR `import` doesn't compose; "core SQL" is a concept, not an artifact). Each dialect is forked from its best starting point: **Databricks** ← apache/spark's `SqlBase*.g4` (forked + renamed, embedded Java ported to TS), **T-SQL** ← grammars-v4 `sql/tsql`, **Snowflake** ← grammars-v4 `sql/snowflake`, **BigQuery** ← `bytebase/parser` `googlesql/` (BSD-3), **Redshift** ← Bytebase's Postgres-derived Redshift grammar (BSD-3) — all forked, none hand-authored. The ANTLR TypeScript target + antlr4ng runtime generate the parsers. A conformance harness parses a per-dialect **known-good corpus** and requires **zero syntax errors**. The parse layer is syntax-only, but Databricks has a **semantic layer** (scope → qualify, plus expression IR) built on the parse tree — see Scope and Phase 1.5.

> **Updated 2026-06-06:** (1) **No shared "core" grammar** — each dialect is a standalone fork (see Architecture); Phase 1 is now the Databricks fork, not a core build. (2) Dialect order: Databricks → T-SQL → Redshift → Snowflake → BigQuery. (3) Validation gate is a **known-good corpus that must parse with zero errors**. Phases 3–5 below still hold the original Redshift-first detail and are **pending a clean re-sequence** — the per-dialect *method* (corpus → fail → manual → grammar edit → green → commit) is unchanged. See CLAUDE.md for rationale.

**Tech Stack:** ANTLR4 (grammars), antlr4ng (TS runtime) + antlr-ng or the ANTLR jar (generator), TypeScript, vitest, Node 20+. No Python in the loop.

---

## Scope

**In:** lexer + parser grammars that recognize each dialect's surface (queries, DML, the common DDL); generated TS parsers; a public `parse(sql, dialect)` returning a parse tree (or a syntax error); a conformance harness.

**Dialect coverage (added 2026-07-02, from last-month PyPI downloads of the dbt adapter packages).** The dialect roster is driven by what dbt users actually run. Downloads/mo: dbt-snowflake 8.87M, dbt-databricks 8.00M, dbt-postgres 6.07M, dbt-spark 5.77M (inflated — dbt-databricks depends on it), dbt-bigquery 5.42M, dbt-redshift 3.23M, dbt-fabric 2.40M (tsql; dbt-synapse depends on it), dbt-clickhouse 1.94M, dbt-exasol 1.90M (bot/CI anomaly — far too niche for that rank), dbt-duckdb 1.68M, dbt-athena(+community) 1.98M (trino-family), dbt-trino 0.61M, dbt-glue 0.30M (databricks), dbt-sqlserver/synapse 0.20M (tsql), others <0.15M each. The first five dialects covered ~70% of ~48M/mo; **postgres and duckdb (added 2026-07-02, dialects six and seven) push coverage to ~85–90%** — postgres forks `bytebase/parser postgresql/` (the same repo/commit as the BigQuery and Redshift forks; our Redshift grammar is itself a fork of it), and duckdb forks our postgres pair (DuckDB has no open ANTLR grammar; its own parser is a Postgres derivative, so the lineage mirrors reality). **Trino shipped 2026-07-02 as dialect eight** — one dialect covers dbt-trino AND dbt-athena (Athena engine v3 routes queries/DML to Trino; the Hive side is object DDL, out of scope). The build requirement (verify any fork against the first-party `SqlBase.g4`) was executed maximally: the rule-by-rule diff showed the Bytebase port lagging official 482 by 22 productions + 67 drifted rules, so the grammar base is the OFFICIAL trinodb `SqlBase.g4` itself, mechanically split — upstream parity by construction; on new Trino releases, diff upstream and re-split. Coverage now ~90% of adapter downloads; nothing sizable remains uncovered. **ClickHouse — assessed 2026-07-03, parked by decision (Niclas).** The largest remaining gap on paper (1.94M/mo), but its downloads are part-botted: the healthy adapters all show a 44–47% weekend download dip (pypistats, 6mo, without-mirrors — the human/CI-on-commits signature); dbt-clickhouse dips only 27%, which decomposes to roughly 40% scheduled machine traffic — real demand ~1.1–1.2M/mo, below dbt-duckdb and the athena family, ~2.5% coverage for a full dialect wave. Not built. If it's ever wanted, the research is done: fork base is grammars-v4 `sql/clickhouse` (split pair, ZERO embedded target code — generates as TS with no porting, the Snowflake profile; actively maintained, and in sync with ClickHouse's own abandoned `utils/antlr` copy), covering the signature query surface (PREWHERE, SAMPLE, ARRAY JOIN, LIMIT BY, SETTINGS, FORMAT, WITH TOTALS, GLOBAL IN, ASOF/SEMI/ANTI joins, parametric aggregates `quantile(0.5)(x)`, lambdas, `t.1` tuple access) but light (1,394 lines — needs a Snowflake-style cleanup wave: `* APPLY/EXCEPT/REPLACE` transformers, WITH FILL/INTERPOLATE, a known BETWEEN-precedence bug); conformance corpus is ClickHouse's own test suite (`tests/queries/0_stateless/`, Apache-2.0, thousands of `.sql` files — ZetaSQL-grade, licensing-clean); `lower.ts` would be new (its own CST shape, sized like BigQuery's). dbt-exasol's 1.90M is ~85–90% machine traffic by the same measure (6% weekend dip) — ignore it. Caveats on the metric: downloads measure CI reinstalls more than humans, and dbt-postgres is structurally inflated (default dev/test adapter, bundled with dbt-core until 1.8).

**Out — actually cleared by Nicke:** SQL transpilation ("i dont care at all about the transpile"); and **object DDL** — CREATE/ALTER/DROP-style object management (UC CREATE CATALOG/VOLUME/EXTERNAL LOCATION/SHARE/CONNECTION, column MASK/ROW FILTER, CLUSTER BY AUTO, `LANGUAGE PYTHON $$…$$` bodies; "what we don't do is regular DDL", Nicke 2026-06-10 — refining the earlier same-day clearance). CTAS/CREATE VIEW stay in (they carry queries), and DDL the Spark fork already parses stays as-is. A query engine is out by definition (this is a parser, not an execution engine).

**Open — likely future scope (NOT Out):** the **operational non-SELECT statements** a data engineer runs outside dbt (Nicke 2026-06-10: "that type of non-select statements might become in scope … we do it occasionally"): COPY INTO, the Delta maintenance commands (OPTIMIZE/VACUUM/RESTORE/REORG/FSCK, SHALLOW CLONE, a real DESCRIBE HISTORY), GRANT/SHOW GRANTS, and modelling depth for UPDATE/DELETE/MERGE (they parse today but lower as flagged non-query). All are pinned at their current level in `tests/databricks.doc-coverage.test.ts` — flip an entry's flag in the change that builds it. **NOT cleared — open, do NOT treat as Out** (a prior edit wrongly stamped these "Nicke-cleared"; corrected 2026-06-06): **type inference** and **column lineage** (lineage was only noted "revisit later", rides on qualify). **Amended 2026-06-06:** name resolution (**scope**) and column/`*` resolution against a supplied schema (**qualify**) are **in scope for Databricks** as a semantic layer on the parse tree (Phase 1.5) — the consumers (editor support, the SQL debugger) need them. The warehouse dialects get the grammar only until a second consumer forces the abstraction.

## Open Gaps (tracked, NOT descoped)

These are real, unfinished parts of the job. They stay here, answering "what's left," until built or until Nicke explicitly moves one to *Out*. They are **not** scope boundaries — never treat them as "v1 doesn't do X."

- **Doc-coverage pass — DONE 2026-06-10.** Measured both dialects against the official references (~250 probes + registry-vs-catalog diffs), then fixed what it found: `parseTSql` now EOF-anchored (it silently truncated valid-SELECT-prefix input); Databricks inline-table bodies (`VALUES`, `INSERT … VALUES`, `TABLE t`) lower instead of throwing; `parseDatabricks` enters at `compoundOrSingleStatement` (SQL-scripting compounds parse, flagged as one unsupported body) and accepts the `t@v123` time-travel shorthand; the T-SQL grammar gained IS [NOT] DISTINCT FROM, the 2022 WINDOW clause + `OVER w` (lower resolves named windows, chained, cycle-guarded), FOR SYSTEM_TIME, TABLESAMPLE, the documented FREETEXT shape, and OPENQUERY in FROM; both registries extended with doc-fetched return types (Spark ~520 entries incl. H3/ST/AI/IP/VARIANT/TIME families, T-SQL ~210 incl. the 2022/2025 additions; phantom `regexp_split` removed). The probe battery is pinned as `tests/{databricks,tsql}.doc-coverage.test.ts`. **Still open from the pass:** T-SQL grammar — BULK INSERT, temporal-table DDL (`PERIOD FOR SYSTEM_TIME`), GRANT permission lists / DENY / REVOKE, ODBC `{fn …}` escapes (upstream grammars-v4 gaps; contribute-back candidates); registry — functions whose documented return type is argument-value-dependent (`ai_query`, `from_avro`, `extract`, sql_variant property functions) or whose pages state no type (the ST measure/coordinate accessors, `h3_distance` family) stay `unknown` by contract.
- **Expression modelling — BUILT 2026-06-06; corpus-complete.** `lowerExpression` produces a typed `Expr` tree for every expression: column, literal, star, binary, unary, function (aggregate + window/`OVER`), `CASE`, cast, scalar subquery, `EXISTS`, **predicate** (`IS [NOT] NULL`, `[NOT] IN`, `BETWEEN`, `LIKE`/`RLIKE`, `IS [NOT] DISTINCT FROM`), **lambda** (`x -> …`), **subscript** (`a[i]`), and the `date_add`/`datediff`/`CURRENT_*` special-form functions. **Every expression node in all 1558 models lowers to a typed node — 0 `other` — enforced by `tests/corpus/databricks.oatly.test.ts`** (which fails with the exact CST type if anything leaks). The `other` fallback stays in the IR as a safety net for constructs the corpus doesn't use (e.g. `a:b` colon paths), so nothing is ever dropped. `SelectExpr.columns` is derived from the `Expr` trees (projections, WHERE, JOIN `ON`, GROUP BY, HAVING, ORDER BY); a **CST↔IR conservation gate** (in the same one-pass `tests/corpus/databricks.oatly.test.ts`, plus unit cases in `tests/conservation.test.ts`) runs over all 1558 models and fails if the IR drops any clause the parse tree contains. GROUP BY captures **every** grouping key, including each one inside ROLLUP/CUBE/GROUPING SETS. `aggregate` is decided by a comprehensive Spark/Databricks aggregate-name set (the standard approach — there is no signature catalog at parse time).
- **Join nodes in the IR — SPEC (Anvil P1, built 2026-07-03).** `SelectExpr` gains an additive `joins?: Join[]` — the explicit `JOIN` operations of the FROM clause, in source order (left-to-right, as written), each a first-class node with a full-construct span. Built for the dbt Anvil extension (its formatter answers structural questions by span containment — "is this `ON` token inside a Join?" — and its SQL debugger slices the query text at join boundaries into progressive stage snapshots). **Purely additive:** `from: Source[]` and `joinConditions?: Expr[]` stay populated exactly as before (byte-identical IR for every existing consumer — scope/qualify/lineage/symbols are NOT migrated in this task; they keep reading `from` + `joinConditions`). Shape (`src/ir/ir.ts`):
  ```ts
  export type JoinKind =
  	| "inner" | "left" | "right" | "full"   // ANSI qualified joins
  	| "cross"                                // CROSS JOIN (comma-separated sources are NOT joins — they stay plain from entries)
  	| "semi" | "anti"                        // Spark/Databricks LEFT SEMI/ANTI; DuckDB SEMI/ANTI
  	| "asof" | "positional"                  // Snowflake/DuckDB ASOF; DuckDB POSITIONAL
  	| "natural" | "lateral";                 // a bare NATURAL / LATERAL join carrying no ANSI type
  export interface Join {
  	kind: JoinKind;              // the join category; NATURAL/LATERAL ride as flags (below) when an ANSI type is also present
  	source: Source;              // the right-side source — REFERENCE-IDENTICAL to the matching SelectExpr.from entry (scope keys line up)
  	on?: Expr;                   // ON predicate — REFERENCE-EQUAL to the matching joinConditions entry (not a copy)
  	using?: string[];            // USING (col, …) — mutually exclusive with on
  	natural?: boolean;           // NATURAL modifier (kind carries the ANSI type: NATURAL LEFT → kind "left", natural true)
  	lateral?: boolean;           // LATERAL modifier (right source is correlated)
  	cst: ParserRuleContext;      // spans the full `[type] JOIN … [ON …|USING …]` construct
  }
  ```
  **Invariants (frozen):** additive only; `join.source ===` the `from` entry (same object); `join.on ===` its `joinConditions` entry (same object — so the `other`-ratchet walker sees each ON expr once via `joinConditions`; joins carry no unique exprs, so `ir-walk` deliberately does NOT re-walk them, and the conservation gates are unchanged); joins in source order; `cst` spans the whole join construct. Single-table / no-explicit-JOIN selects → `joins` is **undefined** (absent, not `[]`), matching the `x.length ? x : undefined` convention the other optional IR arrays use. Comma-separated FROM sources are NOT joins — they stay plain `from` entries (the grammar distinguishes them from join extensions). `freezeIR` needs no change (the new `joins` array + plain Join objects deep-freeze generically; each `cst` is a foreign `ParserRuleContext`, skipped like every other cst back-ref). Where a dialect's surface didn't fit the ANSI set, JoinKind was **extended additively** (`semi`/`anti`/`asof`/`positional`) rather than mislabeled. Per-dialect notes:
  - **Databricks** — INNER/LEFT/RIGHT/FULL, CROSS, LEFT SEMI → `semi`, LEFT ANTI → `anti`, NATURAL (flag), LATERAL (flag); ON / USING.
  - **T-SQL** — INNER/LEFT/RIGHT/FULL, CROSS; ON only (the grammar has no USING join). **APPLY is NOT a join** — `CROSS/OUTER APPLY` has no ON and never flowed through `joinConditions`; it stays a plain `from` source (unchanged) and produces no Join node.
  - **Snowflake** — INNER/LEFT/RIGHT/FULL, CROSS, NATURAL (flag), ASOF; ON / USING. ASOF's `MATCH_CONDITION (expr)` stays conserved in `joinConditions` (as today) and is not separately linked onto the Join.
  - **BigQuery** — INNER/LEFT/RIGHT/FULL, CROSS, NATURAL (flag); ON / USING.
  - **Redshift / PostgreSQL** — INNER/LEFT/RIGHT/FULL, CROSS, NATURAL (flag); ON / USING. Redshift `(+)` outer-join markers live inside the ON expr and are untouched.
  - **DuckDB** — INNER/LEFT/RIGHT/FULL, SEMI, ANTI, CROSS, NATURAL (flag), POSITIONAL, ASOF; ON / USING (POSITIONAL has neither).
  - **Trino** — INNER/LEFT/RIGHT/FULL, CROSS, NATURAL (flag); ON / USING.
  Nested/parenthesized join groups and the left side of a join contribute their sources to `from` and their ONs to `joinConditions` exactly as before; the `joins` array captures the top-level FROM join chain (the debugger's cumulative slice target). Gated by `tests/ir.join.test.ts` (per-dialect: a 3-join chain with ordered full-construct spans, USING where supported, kind coverage, ON reference-equal to the `joinConditions` entry, single-table → `joins` undefined) and proven additive by a corpus-wide IR hash-diff (hashing with `joins` stripped is byte-identical to the pre-P1 baseline `8ba9e2a`).
- **Per-part spans on column references — SPEC (Anvil P2, built 2026-07-03).** The `column` Expr / `ColumnRef` (and the column `Sym`) gain an additive `partSpans?: PartSpan[]` — parallel to `parts`, same length whenever present, each span the absolute character range (`start`/`end` exclusive, `line` 1-based / `column` 0-based per the SyntaxDiagnostic convention) of that part's own token(s) INCLUDING quoting delimiters, EXCLUDING dots. All-or-nothing per ref: if any part lacks a real source token (synthesized parts, subscript-chain intermediates), the whole field is omitted — present always means aligned. Capture funnels through `src/ir/part-span.ts` (`partSpanOf`/`partSpansOf`) plus one small collection helper per dialect, all comment-flagged for reuse by the editor-gold identifier-folding rewrite. Consumer: the dbt Anvil extension's per-part cursor hit-testing (qualifier vs column actions). `PartSpan`/`ColumnRef` exported from the barrel.
- **`t.*` qualified-star expansion — FIXED 2026-06-06.** The star Expr captures its qualifier; qualify's `expandStar` expands only the named source (its last name part), not every source.
- **Struct/field dot-access — FIXED 2026-06-06.** `resolveColumn`/`qualify` no longer assume `parts[-2]` is the qualifier. `splitColumnRef` splits a dotted ref into qualifier / column / field-path against the visible sources (a leading part is a qualifier only if it names a source, else it's the column and the rest is field navigation — Spark's resolution order). `t.addr.city` binds to `t` with column `addr`, fields `[city]`; unqualified `addr.city` binds to the column `addr`. Corpus schema-free `unresolved` dropped 44→33. **Struct field-existence validation — BUILT 2026-06-06.** `parseStructFields` (schema.ts) parses `struct<…>` type strings, nesting-aware; qualify's `checkFieldPath` walks the field path against the base column's struct type and emits an `unknown-field` diagnostic when a known struct lacks the field (`t.addr.city` → checks `city` in `addr`'s struct; nested `a.b.c` walks down). **Types propagate through derived columns:** qualify threads column types bottom-up (`resolved` carries `Column[]` with types), so a struct column threaded through a CTE, subquery, aliased CTE (`WITH c (a) AS …`), or union (left branch) is validated too — not only base-table columns. A non-struct, array/map, or unknown type stops the walk without flagging. **Genuine boundary — separate features, not this one:** a *computed* derived column (e.g. `upper(x) AS c`) has no type without the **type-inference engine** (open), so field access on it isn't checked; and array/map element access (`m['k'].f`, `arr[0].f`) needs subscript modelling in the IR (the subscript lowers to `other`, dropping the field path). Subscript/colon forms (`col['k']`, `arr[0]`, variant `v:a.b`) recover only the base column — no mis-binding.
- **Outer-scope walk — FIXED 2026-06-06** in the shared resolver (`src/sema/resolve.ts`): column resolution is **local-first** — a column binds to a local source (even one with unknown columns) before it can correlate to an enclosing source by name coincidence. (scope.ts's schema-free `resolveColumn` is unchanged; this is the schema-aware resolver inference + lineage share.)
- **Correctness is self-graded** — no curated conformance set with expected outputs/bindings yet; the corpus only proves "no throw" + stats our own code computes.
- **`unsupported` is only set for non-query statements** (DDL/DML with no SELECT — there is no query scope to analyze, which is correct). Recursive CTEs lower as ordinary CTEs (the self-reference resolves to the CTE); a table-valued function in FROM (`range(…)`, `explode(…)`) is approximated as an opaque table source (its columns are unknown without the function's signature). Neither is flagged.
- **Symbol model — `src/symbols/`.** A SQL-native symbol model derived from the scope tree: `Sym { kind, modifiers, name, span, frame, definition? }`, a **kind × modifier** taxonomy. Kinds are the actual named relational entities — `table/cte/subquery/lateral` (relations), `column`, `alias`, `function`. (Token-level concerns — literals, keyword highlighting — belong to a separate SemanticTokens projection, not the symbol graph; `view`/parameters would need a catalog / param modelling we don't have, so they aren't kinds.) Modifiers: declaration/reference/output/aggregate/window/correlated/star. Emitted: relation references + CTE declarations; **alias** declarations (`t AS x`, precise span via the IR's `aliasCst`); column references, alias/computed output declarations, `*`; **function** symbols with aggregate/window; `correlated` via `resolveColumn`. **Definition→reference link:** a reference carries `definition` — a CTE ref → its `WITH` declaration; a column ref → the projection in the CTE/subquery that produces it (catalog table columns have none, correctly). `deriveSymbols` runs over all 1558 models with 0 throws.
  Column and function symbols carry their inferred **`type`** when `deriveSymbols(tree, schema)` is given a schema. How a *consumer* renders symbols (LSP `DocumentSymbol`/`SemanticTokens`, the debugger's `@dbg` frames) is the consumer's concern, not this library's. Minor: scalar/IN/EXISTS subqueries use a generic `_sub_` frame label; ORDER BY expressions aren't walked for function symbols.
- **Type inference — `src/infer/`.** A `Type` ADT (scalar/array/map/struct/unknown) + `parseType`; `inferType` is a bottom-up pass over the IR after scope/qualify. Types: literals (by form), casts (target type), columns (schema for base tables; recursing into the producing projection for derived/computed columns, cycle-guarded for recursive CTEs), struct field access, predicates/exists (boolean), operators (numeric-widening coercion via `coerce.ts`; comparisons/logical → boolean; `||` → string; date±interval), function calls (a return-type registry built from the **Databricks/Spark built-in function reference** — ~230 functions by family, NOT the corpus, which is only a validation gate), CASE (common branch type), subscript (array element / map value), **scalar subqueries** (their output column), **higher-order functions** (transform/zip_with/aggregate/reduce/transform_keys/values — bind the lambda params, type the body), and **constructors** (`map`/`struct`/`named_struct`/`from_json`). **Wired into both consumers:** qualify validates struct-field access on *computed* columns through `inferType`; symbols carry column/function `type`. Unknown only when genuinely undeterminable — no schema, or a function with no rule. That is the inherent limit, not a deferral.
- **Lineage — `src/lineage/`.** `lineage(tree, schema)` → for each output column, the **base-table columns it derives from**, traced through CTEs / subqueries / set operations (unions union both branches; `*` expands; higher-order functions need no special case — an output derives from all a function's arguments). Recursive CTEs are cycle-guarded. Rides the same shared resolver (`src/sema/resolve.ts`) as inference; needs no function/coercion catalogs (the payload is a set of origins, not a type). `originsOf(expr, scope, schema)` exposes a single expression's origins; **wired into symbols** as the column `origins` (base-table provenance). Runs over all 1558 models with 0 throws. Inherent limit: a lateral/TVF column has no base-table origin; without a schema, `*` can't be expanded (so star outputs over a bare table aren't enumerated).
- **Living-document editor front end — BUILT (closes the foundational gap).** The lexer/parser front end is no longer batch-shaped — it works on incomplete, changing, usually-invalid (mid-keystroke) input. (a) **Token stream as a first-class artifact:** `parse(sql, dialect)` returns `tokens: Token[]` (every token + exact span + role + channel) and a standalone `tokenize(sql, dialect)` exists (`src/token/{token,classify,map,tokenize}.ts`; roles via a shared classifier + per-dialect override tables). (b) **`lower()` is total** — never throws on broken/partial input (the two Databricks throws removed, the Redshift freeze gap fixed; broken text yields a flagged `query` IR); statement-level error containment verified (one broken statement doesn't truncate the token stream or smear diagnostics). (c) **`SqlDocument` (`src/document/document.ts`)** — the persistent, immutable, position-addressable per-file model that composes parse→resolveScopes (lazy schema `analyze`), caches it, holds tokens/cst/ast/scopes/diagnostics/lines (a new `LineIndex` for O(log n) position↔offset) + `tokenAt`/`nodeAt` (`node-at` moved here from `src/lsp/`). (d) **Three interactive editor features that live in the broken-input world:** semantic tokens (`src/lsp/features/semantic-tokens.ts`, from `doc.tokens`); completion (own ATN candidate walk reimplementing antlr4-c3's algorithm with NO dependency — `src/completion/`; all eight dialects); signature help (curated per-dialect signature table over a harvested doc-derived long tail — `src/signature/`). The LSP holds one `SqlDocument` per open file and consumes only the public surface (`src/api.ts`/`src/index.ts`). **Remaining limits (tracked, not the foundation):** incremental re-parse is deferred (perf, not correctness) — the document model rebuilds fully on edit; ANTLR isn't incremental and SQL statements are small, so full re-parse per keystroke is acceptable for now. Signature-help curated tables are bounded (~20–40 functions/dialect); the long tail degrades to name + active-argument (by design, Niclas-approved) — signatures are doc-cited, the high-risk arg-order subset doc-verified, the full set authored from established knowledge (re-verify against live docs as a follow-on if desired). `signatureAt` is a pure token scan, so `WITH cte (col, …)` yields a name-only hint (a CTE column list can't be told from a call without parser context) — inherent, low impact. Completion edges: BigQuery's dot-path token rewrite is skipped in the completion parser factory (not needed for the ATN walk) and backtick-quoted relation names aren't in the mid-edit FROM/JOIN fallback set; at the FROM relation slot the walk over-offers (columns/functions alongside tables — editors prefix-filter); a caret immediately inside an identifier token (no trailing space) returns no columns until a space is typed. `src/completion/parser-factory.ts` now enters the ATN walk at the batch-level `multiStatement` for Databricks (issue #1 parity, closed) — completion inside a later statement of a `;`-separated batch resolves through the real scope, not just the token-stream fallback. Param metadata would also enrich completion + feed argument-type checking later (ties to the open type-inference scope).
- **LSP Wave-1 read/navigation/intelligence surface — BUILT.** The LSP now serves diagnostics (push + pull), hover, go-to-definition, references + documentHighlight, document symbols, code lens (reference counts), folding, selection, inlay hints (output-column types), semantic tokens (full + range + delta), completion + completion-resolve, and signature help — each a thin adapter over the public surface, the seam clean (acceptance suite at 36 tests). The new core primitive is `src/references/references.ts` (`referencesAt(scopes, offset, schema?, ast?) → Occurrences`), exported on the public surface. Building Wave-1 surfaced the drivers below: where a feature hits a wall, the wall is a tracked gap that drives the next parser/analysis work — this is the input to the next phase, recorded honestly rather than papered over.

  **LSP-surfaced drivers (what the editor surface needs that the library doesn't yet give it):**
  - **Type-inference depth** — unregistered functions / UDFs and positional `struct(...)` infer `unknown` (now visible via inlayHint). Drives inference-registry expansion + anonymous-struct typing.
  - **Cross-file / view lineage** — references can't unify a column through a view or across files; there is no project model. Drives the dbt project / multi-file model.
  - **Symbol identity edges** — `SELECT *`-expanded columns have no ref node; schema-free correlated / set-op columns under-group (they group correctly once a schema is given); an output-column declaration resolves to the first matching projection, not the deepest origin (matters for rename). Drives lineage / identity work.
  - **Curated signatures bounded** — completion-resolve / signature-help carry only ~20–40 functions per dialect; the long tail has no signature detail. Drives a curated table or full-registry param data.
  - **Minors:** the codeLens command has no click-through wiring yet; `PipeExpr`/`PipeStage` aren't barrel-exported (folding uses a local cast); references' `originKey` should use a tuple key rather than a flattened string before rename ships.

  **Deferred next phase (explicitly deferred, NOT silently cut):** rename / prepareRename (in-document via the references engine; column-across-views needs the lineage work above); codeAction quick-fixes on diagnostics; struct-field hover / typeDefinition; the dbt project / multi-file model + `workspaceSymbol` — which also unlocks **call hierarchy** (the CTE / dbt-model dependency graph) and **go-to-implementation** (a name → its defining view/model query); a formatter (roll in dbt-anvil's); anvil diagnostics as an extra diagnostic source.
- **Expression-completeness (`other`-node) ratchet — all eight dialects at 0 (2026-07-02).** Each dialect's `tests/corpus/*.test.ts` pins the `other`-expression count over its docs/corpus and fails if it rises (riding the same single parse the parse-gate makes); Databricks stays gated at 0/1558 in `tests/corpus/databricks.oatly.test.ts`. (The former standalone `tests/ir-completeness.dialects.test.ts` was folded into the per-dialect corpus files and deleted.) The B/C/D closing wave drove the last three leakers to 0: **BigQuery 234→0** (braced/proto/struct constructors, `replace_fields`, and `WITH(x AS …, x)` forms lowered onto a new `with` Expr kind), **T-SQL 26→0** (XML data-type method calls + REGEXP_LIKE/quantified/MATCH/CONTAINS predicates), **Snowflake 10→0** (sequence `NEXTVAL` refs + CONNECT BY). Redshift/PostgreSQL/DuckDB/Trino were already at 0. Every dialect is now expression-corpus-complete over its `query/` bucket.
- **Statement-kind parity + corpus path-bucketing — DONE.** All eight dialects export `statementCategories` (per-statement kind detection over the parse tree); Redshift's classifies structurally by `stmt` rule name instead of a leading-keyword guess, and walks only the top-level `stmtmulti` children so a `CREATE FUNCTION … BEGIN ATOMIC …` body doesn't double-count. The seven non-BigQuery docs corpora (Databricks/T-SQL/Snowflake/Redshift/PostgreSQL/DuckDB/Trino) were reorganized into one legible `<dialect>/<source>/<stage>/<validity>/<category>/…` tree (`tools/organize-corpus.test.ts`, `ORGANIZE=1`), pre-sorted by `statementCategories` under the current parser; the gates trust the path instead of reclassifying at test time, so `tests/helpers/sql-kind.ts` (the old leading-keyword regex) and T-SQL's parse-everything classify mode are both deleted. Query-bucket populations, all 100% parse: Databricks 3,099, T-SQL 1,555, Snowflake 2,976, Redshift 1,808, PostgreSQL 379, DuckDB 1,037, Trino 635 — the growth over the pre-reorg counts is files the regex had misbucketed into dml/ddl and that were never gated.
- **BigQuery inference registry — 353 doc-cited entries.** Built out from a 184-entry starter to cover all 30 documented GoogleSQL function families; 353 is the adjudicated determinable ceiling under the project's never-wrong contract (value-dependent/TVF/AI-function returns stay `unknown` by design, not a gap to close). Dotted-family calls (`hll_count.*`, `kll_quantiles.*`, `net.*`, `aead.*`, `keys.*`) key by their full qualified path, and EXTRACT is part-aware. Breadth floor pinned in `tests/infer.registry.test.ts`.
- **Never-wrong follow-ups filed by review (2026-07-02, not yet built):** a BigQuery EXTRACT special form (like the existing date_add/CURRENT_* special forms) so `EXTRACT(DATE|TIME|DATETIME FROM …)` can resolve instead of staying `unknown`, plus qualified (not last-path-segment) keying for dotted calls so `hll_count.extract` can resolve INT64 independently of bare EXTRACT once the special form exists; and the pre-existing value-dependent pins that should themselves become special forms rather than fixed guesses — `avg: fixed(D)` (wrong for NUMERIC/INTERVAL inputs), `div: fixed(I)` (wrong for NUMERIC/BIGNUMERIC), `generate_array: arrayOf(I)` (wrong for NUMERIC/BIGNUMERIC/INTERVAL element types).
- **Public API surface — BUILT (issue #2).** `src/api.ts` is the uniform/layered/composable/immutable surface; `src/index.ts` re-exports it plus the per-dialect `parse*`/`lower` building blocks (all eight dialects) and the raw shared passes. `Dialect = "databricks" | "tsql" | "snowflake" | "bigquery" | "redshift" | "postgres" | "duckdb" | "trino"`; `parse(sql, dialect) → { ast, errors, cst }` (ast = the frozen IR, cst = raw-CST escape hatch); `analyze(sql, dialect, { schema? }) → { ast, errors, scopes, diagnostics, qualification, types, lineage, symbols }`. Each tier is a first-class terminal value. Composable: `qualify`/`lineage`/`deriveSymbols` accept the closest upstream `ScopeTree` (zero rework) OR a string/IR via the idempotent lift helpers `toAst`/`toScopes`. Typed wrappers keep raw collections out of the surface — `TypeInfo.typeOf(expr, scope)`, `Lineage.originsOf(column)` + `.all` (existing `Qualification.columnsOf` already complied). **Immutable IR:** every dialect's `lower()` deep-freezes the IR (`src/ir/freeze.ts`, skipping the foreign antlr `cst`/`aliasCst` back-refs); no pass mutates it — `tests/api.test.ts` feeds one `scopes` to qualify/lineage/deriveSymbols in both orders and asserts order-independence + an unchanged IR snapshot. **Dialect tag — FIXED (issue #7, closed).** The IR now carries its origin dialect: every dialect's `lower()` stamps `QueryExpr.dialect`. `resolveScopes(ir, dialect?)`/`toScopes` precedence is explicit param > IR tag > throw — the old silent `"databricks"` default (in `scope.ts`'s `newScope`) is gone, so a bare, untagged IR errors instead of silently mistyping. Passing `{ dialect }` explicitly still overrides the tag. Fell out of the fix: lineage's `subqueryOrigins` re-resolved nested IRs against the old hardcoded default — now threads `scope.dialect` through.
- **SLL→LL fallback surgery — DONE (five-dialect wave, 2026-07-03).** `tools/profile-sll.ts` (committed instrument — `<dialect>` or `all` for a full census, `--decision N` for an LL-exact-ambiguity drill-down into one ATN decision, `--bails` for a production bail-site census reading the two-stage wrapper's `RecognitionException`) measures how often each dialect's real parse wrapper falls back from the fast SLL prediction pass to the slower two-stage LL retry (`ParseResult.sllFallback`), over that dialect's docs query-bucket corpus. Five dialects came in sick (>15% fallback) and were cured with grammar-only edits — alternative reordering, subset-alternative deletion, and (duckdb only) a rule split — never a language change: every transform is proven either pairwise-disjoint-on-full-match or corpus-wide IR-hash-identical against the pre-surgery grammar.

  | dialect | before | after | note |
  |---|---|---|---|
  | redshift | 1004/1808 (55.5%) | **4/1808 (0.2%)** | sickest → healthiest |
  | duckdb | 361/1037 (34.8%) | **25/1037 (2.4%)** | knee is 2.4%, not 2% — see below |
  | postgres | 112/379 (29.6%) | **7/379 (1.85%)** | |
  | snowflake | 525/2976 (17.6%) | **115/2976 (3.9%)** | |
  | tsql | 259/1555 (16.7%) | **1/1555 (0.06%)** | |
  | databricks | — (already healthy) | 3/3099 (0.1%) | untouched |
  | bigquery | — (already healthy) | 63/4000 (1.6%) | untouched |

  Fallback ratchets (`FALLBACK_RATCHET`, monotonically lowered per iteration) now live in all five surgeried dialects' corpus gates (`tests/corpus/{snowflake,tsql,postgres,duckdb,redshift}.test.ts`); each dialect's parse wrapper (`src/<dialect>/parse.ts`) exposes `sllFallback: boolean` on its `ParseResult` — the field the tool reads instead of reimplementing the two-stage dance. **DuckDB's knee is 2.4%, not the 2% target:** the rejected first cure (reorder `func_expr` above `columnref`, landing at 21/1037) flipped the reading of *aliased* dotted method-chain calls (`sch.f(a) AS score` silently dropped the receiver, lowering as bare `f(a)`) — caught by code review, not by the unaliased probes written for it. The accepted fix (a `plain_func_expr`/`dotted_func_expr` split, proven corpus-IR-hash-identical over all 1037 files) keeps the correct method-chain reading at the cost of 4 extra residual files (21→25). Every dialect's remaining fallbacks are **correctness-bound residue**, not unfinished pruning — genuine grammar ambiguities or context-sensitivities where a further fix would change *which reading wins*: `x = ANY(array)` is both an array-comparison operator and a real `any(x)` function call (postgres, redshift); the `implicit_row` `(expr_list, a_expr)` vs `(a_expr)` paren-count carve (postgres, duckdb, redshift); BETWEEN's greedy-AND under SLL, where moving BETWEEN into the expression precedence ladder would widen what `expr` accepts (snowflake); the `double precision`/`CONVERT` two-word-typename overlap with `func_name` (postgres, redshift).
- **ZetaSQL parser-corpus rebuild/reconcile (BigQuery).** Task 6 of the B/C/D wave applied shared-extractor content fixes (a `DIRECTIVE_LINE` handler, a `cleanQuery` `\#`-escaped-comment drop) to the analyzer corpus; the parser corpus (`tests/corpus/bigquery.parser.test.ts`) is green but no longer byte-identical to a single extractor run. Goal: regenerate both corpora from one extractor pass so they stay in lockstep. There is claimed pre-existing drift (≈122 content / 26 validity) between the two, still unverified.
- **`SELECT FROM t` empty-select-list leniency.** Databricks, Redshift, PostgreSQL, and DuckDB parse a `SELECT` with an empty projection list (`SELECT FROM t`) clean — genuine precision leniency, not a documented feature. Tightening the grammar risks regressing the positive gates, so it needs its own pass.
- **Snowflake `CREATE MATERIALIZED VIEW … AS SELECT` lower inconsistency.** It lowers as `nonquery` while `CREATE VIEW` / CTAS / `CREATE TASK` lower as `query` (the inner SELECT isn't reached). Likely a lower gap, not a scope call — the inner query should be modelled like the sibling CREATE forms.
- **DuckDB grammar gaps — empty-bound slice + literal method-call.** Empty-bound step slices (`([1,2,3,4])[::2]`) and method calls on string literals (`'literal'.method()`) are noparse (explicit-bound `l[1:4:2]` and method calls on identifiers work). Both are duckdb.org-documented; tracked as grammar precision gaps.
- **Trino parity follow-ups.** Trino shipped mid-wave (dialect eight) and was not covered by the wave's negative-corpus / doc-coverage / signature enumerations. It needs its own `negative/unparsed/{mutated,curated}` two-sided gate, a `tests/trino.doc-coverage.test.ts` probe suite, and a harvested signature long tail — all at parity with the other seven.

## Repo layout (target)

```
grammars/<dialect>/ <Dialect>Lexer.g4, <Dialect>Parser.g4   (standalone fork of a grammars-v4 grammar, or hand-authored)
src/generated/      ANTLR output (gitignored, via `npm run gen`)
src/databricks/     parse.ts (parseDatabricks wrapper), ir.ts (IR types + lower CST->IR)  [Phase 1.5]
src/scope/          scope.ts (resolveScopes: schema-free name resolution over the IR)     [Phase 1.5]
src/qualify/        schema.ts (sqlglot-style schema input), qualify.ts (schema-fed)        [Phase 1.5]
src/api.ts          uniform/layered/composable/immutable public surface: Dialect, parse(sql,dialect), analyze(sql,dialect,{schema?}), lift helpers (toAst/toScopes), composable qualify/lineage/deriveSymbols, typed wrappers (TypeInfo/Lineage)
src/index.ts        public barrel: re-exports src/api.ts + the per-dialect parse*/lower building blocks (all eight) and the raw shared passes
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

> **Status (2026-06-06): name-resolution layer built, 59 tests green, typecheck clean.** Done test-first: `parseDatabricks`, IR + `lower` (SELECT, CTE, aliases incl. column-alias lists, joins, subqueries incl. scalar/correlated, set ops, PIVOT/UNPIVOT/LATERAL VIEW, structural projection naming, `ColumnRef` extraction, non-query stub); `resolveScopes` (sources, CTE resolution, output columns, `resolveColumn` with outer-scope walk); `qualify` + `Schema` (`*` expansion, unknown-table + column-level unknown/ambiguous-column diagnostics); `src/index.ts` public API. Corpus gate (`tests/corpus/databricks.oatly.test.ts`) runs `lower`+`resolveScopes`+`resolveColumn` over all 1558 Oatly models — **0 throws**; scoreboard: outputs known ~82%, column refs ~55% bound schema-free. **What is genuinely left is in [Open Gaps](#open-gaps-tracked-not-descoped) — chiefly expression modelling (unbuilt, ~half of SQL's meaning), plus `t.*`, struct access, tightening the outer-scope walk, and a curated conformance set. None of that is descoped; it is unfinished.**

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

**Files:** Test `tests/corpus/databricks.oatly.test.ts` (skipIf no local corpus)

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
- **Conformance corpus**: every SQL example from all 2,348 docs.snowflake.com sql-reference pages (`tools/scrape-snowflake-docs.mjs` → gitignored `harness/local/snowflake-docs/`, 6,259 files). Gates: grammars-v4's 51 examples at **100%**; the docs corpus as a **ratchet** (baseline in `tests/corpus/snowflake.test.ts`). Remaining shortfall is platform DDL (LISTING/APPLICATION/CORTEX …), standalone Snowflake Scripting blocks, and the statement-option long tail — raise the baseline as fixes land.
- **Pipeline**: `src/snowflake/parse.ts` + `lower.ts` onto the shared IR (QUALIFY, star modifiers, UNION BY NAME, FLATTEN→lateral, PIVOT/UNPIVOT, variant paths→subscript, VALUES→modelled selects, `$n` refs); the semantic layer runs unchanged (`snowflake.pipeline` suite). Inference knowledge in `src/infer/snowflake.ts` (~300 doc-sourced rules, NUMBER→decimal aliases, decimal division).

Open (tracked in `docs/snowflake-backlog.md`): the docs-corpus grammar long tail, embedded UDF bodies beyond `$$`-blob treatment, star-REPLACE type threading, `src/index.ts` export at packaging.

---

## Phase 5 — Dialect #4: BigQuery (GoogleSQL) — DONE 2026-06-13 (fork-and-clean, not hand-authored)

> **Superseded by the build.** The original framing (hand-author; "no open grammar exists") was wrong, the same miss as Snowflake: **`bytebase/parser` `googlesql/`** is a complete ANTLR4 port of GoogleSQL (BSD-3). BigQuery was **forked** from it — vendored at `grammars/bigquery/` — the only work to make it a TS parser was porting the Go-target embedded code (49 `NotifyErrorListeners` error actions + 7 `localctx`/`:=`/`GetStop()` predicate-and-declaration blocks) to the antlr4ng API. Entry rule `root` (`stmts EOF`).

What shipped (see CLAUDE.md Current status for the live detail):
- **Parse** — `src/bigquery/parse.ts` (two-stage SLL→LL). Generates + typechecks clean.
- **Lower** — `src/bigquery/lower.ts` maps the ZetaSQL query CST onto the shared IR: projections (incl. `SELECT * EXCEPT/REPLACE`, `t.*`), table/subquery/UNNEST-lateral sources, join chains + ON, WHERE/GROUP BY (incl. ALL + ROLLUP/CUBE/GROUPING SETS keys)/HAVING/QUALIFY, CTEs (incl. RECURSIVE), UNION/EXCEPT/INTERSECT, ORDER BY/LIMIT, and the left-recursive expression grammar (binary/unary/CASE/CAST/EXTRACT/function+OVER/IN/BETWEEN/LIKE/IS/subscript/STRUCT/ARRAY/lambda/scalar+ARRAY+EXISTS subqueries). Statement-kind is parse-derived. A valid parse never throws; unmodelled forms become `other`.
- **Inference** — `src/infer/bigquery.ts` (INT64/FLOAT64/NUMERIC/BOOL/BYTES/JSON aliases, typed-literal rules, INT64/INT64→FLOAT64 division, a 353-function GoogleSQL return registry — see Open Gaps).
- **Grammar build-out (2026-06-13)** — after the initial port, the grammar was extended to the full GoogleSQL/ZetaSQL surface (transcribed from `google/googlesql` `googlesql/parser/googlesql.tm`, the live Textmapper grammar; the old Bison `.y` is gone): **pipe syntax** (`|>`, all operators + FROM-queries + subpipelines), **graph/GQL** (`GRAPH_TABLE(…)`, the `GRAPH …` statement, patterns/quantifiers/path-modes/search-prefixes, CALL/YIELD/PER, `CREATE/DROP PROPERTY GRAPH`, graph subqueries, `IS SOURCE/DESTINATION/LABELED`), **chained calls**, **braced/proto/struct constructors**, **MATCH_RECOGNIZE** (quantifiers/anchors/AFTER MATCH SKIP/OPTIONS), **FOR UPDATE**, **LATERAL**, **MAP type**, sequences, `LIMIT ALL`, `SET GENERATED`, and **DOT_IDENTIFIER** (reserved keywords as post-dot path components). Several upstream port bugs were fixed (TVF paren, AT-TIME-ZONE keyword, `braced_constructor` `{`/`}`, `cube_list` first expr, USING comma-list, the `>>` token swallowing nested-generic closers). `lower` additionally maps FROM-queries and `TABLE name` to modelled selects; pipe transforms and graph patterns lower to first-class IR (`PipeExpr` / `GraphTableSource`), and the semantic layer flows columns through them.
- **Gate** — `tests/corpus/bigquery.analyzer.test.ts` against the **ZetaSQL `.test` golden corpus** (the extractor `tools/extract-googlesql-tests.mjs` is mode-aware — drops `type`-mode, wraps `expression`/`measure_expression` as `SELECT (…)` — and classifies each `{{…}}` alternation variant by its own ALTERNATION GROUP expected). The project's first **two-sided** conformance gate over the in-scope bucket: positives parse at **14,707/14,708**, syntax-error negatives rejected at **172/172** (0 accepted), the docs `other`-ratchet at **0**, plus a no-throw sweep proving `lower`+`resolveScopes` total over every parsed positive. The stricter parser-testdata gate (`tests/corpus/bigquery.parser.test.ts`) is 2,662/2,662 positives and 2,035/2,035 negatives.

**Open gap (not descoped):** 1 in-scope unparsed positive — `chained_function_call_special_cases_18`, a chained call plus braced UPDATE constructor whose clean fix routes chained calls through `function_call_expression_with_clauses`. Pipe transforms and graph patterns are now modelled in the IR (`PipeExpr` / `GraphTableSource`), and the `other`-ratchet is wired into the analyzer corpus gate.

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
- **Over-permissiveness check — now two-sided for seven of eight dialects (issue #5 closed).** Each of Databricks/T-SQL/Snowflake/Redshift/PostgreSQL/DuckDB carries a `negative/unparsed/{mutated,curated}` corpus (a 400-mutant rejection-rate ratchet, floors 315–334/400, plus 24 hand-authored doc-cited near-misses at 100%-reject), and BigQuery's ZetaSQL corpus was already two-sided. Trino's negative corpus is a tracked follow-up (Open Gaps). The manual is still truth; the mutants catch gross over-acceptance, not every semantically-invalid accept.
- **Parse tree (CST) vs AST:** ~~Decide in Phase 1...~~ **Resolved 2026-06-06:** consumers walk the CST directly for purely positional work (diagnostics, semantic tokens), but the **scope/qualify** semantic layer needs a normalized model, so Phase 1.5 adds a thin **IR** (`lower(tree)`) — built because semantics need it, not speculatively. The IR keeps CST back-refs so positions are never lost.
- **Corpus coverage ≠ correctness:** a green corpus means "parses these inputs," not "complete." Log corpus size and expand it as gaps surface; never claim a dialect is "done," only "passes corpus N."

## Success criteria

- Each shipped dialect: **zero syntax errors** on its committed known-good corpus, corpus ≥ an agreed minimum size, `npm run gen <dialect> && npm run harness -- --dialect=<dialect>` reproducibly green.
- The grammars are readable, manual-cross-referenced `.g4` files that generate working TypeScript parsers via `npm run gen`.
