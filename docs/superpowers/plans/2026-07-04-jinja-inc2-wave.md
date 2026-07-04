# Jinja inc2 Wave Implementation Plan (R3 + R4 + variants)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** inc2 of the jinja front end — `{{ ref('x') }}`/`{{ source('a','b') }}` in FROM/JOIN slots become first-class `TableSource` IR nodes (R3, on anvil's critical path for live lineage), control flow + `set`/`macro` become structured regions/symbols (R4), and variant expansion relocates in — per the decided design in `docs/jinja-front-end.md` §R3/§R4/§Variant realization (READ THOSE SECTIONS FIRST; they are binding).

**Architecture:** R3 = one additive IR field (`TableSource.template`) + a post-lower structural-sharing transform in `src/jinja/apply-tags.ts` + ONE qualify guard; scope/lineage/references need ZERO changes (scope binds by `name`, which the transform substitutes). R4 = additive enrichment of the `control` TagNode + a tolerant stack-pairing pass. Variants = arm-coverage enumeration (linear, not cross-product), lazily parsed. The primary `parseTemplated` result stays all-text-live (inc1 parity — anvil integrated against it mid-flight); everything here is additive.

**Tech Stack:** TypeScript (tabs), vitest two tiers, tsgo typecheck, prettier (TOUCHED FILES ONLY — `npx prettier --write <files>`, never `npm run format`, it times out).

## Global Constraints

- **Never-wrong contract.** A fabricated name, span, or diagnostic is a defect. Name substitution is LITERAL-ONLY (inc1's `directStringToken` guard already ensures `ref`/`source` TagNodes carry only literal names); anything else is `opaque: true`. A qualify diagnostic against a templated source is a never-wrong violation (its physical relation is dbt knowledge) — suppressed until inc3's catalog.
- **Additive-only.** The eight SQL grammars and all `src/<dialect>/` files are UNTOUCHED (`grammars/jinja/` is ours and MAY change). All new public surface is additive; `parseTemplated`'s existing fields keep their meaning EXCEPT `sql.ast`, which becomes the tag-applied IR (decided — the channel WAVE-START flags it to anvil; it is exactly what their lineage needs).
- **Totality.** Every new pass (transform, regions, symbols, variants) never throws on broken/partial input — best-effort results, same mandate as `lower()`.
- **No gate weakened, ever.** Tier-1 `npm test` + tier-2 `npm run test:corpus` green before merge; the jinja corpus gate's existing assertions must keep passing byte-identically.
- **IR immutability.** The IR is frozen after `lower()` (`src/ir/freeze.ts` `freezeIR`). The transform REBUILDS (structural sharing — new objects only on changed paths) and re-freezes; it never mutates.
- Subagents on Opus or Sonnet 5, never Fable. Commits end with:
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
- Do NOT touch `docs/anvil/CHANNEL.md` (the controller posts channel notes).
- Worktree: all work in the wave worktree on branch `worktree-jinja-inc2`.

---

## TASK 1 — R3 core: the IR field + the apply-tags transform

**Files:**
- Modify: `src/ir/ir.ts` (add `TemplateSourceInfo`, add `template?` to `TableSource` — around line 490)
- Create: `src/jinja/apply-tags.ts`
- Modify: `src/jinja/parse.ts` (wire the transform into `parseTemplated`; `sql.ast` becomes the transformed IR)
- Test: `tests/jinja.apply-tags.test.ts`

**Interfaces:**
- Consumes: `TagNode` (src/jinja/tag-ast.ts), `QueryExpr`/`Source`/`TableSource` (src/ir/ir.ts), `PartSpan` (src/ir/part-span.ts), `freezeIR` (src/ir/freeze.ts).
- Produces: `TemplateSourceInfo` on the IR; `applyTemplateTags(ast: QueryExpr, tags: TagNode[]): QueryExpr` (exported from apply-tags.ts); `parseTemplated().sql.ast` = transformed IR.

The IR addition (`src/ir/ir.ts`, next to `TableSource` — the type is IR-neutral, NO import from src/jinja):

```ts
/** Present when a source was written as a jinja template tag ({{ ref('x') }} / {{ source('a','b') }} /
 *  a macro call in a FROM slot). Attached post-lower by the jinja front end (src/jinja/apply-tags.ts);
 *  plain SQL parses never carry it. `opaque: true` = the tag's output relation is undeterminable
 *  (macro / computed ref) and `name` is the raw placeholder — qualify treats the source as an opaque
 *  relation (no unknown-table/-column diagnostics). Without `opaque`, `name` carries the tag's literal
 *  dbt-logical name parts (ref model, or [sourceName, tableName]). */
export interface TemplateSourceInfo {
	kind: "ref" | "source" | "macro";
	/** The whole tag's span ({{ … }} inclusive), document coordinates. */
	span: PartSpan;
	opaque?: true;
}
```
and on `TableSource`: `template?: TemplateSourceInfo;` (after `declaredColumns`, same additive style).

The transform (`src/jinja/apply-tags.ts`):
- `applyTemplateTags(ast: QueryExpr, tags: TagNode[]): QueryExpr` — returns `ast` unchanged (same reference) when no tag correlates.
- Correlation: a `TableSource` correlates with a tag when the offset of its FIRST NAME TOKEN lies inside the tag's `tagSpan` `[start, end)`. Get the offset from the source's `cst` start token (`cst.start.start` in antlr4ng char offsets). CONTAINMENT, not equality — a multi-line expr tag fills one placeholder identifier per line, so the name token covers only the first line.
- Substitution: tag kind `ref` → `{ ...src, name: [tag.model], template: { kind: "ref", span: tag.tagSpan } }`; kind `source` → `name: [tag.sourceName, tag.tableName]`, `template: { kind: "source", span: tag.tagSpan }`; kind `macro` (only when the source's name token is inside the tag — i.e. the macro call occupies the FROM slot) → name UNCHANGED (placeholder stays, honest), `template: { kind: "macro", span: tag.tagSpan, opaque: true }`. Other tag kinds (var/config/control/other): NO template attachment (a `{{ var('x') }}` used as a value is not a relation; a partial-name templating like `{{ var('schema') }}.orders` keeps its placeholder name part — documented boundary, Task 6 records it).
- Walk: recursive over `QueryExpr` — `ctes[].body`, the body's variants (`SelectExpr.sources[]` + each source's joins if the IR nests them — READ `src/ir/ir.ts`'s actual `SelectExpr`/`Join` shapes first and follow them exactly), `SetOpExpr` sides, `PipeExpr` base + stages, `SubquerySource.query`, lateral sources' inner queries. Structural sharing: a node is recreated ONLY if it or a descendant changed; otherwise return the original reference. Re-freeze the result with `freezeIR` ONLY when anything changed (the input was already frozen).
- Total: never throws; on any internal surprise return the input `ast`.

Wiring (`src/jinja/parse.ts`): in `build()`, after the SQL parse and tag extraction, `sql.ast = applyTemplateTags(sql.ast, tags)` (adjust to the actual result-assembly code — `sql` is the `ParseResultIR`; keep the assignment inside the existing try/catch so totality holds).

- [ ] **Step 1: Write the failing tests** (`tests/jinja.apply-tags.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { parseTemplated } from "../src/index.js";

function firstSource(ast: any): any {
	// navigate QueryExpr → body select → sources[0]; follow the repo's existing test helpers if one exists
	return ast.body.sources[0];
}

describe("R3 apply-tags", () => {
	it("ref in FROM substitutes the model name and attaches template", () => {
		const r = parseTemplated("SELECT o.id FROM {{ ref('orders') }} o", "databricks");
		const src = firstSource(r.sql.ast);
		expect(src.kind).toBe("table");
		expect(src.name).toEqual(["orders"]);
		expect(src.alias).toBe("o");
		expect(src.template).toMatchObject({ kind: "ref" });
		expect(src.template.opaque).toBeUndefined();
	});
	it("source() substitutes two-part name", () => {
		const r = parseTemplated("SELECT * FROM {{ source('raw', 'events') }}", "databricks");
		const src = firstSource(r.sql.ast);
		expect(src.name).toEqual(["raw", "events"]);
		expect(src.template).toMatchObject({ kind: "source" });
	});
	it("macro call in FROM stays placeholder-named but opaque", () => {
		const r = parseTemplated("SELECT * FROM {{ my_macro() }} m", "databricks");
		const src = firstSource(r.sql.ast);
		expect(src.template).toMatchObject({ kind: "macro", opaque: true });
		expect(src.name).not.toEqual(["my_macro"]); // the placeholder, NOT a fabricated name
	});
	it("multi-line ref correlates by containment", () => {
		const r = parseTemplated("SELECT * FROM {{ ref(\n  'orders'\n) }}", "databricks");
		expect(firstSource(r.sql.ast).name).toEqual(["orders"]);
	});
	it("ref inside a CTE body and a JOIN both substitute", () => {
		const sql = "WITH c AS (SELECT * FROM {{ ref('a') }}) SELECT * FROM c JOIN {{ ref('b') }} b ON c.x = b.x";
		const r = parseTemplated(sql, "databricks");
		const ast: any = r.sql.ast;
		expect(firstSource(ast.ctes[0].body).name).toEqual(["a"]);
		// find the join's source (follow the IR's actual join shape)
	});
	it("plain SQL (no tags) returns the identical ast reference", () => {
		const r = parseTemplated("SELECT 1", "databricks");
		expect(r.sql.ast).toBeDefined(); // and applyTemplateTags(ast, []) === ast — test via direct import
	});
	it("result is frozen", () => {
		const r = parseTemplated("SELECT * FROM {{ ref('orders') }}", "databricks");
		expect(Object.isFrozen(firstSource(r.sql.ast))).toBe(true);
	});
	it("total on broken templated input", () => {
		expect(() => parseTemplated("SELECT {{ ref( FROM {{", "databricks")).not.toThrow();
	});
});
```
Adjust navigation helpers to the REAL IR shapes (read `src/ir/ir.ts` first; `QueryExpr.body` discrimination, join placement). Do not weaken the assertions.

- [ ] **Step 2:** Run: `npx vitest run tests/jinja.apply-tags.test.ts` — expect FAIL (no `applyTemplateTags`).
- [ ] **Step 3:** Implement `src/ir/ir.ts` addition + `src/jinja/apply-tags.ts` + the `parse.ts` wiring, per the design above.
- [ ] **Step 4:** Run the file green, then `npm test` (tier 1 — the existing jinja suites must stay green: the corpus gate's byte-for-byte and span assertions are untouched by an ast-only change) and `npm run typecheck`.
- [ ] **Step 5:** Format touched files; commit `feat(jinja): R3 — templated ref/source as first-class TableSource nodes (apply-tags transform)`.

## TASK 2 — R3 semantics: the qualify guard + pipeline proof

**Files:**
- Modify: `src/qualify/qualify.ts` (the unknown-table emission ~line 406 and the unknown-column path — read the file; ONE guard: a source with `template` present is exempt from both)
- Test: `tests/jinja.pipeline.test.ts`
- Modify: `tests/corpus/jinja.test.ts` (extend the gate: every ref/source fixture asserts the template field + substituted name; zero qualify diagnostics against templated sources)

**Interfaces:**
- Consumes: Task 1's `TableSource.template`; `resolveScopes`/`qualify`/`Lineage.originsOf`/`referencesAt` from the barrel.
- Produces: qualify exemption for templated sources; the pipeline proven end-to-end (the anvil critical-path deliverable).

- [ ] **Step 1: Failing tests** (`tests/jinja.pipeline.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { parseTemplated, toScopes, qualify, Lineage, Schema } from "../src/index.js";

describe("R3 pipeline — scope/qualify/lineage over templated sources", () => {
	const sql = "SELECT o.id, o.total FROM {{ ref('orders') }} o WHERE o.total > 0";
	it("scope binds the ref model name; o.id resolves", () => {
		const r = parseTemplated(sql, "databricks");
		const scopes = toScopes(r.sql.ast);
		expect(scopes).toBeDefined(); // and the source binds as "orders"/"o" — assert via the scope API's source list
	});
	it("lineage origins report the model, not the placeholder", () => {
		const r = parseTemplated(sql, "databricks");
		const origins = Lineage.originsOf(r.sql.ast, "id");
		expect(JSON.stringify(origins)).toContain("orders");
	});
	it("qualify with a schema that lacks the model emits NO unknown-table/-column", () => {
		const r = parseTemplated(sql, "databricks");
		const schema = new Schema({ other_table: { x: "int" } });
		const q = qualify(r.sql.ast, schema);
		const bad = q.diagnostics.filter((d: any) => d.kind === "unknown-table" || d.kind === "unknown-column");
		expect(bad).toEqual([]);
	});
	it("qualify against a NON-templated unknown table still fires (guard is scoped)", () => {
		const r = parseTemplated("SELECT * FROM real_missing_table", "databricks");
		const q = qualify(r.sql.ast, new Schema({ other: { x: "int" } }));
		expect(q.diagnostics.some((d: any) => d.kind === "unknown-table")).toBe(true);
	});
	it("opaque macro source: no diagnostics, columns unknown", () => {
		const r = parseTemplated("SELECT m.col FROM {{ my_macro() }} m", "databricks");
		const q = qualify(r.sql.ast, new Schema({ other: { x: "int" } }));
		const bad = q.diagnostics.filter((d: any) => d.kind === "unknown-table" || d.kind === "unknown-column");
		expect(bad).toEqual([]);
	});
});
```
Adjust API-shape details (Schema construction, qualify signature, diagnostics field) to the REAL barrel exports — read `src/api.ts` and an existing pipeline test (e.g. `tests/snowflake.pipeline.test.ts`) first. Do not weaken assertions.

- [ ] **Step 2:** Run — expect the diagnostic tests to FAIL (unknown-table fires today on templated sources).
- [ ] **Step 3:** The qualify guard: where unknown-table is emitted, skip when `source.template` is present; find the unknown-column path for columns bound to that source and exempt it the same way (follow how opaque TVF sources are treated — the source's columns read "unknown").
- [ ] **Step 4:** Extend `tests/corpus/jinja.test.ts`: for each fixture containing `{{ ref(` or `{{ source(`, after the existing per-fixture assertions, walk `r.sql.ast` sources and assert (a) at least one carries `template`, (b) no source name contains the placeholder fill char sequence for ref/source-tagged ones, (c) `qualify` with an empty `Schema({})` yields zero unknown-table/-column against templated sources. Keep ALL existing gate assertions byte-identical.
- [ ] **Step 5:** `npm test` + `npm run test:corpus` green; typecheck; format touched; commit `feat(jinja): R3 semantics — qualify exempts templated sources; pipeline proven (scope/lineage/qualify)`.

## TASK 3 — R4: control-tag enrichment + regions + symbols

**Files:**
- Modify: `src/jinja/tag-ast.ts` (the control variant of `TagNode` gains `keyword?: string; name?: string; nameSpan?: PartSpan` — extraction at the `seg.tagKind === "stmt"` branch ~line 273, walking the existing tolerant stmt parse tree)
- Create: `src/jinja/regions.ts`
- Modify: `src/jinja/parse.ts` (`TemplatedParseResult` gains `regions: TemplateRegion[]; symbols: TemplateSymbol[]`, computed from `tags`)
- Test: `tests/jinja.regions.test.ts`

**Interfaces:**
- Consumes: the stmt parse tree from `src/jinja/parse-tag.ts` (keyword = first stmt token; `set` target / `macro` name / `for` loop-var = the identifier after the keyword — verify against the grammar's `stmt` rule in `grammars/jinja/JinjaParser.g4`; a grammar tightening is allowed ONLY in `grammars/jinja/`, never the SQL grammars, and must keep the tolerant fallback for unknown-lead tags).
- Produces:

```ts
export interface TemplateArm {
	keyword: string;                 // "if" | "elif" | "else" | "for" | "macro" | the opener for single-arm blocks
	tagSpan: PartSpan;               // the arm's opening tag
	bodySpan: PartSpan;              // end of the opening tag → start of the next arm/close tag (may be empty)
	children: TemplateRegion[];      // nested regions inside this arm
}
export interface TemplateRegion {
	kind: "if" | "for" | "macro";
	arms: TemplateArm[];             // if: one per if/elif/else; for/macro: exactly one
	span: PartSpan;                  // opening tag start → closing tag end (or EOF when unbalanced)
}
export interface TemplateSymbol {
	kind: "set" | "macro";
	name: string;
	nameSpan: PartSpan;
	span: PartSpan;                  // the whole tag ({% set x = … %}) or block ({% macro %}…{% endmacro %})
}
export function templateRegions(tags: TagNode[]): TemplateRegion[];
export function templateSymbols(tags: TagNode[]): TemplateSymbol[];
```
Pairing: a source-ordered stack walk over control tags — `if` opens, `elif`/`else` start a new arm of the top `if` region, `endif` closes; `for`/`endfor`, `macro`/`endmacro` likewise. TOLERANT: a stray `endif` is skipped with a jinja diagnostic; an unclosed `if` closes at EOF (span to end of last tag); `elif` with no open `if` becomes its own single-arm region. NEVER throw.

- [ ] **Step 1: Failing tests** (`tests/jinja.regions.test.ts`) — pin at least: two-arm `{% if %}…{% else %}…{% endif %}` (one region, two arms, bodySpans slice to the exact body text); `{% elif %}` (three arms); nesting (an `if` inside a `for` arm lands in `children`); `{% set x = 1 %}` → symbol `x` with `nameSpan` slicing to `x`; `{% macro build(a, b) %}…{% endmacro %}` → symbol `build` + a macro region; unbalanced `{% if x %}SELECT 1` → total, one region spanning to EOF; stray `{% endif %}` → total, no throw; keyword/name fields on the enriched control TagNodes. Assert spans by slicing the source text (the inc1 test convention — content-true, not offset-guessing).
- [ ] **Step 2:** Run — FAIL (no regions module).
- [ ] **Step 3:** Implement enrichment + regions.ts + the `parse.ts` wiring (compute in `build()`, inside the totality try/catch; the fallback path returns `regions: []`, `symbols: []`).
- [ ] **Step 4:** File green; `npm test`; typecheck.
- [ ] **Step 5:** Format; commit `feat(jinja): R4 — control-flow regions + set/macro template symbols`.

## TASK 4 — Variant expansion (arm-coverage, lazy)

**Files:**
- Create: `src/jinja/variants.ts`
- Test: `tests/jinja.variants.test.ts`

**Interfaces:**
- Consumes: Task 3's `templateRegions`; `parseTemplated`.
- Produces:

```ts
export interface TemplateVariant {
	/** The one non-default selection this variant activates; undefined for variant 0 (all defaults). */
	active?: { region: TemplateRegion; armIndex: number };
	/** Parse this variant (memoized). Coordinates are ORIGINAL-document; inactive arm bodies are whitespace-blanked. */
	parse(): TemplatedParseResult;
}
export function templateVariants(text: string, dialect: Dialect): TemplateVariant[];
```
Enumeration: variant 0 = every region's arm 0 active; then one variant per (region, armIndex>0) pair — LINEAR in arm count, no cross-product (the spec's decided shape). Realization: whitespace-blank (newline-preserving, same technique as the segmenter's fill) the body ranges of every INACTIVE arm, then `parseTemplated(blankedText, dialect)`. `{% for %}`/`{% macro %}` regions contribute no extra variants (single-arm). Lazy: `parse()` computes on first call, memoizes.

- [ ] **Step 1: Failing tests** — pin: `{% if a %}WHERE x > 1{% else %}WHERE y > 1{% endif %}` appended to a base SELECT → exactly 2 variants; variant 0's parse has ZERO SQL syntax errors and its ast's WHERE references `x`; variant 1's references `y`; token coordinates in both are original-document (spot-check a token's span slices to the source); a document with no regions → exactly 1 variant whose `parse()` result equals `parseTemplated(text)` in token count; nested if-in-if → linear count (1 + Σ(arms−1)); unbalanced input → total, ≥1 variant, no throw; `parse()` memoizes (same reference on second call).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** File green; `npm test`; typecheck.
- [ ] **Step 5:** Format; commit `feat(jinja): variant expansion — arm-coverage enumeration, lazily parsed coherent variants`.

## TASK 5 — Public surface + gate extension + fixtures

**Files:**
- Modify: `src/index.ts` (export `templateVariants`, `templateRegions`, `templateSymbols` + types `TemplateSourceInfo`, `TemplateRegion`, `TemplateArm`, `TemplateSymbol`, `TemplateVariant` — follow the inc1 jinja export block at line 79)
- Create: fixtures under `tests/fixtures/jinja/` — `16_if_else_where.sql` (the two-WHERE branch model), `17_for_select_list.sql` (`{% for c in cols %}{{ c }},{% endfor %}` shape), `18_multiline_ref.sql`, `19_macro_from.sql` (a macro call in FROM), `20_set_and_macro_block.sql`
- Modify: `tests/corpus/jinja.test.ts` (regions/symbols totality over ALL fixtures; variant coherence: for every fixture, every variant's `parse()` is total and tiles; R3 assertions from Task 2 extended over the new fixtures)
- Test: extend `tests/jinja.public-api.test.ts` (barrel imports of every new export)

**Interfaces:** consumes everything above; produces the shippable inc2 surface.

**Consumer-contract gate (ADDED 2026-07-04 — the twice-proven lesson).** A green suite on our layer-in-isolation is NOT proof the consumer can use it: the extension's cross-repo shadow-diff caught two regressions our green unit tests missed (inc1 placeholder names; R3 source names read off the placeholder token by the consumer). So this task adds a `tests/corpus/jinja.consumer-contract.test.ts` (tier-2) that exercises the DOWNSTREAM READS the way a consumer does, over every ref/source fixture: for `parseTemplated(text, "databricks")`, scan EVERY public name path — `sql.ast` source names, `resolveScopes` binding keys, `Lineage.originsOf` origins, `deriveSymbols` names, AND the `tokens` stream text — and assert NONE contains a `^j+$` placeholder-fill for a ref/source-tagged source (the model name must be the REAL name on every consumer-visible read, never the `jjj…` placeholder). This is the exact class the shadow-diff keeps catching; it fails at OUR layer before the shadow-diff has to, and documents the consumption contract executably (read identity from `src.name`/scope, never token text). NOTE for the controller: whether consumer-contract gates become STANDING practice for every cross-repo contract is Niclas's open process call — this ONE gate for name-binding is in scope here.

- [ ] **Step 1:** Write the fixtures (real dbt-shaped, one construct each) + the failing gate/api extensions + the consumer-contract gate.
- [ ] **Step 2:** Run — new assertions FAIL only where wiring is missing; fix exports/wiring (no behavior changes belong in this task — if a gate assertion exposes a Task 1–4 bug, FIX IT THERE conceptually: small fixes inline are fine, but report them). The consumer-contract gate MUST pass (R3 already delivers real names; if it fails, a placeholder is leaking a public read — that's a real bug, surface it).
- [ ] **Step 3:** Full `npm test` + `npm run test:corpus` green; typecheck.
- [ ] **Step 4:** Format; commit `feat(jinja): inc2 public surface + gate extension + consumer-contract gate (regions/symbols/variants + 5 fixtures)`.

## TASK 6 — Close: docs truth-up

**Files:**
- Modify: `docs/jinja-front-end.md` (§R3/§R4/§Variant realization headers gain "— built"; increment plan inc2 bullet → BUILT; boundaries section: partial-name templating (`{{ var('schema') }}.orders` keeps its placeholder part), variants-not-default note)
- Modify: `docs/PLAN.md` (jinja pointer: inc2 built, inc3 next)
- Modify: `CLAUDE.md` (the jinja Current-status bullet gains inc2: R3 template-tagged TableSources + qualify exemption, R4 regions/symbols, arm-coverage variants; known limits updated — one-TagNode-per-tag stands, slot-context field still deferred to inc3)

Current-state voice, no AI-tells (CLAUDE.md Rule 10), every sentence verifiable against the tree. Verify both tiers green (docs-only change); commit `docs: jinja inc2 close — R3/R4/variants built`.

