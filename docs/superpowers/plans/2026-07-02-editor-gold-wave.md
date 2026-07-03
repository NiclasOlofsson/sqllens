# Editor-Gold Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the five gaps the 2026-07-02 parser survey found between us and best-in-class: dialect-true identifier folding (a live correctness bug — Snowflake folds the wrong direction, quoted-identifier case sensitivity is destroyed for five dialects), a statement-scoped incremental `SqlDocument` (also unlocks real semantics on multi-statement files, which today collapse to an empty `"compound"` IR), a lazy resolve-callback schema provider, nullability inference, and call-signature (arity/operand) diagnostics.

**Architecture:** One new shared fold module replaces six hand-copied normalizers; a token-level statement splitter + content-addressed cell cache turns `SqlDocument` into N independently parsed/analyzed statement cells (no `lower()` changes — each cell is a batch of one); `Schema` generalizes to a `SchemaSource` interface with a callback-backed implementation; nullability is a parallel inference walk (the `Type` ADT and `FnRule` signatures are untouched); signature diagnostics ride the existing curated + harvested signature tables. Everything additive on the public surface.

**Tech Stack:** TypeScript (tabs), vitest two tiers, tsgo, prettier. No grammar (.g4) changes anywhere in this wave — no `npm run gen` needed.

## Global Constraints

- **Sequencing (updated 2026-07-02): this wave queues behind BOTH the B/C/D closing wave AND the SLL grammar-surgery wave (`2026-07-02-sll-surgery-wave.md`) — Niclas prioritized the surgery wave first ("the benefit is just too great").** The original constraint stands too: it starts only after the B/C/D branch merges to master. It consumes that wave's outputs (the `qualifier` Expr field, harvested signature tables in `src/signature/generated/`, `declaredColumns` on Source) and would otherwise collide in `src/infer/`, the dialect `lower.ts` files, and the corpus-gate floors. Where this plan cites a line number, re-locate against post-merge master; where it cites a floor/count, use the then-current value.
- **Eight dialects.** Trino is on master (`Dialect` union, api.ts). Every per-dialect table in this plan has eight rows: databricks, tsql, snowflake, bigquery, redshift, postgres, duckdb, trino.
- **Never-wrong contract** extends to the new layers: nullability claims `notnull`/`nullable` only when provable, else `unknown`; a signature diagnostic fires only when no overload can accept the call; the fold rules are doc-cited to the vendor manual and live-verified at implementation time (each citation below is from recon and must be confirmed against the current page before the rule is encoded).
- **No gate weakened, ever.** All tier-2 corpus gates green before any merge to master. The LSP acceptance matrices (`tests/lsp.acceptance.test.ts`, `tests/lsp.acceptance.dialects.test.ts`) stay green in every task; they may only grow.
- **Public API is additive.** Existing signatures keep working: `new Schema(mapping)`, `analyze(sql, dialect, {schema})`, `SqlDocument.create/withText/analyze`, `parse()`. New capability arrives as new optional parameters, new exports, new fields.
- **A single-statement document must behave byte-for-byte as today** after the cell refactor (same ast/scopes/tokens/diagnostics identity semantics). Multi-statement documents get *better* (real per-statement semantics), never different-worse.
- `src/generated/` untouched. Tabs; `npm run format`; `npm run typecheck` clean. Commits end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Subagents on Opus or Sonnet 5, never Fable.
- **Pause points** for Niclas: after Task 3 (Stage A done), after Task 6 (Stage B done), after Task 8 (Stage C done), after Task 11 (Stage D done), after Task 13 (wave done).

---

## STAGE A — dialect-true identifier folding (correctness fix)

Recon (2026-07-02): the fold is hand-copied six times — `src/scope/scope.ts:644` (local), `src/sema/resolve.ts:202` (exported), `src/qualify/qualify.ts:377` (local), `src/qualify/schema.ts:110` (local), `src/infer/types.ts:147` (`unquote`), all with the same "Databricks identifiers are case-insensitive" comment — plus raw `.toLowerCase()` folds at `src/symbols/symbols.ts:217,299,302,305` and `src/completion/complete.ts:164` that don't strip quotes at all (so Databricks backtick-quoted names mis-compare there today). Every dialect's `lower.ts` strips its quote syntax (except Databricks, which deliberately defers) but none case-folds. Function names are a separate class — already lowercased in every `lower.ts` and correctly so (SQL function names are case-insensitive everywhere); leave that convention alone.

### Task 1: `src/ident/fold.ts` — the one fold, eight dialects

**Files:**
- Create: `src/ident/fold.ts`
- Test: `tests/ident.fold.test.ts` (tier 1)

**Interfaces (produced):**

```ts
export type IdentKind = "table" | "other"; // "other" = column/alias/CTE/field — only BigQuery differentiates

/** Unquote (dialect's delimiters, doubled-delimiter unescape) + case-fold per the dialect's
 *  documented identifier rules. The result is the IDENTITY KEY for name comparison — display
 *  text always comes from the raw source, never from this. */
export function foldIdentifier(raw: string, dialect: string | undefined, kind: IdentKind = "other"): string;
```

The rule table — **each row doc-cited in a comment; verify each citation against the live page before encoding** (the fold direction and the quoted-identifier rule are the load-bearing facts):

| dialect | unquoted | quoted | delimiters (unescape doubled) | citation to verify |
|---|---|---|---|---|
| databricks | → lower | → lower (backticks are not case-quoting) | `` ` `` | docs.databricks.com …/sql-ref-identifiers ("identifiers are case-insensitive") |
| tsql | → lower | → lower (default CI collation; comment the collation boundary) | `[ ]`, `" "` | learn.microsoft.com Database Identifiers + collation docs |
| snowflake | → **UPPER** | → **preserve** (case-sensitive) | `" "` (`""`→`"`) | docs.snowflake.com …/identifiers-syntax ("unquoted … stored and resolved as uppercase"; "quoted … case-sensitive") |
| bigquery | kind=table → **preserve**; other → lower | same (backticks are not case-quoting) | `` ` `` | cloud.google.com …/lexical#identifiers + case-sensitivity table |
| redshift | → lower | → **lower** (default `enable_case_sensitive_identifier` off folds even quoted) | `" "` (`""`→`"`) | docs.aws.amazon.com …/r_names.html |
| postgres | → lower | → **preserve** (case-sensitive) | `" "` (`""`→`"`) | postgresql.org/docs/18/sql-syntax-lexical.html §4.1.1 |
| duckdb | → lower | → **lower** (case-insensitive even quoted; case-preserving only for display) | `" "` (`""`→`"`) | duckdb.org/docs/current …/keywords_and_identifiers |
| trino | → lower | → **lower** (identifiers not treated as case-sensitive) | `" "` (`""`→`"`), `` ` `` tolerated | trino.io/docs/current language/identifiers |
| *(unknown/undefined)* | → lower | → lower, strip `` ` `` | `` ` `` | today's behavior — the safe default |

Why direction matters (not just consistency): with quoted identifiers in play, Snowflake unquoted `foo` must equal quoted `"FOO"` (both resolve to `FOO`) and must NOT equal quoted `"foo"`. A lowercase fold gets both wrong; only an UPPER-fold-unquoted + preserve-quoted rule reproduces the engine.

- [ ] **Step 1: failing tests.** One `describe` per dialect covering: unquoted mixed-case; quoted preserving (pg/snowflake) vs folding (redshift/duckdb/trino); doubled-delimiter unescape (`"a""b"` → `a"b`); T-SQL brackets; Snowflake `foo` ≡ `"FOO"` ≢ `"foo"`; Postgres `foo` ≡ `"foo"` ≢ `"Foo"`; BigQuery `kind:"table"` preserves while `kind:"other"` folds; undefined dialect = backtick-strip + lower. Run: `npx vitest run tests/ident.fold.test.ts` → FAIL (module missing).
- [ ] **Step 2: implement** `src/ident/fold.ts` — a per-dialect rule record `{ delimiters: [open, close][]; unquoted: "lower" | "upper"; quoted: "lower" | "upper" | "preserve"; tableCase?: "preserve" }`, one exported `foldIdentifier`. Each row's comment carries its manual citation (repo convention).
- [ ] **Step 3: green.** `npx vitest run tests/ident.fold.test.ts` → PASS. `npm run typecheck`.
- [ ] **Step 4: Commit** `feat(ident): dialect-true identifier folding — one fold module, eight doc-cited rule rows`

### Task 2: quotedness must survive lowering + replace the six copies and the raw folds

**Precondition discovered in recon §4 — this task touches every dialect's `lower.ts`:** seven dialects strip quote delimiters at extraction time (`stripQuotes`/`stripBackticks`/`idText` — tsql:1084, snowflake:1397, bigquery:1710, redshift:1448, postgres:1487, duckdb:1592, trino:1151; only Databricks defers). Stripped text can't tell quoted `"foo"` from unquoted `foo`, so the fold would mis-handle exactly the dialects it exists to fix. The fix follows the Databricks convention: **identifier extraction keeps the raw text, delimiters intact, in the IR**; unquoting/unescaping moves into `foldIdentifier` (identity) and one shared `displayName(raw, dialect)` helper (presentation — unquote only, no case change) for the few places that render names (symbols, completion labels, reference labels). This is the single largest collision surface with the B/C/D branch — it is why this wave is gated on that merge.

**Files:**
- Modify: all eight `src/<dialect>/lower.ts` identifier-extraction helpers (the recon list above — each becomes keep-raw; delete the local strip helpers), `src/ident/fold.ts` (add `displayName`), `src/scope/scope.ts` (local `normalizeName` + its 27 call sites — key ones: `sourceKey` ~:609, `lookupCte` ~:598, `splitColumnRef` ~:112, `resolveByColumnName` ~:196, star modifiers ~:564), `src/sema/resolve.ts:202` (the exported copy — deleted in favor of `foldIdentifier`), `src/qualify/qualify.ts:377`, `src/infer/types.ts:147` (`unquote` in `parseType`'s struct-field branch — gains a dialect param threaded from each dialect's `parseType` wrapper), `src/infer/infer.ts` (`eq` ~:338 and its `normalizeName` imports), `src/lineage/lineage.ts` (~:104-117, :141, :253, :258 — and `Origin` gains no dialect field; instead the fold happens where `ScopeTree`/`Scope` is in hand, before keys leave the scope), `src/references/references.ts` (:52 `originKey` and the other 8 sites — `scopes.root.dialect` is in hand), `src/symbols/symbols.ts:217,299,302,305` (raw `.toLowerCase()` → `foldIdentifier(x, tree.root.dialect)`), `src/completion/complete.ts:164` (dedup key → `foldIdentifier(label, doc.dialect)`)
- Test: `tests/ident.pipeline.test.ts` (new, tier 1)

**Interfaces:** every internal comparator becomes `foldIdentifier(name, dialect, kind?)`; names are compared folded, stored raw, rendered via `displayName`. The dialect comes from the `Scope`/`ScopeTree`/`SqlDocument` already in scope at each caller (recon confirmed reachability at every site except `Schema` — Task 3 — and `infer/types.ts` `parseType`, which gains an optional dialect argument supplied by each dialect's `parseType` wrapper in `src/infer/dialect.ts`).

- [ ] **Step 1: failing pipeline tests** — end-to-end through `analyze()`:
  - Snowflake: schema `{ ORDERS: { ID: "number" } }`, query `SELECT id FROM orders` resolves clean (unquoted→UPPER both sides); `SELECT "id" FROM orders` yields `unknown-column` (quoted lowercase ≠ ID); `SELECT "ID" FROM orders` resolves.
  - Postgres: schema `{ t: { "MyCol": "int", mycol: "int" } }`, `SELECT "MyCol" FROM t` and `SELECT mycol FROM t` resolve to the two *different* columns; hover/lineage don't conflate.
  - Databricks: backtick-quoted projection alias round-trips through `deriveSymbols` (the symbols.ts:217 echo check) and completion dedup — the recon's concrete disagreement case.
  - Redshift/DuckDB/Trino: quoted `"FOO"` ≡ unquoted `foo`.
  Run → FAIL against current behavior (the Snowflake and Postgres cases specifically).
- [ ] **Step 2: mechanical replacement.** Delete the six copies; import `foldIdentifier`; thread the dialect at each site per the recon map. `sourceKey`/`ingest`-class sites that key *tables* pass `kind: "table"`; alias/column/CTE/field sites pass default. Keep display strings raw everywhere (fold is compare-only).
- [ ] **Step 3: full green.** `npx vitest run tests/ident.fold.test.ts tests/ident.pipeline.test.ts` PASS; `npm test` green (existing suites that pinned lowercase-fold behavior for snowflake/pg get their expectations corrected — each such change called out in the commit body); `npm run test:corpus` green (the gates are schema-free parse/lower/scope totality — fold changes must not disturb them; if any corpus stat shifts, explain it in the commit or stop).
- [ ] **Step 4: Commit** `fix(scope,qualify,infer,lineage,references,symbols): dialect-true identifier identity — six folds become one`

### Task 3: dialect-aware `Schema` (and the fold's last blind spot)

**Files:**
- Modify: `src/qualify/schema.ts` (the class), `src/qualify/qualify.ts:44` (pass `tree.root.dialect` into lookups), `src/sema/resolve.ts` (`columnNamesOf` ~:62), `src/infer/infer.ts` (`sourceColumnType` ~:94), `src/completion/complete.ts` (:82, :148, :210), `src/api.ts` (docs only)
- Test: extend `tests/ident.pipeline.test.ts`

**Interfaces (produced):**

```ts
// schema.ts — raw mapping retained; per-dialect indexes built lazily and cached
export class Schema {
	constructor(mapping: SchemaMapping)                       // unchanged signature
	columnsFor(parts: string[], dialect?: string): Column[] | undefined  // dialect param NEW, optional
	tables(dialect?: string): string[]
}
```

Design: `ingest` stores the raw mapping; the first `columnsFor` under a given dialect builds that dialect's `byPath`/`byTable` maps with `foldIdentifier(seg, dialect, "table")` for path segments and `"other"` for column names, cached in a `Map<string, {byPath, byTable}>`. No dialect → the legacy fold row (today's behavior; existing single-dialect callers unaffected). One `Schema` instance can serve files of different dialects (the LSP reality: one workspace schema, `dialectFor(file)` varies).

- [ ] **Step 1: failing test** — one `Schema` instance, `{ Orders: { Id: "int" } }`: resolves `SELECT id FROM orders` under snowflake (both folded UPPER) *and* under postgres (both folded lower) from the same instance.
- [ ] **Step 2: implement** the lazy per-dialect index; thread `scope.dialect` into every `columnsFor`/`tables` call site (recon list above).
- [ ] **Step 3: green** — the new test, `npm test`, `npm run test:corpus` (the `tsql.adventureworks` suite is the strongest schema-fed check: 20 views, 0 unknown-columns — must stay 0), acceptance suites.
- [ ] **Step 4: Commit** `feat(schema): per-dialect lazy identifier indexes — one Schema serves mixed-dialect workspaces`

**PAUSE POINT — Stage A done.** The survey's one latent correctness bug is closed.

---

## STAGE B — statement-scoped incremental `SqlDocument`

Recon: no incrementality at any layer — LSP sync is `Full` (`src/lsp/server.ts:95`), `withText` re-creates from scratch (`src/document/document.ts:98`), every keystroke runs full `parse()` + `toScopes()` on the whole file; and a multi-statement file collapses to ONE flagged `"compound"` `QueryExpr` with an empty body, so scopes/hover/diagnostics are dead on it today. Precedent: Supabase's postgres-language-server splits the document into statements and re-parses only the edited one. Our per-cell parse needs **no `lower()` changes**: each cell re-enters the existing batch entry rule as a batch of one, hitting the proven single-statement path. While the user types, the edited statement is broken, so it takes the SLL-bail→LL-recover double parse — cell scoping confines that double parse (and all semantic recompute) to the one statement under the cursor.

### Task 4: the token-level statement splitter

**Files:**
- Create: `src/document/split.ts`
- Test: `tests/document.split.test.ts` (tier 1)

**Interfaces (produced):**

```ts
export interface StatementCellSpan {
	start: number;   // doc offset, inclusive — cell text includes leading trivia
	end: number;     // doc offset, exclusive — includes the trailing separator (`;` / GO line)
}
/** Total: never throws. Splits on top-level statement separators using tokenize(text, dialect)
 *  (string/comment-safe by construction — separators inside tokens can't split).
 *  Returns [whole-doc] when splitting is unsafe or pointless. */
export function splitStatements(text: string, dialect: Dialect): StatementCellSpan[];
```

Rules:
- Split at channel-0 `;` tokens at **compound depth 0**. Depth: `BEGIN` (except when the next channel-0 token is `TRAN`/`TRANSACTION`/`DISTRIBUTED` — T-SQL) and `CASE` increment; `END` decrements (floor 0). This keeps `;` inside Databricks/T-SQL `BEGIN…END` scripting bodies and inside `CASE…END` from splitting.
- T-SQL additionally splits at `GO` batch separators (an identifier token alone on its line — check neighboring token line numbers).
- **Safety invariant (the guard that bounds all damage):** the spans must tile the text exactly — `spans[0].start === 0`, `spans[i].end === spans[i+1].start`, last `end === text.length`. Assert it; on any violation return `[{start: 0, end: text.length}]` (single cell = exactly today's behavior).
- Trailing text after the last separator is its own cell; a doc with no separators is one cell.

- [ ] **Step 1: failing tests.** Cases: two `;`-separated selects (2 cells); `;` inside a string literal / a comment / a CASE / a Databricks BEGIN…END compound (no split); T-SQL `GO` on its own line (split) vs `GO` as a column alias mid-line (no split); `BEGIN TRAN … COMMIT;` (T-SQL — the `BEGIN` must not open a depth level, so the `;` splits); trailing statement without `;`; empty text (one empty cell); tiling invariant property-checked over every case.
- [ ] **Step 2: implement** over `tokenize(sql, dialect)` (`src/token/tokenize.ts` — already total). Keyword matching is case-insensitive on token text; only channel-0 tokens participate.
- [ ] **Step 3: green** + a fuzz-ish sweep: for every file in `tests/`' inline fixtures used by the acceptance harness, assert tiling holds. Commit `feat(document): token-level statement splitter — compound-aware, string-safe, tiling-guaranteed`

### Task 5: `SqlDocument` becomes statement cells with a content-addressed cache

**Files:**
- Modify: `src/document/document.ts` (the core of the wave), `src/api.ts` (re-exports)
- Test: `tests/document.cells.test.ts` (tier 1)

**Interfaces (produced):**

```ts
export interface StatementCell {
	readonly span: StatementCellSpan;          // doc offsets
	readonly text: string;                     // the cell's slice
	readonly category: StatementCategory;      // from the cell's own lower()
	readonly ast: QueryExpr;                   // per-statement IR — real, not compound-flagged
	readonly cst: ParserRuleContext;
	readonly scopes: ScopeTree;                // per-statement scope tree
	readonly tokens: readonly Token[];         // spans in DOC coordinates (shifted from cell-relative)
	readonly errors: number;
	readonly diagnostics: readonly SyntaxDiagnostic[]; // positions in DOC coordinates
}

export class SqlDocument {
	// everything existing stays, same semantics; NEW:
	readonly statements: readonly StatementCell[];
	cellAt(offset: number): StatementCell | undefined;   // binary search over spans
	withText(text: string, version: number): SqlDocument; // now reuses unchanged cells via the cache
}
```

Design points the implementer must honor:
- **Cell parse cache**: `Map<string, CachedCell>` keyed `dialect + " " + cellText`, carried privately from `withText` parent to child (the static `create` starts one fresh). Cached: cell-relative parse products. On (re)use, tokens/diagnostics are re-shifted to the new doc offsets — shifting is a cheap map; line/column shifting uses the cell's start line/col from the doc `LineIndex` (careful: diagnostics carry 1-based `line`, 0-based `column`; a diagnostic on the cell's first line offsets its column, later lines only their line — write this as one `shiftDiagnostic(d, baseLine, baseCol)` helper with its own unit test). Cache is bounded (keep last N=256 cells) — evict LRU.
- **Back-compat facade**: `doc.tokens` = concat of cell tokens (plus nothing else — the splitter tiles, so trivia lives in cells); `doc.diagnostics` = concat; `doc.errors` = sum. For a **single-cell** doc, `doc.ast`/`doc.cst`/`doc.scopes` are that cell's (identical to today). For a **multi-cell** doc, `doc.ast`/`doc.scopes` keep today's compound-flagged shape for compatibility (built once, cheap) — but consumers should use `statements`/`cellAt`; document this on the fields.
- `Object.freeze` discipline unchanged; cells are frozen too.
- `analyze(schema)` in this task: unchanged behavior (still whole-doc; per-cell analysis is Task 6) — keeps this task reviewable on parse/token/diagnostic identity alone.

- [ ] **Step 1: failing tests.** (a) single-statement doc: `tokens`/`ast`/`scopes`/`diagnostics` deep-equal a pre-refactor snapshot (write the expectations from current behavior BEFORE refactoring); (b) two-statement doc: `statements.length === 2`, each cell's `ast.statement` real (not `"compound"`), token spans in doc coordinates tile monotonically, a syntax error in statement 2 yields diagnostics positioned in statement 2's lines and statement 1's `errors === 0`; (c) **reuse**: `doc.withText` editing only statement 2 → statement 1's `CachedCell` is reference-identical (expose a test-only counter or compare `cst` identity); (d) reordering two statements → both cells cache-hit (content addressing).
- [ ] **Step 2: implement.** `splitStatements` → per-cell `parse(cellText, dialect)` via the existing `DIALECTS` table → per-cell `toScopes(ast, {dialect})` → shift → freeze.
- [ ] **Step 3: green** — new tests + `npm test` (LSP acceptance suites exercise `SqlDocument` heavily; they must not notice) + `npm run test:corpus`.
- [ ] **Step 4: Commit** `feat(document): statement cells — content-addressed per-statement parse with cross-edit reuse`

### Task 6: per-statement semantics in `analyze()` and the LSP

**Files:**
- Modify: `src/document/document.ts` (`analyze`), `src/lsp/features/*.ts` (hover, definition, references, document-highlight, completion, signature, inlay-hints, selection — every feature that does `doc.scopes`/`doc.ast` + offset now routes `cellAt(offset)` first), `src/lsp/features/diagnostics.ts` + `pull-diagnostics.ts` (merge per-cell semantic diagnostics), `src/lsp/features/symbols.ts` + `code-lens.ts` + `folding.ts` (iterate all cells), `src/lsp/server.ts` (`rebuild` uses `prev.withText(...)` instead of `SqlDocument.create` so the cell cache carries across edits — `docs.get(uri)` is the prev)
- Test: `tests/lsp.acceptance.test.ts` + `tests/lsp.acceptance.dialects.test.ts` (extend), `tests/document.cells.test.ts` (extend)

**Interfaces:** `DocumentAnalysis` unchanged in shape; its `qualification`/`symbols`/`diagnostics` become the merge of per-cell `qualify(cell.scopes, schema)` / `deriveSymbols(cell.scopes, schema)` results (memoized per cell + schema identity/version, so an edit to statement 2 doesn't re-qualify statement 1). `TypeInfo` is schema-only — shared.

- [ ] **Step 1: failing acceptance tests** — the multi-statement matrix, per dialect where the harness supports it: `SELECT a FROM t1; SELECT b, «cursor» FROM t2` — hover on `b` answers from statement 2's scope; completion at the cursor offers `t2` columns; an unknown-column diagnostic in statement 1 does not suppress statement 2's hover; document symbols list outputs of BOTH statements. (Today all of these are dead — the compound collapse.)
- [ ] **Step 2: implement** the per-cell analyze memo + feature routing. Feature handlers change minimally: `const cell = doc.cellAt(offset) ?? fallback-to-doc`; positions translate through the cell span.
- [ ] **Step 3: green** — full `npm test` + acceptance + `npm run test:corpus`.
- [ ] **Step 4:** update `docs/PLAN.md` Open Gaps: the "incremental re-parse deferred" entry closes; state the achieved shape (statement-scoped, content-addressed; intra-statement incrementality remains genuinely out — ANTLR has no incremental mode — recorded as an inherent limit, not a deferral).
- [ ] **Step 5: Commit** `feat(document,lsp): per-statement semantics — multi-statement files get real scopes; edits recompute one cell`

**PAUSE POINT — Stage B done.** The editor mandate's biggest structural gap is closed.

---

## STAGE C — resolve-callback schema provider

Recon: `Schema` is a concrete final class, sync-only; `SqlDocument._analysisCache` keys by Schema **object identity** (`document.ts:71`); `src/lsp/dialect-config.ts:68` builds one Schema from a JSON file at startup. Goal (Niclas, 2026-07-02): API-type consumers supply a **resolve callback** instead of a full upfront mapping — big-warehouse LSP/embedding usage fetches table metadata on demand.

### Task 7: `SchemaSource` + `CallbackSchema`

**Files:**
- Create: `src/qualify/schema-source.ts`
- Modify: `src/qualify/schema.ts` (implements the interface), `src/document/document.ts` (cache key gains version), consumers' parameter types (`qualify.ts`, `sema/resolve.ts`, `infer/infer.ts`, `lineage/lineage.ts`, `symbols/symbols.ts`, `completion/complete.ts`, `api.ts` — type-level: `Schema` → `SchemaSource`; structural typing keeps every existing caller compiling)
- Test: `tests/schema-source.test.ts` (tier 1)

**Interfaces (produced):**

```ts
// schema-source.ts
export interface SchemaSource {
	columnsFor(parts: string[], dialect?: string): Column[] | undefined;
	tables(dialect?: string): string[];
	/** Monotonic; bump means "answers may have changed — invalidate memos". Plain Schema: always 0. */
	readonly version: number;
}

export interface TableResolver {
	/** Sync, from the host's cache. undefined = unknown/not-yet-loaded (recorded as a miss). */
	resolve(parts: string[]): Column[] | undefined;
	/** Async fetch for missed tables; host-side. Called by prime(). */
	fetch?(missing: string[][]): Promise<void>;
}

export class CallbackSchema implements SchemaSource {
	constructor(resolver: TableResolver)
	columnsFor(parts: string[], dialect?: string): Column[] | undefined  // folds parts (Task 3 rules), delegates, records misses
	tables(dialect?: string): string[]                                    // what the resolver has revealed so far
	readonly version: number
	readonly misses: ReadonlyArray<string[]>                              // distinct, in first-seen order
	/** Drains misses through resolver.fetch, bumps version, resolves when the cache is warmer. */
	prime(): Promise<boolean>                                             // true if anything new arrived
}
```

Design: the analysis pipeline stays 100% sync — `columnsFor` answers from whatever the resolver has *now*; unknown tables degrade to `unknown` types exactly like a missing mapping entry today (never-wrong holds). Asynchrony lives entirely in `prime()`. `SqlDocument.analyze` memo key becomes `schema-identity + ":" + schema.version` (a composite string key over a WeakRef? No — keep the `Map<SchemaSource, Map<number, DocumentAnalysis>>` two-level shape; simplest and identity-correct).

- [ ] **Step 1: failing tests.** (a) `CallbackSchema` over a resolver knowing `t1` only: `analyze` resolves `t1` columns, `t2` yields `unknown-table` diagnostic + records the miss; (b) `prime()` (fetch adds `t2`) bumps `version`; re-`analyze` on the same doc returns a NEW `DocumentAnalysis` (memo invalidated) with `t2` resolved; (c) a plain `Schema` still memoizes as before (version constant 0); (d) misses dedupe.
- [ ] **Step 2: implement** interface + class + the type-level consumer switch + the versioned memo.
- [ ] **Step 3: green** — new tests, `npm test`, corpus tier. Export `SchemaSource`, `CallbackSchema`, `TableResolver` from `src/api.ts`/`src/index.ts`.
- [ ] **Step 4: Commit** `feat(schema): SchemaSource + CallbackSchema — resolve-on-demand catalogs with versioned analysis invalidation`

### Task 8: LSP wiring — fetch on miss, re-publish when warm

**Files:**
- Modify: `src/lsp/dialect-config.ts` (config may declare the schema as `"file"` (today) — unchanged; the *server embedding API* gains a provider slot), `src/lsp/server.ts` (`publish` — after computing diagnostics, if the active schema is a `CallbackSchema` with fresh misses: fire-and-forget `prime().then(changed => changed && publish(uri))` with a version guard so a stale prime never overwrites newer state)
- Test: `tests/lsp.acceptance.test.ts` (one new case over the in-memory harness)

- [ ] **Step 1: failing acceptance test** — harness starts the server with a `CallbackSchema` whose fetch reveals `orders` on first prime: first diagnostics publish contains `unknown-table orders`; after the prime microtask settles, a second publish arrives without it (harness collects publishes per version).
- [ ] **Step 2: implement** — the version-guarded re-publish; document the embedding entry point (how a host hands the server a `SchemaSource`) in the LSP feature-surface docs.
- [ ] **Step 3: green** + full acceptance. Commit `feat(lsp): lazy catalog — diagnostics re-publish when the resolver warms`

**PAUSE POINT — Stage C done.**

---

## STAGE D — nullability inference

Recon: nothing carries nullability today (`Type` has no field; grep = one false positive). Design: a **parallel walk**, not a `Type` change — `FnRule = (args: Type[]) => Type` stays untouched across ~1,800 registry entries, `coerce`/`typeEq`/`formatType` untouched. Precedent: sqlc's dedicated nullability pass.

### Task 9: schema carries NOT NULL

**Files:**
- Modify: `src/qualify/schema.ts` (`Column` gains `nullable?: boolean`; `SchemaMapping` leaf widens to `string | { type?: string; nullable?: boolean }`; `ingest`'s structural table-detection ("every value is a string", ~:43) becomes "every value is a string **or a leaf object** (only `type`/`nullable` keys, primitive values)")
- Test: `tests/schema-source.test.ts` (extend)

- [ ] **Step 1: failing test** — `new Schema({ t: { a: "int", b: { type: "int", nullable: false } } })`: `columnsFor(["t"])` returns both, `b.nullable === false`, `a.nullable === undefined`; nesting detection still classifies `{ db: { t: {...} } }` correctly with mixed leaf forms.
- [ ] **Step 2: implement**; keep `parseStructFields` untouched. **Step 3: green**, `npm test`. **Step 4: Commit** `feat(schema): optional per-column nullability in the mapping`

### Task 10: the nullability engine

**Files:**
- Create: `src/infer/nullability.ts`
- Test: `tests/infer.nullability.test.ts` (tier 1)

**Interfaces (produced):**

```ts
export type Nullability = "notnull" | "nullable" | "unknown";
export function inferNullability(expr: Expr, scope: Scope, schema: SchemaSource): Nullability;
```

Rules (each mirrors documented SQL semantics; never-wrong = `unknown` on any doubt):
- Literals: `NULL` → `nullable`; every other literal → `notnull`.
- Column ref → resolve via `resolveColumnSource` (the existing shared binder): physical table + schema `nullable === false` → `notnull` **unless the column's source sits on the null-extended side of an outer join in this scope** — a helper `nullExtended(scope, sourceKey): boolean` derived from the select's join list (LEFT extends the right source, RIGHT the left, FULL both; the IR join shape is on the `SelectExpr` sources). Derived (CTE/subquery) columns recurse into the producing projection like `derivedColumnType` does. Anything else → `unknown`.
- `cast` → nullability of its operand. Binary/unary arithmetic & comparison → `notnull` if ALL operands `notnull`, `nullable` if ANY is `nullable`, else `unknown` (SQL null propagation).
- `case` → `nullable` if no ELSE; else fold branches like the operands rule.
- Function table (small, separate from `FnRule` — `Record<string, (args: Nullability[]) => Nullability>`): `coalesce`/`ifnull`/`nvl`/`isnull` → `notnull` if any arg `notnull` (else fold); `nullif` → `nullable`; `count`/`count_if` → `notnull`; `sum`/`avg`/`min`/`max`/other aggregates → `nullable` (empty/all-NULL groups); `current_date`/`current_timestamp`/`now` → `notnull`. Absent name → `unknown`. ~20 entries to start; doc-cite each.
- Explicit boundary (record in PLAN.md, surfaced now per the no-silent-scope rule): **no flow narrowing** — `WHERE x IS NOT NULL` does not upgrade `x` downstream. That is dataflow analysis, a separable subsystem; this stage ships expression-shape + schema + join-shape nullability, complete for that scope.

- [ ] **Step 1: failing tests** covering every rule above, plus the join cases: `t1 LEFT JOIN t2` → `t2.notnull_col` is `nullable`, `t1.notnull_col` stays `notnull`; FULL JOIN both nullable; the same column through a CTE keeps its verdict; unknown schema → `unknown` everywhere.
- [ ] **Step 2: implement**. **Step 3: green.** **Step 4: Commit** `feat(infer): nullability inference — schema + join-shape + expression rules, parallel to typing`

### Task 11: surface it — hover, inlay hints, API

**Files:**
- Modify: `src/api.ts` (`TypeInfo` gains `nullabilityOf(expr, scope): Nullability`; export `Nullability`), `src/lsp/features/hover.ts` (append ` — not null` / ` — nullable` when the verdict isn't `unknown`), `src/lsp/features/inlay-hints.ts` (no change to the hint text by default — types only; nullability stays hover-only to keep hints short), `src/index.ts`
- Test: acceptance hover case + `tests/infer.nullability.test.ts` (API surface)

- [ ] **Step 1: failing acceptance test** — hover over a NOT-NULL schema column shows the type and `not null`; over the same column behind a LEFT JOIN shows `nullable`; over an un-schema'd column shows the type only (no nullability noise on `unknown`).
- [ ] **Step 2: implement.** **Step 3: green** — full `npm test` + acceptance. **Step 4: Commit** `feat(api,lsp): nullability on TypeInfo and hover`

**PAUSE POINT — Stage D done.**

---

## STAGE E — call-signature diagnostics + wave close

Truth-up from the survey: our return-type registry is ALREADY strategy-composable (`FnRule`, `docs/type-polymorphism.md`) — the genuine Calcite delta is **operand-side validation**: nothing today flags `nullif(a)` (arity) or a bad argument type. The B/C/D wave's Task 2 ships harvested signature tables (`src/signature/generated/<dialect>.ts`) beside the curated ones — this stage consumes both.

### Task 12: arity + operand diagnostics

**Files:**
- Create: `src/qualify/check-calls.ts`
- Modify: `src/qualify/qualify.ts` (walk function exprs, emit into `Qualification.diagnostics`; `Diagnostic.kind` union gains `"wrong-arity" | "wrong-argument-type"`), `src/signature/signatures.ts` (export a lookup covering curated + harvested with min/max/variadic arity per overload — derive from the existing `FnSignature` param shapes)
- Test: `tests/qualify.calls.test.ts` (tier 1) + corpus-gate extension

Rules (never-wrong, in order of strictness):
- **Arity** (curated + harvested): name present in the tables AND the call's arg count matched by NO overload's [min, max/variadic] → `wrong-arity` (severity: warning at the LSP layer). Name absent → silent.
- **Operand type** (curated ONLY — harvested param types are not trusted for rejection): every argument type inferable (`inferType` ≠ unknown) AND every overload rejects some argument position under `coerce` (no implicit widening path) → `wrong-argument-type`. Any `unknown` anywhere → silent.
- **The honesty gate:** extend each dialect's tier-2 corpus test with a zero-false-positive sweep — run the checker over every parsed `query/` file (they are all valid vendor-documented SQL): **0 diagnostics allowed**. Any hit is a bug in a signature table or the checker, fixed there — never excluded. This is the corpus proving the never-wrong contract for the new diagnostic class.

- [ ] **Step 1: failing tests** — `nullif(a)` flags wrong-arity (curated, 2 args exactly); `concat()` with a variadic signature doesn't flag; unknown function silent; `abs('x', 'y')` arity-flags but `abs(unknown_col)` type-silent; a curated fn given a provably-string arg where all overloads take numeric → `wrong-argument-type`.
- [ ] **Step 2: implement** + wire into `qualify` (per-cell via Stage B, so the LSP squiggle lands on the right statement).
- [ ] **Step 3: the corpus sweep** — add to each of the 8 dialect corpus gates (same single parse, zero re-parses per the tier-2 rule); fix every hit found; report the per-dialect hit counts you burned down in the commit body.
- [ ] **Step 4: green** everywhere; Commit `feat(qualify): call-signature diagnostics — arity (curated+harvested) and operand types (curated), corpus-proven zero false positives`

### Task 13: docs truth-up + wave close

**Files:** `CLAUDE.md`, `docs/PLAN.md`, `README.md` (LSP feature matrix)

- [ ] CLAUDE.md Current status: statement-scoped incremental SqlDocument (multi-statement semantics now real), dialect-true identifier folding (note the Snowflake/Postgres semantics now honored), SchemaSource/CallbackSchema, nullability, call diagnostics — current-state phrasing, no narrative, no AI-tells. Verify the dialect count/roster sentence matches master (eight incl. trino) while there.
- [ ] PLAN.md Open Gaps: close the incremental-re-parse entry (per Task 6 Step 4 if not already); add the two recorded inherent limits (intra-statement ANTLR incrementality; nullability flow-narrowing) and the LSP-surfaced follow-ups this wave revealed.
- [ ] README LSP matrix rows for nullability-on-hover and call diagnostics.
- [ ] Final: `npm run test:all` green, `npm run format`, commit `docs: editor-gold wave close`, ledger done.

---

## Self-review notes

- **Coverage vs the approved scope:** identifier fold → Tasks 1-3; statement-scoped incremental → 4-6; resolve callback → 7-8; nullability → 9-11; signature diagnostics (the honest residue of "strategy-based return types", which recon showed already exists as `FnRule`) → 12; docs → 13. Nothing from the survey's actionable list left unaddressed; the two things deliberately NOT planned are recorded as inherent limits, not deferrals (Task 6 Step 4, Task 10 boundary).
- **Dependencies:** 1→2→3 strictly ordered. Stage B independent of A (merge-safe either order, but A first keeps cell scopes folding correctly from day one). 7→8; 9→10→11 (10 consumes 9's `nullable`; 7's `SchemaSource` type is 10's parameter — so C before D). 12 needs B (per-cell diagnostics) and the merged B/C/D harvested tables. 13 last.
- **Type consistency check:** `foldIdentifier(raw, dialect, kind)` used identically in Tasks 1-3; `SchemaSource` is the parameter type from Task 7 onward (Tasks 10, 12 reference it, not `Schema`); `StatementCellSpan`/`StatementCell`/`cellAt` names consistent across Tasks 4-6, 12.
- **Honest risk flags:** (a) Task 2 is the wave's largest and most collision-prone task — it edits identifier extraction in all eight `lower.ts` files (quotedness must survive into the IR) exactly where the B/C/D branch is working, which is why the post-merge gate in Global Constraints is mandatory, not advisory; it will also flip some existing test expectations that accidentally pinned the wrong fold — each flip must be argued from the vendor manual in the commit, and if any corpus gate stat moves, stop and report before proceeding. (b) The Task 4 depth heuristic (BEGIN/CASE/END) is a heuristic — its failure mode is bounded by the tiling fallback to one cell (today's behavior), which is the design's safety valve; new separator edge cases found later add splitter tests, they don't threaten correctness. (c) Task 12's corpus sweep may reveal harvested-table junk at volume — the rule is fix-or-narrow the tables, and if a dialect's harvested arity data proves too dirty, arity checking drops to curated-only for that dialect *visibly* (a constant in check-calls.ts with a comment), reported to Niclas at the pause point. (d) BigQuery's table-vs-column case split rests on the cited docs page — verify before encoding; if the docs say otherwise, encode what they say and correct this plan's table in the same commit.
