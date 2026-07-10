# Jinja-SQL front end — design spec (ITEM 10 / 11 / 14)

This spec is the grammar and front-end design that makes sqllens parse raw jinja-SQL (dbt templates)
natively: one unified token stream, first-class jinja tag nodes, and macro expansions as typed holes. It
replaces a downstream consumer's ~2,571-LOC blank-and-render workaround.

Grammar oracle: **minijinja** (the Rust engine dbt Fusion uses, NOT Jinja2; they differ on division
semantics, import caching, and a few edges). Its syntax reference is authoritative for what we accept.

**Status: inc1, inc2, and inc3 (relation + type slices) are built; the seam is `TemplateProvider`.**
Raw jinja-SQL parses natively: `parseTemplated` / `tokenizeTemplated`, the unified SQL(ch 0/1) +
jinja(ch 2, role `"minijinja"`) token stream, and the R2 ref/source/macro tag-AST, all additive over the
eight untouched SQL grammars (jinja reachable only through the barrel). inc2 adds R3 (`{{ ref }}`/`{{
source }}` in a FROM slot → a real template-tagged `TableSource`), R4 (`templateRegions` /
`templateSymbols` control-flow region tree + go-to-def symbols), and arm-coverage `templateVariants`.
inc3 resolves templated refs to real relations/columns/types through the injected provider (zero-provider
= R3 fallback, byte-identical) and drives shaped fills. The resolution seam is `DefaultTemplateProvider`
(2026-07-05 cutover, see § The seam below); the `TemplateCatalog` design in the older sections of this
file is SUPERSEDED and kept as design history. Gated by `tests/corpus/minijinja.test.ts` +
`tests/corpus/minijinja.consumer-contract.test.ts`. Still spec: `value` beyond scalar-slot typing,
`loopCollection`.

## The locked architecture (three lines — CHANNEL ITEM 14)

- TWO PATHS. *Edit-time* (every keystroke): sqllens parses raw jinja-SQL; a macro expansion is a
  TYPED HOLE; it NEVER renders. The user gets structural feedback on what they wrote. *Validation-time*
  (on demand: does the assembled query run): the extension renders via real dbt (`bridge.py
  compile_inline`) and hands clean compiled SQL back to sqllens as plain SQL. sqllens is the parser for
  BOTH artifacts; rendering is OUT of sqllens.
- ONE SEAM. A pull-callback template provider, today `DefaultTemplateProvider` (the 2026-07-05
  cutover superseding the `TemplateCatalog` sketch below): sqllens asks via `expansion(TemplateCall)`,
  the extension answers from dbt knowledge by overriding the granular virtuals, and the shipped base's
  defaults fill gaps. Sync-only consults from a warm cache; `prime()` is the one async seam.
- ONE RAZOR. In-text STRUCTURAL work is sqllens's (parse, tokens/AST, typed holes, control-flow
  regions, variant expansion; Q3: it is parsing). Out-of-text DBT KNOWLEDGE is the extension's (macro
  output-shape, loop collections, ref/source/var meaning, rendering).

Permanently OUT of sqllens: rendering/execution, variant combinatorics evaluation (which branch *runs*),
project modeling, any I/O. sqllens learns template SYNTAX only; it stays dbt-unaware.

## The mechanism — a pre-lexer, not a 9th dialect, not a grammar weave

Jinja is orthogonal to the SQL dialect axis (any dialect can be templated), so it is a pre-stage that
wraps `parse(sql, dialect)`, not a `DIALECTS` entry and NOT woven into the eight SQL grammars (Niclas's
standing guardrail: the tag front end is an isolated module with its own gates/ratchets).

The pipeline for `parseTemplated(text, dialect)`:

1. Segment the raw text over the OUTER jinja language into runs of literal SQL text and jinja tags
   (`{{ … }}` expression, `{% … %}` statement, `{# … #}` comment, each with the four whitespace-control
   variants `{{- -}}` / `{%- -%}` / `{#- -#}`). Jinja is the outer language: a `{{ … }}` inside what
   *looks like* a SQL string literal IS a jinja tag (dbt renders into SQL strings: `WHERE n =
   '{{ var("x") }}'` templates the string content). The segmenter respects only JINJA's own nesting:
   `{% raw %}…{% endraw %}` (contents are literal, no tags), `{# … #}` comments, and string literals
   *inside* a tag's expression (`{{ ref('a}}b') }}`: the `}}` inside the string is not a close). It does
   NOT respect SQL string/comment boundaries. Since 2026-07-05 segmentation is driven by ONE
   whole-document tokenization from the island lexer itself (`grammars/minijinja/MinijinjaLexer.g4`:
   DEFAULT-mode text + tag interior modes + a `RawBody` mode that spans raw blocks), replacing the
   original hand-rolled TS outer scan; there is a single definition of what a jinja tag is, and raw-block
   semantics are oracle-true (a raw block ends at the FIRST `{% endraw %}`, even inside what looks like a
   quoted string). `tests/minijinja.segment-golden.test.ts` locks the segmenter's output byte-for-byte.
2. Placeholder-substitute into a length-preserving, newline-preserving copy of the text that feeds the
   UNTOUCHED per-dialect SQL lexer. Because every placeholder occupies the exact character range (and
   preserves `\n` count and position) of the tag it replaces, every antlr `start/stop/line/column` the SQL
   lexer produces is already in ORIGINAL document coordinates: no span remap for SQL tokens outside tags.
   The inc1 placeholder shape is the POSITIONAL DEFAULT, and it is NO-OUTPUT-AWARE (§ the hole; anvil
   flagged, 2026-07-04: an identifier placeholder for `{{ config(...) }}` at statement position is a
   syntax error, and config-topped models are the majority):
   - `{{ call }}` where the leading call name ∈ `NO_OUTPUT_BUILTINS` (`config`, `docs`, `print`,
     `log`, `return`, `exceptions`: the dbt builtins that emit no SQL text) → newline-preserving
     whitespace (vanishes cleanly, whatever the slot). Same set the extension's blanker special-cases.
   - `{{ expr }}` otherwise → a single identifier-shaped placeholder (keeps the SQL parse valid where
     an identifier/value can appear; the common case: `FROM {{ ref('x') }}`, `SELECT {{ var('c') }}`).
     Ordinal-headed since 2026-07-06 (fill uniqueness): the fill is `j` + base35(tag ordinal) +
     `j`-padding (the ordinal alphabet excludes `j`), so two same-length tags never fill
     byte-identically. Name-keyed consumers (projection names, alias resolution, variant merges)
     used to collide on the old all-`j` fill.
   - `{% stmt %}` and `{# comment #}` → newline-preserving whitespace (no SQL output).
   The `NO_OUTPUT_BUILTINS` set is a small built-in DEFAULT (dbt-syntax-level: "these builtins produce no
   text"), the pre-catalog stand-in for inc3's `expansionShape → undefined`/no-output answer (optional
   over defaults: the catalog overrides it per-macro later). An unknown callable at statement position
   (a bare custom macro call) still gets the identifier default and may not parse: the residual
   fragment/statement class, a known inc1 limit the extension covers with its fallback until inc3.
3. Lex the placeholder string with the existing `fns.parse` / `tokenize` (grammars untouched).
4. Merge into ONE source-ordered `Token[]`: the SQL tokens (default channel 0, original coords) plus
   the jinja tokens (new channel 2, role `"minijinja"`) from the jinja lexer, interleaved by offset. The
   merge happens on the `ParseResult` (outside the lazy antlr token getter), so it is computed once.
5. Parse the tag interiors with the standalone jinja grammar into the R2 tag-AST nodes
   (ref/source/macro-call) with the exact span contract (§ R2).
6. Total / error-tolerant (R5): a half-typed `{{ ref(` never throws, per the same mandate as `lower()`'s
   totality on broken SQL. A malformed tag yields a best-effort node + a positioned diagnostic, never an
   exception.

### The grammar — `grammars/minijinja/` (standalone split pair)

`grammars/minijinja/MinijinjaLexer.g4` + `MinijinjaParser.g4`, generated to `src/generated/minijinja/` by the existing
`tools/gen.mjs` (no driver change; the alphabetical Lexer-before-Parser sort resolves `tokenVocab`).

- Lexer (island modes), patterned on the postgres dollar-quote precedent (`PostgresLexer.g4`
  `pushMode(DollarQuotedStringMode)` … `popMode`): a DEFAULT mode emits raw-text tokens and, on an opening
  delimiter (`{{`/`{%`/`{#`, optionally `-`), pushes the matching interior mode (ExprMode / StmtMode /
  CommentMode); the closing delimiter (optionally `-`) pops. `{% raw %}` pushes a raw mode that only
  matches `{% endraw %}`. Interior modes lex the jinja expression tokens (identifiers, strings, numbers,
  operators, `|`, `~`, `.`, `[`, `]`, `(`, `)`, `,`, `:`, keywords `and/or/not/in/is/if/else/for/set/…`).
- Parser (Q2 scope for inc1): parse enough to satisfy R2: CALL expressions (`name(args)`,
  `pkg.macro(args)`, nested `outer(inner(…))`, string-literal args, dotted names, keyword args
  `k=v`, top-level-comma arg splitting with nested parens respected) and the statement-tag keywords
  (`if/elif/else/endif`, `for … in … [if …]`, `set`, `macro`, `endX`, …) enough to TOKENIZE and region
  them. The full expression language (filters `|`, tests `is`, arithmetic, `~`, conditional `if/else`,
  slices, lists/dicts/tuples) is opaque-tolerated at inc1: lexed onto the jinja channel, captured as
  tag text, but not structured. It tightens in later increments as consumers need it.

### The hole — inc1 is the positional default; shape comes later

A macro can expand to arbitrary SQL: a column list, a whole predicate, a join, a CTE. That is Q1, and
Niclas decided it: parse-with-holes + typed shape, never render. For inc1 (placeholder-parity), the
hole is the POSITIONAL DEFAULT: a no-output builtin (`config`/`docs`/`print`/`log`/`return`/
`exceptions`) → whitespace (it emits no SQL, whatever the slot); any other callable in a value/identifier
slot → one identifier placeholder. This matches the extension's current pass-1 blanking exactly (its
`STATEMENT_MACROS` blank-to-space set + identifier placeholder for the rest): the same cases parse, the
same cases fail. The
known-failing class at inc1 (parity, not regression): a macro emitting a SQL FRAGMENT: an operator
(`WHERE x {{ op() }} 5`), a comma-carrying column list (`SELECT {{ dbt_utils.star(…) }}` in strict count
contexts), or a statement fragment, where a single identifier placeholder can't fuse with adjacent tokens.
Those do not parse cleanly at inc1, exactly as blanking doesn't today; at edit-time the user still gets
feedback on the rest of the query, and the assembled-query-runs question is answered by the
validation-time real-dbt render (the two-path model). The FIX for the fragment class is the shaped hole:
`expansionShape(macroCall) → 'expr'|'column-list'|'predicate'|'relation'|'statement'` supplies a
shape-valid placeholder: that is inc2/inc3 (the TemplateCatalog), not inc1.

The one sqllens ask (committed, CHANNEL 05:10): the hole/tag node carries its SYNTACTIC-SLOT context: the
SQL slot it sits in (`column-list` / `predicate` / `relation` / `statement` / `expr`), derivable from
where the placeholder landed in the SQL parse, so the extension's quick-fix can pre-fill the smart
default. The inc1 `TagNode` does NOT yet carry this slot field (its shape is the R2 span contract only:
ref/source/macro/var/config/control/other with spans); the field is a spec ask deferred to the increment
that needs it, when the positional default keys off it.

## R1 — the unified token stream (inc1 — built)

`parseTemplated(text, dialect)` / `tokenizeTemplated(text, dialect)` return one flat, source-ordered
`Token[]`: SQL tokens (channel 0, original coordinates via length-preserving placeholders) + jinja tokens
(channel 2, role `"minijinja"`). `Token.channel` is already an int (0 default, 1 hidden): channel 2 is
additive with zero type churn, and `document.tokenAt` already skips `channel !== 0`, so existing
default-channel consumers ignore jinja tokens for free. `TokenRole` gains a `"minijinja"` member (a closed
union: every exhaustive role `switch` is revisited in the same change). Multi-line correct: a tag
spanning newlines carries a correct multi-line span (the extension's extractors are single-line-lossy
today; R2 fixes this, a parity UPGRADE that needs its own test).

## R2 — the tag-AST span contract (inc1 — built)

The ref/source/macro-call nodes, with a span for every field below (sqllens convention: 1-based line,
0-based column, 0-based offsets; the extension applies its own `line - 1`). These are the HARD contract:
extension providers position hover/rename/signature-help exactly on them.

- ref node: `model` (string-literal content, quotes EXCLUDED); span of the `ref(` call; `modelSpan`
  (model-name content, quotes excluded); `tagSpan` (the whole `{{ ref(…) }}` including delimiters).
- source node: `sourceName`, `tableName` (both string contents); `sourceNameSpan`, `tableNameSpan`
  (quotes excluded); `tagSpan`.
- macro-call node (richest, drives signature help): `name` (bare macro name) + `nameSpan`;
  `packageName?` + `packageSpan?` (for `pkg.macro(…)`); `tagSpan` (the enclosing `{{ }}` OR `{% %}`);
  `argsSpan` (opening-paren offset → closing-paren exclusive end); `args: { span }[]`: PER-ARGUMENT
  spans, source order, top-level-comma split (nested parens respected), supporting `outer(inner(…))` and
  `pkg.macro(…)`.
- var/env_var/config recognition: `config/docs/print/log/return/exceptions` produce no SQL output;
  `var/env_var` produce a value. These classifications survive as node kinds (they feed the catalog's
  shape/value answers later).

`PartSpan` (`src/ir/part-span.ts`, absolute 0-based offsets + 1-based line / 0-based col) is the ready-made
span carrier. Tag nodes are additive: they ride a jinja-artifact facade on the result / `SqlDocument`
(another cached artifact alongside tokens/cst/ast), not a change to the SQL IR. Where a `{{ ref('x') }}`
in a FROM slot should become a real table-source IR node (R3), that is inc2.

## R3 — templated refs as first-class FROM nodes (inc2 — BUILT 2026-07-04)

`{{ ref('x') }}` / `{{ source('a','b') }}` in a FROM/JOIN slot becomes a real `TableSource` carrying its
tag, so scope/qualify/lineage/columnGraph see the model, not the placeholder. The design rides two
existing invariants (scope binds a `TableSource` purely by `name`, and the IR is frozen after `lower()`),
so the whole downstream pipeline works unchanged. Built: `TableSource.template` + `src/minijinja/apply-tags.ts`
+ the one qualify guard; `resolveScopes`/`Lineage.originsOf`/`referencesAt` bind `{{ ref('orders') }}` to
`orders` natively (proven in `tests/minijinja.apply-tags.test.ts` + `tests/minijinja.pipeline.test.ts`, gated by
`tests/corpus/minijinja.test.ts`). R4 + variant realization below are built.

- IR (additive): `TableSource` gains `template?: TemplateSourceInfo`; the type lives in `src/ir/ir.ts`
  (neutral, the IR never imports `src/minijinja`): `{ kind: "ref" | "source" | "macro"; span: PartSpan;
  opaque?: true }`: the tag's kind, the whole-tag span (document coordinates), and the opacity verdict.
  Consumers needing the full `TagNode` correlate by span with `parseTemplated().tags`.
- Name substitution (literal-only, never-wrong): `ref('x')` → `name: ["x"]`; `source('a','b')` →
  `name: ["a","b"]`: the dbt-logical names as written in-text (the razor: in-text structural). A macro or
  computed tag in a FROM slot keeps the placeholder name and gets `opaque: true`: its output relation is
  undeterminable without the catalog. (inc1's `directStringToken` guard already guarantees a `ref`/`source`
  TagNode carries only literal names.)
- The transform (`src/minijinja/apply-tags.ts`): post-lower, `applyTemplateTags(ast, tags)` walks the IR
  (bodies, CTEs, sources, joins, subqueries, pipe stages), correlates by CONTAINMENT: a `TableSource`
  whose first name token's offset lies inside a tag's `tagSpan` (containment, not equality: a multi-line
  expr tag fills as one placeholder identifier per line), and rebuilds with structural sharing (new
  objects only on changed paths; frozen subtrees are safely shared), re-freezing the result.
  `parseTemplated().sql.ast` IS the transformed IR (one canonical ast; the raw placeholder parse is
  derivable via `parse(placeholder)`).
- Qualify (one guard): a source with `template` present is exempt from unknown-table AND
  unknown-column diagnostics: its physical relation is dbt knowledge (out-of-text), so a diagnostic
  against the dbt-logical name would be never-wrong-violating; inc3's `TemplateCatalog.relation` upgrades
  it to real resolution. Scope still binds the substituted name, so `orders.col` qualifies, lineage
  origins report `orders`, and references/documentHighlight work, all with zero changes to those passes.

## R4 — control-flow regions + template symbols (inc2 — BUILT 2026-07-04)

- Control-tag enrichment (additive on the `TagNode` union): the `control` variant gains `keyword?`
  (`if`/`elif`/`else`/`endif`/`for`/`endfor`/`set`/`macro`/`endmacro`/…), `name?` + `nameSpan?` (the `set`
  target / `macro` name / `for` loop variable), extracted from the existing tolerant stmt parse tree.
- Regions (`src/minijinja/regions.ts`): `templateRegions(tags, text?)` stack-pairs control tags into a tree:
  `TemplateRegion { kind: "if" | "for" | "macro"; arms: TemplateArm[]; span }`, `TemplateArm { keyword;
  tagSpan; bodySpan; children: TemplateRegion[] }` (an arm's body runs from its tag's end to the next
  arm/close tag's start). Tolerant: unbalanced/broken input yields best-effort regions, never a throw.
- Symbols: `templateSymbols(tags)` → `TemplateSymbol { kind: "set" | "macro"; name; nameSpan; span }`
  (go-to-def on `{% set %}` / `{% macro %}`). Both ride `TemplatedParseResult` as additive `regions` /
  `symbols` fields.

## Variant realization (inc2 — BUILT 2026-07-04)

Arm-coverage enumeration, not cross-product (mechanism corrected 2026-07-04 to honor the guarantee; see
below): variant 0 is all-defaults; then one variant per non-default arm. The load-bearing GUARANTEE is
every text region is live in exactly one variant (the editor mandate: the user edits every arm
regardless of which runs), so the mechanism must be ancestor-path activation, NOT "all other regions
take arm 0". A variant for (region R, arm k) activates arm k of R AND, for every ANCESTOR region on R's
path to root, the arm that CONTAINS R; every NON-ancestor region takes its first arm. This makes an arm
nested inside a non-default arm reachable (pinning the ancestor to its containing arm keeps that arm's body
live), where the naive "all others take arm 0" would blank the parent and silently drop the nested arm (and
emit a degenerate duplicate of variant 0). It stays LINEAR (one variant per non-default arm,
`1 + Σ(arms−1)`, no combinatorial explosion), and each variant is still one coherent root-to-leaf branch
selection. A `{% for %}` contributes no extra variant (its default IS the representative single iteration:
the body parses in place). A variant is realized by whitespace-blanking the INACTIVE arms' body ranges over
the original text (newline-preserving, coordinates intact) and feeding `parseTemplated`; results are lazy
(`TemplateVariant.parse()` memoized; `TemplateVariant.text()` exposes the realized blanked source, memoized
separately so text alone never forces a parse; anvil's one text-in seam feeding both engines during their
cutover, added 2026-07-05 alongside `TemplatedParseResult.placeholder`, the placeholder-filled SQL text the
SQL parser actually saw). The primary `parseTemplated` result stays all-text-live (inc1
parity, anvil integrated against it mid-flight); variants are the additive coherent-arm API
(`templateVariants(text, dialect)`), adopted by consumers when ready.

## The seam — TemplateProvider (SUPERSEDES TemplateCatalog, 2026-07-05)

The catalog-unification redesign (Niclas-ordered, channel-agreed with anvil) replaced the per-kind
catalog methods below with ONE call-keyed seam. Current state, in `src/qualify/template-provider.ts`:

- `DefaultTemplateProvider` is a SHIPPED, CONCRETE default implementation designed for inheritance
  (the C# base-class pattern): fully functional with zero consumer input (it IS the zero-consumer
  strategy, readable + unit-testable in one class), composed of granular overridables:
  `relationOf`/`valueOf`/`shapeOf`/`columnsOf`/`collectionOf`; a consumer overrides only the parts
  it knows. The dbt-builtin knowledge formerly HARDCODED in the segmenter (NO_OUTPUT_BUILTINS,
  SHAPE_EXCLUDED) lives here: config/docs/print/log/return/exceptions → shape `"nothing"`;
  ref/source → a relation logically named by their literal args; env_var → a string value.
- `expansion(call: TemplateCall): ResolvedExpansion | undefined` is the ONE engine consult.
  `TemplateCall` = name + packageParts + literal args (quote-stripped, escapes-unresolved, computed
  → null) + kwargs (carried, never dropped). `ResolvedExpansion` = shape / relation / value
  (NEUTRAL type union string|integer|float|boolean) / columns / collection; explicit shape wins,
  else derived relation → "relation", columns → "column-list", value → "expr".
- SYNC-ONLY + PER-DOCUMENT instances (channel conditions); miss recording + one coalesced `prime()`
  + version bump live on the base (`recordMiss`/`recordTableMiss`/`fetchExpansions`/`fetchTables`).
- Consumption is uniform: the segmenter consults expansion() for every expr tag (fills); apply-tags
  attaches the call to every template marker: TableSource markers AND the scalar-slot
  `TemplateExprInfo` on column exprs/refs (the expr-marking pass), and qualify/infer/nullability/
  resolve resolve any marked node through `relationColumns`/`tableSourceColumns`
  (src/qualify/relation-columns.ts). The engine keeps ONLY the non-overridable positional machinery
  (length-/newline-preserving fills, the slot guards: statement/relation is an ALLOWLIST of
  body-start slots `""|;|(|)` since the default provider mass-produces relation shapes; conjunct
  keeps its blocklist).

The section below is the ORIGINAL inc3 catalog design, kept for the rationale; interface names are
superseded (`TemplateCatalog`→`TemplateProvider`, `expansionShape`→`shapeOf`/`expansion`,
`CallbackTemplateCatalog`→ subclassing the base).

Generalizes `SchemaSource`: ref/source/var/macros are to the template layer what the schema is to SQL:
external catalog knowledge behind a pull interface. sqllens stays dbt-unaware; the extension answers.

```ts
interface TemplateCatalog {
	// LAZY post-parse resolution — async, cached, versioned like SchemaSource; diagnostics republish on warm.
	relation(call): { nameParts: string[]; columns?: string[] } | undefined;   // ref() / source()
	value(call): Type | undefined;                                             // var() / env_var()
	// UP-FRONT parse-time shape — SYNCHRONOUS, by-name (sqllens can't pause mid-lex to await).
	expansionShape(macroCall): "expr" | "column-list" | "predicate" | "relation" | "statement" | undefined;
	// UP-FRONT loop collections — for {% for x in <external> %} where the collection isn't a text literal.
	loopCollection(forCall): unknown[] | undefined;
}
```

Optional over defaults (the keystone): `expansionShape → undefined` falls back to the positional guess;
a ZERO catalog still parses (defaults everywhere); with a catalog it parses precisely. Rendering is a
CATALOG RESPONSE, not architecture: how the extension answers `expansionShape` upgrades per-macro (v1
positional default → v2 macro signature → v3 real dbt render of that one macro) with sqllens frozen across
the gradient.

### inc3 increment 2 — `expansionShape` (shaped placeholders; the cascade-death lever) — design decided 2026-07-05

anvil's driver: `expansionShape` is the ONLY thing between them and deleting the fallback cascade
(`parseWithJinjaFallback` + `jinja-blanker` + nunjucks). The residual class it kills: an unknown callable
at STATEMENT position: `with cte as ({{ macro_a(…) }}) {{ macro_b(…) }}` (a macro-generated CTE body, a
trailing statement-level macro), where inc1's single-identifier placeholder can't fuse into valid SQL, so
the SQL parse fails. anvil answers `expansionShape` synchronously by macro name from the dbt manifest
(macro signatures are static knowledge); v1 is a positional guess, upgrading per-macro without sqllens
changing.

The mechanism is placeholder surgery in `src/minijinja/segment.ts`. Today `fillChar` returns ONE char
(`"j"` identifier / `" "` whitespace) stamped across the tag's `[start,end)`, newlines preserved. inc3.2
generalizes the fill from a char to a length-matched shape-valid string:

- Interface (extends `TemplateCatalog`): `expansionShape(call: { name: string; parts?: string[] },
  dialect?): "expr" | "column-list" | "predicate" | "relation" | "statement" | undefined`, SYNCHRONOUS,
  by name (sqllens can't await mid-segment). Threaded into `parseTemplated(text, dialect, opts?)` as a
  `shapeOf?: (call) => Shape | undefined` (the catalog's `expansionShape` bound, or a bare callback), passed
  down to `segment`. No catalog / no `shapeOf` / `undefined` → the current positional fill, byte-identical.
- Shape → minimal valid fragment (dialect-neutral where it parses across all 8; per-dialect override
  table only where one dialect rejects the neutral form): `statement`/`relation` → `SELECT 1` (a valid
  query body: fits BOTH a standalone statement slot AND a `(…)` CTE/subquery body, the two anvil cases);
  `predicate` → `1=1`; `column-list` → `1` (one valid select item: the macro's real column COUNT differs
  but the slot parses); `expr` → the identifier fill (today's `"j"` run). Each fragment is placed at the
  tag's start, then the remaining range is padded, length- and newline-preserving: pad with spaces,
  but keep every original `\n` at its offset (whitespace incl. newlines after a valid fragment is legal
  SQL). The coordinate invariant (every placeholder char occupies the exact tag offset) is unchanged.
- Fit guard (never make it worse): the non-whitespace fragment must fit BEFORE the tag's first `\n`
  and within the tag length. If it doesn't (tag too short, or a newline lands inside where the fragment
  would go), FALL BACK to the positional default for that tag: the shaped placeholder is strictly an
  improvement, never a regression on a tag it can't shape.
- Only MACRO-call tags consult `shapeOf`: a `ref`/`source`/`var`/no-output-builtin tag keeps its
  existing fill (they already parse). The call passed to `shapeOf` is the macro name (+ package parts),
  from the same leading-call detection `fillChar` already does.
- Zero-catalog keystone + gate: a `parseTemplated` with no `shapeOf` is byte-identical to today (the
  corpus gate + consumer-contract gate prove it). The new gate: with a `shapeOf` returning `statement` for
  the residual-class fixtures (`with cte as ({{ m() }}) {{ n() }}`), the SQL parse now succeeds (0 syntax
  errors) where it failed before: the cascade-death proof.
- Two-path integrity: this is still parse-with-holes, NOT render: `SELECT 1` is a shape-valid HOLE, not
  the macro's output. The IR/tokens still flag the tag; the extension renders for real at validation time.
- Slot guard, CLOSED 2026-07-05 (was: Open Gap, slot-blind shaping). `expansionShape` is answered BY
  NAME (synchronous, position-blind by design), so a macro answered `relation`/`statement` used to get the
  `SELECT 1` fill EVERYWHERE, including slots where that fill is invalid SQL while the identifier fill
  parses: a bare `FROM {{ m() }}` / `JOIN {{ m() }}` (→ `FROM SELECT 1`), a list comma, and a predicate
  slot (`WHERE {{ m() }}`, the anvil repro). The close is the backward slot scan in `segment.ts`
  (`precedingSlot` + `SLOT_BLOCK_WORDS`): skip `statement`/`relation` shaping when the tag is directly
  preceded (whitespace-skipping, over the placeholder-in-progress so blanked tags read as whitespace) by
  `FROM`/`JOIN`/`,`/`WHERE`/`AND`/`OR`/`ON`/`HAVING`/`WHEN`, falling back to the identifier fill there. A
  BLOCKLIST, so shaping only ever loses slots where it provably broke: every admitted slot (BOF, `;`,
  `(`, after `)`, set-ops) behaves exactly as before; `predicate`/`column-list` shapes and the zero-catalog
  path are untouched. Pinned by the slot-guard suite in `tests/minijinja.expansionshape.test.ts`.

### inc3 increment 1 — `relation` only — BUILT 2026-07-04 (design decided 2026-07-04; anvil cleared relation-first)

anvil cleared prototyping `relation` FIRST, in parallel (the column-resolution win) and holding
`value`/`expansionShape`/`loopCollection` until it proves out. The full `TemplateCatalog` above stays the
end target; inc3.1 builds only the `relation` slice, and the design is `TemplateCatalog extends
SchemaSource` so qualify duck-types the catalog it ALREADY receives: no new pipeline threading, and a
plain `SchemaSource` (no `relation` method) is naturally the zero-catalog fallback. Shipped: the
`src/qualify/template-catalog.ts` interface + `CallbackTemplateCatalog`, the qualify upgrade at the two R3
guard sites, the barrel exports (`TemplateCatalog`, `CallbackTemplateCatalog`, `TemplateRef`,
`ResolvedRelation`, `RelationResolver`), and the LSP catalog injection (the lazy-catalog re-publish loop is
duck-typed on `prime()`/`misses`, so `CallbackTemplateCatalog.prime()` drives warm/republish exactly like
`CallbackSchema`). Gated by `tests/minijinja.relation.test.ts`, `tests/minijinja.public-api.test.ts`, the
`CallbackTemplateCatalog` arm of `tests/lsp.acceptance.test.ts`, and the extended
`tests/corpus/minijinja.consumer-contract.test.ts` (a catalog-resolved ref reports real columns; a zero-catalog
run is byte-identical to R3). LSP boundary: relation resolution is LIBRARY-level (parseTemplated →
qualify with an injected catalog); the LSP server itself still builds documents from plain `parse`, not
`parseTemplated`, so a templated `{{ ref }}` does not reach the server end-to-end until `SqlDocument.fromTemplated`
lands (the deferred templated-document model). The `CallbackTemplateCatalog` LSP arm proves the re-publish
loop drives this catalog type (over its physical-table side); the relation path is proven at library level.

- Interface (`src/qualify/template-catalog.ts`): `interface TemplateCatalog extends SchemaSource {
  relation(ref: { kind: "ref" | "source"; nameParts: string[] }, dialect?: string): { nameParts: string[];
  columns?: Column[] } | undefined; }`. The `ref.nameParts` is the dbt-logical name R3 already put on
  `TableSource.name` (`["orders"]` / `["raw","events"]`); the answer's `nameParts` is the resolved PHYSICAL
  relation and `columns` its schema (undefined until a warehouse describe lands, async warm). A
  `CallbackTemplateCatalog` mirrors `CallbackSchema` exactly: sync `resolve`, recorded misses, an async
  `prime()` that drains + bumps `version`. It IS a `SchemaSource` too (physical tables still resolve
  through `columnsFor`), so one injected catalog serves both.
- Qualify upgrade (the two R3 guard sites, `qualify.ts:254,382`): today `if (src.source.template)
  return undefined` (blanket exempt). inc3.1: if the source is templated AND the active schema is a
  `TemplateCatalog` (duck-typed: `"relation" in schema`), ask `relation({kind, nameParts: src.name})`. If
  it returns `columns` → resolve against them (real unknown-column CAN now fire for a genuinely-missing
  column); if it returns `nameParts` only → resolve those physical parts through the schema's own
  `columnsFor` (logical→physical→columns, reusing the existing physical resolver); if it returns
  `undefined` OR the schema is a plain `SchemaSource` → the R3 fallback (exempt, columns unknown). Opaque
  templated sources (macro/computed) stay exempt: no literal name to ask `relation` with.
- Zero-catalog keystone preserved: a plain `Schema`/`SchemaSource` has no `relation`, so every templated
  source falls to the R3 exemption: inc3.1 is invisible without a catalog, exactly as R2/R3 are without one.
- LSP warm/republish: the existing lazy-catalog loop (`startServer` → `publish` → `prime()` on misses →
  version bump → re-publish) already keys on `SchemaSource.version`; since `CallbackTemplateCatalog` bumps
  the same `version`, a resolved ref republishes diagnostics with no LSP change beyond accepting a
  `TemplateCatalog` in the `schema` slot (it already accepts any `SchemaSource`).
- Never-wrong: a `relation` miss (undefined) is the R3 exemption, never a fabricated column; an
  unknown-column diagnostic fires ONLY when the catalog positively returned columns and the column is
  absent from them. The consumer-contract gate extends: a catalog-resolved templated ref reports its real
  columns on every public read; a zero-catalog parse is byte-identical to R3.

Templated-column TYPES → inference/hover, CLOSED 2026-07-05 (the inc3.2 type slice).
`src/qualify/relation-columns.ts` is the shared template-aware typed resolver: `relationColumns`
(CATALOG-ONLY: qualify's diagnostic exemption is built on it and stays conservative) and
`tableSourceColumns` (catalog first, then the plain `columnsFor(logical name)` fallback the type
consumers always did: a Schema keyed by dbt-logical names keeps typing). infer (`sourceColumnType`),
nullability (`tableColumnNullability`) and sema-resolve (`columnNamesOf`) route table sources through it,
so `{{ ref('orders') }}.total` types (and carries nullability) from a warm catalog's `relation` columns,
hover/inlay-hints included. Catalog misses recorded by the type path warm on `prime()` like every other
lookup. `value`/`loopCollection` remain spec (the full `TemplateCatalog` above); `expansionShape` shipped
(statement/relation/predicate/column-list/conjunct/where-clause + slot guards; fragments place into the tag's first fitting newline-free window, so multi-line whole-model tags shape too, F5 fixes, 2026-07-06).

## Variant expansion (Q3 — resolved: it is parsing → sqllens's, inc2)

For the editor, sqllens enumerates ALL `{% if %}/{% elif %}/{% else %}` branches STRUCTURALLY with NO
condition evaluation (the user edits every arm regardless of which runs). Prefer genuine per-branch
coherent variants over a single merged region tree: a merged tree with two alternative WHEREs is
incoherent (it is exactly why the extension's `mergeModels` can only query by byte-range, never traverse).
Each enumerated variant is a coherent valid parse. `{% for %}`: a literal collection (`[1,2,3]`) expands
directly; an external collection (`{% for col in columns %}`) pulls from `TemplateCatalog.loopCollection`,
defaulting to a representative single iteration (body once, placeholder items). This relocates the
extension's `generateVariants`/`branch-enumerator`/coarse-tokenizer trio into sqllens. Internal
representation is sqllens's call; the point is it is the parser's job. (inc2 — BUILT: `templateVariants`,
on the R4 control-flow regions.)

## Increment plan

- inc1 — placeholder-parity / raw-jinja-parse (R1 + R2) — BUILT. The pre-lexer, the `grammars/minijinja/`
  island grammar, the unified token stream, and the ref/source/macro tag-AST with the R2 span contract are
  shipped and total: `parseTemplated(text, dialect)` / `tokenizeTemplated` return one source-ordered
  `Token[]` (SQL channel 0/1 + jinja channel 2, role `"minijinja"`) plus the `TagNode[]`, over the eight
  untouched SQL grammars, jinja reachable only through the barrel. Positional-default hole
  (NO_OUTPUT_BUILTINS-aware); the syntactic-slot context field is deferred (§ the hole). Gated by
  `tests/corpus/minijinja.test.ts` over 15 `tests/fixtures/minijinja/` fixtures (totality, byte-for-byte stream
  reconstruction, span in-bounds + content-true). This is the surface the extension consumes to retire its
  blanking cascade (`parse-with-jinja-fallback`, `jinja-blanker`, the fine tokenizer, the two-stream
  merge). No SQL-grammar change; no IR change beyond the additive jinja facade + `TokenRole "minijinja"` /
  channel 2.
- inc2 — tag-AST (R3 + R4) + variant expansion — BUILT. `{{ ref('x') }}` in a FROM/JOIN slot lowers to
  a first-class table-source IR node carrying its tag (R3 — feeds scope/qualify/lineage/columnGraph); control
  flow + `set`/`macro` become structured regions/symbols (R4 — `templateRegions`/`templateSymbols`, with
  `regions`/`symbols` on `TemplatedParseResult`); arm-coverage `templateVariants` relocates variant expansion
  in. §R3 / §R4 / §Variant realization above are the shipped shapes; gated by
  `tests/corpus/minijinja.consumer-contract.test.ts` (plus `minijinja.test.ts`). M1/M2 (§ Boundaries) are the two
  tracked broken/rare-input limits.
- inc3 — TemplateCatalog wiring (ITEM 11). The pull-callback seam: lazy relation/value resolution,
  synchronous `expansionShape` (shaped holes retire the fragment-macro limitation), `loopCollection`. Turns
  "parses with defaults" into "resolves `{{ ref }}` with real columns pre-compile."
  - inc3.1 — `relation` slice — BUILT 2026-07-04. `TemplateCatalog extends SchemaSource` +
    `CallbackTemplateCatalog`; qualify duck-types the catalog and resolves a templated source's real
    columns (real unknown-column diagnostics), barrel-exported, LSP-injected (the lazy re-publish loop
    drives `CallbackTemplateCatalog.prime()`); a zero-catalog run is byte-identical to R3.
  - inc3.2 — type slice + expansionShape — BUILT 2026-07-05. Relation-resolved column TYPES thread
    through infer/nullability/resolve (§ the seam, the CLOSED block above), and `expansionShape` is live
    (statement/relation/predicate/column-list/conjunct/where-clause, slot-guarded, statement-slot blank default, multi-line fit-window placement).
  - inc3.3+ — spec: `value` (var/env_var → Type), `loopCollection`.

Each increment is independently shippable to master with a channel ship note; the extension consumes per
increment (its `JINJA-CONSUMPTION-PLAN.md` maps each of its ~2,538 dying/relocating LOC to these).

## inc1 gates (the acceptance bar)

- A jinja corpus: real dbt model SQL (the extension's nba-monte-carlo / jaffle_shop samples are the
  starter; author a focused fixture set for the tag-shape edges: multi-line tags, whitespace-control,
  `{% raw %}`, nested `outer(inner())`, `pkg.macro`, `{{ ref }}` in FROM, `{{ var }}` in value slots,
  comments, a half-typed broken tag). Every file: `parseTemplated` is TOTAL (0 throws), the unified stream
  tiles the source (spans contiguous, no gaps/overlaps), and the SQL-channel spans round-trip to original
  coordinates.
- R2 span assertions: ref/source/macro nodes with offset-asserted spans against the source text
  (quotes-excluded content spans; per-argument spans; multi-line correctness, the parity upgrade).
- Parity check: for each fixture, the identifier-placeholder SQL parse matches the case the extension's
  pass-1 blanking parses (parses where it parses; the fragment-macro class fails where blanking fails,
  documented).
- Never-wrong: a tag node is emitted only where the jinja parse is confident; a malformed tag degrades to a
  best-effort node + diagnostic, never a wrong structure or a throw.

## Boundaries / open items

- Q4 (extension-side, not sqllens): whether the extension's nunjucks pass-2 survives: decided by the
  bridge's `compile_inline` coverage, not here.
- Fragment-macro at inc1 is a known parity limitation (not a regression), retired by inc3's shaped hole.
- One TagNode per tag (inc1 boundary). `tagNodesOf` returns exactly ONE `TagNode` per tag: the
  leftmost-topmost call in the tag's parse tree. A tag with two sibling calls (`{{ [ref('a'), ref('b')] }}`)
  yields only the first; an arithmetic tag with an embedded call (`{{ x + ref('y') }}`) classifies off that
  call. Both are rare in real dbt (a FROM is a lone `{{ ref() }}`), and the emitted spans are still
  accurate for the node returned. A tracked inc1 boundary, retired when inc2 needs multi-node tags.
- Debugger native Source Map (I2) depends on sqllens owning the jinja→SQL transform (inc2+), the one
  extension piece with no shipped sqllens surface until then.
- M1 — unclosed region, empty last-arm bodySpan (broken-input-only). An UNCLOSED region (a missing
  `{% endif %}`/`{% endfor %}`) closes at the last known tag, so its final arm gets an empty `bodySpan`:
  variant blanking then can't isolate that arm on broken input. Totality holds and the primary
  (all-text-live) result is unchanged; this bites only variant enumeration over unbalanced input.
- M2 — `{% for %}…{% else %}…{% endfor %}` for-else both-live (rare). The for-else form models as a
  nested single-arm region, so both the loop body and the `else` body are live in the default variant (the
  editor still sees and edits both). Rare in real dbt.
- minijinja vs Jinja2 divergences (division, import caching, silent undefined) are accept-syntax edges;
  encode minijinja, cite it, flag any surprise like the dialect fold-policy citations.

## Engine extraction (2026-07-10) — TemplateEngine + the sqllens/minijinja subpath

The front end is now an injected engine. The neutral contract — `TemplateEngine`,
`TemplatedParseResult`, `TemplatedParseOptions` — lives in `src/template/engine.ts` and stays
on the main barrel; the engine itself (`minijinja()`, `parseTemplated`, `tokenizeTemplated`,
the tag-AST, regions, variants) ships behind the `sqllens/minijinja` subpath
(`src/minijinja/index.ts`), so plain-SQL consumers never load the island grammar. The engine
owns the whole templating strategy and calls the core `parse()` as a primitive; its result
contract is enforced by the runnable conformance suite in
`tests/template.engine-contract.test.ts` (byte tiling, original coordinates, totality,
zero-tag degeneracy, no fill leakage). The tag/region/symbol types remain minijinja-declared
(type-only imports from the contract file) until the tag-kind taxonomy is de-dbt'd — that
relocation is bound to the anvil-coordinated overlay wave.

## The unified door (2026-07-10) — SqlDocument.fromTemplated is superseded

The "LSP boundary" limitation above (templated refs not reaching the server end-to-end
until `SqlDocument.fromTemplated` lands) is CLOSED by a different shape than the one it
predicted: `SqlDocument.create(text, dialect, { templating: minijinja(), provider })` —
templating as an injected engine option on the ONE document entry, not a separate factory.
A templated document rides the single-cell path v1 (dbt models are single-statement;
control regions can straddle statement boundaries, so cell-splitting templated text is a
tracked deferral), exposes the engine result as `doc.templated` (tags/regions/symbols/
placeholder/degraded + tagOf/nodeOf/diagnosticsOf), and its cached parse is keyed on the
engine name + the provider's version, so a `prime()` re-warm invalidates exactly like the
schema memo. There is deliberately NO auto-detection — `{{ … }}` inside a string literal
is undecidable (template to dbt, literal text to everyone else), so the host declares
templating (file association, language id, config); tag-free text under a declared engine
is byte-identical to a plain parse. Wiring the option into the LSP server (language-id /
`.sqllens.json` rule) is the remaining application-layer step, tracked for the facade wave.
