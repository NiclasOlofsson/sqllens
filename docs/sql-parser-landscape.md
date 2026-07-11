# SQL parsers — a state of the union

Which open-source projects actually parse SQL, what they are built on, and where the real work
happens. Written from inside sqllens. Snapshot 2026-07-10; star counts from that day via the
GitHub API.

## The short version

The SQL-parser world is a small number of real parsers with a large cloud of dependents around
them. Almost everything that claims to "parse SQL" on GitHub is a binding, a port, or a feature
bolted onto one of about a dozen parsers that do the actual work.

The load-bearing parsers, the ones others build on:

- libpg_query (C): PostgreSQL's own parser, compiled out of the server source.
- sqlglot (Python): hand-written, 31 dialects, and far more than a parser.
- sqlparser-rs (Rust): the hand-written foundation under most Rust query engines.
- JSQLParser (Java): the JavaCC-generated parser under most JVM SQL tooling.
- python-sqlparse, node-sql-parser, Apache Calcite, sqlfluff, and the ANTLR grammars-v4
  collection round out the set, each anchoring one language ecosystem.
- A few database vendors' internal parsers leak out and become hubs too: TiDB's, Alibaba
  Druid's, CockroachDB's.

Two facts fall out of surveying them. Only sqlglot pairs multi-dialect breadth with real
semantics (transpile, optimize, lineage), and it is a batch library, not an editor front end.
And nothing surveyed pairs multi-dialect breadth, schema-fed semantic analysis, and
error-tolerant editor-grade parsing in one place. That corner is empty, and it is the one
sqllens aims at.

The rest of this document catalogs the field: the hubs, the two ways they are built, the real
independent parsers worth knowing, the semantic tier, and the long tail of ports and bolt-ons.
Appendix A classifies the entire GitHub `sql-parser` topic (147 repos) for completeness; the
note at the end explains why that topic is a poor way to find parsers.

## The load-bearing parsers

These are the parsers with real downstream fan-out. Approach is the single most useful axis:
grammar-generated (a `.y`, `.jj`, or `.g4` file feeds a generator) versus hand-written
(recursive descent or Pratt, coded directly).

| Parser | ★ | Lang | Approach | Dialects | What runs on it |
|---|--:|---|---|---|---|
| [sqlglot](https://github.com/tobymao/sqlglot) | 9,407 | Python | Hand-written recursive descent, lookup-table driven, no generator | 31 | SQLMesh, Apache Superset, Fivetran; the default multi-dialect tool |
| [sqlfluff](https://github.com/sqlfluff/sqlfluff) | 9,802 | Python | Hand-written, dialect-aware | many | The SQL linter; its parser is reused by sqllineage |
| [JSQLParser](https://github.com/JSQLParser/JSqlParser) | 5,950 | Java | JavaCC grammar-generated | RDBMS-agnostic | Most JVM SQL tooling; JSQLTranspiler and JSQLFormatter sit on it |
| [Apache Calcite](https://github.com/apache/calcite) | 5,150 | Java | JavaCC parser + full query planner | ANSI + extensions | Flink, Beam, Hive, Druid query planning |
| [python-sqlparse](https://github.com/andialbrecht/sqlparse) | 4,009 | Python | Hand-written, non-validating tokenizer (not a tree parser) | generic | sql-metadata, parts of sqllineage; a tokenizer that became load-bearing |
| [sqlparser-rs](https://github.com/apache/datafusion-sqlparser-rs) | 3,405 | Rust | Hand-written recursive descent + Pratt core; syntax only, no semantics | many | DataFusion, Polars, PRQL, GlueSQL, GreptimeDB, ParadeDB, and 8 more |
| [libpg_query](https://github.com/pganalyze/libpg_query) | 1,470 | C | PostgreSQL's own bison/flex grammar, compiled from server source | PostgreSQL (exact) | pg_query (Ruby), pg_query_go, pgsql-parser (Node), pglast (Python), DuckDB, pganalyze |
| [node-sql-parser](https://github.com/taozhi8833998/node-sql-parser) | 1,030 | JS/TS | PEG grammar-generated | MySQL, Postgres, and more | The default parser of the Node ecosystem |
| [ANTLR grammars-v4 (sql/\*)](https://github.com/antlr/grammars-v4) | 11,048 | ANTLR | ANTLR4 grammars (source, not a runtime) | T-SQL, MySQL, PLSQL, Snowflake, and more | The community grammar collection many ANTLR parsers fork, sqllens included |
| [tree-sitter-sql](https://github.com/m-novikov/tree-sitter-sql) | 126 | JS/C | tree-sitter incremental GLR grammar | Postgres-leaning | Editor syntax highlighting and structural selection |

And three parsers that are components of much larger products, whose grammars get reused
independently:

| Parser | Host product ★ | Lang | Approach | Reused as |
|---|--:|---|---|---|
| TiDB parser | [pingcap/tidb](https://github.com/pingcap/tidb) 40,268 | Go | goyacc-generated MySQL grammar | blastrain/vitess-sqlparser, minerva, others |
| Alibaba Druid parser | [alibaba/druid](https://github.com/alibaba/druid) 28,176 | Java | Hand-written multi-dialect | ported to D as huntlabs/hunt-sql |
| CockroachDB parser | cockroachdb/cockroach | Go | goyacc-generated PostgreSQL grammar | extracted as auxten/postgresql-parser |

The pattern deep research confirmed across primary sources: grammar-generated single-dialect
hubs (libpg_query from PostgreSQL's grammar, JSQLParser from a JavaCC grammar) fan out into
language bindings and sister tools, while hand-written recursive-descent hubs (sqlglot,
sqlparser-rs) fan out into downstream engines. python-sqlparse is the odd one out and the most
instructive: it is a non-validating tokenizer with no grammar at all, and it still anchors the
most-starred repo in the `sql-parser` topic (sql-metadata) plus part of sqllineage, because
"good enough to split statements and label tokens" covers a lot of real demand.

## Two ways to build a SQL parser

Every parser above sits on one side of a single design line, and the choice drives everything
downstream.

Grammar-generated parsers feed a declarative grammar file to a generator: bison/yacc (PostgreSQL,
TiDB, CockroachDB, Oracle parsers), JavaCC (JSQLParser, Calcite), PEG.js (node-sql-parser), or
ANTLR (the grammars-v4 collection, dt-sql-parser, superior-sql-parser). The grammar is the source
of truth; adding a dialect means editing the grammar. The downside the hand-written camp cites is
speed and error messages.

Hand-written parsers code the recursive descent directly, usually with a Pratt (top-down
operator-precedence) core for expressions. sqlglot and sqlparser-rs both took this route and both
explicitly rejected ANTLR, trading grammar declarativeness for control over speed, backtracking,
and dialect branching in code.

sqllens went the grammar-generated way on purpose, with split ANTLR grammars per dialect. The
reason is the target. For an editor and a debugger, a declarative grammar, a first-class token
stream, and lexer modes matter more than the last increment of parse throughput, and the dialects are
easier to keep honest as one grammar each than as one code path each. The hand-written
hubs optimized for a batch library; sqllens optimizes for a living document.

## Real independent parsers worth knowing

Beyond the hubs, these are projects that write their own parser and are worth knowing, either
because they cover a dialect well or because they are the notable parser in a language. Sorted by
stars. None of these are hubs, but all of them actually parse.

| Parser | ★ | Lang | Approach | Dialect / note |
|---|--:|---|---|---|
| [codemix/ts-sql](https://github.com/codemix/ts-sql) | 3,299 | TypeScript | Type-level, in the type system | A SQL parser that runs entirely in TypeScript types |
| [hyrise/sql-parser](https://github.com/hyrise/sql-parser) | 808 | C++ | Hand-written | Generic SQL, out of the Hyrise research DB, widely embedded |
| [phpmyadmin/sql-parser](https://github.com/phpmyadmin/sql-parser) | 482 | PHP | Hand-written | Validating MySQL parser, battle-tested in phpMyAdmin |
| [marianogappa/sqlparser](https://github.com/marianogappa/sqlparser) | 426 | Go | Hand-written | SELECT parser aimed at querying CSVs |
| [melin/superior-sql-parser](https://github.com/melin/superior-sql-parser) | 416 | ANTLR/Kotlin | ANTLR4 | Multi-DB; extracts metadata, lineage, does permission checks |
| [DTStack/dt-sql-parser](https://github.com/DTStack/dt-sql-parser) | 390 | TypeScript | ANTLR4 | Big-data dialects; the parser under monaco-sql-languages |
| [oguimbal/pgsql-ast-parser](https://github.com/oguimbal/pgsql-ast-parser) | 348 | TypeScript | Hand-written | PostgreSQL, TS-native |
| [bruce-dunwiddie/tsql-parser](https://github.com/bruce-dunwiddie/tsql-parser) | 337 | C# | Hand-written | T-SQL scripts |
| [florajs/sql-parser](https://github.com/florajs/sql-parser) | 306 | JavaScript | Grammar-generated | SELECT to AST and back |
| [auxten/postgresql-parser](https://github.com/auxten/postgresql-parser) | 313 | Go | goyacc (from CockroachDB) | Pure-Go PostgreSQL |
| [ValkDB/postgresparser](https://github.com/ValkDB/postgresparser) | 262 | Go | ANTLR4 | PostgreSQL; extracts tables, columns, joins |
| [AfterShip/clickhouse-sql-parser](https://github.com/AfterShip/clickhouse-sql-parser) | 239 | Go | Hand-written | ClickHouse, typed AST |
| [xnuinside/simple-ddl-parser](https://github.com/xnuinside/simple-ddl-parser) | 221 | Python | Hand-written (parsley) | DDL only, broad dialect coverage |
| [ChangxingJiang/metasequoia-sql](https://github.com/ChangxingJiang/metasequoia-sql) | 190 | Python | Hand-written | Performance-focused Python parser |
| [Vanderhoof/PyDBML](https://github.com/Vanderhoof/PyDBML) | 139 | Python | Grammar-generated (pyparsing) | DBML, not SQL proper, but adjacent |
| [ajitpratap0/GoSQLX](https://github.com/ajitpratap0/GoSQLX) | 105 | Go | Hand-written | Parser plus formatter, linter, security scanner |
| [krasun/gosqlparser](https://github.com/krasun/gosqlparser) | 79 | Go | Hand-written | Simple, readable reference parser |
| [systemxlabs/sqlparser-nom](https://github.com/systemxlabs/sqlparser-nom) | 76 | Rust | Parser-combinator (nom) | A different Rust approach from sqlparser-rs |
| [gwenn/lemon-rs](https://github.com/gwenn/lemon-rs) | 63 | Rust | Lemon generator | SQLite dialect; a coherent multi-repo effort |
| [sad-spirit/pg-builder](https://github.com/sad-spirit/pg-builder) | 59 | PHP | Hand-written | A real PostgreSQL parser under a query builder |
| [akito0107/xsqlparser](https://github.com/akito0107/xsqlparser) | 51 | Go | Hand-written | Port of sqlparser-rs's design to Go |
| [eosphoros-ai/sqlgpt-parser](https://github.com/eosphoros-ai/sqlgpt-parser) | 36 | Python | PLY (yacc) | MySQL and OceanBase, for LLM tooling |
| [jaypipes/sqltoast](https://github.com/jaypipes/sqltoast) | 32 | C++ | Hand-written | ANSI SQL, clean C++ AST |
| [SQLFTW/sqlftw](https://github.com/SQLFTW/sqlftw) | 25 | PHP | Hand-written | Complete MySQL/MariaDB parser (moved to Codeberg) |
| [qzchenwl/hiveql-parser](https://github.com/qzchenwl/hiveql-parser) | 25 | Java | ANTLR (Hive's own) | HiveQL to JSON AST |
| [sjjian/oracle-sql-parser](https://github.com/sjjian/oracle-sql-parser) | 21 | Go | goyacc | Oracle, a rare open Oracle parser |
| [kitta65/bq2cst](https://github.com/kitta65/bq2cst) | 4 | Rust | Hand-written | GoogleSQL/BigQuery to a concrete syntax tree |

The takeaway from this tier: it is fragmented by language, and most entries cover one dialect.
The Python, JS/TS, Go, and Rust ecosystems each grew their own parser rather than binding to a
shared one, which is exactly why sqlglot (which crossed the dialect barrier) became a hub and the
rest did not.

## The semantic tier

Parsing is the floor. The projects that matter to a data engineer do something with the tree:
lineage, schema resolution, type inference, optimization, linting. The consistent finding, in the
topic and out of it, is that these tools borrow a hub parser rather than write one. sqlglot is the
exception that owns its parser end to end.

| Tool | ★ | Does | Parser it uses |
|---|--:|---|---|
| [sqlglot](https://github.com/tobymao/sqlglot) | 9,407 | Transpile, optimize, qualify columns, execute | its own |
| [sqlfluff](https://github.com/sqlfluff/sqlfluff) | 9,802 | Lint with dialect awareness | its own |
| [Apache Calcite](https://github.com/apache/calcite) | 5,150 | Full cost-based query planning and optimization | its own (JavaCC) |
| [reata/sqllineage](https://github.com/reata/sqllineage) | 1,668 | Column-level lineage as a graph | sqlfluff or sqlparse |
| [macbre/sql-metadata](https://github.com/macbre/sql-metadata) | 879 | Extract tables, columns, aliases | python-sqlparse |
| [melin/superior-sql-parser](https://github.com/melin/superior-sql-parser) | 416 | Metadata, table lineage, permission checks | its own (ANTLR) |
| [contiamo/rhombic](https://github.com/contiamo/rhombic) | 47 | Lineage and manipulation | Apache Calcite |
| [modeldba/sql-surveyor](https://github.com/modeldba/sql-surveyor) | 28 | Identify tables, columns, aliases | ANTLR |
| [glue-lab/sqldeps](https://github.com/glue-lab/sqldeps) | 22 | Map SQL dependencies, LLM-assisted | sqlglot |
| [tooptoop4/presto_sql_lineage](https://github.com/tooptoop4/presto_sql_lineage) | 8 | Column-level lineage for Presto views | sqlglot |
| [lpraat/inbq](https://github.com/lpraat/inbq) | 3 | Schema-aware column lineage | BigQuery-focused |

The gap this table makes concrete: the tools with real semantics are single-parser and usually
single-dialect (whatever their one hub supports), and the one tool with breadth and semantics,
sqlglot, is a batch Python library. None of them is built to run on every keystroke over broken
input.

## Ports, bindings, and the long tail

Most of what is left is downstream of the hubs above:

- Language bindings of libpg_query: pg_query (Ruby), pg_query_go, pgsql-parser (Node),
  psqlparse and pglast (Python), pg_query.rs, pg-query-emscripten. None parse Postgres
  themselves; they FFI into PostgreSQL's own parser.
- Bindings and ports of sqlparser-rs: sqloxide (Python), xsqlparser (Go, a re-implementation).
- Ports of sqlglot: sqlglot-go, libsqlglot (C++, claims 40+ dialects), sqlingo.js (TypeScript).
- Repackaged vendor parsers: vitess-sqlparser (Vitess + TiDB), hunt-sql (Druid, to D),
  lacquer (Presto grammar, to Python), auxten/postgresql-parser (CockroachDB, to pure Go).
- Bolt-on features that never parse anything themselves: metadata and table-name extractors,
  formatters, ERD and diagram generators, SQL-over-JSON and SQL-over-Elasticsearch engines,
  query builders, editor integrations.
- Teaching projects: dozens of build-your-own-database repos with a minimal parser that exists
  to feed the engine, not to be reused.

Appendix A shows how heavily one narrow topic tilts toward this long tail.

## The gap sqllens fills

Across the whole survey, one combination is missing: multi-dialect breadth, plus schema-fed
semantic analysis (scope, qualify, infer, lineage), plus error-tolerant editor-grade parsing that
survives half-typed input. The pieces exist, but siloed:

- sqlglot has breadth and semantics but is a batch library, not built to re-parse on every
  keystroke or hand back positioned diagnostics on broken input.
- The grammar-generated hubs are single-dialect and parse-only. libpg_query fails the whole
  buffer on any syntax error, which is why Supabase's Postgres Language Server had to build its
  own error-tolerant layer on top of it. That project and joe-re/sql-language-server are the
  closest editor-focused efforts, and both are single-dialect.
- sqlparser-rs applies no semantics by design.
- The semantic tools each inherit one borrowed parser's dialect and its all-or-nothing parse
  model.

sqllens sits in that empty intersection: per-dialect split ANTLR grammars, a total
`lower()` that never throws on partial input, a first-class token stream, and a dialect-agnostic
semantic layer (scope, qualify, infer, lineage, symbols) over a shared IR, built for an LSP and a
debugger. Nothing surveyed here occupies the same square.

## Appendix A: the `sql-parser` topic, by the numbers

The topic literally named `sql-parser` holds 147 repos (the page banner says 154 to 156, the
usual gap from excluded forks). This is the list in Niclas's original question. Classified, it
breaks down like this:

| Class | Count | Share | What it is |
|---|--:|--:|---|
| Real parser | 43 | 29% | Writes its own SQL-to-tree parser (mostly narrow, WIP, or toy) |
| Bolt-on feature | 42 | 29% | Delegates parsing, adds extraction / formatting / diagramming / a query builder |
| Learning DB engine | 30 | 20% | Build-your-own-database, parser incidental to the engine |
| Analyzer | 11 | 7% | Lineage, schema validation, linting; thin and mostly new |
| Off-topic / dead | 11 | 7% | Mis-tagged, abandoned, or not a SQL parser (a playlist exporter carries the tag) |
| Port of a hub | 10 | 7% | Binding or re-implementation of a parser from the tables above |

Only about a dozen of the 43 parsers are general SQL parsers a serious project would embed, and
all of those are already in the tables above. A topic named for parsers is roughly one-third
bolt-ons and one-fifth database coursework. That is the whole reason the survey above is curated
by hand rather than pulled from a tag. The full 147-row table was cut; the breakdown is the point.

## Note on finding parsers by GitHub topic

Topic search is a bad way to enumerate this field, which is why the survey above is curated
rather than a single query. The topic literally named `sql-parser` holds 147 repos, and its head
is bolt-ons, not parsers (the most-starred entry, sql-metadata, wraps python-sqlparse). The real
parsers tag themselves inconsistently: sqlglot uses `sql` and `parser` and `sqlparser`, JSQLParser
uses `sql` and `parser` and `ast`, and node-sql-parser and python-sqlparse carry no topics at all.
The least-bad single query is the intersection `topic:sql topic:parser` (206 repos), which pulls
the real parsers to the top but still misses the untagged ones and still lets noise in (an IMDb
scraper, a CSV tool). A complete list needs curation, so this document is one. Method: the topic
spine came from `gh search repos --topic sql-parser`; the wider field from `gh search repos
--topic sql --topic parser` plus hand-added hubs; hub facts were cross-checked against primary
sources (repo READMEs, the pganalyze engineering blog, the sqlglot engine post) via a verified
research pass. Star counts and dialect counts drift, and the star counts on TiDB and Druid are
the whole product's, not the parser component's.
