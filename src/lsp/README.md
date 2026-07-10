# SQL language server (`src/lsp`)

A thin Language Server Protocol (LSP) adapter over the sqllens parser and analysis
library. It maps editor requests to the library's existing passes (`parse → lower →
resolveScopes → qualify → infer → symbols`) and translates the results into LSP
shapes. It holds no analysis logic of its own: diagnostics, types, definitions,
output columns, tokens, completions, and signatures all come from the library.

The server holds one `SqlDocument` per open file (rebuilt on edit) and serves
every feature from that cached document. It consumes only the public library
surface (`src/api.ts` / `src/index.ts`) plus `vscode-languageserver-*` and local
presentation helpers. This is the seam that lets the server be lifted into its own repo.

This is an application, not part of the published library. Nothing under
`src/lsp/` is exported from `src/index.ts`; the barrel ships the parser and analysis
API only. The server is here as the editor consumer that drives that API.

## Features

Every feature carries real source positions (no count-only or point-only output).

- Diagnostics: syntax errors from the parser plus semantic diagnostics from
  `qualify` (unknown table/column/field), each as a positioned range.
- Hover: the inferred type of the expression under the cursor, ranged to the
  covering expression's source span.
- Go-to-definition: jumps to a symbol's definition span (CTE, alias, derived
  column).
- References: find-all-occurrences plus the declaration of the symbol under the
  cursor, from the `referencesAt` occurrence engine.
- Document highlight: the same occurrences scoped to the open document, for
  in-editor highlight of the symbol under the cursor.
- Document symbols: the symbol tree (sources, CTEs, output columns) with each
  symbol's span.
- Code lens: a reference-count lens over each declared symbol (counts come from
  the occurrence engine).
- Folding ranges: foldable regions for statements, CTEs, and subqueries.
- Selection ranges: expand/shrink selection following the syntax tree from the
  caret outward.
- Inlay hints: inline output-column types from `infer`, shown at each projection.
- Semantic tokens: semantic highlighting from the document's token stream
  (`doc.tokens`), each with its exact span and role; serves full, range, and delta
  requests.
- Completion: scope-aware suggestions at the caret (keywords, schema
  tables/columns, function names), driven by the library's own ATN candidate walk.
  Works on mid-edit / invalid input.
- Completion resolve: lazily fills a completion item's signature detail for
  function candidates.
- Signature help: parameter hints while typing inside a call's parens, from a
  curated per-dialect signature table (name + active-argument fallback for the long
  tail).
- Pull diagnostics (`textDocument/diagnostic`): the same items as the push path,
  served on demand; push and pull coexist and the client picks whichever it supports.

The SQL-debugger adapter is out of this version by scope decision. It will reuse the
same `SqlDocument` and scope plumbing when built.

## Dialect and schema config: `.sqllens.json`

A document's dialect is configured, never guessed. On initialize, the server reads
`.sqllens.json` from the workspace root. It holds an ordered list of glob rules
(first match wins), an optional default, and an optional `schema` catalog. A missing
or malformed config is non-fatal: every file falls back to the `databricks` dialect
and a warning is logged over the LSP `window/logMessage` channel.

Supported dialects: `databricks`, `tsql`, `snowflake`, `bigquery`, `redshift`, `postgres`,
`duckdb`, `trino`.

Example `.sqllens.json`:

```json
{
  "dialects": [
    { "files": "warehouse/snowflake/**/*.sql", "dialect": "snowflake" },
    { "files": "edw/**/*.sql", "dialect": "tsql" }
  ],
  "default": "databricks",
  "schema": "schema.json"
}
```

`schema` points at a JSON catalog (a `SchemaMapping`: `{ table: { column: type } }`)
resolved relative to the workspace root. The catalog feeds the semantic-diagnostics
and hover tiers; without it those tiers degrade gracefully (syntax diagnostics and
structural symbols still work).

Example `schema.json`:

```json
{
  "sales": { "id": "bigint", "amount": "decimal(10,2)", "region": "string" }
}
```

## Embedding: handing the server a live catalog (`SchemaProvider`)

The stdio binary reads a static catalog from the `.sqllens.json` `schema` file. A
host that embeds the server (calls `startServer` itself, rather than launching the
stdio binary) can instead supply a live catalog: any `SchemaProvider` (the
interface renamed from `SchemaSource` in the 2026-07-05 provider cutover; a
`DefaultTemplateProvider` subclass also satisfies it, adding template resolution), as
the second argument:

```ts
import { startServer } from "sqllens/lsp/server"; // in-repo: ../lsp/server.js
import { CallbackSchema, type TableResolver } from "sqllens";

const resolver: TableResolver = {
  // Sync read from the host's warm cache; undefined = not-yet-loaded (recorded as a miss).
  resolve: (parts) => cache.get(parts.join(".")),
  // Async warm for the missed tables — fetched from the warehouse's information_schema, etc.
  fetch: async (missing) => {
    for (const parts of missing) cache.set(parts.join("."), await loadColumns(parts));
  },
};
startServer(connection, { schema: new CallbackSchema(resolver) });
```

An injected `schema` is the active catalog for every document and takes precedence
over the `.sqllens.json` `schema` file (the file path is the zero-config default; the
embedding slot is the programmatic override).

This is the answer to a big warehouse where a full upfront `SchemaMapping` is
infeasible. `CallbackSchema` resolves each table on demand:

- Analysis stays 100% synchronous: `resolve` answers from whatever the host cache
  holds now; an unknown table degrades to an unknown type, exactly like a missing
  mapping entry (never-wrong, no new diagnostic class).
- Every table the resolver couldn't answer is recorded as a **miss**. After each
  diagnostics publish, if there are fresh misses the server warms the resolver in the
  background (`prime()`) and, when a table is revealed, re-publishes diagnostics for
  that document: a cold read squiggles once and self-heals when the catalog warms.
- `prime()` coalesces concurrent calls and bumps a monotonic `version` only when a
  new table actually arrives, so the re-publish is version-guarded (a stale prime never
  overwrites a newer edit's diagnostics).

`SchemaProvider`, `CallbackSchema`, `TableResolver`, and `DefaultTemplateProvider` are
exported from the library barrel (`sqllens` / `src/index.ts`). Note the `world`
capability on `SchemaProvider`: `Schema`/`CallbackSchema` are CLOSED worlds (a miss
means the table doesn't exist; unknown-table may fire and self-heals via `prime()`),
while `DefaultTemplateProvider` defaults OPEN (a miss is unknown, never diagnosed).
A subclass backing `columnsFor` with a describe cache should declare
`override readonly world = "closed" as const` to keep the unknown-table flow.

## Running

```bash
npm run lsp
```

The server speaks LSP over stdio. It is meant to be launched by an editor / LSP
client, not used interactively from a terminal.

## Attaching a client

Point any LSP client at the stdio launch command. For VS Code, a generic LSP-client
extension configured with a stdio server:

- command: `node`
- args: `["--import", "tsx", "src/lsp/main.ts"]` (or run `npm run lsp`)
- working directory: the workspace root that holds `.sqllens.json`

The client sends `initialize` with the workspace `rootUri`; the server reads
`.sqllens.json` from there.

## Proof

The repeatable proof is the in-memory acceptance suite,
[`tests/lsp.acceptance.test.ts`](../../tests/lsp.acceptance.test.ts). It drives the
real server over an in-memory JSON-RPC duplex pair and asserts positioned results for
every feature against a temp workspace with `.sqllens.json` + `schema.json`. It
exercises `startServer` (the same function `src/lsp/main.ts` runs over stdio), so the
tested code path is the shipped one. The stdio binary is that same path wired to real
stdio for eyeballing in an editor.
