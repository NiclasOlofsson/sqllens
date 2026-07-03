# Phase 0 brief: sqllens changes needed by the dbt Anvil extension migration

## Who is asking and why

The dbt Anvil VS Code extension (`c:\Development\github\dbt-studio-vscode`) is replacing its
sqlglot-on-Pyodide parsing layer with sqllens, consumed as TS source via an esbuild alias
(`sqllens → ../sql-dialect-grammars/src/index.ts`). sqllens becomes the extension's only SQL
parser: every hover, definition, rename, diagnostic, lint rule, formatter pass, column-lineage
trace, and SQL-debugger feature will run on `parse()` / `analyze()` / `tokenize()` /
`deriveSymbols()`. The extension's symbol layer is standardizing on the `Sym` model
(`src/symbols/symbols.ts`) — its debugger already uses the same `"_main_"` frame convention.

Five work items below, in priority order. Item 1 is the critical path — the extension's
formatter and debugger work is blocked until it lands. Items 2–3 are small additions.
Items 4–5 are verify-first (may already be done).

House rules apply as usual: spec-first in `docs/PLAN.md` for the IR change, corpus gates and
`other`-expression ratchets must not regress, model concepts faithfully (no desugaring), and
every new node keeps its `cst` back-reference.

## 1. Join (+ clause framing) nodes in the IR — CRITICAL PATH

**Problem.** `SelectExpr` (src/ir/ir.ts) carries `from: Source[]` plus a detached
`joinConditions?: Expr[]`. There is no Join node: no join type, no span for the
`JOIN … ON …` construct, no linkage between a joined source and its ON predicate.

**Why the extension needs it.** Two consumers, both span-driven:
- The formatter answers structural questions by span containment: "is this `ON` token inside
  a Join?", "what are the bounds of the Join I'm inside?", "does this Join's span contain an
  `And`/`Or` chain?" (drives multi-predicate ON layout).
- The SQL debugger decomposes a query into progressive stage snapshots
  (`SELECT * FROM a`, then `… JOIN b ON …`, then `… WHERE …`) by **slicing the original
  source text at node spans** — it needs each join's exact span, in source order.

**Requirements** (design is yours — spec it in docs/PLAN.md first):
- A Join node with: join kind (inner/left/right/full/cross/semi/anti — whatever each dialect
  has; lateral if it fits naturally), the joined `Source`, the ON predicate `Expr` (or USING
  column list), and a `cst` whose span covers the full `JOIN … ON …` text.
- Joins ordered as written (the debugger slices them cumulatively left-to-right).
- Scope/qualify/lineage/symbols semantics must be unchanged — they currently read
  `from` + `joinConditions`; migrate or dual-feed however you prefer, gated by the
  existing suites.
- "Clause framing where cheap": the extension can derive clause-keyword regions (WHERE /
  GROUP BY spans) from the predicate `cst` + token stream, so nothing further is *required*
  beyond Join. If a natural clause-span shape falls out of the design, take it; don't force it.

**Acceptance:** all suites green, ratchet baselines not regressed (databricks/redshift stay
at 0 `other`), corpus gates unchanged, and a test asserting Join spans + ON linkage per
dialect (including a 3-join chain and a USING join where the dialect supports it).

## 2. Per-part spans on column references

**Problem.** `ColumnRef.parts: string[]` has one `cst` span for the whole reference.

**Why.** For `o.order_id` the extension resolves cursor-on-`o` (table qualifier → rename the
alias, hover the relation) differently from cursor-on-`order_id`. The `Sym → extension`
bridge needs each part's own span.

**Requirement.** Expose per-part spans on `ColumnRef` (e.g. parts as `{name, span}` or a
parallel `partSpans`) and carry enough through column `Sym`s that a consumer can hit-test
individual parts. The CST children already have the positions.

**Acceptance:** a test asserting part spans for `a.b.c` in each dialect, including quoted
parts (`"a b".c`, `` `a`.c ``, `[a].c` as per dialect).

## 3. Dialect symbol-set API

**Problem.** `FUNCTION_SIGNATURES` is exported, but there is no public per-dialect set of
keyword names or type names.

**Why.** The extension's lint rules do membership checks: "is this identifier a known
function / reserved keyword / type name for this dialect?" (capitalization rules,
reserved-word warnings, completion).

**Requirement.** A public API shaped roughly:
`dialectSymbols(dialect): { functions: ReadonlySet<string>; keywords: ReadonlySet<string>; types: ReadonlySet<string> }`
— canonical uppercase names. Functions from the signature/inference registries; keywords and
types from what the grammars/vocabularies already know. Exact naming is yours; the extension
adapts to whatever you export. Cheap to compute or cached — it's called once per session per
dialect.

**Acceptance:** exported from src/index.ts; a smoke test per dialect asserting a few known
members (e.g. databricks has AGGREGATE/EXPLODE, tsql has NVARCHAR, snowflake has QUALIFY as
keyword).

## 4. Batch (multi-statement) parse parity — verify first

Databricks got a batch parse entry (2026-06-28, closed issue #1). Check whether tsql /
snowflake / bigquery / redshift parse multi-statement input equivalently (statement list with
per-statement IR + spans). If any dialect lacks it, extend using the databricks pattern.
Acceptance: a cross-dialect test feeding `SELECT 1; SELECT 2;` (dialect-appropriate
separators) and asserting two statements with correct spans.

## 5. Comment tokens through `tokenize()` — verify only

The extension's formatter preserves comments entirely from the token stream. Confirm
`tokenize(sql, dialect)` emits comment tokens (role `"comment"`) with exact spans for `--`
and `/* */`, including a trailing comment at EOF and a comment between any two tokens, for
all five dialects. If covered, point at the existing test; if not, add one.

## When done

Report back the public API deltas (new exports / changed types from src/index.ts) so the
extension side can start consuming them. If anything above conflicts with the repo's design
principles, say so rather than bending the IR — the extension can adapt on its side of the
seam, and the maintainer (Niclas) arbitrates.
