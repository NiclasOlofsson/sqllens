# Jinja inc1 Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ITEM 10 increment 1 — parse raw jinja-SQL natively: a standalone jinja island grammar + a TS pre-lexer that segments tags, substitutes length/newline-preserving placeholders into the UNTOUCHED per-dialect SQL lexers, and returns ONE unified token stream (SQL + jinja channels) plus ref/source/macro tag-AST nodes with the R2 span contract. Positional-default holes = parity with the extension's pass-1 blanking. This lets the extension delete its blanking cascade.

**Architecture:** `docs/jinja-front-end.md` is the spec (read it first). The pre-lexer wraps `parse(sql, dialect)` — it is NOT a `DIALECTS` entry and touches NONE of the eight SQL grammars. A TS segmenter does the document-level outer-language scan (jinja nesting: `{% raw %}`, comments, strings-in-tags); the standalone `grammars/jinja/` split pair lexes+parses individual tag interiors. minijinja is the accept-syntax oracle.

**Tech Stack:** TypeScript (tabs), vitest two tiers, antlr-ng (`npm run gen -- jinja` after .g4 edits), tsgo, prettier.

## Global Constraints

- **Never-wrong**: a tag-AST node is emitted only where the jinja parse is confident; a malformed/half-typed tag degrades to a best-effort node + a positioned diagnostic, never a wrong structure or a throw.
- **Total (R5)**: `parseTemplated`/`tokenizeTemplated` never throw on any input, including broken mid-edit jinja — the same mandate as `lower()` totality.
- **The eight SQL grammars are UNTOUCHED.** No `grammars/<dialect>/` edit, no `src/<dialect>/` edit. Jinja is a pre-stage. The only shared-surface changes are additive: `TokenRole` gains `"jinja"`; a jinja token channel (int 2); new `src/jinja/` module; new barrel exports.
- **Length + newline preservation is the load-bearing invariant.** Every placeholder occupies the EXACT character range of the tag it replaces AND preserves the `\n` count and position, so antlr `start/stop/line/column` for SQL tokens stay in original document coordinates with no remap. A test asserts placeholder-string length === source length and newline positions identical.
- **No gate weakened.** All existing tier-1 + tier-2 green (this is purely additive — the SQL path is unchanged; prove it). New jinja corpus gate added.
- **Position convention:** sqllens 1-based line, 0-based column, 0-based offsets. The extension applies its own `line - 1`. R2 span fields follow this.
- Subagents on Opus or Sonnet 5, never Fable. Tabs; format the FILES YOU TOUCH (`npx prettier --write <files>`, NOT `npm run format` — the whole-repo run times out). Commits end with:
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
- Do NOT touch `docs/anvil/CHANNEL.md` — the controller posts ship notes.
- Escalate (BLOCKED, park on the channel via the controller) any genuinely NEW architecture fork; the decided path (spec) you build.

---

## TASK 1 — The jinja island grammar (`grammars/jinja/`)

**The foundational, riskiest piece — proven in isolation before anything builds on it.** A standalone split lexer+parser pair that lexes and parses ONE jinja tag's text (delimiters included) into a parse tree. It does NOT scan whole documents (the segmenter does that, Task 2) — it operates per-tag on text like `{{ ref('x') }}` or `{% if cond %}`.

**Files:**
- Create: `grammars/jinja/JinjaLexer.g4`, `grammars/jinja/JinjaParser.g4`
- Test: `tests/jinja.grammar.test.ts` (tier 1)
- Generate: `npm run gen -- jinja` → `src/generated/jinja/`

**Grammar design (spec §mechanism; minijinja oracle):**
- **Lexer — island modes** (precedent: `grammars/postgres/PostgresLexer.g4` dollar-quote `pushMode`/`popMode`). DEFAULT mode: match an opening delimiter with optional whitespace-control dash — `{{`/`{{-`, `{%`/`{%-`, `{#`/`{#-` — each `pushMode` to ExprMode / StmtMode / CommentMode; also match raw literal text (any run not starting a delimiter) as `RAW_TEXT` (used when the grammar is fed a whole tag with trailing text, though per-tag input mostly won't need it — keep it so the lexer is total on any input). ExprMode/StmtMode lex jinja tokens: `ID`, `STRING` (single OR double quoted, with the doubled/backslash escapes minijinja accepts), `INT` (dec/`0x`/`0o`/`0b`, underscores), `FLOAT`, `TRUE`/`FALSE`/`NONE`, keywords (`and or not in is if else for endfor endif elif set endset macro endmacro call endcall filter endfilter block endblock extends include import from with endwith autoescape endautoescape raw endraw do`), punctuation (`( ) [ ] { } , : . | ~ = == != < <= > >= + - * / // % **`), and the closing delimiter `-}}`/`}}`, `-%}`/`%}` → `popMode`. CommentMode: match comment body + `-#}`/`#}` → popMode. A `mode RawMode` entered on `{% raw %}` is NOT needed here (the segmenter handles raw-block spanning — Task 2); a lone `{% raw %}` tag lexes as an ordinary stmt tag.
- **Parser** — entry `tag` = `expr_tag | stmt_tag | comment_tag`. `expr_tag: EXPR_OPEN expr? EXPR_CLOSE` (the interior is an `expr`). `stmt_tag: STMT_OPEN stmt? STMT_CLOSE`. `expr` — Q2 scope: model CALLS precisely (`call: (ID '.')* ID '(' arg_list? ')'` with `arg: (ID '=')? expr`, `arg_list: arg (',' arg)*` — nested calls via `expr` recursion, top-level commas by the arg_list structure), string/number/bool/none literals, dotted/subscript access, and grouping; the rest of the expression language (filters `|`, tests `is`, arithmetic, `~`, conditional) may be modeled with LOOSE/opaque alternatives (a permissive `expr` that accepts operator-separated primaries) — enough to not reject real dbt, precise enough that a `call` is recognizable. Do NOT over-invest in operator precedence at inc1; the goal is total + call-recognizing. `stmt: ID expr*` loose (recognize the leading keyword + tokenize the rest) — precise if/for/set structure is inc2.
- **Case-insensitive?** No — jinja keywords are lowercase; do NOT set `caseInsensitive`.

- [ ] **Step 1: failing tests.** Parse (via a small `parseJinjaTag(text)` wrapper you add in the test or a tiny `src/jinja/parse-tag.ts`) these isolated tags with 0 errors and the expected shape: `{{ ref('x') }}`, `{{ source('a', 'b') }}`, `{{ pkg.macro(1, nested(2), k=3) }}`, `{{ var("n") }}`, `{{ a.b.c }}`, `{{ x | upper }}` (filter opaque-tolerated, still 0 errors), `{{ x is defined }}` (test opaque-tolerated), `{% if cond %}`, `{% for x in items %}`, `{% set y = 1 %}`, `{% endif %}`, `{# a comment #}`, whitespace-control `{{- x -}}` / `{%- if a -%}`. And totality: `{{ ref(` (half-typed) yields a tree + >0 errors but NO throw.
- [ ] **Step 2: write the grammar**; `npm run gen -- jinja`; iterate to green. Each rule comment-cited to the minijinja syntax reference (repo convention).
- [ ] **Step 3: green** `npx vitest run tests/jinja.grammar.test.ts`; `npm run typecheck`.
- [ ] **Step 4: commit** `feat(jinja): island grammar — per-tag lexer modes + call-recognizing parser (minijinja oracle)` (+ trailer).

## TASK 2 — The segmenter + placeholder substitution (`src/jinja/segment.ts`)

The document-level outer-language scan. Given raw jinja-SQL text, produce the segment list and the length/newline-preserving placeholder string.

**Files:**
- Create: `src/jinja/segment.ts`
- Test: `tests/jinja.segment.test.ts` (tier 1)

**Interfaces (produced):**
```ts
export type Segment =
	| { kind: "sql"; start: number; end: number }                    // a raw SQL run (offsets, end exclusive)
	| { kind: "tag"; tagKind: "expr" | "stmt" | "comment"; start: number; end: number; text: string };
export interface SegmentResult {
	segments: Segment[];              // source order, tiling (contiguous, cover [0, text.length))
	placeholder: string;              // same length + same newline positions as the input
}
export function segment(text: string): SegmentResult;   // total, never throws
```

**Rules:**
- Scan char by char. On `{{` / `{%` / `{#` (NOT inside an already-open tag), open a tag; find its matching close (`}}` / `%}` / `#}`), respecting: a STRING inside a `{{ }}`/`{% %}` tag (`'...'` or `"..."`) whose content may contain `}}`/`%}` that does NOT close the tag; whitespace-control dashes are part of the delimiter. A `{# #}` comment has no interior strings.
- **`{% raw %} … {% endraw %}`**: when a stmt tag's keyword is `raw`, the region from after `{% raw %}` to before `{% endraw %}` is ONE `sql`-kind... no — it is a LITERAL run where NO tags are segmented; emit the `{% raw %}` and `{% endraw %}` as tags and everything between as a single `sql` segment (its `{{ }}`-looking content is literal). (If `{% endraw %}` is missing — broken input — treat to end-of-text as raw; total.)
- The placeholder string: copy the input; for each `tag` segment, replace its `[start,end)` with a filler of IDENTICAL length that (a) preserves every `\n` at its original position, and (b) chooses fill by the NO-OUTPUT-AWARE positional default (spec §the hole — anvil-flagged; `{{ config() }}` at statement position must NOT become an identifier):
  - **`expr` tag whose leading call name ∈ `NO_OUTPUT_BUILTINS`** (`config`, `docs`, `print`, `log`, `return`, `exceptions`) → **spaces** (preserving newlines) — it emits no SQL, vanishes cleanly whatever the slot. Detect the leading call name by a cheap pre-parse scan of the tag text (strip `{{`/`-`, skip whitespace, read the identifier before `(`); a shared `NO_OUTPUT_BUILTINS` const (also used by Task 4's R2 classification — single source of truth).
  - **`expr` tag otherwise** → fill non-newline chars with a letter (e.g. `j`) so `{{ref('x')}}` → `jjjjjjjjjjjj`, one valid SQL identifier token (a multi-line expr tag becomes identifier-fragments split by the preserved newlines — acceptable; the jinja channel carries the real tag).
  - **`stmt` / `comment` tag** → **spaces** (preserving newlines) — whitespace to SQL.
  (The no-output set is the pre-catalog default; inc3's `expansionShape` overrides it. An unknown callable at statement position still gets the identifier fill and may not parse — the residual fragment/statement class, a known inc1 limit, NOT a bug to fix here.)
- Total: unterminated tag → treat to end-of-text as that tag; never throw.

- [ ] **Step 1: failing tests.** `SELECT {{ ref('x') }} FROM t` → segments [sql, tag(expr), sql]; placeholder same length, the tag region all-`j`, newlines preserved. **`{{ config(materialized='table') }}\nSELECT 1` → the config tag region is all-SPACES (no-output), so the placeholder is a valid `<spaces>\nSELECT 1` that parses; assert the config region is spaces not `j`.** `WHERE n = '{{ var("a}}b") }}'` → the `}}` inside the tag's string does NOT close it (one expr tag). `{% raw %}{{ x }}{% endraw %}` → tag(stmt raw), sql (the `{{ x }}` literal, NOT segmented), tag(stmt endraw). `{# c #}` → tag(comment), placeholder all-spaces. Multi-line `{{\n ref('x')\n}}` → newlines at the same offsets in placeholder. Broken `SELECT {{ ref(` → total, one tag to EOF. Property: `placeholder.length === text.length` and newline offsets identical, over every case.
- [ ] **Step 2: implement**; **Step 3: green**; **Step 4: commit** `feat(jinja): segmenter — outer-language scan + length/newline-preserving placeholders` (+ trailer).

## TASK 3 — `parseTemplated` / `tokenizeTemplated` + the unified token stream (`src/jinja/parse.ts`)

Glue: segment → SQL lex over the placeholder → jinja lex per tag → merge one source-ordered `Token[]`.

**Files:**
- Create: `src/jinja/parse.ts`
- Modify: `src/token/token.ts` (`TokenRole` gains `"jinja"`; revisit every exhaustive `TokenRole` switch — grep `TokenRole` — most are classify/color maps that get a `"jinja"` arm), `src/token/classify.ts` (a jinja classify path or a passthrough for jinja-lexer token names)
- Test: `tests/jinja.parse.test.ts` (tier 1)

**Interfaces (produced):**
```ts
export interface TemplatedParseResult {
	tokens: Token[];                 // ONE source-ordered stream: SQL (channel 0) + jinja (channel 2)
	sql: ParseResultIR;              // the underlying SQL parse over the placeholder (ast/cst/errors)
	tags: TagNode[];                 // R2 nodes (Task 4 fills these; Task 3 may leave [] and Task 4 wires)
	diagnostics: SyntaxDiagnostic[]; // SQL + jinja, positioned in original coords
}
export function parseTemplated(text: string, dialect: Dialect): TemplatedParseResult;   // total
export function tokenizeTemplated(text: string, dialect: Dialect): Token[];              // total
```

- Segment → `parse(placeholder, dialect)` (the existing untouched entry; its tokens are in original coords by length-preservation). For each `tag` segment, lex its text with the jinja lexer, map each jinja lexer token to a neutral `Token` (channel **2**, role `"jinja"`, spans offset by the tag's `start`). Merge SQL tokens (drop the placeholder's filler tokens that fall INSIDE a tag region — they are `jjj` garbage; the jinja tokens replace them) with jinja tokens, sorted by `start`. Result tiles the source.
- Total: wrap in try/catch → a best-effort result (worst case: the whole text as SQL, jinja tokens empty) — never throw.

- [ ] **Step 1: failing tests.** `SELECT {{ ref('x') }} FROM t` (databricks): unified `tokens` has `SELECT`(sql), then jinja tokens for `{{ ref ( 'x' ) }}` (channel 2), then `FROM t`(sql); the placeholder's `jjj` identifier tokens inside the tag region are NOT present; spans tile the source; `sql.ast` is a valid select (identifier in the projection slot). Totality: `parseTemplated("SELECT {{ ref(", "databricks")` returns, no throw. Do it for 2-3 dialects (databricks, snowflake, postgres) to prove dialect-agnostic.
- [ ] **Step 2: implement** + the `TokenRole "jinja"` additions (fix every switch the compiler flags). **Step 3: green** + full `npm test` (the SQL suites must not notice — additive). **Step 4: commit** `feat(jinja): parseTemplated/tokenizeTemplated — unified SQL+jinja token stream over the untouched SQL lexers` (+ trailer).

## TASK 4 — R2 tag-AST (`src/jinja/tag-ast.ts`)

Walk the per-tag jinja parse trees into ref/source/macro-call nodes with the R2 span contract.

**Files:**
- Create: `src/jinja/tag-ast.ts`
- Modify: `src/jinja/parse.ts` (populate `tags`)
- Test: `tests/jinja.tag-ast.test.ts` (tier 1)

**Interfaces (produced) — the R2 contract (spec §R2), spans as `PartSpan` (offset to DOC coords):**
```ts
export type TagNode =
	| { kind: "ref"; model: string; modelSpan: PartSpan; callSpan: PartSpan; tagSpan: PartSpan }
	| { kind: "source"; sourceName: string; tableName: string; sourceNameSpan: PartSpan; tableNameSpan: PartSpan; tagSpan: PartSpan }
	| { kind: "macro"; name: string; nameSpan: PartSpan; packageName?: string; packageSpan?: PartSpan;
	    tagSpan: PartSpan; argsSpan?: PartSpan; args: { span: PartSpan }[] }
	| { kind: "var" | "env_var" | "config" | "control" | "other"; tagSpan: PartSpan };   // classify the rest
export function tagNodesOf(tag: Segment & { tagKind }, tree: JinjaTagContext, docOffset: number): TagNode | undefined;
```
Recognize `ref('x')` / `source('a','b')` / `pkg.macro(args)` by the leading call name; string-content spans EXCLUDE quotes; per-argument spans by the arg_list children; multi-line correct (a tag spanning newlines → correct multi-line `PartSpan`). `var`/`env_var`/`config`/`docs`/`print`/`log`/`return`/`exceptions` classified by name; `{% if/for/set/… %}` → `control`; anything else → `other`.

- [ ] **Step 1: failing tests** — the R2 span assertions, offset-asserted against source text: `{{ ref('my_model') }}` → model `"my_model"`, modelSpan covers `my_model` (no quotes), tagSpan covers `{{ ref('my_model') }}`. `{{ source('sch', 'tbl') }}` → both content spans quote-excluded. `{{ my_pkg.build(a, nested(b), k=c) }}` → name `build`, packageName `my_pkg` + span, 3 arg spans (`a`, `nested(b)`, `k=c`) source-ordered top-level-comma-split, argsSpan paren-to-paren. Multi-line `{{ ref(\n 'x'\n) }}` → correct multi-line spans (the parity UPGRADE). `{{ var('v') }}` → kind var.
- [ ] **Step 2: implement**; wire into `parseTemplated.tags`. **Step 3: green** + `npm test`. **Step 4: commit** `feat(jinja): R2 tag-AST — ref/source/macro nodes with the exact span contract` (+ trailer).

## TASK 5 — Public surface + jinja corpus gate

**Files:**
- Modify: `src/api.ts` + `src/index.ts` (export `parseTemplated`, `tokenizeTemplated`, `TemplatedParseResult`, `TagNode`), `src/document/document.ts` (OPTIONAL — only if a `SqlDocument.fromTemplated` facade is trivially additive; otherwise defer to inc2, note it)
- Create: `tests/corpus/jinja.test.ts` (tier 2), `tests/fixtures/jinja/` (a focused fixture set) — OR wire the extension's nba/jaffle samples if `SQL_CORPUS_DIR` carries them (check; else author fixtures in-repo).
- Test: the corpus gate

**The gate:** over every fixture — `parseTemplated` is TOTAL (0 throws), the unified stream tiles the source (contiguous, no gaps/overlaps), SQL-channel spans round-trip to original coordinates, and every ref/source/macro node's spans are within the source. Fixture edges: multi-line tags, whitespace-control, `{% raw %}`, nested `outer(inner())`, `pkg.macro`, `{{ ref }}` in FROM, `{{ var }}` in a value slot, comments, a half-typed broken tag, a `{% for %}`/`{% if %}` document.

- [ ] **Step 1:** author fixtures (or wire samples). **Step 2:** the gate test. **Step 3:** barrel exports + a smoke test through the public surface. **Step 4:** full `npm test` + `npm run test:corpus` green. **Step 5: commit** `feat(jinja): public parseTemplated/tokenizeTemplated + jinja corpus gate` (+ trailer).

## TASK 6 — Close

- [ ] `docs/jinja-front-end.md`: flip inc1 from "SPEC/not built" to built-current-state (what shipped; what stays for inc2/3). PLAN.md pointer line updated. CLAUDE.md: a jinja front-end paragraph in Current status (current-state, no AI-tells).
- [ ] `npm test` + `npm run test:corpus` green; format the touched files.
- [ ] Final commit `docs: jinja inc1 close`. Controller posts the WAVE-END ship note (inc1 surface + what the extension can now delete).

---

## Self-review notes

- **Coverage vs the spec's inc1:** grammar (T1) → segmenter (T2) → unified stream (T3, R1) → tag-AST (T4, R2) → surface+gate (T5) → close (T6). R1 = T3; R2 = T4; totality threaded through all; positional-default hole in T2's placeholder; syntactic-slot context is derivable in T3/T4 from where the placeholder landed — inc1 records the tag's SQL-slot where cheap, else defers the field's population to inc2 (note it, don't fake it).
- **Dependencies:** strictly 1→2→3→4→5→6. T1 (grammar) is the de-risking gate — its review confirms the architecture before T2+ build on it.
- **Honest risk flags:** (a) T1's opaque-tolerant `expr` is the tightrope — too loose and a `call` isn't recognizable, too strict and real dbt is rejected; the minijinja fixtures are the guard, and "recognize calls, tolerate the rest" is the explicit target. (b) T2's placeholder expr-fill-as-identifier across newlines splits a multi-line expr tag into per-line identifier fragments — acceptable (the jinja channel carries the real tag; the SQL parse just needs A valid token per line), but a fixture must prove the multi-line case doesn't break the SQL parse. (c) The fragment-macro class (`x {{ op() }} 5`) is OUT of scope at inc1 by the spec (parity limitation) — do NOT try to solve it here; a fixture documents it as known-failing, not a bug. (d) If T3's placeholder-token-drop-inside-tag proves fiddly (SLL vs LL token buffers), the fallback is to drop by offset-range against the tag segments — named, not a blocker.
