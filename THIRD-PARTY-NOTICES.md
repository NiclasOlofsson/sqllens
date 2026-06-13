# Third-party notices

sqllens is MIT-licensed (see [LICENSE](LICENSE)). It incorporates and depends on
the third-party works below, which keep their own licenses.

## Forked grammars (distributed in this repository, under `grammars/`)

The `.g4` files under `grammars/` are forks of upstream ANTLR grammars, edited in
place. Each file retains its original license header, and the local edits are
recorded in git history. Where a fork improves an upstream grammar, the fix is
contributed back upstream.

### Databricks grammar — Apache License 2.0

`grammars/databricks/DatabricksLexer.g4`, `grammars/databricks/DatabricksParser.g4`

Forked from [apache/spark](https://github.com/apache/spark)'s
`SqlBaseLexer.g4` / `SqlBaseParser.g4` (Spark SQL == Databricks SQL), which is
itself an adaptation of Presto's `SqlBase.g4`. Licensed under the Apache License,
Version 2.0; a copy is at <http://www.apache.org/licenses/LICENSE-2.0>.

Modifications (per Apache-2.0 §4(b)): renamed `SqlBase*` → `Databricks*`,
retargeted `tokenVocab`, ported the Java `@members`/predicates to TypeScript for
the antlr4ng target, replaced the `UpperCaseCharStream` with `caseInsensitive`,
and grammar fixes for Databricks-specific syntax. Details are in the file headers
and git history.

> TODO: Apache-2.0 §4(d) — paste the relevant attribution lines from Apache
> Spark's `NOTICE` file here (it is in the gitignored `vendor/spark/NOTICE`).

### T-SQL grammar — MIT

`grammars/tsql/TSqlLexer.g4`, `grammars/tsql/TSqlParser.g4`

Forked from [antlr/grammars-v4](https://github.com/antlr/grammars-v4) `sql/tsql`.
Copyright (c) 2017 Mark Adams; (c) 2015–2017 Ivan Kochurkin, Positive
Technologies; (c) 2016 Scott Ure; (c) 2016 Rui Zhang; (c) 2016 Marcus Henriksson.
Licensed under the MIT License (full text retained in the file header).

### Snowflake grammar — MIT

`grammars/snowflake/SnowflakeLexer.g4`, `grammars/snowflake/SnowflakeParser.g4`

Forked from [antlr/grammars-v4](https://github.com/antlr/grammars-v4)
`sql/snowflake`. Copyright (c) 2022 Michał Lorek. Licensed under the MIT License
(full text retained in the file header).

### BigQuery / GoogleSQL grammar — BSD 3-Clause

`grammars/bigquery/GoogleSQLLexer.g4`, `grammars/bigquery/GoogleSQLParser.g4`

Forked from [bytebase/parser](https://github.com/bytebase/parser), path
`googlesql/` (the h3n4l / Bytebase GoogleSQL grammar — same authors as the
grammars-v4 Snowflake grammar above). It was hand-authored from Google's BigQuery
"Query Syntax" reference, with ZetaSQL's `bison_parser.y` as the spec for syntax
the docs omit. Copyright (c) 2025, Bytebase. Licensed under the BSD 3-Clause
License — full text vendored at [`grammars/bigquery/LICENSE`](grammars/bigquery/LICENSE),
provenance in the file headers.

## Runtime and build dependencies (not redistributed in source)

- **antlr4ng** — the TypeScript ANTLR runtime (BSD-3-Clause). Runtime dependency.
- **antlr-ng** — the pure-TypeScript ANTLR generator used by `npm run gen` to
  produce `src/generated/` (a build product, gitignored). Dev dependency.

Consult each package's own license for the authoritative terms.
