# BigQuery (GoogleSQL) Dialect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add BigQuery/GoogleSQL as the fourth sqllens dialect — `parse → lower → resolveScopes → qualify → infer / lineage / symbols` running over the shared IR, validated against Google's own ZetaSQL test corpus.

**Architecture:** Fork-and-clean, identical to the Snowflake and T-SQL dialects. The ANTLR4 grammar is already vendored at `grammars/bigquery/` (BSD-3, from `bytebase/parser` `googlesql/`). We regenerate it to TypeScript, write a thin two-stage parse wrapper and a CST→IR `lower`, register one inference entry, and gate it with a corpus extracted from ZetaSQL's 377 `.test` golden files. Everything downstream of `lower` (scope, qualify, infer, lineage, symbols) is dialect-neutral and runs unchanged — only `grammars/bigquery/`, `src/bigquery/parse.ts`, `src/bigquery/lower.ts`, and one `InferDialect` entry are new.

**Tech Stack:** ANTLR4 grammar (`.g4`) → `antlr-ng` (TypeScript target) → `antlr4ng` runtime; TypeScript checked with `tsgo`; tests with `vitest`. Node `.mjs` tooling for the corpus extractor.

---

## Prerequisites & orientation (read before starting)

- **The grammar is already captured and committed** at `grammars/bigquery/GoogleSQLLexer.g4` (496 lines) and `grammars/bigquery/GoogleSQLParser.g4` (2797 lines), plus `grammars/bigquery/LICENSE` (BSD-3). Entry rule is `root: stmts EOF;`. Do **not** re-fetch it.
- **Three worked templates already exist** for every step below. Read them first; this plan gives the BigQuery-specific *deltas*, and instructs you to mirror these for the mechanical parts:
  - `src/snowflake/parse.ts`, `src/snowflake/lower.ts` (closest analogue — also a forked Bytebase grammar, also has a `*_file → batch → statement` shape).
  - `src/tsql/lower.ts` (for the statement-kind / `statementCategory` pattern and `select INTO`-style structural checks).
  - `src/infer/snowflake.ts` + `src/infer/dialect.ts` (inference entry).
  - `tests/snowflake.corpus.test.ts`, `tests/snowflake.pipeline.test.ts`, `tests/snowflake.test.ts` (gates and unit tests).
- **The IR is in `src/ir/ir.ts`.** It already models the hard BigQuery shapes from the Spark work: `subscript` (for `arr[0]`, struct field paths), `LateralViewSource` (for `UNNEST`), `star` with `exclude`/`replace`/`rename` (for `SELECT * EXCEPT/REPLACE`), `function` with `window`, set ops, CTEs. You will *map onto* these, not invent new nodes. If a BigQuery construct genuinely needs a new IR node, add it to `src/ir/ir.ts` and note it — but try the existing nodes first.
- **Statement-kind:** `src/ir/statement.ts` defines `StatementCategory` (`query|dml|ddl|dcl|tcl|utility|compound|other`) and `keywordCategory()`. `lower` must set `.statement` on the returned top-level `QueryExpr`, exactly like `src/tsql/lower.ts` and `src/snowflake/lower.ts` do.
- **Commands:** `npm run gen -- bigquery` (generates `src/generated/bigquery/`), `npm run typecheck`, `npm test`, `npx vitest run tests/<file>`.
- **The dialect tag string is `"bigquery"`** everywhere (`resolveScopes(ir, "bigquery")`, the `DIALECTS` registry key).
- Generated `src/generated/` is gitignored — never commit it, never hand-edit it.

## File structure

| File | New/Mod | Responsibility |
|---|---|---|
| `grammars/bigquery/GoogleSQLParser.g4` | Modify | Neutralize 33 Go-target error actions so the TS target type-checks |
| `src/bigquery/parse.ts` | Create | Two-stage SLL→LL parse wrapper; entry rule `root`; returns `{ tree, errors }` |
| `src/bigquery/lower.ts` | Create | GoogleSQL CST → shared IR; `statementCategory`; query-layer lowering |
| `src/infer/bigquery.ts` | Create | GoogleSQL function-return registry, literal rules, type aliases |
| `src/infer/dialect.ts` | Modify | Register the `bigquery` `InferDialect` entry |
| `tools/extract-googlesql-tests.mjs` | Create | Extract `.sql` + positive/negative label from ZetaSQL `.test` files |
| `tests/bigquery.corpus.test.ts` | Create | Positive ratchet + negative gate over the extracted corpus (skipIf-absent) |
| `tests/bigquery.test.ts` | Create | Per-construct lowering unit tests (TDD driver for `lower.ts`) |
| `tests/bigquery.pipeline.test.ts` | Create | Full pipeline runs unchanged on BigQuery |
| `src/index.ts` | Modify | Export `parseBigQuery` + BigQuery `lower` |
| `CLAUDE.md`, `README.md`, `docs/PLAN.md` | Modify | Correct "BigQuery hand-authored / no grammar" → fork-and-clean |

---

## Task 1: Generate the TypeScript parser

The grammar carries 33 Go-target error actions of the form `{p.NotifyErrorListeners("…", nil, nil)}`. ANTLR copies action code verbatim, so generation succeeds, but `tsgo` then fails because `p` and `NotifyErrorListeners` are Go. The antlr4ng equivalent is `this.notifyErrorListeners("…", null, null)`. There are **no** `@members`/`@header` blocks and **no** semantic predicates — this is the only Go-specific code.

**Files:**
- Modify: `grammars/bigquery/GoogleSQLParser.g4`

- [ ] **Step 1: Confirm the scope of the actions**

Run: `grep -c "p.NotifyErrorListeners" grammars/bigquery/GoogleSQLParser.g4`
Expected: `33`

Run: `grep -nE "@(members|header|parser::|lexer::)" grammars/bigquery/GoogleSQLParser.g4 grammars/bigquery/GoogleSQLLexer.g4 | wc -l`
Expected: `0` (no member blocks to port)

- [ ] **Step 2: Port the Go error API to the antlr4ng API**

Run (Git Bash):
```bash
sed -i 's/p\.NotifyErrorListeners(/this.notifyErrorListeners(/g; s/, nil, nil)/, null, null)/g; s/,nil,nil)/, null, null)/g' grammars/bigquery/GoogleSQLParser.g4
```

- [ ] **Step 3: Verify no Go remnants remain**

Run: `grep -nE "\bnil\b|p\.NotifyErrorListeners" grammars/bigquery/GoogleSQLParser.g4`
Expected: no output (all `nil` → `null`, all `p.` → `this.`). If any line remains, fix it by hand to `this.notifyErrorListeners("<msg>", null, null)`.

- [ ] **Step 4: Generate**

Run: `npm run gen -- bigquery`
Expected: `generated bigquery -> src/generated/bigquery` with no error. Files appear: `src/generated/bigquery/GoogleSQLLexer.ts`, `GoogleSQLParser.ts`, `GoogleSQLParserListener.ts`.

If generation errors on a specific action line, the `sed` missed a variant — open that line, rewrite the action to `{this.notifyErrorListeners("<the message>", null, null)}`, regen.

- [ ] **Step 5: Typecheck the generated parser**

Run: `npm run typecheck`
Expected: clean (exit 0). If `tsgo` reports an error inside `src/generated/bigquery/GoogleSQLParser.ts` referencing an action, fix the corresponding action in the `.g4` and regen. Do not edit generated files.

- [ ] **Step 6: Commit**

```bash
git add grammars/bigquery/GoogleSQLParser.g4
git commit -m "feat(bigquery): port GoogleSQL grammar error actions to the antlr4ng TS target"
```

---

## Task 2: Parse wrapper

Mirror `src/snowflake/parse.ts` exactly; the only differences are the imports, the class names (`GoogleSQLLexer`/`GoogleSQLParser`), and the entry rule (`root`).

**Files:**
- Create: `src/bigquery/parse.ts`
- Test: `tests/bigquery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/bigquery.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseBigQuery } from "../src/bigquery/parse.js";

describe("parseBigQuery", () => {
	it("parses a basic SELECT with zero errors", () => {
		expect(parseBigQuery("SELECT a, b FROM t").errors).toBe(0);
	});

	it("parses BigQuery-isms: backticks, EXCEPT, UNNEST", () => {
		expect(parseBigQuery("SELECT * EXCEPT (a) FROM `proj.ds.t`").errors).toBe(0);
		expect(parseBigQuery("SELECT x FROM UNNEST([1,2,3]) AS x").errors).toBe(0);
	});

	it("reports errors on garbage", () => {
		expect(parseBigQuery("SELECT FROM").errors).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/bigquery.test.ts`
Expected: FAIL — cannot import `../src/bigquery/parse.js` (module does not exist).

- [ ] **Step 3: Write `src/bigquery/parse.ts`**

Copy `src/snowflake/parse.ts` verbatim, then apply these substitutions:
- `SnowflakeLexer` → `GoogleSQLLexer`, `SnowflakeParser` → `GoogleSQLParser`
- import path → `../generated/bigquery/GoogleSQLLexer.js` and `../generated/bigquery/GoogleSQLParser.js`
- `parseSnowflake` → `parseBigQuery`
- both `parser.snowflake_file()` calls → `parser.root()`
- the `ParseResult.tree` doc comment → "The CST rooted at `root` (`stmts EOF`)."

The two-stage body (SLL with `BailErrorStrategy` → LL fallback, the `syntaxError` counting listener, `attachErrorCounter`) is identical.

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/bigquery.test.ts`
Expected: PASS (3 tests). If "basic SELECT" reports errors, print the tree (`parseBigQuery(sql).tree.toStringTree()`) to see which rule rejected — likely a lexer keyword case issue; the lexer already has `caseInsensitive = true`, so this should not happen.

- [ ] **Step 5: Commit**

```bash
git add src/bigquery/parse.ts tests/bigquery.test.ts
git commit -m "feat(bigquery): two-stage parse wrapper over the GoogleSQL grammar"
```

---

## Task 3: ZetaSQL corpus extractor

ZetaSQL's 377 `.test` golden files are the validation corpus. Each file is `==`-separated blocks; within a block the query precedes `--`, the expected result follows. A block whose expected output begins `ERROR: Syntax error` is a **negative** (must NOT parse); everything else (a resolved AST, or a non-syntax semantic error like "Cannot GROUP BY literal values") is a **positive** (must parse). Queries may contain `{{a|b}}` alternations that the test framework expands into variants.

**Files:**
- Create: `tools/extract-googlesql-tests.mjs`
- Vendored input (sparse clone, gitignored): `vendor/googlesql/googlesql/analyzer/testdata/*.test`
- Output (gitignored): `harness/local/bigquery-zetasql/{positive,negative}/*.sql`

- [ ] **Step 1: Sparse-clone the ZetaSQL testdata**

Run (Git Bash):
```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/google/googlesql.git vendor/googlesql
cd vendor/googlesql && git sparse-checkout set googlesql/analyzer/testdata && cd ../..
ls vendor/googlesql/googlesql/analyzer/testdata/*.test | wc -l   # expect ~377
```

- [ ] **Step 2: Add the vendored dir and corpus output to `.gitignore`**

Append to `.gitignore`:
```
vendor/googlesql/
harness/local/bigquery-zetasql/
```
Run: `grep -E "vendor/googlesql|bigquery-zetasql" .gitignore` → expect both lines.

- [ ] **Step 3: Write `tools/extract-googlesql-tests.mjs`**

```js
// Extract a parse corpus from ZetaSQL's .test golden files.
// Each .test file is `==`-separated blocks; the query precedes `--`, the expected result follows.
// Expected starting with "ERROR: Syntax error" => the query must NOT parse (negative); anything else
// (a resolved AST, or a semantic ERROR) => the query must parse (positive). `{{a|b}}` alternations
// are expanded combinatorially. Run: node tools/extract-googlesql-tests.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const SRC = "vendor/googlesql/googlesql/analyzer/testdata";
const OUT = "harness/local/bigquery-zetasql";

if (!existsSync(SRC)) {
	console.error(`missing ${SRC} — sparse-clone google/googlesql first (see the plan)`);
	process.exit(1);
}

/** Expand `{{a|b|c}}` alternations into all variants. Empty option (e.g. `{{x.|}}`) => "". */
function expand(query) {
	const m = query.match(/\{\{([^}]*)\}\}/);
	if (!m) return [query];
	const opts = m[1].split("|");
	return opts.flatMap((o) => expand(query.slice(0, m.index) + o + query.slice(m.index + m[0].length)));
}

function blocks(text) {
	return text.split(/^==$/m); // top-level test separator
}

function cleanQuery(raw) {
	// Drop leading `[options...]` lines and `#` comment lines; keep the SQL.
	return raw
		.split("\n")
		.filter((l) => !/^\s*\[/.test(l) && !/^\s*#/.test(l))
		.join("\n")
		.trim();
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "positive"), { recursive: true });
mkdirSync(join(OUT, "negative"), { recursive: true });

let pos = 0;
let neg = 0;
for (const file of readdirSync(SRC).filter((f) => f.endsWith(".test"))) {
	const text = readFileSync(join(SRC, file), "utf8");
	const base = file.replace(/\.test$/, "");
	let i = 0;
	for (const block of blocks(text)) {
		const sep = block.indexOf("\n--");
		if (sep === -1) continue; // no expected section; skip prose-only blocks
		const query = cleanQuery(block.slice(0, sep));
		if (!query) continue;
		const expected = block.slice(sep + 3).trim();
		const negative = /^ERROR:\s*Syntax error/i.test(expected);
		for (const variant of expand(query)) {
			if (!variant.trim()) continue;
			const dir = negative ? "negative" : "positive";
			writeFileSync(join(OUT, dir, `${base}_${i++}.sql`), variant + "\n");
			if (negative) neg++;
			else pos++;
		}
	}
}
console.log(`extracted: ${pos} positive, ${neg} negative -> ${OUT}`);
```

- [ ] **Step 4: Run the extractor**

Run: `node tools/extract-googlesql-tests.mjs`
Expected: `extracted: <several thousand> positive, <several hundred> negative -> harness/local/bigquery-zetasql`. Sanity-check: `ls harness/local/bigquery-zetasql/positive | wc -l` is in the thousands; open two or three positive files and confirm they are plain SQL queries (no `==`, no `--`, no `[options]`).

- [ ] **Step 5: Commit (tool only — corpus + vendor are gitignored)**

```bash
git add tools/extract-googlesql-tests.mjs .gitignore
git commit -m "feat(bigquery): ZetaSQL .test corpus extractor (positive/negative split)"
```

---

## Task 4: Corpus gate

A `skipIf`-absent suite that ratchets the positive parse-rate and asserts the negatives are rejected — the first two-sided conformance gate in the project. Mirror the skip/structure conventions of `tests/snowflake.corpus.test.ts`.

**Files:**
- Create: `tests/bigquery.corpus.test.ts`

- [ ] **Step 1: Write the gate**

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBigQuery } from "../src/bigquery/parse.js";

const CORPUS = resolve("harness/local/bigquery-zetasql");
const positives = () => readdirSync(join(CORPUS, "positive")).filter((f) => f.endsWith(".sql"));
const negatives = () => readdirSync(join(CORPUS, "negative")).filter((f) => f.endsWith(".sql"));

// Baselines: set these to the FIRST measured numbers, then ratchet up as grammar gaps close.
// A run below POSITIVE_BASELINE (regression) or below NEGATIVE_BASELINE fails the gate.
const POSITIVE_BASELINE = 0; // <-- set in Step 3
const NEGATIVE_BASELINE = 0; // <-- set in Step 3

describe.skipIf(!existsSync(CORPUS))("BigQuery vs the ZetaSQL .test corpus", () => {
	it("parses the positive cases (ratchet)", { timeout: 600000 }, () => {
		let pass = 0;
		const fails: string[] = [];
		for (const f of positives()) {
			const sql = readFileSync(join(CORPUS, "positive", f), "utf8");
			let errs = 1;
			try {
				errs = parseBigQuery(sql).errors;
			} catch {
				errs = -1;
			}
			if (errs === 0) pass++;
			else fails.push(f);
		}
		// eslint-disable-next-line no-console
		console.log(`BigQuery positives: ${pass}/${positives().length}`);
		expect(pass).toBeGreaterThanOrEqual(POSITIVE_BASELINE);
	});

	it("rejects the syntax-error negative cases (ratchet)", { timeout: 600000 }, () => {
		let rejected = 0;
		for (const f of negatives()) {
			const sql = readFileSync(join(CORPUS, "negative", f), "utf8");
			let errs = 0;
			try {
				errs = parseBigQuery(sql).errors;
			} catch {
				errs = 1;
			}
			if (errs > 0) rejected++;
		}
		// eslint-disable-next-line no-console
		console.log(`BigQuery negatives rejected: ${rejected}/${negatives().length}`);
		expect(rejected).toBeGreaterThanOrEqual(NEGATIVE_BASELINE);
	});
});
```

- [ ] **Step 2: Run it to see the raw numbers**

Run: `npx vitest run tests/bigquery.corpus.test.ts`
Expected: PASS (baselines are 0). Read the two `console.log` lines — e.g. `positives: 5200/5800`, `negatives rejected: 480/520`.

- [ ] **Step 3: Pin the baselines and re-run**

Set `POSITIVE_BASELINE` and `NEGATIVE_BASELINE` to the measured pass/reject counts from Step 2. Re-run: `npx vitest run tests/bigquery.corpus.test.ts` → PASS. These numbers are now a regression floor; raise them as Task 6 closes grammar gaps.

- [ ] **Step 4: Commit**

```bash
git add tests/bigquery.corpus.test.ts
git commit -m "feat(bigquery): ZetaSQL corpus gate — positive ratchet + negative-rejection gate"
```

---

## Task 5: `lower` entry + statement-kind

Create `src/bigquery/lower.ts` with the public `lower(tree)` entry and the `statementCategory` deriver, returning a flagged-empty body for non-query statements (exactly like `src/snowflake/lower.ts`). The query *body* is filled in Task 6; here it returns the empty body so the pipeline runs and statement-kind is correct.

**Files:**
- Create: `src/bigquery/lower.ts`
- Test: `tests/bigquery.test.ts` (append)

- [ ] **Step 1: Append failing statement-kind tests**

Add to `tests/bigquery.test.ts`:
```ts
import { lower } from "../src/bigquery/lower.js";

function kind(sql: string) {
	const r = parseBigQuery(sql);
	expect(r.errors, sql).toBe(0);
	return lower(r.tree).statement;
}

describe("BigQuery statement category (from the parse)", () => {
	it("query / dml / ddl / utility / compound", () => {
		expect(kind("SELECT a FROM t")).toBe("query");
		expect(kind("WITH c AS (SELECT 1 AS x) SELECT x FROM c")).toBe("query");
		expect(kind("INSERT INTO t (a) VALUES (1)")).toBe("dml");
		expect(kind("CREATE TABLE t (a INT64)")).toBe("ddl");
		expect(kind("DROP TABLE t")).toBe("ddl");
		expect(kind("SELECT 1; SELECT 2")).toBe("compound");
	});
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/bigquery.test.ts`
Expected: FAIL — cannot import `lower`.

- [ ] **Step 3: Inspect the statement rules you must map**

Run:
```bash
grep -nE "^(sql_statement_body|query_statement|dml_statement|insert_statement|update_statement|delete_statement|merge_statement|create_.*_statement|drop_.*_statement|alter_.*_statement):" grammars/bigquery/GoogleSQLParser.g4 | head -40
```
This lists the top-level statement rules. `query_statement` → query; `insert/update/delete/merge_statement` → dml; `create_*`/`drop_*`/`alter_*` → ddl; `grant`/`revoke` → dcl; `begin`/`commit`/`rollback` (transaction) → tcl; the rest (`set`, `call`, `export`, `load`, `define`, show/describe) → utility. The file structure is `root → stmts → unterminated_sql_statement → sql_statement_body → <one of the *_statement rules>`.

- [ ] **Step 4: Write `src/bigquery/lower.ts`**

Model it on `src/snowflake/lower.ts`. The entry:
```ts
import { ParserRuleContext, TerminalNode, type ParseTree } from "antlr4ng";
import { GoogleSQLParser as P } from "../generated/bigquery/GoogleSQLParser.js";
import type { /* QueryExpr, SelectExpr, Source, Expr, … */ } from "../ir/ir.js";
import { keywordCategory, type StatementCategory } from "../ir/statement.js";

// --- navigation helpers: copy directChildrenOfRule / firstOfRule / shallowFirstOfRule /
// --- directFirstByRule / directTokenType from src/databricks/lower.ts (they are generic) ---

export function lower(tree: ParserRuleContext): QueryExpr {
	const statement = statementCategory(tree);
	if (statement === "query") {
		const q = firstOfRule(tree, P.RULE_query_statement);
		if (q) {
			const lowered = lowerQueryStatement(q); // Task 6
			lowered.statement = "query";
			return lowered;
		}
	}
	const q = emptyQuery(tree);
	q.statement = statement;
	return q;
}

function statementCategory(tree: ParserRuleContext): StatementCategory {
	const bodies: ParserRuleContext[] = [];
	for (const s of directChildrenOfRule(tree, P.RULE_stmts)) {
		for (const u of directChildrenOfRule(s, P.RULE_unterminated_sql_statement)) {
			bodies.push(...directChildrenOfRule(u, P.RULE_sql_statement_body));
		}
	}
	if (bodies.length === 0) return "other";
	if (bodies.length > 1) return "compound";
	return bodyCategory(bodies[0]);
}

function bodyCategory(body: ParserRuleContext): StatementCategory {
	// sql_statement_body wraps exactly one *_statement; categorise by which rule, or by the
	// leading keyword as a fallback. query_statement is the only one we lower.
	if (directChildrenOfRule(body, P.RULE_query_statement).length) return "query";
	for (const r of [P.RULE_insert_statement, P.RULE_update_statement, P.RULE_delete_statement, P.RULE_merge_statement]) {
		if (directChildrenOfRule(body, r).length) return "dml";
	}
	return keywordCategory(body.start?.text ?? ""); // CREATE/DROP/ALTER→ddl, GRANT→dcl, BEGIN/COMMIT→tcl, SET/CALL/EXPORT→utility
}

function emptyQuery(cst: ParserRuleContext): QueryExpr {
	return {
		kind: "query",
		ctes: [],
		body: { kind: "select", projections: [], from: [], columns: [], aggregated: false, unsupported: ["non-query"], cst },
		cst,
	};
}
```
For `lowerQueryStatement`, in this task return the empty body so the file compiles:
```ts
function lowerQueryStatement(_q: ParserRuleContext): QueryExpr {
	return emptyQuery(_q); // replaced in Task 6
}
```
Verify the exact rule constant names exist: `grep -oE "RULE_(stmts|unterminated_sql_statement|sql_statement_body|query_statement|insert_statement|update_statement|delete_statement|merge_statement)" src/generated/bigquery/GoogleSQLParser.ts | sort -u`. Adjust any name that differs (e.g. if the grammar calls it `dml_statement` wrapping the four, map that instead).

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/bigquery.test.ts` then `npm run typecheck`
Expected: the statement-category test PASSES; typecheck clean. (The body is empty for now — that's correct for this task.)

- [ ] **Step 6: Commit**

```bash
git add src/bigquery/lower.ts tests/bigquery.test.ts
git commit -m "feat(bigquery): lower entry + parse-derived statement category"
```

---

## Task 6: Lower the query layer

Fill in `lowerQueryStatement` to map the GoogleSQL query CST onto the shared IR. This is the bulk of the work. Build it construct-by-construct with a failing test before each, mirroring `src/snowflake/lower.ts` (the closest analogue) and reusing its helper shapes. **Do not** write it all at once — each construct is one TDD increment (test → run-fail → implement → run-pass → commit).

**Files:**
- Modify: `src/bigquery/lower.ts`
- Test: `tests/bigquery.test.ts` (append per construct)

**Rule → IR mapping (the BigQuery-specific deltas; everything else mirrors Snowflake):**

| GoogleSQL CST | IR target | Notes |
|---|---|---|
| `query_statement → query → query_primary → select` | `QueryExpr` + `SelectExpr` | `select: select_clause from_clause? opt_clauses_following_from?` |
| `select_clause` → `select_column*` | `Projection[]` | a `select_column` is an expr + optional alias; `*` and `t.*` → `star` node |
| `SELECT * EXCEPT (a,b)` / `REPLACE (e AS c)` | `star` with `exclude` / `replace` | already in IR (`src/ir/ir.ts` `star`) — same as Snowflake/Spark |
| `from_clause → from_clause_contents` | `Source[]` | join chain; each table → `TableSource` (backtick/dotted names → multi-part `name`) |
| `unnest_expression` (`UNNEST(expr) AS x`) | `LateralViewSource` | `alias` = the AS name; `columns` = [alias]; this is the BigQuery UNNEST → lateral mapping |
| `where_clause` (`WHERE expression`) | `SelectExpr.where` | `lowerExpression` |
| `group_by_clause` | `SelectExpr.groupBy` | handle `GROUP BY ALL` and ROLLUP/CUBE/GROUPING SETS like Spark |
| `having_clause` | `SelectExpr.having` | |
| `qualify_clause` | `SelectExpr.qualify` | BigQuery has QUALIFY — same IR field as Snowflake/Spark |
| `with_clause` | `QueryExpr.ctes` (`CteDef[]`) | incl. `WITH RECURSIVE` |
| set operation (`UNION/INTERSECT/EXCEPT [ALL\|DISTINCT]`) | `SetOpExpr` | note BigQuery `EXCEPT` here is the set op, distinct from `SELECT * EXCEPT` |
| `STRUCT(...)` / `ARRAY[...]` / `[...]` literals | `function`/`subscript` | struct/array construction → `function` named `struct`/`array`; `a[OFFSET(0)]` → `subscript` |
| struct field access `a.b.c` | `column` with `parts` or `subscript` | mirror Spark dereference handling in `src/databricks/lower.ts` |
| named arg `name => expr` | `function` arg | keep the value expr; the IR `function.args` holds positional — model the value, note the name is dropped (acceptable: not load-bearing for resolution) |
| expression grammar | `Expr` (binary/unary/case/cast/function/predicate/subscript/lambda) | mirror `lowerExpression` in `src/snowflake/lower.ts`; anything unmodelled → `other` (never throw) |

**Required invariant:** a valid parse must NEVER throw in `lower` — unmodelled constructs become `{ kind: "other" }` Expr nodes or `unsupported: [...]` flags, exactly as the other dialects do (enforced by the corpus gate in Step N below).

- [ ] **Step 1: Test — basic projections + FROM**

Append to `tests/bigquery.test.ts`:
```ts
import { resolveScopes } from "../src/scope/scope.js";

function q(sql: string) {
	const ir = lower(parseBigQuery(sql).tree);
	expect(ir.body.kind).toBe("select");
	return ir.body as Extract<typeof ir.body, { kind: "select" }>;
}

describe("BigQuery lowering", () => {
	it("projections and a table source", () => {
		const b = q("SELECT a, b AS c FROM t");
		expect(b.projections.map((p) => p.name)).toEqual(["a", "c"]);
		expect(b.from).toHaveLength(1);
		expect(b.from[0]).toMatchObject({ kind: "table" });
	});
});
```

- [ ] **Step 2: Run → fail** (`lowerQueryStatement` returns empty body, so `projections` is `[]`).

Run: `npx vitest run tests/bigquery.test.ts -t "projections and a table source"` → FAIL.

- [ ] **Step 3: Implement `lowerQueryStatement` + `buildSelect` for projections & FROM**

Port the `lowerQueryStatement → query → query_primary → select → buildSelect` chain from `src/snowflake/lower.ts`, substituting the GoogleSQL rule names from the mapping table. Use `directFirstByRule(select, [P.RULE_select_clause, P.RULE_from_clause, P.RULE_where_clause, P.RULE_group_by_clause, P.RULE_having_clause, P.RULE_qualify_clause])` (the single-pass clause collector from `src/databricks/lower.ts`) to gather clauses. Build `Projection[]` from `select_clause`'s `select_column` children; build `Source[]` from `from_clause_contents`.

- [ ] **Step 4: Run → pass.** Run the same `-t` command → PASS.

- [ ] **Step 5: Commit.** `git commit -am "feat(bigquery): lower projections + FROM"`

- [ ] **Step 6+: Repeat the test→fail→implement→pass→commit cycle for each remaining construct**, one commit each, in this order (each has a dedicated test asserting the IR shape, mirroring the matching test in `tests/snowflake.test.ts`):
  1. `WHERE` / `GROUP BY` / `HAVING` / `QUALIFY` predicates → `lowerExpression` + the `SelectExpr` fields.
  2. `JOIN` chain + `ON` conditions → multiple `Source` + `joinConditions`.
  3. `UNNEST(expr) AS x` → `LateralViewSource` (assert `from` contains `{ kind: "lateral", alias: "x" }`).
  4. `SELECT * EXCEPT (a)` / `REPLACE (e AS c)` → `star` with `exclude`/`replace`.
  5. CTEs (`WITH c AS (…)`, incl. `RECURSIVE`) → `QueryExpr.ctes`.
  6. Set operations → `SetOpExpr` (assert `op` and `all`).
  7. Subqueries in FROM and in expressions → `SubquerySource` / `subquery` Expr.
  8. The expression grammar: binary/unary/CASE/CAST/function/`IN`/`BETWEEN`/`LIKE`/`subscript`/`STRUCT`/`ARRAY`/named-args — port `lowerExpression` from `src/snowflake/lower.ts`, adjusting context-class names to the generated GoogleSQL `*Context` types (`grep "Context" src/generated/bigquery/GoogleSQLParser.ts | grep -oE "[A-Za-z]+Context" | sort -u` to list them).

- [ ] **Step N: Re-measure the corpus and ratchet the baseline up**

Run: `npx vitest run tests/bigquery.corpus.test.ts` and `npx vitest run tests/ir-completeness.test.ts` if you wire BigQuery into it.
Raise `POSITIVE_BASELINE` in `tests/bigquery.corpus.test.ts` to the new (higher) pass count. Add a no-throw assertion over the positive corpus (mirror the Snowflake corpus's `resolveScopes(lower(...))` not-to-throw loop) so `lower` is proven total. Commit.

---

## Task 7: Inference dialect entry

Register BigQuery's type knowledge. Mirror `src/infer/snowflake.ts` + the registry pattern in `src/infer/dialect.ts`.

**Files:**
- Create: `src/infer/bigquery.ts`
- Modify: `src/infer/dialect.ts`
- Test: `tests/bigquery.pipeline.test.ts` (Task 8 covers inference assertions)

- [ ] **Step 1: Write `src/infer/bigquery.ts`**

```ts
import { parseType, scalar, UNKNOWN, type Type } from "./types.js";
import type { FnRule } from "./functions.js";

// GoogleSQL scalar type aliases → canonical types.
const BQ_ALIASES: Record<string, string> = {
	int64: "int", float64: "double", numeric: "decimal", bignumeric: "decimal",
	bool: "boolean", bytes: "binary", string: "string", date: "date",
	datetime: "timestamp", timestamp: "timestamp", time: "time",
};

export function bigqueryParseType(text: string): Type {
	return parseType(text, BQ_ALIASES);
}

export function bigqueryLiteral(text: string): Type {
	const t = text.trim();
	if (/^(b?'|b?"|r?'|r?")/i.test(t)) return scalar(/^b/i.test(t) ? "binary" : "string");
	if (/^(true|false)$/i.test(t)) return scalar("boolean");
	if (/^null$/i.test(t)) return UNKNOWN;
	if (/^[+-]?\d+$/.test(t)) return scalar("int");
	if (/^[+-]?(\d+\.\d*|\.\d+|\d+)([e][+-]?\d+)?$/i.test(t) && /[.e]/i.test(t)) return scalar("double");
	if (/^date\s/i.test(t)) return scalar("date");
	if (/^timestamp\s/i.test(t)) return scalar("timestamp");
	return UNKNOWN;
}

// Seed with high-frequency functions; expand from the BigQuery functions reference over time.
// A missing rule yields `unknown`, never a wrong type — so partial coverage is safe.
export const BIGQUERY_FUNCTION_RETURNS: Record<string, FnRule> = {
	// e.g. concat: () => scalar("string"), array_length: () => scalar("int"), …
};
```

- [ ] **Step 2: Register it in `src/infer/dialect.ts`**

Add the import and entry, and the `DIALECTS` key:
```ts
import { BIGQUERY_FUNCTION_RETURNS, bigqueryLiteral, bigqueryParseType } from "./bigquery.js";

const bigquery: InferDialect = {
	functions: BIGQUERY_FUNCTION_RETURNS,
	literal: bigqueryLiteral,
	parseType: bigqueryParseType,
	division: "float", // BigQuery: INT64 / INT64 → FLOAT64
};

const DIALECTS: Record<string, InferDialect> = { databricks, tsql, snowflake, bigquery };
```

- [ ] **Step 3: Typecheck.** Run: `npm run typecheck` → clean.

- [ ] **Step 4: Commit.** `git commit -am "feat(bigquery): inference dialect entry (type aliases, literals, division)"`

---

## Task 8: Pipeline test + public API + docs

Prove the full pipeline runs unchanged on BigQuery, export the entry, and correct the docs.

**Files:**
- Create: `tests/bigquery.pipeline.test.ts`
- Modify: `src/index.ts`, `CLAUDE.md`, `README.md`, `docs/PLAN.md`

- [ ] **Step 1: Write the pipeline test**

Mirror `tests/snowflake.pipeline.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseBigQuery } from "../src/bigquery/parse.js";
import { lower } from "../src/bigquery/lower.js";
import { resolveScopes } from "../src/scope/scope.js";
import { Schema } from "../src/qualify/schema.js";
import { qualify } from "../src/qualify/qualify.js";

describe("BigQuery pipeline (semantic layer runs unchanged)", () => {
	it("resolves scopes + qualifies a join with UNNEST", () => {
		const sql = "SELECT t.id, e FROM `proj.ds.t` AS t, UNNEST(t.events) AS e WHERE t.id > 0";
		const ir = lower(parseBigQuery(sql).tree);
		expect(() => resolveScopes(ir, "bigquery")).not.toThrow();
		const tree = resolveScopes(ir, "bigquery");
		expect(tree.statement).toBe("query");
	});

	it("infers types from a schema", () => {
		const schema = new Schema({ "proj.ds.t": { id: "INT64", name: "STRING" } });
		const ir = lower(parseBigQuery("SELECT id, name FROM `proj.ds.t`").tree);
		const scopes = resolveScopes(ir, "bigquery");
		expect(() => qualify(scopes, schema)).not.toThrow();
	});
});
```
(Adjust `Schema` construction to the real `src/qualify/schema.ts` constructor signature — check it first.)

- [ ] **Step 2: Run → adjust → pass.** `npx vitest run tests/bigquery.pipeline.test.ts`. Fix any schema-API mismatch. Expected: PASS.

- [ ] **Step 3: Export from `src/index.ts`**

Add:
```ts
export { parseBigQuery } from "./bigquery/parse.js";
export { lower as lowerBigQuery } from "./bigquery/lower.js";
```
(Match how T-SQL/Snowflake are or are not yet exported — keep it consistent with the others.)

- [ ] **Step 4: Correct the docs**

- `CLAUDE.md`: change the locked decision "**Redshift / BigQuery** ← hand-authored standalone (no grammars-v4 grammar exists for these)" to note BigQuery is now a **fork-and-clean** of `bytebase/parser` `googlesql/` (BSD-3), vendored at `grammars/bigquery/`; update the dialect-order and current-status sections to list BigQuery.
- `README.md`: move BigQuery from "planned" to a supported row in the dialect table.
- `docs/PLAN.md`: update the BigQuery phase to reflect fork-and-clean + the ZetaSQL corpus gate; note Redshift remains hand-authored (via Postgres).

- [ ] **Step 5: Full suite + commit**

Run: `npm test` (confirm BigQuery suites pass and nothing else regressed; check the skip count for the corpus gate).
```bash
git add -A
git commit -m "feat(bigquery): pipeline test, public API export, docs"
```

---

## Self-review checklist (done while writing — kept for the executor)

- **Spec coverage:** parse (T1–2), corpus (T3–4), lower incl. statement-kind + query layer (T5–6), inference (T7), pipeline/API/docs (T8). All phases from the research/plan discussion are covered.
- **Type consistency:** `parseBigQuery` and `lower` names are used identically across T2/T5/T6/T8; `statementCategory`/`bodyCategory`/`emptyQuery`/`lowerQueryStatement` are defined in T5 and only referred to (not redefined) in T6; the `InferDialect` shape in T7 matches `src/infer/dialect.ts` exactly (`functions`/`literal`/`parseType`/`division`).
- **Template references are to real files, not "see Task N":** every "mirror X" points at an existing committed file (`src/snowflake/*`, `src/databricks/lower.ts`, `tests/snowflake.*`) the executor can open.
- **No-throw invariant** for `lower` is stated explicitly and gated by the corpus no-throw loop in T6 Step N.

## Open risks (flag if hit during execution)

1. **Generated-rule-name drift:** the `P.RULE_*` constants in T5/T6 are derived from the grammar's rule names; verify each against `src/generated/bigquery/GoogleSQLParser.ts` (grep) before using — the grammar may name a rule slightly differently (e.g. `dml_statement` wrapping insert/update/delete/merge). Adjust the mapping, not the architecture.
2. **`{{}}` alternation blow-up:** a few ZetaSQL test queries have many alternations; the extractor expands combinatorially. If a single block explodes into hundreds of variants, cap expansion (e.g. take the first 8 variants) in `tools/extract-googlesql-tests.mjs` and `console.log` the cap — don't silently truncate.
3. **Grammar TODOs:** the upstream grammar has incomplete spots (e.g. `define_macro_statement`). If a positive corpus case fails on one, that's a real grammar gap — fix it in `grammars/bigquery/GoogleSQLParser.g4`, regen, and (BSD-3 permitting) consider a PR back to `bytebase/parser`.
4. **Negative-gate false positives:** some ZetaSQL `ERROR: Syntax error` cases depend on analysis-time context; if a negative case unexpectedly parses clean, verify against the source `.test` file before lowering the negative baseline — it may be a genuine over-acceptance to fix, or a mislabeled case to exclude.
