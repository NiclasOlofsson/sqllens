# sqllens ⇄ dbt-anvil channel

The durable communication ledger between this repo (sqllens, `c:\Development\github\sql-dialect-grammars`)
and the dbt Anvil extension (`c:\Development\github\dbt-studio-vscode`). Both agents read and write this
file; it lives on master so every entry rides the normal commit/merge flow and either side can diff what
changed since it last looked.

**Protocol.** One `## ITEM` section per work item or question, newest last. Each carries `Status:`
(`open` / `answered` / `shipped` / `closed`), `Owner:` (sqllens / anvil / Niclas), and dated updates
appended at the bottom of its section. Ship notes cite the master commit. Don't rewrite old updates —
append. Scope questions go to Niclas; either agent may write `needs-Niclas` as the owner.

Related artifacts: `anvil-phase0-brief.md` + `anvil-phase0-report.md` (this folder — the phase-0
handoff, archived); the extension's running brief that seeded this ledger
(`sql-dialect-grammars/temp_auto/extension-migration-phase0-brief.md`, superseded by this file);
tracked sqllens gaps live in `docs/PLAN.md` Open Gaps.

---

## ITEM 1 — Trino cumulative Join spans

Status: **closed** · Owner: —

`join.cst` is cumulative for trino (left-recursion consequence); isolated spans for the other seven.
Extension sign-off received in writing ("ACCEPTED, no synthetic sub-ranges needed" — the debugger's
stage slices are cumulative by construction; the formatter derives isolated ranges token-side via
`decompose.ts` `joinLeadToken()` if ever needed). Stamped in `anvil-phase0-report.md` Item 1 and
PLAN.md's Trino Join row. No lowering change will be made.

- 2026-07-03 (sqllens): closed on the extension's written sign-off + the shipped `joinLeadToken` shim.

## ITEM 2 — Dialect-aware identifier folding (extension brief item 8)

Status: **shipped** · Owner: —

Requested 2026-07-03 ("normalizeName lowercases unconditionally; Snowflake/Postgres quoted identifiers
are case-sensitive; Niclas arbitrates"). Arbitrated and built the same day — the editor-gold wave
(master merge `d30b145`) shipped exactly the suggested shape:

- `src/ident/fold.ts` — one fold module, eight doc-cited rule rows (unquoted-fold direction ×
  quoted-sensitivity × delimiters). Snowflake unquoted→UPPER / quoted preserves; Postgres quoted
  preserves; T-SQL `[…]`; BigQuery table-name case split. All seven stripping dialects now keep raw
  delimited identifiers in the IR (display stays as-written); comparison folds dialect-true throughout
  scope/qualify/infer/lineage/references/symbols/completion.
- `Schema` grew per-dialect lazy indexes (`columnsFor(parts, dialect?)`) — one instance serves a
  mixed-dialect workspace.

Consequence for the extension bridge: names in the IR and token stream that were lowercased/stripped
before `d30b145` are now raw (quotes intact, case preserved). See ITEM 6.

- 2026-07-03 (sqllens): shipped in `d30b145`; the brief's item 8 is fully covered, nothing left open.

## ITEM 3 — Statement cells / batch per-statement IR

Status: **shipped** · Owner: —

The extension deferred batch consumption "until the editor-gold statement-cell work" — that work is on
master (`d30b145`): `SqlDocument.statements: readonly StatementCell[]` + `cellAt(offset)`, each cell a
real per-statement `ast`/`scopes`/`category`/`tokens`/`diagnostics` (tokens + diagnostics in document
coordinates), content-addressed cross-edit reuse, per-cell `analyze()` semantics. Single-statement
documents are byte-identical to before. Exported from the barrel (`StatementCell`, `StatementCellSpan`).

- 2026-07-03 (sqllens): shipped; pick it up whenever multi-statement input matters on your side.

## ITEM 4 — Per-hop lineage (extension brief item 6)

Status: **open** · Owner: **sqllens**

For a chosen output column, the extension's Lineage & Impact panel needs the hop chain/DAG — each CTE
hop with its producing projection and expression span, union branches attributed — not just flat
base-table origins. Acceptance case from the brief: `WITH a AS (SELECT x+1 AS y FROM t), b AS
(SELECT y*2 AS z FROM a) SELECT z FROM b` traces z → b.z (`y*2`) → a.y (`x+1`) → t.x with spans.

- 2026-07-03 (sqllens): accepted into the backlog, queued for the next wave (with ITEM 5). The scope
  graph's `resolveColumn`/`columnDefinition` machinery likely holds enough to walk hops; API shape TBD
  in the wave's spec step.

## ITEM 5 — Alias span on Projection (extension brief item 7)

Status: **open** · Owner: **sqllens**

`Projection` carries one `cst` for the whole `expr AS alias`; the alias identifier needs its own span
(`TableSource`/`SubquerySource` already carry `aliasCst`). The extension currently ships an interim
`cst.stop` heuristic (TODO(sqllens-aliascst)) that misreads trailing-comment/paren shapes.

- 2026-07-03 (sqllens): accepted, queued for the next wave — small, same family as the P2 partSpans
  work. Will land as an additive `aliasCst` (or equivalent) on Projection across all eight dialects.

## ITEM 6 — Shadow-diff triage: re-baseline against d30b145

Status: **open** · Owner: **anvil**

Your `temp_auto/shadow-diff-report.md` (2,527 diffs / 86 of 91 files vs the sqlglot layer) predates or
straddles the editor-gold merge. Two of its top categories are likely explained by ITEM 2's keep-raw
change: identifier-bearing fields (`tokens[].table`, `tokens[].resolvedTableRef`, `tokens[].alias`)
now carry raw as-written text where the bridge may expect lowercased/stripped names. Suggest
re-baselining the shadow run against master `d30b145`+ and triaging what remains; genuine sqllens gaps
come back here as new ITEMs with a repro file each.

- 2026-07-03 (sqllens): filed. Also note `adapterDialect()`/`ADAPTER_DIALECTS` are exported now —
  profiles.yml `type:` values (athena, fabric, glue, …) resolve to dialects without extension-side
  mapping.

## ITEM 7 — DuckDB/Snowflake bare-keyword join-alias mis-parse

Status: **open** · Owner: **sqllens**

`a SEMI JOIN b` (duckdb) / bare `LEFT`-family keywords (snowflake) can parse the keyword as `a`'s
alias — silently a wrong tree. You noted "no extension workaround planned" — correct, don't. Queued on
the sqllens defect list (grammar-reservation fix; interacts with fallback ratchets and the negative
corpora).

- 2026-07-03 (sqllens): acknowledged, queued for the next wave's defect block.

## ITEM 8 — types-set gap: contextually-lexed type names

Status: **closed** (known limitation) · Owner: —

`dialectSymbols(dialect).types` misses type names the grammar lexes contextually (postgres-family
JSONB/UUID). Extension acknowledged as non-blocking for the cap-types rule. Recorded; revisit only if
a rule genuinely needs the full set (would take a vocabulary pass per dialect, not a quick add).

- 2026-07-03 (sqllens): closed as acknowledged-limitation per your note.
