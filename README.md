# sqllens

A TypeScript SQL parser and static analyzer. It parses SQL into a tree, lowers it
to a dialect-neutral IR, and runs a semantic layer over that IR: name resolution
(scope), schema-fed qualification, type inference, and column lineage. Give it a
query and it tells you the query's sources, its output columns, their types, and
where each column comes from. The parsers are generated TypeScript on the
[antlr4ng](https://github.com/mike-lischke/antlr4ng) runtime.

The front end is error-tolerant and token-first, so the same library powers
editor tooling — an LSP and a SQL debugger — over incomplete, mid-edit text. See
[Editor / language tooling](#editor--language-tooling).

## Dialects

| Dialect | Parse + lower | Semantic layer | Notes |
|---|---|---|---|
| Databricks (Spark SQL) | yes | yes | grammar forked from apache/spark |
| T-SQL | yes | yes | grammar forked from grammars-v4 `sql/tsql` |
| Snowflake | yes | yes | grammar forked from grammars-v4 `sql/snowflake` |
| BigQuery (GoogleSQL) | yes | yes | grammar forked from `bytebase/parser` `googlesql/`; gated against ZetaSQL's `.test` corpus |
| Redshift | yes | yes | grammar forked from Bytebase's Postgres-derived Redshift grammar (BSD-3) |

The semantic layer is dialect-agnostic: it operates on the shared IR and runs
unchanged on every dialect. Only the parse and lower stages are dialect-specific.

## The pipeline

```
parse → lower → resolveScopes → qualify → infer / lineage / symbols
```

- **parse** — text → concrete syntax tree (CST), with a syntax-error count.
- **lower** — CST → a dialect-neutral IR (`QueryExpr` / `SelectExpr` / `Expr` …);
  also reports the statement kind (query / dml / ddl / …).
- **resolveScopes** — a schema-free symbol table: visible sources, CTE
  resolution, output columns.
- **qualify** — with a schema: `*` expansion, unknown-table/column diagnostics,
  column types.
- **infer / lineage / symbols** — type inference, base-table lineage per output
  column, and a kind×modifier symbol model.

## Status

Pre-release, and not yet published to npm. The library is consumed as TypeScript
(no build emit yet — packaging is a later step). The public API (`src/index.ts`)
is uniform across all five dialects: `parse` and `analyze` take the dialect as a
parameter, and every per-dialect `parse*` / `lower` plus the shared passes stay
exported as lower-level building blocks. The editor-facing surface — `tokenize`,
`SqlDocument`, `complete`, `signatureAt` — lives on the same barrel.

## Usage

`dialect` is `"databricks" | "tsql" | "snowflake" | "bigquery" | "redshift"`. The surface is
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
`parseBigQuery` / `parseRedshift`, each `lower`, and the raw `resolveScopes` /
`inferType`) remain exported for callers that want a single stage.

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
  columns, tables, functions) from an ATN candidate walk over the grammar (our
  own, no third-party dependency).
- **`signatureAt(doc, offset)`** — parameter hints from a curated per-dialect
  function-signature table; the long tail degrades to name + active-argument.

```ts
import { SqlDocument, Schema } from "sqllens";

const doc = SqlDocument.create("SELECT amount FROM sales", "databricks");
doc.tokens;                       // first-class token stream (spans + roles)
doc.tokenAt(7);                   // token under an offset
const next = doc.withText("SELECT amount, id FROM sales", 2); // immutable edit → new doc
```

The LSP server (`src/lsp/`) holds one `SqlDocument` per open file and serves
diagnostics, hover, go-to-definition, document symbols, semantic tokens,
completion, and signature help — reaching the library only through this public
surface, so it can move to its own package later.

## Generating the parsers

`src/generated/` is a build product and is gitignored. After a fresh clone, or
after editing any `.g4`, generate the parsers (the lexer must generate before the
parser, which the driver handles):

```bash
npm run gen -- databricks   # | tsql | snowflake | bigquery | redshift
npm run typecheck
npm test
```

## Architecture

One folder per dialect; no shared "core" grammar and no grammar inheritance. Each
dialect is a standalone pair of split `.g4` files (a lexer grammar + a parser
grammar), forked from its best starting point and edited in place. Everything
downstream of `lower` is shared and dialect-neutral. See [docs/PLAN.md](docs/PLAN.md)
for the development plan and the tracked open gaps.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: the conformance corpora are the
gate — a grammar change that regresses a corpus is not done — and grammar work is
test-driven against those corpora.

## License

MIT — see [LICENSE](LICENSE). The forked grammars under `grammars/` keep their
upstream licenses (Apache-2.0 for Databricks; MIT for T-SQL and Snowflake; BSD-3
for BigQuery and Redshift); see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
