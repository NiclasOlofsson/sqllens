# Type polymorphism: what "templated" means, per dialect

A function's return type can relate to its arguments in a few distinct ways. SQL
engines each invented their own vocabulary for the same handful of type-theory
ideas, which is why "templated", "polymorphic", `ANY TYPE`, and `ANYELEMENT` all
turn up meaning roughly the same thing. This page names the concepts once, maps
each dialect's term onto them, and shows how our inference layer
(`src/infer/`) represents each one.

The whole reason this matters: the inference registry (`src/infer/functions.ts`,
`bigquery.ts`, `snowflake.ts`) is a table of function return types. Most entries
are a single fixed type. The interesting ones are the functions whose return type
is *computed from* the arguments; those are the "templated" / generic functions,
and they are why a registry entry is a `FnRule = (args: Type[]) => Type` (a
function) rather than a constant.

## The five cases

### 1. Monomorphic: fixed return type

The return type is the same no matter what you pass: `LENGTH(x)` is always
`INT64`, `CURRENT_DATE()` is always `DATE`. No type theory needed; it's an
ordinary typed signature.

- Every dialect: just the documented return type.
- Our code: a constant rule (`() => INT64`, written `konst(INT)`).

### 2. Parametric polymorphism: return type *follows* the argument type

This is **generics**. `SUM(int) → int`, `SUM(double) → double`; `COALESCE(a, b)`
returns the common type of its arguments; `ARRAY_AGG(x)` returns `ARRAY<type of
x>`. One signature, written once, that works across all element types and carries
the type through. In C# this is `T Sum<T>(IEnumerable<T>)` with type inference
binding `T` from the call.

Dialect names for declaring it:

| Dialect | What it's called | How you write it |
|---|---|---|
| PostgreSQL / **Redshift** | **polymorphic types** / polymorphic functions | the `anyelement`, `anyarray`, `anycompatible`, `anyenum` pseudo-types; Redshift UDFs use `ANYELEMENT` |
| **BigQuery** / ZetaSQL | **templated** function parameters | argument type `ANY TYPE` (and `ANY TABLE` for table functions) — this is the "template" |
| **Databricks** / Spark | (no declarable keyword) | built-ins are polymorphic via the analyzer's type-coercion rules; SQL UDFs take concrete types |
| **T-SQL** | (no declarable keyword) | built-ins like `COALESCE`/`MAX` are polymorphic; result type from data-type precedence |
| **Snowflake** | (no declarable keyword) | built-ins are polymorphic; SQL UDF parameters take concrete types |

So "templated" (BigQuery's word) and "polymorphic" (Postgres/Redshift's word) and
"generic" (the type-theory word) are the same idea. BigQuery is the only one of
our dialects that lets *you* declare it on a user function, with `ANY TYPE`;
the others expose it only through their built-ins.

- Our code: the rule reads the argument types and returns one of them, or a
  type derived from them:
  - `firstArg = (args) => args[0]`: "same type as input" (≈ `anyelement →
    anyelement` / `ANY TYPE → ANY TYPE`)
  - `common = (args) => commonType(args)`: the shared supertype (`COALESCE`,
    `GREATEST`)
  - `arrayOfFirst`, `elementOf`, `mapValues`: carry the type *through* a
    container (`ARRAY_AGG`, array subscript, `MAP_VALUES`)

### 3. Ad-hoc polymorphism: overloading

Several distinct signatures share one name, and the engine picks by argument
types. `CONCAT(string…) → string` but `CONCAT(array…) → array`. Unlike generics,
the cases are enumerated, not parametric. Every dialect supports function
overloading; this is *not* the same as case 2 even though both are loosely called
"polymorphism".

- Our code is a rule that branches on argument *kind*:
  `concatRule = (args) => args[0]?.kind === "array" ? args[0] : STRING`.

### 4. Implicit coercion: operands collapse to a supertype

`int + double → double`; a `UNION` of `int` and `decimal` columns yields
`decimal`. Not generics: there's a fixed precedence lattice deciding which type
wins, and the narrower operand is converted up. Type-theory calls this coercion;
it is the operator-level cousin of case 2.

| Dialect | What it's called |
|---|---|
| T-SQL | **data type precedence** |
| Databricks / Spark | **type coercion** / the type-precedence list |
| PostgreSQL / Redshift | type resolution (UNION/CASE/operator rules) |
| Snowflake / BigQuery | implicit conversion / **supertype** |

A concrete divergence we model: integer division. `10 / 3` is `double` in Spark
and BigQuery, `int` (truncated) in T-SQL, `decimal` in Snowflake. That is the
`division: "float" | "integer" | "decimal"` field on `InferDialect`
(`src/infer/dialect.ts`).

- Our code: `commonType` / `coerce.ts` for the supertype, plus the per-dialect
  `division` strategy.

### 5. Value-dependent: not statically typable

The return type depends on the runtime *value*, not the static type of any
argument: `JSON_VALUE(doc, '$.path')` is whatever sits at that path; reading a
field out of a dynamically-typed column could be anything. No table or rule can
answer this without executing the query. In C# the honest analogue is `dynamic`.

The dialects' escape hatch is a dynamic type you opt into:

| Dialect | Dynamic type |
|---|---|
| T-SQL | `sql_variant` |
| Snowflake | `VARIANT` |
| BigQuery | `JSON` (and `ANY TYPE` results that don't resolve) |
| Redshift | `SUPER` |
| PostgreSQL | `jsonb` |

- Our code: these return `UNKNOWN`. That is the inference contract: a
  function we can't type yields `unknown`, **never a wrong guess**. It is why the
  registry can ship incomplete and just grow: every added rule is a strict
  improvement, and the value-dependent cases stay `unknown` by nature, not by
  neglect.

## Why the registry is a function, not a table of strings

Putting cases 1–5 together: a registry keyed `name → fixed type string` could
only express case 1. Because we need cases 2–4 (and need case 5 to fall through to
`unknown`), each entry is a `FnRule`: a small function over the argument types.
A monomorphic function is just a `FnRule` that ignores its arguments. So the
single shape covers "always returns X", "returns the same type as its input", and
"returns the supertype of its inputs" uniformly.

This is the same move a compiler makes for a generic method: the signature is
parameterized, and the concrete return type is computed at the call site from the
argument types. Our `inferType` walk *is* that computation, done over the parse
tree instead of by a type checker.
