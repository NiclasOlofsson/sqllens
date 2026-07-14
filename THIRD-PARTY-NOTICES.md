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

### MySQL grammar — MIT

`grammars/mysql/MysqlLexer.g4`, `grammars/mysql/MysqlParser.g4`

Forked from [antlr/grammars-v4](https://github.com/antlr/grammars-v4)
`sql/mysql/Positive-Technologies` (upstream commit
`bf61744020dc46f2d7b8761e35b0c0cb39b3f31a`, retrieved 2026-07-10) — not the
`sql/mysql/Oracle` sibling variant. Copyright (c) 2015-2017 Ivan Kochurkin,
Positive Technologies; (c) 2017 Ivan Khudyashev. Licensed under the MIT License
(full text retained in the file headers).

## Doc-derived function-signature and function-docs tables (distributed in this repository)

The generated per-dialect function-signature tables and their per-name docs
companions (`signatures.generated.ts` / `fn-docs.generated.ts`, produced by
`tools/harvest-signatures.mjs`, committed under `src/`) carry factual API-surface
data (function names, parameter names, arity, optionality) and links to each
dialect's reference documentation. For the permissively licensed sources listed
below, the docs tables additionally reproduce one descriptive sentence per
function, extracted verbatim from the source and marked `origin: "vendor-docs"`.
Sources and their licenses:

### T-SQL signatures, from MicrosoftDocs/sql-docs (CC BY 4.0)

Derived from the Transact-SQL reference markdown in
[MicrosoftDocs/sql-docs](https://github.com/MicrosoftDocs/sql-docs), (c) Microsoft
Corporation, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Changes were made: the documented syntax notation was mechanically parsed and
transformed into TypeScript signature tables, and the docs table reproduces each
function page's first descriptive sentence (truncated to one sentence, whitespace
collapsed); no other documentation prose is reproduced.

### DuckDB signatures, from duckdb/duckdb-web (MIT)

Derived from the function reference markdown in
[duckdb/duckdb-web](https://github.com/duckdb/duckdb-web), Copyright 2018-2025
Stichting DuckDB Foundation, MIT License.

### PostgreSQL signatures, from the PostgreSQL documentation (PostgreSQL License)

Derived from `doc/src/sgml/func.sgml` of
[postgres/postgres](https://github.com/postgres/postgres) (REL_18_STABLE),
Copyright (c) 1996-2025, PostgreSQL Global Development Group, PostgreSQL License.

### Trino signatures, from trinodb/trino docs (Apache License 2.0)

Derived from the sphinx function reference in
[trinodb/trino](https://github.com/trinodb/trino) `docs/src/main/sphinx/functions`
(release 482), Apache License 2.0. trinodb/trino ships no `NOTICE` file, so there
is no 4(d) attribution to reproduce.

### BigQuery / GoogleSQL signatures, from google/googlesql docs (Apache License 2.0)

Derived from the function reference markdown in
[google/googlesql](https://github.com/google/googlesql) `docs/`, (c) Google LLC,
Apache License 2.0.

### Databricks descriptions, from Apache Spark's Built-in Functions reference (Apache License 2.0)

The databricks docs table's descriptions (origin `"spark-docs"`) are reproduced
from [Apache Spark](https://spark.apache.org)'s generated SQL Built-in Functions
reference (4.0.1), (c) The Apache Software Foundation, Apache License 2.0 —
Spark-authored prose describing the Spark SQL surface Databricks shares.
Databricks-only functions carry no Spark description.

### SQLite signatures and descriptions, from the sqlite.org documentation (public domain)

Derived from the [sqlite.org](https://sqlite.org) function-reference pages (doc
bundle 3.53.3). SQLite's code and documentation are dedicated to the
[public domain](https://sqlite.org/copyright.html); the docs table reproduces one
descriptive sentence per function.

### Databricks and Snowflake signatures, from the vendors' public SQL references

Derived from the Syntax sections of the public SQL language references at
[docs.databricks.com](https://docs.databricks.com) ((c) Databricks, Inc.) and
[docs.snowflake.com](https://docs.snowflake.com) ((c) Snowflake Inc.). These sites
publish no redistribution license; the tables reproduce only the factual call
shape of each function (name, parameter names, arity, optionality), the same facts
any SQL tool documents about a dialect's API surface, and no documentation prose.
The docs tables link each function to its page on these sites; no page text is
reproduced. The same applies to the Redshift
([docs.aws.amazon.com](https://docs.aws.amazon.com), (c) Amazon Web Services) and
MySQL ([dev.mysql.com](https://dev.mysql.com/doc/), (c) Oracle Corporation)
references: links only, no prose. Credited here as sources with thanks.

## Runtime and build dependencies (not redistributed in source)

- **antlr4ng** — the TypeScript ANTLR runtime (BSD-3-Clause). Runtime dependency.
- **antlr-ng** — the pure-TypeScript ANTLR generator used by `npm run gen` to
  produce `src/generated/` (a build product, gitignored). Dev dependency.
Consult each package's own license for the authoritative terms.
