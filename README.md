# sqllens

[![npm version](https://img.shields.io/npm/v/sqllens)](https://www.npmjs.com/package/sqllens) [![license](https://img.shields.io/npm/l/sqllens)](LICENSE)

A TypeScript SQL parser and static analyzer. It parses SQL into a syntax tree
(AST), lowers it to a dialect-neutral intermediate representation (IR), and runs
a semantic layer over that IR: name resolution (scope), schema-fed qualification,
type inference, and column lineage. Give it a
query and it tells you the query's sources, its output columns, their types, and
where each column comes from. The parsers are generated TypeScript on the
[antlr4ng](https://github.com/mike-lischke/antlr4ng) runtime. Dialects covered:
Databricks (Spark SQL), T-SQL, Snowflake, BigQuery (GoogleSQL), Redshift,
PostgreSQL, DuckDB, Trino, SQLite, and MySQL, plus derived engines such as
Athena, Fabric, and MariaDB (see [Dialects](#dialects)).

The front end is error-tolerant and token-first, so the library drives editor
features (completion, hover, diagnostics, go-to-definition) over incomplete,
mid-edit text. See [Editor / language tooling](#editor--language-tooling).

## Guiding principles

Two principles govern every layer of this library, and they are duals of each other:

- **Never wrong.** A wrong answer is worse than no answer. A name, type, or binding
  that cannot be derived from a documented source stays absent or `unknown`; it is
  never guessed. Where a function's return type depends on an argument's value, the
  answer is `unknown`, not a plausible guess. Where a relation cannot be resolved,
  its name is the text the user wrote, never something the library invented.
- **Lossless.** Parsing never discards information the input carried. Every token
  survives with its exact source span (even on broken input), identifiers keep their
  as-written spelling and quoting alongside their folded identity, and what the parse
  knew structurally the IR carries, so no downstream layer has to re-derive it by
  heuristic.

Never wrong constrains what the library claims; lossless constrains what it keeps.
Together they are why analysis results can be trusted in an editor: what you are
shown is derived, and what you wrote is still there.

```bash
npm install sqllens
```

```ts
import { analyze, Schema } from "sqllens";

const schema = new Schema({ orders: { id: "int", total: "decimal" } });
const q = analyze("SELECT total FROM orders WHERE total > 100", "postgres", { schema });

q.diagnostics;                 // [] — names and types check against the schema
q.lineage.originsOf("total");  // → orders.total
```

## Dialects

sqllens implements the major SQL dialects directly, each with its own grammar.
More engines are covered as *derived dialects*: their SQL is already parsed by
one of the primary grammars.

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
| SQLite | — | yes | yes | grammar forked from grammars-v4 `sql/sqlite` (MIT); entry rule `parse` |
| MySQL | MariaDB (partial — ordinary DQL/DML only, MariaDB-only extensions unmodeled) | yes | yes | grammar forked from grammars-v4 `sql/mysql/Positive-Technologies` (MIT); entry rule `root` |

Each grammar began as a fork of the upstream noted above, but most are now far from
verbatim copies. They've had substantial extension and correction, driven by a full
comparison against each dialect's official reference documentation and the reference
corpus extracted from those docs, so they reach well past their fork points.

A **derived dialect** is an engine that has no grammar of its own but whose SQL
the primary grammar already parses, because its SQL is a subset of (or the same as)
the primary dialect's. Microsoft Fabric runs a restricted subset of T-SQL, Amazon
Athena's engine is Trino, and AWS Glue runs Spark. Each one is checked against real
SQL from that engine before it goes on the list.

In code, the `dialect` argument is a plain string, and `resolveDialect` turns an
engine name (or a dialect name) into the dialect that parses its SQL:

```ts
import { parse, resolveDialect } from "sqllens";

// dialect strings: "databricks" | "tsql" | "snowflake" | "bigquery" |
// "redshift" | "postgres" | "duckdb" | "trino" | "sqlite" | "mysql"
parse("SELECT 1", "snowflake");

// engine name → the dialect that parses it
resolveDialect("athena"); // "trino"
resolveDialect("fabric"); // "tsql"
resolveDialect("mariadb"); // "mysql"
```

The semantic layer is dialect-agnostic: it operates on the shared IR and runs
unchanged on every dialect. Only the parse and lower stages are dialect-specific.

## The pipeline

```
parse → lower → resolveScopes → qualify → infer / lineage / symbols
```

Each stage produces one value, and that value is what a specific editor feature
reads from. Only the first two stages, parse and lower, are dialect-specific;
everything after them is shared and runs unchanged across every dialect.

**parse** turns SQL text into a *concrete syntax tree* (CST): the full parse tree,
every token and grammar node exactly as written, nothing dropped or simplified. It
also hands back the token stream and a syntax-error count. The CST is faithful but
verbose and dialect-shaped, so nothing downstream reads it directly. It backs
syntax squiggles (the underline under a parse error) and semantic tokens
(dialect-aware highlighting).

**lower** walks the CST into an *intermediate representation* (IR): a small,
dialect-neutral tree of nodes such as `QueryExpr`, `SelectExpr`, and `Expr` that
mean the same thing whether the SQL came from Snowflake or T-SQL. (In the API this
value is the `ast` field, the *abstract syntax tree*, a cleaned-up counterpart to
the CST.) It also tags each statement with its kind: a query, DML (data
manipulation: `INSERT` / `UPDATE` / `DELETE`), or DDL (data definition:
`CREATE` / `ALTER` / `DROP`). lower never throws, so even half-typed, broken SQL
still yields an IR the rest of the pipeline can run on.

**resolveScopes** builds a symbol table over the IR with no schema required. For
each query scope it works out the visible sources (tables, subqueries, and CTEs; a
*common table expression* is the `WITH name AS (…)` temporary result set), resolves
names against them, and computes the query's output columns. It needs no catalog,
so the features it powers work on any file with zero configuration: go-to-definition,
find-references, and document highlight.

**qualify** is the first stage that takes a *schema*, the catalog of tables and
their column types. With it, qualify expands `SELECT *` into the real column list,
raises unknown-table and unknown-column diagnostics, and binds each column
reference to the source it comes from, with the column's type. This is what turns
on the schema-dependent semantic squiggles (an unknown column can only be flagged
once the schema is known) and answers `bindingOf`, which tells you which source a
given column resolves to.

**infer** computes the type and nullability of every expression, from a bare
column to `a + b`, `COALESCE(…)`, a `CASE`, or a function call. It powers hover
(the type shown when you point at an expression) and inlay hints (inline type
annotations).

**lineage** traces each output column back to the base-table columns it derives
from, through CTEs, subqueries, and joins, and records every hop on the way. It
powers the lineage panel and go-to-origin (jump from an output column to the
physical column it ultimately reads).

**symbols** derives a `Sym` model: every named thing (source, column, CTE),
classified by kind and modifier. It backs the editor outline / document-symbols
list and code-lens annotations.

## Usage

Two ways in: `analyze` for one-shot analysis of a string, and a session for a
document you hold open and edit. Templated SQL (dbt models) is the same API with
one more option; it changes the input, not the shape of what you get back.
For a step-by-step walkthrough of the templated path, from a raw dbt model to
branch variants, see [TUTORIAL.md](TUTORIAL.md).

### One-shot: `analyze`

`analyze` runs the whole pipeline and hands back a result you read directly:

```ts
import { analyze, Schema } from "sqllens";

const schema = new Schema({ t: { a: "int", b: "string" } });
const a = analyze("SELECT a, b FROM t", "tsql", { schema });

a.scopes;                                  // name resolution (ScopeTree)
a.diagnostics;                             // unknown-table / column diagnostics
a.qualification.columnsOf(a.scopes.root);  // * expansion
a.types.typeOf(expr, scope);               // per-expression types
a.lineage.originsOf("a");                  // base-table origins of an output column
a.symbols;                                 // kind × modifier symbol model
```

### A document you keep: the session

An editor holds a file that changes. The entry for that is a session: it parses on
construction, caches per statement, and an edit reuses everything it didn't touch.

```ts
import { SqlSession, Schema } from "sqllens";

const s = SqlSession.create("SELECT amount FROM sales", "databricks", { schema });

// properties — cheap reads of what construction already produced
s.ast;                // the dialect-neutral IR (frozen)
s.tokens;             // the token stream: every token, exact spans — present even mid-edit
s.scopes;             // name resolution; needs no schema

// verbs — parentheses execute a pass (memoized against the schema's version)
s.diagnostics();      // syntax + schema-fed, one document-ordered list
s.lineage();          // column lineage for the output columns
s.deriveSymbols();    // the outline / symbol model

// cursor verbs — offset in, spans out
s.completeAt(14);     // completions at an offset (works on broken, mid-keystroke text)
s.referencesAt(9);    // declaration + every occurrence of the symbol under the cursor
s.typeAt(9);          // inferred type of the expression under the cursor

// edits are immutable: a new session, caches carried over
const next = s.withText("SELECT amount, id FROM sales");
```

The convention throughout: properties are cheap, parentheses do work. Every verb
is a one-line delegation to a free function (`qualify`, `lineage`, `deriveSymbols`,
`referencesAt`, …) that stays exported, so a slim consumer can skip the session,
import only the functions it calls, and bundle nothing else.

### Stage-wise building blocks

Every stage is also its own entry point, and each result is a value you can stop
at or pass to the next; hand a result forward and only the missing steps run:

```ts
import { parse, qualify, lineage, deriveSymbols, toScopes, Schema } from "sqllens";

const { ast, errors, cst } = parse("SELECT a, b FROM t", "snowflake");
// ast = dialect-neutral IR (frozen); cst = the raw antlr tree (escape hatch)

const scopes = toScopes(ast); // idempotent lift
qualify(scopes, schema);   // reuses scopes — never re-parses or re-resolves
lineage(scopes, schema);   // safe on the same scopes, in any order
deriveSymbols(scopes);     // independent results
```

The per-dialect entries (`parseDatabricks` … `parseTrino`, each `lower`, and the
raw `resolveScopes` / `inferType`) stay exported for callers that want a single
stage.

### Templated SQL (dbt models)

A dbt model is not plain SQL; it is minijinja-templated SQL (`{{ ref('orders') }}`,
`{% if %}` …). sqllens parses that raw text natively, without rendering: tags get
exact spans, a `ref` in a FROM slot becomes a real table source that carries its
model name, and everything downstream (scopes, diagnostics, types, lineage,
completion) runs on the templated document unchanged.

Templating is declared, never guessed. You hand the session a template engine; no
engine means plain SQL:

```ts
import { SqlSession } from "sqllens";
import { minijinja } from "sqllens/minijinja"; // its own entry point — plain-SQL consumers never load it

const s = SqlSession.create(modelText, "databricks", {
	templating: minijinja(),
	provider,   // optional — template knowledge, see extension points below
	schema,
});

s.ast;             // IR: {{ ref('orders') }} in FROM is a TableSource named "orders"
s.tokens;          // ONE stream: SQL tokens + template tokens (channel 2, role "minijinja")
s.diagnostics();   // SQL + template + schema-fed, merged, all in document coordinates
s.tags;            // every tag with exact spans (ref / source / macro / var / control)
s.regions;         // {% if %} / {% for %} structure — folding, branch enumeration
s.tagOf(node);     // the tag an IR node came from; nodeOf(tag) goes the other way
```

Why no auto-detection: `{{ … }}` inside a SQL string literal is a template to dbt
and literal text to everyone else. No scanner can tell which was meant, and sqllens
never guesses. The host declares it (file association, language id, or config).
Declaring an engine on a file that turns out to have no tags costs nothing and
changes nothing: the result is byte-identical to a plain parse, with empty template
facets.

Everything works with no provider at all: the shipped defaults answer what they can
(a `ref` is a relation named by its literal argument; `config` renders nothing) and
everything else reports as unknown, never guessed. A provider only makes results
more precise.

### Extension points

sqllens knows SQL and template *syntax*. Everything it cannot know (your catalog,
what your macros expand to, what `var('x')` holds) enters through three interfaces.
All are optional, and every one answers misses the same way: a miss is "unknown",
never a guess, and no diagnostic fires on missing knowledge.

`SchemaProvider` is the catalog: which tables exist, with their column types.
`Schema` is the upfront form (a plain mapping, as in the examples above).
`CallbackSchema` is the lazy form for hosts with a live catalog: sqllens records
what it missed, your `prime()` resolves the misses asynchronously and bumps a
version, and the next read reflects it. An LSP republishes diagnostics on exactly
that signal.

`TemplateProvider` is template knowledge: what template calls *mean*. Subclass
`DefaultTemplateProvider` and override only what your host knows; each method
answers one question:

```ts
class MyDbtProvider extends DefaultTemplateProvider {
	relationOf(call) { /* ref/source → the physical relation, with columns */ }
	valueOf(call)    { /* var/env_var → the scalar type it yields */ }
	shapeOf(call)    { /* a macro's expansion shape: "expr" | "predicate" | "column-list" | "statement" … */ }
	columnsOf(call)  { /* a column-list macro's output columns */ }
}
```

One instance per document. Answers are synchronous, from a warm cache, with the
same miss-recording + `prime()` + version protocol as the schema. The base class
alone is fully functional; it is what the zero-provider examples above run on. The
payoff of each override is direct: `relationOf` turns "`{{ ref('orders') }}` is
exempt from checks" into "`orders` has these columns, and `o.totall` is a real
unknown-column diagnostic"; `shapeOf` makes a macro standing in a statement slot
parse cleanly; `valueOf` gives `{{ var('limit') }}` a type that inference can use.

`TemplateEngine` is template syntax, and is rare. The engine owns how templated
text is parsed; minijinja ships as the only implementation and nearly every
consumer just passes it. Implementing your own (another template language over SQL)
is supported, but it is a contract, not a callback: your result must satisfy the
invariants the conformance gates check. Tokens tile the source byte-for-byte, every
span is in original document coordinates, broken input never throws, and tag-free
text is identical to a plain parse.

## Broken and incomplete SQL

sqllens is error-tolerant by construction, because its first consumer is an
editor and editor input is mid-keystroke most of the time. Parsing broken,
partial, or invalid SQL never throws: syntax errors come back as positioned
diagnostics (line, column, offset, length), ready for editor squiggles, and
the rest of the result stays usable.

```ts
import { parse } from "sqllens";

// mid-edit input: a dangling comma and an unfinished WHERE
const r = parse("SELECT total, FROM orders WHERE", "postgres");

r.errors; // 1 — counted, not thrown
r.diagnostics[0]; // { message: "mismatched input ','…", line: 1, column: 12, offset: 12, length: 1 }
r.ast; // still a usable IR — lower() is total on broken input
r.tokens.length; // 10 — the full token stream, exact spans intact
```

Every downstream pass keeps the same contract: `lower()` yields a flagged IR
instead of throwing, statement-level containment keeps one broken statement
from taking down its neighbors, and the interactive features run on the
broken text directly:

```ts
import { SqlSession, Schema } from "sqllens";

const schema = new Schema({ orders: { id: "int", total: "decimal" } });

// the projection slot is empty — the user just hasn't typed it yet
const s = SqlSession.create("SELECT  FROM orders", "postgres", { schema });
s.completeAt(7); // candidates for the empty slot: total, id, keywords, functions
```

## Editor / language tooling

The front end is error-tolerant and token-first, so it serves editor features
that run on incomplete, mid-edit text. They never need a clean parse:

- `tokenize(sql, dialect)` and `parse(...).tokens` give a first-class token
  stream: every token with its exact span, role, and channel. Available even when
  the parse has errors.
- `lower()` never throws on broken or partial input; you get a flagged `query` IR
  back, so every downstream pass stays total.
- `SqlDocument` is a persistent, immutable, position-addressable per-file model.
  It runs `parse → resolveScopes` once (plus lazy `analyze(schema)`), caches the
  result, and answers `tokenAt` / `nodeAt`. An edit yields a new document; an
  O(log n) `LineIndex` maps positions to offsets.
- `completeAt(doc, offset, schema?)`: scope-aware completion (keywords, columns,
  tables, functions) from an ATN (Augmented Transition Network, the grammar's
  state-machine form) candidate walk over the grammar, our own, with no third-party
  dependency.
- `signatureAt(doc, offset)`: parameter hints from a curated per-dialect
  function-signature table; the long tail degrades to name + active-argument.
- `referencesAt(scopes, offset, schema?)`: every occurrence (plus the declaration)
  of the symbol under the cursor; backs find-references, document highlight, and
  code-lens reference counts.

To tokenize SQL without parsing at all, `tokenize` is lexer-only and works on
any text, including text no parser would accept:

```ts
import { tokenize } from "sqllens";

const tokens = tokenize("SELECT amount FROM sales", "snowflake");
tokens[0]; // { text: "SELECT", start: 0, stop: 5, line: 1, column: 0, role: "keyword", channel: 0, … }
tokens[1]; // whitespace rides the hidden channel: { text: " ", channel: 1, role: "whitespace", … }
```

```ts
import { SqlDocument, Schema } from "sqllens";

const doc = SqlDocument.create("SELECT amount FROM sales", "databricks");
doc.tokens;                       // first-class token stream (spans + roles)
doc.tokenAt(7);                   // token under an offset
const next = doc.withText("SELECT amount, id FROM sales", 2); // immutable edit → new doc
```

## How sqllens compares

The SQL-parser field splits into parse-only libraries and semantic tools bound
to a single borrowed parser. The full survey, with the whole field catalogued,
is in [docs/sql-parser-landscape.md](docs/sql-parser-landscape.md); the short
version against the libraries people usually reach for:

| | Language | Dialect breadth | Semantic analysis | Error-tolerant, editor-grade |
|---|---|---|---|---|
| **sqllens** | TypeScript | Databricks, T-SQL, Snowflake, BigQuery, Redshift, PostgreSQL, DuckDB, Trino, SQLite, MySQL | scope, schema qualification, type inference, column lineage, symbols | yes: parses mid-keystroke input, positioned diagnostics, total pipeline |
| [sqlglot](https://github.com/tobymao/sqlglot) | Python | 31 dialects | transpile, optimize, qualify, lineage | no: a batch library, not built for per-keystroke reparse |
| [node-sql-parser](https://github.com/taozhi8833998/node-sql-parser) | JS/TS | MySQL, PostgreSQL, and more | table/column lists only; no lineage, no types | no |
| [sqllineage](https://github.com/reata/sqllineage) | Python | via sqlfluff's parser | column lineage only | no |
| [libpg_query](https://github.com/pganalyze/libpg_query) | C (bindings) | PostgreSQL, exact | parse only | no: one syntax error fails the whole buffer |

The corner sqllens occupies: multi-dialect breadth, schema-fed semantics, and
editor-grade error tolerance in one TypeScript library. Each piece exists
elsewhere; the combination did not.

## Architecture

One folder per dialect; no shared "core" grammar and no grammar inheritance. Each
dialect is a standalone pair of split `.g4` files (a lexer grammar + a parser
grammar), forked from its best starting point and edited in place. Everything
downstream of `lower` is shared and dialect-neutral.

## Building from source & contributing

`npm install sqllens` needs no build step on your side. To build it yourself from
source, or to work on a grammar, you regenerate the parsers from the `.g4` files
first. [CONTRIBUTING.md](CONTRIBUTING.md) has the setup, the command list, and the
corpus-gate workflow.

## License

MIT. See [LICENSE](LICENSE). The forked grammars under `grammars/` keep their
upstream licenses (Apache-2.0 for Databricks; MIT for T-SQL and Snowflake; BSD-3
for BigQuery and Redshift); see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
