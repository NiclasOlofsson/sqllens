# Jinja inc3.1 Wave — `relation` (TemplateCatalog, column resolution)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** inc3 increment 1 — the `relation` slice of the `TemplateCatalog`: sqllens ASKS the catalog for a templated `{{ ref('orders') }}`'s real columns, upgrading the R3 blanket exemption to real column resolution when a catalog answers, while a zero-catalog parse stays byte-identical to R3. Per the decided design in `docs/jinja-front-end.md` § The seam → "inc3 increment 1 — `relation` only" (READ IT FIRST — binding). anvil cleared `relation`-first; `value`/`expansionShape`/`loopCollection` are OUT of this wave.

**Architecture:** `TemplateCatalog extends SchemaSource` (so qualify duck-types the schema it already receives — no new pipeline threading) + a `CallbackTemplateCatalog` mirroring the existing `CallbackSchema` (sync resolve, recorded misses, async `prime()`, monotonic `version`). Qualify's two R3 guard sites gain the catalog ask. Zero-catalog → R3 fallback, invisible.

**Tech Stack:** TypeScript (tabs), vitest two tiers, tsgo typecheck, prettier (TOUCHED FILES ONLY — `npx prettier --write <files>`, never `npm run format`).

## Global Constraints

- **Never-wrong.** An unknown-column diagnostic against a templated ref fires ONLY when the catalog POSITIVELY returned columns and the column is absent. A `relation` miss (undefined) = the R3 exemption, never a fabricated column. Opaque templated sources (macro/computed, no literal name) stay exempt.
- **Zero-catalog keystone.** A plain `Schema`/`SchemaSource` (no `relation`) leaves every templated source at the R3 exemption — inc3.1 is byte-identical to R3 without a catalog. A corpus/consumer-contract assertion must pin this.
- **Additive-only.** No grammar, no `src/<dialect>/`, no IR change. The R3 apply-tags transform + `TableSource.template` are DONE — consume them, don't modify. `SchemaSource` (schema-source.ts) gets a new sub-interface, not a breaking change (every existing `Schema` caller keeps compiling — `TemplateCatalog` is a structural extension, plain schemas simply aren't one).
- **No gate weakened.** Both tiers green before merge; the R3 pipeline/consumer-contract gates stay green (a zero-catalog run is unchanged).
- Subagents on Opus or Sonnet 5, never Fable. Commits end with:
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
- Do NOT touch `docs/anvil/CHANNEL.md` (controller posts channel notes). Worktree branch `worktree-jinja-inc3-rel`.

---

## TASK 1 — The `TemplateCatalog` interface + `CallbackTemplateCatalog`

**Files:**
- Create: `src/qualify/template-catalog.ts`
- Test: `tests/jinja.template-catalog.test.ts`

**Interfaces:**
- Consumes: `SchemaSource`/`TableResolver` shapes + `CallbackSchema` (src/qualify/schema-source.ts — READ IT; mirror its resolve/misses/prime/version/coalescing exactly), `Column` (src/qualify/schema.ts), `foldIdentifier` (src/ident/fold.ts).
- Produces:

```ts
export interface TemplateRef {
	kind: "ref" | "source";
	/** The dbt-logical name R3 put on TableSource.name: ["orders"] or ["raw","events"]. */
	nameParts: string[];
}
export interface ResolvedRelation {
	/** The resolved PHYSICAL relation name parts (e.g. ["analytics","orders"]). */
	nameParts: string[];
	/** The physical relation's columns, or undefined until an async describe lands. */
	columns?: Column[];
}
/** Extends SchemaSource: a catalog that ALSO resolves dbt template refs to physical relations+columns.
 *  qualify duck-types this (`"relation" in schema`); a plain SchemaSource is the zero-catalog fallback. */
export interface TemplateCatalog extends SchemaSource {
	relation(ref: TemplateRef, dialect?: string): ResolvedRelation | undefined;
}
/** The host-side resolver a CallbackTemplateCatalog drives, template-ref twin of TableResolver. */
export interface RelationResolver {
	/** Sync lookup from the host's warm cache. undefined = unknown/not-yet-loaded (recorded as a miss). */
	resolveRelation(ref: TemplateRef): ResolvedRelation | undefined;
	/** Async fetch for missed refs (populates the cache resolveRelation reads). Optional. */
	fetchRelations?(missing: TemplateRef[]): Promise<void>;
}
export class CallbackTemplateCatalog implements TemplateCatalog { /* … */ }
```
`CallbackTemplateCatalog` mirrors `CallbackSchema`: it wraps BOTH a `TableResolver` (for `columnsFor`/`tables` — physical tables, delegating exactly as CallbackSchema does) AND a `RelationResolver` (for `relation`). One `version`, bumped by ONE `prime()` that drains BOTH the physical-table misses and the relation misses (so a single prime warms everything and bumps once). Coalescing (in-flight guard) + first-seen-order distinct misses + re-entrant-miss truncation: mirror CallbackSchema's contract precisely (read its header + prime/drain). `relation` folds `ref.nameParts` with `foldIdentifier(p, dialect, "table")` before handing to the resolver (the fold contract).

- [ ] **Step 1: Failing tests** (`tests/jinja.template-catalog.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { CallbackTemplateCatalog, type TemplateRef, type ResolvedRelation } from "../src/qualify/template-catalog.js";

function relResolver(map: Record<string, ResolvedRelation>) {
	const store: Record<string, ResolvedRelation> = {};
	return {
		warm: (k: string) => { store[k] = map[k]; },
		resolver: {
			resolveRelation: (ref: TemplateRef) => store[ref.nameParts.join(".")],
			fetchRelations: async (missing: TemplateRef[]) => { for (const m of missing) store[m.nameParts.join(".")] = map[m.nameParts.join(".")]; },
		},
	};
}

describe("CallbackTemplateCatalog", () => {
	it("relation resolves logical→physical+columns from warm cache; miss returns undefined + records", () => {
		const { resolver } = relResolver({ orders: { nameParts: ["analytics","orders"], columns: [{ name: "id", type: "int", nullable: false }] } });
		const cat = new CallbackTemplateCatalog(resolver);
		expect(cat.relation({ kind: "ref", nameParts: ["orders"] })).toBeUndefined(); // cold
		expect(cat.misses.length).toBe(1);
	});
	it("prime() drains relation misses, bumps version once, resolves on re-probe", async () => {
		const { resolver } = relResolver({ orders: { nameParts: ["analytics","orders"], columns: [{ name: "id", type: "int", nullable: false }] } });
		const cat = new CallbackTemplateCatalog(resolver);
		cat.relation({ kind: "ref", nameParts: ["orders"] }); // miss
		const v0 = cat.version;
		const changed = await cat.prime();
		expect(changed).toBe(true);
		expect(cat.version).toBe(v0 + 1);
		const r = cat.relation({ kind: "ref", nameParts: ["orders"] });
		expect(r?.nameParts).toEqual(["analytics","orders"]);
		expect(r?.columns?.map((c) => c.name)).toEqual(["id"]);
	});
	it("is a SchemaSource too — columnsFor delegates to the table resolver", () => {
		// construct with a table resolver; assert columnsFor works + a plain relation-miss doesn't break it
	});
	it("prime() coalesces concurrent calls (one fetch, one version bump)", async () => {
		// two prime() before the first resolves → same promise, version bumps once
	});
	it("folds nameParts with the dialect table-fold before resolving", () => {
		// snowflake UPPER-folds; assert the resolver receives the folded key
	});
});
```
Adjust the `Column` shape to the real one (read src/qualify/schema.ts — a leaf column REQUIRES `nullable`). Read CallbackSchema fully; mirror its prime/drain/coalescing.

- [ ] **Step 2:** Run — FAIL (no module).
- [ ] **Step 3:** Implement `template-catalog.ts` (mirror CallbackSchema's structure; wrap both resolvers; one version/prime draining both miss lists).
- [ ] **Step 4:** File green; `npm test`; typecheck.
- [ ] **Step 5:** Format; commit `feat(jinja): inc3.1 — TemplateCatalog interface + CallbackTemplateCatalog (relation resolution, mirrors CallbackSchema)`.

## TASK 2 — Qualify upgrade: catalog-resolved templated columns

**Files:**
- Modify: `src/qualify/qualify.ts` (the two R3 guard sites — lines ~254 in `columnsOfSource`, ~382 in `sourceColumns`; READ both + how a plain source resolves columns via `schema.columnsFor`)
- Test: `tests/jinja.relation.test.ts`

**Interfaces:**
- Consumes: Task 1's `TemplateCatalog`/`TemplateRef`; the R3 `TableSource.template` + `.name`; the schema param already flowing through qualify.
- Produces: templated sources resolve real columns when the active schema is a `TemplateCatalog`; unknown-column fires for a genuinely-missing column on a resolved templated ref; zero-catalog unchanged.

The upgrade at BOTH guard sites — replace `if (src.source.template) return undefined;` with:
```
if (src.source.template) {
	const t = src.source.template;
	// opaque (macro/computed) or the schema isn't a TemplateCatalog → R3 exemption unchanged
	if (t.opaque || t.kind === "macro" || !schema || !("relation" in schema)) return undefined;
	const resolved = (schema as TemplateCatalog).relation({ kind: t.kind, nameParts: src.source.name }, dialect);
	if (!resolved) return undefined;                       // catalog miss → R3 exemption (warms later)
	if (resolved.columns) return resolved.columns;         // real columns → real resolution
	return schema.columnsFor(resolved.nameParts, dialect); // physical name → existing physical resolver
}
```
Adjust to the ACTUAL local names at each site (what `schema`/`dialect`/`src` are called; whether the function returns `Column[] | undefined` or a different shape — FOLLOW the site's real return contract; the two sites may differ, wire each correctly). The unknown-column diagnostic path already keys off "columns known but this one absent" — once real columns are returned, it fires correctly with NO extra code.

- [ ] **Step 1: Failing tests** (`tests/jinja.relation.test.ts`) — use `parseTemplated` + a `CallbackTemplateCatalog` warmed with `orders → {id,total}`:
  - resolved templated ref: `SELECT o.id FROM {{ ref('orders') }} o` with the catalog warm → `o.id` resolves, NO unknown-column; `SELECT o.nope FROM {{ ref('orders') }} o` → unknown-column FIRES (real resolution).
  - zero-catalog (plain `Schema`/empty): both queries → NO unknown-column (R3 exemption unchanged — the never-wrong keystone).
  - cold catalog (ref recorded as miss, not yet primed) → NO unknown-column (miss = exemption); after `prime()`, re-analyze → unknown-column fires for the bad column.
  - opaque macro-in-FROM (`{{ my_macro() }} m`) with a catalog → still exempt (no relation ask, no fabricated column).
  - `source('raw','events')` resolves via the catalog the same way.
  Read tests/jinja.pipeline.test.ts for the real qualify/Schema/diagnostics API shapes.
- [ ] **Step 2:** Run — the resolved-ref unknown-column test FAILs (today it's exempt).
- [ ] **Step 3:** The guard upgrade at both sites.
- [ ] **Step 4:** `npm test` + `npm run test:corpus` (the R3 pipeline + consumer-contract gates stay green — a zero-catalog run is byte-identical); typecheck.
- [ ] **Step 5:** Format; commit `feat(jinja): inc3.1 — qualify resolves templated columns via TemplateCatalog.relation (zero-catalog = R3 fallback)`.

## TASK 3 — Barrel + LSP injection + gate + close

**Files:**
- Modify: `src/index.ts` (export `TemplateCatalog`, `CallbackTemplateCatalog`, `TemplateRef`, `ResolvedRelation`, `RelationResolver` — follow the qualify export block)
- Modify: `src/lsp/server.ts` (the `schema` slot already accepts any `SchemaSource`; verify a `TemplateCatalog` flows through and the existing prime/republish loop warms it — the loop checks `instanceof CallbackSchema`; extend to also drive `CallbackTemplateCatalog.prime()`, OR generalize the check to "has prime()". Minimal change; read the publish loop ~line 144-160)
- Test: `tests/corpus/jinja.consumer-contract.test.ts` (extend: a catalog-resolved templated ref reports real columns on the public reads; zero-catalog byte-identical to R3), `tests/jinja.public-api.test.ts` (barrel imports)
- Docs: `docs/jinja-front-end.md` (§ The seam inc3.1 block → mark relation BUILT), `docs/PLAN.md` (jinja pointer: inc3.1 relation built; value/expansionShape/loopCollection next), `CLAUDE.md` (jinja bullet: add inc3.1 relation)

- [ ] **Step 1:** Barrel exports + public-api test; the LSP prime-loop generalization (drive `CallbackTemplateCatalog.prime()` — if the loop is `instanceof CallbackSchema`, broaden to a `prime` duck-type or add the CallbackTemplateCatalog arm). Failing tests first.
- [ ] **Step 2:** Consumer-contract extension: warm a `CallbackTemplateCatalog`, assert a resolved `{{ ref('orders') }}`'s columns surface on the public reads (hover/qualify types), and a zero-catalog run is byte-identical to the R3 baseline (no new diagnostics). Wire green.
- [ ] **Step 3:** `npm test` + `npm run test:corpus` green (0 skips where corpus present); typecheck.
- [ ] **Step 4:** Docs truth-up (current-state, no AI-tells). Format touched files.
- [ ] **Step 5:** Commit `feat(jinja): inc3.1 — barrel + LSP catalog injection + consumer-contract gate + docs close`.
