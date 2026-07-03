# Anvil Phase-0 Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the sqllens changes the dbt Anvil extension migration needs before it replaces sqlglot (source brief: `.superpowers/sdd/anvil-phase0-brief.md`, from the dbt-studio-vscode side, 2026-07-03): Join nodes in the IR (the extension's critical path — formatter span queries + debugger stage slicing), per-part spans on column references, a public per-dialect symbol-set API, and verification tests for batch-parse parity and comment tokens.

**Architecture:** All IR changes are additive (new optional fields; existing consumers untouched until migrated); the Join node is spec'd in docs/PLAN.md before implementation per the repo's IR house rules. Runs on the SLL-surgery branch AFTER the surgery tasks (both touch every dialect's lower.ts — sequential, never parallel).

**Tech Stack:** TypeScript (tabs), vitest two tiers, tsgo, prettier. No .g4 edits anywhere in this wave.

## Global Constraints

- **Sequencing:** starts only after SLL-surgery Tasks 2–6 are complete on this branch. Editor-gold remains queued behind both (its Stage A will absorb any per-part-span residue; its Stage B delivers the full per-statement-IR experience beyond item 4's parse parity).
- **IR changes are additive and spec-first.** `docs/PLAN.md` gets the Join-node spec section before code. Every new node carries a `cst` back-reference; `freezeIR`, the IR walker (`tests/helpers/ir-walk.ts`), and the conservation gate are extended in the same change that adds a node. Model concepts faithfully — no desugaring.
- **No gate weakened:** corpus gates 100%, `other`-ratchets and fallback ratchets not regressed, LSP acceptance green.
- **Public-surface discipline:** new exports go through src/api.ts + src/index.ts; report every API delta in the wave-close report (the extension side consumes it).
- Tabs; `npm run format`; `npm run typecheck` clean. Commits end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Subagents on Opus or Sonnet 5, never Fable.

---

### Task P1: Join nodes in the IR — the critical path

**Files:** `docs/PLAN.md` (spec section first), `src/ir/ir.ts`, `src/ir/freeze.ts`, `tests/helpers/ir-walk.ts`, all 7 dialect `src/<dialect>/lower.ts` (join lowering), `tests/ir.join.test.ts` (new), conservation coverage in the corpus files' existing single pass.

**Design (controller-decided, refine in the PLAN.md spec):**
```ts
export type JoinKind = "inner" | "left" | "right" | "full" | "cross" | "semi" | "anti" | "asof" | "positional" | "natural" | "lateral";
export interface Join {
	kind: JoinKind;
	/** The joined (right-side) source — the SAME object that appears in `from`. */
	source: Source;
	on?: Expr;              // ON predicate
	using?: string[];       // USING (col, …) — mutually exclusive with `on`
	natural?: boolean;
	/** Spans the full `JOIN … ON …` text. */
	cst: ParserRuleContext;
}
// SelectExpr gains: joins?: Join[]   (source order, cumulative left-to-right)
// `from` and `joinConditions` stay populated EXACTLY as today (compat; consumers migrate later).
```
- Joins ordered as written; `join.source` is reference-identical to the `from` entry so scope keys line up.
- Each dialect's lower already walks join chains to fill `from`/`joinConditions` — the Join array is built at the same sites.
- Semantics of scope/qualify/lineage/symbols UNCHANGED (they keep reading `from`+`joinConditions`; migration is a later wave).
- [ ] Spec in PLAN.md; failing tests first: per dialect — a 3-join chain (spans ordered, each covering `JOIN … ON …`), a USING join where supported, kind coverage (LEFT/CROSS/FULL; duckdb ASOF/POSITIONAL; databricks/tsql the semi/anti forms each dialect has); ON expr reference-equal to the matching `joinConditions` entry.
- [ ] Implement per dialect; freeze/walk/conservation extended; all gates green (ratchets: databricks/redshift/postgres/duckdb stay 0 `other`).
- [ ] Commit per coherent unit. `feat(ir): Join nodes — kind + source + ON/USING + full-construct spans`

### Task P2: per-part spans on column references

**Files:** `src/ir/ir.ts` (ColumnRef/`column` Expr gains `partSpans?: { start: number; end: number; line: number; column: number }[]` — parallel to `parts`, additive), the 7 `lower.ts` column-ref extraction sites, `src/symbols/symbols.ts` (column `Sym`s carry enough for per-part hit-testing — surface `partSpans` on the Sym or via the expr back-ref), `tests/ir.part-spans.test.ts`.

- [ ] Failing tests: `a.b.c` in each dialect asserts 3 part spans matching source offsets; quoted parts per dialect (`"a b".c` postgres/snowflake/duckdb/redshift, `` `a`.c `` databricks/bigquery, `[a].c` tsql).
- [ ] Implement: the CST children carry the positions — capture at extraction (NOTE for the implementer: the editor-gold plan's Stage A later rewrites these same extraction helpers for identifier folding; keep the span capture in a small helper it can reuse).
- [ ] Gates green; commit `feat(ir): per-part spans on column references`

### Task P3: dialect symbol-set API

**Files:** `src/api.ts` + `src/index.ts` (export), new `src/dialect-symbols.ts`, `tests/dialect-symbols.test.ts`.

```ts
export function dialectSymbols(dialect: Dialect): {
	functions: ReadonlySet<string>;  // canonical UPPERCASE; union of infer registry + signature tables (curated + harvested)
	keywords: ReadonlySet<string>;   // from the generated lexer vocabulary (symbolic names that are keyword tokens)
	types: ReadonlySet<string>;      // from the dialect's scalar-alias tables + type-name tokens
}
```
- Computed once per dialect, cached (module map). Keyword extraction: the generated lexer's vocabulary — literal names that are bare words (strip quotes, filter operators/punctuation); document the heuristic in the module header.
- [ ] Failing smoke tests per dialect: brief's examples — databricks has AGGREGATE + EXPLODE (functions), tsql has NVARCHAR (types), snowflake has QUALIFY (keywords); plus each set nonempty and all-uppercase.
- [ ] Implement + export; commit `feat(api): dialectSymbols(dialect) — functions/keywords/types membership sets`

### Task P4: verification tests for items 4 & 5 + wave-close report

- [ ] **Batch parity (verify-first):** cross-dialect test (`tests/batch-parity.test.ts`): `SELECT 1; SELECT 2;` (dialect-appropriate) parses with 0 errors and `statementCategories` reports two `query` statements for every dialect. Where a dialect fails, extend using the databricks batch-entry pattern (expected: all already pass — the entries are batch-level; this pins it). Document honestly in the test header: per-statement *IR* (not just categories) arrives with the editor-gold wave's statement cells.
- [ ] **Comment tokens (verify-only):** `tests/tokenize.comments.test.ts`: for all 7 dialects, `--`/`/* */` comments emit role `"comment"` tokens with exact spans, including trailing-at-EOF and between-any-two-tokens. Point at existing coverage where it exists; add what's missing.
- [ ] **Wave-close report** (`.superpowers/sdd/anvil-phase0-report.md` + summarized to Niclas): every public API delta from src/index.ts (new exports, extended types), keyed to the brief's five items, with the item-4 caveat above — the handoff the extension side starts consuming.
- [ ] `npm run test:all` green. Commit `feat(anvil-phase0): batch-parity + comment-token pins; wave close`

---

## Self-review notes

- Item 1 → P1, item 2 → P2, item 3 → P3, items 4+5 → P4. Brief's "clause framing where cheap": P1's Join cst spans + the existing token stream cover it; no forced clause-span nodes (per the brief's own "don't force it").
- P1 is the only structural risk: additive IR + compat-preserved `from`/`joinConditions` keeps every existing pass byte-identical; the conservation gate is the proof.
- P2 deliberately coordinates with editor-gold Stage A (same extraction sites) via a shared helper, not by pulling Stage A forward.
- If any brief requirement conflicts with repo design principles mid-implementation, the implementer stops and reports — Niclas arbitrates (the brief says the extension can adapt on its side of the seam).
