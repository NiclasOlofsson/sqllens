# LSP Acceptance Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A thin LSP server (`src/lsp/`) over the existing parser/analysis library that lights up syntax + semantic diagnostics, hover types, go-to-definition, and document symbols — driven by an in-memory protocol acceptance suite and attachable to VS Code over stdio.

**Architecture:** The server contains NO analysis logic — only translation: LSP request → library call (`parse`/`analyze` + the shared passes) → library output (positions/spans/types) → LSP type. The one genuinely new compute is `node-at` (character offset → smallest covering IR expression + its scope). A library change (issue #6) makes `parse()` surface positioned syntax diagnostics. `src/lsp/` is an application, excluded from the public barrel (`src/index.ts`).

**Tech Stack:** TypeScript (ESM, `.js` import specifiers, `moduleResolution: Bundler`), antlr4ng runtime, `vscode-languageserver` / `vscode-languageserver-textdocument` / `vscode-languageserver-protocol`, `minimatch`. Build/typecheck with `tsgo`; tests with `vitest`.

## Global Constraints

- **Position bases (the #1 correctness trap):** antlr tokens use **1-based line, 0-based column**; `Token.start`/`Token.stop` are **0-based inclusive char offsets**. The library's `Diagnostic` (`src/qualify/qualify.ts`) and `Span` (`src/symbols/symbols.ts`) carry **1-based line, 0-based column**. LSP `Position` is **0-based line, 0-based character**. `src/lsp/ranges.ts` is the ONLY place that converts between them (subtract 1 from line). Nothing else in `src/lsp/` does line/column math.
- **Thin adapter:** `src/lsp/` does translation only. No analysis logic. A reviewer rejects any feature that re-derives what the library already computes (types, definitions, column resolution, output columns).
- **A valid parse never throws** (existing library contract); the server mirrors it — a request on a document with syntax errors still returns best-effort hover/symbols from whatever lowered.
- **Not in the barrel:** never add `src/lsp/*` exports to `src/index.ts`.
- **Generated code is gitignored:** `src/generated/` is a build product; never hand-edit, never commit.
- **ESM imports:** every relative import inside `src/` uses a `.js` extension (e.g. `import { parse } from "../api.js"`), matching the existing codebase.
- **Commit after each task.** Conventional-commit messages. End commit messages with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- **Run one test file:** `npx vitest run tests/<file>.test.ts`. Full suite: `npm test`. Typecheck: `npm run typecheck`.

---

## Phase 0 — wire Redshift into the uniform surface

Redshift has `parseRedshift` + `lower` + corpus gates but is absent from `src/api.ts`, the infer registry, and the barrel — so `parse()`/`analyze()` and the LSP can't reach it. Niclas chose to wire it **first** (2026-06-28) so the acceptance server covers all five dialects. Three small tasks; 0a and 0b are independent, 0c follows 0b. `lower`'s export name is `lower` (verify in `src/redshift/lower.ts`; mirror the other dialects' `lower as lower<Dialect>` import).

### Task 0a: Redshift inference knowledge

**Files:**
- Create: `src/infer/redshift.ts`
- Modify: `src/infer/dialect.ts`
- Test: `tests/redshift.infer.test.ts`

**Interfaces:**
- Consumes: `parseType`, `scalar`, `UNKNOWN`, `Type` from `./types.js`; `FnRule` from `./functions.js`; `databricksLiteral` from `./literals.js` (Redshift literals follow standard SQL forms — same classification as Spark's, reused rather than duplicated).
- Produces: `REDSHIFT_ALIASES`, `redshiftParseType`, `REDSHIFT_FUNCTION_RETURNS` in `src/infer/redshift.ts`; a `redshift` `InferDialect` entry added to `DIALECTS` in `src/infer/dialect.ts`.

**Division semantics (verified against AWS docs):** Redshift `INT4 / INT4 → INT4` — integer division truncates (table at `r_numeric_computations201`). So `division: "integer"` (same strategy as T-SQL).

- [ ] **Step 1: Write the failing test**

```ts
// tests/redshift.infer.test.ts
import { describe, it, expect } from "vitest";
import { parseRedshift } from "../src/redshift/parse.js";
import { lower } from "../src/redshift/lower.js";
import { resolveScopes } from "../src/scope/scope.js";
import { inferType } from "../src/infer/infer.js";
import { Schema } from "../src/qualify/schema.js";
import { redshiftParseType, REDSHIFT_ALIASES } from "../src/infer/redshift.js";

describe("redshift inference", () => {
  it("maps Postgres scalar names to canonical types", () => {
    expect(redshiftParseType("int4")).toEqual({ kind: "scalar", name: "int" });
    expect(redshiftParseType("int8")).toEqual({ kind: "scalar", name: "bigint" });
    expect(redshiftParseType("float8")).toEqual({ kind: "scalar", name: "double" });
    expect(redshiftParseType("numeric(10,2)")).toEqual({ kind: "scalar", name: "decimal" });
    expect(redshiftParseType("character varying")).toEqual({ kind: "scalar", name: "string" });
    expect(REDSHIFT_ALIASES.int2).toBe("smallint");
  });

  it("integer/integer divides to int (Redshift truncates)", () => {
    const sql = "SELECT a / b AS r FROM t";
    const scopes = resolveScopes(lower(parseRedshift(sql).tree), "redshift");
    const schema = new Schema({ t: { a: "int4", b: "int4" } });
    // locate the division expr in the root select's projection
    const body = scopes.root.body as any;
    const div = body.projections[0].expr;
    expect(inferType(div, scopes.root, schema)).toEqual({ kind: "scalar", name: "int" });
  });

  it("a known base-table column infers its schema type", () => {
    const sql = "SELECT amount FROM sales";
    const scopes = resolveScopes(lower(parseRedshift(sql).tree), "redshift");
    const schema = new Schema({ sales: { amount: "numeric(10,2)" } });
    const col = (scopes.root.body as any).projections[0].expr;
    expect(inferType(col, scopes.root, schema)).toEqual({ kind: "scalar", name: "decimal" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/redshift.infer.test.ts`
Expected: FAIL — `Cannot find module '../src/infer/redshift.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/infer/redshift.ts
import { parseType, scalar, UNKNOWN, type Type } from "./types.js";
import type { FnRule } from "./functions.js";

// ---------------------------------------------------------------------------
// Redshift (Postgres-derived) inference knowledge. Scalar-name aliases map the
// Postgres/Redshift type vocabulary onto the shared canonical names; division
// truncates integers (verified: AWS r_numeric_computations201). The function
// registry is a doc-cited starter — a missing entry safely yields `unknown`
// (the inference contract), and it grows over time like the other dialects'.
// ---------------------------------------------------------------------------

export const REDSHIFT_ALIASES: Record<string, string> = {
  int2: "smallint",
  int4: "int",
  integer: "int",
  int8: "bigint",
  numeric: "decimal",
  dec: "decimal",
  float4: "float",
  real: "float",
  float8: "double",
  float: "double", // bare FLOAT is double precision in Redshift
  "double precision": "double",
  bool: "boolean",
  char: "string",
  character: "string",
  bpchar: "string",
  nchar: "string",
  varchar: "string",
  "character varying": "string",
  nvarchar: "string",
  text: "string",
  timestamptz: "timestamp",
  "timestamp without time zone": "timestamp",
  "timestamp with time zone": "timestamp",
  timetz: "time",
  varbyte: "binary",
  varbinary: "binary",
};

export function redshiftParseType(text: string): Type {
  return parseType(text, REDSHIFT_ALIASES);
}

/** Doc-cited starter set of common Redshift scalar/aggregate functions. Grows over time;
 *  anything absent yields `unknown` (never a wrong type). Modeled on FUNCTION_RETURNS. */
export const REDSHIFT_FUNCTION_RETURNS: Record<string, FnRule> = {
  // string
  upper: () => scalar("string"),
  lower: () => scalar("string"),
  trim: () => scalar("string"),
  btrim: () => scalar("string"),
  lpad: () => scalar("string"),
  rpad: () => scalar("string"),
  substring: () => scalar("string"),
  left: () => scalar("string"),
  right: () => scalar("string"),
  replace: () => scalar("string"),
  concat: () => scalar("string"),
  to_char: () => scalar("string"),
  // numeric / position
  length: () => scalar("int"),
  len: () => scalar("int"),
  char_length: () => scalar("int"),
  strpos: () => scalar("int"),
  position: () => scalar("int"),
  // date/time
  to_date: () => scalar("date"),
  to_timestamp: () => scalar("timestamp"),
  current_date: () => scalar("date"),
  sysdate: () => scalar("timestamp"),
  getdate: () => scalar("timestamp"),
  current_timestamp: () => scalar("timestamp"),
  // passthrough / aggregate
  coalesce: (args) => args.find((a) => a.kind !== "unknown") ?? UNKNOWN,
  nvl: (args) => args.find((a) => a.kind !== "unknown") ?? UNKNOWN,
  abs: (args) => args[0] ?? UNKNOWN,
  count: () => scalar("bigint"),
};
```

Then in `src/infer/dialect.ts`:
1. Import: `import { REDSHIFT_FUNCTION_RETURNS, redshiftParseType } from "./redshift.js";`
2. (Reuse the standard literal classifier — `databricksLiteral` is already imported.) Add the entry:
   ```ts
   const redshift: InferDialect = {
     functions: REDSHIFT_FUNCTION_RETURNS,
     literal: databricksLiteral,
     parseType: redshiftParseType,
     division: "integer", // Redshift: INT4 / INT4 → INT4 (truncates) — AWS r_numeric_computations201
   };
   ```
3. Add to the table: `const DIALECTS: Record<string, InferDialect> = { databricks, tsql, snowflake, bigquery, redshift };`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/redshift.infer.test.ts`
Expected: PASS (3 tests). (If `inferType` for the division expr does not see `division: "integer"`, confirm `resolveScopes(…, "redshift")` tagged the scope's `dialect` as `"redshift"` and that `inferDialect("redshift")` now resolves the new entry.)

- [ ] **Step 5: Commit**

```bash
git add src/infer/redshift.ts src/infer/dialect.ts tests/redshift.infer.test.ts
git commit -m "feat(infer): Redshift inference entry (aliases, division=integer, starter registry)"
```

---

### Task 0b: Redshift in the uniform parse()/analyze()

**Files:**
- Modify: `src/api.ts`
- Test: `tests/api.redshift.test.ts`

**Interfaces:**
- Consumes: `parseRedshift` from `./redshift/parse.js`; `lower as lowerRedshift` from `./redshift/lower.js`.
- Produces: `Dialect` union gains `"redshift"`; `DIALECTS` gains the `redshift` entry; `parse(sql, "redshift")` and `analyze(sql, "redshift", …)` work.

- [ ] **Step 1: Write the failing test**

```ts
// tests/api.redshift.test.ts
import { describe, it, expect } from "vitest";
import { parse, analyze } from "../src/api.js";
import { Schema } from "../src/qualify/schema.js";

describe("redshift through the uniform surface", () => {
  it("parse() accepts the redshift dialect and lowers to the IR", () => {
    const r = parse("SELECT amount FROM sales", "redshift");
    expect(r.ast.kind).toBe("query");
    expect(r.errors).toBe(0);
  });

  it("analyze() resolves a redshift query and flags an unknown column with a schema", () => {
    const schema = new Schema({ sales: { amount: "numeric(10,2)" } });
    const a = analyze("SELECT nope FROM sales", "redshift", { schema });
    expect(a.diagnostics.some((d) => /nope|unknown/i.test(d.message))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api.redshift.test.ts`
Expected: FAIL — `"redshift"` not assignable to `Dialect` (typecheck) / `DIALECTS["redshift"]` undefined.

- [ ] **Step 3: Write minimal implementation**

In `src/api.ts`:
1. Add imports next to the other dialect imports:
   ```ts
   import { parseRedshift } from "./redshift/parse.js";
   import { lower as lowerRedshift } from "./redshift/lower.js";
   ```
2. Extend the union: `export type Dialect = "databricks" | "tsql" | "snowflake" | "bigquery" | "redshift";`
3. Add to `DIALECTS`: `redshift: { parse: parseRedshift, lower: lowerRedshift },`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api.redshift.test.ts && npm run typecheck`
Expected: PASS (2 tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/api.ts tests/api.redshift.test.ts
git commit -m "feat(api): wire Redshift into the uniform parse()/analyze()"
```

---

### Task 0c: Redshift in the public barrel

**Files:**
- Modify: `src/index.ts`
- Test: `tests/index.redshift.test.ts`

**Interfaces:**
- Produces: `parseRedshift` and `lowerRedshift` re-exported from `src/index.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/index.redshift.test.ts
import { describe, it, expect } from "vitest";
import { parseRedshift, lowerRedshift } from "../src/index.js";

describe("barrel exports redshift", () => {
  it("re-exports parseRedshift + lowerRedshift", () => {
    expect(typeof parseRedshift).toBe("function");
    expect(typeof lowerRedshift).toBe("function");
    expect(lowerRedshift(parseRedshift("SELECT 1").tree).kind).toBe("query");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/index.redshift.test.ts`
Expected: FAIL — `parseRedshift`/`lowerRedshift` not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `src/index.ts` (the per-dialect building-blocks block):
```ts
export { parseRedshift } from "./redshift/parse.js";
export { lower as lowerRedshift } from "./redshift/lower.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/index.redshift.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts tests/index.redshift.test.ts
git commit -m "feat(api): export Redshift building blocks from the barrel"
```

---

## Phase A — issue #6: parse() surfaces positioned syntax diagnostics

Closes #6. Engine change across all **five** dialect parse wrappers + `src/api.ts`. The five dialect wirings (A2–A5, A5b) are independent and parallelizable; A6 (`api.ts`) is serialized after them.

> **Note — five dialects.** Redshift (`src/redshift/parse.ts`, `parseRedshift`) is a fully-built dialect on this branch and on master, with the same count-only error pattern. #6 says "each per-dialect parse\* building block", so Redshift is wired too (Task A5b). Phase 0 wires Redshift into `src/api.ts`, the infer registry, and the barrel, so by the time #6 lands the unified `parse()`/`analyze()` — and the LSP — cover **all five** dialects (A6 and the LSP dialect-config both include `redshift`).

### Task A1: Shared syntax-diagnostic collector

**Files:**
- Create: `src/parse-diagnostics.ts`
- Test: `tests/parse-diagnostics.test.ts`

**Interfaces:**
- Consumes: `Token` from `antlr4ng`.
- Produces:
  - `interface SyntaxDiagnostic { message: string; line: number; column: number; offset?: number; length: number; }` (line 1-based, column 0-based, offset = 0-based char index of the offending token, length ≥ 1).
  - `interface ErrorCollector { listener: object; readonly diagnostics: SyntaxDiagnostic[]; reset(): void; }`
  - `function makeErrorCollector(): ErrorCollector`

- [ ] **Step 1: Write the failing test**

```ts
// tests/parse-diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { makeErrorCollector } from "../src/parse-diagnostics.js";

describe("makeErrorCollector", () => {
  it("captures message, 1-based line, 0-based column, offset and length from a parser error", () => {
    const c = makeErrorCollector();
    const offending = { start: 7, stop: 11, text: "WHERE", line: 1, column: 7 };
    // antlr signature: syntaxError(recognizer, offendingSymbol, line, charPositionInLine, msg, e)
    (c.listener as any).syntaxError(null, offending, 1, 7, "mismatched input 'WHERE'", null);
    expect(c.diagnostics).toEqual([
      { message: "mismatched input 'WHERE'", line: 1, column: 7, offset: 7, length: 5 },
    ]);
  });

  it("handles a lexer error (null offending symbol) with length 1 and no offset", () => {
    const c = makeErrorCollector();
    (c.listener as any).syntaxError(null, null, 2, 3, "token recognition error", null);
    expect(c.diagnostics).toEqual([
      { message: "token recognition error", line: 2, column: 3, offset: undefined, length: 1 },
    ]);
  });

  it("reset() clears diagnostics (used to discount the SLL attempt before the LL retry)", () => {
    const c = makeErrorCollector();
    (c.listener as any).syntaxError(null, null, 1, 0, "x", null);
    c.reset();
    expect(c.diagnostics).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parse-diagnostics.test.ts`
Expected: FAIL — `Cannot find module '../src/parse-diagnostics.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/parse-diagnostics.ts
import type { Token } from "antlr4ng";

// ---------------------------------------------------------------------------
// Shared syntax-diagnostic capture for the per-dialect parse wrappers. The antlr
// error listener already receives message/line/column/offending-token — this
// collects them into a positioned SyntaxDiagnostic instead of discarding all but
// a count (issue #6). One collector is attached to both the lexer and parser; its
// diagnostics survive the two-stage SLL→LL parse via reset() (the SLL attempt's
// diagnostics are cleared before the LL retry, mirroring the old `errors = 0`).
//
// Positions are antlr-native and match the rest of the library: line is 1-based,
// column is 0-based; offset/length are 0-based inclusive char indices from the
// offending token. src/lsp/ranges.ts converts these to 0-based LSP positions.
// ---------------------------------------------------------------------------

export interface SyntaxDiagnostic {
  /** The parser's human-readable message (e.g. "mismatched input 'WHERE'"). */
  message: string;
  /** 1-based line of the offending token. */
  line: number;
  /** 0-based column of the offending token. */
  column: number;
  /** 0-based char offset of the offending token start; absent for lexer errors. */
  offset?: number;
  /** Offending token text length; 1 when unknown (lexer error / no token). */
  length: number;
}

export interface ErrorCollector {
  /** Attach to both the lexer and the parser via addErrorListener. */
  listener: object;
  /** Captured diagnostics, in report order. */
  readonly diagnostics: SyntaxDiagnostic[];
  /** Clear captured diagnostics — called before the LL retry to discount the SLL attempt. */
  reset(): void;
}

export function makeErrorCollector(): ErrorCollector {
  const diagnostics: SyntaxDiagnostic[] = [];
  const listener = {
    syntaxError(
      _recognizer: unknown,
      offendingSymbol: Token | null,
      line: number,
      charPositionInLine: number,
      msg: string,
    ): void {
      diagnostics.push({
        message: msg,
        line,
        column: charPositionInLine,
        offset: offendingSymbol?.start,
        length: offendingSymbol?.text?.length ?? 1,
      });
    },
    reportAmbiguity(): void {},
    reportAttemptingFullContext(): void {},
    reportContextSensitivity(): void {},
  };
  return {
    listener,
    diagnostics,
    reset(): void {
      diagnostics.length = 0;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parse-diagnostics.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/parse-diagnostics.ts tests/parse-diagnostics.test.ts
git commit -m "feat(parse): shared positioned syntax-diagnostic collector (#6)"
```

---

### Task A2: Databricks parse() returns positioned diagnostics

**Files:**
- Modify: `src/databricks/parse.ts`
- Test: `tests/databricks.diagnostics.test.ts`

**Interfaces:**
- Consumes: `makeErrorCollector`, `SyntaxDiagnostic` from `../parse-diagnostics.js`.
- Produces: `ParseResult` (in `src/databricks/parse.ts`) gains `diagnostics: SyntaxDiagnostic[]`. `errors` (count) is unchanged in meaning; set `errors = diagnostics.length`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/databricks.diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { parseDatabricks } from "../src/databricks/parse.js";

describe("parseDatabricks diagnostics", () => {
  it("returns zero diagnostics for valid SQL", () => {
    const r = parseDatabricks("SELECT a FROM t");
    expect(r.errors).toBe(0);
    expect(r.diagnostics).toEqual([]);
  });

  it("returns a positioned diagnostic for broken SQL (1-based line, 0-based column)", () => {
    const r = parseDatabricks("SELECT FROM");
    expect(r.errors).toBeGreaterThan(0);
    expect(r.diagnostics.length).toBe(r.errors);
    const d = r.diagnostics[0];
    expect(d.line).toBe(1);
    expect(typeof d.column).toBe("number");
    expect(d.message.length).toBeGreaterThan(0);
    expect(d.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/databricks.diagnostics.test.ts`
Expected: FAIL — `r.diagnostics` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

Replace the inline `errors`/`listener`/`attachErrorCounter` machinery in `src/databricks/parse.ts` with the shared collector. The new file body:

```ts
import {
  BailErrorStrategy,
  CharStream,
  CommonTokenStream,
  type Lexer,
  type ParserATNSimulator,
  type ParserRuleContext,
  PredictionMode,
} from "antlr4ng";
import { DatabricksLexer } from "../generated/databricks/DatabricksLexer.js";
import { DatabricksParser } from "../generated/databricks/DatabricksParser.js";
import { makeErrorCollector, type SyntaxDiagnostic } from "../parse-diagnostics.js";

export interface ParseResult {
  /** The CST rooted at `compoundOrSingleStatement` (one statement, or a BEGIN…END
   *  SQL-scripting compound, + EOF). */
  tree: ParserRuleContext;
  /** Count of lexer + parser syntax errors. */
  errors: number;
  /** Positioned syntax diagnostics (message + line/column/offset/length), in report order. */
  diagnostics: SyntaxDiagnostic[];
}

/**
 * Lex + parse one Databricks SQL statement. Two-stage parsing: try the fast SLL
 * prediction mode first (bail on the first conflict), and fall back to full LL only
 * when SLL fails. Valid SQL takes the fast path; the LL fallback guarantees the same
 * result LL alone would produce, so correctness is unchanged — just faster.
 */
export function parseDatabricks(sql: string): ParseResult {
  const lexer = new DatabricksLexer(CharStream.fromString(sql));
  const tokens = new CommonTokenStream(lexer);
  const parser = new DatabricksParser(tokens);
  const sim = parser.interpreter as ParserATNSimulator;

  const collector = makeErrorCollector();
  attachErrorCounter(lexer, parser, collector.listener);

  // Stage 1: SLL, bail on the first error (no recovery, no listener noise).
  const defaultErrorHandler = parser.errorHandler;
  parser.errorHandler = new BailErrorStrategy();
  sim.predictionMode = PredictionMode.SLL;
  try {
    const tree = parser.compoundOrSingleStatement();
    return { tree, errors: collector.diagnostics.length, diagnostics: collector.diagnostics };
  } catch {
    // Stage 2: full LL with the normal error strategy (reports + recovers).
    tokens.seek(0);
    parser.reset();
    parser.errorHandler = defaultErrorHandler;
    sim.predictionMode = PredictionMode.LL;
    collector.reset(); // discount anything the SLL attempt may have reported
    attachErrorCounter(lexer, parser, collector.listener);
    const tree = parser.compoundOrSingleStatement();
    return { tree, errors: collector.diagnostics.length, diagnostics: collector.diagnostics };
  }
}

function attachErrorCounter(lexer: Lexer, parser: DatabricksParser, listener: object): void {
  lexer.removeErrorListeners();
  lexer.addErrorListener(listener as never);
  parser.removeErrorListeners();
  parser.addErrorListener(listener as never);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/databricks.diagnostics.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Confirm no regression in the Databricks suite**

Run: `npx vitest run tests/databricks.test.ts`
Expected: PASS (unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/databricks/parse.ts tests/databricks.diagnostics.test.ts
git commit -m "feat(databricks): parse() surfaces positioned syntax diagnostics (#6)"
```

---

### Task A3: T-SQL parse() returns positioned diagnostics

**Files:**
- Modify: `src/tsql/parse.ts`
- Test: `tests/tsql.diagnostics.test.ts`

**Interfaces:**
- Consumes: `makeErrorCollector`, `SyntaxDiagnostic` from `../parse-diagnostics.js`.
- Produces: `ParseResult` in `src/tsql/parse.ts` gains `diagnostics: SyntaxDiagnostic[]`; entry rule is `parser.tsql_file()`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tsql.diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { parseTSql } from "../src/tsql/parse.js";

describe("parseTSql diagnostics", () => {
  it("returns zero diagnostics for valid SQL", () => {
    const r = parseTSql("SELECT a FROM t");
    expect(r.errors).toBe(0);
    expect(r.diagnostics).toEqual([]);
  });

  it("returns a positioned diagnostic for broken SQL", () => {
    const r = parseTSql("SELECT FROM");
    expect(r.errors).toBeGreaterThan(0);
    expect(r.diagnostics.length).toBe(r.errors);
    expect(r.diagnostics[0].line).toBe(1);
    expect(r.diagnostics[0].length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tsql.diagnostics.test.ts`
Expected: FAIL — `r.diagnostics` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

Mirror Task A2 in `src/tsql/parse.ts`: import the collector, add `diagnostics: SyntaxDiagnostic[]` to `ParseResult`, replace the inline `errors`/`listener` with `const collector = makeErrorCollector();`, call `collector.reset()` where `errors = 0` was, return `{ tree, errors: collector.diagnostics.length, diagnostics: collector.diagnostics }` from both the SLL return and the LL return, using `parser.tsql_file()` as the entry rule. Keep `attachErrorCounter` with the `TSqlParser` type.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tsql.diagnostics.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Confirm no regression**

Run: `npx vitest run tests/tsql.test.ts`
Expected: PASS (unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/tsql/parse.ts tests/tsql.diagnostics.test.ts
git commit -m "feat(tsql): parse() surfaces positioned syntax diagnostics (#6)"
```

---

### Task A4: Snowflake parse() returns positioned diagnostics

**Files:**
- Modify: `src/snowflake/parse.ts`
- Test: `tests/snowflake.diagnostics.test.ts`

**Interfaces:**
- Consumes: `makeErrorCollector`, `SyntaxDiagnostic` from `../parse-diagnostics.js`.
- Produces: `ParseResult` in `src/snowflake/parse.ts` gains `diagnostics: SyntaxDiagnostic[]`; entry rule is `parser.snowflake_file()`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/snowflake.diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { parseSnowflake } from "../src/snowflake/parse.js";

describe("parseSnowflake diagnostics", () => {
  it("returns zero diagnostics for valid SQL", () => {
    const r = parseSnowflake("SELECT a FROM t");
    expect(r.errors).toBe(0);
    expect(r.diagnostics).toEqual([]);
  });

  it("returns a positioned diagnostic for broken SQL", () => {
    const r = parseSnowflake("SELECT FROM");
    expect(r.errors).toBeGreaterThan(0);
    expect(r.diagnostics.length).toBe(r.errors);
    expect(r.diagnostics[0].line).toBe(1);
    expect(r.diagnostics[0].length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/snowflake.diagnostics.test.ts`
Expected: FAIL — `r.diagnostics` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

Mirror Task A2 in `src/snowflake/parse.ts` using `parser.snowflake_file()` as the entry rule and `SnowflakeParser` in `attachErrorCounter`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/snowflake.diagnostics.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Confirm no regression**

Run: `npx vitest run tests/snowflake.test.ts`
Expected: PASS (unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/snowflake/parse.ts tests/snowflake.diagnostics.test.ts
git commit -m "feat(snowflake): parse() surfaces positioned syntax diagnostics (#6)"
```

---

### Task A5: BigQuery parse() returns positioned diagnostics

**Files:**
- Modify: `src/bigquery/parse.ts`
- Test: `tests/bigquery.diagnostics.test.ts`

**Interfaces:**
- Consumes: `makeErrorCollector`, `SyntaxDiagnostic` from `../parse-diagnostics.js`.
- Produces: `ParseResult` in `src/bigquery/parse.ts` gains `diagnostics: SyntaxDiagnostic[]`.

**Note — BigQuery has two extra error sources beyond the listener:** invalid-escape errors (`escapeErrors` from `dotPathTokenSource`) and post-parse structural errors (`countPostParseErrors`). These are COUNTS without spans. Contract for this task: `errors` stays the authoritative total (listener diagnostics + escapeErrors + post-parse), so nothing downstream breaks; `diagnostics` carries the **positioned** (listener-captured) subset. When extras are present, `errors >= diagnostics.length`. This divergence is intentional and is recorded as an Open Gap (escape/post-parse positions) in the plan's Open Gaps note — do NOT fabricate spans for them.

- [ ] **Step 1: Write the failing test**

```ts
// tests/bigquery.diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { parseBigQuery } from "../src/bigquery/parse.js";

describe("parseBigQuery diagnostics", () => {
  it("returns zero diagnostics for valid SQL", () => {
    const r = parseBigQuery("SELECT a FROM t");
    expect(r.errors).toBe(0);
    expect(r.diagnostics).toEqual([]);
  });

  it("returns a positioned diagnostic for broken SQL", () => {
    const r = parseBigQuery("SELECT FROM");
    expect(r.errors).toBeGreaterThan(0);
    expect(r.diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(r.diagnostics[0].line).toBe(1);
    expect(r.diagnostics[0].length).toBeGreaterThanOrEqual(1);
  });

  it("errors count is >= positioned diagnostics (extras: escape/post-parse have no span)", () => {
    const r = parseBigQuery("SELECT FROM");
    expect(r.errors).toBeGreaterThanOrEqual(r.diagnostics.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bigquery.diagnostics.test.ts`
Expected: FAIL — `r.diagnostics` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

Edit `src/bigquery/parse.ts`. Replace the inline `errors`/`listener` with the collector, but keep the `errors` arithmetic that folds in `escapeErrors` and `countPostParseErrors`. Concretely:

```ts
import {
  BailErrorStrategy,
  CharStream,
  CommonTokenStream,
  type ParserATNSimulator,
  type ParserRuleContext,
  PredictionMode,
} from "antlr4ng";
import { GoogleSQLLexer } from "../generated/bigquery/GoogleSQLLexer.js";
import { GoogleSQLParser } from "../generated/bigquery/GoogleSQLParser.js";
import { dotPathTokenSource } from "./dot-path.js";
import { countPostParseErrors } from "./post-validate.js";
import { makeErrorCollector, type SyntaxDiagnostic } from "../parse-diagnostics.js";

export interface ParseResult {
  /** The CST rooted at `root` (`stmts EOF`). */
  tree: ParserRuleContext;
  /** Count of lexer + parser + escape + post-parse syntax errors. */
  errors: number;
  /** Positioned syntax diagnostics (listener-captured subset; escape/post-parse extras are
   *  count-only and not represented here). */
  diagnostics: SyntaxDiagnostic[];
}

export function parseBigQuery(sql: string): ParseResult {
  const collector = makeErrorCollector();

  const lexer = new GoogleSQLLexer(CharStream.fromString(sql));
  lexer.removeErrorListeners();
  lexer.addErrorListener(collector.listener as never);
  const { source, escapeErrors } = dotPathTokenSource(sql, lexer);
  const tokens = new CommonTokenStream(source);
  const lexExtras = escapeErrors; // positionless extras folded into `errors` only

  const parser = new GoogleSQLParser(tokens);
  const sim = parser.interpreter as ParserATNSimulator;
  parser.removeErrorListeners();
  parser.addErrorListener(collector.listener as never);

  const defaultErrorHandler = parser.errorHandler;
  parser.errorHandler = new BailErrorStrategy();
  sim.predictionMode = PredictionMode.SLL;
  try {
    const tree = parser.root();
    const errors = collector.diagnostics.length + lexExtras + countPostParseErrors(tree);
    return { tree, errors, diagnostics: collector.diagnostics };
  } catch {
    tokens.seek(0);
    parser.reset();
    parser.errorHandler = defaultErrorHandler;
    sim.predictionMode = PredictionMode.LL;
    collector.reset(); // discount the SLL attempt's parser diagnostics; lexer ones are already buffered-source stable
    parser.removeErrorListeners();
    parser.addErrorListener(collector.listener as never);
    const tree = parser.root();
    const errors = collector.diagnostics.length + lexExtras + countPostParseErrors(tree);
    return { tree, errors, diagnostics: collector.diagnostics };
  }
}
```

Note on the LL retry: the original code re-zeroed parser errors but preserved `lexErrors`. Here the lexer ran once over the buffered source; on the SLL path the lexer's diagnostics are already in the collector. Because `collector.reset()` clears ALL diagnostics (including the lexer's) before the LL retry but the LL retry re-lexes nothing (buffered source) and does not re-emit lexer errors, capture the lexer diagnostics separately if a regression appears: snapshot `const lexDiags = [...collector.diagnostics]` immediately after `dotPathTokenSource`, and after `collector.reset()` on the retry do `collector.diagnostics.push(...lexDiags)`. Apply this refinement only if Step 5 shows a lexer-error case losing its diagnostic on the LL path; otherwise keep it simple.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bigquery.diagnostics.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Confirm no regression**

Run: `npx vitest run tests/bigquery.test.ts`
Expected: PASS (unchanged). If absent, run `npx vitest run tests/bigquery.pipeline.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/bigquery/parse.ts tests/bigquery.diagnostics.test.ts
git commit -m "feat(bigquery): parse() surfaces positioned syntax diagnostics (#6)"
```

---

### Task A5b: Redshift parse() returns positioned diagnostics

**Files:**
- Modify: `src/redshift/parse.ts`
- Test: `tests/redshift.diagnostics.test.ts`

**Interfaces:**
- Consumes: `makeErrorCollector`, `SyntaxDiagnostic` from `../parse-diagnostics.js`.
- Produces: `ParseResult` in `src/redshift/parse.ts` gains `diagnostics: SyntaxDiagnostic[]`; entry rule is `parser.root()`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/redshift.diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { parseRedshift } from "../src/redshift/parse.js";

describe("parseRedshift diagnostics", () => {
  it("returns zero diagnostics for valid SQL", () => {
    const r = parseRedshift("SELECT a FROM t");
    expect(r.errors).toBe(0);
    expect(r.diagnostics).toEqual([]);
  });

  it("returns a positioned diagnostic for broken SQL", () => {
    const r = parseRedshift("SELECT FROM");
    expect(r.errors).toBeGreaterThan(0);
    expect(r.diagnostics.length).toBe(r.errors);
    expect(r.diagnostics[0].line).toBe(1);
    expect(r.diagnostics[0].length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/redshift.diagnostics.test.ts`
Expected: FAIL — `r.diagnostics` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

Mirror Task A2 in `src/redshift/parse.ts`: import the collector, add `diagnostics: SyntaxDiagnostic[]` to `ParseResult`, replace the inline `errors`/`listener` with the collector, call `collector.reset()` where `errors = 0` was, and return `{ tree, errors: collector.diagnostics.length, diagnostics: collector.diagnostics }` from both returns, using `parser.root()` as the entry rule. Match the existing file's `attachErrorCounter` shape (use the `RedshiftParser` type if it is typed).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/redshift.diagnostics.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Confirm no regression**

Run: `npx vitest run tests/redshift.test.ts`
Expected: PASS (unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/redshift/parse.ts tests/redshift.diagnostics.test.ts
git commit -m "feat(redshift): parse() surfaces positioned syntax diagnostics (#6)"
```

---

### Task A6: Thread diagnostics through the unified `parse()` / api.ts

**Files:**
- Modify: `src/api.ts` (`ParseResultIR` ~L59-66, `parse()` ~L74-79)
- Test: `tests/api.diagnostics.test.ts`

**Interfaces:**
- Consumes: every dialect's `ParseResult.diagnostics` (Tasks A2–A5); `SyntaxDiagnostic` from `./parse-diagnostics.js`.
- Produces: `ParseResultIR` gains `diagnostics: SyntaxDiagnostic[]`; `parse(sql, dialect)` returns it. (This is what `src/lsp/features/diagnostics.ts` consumes.)

- [ ] **Step 1: Write the failing test**

```ts
// tests/api.diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { parse } from "../src/api.js";

describe("parse() positioned diagnostics", () => {
  it("carries an empty diagnostics array for valid SQL", () => {
    const r = parse("SELECT a FROM t", "databricks");
    expect(r.errors).toBe(0);
    expect(r.diagnostics).toEqual([]);
  });

  it("carries positioned diagnostics for broken SQL on every dialect", () => {
    for (const d of ["databricks", "tsql", "snowflake", "bigquery", "redshift"] as const) {
      const r = parse("SELECT FROM", d);
      expect(r.errors, d).toBeGreaterThan(0);
      expect(r.diagnostics.length, d).toBeGreaterThanOrEqual(1);
      expect(r.diagnostics[0].line, d).toBe(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api.diagnostics.test.ts`
Expected: FAIL — `r.diagnostics` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `src/api.ts`:
1. Add the import near the other type imports:
   ```ts
   import type { SyntaxDiagnostic } from "./parse-diagnostics.js";
   ```
2. Change the `DialectFns.parse` signature so the returned diagnostics are typed:
   ```ts
   interface DialectFns {
     parse(sql: string): { tree: ParserRuleContext; errors: number; diagnostics: SyntaxDiagnostic[] };
     lower(tree: ParserRuleContext): QueryExpr;
   }
   ```
3. Add `diagnostics` to `ParseResultIR`:
   ```ts
   export interface ParseResultIR {
     ast: QueryExpr;
     errors: number;
     /** Positioned syntax diagnostics (message + line/column/offset/length). */
     diagnostics: SyntaxDiagnostic[];
     cst: ParserRuleContext;
   }
   ```
4. Return it from `parse()`:
   ```ts
   export function parse(sql: string, dialect: Dialect): ParseResultIR {
     const fns = DIALECTS[dialect];
     const { tree, errors, diagnostics } = fns.parse(sql);
     return { ast: fns.lower(tree), errors, diagnostics, cst: tree };
   }
   ```
   (`analyze()` continues to destructure only `{ ast, errors }` from `parse()`; leave it unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api.diagnostics.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all suites green (corpus gates skip-aware).

- [ ] **Step 6: Commit**

```bash
git add src/api.ts tests/api.diagnostics.test.ts
git commit -m "feat(api): parse() surfaces positioned syntax diagnostics, closes #6"
```

### Task A7: BigQuery escape + post-parse errors become POSITIONED diagnostics

**Files:**
- Modify: `src/bigquery/literal-escapes.ts` (add a positioned variant)
- Modify: `src/bigquery/post-validate.ts` (return positioned diagnostics)
- Modify: `src/bigquery/dot-path.ts` (return `escapeDiagnostics`, not a count)
- Modify: `src/bigquery/parse.ts` (fold both into `diagnostics`; `errors = diagnostics.length`)
- Test: `tests/bigquery.diagnostics.test.ts` (extend)

**Why (Niclas, 2026-06-28):** A bare error *count* is useless to an editor — you can't draw a squiggle. BigQuery's two non-antlr error sources (invalid literal escapes, post-parse structural rules) were count-only; this makes them positioned like every other syntax error, so `errors === diagnostics.length` for BigQuery too. This supersedes the A5 "errors ≥ diagnostics.length is intentional" note.

**Hard invariant — detection unchanged:** Do NOT change WHICH inputs are flagged. The number of diagnostics for any input must equal the old `errors` total (so `bigquery.corpus` + `bigquery.parser-corpus` stay green — same positives accepted, same negatives rejected). You are only attaching positions, never adding/removing a detection.

**Positioning granularity:** literal-granular for escapes (squiggle the whole offending literal token — honest and useful; char-exact offset within the literal is a future refinement, NOT a gap), node-granular for post-parse (the violating CST node's span).

**Interfaces:**
- `src/parse-diagnostics.ts` `SyntaxDiagnostic` is reused (import it).
- `literal-escapes.ts` adds `badLiteralEscapes(tokens: Token[]): SyntaxDiagnostic[]` (keep or remove the old `countBadLiteralEscapes` — nothing else should use it after this; remove it if unused to avoid dead code).
- `post-validate.ts` `countPostParseErrors(tree): number` → `postParseDiagnostics(tree: ParserRuleContext): SyntaxDiagnostic[]`.
- `dot-path.ts` `dotPathTokenSource` returns `{ source, escapeDiagnostics: SyntaxDiagnostic[] }` (was `escapeErrors: number`).

- [ ] **Step 1: Write the failing tests (extend `tests/bigquery.diagnostics.test.ts`)**

```ts
// Replace the old "errors >= diagnostics.length (extras)" test with this stronger contract,
// and add positioned cases for the two non-antlr error sources.
it("every BigQuery syntax error is positioned: errors === diagnostics.length", () => {
  for (const sql of ["SELECT a b c FROM", "SELECT '\\q'", "SELECT a b c FROM t"]) {
    const r = parseBigQuery(sql);
    expect(r.errors, sql).toBe(r.diagnostics.length); // no count-only errors anymore
  }
});

it("an invalid string escape yields a positioned diagnostic on the literal", () => {
  const sql = "SELECT '\\q' AS x";
  const r = parseBigQuery(sql);
  expect(r.diagnostics.length).toBeGreaterThanOrEqual(1);
  const d = r.diagnostics.find((x) => /escape/i.test(x.message));
  expect(d, "an escape diagnostic").toBeDefined();
  expect(d!.line).toBe(1);
  // points at the literal, not column 0 / end-of-input
  expect(d!.column).toBeGreaterThanOrEqual(sql.indexOf("'"));
  expect(d!.length).toBeGreaterThanOrEqual(1);
});
```

(If `'\\q'` happens to be accepted, pick any escape `literalEscapesValid` rejects — e.g. a `\u` with too few hex digits `"SELECT '\\u12'"`; verify against `literal-escapes.ts`. For the post-parse case, reuse an input already known to trip a `post-validate.ts` rule from the BigQuery corpus if `'\\q'` doesn't also exercise post-parse — the `errors === diagnostics.length` loop already covers post-parse indirectly.)

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/bigquery.diagnostics.test.ts`
Expected: the new tests FAIL — escape errors are currently count-only (absent from `diagnostics`), so `errors > diagnostics.length` and no escape diagnostic is found.

- [ ] **Step 3: Implement**

1. **`literal-escapes.ts`** — add `badLiteralEscapes(tokens: Token[]): SyntaxDiagnostic[]`, mirroring `countBadLiteralEscapes`'s detection exactly, but at each point it would have done `bad++`, push:
   ```ts
   out.push({
     message: "invalid escape sequence in literal",
     line: tok.line,
     column: tok.column,
     offset: tok.start,
     length: tok.text?.length ?? 1,
   });
   ```
   Import `type { SyntaxDiagnostic } from "../parse-diagnostics.js"`. Remove `countBadLiteralEscapes` if nothing else references it.

2. **`post-validate.ts`** — change `countPostParseErrors` to `postParseDiagnostics(tree): SyntaxDiagnostic[]`. Add a helper:
   ```ts
   import type { SyntaxDiagnostic } from "../parse-diagnostics.js";
   function diagAt(ctx: ParserRuleContext, message: string): SyntaxDiagnostic {
     const s = ctx.start;
     const e = ctx.stop ?? ctx.start;
     return {
       message,
       line: s?.line ?? 1,
       column: s?.column ?? 0,
       offset: s?.start,
       length: s && e ? e.stop - s.start + 1 : 1,
     };
   }
   ```
   Replace every `errors++` with `out.push(diagAt(<most-specific in-scope node>, "<rule-specific message>"))`, keeping the surrounding detection condition byte-for-byte. Use the node the rule is about (e.g. the `node`, `base`, `suffix`, or the `a`/`b` operand in scope at that site) so the span lands on the offending construct. Return `out`. Do NOT alter any detection condition.

3. **`dot-path.ts`** — `dotPathTokenSource` returns `{ source, escapeDiagnostics: badLiteralEscapes(tokens) }`.

4. **`bigquery/parse.ts`** — replace the count arithmetic. Keep the A5 lexer-diagnostic snapshot/re-push. At each return:
   ```ts
   const tree = parser.root();
   const diagnostics = [...collector.diagnostics, ...escapeDiagnostics, ...postParseDiagnostics(tree)];
   return { tree, errors: diagnostics.length, diagnostics };
   ```
   where `const { source, escapeDiagnostics } = dotPathTokenSource(sql, lexer);` is computed once before parsing (escape diagnostics are token-derived, stable across the SLL→LL retry — like lexer diagnostics).

- [ ] **Step 4: Run to verify GREEN + no detection drift**

Run: `npx vitest run tests/bigquery.diagnostics.test.ts` (new tests pass)
Then the BigQuery corpus gates (the detection-invariant guard): `npx vitest run tests/bigquery.corpus.test.ts tests/bigquery.parser-corpus.test.ts` — must be UNCHANGED (same positives accepted, same negatives rejected). If any corpus number moved, a detection condition changed — revert and redo without touching conditions.
Then `npm run typecheck`.

- [ ] **Step 5: Full suite + commit**

Run: `npm test` (expect still green, 0 skips if corpus present).

```bash
git add src/bigquery/literal-escapes.ts src/bigquery/post-validate.ts src/bigquery/dot-path.ts src/bigquery/parse.ts tests/bigquery.diagnostics.test.ts
git commit -m "feat(bigquery): position escape + post-parse syntax errors (#6)"
```

### Task A8: Semantic diagnostics carry a full positioned span

**Files:**
- Modify: `src/qualify/qualify.ts` (the `Diagnostic` interface + the two builders)
- Modify: `src/index.ts` (the `Diagnostic` type is already re-exported — no change unless the shape export needs it; verify)
- Test: `tests/qualify.diagnostics-span.test.ts` (new)

**Why (Niclas, 2026-06-28):** Position drives everything; a 1-char squiggle on a multi-char identifier is a half-position. `qualify`'s `Diagnostic` carries only `line`/`column` (a point). Both builders (`columnDiag`, `unknownTable`) already hold the offending node's full CST (`ref.cst`, `src.source.cst`) — they just read `.start`. Give the diagnostic a full span (`endLine`/`endColumn`) so the LSP squiggles the whole offending table/column/field. This is a fix, not a gap.

**Interfaces:**
- `Diagnostic` (in `src/qualify/qualify.ts`) gains `endLine: number` and `endColumn: number` (same convention as the symbols `Span`: 1-based line, 0-based column, `endColumn` one past the last char). Existing `line`/`column` keep their meaning (the start). Additive — existing consumers/tests still compile.
- Both `columnDiag(kind, ref, message)` and `unknownTable(name, cst)` compute the end from the node's `stop` token: `endLine = stop.line`, `endColumn = stop.column + (stop.text?.length ?? 0)`; fall back to the start token when `stop` is absent.

- [ ] **Step 1: Write the failing test**

```ts
// tests/qualify.diagnostics-span.test.ts
import { describe, it, expect } from "vitest";
import { analyze } from "../src/api.js";
import { Schema } from "../src/qualify/schema.js";

describe("semantic diagnostics carry a full span", () => {
  it("an unknown column's diagnostic spans the whole identifier, not one char", () => {
    const schema = new Schema({ sales: { amount: "decimal" } });
    const sql = "SELECT unknown_col FROM sales";
    const d = analyze(sql, "databricks", { schema }).diagnostics.find((x) => x.kind === "unknown-column");
    expect(d, "unknown-column diagnostic").toBeDefined();
    expect(d!.line).toBe(1);
    expect(d!.column).toBe(sql.indexOf("unknown_col")); // 0-based start
    // full span: end is past the last char of "unknown_col"
    expect(d!.endLine).toBe(1);
    expect(d!.endColumn).toBe(sql.indexOf("unknown_col") + "unknown_col".length);
  });

  it("an unknown table's diagnostic spans the table name", () => {
    const sql = "SELECT x FROM no_such_table";
    const d = analyze(sql, "databricks", { schema: new Schema({}) }).diagnostics.find(
      (x) => x.kind === "unknown-table",
    );
    expect(d).toBeDefined();
    expect(d!.endColumn).toBeGreaterThan(d!.column); // a real width, not a point
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run tests/qualify.diagnostics-span.test.ts`
Expected: FAIL — `endLine`/`endColumn` are `undefined`.

- [ ] **Step 3: Implement**

In `src/qualify/qualify.ts`:
1. Extend the interface:
   ```ts
   export interface Diagnostic {
     kind: "unknown-table" | "unknown-column" | "ambiguous-column" | "unknown-field";
     message: string;
     line: number;
     column: number;
     endLine: number;
     endColumn: number;
   }
   ```
2. Add a span helper and use it in both builders:
   ```ts
   function spanOf(cst: ParserRuleContext): { line: number; column: number; endLine: number; endColumn: number } {
     const s = cst.start;
     const e = cst.stop ?? cst.start;
     return {
       line: s?.line ?? 0,
       column: s?.column ?? 0,
       endLine: e?.line ?? s?.line ?? 0,
       endColumn: (e?.column ?? 0) + (e?.text?.length ?? 0),
     };
   }
   ```
   `columnDiag`: `return { kind, message, ...spanOf(ref.cst) };`
   `unknownTable`: `return { kind: "unknown-table", message: …, ...spanOf(cst) };`

(This mirrors `spanOf` in `src/symbols/symbols.ts` exactly — same convention, so `ranges.rangeFromSpan` works on it unchanged.)

- [ ] **Step 4: Run to verify GREEN + no regression**

Run: `npx vitest run tests/qualify.diagnostics-span.test.ts` (pass)
Then any existing qualify/diagnostics tests: `npx vitest run tests/qualify.test.ts` (if present) — additive fields, must still pass.
Then `npm run typecheck`.

- [ ] **Step 5: Full suite + commit**

Run: `npm test`.

```bash
git add src/qualify/qualify.ts tests/qualify.diagnostics-span.test.ts
git commit -m "feat(qualify): semantic diagnostics carry a full positioned span (#6)"
```

> **Note for Task C2 (diagnostics feature):** with A8, the semantic `Diagnostic` carries a full span, so C2 must build its LSP range with `rangeFromSpan({ line: d.line, column: d.column, endLine: d.endLine, endColumn: d.endColumn })` — NOT the old 1-char `endColumn: column + 1` hack. Every diagnostic the server emits is a real range.

> **▶ CHECKPOINT (harness):** Phase A complete — every syntax AND semantic diagnostic across all five dialects is positioned with a full span (nothing count-only, nothing point-only). Stop, present the diff, and wait for Niclas's sign-off before Phase B.

---

## Phase B — LSP plumbing

Three independent units. Parallelizable.

### Task B1: ranges.ts — the single span adapter (and LSP deps)

**Files:**
- Modify: `package.json` (add dependencies)
- Create: `src/lsp/ranges.ts`
- Test: `tests/lsp.ranges.test.ts`

**Interfaces:**
- Consumes: `ParserRuleContext`, `Token` from `antlr4ng`; `Range`, `Position` from `vscode-languageserver-types` (re-exported by `vscode-languageserver`); `Span` from `../../symbols/symbols.js`; `SyntaxDiagnostic` from `../../parse-diagnostics.js`.
- Produces:
  - `function rangeFromCst(cst: ParserRuleContext): Range`
  - `function rangeFromSpan(span: Span): Range`
  - `function rangeFromSyntaxDiagnostic(d: SyntaxDiagnostic): Range`
  - `function positionToOffset(text: string, position: Position): number` (LSP Position → 0-based char offset, for hover/definition cursor mapping)

- [ ] **Step 1: Add dependencies**

```bash
npm install vscode-languageserver vscode-languageserver-types vscode-languageserver-textdocument vscode-languageserver-protocol minimatch
```
Expected: `package.json` `dependencies` gains all five. (`vscode-languageserver-types` is the types-only package the feature units import — added explicitly rather than relied on transitively. The protocol package is also the in-memory test client.)

> **Import-path rule for LSP packages:** these are package (bare-specifier) imports — do NOT append `.js` (the `.js` convention in this repo is for RELATIVE imports only). Use `vscode-languageserver-types`, `vscode-languageserver/node`, `vscode-languageserver-protocol/node` (subpaths resolved via each package's `exports` map under `moduleResolution: Bundler`). If a subpath fails to resolve, check the installed package's `exports` field rather than adding `.js`.

- [ ] **Step 2: Write the failing test**

```ts
// tests/lsp.ranges.test.ts
import { describe, it, expect } from "vitest";
import { rangeFromSpan, rangeFromSyntaxDiagnostic, positionToOffset } from "../src/lsp/ranges.js";

describe("ranges", () => {
  it("rangeFromSpan converts 1-based antlr line to 0-based LSP line, keeps 0-based column", () => {
    // Span: line/column are 1-based line, 0-based column; endColumn already past the last char.
    const r = rangeFromSpan({ line: 1, column: 7, endLine: 1, endColumn: 11 });
    expect(r.start).toEqual({ line: 0, character: 7 });
    expect(r.end).toEqual({ line: 0, character: 11 });
  });

  it("rangeFromSyntaxDiagnostic spans `length` chars from the column on a 0-based line", () => {
    const r = rangeFromSyntaxDiagnostic({ message: "x", line: 2, column: 3, offset: 20, length: 5 });
    expect(r.start).toEqual({ line: 1, character: 3 });
    expect(r.end).toEqual({ line: 1, character: 8 });
  });

  it("positionToOffset maps an LSP position to a 0-based char offset", () => {
    const text = "SELECT a\nFROM t";
    expect(positionToOffset(text, { line: 0, character: 7 })).toBe(7); // the 'a'
    expect(positionToOffset(text, { line: 1, character: 0 })).toBe(9); // start of 'FROM'
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/lsp.ranges.test.ts`
Expected: FAIL — `Cannot find module '../src/lsp/ranges.js'`.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/lsp/ranges.ts
import type { ParserRuleContext, Token } from "antlr4ng";
import type { Position, Range } from "vscode-languageserver-types";
import type { Span } from "../symbols/symbols.js";
import type { SyntaxDiagnostic } from "../parse-diagnostics.js";

// ---------------------------------------------------------------------------
// The ONE place that converts library positions to LSP positions. The library
// (antlr tokens, qualify Diagnostic, symbols Span) is 1-based line / 0-based
// column; LSP Position is 0-based line / 0-based character. Every feature routes
// position math through here so the off-by-one rule lives in exactly one file.
// ---------------------------------------------------------------------------

/** A token's start position as an LSP Position (1-based line → 0-based). */
function positionFromStartToken(t: Token): Position {
  return { line: Math.max(0, t.line - 1), character: t.column };
}

/** A token's end position (exclusive) as an LSP Position: column past the last char. */
function positionFromStopToken(t: Token): Position {
  return { line: Math.max(0, t.line - 1), character: t.column + (t.text?.length ?? 0) };
}

/** CST node → LSP Range, from its first token's start to its last token's end. */
export function rangeFromCst(cst: ParserRuleContext): Range {
  const start = cst.start;
  const stop = cst.stop ?? cst.start;
  if (!start) return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
  return { start: positionFromStartToken(start), end: positionFromStopToken(stop ?? start) };
}

/** A symbols `Span` (1-based line, 0-based column, endColumn already past the last char) → Range. */
export function rangeFromSpan(span: Span): Range {
  return {
    start: { line: Math.max(0, span.line - 1), character: span.column },
    end: { line: Math.max(0, span.endLine - 1), character: span.endColumn },
  };
}

/** A parse `SyntaxDiagnostic` (1-based line, 0-based column, length chars) → Range. */
export function rangeFromSyntaxDiagnostic(d: SyntaxDiagnostic): Range {
  const line = Math.max(0, d.line - 1);
  return {
    start: { line, character: d.column },
    end: { line, character: d.column + Math.max(1, d.length) },
  };
}

/** LSP Position → 0-based char offset into `text` (for mapping a cursor to a node). */
export function positionToOffset(text: string, position: Position): number {
  let line = 0;
  let offset = 0;
  while (line < position.line && offset < text.length) {
    const nl = text.indexOf("\n", offset);
    if (nl === -1) break;
    offset = nl + 1;
    line++;
  }
  return offset + position.character;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/lsp.ranges.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lsp/ranges.ts tests/lsp.ranges.test.ts
git commit -m "feat(lsp): ranges.ts — the single antlr→LSP span adapter; add LSP deps (#9)"
```

---

### Task B2: node-at.ts — offset → smallest covering IR expression + scope

**Files:**
- Create: `src/lsp/node-at.ts`
- Test: `tests/lsp.node-at.test.ts`

**Interfaces:**
- Consumes: `Expr`, `QueryExpr` from `../ir/ir.js`; `Scope`, `ScopeTree` from `../scope/scope.js`; `ParserRuleContext` from `antlr4ng`.
- Produces:
  - `interface NodeHit { expr: Expr; scope: Scope; }`
  - `function nodeAt(tree: ScopeTree, offset: number): NodeHit | undefined` — the smallest `Expr` whose CST char-range covers `offset`, paired with the `Scope` that owns it (the query block the expression lives in, NOT a nested subquery). Backs hover. `undefined` when no expression covers the offset.

**Design note:** Walk the scope tree. For each scope, collect the `Expr` nodes belonging to that scope's body — projections' `expr`, `where`, `joinConditions`, `groupBy`, `having`, `qualify`, `orderBy`, and pipe-stage payload exprs — recursing INTO each expr tree (binary/unary/function args/case/predicate/cast/subscript/lambda) but NOT into `subquery`/`exists` (those open child scopes, already visited by the scope walk). Among all collected `(expr, scope)` whose CST covers the offset, return the one with the smallest char span.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lsp.node-at.test.ts
import { describe, it, expect } from "vitest";
import { parse } from "../src/api.js";
import { resolveScopes } from "../src/scope/scope.js";
import { nodeAt } from "../src/lsp/node-at.js";

function scopesFor(sql: string) {
  return resolveScopes(parse(sql, "databricks").ast, "databricks");
}

describe("nodeAt", () => {
  it("finds the column expression under the cursor", () => {
    const sql = "SELECT amount + 1 FROM sales";
    const tree = scopesFor(sql);
    const hit = nodeAt(tree, sql.indexOf("amount")); // offset of 'amount'
    expect(hit).toBeDefined();
    expect(hit!.expr.kind).toBe("column");
    expect((hit!.expr as any).parts).toEqual(["amount"]);
  });

  it("prefers the smallest covering expr (column over the enclosing binary)", () => {
    const sql = "SELECT amount + 1 FROM sales";
    const tree = scopesFor(sql);
    const onAmount = nodeAt(tree, sql.indexOf("amount"))!;
    expect(onAmount.expr.kind).toBe("column"); // not "binary"
  });

  it("returns the function expr when the cursor is on the function name", () => {
    const sql = "SELECT sum(amount) FROM sales";
    const tree = scopesFor(sql);
    const hit = nodeAt(tree, sql.indexOf("sum"))!;
    expect(hit.expr.kind).toBe("function");
  });

  it("returns undefined when the offset is outside every expression", () => {
    const sql = "SELECT a FROM t";
    const tree = scopesFor(sql);
    expect(nodeAt(tree, sql.indexOf("FROM"))).toBeUndefined();
  });

  it("resolves a column inside a subquery to the subquery's scope", () => {
    const sql = "SELECT x FROM (SELECT b AS x FROM t) s";
    const tree = scopesFor(sql);
    const hit = nodeAt(tree, sql.indexOf("b AS"))!;
    expect(hit.expr.kind).toBe("column");
    // owning scope is the subquery, not the root
    expect(hit.scope).not.toBe(tree.root);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lsp.node-at.test.ts`
Expected: FAIL — `Cannot find module '../src/lsp/node-at.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lsp/node-at.ts
import type { ParserRuleContext } from "antlr4ng";
import type { Expr, PipeStage, Projection, SelectExpr } from "../ir/ir.js";
import type { Scope, ScopeTree } from "../scope/scope.js";

// ---------------------------------------------------------------------------
// node-at: the one genuinely new capability the LSP needs. Given a 0-based char
// offset, find the smallest IR Expr whose CST char-range covers it, paired with
// the Scope that owns it. Backs hover (offset → expr → inferType). Walks the
// scope tree so the returned Scope is the exact query block the expr lives in
// (needed because inferType resolves columns relative to a scope). Subquery /
// EXISTS exprs are NOT descended here — they open child scopes the walk visits.
// ---------------------------------------------------------------------------

export interface NodeHit {
  expr: Expr;
  scope: Scope;
}

/** 0-based inclusive char range of a CST node, or undefined if it has no tokens. */
function cstRange(cst: ParserRuleContext): { from: number; to: number } | undefined {
  const start = cst.start;
  const stop = cst.stop ?? cst.start;
  if (!start || !stop) return undefined;
  return { from: start.start, to: stop.stop };
}

function covers(cst: ParserRuleContext, offset: number): boolean {
  const r = cstRange(cst);
  return r !== undefined && r.from <= offset && offset <= r.to;
}

function span(cst: ParserRuleContext): number {
  const r = cstRange(cst);
  return r ? r.to - r.from : Number.MAX_SAFE_INTEGER;
}

export function nodeAt(tree: ScopeTree, offset: number): NodeHit | undefined {
  let best: NodeHit | undefined;
  const consider = (expr: Expr, scope: Scope): void => {
    if (!covers(expr.cst, offset)) return;
    if (!best || span(expr.cst) < span(best.expr.cst)) best = { expr, scope };
  };
  const walkExpr = (expr: Expr, scope: Scope): void => {
    consider(expr, scope);
    for (const child of childExprs(expr)) walkExpr(child, scope);
  };
  const walkScope = (scope: Scope): void => {
    for (const expr of scopeExprs(scope)) walkExpr(expr, scope);
    for (const child of scope.children) walkScope(child);
  };
  walkScope(tree.root);
  return best;
}

/** Sub-expressions reachable WITHOUT crossing a scope boundary (no subquery/exists descent). */
function childExprs(expr: Expr): Expr[] {
  switch (expr.kind) {
    case "binary":
      return [expr.left, expr.right];
    case "unary":
      return [expr.operand];
    case "function":
      return expr.args;
    case "case":
      return [...expr.whens.flatMap((w) => [w.when, w.then]), ...(expr.elseExpr ? [expr.elseExpr] : [])];
    case "cast":
      return [expr.expr];
    case "predicate":
      return [expr.operand, ...expr.args];
    case "lambda":
      return [expr.body];
    case "subscript":
      return [expr.base, expr.index];
    case "star":
      return expr.replace?.map((r) => r.expr) ?? [];
    default:
      // column / literal / subquery / exists / other — leaves for node-at purposes
      return [];
  }
}

/** The Exprs that belong directly to a scope's body (not its child scopes). */
function scopeExprs(scope: Scope): Expr[] {
  const body = scope.body;
  if (body.kind === "select") return selectExprs(body);
  if (body.kind === "pipe") return scope.pipeStage ? stageExprs(scope.pipeStage) : [];
  return []; // setop: exprs live in its branch scopes (children)
}

function selectExprs(body: SelectExpr): Expr[] {
  const out: Expr[] = [];
  for (const p of body.projections) out.push(p.expr);
  if (body.where) out.push(body.where);
  for (const j of body.joinConditions ?? []) out.push(j);
  for (const g of body.groupBy ?? []) out.push(g);
  if (body.having) out.push(body.having);
  if (body.qualify) out.push(body.qualify);
  return out;
}

function stageExprs(stage: PipeStage): Expr[] {
  const out: Expr[] = [];
  const projOf = (ps: Projection[]): void => {
    for (const p of ps) out.push(p.expr);
  };
  if (stage.op === "where") out.push(stage.predicate);
  if (stage.op === "select" || stage.op === "extend" || stage.op === "window") projOf(stage.projections);
  if (stage.op === "aggregate") {
    projOf(stage.aggregates);
    for (const g of stage.groupBy) out.push(g);
  }
  if (stage.op === "orderBy") for (const k of stage.keys) out.push(k);
  if (stage.op === "set") for (const a of stage.assignments) out.push(a.expr);
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lsp.node-at.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lsp/node-at.ts tests/lsp.node-at.test.ts
git commit -m "feat(lsp): node-at — offset to smallest covering IR expr + scope (#9)"
```

---

### Task B3: dialect-config.ts — `.sqllens.json` glob→dialect + schema

**Files:**
- Create: `src/lsp/dialect-config.ts`
- Test: `tests/lsp.dialect-config.test.ts`

**Interfaces:**
- Consumes: `minimatch` from `minimatch`; `Dialect` from `../api.js`; `Schema` from `../qualify/schema.js`; `SchemaMapping` from `../qualify/schema.js`; node `fs`/`path`.
- Produces:
  - `interface DialectConfig { dialectFor(relPath: string): Dialect; schema?: Schema; warnings: string[]; }`
  - `function loadDialectConfig(rootDir: string): DialectConfig` — reads `<rootDir>/.sqllens.json`. Ordered `dialects` rules, first glob match (against the workspace-relative POSIX path) wins, else `default` (else `"databricks"`). Optional `schema` key → a JSON file (a `SchemaMapping`) loaded into a `Schema`. A missing/malformed config returns a config with the `"databricks"` default and a `warnings` entry — never throws.

**`.sqllens.json` shape** (matches the design spec):
```json
{
  "dialects": [
    { "files": "snowflake/**/*.sql", "dialect": "snowflake" },
    { "files": "**/*.tsql.sql", "dialect": "tsql" },
    { "files": "**/*.sql", "dialect": "databricks" }
  ],
  "default": "databricks",
  "schema": "schema.json"
}
```

- [ ] **Step 1: Write the failing test**

```ts
// tests/lsp.dialect-config.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDialectConfig } from "../src/lsp/dialect-config.js";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "sqllens-cfg-"));
  writeFileSync(
    join(dir, ".sqllens.json"),
    JSON.stringify({
      dialects: [
        { files: "snowflake/**/*.sql", dialect: "snowflake" },
        { files: "**/*.tsql.sql", dialect: "tsql" },
        { files: "**/*.sql", dialect: "databricks" },
      ],
      default: "databricks",
      schema: "schema.json",
    }),
  );
  writeFileSync(join(dir, "schema.json"), JSON.stringify({ sales: { amount: "decimal", id: "int" } }));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("loadDialectConfig", () => {
  it("first matching glob wins (ordered rules)", () => {
    const c = loadDialectConfig(dir);
    expect(c.dialectFor("snowflake/a.sql")).toBe("snowflake");
    expect(c.dialectFor("models/x.tsql.sql")).toBe("tsql");
    expect(c.dialectFor("models/x.sql")).toBe("databricks");
  });

  it("falls back to default when no rule matches", () => {
    const c = loadDialectConfig(dir);
    expect(c.dialectFor("notes.txt")).toBe("databricks");
  });

  it("loads the schema so a known table resolves", () => {
    const c = loadDialectConfig(dir);
    expect(c.schema).toBeDefined();
    expect(c.schema!.columnsFor(["sales"])?.map((col) => col.name)).toEqual(["amount", "id"]);
  });

  it("missing config: default databricks + a warning, never throws", () => {
    const empty = mkdtempSync(join(tmpdir(), "sqllens-empty-"));
    const c = loadDialectConfig(empty);
    expect(c.dialectFor("x.sql")).toBe("databricks");
    expect(c.warnings.length).toBeGreaterThan(0);
    rmSync(empty, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lsp.dialect-config.test.ts`
Expected: FAIL — `Cannot find module '../src/lsp/dialect-config.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lsp/dialect-config.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { minimatch } from "minimatch";
import type { Dialect } from "../api.js";
import { Schema, type SchemaMapping } from "../qualify/schema.js";

// ---------------------------------------------------------------------------
// Dialect resolution: a document's dialect is configured, never guessed. Reads
// <root>/.sqllens.json — ordered glob rules, first match wins, else `default`.
// An optional `schema` key points at a JSON catalog (a SchemaMapping) used by the
// semantic-diagnostics and hover tiers. A missing/malformed config falls back to
// the "databricks" default and records a warning (surfaced over window/logMessage
// by the server) — loading never throws.
// ---------------------------------------------------------------------------

const KNOWN_DIALECTS: ReadonlySet<string> = new Set(["databricks", "tsql", "snowflake", "bigquery", "redshift"]);

interface Rule {
  files: string;
  dialect: Dialect;
}

export interface DialectConfig {
  /** The dialect for a workspace-relative path (POSIX-style), first matching rule then default. */
  dialectFor(relPath: string): Dialect;
  /** The catalog from the `schema` key, if present and valid. */
  schema?: Schema;
  /** Non-fatal problems (missing/malformed config, unknown dialect, bad schema) for logMessage. */
  warnings: string[];
}

export function loadDialectConfig(rootDir: string): DialectConfig {
  const warnings: string[] = [];
  let rules: Rule[] = [];
  let fallback: Dialect = "databricks";
  let schema: Schema | undefined;

  let raw: string | undefined;
  try {
    raw = readFileSync(join(rootDir, ".sqllens.json"), "utf8");
  } catch {
    warnings.push("No .sqllens.json found; defaulting all files to the databricks dialect.");
  }

  if (raw !== undefined) {
    try {
      const parsed = JSON.parse(raw) as {
        dialects?: { files: string; dialect: string }[];
        default?: string;
        schema?: string;
      };
      for (const r of parsed.dialects ?? []) {
        if (!KNOWN_DIALECTS.has(r.dialect)) {
          warnings.push(`Unknown dialect "${r.dialect}" in .sqllens.json rule for "${r.files}"; rule ignored.`);
          continue;
        }
        rules.push({ files: r.files, dialect: r.dialect as Dialect });
      }
      if (parsed.default !== undefined) {
        if (KNOWN_DIALECTS.has(parsed.default)) fallback = parsed.default as Dialect;
        else warnings.push(`Unknown default dialect "${parsed.default}" in .sqllens.json; using databricks.`);
      }
      if (parsed.schema !== undefined) {
        try {
          const mapping = JSON.parse(readFileSync(join(rootDir, parsed.schema), "utf8")) as SchemaMapping;
          schema = new Schema(mapping);
        } catch {
          warnings.push(`Could not read schema file "${parsed.schema}" referenced by .sqllens.json.`);
        }
      }
    } catch {
      warnings.push(".sqllens.json is not valid JSON; defaulting all files to the databricks dialect.");
    }
  }

  const dialectFor = (relPath: string): Dialect => {
    const posix = relPath.replace(/\\/g, "/");
    for (const rule of rules) if (minimatch(posix, rule.files)) return rule.dialect;
    return fallback;
  };

  return { dialectFor, schema, warnings };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lsp.dialect-config.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lsp/dialect-config.ts tests/lsp.dialect-config.test.ts
git commit -m "feat(lsp): dialect-config — .sqllens.json glob→dialect + schema (#9)"
```

---

## Phase C — features

`formatType` (C1) first; the four features (C2–C5) are independent and parallelizable.

### Task C1: formatType — render a `Type` to a display string

**Files:**
- Modify: `src/infer/types.ts`
- Test: `tests/infer.format-type.test.ts`

**Rationale:** Hover renders an inferred `Type` (a tagged union) as text. The renderer is a pure, reusable library helper — it belongs in `src/infer/types.ts` next to `Type`, NOT in the LSP layer, so the adapter calls a library function rather than walking the union itself (thin-adapter rule).

**Interfaces:**
- Consumes: `Type` (already in `src/infer/types.ts`).
- Produces: `function formatType(t: Type): string` — `scalar`→name, `array<…>`, `map<…,…>`, `struct<f:…,…>`, `unknown`→`"unknown"`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/infer.format-type.test.ts
import { describe, it, expect } from "vitest";
import { formatType } from "../src/infer/types.js";

describe("formatType", () => {
  it("renders scalars, arrays, maps, structs, and unknown", () => {
    expect(formatType({ kind: "scalar", name: "decimal" })).toBe("decimal");
    expect(formatType({ kind: "array", element: { kind: "scalar", name: "string" } })).toBe("array<string>");
    expect(
      formatType({ kind: "map", key: { kind: "scalar", name: "string" }, value: { kind: "scalar", name: "int" } }),
    ).toBe("map<string,int>");
    expect(
      formatType({
        kind: "struct",
        fields: [
          { name: "city", type: { kind: "scalar", name: "string" } },
          { name: "zip", type: { kind: "scalar", name: "int" } },
        ],
      }),
    ).toBe("struct<city:string,zip:int>");
    expect(formatType({ kind: "unknown" })).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/infer.format-type.test.ts`
Expected: FAIL — `formatType` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/infer/types.ts`:

```ts
/** Render a Type as a display string (scalar name, array<…>, map<…,…>, struct<f:…>, unknown).
 *  Pure formatting — used by the LSP hover feature so the adapter never walks the Type union. */
export function formatType(t: Type): string {
  switch (t.kind) {
    case "scalar":
      return t.name;
    case "array":
      return `array<${formatType(t.element)}>`;
    case "map":
      return `map<${formatType(t.key)},${formatType(t.value)}>`;
    case "struct":
      return `struct<${t.fields.map((f) => `${f.name}:${formatType(f.type)}`).join(",")}>`;
    case "unknown":
      return "unknown";
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/infer.format-type.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infer/types.ts tests/infer.format-type.test.ts
git commit -m "feat(infer): formatType — render a Type to a display string (#9)"
```

---

### Task C2: features/diagnostics.ts — syntax + semantic diagnostics

**Files:**
- Create: `src/lsp/features/diagnostics.ts`
- Test: `tests/lsp.feature-diagnostics.test.ts`

**Interfaces:**
- Consumes: `parse`, `analyze`, `Dialect` from `../../api.js`; `Schema` from `../../qualify/schema.js`; `rangeFromSyntaxDiagnostic`, `rangeFromSpan` from `../ranges.js`; `Diagnostic as LspDiagnostic`, `DiagnosticSeverity` from `vscode-languageserver-types`.
- Produces: `function computeDiagnostics(text: string, dialect: Dialect, schema?: Schema): LspDiagnostic[]` — syntax diagnostics (from `parse().diagnostics`, severity Error) merged with semantic diagnostics (from `analyze().diagnostics`, severity Error/Warning). The semantic `Diagnostic` carries a FULL span (`line`/`column`/`endLine`/`endColumn`, via Task A8); the LSP range is built with `rangeFromSpan(d)` directly — it squiggles the whole identifier.

**Note on semantic diagnostic ranges:** after Task A8, `qualify`'s `Diagnostic` carries a full span (`line`/`column`/`endLine`/`endColumn`, same convention as the symbols `Span`). Build the LSP range with `rangeFromSpan(d)` directly — it squiggles the whole offending identifier. (No 1-char hack.)

- [ ] **Step 1: Write the failing test**

```ts
// tests/lsp.feature-diagnostics.test.ts
import { describe, it, expect } from "vitest";
import { Schema } from "../src/qualify/schema.js";
import { computeDiagnostics } from "../src/lsp/features/diagnostics.js";

describe("computeDiagnostics", () => {
  it("reports a positioned syntax diagnostic for broken SQL", () => {
    const ds = computeDiagnostics("SELECT FROM", "databricks");
    expect(ds.length).toBeGreaterThanOrEqual(1);
    expect(ds[0].range.start.line).toBe(0); // 0-based LSP line
    expect(ds[0].message.length).toBeGreaterThan(0);
  });

  it("reports an unknown-column semantic diagnostic when a schema is fed", () => {
    const schema = new Schema({ sales: { amount: "decimal" } });
    const ds = computeDiagnostics("SELECT nope FROM sales", "databricks", schema);
    expect(ds.some((d) => /nope/i.test(d.message) || /unknown/i.test(d.message))).toBe(true);
  });

  it("is quiet for valid SQL with a matching schema", () => {
    const schema = new Schema({ sales: { amount: "decimal" } });
    expect(computeDiagnostics("SELECT amount FROM sales", "databricks", schema)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lsp.feature-diagnostics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lsp/features/diagnostics.ts
import { type Diagnostic as LspDiagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { parse, analyze, type Dialect } from "../../api.js";
import type { Schema } from "../../qualify/schema.js";
import { rangeFromSpan, rangeFromSyntaxDiagnostic } from "../ranges.js";

// ---------------------------------------------------------------------------
// Diagnostics: syntax errors (from parse().diagnostics — issue #6) plus, when a
// schema is configured, semantic errors (from analyze().diagnostics — unknown
// table/column/field, ambiguous column). Pure translation: the positions come
// from the library; this only maps them to LSP ranges and severities.
// ---------------------------------------------------------------------------

export function computeDiagnostics(text: string, dialect: Dialect, schema?: Schema): LspDiagnostic[] {
  const out: LspDiagnostic[] = [];

  for (const d of parse(text, dialect).diagnostics) {
    out.push({
      range: rangeFromSyntaxDiagnostic(d),
      severity: DiagnosticSeverity.Error,
      source: "sqllens",
      message: d.message,
    });
  }

  if (schema) {
    for (const d of analyze(text, dialect, { schema }).diagnostics) {
      out.push({
        range: rangeFromSpan(d), // full span from qualify (Task A8) — squiggles the whole identifier
        severity: d.kind === "ambiguous-column" ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
        source: "sqllens",
        message: d.message,
      });
    }
  }

  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lsp.feature-diagnostics.test.ts`
Expected: PASS (3 tests). (If the unknown-column message text differs, assert on `analyze(...).diagnostics[0].kind === "unknown-column"` shape instead — verify the message wording against `src/qualify/qualify.ts` first.)

- [ ] **Step 5: Commit**

```bash
git add src/lsp/features/diagnostics.ts tests/lsp.feature-diagnostics.test.ts
git commit -m "feat(lsp): diagnostics feature — syntax + semantic (#9)"
```

---

### Task C3: features/hover.ts — inferred type on hover

**Files:**
- Create: `src/lsp/features/hover.ts`
- Test: `tests/lsp.feature-hover.test.ts`

**Interfaces:**
- Consumes: `toAst`, `Dialect`, `TypeInfo` from `../../api.js`; `resolveScopes` from `../../scope/scope.js`; `Schema` from `../../qualify/schema.js`; `inferType` is reached via `TypeInfo.typeOf`; `formatType` from `../../infer/types.js`; `nodeAt` from `../node-at.js`; `positionToOffset`, `rangeFromCst` from `../ranges.js`; `Hover`, `Position` from `vscode-languageserver-types`.
- Produces: `function computeHover(text: string, dialect: Dialect, position: Position, schema?: Schema): Hover | null` — offset → `nodeAt` → `TypeInfo.typeOf(expr, scope)` → `formatType` → `Hover` (markdown code span) ranged at the expr's CST. Returns `null` when nothing is under the cursor or the type is `unknown`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lsp.feature-hover.test.ts
import { describe, it, expect } from "vitest";
import { Schema } from "../src/qualify/schema.js";
import { computeHover } from "../src/lsp/features/hover.js";

describe("computeHover", () => {
  it("shows the inferred type of a column with a schema", () => {
    const sql = "SELECT amount FROM sales";
    const schema = new Schema({ sales: { amount: "decimal" } });
    const h = computeHover(sql, "databricks", { line: 0, character: sql.indexOf("amount") }, schema);
    expect(h).not.toBeNull();
    const value = typeof h!.contents === "object" && "value" in h!.contents ? (h!.contents as any).value : String(h!.contents);
    expect(value).toMatch(/decimal/);
  });

  it("returns null when there is no expression under the cursor", () => {
    const sql = "SELECT amount FROM sales";
    expect(computeHover(sql, "databricks", { line: 0, character: sql.indexOf("FROM") })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lsp.feature-hover.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lsp/features/hover.ts
import type { Hover, Position } from "vscode-languageserver-types";
import { toAst, TypeInfo, type Dialect } from "../../api.js";
import { resolveScopes } from "../../scope/scope.js";
import { Schema } from "../../qualify/schema.js";
import { formatType } from "../../infer/types.js";
import { nodeAt } from "../node-at.js";
import { positionToOffset, rangeFromCst } from "../ranges.js";

// ---------------------------------------------------------------------------
// Hover: the inferred type of the expression under the cursor. Pure translation
// over the library — node-at finds the expr + its scope, TypeInfo.typeOf infers
// the type (the library's inference, not ours), formatType renders it.
// ---------------------------------------------------------------------------

export function computeHover(text: string, dialect: Dialect, position: Position, schema?: Schema): Hover | null {
  const ast = toAst(text, dialect);
  const tree = resolveScopes(ast, dialect);
  // Pass `ast` so node-at can also reach query-level ORDER BY / LIMIT exprs (Task B2 fix) —
  // those live on QueryExpr, outside any Scope.body, so hover would miss them without it.
  const hit = nodeAt(tree, positionToOffset(text, position), ast);
  if (!hit) return null;

  const types = new TypeInfo(schema ?? new Schema({}));
  const type = types.typeOf(hit.expr, hit.scope);
  if (type.kind === "unknown") return null;

  return {
    contents: { kind: "markdown", value: "```\n" + formatType(type) + "\n```" },
    range: rangeFromCst(hit.expr.cst),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lsp.feature-hover.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lsp/features/hover.ts tests/lsp.feature-hover.test.ts
git commit -m "feat(lsp): hover feature — inferred type under the cursor (#9)"
```

---

### Task C4: features/symbols.ts — document symbols

**Files:**
- Create: `src/lsp/features/symbols.ts`
- Test: `tests/lsp.feature-symbols.test.ts`

**Interfaces:**
- Consumes: `deriveSymbols`, `Dialect` from `../../api.js`; `Sym`, `SymbolKind as SqlSymbolKind` from `../../symbols/symbols.js`; `rangeFromSpan` from `../ranges.js`; `DocumentSymbol`, `SymbolKind` from `vscode-languageserver-types`.
- Produces: `function computeDocumentSymbols(text: string, dialect: Dialect): DocumentSymbol[]` — `deriveSymbols` → map each declaration/output `Sym` to a `DocumentSymbol` (name, LSP `SymbolKind`, range from `Sym.span`). Emit relation declarations (table/cte/subquery) and output columns; skip bare references to keep the outline readable.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lsp.feature-symbols.test.ts
import { describe, it, expect } from "vitest";
import { computeDocumentSymbols } from "../src/lsp/features/symbols.js";

describe("computeDocumentSymbols", () => {
  it("lists a CTE declaration as a document symbol", () => {
    const sql = "WITH recent AS (SELECT id FROM sales) SELECT id FROM recent";
    const syms = computeDocumentSymbols(sql, "databricks");
    expect(syms.some((s) => s.name === "recent")).toBe(true);
  });

  it("returns an array (possibly empty) and never throws on valid SQL", () => {
    expect(Array.isArray(computeDocumentSymbols("SELECT 1", "databricks"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lsp.feature-symbols.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lsp/features/symbols.ts
import { type DocumentSymbol, SymbolKind } from "vscode-languageserver-types";
import { deriveSymbols, type Dialect } from "../../api.js";
import type { Sym, SymbolKind as SqlSymbolKind } from "../../symbols/symbols.js";
import { rangeFromSpan } from "../ranges.js";

// ---------------------------------------------------------------------------
// Document symbols: the outline. Pure translation of the library's symbol model
// (deriveSymbols) — declarations (tables/CTEs/subqueries) and output columns
// become DocumentSymbols. Bare references are omitted to keep the outline clean.
// ---------------------------------------------------------------------------

const KIND: Record<SqlSymbolKind, SymbolKind> = {
  table: SymbolKind.Class,
  cte: SymbolKind.Namespace,
  subquery: SymbolKind.Namespace,
  lateral: SymbolKind.Namespace,
  column: SymbolKind.Field,
  alias: SymbolKind.Field,
  function: SymbolKind.Function,
};

function include(s: Sym): boolean {
  if (s.modifiers.includes("declaration")) return true;
  if (s.modifiers.includes("output")) return true;
  return false;
}

export function computeDocumentSymbols(text: string, dialect: Dialect): DocumentSymbol[] {
  const out: DocumentSymbol[] = [];
  for (const s of deriveSymbols(text, undefined, { dialect })) {
    if (!include(s)) continue;
    const range = rangeFromSpan(s.span);
    out.push({
      name: s.name,
      kind: KIND[s.kind],
      range,
      selectionRange: range,
      detail: s.frame === "_main_" ? undefined : s.frame,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lsp.feature-symbols.test.ts`
Expected: PASS (2 tests). (If `deriveSymbols`'s output-column modifier label differs from `"output"`, verify against `src/symbols/symbols.ts` and adjust `include`.)

- [ ] **Step 5: Commit**

```bash
git add src/lsp/features/symbols.ts tests/lsp.feature-symbols.test.ts
git commit -m "feat(lsp): document-symbols feature (#9)"
```

---

### Task C5: features/definition.ts — go-to-definition

**Files:**
- Create: `src/lsp/features/definition.ts`
- Test: `tests/lsp.feature-definition.test.ts`

**Interfaces:**
- Consumes: `deriveSymbols`, `Dialect` from `../../api.js`; `Sym` from `../../symbols/symbols.js`; `rangeFromSpan` from `../ranges.js`; `positionToOffset` from `../ranges.js`; `Location`, `Position` from `vscode-languageserver-types`.
- Produces: `function computeDefinition(text: string, dialect: Dialect, position: Position, uri: string): Location | null` — find the reference `Sym` whose span covers the cursor; if it has a `definition` span (an in-query CTE/subquery output), return a `Location` at that span. Returns `null` for catalog tables/columns (no in-query definition) or when nothing matches. Reuses the library's already-computed `Sym.definition` rather than re-resolving (thin adapter).

**Note:** `Sym.span` is 1-based line / 0-based column / endColumn past last char. Convert the cursor offset to a (line,column) to test coverage, OR test coverage in offset space by converting the span to offsets. Simplest: build the span's char range from the text using a line-start index. Provide `spanCoversCursor(text, span, position)` inline.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lsp.feature-definition.test.ts
import { describe, it, expect } from "vitest";
import { computeDefinition } from "../src/lsp/features/definition.js";

describe("computeDefinition", () => {
  it("jumps from a CTE reference in FROM to the CTE declaration", () => {
    const sql = "WITH recent AS (SELECT id FROM sales) SELECT id FROM recent";
    const refIdx = sql.lastIndexOf("recent"); // the FROM reference
    const loc = computeDefinition(sql, "databricks", lineCol(sql, refIdx), "file:///q.sql");
    expect(loc).not.toBeNull();
    // definition is the earlier declaration, before the reference
    const defStart = loc!.range.start;
    expect(defStart.line).toBe(0);
    expect(defStart.character).toBeLessThan(refIdx);
  });

  it("returns null for a bare catalog table with no in-query definition", () => {
    const sql = "SELECT id FROM sales";
    const loc = computeDefinition(sql, "databricks", lineCol(sql, sql.indexOf("sales")), "file:///q.sql");
    expect(loc).toBeNull();
  });
});

function lineCol(text: string, offset: number) {
  const before = text.slice(0, offset);
  const line = before.split("\n").length - 1;
  const character = offset - (before.lastIndexOf("\n") + 1);
  return { line, character };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lsp.feature-definition.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lsp/features/definition.ts
import type { Location, Position } from "vscode-languageserver-types";
import { deriveSymbols, type Dialect } from "../../api.js";
import type { Span, Sym } from "../../symbols/symbols.js";
import { rangeFromSpan } from "../ranges.js";

// ---------------------------------------------------------------------------
// Go-to-definition: reuse the library's symbol model. deriveSymbols already
// resolves each in-query reference to the span of its declaration (Sym.definition
// — a CTE name, or the projection in a CTE/subquery that produces a column). This
// finds the reference under the cursor and returns its definition Location. Pure
// translation: no re-resolution here.
// ---------------------------------------------------------------------------

export function computeDefinition(
  text: string,
  dialect: Dialect,
  position: Position,
  uri: string,
): Location | null {
  const syms = deriveSymbols(text, undefined, { dialect });
  // The smallest reference symbol whose span covers the cursor and that has a definition.
  let best: Sym | undefined;
  for (const s of syms) {
    if (!s.definition) continue;
    if (!spanCoversCursor(text, s.span, position)) continue;
    if (!best || spanLength(text, s.span) < spanLength(text, best.span)) best = s;
  }
  if (!best || !best.definition) return null;
  return { uri, range: rangeFromSpan(best.definition) };
}

/** 0-based char offset of an LSP position into `text`. */
function offsetOf(text: string, position: Position): number {
  let line = 0;
  let off = 0;
  while (line < position.line && off < text.length) {
    const nl = text.indexOf("\n", off);
    if (nl === -1) break;
    off = nl + 1;
    line++;
  }
  return off + position.character;
}

/** Char offset of a span's start: line is 1-based, column 0-based. */
function spanStartOffset(text: string, span: Span): number {
  return offsetOf(text, { line: span.line - 1, character: span.column });
}
function spanEndOffset(text: string, span: Span): number {
  return offsetOf(text, { line: span.endLine - 1, character: span.endColumn });
}
function spanCoversCursor(text: string, span: Span, position: Position): boolean {
  const cur = offsetOf(text, position);
  return spanStartOffset(text, span) <= cur && cur <= spanEndOffset(text, span);
}
function spanLength(text: string, span: Span): number {
  return spanEndOffset(text, span) - spanStartOffset(text, span);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lsp.feature-definition.test.ts`
Expected: PASS (2 tests). (If a CTE reference in FROM is not emitted with a `definition` by `deriveSymbols`, verify against `src/symbols/symbols.ts`; the reference→definition wiring there is the source of truth.)

- [ ] **Step 5: Commit**

```bash
git add src/lsp/features/definition.ts tests/lsp.feature-definition.test.ts
git commit -m "feat(lsp): go-to-definition feature (#9)"
```

---

## Phase D — server, acceptance suite, stdio + README

### Task D1: server.ts — connection wiring + main.ts stdio entry

**Files:**
- Create: `src/lsp/server.ts`
- Create: `src/lsp/main.ts`
- Test: (covered by D2's protocol suite — no separate unit test; this task's deliverable is verified end-to-end there)

**Interfaces:**
- Consumes: `createConnection`, `TextDocuments`, `Connection`, `InitializeParams`, `TextDocumentSyncKind` from `vscode-languageserver`; `TextDocument` from `vscode-languageserver-textdocument`; `fileURLToPath`/`URL` for uri→path; `loadDialectConfig` from `./dialect-config.js`; the four feature fns.
- Produces:
  - `function startServer(connection: Connection): void` — wires `onInitialize` (advertises hover/definition/documentSymbol + full text sync + `publishDiagnostics`), a `TextDocuments<TextDocument>` manager, and the request handlers. Loads `.sqllens.json` from the initialize `rootUri`. On `didOpen`/`didChange`, recomputes and publishes diagnostics. Logs config warnings via `connection.window.logMessage` (`window/logMessage`).
  - `src/lsp/main.ts` — `startServer(createConnection(ProposedFeatures.all))` over stdio; the attachable binary.

**Note:** This task has no isolated unit test because its value is the wired protocol surface, which D2 drives end-to-end. Fold the wiring + the stdio entry into this one task; D2 is its test.

- [ ] **Step 1: Write `src/lsp/server.ts`**

```ts
// src/lsp/server.ts
import {
  type Connection,
  type InitializeParams,
  type InitializeResult,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { fileURLToPath } from "node:url";
import { relative } from "node:path";
import { loadDialectConfig, type DialectConfig } from "./dialect-config.js";
import { computeDiagnostics } from "./features/diagnostics.js";
import { computeHover } from "./features/hover.js";
import { computeDocumentSymbols } from "./features/symbols.js";
import { computeDefinition } from "./features/definition.js";

// ---------------------------------------------------------------------------
// The server: connection wiring only. Each request maps a document to its dialect
// (via .sqllens.json) and delegates to a feature unit. No analysis lives here.
// startServer(connection) is shared by the stdio binary (main.ts) and the
// in-memory acceptance suite, so the tested code path IS the shipped one.
// ---------------------------------------------------------------------------

export function startServer(connection: Connection): void {
  const documents = new TextDocuments<TextDocument>(TextDocument);
  let rootDir = process.cwd();
  let config: DialectConfig = loadDialectConfig(rootDir);

  const uriToRel = (uri: string): string => {
    try {
      return relative(rootDir, fileURLToPath(uri));
    } catch {
      return uri;
    }
  };

  connection.onInitialize((params: InitializeParams): InitializeResult => {
    if (params.rootUri) {
      try {
        rootDir = fileURLToPath(params.rootUri);
      } catch {
        /* keep cwd */
      }
    } else if (params.workspaceFolders?.[0]) {
      try {
        rootDir = fileURLToPath(params.workspaceFolders[0].uri);
      } catch {
        /* keep cwd */
      }
    }
    config = loadDialectConfig(rootDir);
    for (const w of config.warnings) connection.window.logMessage({ type: 3 /* Info */, message: w });
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
        hoverProvider: true,
        definitionProvider: true,
        documentSymbolProvider: true,
      },
    };
  });

  const publish = (doc: TextDocument): void => {
    const dialect = config.dialectFor(uriToRel(doc.uri));
    const diagnostics = computeDiagnostics(doc.getText(), dialect, config.schema);
    connection.sendDiagnostics({ uri: doc.uri, diagnostics });
  };

  documents.onDidOpen((e) => publish(e.document));
  documents.onDidChangeContent((e) => publish(e.document));

  connection.onHover((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;
    const dialect = config.dialectFor(uriToRel(doc.uri));
    return computeHover(doc.getText(), dialect, params.position, config.schema);
  });

  connection.onDefinition((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;
    const dialect = config.dialectFor(uriToRel(doc.uri));
    return computeDefinition(doc.getText(), dialect, params.position, doc.uri);
  });

  connection.onDocumentSymbol((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return [];
    const dialect = config.dialectFor(uriToRel(doc.uri));
    return computeDocumentSymbols(doc.getText(), dialect);
  });

  documents.listen(connection);
  connection.listen();
}
```

- [ ] **Step 2: Write `src/lsp/main.ts`**

```ts
// src/lsp/main.ts
// Attachable stdio entry: the same server any LSP client (VS Code) connects to.
import { createConnection, ProposedFeatures } from "vscode-languageserver/node.js";
import { startServer } from "./server.js";

startServer(createConnection(ProposedFeatures.all));
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean (no errors in `src/lsp/`).

- [ ] **Step 4: Commit**

```bash
git add src/lsp/server.ts src/lsp/main.ts
git commit -m "feat(lsp): server wiring + attachable stdio entry (#9)"
```

---

### Task D2: In-memory protocol acceptance suite

**Files:**
- Create: `tests/lsp.acceptance.test.ts`

**Interfaces:**
- Consumes: `startServer` from `../src/lsp/server.js`; `createConnection` from `vscode-languageserver/node.js`; `createProtocolConnection`, `StreamMessageReader`, `StreamMessageWriter`, request types (`InitializeRequest`, `DidOpenTextDocumentNotification`, `HoverRequest`, `DefinitionRequest`, `DocumentSymbolRequest`, `PublishDiagnosticsNotification`) from `vscode-languageserver-protocol/node.js`; node `stream.Duplex`.
- Produces: the acceptance gate — drives the real server over an in-memory duplex pair and asserts positioned results for all four features, using a temp workspace with `.sqllens.json` + `schema.json`.

**The in-memory transport** (documented vscode-languageserver test pattern): two `Duplex` streams crossing client↔server.

- [ ] **Step 1: Write the acceptance suite**

```ts
// tests/lsp.acceptance.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Duplex } from "node:stream";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createConnection } from "vscode-languageserver/node.js";
import {
  createProtocolConnection,
  StreamMessageReader,
  StreamMessageWriter,
  InitializeRequest,
  DidOpenTextDocumentNotification,
  HoverRequest,
  DefinitionRequest,
  DocumentSymbolRequest,
  PublishDiagnosticsNotification,
  type PublishDiagnosticsParams,
} from "vscode-languageserver-protocol/node.js";
import { startServer } from "../src/lsp/server.js";

class TestStream extends Duplex {
  _write(chunk: Buffer, _enc: string, done: () => void) {
    this.emit("data", chunk);
    done();
  }
  _read() {}
}

let root: string;
let client: ReturnType<typeof createProtocolConnection>;
const diagnosticsByUri = new Map<string, PublishDiagnosticsParams>();

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "sqllens-lsp-"));
  writeFileSync(
    join(root, ".sqllens.json"),
    JSON.stringify({ dialects: [{ files: "**/*.sql", dialect: "databricks" }], default: "databricks", schema: "schema.json" }),
  );
  writeFileSync(join(root, "schema.json"), JSON.stringify({ sales: { amount: "decimal", id: "int" } }));

  const up = new TestStream();
  const down = new TestStream();
  // Server reads `up`, writes `down`; client reads `down`, writes `up`.
  const serverConnection = createConnection(new StreamMessageReader(up), new StreamMessageWriter(down));
  startServer(serverConnection);

  client = createProtocolConnection(new StreamMessageReader(down), new StreamMessageWriter(up));
  client.onNotification(PublishDiagnosticsNotification.type, (p) => diagnosticsByUri.set(p.uri, p));
  client.listen();

  await client.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: pathToFileURL(root).toString(),
    capabilities: {},
    workspaceFolders: null,
  });
});

afterAll(() => {
  client.dispose();
  rmSync(root, { recursive: true, force: true });
});

function open(name: string, text: string): string {
  const uri = pathToFileURL(join(root, name)).toString();
  void client.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: { uri, languageId: "sql", version: 1, text },
  });
  return uri;
}

async function waitForDiagnostics(uri: string): Promise<PublishDiagnosticsParams> {
  for (let i = 0; i < 50; i++) {
    const d = diagnosticsByUri.get(uri);
    if (d) return d;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("no diagnostics published for " + uri);
}

describe("LSP acceptance", () => {
  it("syntax diagnostic lands on the expected line", async () => {
    const uri = open("broken.sql", "SELECT FROM");
    const d = await waitForDiagnostics(uri);
    expect(d.diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(d.diagnostics[0].range.start.line).toBe(0);
  });

  it("semantic diagnostic flags an unknown column with the schema", async () => {
    const uri = open("bad-col.sql", "SELECT nope FROM sales");
    const d = await waitForDiagnostics(uri);
    expect(d.diagnostics.some((x) => /nope|unknown/i.test(x.message))).toBe(true);
  });

  it("valid SQL with matching schema is diagnostic-clean", async () => {
    const uri = open("ok.sql", "SELECT amount FROM sales");
    const d = await waitForDiagnostics(uri);
    expect(d.diagnostics).toEqual([]);
  });

  it("hover returns the inferred type of a column", async () => {
    const text = "SELECT amount FROM sales";
    const uri = open("hover.sql", text);
    const hover = await client.sendRequest(HoverRequest.type, {
      textDocument: { uri },
      position: { line: 0, character: text.indexOf("amount") },
    });
    expect(hover).not.toBeNull();
    const value = (hover as any).contents.value as string;
    expect(value).toMatch(/decimal/);
  });

  it("go-to-definition jumps from a CTE reference to its declaration", async () => {
    const text = "WITH recent AS (SELECT id FROM sales) SELECT id FROM recent";
    const uri = open("def.sql", text);
    const loc = await client.sendRequest(DefinitionRequest.type, {
      textDocument: { uri },
      position: { line: 0, character: text.lastIndexOf("recent") },
    });
    expect(loc).not.toBeNull();
    const range = Array.isArray(loc) ? (loc[0] as any).range : (loc as any).range;
    expect(range.start.character).toBeLessThan(text.lastIndexOf("recent"));
  });

  it("document symbols list a CTE", async () => {
    const text = "WITH recent AS (SELECT id FROM sales) SELECT id FROM recent";
    const uri = open("sym.sql", text);
    const syms = await client.sendRequest(DocumentSymbolRequest.type, { textDocument: { uri } });
    expect((syms as any[]).some((s) => s.name === "recent")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the acceptance suite**

Run: `npx vitest run tests/lsp.acceptance.test.ts`
Expected: PASS (6 tests). If a request hangs, the duplex wiring is reversed — confirm the server reads `up`/writes `down` and the client reads `down`/writes `up`.

- [ ] **Step 3: Commit**

```bash
git add tests/lsp.acceptance.test.ts
git commit -m "test(lsp): in-memory protocol acceptance suite — the gate (#9)"
```

---

### Task D3: stdio README + npm script

**Files:**
- Create: `src/lsp/README.md`
- Modify: `package.json` (add an `lsp` script)

- [ ] **Step 1: Add the run script to `package.json`**

Add to `scripts`:
```json
"lsp": "node --import tsx src/lsp/main.ts"
```
If `tsx` is not already a devDependency, install it: `npm install -D tsx`.

- [ ] **Step 2: Write `src/lsp/README.md`**

Document: what the server is (a thin LSP adapter over the library; an application, not part of the published library), the features (syntax + semantic diagnostics, hover types, go-to-definition, document symbols), `.sqllens.json` config (ordered glob rules first-match-wins + optional schema), how to run it (`npm run lsp`, speaks LSP over stdio), and how to attach a VS Code client (point a generic LSP client extension at the stdio command). State that the in-memory acceptance suite (`tests/lsp.acceptance.test.ts`) is the repeatable proof and the stdio binary is the same code path for eyeballing.

- [ ] **Step 3: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all suites green (including `tests/lsp.*`).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lsp/README.md
git commit -m "docs(lsp): stdio run script + README (#9)"
```

---

## Phase E — final sweep (harness step, not a coding task)

Multi-agent review over the whole branch diff, three lenses:
1. **Correctness** — positions/ranges right across all features; off-by-one in `ranges.ts`; node-at smallest-covering correctness.
2. **Thin adapter** — `src/lsp/` contains ONLY translation; no analysis logic leaked in; every feature delegates to the library.
3. **Spec conformance** — all four acceptance features positioned and green; `.sqllens.json` ordered first-match; library change is minimal and behavior-preserving; `src/lsp` not in the barrel.

Then: full `npm test` + `npm run typecheck` green → **branch-ready**, notify Niclas. No push/PR/merge without sign-off.

## Positional completeness (the bar: every editor-facing output has a real span)

Niclas (2026-06-28): position drives everything; nothing count-only, nothing point-only, no deferred "didn't implement position" anywhere. Each editor-facing output and its span source:

- **Syntax diagnostics** (all five dialects, incl. BigQuery escape + post-parse via A7) — `SyntaxDiagnostic` `{line, column, offset, length}` = a real range. ✅
- **Semantic diagnostics** (`qualify`) — full span `{line, column, endLine, endColumn}` via A8. ✅
- **Hover** — range from the covering expr's CST (`rangeFromCst`). ✅
- **Go-to-definition** — `Sym.definition` full `Span`. ✅
- **Document symbols** — `Sym.span` full `Span`. ✅

No count-only or point-only path remains. If any new output is added, it carries a span or it isn't done.

## Explicit v1 scope (Niclas-set in the approved design spec — NOT deferred gaps)

- **Completion** and the **SQL-debugger adapter** are out of v1 *by the design spec's own scope decision* (issue #9 / the design doc), not a leftover. They reuse this server's `node-at`/scope plumbing when built. (Recorded as scope, not as an unfinished task.)
