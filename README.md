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
| BigQuery (GoogleSQL) | yes | yes | grammar forked from `bytebase/parser` `googlesql/`; gated against ZetaSQL's `.test` corpus |
| Redshift | planned | — | hand-authored (no open grammar exists) |

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
is uniform across all four dialects: `parse` and `analyze` take the dialect as a
parameter, and every per-dialect `parse*` / `lower` plus the shared passes stay
exported as lower-level building blocks.

## Usage

`dialect` is `"databricks" | "tsql" | "snowflake" | "bigquery"`. The surface is
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
`parseBigQuery`, each `lower`, and the raw `resolveScopes` / `inferType`) remain
exported for callers that want a single stage.

## Generating the parsers

`src/generated/` is a build product and is gitignored. After a fresh clone, or
after editing any `.g4`, generate the parsers (the lexer must generate before the
parser, which the driver handles):

```bash
npm run gen -- databricks   # | tsql | snowflake | bigquery
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
