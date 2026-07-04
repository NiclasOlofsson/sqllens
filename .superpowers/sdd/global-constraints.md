## Global Constraints

- **Never-wrong contract**; a fix that rejects valid SQL or fabricates IR is a defect. Rejecting-valid-SQL fixes (this wave's core) must each carry a doc citation proving the rejected form IS valid vendor SQL.
- **No gate weakened, ever.** Tier-2 green before merge; ratchets/floors only move in permitted directions; LSP acceptance stays green.
- **Grammar edits carry the proof kit**: corpus IR hash-diff vs pre-change grammar over the dialect's full docs `query/` bucket; enumerated changed-set with each change verified correct; fallback ratchets not risen. (Additions that only ACCEPT MORE — this wave's identifier holes and duckdb allowances — should hash-diff clean with an EMPTY changed-set: previously-parsing files must be untouched.)
- **Public API additive.** `src/generated/` regenerated, never hand-edited. Tabs; `npm run format`; `npm run typecheck` clean.
- **Anvil channel protocol** (docs/anvil/CHANNEL.md): master-only, commit-immediately, wall-clock stamps, shipped ⇒ master commit. ITEM 12's ship note owes the 5-red-case acceptance status.
- Subagents on Opus or Sonnet 5, never Fable. Commits end with:
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
- Corpus repo via `SQL_CORPUS_DIR`; organizer runs commit to the corpus repo separately.
- No pause points; escalate only genuine forks (language changes beyond enumerated wrong readings).

