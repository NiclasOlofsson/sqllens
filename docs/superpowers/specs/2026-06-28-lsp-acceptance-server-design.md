# LSP acceptance server — design

Date: 2026-06-28
Status: approved (design), pending implementation plan

## Purpose

Prove, end-to-end, that the parser/analysis library can serve real editor features —
instead of self-grading on corpus stats. Build a Language Server Protocol (LSP) server
inside this workspace that wraps the existing library and turns each pipeline stage into
an editor capability. The server doubles as an **acceptance gate**: an automated test
suite drives it over the protocol and asserts the features produce correct, positioned
results; the same server can also be attached to a real VS Code for a live look.

If a thin adapter over the library lights these features up, that *is* the proof the
library is sufficient for the LSP and the SQL debugger.

Scope is strictly SQL. This has no dbt coupling.

## Background — what the library already provides

Pipeline: `parse → lower → resolveScopes → qualify → infer / lineage / symbols`. Only
`parse`/`lower` are per-dialect; everything after runs on the shared IR. Position data
is present in the substrate:

- **Semantic diagnostics** (`src/qualify/qualify.ts`) already carry `line`/`column`.
- **Every IR node** keeps a `cst` back-ref, so exact source spans are available
  (`cst.start`/`cst.stop`; antlr tokens expose 1-based line, 0-based column, char offsets).
- **Syntax errors** are the one gap: the parse error listener counts errors and discards
  the `line`/`column`/message antlr hands it. Tracked as issue #6.

## Goals (acceptance features)

All four, all positioned:

1. **Syntax diagnostics** — squiggles for broken SQL with ranges. Requires the issue-#6
   library fix.
2. **Semantic diagnostics** — unknown table/column/field/ambiguous-column. Positions
   ready today; requires a schema fed in.
3. **Hover types** — inferred type on hover over an expression/column.
4. **Go-to-definition + document symbols** — jump to a CTE/source definition; outline the
   statement.

Out of scope for v1: completion (heaviest feature; slots in later via the same
`node-at`/scope plumbing), formatting, rename, signature help, the SQL debugger adapter
(separate consumer; this server proves the substrate it will reuse).

## Architecture

A standalone LSP server at `src/lsp/`, built on `vscode-languageserver/node`, speaking
over stdio. It imports the library through `src/api.ts` (`parse` / `analyze`) and contains
**no analysis logic** — only translation: LSP request → library call → library
output (positions/spans) → LSP type. Keeping the adapter thin is deliberate; it is what
makes a green run meaningful.

The single server binary serves both acceptance modes:

- **Automated gate** — the vitest suite connects to the server over an in-memory
  JSON-RPC stream pair (no process spawning, CI-clean) and asserts feature output.
- **Attachable** — launched over stdio, a real VS Code (or any LSP client) attaches for a
  live look. Same binary, same code path.

`src/lsp/` is an application, not part of the library; it is excluded from the public
barrel (`src/index.ts`).

## Dialect resolution

A document's dialect is configured, never guessed (a `.sql` file does not announce its
warehouse). Source: a workspace-root file `.sqllens.json` with **ordered glob rules,
first match wins**:

```json
{
  "dialects": [
    { "files": "snowflake/**/*.sql", "dialect": "snowflake" },
    { "files": "**/*.tsql.sql",      "dialect": "tsql" },
    { "files": "**/*.sql",           "dialect": "databricks" }
  ],
  "default": "databricks",
  "schema": "schema.json"
}
```

`dialectFor(path)` = the first rule whose glob matches the document's workspace-relative
path, else `default`. The config is loaded once and re-read on change. Glob matching uses
`minimatch`.

The optional top-level `schema` key points at a catalog file used for semantic
diagnostics and hover types; absent ⇒ those tiers stay quiet (no schema means nothing to
check — not an error).

## Components

Each a small, independently testable unit.

- `src/lsp/server.ts` — connection wiring: `onInitialize` (advertise capabilities),
  text-document sync, request dispatch to the feature units.
- `src/lsp/dialect-config.ts` — loads `.sqllens.json`, exposes `dialectFor(path)` and the
  optional schema. Re-reads on file change.
- `src/lsp/ranges.ts` — the one span adapter. antlr token / cst node
  (`start`/`stop`, 1-based line, 0-based column) → LSP `Range` (both 0-based). Every
  feature converts positions through here; nothing else does line/column math.
- `src/lsp/node-at.ts` — the one genuinely new capability: given a character offset, walk
  the IR (via `cst` spans) and return the smallest node covering it. Backs hover and
  go-to-definition.
- `src/lsp/features/diagnostics.ts` — syntax + semantic diagnostics → `publishDiagnostics`.
- `src/lsp/features/hover.ts` — offset → `node-at` → `inferType` → `Hover`.
- `src/lsp/features/definition.ts` — offset → `node-at` → resolve to the defining
  CTE/source via the scope tree → `Location`.
- `src/lsp/features/symbols.ts` — scope tree → `DocumentSymbol[]` (outputs, CTEs, sources).

## Library change (issue #6)

`parse()` returns `errors: number` because the error listener counts. Change the listener
to capture each error as `{ message, line, column, length }` and surface a `diagnostics`
array on the parse result, keeping the existing `errors` count so nothing downstream
breaks. Applied to every dialect's `src/<dialect>/parse.ts` (and threaded through
`src/api.ts`'s `ParseResultIR`). This is an engine change, not faked in the LSP — the
positions belong to the parser.

## Data flow

- **didOpen / didChange** → `dialectFor(uri)` → `parse` (syntax diagnostics) + `analyze`
  with the optional schema (semantic diagnostics) → merge → `publishDiagnostics`.
- **hover(pos)** → text offset → `node-at` → `TypeInfo.typeOf(node, scope)` → render type
  → `Hover` with the node's range.
- **definition(pos)** → text offset → `node-at` → if a column/source ref, find its
  defining scope entry → `Location` (its span).
- **documentSymbol** → walk the scope tree → `DocumentSymbol[]` with ranges.

## Error handling

A valid parse never throws (existing library contract); the server mirrors it — a request
on a document with syntax errors still returns best-effort hover/symbols from whatever
lowered. A missing or malformed `.sqllens.json` falls back to `default` dialect and logs a
warning over the LSP `window/logMessage`, never crashes the server. An unknown dialect in
a rule is a config error reported the same way.

## Testing — the acceptance gate

`tests/lsp.*.test.ts`:

- Spin the server over an in-memory `vscode-languageserver-protocol` connection.
- Open fixture documents and assert, per feature:
  - syntax error lands on the expected range;
  - semantic error lands on the expected column for an unknown table/column;
  - hover at a position returns the expected type;
  - definition jumps to the defining CTE's range;
  - document symbols list the expected outputs.
- Fixtures are `(sql, position, expected)` triples; a fixture `Schema` feeds the
  schema-dependent tiers.

The suite is the repeatable proof. The attachable stdio mode is the same server for
eyeballing in VS Code; a short README documents how to point a client at it.

## Dependencies

New: `vscode-languageserver`, `vscode-languageserver-textdocument`,
`vscode-languageserver-protocol` (test client), `minimatch` (glob rules).

## Scope discipline

- Databricks wired end-to-end first (most complete, real-corpus reference). Every other
  dialect is reachable purely by a config rule — no per-dialect code in the server.
- The library change is the minimum to surface syntax positions; it does not alter
  analysis behavior.
- Completion and the debugger adapter are deliberately deferred, not silently dropped.

## Related issues

- #6 — `parse()` surfaces a count, not positioned diagnostics. This design's library
  change closes it.
- #8 — per-dialect entry points / single-parser load. The server is built dialect-agnostic
  so it benefits when #8 lands, but does not depend on it.
- #3 — model complexity metadata for editor warnings; a future diagnostics source for this
  same server.
