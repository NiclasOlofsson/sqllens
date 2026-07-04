# Jinja-SQL front end — design spec (ITEM 10 / 11 / 14)

The sqllens-side counterpart to the extension's `JINJA-CONSUMPTION-PLAN.md`. This spec is the grammar +
front-end design that makes sqllens parse **raw jinja-SQL** (dbt templates) natively — one unified token
stream, first-class jinja tag nodes, macro expansions as typed holes — replacing the extension's
~2,571-LOC blank-and-render workaround. It realizes the LOCKED requirements stance from
`docs/anvil/CHANNEL.md` ITEM 14 (Niclas, 2026-07-04) and the Q1/Q3 resolutions.

Grammar oracle: **minijinja** (the Rust engine dbt Fusion uses — NOT Jinja2; they differ on division
semantics, import caching, and a few edges). Its syntax reference is authoritative for what we accept.

**Status: inc1 is built.** Raw jinja-SQL parses natively — `parseTemplated` / `tokenizeTemplated`, the
unified SQL(ch 0/1) + jinja(ch 2, role `"jinja"`) token stream, and the R2 ref/source/macro tag-AST, all
additive over the eight untouched SQL grammars (jinja reachable only through the barrel), gated by
`tests/corpus/jinja.test.ts`. inc2 and inc3 below stay spec.

## The locked architecture (three lines — CHANNEL ITEM 14)

- **TWO PATHS.** *Edit-time* (every keystroke): sqllens parses raw jinja-SQL; a macro expansion is a
  TYPED HOLE; it NEVER renders — the user gets structural feedback on what they wrote. *Validation-time*
  (on demand — does the assembled query run): the **extension** renders via real dbt (`bridge.py
  compile_inline`) and hands clean compiled SQL back to sqllens as plain SQL. sqllens is the parser for
  BOTH artifacts; rendering is OUT of sqllens.
- **ONE SEAM.** A pull-callback `TemplateCatalog` (generalizes the existing `SchemaSource`/`CallbackSchema`):
  sqllens asks, the extension answers from dbt knowledge, defaults fill gaps. Two timing regimes — lazy
  post-parse resolution, up-front synchronous parse-time shape.
- **ONE RAZOR.** In-text STRUCTURAL work is sqllens's (parse, tokens/AST, typed holes, control-flow
  regions, variant expansion — Q3: it is parsing). Out-of-text DBT KNOWLEDGE is the extension's (macro
  output-shape, loop collections, ref/source/var meaning, rendering).

Permanently OUT of sqllens: rendering/execution, variant combinatorics evaluation (which branch *runs*),
project modeling, any I/O. sqllens learns template SYNTAX only; it stays dbt-unaware.

## The mechanism — a pre-lexer, not a 9th dialect, not a grammar weave

Jinja is orthogonal to the SQL dialect axis (any dialect can be templated), so it is a **pre-stage that
wraps `parse(sql, dialect)`**, not a `DIALECTS` entry and NOT woven into the eight SQL grammars (Niclas's
standing guardrail — the tag front end is an isolated module with its own gates/ratchets).

The pipeline for `parseTemplated(text, dialect)`:

1. **Segment** the raw text over the OUTER jinja language into runs of literal SQL text and jinja tags
   (`{{ … }}` expression, `{% … %}` statement, `{# … #}` comment, each with the four whitespace-control
   variants `{{- -}}` / `{%- -%}` / `{#- -#}`). Jinja is the outer language: a `{{ … }}` inside what
   *looks like* a SQL string literal IS a jinja tag (dbt renders into SQL strings — `WHERE n =
   '{{ var("x") }}'` templates the string content). The segmenter respects only JINJA's own nesting:
   `{% raw %}…{% endraw %}` (contents are literal, no tags), `{# … #}` comments, and string literals
   *inside* a tag's expression (`{{ ref('a}}b') }}` — the `}}` inside the string is not a close). It does
   NOT respect SQL string/comment boundaries.
2. **Placeholder-substitute** into a length-preserving, newline-preserving copy of the text that feeds the
   UNTOUCHED per-dialect SQL lexer. Because every placeholder occupies the exact character range (and
   preserves `\n` count and position) of the tag it replaces, every antlr `start/stop/line/column` the SQL
   lexer produces is already in ORIGINAL document coordinates — no span remap for SQL tokens outside tags.
   The inc1 placeholder shape is the POSITIONAL DEFAULT, and it is NO-OUTPUT-AWARE (§ the hole — anvil
   flagged, 2026-07-04: an identifier placeholder for `{{ config(...) }}` at statement position is a
   syntax error, and config-topped models are the majority):
   - `{{ call }}` where the leading call name ∈ **`NO_OUTPUT_BUILTINS`** (`config`, `docs`, `print`,
     `log`, `return`, `exceptions` — the dbt builtins that emit no SQL text) → **newline-preserving
     whitespace** (vanishes cleanly, whatever the slot). Same set the extension's blanker special-cases.
   - `{{ expr }}` otherwise → a single **identifier-shaped** placeholder (keeps the SQL parse valid where
     an identifier/value can appear — the common case: `FROM {{ ref('x') }}`, `SELECT {{ var('c') }}`).
   - `{% stmt %}` and `{# comment #}` → **newline-preserving whitespace** (no SQL output).
   The `NO_OUTPUT_BUILTINS` set is a small built-in DEFAULT (dbt-syntax-level: "these builtins produce no
   text"), the pre-catalog stand-in for inc3's `expansionShape → undefined`/no-output answer — optional
   over defaults: the catalog overrides it per-macro later. An unknown callable at statement position
   (a bare custom macro call) still gets the identifier default and may not parse — the residual
   fragment/statement class, a known inc1 limit the extension covers with its fallback until inc3.
3. **Lex** the placeholder string with the existing `fns.parse` / `tokenize` (grammars untouched).
4. **Merge** into ONE source-ordered `Token[]`: the SQL tokens (default channel 0, original coords) plus
   the jinja tokens (new **channel 2**, role `"jinja"`) from the jinja lexer, interleaved by offset. The
   merge happens on the `ParseResult` (outside the lazy antlr token getter), so it is computed once.
5. **Parse the tag interiors** with the standalone jinja grammar into the R2 tag-AST nodes
   (ref/source/macro-call) with the exact span contract (§ R2).
6. **Total / error-tolerant (R5):** a half-typed `{{ ref(` never throws — the same mandate as `lower()`'s
   totality on broken SQL. A malformed tag yields a best-effort node + a positioned diagnostic, never an
   exception.

### The grammar — `grammars/jinja/` (standalone split pair)

`grammars/jinja/JinjaLexer.g4` + `JinjaParser.g4`, generated to `src/generated/jinja/` by the existing
`tools/gen.mjs` (no driver change; the alphabetical Lexer-before-Parser sort resolves `tokenVocab`).

- **Lexer — island modes**, patterned on the postgres dollar-quote precedent (`PostgresLexer.g4`
  `pushMode(DollarQuotedStringMode)` … `popMode`): a DEFAULT mode emits raw-text tokens and, on an opening
  delimiter (`{{`/`{%`/`{#`, optionally `-`), pushes the matching interior mode (ExprMode / StmtMode /
  CommentMode); the closing delimiter (optionally `-`) pops. `{% raw %}` pushes a raw mode that only
  matches `{% endraw %}`. Interior modes lex the jinja expression tokens (identifiers, strings, numbers,
  operators, `|`, `~`, `.`, `[`, `]`, `(`, `)`, `,`, `:`, keywords `and/or/not/in/is/if/else/for/set/…`).
- **Parser — Q2 scope for inc1:** parse enough to satisfy R2 — CALL expressions (`name(args)`,
  `pkg.macro(args)`, nested `outer(inner(…))`, string-literal args, dotted names, keyword args
  `k=v`, top-level-comma arg splitting with nested parens respected) and the statement-tag keywords
  (`if/elif/else/endif`, `for … in … [if …]`, `set`, `macro`, `endX`, …) enough to TOKENIZE and region
  them. The full expression language (filters `|`, tests `is`, arithmetic, `~`, conditional `if/else`,
  slices, lists/dicts/tuples) is **opaque-tolerated** at inc1 — lexed onto the jinja channel, captured as
  tag text, but not structured. It tightens in later increments as consumers need it.

### The hole — inc1 is the positional default; shape comes later

A macro can expand to arbitrary SQL — a column list, a whole predicate, a join, a CTE. That is Q1, and
Niclas decided it: **parse-with-holes + typed shape, never render.** For inc1 (placeholder-parity), the
hole is the POSITIONAL DEFAULT — a **no-output builtin** (`config`/`docs`/`print`/`log`/`return`/
`exceptions`) → whitespace (it emits no SQL, whatever the slot); any other callable in a value/identifier
slot → one identifier placeholder. This matches the extension's current pass-1 blanking exactly (its
`STATEMENT_MACROS` blank-to-space set + identifier placeholder for the rest): the same cases parse, the
same cases fail. The
known-failing class at inc1 (parity, not regression): a macro emitting a SQL FRAGMENT — an operator
(`WHERE x {{ op() }} 5`), a comma-carrying column list (`SELECT {{ dbt_utils.star(…) }}` in strict count
contexts), a statement fragment — where a single identifier placeholder can't fuse with adjacent tokens.
Those do not parse cleanly at inc1, exactly as blanking doesn't today; at edit-time the user still gets
feedback on the rest of the query, and the assembled-query-runs question is answered by the
validation-time real-dbt render (the two-path model). The FIX for the fragment class is the shaped hole:
`expansionShape(macroCall) → 'expr'|'column-list'|'predicate'|'relation'|'statement'` supplies a
shape-valid placeholder — that is inc2/inc3 (the TemplateCatalog), not inc1.

**The one sqllens ask (committed, CHANNEL 05:10):** the hole/tag node carries its SYNTACTIC-SLOT context —
the SQL slot it sits in (`column-list` / `predicate` / `relation` / `statement` / `expr`), derivable from
where the placeholder landed in the SQL parse — so the extension's quick-fix can pre-fill the smart
default. The inc1 `TagNode` does NOT yet carry this slot field (its shape is the R2 span contract only —
ref/source/macro/var/config/control/other with spans); the field is a spec ask deferred to the increment
that needs it, when the positional default keys off it.

## R1 — the unified token stream (inc1 — built)

`parseTemplated(text, dialect)` / `tokenizeTemplated(text, dialect)` return one flat, source-ordered
`Token[]`: SQL tokens (channel 0, original coordinates via length-preserving placeholders) + jinja tokens
(channel 2, role `"jinja"`). `Token.channel` is already an int (0 default, 1 hidden) — channel 2 is
additive with zero type churn, and `document.tokenAt` already skips `channel !== 0`, so existing
default-channel consumers ignore jinja tokens for free. `TokenRole` gains a `"jinja"` member (a closed
union — every exhaustive role `switch` is revisited in the same change). Multi-line correct: a tag
spanning newlines carries a correct multi-line span (the extension's extractors are single-line-lossy
today; R2 fixes this — it is a parity UPGRADE, needs its own test).

## R2 — the tag-AST span contract (inc1 — built)

The ref/source/macro-call nodes, with a span for every field below (sqllens convention: 1-based line,
0-based column, 0-based offsets — the extension applies its own `line - 1`). These are the HARD contract:
extension providers position hover/rename/signature-help exactly on them.

- **ref node:** `model` (string-literal content, quotes EXCLUDED); span of the `ref(` call; `modelSpan`
  (model-name content, quotes excluded); `tagSpan` (the whole `{{ ref(…) }}` including delimiters).
- **source node:** `sourceName`, `tableName` (both string contents); `sourceNameSpan`, `tableNameSpan`
  (quotes excluded); `tagSpan`.
- **macro-call node** (richest — drives signature help): `name` (bare macro name) + `nameSpan`;
  `packageName?` + `packageSpan?` (for `pkg.macro(…)`); `tagSpan` (the enclosing `{{ }}` OR `{% %}`);
  `argsSpan` (opening-paren offset → closing-paren exclusive end); `args: { span }[]` — PER-ARGUMENT
  spans, source order, top-level-comma split (nested parens respected), supporting `outer(inner(…))` and
  `pkg.macro(…)`.
- **var/env_var/config recognition:** `config/docs/print/log/return/exceptions` produce no SQL output;
  `var/env_var` produce a value. These classifications survive as node kinds (they feed the catalog's
  shape/value answers later).

`PartSpan` (`src/ir/part-span.ts`, absolute 0-based offsets + 1-based line / 0-based col) is the ready-made
span carrier. Tag nodes are additive — they ride a jinja-artifact facade on the result / `SqlDocument`
(another cached artifact alongside tokens/cst/ast), not a change to the SQL IR. Where a `{{ ref('x') }}`
in a FROM slot should become a real table-source IR node (R3), that is inc2.

## R3 — templated refs as first-class FROM nodes (inc2 design, decided 2026-07-04)

`{{ ref('x') }}` / `{{ source('a','b') }}` in a FROM/JOIN slot becomes a real `TableSource` carrying its
tag, so scope/qualify/lineage/columnGraph see the model, not the placeholder. The design rides two
existing invariants — scope binds a `TableSource` purely by `name`, and the IR is frozen after `lower()` —
so the whole downstream pipeline works unchanged:

- **IR (additive):** `TableSource` gains `template?: TemplateSourceInfo`; the type lives in `src/ir/ir.ts`
  (neutral — the IR never imports `src/jinja`): `{ kind: "ref" | "source" | "macro"; span: PartSpan;
  opaque?: true }` — the tag's kind, the whole-tag span (document coordinates), and the opacity verdict.
  Consumers needing the full `TagNode` correlate by span with `parseTemplated().tags`.
- **Name substitution (literal-only, never-wrong):** `ref('x')` → `name: ["x"]`; `source('a','b')` →
  `name: ["a","b"]` — the dbt-logical names as written in-text (the razor: in-text structural). A macro or
  computed tag in a FROM slot keeps the placeholder name and gets `opaque: true` — its output relation is
  undeterminable without the catalog. (inc1's `directStringToken` guard already guarantees a `ref`/`source`
  TagNode carries only literal names.)
- **The transform (`src/jinja/apply-tags.ts`):** post-lower, `applyTemplateTags(ast, tags)` walks the IR
  (bodies, CTEs, sources, joins, subqueries, pipe stages), correlates by CONTAINMENT — a `TableSource`
  whose first name token's offset lies inside a tag's `tagSpan` (containment, not equality: a multi-line
  expr tag fills as one placeholder identifier per line) — and rebuilds with structural sharing (new
  objects only on changed paths; frozen subtrees are safely shared), re-freezing the result.
  `parseTemplated().sql.ast` IS the transformed IR (one canonical ast; the raw placeholder parse is
  derivable via `parse(placeholder)`).
- **Qualify (one guard):** a source with `template` present is exempt from unknown-table AND
  unknown-column diagnostics — its physical relation is dbt knowledge (out-of-text), so a diagnostic
  against the dbt-logical name would be never-wrong-violating; inc3's `TemplateCatalog.relation` upgrades
  it to real resolution. Scope still binds the substituted name, so `orders.col` qualifies, lineage
  origins report `orders`, and references/documentHighlight work — all with zero changes to those passes.

## R4 — control-flow regions + template symbols (inc2 design, decided 2026-07-04)

- **Control-tag enrichment (additive on the `TagNode` union):** the `control` variant gains `keyword?`
  (`if`/`elif`/`else`/`endif`/`for`/`endfor`/`set`/`macro`/`endmacro`/…), `name?` + `nameSpan?` (the `set`
  target / `macro` name / `for` loop variable), extracted from the existing tolerant stmt parse tree.
- **Regions (`src/jinja/regions.ts`):** `templateRegions(tags)` stack-pairs control tags into a tree —
  `TemplateRegion { kind: "if" | "for" | "macro"; arms: TemplateArm[]; span }`, `TemplateArm { keyword;
  tagSpan; bodySpan; children: TemplateRegion[] }` (an arm's body runs from its tag's end to the next
  arm/close tag's start). Tolerant: unbalanced/broken input yields best-effort regions, never a throw.
- **Symbols:** `templateSymbols(tags)` → `TemplateSymbol { kind: "set" | "macro"; name; nameSpan; span }`
  (go-to-def on `{% set %}` / `{% macro %}`). Both ride `TemplatedParseResult` as additive `regions` /
  `symbols` fields.

## Variant realization (inc2 design, decided 2026-07-04)

**Arm-coverage enumeration, not cross-product:** variant k activates exactly one non-default arm in one
region (all other regions take their first arm); variant 0 is all-defaults. Linear in total arm count —
every text region is live in some variant, each variant is a coherent parse, no combinatorial explosion.
A `{% for %}` contributes no extra variant (its default IS the representative single iteration — the body
parses in place). A variant is realized by whitespace-blanking the INACTIVE arms' body ranges over the
original text (newline-preserving, coordinates intact) and feeding `parseTemplated`; results are lazy
(`TemplateVariant.parse()` memoized). **The primary `parseTemplated` result stays all-text-live** (inc1
parity — anvil integrated against it mid-flight); variants are the additive coherent-arm API
(`templateVariants(text, dialect)`), adopted by consumers when ready.

## The seam — TemplateCatalog (inc3, ITEM 11)

Generalizes `SchemaSource`: ref/source/var/macros are to the template layer what the schema is to SQL —
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

**Optional over defaults (the keystone):** `expansionShape → undefined` falls back to the positional guess;
a ZERO catalog still parses (defaults everywhere); with a catalog it parses precisely. Rendering is a
CATALOG RESPONSE, not architecture — how the extension answers `expansionShape` upgrades per-macro (v1
positional default → v2 macro signature → v3 real dbt render of that one macro) with sqllens frozen across
the gradient.

## Variant expansion (Q3 — resolved: it is parsing → sqllens's, inc2)

For the editor, sqllens enumerates ALL `{% if %}/{% elif %}/{% else %}` branches STRUCTURALLY with NO
condition evaluation (the user edits every arm regardless of which runs). Prefer genuine per-branch
coherent variants over a single merged region tree — a merged tree with two alternative WHEREs is
incoherent (it is exactly why the extension's `mergeModels` can only query by byte-range, never traverse).
Each enumerated variant is a coherent valid parse. `{% for %}`: a literal collection (`[1,2,3]`) expands
directly; an external collection (`{% for col in columns %}`) pulls from `TemplateCatalog.loopCollection`,
defaulting to a representative single iteration (body once, placeholder items). This relocates the
extension's `generateVariants`/`branch-enumerator`/coarse-tokenizer trio into sqllens. Internal
representation is sqllens's call; the point is it is the parser's job. (inc2 — needs R4 control-flow
regions first.)

## Increment plan

- **inc1 — placeholder-parity / raw-jinja-parse (R1 + R2) — BUILT.** The pre-lexer, the `grammars/jinja/`
  island grammar, the unified token stream, and the ref/source/macro tag-AST with the R2 span contract are
  shipped and total: `parseTemplated(text, dialect)` / `tokenizeTemplated` return one source-ordered
  `Token[]` (SQL channel 0/1 + jinja channel 2, role `"jinja"`) plus the `TagNode[]`, over the eight
  untouched SQL grammars — jinja reachable only through the barrel. Positional-default hole
  (NO_OUTPUT_BUILTINS-aware); the syntactic-slot context field is deferred (§ the hole). Gated by
  `tests/corpus/jinja.test.ts` over 15 `tests/fixtures/jinja/` fixtures (totality, byte-for-byte stream
  reconstruction, span in-bounds + content-true). This is the surface the extension consumes to retire its
  blanking cascade (`parse-with-jinja-fallback`, `jinja-blanker`, the fine tokenizer, the two-stream
  merge). No SQL-grammar change; no IR change beyond the additive jinja facade + `TokenRole "jinja"` /
  channel 2.
- **inc2 — tag-AST (R3 + R4) + variant expansion.** `{{ ref('x') }}` in a FROM/JOIN slot lowers to a
  first-class table-source IR node carrying its tag (R3 — feeds scope/qualify/lineage/columnGraph); control
  flow + `set`/`macro` become structured regions/symbols (R4 — completion inside `{{ }}`, go-to-def on
  `{% set %}`); variant expansion relocates in. Design decided 2026-07-04 — §R3 / §R4 / §Variant
  realization above are the binding shapes.
- **inc3 — TemplateCatalog wiring (ITEM 11).** The pull-callback seam: lazy relation/value resolution,
  synchronous `expansionShape` (shaped holes retire the fragment-macro limitation), `loopCollection`. Turns
  "parses with defaults" into "resolves `{{ ref }}` with real columns pre-compile."

Each increment is independently shippable to master with a channel ship note; the extension consumes per
increment (its `JINJA-CONSUMPTION-PLAN.md` maps each of its ~2,538 dying/relocating LOC to these).

## inc1 gates (the acceptance bar)

- A **jinja corpus** — real dbt model SQL (the extension's nba-monte-carlo / jaffle_shop samples are the
  starter; author a focused fixture set for the tag-shape edges: multi-line tags, whitespace-control,
  `{% raw %}`, nested `outer(inner())`, `pkg.macro`, `{{ ref }}` in FROM, `{{ var }}` in value slots,
  comments, a half-typed broken tag). Every file: `parseTemplated` is TOTAL (0 throws), the unified stream
  tiles the source (spans contiguous, no gaps/overlaps), and the SQL-channel spans round-trip to original
  coordinates.
- **R2 span assertions** — ref/source/macro nodes with offset-asserted spans against the source text
  (quotes-excluded content spans; per-argument spans; multi-line correctness — the parity upgrade).
- **Parity check** — for each fixture, the identifier-placeholder SQL parse matches the case the extension's
  pass-1 blanking parses (parses where it parses; the fragment-macro class fails where blanking fails,
  documented).
- Never-wrong: a tag node is emitted only where the jinja parse is confident; a malformed tag degrades to a
  best-effort node + diagnostic, never a wrong structure or a throw.

## Boundaries / open items

- **Q4 (extension-side, not sqllens):** whether the extension's nunjucks pass-2 survives — decided by the
  bridge's `compile_inline` coverage, not here.
- **Fragment-macro at inc1** is a known parity limitation (not a regression), retired by inc3's shaped hole.
- **One TagNode per tag (inc1 boundary).** `tagNodesOf` returns exactly ONE `TagNode` per tag — the
  leftmost-topmost call in the tag's parse tree. A tag with two sibling calls (`{{ [ref('a'), ref('b')] }}`)
  yields only the first; an arithmetic tag with an embedded call (`{{ x + ref('y') }}`) classifies off that
  call. Both are rare in real dbt (a FROM is a lone `{{ ref() }}`), and the emitted spans are still
  accurate for the node returned. A tracked inc1 boundary, retired when inc2 needs multi-node tags.
- **Debugger native Source Map (I2)** depends on sqllens owning the jinja→SQL transform (inc2+), the one
  extension piece with no shipped sqllens surface until then.
- **minijinja vs Jinja2 divergences** (division, import caching, silent undefined) are accept-syntax edges;
  encode minijinja, cite it, flag any surprise like the dialect fold-policy citations.
