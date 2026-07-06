# API-Layer Hack Eradication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every hack, compiler blind spot, and contract friction found by the 2026-07-06 API-layer review (api → document → qualify/infer/scope → the eight parse/lower pairs; LSP excluded), so the library layer has no hidden defaults, no unchecked seams, and no lying surfaces.

**Architecture:** No new subsystems. Each task is a targeted repair inside the existing pipeline (`parse → lower → resolveScopes → qualify → infer/lineage/symbols`) plus the public surface (`src/api.ts`/`src/index.ts`). Tasks are ordered so mechanical protections land first (source hygiene, listener typing), the trino de-hack lands before the flag-vocabulary typing that depends on it, and every externally visible delta is announced to anvil before it is built.

**Tech Stack:** TypeScript (tsgo typecheck), vitest (two tiers), antlr4ng. No grammar changes anywhere in this plan (`npm run gen` never needed).

## Global Constraints

- **Never-wrong / totality contracts hold throughout**: `lower()` never throws on broken input; analyses return `unknown` rather than guess. Removing trino's blanket catch (Task 4) must not violate totality — it is replaced by construction-level hardening, proven by the corpus.
- **Master-direct, no branches** (solo repo). Tier-1 (`npm test`) green after every task; tier-2 (`npm run test:corpus`) green before every push. Corpus tier is serialized (maxWorkers 2), never run concurrently with another corpus run.
- **anvil consumes this library.** Every externally visible delta (new `Analysis` fields, changed `unsupported` flag strings, new `kind` tags) is posted to the vault channel `C:/Development/vault/comms/channels/sqllens-anvil.md` BEFORE building (Task 0) and confirmed in a ship notice after (Task 9). Channel is append-only via `>>` heredoc — never Edit/Write/sed.
- **`src/generated/` is build output — never hand-edit.** `src/lsp/` is out of scope for this plan (its internal plumbing rides out with the LSP extraction).
- **CLAUDE.md conventions**: doc-cite anything grammar-adjacent; update CLAUDE.md/PLAN.md in the same change that departs from them (Task 9 consolidates).
- Subagents, if used for execution, are pinned `model: "sonnet"`.

## Execution: subagent-driven, per-task model assignment

Each task runs as a fresh subagent pinned to the model below (main session dispatches, reviews each diff, and owns the channel entries). Assignment rule: paste-the-given-code tasks → **haiku**; sweeps needing compiler-error judgment → **sonnet**; the one task with design/crash-recovery judgment → **sonnet with opus escalation on demonstrated failure** (never Fable). Tasks 0 and 9 are the main session's — channel protocol and consumer-delta judgment are not delegated.

| Task | Executor | Why this tier |
|---|---|---|
| 0 | **main session** | anvil channel entry (protocol + consumer judgment) |
| 1 | **haiku** | exact code given, one file + one test |
| 2 | **haiku** | exact code given, mechanical byte fix + new test file |
| 3 | **sonnet** | grep-driven, but "fix the shape, never re-cast" needs compiler judgment |
| 4 | **sonnet** (→ **opus** only on demonstrated failure) | the plan's only design/judgment points: lowerExpr cst fallback, crash-fixing after catch removal |
| 5 | **sonnet** | typecheck-driven sweep across 8 lowers; surprises join the union, judgment on strays |
| 6 | **haiku** | exact code given, mechanical rerouting of defaults + a pin test |
| 7 | **sonnet** | multi-file tag sweep; compile errors drive it but 62-site funnel edits need care |
| 8 | **haiku** | small mechanical residue, no new behavior |
| 9 | **main session** | docs truth, full gates, anvil ship notice |

Review gate between every task: main session reads the diff before the next dispatch; a haiku task that returns a messy or failing diff is re-dispatched on sonnet, not patched by hand on Fable.

## Findings → task map (nothing forgotten)

| # | Finding (from the review) | Task |
|---|---|---|
| 1 | `analyze()` drops parse-tier diagnostics; two `diagnostics` shapes share one name | 1 |
| 2 | trino `lower()` blanket catch masks real crashes | 4 |
| 3 | trino `constructor.name` string-matching (7 sites) + open-ended manufactured flags; bigquery post-validate capability probe | 4 |
| 4 | bigquery `cst: node as never` breaks the required-cst IR invariant | 4 |
| 5 | Raw `0x00`/`0x01` control bytes in `callKey()` — file reads as binary to ripgrep | 2 |
| 6 | `ErrorCollector.listener: object` + `as never` at ~23 attach sites — listener contract unchecked | 3 |
| 7 | `unsupported` flags stringly-typed, no exported union; `flagged()` param order swapped between dialects | 5 |
| 8 | No-schema default exists in 3 lifetimes; hops/references/symbols still default closed `new Schema({})`; singleton safety rests on unstated base-statelessness invariant | 6 |
| 9 | Duck-typing where a tag was available: `"expansion" in schema` duplicated; `toScopes` two-key shape check; `ColumnRef` untagged; `stageBody` `"columns" in stage` | 7 |
| 10 | Residue: dead `sourceCall()` shim; 3 stale `TemplateCatalog` comments; `parseTemplated` mutates `parse()`'s result; trino no-op cast; bigquery post-validate `as never` walk; unnamed `"j"` placeholder char | 4, 8 |

---

### Task 0: Announce the planned API deltas to anvil

**Executor:** main session

**Files:** none in-repo (vault channel append only).

**Interfaces — Produces:** the channel entry that authorizes the externally visible deltas the later tasks build.

- [ ] **Step 1: Append the plan notice** (single `>>` heredoc, wall-clock timestamp):

```
## <YYYY-MM-DD HH:MM> — sqllens (github-sql-dialect-grammars)

ITEM: API-layer hack eradication — planned deltas (heads-up before building)
Status: open  Owner: sqllens
Executing a hack-eradication wave over the library layer. Externally visible deltas planned:
1. Analysis (analyze()'s return) GAINS syntaxDiagnostics: SyntaxDiagnostic[], tokens: Token[],
   cst — the parse tier stops being dropped. Existing field `diagnostics` stays semantic-only,
   unchanged. Additive.
2. `unsupported` IR flags become a typed, exported closed union (UnsupportedFlag). The STRINGS
   you may read do not change EXCEPT trino's manufactured class-name flags (e.g. "showcatalogs",
   lowercased ANTLR class names) which collapse to the standard "non-query". If you match any
   trino-manufactured flag string, say so now.
3. ScopeTree gains `kind: "scopes"`; scope ColumnRef records gain `kind: "columnref"` — additive
   discriminant tags, no field removed.
4. trino lower() loses its blanket try/catch (hardened by construction instead) — behavior
   identical on all corpus input; crash-class bugs become visible instead of masked.
Ship notice with commit hashes follows when the wave lands.
REPLY-OWED: none (objections welcome before we build #2).
```

- [ ] **Step 2:** No commit (nothing in-repo changed).

---

### Task 1: `analyze()` returns the parse tier — `syntaxDiagnostics`, `tokens`, `cst` on `Analysis`

**Executor:** haiku

**Files:**
- Modify: `src/api.ts` (interface `Analysis` ~line 117; function `analyze` ~line 138)
- Test: `tests/api.test.ts` (extend)

**Interfaces — Produces:** `Analysis.syntaxDiagnostics: SyntaxDiagnostic[]`, `Analysis.tokens: Token[]`, `Analysis.cst: ParserRuleContext`. `Analysis.diagnostics` stays semantic-only (unchanged shape and meaning).

- [ ] **Step 1: Write the failing test** (in `tests/api.test.ts`):

```ts
test("analyze() carries the parse tier: positioned syntax diagnostics, tokens, cst", () => {
	const a = analyze("select a fromm t", "databricks");
	expect(a.errors).toBeGreaterThan(0);
	// The syntax error is retrievable WITHOUT a second parse() call, with position:
	expect(a.syntaxDiagnostics.length).toBeGreaterThan(0);
	expect(a.syntaxDiagnostics[0]).toMatchObject({ line: 1 });
	expect(a.tokens.length).toBeGreaterThan(0);
	expect(a.cst).toBeDefined();
	// Semantic diagnostics keep their own field and shape:
	expect(Array.isArray(a.diagnostics)).toBe(true);
});
```

- [ ] **Step 2:** Run `npx vitest run tests/api.test.ts -t "carries the parse tier"` — expect FAIL (`syntaxDiagnostics` undefined).
- [ ] **Step 3: Implement.** In `Analysis`, add three doc-commented fields:

```ts
	/** The parse tier's positioned SYNTAX diagnostics (line/column/offset/length) — the same array
	 *  parse() returns; `diagnostics` (below) is the SEMANTIC set from qualify. Two tiers, two fields. */
	syntaxDiagnostics: SyntaxDiagnostic[];
	/** The parse tier's first-class token stream (always present, even on broken input). */
	tokens: Token[];
	/** Raw-CST escape hatch, same object parse() returns. */
	cst: ParserRuleContext;
```

In `analyze()`, stop destructuring a subset:

```ts
	const parsed = parse(sql, dialect);
	const scopes = resolveScopes(parsed.ast, dialect);
	const qualification = qualifyScopes(scopes, schema);
	return {
		ast: parsed.ast,
		errors: parsed.errors,
		syntaxDiagnostics: parsed.diagnostics,
		tokens: parsed.tokens,
		cst: parsed.cst,
		scopes,
		diagnostics: qualification.diagnostics,
		...
```

Import `SyntaxDiagnostic`/`Token` types if not already in scope in `api.ts` (they are — `ParseResultIR` uses them).
- [ ] **Step 4:** `npm run typecheck && npx vitest run tests/api.test.ts` — expect PASS.
- [ ] **Step 5:** `npm test` (tier-1) green, then commit:

```bash
git add src/api.ts tests/api.test.ts
git commit -m "fix(api): analyze() returns the parse tier — syntaxDiagnostics/tokens/cst on Analysis (review finding 1)"
```

---

### Task 2: Source hygiene — control-byte escapes + a ratchet test

**Executor:** haiku

**Files:**
- Modify: `src/qualify/template-provider.ts` (`callKey`, ~lines 120-125)
- Create: `tests/source-hygiene.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/source-hygiene.test.ts`):

```ts
// No source file may contain raw control bytes: they are invisible in editors and make
// grep/ripgrep classify the file as BINARY and silently skip it — which is exactly how the
// 0x00/0x01 sentinels in template-provider.ts's callKey() hid from every search (2026-07-06).
import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (name === "generated") continue; // build output, not ours to police
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.(ts|mjs|g4|md|json)$/.test(name)) out.push(p);
	}
	return out;
}

describe("source hygiene", () => {
	test("no file under src/, grammars/, or docs/ contains raw control bytes", () => {
		// docs/ included deliberately: the plan file for THIS task briefly went binary by quoting
		// the offending code — pasted invisible bytes travel anywhere text does.
		const offenders: string[] = [];
		for (const f of [...walk("src"), ...walk("grammars"), ...walk("docs")]) {
			const buf = readFileSync(f);
			for (const b of buf) {
				// allowed: \t (9), \n (10), \r (13)
				if (b < 9 || b === 11 || b === 12 || (b > 13 && b < 32) || b === 0) {
					offenders.push(f);
					break;
				}
			}
		}
			// Zero-width characters are the same disease in multi-byte form (a U+200B was used
			// to dodge a JSDoc `*/` terminator on 2026-07-06 — invisible in every editor):
			if (/[\u200B\u200C\u200D\uFEFF]/.test(buf.toString("utf8"))) offenders.push(f);
		expect(offenders).toEqual([]);
	});
});
```

- [ ] **Step 2:** Run it — expect FAIL naming `src/qualify/template-provider.ts`.
- [ ] **Step 3: Fix `callKey`** — replace the raw bytes with escapes (byte-identical behavior):

```ts
function callKey(call: TemplateCall): string {
	const pkg = call.packageParts?.join(".") ?? "";
	const args = call.args.map((a) => (a === null ? "\u0000" : a)).join("\u0001");
	const kwargs = (call.kwargs ?? []).map((k) => `${k.name}=${k.value ?? "\u0000"}`).join("\u0001");
	return `${pkg}|${call.name}|${args}|${kwargs}`;
}
```

- [ ] **Step 4:** `npx vitest run tests/source-hygiene.test.ts tests/minijinja.template-provider.test.ts` — PASS; confirm `grep -c "callKey" src/qualify/template-provider.ts` now works (file no longer binary).
- [ ] **Step 5:** `npm test` green, commit:

```bash
git add src/qualify/template-provider.ts tests/source-hygiene.test.ts
git commit -m "fix(provider): callKey sentinels as \\u escapes, not raw control bytes; source-hygiene ratchet (review finding 5)"
```

---

### Task 3: Type the ANTLR error-listener seam — kill the ~23 `as never` casts

**Executor:** sonnet

**Files:**
- Modify: `src/parse-diagnostics.ts` (`ErrorCollector.listener`, ~line 32)
- Modify: all of `src/{databricks,tsql,snowflake,bigquery,redshift,postgres,duckdb,trino}/parse.ts`, `src/minijinja/parse.ts`, `src/minijinja/parse-tag.ts` (the `addErrorListener(listener as never)` sites)

- [ ] **Step 1:** In `src/parse-diagnostics.ts`, import and use the real interface:

```ts
import type { ANTLRErrorListener } from "antlr4ng";
...
	/** Attach to both the lexer and the parser via addErrorListener. */
	listener: ANTLRErrorListener;
```

Adjust the collector's listener object literal if the compiler now demands the two ambiguity-report methods (`reportAmbiguity`/`reportAttemptingFullContext`/`reportContextSensitivity` — add empty implementations if they're not already there; check what the literal currently carries).
- [ ] **Step 2:** Sweep the casts: `grep -rn "as never" src --include=parse*.ts` → for every `addErrorListener(x as never)` site, drop the cast. Any helper parameter typed `listener: object` (e.g. an `attachErrorCounter` per dialect) becomes `listener: ANTLRErrorListener`.
- [ ] **Step 3:** `npm run typecheck` — must be clean with ZERO remaining `as never` on listener attach sites (`grep` count = 0). If the compiler rejects a listener shape, fix the SHAPE (that is the point of the task), never re-add a cast.
- [ ] **Step 4:** `npm test` green (parse wrappers exercised everywhere), commit:

```bash
git add src/parse-diagnostics.ts src/*/parse.ts src/minijinja/parse.ts src/minijinja/parse-tag.ts
git commit -m "fix(parse): ErrorCollector.listener typed as ANTLRErrorListener — 23 'as never' listener casts deleted (review finding 6)"
```

---

### Task 4: trino + bigquery de-hack — value imports, real `instanceof`, honest flags, no blanket catch, no `as never` cst

**Executor:** sonnet (opus escalation on demonstrated failure only)

**Files:**
- Modify: `src/trino/lower.ts`
- Modify: `src/bigquery/post-validate.ts`
- Modify: `src/bigquery/lower.ts` (`lowerExpr` ~line 1241)
- Test: `tests/trino.test.ts`, `tests/bigquery.*.test.ts` (extend where a behavior is pinned)

**Interfaces — Produces:** trino's fallthrough non-query statements flag `"non-query"` (was: lowercased ANTLR class names). Everything else behavior-identical.

- [ ] **Step 1: Fix the imports.** In `src/trino/lower.ts`, move `DeleteContext` and `JoinRelationContext` from `import type {...}` to the value import list, and ADD value imports for `ParameterContext`, `StaticMethodCallContext`, `AutoContext`, `CurrentDateContext`, `CurrentTimeContext`, `CurrentTimestampContext`, `LocalTimeContext`, `LocalTimestampContext`, `CurrentUserContext`, `CurrentCatalogContext`, `CurrentSchemaContext`, `CurrentPathContext` (all are `export class` in `src/generated/trino/TrinoParser.ts`).
- [ ] **Step 2: Swap the string checks for `instanceof`** at lines ~238, ~494, ~541, ~901, ~948, ~1051-1061 (`stmt.constructor.name === "DeleteContext"` → `stmt instanceof DeleteContext`, the 9-way `ctor ===` chain → an `instanceof` chain). Delete the no-op cast at ~958 (`lowerArgument(a as never, ctx)` → `lowerArgument(a, ctx)` — types already match).
- [ ] **Step 3: Kill the manufactured flags** at ~line 301: replace

```ts
	return flagged(stmt, categoryOf(stmt), stmt.constructor.name.replace(/Context$/, "").toLowerCase());
```

with

```ts
	// Unmodelled non-query statement: one closed flag, not a class-name-derived vocabulary.
	return flagged(stmt, categoryOf(stmt), "non-query");
```

Pin it: add to `tests/trino.test.ts` a case asserting an unmodelled statement (e.g. `SHOW CATALOGS`) lowers with `unsupported` containing `"non-query"` and NOT any class-name-derived string.
- [ ] **Step 4: bigquery post-validate.** In `src/bigquery/post-validate.ts`: value-import `ParserRuleContext` (drop `import type` for it); replace the line-270 capability probe with `child instanceof ParserRuleContext`; retype the line-92 walk helper to take antlr4ng's `ParseTree` and drop its `as never` (assert non-null from the loop bound with a plain check, not a cast).
- [ ] **Step 5: bigquery `lowerExpr` cst invariant.** Replace the `as never` laundering with an honest span-carrying fallback: the function's callers always have a parent context — change the signature to `lowerExpr(node: ParserRuleContext | undefined, parent: ParserRuleContext)` and return `{ kind: "literal", text: "", cst: parent }` on the missing-node branch, OR (if threading a parent everywhere is disproportionate — decide at the code) make the branch throw-impossible by auditing its callers: `grep -n "lowerExpr(" src/bigquery/lower.ts`, and for every caller that can pass undefined, pass the enclosing ctx as fallback. The invariant to restore: **no `Expr` is ever constructed with a non-`ParserRuleContext` cst.** Add a unit test that walks the IR of a degenerate parse (e.g. `SELECT (`) asserting every reachable node's `cst` is truthy.
- [ ] **Step 6: Remove trino's blanket catch.** Delete the `try/catch` in `lower()` (~lines 196-201) so it matches the other seven dialects (totality by construction). Run `npm test` AND `npx vitest run tests/corpus/trino.test.ts` — if ANY input now throws, fix the walk at the exact crash site (optional chaining / `directChildrenOfRule`-style safe access), same as the other dialects are built. Do not reinstate the catch. The negative corpus (400 mutants + 24 curated) is the crash net here.
- [ ] **Step 7:** `npm run typecheck && npm test` green; run tier-2 (`npm run test:corpus`) — green required (trino + bigquery behavior touched). Commit:

```bash
git add src/trino/lower.ts src/bigquery/post-validate.ts src/bigquery/lower.ts tests/trino.test.ts
git commit -m "fix(trino,bigquery): instanceof over constructor.name, closed non-query flag, blanket catch removed, cst invariant restored (review findings 2,3,4)"
```

- [ ] **Step 8:** Push (corpus was green this task).

---

### Task 5: `UnsupportedFlag` — a typed, exported flag vocabulary + one `flagged()` signature

**Executor:** sonnet

**Files:**
- Modify: `src/ir/ir.ts` (the `unsupported?: string[]` field, ~line 104)
- Modify: all eight `src/<dialect>/lower.ts` (flag pushes + the two `flagged()` helpers' parameter order)
- Modify: `src/index.ts` (export the type)
- Test: `tests/broken-batch.test.ts` already pins the batch flags; add a compile-time exhaustiveness pin

**Interfaces — Produces:** `export type UnsupportedFlag = ...` from the barrel; `SelectExpr.unsupported?: UnsupportedFlag[]`. No string VALUES change (Task 4 already collapsed trino's manufactured ones).

- [ ] **Step 1: Enumerate ground truth.** `grep -rn "unsupported" src/*/lower.ts src/minijinja/*.ts | grep -o '"[a-z-_]*"' | sort -u` — expected set from the review (verify, don't trust): `"multi-statement"`, `"broken"`, `"empty"`, `"compound"`, `"non-query"`, `"non-query-cte"`, `"unparsed"`, `"query-body"`, `"session-properties"`, `"inline-function"`, `"group-by-auto"`, `"match_recognize"`, `"pivot"`, `"unpivot"`. Any flag found beyond this list joins the union (nothing silently dropped).
- [ ] **Step 2: Define the union** in `src/ir/ir.ts`, one doc comment per member (what it means, which dialects emit it), and retype the field:

```ts
export type UnsupportedFlag =
	| "multi-statement" // a `;`-batch (healthy or recovery-swallowed) — the body is a flagged stub
	| "broken"          // a wholly-unparsed statement (recovery consumed it; input was NOT empty)
	| "empty"           // genuinely empty input
	| "compound"        // a BEGIN…END scripting compound (statement sequence, not a query)
	| "non-query"       // a parsed statement with no query body (utility/DDL/DML without SELECT)
	// ... (one line per remaining member, from Step 1's verified set)
	;
...
	unsupported?: UnsupportedFlag[];
```

- [ ] **Step 3:** `npm run typecheck` — every `lower.ts` push site now compiles against the union; a typo'd flag is a compile error. Fix any revealed mismatches by correcting the STRING (if typo) or adding the member (if legitimate — with doc comment).
- [ ] **Step 4: Unify `flagged()` parameter order.** Standardize on `(cst, statement: StatementCategory, flag: UnsupportedFlag)` — trino's order; swap databricks' `(cst, reason, statement)` helper and its call sites (grep `flagged(` in `src/databricks/lower.ts`, ~6 sites). The typed params now make a swapped call a compile error, which is the point.
- [ ] **Step 5:** Export `UnsupportedFlag` from `src/index.ts`. Add one test pinning the export exists and the batch flags type-narrow:

```ts
import type { UnsupportedFlag } from "../src/index.js";
const f: UnsupportedFlag = "multi-statement"; // compile-time pin
```

- [ ] **Step 6:** `npm test` green, commit:

```bash
git add src/ir/ir.ts src/*/lower.ts src/index.ts tests/
git commit -m "feat(ir): UnsupportedFlag closed union — flag vocabulary typed and exported; flagged() signature unified (review finding 7)"
```

---

### Task 6: One shared, provably stateless open-world default — and the last closed `Schema({})` defaults removed

**Executor:** haiku

**Files:**
- Modify: `src/qualify/template-provider.ts` (add the shared instance + statelessness doc)
- Modify: `src/api.ts` (use it; delete local `OPEN_DEFAULT`)
- Modify: `src/document/document.ts` (use it; delete local `EMPTY_SCHEMA`)
- Modify: `src/minijinja/parse.ts` (default `opts?.provider ?? OPEN_PROVIDER` instead of `new DefaultTemplateProvider()`)
- Modify: `src/lineage/hops.ts:97`, `src/references/references.ts:70`, `src/symbols/symbols.ts:79` (closed `new Schema({})` → `OPEN_PROVIDER`)
- Test: `tests/minijinja.template-provider.test.ts` (statelessness pin), `tests/api.test.ts`

- [ ] **Step 1: Write the failing statelessness test** (this is the invariant the sharing rests on — make it load-bearing):

```ts
test("the bare base provider is STATELESS: safe to share as the no-schema default", async () => {
	const p = new DefaultTemplateProvider();
	// Consult unknown calls + tables heavily:
	for (let i = 0; i < 50; i++) {
		p.expansion({ name: `m${i}`, args: [] });
		p.columnsFor([`t${i}`]);
	}
	// The BASE records nothing (only subclass overrides call recordMiss/recordTableMiss):
	expect(p.misses).toEqual([]);
	expect(p.version).toBe(0);
	expect(await p.prime()).toBe(false);
});
```

(Expect PASS immediately — it pins the invariant so a future base edit that starts recording trips it with a message pointing at the shared default.)
- [ ] **Step 2: Define the shared instance** at the bottom of `src/qualify/template-provider.ts`:

```ts
/**
 * The ONE shared no-configuration default — an OPEN world that answers nothing and diagnoses
 * nothing. Sharing a single instance across documents/calls is safe ONLY because the bare base
 * is stateless (its granular defaults never record misses — pinned by the statelessness test in
 * tests/minijinja.template-provider.test.ts). A CONFIGURED provider must stay per-document per
 * the contract above; this constant is exclusively the "nothing configured" value.
 */
export const OPEN_PROVIDER: TemplateProvider = new DefaultTemplateProvider();
```

- [ ] **Step 3: Route every no-schema default through it.** `api.ts` (`opts.schema ?? OPEN_PROVIDER`, delete `OPEN_DEFAULT`); `document.ts` (delete `EMPTY_SCHEMA`, import `OPEN_PROVIDER` — keep the memo-identity comment: a single shared instance is exactly what the identity-keyed memo wants); `minijinja/parse.ts` (`opts?.provider ?? OPEN_PROVIDER`); `hops.ts`/`references.ts`/`symbols.ts` (`schema ?? OPEN_PROVIDER` / default param `= OPEN_PROVIDER` — replaces the closed-world `new Schema({})` that `api.ts` was already fixed away from; behavior-identical today since `columnsFor` returns undefined and `tables()` `[]` in both, and nothing in those paths reads `.world` — the change removes the landmine, not a live bug).
- [ ] **Step 4:** `grep -rn "new Schema({})" src` → 0 hits outside tests; `grep -rn "new DefaultTemplateProvider()" src` → exactly 1 hit (the constant). Export `OPEN_PROVIDER` from `src/index.ts` (embedders need the same value).
- [ ] **Step 5:** `npm test` green, commit:

```bash
git add src/qualify/template-provider.ts src/api.ts src/document/document.ts src/minijinja/parse.ts src/lineage/hops.ts src/references/references.ts src/symbols/symbols.ts src/index.ts tests/
git commit -m "fix(defaults): ONE shared stateless OPEN_PROVIDER for every no-schema path; closed Schema({}) defaults in hops/references/symbols removed (review finding 8)"
```

---

### Task 7: Duck-typing → declared tags

**Executor:** sonnet

**Files:**
- Modify: `src/qualify/relation-columns.ts` (export `asProvider`)
- Modify: `src/infer/infer.ts` (~line 101 — use the shared helper, drop the inline `in`-check + cast)
- Modify: `src/scope/scope.ts` (`ScopeTree` gains `kind: "scopes"`; `stageBody` ~line 277 switches on `stage.op`)
- Modify: `src/api.ts` (`isScopeTree` checks the tag)
- Modify: `src/ir/ir.ts` (`ColumnRef` gains `kind: "columnref"`), the eight `src/<dialect>/lower.ts` ColumnRef construction funnels, `src/minijinja/apply-tags.ts` (~line 153 — check the tag)
- Test: `tests/api.test.ts`, `tests/minijinja.apply-tags.test.ts`

- [ ] **Step 1: Share `asProvider`.** In `relation-columns.ts`, `export function asProvider(...)` (already written, just export). In `infer.ts` ~101, replace the inline `"expansion" in schema ? (schema as TemplateProvider)...` with `asProvider(schema)?.expansion(call)` (infer already imports from relation-columns — no cycle).
- [ ] **Step 2: Tag `ScopeTree`.** Add `readonly kind: "scopes";` to the interface in `scope.ts` and set it at the single construction site (`resolveScopes`' return). Change `api.ts`'s `isScopeTree` to `x.kind === "scopes"` (keep the object/null guard). Grep for other `ScopeTree` literal constructions (`grep -rn "root:.*statement" src/scope` — expected 1).
- [ ] **Step 3: `stageBody` switches on the tag.** Replace `"columns" in stage ? stage.columns : []` with a `switch (stage.op)` mirroring `projectionsOfStage` two lines up (the `PipeStage` union is `op`-discriminated; list the `columns`-carrying ops explicitly).
- [ ] **Step 4: Tag `ColumnRef`.** Add `kind: "columnref";` to the interface (`ir.ts:176`). Find each dialect's construction funnel: `grep -rn "clause:" src/*/lower.ts src/minijinja/*.ts` — expected: one `columnsOf`-style helper per dialect plus a few direct pushes (~62 grep hits including call-argument matches; the object literals are the subset with `parts:` nearby). Add `kind: "columnref"` at every literal. Then in `apply-tags.ts` ~153, replace the shape-sniff (`rec.kind === undefined && Array.isArray(rec.parts) && "clause" in rec`) with `rec.kind === "columnref"`. `npm run typecheck` enforces completeness: the required field makes any missed construction site a compile error — that is why the field is required, not optional.
- [ ] **Step 5:** Extend `tests/minijinja.apply-tags.test.ts`'s existing expr-marking cases to assert markers still land on ColumnRef records (regression net for the tag swap); add an `api.test.ts` case that `toScopes(resolveScopes(...))` is identity (idempotent lift through the new tag).
- [ ] **Step 6:** `npm test` green; commit:

```bash
git add src/qualify/relation-columns.ts src/infer/infer.ts src/scope/scope.ts src/api.ts src/ir/ir.ts src/*/lower.ts src/minijinja/apply-tags.ts tests/
git commit -m "refactor(tags): kind-discriminants replace duck-typing — ScopeTree.kind, ColumnRef.kind, shared asProvider, stageBody op-switch (review finding 9)"
```

---

### Task 8: Residue — dead shim, stale comments, in-place mutation, named placeholder char

**Executor:** haiku

**Files:**
- Modify: `src/qualify/relation-columns.ts` (`sourceCall`, ~lines 33-40)
- Modify: `src/qualify/qualify.ts` (comments ~265, ~422), `src/infer/infer.ts` (comment ~128)
- Modify: `src/minijinja/parse.ts` (~line 325)
- Modify: `src/minijinja/segment.ts` (~line 469)
- Test: existing suites (no new behavior)

- [ ] **Step 1: Delete the dead shim.** `sourceCall()` collapses to `return t.call;` (with the doc comment updated: `apply-tags` is the sole marker producer and always attaches `call` for ref/source/macro; `"expr"` markers carry none and correctly resolve nothing). Keep the function (it documents the seam) but remove the reconstruction branches.
- [ ] **Step 2: Fix the three stale comments** — `TemplateCatalog` → the provider truth (`relationColumns` resolves through `TemplateProvider.expansion()`); one sentence each, no history narration.
- [ ] **Step 3: `parseTemplated` stops mutating `parse()`'s result.** Replace `sql.ast = applyTemplateTags(sql.ast, tags, text);` with building a new object (`const sqlResult = { ...sql, ast: applyTemplateTags(sql.ast, tags, text) };`) and thread `sqlResult` through the rest of `build()` (grep the uses of `sql.` below line 325 in that function).
- [ ] **Step 4: Name the placeholder char.** In `segment.ts`: `const PLACEHOLDER_CHAR = "j"; // the identifier-fill char — the "jjj…" runs comments elsewhere refer to` and use it at the fill site(s); update the two comment references (`parse.ts`, `apply-tags.ts`) to name the constant.
- [ ] **Step 5:** `npm test` green; commit:

```bash
git add src/qualify/relation-columns.ts src/qualify/qualify.ts src/infer/infer.ts src/minijinja/parse.ts src/minijinja/segment.ts
git commit -m "chore(residue): dead sourceCall shim deleted, TemplateCatalog comments fixed, parseTemplated immutable result, PLACEHOLDER_CHAR named (review finding 10)"
```

---

### Task 9: Close the wave — docs, full gates, ship notice

**Executor:** main session

**Files:**
- Modify: `CLAUDE.md` (Current status: analyze() tier passthrough; UnsupportedFlag; the trino catch removal; OPEN_PROVIDER)
- Modify: `docs/PLAN.md` (Open Gaps: mark the review-driven items done; add nothing speculative)

- [ ] **Step 1:** Update CLAUDE.md/PLAN.md to current truth (state, not changelog — per CLAUDE.md's own rule).
- [ ] **Step 2:** Full verification: `npm run typecheck && npm test && npm run test:corpus` — all green. Also re-run the review's own detectors as a final sweep: `grep -rn "as never" src --include="*.ts" | grep -v generated` (expect: only sites a task consciously kept, ideally 0), `grep -rn "constructor.name" src | grep -v generated` (expect 0 outside comments), `grep -rn "new Schema({})" src` (expect 0).
- [ ] **Step 3:** Commit docs + push everything:

```bash
git add CLAUDE.md docs/PLAN.md
git commit -m "docs: hack-eradication wave recorded — analyze() tier passthrough, UnsupportedFlag, OPEN_PROVIDER, trino hardening"
git push
```

- [ ] **Step 4:** Ship notice to anvil (append-only): the Task-0 item flips to `Status: closed`, listing commit hashes, the delta summary (Analysis fields additive; trino manufactured flags → `"non-query"`; `UnsupportedFlag`/`OPEN_PROVIDER`/`kind` tags exported), and `REPLY-OWED: none`.

---

## Self-review notes

- **Coverage check:** all 10 review findings map to a task (table above); the four sweep agents' FINE-rated items are deliberately excluded (guard-verified non-null assertions, labeled-alternative `instanceof` navigation, the documented `world` capability).
- **Order dependencies honored:** Task 4 (kills manufactured flags) precedes Task 5 (closed union). Task 2 (unbinaries the provider file) precedes any task that greps it (6). Task 0 precedes every externally visible change.
- **Consciously NOT in this plan:** the smaller totality catches in completion/signature/references/hops/split/variants (last-resort guards over already-total pieces — defensible per review; revisit only if a debugging story demands discrimination); `SchemaProvider`-interface vs `TemplateProvider`-class asymmetry (deliberate design, Niclas-ordered base-class pattern — Task 9's CLAUDE.md note cross-references the why); bigquery's three-source diagnostics (justified asymmetry, documented in code).
- **Blast-radius watch:** Task 5's typecheck may surface flag strings the grep missed — they join the union, never get dropped. Task 7's required `ColumnRef.kind` turns every missed construction site into a compile error by design. Task 4 Step 6 (catch removal) is the only step that can reveal latent crashes — the corpus is the net, and fixing them is in-scope for the step, not a reason to reinstate the catch.
