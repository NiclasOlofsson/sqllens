# LSP acceptance server — implementation harness

Date: 2026-06-28
Status: approved
Companion to: `2026-06-28-lsp-acceptance-server-design.md` (the *what*); this is the *how* —
the autonomous subagent-driven loop that implements issue #9.

## Shape

Subagent-driven TDD, orchestrated inline in one session. The orchestrator (main loop)
holds the task list, the worktree, and the two hand-back points; it does not write feature
code — implementer subagents do. All work happens in one dedicated git worktree off
`feat/lsp-acceptance-server`, cleaned up at the end.

## The per-task cycle (rigid)

Every task runs the same loop:

1. **Implementer** — given the task + the design spec, writes the failing test first
   (TDD red), then the implementation (green). Returns: files touched, test name, suite
   result.
2. **Adversarial reviewer** (fresh agent) — tries to *refute* the task against four checks:
   - **Meaningful test** — would it fail if the business logic broke? (Rule 6: a test that
     can't fail when behavior changes is testing the wrong thing.)
   - **Correct positions** — ranges/offsets land where the spec says.
   - **Thin adapter** — *zero analysis logic in `src/lsp/`*; the server only translates
     LSP request → library call → LSP type. This is the central QC target: analysis logic
     leaking into the adapter makes the green gate prove nothing.
   - **Spec conformance** — matches the approved design.
3. Refuted → back to step 1 with the objections. A task is `done` only when the reviewer
   passes **and** full `npm test` is green (corpus gates skip-aware).

## Phases and fan-out

Dependency-aware; parallel where the chain allows.

```
A  #6 parse-diagnostics: 4 dialect parse.ts edits in parallel; the single
   src/api.ts ParseResultIR change serialized as its own step (avoid merge stomp).
   ▶ CHECKPOINT — stop, show the diff, wait for sign-off.
B  plumbing in parallel: ranges.ts · node-at.ts · dialect-config.ts
C  4 features in parallel: diagnostics · hover · definition · symbols
D  acceptance suite (tests/lsp.*.test.ts) + attachable stdio mode + README
E  FINAL SWEEP — multi-agent review over the whole branch
   (correctness + thin-adapter + spec-conformance lenses).
   ▶ branch-ready — notify; no push/PR/merge without sign-off.
```

## Stop conditions (only three)

- Checkpoint after Phase A.
- Branch-ready after Phase E.
- Genuinely blocked on a decision only Niclas can make.

No progress-report pauses between tasks (drive-to-completion).

## Budget

Max-20x, far from limits → favor thoroughness over frugality: parallel implementers,
multiple reviewers per gate, multi-lens final sweep.
