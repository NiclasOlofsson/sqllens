# Tutorial: parsing jinja-templated SQL with sqllens

This guide walks through using the SQL parser together with jinja templating, step by
step. By the end you will parse a raw dbt model, resolve its `{{ ref }}` calls against
your own knowledge, get diagnostics, types and lineage out, and handle `{% if %}`
branches without ever rendering the template.

The examples use a dbt-shaped model, but nothing here requires dbt. sqllens parses the
template syntax (the oracle is minijinja, the templating engine dbt Core uses).
What the template calls mean is knowledge you inject.

## Step 0: install and pick a dialect

```bash
npm install sqllens
```

Every parse names a dialect. Built in: `databricks`, `tsql`, `snowflake`,
`bigquery`, `redshift`, `postgres`, `duckdb`, `trino`. If you only have an engine or
adapter name, `resolveDialect` maps it (`resolveDialect("athena")` returns `"trino"`).

```ts
import { resolveDialect } from "sqllens";

const dialect = resolveDialect("databricks")!; // "databricks"
```

## Step 1: parse plain SQL first

The one-shot entry is `analyze`. It runs the whole pipeline and returns every tier:

```ts
import { analyze, Schema } from "sqllens";

const schema = new Schema({ orders: { id: "int", total: "decimal" } });
const a = analyze("select total from orders", "databricks", { schema });

a.diagnostics;                // [] because the column exists in the schema
a.lineage.originsOf("total"); // orders.total
```

Keep this shape in mind: templated SQL returns the same tiers. The template layer
changes the input, and nothing about what you get back.

## Step 2: parse a raw dbt model

A dbt model is not plain SQL. This does not parse anywhere:

```sql
select o.total, {{ var('bonus') }} as bonus
from {{ ref('orders') }} o
where o.total > 100
```

sqllens parses it natively, without rendering. Templating is declared by handing the
session a template engine. There is no auto-detection: `{{ … }}` inside a string
literal is a template to dbt and literal text to everyone else, and sqllens never
guesses. You know which files are templated; you say so.

```ts
import { SqlSession } from "sqllens";
import { minijinja } from "sqllens/minijinja";

const model = `select o.total, {{ var('bonus') }} as bonus
from {{ ref('orders') }} o
where o.total > 100`;

const s = SqlSession.create(model, "databricks", { templating: minijinja() });
```

The engine lives behind its own entry point (`sqllens/minijinja`), so applications
that never parse templates never load it.

What came back, with zero configuration:

```ts
s.syntaxDiagnostics.length === 0; // the model parses; no rendering happened
s.tags.length === 2;              // the {{ var }} and the {{ ref }}, each with exact spans
s.tags.map((t) => t.kind);        // ["var", "ref"]

// One token stream covering every byte of the original text: SQL tokens on
// channel 0/1, template tokens on channel 2 with role "minijinja".
const jinja = s.tokens.filter((t) => t.channel === 2);
model.slice(jinja[0].start, jinja[0].stop + 1); // the tag text, byte-exact
```

Two things are worth understanding about how this works:

- The engine replaces each tag with a length- and newline-preserving placeholder,
  parses the result with the untouched SQL grammar, and merges the streams. Because
  the fills preserve every coordinate, all spans you ever see point into your original
  text. There is no coordinate mapping to do, ever.
- The parse is total. A half-typed `{{ ref(` never throws; broken tags degrade to
  best-effort nodes plus positioned diagnostics.

## Step 3: the ref became a real table

Look at the parsed structure (`s.ast` is the dialect-neutral IR):

```ts
const body = s.ast.body;
if (body.kind === "select") {
	const src = body.from[0];
	src.name;      // ["orders"], the dbt-logical name as written in the tag
	src.template;  // { kind: "ref", span: …, call: { name: "ref", args: ["orders"] } }
}
```

`{{ ref('orders') }}` in a FROM slot lowers to a first-class table source named
`orders`, carrying a marker that says where it came from. The whole semantic layer
(name resolution, qualification, types, lineage) binds it like any other table.

To go from a node back to its tag, or from a tag to its node, use the joins on the
session instead of span arithmetic:

```ts
const tag = s.tagOf(src);      // the ref TagNode (name spans, argument spans, …)
s.nodeOf(tag) === src;         // and back
s.diagnosticsOf(tag);          // diagnostics attributed to this tag, [] here
```

## Step 4: inject what the template means

So far sqllens knows the template's syntax. It does not know what `ref('orders')`
resolves to or what type `var('bonus')` has. That knowledge is yours, and it enters
through a `TemplateProvider`. Subclass the shipped default and override only what you
know:

```ts
import { DefaultTemplateProvider, Schema, SqlSession } from "sqllens";
import type { ResolvedRelation, TemplateCall, ValueType } from "sqllens";
import { minijinja } from "sqllens/minijinja";

class MyProvider extends DefaultTemplateProvider {
	relationOf(call: TemplateCall): ResolvedRelation | undefined {
		// ref('orders') resolves to the physical relation and its columns
		if (call.name === "ref" && call.args[0] === "orders") {
			return {
				nameParts: ["analytics", "orders"],
				columns: [
					{ name: "id", type: "int" },
					{ name: "total", type: "decimal" },
				],
			};
		}
		return undefined; // unknown stays unknown; never guess
	}
	valueOf(call: TemplateCall): { type: ValueType } | undefined {
		if (call.name === "var" && call.args[0] === "bonus") return { type: "integer" };
		return undefined;
	}
}

const provider = new MyProvider();
const s = SqlSession.create(model, "databricks", {
	templating: minijinja(),
	provider,          // parse time: fills and markers
	schema: provider,  // analysis time: column and type resolution
});
```

The provider holds two seats. As `provider` it is consulted at parse time (its
`shapeOf` decides how a macro call is placeholder-filled). As `schema` it is consulted
during analysis: a `TemplateProvider` is also a `SchemaProvider`, so the same instance
resolves templated relations to columns and types. Misses are recorded, an async host
resolves them in `prime()`, and the version bump invalidates every cached answer. That
is the same lazy-warm protocol a plain catalog uses.

The zero-provider behavior is deliberate and safe: everything still parses, `ref`
relations keep their logical names, unknown stays `unknown`, and no diagnostic ever
fires on missing knowledge.

## Step 5: run the analysis

With knowledge injected, the ordinary verbs answer over the templated document:

```ts
s.diagnostics();
// [] since o.total resolves through the provider's columns.
// Misspell it (o.totall) and you get a real unknown-column diagnostic,
// positioned in your original text.

const off = model.indexOf("o.total") + 2;
s.typeAt(off);            // { kind: "scalar", name: "decimal" }

s.lineage().originsOf("total");
// the templated source's total column

s.deriveSymbols();        // outline: sources, columns, aliases, spans document-true
```

The rule across the whole surface is "never a wrong answer". Where something cannot be
proven (no provider, an unregistered function), you get `unknown` or an empty answer
instead of a guess.

## Step 6: branches, `{% if %}` without rendering

Add control flow:

```ts
const branchy = `select
  {% if is_incremental() %}incremental_col{% else %}full_col{% endif %},
  shared_col
from {{ ref('orders') }}`;

const s = SqlSession.create(branchy, "databricks", { templating: minijinja() });
```

sqllens never evaluates conditions. In an editor the user edits every branch, whoever
wins at runtime, so you get three views of the branching instead of one rendered
winner.

The primary parse keeps all text live. Every tag in every branch is in `s.tags`, and
`s.regions` holds the `{% if %}` structure (arms with body spans; this is what folding
uses).

Coherent per-branch variants realize one branch choice each, as a valid parse of its
own, with every span still pointing into the original text:

```ts
s.variants.length;   // 2, the if arm and the else arm
for (const v of s.variants) {
	v.doc();           // a full document for that branch: ast, tokens, analysis
}
s.variantAt(branchy.indexOf("full_col"));  // the variant where that byte is live
```

An `{% if %}` with no `{% else %}` also gets a variant with the body absent, so
"optional column not present" is a case you can analyze.

Union views aggregate across all variants, deduplicated by span and identity, so you
never reason about branches yourself:

```ts
s.unionOutputColumns().map((c) => c.name).sort();
// ["full_col", "incremental_col", "shared_col"], all three, shared_col exactly once

s.unionSymbols();      // includes symbols that exist only inside one branch
s.unionDiagnostics();  // a syntax error inside the else branch surfaces here
s.unionCtes();         // per-CTE column unions, keyed by declaration
```

Two known limits, both stated in the members' own doc comments: BigQuery pipe-syntax
bodies and multi-statement documents answer `[]` from the two scope-level unions for
now.

## Step 7: edits

Sessions are immutable snapshots. An edit produces a successor, and unchanged parses
are reused through a content-addressed cache:

```ts
const next = s.withText(branchy + "\nlimit 10");
// next is a new session; s is untouched and still fully usable
```

If your provider learns something new (a warehouse describe landed), `prime()` bumps
its version and the next session rebuild re-parses with the better knowledge. Cached
entries from the old version simply stop matching.

## Step 8: editor features at a cursor

Everything an editor needs is offset in, spans out, total on broken input:

```ts
s.completeAt(offset);    // completions, works mid-keystroke on invalid text
s.signatureAt(offset);   // parameter hints inside a call
s.referencesAt(offset);  // declaration + all occurrences of the symbol under the cursor
s.lineageAt(offset);     // the per-hop lineage spine from the expression under the cursor
s.tokenAt(offset);       // the token (channel-aware data is on the token itself)
s.nodeAt(offset);        // the smallest IR expression + its scope
```

All spans carry both absolute offsets (`start`/`end`, end-exclusive, so you can slice
your text directly) and line/column positions.

## Where to look next

| You want | Read |
|---|---|
| the API reference shape | [README.md](README.md), the usage chapter |
| the template front end's design | [docs/minijinja-front-end.md](docs/minijinja-front-end.md) |
| which IR fields keep identifier quoting | [docs/identifier-delimiter-contract.md](docs/identifier-delimiter-contract.md) |
| the engine contract (bring your own template language) | `TemplateEngine` in the main barrel; the conformance suite in `tests/template.engine-contract.test.ts` |

The division of labor is simple: sqllens owns everything that understands the
template, and you own what the template means plus whatever you build on the answers.
