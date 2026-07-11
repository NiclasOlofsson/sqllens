# The minijinja front end — design

sqllens parses raw jinja-SQL (dbt templates) natively: one unified token stream, first-class jinja
tag nodes, and macro expansions as typed holes. A dbt model goes in as written (`{{ ref('orders') }}`,
`{% if %}` and all), and the whole pipeline (tokens, IR, scopes, diagnostics, types, lineage,
completion) runs on the templated document without rendering it.

The grammar oracle is **minijinja** (the Rust engine dbt Fusion uses, not Jinja2; they differ on
division semantics, import caching, and a few edges). Its syntax reference is authoritative for what
we accept.

## The architecture, in three lines

- Two paths. At edit time (every keystroke) sqllens parses the raw jinja-SQL; a macro expansion
  is a typed hole; nothing ever renders. The user gets structural feedback on what they wrote.
  At validation time (on demand: does the assembled query run) the host renders via real dbt and
  hands the compiled SQL back to sqllens as plain SQL. sqllens is the parser for both artifacts;
  rendering is out of sqllens.
- One seam. A pull-callback template provider (`DefaultTemplateProvider`,
  `src/qualify/template-provider.ts`): sqllens asks what a template call means, the host answers
  from its dbt knowledge by overriding granular virtuals, and the shipped defaults fill every gap.
  Consults are synchronous from a warm cache; `prime()` is the one async seam.
- One razor. In-text structural work is sqllens's: parse, tokens, tag-AST, typed holes,
  control-flow regions, variant expansion. Out-of-text dbt knowledge is the host's: macro output
  shape, loop collections, what ref/source/var mean, rendering.

Permanently out of sqllens: rendering and execution, variant combinatorics evaluation (which branch
*runs*), project modeling, any I/O. sqllens knows template *syntax* only; it stays dbt-unaware.

## The mechanism — a pre-lexer, not another dialect

Jinja is orthogonal to the SQL dialect axis (any dialect can be templated), so the front end is a
pre-stage that wraps `parse(sql, dialect)`. It is not a `DIALECTS` entry, and it is not woven into
the SQL grammars: the tag front end is an isolated module with its own gates, and the SQL grammars
are untouched.

The pipeline for `parseTemplated(text, dialect)`:

1. Segment the raw text over the *outer* jinja language into runs of literal SQL text and jinja tags
   (`{{ … }}` expression, `{% … %}` statement, `{# … #}` comment, each with the whitespace-control
   variants `{{- -}}` / `{%- -%}` / `{#- -#}`). Jinja is the outer language: a `{{ … }}` inside what
   looks like a SQL string literal *is* a jinja tag (dbt renders into SQL strings:
   `WHERE n = '{{ var("x") }}'` templates the string content). The segmenter respects only jinja's
   own nesting — `{% raw %}…{% endraw %}` (contents literal, no tags), `{# … #}` comments, and
   string literals inside a tag's expression (`{{ ref('a}}b') }}`: the `}}` inside the string is not
   a close), never SQL string or comment boundaries. Segmentation is driven by one whole-document
   tokenization from the island lexer itself (`grammars/minijinja/MinijinjaLexer.g4`: default-mode
   text, tag interior modes, and a `RawBody` mode that spans raw blocks), so there is a single
   definition of what a jinja tag is and raw-block semantics are oracle-true (a raw block ends at
   the *first* `{% endraw %}`, even inside what looks like a quoted string).
   `tests/minijinja.segment-golden.test.ts` locks the segmenter's output byte-for-byte.
2. Substitute each tag with a placeholder in a length-preserving, newline-preserving copy of the
   text that feeds the untouched per-dialect SQL lexer. Every placeholder occupies the exact
   character range of the tag it replaces and preserves the count and position of every `\n`, so
   every antlr `start/stop/line/column` the SQL lexer produces is already in original document
   coordinates: no span remap for SQL tokens outside tags. The fill is chosen per tag (§ The hole):
   whitespace for tags that emit no SQL, an identifier-shaped fill for value slots, or a
   shape-valid SQL fragment when the provider knows the macro's expansion shape. Identifier fills
   are ordinal-headed (`j` + base35(tag ordinal) + `j`-padding, the ordinal alphabet excluding
   `j`), so two same-length tags never fill byte-identically; name-keyed consumers (projection
   names, alias resolution, variant merges) rely on that uniqueness.
3. Lex/parse the placeholder text with the existing per-dialect `parse` / `tokenize` — grammars
   untouched.
4. Merge into one source-ordered `Token[]`: the SQL tokens (channels 0/1, original coordinates)
   plus the jinja tokens (channel 2, role `"minijinja"`) from the island lexer, interleaved by
   offset. The merge happens once, on the result, outside any lazy token getter.
5. Parse the tag interiors with the standalone jinja grammar into the tag-AST nodes (§ R2).
6. Total, error-tolerant: a half-typed `{{ ref(` never throws, per the same mandate as `lower()`'s
   totality on broken SQL. A malformed tag yields a best-effort node and a positioned diagnostic,
   never an exception.

### The grammar — `grammars/minijinja/` (standalone split pair)

`MinijinjaLexer.g4` + `MinijinjaParser.g4`, hand-authored (no upstream ANTLR jinja grammar exists),
generated to `src/generated/minijinja/` by the same `tools/gen.mjs` as every dialect.

- The lexer is island-mode, patterned on the postgres dollar-quote precedent: a default mode emits
  raw-text tokens and, on an opening delimiter (`{{` / `{%` / `{#`, optionally `-`), pushes the
  matching interior mode (expression / statement / comment); the closing delimiter pops.
  `{% raw %}` pushes a mode that matches only `{% endraw %}`. Interior modes lex the jinja
  expression tokens: identifiers, strings, numbers, operators, `|`, `~`, `.`, brackets, parens,
  commas, and the keywords (`and/or/not/in/is/if/else/for/set/…`).
- The parser structures what the tag-AST contract needs: call expressions (`name(args)`,
  `pkg.macro(args)`, nested `outer(inner(…))`, string-literal args, dotted names, keyword args
  `k=v`, top-level-comma argument splitting with nested parens respected) and the statement-tag
  keywords (`if/elif/else/endif`, `for … in … [if …]`, `set`, `macro`, `endX`, …). The full jinja
  expression language (filters, tests, arithmetic, `~`, conditional expressions, slices,
  lists/dicts/tuples) is tolerated opaquely: lexed onto the jinja channel and captured as tag
  text, structured only as far as consumers need.

### The hole — typed, shape-filled, never rendered

A macro can expand to arbitrary SQL: a column list, a whole predicate, a join, a CTE. sqllens never
renders it; the tag parses as a *hole* whose fill keeps the surrounding SQL parse valid.

- A call whose leading name is a no-output builtin (`config`, `docs`, `print`, `log`, `return`,
  `exceptions` — the dbt builtins that emit no SQL text) fills as newline-preserving whitespace and
  vanishes cleanly, whatever the slot. This knowledge lives in `DefaultTemplateProvider` (shape
  `"nothing"`), not hardcoded in the segmenter.
- `{% stmt %}` and `{# comment #}` tags fill as whitespace: no SQL output.
- Any other `{{ expr }}` fills as a single identifier-shaped placeholder by default — valid wherever
  an identifier or value can appear, which covers the common cases (`FROM {{ ref('x') }}`,
  `SELECT {{ var('c') }}`).
- When the provider answers `shapeOf` for a macro call, the fill upgrades to a minimal shape-valid
  SQL fragment: `statement`/`relation` → `SELECT 1` (fits both a standalone statement slot and a
  `(…)` CTE/subquery body), `predicate` → `1=1`, `column-list` → `1`, `expr` → the identifier fill.
  The fragment is placed into the tag's first newline-free window that fits (so multi-line
  whole-model tags shape too), and the rest of the range pads with spaces, every original `\n`
  kept at its offset. The coordinate invariant is unchanged.
- Two guards keep shaping never-worse than the default. The *fit guard*: if the fragment cannot fit
  before the tag's first `\n` and within its length, that tag falls back to the positional default.
  The *slot guard*: `shapeOf` is answered by name (synchronous, position-blind), so
  `statement`/`relation` shaping is skipped when the tag directly follows
  `FROM`/`JOIN`/`,`/`WHERE`/`AND`/`OR`/`ON`/`HAVING`/`WHEN` (whitespace-skipping, with
  already-blanked tags reading as whitespace) — slots where `FROM SELECT 1` would break while the
  identifier fill parses. It is a blocklist, so shaping only avoids slots where it provably broke;
  admitted slots (start of body, `;`, `(`, after `)`, set operators) shape freely. Pinned by
  `tests/minijinja.expansionshape.test.ts`.
- A shaped fill is still a hole, not the macro's output: the IR and tokens keep the tag flagged,
  and the real expansion belongs to validation-time rendering (the two-path model).

An unknown macro call in a slot the identifier fill cannot satisfy (an operator position, a strict
column-count context) does not parse cleanly with a zero provider; the shaped hole exists exactly
for that class, and the host upgrades per-macro (positional guess → macro signature → real render
of that one macro) with sqllens frozen across the gradient.

## R1 — the unified token stream

`parseTemplated(text, dialect)` / `tokenizeTemplated(text, dialect)` return one flat, source-ordered
`Token[]`: SQL tokens (channels 0/1, original coordinates via the length-preserving placeholders)
plus jinja tokens (channel 2, role `"minijinja"`). `Token.channel` was already an int, so channel 2
is additive with zero type churn, and `document.tokenAt` skips `channel !== 0`, so existing
default-channel consumers ignore jinja tokens for free. `TokenRole` carries the `"minijinja"`
member (a closed union: every exhaustive role `switch` was revisited in the same change). Tags
spanning newlines carry correct multi-line spans.

## R2 — the tag-AST span contract

The ref/source/macro-call nodes (`src/minijinja/tag-ast.ts`), with a span for every field below
(sqllens convention: 1-based line, 0-based column, 0-based offsets). These spans are the hard
contract: host providers position hover, rename, and signature help exactly on them.

- ref node: `model` (string-literal content, quotes excluded); the span of the `ref(` call;
  `modelSpan` (model-name content, quotes excluded); `tagSpan` (the whole `{{ ref(…) }}` including
  delimiters).
- source node: `sourceName`, `tableName` (both string contents); `sourceNameSpan`,
  `tableNameSpan` (quotes excluded); `tagSpan`.
- macro-call node (the richest — it drives signature help): `name` (bare macro name) + `nameSpan`;
  `packageName?` + `packageSpan?` (for `pkg.macro(…)`); `tagSpan` (the enclosing `{{ }}` or
  `{% %}`); `argsSpan` (opening-paren offset to closing-paren exclusive end); `args: { span }[]` —
  per-argument spans in source order, top-level-comma split with nested parens respected,
  supporting `outer(inner(…))` and `pkg.macro(…)`.
- var/env_var/config recognition: `config/docs/print/log/return/exceptions` produce no SQL output;
  `var/env_var` produce a value. The classifications survive as node kinds and feed the provider's
  shape and value answers.

`PartSpan` (`src/ir/part-span.ts`) is the span carrier. Tag nodes are additive: they ride the
templated result and the document model as another cached artifact alongside tokens/cst/ast, not a
change to the SQL IR.

## R3 — templated refs as first-class FROM nodes

`{{ ref('x') }}` / `{{ source('a','b') }}` in a FROM/JOIN slot becomes a real `TableSource`
carrying its tag, so scope, qualify, lineage, and references see the model, not the placeholder.
The design rides two existing invariants (scope binds a `TableSource` purely by `name`; the IR is
frozen after `lower()`), so the downstream pipeline works unchanged.

- IR (additive): `TableSource.template?: TemplateSourceInfo`, declared in `src/ir/ir.ts` (the IR
  never imports `src/minijinja`): `{ kind: "ref" | "source" | "macro"; span: PartSpan;
  opaque?: true }` — the tag's kind, the whole-tag span in document coordinates, and the opacity
  verdict. Consumers needing the full `TagNode` correlate by span with `parseTemplated().tags`.
- Name substitution is literal-only, never-wrong: `ref('x')` → `name: ["x"]`;
  `source('a','b')` → `name: ["a","b"]` — the dbt-logical names as written in-text. A macro or
  computed tag in a FROM slot keeps the placeholder name and gets `opaque: true`: its output
  relation is undeterminable without provider knowledge. (The tag parser's literal-string guard
  guarantees a `ref`/`source` node carries only literal names.)
- The transform (`src/minijinja/apply-tags.ts`): post-lower, `applyTemplateTags(ast, tags)` walks
  the IR (bodies, CTEs, sources, joins, subqueries, pipe stages) and correlates by *containment* —
  a `TableSource` whose first name token's offset lies inside a tag's `tagSpan` (containment, not
  equality: a multi-line expression tag fills as one placeholder identifier per line) — rebuilding
  with structural sharing (new objects only on changed paths; frozen subtrees shared) and
  re-freezing. `parseTemplated().sql.ast` *is* the transformed IR.
- Qualify: a templated source resolves through the provider when it can (§ The seam); when the
  provider has no answer, the source is exempt from unknown-table and unknown-column diagnostics —
  its physical relation is out-of-text dbt knowledge, and a diagnostic against the dbt-logical name
  would violate never-wrong. Scope still binds the substituted name, so `orders.col` qualifies,
  lineage origins report `orders`, and references/documentHighlight work with zero changes to those
  passes.

## R4 — control-flow regions + template symbols

- Control-tag enrichment (additive on the `TagNode` union): the `control` variant carries
  `keyword?` (`if`/`elif`/`else`/`endif`/`for`/`endfor`/`set`/`macro`/`endmacro`/…), and `name?` +
  `nameSpan?` (the `set` target, `macro` name, or `for` loop variable), extracted from the tolerant
  statement-tag parse.
- Regions (`src/minijinja/regions.ts`): `templateRegions(tags, text?)` stack-pairs control tags
  into a tree — `TemplateRegion { kind: "if" | "for" | "macro"; arms: TemplateArm[]; span }`,
  `TemplateArm { keyword; tagSpan; bodySpan; children }` (an arm's body runs from its tag's end to
  the next arm or close tag's start). Tolerant: unbalanced input yields best-effort regions, never
  a throw.
- Symbols: `templateSymbols(tags)` → `TemplateSymbol { kind: "set" | "macro"; name; nameSpan;
  span }` — go-to-definition on `{% set %}` / `{% macro %}`. Both ride the templated result as
  `regions` / `symbols`.

## Variant realization

For the editor, sqllens enumerates every `{% if %}/{% elif %}/{% else %}` branch *structurally*,
with no condition evaluation: the user edits every arm regardless of which one runs. Each variant
is a coherent valid parse, preferred over a single merged region tree (a merged tree with two
alternative WHEREs is incoherent and can only be queried by byte range).

The enumeration is arm-coverage, not cross-product: variant 0 is all-defaults, then one variant per
non-default arm — linear, `1 + Σ(arms−1)`, no combinatorial explosion. The load-bearing guarantee
is that every text region is live in exactly one variant, so the mechanism is ancestor-path
activation: a variant for (region R, arm k) activates arm k of R and, for every ancestor region on
R's path to the root, the arm that *contains* R; every non-ancestor region takes its first arm.
Pinning ancestors keeps a nested arm reachable where a naive "all other regions take arm 0" would
blank the parent and silently drop it. A `{% for %}` contributes no extra variant: its default is
the representative single iteration, the body parsing in place; a literal collection (`[1,2,3]`)
expands directly, and an external collection defaults to the single representative iteration unless
the provider supplies it.

A variant is realized by whitespace-blanking the inactive arms' body ranges over the original text
(newline-preserving, coordinates intact) and feeding `parseTemplated`. Results are lazy:
`TemplateVariant.parse()` is memoized, and `TemplateVariant.text()` exposes the realized blanked
source, memoized separately so reading the text never forces a parse. The primary `parseTemplated`
result stays all-text-live; variants are the additive coherent-arm API
(`templateVariants(text, dialect)`).

## The seam — TemplateProvider

Everything sqllens cannot know from the text — the catalog behind `ref`/`source`, what `var('x')`
holds, what a macro expands to — enters through one injected provider
(`src/qualify/template-provider.ts`). It generalizes the schema seam: template calls are to the
template layer what tables are to SQL, external catalog knowledge behind a pull interface.

- `DefaultTemplateProvider` is a shipped, concrete default designed for inheritance: fully
  functional with zero consumer input, composed of granular overridables
  (`relationOf` / `valueOf` / `shapeOf` / `columnsOf` / `collectionOf`), so a host overrides only
  what it knows. The shipped defaults: `ref`/`source` are relations logically named by their
  literal args; `env_var` is a string value; the no-output builtins are shape `"nothing"`.
- `expansion(call: TemplateCall): ResolvedExpansion | undefined` is the one engine consult.
  `TemplateCall` = name + package parts + literal args (quote-stripped; computed → null) + kwargs.
  `ResolvedExpansion` = shape / relation / value (a neutral type union) / columns / collection;
  an explicit shape wins, else derived: relation → `"relation"`, columns → `"column-list"`,
  value → `"expr"`.
- Consults are synchronous, per-document instances, from a warm cache. Misses are recorded, one
  coalesced `prime()` resolves them asynchronously, and a version bump invalidates downstream
  memos — the same miss → `prime()` → version protocol as `CallbackSchema`, so an LSP republishes
  diagnostics on exactly that signal.
- Consumption is uniform across the pipeline: the segmenter consults `expansion()` for every
  expression tag (fills); apply-tags attaches the call to every template marker (table sources and
  the scalar-slot markers on column expressions); and qualify, infer, nullability, and resolve all
  route marked nodes through the shared template-aware column resolver
  (`src/qualify/relation-columns.ts`), so `{{ ref('orders') }}.total` types (hover and inlay
  hints included) from a warm provider's relation columns, and a real unknown-column diagnostic
  fires only when the provider positively returned columns and the column is absent.
- Never-wrong throughout: a provider miss means "unknown", never a fabricated relation, column, or
  type, and no diagnostic fires on missing knowledge. A zero-provider run parses everything the
  defaults cover and is byte-identical to the no-provider result.

Still open on the seam: `valueOf` beyond scalar-slot typing, and provider-supplied loop
collections (`collectionOf` consumers).

## The engine contract — TemplateEngine and the subpath

The front end is an injected engine. The neutral contract (`TemplateEngine`,
`TemplatedParseResult`, `TemplatedParseOptions`) lives in `src/template/engine.ts` and stays on
the main barrel; the engine itself (`minijinja()`, `parseTemplated`, `tokenizeTemplated`, the
tag-AST, regions, variants) ships behind the `sqllens/minijinja` subpath
(`src/minijinja/index.ts`), so plain-SQL consumers never load the island grammar. The engine owns
the whole templating strategy and calls the core `parse()` as a primitive. Its result contract is
enforced by the runnable conformance suite in `tests/template.engine-contract.test.ts`: tokens tile
the source byte-for-byte, every span is in original document coordinates, broken input never
throws, tag-free text is identical to a plain parse, and no fill text leaks through any public
name path. Implementing another template language over SQL means satisfying that same suite.

## The document model — templating is declared, never guessed

`SqlDocument.create(text, dialect, { templating: minijinja(), provider })` — templating is an
engine option on the one document entry, not a separate factory, and `SqlSession` passes it
through. A templated document rides the single-cell path (dbt models are single-statement;
control regions can straddle statement boundaries, so cell-splitting templated text is a tracked
deferral), exposes the engine result as `doc.templated` (tags, regions, symbols, placeholder text,
plus `tagOf`/`nodeOf` correlation), and keys its cached parse on the engine name and the provider's
version, so a `prime()` re-warm invalidates exactly like the schema memo.

There is deliberately no auto-detection: `{{ … }}` inside a SQL string literal is a template to dbt
and literal text to everyone else, and no scanner can tell which was meant. The host declares the
engine (file association, language id, or config). Declaring an engine on tag-free text costs
nothing: the result is byte-identical to a plain parse, with empty template facets. Wiring the
option into the LSP server (language-id / `.sqllens.json` rule) is the remaining application-layer
step.

## The gates

- The jinja corpus gate (`tests/corpus/minijinja.test.ts`, over `tests/fixtures/minijinja/`):
  real dbt model SQL plus focused fixtures for the tag-shape edges — multi-line tags,
  whitespace-control, `{% raw %}`, nested `outer(inner())`, `pkg.macro`, `{{ ref }}` in FROM,
  `{{ var }}` in value slots, comments, half-typed broken tags. Every file: `parseTemplated` is
  total (zero throws), the unified stream tiles the source (contiguous spans, no gaps or
  overlaps), and SQL-channel spans round-trip to original coordinates.
- Span assertions: ref/source/macro nodes offset-asserted against the source text
  (quotes-excluded content spans, per-argument spans, multi-line correctness).
- The consumer-contract gate (`tests/corpus/minijinja.consumer-contract.test.ts`): exercises the
  downstream read — a provider-resolved templated ref reports its real columns on every public
  name path, a zero-provider run is byte-identical, and no placeholder text leaks.
- Never-wrong: a tag node is emitted only where the jinja parse is confident; a malformed tag
  degrades to a best-effort node plus a diagnostic, never a wrong structure or a throw.

## Boundaries

- One TagNode per tag. `tagNodesOf` returns exactly one node per tag: the leftmost-topmost call in
  the tag's parse tree. A tag with two sibling calls (`{{ [ref('a'), ref('b')] }}`) yields only
  the first; an arithmetic tag with an embedded call (`{{ x + ref('y') }}`) classifies off that
  call. Both are rare in real dbt (a FROM is a lone `{{ ref() }}`), and the emitted spans stay
  accurate for the node returned. Retired if a consumer needs multi-node tags.
- M1 — unclosed region, empty last-arm bodySpan (broken input only). An unclosed region (missing
  `{% endif %}`/`{% endfor %}`) closes at the last known tag, so its final arm gets an empty
  `bodySpan`, and variant blanking cannot isolate that arm. Totality holds and the primary
  all-text-live result is unchanged; this bites only variant enumeration over unbalanced input.
- M2 — `{% for %}…{% else %}…{% endfor %}` for-else both-live (rare). The for-else form models as
  a nested single-arm region, so both the loop body and the `else` body stay live in the default
  variant; the editor still sees and edits both.
- Templated cell-splitting: templated documents ride the single-cell path; splitting a
  multi-statement templated file is deferred because control regions can straddle statement
  boundaries.
- LSP wiring of the `templating:` option (language-id / `.sqllens.json` rule) is application-layer
  work, tracked.
- minijinja vs Jinja2 divergences (division, import caching, silent undefined) are accept-syntax
  edges: encode minijinja's behavior and cite it, like the dialect fold-policy citations.
- The tag/region/symbol types remain minijinja-declared (type-only imports from the contract file)
  until the tag-kind taxonomy is generalized away from dbt-specific kinds; that relocation is
  coordinated with the downstream consumer.
