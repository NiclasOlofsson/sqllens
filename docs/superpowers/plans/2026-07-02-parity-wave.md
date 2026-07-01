# Parity Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Track-B parity holes from the 2026-07-01 review: the IR's silent Databricks dialect default (issue #7), per-statement kind detection unequal across dialects, docs-corpus gates re-deriving classifications that already live in the corpus paths, the BigQuery inference registry at seed size (184 vs Databricks's 556), and the completion parser-factory still on the old Databricks entry.

**Architecture:** No new subsystems. The dialect tag rides on the IR the way `statement` already does. Statement-kind parity generalizes T-SQL's `statementCategories` export to all five lowers. The corpus classification moves fully to the organizer tool (`ORGANIZE=1`, reclassifies with current parsers, git-backed corpus repo), and the gates consume the resulting paths instead of re-classifying. The BigQuery registry follows the proven Redshift Task-2 method (doc-fed families + live-doc VERIFY).

**Tech Stack:** TypeScript (tabs), vitest two-tier suite (`npm test` fast / `npm run test:corpus` gates), tsgo, prettier.

## Global Constraints

- Inference contract: a missing rule yields `unknown`, never a wrong type; entries doc-cited (cloud.google.com/bigquery/docs/reference/standard-sql/ for Task 4). Live-doc VERIFY before pinning any surprising return type; deletion over guessing.
- No corpus gate may be weakened: every assertion/baseline/ratchet that exists today survives (it may move or get strictly tighter). The `other`-ratchet baselines are tsql 26 / snowflake 10 / bigquery 234 / redshift 0; POSITIVE_BASELINE 14695 / NEGATIVE_BASELINE 166 for the ZetaSQL analyzer gate.
- The corpus repo (`SQL_CORPUS_DIR`, sibling `sqllens-corpus`) is git-backed and PRIVATE. Task 3 commits reclassification moves there with a clear message. Never delete corpus files — the organizer only moves.
- `src/generated/` untouched (no grammar changes in this wave). Tabs; `npm run format`; `npm run typecheck` clean.
- Commits end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Long runs (organizer rerun, tier-2) go through background execution; background shells cannot redirect into workspace files — run bare and read the shell output.
- Subagents run on Opus or Sonnet 5, never Fable (session rule).

---

### Task 1: Dialect stamp on the IR (closes issue #7)

`lower()` knows its dialect but the IR forgets it; `toScopes(bareIR)`/`resolveScopes(ir)` silently default to `"databricks"` — wrong inference rules for the other four dialects, quietly (`src/api.ts:150`, `src/scope/scope.ts:82`).

**Files:**
- Modify: `src/ir/ir.ts` (QueryExpr), all five `src/<dialect>/lower.ts` (stamp in `lower()`), `src/scope/scope.ts:82-84`, `src/api.ts:142-151`
- Test: `tests/api.test.ts` (extend)

**Interfaces:**
- Produces: `QueryExpr.dialect?: string` — set by every dialect's `lower()` on the top-level IR (nested CTE/subquery IRs don't need it). Precedence everywhere: explicit param > tag > **throw** (matching `toAst`'s existing behavior — no silent default anywhere).

- [ ] **Step 1: Write the failing tests** (append to `tests/api.test.ts`, matching its import style):

```ts
describe("dialect rides on the IR (issue #7)", () => {
	it("lower() stamps the dialect; toScopes needs no opts", () => {
		const { ast } = parse("SELECT 10 / 4 AS r FROM t", "snowflake");
		expect(ast.dialect).toBe("snowflake");
		const scopes = toScopes(ast); // no opts — the tag drives it
		const a = analyze("SELECT 10 / 4 AS r FROM t", "snowflake", {});
		// Snowflake division is decimal (int/int → decimal), NOT Spark's double —
		// proof the tag (not a default) selected the inference rules.
		expect(formatType(a.types.typeOf(scopes.root.outputs[0].expr, scopes.root))).toBe(
			formatType(a.types.typeOf(scopes.root.outputs[0].expr, scopes.root)),
		);
	});
	it("a bare hand-built IR with no dialect throws instead of guessing", () => {
		const bare = { kind: "query", ctes: [], body: { kind: "select", projections: [], from: [], columns: [], aggregated: false, cst: null as never }, cst: null as never };
		expect(() => toScopes(bare as never)).toThrow(/dialect/);
	});
});
```

(Adapt the first test's assertion to the real output-column access shape in `tests/api.test.ts` — the intent is: a Snowflake `10 / 4` types as `decimal` through `toScopes(ast)` with NO dialect argument. If the file exposes a simpler route to a typed output column, use it; the assertion must fail if the tag were ignored and Databricks rules applied, i.e. it must distinguish decimal from double.)

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/api.test.ts` → FAIL (`ast.dialect` undefined; `toScopes(bare)` silently resolves).

- [ ] **Step 3: Implement**
  - `src/ir/ir.ts` `QueryExpr`: add after `statement?`:
    ```ts
    	/** The dialect whose lower() produced this IR, set on the TOP-LEVEL statement only —
    	 *  lets resolveScopes/toScopes select the inference knowledge without the caller
    	 *  re-supplying it (issue #7). An explicit dialect argument overrides the tag. */
    	dialect?: string;
    ```
  - Each dialect's `lower()` (the exported wrapper that calls `freezeIR`): stamp before freezing —
    ```ts
    export function lower(tree: ParserRuleContext): QueryExpr {
    	const q = lowerImpl(tree);
    	q.dialect = "<dialect>";
    	return freezeIR(q);
    }
    ```
  - `src/scope/scope.ts:82`:
    ```ts
    export function resolveScopes(query: QueryExpr, dialect?: string): ScopeTree {
    	const d = dialect ?? query.dialect;
    	if (!d) throw new Error("resolveScopes: no dialect — pass one, or use an IR produced by a dialect's lower()");
    	return { root: buildQueryScope(query, undefined, d), statement: query.statement ?? "other" };
    }
    ```
  - `src/api.ts:150`: `return resolveScopes(x, opts.dialect);` (drop the `?? "databricks"` — resolveScopes now resolves tag-or-throws). Update the `toScopes` doc comment: dialect needed only for strings and hand-built IRs.

- [ ] **Step 4: Fix the fallout.** Grep `resolveScopes(` across src/ and tests/: any call site handing a HAND-BUILT IR without a dialect argument must now pass one explicitly (lower()-produced IRs are stamped and need nothing). Run `npm test` — fix every throw this surfaces by adding the explicit dialect at the call site, never by re-adding a default.

- [ ] **Step 5: Verify + commit**

```bash
npm test && npm run typecheck && npm run format
git add src/ir/ir.ts src/databricks/lower.ts src/tsql/lower.ts src/snowflake/lower.ts src/bigquery/lower.ts src/redshift/lower.ts src/scope/scope.ts src/api.ts tests/
git commit -m "feat(ir): stamp the producing dialect on the IR; no silent databricks default

Closes #7. resolveScopes/toScopes read the tag; an explicit dialect stays an
override; a bare hand-built IR with neither now throws like toAst does.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Per-statement kind parity — `statementCategories` on all five dialects

T-SQL exports per-statement kinds (`src/tsql/lower.ts` — find the exact export, used by the old classify path); the other four compute a top-level category only. Redshift is the coarsest (no structural detection at all — `src/redshift/lower.ts:100-105` falls to the leading-keyword regex). Task 3's reclassifier needs per-statement kinds for every dialect.

**Files:**
- Modify: `src/redshift/lower.ts`, `src/databricks/lower.ts`, `src/snowflake/lower.ts`, `src/bigquery/lower.ts` (each gains an exported `statementCategories`)
- Test: `tests/statement-kind.test.ts` (extend)

**Interfaces:**
- Produces: `export function statementCategories(tree: ParserRuleContext): StatementCategory[]` from every dialect's lower module — one entry per top-level statement/batch element, using each dialect's existing per-element internals: Databricks per `multiStatementElement` (reuse `isCompound`/`shallowFirstOfRule(RULE_dmlStatementNoWith)`/`keywordCategory`), Snowflake per `sql_command` (reuse `commandCategory`), BigQuery per top-level stmt (reuse its `statementCategory`/`bodyCategory` internals), Redshift per stmt — **NEW structural mapping** from the Postgres-derived grammar's statement rules (doc-cite each): `selectstmt` → query; `insertstmt`/`updatestmt`/`deletestmt`/`mergestmt`/COPY → dml; CREATE/ALTER/DROP family → ddl; GRANT/REVOKE → dcl; BEGIN/COMMIT/ROLLBACK/transaction rules → tcl; SET/SHOW/EXPLAIN/ANALYZE/VACUUM-style commands → utility; anything unmapped → `keywordCategory` fallback. The T-SQL export stays as-is (it is the model — match its exact signature).

- [ ] **Step 1: Write the failing tests** (extend `tests/statement-kind.test.ts`, following its existing per-dialect helper pattern):

```ts
it("per-statement kinds, all five dialects (parity with tsql's statementCategories)", () => {
	// one multi-statement input each; assert the per-statement list, not just the top-level kind
	expect(databricksKinds("SELECT 1; INSERT INTO t VALUES (1); CREATE TABLE t2 (a INT)")).toEqual(["query", "dml", "ddl"]);
	expect(snowflakeKinds("SELECT 1; INSERT INTO t VALUES (1)")).toEqual(["query", "dml"]);
	expect(bigqueryKinds("SELECT 1; INSERT INTO t VALUES (1)")).toEqual(["query", "dml"]);
	expect(redshiftKinds("SELECT 1; INSERT INTO t VALUES (1); GRANT SELECT ON t TO u")).toEqual(["query", "dml", "dcl"]);
});
it("redshift structural detection replaces the keyword fallback for the core statements", () => {
	expect(redshiftKinds("UPDATE t SET a = 1")).toEqual(["dml"]);
	expect(redshiftKinds("CREATE TABLE t (a INT)")).toEqual(["ddl"]);
	expect(redshiftKinds("BEGIN; COMMIT")).toEqual(["tcl", "tcl"]);
});
```

(Write the `<dialect>Kinds` helpers as `(sql) => statementCategories(parseX(sql).tree)` next to the file's existing helpers. If a specific expectation disagrees with a dialect's genuine grammar shape — e.g. a statement that doesn't parse — adjust the *example*, not the requirement, and note it.)

- [ ] **Step 2: Run to verify failure** — the four exports don't exist.
- [ ] **Step 3: Implement** per the Interfaces block. Where a dialect's top-level `statementCategory` can be expressed as `statementCategories(tree)[0] ?? "other"` (single-statement) or its existing compound logic, refactor to share rather than duplicate — but do not change any top-level category behavior (`tests/statement-kind.test.ts`'s existing cases pin it).
- [ ] **Step 4: Verify + commit**

```bash
npx vitest run tests/statement-kind.test.ts tests/databricks.ir.test.ts tests/redshift.ir.test.ts && npm test && npm run typecheck && npm run format
git add src/ tests/statement-kind.test.ts
git commit -m "feat(ir): per-statement kind detection on all five dialects (statementCategories parity)

Redshift gains structural detection (was leading-keyword only); Databricks/
Snowflake/BigQuery export their existing per-element internals. Feeds the
corpus reclassifier and retires per-gate re-classification.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Corpus reclassification + path-bucketed gates

The corpus repo already carries parse-derived kind directories (`<dialect>/docs/parser/positive/<kind>/…`), but they were classified by *top-level* category (multi-statement setup scripts → `compound/`), while the gates bucket by *first substantive statement* — so the gates re-classify every file at test time (regex, or T-SQL's parse-everything). Unify: the organizer classifies with the gate's rule using Task 2's per-statement kinds, reclassifies the four docs corpora with the CURRENT parsers, and the gates then trust paths.

**Files:**
- Modify: `tools/organize-corpus.test.ts` (classifier rule), `tests/helpers/docs-ratchet.ts` (path-derived bucketing), `tests/corpus/{databricks.docs,tsql,snowflake,redshift}.test.ts`, `tests/helpers/sql-kind.ts` (shrinks to a comment pointing at the organizer, or is deleted if nothing imports it)
- Create: `tests/helpers/statement-bucket.ts` (the shared `bucketOfKinds` — moved out of docs-ratchet so the organizer uses the identical rule)
- Corpus repo: reclassification moves, committed there.

**Hard rules:** every gate keeps its exact strength — 100%-of-query-bucket parse, the pipeline hooks + `other` baselines (26/10/0), the vacuity guards (`scoped > 0`), the `staleKnownBad` self-policing (reshaped, see Step 4), the reported side buckets. Nothing gets gated *less*.

- [ ] **Step 1: Extract the shared bucket rule.** Move `bucketOfKinds` from `docs-ratchet.ts` into `tests/helpers/statement-bucket.ts` (export it; docs-ratchet imports it). Same code, no behavior change. Run `npm run test:corpus` — green, unchanged.

- [ ] **Step 2: Upgrade the organizer's classifier.** In `tools/organize-corpus.test.ts`: category = `bucketOfKinds(statementCategories(tree))` for a clean parse (import each dialect's `statementCategories` from Task 2); parse failure → `unparsed` (as today). Keep `ORGANIZE=1` gating and the move-only behavior. Note in the header comment that the organizer is now the maintained reclassifier, not a one-shot.

- [ ] **Step 3: Reclassify the four docs corpora.** Run (background; it parses every file once per corpus):

```bash
ORGANIZE=1 ONLY="databricks/docs" npx vitest run tools/organize-corpus.test.ts
# then tsql/docs, snowflake/docs, redshift/docs  (check the tool's ONLY semantics — adapt the filter values to what it expects)
```

Then in the corpus repo: `git -C <SQL_CORPUS_DIR> add -A && git commit` with message `reclassify docs corpora: per-statement bucket rule (first substantive statement), current parsers`. Record the per-dialect before/after `query/` and `unparsed/` counts in your report — expected direction: T-SQL `query/` grows from 860 toward ~1555 (the compound-classified setup scripts come home); files the grammars learned to parse since 2026-06-28 leave `unparsed/`.

- [ ] **Step 4: Switch the gates to path-derived bucketing.** In `docs-ratchet.ts`:
  - Bucket from the rel path's `<kind>` segment (`parser/positive/<kind>/…`): `query` → the gated bucket; `dml` → dml; `ddl|dcl|tcl|utility|compound|other` → the reported ddl bucket; `unparsed` → a new reported count (never parsed at gate time — they are known-fail as of the last reclassification).
  - Delete the `classify` option and the `classifySql` fallback (path is total). T-SQL's gate drops its parse-everything mode — its docs pass now parses ONLY the query bucket, like the others. The `parse`/`onCleanQuery` pipeline hooks stay exactly as they are.
  - KNOWN_BAD reshapes: the documented-broken examples now live under `unparsed/`. The gate asserts each KNOWN_BAD slug exists under `unparsed/` (self-policing inverted: if a rebuild moves one out — the docs got fixed or the grammar grew — the assertion fails and the entry is removed). The 100% query gate runs over `query/` with no exclusions (KNOWN_BAD files are not in it by construction). Databricks's DEFERRED_GRAMMAR list (issue #4) gets the same treatment as KNOWN_BAD — asserted to still sit in `unparsed/`, removed as grammar work lands.
  - Update each gate's documented floor comment to the new `query/` population; the `other`-ratchet baselines stay pinned at 26/10/0 unless the population change legitimately alters a count — if a baseline moves, report exactly why (which files entered/left) before pinning the new number. It may only be explainable-by-population, never a porting loss.

- [ ] **Step 5: Reconcile and verify.** `npm run test:corpus` (background) — every gate green. Compare tier-2 wall-clock to the current ~162s: it should FALL (T-SQL's out-of-scope parses are gone). Any `query/` file that fails to parse is a real regression or a reclassification bug — investigate; never exclude it to get green.

- [ ] **Step 6: Commit (this repo)**

```bash
npm test && npm run typecheck && npm run format
git add tools/organize-corpus.test.ts tests/helpers/ tests/corpus/
git commit -m "test(corpus): gates trust the corpus paths; classification lives in the organizer

The organizer reclassifies with per-statement kinds (the gates' bucket rule)
under the current parsers; gates drop test-time re-classification (regex and
T-SQL's parse-everything mode). KNOWN_BAD/DEFERRED_GRAMMAR self-police as
unparsed/ residents.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: BigQuery inference registry build-out (184 → the documented GoogleSQL surface)

Method task — the Redshift Task-2 pattern, applied to `src/infer/bigquery.ts` (combinators already in place at lines 51-70; single spread table from line 76). Work family-by-family through the official function reference (cloud.google.com/bigquery/docs/reference/standard-sql/): aggregate + approximate-aggregate, array, bit, conversion (CAST aside — handled structurally), date / datetime / time / timestamp / interval, geography (large; OGC-style returns), hash, HLL++ / KLL quantiles, JSON, math, navigation + numbering (window), net, range, search, security, string, text-analysis, utility, AEAD. Datasketches/ML/AI and anything argument-value-dependent stay absent by contract with a comment.

- [ ] **Step 1: Failing breadth + family tests** (extend `tests/infer.registry.test.ts` or the file holding BigQuery registry tests — locate it first; else extend `tests/bigquery.pipeline.test.ts`'s registry section):

```ts
it("covers the documented GoogleSQL surface at real breadth", () => {
	expect(Object.keys(BIGQUERY_FUNCTION_RETURNS).length).toBeGreaterThanOrEqual(400);
});
it("family spot checks (doc-cited)", () => {
	const rule = (n: string, args: Type[] = []) => BIGQUERY_FUNCTION_RETURNS[n]?.(args);
	expect(rule("st_distance")).toEqual(scalar("double"));           // geography
	expect(rule("timestamp_diff")).toEqual(scalar("bigint"));        // INT64
	expect(rule("net.ip_from_string")).toEqual(scalar("binary"));    // BYTES — check how dotted names are keyed first
	expect(rule("json_value")).toEqual(scalar("string"));
	expect(rule("approx_count_distinct")).toEqual(scalar("bigint"));
	expect(rule("lag", [scalar("date")])).toEqual(scalar("date"));   // navigation follows input
});
```

(Before writing the `net.*` case, check how the lowering names dotted function calls — registry keys must match what `inferType` looks up; if dotted paths key differently, test what's real.)

- [ ] **Step 2: Author the table** family-by-family, doc-cited group comments, using the existing combinators (+ any the families need, e.g. `arrayOf`, element-of rules for array functions). VERIFY via live docs any rule you are not certain of — WebFetch the function's reference page; deletion over guessing. Record the verification outcomes (page → confirmed/adjusted/omitted) in your report.
- [ ] **Step 3: Pin the achieved count** as the breadth floor (replace 400 with the real number if higher; never lower it below 400 — if you can't determine 400 return types, that's a BLOCKED report, not a smaller test).
- [ ] **Step 4: Verify + commit**

```bash
npx vitest run tests/bigquery.pipeline.test.ts tests/infer.registry.test.ts tests/completion/complete.test.ts && npm test && npm run typecheck && npm run format
git add src/infer/bigquery.ts tests/
git commit -m "feat(bigquery): build out the inference registry (184 -> the documented GoogleSQL surface)

Same doc-fed method as the Redshift build-out: family groups, live-doc VERIFY
for anything surprising, absent-by-contract for argument-dependent returns.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Then run `npm run test:corpus` once (background): the BigQuery gate must stay green (a registry entry can change inference paths exercised by `deriveSymbols` at corpus scale; the `other` baseline is lower-level and must not move).

---

### Task 5: Completion parser-factory entry + docs truth-up

- [ ] **Step 1:** `src/completion/parser-factory.ts:56-57` — switch the Databricks ATN-walk entry from `RULE_compoundOrSingleStatement`/`compoundOrSingleStatement()` to `RULE_multiStatement`/`multiStatement()`. Run `npx vitest run tests/completion` — all five dialects green; add one test: completion after `SELECT 1; SELECT ` (second statement) offers keywords/columns (i.e. the walk survives a batch prefix).
- [ ] **Step 2:** Docs truth-up, current-state only: CLAUDE.md (dialect stamp on the IR; statementCategories ×5; gates bucket by corpus path, organizer owns classification, sql-kind retired; BigQuery registry count; parser-factory note resolved) and docs/PLAN.md Open Gaps (same, briefly). No AI-tells, no changelog narrative.
- [ ] **Step 3:** `gh issue close 7 --repo NiclasOlofsson/sqllens --comment "lower() stamps the dialect on the IR; resolveScopes/toScopes read the tag, explicit dialect stays an override, bare IRs throw instead of silently defaulting."`
- [ ] **Step 4: Commit**

```bash
npm test && npm run typecheck && npm run format
git add src/completion/parser-factory.ts tests/ CLAUDE.md docs/PLAN.md
git commit -m "feat(completion): ATN walk enters the Databricks batch rule; docs truth-up for the parity wave

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-review notes

- Coverage: B5 → Task 1; B4a (generalized) → Task 2; B4b → Task 3; B2 → Task 4; parser-factory + hygiene → Task 5. LSP deliberately untouched (Niclas: unfocus LSP).
- Order matters: Task 2 before Task 3 (the reclassifier needs the exports); Tasks 1 and 4 are independent of both.
- Known judgment points: Task 1's throw-on-bare-IR fallout is bounded by grep+suite; Task 3's baseline movements must be explained-by-population; Task 4's breadth floor is a hard bar with BLOCKED as the honest out.
