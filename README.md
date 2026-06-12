# sqllens

A TypeScript SQL parser and static analyzer. It parses SQL into a tree, lowers it
to a dialect-neutral IR, and runs a semantic layer over that IR: name resolution
(scope), schema-fed qualification, type inference, and column lineage. Give it a
query and it tells you the query's sources, its output columns, their types, and
where each column comes from. The parsers are generated TypeScript on the
[antlr4ng](https://github.com/mike-lischke/antlr4ng) runtime.

## Dialects

| Dialect | Parse + lower | Semantic layer | Notes |
|---|---|---|---|
| Databricks (Spark SQL) | yes | yes | grammar forked from apache/spark |
| T-SQL | yes | yes | grammar forked from grammars-v4 `sql/tsql` |
| Snowflake | yes | yes | grammar forked from grammars-v4 `sql/snowflake` |
| Redshift, BigQuery | planned | — | hand-authored (no open grammar exists) |

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
(no build emit yet — packaging is a later step). Today the public API
(`src/index.ts`) exports the Databricks entry plus the shared semantic layer;
T-SQL and Snowflake parse and lower are implemented but not yet re-exported under
the unified public surface.

## Usage

```ts
import { parseDatabricks, lower, resolveScopes } from "sqllens";

const { tree, errors } = parseDatabricks("SELECT a, b FROM t WHERE a > 1");
if (errors === 0) {
  const ir = lower(tree);                       // dialect-neutral IR
  const scopes = resolveScopes(ir, "databricks"); // name resolution
  // ir.statement -> "query" | "dml" | "ddl" | …
}
```

With a schema you also get qualification, types, and lineage:

```ts
import { Schema, qualify, inferType, lineage } from "sqllens";
```

## Generating the parsers

`src/generated/` is a build product and is gitignored. After a fresh clone, or
after editing any `.g4`, generate the parsers (the lexer must generate before the
parser, which the driver handles):

```bash
npm run gen -- databricks   # | tsql | snowflake
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
upstream licenses (Apache-2.0 for Databricks; MIT for T-SQL and Snowflake); see
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
