# sqllens

A TypeScript SQL parser and static analyzer. It parses SQL into a tree, lowers it
to a dialect-neutral intermediate representation (IR), and runs a semantic layer
over that IR: name resolution (scope), schema-fed qualification, type inference,
and column lineage. Give it a
query and it tells you the query's sources, its output columns, their types, and
where each column comes from. The parsers are generated TypeScript on the
[antlr4ng](https://github.com/mike-lischke/antlr4ng) runtime.

The front end is error-tolerant and token-first, so the same library powers
editor tooling — an LSP (Language Server Protocol) server and a SQL debugger —
over incomplete, mid-edit text. See
[Editor / language tooling](#editor--language-tooling).

## Dialects

| Dialect | Derived dialects | Parse + lower | Semantic layer | Notes |
|---|---|---|---|---|
| Databricks (Spark SQL) | Apache Spark, AWS Glue | yes | yes | grammar forked from apache/spark |
| T-SQL | SQL Server, Microsoft Fabric, Azure Synapse | yes | yes | grammar forked from grammars-v4 `sql/tsql` |
| Snowflake | — | yes | yes | grammar forked from grammars-v4 `sql/snowflake` |
| BigQuery (GoogleSQL) | — | yes | yes | grammar forked from `bytebase/parser` `googlesql/`; gated against ZetaSQL's `.test` corpus |
| Redshift | — | yes | yes | grammar forked from Bytebase's Postgres-derived Redshift grammar (BSD-3) |
| PostgreSQL | — | yes | yes | grammar forked from `bytebase/parser` `postgresql/` (BSD-3, PG18 keywords) |
| DuckDB | — | yes | yes | grammar forked from this repo's own postgres pair (no open ANTLR grammar exists) |
| Trino | Presto, Amazon Athena | yes | yes | grammar is the first-party trinodb `SqlBase.g4` (release 482), mechanically split |

A **derived dialect** is an engine with no grammar of its own: its SQL surface is
a subset of — or identical to — the primary dialect's, so the same grammar parses
it. Microsoft Fabric runs a restricted subset of T-SQL; Amazon Athena's query
engine *is* Trino; AWS Glue runs Spark. The set is corpus-gated, not inferred — an
engine appears only where the conformance gate proves the coverage, so it is a
floor, not a guess.

The semantic layer is dialect-agnostic: it operates on the shared IR and runs
unchanged on every dialect. Only the parse and lower stages are dialect-specific.

## The pipeline

```
parse → lower → resolveScopes → qualify → infer / lineage / symbols
```

Each stage produces one value, and that value is what a specific editor feature
reads from. Only the first two stages — **parse** and **lower** — are
dialect-specific; everything after them is shared and runs unchanged across all
eight dialects.

**parse** turns SQL text into a *concrete syntax tree* (CST): the full parse tree,
every token and grammar node exactly as written, nothing dropped or simplified. It
also hands back the token stream and a syntax-error count. The CST is faithful but
verbose and dialect-shaped, so nothing downstream reads it directly — it backs
**syntax squiggles** (the underline under a parse error) and **semantic tokens**
(dialect-aware highlighting).

**lower** walks the CST into an *intermediate representation* (IR): a small,
dialect-neutral tree of nodes such as `QueryExpr`, `SelectExpr`, and `Expr` that
mean the same thing whether the SQL came from Snowflake or T-SQL. (In the API this
value is the `ast` field — *abstract syntax tree*, the cleaned-up counterpart to
the CST.) It also tags each statement with its kind: a query, **DML**
(data-manipulation — `INSERT` / `UPDATE` / `DELETE`), or **DDL** (data-definition —
`CREATE` / `ALTER` / `DROP`). lower never throws, so even half-typed, broken SQL
still yields an IR the rest of the pipeline can run on.

**resolveScopes** builds a symbol table over the IR with no schema required. For
each query scope it works out the visible sources — tables, subqueries, and CTEs
(a *common table expression* is the `WITH name AS (…)` temporary result set) —
resolves names against them, and computes the query's output columns. Needing no
catalog, the features it powers work on any file with zero configuration:
**go-to-definition**, **find-references**, and **document highlight**.

**qualify** is the first stage that takes a *schema* — the catalog of tables and
their column types. With it, it expands `SELECT *` into the real column list,
raises unknown-table and unknown-column diagnostics, and binds each column
reference to the source it comes from, carrying the column's type. This is what
turns on the schema-dependent **semantic squiggles** (an unknown column can only be
flagged once the schema is known) and answers **`bindingOf`** — which source a
given column resolves to.

**infer** computes the type and nullability of every expression, from a bare
column to `a + b`, `COALESCE(…)`, a `CASE`, or a function call. It powers **hover**
(the type shown when you point at an expression) and **inlay hints** (inline type
annotations).

**lineage** traces each output column back to the base-table columns it derives
from — through CTEs, subqueries, and joins — recording every hop on the way. It
powers the **lineage panel** and **go-to-origin** (jump from an output column to
the physical column it ultimately reads).

**symbols** derives a `Sym` model: every named thing — source, column, CTE —
classified by kind and modifier. It backs the editor **outline / document
symbols** list and **code-lens** annotations.

## Status

Published to npm as [`sqllens`](https://www.npmjs.com/package/sqllens); still
0.x, so the public API is settling and can change between minor versions (this
release renamed `adapterDialect` → `resolveDialect`). `npm run build` compiles the
library with `tsc` to JavaScript + `.d.ts` in `dist/`, which is what the package
ships; in-repo it is consumed directly as TypeScript. The public API (`src/index.ts`)
is uniform across all eight dialects: `parse` and `analyze` take the dialect as a
parameter, and every per-dialect `parse*` / `lower` plus the shared passes stay
exported as lower-level building blocks. The editor-facing surface — `tokenize`,
`SqlDocument`, `complete`, `signatureAt` — lives on the same barrel.

## Usage

`dialect` is `"databricks" | "tsql" | "snowflake" | "bigquery" | "redshift" | "postgres" | "duckdb" | "trino"`.

Those eight grammars cover more than eight engines — the **derived dialects**
above — because several engines share the SQL surface of one we already parse.
`resolveDialect` maps an engine or product name (or a dialect name) to the dialect
that parses its SQL, so consumers don't re-derive the family knowledge:

```ts
import { resolveDialect, DERIVED_DIALECTS } from "sqllens";

resolveDialect("athena");    // "trino"      — Athena engine v3 executes on Trino
resolveDialect("glue");      // "databricks" — AWS Glue runs Spark; Databricks SQL = Spark SQL
resolveDialect("fabric");    // "tsql"       — same for "synapse" and "sqlserver"
resolveDialect("presto");    // "trino"      — Trino's predecessor
resolveDialect("oracle");    // undefined    — not served; never a guess
```

The map is exact by contract: only engines whose SQL surface the corpus gates
genuinely represent are listed. The LSP's `.sqllens.json` accepts these engine
names through the same map, so `{ "dialect": "athena" }` works in rules and
`default`.

The surface is
**layered** — each tier is a terminal value you can stop at — and **composable**:
every semantic method takes the closest upstream result (so passing it does no
rework) or a raw string / IR via an idempotent lift helper.

```ts
import { parse, analyze, Schema } from "sqllens";

// Tier 1 — just the IR. No semantic layer pulled in.
const { ast, errors, cst } = parse("SELECT a, b FROM t WHERE a > 1", "tsql");
// ast = dialect-neutral IR (frozen — no pass mutates it); cst = raw antlr tree (escape hatch)
// ast.statement -> "query" | "dml" | "ddl" | …

// Whole pipeline in one call.
const schema = new Schema({ t: { a: "int", b: "string" } });
const a = analyze("SELECT a, b FROM t", "tsql", { schema });
a.scopes;                                  // name resolution (ScopeTree)
a.diagnostics;                             // unknown-table/column diagnostics
a.qualification.columnsOf(a.scopes.root);  // * expansion
a.types.typeOf(expr, scope);               // per-expression types
a.lineage.originsOf("a");                  // base-table origins of an output column
a.symbols;                                 // kind × modifier symbol model
```

Compose tier by tier — pass any upstream result (or a string) to any later pass,
and only the missing steps run. No exported signature takes or returns a raw
`Map`/`Set`/`Record`:

```ts
import { parse, qualify, lineage, deriveSymbols, toScopes, Schema } from "sqllens";

const { ast } = parse(sql, "snowflake");
const scopes = toScopes(ast, { dialect: "snowflake" }); // idempotent lift; identity if already a ScopeTree
qualify(scopes, schema);   // reuses scopes — never re-parses or re-resolves
lineage(scopes, schema);   // safe to call on the same scopes, in any order
deriveSymbols(scopes);     // independent results, no cross-contamination
```

The per-dialect entries (`parseDatabricks` / `parseTSql` / `parseSnowflake` /
`parseBigQuery` / `parseRedshift` / `parsePostgres` / `parseDuckdb` / `parseTrino`,
each `lower`, and the raw `resolveScopes` / `inferType`) remain exported for
callers that want a single stage.

## Editor / language tooling

The front end is error-tolerant and token-first, so it serves editor features
that run on incomplete, mid-edit text — they never need a clean parse:

- **`tokenize(sql, dialect)`** and **`parse(...).tokens`** give a first-class token
  stream: every token with its exact span, role, and channel. Always available,
  even when the parse has errors.
- **`lower()` never throws** on broken or partial input — you get a flagged
  `query` IR back, so every downstream pass stays total.
- **`SqlDocument`** is a persistent, immutable, position-addressable per-file
  model. It runs `parse → resolveScopes` once (plus lazy `analyze(schema)`),
  caches the result, and answers `tokenAt` / `nodeAt`. An edit yields a new
  document; an O(log n) `LineIndex` maps positions ↔ offsets.
- **`complete(doc, offset, schema?)`** — scope-aware completion (keywords,
  columns, tables, functions) from an ATN (Augmented Transition Network — the
  grammar's state-machine form) candidate walk over the grammar, our own, with no
  third-party dependency.
- **`signatureAt(doc, offset)`** — parameter hints from a curated per-dialect
  function-signature table; the long tail degrades to name + active-argument.
- **`referencesAt(scopes, offset, schema?)`** — every occurrence (plus the
  declaration) of the symbol under the cursor; backs find-references, document
  highlight, and code-lens reference counts.

```ts
import { SqlDocument, Schema } from "sqllens";

const doc = SqlDocument.create("SELECT amount FROM sales", "databricks");
doc.tokens;                       // first-class token stream (spans + roles)
doc.tokenAt(7);                   // token under an offset
const next = doc.withText("SELECT amount, id FROM sales", 2); // immutable edit → new doc
```

## Language server

An LSP (Language Server Protocol) server built on the library, in `src/lsp/`. It
holds one `SqlDocument` per open file (rebuilt on edit) and reaches the library
only through the public API surface above — it adds no analysis of its own, only
protocol translation.

LSP is a large protocol — roughly thirty request types across document-sync,
language, and workspace features — so "supports LSP" is not one bit but a long
checklist. A SQL server needs a subset, but more of it maps to SQL than it first
looks — a CTE / view / model is the SQL analog of a definition, and the
dependency graph between them is a call hierarchy. A few features genuinely don't
apply (type hierarchy, document color, monikers); a few are deliberately deferred
(formatting, project-wide navigation). The coverage, feature by feature:

**Language features**

| Feature | Status |
| --- | --- |
| Completion (+ resolve) | ✅ |
| Hover | ✅ |
| Hover — nullability | ✅ (` — not null` / ` — nullable` suffix when provable) |
| Signature help | ✅ |
| Go to definition | ✅ |
| Find references | ✅ |
| Document highlight | ✅ |
| Document symbols | ✅ |
| Folding range | ✅ |
| Selection range | ✅ |
| Semantic tokens (full / range / delta) | ✅ all three |
| Inlay hints | ✅ (no resolve) |
| Code lens | ✅ (no resolve) |
| Go to declaration | ◻️ not yet |
| Go to type definition | ◻️ not yet |
| Go to implementation | ◻️ not yet — name → its defining query (view / model); needs the project model |
| Call hierarchy | ◻️ not yet — the CTE / view / model dependency graph |
| Document link | ◻️ not yet |
| Linked editing range | ◻️ not yet — live alias / name sync-edit |
| Code action (quick fixes) | ◻️ next phase |
| Rename (+ prepare) | ◻️ next phase |
| Formatting / range / on-type | ◻️ deferred (external formatter) |
| Inline values | ◻️ debugger surface |
| Type hierarchy | — n/a — SQL has no type-inheritance relation |
| Document color | — n/a — no color literals |
| Moniker | — n/a — LSIF / cross-repo indexing concern |

**Diagnostics & document sync**

| Feature | Status |
| --- | --- |
| Diagnostics — push (`publishDiagnostics`) | ✅ |
| Diagnostics — call signature (arity / argument type) | ✅ (curated tables; never-wrong, per-dialect coercion) |
| Diagnostics — pull (document) | ✅ |
| Diagnostics — pull (workspace) | ◻️ not yet |
| Text sync — open / change / close | ✅ (full-document) |
| Incremental sync | ◻️ full-document only (fine at SQL file sizes) |
| Save notifications (`didSave` / `willSave`) | ◻️ not yet |
| Notebook document sync | ◻️ not yet |

**Workspace features**

| Feature | Status |
| --- | --- |
| Workspace symbols | ◻️ needs a project / multi-file model |
| Execute command | ◻️ not yet |
| Configuration / watched-files | ◻️ not yet (protocol config; file-based `.sqllens.json` config exists) |
| File operations (create / rename / delete) | ◻️ not yet |

Legend: ✅ implemented · ◻️ not yet / deferred · — not applicable to SQL. The
deferred items are tracked work: rename and
code actions are the next LSP phase, workspace symbols need the project model,
and formatting is expected to wrap an existing external formatter.

## Generating the parsers

`src/generated/` is a build product and is gitignored. After a fresh clone, or
after editing any `.g4`, generate the parsers (the lexer must generate before the
parser, which the driver handles):

```bash
npm run gen -- databricks   # | tsql | snowflake | bigquery | redshift | postgres | duckdb | trino
npm run typecheck
npm test
```

## Architecture

One folder per dialect; no shared "core" grammar and no grammar inheritance. Each
dialect is a standalone pair of split `.g4` files (a lexer grammar + a parser
grammar), forked from its best starting point and edited in place. Everything
downstream of `lower` is shared and dialect-neutral.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: the conformance corpora are the
gate — a grammar change that regresses a corpus is not done — and grammar work is
test-driven against those corpora.

## License

MIT — see [LICENSE](LICENSE). The forked grammars under `grammars/` keep their
upstream licenses (Apache-2.0 for Databricks; MIT for T-SQL and Snowflake; BSD-3
for BigQuery and Redshift); see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
