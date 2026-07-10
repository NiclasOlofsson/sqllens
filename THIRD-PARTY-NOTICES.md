# Third-party notices

sqllens is MIT-licensed (see [LICENSE](LICENSE)). It incorporates and depends on
the third-party works below, which keep their own licenses.

## Forked grammars (distributed in this repository, under `grammars/`)

The `.g4` files under `grammars/` are forks of upstream ANTLR grammars, edited in
place. Each file retains its original license header, and the local edits are
recorded in git history. Where a fork improves an upstream grammar, the fix is
contributed back upstream. `grammars/minijinja/` is original to this project (no
upstream ANTLR grammar for jinja/minijinja exists) and carries no third-party
notice.

### Databricks grammar — Apache License 2.0

`grammars/databricks/DatabricksLexer.g4`, `grammars/databricks/DatabricksParser.g4`

Forked from [apache/spark](https://github.com/apache/spark)'s
`SqlBaseLexer.g4` / `SqlBaseParser.g4` (Spark SQL == Databricks SQL), which is
itself an adaptation of Presto's `SqlBase.g4`. Licensed under the Apache License,
Version 2.0; a copy is at <http://www.apache.org/licenses/LICENSE-2.0>.

Modifications (per Apache-2.0 §4(b)): renamed `SqlBase*` → `Databricks*`,
retargeted `tokenVocab`, ported the Java `@members`/predicates to TypeScript for
the antlr4ng target, replaced the `UpperCaseCharStream` with `caseInsensitive`,
added a batch-level `multiStatement` entry rule, and grammar fixes for
Databricks-specific syntax. Details are in the file headers and git history.

Required attribution, reproduced from Apache Spark's `NOTICE` file (per Apache-2.0
§4(d)):

```
Apache Spark
Copyright 2014 and onwards The Apache Software Foundation.

This product includes software developed at
The Apache Software Foundation (http://www.apache.org/).
```

### Trino grammar — Apache License 2.0

`grammars/trino/TrinoLexer.g4`, `grammars/trino/TrinoParser.g4`

This is the first-party Trino grammar from [trinodb/trino](https://github.com/trinodb/trino),
`core/trino-grammar/src/main/antlr4/io/trino/grammar/sql/SqlBase.g4` (release 482,
commit `f04d222fbeedaf888ac3c907748209c7e716a4c2`, retrieved 2026-07-02),
mechanically split into a lexer + parser pair. Licensed under the Apache License,
Version 2.0 — full text vendored at [`grammars/trino/LICENSE`](grammars/trino/LICENSE).
trinodb/trino ships no `NOTICE` file, so there is no §4(d) attribution to reproduce.

Modifications (per Apache-2.0 §4(b)): split into a standalone lexer/parser pair,
inline punctuation literals renamed to the named tokens the lexer defines, the one
Java `isKeyword()` predicate ported to TypeScript, and a batch-level `root` entry
rule added. The whole delta from upstream is listed in the grammar file headers.

### BigQuery / GoogleSQL, Redshift, and PostgreSQL grammars — BSD 3-Clause

`grammars/bigquery/GoogleSQLLexer.g4`, `grammars/bigquery/GoogleSQLParser.g4`
`grammars/redshift/RedshiftLexer.g4`, `grammars/redshift/RedshiftParser.g4`
`grammars/postgres/PostgresLexer.g4`, `grammars/postgres/PostgresParser.g4`

Forked from the [bytebase/parser](https://github.com/bytebase/parser) monorepo
(paths `googlesql/`, `redshift/`, and `postgresql/` respectively). Copyright (c)
2025, Bytebase. Licensed under the BSD 3-Clause License — the full text is vendored
alongside each grammar ([`grammars/bigquery/LICENSE`](grammars/bigquery/LICENSE),
[`grammars/redshift/LICENSE`](grammars/redshift/LICENSE),
[`grammars/postgres/LICENSE`](grammars/postgres/LICENSE)).

Local edits — porting the Go-target embedded actions/predicates to the antlr4ng
TypeScript API, inlining the lexer bases and keyword imports (standalone-pair
convention), and per-dialect syntax build-out against each vendor's SQL reference —
are recorded in the grammar file headers and git history. The BigQuery grammar is
extended toward Google's live GoogleSQL spec, `google/googlesql`
`googlesql/parser/googlesql.tm`.

### DuckDB grammar — BSD 3-Clause (inherited)

`grammars/duckdb/DuckdbLexer.g4`, `grammars/duckdb/DuckdbParser.g4`

No open ANTLR DuckDB grammar exists; DuckDB's real parser is a fork of PostgreSQL's,
so this grammar is forked from this repository's own `grammars/postgres/` pair
(above) and inherits its BSD 3-Clause license and Copyright (c) 2025, Bytebase. Full
text vendored at [`grammars/duckdb/LICENSE`](grammars/duckdb/LICENSE).

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

### SQLite grammar — MIT

`grammars/sqlite/SqliteLexer.g4`, `grammars/sqlite/SqliteParser.g4`

Forked from [antlr/grammars-v4](https://github.com/antlr/grammars-v4) `sql/sqlite`
(upstream commit `8af0d4c26c796ea27c15c3d85418f2d0f77c3adb`, retrieved 2026-07-10).
Copyright (c) 2020 Martin Mirchev; (c) 2014 Bart Kiers. Licensed under the MIT
License (full text retained in the file headers).

## Runtime and build dependencies (not redistributed in source)

- **antlr4ng** — the TypeScript ANTLR runtime (BSD-3-Clause). Runtime dependency.
- **antlr-ng** — the pure-TypeScript ANTLR generator used by `npm run gen` to
  produce `src/generated/` (a build product, gitignored). Dev dependency.
- **vscode-languageserver** / **vscode-languageserver-protocol** /
  **vscode-languageserver-textdocument** / **vscode-languageserver-types** — the
  LSP layer's runtime dependencies (MIT).
- **minimatch** — glob matching used by the LSP layer (ISC).

Consult each package's own license for the authoritative terms.
